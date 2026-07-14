// src/screens/studio/crm/_crm.sync.test.js
//
// SYNC GUARD for the CRM constant mirrors. These values exist in BOTH repos —
// backend truth (models/Client.js, controllers/crm.js) and this client mirror —
// and only stay matched by discipline. This test (and its backend twin,
// controllers/__tests__/crmMirrors.test.js) pins BOTH sides to the same agreed
// literals: change one side without the other and one suite goes red.
//
// If a change here is intentional, update the backend, its twin test, and these
// literals together. Same pattern as _shared.confTax.test.js (tax rates).

import {
  CRM_STAGES,
  STAGE_PROBABILITY,
  BOARD_COLUMNS,
  BOARD_CLOSED_COLUMNS,
  BOARD_PROBABILITY,
  DEAL_STAGES,
  dealStageFromOrderStatus,
  isClientFromDeals,
  dealTitle,
} from './_crm';

test('CRM_STAGES mirrors models/Client.js (order matters)', () => {
  expect(CRM_STAGES).toEqual(['lead', 'contacted', 'awaiting_details', 'quoting', 'won', 'customer', 'lost', 'dormant']);
});

test('STAGE_PROBABILITY mirrors controllers/crm.js', () => {
  expect(STAGE_PROBABILITY).toEqual({
    lead: 0.1, contacted: 0.25, awaiting_details: 0.35, quoting: 0.5,
    won: 1, customer: 1, lost: 0, dormant: 0,
  });
});

test('board columns mirror controllers/crm.js (order matters)', () => {
  expect(BOARD_COLUMNS).toEqual(['lead', 'contacted', 'awaiting_details', 'quoting', 'approval', 'production', 'shipped', 'delivered']);
  expect(BOARD_CLOSED_COLUMNS).toEqual(['lost', 'dormant', 'cancelled']);
});

test('BOARD_PROBABILITY mirrors controllers/crm.js', () => {
  expect(BOARD_PROBABILITY).toEqual({
    lead: 0.1, contacted: 0.25, awaiting_details: 0.35, quoting: 0.5, approval: 0.8,
    production: 0.9, shipped: 0.95, delivered: 1,
    lost: 0, dormant: 0, cancelled: 0,
  });
});

test('DEAL_STAGES mirrors models/Deal.js (order matters)', () => {
  expect(DEAL_STAGES).toEqual(['details_needed', 'quoting', 'quote_sent', 'won', 'lost']);
});

test('dealStageFromOrderStatus mirrors models/Deal.js (won is delivery-only)', () => {
  expect(dealStageFromOrderStatus('placed')).toBe('quote_sent');
  expect(dealStageFromOrderStatus('in_production')).toBe('quote_sent');
  expect(dealStageFromOrderStatus('shipped')).toBe('quote_sent');
  expect(dealStageFromOrderStatus('delivered')).toBe('won');
  expect(dealStageFromOrderStatus('cancelled')).toBe('lost');
  expect(dealStageFromOrderStatus('quoted')).toBe('quoting');
  expect(dealStageFromOrderStatus('approved')).toBe('quote_sent');
  expect(dealStageFromOrderStatus('')).toBe('quoting');
});

test('isClientFromDeals — ≥1 non-archived won deal ⇒ client', () => {
  expect(isClientFromDeals([])).toBe(false);
  expect(isClientFromDeals([{ stage: 'details_needed' }, { stage: 'quote_sent' }])).toBe(false);
  expect(isClientFromDeals([{ stage: 'won' }])).toBe(true);
  // An archived won deal doesn't count (mirrors services/dealService.js).
  expect(isClientFromDeals([{ stage: 'won', archived: true }])).toBe(false);
  expect(isClientFromDeals([{ stage: 'lost' }, { stage: 'won' }])).toBe(true);
});

test('dealTitle falls back to order number, then company', () => {
  expect(dealTitle({ title: 'Spring hoodies' })).toBe('Spring hoodies');
  expect(dealTitle({ orderNumber: '138' })).toBe('Order #138');
  expect(dealTitle({ projectNumber: '42' })).toBe('Order #42');
  expect(dealTitle({ companyName: 'Acme Co' })).toBe('Acme Co');
  expect(dealTitle(null)).toBe('Deal');
});
