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
