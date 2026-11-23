// Minimal, safe formatting for question text: HTML is always escaped first, then
//   ```lang ... ```  (fenced block, stems only) -> <pre class="code"><code>...</code></pre>
//   `inline`                                    -> <code>inline</code>
// Nothing else is interpreted, so question files can't inject markup.

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FENCE = /```[a-z0-9+-]*\n([\s\S]*?)\n?```/g;

function inline(s) {
  return escapeHtml(s).replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

/** Split text into prose and code-block parts. */
export function splitBlocks(s) {
  const text = String(s ?? '');
  const out = [];
  let last = 0;
  for (const m of text.matchAll(FENCE)) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
    out.push({ kind: 'code', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

/** Full rendering: prose paragraphs plus code blocks. Use inside a block-level container. */
export function richBlock(s) {
  return splitBlocks(s)
    .map((p) => (p.kind === 'code'
      ? `<pre class="code"><code>${escapeHtml(p.value)}</code></pre>`
      : p.value.trim() ? `<p>${inline(p.value.trim())}</p>` : ''))
    .join('');
}

/** Single-line rendering (options, feedback, takeaways, summaries). Code blocks become a short marker. */
export function richInline(s, codeMarker = '[code]') {
  return splitBlocks(s)
    .map((p) => (p.kind === 'code' ? ` <span class="muted">${escapeHtml(codeMarker)}</span> ` : inline(p.value)))
    .join('')
    .trim();
}

/** Only the code blocks of a text, rendered. Empty string if there are none. */
export function codeBlocks(s) {
  return splitBlocks(s).filter((p) => p.kind === 'code')
    .map((p) => `<pre class="code"><code>${escapeHtml(p.value)}</code></pre>`).join('');
}

/** Plain text for searching: drops the fence markers, keeps the code. */
export function plainText(s) {
  return String(s ?? '').replace(/```[a-z0-9+-]*\n?/g, ' ').replace(/`/g, '');
}
