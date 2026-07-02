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

// ── Reply-triage vocabulary ───────────────────────────────────────────────────
// Mirrors services/replyTriage.js CATEGORIES / STATUSES (the backend is the source
// of truth for classification) — keep in sync.
export const TRIAGE_CATEGORIES = [
  'hot_lead', 'needs_response', 'asked_pricing', 'asked_mockups',
  'follow_up_later', 'not_interested', 'wrong_person', 'unsubscribe', 'bounce_auto_ignore',
];
export const TRIAGE_CATEGORY_META = {
  hot_lead:           { label: 'Hot lead',        color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  asked_pricing:      { label: 'Asked pricing',   color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  asked_mockups:      { label: 'Asked mockups',   color: '#2dd4bf', bg: 'rgba(45,212,191,0.14)' },
  needs_response:     { label: 'Needs response',  color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  follow_up_later:    { label: 'Follow up later', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  wrong_person:       { label: 'Wrong person',    color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  not_interested:     { label: 'Not interested',  color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  unsubscribe:        { label: 'Unsubscribe',     color: '#f87171', bg: 'rgba(248,113,113,0.14)' },
  bounce_auto_ignore: { label: 'Bounce / auto',   color: '#6b7280', bg: 'rgba(107,114,128,0.16)' },
};
export const triageCategoryMeta = (c) => TRIAGE_CATEGORY_META[c] || TRIAGE_CATEGORY_META.needs_response;

// Mirrors services/replyTriage.js STATUSES — keep in sync.
export const TRIAGE_STATUSES = [
  'new', 'handled', 'follow_up', 'mockup_requested', 'quote_requested', 'not_interested', 'do_not_contact', 'ignored',
];
export const TRIAGE_STATUS_META = {
  new:              { label: 'New',            color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  handled:          { label: 'Handled',        color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  follow_up:        { label: 'Follow-up',      color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  mockup_requested: { label: 'Mockup req.',    color: '#2dd4bf', bg: 'rgba(45,212,191,0.14)' },
  quote_requested:  { label: 'Quote req.',     color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  not_interested:   { label: 'Not interested', color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  do_not_contact:   { label: 'Do not contact', color: '#f87171', bg: 'rgba(248,113,113,0.14)' },
  ignored:          { label: 'Ignored',        color: '#6b7280', bg: 'rgba(107,114,128,0.16)' },
};
export const triageStatusMeta = (s) => TRIAGE_STATUS_META[s] || TRIAGE_STATUS_META.new;

// The Follow-Up Command Center buckets (order = priority top-to-bottom). Mirrors
// the buckets GET /api/triage/worklist returns.
export const WORKLIST_BUCKETS = [
  { key: 'needsResponse',    label: 'Needs a response',              hint: 'New buyer replies to answer — buying signals first',    tone: '#60a5fa' },
  { key: 'quoteRequested',   label: 'Quote requested',              hint: 'They asked about pricing — send a quote',                tone: '#a78bfa' },
  { key: 'mockupRequested',  label: 'Mockup requested',             hint: 'They asked to see a mockup / proof',                     tone: '#2dd4bf' },
  { key: 'followUp',         label: 'Follow up',                    hint: 'You flagged these to circle back on',                    tone: '#fbbf24' },
  { key: 'untriagedReplied', label: 'Marked replied — not triaged', hint: 'You marked these replied but haven’t triaged the reply',  tone: '#4ade80' },
];

// The status actions offered on a reply row (menu label + the status it sets), in
// workflow order. 'do_not_contact' also flips the matched company's doNotEmail and
// stops its active sequences on the backend (the existing unsubscribe/bounce path).
export const TRIAGE_ACTIONS = [
  { status: 'handled',          label: 'Mark handled' },
  { status: 'follow_up',        label: 'Follow-up needed' },
  { status: 'mockup_requested', label: 'Mockup requested' },
  { status: 'quote_requested',  label: 'Quote requested' },
  { status: 'not_interested',   label: 'Not interested' },
  { status: 'do_not_contact',   label: 'Do not contact' },
  { status: 'ignored',          label: 'Ignore' },
];

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
