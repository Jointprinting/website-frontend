// src/common/mockupViews.js
//
// Every image of ONE mockup, in reading order, for a client-facing surface.
//
// A mockup spreads its views across four fields:
//
//   thumbnail       page 1 front
//   data / back     page 1 back
//   extraViews      pages 2+ FRONTS   (compacted — see the alignment note)
//   extraBackViews  pages 2+ BACKS    (index-aligned to pages[1..], '' padded)
//
// Three surfaces render that set — the owner's confirmation builder preview, the
// public approval page, and the confirmation PDF — and they are required to
// agree image-for-image (invariant H1). They each rebuilt the list inline, and
// every one of them stopped at extraViews: the back of page 2+ has been
// persisted since the page-2-back fix and had never once been shown to a client.
//
// ── The alignment rule ───────────────────────────────────────────────────────
// `extraViews` is written with `.filter(Boolean)` (an extra page with no front
// composite is dropped), while `extraBackViews` keeps its slot with an ''
// placeholder. So the two line up ONLY when nothing was dropped, which is
// exactly when their lengths match. Pairing them any other time would show one
// page's back under another page's front.
//
// So: equal lengths → interleave front/back per page. Otherwise → fronts first,
// then whatever backs exist, unpaired. Nothing is invented and nothing is lost.
//
// Lives in common/ because the public approval screen and the Studio's builder
// both need it, and the marketing site and the Studio are kept separate.
// MIRRORS website-backend/utils/mockupViews.js — keep the two in step.

const list = (v) => (Array.isArray(v) ? v : []);

// The extra pages' images in reading order, honouring the alignment rule above.
export function extraPageViews(extraViews, extraBackViews, includeBack) {
  const fronts = list(extraViews);
  const backs = includeBack ? list(extraBackViews) : [];
  if (!backs.length) return fronts.filter(Boolean);
  if (backs.length !== fronts.length) {
    // Can't know which back belongs to which page — show them all, unpaired,
    // rather than pairing them wrongly.
    return [...fronts.filter(Boolean), ...backs.filter(Boolean)];
  }
  const out = [];
  fronts.forEach((f, i) => {
    if (f) out.push(f);
    if (backs[i]) out.push(backs[i]);
  });
  return out;
}

// Every view of one mockup, front-then-back, page by page.
//
// `mockup` takes either shape the surfaces already carry:
//   { front, back, extraViews, extraBackViews }   (a resolver entry)
//   { thumbnail, data, ... }                      (a raw library item)
//
// `includeBack` gates the BACKS — page 1's and every extra page's alike. A
// confirmation item's `showBack` opt-in drives it: a plain garment back is noise
// on a client document unless the owner said it matters. A surface with no such
// toggle (the pre-confirmation gallery, where the client is reviewing the
// designs themselves) passes true and sees everything.
export function mockupViewList(mockup, opts) {
  const m = mockup || {};
  const includeBack = !opts || opts.includeBack !== false;
  const front = m.front != null ? m.front : m.thumbnail;
  const back = m.back != null ? m.back : m.data;
  return [
    front,
    includeBack ? back : null,
    ...extraPageViews(m.extraViews, m.extraBackViews, includeBack),
  ].filter(Boolean);
}
