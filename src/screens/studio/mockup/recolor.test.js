// A colour variation must keep the design EXACTLY where it was. The placement
// remap is the whole reason this isn't a one-line blank swap.
import { canRecolor, whyNotRecolor, recolorPage, recolorPages, colorwayName } from './recolor';
import { emptyPage } from './mockupModel';

// Stand-in image loader: the src encodes its own dimensions, so a test can say
// "the new garment photo is a different aspect" without any real decoding.
const loadImg = async (src) => {
  const m = String(src || '').match(/(\d+)x(\d+)/);
  return m ? { naturalWidth: Number(m[1]), naturalHeight: Number(m[2]) } : null;
};
const flatten = async (blank, logo, pos) => `flat(${blank}|${logo}|${pos.x},${pos.y})`;
const deps = { loadImg, flatten };

const pageWithArt = () => {
  const p = emptyPage();
  p.sides.front = { blank: 'black-1000x1000.jpg', logo: 'art.png', composite: 'old-front.png',
    pos: { x: 260, y: 180, w: 100, h: 50, angle: 0 }, colors: [] };
  p.sides.back = { blank: 'black-back-1000x1000.jpg', logo: 'art-back.png', composite: 'old-back.png',
    pos: { x: 260, y: 200, w: 100, h: 50, angle: 0 }, colors: [] };
  return p;
};
const GREY = { front: 'grey-1000x1000.jpg', back: 'grey-back-1000x1000.jpg', color: 'Sport Grey' };

it('swaps the garment and keeps the artwork and its placement', async () => {
  const out = await recolorPage(pageWithArt(), GREY, deps);
  expect(out.sides.front.blank).toBe('grey-1000x1000.jpg');
  expect(out.sides.front.logo).toBe('art.png');        // the design is untouched
  expect(out.sides.front.pos).toEqual({ x: 260, y: 180, w: 100, h: 50, angle: 0 }); // same-size photo → no shift
  expect(out.sides.back.blank).toBe('grey-back-1000x1000.jpg');
  expect(out.sides.back.logo).toBe('art-back.png');
});

it('re-flattens, so the tile shows the NEW colour and never the old composite', async () => {
  const out = await recolorPage(pageWithArt(), GREY, deps);
  expect(out.sides.front.composite).toBe('flat(grey-1000x1000.jpg|art.png|260,180)');
  expect(out.sides.front.composite).not.toBe('old-front.png');
});

it('re-anchors the print when the new garment photo is a different shape', async () => {
  // The same stage coordinates would land somewhere else on a differently-sized
  // photo — this is the shift remapPlacement exists to prevent.
  const out = await recolorPage(pageWithArt(), { front: 'grey-500x1000.jpg' }, deps);
  expect(out.sides.front.pos).not.toEqual({ x: 260, y: 180, w: 100, h: 50, angle: 0 });
  expect(out.sides.front.blank).toBe('grey-500x1000.jpg');
});

it('a side with no new photo keeps the garment it had', async () => {
  // S&S sometimes has a front and no back; blanking the back would destroy a
  // side of the proof for nothing.
  const out = await recolorPage(pageWithArt(), { front: 'grey-1000x1000.jpg' }, deps);
  expect(out.sides.back.blank).toBe('black-back-1000x1000.jpg');
  expect(out.sides.back.composite).toBe('old-back.png');
});

it('never mutates the source — the original proof may already be approved', async () => {
  const src = pageWithArt();
  await recolorPage(src, GREY, deps);
  expect(src.sides.front.blank).toBe('black-1000x1000.jpg');
  expect(src.sides.front.composite).toBe('old-front.png');
});

it('recolours EVERY page, not just the one on screen', async () => {
  const out = await recolorPages([pageWithArt(), pageWithArt()], GREY, deps);
  expect(out).toHaveLength(2);
  expect(out.every(p => p.sides.front.blank === 'grey-1000x1000.jpg')).toBe(true);
});

it('refuses a flattened-only mockup instead of destroying the design', async () => {
  // Art burned into the garment photo: swapping the blank replaces the picture.
  const flat = emptyPage();
  flat.sides.front = { blank: 'composite.png', logo: null, composite: 'composite.png', pos: { x: 1, y: 1 }, colors: [] };
  expect(canRecolor(flat)).toBe(false);
  expect(whyNotRecolor(flat)).toMatch(/only has the flattened image/);
  // …and a mixed file carries the un-recolourable page over untouched.
  const out = await recolorPages([pageWithArt(), flat], GREY, deps);
  expect(out[0].sides.front.blank).toBe('grey-1000x1000.jpg');
  expect(out[1].sides.front.blank).toBe('composite.png');
});

it('a page whose logo IS the blank is not recolourable', async () => {
  const p = emptyPage();
  p.sides.front = { blank: 'x.png', logo: 'x.png', composite: null, pos: { x: 1 }, colors: [] };
  expect(canRecolor(p)).toBe(false);
});

it('one side with real art is enough', () => {
  const p = emptyPage();
  p.sides.back = { blank: 'b-1000x1000.jpg', logo: 'art.png', composite: null, pos: { x: 1 }, colors: [] };
  expect(canRecolor(p)).toBe(true);
});

it('names the variation by its colour, without stacking suffixes', () => {
  expect(colorwayName('Staff Tee', 'Black')).toBe('Staff Tee · Black');
  expect(colorwayName('Staff Tee · v2', 'Grey')).toBe('Staff Tee · Grey');
  // Recolouring a recoloured mockup: the caller says what the old colour was.
  expect(colorwayName('Staff Tee · Black', 'Grey', 'Black')).toBe('Staff Tee · Grey');
  expect(colorwayName('Staff Tee · black', 'Grey', 'BLACK')).toBe('Staff Tee · Grey');
  expect(colorwayName('', 'Grey')).toBe('Mockup · Grey');
  expect(colorwayName('Staff Tee', '')).toBe('Staff Tee');
});

it('never eats a real part of a name it was not told about', () => {
  // Without a known previous colour, "· Front Logo Tee" is part of the design's
  // name and must survive — guessing here is how a name gets quietly truncated.
  expect(colorwayName('Dispensary · Front Logo Tee', 'Grey')).toBe('Dispensary · Front Logo Tee · Grey');
  expect(colorwayName('Dispensary · Front Logo Tee', 'Grey', 'Black')).toBe('Dispensary · Front Logo Tee · Grey');
});

it('junk never throws', () => {
  expect(canRecolor(null)).toBe(false);
  expect(canRecolor({})).toBe(false);
  expect(whyNotRecolor(null)).toMatch(/no pages/);
});
