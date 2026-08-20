// src/screens/studio/_shared.projectCard.test.js
//
// GET /api/orders/projects returns a CARD — the confirmation, quote lines and
// activity log are summarised server-side so the board stops downloading every
// order's artwork. A full Order document still arrives from GET /orders/:id,
// from a PUT and from POST /orders, so the SAME call sites have to read both.
//
// These pin that: card and document must produce identical answers, and the
// discriminator has to be the summary's presence — never a truthiness test that
// would read "no confirmation" and "not loaded yet" as the same thing.

import {
  isProjectCard, projectHasConfirmation, projectRevenue, projectQuoteLineCount,
  confRevenue,
} from './_shared';

// One item: qty units at unitPrice each, plus the internal cost/unit.
const conf = (qty, unitPrice, extra = {}) => ({
  items: [{ description: 'Tee', unitCost: 7.75, sizes: [{ label: 'OS', qty, unitPrice }] }],
  ...extra,
});

describe('isProjectCard', () => {
  test('a card is identified by its summary, not by having no confirmation', () => {
    expect(isProjectCard({ _id: 'a', hasConfirmationItems: false })).toBe(true);
    expect(isProjectCard({ _id: 'a', hasConfirmationItems: true })).toBe(true);
  });
  test('a full document is not a card', () => {
    expect(isProjectCard({ _id: 'a', confirmation: conf(10, 20) })).toBe(false);
    expect(isProjectCard({ _id: 'a', confirmation: { items: [] } })).toBe(false);
  });
  test('nothing is not a card', () => {
    expect(isProjectCard(null)).toBe(false);
    expect(isProjectCard(undefined)).toBe(false);
  });
});

describe('projectHasConfirmation', () => {
  test('reads the card summary', () => {
    expect(projectHasConfirmation({ hasConfirmationItems: true })).toBe(true);
    expect(projectHasConfirmation({ hasConfirmationItems: false })).toBe(false);
  });
  test('falls back to the subtree on a full document', () => {
    expect(projectHasConfirmation({ confirmation: conf(10, 20) })).toBe(true);
    expect(projectHasConfirmation({ confirmation: { items: [] } })).toBe(false);
    expect(projectHasConfirmation({})).toBe(false);
  });
});

describe('projectRevenue', () => {
  test('card and document agree to the cent on the same order', () => {
    // The board used to compute this off the confirmation itself. It now reads
    // the server's figure — which comes from the same grand total — so the two
    // shapes must not differ by a penny.
    const c = conf(100, 12.92, { customLines: [{ label: 'Card fee', percent: 3.5 }] });
    const asDocument = { confirmation: c, totalValue: 0 };
    const asCard = { hasConfirmationItems: true, confirmationRevenue: confRevenue(c), totalValue: 0 };
    expect(projectRevenue(asCard)).toBe(projectRevenue(asDocument));
    expect(projectRevenue(asCard)).toBe(confRevenue(c));
  });

  test('with no confirmation both shapes fall back to the stored totalValue', () => {
    expect(projectRevenue({ hasConfirmationItems: false, totalValue: 900 })).toBe(900);
    expect(projectRevenue({ confirmation: { items: [] }, totalValue: 900 })).toBe(900);
  });

  test('a confirmation supersedes a stale totalValue in both shapes', () => {
    const c = conf(10, 20);                       // $200
    expect(projectRevenue({ hasConfirmationItems: true, confirmationRevenue: 200, totalValue: 111 })).toBe(200);
    expect(projectRevenue({ confirmation: c, totalValue: 111 })).toBe(200);
  });

  test('nothing is worth nothing', () => {
    expect(projectRevenue(null)).toBe(0);
    expect(projectRevenue({})).toBe(0);
  });
});

describe('projectQuoteLineCount', () => {
  test('reads the count off a card and the array off a document', () => {
    expect(projectQuoteLineCount({ hasConfirmationItems: false, quoteLineCount: 3 })).toBe(3);
    expect(projectQuoteLineCount({ quoteLines: [{}, {}] })).toBe(2);
    expect(projectQuoteLineCount({})).toBe(0);
    expect(projectQuoteLineCount(null)).toBe(0);
  });

  test('a card with lines is never mistaken for a project without one', () => {
    // This is the regression that would put "Start quote" on the right-click
    // menu of a project that already has a three-option pitch.
    const card = { hasConfirmationItems: false, quoteLineCount: 4, quoteGroupCount: 2 };
    expect(projectQuoteLineCount(card) > 0).toBe(true);
  });
});
