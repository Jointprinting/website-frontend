// src/webworks/templates/index.js
// The ONE source of truth for JP Webworks site templates. Both consumers read
// from here so they can never drift:
//   • the Studio's Websites tool (template picker cards + palette swatches +
//     the editor's live preview)
//   • the public preview route /webworks/p/:slug (renders the client's site)
//
// Each entry:
//   id            — stored on the Site record (site.templateId)
//   label / description — what the Studio's picker shows
//   businessTypes — the picker's business-type suggestions for this template
//   palettes      — [{ id, label, swatches }] for swatch UIs; the FULL palette
//                   role maps live in _meta.js and only the template's own CSS
//                   reads them
//   Component     — React.lazy so each template is its own chunk; nothing here
//                   pulls template code into the main bundle. Render inside
//                   <Suspense>.
//
// Every template renders the same `data` contract (mirrors the backend
// models/JpwSite `data` bag): businessName, tagline, heroHeadline, ctaLabel,
// phone, email, serviceArea, address, hours[{days,hours}],
// services[{name,desc,price}], about, testimonials[{quote,name}], paletteId,
// established, license, photos{hero,gallery[]}.
//
// photos is fail-safe: each template ships a curated default set (so every
// preview looks photographed from the first render) and owner-supplied URLs
// override slot-for-slot. Every photo renders through the _kit Ph/background
// stack — a crafted palette scene paints when the photo is loading or gone.

import { lazy } from 'react';
import {
  TRADES_PALETTES, DINING_PALETTES, WELLNESS_PALETTES,
  PROFESSIONAL_PALETTES, RETAIL_PALETTES,
} from './_meta';

// Pickers only need the chips — strip the CSS role maps.
const chips = (ps) => ps.map(({ id, label, swatches }) => ({ id, label, swatches }));

export const TEMPLATES = [
  {
    id: 'trades',
    label: 'Trades',
    description: 'Bold and industrial — slate, hazard stripes, condensed type. Built to look dependable.',
    businessTypes: ['Plumbing', 'HVAC', 'Electrical', 'Landscaping', 'Roofing', 'General contractor', 'Auto repair'],
    palettes: chips(TRADES_PALETTES),
    Component: lazy(() => import('./Trades')),
  },
  {
    id: 'dining',
    label: 'Dining',
    description: 'Warm and menu-forward — serif display type, dotted menu leaders, ornament dividers.',
    businessTypes: ['Restaurant', 'Café', 'Bakery', 'Bar', 'Pizzeria', 'Food truck', 'Catering'],
    palettes: chips(DINING_PALETTES),
    Component: lazy(() => import('./Dining')),
  },
  {
    id: 'wellness',
    label: 'Wellness',
    description: 'Airy and elegant — light serif, hairline rules, generous whitespace. Calm by design.',
    businessTypes: ['Salon', 'Spa', 'Massage', 'Yoga studio', 'Barbershop', 'Nail studio', 'Pilates'],
    palettes: chips(WELLNESS_PALETTES),
    Component: lazy(() => import('./Wellness')),
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Composed and credible — Baskerville headings, a strict ruled grid, an at-a-glance facts panel.',
    businessTypes: ['Law firm', 'Accounting', 'Insurance', 'Real estate', 'Consulting', 'Financial planning'],
    palettes: chips(PROFESSIONAL_PALETTES),
    Component: lazy(() => import('./Professional')),
  },
  {
    id: 'retail',
    label: 'Retail',
    description: 'Playful and chunky — duotone color, hard shadows, sticker badges, a tagline marquee.',
    businessTypes: ['Boutique', 'Gift shop', 'Bookstore', 'Record store', 'Vintage', 'Home goods', 'Plant shop'],
    palettes: chips(RETAIL_PALETTES),
    Component: lazy(() => import('./Retail')),
  },
];

export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || null;
