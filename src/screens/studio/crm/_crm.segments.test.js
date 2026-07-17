// src/screens/studio/crm/_crm.segments.test.js
//
// The CRM segment split — clients / leads / everyone — and the cold-outreach POOL
// predicate behind it. These mirror the backend (controllers/crm.js
// isEngineManagedCold / isOutreachPool); the point of this suite is that the mirror
// actually matches, since a drift here silently mis-files leads:
//   • a REPLIED cold lead ('warm') must leave the pool (was hiding in "everyone")
//   • a cold lead the owner SCHEDULES a follow-up on must promote to an active lead
//     (the exact thing that was broken when the pool predicate ignored nextFollowUp)
//   • a meta-ad lead is engine-managed cold, same as a cold-email one
//   • a lost/dormant card with a stale follow-up is parked, not "active"

import {
  isEngineManagedCold,
  isOutreachPool,
  isActiveLead,
  segmentOf,
} from './_crm';

const lead = (over) => ({ stage: 'lead', tags: [], leadSource: '', log: [], nextFollowUp: null, ...over });

// ── isEngineManagedCold — mirrors the backend gate ────────────────────────────
test('isEngineManagedCold: cold-outreach tags / source flag an engine-managed cold lead', () => {
  expect(isEngineManagedCold(lead({ tags: ['cold-email'] }))).toBe(true);
  expect(isEngineManagedCold(lead({ tags: ['dispensary'] }))).toBe(true);
  expect(isEngineManagedCold(lead({ tags: ['cold'] }))).toBe(true);
  expect(isEngineManagedCold(lead({ tags: ['meta-ad'] }))).toBe(true);      // was ignored before
  expect(isEngineManagedCold(lead({ leadSource: 'Cold Outreach' }))).toBe(true);
  // A genuine, untagged new lead is NOT engine-managed — it flows normally.
  expect(isEngineManagedCold(lead({}))).toBe(false);
});

test('isEngineManagedCold: a reply (warm) or an owner touch takes it out of the engine bucket', () => {
  expect(isEngineManagedCold(lead({ tags: ['cold-email', 'warm'] }))).toBe(false); // replied → warm
  expect(isEngineManagedCold(lead({ tags: ['cold-email'], log: [{ kind: 'call' }] }))).toBe(false);
  expect(isEngineManagedCold(lead({ tags: ['cold-email'], log: [{ kind: 'text' }] }))).toBe(false);
  expect(isEngineManagedCold(lead({ tags: ['cold-email'], log: [{ kind: 'visit' }] }))).toBe(false);
  // an automated cold 'email' send is NOT an owner touch — stays engine-managed
  expect(isEngineManagedCold(lead({ tags: ['cold-email'], log: [{ kind: 'email' }] }))).toBe(true);
  // a customer/won cold record is never "engine cold"
  expect(isEngineManagedCold(lead({ tags: ['cold-email'], stage: 'won' }))).toBe(false);
  expect(isEngineManagedCold(lead({ tags: ['cold-email'], stage: 'customer' }))).toBe(false);
});

// ── isOutreachPool — engine-cold AND nothing scheduled ────────────────────────
test('isOutreachPool: a scheduled follow-up promotes a cold lead out of the pool', () => {
  expect(isOutreachPool(lead({ tags: ['cold-email'] }))).toBe(true);                       // still in the pool
  expect(isOutreachPool(lead({ tags: ['cold-email'], nextFollowUp: '2026-08-01' }))).toBe(false); // promoted
  expect(isOutreachPool(lead({ tags: ['cold-email', 'warm'] }))).toBe(false);              // replied → not pool
  expect(isOutreachPool(lead({}))).toBe(false);                                            // not cold at all
});

// ── isActiveLead / segmentOf — the bucket the owner sees ──────────────────────
test('isActiveLead: cold lead promotes on a follow-up; live-quote stages count', () => {
  expect(isActiveLead(lead({ tags: ['cold-email'] }))).toBe(false);                        // pool → everyone
  expect(isActiveLead(lead({ tags: ['cold-email'], nextFollowUp: '2026-08-01' }))).toBe(true); // promoted
  expect(isActiveLead(lead({ stage: 'quoting' }))).toBe(true);                             // live quote
  expect(isActiveLead(lead({ stage: 'awaiting_details' }))).toBe(true);
  expect(isActiveLead(lead({ nextFollowUp: '2026-08-01' }))).toBe(true);                   // scheduled
});

test('isActiveLead: a lost/dormant card with a stale follow-up is parked, not active', () => {
  expect(isActiveLead(lead({ stage: 'lost', nextFollowUp: '2026-01-01' }))).toBe(false);
  expect(isActiveLead(lead({ stage: 'dormant', nextFollowUp: '2026-01-01' }))).toBe(false);
});

test('segmentOf: clients / leads / everyone', () => {
  expect(segmentOf(lead({ stage: 'won' }))).toBe('clients');
  expect(segmentOf(lead({ isCustomer: true }))).toBe('clients');
  expect(segmentOf(lead({ stage: 'quoting' }))).toBe('leads');
  expect(segmentOf(lead({ tags: ['cold-email'], nextFollowUp: '2026-08-01' }))).toBe('leads'); // promoted cold lead
  expect(segmentOf(lead({ tags: ['cold-email'] }))).toBe('everyone');                          // cold pool
  expect(segmentOf(lead({}))).toBe('everyone');                                                // untouched lead
});
