// src/screens/studio/crm/TodayView.js
// The daily driver — "who do I call today". Reads /api/crm/today. Overdue-first
// rows (the backend already sorts ascending nextFollowUp = most-overdue first).
// Each row is a tap-target on mobile: company + stage + interest/area, the most
// recent log inline, and the follow-up status. Per-row actions: tap-to-call,
// log a call, reschedule, open the company.

import * as React from 'react';
import {
  Box, Stack, Typography, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { D, mono, fmtRelative } from '../_shared';
import {
  StageChip, EmptyState, interestLabel, followUpStatus, telHref, primaryPhone, kindMeta,
} from './_crm';

// One stat block in the summary strip.
function StatPill({ value, label, tone }) {
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

function CallRow({ row, onOpen, onLog, onReschedule }) {
  const fu = followUpStatus(row.nextFollowUp);
  const phone = primaryPhone(row);
  const last = row.lastLog;
  const LastIcon = last ? kindMeta(last.kind).Icon : null;
  const accent = fu.overdue ? '#f87171' : (fu.label === 'Today' ? D.amber : D.green);

  return (
    <Box
      onClick={() => onOpen(row.companyKey)}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(row.companyKey); }}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5,
        p: { xs: 1.5, sm: 2 }, pl: { xs: 2, sm: 2.25 },
        transition: 'border-color 0.18s ease, transform 0.18s ease, background 0.18s ease',
        '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi, transform: 'translateY(-1px)' },
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: accent,
        },
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
        {/* Identity + context */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.4 }}>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15, minWidth: 0 }}>
              {row.name}
            </Typography>
            <StageChip stage={row.stage} />
            <Typography sx={{ ...mono, color: fu.tone, fontSize: 12, fontWeight: 700 }}>
              {fu.label}
            </Typography>
          </Stack>

          <Typography sx={{ color: D.muted, fontSize: 12.5 }}>
            {[interestLabel(row.interestType) !== '—' ? interestLabel(row.interestType) : null, row.area]
              .filter(Boolean).join(' · ') || '—'}
          </Typography>

          {last && (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.6, minWidth: 0 }}>
              {LastIcon && <LastIcon sx={{ fontSize: 14, color: kindMeta(last.kind).color, flexShrink: 0 }} />}
              <Typography sx={{
                color: D.faint, fontSize: 12, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {last.text}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.32)', fontSize: 11, flexShrink: 0, ...mono }}>
                · {fmtRelative(last.at)}
              </Typography>
            </Stack>
          )}
        </Box>

        {/* Actions — big tap targets; stop propagation so they don't open the row */}
        <Stack
          direction="row" spacing={0.5} alignItems="center" flexShrink={0}
          onClick={(e) => e.stopPropagation()}
        >
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
                <PhoneInTalkIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Log call">
            <IconButton onClick={() => onLog(row)} size="small"
              sx={{ color: D.muted, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.05)' } }}>
              <EditNoteOutlinedIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reschedule">
            <IconButton onClick={() => onReschedule(row)} size="small"
              sx={{ color: D.muted, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.05)' } }}>
              <EventRepeatOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <ChevronRightIcon sx={{ color: D.faint, fontSize: 20, display: { xs: 'none', sm: 'block' } }} />
        </Stack>
      </Stack>
    </Box>
  );
}

export default function TodayView({ summary, rows, loading, onOpen, onLog, onReschedule }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }

  const overdue = summary?.overdue || 0;
  const dueToday = summary?.dueToday || 0;
  const total = summary?.total || 0;

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1.25}>
        <StatPill value={overdue} label="Overdue" tone={overdue > 0 ? '#f87171' : D.muted} />
        <StatPill value={dueToday} label="Due today" tone={dueToday > 0 ? D.amber : D.muted} />
        <StatPill value={total} label="To call" tone={D.green} />
      </Stack>

      {rows.length === 0 ? (
        <EmptyState
          icon={<TaskAltOutlinedIcon />}
          title="You're all caught up"
          hint="No follow-ups are due today. Nice work."
        />
      ) : (
        <Stack spacing={1.25}>
          {rows.map((row) => (
            <CallRow
              key={row.companyKey}
              row={row}
              onOpen={onOpen}
              onLog={onLog}
              onReschedule={onReschedule}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
