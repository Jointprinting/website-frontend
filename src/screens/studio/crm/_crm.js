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
import { D, mono } from '../_shared';

// ── Stage vocabulary ──────────────────────────────────────────────────────────
// Mirrors models/Client.js CRM_STAGES — keep the order + values in sync. Each
// stage carries a color used for chips and the row accent rail. The pipeline
// order also lets later phases (Kanban) reuse this single source of truth.
export const CRM_STAGES = ['lead', 'contacted', 'quoting', 'sampling', 'won', 'customer', 'lost', 'dormant'];

export const STAGE_META = {
  lead:      { label: 'Lead',      color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  contacted: { label: 'Contacted', color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  quoting:   { label: 'Quoting',   color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  sampling:  { label: 'Sampling',  color: '#f97316', bg: 'rgba(249,115,22,0.14)' },
  won:       { label: 'Won',       color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  customer:  { label: 'Customer',  color: '#2dd4bf', bg: 'rgba(45,212,191,0.14)' },
  lost:      { label: 'Lost',      color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  dormant:   { label: 'Dormant',   color: '#6b7280', bg: 'rgba(107,114,128,0.14)' },
};
export const stageMeta = (s) => STAGE_META[s] || STAGE_META.lead;

// Close-probability per stage — MIRRORS controllers/crm.js STAGE_PROBABILITY.
// The board's weighted forecast comes from /pipeline (server-computed); this
// fallback map lets the UI label per-stage odds without a round-trip and keeps a
// single visible source of truth on the client. Keep in sync with the backend.
export const STAGE_PROBABILITY = {
  lead: 0.1, contacted: 0.25, quoting: 0.5, sampling: 0.7,
  won: 1, customer: 1, lost: 0, dormant: 0,
};

// Board column order. The "active" lane runs lead → … → won/customer; lost and
// dormant are parked in a secondary lane the board shows collapsed by default.
export const PIPELINE_STAGES   = ['lead', 'contacted', 'quoting', 'sampling', 'won', 'customer'];
export const SECONDARY_STAGES  = ['lost', 'dormant'];

// ── Funnel / level progression (the "dopamine" spine) ─────────────────────────
// The forward sales journey as ordered LEVELS — what the progress indicator
// climbs. Won and Customer are the same victory rung (Customer = Won + has an
// order), so the bar fills completely for either. lost/dormant aren't on the
// ladder (they're off-ramps), so they read as 0 progress with a muted treatment.
export const FUNNEL_STEPS = ['lead', 'contacted', 'quoting', 'sampling', 'won'];

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

// ── Temperature / lifecycle tags ──────────────────────────────────────────────
// The importer tags records with a temperature (hot/warm/room-temp/cold/lost/
// in-progress/won/meta-ad) and engagement (eng-high/eng-med/eng-low). These are
// just normal tags[] under the hood; this map gives the KNOWN ones a legible
// color + glyph so they read as status, not noise. Unknown tags fall back to the
// neutral teal TagChips treatment. Keyed lowercase; matched case-insensitively.
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
  'eng-high':    { label: 'Eng · high',   color: '#4ade80', dot: '#4ade80' },
  'eng-med':     { label: 'Eng · med',    color: '#fbbf24', dot: '#fbbf24' },
  'eng-low':     { label: 'Eng · low',    color: '#9ca3af', dot: '#9ca3af' },
};
export const tempMeta = (t) => TEMP_META[String(t || '').toLowerCase().trim()] || null;

// ── Interest vocabulary ───────────────────────────────────────────────────────
export const INTEREST_TYPES = ['', 'promos', 'apparel', 'both'];
export const INTEREST_LABEL = { '': '—', promos: 'Promos', apparel: 'Apparel', both: 'Promos + Apparel' };
export const interestLabel = (i) => INTEREST_LABEL[i || ''] || '—';

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
export const headsUpMeta = (t) => HEADSUP_META[t] || { label: t || 'Attention', Icon: HelpOutlineOutlinedIcon, color: D.muted };

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

// First usable phone for a record: its own phone, else the first contact with
// a number.
export const primaryPhone = (rec) => {
  if (rec?.phone) return rec.phone;
  const c = (rec?.contacts || []).find((x) => x && x.phone);
  return c ? c.phone : '';
};

// ── Shared atoms ──────────────────────────────────────────────────────────────

// Stage pill — consistent across every view. `glow` adds a soft halo for the
// won/customer victory rung so a closed deal reads as a reward, not just another
// chip. `dot` prefixes a tiny level marker.
export function StageChip({ stage, size = 'small', glow = false, dot = false, sx = {} }) {
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
        ...(glow && won ? { boxShadow: `0 0 0 1px ${m.color}33, 0 4px 14px -4px ${m.color}aa` } : {}),
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
                boxShadow: reached && (won || i === lvl) ? `0 0 8px -1px ${segColor}aa` : 'none',
                transition: 'background-color 0.35s ease, box-shadow 0.35s ease, opacity 0.25s ease',
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
            {won ? '★ Customer' : `${Math.round(stageProgress(stage) * 100)}%`}
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
  const raw = Array.isArray(tags) ? tags.filter(Boolean) : [];
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
