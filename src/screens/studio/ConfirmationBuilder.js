// src/screens/studio/ConfirmationBuilder.js
//
// The operational confirmation page builder. This is the doc the user sends
// to a client AFTER they approve the quote and pick a subset of items —
// "I want 50 of these in M/L/XL, 25 of those in S/M/L, ship to NYC."
//
// Layout: editor on the left (controls), live preview on the right (the
// printable / shareable doc). On narrow screens they stack.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton, Snackbar, Alert,
  Dialog, DialogContent, FormControlLabel, Switch, CircularProgress, MenuItem, Select, Tooltip, Collapse,
} from '@mui/material';
import CloseIcon              from '@mui/icons-material/Close';
import PictureAsPdfIcon       from '@mui/icons-material/PictureAsPdf';
import ShareIcon              from '@mui/icons-material/Share';
import SendRoundedIcon        from '@mui/icons-material/SendRounded';
import AddCircleOutlineIcon   from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import KeyboardArrowDownIcon  from '@mui/icons-material/KeyboardArrowDown';
import PlaceOutlinedIcon       from '@mui/icons-material/PlaceOutlined';
import axios from 'axios';
import config from '../../config.json';
import { D, scrollbar, dropInput, mono, accentBar, confLocationTax, STATE_TAX_RATES, isTaxCustomLine, roundCents, useMobileFullScreen } from './_shared';
import { lsGet, lsSet, lsRemove } from '../../common/jpStorage';
import ConfirmationDocument, { DOC } from '../ConfirmationDocument';

// Resize + JPEG-recompress uploaded mockup images before stuffing them into
// the confirmation document. Without this the doc inflates with multi-MB
// base64 blobs and the PUT /orders/:id either 413s or breaks Mongo's 16MB
// per-doc limit — the source of the "save failed: 500" the user hit.
//
// Post-compression cap: if the result is still over ~1.8MB (base64-encoded),
// recompress at progressively lower quality / smaller dimension. Hard fail
// at the floor instead of silently saving a doc that will 500 on the next
// PUT — a confirmation has multiple mockups + custom lines, and the
// per-doc Mongo limit is 16MB total.
const MAX_DATAURL_BYTES = 1.8 * 1024 * 1024;

async function compressImageToDataUrl(file, maxDim = 1400, quality = 0.82) {
  const renderAt = (dim, q) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read file.'));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > dim || height > dim) {
          const r = width / height;
          if (r >= 1) { width = dim; height = Math.round(dim / r); }
          else        { height = dim; width = Math.round(dim * r); }
        }
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        try { resolve(c.toDataURL('image/jpeg', q)); }
        catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('Could not decode image.'));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  // Try the requested settings first, then back off if the result is still
  // too big. Each retry drops quality first (cheap), then dimension (costly
  // for quality). 5 attempts gives plenty of room before bailing.
  const tries = [
    { d: maxDim,                q: quality },
    { d: maxDim,                q: 0.7 },
    { d: Math.round(maxDim*0.85), q: 0.7 },
    { d: Math.round(maxDim*0.7),  q: 0.65 },
    { d: 800,                   q: 0.6 },
  ];
  let dataUrl;
  for (const t of tries) {
    dataUrl = await renderAt(t.d, t.q);
    if (dataUrl.length <= MAX_DATAURL_BYTES) return dataUrl;
  }
  throw new Error(
    'This image is too detailed to compress under the per-document limit. ' +
    'Try cropping it tighter or starting from a smaller export.'
  );
}

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const PRINT_TYPES = ['Screen Print', 'DTG', 'DTF', 'Embroidery', 'Heat Transfer', 'Vinyl', 'Sublimation', 'None'];

function normMockupKey(n) {
  return String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();
}

// Stable, collision-resistant key for a new ship-to destination. allocations on
// items reference shipTos by this key, so it must never change once assigned.
function newShipToKey() {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Total units of an item across its sizes — the number the per-location
// allocation should sum to.
function itemTotalQty(item) {
  return (item.sizes || []).reduce((s, sz) => s + (Number(sz.qty) || 0), 0);
}

// Sum of an item's allocations across only the destinations that still exist.
function allocatedQty(item, shipTos) {
  const keys = new Set((shipTos || []).map(s => s.key));
  return (item.allocations || [])
    .filter(a => keys.has(a.key))
    .reduce((s, a) => s + (Number(a.qty) || 0), 0);
}

// Read an item's allocation to one destination key (0 when unset).
function allocFor(item, key) {
  const a = (item.allocations || []).find(x => x.key === key);
  return a ? (Number(a.qty) || 0) : 0;
}

function emptyItem() {
  return {
    mockupNum: '', customMockupDataUrl: '', mockupSnapshots: [], showBack: false,
    productName: '', brandName: '', styleCode: '', printType: '', color: '', printerName: '',
    sizes: DEFAULT_SIZES.map(s => ({ label: s, qty: 0, unitPrice: 0 })),
  };
}

// orderDate is a pure CALENDAR date (no time-of-day meaning). The <input
// type="date"> writes it as UTC midnight (new Date('2026-06-09') = 00:00Z), so
// we must ALWAYS render it back in UTC — otherwise toLocaleDateString() in any
// timezone west of UTC rolls "06/09" back to "06/08". todayCalendarISO() seeds
// today's LOCAL calendar day as that same UTC-midnight value.
function todayCalendarISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
}
export default function ConfirmationBuilder({ open, project, mockupMap, mockups, logo, token, onClose, onSave, onShareApproval, onPublish }) {
  const fullScreen = useMobileFullScreen();
  const [local, setLocal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushToast, setPushToast] = useState({ open: false, msg: '', sev: 'success' });
  // Whether this confirmation is currently LIVE on the client's link. Seeded from
  // the server's publish stamp and flipped true the moment the owner pushes, so
  // the header reads "live" vs "draft — not pushed yet" without a reload.
  const [pushedLive, setPushedLive] = useState(!!(project && project.confirmation && project.confirmation.publishedAt));

  // Load the draft on open. Order of precedence:
  //   1. A localStorage draft for this project (always wins — if you typed
  //      anything since the last server save, that's the freshest copy).
  //   2. The server's saved confirmation.
  //   3. A sensible seed pulled from project + quote lines.
  useEffect(() => {
    if (!project) return;
    const key = `confirmation-draft:${project._id}`;
    let seed;
    const raw = lsGet(key, null);
    if (raw) {
      try { seed = JSON.parse(raw); }
      catch (e) {
        // Don't swallow — log the bad payload so a one-time storage
        // corruption (partial write, DevTools edit, etc.) is debuggable.
        // We fall through to the server-state seed below; the bad draft
        // gets overwritten on the next auto-save.
        console.warn(`[ConfirmationBuilder] discarding corrupt draft at ${key}:`, e.message);
      }
    }
    if (!seed) {
      if (project.confirmation && Object.keys(project.confirmation).length > 0) {
        seed = project.confirmation;
      } else {
        // Fresh seed. Distribute the project's auto-matched mockups across
        // the seeded items in order — so a 3-line quote with 3 mockups in
        // jpstudio comes up with each item pre-attached to its mockup.
        const matchedNums = inferMockupNumsFor(project, mockups);
        // A line's own design wins: its mockup # (explicit link) or uploaded
        // vendor render (items with no mockup number — ashtrays etc.); the
        // positional auto-match is the fallback.
        const items = chosenQuoteLines(project.quoteLines).map((line, i) =>
          ({ ...seedItemFromQuote(line),
             mockupNum: line.mockupNum || matchedNums[i] || '',
             customMockupDataUrl: line.image || '' }),
        );
        seed = {
          orderTitle:  `${project.companyName || project.clientName || ''} Merch`.trim(),
          orderDate:   project.orderDate || todayCalendarISO(),
          shipping:    { name: project.companyName || '', attention: project.clientName || '', streetAddress: '', cityStateZip: '' },
          items,
          customLines: [],
        };
      }
    }
    const safeSeed = seed ? JSON.parse(JSON.stringify(seed)) : {};
    // Old confirmations (and pre-`shipping` drafts) may lack sub-objects the
    // editor reads unguarded — default them so the dialog never crashes blank.
    safeSeed.shipping = safeSeed.shipping || { name: '', attention: '', streetAddress: '', cityStateZip: '' };
    safeSeed.items = Array.isArray(safeSeed.items) ? safeSeed.items : [];
    safeSeed.customLines = Array.isArray(safeSeed.customLines) ? safeSeed.customLines : [];
    // Multi-location ship-to is opt-in: default to an empty list so existing
    // single-location confirmations carry no shipTos and render exactly as before.
    safeSeed.shipTos = Array.isArray(safeSeed.shipTos) ? safeSeed.shipTos : [];
    setLocal(safeSeed);
    setDirty(false);
    // Reflect the server's publish state for THIS project (draft vs live).
    setPushedLive(!!(project.confirmation && project.confirmation.publishedAt));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?._id]);

  // Track whether the most recent localStorage write succeeded so we can warn
  // the user if their draft isn't actually being saved (quota exceeded after
  // a few big mockups will silently lose every edit otherwise).
  const [draftSaveError, setDraftSaveError] = useState('');

  // Monotonic edit counter — bumped on every update() so persist() can tell
  // whether edits landed while a save was in flight.
  const editVersionRef = useRef(0);

  // Persist every edit to localStorage so an accidental backdrop click,
  // tab close, or browser crash can't kill the user's work.
  useEffect(() => {
    if (!project || !local) return;
    try {
      const ok = lsSet(`confirmation-draft:${project._id}`, JSON.stringify(local));
      if (!ok) throw new Error('storage unavailable');
      if (draftSaveError) setDraftSaveError('');
    } catch (e) {
      // Quota exceeded is the common case — usually triggered by a big
      // mockup snapshot push. Surface the failure so the user knows the
      // auto-recovery safety net isn't there for this session and saves
      // explicitly. We don't repeatedly setState if the error message is
      // unchanged, since this useEffect runs on every edit.
      const msg = e && e.name === 'QuotaExceededError'
        ? 'Local draft cache is full — clear browser storage or hit Save soon. Edits since the warning won\'t survive a tab close.'
        : `Local draft save failed (${e.message || 'unknown'}). Hit Save before closing.`;
      if (msg !== draftSaveError) setDraftSaveError(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, local]);

  // Warn if the user closes the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  // Autosave on every edit, debounced ~800ms. No Save button — the user
  // shouldn't have to remember to press anything to keep their work.
  useEffect(() => {
    if (!dirty || !local) return undefined;
    const t = setTimeout(() => {
      // Defined below; persist() lives on this component. Wrap in try/catch
      // so a transient save failure doesn't crash the dialog.
      persist().catch(() => { /* keep dirty so we'll retry on next edit */ });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, local]);

  if (!project || !local) return null;

  const update = (patch) => {
    editVersionRef.current += 1;
    setLocal(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const persist = async () => {
    // Snapshot the edit version so keystrokes typed while the save is in
    // flight are never marked "saved" — they re-trigger the autosave.
    const versionAtSave = editVersionRef.current;
    setSaving(true);
    try {
      const saved = await onSave({ confirmation: local });
      // onSave resolves with null when the PUT failed (it already alerted).
      // Treat that as a real failure: keep the dirty flag, keep the
      // localStorage draft, keep beforeunload protection.
      if (!saved) throw new Error('save failed');
      if (editVersionRef.current === versionAtSave) {
        // Server confirmed and nothing changed since — drop the local draft.
        lsRemove(`confirmation-draft:${project._id}`);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // Server-rendered PDF. Saves first so the backend renders the latest state.
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      if (dirty) await persist();
      const r = await axios.post(
        `${config.backendUrl}/api/orders/${project._id}/confirmation/pdf`, {},
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `confirmation-project-${project.projectNumber || project._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(`PDF generation failed: ${e.response?.data?.message || e.message}.`);
    } finally {
      setPdfBusy(false);
    }
  };

  // Share-for-approval button in the header — saves first (so the link points
  // at the latest state) and delegates to the parent for the actual token mint.
  // Guarded client-side so the owner gets an immediate, specific reason instead
  // of a broken confirmation reaching the client; the server enforces the same
  // checks on /approval-link/send as a backstop (stale tab / direct call).
  const shareApproval = async () => {
    if (!onShareApproval) return;
    const issues = shareIssuesFor(local);
    if (issues.length > 0) {
      alert(issues.length === 1 ? issues[0]
        : `This confirmation isn't ready to share:\n\n• ${issues.join('\n• ')}`);
      return;
    }
    setShareBusy(true);
    try {
      if (dirty) await persist();
      await onShareApproval();
    } finally { setShareBusy(false); }
  };

  // "Push to client" — the primary action. Finalize → make the confirmation LIVE
  // on the client's EXISTING link (never a new link). Saves, runs the same share
  // guard, then publishes (sets confirmation.publishedAt). If the client already
  // has the link, their page flips off the "we're finalizing" screen on its own;
  // if they've never been sent it, we open the email dialog so they get it.
  const pushToClient = async () => {
    if (!onPublish) return;
    const issues = shareIssuesFor(local);
    if (issues.length > 0) {
      alert(issues.length === 1 ? issues[0]
        : `This confirmation isn't ready to push:\n\n• ${issues.join('\n• ')}`);
      return;
    }
    setPushBusy(true);
    try {
      if (dirty) await persist();
      const res = await onPublish();   // POST /orders/:id/confirmation/publish
      if (res && res.ok) {
        setPushedLive(true);
        // First delivery: if the client was never emailed the link, open the
        // share dialog so they actually receive it. Otherwise just confirm —
        // their open tab auto-updates and re-emailing is optional.
        if (!res.hasRecipients && onShareApproval) {
          setPushToast({ open: true, msg: res.reopened ? 'Revised confirmation is live — send them the link ↓' : 'Confirmation is live — send them the link ↓', sev: 'success' });
          await onShareApproval();
        } else {
          setPushToast({
            open: true,
            msg: res.reopened
              ? '✓ Revised confirmation pushed — live on their existing link (nothing new sent).'
              : '✓ Pushed — live on the client’s existing link (same link, nothing new sent).',
            sev: 'success',
          });
        }
      } else {
        setPushToast({ open: true, msg: 'Could not push the confirmation — please try again.', sev: 'error' });
      }
    } catch (e) {
      setPushToast({ open: true, msg: e?.response?.data?.message || e.message || 'Push failed.', sev: 'error' });
    } finally { setPushBusy(false); }
  };

  // Closing the dialog now auto-saves dirty changes instead of asking. The
  // localStorage draft was the safety net before; now we just commit on close.
  const closeWithSave = async () => {
    if (dirty) { try { await persist(); } catch (e) { /* draft survives in localStorage */ } }
    onClose();
  };

  // Resolve an item's images EXACTLY as the public ApprovalView does, so the
  // preview pane and the live client page show the identical sources (H1):
  // explicit variant snapshots → legacy single upload → the referenced mockup's
  // thumbnail (+ back only when showBack). mockupMap is keyed by mockupNum and
  // by name (raw + normalized), same as the client payload's resolver.
  const resolveItemImagesForBuilder = (it) => {
    const snaps = (it.mockupSnapshots || []).map(s => s && s.dataUrl).filter(Boolean);
    if (snaps.length) return snaps;
    if (it.customMockupDataUrl) return [it.customMockupDataUrl];
    const m = it.mockupNum ? (mockupMap[it.mockupNum] || mockupMap[normMockupKey(it.mockupNum)]) : null;
    if (!m) return [];
    return [m.thumbnail, it.showBack ? m.data : null].filter(Boolean);
  };

  return (
    <Dialog open={open}
      // Don't close on accidental backdrop click — too much work lives in
      // this dialog to lose to a stray click. X button or Esc is required.
      onClose={(_, reason) => {
        if (reason === 'backdropClick') return;
        closeWithSave();
      }}
      maxWidth={false} fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: D.bg, color: D.text, border: `1px solid ${D.line}`, borderRadius: fullScreen ? 0 : 3,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        m: { xs: 1, md: 3 }, maxHeight: '94vh', width: 'calc(100% - 24px)' } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: D.panel,
        borderBottom: `1px solid ${D.line}`, px: 2.5, py: 1.35,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={accentBar} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14, flex: 1, letterSpacing: 0.2,
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          Confirmation page
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              bgcolor: saving ? D.amber : (dirty ? D.faint : D.green),
              boxShadow: saving || !dirty ? `0 0 8px ${saving ? 'rgba(251,191,36,0.6)' : D.glow}` : 'none',
              transition: 'background-color 0.2s ease' }} />
            <Typography component="span" sx={{ color: D.muted, fontSize: 11, fontWeight: 500 }}>
              Project #{project.projectNumber || '—'}{saving ? ' · saving…' : (dirty ? ' · saving soon' : ' · saved')}
            </Typography>
          </Box>
          {/* Publish state: whether the client can see this yet. Shown once there's
              something to push, so the owner always knows if they're still in the
              private "buffer" or the confirmation is live for approval. */}
          {(local?.items?.length > 0) && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.25, borderRadius: 999,
              border: `1px solid ${pushedLive ? 'rgba(52,211,153,0.40)' : 'rgba(251,191,36,0.40)'}`,
              bgcolor: pushedLive ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.10)',
              color: pushedLive ? D.green : D.amber, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {pushedLive ? '● Live on client’s link' : '● Draft — not pushed'}
            </Box>
          )}
        </Typography>
        {/* The separate "Preview" button is gone: the live pane on the right IS
            the client view now (the shared ConfirmationDocument), so there's
            nothing extra to preview. "Share for approval" and "Download PDF"
            remain. */}
        {/* Secondary: just get the link to the client (email/copy) WITHOUT
            changing publish state — for re-sending an already-live link. */}
        {onShareApproval && (
          <Button size="small" disabled={shareBusy || pushBusy}
            startIcon={shareBusy
              ? <CircularProgress size={12} sx={{ color: D.green }} />
              : <ShareIcon sx={{ fontSize: 16 }} />}
            onClick={shareApproval}
            sx={{ fontSize: 12, textTransform: 'none', fontWeight: 700, color: D.muted, borderRadius: 999,
              transition: 'color 0.18s ease', '&:hover': { color: D.text } }}>
            Email link
          </Button>
        )}
        <Button size="small" disabled={pdfBusy}
          startIcon={pdfBusy
            ? <CircularProgress size={12} sx={{ color: D.green }} />
            : <PictureAsPdfIcon sx={{ fontSize: 16 }} />}
          onClick={downloadPdf}
          sx={{ fontSize: 12, fontWeight: 700, color: D.muted, textTransform: 'none', borderRadius: 999,
            transition: 'color 0.18s ease', '&:hover': { color: D.text } }}>
          PDF
        </Button>
        {/* PRIMARY: finalize → make the confirmation LIVE on the client's existing
            link (the buffer's release valve). The single green CTA. */}
        {onPublish && (
          <Button size="small" disabled={pushBusy || !(local?.items?.length)}
            startIcon={pushBusy
              ? <CircularProgress size={12} sx={{ color: D.ink }} />
              : <SendRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={pushToClient}
            sx={{ fontSize: 12, fontWeight: 800, px: 1.75, py: 0.5,
              bgcolor: D.green, color: D.ink, textTransform: 'none', borderRadius: 999,
              boxShadow: `0 6px 18px ${D.glow}`,
              transition: 'transform 0.15s ease, box-shadow 0.2s ease, background-color 0.15s ease',
              '&:hover': { bgcolor: '#5cec8e', transform: 'translateY(-1px)', boxShadow: `0 10px 26px ${D.glow}` } }}>
            {pushedLive ? 'Re-push to client' : 'Push to client'}
          </Button>
        )}
        <IconButton size="small" onClick={closeWithSave} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {draftSaveError && (
        <Box sx={{ px: 2.5, py: 0.6, bgcolor: 'rgba(248,113,113,0.12)',
          borderBottom: `1px solid rgba(248,113,113,0.25)`,
          color: '#f87171', fontSize: 11, fontWeight: 600 }}>
          ⚠ {draftSaveError}
        </Box>
      )}

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '420px 1fr' },
          minHeight: '78vh' }}>
          {/* Editor */}
          <Box sx={{ borderRight: { md: `1px solid ${D.line}` }, bgcolor: D.bg, p: 2, overflow: 'auto', ...scrollbar,
            maxHeight: { md: '85vh' } }}>
            <Editor local={local} update={update} project={project} mockups={mockups} mockupMap={mockupMap} />
          </Box>
          {/* Live preview === the client's approval page. This pane renders the
              SAME ConfirmationDocument the public ApprovalView renders, on the
              same dark canvas — so what the owner sees here is exactly what the
              client gets. It updates live as `local` changes. */}
          <Box sx={{ p: { xs: 1.5, md: 3 }, bgcolor: DOC.bg, overflow: 'auto', ...scrollbar,
            maxHeight: { md: '85vh' },
            backgroundImage: `radial-gradient(120% 60% at 50% -10%, rgba(74,222,128,0.10), rgba(7,11,9,0) 60%)` }}>
            <Box sx={{ maxWidth: 780, mx: 'auto' }}>
              <ConfirmationDocument
                conf={local}
                project={{
                  companyName: project.companyName, clientName: project.clientName,
                  orderNumber: project.orderNumber, orderDate: local.orderDate,
                  confirmationMessage: project.confirmationMessage,
                  confirmationTerms: project.confirmationTerms,
                }}
                logo={logo}
                resolveItemImages={resolveItemImagesForBuilder}
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <Snackbar open={pushToast.open} autoHideDuration={5000}
        onClose={() => setPushToast(t => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={pushToast.sev} variant="filled"
          onClose={() => setPushToast(t => ({ ...t, open: false }))}
          sx={{ fontWeight: 700 }}>
          {pushToast.msg}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

function Editor({ local, update, project, mockups, mockupMap }) {
  const updateShipping = (patch) => update({ shipping: { ...local.shipping, ...patch } });
  // One-tap presets are IDEMPOTENT (M5): re-clicking "+ Card fee" (or "+ NJ tax")
  // must NOT stack a second identical line — that quietly double-charged the
  // client and the result depended on click order. `exists` tests whether an
  // equivalent line is already present; if so the click is a no-op.
  const addPresetLine = (line, exists) => {
    const lines = local.customLines || [];
    if (lines.some(exists)) return;
    update({ customLines: [...lines, line] });
  };
  const isCardFeeLine = (l) => !!l && !l.isTax && /card/i.test(String(l.label || ''));
  const isAchFeeLine = (l) => !!l && !l.isTax && /\bach\b|bank transfer/i.test(String(l.label || ''));
  // Did the owner bake a payment fee (Card or ACH)? Drives the helper note + (on the
  // client side) whether the payment picker shows. Mirrors models/Order.js.
  const hasBakedPaymentFee = (conf) => ((conf && conf.customLines) || []).some((l) => isCardFeeLine(l) || isAchFeeLine(l));
  const updateItem = (idx, patch) =>
    update({ items: local.items.map((it, i) => i === idx ? { ...it, ...patch } : it) });
  const removeItem = (idx) =>
    update({ items: local.items.filter((_, i) => i !== idx) });
  const addItem = (seed) =>
    update({ items: [...local.items, seed || emptyItem()] });
  const moveItem = (idx, dir) => {
    const arr = [...local.items];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    update({ items: arr });
  };

  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };

  return (
    <Stack gap={2}>
      {/* Header */}
      <Section title="Header">
        <SmallField label="Order title"
          value={local.orderTitle} onChange={v => update({ orderTitle: v })} />
        <SmallField label="Order date" type="date"
          value={local.orderDate ? new Date(local.orderDate).toISOString().slice(0,10) : ''}
          onChange={v => update({ orderDate: v ? new Date(v).toISOString() : null })} />
      </Section>

      {/* Shipping */}
      <Section title="Shipping">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          <SmallField label="Shipping name" value={local.shipping.name}
            onChange={v => updateShipping({ name: v })} />
          <SmallField label="Attention" value={local.shipping.attention}
            onChange={v => updateShipping({ attention: v })} />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <SmallField label="Street address" value={local.shipping.streetAddress}
              onChange={v => updateShipping({ streetAddress: v })} />
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <SmallField label="City, State, Zip" value={local.shipping.cityStateZip}
              onChange={v => updateShipping({ cityStateZip: v })} />
          </Box>
        </Box>
      </Section>

      {/* Multiple ship-to locations (opt-in) */}
      <MultiShipTo local={local} update={update} />

      {/* Items */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.6}>
          <Typography sx={{ color: D.green, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase' }}>
            Items · {local.items.length}
          </Typography>
          <Box>
            {(project.quoteLines || []).length > 0 && (
              <Tooltip title="Add a quote line as an item">
                <Button size="small"
                  onClick={() => {
                    // Dedupe on the full print VARIANT (style|color|printType|
                    // printDetails), not just style|color (H4) — otherwise two
                    // lines that differ only by decoration (e.g. screen-print vs
                    // embroidery, or 1-color vs 2-color) collapse into one and a
                    // variant silently vanishes from the confirmation.
                    const used = new Set(local.items.map(quoteVariantKey));
                    const next = chosenQuoteLines(project.quoteLines)
                      .filter(l => !used.has(quoteVariantKey(l)))
                      .map(seedItemFromQuote);
                    if (next.length === 0) return;
                    update({ items: [...local.items, ...next] });
                  }}
                  sx={{ color: D.muted, fontSize: 11, textTransform: 'none', borderRadius: 999,
                    '&:hover': { color: D.text } }}>
                  + From quote
                </Button>
              </Tooltip>
            )}
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
              onClick={() => addItem()}
              sx={{ color: D.green, fontSize: 11, textTransform: 'none', borderRadius: 999,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Add item
            </Button>
          </Box>
        </Stack>
        <Stack gap={1.2}>
          {local.items.map((it, i) => (
            <ItemCard key={i} idx={i} item={it} mockups={mockups} mockupMap={mockupMap}
              onUpdate={(p) => updateItem(i, p)}
              onRemove={() => removeItem(i)}
              onMove={(d) => moveItem(i, d)}
              shipTos={local.shipTos || []}
              project={project} noSpinner={noSpinner} />
          ))}
          {local.items.length === 0 && (
            <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 2, p: 2, textAlign: 'center', color: D.muted, fontSize: 12, bgcolor: D.inset }}>
              No items yet. Add one for each garment/product the client wants.
            </Box>
          )}
        </Stack>
      </Box>

      {/* Custom lines */}
      <Section title="Add-on lines"
        action={
          <Stack direction="row" gap={0.25} alignItems="center">
            {/* One-tap presets. Adding a Card or ACH fee here bakes it into the total
                AND hides the client's payment picker (so the fee is charged once —
                your baked line). Add neither and the client picks + pays the fee. */}
            <Tooltip title="Bake a 2.99% credit-card fee into the total (hides the client payment picker)">
              <Button size="small"
                onClick={() => addPresetLine({ label: 'Credit card fee', amount: 2.99, isPercent: true }, isCardFeeLine)}
                sx={{ color: D.muted, fontSize: 10.5, textTransform: 'none', minWidth: 'auto', px: 0.7, borderRadius: 999,
                  border: `1px solid ${D.line}`, transition: 'color 0.18s ease, border-color 0.18s ease',
                  '&:hover': { color: D.green, borderColor: D.lineHi } }}>
                + Card&nbsp;fee
              </Button>
            </Tooltip>
            <Tooltip title="Bake a 1% ACH / bank-transfer fee into the total (hides the client payment picker)">
              <Button size="small"
                onClick={() => addPresetLine({ label: 'ACH fee', amount: 1, isPercent: true }, isAchFeeLine)}
                sx={{ color: D.muted, fontSize: 10.5, textTransform: 'none', minWidth: 'auto', px: 0.7, borderRadius: 999,
                  border: `1px solid ${D.line}`, transition: 'color 0.18s ease, border-color 0.18s ease',
                  '&:hover': { color: D.green, borderColor: D.lineHi } }}>
                + ACH&nbsp;fee
              </Button>
            </Tooltip>
            {/* Suppress the single tax preset whenever per-location tax is in
                play, so a job can never be taxed both ways. */}
            <Tooltip title={hasLocationTax(local)
              ? 'Per-location tax is active — set rates per location instead'
              : 'Add NJ sales tax (6.625%)'}>
              <span>
                <Button size="small" disabled={hasLocationTax(local)}
                  onClick={() => addPresetLine({ label: 'NJ sales tax', amount: 6.625, isPercent: true, isTax: true }, isTaxCustomLine)}
                  sx={{ color: D.muted, fontSize: 10.5, textTransform: 'none', minWidth: 'auto', px: 0.7, borderRadius: 999,
                    border: `1px solid ${D.line}`, transition: 'color 0.18s ease, border-color 0.18s ease',
                    '&.Mui-disabled': { color: D.faint, borderColor: D.line, opacity: 0.5 },
                    '&:hover': { color: D.green, borderColor: D.lineHi } }}>
                  + NJ&nbsp;tax
                </Button>
              </span>
            </Tooltip>
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
              onClick={() => update({ customLines: [...(local.customLines || []), { label: '', amount: 0, isPercent: false }] })}
              sx={{ color: D.green, fontSize: 11, textTransform: 'none', borderRadius: 999,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Add line
            </Button>
          </Stack>
        }>
        <Stack gap={0.6}>
          {/* Fee model, derived (never double-charges): if you baked a Card/ACH fee
              above, the client sees no payment picker (the fee's in the total); if you
              didn't, the client picks how to pay and the fee is added then. Discounts
              don't count as a payment fee. */}
          <Box sx={{ mb: 0.75, px: 0.25 }}>
            <Typography sx={{ color: hasBakedPaymentFee(local) ? D.green : D.faint, fontSize: 11.5, lineHeight: 1.5 }}>
              {hasBakedPaymentFee(local)
                ? '✓ Payment fee added — your client won’t see a payment picker (the fee is in the total).'
                : 'No payment fee added — your client will pick Card (+2.99%) or ACH (+1%) at approval, and the fee is added then.'}
            </Typography>
          </Box>
          {(local.customLines || []).map((cl, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 28px',
              gap: 0.5, alignItems: 'center' }}>
              <TextField size="small" placeholder="Label (e.g. Shipping reserve)"
                value={cl.label}
                onChange={e => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })}
                sx={{ ...dropInput, '& .MuiInputBase-input': { fontSize: 12 } }} />
              <TextField size="small" type="number" placeholder="0.00"
                value={cl.amount || ''}
                onChange={e => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x) })}
                sx={{ ...dropInput, ...noSpinner, '& .MuiInputBase-input': { fontSize: 12, textAlign: 'right', ...mono } }} />
              <Tooltip title="Toggle percent vs flat amount">
                <Box onClick={() => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, isPercent: !x.isPercent } : x) })}
                  sx={{ cursor: 'pointer', textAlign: 'center', color: cl.isPercent ? D.ink : D.muted, fontSize: 12, fontWeight: 800, ...mono,
                    bgcolor: cl.isPercent ? D.green : 'transparent',
                    border: `1px solid ${cl.isPercent ? D.green : D.line}`, borderRadius: 1, py: 0.4,
                    transition: 'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease' }}>
                  {cl.isPercent ? '%' : '$'}
                </Box>
              </Tooltip>
              <IconButton size="small"
                onClick={() => update({ customLines: local.customLines.filter((_, j) => j !== i) })}
                sx={{ color: D.muted, '&:hover': { color: '#f87171' } }}>
                <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
          {(local.customLines || []).length === 0 && (
            <Typography sx={{ color: D.muted, fontSize: 11, fontStyle: 'italic' }}>
              No add-ons. Use these for shipping reserve, CC fee (2.99%), discounts, taxes…
            </Typography>
          )}
        </Stack>
      </Section>
    </Stack>
  );
}

// ── Multiple ship-to destinations ────────────────────────────────────────────
// Opt-in section: collapsed and empty by default so single-location orders are
// untouched. Adding a destination here reveals the per-item allocator on every
// item card. shipTos are referenced by `key`, never by index, so removing one
// only drops its own allocations.
function MultiShipTo({ local, update }) {
  const shipTos = local.shipTos || [];
  // Auto-open when destinations already exist (e.g. reopening a saved doc);
  // otherwise stay collapsed so the common single-location flow is unchanged.
  const [open, setOpen] = useState(shipTos.length > 0);

  const addShipTo = () => {
    setOpen(true);
    update({ shipTos: [...shipTos, { key: newShipToKey(), label: '', name: '', street: '', cityStateZip: '', state: '', taxRate: 0 }] });
  };
  const updateShipTo = (idx, patch) =>
    update({ shipTos: shipTos.map((s, i) => i === idx ? { ...s, ...patch } : s) });
  // Picking a state pre-fills the location's tax rate from the owner-territory
  // map — but only when the owner hasn't already typed a rate, so a manual
  // override is never clobbered by re-selecting the same/another state.
  const updateShipToState = (idx, state) => {
    const code = String(state || '').trim().toUpperCase();
    const preset = STATE_TAX_RATES[code];
    const cur = shipTos[idx] || {};
    const patch = { state };
    if (preset != null && !(Number(cur.taxRate) > 0)) patch.taxRate = preset;
    updateShipTo(idx, patch);
  };
  const removeShipTo = (idx) => {
    const goneKey = shipTos[idx] && shipTos[idx].key;
    // Drop the destination AND prune its allocations off every item so no
    // orphaned per-location quantities linger in the saved doc.
    update({
      shipTos: shipTos.filter((_, i) => i !== idx),
      items: (local.items || []).map(it => Array.isArray(it.allocations)
        ? { ...it, allocations: it.allocations.filter(a => a.key !== goneKey) }
        : it),
    });
  };

  return (
    <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2, bgcolor: D.inset }}>
      <Stack direction="row" alignItems="center" sx={{ px: 1.25, py: 0.9, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <PlaceOutlinedIcon sx={{ fontSize: 15, color: D.green, mr: 0.75 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: D.text, fontSize: 12, fontWeight: 700 }}>
            Ship to multiple locations
          </Typography>
          <Typography sx={{ color: D.faint, fontSize: 10.5 }}>
            {shipTos.length === 0
              ? 'Optional — split this order across the client’s locations'
              : `${shipTos.length} location${shipTos.length === 1 ? '' : 's'} · set per-item quantities below`}
          </Typography>
        </Box>
        <KeyboardArrowDownIcon sx={{ color: D.muted, fontSize: 20,
          transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.25, pb: 1.25, pt: 0.25 }}>
          <Stack gap={1}>
            {shipTos.map((st, i) => (
              <Box key={st.key || i} sx={{ border: `1px solid ${D.line}`, borderRadius: 1.5, p: 1, bgcolor: D.panel }}>
                <Stack direction="row" alignItems="center" mb={0.5}>
                  <Typography sx={{ color: D.green, fontSize: 9.5, fontWeight: 800, ...mono, letterSpacing: 1 }}>
                    LOCATION {i + 1}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <IconButton size="small" onClick={() => removeShipTo(i)}
                    sx={{ color: D.muted, p: 0.3, '&:hover': { color: '#f87171' } }}>
                    <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.6 }}>
                  <SmallField label="Label (e.g. Brooklyn HQ)" value={st.label}
                    onChange={v => updateShipTo(i, { label: v })} />
                  <SmallField label="Ship-to name" value={st.name}
                    onChange={v => updateShipTo(i, { name: v })} />
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <SmallField label="Street address" value={st.street}
                      onChange={v => updateShipTo(i, { street: v })} />
                  </Box>
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <SmallField label="City, State, Zip" value={st.cityStateZip}
                      onChange={v => updateShipTo(i, { cityStateZip: v })} />
                  </Box>
                  <SmallField label="State (for tax)" value={st.state}
                    onChange={v => updateShipToState(i, v)} />
                  <SmallField label="Tax rate %" type="number" value={st.taxRate || ''}
                    onChange={v => updateShipTo(i, { taxRate: Number(v) || 0 })} />
                </Box>
              </Box>
            ))}
            {shipTos.some(st => Number(st.taxRate) > 0) && (
              <Typography sx={{ color: D.green, fontSize: 10, mt: 0.75, lineHeight: 1.4 }}>
                Per-location sales tax is on. Each location’s allocated merchandise is taxed at
                its rate; the single “NJ tax” add-on is disabled to avoid double-taxing.
              </Typography>
            )}
          </Stack>
          <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={addShipTo}
            sx={{ color: D.green, fontSize: 11, textTransform: 'none', borderRadius: 999, mt: shipTos.length ? 1 : 0.5,
              '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
            Add location
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}

function ItemCard({ idx, item, mockups, mockupMap, onUpdate, onRemove, onMove, shipTos, project, noSpinner }) {
  const singleFileRef = React.useRef(null);
  const multiFileRef  = React.useRef(null);
  const updateSize = (sIdx, patch) => onUpdate({
    sizes: item.sizes.map((s, j) => j === sIdx ? { ...s, ...patch } : s),
  });
  const addSize = () => {
    const usedLabels = new Set(item.sizes.map(s => s.label));
    const nextDefault = DEFAULT_SIZES.find(s => !usedLabels.has(s)) || '';
    onUpdate({ sizes: [...item.sizes, { label: nextDefault, qty: 0, unitPrice: item.sizes[0]?.unitPrice || 0 }] });
  };
  const removeSize = (sIdx) =>
    onUpdate({ sizes: item.sizes.filter((_, j) => j !== sIdx) });

  // Eligible mockups for this project's company
  const projectMockups = useMemo(() => {
    const co = (project.companyName || project.clientName || '').toLowerCase();
    if (!co) return mockups;
    return mockups.filter(m => (m.client || '').toLowerCase().includes(co) ||
                                (m.name || '').toLowerCase().includes(co));
  }, [mockups, project.companyName, project.clientName]);

  // Single-file upload replaces the primary mockup. Compressed on the way in.
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      onUpdate({ customMockupDataUrl: dataUrl, mockupNum: '' });
    } catch (err) {
      alert(`Couldn't process image: ${err.message || err}`);
    }
    e.target.value = '';
  };

  // Multi-file upload appends variant snapshots. Each compressed before storing.
  const onUploadMulti = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const snaps = await Promise.all(files.map(async (file) => ({
        dataUrl: await compressImageToDataUrl(file),
        label: file.name.replace(/\.[^.]+$/, ''),
      })));
      onUpdate({ mockupSnapshots: [...(item.mockupSnapshots || []), ...snaps] });
    } catch (err) {
      alert(`Couldn't process images: ${err.message || err}`);
    }
    e.target.value = '';
  };
  const removeSnapshot = (i) =>
    onUpdate({ mockupSnapshots: (item.mockupSnapshots || []).filter((_, j) => j !== i) });

  const lookedUp = item.mockupNum
    ? (mockupMap[item.mockupNum] || mockupMap[normMockupKey(item.mockupNum)])
    : null;
  // The back composite lives in the library item's top-level `data` slot
  // (R2 URL in summaries) or, for legacy inline docs, as a server-set
  // hasBack flag. pageState composites are stripped at sync — reading
  // backCompositeBase64 here meant this toggle could never appear.
  const hasBack = !!(lookedUp && (lookedUp.data || lookedUp.hasBack));
  const snapshots = item.mockupSnapshots || [];

  return (
    <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2.5, p: 1.4, bgcolor: D.panel,
      transition: 'background-color 0.18s ease, border-color 0.18s ease',
      '&:hover': { bgcolor: D.panelHi, borderColor: 'rgba(255,255,255,0.14)' } }}>
      <Stack direction="row" alignItems="center" gap={0.5} mb={1}>
        <Typography sx={{ color: D.green, fontSize: 10, fontWeight: 800, ...mono, letterSpacing: 1 }}>
          ITEM {idx + 1}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => onMove(-1)} sx={{ color: D.muted, p: 0.3, fontSize: 14, '&:hover': { color: D.text } }}>↑</IconButton>
        <IconButton size="small" onClick={() => onMove(1)}  sx={{ color: D.muted, p: 0.3, fontSize: 14, '&:hover': { color: D.text } }}>↓</IconButton>
        <IconButton size="small" onClick={onRemove} sx={{ color: D.muted, '&:hover': { color: '#f87171' } }}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>

      {/* Mockup picker */}
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.3 }}>
          Mockup snapshot
        </Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <Select size="small" displayEmpty fullWidth
            value={normMockupKey(item.mockupNum || '')}
            onChange={e => onUpdate({ mockupNum: e.target.value, customMockupDataUrl: '' })}
            sx={{ ...dropInput['& .MuiOutlinedInput-root'], color: D.text, fontSize: 12, borderRadius: 2,
              '& .MuiSelect-icon': { color: D.muted } }}>
            <MenuItem value=""><em>— pick one —</em></MenuItem>
            {projectMockups.map(m => (
              <MenuItem key={m._id} value={normMockupKey(m.pageState?.mockupNum || m.name)}>
                {(m.pageState?.mockupNum || '—')} · {m.name || 'Untitled'}
              </MenuItem>
            ))}
          </Select>
          <input ref={singleFileRef} type="file" accept="image/*" hidden onChange={onUpload} />
          <Tooltip title="Upload a custom mockup image (replaces primary)">
            <IconButton size="small" onClick={() => singleFileRef.current?.click()}
              sx={{ color: item.customMockupDataUrl ? D.green : D.muted, border: `1px solid ${item.customMockupDataUrl ? D.lineHi : D.line}`, borderRadius: 1.5,
                transition: 'color 0.18s ease, border-color 0.18s ease',
                '&:hover': { color: D.green, borderColor: D.lineHi } }}>
              <FileUploadOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
        {hasBack && (
          <FormControlLabel
            control={<Switch size="small" checked={!!item.showBack}
              onChange={e => onUpdate({ showBack: e.target.checked })} />}
            label={<Typography sx={{ color: D.muted, fontSize: 11 }}>Show back too</Typography>}
            sx={{ mt: 0.3 }}
          />
        )}

        {/* Variant snapshots — for multi-color items like headbands */}
        <Box sx={{ mt: 0.8 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.3}>
            <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Variants · {snapshots.length}
            </Typography>
            <input ref={multiFileRef} type="file" accept="image/*" multiple hidden onChange={onUploadMulti} />
            <Button size="small" onClick={() => multiFileRef.current?.click()}
              startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 13 }} />}
              sx={{ color: D.green, fontSize: 11, textTransform: 'none', borderRadius: 999,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Add variants
            </Button>
          </Stack>
          {snapshots.length > 0 && (
            <Stack direction="row" gap={0.6} flexWrap="wrap">
              {snapshots.map((s, i) => (
                <Box key={i} sx={{ position: 'relative', width: 64 }}>
                  <Box component="img" src={s.dataUrl} alt=""
                    sx={{ width: 64, height: 64, objectFit: 'contain', bgcolor: '#fff',
                      borderRadius: 1.5, border: `1px solid ${D.line}` }} />
                  <TextField size="small" value={s.label || ''}
                    placeholder="label"
                    onChange={e => onUpdate({
                      mockupSnapshots: snapshots.map((x, j) => j === i ? { ...x, label: e.target.value } : x),
                    })}
                    sx={{ ...dropInput, mt: 0.3,
                      '& .MuiInputBase-input': { color: D.text, fontSize: 10, py: 0.2, textAlign: 'center' } }} />
                  <IconButton size="small" onClick={() => removeSnapshot(i)}
                    sx={{
                      position: 'absolute', top: -8, right: -8, p: 0.2, bgcolor: D.bg,
                      color: '#f87171', border: `1px solid ${D.line}`,
                      '&:hover': { bgcolor: D.panelHi },
                    }}>
                    <CloseIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Product naming */}
      <Box sx={{ mb: 1 }}>
        <SmallField label="Product name (overrides brand+style on confirmation)"
          value={item.productName} onChange={v => onUpdate({ productName: v })} />
      </Box>

      {/* Garment fields */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.6, mb: 1 }}>
        <SmallField label="Brand"      value={item.brandName} onChange={v => onUpdate({ brandName: v })} />
        <SmallField label="Style code" value={item.styleCode} onChange={v => onUpdate({ styleCode: v })} />
        <Box>
          <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.2 }}>
            Print type
          </Typography>
          <Select size="small" value={item.printType || ''}
            onChange={e => onUpdate({ printType: e.target.value })}
            displayEmpty fullWidth
            sx={{ ...dropInput['& .MuiOutlinedInput-root'], color: D.text, fontSize: 12, borderRadius: 2,
              '& .MuiSelect-icon': { color: D.muted } }}>
            <MenuItem value=""><em>—</em></MenuItem>
            {PRINT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </Box>
        <SmallField label="Color"      value={item.color}     onChange={v => onUpdate({ color: v })} />
        <Box sx={{ gridColumn: '1 / -1' }}>
          <SmallField label="Printer (who's printing this)"
            value={item.printerName} onChange={v => onUpdate({ printerName: v })} />
        </Box>
      </Box>

      {/* Sizes */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.3}>
          <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Sizes · {item.sizes.length}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Take the unit $ from the first size that has one and apply it to all sizes">
              <span>
                <Button size="small"
                  onClick={() => {
                    const first = item.sizes.find(s => Number(s.unitPrice) > 0);
                    if (!first) { alert('Type a unit price in any size first, then click "$ to all" to copy it across.'); return; }
                    onUpdate({ sizes: item.sizes.map(s => ({ ...s, unitPrice: first.unitPrice })) });
                  }}
                  sx={{ color: D.muted, fontSize: 10, textTransform: 'none', borderRadius: 999, '&:hover': { color: D.green } }}>
                  $ to all
                </Button>
              </span>
            </Tooltip>
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 13 }} />}
              onClick={addSize} sx={{ color: D.green, fontSize: 11, textTransform: 'none', borderRadius: 999,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Size
            </Button>
          </Box>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: '54px 76px 86px 26px',
          gap: 0.4, alignItems: 'center', mb: 0.2,
          fontSize: 9, fontWeight: 700, color: D.faint, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          <Box>Size</Box><Box sx={{ textAlign: 'right' }}>Qty</Box>
          <Box sx={{ textAlign: 'right' }}>Unit $</Box><Box />
        </Box>
        {item.sizes.map((s, sIdx) => (
          <Box key={sIdx} sx={{ display: 'grid', gridTemplateColumns: '54px 76px 86px 26px',
            gap: 0.4, alignItems: 'center', mb: 0.3 }}>
            <TextField size="small" value={s.label} placeholder="M"
              onChange={e => updateSize(sIdx, { label: e.target.value })}
              sx={{ ...dropInput, '& .MuiInputBase-input': { color: D.text, fontSize: 11, py: 0.3, textAlign: 'center' } }} />
            <TextField size="small" type="number" value={s.qty || ''}
              onChange={e => updateSize(sIdx, { qty: Number(e.target.value) || 0 })}
              sx={{ ...dropInput, ...noSpinner, '& .MuiInputBase-input': { color: D.text, fontSize: 11, py: 0.3, textAlign: 'right', ...mono } }} />
            <TextField size="small" type="number" value={s.unitPrice || ''}
              onChange={e => updateSize(sIdx, { unitPrice: Number(e.target.value) || 0 })}
              sx={{ ...dropInput, ...noSpinner, '& .MuiInputBase-input': { color: D.text, fontSize: 11, py: 0.3, textAlign: 'right', ...mono } }} />
            <IconButton size="small" onClick={() => removeSize(sIdx)}
              sx={{ color: D.muted, p: 0.2, '&:hover': { color: '#f87171' } }}>
              <RemoveCircleOutlineIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Box>
        ))}
      </Box>

      {/* Per-location quantity allocator — only when destinations exist */}
      {(shipTos || []).length > 0 && (
        <ItemAllocator item={item} shipTos={shipTos} onUpdate={onUpdate} noSpinner={noSpinner} />
      )}
    </Box>
  );
}

// Per-location quantity allocator for one item. Renders a small qty input per
// destination plus a live check that the allocations sum to the item's total
// size quantity. The check WARNS (amber) but never blocks saving — partial
// splits are valid while the owner is still distributing.
function ItemAllocator({ item, shipTos, onUpdate, noSpinner }) {
  const total = itemTotalQty(item);
  const allocated = allocatedQty(item, shipTos);
  const remaining = total - allocated;
  const balanced = total > 0 && remaining === 0;

  const setAlloc = (key, qty) => {
    const existing = Array.isArray(item.allocations) ? item.allocations : [];
    const has = existing.some(a => a.key === key);
    const next = has
      ? existing.map(a => a.key === key ? { ...a, qty } : a)
      : [...existing, { key, qty }];
    onUpdate({ allocations: next });
  };

  return (
    <Box sx={{ mt: 1, pt: 1, borderTop: `1px dashed ${D.line}` }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.4}>
        <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Ship to · per location
        </Typography>
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, ...mono,
          color: balanced ? D.green : (allocated === 0 ? D.faint : D.amber) }}>
          {allocated}/{total}{balanced ? ' ✓' : (remaining > 0 ? ` · ${remaining} left` : ` · ${-remaining} over`)}
        </Typography>
      </Stack>
      <Stack gap={0.3}>
        {shipTos.map((st, i) => (
          <Box key={st.key || i} sx={{ display: 'grid', gridTemplateColumns: '1fr 66px', gap: 0.5, alignItems: 'center' }}>
            <Typography sx={{ color: D.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {st.label || st.name || st.cityStateZip || `Location ${i + 1}`}
            </Typography>
            <TextField size="small" type="number" value={allocFor(item, st.key) || ''}
              placeholder="0"
              onChange={e => setAlloc(st.key, Number(e.target.value) || 0)}
              sx={{ ...dropInput, ...noSpinner, '& .MuiInputBase-input': { color: D.text, fontSize: 11, py: 0.3, textAlign: 'right', ...mono } }} />
          </Box>
        ))}
      </Stack>
      {total > 0 && !balanced && allocated > 0 && (
        <Typography sx={{ color: D.amber, fontSize: 9.5, mt: 0.4 }}>
          {remaining > 0
            ? `${remaining} unit${remaining === 1 ? '' : 's'} not assigned to a location yet.`
            : `${-remaining} unit${-remaining === 1 ? '' : 's'} more than this item’s total.`}
        </Typography>
      )}
    </Box>
  );
}

function Section({ title, action, children }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.6}>
        <Typography sx={{ color: D.green, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase' }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

function SmallField({ label, value, onChange, type = 'text' }) {
  return (
    <Box>
      <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.25 }}>
        {label}
      </Typography>
      <TextField size="small" fullWidth type={type} value={value || ''}
        onChange={e => onChange(e.target.value)}
        sx={{ ...dropInput, '& .MuiInputBase-input': { color: D.text, fontSize: 12, py: 0.5 } }}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined} />
    </Box>
  );
}

// ── (removed) Preview / ItemPreview / InfoRow / SpecRow ──────────────────────
// The builder's printable white "Excel-style" preview was replaced by the
// shared ConfirmationDocument (src/screens/ConfirmationDocument.js), which the
// live preview pane above and the public ApprovalView client page both render —
// so the preview is now byte-identical to what the client sees (Nate's WYSIWYG
// ask). The PDF (controllers/confirmationPdf.js) stays visually reconciled with
// it (same lines, Subtotal row, totals order).


// ── Helpers ──────────────────────────────────────────────────────────────────

// For a fresh confirmation seed: figure out which jpstudio mockups belong to
// this project (by explicit mockupNumbers, falling back to client-name slug)
// and return their #s in a sensible order so we can distribute them across
// the seeded items. Mirrors OrderTracker.autoMockupsFor.
function inferMockupNumsFor(project, mockups) {
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const norm = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();
  const byNorm = {};
  (mockups || []).forEach(m => {
    const k = norm(m.pageState && m.pageState.mockupNum);
    if (k) byNorm[k] = m;
  });
  const out = [];
  const seen = new Set();
  // 1) Explicit mockupNumbers come first, in the order saved on the project.
  (project.mockupNumbers || []).forEach(n => {
    const k = norm(n);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(n);
  });
  // 2) Auto-matched by client/title slug.
  const projSlugs = [project.companyName, project.clientName].map(slug).filter(Boolean);
  (mockups || []).forEach(m => {
    const k = norm(m.pageState && m.pageState.mockupNum);
    if (!k || seen.has(k)) return;
    const mClient = slug((m.pageState && m.pageState.client) || m.client || '');
    const mTitle  = slug(String(m.name || '').replace(/\s+merch\s*$/i, ''));
    const exact = projSlugs.some(ps => ps && (ps === mClient || ps === mTitle));
    const fuzzy = !exact && projSlugs.some(ps => {
      if (!ps || ps.length < 4) return false;
      const cand = [mClient, mTitle].filter(c => c && c.length >= 4);
      return cand.some(c => ps.startsWith(c) || c.startsWith(ps) || ps.includes(c) || c.includes(ps));
    });
    if (exact || fuzzy) {
      seen.add(k);
      out.push(m.pageState.mockupNum);
    }
  });
  return out;
}

// Once the client has picked options, only their accepted lines (plus
// standalone ungrouped lines and any group added after the pick, which has no
// accepted line yet) belong on the confirmation — mirrors computeQuoteTotals
// on the backend.
function chosenQuoteLines(lines) {
  const arr = Array.isArray(lines) ? lines : [];
  if (!arr.some(l => l && l.accepted)) return arr;
  const decided = new Set(arr.filter(l => l && l.accepted).map(l => l.group));
  return arr.filter(l => l && (l.accepted || !l.group || !decided.has(l.group)));
}

// Stable dedupe key for the "+From quote" import (H4): style + color + the print
// VARIANT (type + details), so two lines differing only by decoration stay
// distinct. Works for both a quote line and a seeded confirmation item (both
// carry styleCode/color/printType/printDetails). Mirrors backend utils/poCost
// lineKey.
function quoteVariantKey(o) {
  return [o && (o.styleCode || ''), o && (o.color || ''), o && (o.printType || ''), o && (o.printDetails || '')]
    .map(s => String(s || '').trim().toLowerCase()).join('|');
}

function seedItemFromQuote(line) {
  const description = line.description || '';
  // Carry the quote line's true cost/unit (blank + print + setup/ship spread
  // over its qty) so the order's COGS can be derived from the confirmation.
  // Internal only — never rendered on the client-facing doc.
  const q = Number(line.qty) || 0;
  const setupShip = Math.max(0, Number(line.setupCost) || 0) + Math.max(0, Number(line.shippingCost) || 0);
  const unitCost = (Number(line.blankCost) || 0) + (Number(line.printCost) || 0) + (q > 0 ? setupShip / q : 0);
  return {
    // Carry the line's art too (its studio mockup # or uploaded render), so the
    // "+ From quote" path lands with the design attached, not just text. The
    // fresh-open path still overrides with positional auto-matched mockups.
    mockupNum: line.mockupNum || '', customMockupDataUrl: line.image || '',
    mockupSnapshots: [], showBack: false,
    // Faithful to what the client actually picked: their option's product label
    // is the productName, so the confirmation shows the same thing they approved
    // (e.g. "Small Rolling Trays") instead of a mangled first-word brand guess.
    productName: description,
    brandName: description.split(/\s/)[0] || '',
    styleCode: line.styleCode || '',
    printType: line.printType || '',
    // Carry the decoration detail (e.g. "1 color front") so a print VARIANT
    // (same style/color/printType, different details) survives onto the item and
    // the "+From quote" dedupe stays variant-accurate across reloads (H4). Also
    // sharpens the PO cost-recovery match on the backend (utils/poCost lineKey).
    printDetails: line.printDetails || '',
    color:     line.color || '',
    printerName: line.supplier || '',
    unitCost:  +unitCost.toFixed(4),
    // Carry the QUANTITY the client picked onto one "OS" (one-size) row at the
    // approved unit price, so the confirmation opens ~complete with the real
    // order total — not $0 with seven empty size rows. The owner splits this into
    // real garment sizes (XS–3XL) when needed; for non-garment items (trays,
    // glass, stickers) it's already correct.
    sizes:     [{ label: 'OS', qty: q, unitPrice: Number(line.unitPrice) || 0 }],
  };
}

function computeTotals(conf) {
  const itemsSubtotal = (conf.items || []).reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0),
    0);
  const locationTax = confLocationTax(conf);
  let running = itemsSubtotal;
  const lines = [];
  (conf.customLines || []).forEach(l => {
    // Double-tax guard (C3): drop a legacy tax customLine from BOTH the preview
    // lines and the running total when per-location tax is active — per-location
    // tax wins. Mirrors backend computeConfirmationTotals.
    if (locationTax.active && isTaxCustomLine(l)) return;
    const value = l.isPercent
      ? running * (Number(l.amount) || 0) / 100
      : Number(l.amount) || 0;
    running += value;
    lines.push({ label: l.label || (l.isPercent ? 'Adjustment' : 'Add-on'), amount: l.amount, isPercent: l.isPercent, value });
  });
  // Per-location sales tax (multi-ship-to) — appended as its own lines after
  // the add-ons and added to the total, mirroring the backend grand total and
  // the client approval page. No-op unless a shipTo carries taxRate > 0.
  locationTax.lines.forEach(t => {
    running += t.value;
    lines.push({ label: t.label, amount: t.rate, isPercent: false, value: t.value, isLocationTax: true });
  });
  // Snap the grand total to cents (H4) — matches the backend totalValue.
  return { itemsSubtotal, lines, grandTotal: roundCents(running) };
}

// Pre-share gate (mirrors backend models/Order.js confirmationShareIssues):
// reasons this confirmation must NOT be sent to a client. Returns human-readable
// strings (empty = OK).
//   • H3: no priced line items / $0 grand total — not a real order. Guarded on
//     "no priced items / empty", never "merely small", so a deep discount with
//     real priced items still passes.
//   • C2: an item whose per-location allocations EXCEED its quantity — a broken
//     split must never reach the client (under-allocation is fine; the unsent
//     remainder shows as an "Unassigned" row on the client page).
// Only enforced once the confirmation has content.
function shareIssuesFor(conf) {
  const issues = [];
  const items = (conf && Array.isArray(conf.items)) ? conf.items : [];
  const customLines = (conf && Array.isArray(conf.customLines)) ? conf.customLines : [];
  if (items.length === 0 && customLines.length === 0) return issues;   // empty: handled elsewhere
  const pricedItems = items.filter(it =>
    (it.sizes || []).some(sz => (Number(sz.qty) || 0) > 0 && (Number(sz.unitPrice) || 0) > 0));
  const grandTotal = computeTotals(conf).grandTotal;
  if (pricedItems.length === 0 || grandTotal <= 0) {
    issues.push('This confirmation has no priced line items (the total is $0). Add quantities and unit prices before sharing.');
  }
  const shipTos = (conf && Array.isArray(conf.shipTos)) ? conf.shipTos : [];
  if (shipTos.length > 0) {
    items.forEach((it, i) => {
      const total = itemTotalQty(it);
      const allocated = allocatedQty(it, shipTos);
      if (total > 0 && allocated > total) {
        const name = it.productName || it.brandName || it.styleCode || `Item ${i + 1}`;
        issues.push(`"${name}" is over-allocated across locations (${allocated} of ${total} units assigned). Fix the per-location split before sharing.`);
      }
    });
  }
  return issues;
}

// Whether per-location tax is in play — used to suppress the single "NJ tax"
// preset so a job is never taxed twice.
function hasLocationTax(conf) {
  return confLocationTax(conf).active;
}
