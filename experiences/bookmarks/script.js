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
// PRIVATE OWNER IMPORT: the owner clicks "Import bookmarks" and picks a file
// from their own computer — either a browser bookmarks export (.html, the
// Netscape format every browser produces) or a .json array of
// { title, url, category }. The file is read and parsed IN THE BROWSER and the
// links are written to the owner's private Firestore list. The file never
// touches the repo or the server, so nothing is ever exposed — and because it's
// a local file picker, this works on the live site with no localhost needed.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, doc, increment,
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
    // Owner-only file import: the button opens a file picker; selecting a file
    // parses it in-browser and writes to Firestore (see handleImportFile).
    document.getElementById("import-mine-btn").addEventListener("click", function () {
      document.getElementById("import-file").click();
    });
    document.getElementById("import-file").addEventListener("change", handleImportFile);
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

// ── File import (owner only) ─────────────────────────────────────────────────
// Reads a user-picked file entirely in the browser. Accepts either a JSON array
// of { title, url, category } or a browser bookmarks HTML export (Netscape
// format). Parsed links are written to the owner's private Firestore list,
// de-duplicated by URL so re-importing never creates duplicates.
function handleImportFile(e) {
  var file = e.target.files && e.target.files[0];
  e.target.value = ""; // reset so picking the same file again re-fires change
  if (!file || !currentUid || !isOwner()) return;

  var reader = new FileReader();
  reader.onload = function () {
    var text = String(reader.result || "");
    var items = [];

    // Try JSON first; if it isn't valid JSON, parse it as bookmarks HTML.
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) items = parsed;
    } catch (err) { /* not JSON — fall through to HTML */ }
    if (items.length === 0) items = parseBookmarksHTML(text);

    // Keep only real web links (drops file://, javascript:, empty, etc.).
    items = items.filter(function (b) { return b && b.url && /^https?:\/\//i.test(b.url); });

    if (items.length === 0) {
      showBanner("No importable web links found in that file.", "warn");
      return;
    }
    showBanner("Importing " + items.length + " bookmarks…", "info");
    writeBookmarks(currentUid, items).then(function (n) {
      showBanner(
        n > 0
          ? "✅ Imported " + n + " new bookmark" + (n === 1 ? "" : "s") + " into your private list."
          : "Nothing new to import — those links are already saved.",
        "info"
      );
    }).catch(function (err) {
      showBanner("⚠️ Import failed: " + err.message, "error");
    });
  };
  reader.onerror = function () { showBanner("⚠️ Couldn't read that file.", "error"); };
  reader.readAsText(file);
}

// Parses a Netscape bookmarks HTML export into [{ title, url, category }].
// Folder names (<H3>) become categories; links directly under the root fall
// back to "Imported". Obvious throwaway search-result URLs are skipped.
function parseBookmarksHTML(text) {
  var out = [];
  var docp;
  try { docp = new DOMParser().parseFromString(text, "text/html"); }
  catch (e) { return out; }

  var SKIP = /[?&](?:q|search)=|\/search\?/i; // search-result links = noise

  function walk(dl, category) {
    for (var dt = dl.firstElementChild; dt; dt = dt.nextElementSibling) {
      if (dt.tagName !== "DT") continue;
      var h3 = dt.querySelector(":scope > h3");
      var a  = dt.querySelector(":scope > a");
      if (a) {
        var href = a.getAttribute("href") || "";
        if (/^https?:\/\//i.test(href) && !SKIP.test(href)) {
          out.push({
            title: (a.textContent || href).trim() || href,
            url: href,
            category: category,
          });
        }
      }
      if (h3) {
        var folder = (h3.textContent || "").trim() || category;
        // The folder's contents are in a nested <DL> (inside the DT per HTML
        // parsing, or occasionally the DT's next sibling).
        var sub = dt.querySelector(":scope > dl");
        if (!sub && dt.nextElementSibling && dt.nextElementSibling.tagName === "DL") {
          sub = dt.nextElementSibling;
        }
        if (sub) walk(sub, folder);
      }
    }
  }

  var root = docp.querySelector("dl");
  if (root) walk(root, "Imported");
  return out;
}

// Writes items into the signed-in owner's list, skipping any URL that already
// exists (in Firestore or earlier in the same file). Commits in chunks to stay
// under Firestore's 500-writes-per-batch limit. Resolves to the number added.
function writeBookmarks(uid, items) {
  var existing = {};
  bookmarks.forEach(function (b) { if (b.url) existing[String(b.url).trim()] = true; });

  var seen = {};
  var fresh = [];
  items.forEach(function (b) {
    var url = String(b.url || "").trim();
    if (!url || existing[url] || seen[url]) return;
    seen[url] = true;
    fresh.push({
      title: String(b.title || url).trim() || url,
      url: url,
      category: String(b.category || "Imported").trim() || "Imported",
      group: b.group ? String(b.group).trim() : "",  // optional top-level bucket
    });
  });
  if (fresh.length === 0) return Promise.resolve(0);

  var i = 0;
  function commitChunk() {
    if (i >= fresh.length) return Promise.resolve(fresh.length);
    var batch = writeBatch(db);
    var end = Math.min(i + 400, fresh.length);
    for (; i < end; i++) {
      var b = fresh[i];
      var ref = doc(collection(db, "bookmarks"));
      batch.set(ref, {
        title: b.title,
        url: b.url,
        category: b.category,
        group: b.group || "",
        ownerUid: uid,
        // The list query sorts by createdAt DESC, so earlier items in the file
        // need LARGER timestamps to appear first — preserving the file's order.
        createdAt: Date.now() - i,
      });
    }
    return batch.commit().then(commitChunk);
  }
  return commitChunk();
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
// Supports an optional two-level hierarchy: a bookmark's `group` is the
// top-level bucket (e.g. "Projects") and `category` is the sub-bucket (e.g.
// "Programming"). Bookmarks with no `group` render as flat top-level
// categories, so form-added and browser-imported links still work. The hide
// button lives on each card, so hiding works at any nesting depth.

// Orders group keys by total clicks across the bookmarks they contain (most
// first). Ties are broken alphabetically. "Welcome" is pinned to the top when
// present. `clicksOf(key)` returns the summed click count for a given key.
function orderByClicks(keys, clicksOf) {
  return keys.slice().sort(function (a, b) {
    if (a === "Welcome") return -1;
    if (b === "Welcome") return 1;
    var d = clicksOf(b) - clicksOf(a);   // more clicks first
    return d !== 0 ? d : a.localeCompare(b);
  });
}

// A single bookmark's click count (missing/old docs count as 0).
function clicksOfBookmark(b) { return (b && b.clicks) || 0; }
// Sum of clicks across a list of bookmarks.
function sumClicks(list) {
  return list.reduce(function (t, b) { return t + clicksOfBookmark(b); }, 0);
}

// ── Favorites ("Most Used") ──────────────────────────────────────────────────
// A pinned section at the very top that mirrors your most-clicked bookmarks, so
// your daily drivers are one glance away. The same bookmarks ALSO still appear
// in their normal group/category below — this is an additional shortcut view,
// not a move. Only links with at least one click qualify, capped at FAV_LIMIT.
// Unlike other groups it defaults to OPEN (stored separately so the generic
// "removed = closed" convention doesn't force it back open after you close it).
var FAV_KEY = "\u2b50 Most Used";
var FAV_LIMIT = 8;
function favIsOpen() {
  var v;
  try { v = localStorage.getItem(groupStorageKey(FAV_KEY)); } catch (e) { v = null; }
  return v === null ? true : v === "1";   // default open
}
function setFavOpen(open) {
  try { localStorage.setItem(groupStorageKey(FAV_KEY), open ? "1" : "0"); }
  catch (e) { /* ignore storage errors */ }
}

// Collapsible group open/closed state, remembered per group in localStorage so
// it persists across reloads. Default is CLOSED; opening a group remembers it
// until you close it again (that's the "unless I set it otherwise" behaviour).
function groupStorageKey(key) { return "bm_open_" + key; }
function isGroupOpen(key) {
  try { return localStorage.getItem(groupStorageKey(key)) === "1"; }
  catch (e) { return false; }
}
function setGroupOpen(key, open) {
  try {
    if (open) localStorage.setItem(groupStorageKey(key), "1");
    else localStorage.removeItem(groupStorageKey(key));
  } catch (e) { /* ignore storage errors */ }
}

// Builds the HTML for a single bookmark card.
function cardHtml(b) {
  var href = safeHref(b.url);
  var host = hostLabel(b.url);
  var isHidden = !!b.hidden;
  return (
    '<div class="bm-card' + (isHidden ? ' bm-card-hidden' : '') + '" data-id="' + esc(b.id) + '">' +
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
}

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

  // Build a two-level tree:
  //   tree[top] = { direct: [cards], subs: { subName: [cards] }, clicks }
  // A bookmark with a `group` goes under group → category; one without a group
  // goes directly under its category (a flat top-level section). `clicks` is
  // the running total used to order groups by popularity.
  var tree = {};
  function topNode(name) {
    if (!tree[name]) tree[name] = { direct: [], subs: {}, count: 0, clicks: 0 };
    return tree[name];
  }
  filtered.forEach(function (b) {
    var cat = b.category || "Uncategorized";
    if (b.group) {
      var node = topNode(b.group);
      (node.subs[cat] = node.subs[cat] || []).push(b);
      node.count++;
      node.clicks += clicksOfBookmark(b);
    } else {
      var node2 = topNode(cat);
      node2.direct.push(b);
      node2.count++;
      node2.clicks += clicksOfBookmark(b);
    }
  });

  // Sort each bucket's cards by clicks (most-clicked first) so the links you use
  // most float to the top within their category.
  function byClicksDesc(a, b) { return clicksOfBookmark(b) - clicksOfBookmark(a); }
  Object.keys(tree).forEach(function (t) {
    tree[t].direct.sort(byClicksDesc);
    Object.keys(tree[t].subs).forEach(function (s) { tree[t].subs[s].sort(byClicksDesc); });
  });

  // When a search is active, force every group open so matches are visible.
  var searching = !!searchTerm;

  // ⭐ Most Used: mirror the top-clicked bookmarks in a pinned section at the
  // top. Hidden off during search (the group list already surfaces matches).
  var favHtml = "";
  if (!searching) {
    var favs = filtered
      .filter(function (b) { return clicksOfBookmark(b) > 0; })
      .slice()
      .sort(byClicksDesc)
      .slice(0, FAV_LIMIT);
    if (favs.length) {
      favHtml =
        '<details class="bm-group bm-favorites" data-key="' + esc(FAV_KEY) + '"' + (favIsOpen() ? ' open' : '') + '>' +
          '<summary class="bm-group-title">' + esc(FAV_KEY) +
            ' <span class="bm-group-count">' + favs.length + '</span></summary>' +
          '<div class="bm-grid">' + favs.map(cardHtml).join("") + '</div>' +
        '</details>';
    }
  }

  var groupsHtml = orderByClicks(Object.keys(tree), function (k) { return tree[k].clicks; }).map(function (top) {
    var node = tree[top];
    var inner = "";

    // Direct cards (flat categories, or loose items under a group) first.
    if (node.direct.length) {
      inner += '<div class="bm-grid">' + node.direct.map(cardHtml).join("") + '</div>';
    }
    // Then each sub-category as its own collapsible block, most-clicked first.
    orderByClicks(Object.keys(node.subs), function (k) { return sumClicks(node.subs[k]); }).forEach(function (sub) {
      var subCards = node.subs[sub];
      var subKey = top + "\u241f" + sub;              // unit-separator avoids clashes
      var subOpen = searching || isGroupOpen(subKey);
      inner +=
        '<details class="bm-subgroup" data-key="' + esc(subKey) + '"' + (subOpen ? ' open' : '') + '>' +
          '<summary class="bm-subgroup-title">' + esc(sub) +
            ' <span class="bm-group-count">' + subCards.length + '</span></summary>' +
          '<div class="bm-grid">' + subCards.map(cardHtml).join("") + '</div>' +
        '</details>';
    });

    var topOpen = searching || isGroupOpen(top);
    return (
      '<details class="bm-group" data-key="' + esc(top) + '"' + (topOpen ? ' open' : '') + '>' +
        '<summary class="bm-group-title">' + esc(top) +
          ' <span class="bm-group-count">' + node.count + '</span></summary>' +
        inner +
      '</details>'
    );
  }).join("");

  container.innerHTML = favHtml + groupsHtml;
}

// Persist expand/collapse. The `toggle` event doesn't bubble, so listen in the
// capture phase. Skip saving while a search is active (groups are force-opened
// then, and we don't want that to overwrite the user's saved preferences).
document.getElementById("bookmarks-container").addEventListener("toggle", function (e) {
  var d = e.target;
  if (!d || !d.matches || !d.matches("details[data-key]")) return;
  if (searchTerm) return;
  // The Favorites section tracks its own open state (default open), so persist
  // it explicitly rather than via the generic "removed = closed" convention.
  if (d.getAttribute("data-key") === FAV_KEY) { setFavOpen(d.open); return; }
  setGroupOpen(d.getAttribute("data-key"), d.open);
}, true);

// Hide / unhide via event delegation (cards are re-rendered on every change).
document.getElementById("bookmarks-container").addEventListener("click", function (e) {
  var btn = e.target.closest(".bm-hide");
  if (!btn) return;
  var isHidden = btn.dataset.hidden === "true";
  setHidden(btn.dataset.id, !isHidden);
});

// Count a click when a bookmark link is opened, so popularity ordering can
// float your most-used links up. Links open in a new tab (target="_blank"), so
// this page stays alive to finish the async Firestore update. Uses an atomic
// increment so concurrent opens across devices don't clobber each other.
document.getElementById("bookmarks-container").addEventListener("click", function (e) {
  var link = e.target.closest(".bm-link");
  if (!link) return;
  var card = link.closest(".bm-card");
  var id = card && card.getAttribute("data-id");
  if (!id || !db) return;
  updateDoc(doc(db, "bookmarks", id), { clicks: increment(1) })
    .catch(function () { /* a failed click tally should never block navigation */ });
});

// ── Footer year ─────────────────────────────────────────────────────────────
document.getElementById("year").textContent = new Date().getFullYear();
