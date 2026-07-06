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
//
// Templates NEVER render an empty shell: they pass their data through txt()/
// rows() and drop any section that comes back empty.

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

// "North Pine Plumbing" → "NP". The initials plate is the templates' logo
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
