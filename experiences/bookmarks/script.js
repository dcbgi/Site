// ── Bookmarks ───────────────────────────────────────────────────────────────
// A PRIVATE, per-account bookmark manager backed by Firebase Firestore.
//
// Unlike the other experiences (which are publicly viewable), nothing here
// renders until the visitor signs in with Google. Once signed in, they see
// ONLY their own bookmarks: every document is stamped with the signer's uid
// (ownerUid) and the query filters on it, while Firestore security rules
// (see firebase-config.js) enforce that a given account can never read or
// write another account's documents.
//
// First-time signers are seeded with a small "Welcome" set of the owner's
// recommended links (RECOMMENDED below) so the page is never empty on arrival.
//
// Bookmarks are never deleted: the ✕ button HIDES a bookmark (sets a `hidden`
// flag) so it drops out of the visible list while its document remains in
// Firestore permanently — a "Show hidden" toggle brings hidden items back.
//
// PRIVATE OWNER IMPORT: the owner's full personal link set lives in the
// OPTIONAL file my-bookmarks.js. It is NOT auto-seeded and NOT statically
// imported — instead the owner clicks "Import my bookmarks" once, which lazily
// loads that file and writes the links into their private Firestore list. After
// importing, the owner can DELETE my-bookmarks.js and redeploy: the links then
// live only in Firestore (never in the repo or shipped JS), and this page keeps
// working because the import is lazy and fails gracefully when the file is gone.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, doc,
  onSnapshot, query, where, orderBy, getDocs, serverTimestamp, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig, OWNER_EMAIL } from "./firebase-config.js";

// ── Owner's recommendations ─────────────────────────────────────────────────
// Seeded into every NEW signer's own private list the first time they sign in,
// so nobody starts with a blank page. Edit this list freely — it only affects
// people who sign in for the first time after you change it.
const RECOMMENDED = [
  { title: "Berry Better Solutions (Home)", url: "https://berrybettersolutions.com", category: "Welcome" },
  { title: "Book Challenge",  url: "../bookchallenge/index.html", category: "Welcome" },
  { title: "TV Show Tracker", url: "../tvtracker/index.html",    category: "Welcome" },
];

// ── Owner check ─────────────────────────────────────────────────────────────
function isOwner() {
  return !!(OWNER_EMAIL && currentEmail &&
    currentEmail.toLowerCase() === OWNER_EMAIL.toLowerCase());
}

// ── esc ─────────────────────────────────────────────────────────────────────
// Escapes the five HTML-special characters before inserting any user data into
// innerHTML — the primary XSS defence for this page.
function esc(str) {
  var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, function (c) { return map[c]; });
}

// Returns a safe href: only http(s) and same-site relative links are allowed,
// so a stored "javascript:" URL can never execute when clicked.
function safeHref(url) {
  var u = String(url).trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(\.\.?\/|\/)/.test(u)) return u;      // relative path within the site
  return "https://" + u;                       // assume a bare domain
}

function hostLabel(url) {
  try { return new URL(safeHref(url)).hostname.replace(/^www\./, ""); }
  catch (e) { return ""; }
}

// ── State ───────────────────────────────────────────────────────────────────
var app, db, auth;
var currentUid = null;
var currentEmail = null;  // signed-in email, used to pick the seed dataset
var bookmarks = [];     // [{ id, title, url, category, ownerUid, createdAt, hidden }]
var searchTerm = "";
var showHidden = false;  // when true, hidden bookmarks are shown (greyed) too

// ── Banner ──────────────────────────────────────────────────────────────────
function showBanner(text, kind) {
  var el = document.getElementById("status-banner");
  el.textContent = text;
  el.className = "banner visible " + (kind || "info");
}
function hideBanner() {
  document.getElementById("status-banner").className = "banner";
}

// ── View toggles ────────────────────────────────────────────────────────────
function showGate() {
  document.getElementById("auth-gate").hidden = false;
  document.getElementById("app").hidden = true;
}
function showApp(user) {
  document.getElementById("auth-gate").hidden = true;
  document.getElementById("app").hidden = false;
  document.getElementById("account-email").textContent = user.email || user.displayName || "you";
}

// ── Firebase init ───────────────────────────────────────────────────────────
var configIsPlaceholder = Object.keys(firebaseConfig).some(function (key) {
  return String(firebaseConfig[key]).indexOf("REPLACE_WITH_YOUR") === 0;
});

if (configIsPlaceholder) {
  showGate();
  showBanner(
    "⚠️ Bookmarks isn't configured yet — this page can't sign you in or save data until firebase-config.js is filled in (see the setup steps in that file).",
    "warn"
  );
  // Still wire the button so clicking it explains what's missing.
  document.getElementById("sign-in-btn").addEventListener("click", function () {
    showBanner("Add your Firebase config + enable Google sign-in to turn this on.", "warn");
  });
} else {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, function (user) {
      if (user) {
        currentUid = user.uid;
        currentEmail = user.email || null;
        hideBanner();
        showApp(user);
        // Show the one-time import button only to the owner.
        document.getElementById("import-mine-btn").hidden = !isOwner();
        subscribeToBookmarks(user.uid);
      } else {
        currentUid = null;
        currentEmail = null;
        bookmarks = [];
        document.getElementById("import-mine-btn").hidden = true;
        showGate();
      }
    });

    document.getElementById("sign-in-btn").addEventListener("click", function () {
      signInWithPopup(auth, new GoogleAuthProvider())
        .catch(function (err) { showBanner("⚠️ Sign-in failed: " + err.message, "error"); });
    });
    document.getElementById("sign-out-btn").addEventListener("click", function () {
      signOut(auth);
    });
    document.getElementById("import-mine-btn").addEventListener("click", importMyBookmarks);
  } catch (err) {
    showGate();
    showBanner("⚠️ Firebase failed to initialize: " + err.message, "error");
  }
}

// ── Live subscription ───────────────────────────────────────────────────────
var unsubscribe = null;
function subscribeToBookmarks(uid) {
  if (unsubscribe) unsubscribe();
  var q = query(
    collection(db, "bookmarks"),
    where("ownerUid", "==", uid),
    orderBy("createdAt", "desc")
  );
  var seeded = false;
  unsubscribe = onSnapshot(q, function (snap) {
    bookmarks = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    // First arrival with an empty list → seed the small welcome set once, for
    // NON-owners only. The owner starts empty and imports their own set via the
    // one-time "Import my bookmarks" button instead.
    if (!seeded && bookmarks.length === 0 && !isOwner()) {
      seeded = true;
      writeDataset(uid, RECOMMENDED);
    }
    render();
  }, function (err) {
    showBanner("⚠️ Couldn't load bookmarks: " + err.message, "error");
  });
}

// Writes a dataset ([{title,url,category}]) into this account's own list,
// committing in chunks (Firestore batches cap at 500 writes). Guarded by a
// getDocs re-check so an account that already has data is never re-seeded.
// Returns a Promise resolving to the number of links written (0 if skipped).
function writeDataset(uid, dataset) {
  if (!dataset || dataset.length === 0) return Promise.resolve(0);
  var q = query(collection(db, "bookmarks"), where("ownerUid", "==", uid));
  return getDocs(q).then(function (snap) {
    if (!snap.empty) return 0;            // already has bookmarks — skip
    var i = 0;
    function commitChunk() {
      if (i >= dataset.length) return Promise.resolve(dataset.length);
      var batch = writeBatch(db);
      var end = Math.min(i + 400, dataset.length);
      for (; i < end; i++) {
        var b = dataset[i];
        var ref = doc(collection(db, "bookmarks"));
        batch.set(ref, {
          title: b.title,
          url: b.url,
          category: b.category || "Welcome",
          ownerUid: uid,
          // Stagger createdAt so the written items keep their listed order.
          createdAt: Date.now() - (dataset.length - i),
        });
      }
      return batch.commit().then(commitChunk);
    }
    return commitChunk();
  });
}

// One-time, owner-only import of the full personal set from my-bookmarks.js.
// Lazily imports the file so it can be DELETED from the repo afterwards without
// breaking this page. If the file is gone (already imported + removed), it tells
// the owner their bookmarks are already saved privately.
function importMyBookmarks() {
  if (!currentUid || !isOwner()) return;
  if (bookmarks.length > 0) {
    showBanner("You already have bookmarks saved — import skipped so nothing is duplicated.", "info");
    return;
  }
  var btn = document.getElementById("import-mine-btn");
  btn.disabled = true;
  showBanner("Importing your bookmarks…", "info");
  import("./my-bookmarks.js").then(function (mod) {
    var data = mod.MY_BOOKMARKS || [];
    return writeDataset(currentUid, data).then(function (count) {
      if (count > 0) {
        showBanner("✅ Imported " + count + " bookmarks into your private list. You can now delete my-bookmarks.js from the repo — your links live only in your account.", "info");
      } else {
        showBanner("Nothing imported — your account already has bookmarks.", "info");
      }
    });
  }).catch(function () {
    showBanner("Nothing to import — my-bookmarks.js isn't present, so your bookmarks are already saved privately.", "info");
  }).then(function () {
    btn.disabled = false;
  });
}

// ── Add / hide ───────────────────────────────────────────────────────────────
document.getElementById("bookmark-form").addEventListener("submit", function (e) {
  e.preventDefault();
  if (!currentUid) return;

  var title = document.getElementById("input-title").value.trim();
  var url = document.getElementById("input-url").value.trim();
  var category = document.getElementById("input-category").value.trim() || "Uncategorized";
  if (!title || !url) return;

  addDoc(collection(db, "bookmarks"), {
    title: title,
    url: url,
    category: category,
    ownerUid: currentUid,
    createdAt: serverTimestamp(),
  }).catch(function (err) { showBanner("⚠️ Couldn't add bookmark: " + err.message, "error"); });

  e.target.reset();
  document.getElementById("input-title").focus();
});

// Hide / unhide a bookmark. This is NON-DESTRUCTIVE: the document always stays
// in Firestore (so you keep a permanent record of every bookmark ever added) —
// we just flip a `hidden` flag that the render step filters on. Hidden items
// reappear whenever "Show hidden" is on, and can be unhidden with one click.
function setHidden(id, hidden) {
  updateDoc(doc(db, "bookmarks", id), { hidden: hidden })
    .catch(function (err) { showBanner("⚠️ Couldn't update: " + err.message, "error"); });
}

// ── Search ──────────────────────────────────────────────────────────────────
document.getElementById("search-input").addEventListener("input", function (e) {
  searchTerm = e.target.value.trim().toLowerCase();
  render();
});
// ── Show-hidden toggle ──────────────────────────────────────────────────
document.getElementById("toggle-hidden-btn").addEventListener("click", function () {
  showHidden = !showHidden;
  this.setAttribute("aria-pressed", String(showHidden));
  this.textContent = showHidden ? "🙈 Hide hidden" : "👁 Show hidden";
  render();
});
// ── Render ──────────────────────────────────────────────────────────────────
function render() {
  var container = document.getElementById("bookmarks-container");
  var emptyState = document.getElementById("bookmarks-empty-state");
  var countBadge = document.getElementById("bookmark-count");

  // Refresh the category autocomplete from all current bookmarks.
  var cats = bookmarks.map(function (b) { return b.category || "Uncategorized"; });
  var uniqueCats = cats.filter(function (c, i) { return cats.indexOf(c) === i; }).sort();
  document.getElementById("category-list").innerHTML =
    uniqueCats.map(function (c) { return '<option value="' + esc(c) + '"></option>'; }).join("");

  var filtered = bookmarks.filter(function (b) {
    // Hidden bookmarks stay in Firestore but are left out of the view unless
    // "Show hidden" is on.
    if (b.hidden && !showHidden) return false;
    if (!searchTerm) return true;
    return (b.title + " " + b.url + " " + (b.category || "")).toLowerCase().indexOf(searchTerm) !== -1;
  });

  countBadge.textContent = String(filtered.length);

  // Reflect how many are hidden on the toggle button.
  var hiddenCount = bookmarks.filter(function (b) { return b.hidden; }).length;
  var toggleBtn = document.getElementById("toggle-hidden-btn");
  toggleBtn.hidden = hiddenCount === 0 && !showHidden;
  if (!showHidden && hiddenCount > 0) {
    toggleBtn.textContent = "👁 Show hidden (" + hiddenCount + ")";
  }

  if (filtered.length === 0) {
    container.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  // Group by category, with "Welcome" first and the rest alphabetical.
  var groups = {};
  filtered.forEach(function (b) {
    var c = b.category || "Uncategorized";
    (groups[c] = groups[c] || []).push(b);
  });
  var order = Object.keys(groups).sort(function (a, b) {
    if (a === "Welcome") return -1;
    if (b === "Welcome") return 1;
    return a.localeCompare(b);
  });

  container.innerHTML = order.map(function (cat) {
    var cards = groups[cat].map(function (b) {
      var href = safeHref(b.url);
      var host = hostLabel(b.url);
      var isHidden = !!b.hidden;
      return (
        '<div class="bm-card' + (isHidden ? ' bm-card-hidden' : '') + '">' +
          '<a class="bm-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="bm-title">' + esc(b.title) + '</span>' +
            (host ? '<span class="bm-host">' + esc(host) + '</span>' : "") +
          '</a>' +
          '<button class="bm-hide" data-id="' + esc(b.id) + '" data-hidden="' + isHidden + '"' +
            ' title="' + (isHidden ? 'Unhide' : 'Hide') + '"' +
            ' aria-label="' + (isHidden ? 'Unhide bookmark' : 'Hide bookmark') + '">' +
            (isHidden ? '↩' : '✕') +
          '</button>' +
        '</div>'
      );
    }).join("");
    return (
      '<section class="bm-group">' +
        '<h3 class="bm-group-title">' + esc(cat) +
          ' <span class="bm-group-count">' + groups[cat].length + '</span></h3>' +
        '<div class="bm-grid">' + cards + '</div>' +
      '</section>'
    );
  }).join("");
}

// Hide / unhide via event delegation (cards are re-rendered on every change).
document.getElementById("bookmarks-container").addEventListener("click", function (e) {
  var btn = e.target.closest(".bm-hide");
  if (!btn) return;
  var isHidden = btn.dataset.hidden === "true";
  setHidden(btn.dataset.id, !isHidden);
});

// ── Footer year ─────────────────────────────────────────────────────────────
document.getElementById("year").textContent = new Date().getFullYear();
