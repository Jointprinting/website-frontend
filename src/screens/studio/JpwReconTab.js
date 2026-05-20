// src/screens/studio/JpwReconTab.js
//
// JP Webworks lead recon — Phase 1 UI.
//
// Three views on one tab:
//   - Dashboard (KPI tiles: A+/A counts, by offer, no-website, weak-site)
//   - Call Queue (default — A+/A only, sorted by score, action buttons)
//   - All Leads (filters: grade, category, county, status, recommended_offer)
//
// Click any lead row → detail drawer with:
//   - Full score breakdown (buying intent / pain / ability / fit / urgency)
//   - Suggested opener (one-click copy)
//   - Edit form (status, notes, follow-up date)
//   - Push-to-Spider button (Phase 3 wire-up; UI present today)
//
// Add Lead modal — manual entry.
// Import modal — paste an Apify / OutScraper JSON or CSV-like text and the
// backend maps fields & dedupes.
//
// Theme matches the rest of Studio (dark terminal green palette).

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, Chip, Button, IconButton, TextField, MenuItem,
  Paper, Drawer, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  CircularProgress, Tooltip, LinearProgress, InputAdornment,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import LanguageIcon from '@mui/icons-material/Language';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import config from '../../config.json';

// ─────────────────────────────────────────────────────────────────────────────
// Theme (mirrors RoadTripTab so they look like siblings)
// ─────────────────────────────────────────────────────────────────────────────
const TERM = {
  bg:        '#05080a',
  panel:     '#0a0e10',
  panelLite: '#0f1518',
  border:    '#1a3d2b',
  borderDim: 'rgba(74,222,128,0.12)',
  green:     '#4ade80',
  greenDk:   '#1a3d2b',
  greenSoft: 'rgba(74,222,128,0.10)',
  amber:     '#fbbf24',
  red:       '#f87171',
  blue:      '#60a5fa',
  text:      '#d4f4dd',
  muted:     'rgba(212,244,221,0.55)',
  faint:     'rgba(212,244,221,0.18)',
};
const MONO = 'ui-monospace, "JetBrains Mono", "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';

const GRADE_COLOR = {
  'A+': '#4ade80',
  'A':  '#84cc16',
  'B':  '#fbbf24',
  'C':  '#f97316',
  'D':  '#6b7280',
};

// Shared dark input styling — keep all selects/inputs readable on dark.
const darkInputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.03)', color: TERM.text,
    fontFamily: MONO, fontSize: 13,
    '& fieldset': { borderColor: TERM.borderDim },
    '&:hover fieldset': { borderColor: TERM.green },
    '&.Mui-focused fieldset': { borderColor: TERM.green },
  },
  '& .MuiInputLabel-root': { color: TERM.muted, fontFamily: MONO, fontSize: 12 },
  '& .MuiInputLabel-root.Mui-focused': { color: TERM.green },
  '& .MuiSvgIcon-root': { color: TERM.muted },
  '& .MuiSelect-select': { color: TERM.text },
  '& input': { color: TERM.text },
  '& textarea': { color: TERM.text },
};

// ─────────────────────────────────────────────────────────────────────────────
// API helper — single point for axios + auth token
// ─────────────────────────────────────────────────────────────────────────────
function makeApi(token) {
  const base = axios.create({
    baseURL: `${config.backendUrl}/api/jpw`,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });
  return {
    listLeads:  (params) => base.get('/leads', { params }).then((r) => r.data),
    getLead:    (id) => base.get(`/leads/${id}`).then((r) => r.data),
    createLead: (body) => base.post('/leads', body).then((r) => r.data),
    updateLead: (id, body) => base.put(`/leads/${id}`, body).then((r) => r.data),
    deleteLead: (id) => base.delete(`/leads/${id}`).then((r) => r.data),
    stats:      () => base.get('/stats').then((r) => r.data),
    reference:  () => base.get('/reference').then((r) => r.data),
    import:     (body) => base.post('/import', body).then((r) => r.data),
    rescore:    (body) => base.post('/rescore', body).then((r) => r.data),
    bulkStatus: (body) => base.post('/bulk-status', body).then((r) => r.data),
    auditLead:  (id) => base.post(`/leads/${id}/audit`).then((r) => r.data),
    auditBatch: (body) => base.post('/audit-batch', body).then((r) => r.data),
    searchPlaces: (body) => base.post('/search/places', body).then((r) => r.data),
    sweepPlaces:  (body) => base.post('/search/sweep', body).then((r) => r.data),
    sweepStatus:  () => base.get('/search/sweep/status').then((r) => r.data),
    sweepStop:    () => base.post('/search/sweep/stop').then((r) => r.data),
    pushSpider:      (id) => base.post(`/leads/${id}/push-to-spider`).then((r) => r.data),
    pushSpiderBatch: (body) => base.post('/push-to-spider-batch', body).then((r) => r.data),
    updateAdSignal:  (id, body) => base.post(`/leads/${id}/ad-signal`, body).then((r) => r.data),
    bulkDelete:      (body) => base.post('/bulk-delete', body).then((r) => r.data),
    runJob:          (job) => base.post(`/scheduler/${job}/run`).then((r) => r.data),
    usage:      () => base.get('/usage').then((r) => r.data),
    exportCsvUrl: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return `${config.backendUrl}/api/jpw/export.csv${q ? `?${q}` : ''}`;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Small atoms
// ─────────────────────────────────────────────────────────────────────────────
function GradeChip({ grade, score }) {
  const color = GRADE_COLOR[grade] || TERM.muted;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'baseline', gap: 0.5,
      px: 1, py: 0.35, borderRadius: 1,
      border: `1px solid ${color}`,
      bgcolor: `${color}1a`,
      fontFamily: MONO, fontWeight: 700,
    }}>
      <Box sx={{ color, fontSize: 14 }}>{grade}</Box>
      {score !== undefined && (
        <Box sx={{ color: TERM.muted, fontSize: 11 }}>{score}</Box>
      )}
    </Box>
  );
}

// Binary chip — has this lead been pushed to Spider yet? Replaces the old
// 11-state call_status chip; we don't track call outcomes in Lead Recon any
// more (Spider + Cold Call Tree handle that).
function PushStateChip({ pushedAt }) {
  const pushed = !!pushedAt;
  const color = pushed ? TERM.green : TERM.muted;
  const label = pushed ? 'PUSHED ✓' : 'READY';
  const tooltip = pushed
    ? `In Spider since ${new Date(pushedAt).toLocaleDateString()}`
    : 'Not yet pushed to Spider';
  return (
    <Tooltip title={tooltip}>
      <Box sx={{
        display: 'inline-block', px: 0.9, py: 0.25, borderRadius: 0.75,
        fontFamily: MONO, fontWeight: 700, fontSize: 10,
        color, bgcolor: `${color}1a`, border: `1px solid ${color}40`,
        letterSpacing: 0.5, textTransform: 'uppercase',
      }}>{label}</Box>
    </Tooltip>
  );
}

function KpiTile({ label, value, sub, accent }) {
  return (
    <Paper elevation={0} sx={{
      bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
      p: 1.5, borderRadius: 1.5, minWidth: 130, flex: 1,
    }}>
      <Typography sx={{
        fontFamily: MONO, fontSize: 10, letterSpacing: 1.2,
        color: TERM.muted, fontWeight: 600, textTransform: 'uppercase',
      }}>{label}</Typography>
      <Typography sx={{
        fontFamily: MONO, fontSize: 24, fontWeight: 700, mt: 0.4,
        color: accent || TERM.text, lineHeight: 1,
      }}>{value}</Typography>
      {sub && (
        <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, mt: 0.4 }}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

// Checklist of audit signals. ✓ = present, ✗ = missing, "?" = not audited.
// Grouped into Conversion / SEO / Trust so the user can read at a glance
// which bucket is weak.
const AUDIT_GROUPS = [
  ['Conversion', [
    ['has_click_to_call',    'Click-to-call link'],
    ['has_visible_phone',    'Visible phone number'],
    ['has_quote_cta',        'Quote / "free estimate" CTA'],
    ['has_contact_form',     'Contact form'],
    ['has_cta_above_fold',   'CTA above the fold'],
  ]],
  ['SEO & local', [
    ['has_title',                'Title tag'],
    ['has_meta_description',     'Meta description'],
    ['has_h1',                   'H1 heading'],
    ['has_mobile_viewport',      'Mobile viewport'],
    ['has_localbusiness_schema', 'LocalBusiness schema'],
    ['has_service_area_terms',   'Service-area towns listed'],
    ['has_google_map_embed',     'Google map embed'],
  ]],
  ['Trust & proof', [
    ['has_reviews_on_site',  'Reviews / testimonials on site'],
    ['has_gallery',          'Gallery / before-after'],
    ['ssl_valid',            'SSL (https)'],
  ]],
  ['Marketing tells', [
    ['has_tracking_pixels',         'Tracking pixels installed'],
    ['has_landing_page_structure',  'Landing-page style site'],
  ]],
];

function CheckMark({ value }) {
  if (value === true) return <Box component="span" sx={{ color: TERM.green, fontFamily: MONO, fontWeight: 700 }}>✓</Box>;
  if (value === false) return <Box component="span" sx={{ color: TERM.red, fontFamily: MONO, fontWeight: 700 }}>✗</Box>;
  return <Box component="span" sx={{ color: TERM.muted, fontFamily: MONO }}>—</Box>;
}

function AuditChecklist({ audit }) {
  if (!audit) return null;
  return (
    <Box>
      {/* Header line: status, CMS, copyright */}
      <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Chip size="small" label={`HTTP ${audit.status_code || '—'}`} sx={{
          fontFamily: MONO, fontSize: 10, height: 20,
          bgcolor: audit.loads_successfully ? `${TERM.green}20` : `${TERM.red}20`,
          color: audit.loads_successfully ? TERM.green : TERM.red,
          border: `1px solid ${audit.loads_successfully ? TERM.green : TERM.red}40`,
        }} />
        {audit.cms_detected && (
          <Chip size="small" label={audit.cms_detected} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: TERM.greenSoft, color: TERM.text, border: `1px solid ${TERM.borderDim}`,
          }} />
        )}
        {audit.copyright_year && (
          <Chip size="small" label={`© ${audit.copyright_year}${audit.outdated_copyright ? ' (stale)' : ''}`} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: audit.outdated_copyright ? `${TERM.amber}20` : TERM.greenSoft,
            color: audit.outdated_copyright ? TERM.amber : TERM.text,
            border: `1px solid ${audit.outdated_copyright ? TERM.amber : TERM.borderDim}40`,
          }} />
        )}
        {audit.service_area_count > 0 && (
          <Chip size="small" label={`${audit.service_area_count} SJ towns mentioned`} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: TERM.greenSoft, color: TERM.green, border: `1px solid ${TERM.green}40`,
          }} />
        )}
      </Stack>
      {audit.notes && (
        <Alert severity="info" sx={{ mb: 1, fontFamily: MONO, fontSize: 11, py: 0.4 }}>
          {audit.notes}
        </Alert>
      )}
      {AUDIT_GROUPS.map(([group, items]) => (
        <Box key={group} sx={{ mb: 1 }}>
          <Typography sx={{
            fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: TERM.muted,
            fontWeight: 700, textTransform: 'uppercase', mb: 0.4,
          }}>{group}</Typography>
          {items.map(([key, label]) => (
            <Stack key={key} direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.15 }}>
              <Box sx={{ width: 12, textAlign: 'center' }}><CheckMark value={audit[key]} /></Box>
              <Typography sx={{
                fontFamily: MONO, fontSize: 11.5,
                color: audit[key] === false ? TERM.amber : TERM.text,
              }}>{label}</Typography>
            </Stack>
          ))}
        </Box>
      ))}
    </Box>
  );
}


// Score bar — shows the bucket value vs cap, plus inline reasons explaining
// why this bucket landed where it did. Empty-reasons buckets show "no
// signals credited" so the user knows the bar is genuinely zero, not just
// stale data.
function ScoreBar({ label, value, max, color = TERM.green, reasons = [] }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1.2 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
        <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: TERM.text, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.text, fontWeight: 700 }}>
          {value}/{max}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate" value={pct}
        sx={{
          height: 5, borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.04)',
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
      <Box sx={{ mt: 0.4 }}>
        {reasons && reasons.length > 0 ? (
          reasons.map((r, i) => (
            <Typography key={i} sx={{
              fontFamily: MONO, fontSize: 10.5, color: TERM.muted, lineHeight: 1.5,
            }}>· {r}</Typography>
          ))
        ) : (
          <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, fontStyle: 'italic' }}>
            no signals credited
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function relativeTime(d) {
  if (!d) return 'never';
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function StatusRow({ label, ok, detail }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.4 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%',
        bgcolor: ok ? TERM.green : TERM.amber,
        boxShadow: `0 0 6px ${ok ? TERM.green : TERM.amber}`,
      }} />
      <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: TERM.text, flex: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
        {detail}
      </Typography>
    </Stack>
  );
}

function Dashboard({ stats, usage, api, onAction }) {
  if (!stats) return null;
  const aplus = stats.byGrade['A+'] || 0;
  const a = stats.byGrade['A'] || 0;
  const b = stats.byGrade['B'] || 0;
  // pushedCount uses byStatus to read what the backend dashboard returns —
  // we use the same source for the "in Spider" tile.
  const pushedCount = stats.pushedToSpider || 0;

  const cleanup = async (label, body) => {
    if (!window.confirm(`Delete ${label}? Cannot be undone.`)) return;
    try {
      const r = await api.bulkDelete(body);
      window.alert(`Deleted ${r.deleted}.`);
      onAction();
    } catch (e) {
      window.alert(e?.response?.data?.message || e.message);
    }
  };
  const runJob = async (job) => {
    try {
      await api.runJob(job);
      window.alert('Started in background. Refresh in a few seconds to see results.');
    } catch (e) {
      window.alert(e?.response?.data?.message || e.message);
    }
  };

  const rescore = usage?.scheduler?.nightly_rescore;
  const staleAudit = usage?.scheduler?.weekly_stale_audit;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
        <KpiTile label="Total Leads" value={stats.total} />
        <KpiTile label="A+ Leads" value={aplus} accent={GRADE_COLOR['A+']} />
        <KpiTile label="A Leads" value={a} accent={GRADE_COLOR['A']} />
        <KpiTile label="B Leads" value={b} accent={GRADE_COLOR['B']} />
        <KpiTile label="Active Ads" value={stats.activeAds} accent={TERM.green} />
        <KpiTile label="No Website" value={stats.noWebsite} accent={TERM.amber} />
        <KpiTile label="Weak Website" value={stats.weakSite} accent={TERM.amber} />
        <KpiTile label="Pushed to Spider" value={pushedCount} accent={TERM.green} />
      </Stack>

      <Paper elevation={0} sx={{
        bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
        p: 1.5, borderRadius: 1.5,
      }}>
        <Typography sx={{
          fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted,
          fontWeight: 600, textTransform: 'uppercase', mb: 1,
        }}>Recommended offer breakdown</Typography>
        <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
          {Object.entries(stats.byOffer).map(([offer, n]) => (
            <Chip key={offer} label={`${offer || 'unset'}: ${n}`} sx={{
              bgcolor: TERM.greenSoft, color: TERM.text, fontFamily: MONO, fontSize: 11,
              border: `1px solid ${TERM.borderDim}`, borderRadius: 1,
            }} />
          ))}
        </Stack>
      </Paper>

      {/* System status */}
      <Paper elevation={0} sx={{
        bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
        p: 1.5, borderRadius: 1.5,
      }}>
        <Typography sx={{
          fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted,
          fontWeight: 600, textTransform: 'uppercase', mb: 1,
        }}>System status</Typography>
        <StatusRow
          label="Google Places API key"
          ok={!!usage?.places_key_configured}
          detail={usage?.places_key_configured ? `${usage.places_calls_today} / ${usage.daily_cap} calls today` : 'not configured'}
        />
        <StatusRow
          label="PageSpeed Insights API key"
          ok={!!usage?.pagespeed_configured}
          detail={usage?.pagespeed_configured ? 'enabled' : 'optional — set PAGESPEED_KEY to enable mobile speed audits'}
        />
        <StatusRow
          label="Spider webhook"
          ok={!!usage?.spider_configured}
          detail={usage?.spider_configured ? 'enabled' : 'see docs/JPW_SPIDER_SETUP.md'}
        />
        <StatusRow
          label="Nightly re-score job (03:00)"
          ok={!!rescore?.ran_at && !rescore?.error}
          detail={rescore?.ran_at
            ? `${rescore.updated || 0}/${rescore.total || 0} · ${relativeTime(rescore.ran_at)}${rescore.error ? ' · err' : ''}`
            : 'has not run yet'}
        />
        <StatusRow
          label="Weekly stale-audit refresh (Sun 03:30)"
          ok={!!staleAudit?.ran_at && !staleAudit?.error}
          detail={staleAudit?.ran_at
            ? `${staleAudit.audited || 0}/${staleAudit.attempted || 0} · ${relativeTime(staleAudit.ran_at)}${staleAudit.error ? ' · err' : ''}`
            : 'has not run yet'}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" onClick={() => runJob('rescore')}
            sx={{ color: TERM.green, border: `1px solid ${TERM.green}40`, fontFamily: MONO, fontSize: 10.5 }}>
            Run rescore now
          </Button>
          <Button size="small" onClick={() => runJob('stale_audit')}
            sx={{ color: TERM.green, border: `1px solid ${TERM.green}40`, fontFamily: MONO, fontSize: 10.5 }}>
            Run stale-audit now
          </Button>
        </Stack>
      </Paper>

      {/* Cleanup */}
      <Paper elevation={0} sx={{
        bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
        p: 1.5, borderRadius: 1.5,
      }}>
        <Typography sx={{
          fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted,
          fontWeight: 600, textTransform: 'uppercase', mb: 1,
        }}>Cleanup</Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, mb: 1 }}>
          Bulk delete dead-weight leads. Disqualifiers + grade D rarely justify a callback.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="small" onClick={() => cleanup('all D-graded leads', { grade: 'D' })}
            sx={{ color: TERM.red, border: `1px solid ${TERM.red}40`, fontFamily: MONO, fontSize: 10.5 }}>
            Delete D leads ({stats.byGrade['D'] || 0})
          </Button>
          <Button size="small" onClick={() => cleanup('all "Do Not Call" leads', { call_status: 'do_not_call' })}
            sx={{ color: TERM.red, border: `1px solid ${TERM.red}40`, fontFamily: MONO, fontSize: 10.5 }}>
            Delete DNC ({stats.byStatus['do_not_call'] || 0})
          </Button>
          <Button size="small" onClick={() => cleanup('all "Not Fit" leads', { call_status: 'not_fit' })}
            sx={{ color: TERM.red, border: `1px solid ${TERM.red}40`, fontFamily: MONO, fontSize: 10.5 }}>
            Delete Not Fit ({stats.byStatus['not_fit'] || 0})
          </Button>
        </Stack>
      </Paper>

    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead row (used by both Call Queue and All Leads tables)
// ─────────────────────────────────────────────────────────────────────────────
function LeadRow({ lead, onOpen }) {
  const score = lead.lead_score || {};
  return (
    <Paper
      elevation={0}
      onClick={() => onOpen(lead)}
      sx={{
        bgcolor: TERM.panelLite, border: `1px solid ${TERM.borderDim}`,
        borderRadius: 1.25, p: 1.2, cursor: 'pointer',
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: TERM.green, bgcolor: 'rgba(74,222,128,0.04)' },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ flexShrink: 0, width: 56, textAlign: 'center' }}>
          <GradeChip grade={score.grade || 'D'} score={score.score} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            color: TERM.text, fontWeight: 700, fontSize: 13.5, fontFamily: MONO,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{lead.business_name}</Typography>
          <Stack direction="row" spacing={1.2} sx={{ mt: 0.3 }} flexWrap="wrap" useFlexGap>
            {lead.category && (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
                {lead.category}
              </Typography>
            )}
            {lead.city && (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
                · {lead.city}{lead.county ? `, ${lead.county}` : ''}
              </Typography>
            )}
            {lead.review_count > 0 && (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.amber }}>
                · ★{lead.rating?.toFixed?.(1) || '—'} ({lead.review_count})
              </Typography>
            )}
          </Stack>
        </Box>
        <Box sx={{ flexShrink: 0, minWidth: 140, textAlign: 'right' }}>
          <Typography sx={{
            fontFamily: MONO, fontSize: 10.5, color: TERM.green, fontWeight: 600,
          }}>
            {score.recommendedOffer || ''}
          </Typography>
          <Typography sx={{
            fontFamily: MONO, fontSize: 10, color: TERM.muted, mt: 0.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 200,
          }}>
            {score.mainPainPoints?.[0] || ''}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <PushStateChip pushedAt={lead.pushed_to_spider_at} />
        </Box>
        {lead.phone && (
          <Tooltip title={lead.phone}>
            <IconButton
              size="small"
              component="a"
              href={`tel:${lead.phone}`}
              onClick={(e) => e.stopPropagation()}
              sx={{ color: TERM.green, border: `1px solid ${TERM.borderDim}`, borderRadius: 1 }}
            >
              <PhoneIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead detail drawer
// ─────────────────────────────────────────────────────────────────────────────
function LeadDetail({ lead, scoreCaps, onClose, api, onSaved, spiderConfigured, onOpenColdCall }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [draft, setDraft] = React.useState(lead || {});
  React.useEffect(() => { setDraft(lead || {}); setErr(''); }, [lead]);

  if (!lead) return null;
  const score = draft.lead_score || {};

  const runAudit = async () => {
    setBusy(true); setErr('');
    try {
      const updated = await api.auditLead(lead._id);
      setDraft(updated);
      onSaved(updated);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  const pushToSpider = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api.pushSpider(lead._id);
      setDraft(r.lead);
      onSaved(r.lead);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Drawer
      anchor="right" open={!!lead} onClose={onClose}
      PaperProps={{ sx: {
        width: { xs: '100vw', sm: 560 }, bgcolor: TERM.bg,
        borderLeft: `1px solid ${TERM.border}`,
      }}}
    >
      <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <GradeChip grade={score.grade} score={score.score} />
              <PushStateChip pushedAt={draft.pushed_to_spider_at} />
            </Stack>
            <Typography sx={{ color: TERM.text, fontFamily: MONO, fontWeight: 700, fontSize: 16 }}>
              {draft.business_name}
            </Typography>
            <Typography sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 12, mt: 0.2 }}>
              {draft.category}{draft.city ? ` · ${draft.city}` : ''}{draft.county ? `, ${draft.county}` : ''}
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: TERM.muted }}><CloseIcon /></IconButton>
        </Stack>

        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}

        {/* Contact actions */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
          {draft.phone && (
            <Button
              startIcon={<PhoneIcon sx={{ fontSize: 14 }} />} size="small"
              component="a" href={`tel:${draft.phone}`}
              sx={{
                bgcolor: TERM.green, color: TERM.greenDk, fontFamily: MONO, fontWeight: 700,
                fontSize: 12, '&:hover': { bgcolor: '#3ecb6f' },
              }}
            >{draft.phone}</Button>
          )}
          {draft.website_url && (
            <Button
              startIcon={<LanguageIcon sx={{ fontSize: 14 }} />} size="small"
              component="a" target="_blank" rel="noopener" href={draft.website_url}
              sx={{ color: TERM.text, border: `1px solid ${TERM.borderDim}`, fontFamily: MONO, fontSize: 12 }}
            >Site</Button>
          )}
          {draft.google_maps_url && (
            <Button
              startIcon={<LocationOnIcon sx={{ fontSize: 14 }} />} size="small"
              component="a" target="_blank" rel="noopener" href={draft.google_maps_url}
              sx={{ color: TERM.text, border: `1px solid ${TERM.borderDim}`, fontFamily: MONO, fontSize: 12 }}
            >GBP</Button>
          )}
        </Stack>

        {/* Recommended offer — one chip, no pitch sentence */}
        {score.recommendedOffer && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase', mb: 0.4 }}>
              Recommended offer
            </Typography>
            <Chip label={score.recommendedOffer} sx={{
              bgcolor: TERM.greenSoft, color: TERM.green, fontFamily: MONO, fontSize: 11.5,
              fontWeight: 700, border: `1px solid ${TERM.green}40`, borderRadius: 1, height: 26,
            }} />
          </Box>
        )}

        {/* Website audit */}
        <Paper elevation={0} sx={{
          bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
          borderRadius: 1.5, p: 1.5, mb: 1.5,
        }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase' }}>
              Website audit
              {draft.website_audit?.audited_at && (
                <Box component="span" sx={{ ml: 1, color: TERM.muted, opacity: 0.7, textTransform: 'none', letterSpacing: 0 }}>
                  {new Date(draft.website_audit.audited_at).toLocaleString()}
                </Box>
              )}
            </Typography>
            <Button
              size="small" onClick={runAudit} disabled={busy || !draft.website_url}
              sx={{
                color: TERM.green, border: `1px solid ${TERM.green}40`,
                fontFamily: MONO, fontSize: 10.5, fontWeight: 700,
                px: 1, py: 0.2, minWidth: 0,
                '&:hover': { bgcolor: `${TERM.green}10` },
              }}
            >{draft.website_audit?.audited_at ? 'Re-audit' : 'Audit site'}</Button>
          </Stack>
          {!draft.website_url ? (
            <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
              No website on file — nothing to audit.
            </Typography>
          ) : !draft.website_audit?.audited_at ? (
            <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
              Not audited yet. Click "Audit site" to fetch and analyze.
            </Typography>
          ) : (
            <Box>
              <AuditChecklist audit={draft.website_audit} />
            </Box>
          )}
        </Paper>

        {/* Score breakdown with inline reasons */}
        <Paper elevation={0} sx={{
          bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
          borderRadius: 1.5, p: 1.5, mb: 1.5,
        }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase', mb: 1 }}>
            Score breakdown · {score.score}/100
          </Typography>
          <ScoreBar
            label="Buying intent" max={scoreCaps?.buyingIntent || 30} color={TERM.green}
            value={score.breakdown?.buyingIntent?.value || 0}
            reasons={score.breakdown?.buyingIntent?.reasons || []}
          />
          <ScoreBar
            label="Pain" max={scoreCaps?.pain || 25} color={TERM.amber}
            value={score.breakdown?.pain?.value || 0}
            reasons={score.breakdown?.pain?.reasons || []}
          />
          <ScoreBar
            label="Ability to pay" max={scoreCaps?.abilityToPay || 25} color={TERM.blue}
            value={score.breakdown?.abilityToPay?.value || 0}
            reasons={score.breakdown?.abilityToPay?.reasons || []}
          />
          <ScoreBar
            label="Fit" max={scoreCaps?.fit || 15} color={TERM.green}
            value={score.breakdown?.fit?.value || 0}
            reasons={score.breakdown?.fit?.reasons || []}
          />
          <ScoreBar
            label="Urgency" max={scoreCaps?.urgency || 5} color={TERM.red}
            value={score.breakdown?.urgency?.value || 0}
            reasons={score.breakdown?.urgency?.reasons || []}
          />
          {score.breakdown?.penaltyDelta < 0 && (
            <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${TERM.borderDim}` }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.red, fontWeight: 700 }}>
                Penalties: {score.breakdown.penaltyDelta}
              </Typography>
              {(score.penalties || []).map((p, i) => (
                <Typography key={i} sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, lineHeight: 1.5 }}>
                  · {p}
                </Typography>
              ))}
            </Box>
          )}
        </Paper>

        {(score.disqualifiers?.length > 0) && (
          <Alert severity="warning" sx={{ mb: 1.5, fontFamily: MONO, fontSize: 12 }}>
            Disqualifiers: {score.disqualifiers.join(', ')}
          </Alert>
        )}

        {/* Action row — push to Spider + open Cold Call Tree */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          {draft.pushed_to_spider_at ? (
            <Tooltip title={`Pushed ${new Date(draft.pushed_to_spider_at).toLocaleString()}`}>
              <span>
                <Button
                  startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
                  onClick={pushToSpider} disabled={busy || !spiderConfigured}
                  sx={{
                    color: TERM.green, border: `1px solid ${TERM.green}40`,
                    fontFamily: MONO, fontSize: 12, fontWeight: 700,
                  }}
                >Re-push to Spider</Button>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title={spiderConfigured ? 'Append to Spider sheet, "JPW Recon" tab' : 'Spider webhook not configured on backend'}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<SendIcon sx={{ fontSize: 16 }} />}
                  onClick={pushToSpider} disabled={busy || !spiderConfigured}
                  sx={{
                    bgcolor: TERM.green, color: TERM.greenDk,
                    fontFamily: MONO, fontSize: 12, fontWeight: 700,
                    '&:hover': { bgcolor: '#3ecb6f' },
                  }}
                >Push to Spider</Button>
              </span>
            </Tooltip>
          )}
          <Button
            onClick={() => onOpenColdCall && onOpenColdCall(draft)}
            startIcon={<PhoneInTalkIcon sx={{ fontSize: 16 }} />}
            sx={{
              color: TERM.text, border: `1px solid ${TERM.borderDim}`,
              fontFamily: MONO, fontSize: 12, fontWeight: 700,
              '&:hover': { borderColor: TERM.green, color: TERM.green },
            }}
          >Cold Call Tree</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 12 }}>
            Close
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add lead modal
// ─────────────────────────────────────────────────────────────────────────────
function AddLeadDialog({ open, onClose, api, reference, onCreated }) {
  const [draft, setDraft] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  React.useEffect(() => { if (open) { setDraft({ state: 'NJ' }); setErr(''); } }, [open]);

  const submit = async () => {
    if (!draft.business_name?.trim()) { setErr('Business name is required.'); return; }
    setBusy(true); setErr('');
    try {
      const result = await api.createLead(draft);
      onCreated(result);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: TERM.bg, border: `1px solid ${TERM.border}` }}}>
      <DialogTitle sx={{ fontFamily: MONO, color: TERM.text, fontWeight: 700, borderBottom: `1px solid ${TERM.borderDim}` }}>
        Add Lead
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField autoFocus label="Business name" required size="small" sx={darkInputSx}
            value={draft.business_name || ''} onChange={(e) => setDraft({ ...draft, business_name: e.target.value })} />
          <Stack direction="row" spacing={1}>
            <TextField label="Phone" size="small" sx={{ ...darkInputSx, flex: 1 }}
              value={draft.phone || ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            <TextField label="Website" size="small" sx={{ ...darkInputSx, flex: 1.4 }}
              value={draft.website_url || ''} onChange={(e) => setDraft({ ...draft, website_url: e.target.value })} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField select label="Category" size="small" sx={{ ...darkInputSx, flex: 1 }}
              value={draft.category || ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {(reference?.categories || []).map((c) => (
                <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Rating" size="small" type="number" inputProps={{ step: 0.1, min: 0, max: 5 }} sx={{ ...darkInputSx, width: 90 }}
              value={draft.rating || ''} onChange={(e) => setDraft({ ...draft, rating: e.target.value })} />
            <TextField label="Reviews" size="small" type="number" inputProps={{ min: 0 }} sx={{ ...darkInputSx, width: 100 }}
              value={draft.review_count || ''} onChange={(e) => setDraft({ ...draft, review_count: e.target.value })} />
          </Stack>
          <TextField label="Address" size="small" sx={darkInputSx}
            value={draft.address || ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          <Stack direction="row" spacing={1}>
            <TextField select label="City (SJ towns)" size="small" sx={{ ...darkInputSx, flex: 1 }}
              value={draft.city || ''} onChange={(e) => setDraft({ ...draft, city: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {(reference?.towns || []).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField select label="County" size="small" sx={{ ...darkInputSx, flex: 1 }}
              value={draft.county || ''} onChange={(e) => setDraft({ ...draft, county: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {(reference?.counties || []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label="Google Maps URL" size="small" sx={darkInputSx}
            value={draft.google_maps_url || ''} onChange={(e) => setDraft({ ...draft, google_maps_url: e.target.value })} />
          <TextField label="Notes / first impressions" multiline minRows={2} size="small" sx={darkInputSx}
            value={draft.call_notes || ''} onChange={(e) => setDraft({ ...draft, call_notes: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${TERM.borderDim}`, px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: TERM.muted, fontFamily: MONO }}>Cancel</Button>
        <Button onClick={submit} disabled={busy} variant="contained"
          sx={{ bgcolor: TERM.green, color: TERM.greenDk, fontFamily: MONO, fontWeight: 700, '&:hover': { bgcolor: '#3ecb6f' }}}>
          {busy ? <CircularProgress size={18} /> : 'Add & score'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Import dialog
// ─────────────────────────────────────────────────────────────────────────────
function ImportDialog({ open, onClose, api, onDone }) {
  const [text, setText] = React.useState('');
  const [meta, setMeta] = React.useState({ source: 'csv', source_query: '', source_city: '', source_county: '' });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [result, setResult] = React.useState(null);
  React.useEffect(() => { if (open) { setText(''); setErr(''); setResult(null); } }, [open]);

  // Two accepted formats:
  //   1) JSON array  (e.g. Apify "Get dataset items" → JSON)
  //   2) CSV with header row (comma OR tab separated, quoted values supported)
  const parseInput = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array.');
      return parsed;
    }
    // CSV/TSV — basic parser, handles quoted fields with commas/quotes.
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error('Need at least a header row and one data row.');
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const parseLine = (line) => {
      const out = [];
      let cur = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') { inQuotes = false; }
          else cur += ch;
        } else {
          if (ch === '"') inQuotes = true;
          else if (ch === sep) { out.push(cur); cur = ''; }
          else cur += ch;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map((l) => {
      const cells = parseLine(l);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cells[i]; });
      return obj;
    });
  };

  const submit = async () => {
    setBusy(true); setErr(''); setResult(null);
    try {
      const rows = parseInput(text);
      if (!rows.length) throw new Error('No rows parsed.');
      const r = await api.import({ rows, ...meta });
      setResult(r);
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: TERM.bg, border: `1px solid ${TERM.border}` }}}>
      <DialogTitle sx={{ fontFamily: MONO, color: TERM.text, fontWeight: 700, borderBottom: `1px solid ${TERM.borderDim}` }}>
        Import Leads
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 1.5 }}>
            Received {result.received} · Created {result.created} · Merged {result.merged} · Skipped {result.skipped}
            {result.errors?.length > 0 && ` · ${result.errors.length} errors`}
          </Alert>
        )}
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, mb: 1 }}>
          Paste an Apify / OutScraper / Google Maps export — JSON array OR CSV with a header row.
          Field names like "name", "phone", "website", "rating", "reviewsCount", "categoryName", "city"
          are auto-mapped. Dedupe runs by place_id → phone → domain → name+city.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <TextField select label="Source" size="small" sx={{ ...darkInputSx, width: 150 }}
            value={meta.source} onChange={(e) => setMeta({ ...meta, source: e.target.value })}>
            <MenuItem value="csv">csv</MenuItem>
            <MenuItem value="apify">apify</MenuItem>
            <MenuItem value="outscraper">outscraper</MenuItem>
            <MenuItem value="manual">manual</MenuItem>
          </TextField>
          <TextField label="Search query / context" size="small" sx={{ ...darkInputSx, flex: 1 }}
            value={meta.source_query} onChange={(e) => setMeta({ ...meta, source_query: e.target.value })}
            placeholder='e.g. "tree service Voorhees NJ"' />
        </Stack>
        <TextField
          multiline minRows={12} fullWidth
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'Paste JSON array or CSV here…'}
          sx={{
            ...darkInputSx,
            '& .MuiOutlinedInput-root': {
              ...darkInputSx['& .MuiOutlinedInput-root'],
              fontFamily: MONO, fontSize: 11,
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${TERM.borderDim}`, px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: TERM.muted, fontFamily: MONO }}>Close</Button>
        <Button onClick={submit} disabled={busy || !text.trim()} variant="contained"
          sx={{ bgcolor: TERM.green, color: TERM.greenDk, fontFamily: MONO, fontWeight: 700, '&:hover': { bgcolor: '#3ecb6f' }}}>
          {busy ? <CircularProgress size={18} /> : 'Import & score'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Google Places dialog
// ─────────────────────────────────────────────────────────────────────────────
function SearchPlacesDialog({ open, onClose, api, reference, onDone }) {
  const [form, setForm] = React.useState({ category: '', town: '', county: '', extra_query: '' });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [usage, setUsage] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    setErr(''); setResult(null);
    api.usage().then(setUsage).catch(() => {});
  }, [open, api]);

  const submit = async () => {
    if (!form.category) { setErr('Pick a category.'); return; }
    setBusy(true); setErr(''); setResult(null);
    try {
      const r = await api.searchPlaces(form);
      setResult(r);
      setUsage((u) => u ? { ...u, places_calls_today: r.usage_today } : u);
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: TERM.bg, border: `1px solid ${TERM.border}` }}}>
      <DialogTitle sx={{ fontFamily: MONO, color: TERM.text, fontWeight: 700, borderBottom: `1px solid ${TERM.borderDim}` }}>
        Search Google Places
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {usage && (
          <Alert
            severity={usage.places_key_configured ? 'info' : 'warning'}
            sx={{ mb: 1.5, fontFamily: MONO, fontSize: 11 }}
          >
            {usage.places_key_configured
              ? `Today: ${usage.places_calls_today} / ${usage.daily_cap} Places calls`
              : 'GOOGLE_PLACES_KEY is not set on the backend — this will fail.'}
          </Alert>
        )}
        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 1.5, fontFamily: MONO, fontSize: 11 }}>
            "{result.query}" → received {result.received},
            created {result.created},
            merged {result.merged}
            {result.skipped_in_spider > 0 && `, skipped ${result.skipped_in_spider} (already in Spider)`}
            {result.skipped > 0 && `, skipped ${result.skipped} (other)`}.
            {result.spider_phones_checked > 0 && (
              <Box component="span" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                Checked against {result.spider_phones_checked} phones in your Spider sheet.
              </Box>
            )}
          </Alert>
        )}
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, mb: 1.5 }}>
          Searches a single category × town/county. Results are deduped against your existing leads
          AND any phone already in your Spider sheet — you'll only see new businesses.
          One call uses one quota slot.
        </Typography>
        <Stack spacing={1.5}>
          {/* High-ticket first (the offers Nate is built for), then mid-ticket
              below a subheader. Disqualified categories never appear. */}
          <TextField select required label="Category" size="small" sx={darkInputSx}
            value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {(reference?.categories || []).filter((c) => c.tier === 'high').map((c) => (
              <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
            ))}
            {(reference?.categories || []).some((c) => c.tier === 'mid') && (
              <MenuItem disabled sx={{ opacity: 0.7, fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                — mid-ticket —
              </MenuItem>
            )}
            {(reference?.categories || []).filter((c) => c.tier === 'mid').map((c) => (
              <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField select label="Town" size="small" sx={{ ...darkInputSx, flex: 1 }}
              value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value, county: '' })}>
              <MenuItem value="">—</MenuItem>
              {(reference?.towns || []).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField select label="County (used if no town)" size="small" sx={{ ...darkInputSx, flex: 1 }}
              value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}
              disabled={!!form.town}>
              <MenuItem value="">—</MenuItem>
              {(reference?.counties || []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label="Extra query (optional)" size="small" sx={darkInputSx}
            value={form.extra_query} onChange={(e) => setForm({ ...form, extra_query: e.target.value })}
            placeholder='e.g. "emergency" or "residential"' />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${TERM.borderDim}`, px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: TERM.muted, fontFamily: MONO }}>Close</Button>
        <Button onClick={submit} disabled={busy || !form.category} variant="contained"
          sx={{ bgcolor: TERM.green, color: TERM.greenDk, fontFamily: MONO, fontWeight: 700, '&:hover': { bgcolor: '#3ecb6f' }}}>
          {busy ? <CircularProgress size={18} /> : 'Search & ingest'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk sweep — runs N (category × town) combos in one shot
// ─────────────────────────────────────────────────────────────────────────────
function SweepDialog({ open, onClose, api, reference, onDone }) {
  const [maxSearches, setMaxSearches] = React.useState(33);
  const [advanced, setAdvanced] = React.useState(false);
  const [pickedCats, setPickedCats] = React.useState(new Set());
  const [pickedTowns, setPickedTowns] = React.useState(new Set());
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [usage, setUsage] = React.useState(null);
  const [status, setStatus] = React.useState(null);

  // Reset transient UI state when dialog opens. Categories/towns hydrate
  // for the advanced override but stay hidden behind the accordion.
  React.useEffect(() => {
    if (!open) return;
    setErr('');
    api.usage().then(setUsage).catch(() => {});
    api.sweepStatus().then(setStatus).catch(() => setStatus(null));
    if (reference) {
      setPickedCats(new Set(
        (reference.categories || []).filter((c) => c.tier === 'high').map((c) => c.name)
      ));
      setPickedTowns(new Set(reference.towns || []));
    }
  }, [open, reference, api]);

  // Poll status while the dialog is open OR a sweep is running. 2s feels
  // responsive without hammering the API.
  React.useEffect(() => {
    if (!open) return;
    const tick = () => api.sweepStatus().then(setStatus).catch(() => {});
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [open, api]);

  const isRunning = status?.status === 'running';
  const isFinished = status && ['completed', 'stopped', 'failed'].includes(status.status);

  const toggle = (set, setSet, value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSet(next);
  };
  const allCats  = (reference?.categories || []).filter((c) => c.tier === 'high');
  const allTowns = reference?.towns || [];

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const body = { max: maxSearches };
      if (advanced) {
        if (!pickedCats.size || !pickedTowns.size) {
          setErr('Pick at least one category and one town in advanced mode.');
          setBusy(false);
          return;
        }
        body.categories = Array.from(pickedCats);
        body.towns      = Array.from(pickedTowns);
      }
      const r = await api.sweepPlaces(body);
      if (!r.ok) {
        setErr(r.message || 'Could not start sweep.');
      } else {
        // Immediately fetch status so the progress section appears
        const next = await api.sweepStatus();
        setStatus(next);
        onDone();
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  const stopSweep = async () => {
    try {
      await api.sweepStop();
      const next = await api.sweepStatus();
      setStatus(next);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
  };

  const pct = status?.pairs_total
    ? Math.min(100, Math.round(100 * (status.pairs_done || 0) / status.pairs_total))
    : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: TERM.bg, border: `1px solid ${TERM.border}` }}}>
      <DialogTitle sx={{ fontFamily: MONO, color: TERM.text, fontWeight: 700, borderBottom: `1px solid ${TERM.borderDim}` }}>
        Run Sweep
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {usage && (
          <Alert
            severity={usage.places_key_configured ? 'info' : 'warning'}
            sx={{ mb: 1.5, fontFamily: MONO, fontSize: 11 }}
          >
            {usage.places_key_configured
              ? `Today: ${usage.places_calls_today} / ${usage.daily_cap} Places calls. Sweep halts if the cap is hit.`
              : 'GOOGLE_PLACES_KEY is not set on the backend — this will fail.'}
          </Alert>
        )}
        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}

        {/* Live progress section — visible whenever the backend reports a
            running OR finished sweep so the user can reopen the dialog and
            see results even after closing it mid-run. */}
        {(isRunning || isFinished) && status && (
          <Paper elevation={0} sx={{
            bgcolor: TERM.panel, border: `1px solid ${isRunning ? TERM.green : TERM.borderDim}`,
            borderRadius: 1.5, p: 1.5, mb: 2,
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TERM.text }}>
                {status.pairs_done || 0} / {status.pairs_total || 0} pairs
                {status.api_calls_used > 0 && (
                  <Box component="span" sx={{ color: TERM.muted, fontWeight: 400, ml: 1 }}>
                    · {status.api_calls_used} API calls
                  </Box>
                )}
              </Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: isRunning ? TERM.green : TERM.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
                {status.status}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate" value={pct}
              sx={{
                height: 6, borderRadius: 3, mb: 1,
                bgcolor: 'rgba(255,255,255,0.05)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: isRunning ? TERM.green : (status.status === 'completed' ? TERM.green : TERM.amber),
                },
              }}
            />
            <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
              <Box>New: <Box component="span" sx={{ color: TERM.green, fontWeight: 700 }}>{status.total_created || 0}</Box></Box>
              <Box>Merged: <Box component="span" sx={{ color: TERM.text }}>{status.total_merged || 0}</Box></Box>
              <Box>Skipped (Spider): <Box component="span" sx={{ color: TERM.text }}>{status.total_skipped_in_spider || 0}</Box></Box>
            </Stack>
            {status.current_pair && isRunning && (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, mt: 0.5 }}>
                Now searching: <Box component="span" sx={{ color: TERM.text }}>{status.current_pair}</Box>
              </Typography>
            )}
            {status.halted_reason && (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.amber, mt: 0.5 }}>
                Halted: {status.halted_reason}
              </Typography>
            )}
            {isRunning && (
              <Button onClick={stopSweep} size="small" sx={{
                color: TERM.amber, border: `1px solid ${TERM.amber}40`,
                fontFamily: MONO, fontSize: 11, fontWeight: 700, mt: 1,
              }}>Stop sweep</Button>
            )}
          </Paper>
        )}

        {!isRunning && (
          <>
            <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, mb: 1.5 }}>
              Smart queue picks the (category × town) pairs you haven't searched recently.
              Each pair runs 2-3 phrasings × 2 pages = up to ~80 unique businesses, then
              auto-audits in the background. Daily cap halts the run cleanly if hit.
            </Typography>

            <TextField
              type="number" label="Max searches this run" size="small"
              value={maxSearches}
              onChange={(e) => setMaxSearches(Math.max(1, parseInt(e.target.value, 10) || 1))}
              inputProps={{ min: 1, max: 100 }}
              sx={{ ...darkInputSx, width: 220, mb: 2 }}
              helperText="Each pair uses ~6 API calls. 33 ≈ full daily budget."
            />

            {/* Advanced override — collapsed by default. Smart queue is the
                normal path; this is only for when you want to force a
                specific category/town set. */}
            <Box sx={{
              border: `1px solid ${TERM.borderDim}`, borderRadius: 1, mb: 1,
            }}>
              <Box
                onClick={() => setAdvanced((v) => !v)}
                sx={{
                  cursor: 'pointer', px: 1.25, py: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                }}>
                <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Advanced — override smart queue
                </Typography>
                <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
                  {advanced ? '▾' : '▸'}
                </Typography>
              </Box>
              {advanced && (
                <Box sx={{ p: 1.25, borderTop: `1px solid ${TERM.borderDim}` }}>
                  <Stack direction="row" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                          Categories ({pickedCats.size}/{allCats.length})
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" onClick={() => setPickedCats(new Set(allCats.map((c) => c.name)))}
                            sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 10, minWidth: 0, px: 0.8 }}>all</Button>
                          <Button size="small" onClick={() => setPickedCats(new Set())}
                            sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 10, minWidth: 0, px: 0.8 }}>none</Button>
                        </Stack>
                      </Stack>
                      <Box sx={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${TERM.borderDim}`, borderRadius: 1, p: 0.5 }}>
                        {allCats.map((c) => (
                          <Box key={c.name}
                            onClick={() => toggle(pickedCats, setPickedCats, c.name)}
                            sx={{
                              cursor: 'pointer', px: 1, py: 0.4, borderRadius: 0.5,
                              fontFamily: MONO, fontSize: 11.5,
                              color: pickedCats.has(c.name) ? TERM.green : TERM.muted,
                              bgcolor: pickedCats.has(c.name) ? `${TERM.green}10` : 'transparent',
                              '&:hover': { bgcolor: `${TERM.green}08` },
                            }}>
                            {pickedCats.has(c.name) ? '✓ ' : '  '}{c.name}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                          Towns ({pickedTowns.size}/{allTowns.length})
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" onClick={() => setPickedTowns(new Set(allTowns))}
                            sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 10, minWidth: 0, px: 0.8 }}>all</Button>
                          <Button size="small" onClick={() => setPickedTowns(new Set())}
                            sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 10, minWidth: 0, px: 0.8 }}>none</Button>
                        </Stack>
                      </Stack>
                      <Box sx={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${TERM.borderDim}`, borderRadius: 1, p: 0.5 }}>
                        {allTowns.map((t) => (
                          <Box key={t}
                            onClick={() => toggle(pickedTowns, setPickedTowns, t)}
                            sx={{
                              cursor: 'pointer', px: 1, py: 0.4, borderRadius: 0.5,
                              fontFamily: MONO, fontSize: 11.5,
                              color: pickedTowns.has(t) ? TERM.green : TERM.muted,
                              bgcolor: pickedTowns.has(t) ? `${TERM.green}10` : 'transparent',
                              '&:hover': { bgcolor: `${TERM.green}08` },
                            }}>
                            {pickedTowns.has(t) ? '✓ ' : '  '}{t}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${TERM.borderDim}`, px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: TERM.muted, fontFamily: MONO }}>
          {isRunning ? 'Close (sweep keeps running)' : 'Close'}
        </Button>
        {!isRunning && (
          <Button onClick={submit} disabled={busy} variant="contained"
            sx={{ bgcolor: TERM.green, color: TERM.greenDk, fontFamily: MONO, fontWeight: 700, '&:hover': { bgcolor: '#3ecb6f' }}}>
            {busy ? <CircularProgress size={18} /> : `Run ${maxSearches} searches`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────
export default function JpwReconTab({ token, onOpenColdCall }) {
  const api = React.useMemo(() => makeApi(token), [token]);

  const [view, setView] = React.useState('queue'); // 'queue' | 'all' | 'dashboard'
  const [leads, setLeads] = React.useState([]);
  const [stats, setStats] = React.useState(null);
  const [reference, setReference] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [sweepOpen, setSweepOpen]   = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [auditingBatch, setAuditingBatch] = React.useState(false);
  const [usage, setUsage] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState({ grade: '', pushed: '', category: '', county: '', recommended_offer: '' });

  const loadAll = React.useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [statsRes, refRes] = await Promise.all([api.stats(), api.reference()]);
      setStats(statsRes); setReference(refRes);
      const params = view === 'queue'
        ? { grade: 'A+', sort: 'score_desc', limit: 500 }
        : { ...filters, sort: 'score_desc', limit: 500 };
      // Queue view = A+ OR A
      if (view === 'queue') {
        const [a1, a2] = await Promise.all([
          api.listLeads({ grade: 'A+', sort: 'score_desc' }),
          api.listLeads({ grade: 'A',  sort: 'score_desc' }),
        ]);
        setLeads([...(a1.leads || []), ...(a2.leads || [])]);
      } else {
        const r = await api.listLeads(params);
        setLeads(r.leads || []);
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setLoading(false); }
  // filters object reference changes each render — track its values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, view, filters.grade, filters.pushed, filters.category, filters.county, filters.recommended_offer]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const rescoreAll = async () => {
    if (!window.confirm('Re-score every lead? This can take a few seconds for large datasets.')) return;
    try { await api.rescore({}); await loadAll(); }
    catch (e) { setErr(e?.response?.data?.message || e.message); }
  };

  const auditUnaudited = async () => {
    if (!window.confirm('Audit up to 50 leads that have a website but no audit yet. Takes ~30s.')) return;
    setAuditingBatch(true); setErr('');
    try {
      const r = await api.auditBatch({ only_unaudited: true, limit: 50, concurrency: 4 });
      await loadAll();
      window.alert(`Audited ${r.audited} of ${r.requested}. ${r.errors ? `${r.errors} errors.` : ''}`);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setAuditingBatch(false); }
  };

  const pushAllAplusA = async () => {
    if (!usage?.spider_configured) {
      window.alert('Spider webhook not configured on backend. See docs/JPW_SPIDER_SETUP.md.');
      return;
    }
    if (!window.confirm('Push every A+/A lead that hasn\'t been pushed yet into the Spider sheet ("JPW Recon" tab)?')) return;
    setErr('');
    try {
      const r = await api.pushSpiderBatch({ only_unpushed: true, limit: 100 });
      await loadAll();
      window.alert(`Pushed ${r.pushed} new rows, ${r.skipped} already present (out of ${r.requested}).`);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
  };

  // Refresh usage when this tab is opened
  React.useEffect(() => {
    api.usage().then(setUsage).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLeadSaved = (updated) => {
    setLeads((cur) => cur.map((l) => (l._id === updated._id ? updated : l)));
    setSelected(updated);
  };

  const filteredLeads = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      // Pushed filter — client-side because the backend list endpoint doesn't
      // accept a `pushed` filter today and the data set fits in memory.
      if (filters.pushed === 'true'  && !l.pushed_to_spider_at) return false;
      if (filters.pushed === 'false' && l.pushed_to_spider_at)  return false;
      if (!q) return true;
      return (l.business_name || '').toLowerCase().includes(q)
          || (l.phone || '').includes(q)
          || (l.city || '').toLowerCase().includes(q)
          || (l.category || '').toLowerCase().includes(q);
    });
  }, [leads, search, filters.pushed]);

  return (
    <Box sx={{ bgcolor: TERM.bg, color: TERM.text, p: { xs: 1.5, md: 2 }, minHeight: 600 }}>
      {/* Header strip */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        <ToggleButtonGroup
          value={view} exclusive size="small"
          onChange={(_, v) => v && setView(v)}
          sx={{
            '& .MuiToggleButton-root': {
              color: TERM.muted, border: `1px solid ${TERM.borderDim}`,
              fontFamily: MONO, fontSize: 11, fontWeight: 700, px: 1.5, py: 0.5,
              '&.Mui-selected': { bgcolor: TERM.greenSoft, color: TERM.green, borderColor: TERM.green },
              '&.Mui-selected:hover': { bgcolor: TERM.greenSoft },
            },
          }}
        >
          <ToggleButton value="queue">Push Queue</ToggleButton>
          <ToggleButton value="all">All Leads</ToggleButton>
          <ToggleButton value="dashboard">Dashboard</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <TextField size="small" placeholder="Search name / phone / city" sx={{ ...darkInputSx, width: 240 }}
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: TERM.muted }} /></InputAdornment> }}
        />
        <IconButton onClick={loadAll} sx={{ color: TERM.muted, border: `1px solid ${TERM.borderDim}`, borderRadius: 1 }}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Button size="small" startIcon={<TravelExploreIcon sx={{ fontSize: 14 }} />}
          onClick={() => setSearchOpen(true)}
          sx={{ color: TERM.green, border: `1px solid ${TERM.green}40`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Search Places
        </Button>
        <Button size="small" startIcon={<TravelExploreIcon sx={{ fontSize: 14 }} />}
          onClick={() => setSweepOpen(true)}
          sx={{ color: TERM.green, border: `1px solid ${TERM.green}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Run Sweep
        </Button>
        <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
          onClick={() => setAddOpen(true)}
          sx={{ color: TERM.text, border: `1px solid ${TERM.borderDim}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Add
        </Button>
        <Button size="small" startIcon={<UploadFileIcon sx={{ fontSize: 14 }} />}
          onClick={() => setImportOpen(true)}
          sx={{ color: TERM.text, border: `1px solid ${TERM.borderDim}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Import
        </Button>
        <Button size="small" startIcon={auditingBatch ? <CircularProgress size={14} sx={{ color: TERM.green }} /> : <BoltIcon sx={{ fontSize: 14 }} />}
          onClick={auditUnaudited} disabled={auditingBatch}
          sx={{ color: TERM.text, border: `1px solid ${TERM.borderDim}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Audit batch
        </Button>
        <Button size="small" startIcon={<SendIcon sx={{ fontSize: 14 }} />}
          onClick={pushAllAplusA}
          disabled={!usage?.spider_configured}
          sx={{
            color: usage?.spider_configured ? TERM.green : TERM.muted,
            border: `1px solid ${usage?.spider_configured ? `${TERM.green}40` : TERM.borderDim}`,
            fontFamily: MONO, fontSize: 11, fontWeight: 700,
          }}>
          Push A+/A → Spider
        </Button>
        <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
          component="a" href={api.exportCsvUrl()} download
          sx={{ color: TERM.text, border: `1px solid ${TERM.borderDim}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Export
        </Button>
        <Button size="small" onClick={rescoreAll}
          sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 11 }}>
          Re-score
        </Button>
      </Stack>

      {/* Usage strip */}
      {usage && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted }}>
            Places API today: <Box component="span" sx={{ color: TERM.text, fontWeight: 700 }}>{usage.places_calls_today}</Box> / {usage.daily_cap}
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted }}>
            · Audits run today: <Box component="span" sx={{ color: TERM.text, fontWeight: 700 }}>{usage.audits_run_today}</Box>
          </Typography>
          {!usage.places_key_configured && (
            <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.amber }}>
              · GOOGLE_PLACES_KEY not set
            </Typography>
          )}
        </Stack>
      )}

      {/* Filters bar (All Leads only) */}
      {view === 'all' && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <TextField select label="Grade" size="small" sx={{ ...darkInputSx, width: 110 }}
            value={filters.grade} onChange={(e) => setFilters({ ...filters, grade: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            {['A+', 'A', 'B', 'C', 'D'].map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
          <TextField select label="In Spider?" size="small" sx={{ ...darkInputSx, width: 130 }}
            value={filters.pushed} onChange={(e) => setFilters({ ...filters, pushed: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="false">Not pushed</MenuItem>
            <MenuItem value="true">Pushed</MenuItem>
          </TextField>
          <TextField select label="Category" size="small" sx={{ ...darkInputSx, width: 200 }}
            value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            {(reference?.categories || []).map((c) => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
          </TextField>
          <TextField select label="County" size="small" sx={{ ...darkInputSx, width: 150 }}
            value={filters.county} onChange={(e) => setFilters({ ...filters, county: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            {(reference?.counties || []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField select label="Offer" size="small" sx={{ ...darkInputSx, width: 220 }}
            value={filters.recommended_offer} onChange={(e) => setFilters({ ...filters, recommended_offer: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Website Foundation">Website Foundation</MenuItem>
            <MenuItem value="Local SEO & Google Presence">Local SEO & Google Presence</MenuItem>
            <MenuItem value="Meta Ads Management">Meta Ads Management</MenuItem>
            <MenuItem value="Full Growth System">Full Growth System</MenuItem>
          </TextField>
        </Stack>
      )}

      {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}

      {view === 'dashboard' ? (
        loading ? <CircularProgress sx={{ color: TERM.green, my: 4 }} /> : (
          <Dashboard
            stats={stats}
            usage={usage}
            api={api}
            onAction={() => { loadAll(); api.usage().then(setUsage).catch(() => {}); }}
          />
        )
      ) : (
        <Box>
          {loading ? (
            <CircularProgress sx={{ color: TERM.green, my: 4 }} />
          ) : filteredLeads.length === 0 ? (
            <Paper elevation={0} sx={{
              bgcolor: TERM.panel, border: `1px dashed ${TERM.borderDim}`,
              borderRadius: 1.5, p: 4, textAlign: 'center',
            }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 13, color: TERM.muted, mb: 1 }}>
                {view === 'queue' ? 'No A+/A leads yet.' : 'No leads match these filters.'}
              </Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
                Add one manually or import an Apify / OutScraper export to populate.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={0.75}>
              {filteredLeads.map((l) => (
                <LeadRow key={l._id} lead={l} onOpen={setSelected} />
              ))}
            </Stack>
          )}
        </Box>
      )}

      <LeadDetail
        lead={selected} scoreCaps={reference?.score_caps}
        onClose={() => setSelected(null)} api={api} onSaved={onLeadSaved}
        spiderConfigured={!!usage?.spider_configured}
        onOpenColdCall={(l) => {
          // Hand the lead off to the Cold Call Tree tab. The tree reads this
          // on mount and pre-fills its name/business/service inputs.
          try {
            sessionStorage.setItem('jpwColdCallContext', JSON.stringify({
              biz:   l?.business_name || '',
              name:  l?.owner_name || '',
              svc:   l?.category || '',
              phone: l?.phone || '',
            }));
          } catch (_) { /* sessionStorage unavailable — handoff just won't prefill */ }
          if (onOpenColdCall) onOpenColdCall();
        }}
      />
      <AddLeadDialog
        open={addOpen} onClose={() => setAddOpen(false)} api={api} reference={reference}
        onCreated={(r) => { setAddOpen(false); loadAll(); if (r?.lead) setSelected(r.lead); }}
      />
      <ImportDialog
        open={importOpen} onClose={() => setImportOpen(false)} api={api}
        onDone={loadAll}
      />
      <SearchPlacesDialog
        open={searchOpen} onClose={() => setSearchOpen(false)} api={api}
        reference={reference}
        onDone={() => { loadAll(); api.usage().then(setUsage).catch(() => {}); }}
      />
      <SweepDialog
        open={sweepOpen} onClose={() => setSweepOpen(false)} api={api}
        reference={reference}
        onDone={() => { loadAll(); api.usage().then(setUsage).catch(() => {}); }}
      />
    </Box>
  );
}
