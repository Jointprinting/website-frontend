// src/screens/studio/QuoteBuilder.js
//
// Full-screen quote builder. Each line: qty, style, description, blank cost,
// print type/details, print cost, and its OWN one-time setup + shipping. Setup
// and shipping are per-line because lines are usually alternative options (3
// brands of tee, the client picks one) — each option must carry its full
// setup/shipping, spread across only its own quantity. Markup tier strip
// (5%–70%) per line; manual unit-price override. Sticky footer shows
// units · COGS · profit · margin (red→green) · client total.
//
// Persists `quoteLines` (incl. per-line setupCost/shippingCost), `shipToState`,
// and `printerName` on the project via onSave().

import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton,
  Dialog, DialogContent, FormControl, Select, MenuItem,
} from '@mui/material';
import CloseIcon               from '@mui/icons-material/Close';
import AddCircleOutlineIcon    from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ImageOutlinedIcon       from '@mui/icons-material/ImageOutlined';
import KeyboardArrowUpIcon     from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon   from '@mui/icons-material/KeyboardArrowDown';
import { D, scrollbar, dropInput, fmt, mono, accentBar, useMobileFullScreen } from './_shared';
import { lsGet, lsSet, lsRemove } from '../../common/jpStorage';

const TIERS = [];
for (let p = 5; p <= 70; p += 5) TIERS.push(p);

const PRINT_TYPES = ['Screen Print', 'DTG', 'DTF', 'Embroidery', 'Heat Transfer', 'Vinyl', 'Sublimation', 'None'];

const num = (v) => Number(v) || 0;

// Muted accent hues rotated across line groups so alternative options that
// belong to the same group read as a set at a glance.
const GROUP_HUES = [
  'rgba(125, 211, 252, 0.65)',  // sky
  'rgba(251, 191, 36, 0.60)',   // amber
  'rgba(196, 181, 253, 0.65)',  // violet
  'rgba(94, 234, 212, 0.60)',   // teal
];

// Margin colour spectrum: 0% → red, ~40% → green. Capped so 50%+ stays green.
function marginColor(pct) {
  const hue = Math.max(0, Math.min(135, pct * 3.4));   // 0 → red, 40 → ~136 → green
  return `hsl(${hue.toFixed(0)}, 70%, 55%)`;
}
// Matching translucent chip background for the profit/margin pills.
function marginBg(pct) {
  const hue = Math.max(0, Math.min(135, pct * 3.4));
  return `hsla(${hue.toFixed(0)}, 70%, 55%, 0.14)`;
}

// True per-unit cost for a line: blank + print + this option's full setup +
// shipping spread across its own quantity. The single source of truth used for
// COGS, the markup tiers, and the footer totals.
function lineCogsPerUnit(l) {
  const q = num(l.qty);
  const setupShip = Math.max(0, num(l.setupCost)) + Math.max(0, num(l.shippingCost));
  return num(l.blankCost) + num(l.printCost) + (q > 0 ? setupShip / q : 0);
}

function emptyLine() {
  return {
    qty: 1, styleCode: '', description: '',
    blankCost: 0,
    printType: '', printDetails: '', printCost: 0,
    setupCost: 0, shippingCost: 0,
    markup: 1.4, unitPrice: 0,
  };
}

export default function QuoteBuilder({ open, project, onClose, onSave }) {
  const fullScreen = useMobileFullScreen();
  const [lines,        setLines]        = useState([]);
  const [shipToState,  setShipToState]  = useState('');
  const [printerName,  setPrinterName]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [dirty,        setDirty]        = useState(false);

  // Seed from the freshest source: a local draft (which survives a tab close
  // or crash mid-quote) wins over the server copy. Keyed on project id so an
  // autosave round-trip — which hands us a brand-new project object with the
  // same id — never re-seeds and clobbers in-progress edits.
  useEffect(() => {
    if (!open || !project) return;
    let seed = null;
    const raw = lsGet(`quote-draft:${project._id}`, null);
    if (raw) {
      try { seed = JSON.parse(raw); }
      catch (e) { console.warn('[QuoteBuilder] discarding corrupt draft:', e.message); }
    }
    if (!seed) {
      seed = {
        lines: (project.quoteLines || []).map(l => ({ ...l })),
        shipToState: project.shipToState || '',
        printerName: project.printerName || '',
      };
    }
    setLines(Array.isArray(seed.lines) ? seed.lines.map(l => ({ ...l })) : []);
    setShipToState(seed.shipToState || '');
    setPrinterName(seed.printerName || '');
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?._id]);

  // Mirror every edit into localStorage so a tab close / browser crash mid-quote
  // can't lose work. The debounced server autosave below is the primary net;
  // this is the belt-and-suspenders that survives even an offline crash.
  useEffect(() => {
    if (!open || !project || !dirty) return;
    try { lsSet(`quote-draft:${project._id}`, JSON.stringify({ lines, shipToState, printerName })); }
    catch (e) { /* quota — server autosave still covers us */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?._id, lines, shipToState, printerName, dirty]);

  // No Save button — autosave ~800ms after the last edit. On failure we keep
  // `dirty` set so the next edit (or close) retries; the localStorage draft is
  // the fallback if the user never comes back.
  useEffect(() => {
    if (!open || !dirty || !project) return undefined;
    const t = setTimeout(() => { persist().catch(() => { /* stay dirty, retry later */ }); }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty, lines, shipToState, printerName]);

  // Warn if the tab is closed with an edit still mid-flight to the server.
  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  if (!project) return null;

  const setLine = (i, patch) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setDirty(true);
  };
  const selectTier = (i, pct) => {
    const c = lineCogsPerUnit(lines[i]);   // markup applies over this line's true unit cost
    setLine(i, {
      unitPrice: +(c * (1 + pct / 100)).toFixed(2),
      markup:    +(1 + pct / 100).toFixed(4),
    });
  };
  const addLine    = () => { setLines(prev => [...prev, emptyLine()]); setDirty(true); };
  const removeLine = (i) => { setLines(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); };
  // Reorder a line up/down. Order is what the client sees on the approval
  // page — the array order IS the sort order (Mongo preserves it), so this is
  // all it takes to let Nate arrange the pitch the way he wants to present it.
  const moveLine = (i, dir) => {
    setLines(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  };

  const setMeta = (setter) => (v) => { setter(v); setDirty(true); };

  const persist = async () => {
    setSaving(true);
    try {
      const ok = await onSave({
        quoteLines: lines,
        shipToState,
        printerName,
        // Legacy order-level setup/shipping are retired — per-line now drives
        // every total. Zero them so a stale value can't sneak back into COGS.
        setupCost: 0,
        shippingCost: 0,
      });
      // Only drop the safety net once the server has actually confirmed the
      // save. On failure we keep `dirty` + the draft so nothing is lost.
      if (ok) {
        lsRemove(`quote-draft:${project._id}`);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };
  // Closing just commits — no "unsaved changes?" prompt. The draft in
  // localStorage is the backstop if the final save can't reach the server.
  const closeWithSave = async () => {
    if (dirty) { try { await persist(); } catch (e) { /* draft survives locally */ } }
    onClose();
  };

  const inkInput = {
    ...dropInput,
    '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.9 },
  };

  // Group accents: only groups shared by 2+ lines get a hue — a lone group
  // name isn't a "set" yet, so it stays neutral until a sibling appears.
  const groupNames = [...new Set(lines.map(l => (l.group || '').trim()).filter(Boolean))];
  const accentFor = (g) => {
    const name = (g || '').trim();
    if (!name) return null;
    if (lines.filter(l => (l.group || '').trim() === name).length < 2) return null;
    return GROUP_HUES[groupNames.indexOf(name) % GROUP_HUES.length];
  };

  return (
    <Dialog open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick') return; closeWithSave(); }}
      maxWidth={false} fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: D.bg, color: D.text, border: `1px solid ${D.line}`, borderRadius: fullScreen ? 0 : 3,
        backgroundImage: `radial-gradient(120% 50% at 50% 0%, rgba(74,222,128,0.07), rgba(7,11,9,0) 62%)`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        m: { xs: 1, md: 3 }, maxHeight: '94vh', width: 'calc(100% - 24px)' } }}>
      {/* Header */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: D.panel,
        borderBottom: `1px solid ${D.line}`, px: 2.5, py: 1.35,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={accentBar} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14, flex: 1, letterSpacing: 0.2 }}>
          Quote builder
          <Typography component="span" sx={{ color: D.muted, fontSize: 11, fontWeight: 500, ml: 1 }}>
            Project #{project.projectNumber || '—'}
            {(project.companyName || project.clientName) ? ` · ${project.companyName || project.clientName}` : ''}
          </Typography>
        </Typography>
        {/* Invisible autosave — no Save button. Just a quiet status so the user
            knows their work is being kept without ever having to press a thing. */}
        <Stack direction="row" alignItems="center" gap={0.6} sx={{ mr: 0.5 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            bgcolor: saving ? D.amber : (dirty ? D.faint : D.green),
            boxShadow: saving || !dirty ? `0 0 8px ${saving ? 'rgba(251,191,36,0.6)' : D.glow}` : 'none',
            transition: 'background-color 0.2s ease' }} />
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: D.muted, whiteSpace: 'nowrap' }}>
            {saving ? 'Saving…' : (dirty ? 'Saving soon…' : 'Saved')}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={closeWithSave} sx={{ color: D.muted, '&:hover': { color: D.text } }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, ...scrollbar }}>
        {/* Project-level meta — sticks with the quote so re-quotes don't forget.
            Setup + shipping moved onto each line (each option carries its own). */}
        <Box sx={{ display: 'grid', gap: 1.25, mb: 2.5, maxWidth: 640,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' } }}>
          <QF label="Ship to (state)">
            <TextField size="small" fullWidth value={shipToState} placeholder="PA"
              onChange={e => setMeta(setShipToState)(e.target.value)} sx={inkInput} />
          </QF>
          <QF label="Printer">
            <TextField size="small" fullWidth value={printerName} placeholder="In-house · Heritage · Anchor…"
              onChange={e => setMeta(setPrinterName)(e.target.value)} sx={inkInput} />
          </QF>
        </Box>

        {/* Flow explainer — sets expectations for how a finished quote reaches
            the client, so the pitch → pick → confirm → approve steps are clear. */}
        <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2.5, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
          <Typography sx={{ color: D.green, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', mb: 0.75 }}>
            How this reaches your client
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center" sx={{ color: D.muted, fontSize: 11.5, lineHeight: 1.6 }}>
            {['Build options here', 'Share the link', 'Client picks what they want', 'You build the confirmation', 'They approve + sign off art']
              .map((step, i, a) => (
                <React.Fragment key={step}>
                  <Box component="span" sx={{ color: D.text, fontWeight: 600 }}>
                    <Box component="span" sx={{ color: D.green, fontWeight: 800, ...mono, mr: 0.5 }}>{i + 1}</Box>{step}
                  </Box>
                  {i < a.length - 1 && <Box component="span" sx={{ color: D.faint }}>→</Box>}
                </React.Fragment>
              ))}
          </Stack>
          <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.85, lineHeight: 1.5 }}>
            Group alternatives (3 brands of tee) so the client picks one. They don't have to take everything —
            pitch 10, and they can keep just the 5 they want. Nothing counts toward the project total until they pick.
          </Typography>
        </Box>

        {/* Lines */}
        {/* Shared datalist so typing a group name autocompletes to ones
            already used on this quote. Lines sharing a group are alternative
            options — the client picks ONE per group on the approval page;
            ungrouped lines are always part of the order. */}
        <datalist id="quote-group-options">
          {groupNames.map(g => <option key={g} value={g} />)}
        </datalist>
        {lines.length === 0 ? (
          <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 3, py: 6,
            textAlign: 'center', color: D.muted, bgcolor: D.inset }}>
            <Typography sx={{ fontSize: 13, mb: 1.5 }}>No quote lines yet.</Typography>
            <Button onClick={addLine} startIcon={<AddCircleOutlineIcon />}
              sx={{ color: D.green, textTransform: 'none', fontWeight: 700, borderRadius: 999,
                px: 2, transition: 'background-color 0.18s',
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' },
                '&.Mui-focusVisible': { outline: `2px solid ${D.green}`, outlineOffset: 2 } }}>
              Add the first line
            </Button>
          </Box>
        ) : (
          <Stack gap={2}>
            {lines.map((line, i) => (
              <QuoteLineCard key={i} line={line} accent={accentFor(line.group)} index={i}
                onPatch={(patch) => setLine(i, patch)}
                onSelectTier={(pct) => selectTier(i, pct)}
                onRemove={() => removeLine(i)}
                onMoveUp={i > 0 ? () => moveLine(i, -1) : null}
                onMoveDown={i < lines.length - 1 ? () => moveLine(i, +1) : null} />
            ))}
          </Stack>
        )}

        {lines.length > 0 && (
          <Button onClick={addLine} startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
            sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 12, mt: 1.5,
              borderRadius: 999, px: 1.75, transition: 'background-color 0.18s',
              '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
            Add line
          </Button>
        )}
      </DialogContent>
      {/* No totals footer — every line is an alternative brand/option the client
          picks ONE of, so a summed units/COGS/revenue/profit/margin would be a
          fiction. All the numbers that matter live per-line on each card. */}
    </Dialog>
  );
}

// Downscale an uploaded design render to a compact JPEG data URL so quote
// lines stay light in the order document (vendor renders arrive as multi-MB
// photos; ~700px is plenty for the approval card and the admin preview).
function readDesignImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 700;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

// The design the client signs off when picking this line: a studio mockup #
// and/or an uploaded vendor render (ashtrays etc. have no mockup number).
function DesignAttach({ line, onPatch, tf }) {
  const fileRef = useRef(null);
  return (
    <QF label="Design (mockup # or image)" sx={{ width: { xs: '100%', sm: 230 } }}>
      <Stack direction="row" gap={0.75} alignItems="center">
        <TextField size="small" fullWidth value={line.mockupNum || ''} placeholder="#000061A"
          onChange={e => onPatch({ mockupNum: e.target.value })} sx={tf} />
        <input ref={fileRef} type="file" accept="image/*" hidden
          onChange={async (e) => {
            const f = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!f) return;
            try { onPatch({ image: await readDesignImage(f) }); }
            catch (err) { alert(err.message); }
          }} />
        {line.image ? (
          <Box component="img" src={line.image} alt="" title="Click to replace · the client sees this on the option card"
            onClick={() => fileRef.current?.click()}
            sx={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 1.5, cursor: 'pointer',
              border: `1px solid ${D.lineHi}`, transition: 'box-shadow 0.18s ease',
              '&:hover': { boxShadow: `0 0 0 2px ${D.glow}` } }} />
        ) : (
          <IconButton size="small" title="Upload a vendor render (for items with no mockup #)"
            onClick={() => fileRef.current?.click()}
            sx={{ color: D.muted, border: `1px solid ${D.line}`, borderRadius: 1.5,
              transition: 'color 0.18s ease, border-color 0.18s ease',
              '&:hover': { color: D.green, borderColor: D.green } }}>
            <ImageOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        )}
        {line.image && (
          <IconButton size="small" title="Remove image" onClick={() => onPatch({ image: '' })}
            sx={{ color: D.muted, p: 0.3, '&:hover': { color: '#f87171' } }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Stack>
    </QF>
  );
}

function QuoteLineCard({ line, accent, index, onPatch, onSelectTier, onRemove, onMoveUp, onMoveDown }) {
  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };
  const inputRoot = dropInput['& .MuiOutlinedInput-root'];
  const tf = {
    ...dropInput, ...noSpinner,
    '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.9 },
  };
  // The group field reads as a rounded chip so grouped alternatives feel like
  // a labelled set rather than yet another boxed input.
  const groupChip = {
    ...dropInput,
    '& .MuiOutlinedInput-root': {
      ...dropInput['& .MuiOutlinedInput-root'],
      borderRadius: 999,
      ...(accent ? { '& fieldset': { borderColor: accent, transition: 'border-color 0.18s' } } : {}),
    },
    '& .MuiInputBase-input': { color: D.text, fontSize: 12.5, py: 0.85, px: 1.75 },
  };

  const qty           = num(line.qty);
  const setupShip     = Math.max(0, num(line.setupCost)) + Math.max(0, num(line.shippingCost));
  const setupShipPerUnit = qty > 0 ? setupShip / qty : 0;
  const cogsPerUnit   = lineCogsPerUnit(line);                            // blank + print + setup/ship spread over this line's qty
  const unitPrice = num(line.unitPrice) || cogsPerUnit * (num(line.markup) || 1);
  const lineTotal = qty * unitPrice;
  const profit    = unitPrice - cogsPerUnit;
  const marginPct = unitPrice > 0 ? (profit / unitPrice) * 100 : 0;
  const marginCol = marginColor(marginPct);
  const selectedPct = cogsPerUnit > 0 && num(line.unitPrice) > 0
    ? Math.round((num(line.unitPrice) / cogsPerUnit - 1) * 100)
    : null;

  return (
    <Box sx={{
      border: `1px solid ${D.line}`,
      // Lines that share a group wear a per-group hue down the left edge so
      // alternative options are scannable as a set.
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${D.line}`,
      borderRadius: 3, overflow: 'hidden',
      bgcolor: D.panel,
      transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.2s ease',
      '&:hover': { bgcolor: D.panelHi, borderColor: accent || 'rgba(255,255,255,0.14)',
        ...(accent ? { borderLeftColor: accent } : {}),
        boxShadow: '0 10px 28px rgba(0,0,0,0.34)' },
    }}>
      {/* Line header — what is this option: group chip, product, style, qty */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 1.75, pb: 0.75,
        display: 'flex', alignItems: 'flex-end', gap: 1.25, flexWrap: 'wrap' }}>
        <QF label="Group (client picks 1, or skips)" sx={{ width: { xs: '100%', sm: 190 } }}>
          <TextField size="small" fullWidth value={line.group || ''} placeholder="Bucket Hats"
            inputProps={{ list: 'quote-group-options' }}
            onChange={e => onPatch({ group: e.target.value })} sx={groupChip} />
        </QF>
        <QF label="Product" sx={{ flex: '1 1 200px', minWidth: 160 }}>
          <TextField size="small" fullWidth value={line.description || ''} placeholder="T-shirt · black"
            onChange={e => onPatch({ description: e.target.value })} sx={tf} />
        </QF>
        <QF label="Style" sx={{ flex: '1 1 90px', maxWidth: { sm: 130 } }}>
          <TextField size="small" fullWidth value={line.styleCode || ''} placeholder="SS4500"
            onChange={e => onPatch({ styleCode: e.target.value })} sx={tf} />
        </QF>
        <QF label="Qty" sx={{ width: 76 }}>
          <TextField size="small" fullWidth type="number" value={line.qty ?? ''}
            onChange={e => onPatch({ qty: e.target.value })} sx={tf} />
        </QF>
        <DesignAttach line={line} onPatch={onPatch} tf={tf} />
        {/* Reorder — arrange the pitch the way you want the client to see it. */}
        <Stack sx={{ mb: 0.3 }}>
          <IconButton size="small" onClick={onMoveUp} disabled={!onMoveUp} title="Move up"
            sx={{ color: D.muted, p: 0.15, '&:hover': { color: D.green }, '&.Mui-disabled': { color: D.faint, opacity: 0.35 } }}>
            <KeyboardArrowUpIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton size="small" onClick={onMoveDown} disabled={!onMoveDown} title="Move down"
            sx={{ color: D.muted, p: 0.15, '&:hover': { color: D.green }, '&.Mui-disabled': { color: D.faint, opacity: 0.35 } }}>
            <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
        <IconButton size="small" onClick={onRemove} title="Remove line"
          sx={{ color: D.muted, mb: 0.3, transition: 'color 0.18s, background-color 0.18s',
            '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Costs row — numeric inputs in consistent columns. Setup + shipping
          are the FULL cost for this option; they're spread across its qty in COGS. */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5, display: 'grid', gap: 1.25, alignItems: 'end',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          lg: '150px minmax(150px, 1.4fr) repeat(4, minmax(88px, 1fr)) 120px',
        } }}>
        <QF label="Print type">
          <FormControl size="small" fullWidth sx={{ ...dropInput, '& .MuiOutlinedInput-root': inputRoot }}>
            <Select value={line.printType || ''} displayEmpty
              onChange={e => onPatch({ printType: e.target.value })}
              sx={{ color: D.text, fontSize: 13, borderRadius: 2 }}>
              <MenuItem value=""><em>—</em></MenuItem>
              {PRINT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
        </QF>
        <QF label="Print details">
          <TextField size="small" fullWidth value={line.printDetails || ''} placeholder="1c front + 2c back"
            onChange={e => onPatch({ printDetails: e.target.value })} sx={tf} />
        </QF>
        <QF label="Blank $">
          <TextField size="small" fullWidth type="number" value={line.blankCost ?? ''}
            onChange={e => onPatch({ blankCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Print $">
          <TextField size="small" fullWidth type="number" value={line.printCost ?? ''}
            onChange={e => onPatch({ printCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Setup $ (total)">
          <TextField size="small" fullWidth type="number" value={line.setupCost ?? ''}
            onChange={e => onPatch({ setupCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Ship $ (total)">
          <TextField size="small" fullWidth type="number" value={line.shippingCost ?? ''}
            onChange={e => onPatch({ shippingCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="COGS / unit">
          <Box sx={{ color: D.text, fontSize: 13, fontWeight: 700, ...mono, height: 37,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 1.25,
            border: `1px solid ${D.line}`, borderRadius: 2, bgcolor: D.inset }}>
            {cogsPerUnit > 0 ? fmt(cogsPerUnit) : '—'}
          </Box>
        </QF>
      </Box>

      {/* Markup tier strip — a segmented control on an inset darker track.
          Only the SELECTED tier wears the brand green; the rest stay neutral. */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5 }}>
        <Stack direction="row" alignItems="baseline" gap={1} mb={0.75} flexWrap="wrap">
          <Typography sx={{ color: D.green, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Markup tiers
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 10 }}>
            COGS {fmt(cogsPerUnit)}/unit
            {setupShipPerUnit > 0 ? ` (incl. ${fmt(setupShipPerUnit)} setup+ship/unit)` : ''} — click a tier to lock that price
          </Typography>
        </Stack>
        {cogsPerUnit <= 0 ? (
          <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 2.5, py: 1.25,
            textAlign: 'center', color: D.muted, fontSize: 11 }}>
            Enter a blank or print cost to see pricing tiers.
          </Box>
        ) : (
          <Box sx={{ bgcolor: D.inset, border: `1px solid ${D.line}`,
            borderRadius: 2.5, p: 0.5, display: 'flex',
            overflowX: 'auto', scrollSnapType: 'x proximity', ...scrollbar }}>
            {TIERS.map(pct => {
              const price = +(cogsPerUnit * (1 + pct / 100)).toFixed(2);
              const tierProfit = price - cogsPerUnit;   // profit per unit at this margin
              const sel = selectedPct === pct;
              return (
                <Box key={pct} onClick={() => onSelectTier(pct)} sx={{
                  cursor: 'pointer', flex: '1 0 64px', minWidth: 64, textAlign: 'center',
                  py: 0.7, px: 0.5, borderRadius: 1.75, scrollSnapAlign: 'start',
                  bgcolor: sel ? D.green : 'transparent',
                  boxShadow: sel ? `0 2px 12px ${D.glow}` : 'none',
                  transition: 'background-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
                  '&:hover': sel ? {} : { bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateY(-1px)' },
                }}>
                  <Typography sx={{ color: sel ? 'rgba(6,20,12,0.72)' : D.muted, fontSize: 10, fontWeight: 700,
                    transition: 'color 0.18s' }}>
                    +{pct}%
                  </Typography>
                  <Typography sx={{ color: sel ? D.ink : D.text, fontSize: 12, fontWeight: 800,
                    ...mono, transition: 'color 0.18s' }}>
                    {fmt(price)}
                  </Typography>
                  <Typography sx={{ color: sel ? 'rgba(6,20,12,0.72)' : D.muted, fontSize: 9, fontWeight: 600,
                    ...mono, mt: 0.1, transition: 'color 0.18s' }}
                    title="Profit per unit at this margin">
                    {fmt(tierProfit)}/u
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Committed price footer — unit price, profit/margin chips, line total */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, borderTop: `1px solid ${D.line}`,
        bgcolor: D.inset,
        display: 'flex', alignItems: 'flex-end', gap: { xs: 1.5, md: 3 }, flexWrap: 'wrap' }}>
        <QF label="Unit price">
          <TextField size="small" type="number" value={line.unitPrice ?? ''}
            onChange={e => onPatch({ unitPrice: e.target.value })} sx={{ ...tf, width: 130 }} />
        </QF>
        <Box>
          <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', mb: 0.5 }}>
            Profit / unit
          </Typography>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', px: 1.25, py: 0.4,
            borderRadius: 999, bgcolor: marginBg(marginPct), color: marginCol,
            fontSize: 12, fontWeight: 700, ...mono, lineHeight: 1.4,
            transition: 'background-color 0.18s, color 0.18s' }}>
            {fmt(profit)} · {marginPct.toFixed(0)}%
          </Box>
        </Box>
        <Box>
          <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', mb: 0.5 }}>
            Total profit · {qty} unit{qty === 1 ? '' : 's'}
          </Typography>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', px: 1.25, py: 0.4,
            borderRadius: 999, bgcolor: marginBg(marginPct), color: marginCol,
            fontSize: 12, fontWeight: 700, ...mono, lineHeight: 1.4,
            transition: 'background-color 0.18s, color 0.18s' }}>
            {fmt(profit * qty)}
          </Box>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase' }}>
            Total revenue · {qty} unit{qty === 1 ? '' : 's'}
          </Typography>
          <Typography sx={{ color: D.text, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, ...mono, lineHeight: 1.3 }}>
            {fmt(lineTotal)}
          </Typography>
        </Box>
      </Box>

    </Box>
  );
}

function QF({ label, children, sx }) {
  return (
    <Box sx={sx}>
      <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.4 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}
