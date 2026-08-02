import { gallerySlotCount, setHeroUrl, setGalleryUrl } from './photoSlots';

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
