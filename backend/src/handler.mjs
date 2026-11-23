// CertPrep sync API. API Gateway HTTP API (payload v2) + Cognito JWT authorizer -> this Lambda -> DynamoDB.
//
// Routes (all require a valid Cognito access token):
//   GET    /progress/{certId}   -> { progress, updatedAt } or 404
//   PUT    /progress/{certId}   -> merges the body with what's stored, returns the merged doc
//   DELETE /progress/{certId}   -> resets progress for that certification
//
// Items: pk = "USER#<sub>", sk = "PROGRESS#<certId>", data = JSON string, updatedAt = number.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { mergeProgress } from './merge.mjs';

const TABLE = process.env.TABLE_NAME;
const MAX_BODY = 350 * 1024; // DynamoDB items max out at 400 KB
const CERT_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

let doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

/** For tests: swap in a fake document client. */
export function setClient(c) {
  doc = c;
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: body === undefined ? '' : JSON.stringify(body),
});

function validProgress(p, certId) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Body must be a JSON object';
  if (p.v !== 1) return 'Unsupported progress version';
  if (p.certId !== certId) return 'certId in body does not match the URL';
  if (!p.q || typeof p.q !== 'object' || Array.isArray(p.q)) return 'Missing q';
  if (p.attempts && !Array.isArray(p.attempts)) return 'attempts must be an array';
  if (p.days && !Array.isArray(p.days)) return 'days must be an array';
  return null;
}

export async function handler(event) {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return json(401, { message: 'Unauthorized' });
  const method = event?.requestContext?.http?.method;
  const certId = event?.pathParameters?.certId;
  if (!certId || !CERT_RE.test(certId)) return json(400, { message: 'Invalid certification id' });

  const key = { pk: `USER#${sub}`, sk: `PROGRESS#${certId}` };

  try {
    if (method === 'GET') {
      const r = await doc.send(new GetCommand({ TableName: TABLE, Key: key }));
      if (!r.Item) return json(404, { message: 'No progress yet' });
      return json(200, { progress: JSON.parse(r.Item.data), updatedAt: r.Item.updatedAt });
    }

    if (method === 'PUT') {
      let raw = event.body || '';
      if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
      if (Buffer.byteLength(raw) > MAX_BODY) return json(413, { message: 'Progress document too large' });
      let incoming;
      try {
        incoming = JSON.parse(raw);
      } catch {
        return json(400, { message: 'Body is not valid JSON' });
      }
      const err = validProgress(incoming, certId);
      if (err) return json(400, { message: err });

      const existing = await doc.send(new GetCommand({ TableName: TABLE, Key: key }));
      const merged = mergeProgress(existing.Item ? JSON.parse(existing.Item.data) : null, incoming);
      const data = JSON.stringify(merged);
      if (Buffer.byteLength(data) > MAX_BODY) return json(413, { message: 'Merged progress too large' });
      const updatedAt = Date.now();
      await doc.send(new PutCommand({ TableName: TABLE, Item: { ...key, data, updatedAt } }));
      return json(200, { progress: merged, updatedAt });
    }

    if (method === 'DELETE') {
      await doc.send(new DeleteCommand({ TableName: TABLE, Key: key }));
      return json(204);
    }

    return json(405, { message: 'Method not allowed' });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', message: e.message, name: e.name, method, certId }));
    return json(500, { message: 'Internal error' });
  }
}
