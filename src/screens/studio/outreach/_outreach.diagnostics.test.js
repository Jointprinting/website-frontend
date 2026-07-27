// src/screens/studio/outreach/_outreach.diagnostics.test.js
//
// The two silent failures the Outreach dashboard now has to SHOW, and the rule
// that neither may ever be invented out of thin air:
//   • the reply black hole — mail leaves one mailbox, replies land there, and
//     the Studio reads a different one, so "0 replies" is unmeasured, not zero
//   • the one-touch sequence — "0 follow-ups due" that actually means "there is
//     no second email, ever"
// These readers sit in front of an API that may be an older build mid-deploy, so
// every one of them has to survive a missing field without crashing or crying
// wolf. That's most of what this suite pins down.

import {
  replyPathView,
  replyIngestState,
  followUpsTile,
  sequenceDepth,
  reArmToast,
} from './_outreach';

// ── replyPathView — renders the API's verdict, never re-derives it ───────────
test('replyPathView: an action-level black hole is shown with both mailboxes', () => {
  const v = replyPathView({
    level: 'action',
    label: 'Replies land in a mailbox nobody reads',
    hint: 'Replies to your cold email land in send@shop.com, but the Studio reads read@main.com…',
    destination: 'send@shop.com',
    triageAddress: 'read@main.com',
    monitored: false,
  });
  expect(v.show).toBe(true);
  expect(v.level).toBe('action');
  expect(v.tone).toBe('#f87171');
  expect(v.destination).toBe('send@shop.com');
  expect(v.triageAddress).toBe('read@main.com');
  expect(v.monitored).toBe(false);
});

test('replyPathView: warn shows too (quieter tone), ok shows nothing', () => {
  const warn = replyPathView({ level: 'warn', destination: 'a@x.com', triageAddress: 'a@x.com', monitored: true });
  expect(warn.show).toBe(true);
  expect(warn.tone).toBe('#fbbf24');
  expect(replyPathView({ level: 'ok', destination: 'a@x.com' }).show).toBe(false);
});

test('replyPathView: a missing/garbage verdict degrades to quiet — never a false alarm', () => {
  for (const bad of [undefined, null, {}, 'nope', 42, { level: 'catastrophe' }]) {
    const v = replyPathView(bad);
    expect(v.show).toBe(false);
    expect(v.level).toBe('ok');
    expect(v.destination).toBe('');   // never invents an address
    expect(v.triageAddress).toBe('');
    expect(v.monitored).toBe(false);
  }
});

// ── replyIngestState — the passive "is anything reading the inbox?" dot ──────
test('replyIngestState: green only when the read mailbox IS the one replies land in', () => {
  const s = replyIngestState({ level: 'ok', destination: 'a@x.com', triageAddress: 'a@x.com', monitored: true });
  expect(s.ok).toBe(true);
  expect(s.text).toContain('a@x.com');
});

test('replyIngestState: names both mailboxes when they disagree, and flags a dead ingest', () => {
  const split = replyIngestState({ level: 'action', destination: 'send@x.com', triageAddress: 'read@y.com', monitored: false });
  expect(split.ok).toBe(false);
  expect(split.text).toContain('read@y.com');
  expect(split.text).toContain('send@x.com');

  const dead = replyIngestState({ level: 'action', destination: 'send@x.com', triageAddress: '', monitored: false });
  expect(dead.ok).toBe(false);
  expect(dead.text).toMatch(/no mailbox connected/);
});

test('replyIngestState: nothing known yet renders nothing at all', () => {
  expect(replyIngestState(undefined)).toBeNull();
  expect(replyIngestState({ level: 'ok' })).toBeNull();
});

// ── followUpsTile — the zero that lied ───────────────────────────────────────
test('followUpsTile: noFollowUpsPossible turns the tile into an alarm, not a zero', () => {
  const t = followUpsTile({ followUpsDue: 0, firstTouchesDue: 272, noFollowUpsPossible: true });
  expect(t.alarm).toBe(true);
  expect(t.value).toBe('NONE');
  expect(t.label).toMatch(/one-touch/i);
  expect(t.tone).toBe('#f87171');
});

test('followUpsTile: a legitimate zero (nothing ripe yet) stays a calm stat', () => {
  const none = followUpsTile({ followUpsDue: 0, noFollowUpsPossible: false });
  expect(none.alarm).toBe(false);
  expect(none.value).toBe(0);
  expect(none.label).toBe('Follow-ups due');

  const some = followUpsTile({ followUpsDue: 12 });
  expect(some.alarm).toBe(false);
  expect(some.value).toBe(12);
  expect(some.tone).toBe('#4ade80');
});

test('followUpsTile: an older payload without the flag never alarms', () => {
  expect(followUpsTile(undefined).alarm).toBe(false);
  expect(followUpsTile({}).value).toBe(0);
});

// ── sequenceDepth — "1 touch" is a diagnosis, not a stat ─────────────────────
test('sequenceDepth: a one-step campaign reads as thin, in red, with the fix', () => {
  const d = sequenceDepth({ stepCount: 1, status: 'active', stats: { sent: 300 }, everFollowedUp: false });
  expect(d.count).toBe(1);
  expect(d.thin).toBe(true);
  expect(d.label).toBe('1 touch');
  expect(d.tone).toBe('#f87171');
  expect(d.note).toMatch(/day-3/);
});

test('sequenceDepth: a healthy multi-touch campaign is quiet', () => {
  const d = sequenceDepth({ stepCount: 4, status: 'active', stats: { sent: 300 }, everFollowedUp: true });
  expect(d.thin).toBe(false);
  expect(d.neverFollowedUp).toBe(false);
  expect(d.label).toBe('4 touches');
  expect(d.note).toBe('');
});

test('sequenceDepth: four steps nobody has ever passed touch 1 on is still one-touch in practice', () => {
  const d = sequenceDepth({ stepCount: 4, status: 'active', stats: { sent: 349 }, everFollowedUp: false });
  expect(d.thin).toBe(false);
  expect(d.neverFollowedUp).toBe(true);
  expect(d.tone).toBe('#f87171');
  expect(d.note).toMatch(/No lead has ever reached touch 2/);
  // …but only once mail has actually gone out, and only on a LIVE campaign.
  expect(sequenceDepth({ stepCount: 4, status: 'active', stats: { sent: 0 }, everFollowedUp: false }).neverFollowedUp).toBe(false);
  expect(sequenceDepth({ stepCount: 4, status: 'draft', stats: { sent: 10 }, everFollowedUp: false }).neverFollowedUp).toBe(false);
});

test('sequenceDepth: falls back to the embedded steps[] when the API is an older build', () => {
  const d = sequenceDepth({ steps: [{}, {}, {}], status: 'active', stats: { sent: 5 } });
  expect(d.count).toBe(3);
  expect(d.thin).toBe(false);
  // everFollowedUp absent (not false) — no claim either way, so no red note.
  expect(d.neverFollowedUp).toBe(false);
  expect(d.note).toBe('');
});

test('sequenceDepth: junk input degrades instead of throwing', () => {
  expect(() => sequenceDepth(undefined)).not.toThrow();
  expect(sequenceDepth(undefined).count).toBe(0);
  expect(sequenceDepth({}).label).toBe('0 touches');
});

// ── reArmToast — what actually happened to the burned list ───────────────────
test('reArmToast: names the touches added AND the leads brought back', () => {
  expect(reArmToast({ addedTouches: 3, reArm: { reArmed: 312, candidates: 349 } }))
    .toBe('Added 3 touches — 312 leads re-armed for follow-up.');
  expect(reArmToast({ addedTouches: 1, reArm: { reArmed: 1, candidates: 1 } }))
    .toBe('Added 1 touch — 1 lead re-armed for follow-up.');
});

test('reArmToast: candidates that were all blocked say so instead of claiming a win', () => {
  const msg = reArmToast({ addedTouches: 2, reArm: { reArmed: 0, candidates: 40, skipped: { blocked: 40 } } });
  expect(msg).toMatch(/no burned leads could be re-armed/);
  expect(msg).toMatch(/40 are opted out or blocked/);
});

test('reArmToast: silent when the sequence did not grow (no reArm block on the response)', () => {
  expect(reArmToast({ addedTouches: 0, reArm: null })).toBe('');
  expect(reArmToast({})).toBe('');
  expect(reArmToast()).toBe('');
});
