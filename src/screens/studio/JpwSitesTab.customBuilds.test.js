// The Websites tab's wiring for CUSTOM_SITES — the hand-built one-off client
// sites (see src/webworks/templates/index.js).
//
// Worth pinning because the whole point of a custom build is a split that is
// easy to get backwards: it must be creatable from the New Site dialog (or the
// client's site can never be built at all), but must NOT appear in the landing
// gallery, which is the "start from a template" kit. A refactor that maps the
// wrong array in either place breaks one side silently.

import * as React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import JpwSitesTab from './JpwSitesTab';
import { TEMPLATES, CUSTOM_SITES } from '../../webworks/templates';

// Factory mock so the real (ESM-only) axios is never loaded by jest.
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const renderTab = async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes('ai-usage')) return Promise.resolve({ data: { configured: false } });
    if (url.includes('subscriptions')) return Promise.resolve({ data: { subscriptions: [] } });
    return Promise.resolve({ data: { sites: [] } });
  });
  const utils = render(<JpwSitesTab token="t" />);
  await waitFor(() => expect(screen.getAllByText('Trades').length).toBeGreaterThan(0));
  return utils;
};

const openDialog = async () => {
  fireEvent.click(screen.getAllByText('Trades')[0]);
  await waitFor(() => expect(screen.getByText(/New client site/i)).toBeTruthy());
  return screen.getByRole('dialog');
};

beforeEach(() => jest.clearAllMocks());

test('the landing gallery offers only the templates, never a custom build', async () => {
  const { container } = await renderTab();
  const text = container.textContent;
  for (const t of TEMPLATES) expect(text).toContain(t.label);
  // A client's hand-made site must not headline the gallery as a reusable look.
  for (const c of CUSTOM_SITES) expect(text).not.toContain(c.label);
});

test('the New Site dialog offers custom builds under their own heading', async () => {
  await renderTab();
  const dialog = await openDialog();
  expect(within(dialog).getByText('Custom builds')).toBeTruthy();
  for (const c of CUSTOM_SITES) expect(within(dialog).getByText(c.label)).toBeTruthy();
});

test('creating from a custom build posts its id and its seeded content', async () => {
  const todd = CUSTOM_SITES.find((c) => c.id === 'custom-todd-reuben');
  axios.post.mockResolvedValue({ data: { site: { _id: '1', name: 'X', slug: 'x', status: 'draft', templateId: todd.id, data: {} } } });

  await renderTab();
  const dialog = await openDialog();
  fireEvent.click(within(dialog).getByText(todd.label));

  // Business type comes from the custom build's own list, not a template's.
  fireEvent.mouseDown(within(dialog).getByLabelText(/Business type/i));
  fireEvent.click(await screen.findByText(todd.businessTypes[0]));
  fireEvent.change(within(dialog).getByLabelText(/Business name/i), {
    target: { value: 'Todd Reuben Sculptor' },
  });
  fireEvent.click(within(dialog).getByText(/Create & open editor/i));

  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  // Let the create settle (dialog closes, editor opens) so the trailing state
  // updates land inside the test rather than after it.
  await waitFor(() => expect(screen.queryByText(/New client site/i)).toBeNull());

  const [, body] = axios.post.mock.calls[0];
  expect(body.templateId).toBe(todd.id);
  // The seed lands in `data`, so the editor opens filled in from his intake…
  expect(body.data.phone).toBe(todd.seedData.phone);
  expect(body.data.services).toHaveLength(todd.seedData.services.length);
  // …without the seed clobbering what was just typed in the dialog.
  expect(body.data.businessName).toBe('Todd Reuben Sculptor');
  expect(body.data.businessType).toBe(todd.businessTypes[0]);
});
