// src/screens/studio/_submissions.test.js
// The SubmissionsTab source slice — especially the lockedSource hard-filter
// the JP Webworks Inquiries view rides on (Studio view 'jpwinquiries').

import {
  SOURCE_FILTERS, SOURCE_META, matchesSource, effectiveSource, visibleSubmissions,
  submissionSource, countsBySource,
  statusValuesFor, STATUS_VALUES_BY_SOURCE, STATUS_VALUES_ALL,
} from './_submissions';

const webworksLead = { _id: 'w1', source: 'webworks' };
const atomLead     = { _id: 'a1', source: 'atom' };
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

describe('submissionSource', () => {
  test('normalizes to a SOURCE_META key; legacy/unknown → contact', () => {
    expect(submissionSource(webworksLead)).toBe('webworks');
    expect(submissionSource(atomLead)).toBe('atom');
    expect(submissionSource(contactLead)).toBe('contact');
    expect(submissionSource(legacyLead)).toBe('contact');
    expect(submissionSource({ source: 'nonsense' })).toBe('contact');
    expect(submissionSource(null)).toBe('contact');
  });

  test('SOURCE_META has an entry for every real source, badging only the distinct brands', () => {
    expect(SOURCE_META.webworks.badge).toBe(true);
    expect(SOURCE_META.atom.badge).toBe(true);
    expect(SOURCE_META.contact.badge).toBe(false); // default inbox → no per-row tag
    ['webworks', 'atom', 'contact'].forEach((k) => {
      expect(typeof SOURCE_META[k].label).toBe('string');
      expect(typeof SOURCE_META[k].chip).toBe('string');
    });
  });
});

describe('countsBySource (the source chips)', () => {
  test('counts every source in one pass — including atom, which the old map dropped', () => {
    const withAtom = [webworksLead, atomLead, contactLead, legacyLead];
    expect(countsBySource(withAtom)).toEqual({ all: 4, webworks: 1, atom: 1, contact: 2 });
  });

  test('tolerates a missing list', () => {
    expect(countsBySource(undefined)).toEqual({ all: 0, webworks: 0, atom: 0, contact: 0 });
  });
});

describe('statusValuesFor (per-brand pipelines — mirrors backend STATUSES_BY_SOURCE)', () => {
  test('each brand inbox offers ITS pipeline, not the merch one', () => {
    expect(statusValuesFor('contact')).toEqual(['new', 'contacted', 'quoted', 'won', 'lost', 'spam']);
    expect(statusValuesFor('webworks')).toContain('preview-sent');
    expect(statusValuesFor('webworks')).not.toContain('quoted');
    expect(statusValuesFor('atom')).toContain('onboarding');
    expect(statusValuesFor('atom')).not.toContain('won');
  });

  test('mixed/unknown views get the union so any row status is representable', () => {
    expect(statusValuesFor('all')).toEqual(STATUS_VALUES_ALL);
    expect(statusValuesFor(undefined)).toEqual(STATUS_VALUES_ALL);
    const union = new Set(STATUS_VALUES_ALL);
    Object.values(STATUS_VALUES_BY_SOURCE).flat().forEach((v) => {
      expect(union.has(v)).toBe(true);
    });
  });
});
