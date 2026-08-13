// ─── Project Data ────────────────────────────────────────────────────────────
// This array is the single source of truth for all project cards on the page.
// To add a new project, append an object to this array following the schema below.
// The renderProjects() function reads this array at page load and builds the
// cards dynamically — no HTML edits are needed.
//
// Each object supports the following fields:
//   title    {string}   - Project name displayed as the card heading
//   icon     {string}   - Emoji shown next to the title (decorative)
//   desc     {string}   - One or two sentence description of the project
//   tags     {string[]} - Technology / language badges rendered below the description
//   github   {string}   - Full HTTPS URL to the GitHub repo (optional)
//   demo     {string}   - Live demo URL or same-site relative path (optional)
const projects = [
  {
    title: "Personal Profile Site",
    icon: "🌐",
    desc: "This website — a personal profile and project showcase built with vanilla HTML, CSS and JavaScript.",
    tags: ["HTML", "CSS", "JavaScript"],
    github: "https://github.com/dcbgi/Site",
  },
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
  {
    title: "TV Show Tracker",
    icon: "🎬",
    desc: "Personal TV show tracker — log every episode you watch, rate them with stars, and keep tabs on what you're currently watching or have completed.",
    tags: ["HTML", "CSS", "JavaScript", "localStorage"],
    // demo is a relative path — served from the same origin as index.html
    demo: "tvtracker.html",
  },
  {
    title: "How's Your Day?",
    icon: "😊",
    desc: "Pick a mood and watch the matching emoji explode onto the screen — a tiny interactive check-in built with vanilla HTML, CSS, and JavaScript.",
    tags: ["HTML", "CSS", "JavaScript"],
    // demo is a relative path — served from the same origin as index.html
    demo: "howsyourday.html",
  },
  {
    title: "Code Cracker",
    icon: "🔐",
    desc: "Break a secret four-colour code in seven attempts using positional and colour feedback after each guess.",
    tags: ["HTML", "CSS", "JavaScript", "Game"],
    github: "https://github.com/dcbgi/CodeCracker",
    // demo is a relative path — served from the same origin as index.html
    demo: "codecracker.html",
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
// Reads the projects array and injects one <article class="project-card">
// element per entry into the #projects-grid container in index.html.
// Called once on DOMContentLoaded. Safe to call again if the array changes
// (e.g. in tests) — it fully replaces the grid innerHTML each time.
function renderProjects() {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  if (projects.length === 0) {
    grid.innerHTML = `<p class="empty-state">No experiences yet — check back soon!</p>`;
    return;
  }

  grid.innerHTML = projects
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
  renderProjects(); // Populate the projects grid
  setYear();        // Stamp the footer with the current year
});

// ─── Test exports (Node / Jest only) ─────────────────────────────────────────
// When this file is require()'d by Jest (Node environment), export the
// public API so tests can inspect the data and call the functions directly.
// The typeof guard prevents errors in the browser where `module` is undefined.
if (typeof module !== "undefined") {
  module.exports = { projects, renderProjects, escapeHtml };
}
