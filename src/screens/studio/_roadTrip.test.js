// src/screens/studio/_roadTrip.test.js
//
// Pins the Field Map's pure helpers — most importantly the Google Maps
// handoff chunking (the 9-waypoint cap is a hard external constraint) and
// the companyKey mirror of the backend derivation.

import {
  buildGmapsLegs, GMAPS_WAYPOINT_CAP, deriveCompanyKey, pinStatusOf, haversineMi,
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
