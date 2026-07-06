// src/webworks/templates/_meta.js
// Palette definitions for the five JP Webworks templates. This file is plain
// data — NO component imports — so the registry (index.js) and the Studio's
// template picker can read palette swatches without pulling any template's
// lazy chunk into the bundle.
//
// Shape per palette:
//   id / label   — what the Studio's Style section shows
//   swatches     — 3 chips for pickers (deep tone, accent, page background)
//   c            — the full role map the template's CSS is written against.
//                  Role vocabulary (shared so the CSS reads the same across
//                  templates, even though each template USES them differently):
//     bg / surface — page background / card background
//     ink / sub    — primary / secondary text on light
//     line         — hairline borders on light
//     soft         — tinted section background
//     accent / accentInk — the brand pop + text that rides on it
//     dark / darkInk / darkSub — deep band background + text on it

// ── Trades — bold industrial ─────────────────────────────────────────────────
export const TRADES_PALETTES = [
  {
    id: 'safety', label: 'Slate & Safety Yellow', swatches: ['#151b23', '#f2b705', '#f4f5f7'],
    c: { bg: '#f4f5f7', surface: '#ffffff', ink: '#17202a', sub: '#55616e', line: '#dde2e8', soft: '#eaedf1',
         accent: '#f2b705', accentInk: '#151b23', dark: '#151b23', darkInk: '#f5f7fa', darkSub: 'rgba(245,247,250,0.72)' },
  },
  {
    id: 'forest', label: 'Charcoal & Forest', swatches: ['#14201a', '#3e9c63', '#f3f5f2'],
    c: { bg: '#f3f5f2', surface: '#ffffff', ink: '#182420', sub: '#4f5e56', line: '#dce2dd', soft: '#e9eee9',
         accent: '#3e9c63', accentInk: '#0b1a12', dark: '#14201a', darkInk: '#f2f6f3', darkSub: 'rgba(242,246,243,0.72)' },
  },
  {
    id: 'ember', label: 'Iron & Ember', swatches: ['#1d242c', '#e05f26', '#f5f4f2'],
    c: { bg: '#f5f4f2', surface: '#ffffff', ink: '#20262d', sub: '#5a6169', line: '#e2e0dc', soft: '#ecebe7',
         accent: '#e05f26', accentInk: '#ffffff', dark: '#1d242c', darkInk: '#f5f4f1', darkSub: 'rgba(245,244,241,0.72)' },
  },
];

// ── Dining — warm, menu-forward ──────────────────────────────────────────────
export const DINING_PALETTES = [
  {
    id: 'espresso', label: 'Espresso & Cream', swatches: ['#241811', '#a45a2a', '#f6efe3'],
    c: { bg: '#f6efe3', surface: '#fffaf1', ink: '#2b1d13', sub: '#6b5847', line: '#e2d5c2', soft: '#efe4d2',
         accent: '#a45a2a', accentInk: '#fff8ef', dark: '#241811', darkInk: '#f3e9da', darkSub: 'rgba(243,233,218,0.72)' },
  },
  {
    id: 'tomato', label: 'Charcoal & Tomato', swatches: ['#22242a', '#d93a2b', '#ffffff'],
    c: { bg: '#ffffff', surface: '#faf9f7', ink: '#22242a', sub: '#5b5e66', line: '#e6e6e3', soft: '#f4f2ee',
         accent: '#d93a2b', accentInk: '#ffffff', dark: '#22242a', darkInk: '#f5f4f1', darkSub: 'rgba(245,244,241,0.72)' },
  },
  {
    id: 'olive', label: 'Olive & Linen', swatches: ['#2c2f22', '#6b7f3f', '#f5f3ea'],
    c: { bg: '#f5f3ea', surface: '#fdfcf5', ink: '#2c2f22', sub: '#5f6350', line: '#dfddcd', soft: '#ebe8d9',
         accent: '#6b7f3f', accentInk: '#f8f8ef', dark: '#2c2f22', darkInk: '#eff0e5', darkSub: 'rgba(239,240,229,0.72)' },
  },
];

// ── Wellness — airy, elegant ─────────────────────────────────────────────────
export const WELLNESS_PALETTES = [
  {
    id: 'sage', label: 'Sage & Ivory', swatches: ['#3c4a40', '#6f8577', '#f1f3ee'],
    c: { bg: '#f1f3ee', surface: '#f9faf7', ink: '#333d34', sub: '#667168', line: '#dbe0d8', soft: '#e7ebe3',
         accent: '#6f8577', accentInk: '#ffffff', dark: '#3c4a40', darkInk: '#eef2ec', darkSub: 'rgba(238,242,236,0.72)' },
  },
  {
    id: 'blush', label: 'Blush & Clay', swatches: ['#4c3a35', '#b98577', '#f8f1ee'],
    c: { bg: '#f8f1ee', surface: '#fdf8f6', ink: '#443633', sub: '#7d6a65', line: '#e8dcd6', soft: '#f0e4de',
         accent: '#b98577', accentInk: '#ffffff', dark: '#4c3a35', darkInk: '#f6ece7', darkSub: 'rgba(246,236,231,0.72)' },
  },
  {
    id: 'stone', label: 'Stone & Sand', swatches: ['#45413a', '#948a76', '#f3f1ec'],
    c: { bg: '#f3f1ec', surface: '#faf9f5', ink: '#3b3833', sub: '#726c61', line: '#e1ddd3', soft: '#eae6dd',
         accent: '#948a76', accentInk: '#ffffff', dark: '#45413a', darkInk: '#f2efe8', darkSub: 'rgba(242,239,232,0.72)' },
  },
];

// ── Professional — composed, trustworthy ─────────────────────────────────────
export const PROFESSIONAL_PALETTES = [
  {
    id: 'navy', label: 'Navy & Brass', swatches: ['#16283f', '#b78b3e', '#ffffff'],
    c: { bg: '#ffffff', surface: '#ffffff', ink: '#1b2634', sub: '#55606d', line: '#dfe4ea', soft: '#f2f5f8',
         accent: '#b78b3e', accentInk: '#ffffff', dark: '#16283f', darkInk: '#f4f7fb', darkSub: 'rgba(244,247,251,0.72)' },
  },
  {
    id: 'slate', label: 'Slate & Sky', swatches: ['#2d3a45', '#5e88a6', '#ffffff'],
    c: { bg: '#ffffff', surface: '#ffffff', ink: '#242f38', sub: '#5a656e', line: '#e0e5e9', soft: '#f2f5f7',
         accent: '#5e88a6', accentInk: '#ffffff', dark: '#2d3a45', darkInk: '#f3f6f8', darkSub: 'rgba(243,246,248,0.72)' },
  },
  {
    id: 'burgundy', label: 'Burgundy & Stone', swatches: ['#4d1f28', '#a8846a', '#ffffff'],
    c: { bg: '#ffffff', surface: '#ffffff', ink: '#2e2226', sub: '#6b5c60', line: '#e7e0e2', soft: '#f6f2f3',
         accent: '#a8846a', accentInk: '#ffffff', dark: '#4d1f28', darkInk: '#f8f2f4', darkSub: 'rgba(248,242,244,0.72)' },
  },
];

// ── Retail — playful, chunky duotone. Extra roles: `pop` (second loud color)
//    and `tint` (light wash of the primary used on tiles). Borders/shadows are
//    drawn in `ink` for the sticker/hard-shadow look. ───────────────────────
export const RETAIL_PALETTES = [
  {
    id: 'grape', label: 'Grape & Lemon', swatches: ['#4630c9', '#f2e14c', '#faf7f0'],
    c: { bg: '#faf7f0', surface: '#ffffff', ink: '#221c35', sub: '#5a5470', line: '#221c35', soft: '#f1edfd',
         accent: '#4630c9', accentInk: '#ffffff', dark: '#221c35', darkInk: '#faf7f0', darkSub: 'rgba(250,247,240,0.72)',
         pop: '#f2e14c', popInk: '#221c35', tint: '#ece7fb' },
  },
  {
    id: 'tangerine', label: 'Tangerine & Navy', swatches: ['#13203a', '#ee5a24', '#fbf5ec'],
    c: { bg: '#fbf5ec', surface: '#ffffff', ink: '#13203a', sub: '#4d5a72', line: '#13203a', soft: '#fdeadd',
         accent: '#ee5a24', accentInk: '#ffffff', dark: '#13203a', darkInk: '#fbf5ec', darkSub: 'rgba(251,245,236,0.72)',
         pop: '#ffd23f', popInk: '#13203a', tint: '#fde8dc' },
  },
  {
    id: 'bubblegum', label: 'Bubblegum & Ink', swatches: ['#1c1a1e', '#ef6ba8', '#fdf6f8'],
    c: { bg: '#fdf6f8', surface: '#ffffff', ink: '#1c1a1e', sub: '#5b545a', line: '#1c1a1e', soft: '#fbe4ee',
         accent: '#ef6ba8', accentInk: '#1c1a1e', dark: '#1c1a1e', darkInk: '#fdf6f8', darkSub: 'rgba(253,246,248,0.72)',
         pop: '#8fe3dc', popInk: '#1c1a1e', tint: '#fbdeeb' },
  },
];
