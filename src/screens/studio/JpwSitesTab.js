// src/screens/studio/JpwSitesTab.js
// JP Webworks — Websites. The build-and-preview cockpit for the website
// subscription business. The whole workflow lives here:
//
//   1. NEW SITE   — the landing is template-forward: with no sites yet it IS a
//                   rich template gallery (mock-up thumbs + palette bands drawn
//                   from the registry meta); with sites, one "New site" header
//                   button plus a slim template-chip row under the list. Either
//                   template click opens the New Site dialog PRE-selected, pick
//                   the business type, name it. POST /api/jpw/sites → editor.
//   2. EDIT       — two-pane editor: form left, the REAL template component
//                   rendering live on the right (scaled with transform).
//                   Autosaves via debounced PUT — no Save button to hunt.
//   3. PREVIEW    — "Publish preview" flips status → 'preview', which makes
//                   /webworks/p/:slug public. Copy the link, text it to the
//                   prospect. "Back to draft" 404s the link again.
//   4. LIVE       — after the client pays: "Connect domain…" walks through
//                   the exact Vercel + DNS steps, stores the domain, and flips
//                   status → 'live'.
//
// Templates + palettes come from src/webworks/templates (the SAME registry the
// public /webworks/p/:slug route renders from, so what the owner previews here
// is byte-for-byte what the prospect sees).
//
// Backend: GET/POST /api/jpw/sites, PUT/DELETE /api/jpw/sites/:id (Bearer).

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Paper, Button, TextField, MenuItem, IconButton, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert, CircularProgress,
  Typography as T, Grow, Fade, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import config from '../../config.json';
import { D, mono, eyebrow, dropInput, dropPrimaryBtn, dropGhostBtn, fmtRelative } from './_shared';
import { confirmDialog, promptDialog } from './_dialog';
import { TEMPLATES, getTemplate } from '../../webworks/templates';
import JpLoader from '../../common/JpLoader';

const API = `${config.backendUrl}/api/jpw/sites`;
// AI-credit guardrail snapshot — mirrors the Studio hub's Signal row, shown small
// right by the Generate button so the spend is visible where it happens.
const AI_USAGE_API = `${config.backendUrl}/api/jpw/ai-usage`;

// Status vocabulary — mirrors the backend JpwSite status enum.
const SITE_STATUS = {
  draft:   { label: 'Draft',        color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  preview: { label: 'Preview live', color: D.green,   bg: 'rgba(74,222,128,0.14)'  },
  live:    { label: 'Live',         color: '#34d399', bg: 'rgba(52,211,153,0.16)'  },
};
const siteStatus = (s) => SITE_STATUS[s] || SITE_STATUS.draft;

// The public URL a prospect gets. Same origin as the Studio — the preview
// route is part of this app.
const previewUrl = (slug) => `${window.location.origin}/webworks/p/${slug}`;

// Starter `data` bag for a new site — mirrors the backend JpwSite data shape.
// businessName is seeded from the site name; everything else starts empty so
// the templates hide those sections until the owner fills them in.
const seedData = (businessName, template, businessType = '') => ({
  businessName,
  // Travels WITH the site so every template can render business-type-topical
  // visuals (a plumbing site reads as plumbing, not generic stock). Mirrors the
  // top-level JpwSite.businessType; kept here so the render path — which only
  // receives `data` — can reach it.
  businessType,
  tagline: '', heroHeadline: '', ctaLabel: '',
  phone: '', email: '', serviceArea: '', address: '',
  hours: [{ days: 'Mon – Fri', hours: '9:00 AM – 5:00 PM' }],
  services: [],
  about: '',
  testimonials: [],
  paletteId: template?.palettes?.[0]?.id || '',
  established: '', license: '',
  // Empty = the template paints its own crafted, on-brand TOPICAL scene (no
  // generic stock); owner photo URLs override slot-by-slot.
  photos: { hero: '', gallery: ['', '', ''] },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Small pieces
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ site }) {
  const meta = siteStatus(site.status);
  const label = site.status === 'live' && site.domain
    ? `Live — ${site.domain}`
    : meta.label;
  return (
    <Chip label={label} size="small" sx={{
      bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: 11,
      height: 22, border: `1px solid ${meta.color}33`, maxWidth: 220,
    }} />
  );
}

// Stylized mini-preview for a template card — a fake one-pager drawn from the
// template's first palette (nav band, headline bars, a button dot). No
// screenshots to maintain; it always matches the palette data. `rich` adds a
// services-tile row (the empty-state gallery cards get the fuller mock-up);
// `sx` lets the gallery run it full-bleed inside its card.
function TemplateThumb({ tpl, rich, sx }) {
  const [deep, accent, bg] = tpl.palettes[0].swatches;
  const bar = (w, c, h = 6) => (
    <Box sx={{ width: w, height: h, borderRadius: 99, bgcolor: c }} />
  );
  return (
    <Box sx={{
      borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${D.line}`,
      bgcolor: bg, aspectRatio: rich ? '16 / 11' : '16 / 10',
      display: 'flex', flexDirection: 'column', ...sx,
    }}>
      {/* nav strip */}
      <Box sx={{ bgcolor: deep, px: 1, py: 0.6, display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: accent }} />
        <Box sx={{ width: 26, height: 4, borderRadius: 99, bgcolor: 'rgba(255,255,255,0.7)' }} />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ width: 18, height: 6, borderRadius: 99, bgcolor: accent }} />
      </Box>
      {/* hero */}
      <Box sx={{ p: 1.1, display: 'flex', flexDirection: 'column', gap: 0.7, flex: 1 }}>
        {bar('72%', deep, 8)}
        {bar('48%', deep, 8)}
        {bar('60%', `${deep}55`, 4)}
        <Box sx={{ mt: 'auto', display: 'flex', gap: 0.6 }}>
          <Box sx={{ width: 30, height: 9, borderRadius: 99, bgcolor: accent }} />
          <Box sx={{ width: 22, height: 9, borderRadius: 99, border: `1px solid ${deep}55` }} />
        </Box>
      </Box>
      {/* services tiles — only on the rich (gallery) variant */}
      {rich && (
        <Box sx={{ px: 1.1, pb: 1.1, display: 'flex', gap: 0.6 }}>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{
              flex: 1, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.75)',
              border: `1px solid ${deep}22`, p: 0.6,
              display: 'flex', flexDirection: 'column', gap: 0.45,
            }}>
              <Box sx={{ width: 9, height: 9, borderRadius: 0.5, bgcolor: i === 1 ? accent : `${deep}cc` }} />
              <Box sx={{ width: '85%', height: 3, borderRadius: 99, bgcolor: `${deep}55` }} />
              <Box sx={{ width: '60%', height: 3, borderRadius: 99, bgcolor: `${deep}33` }} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Rich gallery card for the Websites landing (empty state) — the template
// registry's own meta rendered big: full-bleed mock-up, a band of every
// palette swatch, name, one-line description, business-type chips. Clicking
// anywhere opens the New Site dialog with this template pre-selected.
function TemplateGalleryCard({ tpl, onPick, delay }) {
  const typeChipSx = {
    height: 20, fontSize: 10.5, fontWeight: 600, borderRadius: 999,
    bgcolor: 'rgba(255,255,255,0.05)', color: D.muted, border: `1px solid ${D.line}`,
    '& .MuiChip-label': { px: 1 },
  };
  const shown = tpl.businessTypes.slice(0, 3);
  const more = tpl.businessTypes.length - shown.length;
  return (
    <Grow in timeout={delay}>
      <Paper
        elevation={0}
        onClick={() => onPick(tpl.id)}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(tpl.id); } }}
        sx={{
          borderRadius: 2.5, overflow: 'hidden', cursor: 'pointer', bgcolor: D.inset,
          border: `1px solid ${D.line}`, display: 'flex', flexDirection: 'column',
          transition: 'border-color .18s ease, transform .18s ease, box-shadow .2s ease',
          '&:hover': {
            borderColor: D.lineHi, transform: 'translateY(-3px)',
            boxShadow: `0 14px 32px -16px ${D.glow}`,
            '& .tpl-cta': { color: D.green },
          },
          '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: 2 },
        }}
      >
        <TemplateThumb tpl={tpl} rich sx={{ borderRadius: 0, border: 'none' }} />
        {/* palette band — every palette's swatches in one strip, so the card
            says "this template ships in all these colorways" at a glance */}
        <Box sx={{ display: 'flex', height: 6, flexShrink: 0 }}>
          {tpl.palettes.flatMap((p) => p.swatches).map((c, i) => (
            <Box key={i} sx={{ flex: 1, bgcolor: c }} />
          ))}
        </Box>
        <Box sx={{ p: 1.75, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <T sx={{ fontWeight: 800, fontSize: 14.5, color: D.text }}>{tpl.label}</T>
            <T className="tpl-cta" sx={{
              ...mono, fontSize: 10.5, fontWeight: 700, color: D.faint,
              whiteSpace: 'nowrap', transition: 'color .18s ease',
            }}>
              Start →
            </T>
          </Stack>
          <T sx={{ color: D.muted, fontSize: 12, lineHeight: 1.5 }}>{tpl.description}</T>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 'auto', pt: 0.5 }}>
            {shown.map((b) => <Chip key={b} label={b} size="small" sx={typeChipSx} />)}
            {more > 0 && <Chip label={`+${more} more`} size="small" sx={typeChipSx} />}
          </Stack>
        </Box>
      </Paper>
    </Grow>
  );
}

// Palette swatch trio — used in the picker cards and the Style section.
function SwatchDots({ swatches, size = 14 }) {
  return (
    <Stack direction="row" spacing={0.5}>
      {swatches.map((c, i) => (
        <Box key={i} sx={{
          width: size, height: size, borderRadius: '50%', bgcolor: c,
          border: '1px solid rgba(255,255,255,0.25)',
        }} />
      ))}
    </Stack>
  );
}

// Debounced-autosave state readout. Quiet mono text in the editor header —
// the whole point is that the owner never thinks about saving.
function SaveIndicator({ state, onRetry }) {
  const map = {
    dirty:  { txt: 'Editing…',   color: D.faint },
    saving: { txt: 'Saving…',    color: D.amber },
    saved:  { txt: '✓ Saved',    color: D.green },
    error:  { txt: 'Save failed — retry', color: '#f87171' },
  };
  const m = map[state];
  if (!m) return null;
  return (
    <T
      onClick={state === 'error' ? onRetry : undefined}
      sx={{
        ...mono, fontSize: 11.5, fontWeight: 700, color: m.color,
        cursor: state === 'error' ? 'pointer' : 'default', whiteSpace: 'nowrap',
        ...(state === 'error' ? { '&:hover': { textDecoration: 'underline' } } : {}),
      }}
    >
      {m.txt}
    </T>
  );
}

// Form section scaffold — eyebrow + hairline, matching the Studio's rhythm.
function Section({ title, hint, children }) {
  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.25 }}>
        <T sx={{ ...eyebrow, fontSize: 10.5, letterSpacing: 1.8 }}>{title}</T>
        <Box sx={{ flex: 1, height: 1, bgcolor: D.line, alignSelf: 'center' }} />
      </Stack>
      {hint && <T sx={{ color: D.faint, fontSize: 11.5, mb: 1.25 }}>{hint}</T>}
      <Stack spacing={1.25}>{children}</Stack>
    </Box>
  );
}

const fieldSx = { ...dropInput };
function F({ label, value, onChange, multiline, minRows, placeholder, type }) {
  return (
    <TextField
      label={label} value={value || ''} onChange={(e) => onChange(e.target.value)}
      size="small" fullWidth multiline={!!multiline} minRows={minRows}
      placeholder={placeholder} type={type || 'text'} sx={fieldSx}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Live preview — the actual template component, scaled to fit its pane
// ─────────────────────────────────────────────────────────────────────────────
// The template renders at its natural design width (1280 desktop / 390 phone)
// inside an absolutely-positioned box that's transform-scaled down to the
// pane. Height is compensated (paneHeight / scale) so the inner box scrolls
// its own overflow — the owner can scroll the whole one-pager inside the pane.
function ScaledPreview({ templateId, data, device }) {
  const tpl = getTemplate(templateId);
  const hostRef = React.useRef(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });

  React.useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener('resize', measure);
    }
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', measure); };
  }, []);

  const baseW = device === 'phone' ? 390 : 1280;
  const scale = box.w > 0 ? Math.min(box.w / baseW, 1) : 0;

  return (
    <Box ref={hostRef} sx={{
      height: { xs: '62vh', md: '72vh' }, borderRadius: 2, overflow: 'hidden',
      border: `1px solid ${D.line}`, bgcolor: '#ffffff', position: 'relative',
    }}>
      {scale > 0 && tpl && (
        <Box sx={{
          position: 'absolute', top: 0,
          left: `${Math.max(0, (box.w - baseW * scale) / 2)}px`,
          width: baseW, height: `${box.h / scale}px`,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          overflowY: 'auto', overflowX: 'hidden', bgcolor: '#fff',
        }}>
          <React.Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
              <CircularProgress size={28} sx={{ color: '#1a3d2b' }} />
            </Box>
          }>
            <tpl.Component data={data} />
          </React.Suspense>
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Repeatable row editors (hours / services / testimonials)
// ─────────────────────────────────────────────────────────────────────────────
// One generic list editor: `fields` describes the inputs per row; rows with a
// `wide` field put it on its own line. Remove is always available; templates
// simply hide empty rows so a half-filled row never breaks the preview.
function RowsEditor({ rows, onChange, fields, addLabel, blank }) {
  const list = Array.isArray(rows) ? rows : [];
  const setRow = (i, key, v) => {
    const next = list.map((r, idx) => (idx === i ? { ...r, [key]: v } : r));
    onChange(next);
  };
  const removeRow = (i) => onChange(list.filter((_, idx) => idx !== i));
  const addRow = () => onChange([...list, { ...blank }]);
  return (
    <Stack spacing={1.25}>
      {list.map((r, i) => (
        <Box key={i} sx={{
          p: 1.25, borderRadius: 1.5, border: `1px solid ${D.line}`, bgcolor: D.inset,
        }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {fields.filter((f) => !f.wide).map((f) => (
                  <TextField
                    key={f.key} label={f.label} value={r[f.key] || ''}
                    onChange={(e) => setRow(i, f.key, e.target.value)}
                    size="small" fullWidth sx={{ ...fieldSx, ...(f.narrow ? { maxWidth: { sm: 140 } } : {}) }}
                    placeholder={f.placeholder}
                  />
                ))}
              </Stack>
              {fields.filter((f) => f.wide).map((f) => (
                <TextField
                  key={f.key} label={f.label} value={r[f.key] || ''}
                  onChange={(e) => setRow(i, f.key, e.target.value)}
                  size="small" fullWidth multiline minRows={f.minRows || 2}
                  sx={{ ...fieldSx, mt: 1 }} placeholder={f.placeholder}
                />
              ))}
            </Box>
            <IconButton size="small" onClick={() => removeRow(i)} aria-label="Remove row"
              sx={{ color: D.faint, mt: 0.25, '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}>
              <RemoveCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      ))}
      <Button startIcon={<AddIcon />} onClick={addRow} size="small" sx={{
        ...dropGhostBtn, alignSelf: 'flex-start', fontSize: 12.5, px: 1.75, py: 0.5,
      }}>
        {addLabel}
      </Button>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Connect-domain dialog — the "client paid" moment
// ─────────────────────────────────────────────────────────────────────────────
const DOMAIN_RX = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

function ConnectDomainDialog({ open, onClose, onConnect, busy, siteName }) {
  const [domain, setDomain] = React.useState('');
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const valid = DOMAIN_RX.test(clean);
  const steps = [
    ['Client has paid', 'This is the switch you flip after the first subscription payment lands.'],
    ['Own the domain', 'Buy it (or take a transfer of theirs) at your registrar.'],
    ['Add it in Vercel', 'Vercel → the website-frontend project → Settings → Domains → add the domain.'],
    ['Point the DNS', 'At the registrar: apex A record → 76.76.21.21, and www CNAME → cname.vercel-dns.com.'],
    ['Enter it here', 'Saving marks the site Live and stores the domain on the record.'],
  ];
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: D.panel, color: D.text, borderRadius: 3, border: `1px solid ${D.line}` } }}>
      <DialogTitle sx={{ borderBottom: `1px solid ${D.line}` }}>
        <T fontWeight={800} fontSize={17}>Connect a domain</T>
        <T variant="caption" sx={{ color: D.muted }}>{siteName} · they paid — let&apos;s make it theirs</T>
      </DialogTitle>
      <DialogContent sx={{ pt: '18px !important' }}>
        <Stack spacing={1.5}>
          {steps.map(([t, d], i) => (
            <Stack key={t} direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.2,
                bgcolor: D.greenDk, color: D.green, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                ...mono, fontSize: 11, fontWeight: 800,
              }}>{i + 1}</Box>
              <Box sx={{ minWidth: 0 }}>
                <T sx={{ fontWeight: 700, fontSize: 13.5, color: D.text }}>{t}</T>
                <T sx={{ fontSize: 12.5, color: D.muted }}>{d}</T>
              </Box>
            </Stack>
          ))}
          <TextField
            label="Domain" placeholder="northpineplumbing.com" value={domain}
            onChange={(e) => setDomain(e.target.value)} size="small" fullWidth sx={fieldSx}
            error={!!clean && !valid}
            helperText={clean && !valid ? 'Enter a bare domain, like northpineplumbing.com' : ' '}
          />
          <Alert severity="info" sx={{
            borderRadius: 2, bgcolor: 'rgba(96,165,250,0.08)', color: '#93c5fd',
            border: '1px solid rgba(96,165,250,0.25)', '& .MuiAlert-icon': { color: '#60a5fa' },
            fontSize: 12.5,
          }}>
            Once the domain is added in Vercel and DNS propagates, it serves the
            client&apos;s site automatically — the app recognizes the domain and
            renders their site instead of the Joint Printing pages. The preview
            link keeps working the whole time.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${D.line}`, px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none', color: D.muted, '&:hover': { color: D.text } }}>
          Cancel
        </Button>
        <Button
          onClick={() => onConnect(clean)} disabled={!valid || busy}
          variant="contained" sx={{ ...dropPrimaryBtn, px: 2.5 }}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: D.ink }} /> : null}
        >
          Mark live on {valid ? clean : 'domain'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generate-content dialog — the "write the whole site from a brief" moment
// ─────────────────────────────────────────────────────────────────────────────
// The owner pastes the client's email / notes / a description + services and
// the backend (shared Anthropic key) writes every copy field. It refuses to
// invent contact details, prices, or reviews — same honesty rule the JP
// Webworks marketing site follows — so the note sets that expectation.
function GenerateDialog({ open, onClose, onGenerate, busy }) {
  const [brief, setBrief] = React.useState('');
  const [tone, setTone] = React.useState('');
  // Reset per open so a second generate starts from a clean sheet.
  React.useEffect(() => { if (open) { setBrief(''); setTone(''); } }, [open]);
  const canGo = brief.trim().length > 0 && !busy;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: D.panel, color: D.text, borderRadius: 3, border: `1px solid ${D.line}` } }}>
      <DialogTitle sx={{ borderBottom: `1px solid ${D.line}` }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeIcon sx={{ fontSize: 18, color: D.green }} />
          <T fontWeight={800} fontSize={17}>Generate the site copy</T>
        </Stack>
        <T variant="caption" sx={{ color: D.muted }}>Paste what you know — the builder writes the words.</T>
      </DialogTitle>
      <DialogContent sx={{ pt: '18px !important' }}>
        <Stack spacing={1.75}>
          <TextField
            label="Tell me about the business"
            placeholder="Paste the client's email or notes, or just describe them: what they do, their services, what makes them good, hours, the area they serve. More detail = better copy."
            value={brief} onChange={(e) => setBrief(e.target.value)}
            multiline minRows={8} fullWidth sx={fieldSx} autoFocus disabled={busy}
          />
          <TextField
            select label="Tone (optional)" value={tone} onChange={(e) => setTone(e.target.value)}
            size="small" fullWidth sx={fieldSx} disabled={busy}
          >
            <MenuItem value="">Match the template</MenuItem>
            <MenuItem value="Friendly">Friendly</MenuItem>
            <MenuItem value="Professional">Professional</MenuItem>
            <MenuItem value="Bold">Bold</MenuItem>
          </TextField>
          <Alert severity="info" sx={{
            borderRadius: 2, bgcolor: 'rgba(96,165,250,0.08)', color: '#93c5fd',
            border: '1px solid rgba(96,165,250,0.25)', '& .MuiAlert-icon': { color: '#60a5fa' },
            fontSize: 12.5,
          }}>
            This writes the site&apos;s words from your brief. It won&apos;t invent phone numbers,
            prices, or reviews — you&apos;ll add those. Costs a few cents per generate.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${D.line}`, px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none', color: D.muted, '&:hover': { color: D.text } }}>
          Cancel
        </Button>
        <Button
          onClick={() => onGenerate({ brief: brief.trim(), tone })} disabled={!canGo}
          variant="contained" sx={{ ...dropPrimaryBtn, px: 3 }}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: D.ink }} /> : <AutoAwesomeIcon />}
        >
          {busy ? 'Writing the site…' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  New Site dialog — template picker → business type → name
// ─────────────────────────────────────────────────────────────────────────────
// `preselect` (a template id) seeds the picker — the landing's template
// gallery / chips open the dialog with their template already chosen, so
// focus jumps straight to the business-name field and the owner just types.
function NewSiteDialog({ open, onClose, onCreate, busy, preselect }) {
  const [tplId, setTplId] = React.useState(null);
  const [bizType, setBizType] = React.useState('');
  const [name, setName] = React.useState('');
  const tpl = getTemplate(tplId);
  const nameRef = React.useRef(null);

  // Reset per open so a second new-site starts clean (seeded from the gallery
  // pick, when there was one).
  React.useEffect(() => {
    if (open) { setTplId(preselect || null); setBizType(''); setName(''); }
  }, [open, preselect]);

  const canCreate = !!(tpl && bizType && name.trim());

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth
      // With a template pre-chosen the next thing to do is type the name —
      // put the caret there once the dialog finishes opening.
      TransitionProps={{ onEntered: () => { if (preselect && nameRef.current) nameRef.current.focus(); } }}
      PaperProps={{ sx: { bgcolor: D.panel, color: D.text, borderRadius: 3, border: `1px solid ${D.line}` } }}>
      <DialogTitle sx={{ borderBottom: `1px solid ${D.line}` }}>
        <T fontWeight={800} fontSize={17}>New client site</T>
        <T variant="caption" sx={{ color: D.muted }}>
          Pick the template that matches their trade — you can restyle everything after.
        </T>
      </DialogTitle>
      <DialogContent sx={{ pt: '18px !important' }}>
        <Box sx={{
          display: 'grid', gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}>
          {TEMPLATES.map((t) => {
            const active = t.id === tplId;
            return (
              <Paper key={t.id} elevation={0}
                onClick={() => { setTplId(t.id); setBizType(''); }}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTplId(t.id); setBizType(''); } }}
                sx={{
                  p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: D.inset,
                  border: `1px solid ${active ? D.lineHi : D.line}`,
                  outline: active ? `1px solid ${D.lineHi}` : 'none',
                  transition: 'border-color .15s, transform .15s',
                  '&:hover': { borderColor: D.lineHi, transform: 'translateY(-2px)' },
                  '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: 2 },
                }}>
                <TemplateThumb tpl={t} />
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.25 }}>
                  <T sx={{ fontWeight: 800, fontSize: 13.5, color: active ? D.green : D.text }}>{t.label}</T>
                  <Stack direction="row" spacing={0.75}>
                    {t.palettes.map((p) => <SwatchDots key={p.id} swatches={p.swatches.slice(0, 2)} size={10} />)}
                  </Stack>
                </Stack>
                <T sx={{ color: D.muted, fontSize: 11.5, mt: 0.5, lineHeight: 1.45 }}>{t.description}</T>
              </Paper>
            );
          })}
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
          <TextField
            select label="Business type" value={bizType} onChange={(e) => setBizType(e.target.value)}
            size="small" fullWidth sx={fieldSx} disabled={!tpl}
            helperText={!tpl ? 'Pick a template first' : ' '}
          >
            {(tpl?.businessTypes || []).map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
            <MenuItem value="Other">Other</MenuItem>
          </TextField>
          <TextField
            label="Business name" placeholder="Ironside Plumbing & Heating" value={name}
            onChange={(e) => setName(e.target.value)} size="small" fullWidth sx={fieldSx}
            helperText=" " inputRef={nameRef}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${D.line}`, px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none', color: D.muted, '&:hover': { color: D.text } }}>
          Cancel
        </Button>
        <Button
          onClick={() => onCreate({ name: name.trim(), businessType: bizType, template: tpl })}
          disabled={!canCreate || busy}
          variant="contained" sx={{ ...dropPrimaryBtn, px: 3 }}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: D.ink }} /> : <AddIcon />}
        >
          Create &amp; open editor
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main tab
// ─────────────────────────────────────────────────────────────────────────────
export default function JpwSitesTab({ token }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [sites, setSites] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState('');
  const [snack, setSnack] = React.useState(null); // { msg, severity }
  const flash = (msg, severity = 'success') => setSnack({ msg, severity });

  // Editor state. `draft` is the working copy of the site being edited —
  // the single source the form AND the live preview render from.
  const [draft, setDraft] = React.useState(null);
  const [saveState, setSaveState] = React.useState('idle'); // idle|dirty|saving|saved|error
  const [statusBusy, setStatusBusy] = React.useState(false);
  const [device, setDevice] = React.useState('desktop');    // preview viewport
  const [mobilePane, setMobilePane] = React.useState('form'); // xs-only: form|preview

  const [newOpen, setNewOpen] = React.useState(false);
  // Template id the New Site dialog opens pre-selected to (from a gallery
  // card / template chip); null = the plain "New site" button, owner picks.
  const [preselectTpl, setPreselectTpl] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [domainOpen, setDomainOpen] = React.useState(false);
  const [genOpen, setGenOpen] = React.useState(false);
  const [genBusy, setGenBusy] = React.useState(false);

  const openNew = (tplId = null) => { setPreselectTpl(tplId); setNewOpen(true); };

  // AI-copywriting budget snapshot (GET /api/jpw/ai-usage). Silent-fails so an
  // old backend just hides the little "$X of $Y used" line.
  const [aiBudget, setAiBudget] = React.useState(null);
  const loadAiBudget = React.useCallback(async () => {
    try {
      const { data } = await axios.get(AI_USAGE_API, authHdr);
      setAiBudget(data || null);
    } catch (_) { /* silent — the budget line just won't show */ }
  }, [authHdr]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const { data } = await axios.get(API, authHdr);
      setSites(data?.sites || []);
    } catch (e) {
      setLoadErr(e.response?.data?.message || 'Could not load sites — is the backend awake?');
    } finally {
      setLoading(false);
    }
  }, [authHdr]);
  React.useEffect(() => { load(); loadAiBudget(); }, [load, loadAiBudget]);

  // ── Autosave (600ms debounce, single-flight, edit-sequence tracked) ─────────
  // Three guarantees the naive debounce version lacked:
  //   1. ORDER — PUTs are chained (single-flight), so two in-flight saves can
  //      never land out of order server-side (old content overwriting new).
  //   2. NO GHOST RE-SENDS — the timer ref is cleared when the debounce fires,
  //      and dirtiness is tracked by edit/saved sequence numbers, so closing the
  //      editor doesn't re-PUT an already-saved draft.
  //   3. NO SILENT LOSS — closing WAITS for the final flush; if it fails, the
  //      editor stays open with the edits intact instead of discarding them.
  const saveTimer = React.useRef(null);
  const editSeq = React.useRef(0);                       // bumps on every edit
  const savedSeq = React.useRef(0);                      // highest seq persisted OK
  const inFlightRef = React.useRef(Promise.resolve(true)); // the single-flight chain

  const persist = React.useCallback((site, seq) => {
    setSaveState('saving');
    const run = inFlightRef.current.then(async () => {
      try {
        const { data } = await axios.put(`${API}/${site._id}`, { name: site.name, data: site.data }, authHdr);
        const updated = data?.site;
        if (updated) setSites((arr) => arr.map((s) => (s._id === site._id ? { ...s, ...updated } : s)));
        savedSeq.current = Math.max(savedSeq.current, seq);
        return true;
      } catch (e) {
        return false;
      }
    });
    inFlightRef.current = run;
    return run.then((ok) => {
      // Only the LATEST save drives the indicator — an older chained save
      // finishing must not flip "Saving…" to "Saved" under a newer edit.
      if (inFlightRef.current === run) setSaveState(ok ? 'saved' : 'error');
      return ok;
    });
  }, [authHdr]);

  const queueSave = React.useCallback((next) => {
    setDraft(next);
    setSaveState('dirty');
    editSeq.current += 1;
    const seq = editSeq.current;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null; // fired — no stale timer for flush to misread
      persist(next, seq);
    }, 600);
  }, [persist]);

  const hasUnsaved = () => editSeq.current > savedSeq.current;

  // Unmount-only flush (best-effort; an unmount can't await or stay open).
  const flushRef = React.useRef(null);
  flushRef.current = (site) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (site && hasUnsaved()) persist(site, editSeq.current);
  };
  const draftRef = React.useRef(null);
  draftRef.current = draft;
  React.useEffect(() => () => { if (flushRef.current) flushRef.current(draftRef.current); }, []);

  const openEditor = (site) => {
    setDraft(JSON.parse(JSON.stringify(site))); // detach from the list copy
    setSaveState('idle');
    editSeq.current = 0;
    savedSeq.current = 0;
    setMobilePane('form');
    setDevice('desktop');
  };
  const closeEditor = async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (draft && hasUnsaved()) {
      // Waiting on the flush is the whole point: a failed final save must keep
      // the editor (and the edits) alive, not silently drop the last keystrokes.
      const ok = await persist(draft, editSeq.current);
      if (!ok) {
        flash("Couldn't save your last edits — check your connection. They're still here.", 'error');
        return;
      }
    }
    setDraft(null);
    setSaveState('idle');
  };

  // Field helpers — name and data.businessName stay in lockstep (one concept
  // to the owner: "the business's name").
  const setData = (key, value) => queueSave({ ...draft, data: { ...draft.data, [key]: value } });
  const setBizName = (value) => queueSave({ ...draft, name: value, data: { ...draft.data, businessName: value } });

  // ── Status transitions (immediate PUT, not debounced) ──────────────────────
  const putStatus = async (patch, okMsg) => {
    setStatusBusy(true);
    try {
      const { data } = await axios.put(`${API}/${draft._id}`, patch, authHdr);
      const updated = data?.site || { ...draft, ...patch };
      setDraft((d) => ({ ...d, status: updated.status, domain: updated.domain, slug: updated.slug || d.slug }));
      setSites((arr) => arr.map((s) => (s._id === draft._id ? { ...s, ...updated } : s)));
      if (okMsg) flash(okMsg);
      return true;
    } catch (e) {
      flash(e.response?.data?.message || 'Could not update the site status', 'error');
      return false;
    } finally {
      setStatusBusy(false);
    }
  };

  const removeSite = async (site) => {
    if (!(await confirmDialog({ title: 'Delete site?', message: `Delete "${site.name}" permanently? The preview link stops working immediately.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await axios.delete(`${API}/${site._id}`, authHdr);
      setSites((arr) => arr.filter((s) => s._id !== site._id));
      flash('Site deleted');
    } catch (e) {
      flash(e.response?.data?.message || 'Could not delete the site', 'error');
    }
  };

  const createSite = async ({ name, businessType, template }) => {
    setCreating(true);
    try {
      const body = { name, businessType, templateId: template.id, data: seedData(name, template, businessType) };
      const { data } = await axios.post(API, body, authHdr);
      const site = data?.site;
      if (site) {
        setSites((arr) => [site, ...arr]);
        setNewOpen(false);
        openEditor(site);
        flash(`"${name}" created — it's a private draft until you publish the preview`);
      }
    } catch (e) {
      flash(e.response?.data?.message || 'Could not create the site', 'error');
    } finally {
      setCreating(false);
    }
  };

  // ── AI: write the whole site from a brief ───────────────────────────────────
  // POSTs the brief to the backend, then MERGES the returned copy into the live
  // draft — replacing the written copy fields but keeping the palette, photos,
  // and any contact/name the owner already set that the brief didn't supply
  // (those keys come back absent, so the spread preserves them). Normal autosave
  // then persists it, so the owner reviews before it publishes.
  const generateContent = async ({ brief, tone }) => {
    if (!draft) return;
    setGenBusy(true);
    try {
      const { data } = await axios.post(`${API}/${draft._id}/generate`, { brief, tone }, authHdr);
      const copy = data?.data || {};
      const needs = data?.meta?.needs || [];
      const cur = draft.data || {};
      const nextData = {
        ...cur,
        ...copy,                              // written copy fields replace the old ones
        businessName: cur.businessName || draft.name, // keep the owner's business name
        businessType: cur.businessType || draft.businessType || '', // keep the topical key
        paletteId: cur.paletteId,             // keep the chosen palette
        photos: cur.photos,                   // keep photo URLs (never AI-generated)
      };
      queueSave({ ...draft, data: nextData });
      setGenOpen(false);
      flash(`Site written — review and tweak, then publish.${needs.length ? ` Still add: ${needs.join(', ')}.` : ''}`);
      loadAiBudget();                          // refresh the "$X of $Y used" line after a spend
    } catch (e) {
      // Includes the budget-block message ("AI budget reached for this month…")
      // when the backend refuses — shown plainly, no spinner left hanging.
      flash(e.response?.data?.message || 'Could not write the site — try again.', 'error');
      loadAiBudget();                          // a block may mean level just flipped — resync
    } finally {
      setGenBusy(false);
    }
  };

  const copyLink = async (slug) => {
    const url = previewUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      flash('Preview link copied — send it to the prospect');
    } catch (_) {
      await promptDialog({ title: 'Copy the preview link', message: 'Select and copy this link:', defaultValue: url });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  //  Render: editor
  // ───────────────────────────────────────────────────────────────────────────
  if (draft) {
    const tpl = getTemplate(draft.templateId);
    const d = draft.data || {};
    // Photos are optional URL slots — empty keeps the template's curated
    // placeholder set, so the form always shows hero + 3 gallery inputs.
    const photos = d.photos && typeof d.photos === 'object' ? d.photos : {};
    const gallery = Array.isArray(photos.gallery) ? photos.gallery : [];
    const setPhotoHero = (v) =>
      setData('photos', { hero: v, gallery: [0, 1, 2].map((i) => gallery[i] || '') });
    const setPhotoGallery = (i, v) => {
      const g = [0, 1, 2].map((j) => gallery[j] || '');
      g[i] = v;
      setData('photos', { hero: photos.hero || '', gallery: g });
    };
    const isDraftStatus = draft.status === 'draft';
    const isPreview = draft.status === 'preview';
    const isLive = draft.status === 'live';

    const segBtn = (active) => ({
      textTransform: 'none', fontWeight: 700, fontSize: 12, px: 1.5, py: 0.4,
      borderRadius: 999, minWidth: 0,
      color: active ? D.ink : D.muted,
      bgcolor: active ? D.green : 'transparent',
      border: `1px solid ${active ? D.green : D.line}`,
      '&:hover': { bgcolor: active ? D.green : 'rgba(255,255,255,0.05)' },
    });

    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header: back · name · autosave state */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Button onClick={closeEditor} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
            sx={{ textTransform: 'none', color: D.muted, fontWeight: 600, minWidth: 'auto', px: 1, fontSize: 12,
              borderRadius: 999, '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>
            All sites
          </Button>
          <T sx={{ fontWeight: 800, fontSize: 15, color: D.text, minWidth: 0, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {draft.name || 'Untitled site'}
          </T>
          <SaveIndicator state={saveState} onRetry={() => persist(draft)} />
        </Stack>

        {/* Status bar — where the free-preview → paid-domain flow lives */}
        <Paper elevation={0} sx={{
          p: 1.5, mb: 2, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}`,
          display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap',
        }}>
          <StatusPill site={draft} />
          {(isPreview || isLive) && (
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{
              minWidth: 0, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 999,
              pl: 1.25, pr: 0.25, py: 0.1, border: `1px solid ${D.line}`,
            }}>
              <T sx={{ ...mono, fontSize: 11.5, color: D.muted, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: { xs: 150, sm: 260 } }}>
                /webworks/p/{draft.slug}
              </T>
              <Tooltip title="Copy public link">
                <IconButton size="small" onClick={() => copyLink(draft.slug)}
                  sx={{ color: D.muted, '&:hover': { color: D.green } }}>
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open preview">
                <IconButton size="small" component="a" href={previewUrl(draft.slug)} target="_blank" rel="noopener noreferrer"
                  sx={{ color: D.muted, '&:hover': { color: D.green } }}>
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
          <Box sx={{ flex: 1 }} />
          {isDraftStatus && (
            <Button size="small" variant="contained" disabled={statusBusy}
              onClick={() => putStatus({ status: 'preview' }, 'Preview is live — copy the link and send it')}
              sx={{ ...dropPrimaryBtn, fontSize: 12.5, px: 2, py: 0.6 }}>
              Publish preview
            </Button>
          )}
          {isPreview && (
            <>
              <Button size="small" disabled={statusBusy}
                onClick={() => putStatus({ status: 'draft' }, 'Back to draft — the public link now 404s')}
                sx={{ ...dropGhostBtn, fontSize: 12, px: 1.75, py: 0.5 }}>
                Back to draft
              </Button>
              <Button size="small" variant="contained" disabled={statusBusy}
                onClick={() => setDomainOpen(true)}
                sx={{ ...dropPrimaryBtn, fontSize: 12.5, px: 2, py: 0.6 }}>
                Connect domain…
              </Button>
            </>
          )}
          {isLive && (
            <Button size="small" disabled={statusBusy}
              onClick={() => putStatus({ status: 'preview' }, 'Back to preview')}
              sx={{ ...dropGhostBtn, fontSize: 12, px: 1.75, py: 0.5 }}>
              Back to preview
            </Button>
          )}
        </Paper>
        {isLive && (
          <T sx={{ color: D.faint, fontSize: 11.5, mt: -1, mb: 2 }}>
            Live on {draft.domain} — the app serves their site on that domain
            automatically once it&apos;s added in Vercel (Settings → Domains) and
            DNS points here.
          </T>
        )}

        {/* xs-only pane toggle */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, display: { xs: 'flex', md: 'none' } }}>
          <Button onClick={() => setMobilePane('form')} sx={segBtn(mobilePane === 'form')}>Edit</Button>
          <Button onClick={() => setMobilePane('preview')} sx={segBtn(mobilePane === 'preview')}>Preview</Button>
        </Stack>

        <Box sx={{
          display: 'grid', gap: 2.5, alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 6fr) minmax(0, 7fr)' },
        }}>
          {/* ── Form ── */}
          <Stack spacing={3} sx={{ display: { xs: mobilePane === 'form' ? 'flex' : 'none', md: 'flex' }, minWidth: 0 }}>
            {/* The first thing you'd do on a new site: paste the client's info
                and let the builder write every field. */}
            <Box>
              <Button
                fullWidth variant="contained" startIcon={<AutoAwesomeIcon />}
                onClick={() => setGenOpen(true)}
                sx={{ ...dropPrimaryBtn, py: 1.1, fontSize: 14 }}
              >
                Generate content
              </Button>
              <T sx={{ color: D.faint, fontSize: 11.5, mt: 0.75, textAlign: 'center' }}>
                Paste the client&apos;s email or notes and the AI writes the whole site — then you tweak it.
              </T>
              {aiBudget && aiBudget.configured && aiBudget.budgetUsd > 0 && (
                <T sx={{
                  mt: 0.4, textAlign: 'center', fontSize: 11,
                  fontWeight: aiBudget.level === 'ok' ? 400 : 700,
                  color: aiBudget.level === 'blocked' ? '#f87171'
                    : aiBudget.level === 'warn' ? D.amber : D.faint,
                }}>
                  {aiBudget.level === 'blocked'
                    ? `AI paused — $${(Number(aiBudget.estCostUsd) || 0).toFixed(2)} of $${aiBudget.budgetUsd} monthly AI budget used`
                    : `~$${(Number(aiBudget.estCostUsd) || 0).toFixed(2)} of $${aiBudget.budgetUsd} AI budget used this month`}
                </T>
              )}
            </Box>

            <Section title="Basics">
              <F label="Business name" value={draft.name} onChange={setBizName} />
              <F label="Tagline" value={d.tagline} onChange={(v) => setData('tagline', v)}
                placeholder="Honest plumbing, done right the first time" />
              <F label="Hero headline" value={d.heroHeadline} onChange={(v) => setData('heroHeadline', v)}
                placeholder="Falls back to the tagline, then the name" />
              <F label="Call-to-action label" value={d.ctaLabel} onChange={(v) => setData('ctaLabel', v)}
                placeholder='e.g. "Call for a free estimate"' />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <F label="Established (year)" value={d.established} onChange={(v) => setData('established', v)} placeholder="2012" />
                <F label="License / credentials" value={d.license} onChange={(v) => setData('license', v)} placeholder="NJ Lic. #12345" />
              </Stack>
            </Section>

            <Section title="Contact">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <F label="Phone" value={d.phone} onChange={(v) => setData('phone', v)} placeholder="(609) 555-0143" />
                <F label="Email" value={d.email} onChange={(v) => setData('email', v)} placeholder="office@…" />
              </Stack>
              <F label="Service area" value={d.serviceArea} onChange={(v) => setData('serviceArea', v)}
                placeholder="Burlington County & surrounding towns" />
              <F label="Address" value={d.address} onChange={(v) => setData('address', v)}
                placeholder="12 Main St, Mount Holly, NJ" />
            </Section>

            <Section title="Hours">
              <RowsEditor
                rows={d.hours} onChange={(v) => setData('hours', v)}
                blank={{ days: '', hours: '' }} addLabel="Add hours row"
                fields={[
                  { key: 'days', label: 'Days', placeholder: 'Mon – Fri' },
                  { key: 'hours', label: 'Hours', placeholder: '9:00 AM – 5:00 PM' },
                ]}
              />
            </Section>

            <Section title="Services" hint="These become the services grid / menu. Price is free text — “$95”, “from $120”, or blank.">
              <RowsEditor
                rows={d.services} onChange={(v) => setData('services', v)}
                blank={{ name: '', desc: '', price: '' }} addLabel="Add service"
                fields={[
                  { key: 'name', label: 'Service', placeholder: 'Drain cleaning' },
                  { key: 'price', label: 'Price', narrow: true, placeholder: 'from $95' },
                  { key: 'desc', label: 'Short description', wide: true, minRows: 2 },
                ]}
              />
            </Section>

            <Section title="About">
              <F label="About the business" value={d.about} onChange={(v) => setData('about', v)}
                multiline minRows={5} placeholder="Two or three honest paragraphs. Blank lines become paragraph breaks." />
            </Section>

            <Section title="Testimonials">
              <RowsEditor
                rows={d.testimonials} onChange={(v) => setData('testimonials', v)}
                blank={{ quote: '', name: '' }} addLabel="Add testimonial"
                fields={[
                  { key: 'name', label: 'Who said it', placeholder: 'Maria G.' },
                  { key: 'quote', label: 'Quote', wide: true, minRows: 2 },
                ]}
              />
            </Section>

            <Section title="Photos" hint="Paste image links — leave empty to keep the template's placeholder photos.">
              <F label="Hero photo URL" value={photos.hero} onChange={setPhotoHero}
                placeholder="https://…/storefront.jpg" />
              {[0, 1, 2].map((i) => (
                <F key={i} label={`Gallery photo ${i + 1} URL`} value={gallery[i]}
                  onChange={(v) => setPhotoGallery(i, v)} placeholder="https://…" />
              ))}
            </Section>

            <Section title="Style" hint={`${tpl ? tpl.label : 'Template'} palettes — the whole site recolors instantly.`}>
              <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                {(tpl?.palettes || []).map((p) => {
                  const active = (d.paletteId || tpl.palettes[0].id) === p.id;
                  return (
                    <Box key={p.id} onClick={() => setData('paletteId', p.id)}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setData('paletteId', p.id); } }}
                      sx={{
                        px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer', bgcolor: D.inset,
                        border: `1px solid ${active ? D.lineHi : D.line}`,
                        display: 'flex', alignItems: 'center', gap: 1,
                        transition: 'border-color .15s',
                        '&:hover': { borderColor: D.lineHi },
                        '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: 2 },
                      }}>
                      <SwatchDots swatches={p.swatches} />
                      <T sx={{ fontSize: 12, fontWeight: 700, color: active ? D.green : D.muted }}>{p.label}</T>
                    </Box>
                  );
                })}
              </Stack>
            </Section>
          </Stack>

          {/* ── Live preview ── */}
          <Box sx={{
            display: { xs: mobilePane === 'preview' ? 'block' : 'none', md: 'block' },
            position: { md: 'sticky' }, top: { md: 12 }, minWidth: 0,
          }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <T sx={{ ...eyebrow, fontSize: 10.5, letterSpacing: 1.8 }}>Live preview</T>
              <Box sx={{ flex: 1 }} />
              <Button onClick={() => setDevice('desktop')} sx={segBtn(device === 'desktop')}>Desktop</Button>
              <Button onClick={() => setDevice('phone')} sx={segBtn(device === 'phone')}>Phone</Button>
            </Stack>
            <ScaledPreview templateId={draft.templateId} data={d} device={device} />
            <T sx={{ color: D.faint, fontSize: 11, mt: 0.75, display: 'block' }}>
              Exactly what the prospect sees at the public link — scroll inside the frame.
            </T>
          </Box>
        </Box>

        <ConnectDomainDialog
          open={domainOpen} onClose={() => setDomainOpen(false)} busy={statusBusy} siteName={draft.name}
          onConnect={async (domain) => {
            const ok = await putStatus({ status: 'live', domain }, `Live — ${domain} recorded`);
            if (ok) setDomainOpen(false);
          }}
        />

        <GenerateDialog
          open={genOpen} onClose={() => setGenOpen(false)} busy={genBusy}
          onGenerate={generateContent}
        />

        <Snackbar open={!!snack} autoHideDuration={4500} onClose={() => setSnack(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snack?.severity || 'success'} variant="filled" onClose={() => setSnack(null)}>
            {snack?.msg}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Render: site list / template-forward landing
  // ───────────────────────────────────────────────────────────────────────────
  // With sites: the list + ONE "New site" button in the header, and a slim
  // template-chip row under the list. Empty: NO header button — the landing IS
  // the template gallery (rich cards from the same registry the dialog picker
  // uses), so the first screen answers "what can this thing make?" and one
  // click starts a site with that template pre-selected.
  const hasSites = !loading && !loadErr && sites.length > 0;
  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      {hasSites && (
        <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 2.5 }}>
          <T variant="body2" sx={{ color: D.muted, flex: 1 }}>
            Build a client&apos;s site as a free preview, send them the public link,
            and connect their real domain once they subscribe.
          </T>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openNew()}
            sx={{ ...dropPrimaryBtn, px: 2.25, py: 0.9, fontSize: 13.5, flexShrink: 0 }}>
            New site
          </Button>
        </Stack>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <JpLoader size={56} label="Loading sites…" />
        </Box>
      ) : loadErr ? (
        <Box py={6} textAlign="center">
          <T sx={{ color: D.muted, mb: 2 }}>{loadErr}</T>
          <Button onClick={load} sx={{ ...dropGhostBtn, px: 2.5 }}>Try again</Button>
        </Box>
      ) : sites.length === 0 ? (
        <Fade in>
          <Box>
            {/* The whole business model in one line, then straight into the
                templates — no dead "empty" screen, no duplicate buttons. */}
            <Paper elevation={0} sx={{
              p: { xs: 1.75, sm: 2 }, mb: 3, borderRadius: 2.5,
              bgcolor: D.inset, border: `1px solid ${D.line}`,
              display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
            }}>
              <Box sx={{
                width: 38, height: 38, borderRadius: 2, flexShrink: 0,
                bgcolor: D.greenDk, color: D.green,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <LanguageOutlinedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <T sx={{ fontWeight: 800, fontSize: 14.5, color: D.text, lineHeight: 1.35 }}>
                  Build it free → text them the preview link → connect their
                  domain the day they subscribe.
                </T>
                <T sx={{ color: D.muted, fontSize: 12, mt: 0.25 }}>
                  Pick a template below — the first site takes about ten minutes.
                </T>
              </Box>
            </Paper>

            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.5 }}>
              <T sx={{ ...eyebrow, fontSize: 10.5, letterSpacing: 1.8 }}>Start from a template</T>
              <Box sx={{ flex: 1, height: 1, bgcolor: D.line, alignSelf: 'center' }} />
            </Stack>

            <Box sx={{
              display: 'grid', gap: 1.75,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            }}>
              {TEMPLATES.map((t, i) => (
                <TemplateGalleryCard key={t.id} tpl={t} onPick={openNew}
                  delay={Math.min(250 + i * 80, 650)} />
              ))}
            </Box>
          </Box>
        </Fade>
      ) : (
        <Box>
        <Stack spacing={1.2}>
          {sites.map((s, idx) => {
            const tpl = getTemplate(s.templateId);
            const meta = siteStatus(s.status);
            return (
              <Grow in timeout={Math.min(180 + idx * 50, 600)} key={s._id}>
                <Paper
                  onClick={() => openEditor(s)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(s); } }}
                  sx={{
                    p: 2, borderRadius: 2, cursor: 'pointer',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid', borderColor: 'rgba(255,255,255,0.06)',
                    transition: 'all 0.18s ease-out', position: 'relative', overflow: 'hidden',
                    '&:hover': {
                      borderColor: D.green, bgcolor: 'rgba(74,222,128,0.04)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px -12px rgba(74,222,128,0.4)',
                    },
                    '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: 2 },
                    '&::before': {
                      content: '""', position: 'absolute',
                      left: 0, top: 0, bottom: 0, width: 3, bgcolor: meta.color,
                    },
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
                    <Box sx={{ flexGrow: 1, minWidth: 0, pl: 0.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={0.4} flexWrap="wrap" useFlexGap>
                        <T fontWeight={700} fontSize={15} sx={{ color: D.text }}>{s.name || '(unnamed)'}</T>
                        <StatusPill site={s} />
                      </Stack>
                      <T variant="body2" sx={{ color: D.muted, ...mono, fontSize: 12.5,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(tpl?.label || s.templateId)} · {s.businessType || '—'} · updated {fmtRelative(s.updatedAt) || 'just now'}
                      </T>
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
                      {(s.status === 'preview' || s.status === 'live') && (
                        <>
                          <Tooltip title="Copy public link">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); copyLink(s.slug); }}
                              sx={{ color: D.muted, '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}>
                              <ContentCopyIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Open preview">
                            <IconButton size="small" component="a" href={previewUrl(s.slug)} target="_blank"
                              rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              sx={{ color: D.muted, '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}>
                              <OpenInNewIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip title="Delete site">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeSite(s); }}
                          sx={{ color: D.faint, '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}>
                          <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              </Grow>
            );
          })}
        </Stack>

        {/* Slim template launcher under the list — the gallery's click-through
            (dialog opens pre-selected) at chip size, so starting the next site
            from a look is one tap even after the empty state is gone. */}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 3 }}>
          <T sx={{ ...eyebrow, fontSize: 10, letterSpacing: 1.6, color: D.faint }}>
            Start from a template
          </T>
          {TEMPLATES.map((t) => (
            <Box key={t.id} onClick={() => openNew(t.id)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNew(t.id); } }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.25, py: 0.5, borderRadius: 999, cursor: 'pointer',
                bgcolor: D.inset, border: `1px solid ${D.line}`,
                transition: 'border-color .15s ease',
                '&:hover': { borderColor: D.lineHi },
                '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: 2 },
              }}>
              <SwatchDots swatches={t.palettes[0].swatches} size={9} />
              <T sx={{ fontSize: 12, fontWeight: 700, color: D.muted }}>{t.label}</T>
            </Box>
          ))}
        </Stack>
        </Box>
      )}

      <NewSiteDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={createSite}
        busy={creating} preselect={preselectTpl} />

      <Snackbar open={!!snack} autoHideDuration={4500} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'success'} variant="filled" onClose={() => setSnack(null)}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
