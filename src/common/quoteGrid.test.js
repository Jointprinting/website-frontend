// The shared design-grid detection — the builder and the client approval page
// both key off this, so its edges are client-facing money edges.
import { quoteRowKey, detectGridRows, isColourSet, groupPickMode, groupPickModes, designKey } from './quoteGrid';

const line = (over = {}) => ({ styleCode: 'G5000', description: 'Gildan 5000', printDetails: '', color: '', qty: 50, ...over });

describe('quoteRowKey', () => {
  it('trims and lowercases every part — a trailing space is not a new row', () => {
    expect(quoteRowKey(line({ description: 'Gildan 5000 ' }))).toBe(quoteRowKey(line()));
    expect(quoteRowKey(line({ styleCode: ' g5000' }))).toBe(quoteRowKey(line()));
  });
  it('printDetails and color are identity — variants and colors are distinct rows', () => {
    expect(quoteRowKey(line({ printDetails: '6c front' }))).not.toBe(quoteRowKey(line({ printDetails: '7c front' })));
    expect(quoteRowKey(line({ color: 'black' }))).not.toBe(quoteRowKey(line({ color: 'white' })));
  });
});

describe('detectGridRows', () => {
  it('detects a clean 2-row × 2-qty matrix and sorts cells by qty', () => {
    const g = detectGridRows([
      line({ qty: 100 }), line({ qty: 50 }),
      line({ description: 'Bella 3001', qty: 50 }), line({ description: 'Bella 3001', qty: 100 }),
    ]);
    expect(g.qtys).toEqual([50, 100]);
    expect(g.rows).toHaveLength(2);
    expect(g.rows[0].map((l) => l.qty)).toEqual([50, 100]);
  });
  it('a print-variant pitch (same garment, different printDetails) is two rows', () => {
    const g = detectGridRows([
      line({ printDetails: '6c front', qty: 50 }), line({ printDetails: '6c front', qty: 100 }),
      line({ printDetails: '7c front', qty: 50 }), line({ printDetails: '7c front', qty: 100 }),
    ]);
    expect(g.rows).toHaveLength(2);
  });
  it('rejects incomplete matrices, duplicate cells, single quantities, and unnamed rows', () => {
    expect(detectGridRows([line({ qty: 50 }), line({ qty: 100 }), line({ description: 'Bella', qty: 50 })])).toBeNull();
    expect(detectGridRows([line({ qty: 50 }), line({ qty: 50 })])).toBeNull();
    expect(detectGridRows([line({ qty: 50 }), line({ description: 'Bella', qty: 50 })])).toBeNull();
    expect(detectGridRows([
      { qty: 50 }, { qty: 100 },   // no identity at all
    ])).toBeNull();
    expect(detectGridRows([line({ qty: 0 }), line({ qty: 100 })])).toBeNull();
  });
  it('a single row across two quantities is still a grid (the smallest useful one)', () => {
    expect(detectGridRows([line({ qty: 50 }), line({ qty: 100 })])).not.toBeNull();
  });
});

// ── Pick mode ────────────────────────────────────────────────────────────────
//
// SYNC GUARD: this block mirrors website-backend/utils/__tests__/quoteGroups.test.js
// case for case. The server enforces the same rule in publicSelectOptions, so a
// divergence would offer the client a choice the API rejects (or cap a colourway
// set the owner opened up). Change one side → change both, or a suite goes red.
describe('groupPickMode', () => {
  // The order that prompted this: one design, two garment colours, 50 of each.
  const BLACK = { group: 'T-Shirts', styleCode: 'G500', description: 'Heavy Cotton Tee', printDetails: '1c front', color: 'Black', qty: 50 };
  const WHITE = { ...BLACK, color: 'White' };

  it('two colourways of one design are an any_of group', () => {
    expect(isColourSet([BLACK, WHITE])).toBe(true);
    expect(groupPickMode([BLACK, WHITE])).toBe('any_of');
  });
  it('the same colour twice is a quantity matrix, not a colour set', () => {
    expect(groupPickMode([BLACK, { ...BLACK, qty: 100 }])).toBe('one_of');
  });
  it('different brands stay alternatives even when each names a colour', () => {
    const gildan = { ...BLACK, styleCode: 'G500', description: 'Gildan Heavy Cotton' };
    const bella  = { ...BLACK, styleCode: '3001', description: 'Bella Jersey Tee', color: 'White' };
    expect(groupPickMode([gildan, bella])).toBe('one_of');
  });
  it('a differing print spec is a real alternative, not a colourway', () => {
    expect(groupPickMode([
      { ...BLACK, printDetails: '1c front' },
      { ...BLACK, printDetails: '3c front', color: 'White' },
    ])).toBe('one_of');
  });
  it('an unnamed colour never derives any_of — we must not guess', () => {
    expect(groupPickMode([{ ...BLACK, color: '' }, WHITE])).toBe('one_of');
  });
  it('a single line is never a colour set', () => {
    expect(groupPickMode([BLACK])).toBe('one_of');
  });
  it('colour comparison ignores case and padding', () => {
    expect(isColourSet([{ ...BLACK, color: ' black ' }, { ...WHITE, color: 'WHITE' }])).toBe(true);
    expect(isColourSet([{ ...BLACK, color: 'Black' }, { ...BLACK, color: ' BLACK ' }])).toBe(false);
  });
  it('an owner pin overrides the derivation in both directions', () => {
    expect(groupPickMode([{ ...BLACK, groupMode: 'one_of' }, WHITE])).toBe('one_of');
    expect(groupPickMode([
      { group: 'Extras', description: 'Stickers', qty: 100 },
      { group: 'Extras', description: 'Koozies', qty: 100, groupMode: 'any_of' },
    ])).toBe('any_of');
  });
  it('a pin on any line of the group counts', () => {
    expect(groupPickMode([{ ...BLACK }, { ...WHITE, groupMode: 'one_of' }])).toBe('one_of');
  });
  it('an unrecognized mode string falls back to the derivation', () => {
    expect(groupPickMode([{ ...BLACK, groupMode: 'whatever' }, WHITE])).toBe('any_of');
  });
  it('groupPickModes maps a whole quote and skips standalone lines', () => {
    const hats = { group: 'Hats', styleCode: 'C112', description: 'Trucker', color: 'Black', qty: 50 };
    const alt  = { ...hats, styleCode: 'RC104', description: 'Richardson 112' };
    expect(groupPickModes([BLACK, WHITE, hats, alt, { group: '', description: 'Setup', qty: 1 }]))
      .toEqual({ 'T-Shirts': 'any_of', Hats: 'one_of' });
  });
  it('designKey ignores colour so colourways collapse to one design', () => {
    expect(designKey(BLACK)).toBe(designKey(WHITE));
    expect(designKey(BLACK)).not.toBe(designKey({ ...BLACK, styleCode: '3001' }));
  });
  it('empty / junk input is safe', () => {
    expect(groupPickMode([])).toBe('one_of');
    expect(groupPickMode(null)).toBe('one_of');
    expect(isColourSet(null)).toBe(false);
    expect(groupPickModes(null)).toEqual({});
  });
});
