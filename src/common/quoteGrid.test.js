// The shared design-grid detection — the builder and the client approval page
// both key off this, so its edges are client-facing money edges.
import { quoteRowKey, detectGridRows } from './quoteGrid';

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
