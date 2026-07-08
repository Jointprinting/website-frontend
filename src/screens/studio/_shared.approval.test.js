// src/screens/studio/_shared.approval.test.js
//
// Pins clientApproved() — the single, superseded-aware source of truth for the
// owner-side "APPROVED" signal in the Order Tracker (step tracker + next-action).
// The whole point is that resetting/rotating/reopening the client approval link
// (which bumps approvalSupersededAt on the backend) immediately reverts this to
// false, so the owner never falsely sees "Approved" after a reset. These cases
// mirror controllers/approval.js _currentApprovalStatus. Run via: CI=true npm test

import { clientApproved } from './_shared';

const iso = (t) => new Date(t).toISOString();
const approved = (t) => ({ kind: 'approved', at: iso(t) });
const changes = (t) => ({ kind: 'requested_changes', at: iso(t) });

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
