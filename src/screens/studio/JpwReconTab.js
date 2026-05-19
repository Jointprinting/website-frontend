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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
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
function Dashboard({ stats }) {
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
function LeadDetail({ lead, scoreCaps, onClose, api, onSaved }) {
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
          <Tooltip title="Phase 3 — Push to Spider sheet (new tab) coming next">
            <span>
              <Button
                disabled
                startIcon={<SendIcon sx={{ fontSize: 14 }} />}
                sx={{ color: TERM.muted, border: `1px dashed ${TERM.borderDim}`, fontFamily: MONO, fontSize: 11 }}
              >Push to Spider</Button>
            </span>
          </Tooltip>
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
        <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
          onClick={() => setAddOpen(true)}
          sx={{ color: TERM.green, border: `1px solid ${TERM.green}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Add Lead
        </Button>
        <Button size="small" startIcon={<UploadFileIcon sx={{ fontSize: 14 }} />}
          onClick={() => setImportOpen(true)}
          sx={{ color: TERM.text, border: `1px solid ${TERM.borderDim}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Import
        </Button>
        <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
          component="a" href={api.exportCsvUrl()} download
          sx={{ color: TERM.text, border: `1px solid ${TERM.borderDim}`, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
          Export CSV
        </Button>
        <Button size="small" onClick={rescoreAll}
          sx={{ color: TERM.muted, fontFamily: MONO, fontSize: 11 }}>
          Re-score
        </Button>
      </Stack>

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
        loading ? <CircularProgress sx={{ color: TERM.green, my: 4 }} /> : <Dashboard stats={stats} />
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
      />
      <AddLeadDialog
        open={addOpen} onClose={() => setAddOpen(false)} api={api} reference={reference}
        onCreated={(r) => { setAddOpen(false); loadAll(); if (r?.lead) setSelected(r.lead); }}
      />
      <ImportDialog
        open={importOpen} onClose={() => setImportOpen(false)} api={api}
        onDone={loadAll}
      />
    </Box>
  );
}
