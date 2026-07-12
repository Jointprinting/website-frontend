// src/common/BrandCube.js
//
// Each business's box mark. These are the ACTUAL Joint Printing box logo, recolored
// per business (green → blue → violet) with the white background knocked out but
// the yellow tape, white tee, and "JP" preserved — same polished art, one family,
// three colors. Generated from src/modules/images/logo_colored.webp.
//
// Consumed by the Studio hub's section headers; reusable anywhere a small brand
// mark is wanted. Add a business by dropping in a recolored PNG + one map entry.

import React from 'react';
import markJp from '../modules/images/mark_jp.png';
import markJpw from '../modules/images/mark_jpw.png';
import markJpn from '../modules/images/mark_jpn.png';

// brand → mark image. Keyed by the exact brand string the hub uses.
export const BRAND_MARKS = {
  'Joint Printing': markJp,
  'JP Webworks':    markJpw,
  'JP Nucleus':     markJpn,
};

export default function BrandCube({ brand, size = 28, style }) {
  const src = BRAND_MARKS[brand];
  if (!src) return null;
  return (
    <img
      src={src} alt={`${brand} logo`} width={size} height={size}
      style={{ display: 'block', flexShrink: 0, objectFit: 'contain', ...style }}
    />
  );
}
