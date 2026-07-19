// src/screens/studio/_roadTrip.test.js
//
// Pins the Field Map's pure helpers — most importantly the Google Maps
// handoff chunking (the 9-waypoint cap is a hard external constraint) and
// the companyKey mirror of the backend derivation.

import {
  buildGmapsLegs, GMAPS_WAYPOINT_CAP, deriveCompanyKey, pinStatusOf, haversineMi,
  stateDistanceMi, STATE_CENTROIDS, runStreakDays, historyTotals,
} from './_roadTrip';

const mkStops = (n) =>
  Array.from({ length: n }, (_, i) => ({ lat: 40 + i * 0.01, lng: -74 - i * 0.01 }));

describe('buildGmapsLegs', () => {
  it('puts a small run in one leg with origin, waypoints, destination', () => {
    const legs = buildGmapsLegs({ lat: 39.9, lng: -74.9 }, mkStops(4));
    expect(legs).toHaveLength(1);
    const url = new URL(legs[0].url);
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('39.9,-74.9');
    expect(url.searchParams.get('destination')).toBe('40.03,-74.03');
    expect(url.searchParams.get('waypoints').split('|')).toHaveLength(3);
  });

  it('respects the 9-waypoint cap: 10 stops fit one leg, 11 need two', () => {
    expect(buildGmapsLegs(null, mkStops(GMAPS_WAYPOINT_CAP + 1))).toHaveLength(1);
    const legs = buildGmapsLegs(null, mkStops(GMAPS_WAYPOINT_CAP + 2));
    expect(legs).toHaveLength(2);
    expect(legs[0].count).toBe(10);
    expect(legs[1].count).toBe(1);
  });

  it('chains legs: leg N+1 starts where leg N ended', () => {
    const stops = mkStops(15);
    const [a, b] = buildGmapsLegs({ lat: 39, lng: -75 }, stops);
    const aDest = new URL(a.url).searchParams.get('destination');
    const bOrigin = new URL(b.url).searchParams.get('origin');
    expect(bOrigin).toBe(aDest);
    expect(a.from).toBe(1); expect(a.to).toBe(10);
    expect(b.from).toBe(11); expect(b.to).toBe(15);
  });

  it('sends waypoint_place_ids only when every waypoint has one', () => {
    const withIds = mkStops(3).map((s, i) => ({ ...s, placeId: `pid${i}` }));
    const legs = buildGmapsLegs(null, withIds);
    expect(new URL(legs[0].url).searchParams.get('waypoint_place_ids')).toBe('pid0|pid1');
    const partial = mkStops(3).map((s, i) => (i === 0 ? { ...s, placeId: 'only' } : s));
    expect(new URL(buildGmapsLegs(null, partial)[0].url).searchParams.get('waypoint_place_ids')).toBeNull();
  });

  it('drops stops without coordinates and handles empty input', () => {
    expect(buildGmapsLegs(null, [])).toHaveLength(0);
    expect(buildGmapsLegs(null, [{ lat: NaN, lng: 1 }])).toHaveLength(0);
  });
});

describe('deriveCompanyKey (backend mirror)', () => {
  it('matches the CRM normalization', () => {
    expect(deriveCompanyKey("Joe's Store, LLC")).toBe('joesstorellc');
    expect(deriveCompanyKey('Happy Leaf Dispensary')).toBe('happyleafdispensary');
    expect(deriveCompanyKey('')).toBe('');
  });
});

describe('pinStatusOf', () => {
  it('maps CRM stage and visit history to a pin status', () => {
    expect(pinStatusOf({ crm: { stage: 'customer' } })).toBe('customer');
    expect(pinStatusOf({ crm: { stage: 'lost' } })).toBe('dead');
    expect(pinStatusOf({ crm: { stage: 'lead' } })).toBe('inCrm');
    expect(pinStatusOf({ lastVisitedAt: '2026-07-01' })).toBe('visited');
    expect(pinStatusOf({ verified: false })).toBe('unverified');
    expect(pinStatusOf({ verified: true })).toBe('fresh');
  });
});

describe('runStreakDays (mission log — the fun parts must be honest)', () => {
  const NOW = new Date(2026, 6, 19, 14, 0); // Jul 19 2026, local
  const day = (y, m, d) => ({ date: new Date(y, m, d, 10, 0).toISOString() });

  it('counts consecutive days ending today', () => {
    const runs = [day(2026, 6, 19), day(2026, 6, 18), day(2026, 6, 17)];
    expect(runStreakDays(runs, NOW)).toEqual({ days: 3, active: true });
  });

  it('anchors on yesterday so an unstarted morning keeps the streak', () => {
    const runs = [day(2026, 6, 18), day(2026, 6, 17)];
    expect(runStreakDays(runs, NOW)).toEqual({ days: 2, active: true });
  });

  it('a gap breaks the streak — honestly', () => {
    const runs = [day(2026, 6, 19), day(2026, 6, 17), day(2026, 6, 16)];
    expect(runStreakDays(runs, NOW)).toEqual({ days: 1, active: true });
    expect(runStreakDays([day(2026, 6, 15)], NOW)).toEqual({ days: 0, active: false });
  });

  it('two runs in one day count once; empty history is zero', () => {
    const runs = [day(2026, 6, 19), day(2026, 6, 19), day(2026, 6, 18)];
    expect(runStreakDays(runs, NOW).days).toBe(2);
    expect(runStreakDays([], NOW)).toEqual({ days: 0, active: false });
  });
});

describe('historyTotals', () => {
  it('sums the scoreboard and rounds miles', () => {
    const t = historyTotals([
      { stops: 9, visited: 7, pitched: 4, catalogsSent: 2, miles: 101.4 },
      { stops: 5, visited: 5, pitched: 1, catalogsSent: 1, miles: 40.9 },
    ]);
    expect(t).toEqual({ runs: 2, stops: 14, visited: 12, pitched: 5, catalogsSent: 3, miles: 142 });
  });

  it('tolerates empty and missing fields', () => {
    expect(historyTotals([]).runs).toBe(0);
    expect(historyTotals([{}]).stops).toBe(0);
  });
});

describe('haversineMi', () => {
  it('is ~0 for identical points and sane for a known pair', () => {
    expect(haversineMi({ lat: 40, lng: -74 }, { lat: 40, lng: -74 })).toBeCloseTo(0);
    // NYC → Philadelphia ≈ 80 mi straight-line
    const d = haversineMi({ lat: 40.7128, lng: -74.006 }, { lat: 39.9526, lng: -75.1652 });
    expect(d).toBeGreaterThan(70);
    expect(d).toBeLessThan(90);
  });

  it('stays finite at antipodal points (float rounding must not produce NaN)', () => {
    // Exactly opposite points push the haversine intermediate to (or a hair
    // past) 1 — unclamped, asin(√h) goes NaN and poisons route mileage.
    const d = haversineMi({ lat: 40, lng: -74 }, { lat: -40, lng: 106 });
    expect(Number.isFinite(d)).toBe(true);
    // Half the Earth's circumference ≈ 12,450 mi.
    expect(d).toBeGreaterThan(12000);
    expect(d).toBeLessThan(12900);
  });
});

describe('stateDistanceMi (nexus-aware printer ordering)', () => {
  it('has a centroid for every US state + DC (51 entries)', () => {
    expect(Object.keys(STATE_CENTROIDS)).toHaveLength(51);
  });

  it('is 0 for a state against itself', () => {
    expect(stateDistanceMi('TX', 'TX')).toBeCloseTo(0);
  });

  it('ranks a neighbor nearer than a far state — NM sees TX before NY', () => {
    const toTx = stateDistanceMi('NM', 'TX');
    const toNy = stateDistanceMi('NM', 'NY');
    expect(toTx).toBeLessThan(toNy);
    // TX is adjacent to NM; a few hundred miles centroid-to-centroid.
    expect(toTx).toBeGreaterThan(100);
    expect(toTx).toBeLessThan(700);
  });

  it('is case- and whitespace-insensitive on the 2-letter code', () => {
    expect(stateDistanceMi(' nm ', 'tx')).toBeCloseTo(stateDistanceMi('NM', 'TX'));
  });

  it('returns NaN when either state is unknown or blank', () => {
    expect(Number.isNaN(stateDistanceMi('NM', ''))).toBe(true);
    expect(Number.isNaN(stateDistanceMi('ZZ', 'TX'))).toBe(true);
    expect(Number.isNaN(stateDistanceMi(undefined, 'TX'))).toBe(true);
  });

  it('sorts a printer list nearest-first for a NM ship-to (skipping same-state)', () => {
    // Mirrors the Quoter picker: rank eligible printers by miles, sink same-state.
    const printers = [
      { state: 'NY' }, { state: 'CA' }, { state: 'TX' }, { state: 'AZ' },
    ];
    const ranked = [...printers].sort((a, b) =>
      stateDistanceMi('NM', a.state) - stateDistanceMi('NM', b.state));
    // AZ and TX (both border NM) lead; NY trails.
    expect(['AZ', 'TX']).toContain(ranked[0].state);
    expect(ranked[ranked.length - 1].state).toBe('NY');
  });
});
