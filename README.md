# Berry Better Solutions — Personal Profile Site

A personal portfolio website that showcases projects I've built. The entire site is vanilla HTML, CSS, and JavaScript — no build tools, no frameworks, no dependencies at runtime.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [How the Code Works Together](#how-the-code-works-together)
   - [Shared Design System](#shared-design-system-sharedcss)
   - [Main Portfolio Page](#main-portfolio-page-indexhtml--stylescsss--scriptjs)
   - [TV Show Tracker](#tv-show-tracker-tvtrackerhtml--tvtrackercss--tvtrackerjs)
   - [How's Your Day?](#hows-your-day-howsyourdayhtml--howsyourdaycss--howsyourdayjs)
3. [Adding a New Project](#adding-a-new-project)
4. [Running Locally](#running-locally)
5. [Testing](#testing)
6. [Deploying to Vercel](#deploying-to-vercel)

---

## Project Structure

| File | Purpose |
|------|---------|
| `shared.css` | Design tokens (CSS variables), reset, base body/link styles, and shared navbar — loaded first by every page |
| `index.html` | Main portfolio page — hero/about section, projects grid, contact section |
| `styles.css` | Layout, components, and styles specific to `index.html` |
| `script.js` | Project data array + functions to render cards and set the footer year |
| `tvtracker.html` | TV show tracker app |
| `tvtracker.css` | Page-specific styles for `tvtracker.html` (app tokens, layout, components) |
| `tvtracker.js` | TV show tracker logic (localStorage, rendering, event handling) |
| `howsyourday.html` | Mood-check mini-app |
| `howsyourday.css` | Page-specific styles for `howsyourday.html` (mood buttons, overlay, animations) |
| `howsyourday.js` | Mood-check logic (mood button clicks, overlay show/hide, keyboard handling) |
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

### Main Portfolio Page (`index.html` + `styles.css` + `script.js`)

These three files form the main portfolio page and are tightly coupled:

```
Browser loads index.html
  │
  ├── <link rel="stylesheet" href="shared.css" />
  │     └── Design tokens, reset, base styles, shared navbar
  │
  ├── <link rel="stylesheet" href="styles.css" />
  │     └── Main-page layout and components
  │           (hero, project grid, contact section, footer, responsive rules)
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

**Data flow:** The only place you ever edit to add or change a project is the `projects` array in `script.js`. On page load the browser parses `index.html`, applies `shared.css` then `styles.css`, then executes `script.js` which dynamically fills in the `#projects-grid` container that is left empty in the HTML.

---

### TV Show Tracker (`tvtracker.html` + `tvtracker.css` + `tvtracker.js`)

```
Browser loads tvtracker.html
  │
  ├── <link rel="stylesheet" href="shared.css" />
  │     └── Design tokens, reset, base styles, shared navbar
  │
  ├── <link rel="stylesheet" href="tvtracker.css" />
  │     └── App-specific tokens (--danger, --success, --star), layout,
  │           panels, buttons, show cards, episode list, star rating, footer
  │
  └── <script src="tvtracker.js"></script>  (IIFE — Immediately Invoked Function Expression)
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
        │     • Every user-supplied string is passed through esc() before innerHTML
        │
        ├── render()
        │     • Splits shows[] into watching / completed lists
        │     • Updates badge counts and re-renders card lists
        │     • Called after every state mutation
        │
        ├── Event delegation (single document click listener)
        │     • Identifies the clicked element with closest() and data-show-id
        │     • Routes to: toggle card │ toggle log form │ star select │
        │                  log episode │ delete episode │ mark complete │
        │                  move to watching │ delete show
        │
        ├── Add-show form submit listener
        │     • Creates a new show object, saves, re-renders, scrolls card into view
        │
        └── Initial render() call — populates the UI from localStorage on load
```

---

### How's Your Day? (`howsyourday.html` + `howsyourday.css` + `howsyourday.js`)

```
Browser loads howsyourday.html
  │
  ├── <link rel="stylesheet" href="shared.css" />
  │     └── Design tokens, reset, base styles, shared navbar
  │
  ├── <link rel="stylesheet" href="howsyourday.css" />
  │     └── Layout (flex column body), mood buttons, emoji overlay,
  │           animations (@keyframes pop, fadein), footer
  │
  └── <script src="howsyourday.js"></script>
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

