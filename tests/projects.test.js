/**
 * Tests to ensure the projects array and rendering logic stay healthy
 * when new projects are added to script.js.
 */

const fs   = require("fs");
const path = require("path");
const { projects, moreProjects, renderProjects, escapeHtml } = require("../script.js");

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

describe.each([
  ["projects", projects],
  ["moreProjects", moreProjects],
])("%s array", (arrayName, list) => {
  test("is a non-empty array", () => {
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  list.forEach((project, index) => {
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

// ─── External CSS / JS references ────────────────────────────────────────────
// After extracting inline styles and scripts to separate files, each HTML page
// must reference those files via <link> and <script src="..."> tags.

describe.each([
  ["index.html", "index.html"],
  ["more.html", "more.html"],
])("%s external assets", (label, file) => {
  let doc;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    doc = new DOMParser().parseFromString(html, "text/html");
  });

  test("links shared.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("shared.css");
  });

  test("links styles.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("styles.css");
  });

  test("has no inline <style> block", () => {
    expect(doc.querySelectorAll("style").length).toBe(0);
  });
});

describe("more.html navigation", () => {
  let doc;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(__dirname, "..", "more.html"), "utf8");
    doc = new DOMParser().parseFromString(html, "text/html");
  });

  test("nav-logo links back to index.html", () => {
    const logo = doc.querySelector(".nav-logo");
    expect(logo).not.toBeNull();
    expect(logo.getAttribute("href")).toBe("index.html");
  });

  test("nav-back link points to index.html", () => {
    const back = doc.querySelector(".nav-back");
    expect(back).not.toBeNull();
    expect(back.getAttribute("href")).toBe("index.html");
  });
});


describe("experiences/codecracker/index.html external assets", () => {
  let doc;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(__dirname, "..", "experiences/codecracker/index.html"), "utf8");
    doc = new DOMParser().parseFromString(html, "text/html");
  });

  test("links shared.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("../../shared.css");
  });

  test("links style.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("style.css");
  });

  test("loads script.js via <script src>", () => {
    const scripts = [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
    expect(scripts).toContain("script.js");
  });

  test("has no inline <style> block", () => {
    expect(doc.querySelectorAll("style").length).toBe(0);
  });

  test("has no inline <script> block", () => {
    const inlineScripts = [...doc.querySelectorAll("script")].filter((s) => !s.getAttribute("src"));
    expect(inlineScripts.length).toBe(0);
  });
});

describe("experiences/howsyourday/index.html external assets", () => {
  let doc;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(__dirname, "..", "experiences/howsyourday/index.html"), "utf8");
    doc = new DOMParser().parseFromString(html, "text/html");
  });

  test("links shared.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("../../shared.css");
  });

  test("links style.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("style.css");
  });

  test("loads script.js via <script src>", () => {
    const scripts = [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
    expect(scripts).toContain("script.js");
  });

  test("has no inline <style> block", () => {
    expect(doc.querySelectorAll("style").length).toBe(0);
  });

  test("has no inline <script> block", () => {
    const inlineScripts = [...doc.querySelectorAll("script")].filter((s) => !s.getAttribute("src"));
    expect(inlineScripts.length).toBe(0);
  });
});

describe("experiences/tvtracker/index.html external assets", () => {
  let doc;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(__dirname, "..", "experiences/tvtracker/index.html"), "utf8");
    doc = new DOMParser().parseFromString(html, "text/html");
  });

  test("links shared.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("../../shared.css");
  });

  test("links style.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("style.css");
  });

  test("loads script.js via <script src>", () => {
    const scripts = [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
    expect(scripts).toContain("script.js");
  });

  test("has no inline <style> block", () => {
    expect(doc.querySelectorAll("style").length).toBe(0);
  });

  test("has no inline <script> block", () => {
    const inlineScripts = [...doc.querySelectorAll("script")].filter((s) => !s.getAttribute("src"));
    expect(inlineScripts.length).toBe(0);
  });
});

describe("experiences/bookchallenge/index.html external assets", () => {
  let doc;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(__dirname, "..", "experiences/bookchallenge/index.html"), "utf8");
    doc = new DOMParser().parseFromString(html, "text/html");
  });

  test("links shared.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("../../shared.css");
  });

  test("links style.css", () => {
    const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
    expect(links).toContain("style.css");
  });

  test("loads script.js as a module via <script src>", () => {
    const scripts = [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
    expect(scripts).toContain("script.js");
  });

  test("has no inline <style> block", () => {
    expect(doc.querySelectorAll("style").length).toBe(0);
  });

  test("has no inline <script> block", () => {
    const inlineScripts = [...doc.querySelectorAll("script")].filter((s) => !s.getAttribute("src"));
    expect(inlineScripts.length).toBe(0);
  });
});

// ─── Navigation / routing ─────────────────────────────────────────────────────

describe("sub-page back links point to index.html", () => {
  const subPages = ["experiences/codecracker/index.html", "experiences/howsyourday/index.html", "experiences/tvtracker/index.html", "experiences/bookchallenge/index.html"];

  subPages.forEach((page) => {
    describe(page, () => {
      let doc;

      beforeAll(() => {
        const html = fs.readFileSync(path.join(__dirname, "..", page), "utf8");
        doc = new DOMParser().parseFromString(html, "text/html");
      });

      test("nav-logo links back to index.html", () => {
        const logo = doc.querySelector(".nav-logo");
        expect(logo).not.toBeNull();
        expect(logo.getAttribute("href")).toBe("../../index.html");
      });

      test("nav-back link points to index.html", () => {
        const back = doc.querySelector(".nav-back");
        expect(back).not.toBeNull();
        expect(back.getAttribute("href")).toBe("../../index.html");
      });
    });
  });
});

describe.each([
  ["index.html", projects, "projects-grid"],
  ["more.html", moreProjects, "more-projects-grid"],
])("%s links forward to every local demo page", (label, list, containerId) => {
  let pageDoc;

  beforeAll(() => {
    document.body.innerHTML = `<div id="${containerId}"></div>`;
    renderProjects(list, containerId);
    pageDoc = document;
  });

  const localDemos = list
    .filter((p) => p.demo && !p.demo.startsWith("https://"))
    .map((p) => p.demo);

  localDemos.forEach((demoFile) => {
    test(`contains a link to ${demoFile}`, () => {
      const links = [...pageDoc.querySelectorAll("a")].map((a) => a.getAttribute("href"));
      expect(links).toContain(demoFile);
    });

    test(`${demoFile} exists on disk`, () => {
      const filePath = path.join(__dirname, "..", demoFile);
      expect(fs.existsSync(filePath)).toBe(true);
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

  test("renders one tile per project", () => {
    renderProjects();
    const tiles = grid.querySelectorAll(".experience-tile");
    expect(tiles.length).toBe(projects.length);
  });

  test("each tile contains its project title", () => {
    renderProjects();
    const tiles = grid.querySelectorAll(".experience-tile");
    tiles.forEach((tile, i) => {
      expect(tile.textContent).toContain(projects[i].title);
    });
  });

  test("demo projects link directly to their demo page", () => {
    renderProjects();
    const demoProjects = projects.filter((p) => p.demo);
    demoProjects.forEach((p) => {
      const tile = [...grid.querySelectorAll(".experience-tile")].find((t) => t.textContent.includes(p.title));
      expect(tile).not.toBeUndefined();
      expect(tile.getAttribute("href")).toBe(p.demo);
    });
  });

  test("github-only projects link to their repo", () => {
    renderProjects();
    const ghOnly = projects.filter((p) => p.github && !p.demo);
    ghOnly.forEach((p) => {
      const tile = [...grid.querySelectorAll(".experience-tile")].find((t) => t.textContent.includes(p.title));
      expect(tile).not.toBeUndefined();
      expect(tile.getAttribute("href")).toBe(p.github);
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

    projects.length = 0;
    projects.push(...originalProjects);
  });

  test("shows empty-state message when no projects exist", () => {
    const originalProjects = [...projects];
    projects.length = 0;

    renderProjects();
    expect(grid.textContent).toContain("No experiences yet");

    projects.push(...originalProjects);
  });
});

