// src/screens/studio/_shared.merchTitle.test.js
//
// Pins deriveMerchTitle — the project → mockup TITLE rule ("<Company> Merch").
// This is the headline printed at the top of a client's mockup sheet, so the
// stakes are a client-facing document: the Mockup Lab used to fill it ONLY from
// the Project dropdown's onChange, which meant a lab opened with the project
// already attached (the Order Tracker's mockup button) exported a sheet with no
// headline at all. One shared rule now feeds both paths. Run via:  CI=true npm test

import { deriveMerchTitle } from './_shared';

describe('deriveMerchTitle', () => {
  test('companyName wins — the title is the company\'s merch line', () => {
    expect(deriveMerchTitle('Badger Sportswear', 'Dave Kearns')).toBe('Badger Sportswear Merch');
  });

  test('falls back to the contact name only when there is no company', () => {
    expect(deriveMerchTitle('', 'Dave Kearns')).toBe('Dave Kearns Merch');
    expect(deriveMerchTitle(null, 'Dave Kearns')).toBe('Dave Kearns Merch');
  });

  test('a lone argument works — the pre-attached project only carries one name', () => {
    expect(deriveMerchTitle('Bleu Leaf')).toBe('Bleu Leaf Merch');
  });

  test('no name → EMPTY, never a bare "Merch" on a client sheet', () => {
    expect(deriveMerchTitle('')).toBe('');
    expect(deriveMerchTitle(null)).toBe('');
    expect(deriveMerchTitle(undefined)).toBe('');
    expect(deriveMerchTitle('   ')).toBe('');
    expect(deriveMerchTitle('', '')).toBe('');
  });

  test('trims so the headline never starts with whitespace', () => {
    expect(deriveMerchTitle('  Dredo  ')).toBe('Dredo Merch');
  });

  test('keeps the company name verbatim — punctuation and case are the brand', () => {
    expect(deriveMerchTitle("Joe's Pizza & Co.")).toBe("Joe's Pizza & Co. Merch");
    expect(deriveMerchTitle('MOD Pizza')).toBe('MOD Pizza Merch');
  });

  test('the list\'s "Untitled" fallback still reads as a title, not a blank', () => {
    expect(deriveMerchTitle('Untitled')).toBe('Untitled Merch');
  });

  test('idempotent enough to be safe as a seeded value — same input, same title', () => {
    const once = deriveMerchTitle('Badger Sportswear');
    expect(deriveMerchTitle('Badger Sportswear')).toBe(once);
  });
});
