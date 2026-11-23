import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
process.env.TABLE_NAME = 'test-table';
const { handler, setClient } = await import('../src/handler.mjs');

let db;
beforeEach(() => {
  db = new Map();
  setClient({
    async send(cmd) {
      const name = cmd.constructor.name;
      const { Key, Item, TableName } = cmd.input;
      assert.equal(TableName, 'test-table');
      if (name === 'GetCommand') return { Item: db.get(Key.pk + '|' + Key.sk) };
      if (name === 'PutCommand') { db.set(Item.pk + '|' + Item.sk, Item); return {}; }
      if (name === 'DeleteCommand') { db.delete(Key.pk + '|' + Key.sk); return {}; }
      throw new Error('unexpected ' + name);
    },
  });
});

const ev = (method, certId, body, sub = 'user-1') => ({
  requestContext: { http: { method }, authorizer: sub ? { jwt: { claims: { sub } } } : undefined },
  pathParameters: { certId },
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});
const doc = (q, extra = {}) => ({ v: 1, certId: 'gcp-ace', updatedAt: 1, q, attempts: [], days: [], ...extra });

test('rejects requests without a JWT subject', async () => {
  assert.equal((await handler(ev('GET', 'gcp-ace', undefined, null))).statusCode, 401);
});

test('validates cert id and body', async () => {
  assert.equal((await handler(ev('GET', '../etc'))).statusCode, 400);
  assert.equal((await handler(ev('PUT', 'gcp-ace', '{not json'))).statusCode, 400);
  assert.equal((await handler(ev('PUT', 'gcp-ace', { v: 1, certId: 'other', q: {} }))).statusCode, 400);
  assert.equal((await handler(ev('PUT', 'gcp-ace', 'x'.repeat(400 * 1024)))).statusCode, 413);
});

test('GET returns 404 before any data, then the stored doc', async () => {
  assert.equal((await handler(ev('GET', 'gcp-ace'))).statusCode, 404);
  const put = await handler(ev('PUT', 'gcp-ace', doc({ a: { n: 1, last: 'c', at: 5 } })));
  assert.equal(put.statusCode, 200);
  const got = await handler(ev('GET', 'gcp-ace'));
  assert.equal(got.statusCode, 200);
  assert.equal(JSON.parse(got.body).progress.q.a.last, 'c');
});

test('PUT merges with stored progress instead of overwriting', async () => {
  await handler(ev('PUT', 'gcp-ace', doc({ a: { n: 1, last: 'c', at: 5 } })));
  const r = await handler(ev('PUT', 'gcp-ace', doc({ b: { n: 1, last: 'w', at: 6 } })));
  const q = JSON.parse(r.body).progress.q;
  assert.deepEqual(Object.keys(q).sort(), ['a', 'b']);
});

test('users are isolated from each other', async () => {
  await handler(ev('PUT', 'gcp-ace', doc({ a: { n: 1, last: 'c', at: 5 } }), 'alice'));
  assert.equal((await handler(ev('GET', 'gcp-ace', undefined, 'bob'))).statusCode, 404);
});

test('DELETE resets progress', async () => {
  await handler(ev('PUT', 'gcp-ace', doc({ a: { n: 1, last: 'c', at: 5 } })));
  assert.equal((await handler(ev('DELETE', 'gcp-ace'))).statusCode, 204);
  assert.equal((await handler(ev('GET', 'gcp-ace'))).statusCode, 404);
});
