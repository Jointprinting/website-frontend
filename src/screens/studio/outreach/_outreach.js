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
    subject: '{merch line for|merch for} {{companyName}}',
    subjectB: 'quick one about {{companyName}}',
    body: `{{greeting}}

Nate here, from Joint Printing. We set up merch and apparel lines for dispensaries — {basically we run it like your merch department|think of us as your merch department}. You tell us the vibe, we pull whichever blank brands you want, put the quote together, and make up mockups with your branding before anything's decided.

The mockups are free. If you like them you order, if you don't you drop us — no commitment either way.

Want me to put a few together for {{companyName}}?

Nate
jointprinting.com`,
  },
  {
    offsetDays: 3,
    subject: 'mockups for {{companyName}}',
    body: `{{greeting}}

{Floating this back up|Bumping this} in case it got buried. Your logo and a rough idea — "staff hoodies", or "something to sell at the counter" — is enough for me to run with.

We're not tied to one supplier, so if there's a brand your team actually wants to wear, we pull it. Some of our dispensary work if it helps to see it first: https://www.jointprinting.com/catalogs/dispo-promos.pdf

Nate`,
  },
  {
    offsetDays: 7,
    subject: 'staff gear first?',
    body: `{{greeting}}

Most shops we work with start with staff apparel and add a customer drop once they see how it lands. The staff stuff kind of pays for itself once the whole floor is wearing the brand.

Either way I do the legwork — {pull the brands, build the quote, make the mockups|brands, quote, mockups}. You just say yes or no when you're looking at it.

Want a couple mocked up for {{companyName}}?

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

// ── Engine diagnostics ────────────────────────────────────────────────────────
// The two failures a cold-email engine can run for weeks with and never show:
// replies landing in a mailbox nobody reads, and a sequence with no second
// touch. The API decides both (utils/replyPath.js + the overview's stepCount /
// noFollowUpsPossible); everything here just turns that verdict into pixels, and
// every reader tolerates the field being absent so the tab survives a deploy
// where the API is still the older build.

export const DIAG_RED = '#f87171';
export const REPLY_PATH_TONE = { action: DIAG_RED, warn: D.amber, ok: D.green };

// Read engine.replyPath defensively. An unknown/absent verdict is 'ok' with
// nothing to show — same degrade-to-quiet rule the backend helper follows, so a
// hiccup can never manufacture a scary banner.
export function replyPathView(replyPath) {
  const rp = replyPath && typeof replyPath === 'object' ? replyPath : null;
  const level = rp && REPLY_PATH_TONE[rp.level] ? rp.level : 'ok';
  return {
    level,
    tone: REPLY_PATH_TONE[level],
    show: level !== 'ok',
    label: (rp && rp.label) || '',
    hint: (rp && rp.hint) || '',
    destination: (rp && rp.destination) || '',
    triageAddress: (rp && rp.triageAddress) || '',
    monitored: !!(rp && rp.monitored),
  };
}

// The passive "is anything actually ingesting replies?" readout. Same source as
// the banner — no extra call — so a dead ingest is visible even when the banner
// is quiet. Null = nothing known yet, render nothing.
export function replyIngestState(replyPath) {
  const v = replyPathView(replyPath);
  if (!v.destination && !v.triageAddress) return null;
  if (v.monitored) return { ok: true, tone: D.green, text: `reply sync reading ${v.triageAddress}` };
  if (!v.triageAddress) return { ok: false, tone: DIAG_RED, text: 'reply sync — no mailbox connected' };
  return { ok: false, tone: DIAG_RED, text: `reply sync reads ${v.triageAddress} — replies land in ${v.destination}` };
}

// Today's plan's follow-up tile. "0 follow-ups due" is two different facts: none
// are ripe yet, or there is no second email in existence. plan.noFollowUpsPossible
// says which, and the second one is an alarm, not a zero.
export function followUpsTile(plan) {
  const p = plan && typeof plan === 'object' ? plan : {};
  const due = Number(p.followUpsDue) || 0;
  if (p.noFollowUpsPossible) {
    return { alarm: true, value: 'NONE', label: 'One-touch — no follow-ups exist', tone: DIAG_RED };
  }
  return { alarm: false, value: due, label: 'Follow-ups due', tone: due > 0 ? D.green : D.muted };
}

// How deep a campaign's sequence actually goes. `stepCount` is the length the
// API reports; `everFollowedUp` is whether any enrollment has ever passed touch
// 1 — a 4-step campaign nobody has reached step 2 on is, in practice, still a
// one-touch campaign. Falls back to the embedded steps[] on an older payload.
export function sequenceDepth(campaign) {
  const c = campaign && typeof campaign === 'object' ? campaign : {};
  const embedded = Array.isArray(c.steps) ? c.steps.length : 0;
  const count = Number.isFinite(c.stepCount) ? c.stepCount : embedded;
  const sent = (c.stats && Number(c.stats.sent)) || 0;
  const thin = count < 2;
  // Only meaningful once mail has actually gone out on a live campaign.
  const neverFollowedUp = !thin && c.everFollowedUp === false && c.status === 'active' && sent > 0;
  return {
    count,
    thin,
    neverFollowedUp,
    tone: thin || neverFollowedUp ? DIAG_RED : D.muted,
    label: `${count} touch${count === 1 ? '' : 'es'}`,
    note: thin
      ? 'One touch only — every lead is burned on a single email and never hears from you again. Add a day-3 and a day-7 follow-up.'
      : neverFollowedUp
        ? `No lead has ever reached touch 2 — all ${sent} email${sent === 1 ? '' : 's'} sent so far are first touches.`
        : '',
  };
}

// The toast for a sequence that just GREW: the API re-arms the leads the shorter
// sequence already ran dry on and reports the count (PATCH /campaigns/:id →
// { reArm: { reArmed, candidates, skipped } }). Empty string = nothing to say.
export function reArmToast({ addedTouches = 0, reArm = null } = {}) {
  const r = reArm && typeof reArm === 'object' ? reArm : null;
  if (!r) return '';
  const reArmed = Number(r.reArmed) || 0;
  const candidates = Number(r.candidates) || 0;
  const added = Number(addedTouches) || 0;
  const lead = added > 0 ? `Added ${added} touch${added === 1 ? '' : 'es'} — ` : '';
  if (reArmed > 0) return `${lead}${reArmed} lead${reArmed === 1 ? '' : 's'} re-armed for follow-up.`;
  if (candidates > 0) {
    const blocked = (r.skipped && Number(r.skipped.blocked)) || 0;
    return `${lead}no burned leads could be re-armed${blocked ? ` — ${blocked} are opted out or blocked` : ''}.`;
  }
  return lead ? `${lead}no burned leads were waiting on a follow-up.` : '';
}

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

// How many touches a sequence has, on the campaign card — "4 touches" in the
// quiet meta tone, "1 touch" in red, because a sequence that can't follow up
// (or never has) is the difference between a lead engine and a list-burner.
// Feed it a sequenceDepth() result.
export function TouchChip({ depth }) {
  const d = depth || {};
  const bad = !!(d.thin || d.neverFollowedUp);
  return (
    <Chip
      label={d.label || '—'}
      size="small"
      sx={{
        height: 22, fontSize: 11, fontWeight: 800, letterSpacing: 0.2,
        color: bad ? DIAG_RED : D.muted,
        bgcolor: bad ? 'rgba(248,113,113,0.14)' : D.inset,
        border: `1px solid ${bad ? `${DIAG_RED}55` : D.line}`,
      }}
    />
  );
}

// One stat block in a summary strip — same look as the CRM Today pills.
// `alarm` repaints it as a red call-out for a stat that is a FAILURE, not a
// number (e.g. "no follow-ups exist"), so it can't read as a neutral zero.
export function StatPill({ value, label, tone = D.green, alarm = false }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 96, px: 2, py: 1.4, borderRadius: 2.5, textAlign: 'center',
      bgcolor: alarm ? 'rgba(248,113,113,0.10)' : D.inset,
      border: `1px solid ${alarm ? 'rgba(248,113,113,0.45)' : D.line}`,
    }}>
      <Typography sx={{ ...mono, fontSize: 26, fontWeight: 800, color: tone, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ color: alarm ? tone : D.faint, fontSize: 10.5, fontWeight: alarm ? 800 : 700,
        letterSpacing: 1, textTransform: 'uppercase', mt: 0.6 }}>
        {label}
      </Typography>
    </Box>
  );
}
