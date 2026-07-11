// src/screens/LookbookView.js
// Public, token-gated lookbook gallery — the link a client opens when the owner
// shares a curated set of mockups from the Studio's Lookbooks builder (backend:
// /api/public/lookbooks). Reactions, comments and "request pricing" land back on
// the lookbook record and surface in the builder's feedback panel.
//
// This is a real, client-shareable MARKETING piece — not a dashboard. The
// viewer gets a lot of control over how it looks, so they can show it around
// their own team / use it for their own marketing:
//   • Theme        — paper / charcoal / forest / sand palettes (persisted).
//   • Layout       — showcase (one big per row) / grid / story (alternating).
//   • Clean bg     — knock the white studio backdrop out so garments float on
//                    the theme (canvas transparency where CORS allows, else a
//                    `multiply` blend on a light stage — always looks clean).
//   • Download PDF — the same polished deck, token-gated, in whatever cut they
//                    picked (backend reuses the Studio's PDF generator).
// Owner-set defaults (theme/knockout/layout) ride in on the payload; the
// viewer's live overrides are theirs alone (localStorage), never written back.

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Stack, Typography, Button, TextField, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ViewCarouselOutlinedIcon from '@mui/icons-material/ViewCarouselOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import axios from 'axios';
import config from '../config.json';
import JpLoader from '../common/JpLoader';

// ── Theme registry — each palette is self-contained. `stage` is ALWAYS light so
// the `multiply` knockout fallback stays clean even on the dark themes (the
// garment sits on a gallery-mat tile). `accent` drives actions + the up-vote. ──
const THEMES = {
  paper: {
    id: 'paper', name: 'Paper', isDark: false,
    bg: '#faf9f6', panel: '#ffffff', stage: '#f3f1ea', line: 'rgba(15,26,19,0.10)',
    text: '#111a14', muted: 'rgba(17,26,20,0.62)', faint: 'rgba(17,26,20,0.42)',
    accent: '#15803d', accentText: '#ffffff', accentSoft: 'rgba(21,128,61,0.09)',
    amber: '#b45309', amberSoft: 'rgba(180,83,9,0.09)',
    shadow: '0 10px 34px rgba(15,26,19,0.07)',
  },
  ink: {
    id: 'ink', name: 'Charcoal', isDark: true,
    bg: '#14171a', panel: '#1c2126', stage: '#f3f1ea', line: 'rgba(255,255,255,0.11)',
    text: '#eef2ee', muted: 'rgba(238,242,238,0.66)', faint: 'rgba(238,242,238,0.40)',
    accent: '#34d17f', accentText: '#052012', accentSoft: 'rgba(52,209,127,0.14)',
    amber: '#f0b429', amberSoft: 'rgba(240,180,41,0.14)',
    shadow: '0 16px 44px rgba(0,0,0,0.46)',
  },
  forest: {
    id: 'forest', name: 'Forest', isDark: true,
    bg: '#0e1a13', panel: '#15271c', stage: '#eef1e9', line: 'rgba(180,220,190,0.15)',
    text: '#eaf2ec', muted: 'rgba(206,214,208,0.82)', faint: 'rgba(150,162,153,0.85)',
    accent: '#7fcf9e', accentText: '#05130b', accentSoft: 'rgba(127,207,158,0.15)',
    amber: '#e9b872', amberSoft: 'rgba(233,184,114,0.15)',
    shadow: '0 16px 44px rgba(0,0,0,0.5)',
  },
  sand: {
    id: 'sand', name: 'Sand', isDark: false,
    bg: '#efe9dd', panel: '#fbf8f2', stage: '#e6ded0', line: 'rgba(60,45,25,0.13)',
    text: '#2b2416', muted: 'rgba(43,36,22,0.62)', faint: 'rgba(43,36,22,0.42)',
    accent: '#9a5726', accentText: '#ffffff', accentSoft: 'rgba(154,87,38,0.10)',
    amber: '#9a5726', amberSoft: 'rgba(154,87,38,0.10)',
    shadow: '0 10px 30px rgba(60,45,25,0.12)',
  },
};
const THEME_ORDER = ['paper', 'ink', 'forest', 'sand'];

// Map the owner's stored PDF layout vocabulary → the viewer's initial layout.
const LAYOUT_FROM_STORED = { auto: 'stack', editorial: 'stack', grid: 'grid' };
// … and back, for the client's own PDF download (story reads best as editorial).
const STORED_FROM_LAYOUT = { stack: 'editorial', grid: 'grid', story: 'editorial' };
const LAYOUTS = [
  { id: 'stack', label: 'Showcase', Icon: ViewAgendaOutlinedIcon },
  { id: 'grid',  label: 'Grid',     Icon: GridViewOutlinedIcon },
  { id: 'story', label: 'Story',    Icon: ViewCarouselOutlinedIcon },
];

const mono = { fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };
const NAME_KEY = 'jp-lb-name';
const THEME_KEY = 'jp-lb-theme';
const CLEAN_KEY = 'jp-lb-clean';
const LSAFE = (fn) => { try { return fn(); } catch (_) { return undefined; } };

// Knock the white studio backdrop out of a mockup in the browser: near-white
// pixels → transparent, so the garment floats on any theme. Needs a readable
// (un-tainted) canvas — base64 payloads are same-origin, R2 URLs work when the
// bucket sends CORS. On a taint / load error it resolves null and the caller
// falls back to a `multiply` blend on a light stage. Never throws.
function knockoutWhite(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { resolve(null); return; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, w, h);   // throws if the canvas is tainted
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] >= 240 && d[i + 1] >= 240 && d[i + 2] >= 240) d[i + 3] = 0;
        }
        ctx.putImageData(id, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (_) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// One mockup face (front or back). `clean` on → try transparency, else multiply
// on a light stage. `clean` off → framed on the theme card (the classic look).
function ProductImage({ src, alt, clean, theme, radius = 3 }) {
  const [ko, setKo] = useState(null);
  useEffect(() => {
    let alive = true;
    setKo(null);
    if (!clean || !src) return undefined;
    knockoutWhite(src).then((url) => { if (alive) setKo(url); });
    return () => { alive = false; };
  }, [src, clean]);

  if (!src) return null;

  if (!clean) {
    return (
      <Box sx={{ bgcolor: theme.panel, border: `1px solid ${theme.line}`, borderRadius: radius,
        boxShadow: theme.shadow, overflow: 'hidden' }}>
        <Box component="img" src={src} alt={alt} loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          sx={{ width: '100%', display: 'block' }} />
      </Box>
    );
  }
  const usingKO = !!ko;
  // While the knockout is resolving (tried=false) show the raw image on the
  // light stage with multiply — it already looks clean, no flash of framed art.
  return (
    <Box sx={{ bgcolor: usingKO ? 'transparent' : theme.stage, borderRadius: radius,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      p: usingKO ? { xs: 1, sm: 2 } : { xs: 2, sm: 3.5 }, transition: 'background-color 200ms ease' }}>
      <Box component="img" src={ko || src} alt={alt} loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        sx={{ width: '100%', display: 'block',
          mixBlendMode: usingKO ? 'normal' : 'multiply',
          filter: usingKO ? 'drop-shadow(0 18px 30px rgba(0,0,0,0.20))' : 'none' }} />
    </Box>
  );
}

// Front (+ optional back) for one mockup. `dense` shrinks the back to a small
// secondary (grid/story); otherwise front & back share a row (showcase).
function MockupFaces({ m, clean, theme, showBack, dense }) {
  const back = showBack && !!m.back;
  if (!back) return <ProductImage src={m.front} alt={m.name || 'Mockup'} clean={clean} theme={theme} />;
  if (dense) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 1, alignItems: 'center' }}>
        <ProductImage src={m.front} alt={m.name || 'Mockup'} clean={clean} theme={theme} />
        <ProductImage src={m.back} alt={`${m.name || 'Mockup'} — back`} clean={clean} theme={theme} radius={2} />
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <ProductImage src={m.front} alt={m.name || 'Mockup'} clean={clean} theme={theme} />
      <ProductImage src={m.back} alt={`${m.name || 'Mockup'} — back`} clean={clean} theme={theme} />
    </Box>
  );
}

function ago(d) {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ReactBtn({ up, active, count, disabled, onClick, theme }) {
  const Icon = up ? ThumbUpAltOutlinedIcon : ThumbDownAltOutlinedIcon;
  const tone = up ? theme.accent : theme.amber;
  const soft = up ? theme.accentSoft : theme.amberSoft;
  return (
    <Button onClick={onClick} disabled={disabled} aria-pressed={active}
      sx={{
        minWidth: 0, px: 2, py: 0.8, borderRadius: 999, textTransform: 'none',
        display: 'inline-flex', gap: 0.75, fontWeight: 700, fontSize: 13,
        color: active ? tone : theme.muted,
        border: `1.5px solid ${active ? tone : theme.line}`,
        bgcolor: active ? soft : theme.panel,
        transition: 'all 160ms ease',
        '&:hover': { borderColor: tone, color: tone, bgcolor: soft },
      }}>
      <Icon sx={{ fontSize: 18 }} />
      {up ? 'Love it' : 'Not this one'}
      {count > 0 && <Box component="span" sx={{ ...mono, fontSize: 12, color: active ? tone : theme.faint }}>{count}</Box>}
    </Button>
  );
}

function CommentBlock({ comments, draft, onDraft, onSend, busy, placeholder, theme }) {
  const canSend = !!draft.trim() && !busy;
  const field = {
    '& .MuiOutlinedInput-root': {
      bgcolor: theme.panel, color: theme.text, borderRadius: 2.5, fontSize: 14,
      '& fieldset': { borderColor: theme.line },
      '&:hover fieldset': { borderColor: theme.faint },
      '&.Mui-focused fieldset': { borderColor: theme.accent },
    },
    '& .MuiInputBase-input::placeholder': { color: theme.faint, opacity: 1 },
  };
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      {comments.length > 0 && (
        <Stack spacing={1} sx={{ mt: 2.5, textAlign: 'left' }}>
          {comments.map((f, i) => (
            <Box key={i} sx={{ bgcolor: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 2.5, px: 1.75, py: 1.25 }}>
              <Stack direction="row" alignItems="baseline" gap={1}>
                <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: theme.text }}>{f.by || 'Someone'}</Typography>
                <Typography sx={{ color: theme.faint, fontSize: 11 }}>{ago(f.at)}</Typography>
              </Stack>
              <Typography sx={{ color: theme.muted, fontSize: 13.5, mt: 0.4, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {f.comment}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
      <Stack direction="row" gap={1} alignItems="flex-start" sx={{ mt: 2 }}>
        <TextField
          value={draft} onChange={(e) => onDraft(e.target.value)}
          placeholder={placeholder} size="small" fullWidth multiline maxRows={4} sx={field}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && canSend) { e.preventDefault(); onSend(); } }}
        />
        <Button onClick={onSend} disabled={!canSend}
          sx={{
            px: 2.25, py: 0.9, borderRadius: 999, textTransform: 'none', flexShrink: 0,
            fontWeight: 800, fontSize: 13, bgcolor: theme.accent, color: theme.accentText,
            '&:hover': { bgcolor: theme.accent, filter: 'brightness(0.94)' },
            '&.Mui-disabled': { bgcolor: theme.accentSoft, color: theme.faint },
          }}>
          {busy ? <CircularProgress size={16} sx={{ color: theme.accentText }} /> : 'Send'}
        </Button>
      </Stack>
    </Box>
  );
}

export default function LookbookView() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  const q = `token=${encodeURIComponent(token || '')}`;

  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [errKind, setErrKind] = useState('');   // '' | 'invalid' | 'expired'
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(() => LSAFE(() => window.localStorage.getItem(NAME_KEY)) || '');
  const [needName, setNeedName] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState('');
  const [expanded, setExpanded] = useState({});   // grid-mode per-mockup "notes" disclosure

  // Presentation controls — seeded from the owner's defaults on load, then the
  // viewer owns them (URL ?theme= wins first paint; localStorage persists).
  const [themeId, setThemeId] = useState(() =>
    (params.get('theme') && THEMES[params.get('theme')] ? params.get('theme') : null)
    || (LSAFE(() => window.localStorage.getItem(THEME_KEY)) || null));
  const [clean, setClean] = useState(() => {
    const v = LSAFE(() => window.localStorage.getItem(CLEAN_KEY));
    return v === null || v === undefined ? null : v === '1';
  });
  const [layout, setLayout] = useState('stack');
  const [pdfBusy, setPdfBusy] = useState(false);

  // Request-pricing state.
  const [rpOpen, setRpOpen] = useState(false);
  const [rpSel, setRpSel] = useState({});
  const [rpMeta, setRpMeta] = useState({ email: '', phone: '', shipTo: '', note: '' });
  const [rpBusy, setRpBusy] = useState(false);
  const [rpDone, setRpDone] = useState(false);
  const [rpErr, setRpErr] = useState('');
  const nameBoxRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) { setErr('This link is missing its token.'); setErrKind('invalid'); setLoading(false); return; }
      try {
        const r = await axios.get(`${config.backendUrl}/api/public/lookbooks/${id}?${q}`);
        if (cancelled) return;
        setData(r.data);
        // Adopt owner defaults only where the viewer hasn't chosen for themselves.
        setThemeId((cur) => cur || (THEMES[r.data.theme] ? r.data.theme : 'paper'));
        setClean((cur) => (cur === null ? !!r.data.knockout : cur));
        setLayout(LAYOUT_FROM_STORED[r.data.layout] || 'stack');
      } catch (e) {
        if (cancelled) return;
        setErr(e.response?.data?.message || '');
        setErrKind(e.response?.status === 410 ? 'expired' : 'invalid');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, token, q]);

  useEffect(() => { if (data?.title) document.title = `${data.title} | Joint Printing`; }, [data]);

  const theme = THEMES[themeId] || THEMES.paper;
  const isClean = !!clean;
  // Shared text-field styling for the pricing dialog, themed.
  const rpField = {
    '& .MuiOutlinedInput-root': {
      bgcolor: theme.panel, color: theme.text, borderRadius: 2.5, fontSize: 14,
      '& fieldset': { borderColor: theme.line },
      '&:hover fieldset': { borderColor: theme.faint },
      '&.Mui-focused fieldset': { borderColor: theme.accent },
    },
    '& .MuiInputBase-input::placeholder': { color: theme.faint, opacity: 1 },
  };

  const pickTheme = (t) => { setThemeId(t); LSAFE(() => window.localStorage.setItem(THEME_KEY, t)); };
  const toggleClean = () => setClean((c) => { const nv = !c; LSAFE(() => window.localStorage.setItem(CLEAN_KEY, nv ? '1' : '0')); return nv; });

  const refresh = async () => {
    try { const r = await axios.get(`${config.backendUrl}/api/public/lookbooks/${id}?${q}`); setData(r.data); }
    catch (_) { /* keep what's on screen */ }
  };

  const saveName = (v) => {
    setName(v);
    if (v.trim()) setNeedName(false);
    LSAFE(() => window.localStorage.setItem(NAME_KEY, v));
  };
  const requireName = () => {
    if (name.trim()) return true;
    setNeedName(true);
    LSAFE(() => nameBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    setTimeout(() => LSAFE(() => nameInputRef.current?.focus()), 350);
    return false;
  };

  const post = async (mockupRemoteId, { reaction = '', comment = '' }) => {
    if (!requireName()) return;
    const key = mockupRemoteId || 'overall';
    setBusyKey(key);
    try {
      const r = await axios.post(`${config.backendUrl}/api/public/lookbooks/${id}/feedback?${q}`,
        { mockupRemoteId, reaction, comment: comment.trim(), by: name.trim() });
      if (comment) setDrafts((d) => ({ ...d, [mockupRemoteId]: '' }));
      if (Array.isArray(r.data?.feedback)) setData((prev) => (prev ? { ...prev, feedback: r.data.feedback } : prev));
      else await refresh();
    } catch (e) {
      alert(e.response?.data?.message || "That didn't send — please try again in a moment.");
    } finally { setBusyKey(''); }
  };

  const downloadPdf = () => {
    if (!token) return;
    setPdfBusy(true);
    const url = `${config.backendUrl}/api/public/lookbooks/${id}/pdf?${q}`
      + `&layout=${encodeURIComponent(STORED_FROM_LAYOUT[layout] || 'editorial')}`
      + `&knockout=${isClean ? 'true' : 'false'}`;
    // Attachment disposition → the browser saves it; a hidden anchor keeps the
    // gallery in place (window.location would navigate away from the link).
    const a = document.createElement('a');
    a.href = url; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => setPdfBusy(false), 1600);
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <JpLoader size={72} label="Loading…" tone={theme.isDark ? 'dark' : 'light'} />
      </Box>
    );
  }
  if (err || errKind || !data) {
    const expired = errKind === 'expired';
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ bgcolor: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 3, boxShadow: theme.shadow, p: 4, maxWidth: 460, textAlign: 'center' }}>
          <Typography sx={{ color: expired ? theme.amber : theme.text, fontWeight: 800, fontSize: 19, mb: 1 }}>
            {expired ? 'This link has expired' : "This lookbook link isn't valid"}
          </Typography>
          <Typography sx={{ color: theme.muted, fontSize: 13.5, lineHeight: 1.6 }}>
            {expired
              ? 'Ask Joint Printing for a fresh one — we’ll send it right over.'
              : (err || 'Double-check the link, or ask Joint Printing to send it again.')}
          </Typography>
        </Box>
      </Box>
    );
  }

  const mockups = data.mockups || [];
  const feedback = data.feedback || [];
  const me = name.trim();
  const showLabels = data.showLabels !== false;
  const showBack = data.showBack !== false;

  const latestByPerson = (rid) => {
    const m = new Map();
    feedback.forEach((f) => {
      if ((f.mockupRemoteId || '') !== rid || !f.reaction) return;
      const cur = m.get(f.by || '');
      if (!cur || new Date(f.at) - new Date(cur.at) >= 0) m.set(f.by || '', f);
    });
    return m;
  };
  const commentsFor = (rid) => feedback
    .filter((f) => (f.mockupRemoteId || '') === rid && f.comment)
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  const openPricing = () => {
    if (!me) { setNeedName(true); nameBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); nameInputRef.current?.focus(); return; }
    setRpDone(false);
    setRpSel((prev) => {
      if (Object.keys(prev).length) return prev;
      const next = {};
      mockups.forEach((m) => {
        const mine = latestByPerson(m.remoteId || '').get(me);
        if (mine && mine.reaction === 'up') next[m.remoteId] = '50';
      });
      return next;
    });
    setRpErr(''); setRpOpen(true);
  };
  const toggleRp = (rid) => setRpSel((prev) => {
    const next = { ...prev };
    if (next[rid] !== undefined) delete next[rid]; else next[rid] = '50';
    return next;
  });
  const submitPricing = async () => {
    const picks = Object.entries(rpSel).map(([remoteId, qty]) => ({ remoteId, qty: Number(qty) || 1 }));
    if (!picks.length) { setRpErr('Tick at least one design.'); return; }
    setRpBusy(true); setRpErr('');
    try {
      await axios.post(`${config.backendUrl}/api/public/lookbooks/${id}/request-pricing?token=${encodeURIComponent(token)}`, { picks, by: me, ...rpMeta });
      setRpDone(true); setRpSel({});
    } catch (e) {
      setRpErr(e.response?.data?.message || 'Could not send — try again in a minute.');
    } finally { setRpBusy(false); }
  };

  // One mockup's label row (number · name · #mockupNum).
  const LabelRow = ({ m, i, align = 'center' }) => showLabels ? (
    <Stack direction="row" alignItems="baseline" justifyContent={align === 'center' ? 'center' : 'flex-start'} gap={1} sx={{ mb: 1.75 }}>
      <Typography sx={{ ...mono, color: theme.faint, fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: 16, sm: 18 }, color: theme.text }}>{m.name || 'Untitled'}</Typography>
      {m.mockupNum && <Typography sx={{ ...mono, color: theme.faint, fontSize: 12 }}>#{m.mockupNum}</Typography>}
    </Stack>
  ) : null;

  // The reaction pills for one mockup.
  const Reactions = ({ rid }) => {
    const reactions = latestByPerson(rid);
    let up = 0, down = 0;
    reactions.forEach((f) => { if (f.reaction === 'up') up += 1; else if (f.reaction === 'down') down += 1; });
    const mine = (me && reactions.get(me)?.reaction) || '';
    const busy = busyKey === (rid || 'overall');
    return (
      <Stack direction="row" justifyContent="center" gap={1.25} sx={{ mt: 2.5, flexWrap: 'wrap' }}>
        <ReactBtn up active={mine === 'up'} count={up} disabled={busy} theme={theme}
          onClick={() => { if (mine !== 'up') post(rid, { reaction: 'up' }); }} />
        <ReactBtn up={false} active={mine === 'down'} count={down} disabled={busy} theme={theme}
          onClick={() => { if (mine !== 'down') post(rid, { reaction: 'down' }); }} />
      </Stack>
    );
  };

  const Notes = ({ rid, placeholder }) => (
    <CommentBlock
      comments={commentsFor(rid)} draft={drafts[rid] || ''} theme={theme}
      onDraft={(v) => setDrafts((d) => ({ ...d, [rid]: v }))}
      onSend={() => post(rid, { comment: drafts[rid] || '' })}
      busy={busyKey === (rid || 'overall')} placeholder={placeholder}
    />
  );

  // ── Per-layout mockup renderers ─────────────────────────────────────────────
  const renderStack = () => (
    <Stack spacing={{ xs: 6, sm: 9 }} sx={{ mt: { xs: 5, sm: 8 } }}>
      {mockups.map((m, i) => {
        const rid = m.remoteId || '';
        return (
          <Box key={rid || i} component="section" sx={{ textAlign: 'center' }}>
            <LabelRow m={m} i={i} />
            <MockupFaces m={m} clean={isClean} theme={theme} showBack={showBack} />
            {m.caption && <Typography sx={{ color: theme.muted, fontSize: 14.5, lineHeight: 1.6, mt: 2, maxWidth: 560, mx: 'auto' }}>{m.caption}</Typography>}
            <Reactions rid={rid} />
            <Notes rid={rid} placeholder="Leave a note about this one…" />
          </Box>
        );
      })}
    </Stack>
  );

  const renderGrid = () => (
    <Box sx={{ mt: { xs: 5, sm: 8 }, display: 'grid', gap: { xs: 3, sm: 4 }, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      {mockups.map((m, i) => {
        const rid = m.remoteId || '';
        const open = !!expanded[rid];
        const nComments = commentsFor(rid).length;
        return (
          <Box key={rid || i} component="section" sx={{ textAlign: 'center',
            bgcolor: isClean ? 'transparent' : 'transparent', borderRadius: 3 }}>
            <MockupFaces m={m} clean={isClean} theme={theme} showBack={showBack} dense />
            {showLabels && (
              <Stack direction="row" alignItems="baseline" justifyContent="center" gap={0.75} sx={{ mt: 1.5 }}>
                <Typography sx={{ ...mono, color: theme.faint, fontSize: 11 }}>{String(i + 1).padStart(2, '0')}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: theme.text }}>{m.name || 'Untitled'}</Typography>
                {m.mockupNum && <Typography sx={{ ...mono, color: theme.faint, fontSize: 11 }}>#{m.mockupNum}</Typography>}
              </Stack>
            )}
            {m.caption && <Typography sx={{ color: theme.muted, fontSize: 13, lineHeight: 1.55, mt: 0.75, maxWidth: 420, mx: 'auto' }}>{m.caption}</Typography>}
            <Reactions rid={rid} />
            <Button onClick={() => setExpanded((e) => ({ ...e, [rid]: !e[rid] }))}
              sx={{ mt: 1, textTransform: 'none', color: theme.muted, fontSize: 12.5, fontWeight: 700, '&:hover': { color: theme.accent } }}>
              {open ? 'Hide notes' : (nComments > 0 ? `Notes (${nComments})` : 'Add a note')}
            </Button>
            {open && <Notes rid={rid} placeholder="Leave a note about this one…" />}
          </Box>
        );
      })}
    </Box>
  );

  const renderStory = () => (
    <Stack spacing={{ xs: 6, sm: 10 }} sx={{ mt: { xs: 5, sm: 8 } }}>
      {mockups.map((m, i) => {
        const rid = m.remoteId || '';
        const flip = i % 2 === 1;   // alternate image / text sides
        return (
          <Box key={rid || i} component="section" sx={{ display: 'grid', gap: { xs: 2.5, sm: 4 }, alignItems: 'center',
            gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' } }}>
            <Box sx={{ order: { xs: 0, md: flip ? 1 : 0 } }}>
              <MockupFaces m={m} clean={isClean} theme={theme} showBack={showBack} dense />
            </Box>
            <Box sx={{ order: { xs: 1, md: flip ? 0 : 1 }, textAlign: { xs: 'center', md: flip ? 'right' : 'left' } }}>
              {showLabels && (
                <>
                  <Typography sx={{ ...mono, color: theme.faint, fontSize: 12 }}>{String(i + 1).padStart(2, '0')}{m.mockupNum ? ` · #${m.mockupNum}` : ''}</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, sm: 26 }, color: theme.text, letterSpacing: -0.4, mt: 0.5 }}>{m.name || 'Untitled'}</Typography>
                </>
              )}
              {m.caption && <Typography sx={{ color: theme.muted, fontSize: 15, lineHeight: 1.65, mt: 1.5 }}>{m.caption}</Typography>}
              <Box sx={{ mt: 1 }}><Reactions rid={rid} /></Box>
              <Box sx={{ mt: 1 }}><Notes rid={rid} placeholder="Leave a note about this one…" /></Box>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );

  const swatchDot = (t) => {
    const th = THEMES[t];
    const on = t === themeId;
    return (
      <Tooltip title={th.name} key={t} arrow>
        <Box role="button" aria-label={`${th.name} theme`} onClick={() => pickTheme(t)}
          sx={{ width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
            background: `linear-gradient(135deg, ${th.bg} 0 55%, ${th.accent} 55% 100%)`,
            border: `2px solid ${on ? theme.accent : theme.line}`,
            boxShadow: on ? `0 0 0 2px ${theme.accentSoft}` : 'none',
            transition: 'transform 140ms ease, border-color 140ms ease',
            '&:hover': { transform: 'scale(1.12)' } }} />
      </Tooltip>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.bg, color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', transition: 'background-color 240ms ease' }}>

      {/* ── Control bar — the viewer's studio: theme, layout, clean bg, PDF ─── */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 20,
        borderBottom: `1px solid ${theme.line}`,
        bgcolor: theme.isDark ? 'rgba(20,23,26,0.72)' : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: 1,
          display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 },
          overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: theme.faint, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
            Joint Printing
          </Typography>
          <Box sx={{ flex: 1 }} />

          {/* theme swatches */}
          <Stack direction="row" gap={0.75} sx={{ flexShrink: 0 }}>{THEME_ORDER.map(swatchDot)}</Stack>
          <Box sx={{ width: '1px', height: 22, bgcolor: theme.line, flexShrink: 0, mx: 0.25 }} />

          {/* layout segmented control */}
          <Stack direction="row" gap={0.25} sx={{ flexShrink: 0, bgcolor: theme.accentSoft, borderRadius: 999, p: 0.35 }}>
            {LAYOUTS.map((l) => {
              const on = layout === l.id;
              return (
                <Tooltip title={l.label} arrow key={l.id}>
                  <IconButton size="small" onClick={() => setLayout(l.id)} aria-label={l.label}
                    sx={{ width: 30, height: 30, borderRadius: 999, color: on ? theme.accentText : theme.muted,
                      bgcolor: on ? theme.accent : 'transparent', '&:hover': { bgcolor: on ? theme.accent : theme.line } }}>
                    <l.Icon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              );
            })}
          </Stack>
          <Box sx={{ width: '1px', height: 22, bgcolor: theme.line, flexShrink: 0, mx: 0.25 }} />

          {/* clean-bg toggle */}
          <Tooltip title="Drop the white background — let the products float" arrow>
            <Button onClick={toggleClean} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 800, fontSize: 12.5, borderRadius: 999, px: 1.5, py: 0.6,
                color: isClean ? theme.accentText : theme.muted, bgcolor: isClean ? theme.accent : 'transparent',
                border: `1.5px solid ${isClean ? theme.accent : theme.line}`,
                '&:hover': { bgcolor: isClean ? theme.accent : theme.accentSoft, filter: isClean ? 'brightness(0.95)' : 'none' } }}>
              Clean bg
            </Button>
          </Tooltip>

          {/* PDF download */}
          <Tooltip title="Download this lookbook as a PDF" arrow>
            <span style={{ flexShrink: 0 }}>
              <Button onClick={downloadPdf} disabled={pdfBusy || mockups.length === 0}
                startIcon={pdfBusy ? <CircularProgress size={14} sx={{ color: theme.accent }} /> : <FileDownloadOutlinedIcon sx={{ fontSize: 17 }} />}
                sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12.5, borderRadius: 999, px: 1.75, py: 0.6,
                  color: theme.text, border: `1.5px solid ${theme.line}`,
                  '&:hover': { borderColor: theme.accent, color: theme.accent } }}>
                PDF
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ maxWidth: layout === 'stack' ? 880 : 1080, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 4, sm: 6 } }}>
        {/* ── Header — brand whisper, client logo, big title ─────────────── */}
        <Stack alignItems="center" textAlign="center" spacing={1.25}>
          <Stack direction="row" alignItems="center" gap={0.9} sx={{ mb: 1 }}>
            <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              sx={{ width: 20, height: 20, objectFit: 'contain', filter: theme.isDark ? 'brightness(1.6)' : 'none' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: theme.faint }}>
              Joint Printing · Lookbook
            </Typography>
          </Stack>
          {data.logo && (
            <Box sx={{ bgcolor: '#ffffff', border: `1px solid ${theme.line}`, borderRadius: 2.5, boxShadow: theme.shadow,
              p: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: 200 }}>
              <Box component="img" src={data.logo} alt={data.companyName || ''} loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                sx={{ maxWidth: '100%', maxHeight: 72, objectFit: 'contain', display: 'block' }} />
            </Box>
          )}
          {data.companyName && (
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.accent }}>
              {data.companyName}
            </Typography>
          )}
          <Typography component="h1" sx={{ fontSize: { xs: 30, sm: 44 }, fontWeight: 900, letterSpacing: -1, lineHeight: 1.08 }}>
            {data.title || 'Lookbook'}
          </Typography>
          {data.subtitle && (
            <Typography sx={{ color: theme.muted, fontSize: { xs: 14.5, sm: 16 }, lineHeight: 1.6, maxWidth: 560 }}>
              {data.subtitle}
            </Typography>
          )}
        </Stack>

        {/* ── Who's looking — one name unlocks reactions + notes ─────────── */}
        <Box ref={nameBoxRef} sx={{ mt: { xs: 4, sm: 6 }, mx: 'auto', maxWidth: 440,
          bgcolor: theme.panel, border: `1px solid ${needName ? theme.amber : theme.line}`, borderRadius: 3,
          boxShadow: theme.shadow, p: 2.25, transition: 'border-color 200ms ease' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: theme.faint, mb: 1 }}>
            Your name
          </Typography>
          <TextField
            value={name} onChange={(e) => saveName(e.target.value)} inputRef={nameInputRef}
            placeholder="So we know who the feedback is from" size="small" fullWidth error={needName}
            helperText={needName ? 'Add your name first — then tap or comment away.' : ' '}
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: theme.panel, color: theme.text, borderRadius: 2.5, fontSize: 14,
                '& fieldset': { borderColor: theme.line }, '&:hover fieldset': { borderColor: theme.faint }, '&.Mui-focused fieldset': { borderColor: theme.accent } },
              '& .MuiInputBase-input::placeholder': { color: theme.faint, opacity: 1 },
              '& .MuiFormHelperText-root': { mx: 0, color: needName ? theme.amber : theme.faint },
            }}
          />
          <Typography sx={{ color: theme.faint, fontSize: 12, lineHeight: 1.5, mt: -0.5 }}>
            Tap a thumb or leave a note under any design — we see it instantly.
          </Typography>
        </Box>

        {/* ── The gallery ─────────────────────────────────────────────────── */}
        {mockups.length === 0 ? (
          <Typography sx={{ textAlign: 'center', color: theme.muted, fontSize: 14, mt: 6 }}>
            Nothing here yet — check back soon.
          </Typography>
        ) : layout === 'grid' ? renderGrid() : layout === 'story' ? renderStory() : renderStack()}

        {/* ── One note about the whole set ────────────────────────────────── */}
        {mockups.length > 0 && (
          <Box sx={{ mt: { xs: 7, sm: 10 }, mx: 'auto', maxWidth: 560, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Anything overall?</Typography>
            <Typography sx={{ color: theme.muted, fontSize: 13, mt: 0.5, lineHeight: 1.6 }}>
              A note about the whole set — direction, colors, what to try next.
            </Typography>
            <Notes rid="" placeholder="Tell us what you're thinking…" />
          </Box>
        )}

        <Typography sx={{ textAlign: 'center', color: theme.faint, fontSize: 11.5, mt: { xs: 7, sm: 10 }, pb: 9 }}>
          Designed &amp; printed by Joint Printing · jointprinting.com
        </Typography>
      </Box>

      {/* ── Sticky "Request pricing" bar ────────────────────────────────────── */}
      {mockups.length > 0 && (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 15,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none', pb: { xs: 2, sm: 3 }, pt: 4,
          background: `linear-gradient(to top, ${theme.bg} 12%, ${theme.isDark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)'})` }}>
          <Button onClick={openPricing} startIcon={<RequestQuoteOutlinedIcon />}
            sx={{ pointerEvents: 'auto', bgcolor: theme.accent, color: theme.accentText, textTransform: 'none',
              fontWeight: 800, fontSize: 15, px: 3.5, py: 1.25, borderRadius: 999,
              boxShadow: `0 12px 34px ${theme.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(21,128,61,0.32)'}`,
              '&:hover': { bgcolor: theme.accent, filter: 'brightness(0.94)' } }}>
            Request pricing
          </Button>
        </Box>
      )}

      <Dialog open={rpOpen} onClose={() => !rpBusy && setRpOpen(false)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { bgcolor: theme.bg, color: theme.text, borderRadius: 3, border: `1px solid ${theme.line}` } }}>
        {rpDone ? (
          <DialogContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 40, mb: 1 }}>🎉</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: 20 }}>Request sent!</Typography>
            <Typography sx={{ color: theme.muted, fontSize: 14, mt: 1, lineHeight: 1.6, maxWidth: 380, mx: 'auto' }}>
              We're pricing your picks now — your quote will land in your inbox shortly.
            </Typography>
            <Button onClick={() => setRpOpen(false)}
              sx={{ mt: 3, bgcolor: theme.accent, color: theme.accentText, textTransform: 'none', fontWeight: 800, px: 3, borderRadius: 999, '&:hover': { filter: 'brightness(0.94)' } }}>
              Done
            </Button>
          </DialogContent>
        ) : (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 0.5 }}>
              <RequestQuoteOutlinedIcon sx={{ color: theme.accent }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>Request pricing</Typography>
                <Typography sx={{ color: theme.muted, fontSize: 12.5 }}>
                  Tick the designs you want, set quantities — we'll send a full quote.
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => !rpBusy && setRpOpen(false)} sx={{ color: theme.faint }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Stack sx={{ border: `1px solid ${theme.line}`, borderRadius: 2.5, overflow: 'hidden', mt: 1 }}>
                {mockups.map((m) => {
                  const rid = m.remoteId || '';
                  const on = rpSel[rid] !== undefined;
                  return (
                    <Stack key={rid} direction="row" alignItems="center" gap={1} onClick={() => toggleRp(rid)}
                      sx={{ px: 1.25, py: 0.75, cursor: 'pointer', bgcolor: on ? theme.accentSoft : 'transparent',
                        borderBottom: `1px solid ${theme.line}`, '&:last-of-type': { borderBottom: 'none' }, transition: 'background 150ms ease' }}>
                      <Checkbox size="small" checked={on} sx={{ color: theme.faint, '&.Mui-checked': { color: theme.accent }, p: 0.5 }} />
                      {m.front && <Box component="img" src={m.front} alt="" loading="lazy"
                        sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${theme.line}` }} />}
                      <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name || m.caption || 'Design'}
                      </Typography>
                      {on && (
                        <TextField size="small" type="number" value={rpSel[rid]} onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRpSel((prev) => ({ ...prev, [rid]: e.target.value }))}
                          InputProps={{ endAdornment: <Typography sx={{ color: theme.faint, fontSize: 11, ml: 0.5 }}>units</Typography> }}
                          sx={{ width: 118, '& .MuiInputBase-input': { py: 0.6, fontSize: 13, ...mono, color: theme.text },
                            '& .MuiOutlinedInput-root': { bgcolor: theme.panel, borderRadius: 2, '& fieldset': { borderColor: theme.line }, '&.Mui-focused fieldset': { borderColor: theme.accent } } }} />
                      )}
                    </Stack>
                  );
                })}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 0.5 }}>
                <TextField size="small" fullWidth placeholder="Email for the quote" value={rpMeta.email}
                  onChange={(e) => setRpMeta((v) => ({ ...v, email: e.target.value }))} sx={rpField} />
                <TextField size="small" fullWidth placeholder="Phone (optional)" value={rpMeta.phone}
                  onChange={(e) => setRpMeta((v) => ({ ...v, phone: e.target.value }))} sx={rpField} />
              </Stack>
              <TextField size="small" fullWidth placeholder="Ship to — address or city, state (e.g. Trenton, NJ)"
                value={rpMeta.shipTo} onChange={(e) => setRpMeta((v) => ({ ...v, shipTo: e.target.value }))} sx={rpField} />
              <TextField size="small" fullWidth multiline minRows={2} placeholder="Anything else — sizes, colors, deadline…"
                value={rpMeta.note} onChange={(e) => setRpMeta((v) => ({ ...v, note: e.target.value }))} sx={rpField} />
              {rpErr && <Typography sx={{ color: theme.amber, fontSize: 12.5, fontWeight: 700 }}>{rpErr}</Typography>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setRpOpen(false)} disabled={rpBusy} sx={{ color: theme.muted, textTransform: 'none', fontWeight: 700 }}>Cancel</Button>
              <Button onClick={submitPricing} disabled={rpBusy}
                sx={{ bgcolor: theme.accent, color: theme.accentText, textTransform: 'none', fontWeight: 800, px: 3, borderRadius: 999,
                  '&:hover': { filter: 'brightness(0.94)' }, '&.Mui-disabled': { bgcolor: theme.accentSoft, color: theme.faint } }}>
                {rpBusy ? <CircularProgress size={18} sx={{ color: theme.accent }} /> : 'Send request'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
