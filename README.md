# Berry Better Solutions — Personal Profile Site

A personal portfolio website that showcases projects I've built. The entire site is vanilla HTML, CSS, and JavaScript — no build tools, no frameworks, no dependencies at runtime.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [How the Code Works Together](#how-the-code-works-together)
   - [Shared Design System](#shared-design-system-sharedcss)
   - [Main Portfolio Page](#main-portfolio-page-indexhtml--stylescsss--scriptjs)
   - [TV Show Tracker](#tv-show-tracker-experiencestvtrackerindexhtml--stylecss--scriptjs)
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
| `experiences/tvtracker/index.html` | TV show watch-log app |
| `experiences/tvtracker/style.css` | Page-specific styles (form/filter layout, table, mobile card view) |
| `experiences/tvtracker/script.js` | Watch-log logic (localStorage, filtering, table rendering) |
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

### TV Show Tracker (`experiences/tvtracker/index.html` + `style.css` + `script.js`)

A shared watch-log: anyone using the browser logs a row (username, show,
season, episode, optional notes, optional star rating) and the table below
is filterable by every column — e.g. pick one username to see everything
they've logged, or a username **and** a show to narrow to just that pairing.
Each row can also be marked "Completed" — this applies to the whole
username+show pairing (not just that one episode), since every row sharing
that pairing should agree on whether the show's been finished.

```
Browser loads index.html
  │
  ├── <link rel="stylesheet" href="../../shared.css" />
  │     └── Design tokens, reset, base styles, shared navbar
  │
  ├── <link rel="stylesheet" href="style.css" />
  │     └── App-specific tokens (--danger, --success, --star), form/filter
  │           layout, table styling, and a table→stacked-card layout under 640px
  │
  └── <script src="script.js"></script>  (IIFE — Immediately Invoked Function Expression)
        │
        ├── localStorage  ─────────────────────── Persistence layer (two keys)
        │     • STORAGE_KEY        = "tvtracker_records"    — the log rows
        │     • STORAGE_KEY_STATUS = "tvtracker_show_status" — completed pairs
        │     • loadRecords()/saveRecords() and loadStatuses()/saveStatuses()
        │
        ├── State variables
        │     • records[]   — flat array of { id, username, show, season,
        │                      episode, rating, notes, loggedAt }, one per watch
        │     • statuses{}  — { "username␟show": "completed" }; a pairing with
        │                      no entry is implicitly "watching"
        │     • pendingRating — star value highlighted in the add form (0-5)
        │     • filters{}   — active column filters (username/show/season/
        │                      episode/rating = exact match, notes = substring,
        │                      status = derived per-row via rowStatus())
        │
        ├── Helper functions
        │     • genId()          — generates a unique ID (timestamp + random suffix)
        │     • esc()             — HTML-escapes user strings (XSS protection)
        │     • fmtDate()         — formats a Unix timestamp to a locale date string
        │     • uniqueSorted()    — distinct values of a field, for filter dropdowns
        │     • populateSelect()  — rebuilds a <select>'s options, keeping the
        │                           current selection if it still exists
        │     • showKey() / rowStatus() / setCompleted() — key a (username, show)
        │       pair, read its completed state, and toggle it for every row
        │       that shares the pairing
        │     • starsHtml() / ratingInputHtml() — read-only ★ display for table
        │       cells vs. the 5 clickable star buttons in the add form
        │
        ├── refreshFilterOptions()
        │     • Rebuilds the username/show/season/episode dropdowns from the
        │       full record set — called after add/delete, not on every filter
        │       interaction, so an in-progress filter selection isn't reset.
        │       Rating/Status filters have a fixed option set, defined in HTML.
        │
        ├── renderTable()
        │     • Applies matchesFilters() to records[], sorts newest-first,
        │       renders rows (or an empty state) and updates the count badge
        │
        ├── Log-a-watch form submit listener
        │     • Validates username/show/season/episode are present; notes and
        │       rating stay optional; pushes a new record, saves, re-renders,
        │       and clears the form (keeping the username filled in for quick
        │       re-entry)
        │
        ├── Row actions (event delegation on the table body)
        │     • toggle-status-btn flips the completed state for that row's
        │       (username, show) pairing — every other row sharing it updates
        │       on the next render
        │     • delete-record-btn removes just that one row
        │
        ├── Filter listeners
        │     • change on each dropdown / input on the notes search box
        │       update filters{} and call renderTable()
        │     • "Clear Filters" resets filters{} and every control
        │
        └── Delete-record listener (event delegation on the table body)
              • Confirms, removes the record by id, saves, re-renders
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

