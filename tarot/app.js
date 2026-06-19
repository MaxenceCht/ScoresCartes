/* ============================================
   Tarot — logique FFT (logique préservée)
   Habillage Scores, navigation par écrans
   ============================================ */

const STORAGE_KEY = 'tarot-state-v1';
const NEEDED = [56, 51, 41, 36];

let state = {
  playerCount: 4,
  playerNames: ['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4', 'Joueur 5'],
  totals: [0, 0, 0, 0, 0],
  donnes: [],
  started: false
};

let draft = { preneur: null, partner: null, contractMult: null, bouts: null, pts: 48, pab: null, poigneeAtt: 0, poigneeDef: 0, chelem: 0 };

// ---------- Persistance ----------
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
function load() { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch (e) {} }

// ---------- Navigation ----------
function showScreen(s) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById('screen-' + s).classList.add('active');
  window.scrollTo(0, 0);
  if (s === 'main') renderScores();
  if (s === 'end') renderEnd();
}

// ---------- Setup ----------
function setPlayerCount(n) {
  if (state.donnes.length > 0 && n !== state.playerCount) {
    if (!confirm('Changer le nombre de joueurs réinitialise la partie. Continuer ?')) return;
    state.donnes = []; state.totals = [0, 0, 0, 0, 0];
  }
  state.playerCount = n;
  [3, 4, 5].forEach(v => document.getElementById('np-' + v).className = 'seg' + (v === n ? ' on' : ''));
  renderNameInputs();
  save();
}

function renderNameInputs() {
  const block = document.getElementById('names-block');
  block.innerHTML = '';
  for (let i = 0; i < state.playerCount; i++) {
    const dotColor = i === 0 ? '' : '';
    block.innerHTML += `<div class="field-row"><span class="dot"></span><input id="pname-${i}" value="${esc(state.playerNames[i])}" oninput="onNameChange(${i}, this.value)" /></div>`;
  }
}
function onNameChange(i, v) { state.playerNames[i] = v.trim() || ('Joueur ' + (i + 1)); save(); }

function startGame() {
  for (let i = 0; i < state.playerCount; i++) {
    const inp = document.getElementById('pname-' + i);
    if (inp) state.playerNames[i] = inp.value.trim() || ('Joueur ' + (i + 1));
  }
  state.started = true;
  save();
  newRound();
}

// ---------- Sélections ----------
function renderPlayerChips() {
  const pr = document.getElementById('preneur-row');
  const par = document.getElementById('partner-row');
  pr.innerHTML = ''; par.innerHTML = '';
  for (let i = 0; i < state.playerCount; i++) {
    const b1 = document.createElement('button');
    b1.className = 'seg' + (draft.preneur === i ? ' on-soft' : '');
    b1.textContent = state.playerNames[i];
    b1.onclick = () => selectPreneur(i);
    pr.appendChild(b1);
    const b2 = document.createElement('button');
    b2.className = 'seg' + (draft.partner === i ? ' on' : '');
    b2.textContent = state.playerNames[i];
    b2.onclick = () => selectPartner(i);
    par.appendChild(b2);
  }
  document.getElementById('partner-block').style.display = state.playerCount === 5 ? 'block' : 'none';
}
function selectPreneur(i) { draft.preneur = i; renderPlayerChips(); refreshPreview(); }
function selectPartner(i) { draft.partner = i; renderPlayerChips(); refreshPreview(); }

function selectContract(m) {
  draft.contractMult = m;
  [1, 2, 4, 6].forEach(v => document.getElementById('ct-' + v).className = 'seg' + (v === m ? ' on' : ''));
  refreshPreview();
}
function selectBouts(b) {
  draft.bouts = b;
  [0, 1, 2, 3].forEach(v => document.getElementById('bt-' + v).className = 'seg' + (v === b ? ' on' : ''));
  updatePtsSub();
  refreshPreview();
}
function selectPab(v) {
  draft.pab = v;
  document.getElementById('pab-none').className = 'seg' + (v === null ? ' on' : '');
  document.getElementById('pab-att').className = 'seg' + (v === 'att' ? ' on' : '');
  document.getElementById('pab-def').className = 'seg' + (v === 'def' ? ' on' : '');
  refreshPreview();
}
function selectPoignee(camp, v) {
  if (camp === 'att') { draft.poigneeAtt = v; [0, 20, 30, 40].forEach(x => document.getElementById('pa-' + x).className = 'seg' + (x === v ? ' on' : '')); }
  else { draft.poigneeDef = v; [0, 20, 30, 40].forEach(x => document.getElementById('pd-' + x).className = 'seg' + (x === v ? ' on' : '')); }
  refreshPreview();
}
function selectChelem(v) {
  draft.chelem = v;
  document.getElementById('ch-0').className = 'seg' + (v === 0 ? ' on' : '');
  document.getElementById('ch-200').className = 'seg' + (v === 200 ? ' on' : '');
  document.getElementById('ch-400').className = 'seg' + (v === 400 ? ' on' : '');
  document.getElementById('ch-m200').className = 'seg' + (v === -200 ? ' on' : '');
  refreshPreview();
}
function setPts(v) {
  draft.pts = Math.max(0, Math.min(91, Math.round(v * 2) / 2));
  document.getElementById('pts-value').textContent = draft.pts;
  document.getElementById('pts-range').value = draft.pts;
  document.getElementById('pts-range').style.setProperty('--fill', (draft.pts / 91 * 100) + '%');
  updatePtsSub();
  refreshPreview();
}
function bumpPts(d) { setPts(draft.pts + d); }
function onRange(v) { setPts(v); }
function updatePtsSub() {
  const need = draft.bouts !== null ? NEEDED[draft.bouts] : '—';
  document.getElementById('pts-sub').textContent = 'sur 91 · besoin ' + need;
}

// ---------- Calcul (logique FFT préservée) ----------
function compute() {
  if (draft.preneur === null || draft.contractMult === null || draft.bouts === null) return null;
  if (state.playerCount === 5 && draft.partner === null) return null;
  const pts = draft.pts;
  const needed = NEEDED[draft.bouts];
  const diff = pts - needed;
  const success = diff >= 0;
  let score = (25 + Math.ceil(Math.abs(diff))) * draft.contractMult;
  let signed = success ? score : -score;
  if (draft.pab === 'att') signed += 10 * draft.contractMult;
  if (draft.pab === 'def') signed -= 10 * draft.contractMult;
  const poignees = draft.poigneeAtt + draft.poigneeDef;
  signed += success ? poignees : -poignees;
  signed += draft.chelem;

  const c = state.playerCount;
  const deltas = new Array(c).fill(0);
  if (c === 3) { deltas[draft.preneur] = 2 * signed; for (let i = 0; i < 3; i++) if (i !== draft.preneur) deltas[i] = -signed; }
  else if (c === 4) { deltas[draft.preneur] = 3 * signed; for (let i = 0; i < 4; i++) if (i !== draft.preneur) deltas[i] = -signed; }
  else {
    if (draft.partner === draft.preneur) { deltas[draft.preneur] = 4 * signed; for (let i = 0; i < 5; i++) if (i !== draft.preneur) deltas[i] = -signed; }
    else { deltas[draft.preneur] = 2 * signed; deltas[draft.partner] = signed; for (let i = 0; i < 5; i++) if (i !== draft.preneur && i !== draft.partner) deltas[i] = -signed; }
  }
  const ctNames = { 1: 'Petite', 2: 'Garde', 4: 'Garde sans', 6: 'Garde contre' };
  let head = state.playerNames[draft.preneur] + ' · ' + ctNames[draft.contractMult];
  return { deltas, success, diff, head };
}

function refreshPreview() {
  const res = compute();
  const stateEl = document.getElementById('preview-state');
  const lines = document.getElementById('preview-lines');
  if (!res) {
    stateEl.textContent = '—'; stateEl.style.color = 'var(--muted)';
    lines.innerHTML = '';
    for (let i = 0; i < state.playerCount; i++)
      lines.innerHTML += `<div class="preview-line"><span class="preview-name">${esc(state.playerNames[i])}</span><span class="preview-delta delta-zero">—</span></div>`;
    return;
  }
  stateEl.textContent = res.success ? 'Contrat gagné' : 'Contrat perdu';
  stateEl.style.color = res.success ? 'var(--ok)' : 'var(--bad)';
  lines.innerHTML = res.deltas.map((d, i) => {
    const cls = d > 0 ? 'delta-pos' : d < 0 ? 'delta-neg' : 'delta-zero';
    return `<div class="preview-line"><span class="preview-name">${esc(state.playerNames[i])}</span><span class="preview-delta ${cls}">${d > 0 ? '+' : ''}${d}</span></div>`;
  }).join('');
}

// ---------- Validation ----------
function validateRound() {
  const err = document.getElementById('err');
  err.textContent = '';
  if (draft.preneur === null) { err.textContent = 'Désigne le preneur.'; return; }
  if (state.playerCount === 5 && draft.partner === null) { err.textContent = 'Désigne le partenaire (ou le preneur lui-même).'; return; }
  if (draft.contractMult === null) { err.textContent = 'Choisis le contrat.'; return; }
  if (draft.bouts === null) { err.textContent = 'Indique le nombre de bouts.'; return; }
  const res = compute();
  res.deltas.forEach((d, i) => state.totals[i] += d);
  state.donnes.push({ deltas: res.deltas.slice(), head: res.head, success: res.success });
  save();
  renderScores();
  newRound();
}

function newRound() {
  draft = { preneur: null, partner: null, contractMult: null, bouts: null, pts: 48, pab: null, poigneeAtt: 0, poigneeDef: 0, chelem: 0 };
  renderPlayerChips();
  [1, 2, 4, 6].forEach(v => document.getElementById('ct-' + v).className = 'seg');
  [0, 1, 2, 3].forEach(v => document.getElementById('bt-' + v).className = 'seg');
  selectPab(null);
  selectPoignee('att', 0); selectPoignee('def', 0);
  selectChelem(0);
  setPts(48);
  document.getElementById('err').textContent = '';
  document.getElementById('round-no').textContent = 'Donne n°' + (state.donnes.length + 1);
  showScreen('main');
  window.scrollTo(0, 0);
}

function backFromRound() {
  showScreen('setup');
}

// ---------- Rendu scores ----------
function renderScores() {
  const arr = state.playerNames.slice(0, state.playerCount).map((name, i) => ({ name, score: state.totals[i] }));
  const sorted = [...arr].sort((a, b) => b.score - a.score);
  const max = Math.max(...arr.map(a => Math.abs(a.score)), 1);
  document.getElementById('standings').innerHTML = sorted.map((d, i) => {
    const isLead = i === 0 && state.donnes.length > 0 && d.score !== sorted[sorted.length - 1].score;
    const pct = Math.round(Math.max(0, d.score) / max * 100);
    return `<div class="standing"><span class="rank ${isLead ? 'leader' : ''}">${i + 1}</span><div class="standing-body"><div class="standing-top"><span class="standing-name">${esc(d.name)}</span><span class="standing-score">${d.score}</span></div><div class="bar"><div class="bar-fill ${isLead ? 'leader' : ''}" style="width:${pct}%"></div></div></div></div>`;
  }).join('');

  const hist = document.getElementById('history');
  const empty = document.getElementById('history-empty');
  if (state.donnes.length === 0) { hist.innerHTML = ''; empty.style.display = 'block'; }
  else {
    empty.style.display = 'none';
    const running = new Array(state.playerCount).fill(0);
    const withSnaps = state.donnes.map(d => {
      d.deltas.slice(0, state.playerCount).forEach((v, i) => running[i] += v);
      return { ...d, snap: [...running] };
    });
    hist.innerHTML = [...withSnaps].reverse().map((d, ri) => {
      const i = state.donnes.length - 1 - ri;
      const chips = d.deltas.slice(0, state.playerCount).map((v, pi) =>
        `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;"><span class="histo-chip ${v >= 0 ? 'delta-pos' : 'delta-neg'}">${v > 0 ? '+' : ''}${v}</span><span style="font-size:11px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;">${d.snap[pi]}</span></div>`
      ).join('');
      return `<div class="histo-item"><span class="histo-n">${i + 1}</span><div class="histo-body"><div class="histo-head">${d.success ? '' : '✗ '}${esc(d.head || '')}</div><div class="histo-sub">${d.success ? 'Gagné' : 'Perdu'}</div></div><div class="histo-chips">${chips}</div></div>`;
    }).join('');
  }
}

function goEnd() { showScreen('end'); }
function renderEnd() {
  const arr = state.playerNames.slice(0, state.playerCount).map((name, i) => ({ name, score: state.totals[i] }));
  const sorted = [...arr].sort((a, b) => b.score - a.score);
  document.getElementById('end-winner').textContent = sorted[0].name;
  document.getElementById('end-score').textContent = sorted[0].score + ' points';
  document.getElementById('end-list').innerHTML = sorted.map((d, i) => `<div class="end-row"><span class="end-rank">${i + 1}</span><span class="end-name">${esc(d.name)}</span><span class="end-score">${d.score}</span></div>`).join('');
}

function restart() {
  state.donnes = []; state.totals = [0, 0, 0, 0, 0]; state.started = false;
  save();
  showScreen('setup');
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ---------- Init ----------
(function init() {
  load();
  [3, 4, 5].forEach(v => document.getElementById('np-' + v).className = 'seg' + (v === state.playerCount ? ' on' : ''));
  renderNameInputs();
  renderPlayerChips();
  if (state.started && state.donnes.length > 0) {
    document.getElementById('round-no').textContent = 'Donne n°' + (state.donnes.length + 1);
    showScreen('main');
  } else if (state.started) {
    newRound();
  } else {
    showScreen('setup');
  }
})();
