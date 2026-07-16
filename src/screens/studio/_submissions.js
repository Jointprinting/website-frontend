// src/screens/studio/_submissions.js
// Source vocabulary + filtering for the Submissions inbox (Studio.js). Which
// lead pipe a submission came down: 'contact' = the Joint Printing contact
// form (source unset/anything else); 'webworks' = /webworks/start. Client-side
// only — the API returns all sources and we slice here.
//
// Extracted from Studio.js (the _roadTrip.js pattern) so the lockedSource /
// filter logic is unit-testable without pulling the whole Studio tree in.
// The backend mirrors this vocabulary in /api/submissions (source field,
// ?source= on unseen-count, { source } on mark-all-seen) — keep them in sync.

export const SOURCE_FILTERS = [
  { value: 'all',      label: 'All sources' },
  { value: 'webworks', label: 'JP Webworks' },
  { value: 'atom',     label: 'JP Atom' },
  { value: 'contact',  label: 'Contact form' },
];

// One place for each brand's inbox vocabulary — the label + the brand accent —
// so the filter chips, the per-row badge, and the detail-dialog chip can't drift
// (webworks green, atom purple, JP-print green). `badge:true` = distinct enough
// from the default merch inbox to tag a row; 'contact' is the default so it isn't
// badged (every row would carry it → noise). Keep the values in sync with the
// backend ContactSubmission.source enum.
export const SOURCE_META = {
  webworks: { label: 'JP Webworks', chip: '#17b878', color: '#4ade80', bg: 'rgba(23,184,120,0.18)',  badge: true },
  atom:     { label: 'JP Atom',     chip: '#a78bfa', color: '#c4b5fd', bg: 'rgba(167,139,250,0.18)', badge: true },
  contact:  { label: 'Contact form', chip: '#4ade80', color: '#4ade80', bg: 'rgba(74,222,128,0.14)',  badge: false },
};

// The source a submission belongs to, normalized to a SOURCE_META key
// (anything that isn't webworks/atom is the default contact-form inbox).
export const submissionSource = (item) =>
  item && (item.source === 'webworks' || item.source === 'atom') ? item.source : 'contact';

// Counts for every source chip in one pass — `all` plus one entry per real
// source (webworks/atom/contact). Generated from SOURCE_FILTERS so a new brand
// added there is counted automatically (the old hand-written map silently
// dropped 'atom', so the JP Atom chip always read 0).
export const countsBySource = (items) => {
  const list = items || [];
  const out = { all: list.length };
  SOURCE_FILTERS.forEach((s) => {
    if (s.value !== 'all') out[s.value] = list.filter((it) => matchesSource(it, s.value)).length;
  });
  return out;
};

export const matchesSource = (item, filter) =>
  filter === 'all' ? true
    : filter === 'webworks' ? item.source === 'webworks'
    : filter === 'atom' ? item.source === 'atom'
    : item.source !== 'webworks' && item.source !== 'atom';

// The source a list is actually sliced by. `lockedSource` (the JP Webworks
// Inquiries view is HARD-locked to 'webworks') always wins over the user's
// chip pick; no lock → the chip filter; nothing → everything.
export const effectiveSource = (sourceFilter, lockedSource) =>
  lockedSource || sourceFilter || 'all';

// Per-brand lead pipelines — which lifecycle statuses each brand's inbox offers.
// Mirrors backend models/ContactSubmission.js STATUSES_BY_SOURCE (keep in sync):
//   contact  (JP merch):  new → contacted → quoted → won / lost
//   webworks (sites):     new → contacted → preview-built → preview-sent → live / churned / lost
//   atom     (studio):    new → contacted → demo-booked → scoped → onboarding → live / churned / lost
// 'all' (the unlocked mixed inbox) shows the union so any row's status is
// representable. statusValuesFor never returns undefined — unknown → union.
export const STATUS_VALUES_BY_SOURCE = {
  contact:  ['new', 'contacted', 'quoted', 'won', 'lost', 'spam'],
  webworks: ['new', 'contacted', 'preview-built', 'preview-sent', 'live', 'churned', 'lost', 'spam'],
  atom:     ['new', 'contacted', 'demo-booked', 'scoped', 'onboarding', 'live', 'churned', 'lost', 'spam'],
};
export const STATUS_VALUES_ALL = [
  'new', 'contacted', 'quoted', 'preview-built', 'preview-sent', 'demo-booked',
  'scoped', 'onboarding', 'won', 'live', 'lost', 'churned', 'spam',
];
export const statusValuesFor = (source) =>
  STATUS_VALUES_BY_SOURCE[source] || STATUS_VALUES_ALL;

export const visibleSubmissions = (items, { sourceFilter = 'all', lockedSource = null } = {}) =>
  (items || []).filter((it) => matchesSource(it, effectiveSource(sourceFilter, lockedSource)));
