// Every image of one mockup, in reading order.
//
// The owner's confirmation preview, the client's approval page and the
// confirmation PDF all render this list and are required to agree image-for-
// image. MIRRORS website-backend/utils/__tests__/mockupViews.test.js — the two
// helpers must stay in step, so the cases do too.

import { mockupViewList, extraPageViews } from './mockupViews';

describe('mockupViewList', () => {
  it('reads a single-page mockup front then back', () => {
    expect(mockupViewList({ front: 'F', back: 'B' })).toEqual(['F', 'B']);
  });

  it('takes a raw library item too (thumbnail/data)', () => {
    expect(mockupViewList({ thumbnail: 'F', data: 'B' })).toEqual(['F', 'B']);
  });

  it('reads extra pages front, back, front, back — page by page', () => {
    expect(mockupViewList({
      front: 'F1', back: 'B1',
      extraViews: ['F2', 'F3'],
      extraBackViews: ['B2', 'B3'],
    })).toEqual(['F1', 'B1', 'F2', 'B2', 'F3', 'B3']);
  });

  it('drops EVERY back when showBack is off, not just page 1s', () => {
    // A confirmation item without showBack must not sneak an extra page's blank
    // garment back onto the client's document through the side door.
    expect(mockupViewList(
      { front: 'F1', back: 'B1', extraViews: ['F2'], extraBackViews: ['B2'] },
      { includeBack: false },
    )).toEqual(['F1', 'F2']);
  });

  it('never pairs misaligned arrays — fronts first, then the backs', () => {
    // extraViews is stored compacted and extraBackViews '' padded, so unequal
    // lengths mean we cannot know which back is whose. Pairing them would put
    // page 3's back under page 2's front.
    expect(mockupViewList({
      front: 'F1', back: 'B1',
      extraViews: ['F3'],           // page 2 had no front composite, dropped
      extraBackViews: ['', 'B3'],   // …but its slot survives here
    })).toEqual(['F1', 'B1', 'F3', 'B3']);
  });

  it('never renders an empty placeholder as a blank tile', () => {
    expect(mockupViewList({
      front: 'F1', back: '',
      extraViews: ['F2', 'F3'],
      extraBackViews: ['', 'B3'],
    })).toEqual(['F1', 'F2', 'F3', 'B3']);
  });

  it('leaves a legacy doc with no extraBackViews exactly as it was', () => {
    expect(mockupViewList({ front: 'F1', back: 'B1', extraViews: ['F2', 'F3'] }))
      .toEqual(['F1', 'B1', 'F2', 'F3']);
  });

  it('handles missing, null and empty input', () => {
    expect(mockupViewList(null)).toEqual([]);
    expect(mockupViewList({})).toEqual([]);
    expect(mockupViewList({ front: 'F', extraViews: null, extraBackViews: null })).toEqual(['F']);
  });
});

describe('extraPageViews', () => {
  it('keeps page order when a back is missing mid-run', () => {
    expect(extraPageViews(['F2', 'F3', 'F4'], ['B2', '', 'B4'], true))
      .toEqual(['F2', 'B2', 'F3', 'F4', 'B4']);
  });

  it('handles null inputs', () => {
    expect(extraPageViews(null, null, true)).toEqual([]);
    expect(extraPageViews(undefined, ['B2'], true)).toEqual(['B2']);
  });
});
