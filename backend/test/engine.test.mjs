import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../../web/js/engine.js';
import { mergeProgress as serverMerge } from '../src/merge.mjs';

const cert = JSON.parse(readFileSync(new URL('../../web/banks/gcp-ace/cert.json', import.meta.url)));
const qs = JSON.parse(readFileSync(new URL('../../web/banks/gcp-ace/questions.json', import.meta.url)));

test('question bank is well formed', () => {
  assert.ok(qs.length >= 200, `expected 200+ questions, got ${qs.length}`);
  for (const q of qs) {
    assert.ok(q.options.length >= 3);
    assert.ok(q.answer.length >= 1);
    for (const a of q.answer) assert.ok(q.options.some((o) => o.id === a), `${q.id} answer ${a} missing`);
    for (const o of q.options) assert.ok(o.feedback.length > 10, `${q.id}/${o.id} has no feedback`);
    assert.equal(q.type === 'multi', q.answer.length > 1);
  }
});

test('isCorrect needs the exact answer set', () => {
  const q = { answer: ['A', 'C'] };
  assert.equal(E.isCorrect(q, ['C', 'A']), true);
  assert.equal(E.isCorrect(q, ['A']), false);
  assert.equal(E.isCorrect(q, ['A', 'B', 'C']), false);
  assert.equal(E.isCorrect({ answer: ['B'] }, ['B']), true);
});

test('mock exam follows domain weights', () => {
  const p = E.emptyProgress('gcp-ace');
  const ex = E.buildExam(qs, cert, p, 50, E.rng(42));
  assert.equal(ex.length, 50);
  assert.equal(new Set(ex.map((q) => q.id)).size, 50, 'no duplicates');
  const by = {};
  for (const q of ex) by[q.domain] = (by[q.domain] || 0) + 1;
  assert.deepEqual(by, { 1: 10, 2: 15, 3: 15, 4: 10 });
});

test('leitner scheduling and review queue', () => {
  const p = E.emptyProgress('gcp-ace');
  const t0 = Date.UTC(2026, 10, 1);
  E.recordAnswer(p, qs[0], true, t0);
  E.recordAnswer(p, qs[1], false, t0);
  assert.equal(p.q[qs[0].id].box, 1);
  assert.equal(p.q[qs[1].id].box, 0);
  let due = E.dueForReview(qs, p, t0 + 1000).map((q) => q.id);
  assert.deepEqual(due, [qs[1].id], 'wrong answers are due immediately');
  due = E.dueForReview(qs, p, t0 + E.DAY + 1).map((q) => q.id).sort();
  assert.deepEqual(due, [qs[0].id, qs[1].id].sort(), 'right answers come back after a day');
});

test('practice picks unseen questions first and respects filters', () => {
  const p = E.emptyProgress('gcp-ace');
  const s1 = qs.filter((q) => q.domain === '1');
  for (const q of s1.slice(0, 40)) E.recordAnswer(p, q, true);
  const pick = E.pickPractice(qs, p, { domains: ['1'], count: 10 }, E.rng(1));
  assert.equal(pick.length, 10);
  assert.equal(pick.filter((q) => E.statusOf(p, q.id) === 'unseen').length, 10);
  const wrong = E.pickPractice(qs, p, { filter: 'wrong', count: 'all' });
  assert.equal(wrong.length, 0);
});

test('stats and readiness', () => {
  const p = E.emptyProgress('gcp-ace');
  let st = E.computeStats(qs, p, cert);
  assert.equal(st.readiness, null);
  for (const q of qs.slice(0, 30)) E.recordAnswer(p, q, true);
  st = E.computeStats(qs, p, cert);
  assert.ok(st.readiness > 50 && st.readiness <= 100);
  assert.equal(st.accuracy, 100);
  assert.equal(st.seen, 30);
});

test('merge keeps the newest entry per question and unions attempts', () => {
  const a = E.emptyProgress('gcp-ace');
  const b = E.emptyProgress('gcp-ace');
  a.q.x = { n: 1, c: 1, last: 'c', at: 10 };
  b.q.x = { n: 2, c: 1, last: 'w', at: 20 };
  a.q.y = { n: 1, c: 0, last: 'w', at: 5 };
  a.attempts = [{ id: 'a1', finishedAt: 1 }];
  b.attempts = [{ id: 'a1', finishedAt: 1 }, { id: 'b1', finishedAt: 2 }];
  a.days = ['2026-11-01'];
  b.days = ['2026-11-02', '2026-11-01'];
  for (const merge of [E.mergeProgress, serverMerge]) {
    const m = merge(a, b);
    assert.equal(m.q.x.last, 'w');
    assert.equal(m.q.y.last, 'w');
    assert.deepEqual(m.attempts.map((t) => t.id), ['a1', 'b1']);
    assert.deepEqual(m.days, ['2026-11-01', '2026-11-02']);
  }
  assert.deepEqual(E.mergeProgress(a, b), serverMerge(a, b), 'client and server merge agree');
});

test('streak counts consecutive days', () => {
  const today = new Date(Date.UTC(2026, 10, 23));
  assert.equal(E.streak(['2026-11-21', '2026-11-22', '2026-11-23'], today), 3);
  assert.equal(E.streak(['2026-11-21', '2026-11-22'], today), 2);
  assert.equal(E.streak(['2026-11-20'], today), 0);
});
