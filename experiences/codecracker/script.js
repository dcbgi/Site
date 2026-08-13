/**
 * CodeCracker – game logic
 *
 * Rules:
 *  - 6 colours available, 4-peg secret code (duplicates allowed)
 *  - Player has 7 attempts
 *  - Feedback per attempt:
 *      green dot  = correct colour AND correct position
 *      yellow dot = correct colour but wrong position
 */

// Ordered as a rainbow so adjacent swatches in the palette read as distinct
// hues at a glance — the previous red/pink pairing was hard to tell apart.
const COLORS = [
  { id: 'red',    label: 'Red',    hex: '#ff3b30' },
  { id: 'orange', label: 'Orange', hex: '#ff9500' },
  { id: 'yellow', label: 'Yellow', hex: '#ffd60a' },
  { id: 'green',  label: 'Green',  hex: '#30d158' },
  { id: 'blue',   label: 'Blue',   hex: '#0a84ff' },
  { id: 'purple', label: 'Purple', hex: '#bf5af2' },
];

const MAX_ATTEMPTS = 7;
const CODE_LENGTH  = 4;

// ── State ────────────────────────────────────────────────────
let secretCode      = [];
let currentAttempt  = 0;
let currentSlot     = 0;
let currentGuess    = [];
let selectedColor   = null;
let gameOver        = false;

// ── DOM refs ─────────────────────────────────────────────────
const board          = document.getElementById('board');
const palette        = document.getElementById('palette');
const btnSubmit      = document.getElementById('btn-submit');
const btnClear       = document.getElementById('btn-clear');
const btnNewGame     = document.getElementById('btn-new-game');
const messageEl      = document.getElementById('message');
const secretReveal   = document.getElementById('secret-reveal');
const secretPegsEl   = document.getElementById('secret-pegs');

// ── Helpers ──────────────────────────────────────────────────

function generateCode() {
  return Array.from({ length: CODE_LENGTH }, () =>
    COLORS[Math.floor(Math.random() * COLORS.length)].id
  );
}

function hexFor(id) {
  return (COLORS.find(c => c.id === id) || {}).hex || 'var(--surface)';
}

function computeFeedback(guess, secret) {
  let correctPos   = 0;
  let correctColor = 0;

  const remainingSecret = [];
  const remainingGuess  = [];

  for (let i = 0; i < CODE_LENGTH; i++) {
    if (guess[i] === secret[i]) {
      correctPos++;
    } else {
      remainingSecret.push(secret[i]);
      remainingGuess.push(guess[i]);
    }
  }

  for (const color of remainingGuess) {
    const idx = remainingSecret.indexOf(color);
    if (idx !== -1) {
      correctColor++;
      remainingSecret.splice(idx, 1);
    }
  }

  return { correctPos, correctColor };
}

// ── Board rendering ──────────────────────────────────────────

function buildBoard() {
  board.innerHTML = '';
  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    const row = document.createElement('div');
    row.className = 'attempt-row';
    row.id = `row-${r}`;

    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = r + 1;

    const pegs = document.createElement('div');
    pegs.className = 'pegs';

    for (let c = 0; c < CODE_LENGTH; c++) {
      const peg = document.createElement('div');
      peg.className = 'peg';
      peg.id = `peg-${r}-${c}`;
      peg.setAttribute('aria-label', `Row ${r + 1}, slot ${c + 1}`);
      peg.addEventListener('click', () => handlePegClick(r, c));
      pegs.appendChild(peg);
    }

    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.id = `feedback-${r}`;

    for (let f = 0; f < CODE_LENGTH; f++) {
      const fb = document.createElement('div');
      fb.className = 'fb-peg';
      fb.id = `fb-${r}-${f}`;
      feedback.appendChild(fb);
    }

    row.append(label, pegs, feedback);
    board.appendChild(row);
  }

  highlightActiveRow();
}

function buildPalette() {
  palette.innerHTML = '';
  for (const color of COLORS) {
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.id = `color-${color.id}`;
    btn.style.background = color.hex;
    btn.setAttribute('aria-label', color.label);
    btn.title = color.label;
    btn.addEventListener('click', () => selectColor(color.id));
    palette.appendChild(btn);
  }
}

function highlightActiveRow() {
  document.querySelectorAll('.peg').forEach(p => p.classList.remove('active-slot'));
  if (gameOver) return;
  const peg = document.getElementById(`peg-${currentAttempt}-${currentSlot}`);
  if (peg) peg.classList.add('active-slot');
}

// ── User interactions ────────────────────────────────────────

function selectColor(colorId) {
  if (gameOver) return;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  selectedColor = colorId;
  const btn = document.getElementById(`color-${colorId}`);
  if (btn) btn.classList.add('selected');
  placeColorInSlot(currentAttempt, currentSlot, colorId);
}

function placeColorInSlot(row, col, colorId) {
  if (row !== currentAttempt || gameOver) return;
  currentGuess[col] = colorId;
  const peg = document.getElementById(`peg-${row}-${col}`);
  if (peg) {
    peg.style.background = hexFor(colorId);
    peg.classList.add('filled');
  }
  advanceSlot();
}

function handlePegClick(row, col) {
  if (row !== currentAttempt || gameOver) return;
  if (selectedColor) {
    currentGuess[col] = selectedColor;
    const peg = document.getElementById(`peg-${row}-${col}`);
    if (peg) {
      peg.style.background = hexFor(selectedColor);
      peg.classList.add('filled');
    }
    currentSlot = col;
    advanceSlot();
  }
}

function advanceSlot() {
  let next = -1;
  for (let c = 0; c < CODE_LENGTH; c++) {
    if (!currentGuess[c]) { next = c; break; }
  }
  currentSlot = next === -1 ? CODE_LENGTH - 1 : next;
  highlightActiveRow();
  btnSubmit.disabled = currentGuess.filter(Boolean).length < CODE_LENGTH;
}

function clearCurrentRow() {
  if (gameOver) return;
  currentGuess = [];
  currentSlot  = 0;
  for (let c = 0; c < CODE_LENGTH; c++) {
    const peg = document.getElementById(`peg-${currentAttempt}-${c}`);
    if (peg) { peg.style.background = ''; peg.classList.remove('filled'); }
  }
  btnSubmit.disabled = true;
  highlightActiveRow();
}

function submitGuess() {
  if (currentGuess.filter(Boolean).length < CODE_LENGTH || gameOver) return;

  const guess    = [...currentGuess];
  const feedback = computeFeedback(guess, secretCode);
  renderFeedback(currentAttempt, feedback);

  if (feedback.correctPos === CODE_LENGTH) { endGame(true); return; }

  currentAttempt++;
  currentGuess = [];
  currentSlot  = 0;
  btnSubmit.disabled = true;

  if (currentAttempt >= MAX_ATTEMPTS) {
    endGame(false);
  } else {
    highlightActiveRow();
    messageEl.className = '';
    messageEl.textContent = `Attempt ${currentAttempt + 1} of ${MAX_ATTEMPTS}`;
  }
}

function renderFeedback(row, { correctPos, correctColor }) {
  const dots = [
    ...Array(correctPos).fill('correct-pos'),
    ...Array(correctColor).fill('correct-color'),
    ...Array(CODE_LENGTH - correctPos - correctColor).fill(''),
  ];
  for (let f = 0; f < CODE_LENGTH; f++) {
    const fb = document.getElementById(`fb-${row}-${f}`);
    if (fb && dots[f]) fb.classList.add(dots[f]);
  }
}

// ── End-game ────────────────────────────────────────────────

function endGame(won) {
  gameOver = true;
  btnSubmit.disabled = true;
  btnClear.disabled  = true;
  document.querySelectorAll('.peg').forEach(p => p.classList.remove('active-slot'));

  if (won) {
    messageEl.className  = 'win';
    messageEl.textContent = `🎉 You cracked the code in ${currentAttempt + 1} attempt${currentAttempt + 1 !== 1 ? 's' : ''}!`;
  } else {
    messageEl.className  = 'lose';
    messageEl.textContent = '😢 Out of attempts! The secret code was:';
  }
  revealSecret();
}

function revealSecret() {
  secretPegsEl.innerHTML = '';
  for (const id of secretCode) {
    const peg = document.createElement('div');
    peg.className = 'secret-peg';
    peg.style.background = hexFor(id);
    secretPegsEl.appendChild(peg);
  }
  secretReveal.classList.add('visible');
}

// ── New game ─────────────────────────────────────────────────

function newGame() {
  secretCode     = generateCode();
  currentAttempt = 0;
  currentSlot    = 0;
  currentGuess   = [];
  selectedColor  = null;
  gameOver       = false;

  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  secretReveal.classList.remove('visible');
  secretPegsEl.innerHTML = '';

  messageEl.className  = '';
  messageEl.textContent = `Attempt 1 of ${MAX_ATTEMPTS}`;

  btnSubmit.disabled = true;
  btnClear.disabled  = false;

  buildBoard();
}

// ── Footer year ──────────────────────────────────────────────
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Bootstrap ────────────────────────────────────────────────
buildPalette();
newGame();

btnSubmit.addEventListener('click', submitGuess);
btnClear.addEventListener('click', clearCurrentRow);
btnNewGame.addEventListener('click', newGame);
