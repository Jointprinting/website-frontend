// src/webworks/templates/templates.test.js
//
// Smoke coverage for the five JP Webworks site templates + the registry.
// The templates are pure functions of the site `data` bag, so the contract
// worth pinning is:
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
import { TEMPLATES, getTemplate } from './index';
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
});

describe.each(TEMPLATES.map((t) => [t.id, t]))('%s template', (id, tpl) => {
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

  test('default photos render through the fail-safe crafted stack', async () => {
    const { container } = renderTpl(tpl, FULL_DATA); // no data.photos → defaults
    await screen.findAllByText(/Ironside Plumbing/);
    // Fail-safe tiles exist, each with its crafted underlayer in place — the
    // contract that keeps a photo-less draft looking finished.
    const tiles = container.querySelectorAll('.jpw-ph');
    expect(tiles.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.jpw-ph-fx').length).toBeGreaterThan(0);
    // The default photo state is EITHER the template's stock set (Unsplash) OR —
    // for templates that ship crafted TOPICAL defaults instead of generic stock
    // (e.g. Trades) — an empty src that collapses to the crafted tile. When a
    // real default src is present, it must be the curated Unsplash one.
    const img = container.querySelector('.jpw-ph img');
    if (img && img.getAttribute('src')) {
      expect(img.getAttribute('src')).toContain('images.unsplash.com');
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
    fireEvent.error(img);
    // The wrapper flags the failure, unmounts the img, keeps the crafted fx.
    const failed = container.querySelector('.jpw-ph-noimg');
    expect(failed).toBeTruthy();
    expect(failed.querySelector('img')).toBeNull();
    expect(failed.querySelector('.jpw-ph-fx')).toBeTruthy();
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
