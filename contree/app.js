/* ============================================
   Contrée — logique de comptage (3 modes)
   Logique préservée, habillage Scores
   ============================================ */

const STORAGE_KEY = 'contree-state-v1';
const CONTRACTS = [80, 90, 100, 110, 120, 130, 140, 150, 160];
const CHUTE_DEFENSE = 160;

let state = {
  rounds: [], totalA: 0, totalB: 0,
  mode: 'contrat',
  nameA: 'Nous', nameB: 'Eux',
  target: 1010,
  arrondi: false, beloteComptee: false, beloteChute: true,
  targetManual: false,
  started: false
};
let targetManual = false;

let draft = { attacker: null, contract: null, coinche: 1, belote: null, pts: 90, capot: false };

// ---------- Persistance ----------
function save() { try { state.targetManual = targetManual; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
function load() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { state = Object.assign(state, JSON.parse(raw)); targetManual = !!state.targetManual; } } catch (e) {}
}
function saveCfg() {
  state.nameA = document.getElementById('name-a').value;
  state.nameB = document.getElementById('name-b').value;
  state.target = parseInt(document.getElementById('target').value) || 0;
  state.arrondi = document.getElementById('opt-arrondi').checked;
  state.beloteComptee = document.getElementById('opt-belote').checked;
  state.beloteChute = document.getElementById('opt-belote-chute').checked;
  save();
}

function names() { return { a: state.nameA || 'Nous', b: state.nameB || 'Eux' }; }
function roundTen(x) { const r = x % 10; return r <= 5 ? x - r : x + (10 - r); }
function defaultTarget() {
  const a = document.getElementById('opt-arrondi').checked;
  if (state.mode === 'contrat') return 1010;
  if (state.mode === 'mixte') return a ? 2010 : 2001;
  return a ? 1010 : 1001;
}

// ---------- Navigation ----------
function showScreen(s) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById('screen-' + s).classList.add('active');
  window.scrollTo(0, 0);
  if (s === 'main') renderScores();
  if (s === 'end') renderEnd();
}

// ---------- Setup ----------
function selectMode(m) {
  state.mode = m;
  document.getElementById('mode-contrat').className = 'seg' + (m === 'contrat' ? ' on' : '');
  document.getElementById('mode-mixte').className = 'seg' + (m === 'mixte' ? ' on' : '');
  document.getElementById('mode-realise').className = 'seg' + (m === 'realise' ? ' on' : '');
  document.getElementById('row-arrondi').style.display = m === 'contrat' ? 'none' : 'flex';
  document.getElementById('row-belote').style.display = m === 'contrat' ? 'flex' : 'none';
  if (!targetManual) document.getElementById('target').value = defaultTarget();
  save();
}
function onOptionsChange() {
  if (!targetManual) document.getElementById('target').value = defaultTarget();
  saveCfg();
}
function onNameChange() { saveCfg(); }

function startGame() {
  saveCfg();
  state.started = true;
  save();
  newRound();
}

// ---------- Sélections donne ----------
function selectAttacker(t) {
  draft.attacker = t;
  const n = names();
  document.getElementById('att-a').className = 'seg' + (t === 'a' ? ' on-soft' : '');
  document.getElementById('att-a').textContent = n.a;
  document.getElementById('att-b').className = 'seg' + (t === 'b' ? ' on-soft' : '');
  document.getElementById('att-b').textContent = n.b;
  refreshPreview();
}
function selectContract(v) {
  draft.contract = v;
  document.querySelectorAll('#contract-row .seg').forEach(c => {
    c.className = 'seg' + (parseInt(c.dataset.val) === v ? ' on' : '');
  });
  refreshPreview();
}
function selectCoinche(m) {
  draft.coinche = m;
  document.getElementById('co-1').className = 'seg' + (m === 1 ? ' on' : '');
  document.getElementById('co-2').className = 'seg' + (m === 2 ? ' on' : '');
  document.getElementById('co-4').className = 'seg' + (m === 4 ? ' on' : '');
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
function setPts(v) {
  draft.pts = Math.max(0, Math.min(162, Math.round(v)));
  document.getElementById('pts-value').textContent = draft.pts;
  document.getElementById('pts-range').value = draft.pts;
  document.getElementById('pts-range').style.setProperty('--fill', (draft.pts / 162 * 100) + '%');
  document.getElementById('derived-val').textContent = 162 - draft.pts;
  refreshPreview();
}
function bumpPts(d) { setPts(draft.pts + d); }
function onRange(v) { setPts(v); }
function onCapotChange() {
  draft.capot = document.getElementById('capot-chk').checked;
  document.getElementById('group-contract').style.display = draft.capot ? 'none' : '';
  document.getElementById('group-pts').style.display = draft.capot ? 'none' : '';
  refreshPreview();
}

// ---------- Cœur du calcul ----------
function compute() {
  if (!draft.attacker) return null;
  const attacker = draft.attacker;
  const defender = attacker === 'a' ? 'b' : 'a';
  const n = names();
  const coincheTxt = draft.coinche === 2 ? ' coinché' : draft.coinche === 4 ? ' surcoinché' : '';

  if (draft.capot) {
    const score = { a: 0, b: 0 };
    if (state.mode === 'contrat' || state.mode === 'realise') {
      score[attacker] = 250 * draft.coinche;
    } else {
      score[attacker] = 250 * draft.coinche + 250;
    }
    if (state.mode === 'contrat' && draft.belote && state.beloteComptee) {
      score[draft.belote] += 20;
    }
    if ((state.mode === 'mixte' || state.mode === 'realise') && draft.belote) {
      score[draft.belote] += 20;
    }
    return { success: true, isCapot: true, scoreA: score.a, scoreB: score.b, head: n[attacker] + ' · Capot' + coincheTxt };
  }

  if (!draft.contract) return null;
  const realized = { a: 0, b: 0 };
  realized[attacker] = draft.pts;
  realized[defender] = 162 - draft.pts;

  const withBel = {
    a: realized.a + (draft.belote === 'a' ? 20 : 0),
    b: realized.b + (draft.belote === 'b' ? 20 : 0)
  };

  const defScore = state.beloteChute ? withBel[defender] : realized[defender];
  const success = withBel[attacker] >= draft.contract && withBel[attacker] > defScore;

  const arrondi = state.arrondi;
  const rnd = x => arrondi ? roundTen(x) : x;
  const score = { a: 0, b: 0 };

  if (state.mode === 'contrat' || state.mode === 'mixte') {
    if (success) score[attacker] += draft.contract * draft.coinche;
    else score[defender] += CHUTE_DEFENSE * draft.coinche;
  }
  if (state.mode === 'contrat' && draft.belote && state.beloteComptee) {
    score[draft.belote] += 20;
  }
  if (state.mode === 'mixte' || state.mode === 'realise') {
    if (success) {
      score.a += rnd(withBel.a);
      score.b += rnd(withBel.b);
    } else {
      score[defender] += rnd(CHUTE_DEFENSE + (draft.belote === defender ? 20 : 0)) * (state.mode === 'realise' ? draft.coinche : 1);
    }
  }

  const head = n[attacker] + ' · ' + draft.contract + coincheTxt;
  return { success, scoreA: score.a, scoreB: score.b, head };
}

// ---------- Aperçu ----------
function refreshPreview() {
  const n = names();
  document.getElementById('pl-a').textContent = n.a;
  document.getElementById('pl-b').textContent = n.b;
  const res = compute();
  const stateEl = document.getElementById('preview-state');
  if (!res) {
    stateEl.textContent = '—'; stateEl.style.color = 'var(--muted)';
    document.getElementById('pd-a').textContent = '—';
    document.getElementById('pd-b').textContent = '—';
    return;
  }
  stateEl.textContent = res.isCapot ? 'Capot' : (res.success ? 'Contrat tenu' : 'Chute');
  stateEl.style.color = res.success ? 'var(--ok)' : 'var(--bad)';
  setDelta('pd-a', res.scoreA);
  setDelta('pd-b', res.scoreB);
}
function setDelta(id, v) {
  const el = document.getElementById(id);
  el.textContent = (v > 0 ? '+' : '') + v;
  el.className = 'preview-delta ' + (v > 0 ? 'delta-pos' : 'delta-zero');
}

// ---------- Validation ----------
function validateRound() {
  const err = document.getElementById('err');
  err.textContent = '';
  if (!draft.attacker) { err.textContent = "Désigne l'équipe qui annonce."; return; }
  if (!draft.capot && !draft.contract) { err.textContent = 'Choisis le contrat.'; return; }
  const res = compute();
  state.totalA += res.scoreA;
  state.totalB += res.scoreB;
  state.rounds.push({ scoreA: res.scoreA, scoreB: res.scoreB, totalA: state.totalA, totalB: state.totalB, head: res.head, success: res.success, isCapot: res.isCapot || false });
  save();
  renderScores();
  newRound();
}

function newRound() {
  draft = { attacker: null, contract: null, coinche: 1, belote: null, pts: 90, capot: false };
  const n = names();
  document.getElementById('att-a').className = 'seg';
  document.getElementById('att-a').textContent = n.a;
  document.getElementById('att-b').className = 'seg';
  document.getElementById('att-b').textContent = n.b;
  document.getElementById('capot-chk').checked = false;
  document.getElementById('group-contract').style.display = '';
  document.getElementById('group-pts').style.display = '';
  document.querySelectorAll('#contract-row .seg').forEach(c => c.className = 'seg');
  selectCoinche(1);
  selectBelote(null);
  setPts(90);
  document.getElementById('err').textContent = '';
  document.getElementById('round-no').textContent = 'Donne n°' + (state.rounds.length + 1);
  showScreen('main');
  window.scrollTo(0, 0);
}

function backFromRound() {
  showScreen('setup');
}

// ---------- Rendu scores ----------
function renderScores() {
  const n = names();
  const lead = state.totalA === state.totalB ? null : (state.totalA > state.totalB ? 'a' : 'b');
  document.getElementById('card-lbl-a').textContent = n.a;
  document.getElementById('card-lbl-b').textContent = n.b;
  document.getElementById('score-a').textContent = state.totalA;
  document.getElementById('score-b').textContent = state.totalB;
  document.getElementById('card-a').className = 'score-card' + (lead === 'a' ? ' lead' : '');
  document.getElementById('card-b').className = 'score-card' + (lead === 'b' ? ' lead' : '');

  const hist = document.getElementById('history');
  const empty = document.getElementById('history-empty');
  if (state.rounds.length === 0) { hist.innerHTML = ''; empty.style.display = 'block'; }
  else {
    empty.style.display = 'none';
    hist.innerHTML = [...state.rounds].reverse().map((r, ri) => {
      const i = state.rounds.length - 1 - ri;
      return `<div class="histo-item"><span class="histo-n">${i + 1}</span><div class="histo-body"><div class="histo-head">${r.success ? '' : '✗ '}${esc(r.head || '')}</div><div class="histo-sub">${r.isCapot ? 'Capot' : (r.success ? 'Contrat tenu' : 'Chute')}</div></div><div class="histo-chips"><div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;"><span class="histo-chip ${r.scoreA > 0 ? 'delta-pos' : 'delta-zero'}">+${r.scoreA}</span><span style="font-size:11px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;">${r.totalA}</span></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;"><span class="histo-chip ${r.scoreB > 0 ? 'delta-pos' : 'delta-zero'}">+${r.scoreB}</span><span style="font-size:11px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;">${r.totalB}</span></div></div></div>`;
    }).join('');
  }
  const reached = state.target > 0 && (state.totalA >= state.target || state.totalB >= state.target);
  document.getElementById('banner-win').style.display = reached ? 'flex' : 'none';
}

function goEnd() { showScreen('end'); }
function renderEnd() {
  const n = names();
  const data = [{ name: n.a, score: state.totalA }, { name: n.b, score: state.totalB }].sort((x, y) => y.score - x.score);
  document.getElementById('end-winner').textContent = data[0].name;
  document.getElementById('end-score').textContent = data[0].score + ' points';
  document.getElementById('end-list').innerHTML = data.map((d, i) => `<div class="end-row"><span class="end-rank">${i + 1}</span><span class="end-name">${esc(d.name)}</span><span class="end-score">${d.score}</span></div>`).join('');
}

function restart() {
  state.rounds = []; state.totalA = 0; state.totalB = 0; state.started = false;
  save();
  showScreen('setup');
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ---------- Init ----------
(function init() {
  const row = document.getElementById('contract-row');
  CONTRACTS.forEach(v => {
    const b = document.createElement('button');
    b.className = 'seg'; b.dataset.val = v;
    b.textContent = v;
    b.style.minWidth = '52px';
    b.onclick = () => selectContract(v);
    row.appendChild(b);
  });

  load();
  document.getElementById('name-a').value = state.nameA || 'Nous';
  document.getElementById('name-b').value = state.nameB || 'Eux';
  document.getElementById('opt-arrondi').checked = !!state.arrondi;
  document.getElementById('opt-belote').checked = !!state.beloteComptee;
  document.getElementById('opt-belote-chute').checked = state.beloteChute !== false;
  document.getElementById('target').value = state.target || defaultTarget();
  selectMode(state.mode);

  if (state.started && state.rounds.length > 0) {
    document.getElementById('round-no').textContent = 'Donne n°' + (state.rounds.length + 1);
    showScreen('main');
  } else if (state.started) {
    newRound();
  } else {
    showScreen('setup');
  }
})();
