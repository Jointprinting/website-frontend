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
  ToggleButton, ToggleButtonGroup, Checkbox, ListItemText,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import LanguageIcon from '@mui/icons-material/Language';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import config from '../../config.json';
import JpLoader from '../../common/JpLoader';

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

// Checklist of audit signals. ✓ = present, ✗ = missing, "—" = not audited.
// Grouped so the user can read at a glance which bucket is weak. Some
// rows have a `derived` function that returns the value to display — this
// lets us combine raw audit fields (e.g. viewport tag exists AND is valid).
const AUDIT_GROUPS = [
  ['Conversion', [
    ['has_click_to_call',    'Click-to-call link'],
    ['has_visible_phone',    'Visible phone number'],
    ['has_quote_cta',        'Quote / "free estimate" CTA'],
    ['has_contact_form',     'Contact form'],
    ['has_cta_above_fold',   'CTA above the fold'],
    ['has_online_booking',   'Online booking installed'],
    ['has_live_chat',        'Live chat widget'],
  ]],
  ['SEO & local', [
    ['has_title',                'Title tag'],
    ['has_meta_description',     'Meta description'],
    ['has_h1',                   'H1 heading'],
    [null, 'Mobile viewport (valid)', (a) =>
      a.has_mobile_viewport == null ? null
      : (a.has_mobile_viewport && a.viewport_valid !== false)],
    [null, 'LocalBusiness schema (with phone/address)', (a) =>
      a.has_localbusiness_schema == null ? null
      : (a.has_localbusiness_schema && a.localbusiness_schema_valid !== false)],
    ['has_service_area_terms',   'Service-area towns listed'],
    ['has_google_map_embed',     'Google map embed'],
    ['has_sitemap',              'sitemap.xml present'],
    ['has_robots_txt',           'robots.txt present'],
  ]],
  ['Trust & polish', [
    ['has_reviews_on_site',  'Reviews / testimonials on site'],
    ['has_gallery',          'Gallery / before-after'],
    ['ssl_valid',            'SSL (https)'],
    ['has_favicon',          'Favicon'],
    ['has_og_tags',          'Open Graph tags (social share)'],
    ['has_twitter_card',     'Twitter card'],
    [null, 'No mixed content', (a) =>
      a.mixed_content_count == null ? null : (a.mixed_content_count || 0) === 0],
    [null, 'Forms post over HTTPS', (a) => a.forms_post_https],
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
  const techStack = Array.isArray(audit.tech_stack) ? audit.tech_stack : [];
  const socials   = Array.isArray(audit.social_links) ? audit.social_links : [];
  return (
    <Box>
      {/* Header line: status, CMS, copyright, multi-page, fetch time */}
      <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Chip size="small" label={`HTTP ${audit.status_code || '—'}`} sx={{
          fontFamily: MONO, fontSize: 10, height: 20,
          bgcolor: audit.loads_successfully ? `${TERM.green}20` : `${TERM.red}20`,
          color: audit.loads_successfully ? TERM.green : TERM.red,
          border: `1px solid ${audit.loads_successfully ? TERM.green : TERM.red}40`,
        }} />
        {audit.fetch_duration_ms != null && (
          <Chip size="small" label={`${audit.fetch_duration_ms}ms`} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: audit.fetch_duration_ms > 3000 ? `${TERM.amber}20` : TERM.greenSoft,
            color: audit.fetch_duration_ms > 3000 ? TERM.amber : TERM.text,
            border: `1px solid ${audit.fetch_duration_ms > 3000 ? TERM.amber : TERM.borderDim}40`,
          }} />
        )}
        {audit.pages_audited > 1 && (
          <Chip size="small" label={`${audit.pages_audited} pages`} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: TERM.greenSoft, color: TERM.text, border: `1px solid ${TERM.borderDim}`,
          }} />
        )}
        {audit.cms_detected && (
          <Chip size="small" label={audit.wp_version
            ? `${audit.cms_detected} ${audit.wp_version}` : audit.cms_detected} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: TERM.greenSoft, color: TERM.text, border: `1px solid ${TERM.borderDim}`,
          }} />
        )}
        {audit.is_default_template && (
          <Chip size="small" label={audit.is_default_template} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: `${TERM.amber}20`, color: TERM.amber, border: `1px solid ${TERM.amber}40`,
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
        {audit.sitemap_url_count > 0 && (
          <Chip size="small" label={`sitemap: ${audit.sitemap_url_count} urls`} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: TERM.greenSoft, color: TERM.text, border: `1px solid ${TERM.borderDim}`,
          }} />
        )}
        {audit.chat_widget && (
          <Chip size="small" label={`chat: ${audit.chat_widget}`} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: TERM.greenSoft, color: TERM.green, border: `1px solid ${TERM.green}40`,
          }} />
        )}
        {audit.appointment_tool && (
          <Chip size="small" label={`booking: ${audit.appointment_tool}`} sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: TERM.greenSoft, color: TERM.green, border: `1px solid ${TERM.green}40`,
          }} />
        )}
        {audit.lead_phone_matches_site === false && (audit.phones_found || []).length > 0 && (
          <Chip size="small" label="lead phone not on site" sx={{
            fontFamily: MONO, fontSize: 10, height: 20,
            bgcolor: `${TERM.amber}20`, color: TERM.amber, border: `1px solid ${TERM.amber}40`,
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
          {items.map(([key, label, derived], i) => {
            const value = derived ? derived(audit) : audit[key];
            return (
              <Stack key={key || `${group}-${i}`} direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.15 }}>
                <Box sx={{ width: 12, textAlign: 'center' }}><CheckMark value={value} /></Box>
                <Typography sx={{
                  fontFamily: MONO, fontSize: 11.5,
                  color: value === false ? TERM.amber : TERM.text,
                }}>{label}</Typography>
              </Stack>
            );
          })}
        </Box>
      ))}
      {(techStack.length > 0 || socials.length > 0) && (
        <Box sx={{ mt: 1 }}>
          {techStack.length > 0 && (
            <Box sx={{ mb: 0.6 }}>
              <Typography sx={{
                fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: TERM.muted,
                fontWeight: 700, textTransform: 'uppercase', mb: 0.4,
              }}>Tech stack</Typography>
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                {techStack.map((t) => (
                  <Chip key={t} size="small" label={t} sx={{
                    fontFamily: MONO, fontSize: 10, height: 20,
                    bgcolor: /^jQuery 1\./.test(t) ? `${TERM.amber}20` : TERM.greenSoft,
                    color: /^jQuery 1\./.test(t) ? TERM.amber : TERM.text,
                    border: `1px solid ${TERM.borderDim}`,
                  }} />
                ))}
              </Stack>
            </Box>
          )}
          {socials.length > 0 && (
            <Box>
              <Typography sx={{
                fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: TERM.muted,
                fontWeight: 700, textTransform: 'uppercase', mb: 0.4,
              }}>Social presence</Typography>
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                {socials.map((s) => (
                  <Chip key={s} size="small" label={s} sx={{
                    fontFamily: MONO, fontSize: 10, height: 20,
                    bgcolor: TERM.greenSoft, color: TERM.text, border: `1px solid ${TERM.borderDim}`,
                  }} />
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}
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

function Dashboard({ stats, usage, api, onAction, requestCleanup }) {
  if (!stats) return null;
  const aplus = stats.byGrade['A+'] || 0;
  const a = stats.byGrade['A'] || 0;
  const b = stats.byGrade['B'] || 0;
  const pushedCount = stats.pushedToSpider || 0;

  const cleanup = (label, body) => {
    if (requestCleanup) {
      requestCleanup({ message: `Delete ${label}? Cannot be undone.`, body });
      return;
    }
    // Fallback (unused with current parent), kept defensive
    api.bulkDelete(body).then(() => onAction()).catch(() => {});
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
        {usage?.pagespeed_configured && (
          <StatusRow
            label="PageSpeed Insights"
            ok
            detail="enabled — mobile speed scores in audits"
          />
        )}
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
// Styled confirm dialog — replaces the browser's native window.confirm().
// Used for destructive bulk operations (delete D leads, etc.) so they match
// the studio theme instead of looking like a Chrome popup.
function ConfirmDialog({ open, title, body, confirmLabel, danger, onCancel, onConfirm }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: TERM.bg, border: `1px solid ${TERM.border}` }}}>
      <DialogTitle sx={{ fontFamily: MONO, color: TERM.text, fontWeight: 700, borderBottom: `1px solid ${TERM.borderDim}` }}>
        {title}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography sx={{ fontFamily: MONO, fontSize: 12.5, color: TERM.text, lineHeight: 1.6 }}>
          {body}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${TERM.borderDim}`, px: 3, py: 1.5 }}>
        <Button onClick={onCancel} sx={{ color: TERM.muted, fontFamily: MONO }}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained"
          sx={{
            bgcolor: danger ? TERM.red : TERM.green,
            color: danger ? '#1a0808' : TERM.greenDk,
            fontFamily: MONO, fontWeight: 700,
            '&:hover': { bgcolor: danger ? '#e35858' : '#3ecb6f' },
          }}>
          {confirmLabel || 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LeadRow({ lead, onOpen, selected, onToggleSelect }) {
  const score = lead.lead_score || {};
  return (
    <Paper
      elevation={0}
      onClick={() => onOpen(lead)}
      sx={{
        bgcolor: selected ? 'rgba(74,222,128,0.08)' : TERM.panelLite,
        border: `1px solid ${selected ? TERM.green : TERM.borderDim}`,
        borderRadius: 1.25, p: 1.2, cursor: 'pointer',
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: TERM.green, bgcolor: 'rgba(74,222,128,0.04)' },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        {onToggleSelect && (
          <Box
            onClick={(e) => { e.stopPropagation(); onToggleSelect(lead._id); }}
            sx={{
              flexShrink: 0, width: 18, height: 18, borderRadius: 0.5,
              border: `1.5px solid ${selected ? TERM.green : TERM.borderDim}`,
              bgcolor: selected ? TERM.green : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: TERM.greenDk, fontFamily: MONO, fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              '&:hover': { borderColor: TERM.green },
            }}
          >
            {selected ? '✓' : ''}
          </Box>
        )}
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
        {/* Recommended offer + #1 weakness — hidden on phone (xs), visible
            on sm+. On mobile this would just squeeze the business name. */}
        <Box sx={{
          flexShrink: 0, minWidth: 140, textAlign: 'right',
          display: { xs: 'none', sm: 'block' },
        }}>
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
// Inline collapsible section — replaces the Paper card layout for sections
// that are now expand-on-click. Header shows title + a one-line summary so
// the user can decide whether to expand. Click anywhere on the header to
// toggle. Closed by default.
function CollapsibleSection({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Box sx={{
      bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
      borderRadius: 1.5, mb: 1.5, overflow: 'hidden',
    }}>
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          cursor: 'pointer', px: 1.5, py: 1.1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
        }}
      >
        <Box>
          <Typography sx={{
            fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted,
            fontWeight: 600, textTransform: 'uppercase',
          }}>{title}</Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 12, color: TERM.text, mt: 0.2 }}>
            {summary}
          </Typography>
        </Box>
        <Typography sx={{ fontFamily: MONO, fontSize: 14, color: TERM.muted }}>
          {open ? '▾' : '▸'}
        </Typography>
      </Box>
      {open && (
        <Box sx={{ px: 1.5, pb: 1.5, borderTop: `1px solid ${TERM.borderDim}`, pt: 1.5 }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

function LeadDetail({ lead, scoreCaps, onClose, api, onSaved, spiderConfigured, onOpenColdCall }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [draft, setDraft] = React.useState(lead || {});
  React.useEffect(() => { setDraft(lead || {}); setErr(''); }, [lead]);

  if (!lead) return null;
  const score = draft.lead_score || {};

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

        {/* Website audit — collapsed accordion. Header summarizes the state
            (audited / not audited / blocked) so user can decide if it's
            worth expanding. */}
        <CollapsibleSection
          title="Website audit"
          summary={(() => {
            if (!draft.website_url) return 'no website on file';
            const a = draft.website_audit || {};
            if (!a.audited_at) return 'not audited yet';
            if (a.loads_successfully === false) {
              return `couldn't reach site (HTTP ${a.status_code || '?'})`;
            }
            return `audited · ${new Date(a.audited_at).toLocaleDateString()}`;
          })()}
        >
          {!draft.website_url ? (
            <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
              No website on file — nothing to audit.
            </Typography>
          ) : !draft.website_audit?.audited_at ? (
            <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>
              Audit hasn't run yet. The next sweep auto-audits new leads in the background.
            </Typography>
          ) : draft.website_audit.loads_successfully === false ? (
            <Alert severity="warning" sx={{ fontFamily: MONO, fontSize: 11.5 }}>
              <Box sx={{ fontWeight: 700, mb: 0.5 }}>Site blocked our audit (HTTP {draft.website_audit.status_code || 'unknown'})</Box>
              The site either refused our request or doesn't exist at this URL. Open the website link above to check it manually.
              {draft.website_audit.notes && (
                <Box sx={{ mt: 0.5, opacity: 0.8 }}>{draft.website_audit.notes}</Box>
              )}
            </Alert>
          ) : (
            <AuditChecklist audit={draft.website_audit} />
          )}
        </CollapsibleSection>

        {/* Score breakdown — collapsed accordion. Header shows the total
            score so user can decide whether to dig in. */}
        <CollapsibleSection
          title="Score breakdown"
          summary={`${score.score}/100 · ${score.grade || 'D'}`}
        >
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
        </CollapsibleSection>

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
// Bulk sweep — async, smart queue, progress bar
// ─────────────────────────────────────────────────────────────────────────────
function SweepDialog({ open, onClose, api, reference, onDone, autoStart, onAutoStartConsumed }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [usage, setUsage] = React.useState(null);
  const [status, setStatus] = React.useState(null);
  const [justStarted, setJustStarted] = React.useState(false);
  // Optional overrides — empty arrays = smart queue (today's default).
  const [pickedCats, setPickedCats]   = React.useState([]);
  const [pickedTowns, setPickedTowns] = React.useState([]);

  // Reset transient UI state when dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setErr('');
    setJustStarted(false);
    api.usage().then(setUsage).catch(() => {});
    api.sweepStatus().then(setStatus).catch(() => setStatus(null));
  }, [open, api]);

  // Poll status while the dialog is open. 2s is responsive but not abusive.
  // We also tell the parent (`onDone`) every time the sweep transitions to a
  // terminal state so it can refresh the leads list — and refresh OUR
  // own `usage` so the budget banner reflects the calls the sweep just
  // burned (otherwise the dialog would still say "0 / 200" after a
  // 200-call run and let the user re-press the button).
  const lastStatusRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const tick = async () => {
      try {
        const next = await api.sweepStatus();
        setStatus(next);
        const prev = lastStatusRef.current?.status;
        const cur = next?.status;
        if (prev === 'running' && (cur === 'completed' || cur === 'stopped' || cur === 'failed')) {
          api.usage().then(setUsage).catch(() => {});
          if (typeof onDone === 'function') onDone();
        }
        lastStatusRef.current = next;
      } catch (_) { /* ignore */ }
    };
    tick(); // immediate first poll
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [open, api, onDone]);

  const isRunning = status?.status === 'running';
  const isFinished = status && ['completed', 'stopped', 'failed'].includes(status.status);
  const bgAudit = status?.bg_audit;
  const auditing = bgAudit && bgAudit.status === 'running' && bgAudit.total > 0;
  const auditPct = (bgAudit && bgAudit.total)
    ? Math.min(100, Math.round(100 * (bgAudit.audited || 0) / bgAudit.total))
    : 0;

  // Block when the daily Places API budget is exhausted. Two signals:
  //   1) The usage snapshot says we're at/near the cap.
  //   2) The most recent sweep halted explicitly because of the cap.
  // (2) catches the stale-usage window: between the moment the sweep
  // halts and the moment /api/jpw/usage reports the updated counter.
  // Without it the "Run daily sweep" button briefly comes back after a
  // budget-halted sweep.
  const remainingBudget = usage ? Math.max(0, (usage.daily_cap || 200) - (usage.places_calls_today || 0)) : null;
  const budgetExhausted = remainingBudget !== null && remainingBudget < 10;
  // The persisted JpwSchedulerState doc keeps its halted_reason across the
  // midnight reset. Without this date check the "budget used up" banner
  // sticks around for the rest of the day after yesterday's budget-halted
  // sweep — even though places_calls_today has reset to 0 and 200 calls
  // are free again. Only count statusSaysBudget if the sweep finished
  // TODAY (or is still running with that reason).
  const haltedToday = (() => {
    const fin = status && status.finished_at;
    if (!fin) return false;
    const f = new Date(fin);
    const now = new Date();
    return f.getFullYear() === now.getFullYear()
        && f.getMonth() === now.getMonth()
        && f.getDate() === now.getDate();
  })();
  const statusSaysBudget = !isRunning
    && haltedToday
    && /cap reached|budget|daily places api/i.test(status?.halted_reason || '');
  const blocked = budgetExhausted || statusSaysBudget;
  const blockReason = "Daily Google Places budget is used up. Resets at midnight.";

  const submit = async () => {
    setBusy(true); setErr('');
    setJustStarted(false);
    try {
      const body = {};
      if (pickedCats.length)  body.categories = pickedCats;
      if (pickedTowns.length) body.towns      = pickedTowns;
      const r = await api.sweepPlaces(body);
      if (!r.ok) {
        setErr(r.message || 'Could not start sweep.');
        // The backend's own budget check fired — refresh usage so the
        // banner + button gating matches reality immediately.
        if (r.budget_exhausted) api.usage().then(setUsage).catch(() => {});
      } else {
        setJustStarted(true);
        const next = await api.sweepStatus();
        setStatus(next);
        lastStatusRef.current = next;
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  // Auto-start: when the toolbar button opens the dialog with autoStart=true
  // AND the sweep isn't already running AND today's hasn't already finished,
  // fire submit() immediately so the user doesn't have to click "Run" inside
  // the dialog too. We need `status` to know whether it's blocked, so we run
  // this in an effect that watches status.
  const autoStartFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) { autoStartFiredRef.current = false; return; }
    if (!autoStart || autoStartFiredRef.current) return;
    // Wait until we have status — otherwise we might start a sweep even
    // though today's already done.
    if (!status) return;
    if (isRunning || blocked) {
      // Don't auto-start — user can see why in the banner. Consume the flag
      // so it doesn't fire later.
      if (onAutoStartConsumed) onAutoStartConsumed();
      return;
    }
    autoStartFiredRef.current = true;
    if (onAutoStartConsumed) onAutoStartConsumed();
    submit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoStart, status, isRunning, blocked]);

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: TERM.bg, border: `1px solid ${TERM.border}` }}}>
      <DialogTitle sx={{ fontFamily: MONO, color: TERM.text, fontWeight: 700, borderBottom: `1px solid ${TERM.borderDim}` }}>
        Daily sweep
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {blocked && !isRunning && (
          <Alert severity="info" sx={{
            mb: 1.5, fontFamily: MONO, fontSize: 11.5,
            bgcolor: 'rgba(74,222,128,0.08)', color: TERM.text,
            border: `1px solid ${TERM.green}40`,
          }}>
            <Box sx={{ fontWeight: 700, mb: 0.3 }}>✓ Daily budget used</Box>
            {blockReason} Today's results are still here for review.
          </Alert>
        )}
        {usage && !blocked && (
          <Alert
            severity={usage.places_key_configured ? 'info' : 'warning'}
            sx={{ mb: 1.5, fontFamily: MONO, fontSize: 11 }}
          >
            {usage.places_key_configured
              ? `Today's Google Places budget: ${usage.places_calls_today} / ${usage.daily_cap} calls used. Sweep auto-halts when full.`
              : 'GOOGLE_PLACES_KEY is not set on the backend — this will fail.'}
          </Alert>
        )}
        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
        {justStarted && !isRunning && !isFinished && (
          <Alert severity="success" sx={{ mb: 1.5, fontFamily: MONO, fontSize: 11 }}>
            Sweep started. Progress will appear here in a second…
          </Alert>
        )}

        {/* Targeting — pick specific categories / towns, or leave blank
            for the smart queue. Hidden while a sweep is mid-run (the
            queue is already locked in) and when the daily budget is
            blocked (nothing to start). */}
        {!isRunning && !blocked && reference && (
          <Paper elevation={0} sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.borderDim}`,
            borderRadius: 1.5, p: 1.5, mb: 2,
          }}>
            <Typography sx={{
              fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted,
              fontWeight: 600, textTransform: 'uppercase', mb: 1,
            }}>Targeting (optional)</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
              <TextField
                select
                size="small"
                label={pickedCats.length ? `Categories (${pickedCats.length})` : 'Categories — all high-tier'}
                value={pickedCats}
                onChange={(e) => {
                  const v = e.target.value;
                  setPickedCats(typeof v === 'string' ? v.split(',') : v);
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (sel) => sel.length === 0
                    ? <Box component="span" sx={{ color: TERM.muted }}>All high-tier</Box>
                    : sel.join(', '),
                  MenuProps: {
                    PaperProps: { sx: { bgcolor: TERM.panel, maxHeight: 320, border: `1px solid ${TERM.borderDim}` } },
                  },
                }}
                sx={{ ...darkInputSx, flex: 1 }}
              >
                {(reference.categories || [])
                  .filter((c) => c.tier !== 'disqualify')
                  .map((c) => (
                    <MenuItem key={c.name} value={c.name} sx={{ fontFamily: MONO, fontSize: 12, color: TERM.text }}>
                      <Checkbox
                        checked={pickedCats.includes(c.name)}
                        size="small"
                        sx={{ color: TERM.muted, '&.Mui-checked': { color: TERM.green }, p: 0.5, mr: 1 }}
                      />
                      <ListItemText
                        primary={c.name}
                        secondary={c.tier}
                        primaryTypographyProps={{ sx: { fontFamily: MONO, fontSize: 12 } }}
                        secondaryTypographyProps={{ sx: { fontFamily: MONO, fontSize: 10, color: TERM.muted } }}
                      />
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                select
                size="small"
                label={pickedTowns.length ? `Towns (${pickedTowns.length})` : 'Towns — all SJ'}
                value={pickedTowns}
                onChange={(e) => {
                  const v = e.target.value;
                  setPickedTowns(typeof v === 'string' ? v.split(',') : v);
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (sel) => sel.length === 0
                    ? <Box component="span" sx={{ color: TERM.muted }}>All SJ towns</Box>
                    : sel.join(', '),
                  MenuProps: {
                    PaperProps: { sx: { bgcolor: TERM.panel, maxHeight: 320, border: `1px solid ${TERM.borderDim}` } },
                  },
                }}
                sx={{ ...darkInputSx, flex: 1 }}
              >
                {(reference.towns || []).map((t) => (
                  <MenuItem key={t} value={t} sx={{ fontFamily: MONO, fontSize: 12, color: TERM.text }}>
                    <Checkbox
                      checked={pickedTowns.includes(t)}
                      size="small"
                      sx={{ color: TERM.muted, '&.Mui-checked': { color: TERM.green }, p: 0.5, mr: 1 }}
                    />
                    <ListItemText
                      primary={t}
                      primaryTypographyProps={{ sx: { fontFamily: MONO, fontSize: 12 } }}
                    />
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            {(pickedCats.length > 0 || pickedTowns.length > 0) && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted }}>
                  Will run {(pickedCats.length || (reference.categories || []).filter((c) => c.tier === 'high').length) *
                            (pickedTowns.length || (reference.towns || []).length)} pair
                  {((pickedCats.length || 1) * (pickedTowns.length || 1)) === 1 ? '' : 's'}, capped at remaining API budget.
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  onClick={() => { setPickedCats([]); setPickedTowns([]); }}
                  sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 10.5, minWidth: 0 }}
                >Clear</Button>
              </Stack>
            )}
            {(pickedCats.length === 0 && pickedTowns.length === 0) && (
              <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, mt: 1 }}>
                Leave blank to use the smart queue (least-recently-run pairs across all of SJ).
              </Typography>
            )}
          </Paper>
        )}

        {/* Progress card — hide entirely when blocked. If today's budget
            is used up and the last sweep state is a no-op "0/1 STOPPED"
            (the user clicked when nothing could run), showing that as a
            "progress card" is misleading. The green banner above already
            tells them what happened. */}
        {!blocked && (isRunning || isFinished || justStarted) && status && (
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
              variant={isRunning && status.pairs_total === 0 ? 'indeterminate' : 'determinate'}
              value={pct}
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
            {status.halted_reason && status.status !== 'failed' && (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.amber, mt: 0.5 }}>
                Halted: {status.halted_reason}
              </Typography>
            )}
            {status.status === 'failed' && (
              <Alert severity="error" sx={{ mt: 1, fontFamily: MONO, fontSize: 11 }}>
                <Box sx={{ fontWeight: 700, mb: 0.3 }}>Sweep failed</Box>
                {status.error || status.halted_reason || 'Unknown error'}
              </Alert>
            )}
            {isRunning && (
              <Button onClick={stopSweep} size="small" sx={{
                color: TERM.amber, border: `1px solid ${TERM.amber}40`,
                fontFamily: MONO, fontSize: 11, fontWeight: 700, mt: 1,
              }}>Stop sweep</Button>
            )}
            {isFinished && status.status === 'completed' && (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.green, mt: 0.5 }}>
                ✓ Done
              </Typography>
            )}
          </Paper>
        )}

        {/* Background audit indicator — runs after sweep creates new leads.
            Tells the user "leads are showing up but their Pain score is
            still pending" so they know to come back in a minute instead
            of treating the grades as final. */}
        {(auditing || (bgAudit && bgAudit.status === 'completed' && (justStarted || isFinished))) && (
          <Paper elevation={0} sx={{
            bgcolor: TERM.panel, border: `1px solid ${auditing ? TERM.amber + '60' : TERM.borderDim}`,
            borderRadius: 1.5, p: 1.5, mb: 1,
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: TERM.text }}>
                {auditing ? (
                  <>Auditing websites <Box component="span" sx={{ color: TERM.muted, fontWeight: 400 }}>
                    · {bgAudit.audited || 0} / {bgAudit.total || 0}</Box></>
                ) : (
                  <>✓ Audited {bgAudit?.audited || 0} site{(bgAudit?.audited || 0) === 1 ? '' : 's'}</>
                )}
              </Typography>
              {auditing && (
                <CircularProgress size={12} sx={{ color: TERM.amber }} />
              )}
            </Stack>
            <LinearProgress
              variant="determinate"
              value={auditing ? auditPct : 100}
              sx={{
                height: 4, borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.05)',
                '& .MuiLinearProgress-bar': { bgcolor: auditing ? TERM.amber : TERM.green },
              }}
            />
            <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, mt: 0.5 }}>
              {auditing
                ? 'New leads are already in the queue. Grades update as each audit finishes.'
                : 'Grades and Pain scores reflect the latest audits.'}
            </Typography>
          </Paper>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${TERM.borderDim}`, px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: TERM.muted, fontFamily: MONO }}>
          {isRunning ? 'Close (sweep keeps running)' : 'Close'}
        </Button>
        {/* When blocked (already ran today or out of budget), the green
            banner up top says everything — no need for a disabled pill
            next to Close that looks like dead UI. When not blocked AND
            not running, we still show a manual "Run daily sweep" button
            as a fallback in case the auto-start from the toolbar didn't
            fire for some reason. */}
        {!isRunning && !blocked && (
          <Button onClick={submit} disabled={busy || justStarted} variant="contained"
            sx={{
              bgcolor: TERM.green, color: TERM.greenDk, fontFamily: MONO, fontWeight: 700,
              '&:hover': { bgcolor: '#3ecb6f' },
              '&.Mui-disabled': { bgcolor: TERM.green + '60', color: TERM.greenDk },
            }}>
            {(busy || justStarted) ? <CircularProgress size={18} sx={{ color: TERM.greenDk }} /> : 'Run daily sweep'}
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
  const [sweepOpen, setSweepOpen]   = React.useState(false);
  const [sweepAutoStart, setSweepAutoStart] = React.useState(false);
  const [usage, setUsage] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState(new Set());
  const [bulkPushBusy, setBulkPushBusy] = React.useState(false);
  const [cleanupConfirm, setCleanupConfirm] = React.useState(null); // {label, body} or null
  const [filters, setFilters] = React.useState({ grade: '', pushed: '', category: '', county: '', recommended_offer: '' });

  const loadAll = React.useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [statsRes, refRes] = await Promise.all([api.stats(), api.reference()]);
      setStats(statsRes); setReference(refRes);
      const params = view === 'queue'
        ? { grade: 'A+', sort: 'score_desc', limit: 500 }
        : { ...filters, sort: 'score_desc', limit: 500 };
      if (view === 'queue') {
        // A+/A only. If empty, the empty state will explain why — we do NOT
        // fall back to lower-grade leads. The point of the queue is to only
        // surface leads worth Nate's time.
        // A+/A/B — Nate's pool rarely produces A+ leads naturally, so we
        // include B too. The grade chip on each row still tells him what
        // they actually are; he can prioritize by score within the queue.
        const [a1, a2, b] = await Promise.all([
          api.listLeads({ grade: 'A+', sort: 'score_desc' }),
          api.listLeads({ grade: 'A',  sort: 'score_desc' }),
          api.listLeads({ grade: 'B',  sort: 'score_desc' }),
        ]);
        setLeads([...(a1.leads || []), ...(a2.leads || []), ...(b.leads || [])]);
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

  // Multi-select bulk push.
  const pushSelected = async () => {
    if (!selectedIds.size) return;
    setBulkPushBusy(true); setErr('');
    try {
      await api.pushSpiderBatch({
        ids: Array.from(selectedIds),
        only_unpushed: false,
      });
      setSelectedIds(new Set());
      await loadAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBulkPushBusy(false); }
  };

  // Push every lead currently in the Push Queue view (A+/A/B unpushed) in
  // one batch — for when the user just wants to fan everything out.
  const pushAllInView = async () => {
    const ids = filteredLeads
      .filter((l) => !l.pushed_to_spider_at)
      .map((l) => l._id);
    if (!ids.length) return;
    setCleanupConfirm({
      message: `Push all ${ids.length} unpushed leads in this view to Spider?`,
      action: 'push',
      ids,
    });
  };

  // Bulk delete selected leads — for "this lead is bad, don't waste my time
  // with it again". Uses the existing /bulk-delete endpoint with explicit ids.
  const deleteSelected = async () => {
    if (!selectedIds.size) return;
    setCleanupConfirm({
      message: `Delete ${selectedIds.size} selected lead${selectedIds.size === 1 ? '' : 's'}? This is permanent.`,
      action: 'delete',
      ids: Array.from(selectedIds),
    });
  };

  // Stable lead-row select toggle, passed down to LeadRow.
  const toggleSelected = React.useCallback((id) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

        <TextField size="small" placeholder="Search name / phone / city / category" sx={{ ...darkInputSx, width: { xs: '100%', sm: 280 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: TERM.muted }} /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')} sx={{ color: TERM.muted, p: 0.25 }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <Tooltip title="Refresh">
          <IconButton onClick={loadAll} sx={{ color: TERM.muted, border: `1px solid ${TERM.borderDim}`, borderRadius: 1 }}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        {selectedIds.size > 0 && (
          <>
            <Button size="small" startIcon={<SendIcon sx={{ fontSize: 14 }} />}
              onClick={pushSelected}
              disabled={!usage?.spider_configured || bulkPushBusy}
              sx={{
                bgcolor: TERM.green, color: TERM.greenDk,
                fontFamily: MONO, fontSize: 11, fontWeight: 700,
                '&:hover': { bgcolor: '#3ecb6f' },
              }}>
              {bulkPushBusy ? <CircularProgress size={14} /> : `Push ${selectedIds.size} → Spider`}
            </Button>
            <Button size="small"
              onClick={deleteSelected}
              sx={{
                color: TERM.red, border: `1px solid ${TERM.red}40`,
                fontFamily: MONO, fontSize: 11, fontWeight: 700,
                '&:hover': { bgcolor: `${TERM.red}10` },
              }}>
              Delete {selectedIds.size}
            </Button>
          </>
        )}
        {/* "Push all" — only shown on Push Queue view when there are
            unpushed leads to fan out. Skips a row-by-row select if the
            user just wants everything in. */}
        {view === 'queue' && selectedIds.size === 0 && filteredLeads.some((l) => !l.pushed_to_spider_at) && (
          <Button size="small" startIcon={<SendIcon sx={{ fontSize: 14 }} />}
            onClick={pushAllInView}
            disabled={!usage?.spider_configured}
            sx={{
              color: TERM.green, border: `1px solid ${TERM.green}40`,
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
            }}>
            Push all → Spider
          </Button>
        )}
        <Button size="small" startIcon={<TravelExploreIcon sx={{ fontSize: 14 }} />}
          onClick={() => { setSweepAutoStart(true); setSweepOpen(true); }}
          sx={{ color: TERM.green, border: `1px solid ${TERM.green}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Run daily sweep
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
        loading ? (
          <Stack alignItems="center" sx={{ my: 4 }}>
            <JpLoader size={56} label="Loading dashboard…" />
          </Stack>
        ) : (
          <Dashboard
            stats={stats}
            usage={usage}
            api={api}
            onAction={() => { loadAll(); api.usage().then(setUsage).catch(() => {}); }}
            requestCleanup={setCleanupConfirm}
          />
        )
      ) : (
        <Box>
          {loading ? (
            <Stack alignItems="center" sx={{ my: 4 }}>
              <JpLoader size={56} label="Loading leads…" />
            </Stack>
          ) : filteredLeads.length === 0 ? (
            <Paper elevation={0} sx={{
              bgcolor: TERM.panel, border: `1px dashed ${TERM.borderDim}`,
              borderRadius: 1.5, p: 4, textAlign: 'center',
            }}>
              {view === 'queue' ? (
                <Typography sx={{ fontFamily: MONO, fontSize: 13, color: TERM.text, fontWeight: 700 }}>
                  {(stats?.total || 0) === 0 ? 'No leads yet. Run a sweep.' : 'No A+/A leads in your pool right now.'}
                </Typography>
              ) : (
                <Typography sx={{ fontFamily: MONO, fontSize: 13, color: TERM.muted }}>
                  No leads match these filters.
                </Typography>
              )}
            </Paper>
          ) : (
            <Stack spacing={0.75}>
              {/* Select-all bar — click the box to toggle every visible lead,
                  or use the chip buttons for the common cases (all
                  unpushed, A+/A only). Keeps the user in control without
                  forcing 100 row-clicks. */}
              <Paper elevation={0} sx={{
                bgcolor: TERM.panelLite, border: `1px solid ${TERM.borderDim}`,
                borderRadius: 1.25, px: 1.2, py: 0.8,
              }}>
                <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap>
                  {(() => {
                    const visibleIds = filteredLeads.map((l) => l._id);
                    const allSel = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
                    const someSel = !allSel && visibleIds.some((id) => selectedIds.has(id));
                    return (
                      <Box
                        onClick={() => {
                          setSelectedIds((cur) => {
                            const next = new Set(cur);
                            if (allSel) visibleIds.forEach((id) => next.delete(id));
                            else        visibleIds.forEach((id) => next.add(id));
                            return next;
                          });
                        }}
                        sx={{
                          flexShrink: 0, width: 18, height: 18, borderRadius: 0.5,
                          border: `1.5px solid ${(allSel || someSel) ? TERM.green : TERM.borderDim}`,
                          bgcolor: allSel ? TERM.green : (someSel ? `${TERM.green}40` : 'transparent'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: TERM.greenDk, fontFamily: MONO, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer',
                          '&:hover': { borderColor: TERM.green },
                        }}
                      >{allSel ? '✓' : (someSel ? '−' : '')}</Box>
                    );
                  })()}
                  <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.text, fontWeight: 700 }}>
                    {selectedIds.size > 0
                      ? `${selectedIds.size} selected`
                      : `${filteredLeads.length} lead${filteredLeads.length === 1 ? '' : 's'}`}
                  </Typography>
                  <Box sx={{ height: 14, width: '1px', bgcolor: TERM.borderDim }} />
                  <Chip
                    size="small"
                    label="Select all unpushed"
                    onClick={() => {
                      const ids = filteredLeads.filter((l) => !l.pushed_to_spider_at).map((l) => l._id);
                      setSelectedIds(new Set(ids));
                    }}
                    sx={{
                      bgcolor: 'transparent', color: TERM.green, border: `1px solid ${TERM.green}40`,
                      fontFamily: MONO, fontSize: 10.5, height: 22,
                      '&:hover': { bgcolor: TERM.greenSoft },
                    }}
                  />
                  <Chip
                    size="small"
                    label="Select A+/A"
                    onClick={() => {
                      const ids = filteredLeads
                        .filter((l) => ['A+', 'A'].includes(l.lead_score?.grade))
                        .map((l) => l._id);
                      setSelectedIds(new Set(ids));
                    }}
                    sx={{
                      bgcolor: 'transparent', color: TERM.green, border: `1px solid ${TERM.green}40`,
                      fontFamily: MONO, fontSize: 10.5, height: 22,
                      '&:hover': { bgcolor: TERM.greenSoft },
                    }}
                  />
                  {selectedIds.size > 0 && (
                    <Chip
                      size="small"
                      label="Clear"
                      onClick={() => setSelectedIds(new Set())}
                      sx={{
                        bgcolor: 'transparent', color: TERM.muted, border: `1px solid ${TERM.borderDim}`,
                        fontFamily: MONO, fontSize: 10.5, height: 22,
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1 }} />
                  {search && (
                    <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted }}>
                      filtered by "{search}"
                    </Typography>
                  )}
                </Stack>
              </Paper>
              {filteredLeads.map((l) => (
                <LeadRow key={l._id} lead={l} onOpen={setSelected}
                  selected={selectedIds.has(l._id)}
                  onToggleSelect={toggleSelected}
                />
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
      <SweepDialog
        open={sweepOpen}
        autoStart={sweepAutoStart}
        onAutoStartConsumed={() => setSweepAutoStart(false)}
        onClose={() => setSweepOpen(false)} api={api}
        reference={reference}
        onDone={() => { loadAll(); api.usage().then(setUsage).catch(() => {}); }}
      />
      <ConfirmDialog
        open={!!cleanupConfirm}
        title={cleanupConfirm?.action === 'push' ? 'Push all to Spider?' : 'Delete leads?'}
        body={cleanupConfirm?.message || ''}
        confirmLabel={cleanupConfirm?.action === 'push' ? 'Push all' : 'Delete'}
        danger={cleanupConfirm?.action !== 'push'}
        onCancel={() => setCleanupConfirm(null)}
        onConfirm={async () => {
          if (!cleanupConfirm) return;
          try {
            // Three different payload shapes share this dialog:
            //   - { ids: [...], action: 'push' }    → bulk push to Spider
            //   - { ids: [...], action: 'delete' }  → bulk delete by id
            //   - { body: { grade: 'D' }, ... }     → bulk delete by filter
            if (cleanupConfirm.action === 'push') {
              const r = await api.pushSpiderBatch({ ids: cleanupConfirm.ids, only_unpushed: false });
              setCleanupConfirm(null);
              setSelectedIds(new Set());
              await loadAll();
              setErr(`Pushed ${r.pushed || 0} to Spider${r.skipped ? `, ${r.skipped} already there` : ''}.`);
              setTimeout(() => setErr(''), 3000);
            } else if (cleanupConfirm.action === 'delete' && cleanupConfirm.ids) {
              const r = await api.bulkDelete({ ids: cleanupConfirm.ids });
              setCleanupConfirm(null);
              setSelectedIds(new Set());
              await loadAll();
              setErr(`Deleted ${r.deleted} leads.`);
              setTimeout(() => setErr(''), 3000);
            } else {
              const r = await api.bulkDelete(cleanupConfirm.body);
              setCleanupConfirm(null);
              await loadAll();
              setErr(`Deleted ${r.deleted} leads.`);
              setTimeout(() => setErr(''), 3000);
            }
          } catch (e) {
            setErr(e?.response?.data?.message || e.message);
            setCleanupConfirm(null);
          }
        }}
      />
    </Box>
  );
}
