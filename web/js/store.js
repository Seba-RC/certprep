// Browser storage with a safe in-memory fallback (private mode, sandboxed frames, etc.).
import { emptyProgress } from './engine.js';

const mem = new Map();
const PREFIX = 'certprep.v1.';

function raw() {
  try {
    const k = '__certprep_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}
const ls = raw();

export const persistent = !!ls;

export function get(key, fallback = null) {
  try {
    const v = ls ? ls.getItem(PREFIX + key) : mem.get(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  const s = JSON.stringify(value);
  try {
    if (ls) ls.setItem(PREFIX + key, s);
    else mem.set(PREFIX + key, s);
  } catch {
    mem.set(PREFIX + key, s);
  }
}

export function del(key) {
  try {
    if (ls) ls.removeItem(PREFIX + key);
  } catch { /* ignore */ }
  mem.delete(PREFIX + key);
}

export const DEFAULT_SETTINGS = {
  theme: 'system',
  shuffleOptions: true,
  examLength: null, // null = cert default
  showTimer: true,
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(get('settings') || {}) };
}
export function saveSettings(s) {
  set('settings', s);
}

export function loadProgress(certId) {
  const p = get('progress.' + certId);
  return p && p.v === 1 ? p : emptyProgress(certId);
}
export function saveProgress(p) {
  set('progress.' + p.certId, p);
}

export function loadSession(certId) {
  return get('session.' + certId);
}
export function saveSession(s) {
  set('session.' + s.certId, s);
}
export function clearSession(certId) {
  del('session.' + certId);
}
