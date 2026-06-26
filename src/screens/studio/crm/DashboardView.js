// src/screens/studio/crm/DashboardView.js
// The CRM landing page — a single-glance command center fed by /api/crm/dashboard.
// Four bands, top to bottom:
//   1. Metric cards     — open pipeline $, weighted forecast $, overdue, due
//                         today, customers. Monospace figures.
//   2. Stage funnel     — count + $ per stage as CSS bars (no chart lib), bar
//                         width ∝ count, $ labeled on the right.
//   3. Needs attention  — the heads-up feed (THE centerpiece): prioritized rows,
//                         each with an icon, the message, and the same quick
//                         actions as Today (tap-to-call, log, reschedule, open),
//                         driven by the SAME dialogs/transport.
//   4. Working widgets  — this-week agenda, conversion snapshot, biggest deals.
// Presentational only: the parent (CrmTab) owns data + the dialog transport and
// passes the handlers, so a heads-up row's "Log call" opens the very same
// LogTouchDialog a Today row does.

import * as React from 'react';
import {
  Box, Stack, Typography, IconButton, Tooltip, CircularProgress, Button, LinearProgress,
} from '@mui/material';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import { D, mono } from '../_shared';
import {
  Eyebrow, EmptyState, stageMeta, telHref, fmtMoney0,
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

// ── Heads-up row ─────────────────────────────────────────────────────────────
// One attention item. Left rail = severity color; type icon + message + name;
// right side = the same quick actions Today uses + a one-tap "clear" (archive)
// so a cold lead can be cleared from attention without deleting (soft/reversible
// — the toast offers Undo). Whole row opens the company.
function HeadsUpRow({ item, onOpen, onLog, onReschedule, onArchive }) {
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
          {onArchive && (
            <Tooltip title="Clear from attention (archive — recoverable)">
              <IconButton onClick={() => onArchive(item)} size="small"
                sx={{ color: D.muted, '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.1)' } }}>
                <Inventory2OutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}
          <ChevronRightIcon sx={{ color: D.faint, fontSize: 20, display: { xs: 'none', sm: 'block' } }} />
        </Stack>
      </Stack>
    </Box>
  );
}

// A small card shell with an eyebrow header and optional right-side accessory.
function WidgetCard({ title, right, children, sx = {} }) {
  return (
    <Box sx={{ flex: '1 1 320px', minWidth: 280, bgcolor: D.panel, border: `1px solid ${D.line}`,
      borderRadius: 2.5, p: { xs: 1.75, sm: 2 }, ...sx }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Eyebrow>{title}</Eyebrow>
        {right}
      </Stack>
      {children}
    </Box>
  );
}

// ── This-week agenda ──────────────────────────────────────────────────────────
// A planner strip: overdue / due today / due this week as three weighted bars
// with a one-tap jump to the Today list. The owner's "what's on my plate" glance.
function ThisWeekAgenda({ followUps, onGoToday }) {
  const overdue = followUps.overdue || 0;
  const dueToday = followUps.dueToday || 0;
  const dueWeek = followUps.dueThisWeek || 0;
  const rows = [
    { label: 'Overdue', value: overdue, color: '#f87171' },
    { label: 'Due today', value: dueToday, color: D.amber },
    { label: 'Due this week', value: dueWeek, color: D.green },
  ];
  const max = Math.max(1, overdue, dueToday, dueWeek);
  const clear = overdue + dueToday + dueWeek === 0;
  return (
    <WidgetCard
      title="This week"
      right={onGoToday && (
        <Button onClick={onGoToday} size="small" endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', color: D.green, fontWeight: 700, fontSize: 12,
            '&:hover': { bgcolor: 'rgba(74,222,128,0.06)' } }}>
          Open Today
        </Button>
      )}
    >
      {clear ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1.5 }}>
          <TaskAltOutlinedIcon sx={{ color: D.green, fontSize: 22 }} />
          <Typography sx={{ color: D.muted, fontSize: 13, fontWeight: 600 }}>Nothing due this week. Clear runway.</Typography>
        </Stack>
      ) : (
        <Stack spacing={1.1}>
          {rows.map((r) => (
            <Stack key={r.label} direction="row" alignItems="center" spacing={1.25}>
              <Typography sx={{ width: 92, flexShrink: 0, color: D.muted, fontSize: 12, fontWeight: 700 }}>{r.label}</Typography>
              <Box sx={{ flexGrow: 1, height: 18, borderRadius: 1, bgcolor: D.inset, position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 1,
                  width: `${Math.round((r.value / max) * 100)}%`, minWidth: r.value > 0 ? 4 : 0,
                  bgcolor: r.color, opacity: 0.85, transition: 'width 0.4s ease' }} />
              </Box>
              <Typography sx={{ ...mono, width: 32, textAlign: 'right', color: r.value > 0 ? r.color : D.faint, fontSize: 13, fontWeight: 800 }}>
                {r.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </WidgetCard>
  );
}

// ── Conversion snapshot ───────────────────────────────────────────────────────
// Customers (≥1 order) vs everyone tracked → a conversion ring/bar + headline
// rate. Plus weighted-vs-open as a "how much of the open pipe is likely to land".
function ConversionCard({ totalCompanies, customersWithOrders, pipeline }) {
  const total = totalCompanies || 0;
  const customers = customersWithOrders || 0;
  const rate = total > 0 ? Math.round((customers / total) * 100) : 0;
  const open = pipeline.totalOpenValue || 0;
  const weighted = pipeline.weightedValue || 0;
  const landRate = open > 0 ? Math.round((weighted / open) * 100) : 0;
  return (
    <WidgetCard title="Conversion">
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
          <CircularProgress variant="determinate" value={100} size={84} thickness={4}
            sx={{ color: D.inset, position: 'absolute', left: 0 }} />
          <CircularProgress variant="determinate" value={Math.min(100, rate)} size={84} thickness={4}
            sx={{ color: stageMeta('customer').color, position: 'absolute', left: 0,
              '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }} />
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ ...mono, fontSize: 20, fontWeight: 800, color: D.text, lineHeight: 1 }}>{rate}%</Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 800, color: D.faint, letterSpacing: 0.5, textTransform: 'uppercase' }}>won</Typography>
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="baseline">
            <EmojiEventsOutlinedIcon sx={{ fontSize: 18, color: stageMeta('customer').color }} />
            <Typography sx={{ ...mono, color: D.text, fontSize: 16, fontWeight: 800 }}>{customers}</Typography>
            <Typography sx={{ color: D.muted, fontSize: 12.5 }}>customers of {total}</Typography>
          </Stack>
          <Box sx={{ mt: 1.25 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
              <Typography sx={{ color: D.faint, fontSize: 11, fontWeight: 700 }}>Pipeline likely to land</Typography>
              <Typography sx={{ ...mono, color: D.green, fontSize: 11.5, fontWeight: 800 }}>{landRate}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={Math.min(100, landRate)}
              sx={{ height: 6, borderRadius: 999, bgcolor: D.inset,
                '& .MuiLinearProgress-bar': { bgcolor: D.green, borderRadius: 999 } }} />
            <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5, mt: 0.4 }}>
              {fmtMoney0(weighted)} weighted of {fmtMoney0(open)} open
            </Typography>
          </Box>
        </Box>
      </Stack>
    </WidgetCard>
  );
}

// ── Biggest deals on the radar ────────────────────────────────────────────────
// The highest-value OPEN deals currently flagged for attention (sourced from the
// heads-up feed, which carries each company's value). A focused "don't drop these"
// list with a tap-to-open. Genuinely actionable, unlike a static count table.
function TopDeals({ items, onOpen }) {
  const top = [...(items || [])]
    .filter((i) => (i.value || 0) > 0)
    // De-dupe by company (a company can throw multiple heads-up flags), keep its
    // highest-value mention.
    .reduce((acc, i) => {
      const prev = acc.get(i.companyKey);
      if (!prev || (i.value || 0) > (prev.value || 0)) acc.set(i.companyKey, i);
      return acc;
    }, new Map());
  const list = Array.from(top.values()).sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5);
  if (list.length === 0) return null;
  return (
    <WidgetCard title="Biggest deals on the radar">
      <Stack spacing={0.75}>
        {list.map((d) => {
          const sev = severityMeta(d.severity);
          return (
            <Box
              key={d.companyKey}
              onClick={() => onOpen(d.companyKey)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onOpen(d.companyKey); }}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, cursor: 'pointer',
                bgcolor: D.inset, border: `1px solid ${D.line}`,
                transition: 'border-color 0.15s ease, background 0.15s ease',
                '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi } }}
            >
              <LocalFireDepartmentOutlinedIcon sx={{ fontSize: 16, color: sev.color, flexShrink: 0 }} />
              <Typography sx={{ flexGrow: 1, minWidth: 0, color: D.text, fontWeight: 700, fontSize: 13,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.name}
              </Typography>
              <Typography sx={{ ...mono, color: D.green, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                {fmtMoney0(d.value)}
              </Typography>
              <ChevronRightIcon sx={{ color: D.faint, fontSize: 18, flexShrink: 0 }} />
            </Box>
          );
        })}
      </Stack>
    </WidgetCard>
  );
}

export default function DashboardView({ data, loading, onOpen, onLog, onReschedule, onArchive, onGoToday }) {
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
  const heads = data?.headsUp || { items: [], counts: {}, total: 0 };
  const totalCompanies = data?.totalCompanies || 0;
  const customersWithOrders = data?.customersWithOrders || 0;

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
          label="Customers" value={customersWithOrders} accent={stageMeta('customer').color}
          hint={`${totalCompanies} tracked`}
        />
      </Box>

      {/* Needs your attention (the centerpiece). The backend already
          down-ranks cold/never-worked leads, so this leads with overdue/hot. Each
          row gets call/log/reschedule + a one-tap clear (archive). */}
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
            title="Nothing overdue or stale"
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
                onArchive={onArchive}
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

      {/* 4 — Working widgets: this-week agenda, conversion snapshot, and the
          biggest deals on the radar. All wrap in one flex row so removing a
          widget just reflows the rest — no fixed columns, no dead gaps. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        <ThisWeekAgenda followUps={followUps} onGoToday={onGoToday} />
        <ConversionCard
          totalCompanies={totalCompanies} customersWithOrders={customersWithOrders}
          pipeline={pipeline}
        />
        <TopDeals items={items} onOpen={onOpen} />
      </Box>
    </Stack>
  );
}
