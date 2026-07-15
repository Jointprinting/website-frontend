// src/screens/studio/_shared.approval.test.js
//
// Pins clientApproved() — the single, superseded-aware source of truth for the
// owner-side "APPROVED" signal in the Order Tracker (step tracker + next-action).
// The whole point is that resetting/rotating/reopening the client approval link
// (which bumps approvalSupersededAt on the backend) immediately reverts this to
// false, so the owner never falsely sees "Approved" after a reset. These cases
// mirror controllers/approval.js _currentApprovalStatus. Run via: CI=true npm test

import { clientApproved, approvalActivity } from './_shared';

const iso = (t) => new Date(t).toISOString();
const approved = (t) => ({ kind: 'approved', at: iso(t) });
const changes = (t, message = '') => ({ kind: 'requested_changes', at: iso(t), message });
const viewed = (t) => ({ kind: 'viewed', at: iso(t) });
const sent = (t) => ({ sentAt: iso(t) });

describe('clientApproved', () => {
  test('no project / no events → false', () => {
    expect(clientApproved(null)).toBe(false);
    expect(clientApproved({})).toBe(false);
    expect(clientApproved({ approvalEvents: [] })).toBe(false);
  });

  test('approved with no supersede → true', () => {
    expect(clientApproved({ approvalEvents: [approved(1000)] })).toBe(true);
  });

  test('approved then link reset (supersededAt AFTER the approval) → false', () => {
    // client approved at t=1000, owner rotated/reset the link at t=2000.
    expect(clientApproved({
      approvalEvents: [approved(1000)],
      approvalSupersededAt: iso(2000),
    })).toBe(false);
  });

  test('reset then re-approved (approval AFTER supersededAt) → true', () => {
    expect(clientApproved({
      approvalEvents: [approved(1000), approved(3000)],
      approvalSupersededAt: iso(2000),
    })).toBe(true);
  });

  test('requested_changes only → false', () => {
    expect(clientApproved({ approvalEvents: [changes(1000)] })).toBe(false);
  });

  test('approved, then reopened after a change request (supersede bump) → false until re-approval', () => {
    // approved(1000) → owner reopens after requested_changes, bumping supersededAt(2500).
    expect(clientApproved({
      approvalEvents: [approved(1000), changes(2000)],
      approvalSupersededAt: iso(2500),
    })).toBe(false);
  });

  test('the approval event exactly AT the cutoff does not count (strictly newer)', () => {
    expect(clientApproved({
      approvalEvents: [approved(2000)],
      approvalSupersededAt: iso(2000),
    })).toBe(false);
  });
});

describe('approvalActivity', () => {
  test('no project / nothing shared → all-quiet, shared:false', () => {
    for (const p of [null, {}, { approvalEvents: [], approvalRecipients: [] }]) {
      const a = approvalActivity(p);
      expect(a.shared).toBe(false);
      expect(a.emailedCount).toBe(0);
      expect(a.viewCount).toBe(0);
      expect(a.requestedChanges).toBe(false);
      expect(a.approved).toBe(false);
    }
  });

  test('emailed only (no opens) → shared via email, not viewed', () => {
    const a = approvalActivity({ approvalRecipients: [sent(1000), sent(1500)] });
    expect(a.shared).toBe(true);
    expect(a.emailedCount).toBe(2);
    expect(a.lastSentAt).toBe(1500);
    expect(a.viewCount).toBe(0);
  });

  test('opened but never emailed (copy/paste or text share) still counts as shared', () => {
    const a = approvalActivity({ approvalEvents: [viewed(2000), viewed(3000)] });
    expect(a.shared).toBe(true);
    expect(a.viewCount).toBe(2);
    expect(a.lastViewAt).toBe(3000);
  });

  test('requested_changes carries the latest message + time', () => {
    const a = approvalActivity({
      approvalEvents: [changes(1000, 'make the logo bigger'), changes(4000, 'wrong green')],
    });
    expect(a.requestedChanges).toBe(true);
    expect(a.lastChangeAt).toBe(4000);
    expect(a.lastChangeMsg).toBe('wrong green');
  });

  test('supersede resets the signal — old activity before the cutoff is ignored', () => {
    // Everything happened at t≤2000, owner reset/rotated the link at t=2500.
    const a = approvalActivity({
      approvalEvents: [viewed(1000), approved(1500), changes(2000, 'nope')],
      approvalRecipients: [sent(1200)],
      approvalSupersededAt: iso(2500),
    });
    expect(a.shared).toBe(false);
    expect(a.emailedCount).toBe(0);
    expect(a.viewCount).toBe(0);
    expect(a.requestedChanges).toBe(false);
    expect(a.approved).toBe(false);
  });

  test('activity strictly newer than the cutoff counts; exactly-at-cutoff does not', () => {
    const a = approvalActivity({
      approvalEvents: [viewed(2000), viewed(3000)],   // 2000 is AT cutoff, 3000 is after
      approvalRecipients: [sent(2000), sent(4000)],
      approvalSupersededAt: iso(2000),
    });
    expect(a.viewCount).toBe(1);
    expect(a.lastViewAt).toBe(3000);
    expect(a.emailedCount).toBe(1);
    expect(a.lastSentAt).toBe(4000);
  });
});
