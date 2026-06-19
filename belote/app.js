/* ============================================
   Belote — logique
   ============================================ */

const STORAGE_KEY = 'belote-state-v1';

let state = {
  rounds: [],
  totalA: 0,
  totalB: 0,
  pendingLitige: null,   // 'a' | 'b' | null
  nameA: 'Nous',
  nameB: 'Eux',
  target: 1000
};

let draft = {
  taker: null,
  who: 'a',
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

// ---------- Navigation ----------
function showScreen(s) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById('screen-' + s).classList.add('active');
  window.scrollTo(0, 0);
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

// ---------- Calcul ----------
function compute() {
  const n = names();
  const ba = draft.belote === 'a' ? 20 : 0;
  const bb = draft.belote === 'b' ? 20 : 0;

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

  if (!draft.taker) return null;

  const pts = { a: 0, b: 0 };
  pts[draft.who] = draft.pts;
  pts[draft.who === 'a' ? 'b' : 'a'] = 162 - draft.pts;

  const eff = { a: pts.a + ba, b: pts.b + bb };
  const taker = draft.taker;
  const def = taker === 'a' ? 'b' : 'a';

  // Litige : scores effectifs égaux
  if (eff.a === eff.b) {
    let rA = (def === 'a' ? 81 : 0) + ba;
    let rB = (def === 'b' ? 81 : 0) + bb;
    return {
      roundA: rA, roundB: rB,
      note: 'Litige — 81 en attente',
      isLitige: true, isDedans: false, isCapotRound: false,
      label: 'Litige', takerTeam: taker
    };
  }

  // Dedans : le preneur fait strictement moins
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

  // Victoire normale
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
    return;
  }

  const label = res.isCapotRound ? 'Capot' : res.isLitige ? 'Litige' : res.isDedans ? 'Dedans' : 'Manche';
  stateEl.textContent = label;
  stateEl.style.color = res.isLitige ? 'var(--gold)' : res.isDedans ? 'var(--bad)' : 'var(--ok)';
  setDelta('pd-a', res.roundA);
  setDelta('pd-b', res.roundB);
}

function setDelta(id, v) {
  const el = document.getElementById(id);
  el.textContent = '+' + v;
  el.className = 'preview-delta ' + (v > 0 ? 'delta-pos' : 'delta-zero');
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
  state.pendingLitige = res.isLitige ? res.takerTeam : null;

  state.rounds.push({
    roundA: res.roundA, roundB: res.roundB,
    totalA: state.totalA, totalB: state.totalB,
    note: res.note, isLitige: res.isLitige,
    isCapotRound: res.isCapotRound, label: res.label
  });

  save();
  renderScores();
  newRound();
}

// ---------- Reset formulaire + round suivant ----------
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
  window.scrollTo(0, 0);
}

// ---------- Rendu tableau ----------
function renderScores() {
  const n = names();
  const isALead = state.totalA > state.totalB;
  const isBLead = state.totalB > state.totalA;

  document.getElementById('card-lbl-a').textContent = n.a;
  document.getElementById('card-lbl-b').textContent = n.b;
  document.getElementById('score-a').textContent = state.totalA;
  document.getElementById('score-b').textContent = state.totalB;
  document.getElementById('card-a').className = 'score-card' + (isALead ? ' lead' : '');
  document.getElementById('card-b').className = 'score-card' + (isBLead ? ' lead' : '');

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
  showScreen('main');
  renderScores();
  newRound();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- Init ----------
load();
renderScores();
newRound();
