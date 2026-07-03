// src/brand.js
//
// Joint Printing PUBLIC-SITE brand tokens — one source of truth for the marketing
// site's color / type / shape, per the approved brand guide. Named once here so the
// pages stop each defining their own "brand green." Consume in MUI `sx` / inline
// styles (e.g. `bgcolor: JP.forest`, `borderRadius: JP.radius.card / 8`).
//
// NOT for the Studio admin: the private /studio keeps its own dark palette `D`
// (src/screens/studio/_shared.js). Do not import this there.

export const JP = {
  // ── Green ──
  forest:     '#1a3d2b', // primary — CTAs, dark green panels, logo field
  forestDeep: '#14301f', // filled-button hover / pressed
  emerald:    '#4ade80', // accent — eyebrows, active states, highlights, links
  emeraldSoft: (a = 0.12) => `rgba(74,222,128,${a})`, // translucent emerald tints

  // ── Surfaces ──
  ink:        '#111816', // the single dark hero / section surface
  charcoal:   '#28282a', // navbar + body text on light
  paper:      '#f5f5f5', // light section ground
  white:      '#ffffff', // cards / forms on paper
  pale:       '#e3ede2', // footer field / soft tint

  // ── Text on dark ──
  onDark:      '#f4f8f5',
  onDarkMuted: 'rgba(244,248,245,0.66)',

  // ── Shape (px) ──
  radius: { chip: 8, card: 16, panel: 24, pill: 999 },

  // ── Type ──
  fontDisplay: "'Roboto Condensed', 'Arial Narrow', sans-serif",
  fontBody:    "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export default JP;
