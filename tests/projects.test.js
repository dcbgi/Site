/**
 * Tests to ensure the projects array and rendering logic stay healthy
 * when new projects are added to script.js.
 */

const fs   = require("fs");
const path = require("path");
const { projects, renderProjects, escapeHtml } = require("../script.js");

// ─── Nav-logo home link ───────────────────────────────────────────────────────

describe("index.html nav-logo", () => {
  let indexDoc;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    indexDoc = new DOMParser().parseFromString(html, "text/html");
  });

  test("nav-logo is an anchor tag", () => {
    const logo = indexDoc.querySelector(".nav-logo");
    expect(logo).not.toBeNull();
    expect(logo.tagName.toLowerCase()).toBe("a");
  });

  test("nav-logo links to index.html", () => {
    const logo = indexDoc.querySelector(".nav-logo");
    expect(logo.getAttribute("href")).toBe("index.html");
  });
});

// ─── Project data schema ──────────────────────────────────────────────────────

describe("projects array", () => {
  test("is a non-empty array", () => {
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });

  projects.forEach((project, index) => {
    describe(`project[${index}] "${project.title ?? "(no title)"}"`, () => {
      test("has a non-empty string title", () => {
        expect(typeof project.title).toBe("string");
        expect(project.title.trim().length).toBeGreaterThan(0);
      });

      test("has a non-empty string icon", () => {
        expect(typeof project.icon).toBe("string");
        expect(project.icon.trim().length).toBeGreaterThan(0);
      });

      test("has a non-empty string desc", () => {
        expect(typeof project.desc).toBe("string");
        expect(project.desc.trim().length).toBeGreaterThan(0);
      });

      test("has tags as an array", () => {
        expect(Array.isArray(project.tags)).toBe(true);
      });

      test("every tag is a non-empty string", () => {
        project.tags.forEach((tag) => {
          expect(typeof tag).toBe("string");
          expect(tag.trim().length).toBeGreaterThan(0);
        });
      });

      if (project.github !== undefined) {
        test("github is a valid HTTPS URL", () => {
          expect(() => new URL(project.github)).not.toThrow();
          expect(new URL(project.github).protocol).toBe("https:");
        });
      }

      if (project.demo !== undefined) {
        test("demo is a non-empty string (relative path or HTTPS URL)", () => {
          expect(typeof project.demo).toBe("string");
          expect(project.demo.trim().length).toBeGreaterThan(0);
        });

        if (project.demo.startsWith("https://")) {
          test("demo is a valid HTTPS URL", () => {
            expect(() => new URL(project.demo)).not.toThrow();
            expect(new URL(project.demo).protocol).toBe("https:");
          });
        }
      }
    });
  });
});

// ─── Deployment config covers all local demo pages ───────────────────────────

describe(".cpanel.yml deployment", () => {
  let cpanelContent;

  beforeAll(() => {
    cpanelContent = fs.readFileSync(path.join(__dirname, "..", ".cpanel.yml"), "utf8");
  });

  const localDemos = projects
    .filter((p) => p.demo && !p.demo.startsWith("https://"))
    .map((p) => p.demo);

  localDemos.forEach((demoFile) => {
    test(`deploys ${demoFile} via a copy command`, () => {
      expect(cpanelContent).toMatch(new RegExp("/bin/cp.*\\b" + demoFile + "\\b"));
    });
  });
});

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe("escapeHtml", () => {
  test("escapes &", () => expect(escapeHtml("a & b")).toBe("a &amp; b"));
  test("escapes <", () => expect(escapeHtml("<div>")).toBe("&lt;div&gt;"));
  test("escapes >", () => expect(escapeHtml("a > b")).toBe("a &gt; b"));
  test('escapes "', () => expect(escapeHtml('"hi"')).toBe("&quot;hi&quot;"));
  test("escapes '", () => expect(escapeHtml("it's")).toBe("it&#39;s"));
  test("leaves safe strings unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
  test("coerces non-strings to string", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

// ─── renderProjects ───────────────────────────────────────────────────────────

describe("renderProjects", () => {
  let grid;

  beforeEach(() => {
    document.body.innerHTML = '<div id="projects-grid"></div>';
    grid = document.getElementById("projects-grid");
  });

  test("renders one card per project", () => {
    renderProjects();
    const cards = grid.querySelectorAll(".project-card");
    expect(cards.length).toBe(projects.length);
  });

  test("each card contains its project title", () => {
    renderProjects();
    const cards = grid.querySelectorAll(".project-card");
    cards.forEach((card, i) => {
      expect(card.textContent).toContain(projects[i].title);
    });
  });

  test("XSS characters in title are escaped in the DOM", () => {
    const originalProjects = [...projects];
    projects.length = 0;
    projects.push({
      title: '<script>alert("xss")</script>',
      icon: "⚠️",
      desc: "test",
      tags: [],
    });

    renderProjects();
    expect(grid.innerHTML).not.toContain("<script>");

    // Restore original projects
    projects.length = 0;
    projects.push(...originalProjects);
  });

  test("shows empty-state message when no projects exist", () => {
    const originalProjects = [...projects];
    projects.length = 0;

    renderProjects();
    expect(grid.textContent).toContain("No projects yet");

    // Restore original projects
    projects.push(...originalProjects);
  });
});
