// ─── Project Data ────────────────────────────────────────────────────────────
// Add new projects here. Each object supports:
//   title    {string}   - Project name
//   icon     {string}   - Emoji icon
//   desc     {string}   - Short description
//   tags     {string[]} - Tech tags
//   github   {string}   - GitHub URL (optional)
//   demo     {string}   - Live demo URL (optional)
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
    desc: "Interactive 3D robotic arm with flexion, twisting, and grabbing — ported from C++/OpenGL to JavaScript with Three.js.",
    tags: ["C++", "OpenGL", "Three.js", "JavaScript"],
    github: "https://github.com/dcbgi/arm",
    demo: "arm.html",
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
function renderProjects() {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  if (projects.length === 0) {
    grid.innerHTML = `<p class="empty-state">No projects yet — check back soon!</p>`;
    return;
  }

  grid.innerHTML = projects
    .map(
      (p) => `
    <article class="project-card">
      <div class="project-card-header">
        <span class="project-icon" aria-hidden="true">${p.icon}</span>
        <h3 class="project-title">${escapeHtml(p.title)}</h3>
      </div>
      <p class="project-desc">${escapeHtml(p.desc)}</p>
      ${
        p.tags && p.tags.length
          ? `<div class="project-tags">${p.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`
          : ""
      }
      ${
        p.github || p.demo
          ? `<div class="project-links">
              ${p.github ? `<a href="${p.github}" target="_blank" rel="noopener noreferrer" class="project-link">GitHub →</a>` : ""}
              ${p.demo ? `<a href="${p.demo}" target="_blank" rel="noopener noreferrer" class="project-link">Live Demo →</a>` : ""}
            </div>`
          : ""
      }
    </article>`
    )
    .join("");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

// ─── Footer year ─────────────────────────────────────────────────────────────
function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderProjects();
  setYear();
});

// ─── Test exports (Node / Jest only) ─────────────────────────────────────────
if (typeof module !== "undefined") {
  module.exports = { projects, renderProjects, escapeHtml };
}

