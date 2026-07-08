// src/common/offlineSync.js
//
// The axios layer on top of the pure offlineQueue: it turns a field write into
// a "try now, stash on failure, auto-flush later" capture, and wires the
// background flush (on reconnect / interval / load). Kept separate from
// offlineQueue.js so that file stays dependency-free and unit-testable (CRA's
// jest won't transform axios out of node_modules).

import axios from 'axios';
import { enqueue, flush, isTransient } from './offlineQueue';

// The Studio provides the current auth headers (the token can refresh), so we
// read them lazily at send time rather than capturing a stale header.
let _authHdrProvider = () => ({});
export function setAuthProvider(fn) { if (typeof fn === 'function') _authHdrProvider = fn; }

function axiosSend(op) {
  return axios({ method: op.method, url: op.url, data: op.body != null ? op.body : undefined, ..._authHdrProvider() })
    .catch((e) => {
      const err = new Error((e.response && e.response.data && e.response.data.message) || e.message);
      err.transient = isTransient(e);
      throw err;
    });
}

// One-shot capture: try the write now; on a transient failure (or while
// offline) stash it and report it queued so the UI can proceed optimistically.
// A real server refusal (4xx) is re-thrown for the caller to surface. Returns
// { queued: boolean, data?: any }.
export async function queuedRequest(op) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueue(op);
    return { queued: true };
  }
  try {
    const r = await axios({ method: op.method, url: op.url, data: op.body != null ? op.body : undefined, ..._authHdrProvider() });
    return { queued: false, data: r.data };
  } catch (e) {
    if (isTransient(e)) { enqueue(op); return { queued: true }; }
    throw e;
  }
}

// Flush the queue once using the real axios sender.
export function flushNow() { return flush(axiosSend); }

let _timer = null;
let _onlineHandler = null;

// Wire background flushing: on the browser 'online' event, on an interval, and
// once on load (to drain anything a previous session left behind). Idempotent —
// safe to call once from the Studio root. Returns a teardown fn.
export function startAutoFlush({ intervalMs = 20000 } = {}) {
  const kick = () => { flush(axiosSend).catch(() => {}); };
  if (typeof window !== 'undefined' && !_onlineHandler) {
    _onlineHandler = kick;
    window.addEventListener('online', _onlineHandler);
  }
  if (!_timer) _timer = setInterval(kick, intervalMs);
  kick();
  return () => {
    if (typeof window !== 'undefined' && _onlineHandler) {
      window.removeEventListener('online', _onlineHandler);
      _onlineHandler = null;
    }
    if (_timer) { clearInterval(_timer); _timer = null; }
  };
}
