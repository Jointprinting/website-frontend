// src/screens/studio/outreach/OverviewView.js
// The landing view: engine health (sender, window, warm-up cap), per-campaign
// funnels, the WARM LEADS list (replied/opened — the callbacks that matter),
// and recent send activity. Warm rows deep-link to the CRM company card.

import * as React from 'react';
import {
  Box, Stack, Typography, CircularProgress, Button, Tooltip, IconButton, Alert, TextField,
} from '@mui/material';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { D, mono, fmtRelative } from '../_shared';
import { EmptyState, Eyebrow } from '../crm/_crm';
import { StatusChip, StatPill, campaignStatusMeta, enrollmentStatusMeta, DEFAULT_SEQUENCE } from './_outreach';

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

// Account for EVERY enrolled lead by status, so "72 enrolled · 0 sent" never reads
// as broken. The funnel above shows sent/opened/replied; this line explains the
// rest: who's still active, and who the engine deliberately HELD (no email on the
// card, already opted-out/bounced anywhere = suppressed, or turned into a client).
// Held leads aren't lost — they're the anti-spam guard doing its job.
function EnrollmentAccounting({ stats }) {
  if (!stats) return null;
  const stopped = stats.stopped || 0;
  const held = stopped + (stats.unsubscribed || 0) + (stats.failed || 0);
  if (!held) return null; // clean run — the funnel already tells the whole story
  const known = (stats.noEmail || 0) + (stats.suppressed || 0) + (stats.bounced || 0);
  const otherStopped = Math.max(0, stopped - known);
  const bits = [];
  if (stats.noEmail) bits.push(`${stats.noEmail} no email`);
  if (stats.suppressed) bits.push(`${stats.suppressed} suppressed`);
  if (stats.bounced) bits.push(`${stats.bounced} bounced`);
  if (stats.unsubscribed) bits.push(`${stats.unsubscribed} opted out`);
  if (otherStopped) bits.push(`${otherStopped} became a client / blocked`);
  if (stats.failed) bits.push(`${stats.failed} failed`);
  return (
    <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.75, lineHeight: 1.5 }}>
      <Box component="span" sx={{ color: D.text, fontWeight: 700 }}>{stats.active || 0} active</Box>
      {(stats.completed || 0) > 0 ? ` · ${stats.completed} completed` : ''}
      {' · '}
      <Box component="span" sx={{ color: D.amber, fontWeight: 700 }}>{held} held</Box>
      {` (${bits.join(' · ')}) — held = the engine's spam guard, not lost leads.`}
    </Typography>
  );
}

function WarmRow({ row, onOpenCompany, onMarkReplied, onStop, onNotAReply }) {
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
          {replied && (
            <Tooltip title="Not a real reply — it was an auto-responder. Un-warm and resume the sequence">
              <IconButton onClick={() => onNotAReply(row.enrollmentId)} size="small"
                sx={{ color: D.muted, border: `1px solid ${D.line}`,
                  '&:hover': { color: '#f87171', borderColor: '#f87171' } }}>
                <ReplyOutlinedIcon sx={{ fontSize: 18, transform: 'scaleX(-1)' }} />
              </IconButton>
            </Tooltip>
          )}
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

// The single ranked to-do list, computed server-side from the whole dashboard —
// the "what do I do right now" a busy one-person shop wants above everything.
const ACTION_TONE = { action: '#f87171', warm: '#4ade80', info: '#60a5fa', ok: '#9ca3af' };
function NextActions({ actions = [], onGoCampaigns, onGoImport, onGoReplies }) {
  if (!actions.length) return null;
  const [top, ...rest] = actions;
  const tone = (l) => ACTION_TONE[l] || D.muted;
  const cta = (c) => {
    if (!c) return null;
    const btnSx = { color: D.green, fontSize: 12, fontWeight: 800, textTransform: 'none', whiteSpace: 'nowrap',
      border: `1px solid ${D.green}55`, borderRadius: 999, px: 1.5, py: 0.3, '&:hover': { bgcolor: 'rgba(74,222,128,0.1)' } };
    if (c.view === 'campaigns') return <Button onClick={onGoCampaigns} size="small" sx={btnSx}>Campaigns →</Button>;
    if (c.view === 'import') return <Button onClick={onGoImport} size="small" sx={btnSx}>Lead engine →</Button>;
    // The warm-replies banner (often the top action) carries a 'replies' target
    // and used to render button-less — jump it to the Replies tab. ('analytics'
    // stays button-less on purpose: the deliverability detail is the Analytics
    // section on this same dashboard, right below.)
    if (c.view === 'replies' && onGoReplies) return <Button onClick={onGoReplies} size="small" sx={btnSx}>Replies →</Button>;
    return null;
  };
  return (
    <Box>
      <Eyebrow sx={{ mb: 1 }}>Next best action</Eyebrow>
      <Box sx={{ p: 1.75, borderRadius: 2.5, border: `1px solid ${tone(top.level)}55`, bgcolor: `${tone(top.level)}14`,
        display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: tone(top.level), flexShrink: 0 }} />
        <Typography sx={{ color: D.text, fontSize: 14, fontWeight: 700, flexGrow: 1, minWidth: 0 }}>{top.text}</Typography>
        {cta(top.cta)}
      </Box>
      {rest.length > 0 && (
        <Stack sx={{ mt: 1, pl: 0.5 }} spacing={0.6}>
          {rest.map((a, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tone(a.level), flexShrink: 0 }} />
              <Typography sx={{ color: D.muted, fontSize: 12.5 }}>{a.text}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

// One SPF/DKIM/DMARC record as a pass/fail chip — the live DNS check the wizard
// leans on, straight off engine.auth (from the backend's dnsAuth preflight).
function AuthChip({ label, ok }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.35, borderRadius: 999,
      bgcolor: D.inset, border: `1px solid ${ok ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}` }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ok ? D.green : '#f87171' }} />
      <Typography sx={{ ...mono, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, color: ok ? D.green : '#f87171' }}>{label}</Typography>
    </Box>
  );
}

// The "paste this, here" email-auth fixer. Renders the exact still-needed DNS
// rows the backend derives from a live lookup (engine.auth.records), each with
// a copy button, plus a re-check that bypasses the 1h DNS cache. Lives on the
// dashboard whenever auth isn't green — the owner should never have to open a
// doc to know what's missing.
function AuthFixPanel({ auth, onRecheck }) {
  const [checking, setChecking] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState('');
  if (!auth || auth.level === 'green' || auth.level === 'unknown') return null;
  const records = auth.records || [];

  const copy = async (rec) => {
    try { await navigator.clipboard.writeText(rec.value); setCopiedId(rec.id); setTimeout(() => setCopiedId(''), 1500); } catch {}
  };
  const recheck = async () => {
    setChecking(true);
    try { await onRecheck(); } finally { setChecking(false); }
  };

  const required = records.filter((r) => r.id !== 'dmarc-upgrade');
  return (
    <Box sx={{ mt: 1.25, p: 1.75, borderRadius: 2.5, bgcolor: D.panel,
      border: `1px solid ${auth.level === 'red' ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.35)'}` }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13.5, flexGrow: 1 }}>
          {required.length
            ? `Finish email authentication — ${required.length} DNS record${required.length === 1 ? '' : 's'} left on ${auth.domain}`
            : `Email auth on ${auth.domain} — optional hardening`}
        </Typography>
        <AuthChip label="SPF" ok={!!auth.spf} />
        <AuthChip label="DKIM" ok={!!auth.dkim} />
        <AuthChip label="DMARC" ok={!!auth.dmarc} />
      </Stack>
      <Stack spacing={1}>
        {records.map((rec) => (
          <Box key={rec.id} sx={{ p: 1.25, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography sx={{ ...mono, fontSize: 11, fontWeight: 800, color: rec.id === 'dmarc-upgrade' ? D.muted : D.amber }}>
                {rec.type} @ {rec.host}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button onClick={() => copy(rec)} size="small" startIcon={<ContentCopyOutlinedIcon sx={{ fontSize: 13 }} />}
                sx={{ color: copiedId === rec.id ? D.green : D.muted, fontSize: 11, textTransform: 'none', minWidth: 0,
                  border: `1px solid ${D.line}`, borderRadius: 999, px: 1.25, py: 0.1,
                  '&:hover': { borderColor: D.lineHi, color: D.text } }}>
                {copiedId === rec.id ? 'Copied' : 'Copy value'}
              </Button>
            </Stack>
            <Typography sx={{ ...mono, color: D.text, fontSize: 11.5, mt: 0.5, wordBreak: 'break-all' }}>{rec.value}</Typography>
            <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.5, lineHeight: 1.5 }}>{rec.note}</Typography>
          </Box>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
        <Button onClick={recheck} disabled={checking} size="small"
          sx={{ color: D.green, fontSize: 12, fontWeight: 800, textTransform: 'none', border: `1px solid ${D.green}55`,
            borderRadius: 999, px: 1.75, py: 0.3, '&:hover': { bgcolor: 'rgba(74,222,128,0.1)' },
            '&.Mui-disabled': { color: D.faint } }}>
          {checking ? 'Checking DNS…' : 'I added it — re-check now'}
        </Button>
        <Typography sx={{ color: D.faint, fontSize: 11 }}>DNS changes can take up to an hour to show.</Typography>
      </Stack>
    </Box>
  );
}

// Subject A/B results for one campaign — hidden until a variant send exists.
// Bolds the leading arm once both have enough volume to mean anything.
function AbStrip({ ab }) {
  if (!ab) return null;
  const enough = ab.A.sent >= 10 && ab.B.sent >= 10;
  const score = (v) => (v.sent ? (v.replied * 3 + v.opened) / v.sent : 0); // replies dominate
  const lead = enough ? (score(ab.A) === score(ab.B) ? '' : (score(ab.A) > score(ab.B) ? 'A' : 'B')) : '';
  const arm = (k, v) => (
    <Typography key={k} component="span" sx={{ ...mono, fontSize: 11,
      color: lead === k ? D.green : D.muted, fontWeight: lead === k ? 800 : 600 }}>
      {k}{lead === k ? ' ★' : ''} · {v.sent} sent · {v.opened} opened · {v.replied} replied
    </Typography>
  );
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap
      sx={{ mt: 1, px: 1.25, py: 0.6, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
      <Typography sx={{ ...mono, fontSize: 10, fontWeight: 800, color: '#c084fc', letterSpacing: 0.8 }}>A/B</Typography>
      {arm('A', ab.A)}
      <Box sx={{ width: '1px', height: 14, bgcolor: D.line }} />
      {arm('B', ab.B)}
      {!enough && <Typography sx={{ color: D.faint, fontSize: 10.5 }}>picks a leader at 10+ sends per arm</Typography>}
    </Stack>
  );
}

// One wizard step: a numbered / checked marker + a title, then (only for the
// active, not-yet-done step) an expanded action area.
function WizStep({ n, title, done, active, statusText, children, last }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ position: 'relative' }}>
      {/* Marker + connector rail */}
      <Stack alignItems="center" sx={{ flexShrink: 0 }}>
        <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
          bgcolor: done ? 'rgba(74,222,128,0.16)' : active ? 'rgba(74,222,128,0.10)' : D.inset,
          border: `1.5px solid ${done ? D.green : active ? D.green : D.line}`, transition: 'all 0.2s ease' }}>
          {done
            ? <CheckCircleRoundedIcon sx={{ fontSize: 18, color: D.green }} />
            : <Typography sx={{ ...mono, fontSize: 12.5, fontWeight: 800, color: active ? D.green : D.faint }}>{n}</Typography>}
        </Box>
        {!last && <Box sx={{ flexGrow: 1, width: 2, my: 0.5, bgcolor: done ? 'rgba(74,222,128,0.4)' : D.line, minHeight: 14 }} />}
      </Stack>
      {/* Body */}
      <Box sx={{ flexGrow: 1, minWidth: 0, pb: last ? 0 : 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ color: done || active ? D.text : D.muted, fontWeight: 800, fontSize: 14 }}>{title}</Typography>
          {done && <Typography sx={{ ...mono, fontSize: 10.5, fontWeight: 800, color: D.green, letterSpacing: 0.5 }}>DONE</Typography>}
        </Stack>
        {statusText && (
          <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.25 }}>{statusText}</Typography>
        )}
        {active && children && <Box sx={{ mt: 1.25 }}>{children}</Box>}
      </Box>
    </Stack>
  );
}

// First-run "Launch in 3 steps" guide. Reads the same overview payload as the
// rest of the dashboard, so every step checks itself off from live data:
//   1 Sender   — OUTREACH_EMAIL_FROM set + SMTP + not auth-red; live SPF/DKIM/DMARC
//                chips + a "send a test to yourself" button (the real send path).
//   2 Leads    — cold reserve or anyone enrolled.
//   3 Launch   — an active campaign.
// It only shows one open step at a time (the first unfinished one) and vanishes
// on its own once all three are green; a quiet "Hide" persists a dismissal.
function SetupWizard({ overview, onGoCampaigns, onGoImport, onTestSend }) {
  const [hidden, setHidden] = React.useState(() => {
    try { return localStorage.getItem('jp_outreach_hide_setup') === '1'; } catch { return false; }
  });
  const [testTo, setTestTo] = React.useState('');
  const [testing, setTesting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const engine = overview.engine || {};
  const campaigns = overview.campaigns || [];
  const coldReserve = overview.coldReserve || 0;
  const enrolledTotal = campaigns.reduce((a, c) => a + ((c.stats && c.stats.enrolled) || 0), 0);
  const auth = engine.auth || null;

  const senderReady = !!engine.senderConfigured && !!engine.smtpConfigured;
  const authRed = !!(auth && auth.level === 'red');
  const step1Done = senderReady && !authRed;              // amber/green/unknown all clear the gate
  const step2Done = coldReserve > 0 || enrolledTotal > 0;
  const step3Done = campaigns.some((c) => c.status === 'active');
  const steps = [step1Done, step2Done, step3Done];
  const doneCount = steps.filter(Boolean).length;

  // Vanish once fully set up, or if the operator hid the guide.
  if (doneCount === 3 || hidden) return null;
  const activeIndex = steps.findIndex((d) => !d); // first unfinished step is the open one

  const hide = () => { try { localStorage.setItem('jp_outreach_hide_setup', '1'); } catch {} setHidden(true); };
  const copyVar = async () => {
    try { await navigator.clipboard.writeText('OUTREACH_EMAIL_FROM'); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  const runTest = async () => {
    setTesting(true);
    try { await onTestSend(testTo.trim()); } finally { setTesting(false); }
  };

  const linkBtnSx = { color: D.green, fontSize: 12.5, fontWeight: 800, textTransform: 'none', whiteSpace: 'nowrap',
    border: `1px solid ${D.green}55`, borderRadius: 999, px: 1.75, py: 0.4, '&:hover': { bgcolor: 'rgba(74,222,128,0.1)' } };

  return (
    <Box sx={{ borderRadius: 3, border: `1px solid ${D.green}44`, bgcolor: 'rgba(74,222,128,0.04)', p: { xs: 2, sm: 2.5 } }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2 }}>
        <RocketLaunchOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15.5 }}>Launch in 3 steps</Typography>
          <Typography sx={{ color: D.faint, fontSize: 12 }}>{doneCount} of 3 done — finish setup and the engine runs itself.</Typography>
        </Box>
        <Button onClick={hide} size="small" sx={{ color: D.faint, fontSize: 11.5, textTransform: 'none', minWidth: 0,
          '&:hover': { color: D.muted, bgcolor: 'transparent' } }}>Hide</Button>
      </Stack>

      {/* Step 1 — Sender */}
      <WizStep n={1} title="Connect your sending address" done={step1Done} active={activeIndex === 0}
        statusText={step1Done
          ? `Sending as ${engine.from || 'your outreach address'}${
            auth && auth.level === 'green' ? ' · fully authenticated'
              : auth && auth.level === 'amber' ? ' · almost authenticated — finish the DNS record below' : ''}.`
          : !engine.senderConfigured
            ? 'No sender set yet — the engine holds all sends until you add one.'
            : authRed ? 'Sender set, but the domain isn’t authenticated yet — records below.' : 'Almost there.'}>
        <Stack spacing={1.5}>
          {!engine.senderConfigured && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
              <Typography sx={{ color: D.muted, fontSize: 12.5, lineHeight: 1.55 }}>
                On the API, set{' '}
                <Box component="code" sx={{ ...mono, color: D.green, bgcolor: 'rgba(74,222,128,0.1)', px: 0.6, py: 0.15, borderRadius: 0.75 }}>OUTREACH_EMAIL_FROM</Box>{' '}
                to a <b>dedicated</b> cold-sending address on a $10 lookalike domain — never your main jointprinting.com inbox.
                The engine starts on its own once it’s set.
              </Typography>
              <Button onClick={copyVar} size="small" startIcon={<ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />}
                sx={{ mt: 1, color: copied ? D.green : D.muted, fontSize: 11.5, textTransform: 'none', border: `1px solid ${D.line}`,
                  borderRadius: 999, px: 1.25, '&:hover': { borderColor: D.lineHi, color: D.text } }}>
                {copied ? 'Copied' : 'Copy variable name'}
              </Button>
            </Box>
          )}

          {/* SPF/DKIM/DMARC details live in the AuthFixPanel below the engine
              pills — one canonical fix-it spot with the exact records. */}

          {/* Send-a-test-to-yourself — the real send path, so you can eyeball
              inbox vs. spam before enrolling a single lead. */}
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: D.panel, border: `1px solid ${D.line}` }}>
            <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700, mb: 0.75 }}>Send a test to yourself</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@yourinbox.com"
                size="small" fullWidth type="email"
                sx={{ '& .MuiOutlinedInput-root': { color: D.text, fontSize: 13, bgcolor: D.inset,
                  '& fieldset': { borderColor: D.line }, '&:hover fieldset': { borderColor: D.lineHi },
                  '&.Mui-focused fieldset': { borderColor: D.green } },
                  '& input::placeholder': { color: D.faint, opacity: 1 } }}
              />
              <Button onClick={runTest} disabled={testing || !senderReady}
                startIcon={<SendOutlinedIcon sx={{ fontSize: 15 }} />}
                sx={{ ...linkBtnSx, py: 0.6, flexShrink: 0, opacity: (testing || !senderReady) ? 0.5 : 1 }}>
                {testing ? 'Sending…' : 'Send test'}
              </Button>
            </Stack>
            <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.75 }}>
              {senderReady
                ? 'Uses your real sender + SMTP. Check it lands in the inbox, not spam. Blank = sends to the sender address.'
                : 'Available once the sender address and SMTP are set on the API.'}
            </Typography>
          </Box>
        </Stack>
      </WizStep>

      {/* Step 2 — Leads */}
      <WizStep n={2} title="Stack up leads" done={step2Done} active={activeIndex === 1}
        statusText={step2Done
          ? `${coldReserve} in reserve${enrolledTotal ? ` · ${enrolledTotal} enrolled` : ''} — the lead engine keeps refilling on its own.`
          : 'No leads yet — the lead engine finds dispensaries state by state automatically; you can watch it work.'}>
        <Button onClick={onGoImport} size="small" sx={linkBtnSx}>Lead engine →</Button>
      </WizStep>

      {/* Step 3 — Launch */}
      <WizStep n={3} title="Launch your sequence" done={step3Done} active={activeIndex === 2} last
        statusText={step3Done
          ? 'A campaign is live — the engine drips it on its own.'
          : campaigns.length
            ? `“${campaigns[0].name}” is ready — ${(campaigns[0].steps || []).length} touches. Read the copy, tweak any wording, then hit Launch.`
            : `A ${DEFAULT_SEQUENCE.length}-touch dispensary sequence is pre-loaded — review the copy and activate it.`}>
        <Button onClick={onGoCampaigns} size="small" sx={linkBtnSx}>Open campaigns →</Button>
      </WizStep>
    </Box>
  );
}

export default function OverviewView({
  overview, loading, onOpenCompany, onMarkReplied, onStop, onNotAReply, onGoCampaigns, onGoImport, onGoReplies, onTestSend, onRecheckAuth,
}) {
  if (loading && !overview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }
  if (!overview) return null;

  const { engine, campaigns = [], warm = [], recent = [], nextActions = [] } = overview;
  const anyActive = campaigns.some((c) => c.status === 'active');

  // The first-run guide owns setup messaging while it's visible; the standalone
  // setup alerts below are the safety net for after it's dismissed/complete.
  const setupComplete =
    (engine.senderConfigured && engine.smtpConfigured && !(engine.auth && engine.auth.level === 'red')) &&
    ((overview.coldReserve || 0) > 0 || campaigns.some((c) => (c.stats && c.stats.enrolled) || 0)) &&
    anyActive;
  let wizardHidden = false;
  try { wizardHidden = localStorage.getItem('jp_outreach_hide_setup') === '1'; } catch { /* SSR/no-storage */ }
  const wizardShowing = !setupComplete && !wizardHidden;

  return (
    <Stack spacing={3}>
      {/* First-run guide — self-checking "Launch in 3 steps"; hides when set up. */}
      <SetupWizard overview={overview} onGoCampaigns={onGoCampaigns} onGoImport={onGoImport} onTestSend={onTestSend} />

      {/* The one thing to do right now — synthesized from the whole dashboard. */}
      <NextActions actions={nextActions} onGoCampaigns={onGoCampaigns} onGoImport={onGoImport} onGoReplies={onGoReplies} />

      {/* Today's plan — plain-English "here's what the engine is doing", so it can
          be trusted without babysitting. Only once it's actually running. */}
      {anyActive && overview.plan && (
        <Box>
          <Eyebrow sx={{ mb: 1 }}>Today’s plan — warm follow-ups send first, then new</Eyebrow>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <StatPill value={overview.plan.followUpsDue ?? 0} label="Follow-ups due" tone={D.green} />
            <StatPill value={overview.plan.firstTouchesDue ?? 0} label="New first-touches due" tone={D.text} />
            <StatPill value={overview.plan.inSequence ?? 0} label="In sequence" tone={D.text} />
            <StatPill value={overview.plan.reserve ?? 0} label="Reserve (auto-enrolls)"
              tone={(overview.plan.reserve ?? 0) > 0 ? D.green : D.muted} />
          </Stack>
          <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5, mt: 0.9 }}>
            {overview.plan.dueNow > 0
              ? `${overview.plan.dueNow} queued to go now, paced under today’s ${overview.plan.dailyCap || '—'}/day cap (${overview.plan.sentToday || 0} sent). The rest drip as they come due — nothing to do.`
              : `Nothing due this minute — ${overview.plan.inSequence || 0} leads mid-sequence will send as they come due, and the reserve keeps topping the pipeline up on its own.`}
          </Typography>
        </Box>
      )}

      {/* Setup guardrails — a safety net once the wizard is gone (dismissed or
          complete); while the wizard is showing it owns this messaging. */}
      {!wizardShowing && !engine.senderConfigured && (
        <Alert severity="warning" variant="outlined" sx={{ borderColor: D.amber, color: D.text, '& .MuiAlert-icon': { color: D.amber } }}>
          <b>Holding — no sends yet.</b> Set <Box component="code" sx={{ ...mono }}>OUTREACH_EMAIL_FROM</Box> on the API
          to a dedicated outreach address (a $10 lookalike domain, not the main one) and the engine starts on its own.
          Your main jointprinting.com sender is never used for cold email.
        </Alert>
      )}
      {!wizardShowing && engine.senderConfigured && !engine.publicLinksConfigured && (
        <Alert severity="info" variant="outlined" sx={{ borderColor: D.line, color: D.muted }}>
          Set <Box component="code" sx={{ ...mono }}>OUTREACH_PUBLIC_API_BASE</Box> to enable one-click unsubscribe links
          and open tracking (until then, opt-outs are reply-based and opens aren’t counted).
        </Alert>
      )}
      {/* Sender authentication details render as the AuthFixPanel below the
          engine pills — exact records, copy buttons, live re-check. */}

      {/* Engine status */}
      <Box>
        <Eyebrow sx={{ mb: 1 }}>Engine — Mon–Fri 9a–5p ET, warm-up capped</Eyebrow>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <StatPill value={`${engine.sentToday}/${engine.dailyCap}`} label="Sent today"
            tone={engine.remainingToday > 0 ? D.green : D.amber} />
          <StatPill value={`wk ${engine.rampWeek}`} label={`Ramp → ${engine.dailyCapMax}/day`} tone={D.text} />
          <StatPill value={engine.withinWindow ? 'Open' : 'Closed'} label="Send window"
            tone={engine.withinWindow ? D.green : D.muted} />
          {/* Sender + auth pills are one-time setup confirmations — once they're
              green they're just noise, so only surface them when there's actually
              something to fix. */}
          {!engine.senderConfigured && (
            <StatPill value="Not set" label="Sender" tone="#f87171" />
          )}
          {engine.auth && engine.auth.level !== 'green' && (
            <StatPill
              value={engine.auth.level === 'amber' ? 'Partial' : engine.auth.level === 'red' ? 'Fail' : '—'}
              label="SPF·DKIM·DMARC"
              tone={engine.auth.level === 'amber' ? D.amber : engine.auth.level === 'red' ? '#f87171' : D.muted} />
          )}
        </Stack>
        {engine.from ? (
          <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.75, ...mono }}>
            sending as {engine.from}{engine.lastRunAt ? ` · last run ${fmtRelative(engine.lastRunAt)}` : ''}
            {/* Outside Mon–Fri 9a–5p the engine holds — so "last run" naturally
                reads stale over a weekend. Say it's healthy, not dead. */}
            {!engine.withinWindow ? ' · window closed — healthy, resumes next weekday 9a ET' : ''}
          </Typography>
        ) : null}
        {/* Sender pool — per-inbox headroom when more than one is configured. */}
        {Array.isArray(engine.senders) && engine.senders.length > 1 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {engine.senders.map((s) => (
              <Box key={s.label} sx={{ px: 1.25, py: 0.5, borderRadius: 999, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
                <Typography component="span" sx={{ ...mono, fontSize: 11, fontWeight: 800, color: s.remaining > 0 ? D.green : D.amber }}>
                  {s.label}
                </Typography>
                <Typography component="span" sx={{ ...mono, fontSize: 11, color: D.faint }}> {s.sentToday}/{s.cap}</Typography>
              </Box>
            ))}
          </Stack>
        )}
        {/* Self-explaining cap — answers "why only 40, and how do I send more?"
            right where the number lives, instead of leaving it a mystery. */}
        {engine.senderConfigured && (engine.senderCount || 1) === 1 && (
          <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.75, lineHeight: 1.55 }}>
            <Box component="span" sx={{ color: D.muted, fontWeight: 700 }}>Why {engine.dailyCapMax}/day?</Box>{' '}
            It’s the reputation-safe ceiling for a single inbox on a young domain — it ramps 10→20→40 over the first
            weeks, then holds, which is about <b>{(engine.dailyCapMax || 40) * 5}/week</b>. One mailbox sending much more
            than that reads as spam and can get the address suspended.{' '}
            <Box component="span" sx={{ color: D.muted }}>To send more safely,</Box> the engine round-robins across
            several inboxes (each its own ~{engine.dailyCapMax}/day) — per-inbox warm-up is landing next so you can add
            them without risking the new domain.
          </Typography>
        )}
        {/* The exact DNS rows still needed for inbox placement — with copy
            buttons and a cache-busting re-check. Hidden once green. */}
        {engine.senderConfigured && <AuthFixPanel auth={engine.auth} onRecheck={onRecheckAuth} />}
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
                onOpenCompany={onOpenCompany} onMarkReplied={onMarkReplied} onStop={onStop}
                onNotAReply={onNotAReply} />
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
            hint={`Create one under Campaigns — a ${DEFAULT_SEQUENCE.length}-touch dispensary sequence is pre-loaded.`}
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
                <EnrollmentAccounting stats={c.stats} />
                {/* Subject A/B results — appears once variant sends exist. */}
                <AbStrip ab={c.abTest} />
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
            Lead engine
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
