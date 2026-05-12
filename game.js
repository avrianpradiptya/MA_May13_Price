// ════════════════════════════════════════════════════════
//  game.js — Price is Right Game Engine
//  All state lives here. index.html calls initGame(CONFIG).
// ════════════════════════════════════════════════════════

let STATE = {
  config:           null,
  currentRound:     0,         // 0-indexed
  scores:           [],        // one entry per player
  phase:            'faceoff', // 'faceoff' | 'minigame' | 'gameover'
  winnerIndex:      null,      // which player won the face-off
  roundPoints:      0,         // points at stake this round (tiered)
};

// ─── TIERED SCORING ────────────────────────────────────
// Deviation = |guess - actual| / actual  (as a percentage)
// Edit these thresholds freely.
const SCORE_TIERS = [
  { maxDeviation:  10, points: 100, label: '🔥 Within 10%!'  },
  { maxDeviation:  25, points:  75, label: '👍 Within 25%'   },
  { maxDeviation: Infinity, points: 50, label: '📉 More than 25% off' },
];

// Returns { points, label, deviationPct } for a given guess vs actual
function calcTieredScore(guess, actual) {
  const deviationPct = (Math.abs(guess - actual) / actual) * 100;
  const tier = SCORE_TIERS.find(t => deviationPct <= t.maxDeviation);
  return { points: tier.points, label: tier.label, deviationPct };
}

// ─── ENTRY POINT ───────────────────────────────────────
function initGame(config) {
  STATE.config       = config;
  STATE.currentRound = 0;
  STATE.scores       = config.PLAYER_NAMES.map(() => 0);
  STATE.phase        = 'faceoff';

  // Clamp actual round count to available ROUNDS array length
  config.TOTAL_ROUNDS = Math.min(config.TOTAL_ROUNDS, config.ROUNDS.length);

  buildPlayerPanel();
  updateHeader();
  loadRound();
  listenForMinigameResult();
}

// ─── BUILD UI ──────────────────────────────────────────
function buildPlayerPanel() {
  const panel  = document.getElementById('player-panel');
  const btn    = document.getElementById('confirm-btn');

  // Remove any previous player columns (but keep the button)
  panel.querySelectorAll('.player-col').forEach(el => el.remove());

  STATE.config.PLAYER_NAMES.forEach((name, i) => {
    const col = document.createElement('div');
    col.className  = 'player-col';
    col.dataset.idx = i;

    col.innerHTML = `
      <div class="score-chip" id="score-chip-${i}">00</div>
      <div class="player-card" id="player-card-${i}">
        <div class="player-name">${name}</div>
        <input
          type="number"
          id="guess-input-${i}"
          placeholder="Your guess?"
          min="0"
          step="500"
          aria-label="${name} price guess"
        />
      </div>
    `;

    panel.insertBefore(col, btn);
  });
}

// ─── ROUND MANAGEMENT ──────────────────────────────────
function updateHeader() {
  document.getElementById('current-round').textContent = STATE.currentRound + 1;
  document.getElementById('total-rounds').textContent  = STATE.config.TOTAL_ROUNDS;
}

function loadRound() {
  const round = STATE.config.ROUNDS[STATE.currentRound];

  // Show product image
  const img         = document.getElementById('product-img');
  const placeholder = document.getElementById('product-placeholder');
  const badge       = document.getElementById('actual-price-badge');

  if (round.image) {
    img.src          = round.image;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
  }
  badge.style.display = 'none';

  // Clear inputs
  STATE.config.PLAYER_NAMES.forEach((_, i) => {
    const input = document.getElementById(`guess-input-${i}`);
    if (input) { input.value = ''; input.disabled = false; }
    document.getElementById(`player-card-${i}`)?.classList.remove('winner-flash');
    document.getElementById(`score-chip-${i}`)?.classList.remove('highlight');
  });

  document.getElementById('confirm-btn').disabled = false;
  hideResultOverlay();
  STATE.phase = 'faceoff';
}

// ─── CONFIRM GUESSES (called by button) ────────────────
function confirmGuesses() {
  const round = STATE.config.ROUNDS[STATE.currentRound];

  // Collect guesses — null if blank
  const guesses = STATE.config.PLAYER_NAMES.map((_, i) => {
    const val = parseFloat(document.getElementById(`guess-input-${i}`).value);
    return isNaN(val) ? null : val;
  });

  // ── DUPLICATE GUARD ──────────────────────────────────
  // Build a map: value → [list of player names with that value]
  const valueBuckets = {};
  guesses.forEach((g, i) => {
    if (g === null) return;
    const key = g;
    if (!valueBuckets[key]) valueBuckets[key] = [];
    valueBuckets[key].push(STATE.config.PLAYER_NAMES[i]);
  });

  const dupeGroups = Object.values(valueBuckets).filter(names => names.length > 1);
  if (dupeGroups.length > 0) {
    const dupeMsg = dupeGroups
      .map(names => names.join(' & '))
      .join('; ');
    showToast(`⚠️ Duplicate guesses: ${dupeMsg} — each group needs a unique value!`, 'lose');

    // Shake the colliding input fields
    guesses.forEach((g, i) => {
      if (g !== null && valueBuckets[g].length > 1) {
        const card = document.getElementById(`player-card-${i}`);
        card?.classList.remove('dupe-shake');
        void card?.offsetWidth; // reflow to restart animation
        card?.classList.add('dupe-shake');
      }
    });
    return; // block confirmation
  }

  // ── FIND CLOSEST GUESS ───────────────────────────────
  const actual = round.actualPrice;
  let bestDiff  = Infinity;
  let winnerIdx = -1;

  guesses.forEach((g, i) => {
    if (g === null) return;
    const diff = Math.abs(g - actual);
    if (diff < bestDiff) { bestDiff = diff; winnerIdx = i; }
  });

  // If everyone left blank, skip
  if (winnerIdx === -1) {
    showToast('No guesses entered — skipping round!', 'lose');
    setTimeout(advanceRound, 2000);
    return;
  }

  // ── CALCULATE TIERED POINTS ──────────────────────────
  const { points, label, deviationPct } = calcTieredScore(guesses[winnerIdx], actual);
  STATE.roundPoints = points;

  // Disable inputs
  STATE.config.PLAYER_NAMES.forEach((_, i) => {
    document.getElementById(`guess-input-${i}`).disabled = true;
  });
  document.getElementById('confirm-btn').disabled = true;

  // Show actual price
  const badge = document.getElementById('actual-price-badge');
  document.getElementById('actual-price-text').textContent = formatPrice(actual);
  badge.style.display = 'block';

  // Highlight winning player card
  document.getElementById(`player-card-${winnerIdx}`)?.classList.add('winner-flash');

  STATE.winnerIndex = winnerIdx;
  showResultOverlay(winnerIdx, deviationPct, label);
}

// ─── RESULT OVERLAY ────────────────────────────────────
function showResultOverlay(winnerIdx, deviationPct, tierLabel) {
  const name = STATE.config.PLAYER_NAMES[winnerIdx];
  document.getElementById('result-winner-name').textContent = `🎉 ${name} wins the face-off!`;
  document.getElementById('result-desc').textContent =
    `${name}'s guess is closest — ${tierLabel} (${deviationPct.toFixed(1)}% off)`;
  document.getElementById('result-points').textContent = STATE.roundPoints;
  document.getElementById('result-overlay').classList.add('active');
}

function hideResultOverlay() {
  document.getElementById('result-overlay').classList.remove('active');
}

// ─── LAUNCH MINIGAME ───────────────────────────────────
function startMinigame() {
  hideResultOverlay();
  const round = STATE.config.ROUNDS[STATE.currentRound];
  const src   = `minigames/${round.minigame}`;

  const overlay = document.getElementById('minigame-overlay');
  const frame   = document.getElementById('minigame-frame');

  frame.src = src;
  overlay.classList.add('active');
  STATE.phase = 'minigame';
}

// ─── LISTEN FOR MINIGAME RESULT (postMessage) ──────────
function listenForMinigameResult() {
  window.addEventListener('message', (event) => {
    if (STATE.phase !== 'minigame') return;
    if (typeof event.data?.result !== 'boolean') return;

    const won = event.data.result;

    // Close iframe
    const overlay = document.getElementById('minigame-overlay');
    const frame   = document.getElementById('minigame-frame');
    overlay.classList.remove('active');
    frame.src = '';

    if (won) {
      // Award tiered points
      STATE.scores[STATE.winnerIndex] += STATE.roundPoints;
      updateScoreDisplay(STATE.winnerIndex);
      showToast(`🎉 +${STATE.roundPoints} points for ${STATE.config.PLAYER_NAMES[STATE.winnerIndex]}!`, 'win');
      spawnConfetti();
    } else {
      showToast(`❌ No points this round. Better luck next time!`, 'lose');
    }

    // Advance after short pause
    setTimeout(advanceRound, 2400);
  });
}

// ─── ADVANCE TO NEXT ROUND / END GAME ──────────────────
function advanceRound() {
  STATE.currentRound++;

  if (STATE.currentRound >= STATE.config.TOTAL_ROUNDS) {
    showWinnerScreen();
    return;
  }

  updateHeader();
  loadRound();
}

// ─── SCORE DISPLAY ─────────────────────────────────────
function updateScoreDisplay(idx) {
  const chip = document.getElementById(`score-chip-${idx}`);
  if (!chip) return;
  chip.textContent = STATE.scores[idx];
  chip.classList.add('highlight');
}

// ─── WINNER SCREEN ─────────────────────────────────────
function showWinnerScreen() {
  // Find top score(s)
  const maxScore = Math.max(...STATE.scores);
  const winners  = STATE.config.PLAYER_NAMES.filter((_, i) => STATE.scores[i] === maxScore);

  document.getElementById('winner-name-display').textContent =
    winners.length === 1
      ? `🥇 ${winners[0]} Wins!`
      : `🤝 Tie: ${winners.join(' & ')}!`;

  const finalScores = document.getElementById('final-scores');
  finalScores.innerHTML = STATE.config.PLAYER_NAMES.map((name, i) => `
    <div class="final-score-card">
      <div class="name">${name}</div>
      <div class="score">${STATE.scores[i]}</div>
    </div>
  `).join('');

  document.getElementById('winner-screen').classList.add('active');
  spawnConfetti(80);
}

// ─── RESET GAME ────────────────────────────────────────
function resetGame() {
  document.getElementById('winner-screen').classList.remove('active');
  initGame(STATE.config);
}

// ─── HELPERS ───────────────────────────────────────────
function formatPrice(n) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = type;   // 'win' or 'lose'

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = ''; }, 2200);
}

function spawnConfetti(count = 40) {
  const colors = ['#fdd835','#29b6f6','#fb8c00','#43a047','#e53935','#fff'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left            = Math.random() * 100 + 'vw';
    el.style.background      = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    el.style.animationDelay  = (Math.random() * 0.8) + 's';
    el.style.width           = (8 + Math.random() * 10) + 'px';
    el.style.height          = (8 + Math.random() * 10) + 'px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}
