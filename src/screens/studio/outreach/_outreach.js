// src/screens/studio/outreach/_outreach.js
// Outreach-specific tokens, metadata, and small shared atoms — built on the
// shared "drop" palette (`D`) from ../_shared, same pattern as crm/_crm.js.
// Mirrors of backend constants are marked; keep them in sync.

import * as React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { D, mono } from '../_shared';

// ── Campaign status vocabulary ────────────────────────────────────────────────
// Mirrors models/OutreachCampaign.js CAMPAIGN_STATUSES — keep in sync.
export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'archived'];
export const CAMPAIGN_STATUS_META = {
  draft:    { label: 'Draft',    color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  active:   { label: 'Active',   color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  paused:   { label: 'Paused',   color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  archived: { label: 'Archived', color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
};
export const campaignStatusMeta = (s) => CAMPAIGN_STATUS_META[s] || CAMPAIGN_STATUS_META.draft;

// ── Enrollment status vocabulary ──────────────────────────────────────────────
// Mirrors models/OutreachEnrollment.js ENROLLMENT_STATUSES — keep in sync.
export const ENROLLMENT_STATUS_META = {
  active:       { label: 'In sequence',  color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  replied:      { label: 'Replied',      color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  completed:    { label: 'Ran dry',      color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  unsubscribed: { label: 'Unsubscribed', color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  stopped:      { label: 'Stopped',      color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  failed:       { label: 'Send failed',  color: '#f87171', bg: 'rgba(248,113,113,0.14)' },
};
export const enrollmentStatusMeta = (s) =>
  ENROLLMENT_STATUS_META[s] || { label: s || '—', color: D.muted, bg: 'rgba(255,255,255,0.06)' };

// ── Merge fields ──────────────────────────────────────────────────────────────
// Mirrors buildMergeContext in services/outreachEngine.js — keep in sync.
// Templates support {{field}} and {{field|fallback}} (fallback used when the
// company record doesn't carry the field).
export const MERGE_FIELDS = [
  { token: '{{greeting}}',        hint: 'Smart opener — "Hey Sam," with a name, plain "Hey," without' },
  { token: '{{firstName}}',       hint: 'Contact’s first name (blank when unknown)' },
  { token: '{{companyName}}',     hint: 'The company / shop name' },
  { token: '{{city|your area}}',  hint: 'City parsed from the address' },
  { token: '{{clientName}}',      hint: 'Full contact name' },
];

// Client-side mirror of the backend's renderTemplate (services/outreachEngine.js)
// so the editor previews EXACTLY what will send. Keep in sync.
export function renderTemplate(tpl, ctx = {}) {
  return String(tpl || '').replace(
    /\{\{\s*([A-Za-z][\w]*)\s*(?:\|([^}]*))?\}\}/g,
    (_, key, fallback) => {
      const v = ctx[key];
      const s = v == null ? '' : String(v).trim();
      return s !== '' ? s : String(fallback || '').trim();
    },
  );
}

// The sample company the editor previews against.
export const SAMPLE_CONTEXT = {
  companyName: 'Green Leaf Dispensary',
  clientName: 'Sam Rivera',
  firstName: 'Sam',
  greeting: 'Hey Sam,',
  city: 'Trenton',
};

// The approved 3-touch dispensary sequence — evergreen (no seasonal hook),
// persuasive, and built around the ONE ask that lets Nate quote/mockup: product
// + quantity + design. Short on purpose (cold email converts best well under
// ~120 words). Stops automatically if they reply; touch 3 is a clean exit.
export const DEFAULT_SEQUENCE = [
  {
    offsetDays: 0,
    subject: 'custom merch for {{companyName}}',
    body: `{{greeting}}

I run Joint Printing — we make custom apparel and promo merch for dispensaries: staff tees and hoodies, branded hats, and the counter stuff that moves (lighters, grinders, totes, stickers).

Here's why I'm reaching out: I'll design free mockups with {{companyName}}'s branding so you can see real product before spending a dollar. Shops use them for staff uniforms or a customer drop.

If you're open to it, just reply with:
1. What you're thinking (tees, hoodies, hats, promo items…)
2. A rough quantity (we start at 50 per design)
3. Any logo or art you'd want to see on it

I'll get our artists on the mockups this week — clear pricing up front, always.

— Nate, Joint Printing
jointprinting.com`,
  },
  {
    offsetDays: 3,
    subject: 'free mockups for {{companyName}}?',
    body: `{{greeting}}

Circling back — the offer stands: free, no-obligation mockups of {{companyName}} gear, built around whatever budget you have in mind.

If it helps to see our work first, here's our dispensary promo catalog: https://www.jointprinting.com/catalogs/dispo-promos.pdf

Even a quick "here's our logo, show me hoodies and hats" is enough for me to get started.

— Nate, Joint Printing`,
  },
  {
    offsetDays: 7,
    subject: 'should I close this out?',
    body: `{{greeting}}

I don't want to crowd your inbox, so this is my last note. If branded merch ever lands on the list for {{companyName}} — staff apparel, a customer drop, event giveaways — I'm your guy, and the mockups are always free.

Reply anytime and I'll pick it right back up. Good luck out in {{city|your area}}.

— Nate, Joint Printing
jointprinting.com`,
  },
];

// Region options for the free auto-finder — MIRRORS services/dispensaryFinder.js
// REGIONS (keep in sync). NJ leads; the rest are the staged expansion.
export const FINDER_REGIONS = [
  { id: 'nj', label: 'New Jersey' },
  { id: 'ny', label: 'New York' },
  { id: 'pa', label: 'Pennsylvania' },
  { id: 'ct', label: 'Connecticut' },
  { id: 'de', label: 'Delaware' },
  { id: 'md', label: 'Maryland' },
  { id: 'ma', label: 'Massachusetts' },
];

// ── Shared atoms ──────────────────────────────────────────────────────────────

// Status pill for campaigns/enrollments — same shape as the CRM's StageChip.
export function StatusChip({ meta, size = 'small', sx = {} }) {
  return (
    <Chip
      label={meta.label}
      size={size}
      sx={{
        bgcolor: meta.bg, color: meta.color, fontWeight: 800, fontSize: 11, height: 22,
        border: `1px solid ${meta.color}40`, letterSpacing: 0.2, ...sx,
      }}
    />
  );
}

// One stat block in a summary strip — same look as the CRM Today pills.
export function StatPill({ value, label, tone = D.green }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 96, px: 2, py: 1.4, borderRadius: 2.5,
      bgcolor: D.inset, border: `1px solid ${D.line}`, textAlign: 'center',
    }}>
      <Typography sx={{ ...mono, fontSize: 26, fontWeight: 800, color: tone, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mt: 0.6 }}>
        {label}
      </Typography>
    </Box>
  );
}
