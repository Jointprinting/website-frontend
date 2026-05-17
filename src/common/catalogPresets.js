// src/common/catalogPresets.js
//
// Visual treatment for each catalog style preset. Each preset exports:
//   - renderIcon(catalog)  → JSX for the corner icon (flag, leaf, emoji, etc.)
//   - renderTitle(catalog) → JSX for the styled title
//   - cardSx               → MUI sx object applied to the catalog card background
//   - defaultAccent        → fallback accent color if the catalog has none set
//
// Keep this in sync with:
//   - models/Catalog.js  (enum of preset IDs)
//   - studio/CatalogManagerTab.js  (PRESET_OPTIONS — labels shown in admin)

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// ─────────────────────────────────────────────────────────────────────────────
// Icon primitives
// ─────────────────────────────────────────────────────────────────────────────

const UsFlag = ({ width = 56, height = 36 }) => (
  <Box
    component="svg"
    viewBox="0 0 760 400"
    sx={{ width, height, display: 'block', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Flag of the United States"
  >
    <rect width="760" height="400" fill="#fff" />
    {[0, 2, 4, 6, 8, 10, 12].map((i) => (
      <rect key={i} y={(i * 400) / 13} width="760" height={400 / 13} fill="#B22234" />
    ))}
    <rect width={760 * 0.4} height={(400 / 13) * 7} fill="#3C3B6E" />
    {Array.from({ length: 9 }).map((_, row) =>
      Array.from({ length: row % 2 === 0 ? 6 : 5 }).map((_, col) => {
        const xStep = (760 * 0.4) / 12;
        const yStep = ((400 / 13) * 7) / 10;
        const cx = xStep + col * xStep * 2 + (row % 2 === 0 ? 0 : xStep);
        const cy = yStep + row * yStep;
        return (
          <text
            key={`${row}-${col}`} x={cx} y={cy + 6}
            fontSize="22" fill="#fff" textAnchor="middle"
            fontFamily="Arial, sans-serif"
          >★</text>
        );
      })
    )}
  </Box>
);

// Generic circular icon wrapper used by most non-default presets. Puts the
// emoji on a colored disc so the visual still has personality even when the
// emoji is plain.
const IconDisc = ({ children, bg, ring, glow }) => (
  <Box
    sx={{
      width: 56, height: 56, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28, lineHeight: 1,
      background: bg,
      boxShadow: glow ? `0 0 16px ${glow}` : 'none',
      border: ring ? `1.5px solid ${ring}` : 'none',
    }}
  >{children}</Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Title renderers
// ─────────────────────────────────────────────────────────────────────────────

// Splits the title into words and alternates red/blue. Falls back gracefully
// for single-word titles. Used by the patriotic preset.
const tricolorTitle = (title) => {
  const words = (title || '').trim().split(/\s+/);
  const colors = ['#B22234', '#0A2B5C'];
  return (
    <Typography variant="h5" component="h2"
      sx={{ fontWeight: 800, mb: 1, lineHeight: 1.25 }}>
      {words.map((w, i) => (
        <Box component="span" key={i} sx={{ color: colors[i % 2], mr: 0.6 }}>
          {w}
        </Box>
      ))}
    </Typography>
  );
};

// Title with a slow shimmer — winter-themed gradient. Animation defined inline
// via keyframes so this module doesn't need a global CSS file.
const holidayTitle = (title) => (
  <Typography variant="h5" component="h2"
    sx={{
      fontWeight: 800, mb: 1, lineHeight: 1.25,
      backgroundImage: 'linear-gradient(90deg, #c2410c 0%, #b45309 25%, #a16207 50%, #0f766e 75%, #c2410c 100%)',
      backgroundSize: '200% auto',
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      color: 'transparent',
      animation: 'jpHolidayShimmer 6s linear infinite',
      '@keyframes jpHolidayShimmer': {
        '0%':   { backgroundPosition: '0% center' },
        '100%': { backgroundPosition: '200% center' },
      },
    }}>{title}</Typography>
);

// Deep-green title with a vertical gradient that gives it a "canopy" feel.
const canopyTitle = (title, accent) => (
  <Typography variant="h5" component="h2"
    sx={{
      fontWeight: 800, mb: 1, lineHeight: 1.25,
      backgroundImage: `linear-gradient(180deg, ${accent} 0%, #0f3d1e 100%)`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      color: 'transparent',
    }}>{title}</Typography>
);

// Serif italic, gold tinted — luxury / exclusive feel.
const prestigeTitle = (title) => (
  <Typography variant="h5" component="h2"
    sx={{
      fontFamily: '"Playfair Display", "Times New Roman", Georgia, serif',
      fontStyle: 'italic', fontWeight: 700, mb: 1, lineHeight: 1.25,
      backgroundImage: 'linear-gradient(135deg, #b8860b 0%, #fde68a 50%, #b8860b 100%)',
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      color: 'transparent',
    }}>{title}</Typography>
);

// Monospace with magenta-to-cyan gradient and a subtle glow.
const neonTitle = (title) => (
  <Typography variant="h5" component="h2"
    sx={{
      fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
      fontWeight: 800, mb: 1, lineHeight: 1.25, letterSpacing: 0.5,
      backgroundImage: 'linear-gradient(90deg, #f0abfc 0%, #a855f7 50%, #06b6d4 100%)',
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      color: 'transparent',
      textShadow: '0 0 24px rgba(168,85,247,0.15)',
    }}>{title}</Typography>
);

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

export const PRESETS = {
  default: {
    defaultAccent: '#2e7d32',
    renderIcon: (cat) => (
      <Box sx={{ fontSize: 36, lineHeight: 1 }}>{cat.emoji || '📘'}</Box>
    ),
    renderTitle: (cat) => (
      <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
        {cat.title}
      </Typography>
    ),
    cardSx: {},
  },

  patriotic: {
    defaultAccent: '#B22234',
    renderIcon: () => <UsFlag />,
    renderTitle: (cat) => tricolorTitle(cat.title),
    cardSx: {
      background:
        'linear-gradient(135deg, rgba(178,34,52,0.04) 0%, #ffffff 50%, rgba(10,43,92,0.05) 100%)',
    },
  },

  holiday: {
    defaultAccent: '#0f766e',
    renderIcon: (cat) => (
      <IconDisc
        bg="linear-gradient(135deg, #fee2e2 0%, #fef3c7 50%, #d1fae5 100%)"
        ring="rgba(255,255,255,0.5)"
      >{cat.emoji || '❄️'}</IconDisc>
    ),
    renderTitle: (cat) => holidayTitle(cat.title),
    cardSx: {
      background:
        'linear-gradient(135deg, rgba(220,38,38,0.04) 0%, #ffffff 45%, rgba(5,150,105,0.05) 100%)',
    },
  },

  canopy: {
    defaultAccent: '#1b5e20',
    renderIcon: (cat) => (
      <IconDisc
        bg="radial-gradient(circle at 30% 30%, #14532d 0%, #052e16 90%)"
        ring="rgba(74,222,128,0.4)"
      >{cat.emoji || '🌿'}</IconDisc>
    ),
    renderTitle: (cat) => canopyTitle(cat.title, cat.accentColor || '#1b5e20'),
    cardSx: {
      background:
        'linear-gradient(135deg, rgba(20,83,45,0.05) 0%, #ffffff 60%, rgba(20,83,45,0.07) 100%)',
    },
  },

  prestige: {
    defaultAccent: '#b8860b',
    renderIcon: (cat) => (
      <IconDisc
        bg="linear-gradient(135deg, #fde68a 0%, #b8860b 100%)"
        ring="#92400e"
        glow="rgba(184,134,11,0.25)"
      >{cat.emoji || '✦'}</IconDisc>
    ),
    renderTitle: (cat) => prestigeTitle(cat.title),
    cardSx: {
      background:
        'linear-gradient(135deg, rgba(184,134,11,0.06) 0%, #ffffff 50%, rgba(146,64,14,0.06) 100%)',
      borderTop: '4px solid #b8860b',
    },
  },

  neon: {
    defaultAccent: '#a855f7',
    renderIcon: (cat) => (
      <IconDisc
        bg="radial-gradient(circle at 30% 30%, #1e1b4b 0%, #020617 90%)"
        ring="#a855f7"
        glow="rgba(168,85,247,0.35)"
      >{cat.emoji || '◆'}</IconDisc>
    ),
    renderTitle: (cat) => neonTitle(cat.title),
    cardSx: {
      background:
        'linear-gradient(135deg, rgba(168,85,247,0.05) 0%, #ffffff 55%, rgba(6,182,212,0.05) 100%)',
    },
  },
};

/**
 * Resolves a preset by id, falling back to 'default' for unknown ids so a
 * typo in the DB never breaks the page.
 */
export const getPreset = (id) => PRESETS[id] || PRESETS.default;
