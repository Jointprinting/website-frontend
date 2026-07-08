// src/webworks/templates/_kit.js
// Tiny shared toolbox for the JP Webworks site templates. Every template is a
// self-contained one-pager (scoped <style> tag, its own Google Fonts, its own
// layout rhythm) — this file only holds the boring plumbing they all share so
// none of it gets re-invented five times:
//
//   useGoogleFonts(query)  — inject a Google Fonts <link> once per family set
//   resolvePalette(ps, id) — palette lookup with a safe first-palette fallback
//   initialsOf(name)       — 1–2 letter mark for the no-photo "logo" plate
//   telHref(phone)         — tel: link from a human-formatted phone string
//   txt(v) / rows(arr,…k)  — trim-to-string + "keep only rows with content"
//   mergePhotos(p, defs)   — owner photo URLs over the template's curated set
//   Ph / PH_CSS            — the fail-safe <img> stack (crafted tile under it)
//
// Templates NEVER render an empty shell: they pass their data through txt()/
// rows() and drop any section that comes back empty.
//
// PHOTOS are fail-safe by construction. Every template ships a curated
// default photo set (Unsplash CDN URLs) so a brand-new site looks finished,
// and every photo renders as a STACK: a crafted palette scene (gradient +
// SVG texture) sits under the real <img>/background layer, so the page still
// looks designed while a photo loads — or if it never does.

import * as React from 'react';

// Inject a Google Fonts stylesheet exactly once per family query. The <link>
// is left in <head> after unmount on purpose — fonts are cached, and removing
// the sheet would flash-unstyle the Studio's live preview every time the
// owner flips between templates.
export function useGoogleFonts(query) {
  React.useEffect(() => {
    if (!query) return;
    try {
      // Preconnects (once, shared by every template).
      if (!document.querySelector('link[data-jpw-preconnect]')) {
        [['https://fonts.googleapis.com', false], ['https://fonts.gstatic.com', true]].forEach(([href, cors]) => {
          const l = document.createElement('link');
          l.rel = 'preconnect'; l.href = href;
          if (cors) l.crossOrigin = 'anonymous';
          l.setAttribute('data-jpw-preconnect', '1');
          document.head.appendChild(l);
        });
      }
      if (document.querySelector(`link[data-jpw-font="${query}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
      link.setAttribute('data-jpw-font', query);
      document.head.appendChild(link);
    } catch (_) { /* fonts are progressive enhancement — system stack still reads fine */ }
  }, [query]);
}

// Palette lookup by id; unknown/missing id falls back to the template's first
// palette so a half-created site still renders styled.
export const resolvePalette = (palettes, id) =>
  palettes.find((p) => p.id === id) || palettes[0];

// "Ironside Plumbing" → "IP". The initials plate is the templates' logo
// stand-in so a site with zero uploaded art still looks finished.
export const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const two = parts.slice(0, 2).map((w) => w[0]).join('');
  return (two || '·').toUpperCase();
};

// tel: href from "(609) 555-0143" and friends. Keeps a leading +.
export const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

// Trimmed string ('' for null/undefined) — the single "is there content?" gate.
export const txt = (v) => (v == null ? '' : String(v).trim());

// Keep only array rows where at least one of the named keys has content.
// rows(d.services, 'name')  → services that actually have a name.
export const rows = (arr, ...keys) =>
  Array.isArray(arr) ? arr.filter((r) => r && keys.some((k) => txt(r[k]) !== '')) : [];

// ── Topic (business-type → on-brand topical motif) ───────────────────────────
// Maps a free-text businessType ("Emergency Plumbing", "Plumber", "HVAC & Heating")
// to a normalized `kind` (which crafted glyph/motif to draw) plus a short display
// `word` (e.g. a hero watermark). Keyword-matched + ordered so the more specific
// wins (barber before the broader salon; pizza before the broader bar). This is
// what lets a photo-less template read as *its* trade instead of generic stock.
// `kind: 'generic'` when nothing matches. PURE + unit-tested.
const TOPICS = [
  { kind: 'plumbing',    word: 'Plumbing',    re: /plumb/i },
  { kind: 'hvac',        word: 'HVAC',        re: /hvac|heating|cooling|furnace/i },
  { kind: 'electrical',  word: 'Electric',    re: /electric/i },
  { kind: 'roofing',     word: 'Roofing',     re: /roof/i },
  { kind: 'landscaping', word: 'Landscaping', re: /landscap|lawn|garden|\btree\b|nursery/i },
  { kind: 'auto',        word: 'Auto',        re: /auto|mechanic|\bcar\b|tire|collision/i },
  { kind: 'contractor',  word: 'Build',       re: /contract|construct|remodel|handyman|carpen|paint/i },
  { kind: 'pizza',       word: 'Pizzeria',    re: /pizz/i },
  { kind: 'bakery',      word: 'Bakery',      re: /bak|pastry|bread|donut|cake/i },
  { kind: 'cafe',        word: 'Cafe',        re: /caf|coffee|espresso|roaster/i },
  { kind: 'bar',         word: 'Bar',         re: /\bbar\b|pub|tavern|brew|cocktail|lounge/i },
  { kind: 'dining',      word: 'Kitchen',     re: /restaur|kitchen|grill|diner|eatery|\bfood\b|cater|bistro|deli/i },
  { kind: 'barber',      word: 'Barber',      re: /barber/i },
  { kind: 'salon',       word: 'Salon',       re: /salon|\bhair\b|stylist|blowout/i },
  { kind: 'nails',       word: 'Nails',       re: /nail|manicure/i },
  { kind: 'spa',         word: 'Spa',         re: /spa|massage|facial|\bwax\b|wellness/i },
  { kind: 'yoga',        word: 'Studio',      re: /yoga|pilates|fitness|\bgym\b|barre/i },
  { kind: 'law',         word: 'Law',         re: /\blaw\b|attorney|legal|counsel/i },
  { kind: 'accounting',  word: 'Accounting',  re: /account|\btax\b|bookkeep|\bcpa\b|payroll/i },
  { kind: 'insurance',   word: 'Insurance',   re: /insur/i },
  { kind: 'realestate',  word: 'Realty',      re: /real estate|realty|realtor|properties|broker/i },
  { kind: 'finance',     word: 'Advisory',    re: /financ|wealth|invest|advisor|capital/i },
  { kind: 'consulting',  word: 'Consulting',  re: /consult|agency|strateg|marketing/i },
  { kind: 'plants',      word: 'Plants',      re: /plant|florist|flower|greenhouse/i },
  { kind: 'books',       word: 'Books',       re: /book|library|\bread\b|stationer/i },
  { kind: 'records',     word: 'Records',     re: /record|vinyl|\bmusic\b/i },
  { kind: 'boutique',    word: 'Boutique',    re: /boutique|apparel|cloth|fashion|vintage|thrift/i },
  { kind: 'gifts',       word: 'Goods',       re: /gift|home goods|decor|market|candle|jewel/i },
];
export function topicOf(businessType) {
  const s = String(businessType || '');
  const hit = TOPICS.find((t) => t.re.test(s));
  return hit ? { kind: hit.kind, word: hit.word } : { kind: 'generic', word: s.trim() };
}

// ── Photos ───────────────────────────────────────────────────────────────────

// Owner-supplied photo URLs win slot-by-slot; empty inputs fall back to the
// template's curated defaults, so the preview is never photo-less.
//   mergePhotos({hero:'', gallery:['x','']}, DEFAULTS) → hero: default, gallery: ['x']
export const mergePhotos = (photos, defaults) => {
  const p = photos && typeof photos === 'object' ? photos : {};
  const ownGallery = Array.isArray(p.gallery) ? p.gallery.map(txt).filter(Boolean) : [];
  return {
    hero: txt(p.hero) || defaults.hero,
    gallery: ownGallery.length ? ownGallery : defaults.gallery,
  };
};

// Scoped CSS for the fail-safe stack. `scope` is the template's root class
// (e.g. '.jpwt'); `tile` is the crafted underlayer background (each template
// derives it from its palette so a missing photo still reads on-brand).
export const PH_CSS = (scope, tile) => `
${scope} .jpw-ph{position:relative;overflow:hidden;margin:0;background:${tile};}
${scope} .jpw-ph>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
${scope} .jpw-ph-fx{position:absolute;inset:0;display:block;pointer-events:none;}
${scope} .jpw-ph-fx svg{width:100%;height:100%;display:block;}
`;

// Fail-safe <img>: the crafted `fx` scene renders UNDER the photo, so it is
// what the visitor sees while the photo loads; if the photo 404s/blocks, the
// img unmounts (and the wrapper gains .jpw-ph-noimg) leaving a designed tile
// instead of a broken-image glyph.
export function Ph({ src, alt, className = '', fx, style }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [src]);
  return (
    <figure className={`jpw-ph ${className}${failed ? ' jpw-ph-noimg' : ''}`} style={style}>
      {fx ? <span className="jpw-ph-fx" aria-hidden="true">{fx}</span> : null}
      {!failed && (
        <img src={src} alt={alt || ''} loading="lazy" onError={() => setFailed(true)} />
      )}
    </figure>
  );
}
