// ── TV Show Tracker ─────────────────────────────────────────────────────────
// A single-owner watch tracker backed by Firebase Firestore. Anyone can VIEW
// the tracker (public read), but adding/editing/deleting a show requires
// signing in with Google as the specific owner account — checked by email in
// Firestore's security rules, not just "any authenticated user".
//
// One document per show (not per episode): each tracks its own status
// (want to watch / watching / completed), current season+episode, a
// per-episode "Watch History" log (each logged episode is its own entry
// with its own rating, auto-added whenever progress advances), a separate
// overall show rating you set yourself, and notes.
//
// See firebase-config.js for one-time setup instructions. The Firestore
// security rules (published in the Firebase console, not stored in this
// repo) are what actually check the owner's email — this file never
// contains it, since script.js is public client code every visitor
// downloads. Client-side isOwner is just "signed in with Google" for UI
// purposes; a non-owner account gets a permission-denied error from
// Firestore itself when it tries to write.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// ── esc ───────────────────────────────────────────────────────────────────
function esc(str) {
  var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, function (c) { return map[c]; });
}

// ── Episode log helpers ──────────────────────────────────────────────────────
// episodeLog is an array of { season, episode, rating, loggedAt } — one entry
// per episode watched, each independently ratable. A show's "episode
// average" (shown everywhere) is computed from these, separate from the
// overall showRating set yourself.
function withLoggedEpisode(log, season, episode) {
  var current = log || [];
  var exists = current.some(function (e) { return e.season === season && e.episode === episode; });
  if (exists) return current;
  return current.concat([{ season: season, episode: episode, rating: 0, loggedAt: Date.now() }]);
}
function averageEpisodeRating(show) {
  var values = (show.episodeLog || []).map(function (e) { return e.rating; }).filter(function (v) { return v > 0; });
  if (values.length === 0) return null;
  var sum = values.reduce(function (a, b) { return a + b; }, 0);
  return { avg: sum / values.length, count: values.length };
}

// ── Star rating ─────────────────────────────────────────────────────────────
var pendingRating = 0; // Star value highlighted in the add form (0-5)

function ratingInputHtml(value) {
  var html = "";
  for (var s = 1; s <= 5; s++) {
    html += '<button type="button" class="star rating-star' + (s <= value ? " filled" : "") + '" data-val="' + s + '" aria-label="' + s + " star" + (s > 1 ? "s" : "") + '">★</button>';
  }
  return html;
}
function renderRatingInput() {
  document.getElementById("rating-input").innerHTML = ratingInputHtml(pendingRating);
}
// target is "showRating" or "episodeLog"; season/episode are only needed for "episodeLog".
function interactiveStarsHtml(showId, rating, target, season, episode) {
  var extra = target === "episodeLog" ? ' data-season="' + season + '" data-episode="' + episode + '"' : "";
  var html = '<span class="stars-display card-stars">';
  for (var s = 1; s <= 5; s++) {
    html += '<button type="button" class="star-display card-rating-star' + (s <= rating ? " filled" : "") + '" data-show-id="' + esc(showId) + '" data-target="' + target + '"' + extra + ' data-val="' + s + '" aria-label="Rate ' + s + " star" + (s > 1 ? "s" : "") + '">★</button>';
  }
  html += "</span>";
  return html;
}
function starsDisplayHtml(rating) {
  var html = '<span class="stars-display" aria-label="' + rating + ' out of 5 stars">';
  for (var i = 1; i <= 5; i++) {
    html += '<span class="star-display' + (i <= rating ? " filled" : "") + '">★</span>';
  }
  html += "</span>";
  return html;
}
function episodeAverageHtml(show) {
  var avg = averageEpisodeRating(show);
  return avg
    ? '<span class="rating-summary">Episode avg: ' + avg.avg.toFixed(1) + '\u2605 (' + avg.count + " rated)</span>"
    : '<span class="rating-summary rating-summary-empty">No episodes rated yet</span>';
}
// Renders each logged episode as its own rateable row, newest first.
function watchHistoryHtml(show) {
  var log = (show.episodeLog || []).slice().sort(function (a, b) { return b.loggedAt - a.loggedAt; });
  if (log.length === 0) {
    return '<div class="watch-history"><p class="watch-history-empty">No episodes logged yet.</p></div>';
  }
  var rows = log.map(function (entry) {
    return (
      '<div class="watch-history-row">' +
        '<span class="cell-pill">S' + esc(entry.season) + "E" + esc(entry.episode) + "</span>" +
        (isOwner
          ? interactiveStarsHtml(show.id, entry.rating || 0, "episodeLog", entry.season, entry.episode)
          : starsDisplayHtml(entry.rating || 0)) +
      "</div>"
    );
  }).join("");
  return '<div class="watch-history"><div class="watch-history-title">Watch History</div>' + rows + "</div>";
}

// ── Firebase init ─────────────────────────────────────────────────────────
var configIsPlaceholder = Object.keys(firebaseConfig).some(function (key) {
  return String(firebaseConfig[key]).indexOf("REPLACE_WITH_YOUR") === 0;
});

var app, db, auth;
var isOwner = false;
var shows = []; // [{ id, title, status, season, episode, episodeLog, showRating, notes }]

function showBanner(text, kind) {
  var el = document.getElementById("status-banner");
  el.textContent = text;
  el.className = "banner visible " + (kind || "info");
}
function hideBanner() {
  document.getElementById("status-banner").className = "banner";
}
// Turns a raw Firebase error into a clearer message — a permission-denied
// write means "signed in, but not as the owner account", not a bug.
function friendlyError(prefix, err) {
  if (err && err.code === "permission-denied") {
    return prefix + " Only the owner's Google account can do that.";
  }
  return prefix + " " + err.message;
}
function updateAuthUi(user) {
  var signInBtn = document.getElementById("sign-in-btn");
  var signOutBtn = document.getElementById("sign-out-btn");
  var addPanel = document.getElementById("add-panel");

  if (isOwner) {
    signInBtn.style.display = "none";
    signOutBtn.style.display = "";
    addPanel.style.display = "";
    hideBanner();
  } else {
    signInBtn.style.display = "";
    signOutBtn.style.display = "none";
    addPanel.style.display = "none";
    showBanner(
      user ? "👀 Signed in, but not as the owner — viewing read-only." : "👀 Viewing read-only. Sign in as the owner to add or edit shows.",
      "info"
    );
  }
}

if (configIsPlaceholder) {
  showBanner(
    "⚠️ Firebase isn't configured yet — this page can't load or save data until firebase-config.js is filled in (see the comments in that file for setup steps).",
    "warn"
  );
} else {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, function (user) {
      isOwner = !!user;
      updateAuthUi(user);
      renderAll(); // Re-render so owner-only controls appear/disappear
    });

    document.getElementById("sign-in-btn").addEventListener("click", function () {
      signInWithPopup(auth, new GoogleAuthProvider())
        .catch(function (err) { showBanner("⚠️ Sign-in failed: " + err.message, "error"); });
    });
    document.getElementById("sign-out-btn").addEventListener("click", function () {
      signOut(auth);
    });

    onSnapshot(query(collection(db, "shows"), orderBy("updatedAt", "desc")), function (snap) {
      shows = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderAll();
    }, function (err) {
      showBanner("⚠️ Couldn't load shows: " + err.message, "error");
    });
  } catch (err) {
    showBanner("⚠️ Firebase failed to initialize: " + err.message, "error");
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────
function renderAll() {
  renderWatching();
  renderToWatch();
  renderCompleted();
}

function cardTop(show) {
  return '<div class="show-card-top"><span class="show-title">' + esc(show.title) + "</span></div>";
}
function deleteButtonHtml(show) {
  if (!isOwner) return "";
  return '<button class="btn btn-icon btn-icon-danger delete-show-btn" data-show-id="' + esc(show.id) + '" title="Delete this show" aria-label="Delete this show">✕</button>';
}

function renderWatching() {
  var list = shows.filter(function (s) { return s.status === "watching"; });
  document.getElementById("watching-count").textContent = list.length;

  var container = document.getElementById("watching-list");
  var emptyState = document.getElementById("watching-empty-state");
  if (list.length === 0) { container.innerHTML = ""; emptyState.style.display = "flex"; return; }
  emptyState.style.display = "none";

  container.innerHTML = list.map(function (show) {
    return (
      '<div class="show-card" data-show-id="' + esc(show.id) + '">' +
        cardTop(show) +
        '<div class="show-progress">' +
          '<span class="cell-pill">S' + esc(show.season) + "</span>" +
          '<span class="cell-pill">E' + esc(show.episode) + "</span>" +
          (isOwner
            ? '<input class="form-input progress-input season-input" type="number" min="1" max="999" value="' + esc(show.season) + '" data-show-id="' + esc(show.id) + '" aria-label="Season" />' +
              '<input class="form-input progress-input episode-input" type="number" min="1" max="999" value="' + esc(show.episode) + '" data-show-id="' + esc(show.id) + '" aria-label="Episode" />' +
              '<button class="btn btn-sm btn-primary save-progress-btn" data-show-id="' + esc(show.id) + '">Save</button>' +
              '<button class="btn btn-sm btn-ghost next-episode-btn" data-show-id="' + esc(show.id) + '">+1 Ep</button>' +
              '<button class="btn btn-sm btn-ghost next-season-btn" data-show-id="' + esc(show.id) + '">+1 Season</button>'
            : "") +
        "</div>" +
        '<div class="rating-row">' + episodeAverageHtml(show) + "</div>" +
        '<div class="rating-row">' +
          '<span class="rating-label">Show rating:</span>' +
          (isOwner ? interactiveStarsHtml(show.id, show.showRating || 0, "showRating") : starsDisplayHtml(show.showRating || 0)) +
        "</div>" +
        watchHistoryHtml(show) +
        (isOwner
          ? '<div class="show-actions">' +
              '<button class="btn btn-sm btn-ghost mark-completed-btn" data-show-id="' + esc(show.id) + '">✅ Mark Completed</button>' +
              deleteButtonHtml(show) +
            "</div>"
          : "") +
      "</div>"
    );
  }).join("");
}

function renderToWatch() {
  var list = shows.filter(function (s) { return s.status === "want_to_watch"; });
  document.getElementById("towatch-count").textContent = list.length;

  var container = document.getElementById("towatch-list");
  var emptyState = document.getElementById("towatch-empty-state");
  if (list.length === 0) { container.innerHTML = ""; emptyState.style.display = "flex"; return; }
  emptyState.style.display = "none";

  container.innerHTML = list.map(function (show) {
    return (
      '<div class="show-card" data-show-id="' + esc(show.id) + '">' +
        cardTop(show) +
        (isOwner
          ? '<div class="show-actions">' +
              '<button class="btn btn-sm btn-primary start-watching-btn" data-show-id="' + esc(show.id) + '">▶ Start Watching</button>' +
              deleteButtonHtml(show) +
            "</div>"
          : "") +
      "</div>"
    );
  }).join("");
}

function renderCompleted() {
  var list = shows.filter(function (s) { return s.status === "completed"; });
  document.getElementById("completed-count").textContent = list.length;

  var container = document.getElementById("completed-list");
  var emptyState = document.getElementById("completed-empty-state");
  if (list.length === 0) { container.innerHTML = ""; emptyState.style.display = "flex"; return; }
  emptyState.style.display = "none";

  container.innerHTML = list.map(function (show) {
    return (
      '<div class="show-card" data-show-id="' + esc(show.id) + '">' +
        cardTop(show) +
        '<div class="rating-row">' + episodeAverageHtml(show) + "</div>" +
        '<div class="rating-row">' +
          '<span class="rating-label">Show rating:</span>' +
          (isOwner ? interactiveStarsHtml(show.id, show.showRating || 0, "showRating") : starsDisplayHtml(show.showRating || 0)) +
        "</div>" +
        watchHistoryHtml(show) +
        (show.notes
          ? '<p class="show-notes">' + esc(show.notes) + "</p>"
          : "") +
        (isOwner
          ? '<div class="show-actions">' +
              '<button class="btn btn-sm btn-ghost resume-watching-btn" data-show-id="' + esc(show.id) + '">↺ Resume Watching</button>' +
              deleteButtonHtml(show) +
            "</div>"
          : "") +
      "</div>"
    );
  }).join("");
}

// ── Add-show form: status-driven field visibility ──────────────────────────
function updateFormFieldsForStatus() {
  var status = document.getElementById("input-status").value;
  document.getElementById("field-season").style.display = status === "watching" ? "" : "none";
  document.getElementById("field-episode").style.display = status === "watching" ? "" : "none";
  document.getElementById("field-rating").style.display = status === "completed" ? "" : "none";
}
document.getElementById("input-status").addEventListener("change", updateFormFieldsForStatus);
updateFormFieldsForStatus();

document.getElementById("rating-input").addEventListener("click", function (e) {
  var star = e.target.closest(".rating-star");
  if (!star) return;
  var val = parseInt(star.dataset.val, 10);
  pendingRating = (pendingRating === val) ? 0 : val;
  renderRatingInput();
});

// ── Add a show ──────────────────────────────────────────────────────────────
document.getElementById("add-show-form").addEventListener("submit", function (e) {
  e.preventDefault();
  if (!db || !isOwner) { showBanner("⚠️ Sign in as the owner to add a show.", "warn"); return; }

  var titleEl = document.getElementById("input-title");
  var statusEl = document.getElementById("input-status");
  var seasonEl = document.getElementById("input-season");
  var episodeEl = document.getElementById("input-episode");
  var notesEl = document.getElementById("input-notes");

  var title = titleEl.value.trim();
  var status = statusEl.value;
  var notes = notesEl.value.trim();

  if (!title) { titleEl.focus(); return; }

  var season = status === "watching" ? (parseInt(seasonEl.value, 10) || 1) : 1;
  var episode = status === "watching" ? (parseInt(episodeEl.value, 10) || 1) : 1;
  var showRating = status === "completed" ? pendingRating : 0;

  addDoc(collection(db, "shows"), {
    title: title,
    status: status,
    season: season,
    episode: episode,
    episodeLog: status === "watching" ? withLoggedEpisode([], season, episode) : [],
    showRating: showRating,
    notes: notes,
    updatedAt: serverTimestamp(),
  }).catch(function (err) { showBanner(friendlyError("⚠️ Couldn't add show:", err), "error"); });

  titleEl.value = "";
  seasonEl.value = "1";
  episodeEl.value = "1";
  notesEl.value = "";
  pendingRating = 0;
  renderRatingInput();
  titleEl.focus();
});

// ── Shared update helper ────────────────────────────────────────────────────
function updateShow(showId, fields) {
  if (!db || !isOwner) { showBanner("⚠️ Sign in as the owner to make changes.", "warn"); return; }
  updateDoc(doc(db, "shows", showId), Object.assign({}, fields, { updatedAt: serverTimestamp() }))
    .catch(function (err) { showBanner(friendlyError("⚠️ Couldn't update show:", err), "error"); });
}
function findShow(showId) {
  return shows.find(function (s) { return s.id === showId; });
}
// Shared handler for both rating rows (episode rating and overall show
// rating) — reads which target/star was clicked from its data attributes.
function rateShow(star) {
  var showId = star.dataset.showId;
  var target = star.dataset.target;
  var val = parseInt(star.dataset.val, 10);
  var show = findShow(showId);
  if (!show) return;

  if (target === "showRating") {
    var newShowRating = (show.showRating === val) ? 0 : val; // click same star again to clear
    updateShow(showId, { showRating: newShowRating });
  } else if (target === "episodeLog") {
    var season = parseInt(star.dataset.season, 10);
    var episode = parseInt(star.dataset.episode, 10);
    var log = (show.episodeLog || []).slice();
    var idx = log.findIndex(function (e) { return e.season === season && e.episode === episode; });
    if (idx === -1) return;
    var newRating = (log[idx].rating === val) ? 0 : val;
    log[idx] = Object.assign({}, log[idx], { rating: newRating });
    updateShow(showId, { episodeLog: log });
  }
}

// ── Currently Watching actions ──────────────────────────────────────────────
document.getElementById("watching-list").addEventListener("click", function (e) {
  var star = e.target.closest(".card-rating-star");
  if (star) {
    rateShow(star);
    return;
  }
  var nextEp = e.target.closest(".next-episode-btn");
  if (nextEp) {
    var show = findShow(nextEp.dataset.showId);
    if (show) {
      var newEpisode = show.episode + 1;
      updateShow(show.id, { episode: newEpisode, episodeLog: withLoggedEpisode(show.episodeLog, show.season, newEpisode) });
    }
    return;
  }
  var nextSeason = e.target.closest(".next-season-btn");
  if (nextSeason) {
    var show2 = findShow(nextSeason.dataset.showId);
    if (show2) {
      var newSeason = show2.season + 1;
      updateShow(show2.id, { season: newSeason, episode: 1, episodeLog: withLoggedEpisode(show2.episodeLog, newSeason, 1) });
    }
    return;
  }
  var save = e.target.closest(".save-progress-btn");
  if (save) {
    var showId = save.dataset.showId;
    var seasonInput = document.querySelector('.season-input[data-show-id="' + showId + '"]');
    var episodeInput = document.querySelector('.episode-input[data-show-id="' + showId + '"]');
    var season = parseInt(seasonInput.value, 10);
    var episode = parseInt(episodeInput.value, 10);
    if (!season || season < 1) { seasonInput.focus(); return; }
    if (!episode || episode < 1) { episodeInput.focus(); return; }
    var showToSave = findShow(showId);
    updateShow(showId, { season: season, episode: episode, episodeLog: withLoggedEpisode(showToSave ? showToSave.episodeLog : [], season, episode) });
    return;
  }
  var complete = e.target.closest(".mark-completed-btn");
  if (complete) {
    updateShow(complete.dataset.showId, { status: "completed" });
    return;
  }
  var del = e.target.closest(".delete-show-btn");
  if (del) {
    if (!confirm("Delete this show?")) return;
    deleteDoc(doc(db, "shows", del.dataset.showId))
      .catch(function (err) { showBanner(friendlyError("⚠️ Couldn't delete show:", err), "error"); });
  }
});

// ── Want to Watch actions ────────────────────────────────────────────────────
document.getElementById("towatch-list").addEventListener("click", function (e) {
  var start = e.target.closest(".start-watching-btn");
  if (start) {
    var show = findShow(start.dataset.showId);
    updateShow(start.dataset.showId, { status: "watching", season: 1, episode: 1, episodeLog: withLoggedEpisode(show ? show.episodeLog : [], 1, 1) });
    return;
  }
  var del = e.target.closest(".delete-show-btn");
  if (del) {
    if (!confirm("Delete this show?")) return;
    deleteDoc(doc(db, "shows", del.dataset.showId))
      .catch(function (err) { showBanner(friendlyError("⚠️ Couldn't delete show:", err), "error"); });
  }
});

// ── Completed actions ────────────────────────────────────────────────────────
document.getElementById("completed-list").addEventListener("click", function (e) {
  var star = e.target.closest(".card-rating-star");
  if (star) {
    rateShow(star);
    return;
  }
  var resume = e.target.closest(".resume-watching-btn");
  if (resume) {
    updateShow(resume.dataset.showId, { status: "watching" });
    return;
  }
  var del = e.target.closest(".delete-show-btn");
  if (del) {
    if (!confirm("Delete this show?")) return;
    deleteDoc(doc(db, "shows", del.dataset.showId))
      .catch(function (err) { showBanner(friendlyError("⚠️ Couldn't delete show:", err), "error"); });
  }
});

// ── Footer year ───────────────────────────────────────────────────────────
var yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

renderRatingInput();

