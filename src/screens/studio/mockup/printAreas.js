// src/screens/studio/mockup/printAreas.js
//
// Auto-placement presets ported verbatim from the legacy /jpstudio editor
// (PRESETS, lines 2145-2154). Percentage-based: xPct/yPct = the logo's CENTER as a
// fraction of the garment blank, wPct = the logo's width as a fraction of the blank
// width. `presetPos` reproduces the legacy math (openLogoEditor lines 3982-3994) in
// the v2 editor's fixed 620×500 stage, so a preset drops the logo in the same spot
// the classic editor did. Pure — no DOM.

export const PRESETS = {
  lc: { label: 'L Chest',  xPct: 0.32, yPct: 0.28, wPct: 0.18 },
  cc: { label: 'Ctr Chest', xPct: 0.50, yPct: 0.34, wPct: 0.28 },
  rc: { label: 'R Chest',  xPct: 0.68, yPct: 0.28, wPct: 0.18 },
  lp: { label: 'Pocket',   xPct: 0.35, yPct: 0.24, wPct: 0.11 },
  fb: { label: 'Full Back', xPct: 0.50, yPct: 0.42, wPct: 0.52 },
  cb: { label: 'Ctr Back', xPct: 0.50, yPct: 0.38, wPct: 0.36 },
  sl: { label: 'Sleeve',   xPct: 0.20, yPct: 0.45, wPct: 0.13 },
  nk: { label: 'Nape',     xPct: 0.50, yPct: 0.18, wPct: 0.19 },
};

// The 8 quick spots, in display order.
export const PRESET_ORDER = ['lc', 'cc', 'rc', 'lp', 'fb', 'cb', 'sl', 'nk'];

// preset + the blank's box in the stage (originX/originY/dispW/dispH) + the logo's
// natural dims → a placement {x, y, w, h, angle}. w/h are the logo's scaleX/scaleY
// (× the logo's natural size = display size), matching the model's pos convention.
export function presetPos(preset, box, logoNat) {
  if (!preset || !box || !logoNat || !logoNat.w) return null;
  const targetW = box.dispW * preset.wPct;               // logo display width
  const scale = targetW / logoNat.w;                     // uniform scaleX = scaleY
  const dispW = logoNat.w * scale, dispH = logoNat.h * scale;
  const cx = box.originX + box.dispW * preset.xPct;      // logo center
  const cy = box.originY + box.dispH * preset.yPct;
  return { x: cx - dispW / 2, y: cy - dispH / 2, w: scale, h: scale, angle: 0 };
}

// ── Print-placement constraints — ported verbatim from the classic lab ────────
// Per product category × side: the max printable area in REAL INCHES and where
// it sits on the garment (industry-standard imprint sizes: tee full-front/back
// 12×16 screen print, left-chest 4″, hoodie 12×12, hat 5.5×2.25 embroidery,
// tote 10×10). INCHES → STAGE PIXELS through ONE ratio:
//   ppi = blank display width / garmentWidthIn
// (a product-photography blank spans ≈ the category's garment width — a tee
// photographed flat reads ≈22in across). The guide box, clamping, inch presets,
// and the smart Dimensions readout all derive from that one ratio.
export const PRINT_AREAS = {
  generic: { label: 'Generic', garmentWidthIn: null, areas: {} },   // no limits — default
  tshirt: {
    label: 'T-Shirt', garmentWidthIn: 22,
    areas: {
      front: { maxWIn: 12, maxHIn: 16, topPct: 0.21, method: 'screen print',
        anchor: 'full front — starts ~3in below the collar',
        presets: [
          { label: 'Left Chest', wIn: 4, cx: 0.27, cy: 0.14 },
          { label: 'Ctr Chest', wIn: 10, cx: 0.50, cy: 0.28 },
          { label: 'Full Front', wIn: 12, cx: 0.50, cy: 0.50 },
        ] },
      back: { maxWIn: 12, maxHIn: 16, topPct: 0.16, method: 'screen print',
        anchor: 'full back — starts just below the collar seam',
        presets: [
          { label: 'Upper Back', wIn: 10, cx: 0.50, cy: 0.16 },
          { label: 'Full Back', wIn: 12, cx: 0.50, cy: 0.50 },
          { label: 'Nape', wIn: 3.5, cx: 0.50, cy: 0.06 },
        ] },
    },
  },
  hoodie: {
    label: 'Hoodie', garmentWidthIn: 24,
    areas: {
      front: { maxWIn: 12, maxHIn: 12, topPct: 0.30, method: 'screen print',
        anchor: 'chest — below the hood, above the kangaroo pocket',
        presets: [
          { label: 'Left Chest', wIn: 4, cx: 0.27, cy: 0.18 },
          { label: 'Ctr Chest', wIn: 10, cx: 0.50, cy: 0.40 },
          { label: 'Full Front', wIn: 12, cx: 0.50, cy: 0.50 },
        ] },
      back: { maxWIn: 12, maxHIn: 14, topPct: 0.22, method: 'screen print',
        anchor: 'full back — below the hood seam',
        presets: [
          { label: 'Upper Back', wIn: 10, cx: 0.50, cy: 0.18 },
          { label: 'Full Back', wIn: 12, cx: 0.50, cy: 0.50 },
        ] },
    },
  },
  hat: {
    label: 'Hat', garmentWidthIn: 8.5,
    areas: {
      front: { maxWIn: 5.5, maxHIn: 2.25, topPct: 0.38, method: 'embroidery',
        anchor: 'front crown panels, centered',
        presets: [{ label: 'Front Panel', wIn: 4.5, cx: 0.50, cy: 0.50 }] },
      back: { maxWIn: 4, maxHIn: 1.75, topPct: 0.42, method: 'embroidery',
        anchor: 'back arc above the closure',
        presets: [{ label: 'Back Arc', wIn: 3.5, cx: 0.50, cy: 0.50 }] },
    },
  },
  tote: {
    label: 'Tote Bag', garmentWidthIn: 16,
    areas: {
      front: { maxWIn: 10, maxHIn: 10, topPct: 0.34, method: 'screen print',
        anchor: 'centered on the bag face, below the handles',
        presets: [
          { label: 'Center', wIn: 8, cx: 0.50, cy: 0.50 },
          { label: 'Full', wIn: 10, cx: 0.50, cy: 0.50 },
        ] },
      back: { maxWIn: 10, maxHIn: 10, topPct: 0.34, method: 'screen print',
        anchor: 'centered on the bag face, below the handles',
        presets: [{ label: 'Center', wIn: 8, cx: 0.50, cy: 0.50 }] },
    },
  },
};

export const CATEGORY_ORDER = ['generic', 'tshirt', 'hoodie', 'hat', 'tote'];

// category + side + the blank's box in the stage → the printable rect in stage
// pixels plus the ppi ratio, or null for generic / unknown. Same geometry as the
// classic _printAreaRect: centered horizontally, anchored at topPct, height
// clamped to the garment bottom.
export function printAreaRect(category, side, box) {
  const cat = PRINT_AREAS[category];
  if (!cat || !cat.garmentWidthIn || !box) return null;
  const area = cat.areas && cat.areas[side];
  if (!area) return null;
  const ppi = box.dispW / cat.garmentWidthIn;
  const w = Math.min(area.maxWIn * ppi, box.dispW);
  let h = area.maxHIn * ppi;
  const left = box.originX + (box.dispW - w) / 2;
  const top = box.originY + box.dispH * area.topPct;
  if (top + h > box.originY + box.dispH) h = box.originY + box.dispH - top;   // keep the box on the garment
  return { left, top, width: w, height: h, ppi, maxWIn: area.maxWIn, maxHIn: area.maxHIn, method: area.method, presets: area.presets || [] };
}
