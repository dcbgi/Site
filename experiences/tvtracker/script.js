// ── TV Show Tracker ─────────────────────────────────────────────────────────
// A shared, cross-device watch tracker backed by Firebase Firestore. Anyone
// can VIEW the tracker (public read), but adding/editing/deleting a show
// requires signing in with Google as the specific owner account — checked by
// email in Firestore's security rules, not just "any authenticated user".
// This stops other people from creating false records while still letting
// friends browse the list.
//
// One document per show (not per episode): each tracks its own status
// (want to watch / watching / completed), current season+episode, rating,
// and notes — editing progress is a couple of clicks, not a new form entry.
//
// See firebase-config.js for one-time setup instructions, and
// firestore.rules.txt for the security rules to publish. OWNER_EMAIL below
// must match the email hardcoded into firestore.rules.txt's isOwner().

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Replace with your Google account email — must match firestore.rules.txt.
var OWNER_EMAIL = "deiondreaberry@example.com";

// ── esc ───────────────────────────────────────────────────────────────────
function esc(str) {
  var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, function (c) { return map[c]; });
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
function interactiveStarsHtml(showId, rating) {
  var html = '<span class="stars-display card-stars" data-show-id="' + esc(showId) + '">';
  for (var s = 1; s <= 5; s++) {
    html += '<button type="button" class="star-display card-rating-star' + (s <= rating ? " filled" : "") + '" data-show-id="' + esc(showId) + '" data-val="' + s + '" aria-label="Rate ' + s + " star" + (s > 1 ? "s" : "") + '">★</button>';
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

// ── Firebase init ─────────────────────────────────────────────────────────
var configIsPlaceholder = Object.keys(firebaseConfig).some(function (key) {
  return String(firebaseConfig[key]).indexOf("REPLACE_WITH_YOUR") === 0;
});

var app, db, auth;
var isOwner = false;
var shows = []; // [{ id, username, title, status, season, episode, rating, notes }]

function showBanner(text, kind) {
  var el = document.getElementById("status-banner");
  el.textContent = text;
  el.className = "banner visible " + (kind || "info");
}
function hideBanner() {
  document.getElementById("status-banner").className = "banner";
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
      isOwner = !!(user && user.email === OWNER_EMAIL);
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
  return (
    '<div class="show-card-top">' +
      '<span class="show-title">' + esc(show.title) + "</span>" +
      '<span class="show-user">@' + esc(show.username) + "</span>" +
    "</div>"
  );
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
        (isOwner ? interactiveStarsHtml(show.id, show.rating || 0) : starsDisplayHtml(show.rating || 0)) +
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

  var usernameEl = document.getElementById("input-username");
  var titleEl = document.getElementById("input-title");
  var statusEl = document.getElementById("input-status");
  var seasonEl = document.getElementById("input-season");
  var episodeEl = document.getElementById("input-episode");
  var notesEl = document.getElementById("input-notes");

  var username = usernameEl.value.trim();
  var title = titleEl.value.trim();
  var status = statusEl.value;
  var notes = notesEl.value.trim();

  if (!username) { usernameEl.focus(); return; }
  if (!title) { titleEl.focus(); return; }

  var season = status === "watching" ? (parseInt(seasonEl.value, 10) || 1) : 1;
  var episode = status === "watching" ? (parseInt(episodeEl.value, 10) || 1) : 1;
  var rating = status === "completed" ? pendingRating : 0;

  addDoc(collection(db, "shows"), {
    username: username,
    title: title,
    status: status,
    season: season,
    episode: episode,
    rating: rating,
    notes: notes,
    updatedAt: serverTimestamp(),
  }).catch(function (err) { showBanner("⚠️ Couldn't add show: " + err.message, "error"); });

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
    .catch(function (err) { showBanner("⚠️ Couldn't update show: " + err.message, "error"); });
}
function findShow(showId) {
  return shows.find(function (s) { return s.id === showId; });
}

// ── Currently Watching actions ──────────────────────────────────────────────
document.getElementById("watching-list").addEventListener("click", function (e) {
  var nextEp = e.target.closest(".next-episode-btn");
  if (nextEp) {
    var show = findShow(nextEp.dataset.showId);
    if (show) updateShow(show.id, { episode: show.episode + 1 });
    return;
  }
  var nextSeason = e.target.closest(".next-season-btn");
  if (nextSeason) {
    var show2 = findShow(nextSeason.dataset.showId);
    if (show2) updateShow(show2.id, { season: show2.season + 1, episode: 1 });
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
    updateShow(showId, { season: season, episode: episode });
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
      .catch(function (err) { showBanner("⚠️ Couldn't delete show: " + err.message, "error"); });
  }
});

// ── Want to Watch actions ────────────────────────────────────────────────────
document.getElementById("towatch-list").addEventListener("click", function (e) {
  var start = e.target.closest(".start-watching-btn");
  if (start) {
    updateShow(start.dataset.showId, { status: "watching", season: 1, episode: 1 });
    return;
  }
  var del = e.target.closest(".delete-show-btn");
  if (del) {
    if (!confirm("Delete this show?")) return;
    deleteDoc(doc(db, "shows", del.dataset.showId))
      .catch(function (err) { showBanner("⚠️ Couldn't delete show: " + err.message, "error"); });
  }
});

// ── Completed actions ────────────────────────────────────────────────────────
document.getElementById("completed-list").addEventListener("click", function (e) {
  var star = e.target.closest(".card-rating-star");
  if (star) {
    var showId = star.dataset.showId;
    var val = parseInt(star.dataset.val, 10);
    var show = findShow(showId);
    var newRating = (show && show.rating === val) ? 0 : val; // click same star again to clear
    updateShow(showId, { rating: newRating });
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
      .catch(function (err) { showBanner("⚠️ Couldn't delete show: " + err.message, "error"); });
  }
});

// ── Footer year ───────────────────────────────────────────────────────────
var yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

renderRatingInput();

