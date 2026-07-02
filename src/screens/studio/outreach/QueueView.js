// src/screens/studio/outreach/QueueView.js
// What the engine sends next: active enrollments ordered by due time, plus a
// "send the next batch now" trigger (same code path as the cron — the window,
// warm-up cap, and per-company guards all still apply).

import * as React from 'react';
import {
  Box, Stack, Typography, CircularProgress, Button, Tooltip, IconButton,
} from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { D, mono, dropPrimaryBtn } from '../_shared';
import { EmptyState } from '../crm/_crm';
import { StatPill } from './_outreach';

const dueLabel = (iso) => {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'due now';
  const h = Math.round(ms / 3600000);
  if (h < 24) return `in ~${Math.max(1, h)}h`;
  return `in ${Math.round(h / 24)}d`;
};

export default function QueueView({ queue, loading, engine, onRunTick, onStop, onOpenCompany }) {
  const [running, setRunning] = React.useState(false);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }

  const dueNow = queue.filter((r) => r.nextSendAt && new Date(r.nextSendAt) <= new Date()).length;
  const runNow = async () => {
    setRunning(true);
    try { await onRunTick(); } finally { setRunning(false); }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1.25}>
        <StatPill value={dueNow} label="Due now" tone={dueNow > 0 ? D.amber : D.muted} />
        <StatPill value={queue.length} label="In sequences" tone={D.text} />
        {engine && (
          <StatPill value={`${engine.sentToday}/${engine.dailyCap}`} label="Sent today"
            tone={engine.remainingToday > 0 ? D.green : D.amber} />
        )}
      </Stack>

      <Stack direction="row" justifyContent="flex-end">
        <Tooltip title="Runs one engine batch immediately — window, daily cap, and guards still apply">
          <span>
            <Button onClick={runNow} disabled={running || dueNow === 0}
              startIcon={<SendOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ ...dropPrimaryBtn, px: 2, py: 0.6, fontSize: 12.5 }}>
              {running ? 'Sending…' : 'Send next batch now'}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {queue.length === 0 ? (
        <EmptyState icon={<ScheduleOutlinedIcon />} title="Queue is empty"
          hint="Enroll leads into an active campaign and they'll line up here." />
      ) : (
        <Stack spacing={0.75}>
          {queue.map((r) => {
            const due = r.nextSendAt && new Date(r.nextSendAt) <= new Date();
            return (
              <Stack key={String(r.enrollmentId)} direction="row" spacing={1} alignItems="center"
                onClick={() => onOpenCompany(r.companyKey)}
                sx={{ cursor: 'pointer', px: 1.5, py: 1, borderRadius: 2, bgcolor: D.panel,
                  border: `1px solid ${D.line}`, '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi } }}>
                <Typography sx={{ ...mono, fontSize: 11, fontWeight: 800, flexShrink: 0,
                  color: due ? D.amber : D.faint, width: 64 }}>
                  {dueLabel(r.nextSendAt)}
                </Typography>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ color: D.text, fontSize: 13, fontWeight: 700 }}>
                      {r.companyName || r.companyKey}
                    </Typography>
                    <Typography sx={{ ...mono, color: D.faint, fontSize: 11 }}>
                      step {r.stepIndex + 1}/{r.stepCount} · {r.campaignName}
                      {r.campaignStatus === 'paused' ? ' (paused)' : ''}
                    </Typography>
                  </Stack>
                  <Typography sx={{ color: D.faint, fontSize: 11.5, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    “{r.stepSubject}” → {r.toEmail}
                  </Typography>
                </Box>
                {r.sends > 0 && (
                  <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5, flexShrink: 0,
                    display: { xs: 'none', sm: 'block' } }}>
                    {r.sends} sent
                  </Typography>
                )}
                <Tooltip title="Stop this company's sequence">
                  <IconButton size="small"
                    onClick={(e) => { e.stopPropagation(); onStop(r.enrollmentId); }}
                    sx={{ color: D.muted, flexShrink: 0, '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}>
                    <HighlightOffOutlinedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
        The engine sends automatically Mon–Fri, 9a–5p ET, a few at a time. The daily cap DOUBLES each week
        (10 → 20 → 40 → 80 …){engine ? ` — you’re in week ${engine.rampWeek} at ${engine.dailyCap}/day, climbing to ${engine.dailyCapMax}` : ''}.
        Starting low and doubling is what keeps a new sending domain out of spam while it scales.
        Follow-ups pace themselves off each company’s previous send.
      </Typography>
    </Stack>
  );
}
