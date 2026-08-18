// src/screens/studio/mockup/recolor.js
//
// SAME DESIGN, DIFFERENT GARMENT COLOUR.
//
// The owner's ask: "when I make a mockup I should be able to make a colour
// variation of that mockup — like just swapping a black tee to a grey tee and
// all designs stay the same."
//
// That is cheap, because a mockup already keeps the garment and the art apart.
// One side is { blank, logo, composite, pos } (mockupModel.emptySide): the blank
// is the garment photo, the logo is the artwork, and `pos` is where the art sits.
// A colour variation is therefore: point `blank` at the new colourway's photo,
// leave `logo` and `pos` alone, and re-flatten.
//
// The one thing that CANNOT just be copied is `pos`. Placements are stored in
// absolute stage pixels, so two garment photos of even slightly different size
// or aspect sit in a different box within that stage and the same coordinates
// land somewhere else on the shirt — the print visibly shifts. printAreas
// already has the fix (remapPlacement, written for exactly this case); this
// module is what finally calls it.
//
// Pure except for the flatten step, which needs a canvas — so the decision-making
// (what to swap, what to remap, what can't be recoloured) is separated out and
// unit-tested, and the caller supplies the flattener.

import { blankBox, remapPlacement } from './printAreas';

const SIDES = ['front', 'back'];

// Can this page be recoloured at all?
//
// It needs the ARTWORK as its own layer. A page that only has a flattened
// composite — a legacy file from the old vanilla-JS studio, or an uploaded promo
// shot — has the art already burned into the garment photo, and swapping the
// blank would just replace the whole picture and lose the design. Say so instead
// of producing a silently broken proof.
export function canRecolor(page) {
  if (!page || !page.sides) return false;
  return SIDES.some((s) => {
    const sd = page.sides[s];
    return !!(sd && sd.logo && sd.blank && sd.logo !== sd.blank);
  });
}

// Why not, in words the owner can act on.
export function whyNotRecolor(page) {
  if (!page || !page.sides) return 'That mockup has no pages to recolour.';
  const anyArt = SIDES.some((s) => page.sides[s] && page.sides[s].logo);
  if (!anyArt) {
    return 'This mockup only has the flattened image — its artwork layer isn’t stored separately, '
      + 'so the garment can’t be swapped without losing the design. Re-upload the artwork on it first, '
      + 'then colour variations will work.';
  }
  return 'This mockup has artwork but no separate garment photo to swap.';
}

// The natural size of a loaded image, via the caller's loader. Returns null when
// the image can't be read, which makes the remap a no-op rather than a guess.
async function boxOf(loadImg, src) {
  if (!src) return null;
  const img = await loadImg(src);
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  return blankBox(img.naturalWidth, img.naturalHeight);
}

// Recolour ONE page onto a colourway: { front, back } garment photos.
//
// Returns a NEW page — the source is never mutated, because the original proof
// is a thing the client may already have approved.
//
// A side with no new photo for it keeps the garment it had. That matters for a
// front-only colourway: S&S sometimes has a front image and no back, and
// blanking the back would destroy a side of the proof to no purpose.
export async function recolorPage(page, colorway, { loadImg, flatten }) {
  const next = {
    ...page,
    sides: { ...page.sides },
    _extra: { ...(page._extra || {}) },
  };

  for (const s of SIDES) {
    const sd = page.sides && page.sides[s];
    if (!sd) continue;
    const newBlank = s === 'front' ? colorway.front : colorway.back;
    if (!newBlank) { next.sides[s] = { ...sd }; continue; }

    // Re-anchor the art to the new garment's box so the print stays on the same
    // spot of the shirt. Both boxes must be readable or we leave `pos` alone —
    // an unremapped placement is at worst unchanged; a half-computed one moves
    // the print for no reason.
    const [oldBox, newBox] = await Promise.all([boxOf(loadImg, sd.blank), boxOf(loadImg, newBlank)]);
    const pos = (oldBox && newBox) ? remapPlacement(sd.pos, oldBox, newBox) : sd.pos;

    // The old composite is the art on the OLD garment — it must go, or the tile
    // would show the colour we just replaced.
    const side = { ...sd, blank: newBlank, pos, composite: null };
    if (side.logo && side.pos && side.pos.x != null) {
      const comp = await flatten(side.blank, side.logo, side.pos);
      if (comp) side.composite = comp;
    }
    next.sides[s] = side;
  }
  return next;
}

// Recolour a whole mockup — EVERY page, not just the one on screen.
//
// A multi-page mockup (a front sheet plus a sleeve sheet) is one proof, and
// recolouring only the visible page would produce a variation that is half black
// and half grey. Pages that can't be recoloured are carried over untouched so a
// mixed file degrades to "some pages kept their garment" rather than failing.
export async function recolorPages(pages, colorway, deps) {
  const out = [];
  for (const pg of pages || []) {
    out.push(canRecolor(pg) ? await recolorPage(pg, colorway, deps) : pg);
  }
  return out;
}

// The display name for a colourway: the design's name with the colour on it.
//
// Recolouring a recoloured mockup must not stack suffixes ("Tee · Black · Grey").
// The only suffix we strip blind is the "· v2" variation marker, which we know we
// wrote. For the previous COLOUR we require the caller to say what it was —
// `prevColorName` comes off the source's stored colourway — because guessing
// would eat a real part of a name like "Dispensary · Front Logo Tee".
export function colorwayName(sourceName, colorName, prevColorName) {
  let base = String(sourceName == null ? '' : sourceName).replace(/\s*·\s*v\d+\s*$/i, '').trim();
  const prev = String(prevColorName == null ? '' : prevColorName).trim();
  if (prev) {
    const tail = new RegExp(`\\s*·\\s*${prev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    base = base.replace(tail, '').trim();
  }
  const clean = base || 'Mockup';
  return colorName ? `${clean} · ${colorName}` : clean;
}
