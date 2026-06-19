/* ============================================
   Belote — logique (litige, capot, dix de der)
   Habillage : design Scores, navigation par écrans
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

// Brouillon de la donne en cours
let draft = {
  kind: 'normal',        // 'normal' | 'capot'
  who: 'a',
  pts: 81,
  capotTeam: null,
  belote: null,
  der: null,
  litigeDef: null
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
function setKind(k) {
  draft.kind = k;
  const n = names();
  document.getElementById('kind-normal').className = 'seg' + (k === 'normal' ? ' on' : '');
  document.getElementById('kind-capot').className = 'seg' + (k === 'capot' ? ' on' : '');
  document.getElementById('normal-block').style.display = k === 'normal' ? 'block' : 'none';
  document.getElementById('capot-block').style.display = k === 'capot' ? 'block' : 'none';
  document.getElementById('capot-a').textContent = n.a;
  document.getElementById('capot-b').textContent = n.b;
  document.getElementById('litige-block').style.display = 'none';
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

function selectCapot(t) {
  draft.capotTeam = t;
  const n = names();
  document.getElementById('capot-a').className = 'seg' + (t === 'a' ? ' on' : '');
  document.getElementById('capot-a').textContent = n.a;
  document.getElementById('capot-b').className = 'seg' + (t === 'b' ? ' on' : '');
  document.getElementById('capot-b').textContent = n.b;
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

function selectLitige(t) {
  draft.litigeDef = t;
  const n = names();
  document.getElementById('lit-a').className = 'seg' + (t === 'a' ? ' on' : '');
  document.getElementById('lit-a').textContent = n.a;
  document.getElementById('lit-b').className = 'seg' + (t === 'b' ? ' on' : '');
  document.getElementById('lit-b').textContent = n.b;
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
// Retourne { roundA, roundB, note, isLitige, isCapotRound, state }
function compute() {
  const ba = draft.belote === 'a' ? 20 : 0;
  const bb = draft.belote === 'b' ? 20 : 0;
  const n = names();

  if (draft.kind === 'capot') {
    if (!draft.capotTeam) return null;
    let rA = (draft.capotTeam === 'a' ? 250 : 0) + ba;
    let rB = (draft.capotTeam === 'b' ? 250 : 0) + bb;
    let note = 'Capot ' + n[draft.capotTeam];
    if (state.pendingLitige !== null) {
      if (draft.capotTeam === 'a') rA += 81; else rB += 81;
      note += ' + litige';
    }
    return { roundA: rA, roundB: rB, note, isLitige: false, isCapotRound: true, label: 'Capot' };
  }

  const pts = { a: 0, b: 0 };
  pts[draft.who] = draft.pts;
  pts[draft.who === 'a' ? 'b' : 'a'] = 162 - draft.pts;

  const isLitige = pts.a === 81 && pts.b === 81;
  if (isLitige) {
    if (!draft.litigeDef) return { incomplete: 'litige' };
    const attacker = draft.litigeDef === 'a' ? 'b' : 'a';
    let rA = (draft.litigeDef === 'a' ? 81 : 0) + ba;
    let rB = (draft.litigeDef === 'b' ? 81 : 0) + bb;
    return { roundA: rA, roundB: rB, note: 'Litige — 81 en attente', isLitige: true, isCapotRound: false, label: 'Litige', attacker };
  }

  let rA = pts.a + ba;
  let rB = pts.b + bb;
  let note = '';
  if (state.pendingLitige !== null) {
    const winner = pts.a > pts.b ? 'a' : pts.b > pts.a ? 'b' : null;
    if (winner) {
      if (winner === 'a') rA += 81; else rB += 81;
      note = '+81 litige';
    }
  }
  return { roundA: rA, roundB: rB, note, isLitige: false, isCapotRound: false, label: pts.a > pts.b ? n.a : n.b };
}

// ---------- Aperçu ----------
function refreshPreview() {
  const n = names();
  document.getElementById('pl-a').textContent = n.a;
  document.getElementById('pl-b').textContent = n.b;

  // Détection litige en direct
  const litigeNow = draft.kind === 'normal' && draft.pts === 81;
  document.getElementById('litige-block').style.display = litigeNow ? 'block' : 'none';
  if (litigeNow) {
    const nl = names();
    document.getElementById('lit-a').textContent = nl.a;
    document.getElementById('lit-b').textContent = nl.b;
  }

  const res = compute();
  const stateEl = document.getElementById('preview-state');
  if (!res || res.incomplete) {
    stateEl.textContent = res && res.incomplete === 'litige' ? 'Litige — choisir' : '—';
    stateEl.style.color = 'var(--muted)';
    document.getElementById('pd-a').textContent = '—';
    document.getElementById('pd-b').textContent = '—';
    return;
  }
  stateEl.textContent = res.isCapotRound ? 'Capot' : res.isLitige ? 'Litige' : 'Manche';
  stateEl.style.color = 'var(--ok)';
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
  if (!res) { err.textContent = "Désigne l'équipe qui fait capot."; return; }
  if (res.incomplete === 'litige') { err.textContent = "Choisis l'équipe défendante."; return; }

  state.totalA += res.roundA;
  state.totalB += res.roundB;

  // Mise à jour litige en attente
  if (res.isLitige) state.pendingLitige = res.attacker;
  else if (state.pendingLitige !== null && !res.isCapotRound) {
    const pts = { a: 0, b: 0 };
    pts[draft.who] = draft.pts; pts[draft.who === 'a' ? 'b' : 'a'] = 162 - draft.pts;
    if (pts.a !== pts.b) state.pendingLitige = null;
  } else if (res.isCapotRound && state.pendingLitige !== null) {
    state.pendingLitige = null;
  }

  state.rounds.push({
    roundA: res.roundA, roundB: res.roundB,
    totalA: state.totalA, totalB: state.totalB,
    note: res.note, isLitige: res.isLitige, isCapotRound: res.isCapotRound, label: res.label
  });

  save();
  showScreen('scores');
}

// ---------- Nouvelle donne ----------
function newRound() {
  draft = { kind: 'normal', who: 'a', pts: 81, capotTeam: null, belote: null, litigeDef: null };
  setKind('normal');
  selectWho('a');
  selectBelote(null);
  document.getElementById('lit-a').className = 'seg';
  document.getElementById('lit-b').className = 'seg';
  document.getElementById('capot-a').className = 'seg';
  document.getElementById('capot-b').className = 'seg';
  document.getElementById('err').textContent = '';
  setPts(81);
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

  // Historique
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
          <span class="histo-chip delta-pos">+${r.roundA}</span>
          <span class="histo-chip delta-pos">+${r.roundB}</span>
        </div>
      </div>`;
    }).join('');
  }

  // Bannière objectif
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
selectWho('a');
selectBelote(null);
setKind('normal');
setPts(81);
// Si une partie est en cours, on arrive directement sur le tableau
if (state.rounds.length > 0) {
  document.getElementById('round-no').textContent = 'Donne n°' + (state.rounds.length + 1);
  showScreen('scores');
} else {
  showScreen('round');
}
