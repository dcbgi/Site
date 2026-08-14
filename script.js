// ─── Project Data ────────────────────────────────────────────────────────────
// Two arrays are the single source of truth for all project cards on the site.
// The renderProjects() function reads them at page load and builds the cards
// dynamically — no HTML edits are needed.
//
// Each object supports the following fields:
//   title    {string}   - Project name displayed as the card heading
//   icon     {string}   - Emoji shown next to the title (decorative)
//   desc     {string}   - One or two sentence description of the project
//   tags     {string[]} - Technology / language badges rendered below the description
//   github   {string}   - Full HTTPS URL to the GitHub repo (optional)
//   demo     {string}   - Live demo URL or same-site relative path (optional)

// `projects` — the "true experiences" shown as tiles on the main hub (index.html).
const projects = [
  {
    title: "Book Challenge",
    icon: "📚",
    desc: "Shared reading challenge for a group — log books and pages, and watch a live scoreboard rank everyone's progress toward their own yearly goal.",
    tags: ["HTML", "CSS", "JavaScript", "Firebase"],
    demo: "experiences/bookchallenge/index.html",
  },
  {
    title: "TV Show Tracker",
    icon: "🎬",
    desc: "Shared TV tracker — log what you're watching, where you left off, your watchlist, and your ratings, synced live across devices.",
    tags: ["HTML", "CSS", "JavaScript", "Firebase"],
    demo: "experiences/tvtracker/index.html",
  },
  {
    title: "How's Your Day?",
    icon: "😊",
    desc: "Pick a mood and watch the matching emoji explode onto the screen — a tiny interactive check-in built with vanilla HTML, CSS, and JavaScript.",
    tags: ["HTML", "CSS", "JavaScript"],
    demo: "experiences/howsyourday/index.html",
  },
  {
    title: "Code Cracker",
    icon: "🔐",
    desc: "Break a secret four-colour code in seven attempts using positional and colour feedback after each guess.",
    tags: ["HTML", "CSS", "JavaScript", "Game"],
    github: "https://github.com/dcbgi/CodeCracker",
    demo: "experiences/codecracker/index.html",
  },
  {
    title: "Personal Profile Site",
    icon: "🌐",
    desc: "This website — a personal profile and project showcase built with vanilla HTML, CSS and JavaScript.",
    tags: ["HTML", "CSS", "JavaScript"],
    demo: "more.html",
  },
];

// `moreProjects` — everything else, shown on the secondary page (more.html),
// reached by clicking the "Personal Profile Site" tile on the main hub.
const moreProjects = [
  {
    title: "3D Robot Arm",
    icon: "🦾",
    desc: "Interactive 3D robotic arm with flexion, twisting, and grabbing — built with C++ and OpenGL.",
    tags: ["C++", "OpenGL"],
    github: "https://github.com/dcbgi/arm",
  },
  {
    title: "Tipper",
    icon: "💰",
    desc: "Android tip calculator app — quickly compute restaurant tips at 10%, 15%, or a custom percentage.",
    tags: ["Android", "Java"],
    github: "https://github.com/dcbgi/Tipper",
  },
  // ── Add more projects below ──
  // {
  //   title: "My Next Project",
  //   icon: "🚀",
  //   desc: "Description of the project.",
  //   tags: ["Python", "FastAPI"],
  //   github: "https://github.com/dcbgi/my-next-project",
  //   demo: "https://example.com",
  // },
];

// ─── Render Projects ─────────────────────────────────────────────────────────
// Reads a project list and injects one tile per entry into the given grid
// container. Defaults to rendering `projects` into "#projects-grid" (the main
// hub in index.html); pass `moreProjects` and "more-projects-grid" to render
// the secondary page instead. Called once on DOMContentLoaded per grid present
// on the page. Safe to call again if the array changes (e.g. in tests) — it
// fully replaces the grid innerHTML each time.
function renderProjects(list = projects, containerId = "projects-grid") {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `<p class="empty-state">No experiences yet — check back soon!</p>`;
    return;
  }

  grid.innerHTML = list
    .map((p) => {
      const href = p.demo || p.github || "#";
      const isExternal = !p.demo;
      const extraAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
      const codeOnlyClass = !p.demo ? " code-only" : "";

      return `
    <a href="${href}"${extraAttrs} class="experience-tile${codeOnlyClass}">
      <span class="tile-icon" aria-hidden="true">${p.icon}</span>
      <span class="tile-title">${escapeHtml(p.title)}</span>
      <span class="tile-desc">${escapeHtml(p.desc)}</span>
      ${
        p.tags && p.tags.length
          ? `<span class="tile-tags">${p.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</span>`
          : ""
      }
    </a>`;
    })
    .join("");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Converts the five HTML-special characters to their safe entity equivalents.
// This prevents injected strings from being interpreted as markup or script.
// Always call this before inserting any user-controlled or data-driven string
// into innerHTML.
function escapeHtml(str) {
  // Lookup table maps each dangerous character to its HTML entity
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  // String() coerces non-string values (numbers, null, etc.) before replacing
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

// ─── Footer year ─────────────────────────────────────────────────────────────
// Writes the current four-digit year into the #year span inside the footer.
// This keeps the copyright notice up to date without manual editing.
function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// Wait for the full DOM to be parsed before touching any elements.
// DOMContentLoaded fires before images/stylesheets load, so this is fast.
document.addEventListener("DOMContentLoaded", () => {
  renderProjects(projects, "projects-grid");            // Main hub tiles (index.html)
  renderProjects(moreProjects, "more-projects-grid");    // Secondary page tiles (more.html)
  setYear();                                              // Stamp the footer with the current year
});

// ─── Test exports (Node / Jest only) ─────────────────────────────────────────
// When this file is require()'d by Jest (Node environment), export the
// public API so tests can inspect the data and call the functions directly.
// The typeof guard prevents errors in the browser where `module` is undefined.
if (typeof module !== "undefined") {
  module.exports = { projects, moreProjects, renderProjects, escapeHtml };
}
