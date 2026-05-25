// src/screens/studio/QuoteBuilder.js
//
// Full-screen quote builder. Each line: qty, style, description, blank cost,
// print type/details, print cost. Markup tier strip (5%–70%) per line; manual
// unit-price override. Above the lines: project-wide meta (ship-to state, the
// printer, one-time setup, shipping). Sticky footer shows units · COGS ·
// profit · margin (red→green) · client total.
//
// Persists `quoteLines`, `shipToState`, `printerName`, `setupCost`,
// `shippingCost` on the project via onSave().

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton,
  Dialog, DialogContent, FormControl, Select, MenuItem, CircularProgress, InputAdornment,
} from '@mui/material';
import CloseIcon               from '@mui/icons-material/Close';
import AddCircleOutlineIcon    from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { B, scrollbar, darkInput, fmt } from './_shared';

const TIERS = [];
for (let p = 5; p <= 70; p += 5) TIERS.push(p);

const PRINT_TYPES = ['Screen Print', 'DTG', 'DTF', 'Embroidery', 'Heat Transfer', 'Vinyl', 'Sublimation', 'None'];

const num = (v) => Number(v) || 0;

// Margin colour spectrum: 0% → red, ~40% → green. Capped so 50%+ stays green.
function marginColor(pct) {
  const hue = Math.max(0, Math.min(135, pct * 3.4));   // 0 → red, 40 → ~136 → green
  return `hsl(${hue.toFixed(0)}, 70%, 55%)`;
}

function emptyLine() {
  return {
    qty: 1, styleCode: '', description: '',
    blankCost: 0,
    printType: '', printDetails: '', printCost: 0,
    markup: 1.4, unitPrice: 0,
  };
}

export default function QuoteBuilder({ open, project, onClose, onSave }) {
  const [lines,        setLines]        = useState([]);
  const [shipToState,  setShipToState]  = useState('');
  const [printerName,  setPrinterName]  = useState('');
  const [setupCost,    setSetupCost]    = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [dirty,        setDirty]        = useState(false);

  useEffect(() => {
    if (open && project) {
      setLines((project.quoteLines || []).map(l => ({ ...l })));
      setShipToState(project.shipToState || '');
      setPrinterName(project.printerName || '');
      setSetupCost(project.setupCost ? String(project.setupCost) : '');
      setShippingCost(project.shippingCost ? String(project.shippingCost) : '');
      setDirty(false);
    }
  }, [open, project]);

  const totals = useMemo(() => {
    let qty = 0, blanksAndPrint = 0, lineRevenue = 0;
    lines.forEach(l => {
      const q = num(l.qty);
      const lineUnitCogs = num(l.blankCost) + num(l.printCost);
      const u = num(l.unitPrice) || lineUnitCogs * (num(l.markup) || 1);
      qty            += q;
      blanksAndPrint += q * lineUnitCogs;
      lineRevenue    += q * u;
    });
    // Costs are clamped non-negative so a typo'd "-100" in the shipping
    // field can't fake a higher margin in the live preview. Negative
    // discounts belong on the confirmation builder, not the quote.
    const extras = Math.max(0, num(setupCost)) + Math.max(0, num(shippingCost));
    const clientTotal = lineRevenue + extras;
    const totalCogs   = blanksAndPrint + extras;
    const profit      = clientTotal - totalCogs;
    // Per-unit allocation of the one-time setup + shipping across every unit
    // in the quote — so each line's COGS column reads honestly.
    const setupPerUnit = qty > 0 ? Math.max(0, num(setupCost)) / qty : 0;
    const shipPerUnit  = qty > 0 ? Math.max(0, num(shippingCost)) / qty : 0;
    return {
      qty, cogs: totalCogs, lineRevenue, extras,
      clientTotal, profit,
      setupPerUnit, shipPerUnit,
      marginPct: clientTotal > 0 ? (profit / clientTotal) * 100 : 0,
    };
  }, [lines, setupCost, shippingCost]);

  if (!project) return null;

  const setLine = (i, patch) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setDirty(true);
  };
  const selectTier = (i, pct) => {
    const l = lines[i];
    // Honest "cost" the markup applies to includes the line's blank + print
    // PLUS the allocated setup/shipping per unit, so the locked unit price
    // is the markup over true COGS — matches the COGS column.
    const c = num(l.blankCost) + num(l.printCost) + totals.setupPerUnit + totals.shipPerUnit;
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
      await onSave({
        quoteLines: lines,
        shipToState,
        printerName,
        setupCost:    num(setupCost),
        shippingCost: num(shippingCost),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };
  const requestClose = () => {
    if (dirty && !window.confirm('You have unsaved quote changes. Close anyway?')) return;
    onClose();
  };

  const marginCol = marginColor(totals.marginPct);
  const inkInput  = { ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.85 } };

  return (
    <Dialog open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick') return; requestClose(); }}
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
            {dirty ? ' · unsaved' : ''}
          </Typography>
        </Typography>
        <Button size="small" disabled={saving || !dirty} onClick={persist}
          sx={{ fontSize: 12, textTransform: 'none', fontWeight: 700, px: 1.5,
            bgcolor: dirty ? B.green : 'transparent', color: dirty ? B.greenDk : B.muted,
            '&:hover': { bgcolor: dirty ? '#3bd070' : 'transparent' } }}>
          {saving ? <CircularProgress size={12} sx={{ color: B.greenDk }} /> : (dirty ? 'Save' : 'Saved')}
        </Button>
        <IconButton size="small" onClick={requestClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, ...scrollbar }}>
        {/* Project-level meta — sticks with the quote so re-quotes don't forget */}
        <Box sx={{ display: 'grid', gap: 1, mb: 2,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' } }}>
          <QF label="Ship to (state)">
            <TextField size="small" value={shipToState} placeholder="PA"
              onChange={e => setMeta(setShipToState)(e.target.value)} sx={inkInput} />
          </QF>
          <QF label="Printer">
            <TextField size="small" value={printerName} placeholder="In-house · Heritage · Anchor…"
              onChange={e => setMeta(setPrinterName)(e.target.value)} sx={inkInput} />
          </QF>
          <QF label="Setup cost (one-time)">
            <TextField size="small" type="number" value={setupCost} placeholder="0"
              onChange={e => setMeta(setSetupCost)(e.target.value)} sx={inkInput}
              InputProps={{ startAdornment: <InputAdornment position="start" sx={{ '& .MuiTypography-root': { color: B.muted } }}>$</InputAdornment> }} />
          </QF>
          <QF label="Shipping cost">
            <TextField size="small" type="number" value={shippingCost} placeholder="0"
              onChange={e => setMeta(setShippingCost)(e.target.value)} sx={inkInput}
              InputProps={{ startAdornment: <InputAdornment position="start" sx={{ '& .MuiTypography-root': { color: B.muted } }}>$</InputAdornment> }} />
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
                setupPerUnit={totals.setupPerUnit}
                shipPerUnit={totals.shipPerUnit}
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

      {/* Totals footer — minimal green, margin spectrum carries the visual cue */}
      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: B.panel, borderTop: `1px solid ${B.border}`,
        px: 2.5, py: 1.2, display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 }, flexWrap: 'wrap' }}>
        <FooterStat label="Units"  value={String(totals.qty)} />
        <FooterStat label="COGS"   value={fmt(totals.cogs)} />
        {totals.extras > 0 && (
          <FooterStat label="Setup + Ship" value={fmt(totals.extras)} dim />
        )}
        <FooterStat label="Profit" value={fmt(totals.profit)}
          accent={totals.profit >= 0 ? marginCol : '#f87171'} />
        <Box>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Margin
          </Typography>
          <Typography sx={{ color: marginCol, fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>
            {totals.marginPct.toFixed(1)}%
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Client total
          </Typography>
          <Typography sx={{ color: B.white, fontSize: 22, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1 }}>
            {fmt(totals.clientTotal)}
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
}

function FooterStat({ label, value, accent, dim }) {
  return (
    <Box sx={{ opacity: dim ? 0.6 : 1 }}>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ color: accent || B.white, fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>
        {value}
      </Typography>
    </Box>
  );
}

function QuoteLineCard({ line, setupPerUnit = 0, shipPerUnit = 0, onPatch, onSelectTier, onRemove }) {
  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };
  const tf = { ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.85 } };

  const blankAndPrint = num(line.blankCost) + num(line.printCost);
  const cogsPerUnit   = blankAndPrint + setupPerUnit + shipPerUnit;       // honest unit-cost
  const qty           = num(line.qty);
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
          · print$ · setup (allocated) · ship (allocated) · COGS / unit. */}
      <Box sx={{ p: 1.5, display: 'grid', gap: 1, alignItems: 'end',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          lg: '1.6fr 100px 64px 1.6fr 88px 88px 76px 76px 84px 36px',
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
        <QF label="Setup $ ea">
          <Box sx={{ color: B.muted, fontSize: 13, fontFamily: 'monospace', height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 1,
            border: `1px solid ${B.faint}`, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.02)' }}>
            {setupPerUnit > 0 ? fmt(setupPerUnit) : '—'}
          </Box>
        </QF>
        <QF label="Ship $ ea">
          <Box sx={{ color: B.muted, fontSize: 13, fontFamily: 'monospace', height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 1,
            border: `1px solid ${B.faint}`, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.02)' }}>
            {shipPerUnit > 0 ? fmt(shipPerUnit) : '—'}
          </Box>
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
            COGS {fmt(cogsPerUnit)}/unit — click a tier to lock that price
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
          <Typography sx={{ color: marginCol, fontSize: 13, fontWeight: 800, fontFamily: 'monospace' }}>
            {fmt(profit)} · {marginPct.toFixed(0)}%
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Line total · {qty} unit{qty === 1 ? '' : 's'}
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
