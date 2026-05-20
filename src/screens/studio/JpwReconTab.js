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
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import LanguageIcon from '@mui/icons-material/Language';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

const CALL_STATUSES = [
  { value: 'new',              label: 'New',           color: TERM.blue   },
  { value: 'call_today',       label: 'Call Today',    color: TERM.green  },
  { value: 'called_no_answer', label: 'No Answer',     color: TERM.amber  },
  { value: 'left_voicemail',   label: 'Voicemail',     color: TERM.amber  },
  { value: 'gatekeeper',       label: 'Gatekeeper',    color: '#a78bfa'   },
  { value: 'interested',       label: 'Interested',    color: TERM.green  },
  { value: 'audit_requested',  label: 'Audit Sent',    color: '#06b6d4'   },
  { value: 'booked',           label: 'Booked ✓',      color: TERM.green  },
  { value: 'follow_up',        label: 'Follow Up',     color: TERM.amber  },
  { value: 'not_fit',          label: 'Not Fit',       color: '#9ca3af'   },
  { value: 'do_not_call',      label: 'DNC',           color: TERM.red    },
];
const statusMeta = (s) => CALL_STATUSES.find((x) => x.value === s) || CALL_STATUSES[0];

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

function StatusChip({ status }) {
  const meta = statusMeta(status);
  return (
    <Box sx={{
      display: 'inline-block', px: 0.9, py: 0.25, borderRadius: 0.75,
      fontFamily: MONO, fontWeight: 600, fontSize: 10,
      color: meta.color,
      bgcolor: `${meta.color}1a`,
      border: `1px solid ${meta.color}40`,
      letterSpacing: 0.5, textTransform: 'uppercase',
    }}>
      {meta.label}
    </Box>
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

// Manual entry panel for Meta Ad Library signals. Paste a Meta Ad Library
// page URL, advertiser name/ID, sample ad copy, etc. We store them on the
// lead's ad_signal subdoc; the scoring engine pulls buying-intent points
// straight from that.
//
// Confidence dropdown:
//   - "confirmed"  → active_ads_found = true   (full +15 / +4 for copy)
//   - "possible"   → active_ads_found = "possible" (+8 partial)
//   - "none"       → active_ads_found = false
function AdSignalPanel({ adSignal, onSave, busy }) {
  const [draft, setDraft] = React.useState(() => ({ ...(adSignal || {}) }));
  React.useEffect(() => { setDraft({ ...(adSignal || {}) }); }, [adSignal]);

  const confidence = adSignal?.active_ads_found === true
    ? 'confirmed'
    : adSignal?.active_ads_found === 'possible' ? 'possible'
    : adSignal?.active_ads_found === false      ? 'none' : '';

  const setConfidence = (val) => {
    let active_ads_found;
    if (val === 'confirmed') active_ads_found = true;
    else if (val === 'possible') active_ads_found = 'possible';
    else if (val === 'none') active_ads_found = false;
    setDraft({ ...draft, active_ads_found, confidence: val });
  };

  return (
    <Accordion
      elevation={0}
      sx={{
        bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
        borderRadius: '6px !important', mb: 1.5,
        '&:before': { display: 'none' },
        '&.Mui-expanded': { margin: '0 0 12px 0' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: TERM.muted }} />}
        sx={{ px: 1.5, '& .MuiAccordionSummary-content': { my: 1 }}}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase' }}>
            Meta ad signal
          </Typography>
          {confidence && (
            <Chip size="small" label={confidence} sx={{
              fontFamily: MONO, fontSize: 10, height: 18,
              bgcolor: confidence === 'confirmed' ? `${TERM.green}20` : confidence === 'possible' ? `${TERM.amber}20` : 'rgba(255,255,255,0.06)',
              color: confidence === 'confirmed' ? TERM.green : confidence === 'possible' ? TERM.amber : TERM.muted,
              border: `1px solid ${confidence === 'confirmed' ? TERM.green : confidence === 'possible' ? TERM.amber : TERM.borderDim}40`,
            }} />
          )}
          {adSignal?.active_ad_count > 0 && (
            <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted }}>
              {adSignal.active_ad_count} ads
            </Typography>
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={1}>
            <TextField select label="Confidence" size="small" sx={{ ...darkInputSx, width: 150 }}
              value={confidence} onChange={(e) => setConfidence(e.target.value)}>
              <MenuItem value="">unset</MenuItem>
              <MenuItem value="confirmed">confirmed (active)</MenuItem>
              <MenuItem value="possible">possible</MenuItem>
              <MenuItem value="none">no ads</MenuItem>
            </TextField>
            <TextField label="# active ads" type="number" size="small" sx={{ ...darkInputSx, width: 110 }}
              value={draft.active_ad_count || ''}
              onChange={(e) => setDraft({ ...draft, active_ad_count: parseInt(e.target.value, 10) || 0 })}/>
            <TextField label="Latest seen" type="date" size="small" sx={{ ...darkInputSx, flex: 1 }}
              InputLabelProps={{ shrink: true }}
              value={(draft.latest_seen_date || '').slice(0, 10)}
              onChange={(e) => setDraft({ ...draft, latest_seen_date: e.target.value })}/>
          </Stack>
          <TextField label="Meta Ad Library URL or page" size="small" sx={darkInputSx}
            placeholder="https://www.facebook.com/ads/library/?id=…  or  Page name"
            value={draft.page_url || draft.page_name || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (/^https?:\/\//i.test(v)) setDraft({ ...draft, page_url: v });
              else setDraft({ ...draft, page_name: v });
            }}/>
          <TextField label="Ad angle / copy summary" multiline minRows={2} size="small" sx={darkInputSx}
            placeholder='e.g. "Free estimate today, financing available, emergency service 24/7"'
            value={draft.ad_angle_summary || ''}
            onChange={(e) => setDraft({ ...draft, ad_angle_summary: e.target.value })}/>
          <TextField label="Sample ad copy (one per line)" multiline minRows={2} size="small" sx={darkInputSx}
            value={Array.isArray(draft.ad_text_samples) ? draft.ad_text_samples.join('\n') : (draft.ad_text_samples || '')}
            onChange={(e) => setDraft({ ...draft, ad_text_samples: e.target.value.split('\n').filter(Boolean) })}/>
          <TextField label="Landing pages (one per line)" multiline minRows={1} size="small" sx={darkInputSx}
            value={Array.isArray(draft.landing_page_urls) ? draft.landing_page_urls.join('\n') : (draft.landing_page_urls || '')}
            onChange={(e) => setDraft({ ...draft, landing_page_urls: e.target.value.split('\n').filter(Boolean) })}/>
          <Stack direction="row" justifyContent="flex-end">
            <Button onClick={() => onSave(draft)} disabled={busy}
              sx={{
                bgcolor: TERM.green, color: TERM.greenDk, fontFamily: MONO, fontWeight: 700, fontSize: 11.5,
                '&:hover': { bgcolor: '#3ecb6f' },
              }}>Save & re-score</Button>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function ScoreBar({ label, value, max, color = TERM.green }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 0.75 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted }}>{label}</Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.text, fontWeight: 700 }}>
          {value}/{max}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate" value={pct}
        sx={{
          height: 4, borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.04)',
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
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
  const booked = stats.byStatus['booked'] || 0;
  const called = (stats.byStatus['called_no_answer'] || 0)
               + (stats.byStatus['left_voicemail'] || 0)
               + (stats.byStatus['gatekeeper'] || 0)
               + (stats.byStatus['interested'] || 0)
               + (stats.byStatus['audit_requested'] || 0)
               + booked;

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
        <KpiTile label="Calls Made" value={called} />
        <KpiTile label="Booked" value={booked} accent={TERM.green} />
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

      {/* Scoring rubric — read-only reference */}
      <Accordion elevation={0} sx={{
        bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
        borderRadius: '6px !important', '&:before': { display: 'none' },
        '&.Mui-expanded': { margin: 0 },
      }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: TERM.muted }} />}
          sx={{ px: 1.5, '& .MuiAccordionSummary-content': { my: 1 }}}>
          <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase' }}>
            Scoring rubric · 100 pts
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
          <Box sx={{ fontFamily: MONO, fontSize: 11.5, color: TERM.text, lineHeight: 1.6 }}>
            <Box sx={{ color: TERM.green, fontWeight: 700, mt: 0.5 }}>Buying Intent · max 30</Box>
            Active Meta ads (+15) · possible (+8) · multiple ads (+4) · high-intent ad copy (+4) · 150+ reviews (+7) · 50+ (+5) · 25+ (+3) · tracking pixels (+3) · landing-page structure (+2) · 3+ service areas (+2)
            <Box sx={{ color: TERM.amber, fontWeight: 700, mt: 1 }}>Pain · max 25</Box>
            No website (+10) · loads poorly (+8) · no click-to-call (+5) · no quote CTA (+5) · no form (+4) · weak meta (+3) · no service area (+4) · no on-site reviews (+3) · no gallery (+3) · outdated copyright (+2) · bad mobile speed (+4) · no LocalBusiness schema (+3)
            <Box sx={{ color: TERM.blue, fontWeight: 700, mt: 1 }}>Ability to Pay · max 25</Box>
            High-ticket category (+8) · 150+ reviews (+7) or 50+ (+5) · 4.2★ with 25+ (+3) · weak site that exists (+4) · running ads (+5) · multiple areas (+4) · emergency category (+2)
            <Box sx={{ color: TERM.green, fontWeight: 700, mt: 1 }}>Fit · max 15</Box>
            In South Jersey (+5) · independent (+4) · phone-driven (+4) · matches a core offer (+2)
            <Box sx={{ color: TERM.red, fontWeight: 700, mt: 1 }}>Urgency · max 5</Box>
            Seasonal demand (+2) · emergency category (+2) · recent ad activity (+1)
            <Box sx={{ color: TERM.red, fontWeight: 700, mt: 1 }}>Penalties</Box>
            Closed (excluded) · no phone (-20) · outside SJ (-25) · franchise (-25) · disqualify category (-15) · already polished + has agency (-20) · {'<10 reviews'} no ads (-20) · no website no reviews no signals (-25) · residential only (-15)
            <Box sx={{ color: TERM.muted, mt: 1 }}>Grades:</Box>
            A+ 82-100 · A 72-81 · B 60-71 · C 45-59 · D under 45
          </Box>
        </AccordionDetails>
      </Accordion>
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
          <StatusChip status={lead.call_status} />
        </Box>
        {lead.pushed_to_spider_at && (
          <Tooltip title={`In Spider since ${new Date(lead.pushed_to_spider_at).toLocaleDateString()}`}>
            <CheckCircleOutlineIcon sx={{ color: TERM.green, fontSize: 16, opacity: 0.8 }} />
          </Tooltip>
        )}
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
function LeadDetail({ lead, scoreCaps, onClose, api, onSaved, spiderConfigured }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [draft, setDraft] = React.useState(lead || {});
  React.useEffect(() => { setDraft(lead || {}); setErr(''); }, [lead]);

  if (!lead) return null;
  const score = draft.lead_score || {};

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const updated = await api.updateLead(lead._id, {
        call_status: draft.call_status,
        call_notes:  draft.call_notes,
        next_follow_up_at: draft.next_follow_up_at || null,
        owner_name:  draft.owner_name,
        email:       draft.email,
        category:    draft.category,
        is_franchise: !!draft.is_franchise,
      });
      onSaved(updated);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  const quickStatus = async (status) => {
    setBusy(true); setErr('');
    try {
      const updated = await api.updateLead(lead._id, { call_status: status });
      setDraft(updated);
      onSaved(updated);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

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

  const saveAdSignal = async (adForm) => {
    setBusy(true); setErr('');
    try {
      const updated = await api.updateAdSignal(lead._id, adForm);
      setDraft(updated);
      onSaved(updated);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  const copy = (text) => navigator.clipboard?.writeText(text || '');

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
              <StatusChip status={draft.call_status} />
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

        {/* Recommended offer + opener */}
        <Paper elevation={0} sx={{
          bgcolor: TERM.greenSoft, border: `1px solid ${TERM.border}`,
          borderRadius: 1.5, p: 1.5, mb: 1.5,
        }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase', mb: 0.5 }}>
            Recommended Offer
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 14, color: TERM.green, fontWeight: 700, mb: 1 }}>
            {score.recommendedOffer || '—'}
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 12, color: TERM.text, lineHeight: 1.5, fontStyle: 'italic' }}>
            "{score.pitchAngle}"
          </Typography>
        </Paper>

        <Paper elevation={0} sx={{
          bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
          borderRadius: 1.5, p: 1.5, mb: 1.5,
        }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase' }}>
              Suggested Opener
            </Typography>
            <IconButton size="small" onClick={() => copy(score.opener)} sx={{ color: TERM.green }}>
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
          <Typography sx={{ fontFamily: MONO, fontSize: 12.5, color: TERM.text, lineHeight: 1.55 }}>
            {score.opener || '—'}
          </Typography>
        </Paper>

        {/* Quick status buttons */}
        <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase', mb: 0.5 }}>
          Update status
        </Typography>
        <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          {['called_no_answer', 'left_voicemail', 'gatekeeper', 'interested', 'audit_requested', 'booked', 'follow_up', 'not_fit', 'do_not_call'].map((s) => {
            const m = statusMeta(s);
            return (
              <Button key={s} size="small" disabled={busy} onClick={() => quickStatus(s)}
                sx={{
                  color: m.color, border: `1px solid ${m.color}40`,
                  fontFamily: MONO, fontSize: 10.5, textTransform: 'none',
                  '&:hover': { bgcolor: `${m.color}10`, borderColor: m.color },
                }}>{m.label}</Button>
            );
          })}
        </Stack>

        {/* Score breakdown */}
        <Paper elevation={0} sx={{
          bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
          borderRadius: 1.5, p: 1.5, mb: 1.5,
        }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase', mb: 1 }}>
            Score Breakdown · {score.score}/100
          </Typography>
          <ScoreBar label="Buying intent" value={score.breakdown?.buyingIntent || 0} max={scoreCaps?.buyingIntent || 30} color={TERM.green} />
          <ScoreBar label="Pain"           value={score.breakdown?.pain || 0}         max={scoreCaps?.pain || 25}          color={TERM.amber} />
          <ScoreBar label="Ability to pay" value={score.breakdown?.abilityToPay || 0} max={scoreCaps?.abilityToPay || 25}  color={TERM.blue} />
          <ScoreBar label="Fit"            value={score.breakdown?.fit || 0}          max={scoreCaps?.fit || 15}           color={TERM.green} />
          <ScoreBar label="Urgency"        value={score.breakdown?.urgency || 0}      max={scoreCaps?.urgency || 5}        color={TERM.red} />
          {score.breakdown?.penaltyDelta < 0 && (
            <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.red, mt: 0.5 }}>
              Penalties: {score.breakdown.penaltyDelta}
            </Typography>
          )}
        </Paper>

        {/* Buying signals & pain points */}
        {(score.buyingSignals?.length > 0) && (
          <Paper elevation={0} sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
            borderRadius: 1.5, p: 1.5, mb: 1.5,
          }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.green, fontWeight: 600, textTransform: 'uppercase', mb: 0.6 }}>
              Buying signals
            </Typography>
            {score.buyingSignals.map((s, i) => (
              <Typography key={i} sx={{ fontFamily: MONO, fontSize: 12, color: TERM.text, lineHeight: 1.55 }}>
                · {s}
              </Typography>
            ))}
          </Paper>
        )}
        {(score.mainPainPoints?.length > 0) && (
          <Paper elevation={0} sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
            borderRadius: 1.5, p: 1.5, mb: 1.5,
          }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.amber, fontWeight: 600, textTransform: 'uppercase', mb: 0.6 }}>
              Main weaknesses · what to mention
            </Typography>
            {score.mainPainPoints.map((s, i) => (
              <Typography key={i} sx={{ fontFamily: MONO, fontSize: 12, color: TERM.text, lineHeight: 1.55 }}>
                · {s}
              </Typography>
            ))}
          </Paper>
        )}
        {(score.disqualifiers?.length > 0) && (
          <Alert severity="warning" sx={{ mb: 1.5, fontFamily: MONO, fontSize: 12 }}>
            Disqualifiers: {score.disqualifiers.join(', ')}
          </Alert>
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

        <AdSignalPanel
          adSignal={draft.ad_signal}
          onSave={saveAdSignal}
          busy={busy}
        />

        {/* Editable section */}
        <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: TERM.muted, fontWeight: 600, textTransform: 'uppercase', mb: 0.6 }}>
          Notes
        </Typography>
        <TextField
          multiline minRows={3} fullWidth size="small"
          value={draft.call_notes || ''}
          onChange={(e) => setDraft({ ...draft, call_notes: e.target.value })}
          placeholder="Call notes, objections, who you spoke to…"
          sx={{ ...darkInputSx, mb: 1.2 }}
        />
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <TextField
            label="Owner / contact" size="small" sx={{ ...darkInputSx, flex: 1 }}
            value={draft.owner_name || ''}
            onChange={(e) => setDraft({ ...draft, owner_name: e.target.value })}
          />
          <TextField
            label="Follow-up date" size="small" type="date"
            InputLabelProps={{ shrink: true }}
            sx={{ ...darkInputSx, width: 170 }}
            value={(draft.next_follow_up_at || '').slice(0, 10)}
            onChange={(e) => setDraft({ ...draft, next_follow_up_at: e.target.value })}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            onClick={save} disabled={busy} variant="contained"
            sx={{
              bgcolor: TERM.green, color: TERM.greenDk, fontFamily: MONO, fontWeight: 700,
              '&:hover': { bgcolor: '#3ecb6f' },
            }}
          >Save</Button>
          <Button onClick={onClose} sx={{ color: TERM.muted, fontFamily: MONO }}>
            Close
          </Button>
          <Box sx={{ flex: 1 }} />
          {draft.pushed_to_spider_at ? (
            <Tooltip title={`Pushed ${new Date(draft.pushed_to_spider_at).toLocaleString()}`}>
              <span>
                <Button
                  startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                  onClick={pushToSpider} disabled={busy || !spiderConfigured}
                  sx={{ color: TERM.green, border: `1px solid ${TERM.green}40`, fontFamily: MONO, fontSize: 11 }}
                >Re-push</Button>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title={spiderConfigured ? 'Append to Spider sheet, "JPW Recon" tab' : 'Spider webhook not configured on backend'}>
              <span>
                <Button
                  startIcon={<SendIcon sx={{ fontSize: 14 }} />}
                  onClick={pushToSpider} disabled={busy || !spiderConfigured}
                  sx={{
                    color: TERM.green, border: `1px solid ${TERM.green}`,
                    fontFamily: MONO, fontSize: 11, fontWeight: 700,
                    '&:hover': { bgcolor: `${TERM.green}10` },
                  }}
                >Push to Spider</Button>
              </span>
            </Tooltip>
          )}
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
            "{result.query}" → received {result.received}, created {result.created},
            merged {result.merged}, skipped {result.skipped}.
          </Alert>
        )}
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, mb: 1.5 }}>
          Searches a single category × town/county. Results are deduped against your existing leads
          and scored automatically. One call uses one quota slot — re-running the same query updates
          stale rating/review counts.
        </Typography>
        <Stack spacing={1.5}>
          <TextField select required label="Category" size="small" sx={darkInputSx}
            value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {(reference?.categories || []).filter((c) => c.tier !== 'disqualify').map((c) => (
              <MenuItem key={c.name} value={c.name}>
                {c.name}{c.tier === 'high' ? ' · high-ticket' : ''}
              </MenuItem>
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
// Main tab
// ─────────────────────────────────────────────────────────────────────────────
export default function JpwReconTab({ token }) {
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
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [auditingBatch, setAuditingBatch] = React.useState(false);
  const [usage, setUsage] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState({ grade: '', call_status: '', category: '', county: '', recommended_offer: '' });

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
  }, [api, view, filters.grade, filters.call_status, filters.category, filters.county, filters.recommended_offer]);

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
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) =>
      (l.business_name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.city || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q)
    );
  }, [leads, search]);

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
          <ToggleButton value="queue">Call Queue</ToggleButton>
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
          sx={{ color: TERM.green, border: `1px solid ${TERM.green}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Search Places
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
          <TextField select label="Status" size="small" sx={{ ...darkInputSx, width: 150 }}
            value={filters.call_status} onChange={(e) => setFilters({ ...filters, call_status: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            {CALL_STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
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
    </Box>
  );
}
