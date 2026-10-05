# Berry Better Solutions — Personal Profile Site

A personal portfolio website that showcases projects I've built. The entire site is vanilla HTML, CSS, and JavaScript — no build tools, no frameworks, no dependencies at runtime.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [How the Code Works Together](#how-the-code-works-together)
   - [Shared Design System](#shared-design-system-sharedcss)
   - [Main Portfolio Page](#main-portfolio-page-indexhtml--stylescsss--scriptjs)
   - [TV Show Tracker](#tv-show-tracker-experiencestvtrackerindexhtml--stylecss--scriptjs)
   - [Book Challenge](#book-challenge-experiencesbookchallengeindexhtml--stylecss--scriptjs--firebase-configjs)
   - [Code Cracker](#code-cracker-experiencescodecrackerindexhtml--stylecss--scriptjs)
   - [How's Your Day?](#hows-your-day-experienceshowsyourdayindexhtml--stylecss--scriptjs)
3. [Adding a New Project](#adding-a-new-project)
4. [Running Locally](#running-locally)
5. [Testing](#testing)
6. [Deploying to Vercel](#deploying-to-vercel)

---

## Project Structure

| File | Purpose |
|------|---------|
| `shared.css` | Design tokens (CSS variables), reset, base body/link styles, and shared navbar — loaded first by every page |
| `index.html` | Main portfolio page — personal welcome (greeting + quote + clock), experiences grid, and low-priority live feeds |
| `styles.css` | Layout, components, and styles specific to `index.html` and `more.html` |
| `script.js` | Project data arrays + functions to render cards and set the footer year |
| `home.js` | Homepage behaviour — rotating regional greeting, philosopher quote, live clock, and lazy feed snippets from the Firebase experiences |
| `more.html` | Secondary "More Projects" page — smaller builds reached from the main hub |
| `experiences/tvtracker/` | TV show watch-log app (Firebase) — `index.html`, `style.css`, `script.js`, `firebase-config.js` |
| `experiences/bookchallenge/` | Shared reading challenge (Firebase) — `index.html`, `style.css`, `script.js`, `firebase-config.js` |
| `experiences/howsyourday/` | Mood-check mini-app — `index.html`, `style.css`, `script.js` |
| `experiences/codecracker/` | Break-the-code game — `index.html`, `style.css`, `script.js` |
| `tests/projects.test.js` | Jest tests for project data schema and rendering logic |

---

## How the Code Works Together

### Shared Design System (`shared.css`)

`shared.css` is the single source of truth for design tokens and base styles. It is loaded first by **every** HTML page, ensuring a consistent look and feel across the site without duplicating variables.

```
shared.css
  ├── CSS custom properties (:root)
  │     --bg, --surface, --surface2, --border,
  │     --accent, --accent-lt, --text, --text-muted,
  │     --radius, --shadow, --transition
  │
  ├── Reset (*, *::before, *::after box-sizing / margin / padding)
  ├── Base body styles (background, color, font-family, line-height)
  ├── Global link styles (a, a:hover)
  └── Shared navbar layout (.navbar, .nav-logo)
```

Each page then loads its own stylesheet on top of `shared.css` for page-specific layout and components.

---

### Main Portfolio Page (`index.html` + `styles.css` + `script.js` + `home.js`)

The main hub is the landing page: a personal welcome header (rotating regional
greeting, a philosopher quote, and a live clock) above the grid of experience
tiles, with a low-priority strip of live feeds from the Firebase experiences at
the bottom.

```
Browser loads index.html
  │
  ├── <link rel="stylesheet" href="shared.css" />
  │     └── Design tokens, reset, base styles, shared navbar
  │
  ├── <link rel="stylesheet" href="styles.css" />
  │     └── Hub layout: welcome header, experience grid, feed strip,
  │           footer, responsive rules
  │
  ├── <script src="script.js"></script>  (at bottom of <body>)
  │     │
  │     ├── projects[]      — main-hub tiles (data source)
  │     ├── moreProjects[]  — secondary-page tiles (more.html)
  │     │
  │     ├── renderProjects(list, containerId)
  │     │     • Builds one <a class="experience-tile"> per entry
  │     │     • Calls escapeHtml() on every data-driven string (XSS protection)
  │     │     • Injects into #projects-grid (index.html) or
  │     │       #more-projects-grid (more.html)
  │     │
  │     ├── escapeHtml(str)  — &  <  >  "  '  → HTML entities
  │     ├── setYear()        — stamps the current year into <span id="year">
  │     └── DOMContentLoaded — renders both grids and sets the year
  │
  └── <script type="module" src="home.js"></script>
        │
        ├── GREETINGS[] / QUOTES[]  — one of each picked per load
        ├── renderIdentity()        — greeting + quote, drawn once
        ├── renderWelcome()         — date + clock, ticks every second
        └── loadFirestoreFeeds()    — lazily pulls Book Challenge + TV Tracker
              snippets (public reads); skipped silently if a config is a
              placeholder or the network is unavailable
```

**Data flow:** The only place you edit to add or change a project is the
`projects` (or `moreProjects`) array in `script.js`. On load the browser parses
`index.html`, applies `shared.css` then `styles.css`, runs `script.js` to fill
the tile grids, then `home.js` renders the welcome header and loads the feeds.

---

### TV Show Tracker (`experiences/tvtracker/index.html` + `style.css` + `script.js` + `firebase-config.js`)

A single-owner watch tracker backed by **Firebase Firestore**. Anyone can VIEW
the tracker (public read), but adding, editing, or deleting a show requires
signing in with **Google as the owner** — enforced by email in Firestore's
security rules, not just "any authenticated user." One document per show tracks
its status (want to watch / watching / completed), current season+episode, a
per-episode watch-history log, an overall show rating, and notes.

```
Browser loads index.html
  │
  ├── <link rel="stylesheet" href="../../shared.css" />
  │     └── Design tokens, reset, base styles, shared navbar
  │
  ├── <link rel="stylesheet" href="style.css" />
  │     └── App tokens, form/filter layout, card grids, responsive rules
  │
  └── <script type="module" src="script.js"></script>
        │
        ├── Firebase init (from firebase-config.js)
        │     • initializeApp(), getFirestore(), getAuth()
        │
        ├── Auth (Google)
        │     • onAuthStateChanged → sets isOwner, re-renders owner controls
        │     • sign-in / sign-out buttons
        │
        ├── Firestore "shows" collection
        │     • onSnapshot(query(..., orderBy("updatedAt","desc"))) → live shows[]
        │     • one doc per show: { title, status, season, episode,
        │       episodeLog[], showRating, notes, updatedAt }
        │
        ├── Episode log helpers
        │     • withLoggedEpisode() / averageEpisodeRating() — per-episode
        │       entries, each independently ratable
        │
        ├── Rendering
        │     • renderAll() → renderWatching() / renderToWatch() / renderCompleted()
        │
        └── Owner writes (addDoc / updateDoc / deleteDoc)
              • Allowed only for the owner; a non-owner account gets a
                permission-denied error straight from Firestore's rules
```

---

### Book Challenge (`experiences/bookchallenge/index.html` + `style.css` + `script.js` + `firebase-config.js`)

A shared, cross-device reading challenge backed by **Firebase Firestore**. Every
browser gets a silent **anonymous** auth session (no login UI); that session's
uid tags anything it creates, which the security rules use to allow deleting
only your own entries. The data is publicly readable — it's a shared scoreboard.

```
Browser loads index.html
  │
  ├── shared.css + style.css
  │
  └── <script type="module" src="script.js"></script>
        │
        ├── Firebase init (+ optional App Check / reCAPTCHA v3)
        ├── signInAnonymously() → silent session, uid tags created docs
        │
        ├── Firestore collections (both live via onSnapshot)
        │     • "readers" — { name, goalBooks, creatorUid }
        │     • "entries" — { readerName, title, pages, loggedAt, creatorUid }
        │
        ├── Scoring
        │     • computeBaseline() — community average pages/book
        │     • bookCredit() — a book's weight relative to that baseline
        │
        └── renderAll() → scoreboard, readers table, log table
```

---

### Code Cracker (`experiences/codecracker/index.html` + `style.css` + `script.js`)

A self-contained break-the-code game — no backend, no storage. Guess a 4-peg
secret colour code in 7 attempts, with green/yellow feedback after each guess.

```
Browser loads index.html
  │
  ├── shared.css + style.css
  │
  └── <script src="script.js"></script>
        │
        ├── generateCode() — random 4-peg secret from 6 colours
        ├── guess/feedback loop — green = right colour+spot, yellow = right
        │     colour wrong spot; 7 attempts max
        ├── endGame(won) — win/lose message + revealSecret()
        └── newGame() — resets the board
```

---

### How's Your Day? (`experiences/howsyourday/index.html` + `style.css` + `script.js`)

```
Browser loads experiences/howsyourday/index.html
  │
  ├── <link rel="stylesheet" href="../../shared.css" />
  │     └── Design tokens, reset, base styles, shared navbar
  │
  ├── <link rel="stylesheet" href="style.css" />
  │     └── Layout (flex column body), mood buttons, emoji overlay,
  │           animations (@keyframes pop, fadein), footer
  │
  └── <script src="script.js"></script>
        │
        ├── Mood button click listener (forEach on .mood-btn)
        │     1. Reads data-emoji and data-label from the clicked button
        │     2. Clones the #overlay-emoji node to restart the CSS animation
        │     3. Updates overlay content and adds class "visible"
        │     4. Moves focus to the overlay for keyboard/screen-reader users
        │
        ├── Overlay close handlers
        │     • Click anywhere on overlay → removes "visible" class
        │     • Keydown "Escape"          → removes "visible" class
        │
        └── Footer year stamp
```

---

## Adding a New Project

Open `script.js` and add an object to the `projects` array:

```js
{
  title: "My Project",
  icon:  "🚀",
  desc:  "Short description of what this project does.",
  tags:  ["Python", "FastAPI"],
  github: "https://github.com/dcbgi/my-project",  // optional
  demo:   "https://my-project.example.com",         // optional
}
```

Save the file — the card appears automatically on the page. No HTML changes are needed.

---

## Running Locally

Open `index.html` directly in a browser, or serve with any static file server:

```bash
npx serve .
```

---

## Testing

Tests live in `tests/` and use [Jest](https://jestjs.io/) with the jsdom environment.

| Test file | What it covers |
|-----------|----------------|
| `tests/projects.test.js` | Project data schema, `escapeHtml`, card rendering, XSS protection, deployment config |

```bash
npm install   # first time only
npm test
```

Each project in the `projects` array is checked to ensure it:
- Has required non-empty string fields: `title`, `icon`, `desc`
- Has `tags` as an array of non-empty strings
- Uses a valid HTTPS URL for the optional `github` field
- Uses a valid HTTPS URL or non-empty relative path for the optional `demo` field

Additional tests verify that HTML special characters in project data are escaped (XSS protection) and that the card renderer produces the expected output.

---

## Deploying to Vercel

This is a static site with no build step, so Vercel can deploy it as-is.

**Setup (one-time):**
1. Import this repository into [Vercel](https://vercel.com/new).
2. Leave the Framework Preset as **Other** and the build command empty — Vercel serves the repo's static files directly.

**Deploying updates:**
- Push commits to `main` — Vercel automatically builds and deploys on every push, with preview deployments for pull requests.

