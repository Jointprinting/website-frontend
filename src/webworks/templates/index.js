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
  PROFESSIONAL_PALETTES, RETAIL_PALETTES, TODD_REUBEN_PALETTES,
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

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOM SITES — hand-built one-off client sites
// ─────────────────────────────────────────────────────────────────────────────
// The five TEMPLATES above are the on-the-fly kit: pick a look, fill the form,
// send a preview link in ten minutes. A CUSTOM SITE is the other half of the
// business — a site designed around ONE client, when the client is worth
// hand-building for (or their trade fits none of the five).
//
// They are deliberately NOT in TEMPLATES: they must never headline the
// new-site gallery as if they were a reusable look, and adding one must never
// change what the template picker offers. But they are otherwise first-class —
// same `data` contract, same lazy chunk, same palettes-in-_meta rule — and
// getTemplate() resolves them, so the Studio editor's live preview,
// /webworks/p/:slug and the client's connected domain all render them with no
// special-casing anywhere downstream.
//
// Adding the next one: component in ./custom/, palettes in _meta.js, one entry
// here. Nothing else in the app needs to know.
export const CUSTOM_SITES = [
  {
    id: 'custom-todd-reuben',
    label: 'Todd Reuben Sculptor',
    description: 'Gallery one-pager for a stainless steel sculptor — work-first grid, catalogue ledger, phone-forward close.',
    businessTypes: ['Sculptor', 'Artist', 'Fine art', 'Gallery', 'Metalwork'],
    palettes: chips(TODD_REUBEN_PALETTES),
    custom: true,
    // Creating the site drops this straight into `data` (see seedData in the
    // Studio's Websites tab) so the editor opens filled in from his intake
    // answers rather than blank. Ordinary editable content — change anything.
    //
    // Every line traces to something he actually said. Nothing here invents a
    // price, a year, a credential or a review, and `about` is deliberately
    // EMPTY: he is sending his own bio, and the About section stays hidden
    // until it is pasted in.
    seedData: {
      tagline: 'One-of-a-kind stainless steel sculpture, made in Woodstock, Vermont.',
      heroHeadline: 'Stainless steel, shaped by hand',
      ctaLabel: 'Call the studio',
      phone: '(802) 356-9414',
      email: 'scottiereuben@gmail.com',
      serviceArea: 'Shipped worldwide',
      address: 'Woodstock, Vermont',
      hours: [],           // he keeps no posted hours — the section stays hidden
      services: [
        { name: 'Commissioned work', desc: 'A sculpture made for your space. Call to talk through scale, site and material.', price: '' },
        { name: 'Available pieces', desc: 'Finished sculptures ready to go. Each one is the only one of its kind — call to ask what is in the studio now.', price: '' },
        { name: 'Shipping', desc: 'Pieces have travelled well beyond Vermont. Crating and delivery arranged anywhere.', price: '' },
      ],
      about: '',           // his bio is coming — section hides until it lands
      testimonials: [],
      paletteId: 'steel',
    },
    Component: lazy(() => import('./custom/ToddReuben')),
  },
];

// Anything that can render a site record, template or custom build.
export const ALL_SITE_LOOKS = [...TEMPLATES, ...CUSTOM_SITES];

export const getTemplate = (id) => ALL_SITE_LOOKS.find((t) => t.id === id) || null;
