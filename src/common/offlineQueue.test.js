// src/common/offlineQueue.test.js
//
// Pins the offline field-capture queue — the thing that guarantees a tap in a
// dead zone is never lost. Focus on the mechanics that matter on the road:
// FIFO order, retry vs drop classification, "stop at the first connectivity
// failure and preserve the rest untried," and the give-up backstop.

import {
  enqueue, pendingCount, subscribe, clearQueue, flush, isTransient, isAuthFailure,
} from './offlineQueue';

beforeEach(() => { window.localStorage.clear(); clearQueue(); });

const op = (label) => ({ method: 'post', url: `/x/${label}`, body: { label }, label });

describe('isTransient', () => {
  test('no response (offline/dropped) → transient', () => {
    expect(isTransient(new Error('Network Error'))).toBe(true);
    expect(isTransient({})).toBe(true);
  });
  test('4xx refusal → NOT transient (drop), except 408/425/429', () => {
    expect(isTransient({ response: { status: 400 } })).toBe(false);
    expect(isTransient({ response: { status: 404 } })).toBe(false);
    expect(isTransient({ response: { status: 429 } })).toBe(true);
  });
  test('5xx → transient (retry)', () => {
    expect(isTransient({ response: { status: 503 } })).toBe(true);
  });
  test('pre-classified err.transient wins', () => {
    expect(isTransient({ transient: false, response: { status: 503 } })).toBe(false);
  });
});

describe('enqueue + subscribe', () => {
  test('enqueue grows the queue and notifies subscribers', () => {
    const seen = [];
    const unsub = subscribe((n) => seen.push(n));
    expect(seen[0]).toBe(0);          // fires immediately with current count
    enqueue(op('a'));
    enqueue(op('b'));
    expect(pendingCount()).toBe(2);
    expect(seen[seen.length - 1]).toBe(2);
    unsub();
    enqueue(op('c'));
    expect(seen[seen.length - 1]).toBe(2);   // no longer notified after unsub
  });
});

describe('flush', () => {
  test('all succeed → queue drained in FIFO order', async () => {
    enqueue(op('a')); enqueue(op('b')); enqueue(op('c'));
    const order = [];
    const send = (o) => { order.push(o.label); return Promise.resolve(); };
    const r = await flush(send);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(r).toMatchObject({ sent: 3, dropped: 0, kept: 0 });
    expect(pendingCount()).toBe(0);
  });

  test('server-refused op is dropped, draining continues past it', async () => {
    enqueue(op('a')); enqueue(op('bad')); enqueue(op('c'));
    const send = (o) => (o.label === 'bad'
      ? Promise.reject({ response: { status: 400 } })
      : Promise.resolve());
    const r = await flush(send);
    expect(r).toMatchObject({ sent: 2, dropped: 1, kept: 0 });
    expect(pendingCount()).toBe(0);
  });

  test('first connectivity failure stops the pass and preserves the rest UNTRIED', async () => {
    enqueue(op('a')); enqueue(op('b')); enqueue(op('c'));
    const tried = [];
    const send = (o) => {
      tried.push(o.label);
      if (o.label === 'b') return Promise.reject(new Error('offline'));  // transient
      return Promise.resolve();
    };
    const r = await flush(send);
    expect(tried).toEqual(['a', 'b']);           // c never attempted
    expect(r).toMatchObject({ sent: 1, kept: 2 });
    // b now carries a try; c is still pristine and still second in line.
    const q = JSON.parse(window.localStorage.getItem('jpstudio:offlineQueue.v1'));
    expect(q.map((x) => x.label)).toEqual(['b', 'c']);
    expect(q[0].tries).toBe(1);
    expect(q[1].tries).toBe(0);
  });

  test('gives up on a stuck item after maxTries (does not loop forever)', async () => {
    enqueue(op('stuck'));
    const send = () => Promise.reject(new Error('still offline'));
    // Drive it up to the backstop.
    let last;
    for (let i = 0; i < 12; i++) { last = await flush(send, { maxTries: 3 }); }  // eslint-disable-line no-await-in-loop
    expect(pendingCount()).toBe(0);              // dropped once tries hit the cap
    expect(last.kept).toBe(0);
  });

  test('empty queue is a no-op', async () => {
    const r = await flush(() => Promise.resolve());
    expect(r).toMatchObject({ sent: 0, dropped: 0, kept: 0 });
  });
});

// ── Session expiry ──────────────────────────────────────────────────────────
// A 401 used to be classified as "server refused" and DROPPED the op. That is
// the one outcome this file exists to prevent: a token lapsing while you're out
// on the loop silently destroyed every queued field write. The credential is
// what failed, not the op — so it's held, not dropped, and not charged a retry.

const authErr = (status = 401) => ({ response: { status } });

describe('isAuthFailure', () => {
  test('401 and 403 are auth failures', () => {
    expect(isAuthFailure(authErr(401))).toBe(true);
    expect(isAuthFailure(authErr(403))).toBe(true);
  });

  test('nothing else is', () => {
    expect(isAuthFailure(authErr(400))).toBe(false);
    expect(isAuthFailure(authErr(503))).toBe(false);
    expect(isAuthFailure(new Error('Network Error'))).toBe(false);
    expect(isAuthFailure(null)).toBe(false);
  });

  test('an auth failure is NOT lumped in with transient', () => {
    // It must be checked first — it belongs to neither existing class.
    expect(isTransient(authErr(401))).toBe(false);
  });
});

describe('flush on an expired session', () => {
  test('HOLDS every queued write instead of dropping it', async () => {
    enqueue(op('a')); enqueue(op('b')); enqueue(op('c'));
    const r = await flush(() => Promise.reject(authErr(401)));
    expect(r).toMatchObject({ sent: 0, dropped: 0, kept: 3 });
    expect(pendingCount()).toBe(3);
  });

  test('does not burn the retry budget — the op never failed on its merits', async () => {
    enqueue(op('a'));
    await flush(() => Promise.reject(authErr(401)));
    const q = JSON.parse(window.localStorage.getItem('jpstudio:offlineQueue.v1'));
    expect(q[0].tries || 0).toBe(0);
  });

  test('a lapsed token can never exhaust maxTries and drop the work', async () => {
    // The failure mode that would silently lose a day in the field.
    enqueue(op('field-capture'));
    for (let i = 0; i < 20; i++) { await flush(() => Promise.reject(authErr(401)), { maxTries: 3 }); }  // eslint-disable-line no-await-in-loop
    expect(pendingCount()).toBe(1);
  });

  test('stops the pass — everything after it would 401 too', async () => {
    enqueue(op('a')); enqueue(op('b'));
    const tried = [];
    await flush((o) => { tried.push(o.label); return Promise.reject(authErr(401)); });
    expect(tried).toEqual(['a']);
  });

  test('order is preserved, so the sync after sign-in is still FIFO', async () => {
    enqueue(op('a')); enqueue(op('b')); enqueue(op('c'));
    await flush(() => Promise.reject(authErr(401)));
    const q = JSON.parse(window.localStorage.getItem('jpstudio:offlineQueue.v1'));
    expect(q.map((x) => x.label)).toEqual(['a', 'b', 'c']);
  });

  test('and they really do send once signed in again', async () => {
    enqueue(op('a')); enqueue(op('b'));
    await flush(() => Promise.reject(authErr(401)));
    const r = await flush(() => Promise.resolve());
    expect(r).toMatchObject({ sent: 2, kept: 0 });
    expect(pendingCount()).toBe(0);
  });

  test('a genuine 400 is still dropped — this did not weaken the refusal rule', async () => {
    enqueue(op('bad'));
    const r = await flush(() => Promise.reject(authErr(400)));
    expect(r).toMatchObject({ dropped: 1 });
    expect(pendingCount()).toBe(0);
  });
});
