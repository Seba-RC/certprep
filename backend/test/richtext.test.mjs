import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { richBlock, richInline, codeBlocks, splitBlocks } from '../../web/js/richtext.js';
import { foldText, filterQuestions, emptyProgress } from '../../web/js/engine.js';

test('escapes HTML everywhere, including inside code', () => {
  assert.equal(richInline('<b>x</b> `a<b`'), '&lt;b&gt;x&lt;/b&gt; <code>a&lt;b</code>');
  const html = richBlock('Mira:\n```c\nif (a < b) printf("<hi>");\n```\nFin');
  assert.ok(html.includes('<pre class="code"><code>if (a &lt; b) printf(&quot;&lt;hi&gt;&quot;);</code></pre>'));
  assert.ok(!html.includes('<hi>'));
});

test('keeps code line breaks and indentation', () => {
  const parts = splitBlocks('Antes\n```c\nint main() {\n    fork();\n}\n```\nDespués');
  assert.deepEqual(parts.map((p) => p.kind), ['text', 'code', 'text']);
  assert.equal(parts[1].value, 'int main() {\n    fork();\n}');
  assert.equal(codeBlocks('sin código'), '');
  assert.ok(richInline('a\n```c\nx\n```\nb', '[código]').includes('[código]'));
});

test('search ignores accents and case', () => {
  assert.equal(foldText('Replicación SÍNCRONA'), 'replicacion sincrona');
  const qs = [{ id: 'sd-1', question: 'Replicación asíncrona', tags: [], options: [{ text: 'x' }], domain: '1' }];
  assert.equal(filterQuestions(qs, emptyProgress('sd'), { search: 'replicacion' }).length, 1);
});

test('every built bank is well formed', () => {
  const index = JSON.parse(readFileSync(new URL('../../web/banks/index.json', import.meta.url)));
  for (const c of index.certs) {
    const cert = JSON.parse(readFileSync(new URL(`../../web/banks/${c.id}/cert.json`, import.meta.url)));
    const qs = JSON.parse(readFileSync(new URL(`../../web/banks/${c.id}/questions.json`, import.meta.url)));
    assert.equal(qs.length, c.questionCount, `${c.id}: index count`);
    const weight = cert.domains.reduce((s, d) => s + d.weight, 0);
    assert.equal(weight, 100, `${c.id}: domain weights must add to 100`);
    for (const d of cert.domains) assert.ok(qs.some((q) => q.domain === d.id), `${c.id}: section ${d.id} has no questions`);
    for (const q of qs) {
      assert.ok(q.answer.length >= 1 && q.options.length >= 3, q.id);
      for (const o of q.options) assert.ok(o.feedback.length >= 15, `${q.id} ${o.id}`);
    }
  }
});
