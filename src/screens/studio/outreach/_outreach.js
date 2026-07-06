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

// ── Lead verticals ────────────────────────────────────────────────────────────
// Which business type a campaign targets — the free finder hunts it and the
// campaign only enrolls its tagged pool. MIRRORS services/leadVerticals.js on the
// backend (keep the ids/labels in sync). The overview API also sends the live
// list (overview.verticals); this is the fallback + label lookup.
export const LEAD_VERTICALS = [
  { id: 'dispensary', label: 'Dispensaries', short: 'dispensaries', isDefault: true },
  { id: 'medical', label: 'Medical dispensaries', short: 'medical dispensaries' },
  { id: 'brewery', label: 'Breweries', short: 'breweries' },
  { id: 'smoke-vape', label: 'Smoke, Vape & Bodegas', short: 'smoke/vape shops', experimental: true },
];
export const DEFAULT_VERTICAL_ID = 'dispensary';
export const verticalMeta = (id) =>
  LEAD_VERTICALS.find((v) => v.id === id) || LEAD_VERTICALS[0];

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
  'follow_up_later', 'not_interested', 'wrong_person', 'unsubscribe',
  'auto_reply_ooo', 'bounce_auto_ignore',
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
  auto_reply_ooo:     { label: 'Out of office',   color: '#818cf8', bg: 'rgba(129,140,248,0.14)' },
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
  { token: '{{state|dispensary}}', hint: 'US state parsed from the address (e.g. NJ)' },
  { token: '{{clientName}}',      hint: 'Full contact name' },
  { token: '{{senderName}}',      hint: 'Who the email signs off as (set on the API)' },
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

// Mirror of services/outreachContent.js (hashStr + applySpintax) — so the editor
// preview resolves {a|b|c} spintax the exact way a real send will. Keep in sync.
export function hashStr(s) {
  let h = 2166136261;
  const str = String(s == null ? '' : s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Single-brace guard (lookbehind/lookahead) so a {{merge|fallback}} token is
// never treated as a spin group. Mirrors services/outreachContent.js.
const SPIN_RE = /(?<!\{)\{([^{}]*\|[^{}]*)\}(?!\})/g;
export function applySpintax(tpl, seed = '') {
  let i = 0;
  return String(tpl == null ? '' : tpl).replace(SPIN_RE, (_, group) => {
    const opts = group.split('|');
    return opts[hashStr(`${seed}:${i++}`) % opts.length];
  });
}
export const hasSpintax = (tpl) => new RegExp(SPIN_RE.source).test(String(tpl || ''));

// Preview EXACTLY what sends: merge first, then resolve spintax (same order as
// the engine). `seed` picks a stable spin variant; default 'preview'.
export function renderPreview(tpl, ctx = {}, seed = 'preview') {
  return applySpintax(renderTemplate(tpl, ctx), seed);
}

// Mirror of services/outreachContent.js lintContent — a live spam-check the
// editor runs as you type. Advisory; keep in sync with the backend.
const LINT_SPAM_PHRASES = [
  'act now', 'click here', 'buy now', 'order now', 'limited time', 'limited offer',
  '100% free', 'risk-free', 'risk free', 'money back', 'money-back', 'cash bonus',
  'make money', 'get paid', 'you have won', 'congratulations you', 'winner',
  'viagra', 'bitcoin', 'crypto', 'investment opportunity', 'double your',
  'lowest price', 'best price', 'why pay more', 'no credit check', 'apply now',
  'call now', 'wire transfer', 'this is not spam', 'dear friend',
];
const LINT_URL_RE = /\bhttps?:\/\/[^\s)]+/gi;
const LINT_EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;
const lintCount = (re, s) => (String(s || '').match(re) || []).length;

export function lintContent({ subject = '', body = '' } = {}) {
  const subj = String(subject || '');
  const bod = String(body || '');
  const hay = `${subj}\n${bod}`.toLowerCase();
  const issues = [];
  const warn = (code, msg) => issues.push({ level: 'warn', code, msg });
  const info = (code, msg) => issues.push({ level: 'info', code, msg });

  const hits = [...new Set(LINT_SPAM_PHRASES.filter((p) => hay.includes(p)))];
  if (hits.length) warn('spam-words', `Spam-trigger phrasing: ${hits.slice(0, 4).map((h) => `"${h}"`).join(', ')}${hits.length > 4 ? '…' : ''}`);

  if (subj.trim().length > 70) warn('subject-long', `Subject is ${subj.trim().length} chars — aim for under ~60.`);
  if (subj.trim() && subj.trim().length < 3) info('subject-short', 'Subject is very short.');
  const subjLetters = subj.replace(/[^A-Za-z]/g, '');
  if (subjLetters.length >= 6 && subjLetters === subjLetters.toUpperCase()) warn('subject-caps', 'Subject is ALL CAPS — reads as shouting/spam.');
  if (LINT_EMOJI_RE.test(subj)) info('subject-emoji', 'Emoji in the subject can hurt cold B2B deliverability.');
  if (/[!?]{2,}/.test(subj) || lintCount(/!/g, subj) >= 2) warn('subject-punct', 'Too much !!! / ??? in the subject.');

  if (/!{3,}/.test(bod) || lintCount(/!/g, bod) >= 4) warn('body-punct', 'Lots of exclamation marks in the body.');
  const capsWords = (bod.match(/\b[A-Z]{4,}\b/g) || []).filter((w) => w !== 'FREE');
  if (capsWords.length >= 3) info('body-caps', `${capsWords.length} ALL-CAPS words — go easy on emphasis.`);
  if (/\${3,}|\$\$/.test(hay) || hay.includes('$$$')) warn('money-symbols', 'Repeated $ / $$$ reads spammy.');

  const links = lintCount(LINT_URL_RE, bod);
  if (links > 3) warn('links', `${links} links — cold emails deliver best with 0–1.`);
  const textOnly = bod.replace(LINT_URL_RE, '').replace(/\s+/g, ' ').trim();
  if (links >= 1 && textOnly.length < 120) warn('bare-link', 'Mostly a link with little text — reads like a drive-by.');
  if (!bod.trim()) warn('empty-body', 'Body is empty.');

  const penalty = issues.reduce((n, i) => n + (i.level === 'warn' ? 15 : 5), 0);
  const score = Math.max(0, 100 - penalty);
  const level = score >= 80 ? 'ok' : score >= 55 ? 'warn' : 'action';
  return { score, level, issues };
}

// The sample company the editor previews against.
export const SAMPLE_CONTEXT = {
  companyName: 'Green Leaf Dispensary',
  clientName: 'Sam Rivera',
  firstName: 'Sam',
  greeting: 'Hey Sam,',
  city: 'Trenton',
  state: 'NJ',
  senderName: 'Nate',
};

// The approved 4-touch dispensary sequence. Written to read like a real person
// typed it in thirty seconds — short sentences, no numbered ask-lists, no
// sales-page phrasing, plain sign-off — because template-smell is the #1 reply
// killer (the owner's words: "must feel real and non-AI"). Deliberately names
// NO city/state: the owner doesn't want recipients knowing where he's based.
// Touch 1 ships a subjectB (A/B test: half get each; results on the campaign
// card). Light {a|b} spintax keeps any two recipients from getting
// byte-identical emails. Follow-ups THREAD into the first email automatically
// (Re: … + references), so their subjects below are fallbacks. Stops the
// instant they reply; day-14 is a clean exit.
export const DEFAULT_SEQUENCE = [
  {
    offsetDays: 0,
    subject: '{merch|custom merch} for {{companyName}}',
    subjectB: 'quick one about {{companyName}}',
    body: `{{greeting}}

Nate here, from Joint Printing — we do custom merch for dispensaries. Staff tees and hoodies, hats, and the counter stuff like lighters and grinders.

If you send over a logo, I'll have mockups made up with {{companyName}}'s branding so you can actually see it {before spending anything|before any money comes into it}. If you like them, we go from there.

Worth a look?

Nate
jointprinting.com`,
  },
  {
    offsetDays: 3,
    subject: 'mockups for {{companyName}}',
    body: `{{greeting}}

{Floating this back up|Bumping this} in case it got buried — the free mockups are still on the table. Even just your logo and "show me hoodies" is enough for me to get started.

Some of our dispensary work if it helps to see it first: https://www.jointprinting.com/catalogs/dispo-promos.pdf

Nate`,
  },
  {
    offsetDays: 7,
    subject: 'staff gear first?',
    body: `{{greeting}}

Most shops we work with start small — staff apparel first, then a customer drop once they see how it lands. The staff stuff kind of pays for itself once the whole floor is wearing the brand.

Happy to mock up a few pieces for {{companyName}} so you've got something real to look at. {Still free|No charge for that}.

Nate`,
  },
  {
    offsetDays: 14,
    subject: 'closing the loop',
    body: `{{greeting}}

Last one from me — I know the inbox never stops. If merch ever comes up for {{companyName}}, just reply here and I'll pick it right back up. The mockups stay free whenever you want them.

Good luck with the shop.

Nate
jointprinting.com`,
  },
];

// (The old FINDER_REGIONS mirror is gone: the lead engine's coverage map reads
// region labels live from GET /find-leads/status, so nothing here to drift.)

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
