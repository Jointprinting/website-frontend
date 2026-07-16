// src/screens/LookbookView.js
// Public, token-gated lookbook — the link a client opens when the owner shares a
// curated set of mockups from the Studio's Lookbooks builder (backend:
// /api/public/lookbooks). Reactions, comments and "request pricing" land back on
// the record and surface in the builder's feedback panel.
//
// This is a MARKETING piece, built to WOW on open with barely any scroll:
//   • Collage  — the default. Products are knocked out of their white backdrop
//                and layered over each other into one composition — the hero.
//                Tap any piece to bring it forward and react / request it.
//   • Showcase — one big piece per row, for a considered scroll-through.
//   • Grid     — a tight contact sheet.
// Plus: live theme switching (paper / charcoal / forest / sand), and a
// token-gated PDF download of the same deck. Owner-set defaults ride in on the
// payload; the viewer's live choices are theirs alone (localStorage).

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Stack, Typography, Button, TextField, CircularProgress,
  Dialog, DialogContent, DialogTitle, DialogActions, Checkbox, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import AutoAwesomeMotionOutlinedIcon from '@mui/icons-material/AutoAwesomeMotionOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { keyframes } from '@mui/system';
import axios from 'axios';
import config from '../config.json';
import JpLoader from '../common/JpLoader';

// Gentle ambient bob for the collage — each piece drifts on its own cadence so
// everything gets its moment, never a static stack. Honors reduced-motion.
const floatKf = keyframes({ '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-11px)' } });

// ── Theme registry — each palette is self-contained and visibly distinct (three
// lights, three darks; the darks differ by hue — neutral / green / blue — so no
// two read the same). `stage` is ALWAYS light so a `multiply` knockout fallback
// stays clean even on the dark themes. ──
const THEMES = {
  paper: {
    id: 'paper', name: 'Paper', isDark: false,
    bg: '#faf9f6', panel: '#ffffff', stage: '#f3f1ea', line: 'rgba(15,26,19,0.10)',
    text: '#111a14', muted: 'rgba(17,26,20,0.62)', faint: 'rgba(17,26,20,0.42)',
    accent: '#15803d', accentText: '#ffffff', accentSoft: 'rgba(21,128,61,0.09)',
    amber: '#b45309', amberSoft: 'rgba(180,83,9,0.09)',
    glow: 'rgba(21,128,61,0.16)', shadow: '0 10px 34px rgba(15,26,19,0.07)',
  },
  summer: {
    id: 'summer', name: 'Summer', isDark: false,
    bg: '#fef5e7', panel: '#fffdf8', stage: '#faedd6', line: 'rgba(120,70,20,0.13)',
    text: '#3a2411', muted: 'rgba(58,36,17,0.62)', faint: 'rgba(58,36,17,0.42)',
    accent: '#e8622a', accentText: '#ffffff', accentSoft: 'rgba(232,98,42,0.10)',
    amber: '#c2410c', amberSoft: 'rgba(194,65,12,0.10)',
    glow: 'rgba(232,98,42,0.20)', shadow: '0 10px 30px rgba(120,70,20,0.12)',
  },
  sand: {
    id: 'sand', name: 'Sand', isDark: false,
    bg: '#efe9dd', panel: '#fbf8f2', stage: '#e6ded0', line: 'rgba(60,45,25,0.13)',
    text: '#2b2416', muted: 'rgba(43,36,22,0.62)', faint: 'rgba(43,36,22,0.42)',
    accent: '#9a5726', accentText: '#ffffff', accentSoft: 'rgba(154,87,38,0.10)',
    amber: '#9a5726', amberSoft: 'rgba(154,87,38,0.10)',
    glow: 'rgba(154,87,38,0.18)', shadow: '0 10px 30px rgba(60,45,25,0.12)',
  },
  charcoal: {
    id: 'charcoal', name: 'Charcoal', isDark: true,
    bg: '#17191d', panel: '#212530', stage: '#f3f1ea', line: 'rgba(255,255,255,0.12)',
    text: '#eef1f5', muted: 'rgba(238,241,245,0.66)', faint: 'rgba(238,241,245,0.40)',
    accent: '#34d17f', accentText: '#052012', accentSoft: 'rgba(52,209,127,0.14)',
    amber: '#f0b429', amberSoft: 'rgba(240,180,41,0.14)',
    glow: 'rgba(52,209,127,0.22)', shadow: '0 16px 44px rgba(0,0,0,0.46)',
  },
  forest: {
    id: 'forest', name: 'Forest', isDark: true,
    bg: '#0b1e12', panel: '#123020', stage: '#eef1e9', line: 'rgba(140,220,170,0.18)',
    text: '#e6f4ea', muted: 'rgba(198,224,206,0.80)', faint: 'rgba(140,180,155,0.85)',
    accent: '#5fe39b', accentText: '#04160c', accentSoft: 'rgba(95,227,155,0.16)',
    amber: '#e9c072', amberSoft: 'rgba(233,192,114,0.15)',
    glow: 'rgba(95,227,155,0.26)', shadow: '0 16px 44px rgba(0,0,0,0.5)',
  },
  winter: {
    id: 'winter', name: 'Winter', isDark: true,
    bg: '#0e1a2b', panel: '#16263d', stage: '#eef3f8', line: 'rgba(150,190,230,0.18)',
    text: '#e8f0fa', muted: 'rgba(206,222,240,0.80)', faint: 'rgba(150,175,205,0.82)',
    accent: '#5cc7ee', accentText: '#04121f', accentSoft: 'rgba(92,199,238,0.16)',
    amber: '#e9c072', amberSoft: 'rgba(233,192,114,0.15)',
    glow: 'rgba(92,199,238,0.26)', shadow: '0 16px 44px rgba(0,0,0,0.5)',
  },
};
const THEME_ORDER = ['paper', 'summer', 'sand', 'charcoal', 'forest', 'winter'];
const THEME_ALIAS = { ink: 'charcoal' };   // legacy id from before the rename
const normTheme = (t) => (THEMES[t] ? t : (THEMES[THEME_ALIAS[t]] ? THEME_ALIAS[t] : null));

// Map the owner's stored PDF layout → the viewer's initial view.
const VIEW_FROM_STORED = { auto: 'collage', editorial: 'showcase', grid: 'grid' };
// … and back, for the client's own PDF (collage has no PDF twin → editorial).
const STORED_FROM_VIEW = { collage: 'editorial', showcase: 'editorial', grid: 'grid' };
const VIEWS = [
  { id: 'collage',  label: 'Collage',  Icon: AutoAwesomeMotionOutlinedIcon },
  { id: 'showcase', label: 'Showcase', Icon: ViewAgendaOutlinedIcon },
  { id: 'grid',     label: 'Grid',     Icon: GridViewOutlinedIcon },
];

const COLLAGE_MAX = 7;   // beyond this the collage curates the first N (rest via Grid)
const mono = { fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };
const NAME_KEY = 'jp-lb-name';
const THEME_KEY = 'jp-lb-theme';
const LSAFE = (fn) => { try { return fn(); } catch (_) { return undefined; } };

// Knock the white backdrop out of a mockup in the browser: near-white pixels →
// transparent, so the piece floats and can layer. Needs a readable canvas
// (base64 is same-origin; R2 works when the bucket sends CORS). On taint/error
// resolves null and the caller keeps the mockup as-is. Never throws.
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
        const id = ctx.getImageData(0, 0, w, h);   // throws if tainted
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

function useKnockout(src, on) {
  const [ko, setKo] = useState(null);
  useEffect(() => {
    let alive = true; setKo(null);
    if (!on || !src) return undefined;
    knockoutWhite(src).then((u) => { if (alive) setKo(u); });
    return () => { alive = false; };
  }, [src, on]);
  return ko;
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

// Deterministic slots for the collage — pieces are SPREAD across the stage (not
// piled) so each one gets its own space and moment, with just enough size
// variation and tilt to feel composed rather than gridded. Percent coords
// (center-anchored), width %, rotation. Stable per index (no randomness).
const SMALL_SLOTS = {
  1: [{ left: 50, top: 50, w: 44, rot: -1 }],
  2: [{ left: 33, top: 50, w: 35, rot: -4 }, { left: 67, top: 50, w: 35, rot: 4 }],
  3: [{ left: 26, top: 44, w: 30, rot: -6 }, { left: 52, top: 58, w: 33, rot: 2 }, { left: 76, top: 42, w: 29, rot: 6 }],
};
const SPREAD_SLOTS = [
  { left: 24, top: 30, w: 27, rot: -6 },
  { left: 72, top: 28, w: 25, rot: 5 },
  { left: 48, top: 51, w: 30, rot: -2 },
  { left: 21, top: 68, w: 24, rot: 7 },
  { left: 78, top: 65, w: 25, rot: -6 },
  { left: 46, top: 77, w: 22, rot: 3 },
  { left: 88, top: 46, w: 18, rot: 9 },
];
function collageSlots(n) {
  if (SMALL_SLOTS[n]) return SMALL_SLOTS[n];
  return SPREAD_SLOTS.slice(0, n);
}

function ReactRow({ rid, latestByPerson, me, busyKey, post, theme, size = 'md' }) {
  const reactions = latestByPerson(rid);
  let up = 0, down = 0;
  reactions.forEach((f) => { if (f.reaction === 'up') up += 1; else if (f.reaction === 'down') down += 1; });
  const mine = (me && reactions.get(me)?.reaction) || '';
  const busy = busyKey === (rid || 'overall');
  const pill = (up_, active, count, onClick) => {
    const Icon = up_ ? ThumbUpAltOutlinedIcon : ThumbDownAltOutlinedIcon;
    const tone = up_ ? theme.accent : theme.amber;
    const soft = up_ ? theme.accentSoft : theme.amberSoft;
    return (
      <Button onClick={onClick} disabled={busy} aria-pressed={active}
        sx={{ minWidth: 0, px: size === 'sm' ? 1.5 : 2, py: size === 'sm' ? 0.5 : 0.8, borderRadius: 999, textTransform: 'none',
          display: 'inline-flex', gap: 0.6, fontWeight: 700, fontSize: size === 'sm' ? 12 : 13,
          color: active ? tone : theme.muted, border: `1.5px solid ${active ? tone : theme.line}`,
          bgcolor: active ? soft : theme.panel, transition: 'all 160ms ease',
          '&:hover': { borderColor: tone, color: tone, bgcolor: soft } }}>
        <Icon sx={{ fontSize: size === 'sm' ? 16 : 18 }} />
        {up_ ? 'Love it' : 'Not this one'}
        {count > 0 && <Box component="span" sx={{ ...mono, fontSize: 12, color: active ? tone : theme.faint }}>{count}</Box>}
      </Button>
    );
  };
  return (
    <Stack direction="row" justifyContent="center" gap={1.25} flexWrap="wrap">
      {pill(true, mine === 'up', up, () => { if (mine !== 'up') post(rid, { reaction: 'up' }); })}
      {pill(false, mine === 'down', down, () => { if (mine !== 'down') post(rid, { reaction: 'down' }); })}
    </Stack>
  );
}

function themedField(theme) {
  return {
    '& .MuiOutlinedInput-root': {
      bgcolor: theme.panel, color: theme.text, borderRadius: 2.5, fontSize: 14,
      '& fieldset': { borderColor: theme.line },
      '&:hover fieldset': { borderColor: theme.faint },
      '&.Mui-focused fieldset': { borderColor: theme.accent },
    },
    '& .MuiInputBase-input::placeholder': { color: theme.faint, opacity: 1 },
  };
}

function CommentBlock({ comments, draft, onDraft, onSend, busy, placeholder, theme }) {
  const canSend = !!draft.trim() && !busy;
  const field = themedField(theme);
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', width: '100%' }}>
      {comments.length > 0 && (
        <Stack spacing={1} sx={{ mb: 1.5, textAlign: 'left' }}>
          {comments.map((f, i) => (
            <Box key={i} sx={{ bgcolor: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 2.5, px: 1.75, py: 1.25 }}>
              <Stack direction="row" alignItems="baseline" gap={1}>
                <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: theme.text }}>{f.by || 'Someone'}</Typography>
                <Typography sx={{ color: theme.faint, fontSize: 11 }}>{ago(f.at)}</Typography>
              </Stack>
              <Typography sx={{ color: theme.muted, fontSize: 13.5, mt: 0.4, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.comment}</Typography>
            </Box>
          ))}
        </Stack>
      )}
      <Stack direction="row" gap={1} alignItems="flex-start">
        <TextField value={draft} onChange={(e) => onDraft(e.target.value)} placeholder={placeholder}
          size="small" fullWidth multiline maxRows={4} sx={field}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && canSend) { e.preventDefault(); onSend(); } }} />
        <Button onClick={onSend} disabled={!canSend}
          sx={{ px: 2.25, py: 0.9, borderRadius: 999, textTransform: 'none', flexShrink: 0, fontWeight: 800, fontSize: 13,
            bgcolor: theme.accent, color: theme.accentText, '&:hover': { filter: 'brightness(0.94)' },
            '&.Mui-disabled': { bgcolor: theme.accentSoft, color: theme.faint } }}>
          {busy ? <CircularProgress size={16} sx={{ color: theme.accentText }} /> : 'Send'}
        </Button>
      </Stack>
    </Box>
  );
}

// One framed / clean face used by Showcase + Grid + the focus lightbox.
function ProductImage({ src, alt, clean, theme, radius = 3 }) {
  const ko = useKnockout(src, clean);
  if (!src) return null;
  if (!clean) {
    return (
      <Box sx={{ bgcolor: theme.panel, border: `1px solid ${theme.line}`, borderRadius: radius, boxShadow: theme.shadow, overflow: 'hidden' }}>
        <Box component="img" src={src} alt={alt} loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} sx={{ width: '100%', display: 'block' }} />
      </Box>
    );
  }
  const usingKO = !!ko;
  return (
    <Box sx={{ bgcolor: usingKO ? 'transparent' : theme.stage, borderRadius: radius, display: 'flex', justifyContent: 'center',
      alignItems: 'center', p: usingKO ? { xs: 1, sm: 2 } : { xs: 2, sm: 3.5 }, transition: 'background-color 200ms ease' }}>
      <Box component="img" src={ko || src} alt={alt} loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        sx={{ width: '100%', display: 'block', mixBlendMode: usingKO ? 'normal' : 'multiply',
          filter: usingKO ? 'drop-shadow(0 18px 30px rgba(0,0,0,0.20))' : 'none' }} />
    </Box>
  );
}

// One knocked-out piece placed in the collage. Transparent PNG where possible
// (floats on the theme), else the raw mockup on a small rounded card (still
// reads as a layered photo). The OUTER box owns position + tilt + hover; the
// INNER box owns the slow ambient float — kept on separate elements so the two
// transforms never fight. Tapping focuses it.
function CollageProduct({ m, slot, i, theme, onOpen, focused }) {
  const ko = useKnockout(m.front, true);
  const usingKO = !!ko;
  const dur = 5.5 + (i % 4);           // 5.5–8.5s — each piece drifts on its own clock
  const delay = (i * 0.8) % 4;
  return (
    <Box onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      sx={{ position: 'absolute', left: `${slot.left}%`, top: `${slot.top}%`, width: `${slot.w}%`,
        zIndex: focused ? 80 : (i + 1) * 5,
        transform: `translate(-50%, -50%) rotate(${slot.rot}deg) scale(${focused ? 1.05 : 1})`,
        transformOrigin: 'center', cursor: 'pointer', transition: 'transform 300ms cubic-bezier(0.2,0.8,0.2,1)',
        '&:hover': { transform: 'translate(-50%, -50%) rotate(0deg) scale(1.07)', zIndex: 90 },
        '&:focus-visible': { outline: `2px solid ${theme.accent}`, outlineOffset: 4 } }}>
      <Box sx={{ animation: `${floatKf} ${dur}s ease-in-out ${delay}s infinite`,
        filter: usingKO ? 'drop-shadow(0 22px 30px rgba(0,0,0,0.28))' : 'none',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
        {usingKO ? (
          <Box component="img" src={ko} alt={m.name || 'Design'} loading="lazy" sx={{ width: '100%', display: 'block' }} />
        ) : (
          <Box sx={{ bgcolor: '#fff', borderRadius: 2, overflow: 'hidden', boxShadow: '0 18px 34px rgba(0,0,0,0.32)', border: '4px solid #fff' }}>
            <Box component="img" src={m.front} alt={m.name || 'Design'} loading="lazy" sx={{ width: '100%', display: 'block' }} />
          </Box>
        )}
      </Box>
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
  const [errKind, setErrKind] = useState('');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(() => LSAFE(() => window.localStorage.getItem(NAME_KEY)) || '');
  const [needName, setNeedName] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState('');
  const [focusRid, setFocusRid] = useState(null);   // collage lightbox target

  const [themeId, setThemeId] = useState(() =>
    normTheme(params.get('theme')) || normTheme(LSAFE(() => window.localStorage.getItem(THEME_KEY))) || null);
  const [view, setView] = useState('collage');
  const [pdfBusy, setPdfBusy] = useState(false);

  const [rpOpen, setRpOpen] = useState(false);
  const [rpSel, setRpSel] = useState({});
  const [rpMeta, setRpMeta] = useState({ email: '', phone: '', shipTo: '', note: '' });
  const [rpBusy, setRpBusy] = useState(false);
  const [rpDone, setRpDone] = useState(false);
  const [rpErr, setRpErr] = useState('');
  const nameInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) { setErr('This link is missing its token.'); setErrKind('invalid'); setLoading(false); return; }
      try {
        const r = await axios.get(`${config.backendUrl}/api/public/lookbooks/${id}?${q}`);
        if (cancelled) return;
        setData(r.data);
        setThemeId((cur) => cur || normTheme(r.data.theme) || 'paper');
        setView(VIEW_FROM_STORED[r.data.layout] || 'collage');
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
  const rpField = themedField(theme);
  const pickTheme = (t) => { setThemeId(t); LSAFE(() => window.localStorage.setItem(THEME_KEY, t)); };

  const refresh = async () => {
    try { const r = await axios.get(`${config.backendUrl}/api/public/lookbooks/${id}?${q}`); setData(r.data); }
    catch (_) { /* keep what's on screen */ }
  };
  const saveName = (v) => { setName(v); if (v.trim()) setNeedName(false); LSAFE(() => window.localStorage.setItem(NAME_KEY, v)); };
  const requireName = () => {
    if (name.trim()) return true;
    setNeedName(true);
    setTimeout(() => LSAFE(() => nameInputRef.current?.focus()), 120);
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
      + `&layout=${encodeURIComponent(STORED_FROM_VIEW[view] || 'editorial')}`
      + `&knockout=${view === 'collage' ? 'true' : 'false'}`;
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
            {expired ? 'Ask Joint Printing for a fresh one — we’ll send it right over.'
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

  const openPricing = (seedRid) => {
    if (!me) { requireName(); return; }
    setRpDone(false);
    setRpSel((prev) => {
      if (seedRid) return { ...prev, [seedRid]: prev[seedRid] || '50' };
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

  const focusM = focusRid != null ? mockups.find((m) => (m.remoteId || '') === focusRid) : null;

  // ── Label helpers ───────────────────────────────────────────────────────────
  const Labels = ({ m, i, size = 'md' }) => showLabels ? (
    <Stack direction="row" alignItems="baseline" justifyContent="center" gap={0.9} sx={{ mb: size === 'md' ? 1.75 : 1 }}>
      <Typography sx={{ ...mono, color: theme.faint, fontSize: size === 'md' ? 12 : 11 }}>{String(i + 1).padStart(2, '0')}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: size === 'md' ? { xs: 16, sm: 18 } : 15, color: theme.text }}>{m.name || 'Untitled'}</Typography>
      {m.mockupNum && <Typography sx={{ ...mono, color: theme.faint, fontSize: size === 'md' ? 12 : 11 }}>#{m.mockupNum}</Typography>}
    </Stack>
  ) : null;

  const nameField = (
    <TextField value={name} onChange={(e) => saveName(e.target.value)} inputRef={nameInputRef}
      placeholder="Your name — so we know who's reacting" size="small" fullWidth error={needName}
      helperText={needName ? 'Add your name first, then tap or comment.' : ' '}
      sx={{ ...rpField, '& .MuiFormHelperText-root': { mx: 0, color: needName ? theme.amber : theme.faint } }} />
  );

  // ── Views ───────────────────────────────────────────────────────────────────
  const renderCollage = () => {
    const shown = mockups.slice(0, COLLAGE_MAX);
    const slots = collageSlots(shown.length);
    const extra = mockups.length - shown.length;
    return (
      <Box sx={{ mt: { xs: 2, sm: 3 } }}>
        <Box sx={{ position: 'relative', width: '100%', mx: 'auto', maxWidth: 860,
          height: { xs: '58vh', sm: '62vh' }, minHeight: { xs: 340, sm: 420 } }}>
          {shown.map((m, i) => (
            <CollageProduct key={m.remoteId || i} m={m} slot={slots[i]} i={i} theme={theme}
              focused={(m.remoteId || '') === focusRid} onOpen={() => setFocusRid(m.remoteId || '')} />
          ))}
        </Box>
        <Typography sx={{ textAlign: 'center', color: theme.faint, fontSize: 12.5, mt: 1.5 }}>
          Tap any piece to see it up close, love it, or ask for pricing
          {extra > 0 && <> · <Box component="span" onClick={() => setView('grid')} sx={{ color: theme.accent, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>see all {mockups.length} designs</Box></>}
        </Typography>
      </Box>
    );
  };

  const renderShowcase = () => (
    <Stack spacing={{ xs: 6, sm: 9 }} sx={{ mt: { xs: 4, sm: 6 } }}>
      {mockups.map((m, i) => {
        const rid = m.remoteId || '';
        // Every angle of this design: front, the back (only when the lookbook
        // shows backs), then each extra view (sleeve, extra designs, alternate
        // angles). One or many — the grid goes two-up once there's more than one.
        const extraViews = Array.isArray(m.extraViews) ? m.extraViews.filter(Boolean) : [];
        const imgs = [
          { src: m.front, alt: m.name },
          ...(showBack && m.back ? [{ src: m.back, alt: `${m.name} back` }] : []),
          ...extraViews.map((src, k) => ({ src, alt: `${m.name} view ${k + 2}` })),
        ].filter((im) => im.src);
        const multi = imgs.length > 1;
        return (
          <Box key={rid || i} component="section" sx={{ textAlign: 'center' }}>
            <Labels m={m} i={i} />
            <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: '1fr', sm: multi ? '1fr 1fr' : '1fr' } }}>
              {imgs.map((im, k) => <ProductImage key={k} src={im.src} alt={im.alt} clean={false} theme={theme} />)}
            </Box>
            {m.caption && <Typography sx={{ color: theme.muted, fontSize: 14.5, lineHeight: 1.6, mt: 2, maxWidth: 560, mx: 'auto' }}>{m.caption}</Typography>}
            <Box sx={{ mt: 2.5 }}><ReactRow rid={rid} latestByPerson={latestByPerson} me={me} busyKey={busyKey} post={post} theme={theme} /></Box>
            <Box sx={{ mt: 2 }}>
              <CommentBlock comments={commentsFor(rid)} draft={drafts[rid] || ''} theme={theme}
                onDraft={(v) => setDrafts((d) => ({ ...d, [rid]: v }))} onSend={() => post(rid, { comment: drafts[rid] || '' })}
                busy={busyKey === (rid || 'overall')} placeholder="Leave a note about this one…" />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );

  const renderGrid = () => (
    <Box sx={{ mt: { xs: 4, sm: 6 }, display: 'grid', gap: { xs: 3, sm: 4 }, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' } }}>
      {mockups.map((m, i) => {
        const rid = m.remoteId || '';
        return (
          <Box key={rid || i} component="section" sx={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setFocusRid(rid)}>
            <ProductImage src={m.front} alt={m.name} clean={false} theme={theme} />
            {showLabels && (
              <Stack direction="row" alignItems="baseline" justifyContent="center" gap={0.6} sx={{ mt: 1.25 }}>
                <Typography sx={{ ...mono, color: theme.faint, fontSize: 11 }}>{String(i + 1).padStart(2, '0')}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: theme.text }}>{m.name || 'Untitled'}</Typography>
              </Stack>
            )}
          </Box>
        );
      })}
    </Box>
  );

  // A clean labeled chip that previews each theme (its own bg + accent dot +
  // name), so the picker reads like a real theme selector — not a row of bubbles.
  const swatchChip = (t) => {
    const th = THEMES[t];
    const on = t === themeId;
    return (
      <Box key={t} role="button" aria-label={`${th.name} theme`} onClick={() => pickTheme(t)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 0.9, py: 0.5, borderRadius: 2, cursor: 'pointer', flexShrink: 0,
          bgcolor: th.bg, border: `1.5px solid ${on ? th.accent : theme.line}`,
          boxShadow: on ? `0 0 0 2px ${theme.accentSoft}` : 'none',
          transition: 'transform 140ms ease, border-color 140ms ease', '&:hover': { transform: 'translateY(-1px)', borderColor: th.accent } }}>
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: th.accent, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: th.text, letterSpacing: 0.2 }}>{th.name}</Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.bg, color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', transition: 'background-color 240ms ease' }}>

      {/* ── Control bar — never crops: wraps instead of clipping, roomy py ──── */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 30, borderBottom: `1px solid ${theme.line}`,
        bgcolor: theme.isDark ? 'rgba(20,23,26,0.72)' : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <Box sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: 1.25,
          display: 'flex', alignItems: 'center', gap: { xs: 1.25, sm: 2 }, flexWrap: 'wrap', rowGap: 1 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: theme.faint, flexShrink: 0 }}>
            Joint Printing
          </Typography>
          <Box sx={{ flex: 1, minWidth: 8 }} />
          <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ justifyContent: 'flex-end', rowGap: 0.6 }}>{THEME_ORDER.map(swatchChip)}</Stack>
          <Box sx={{ width: '1px', height: 20, bgcolor: theme.line, flexShrink: 0 }} />
          <Stack direction="row" gap={0.25} sx={{ flexShrink: 0, bgcolor: theme.accentSoft, borderRadius: 999, p: 0.35 }}>
            {VIEWS.map((v) => {
              const on = view === v.id;
              return (
                <Tooltip title={v.label} arrow key={v.id}>
                  <IconButton size="small" onClick={() => setView(v.id)} aria-label={v.label}
                    sx={{ width: 30, height: 30, borderRadius: 999, color: on ? theme.accentText : theme.muted,
                      bgcolor: on ? theme.accent : 'transparent', '&:hover': { bgcolor: on ? theme.accent : theme.line } }}>
                    <v.Icon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              );
            })}
          </Stack>
          <Tooltip title="Download this lookbook as a PDF" arrow>
            <span style={{ flexShrink: 0 }}>
              <Button onClick={downloadPdf} disabled={pdfBusy || mockups.length === 0}
                startIcon={pdfBusy ? <CircularProgress size={14} sx={{ color: theme.accent }} /> : <FileDownloadOutlinedIcon sx={{ fontSize: 17 }} />}
                sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12.5, borderRadius: 999, px: 1.75, py: 0.5,
                  color: theme.text, border: `1.5px solid ${theme.line}`, '&:hover': { borderColor: theme.accent, color: theme.accent } }}>
                PDF
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ maxWidth: view === 'showcase' ? 880 : 1120, mx: 'auto', px: { xs: 2, sm: 3 }, pt: { xs: 3, sm: 4 }, pb: { xs: 12, sm: 14 } }}>
        {/* ── Compact hero — logo, company, big title. Kept tight so the work
            fills the first screen. ─────────────────────────────────────────── */}
        <Stack alignItems="center" textAlign="center" spacing={1}>
          <Stack direction="row" alignItems="center" gap={0.9}>
            <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              sx={{ width: 18, height: 18, objectFit: 'contain', filter: theme.isDark ? 'brightness(1.6)' : 'none' }} />
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: theme.faint }}>
              Joint Printing · Lookbook
            </Typography>
          </Stack>
          {data.logo && (
            <Box sx={{ bgcolor: '#fff', border: `1px solid ${theme.line}`, borderRadius: 2.5, boxShadow: theme.shadow, p: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: 168 }}>
              <Box component="img" src={data.logo} alt={data.companyName || ''} loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }} sx={{ maxWidth: '100%', maxHeight: 56, objectFit: 'contain', display: 'block' }} />
            </Box>
          )}
          {data.companyName && (
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.accent }}>
              {data.companyName}
            </Typography>
          )}
          <Typography component="h1" sx={{ fontSize: { xs: 28, sm: 40 }, fontWeight: 900, letterSpacing: -1, lineHeight: 1.05 }}>
            {data.title || 'Lookbook'}
          </Typography>
          {data.subtitle && (
            <Typography sx={{ color: theme.muted, fontSize: { xs: 14, sm: 15.5 }, lineHeight: 1.55, maxWidth: 560 }}>{data.subtitle}</Typography>
          )}
        </Stack>

        {/* ── The gallery ─────────────────────────────────────────────────── */}
        {mockups.length === 0 ? (
          <Typography sx={{ textAlign: 'center', color: theme.muted, fontSize: 14, mt: 6 }}>Nothing here yet — check back soon.</Typography>
        ) : view === 'grid' ? renderGrid() : view === 'showcase' ? renderShowcase() : renderCollage()}

        {/* ── Overall note ────────────────────────────────────────────────── */}
        {mockups.length > 0 && (
          <Box sx={{ mt: { xs: 7, sm: 10 }, mx: 'auto', maxWidth: 560, textAlign: 'center' }}>
            {!me && <Box sx={{ mb: 2, maxWidth: 400, mx: 'auto' }}>{nameField}</Box>}
            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Anything overall?</Typography>
            <Typography sx={{ color: theme.muted, fontSize: 13, mt: 0.5, mb: 1.5, lineHeight: 1.6 }}>
              A note about the whole set — direction, colors, what to try next.
            </Typography>
            <CommentBlock comments={commentsFor('')} draft={drafts[''] || ''} theme={theme}
              onDraft={(v) => setDrafts((d) => ({ ...d, '': v }))} onSend={() => post('', { comment: drafts[''] || '' })}
              busy={busyKey === 'overall'} placeholder="Tell us what you're thinking…" />
          </Box>
        )}

        <Typography sx={{ textAlign: 'center', color: theme.faint, fontSize: 11.5, mt: { xs: 7, sm: 10 } }}>
          Designed &amp; printed by Joint Printing · jointprinting.com
        </Typography>
      </Box>

      {/* ── Sticky "Request pricing" bar ────────────────────────────────────── */}
      {mockups.length > 0 && (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 25,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none', pb: { xs: 2, sm: 3 }, pt: 4,
          background: `linear-gradient(to top, ${theme.bg} 12%, ${theme.isDark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)'})` }}>
          <Button onClick={() => openPricing()} startIcon={<RequestQuoteOutlinedIcon />}
            sx={{ pointerEvents: 'auto', bgcolor: theme.accent, color: theme.accentText, textTransform: 'none',
              fontWeight: 800, fontSize: 15, px: 3.5, py: 1.25, borderRadius: 999,
              boxShadow: `0 12px 34px ${theme.glow}`, '&:hover': { filter: 'brightness(0.94)' } }}>
            Request pricing
          </Button>
        </Box>
      )}

      {/* ── Focus lightbox (collage / grid tap) ─────────────────────────────── */}
      <Dialog open={!!focusM} onClose={() => setFocusRid(null)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { bgcolor: theme.bg, color: theme.text, borderRadius: 3, border: `1px solid ${theme.line}` } }}>
        {focusM && (
          <>
            <IconButton size="small" onClick={() => setFocusRid(null)} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, color: theme.faint, bgcolor: theme.panel, '&:hover': { color: theme.text } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
            <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
              <ProductImage src={focusM.front} alt={focusM.name} clean theme={theme} radius={3} />
              {showBack && focusM.back && <Box sx={{ mt: 1.5 }}><ProductImage src={focusM.back} alt={`${focusM.name} back`} clean theme={theme} radius={3} /></Box>}
              {(Array.isArray(focusM.extraViews) ? focusM.extraViews.filter(Boolean) : []).map((src, k) => (
                <Box key={k} sx={{ mt: 1.5 }}><ProductImage src={src} alt={`${focusM.name} view ${k + 2}`} clean theme={theme} radius={3} /></Box>
              ))}
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                {showLabels && <Typography sx={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.4 }}>{focusM.name || 'Design'}{focusM.mockupNum && <Box component="span" sx={{ ...mono, color: theme.faint, fontSize: 13, fontWeight: 600, ml: 1 }}>#{focusM.mockupNum}</Box>}</Typography>}
                {focusM.caption && <Typography sx={{ color: theme.muted, fontSize: 14, mt: 0.75, lineHeight: 1.6, maxWidth: 440, mx: 'auto' }}>{focusM.caption}</Typography>}
              </Box>
              {!me && <Box sx={{ mt: 2, maxWidth: 360, mx: 'auto' }}>{nameField}</Box>}
              <Box sx={{ mt: 2 }}><ReactRow rid={focusM.remoteId || ''} latestByPerson={latestByPerson} me={me} busyKey={busyKey} post={post} theme={theme} /></Box>
              <Box sx={{ mt: 2 }}>
                <CommentBlock comments={commentsFor(focusM.remoteId || '')} draft={drafts[focusM.remoteId || ''] || ''} theme={theme}
                  onDraft={(v) => setDrafts((d) => ({ ...d, [focusM.remoteId || '']: v }))}
                  onSend={() => post(focusM.remoteId || '', { comment: drafts[focusM.remoteId || ''] || '' })}
                  busy={busyKey === (focusM.remoteId || 'overall')} placeholder="Leave a note about this one…" />
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2.5, justifyContent: 'center' }}>
              <Button onClick={() => { const rid = focusM.remoteId || ''; setFocusRid(null); openPricing(rid); }}
                startIcon={<RequestQuoteOutlinedIcon />}
                sx={{ bgcolor: theme.accent, color: theme.accentText, textTransform: 'none', fontWeight: 800, px: 3, borderRadius: 999, '&:hover': { filter: 'brightness(0.94)' } }}>
                Request pricing for this
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── Request-pricing dialog ──────────────────────────────────────────── */}
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
                <Typography sx={{ color: theme.muted, fontSize: 12.5 }}>Tick the designs you want, set quantities — we'll send a full quote.</Typography>
              </Box>
              <IconButton size="small" onClick={() => !rpBusy && setRpOpen(false)} sx={{ color: theme.faint }}><CloseIcon fontSize="small" /></IconButton>
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
                      {m.front && <Box component="img" src={m.front} alt="" loading="lazy" sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${theme.line}` }} />}
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
