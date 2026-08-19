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
      // Plain words. He is an older man talking about his own work, so the copy
      // reads the way he would say it out loud — no "immutable", no "arduous",
      // no words a visitor has to stop and parse. Every fact still traces to his
      // letter; only the vocabulary changed. He is named in the first line so
      // the About block introduces the man, not just the material.
      about: [
        'My name is Todd Reuben. I work in stainless steel because it lasts — like gold, it does not tarnish. Polished to a high shine, the surface catches the light, and that reflection becomes part of the piece. What I am after is grace and balance, so a sculpture looks right from any angle you see it.',
        'A piece starts as a flat sheet of steel, an eighth of an inch thick. I cut the shape with a plasma cutter, hammer the flat pieces into three dimensions, and weld them together. Then comes the long part: grinding the welds away, twelve passes of sandpaper, each finer than the last, and a final polish with a felt pad and chromium oxide.',
        'I earned a Bachelor of Arts at Columbia University in 1980, and from 1982 to 1989 I was apprenticed to Roy Gussow, a sculptor in stainless steel in New York. In 1989 I began working on my own, leaving his shapes behind to find my own, and in 1992 I moved my studio to Woodstock.',
        'I make free-form work rather than sculptures of things, because what interests me is finding a shape that has never existed before. I title each piece by number, so the name does not suggest something the sculpture is not.',
      ].join('\n\n'),
      // ── The CV ────────────────────────────────────────────────────────
      // He asked for this by name: the site said nothing about his career,
      // his years of apprenticeship, or the galleries. It does now.
      //
      // Straight off the CV page of his letter, in his own headings. Two
      // judgement calls worth knowing about:
      //
      //  · "FORMER Gallery Affiliations" is HIS word, and it is the heading
      //    kept here. His older biographical sketch says two of them show his
      //    work "presently" — but that page also describes the 1992 move as
      //    recent, so the CV is the later document and wins. Listing them as
      //    former is true either way; claiming current representation is only
      //    true one way, and a buyer can check it with a phone call.
      //  · Career runs newest-first, the way a CV is read. His page runs
      //    oldest-first, which buries "1989–present, Artist" at the bottom.
      //
      // "In." under Memberships is a typo for "Inc." on his page — corrected,
      // because it is plainly a slip and not a name.
      education: 'B.A., Columbia University, New York, 1980',
      career: [
        { years: '1989 — present', what: 'Artist and sculptor. Studio in Boonton, New Jersey, and in Woodstock, Vermont since 1992.' },
        { years: '1982 — 1989', what: 'Apprentice to Roy Gussow, sculptor in stainless steel, New York City.' },
        { years: '1981 — 1982', what: 'Teaching assistant, Department of Art, Columbia University.' },
      ],
      galleries: [
        { name: 'Gallery North Star', where: 'Grafton, Vermont' },
        { name: 'Simon Gallery', where: 'Morristown, New Jersey' },
        { name: 'John Zaccheo Fine Art Gallery', where: 'Manchester, Vermont' },
        { name: 'Fine Art Firm', where: 'Louisville, Kentucky' },
      ],
      memberships: [
        { name: 'Southern Vermont Artists, Inc.', where: 'Manchester, Vermont' },
        { name: 'Vermont Arts Council', where: 'Montpelier, Vermont' },
      ],
      testimonials: [],
      // The six pieces he named, with the material he gave for each, in the
      // order he read them out. Titles are his own: he numbers his sculptures
      // rather than naming them, which the biography letter says is deliberate.
      //
      // PHOTOS DELIBERATELY EMPTY. The picture files are named to match these
      // numbers, so the person uploading pairs them — nobody else can do it
      // safely, and a photograph captioned with the wrong piece is worse than
      // an uncaptioned one. A row renders on the public page only once it HAS a
      // photo, so these six sit waiting in the editor without putting six empty
      // frames on the site.
      works: [
        { photo: '', title: 'SC 265', note: 'Stainless steel', price: '' },
        { photo: '', title: 'SC 262', note: 'Stainless steel', price: '' },
        { photo: '', title: 'SC 220', note: 'Stainless steel', price: '' },
        { photo: '', title: 'SC 261', note: 'Gold plated', price: '' },
        { photo: '', title: 'SC 230', note: 'Stainless steel', price: '' },
        { photo: '', title: 'SC 203', note: 'Stainless steel', price: '' },
        // Four more, sent later with heights — so these carry a dimension and
        // the first six do not, until he reads those out too. His own numbers
        // and his own wording for the material, kept as given.
        { photo: '', title: 'SC 271', note: 'Gold plated stainless steel · H 9¾ in.', price: '' },
        { photo: '', title: 'SC 267', note: 'Stainless steel · H 8½ × 14½ in.', price: '' },
        { photo: '', title: 'SC 272', note: 'Stainless steel · H 11 in.', price: '' },
        { photo: '', title: 'SC 273', note: 'Stainless steel · H 14¾ in.', price: '' },
      ],
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
    // The CV, editable in the Studio like everything else. Declared here rather
    // than hard-coded in the component so Nate can fix a date or add a gallery
    // without a deploy — the same reason `worksEditor` above exists.
    cvEditor: {
      title: 'Background (CV)',
      hint: 'His professional record. Leave a group empty and it disappears from the site.',
      text: { key: 'education', label: 'Education', placeholder: 'B.A., Columbia University, New York, 1980' },
      groups: [
        {
          key: 'career', label: 'Professional career', addLabel: 'Add a role',
          hint: 'Newest first — that is the order the site prints them in.',
          blank: { years: '', what: '' },
          fields: [
            { key: 'years', label: 'Years', narrow: true, placeholder: '1982 — 1989' },
            { key: 'what', label: 'What he was doing', wide: true, minRows: 2 },
          ],
        },
        {
          key: 'galleries', label: 'Former gallery affiliations', addLabel: 'Add a gallery',
          hint: 'His own CV says FORMER. If any are current again, say so on the site before changing this.',
          blank: { name: '', where: '' },
          fields: [
            { key: 'name', label: 'Gallery', placeholder: 'Gallery North Star' },
            { key: 'where', label: 'Where', placeholder: 'Grafton, Vermont' },
          ],
        },
        {
          key: 'memberships', label: 'Memberships', addLabel: 'Add a membership',
          blank: { name: '', where: '' },
          fields: [
            { key: 'name', label: 'Organisation', placeholder: 'Vermont Arts Council' },
            { key: 'where', label: 'Where', placeholder: 'Montpelier, Vermont' },
          ],
        },
      ],
    },
    Component: lazy(() => import('./custom/ToddReuben')),
  },
];

// Anything that can render a site record, template or custom build.
export const ALL_SITE_LOOKS = [...TEMPLATES, ...CUSTOM_SITES];

export const getTemplate = (id) => ALL_SITE_LOOKS.find((t) => t.id === id) || null;
