import { gallerySlotCount, setHeroUrl, setGalleryUrl, fitWithin, MAX_PHOTO_EDGE } from './photoSlots';

describe('photo sizing', () => {
  test('a camera shot is scaled down to the long edge', () => {
    // A phone portrait: 3024x4032 → the 4032 side becomes MAX_PHOTO_EDGE.
    const fit = fitWithin(3024, 4032);
    expect(fit.scaled).toBe(true);
    expect(Math.max(fit.width, fit.height)).toBe(MAX_PHOTO_EDGE);
    // Aspect ratio survives, or the sculpture arrives distorted.
    expect(fit.width / fit.height).toBeCloseTo(3024 / 4032, 3);
  });

  test('landscape and portrait are both handled by the long edge', () => {
    expect(fitWithin(4032, 3024).width).toBe(MAX_PHOTO_EDGE);
    expect(fitWithin(3024, 4032).height).toBe(MAX_PHOTO_EDGE);
  });

  test('an already-small photo is left alone, never upscaled', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600, scaled: false });
    expect(fitWithin(MAX_PHOTO_EDGE, MAX_PHOTO_EDGE).scaled).toBe(false);
  });

  test('junk dimensions report nothing to do rather than throwing', () => {
    for (const bad of [[0, 0], [NaN, 100], [-5, 10], [undefined, undefined]]) {
      expect(fitWithin(bad[0], bad[1])).toEqual({ width: 0, height: 0, scaled: false });
    }
  });
});

describe('photo slots', () => {
  test('always trails one empty slot, never fewer than three', () => {
    expect(gallerySlotCount(undefined)).toBe(3);
    expect(gallerySlotCount({ gallery: [] })).toBe(3);
    expect(gallerySlotCount({ gallery: ['a', 'b'] })).toBe(3);
    expect(gallerySlotCount({ gallery: ['a', 'b', 'c'] })).toBe(4);
    expect(gallerySlotCount({ gallery: Array(12).fill('x') })).toBe(13);
  });

  test('the slot count is capped so bad data cannot render endless inputs', () => {
    expect(gallerySlotCount({ gallery: Array(500).fill('x') })).toBe(30);
  });

  test('editing the hero keeps every gallery photo', () => {
    // The regression: this used to rebuild the gallery at a fixed width of 3,
    // so photos 4+ vanished the moment the hero was touched.
    const photos = { hero: 'old.jpg', gallery: ['1', '2', '3', '4', '5'] };
    const next = setHeroUrl(photos, 'new.jpg');
    expect(next.hero).toBe('new.jpg');
    expect(next.gallery).toEqual(['1', '2', '3', '4', '5']);
  });

  test('editing a gallery slot keeps the hero and the other photos', () => {
    const photos = { hero: 'h.jpg', gallery: ['1', '2', '3', '4'] };
    const next = setGalleryUrl(photos, 2, 'three.jpg');
    expect(next.hero).toBe('h.jpg');
    expect(next.gallery).toEqual(['1', '2', 'three.jpg', '4']);
  });

  test('typing into the trailing empty slot extends the list', () => {
    const next = setGalleryUrl({ hero: '', gallery: ['1'] }, 1, '2');
    expect(next.gallery).toEqual(['1', '2']);
    // and a gap is filled with empties, not undefined holes
    const gapped = setGalleryUrl({ hero: '', gallery: ['1'] }, 3, '4');
    expect(gapped.gallery).toEqual(['1', '', '', '4']);
  });

  test('clearing a slot blanks it without collapsing the list', () => {
    const next = setGalleryUrl({ hero: '', gallery: ['1', '2', '3'] }, 1, '');
    expect(next.gallery).toEqual(['1', '', '3']);
  });

  test('survives junk input instead of throwing at the owner', () => {
    expect(setHeroUrl(null, 'x')).toEqual({ hero: 'x', gallery: [] });
    expect(setHeroUrl({ gallery: 'nope' }, 'x').gallery).toEqual([]);
    expect(setGalleryUrl({ gallery: ['a'] }, -1, 'x').gallery).toEqual(['a']);
    expect(setGalleryUrl({ gallery: ['a'] }, 999, 'x').gallery).toEqual(['a']);
  });
});
