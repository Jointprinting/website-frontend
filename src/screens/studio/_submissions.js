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

export const visibleSubmissions = (items, { sourceFilter = 'all', lockedSource = null } = {}) =>
  (items || []).filter((it) => matchesSource(it, effectiveSource(sourceFilter, lockedSource)));
