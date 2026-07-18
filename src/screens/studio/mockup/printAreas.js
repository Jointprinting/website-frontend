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
