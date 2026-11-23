// Server-side copy of the client's merge rules (web/js/engine.js mergeProgress).
// Kept dependency-free so the Lambda bundle is just these files.
export const MAX_ATTEMPTS = 100;

export function mergeProgress(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = { v: 1, certId: a.certId || b.certId, updatedAt: 0, q: {}, attempts: [], days: [] };
  const ids = new Set([...Object.keys(a.q || {}), ...Object.keys(b.q || {})]);
  for (const id of ids) {
    const x = (a.q || {})[id];
    const y = (b.q || {})[id];
    out.q[id] = !x ? y : !y ? x : (y.at || 0) > (x.at || 0) ? y : x;
  }
  const att = new Map();
  for (const t of [...(a.attempts || []), ...(b.attempts || [])]) att.set(t.id, t);
  out.attempts = [...att.values()].sort((p, q) => p.finishedAt - q.finishedAt).slice(-MAX_ATTEMPTS);
  out.days = [...new Set([...(a.days || []), ...(b.days || [])])].sort().slice(-400);
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return out;
}
