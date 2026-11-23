import * as E from './engine.js';
import * as store from './store.js';
import * as sync from './sync.js';

const $main = document.getElementById('main');
const $nav = document.getElementById('topnav');
const $toast = document.getElementById('toast');

const S = {
  index: null,
  certs: {},
  questions: {},
  byId: {},
  settings: store.loadSettings(),
  progress: null,
  session: null,
  timer: null,
  syncState: 'off', // off | signed-out | syncing | synced | error
  pushTimer: null,
  resetArmed: false,
};

// ---------- helpers ----------
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (n) => (n == null ? '–' : `${n}%`);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove('show'), 2600);
}

function applyTheme() {
  const t = S.settings.theme;
  document.documentElement.dataset.theme = t === 'system' ? '' : t;
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function objectiveOf(cert, objId) {
  for (const d of cert.domains) for (const o of d.objectives) if (o.id === objId) return o;
  return null;
}
function domainOf(cert, id) {
  return cert.domains.find((d) => d.id === id);
}

// ---------- data ----------
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  return res.json();
}

async function loadIndex() {
  if (!S.index) S.index = await fetchJSON('banks/index.json');
  return S.index;
}

async function loadCert(certId) {
  if (!S.certs[certId]) {
    const cert = await fetchJSON(`banks/${encodeURIComponent(certId)}/cert.json`);
    const qs = await fetchJSON(`banks/${encodeURIComponent(certId)}/${cert.questionsFile || 'questions.json'}`);
    S.certs[certId] = cert;
    S.questions[certId] = qs;
    S.byId[certId] = Object.fromEntries(qs.map((q) => [q.id, q]));
  }
  if (!S.progress || S.progress.certId !== certId) {
    S.progress = store.loadProgress(certId);
    S.session = store.loadSession(certId);
    pullRemote(certId);
  }
  return S.certs[certId];
}

function saveProgress() {
  store.saveProgress(S.progress);
  schedulePush();
}

// ---------- sync ----------
function refreshSyncState() {
  if (!sync.enabled()) S.syncState = 'off';
  else if (!sync.user()) S.syncState = 'signed-out';
  else if (S.syncState === 'off' || S.syncState === 'signed-out') S.syncState = 'synced';
}

async function pullRemote(certId) {
  refreshSyncState();
  if (S.syncState === 'off' || S.syncState === 'signed-out') return;
  try {
    S.syncState = 'syncing';
    renderNav();
    const remote = await sync.pull(certId);
    if (S.progress.certId !== certId) return;
    const merged = E.mergeProgress(S.progress, remote && remote.progress);
    S.progress = merged;
    store.saveProgress(merged);
    await sync.push(merged);
    S.syncState = 'synced';
    if (!S.session || location.hash.indexOf('/run') === -1) route(true);
  } catch (e) {
    S.syncState = 'error';
    console.warn(e);
  }
  renderNav();
}

function schedulePush() {
  if (S.syncState === 'off' || S.syncState === 'signed-out') return;
  clearTimeout(S.pushTimer);
  S.pushTimer = setTimeout(async () => {
    try {
      S.syncState = 'syncing';
      renderNav();
      await sync.push(S.progress);
      S.syncState = 'synced';
    } catch (e) {
      S.syncState = 'error';
      console.warn(e);
    }
    renderNav();
  }, 1500);
}

// ---------- navigation ----------
function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, params: new URLSearchParams(qs || '') };
}

function renderNav() {
  const { parts } = parseRoute();
  const certId = parts[0] === 'c' ? parts[1] : null;
  const link = (href, label, active) => `<a href="${href}" ${active ? 'aria-current="page"' : ''}>${label}</a>`;
  const view = parts[2] || 'home';
  const syncLabel = {
    off: '',
    'signed-out': '<a class="sync-pill" href="#/settings">Sign in to sync</a>',
    syncing: '<span class="sync-pill is-busy">Syncing</span>',
    synced: '<span class="sync-pill is-ok">Synced</span>',
    error: '<a class="sync-pill is-err" href="#/settings">Sync paused</a>',
  }[S.syncState];
  $nav.innerHTML = [
    certId ? link(`#/c/${certId}`, 'Dashboard', view === 'home') : link('#/', 'Certifications', !parts.length),
    certId ? link(`#/c/${certId}/practice`, 'Practice', view === 'practice') : '',
    certId ? link(`#/c/${certId}/browse`, 'Question bank', view === 'browse') : '',
    link('#/settings', 'Settings', parts[0] === 'settings'),
    syncLabel,
  ].join('');
}

async function route(quiet = false) {
  clearInterval(S.timer);
  const { parts, params } = parseRoute();
  renderNav();
  try {
    if (!parts.length) return await viewHome();
    if (parts[0] === 'settings') return await viewSettings();
    if (parts[0] === 'c' && parts[1]) {
      const cert = await loadCert(parts[1]);
      renderNav();
      const v = parts[2];
      if (!v) return viewDashboard(cert);
      if (v === 'practice') return viewPracticeSetup(cert);
      if (v === 'run') return viewRun(cert);
      if (v === 'results') return viewResults(cert, parts[3], params);
      if (v === 'browse') return viewBrowse(cert, params);
    }
    $main.innerHTML = `<section class="sheet narrow"><h1>Page not found</h1><p><a href="#/">Go to certifications</a></p></section>`;
  } catch (e) {
    console.error(e);
    $main.innerHTML = `<section class="sheet narrow"><h1>Something didn't load</h1><p>${h(e.message)}</p><p>Check that the question bank files exist under <code>banks/</code>, then reload.</p></section>`;
  } finally {
    if (!quiet) {
      window.scrollTo(0, 0);
      $main.focus({ preventScroll: true });
    }
  }
}

// ---------- views: home ----------
async function viewHome() {
  const idx = await loadIndex();
  const items = idx.certs.map((c) => {
    const p = store.loadProgress(c.id);
    const seen = Object.values(p.q).filter((s) => s.n).length;
    const cov = c.questionCount ? Math.round((seen / c.questionCount) * 100) : 0;
    return `
      <li class="cert-row" style="--cert:${h(c.accent)}">
        <div class="cert-mark" aria-hidden="true"><span></span></div>
        <div class="cert-text">
          <h2><a href="#/c/${h(c.id)}">${h(c.name)}</a></h2>
          <p>${h(c.description)}</p>
          <p class="muted">${c.questionCount} questions. You've answered ${seen} (${cov}%).</p>
        </div>
        <a class="btn" href="#/c/${h(c.id)}">${seen ? 'Continue' : 'Start studying'}</a>
      </li>`;
  });
  $main.innerHTML = `
    <section class="sheet">
      <h1 class="page-title">Pick a certification</h1>
      <p class="lede">Practice with exam-style questions, get feedback on every answer option, and track how ready you are, section by section.</p>
      <ul class="cert-list">${items.join('')}</ul>
      <p class="muted small">Adding another certification is a matter of adding a question folder. See the project README.</p>
    </section>`;
}

// ---------- views: dashboard ----------
function bankMap(cert, questions) {
  return cert.domains.map((d) => {
    const qs = questions.filter((q) => q.domain === d.id);
    const dots = qs.map((q) => {
      const st = E.statusOf(S.progress, q.id);
      const fl = E.isFlagged(S.progress, q.id) ? ' is-flag' : '';
      return `<a class="dot is-${st}${fl}" href="#/c/${cert.id}/browse?id=${h(q.id)}" title="${h(q.id)}: ${st === 'unseen' ? 'not answered yet' : st === 'right' ? 'last answer correct' : 'last answer wrong'}${fl ? ', flagged' : ''}"><span class="sr">${h(q.id)} ${st}</span></a>`;
    }).join('');
    return `<div class="map-group"><h4>Section ${h(d.id)}</h4><div class="dots">${dots}</div></div>`;
  }).join('');
}

function viewDashboard(cert) {
  const qs = S.questions[cert.id];
  const st = E.computeStats(qs, S.progress, cert);
  const exLen = S.settings.examLength || cert.exam.questions;
  const exMin = Math.round(cert.exam.durationMinutes * (exLen / cert.exam.questions));
  const attempts = S.progress.attempts.slice().reverse().slice(0, 8);
  const resume = S.session && S.session.certId === cert.id && !S.session.done
    ? `<div class="banner"><p>You have an unfinished ${S.session.mode === 'exam' ? 'mock exam' : 'practice session'} (question ${S.session.idx + 1} of ${S.session.ids.length}).</p>
       <div class="row"><a class="btn" href="#/c/${cert.id}/run">Resume</a><button class="btn ghost" data-act="discard">Discard it</button></div></div>`
    : '';

  const domRows = st.domains.map((d) => {
    const est = Math.round(d.est * 100);
    const show = d.seen > 0;
    return `
      <li class="dom">
        <div class="dom-head">
          <span class="dom-name">${h(d.id)}. ${h(d.name)}</span>
          <span class="dom-weight">${d.weight}% of exam</span>
        </div>
        <div class="bar" role="img" aria-label="${show ? `${est}% estimated` : 'No answers yet'}"><span style="width:${show ? est : 0}%"></span><i style="left:${cert.exam.passPercent}%"></i></div>
        <div class="dom-foot muted small">
          <span>${show ? `Last answer correct on ${d.right} of ${d.seen} seen` : 'Not started'}</span>
          <span>${d.seen}/${d.total} seen</span>
          <a href="#/c/${cert.id}/practice?d=${d.id}">Practice this section</a>
        </div>
      </li>`;
  }).join('');

  const attRows = attempts.length
    ? attempts.map((a) => `
      <tr>
        <td>${fmtDate(a.finishedAt)}</td>
        <td>${a.mode === 'exam' ? 'Mock exam' : a.mode === 'review' ? 'Review' : 'Practice'}</td>
        <td class="num">${a.correct}/${a.total}</td>
        <td class="num ${a.mode === 'exam' ? (a.passed ? 'ok' : 'bad') : ''}">${a.pct}%</td>
        <td><a href="#/c/${cert.id}/results/${h(a.id)}">Review</a></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="muted">No sessions yet. Your history will show up here.</td></tr>`;

  $main.innerHTML = `
    <section class="sheet">
      <div class="dash-head" style="--cert:${h(cert.accent)}">
        <div>
          <h1 class="page-title">${h(cert.name)}</h1>
          <p class="muted">${h(cert.examGuideVersion || '')}. ${qs.length} questions in the bank. <a href="${h(cert.examGuideUrl)}" target="_blank" rel="noopener">Official exam guide</a></p>
        </div>
      </div>
      ${resume}
      <div class="scoreline">
        <div><b>${st.readiness == null ? '–' : st.readiness + '%'}</b><span>Estimated exam score${st.readiness == null ? '<br><em>answer 10+ questions</em>' : ''}</span></div>
        <div><b>${st.correctAnswers}<small>/${st.answers}</small></b><span>Answers correct (${pct(st.accuracy)})</span></div>
        <div><b>${st.seen}<small>/${st.total}</small></b><span>Questions seen (${st.coverage}%)</span></div>
        <div><b>${st.streak}</b><span>Day streak</span></div>
      </div>

      <div class="actions">
        <a class="action primary" href="#/c/${cert.id}/practice?start=exam">
          <strong>Take a mock exam</strong>
          <span>${exLen} questions, ${exMin} minutes, weighted like the real exam. Feedback at the end.</span>
        </a>
        <a class="action" href="#/c/${cert.id}/practice">
          <strong>Practice</strong>
          <span>Pick sections and see feedback after every answer.</span>
        </a>
        <button class="action" data-act="review" ${st.due ? '' : 'disabled'}>
          <strong>Review mistakes</strong>
          <span>${st.due ? `${plural(st.due, 'question')} due: wrong answers plus spaced repetition.` : 'Nothing due right now.'}</span>
        </button>
        <button class="action" data-act="flagged" ${st.flagged ? '' : 'disabled'}>
          <strong>Flagged questions</strong>
          <span>${st.flagged ? `${plural(st.flagged, 'question')} you flagged.` : 'Flag questions while studying to revisit them.'}</span>
        </button>
      </div>
    </section>

    <section class="sheet">
      <h2>By exam section</h2>
      <p class="muted small">Bars show your estimated score per section. The tick marks the ${cert.exam.passPercent}% practice target. ${h(cert.exam.passNote)}</p>
      <ul class="doms">${domRows}</ul>
    </section>

    <section class="sheet">
      <h2>Question bank map</h2>
      <p class="muted small legend"><span class="dot is-unseen"></span> not answered <span class="dot is-right"></span> last answer correct <span class="dot is-wrong"></span> last answer wrong <span class="dot is-unseen is-flag"></span> flagged. Select a dot to open that question.</p>
      <div class="map">${bankMap(cert, qs)}</div>
    </section>

    <section class="sheet">
      <h2>Recent sessions</h2>
      <div class="table-wrap"><table class="history">
        <thead><tr><th>Finished</th><th>Mode</th><th class="num">Correct</th><th class="num">Score</th><th></th></tr></thead>
        <tbody>${attRows}</tbody>
      </table></div>
    </section>
    <p class="disclaimer">${h(cert.disclaimer)}</p>`;

  $main.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'discard') {
      store.clearSession(cert.id);
      S.session = null;
      route(true);
    } else if (act === 'review') {
      const ids = E.shuffle(E.dueForReview(qs, S.progress)).slice(0, 30).map((q) => q.id);
      startSession(cert, 'review', ids);
    } else if (act === 'flagged') {
      const ids = qs.filter((q) => E.isFlagged(S.progress, q.id)).map((q) => q.id);
      startSession(cert, 'practice', E.shuffle(ids));
    }
  };
}

// ---------- views: practice setup ----------
function viewPracticeSetup(cert) {
  const { params } = parseRoute();
  if (params.get('start') === 'exam') return confirmExam(cert);
  const qs = S.questions[cert.id];
  const preD = params.get('d');
  const doms = cert.domains.map((d) => {
    const n = qs.filter((q) => q.domain === d.id).length;
    const checked = !preD || preD === d.id ? 'checked' : '';
    return `<label class="check"><input type="checkbox" name="d" value="${h(d.id)}" ${checked}><span>${h(d.id)}. ${h(d.name)} <em class="muted">(${n})</em></span></label>`;
  }).join('');
  $main.innerHTML = `
    <section class="sheet narrow">
      <h1 class="page-title">Practice</h1>
      <p class="lede">You'll see whether you were right, and why each option is right or wrong, after every question.</p>
      <form id="setup" class="setup">
        <fieldset><legend>Sections</legend>${doms}</fieldset>
        <fieldset><legend>Questions to include</legend>
          <label class="check"><input type="radio" name="f" value="all" checked><span>All questions</span></label>
          <label class="check"><input type="radio" name="f" value="unseen"><span>Only ones I haven't answered</span></label>
          <label class="check"><input type="radio" name="f" value="wrong"><span>Only ones I got wrong last time</span></label>
          <label class="check"><input type="radio" name="f" value="flagged"><span>Only flagged</span></label>
        </fieldset>
        <fieldset><legend>How many</legend>
          <div class="seg">
            ${[10, 20, 50].map((n) => `<label><input type="radio" name="n" value="${n}" ${n === 20 ? 'checked' : ''}><span>${n}</span></label>`).join('')}
            <label><input type="radio" name="n" value="all"><span>All matching</span></label>
          </div>
        </fieldset>
        <p class="muted" id="matchCount" aria-live="polite"></p>
        <div class="row"><button class="btn" type="submit">Start practice</button>
        <a class="btn ghost" href="#/c/${cert.id}/practice?start=exam">Take a mock exam instead</a></div>
      </form>
    </section>`;
  const form = document.getElementById('setup');
  const read = () => {
    const fd = new FormData(form);
    return { domains: fd.getAll('d'), filter: fd.get('f'), count: fd.get('n') };
  };
  const update = () => {
    const o = read();
    const n = E.filterQuestions(qs, S.progress, o).length;
    const take = o.count === 'all' ? n : Math.min(Number(o.count), n);
    document.getElementById('matchCount').textContent = n ? `${n} questions match. You'll get ${take}.` : 'No questions match these choices.';
    form.querySelector('[type=submit]').disabled = !n || !o.domains.length;
  };
  form.onchange = update;
  update();
  form.onsubmit = (e) => {
    e.preventDefault();
    const ids = E.pickPractice(qs, S.progress, read()).map((q) => q.id);
    startSession(cert, 'practice', ids);
  };
}

function confirmExam(cert) {
  const len = S.settings.examLength || cert.exam.questions;
  const minutes = Math.round(cert.exam.durationMinutes * (len / cert.exam.questions));
  const breakdown = cert.domains.map((d) => `<li>Section ${h(d.id)}: ${h(d.name)} <span class="muted">(about ${Math.round((len * d.weight) / 100)} questions)</span></li>`).join('');
  $main.innerHTML = `
    <section class="sheet narrow">
      <h1 class="page-title">Mock exam</h1>
      <p class="lede">${len} questions in ${minutes} minutes, drawn to match the exam guide's section weights. You won't see feedback until you submit, just like the real thing.</p>
      <ul class="plain">${breakdown}</ul>
      <p class="muted small">The real exam has ${h(cert.exam.format)} Practice target: ${cert.exam.passPercent}%. ${h(cert.exam.passNote)}</p>
      <div class="row">
        <button class="btn" id="go">Start the exam</button>
        <a class="btn ghost" href="#/c/${cert.id}">Not now</a>
      </div>
    </section>`;
  document.getElementById('go').onclick = () => {
    const ids = E.buildExam(S.questions[cert.id], cert, S.progress, len).map((q) => q.id);
    startSession(cert, 'exam', ids, minutes);
  };
}

// ---------- session runner ----------
function startSession(cert, mode, ids, minutes) {
  if (!ids.length) return toast('No questions to show.');
  const order = {};
  for (const id of ids) {
    const opts = S.byId[cert.id][id].options.map((o) => o.id);
    order[id] = S.settings.shuffleOptions ? E.shuffle(opts) : opts;
  }
  S.session = {
    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    certId: cert.id,
    mode,
    ids,
    order,
    idx: 0,
    answers: {},
    checked: {},
    marked: {},
    startedAt: Date.now(),
    deadline: mode === 'exam' ? Date.now() + minutes * 60000 : null,
  };
  store.saveSession(S.session);
  go(`#/c/${cert.id}/run`);
}

function saveSession() {
  store.saveSession(S.session);
}

function renderOptions(q, order, selected, reveal, name) {
  const multi = q.type === 'multi';
  const byId = Object.fromEntries(q.options.map((o) => [o.id, o]));
  return order.map((oid, i) => {
    const o = byId[oid];
    const letter = String.fromCharCode(65 + i);
    const isSel = selected.includes(oid);
    const isAns = q.answer.includes(oid);
    let cls = 'opt';
    let verdict = '';
    if (reveal) {
      if (isAns) { cls += ' is-answer'; verdict = isSel ? 'Correct, and you chose it.' : 'Correct answer.'; }
      else if (isSel) { cls += ' is-miss'; verdict = 'Your choice. Incorrect.'; }
      else cls += ' is-other';
    }
    if (isSel) cls += ' is-sel';
    return `
      <li class="${cls}">
        <label>
          <input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${h(oid)}" ${isSel ? 'checked' : ''} ${reveal ? 'disabled' : ''}>
          <span class="bubble" aria-hidden="true">${letter}</span>
          <span class="opt-text">${h(o.text)}</span>
        </label>
        ${reveal ? `<div class="fb"><strong>${verdict}</strong> ${h(o.feedback)}</div>` : ''}
      </li>`;
  }).join('');
}

function refsFor(cert, q) {
  const obj = objectiveOf(cert, q.objective);
  if (!obj || !obj.refs || !obj.refs.length) return '';
  return `<p class="refs">Read more: ${obj.refs.map((r) => `<a href="${h(r.url)}" target="_blank" rel="noopener">${h(r.title)}</a>`).join(', ')}</p>`;
}

function questionMeta(cert, q) {
  const obj = objectiveOf(cert, q.objective);
  const diff = ['', 'Easier', 'Medium', 'Harder'][q.difficulty];
  return `<p class="qmeta"><span>Objective ${h(q.objective)}${obj ? `: ${h(obj.name)}` : ''}</span><span>${diff}</span><span class="qid">${h(q.id)}</span></p>`;
}

function viewRun(cert) {
  const s = S.session;
  if (!s || s.certId !== cert.id || s.done) {
    $main.innerHTML = `<section class="sheet narrow"><h1>No active session</h1><p><a class="btn" href="#/c/${cert.id}/practice">Start practice</a></p></section>`;
    return;
  }
  const exam = s.mode === 'exam';
  const qid = s.ids[s.idx];
  const q = S.byId[cert.id][qid];
  if (!q) { // bank changed under a saved session
    store.clearSession(cert.id);
    S.session = null;
    return route();
  }
  const sel = s.answers[qid] || [];
  const reveal = !exam && !!s.checked[qid];
  const flagged = E.isFlagged(S.progress, qid);
  const answeredCount = s.ids.filter((id) => (s.answers[id] || []).length).length;
  const checkedIds = s.ids.filter((id) => s.checked[id]);
  const right = checkedIds.filter((id) => E.isCorrect(S.byId[cert.id][id], s.answers[id])).length;
  const wrong = checkedIds.length - right;
  const need = q.answer.length;

  const counter = exam
    ? `<div class="counter"><span><b>${answeredCount}</b>/${s.ids.length} answered</span>
         <span><b>${s.ids.filter((id) => s.marked[id]).length}</b> marked for review</span>
         ${S.settings.showTimer ? `<span class="timer" id="timer" aria-label="Time left"></span>` : ''}</div>`
    : `<div class="counter"><span class="c-right"><b>${right}</b> right</span><span class="c-wrong"><b>${wrong}</b> wrong</span>
         <span><b>${checkedIds.length ? Math.round((right / checkedIds.length) * 100) : 0}%</b> score</span></div>`;

  const navGrid = exam
    ? `<nav class="qnav" aria-label="Questions">${s.ids.map((id, i) => {
        const a = (s.answers[id] || []).length ? ' is-done' : '';
        const m = s.marked[id] ? ' is-mark' : '';
        const c = i === s.idx ? ' is-current' : '';
        return `<button class="qn${a}${m}${c}" data-jump="${i}" aria-label="Question ${i + 1}${a ? ', answered' : ''}${m ? ', marked' : ''}" ${i === s.idx ? 'aria-current="true"' : ''}>${i + 1}</button>`;
      }).join('')}</nav>`
    : `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${s.ids.length}" aria-valuenow="${checkedIds.length}"><span style="width:${(checkedIds.length / s.ids.length) * 100}%"></span></div>`;

  const isLast = s.idx === s.ids.length - 1;
  let primary;
  if (exam) primary = isLast ? `<button class="btn" data-act="finish">Review and submit</button>` : `<button class="btn" data-act="next">Next question</button>`;
  else if (!reveal) primary = `<button class="btn" data-act="check" ${sel.length ? '' : 'disabled'}>Check answer</button>`;
  else primary = isLast ? `<button class="btn" data-act="finish">See results</button>` : `<button class="btn" data-act="next">Next question</button>`;

  const verdict = reveal
    ? (E.isCorrect(q, sel)
      ? `<div class="verdict ok" role="status"><b>Correct.</b> ${h(q.takeaway)}</div>`
      : `<div class="verdict bad" role="status"><b>Not quite.</b> The correct answer${need > 1 ? 's are' : ' is'} marked in green. ${h(q.takeaway)}</div>`)
    : '';

  $main.innerHTML = `
    <section class="run ${exam ? 'is-exam' : ''}">
      <div class="run-head">
        <p class="run-title">${exam ? 'Mock exam' : s.mode === 'review' ? 'Review' : 'Practice'}: question ${s.idx + 1} of ${s.ids.length}</p>
        ${counter}
      </div>
      ${navGrid}
      <article class="sheet question ${flagged ? 'is-flagged' : ''}">
        ${questionMeta(cert, q)}
        <h1 class="stem">${h(q.question)}</h1>
        ${need > 1 ? `<p class="hint">Select ${need} answers.</p>` : ''}
        <ul class="opts" role="${need > 1 ? 'group' : 'radiogroup'}" aria-label="Answer options">${renderOptions(q, s.order[qid], sel, reveal, 'opt-' + qid)}</ul>
        ${verdict}
        ${reveal ? refsFor(cert, q) : ''}
      </article>
      <div class="run-bar">
        <div class="row">
          <button class="btn ghost" data-act="flag" aria-pressed="${flagged}">${flagged ? 'Unflag' : 'Flag'}</button>
          ${exam ? `<button class="btn ghost" data-act="mark" aria-pressed="${!!s.marked[qid]}">${s.marked[qid] ? 'Unmark' : 'Mark for review'}</button>` : ''}
        </div>
        <div class="row">
          ${exam && s.idx > 0 ? `<button class="btn ghost" data-act="prev">Previous</button>` : ''}
          ${primary}
        </div>
      </div>
      <p class="run-foot"><button class="linkish" data-act="end">${exam ? 'Submit exam now' : 'End session and see results'}</button>
        <span class="muted small kbd-hint">Keys: A–F or 1–6 to choose, Enter to continue, F to flag${exam ? ', ← → to move' : ''}</span></p>
    </section>`;

  if (exam) startTimer(cert);

  $main.onchange = (e) => {
    if (!e.target.matches('.opts input')) return;
    const inputs = [...$main.querySelectorAll('.opts input')];
    s.answers[qid] = inputs.filter((i) => i.checked).map((i) => i.value);
    saveSession();
    if (exam) {
      $main.querySelectorAll('.opt').forEach((li, i) => li.classList.toggle('is-sel', inputs[i].checked));
      const n = s.ids.filter((id) => (s.answers[id] || []).length).length;
      const b = $main.querySelector('.counter b');
      if (b) b.textContent = n;
      const cur = $main.querySelector('.qn.is-current');
      if (cur) cur.classList.toggle('is-done', !!s.answers[qid].length);
    } else {
      $main.querySelectorAll('.opt').forEach((li, i) => li.classList.toggle('is-sel', inputs[i].checked));
      const chk = $main.querySelector('[data-act=check]');
      if (chk) chk.disabled = !s.answers[qid].length;
    }
  };

  $main.onclick = (e) => {
    const j = e.target.closest('[data-jump]');
    if (j) { s.idx = Number(j.dataset.jump); saveSession(); return viewRun(cert); }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    runAction(cert, b.dataset.act);
  };
}

function runAction(cert, act) {
  const s = S.session;
  if (!s) return;
  const exam = s.mode === 'exam';
  const qid = s.ids[s.idx];
  const q = S.byId[cert.id][qid];
  if (act === 'check') {
    if (!(s.answers[qid] || []).length || s.checked[qid]) return;
    s.checked[qid] = true;
    E.recordAnswer(S.progress, q, E.isCorrect(q, s.answers[qid]));
    saveProgress();
    saveSession();
    viewRun(cert);
    const v = $main.querySelector('.verdict');
    if (v) v.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } else if (act === 'next') {
    if (s.idx < s.ids.length - 1) { s.idx++; saveSession(); viewRun(cert); window.scrollTo(0, 0); }
  } else if (act === 'prev') {
    if (s.idx > 0) { s.idx--; saveSession(); viewRun(cert); window.scrollTo(0, 0); }
  } else if (act === 'flag') {
    const on = E.toggleFlag(S.progress, qid);
    saveProgress();
    toast(on ? 'Flagged. Find it later under Flagged questions.' : 'Flag removed.');
    viewRun(cert);
  } else if (act === 'mark') {
    s.marked[qid] = !s.marked[qid];
    saveSession();
    viewRun(cert);
  } else if (act === 'finish' || act === 'end') {
    if (exam) return examReview(cert);
    finishSession(cert);
  }
}

function startTimer(cert) {
  clearInterval(S.timer);
  const tick = () => {
    const s = S.session;
    if (!s || !s.deadline) return;
    const left = (s.deadline - Date.now()) / 1000;
    const el = document.getElementById('timer');
    if (el) {
      el.textContent = E.formatDuration(left) + ' left';
      el.classList.toggle('is-low', left < 300);
    }
    if (left <= 0) {
      clearInterval(S.timer);
      toast('Time is up. Your exam was submitted.');
      finishSession(cert);
    }
  };
  tick();
  S.timer = setInterval(tick, 1000);
}

function examReview(cert) {
  const s = S.session;
  const unanswered = s.ids.map((id, i) => ({ id, i })).filter((x) => !(s.answers[x.id] || []).length);
  const marked = s.ids.map((id, i) => ({ id, i })).filter((x) => s.marked[x.id]);
  const list = (arr) => arr.map((x) => `<button class="qn" data-jump="${x.i}">${x.i + 1}</button>`).join('');
  $main.innerHTML = `
    <section class="sheet narrow">
      <h1 class="page-title">Submit your exam?</h1>
      <p class="lede">${s.ids.length - unanswered.length} of ${s.ids.length} questions answered. Unanswered questions count as wrong.</p>
      ${unanswered.length ? `<h2>Unanswered</h2><div class="qnav">${list(unanswered)}</div>` : ''}
      ${marked.length ? `<h2>Marked for review</h2><div class="qnav">${list(marked)}</div>` : ''}
      <div class="row">
        <button class="btn" data-act="submit">Submit exam</button>
        <button class="btn ghost" data-act="back">Back to questions</button>
      </div>
      <p class="muted small" id="timer-note"></p>
    </section>`;
  $main.onclick = (e) => {
    const j = e.target.closest('[data-jump]');
    if (j) { s.idx = Number(j.dataset.jump); saveSession(); return viewRun(cert); }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'submit') finishSession(cert);
    else viewRun(cert);
  };
}

function finishSession(cert) {
  clearInterval(S.timer);
  const s = S.session;
  if (!s) return;
  const exam = s.mode === 'exam';
  const ids = exam ? s.ids : s.ids.filter((id) => s.checked[id]);
  if (!ids.length) {
    store.clearSession(cert.id);
    S.session = null;
    toast('Session ended. No answers were checked.');
    return go(`#/c/${cert.id}`);
  }
  const result = E.scoreSession(S.byId[cert.id], ids, s.answers);
  if (exam) {
    const now = Date.now();
    for (const it of result.items) if (it.sel.length) E.recordAnswer(S.progress, S.byId[cert.id][it.id], it.ok, now);
  }
  const attempt = {
    id: s.id,
    mode: s.mode,
    startedAt: s.startedAt,
    finishedAt: Date.now(),
    durationSec: Math.round((Date.now() - s.startedAt) / 1000),
    ...result,
    passed: exam ? result.pct >= cert.exam.passPercent : undefined,
  };
  S.progress.attempts.push(attempt);
  S.progress.attempts = S.progress.attempts.slice(-E.MAX_ATTEMPTS);
  S.progress.updatedAt = Date.now();
  saveProgress();
  store.clearSession(cert.id);
  S.session = null;
  go(`#/c/${cert.id}/results/${attempt.id}`);
}

// ---------- results ----------
function reviewItem(cert, q, sel, i, open) {
  const ok = E.isCorrect(q, sel);
  return `
    <details class="rev ${ok ? 'ok' : 'bad'}" ${open ? 'open' : ''}>
      <summary><span class="mark" aria-hidden="true"></span><span class="rev-n">${i + 1}.</span> <span class="rev-q">${h(q.question)}</span><span class="sr">${ok ? 'correct' : 'incorrect'}</span></summary>
      ${questionMeta(cert, q)}
      ${!sel.length ? '<p class="muted">You didn\'t answer this one.</p>' : ''}
      <ul class="opts">${renderOptions(q, q.options.map((o) => o.id), sel, true, 'r-' + q.id)}</ul>
      <div class="verdict ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Correct.' : 'Key point:'}</b> ${h(q.takeaway)}</div>
      ${refsFor(cert, q)}
    </details>`;
}

function viewResults(cert, attemptId, params) {
  const a = S.progress.attempts.find((x) => x.id === attemptId);
  if (!a) {
    $main.innerHTML = `<section class="sheet narrow"><h1>Results not found</h1><p><a href="#/c/${cert.id}">Back to dashboard</a></p></section>`;
    return;
  }
  const onlyWrong = params.get('show') !== 'all';
  const exam = a.mode === 'exam';
  const items = a.items.map((it, i) => ({ ...it, i, q: S.byId[cert.id][it.id] })).filter((x) => x.q);
  const shown = onlyWrong ? items.filter((x) => !x.ok) : items;
  const doms = cert.domains.filter((d) => a.byDomain[d.id]).map((d) => {
    const b = a.byDomain[d.id];
    const p = Math.round((b.c / b.n) * 100);
    return `<tr><td>${h(d.id)}. ${h(d.name)}</td><td class="num">${b.c}/${b.n}</td><td class="num ${p >= cert.exam.passPercent ? 'ok' : 'bad'}">${p}%</td></tr>`;
  }).join('');
  const missed = items.filter((x) => !x.ok).map((x) => x.id);
  $main.innerHTML = `
    <section class="sheet">
      <p class="muted">${exam ? 'Mock exam' : a.mode === 'review' ? 'Review session' : 'Practice session'} finished ${fmtDate(a.finishedAt)} in ${E.formatDuration(a.durationSec)}</p>
      <div class="result-head ${exam ? (a.passed ? 'ok' : 'bad') : ''}">
        <div class="big-score"><b>${a.pct}%</b><span>${a.correct} of ${a.total} correct</span></div>
        <div>
          ${exam ? `<h1 class="page-title">${a.passed ? 'Above the practice target' : 'Below the practice target'}</h1>
            <p>The target is ${cert.exam.passPercent}%. ${h(cert.exam.passNote)}</p>` : `<h1 class="page-title">Session complete</h1><p>Every answer you checked was added to your progress and spaced-repetition schedule.</p>`}
          <div class="row">
            ${missed.length ? `<button class="btn" data-act="retry">Practice the ${missed.length} I missed</button>` : ''}
            <a class="btn ghost" href="#/c/${cert.id}">Back to dashboard</a>
          </div>
        </div>
      </div>
      <div class="table-wrap"><table class="history"><thead><tr><th>Section</th><th class="num">Correct</th><th class="num">Score</th></tr></thead><tbody>${doms}</tbody></table></div>
    </section>
    <section class="sheet">
      <div class="row spread">
        <h2>Answers and feedback</h2>
        <div class="seg small">
          <a href="#/c/${cert.id}/results/${a.id}" ${onlyWrong ? 'aria-current="true"' : ''}>Incorrect only (${missed.length})</a>
          <a href="#/c/${cert.id}/results/${a.id}?show=all" ${!onlyWrong ? 'aria-current="true"' : ''}>All (${items.length})</a>
        </div>
      </div>
      ${shown.length ? shown.map((x) => reviewItem(cert, x.q, x.sel, x.i, onlyWrong && shown.length <= 5)).join('') : '<p>No incorrect answers in this session. Nice work.</p>'}
    </section>`;
  $main.onclick = (e) => {
    if (e.target.closest('[data-act=retry]')) startSession(cert, 'practice', E.shuffle(missed));
  };
}

// ---------- browse ----------
function viewBrowse(cert, params) {
  const qs = S.questions[cert.id];
  const openId = params.get('id');
  const state = { search: openId || '', domains: [], filter: 'all' };
  const domOpts = cert.domains.map((d) => `<option value="${h(d.id)}">Section ${h(d.id)}: ${h(d.name)}</option>`).join('');
  $main.innerHTML = `
    <section class="sheet">
      <h1 class="page-title">Question bank</h1>
      <p class="lede">Every question with its answer and the feedback for each option. Looking here before practicing will spoil your score, so it's best for studying topics you've already missed.</p>
      <div class="filters">
        <label>Search <input type="search" id="q" value="${h(state.search)}" placeholder="Try: Shared VPC, lifecycle, ace-3104"></label>
        <label>Section <select id="d"><option value="">All sections</option>${domOpts}</select></label>
        <label>Show <select id="f">
          <option value="all">All</option><option value="unseen">Not answered yet</option>
          <option value="wrong">Wrong last time</option><option value="flagged">Flagged</option></select></label>
      </div>
      <p class="muted small" id="count" aria-live="polite"></p>
      <div id="list"></div>
    </section>`;
  const $list = document.getElementById('list');
  const draw = () => {
    const res = E.filterQuestions(qs, S.progress, state);
    document.getElementById('count').textContent = `${res.length} of ${qs.length} questions`;
    const shown = res.slice(0, 300);
    $list.innerHTML = shown.map((q, i) => {
      const flagged = E.isFlagged(S.progress, q.id);
      return reviewItem(cert, q, [], i, res.length === 1)
        .replace('<span class="mark"', `<span class="mark st-${E.statusOf(S.progress, q.id)}"`)
        .replace('</details>', `<div class="row"><button class="btn ghost small" data-flag="${h(q.id)}" aria-pressed="${flagged}">${flagged ? 'Unflag' : 'Flag for later'}</button></div></details>`);
    }).join('') || '<p>No questions match. Try a different search or filter.</p>';
  };
  draw();
  document.getElementById('q').oninput = (e) => { state.search = e.target.value; draw(); };
  document.getElementById('d').onchange = (e) => { state.domains = e.target.value ? [e.target.value] : []; draw(); };
  document.getElementById('f').onchange = (e) => { state.filter = e.target.value; draw(); };
  $main.onclick = (e) => {
    const b = e.target.closest('[data-flag]');
    if (!b) return;
    const on = E.toggleFlag(S.progress, b.dataset.flag);
    saveProgress();
    b.textContent = on ? 'Unflag' : 'Flag for later';
    b.setAttribute('aria-pressed', on);
  };
}

// ---------- settings ----------
async function viewSettings() {
  const idx = await loadIndex();
  refreshSyncState();
  const s = S.settings;
  const u = sync.user();
  const syncBlock = !sync.enabled()
    ? `<p>Cloud sync isn't set up for this site, so your progress is saved in this browser only. Deploy the optional backend (see the README) to sync across devices.</p>`
    : u
      ? `<p>Signed in as <b>${h(u.email || u.sub)}</b>. Progress syncs automatically.</p><div class="row"><button class="btn ghost" data-act="sync-now">Sync now</button><button class="btn ghost" data-act="signout">Sign out</button></div>`
      : `<p>Sign in to keep your progress in sync across devices.</p><div class="row"><button class="btn" data-act="signin">Sign in or create an account</button></div>`;
  const certOpts = idx.certs.map((c) => `<option value="${h(c.id)}">${h(c.name)}</option>`).join('');
  $main.innerHTML = `
    <section class="sheet narrow">
      <h1 class="page-title">Settings</h1>
      <form id="prefs" class="setup">
        <fieldset><legend>Appearance</legend>
          <div class="seg">
            ${['system', 'light', 'dark'].map((t) => `<label><input type="radio" name="theme" value="${t}" ${s.theme === t ? 'checked' : ''}><span>${t === 'system' ? 'Match device' : t[0].toUpperCase() + t.slice(1)}</span></label>`).join('')}
          </div>
        </fieldset>
        <fieldset><legend>Questions</legend>
          <label class="check"><input type="checkbox" name="shuffleOptions" ${s.shuffleOptions ? 'checked' : ''}><span>Shuffle answer options each time</span></label>
          <label class="check"><input type="checkbox" name="showTimer" ${s.showTimer ? 'checked' : ''}><span>Show the countdown in mock exams</span></label>
          <label class="field">Mock exam length
            <select name="examLength">
              <option value="">Same as the real exam</option>
              ${[10, 20, 30, 60].map((n) => `<option value="${n}" ${s.examLength === n ? 'selected' : ''}>${n} questions (time scales to match)</option>`).join('')}
            </select></label>
        </fieldset>
      </form>
    </section>
    <section class="sheet narrow">
      <h2>Sync</h2>
      ${syncBlock}
      ${store.persistent ? '' : '<p class="warn">This browser is blocking storage, so progress will be lost when you close the tab.</p>'}
    </section>
    <section class="sheet narrow">
      <h2>Your data</h2>
      <label class="field">Certification <select id="dataCert">${certOpts}</select></label>
      <div class="row">
        <button class="btn ghost" data-act="export">Export progress</button>
        <label class="btn ghost file-btn">Import progress<input type="file" id="importFile" accept="application/json"></label>
        <button class="btn ghost danger" data-act="reset">${S.resetArmed ? 'Select again to erase' : 'Reset progress'}</button>
      </div>
      <p class="muted small">Import merges with what's already here, keeping the newest answer for each question. Reset erases this certification's progress in this browser${sync.enabled() ? ' and in the cloud' : ''}.</p>
    </section>`;

  const form = document.getElementById('prefs');
  form.onchange = () => {
    const fd = new FormData(form);
    S.settings = {
      theme: fd.get('theme'),
      shuffleOptions: !!fd.get('shuffleOptions'),
      showTimer: !!fd.get('showTimer'),
      examLength: fd.get('examLength') ? Number(fd.get('examLength')) : null,
    };
    store.saveSettings(S.settings);
    applyTheme();
    toast('Settings saved.');
  };

  const selCert = () => document.getElementById('dataCert').value;
  document.getElementById('importFile').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.v !== 1 || !data.certId || !data.q) throw new Error('This file isn\'t a CertPrep progress export.');
      const merged = E.mergeProgress(store.loadProgress(data.certId), data);
      store.saveProgress(merged);
      if (S.progress && S.progress.certId === data.certId) { S.progress = merged; schedulePush(); }
      toast(`Imported progress for ${data.certId}.`);
    } catch (err) {
      toast(err.message);
    }
    e.target.value = '';
  };

  $main.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act !== 'reset' && S.resetArmed) { S.resetArmed = false; }
    if (act === 'signin') sync.signIn();
    else if (act === 'signout') sync.signOut();
    else if (act === 'sync-now') {
      if (S.progress) await pullRemote(S.progress.certId);
      toast(S.syncState === 'synced' ? 'Synced.' : 'Sync failed. Try again in a moment.');
    } else if (act === 'export') {
      const id = selCert();
      const blob = new Blob([JSON.stringify(store.loadProgress(id), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `certprep-${id}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (act === 'reset') {
      if (!S.resetArmed) {
        S.resetArmed = true;
        b.textContent = 'Select again to erase';
        setTimeout(() => { S.resetArmed = false; if (b.isConnected) b.textContent = 'Reset progress'; }, 5000);
        return;
      }
      S.resetArmed = false;
      const id = selCert();
      const fresh = E.emptyProgress(id);
      fresh.updatedAt = Date.now();
      store.saveProgress(fresh);
      store.clearSession(id);
      if (S.progress && S.progress.certId === id) {
        S.progress = fresh;
        S.session = null;
      }
      if (sync.enabled() && sync.user()) {
        try { await sync.remove(id); } catch { toast('Erased here, but the cloud copy could not be erased. Try again.'); return; }
      }
      b.textContent = 'Reset progress';
      toast('Progress erased.');
    }
  };
}

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.matches('input[type=search], input[type=text], select, textarea')) return;
  const { parts } = parseRoute();
  if (parts[2] !== 'run' || !S.session || !$main.querySelector('.question')) return;
  const cert = S.certs[parts[1]];
  const k = e.key.toLowerCase();
  const inputs = [...$main.querySelectorAll('.opts input')];
  let n = -1;
  if (/^[1-6]$/.test(k)) n = Number(k) - 1;
  else if (/^[a-e]$/.test(k)) n = k.charCodeAt(0) - 97;
  if (n >= 0 && n < inputs.length && !inputs[n].disabled) {
    e.preventDefault();
    const inp = inputs[n];
    inp.checked = inp.type === 'checkbox' ? !inp.checked : true;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (k === 'f' && !e.shiftKey) { e.preventDefault(); return runAction(cert, 'flag'); }
  if (k === 'enter' && !e.target.matches('button, a, summary')) {
    const btn = $main.querySelector('[data-act=check]:not([disabled]), [data-act=next], [data-act=finish]');
    if (btn) { e.preventDefault(); btn.click(); }
    return;
  }
  if (S.session.mode === 'exam') {
    if (k === 'arrowright') { e.preventDefault(); runAction(cert, 'next'); }
    if (k === 'arrowleft') { e.preventDefault(); runAction(cert, 'prev'); }
  }
});

// ---------- boot ----------
(async function boot() {
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  await sync.loadConfig();
  try {
    if (await sync.handleRedirect()) toast('Signed in. Your progress will sync.');
  } catch (e) {
    toast(e.message);
  }
  refreshSyncState();
  window.addEventListener('hashchange', () => route());
  route();
})();
