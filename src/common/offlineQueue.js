// src/common/offlineQueue.js
//
// Durable, offline-resilient write queue for FIELD CAPTURE. On the road (dead
// zones through the national/state forests on the sales loop) a tapped save must
// NEVER silently vanish. If a write can't reach the server, we stash it in
// localStorage, surface it as "pending sync," and auto-flush FIFO the moment
// signal returns (plus on an interval and on app load).
//
// A server REJECTION (4xx) is NOT a connectivity problem — retrying it forever
// would wedge the queue — so those surface to the caller and are never queued.
// 408/425/429/5xx and "no response at all" ARE transient and get retried.
//
// The queue mechanics here are PURE and injectable (`flush` takes a `send` fn),
// so they unit-test with no axios and no network. The axios wrapper + auto-flush
// wiring live alongside in offlineSync.js (kept separate so this file stays
// dependency-free and testable under CRA's jest, which won't transform axios).

import { lsGet, lsSetJson } from './jpStorage';

const KEY = 'offlineQueue.v1';
const listeners = new Set();

// Statuses worth retrying: request timeout, too-early, rate-limit, and the 5xx
// family (server hiccup). Anything else WITH a response is a definitive refusal.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// Is this failure a connectivity/transient issue (keep + retry) rather than a
// server refusal (drop)? `err.transient` wins when the caller pre-classified.
export function isTransient(err) {
  if (!err) return false;
  if (err.transient !== undefined) return !!err.transient;
  const status = err.response && err.response.status;
  if (!status) return true;                    // no response reached us → offline/dropped
  return RETRYABLE_STATUS.has(status);
}

function read() {
  try {
    const v = JSON.parse(lsGet(KEY, '[]'));
    return Array.isArray(v) ? v : [];
  } catch (_) { return []; }
}

function write(q) {
  lsSetJson(KEY, q);                            // best-effort; returns false on quota
  const n = q.length;
  listeners.forEach((fn) => { try { fn(n); } catch (_) { /* listener errors are their own problem */ } });
}

// How many writes are waiting to sync.
export function pendingCount() { return read().length; }

// Subscribe to the pending count (fires immediately with the current value).
// Returns an unsubscribe fn. Powers the "N pending" badge.
export function subscribe(fn) {
  listeners.add(fn);
  try { fn(read().length); } catch (_) { /* ignore */ }
  return () => listeners.delete(fn);
}

function newId() {
  // App code (not a workflow script) — Date.now()/random are fine here.
  return `op_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

// Append one operation to the tail. op = { method, url, body?, label? }.
export function enqueue(op) {
  const q = read();
  q.push({
    id: op.id || newId(),
    method: op.method,
    url: op.url,
    body: op.body != null ? op.body : null,
    label: op.label || '',
    createdAt: op.createdAt || Date.now(),
    tries: 0,
  });
  write(q);
  return q.length;
}

export function clearQueue() { write([]); }

let _flushing = false;

// Drain the queue FIFO. `send(op)` must resolve on success and reject on
// failure. A rejected op is kept + retried only if isTransient(err); a
// server-refused op is DROPPED (it can't succeed on retry) so it can't wedge
// the queue. The FIRST transient failure stops the pass and preserves the rest
// UNTRIED (their retry budget is precious — a dead zone would burn it on every
// item otherwise). maxTries is the give-up backstop so a poison-but-"transient"
// item can't loop forever. Re-entrancy-guarded.
export async function flush(send, { maxTries = 12 } = {}) {
  if (_flushing) return { sent: 0, dropped: 0, kept: pendingCount(), busy: true };
  _flushing = true;
  try {
    const q = read();
    if (!q.length) return { sent: 0, dropped: 0, kept: 0 };
    const kept = [];
    let sent = 0, dropped = 0;
    for (let i = 0; i < q.length; i++) {
      const op = q[i];
      try {
        await send(op);                          // eslint-disable-line no-await-in-loop
        sent += 1;
      } catch (err) {
        if (!isTransient(err)) {                  // server refused → drop, keep draining
          dropped += 1;
          console.warn('[offlineQueue] dropping rejected op:', op.label, err && err.message);
          continue;
        }
        const tries = (op.tries || 0) + 1;        // connectivity down → keep this + the rest untried
        if (tries >= maxTries) {
          dropped += 1;
          console.warn('[offlineQueue] giving up after', tries, 'tries:', op.label);
        } else {
          kept.push({ ...op, tries });
        }
        for (let j = i + 1; j < q.length; j++) kept.push(q[j]);
        break;
      }
    }
    write(kept);
    return { sent, dropped, kept: kept.length };
  } finally {
    _flushing = false;
  }
}
