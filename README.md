# Berry Better Solutions — Personal Profile Site

A personal portfolio website that showcases projects I've built. The entire site is vanilla HTML, CSS, and JavaScript — no build tools, no frameworks, no dependencies at runtime.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [How the Code Works Together](#how-the-code-works-together)
   - [Main Portfolio Page](#main-portfolio-page-indexhtml--stylescsss--scriptjs)
   - [TV Show Tracker](#tv-show-tracker-tvtrackerhtml)
   - [How's Your Day?](#hows-your-day-howsyourdayhtml)
3. [Adding a New Project](#adding-a-new-project)
4. [Running Locally](#running-locally)
5. [Testing](#testing)
6. [Deploying via cPanel](#deploying-via-cpanel)

---

## Project Structure

| File | Purpose |
|------|---------|
| `index.html` | Main portfolio page — hero/about section, projects grid, contact section |
| `styles.css` | All layout, colour, and responsive styles for `index.html` |
| `script.js` | Project data array + functions to render cards and set the footer year |
| `tvtracker.html` | Self-contained TV show tracker app (HTML + CSS + JS in one file) |
| `howsyourday.html` | Self-contained mood-check mini-app (HTML + CSS + JS in one file) |
| `tests/projects.test.js` | Jest tests for project data schema and rendering logic |
| `.cpanel.yml` | Deployment instructions for cPanel Git Version Control |

---

## How the Code Works Together

### Main Portfolio Page (`index.html` + `styles.css` + `script.js`)

These three files form the main portfolio page and are tightly coupled:

```
Browser loads index.html
  │
  ├── <link rel="stylesheet" href="styles.css" />
  │     └── Applies the dark theme, layout, and all component styles
  │           (navbar, hero, project grid, contact section, footer)
  │
  └── <script src="script.js"></script>  (at bottom of <body>)
        │
        ├── projects[]  — array of project objects (data source)
        │
        ├── renderProjects()
        │     • Reads projects[]
        │     • Builds one <article class="project-card"> per entry
        │     • Calls escapeHtml() on every user-visible string (XSS protection)
        │     • Injects the result into <div id="projects-grid"> in index.html
        │
        ├── escapeHtml(str)
        │     • Converts &  <  >  "  ' to safe HTML entities
        │     • Used by renderProjects() to prevent script injection
        │
        ├── setYear()
        │     • Writes new Date().getFullYear() into <span id="year"> in the footer
        │
        └── DOMContentLoaded listener
              • Calls renderProjects() and setYear() once the DOM is ready
```

**Data flow:** The only place you ever edit to add or change a project is the `projects` array in `script.js`. On page load the browser parses `index.html`, applies `styles.css`, then executes `script.js` which dynamically fills in the `#projects-grid` container that is left empty in the HTML.

---

### TV Show Tracker (`tvtracker.html`)

A fully self-contained single-file app. All CSS and JavaScript live inside the file alongside the HTML.

```
tvtracker.html
  │
  ├── <style> … </style>
  │     └── Inlined CSS (same design tokens as styles.css for visual consistency)
  │
  └── <script> … </script>  (IIFE — Immediately Invoked Function Expression)
        │
        ├── localStorage  ─────────────────────── Persistence layer
        │     • STORAGE_KEY = "tvtracker_shows"
        │     • loadShows()  — JSON.parse from localStorage on startup
        │     • saveShows()  — JSON.stringify to localStorage after every change
        │
        ├── State variables
        │     • shows[]       — master array of show objects loaded from storage
        │     • openCards{}   — tracks which show cards are expanded
        │     • openForms{}   — tracks which "Log Episode" forms are open
        │     • pendingRating{} — stores the highlighted star value before submit
        │
        ├── Helper functions
        │     • genId()       — generates a unique ID (timestamp + random suffix)
        │     • nextEpNum()   — returns suggested next episode number for a show
        │     • avgRating()   — calculates mean star rating for rated episodes
        │     • esc()         — HTML-escapes user strings (XSS protection)
        │     • starsHtml()   — builds a read-only ★ display for a given rating
        │     • fmtDate()     — formats a Unix timestamp to a locale date string
        │
        ├── showCardHtml(show)
        │     • Builds the complete HTML string for one collapsible show card
        │       (header, episode list, log-episode form, action buttons)
        │     • Every user-supplied string is passed through esc() before
        │       being inserted into innerHTML
        │
        ├── render()
        │     • Splits shows[] into watching / completed lists
        │     • Updates badge counts in the panel headers
        │     • Calls showCardHtml() for each show and injects into the DOM
        │     • Called after every state mutation
        │
        ├── findShow(id)  — looks up a show object by its ID
        │
        ├── Event delegation (single document click listener)
        │     • Identifies the clicked element with closest() and data-show-id
        │     • Routes to the appropriate action:
        │         toggle card  │  toggle log form  │  cancel form
        │         star select  │  log episode      │  delete episode
        │         mark complete │ move to watching  │  delete show
        │
        ├── Add-show form submit listener
        │     • Creates a new show object with genId(), pushes it to shows[]
        │     • Saves to localStorage, re-renders, scrolls new card into view
        │
        └── Initial render() call — populates the UI from localStorage on load
```

**Data flow:** The `shows` array is the single source of truth. Every user action modifies this array, calls `saveShows()` to persist it, then calls `render()` to rebuild the DOM from the updated state. Nothing in the DOM is mutated directly (except star highlight toggling, which avoids a full re-render to preserve form field values).

---

### How's Your Day? (`howsyourday.html`)

A fully self-contained single-file mini-app.

```
howsyourday.html
  │
  ├── <style> … </style>
  │     └── Inlined CSS (same design tokens as styles.css)
  │
  ├── HTML structure
  │     • .mood-buttons — row of 5 <button> elements, each carrying:
  │         data-emoji  — the emoji to display (e.g. "🤩")
  │         data-label  — the mood label (e.g. "Amazing!")
  │     • #emoji-overlay — full-screen overlay (hidden by default)
  │         #overlay-emoji — large emoji element (animated via @keyframes pop)
  │         #overlay-label — mood label text (animated via @keyframes fadein)
  │
  └── <script> … </script>
        │
        ├── Mood button click listener (forEach on .mood-btn)
        │     1. Reads data-emoji and data-label from the clicked button
        │     2. Clones the #overlay-emoji node to reset the CSS animation
        │        (replacing the node forces the browser to restart @keyframes pop)
        │     3. Sets the cloned node's text to the chosen emoji
        │     4. Sets #overlay-label text to the mood label
        │     5. Adds class "visible" to #emoji-overlay → fades it in
        │     6. Moves focus to the overlay for keyboard/screen-reader users
        │
        ├── Overlay close handlers
        │     • Click anywhere on overlay → removes "visible" class
        │     • Keydown "Escape"          → removes "visible" class
        │
        └── Footer year stamp (same pattern as script.js setYear())
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

Additional tests verify that HTML special characters in project data are escaped (XSS protection), that the card renderer produces the expected output, and that every local demo file is included in the cPanel deployment config.

---

## Deploying via cPanel

This repository includes a `.cpanel.yml` file that enables automatic deployment through cPanel's **Git Version Control** feature.

**Setup (one-time):**
1. Log in to cPanel and open **Git Version Control**.
2. Clone this repository using its GitHub URL.

**Deploying updates:**
- Push commits to the linked branch, then click **Update** followed by **Deploy HEAD Commit** in cPanel, or
- Use the **Deploy HEAD Commit** button at any time to manually trigger a deployment.

Files deployed to `public_html`: `index.html`, `styles.css`, `script.js`, `tvtracker.html`, `howsyourday.html`.

