// src/webworks/photoSlots.js
// Pure helpers for editing a JP Webworks site's photo slots in the Studio.
//
// Split out of the Websites tab because the rule they encode is easy to get
// wrong and expensive when it is: the gallery is a GROWING list. Templates
// render however many gallery photos a site has — a sculptor's portfolio may
// want a dozen — so nothing here may rebuild the list at a fixed width. The
// original inline version did, and editing the hero silently deleted every
// photo past the third.
//
// Empty slots are kept here on purpose (they are the blank inputs the owner
// types into); mergePhotos() drops them on the way to the page.

const SLOT_MIN = 3;   // the form never looks emptier than the old fixed set
const SLOT_MAX = 30;  // a runaway guard, far above any real portfolio

const listOf = (photos) => {
  const p = photos && typeof photos === 'object' ? photos : {};
  return Array.isArray(p.gallery) ? p.gallery : [];
};

const heroOf = (photos) => {
  const p = photos && typeof photos === 'object' ? photos : {};
  return typeof p.hero === 'string' ? p.hero : '';
};

// Longest edge a site photo is stored at. Camera shots come off a phone at
// 4000px and several megabytes; nothing on these pages renders larger than a
// full-width band, so anything past this is bytes the visitor waits for.
export const MAX_PHOTO_EDGE = 2000;

// Scale a WxH down to fit MAX_PHOTO_EDGE, never up. Pure so the arithmetic is
// testable without a canvas.
export function fitWithin(width, height, maxEdge = MAX_PHOTO_EDGE) {
  const w = Number(width) > 0 ? Number(width) : 0;
  const h = Number(height) > 0 ? Number(height) : 0;
  if (!w || !h) return { width: 0, height: 0, scaled: false };
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: Math.round(w), height: Math.round(h), scaled: false };
  const k = maxEdge / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), scaled: true };
}

// How many gallery inputs to render: always one empty slot past the last one,
// so filling the last row makes another appear without an "add" button.
export function gallerySlotCount(photos) {
  return Math.min(Math.max(SLOT_MIN, listOf(photos).length + 1), SLOT_MAX);
}

// Change the hero URL. The gallery passes through UNTOUCHED — this is the
// exact spot the data-loss bug lived.
export function setHeroUrl(photos, url) {
  return { hero: typeof url === 'string' ? url : '', gallery: [...listOf(photos)] };
}

// Change one gallery slot, extending the list if the owner typed into the
// trailing empty input.
export function setGalleryUrl(photos, index, url) {
  const gallery = [...listOf(photos)];
  if (!Number.isInteger(index) || index < 0 || index >= SLOT_MAX) {
    return { hero: heroOf(photos), gallery };
  }
  while (gallery.length <= index) gallery.push('');
  gallery[index] = typeof url === 'string' ? url : '';
  return { hero: heroOf(photos), gallery };
}
