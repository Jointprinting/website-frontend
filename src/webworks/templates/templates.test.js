// src/webworks/templates/templates.test.js
//
// Smoke coverage for every JP Webworks site look + the registry — the five
// on-the-fly templates AND the hand-built custom client sites, which render
// through the same machinery and so must hold the same contract.
// Every look is a pure function of the site `data` bag, so what's worth
// pinning is:
//   1. FULL data renders every section (nav, hero, services, about,
//      testimonials, hours, contact) without crashing.
//   2. EMPTY data renders WITHOUT crashing and WITHOUT empty section shells —
//      the owner's explicit design bar ("no mistakes"), and what makes a
//      half-built draft still presentable.
//   3. tel:/mailto: links are real (the phone CTA is the whole point of a
//      small-business one-pager).
//   4. An unknown paletteId falls back to the first palette instead of
//      exploding.
//   5. PHOTOS are fail-safe: every template renders its curated default set
//      when data.photos is absent, owner URLs override slot-for-slot, and a
//      photo that fails to load collapses to the crafted underlayer tile
//      (never a broken-image glyph). Run via:  CI=true npm test
//
// The registry's Component fields are React.lazy, so tests render inside
// <Suspense>. `findBy*` waits for the lazy chunk to resolve.

import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TEMPLATES, CUSTOM_SITES, ALL_SITE_LOOKS, getTemplate } from './index';
import { topicOf } from './_kit';

const FULL_DATA = {
  businessName: 'Ironside Plumbing & Heating',
  tagline: 'Honest work, done right',
  heroHeadline: 'Plumbing you can trust',
  ctaLabel: 'Call for a free estimate',
  phone: '(609) 555-0143',
  email: 'office@ironside.example',
  serviceArea: 'Burlington County',
  address: '12 Main St, Mount Holly, NJ',
  hours: [{ days: 'Mon – Fri', hours: '8:00 AM – 6:00 PM' }],
  services: [
    { name: 'Drain cleaning', desc: 'Fast, clean, guaranteed.', price: 'from $95' },
    { name: 'Water heaters', desc: 'Same-week install.', price: '$1,200+' },
  ],
  about: 'Family-run since 2012.\n\nWe answer the phone.',
  testimonials: [{ quote: 'Showed up on time and fixed it.', name: 'Maria G.' }],
  paletteId: '',
  established: '2012',
  license: 'NJ Lic. #12345',
};

const renderTpl = (tpl, data) =>
  render(
    <React.Suspense fallback={<div>loading…</div>}>
      <tpl.Component data={data} />
    </React.Suspense>
  );

describe('template registry', () => {
  test('exposes five templates with the contract fields', () => {
    expect(TEMPLATES).toHaveLength(5);
    expect(TEMPLATES.map((t) => t.id)).toEqual(
      ['trades', 'dining', 'wellness', 'professional', 'retail']
    );
    for (const t of TEMPLATES) {
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.businessTypes.length).toBeGreaterThan(0);
      expect(t.palettes).toHaveLength(3);
      for (const p of t.palettes) {
        expect(p.id).toBeTruthy();
        expect(p.label).toBeTruthy();
        expect(p.swatches).toHaveLength(3);
      }
      expect(t.Component).toBeTruthy();
    }
  });

  test('getTemplate resolves ids and nulls unknowns', () => {
    expect(getTemplate('dining')?.label).toBe('Dining');
    expect(getTemplate('nope')).toBeNull();
  });

  test('custom builds are registered, flagged, and resolvable — but never in the picker', () => {
    // The picker renders TEMPLATES; a custom build appearing there would offer
    // one client's hand-made site as if it were a reusable look.
    const tplIds = TEMPLATES.map((t) => t.id);
    for (const c of CUSTOM_SITES) {
      expect(c.custom).toBe(true);
      expect(tplIds).not.toContain(c.id);
      expect(c.label).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.palettes.length).toBeGreaterThan(0);
      expect(c.Component).toBeTruthy();
      // …but it still resolves, or the editor preview / preview link / the
      // client's own domain would all render nothing.
      expect(getTemplate(c.id)).toBe(c);
    }
    expect(ALL_SITE_LOOKS).toHaveLength(TEMPLATES.length + CUSTOM_SITES.length);
  });

  test('Todd Reuben is the custom build on file, seeded from his intake', () => {
    const todd = getTemplate('custom-todd-reuben');
    expect(todd).toBeTruthy();
    // Nate's contact values win over the ones on the (older) letterhead.
    expect(todd.seedData.phone).toBe('(802) 356-9414');
    expect(todd.seedData.email).toBe('scottiereuben@gmail.com');
    expect(todd.seedData.testimonials).toEqual([]);
    // He posts no hours; the default Mon–Fri row must not survive for him.
    expect(todd.seedData.hours).toEqual([]);
    // Nothing invented: no price anywhere, and the only year is the one his
    // CV states plainly ("1989–present Artist, Sculptor").
    for (const s of todd.seedData.services) expect(s.price).toBe('');
    expect(todd.seedData.established).toBe('1989');
    expect(todd.seedData.license).toBeUndefined();
  });

  // His biography arrived as a 3-page letter. These pin the specific lines that
  // were held back from it — each one was a real call, and each is the kind of
  // thing a later "let's use more of the bio" edit would quietly undo.
  describe('Todd Reuben — what the bio copy may and may not say', () => {
    const about = () => getTemplate('custom-todd-reuben').seedData.about;

    test('speaks as him, in his own voice', () => {
      expect(about()).toMatch(/\bI\b/);
      // The letter is third-person ("Mr. Reuben", "Todd Reuben is a graduate").
      // One escaped third-person reference and the whole block reads as though
      // an agency wrote the page about him.
      expect(about()).not.toMatch(/Mr\. Reuben|Todd Reuben is|his sculptures/i);
    });

    test('keeps the facts that earn their place', () => {
      const a = about();
      expect(a).toContain('Roy Gussow');          // the one checkable credential
      expect(a).toContain('1982');                // apprenticeship, as fixed dates
      expect(a).toContain('1989');
      expect(a).toContain('Columbia University');
      expect(a).toContain('chromium oxide');      // the process, kept concrete
      expect(a).toContain('twelve successive passes');
      expect(a).toContain('immutable');
    });

    test('makes no durability promise', () => {
      // "it does not tarnish or rust, retaining its quality forever" is a
      // warranty he never meant to give — stainless pits, and a Vermont winter
      // of road salt is exactly that exposure. Only "does not tarnish" survives.
      expect(about()).toContain('does not tarnish');
      expect(about()).not.toMatch(/rust|forever|never needs|maintenance-free/i);
    });

    test('states no spec it cannot stand behind, and no claim about anyone else', () => {
      // 11-gauge stainless is ~0.120", not the 1/8" the letter equates it to.
      expect(about()).not.toMatch(/\b11 gauge\b|\bgauge\b/i);
      expect(about()).toContain('an eighth of an inch');
      // "renowned" is his word for his teacher inside a private letter; on a
      // public page it becomes us asserting a third party's stature.
      expect(about()).not.toMatch(/renowned|famous|celebrated|master/i);
    });

    test('claims no gallery representation, membership or award', () => {
      const a = about();
      // His CV files every gallery under "Former" — the site must not imply
      // current representation, and past-tensing four names still reads as it.
      for (const g of ['Gallery North Star', 'Simon Gallery', 'Zaccheo', 'Fine Art Firm']) {
        expect(a).not.toContain(g);
      }
      expect(a).not.toMatch(/represented by|on view at|exhibit|award|prize|juried/i);
      expect(a).not.toMatch(/Southern Vermont Artists|Vermont Arts Council/i);
    });

    test('leaks nothing private from the letterhead', () => {
      const seed = JSON.stringify(getTemplate('custom-todd-reuben').seedData);
      expect(seed).not.toContain('100 Brown Rd');      // his home workshop
      expect(seed).not.toContain('1956');              // date of birth
      expect(seed).not.toContain('Rochester');         // place of birth
      expect(seed).not.toContain('457-4172');          // the letter's phone
      expect(seed).not.toContain('457-4903');          // fax
      expect(seed).not.toContain('toddreuben56');      // the letter's email
    });
  });

  // He confirmed he is taking commissions AND has finished pieces for sale, so
  // those two are the structure of the page rather than rows in a service list.
  describe('Todd Reuben — the two offers are the spine', () => {
    const todd = () => getTemplate('custom-todd-reuben');

    test('exactly two offers, both open right now', () => {
      const names = todd().seedData.services.map((s) => s.name);
      expect(names).toEqual(['Commissioned work', 'Available pieces']);
    });

    test('they render as equal panels, not a numbered ledger', async () => {
      const { container } = renderTpl(todd(), { businessName: 'Todd Reuben Sculptor', ...todd().seedData });
      await screen.findAllByText(/Todd Reuben Sculptor/);
      expect(container.querySelectorAll('.jpwtr-offer').length).toBe(2);
      // The old 01/02/03 numerals are gone on purpose: they read as a trades
      // price list beside artwork, and his sculptures are titled BY NUMBER, so
      // the only numerals on the page must not be labelling services.
      expect(container.querySelector('.jpwtr-crow')).toBeNull();
      expect(screen.queryByText('01')).toBeNull();
      expect(screen.queryByText('02')).toBeNull();
    });

    test('shipping makes no promise his answers never supported', () => {
      const seed = JSON.stringify(todd().seedData);
      expect(seed).not.toMatch(/arranged anywhere|worldwide delivery|we ship anywhere/i);
    });
  });

  // The whole point of the work grid is that it shows HIS sculptures.
  describe('Todd Reuben — the work grid never invents a sculpture', () => {
    const todd = () => getTemplate('custom-todd-reuben');

    test('with no photos there is no work grid, and nothing points at one', async () => {
      const { container } = renderTpl(todd(), { businessName: 'Todd Reuben Sculptor', ...todd().seedData });
      await screen.findAllByText(/Todd Reuben Sculptor/);
      // The crafted tile is a texture on a plumber's page. Here it would be a
      // drawing of a sculpture in a grid headed "Selected work" — an invented
      // artwork, which is the one thing an artist's portfolio must never show.
      expect(container.querySelectorAll('.jpw-ph').length).toBe(0);
      expect(container.querySelector('#work')).toBeNull();
      expect(screen.queryByText(/Selected work/i)).toBeNull();
      // …and no nav link or hero button left pointing at the missing section.
      expect(container.querySelector('a[href="#work"]')).toBeNull();
      expect(screen.queryByText(/See the work/i)).toBeNull();
    });

    test('the six named pieces are seeded, with no photos guessed for them', () => {
      const works = todd().seedData.works;
      expect(works.map((w) => w.title)).toEqual(['SC 265', 'SC 262', 'SC 220', 'SC 261', 'SC 230', 'SC 203']);
      expect(works.find((w) => w.title === 'SC 261').note).toBe('Gold plated');
      // Every photo empty: the image files are named to match these numbers, so
      // whoever uploads does the pairing. Guessing which photograph is which
      // sculpture is the one mistake this structure exists to prevent.
      for (const w of works) expect(w.photo).toBe('');
      for (const w of works) expect(w.price).toBe('');
    });

    test('a titled row with no photo puts nothing on the page', async () => {
      const { container } = renderTpl(todd(), { businessName: 'Todd Reuben Sculptor', ...todd().seedData });
      await screen.findAllByText(/Todd Reuben Sculptor/);
      // Six seeded rows, no photographs yet — the work section must stay away
      // entirely rather than showing six captioned empty frames.
      expect(container.querySelectorAll('.jpwtr-work').length).toBe(0);
      expect(container.querySelector('#work')).toBeNull();
      expect(screen.queryByText('SC 265')).toBeNull();
    });

    test('a piece is captioned only with what he actually said', async () => {
      const works = [
        { photo: 'https://example.com/1.jpg', title: 'No. 270', note: 'Stainless steel, 34 in.', price: '$4,800' },
        { photo: 'https://example.com/2.jpg', title: '', note: '', price: '' },
      ];
      const { container } = renderTpl(todd(), { businessName: 'Todd Reuben Sculptor', ...todd().seedData, works });
      await screen.findAllByText(/Todd Reuben Sculptor/);
      expect(container.querySelectorAll('.jpwtr-work').length).toBe(2);
      expect(screen.getByText('No. 270')).toBeTruthy();
      expect(screen.getByText('$4,800')).toBeTruthy();
      // The uncaptioned piece gets NO caption block — not a blank line, not a
      // placeholder. A photograph standing on its own is the honest state.
      expect(container.querySelectorAll('.jpwtr-cap-work').length).toBe(1);
    });

    test('each piece gets its own alt text', async () => {
      const works = [
        { photo: 'https://example.com/1.jpg', title: 'No. 270' },
        { photo: 'https://example.com/2.jpg', title: '' },
      ];
      const { container } = renderTpl(todd(), { businessName: 'Todd Reuben Sculptor', ...todd().seedData, works });
      await screen.findAllByText(/Todd Reuben Sculptor/);
      const alts = [...container.querySelectorAll('.jpw-ph img')].map((i) => i.getAttribute('alt'));
      // Identical alt on every plate is not a catalogue; a titled piece is
      // named, an untitled one is at least numbered in the set.
      expect(new Set(alts).size).toBe(alts.length);
      expect(alts[0]).toContain('No. 270');
      expect(alts[1]).toMatch(/2 of 2/);
    });

    test('the plain photo list still renders for a site built before works existed', async () => {
      const { container } = renderTpl(todd(), {
        businessName: 'Todd Reuben Sculptor', ...todd().seedData,
        photos: { hero: '', gallery: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] },
      });
      await screen.findAllByText(/Todd Reuben Sculptor/);
      expect(container.querySelectorAll('.jpw-ph').length).toBe(2);
      expect(container.querySelectorAll('.jpwtr-cap-work').length).toBe(0);
    });

    test('his real photos bring the whole section back', async () => {
      const { container } = renderTpl(todd(), {
        businessName: 'Todd Reuben Sculptor',
        ...todd().seedData,
        photos: { hero: '', gallery: ['https://example.com/1.jpg', 'https://example.com/2.jpg'] },
      });
      await screen.findAllByText(/Todd Reuben Sculptor/);
      expect(container.querySelectorAll('.jpw-ph').length).toBe(2);
      expect(container.querySelector('#work')).toBeTruthy();
      expect(container.querySelector('a[href="#work"]')).toBeTruthy();
    });
  });

  test('a custom seed never overrides the name/type typed in the dialog', () => {
    // seedData spreads OVER the base seed, so a stray businessName/businessType
    // in a custom entry would silently beat what the owner just typed.
    for (const c of CUSTOM_SITES) {
      expect(c.seedData?.businessName).toBeUndefined();
      expect(c.seedData?.businessType).toBeUndefined();
    }
  });
});

// Every look — templates AND custom builds — holds the same rendering contract.
describe.each(ALL_SITE_LOOKS.map((t) => [t.id, t]))('%s', (id, tpl) => {
  test('renders full data: name, services, hours, quote, tel/mailto links', async () => {
    const { container } = renderTpl(tpl, { ...FULL_DATA, paletteId: tpl.palettes[1].id });
    // Business name shows (nav + footer at minimum).
    expect((await screen.findAllByText(/Ironside Plumbing/)).length).toBeGreaterThan(0);
    // Services + hours + testimonial content made it in.
    expect(screen.getAllByText(/Drain cleaning/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/8:00 AM – 6:00 PM/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Showed up on time/).length).toBeGreaterThan(0);
    // Contact links are real.
    expect(container.querySelector('a[href="tel:6095550143"]')).toBeTruthy();
    expect(container.querySelector('a[href="mailto:office@ironside.example"]')).toBeTruthy();
    // Every anchor nav link points at a section that exists.
    for (const a of container.querySelectorAll('a[href^="#"]')) {
      const target = a.getAttribute('href').slice(1);
      expect(container.querySelector(`[id="${target}"]`)).toBeTruthy();
    }
    // A hover-styled CTA exists (buttons must have hover states — pinned by
    // the scoped stylesheet containing :hover rules).
    expect(container.querySelector('style').textContent).toMatch(/:hover/);
  });

  test('renders empty data without crashing or empty shells', async () => {
    const { container } = renderTpl(tpl, {});
    // Falls back to the placeholder business name.
    expect((await screen.findAllByText(/Your Business/)).length).toBeGreaterThan(0);
    // No content → no content sections: services/menu/offerings, testimonials,
    // and hours headings must NOT render as empty shells.
    expect(container.querySelectorAll('h3').length).toBe(0); // service/quote cards use h3
    expect(container.querySelector('blockquote')).toBeNull();
    // No dangling tel:/mailto: links to nowhere.
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  test('unknown paletteId falls back to the first palette', async () => {
    renderTpl(tpl, { ...FULL_DATA, paletteId: 'not-a-palette' });
    expect((await screen.findAllByText(/Ironside Plumbing/)).length).toBeGreaterThan(0);
  });

  test('any default photo tile carries its crafted underlayer', async () => {
    const { container } = renderTpl(tpl, FULL_DATA); // no data.photos → defaults
    await screen.findAllByText(/Ironside Plumbing/);
    // A look MAY ship no default gallery at all (see the custom-build test
    // below — an invented artwork is worse than an empty page). What it may
    // never do is render a tile without the crafted underlayer behind it.
    const tiles = container.querySelectorAll('.jpw-ph');
    if (tiles.length) {
      expect(container.querySelectorAll('.jpw-ph-fx').length).toBeGreaterThan(0);
      // A real default src must be the curated Unsplash one; the alternative is
      // an empty src that collapses to the crafted tile (e.g. Trades).
      const img = container.querySelector('.jpw-ph img');
      if (img && img.getAttribute('src')) {
        expect(img.getAttribute('src')).toContain('images.unsplash.com');
      }
    }
  });

  test('owner photo URLs override the curated defaults', async () => {
    const { container } = renderTpl(tpl, {
      ...FULL_DATA,
      photos: { hero: 'https://example.com/hero.jpg', gallery: ['https://example.com/g1.jpg'] },
    });
    await screen.findAllByText(/Ironside Plumbing/);
    // The hero lands somewhere (CSS background stack or an <img>)…
    expect(container.innerHTML).toContain('https://example.com/hero.jpg');
    // …and every fail-safe tile now shows owner photos, none of the defaults.
    const srcs = [...container.querySelectorAll('.jpw-ph img')].map((i) => i.getAttribute('src'));
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) expect(src).toMatch(/^https:\/\/example\.com\//);
  });

  test('a failed photo collapses to the crafted tile, not a broken glyph', async () => {
    const { container } = renderTpl(tpl, FULL_DATA);
    await screen.findAllByText(/Ironside Plumbing/);
    const img = container.querySelector('.jpw-ph img');
    // Looks that ship crafted defaults have no <img> to fail in the first
    // place (an empty src would paint alt text over the crafted scene, so
    // none is rendered); the ones with stock defaults get theirs killed.
    if (img) fireEvent.error(img);
    // The wrapper flags it, carries no img, and keeps the crafted fx. Skipped
    // entirely for a look that ships no default gallery — there is no tile.
    const failed = container.querySelector('.jpw-ph-noimg');
    if (container.querySelector('.jpw-ph')) {
      expect(failed).toBeTruthy();
      expect(failed.querySelector('img')).toBeNull();
      expect(failed.querySelector('.jpw-ph-fx')).toBeTruthy();
    }
  });

  test('an empty photo slot renders no <img> at all', async () => {
    const { container } = renderTpl(tpl, { ...FULL_DATA, photos: { hero: '', gallery: [''] } });
    await screen.findAllByText(/Ironside Plumbing/);
    // Empty slots fall back to the template's own defaults; whatever renders,
    // no tile may carry a src-less img (that paints alt text / a broken glyph).
    for (const el of container.querySelectorAll('.jpw-ph img')) {
      expect(el.getAttribute('src')).toBeTruthy();
    }
  });
});

// ── topicOf: businessType → topical kind + word (drives crafted defaults) ─────
describe('topicOf', () => {
  test('resolves common trades to their kind + display word', () => {
    expect(topicOf('Emergency Plumbing')).toEqual({ kind: 'plumbing', word: 'Plumbing' });
    expect(topicOf('Plumber')).toEqual({ kind: 'plumbing', word: 'Plumbing' });
    expect(topicOf('HVAC & Heating').kind).toBe('hvac');
    expect(topicOf('Licensed Electrician').kind).toBe('electrical');
    expect(topicOf('Roofing Co').kind).toBe('roofing');
    expect(topicOf('Green Thumb Landscaping').kind).toBe('landscaping');
  });

  test('most-specific keyword wins (barber before salon, pizza before bar)', () => {
    expect(topicOf('Downtown Barbershop').kind).toBe('barber');
    expect(topicOf('Hair Salon').kind).toBe('salon');
    expect(topicOf('Tony\'s Pizzeria').kind).toBe('pizza');
    expect(topicOf('Corner Bar & Grill').kind).toBe('bar');
  });

  test('unknown / empty falls back to generic (no crash), word echoes input', () => {
    expect(topicOf('Underwater Basket Weaving')).toEqual({ kind: 'generic', word: 'Underwater Basket Weaving' });
    expect(topicOf('')).toEqual({ kind: 'generic', word: '' });
    expect(topicOf(null)).toEqual({ kind: 'generic', word: '' });
    expect(topicOf(undefined)).toEqual({ kind: 'generic', word: '' });
  });
});
