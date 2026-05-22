// src/screens/studio/QuoteBuilder.js
//
// Full-screen quote builder. Replaces the cramped in-drawer QuoteEditor.
// Each line breaks out its blank + print cost, then shows a strip of markup
// tiers (5%–70%) with the resulting unit price under each — click a tier to
// lock that price onto the line. A manual unit-price override is still there.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton,
  Dialog, DialogContent, FormControl, Select, MenuItem, CircularProgress,
} from '@mui/material';
import CloseIcon               from '@mui/icons-material/Close';
import AddCircleOutlineIcon    from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { B, scrollbar, darkInput, fmt } from './_shared';

// Markup tiers shown on every line: cost + N%. A $10 cost at 10% → $11.
const TIERS = [];
for (let p = 5; p <= 70; p += 5) TIERS.push(p);

const PRINT_TYPES = ['Screen Print', 'DTG', 'DTF', 'Embroidery', 'Heat Transfer', 'Vinyl', 'Sublimation', 'None'];

const num = (v) => Number(v) || 0;

function emptyLine() {
  return {
    qty: 1, styleCode: '', description: '', color: '',
    supplier: '', blankCost: 0,
    printType: '', printDetails: '', printCost: 0,
    markup: 1.4, unitPrice: 0,
  };
}

export default function QuoteBuilder({ open, project, onClose, onSave }) {
  const [lines, setLines]   = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty]   = useState(false);

  useEffect(() => {
    if (open && project) {
      setLines((project.quoteLines || []).map(l => ({ ...l })));
      setDirty(false);
    }
  }, [open, project]);

  const totals = useMemo(() => {
    let qty = 0, cost = 0, price = 0;
    lines.forEach(l => {
      const q = num(l.qty);
      const c = num(l.blankCost) + num(l.printCost);
      const u = num(l.unitPrice) || c * (num(l.markup) || 1);
      qty   += q;
      cost  += q * c;
      price += q * u;
    });
    return {
      qty, cost, price, profit: price - cost,
      marginPct: price > 0 ? ((price - cost) / price) * 100 : 0,
    };
  }, [lines]);

  if (!project) return null;

  const setLine = (i, patch) => {
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setDirty(true);
  };
  const selectTier = (i, pct) => {
    const l = lines[i];
    const c = num(l.blankCost) + num(l.printCost);
    setLine(i, {
      unitPrice: +(c * (1 + pct / 100)).toFixed(2),
      markup:    +(1 + pct / 100).toFixed(4),
    });
  };
  const addLine    = () => { setLines(prev => [...prev, emptyLine()]); setDirty(true); };
  const removeLine = (i) => { setLines(prev => prev.filter((_, idx) => idx !== i)); setDirty(true); };

  const persist = async () => {
    setSaving(true);
    try {
      await onSave({ quoteLines: lines });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };
  const requestClose = () => {
    if (dirty && !window.confirm('You have unsaved quote changes. Close anyway?')) return;
    onClose();
  };

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

      {/* Totals footer */}
      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: B.panel, borderTop: `1px solid ${B.border}`,
        px: 2.5, py: 1.2, display: 'flex', alignItems: 'center', gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
        <FooterStat label="Units"  value={String(totals.qty)} />
        <FooterStat label="Cost"   value={fmt(totals.cost)} />
        <FooterStat label="Profit" value={fmt(totals.profit)}
          accent={totals.profit >= 0 ? B.green : '#f87171'} />
        <FooterStat label="Margin" value={`${totals.marginPct.toFixed(1)}%`}
          accent={totals.marginPct >= 30 ? B.green : '#fbbf24'} />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Quote total
          </Typography>
          <Typography sx={{ color: B.green, fontSize: 22, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1 }}>
            {fmt(totals.price)}
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
}

function FooterStat({ label, value, accent }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ color: accent || B.white, fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>
        {value}
      </Typography>
    </Box>
  );
}

function QuoteLineCard({ line, onPatch, onSelectTier, onRemove }) {
  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };
  const tf = { ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.9 } };

  const cost      = num(line.blankCost) + num(line.printCost);
  const qty       = num(line.qty);
  const unitPrice = num(line.unitPrice) || cost * (num(line.markup) || 1);
  const lineTotal = qty * unitPrice;
  const profit    = unitPrice - cost;
  const marginPct = unitPrice > 0 ? (profit / unitPrice) * 100 : 0;
  const selectedPct = cost > 0 && num(line.unitPrice) > 0
    ? Math.round((num(line.unitPrice) / cost - 1) * 100)
    : null;

  return (
    <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
      {/* Inputs */}
      <Box sx={{ p: 1.5, display: 'grid', gap: 1, alignItems: 'end',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(4, 1fr)',
          lg: '68px 104px 1.4fr 104px 140px 92px 132px 1.4fr 92px 36px',
        } }}>
        <QF label="Qty">
          <TextField size="small" type="number" value={line.qty ?? ''}
            onChange={e => onPatch({ qty: e.target.value })} sx={tf} />
        </QF>
        <QF label="Style">
          <TextField size="small" value={line.styleCode || ''} placeholder="SS4500"
            onChange={e => onPatch({ styleCode: e.target.value })} sx={tf} />
        </QF>
        <QF label="Description">
          <TextField size="small" value={line.description || ''} placeholder="T-shirt"
            onChange={e => onPatch({ description: e.target.value })} sx={tf} />
        </QF>
        <QF label="Color">
          <TextField size="small" value={line.color || ''} placeholder="Black"
            onChange={e => onPatch({ color: e.target.value })} sx={tf} />
        </QF>
        <QF label="Supplier">
          <TextField size="small" value={line.supplier || ''} placeholder="S&S Activewear"
            onChange={e => onPatch({ supplier: e.target.value })} sx={tf} />
        </QF>
        <QF label="Blank $ ea">
          <TextField size="small" type="number" value={line.blankCost ?? ''}
            onChange={e => onPatch({ blankCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Print type">
          <FormControl size="small" fullWidth sx={darkInput}>
            <Select value={line.printType || ''} displayEmpty
              onChange={e => onPatch({ printType: e.target.value })}
              sx={{ color: B.white, fontSize: 13 }}>
              <MenuItem value=""><em>—</em></MenuItem>
              {PRINT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
        </QF>
        <QF label="Print details">
          <TextField size="small" value={line.printDetails || ''} placeholder="1c front + 2c back"
            onChange={e => onPatch({ printDetails: e.target.value })} sx={tf} />
        </QF>
        <QF label="Print $ ea">
          <TextField size="small" type="number" value={line.printCost ?? ''}
            onChange={e => onPatch({ printCost: e.target.value })} sx={tf} />
        </QF>
        <IconButton size="small" onClick={onRemove}
          sx={{ color: B.muted, mb: 0.2, '&:hover': { color: '#f87171' } }}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Markup tier strip */}
      <Box sx={{ px: 1.5, pb: 0.5 }}>
        <Stack direction="row" alignItems="baseline" gap={1} mb={0.5} flexWrap="wrap">
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Markup tiers
          </Typography>
          <Typography sx={{ color: B.muted, fontSize: 10 }}>
            cost {fmt(cost)}/unit — click a tier to lock that price
          </Typography>
        </Stack>
        {cost <= 0 ? (
          <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, py: 1, textAlign: 'center',
            color: B.muted, fontSize: 11 }}>
            Enter a blank or print cost to see pricing tiers.
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto', ...scrollbar }}>
            <Box sx={{ display: 'grid', gap: 0.5,
              gridTemplateColumns: `repeat(${TIERS.length}, minmax(60px, 1fr))` }}>
              {TIERS.map(pct => {
                const price = +(cost * (1 + pct / 100)).toFixed(2);
                const sel = selectedPct === pct;
                return (
                  <Box key={pct} onClick={() => onSelectTier(pct)} sx={{
                    cursor: 'pointer', borderRadius: 1, py: 0.6, textAlign: 'center',
                    border: `1px solid ${sel ? B.green : B.border}`,
                    bgcolor: sel ? 'rgba(74,222,128,0.16)' : 'rgba(255,255,255,0.02)',
                    transition: 'border-color 0.1s',
                    '&:hover': { borderColor: B.green },
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

      {/* Committed price + line total */}
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
          <Typography sx={{ color: profit >= 0 ? B.green : '#f87171', fontSize: 13, fontWeight: 800, fontFamily: 'monospace' }}>
            {fmt(profit)} · {marginPct.toFixed(0)}%
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Line total · {qty} unit{qty === 1 ? '' : 's'}
          </Typography>
          <Typography sx={{ color: B.green, fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>
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
