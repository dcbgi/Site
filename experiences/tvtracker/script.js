// ── Immediately-invoked function expression (IIFE) ────────────────────────
// Wrapping all code in an IIFE creates a private scope so no variables leak
// into the global `window` object, preventing accidental name collisions.
(function () {
  "use strict"; // Enable strict mode for safer JavaScript (disallows undeclared vars etc.)

  // ── Storage keys ──────────────────────────────────────────────────────────
  // Watch records (one row per logged episode) and show-completion status
  // (one entry per username+show pair) are independent concerns, so they're
  // persisted separately. A show only needs a status entry once someone
  // marks it complete — everything else stays implicitly "watching".
  var STORAGE_KEY        = "tvtracker_records";
  var STORAGE_KEY_STATUS = "tvtracker_show_status";

  // ── loadRecords / saveRecords ────────────────────────────────────────────
  function loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  // ── loadStatuses / saveStatuses ──────────────────────────────────────────
  // statuses is a map of "username␟show" -> "completed". Absence of a
  // key means "watching" (the default), so completing a show just adds one
  // entry rather than requiring every show to be pre-registered.
  function loadStatuses() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_STATUS)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveStatuses(statuses) {
    localStorage.setItem(STORAGE_KEY_STATUS, JSON.stringify(statuses));
  }

  // ── Application state ─────────────────────────────────────────────────────
  var records   = loadRecords();   // Master array of watch-record objects
  var statuses  = loadStatuses();  // { [showKey]: "completed" }
  var pendingRating = 0;           // Star value highlighted in the add form (0-5, 0 = unrated)

  // Active column filters. Empty string means "no filter on this column".
  // username/show/season/episode/rating are matched by exact value; notes is
  // matched by case-insensitive substring search; status is derived per-row
  // from the statuses map (see rowStatus()).
  var filters = { username: "", show: "", season: "", episode: "", notes: "", rating: "", status: "" };

  // ── genId ─────────────────────────────────────────────────────────────────
  // Generates a compact unique ID using the current timestamp (base-36) plus
  // a short random suffix. Sufficient for client-side uniqueness within one
  // user's localStorage.
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── esc ───────────────────────────────────────────────────────────────────
  // Escapes the five HTML-special characters before inserting any user data
  // into innerHTML. This is the primary XSS defence for this page — every
  // user-supplied string (username, show, notes) must pass through esc()
  // before being placed inside an HTML string.
  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── fmtDate ───────────────────────────────────────────────────────────────
  // Converts a Unix timestamp (milliseconds) to a human-readable date string
  // using the user's browser locale (e.g. "Mar 16, 2026" for en-US).
  function fmtDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // ── showKey / rowStatus / setCompleted ──────────────────────────────────
  // "Completed" is a property of a (username, show) pair, not of a single
  // log entry — logging several episodes for the same show should all
  // reflect the same status, and toggling it from any one row should update
  // them all.
  function showKey(username, show) {
    return username + "␟" + show;
  }
  function rowStatus(r) {
    return statuses[showKey(r.username, r.show)] === "completed" ? "completed" : "watching";
  }
  function setCompleted(username, show, completed) {
    var key = showKey(username, show);
    if (completed) { statuses[key] = "completed"; } else { delete statuses[key]; }
    saveStatuses(statuses);
  }

  // ── Star rating helpers ───────────────────────────────────────────────────
  // starsHtml() builds a read-only ★ display for a table cell.
  // ratingInputHtml() builds the 5 interactive star buttons in the add form.
  function starsHtml(rating) {
    var html = '<span class="stars-display" aria-label="' + rating + ' out of 5 stars">';
    for (var i = 1; i <= 5; i++) {
      html += '<span class="star-display' + (i <= rating ? " filled" : "") + '">★</span>';
    }
    html += "</span>";
    return html;
  }
  function ratingInputHtml(value) {
    var html = "";
    for (var s = 1; s <= 5; s++) {
      html += '<button type="button" class="star rating-star' + (s <= value ? " filled" : "") + '" data-val="' + s + '" aria-label="' + s + " star" + (s > 1 ? "s" : "") + '">★</button>';
    }
    return html;
  }
  function renderRatingInput() {
    document.getElementById("rating-input").innerHTML = ratingInputHtml(pendingRating);
  }

  // ── uniqueSorted ──────────────────────────────────────────────────────────
  // Returns the distinct values of `field` across all records, sorted.
  // Numeric fields (season/episode) sort numerically; text fields sort
  // case-insensitively.
  function uniqueSorted(field, numeric) {
    var seen = {};
    var out = [];
    records.forEach(function (r) {
      var v = r[field];
      if (!seen[v]) { seen[v] = true; out.push(v); }
    });
    if (numeric) {
      out.sort(function (a, b) { return a - b; });
    } else {
      out.sort(function (a, b) { return String(a).toLowerCase().localeCompare(String(b).toLowerCase()); });
    }
    return out;
  }

  // ── populateSelect ───────────────────────────────────────────────────────
  // Rebuilds the <option> list of a filter <select> from a list of values,
  // preserving the currently-selected value if it's still present in the
  // list (falls back to "All" / empty string otherwise).
  function populateSelect(selectEl, values, allLabel) {
    var current = selectEl.value;
    var html = '<option value="">' + esc(allLabel) + "</option>";
    values.forEach(function (v) {
      html += '<option value="' + esc(v) + '">' + esc(v) + "</option>";
    });
    selectEl.innerHTML = html;
    if (values.some(function (v) { return String(v) === current; })) {
      selectEl.value = current;
    }
  }

  // ── refreshFilterOptions ─────────────────────────────────────────────────
  // Rebuilds the data-driven dropdown filters (username/show/season/episode)
  // from the full record set. Called whenever the underlying data changes
  // (add/delete), not on every filter interaction, so selections aren't
  // reset while the user is filtering. Rating and Status filters have a
  // fixed set of options defined in the HTML and don't need rebuilding.
  function refreshFilterOptions() {
    populateSelect(document.getElementById("filter-username"), uniqueSorted("username", false), "All users");
    populateSelect(document.getElementById("filter-show"), uniqueSorted("show", false), "All shows");
    populateSelect(document.getElementById("filter-season"), uniqueSorted("season", true), "All");
    populateSelect(document.getElementById("filter-episode"), uniqueSorted("episode", true), "All");
  }

  // ── matchesFilters ────────────────────────────────────────────────────────
  function matchesFilters(r) {
    if (filters.username && r.username !== filters.username) return false;
    if (filters.show && r.show !== filters.show) return false;
    if (filters.season && String(r.season) !== filters.season) return false;
    if (filters.episode && String(r.episode) !== filters.episode) return false;
    if (filters.notes && (r.notes || "").toLowerCase().indexOf(filters.notes.toLowerCase()) === -1) return false;
    if (filters.rating !== "" && String(r.rating || 0) !== filters.rating) return false;
    if (filters.status && rowStatus(r) !== filters.status) return false;
    return true;
  }

  // ── recordRowHtml ─────────────────────────────────────────────────────────
  function recordRowHtml(r) {
    var completed = rowStatus(r) === "completed";
    return (
      '<tr data-record-id="' + esc(r.id) + '">' +
        '<td data-label="Username"><span class="cell-username">' + esc(r.username) + "</span></td>" +
        '<td data-label="Show">' + esc(r.show) + "</td>" +
        '<td data-label="Season"><span class="cell-pill">S' + esc(r.season) + "</span></td>" +
        '<td data-label="Episode"><span class="cell-pill">E' + esc(r.episode) + "</span></td>" +
        '<td data-label="Rating">' + (r.rating > 0 ? starsHtml(r.rating) : '<span class="cell-notes-empty">Unrated</span>') + "</td>" +
        '<td data-label="Notes">' +
          (r.notes
            ? '<span class="cell-notes" title="' + esc(r.notes) + '">' + esc(r.notes) + "</span>"
            : '<span class="cell-notes cell-notes-empty">—</span>') +
        "</td>" +
        '<td data-label="Status"><span class="status-badge' + (completed ? " completed" : "") + '">' + (completed ? "✅ Completed" : "▶ Watching") + "</span></td>" +
        '<td data-label="Logged"><span class="cell-date">' + fmtDate(r.loggedAt) + "</span></td>" +
        '<td class="col-actions" data-label="">' +
          '<button class="btn btn-icon toggle-status-btn' + (completed ? " is-completed" : "") + '" data-username="' + esc(r.username) + '" data-show="' + esc(r.show) + '" data-completed="' + completed + '" title="' + (completed ? "Move " + esc(r.show) + " back to watching" : "Mark " + esc(r.show) + " as completed") + '" aria-label="' + (completed ? "Move " + esc(r.show) + " back to watching" : "Mark " + esc(r.show) + " as completed") + '">' +
            (completed ? "↺" : "✓") +
          "</button>" +
          '<button class="btn btn-icon btn-icon-danger delete-record-btn" data-record-id="' + esc(r.id) + '" title="Delete this record" aria-label="Delete this record">✕</button>' +
        "</td>" +
      "</tr>"
    );
  }

  // ── renderTable ───────────────────────────────────────────────────────────
  // Renders the filtered/sorted table rows (or an empty state) and updates
  // the visible record count badge. Does NOT touch the filter dropdowns.
  function renderTable() {
    var filtered = records
      .filter(matchesFilters)
      .slice()
      .sort(function (a, b) { return b.loggedAt - a.loggedAt; }); // Most recent first

    document.getElementById("record-count").textContent = filtered.length;

    var tbody = document.getElementById("log-tbody");
    var table = document.getElementById("log-table");
    var emptyState = document.getElementById("log-empty-state");
    var emptyText = document.getElementById("log-empty-text");

    if (filtered.length === 0) {
      tbody.innerHTML = "";
      table.style.display = "none";
      emptyState.style.display = "flex";
      emptyText.textContent = records.length === 0
        ? "No records logged yet — add one above!"
        : "No records match your filters.";
    } else {
      table.style.display = "";
      emptyState.style.display = "none";
      tbody.innerHTML = filtered.map(recordRowHtml).join("");
    }
  }

  // ── Rating input interaction ──────────────────────────────────────────────
  // Clicking a star sets pendingRating; clicking the currently-selected star
  // again clears it back to unrated (0).
  document.getElementById("rating-input").addEventListener("click", function (e) {
    var star = e.target.closest(".rating-star");
    if (!star) return;
    var val = parseInt(star.dataset.val, 10);
    pendingRating = (pendingRating === val) ? 0 : val;
    renderRatingInput();
  });

  // ── Add-record form ───────────────────────────────────────────────────────
  document.getElementById("log-entry-form").addEventListener("submit", function (e) {
    e.preventDefault(); // Prevent full-page reload

    var usernameEl = document.getElementById("input-username");
    var showEl     = document.getElementById("input-show");
    var seasonEl   = document.getElementById("input-season");
    var episodeEl  = document.getElementById("input-episode");
    var notesEl    = document.getElementById("input-notes");

    var username = usernameEl.value.trim();
    var show     = showEl.value.trim();
    var season   = parseInt(seasonEl.value, 10);
    var episode  = parseInt(episodeEl.value, 10);
    var notes    = notesEl.value.trim();

    // Required fields: username, show, season, episode. Notes and rating stay optional.
    if (!username) { usernameEl.focus(); return; }
    if (!show) { showEl.focus(); return; }
    if (!season || season < 1) { seasonEl.focus(); return; }
    if (!episode || episode < 1) { episodeEl.focus(); return; }

    records.push({
      id:       genId(),
      username: username,
      show:     show,
      season:   season,
      episode:  episode,
      rating:   pendingRating, // 0 = unrated
      notes:    notes,         // Empty string if left blank
      loggedAt: Date.now(),
    });

    saveRecords(records);
    refreshFilterOptions();
    renderTable();

    // Clear the form for the next entry, but leave the username filled in —
    // logging several episodes of the same show in a row is the common case.
    showEl.value = "";
    seasonEl.value = "";
    episodeEl.value = "";
    notesEl.value = "";
    pendingRating = 0;
    renderRatingInput();
    showEl.focus();
  });

  // ── Filter interactions ───────────────────────────────────────────────────
  ["username", "show", "season", "episode", "rating", "status"].forEach(function (field) {
    document.getElementById("filter-" + field).addEventListener("change", function (e) {
      filters[field] = e.target.value;
      renderTable();
    });
  });

  document.getElementById("filter-notes").addEventListener("input", function (e) {
    filters.notes = e.target.value.trim();
    renderTable();
  });

  document.getElementById("clear-filters-btn").addEventListener("click", function () {
    filters = { username: "", show: "", season: "", episode: "", notes: "", rating: "", status: "" };
    document.getElementById("filter-username").value = "";
    document.getElementById("filter-show").value = "";
    document.getElementById("filter-season").value = "";
    document.getElementById("filter-episode").value = "";
    document.getElementById("filter-notes").value = "";
    document.getElementById("filter-rating").value = "";
    document.getElementById("filter-status").value = "";
    renderTable();
  });

  // ── Row actions (event delegation) ────────────────────────────────────────
  // Rows are rendered dynamically, so listen on the tbody and identify the
  // target via data attributes rather than binding per-row listeners.
  document.getElementById("log-tbody").addEventListener("click", function (e) {
    var toggleBtn = e.target.closest(".toggle-status-btn");
    if (toggleBtn) {
      var isCurrentlyCompleted = toggleBtn.dataset.completed === "true";
      setCompleted(toggleBtn.dataset.username, toggleBtn.dataset.show, !isCurrentlyCompleted);
      renderTable();
      return;
    }

    var delBtn = e.target.closest(".delete-record-btn");
    if (delBtn) {
      var id = delBtn.dataset.recordId;
      if (!confirm("Delete this record?")) return;
      records = records.filter(function (r) { return r.id !== id; });
      saveRecords(records);
      refreshFilterOptions();
      renderTable();
    }
  });

  // ── Footer year ───────────────────────────────────────────────────────────
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── Initial render ────────────────────────────────────────────────────────
  renderRatingInput();
  refreshFilterOptions();
  renderTable();
}());
