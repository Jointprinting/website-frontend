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
//   rec  — licensed adult-use dispensaries (24 roster states)
//   med  — licensed medical-only dispensaries (14 roster states — PA, FL, OK…
//          license-loaded server-side just like the rec markets)
//   hemp — hemp-derived-THC retail ("bodega THC": delta-8/THCA smoke, vape
//          and CBD shops in states with no legal marijuana retail)
// The server derives a pin's segment from its state + source; '' (unknown)
// pins always render regardless of which clickers are on. ───────────────────
export const SEGMENTS = [
  { id: 'rec',  label: 'REC',      color: '#4ade80' },
  { id: 'med',  label: 'MED',      color: '#60a5fa' },
  { id: 'hemp', label: 'HEMP THC', color: '#c084fc' },
];

// The fourth clicker: chain / MSO stores. Excluded server-side unless asked
// for (`chains=true`) — the count of hidden chains always comes back so an
// MSO-dominated market (Philly med) is never silently invisible.
export const CHAINS_CLICKER = { id: 'chains', label: 'CHAINS', color: '#f472b6' };

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

// ── Mission log math (run history panel) ─────────────────────────────────────
// Honest streak/totals over the server's per-day run summaries — same spirit
// as the Content tab's unit-tested streak chip: the fun parts must be honest.

const localDayKey = (d) => {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/**
 * Consecutive-day run streak. Counts back from today (or yesterday, so an
 * unstarted morning doesn't read as a broken streak) through days that have
 * at least one archived run. → { days, active }
 */
export function runStreakDays(summaries, now = new Date()) {
  const days = new Set(
    (summaries || []).map((r) => r.date || r.endedAt).filter(Boolean).map(localDayKey)
  );
  if (!days.size) return { days: 0, active: false };
  let cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = () => { cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1); };
  if (!days.has(localDayKey(cur))) back(); // streak may anchor on yesterday
  if (!days.has(localDayKey(cur))) return { days: 0, active: false };
  let n = 0;
  while (days.has(localDayKey(cur))) { n += 1; back(); }
  return { days: n, active: true };
}

/** All-time scoreboard across run summaries. */
export function historyTotals(summaries) {
  const t = { runs: 0, stops: 0, visited: 0, pitched: 0, catalogsSent: 0, miles: 0 };
  for (const r of (summaries || [])) {
    t.runs += 1;
    t.stops += r.stops || 0;
    t.visited += r.visited || 0;
    t.pitched += r.pitched || 0;
    t.catalogsSent += r.catalogsSent || 0;
    t.miles += r.miles || 0;
  }
  t.miles = Math.round(t.miles);
  return t;
}

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

// ── US state centroids (approx geographic center of each state, lat/lng) ──────
// Used to rank printers by how close they are to the ship-to state, so the
// Quoter surfaces the nearest LEGAL printer first (lowest freight + fastest
// transit). Coarse by design — this is for ordering a short list, not routing.
export const STATE_CENTROIDS = {
  AL: { lat: 32.8,  lng: -86.8  }, AK: { lat: 64.2,  lng: -152.3 },
  AZ: { lat: 34.2,  lng: -111.7 }, AR: { lat: 34.9,  lng: -92.4  },
  CA: { lat: 37.2,  lng: -119.4 }, CO: { lat: 39.0,  lng: -105.5 },
  CT: { lat: 41.6,  lng: -72.7  }, DE: { lat: 39.0,  lng: -75.5  },
  DC: { lat: 38.9,  lng: -77.0  }, FL: { lat: 28.6,  lng: -82.4  },
  GA: { lat: 32.6,  lng: -83.4  }, HI: { lat: 20.3,  lng: -156.4 },
  ID: { lat: 44.4,  lng: -114.6 }, IL: { lat: 40.0,  lng: -89.2  },
  IN: { lat: 39.9,  lng: -86.3  }, IA: { lat: 42.0,  lng: -93.5  },
  KS: { lat: 38.5,  lng: -98.4  }, KY: { lat: 37.5,  lng: -85.3  },
  LA: { lat: 31.0,  lng: -92.0  }, ME: { lat: 45.4,  lng: -69.2  },
  MD: { lat: 39.0,  lng: -76.8  }, MA: { lat: 42.3,  lng: -71.8  },
  MI: { lat: 44.3,  lng: -85.4  }, MN: { lat: 46.3,  lng: -94.3  },
  MS: { lat: 32.7,  lng: -89.7  }, MO: { lat: 38.4,  lng: -92.5  },
  MT: { lat: 47.0,  lng: -109.6 }, NE: { lat: 41.5,  lng: -99.8  },
  NV: { lat: 39.3,  lng: -116.6 }, NH: { lat: 43.7,  lng: -71.6  },
  NJ: { lat: 40.1,  lng: -74.5  }, NM: { lat: 34.4,  lng: -106.1 },
  NY: { lat: 42.9,  lng: -75.5  }, NC: { lat: 35.6,  lng: -79.4  },
  ND: { lat: 47.5,  lng: -100.5 }, OH: { lat: 40.3,  lng: -82.8  },
  OK: { lat: 35.6,  lng: -97.5  }, OR: { lat: 44.0,  lng: -120.6 },
  PA: { lat: 40.9,  lng: -77.8  }, RI: { lat: 41.7,  lng: -71.6  },
  SC: { lat: 33.9,  lng: -80.9  }, SD: { lat: 44.4,  lng: -100.2 },
  TN: { lat: 35.9,  lng: -86.4  }, TX: { lat: 31.5,  lng: -99.3  },
  UT: { lat: 39.3,  lng: -111.7 }, VT: { lat: 44.1,  lng: -72.7  },
  VA: { lat: 37.5,  lng: -78.9  }, WA: { lat: 47.4,  lng: -120.5 },
  WV: { lat: 38.6,  lng: -80.6  }, WI: { lat: 44.6,  lng: -90.0  },
  WY: { lat: 43.0,  lng: -107.6 },
};

// Great-circle miles between two US state centroids (case/space-insensitive
// 2-letter codes). NaN when either state is unknown/blank — callers treat NaN
// as "distance unknown" and sort those last, above the nexus-blocked ones.
export function stateDistanceMi(a, b) {
  const A = STATE_CENTROIDS[String(a || '').trim().toUpperCase()];
  const B = STATE_CENTROIDS[String(b || '').trim().toUpperCase()];
  if (!A || !B) return NaN;
  return haversineMi(A, B);
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
