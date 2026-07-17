// src/screens/studio/mockup/mockupModel.js
//
// Mockup Lab v2 — the migration-safe data core.
//
// The legacy editor (public/jpstudio/index.html) stores a mockup as a flat
// `pageState` blob with parallel front*/back* fields per page, plus a `pages[]`
// array and R2-offloaded composites (thumbnail = p0 front, data = p0 back,
// extraViews = pages 2+ fronts, extraBackViews = pages 2+ backs). That on-disk
// shape is the contract every other surface reads (Confirmation, Quoter, Lookbook,
// the CRM design library, the PDF export) and MUST keep loading unchanged.
//
// This module is the clean `page × side` model the v2 React editor works in, plus
// the adapters that convert to/from the EXISTING StudioLibraryItem shape with zero
// migration. Nothing here touches the DOM or a canvas — it's pure, so it's fully
// unit-tested. The editor (later phases) sits on top of this; the storage format
// underneath never changes.

export const SIDES = ['front', 'back'];

// One placement: drag position (x,y), size (w,h = fabric scaleX/scaleY), rotation.
export function emptyPos() {
  return { x: null, y: null, w: null, h: null, angle: 0 };
}

// One side of one page: the garment blank, the artwork, the flattened composite,
// where the art sits, and the detected ink colors.
export function emptySide() {
  return { blank: null, logo: null, composite: null, pos: emptyPos(), colors: [] };
}

// One page of a mockup — both sides, plus the print spec + placement category the
// legacy tool keeps per page.
export function emptyPage() {
  return {
    category: 'generic',
    template: 1,
    print: { front: { type: '', dims: '', loc: '' }, back: { type: '', dims: '', loc: '' } },
    sides: { front: emptySide(), back: emptySide() },
    // Free-form legacy fields carried verbatim so a round-trip never drops them.
    _extra: {},
  };
}

const str = (v) => (v == null ? '' : String(v));
const clonePos = (p) => ({
  x: p && p.x != null ? p.x : null,
  y: p && p.y != null ? p.y : null,
  w: p && p.w != null ? p.w : null,
  h: p && p.h != null ? p.h : null,
  angle: p && p.angle != null ? p.angle : 0,
});
const clonePrint = (p) => ({ type: str(p && p.type), dims: str(p && p.dims), loc: str(p && p.loc) });

// The per-page fields the legacy pageState carries that aren't part of the
// side/print model — kept on `_extra` so pageToState can restore them byte-for-byte.
const CARRIED = ['title', 'subtitle', 'mockupNum', 'pdfName', 'notes', 'client', 'projectId', 'projectNumber',
  '_savedRemoteId', '_savedDbId'];

// ── page ⇄ pageState ─────────────────────────────────────────────────────────

// A legacy `pageState` object → a clean Page. Composites/blanks may already be
// hydrated by the caller (mockupFromLibraryItem does the R2/extraViews hydration).
export function pageFromState(ps) {
  const p = ps || {};
  const page = emptyPage();
  page.category = str(p.printCategory) || 'generic';
  page.template = p.template != null ? p.template : 1;
  page.print.front = clonePrint(p.printFront);
  page.print.back = clonePrint(p.printBack);
  page.sides.front = {
    blank: p.frontBlankBase64 || null,
    logo: p.frontLogoBase64 || null,
    composite: p.frontCompositeBase64 || null,
    pos: clonePos(p.frontLogoPosSize),
    colors: Array.isArray(p.frontColors) ? p.frontColors.slice() : [],
  };
  page.sides.back = {
    blank: p.backBlankBase64 || null,
    logo: p.backLogoBase64 || null,
    composite: p.backCompositeBase64 || null,
    pos: clonePos(p.backLogoPosSize),
    colors: Array.isArray(p.backColors) ? p.backColors.slice() : [],
  };
  const extra = {};
  for (const k of CARRIED) if (k in p) extra[k] = p[k];
  page.sides.front._img = { blank: p.frontBlankImg || null, logo: p.frontLogoImg || null };
  page.sides.back._img = { blank: p.backBlankImg || null, logo: p.backLogoImg || null };
  page._extra = extra;
  return page;
}

// A clean Page → a legacy `pageState`, re-emitting the exact flat shape the rest of
// the app + the PDF export read. `prevPs` (the page's original state, if any) is
// spread first so any field this model doesn't track survives untouched.
export function pageToState(page, prevPs) {
  const pg = page || emptyPage();
  const f = pg.sides.front || emptySide();
  const b = pg.sides.back || emptySide();
  return {
    ...(prevPs || {}),
    ...(pg._extra || {}),
    printCategory: pg.category || 'generic',
    template: pg.template != null ? pg.template : 1,
    printFront: clonePrint(pg.print && pg.print.front),
    printBack: clonePrint(pg.print && pg.print.back),
    frontBlankBase64: f.blank || null,
    backBlankBase64: b.blank || null,
    frontLogoBase64: f.logo || null,
    backLogoBase64: b.logo || null,
    frontCompositeBase64: f.composite || null,
    backCompositeBase64: b.composite || null,
    frontLogoPosSize: clonePos(f.pos),
    backLogoPosSize: clonePos(b.pos),
    frontColors: Array.isArray(f.colors) ? f.colors.slice() : [],
    backColors: Array.isArray(b.colors) ? b.colors.slice() : [],
    // Live fabric.Image handles are never persisted (stripLayers nulls them); keep
    // that invariant so a re-save matches the legacy tool byte-for-byte.
    frontBlankImg: null, backBlankImg: null, frontLogoImg: null, backLogoImg: null,
  };
}

// ── StudioLibraryItem ⇄ Mockup ───────────────────────────────────────────────

// Hydrate the pages[] array from a library item exactly the way the legacy editor
// does on load: page 0's composites fall back to thumbnail/data, and pages 2+ pull
// their front/back composites from extraViews/extraBackViews when they line up 1:1
// (the length guard is the same one that prevents grafting the wrong image onto a
// page). Pure — returns an array of hydrated pageState objects.
export function hydratePages(item) {
  const it = item || {};
  const p0 = it.pageState ? { ...it.pageState } : (Array.isArray(it.pages) && it.pages[0] ? { ...it.pages[0] } : {});
  if (!p0.frontCompositeBase64 && it.thumbnail) p0.frontCompositeBase64 = it.thumbnail;
  if (!p0.backCompositeBase64 && it.data) p0.backCompositeBase64 = it.data;
  // Parity with the legacy sync-merge (index.html): backfill the blank from the
  // composite too, so a cross-device page 0 isn't a bare canvas.
  if (!p0.frontBlankBase64 && p0.frontCompositeBase64) p0.frontBlankBase64 = p0.frontCompositeBase64;
  if (!p0.backBlankBase64 && p0.backCompositeBase64) p0.backBlankBase64 = p0.backCompositeBase64;

  const rawPages = Array.isArray(it.pages) && it.pages.length ? it.pages : [it.pageState || p0];
  const rest = rawPages.slice(1);
  const extra = Array.isArray(it.extraViews) ? it.extraViews : [];
  const backExtra = Array.isArray(it.extraBackViews) ? it.extraBackViews : [];
  const fAligned = extra.length === rest.length;
  const bAligned = backExtra.length === rest.length;

  const hydratedRest = rest.map((raw, i) => {
    const pg = raw ? { ...raw } : {};
    if (fAligned && !pg.frontCompositeBase64 && extra[i]) {
      pg.frontCompositeBase64 = extra[i];
      if (!pg.frontBlankBase64) pg.frontBlankBase64 = extra[i];
    }
    if (bAligned && !pg.backCompositeBase64 && backExtra[i]) {
      pg.backCompositeBase64 = backExtra[i];
      if (!pg.backBlankBase64) pg.backBlankBase64 = backExtra[i];
    }
    return pg;
  });
  return [p0, ...hydratedRest];
}

// A StudioLibraryItem (as returned by /api/studio/library) → a v2 Mockup.
export function mockupFromLibraryItem(item) {
  const it = item || {};
  const pages = hydratePages(it).map(pageFromState);
  const p0 = it.pageState || {};
  return {
    id: it.id != null ? it.id : null,
    remoteId: str(it.remoteId),
    mockupNum: str(p0.mockupNum),
    name: str(it.name || p0.title),
    client: str(it.client || p0.client),
    projectNumber: str(p0.projectNumber),
    pages: pages.length ? pages : [emptyPage()],
  };
}

// A v2 Mockup → a StudioLibraryItem body ready to POST to /api/studio/library/mockups.
// Emits the SAME field set the legacy save does (thumbnail = p0 front, data = p0 back,
// extraViews = pages 2+ fronts [filtered, as today], extraBackViews = pages 2+ backs
// [index-aligned with '' placeholders, per the page-2-back fix]). Zero migration.
export function mockupToLibraryItem(mockup, prevPageStates) {
  const m = mockup || {};
  const prev = Array.isArray(prevPageStates) ? prevPageStates : [];
  const pageStates = (m.pages || []).map((pg, i) => pageToState(pg, prev[i]));
  const p0 = pageStates[0] || {};
  const rest = pageStates.slice(1);
  return {
    name: str(m.name),
    client: str(m.client),
    pageState: p0,
    pages: pageStates.length > 1 ? pageStates : null,
    // Match the legacy save exactly: fall back to the blank when no composite has
    // been flattened yet, so p0's front/back still carry an image cross-device.
    thumbnail: p0.frontCompositeBase64 || p0.frontBlankBase64 || null,
    data: p0.backCompositeBase64 || p0.backBlankBase64 || null,
    extraViews: rest.map((p) => p.frontCompositeBase64 || p.frontBlankBase64 || null).filter(Boolean),
    extraBackViews: rest.map((p) => p.backCompositeBase64 || p.backBlankBase64 || ''),
    remoteId: str(m.remoteId) || undefined,
  };
}

// The best single preview image for a side (composite first, then the bare blank).
export function sidePreview(side) {
  const s = side || {};
  return s.composite || s.blank || null;
}
