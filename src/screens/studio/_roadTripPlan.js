// src/screens/studio/_roadTripPlan.js
//
// Pure helpers for the "PITCH ROUTE" planner. Given an origin, a sleep
// destination, a list of corridor candidates and which ones the user
// checked, returns:
//   - the ordered waypoint list to send to Mapbox Directions
//   - approximated mileage / drive-time / detour totals for the UI summary

import { corridorProject, haversineMiles, approxDriveMinutes, M_PER_MI } from './_roadTripGeo';

/**
 * Build the ordered route plan.
 *
 * @param {object}   opts
 * @param {{lat,lng}} opts.origin
 * @param {{lat,lng}} opts.sleep
 * @param {Array<{_id,lat,lng,progress?,crossTrackMi?}>} opts.candidates
 * @param {Set<string>} opts.selectedIds
 * @returns {object} { coords, stops, totals: { stopCount, detourMi, etaMin } }
 */
export function buildPitchPlan({ origin, sleep, candidates, selectedIds }) {
  if (!origin || !sleep) {
    return { coords: [], stops: [], totals: { stopCount: 0, detourMi: 0, etaMin: 0 } };
  }

  // Pull only the checked candidates and (re-)compute progress so ordering
  // is stable even if the server didn't include it.
  const A = { lat: origin.lat, lng: origin.lng };
  const B = { lat: sleep.lat, lng: sleep.lng };

  const picked = candidates
    .filter((c) => selectedIds.has(c._id))
    .map((c) => {
      const proj = (typeof c.progress === 'number')
        ? { progress: c.progress, crossTrackMi: c.crossTrackMi ?? 0 }
        : corridorProject(A, B, c);
      return { ...c, _projProgress: proj.progress, _projCrossMi: proj.crossTrackMi };
    });

  // Sort by progress along A→B. Ties broken by cross-track distance so we
  // hit the closer-to-line option first.
  picked.sort((a, b) => {
    const dp = a._projProgress - b._projProgress;
    if (Math.abs(dp) > 0.01) return dp;
    return a._projCrossMi - b._projCrossMi;
  });

  const stops = picked;
  const coords = [
    [A.lng, A.lat],
    ...stops.map((s) => [s.lng, s.lat]),
    [B.lng, B.lat],
  ];

  const directMi = haversineMiles(A.lat, A.lng, B.lat, B.lng);
  const planMi   = haversineMiles(A.lat, A.lng, A.lat, A.lng) // unused init
                 + sumPathMiles(coords);
  const detourMi = Math.max(0, planMi - directMi);
  const etaMin   = approxDriveMinutes(coords);

  return {
    coords,
    stops,
    totals: {
      stopCount: stops.length,
      detourMi,
      etaMin,
    },
  };
}

function sumPathMiles(coords) {
  let mi = 0;
  for (let i = 1; i < coords.length; i++) {
    mi += haversineMiles(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return mi;
}

/** Group corridor candidates into 10% progress buckets for visual ordering. */
export function bucketByProgress(candidates) {
  const buckets = new Map();
  for (const c of candidates) {
    const b = Math.max(0, Math.min(9, Math.floor((c.progress ?? 0) * 10)));
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(c);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([b, items]) => ({ bucket: b, items }));
}

/** Format the next-stop summary string used by the GO card. */
export function nextStopSummary(nextStop, sleep) {
  if (!nextStop) return '';
  const parts = [nextStop.name];
  if (nextStop._distanceMi != null) parts.push(`${nextStop._distanceMi.toFixed(1)}mi`);
  if (nextStop._etaMin != null)     parts.push(`ETA ${Math.round(nextStop._etaMin)}min`);
  return parts.join(' · ');
}

export { M_PER_MI };
