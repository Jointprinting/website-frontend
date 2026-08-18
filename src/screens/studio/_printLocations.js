// src/screens/studio/_printLocations.js
//
// MIRROR of website-backend/utils/printLocations.js — keep the two identical
// (same discipline as the CRM stages / tax rates / mockup numbers). The builder
// previews the flat summary from these rules and the server folds it on save; a
// divergence would show the owner a description the saved document doesn't have.
//
// ONE GARMENT, SEVERAL DECORATIONS. A confirmation item carried a single
// `printType`, so a shirt with a screen-printed front and a DTG back could only
// be described as one or the other.

const s = (v) => String(v == null ? '' : v).trim();

export function realLocations(list) {
  return (Array.isArray(list) ? list : [])
    .filter((l) => l && (s(l.location) || s(l.method) || s(l.details)));
}

export function methodsOf(list) {
  const out = [];
  for (const l of realLocations(list)) {
    const m = s(l.method);
    if (m && !out.some((x) => x.toLowerCase() === m.toLowerCase())) out.push(m);
  }
  return out;
}

export function summarizeType(list) { return methodsOf(list).join(' + '); }

export function summarizeDetails(list) {
  return realLocations(list)
    .map((l) => {
      const where = s(l.location);
      const what = [s(l.method), s(l.details)].filter(Boolean).join(' ');
      if (where && what) return `${where}: ${what}`;
      return where || what;
    })
    .filter(Boolean)
    .join(' · ');
}

export function flatFieldsFor(list) {
  if (!realLocations(list).length) return {};
  return { printType: summarizeType(list), printDetails: summarizeDetails(list) };
}

// The placements the owner actually uses, in the order he adds them.
export const PRINT_PLACEMENTS = ['Front', 'Back', 'Left sleeve', 'Right sleeve', 'Left chest', 'Hood', 'Nape', 'Pocket'];
// The decoration methods the print engine already knows (printerPricing dispatch).
export const PRINT_METHODS = ['Screen Print', 'DTG', 'DTF', 'Embroidery', 'Digital Squeegee', 'Vinyl', 'Sublimation'];

// The next sensible placement to add — front, then back, then a sleeve.
export function nextPlacement(list) {
  const used = new Set(realLocations(list).map((l) => s(l.location).toLowerCase()));
  return PRINT_PLACEMENTS.find((p) => !used.has(p.toLowerCase())) || '';
}
