// src/common/priceIncludes.test.js
//
// The approval page said "every price is all-in per unit" and stopped. The owner
// read that on his own client-facing page: "the copy probably needs work cause I
// don't think it says it includes shipping."
//
// The facts are derived server-side from the quote's own lines; these cover the
// reading of them — in particular WHEN to stay quiet, which is the half that
// keeps the page from making a promise the quote can't keep.

import { priceCoverParts, priceCoverSentence, worthShowingIncludes } from './priceIncludes';

describe('priceCoverSentence', () => {
  test('names everything the quote actually backs', () => {
    expect(priceCoverSentence({ setup: true, shipping: true }))
      .toBe('the blanks, printing, screens & setup and shipping to you');
  });

  test('drops what the quote does not back', () => {
    expect(priceCoverSentence({ setup: true, shipping: false }))
      .toBe('the blanks, printing and screens & setup');
    expect(priceCoverSentence({ setup: false, shipping: true }))
      .toBe('the blanks, printing and shipping to you');
  });

  test('never claims shipping on its own initiative', () => {
    // The regression that matters: a page that says "shipping included" over a
    // quote that never priced freight.
    expect(priceCoverSentence({})).not.toContain('shipping');
    expect(priceCoverSentence(null)).not.toContain('shipping');
  });
});

describe('worthShowingIncludes', () => {
  test('stays quiet when there is nothing to add', () => {
    // "the blanks and printing" is true of every quote ever written and earns
    // nobody's trust — so the strip does not appear at all.
    expect(worthShowingIncludes({ setup: false, shipping: false, turnaroundWeeks: 0 })).toBe(false);
    expect(worthShowingIncludes(null)).toBe(false);
  });

  test('appears as soon as the quote backs something real', () => {
    expect(worthShowingIncludes({ shipping: true })).toBe(true);
    expect(worthShowingIncludes({ setup: true })).toBe(true);
  });

  test('a stated lead time alone is worth saying', () => {
    expect(worthShowingIncludes({ turnaroundWeeks: 3 })).toBe(true);
  });
});
