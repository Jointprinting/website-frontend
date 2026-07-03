// src/screens/studio/outreach/OverviewView.js
// The landing view: engine health (sender, window, warm-up cap), per-campaign
// funnels, the WARM LEADS list (replied/opened — the callbacks that matter),
// and recent send activity. Warm rows deep-link to the CRM company card.

import * as React from 'react';
import {
  Box, Stack, Typography, CircularProgress, Button, Tooltip, IconButton, Alert,
} from '@mui/material';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import { D, mono, fmtRelative } from '../_shared';
import { EmptyState, Eyebrow } from '../crm/_crm';
import { StatusChip, StatPill, campaignStatusMeta, enrollmentStatusMeta } from './_outreach';

// One campaign's funnel numbers as a compact strip.
function FunnelStrip({ stats }) {
  const cells = [
    { label: 'Enrolled', value: stats.enrolled, tone: D.muted },
    { label: 'Sent',     value: stats.sent,     tone: D.text },
    { label: 'Opened',   value: stats.opened,   tone: '#fbbf24' },
    { label: 'Replied',  value: stats.replied,  tone: D.green },
    { label: 'Unsub',    value: stats.unsubscribed, tone: D.faint },
  ];
  return (
    <Stack direction="row" spacing={0} sx={{ borderRadius: 2, overflow: 'hidden', border: `1px solid ${D.line}` }}>
      {cells.map((c, i) => (
        <Box key={c.label} sx={{
          flex: 1, textAlign: 'center', py: 1, px: 0.5, bgcolor: D.inset,
          borderLeft: i ? `1px solid ${D.line}` : 'none',
        }}>
          <Typography sx={{ ...mono, fontSize: 18, fontWeight: 800, color: c.tone, lineHeight: 1.1 }}>{c.value}</Typography>
          <Typography sx={{ color: D.faint, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>{c.label}</Typography>
        </Box>
      ))}
    </Stack>
  );
}

function WarmRow({ row, onOpenCompany, onMarkReplied, onStop }) {
  const meta = enrollmentStatusMeta(row.status);
  const replied = row.status === 'replied';
  const when = row.repliedAt || row.lastOpenedAt;
  return (
    <Box
      onClick={() => onOpenCompany(row.companyKey)}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpenCompany(row.companyKey); }}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 },
        transition: 'border-color 0.18s ease, transform 0.18s ease, background 0.18s ease',
        '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi, transform: 'translateY(-1px)' },
        '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: replied ? D.green : '#fbbf24' },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.3 }}>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5 }}>{row.companyName || row.companyKey}</Typography>
            <StatusChip meta={replied ? meta : { ...meta, label: `Opened ×${row.openCount}`, color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' }} />
          </Stack>
          <Typography sx={{ color: D.faint, fontSize: 12 }}>
            {row.campaignName}{when ? ` · ${fmtRelative(when)}` : ''} · {row.sends} sent
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0} onClick={(e) => e.stopPropagation()}>
          {!replied && (
            <Tooltip title="They replied — stop the sequence, tag warm, call today">
              <IconButton onClick={() => onMarkReplied(row.enrollmentId)} size="small"
                sx={{ color: D.green, bgcolor: 'rgba(74,222,128,0.1)', border: `1px solid ${D.line}`,
                  '&:hover': { bgcolor: 'rgba(74,222,128,0.2)' } }}>
                <MarkEmailReadOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {row.status === 'active' && (
            <Tooltip title="Stop this company's sequence">
              <IconButton onClick={() => onStop(row.enrollmentId)} size="small"
                sx={{ color: D.muted, '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}>
                <HighlightOffOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <ChevronRightIcon sx={{ color: D.faint, fontSize: 20, display: { xs: 'none', sm: 'block' } }} />
        </Stack>
      </Stack>
    </Box>
  );
}

export default function OverviewView({
  overview, loading, onOpenCompany, onMarkReplied, onStop, onGoCampaigns, onGoImport,
}) {
  if (loading && !overview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }
  if (!overview) return null;

  const { engine, campaigns = [], warm = [], recent = [] } = overview;
  const anyActive = campaigns.some((c) => c.status === 'active');

  return (
    <Stack spacing={3}>
      {/* Setup guardrails — surfaced loudly until sending is actually possible. */}
      {!engine.senderConfigured && (
        <Alert severity="warning" variant="outlined" sx={{ borderColor: D.amber, color: D.text, '& .MuiAlert-icon': { color: D.amber } }}>
          <b>Holding — no sends yet.</b> Set <Box component="code" sx={{ ...mono }}>OUTREACH_EMAIL_FROM</Box> on the API
          to a dedicated outreach address (a $10 lookalike domain, not the main one) and the engine starts on its own.
          Your main jointprinting.com sender is never used for cold email.
        </Alert>
      )}
      {engine.senderConfigured && !engine.publicLinksConfigured && (
        <Alert severity="info" variant="outlined" sx={{ borderColor: D.line, color: D.muted }}>
          Set <Box component="code" sx={{ ...mono }}>OUTREACH_PUBLIC_API_BASE</Box> to enable one-click unsubscribe links
          and open tracking (until then, opt-outs are reply-based and opens aren’t counted).
        </Alert>
      )}

      {/* Engine status */}
      <Box>
        <Eyebrow sx={{ mb: 1 }}>Engine — Mon–Fri 9a–5p ET, warm-up capped</Eyebrow>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <StatPill value={`${engine.sentToday}/${engine.dailyCap}`} label="Sent today"
            tone={engine.remainingToday > 0 ? D.green : D.amber} />
          <StatPill value={`wk ${engine.rampWeek}`} label={`Ramp → ${engine.dailyCapMax}/day`} tone={D.text} />
          <StatPill value={engine.withinWindow ? 'Open' : 'Closed'} label="Send window"
            tone={engine.withinWindow ? D.green : D.muted} />
          <StatPill value={engine.senderConfigured ? 'Ready' : 'Not set'} label="Sender"
            tone={engine.senderConfigured ? D.green : '#f87171'} />
        </Stack>
        {engine.from ? (
          <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.75, ...mono }}>
            sending as {engine.from}{engine.lastRunAt ? ` · last run ${fmtRelative(engine.lastRunAt)}` : ''}
          </Typography>
        ) : null}
      </Box>

      {/* Warm leads — the whole point of the tool. */}
      <Box>
        <Eyebrow sx={{ mb: 1 }}>Warm leads — replied or opening your emails</Eyebrow>
        {warm.length === 0 ? (
          <EmptyState
            icon={<LocalFireDepartmentOutlinedIcon />}
            title="No warm leads yet"
            hint={anyActive
              ? 'The engine is working — replies and opens will pile up here.'
              : 'Activate a campaign and enroll leads to start the drip.'}
          />
        ) : (
          <Stack spacing={1.25}>
            {warm.map((row) => (
              <WarmRow key={String(row.enrollmentId)} row={row}
                onOpenCompany={onOpenCompany} onMarkReplied={onMarkReplied} onStop={onStop} />
            ))}
          </Stack>
        )}
      </Box>

      {/* Campaign funnels */}
      <Box>
        <Eyebrow sx={{ mb: 1 }}>Campaigns</Eyebrow>
        {campaigns.length === 0 ? (
          <EmptyState
            icon={<ForwardToInboxOutlinedIcon />}
            title="No campaigns yet"
            hint="Create one under Campaigns — a proven 3-step dispensary sequence is pre-loaded."
          />
        ) : (
          <Stack spacing={1.5}>
            {campaigns.map((c) => (
              <Box key={c._id} sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                  <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5, flexGrow: 1, minWidth: 0 }}>
                    {c.name}
                  </Typography>
                  <StatusChip meta={campaignStatusMeta(c.status)} />
                </Stack>
                <FunnelStrip stats={c.stats} />
                {/* When a campaign is active but not sending, say exactly why —
                    right here on the dashboard, in red, no digging required. */}
                {c.health && c.health.level !== 'ok' && (
                  <Box sx={{ mt: 1, p: 1, borderRadius: 2, display: 'flex', gap: 1, alignItems: 'flex-start',
                    bgcolor: c.health.level === 'action' ? 'rgba(248,113,113,0.10)' : 'rgba(251,191,36,0.08)',
                    border: `1px solid ${c.health.level === 'action' ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.3)'}` }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', mt: '5px', flexShrink: 0,
                      bgcolor: c.health.level === 'action' ? '#f87171' : '#fbbf24' }} />
                    <Typography sx={{ fontSize: 11.5, lineHeight: 1.45 }}>
                      <Box component="span" sx={{ color: c.health.level === 'action' ? '#f87171' : '#fbbf24', fontWeight: 800 }}>{c.health.label}</Box>
                      <Box component="span" sx={{ color: D.muted }}> — {c.health.hint}</Box>
                    </Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button onClick={onGoCampaigns} size="small"
            sx={{ textTransform: 'none', color: D.green, fontWeight: 700, fontSize: 12.5, borderRadius: 999,
              px: 1.75, border: `1px solid ${D.line}`, '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.06)' } }}>
            Manage campaigns
          </Button>
          <Button onClick={onGoImport} size="small"
            sx={{ textTransform: 'none', color: D.muted, fontWeight: 700, fontSize: 12.5, borderRadius: 999,
              px: 1.75, border: `1px solid ${D.line}`, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.04)' } }}>
            Import leads
          </Button>
        </Stack>
      </Box>

      {/* Recent sends */}
      {recent.length > 0 && (
        <Box>
          <Eyebrow sx={{ mb: 1 }}>Recent activity</Eyebrow>
          <Stack spacing={0.75}>
            {recent.map((r, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center"
                onClick={() => onOpenCompany(r.companyKey)}
                sx={{ cursor: 'pointer', px: 1.5, py: 1, borderRadius: 2, bgcolor: D.inset,
                  border: `1px solid ${D.line}`, '&:hover': { borderColor: D.lineHi } }}>
                {r.opened
                  ? <DraftsOutlinedIcon sx={{ fontSize: 15, color: '#fbbf24', flexShrink: 0 }} />
                  : <ForwardToInboxOutlinedIcon sx={{ fontSize: 15, color: D.muted, flexShrink: 0 }} />}
                <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
                  {r.companyName || r.companyKey}
                </Typography>
                <Typography sx={{ color: D.faint, fontSize: 12, minWidth: 0, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                  “{r.subject}”
                </Typography>
                <Typography sx={{ ...mono, color: D.faint, fontSize: 11, flexShrink: 0 }}>
                  {fmtRelative(r.at)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
