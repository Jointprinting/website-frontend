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
  DialogTitle, DialogContent, DialogActions, Modal, IconButton, Collapse,
  useMediaQuery, useTheme,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import axios from 'axios';
import config from '../config.json';
import { detectGridRows } from '../common/quoteGrid';
import JpLoader from '../common/JpLoader';
import ConfirmationDocument, { computeConfTotals, hasBakedPaymentFee } from './ConfirmationDocument';

// Processing-fee rates by payment method (decimals) — mirrors the backend
// Order.PAYMENT_FEES single source of truth. Shown to the client for
// transparency; it never changes the owner's stored confirmation total.
const PAY_FEES = { cc: 0.0299, ach: 0.01 };

// ── Brand tokens — light + dark. The client can flip the whole page (the owner
// found the dark read "murky", so both are offered and the choice persists).
// The key set matches ConfirmationDocument's DOC so the SAME tokens theme both
// the picker and the confirmation document. `onAccent` = text on a green fill. ─
export const TOKENS = {
  dark: {
    bg:      '#0b1210',                    // lifted near-black canvas (was murky at #070b09)
    panel:   '#111c17',                    // elevated, green-tinted dark panel
    panelHi: '#16241d',                    // hover / selected panel
    inset:   '#0d1712',                    // recessed (tables, totals)
    line:    'rgba(255,255,255,0.09)',     // hairline
    lineHi:  'rgba(74,222,128,0.45)',      // active green border
    green:   '#4ade80',                    // lime accent (also legible as text on dark)
    greenDk: '#0e3b22',                    // deep green (gradients)
    glow:    'rgba(74,222,128,0.22)',
    text:    '#f3f7f4',
    muted:   'rgba(255,255,255,0.60)',
    faint:   'rgba(255,255,255,0.40)',
    amber:   '#fbbf24',
    onAccent:'#06140c',                    // near-black text on a green fill
    aura:    'rgba(74,222,128,0.10)',      // top-of-page glow
    shadow:  '0 24px 60px rgba(0,0,0,0.55)',
  },
  light: {
    bg:      '#f4f7f4',                    // soft off-white, faint green bias
    panel:   '#ffffff',
    panelHi: '#edf5ef',                    // hover / selected
    inset:   '#f1f6f2',                    // recessed
    line:    'rgba(9,28,18,0.12)',
    lineHi:  'rgba(21,128,61,0.55)',
    green:   '#15803d',                    // deep green — legible as text/accent on white
    greenDk: '#bfe8cd',                    // pale green (light-mode gradients)
    glow:    'rgba(21,128,61,0.16)',
    text:    '#0c1a12',
    muted:   'rgba(9,28,18,0.64)',
    faint:   'rgba(9,28,18,0.46)',
    amber:   '#b45309',
    onAccent:'#ffffff',                    // white text on the deep-green fill
    aura:    'rgba(21,128,61,0.10)',
    shadow:  '0 24px 50px rgba(11,30,20,0.15)',
  },
};

export const sxCard = (T) => ({ bgcolor: T.panel, border: `1px solid ${T.line}`, borderRadius: 3 });
export const sxEyebrow = (T) => ({ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: T.green });
export const mono = { fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const _norm = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();

// NOTE: the confirmation document (header, items, sizes, per-location tax,
// totals) and ALL of its money math now live in the shared ConfirmationDocument
// component (./ConfirmationDocument), which this page and the owner's builder
// preview both render — so the two are byte-identical (Nate's WYSIWYG ask) and
// the per-location-tax / double-tax-guard / roundCents logic exists in exactly
// one place. The helpers that used to live here moved there.

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
function ProgressRail({ states, T }) {
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
                color: done ? T.onAccent : (active ? T.green : T.faint),
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
  const theme = useTheme();
  // Full-screen the "Request edits" dialog on phones so the note field is
  // usable instead of cramped into a centered card. Desktop (sm+) unchanged.
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down('sm'));
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
  const [payMethod, setPayMethod] = useState('');   // '' | 'cc' | 'ach' — client's payment choice
  const [repicking, setRepicking] = useState(false); // client reopened the picker to change selections
  const [lightbox, setLightbox] = useState(null);    // enlarged image src, or null when closed
  const [detailsOpen, setDetailsOpen] = useState(false); // paid state: the "Order details" disclosure

  // Light / dark — the owner found the dark "murky", so the client can flip it.
  // Persisted per browser; first visit follows the OS preference, defaulting to
  // the brand dark.
  const [mode, setMode] = useState(() => {
    try {
      const saved = window.localStorage.getItem('jpw-approve-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch (_) { /* SSR / privacy mode — fall through */ }
    return 'dark';
  });
  const toggleMode = () => setMode((m) => {
    const next = m === 'dark' ? 'light' : 'dark';
    try { window.localStorage.setItem('jpw-approve-theme', next); } catch (_) { /* ignore */ }
    return next;
  });
  const T = TOKENS[mode] || TOKENS.dark;
  // Theme-derived shared styles (re-computed when the client flips the toggle).
  const card = sxCard(T);
  const eyebrow = sxEyebrow(T);
  const primaryBtn = sxPrimaryBtn(T);
  const ghostBtn = sxGhostBtn(T);
  const darkField = sxField(T);

  // Derived from the server's approvalStatus so reopening the link shows the
  // same locked state for the client every time.
  const p = data?.project || {};
  const approvalStatus = p.approvalStatus || 'pending';   // 'pending' | 'approved' | 'requested_changes'
  // PAID — the admin ticked the order_paid tracking step. From here the page
  // leads with the tracking timeline: the "invoice is coming" notice retires,
  // the order details tuck into a disclosure, and the receipt PDF unlocks.
  const trackingSteps = (p.tracking && p.tracking.steps) || [];
  const isPaid = trackingSteps.some((s) => s && s.id === 'order_paid' && !!s.completedAt);

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

  // Reflect the server's stored payment method (set at approval) so a returning
  // approved client sees the choice they made. Never overrides an in-progress
  // pick the client is currently making before they've approved.
  const serverPayMethod = data?.project?.paymentMethod || '';
  useEffect(() => {
    if (serverPayMethod && serverPayMethod !== payMethod) setPayMethod(serverPayMethod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPayMethod]);

  // Once approved, poll every 60s so the client sees the timeline update in
  // near-real-time when the admin ticks off a step — they don't have to
  // refresh the tab to see "Blanks shipping" turn green. Pauses when the tab
  // is hidden to avoid hammering the server while nobody's looking.
  // Poll in two situations so an open tab updates itself with no reload:
  //   • APPROVED — tracking steps turn green as the admin ticks them.
  //   • WAITING for the confirmation — the client picked and is on the "we're
  //     finalizing" buffer; the instant the owner hits "Push to client" their
  //     page flips to the finalized confirmation. (Faster here — 20s — so the
  //     hand-off feels live.) Both pause when the tab is hidden.
  const waitingForPush = !!p.optionsPickedAt && !p.hasConfirmation && approvalStatus === 'pending';
  // Also poll after the client requested changes: when the owner re-pushes a
  // revised confirmation the cycle reopens (status → pending, republished) on the
  // SAME link, so the client's open tab should flip to the fresh ask instead of
  // sitting on the static "we're on it" panel forever.
  const awaitingReopen = approvalStatus === 'requested_changes';
  // And poll while the client is REVIEWING a published-but-not-yet-approved
  // confirmation, so the owner's further tweaks (a shipping/price fix after the
  // push) stream to the client live — they don't have to re-push to update what
  // the client sees. The initial reveal still requires the push (the buffer).
  const reviewingConfirmation = p.hasConfirmation && approvalStatus === 'pending';
  useEffect(() => {
    if (isPreview) return;
    if (approvalStatus !== 'approved' && !waitingForPush && !awaitingReopen && !reviewingConfirmation) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || document.hidden) return;
      refresh();
    };
    const fast = waitingForPush || awaitingReopen || reviewingConfirmation;   // hand-off moments feel live
    const id = setInterval(tick, fast ? 20000 : 60000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalStatus, waitingForPush, awaitingReopen, reviewingConfirmation, projectId, token]);

  const handleApprove = async () => {
    // Preview renders the client's page 1:1; intercept the action so the admin
    // can't approve on the client's behalf.
    if (isPreview) { alert("Preview only — this is exactly what your client sees. Approve / Request changes work on the real link, not in preview."); return; }
    setActionBusy(true);
    try {
      // The confirmation page shows the "approval is final" notice (this action
      // is only reachable from that finalized view, never the picker/quoting
      // stage). Record which notice version the client saw at approval, so the
      // owner has a record that the terms were presented.
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/approve?${q}`,
        { ...(payMethod ? { paymentMethod: payMethod } : {}), termsVersion: 'approval-final-v1' });
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
  // C1: gate the "building" interstitial on the CURRENT cycle's pick only.
  // optionsPickedAt arrives already filtered by approvalSupersededAt server-side,
  // so a re-share/supersede clears it and a returning client is never stranded on
  // "building your confirmation". We deliberately do NOT also key off
  // quoteLines[].accepted here — those flags survive a re-share of the same quote
  // and would otherwise re-strand the client; the accepted lines still drive the
  // "what you chose" recap below, just not this gate.
  const alreadyPicked = !!p.optionsPickedAt;
  // A quote — grouped OR standalone-only — always routes through the buffer:
  // pick/accept → "we're finalizing" wait → the owner's published confirmation →
  // approve → track. The client can NEVER approve a raw quote directly. 'legacy'
  // (direct read-only approve) is reserved for a truly quote-less imported order.
  const hasQuote = quoteLines.length > 0;
  const stage = (p.hasConfirmation || (Array.isArray(p.confirmation?.items) && p.confirmation.items.length > 0))
    ? 'confirmation'
    : !hasQuote
      ? 'legacy'   // imported order with no quote to accept — read-only approve
      : approvalStatus !== 'pending'
        ? 'legacy'   // terminal decision already made — read-only table + status panel
        : ((alreadyPicked && !repicking) ? 'picked' : 'picker');

  // Current selection for a group. Explicit picks state wins (null = the client
  // deselected/skipped it); otherwise fall back to any server-accepted line so a
  // re-pick opens on what they had. undefined = nothing chosen for this group.
  const pickFor = (g) => {
    if (Object.prototype.hasOwnProperty.call(picks, g)) return picks[g] == null ? undefined : picks[g];
    const acc = quoteLines.findIndex(l => l.group === g && l.accepted);
    return acc >= 0 ? acc : undefined;
  };
  // Toggle: click the selected option again to skip the whole group. Clients are
  // NOT required to pick every group — pitch 10, keep the 5 you want.
  const togglePick = (g, idx) => setPicks(prev => {
    const has = Object.prototype.hasOwnProperty.call(prev, g);
    const cur = has ? prev[g] : (() => { const a = quoteLines.findIndex(l => l.group === g && l.accepted); return a >= 0 ? a : null; })();
    return { ...prev, [g]: cur === idx ? null : idx };
  });
  const pickedGroupCount = groupNames.filter(g => pickFor(g) !== undefined).length;
  // Ready to continue when they've kept at least one option — or the quote
  // carries standalone lines that are always part of the order.
  const canSubmitPicks = pickedGroupCount > 0 || standaloneLines.length > 0;
  // Live total of what they've kept so far (chosen options + standalone lines).
  const selectionTotal =
    groupNames.reduce((s, g) => {
      const idx = pickFor(g);
      if (idx === undefined) return s;
      const l = quoteLines[idx] || {};
      return s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
    }, 0) +
    standaloneLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);

  const submitPicks = async () => {
    if (isPreview) { alert("Preview only — this is exactly what your client sees. Picks work on the real link, not in preview."); return; }
    if (!canSubmitPicks) return;
    setPickBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/select?${q}`,
        { picks: groupNames.map(g => pickFor(g)).filter(i => i !== undefined) });
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

  // Full confirmation (rendered by the shared ConfirmationDocument, which also
  // computes its own totals) when one's been built.
  const conf = p.confirmation || {};
  const confItems = Array.isArray(conf.items) ? conf.items : [];
  const hasConf = confItems.length > 0;
  // The amount the client is approving — the confirmation's grand total when one
  // exists (the SAME computeConfTotals the document renders, so the fee math sits
  // on the exact number shown), else the project total. Drives the payment-fee
  // preview only; it never changes what's stored.
  const payableTotal = hasConf ? computeConfTotals(conf).grandTotal : total;
  // Show the "how would you like to pay?" picker by DEFAULT — hide it only when the
  // owner already baked a Card/ACH fee into the confirmation (then the fee is in the
  // Total and the picker would double it). Discounts/other lines don't suppress it.
  const showPayPicker = hasConf && !hasBakedPaymentFee(conf);
  // Index the confirmation's mockups by BOTH the normalized number AND the
  // normalized name. An item that references a mockup with no number stores the
  // mockup's NAME in mockupNum (the picker normalizes name → mockupNum), so
  // without the name key the client page would miss it and fall to a placeholder
  // while the builder preview + PDF resolve it fine (the old H1 divergence). This
  // mirrors the builder's mockupMap, the PDF's thumbByNorm, and the backend's
  // byNorm — every renderer now resolves the exact same source.
  const mockupByNum = {};
  mockups.forEach(m => {
    const entry = { front: m.thumbnail, back: m.back, extraViews: m.extraViews || [] };
    const kn = _norm(m.mockupNum);
    if (kn) mockupByNum[kn] = entry;
    const knm = _norm(m.name);
    if (knm && !mockupByNum[knm]) mockupByNum[knm] = entry;
  });
  // Per-item image: explicit snapshot → legacy single → the referenced mockup's
  // thumbnail (matched by # or name). Same resolution order the builder preview
  // and the PDF use, so every colorway shows its own photo identically.
  const confItemImages = (it) => {
    const snaps = (it.mockupSnapshots || []).map(s => s && s.dataUrl).filter(Boolean);
    if (snaps.length) return snaps;
    if (it.customMockupDataUrl) return [it.customMockupDataUrl];
    const lib = it.mockupNum ? mockupByNum[_norm(it.mockupNum)] : null;
    // Back side only when the admin opted in on the item (showBack) — matches
    // the builder preview and the PDF.
    // Extra views (pages 2+ of a multi-page mockup — e.g. shoulder prints on
    // the sideways garment) always show: the client should see every angle.
    return lib ? [lib.front, it.showBack ? lib.back : null, ...(lib.extraViews || [])].filter(Boolean) : [];
  };

  const openLightbox = (src) => setLightbox(src);

  // Progress rail state per stage.
  const railStates =
    approvalStatus === 'approved'         ? ['done', 'done', 'done']
    : approvalStatus === 'requested_changes' ? ['done', 'current', 'todo']
    : stage === 'picker'                  ? ['current', 'todo', 'todo']
    : stage === 'picked'                  ? ['done', 'building', 'todo']
    : /* confirmation / legacy, pending */  ['done', 'current', 'todo'];

  // The order-details body — the confirmation document or the legacy items
  // table. ONE definition: rendered inline until the order is paid, then
  // inside the collapsed "Order details" disclosure (paid pages lead with
  // the tracking timeline, per the owner).
  const orderDetailsBody = stage === 'confirmation' ? (
    // The client's order — rendered by the SHARED ConfirmationDocument, the
    // exact same component the owner's builder preview uses (Nate's WYSIWYG
    // ask). confItemImages is handed in as the image resolver so the builder
    // and this page resolve identical sources (H1). Owner-only cost/printer
    // never appear — the component never reads them and the public payload
    // already strips them server-side.
    <Box sx={{ mt: 2.5, animation: 'rise 500ms ease both', animationDelay: '180ms' }}>
      <ConfirmationDocument
        conf={conf}
        project={{
          companyName: p.companyName, clientName: p.clientName,
          orderNumber: p.orderNumber, orderDate: p.orderDate,
          confirmationMessage: p.confirmationMessage, confirmationTerms: p.confirmationTerms,
        }}
        logo={logo}
        resolveItemImages={confItemImages}
        onZoom={openLightbox}
        tokens={T}
      />
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
  );

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: T.bg, color: T.text,
      transition: 'background-color 200ms ease, color 200ms ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      // Subtle green aura at the top — the page glows like the brand, not flat.
      backgroundImage: `radial-gradient(120% 60% at 50% -10%, ${T.aura}, rgba(7,11,9,0) 60%)`,
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
        {/* Light / dark toggle — always reachable, top-right. */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <IconButton onClick={toggleMode} size="small"
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            sx={{ color: T.muted, border: `1px solid ${T.line}`, borderRadius: 999, px: 1.25, py: 0.5, gap: 0.6,
              transition: 'color 150ms ease, border-color 150ms ease',
              '&:hover': { color: T.green, borderColor: T.lineHi, bgcolor: T.panelHi } }}>
            {mode === 'dark' ? <LightModeOutlinedIcon sx={{ fontSize: 17 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 17 }} />}
            <Typography component="span" sx={{ fontSize: 11.5, fontWeight: 700 }}>{mode === 'dark' ? 'Light' : 'Dark'}</Typography>
          </IconButton>
        </Box>
        {/* Header — branded lockup + client / invoice / date. In the
            confirmation stage the shared ConfirmationDocument renders its own
            (identical) header + message, so we suppress this one to avoid a
            double header — the page is then byte-identical to the builder
            preview. Other stages (picker / building / legacy) keep this header.
            Once PAID the document collapses into the details disclosure, so
            this header returns — the page always opens with the brand. */}
        {(stage !== 'confirmation' || isPaid) && (
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
              <Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                {p.companyName || p.clientName || 'Untitled'}
              </Typography>
              {p.clientName && p.companyName && p.clientName !== p.companyName && (
                <Typography sx={{ color: T.muted, fontSize: 13, mt: 0.2, overflowWrap: 'anywhere' }}>{p.clientName}</Typography>
              )}
            </Box>
            {(p.orderNumber || p.orderDate) && (
              <Stack direction="row" gap={3} sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>
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
        )}

        {/* Progress rail */}
        <Box sx={{ mt: 2.5, mb: 0.5, animation: 'rise 500ms ease both', animationDelay: '60ms' }}>
          <ProgressRail states={railStates} T={T} />
        </Box>

        {stage !== 'confirmation' && p.confirmationMessage && (
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
              {mockups.flatMap((m, i) => [m.thumbnail, ...(m.extraViews || [])].filter(Boolean).map((src, j) => ({ m, src, key: `${i}-${j}` }))).map(({ m, src, key }) => (
                <ZoomImg key={key} src={src} alt={m.name} onZoom={openLightbox}
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
            <Typography sx={eyebrow}>Step 1 of 3 · Choose</Typography>
            <Typography sx={{ color: T.text, fontSize: { xs: 25, md: 30 }, fontWeight: 800, mt: 0.75, lineHeight: 1.15, letterSpacing: -0.4 }}>
              {hasGroups ? "Pick what you'd like" : 'Review your quote'}
            </Typography>
            <Typography sx={{ color: T.muted, fontSize: { xs: 14.5, md: 15 }, mt: 1.25, mb: 3, lineHeight: 1.6, maxWidth: 540 }}>
              {hasGroups
                ? "Tap the options you want — you don't have to take everything. Every price is all-in per unit."
                : "Here's your quote — every price is all-in per unit. Accept it to move forward and we'll finalize your confirmation."}
              <Box component="span" sx={{ display: 'block', mt: 1, color: T.faint, fontSize: 13.5 }}>
                Next you'll get your full confirmation — pricing, mockups &amp; details — to review and approve.
                You're just choosing here; nothing's final yet.
              </Box>
            </Typography>
            {groupNames.map((g, gi) => (
              <Box key={g} sx={{ mb: 3.5 }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }} flexWrap="wrap">
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, ...mono,
                    color: pickFor(g) !== undefined ? T.onAccent : T.green,
                    bgcolor: pickFor(g) !== undefined ? T.green : 'transparent',
                    border: `2px solid ${T.green}`, transition: 'all 180ms ease' }}>
                    {pickFor(g) !== undefined ? <CheckIcon sx={{ fontSize: 15 }} /> : gi + 1}
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{g}</Typography>
                  <Box component="span" sx={{ ...eyebrow, color: T.faint, fontSize: 10 }}>
                    Pick one · optional
                  </Box>
                </Stack>
                {(() => {
                  const entries = quoteLines.map((l, idx) => ({ ...l, idx })).filter(l => l.group === g);
                  const gridQ = detectGridRows(entries);
                  if (gridQ) return (
                    /* Matrix picker: one tidy row per option (brand or print
                       variant), one tappable price chip per quantity. Tapping a
                       chip picks that option+quantity for this design (tap the
                       selected chip again to skip the design) — exactly one
                       chip can be green at a time. */
                    <Stack gap={1}>
                      {gridQ.rows.map((row) => {
                        const f = row[0];
                        const rDesc = [f.description, f.styleCode && `(${f.styleCode})`, f.color].filter(Boolean).join(' ');
                        const rDetail = [f.printType, f.printDetails].filter(Boolean).join(' · ');
                        const rWeeks = Number(f.turnaroundWeeks) || 0;
                        const rowSel = row.some(c => pickFor(g) === c.idx);
                        return (
                          <Box key={`${f.idx}`} sx={{ p: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5,
                            border: `1.5px solid ${rowSel ? T.green : T.line}`, bgcolor: rowSel ? T.panelHi : T.inset,
                            display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, flexWrap: 'wrap',
                            transition: 'border-color 180ms ease, background 180ms ease' }}>
                            {f.image && (
                              <ZoomImg src={f.image} onZoom={openLightbox} badge={false}
                                sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 2,
                                  border: `1px solid ${T.line}`, bgcolor: T.inset, flexShrink: 0 }} />
                            )}
                            <Box sx={{ flex: '1 1 170px', minWidth: 150 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{rDesc || 'Option'}</Typography>
                              {rDetail && <Typography sx={{ color: T.muted, fontSize: 12, mt: 0.2 }}>{rDetail}</Typography>}
                              <Stack direction="row" gap={1.25} alignItems="center" flexWrap="wrap" sx={{ mt: 0.4 }}>
                                {f.productUrl && (
                                  <Typography component="a" href={f.productUrl} target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    sx={{ color: T.green, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                                      '&:hover': { textDecoration: 'underline' } }}>
                                    View product details ↗
                                  </Typography>
                                )}
                                {rWeeks > 0 && (
                                  <Typography sx={{ color: T.faint, fontSize: 11.5, ...mono }}>
                                    ~{rWeeks} wk{rWeeks === 1 ? '' : 's'} turnaround
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                            <Stack direction="row" gap={1} flexWrap="wrap">
                              {row.map((cell) => {
                                const sel = pickFor(g) === cell.idx;
                                const cUnit = Number(cell.unitPrice) || 0;
                                const cQty = Number(cell.qty) || 0;
                                return (
                                  <Box key={cell.idx} onClick={() => togglePick(g, cell.idx)}
                                    role="button" tabIndex={0} aria-pressed={sel}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePick(g, cell.idx); } }}
                                    sx={{ minWidth: 116, px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                                      border: `1.5px solid ${sel ? T.green : T.line}`,
                                      bgcolor: sel ? T.green : T.panel,
                                      boxShadow: sel ? `0 0 0 3px ${T.glow}` : 'none',
                                      transition: 'all 160ms ease',
                                      '&:hover': sel ? {} : { borderColor: 'rgba(255,255,255,0.28)', transform: 'translateY(-1px)' },
                                      '&:focus-visible': { outline: `2px solid ${T.green}`, outlineOffset: 2 } }}>
                                    <Typography sx={{ color: sel ? T.onAccent : T.text, fontSize: 12.5, fontWeight: 800, ...mono, lineHeight: 1.2 }}>
                                      {sel && <CheckIcon sx={{ fontSize: 13, mr: 0.4, verticalAlign: '-2px' }} />}
                                      {cQty} units
                                    </Typography>
                                    <Typography sx={{ color: sel ? T.onAccent : T.green, fontSize: 15, fontWeight: 900, ...mono, lineHeight: 1.25 }}>
                                      {money(cUnit)}<Box component="span" sx={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>/unit</Box>
                                    </Typography>
                                    <Typography sx={{ color: sel ? 'rgba(6,20,12,0.75)' : T.muted, fontSize: 11, fontWeight: 700, ...mono }}>
                                      {money(cUnit * cQty)} total
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  );
                  return (
                <Stack gap={1.25}>
                  {entries.map((l) => {
                    const sel = pickFor(g) === l.idx;
                    const unit = Number(l.unitPrice) || 0;
                    const desc = [l.description, l.styleCode && `(${l.styleCode})`, l.color].filter(Boolean).join(' ');
                    const detail = [l.printType, l.printDetails].filter(Boolean).join(' · ');
                    const weeks = Number(l.turnaroundWeeks) || 0;   // shown only when the owner set it
                    return (
                      <Box key={l.idx} onClick={() => togglePick(g, l.idx)}
                        role="button" tabIndex={0} aria-pressed={sel}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePick(g, l.idx); } }}
                        sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, p: { xs: 1.75, sm: 2 }, borderRadius: 2.5, cursor: 'pointer',
                          position: 'relative', border: `1.5px solid ${sel ? T.green : T.line}`,
                          bgcolor: sel ? T.panelHi : T.inset,
                          boxShadow: sel ? `0 0 0 3px ${T.glow}, 0 8px 24px rgba(0,0,0,0.35)` : 'none',
                          transition: 'border-color 180ms ease, background 180ms ease, box-shadow 220ms ease, transform 160ms ease',
                          '&:hover': { borderColor: sel ? T.green : 'rgba(255,255,255,0.22)', transform: 'translateY(-1px)' },
                          '&:focus-visible': { outline: `2px solid ${T.green}`, outlineOffset: 2 } }}>
                        <Box sx={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          bgcolor: sel ? T.green : 'transparent', border: `2px solid ${sel ? T.green : 'rgba(255,255,255,0.25)'}`,
                          transition: 'all 160ms ease' }}>
                          {sel && <CheckIcon sx={{ fontSize: 16, color: T.onAccent, animation: 'popCheck 240ms ease' }} />}
                        </Box>
                        {l.image && (
                          <ZoomImg src={l.image} onZoom={openLightbox} badge={false}
                            sx={{ width: { xs: 92, sm: 116 }, height: { xs: 92, sm: 116 }, objectFit: 'cover', borderRadius: 2.5,
                              border: `1px solid ${T.line}`, bgcolor: T.inset, flexShrink: 0 }} />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.3 }}>{desc || 'Option'}</Typography>
                          {detail && <Typography sx={{ color: T.muted, fontSize: 12.5, mt: 0.3 }}>{detail}</Typography>}
                          {/* Owner-set product page for this blank (specs, colors, fit) —
                              a plain link that must never toggle the pick. */}
                          {l.productUrl && (
                            <Typography component="a" href={l.productUrl} target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, mt: 0.5, mr: 1.25,
                                color: T.green, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' } }}>
                              View product details ↗
                            </Typography>
                          )}
                          {weeks > 0 && (
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.6,
                              px: 0.9, py: 0.3, borderRadius: 999, border: `1px solid ${T.line}`, bgcolor: T.inset,
                              color: T.muted, fontSize: 11, fontWeight: 700, ...mono }}>
                              ~{weeks} week{weeks === 1 ? '' : 's'} turnaround
                            </Box>
                          )}
                        </Box>
                        {/* Reads top→bottom: per-unit price, then the quantity in
                            bold white, then the line total underneath. */}
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography sx={{ fontWeight: 900, fontSize: { xs: 21, sm: 25 }, letterSpacing: -0.4,
                            color: sel ? T.green : T.text, ...mono, lineHeight: 1.05 }}>
                            {money(unit)}<Box component="span" sx={{ color: T.faint, fontSize: 11.5, fontWeight: 600 }}>/unit</Box>
                          </Typography>
                          <Typography sx={{ color: T.text, fontWeight: 800, fontSize: { xs: 14, sm: 15 }, ...mono, mt: 0.6, lineHeight: 1 }}>
                            {Number(l.qty) || 0} units
                          </Typography>
                          <Typography sx={{ color: T.muted, fontSize: { xs: 12.5, sm: 13.5 }, fontWeight: 600, ...mono, mt: 0.35 }}>
                            {money((Number(l.qty) || 0) * unit)} total
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
                  );
                })()}
              </Box>
            ))}
            {standaloneLines.length > 0 && (
              <Box sx={{ mb: 2.5 }}>
                <Typography sx={{ ...eyebrow, color: T.faint, mb: 1 }}>Always included</Typography>
                {standaloneLines.map((l) => (
                  <Stack key={l.idx} direction="row" alignItems="center" gap={1.5} justifyContent="space-between"
                    sx={{ py: 1.1, borderBottom: `1px solid ${T.line}` }}>
                    {l.image && (
                      <ZoomImg src={l.image} onZoom={openLightbox} badge={false}
                        sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${T.line}`, bgcolor: T.inset }} />
                    )}
                    <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                      {[l.description, l.styleCode && `(${l.styleCode})`].filter(Boolean).join(' ')} × {Number(l.qty) || 0}
                      {Number(l.turnaroundWeeks) > 0 && (
                        <Box component="span" sx={{ color: T.faint, fontSize: 11.5, ...mono }}>
                          {' · '}~{Number(l.turnaroundWeeks)} wk{Number(l.turnaroundWeeks) === 1 ? '' : 's'}
                        </Box>
                      )}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, flexShrink: 0, ...mono }}>{money((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</Typography>
                  </Stack>
                ))}
              </Box>
            )}
            {/* Running selection total — updates live as they keep/skip options,
                so the price is never a tiny afterthought at the bottom. */}
            <Box sx={{ mt: 1, mb: 2, p: { xs: 2, sm: 2.5 }, borderRadius: 2.5,
              bgcolor: T.inset, border: `1px solid ${canSubmitPicks ? T.lineHi : T.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
              transition: 'border-color 200ms ease' }}>
              <Box>
                <Typography sx={{ ...eyebrow, color: T.faint, mb: 0.3 }}>Your selection so far</Typography>
                <Typography sx={{ color: T.muted, fontSize: 13 }}>
                  {pickedGroupCount > 0
                    ? `${pickedGroupCount} option${pickedGroupCount === 1 ? '' : 's'} kept${standaloneLines.length ? ' + your included items' : ''}`
                    : (standaloneLines.length ? 'Your included items' : 'Nothing kept yet — tap the options you want')}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ color: T.green, fontSize: { xs: 28, sm: 34 }, fontWeight: 900, letterSpacing: -0.8, ...mono, lineHeight: 1 }}>
                  {money(selectionTotal)}
                </Typography>
              </Box>
            </Box>
            {lockedNote && <LockedNote text={lockedNote} T={T} />}
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ mt: 1 }}>
              <Button fullWidth disabled={pickBusy || !canSubmitPicks} onClick={submitPicks}
                endIcon={!pickBusy && canSubmitPicks ? <ArrowForwardIcon /> : null}
                sx={{ ...primaryBtn, flex: 2 }}>
                {pickBusy ? <CircularProgress size={18} sx={{ color: T.onAccent }} />
                  : canSubmitPicks ? (hasGroups ? 'Continue to review' : 'Accept & continue') : 'Tap the options you want'}
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
            <Typography sx={{ color: T.muted, fontSize: 13.5, mt: 1, mb: 2.5, lineHeight: 1.6, maxWidth: 480, mx: 'auto' }}>
              Nice picks — these are with our team now. We&apos;ll put your full confirmation together — every item, size,
              price and mockup for final art approval — and email you the moment it&apos;s ready, right here on this page.
              No action needed from you for now.
            </Typography>
            {/* A calm "received" shimmer. Deliberately NOT a progress bar that
                implies live percentage — nothing is actively ticking, and a fake
                progress meter would imply false progress (MED). */}
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
            {/* Escape hatch (H4): even while "building", the client always has a
                way to reach us — they're never stuck with no way to ask. */}
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="center" alignItems="center" sx={{ mt: 2 }}>
              <Button size="small" onClick={() => setRepicking(true)}
                sx={{ color: T.muted, textTransform: 'none', fontSize: 12.5, '&:hover': { color: T.green, bgcolor: 'transparent' } }}>
                ← Change my picks
              </Button>
              <Box sx={{ display: { xs: 'none', sm: 'block' }, width: 1, height: 14, bgcolor: T.line }} />
              <Button size="small" startIcon={<EditNoteIcon sx={{ fontSize: 16 }} />} onClick={() => setChangesOpen(true)}
                sx={{ color: T.muted, textTransform: 'none', fontSize: 12.5, '&:hover': { color: T.green, bgcolor: 'transparent' } }}>
                Ask a question
              </Button>
            </Stack>
          </Box>
        ) : isPaid ? (
          // PAID — the tracking timeline below is the hero now. The exact same
          // details body tucks behind a quiet, collapsed-by-default disclosure
          // so it stays one tap away instead of leading the page (owner's ask).
          <>
            <Box
              onClick={() => setDetailsOpen((o) => !o)}
              role="button" tabIndex={0} aria-expanded={detailsOpen}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailsOpen((o) => !o); } }}
              sx={{ ...card, mt: 2.5, px: { xs: 2, md: 2.5 }, py: 1.6, display: 'flex', alignItems: 'center', gap: 1.25,
                cursor: 'pointer', animation: 'rise 500ms ease both', animationDelay: '180ms',
                transition: 'background 150ms ease, border-color 150ms ease',
                '&:hover': { bgcolor: T.panelHi, borderColor: T.lineHi },
                '&:focus-visible': { outline: `2px solid ${T.green}`, outlineOffset: 2 } }}>
              <Typography sx={eyebrow}>Order details</Typography>
              <Typography sx={{ color: T.faint, fontSize: 12, display: { xs: 'none', sm: 'block' } }}>
                {p.orderNumber ? `Invoice #${p.orderNumber} · ` : ''}items, totals &amp; terms
              </Typography>
              <Box sx={{ flex: 1 }} />
              <ExpandMoreIcon sx={{ color: T.faint, fontSize: 20, transition: 'transform 200ms ease',
                transform: detailsOpen ? 'rotate(180deg)' : 'none' }} />
            </Box>
            <Collapse in={detailsOpen} timeout={300} unmountOnExit>
              {orderDetailsBody}
            </Collapse>
          </>
        ) : orderDetailsBody}

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
                    <CheckIcon sx={{ color: T.onAccent, fontSize: 34 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 21 }}>You&apos;re all set — thank you!</Typography>
                  <Typography sx={{ color: T.muted, fontSize: 13.5, mt: 0.75, lineHeight: 1.55 }}>
                    {p.approvalBy ? `Approved by ${p.approvalBy}. ` : ''}We&apos;ll move through the steps below and keep this page updated as each one happens.
                  </Typography>
                </Box>
                {/* Payment is invoiced (QuickBooks) — tell the client an invoice email
                    is coming; the chosen method just sets how they'll pay it. Both
                    this notice and the locked fee preview RETIRE once the order is
                    PAID — no stale "invoice is coming" after the money's in. */}
                {!isPaid && (
                  <Box sx={{ textAlign: 'center', mb: 3, px: 2, py: 1.5, borderRadius: 2, border: `1px solid ${T.line}`, bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Typography sx={{ color: T.text, fontSize: 13.5, fontWeight: 800 }}>
                      You&apos;ll receive an email with your invoice shortly.
                    </Typography>
                    <Typography sx={{ color: T.muted, fontSize: 12.5, mt: 0.5, lineHeight: 1.55 }}>
                      {payMethod === 'cc' ? 'You can pay by card right from the invoice.'
                        : payMethod === 'ach' ? 'You can pay by bank transfer (ACH) right from the invoice.'
                        : "It'll have everything you need to complete payment."}
                    </Typography>
                  </Box>
                )}
                {showPayPicker && payMethod && !isPaid && (
                  <PaymentChoice value={payMethod} onChange={() => {}} baseTotal={payableTotal} locked T={T} />
                )}
                <TrackingTimeline steps={trackingSteps} T={T} />
                {/* Paper trail — the branded invoice exists from approval on; the
                    receipt joins it once the order is paid. Plain anchors → new tab
                    (the same token-gated public API this page already talks to). */}
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="center" sx={{ mt: 2 }}>
                  <Button component="a" target="_blank" rel="noopener noreferrer"
                    href={`${config.backendUrl}/api/public/projects/${projectId}/invoice.pdf?${q}`}
                    startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 17 }} />}
                    sx={{ ...ghostBtn, py: 0.9, px: 2.25, fontSize: 12.5 }}>
                    Download invoice (PDF)
                  </Button>
                  {isPaid && (
                    <Button component="a" target="_blank" rel="noopener noreferrer"
                      href={`${config.backendUrl}/api/public/projects/${projectId}/receipt.pdf?${q}`}
                      startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 17 }} />}
                      sx={{ ...ghostBtn, py: 0.9, px: 2.25, fontSize: 12.5 }}>
                      Download receipt (PDF)
                    </Button>
                  )}
                </Stack>
              </Box>
            ) : (
              <>
                <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 1 }}>Take a look whenever you&apos;re ready</Typography>
                <Typography sx={{ color: T.muted, fontSize: 13.5, mb: 2, lineHeight: 1.6 }}>
                  {showPayPicker
                    ? "If everything looks good, pick how you'd like to pay and hit approve and we'll get started. If anything needs a tweak, just send it back — we're always happy to adjust."
                    : "If everything looks good, hit approve and we'll get started. If anything needs a tweak, just send it back — we're always happy to adjust."}
                </Typography>
                {/* Payment method + its fee — shown by default; hidden only when the
                    owner baked a Card/ACH fee into the Total (showing it too would
                    double-charge). */}
                {showPayPicker && (
                  <PaymentChoice value={payMethod} onChange={setPayMethod} baseTotal={payableTotal} T={T} />
                )}
                {lockedNote && <LockedNote text={lockedNote} T={T} />}
                {/* Brief, low-key "approval is final" notice. Lives inside the
                    pending action panel, which only renders on the finalized
                    confirmation/legacy view — never the picker/quoting stage. */}
                <Box sx={{ mb: 2, pt: 1.5, borderTop: `1px solid ${T.line}` }}>
                  <Typography sx={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>
                    <Box component="span" sx={{ color: T.text, fontWeight: 700 }}>Please review carefully — approval is final.</Box>{' '}
                    By approving, you confirm all spelling, colors, sizes, placement, and garment specs are correct, and that production can begin. On-screen colors and placement are approximations and may vary slightly on the finished product.
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  <Button onClick={handleApprove} disabled={actionBusy} endIcon={!actionBusy ? <ArrowForwardIcon /> : null}
                    startIcon={actionBusy ? <CircularProgress size={16} sx={{ color: T.onAccent }} /> : null}
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

      <Dialog open={changesOpen} onClose={() => setChangesOpen(false)} maxWidth="xs" fullWidth fullScreen={fullScreenDialog}
        PaperProps={{ sx: { bgcolor: T.panel, color: T.text, border: `1px solid ${T.line}`, borderRadius: { xs: 0, sm: 3 },
          backgroundImage: 'none', boxShadow: T.shadow, overflow: 'hidden' } }}>
        {/* Brand accent bar, so the dialog reads on-brand and finished, not bare. */}
        <Box sx={{ height: 3, background: `linear-gradient(90deg, ${T.greenDk}, ${T.green}, ${T.greenDk})` }} />
        <DialogTitle sx={{ px: { xs: 2.5, sm: 3 }, pt: 2.5, pb: 0.5 }}>
          <Typography sx={{ ...eyebrow, mb: 0.5 }}>We&apos;re listening</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: T.text, lineHeight: 1.2 }}>Send us a note</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2.5, sm: 3 } }}>
          <Typography sx={{ color: T.muted, fontSize: 13.5, mb: 1.75, lineHeight: 1.55 }}>
            A question or a tweak — colors, sizes, copy, anything at all. We&apos;ll get right back to you.
          </Typography>
          <TextField fullWidth multiline minRows={4} autoFocus value={changesText} onChange={e => setChangesText(e.target.value)}
            placeholder="e.g. Can we see the hoodie in forest green? And bump the back logo up a couple inches."
            sx={darkField} />
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2.5, sm: 3 }, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={() => setChangesOpen(false)} sx={{ ...ghostBtn, py: 0.9 }}>Cancel</Button>
          <Button onClick={handleRequestChanges} disabled={actionBusy || !changesText.trim()} sx={primaryBtn}>
            {actionBusy ? <CircularProgress size={16} sx={{ color: T.onAccent }} /> : 'Send'}
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

// ── Shared button + field styles (theme-aware) ───────────────────────────────
const sxPrimaryBtn = (T) => ({
  bgcolor: T.green, color: T.onAccent, fontWeight: 800, textTransform: 'none', px: 3, py: 1.25, fontSize: 14.5,
  borderRadius: 999, boxShadow: `0 6px 20px ${T.glow}`, transition: 'transform 150ms ease, box-shadow 200ms ease, filter 150ms ease',
  '&:hover': { bgcolor: T.green, filter: 'brightness(1.08)', transform: 'translateY(-1px)', boxShadow: `0 10px 28px ${T.glow}` },
  '&.Mui-disabled': { bgcolor: T.green, opacity: 0.4, color: T.onAccent, boxShadow: 'none' },
});
const sxGhostBtn = (T) => ({
  color: T.text, border: `1px solid ${T.line}`, fontWeight: 700, textTransform: 'none', px: 3, py: 1.25, fontSize: 14, borderRadius: 999,
  transition: 'border-color 180ms ease, background 180ms ease',
  '&:hover': { borderColor: T.lineHi, bgcolor: T.panelHi },
});
const sxField = (T) => ({
  '& .MuiOutlinedInput-root': { bgcolor: T.inset, color: T.text, borderRadius: 2,
    '& fieldset': { borderColor: T.line }, '&:hover fieldset': { borderColor: T.lineHi },
    '&.Mui-focused fieldset': { borderColor: T.green } },
  '& .MuiInputBase-input::placeholder': { color: T.faint, opacity: 1 },
});

// Small amber "someone already decided" note.
function LockedNote({ text, T }) {
  return (
    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)' }}>
      <Typography sx={{ color: T.amber, fontSize: 13, lineHeight: 1.5 }}>{text}</Typography>
    </Box>
  );
}

// ── Payment method picker ─────────────────────────────────────────────────────
// The client chooses how they'll pay before approving. Each option shows its
// processing fee (CC 2.99% / ACH 1%) and the resulting total, computed live off
// the amount they're approving — so there are no surprises. Purely informational
// + a record of their choice; it does NOT change the order's stored total (the
// owner owns that on the confirmation). `value` is '' | 'cc' | 'ach'. When
// `locked` (post-approval) it renders read-only as a confirmation of the choice.
function PaymentChoice({ value, onChange, baseTotal, locked = false, T }) {
  const eyebrow = sxEyebrow(T);
  const opts = [
    { key: 'cc',  label: 'Credit / debit card', sub: '2.99% processing fee' },
    { key: 'ach', label: 'ACH bank transfer',   sub: '1% processing fee' },
  ];
  const feeFor = (k) => (Number(baseTotal) || 0) * (PAY_FEES[k] || 0);
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ ...eyebrow, color: T.faint, mb: 1 }}>
        {locked ? 'Payment method' : 'How would you like to pay?'}
      </Typography>
      <Stack gap={1}>
        {opts.map((o) => {
          const sel = value === o.key;
          // In the locked view only render the chosen option.
          if (locked && !sel) return null;
          const fee = feeFor(o.key);
          const withFee = (Number(baseTotal) || 0) + fee;
          return (
            <Box key={o.key}
              onClick={locked ? undefined : () => onChange(sel ? '' : o.key)}
              role={locked ? undefined : 'button'}
              tabIndex={locked ? undefined : 0}
              onKeyDown={locked ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(sel ? '' : o.key); } }}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2,
                cursor: locked ? 'default' : 'pointer',
                border: `1.5px solid ${sel ? T.green : T.line}`,
                bgcolor: sel ? T.panelHi : T.inset,
                transition: 'border-color 160ms ease, background 160ms ease',
                '&:hover': locked ? {} : { borderColor: sel ? T.green : 'rgba(255,255,255,0.22)' } }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                bgcolor: sel ? T.green : 'transparent', border: `2px solid ${sel ? T.green : 'rgba(255,255,255,0.25)'}` }}>
                {sel && <CheckIcon sx={{ fontSize: 13, color: T.onAccent }} />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: T.text }}>{o.label}</Typography>
                <Typography sx={{ color: T.muted, fontSize: 11.5 }}>{o.sub}</Typography>
              </Box>
              {(Number(baseTotal) || 0) > 0 && (
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ color: T.faint, fontSize: 11, ...mono }}>+{money(fee)} fee</Typography>
                  <Typography sx={{ color: sel ? T.green : T.text, fontSize: 13.5, fontWeight: 800, ...mono }}>{money(withFee)}</Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackingTimeline — post-approval client view of where the project is. Dark
// card, green progress meter, per-step optional carrier link.
// ─────────────────────────────────────────────────────────────────────────────
export function TrackingTimeline({ steps, T }) {
  const eyebrow = sxEyebrow(T);
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
                border: done ? `2px solid ${T.green}` : `2px solid ${T.line}`, color: done ? T.onAccent : T.faint, transition: 'all 0.3s ease' }}>
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
