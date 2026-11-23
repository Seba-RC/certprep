// Pure logic: no DOM, no storage. Unit-tested in backend/test/engine.test.mjs.

export const DAY = 86400000;
// Leitner boxes: how long until a question is due again after a correct answer.
export const BOX_INTERVALS = [0, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];
export const MAX_BOX = BOX_INTERVALS.length - 1;
export const MAX_ATTEMPTS = 100;

/** Small seeded PRNG (mulberry32) so sessions can be reproduced in tests. */
export function rng(seed = Date.now()) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isCorrect(question, selected) {
  const want = new Set(question.answer);
  const got = new Set(selected || []);
  if (want.size !== got.size) return false;
  for (const x of want) if (!got.has(x)) return false;
  return true;
}

export function emptyProgress(certId) {
  return { v: 1, certId, updatedAt: 0, q: {}, attempts: [], days: [] };
}

/** Status of one question for the bank map: unseen | right | wrong. */
export function statusOf(progress, id) {
  const s = progress.q[id];
  if (!s || !s.n) return 'unseen';
  return s.last === 'c' ? 'right' : 'wrong';
}

export function recordAnswer(progress, question, correct, now = Date.now()) {
  const prev = progress.q[question.id] || { n: 0, c: 0, box: 0, due: 0 };
  const s = { ...prev };
  s.n = (s.n || 0) + 1;
  if (correct) {
    s.c = (s.c || 0) + 1;
    s.box = Math.min(MAX_BOX, (s.box || 0) + 1);
  } else {
    s.box = 0;
  }
  s.last = correct ? 'c' : 'w';
  s.due = now + BOX_INTERVALS[s.box];
  s.at = now;
  progress.q[question.id] = s;
  progress.updatedAt = now;
  const day = new Date(now).toISOString().slice(0, 10);
  if (!progress.days.includes(day)) {
    progress.days.push(day);
    progress.days = progress.days.slice(-400);
  }
  return s;
}

export function toggleFlag(progress, id, now = Date.now()) {
  const s = { n: 0, c: 0, box: 0, due: 0, ...(progress.q[id] || {}) };
  s.flag = !s.flag;
  s.at = now;
  progress.q[id] = s;
  progress.updatedAt = now;
  return s.flag;
}

export function isFlagged(progress, id) {
  return !!(progress.q[id] && progress.q[id].flag);
}

/** Questions to review now: answered wrong last time, or due by the Leitner schedule. */
export function dueForReview(questions, progress, now = Date.now()) {
  return questions.filter((q) => {
    const s = progress.q[q.id];
    if (!s || !s.n) return false;
    if (s.last === 'w') return true;
    return s.box < MAX_BOX && s.due <= now;
  });
}

/** Lowercase and strip accents so "replicacion" finds "replicación". */
export function foldText(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function filterQuestions(questions, progress, opts = {}) {
  const { domains, filter = 'all', search = '' } = opts;
  const term = foldText(search.trim());
  return questions.filter((q) => {
    if (domains && domains.length && !domains.includes(q.domain)) return false;
    const st = statusOf(progress, q.id);
    if (filter === 'unseen' && st !== 'unseen') return false;
    if (filter === 'wrong' && st !== 'wrong') return false;
    if (filter === 'flagged' && !isFlagged(progress, q.id)) return false;
    if (term) {
      const hay = foldText(q.id + ' ' + q.question + ' ' + q.tags.join(' ') + ' ' + q.options.map((o) => o.text).join(' '));
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

/** Practice set: unseen first, then least recently answered, shuffled within those tiers. */
export function pickPractice(questions, progress, opts = {}, rand = Math.random) {
  const pool = filterQuestions(questions, progress, opts);
  const count = opts.count === 'all' ? pool.length : Math.min(Number(opts.count) || 20, pool.length);
  const unseen = shuffle(pool.filter((q) => statusOf(progress, q.id) === 'unseen'), rand);
  const seen = shuffle(pool.filter((q) => statusOf(progress, q.id) !== 'unseen'), rand)
    .sort((a, b) => (progress.q[a.id].at || 0) - (progress.q[b.id].at || 0));
  return unseen.concat(seen).slice(0, count);
}

/**
 * Mock exam: number of questions per domain follows the exam-guide weights
 * (largest-remainder rounding), preferring questions the user has seen least.
 */
export function buildExam(questions, cert, progress, count, rand = Math.random) {
  const n = Math.min(count || cert.exam.questions, questions.length);
  const domains = cert.domains;
  const total = domains.reduce((s, d) => s + d.weight, 0);
  const raw = domains.map((d) => ({ id: d.id, exact: (n * d.weight) / total }));
  raw.forEach((r) => (r.k = Math.floor(r.exact)));
  let left = n - raw.reduce((s, r) => s + r.k, 0);
  raw.slice().sort((a, b) => (b.exact - b.k) - (a.exact - a.k)).forEach((r) => {
    if (left > 0) { r.k++; left--; }
  });
  const picked = [];
  for (const r of raw) {
    const pool = questions.filter((q) => q.domain === r.id);
    const ranked = shuffle(pool, rand).sort((a, b) => ((progress.q[a.id] || {}).n || 0) - ((progress.q[b.id] || {}).n || 0));
    picked.push(...ranked.slice(0, r.k));
  }
  // Top up if a domain lacked enough questions.
  if (picked.length < n) {
    const ids = new Set(picked.map((q) => q.id));
    picked.push(...shuffle(questions.filter((q) => !ids.has(q.id)), rand).slice(0, n - picked.length));
  }
  return shuffle(picked, rand);
}

export function scoreSession(questionsById, ids, answers) {
  const byDomain = {};
  let correct = 0;
  const items = ids.map((id) => {
    const q = questionsById[id];
    const sel = answers[id] || [];
    const ok = isCorrect(q, sel);
    if (ok) correct++;
    const d = (byDomain[q.domain] ||= { n: 0, c: 0 });
    d.n++;
    if (ok) d.c++;
    return { id, sel, ok };
  });
  return { total: ids.length, correct, pct: ids.length ? Math.round((correct / ids.length) * 100) : 0, byDomain, items };
}

/** Per-domain and overall stats from the latest answer to each question. */
export function computeStats(questions, progress, cert) {
  const domains = cert.domains.map((d) => {
    const qs = questions.filter((q) => q.domain === d.id);
    let seen = 0, right = 0, answers = 0, correctAnswers = 0;
    for (const q of qs) {
      const s = progress.q[q.id];
      if (s && s.n) {
        seen++;
        answers += s.n;
        correctAnswers += s.c || 0;
        if (s.last === 'c') right++;
      }
    }
    // Shrink toward 50% when few questions have been seen, so 1/1 isn't "100% ready".
    const est = (right + 1) / (seen + 2);
    return { id: d.id, name: d.name, weight: d.weight, total: qs.length, seen, right, answers, correctAnswers, est };
  });
  const totalWeight = domains.reduce((s, d) => s + d.weight, 0) || 1;
  const answers = domains.reduce((s, d) => s + d.answers, 0);
  const correctAnswers = domains.reduce((s, d) => s + d.correctAnswers, 0);
  const seen = domains.reduce((s, d) => s + d.seen, 0);
  const right = domains.reduce((s, d) => s + d.right, 0);
  const readiness = Math.round((domains.reduce((s, d) => s + d.est * d.weight, 0) / totalWeight) * 100);
  return {
    domains,
    answers,
    correctAnswers,
    accuracy: answers ? Math.round((correctAnswers / answers) * 100) : null,
    seen,
    right,
    total: questions.length,
    coverage: questions.length ? Math.round((seen / questions.length) * 100) : 0,
    readiness: seen >= 10 ? readiness : null,
    due: dueForReview(questions, progress).length,
    flagged: questions.filter((q) => isFlagged(progress, q.id)).length,
    streak: streak(progress.days),
  };
}

export function streak(days, today = new Date()) {
  if (!days || !days.length) return 0;
  const set = new Set(days);
  let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // Allow the streak to continue if today hasn't been studied yet.
  if (!set.has(d.toISOString().slice(0, 10))) d = new Date(d.getTime() - DAY);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d = new Date(d.getTime() - DAY);
  }
  return n;
}

/** Merge two progress docs (local + remote). Per question, the most recent entry wins. */
export function mergeProgress(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = emptyProgress(a.certId || b.certId);
  const ids = new Set([...Object.keys(a.q || {}), ...Object.keys(b.q || {})]);
  for (const id of ids) {
    const x = (a.q || {})[id], y = (b.q || {})[id];
    out.q[id] = !x ? y : !y ? x : (y.at || 0) > (x.at || 0) ? y : x;
  }
  const att = new Map();
  for (const t of [...(a.attempts || []), ...(b.attempts || [])]) att.set(t.id, t);
  out.attempts = [...att.values()].sort((p, q) => p.finishedAt - q.finishedAt).slice(-MAX_ATTEMPTS);
  out.days = [...new Set([...(a.days || []), ...(b.days || [])])].sort().slice(-400);
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return out;
}

export function formatDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
