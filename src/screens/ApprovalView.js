// src/screens/ApprovalView.js
// Public, token-gated approval surface that clients open from a link sent
// by the Order Tracker. They pick their options, watch their confirmation get
// built, then approve or request changes. Backend logs every event.
//
// Design: a dark, branded "drop" experience that matches jointprinting.com
// (near-black canvas, big confident type, lime-green accents, real motion) —
// not the calm white document it used to be. A 3-step progress rail ties the
// pick → review → approve flow into one cohesive ecosystem.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Stack, Typography, Button, TextField, CircularProgress, Dialog,
  DialogTitle, DialogContent, DialogActions, Modal, IconButton,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import axios from 'axios';
import config from '../config.json';
import JpLoader from '../common/JpLoader';

// ── Brand tokens (dark) ──────────────────────────────────────────────────────
const T = {
  bg:       '#070b09',                    // near-black canvas (site = #050806)
  panel:    '#0e1613',                    // elevated, green-tinted dark panel
  panelHi:  '#13201a',                    // hover / selected panel
  inset:    '#0a110d',                    // recessed (tables, totals)
  line:     'rgba(255,255,255,0.08)',     // hairline
  lineHi:   'rgba(74,222,128,0.45)',      // active green border
  green:    '#4ade80',                    // lime accent
  greenDk:  '#0e3b22',                    // deep green
  glow:     'rgba(74,222,128,0.22)',
  text:     '#f3f7f4',
  muted:    'rgba(255,255,255,0.56)',
  faint:    'rgba(255,255,255,0.34)',
  amber:    '#fbbf24',
};

const card = {
  bgcolor: T.panel,
  border: `1px solid ${T.line}`,
  borderRadius: 3,
};
const eyebrow = {
  fontSize: 11, fontWeight: 800, letterSpacing: 2,
  textTransform: 'uppercase', color: T.green,
};
const mono = { fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const _norm = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();

// Mirror the server PDF's confirmation totals: percent custom-lines apply to
// the running subtotal, in order.
function computeConfTotals(conf) {
  const items = Array.isArray(conf?.items) ? conf.items : [];
  const itemsSubtotal = items.reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0), 0);
  let running = itemsSubtotal;
  const lines = (conf?.customLines || []).map(l => {
    const isPct = !!l.isPercent;
    const amt = Number(l.amount) || 0;
    const value = isPct ? running * amt / 100 : amt;
    running += value;
    const base = l.label || (isPct ? 'Adjustment' : 'Add-on');
    return { label: isPct ? `${base} - ${amt}%` : base, value };
  });
  return { itemsSubtotal, lines, grandTotal: running };
}

function confItemTitle(it, idx) {
  const productLabel = it.productName || it.brandName || '';
  const head = productLabel && it.styleCode ? `${productLabel} (${it.styleCode})` : (productLabel || it.styleCode);
  return [head, it.color, it.printType].filter(Boolean).join(' · ') || `Item ${idx + 1}`;
}

// Clickable image that opens the lightbox. Adds a zoom cursor + a soft hover
// lift and a small magnifier badge so it reads as "tap to enlarge".
function ZoomImg({ src, alt = '', onZoom, sx = {}, badge = true }) {
  if (!src) return null;
  return (
    <Box
      sx={{
        position: 'relative', flexShrink: 0, cursor: 'zoom-in',
        borderRadius: 'inherit', overflow: 'hidden', ...sx,
        '& img': { display: 'block', width: '100%', height: '100%', objectFit: 'inherit' },
        '&:hover .zoom-badge': { opacity: 1 },
        '&:hover img': { transform: 'scale(1.05)' },
        '& img.zimg': { transition: 'transform 260ms ease' },
      }}
      onClick={(e) => { e.stopPropagation(); onZoom && onZoom(src); }}
      role="button" tabIndex={0} aria-label="Enlarge image"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onZoom && onZoom(src); } }}
    >
      <Box component="img" className="zimg" src={src} alt={alt} loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        sx={{ width: '100%', height: '100%' }} />
      {badge && (
        <Box className="zoom-badge" sx={{
          position: 'absolute', bottom: 6, right: 6, width: 24, height: 24, borderRadius: '50%',
          bgcolor: 'rgba(0,0,0,0.66)', color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', opacity: 0, transition: 'opacity 180ms ease', pointerEvents: 'none',
        }}>
          <ZoomInIcon sx={{ fontSize: 15 }} />
        </Box>
      )}
    </Box>
  );
}

// ── 3-step progress rail (Choose → Review → Approve) ─────────────────────────
// One glance tells the client where they are in the flow. `states` is a
// 3-tuple of 'done' | 'current' | 'building' | 'todo'.
function ProgressRail({ states }) {
  const labels = ['Choose', 'Review', 'Approve'];
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: { xs: 0.5, sm: 1.5 }, px: 1 }}>
      {labels.map((label, i) => {
        const st = states[i] || 'todo';
        const done = st === 'done';
        const active = st === 'current' || st === 'building';
        const connDone = states[i - 1] === 'done' && (states[i] === 'done' || states[i] === 'current' || states[i] === 'building');
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <Box sx={{ flex: 1, height: 2, mt: 1.4, maxWidth: 80, borderRadius: 1,
                background: connDone ? `linear-gradient(90deg, ${T.green}, ${T.greenDk})` : T.line,
                transition: 'background 400ms ease' }} />
            )}
            <Stack alignItems="center" gap={0.6} sx={{ minWidth: 56 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 12, fontWeight: 800, ...mono,
                color: done ? '#06140c' : (active ? T.green : T.faint),
                bgcolor: done ? T.green : 'transparent',
                border: `2px solid ${done || active ? T.green : T.line}`,
                boxShadow: active ? `0 0 0 0 ${T.green}` : 'none',
                animation: st === 'current' || st === 'building' ? 'railPulse 2s ease-in-out infinite' : 'none',
              }}>
                {done ? <CheckIcon sx={{ fontSize: 16 }} /> : (st === 'building'
                  ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: T.green, animation: 'railBlink 1s ease-in-out infinite' }} />
                  : i + 1)}
              </Box>
              <Typography sx={{ fontSize: 10.5, fontWeight: done || active ? 800 : 600, letterSpacing: 0.4,
                textTransform: 'uppercase', color: done ? T.text : (active ? T.green : T.faint),
                whiteSpace: 'nowrap' }}>
                {st === 'building' ? 'Building' : label}
              </Typography>
            </Stack>
          </React.Fragment>
        );
      })}
    </Box>
  );
}

export default function ApprovalView() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  // Personal recipient tag from the share email (base64url of their email) —
  // passed through on every call so the server attributes views/picks/
  // approvals to the right person without asking anyone to type anything.
  const rTag = params.get('r') || '';
  const q = `token=${encodeURIComponent(token || '')}${rTag ? `&r=${encodeURIComponent(rTag)}` : ''}`;
  // Admin "preview as client" mode (?preview=1): renders the client review
  // exactly as they see it, but read-only — actions disabled, no view logged,
  // and the pre-approval layout shows even after the order is approved/locked.
  const isPreview = params.get('preview') === '1';

  const [data, setData]   = useState(null);
  const [err, setErr]     = useState('');
  const [errReason, setErrReason] = useState('');   // '' | 'expired' | 'invalid'
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesText, setChangesText] = useState('');
  const [lockedNote, setLockedNote] = useState(''); // friendly note when someone else just decided
  const [picks, setPicks] = useState({});           // group label -> quote line index
  const [pickBusy, setPickBusy] = useState(false);
  const [repicking, setRepicking] = useState(false); // client reopened the picker to change selections
  const [lightbox, setLightbox] = useState(null);    // enlarged image src, or null when closed

  // Derived from the server's approvalStatus so reopening the link shows the
  // same locked state for the client every time.
  const p = data?.project || {};
  const approvalStatus = p.approvalStatus || 'pending';   // 'pending' | 'approved' | 'requested_changes'

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) { setErr('This link is missing a token.'); setLoading(false); return; }
      try {
        const r = await axios.get(
          `${config.backendUrl}/api/public/projects/${projectId}?${q}${isPreview ? '&preview=1' : ''}`);
        if (cancelled) return;
        setData(r.data);
      } catch (e) {
        if (cancelled) return;
        setErr(e.response?.data?.message || 'This link is invalid or expired.');
        setErrReason(e.response?.data?.reason || (e.response?.status === 410 ? 'expired' : 'invalid'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, token, isPreview, q]);

  const refresh = async () => {
    try {
      const r = await axios.get(
        `${config.backendUrl}/api/public/projects/${projectId}?${q}`);
      setData(r.data);
    } catch (_) { /* keep existing data */ }
  };

  // Once approved, poll every 60s so the client sees the timeline update in
  // near-real-time when the admin ticks off a step — they don't have to
  // refresh the tab to see "Blanks shipping" turn green. Pauses when the tab
  // is hidden to avoid hammering the server while nobody's looking.
  useEffect(() => {
    if (approvalStatus !== 'approved' || isPreview) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || document.hidden) return;
      refresh();
    };
    const id = setInterval(tick, 60000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalStatus, projectId, token]);

  const handleApprove = async () => {
    // Preview renders the client's page 1:1; intercept the action so the admin
    // can't approve on the client's behalf.
    if (isPreview) { alert("Preview only — this is exactly what your client sees. Approve / Request changes work on the real link, not in preview."); return; }
    setActionBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/approve?${q}`, {});
      await refresh();
    } catch (e) {
      // 409 = someone on the team already approved or sent it back. Not an
      // error from this person's point of view — just refresh into the locked
      // state and show the friendly note instead of a scary alert.
      if (e.response?.status === 409) {
        setLockedNote(e.response.data?.message || '');
        await refresh();
      } else {
        alert(e.response?.data?.message || "That didn't go through — please try again, or just reply to our email and we'll take care of it.");
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleRequestChanges = async () => {
    if (isPreview) { setChangesOpen(false); alert("Preview only — this is exactly what your client sees. Approve / Request changes work on the real link, not in preview."); return; }
    setActionBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/feedback?${q}`,
        { message: changesText });
      setChangesOpen(false);
      setChangesText('');
      await refresh();
    } catch (e) {
      if (e.response?.status === 409) {
        setChangesOpen(false);
        setLockedNote(e.response.data?.message || '');
        await refresh();
      } else {
        alert(e.response?.data?.message || "We couldn't send your notes just now — please try again, or reply to our email and we'll pick it up there.");
      }
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <JpLoader size={76} label="Loading…" tone="dark" />
      </Box>
    );
  }
  if (err || !data) {
    const isExpired = errReason === 'expired';
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ ...card, p: 4, maxWidth: 480, textAlign: 'center' }}>
          <Typography sx={{ color: isExpired ? T.amber : T.text, fontWeight: 800, fontSize: 20, mb: 1 }}>
            {isExpired ? 'This approval link has expired' : 'Link unavailable'}
          </Typography>
          <Typography sx={{ color: T.muted, fontSize: 13, lineHeight: 1.55 }}>
            {isExpired
              ? "Reach out and we'll send you a fresh one — prices and details may need a quick refresh."
              : (err || "This approval link couldn't be loaded.")}
          </Typography>
        </Box>
      </Box>
    );
  }

  const mockups = data.mockups || [];
  const logo = data.logo;
  const quoteLines = p.quoteLines || [];
  const items = p.items || [];
  const itemRows = quoteLines.length > 0
    ? quoteLines.map(l => {
        // unitPrice arrives resolved from the server — the public payload
        // carries no cost/markup fields to derive from (by design: those
        // are internal margin data).
        const q    = Number(l.qty) || 0;
        const unit = Number(l.unitPrice) || 0;
        const desc = [l.styleCode, l.description, l.color, l.printType && `(${l.printType}${l.printDetails ? ' · ' + l.printDetails : ''})`]
          .filter(Boolean).join(' · ');
        return { qty: l.qty, description: desc, unitPrice: unit, lineTotal: q * unit };
      })
    : items.map(i => ({
        qty: i.qty, description: i.description,
        unitPrice: i.unitPrice,
        lineTotal: (Number(i.qty) || 0) * (Number(i.unitPrice) || 0),
      }));
  const subtotal = itemRows.reduce((s, r) => s + (Number(r.lineTotal) || 0), 0);
  const total = Number(p.totalValue) || subtotal;

  // ── Interactive quote stage ──────────────────────────────────────────────
  // Lines sharing a `group` are alternative options (3 brands of tee) — the
  // client picks ONE per group; ungrouped lines are always included. Once a
  // confirmation exists the picker retires and the confirmation review takes
  // over. Until then picks can be changed.
  const groupNames = [...new Set(quoteLines.map(l => l.group).filter(Boolean))];
  const hasGroups = groupNames.length > 0;
  const standaloneLines = quoteLines.map((l, i) => ({ ...l, idx: i })).filter(l => !l.group);
  const alreadyPicked = quoteLines.some(l => l.accepted) || !!p.optionsPickedAt;
  const stage = (p.hasConfirmation || (Array.isArray(p.confirmation?.items) && p.confirmation.items.length > 0))
    ? 'confirmation'
    : !hasGroups
      ? 'legacy'
      : approvalStatus !== 'pending'
        ? 'legacy'   // terminal decision already made — read-only table + status panel
        : ((alreadyPicked && !repicking) ? 'picked' : 'picker');

  const pickFor = (g) => {
    if (picks[g] !== undefined) return picks[g];
    const acc = quoteLines.findIndex(l => l.group === g && l.accepted);
    return acc >= 0 ? acc : undefined;
  };
  const allPicked = groupNames.every(g => pickFor(g) !== undefined);

  const submitPicks = async () => {
    if (isPreview) { alert("Preview only — this is exactly what your client sees. Picks work on the real link, not in preview."); return; }
    if (!allPicked) return;
    setPickBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/select?${q}`,
        { picks: groupNames.map(g => pickFor(g)) });
      setRepicking(false);
      await refresh();
    } catch (e) {
      if (e.response?.status === 409) {
        setLockedNote(e.response.data?.message || '');
        setRepicking(false);
        await refresh();
      } else {
        alert(e.response?.data?.message || "That didn't go through — please try again, or just reply to our email and we'll take care of it.");
      }
    } finally {
      setPickBusy(false);
    }
  };

  // Full confirmation (matches the downloadable PDF) when one's been built.
  const conf = p.confirmation || {};
  const confItems = Array.isArray(conf.items) ? conf.items : [];
  const hasConf = confItems.length > 0;
  const confTotals = computeConfTotals(conf);
  const mockupByNum = {};
  mockups.forEach(m => { const k = _norm(m.mockupNum); if (k) mockupByNum[k] = { front: m.thumbnail, back: m.back }; });
  // Per-item image: explicit snapshot → legacy single → the referenced mockup's
  // thumbnail (matched by #). Same resolution order the PDF uses, so every
  // colorway shows its own photo.
  const confItemImages = (it) => {
    const snaps = (it.mockupSnapshots || []).map(s => s && s.dataUrl).filter(Boolean);
    if (snaps.length) return snaps;
    if (it.customMockupDataUrl) return [it.customMockupDataUrl];
    const lib = it.mockupNum ? mockupByNum[_norm(it.mockupNum)] : null;
    // Back side only when the admin opted in on the item (showBack) — matches
    // the builder preview and the PDF.
    return lib ? [lib.front, it.showBack ? lib.back : null].filter(Boolean) : [];
  };

  const openLightbox = (src) => setLightbox(src);

  // Progress rail state per stage.
  const railStates =
    approvalStatus === 'approved'         ? ['done', 'done', 'done']
    : approvalStatus === 'requested_changes' ? ['done', 'current', 'todo']
    : stage === 'picker'                  ? ['current', 'todo', 'todo']
    : stage === 'picked'                  ? ['done', 'building', 'todo']
    : /* confirmation / legacy, pending */  ['done', 'current', 'todo'];

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: T.bg, color: T.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      // Subtle green aura at the top — the page glows like the brand, not flat.
      backgroundImage: `radial-gradient(120% 60% at 50% -10%, rgba(74,222,128,0.10), rgba(7,11,9,0) 60%)`,
      '@keyframes rise':      { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes railPulse': { '0%,100%': { boxShadow: `0 0 0 0 ${T.glow}` }, '50%': { boxShadow: `0 0 0 6px rgba(74,222,128,0)` } },
      '@keyframes railBlink': { '0%,100%': { opacity: 0.35 }, '50%': { opacity: 1 } },
      '@keyframes indet':     { '0%': { left: '-40%' }, '100%': { left: '100%' } },
      '@keyframes popCheck':  { '0%': { transform: 'scale(0)' }, '60%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
      '@media (prefers-reduced-motion: reduce)': { '*': { animation: 'none !important', transition: 'none !important' } },
    }}>
      {/* Owner preview ribbon — only on ?preview=1 */}
      {isPreview && (
        <Box sx={{ bgcolor: T.amber, color: '#1a1206', textAlign: 'center', py: 0.6, px: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, position: 'sticky', top: 0, zIndex: 5 }}>
          <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>
            Preview — this is exactly what your client sees. Buttons are inactive here.
          </Typography>
        </Box>
      )}

      <Box sx={{ maxWidth: 780, mx: 'auto', p: { xs: 2, md: 4 } }}>
        {/* Header — branded lockup + client / invoice / date */}
        <Box sx={{ ...card, p: { xs: 2.5, md: 3.5 }, position: 'relative', overflow: 'hidden', animation: 'rise 500ms ease both' }}>
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${T.greenDk}, ${T.green}, ${T.greenDk})` }} />
          <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
            <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt="Joint Printing"
              sx={{ width: 46, height: 46, flexShrink: 0, objectFit: 'contain',
                filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.45))' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 17, letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1 }}>
                Joint Printing
              </Typography>
            </Box>
            {logo && (
              <Box sx={{ width: 48, height: 48, p: 0.5, bgcolor: '#fff', borderRadius: 1.5, display: 'flex',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                <Box component="img" src={logo} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </Box>
            )}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={1.5}
            sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${T.line}` }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ ...eyebrow, color: T.faint, mb: 0.5 }}>Prepared for</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>
                {p.companyName || p.clientName || 'Untitled'}
              </Typography>
              {p.clientName && p.companyName && p.clientName !== p.companyName && (
                <Typography sx={{ color: T.muted, fontSize: 13, mt: 0.2 }}>{p.clientName}</Typography>
              )}
            </Box>
            {(p.orderNumber || p.orderDate) && (
              <Stack direction="row" gap={3} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                {p.orderNumber && (
                  <Box>
                    <Typography sx={{ ...eyebrow, color: T.faint, mb: 0.5 }}>Invoice</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, ...mono }}>#{p.orderNumber}</Typography>
                  </Box>
                )}
                {p.orderDate && (
                  <Box>
                    <Typography sx={{ ...eyebrow, color: T.faint, mb: 0.5 }}>Date</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                      {new Date(p.orderDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Stack>
        </Box>

        {/* Progress rail */}
        <Box sx={{ mt: 2.5, mb: 0.5, animation: 'rise 500ms ease both', animationDelay: '60ms' }}>
          <ProgressRail states={railStates} />
        </Box>

        {p.confirmationMessage && (
          <Box sx={{ ...card, mt: 2, p: 2, borderLeft: `3px solid ${T.green}` }}>
            <Typography sx={{ color: T.text, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {p.confirmationMessage}
            </Typography>
          </Box>
        )}

        {/* Mockups — only when there's no full confirmation; otherwise each
            item below shows its own photo (one per colorway), matching the PDF. */}
        {!hasConf && mockups.length > 0 && (
          <Box sx={{ ...card, p: { xs: 2.5, md: 3.5 }, mt: 2.5, animation: 'rise 500ms ease both', animationDelay: '120ms' }}>
            <Typography sx={{ ...eyebrow, mb: 1.5 }}>Your mockups</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {mockups.map((m, i) => (
                <ZoomImg key={i} src={m.thumbnail} alt={m.name} onZoom={openLightbox}
                  sx={{ aspectRatio: '4/3', bgcolor: T.inset, borderRadius: 2, border: `1px solid ${T.line}`,
                    objectFit: 'cover', transition: 'box-shadow 200ms ease, border-color 200ms ease',
                    '&:hover': { boxShadow: `0 10px 30px rgba(0,0,0,0.4)`, borderColor: T.lineHi } }} />
              ))}
            </Box>
          </Box>
        )}

        {/* ── Stage body ─────────────────────────────────────────────────── */}
        {stage === 'picker' ? (
          <Box sx={{ ...card, p: { xs: 2.5, md: 3.5 }, mt: 2.5, animation: 'rise 500ms ease both', animationDelay: '180ms' }}>
            <Typography sx={eyebrow}>Your options</Typography>
            <Typography sx={{ color: T.muted, fontSize: 13.5, mt: 0.75, mb: 3, lineHeight: 1.6 }}>
              Pick one for each product — every price already includes printing and shipping. Locking in your
              picks also signs off the designs shown; if anything needs a tweak first, hit &ldquo;Ask a question&rdquo;.
            </Typography>
            {groupNames.map((g, gi) => (
              <Box key={g} sx={{ mb: 3.5 }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                  <Box sx={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.green}`, color: T.green,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, ...mono }}>
                    {gi + 1}
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{g}</Typography>
                </Stack>
                <Stack gap={1.25}>
                  {quoteLines.map((l, idx) => ({ ...l, idx })).filter(l => l.group === g).map((l) => {
                    const sel = pickFor(g) === l.idx;
                    const unit = Number(l.unitPrice) || 0;
                    const desc = [l.description, l.styleCode && `(${l.styleCode})`, l.color].filter(Boolean).join(' ');
                    const detail = [l.printType, l.printDetails].filter(Boolean).join(' · ');
                    return (
                      <Box key={l.idx} onClick={() => setPicks(prev => ({ ...prev, [g]: l.idx }))}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2.5, cursor: 'pointer',
                          position: 'relative', border: `1.5px solid ${sel ? T.green : T.line}`,
                          bgcolor: sel ? T.panelHi : T.inset,
                          boxShadow: sel ? `0 0 0 3px ${T.glow}, 0 8px 24px rgba(0,0,0,0.35)` : 'none',
                          transition: 'border-color 180ms ease, background 180ms ease, box-shadow 220ms ease, transform 160ms ease',
                          '&:hover': { borderColor: sel ? T.green : 'rgba(255,255,255,0.22)', transform: 'translateY(-1px)' } }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          bgcolor: sel ? T.green : 'transparent', border: `2px solid ${sel ? T.green : 'rgba(255,255,255,0.25)'}`,
                          transition: 'all 160ms ease' }}>
                          {sel && <CheckIcon sx={{ fontSize: 15, color: '#06140c', animation: 'popCheck 240ms ease' }} />}
                        </Box>
                        {l.image && (
                          <ZoomImg src={l.image} onZoom={openLightbox} badge={false}
                            sx={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 1.5,
                              border: `1px solid ${T.line}`, bgcolor: T.inset }} />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{desc || 'Option'}</Typography>
                          {detail && <Typography sx={{ color: T.muted, fontSize: 12, mt: 0.2 }}>{detail}</Typography>}
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: 15, color: sel ? T.green : T.text, ...mono }}>
                            {money(unit)}<Typography component="span" sx={{ color: T.faint, fontSize: 11, fontWeight: 600 }}>/unit</Typography>
                          </Typography>
                          <Typography sx={{ color: T.muted, fontSize: 11, ...mono }}>
                            {Number(l.qty) || 0} units · {money((Number(l.qty) || 0) * unit)}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            ))}
            {standaloneLines.length > 0 && (
              <Box sx={{ mb: 2.5 }}>
                <Typography sx={{ ...eyebrow, color: T.faint, mb: 1 }}>Also in your order</Typography>
                {standaloneLines.map((l) => (
                  <Stack key={l.idx} direction="row" alignItems="center" gap={1.5} justifyContent="space-between"
                    sx={{ py: 1.1, borderBottom: `1px solid ${T.line}` }}>
                    {l.image && (
                      <ZoomImg src={l.image} onZoom={openLightbox} badge={false}
                        sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${T.line}`, bgcolor: T.inset }} />
                    )}
                    <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                      {[l.description, l.styleCode && `(${l.styleCode})`].filter(Boolean).join(' ')} × {Number(l.qty) || 0}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, flexShrink: 0, ...mono }}>{money((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</Typography>
                  </Stack>
                ))}
              </Box>
            )}
            {lockedNote && <LockedNote text={lockedNote} />}
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ mt: 1 }}>
              <Button fullWidth disabled={pickBusy || !allPicked} onClick={submitPicks}
                endIcon={!pickBusy && allPicked ? <ArrowForwardIcon /> : null}
                sx={{ ...primaryBtn, flex: 2 }}>
                {pickBusy ? <CircularProgress size={18} sx={{ color: '#06140c' }} />
                  : allPicked ? 'Lock in picks & approve designs' : 'Pick one option per product'}
              </Button>
              <Button fullWidth onClick={() => setChangesOpen(true)} disabled={pickBusy} sx={{ ...ghostBtn, flex: 1 }}>
                Ask a question
              </Button>
            </Stack>
          </Box>
        ) : stage === 'picked' ? (
          // ── The signature "building your confirmation" moment ──────────────
          <Box sx={{ ...card, p: { xs: 3, md: 4.5 }, mt: 2.5, textAlign: 'center', position: 'relative', overflow: 'hidden',
            animation: 'rise 500ms ease both', animationDelay: '180ms' }}>
            <JpLoader size={72} tone="dark" />
            <Typography sx={{ fontWeight: 900, fontSize: 22, mt: 1.5, letterSpacing: 0.2 }}>
              Locked in — building your confirmation
            </Typography>
            <Typography sx={{ color: T.muted, fontSize: 13.5, mt: 1, mb: 2.5, lineHeight: 1.6, maxWidth: 460, mx: 'auto' }}>
              Nice picks. We&apos;re putting your final confirmation together right now — you&apos;ll get an email
              the moment it&apos;s ready to review and approve, right here on this page.
            </Typography>
            {/* Indeterminate progress shimmer — makes the wait feel intentional */}
            <Box sx={{ position: 'relative', height: 4, borderRadius: 999, bgcolor: T.line, overflow: 'hidden', maxWidth: 320, mx: 'auto', mb: 3 }}>
              <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 999,
                background: `linear-gradient(90deg, transparent, ${T.green}, transparent)`, animation: 'indet 1.5s ease-in-out infinite' }} />
            </Box>
            <Box sx={{ maxWidth: 460, mx: 'auto', textAlign: 'left', bgcolor: T.inset, border: `1px solid ${T.line}`, borderRadius: 2, p: 2 }}>
              <Typography sx={{ ...eyebrow, color: T.faint, mb: 1 }}>What you chose</Typography>
              {quoteLines.filter(l => l.accepted || !l.group).map((l, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" gap={2} sx={{ py: 0.9, borderBottom: i < quoteLines.filter(x => x.accepted || !x.group).length - 1 ? `1px solid ${T.line}` : 'none' }}>
                  <Typography sx={{ fontSize: 13 }}>
                    {l.group ? <Box component="span" sx={{ color: T.green, fontWeight: 700 }}>{l.group}: </Box> : ''}
                    {[l.description, l.styleCode && `(${l.styleCode})`].filter(Boolean).join(' ')} × {Number(l.qty) || 0}
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, flexShrink: 0, ...mono }}>{money((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</Typography>
                </Stack>
              ))}
            </Box>
            <Button size="small" onClick={() => setRepicking(true)}
              sx={{ color: T.muted, textTransform: 'none', fontSize: 12.5, mt: 2, '&:hover': { color: T.green, bgcolor: 'transparent' } }}>
              ← Change my picks
            </Button>
          </Box>
        ) : stage === 'confirmation' ? (
          <Box sx={{ ...card, p: { xs: 2.5, md: 3.5 }, mt: 2.5, animation: 'rise 500ms ease both', animationDelay: '180ms' }}>
            <Typography sx={{ ...eyebrow, mb: 2 }}>Your order</Typography>
            <Stack gap={2}>
              {confItems.map((it, idx) => {
                const sizes = (it.sizes || []).filter(sz => Number(sz.qty) > 0);
                const itemSubtotal = sizes.reduce((s, sz) => s + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0);
                const imgs = confItemImages(it);
                return (
                  <Box key={idx} sx={{ border: `1px solid ${T.line}`, borderRadius: 2.5, p: { xs: 2, md: 2.5 }, bgcolor: T.inset }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 2, sm: 2.5 }} alignItems="flex-start">
                      {imgs.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
                          {imgs.map((src, i) => (
                            <ZoomImg key={i} src={src} onZoom={openLightbox}
                              sx={{ width: { xs: 120, sm: 140 }, height: { xs: 120, sm: 140 }, objectFit: 'cover', borderRadius: 2,
                                border: `1px solid ${T.line}`, bgcolor: T.panel,
                                transition: 'box-shadow 200ms ease, border-color 200ms ease',
                                '&:hover': { boxShadow: '0 8px 22px rgba(0,0,0,0.45)', borderColor: T.lineHi } }} />
                          ))}
                        </Box>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15.5, mb: 1.25 }}>{confItemTitle(it, idx)}</Typography>
                        {sizes.length > 0 && (
                          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                            <thead>
                              <tr>
                                {['Size', 'Qty', 'Unit price'].map((h, hi) => (
                                  <th key={h} style={{ textAlign: hi === 0 ? 'left' : 'right', fontSize: 10, textTransform: 'uppercase',
                                    letterSpacing: '0.5px', color: 'rgba(255,255,255,0.5)', padding: '5px 8px', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sizes.map((sz, i) => (
                                <tr key={i}>
                                  <td style={{ padding: '6px 8px', borderBottom: `1px solid ${T.line}`, color: T.text }}>{sz.label || '—'}</td>
                                  <td style={{ padding: '6px 8px', borderBottom: `1px solid ${T.line}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: T.text }}>{Number(sz.qty) || 0}</td>
                                  <td style={{ padding: '6px 8px', borderBottom: `1px solid ${T.line}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: T.text }}>{sz.unitPrice ? money(sz.unitPrice) : ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Box>
                        )}
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2} sx={{ mt: 1.25 }}>
                          <Typography sx={{ ...eyebrow, color: T.faint }}>Item subtotal</Typography>
                          <Typography sx={{ fontSize: 14, fontWeight: 800, ...mono }}>{money(itemSubtotal)}</Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>

            {/* Totals — recessed panel, big green grand total */}
            <Box sx={{ mt: 2.5, p: { xs: 2, md: 2.5 }, borderRadius: 2.5, bgcolor: T.inset, border: `1px solid ${T.line}` }}>
              <Stack direction="row" justifyContent="space-between" gap={4} sx={{ fontSize: 13, mb: 0.85 }}>
                <Box sx={{ color: T.muted }}>Subtotal</Box>
                <Box sx={{ minWidth: 96, textAlign: 'right', ...mono }}>{money(confTotals.itemsSubtotal)}</Box>
              </Stack>
              {confTotals.lines.map((l, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" gap={4} sx={{ fontSize: 13, mb: 0.85 }}>
                  <Box sx={{ color: T.muted }}>{l.label}</Box>
                  <Box sx={{ minWidth: 96, textAlign: 'right', ...mono }}>{money(l.value)}</Box>
                </Stack>
              ))}
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={4} sx={{ mt: 1.25, pt: 1.5, borderTop: `2px solid ${T.green}` }}>
                <Box sx={{ fontWeight: 800, fontSize: 17 }}>Total</Box>
                <Box sx={{ minWidth: 96, textAlign: 'right', fontWeight: 900, fontSize: 24, color: T.green, letterSpacing: -0.5, ...mono }}>{money(confTotals.grandTotal)}</Box>
              </Stack>
            </Box>

            {p.confirmationTerms && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${T.line}` }}>
                <Typography sx={{ ...eyebrow, color: T.faint, mb: 0.75 }}>Terms</Typography>
                <Typography sx={{ color: T.muted, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.confirmationTerms}</Typography>
              </Box>
            )}
          </Box>
        ) : (
          // Legacy / simple table fallback
          <Box sx={{ ...card, p: { xs: 2.5, md: 3.5 }, mt: 2.5, animation: 'rise 500ms ease both', animationDelay: '180ms' }}>
            <Typography sx={{ ...eyebrow, mb: 1.5 }}>Items</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Box component="table" sx={{ width: '100%', minWidth: 360, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Qty', 'Description', 'Unit $', 'Line $'].map((h, hi) => (
                      <th key={h} style={{ textAlign: hi >= 2 ? 'right' : 'left', fontSize: 10, textTransform: 'uppercase',
                        letterSpacing: '0.5px', color: 'rgba(255,255,255,0.5)', padding: '6px 8px', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemRows.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '14px 8px', color: T.faint, fontStyle: 'italic' }}>No line items</td></tr>
                  ) : itemRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: 8, borderBottom: `1px solid ${T.line}`, fontVariantNumeric: 'tabular-nums', color: T.text }}>{r.qty || ''}</td>
                      <td style={{ padding: 8, borderBottom: `1px solid ${T.line}`, color: T.text }}>{r.description || ''}</td>
                      <td style={{ padding: 8, borderBottom: `1px solid ${T.line}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: T.text }}>{r.unitPrice ? money(r.unitPrice) : ''}</td>
                      <td style={{ padding: 8, borderBottom: `1px solid ${T.line}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: T.text }}>{r.lineTotal ? money(r.lineTotal) : ''}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, borderTop: `2px solid ${T.green}`, fontSize: 16 }}>Total</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 900, borderTop: `2px solid ${T.green}`, fontSize: 18, color: T.green, fontVariantNumeric: 'tabular-nums' }}>{money(total)}</td>
                  </tr>
                </tbody>
              </Box>
            </Box>
            {p.confirmationTerms && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${T.line}` }}>
                <Typography sx={{ ...eyebrow, color: T.faint, mb: 0.75 }}>Terms</Typography>
                <Typography sx={{ color: T.muted, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.confirmationTerms}</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Action panel — locked once the client has decided. Hidden during the
            pick stage (the picker has its own actions). */}
        {(stage === 'confirmation' || stage === 'legacy' || approvalStatus !== 'pending') && (
          <Box sx={{ ...card, p: { xs: 2.5, md: 3 }, mt: 2.5, animation: 'rise 500ms ease both', animationDelay: '240ms' }}>
            {approvalStatus === 'requested_changes' ? (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Box sx={{ width: 56, height: 56, mx: 'auto', mb: 1.5, borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', bgcolor: 'rgba(251,191,36,0.14)', border: `1px solid rgba(251,191,36,0.4)` }}>
                  <EditNoteIcon sx={{ color: T.amber, fontSize: 28 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 19 }}>Thanks — we&apos;re on it.</Typography>
                <Typography sx={{ color: T.muted, fontSize: 13.5, mt: 0.75, lineHeight: 1.55 }}>
                  Your notes are with our team, and we&apos;ll get a fresh proof over to you soon.
                </Typography>
                {(p.approvalBy || p.approvalAt) && (
                  <Typography sx={{ color: T.faint, fontSize: 11, mt: 1.5 }}>
                    {p.approvalBy ? `Sent by ${p.approvalBy}` : 'Sent'}{p.approvalAt ? ` · ${new Date(p.approvalAt).toLocaleString()}` : ''}
                  </Typography>
                )}
              </Box>
            ) : approvalStatus === 'approved' ? (
              <Box sx={{ py: 1 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Box sx={{ width: 60, height: 60, mx: 'auto', mb: 1.5, borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', bgcolor: T.green, animation: 'popCheck 360ms ease both' }}>
                    <CheckIcon sx={{ color: '#06140c', fontSize: 34 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 21 }}>You&apos;re all set — thank you!</Typography>
                  <Typography sx={{ color: T.muted, fontSize: 13.5, mt: 0.75, lineHeight: 1.55 }}>
                    {p.approvalBy ? `Approved by ${p.approvalBy}. ` : ''}We&apos;ll move through the steps below and keep this page updated as each one happens.
                  </Typography>
                </Box>
                <TrackingTimeline steps={p.tracking?.steps || []} />
              </Box>
            ) : (
              <>
                <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 1 }}>Take a look whenever you&apos;re ready</Typography>
                <Typography sx={{ color: T.muted, fontSize: 13.5, mb: 2, lineHeight: 1.6 }}>
                  If everything looks good, hit approve and we&apos;ll get started. If anything needs a tweak, just send it back — we&apos;re always happy to adjust.
                </Typography>
                {lockedNote && <LockedNote text={lockedNote} />}
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  <Button onClick={handleApprove} disabled={actionBusy} endIcon={!actionBusy ? <ArrowForwardIcon /> : null}
                    startIcon={actionBusy ? <CircularProgress size={16} sx={{ color: '#06140c' }} /> : null}
                    sx={{ ...primaryBtn, flex: 1 }}>
                    Approve &amp; proceed
                  </Button>
                  <Button onClick={() => setChangesOpen(true)} disabled={actionBusy} startIcon={<EditNoteIcon />} sx={{ ...ghostBtn, flex: 1 }}>
                    Request edits
                  </Button>
                </Stack>
              </>
            )}
          </Box>
        )}

        <Typography sx={{ textAlign: 'center', color: T.faint, fontSize: 11, mt: 3, letterSpacing: 0.3 }}>
          Powered by Joint Printing · Questions? Just reply to our email.
        </Typography>
      </Box>

      <Dialog open={changesOpen} onClose={() => setChangesOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: T.panel, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Request edits</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.muted, fontSize: 13, mb: 1.5 }}>
            What would you like changed? Be as specific as you like — colors, sizes, copy, anything at all.
          </Typography>
          <TextField fullWidth multiline minRows={4} autoFocus value={changesText} onChange={e => setChangesText(e.target.value)}
            placeholder="e.g. Move the back logo up a couple inches, change shirt color to forest green, swap the hoodie sizes M → L."
            sx={darkField} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setChangesOpen(false)} sx={{ color: T.muted, textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleRequestChanges} disabled={actionBusy || !changesText.trim()} sx={primaryBtn}>
            {actionBusy ? <CircularProgress size={16} sx={{ color: '#06140c' }} /> : 'Send to team'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image lightbox */}
      <Modal open={!!lightbox} onClose={() => setLightbox(null)} aria-label="Enlarged image"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        slotProps={{ backdrop: { sx: { bgcolor: 'rgba(3,6,4,0.92)' } } }}>
        <Box onClick={() => setLightbox(null)}
          sx={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, md: 5 }, outline: 'none' }}>
          <IconButton onClick={(e) => { e.stopPropagation(); setLightbox(null); }} aria-label="Close"
            sx={{ position: 'fixed', top: { xs: 12, md: 20 }, right: { xs: 12, md: 20 }, color: '#fff',
              bgcolor: 'rgba(255,255,255,0.12)', transition: 'background 150ms ease', '&:hover': { bgcolor: 'rgba(255,255,255,0.24)' } }}>
            <CloseIcon />
          </IconButton>
          {lightbox && (
            <Box component="img" src={lightbox} alt="Enlarged image" onClick={(e) => e.stopPropagation()}
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 2, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', bgcolor: '#fff' }} />
          )}
        </Box>
      </Modal>
    </Box>
  );
}

// ── Shared button + field styles ─────────────────────────────────────────────
const primaryBtn = {
  bgcolor: T.green, color: '#06140c', fontWeight: 800, textTransform: 'none', px: 3, py: 1.25, fontSize: 14.5,
  borderRadius: 999, boxShadow: `0 6px 20px ${T.glow}`, transition: 'transform 150ms ease, box-shadow 200ms ease, background 150ms ease',
  '&:hover': { bgcolor: '#5cec8e', transform: 'translateY(-1px)', boxShadow: `0 10px 28px ${T.glow}` },
  '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.25)', color: 'rgba(6,20,12,0.5)', boxShadow: 'none' },
};
const ghostBtn = {
  color: T.text, border: `1px solid ${T.line}`, fontWeight: 700, textTransform: 'none', px: 3, py: 1.25, fontSize: 14, borderRadius: 999,
  transition: 'border-color 180ms ease, background 180ms ease',
  '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' },
};
const darkField = {
  '& .MuiOutlinedInput-root': { bgcolor: T.inset, color: T.text, borderRadius: 2,
    '& fieldset': { borderColor: T.line }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: T.green } },
  '& .MuiInputBase-input::placeholder': { color: T.faint, opacity: 1 },
};

// Small amber "someone already decided" note.
function LockedNote({ text }) {
  return (
    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)' }}>
      <Typography sx={{ color: T.amber, fontSize: 13, lineHeight: 1.5 }}>{text}</Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackingTimeline — post-approval client view of where the project is. Dark
// card, green progress meter, per-step optional carrier link.
// ─────────────────────────────────────────────────────────────────────────────
function TrackingTimeline({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  let lastDoneIdx = -1;
  steps.forEach((s, i) => { if (s.completedAt) lastDoneIdx = i; });
  const doneCount = steps.filter(s => s.completedAt).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  const fmtWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <Box sx={{ mt: 1, p: { xs: 2.5, sm: 3.5 }, bgcolor: T.inset, border: `1px solid ${T.line}`, borderRadius: 2.5, position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.greenDk}, ${T.green})` }} />
      <Stack direction="row" alignItems="center" gap={1.25} mb={1.75}>
        <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt="Joint Printing"
          sx={{ width: 30, height: 30, flexShrink: 0, objectFit: 'contain' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ ...eyebrow, color: T.faint, fontSize: 10 }}>Project status</Typography>
          <Typography sx={{ fontSize: 13, color: T.text, fontWeight: 700, mt: 0.3 }}>{doneCount} of {steps.length} steps complete</Typography>
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 900, color: T.green, letterSpacing: -0.5, ...mono }}>{progressPct}%</Typography>
      </Stack>

      <Box sx={{ height: 4, borderRadius: 999, bgcolor: T.line, overflow: 'hidden', mb: 2.5 }}>
        <Box sx={{ width: `${progressPct}%`, height: '100%', background: `linear-gradient(90deg, ${T.greenDk}, ${T.green})`, transition: 'width 0.5s ease' }} />
      </Box>

      <Box sx={{ position: 'relative', pl: 0.5 }}>
        {steps.map((s, i) => {
          const done = !!s.completedAt;
          const isLast = i === steps.length - 1;
          const connectorActive = i < lastDoneIdx;
          return (
            <Box key={s.id || i} sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative', pb: isLast ? 0 : 2.25 }}>
              {!isLast && (
                <Box sx={{ position: 'absolute', left: 11, top: 22, bottom: -2, width: 2,
                  bgcolor: connectorActive ? T.green : T.line, transition: 'background 0.4s ease' }} />
              )}
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, zIndex: 1, bgcolor: done ? T.green : T.panel,
                border: done ? `2px solid ${T.green}` : `2px solid ${T.line}`, color: done ? '#06140c' : T.faint, transition: 'all 0.3s ease' }}>
                {done ? <CheckIcon sx={{ fontSize: 15 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} />}
              </Box>
              <Box sx={{ ml: 1.75, flex: 1, pt: 0.15, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: done ? 700 : 600, color: done ? T.text : T.muted, lineHeight: 1.3 }}>{s.label}</Typography>
                <Typography sx={{ fontSize: 11, mt: 0.25, color: done ? T.green : T.faint, fontWeight: done ? 600 : 400 }}>
                  {done ? fmtWhen(s.completedAt) : 'Pending'}
                </Typography>
                {done && s.note && <Typography sx={{ fontSize: 11.5, color: T.muted, mt: 0.3, lineHeight: 1.4 }}>{s.note}</Typography>}
                {s.link && /^https?:\/\//i.test(s.link) && (
                  <Box component="a" href={s.link} target="_blank" rel="noopener noreferrer"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.6, px: 1.2, py: 0.35, borderRadius: 999,
                      bgcolor: 'rgba(74,222,128,0.12)', color: T.green, textDecoration: 'none', fontSize: 11, fontWeight: 700,
                      border: `1px solid ${T.lineHi}`, transition: 'background 0.15s ease, transform 0.15s ease',
                      '&:hover': { bgcolor: 'rgba(74,222,128,0.22)', transform: 'translateY(-1px)' } }}>
                    Track shipment →
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {doneCount < steps.length && (
        <Typography sx={{ mt: 2.5, pt: 1.5, borderTop: `1px solid ${T.line}`, fontSize: 11, color: T.faint, textAlign: 'center', lineHeight: 1.5 }}>
          We update this page as each step happens — usually within a day of the milestone.
        </Typography>
      )}
    </Box>
  );
}
