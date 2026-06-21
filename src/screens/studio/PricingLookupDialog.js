// src/screens/studio/PricingLookupDialog.js
//
// Looks a quote line's COST up against a printer's rate card and fills the
// line's Print $ + Setup $. The form is DATA-DRIVEN: it reads the selected
// printer's rate card and shows exactly the inputs that printer's matrix needs
// (garment shade, # colors, imprint size, stitch count, locations…), so adding
// a printer with a different structure needs no UI changes. The price itself
// comes from a deterministic server lookup — no guessing.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton, Dialog, DialogContent,
  FormControl, Select, MenuItem, CircularProgress, Checkbox, FormControlLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { B, darkInput, fmt, scrollbar } from './_shared';
import axios from 'axios';
import config from '../../config.json';

const base = `${config.backendUrl}/api`;
const num = (v) => Number(v) || 0;
const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const METHOD_LABEL = { screen_print: 'Screen print', embroidery: 'Embroidery', dtg: 'DTG', dtf: 'DTF', media: 'Media', personalization: 'Personalization' };
const PRINT_TYPE_FOR = { screen_print: 'Screen Print', dtg: 'DTG', dtf: 'DTF', embroidery: 'Embroidery' };

export default function PricingLookupDialog({ open, authHdr, defaultPrinter, line, shipToState, onApply, onClose }) {
  const [printers, setPrinters] = useState([]);
  const [printer, setPrinter]   = useState('');
  const [card, setCard]         = useState(null);
  const [loadingCard, setLoadingCard] = useState(false);

  const [method, setMethod]   = useState('');
  const [sel, setSel]         = useState('');          // selector value (garment shade / product)
  const [numColors, setNumColors]     = useState(1);
  const [stitchCount, setStitchCount] = useState(5000);
  const [imprintSize, setImprintSize] = useState('');
  const [sides, setSides]             = useState('1');
  const [quantity, setQuantity]       = useState(num(line && line.qty) || 12);
  const [numLocations, setNumLocations] = useState(1);
  const [addOns, setAddOns]   = useState([]);
  const [areaSqIn, setAreaSqIn] = useState(40);

  const [result, setResult] = useState(null);
  const [err, setErr]       = useState('');

  // Printer list on open.
  useEffect(() => {
    if (!open) return undefined;
    let cancel = false;
    setErr('');
    axios.get(`${base}/rate-cards`, authHdr).then((r) => {
      if (cancel) return;
      const list = r.data.rateCards || [];
      setPrinters(list);
      const match = list.find((p) => (p.printerName || '').toLowerCase() === String(defaultPrinter || '').toLowerCase());
      setPrinter((match || list[0] || {}).printerName || '');
    }).catch((e) => !cancel && setErr(e.response?.data?.message || e.message));
    return () => { cancel = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full card when the printer changes.
  useEffect(() => {
    if (!open || !printer) { setCard(null); return undefined; }
    let cancel = false;
    setLoadingCard(true);
    axios.get(`${base}/rate-cards/by-name/${encodeURIComponent(printer)}`, authHdr)
      .then((r) => { if (!cancel) setCard(r.data.rateCard); })
      .catch((e) => { if (!cancel) { setCard(null); setErr(e.response?.data?.message || e.message); } })
      .finally(() => { if (!cancel) setLoadingCard(false); });
    return () => { cancel = true; };
  }, [open, printer]); // eslint-disable-line react-hooks/exhaustive-deps

  const methods = useMemo(() => [...new Set((card?.groups || []).map((g) => g.method))], [card]);
  useEffect(() => { if (methods.length && !methods.includes(method)) setMethod(methods[0]); }, [methods]); // eslint-disable-line

  const methodGroups = useMemo(() => (card?.groups || []).filter((g) => g.method === method), [card, method]);
  const selectorDim = methodGroups[0]?.selectorDim || '';
  const selectorValues = useMemo(
    () => (selectorDim ? [...new Set(methodGroups.map((g) => g.selectorValue).filter(Boolean))] : []),
    [methodGroups, selectorDim]);
  useEffect(() => { if (selectorValues.length && !selectorValues.includes(sel)) setSel(selectorValues[0]); }, [selectorValues]); // eslint-disable-line

  const activeGroup = selectorDim ? methodGroups.find((g) => g.selectorValue === sel) : methodGroups[0];
  const columnAxis = activeGroup?.columnAxis || 'none';
  const columns = useMemo(() => activeGroup?.columns || [], [activeGroup]);
  const perLocation = !!activeGroup?.perLocation;
  const areaPriced = !!activeGroup?.areaPriced;
  // Joint Printing ships to clients from OUT of their state to avoid sales-tax
  // nexus — so warn if the chosen printer sits in the ship-to state.
  const nexusRisk = !!(card && card.state && shipToState &&
    card.state.toUpperCase().includes(String(shipToState).trim().toUpperCase()));
  useEffect(() => {
    if (columnAxis === 'imprint_size' && columns.length && !columns.find((c) => c.key === imprintSize)) setImprintSize(columns[0].key);
  }, [columnAxis, columns]); // eslint-disable-line
  useEffect(() => { setAddOns([]); }, [activeGroup?.id]); // eslint-disable-line

  // Debounced deterministic lookup whenever an input changes.
  useEffect(() => {
    if (!open || !printer || !method || !card) { setResult(null); return undefined; }
    let cancel = false;
    const t = setTimeout(() => {
      const input = {
        printerName: printer, method, quantity: num(quantity), numLocations: num(numLocations),
        numColors: num(numColors), stitchCount: num(stitchCount), imprintSize, sides, areaSqIn: num(areaSqIn),
        garmentShade: selectorDim === 'garment_shade' ? sel : undefined,
        product: selectorDim === 'product' ? sel : undefined,
        selectedAddOns: addOns,
      };
      axios.post(`${base}/rate-cards/lookup`, input, authHdr)
        .then((r) => { if (!cancel) { setResult(r.data); setErr(''); } })
        .catch((e) => { if (!cancel) { setResult(null); setErr(e.response?.data?.message || e.message); } });
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [open, printer, method, sel, numColors, stitchCount, imprintSize, sides, quantity, numLocations, areaSqIn, addOns, card]); // eslint-disable-line

  const apply = () => {
    if (!result || !result.ok) return;
    const patch = { printCost: result.unitPrintCost, setupCost: result.setupCost, supplier: printer };
    if (PRINT_TYPE_FOR[method]) patch.printType = PRINT_TYPE_FOR[method];
    const bits = [];
    if (result.breakdown && result.breakdown.column) bits.push(result.breakdown.column);
    if (selectorDim && sel) bits.push(titleCase(sel));
    if (perLocation && num(numLocations) > 1) bits.push(`${num(numLocations)} locations`);
    patch.printDetails = bits.join(' · ');
    onApply(patch);
    onClose();
  };

  const ink = { ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.85 } };
  const selSx = { color: B.white, fontSize: 13, borderRadius: 1.5, '& .MuiSvgIcon-root': { color: B.muted } };

  const toggleAddOn = (key) =>
    setAddOns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Dialog open={open} onClose={(_, r) => { if (r !== 'backdropClick') onClose(); }}
      maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2, m: { xs: 1, md: 3 } } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: B.panel, borderBottom: `1px solid ${B.border}`,
        px: 2.5, py: 1.2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Printer pricing lookup
          <Typography component="span" sx={{ color: B.muted, fontSize: 11, fontWeight: 500, ml: 1 }}>
            fills Print $ + Setup $ from the matrix
          </Typography>
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: 2.5, ...scrollbar }}>
        {printers.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', color: B.muted, fontSize: 13 }}>
            {err || 'No printer rate cards yet.'}
          </Box>
        ) : (
          <Stack gap={1.5}>
            {/* Printer + method */}
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
              <PF label="Printer">
                <FormControl size="small" fullWidth sx={ink}>
                  <Select value={printer} onChange={(e) => setPrinter(e.target.value)} sx={selSx}>
                    {printers.map((p) => <MenuItem key={p._id} value={p.printerName}>{p.printerName}</MenuItem>)}
                  </Select>
                </FormControl>
              </PF>
              <PF label="Method">
                <FormControl size="small" fullWidth sx={ink} disabled={!methods.length}>
                  <Select value={method} onChange={(e) => setMethod(e.target.value)} sx={selSx}>
                    {methods.map((m) => <MenuItem key={m} value={m}>{METHOD_LABEL[m] || titleCase(m)}</MenuItem>)}
                  </Select>
                </FormControl>
              </PF>
            </Box>

            {nexusRisk && (
              <Box sx={{ border: '1px solid #fbbf24', borderRadius: 1.5, p: 1, bgcolor: 'rgba(251,191,36,0.10)', display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
                <WarningAmberOutlinedIcon sx={{ fontSize: 15, color: '#fbbf24', mt: 0.1 }} />
                <Typography sx={{ color: '#fbbf24', fontSize: 11 }}>
                  {printer} is in {card.state} — same as the ship-to state ({shipToState}). Shipping in-state can create sales-tax nexus; consider an out-of-state printer.
                </Typography>
              </Box>
            )}

            {loadingCard ? (
              <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={20} sx={{ color: B.green }} /></Box>
            ) : (
              <>
                {/* Data-driven inputs */}
                <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {selectorDim && (
                    <PF label={titleCase(selectorDim)}>
                      <FormControl size="small" fullWidth sx={ink}>
                        <Select value={sel} onChange={(e) => setSel(e.target.value)} sx={selSx}>
                          {selectorValues.map((v) => <MenuItem key={v} value={v}>{titleCase(v)}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </PF>
                  )}
                  {columnAxis === 'ink_colors' && (
                    <PF label="# colors (per location)">
                      <TextField size="small" type="number" fullWidth value={numColors}
                        onChange={(e) => setNumColors(e.target.value)} sx={ink} />
                    </PF>
                  )}
                  {columnAxis === 'stitch_band' && (
                    <PF label="Stitch count">
                      <TextField size="small" type="number" fullWidth value={stitchCount}
                        onChange={(e) => setStitchCount(e.target.value)} sx={ink} />
                    </PF>
                  )}
                  {columnAxis === 'imprint_size' && (
                    <PF label="Imprint size">
                      <FormControl size="small" fullWidth sx={ink}>
                        <Select value={imprintSize} onChange={(e) => setImprintSize(e.target.value)} sx={selSx}>
                          {columns.map((c) => <MenuItem key={c.key} value={c.key}>{c.label || c.key}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </PF>
                  )}
                  {columnAxis === 'sides' && (
                    <PF label="Sides">
                      <FormControl size="small" fullWidth sx={ink}>
                        <Select value={sides} onChange={(e) => setSides(e.target.value)} sx={selSx}>
                          {columns.map((c) => <MenuItem key={c.key} value={c.key}>{c.label || c.key}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </PF>
                  )}
                  <PF label="Quantity (pieces)">
                    <TextField size="small" type="number" fullWidth value={quantity}
                      onChange={(e) => setQuantity(e.target.value)} sx={ink} />
                  </PF>
                  {areaPriced && (
                    <PF label="Design area (sq in)">
                      <TextField size="small" type="number" fullWidth value={areaSqIn}
                        onChange={(e) => setAreaSqIn(e.target.value)} sx={ink} />
                    </PF>
                  )}
                  {perLocation && (
                    <PF label="# locations">
                      <TextField size="small" type="number" fullWidth value={numLocations}
                        onChange={(e) => setNumLocations(e.target.value)} sx={ink} />
                    </PF>
                  )}
                </Box>

                {/* Optional add-ons this group offers */}
                {result && result.availableAddOns && result.availableAddOns.length > 0 && (
                  <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, p: 1 }}>
                    <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.5 }}>
                      Add-ons
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {result.availableAddOns.map((a) => (
                        <FormControlLabel key={a.key} sx={{ m: 0, mr: 1 }}
                          control={<Checkbox size="small" checked={addOns.includes(a.key)} onChange={() => toggleAddOn(a.key)}
                            sx={{ color: B.muted, p: 0.4, '&.Mui-checked': { color: B.green } }} />}
                          label={<Typography sx={{ color: B.white, fontSize: 11.5 }}>{a.label}{a.perQuote ? ' (quote)' : ''}</Typography>} />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Result */}
                <Box sx={{ border: `1px solid ${result?.ok ? B.green : B.border}`, borderRadius: 1.5, p: 1.5, bgcolor: 'rgba(0,0,0,0.2)' }}>
                  {result && result.ok ? (
                    <Stack gap={0.75}>
                      <Stack direction="row" gap={3} flexWrap="wrap">
                        <Metric label="Print $ / unit" value={fmt(result.unitPrintCost)} big />
                        <Metric label="Setup $ (total)" value={fmt(result.setupCost)} big />
                      </Stack>
                      {result.breakdown && (
                        <Typography sx={{ color: B.muted, fontSize: 11 }}>
                          {result.breakdown.group} · qty break {result.breakdown.qtyBreak}{result.breakdown.column ? ` · ${result.breakdown.column}` : ''}
                          {result.breakdown.effectiveColors ? ` · ${result.breakdown.effectiveColors} screens (incl. underbase)` : ''}
                          {result.breakdown.locations > 1 ? ` · ${result.breakdown.locations} locations` : ''}
                        </Typography>
                      )}
                    </Stack>
                  ) : (
                    <Typography sx={{ color: B.muted, fontSize: 12.5 }}>{err || 'Adjust the inputs to get a price.'}</Typography>
                  )}
                  {result && result.flags && result.flags.length > 0 && (
                    <Stack gap={0.25} mt={0.75}>
                      {result.flags.map((f, i) => (
                        <Stack key={i} direction="row" gap={0.5} alignItems="center">
                          <WarningAmberOutlinedIcon sx={{ fontSize: 13, color: '#fbbf24' }} />
                          <Typography sx={{ color: '#fbbf24', fontSize: 11 }}>{f}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>

                <Stack direction="row" justifyContent="flex-end" gap={1} mt={0.5}>
                  <Button size="small" onClick={onClose} sx={{ color: B.muted, textTransform: 'none' }}>Cancel</Button>
                  <Button size="small" variant="contained" disabled={!result || !result.ok} onClick={apply}
                    sx={{ bgcolor: B.green, color: B.greenDk, textTransform: 'none', fontWeight: 800,
                      '&:hover': { bgcolor: B.green }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: B.muted } }}>
                    Apply to line
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, big }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ color: B.white, fontSize: big ? 20 : 14, fontWeight: 800, fontFamily: 'monospace' }}>{value}</Typography>
    </Box>
  );
}

function PF({ label, children }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.3 }}>{label}</Typography>
      {children}
    </Box>
  );
}
