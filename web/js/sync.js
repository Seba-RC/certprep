// Optional cloud sync: Cognito managed login (OAuth 2.0 authorization code + PKCE)
// and a small HTTP API (API Gateway + Lambda + DynamoDB). Disabled when config.json
// has no apiUrl, and the app then works fully offline with browser storage.
import * as store from './store.js';

let config = null;

export async function loadConfig() {
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    config = res.ok ? await res.json() : {};
  } catch {
    config = {};
  }
  return config;
}

export function enabled() {
  return !!(config && config.apiUrl && config.cognito && config.cognito.domain && config.cognito.clientId);
}

function redirectUri() {
  return window.location.origin + window.location.pathname;
}

function authBase() {
  const d = config.cognito.domain;
  return d.startsWith('http') ? d.replace(/\/$/, '') : `https://${d}`;
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

export async function signIn() {
  const { verifier, challenge } = await pkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  store.set('auth.pkce', { verifier, state, returnTo: window.location.hash || '#/' });
  const u = new URL(authBase() + '/oauth2/authorize');
  u.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.cognito.clientId,
    redirect_uri: redirectUri(),
    scope: 'openid email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  window.location.assign(u.toString());
}

export function signOut() {
  store.del('auth.tokens');
  if (!enabled()) return;
  const u = new URL(authBase() + '/logout');
  u.search = new URLSearchParams({ client_id: config.cognito.clientId, logout_uri: redirectUri() }).toString();
  window.location.assign(u.toString());
}

async function tokenRequest(params) {
  const res = await fetch(authBase() + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.cognito.clientId, ...params }).toString(),
  });
  if (!res.ok) throw new Error(`Sign-in failed (${res.status})`);
  const t = await res.json();
  const now = Date.now();
  const prev = store.get('auth.tokens') || {};
  const tokens = {
    access: t.access_token,
    id: t.id_token,
    refresh: t.refresh_token || prev.refresh,
    exp: now + (t.expires_in || 3600) * 1000 - 60000,
  };
  store.set('auth.tokens', tokens);
  return tokens;
}

/** Call once at startup. Completes the redirect from Cognito if there's a ?code= in the URL. */
export async function handleRedirect() {
  if (!enabled()) return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;
  const saved = store.get('auth.pkce');
  store.del('auth.pkce');
  const clean = redirectUri() + (saved && saved.returnTo ? saved.returnTo : '#/');
  window.history.replaceState(null, '', clean);
  if (!saved || saved.state !== params.get('state')) throw new Error('Sign-in state did not match. Try signing in again.');
  await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: saved.verifier });
  return true;
}

async function accessToken() {
  let t = store.get('auth.tokens');
  if (!t) return null;
  if (Date.now() < t.exp) return t.access;
  if (!t.refresh) return null;
  try {
    t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh });
    return t.access;
  } catch {
    store.del('auth.tokens');
    return null;
  }
}

export function user() {
  const t = store.get('auth.tokens');
  if (!t || !t.id) return null;
  try {
    const payload = JSON.parse(atob(t.id.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { email: payload.email, sub: payload.sub };
  } catch {
    return null;
  }
}

async function api(method, path, body) {
  const token = await accessToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(config.apiUrl.replace(/\/$/, '') + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

export const pull = (certId) => api('GET', `/progress/${encodeURIComponent(certId)}`);
export const push = (progress) => api('PUT', `/progress/${encodeURIComponent(progress.certId)}`, progress);
export const remove = (certId) => api('DELETE', `/progress/${encodeURIComponent(certId)}`);
