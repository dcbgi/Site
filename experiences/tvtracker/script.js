// ── Immediately-invoked function expression (IIFE) ────────────────────────
// Wrapping all code in an IIFE creates a private scope so no variables leak
// into the global `window` object, preventing accidental name collisions.
(function () {
  "use strict"; // Enable strict mode for safer JavaScript (disallows undeclared vars etc.)

  // ── Storage key ───────────────────────────────────────────────────────────
  // All show data is persisted as a JSON string under this localStorage key.
  // Changing this key would cause existing user data to be invisible to the app.
  var STORAGE_KEY = "tvtracker_shows";

  // ── loadShows ─────────────────────────────────────────────────────────────
  // Reads and parses the shows array from localStorage.
  // Returns an empty array if the key doesn't exist yet or if the stored
  // value is corrupt/unparseable JSON.
  function loadShows() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  // ── saveShows ─────────────────────────────────────────────────────────────
  // Serialises the current shows array to JSON and writes it to localStorage.
  // Called after every mutation (add show, log episode, delete, etc.).
  function saveShows(shows) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shows));
  }

  // ── Application state ─────────────────────────────────────────────────────
  var shows = loadShows(); // Master array of show objects loaded from storage

  // openCards tracks which show cards are expanded in the UI.
  // Shape: { [showId]: boolean }
  var openCards = {};

  // openForms tracks which "Log Episode" inline forms are visible.
  // Shape: { [showId]: boolean }
  var openForms = {};

  // pendingRating holds the star value the user has highlighted but not yet
  // submitted. Updated in-place (without re-rendering the whole card) so the
  // other form fields retain their values.
  // Shape: { [showId]: number (1-5, or 0 for unrated) }
  var pendingRating = {};

  // ── genId ─────────────────────────────────────────────────────────────────
  // Generates a compact unique ID using the current timestamp (base-36) plus
  // a short random suffix. This is sufficient for client-side uniqueness where
  // IDs are only compared within a single user's localStorage.
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── nextEpNum ─────────────────────────────────────────────────────────────
  // Returns the suggested next episode number for the "Log Episode" form.
  // If the show has no episodes yet, returns 1.
  // Otherwise returns (highest existing episode number + 1) so the field
  // pre-fills intelligently without the user needing to count manually.
  function nextEpNum(show) {
    if (!show.episodes.length) return 1;
    return Math.max.apply(null, show.episodes.map(function (e) { return e.number; })) + 1;
  }

  // ── avgRating ─────────────────────────────────────────────────────────────
  // Calculates the average star rating across all rated episodes of a show.
  // Episodes with rating === 0 (unrated) are excluded from the calculation.
  // Returns 0 if no episodes have been rated, otherwise a string like "3.7".
  function avgRating(show) {
    var rated = show.episodes.filter(function (e) { return e.rating > 0; });
    if (!rated.length) return 0;
    var sum = rated.reduce(function (acc, e) { return acc + e.rating; }, 0);
    return (sum / rated.length).toFixed(1); // One decimal place, e.g. "4.2"
  }

  // ── esc ───────────────────────────────────────────────────────────────────
  // Escapes the five HTML-special characters before inserting any user data
  // into innerHTML. This is the primary XSS defence for this page — every
  // user-supplied string (show titles, episode titles) must pass through esc()
  // before being placed inside an HTML string.
  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── starsHtml ─────────────────────────────────────────────────────────────
  // Builds a read-only star display (5 ★ characters) for a given numeric rating.
  // Stars at or below the rating value get the "filled" class (yellow colour).
  // The aria-label on the wrapper announces the rating to screen readers.
  function starsHtml(rating) {
    var html = '<span class="stars-display" aria-label="' + rating + ' out of 5 stars">';
    for (var i = 1; i <= 5; i++) {
      html += '<span class="star-display' + (i <= rating ? " filled" : "") + '">★</span>';
    }
    html += "</span>";
    return html;
  }

  // ── fmtDate ───────────────────────────────────────────────────────────────
  // Converts a Unix timestamp (milliseconds) to a human-readable date string
  // using the user's browser locale (e.g. "Mar 16, 2026" for en-US).
  function fmtDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // ── showCardHtml ──────────────────────────────────────────────────────────
  // Builds and returns the full HTML string for one show card.
  // This includes:
  //   • The collapsible show header (title, episode count, average rating,
  //     completed badge, chevron)
  //   • The show body (episode list, log-episode form, action buttons)
  // The card is "open" (body visible) when openCards[show.id] is truthy.
  function showCardHtml(show) {
    var isOpen = !!openCards[show.id];
    var epCount = show.episodes.length;
    var avg = avgRating(show);
    var isCompleted = show.status === "completed";

    // ── Build the episode list HTML ────────────────────────────────────────
    var episodesHtml = "";
    if (epCount === 0) {
      // Friendly empty state when no episodes have been logged yet
      episodesHtml = '<p class="empty-state" style="padding:0.75rem 0;text-align:left;">No episodes logged yet.</p>';
    } else {
      episodesHtml = '<div class="episodes-list">';
      show.episodes.forEach(function (ep) {
        // Each episode row shows: number, title (or "Untitled"), star rating or
        // "Unrated", the date logged, and a delete button.
        episodesHtml +=
          '<div class="episode-row" data-ep-id="' + esc(ep.id) + '">' +
            '<div class="ep-primary">' +
              '<span class="ep-num">E' + esc(ep.number) + '</span>' +
              '<span class="ep-title' + (ep.title ? "" : " untitled") + '">' +
                (ep.title ? esc(ep.title) : "Untitled episode") +
              "</span>" +
            "</div>" +
            '<div class="ep-meta">' +
              // Show star icons for rated episodes; plain text for unrated
              (ep.rating > 0 ? starsHtml(ep.rating) : '<span style="color:var(--text-muted);font-size:0.8rem;">Unrated</span>') +
              '<span class="ep-date">' + fmtDate(ep.loggedAt) + "</span>" +
              // data-show-id and data-ep-id are read by the event delegation handler
              '<button class="btn btn-danger delete-ep-btn" data-show-id="' + esc(show.id) + '" data-ep-id="' + esc(ep.id) + '" aria-label="Delete episode ' + esc(ep.number) + '">✕</button>' +
            "</div>" +
          "</div>";
      });
      episodesHtml += "</div>";
    }

    // ── Build the log-episode form HTML ───────────────────────────────────
    var formOpen = !!openForms[show.id];
    var pr = pendingRating[show.id] || 0; // Currently highlighted star value

    // Build 5 interactive star buttons for the rating input.
    // Stars at or below the pending value get the "filled" class.
    var starsInput = "";
    for (var s = 1; s <= 5; s++) {
      starsInput += '<button type="button" class="star rating-star' + (s <= pr ? " filled" : "") + '" data-val="' + s + '" aria-label="' + s + ' star' + (s > 1 ? "s" : "") + '">★</button>';
    }

    var logFormHtml =
      '<div class="log-form' + (formOpen ? " open" : "") + '" id="log-form-' + esc(show.id) + '">' +
        '<div class="log-form-title">Log an Episode</div>' +
        '<div class="log-form-fields">' +
          '<div class="form-field">' +
            '<label class="form-label" for="ep-num-' + esc(show.id) + '">Episode #</label>' +
            // Pre-fill the episode number with the next logical number
            '<input class="form-input ep-num-input" type="number" id="ep-num-' + esc(show.id) + '" min="1" max="9999" value="' + nextEpNum(show) + '" />' +
          "</div>" +
          '<div class="form-field">' +
            '<label class="form-label" for="ep-title-' + esc(show.id) + '">Title (optional)</label>' +
            '<input class="form-input ep-title-input" type="text" id="ep-title-' + esc(show.id) + '" placeholder="Episode title…" maxlength="120" />' +
          "</div>" +
          '<div class="form-field rating-field">' +
            '<span class="form-label">Rating (optional)</span>' +
            '<div class="stars" id="stars-' + esc(show.id) + '">' + starsInput + "</div>" +
          "</div>" +
        "</div>" +
        '<div class="log-form-actions">' +
          '<button class="btn btn-primary btn-sm log-ep-submit" data-show-id="' + esc(show.id) + '">Log Episode</button>' +
          '<button class="btn btn-ghost btn-sm log-ep-cancel" data-show-id="' + esc(show.id) + '">Cancel</button>' +
        "</div>" +
      "</div>";

    // ── Build action buttons row ──────────────────────────────────────────
    // Active shows get "Log Episode" and "Mark Complete".
    // Completed shows get "Move to Watching" instead.
    // Both get a "Delete" button.
    var actionBtns = "";
    if (!isCompleted) {
      actionBtns +=
        '<button class="btn btn-success toggle-log-btn btn-sm" data-show-id="' + esc(show.id) + '">' +
          (formOpen ? "Cancel" : "+ Log Episode") +
        "</button> " +
        '<button class="btn btn-success btn-sm mark-complete-btn" data-show-id="' + esc(show.id) + '">Mark Complete</button> ';
    } else {
      actionBtns +=
        '<button class="btn btn-ghost btn-sm mark-watching-btn" data-show-id="' + esc(show.id) + '">Move to Watching</button> ';
    }
    actionBtns += '<button class="btn btn-danger btn-sm delete-show-btn" data-show-id="' + esc(show.id) + '">Delete</button>';

    // ── Assemble and return the full card HTML ────────────────────────────
    return (
      '<div class="show-card' + (isOpen ? " open" : "") + '" id="show-' + esc(show.id) + '">' +
        // Header is the always-visible row; clicking it toggles the card body
        '<div class="show-header toggle-card-btn" data-show-id="' + esc(show.id) + '">' +
          '<div class="show-header-left">' +
            '<span class="show-title-text">' + esc(show.title) + "</span>" +
            '<span class="ep-count">' + epCount + " ep" + (epCount !== 1 ? "s" : "") + "</span>" +
            (avg > 0 ? '<span class="avg-rating">★ ' + avg + "</span>" : "") +
            (isCompleted ? '<span class="completed-badge">Completed</span>' : "") +
          "</div>" +
          '<div class="show-header-right">' +
            // Chevron rotates 180° via CSS when the card has the "open" class
            '<span class="chevron">▼</span>' +
          "</div>" +
        "</div>" +
        // Body is hidden (display: none) until the card gets the "open" class
        '<div class="show-body">' +
          episodesHtml +
          (!isCompleted ? logFormHtml : "") +
          '<div style="margin-top:' + (isCompleted ? "0" : "0.75rem") + ';display:flex;flex-wrap:wrap;gap:0.5rem;">' +
            actionBtns +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  // ── render ────────────────────────────────────────────────────────────────
  // Re-renders both the "Currently Watching" and "Completed" lists from
  // scratch using the current state of the `shows` array.
  // Called after every state mutation (add, delete, log episode, etc.).
  function render() {
    // Partition shows by status
    var watching  = shows.filter(function (s) { return s.status === "watching"; });
    var completed = shows.filter(function (s) { return s.status === "completed"; });

    // Update the badge counts in the panel headers
    document.getElementById("watching-count").textContent  = watching.length;
    document.getElementById("completed-count").textContent = completed.length;

    var wList = document.getElementById("watching-list");
    var cList = document.getElementById("completed-list");

    // Render watching shows or empty-state placeholder
    if (watching.length === 0) {
      wList.innerHTML =
        '<div class="empty-state"><div class="empty-icon">🎬</div><p>No shows yet — add one above!</p></div>';
    } else {
      wList.innerHTML = watching.map(showCardHtml).join("");
    }

    // Render completed shows or empty-state placeholder
    if (completed.length === 0) {
      cList.innerHTML =
        '<div class="empty-state"><div class="empty-icon">✅</div><p>No completed shows yet.</p></div>';
    } else {
      cList.innerHTML = completed.map(showCardHtml).join("");
    }
  }

  // ── findShow ──────────────────────────────────────────────────────────────
  // Looks up a show object in the `shows` array by its unique id string.
  // Returns undefined if no match is found.
  function findShow(id) {
    return shows.find(function (s) { return s.id === id; });
  }

  // ── Event delegation ──────────────────────────────────────────────────────
  // All interactive elements inside show cards are rendered dynamically, so
  // we can't attach individual listeners to them.  Instead we attach one
  // listener to the document and walk up the DOM (closest()) to identify which
  // button was clicked and which show it belongs to (via data-show-id).
  document.addEventListener("click", function (e) {
    var target = e.target;

    // ── Toggle card open/close ─────────────────────────────────────────────
    // Clicking the show header (but not a button inside it) expands or
    // collapses the card body.
    var toggleBtn = target.closest(".toggle-card-btn");
    if (toggleBtn && !target.closest("button")) {
      var sid = toggleBtn.dataset.showId;
      openCards[sid] = !openCards[sid]; // Flip the open state
      render();
      return;
    }

    // ── Toggle log form ────────────────────────────────────────────────────
    // The "+ Log Episode" button shows/hides the inline log form.
    // We also force the card open so the form is visible.
    var logToggle = target.closest(".toggle-log-btn");
    if (logToggle) {
      var sid = logToggle.dataset.showId;
      openCards[sid] = true; // Ensure the card body is visible
      openForms[sid] = !openForms[sid];
      render();
      return;
    }

    // ── Cancel log form ────────────────────────────────────────────────────
    var logCancel = target.closest(".log-ep-cancel");
    if (logCancel) {
      var sid = logCancel.dataset.showId;
      openForms[sid] = false;
      render();
      return;
    }

    // ── Star rating selection ──────────────────────────────────────────────
    // When the user clicks a star button we update pendingRating in-place
    // (without re-rendering the whole card) so the episode number and title
    // fields keep their current values.
    // Clicking the same star twice clears the rating (toggles to 0).
    var ratingStar = target.closest(".rating-star");
    if (ratingStar) {
      var val = parseInt(ratingStar.dataset.val, 10);
      var starsContainer = ratingStar.closest(".stars");
      if (starsContainer) {
        // Extract the show ID from the container's id attribute ("stars-{id}")
        var sid = starsContainer.id.replace("stars-", "");
        pendingRating[sid] = (pendingRating[sid] === val) ? 0 : val;
        var pr = pendingRating[sid];
        // Directly toggle the "filled" class on each star without a full re-render
        starsContainer.querySelectorAll(".rating-star").forEach(function (s) {
          var sv = parseInt(s.dataset.val, 10);
          s.classList.toggle("filled", sv <= pr);
        });
      }
      return;
    }

    // ── Submit log episode ─────────────────────────────────────────────────
    // Reads the episode number, optional title, and pending star rating from
    // the log form, validates the number, creates an episode object, pushes
    // it onto the show's episodes array, and saves + re-renders.
    var logSubmit = target.closest(".log-ep-submit");
    if (logSubmit) {
      var sid = logSubmit.dataset.showId;
      var show = findShow(sid);
      if (!show) return;

      var numEl   = document.getElementById("ep-num-" + sid);
      var titleEl = document.getElementById("ep-title-" + sid);
      var epNum   = parseInt(numEl.value, 10);
      var epTitle = titleEl.value.trim();
      var rating  = pendingRating[sid] || 0; // Default to unrated (0) if not set

      // Validate: episode number must be a positive integer
      if (!epNum || epNum < 1) { numEl.focus(); return; }

      // Append the new episode to the show's episode list
      show.episodes.push({
        id:       genId(),
        number:   epNum,
        title:    epTitle,  // Empty string if the user left the field blank
        rating:   rating,
        loggedAt: Date.now(), // Unix timestamp for the "date watched" display
      });

      // Keep episodes in ascending order by number for consistent display
      show.episodes.sort(function (a, b) { return a.number - b.number; });

      // Close the form, clear the pending rating, persist, and re-render
      openForms[sid] = false;
      delete pendingRating[sid];
      saveShows(shows);
      render();
      return;
    }

    // ── Delete episode ─────────────────────────────────────────────────────
    // Confirms deletion with a browser dialog, then removes the episode from
    // the show's episodes array by filtering it out.
    var delEp = target.closest(".delete-ep-btn");
    if (delEp) {
      var sid  = delEp.dataset.showId;
      var epId = delEp.dataset.epId;
      var show = findShow(sid);
      if (!show) return;
      if (!confirm("Delete this episode entry?")) return;
      show.episodes = show.episodes.filter(function (e) { return e.id !== epId; });
      saveShows(shows);
      render();
      return;
    }

    // ── Mark complete ──────────────────────────────────────────────────────
    // Changes the show's status to "completed" which moves it to the
    // Completed panel on the next render.
    var markComplete = target.closest(".mark-complete-btn");
    if (markComplete) {
      var sid  = markComplete.dataset.showId;
      var show = findShow(sid);
      if (show) {
        show.status = "completed";
        openForms[sid] = false; // Close any open log form for this show
        saveShows(shows);
        render();
      }
      return;
    }

    // ── Move back to watching ──────────────────────────────────────────────
    // Reverses a "Mark Complete" action — changes status back to "watching".
    var markWatching = target.closest(".mark-watching-btn");
    if (markWatching) {
      var sid  = markWatching.dataset.showId;
      var show = findShow(sid);
      if (show) {
        show.status = "watching";
        saveShows(shows);
        render();
      }
      return;
    }

    // ── Delete show ────────────────────────────────────────────────────────
    // Confirms with a named dialog, then removes the entire show (and all its
    // episodes) from the array and cleans up the tracking state objects.
    var delShow = target.closest(".delete-show-btn");
    if (delShow) {
      var sid  = delShow.dataset.showId;
      var show = findShow(sid);
      if (!show) return;
      if (!confirm('Delete "' + show.title + '" and all its episodes?')) return;
      shows = shows.filter(function (s) { return s.id !== sid; });
      delete openCards[sid];
      delete openForms[sid];
      delete pendingRating[sid];
      saveShows(shows);
      render();
      return;
    }
  });

  // ── Add show form ─────────────────────────────────────────────────────────
  // Intercepts the form's native submit, trims and validates the input value,
  // then creates a new show object with a generated ID and empty episodes list.
  // After saving and rendering, the new card is scrolled into view.
  document.getElementById("add-show-form").addEventListener("submit", function (e) {
    e.preventDefault(); // Prevent full-page reload
    var input = document.getElementById("show-input");
    var title = input.value.trim();
    if (!title) { input.focus(); return; } // Reject blank submissions

    var id = genId();
    shows.push({
      id:       id,
      title:    title,
      status:   "watching", // New shows always start in the watching list
      addedAt:  Date.now(),
      episodes: [],
    });

    openCards[id] = true; // Auto-expand the new card so the user can act immediately
    input.value = "";     // Clear the input for the next entry
    saveShows(shows);
    render();

    // Scroll the newly created card into view after the DOM has been updated.
    // setTimeout(0) defers execution until after the current call stack clears
    // (i.e., after render() has injected the card into the DOM).
    setTimeout(function () {
      var card = document.getElementById("show-" + id);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  });

  // ── Footer year ───────────────────────────────────────────────────────────
  // Writes the current four-digit year into the footer copyright span.
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── Initial render ────────────────────────────────────────────────────────
  // Build the UI from whatever was loaded out of localStorage on page load.
  render();
}());
