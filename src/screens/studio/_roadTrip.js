// src/screens/studio/_roadTrip.js
//
// Shared vocabulary + pure helpers for the Field Map (RoadTripTab). Anything
// with logic worth testing lives here, out of the component: the Google Maps
// multi-stop handoff (with its real waypoint caps), CRM key derivation
// (mirrors the backend), distance math, and the rec-state registry mirror.

// ── CRM key derivation (MIRRORS utils/fieldTrackerImport.js deriveCompanyKey
// on the backend — keep byte-for-byte in sync) ───────────────────────────────
export function deriveCompanyKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ── Market segments (MIRRORS services/dispensaryStates.js SEGMENTS /
// deriveSegment on the backend — keep ids in sync). The map's clickers:
//   rec  — licensed adult-use dispensaries
//   med  — licensed medical-only dispensaries
//   hemp — hemp-derived-THC retail ("bodega THC": delta-8/THCA smoke, vape
//          and CBD shops in states with no legal marijuana retail)
// The server derives a pin's segment from its state + source; '' (unknown)
// pins always render regardless of which clickers are on. ───────────────────
export const SEGMENTS = [
  { id: 'rec',  label: 'REC',      color: '#4ade80' },
  { id: 'med',  label: 'MED',      color: '#60a5fa' },
  { id: 'hemp', label: 'HEMP THC', color: '#c084fc' },
];

// ── Quick to-do chips — each writes a CRM next-action log entry + follow-up
// date so it lands in the CRM Today queue. ───────────────────────────────────
export const TODO_CHIPS = [
  { id: 'mockups', label: 'MOCKUPS',      logText: 'To-do: make mockups' },
  { id: 'quote',   label: 'QUOTE',        logText: 'To-do: price a quote' },
  { id: 'catalog', label: 'SEND CATALOG', logText: 'To-do: send catalog' },
  { id: 'call',    label: 'CALL BACK',    logText: 'To-do: call back' },
];

// Visit outcomes for the run tray's one-tap capture.
export const OUTCOME_CHIPS = [
  { id: 'pitched',  label: 'PITCHED',   color: '#4ade80' },
  { id: 'no_buyer', label: 'NO BUYER',  color: '#fbbf24' },
  { id: 'dead',     label: 'NOT A FIT', color: '#6b7280' },
];

// 🔥 interest scale for the on-road contact capture (1–5).
export const INTEREST_LABELS = ['', 'not into it', 'lukewarm', 'curious', 'hot', 'ON FIRE'];

// ── Distance ─────────────────────────────────────────────────────────────────
export function haversineMi(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  // Clamp: float rounding can push h a hair past 1 (near-antipodal points),
  // and asin(√h>1) is NaN — which would poison a whole route's mileage.
  return 2 * 3958.8 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function fmtMi(mi) {
  if (!isFinite(mi)) return '';
  return mi < 10 ? `${mi.toFixed(1)}mi` : `${Math.round(mi)}mi`;
}

// ── Google Maps multi-stop handoff ───────────────────────────────────────────
//
// Real limits (verified against the Maps URLs docs, 2026): one directions URL
// carries origin + up to 9 waypoints + destination when it opens in the
// Google Maps app or desktop; mobile *browsers* only honor 3 waypoints, but
// the universal https URL opens the installed app on iOS/Android, so 9 is
// the practical cap. Bigger runs are split into consecutive legs — each
// leg's origin is the previous leg's last stop — and the user taps the next
// leg's link when they finish the current one.

export const GMAPS_WAYPOINT_CAP = 9;

const pt = (s) => `${s.lat},${s.lng}`;

/**
 * Build the chunked Google Maps handoff for an ordered run.
 *   start: {lat,lng} | null  — current location; null lets Google use
 *                              "your location" as the first origin.
 *   stops: [{lat,lng,placeId?}] in final driving order.
 * Returns [{url, from, to, count}] — one entry per leg.
 */
export function buildGmapsLegs(start, stops, { cap = GMAPS_WAYPOINT_CAP } = {}) {
  const clean = (stops || []).filter((s) => isFinite(s?.lat) && isFinite(s?.lng));
  if (!clean.length) return [];

  // Per leg: origin (prev leg's end or start) + up to `cap` waypoints +
  // destination ⇒ cap+1 stops consumed per leg.
  const legs = [];
  let origin = start && isFinite(start.lat) && isFinite(start.lng) ? { ...start } : null;
  let i = 0;
  while (i < clean.length) {
    const chunk = clean.slice(i, i + cap + 1);
    const dest = chunk[chunk.length - 1];
    const waypoints = chunk.slice(0, -1);
    const params = new URLSearchParams({ api: '1', travelmode: 'driving' });
    if (origin) params.set('origin', pt(origin));
    params.set('destination', pt(dest));
    if (dest.placeId) params.set('destination_place_id', dest.placeId);
    if (waypoints.length) {
      params.set('waypoints', waypoints.map(pt).join('|'));
      // place_ids must pair 1:1 with waypoints — only send when we have all.
      if (waypoints.every((w) => w.placeId)) {
        params.set('waypoint_place_ids', waypoints.map((w) => w.placeId).join('|'));
      }
    }
    legs.push({
      url: `https://www.google.com/maps/dir/?${params.toString()}`,
      from: i + 1,
      to: i + chunk.length,
      count: chunk.length,
    });
    origin = dest;
    i += chunk.length;
  }
  return legs;
}

// ── Pin status → color story (single source for markers + legend) ───────────
export const PIN_STATUS = {
  fresh:      { color: '#4ade80', label: 'Untouched' },        // never visited, not in CRM
  unverified: { color: '#94a3b8', label: 'Unverified (Google find)' },
  inCrm:      { color: '#60a5fa', label: 'In pipeline' },       // CRM lead/contacted/quoting/sampling
  customer:   { color: '#2dd4bf', label: 'Customer' },          // CRM won/customer
  dead:       { color: '#6b7280', label: 'Lost / dormant' },
  visited:    { color: '#fbbf24', label: 'Visited' },           // field-visited, no CRM record yet
};

export function pinStatusOf(d) {
  const stage = d?.crm?.stage;
  if (stage === 'won' || stage === 'customer') return 'customer';
  if (stage === 'lost' || stage === 'dormant') return 'dead';
  if (stage) return 'inCrm';
  if (d?.lastVisitedAt) return 'visited';
  if (d && d.verified === false) return 'unverified';
  return 'fresh';
}
