// src/screens/ApprovalView.js
// Public, token-gated approval surface that clients open from a link sent
// by the Order Tracker. They see mockups + the quote, then either approve
// or request changes with a note. Backend logs the event.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Stack, Typography, Button, TextField, CircularProgress, Dialog,
  DialogTitle, DialogContent, DialogActions, Modal, IconButton,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import axios from 'axios';
import config from '../config.json';
import jpLogoColored from '../modules/images/logo_colored.webp';
import JpLoader from '../common/JpLoader';

const COLORS = {
  bg:     '#f6f6f4',
  panel:  '#ffffff',
  text:   '#111111',
  muted:  '#666666',
  border: '#e6e6e0',
  brand:  '#1a3d2b',
  brandH: '#4ade80',
};

// Shared card styling so every panel reads with the same soft border, radius
// and shadow — keeps the page feeling like one calm document.
const CARD = {
  bgcolor: COLORS.panel,
  borderRadius: 3,
  border: `1px solid ${COLORS.border}`,
  boxShadow: '0 1px 2px rgba(17,17,17,0.04), 0 6px 20px rgba(17,17,17,0.05)',
};

const SECTION_LABEL = {
  fontSize: 11,
  color: COLORS.muted,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

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
// lift and a small magnifier badge so it reads as "tap to enlarge". onZoom is
// the page-level lightbox opener; sizing/extra styles come through sx.
function ZoomImg({ src, alt = '', onZoom, sx = {}, badge = true }) {
  if (!src) return null;
  return (
    <Box
      sx={{
        position: 'relative',
        flexShrink: 0,
        cursor: 'zoom-in',
        borderRadius: 'inherit',
        overflow: 'hidden',
        ...sx,
        '& img': { display: 'block', width: '100%', height: '100%', objectFit: 'inherit' },
        '&:hover .zoom-badge': { opacity: 1 },
        '&:hover img': { transform: 'scale(1.04)' },
        '& img.zimg': { transition: 'transform 200ms ease' },
      }}
      onClick={(e) => { e.stopPropagation(); onZoom && onZoom(src); }}
      role="button"
      tabIndex={0}
      aria-label="Enlarge image"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onZoom && onZoom(src); } }}
    >
      <Box
        component="img"
        className="zimg"
        src={src}
        alt={alt}
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        sx={{ width: '100%', height: '100%' }}
      />
      {badge && (
        <Box
          className="zoom-badge"
          sx={{
            position: 'absolute', bottom: 6, right: 6,
            width: 24, height: 24, borderRadius: '50%',
            bgcolor: 'rgba(17,17,17,0.6)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 180ms ease', pointerEvents: 'none',
          }}
        >
          <ZoomInIcon sx={{ fontSize: 15 }} />
        </Box>
      )}
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
      <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <JpLoader size={72} label="Loading…" tone="light" />
      </Box>
    );
  }
  if (err || !data) {
    const isExpired = errReason === 'expired';
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ ...CARD, p: 4, maxWidth: 480, textAlign: 'center' }}>
          <Typography sx={{ color: isExpired ? '#b45309' : COLORS.text, fontWeight: 800, fontSize: 20, mb: 1 }}>
            {isExpired ? 'This approval link has expired' : 'Link unavailable'}
          </Typography>
          <Typography sx={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.55 }}>
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, color: COLORS.text, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <Box sx={{ maxWidth: 820, mx: 'auto', p: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Box sx={{ ...CARD, p: { xs: 2.5, md: 4 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            gap={2}
          >
            {logo && (
              <Box sx={{ width: 56, height: 56, p: 0.5, bgcolor: '#fff', border: `1px solid ${COLORS.border}`,
                borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                <Box component="img" src={logo} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box component="img" src={jpLogoColored} alt="Joint Printing"
                sx={{ maxHeight: 52, maxWidth: 240, display: 'block' }} />
            </Box>
          </Stack>

          {/* Clean info row: client on the left, invoice/date on the right.
              Project # stays hidden (internal handle); invoice # + order date
              are the things the client actually references with questions. */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
            gap={1.5}
            sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${COLORS.border}` }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ ...SECTION_LABEL, mb: 0.4 }}>Client</Typography>
              <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>
                {p.companyName || p.clientName || 'Untitled'}
              </Typography>
              {p.clientName && p.companyName && p.clientName !== p.companyName && (
                <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.2 }}>{p.clientName}</Typography>
              )}
            </Box>
            {(p.orderNumber || p.orderDate) && (
              <Stack
                direction="row"
                gap={3}
                sx={{ textAlign: { xs: 'left', sm: 'right' } }}
              >
                {p.orderNumber && (
                  <Box>
                    <Typography sx={{ ...SECTION_LABEL, mb: 0.4 }}>Invoice</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>#{p.orderNumber}</Typography>
                  </Box>
                )}
                {p.orderDate && (
                  <Box>
                    <Typography sx={{ ...SECTION_LABEL, mb: 0.4 }}>Date</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                      {new Date(p.orderDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Stack>

          {p.confirmationMessage && (
            <Box sx={{ mt: 2.5, p: 1.75, borderLeft: `3px solid ${COLORS.brandH}`, bgcolor: '#f6fef9', borderRadius: '0 6px 6px 0' }}>
              <Typography sx={{ color: '#333', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {p.confirmationMessage}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Mockups — only when there's no full confirmation; otherwise each
            item below shows its own photo (one per colorway), matching the PDF. */}
        {!hasConf && mockups.length > 0 && (
          <Box sx={{ ...CARD, p: { xs: 2.5, md: 4 }, mt: 2.5 }}>
            <Typography sx={{ ...SECTION_LABEL, mb: 1.5 }}>Mockups</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {mockups.map((m, i) => (
                <ZoomImg
                  key={i}
                  src={m.thumbnail}
                  alt={m.name}
                  onZoom={openLightbox}
                  sx={{
                    aspectRatio: '4/3', bgcolor: '#f4f4f4', borderRadius: 2,
                    border: `1px solid ${COLORS.border}`, objectFit: 'cover',
                    transition: 'box-shadow 180ms ease',
                    '&:hover': { boxShadow: '0 6px 18px rgba(17,17,17,0.10)' },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Order details — the full confirmation (matches the downloadable PDF)
            when one's been built; otherwise the simpler quote table. */}
        {stage === 'picker' ? (
          <Box sx={{ ...CARD, p: { xs: 2.5, md: 4 }, mt: 2.5 }}>
            <Typography sx={SECTION_LABEL}>Your options</Typography>
            <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.5, mb: 2.5, lineHeight: 1.55 }}>
              Pick one option for each product below — all pricing includes printing and shipping.
              Locking in your picks also signs off the designs shown; if anything needs a tweak first,
              use &ldquo;Ask a question&rdquo; below.
            </Typography>
            {groupNames.map((g) => (
              <Box key={g} sx={{ mb: 3 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1 }}>{g}</Typography>
                <Stack gap={1.25}>
                  {quoteLines.map((l, idx) => ({ ...l, idx })).filter(l => l.group === g).map((l) => {
                    const sel = pickFor(g) === l.idx;
                    const unit = Number(l.unitPrice) || 0;
                    const desc = [l.description, l.styleCode && `(${l.styleCode})`, l.color].filter(Boolean).join(' ');
                    const detail = [l.printType, l.printDetails].filter(Boolean).join(' · ');
                    return (
                      <Box key={l.idx} onClick={() => setPicks(prev => ({ ...prev, [g]: l.idx }))}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2,
                          cursor: 'pointer', border: `2px solid ${sel ? COLORS.brandH : COLORS.border}`,
                          bgcolor: sel ? '#f4fdf7' : '#fff',
                          transition: 'border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
                          '&:hover': { borderColor: sel ? COLORS.brandH : '#cfcfc7', boxShadow: '0 2px 10px rgba(17,17,17,0.05)' } }}>
                        {sel
                          ? <CheckCircleOutlineIcon sx={{ color: COLORS.brand, fontSize: 22, flexShrink: 0 }} />
                          : <RadioButtonUncheckedIcon sx={{ color: '#c9c9c2', fontSize: 22, flexShrink: 0 }} />}
                        {l.image && (
                          <ZoomImg
                            src={l.image}
                            onZoom={openLightbox}
                            badge={false}
                            sx={{
                              width: 56, height: 56, objectFit: 'cover', borderRadius: 1.5,
                              border: `1px solid ${COLORS.border}`, bgcolor: '#f4f4f4',
                            }}
                          />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{desc || 'Option'}</Typography>
                          {detail && <Typography sx={{ color: COLORS.muted, fontSize: 12 }}>{detail}</Typography>}
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: 14, color: COLORS.brand }}>
                            {money(unit)}<Typography component="span" sx={{ color: COLORS.muted, fontSize: 11, fontWeight: 500 }}>/unit</Typography>
                          </Typography>
                          <Typography sx={{ color: COLORS.muted, fontSize: 11 }}>
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
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1 }}>Also in your order</Typography>
                {standaloneLines.map((l) => (
                  <Stack key={l.idx} direction="row" alignItems="center" gap={1.5} justifyContent="space-between" sx={{ py: 1, borderBottom: `1px solid ${COLORS.border}` }}>
                    {l.image && (
                      <ZoomImg
                        src={l.image}
                        onZoom={openLightbox}
                        badge={false}
                        sx={{
                          width: 44, height: 44, objectFit: 'cover', borderRadius: 1.5,
                          border: `1px solid ${COLORS.border}`, bgcolor: '#f4f4f4',
                        }}
                      />
                    )}
                    <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                      {[l.description, l.styleCode && `(${l.styleCode})`].filter(Boolean).join(' ')} × {Number(l.qty) || 0}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{money((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</Typography>
                  </Stack>
                ))}
              </Box>
            )}
            {lockedNote && (
              <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: '#fff8e1', border: '1px solid #fde68a' }}>
                <Typography sx={{ color: '#92400e', fontSize: 13, lineHeight: 1.5 }}>{lockedNote}</Typography>
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
              <Button fullWidth disabled={pickBusy || !allPicked} onClick={submitPicks} variant="contained"
                sx={{ bgcolor: COLORS.brand, color: '#fff', fontWeight: 800, textTransform: 'none',
                  px: 3, py: 1.2, fontSize: 14, flex: 2, borderRadius: 2, transition: 'background 180ms ease', '&:hover': { bgcolor: '#16352a' } }}>
                {pickBusy ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                  : allPicked ? 'Lock in picks & approve designs' : 'Pick one option per product'}
              </Button>
              <Button fullWidth onClick={() => setChangesOpen(true)} disabled={pickBusy}
                sx={{ color: COLORS.text, border: `1px solid ${COLORS.border}`, fontWeight: 700,
                  textTransform: 'none', px: 3, py: 1.2, fontSize: 14, flex: 1, borderRadius: 2,
                  transition: 'border-color 180ms ease, background 180ms ease',
                  '&:hover': { borderColor: COLORS.text, bgcolor: '#fafaf8' } }}>
                Ask a question
              </Button>
            </Stack>
          </Box>
        ) : stage === 'picked' ? (
          <Box sx={{ ...CARD, p: { xs: 2.5, md: 4 }, mt: 2.5, textAlign: 'center' }}>
            <CheckCircleOutlineIcon sx={{ color: COLORS.brandH, fontSize: 36, mb: 0.5 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Got your picks — thank you!</Typography>
            <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.5, mb: 2.5, lineHeight: 1.55 }}>
              We&apos;re putting your confirmation page together now. You&apos;ll get an email when it&apos;s ready to review and approve right here.
            </Typography>
            <Box sx={{ maxWidth: 440, mx: 'auto', textAlign: 'left', mb: 2 }}>
              {quoteLines.filter(l => l.accepted || !l.group).map((l, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" gap={2} sx={{ py: 1, borderBottom: `1px solid ${COLORS.border}` }}>
                  <Typography sx={{ fontSize: 13 }}>
                    {l.group ? `${l.group}: ` : ''}{[l.description, l.styleCode && `(${l.styleCode})`].filter(Boolean).join(' ')} × {Number(l.qty) || 0}
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{money((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</Typography>
                </Stack>
              ))}
            </Box>
            <Button size="small" onClick={() => setRepicking(true)}
              sx={{ color: COLORS.muted, textTransform: 'none', fontSize: 12, textDecoration: 'underline' }}>
              Change my picks
            </Button>
          </Box>
        ) : stage === 'confirmation' ? (
          <Box sx={{ ...CARD, p: { xs: 2.5, md: 4 }, mt: 2.5 }}>
            <Typography sx={{ ...SECTION_LABEL, mb: 2 }}>Order details</Typography>
            <Stack gap={2}>
              {confItems.map((it, idx) => {
                const sizes = (it.sizes || []).filter(sz => Number(sz.qty) > 0);
                const itemSubtotal = sizes.reduce((s, sz) => s + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0);
                const imgs = confItemImages(it);
                return (
                  <Box
                    key={idx}
                    sx={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 2.5,
                      p: { xs: 2, md: 2.5 },
                      bgcolor: '#fcfcfb',
                    }}
                  >
                    {/* image(s) left, details right; stacks under ~600px */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 2, sm: 2.5 }} alignItems="flex-start">
                      {imgs.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
                          {imgs.map((src, i) => (
                            <ZoomImg
                              key={i}
                              src={src}
                              onZoom={openLightbox}
                              sx={{
                                width: { xs: 120, sm: 140 }, height: { xs: 120, sm: 140 },
                                objectFit: 'cover', borderRadius: 2,
                                border: `1px solid ${COLORS.border}`, bgcolor: '#f4f4f4',
                                transition: 'box-shadow 180ms ease',
                                '&:hover': { boxShadow: '0 6px 16px rgba(17,17,17,0.10)' },
                              }}
                            />
                          ))}
                        </Box>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.25 }}>{confItemTitle(it, idx)}</Typography>
                        {sizes.length > 0 && (
                          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left',  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Size</th>
                                <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Qty</th>
                                <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Unit price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sizes.map((sz, i) => (
                                <tr key={i}>
                                  <td style={{ padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>{sz.label || '—'}</td>
                                  <td style={{ padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(sz.qty) || 0}</td>
                                  <td style={{ padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sz.unitPrice ? money(sz.unitPrice) : ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Box>
                        )}
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2} sx={{ mt: 1.25 }}>
                          <Typography sx={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Item subtotal</Typography>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(itemSubtotal)}</Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>

            {/* Totals block — calm, clearly hierarchized, big final number. */}
            <Box sx={{ mt: 2.5, p: { xs: 2, md: 2.5 }, borderRadius: 2.5, bgcolor: '#f6f6f4', border: `1px solid ${COLORS.border}` }}>
              <Stack direction="row" justifyContent="space-between" gap={4} sx={{ fontSize: 13, mb: 0.75 }}>
                <Box sx={{ color: COLORS.muted }}>Subtotal</Box>
                <Box sx={{ minWidth: 96, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(confTotals.itemsSubtotal)}</Box>
              </Stack>
              {confTotals.lines.map((l, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" gap={4} sx={{ fontSize: 13, mb: 0.75 }}>
                  <Box sx={{ color: COLORS.muted }}>{l.label}</Box>
                  <Box sx={{ minWidth: 96, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(l.value)}</Box>
                </Stack>
              ))}
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={4} sx={{ mt: 1.25, pt: 1.5, borderTop: `2px solid ${COLORS.brand}` }}>
                <Box sx={{ fontWeight: 800, fontSize: 17 }}>Total</Box>
                <Box sx={{ minWidth: 96, textAlign: 'right', fontWeight: 800, fontSize: 22, color: COLORS.brand, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>{money(confTotals.grandTotal)}</Box>
              </Stack>
            </Box>

            {p.confirmationTerms && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${COLORS.border}` }}>
                <Typography sx={{ ...SECTION_LABEL, mb: 0.75 }}>Terms</Typography>
                <Typography sx={{ color: COLORS.muted, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{p.confirmationTerms}</Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ ...CARD, p: { xs: 2.5, md: 4 }, mt: 2.5 }}>
            <Typography sx={{ ...SECTION_LABEL, mb: 1.5 }}>Items</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Box component="table" sx={{ width: '100%', minWidth: 360, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left',  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Qty</th>
                    <th style={{ textAlign: 'left',  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Description</th>
                    <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Unit $</th>
                    <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.muted, padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Line $</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '14px 8px', color: '#999', fontStyle: 'italic' }}>
                      No line items
                    </td></tr>
                  ) : itemRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}`, fontVariantNumeric: 'tabular-nums' }}>{r.qty || ''}</td>
                      <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>{r.description || ''}</td>
                      <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.unitPrice ? money(r.unitPrice) : ''}</td>
                      <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.lineTotal ? money(r.lineTotal) : ''}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, borderTop: `2px solid ${COLORS.brand}`, fontSize: 16 }}>Total</td>
                    <td          style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, borderTop: `2px solid ${COLORS.brand}`, fontSize: 16, color: COLORS.brand, fontVariantNumeric: 'tabular-nums' }}>{money(total)}</td>
                  </tr>
                </tbody>
              </Box>
            </Box>
            {p.confirmationTerms && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${COLORS.border}` }}>
                <Typography sx={{ ...SECTION_LABEL, mb: 0.75 }}>Terms</Typography>
                <Typography sx={{ color: COLORS.muted, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {p.confirmationTerms}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Action panel — locked once the client has either approved OR
            requested changes, so the link stays consistent on every reload.
            Hidden during the pick stage (the picker has its own actions). */}
        {(stage === 'confirmation' || stage === 'legacy' || approvalStatus !== 'pending') && (
        <Box sx={{ ...CARD, p: { xs: 2.5, md: 3 }, mt: 2.5 }}>
          {approvalStatus === 'requested_changes' ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <EditNoteIcon sx={{ color: '#fbbf24', fontSize: 40, mb: 1 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Thanks — we&apos;re on it.</Typography>
              <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.5 }}>
                Your notes are with our team, and we&apos;ll get a fresh proof over to you soon.
              </Typography>
              {(p.approvalBy || p.approvalAt) && (
                <Typography sx={{ color: COLORS.muted, fontSize: 11, mt: 1.5 }}>
                  {p.approvalBy ? `Sent by ${p.approvalBy}` : 'Sent'}{p.approvalAt ? ` · ${new Date(p.approvalAt).toLocaleString()}` : ''}
                </Typography>
              )}
            </Box>
          ) : approvalStatus === 'approved' ? (
            <Box sx={{ py: 1 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <CheckCircleOutlineIcon sx={{ color: COLORS.brandH, fontSize: 36, mb: 0.5 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 18 }}>You&apos;re all set — thank you!</Typography>
                <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.5 }}>
                  {p.approvalBy ? `Approved by ${p.approvalBy}. ` : ''}We&apos;ll move through the steps below and keep this page updated as each one happens.
                </Typography>
              </Box>
              <TrackingTimeline steps={p.tracking?.steps || []} colors={COLORS} />
            </Box>
          ) : (
            <>
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1 }}>Take a look whenever you&apos;re ready</Typography>
              <Typography sx={{ color: COLORS.muted, fontSize: 13, mb: 2, lineHeight: 1.55 }}>
                If everything looks good, hit approve and we&apos;ll get started. If anything needs a tweak, just send it back — we&apos;re always happy to adjust.
              </Typography>
              {lockedNote && (
                <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: '#fff8e1', border: '1px solid #fde68a' }}>
                  <Typography sx={{ color: '#92400e', fontSize: 13, lineHeight: 1.5 }}>{lockedNote}</Typography>
                </Box>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                <Button onClick={handleApprove} disabled={actionBusy}
                  startIcon={actionBusy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CheckCircleOutlineIcon />}
                  sx={{ bgcolor: COLORS.brand, color: '#fff', fontWeight: 700, textTransform: 'none',
                    px: 3, py: 1.2, fontSize: 14, flex: 1, borderRadius: 2, transition: 'background 180ms ease',
                    '&:hover': { bgcolor: '#16352a' } }}>
                  Approve & proceed
                </Button>
                <Button onClick={() => setChangesOpen(true)} disabled={actionBusy}
                  startIcon={<EditNoteIcon />}
                  variant="outlined"
                  sx={{ borderColor: COLORS.border, color: COLORS.text, fontWeight: 700,
                    textTransform: 'none', px: 3, py: 1.2, fontSize: 14, flex: 1, borderRadius: 2,
                    transition: 'border-color 180ms ease, background 180ms ease',
                    '&:hover': { borderColor: COLORS.text, bgcolor: '#fafaf8' } }}>
                  Request edits
                </Button>
              </Stack>
            </>
          )}
        </Box>
        )}
      </Box>

      <Dialog open={changesOpen} onClose={() => setChangesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Request edits</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: COLORS.muted, fontSize: 13, mb: 1.5 }}>
            What would you like changed? Be as specific as you like — colors, sizes, copy, anything at all.
          </Typography>
          <TextField fullWidth multiline minRows={4} autoFocus
            value={changesText} onChange={e => setChangesText(e.target.value)}
            placeholder="e.g. Move the back logo up a couple inches, change shirt color to forest green, swap the hoodie sizes M → L." />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setChangesOpen(false)} sx={{ color: COLORS.muted, textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleRequestChanges} disabled={actionBusy || !changesText.trim()}
            variant="contained"
            sx={{ bgcolor: COLORS.brand, color: '#fff', textTransform: 'none', fontWeight: 700,
              '&:hover': { bgcolor: '#16352a' } }}>
            {actionBusy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Send to team'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image lightbox — full-screen dimmed backdrop with the enlarged image
          centered. Closes on backdrop click, the X, or Esc (Modal handles Esc
          + focus trapping). No external library. */}
      <Modal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        aria-label="Enlarged image"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        slotProps={{ backdrop: { sx: { bgcolor: 'rgba(17,17,17,0.88)' } } }}
      >
        <Box
          onClick={() => setLightbox(null)}
          sx={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            p: { xs: 2, md: 5 }, outline: 'none',
          }}
        >
          <IconButton
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Close"
            sx={{
              position: 'fixed', top: { xs: 12, md: 20 }, right: { xs: 12, md: 20 },
              color: '#fff', bgcolor: 'rgba(255,255,255,0.12)',
              transition: 'background 150ms ease',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.24)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {lightbox && (
            <Box
              component="img"
              src={lightbox}
              alt="Enlarged image"
              onClick={(e) => e.stopPropagation()}
              sx={{
                maxWidth: '100%', maxHeight: '100%',
                objectFit: 'contain', borderRadius: 2,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                bgcolor: '#fff',
              }}
            />
          )}
        </Box>
      </Modal>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackingTimeline — post-approval client view of where the project is.
// Renders inside a styled card with the JP brand mark at the top so the
// post-approval page doesn't read as empty. Includes a top progress meter
// (X of Y steps complete) and a per-step optional carrier link the admin can
// attach from the Order Tracker (rendered as a "Track shipment →" button).
// ─────────────────────────────────────────────────────────────────────────────
function TrackingTimeline({ steps, colors, logo }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  // Find the index of the last completed step so the connector colors up to it.
  let lastDoneIdx = -1;
  steps.forEach((s, i) => { if (s.completedAt) lastDoneIdx = i; });
  const doneCount = steps.filter(s => s.completedAt).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  const fmtWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  return (
    <Box sx={{
      mt: 1, p: { xs: 2.5, sm: 3.5 },
      bgcolor: '#fafaf7',
      border: `1px solid ${colors.border}`,
      borderRadius: 2,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle brand stripe at the top so the card has a tiny accent without
          shouting. */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${colors.brand} 0%, ${colors.brandH} 100%)`,
      }} />

      {/* Header: small mark + "Project status" label + progress count */}
      <Stack direction="row" alignItems="center" gap={1.25} mb={1.75}>
        <Box sx={{
          width: 28, height: 28, borderRadius: 1,
          bgcolor: colors.brand, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontWeight: 800, fontSize: 13, letterSpacing: 0.5,
        }}>
          JP
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontSize: 11, color: colors.muted, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 1,
          }}>
            Project status
          </Typography>
          <Typography sx={{ fontSize: 13, color: colors.text, fontWeight: 700, mt: 0.3 }}>
            {doneCount} of {steps.length} steps complete
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: colors.brand, letterSpacing: -0.5 }}>
          {progressPct}%
        </Typography>
      </Stack>

      {/* Slim progress bar — visual reinforcement of the % count. */}
      <Box sx={{
        height: 4, borderRadius: 999, bgcolor: colors.border,
        overflow: 'hidden', mb: 2.5,
      }}>
        <Box sx={{
          width: `${progressPct}%`, height: '100%',
          background: `linear-gradient(90deg, ${colors.brand} 0%, ${colors.brandH} 100%)`,
          transition: 'width 0.5s ease',
        }} />
      </Box>

      {/* Steps */}
      <Box sx={{ position: 'relative', pl: 0.5 }}>
        {steps.map((s, i) => {
          const done = !!s.completedAt;
          const isLast = i === steps.length - 1;
          const connectorActive = i < lastDoneIdx;
          return (
            <Box key={s.id || i} sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative', pb: isLast ? 0 : 2.25 }}>
              {!isLast && (
                <Box sx={{
                  position: 'absolute', left: 11, top: 22, bottom: -2, width: 2,
                  bgcolor: connectorActive ? colors.brandH : colors.border,
                  transition: 'background 0.4s ease',
                }} />
              )}
              <Box sx={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, zIndex: 1,
                bgcolor: done ? colors.brandH : '#fff',
                border: done ? `2px solid ${colors.brandH}` : `2px solid ${colors.border}`,
                color: done ? '#fff' : colors.muted,
                transition: 'all 0.3s ease',
              }}>
                {done
                  ? <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                  : <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} />}
              </Box>
              <Box sx={{ ml: 1.75, flex: 1, pt: 0.15, minWidth: 0 }}>
                <Typography sx={{
                  fontSize: 14, fontWeight: done ? 700 : 600,
                  color: done ? colors.text : colors.muted,
                  lineHeight: 1.3,
                }}>
                  {s.label}
                </Typography>
                <Typography sx={{
                  fontSize: 11, mt: 0.25,
                  color: done ? colors.brand : colors.muted,
                  fontWeight: done ? 600 : 400,
                }}>
                  {done ? fmtWhen(s.completedAt) : 'Pending'}
                </Typography>
                {done && s.note && (
                  <Typography sx={{ fontSize: 11.5, color: colors.muted, mt: 0.3, lineHeight: 1.4 }}>
                    {s.note}
                  </Typography>
                )}
                {/* Optional carrier / tracking link — admin attaches a URL on
                    a step (typically "Blanks shipping" or "On the way to you")
                    and we surface it as a clear, clickable pill here. */}
                {s.link && /^https?:\/\//i.test(s.link) && (
                  <Box
                    component="a" href={s.link} target="_blank" rel="noopener noreferrer"
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      mt: 0.6, px: 1.2, py: 0.35, borderRadius: 999,
                      bgcolor: 'rgba(74,222,128,0.12)',
                      color: colors.brand, textDecoration: 'none',
                      fontSize: 11, fontWeight: 700,
                      border: `1px solid ${colors.brandH}`,
                      transition: 'background 0.15s ease, transform 0.15s ease',
                      '&:hover': {
                        bgcolor: 'rgba(74,222,128,0.22)',
                        transform: 'translateY(-1px)',
                      },
                    }}>
                    Track shipment →
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Tiny footer reassurance — only when there's still work to do */}
      {doneCount < steps.length && (
        <Typography sx={{
          mt: 2.5, pt: 1.5, borderTop: `1px solid ${colors.border}`,
          fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 1.5,
        }}>
          We update this page as each step happens — usually within a day of the milestone.
          {logo ? '' : ' Questions? Reply to the email we sent you.'}
        </Typography>
      )}
    </Box>
  );
}
