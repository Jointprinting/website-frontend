// src/screens/studio/crm/_crm.js
// CRM-specific tokens, metadata, and small shared atoms — all built on top of
// the shared "drop" palette (`D`) and helpers from ../_shared so the CRM reads
// as part of the same Studio family. Nothing here is CRM-business-logic; it's
// the vocabulary (stage colors, interest/kind labels) + a couple of reusable
// presentational pieces every CRM view leans on.

import * as React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { D, mono } from '../_shared';

// ── Stage vocabulary ──────────────────────────────────────────────────────────
// Mirrors models/Client.js CRM_STAGES — keep the order + values in sync. Each
// stage carries a color used for chips and the row accent rail. The pipeline
// order also lets later phases (Kanban) reuse this single source of truth.
// 'sampling' was retired (owner: not useful) — existing records were migrated to
// 'quoting' by a one-time server boot repair. 'customer' stays the STORED value
// (order-reality promotion, isCustomer, etc. key on it) but every LABEL reads
// "Client" — the owner's word for a company that placed an order.
export const CRM_STAGES = ['lead', 'contacted', 'awaiting_details', 'quoting', 'won', 'customer', 'lost', 'dormant'];

// Once a company is a real CUSTOMER (has placed an order) it stays one — "even if
// they go cold." These early funnel stages are a DEMOTION below customer, so they're
// locked off for a customer and the stored stage can never disagree with order reality.
export const PRE_CUSTOMER_STAGES = ['lead', 'contacted', 'awaiting_details', 'quoting'];

export const STAGE_META = {
  lead:      { label: 'Lead',      color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  contacted: { label: 'Contacted', color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  awaiting_details: { label: 'Awaiting details', color: '#f472b6', bg: 'rgba(244,114,182,0.14)' },
  quoting:   { label: 'Quoting',   color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  won:       { label: 'Won',       color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  customer:  { label: 'Client',    color: '#2dd4bf', bg: 'rgba(45,212,191,0.14)' },
  lost:      { label: 'Lost',      color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  dormant:   { label: 'Dormant',   color: '#6b7280', bg: 'rgba(107,114,128,0.14)' },
};
export const stageMeta = (s) => STAGE_META[s] || STAGE_META.lead;

// Close-probability per stage — MIRRORS controllers/crm.js STAGE_PROBABILITY.
// The board's weighted forecast comes from /pipeline (server-computed); this
// fallback map lets the UI label per-stage odds without a round-trip and keeps a
// single visible source of truth on the client. Keep in sync with the backend.
export const STAGE_PROBABILITY = {
  lead: 0.1, contacted: 0.25, awaiting_details: 0.35, quoting: 0.5,
  won: 1, customer: 1, lost: 0, dormant: 0,
};

// ── Unified order-centric board columns ──────────────────────────────────────
// The pipeline is now "one client → many orders": lead/contacted columns are
// pre-quote Client cards (no live order); quoting → … → delivered are ORDER cards
// (one per order). Mirrors controllers/crm.js BOARD_COLUMNS / BOARD_CLOSED_COLUMNS
// — keep in sync. The server also sends its `columns` in the /pipeline payload, so
// this is the labels/colors source of truth + a fallback ordering.
export const BOARD_COLUMNS         = ['lead', 'contacted', 'awaiting_details', 'quoting', 'approval', 'production', 'shipped', 'delivered'];
export const BOARD_CLOSED_COLUMNS  = ['lost', 'dormant', 'cancelled'];

// Per-column meta (label + colors) for the board. Lead/contacted/lost/dormant
// REUSE the stage meta (same colors as everywhere else); the order-status columns
// get their own. Keyed by board column id.
export const BOARD_COLUMN_META = {
  lead:       STAGE_META.lead,
  contacted:  STAGE_META.contacted,
  awaiting_details: STAGE_META.awaiting_details,
  quoting:    { label: 'Quoting',    color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  approval:   { label: 'Approval',   color: '#38bdf8', bg: 'rgba(56,189,248,0.14)' },
  production: { label: 'Production', color: '#818cf8', bg: 'rgba(129,140,248,0.14)' },
  shipped:    { label: 'Shipped',    color: '#34d399', bg: 'rgba(52,211,153,0.14)' },
  delivered:  { label: 'Delivered',  color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  lost:       STAGE_META.lost,
  dormant:    STAGE_META.dormant,
  cancelled:  { label: 'Cancelled',  color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
};
export const boardColumnMeta = (col) => BOARD_COLUMN_META[col] || STAGE_META.lead;

// Per-column close-probability — MIRRORS controllers/crm.js BOARD_PROBABILITY.
// Lets the board footer label per-column odds without a round-trip (the weighted
// forecast itself still comes server-computed on /pipeline). Keep in sync.
export const BOARD_PROBABILITY = {
  lead: 0.1, contacted: 0.25, awaiting_details: 0.35, quoting: 0.5, approval: 0.8,
  production: 0.9, shipped: 0.95, delivered: 1,
  lost: 0, dormant: 0, cancelled: 0,
};

// A board column whose cards "win" (celebratory accent) — the realized end of the
// fulfillment funnel. (Distinct from isWonStage, which is about Client stages.)
export const isWonColumn = (col) => col === 'delivered';

// The board columns an ORDER card may be dragged among (its fulfillment lifecycle
// + cancel). Lead/contacted/lost/dormant are CLIENT states an order never enters.
export const ORDER_BOARD_COLUMNS = ['quoting', 'approval', 'production', 'shipped', 'delivered', 'cancelled'];
// The board columns a LEAD card may be dragged among. It can advance into quoting
// (which mints/opens the order via the handoff), and it can be dropped onto the
// Lost / Dormant off-ramps to close it right from the board (the previous list
// left those unreachable by drag — the owner had to open the card). It still
// can't jump mid-fulfillment (approval/production/…) — that's an order lifecycle.
export const LEAD_BOARD_COLUMNS = ['lead', 'contacted', 'awaiting_details', 'quoting', 'lost', 'dormant'];

// Map a board column → the Order.status to PERSIST when an order card is dropped
// there. 'production' lands on 'placed' (the canonical entry to the production
// column; in_production also lives there but a drop only fires on a column change).
export const BOARD_COLUMN_TO_ORDER_STATUS = {
  quoting:    'quoted',
  approval:   'approved',
  production: 'placed',
  shipped:    'shipped',
  delivered:  'delivered',
  cancelled:  'cancelled',
};

// ── Deal pipeline vocabulary ──────────────────────────────────────────────────
// A DEAL is one opportunity/job for a business — the unit the sales pipeline now
// moves (models/Deal.js on the API). A business (companyKey) has MANY deals, and
// its "client" status is DERIVED from them (≥1 won deal), replacing the old
// hand-set won/customer company stage. MIRRORS models/Deal.js DEAL_STAGES — keep
// the order + values in sync. Ordered open → closed, matching how the owner
// actually works a job:
//   details_needed — chasing product + design details from the client
//   quoting        — details in hand; mockups + the quote are being built
//   quote_sent     — the quote/approval link went out (auto-stamped on share)
//   won            — ONLY when the linked order is delivered (auto; no Win button)
//   lost
export const DEAL_STAGES = ['details_needed', 'quoting', 'quote_sent', 'won', 'lost'];
export const DEAL_OPEN_STAGES = ['details_needed', 'quoting', 'quote_sent'];
// Board lanes: the forward pipeline across the top; Lost tucked into a closed lane.
export const DEAL_BOARD_ACTIVE = ['details_needed', 'quoting', 'quote_sent', 'won'];
export const DEAL_BOARD_CLOSED = ['lost'];

export const DEAL_STAGE_META = {
  details_needed: { label: 'Details needed', color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  quoting:        { label: 'Design & quote', color: '#22d3ee', bg: 'rgba(34,211,238,0.14)' },
  quote_sent:     { label: 'Quote sent',     color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  won:            { label: 'Won',            color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  lost:           { label: 'Lost',           color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
};
export const dealStageMeta = (s) => DEAL_STAGE_META[s] || DEAL_STAGE_META.details_needed;

// A deal that "wins" — the celebratory accent, and the rung that makes a client.
export const isWonDeal = (d) => !!(d && !d.archived && d.stage === 'won');
// A deal still in play (a live opportunity), not yet closed.
export const isOpenDeal = (d) => !!(d && !d.archived && DEAL_OPEN_STAGES.includes(d.stage));

// Is this business a CLIENT by the new rule? ≥1 non-archived won deal. MIRRORS
// services/dealService.js isClientFromDeals — the single source of truth for
// "client" once the deal model is the derivation authority.
export const isClientFromDeals = (deals) =>
  (Array.isArray(deals) ? deals : []).some(isWonDeal);

// Which deal stage an Order.status maps to — MIRRORS models/Deal.js
// dealStageFromOrderStatus. Won is delivery-only (owner's rule); a placed/
// in-production/shipped order is still an OPEN deal at quote_sent. Keep in sync.
export const dealStageFromOrderStatus = (status) => {
  switch (String(status || '')) {
    case 'delivered': return 'won';
    case 'cancelled': return 'lost';
    case 'placed': case 'in_production': case 'shipped': case 'approved': return 'quote_sent';
    default: return 'quoting';
  }
};

// A human title for a deal that has none — mirrors the server's orderDealTitle,
// so a seeded deal reads the same on the card as it did in the migration plan.
export const dealTitle = (d) => {
  if (!d) return 'Deal';
  if (d.title) return d.title;
  const n = d.orderNumber || d.projectNumber;
  return n ? `Order #${n}` : (d.companyName || 'Deal');
};

// ── Funnel / level progression (the "dopamine" spine) ─────────────────────────
// The forward sales journey as ordered LEVELS — what the progress indicator
// climbs. Won and Customer are the same victory rung (Customer = Won + has an
// order), so the bar fills completely for either. lost/dormant aren't on the
// ladder (they're off-ramps), so they read as 0 progress with a muted treatment.
export const FUNNEL_STEPS = ['lead', 'contacted', 'awaiting_details', 'quoting', 'won'];

// 0-based level of a stage on the ladder; customer collapses onto won's rung.
export const stageLevel = (s) => {
  if (s === 'customer') return FUNNEL_STEPS.indexOf('won');
  const i = FUNNEL_STEPS.indexOf(s);
  return i; // -1 for lost/dormant/unknown → treated as off-ladder
};

// Fraction [0..1] of the journey a stage represents — drives the progress fill.
// Won/Customer = full (1). lost/dormant = 0 (off-ramp).
export const stageProgress = (s) => {
  const lvl = stageLevel(s);
  if (lvl < 0) return 0;
  return lvl / (FUNNEL_STEPS.length - 1);
};

// A stage that means "we have a real customer" — earns the celebratory accent.
export const isWonStage = (s) => s === 'won' || s === 'customer';
// A stage that's parked off the active ladder.
export const isClosedStage = (s) => s === 'lost' || s === 'dormant';

// ── CRM segments — the instant, choppy-free split of the whole book ────────────
// Three buckets the owner toggles between in one click (no separate pages):
//   • clients   — REAL customers: have placed an order. The authoritative signal
//                 is `isCustomer` (server-computed from order reality, Phase 1);
//                 won/customer stage is a parity fallback so a freshly-won deal
//                 still reads as a client even before its order row lands.
//   • leads     — warm / in-pipeline: actively being worked but not yet a client.
//                 That's the mid-funnel stages (contacted/quoting/sampling) plus a
//                 brand-new `lead` that has a next step scheduled (so a worked
//                 lead doesn't hide in "everyone else").
//   • everyone  — the cold / dormant / parked remainder: an untouched `lead` with
//                 no follow-up, plus lost/dormant.
// One record lands in exactly one bucket (clients wins, then leads, then
// everyone), so the three counts always sum to the whole non-archived book.
export const CRM_SEGMENTS = ['clients', 'leads', 'everyone'];
export const SEGMENT_META = {
  clients:  { label: 'Clients',      hint: 'Placed an order' },
  leads:    { label: 'Active leads', hint: 'Warm · in pipeline' },
  everyone: { label: 'Everyone else', hint: 'Cold · dormant · parked' },
};

// Is this company a real customer? Mirror the row star/detail logic exactly:
// the server's isCustomer (order reality) OR a won/customer stage.
export const isClient = (c) => !!(c && (c.isCustomer || isWonStage(c.stage)));

/// Mirrors the backend isEngineManagedCold (controllers/crm.js): an engine-managed
// COLD-OUTREACH prospect the owner hasn't personally engaged. Produced by the
// lead-finder / mail-merge (a cold-email / dispensary / cold / meta-ad tag, or a
// 'Cold Outreach' lead source), NOT yet replied (a reply adds the 'warm' tag) and
// NOT owner-touched (a logged call/text/visit — an automated cold email doesn't
// count). It lives in the CRM only so the outreach engine can drip it, so it's kept
// off the owner's board. Keep in lockstep with the backend.
export const isEngineManagedCold = (c) => {
  if (!c) return false;
  const tags = (c.tags || []).map((t) => String(t || '').toLowerCase());
  const outreachProspect = !tags.includes('warm')
    && (tags.includes('cold-email') || tags.includes('dispensary') || tags.includes('cold')
      || tags.includes('meta-ad') || c.leadSource === 'Cold Outreach');
  const ownerTouched = (c.log || []).some((l) => ['call', 'text', 'visit'].includes(l && l.kind));
  return outreachProspect && !ownerTouched && c.stage !== 'customer' && c.stage !== 'won';
};

// The cold-outreach POOL: engine-managed cold AND nothing scheduled. Mirrors the
// backend isOutreachPool (controllers/crm.js). The moment the owner schedules a
// follow-up (nextFollowUp set), the lead replies ('warm'), or the owner works it
// (a call/text/visit log), it LEAVES the pool and rejoins the board as an active
// lead — the promotion that was silently broken when this ignored nextFollowUp/warm.
export const isOutreachPool = (c) => isEngineManagedCold(c) && c.nextFollowUp == null;

// "Active leads" = the leads the owner is actually working — NOT the automated
// cold-email pool, and either with a scheduled next follow-up (the owner's own
// "I'm on this") or mid-quote. Owner ask (2026-07): active leads should be leads
// with a follow-up date, not cold-email leads — so the blast (which used to land
// here via its 'contacted' stage) now sits in "everyone else" until the owner
// schedules a real next step. A live quote (quoting / awaiting-details) still
// counts as active even before a follow-up is set.
const LIVE_QUOTE_STAGES = ['awaiting_details', 'quoting'];
export const isActiveLead = (c) => {
  if (!c || isClient(c)) return false;
  // A lost/dormant card is parked off the active ladder — it stays in "everyone
  // else" even if it carries an old (never-cleared) follow-up date.
  if (isClosedStage(c.stage)) return false;
  if (isOutreachPool(c)) return false;
  return !!c.nextFollowUp || LIVE_QUOTE_STAGES.includes(c.stage);
};

// The bucket a record belongs to — exactly one of CRM_SEGMENTS.
export const segmentOf = (c) => {
  if (isClient(c)) return 'clients';
  if (isActiveLead(c)) return 'leads';
  return 'everyone';
};

// ── Temperature / lifecycle tags ──────────────────────────────────────────────
// The importer tags records with a temperature (hot/warm/room-temp/cold/lost/
// in-progress/won/meta-ad). These are just normal tags[] under the hood; this map
// gives the KNOWN ones a legible color + glyph so they read as status, not noise.
// Unknown tags fall back to the neutral teal TagChips treatment. Keyed lowercase;
// matched case-insensitively.
export const TEMP_META = {
  hot:           { label: 'Hot',          color: '#fb7185', dot: '#fb7185', emoji: '🔥' },
  warm:          { label: 'Warm',         color: '#fbbf24', dot: '#fbbf24' },
  'room-temp':   { label: 'Room temp',    color: '#a3a3a3', dot: '#a3a3a3' },
  'room temp':   { label: 'Room temp',    color: '#a3a3a3', dot: '#a3a3a3' },
  cold:          { label: 'Cold',         color: '#60a5fa', dot: '#60a5fa' },
  lost:          { label: 'Lost',         color: '#9ca3af', dot: '#9ca3af' },
  'in-progress': { label: 'In progress',  color: '#2dd4bf', dot: '#2dd4bf' },
  'in progress': { label: 'In progress',  color: '#2dd4bf', dot: '#2dd4bf' },
  won:           { label: 'Won',          color: '#4ade80', dot: '#4ade80' },
  'meta-ad':     { label: 'Meta ad',      color: '#818cf8', dot: '#818cf8' },
  'meta ad':     { label: 'Meta ad',      color: '#818cf8', dot: '#818cf8' },
  // Stamped on every company enrolled in a cold-email campaign (Outreach tool),
  // so a reply — which also earns 'warm' — is unmistakably traceable to the merge.
  'cold-email':  { label: 'Cold email',   color: '#38bdf8', dot: '#38bdf8' },
  'cold email':  { label: 'Cold email',   color: '#38bdf8', dot: '#38bdf8' },
};
export const tempMeta = (t) => TEMP_META[String(t || '').toLowerCase().trim()] || null;

// ── Hidden system tags — the cryptic import-only noise ────────────────────────
// The importer stamps a handful of MACHINE-ONLY tags the owner never needs to see
// on a card: the engagement levels (eng-high/med/low/inactive) and the order-ref
// hint. They still live in tags[] (the backend's replace-mode logic keys off them
// to know a record is an untouched import), but they're pure clutter in the UI —
// the owner called them out by name. We filter them out of EVERY tag surface here,
// so removing them is one rule, not a per-view edit. Matched case-insensitively;
// also drops any future eng-* variant.
const HIDDEN_TAG_EXACT = new Set(['order-ref', 'eng-high', 'eng-med', 'eng-medium', 'eng-low', 'eng-inactive']);
export const isHiddenTag = (t) => {
  const v = String(t || '').toLowerCase().trim();
  if (!v) return true;                       // blank → nothing to show
  if (HIDDEN_TAG_EXACT.has(v)) return true;
  if (/^eng[-\s]/.test(v)) return true;      // any eng-* engagement level
  return false;
};
// The owner-visible tags on a record: real tags minus the hidden system noise.
export const visibleTags = (tags) => (Array.isArray(tags) ? tags.filter((t) => t && !isHiddenTag(t)) : []);

// ── Heads-up vocabulary — the dashboard "needs your attention" feed ───────────
// MIRRORS the types controllers/crm.js classifyHeadsUp emits. Each carries an
// icon + label + the color the row accent / icon paints. Keep in sync with the
// backend's type strings.
export const HEADSUP_META = {
  overdue_followup: { label: 'Overdue',      Icon: EventBusyOutlinedIcon,             color: '#f87171' },
  hot_quiet:        { label: 'Hot & quiet',  Icon: LocalFireDepartmentOutlinedIcon,   color: '#fb923c' },
  stale:            { label: 'Stale',        Icon: HourglassEmptyOutlinedIcon,        color: '#fbbf24' },
  no_next_step:     { label: 'No next step', Icon: HelpOutlineOutlinedIcon,           color: '#60a5fa' },
};

// ── Cadence cockpit — the day organized by NEXT ACTION ────────────────────────
// One bucket per action, in the order the owner should work them. Mirrors the
// backend's controllers/crm.js CADENCE_BUCKETS (keep the keys + order in sync).
// `caption` is the one-line "what this bucket is" under the header; `color`/`Icon`
// also drive each row (a cockpit entry's `type` IS its bucket key, so headsUpMeta
// falls back here to paint the row).
export const CADENCE_BUCKETS = ['your_move', 'call_today', 'closing_soon', 'make_mockup', 'on_the_rails'];
export const CADENCE_META = {
  your_move:    { label: 'Your move',     caption: 'You owe the next move — reach out now.',      Icon: BoltOutlinedIcon,           color: '#f87171' },
  call_today:   { label: 'Call today',    caption: 'A follow-up you booked for today.',           Icon: PhoneInTalkIcon,            color: '#fbbf24' },
  closing_soon: { label: 'Closing soon',  caption: "A quote's out — nudge it over the line.",     Icon: RequestQuoteOutlinedIcon,   color: '#4ade80' },
  make_mockup:  { label: 'Make a mockup', caption: 'Put a mockup in front of them to move it.',   Icon: DesignServicesOutlinedIcon, color: '#22d3ee' },
  on_the_rails: { label: 'On the rails',  caption: 'Booked and healthy — nothing to do today.',   Icon: CheckCircleOutlinedIcon,    color: D.muted },
};
export const cadenceMeta = (b) => CADENCE_META[b] || { label: b || 'Worklist', caption: '', Icon: HelpOutlineOutlinedIcon, color: D.muted };

// Row icon/color: heads-up types first, then cockpit buckets (a cockpit entry's
// `type` is its bucket key), then a neutral fallback.
export const headsUpMeta = (t) => HEADSUP_META[t] || CADENCE_META[t] || { label: t || 'Attention', Icon: HelpOutlineOutlinedIcon, color: D.muted };

// Severity → the tone its pill/border carries. high = red, med = amber, low = blue.
export const SEVERITY_META = {
  high: { label: 'High', color: '#f87171', bg: 'rgba(248,113,113,0.14)' },
  med:  { label: 'Med',  color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  low:  { label: 'Low',  color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
};
export const severityMeta = (s) => SEVERITY_META[s] || SEVERITY_META.low;

// ── Log "kind" vocabulary — icon + label per touch type ───────────────────────
export const LOG_KINDS = ['note', 'call', 'text', 'email', 'visit'];
export const KIND_META = {
  note:  { label: 'Note',  Icon: EditNoteOutlinedIcon,    color: D.muted },
  call:  { label: 'Call',  Icon: PhoneInTalkIcon,         color: D.green },
  text:  { label: 'Text',  Icon: SmsOutlinedIcon,         color: '#60a5fa' },
  email: { label: 'Email', Icon: MailOutlineIcon,         color: '#a78bfa' },
  visit: { label: 'Visit', Icon: StorefrontOutlinedIcon,  color: '#fbbf24' },
};
export const kindMeta = (k) => KIND_META[k] || KIND_META.note;

// ── Date helpers ──────────────────────────────────────────────────────────────
// nextFollowUp / lastContact are WHOLE-DAY values. A date string like
// "2026-06-25" sent to the API is stored by Mongoose as 2026-06-25T00:00:00Z
// (UTC midnight). To keep "June 25" rendering as June 25 for the US-based owner
// (and to bucket calendar chips on the right cell), we read these dates in UTC
// end-to-end — never the viewer's local zone, which would shift the day back.
//
// `dayKey` → the UTC YYYY-MM-DD for an ISO/Date (calendar bucketing + <input
// type="date"> values). For Date objects built from local Y/M/D (the calendar
// grid cells, "today"), the UTC parts equal the intended day because we
// construct them with local Y/M/D and compare key-to-key.
export const dayKey = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return '';
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
};

// Value for <input type="date">: the stored UTC calendar day. Empty when absent.
export const dateInputValue = (iso) => (iso ? dayKey(iso) : '');

// Today's key in the VIEWER'S LOCAL calendar day — the reference point for
// "due / overdue / today" math. The shop is run from New Jersey (US Eastern), so
// the owner's browser local day IS Eastern; using it (instead of UTC) keeps
// "today" correct in the evening, when UTC has already rolled to tomorrow but it's
// still today for the owner. (Whole-day VALUES are still read with dayKey()/UTC —
// they're stored at UTC midnight, so their UTC day is their intended calendar day.
// We only changed which "today" they're measured against.)
export const todayLocalKey = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

// A YYYY-MM-DD that is `days` after the viewer's local today — for the reschedule
// presets ("Tomorrow", "+1 week", …). Computed from local calendar parts so the
// picker value is the owner's intended day (no UTC round-trip that could land on
// the wrong date near midnight). The API stores it as that day's UTC midnight.
export const localDayKeyPlus = (days) => {
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  n.setDate(n.getDate() + days);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

// Days between two YYYY-MM-DD keys (b - a), date-only, no timezone in play.
function dayDiff(aKey, bKey) {
  const a = new Date(`${aKey}T00:00:00Z`).getTime();
  const b = new Date(`${bKey}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

// Human "due" phrasing for a follow-up date relative to today: "Overdue 3d",
// "Today", "Tomorrow", "in 4d", or an absolute date further out. `tone` is the
// color the caller should paint it. The follow-up's day is read in UTC (it's
// stored at UTC midnight, so that's its intended calendar day); "today" is the
// viewer's LOCAL day (Eastern for the owner) so the comparison matches the
// owner's clock — agreeing with the backend's America/New_York boundary.
export function followUpStatus(iso) {
  if (!iso) return { label: 'No follow-up', tone: D.faint, overdue: false };
  const dueKey = dayKey(iso);
  if (!dueKey) return { label: 'No follow-up', tone: D.faint, overdue: false };
  const days = dayDiff(todayLocalKey(), dueKey);
  if (days < 0)  return { label: days === -1 ? 'Overdue 1d' : `Overdue ${-days}d`, tone: '#f87171', overdue: true };
  if (days === 0) return { label: 'Today',    tone: D.amber, overdue: false };
  if (days === 1) return { label: 'Tomorrow', tone: D.green, overdue: false };
  if (days <= 7)  return { label: `in ${days}d`, tone: D.green, overdue: false };
  return {
    label: new Date(`${dueKey}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }),
    tone: D.muted, overdue: false,
  };
}

// Compact whole-dollar money for dense surfaces (cards, column headers): no
// cents, thousands separators, and k/M shorthand past a threshold so big deal
// values don't blow out a narrow Kanban card. "$0" stays "$0".
export const fmtMoney0 = (n) => {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
  if (abs >= 10000)   return `${sign}$${Math.round(abs / 1000).toLocaleString('en-US')}k`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
};

// Clean a phone string down to diallable digits for a tel: href (keeps a
// leading + for international, drops everything else).
export const telHref = (phone) => {
  const s = String(phone || '').trim();
  if (!s) return '';
  const plus = s.startsWith('+') ? '+' : '';
  return `tel:${plus}${s.replace(/[^\d]/g, '')}`;
};

// Same digit-cleaning as telHref, but for an sms: deep link (text the number).
export const smsHref = (phone) => {
  const s = String(phone || '').trim();
  if (!s) return '';
  const plus = s.startsWith('+') ? '+' : '';
  return `sms:${plus}${s.replace(/[^\d]/g, '')}`;
};

// First usable phone for a record: its own phone, else the first contact with
// a number.
export const primaryPhone = (rec) => {
  if (rec?.phone) return rec.phone;
  const c = (rec?.contacts || []).find((x) => x && x.phone);
  return c ? c.phone : '';
};

// ── Shared atoms ──────────────────────────────────────────────────────────────

// Stage pill — consistent across every view. `dot` prefixes a tiny level marker.
export function StageChip({ stage, size = 'small', dot = false, sx = {} }) {
  const m = stageMeta(stage);
  const won = isWonStage(stage);
  return (
    <Chip
      label={m.label}
      size={size}
      icon={dot ? <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color, ml: 1 }} /> : undefined}
      sx={{
        bgcolor: m.bg, color: m.color, fontWeight: 800, fontSize: 11, height: 22,
        border: `1px solid ${m.color}${won ? '66' : '40'}`, letterSpacing: 0.2,
        '& .MuiChip-icon': { mr: -0.25 },
        ...sx,
      }}
    />
  );
}

// ── Stage progress / level indicator (the dopamine bar) ───────────────────────
// A segmented funnel rail: one pip per FUNNEL_STEP, filled up to (and including)
// the record's current rung in that rung's color, with a soft running gradient
// underneath so advancing a stage feels like leveling up. Won/Customer lights
// the whole bar green; lost/dormant dims it. Pure CSS, animated via width/opacity
// transitions already in the token set.
export function StageProgress({ stage, height = 6, showLabel = false, sx = {} }) {
  const m = stageMeta(stage);
  const won = isWonStage(stage);
  const closed = isClosedStage(stage);
  const lvl = stageLevel(stage); // -1 for off-ladder
  return (
    <Box sx={{ ...sx }}>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {FUNNEL_STEPS.map((s, i) => {
          const reached = lvl >= 0 && i <= lvl;
          const segColor = won ? STAGE_META.won.color : (reached ? m.color : D.line);
          return (
            <Box
              key={s}
              sx={{
                flex: 1, height, borderRadius: 999,
                bgcolor: reached ? segColor : 'rgba(255,255,255,0.07)',
                opacity: closed ? 0.4 : 1,
                transition: 'background-color 0.35s ease, opacity 0.25s ease',
              }}
            />
          );
        })}
      </Box>
      {showLabel && (
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
          <Typography sx={{ ...mono, fontSize: 9.5, fontWeight: 700, color: D.faint, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {closed ? stageMeta(stage).label : `Level ${Math.max(0, lvl) + 1} of ${FUNNEL_STEPS.length}`}
          </Typography>
          <Typography sx={{ ...mono, fontSize: 9.5, fontWeight: 800, color: won ? STAGE_META.won.color : m.color, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {won ? '★ Client' : `${Math.round(stageProgress(stage) * 100)}%`}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

// A single temperature/lifecycle chip — colored by TEMP_META when known.
export function TempChip({ tag, size = 'small', sx = {} }) {
  const m = tempMeta(tag);
  if (!m) return null;
  const tiny = size === 'tiny';
  return (
    <Chip
      size="small"
      label={(
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
          <Box sx={{ width: tiny ? 5 : 6, height: tiny ? 5 : 6, borderRadius: '50%', bgcolor: m.dot }} />
          {m.label}
        </Box>
      )}
      sx={{
        height: tiny ? 18 : 22, bgcolor: `${m.color}1f`, color: m.color,
        border: `1px solid ${m.color}55`, fontWeight: 800, fontSize: tiny ? 10 : 11,
        letterSpacing: 0.2, '& .MuiChip-label': { px: tiny ? 0.75 : 1 }, ...sx,
      }}
    />
  );
}

// Tiny uppercase section label, CRM flavor of the shared eyebrow.
export function Eyebrow({ children, sx = {} }) {
  return (
    <Typography sx={{
      fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase',
      color: D.faint, ...sx,
    }}>
      {children}
    </Typography>
  );
}

// Empty / zero state — centered icon + message, reused by every list view.
export function EmptyState({ icon, title, hint }) {
  return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <Box sx={{ color: 'rgba(255,255,255,0.18)', mb: 1.5, '& svg': { fontSize: 52 } }}>{icon}</Box>
      <Typography sx={{ color: D.muted, fontWeight: 700, fontSize: 15 }}>{title}</Typography>
      {hint && <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 0.5 }}>{hint}</Typography>}
    </Box>
  );
}

// Tag chips — the one place tags are painted, so cards / rows / detail all read
// the same. KNOWN temperature/lifecycle tags (hot/warm/cold/…) render in their
// signature color (via TempChip) and float to the front; everything else is a
// neutral teal chip. Read-only by default; pass `onDelete(tag)` to make each chip
// removable (used on the detail editor). `size="tiny"` packs them onto cards.
export function TagChips({ tags, onDelete, size = 'small', max, sx = {} }) {
  // Drop the hidden machine-only tags (eng-*/order-ref) from every surface — the
  // owner never sees that import noise, whether the chips are read-only or the
  // removable detail editor.
  const raw = visibleTags(tags);
  if (raw.length === 0) return null;
  // Sort known temperature tags first so the hot/warm signal leads.
  const list = [...raw].sort((a, b) => (tempMeta(b) ? 1 : 0) - (tempMeta(a) ? 1 : 0));
  const shown = max && list.length > max ? list.slice(0, max) : list;
  const overflow = max && list.length > max ? list.length - max : 0;
  const tiny = size === 'tiny';
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', ...sx }}>
      {shown.map((t) => {
        const tm = tempMeta(t);
        // Known temperature tag: colored TempChip. When removable, wrap it with a
        // delete affordance by falling through to a colored Chip instead.
        if (tm && !onDelete) return <TempChip key={t} tag={t} size={size} />;
        const color = tm ? tm.color : '#5eead4';
        const bg = tm ? `${tm.color}1f` : 'rgba(45,212,191,0.12)';
        const border = tm ? `${tm.color}55` : 'rgba(45,212,191,0.35)';
        return (
          <Chip
            key={t}
            label={tm ? tm.label : t}
            size="small"
            onDelete={onDelete ? () => onDelete(t) : undefined}
            deleteIcon={onDelete ? <CloseIcon /> : undefined}
            sx={{
              height: tiny ? 18 : 22,
              bgcolor: bg, color, border: `1px solid ${border}`,
              fontWeight: 700, fontSize: tiny ? 10 : 11, letterSpacing: 0.2,
              '& .MuiChip-label': { px: tiny ? 0.75 : 1 },
              '& .MuiChip-deleteIcon': { color: `${color}b3`, fontSize: 14, '&:hover': { color } },
            }}
          />
        );
      })}
      {overflow > 0 && (
        <Typography component="span" sx={{ ...mono, color: D.faint, fontSize: tiny ? 10 : 11, fontWeight: 700 }}>
          +{overflow}
        </Typography>
      )}
    </Box>
  );
}
