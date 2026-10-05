// ── home.js ──────────────────────────────────────────────────────────────────
// Personal homepage behaviour, layered on top of script.js (which renders the
// experience tiles). Three jobs:
//   1. A time-aware greeting + a live date/clock in the welcome header.
//   2. Low-priority "feed" snippets from the other experiences. These are a
//      nice-to-have glance, NOT the focus of the page (Bookmarks is), so every
//      feed fails quietly: if a source is unconfigured or empty, its card just
//      shows a gentle fallback instead of an error.
//
// Data sources (each matches how that experience itself stores data):
//   • How's Your Day?  → localStorage "hyd_last_mood"      (written by its page)
//   • Code Cracker     → localStorage "codecracker_last"   (written by its page)
//   • Book Challenge   → Firestore "entries"   (public read)
//   • TV Tracker       → Firestore "shows"      (public read)
// The two Firebase feeds load lazily and only if that experience's config is
// present; otherwise their cards keep their default text.

// ── Greeting + quote ─────────────────────────────────────────────────────────
// The big line is a regional US greeting (East-Coast-weighted city slang); the
// line under it is a short philosophical quote on existence / perseverance.
// Both are picked once per page load (the clock below ticks independently).
//
// GREETINGS: { text, region } — region is shown small next to the greeting.
// Edit/extend freely; weighting is just "add more of what you want to see".
const GREETINGS = [
  { text: "Yerr",                 region: "NYC" },
  { text: "What's good",          region: "NYC" },
  { text: "Ayo",                  region: "NYC" },
  { text: "How you doin'",        region: "Jersey" },
  { text: "Yo",                   region: "Philly" },
  { text: "What's good, bul",     region: "Philly" },
  { text: "What up doe",          region: "Detroit" },
  { text: "What's good, moe",     region: "DC" },
  { text: "Aye, yo",              region: "Baltimore" },
  { text: "Where y'at",           region: "New Orleans" },
  { text: "How ah ya",            region: "Boston" },
  { text: "What's poppin'",       region: "Atlanta" },
  { text: "What it do",           region: "Houston" },
  { text: "Howdy",                region: "Texas" },
  { text: "Hey y'all",            region: "The South" },
  { text: "What's crackin'",      region: "LA" },
];

// QUOTES: { text, author } — short, non-cheesy, from actual philosophers,
// centered on existentialism and perseverance/stoicism.
const QUOTES = [
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Waste no more time arguing what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "Man is condemned to be free.", author: "Jean-Paul Sartre" },
  { text: "Existence precedes essence.", author: "Jean-Paul Sartre" },
  { text: "Real generosity toward the future lies in giving all to the present.", author: "Albert Camus" },
  { text: "In the midst of winter, I found there was, within me, an invincible summer.", author: "Albert Camus" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "Become who you are.", author: "Friedrich Nietzsche" },
  { text: "Life can only be understood backwards; but it must be lived forwards.", author: "Søren Kierkegaard" },
  { text: "Anxiety is the dizziness of freedom.", author: "Søren Kierkegaard" },
  { text: "To dare is to lose one's footing momentarily; not to dare is to lose oneself.", author: "Søren Kierkegaard" },
  { text: "He who fears he shall suffer, already suffers what he fears.", author: "Michel de Montaigne" },
  { text: "The unexamined life is not worth living.", author: "Socrates" },
  { text: "Confine yourself to the present.", author: "Marcus Aurelius" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius" },
  { text: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", author: "Marcus Aurelius" },
  { text: "Choose not to be harmed, and you won't feel harmed.", author: "Marcus Aurelius" },
  { text: "The soul becomes dyed with the color of its thoughts.", author: "Marcus Aurelius" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "It is not that we have a short time to live, but that we waste much of it.", author: "Seneca" },
  { text: "He suffers more than necessary who suffers before it is necessary.", author: "Seneca" },
  { text: "As is a tale, so is life: not how long it is, but how good it is, matters.", author: "Seneca" },
  { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },
  { text: "It is not the man who has too little, but the man who craves more, that is poor.", author: "Seneca" },
  { text: "First say to yourself what you would be; then do what you have to do.", author: "Epictetus" },
  { text: "It's not what happens to you, but how you react to it that matters.", author: "Epictetus" },
  { text: "Make the best use of what is in your power, and take the rest as it happens.", author: "Epictetus" },
  { text: "No great thing is created suddenly.", author: "Epictetus" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
  { text: "He who laughs at himself never runs out of things to laugh at.", author: "Epictetus" },
  { text: "That which does not kill us makes us stronger.", author: "Friedrich Nietzsche" },
  { text: "No price is too high to pay for the privilege of owning yourself.", author: "Friedrich Nietzsche" },
  { text: "The snake which cannot cast its skin has to die.", author: "Friedrich Nietzsche" },
  { text: "To live is to suffer; to survive is to find some meaning in the suffering.", author: "Friedrich Nietzsche" },
  { text: "What is done out of love always takes place beyond good and evil.", author: "Friedrich Nietzsche" },
  { text: "Freedom is what you do with what's been done to you.", author: "Jean-Paul Sartre" },
  { text: "We are our choices.", author: "Jean-Paul Sartre" },
  { text: "Life begins on the other side of despair.", author: "Jean-Paul Sartre" },
  { text: "Commitment is an act, not a word.", author: "Jean-Paul Sartre" },
  { text: "In the depth of winter, I finally learned that there lay in me an invincible calm.", author: "Albert Camus" },
  { text: "To live is to keep the absurd alive.", author: "Albert Camus" },
  { text: "The only way to deal with an unfree world is to become so absolutely free that your existence is an act of rebellion.", author: "Albert Camus" },
  { text: "Patience and time do more than strength or passion.", author: "Jean de La Fontaine" },
  { text: "Face the facts of being what you are, for that is what changes what you are.", author: "Søren Kierkegaard" },
  { text: "To venture causes anxiety, but not to venture is to lose oneself.", author: "Søren Kierkegaard" },
  { text: "Boredom is the root of all evil — the despairing refusal to be oneself.", author: "Søren Kierkegaard" },
  { text: "Happiness is not an ideal of reason, but of imagination.", author: "Immanuel Kant" },
  { text: "Science is organized knowledge. Wisdom is organized life.", author: "Immanuel Kant" },
  { text: "He who cannot obey himself will be commanded.", author: "Friedrich Nietzsche" },
  { text: "Where there is power, there is resistance.", author: "Michel Foucault" },
  { text: "Freedom is secured not by the fulfilling of desires, but by the removal of desire.", author: "Epictetus" },
  { text: "What we achieve inwardly will change outer reality.", author: "Plutarch" },
  { text: "The whole future lies in uncertainty: live immediately.", author: "Seneca" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "Patience is bitter, but its fruit is sweet.", author: "Aristotle" },
  { text: "We are what we repeatedly do; excellence, then, is a habit.", author: "Aristotle" },
  { text: "The greatest remedy for anger is delay.", author: "Seneca" },
  { text: "Nothing is enough for the man to whom enough is too little.", author: "Epicurus" },
  { text: "He who is not contented with what he has, would not be contented with what he would like to have.", author: "Socrates" },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Chosen once per load so they stay put while the clock ticks every second.
let greeting = GREETINGS[0];
let quote = QUOTES[0];

// Renders the greeting + quote once (not on every clock tick).
function renderIdentity() {
  const greetEl = document.getElementById("welcome-greeting");
  if (greetEl) {
    greetEl.innerHTML =
      esc(greeting.text) +
      ' <span class="greet-region">' + esc(greeting.region) + "</span>";
  }
  const quoteEl = document.getElementById("welcome-quote");
  if (quoteEl) {
    quoteEl.innerHTML =
      "“" + esc(quote.text) + "” " +
      '<span class="quote-author">— ' + esc(quote.author) + "</span>";
  }
}

// The clock + date update every second; greeting/quote are rendered separately.
function renderWelcome() {
  const now = new Date();

  const dateEl = document.getElementById("welcome-date");
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  const clockEl = document.getElementById("welcome-clock");
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString(undefined, {
      hour: "numeric", minute: "2-digit", second: "2-digit",
    });
  }
}

// ── Feed helpers ─────────────────────────────────────────────────────────────
// Small helpers for writing a snippet into a feed card and escaping user text.
function setFeed(name, html) {
  const el = document.querySelector('[data-feed="' + name + '"]');
  if (el) el.innerHTML = html;
}

function esc(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

// ── Firestore feeds (Book Challenge, TV Tracker) ─────────────────────────────
// Loaded lazily so the homepage never blocks on the network, and skipped
// silently if that experience's firebase-config.js is still a placeholder.
async function loadFirestoreFeeds() {
  let appMod, fsMod;
  try {
    appMod = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    fsMod  = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
  } catch (e) {
    return; // offline or CDN blocked — feeds keep their defaults
  }

  // Book Challenge scoreboard snippet.
  try {
    const { firebaseConfig } = await import("./experiences/bookchallenge/firebase-config.js");
    if (!isPlaceholder(firebaseConfig)) {
      const app = appMod.initializeApp(firebaseConfig, "feed-books");
      const db = fsMod.getFirestore(app);
      const snap = await fsMod.getDocs(fsMod.collection(db, "entries"));
      const entries = snap.docs.map((d) => d.data());
      renderBooksFeed(entries);
    }
  } catch (e) { /* keep default */ }

  // TV Tracker recent-logs snippet.
  try {
    const { firebaseConfig } = await import("./experiences/tvtracker/firebase-config.js");
    if (!isPlaceholder(firebaseConfig)) {
      const app = appMod.initializeApp(firebaseConfig, "feed-tv");
      const db = fsMod.getFirestore(app);
      const q = fsMod.query(
        fsMod.collection(db, "shows"),
        fsMod.orderBy("updatedAt", "desc"),
        fsMod.limit(3)
      );
      const snap = await fsMod.getDocs(q);
      renderTvFeed(snap.docs.map((d) => d.data()));
    }
  } catch (e) { /* keep default */ }
}

function isPlaceholder(cfg) {
  return Object.keys(cfg).some((k) => String(cfg[k]).indexOf("REPLACE_WITH_YOUR") === 0);
}

function renderBooksFeed(entries) {
  if (!entries || entries.length === 0) {
    setFeed("books", "No books logged yet — start the challenge.");
    return;
  }
  // Tally books per reader and show the current leader.
  const counts = {};
  entries.forEach((e) => {
    const name = e.readerName || "Someone";
    counts[name] = (counts[name] || 0) + 1;
  });
  const leader = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  setFeed("books",
    '<strong>' + esc(leader) + '</strong> leads with ' +
    '<strong>' + counts[leader] + '</strong> book' + (counts[leader] === 1 ? "" : "s") +
    '<span class="feed-meta">' + entries.length + ' logged in total</span>');
}

function renderTvFeed(shows) {
  if (!shows || shows.length === 0) {
    setFeed("tv", "No shows tracked yet.");
    return;
  }
  const items = shows.slice(0, 3).map((s) => {
    const where = s.status === "watching" && s.season
      ? ' <span class="feed-meta-inline">S' + esc(s.season) + '·E' + esc(s.episode) + '</span>'
      : "";
    return '<li>' + esc(s.title || "Untitled") + where + '</li>';
  }).join("");
  setFeed("tv", '<ul class="feed-list">' + items + '</ul>');
}

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  greeting = pick(GREETINGS);
  quote = pick(QUOTES);
  renderIdentity();          // greeting + quote, once
  renderWelcome();           // date + clock, now
  setInterval(renderWelcome, 1000); // live-ticking clock

  loadFirestoreFeeds();
});

// ── Test exports (Node / Jest only) ──────────────────────────────────────────
// When this file is require()'d by Jest (CommonJS), expose the data arrays so
// tests can validate them. The typeof guard is false in the browser's ES-module
// context (where `module` is undefined), so this is a no-op at runtime.
if (typeof module !== "undefined") {
  module.exports = { GREETINGS, QUOTES };
}
