// src/screens/studio/_submissions.test.js
// The SubmissionsTab source slice — especially the lockedSource hard-filter
// the JP Webworks Inquiries view rides on (Studio view 'jpwinquiries').

import {
  SOURCE_FILTERS, matchesSource, effectiveSource, visibleSubmissions,
} from './_submissions';

const webworksLead = { _id: 'w1', source: 'webworks' };
const contactLead  = { _id: 'c1', source: 'contact' };
const legacyLead   = { _id: 'c2' }; // pre-source records = contact-form leads

const items = [webworksLead, contactLead, legacyLead];

describe('matchesSource', () => {
  test('"all" matches everything', () => {
    expect(items.every((it) => matchesSource(it, 'all'))).toBe(true);
  });

  test('"webworks" matches only /webworks/start leads', () => {
    expect(matchesSource(webworksLead, 'webworks')).toBe(true);
    expect(matchesSource(contactLead, 'webworks')).toBe(false);
    expect(matchesSource(legacyLead, 'webworks')).toBe(false);
  });

  test('"contact" matches non-webworks, including legacy records with no source', () => {
    expect(matchesSource(webworksLead, 'contact')).toBe(false);
    expect(matchesSource(contactLead, 'contact')).toBe(true);
    expect(matchesSource(legacyLead, 'contact')).toBe(true);
  });
});

describe('effectiveSource', () => {
  test('lockedSource always wins over the chip filter', () => {
    expect(effectiveSource('all', 'webworks')).toBe('webworks');
    expect(effectiveSource('contact', 'webworks')).toBe('webworks');
  });

  test('no lock → the chip filter; nothing → "all"', () => {
    expect(effectiveSource('contact', null)).toBe('contact');
    expect(effectiveSource(undefined, null)).toBe('all');
  });
});

describe('visibleSubmissions (the list SubmissionsTab renders)', () => {
  test('lockedSource="webworks" HARD-filters to webworks regardless of the chip state', () => {
    expect(visibleSubmissions(items, { sourceFilter: 'all', lockedSource: 'webworks' }))
      .toEqual([webworksLead]);
    expect(visibleSubmissions(items, { sourceFilter: 'contact', lockedSource: 'webworks' }))
      .toEqual([webworksLead]);
  });

  test('unlocked view slices by the chip filter', () => {
    expect(visibleSubmissions(items, { sourceFilter: 'all' })).toEqual(items);
    expect(visibleSubmissions(items, { sourceFilter: 'contact' })).toEqual([contactLead, legacyLead]);
    expect(visibleSubmissions(items, { sourceFilter: 'webworks' })).toEqual([webworksLead]);
  });

  test('tolerates a missing list', () => {
    expect(visibleSubmissions(undefined, { lockedSource: 'webworks' })).toEqual([]);
  });
});

describe('SOURCE_FILTERS vocabulary', () => {
  test('covers all / webworks / atom / contact (mirrored by the backend source field)', () => {
    expect(SOURCE_FILTERS.map((f) => f.value)).toEqual(['all', 'webworks', 'atom', 'contact']);
  });
});
