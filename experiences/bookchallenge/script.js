// ── Book Challenge ────────────────────────────────────────────────────────
// A shared, cross-device reading challenge backed by Firebase Firestore.
// Every browser gets a silent anonymous auth session (no login UI) — that
// session's uid tags anything it creates, which Firestore security rules
// use to allow only the creator to delete their own entries. Anyone can
// still log a book for anyone (the "reader" field is independent of the
// browser's own auth identity).
//
// See firebase-config.js for one-time setup instructions, and
// firestore.rules.txt for the security rules to publish.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-check.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig, recaptchaSiteKey } from "./firebase-config.js";

// ── esc ───────────────────────────────────────────────────────────────────
// Escapes the five HTML-special characters before inserting any user data
// into innerHTML — the primary XSS defence for this page.
function esc(str) {
  var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, function (c) { return map[c]; });
}

function fmtDate(ts) {
  if (!ts) return "just now";
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Scoring ───────────────────────────────────────────────────────────────
// Baseline is the community average page count across every logged entry —
// it self-adjusts as more books are added. Each entry's "book credit" is its
// page count relative to that baseline (a book at exactly the average is
// worth 1 book; a book 50% longer is worth 1.5).
function computeBaseline(entries) {
  if (entries.length === 0) return null;
  var total = entries.reduce(function (sum, e) { return sum + e.pages; }, 0);
  return total / entries.length;
}
function bookCredit(pages, baseline) {
  if (!baseline) return 0;
  return pages / baseline;
}
function totalCreditsFor(readerName, entries, baseline) {
  return entries
    .filter(function (e) { return e.readerName === readerName; })
    .reduce(function (sum, e) { return sum + bookCredit(e.pages, baseline); }, 0);
}
function actualBooksFor(readerName, entries) {
  return entries.filter(function (e) { return e.readerName === readerName; }).length;
}

var showAdjusted = false; // Toggled by the "Show adjusted score" checkbox

// ── Firebase init ─────────────────────────────────────────────────────────
var configIsPlaceholder = Object.keys(firebaseConfig).some(function (key) {
  return String(firebaseConfig[key]).indexOf("REPLACE_WITH_YOUR") === 0;
});

var app, db, auth;
var currentUid = null;
var readers = [];   // [{ id, name, goalBooks, creatorUid }]
var entries = [];   // [{ id, readerName, title, pages, loggedAt, creatorUid }]

function showBanner(text, kind) {
  var el = document.getElementById("status-banner");
  el.textContent = text;
  el.className = "banner visible " + (kind || "info");
}
function hideBanner() {
  document.getElementById("status-banner").className = "banner";
}

if (configIsPlaceholder) {
  showBanner(
    "⚠️ Firebase isn't configured yet — this page can't load or save data until firebase-config.js is filled in (see the comments in that file for setup steps).",
    "warn"
  );
} else {
  try {
    app = initializeApp(firebaseConfig);

    // App Check is optional until you've completed the setup steps in
    // firebase-config.js — skip it silently rather than breaking the page
    // if the site key is still a placeholder.
    if (recaptchaSiteKey.indexOf("REPLACE_WITH_YOUR") !== 0) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }

    db = getFirestore(app);
    auth = getAuth(app);
    showBanner("Connecting…", "info");

    onAuthStateChanged(auth, function (user) {
      if (user) {
        currentUid = user.uid;
        hideBanner();
        renderAll(); // Re-render so "your" delete buttons appear once known
      }
    });
    signInAnonymously(auth).catch(function (err) {
      showBanner("⚠️ Couldn't connect: " + err.message, "error");
    });

    onSnapshot(collection(db, "readers"), function (snap) {
      readers = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      populateReaderSelect();
      renderAll();
    }, function (err) {
      showBanner("⚠️ Couldn't load readers: " + err.message, "error");
    });

    onSnapshot(query(collection(db, "entries"), orderBy("loggedAt", "desc")), function (snap) {
      entries = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderAll();
    }, function (err) {
      showBanner("⚠️ Couldn't load entries: " + err.message, "error");
    });
  } catch (err) {
    showBanner("⚠️ Firebase failed to initialize: " + err.message, "error");
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────
function renderAll() {
  renderScoreboard();
  renderReadersTable();
  renderLogTable();
}

function renderScoreboard() {
  var baseline = computeBaseline(entries);
  document.getElementById("baseline-badge").textContent =
    baseline ? "Avg: " + Math.round(baseline) + " pages/book" : "No entries yet";

  var list = document.getElementById("scoreboard-list");
  var emptyState = document.getElementById("scoreboard-empty-state");

  if (readers.length === 0) {
    list.innerHTML = "";
    emptyState.style.display = "flex";
    return;
  }
  emptyState.style.display = "none";

  var ranked = readers
    .map(function (r) {
      var actual = actualBooksFor(r.name, entries);
      var adjusted = totalCreditsFor(r.name, entries, baseline);
      var actualPct = r.goalBooks > 0 ? Math.min(100, (actual / r.goalBooks) * 100) : 0;
      var adjustedPct = r.goalBooks > 0 ? Math.min(100, (adjusted / r.goalBooks) * 100) : 0;
      return { reader: r, actual: actual, adjusted: adjusted, actualPct: actualPct, adjustedPct: adjustedPct };
    })
    .sort(function (a, b) { return b.adjustedPct - a.adjustedPct; });

  list.innerHTML = ranked.map(function (row, i) {
    return (
      '<div class="score-row">' +
        '<div class="score-row-top">' +
          '<span><span class="score-rank">#' + (i + 1) + "</span>" +
          '<span class="score-name">' + esc(row.reader.name) + "</span></span>" +
          '<span class="score-goal">Goal: ' + esc(row.reader.goalBooks) + " books</span>" +
        "</div>" +
        '<div class="score-metric">' +
          '<span class="score-metric-label"><span class="metric-name">Actual</span><span>' + row.actual + " / " + row.reader.goalBooks + " books (" + Math.round(row.actualPct) + "%)</span></span>" +
          '<div class="progress-track"><div class="progress-fill' + (row.actualPct >= 100 ? " complete" : "") + '" style="width:' + row.actualPct + '%"></div></div>' +
        "</div>" +
        (showAdjusted
          ? '<div class="score-metric">' +
              '<span class="score-metric-label"><span class="metric-name">Adjusted</span><span>' + row.adjusted.toFixed(1) + " / " + row.reader.goalBooks + " books (" + Math.round(row.adjustedPct) + "%)</span></span>" +
              '<div class="progress-track"><div class="progress-fill adjusted' + (row.adjustedPct >= 100 ? " complete" : "") + '" style="width:' + row.adjustedPct + '%"></div></div>' +
            "</div>"
          : "") +
      "</div>"
    );
  }).join("");
}

function renderReadersTable() {
  var tbody = document.getElementById("readers-tbody");
  var table = document.getElementById("readers-table");
  var emptyState = document.getElementById("readers-empty-state");

  if (readers.length === 0) {
    tbody.innerHTML = "";
    table.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }
  table.style.display = "";
  emptyState.style.display = "none";

  tbody.innerHTML = readers
    .slice()
    .sort(function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); })
    .map(function (r) {
      return (
        '<tr data-reader-id="' + esc(r.id) + '">' +
          '<td data-label="Name"><span class="cell-name">' + esc(r.name) + "</span></td>" +
          '<td data-label="Goal">' +
            '<input class="form-input goal-input" type="number" min="1" max="999" value="' + esc(r.goalBooks) + '" data-reader-id="' + esc(r.id) + '" style="max-width:6rem" />' +
          "</td>" +
          '<td class="col-actions" data-label="">' +
            '<button class="btn btn-sm btn-primary save-goal-btn" data-reader-id="' + esc(r.id) + '">Save</button>' +
          "</td>" +
        "</tr>"
      );
    }).join("");
}

function renderLogTable() {
  var baseline = computeBaseline(entries);
  document.getElementById("entry-count").textContent = entries.length;

  var tbody = document.getElementById("log-tbody");
  var table = document.getElementById("log-table");
  var emptyState = document.getElementById("log-empty-state");

  if (entries.length === 0) {
    tbody.innerHTML = "";
    table.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }
  table.style.display = "";
  emptyState.style.display = "none";

  tbody.innerHTML = entries.map(function (e) {
    var credit = bookCredit(e.pages, baseline);
    var canDelete = currentUid && e.creatorUid === currentUid;
    return (
      '<tr data-entry-id="' + esc(e.id) + '">' +
        '<td data-label="Reader"><span class="cell-name">' + esc(e.readerName) + "</span></td>" +
        '<td data-label="Book">' + esc(e.title) + "</td>" +
        '<td data-label="Pages"><span class="cell-pill">' + esc(e.pages) + "</span></td>" +
        '<td data-label="Book Credit"><span class="cell-pill">' + credit.toFixed(2) + "</span></td>" +
        '<td data-label="Logged"><span class="cell-date">' + fmtDate(e.loggedAt) + "</span></td>" +
        '<td class="col-actions" data-label="">' +
          (canDelete
            ? '<button class="btn btn-icon btn-icon-danger delete-entry-btn" data-entry-id="' + esc(e.id) + '" title="Delete this entry" aria-label="Delete this entry">✕</button>'
            : "") +
        "</td>" +
      "</tr>"
    );
  }).join("");
}

function populateReaderSelect() {
  var select = document.getElementById("input-reader");
  var current = select.value;
  var html = '<option value="">Select a reader…</option>';
  readers
    .slice()
    .sort(function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); })
    .forEach(function (r) {
      html += '<option value="' + esc(r.name) + '">' + esc(r.name) + "</option>";
    });
  select.innerHTML = html;
  if (readers.some(function (r) { return r.name === current; })) select.value = current;
}

// ── Add reader ───────────────────────────────────────────────────────────
document.getElementById("reader-form").addEventListener("submit", function (e) {
  e.preventDefault();
  if (!db || !currentUid) { showBanner("⚠️ Still connecting — try again in a moment.", "warn"); return; }

  var nameEl = document.getElementById("input-reader-name");
  var goalEl = document.getElementById("input-reader-goal");
  var name = nameEl.value.trim();
  var goal = parseInt(goalEl.value, 10);

  if (!name) { nameEl.focus(); return; }
  if (!goal || goal < 1) { goalEl.focus(); return; }
  if (readers.some(function (r) { return r.name.toLowerCase() === name.toLowerCase(); })) {
    showBanner("⚠️ " + name + " is already on the list.", "warn");
    return;
  }

  addDoc(collection(db, "readers"), { name: name, goalBooks: goal, creatorUid: currentUid })
    .catch(function (err) { showBanner("⚠️ Couldn't add reader: " + err.message, "error"); });

  nameEl.value = "";
  goalEl.value = "";
  nameEl.focus();
});

// ── Edit a reader's goal ──────────────────────────────────────────────────
document.getElementById("readers-tbody").addEventListener("click", function (e) {
  var btn = e.target.closest(".save-goal-btn");
  if (!btn) return;
  if (!db || !currentUid) { showBanner("⚠️ Still connecting — try again in a moment.", "warn"); return; }

  var readerId = btn.dataset.readerId;
  var input = document.querySelector('.goal-input[data-reader-id="' + readerId + '"]');
  var goal = parseInt(input.value, 10);
  if (!goal || goal < 1) { input.focus(); return; }

  updateDoc(doc(db, "readers", readerId), { goalBooks: goal })
    .catch(function (err) { showBanner("⚠️ Couldn't update goal: " + err.message, "error"); });
});

// ── Log a book ────────────────────────────────────────────────────────────
document.getElementById("log-entry-form").addEventListener("submit", function (e) {
  e.preventDefault();
  if (!db || !currentUid) { showBanner("⚠️ Still connecting — try again in a moment.", "warn"); return; }

  var readerEl = document.getElementById("input-reader");
  var titleEl = document.getElementById("input-title");
  var pagesEl = document.getElementById("input-pages");

  var readerName = readerEl.value;
  var title = titleEl.value.trim();
  var pages = parseInt(pagesEl.value, 10);

  if (!readerName) { readerEl.focus(); return; }
  if (!title) { titleEl.focus(); return; }
  if (!pages || pages < 1) { pagesEl.focus(); return; }

  addDoc(collection(db, "entries"), {
    readerName: readerName,
    title: title,
    pages: pages,
    loggedAt: serverTimestamp(),
    creatorUid: currentUid,
  }).catch(function (err) { showBanner("⚠️ Couldn't log book: " + err.message, "error"); });

  titleEl.value = "";
  pagesEl.value = "";
  titleEl.focus();
});

// ── Delete an entry (only rendered for its own creator; rules enforce it too) ──
document.getElementById("log-tbody").addEventListener("click", function (e) {
  var btn = e.target.closest(".delete-entry-btn");
  if (!btn) return;
  if (!confirm("Delete this entry?")) return;

  deleteDoc(doc(db, "entries", btn.dataset.entryId))
    .catch(function (err) { showBanner("⚠️ Couldn't delete entry: " + err.message, "error"); });
});

// ── Toggle the Adjusted metric ─────────────────────────────────────────────
document.getElementById("toggle-adjusted").addEventListener("change", function (e) {
  showAdjusted = e.target.checked;
  renderScoreboard();
});

// ── Footer year ───────────────────────────────────────────────────────────
var yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
