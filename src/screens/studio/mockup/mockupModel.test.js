// Mockup Lab v2 — data-core round-trip tests. The whole point of this module is
// that the v2 editor reads/writes the EXISTING StudioLibraryItem shape with zero
// migration, so these assert that a legacy item survives a full model round-trip
// byte-for-byte (composites, extraViews/extraBackViews alignment, carried fields).

import {
  pageFromState, pageToState, hydratePages,
  mockupFromLibraryItem, mockupToLibraryItem, emptyPage, SIDES,
} from './mockupModel';

const legacyItem = () => ({
  id: 5,
  remoteId: 'mock-abc',
  name: "Earl & Tom's",
  client: 'Earl and Toms',
  thumbnail: 'FRONT0', // p0 front composite (R2 in prod)
  data: 'BACK0',       // p0 back composite
  pageState: {
    mockupNum: '000150A', title: 'Grinder', notes: 'rush', projectNumber: '21',
    printCategory: 'tshirt', template: 2,
    printFront: { type: 'DTG', dims: '1.5"', loc: 'Left chest' },
    printBack: { type: '', dims: '', loc: '' },
    frontLogoPosSize: { x: 10, y: 20, w: 1.2, h: 1.2, angle: 15 },
    frontColors: ['#000000', '#4ade80'],
    frontBlankImg: {}, // a live handle — must never persist
  },
  pages: [
    { mockupNum: '000150A', title: 'Grinder', projectNumber: '21', printCategory: 'tshirt', template: 2,
      printFront: { type: 'DTG', dims: '1.5"', loc: 'Left chest' },
      frontLogoPosSize: { x: 10, y: 20, w: 1.2, h: 1.2, angle: 15 }, frontColors: ['#000000', '#4ade80'] },
    { title: 'Back sheet', printBack: { type: 'Screen', dims: '10"', loc: 'Full back' } },
  ],
  extraViews: ['FRONT1'],
  extraBackViews: ['BACK1'],
});

test('hydratePages: p0 composites fall back to thumbnail/data; pages 2+ pull from extraViews/back', () => {
  const pages = hydratePages(legacyItem());
  expect(pages[0].frontCompositeBase64).toBe('FRONT0');
  expect(pages[0].backCompositeBase64).toBe('BACK0');
  expect(pages[1].frontCompositeBase64).toBe('FRONT1');
  expect(pages[1].backCompositeBase64).toBe('BACK1');
  // a blank was backfilled from the composite so the page isn't empty on another device
  expect(pages[1].frontBlankBase64).toBe('FRONT1');
});

test('hydratePages: misaligned extra arrays are skipped, never grafted onto the wrong page', () => {
  const it = legacyItem();
  it.extraViews = ['F1', 'F2', 'F3']; // 3 vs 1 extra page → mismatch
  const pages = hydratePages(it);
  expect(pages[1].frontCompositeBase64).toBeFalsy(); // not grafted
});

test('pageFromState / pageToState: side/print/pos/colors + carried fields round-trip', () => {
  const ps = legacyItem().pageState;
  const page = pageFromState(ps);
  expect(page.category).toBe('tshirt');
  expect(page.template).toBe(2);
  expect(page.print.front).toEqual({ type: 'DTG', dims: '1.5"', loc: 'Left chest' });
  expect(page.sides.front.pos).toEqual({ x: 10, y: 20, w: 1.2, h: 1.2, angle: 15 });
  expect(page.sides.front.colors).toEqual(['#000000', '#4ade80']);

  const back = pageToState(page, ps);
  expect(back.mockupNum).toBe('000150A');      // carried
  expect(back.projectNumber).toBe('21');       // carried
  expect(back.notes).toBe('rush');             // carried
  expect(back.printCategory).toBe('tshirt');
  expect(back.frontLogoPosSize).toEqual({ x: 10, y: 20, w: 1.2, h: 1.2, angle: 15 });
  expect(back.frontColors).toEqual(['#000000', '#4ade80']);
  expect(back.frontBlankImg).toBeNull();       // live handle never persists
});

test('mockup round-trips through the model byte-compatible with the library format', () => {
  const item = legacyItem();
  const mockup = mockupFromLibraryItem(item);
  expect(mockup.mockupNum).toBe('000150A');
  expect(mockup.name).toBe("Earl & Tom's");
  expect(mockup.pages).toHaveLength(2);

  const out = mockupToLibraryItem(mockup, [item.pageState, item.pages[1]]);
  expect(out.thumbnail).toBe('FRONT0');
  expect(out.data).toBe('BACK0');
  expect(out.extraViews).toEqual(['FRONT1']);
  expect(out.extraBackViews).toEqual(['BACK1']);
  expect(out.pages).toHaveLength(2);
  expect(out.pageState.mockupNum).toBe('000150A');
  expect(out.pageState.projectNumber).toBe('21');
  expect(out.pageState.frontBlankImg).toBeNull();
  expect(out.name).toBe("Earl & Tom's");
  expect(out.remoteId).toBe('mock-abc');
});

test('extraBackViews stays index-aligned: a front-only page 2 keeps a placeholder', () => {
  // p0, p1 (front only, no back), p2 (has a back print)
  const item = {
    remoteId: 'x', name: 'multi', thumbnail: 'F0', data: 'B0',
    pageState: { mockupNum: '1A' },
    pages: [
      { mockupNum: '1A' },
      { frontCompositeBase64: 'F1' },                 // page 2 — front only
      { backCompositeBase64: 'B2' },                  // page 3 — has a back
    ],
    extraViews: ['F1', ''],       // page 3 front missing
    extraBackViews: ['', 'B2'],   // page 2 back missing, page 3 back present
  };
  const out = mockupToLibraryItem(mockupFromLibraryItem(item));
  // B2 must remain at index 1 (page 3), never shift onto page 2
  expect(out.extraBackViews[0]).toBe('');
  expect(out.extraBackViews[1]).toBe('B2');
});

test('p0 with only a blank (no composite yet) still emits thumbnail/data — legacy parity', () => {
  const item = {
    remoteId: 'y', name: 'blank-only',
    pageState: { mockupNum: '2A', frontBlankBase64: 'FBLANK', backBlankBase64: 'BBLANK' },
    pages: [{ mockupNum: '2A', frontBlankBase64: 'FBLANK', backBlankBase64: 'BBLANK' }],
  };
  const out = mockupToLibraryItem(mockupFromLibraryItem(item));
  expect(out.thumbnail).toBe('FBLANK'); // not null — matches the legacy save's blank fallback
  expect(out.data).toBe('BBLANK');
});

test('SIDES is front then back', () => {
  expect(SIDES).toEqual(['front', 'back']);
  expect(emptyPage().sides.front).toBeTruthy();
  expect(emptyPage().sides.back).toBeTruthy();
});
