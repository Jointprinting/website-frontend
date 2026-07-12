// src/common/BrandCube.js
//
// The Joint Printing "shipping box" mark, reworked as a tintable vector so every
// business in the family shares one silhouette and reads as a set. Same isometric
// box, same chunky black keyline, same yellow packing-tape strip, same "JP" on
// the left face — only the COLOR and the right-face GLYPH change per business:
//
//   • Joint Printing → green  · tee     (custom merch / print — the original)
//   • JP Webworks    → blue   · </>     (websites)
//   • JP Nucleus     → violet · nucleus (bespoke business systems)
//
// Pure SVG → crisp at any size, no asset to ship, trivially extended: add one
// entry to BRAND_MARKS and a new business's cube exists. Used by the Studio hub's
// section headers; safe to reuse anywhere a small brand mark is wanted.

import React from 'react';

// One box, three faces (120×120 viewBox). Front-top vertex is the shared seam the
// left + right faces meet on; the tape runs over the top face and down the left.
const FACES = {
  top:   '60,10 110,38 60,66 10,38',
  left:  '10,38 60,66 60,112 10,84',
  right: '60,66 110,38 110,84 60,112',
};
const TAPE_TOP  = '31,49.8 81,21.8 87,25.1 37,53.1';
const TAPE_LEFT = '31,49.8 37,53.1 37,99.1 31,95.8';
const TAPE   = '#F3D95E';
const KEY    = '#0b0b0b';

// Per-business color set (top / left / right face) + which glyph rides the right
// face. Keyed by the exact brand string the hub uses.
export const BRAND_MARKS = {
  'Joint Printing': { top: '#4BAF3E', left: '#2C6E2C', right: '#5FCB4F', glyph: 'tee' },
  'JP Webworks':    { top: '#2F86E0', left: '#1C4E96', right: '#54A6FF', glyph: 'code' },
  'JP Nucleus':     { top: '#7A54E8', left: '#472C9C', right: '#9E82FF', glyph: 'atom' },
};

function Glyph({ kind }) {
  if (kind === 'code') {
    // < / >  centered on the right face (~85,75).
    return (
      <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M79,68 L73.5,75 L79,82" />
        <path d="M88.5,66 L81.5,84" />
        <path d="M91,68 L96.5,75 L91,82" />
      </g>
    );
  }
  if (kind === 'atom') {
    // Nucleus: a bright core + two crossed orbits.
    return (
      <g>
        <ellipse cx="85" cy="75" rx="18" ry="7" fill="none" stroke="#fff" strokeWidth="2.8" transform="rotate(-28 85 75)" />
        <ellipse cx="85" cy="75" rx="18" ry="7" fill="none" stroke="#fff" strokeWidth="2.8" transform="rotate(28 85 75)" />
        <circle cx="85" cy="75" r="4.6" fill="#fff" />
      </g>
    );
  }
  // Default: the tee (Joint Printing).
  return (
    <path
      d="M79,60 L72,66 L76,72 L79,69.6 L79,90 L91,90 L91,69.6 L94,72 L98,66 L91,60 C89,63 81,63 79,60 Z"
      fill="#fff" stroke={KEY} strokeWidth="2.2" strokeLinejoin="round"
    />
  );
}

export default function BrandCube({ brand, size = 28, style }) {
  const m = BRAND_MARKS[brand] || BRAND_MARKS['Joint Printing'];
  return (
    <svg
      width={size} height={size} viewBox="0 0 120 120"
      role="img" aria-label={`${brand} logo`}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      <g stroke={KEY} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round">
        <polygon points={FACES.left}  fill={m.left} />
        <polygon points={FACES.right} fill={m.right} />
        <polygon points={FACES.top}   fill={m.top} />
      </g>
      {/* Packing tape — over the top, down the left face. Thin key so it reads as a strip. */}
      <g stroke={KEY} strokeWidth="1.6" strokeLinejoin="round">
        <polygon points={TAPE_TOP}  fill={TAPE} />
        <polygon points={TAPE_LEFT} fill={TAPE} />
      </g>
      {/* JP on the left face — the shared family tag. */}
      <text
        x="33" y="99" textAnchor="middle"
        fontSize="27" fontWeight="800" letterSpacing="-1"
        fontFamily="'Roboto Condensed','Arial Narrow',Arial,sans-serif"
        fill="#fff" stroke={KEY} strokeWidth="0.9"
      >JP</text>
      {/* Business glyph on the right face. */}
      <Glyph kind={m.glyph} />
    </svg>
  );
}
