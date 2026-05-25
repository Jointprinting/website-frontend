// JpLoader — branded loading indicator used in place of MUI CircularProgress
// for page- and section-level loading states.
//
// The effect: the JP logo silhouette is painted with a green gradient that
// sweeps left → right continuously. CSS `mask-image` reveals only the logo
// shape from a moving linear-gradient background, so it reads as "the logo
// filling itself with light" without needing an SVG version of the mark.
//
// Use this anywhere a user is waiting a noticeable beat (>200ms). Tiny
// inline button spinners are still fine as CircularProgress — at 14px the
// logo mask doesn't read.
//
// Props:
//   size       — px box size (default 64). Pass a number, not a string.
//   label      — optional caption rendered below the mark.
//   tone       — 'dark' (default, for studio/dark backgrounds — greenDk base
//                + bright-green sweep) or 'light' (for the public site —
//                muted-green base + brand-green sweep).
//   highlight  — override the sweep color (rare; usually leave the tone
//                preset alone).
//   align      — 'center' (default) wraps in a column-centered Stack;
//                'inline' returns just the mark + label inline.

import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import jpLogo from '../modules/images/logo_white.webp';

const BRAND = {
  green:   '#4ade80',
  greenDk: '#1a3d2b',
};

const TONES = {
  dark:  { base: BRAND.greenDk, highlight: BRAND.green,   label: 'rgba(255,255,255,0.7)' },
  light: { base: '#c8d6cd',     highlight: BRAND.greenDk, label: 'rgba(20,40,28,0.7)' },
};

export default function JpLoader({ size = 64, label, tone = 'dark', highlight, align = 'center' }) {
  const palette = TONES[tone] || TONES.dark;
  const sweep = highlight || palette.highlight;
  const base = palette.base;
  // The mark itself: a square box whose background is a moving gradient,
  // masked to the logo shape. Subtle drop pulse layered on top via opacity
  // keyframes — gives the mark a heartbeat in case the gradient sweep is too
  // subtle on the user's display.
  const mark = (
    <Box
      role="img"
      aria-label="Loading"
      sx={{
        width: size,
        height: size,
        WebkitMaskImage: `url(${jpLogo})`,
        maskImage: `url(${jpLogo})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        background: `linear-gradient(110deg,
          ${base} 0%,
          ${base} 35%,
          ${sweep} 50%,
          ${base} 65%,
          ${base} 100%)`,
        backgroundSize: '250% 100%',
        animation: 'jpLoaderSweep 1.4s linear infinite, jpLoaderPulse 2.4s ease-in-out infinite',
        '@keyframes jpLoaderSweep': {
          '0%':   { backgroundPosition: '150% 0' },
          '100%': { backgroundPosition: '-150% 0' },
        },
        '@keyframes jpLoaderPulse': {
          '0%, 100%': { opacity: 0.85 },
          '50%':      { opacity: 1 },
        },
        // Respect users who've asked for less motion — drop the sweep, keep
        // a slower opacity pulse so the page still signals activity.
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'jpLoaderPulse 1.8s ease-in-out infinite',
          background: sweep,
        },
      }}
    />
  );

  if (align === 'inline') {
    return label ? (
      <Stack direction="row" alignItems="center" spacing={1.25}>
        {mark}
        <Typography sx={{ color: palette.label, fontSize: 13 }}>{label}</Typography>
      </Stack>
    ) : mark;
  }

  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
      {mark}
      {label && (
        <Typography sx={{ color: palette.label, fontSize: 13, letterSpacing: 0.3 }}>
          {label}
        </Typography>
      )}
    </Stack>
  );
}
