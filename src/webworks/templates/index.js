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
      // "by hand" confirmed with him — he still does the cutting, hammering,
      // welding and sanding himself, which is what the process paragraph rests on.
      tagline: 'One-of-a-kind stainless steel sculpture, made by hand in Woodstock, Vermont.',
      // His own words for what makes the work unique, from the artist's
      // statement. Replaced "Stainless steel, shaped by hand", which asserted
      // present-tense physical labour the source can't date — see the About
      // note below. This line is timeless and can never go stale.
      heroHeadline: 'A form that has never existed before',
      ctaLabel: 'Call the studio',
      phone: '(802) 356-9414',
      email: 'scottiereuben@gmail.com',
      serviceArea: 'Shipped worldwide',
      address: 'Woodstock, Vermont',
      // CV: "1989–present Artist, Sculptor". A fixed anchor that never rots —
      // it renders as "SINCE 1989" in the hero's origin strip beside the
      // shipping line. 1992 dates only the move to Woodstock, not the career.
      established: '1989',
      hours: [],           // he keeps no posted hours — the section stays hidden
      // The two things he actually sells, both confirmed open right now: he is
      // taking commissions, and he has finished pieces available. They render
      // side by side and equally weighted — this IS the offer, so it is the
      // structure rather than a list of services.
      //
      // "Shipping" used to be a third row. It came out: an unqualified
      // "delivery arranged anywhere" promised logistics his answers never
      // claimed, the fact already appears twice (the hero strip and the contact
      // band both say "Shipped worldwide"), and crating only matters once
      // somebody is buying a finished piece — so it lives in that panel now.
      services: [
        { name: 'Commissioned work', desc: 'A sculpture made for your space, worked out with you. Call to talk through scale, site and material.', price: '' },
        { name: 'Available pieces', desc: 'Finished sculptures ready to go, each the only one of its kind. Call to ask what is in the studio now, and about crating and delivery.', price: '' },
      ],
      // From the biography letter he sent, in his voice, and NOTHING beyond it.
      // Order is deliberate: material, then process, then lineage, then why the
      // work is free-form. With no photographs yet, the process paragraph is
      // doing the photographs' job, so it runs second rather than last.
      //
      // Held back on purpose, each for a reason:
      //   · "does not rust, retaining its quality forever" — a durability
      //     warranty he never meant to give. Stainless pits; a Vermont winter
      //     of road salt is exactly that exposure. Only "does not tarnish".
      //   · "11 gauge" — 11ga is ~0.120", not the 1/8" the letter equates it
      //     to. His own rounding, but a checkable spec. Thickness only.
      //   · "renowned" (of Roy Gussow) — his characterisation in a private
      //     letter; on a public page it becomes us asserting a third party's
      //     stature. Named plainly, firmly in the past.
      //   · Galleries, memberships, the 1981–82 teaching assistantship, the
      //     Boonton studio, his age and street address — see the site brief.
      about: [
        'I work in stainless steel because, like gold, it is immutable — it does not tarnish. Polished to a high luster, the surface returns the light, and that reflection gives a piece its fluidity. What I am after is grace and elegance, and a harmonious relationship between all the elements, from whatever angle you see it.',
        'A piece begins as a flat sheet an eighth of an inch thick. The pattern is cut with a plasma cutter; the flat planes are then worked into three dimensions by cold hammering and joined with an arc welder. What follows is arduous — the weld beads ground away, then twelve successive passes of sandpaper, each finer than the last, and a final polish with a felt pad charged with chromium oxide.',
        'I took a Bachelor of Arts at Columbia University in 1980, and from 1982 to 1989 I was apprenticed to Roy Gussow, a sculptor in stainless steel in New York. In 1989 I began working on my own, leaving his forms behind to find my own, and in 1992 I moved my studio to Woodstock.',
        'I chose free-form work over representational sculpture because what draws me is articulating a form that has never existed before. The pieces are titled by number, so the name suggests nothing the sculpture is not.',
      ].join('\n\n'),
      testimonials: [],
      // One row per sculpture, added as his photos come in. Photo and details
      // ride together so a caption can never end up under the wrong piece.
      works: [],
      paletteId: 'steel',
    },
    // Extra editor section for this build only — the five templates never see
    // it. A portfolio needs a per-piece list; a plumber's site does not.
    worksEditor: {
      key: 'works',
      title: 'Sculptures',
      hint: 'One row per piece. Upload the photo now — the title, description and price can stay empty until he gives them to you.',
      addLabel: 'Add a sculpture',
      blank: { photo: '', title: '', note: '', price: '' },
      photoKey: 'photo',
      fields: [
        { key: 'title', label: 'Title / number', placeholder: 'No. 270' },
        { key: 'price', label: 'Price', narrow: true, placeholder: 'blank = says nothing' },
        { key: 'note', label: 'Description', wide: true, minRows: 2, placeholder: 'Stainless steel, 34 in.' },
      ],
    },
    Component: lazy(() => import('./custom/ToddReuben')),
  },
];

// Anything that can render a site record, template or custom build.
export const ALL_SITE_LOOKS = [...TEMPLATES, ...CUSTOM_SITES];

export const getTemplate = (id) => ALL_SITE_LOOKS.find((t) => t.id === id) || null;
