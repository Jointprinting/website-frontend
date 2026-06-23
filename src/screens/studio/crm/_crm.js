// src/screens/studio/crm/_crm.js
// CRM-specific tokens, metadata, and small shared atoms — all built on top of
// the shared "drop" palette (`D`) and helpers from ../_shared so the CRM reads
// as part of the same Studio family. Nothing here is CRM-business-logic; it's
// the vocabulary (stage colors, interest/kind labels) + a couple of reusable
// presentational pieces every CRM view leans on.

import * as React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import { D } from '../_shared';

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

// ── Interest vocabulary ───────────────────────────────────────────────────────
export const INTEREST_TYPES = ['', 'promos', 'apparel', 'both'];
export const INTEREST_LABEL = { '': '—', promos: 'Promos', apparel: 'Apparel', both: 'Promos + Apparel' };
export const interestLabel = (i) => INTEREST_LABEL[i || ''] || '—';

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

// Today's UTC day key — the reference point for "due" math on whole-day dates.
const todayUtcKey = () => {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
};

// Days between two YYYY-MM-DD keys (b - a), date-only, no timezone in play.
function dayDiff(aKey, bKey) {
  const a = new Date(`${aKey}T00:00:00Z`).getTime();
  const b = new Date(`${bKey}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

// Human "due" phrasing for a follow-up date relative to today: "Overdue 3d",
// "Today", "Tomorrow", "in 4d", or an absolute date further out. `tone` is the
// color the caller should paint it. Computed in UTC so it agrees with how the
// date is stored + displayed.
export function followUpStatus(iso) {
  if (!iso) return { label: 'No follow-up', tone: D.faint, overdue: false };
  const dueKey = dayKey(iso);
  if (!dueKey) return { label: 'No follow-up', tone: D.faint, overdue: false };
  const days = dayDiff(todayUtcKey(), dueKey);
  if (days < 0)  return { label: days === -1 ? 'Overdue 1d' : `Overdue ${-days}d`, tone: '#f87171', overdue: true };
  if (days === 0) return { label: 'Today',    tone: D.amber, overdue: false };
  if (days === 1) return { label: 'Tomorrow', tone: D.green, overdue: false };
  if (days <= 7)  return { label: `in ${days}d`, tone: D.green, overdue: false };
  return {
    label: new Date(`${dueKey}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }),
    tone: D.muted, overdue: false,
  };
}

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

// Stage pill — consistent across every view.
export function StageChip({ stage, size = 'small', sx = {} }) {
  const m = stageMeta(stage);
  return (
    <Chip
      label={m.label}
      size={size}
      sx={{
        bgcolor: m.bg, color: m.color, fontWeight: 800, fontSize: 11, height: 22,
        border: `1px solid ${m.color}40`, letterSpacing: 0.2, ...sx,
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
