// src/screens/studio/mockup/flattenSide.js
//
// Baking one side of a mockup — garment photo + artwork at its placement — into
// a single flat image.
//
// This was a private copy inside NativeMockupLab (and a near-twin in
// MockupEditor). It is extracted because a colour variation needs exactly the
// same bake: swapping the garment invalidates the old composite, and a
// variation flattened even slightly differently from the lab would show the
// client a proof that doesn't match the one the owner is looking at.
//
// It uses the SHARED blankBox (printAreas.js) — the same geometry the interactive
// canvas and the print-area guide derive from — so every side, on screen or not,
// bakes identically.
import { blankBox } from './printAreas';

// Resolve an <img> from a URL or data URL. Never rejects: a garment photo that
// won't load must degrade to "no composite", not throw inside a save.
export const loadImg = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => resolve(im);
  im.onerror = () => resolve(null);
  im.src = src;
});

export async function flattenHeadless(blankSrc, logoSrc, pos) {
  const [blank, logo] = await Promise.all([loadImg(blankSrc), loadImg(logoSrc)]);
  if (!blank) return null;
  const bW = blank.naturalWidth, bH = blank.naturalHeight;
  const off = document.createElement('canvas'); off.width = bW; off.height = bH;
  const ctx = off.getContext('2d');
  ctx.drawImage(blank, 0, 0, bW, bH);
  if (logo && pos && pos.x != null) {
    const box = blankBox(bW, bH);
    const sX = bW / box.dispW, sY = bH / box.dispH;
    const lw = logo.naturalWidth * (pos.w || 1) * sX, lh = logo.naturalHeight * (pos.h || 1) * sY;
    const lx = (pos.x - box.originX) * sX, ly = (pos.y - box.originY) * sY;
    const cx = lx + lw / 2, cy = ly + lh / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(((pos.angle || 0) * Math.PI) / 180);
    ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh); ctx.restore();
  }
  try { return off.toDataURL('image/png'); } catch (_) { return null; }
}
