/* ===================================================
   PES 2021 – Torneo Eliminación Directa
   app.js
   =================================================== */

// ── State ──────────────────────────────────────────
let players = [];        // { name, team }
let bracket = [];        // rounds[round][matchIndex] = { slots: [{...}], winner }
let tournamentSize = 0;  // next power-of-2 ≥ players.length

// ── Helpers ────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function initials(name) {
  return name.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function showError(msg) {
  const el = document.getElementById('msg-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Setup Screen ───────────────────────────────────
document.getElementById('input-player').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('input-team').focus(); });
document.getElementById('input-team').addEventListener('keydown',   e => { if (e.key === 'Enter') addPlayer(); });

function addPlayer() {
  const nameEl = document.getElementById('input-player');
  const teamEl = document.getElementById('input-team');
  const name   = nameEl.value.trim();
  const team   = teamEl.value.trim();

  if (!name) { showError('Ingresa el nombre del jugador.'); nameEl.focus(); return; }
  if (!team) { showError('Ingresa el equipo PES 2021.'); teamEl.focus(); return; }
  if (players.length >= 32) { showError('Máximo 32 participantes.'); return; }

  const dup = players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (dup) { showError(`"${name}" ya está en la lista.`); nameEl.focus(); return; }

  players.push({ name, team });
  nameEl.value = '';
  teamEl.value = '';
  nameEl.focus();
  renderPlayerList();
}

function removePlayer(index) {
  players.splice(index, 1);
  renderPlayerList();
}

function renderPlayerList() {
  const list = document.getElementById('players-list');
  const btn  = document.getElementById('btn-start');
  const count = document.getElementById('player-count');

  count.textContent = `${players.length} participante${players.length !== 1 ? 's' : ''}`;
  btn.disabled = players.length < 2;

  list.innerHTML = players.map((p, i) => `
    <div class="player-item">
      <span class="seed">#${i + 1}</span>
      <div class="info">
        <div class="name">${esc(p.name)}</div>
        <div class="team">⚽ ${esc(p.team)}</div>
      </div>
      <button onclick="removePlayer(${i})" title="Eliminar">✕</button>
    </div>
  `).join('');
}

function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Tournament Logic ───────────────────────────────
function startTournament() {
  if (players.length < 2) return;
  buildBracket(shuffle(players));
  showScreen('screen-bracket');
  renderBracket();
}

function reshuffleDraw() {
  buildBracket(shuffle(players));
  document.getElementById('champion-banner').classList.add('hidden');
  renderBracket();
}

function buildBracket(seeded) {
  tournamentSize = nextPow2(seeded.length);
  bracket = [];

  // Fill first round with players + BYEs
  const firstRound = [];
  for (let i = 0; i < tournamentSize / 2; i++) {
    const a = seeded[i * 2]     || null;
    const b = seeded[i * 2 + 1] || null;
    firstRound.push({ slots: [a, b], winner: null });
  }
  bracket.push(firstRound);

  // Auto-advance BYEs in round 1
  firstRound.forEach(match => {
    if (match.slots[0] && !match.slots[1]) match.winner = match.slots[0];
    if (!match.slots[0] && match.slots[1]) match.winner = match.slots[1];
  });

  // Build subsequent empty rounds
  let size = firstRound.length;
  while (size > 1) {
    size = Math.ceil(size / 2);
    const round = [];
    for (let i = 0; i < size; i++) round.push({ slots: [null, null], winner: null });
    bracket.push(round);
  }

  // Propagate auto-advance BYE winners
  propagateWinners();
}

function propagateWinners() {
  for (let r = 0; r < bracket.length - 1; r++) {
    bracket[r].forEach((match, mi) => {
      if (match.winner) {
        const nextMatchIdx = Math.floor(mi / 2);
        const slotIdx      = mi % 2;
        const nextMatch    = bracket[r + 1][nextMatchIdx];
        if (nextMatch) {
          nextMatch.slots[slotIdx] = match.winner;
          // auto-advance if other slot is BYE null
          if (nextMatch.slots[0] && !nextMatch.slots[1]) nextMatch.winner = nextMatch.slots[0];
          if (!nextMatch.slots[0] && nextMatch.slots[1]) nextMatch.winner = nextMatch.slots[1];
        }
      }
    });
  }
}

// ── Render Bracket ─────────────────────────────────
// Index 0 = closest to Final (used via fromEnd offset)
const ROUND_NAMES_FROM_END = ['Final', 'Semifinal', 'Cuartos', 'Octavos', 'Ronda 32', 'Ronda 64'];

function roundName(roundIndex, totalRounds) {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (roundIndex === 0) {
    const total = bracket[0].length * 2;
    if (total <= 4) return 'Semifinal';
    if (total === 8) return 'Cuartos de Final';
    return `Ronda de ${total}`;
  }
  return ROUND_NAMES_FROM_END[fromEnd] || `Ronda ${roundIndex + 1}`;
}

function renderBracket() {
  const container = document.getElementById('bracket-container');
  container.innerHTML = '';

  const totalRounds = bracket.length;

  document.getElementById('tournament-name').textContent =
    `${players.length} participantes · ${totalRounds} ronda${totalRounds > 1 ? 's' : ''}`;

  bracket.forEach((round, rIdx) => {
    const roundEl = document.createElement('div');
    roundEl.className = 'round';

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'round-title';
    titleEl.textContent = rIdx === totalRounds - 1 ? '🏆 Final' : roundName(rIdx, totalRounds);
    roundEl.appendChild(titleEl);

    round.forEach((match, mIdx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'match-wrapper';

      const matchEl = document.createElement('div');
      matchEl.className = 'match';

      // Label
      const labelEl = document.createElement('div');
      labelEl.className = 'match-label';
      labelEl.textContent = `Partido ${mIdx + 1}`;
      matchEl.appendChild(labelEl);

      match.slots.forEach((player, sIdx) => {
        const slot = buildSlot(player, match, sIdx, rIdx, mIdx);
        matchEl.appendChild(slot);
      });

      wrapper.appendChild(matchEl);
      roundEl.appendChild(wrapper);
    });

    container.appendChild(roundEl);
  });

  checkChampion();
}

function buildSlot(player, match, slotIdx, roundIdx, matchIdx) {
  const slot = document.createElement('div');
  slot.className = 'slot';

  if (!player) {
    slot.classList.add('empty');
    slot.innerHTML = `<div class="avatar">–</div><div class="slot-info"><div class="slot-name" style="color:var(--muted)">BYE</div></div>`;
    return slot;
  }

  const isBye   = match.slots.filter(Boolean).length === 1;
  const isWinner = match.winner === player;
  const isLoser  = match.winner && match.winner !== player;

  if (isBye) slot.classList.add('bye');
  if (isWinner) slot.classList.add('winner-bg');
  if (isLoser)  slot.classList.add('loser-bg');
  if (match.winner) slot.classList.add('winner-set');

  slot.innerHTML = `
    <div class="avatar">${esc(initials(player.name))}</div>
    <div class="slot-info">
      <div class="slot-name">${esc(player.name)}</div>
      <div class="slot-team">⚽ ${esc(player.team)}</div>
    </div>
    <span class="check">✓</span>
  `;

  if (!match.winner && !isBye && player) {
    slot.addEventListener('click', () => setWinner(roundIdx, matchIdx, slotIdx));
    slot.title = `Clic para avanzar a ${player.name}`;
  }

  return slot;
}

// ── Set Winner ─────────────────────────────────────
function setWinner(roundIdx, matchIdx, slotIdx) {
  const match = bracket[roundIdx][matchIdx];
  if (match.winner) return;

  const winner = match.slots[slotIdx];
  if (!winner) return;

  match.winner = winner;

  // Propagate to next round
  if (roundIdx + 1 < bracket.length) {
    const nextMatchIdx = Math.floor(matchIdx / 2);
    const nextSlotIdx  = matchIdx % 2;
    const nextMatch    = bracket[roundIdx + 1][nextMatchIdx];
    nextMatch.slots[nextSlotIdx] = winner;

    // If the other slot is a BYE, auto-advance
    const other = nextMatch.slots[1 - nextSlotIdx];
    if (!other) {
      nextMatch.winner = winner;
      propagateSingle(roundIdx + 1, nextMatchIdx, winner);
    }
  }

  renderBracket();
}

function propagateSingle(roundIdx, matchIdx, winner) {
  if (roundIdx + 1 >= bracket.length) return;
  const nextMatchIdx = Math.floor(matchIdx / 2);
  const nextSlotIdx  = matchIdx % 2;
  const nextMatch    = bracket[roundIdx + 1][nextMatchIdx];
  nextMatch.slots[nextSlotIdx] = winner;
  if (!nextMatch.slots[1 - nextSlotIdx]) {
    nextMatch.winner = winner;
    propagateSingle(roundIdx + 1, nextMatchIdx, winner);
  }
}

// ── Champion ───────────────────────────────────────
function checkChampion() {
  const finalMatch = bracket[bracket.length - 1][0];
  if (finalMatch && finalMatch.winner) {
    const champ = finalMatch.winner;
    document.getElementById('champion-name').textContent = champ.name;
    document.getElementById('champion-team').textContent = `⚽ ${champ.team}`;
    document.getElementById('champion-banner').classList.remove('hidden');
    document.getElementById('btn-reshuffle').disabled = true;
  } else {
    document.getElementById('btn-reshuffle').disabled = false;
  }
}

// ── Navigation ─────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goToSetup() {
  document.getElementById('champion-banner').classList.add('hidden');
  showScreen('screen-setup');
  renderPlayerList();
}
