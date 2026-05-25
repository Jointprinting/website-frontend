// src/screens/studio/ConfirmationBuilder.js
//
// The operational confirmation page builder. This is the doc the user sends
// to a client AFTER they approve the quote and pick a subset of items —
// "I want 50 of these in M/L/XL, 25 of those in S/M/L, ship to NYC."
//
// Layout: editor on the left (controls), live preview on the right (the
// printable / shareable doc). On narrow screens they stack.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton,
  Dialog, DialogContent, FormControlLabel, Switch, CircularProgress, MenuItem, Select, Tooltip,
} from '@mui/material';
import CloseIcon              from '@mui/icons-material/Close';
import PictureAsPdfIcon       from '@mui/icons-material/PictureAsPdf';
import ShareIcon              from '@mui/icons-material/Share';
import AddCircleOutlineIcon   from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import DesignServicesIcon     from '@mui/icons-material/DesignServices';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import axios from 'axios';
import config from '../../config.json';
import { B, scrollbar, darkInput, fmt } from './_shared';
import jpLogoColored from '../../modules/images/logo_colored.webp';

// Absolute URL so the logo also resolves inside the about:blank print popup.
const BRAND_LOGO = `${window.location.origin}${jpLogoColored}`;

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

function emptyItem() {
  return {
    mockupNum: '', customMockupDataUrl: '', mockupSnapshots: [], showBack: false,
    productName: '', brandName: '', styleCode: '', printType: '', color: '', printerName: '',
    sizes: DEFAULT_SIZES.map(s => ({ label: s, qty: 0, unitPrice: 0 })),
  };
}

export default function ConfirmationBuilder({ open, project, mockupMap, mockups, logo, token, onClose, onSave, onShareApproval }) {
  const [local, setLocal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);

  // Load the draft on open. Order of precedence:
  //   1. A localStorage draft for this project (always wins — if you typed
  //      anything since the last server save, that's the freshest copy).
  //   2. The server's saved confirmation.
  //   3. A sensible seed pulled from project + quote lines.
  useEffect(() => {
    if (!project) return;
    const key = `confirmation-draft:${project._id}`;
    let restored = false;
    let seed;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) { seed = JSON.parse(raw); restored = true; }
    } catch (_) {}
    if (!seed) {
      if (project.confirmation && Object.keys(project.confirmation).length > 0) {
        seed = project.confirmation;
      } else {
        // Fresh seed. Distribute the project's auto-matched mockups across
        // the seeded items in order — so a 3-line quote with 3 mockups in
        // jpstudio comes up with each item pre-attached to its mockup.
        const matchedNums = inferMockupNumsFor(project, mockups);
        const items = (project.quoteLines || []).map((line, i) =>
          ({ ...seedItemFromQuote(line), mockupNum: matchedNums[i] || '' }),
        );
        seed = {
          orderTitle:  `${project.companyName || project.clientName || ''} Merch`.trim(),
          orderDate:   project.orderDate || new Date().toISOString(),
          shipping:    { name: project.companyName || '', attention: project.clientName || '', streetAddress: '', cityStateZip: '' },
          items,
          customLines: [],
        };
      }
    }
    setLocal(JSON.parse(JSON.stringify(seed)));
    setDirty(false);
    setRestoredFromDraft(restored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?._id]);

  // Track whether the most recent localStorage write succeeded so we can warn
  // the user if their draft isn't actually being saved (quota exceeded after
  // a few big mockups will silently lose every edit otherwise).
  const [draftSaveError, setDraftSaveError] = useState('');

  // Persist every edit to localStorage so an accidental backdrop click,
  // tab close, or browser crash can't kill the user's work.
  useEffect(() => {
    if (!project || !local) return;
    try {
      window.localStorage.setItem(`confirmation-draft:${project._id}`, JSON.stringify(local));
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

  const update = (patch) => { setLocal(prev => ({ ...prev, ...patch })); setDirty(true); };

  const persist = async () => {
    setSaving(true);
    try {
      await onSave({ confirmation: local });
      // Server confirmed — drop the local draft.
      try { window.localStorage.removeItem(`confirmation-draft:${project._id}`); } catch (_) {}
      setDirty(false);
      setRestoredFromDraft(false);
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
  const shareApproval = async () => {
    if (!onShareApproval) return;
    setShareBusy(true);
    try {
      if (dirty) await persist();
      await onShareApproval();
    } finally { setShareBusy(false); }
  };

  // Closing the dialog now auto-saves dirty changes instead of asking. The
  // localStorage draft was the safety net before; now we just commit on close.
  const closeWithSave = async () => {
    if (dirty) { try { await persist(); } catch (e) { /* draft survives in localStorage */ } }
    onClose();
  };

  const totals = computeTotals(local);

  return (
    <Dialog open={open}
      // Don't close on accidental backdrop click — too much work lives in
      // this dialog to lose to a stray click. X button or Esc is required.
      onClose={(_, reason) => {
        if (reason === 'backdropClick') return;
        closeWithSave();
      }}
      maxWidth={false} fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2,
        m: { xs: 1, md: 3 }, maxHeight: '94vh', width: 'calc(100% - 24px)' } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Confirmation page
          <Typography component="span" sx={{ color: B.muted, fontSize: 11, fontWeight: 500, ml: 1 }}>
            Project #{project.projectNumber || '—'}{saving ? ' · saving…' : (dirty ? ' · saving soon' : ' · saved ✓')}
          </Typography>
        </Typography>
        {onShareApproval && (
          <Button size="small" disabled={shareBusy}
            startIcon={shareBusy
              ? <CircularProgress size={12} sx={{ color: B.green }} />
              : <ShareIcon sx={{ fontSize: 16 }} />}
            onClick={shareApproval}
            sx={{ fontSize: 12, textTransform: 'none', fontWeight: 700, color: B.green,
              '&:hover': { color: '#3bd070' } }}>
            Share for approval
          </Button>
        )}
        <Button size="small" disabled={pdfBusy}
          startIcon={pdfBusy
            ? <CircularProgress size={12} sx={{ color: B.greenDk }} />
            : <PictureAsPdfIcon sx={{ fontSize: 16 }} />}
          onClick={downloadPdf}
          sx={{ fontSize: 12, textTransform: 'none', fontWeight: 700,
            bgcolor: B.green, color: B.greenDk, px: 1.5,
            '&:hover': { bgcolor: '#3bd070' } }}>
          Download PDF
        </Button>
        <IconButton size="small" onClick={closeWithSave}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {restoredFromDraft && (
        <Box sx={{ px: 2.5, py: 0.6, bgcolor: 'rgba(251,191,36,0.12)',
          borderBottom: `1px solid rgba(251,191,36,0.25)`,
          color: '#fbbf24', fontSize: 11, fontWeight: 600 }}>
          Restored from a local draft you didn't save last time. Hit Save when you're done to commit it.
        </Box>
      )}

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
          <Box sx={{ borderRight: { md: `1px solid ${B.border}` }, p: 2, overflow: 'auto', ...scrollbar,
            maxHeight: { md: '85vh' } }}>
            <Editor local={local} update={update} project={project} mockups={mockups} mockupMap={mockupMap} />
          </Box>
          {/* Preview */}
          <Box sx={{ p: { xs: 1.5, md: 3 }, bgcolor: '#e6e6df', overflow: 'auto', ...scrollbar,
            maxHeight: { md: '85vh' } }}>
            <Preview conf={local} project={project} mockupMap={mockupMap}
              clientLogo={logo} totals={totals} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

function Editor({ local, update, project, mockups, mockupMap }) {
  const updateShipping = (patch) => update({ shipping: { ...local.shipping, ...patch } });
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
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
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

      {/* Items */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
          <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Items · {local.items.length}
          </Typography>
          <Box>
            {(project.quoteLines || []).length > 0 && (
              <Tooltip title="Add a quote line as an item">
                <Button size="small"
                  onClick={() => {
                    const used = new Set(local.items.map(i => i.styleCode + '|' + i.color));
                    const next = (project.quoteLines || [])
                      .filter(l => !used.has((l.styleCode || '') + '|' + (l.color || '')))
                      .map(seedItemFromQuote);
                    if (next.length === 0) return;
                    update({ items: [...local.items, ...next] });
                  }}
                  sx={{ color: B.muted, fontSize: 11, textTransform: 'none' }}>
                  + From quote
                </Button>
              </Tooltip>
            )}
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
              onClick={() => addItem()}
              sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
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
              project={project} noSpinner={noSpinner} />
          ))}
          {local.items.length === 0 && (
            <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, p: 2, textAlign: 'center', color: B.muted, fontSize: 12 }}>
              No items yet. Add one for each garment/product the client wants.
            </Box>
          )}
        </Stack>
      </Box>

      {/* Custom lines */}
      <Section title="Add-on lines"
        action={
          <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={() => update({ customLines: [...(local.customLines || []), { label: '', amount: 0, isPercent: false }] })}
            sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
            Add line
          </Button>
        }>
        <Stack gap={0.6}>
          {(local.customLines || []).map((cl, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 28px',
              gap: 0.5, alignItems: 'center' }}>
              <TextField size="small" placeholder="Label (e.g. Shipping reserve)"
                value={cl.label}
                onChange={e => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })}
                sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12 } }} />
              <TextField size="small" type="number" placeholder="0.00"
                value={cl.amount || ''}
                onChange={e => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x) })}
                sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { fontSize: 12, textAlign: 'right' } }} />
              <Tooltip title="Toggle percent vs flat amount">
                <Box onClick={() => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, isPercent: !x.isPercent } : x) })}
                  sx={{ cursor: 'pointer', textAlign: 'center', color: cl.isPercent ? B.green : B.muted, fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                    border: `1px solid ${cl.isPercent ? B.green : B.faint}`, borderRadius: 0.5, py: 0.4 }}>
                  {cl.isPercent ? '%' : '$'}
                </Box>
              </Tooltip>
              <IconButton size="small"
                onClick={() => update({ customLines: local.customLines.filter((_, j) => j !== i) })}
                sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
                <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
          {(local.customLines || []).length === 0 && (
            <Typography sx={{ color: B.muted, fontSize: 11, fontStyle: 'italic' }}>
              No add-ons. Use these for shipping reserve, CC fee (2.99%), discounts, taxes…
            </Typography>
          )}
        </Stack>
      </Section>
    </Stack>
  );
}

function ItemCard({ idx, item, mockups, mockupMap, onUpdate, onRemove, onMove, project, noSpinner }) {
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
  const hasBack = !!(lookedUp && lookedUp.pageState && lookedUp.pageState.backCompositeBase64);
  const snapshots = item.mockupSnapshots || [];

  return (
    <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, p: 1.2, bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Stack direction="row" alignItems="center" gap={0.5} mb={1}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>
          ITEM {idx + 1}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => onMove(-1)} sx={{ color: B.muted, p: 0.3, fontSize: 14 }}>↑</IconButton>
        <IconButton size="small" onClick={() => onMove(1)}  sx={{ color: B.muted, p: 0.3, fontSize: 14 }}>↓</IconButton>
        <IconButton size="small" onClick={onRemove} sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>

      {/* Mockup picker */}
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.3 }}>
          Mockup snapshot
        </Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <Select size="small" displayEmpty fullWidth
            value={item.mockupNum || ''}
            onChange={e => onUpdate({ mockupNum: e.target.value, customMockupDataUrl: '' })}
            sx={{ ...darkInput['& .MuiOutlinedInput-root'], color: B.white, fontSize: 12,
              '& .MuiSelect-icon': { color: B.muted } }}>
            <MenuItem value=""><em>— pick one —</em></MenuItem>
            {projectMockups.map(m => (
              <MenuItem key={m._id} value={m.pageState?.mockupNum || m.name}>
                {(m.pageState?.mockupNum || '—')} · {m.name || 'Untitled'}
              </MenuItem>
            ))}
          </Select>
          <input ref={singleFileRef} type="file" accept="image/*" hidden onChange={onUpload} />
          <Tooltip title="Upload a custom mockup image (replaces primary)">
            <IconButton size="small" onClick={() => singleFileRef.current?.click()}
              sx={{ color: item.customMockupDataUrl ? B.green : B.muted, border: `1px solid ${B.faint}`, borderRadius: 1 }}>
              <FileUploadOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
        {hasBack && (
          <FormControlLabel
            control={<Switch size="small" checked={!!item.showBack}
              onChange={e => onUpdate({ showBack: e.target.checked })} />}
            label={<Typography sx={{ color: B.muted, fontSize: 11 }}>Show back too</Typography>}
            sx={{ mt: 0.3 }}
          />
        )}

        {/* Variant snapshots — for multi-color items like headbands */}
        <Box sx={{ mt: 0.8 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.3}>
            <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Variants · {snapshots.length}
            </Typography>
            <input ref={multiFileRef} type="file" accept="image/*" multiple hidden onChange={onUploadMulti} />
            <Button size="small" onClick={() => multiFileRef.current?.click()}
              startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 13 }} />}
              sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
              Add variants
            </Button>
          </Stack>
          {snapshots.length > 0 && (
            <Stack direction="row" gap={0.6} flexWrap="wrap">
              {snapshots.map((s, i) => (
                <Box key={i} sx={{ position: 'relative', width: 64 }}>
                  <Box component="img" src={s.dataUrl} alt=""
                    sx={{ width: 64, height: 64, objectFit: 'contain', bgcolor: '#fff',
                      borderRadius: 1, border: `1px solid ${B.faint}` }} />
                  <TextField size="small" value={s.label || ''}
                    placeholder="label"
                    onChange={e => onUpdate({
                      mockupSnapshots: snapshots.map((x, j) => j === i ? { ...x, label: e.target.value } : x),
                    })}
                    sx={{ ...darkInput, mt: 0.3,
                      '& .MuiInputBase-input': { color: B.white, fontSize: 10, py: 0.2, textAlign: 'center' } }} />
                  <IconButton size="small" onClick={() => removeSnapshot(i)}
                    sx={{
                      position: 'absolute', top: -8, right: -8, p: 0.2, bgcolor: B.bg,
                      color: '#f87171', border: `1px solid ${B.border}`,
                      '&:hover': { bgcolor: B.bg },
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
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.6, mb: 1 }}>
        <SmallField label="Brand"      value={item.brandName} onChange={v => onUpdate({ brandName: v })} />
        <SmallField label="Style code" value={item.styleCode} onChange={v => onUpdate({ styleCode: v })} />
        <Box>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.2 }}>
            Print type
          </Typography>
          <Select size="small" value={item.printType || ''}
            onChange={e => onUpdate({ printType: e.target.value })}
            displayEmpty fullWidth
            sx={{ ...darkInput['& .MuiOutlinedInput-root'], color: B.white, fontSize: 12,
              '& .MuiSelect-icon': { color: B.muted } }}>
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
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
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
                  sx={{ color: B.muted, fontSize: 10, textTransform: 'none', '&:hover': { color: B.green } }}>
                  $ to all
                </Button>
              </span>
            </Tooltip>
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 13 }} />}
              onClick={addSize} sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
              Size
            </Button>
          </Box>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: '54px 76px 86px 26px',
          gap: 0.4, alignItems: 'center', mb: 0.2,
          fontSize: 9, fontWeight: 700, color: B.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          <Box>Size</Box><Box sx={{ textAlign: 'right' }}>Qty</Box>
          <Box sx={{ textAlign: 'right' }}>Unit $</Box><Box />
        </Box>
        {item.sizes.map((s, sIdx) => (
          <Box key={sIdx} sx={{ display: 'grid', gridTemplateColumns: '54px 76px 86px 26px',
            gap: 0.4, alignItems: 'center', mb: 0.3 }}>
            <TextField size="small" value={s.label} placeholder="M"
              onChange={e => updateSize(sIdx, { label: e.target.value })}
              sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 11, py: 0.3, textAlign: 'center' } }} />
            <TextField size="small" type="number" value={s.qty || ''}
              onChange={e => updateSize(sIdx, { qty: Number(e.target.value) || 0 })}
              sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 11, py: 0.3, textAlign: 'right' } }} />
            <TextField size="small" type="number" value={s.unitPrice || ''}
              onChange={e => updateSize(sIdx, { unitPrice: Number(e.target.value) || 0 })}
              sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 11, py: 0.3, textAlign: 'right' } }} />
            <IconButton size="small" onClick={() => removeSize(sIdx)}
              sx={{ color: B.muted, p: 0.2, '&:hover': { color: '#f87171' } }}>
              <RemoveCircleOutlineIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Section({ title, action, children }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
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
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.2 }}>
        {label}
      </Typography>
      <TextField size="small" fullWidth type={type} value={value || ''}
        onChange={e => onChange(e.target.value)}
        sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.5 } }}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined} />
    </Box>
  );
}

// ── Preview (printable) ──────────────────────────────────────────────────────
// Layout matches the user's Excel template: small brand mark + title at top,
// Basic Info / Shipping Info two-col band, per-item row with mockup(s) on the
// left and a Size/Qty/Unit/Total table on the right with Brand / Style /
// Garment Color / Printer / Print Type labeled below the totals.

function Preview({ conf, project, mockupMap, clientLogo, totals }) {
  return (
    <Box id="confirmation-preview" sx={{
      bgcolor: '#fff', color: '#111', borderRadius: 1, p: { xs: 2, md: 4 },
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxShadow: '0 2px 14px rgba(0,0,0,0.08)', maxWidth: 880, mx: 'auto',
    }}>
      {/* Header band — brand logo + title together (Excel style) */}
      <Stack direction="row" alignItems="center" gap={2} mb={2}>
        <Box component="img" src={BRAND_LOGO} alt="Joint Printing"
          sx={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        <Typography sx={{ fontWeight: 900, fontSize: 26, lineHeight: 1.1, color: '#111', flex: 1 }}>
          {conf.orderTitle || `${project.companyName || 'Untitled'} Merch`}
        </Typography>
        {clientLogo && (
          <Box sx={{ width: 56, height: 56, p: 0.4, border: '1px solid #e6e6e0',
            borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: '#fff', overflow: 'hidden' }}>
            <Box component="img" src={clientLogo} alt=""
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </Box>
        )}
      </Stack>

      {/* Basic Info / Shipping Info */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#111', mb: 0.6 }}>
            Basic Info
          </Typography>
          <InfoRow label="Order Title"  value={conf.orderTitle} />
          <InfoRow label="Client Name"  value={project.clientName || project.companyName} />
          <InfoRow label="Date"         value={conf.orderDate ? new Date(conf.orderDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#111', mb: 0.6 }}>
            Shipping Info
          </Typography>
          <InfoRow label="Shipping Name"   value={conf.shipping.name} />
          <InfoRow label="Attention Name"  value={conf.shipping.attention} />
          <InfoRow label="Street Address"  value={conf.shipping.streetAddress} />
          <InfoRow label="City, State, Zip" value={conf.shipping.cityStateZip} />
        </Box>
      </Box>

      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#111', mb: 0.5 }}>
        Order Info
      </Typography>
      {conf.items.length === 0 ? (
        <Typography sx={{ color: '#999', fontSize: 13, fontStyle: 'italic', mb: 3 }}>
          No items added yet.
        </Typography>
      ) : conf.items.map((it, i) => (
        <ItemPreview key={i} idx={i} item={it} mockupMap={mockupMap} />
      ))}

      {/* Totals + add-ons */}
      <Box sx={{ mt: 3, borderTop: '2px solid #111', pt: 1.5 }}>
        {totals.lines.map((l, i) => (
          <Stack key={i} direction="row" justifyContent="space-between" sx={{ fontSize: 13, py: 0.5, color: '#444' }}>
            <Box>{l.label || (l.isPercent ? 'Adjustment' : 'Add-on')}{l.isPercent ? ` - ${l.amount}%` : ''}</Box>
            <Box sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(l.value)}</Box>
          </Stack>
        ))}
        <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 18, fontWeight: 900, mt: 1, pt: 1, borderTop: '1px solid #111' }}>
          <Box>Grand Total</Box>
          <Box sx={{ fontFamily: 'monospace' }}>{fmt(totals.grandTotal)}</Box>
        </Stack>
      </Box>

      {/* Payment footer */}
      <Box sx={{ mt: 4, fontSize: 11, color: '#555', lineHeight: 1.6 }}>
        <Box>Credit Card Payments: 2.99% charge added to total</Box>
        <Box>ACH Bank Transfers: 1% charge added to total</Box>
        <Box>Venmo: 1.9% + $0.10   @jointprinting</Box>
      </Box>
    </Box>
  );
}

function InfoRow({ label, value }) {
  return (
    <Stack direction="row" sx={{ fontSize: 12.5, py: 0.3, gap: 1 }}>
      <Box sx={{ color: '#111', fontWeight: 700, minWidth: 130 }}>{label}:</Box>
      <Box sx={{ color: '#111' }}>{value || <span style={{ color: '#bbb' }}>—</span>}</Box>
    </Stack>
  );
}

function ItemPreview({ idx, item, mockupMap }) {
  const m = item.mockupNum ? (mockupMap[item.mockupNum] || mockupMap[normMockupKey(item.mockupNum)]) : null;
  const frontImg = item.customMockupDataUrl || (m && m.thumbnail);
  const backImg  = item.showBack && m && m.pageState && m.pageState.backCompositeBase64;
  const snapshots = item.mockupSnapshots || [];
  const hasVariants = snapshots.length > 0;

  const subtotal = item.sizes.reduce((s, x) => s + (Number(x.qty) || 0) * (Number(x.unitPrice) || 0), 0);
  const totalQty = item.sizes.reduce((s, x) => s + (Number(x.qty) || 0), 0);
  const nonZeroSizes = item.sizes.filter(s => Number(s.qty) > 0);
  return (
    <Box className="item-row" sx={{ mt: 2, mb: 2, pb: 2, borderBottom: '1px solid #eee', pageBreakInside: 'avoid' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#111', mb: 1 }}>
        Order Item {idx + 1})
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '300px 1fr' }, gap: 2.5 }}>
        {/* Left: mockup(s) */}
        <Box>
          {hasVariants ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {snapshots.map((s, i) => (
                <Box key={i} sx={{ textAlign: 'center', width: snapshots.length > 3 ? 70 : 92 }}>
                  <Box sx={{ aspectRatio: '1', bgcolor: '#fff', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box component="img" src={s.dataUrl} alt=""
                      sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </Box>
                  {s.label && (
                    <Typography sx={{ fontSize: 11, color: '#444', mt: 0.3 }}>{s.label}</Typography>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Box sx={{ width: backImg ? 140 : 280, aspectRatio: '1', bgcolor: '#fff',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {frontImg
                  ? <Box component="img" src={frontImg} alt=""
                      sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <DesignServicesIcon sx={{ color: '#bbb', fontSize: 36 }} />}
              </Box>
              {backImg && (
                <Box sx={{ width: 140, aspectRatio: '1', bgcolor: '#fff',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box component="img" src={backImg} alt=""
                    sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Right: size table + meta */}
        <Box>
          {nonZeroSizes.length === 0 ? (
            <Box sx={{ color: '#bbb', fontSize: 12, fontStyle: 'italic', mb: 1 }}>No quantities set.</Box>
          ) : (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13,
              border: '1px solid #111' }}>
              <thead>
                <tr style={{ background: '#f6f6f4' }}>
                  <th style={{ textAlign: 'left',  fontSize: 11, color: '#111', padding: '4px 8px', border: '1px solid #ddd', fontWeight: 700 }}>Size</th>
                  <th style={{ textAlign: 'left',  fontSize: 11, color: '#111', padding: '4px 8px', border: '1px solid #ddd', fontWeight: 700 }}>Quantity</th>
                  <th style={{ textAlign: 'right', fontSize: 11, color: '#111', padding: '4px 8px', border: '1px solid #ddd', fontWeight: 700 }}>Unit Price</th>
                  <th style={{ textAlign: 'right', fontSize: 11, color: '#111', padding: '4px 8px', border: '1px solid #ddd', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {nonZeroSizes.map((s, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{s.label}</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{s.qty}</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(s.unitPrice)}</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(s.qty * s.unitPrice)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '4px 8px', border: '1px solid #111', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '4px 8px', border: '1px solid #111', fontWeight: 700 }}>{totalQty}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid #111' }}></td>
                  <td style={{ padding: '4px 8px', border: '1px solid #111', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(subtotal)}</td>
                </tr>
              </tbody>
            </Box>
          )}

          {/* Labeled spec rows underneath the table — match the Excel layout */}
          <Box sx={{ mt: 1, fontSize: 12.5 }}>
            {item.productName && <SpecRow label="Product Name" value={item.productName} />}
            {!item.productName && item.brandName && <SpecRow label="Brand Name" value={item.brandName} />}
            {item.styleCode && <SpecRow label="Style Code" value={item.styleCode} />}
            {item.printType && <SpecRow label="Print Type" value={item.printType} />}
            <SpecRow label="Garment Color"  value={item.color} />
            {/* Printer is internal info — kept off the client-facing confirmation. */}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function SpecRow({ label, value }) {
  if (!value) return null;
  return (
    <Stack direction="row" sx={{ py: 0.15 }}>
      <Box sx={{ minWidth: 130, color: '#111', fontWeight: 700 }}>{label}</Box>
      <Box sx={{ color: '#111' }}>{value}</Box>
    </Stack>
  );
}

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

function seedItemFromQuote(line) {
  // Sensible default: pull style / brand / color / print from quote, leave
  // qty unset so the admin distributes across sizes manually.
  const description = line.description || '';
  const brandGuess = description.split(/\s/)[0] || '';
  return {
    mockupNum: '', customMockupDataUrl: '', mockupSnapshots: [], showBack: false,
    productName: '',
    brandName: brandGuess,
    styleCode: line.styleCode || '',
    printType: line.printType || '',
    color:     line.color || '',
    printerName: line.supplier ? '' : '',
    sizes:     DEFAULT_SIZES.map(s => ({ label: s, qty: 0, unitPrice: Number(line.unitPrice) || 0 })),
  };
}

function computeTotals(conf) {
  const itemsSubtotal = (conf.items || []).reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0),
    0);
  let running = itemsSubtotal;
  const lines = (conf.customLines || []).map(l => {
    const value = l.isPercent
      ? running * (Number(l.amount) || 0) / 100
      : Number(l.amount) || 0;
    running += value;
    return { label: l.label || (l.isPercent ? 'Adjustment' : 'Add-on'), amount: l.amount, isPercent: l.isPercent, value };
  });
  return { itemsSubtotal, lines, grandTotal: running };
}
