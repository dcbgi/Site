// ── Immediately-invoked function expression (IIFE) ────────────────────────
// Wrapping all code in an IIFE creates a private scope so no variables leak
// into the global `window` object, preventing accidental name collisions.
(function () {
  "use strict"; // Enable strict mode for safer JavaScript (disallows undeclared vars etc.)

  // ── Storage key ───────────────────────────────────────────────────────────
  // All watch records are persisted as a JSON string under this localStorage
  // key. This is a new, flat data model (one row per watch) — a different key
  // from the old per-show/episode model so existing stored data is never
  // misread as the new shape.
  var STORAGE_KEY = "tvtracker_records";

  // ── loadRecords ───────────────────────────────────────────────────────────
  // Reads and parses the records array from localStorage.
  // Returns an empty array if the key doesn't exist yet or if the stored
  // value is corrupt/unparseable JSON.
  function loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  // ── saveRecords ───────────────────────────────────────────────────────────
  // Serialises the current records array to JSON and writes it to localStorage.
  function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  // ── Application state ─────────────────────────────────────────────────────
  var records = loadRecords(); // Master array of watch-record objects

  // Active column filters. Empty string means "no filter on this column".
  // username/show/season/episode are matched by exact value (picked from a
  // dropdown of values that actually exist in the data); notes is matched by
  // case-insensitive substring search.
  var filters = { username: "", show: "", season: "", episode: "", notes: "" };

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
  // Rebuilds all four dropdown filters from the full record set. Called
  // whenever the underlying data changes (add/delete), not on every filter
  // interaction, so selections aren't reset while the user is filtering.
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
    return true;
  }

  // ── recordRowHtml ─────────────────────────────────────────────────────────
  function recordRowHtml(r) {
    return (
      '<tr data-record-id="' + esc(r.id) + '">' +
        '<td data-label="Username"><span class="cell-username">' + esc(r.username) + "</span></td>" +
        '<td data-label="Show">' + esc(r.show) + "</td>" +
        '<td data-label="Season"><span class="cell-pill">S' + esc(r.season) + "</span></td>" +
        '<td data-label="Episode"><span class="cell-pill">E' + esc(r.episode) + "</span></td>" +
        '<td data-label="Notes">' +
          (r.notes
            ? '<span class="cell-notes" title="' + esc(r.notes) + '">' + esc(r.notes) + "</span>"
            : '<span class="cell-notes cell-notes-empty">—</span>') +
        "</td>" +
        '<td data-label="Logged"><span class="cell-date">' + fmtDate(r.loggedAt) + "</span></td>" +
        '<td class="col-actions" data-label="">' +
          '<button class="btn btn-danger btn-sm delete-record-btn" data-record-id="' + esc(r.id) + '" aria-label="Delete this record">✕</button>' +
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

    // Required fields: username, show, season, episode. Notes stays optional.
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
      notes:    notes, // Empty string if left blank
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
    showEl.focus();
  });

  // ── Filter interactions ───────────────────────────────────────────────────
  ["username", "show", "season", "episode"].forEach(function (field) {
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
    filters = { username: "", show: "", season: "", episode: "", notes: "" };
    document.getElementById("filter-username").value = "";
    document.getElementById("filter-show").value = "";
    document.getElementById("filter-season").value = "";
    document.getElementById("filter-episode").value = "";
    document.getElementById("filter-notes").value = "";
    renderTable();
  });

  // ── Delete record ─────────────────────────────────────────────────────────
  // Event delegation: rows are rendered dynamically, so listen on the tbody
  // and identify the target row's record id from its data attribute.
  document.getElementById("log-tbody").addEventListener("click", function (e) {
    var delBtn = e.target.closest(".delete-record-btn");
    if (!delBtn) return;
    var id = delBtn.dataset.recordId;
    if (!confirm("Delete this record?")) return;
    records = records.filter(function (r) { return r.id !== id; });
    saveRecords(records);
    refreshFilterOptions();
    renderTable();
  });

  // ── Footer year ───────────────────────────────────────────────────────────
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── Initial render ────────────────────────────────────────────────────────
  refreshFilterOptions();
  renderTable();
}());
