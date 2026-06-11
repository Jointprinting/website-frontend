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

import React, { useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton,
  Dialog, DialogContent, FormControl, Select, MenuItem,
} from '@mui/material';
import CloseIcon               from '@mui/icons-material/Close';
import AddCircleOutlineIcon    from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { B, scrollbar, darkInput, fmt } from './_shared';
import { lsGet, lsSet, lsRemove } from '../../common/jpStorage';

const TIERS = [];
for (let p = 5; p <= 70; p += 5) TIERS.push(p);

const PRINT_TYPES = ['Screen Print', 'DTG', 'DTF', 'Embroidery', 'Heat Transfer', 'Vinyl', 'Sublimation', 'None'];

const num = (v) => Number(v) || 0;

// Margin colour spectrum: 0% → red, ~40% → green. Capped so 50%+ stays green.
function marginColor(pct) {
  const hue = Math.max(0, Math.min(135, pct * 3.4));   // 0 → red, 40 → ~136 → green
  return `hsl(${hue.toFixed(0)}, 70%, 55%)`;
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

  const inkInput  = { ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.85 } };

  return (
    <Dialog open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick') return; closeWithSave(); }}
      maxWidth={false} fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2,
        m: { xs: 1, md: 3 }, maxHeight: '94vh', width: 'calc(100% - 24px)' } }}>
      {/* Header */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Quote builder
          <Typography component="span" sx={{ color: B.muted, fontSize: 11, fontWeight: 500, ml: 1 }}>
            Project #{project.projectNumber || '—'}
            {(project.companyName || project.clientName) ? ` · ${project.companyName || project.clientName}` : ''}
          </Typography>
        </Typography>
        {/* Invisible autosave — no Save button. Just a quiet status so the user
            knows their work is being kept without ever having to press a thing. */}
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: B.muted, mr: 0.5, whiteSpace: 'nowrap' }}>
          {saving ? 'Saving…' : (dirty ? 'Saving soon…' : 'Saved ✓')}
        </Typography>
        <IconButton size="small" onClick={closeWithSave}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, ...scrollbar }}>
        {/* Project-level meta — sticks with the quote so re-quotes don't forget.
            Setup + shipping moved onto each line (each option carries its own). */}
        <Box sx={{ display: 'grid', gap: 1, mb: 2,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)' } }}>
          <QF label="Ship to (state)">
            <TextField size="small" value={shipToState} placeholder="PA"
              onChange={e => setMeta(setShipToState)(e.target.value)} sx={inkInput} />
          </QF>
          <QF label="Printer">
            <TextField size="small" value={printerName} placeholder="In-house · Heritage · Anchor…"
              onChange={e => setMeta(setPrinterName)(e.target.value)} sx={inkInput} />
          </QF>
        </Box>

        {/* Lines */}
        {lines.length === 0 ? (
          <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1.5, py: 6, textAlign: 'center', color: B.muted }}>
            <Typography sx={{ fontSize: 13, mb: 1.5 }}>No quote lines yet.</Typography>
            <Button onClick={addLine} startIcon={<AddCircleOutlineIcon />}
              sx={{ color: B.green, textTransform: 'none', fontWeight: 700 }}>
              Add the first line
            </Button>
          </Box>
        ) : (
          <Stack gap={2}>
            {lines.map((line, i) => (
              <QuoteLineCard key={i} line={line}
                onPatch={(patch) => setLine(i, patch)}
                onSelectTier={(pct) => selectTier(i, pct)}
                onRemove={() => removeLine(i)} />
            ))}
          </Stack>
        )}

        {lines.length > 0 && (
          <Button onClick={addLine} startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
            sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 12, mt: 1.5 }}>
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

function QuoteLineCard({ line, onPatch, onSelectTier, onRemove }) {
  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };
  const tf = { ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.85 } };

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
    <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
      {/* Inputs ordered left-to-right: product · style · qty · print · blank
          · print$ · setup (full) · ship (full) · COGS / unit. Setup + shipping
          are the FULL cost for this option; they're spread across its qty in COGS. */}
      <Box sx={{ p: 1.5, display: 'grid', gap: 1, alignItems: 'end',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          lg: '1.6fr 100px 64px 1.6fr 88px 88px 88px 88px 84px 36px',
        } }}>
        <QF label="Product">
          <TextField size="small" value={line.description || ''} placeholder="T-shirt · black"
            onChange={e => onPatch({ description: e.target.value })} sx={tf} />
        </QF>
        <QF label="Style">
          <TextField size="small" value={line.styleCode || ''} placeholder="SS4500"
            onChange={e => onPatch({ styleCode: e.target.value })} sx={tf} />
        </QF>
        <QF label="Qty">
          <TextField size="small" type="number" value={line.qty ?? ''}
            onChange={e => onPatch({ qty: e.target.value })} sx={tf} />
        </QF>
        <QF label="Print (type + details)">
          <Stack direction="row" gap={0.5}>
            <FormControl size="small" sx={{ ...darkInput, minWidth: 100 }}>
              <Select value={line.printType || ''} displayEmpty
                onChange={e => onPatch({ printType: e.target.value })}
                sx={{ color: B.white, fontSize: 13 }}>
                <MenuItem value=""><em>—</em></MenuItem>
                {PRINT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" value={line.printDetails || ''} placeholder="1c front + 2c back"
              onChange={e => onPatch({ printDetails: e.target.value })} sx={{ ...tf, flex: 1 }} />
          </Stack>
        </QF>
        <QF label="Blank $">
          <TextField size="small" type="number" value={line.blankCost ?? ''}
            onChange={e => onPatch({ blankCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Print $">
          <TextField size="small" type="number" value={line.printCost ?? ''}
            onChange={e => onPatch({ printCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Setup $ (total)">
          <TextField size="small" type="number" value={line.setupCost ?? ''}
            onChange={e => onPatch({ setupCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Ship $ (total)">
          <TextField size="small" type="number" value={line.shippingCost ?? ''}
            onChange={e => onPatch({ shippingCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="COGS / unit">
          <Box sx={{ color: B.white, fontSize: 13, fontWeight: 800, fontFamily: 'monospace', height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 1,
            border: `1px solid ${B.border}`, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)' }}>
            {cogsPerUnit > 0 ? fmt(cogsPerUnit) : '—'}
          </Box>
        </QF>
        <IconButton size="small" onClick={onRemove}
          sx={{ color: B.muted, mb: 0.2, '&:hover': { color: '#f87171' } }}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Markup tier strip — only the SELECTED tier wears the green; the rest stay neutral */}
      <Box sx={{ px: 1.5, pb: 0.5 }}>
        <Stack direction="row" alignItems="baseline" gap={1} mb={0.5} flexWrap="wrap">
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Markup tiers
          </Typography>
          <Typography sx={{ color: B.muted, fontSize: 10 }}>
            COGS {fmt(cogsPerUnit)}/unit
            {setupShipPerUnit > 0 ? ` (incl. ${fmt(setupShipPerUnit)} setup+ship/unit)` : ''} — click a tier to lock that price
          </Typography>
        </Stack>
        {cogsPerUnit <= 0 ? (
          <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, py: 1, textAlign: 'center',
            color: B.muted, fontSize: 11 }}>
            Enter a blank or print cost to see pricing tiers.
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto', ...scrollbar }}>
            <Box sx={{ display: 'grid', gap: 0.5,
              gridTemplateColumns: `repeat(${TIERS.length}, minmax(60px, 1fr))` }}>
              {TIERS.map(pct => {
                const price = +(cogsPerUnit * (1 + pct / 100)).toFixed(2);
                const tierProfit = price - cogsPerUnit;   // profit per unit at this margin
                const sel = selectedPct === pct;
                return (
                  <Box key={pct} onClick={() => onSelectTier(pct)} sx={{
                    cursor: 'pointer', borderRadius: 1, py: 0.6, textAlign: 'center',
                    border: `1px solid ${sel ? B.green : B.border}`,
                    bgcolor: sel ? 'rgba(74,222,128,0.14)' : 'transparent',
                    transition: 'border-color 0.1s, background 0.1s',
                    '&:hover': { borderColor: sel ? B.green : '#666' },
                  }}>
                    <Typography sx={{ color: sel ? B.green : B.muted, fontSize: 10, fontWeight: 700 }}>
                      +{pct}%
                    </Typography>
                    <Typography sx={{ color: sel ? B.green : B.white, fontSize: 12, fontWeight: 800, fontFamily: 'monospace' }}>
                      {fmt(price)}
                    </Typography>
                    <Typography sx={{ color: sel ? B.green : B.muted, fontSize: 9, fontWeight: 600, fontFamily: 'monospace', mt: 0.1 }}
                      title="Profit per unit at this margin">
                      {fmt(tierProfit)}/u
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>

      {/* Committed price + line total + per-unit profit with color-coded margin */}
      <Box sx={{ px: 1.5, py: 1, mt: 0.5, borderTop: `1px solid ${B.faint}`,
        display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <QF label="Unit price">
          <TextField size="small" type="number" value={line.unitPrice ?? ''}
            onChange={e => onPatch({ unitPrice: e.target.value })} sx={{ ...tf, width: 120 }} />
        </QF>
        <Box>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Profit / unit
          </Typography>
          <Typography sx={{ color: marginCol, fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>
            {fmt(profit)} · {marginPct.toFixed(0)}%
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Total profit · {qty} unit{qty === 1 ? '' : 's'}
          </Typography>
          <Typography sx={{ color: marginCol, fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>
            {fmt(profit * qty)}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Total revenue · {qty} unit{qty === 1 ? '' : 's'}
          </Typography>
          <Typography sx={{ color: B.white, fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>
            {fmt(lineTotal)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function QF({ label, children }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.3 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}
