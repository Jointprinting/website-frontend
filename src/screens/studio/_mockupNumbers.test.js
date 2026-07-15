// src/screens/studio/_mockupNumbers.test.js
// Client mirror of the mockup-numbering engine — parity with the backend util
// plus the Studio display/grouping helpers.

import {
  letterToNum, numToLetter, parseMockupNum, formatMockupNum,
  mockupBadge, mockupSortKey, sortMockupTiles, groupMockupTiles,
} from './_mockupNumbers';

describe('numbering parity with the backend', () => {
  test('letter ↔ num bijective base-26 (incl. overflow past Z)', () => {
    const cases = [[1, 'A'], [26, 'Z'], [27, 'AA'], [28, 'AB'], [702, 'ZZ'], [703, 'AAA']];
    for (const [n, s] of cases) {
      expect(numToLetter(n)).toBe(s);
      expect(letterToNum(s)).toBe(n);
    }
  });

  test('parseMockupNum splits base / colour / edit-version', () => {
    expect(parseMockupNum('#000150A')).toEqual({ base: '#000150', digits: '000150', letter: 'A', letterNum: 1, version: 1 });
    expect(parseMockupNum('#000150A2')).toEqual({ base: '#000150', digits: '000150', letter: 'A', letterNum: 1, version: 2 });
    expect(parseMockupNum('#000150AA')).toEqual({ base: '#000150', digits: '000150', letter: 'AA', letterNum: 27, version: 1 });
    expect(parseMockupNum('promo')).toBeNull();
  });

  test('formatMockupNum omits v1, adds from v2', () => {
    expect(formatMockupNum('#000150', 'A', 1)).toBe('#000150A');
    expect(formatMockupNum('#000150', 'A', 2)).toBe('#000150A2');
  });
});

describe('display helpers', () => {
  test('mockupBadge — colour letter, ·v for edits, empty for junk', () => {
    expect(mockupBadge('#000150A')).toBe('A');
    expect(mockupBadge('#000150A2')).toBe('A·v2');
    expect(mockupBadge('#000150AA')).toBe('AA');
    expect(mockupBadge('promo-shot')).toBe('');
  });

  test('sortMockupTiles orders design → colour → version; junk sorts last', () => {
    const nums = ['#000150B', '#000150A2', 'promo', '#000150A', '#000149Z'];
    expect(sortMockupTiles(nums)).toEqual(['#000149Z', '#000150A', '#000150A2', '#000150B', 'promo']);
  });

  test('sortMockupTiles works on tile objects via getNum', () => {
    const tiles = [{ num: '#000150B' }, { num: '#000150A' }];
    expect(sortMockupTiles(tiles, (t) => t.num).map((t) => t.num)).toEqual(['#000150A', '#000150B']);
  });

  test('groupMockupTiles nests designs → colours → versions, junk in other', () => {
    const nums = ['#000150A', '#000150A2', '#000150B', '#000151A', 'promo'];
    const { designs, other } = groupMockupTiles(nums);
    expect(designs.map((d) => d.base)).toEqual(['#000150', '#000151']);
    const d150 = designs[0];
    expect(d150.colors.map((c) => c.letter)).toEqual(['A', 'B']);
    expect(d150.colors[0].versions).toEqual(['#000150A', '#000150A2']); // colour A: original + edit, in order
    expect(other).toEqual(['promo']);
  });
});
