// src/screens/studio/_roadTripGeo.js
//
// Pure geometry helpers for the road-trip tooling. No React, no Mapbox —
// just math. Mirrors controllers/roadTripRoute.js on the backend so both
// sides compute progress along a path the same way.
//
// We use an equirectangular projection (flat-earth) instead of great-circle
// formulas. For trip-scale distances (<800 mi corridors) the error is
// negligible and the code is simpler / faster than haversine + bearing
// chains.

export const R_M = 6_371_000;
export const M_PER_MI = 1609.344;

/**
 * Project (latDeg, lngDeg) into meters, using `refLatDeg` for the longitude
 * scale factor. For a small region just use the midpoint of A and B.
 */
export function toEquirect(latDeg, lngDeg, refLatDeg) {
  const lat = (latDeg * Math.PI) / 180;
  const lng = (lngDeg * Math.PI) / 180;
  const refLat = (refLatDeg * Math.PI) / 180;
  return { x: R_M * lng * Math.cos(refLat), y: R_M * lat };
}

/** Great-circle distance (meters) — kept around for simple "how far" queries. */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_M * Math.asin(Math.sqrt(a));
}

export function haversineMiles(lat1, lng1, lat2, lng2) {
  return haversineMeters(lat1, lng1, lat2, lng2) / M_PER_MI;
}

/**
 * Project point P onto line A→B. Returns:
 *   progress      — fraction of the line P projects to (0 at A, 1 at B; can be <0 or >1)
 *   crossTrackMi  — perpendicular distance from P to the line, in miles
 */
export function corridorProject(A, B, P) {
  const refLat = (A.lat + B.lat) / 2;
  const a = toEquirect(A.lat, A.lng, refLat);
  const b = toEquirect(B.lat, B.lng, refLat);
  const p = toEquirect(P.lat, P.lng, refLat);
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0) return { progress: 0, crossTrackMi: 0 };
  const t = (apx * abx + apy * aby) / abLen2;
  const closestX = a.x + t * abx, closestY = a.y + t * aby;
  const dx = p.x - closestX, dy = p.y - closestY;
  return { progress: t, crossTrackMi: Math.sqrt(dx * dx + dy * dy) / M_PER_MI };
}

/** Count points within `radiusMi` of a center (equirectangular, fast). */
export function countWithin(center, points, radiusMi) {
  const r2 = (radiusMi * M_PER_MI) ** 2;
  const refLat = center.lat;
  const c = toEquirect(center.lat, center.lng, refLat);
  let n = 0;
  for (const p of points) {
    if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) continue;
    const e = toEquirect(p.lat, p.lng, refLat);
    const dx = e.x - c.x, dy = e.y - c.y;
    if (dx * dx + dy * dy <= r2) n++;
  }
  return n;
}

/** Format a mileage value for compact UI display. */
export function formatMiles(mi) {
  if (!Number.isFinite(mi)) return '—';
  if (mi < 0.1)  return '0.1mi';
  if (mi < 10)   return `${mi.toFixed(1)}mi`;
  return `${Math.round(mi)}mi`;
}

/** Format minutes into "Hh Mm" or "M min". */
export function formatMinutes(min) {
  if (!Number.isFinite(min)) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Rough drive-time estimate from a list of waypoints. Used while the user
 * is still ticking checkboxes — the real number comes back when Mapbox
 * Directions returns. 45 mph average is conservative for mixed US driving
 * (highway + city pitches).
 */
export function approxDriveMinutes(coords /* [[lng,lat],...] */) {
  if (!coords || coords.length < 2) return 0;
  let mi = 0;
  for (let i = 1; i < coords.length; i++) {
    mi += haversineMiles(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return (mi / 45) * 60;
}
