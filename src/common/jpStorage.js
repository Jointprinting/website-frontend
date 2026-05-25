// Thin wrapper around localStorage with a stable namespace prefix and a
// one-shot migration for legacy unprefixed keys.
//
// Why: every key we used to write was unprefixed, which means an iframe
// embedding jointprinting.com or a future second app on the same origin
// could collide with ours. Prefixing with "jpstudio:" makes our keys easy
// to spot in DevTools and trivially safe to clear in bulk if we ever need
// to reset state without touching another app's data.
//
// Migration: getItem() also peeks at the legacy unprefixed key and migrates
// it forward on first read. Once a value is written under the new key the
// legacy entry can stay (we don't proactively delete to avoid surprising a
// user mid-session) but will never be read again.

const PREFIX = 'jpstudio:';

const _hasLs = (() => {
  try {
    const probe = '__jp_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch (_) { return false; }
})();

export function lsGet(key, fallback = null) {
  if (!_hasLs) return fallback;
  try {
    const ns = window.localStorage.getItem(PREFIX + key);
    if (ns !== null) return ns;
    // One-shot migration: if a legacy unprefixed value exists, promote it
    // under the namespaced key and return it. Doesn't delete the legacy
    // entry — that risks tripping users on another tab still reading it.
    const legacy = window.localStorage.getItem(key);
    if (legacy !== null) {
      try { window.localStorage.setItem(PREFIX + key, legacy); } catch (_) { /* quota */ }
      return legacy;
    }
    return fallback;
  } catch (_) { return fallback; }
}

export function lsSet(key, value) {
  if (!_hasLs) return false;
  try {
    window.localStorage.setItem(PREFIX + key, String(value));
    return true;
  } catch (e) {
    // QuotaExceededError or storage disabled — let the caller decide.
    return false;
  }
}

export function lsRemove(key) {
  if (!_hasLs) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
    // Best-effort: also clean up the legacy unprefixed entry so it doesn't
    // get migrated back in on the next read. Safe because we only call
    // remove when the caller explicitly wants the key gone.
    window.localStorage.removeItem(key);
  } catch (_) { /* swallow */ }
}

// JSON convenience — auto-stringify/parse, falls back gracefully on bad
// payloads. Used by tabs that store structured state (Cold Call overrides,
// confirmation drafts, etc.).
export function lsGetJson(key, fallback = null) {
  const raw = lsGet(key, null);
  if (raw === null) return fallback;
  try { return JSON.parse(raw); }
  catch (e) {
    console.warn(`[jpStorage] corrupt JSON at ${key}:`, e.message);
    return fallback;
  }
}

export function lsSetJson(key, value) {
  try {
    return lsSet(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[jpStorage] could not serialize value for ${key}:`, e.message);
    return false;
  }
}
