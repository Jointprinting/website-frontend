// src/screens/studio/crm/DashboardView.js
// The CRM landing page — a single-glance command center fed by /api/crm/dashboard.
// Four bands, top to bottom:
//   1. Metric cards     — open pipeline $, weighted forecast $, overdue, due
//                         today, touches (7d). Monospace figures.
//   2. Stage funnel     — count + $ per stage as CSS bars (no chart lib), bar
//                         width ∝ count, $ labeled on the right.
//   3. Needs attention  — the heads-up feed (THE centerpiece): prioritized rows,
//                         each with an icon, the message, and the same quick
//                         actions as Today (tap-to-call, log, reschedule, open),
//                         driven by the SAME dialogs/transport.
//   4. Breakdowns       — counts + open $ by area and by interest.
// Presentational only: the parent (CrmTab) owns data + the dialog transport and
// passes the handlers, so a heads-up row's "Log call" opens the very same
// LogTouchDialog a Today row does.

import * as React from 'react';
import {
  Box, Stack, Typography, IconButton, Tooltip, CircularProgress, Button,
} from '@mui/material';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { D, mono } from '../_shared';
import {
  StageChip, Eyebrow, EmptyState, stageMeta, interestLabel, telHref, fmtMoney0,
  headsUpMeta, severityMeta,
} from './_crm';

// ── Metric card ────────────────────────────────────────────────────────────────
// One headline figure + label. `accent` paints the number; `hint` is an optional
// sub-line (e.g. "30d: 12").
function MetricCard({ label, value, accent, hint }) {
  return (
    <Box sx={{
      flex: '1 1 150px', minWidth: 132, px: { xs: 1.5, sm: 2 }, py: { xs: 1.4, sm: 1.75 },
      borderRadius: 2.5, bgcolor: D.panel, border: `1px solid ${D.line}`,
    }}>
      <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ ...mono, color: accent || D.text, fontSize: { xs: 22, sm: 26 }, fontWeight: 800, lineHeight: 1.15, mt: 0.4 }}>
        {value}
      </Typography>
      {hint && (
        <Typography sx={{ ...mono, color: D.faint, fontSize: 11, fontWeight: 700, mt: 0.25 }}>{hint}</Typography>
      )}
    </Box>
  );
}

// ── Stage funnel ────────────────────────────────────────────────────────────────
// A horizontal bar per stage; width is the stage's share of the max count so the
// busiest stage fills the track. Count + $ ride at the ends. Pure CSS — no chart
// dependency.
function StageFunnel({ stages }) {
  const rows = stages || [];
  const maxCount = Math.max(1, ...rows.map((s) => s.count || 0));
  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: { xs: 1.75, sm: 2 } }}>
      <Eyebrow sx={{ mb: 1.5 }}>Pipeline by stage</Eyebrow>
      <Stack spacing={0.9}>
        {rows.map((s) => {
          const m = stageMeta(s.stage);
          const pct = Math.round(((s.count || 0) / maxCount) * 100);
          return (
            <Stack key={s.stage} direction="row" alignItems="center" spacing={1.25}>
              {/* Stage label — fixed width so bars left-align */}
              <Box sx={{ width: 88, flexShrink: 0 }}>
                <StageChip stage={s.stage} />
              </Box>
              {/* Bar track */}
              <Box sx={{ flexGrow: 1, minWidth: 0, height: 22, borderRadius: 1, bgcolor: D.inset, position: 'relative', overflow: 'hidden' }}>
                <Box sx={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, minWidth: s.count > 0 ? 4 : 0,
                  bgcolor: m.color, opacity: 0.85, borderRadius: 1,
                  transition: 'width 0.4s ease',
                }} />
                <Typography sx={{
                  ...mono, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11.5, fontWeight: 800, color: pct > 12 ? D.ink : D.muted,
                }}>
                  {s.count}
                </Typography>
              </Box>
              {/* $ for the stage */}
              <Typography sx={{ ...mono, width: 64, flexShrink: 0, textAlign: 'right', color: s.value > 0 ? D.muted : D.faint, fontSize: 11.5, fontWeight: 700 }}>
                {s.value > 0 ? fmtMoney0(s.value) : '—'}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

// ── Heads-up row ─────────────────────────────────────────────────────────────
// One attention item. Left rail = severity color; type icon + message + name;
// right side = the same quick actions Today uses. Whole row opens the company.
function HeadsUpRow({ item, onOpen, onLog, onReschedule }) {
  const meta = headsUpMeta(item.type);
  const sev = severityMeta(item.severity);
  const Icon = meta.Icon;
  const phone = item.phone || '';

  return (
    <Box
      onClick={() => onOpen(item.companyKey)}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item.companyKey); }}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5,
        p: { xs: 1.5, sm: 1.75 }, pl: { xs: 2, sm: 2.25 },
        transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.18s ease',
        '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi, transform: 'translateY(-1px)' },
        '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: sev.color },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        {/* Type glyph */}
        <Box sx={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 2, display: 'flex',
          alignItems: 'center', justifyContent: 'center', bgcolor: sev.bg, border: `1px solid ${meta.color}40`,
        }}>
          <Icon sx={{ fontSize: 19, color: meta.color }} />
        </Box>

        {/* Identity + message */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.2 }}>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5, minWidth: 0 }}>{item.name}</Typography>
            {item.value > 0 && (
              <Typography sx={{ ...mono, color: D.green, fontWeight: 800, fontSize: 12.5 }}>{fmtMoney0(item.value)}</Typography>
            )}
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.message}
          </Typography>
        </Box>

        {/* Quick actions — same set + behavior as Today; stop propagation so they
            don't also open the company. */}
        <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={phone ? `Call ${phone}` : 'No phone on file'}>
            <span>
              <IconButton
                component={phone ? 'a' : 'button'} href={phone ? telHref(phone) : undefined}
                disabled={!phone} size="small"
                sx={{
                  color: D.green, bgcolor: 'rgba(74,222,128,0.1)', border: `1px solid ${D.line}`,
                  '&:hover': { bgcolor: 'rgba(74,222,128,0.2)' },
                  '&.Mui-disabled': { color: D.faint, bgcolor: 'transparent' },
                }}
              >
                <PhoneInTalkIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Log call">
            <IconButton onClick={() => onLog(item)} size="small"
              sx={{ color: D.muted, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.05)' } }}>
              <EditNoteOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reschedule">
            <IconButton onClick={() => onReschedule(item)} size="small"
              sx={{ color: D.muted, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.05)' } }}>
              <EventRepeatOutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <ChevronRightIcon sx={{ color: D.faint, fontSize: 20, display: { xs: 'none', sm: 'block' } }} />
        </Stack>
      </Stack>
    </Box>
  );
}

// ── Breakdown table ──────────────────────────────────────────────────────────
// A compact "label · count · $" list, reused for area + interest. `labelFor`
// maps the raw key to a display string (interest codes → friendly names).
function Breakdown({ title, rows, labelFor }) {
  const list = (rows || []).filter((r) => (r.count || 0) > 0);
  return (
    <Box sx={{ flex: '1 1 280px', minWidth: 240, bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: { xs: 1.75, sm: 2 } }}>
      <Eyebrow sx={{ mb: 1.25 }}>{title}</Eyebrow>
      {list.length === 0 ? (
        <Typography sx={{ color: D.faint, fontSize: 12.5 }}>No data yet.</Typography>
      ) : (
        <Stack spacing={0.75}>
          {list.map((r, i) => (
            <Stack key={i} direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ color: D.text, fontSize: 13, fontWeight: 600, flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {labelFor(r)}
              </Typography>
              <Typography sx={{ ...mono, color: D.faint, fontSize: 12, fontWeight: 700, width: 34, textAlign: 'right' }}>{r.count}</Typography>
              <Typography sx={{ ...mono, color: r.openValue > 0 ? D.muted : D.faint, fontSize: 12, fontWeight: 700, width: 60, textAlign: 'right' }}>
                {r.openValue > 0 ? fmtMoney0(r.openValue) : '—'}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default function DashboardView({ data, loading, onOpen, onLog, onReschedule }) {
  // Heads-up expander state — declared before any early return so hook order is
  // stable across the loading / loaded renders.
  const [showAll, setShowAll] = React.useState(false);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }

  const pipeline = data?.pipeline || {};
  const followUps = data?.followUps || {};
  const activity = data?.activity || {};
  const breakdowns = data?.breakdowns || {};
  const heads = data?.headsUp || { items: [], counts: {}, total: 0 };

  const overdue = followUps.overdue || 0;
  const dueToday = followUps.dueToday || 0;

  // Heads-up items, capped further for the surface (the endpoint already caps at
  // 25; we show up to 12 by default with a "show all" expander).
  const items = heads.items || [];
  const shown = showAll ? items : items.slice(0, 12);

  return (
    <Stack spacing={2.5}>
      {/* 1 — Metric cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        <MetricCard label="Open pipeline" value={fmtMoney0(pipeline.totalOpenValue || 0)} accent={D.text} />
        <MetricCard label="Weighted forecast" value={fmtMoney0(pipeline.weightedValue || 0)} accent={D.green} />
        <MetricCard label="Overdue" value={overdue} accent={overdue > 0 ? '#f87171' : D.muted} />
        <MetricCard label="Due today" value={dueToday} accent={dueToday > 0 ? D.amber : D.muted} />
        <MetricCard
          label="Touches (7d)" value={activity.touches7 || 0} accent={D.text}
          hint={`30d: ${activity.touches30 || 0}`}
        />
      </Box>

      {/* 2 — Stage funnel */}
      <StageFunnel stages={pipeline.stages} />

      {/* 3 — Needs your attention (the centerpiece) */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Eyebrow>Needs your attention</Eyebrow>
          {heads.total > 0 && (
            <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5, fontWeight: 700 }}>
              {heads.total} item{heads.total === 1 ? '' : 's'}
            </Typography>
          )}
        </Stack>

        {items.length === 0 ? (
          <EmptyState
            icon={<TaskAltOutlinedIcon />}
            title="Nothing needs chasing"
            hint="No overdue, stale, or neglected deals right now. Great spot to be in."
          />
        ) : (
          <Stack spacing={1}>
            {shown.map((item) => (
              <HeadsUpRow
                key={`${item.type}:${item.companyKey}`}
                item={item}
                onOpen={onOpen}
                onLog={onLog}
                onReschedule={onReschedule}
              />
            ))}
            {items.length > 12 && (
              <Button
                onClick={() => setShowAll((v) => !v)}
                sx={{ alignSelf: 'center', textTransform: 'none', color: D.muted, fontWeight: 700, fontSize: 12.5,
                  '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.06)' } }}
              >
                {showAll ? 'Show fewer' : `Show all ${items.length}`}
              </Button>
            )}
          </Stack>
        )}
      </Box>

      {/* 4 — Breakdowns */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        <Breakdown
          title="By area" rows={breakdowns.byArea}
          labelFor={(r) => r.area || 'Unassigned'}
        />
        <Breakdown
          title="By interest" rows={breakdowns.byInterest}
          labelFor={(r) => (r.interestType ? interestLabel(r.interestType) : 'Unknown')}
        />
      </Box>
    </Stack>
  );
}
