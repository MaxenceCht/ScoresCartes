/* ============================================
   Belote — logique
   ============================================ */

const STORAGE_KEY = 'belote-state-v1';

let state = {
  rounds: [],
  totalA: 0,
  totalB: 0,
  pendingLitige: null,   // 'a' | 'b' | null — équipe dont les 81 pts sont en attente
  nameA: 'Nous',
  nameB: 'Eux',
  target: 1000
};

let draft = {
  taker: null,       // 'a' | 'b' — qui a pris
  who: 'a',          // équipe dont on saisit les points
  pts: 81,
  capot: false,
  capotTeam: null,
  belote: null,
};

// ---------- Persistance ----------
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) {}
}

function names() { return { a: state.nameA || 'Nous', b: state.nameB || 'Eux' }; }

// ---------- Navigation écrans ----------
function showScreen(s) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById('screen-' + s).classList.add('active');
  window.scrollTo(0, 0);
  if (s === 'scores') renderScores();
  if (s === 'end') renderEnd();
}

// ---------- Sélections ----------
function selectTaker(t) {
  draft.taker = t;
  const n = names();
  document.getElementById('taker-a').className = 'seg' + (t === 'a' ? ' on' : '');
  document.getElementById('taker-a').textContent = n.a;
  document.getElementById('taker-b').className = 'seg' + (t === 'b' ? ' on' : '');
  document.getElementById('taker-b').textContent = n.b;
  refreshPreview();
}

function onCapotChange() {
  draft.capot = document.getElementById('chk-capot').checked;
  draft.capotTeam = null;
  const n = names();
  document.getElementById('capot-a').className = 'seg';
  document.getElementById('capot-a').textContent = n.a;
  document.getElementById('capot-b').className = 'seg';
  document.getElementById('capot-b').textContent = n.b;
  document.getElementById('capot-block').style.display = draft.capot ? 'block' : 'none';
  document.getElementById('normal-block').style.display = draft.capot ? 'none' : 'block';
  refreshPreview();
}

function selectCapot(t) {
  draft.capotTeam = t;
  const n = names();
  document.getElementById('capot-a').className = 'seg' + (t === 'a' ? ' on' : '');
  document.getElementById('capot-a').textContent = n.a;
  document.getElementById('capot-b').className = 'seg' + (t === 'b' ? ' on' : '');
  document.getElementById('capot-b').textContent = n.b;
  refreshPreview();
}

function selectWho(t) {
  draft.who = t;
  const n = names();
  document.getElementById('who-a').className = 'seg' + (t === 'a' ? ' on' : '');
  document.getElementById('who-a').textContent = n.a;
  document.getElementById('who-b').className = 'seg' + (t === 'b' ? ' on' : '');
  document.getElementById('who-b').textContent = n.b;
  document.getElementById('derived-team').textContent = n[t === 'a' ? 'b' : 'a'];
  refreshPreview();
}

function selectBelote(t) {
  draft.belote = t;
  const n = names();
  document.getElementById('bel-none').className = 'seg' + (t === null ? ' on' : '');
  document.getElementById('bel-a').className = 'seg' + (t === 'a' ? ' on' : '');
  document.getElementById('bel-a').textContent = n.a;
  document.getElementById('bel-b').className = 'seg' + (t === 'b' ? ' on' : '');
  document.getElementById('bel-b').textContent = n.b;
  refreshPreview();
}

// ---------- Saisie points ----------
function setPts(v) {
  draft.pts = Math.max(0, Math.min(162, Math.round(v)));
  document.getElementById('pts-value').textContent = draft.pts;
  document.getElementById('pts-range').value = draft.pts;
  document.getElementById('pts-range').style.setProperty('--fill', (draft.pts / 162 * 100) + '%');
  const n = names();
  document.getElementById('derived-val').textContent = 162 - draft.pts;
  document.getElementById('derived-team').textContent = n[draft.who === 'a' ? 'b' : 'a'];
  refreshPreview();
}
function bumpPts(d) { setPts(draft.pts + d); }
function onRange(v) { setPts(v); }

// ---------- Calcul d'une donne ----------
function compute() {
  const n = names();
  const ba = draft.belote === 'a' ? 20 : 0;
  const bb = draft.belote === 'b' ? 20 : 0;

  // --- Capot ---
  if (draft.capot) {
    if (!draft.capotTeam) return null;
    let rA = (draft.capotTeam === 'a' ? 250 : 0) + ba;
    let rB = (draft.capotTeam === 'b' ? 250 : 0) + bb;
    let note = 'Capot ' + n[draft.capotTeam];
    if (state.pendingLitige !== null) {
      if (draft.capotTeam === 'a') rA += 81; else rB += 81;
      note += ' + litige';
    }
    return { roundA: rA, roundB: rB, note, isLitige: false, isDedans: false, isCapotRound: true, label: 'Capot' };
  }

  // --- Normal ---
  if (!draft.taker) return null;

  const pts = { a: 0, b: 0 };
  pts[draft.who] = draft.pts;
  pts[draft.who === 'a' ? 'b' : 'a'] = 162 - draft.pts;

  const eff = { a: pts.a + ba, b: pts.b + bb };
  const taker = draft.taker;
  const def = taker === 'a' ? 'b' : 'a';

  // --- Litige : scores effectifs égaux ---
  if (eff.a === eff.b) {
    // Le défenseur (non-preneur) reçoit 81 pts ; les 81 du preneur restent en attente
    let rA = (def === 'a' ? 81 : 0) + ba;
    let rB = (def === 'b' ? 81 : 0) + bb;
    return {
      roundA: rA, roundB: rB,
      note: 'Litige — 81 en attente',
      isLitige: true, isDedans: false, isCapotRound: false,
      label: 'Litige', takerTeam: taker
    };
  }

  // --- Dedans : le preneur fait strictement moins que le défenseur ---
  if (eff[taker] < eff[def]) {
    let rA = (def === 'a' ? 162 : 0) + ba;
    let rB = (def === 'b' ? 162 : 0) + bb;
    let note = n[taker] + ' dedans';
    if (state.pendingLitige !== null) {
      if (def === 'a') rA += 81; else rB += 81;
      note += ' + litige';
    }
    return { roundA: rA, roundB: rB, note, isLitige: false, isDedans: true, isCapotRound: false, label: n[taker] + ' dedans' };
  }

  // --- Victoire normale du preneur ---
  let rA = pts.a + ba;
  let rB = pts.b + bb;
  let note = '';
  if (state.pendingLitige !== null) {
    const winner = eff.a > eff.b ? 'a' : 'b';
    if (winner === 'a') rA += 81; else rB += 81;
    note = '+81 litige';
  }
  return { roundA: rA, roundB: rB, note, isLitige: false, isDedans: false, isCapotRound: false, label: n[eff.a > eff.b ? 'a' : 'b'] };
}

// ---------- Aperçu ----------
function refreshPreview() {
  const n = names();
  document.getElementById('pl-a').textContent = n.a;
  document.getElementById('pl-b').textContent = n.b;

  const res = compute();
  const stateEl = document.getElementById('preview-state');
  if (!res) {
    stateEl.textContent = '—';
    stateEl.style.color = 'var(--muted)';
    document.getElementById('pd-a').textContent = '—';
    document.getElementById('pd-b').textContent = '—';
    renderMiniHistory();
    return;
  }

  const stateLabel = res.isCapotRound ? 'Capot' : res.isLitige ? 'Litige' : res.isDedans ? 'Dedans' : 'Manche';
  stateEl.textContent = stateLabel;
  stateEl.style.color = res.isLitige ? 'var(--gold)' : res.isDedans ? 'var(--bad)' : 'var(--ok)';
  setDelta('pd-a', res.roundA);
  setDelta('pd-b', res.roundB);
  renderMiniHistory();
}

function setDelta(id, v) {
  const el = document.getElementById(id);
  el.textContent = '+' + v;
  el.className = 'preview-delta ' + (v > 0 ? 'delta-pos' : 'delta-zero');
}

function renderMiniHistory() {
  const el = document.getElementById('mini-history');
  if (!el) return;
  if (state.rounds.length === 0) { el.innerHTML = ''; return; }
  const n = names();
  const rows = [...state.rounds].reverse().map((r, ri) => {
    const i = state.rounds.length - 1 - ri;
    const tag = r.isCapotRound ? '🃏 ' : r.isLitige ? '⚖️ ' : '';
    const chipA = `<span class="histo-chip ${r.roundA > 0 ? 'delta-pos' : 'delta-zero'}">+${r.roundA}</span>`;
    const chipB = `<span class="histo-chip ${r.roundB > 0 ? 'delta-pos' : 'delta-zero'}">+${r.roundB}</span>`;
    return `<div class="histo-item">
      <span class="histo-n">${i + 1}</span>
      <div class="histo-body">
        <div class="histo-head">${tag}${esc(r.label || '')}</div>
        ${r.note ? `<div class="histo-sub">${esc(r.note)}</div>` : ''}
      </div>
      <div class="histo-chips">${chipA}${chipB}</div>
    </div>`;
  }).join('');
  el.innerHTML =
    `<div style="border-top:1px solid #E5DCC8;margin:12px 0 8px;"></div>` +
    `<div class="kicker" style="margin-bottom:6px;">Donnes précédentes</div>` +
    rows +
    `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 4px 2px;border-top:1px solid #E5DCC8;margin-top:4px;">` +
    `<span style="font-size:13px;font-weight:700;color:var(--ink-soft);">${esc(n.a)}</span>` +
    `<span style="font-size:16px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;">${state.totalA}</span>` +
    `<span style="font-size:13px;font-weight:700;color:var(--ink-soft);">${esc(n.b)}</span>` +
    `<span style="font-size:16px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;">${state.totalB}</span>` +
    `</div>`;
}

// ---------- Validation ----------
function validateRound() {
  const err = document.getElementById('err');
  err.textContent = '';

  const res = compute();
  if (!res) {
    if (draft.capot) err.textContent = "Désigne l'équipe qui fait capot.";
    else if (!draft.taker) err.textContent = "Désigne l'équipe qui a pris.";
    else err.textContent = 'Saisie incomplète.';
    return;
  }

  state.totalA += res.roundA;
  state.totalB += res.roundB;

  if (res.isLitige) {
    state.pendingLitige = res.takerTeam;
  } else {
    state.pendingLitige = null;
  }

  state.rounds.push({
    roundA: res.roundA, roundB: res.roundB,
    totalA: state.totalA, totalB: state.totalB,
    note: res.note, isLitige: res.isLitige,
    isCapotRound: res.isCapotRound, label: res.label
  });

  save();
  showScreen('scores');
}

// ---------- Nouvelle donne ----------
function newRound() {
  draft = { taker: null, who: 'a', pts: 81, capot: false, capotTeam: null, belote: null };

  const n = names();
  document.getElementById('taker-a').className = 'seg';
  document.getElementById('taker-a').textContent = n.a;
  document.getElementById('taker-b').className = 'seg';
  document.getElementById('taker-b').textContent = n.b;

  document.getElementById('chk-capot').checked = false;
  document.getElementById('capot-block').style.display = 'none';
  document.getElementById('normal-block').style.display = 'block';
  document.getElementById('capot-a').className = 'seg';
  document.getElementById('capot-b').className = 'seg';

  selectWho('a');
  selectBelote(null);
  setPts(81);

  document.getElementById('err').textContent = '';
  document.getElementById('pending-litige-banner').style.display = state.pendingLitige !== null ? 'block' : 'none';
  document.getElementById('round-no').textContent = 'Donne n°' + (state.rounds.length + 1);
  showScreen('round');
}

// ---------- Rendu scores ----------
function renderScores() {
  const n = names();
  const lead = state.totalA === state.totalB ? null : (state.totalA > state.totalB ? 'a' : 'b');
  const max = Math.max(state.totalA, state.totalB, 1);
  const data = [
    { key: 'a', name: n.a, score: state.totalA },
    { key: 'b', name: n.b, score: state.totalB }
  ].sort((x, y) => y.score - x.score);

  document.getElementById('standings').innerHTML = data.map((d, i) => {
    const isLead = lead === d.key;
    return `<div class="standing">
      <span class="rank ${isLead ? 'leader' : ''}">${i + 1}</span>
      <div class="standing-body">
        <div class="standing-top">
          <span class="standing-name">${esc(d.name)}</span>
          <span class="standing-score">${d.score}</span>
        </div>
        <div class="bar"><div class="bar-fill ${isLead ? 'leader' : ''}" style="width:${Math.round(d.score / max * 100)}%"></div></div>
      </div>
    </div>`;
  }).join('');

  const hist = document.getElementById('history');
  const empty = document.getElementById('history-empty');
  if (state.rounds.length === 0) {
    hist.innerHTML = ''; empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    hist.innerHTML = [...state.rounds].reverse().map((r, ri) => {
      const i = state.rounds.length - 1 - ri;
      const tag = r.isCapotRound ? '🃏 ' : r.isLitige ? '⚖️ ' : '';
      return `<div class="histo-item">
        <span class="histo-n">${i + 1}</span>
        <div class="histo-body">
          <div class="histo-head">${tag}${esc(r.label || '')}</div>
          <div class="histo-sub">${esc(r.note || '')}</div>
        </div>
        <div class="histo-chips">
          <span class="histo-chip ${r.roundA > 0 ? 'delta-pos' : 'delta-zero'}">+${r.roundA}</span>
          <span class="histo-chip ${r.roundB > 0 ? 'delta-pos' : 'delta-zero'}">+${r.roundB}</span>
        </div>
      </div>`;
    }).join('');
  }

  const reached = state.target > 0 && (state.totalA >= state.target || state.totalB >= state.target);
  document.getElementById('banner-win').style.display = reached ? 'flex' : 'none';
}

function goEnd() { showScreen('end'); }

function renderEnd() {
  const n = names();
  const data = [
    { name: n.a, score: state.totalA },
    { name: n.b, score: state.totalB }
  ].sort((x, y) => y.score - x.score);
  document.getElementById('end-winner').textContent = data[0].name;
  document.getElementById('end-score').textContent = data[0].score + ' points';
  document.getElementById('end-list').innerHTML = data.map((d, i) =>
    `<div class="end-row"><span class="end-rank">${i + 1}</span><span class="end-name">${esc(d.name)}</span><span class="end-score">${d.score}</span></div>`
  ).join('');
}

function restart() {
  state.rounds = []; state.totalA = 0; state.totalB = 0; state.pendingLitige = null;
  save();
  newRound();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- Init ----------
load();
if (state.rounds.length > 0) {
  showScreen('scores');
} else {
  newRound();
}
