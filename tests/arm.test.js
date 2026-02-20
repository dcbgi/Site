// tests/arm.test.js
// Tests for the arm.html hand controls legend.
"use strict";

const fs   = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "arm.html"), "utf8");

beforeAll(() => {
  // Parse arm.html into a detached document; scripts are not executed.
  const parsed = new DOMParser().parseFromString(html, "text/html");
  // Remove all script elements so none execute when we copy into the live doc.
  parsed.querySelectorAll("script").forEach((el) => el.remove());
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
});

// ── Controls panel presence ───────────────────────────────────────────────────
test("arm.html has a keyboard controls panel", () => {
  expect(document.querySelector(".controls-panel")).not.toBeNull();
});

// ── Hand legend label ─────────────────────────────────────────────────────────
test("controls panel labels the hand/fingers control", () => {
  const labels = Array.from(document.querySelectorAll(".control-label"))
    .map((el) => el.textContent.toLowerCase());
  expect(labels.some((t) => t.includes("hand") || t.includes("finger"))).toBe(true);
});

// ── Keyboard shortcuts for hand ───────────────────────────────────────────────
test("controls panel documents g and G keyboard shortcuts for the hand", () => {
  const kbds = Array.from(document.querySelectorAll(".controls-panel kbd"))
    .map((el) => el.textContent);
  expect(kbds).toContain("g");
  expect(kbds).toContain("G");
});

// ── Direction hints (close / open) ────────────────────────────────────────────
test("controls panel shows close and open direction hints for the hand", () => {
  const detail = document.querySelector(".hand-legend-detail");
  expect(detail).not.toBeNull();
  const text = detail.textContent.toLowerCase();
  expect(text).toContain("close");
  expect(text).toContain("open");
});

// ── On-screen Hand button group ───────────────────────────────────────────────
test("on-screen button controls include a Hand section", () => {
  const headings = Array.from(document.querySelectorAll(".joint-control h3"))
    .map((el) => el.textContent.toLowerCase());
  expect(headings.some((t) => t.includes("hand"))).toBe(true);
});

test("Hand button group has Close and Open buttons", () => {
  const handSection = Array.from(document.querySelectorAll(".joint-control"))
    .find((el) => el.querySelector("h3")?.textContent.toLowerCase().includes("hand"));
  expect(handSection).not.toBeUndefined();
  const btnText = Array.from(handSection.querySelectorAll("button"))
    .map((b) => b.textContent.toLowerCase());
  expect(btnText.some((t) => t.includes("close"))).toBe(true);
  expect(btnText.some((t) => t.includes("open"))).toBe(true);
});

// ── data-joint="grab" wiring still intact ────────────────────────────────────
test("Hand buttons still carry data-joint=grab for scripting", () => {
  const grabBtns = document.querySelectorAll('[data-joint="grab"]');
  expect(grabBtns.length).toBe(2);
});
