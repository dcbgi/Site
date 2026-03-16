// ── Element references ───────────────────────────────────────────────────────
// Cache the overlay container and its inner parts so we don't query the DOM
// on every button click.
const overlay      = document.getElementById("emoji-overlay");
let   overlayEmoji = document.getElementById("overlay-emoji"); // `let` because we replace this node
const overlayLabel = document.getElementById("overlay-label");

// ── Mood button click → show overlay ─────────────────────────────────────────
// Attach a click listener to every .mood-btn button.
// When one is clicked, we read its data-emoji and data-label attributes,
// update the overlay content, and make it visible.
document.querySelectorAll(".mood-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const emoji = btn.dataset.emoji;
    const label = btn.dataset.label;

    // Reset the CSS pop animation by cloning the emoji element.
    // Simply changing textContent won't restart a running animation;
    // replacing the node forces the browser to treat it as brand-new,
    // which re-triggers the @keyframes pop animation from the beginning.
    const clonedEmoji = overlayEmoji.cloneNode(true);
    clonedEmoji.textContent = emoji;
    overlayEmoji.replaceWith(clonedEmoji);
    // Update the module-level reference so future clicks still work
    overlayEmoji = clonedEmoji;

    overlayLabel.textContent = label;
    // Adding "visible" transitions opacity to 1 and re-enables pointer events
    overlay.classList.add("visible");
    overlay.focus(); // Move focus into the overlay for keyboard/screen-reader users
  });
});

// ── Close overlay on click or Escape key ─────────────────────────────────────
// Clicking anywhere on the semi-transparent overlay background closes it.
overlay.addEventListener("click", () => overlay.classList.remove("visible"));
// Keyboard users can also dismiss the overlay with the Escape key.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") overlay.classList.remove("visible");
});

// ── Footer year ───────────────────────────────────────────────────────────────
// Stamp the current four-digit year into the footer copyright notice so it
// stays accurate without manual updates.
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
