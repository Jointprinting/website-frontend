// src/screens/studio/QuoteBuilder.js
//
// Full-screen quote builder. Two ways to author the same `quoteLines`:
//
//   • CLASSIC CARDS — one card per line: qty, style, description, blank cost,
//     print type/details, print cost, its OWN one-time setup + shipping,
//     markup tier strip, manual unit-price override. The shape every quote
//     (including a plain one-item quote) can always fall back to.
//
//   • DESIGN GRIDS — one compact card per DESIGN: brand rows × quantity
//     columns (3 brands × 50/100 = 6 options in one grid instead of 6 cards).
//     A grid is a VIEW over real quote lines, never a separate format: every
//     cell IS one line in `quoteLines`, so the client picker, totals math, and
//     confirmation seeding are untouched, and an in-flight quote can never be
//     corrupted by the grid — a group whose lines don't form a clean
//     brands × quantities matrix simply renders as classic cards. Brand-row /
//     column / design-level edits broadcast to their cells' lines.
//
// Pricing is coherent by construction: a line's unit price is either
// COMMITTED (typed, or locked from a tier click) or AUTO (cost × markup —
// exactly what the server bills a picked line at, see backend
// computeQuoteTotals / the public sanitize). The builder shows which state a
// price is in instead of displaying "0" next to a positive margin; typing 0
// or clearing the field returns the line to AUTO on blur.
//
// Persists `quoteLines` (incl. per-line setupCost/shippingCost/supplierUrl),
// `shipToState`, and `printerName` on the project via onSave().

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
import GridViewOutlinedIcon    from '@mui/icons-material/GridViewOutlined';
import ViewAgendaOutlinedIcon  from '@mui/icons-material/ViewAgendaOutlined';
import OpenInNewIcon           from '@mui/icons-material/OpenInNew';
import LinkIcon                from '@mui/icons-material/Link';
import RedeemOutlinedIcon      from '@mui/icons-material/RedeemOutlined';
import axios                   from 'axios';
import config                  from '../../config.json';
import { D, scrollbar, dropInput, fmt, mono, accentBar, useMobileFullScreen } from './_shared';
import { lsGet, lsSet, lsRemove } from '../../common/jpStorage';
import { quoteRowKey, detectGridRows } from '../../common/quoteGrid';

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

// The price a line actually goes out at: the committed unit price, else
// cost × markup — the SAME fallback (markup default 1.4, never sell-at-cost)
// the backend books with and the public quote page shows, so the builder can
// never display a different number than the client sees.
function lineCommitted(l) { return num(l.unitPrice) > 0; }
function lineEffectivePrice(l) {
  if (lineCommitted(l)) return num(l.unitPrice);
  // `noMarkup` is the promo case: the vendor catalog price already includes
  // margin, so an un-priced cell auto-fills at COST (×1), never the ×1.4 default.
  // COGS is unaffected (lineCogsPerUnit reads the cost fields regardless), so
  // Finances/margins stay correct.
  const m = l.noMarkup ? 1 : (num(l.markup) || 1.4);
  return lineCogsPerUnit(l) * m;
}

function emptyLine() {
  return {
    qty: 1, styleCode: '', description: '',
    blankCost: 0, supplierUrl: '',
    printType: '', printDetails: '', printCost: 0,
    setupCost: 0, shippingCost: 0,
    markup: 1.4, unitPrice: 0,
  };
}

// ── Design grids: detection over the flat lines array ────────────────────────

// Row identity + matrix detection live in src/common/quoteGrid.js — ONE
// definition shared with the client approval page, so a design the builder
// shows as a grid always renders as the matrix picker on the client link.
// This wrapper just re-attaches the builder's line indexes (for broadcast
// edits) on top of the shared core. `entries` is [{ line, idx }] in array
// order; row order follows first appearance.
function detectGrid(group, entries) {
  if (!Array.isArray(entries) || entries.length < 2) return null;
  const core = detectGridRows(entries.map(e => e.line));
  if (!core) return null;
  const cells = new Map(entries.map(e => [`${quoteRowKey(e.line)}@${num(e.line.qty)}`, e]));
  const brands = core.keys.map(bk => {
    const rows = entries.filter(e => quoteRowKey(e.line) === bk);
    return { key: bk, idxs: rows.map(e => e.idx), first: rows[0].line };
  });
  return {
    group, brands, qtys: core.qtys,
    allIdxs: entries.map(e => e.idx),
    cellAt: (bk, q) => cells.get(`${bk}@${q}`) || null,
  };
}

// Best-effort S&S Activewear product URL from what's already typed on the
// line ("Gildan 5000" + style "G5000" → /p/gildan/5000). Suggestion only —
// the owner can always paste any supplier URL by hand.
const SS_BRANDS = [
  ['bella', 'bella_canvas'], ['gildan', 'gildan'], ['next level', 'next_level'],
  ['comfort colors', 'comfort_colors'], ['champion', 'champion'], ['hanes', 'hanes'],
  ['jerzees', 'jerzees'], ['fruit of the loom', 'fruit_of_the_loom'], ['tultex', 'tultex'],
  ['independent', 'independent_trading_co'], ['district', 'district'],
  ['port & company', 'port_company'], ['port and company', 'port_company'],
  ['american apparel', 'american_apparel'], ['los angeles apparel', 'los_angeles_apparel'],
  ['adidas', 'adidas'], ['richardson', 'richardson'], ['yupoong', 'yupoong'],
  ['flexfit', 'flexfit'], ['sport-tek', 'sport_tek'], ['sport tek', 'sport_tek'],
];
function suggestSupplierUrl(line) {
  const d = String(line.description || '').toLowerCase();
  const hit = SS_BRANDS.find(([name]) => d.includes(name));
  // "G5000" / "SS4500" → the numeric style S&S keys on; "3001C" passes through.
  const style = String(line.styleCode || '').trim().replace(/^[a-z]{1,3}(?=\d)/i, '').toLowerCase();
  if (!hit || !style) return '';
  return `https://www.ssactivewear.com/p/${hit[1]}/${style}`;
}

export default function QuoteBuilder({ open, project, onClose, onSave, authHdr }) {
  const fullScreen = useMobileFullScreen();
  const [lines,        setLines]        = useState([]);
  const [shipToState,  setShipToState]  = useState('');
  const [printerName,  setPrinterName]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [dirty,        setDirty]        = useState(false);
  // Groups the owner explicitly opened up as individual cards (per-line
  // control for one odd option). UI-only escape hatch — nothing is stored.
  const [cardView,     setCardView]     = useState(() => new Set());
  // Promo catalog picker state (kept up here with the other hooks — must sit
  // above the early `if (!project) return null` so hook order stays stable).
  const [promoOpen,    setPromoOpen]    = useState(false);
  const [promoItems,   setPromoItems]   = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoErr,     setPromoErr]     = useState('');

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
    setCardView(new Set());
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
  // Broadcast edits — the grid's bread and butter. `idxs` is which lines
  // (a brand's cells, a column, or the whole grid); `patch` an object, or a
  // per-line function for math that depends on each cell's own costs.
  const patchIdxs = (idxs, patch) => {
    const set = new Set(idxs);
    setLines(prev => prev.map((l, i) => (set.has(i) ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l)));
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
  const removeIdxs = (idxs) => {
    const set = new Set(idxs);
    setLines(prev => prev.filter((_, idx) => !set.has(idx)));
    setDirty(true);
  };
  // Grid structural ops: append new cell lines (add brand / add quantity
  // column) and swap two disjoint position sets (reorder brand rows).
  const appendLines = (newLines) => {
    setLines(prev => [...prev, ...newLines.map(l => ({ ...l }))]);
    setDirty(true);
  };

  // ── Promo catalog picker ────────────────────────────────────────────────────
  // Pull fixed-price promo products (lighters, grinders, ashtrays…) straight into
  // the quote as 0%-markup lines — the vendor price already includes margin. The
  // owner's cost rides along as blankCost so the COGS estimate stays honest.
  // (State declared up top with the other hooks.)
  const openPromo = async () => {
    setPromoOpen(true); setPromoErr('');
    if (promoItems.length) return;
    setPromoLoading(true);
    try {
      const r = await axios.get(`${config.backendUrl}/api/promo-catalog`, authHdr || {});
      setPromoItems(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setPromoErr(e.response?.data?.message || e.message || 'Could not load the promo catalog.');
    } finally { setPromoLoading(false); }
  };
  const addPromo = (it, qty) => appendLines([{
    ...emptyLine(),
    qty: Number(qty) || Number(it.minQty) || 1,
    styleCode: it.sku || '',
    description: [it.name, it.color, it.description].filter(Boolean).join(' — '),
    supplier: it.vendor || '',
    blankCost: Number(it.cost) || 0,
    markup: 1,
    noMarkup: true,               // promo = fixed price, already marked up
    unitPrice: Number(it.price) || 0,
  }]);
  const swapLines = (pairs) => {
    setLines(prev => {
      const next = [...prev];
      pairs.forEach(([a, b]) => { [next[a], next[b]] = [next[b], next[a]]; });
      return next;
    });
    setDirty(true);
  };

  // A fresh design grid: one brand row × two quantity columns to start —
  // exactly the "3 brands, 50 and 100 of each" pitch after two Add-brand
  // clicks. Named uniquely so it never collides with an existing group.
  const addGrid = () => {
    const used = new Set(lines.map(l => (l.group || '').trim().toLowerCase()).filter(Boolean));
    let n = 1; while (used.has(`design ${n}`)) n += 1;
    const g = `Design ${n}`;
    const base = { ...emptyLine(), group: g, description: 'Option 1' };
    setLines(prev => [...prev, { ...base, qty: 50 }, { ...base, qty: 100 }]);
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

  // ── Render blocks: grids where a group forms a matrix, cards for the rest ──
  const byGroup = new Map();
  lines.forEach((l, idx) => {
    const g = (l.group || '').trim();
    if (!g) return;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push({ line: l, idx });
  });
  const grids = new Map();
  for (const [g, entries] of byGroup) {
    if (cardView.has(g)) continue;                       // owner opened it up as cards
    const grid = detectGrid(g, entries);
    if (grid) grids.set(g, grid);
  }
  // Blocks in render order. A grid occupies ONE block at its first line's
  // position; every other line is its own block. Reordering moves whole
  // blocks, so a card never lands "inside" a grid.
  const blocks = [];
  const emittedGrids = new Set();
  lines.forEach((l, idx) => {
    const g = (l.group || '').trim();
    if (g && grids.has(g)) {
      if (!emittedGrids.has(g)) {
        emittedGrids.add(g);
        blocks.push({ type: 'grid', grid: grids.get(g), idxs: grids.get(g).allIdxs });
      }
      return;
    }
    blocks.push({ type: 'line', line: l, idx, idxs: [idx] });
  });
  // Move a whole block up/down: rebuild the array as blocks in the new order
  // (as a side effect this makes a scattered grid's lines contiguous — the
  // client page reads groups by first appearance, so presentation order holds).
  const moveBlock = (bi, dir) => {
    const bj = bi + dir;
    if (bj < 0 || bj >= blocks.length) return;
    const order = blocks.map(b => b.idxs);
    [order[bi], order[bj]] = [order[bj], order[bi]];
    setLines(prev => order.flat().map(i => prev[i]));
    setDirty(true);
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
            A design grid pitches one design across options × quantities — options can be brands (3 tees at 50
            and 100 = one grid, not six lines) or print variants (a 6-print vs 7-print front, each row carrying
            its own print + setup cost via the row's ⌄ drawer). The client still picks exactly ONE option per
            design. Groups and single lines work like always: group alternatives so the client picks one;
            ungrouped lines are always included. Nothing counts toward the project total until they pick.
          </Typography>
        </Box>

        {/* Lines / grids */}
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
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="center" alignItems="center">
              <Button onClick={addGrid} startIcon={<GridViewOutlinedIcon sx={{ fontSize: 17 }} />}
                sx={{ color: D.green, textTransform: 'none', fontWeight: 700, borderRadius: 999,
                  px: 2, transition: 'background-color 0.18s',
                  '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' },
                  '&.Mui-focusVisible': { outline: `2px solid ${D.green}`, outlineOffset: 2 } }}>
                Add a design grid
              </Button>
              <Button onClick={addLine} startIcon={<AddCircleOutlineIcon />}
                sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, borderRadius: 999,
                  px: 2, transition: 'background-color 0.18s, color 0.18s',
                  '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.10)' } }}>
                Add a single line
              </Button>
              <Button onClick={openPromo} startIcon={<RedeemOutlinedIcon />}
                sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, borderRadius: 999,
                  px: 2, transition: 'background-color 0.18s, color 0.18s',
                  '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.10)' } }}>
                Promo catalog
              </Button>
            </Stack>
          </Box>
        ) : (
          <Stack gap={2}>
            {blocks.map((b, bi) => b.type === 'grid' ? (
              <DesignGridCard key={`grid-${b.grid.group}`} grid={b.grid} lines={lines}
                accent={accentFor(b.grid.group)}
                onPatchIdxs={patchIdxs}
                onRemoveIdxs={removeIdxs}
                onSetLine={setLine}
                onAppendLines={appendLines}
                onSwapLines={swapLines}
                onEditAsCards={() => setCardView(prev => new Set(prev).add(b.grid.group))}
                onMoveUp={bi > 0 ? () => moveBlock(bi, -1) : null}
                onMoveDown={bi < blocks.length - 1 ? () => moveBlock(bi, +1) : null} />
            ) : (
              <QuoteLineCard key={b.idx} line={b.line} accent={accentFor(b.line.group)} index={b.idx}
                gridable={!!(b.line.group || '').trim() && cardView.has((b.line.group || '').trim())
                  && !!detectGrid((b.line.group || '').trim(), byGroup.get((b.line.group || '').trim()))}
                onViewAsGrid={() => setCardView(prev => {
                  const next = new Set(prev); next.delete((b.line.group || '').trim()); return next;
                })}
                onPatch={(patch) => setLine(b.idx, patch)}
                onSelectTier={(pct) => selectTier(b.idx, pct)}
                onRemove={() => removeLine(b.idx)}
                onMoveUp={bi > 0 ? () => moveBlock(bi, -1) : null}
                onMoveDown={bi < blocks.length - 1 ? () => moveBlock(bi, +1) : null} />
            ))}
          </Stack>
        )}

        {lines.length > 0 && (
          <Stack direction="row" gap={1} sx={{ mt: 1.5 }} flexWrap="wrap">
            <Button onClick={addGrid} startIcon={<GridViewOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 12,
                borderRadius: 999, px: 1.75, transition: 'background-color 0.18s',
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Add design grid
            </Button>
            <Button onClick={addLine} startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
              sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 12,
                borderRadius: 999, px: 1.75, transition: 'background-color 0.18s, color 0.18s',
                '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Add line
            </Button>
            <Button onClick={openPromo} startIcon={<RedeemOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 12,
                borderRadius: 999, px: 1.75, transition: 'background-color 0.18s, color 0.18s',
                '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Promo catalog
            </Button>
          </Stack>
        )}
      </DialogContent>
      {/* Promo catalog picker — fixed-price promos → 0%-markup lines. */}
      <PromoPickerDialog
        open={promoOpen} onClose={() => setPromoOpen(false)}
        items={promoItems} loading={promoLoading} err={promoErr}
        onAdd={addPromo}
      />
    </Dialog>
  );
}

// Lists the active promo catalog; each row adds a fixed-price (0%-markup) line to
// the quote at a chosen quantity. Stays open so several promos can be added in a
// row (dispensary promo orders are often a few items at once).
function PromoPickerDialog({ open, onClose, items, loading, err, onAdd }) {
  const [qty, setQty] = useState({});
  const [added, setAdded] = useState({});
  const q = (it) => Number(qty[it._id]) || Number(it.minQty) || 1;
  const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: D.bg, backgroundImage: 'none', border: `1px solid ${D.line}`, borderRadius: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.75, borderBottom: `1px solid ${D.line}` }}>
        <RedeemOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 16, flexGrow: 1 }}>Promo catalog</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: D.muted }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ ...scrollbar, p: 2 }}>
        {loading ? (
          <Typography sx={{ color: D.muted, fontSize: 13, textAlign: 'center', py: 3 }}>Loading…</Typography>
        ) : err ? (
          <Typography sx={{ color: '#f87171', fontSize: 13, textAlign: 'center', py: 3 }}>{err}</Typography>
        ) : items.length === 0 ? (
          <Typography sx={{ color: D.muted, fontSize: 13, textAlign: 'center', py: 3 }}>
            No promo items yet. Add them in the <b style={{ color: '#fff' }}>Promo Catalog</b> tool (import a vendor quote PDF).
          </Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((it) => (
              <Box key={it._id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
                border: `1px solid ${D.line}`, borderRadius: 2, p: 1.25, bgcolor: D.panel }}>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography sx={{ color: '#fff', fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{it.name}</Typography>
                  <Typography sx={{ color: D.muted, fontSize: 11.5 }}>
                    {[it.category, it.color, money(it.price) + '/ea', it.minQty ? `min ${it.minQty}` : ''].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <TextField type="number" size="small" value={qty[it._id] ?? (it.minQty || 1)}
                  onChange={(e) => setQty((m) => ({ ...m, [it._id]: e.target.value }))}
                  sx={{ ...dropInput, width: 78 }} inputProps={{ min: 1 }} />
                <Button size="small" variant="outlined"
                  onClick={() => { onAdd(it, q(it)); setAdded((m) => ({ ...m, [it._id]: (m[it._id] || 0) + 1 })); }}
                  sx={{ color: D.green, borderColor: D.line, textTransform: 'none', fontWeight: 700, minWidth: 64,
                    '&:hover': { borderColor: D.green, bgcolor: 'rgba(74,222,128,0.10)' } }}>
                  {added[it._id] ? `Added${added[it._id] > 1 ? ` ×${added[it._id]}` : ''}` : 'Add'}
                </Button>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <Box sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${D.line}`, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onClose} sx={{ color: D.green, textTransform: 'none', fontWeight: 700 }}>Done</Button>
      </Box>
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

// A text field that keeps keystrokes local and only commits on blur/Enter.
// Required for anything that feeds a line's IDENTITY (group name, brand
// product/style, a column's quantity): committing per keystroke would re-key
// the grid mid-word and unmount the input under the cursor.
function BufferedTF({ value, onCommit, sx, ...rest }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  return (
    <TextField size="small" value={v} sx={sx} {...rest}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== (value ?? '')) onCommit(v); }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} />
  );
}

// The design the client signs off when picking this line: a studio mockup #
// and/or an uploaded vendor render (ashtrays etc. have no mockup number).
function DesignAttach({ line, onPatch, tf, label = 'Design (mockup # or image)', sx }) {
  const fileRef = useRef(null);
  return (
    <QF label={label} sx={sx || { width: { xs: '100%', sm: 230 } }}>
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

// Supplier product-page link for a blank: paste any URL, or take the S&S
// suggestion built from the product/style already typed. The link is shown to
// the CLIENT on their option card ("view product") — costs never ride along.
function SupplierLink({ line, onPatch, tf, sx }) {
  const url = (line.supplierUrl || '').trim();
  const suggestion = url ? '' : suggestSupplierUrl(line);
  return (
    <QF label="Product link (client sees)" sx={sx}>
      <Stack direction="row" gap={0.5} alignItems="center">
        <TextField size="small" fullWidth value={line.supplierUrl || ''} placeholder="https:// supplier page"
          onChange={e => onPatch({ supplierUrl: e.target.value })} sx={tf} />
        {suggestion ? (
          <IconButton size="small" title={`Auto-link S&S: ${suggestion}`}
            onClick={() => onPatch({ supplierUrl: suggestion })}
            sx={{ color: D.muted, border: `1px solid ${D.line}`, borderRadius: 1.5,
              '&:hover': { color: D.green, borderColor: D.green } }}>
            <LinkIcon sx={{ fontSize: 16 }} />
          </IconButton>
        ) : (
          <IconButton size="small" title={url ? 'Open product page' : 'Paste a product URL first'}
            disabled={!url}
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            sx={{ color: D.muted, border: `1px solid ${D.line}`, borderRadius: 1.5,
              '&:hover': { color: D.green, borderColor: D.green },
              '&.Mui-disabled': { color: D.faint, borderColor: D.line, opacity: 0.5 } }}>
            <OpenInNewIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Stack>
    </QF>
  );
}

// ── The design grid card: one design, option rows × quantity columns ─────────
//
// A ROW is any option the client compares — a brand (Gildan vs Bella) OR a
// print-spec variant of the same garment ("6-print front" vs "7-print front",
// each with its own print + setup cost). Everything edits REAL lines through
// broadcasts:
//   • design-level fields (print type/details, setup, shipping, turnaround,
//     design attach, the group name itself) → every cell in the grid
//   • row fields (product, style, blank $ — and, in the row's cost drawer,
//     per-option print $/unit, setup $, print details, product link) → that
//     row's cells
//   • column fields (quantity, print $/unit) → that column's cells (the
//     50-vs-100 run-size discount lane)
//   • a cell's unit price → that one line
//   • the tier strip → per-cell price at each cell's OWN cost (so every
//     option/quantity prices correctly from one click)
function DesignGridCard({ grid, lines, accent, onPatchIdxs, onRemoveIdxs, onSetLine, onAppendLines, onSwapLines, onEditAsCards, onMoveUp, onMoveDown }) {
  const [openRows, setOpenRows] = useState(() => new Set());   // row cost-drawers (by row POSITION — stable across renames)
  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };
  const inputRoot = dropInput['& .MuiOutlinedInput-root'];
  const tf = {
    ...dropInput, ...noSpinner,
    '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.8 },
  };
  const cellTf = {
    ...dropInput, ...noSpinner,
    '& .MuiInputBase-input': { color: D.text, fontSize: 13.5, fontWeight: 700, py: 0.75, px: 1, textAlign: 'right', ...mono },
  };
  const groupChip = {
    ...dropInput,
    '& .MuiOutlinedInput-root': {
      ...dropInput['& .MuiOutlinedInput-root'],
      borderRadius: 999,
      ...(accent ? { '& fieldset': { borderColor: accent, transition: 'border-color 0.18s' } } : {}),
    },
    '& .MuiInputBase-input': { color: D.text, fontSize: 12.5, py: 0.85, px: 1.75, fontWeight: 700 },
  };

  const all = grid.allIdxs;
  const firstLine = lines[all[0]] || {};
  // A field's display value over a set of line indexes: the shared value when
  // they all agree, '' (placeholder "mixed") when they don't. Typing broadcasts.
  const valOver = (idxs, key) => {
    const vals = [...new Set(idxs.map(i => String(lines[i]?.[key] ?? '')))];
    return vals.length === 1 ? vals[0] : '';
  };
  const mixedOver = (idxs, key) => [...new Set(idxs.map(i => String(lines[i]?.[key] ?? '')))].length > 1;
  // Money/qty fields compare NUMERICALLY: legacy lines mix '' / 0 / '4.5' /
  // 4.5 for the same value, and a string comparison would show "varies" on a
  // column that's actually uniform.
  const numValOver = (idxs, key) => {
    const vals = [...new Set(idxs.map(i => num(lines[i]?.[key])))];
    return vals.length === 1 ? String(vals[0]) : '';
  };
  const numMixedOver = (idxs, key) => [...new Set(idxs.map(i => num(lines[i]?.[key])))].length > 1;
  const sharedVal   = (key) => valOver(all, key);
  const sharedMixed = (key) => mixedOver(all, key);

  const colIdxs = (q) => grid.brands.map(b => (grid.cellAt(b.key, q) || {}).idx).filter(i => i !== undefined);

  // The tier strip highlights a tier only when EVERY cell is committed at it.
  const uniformPct = (() => {
    const pcts = all.map(i => {
      const l = lines[i];
      const c = lineCogsPerUnit(l);
      return c > 0 && num(l.unitPrice) > 0 ? Math.round((num(l.unitPrice) / c - 1) * 100) : null;
    });
    return pcts.every(p => p !== null && p === pcts[0]) ? pcts[0] : null;
  })();

  const applyTier = (pct) => onPatchIdxs(all, (l) => ({
    unitPrice: +(lineCogsPerUnit(l) * (1 + pct / 100)).toFixed(2),
    markup:    +(1 + pct / 100).toFixed(4),
    noMarkup:  false,   // choosing a tier turns off fixed-price
  }));

  // Promo / fixed-price: the vendor catalog already has margin baked in, so this
  // design carries no markup — you type each client price and un-typed cells sit
  // at cost. Toggling ON clears any auto-applied markup prices so they don't look
  // marked up; COGS is untouched either way.
  const fixedPrice = all.length > 0 && all.every(i => lines[i] && lines[i].noMarkup);
  const toggleFixed = () => onPatchIdxs(all, (l) => (
    fixedPrice
      ? { noMarkup: false }
      : { noMarkup: true, ...(lineCommitted(l) ? {} : { unitPrice: 0, markup: 1 }) }
  ));

  const renameGroup = (name) => {
    const v = String(name || '').trim();
    if (v) onPatchIdxs(all, { group: v });
  };
  const setColQty = (oldQ, val) => {
    const q = num(val);
    if (q <= 0 || q === oldQ || grid.qtys.includes(q)) return;   // collisions would break the matrix
    onPatchIdxs(colIdxs(oldQ), { qty: q });
  };
  // New cells inherit the design's shared fields from a neighbor cell, but
  // never its pick or committed price — a fresh option starts un-accepted and
  // AUTO-priced at its own cost × markup.
  const addColumn = () => {
    const newQ = Math.max(...grid.qtys) * 2;                     // 50/100 → 200; edit the header to taste
    const adds = grid.brands.map(b => {
      const src = (grid.cellAt(b.key, grid.qtys[grid.qtys.length - 1]) || {}).line || firstLine;
      return { ...src, qty: newQ, unitPrice: 0, accepted: false };
    });
    onAppendLines(adds);
  };
  const addRow = () => {
    const n = grid.brands.length + 1;
    const src = grid.brands[0];
    const adds = grid.qtys.map(q => {
      const mate = (grid.cellAt(src.key, q) || {}).line || firstLine;
      return { ...mate, description: `Option ${n}`, styleCode: '', blankCost: 0, supplierUrl: '',
        unitPrice: 0, accepted: false };
    });
    onAppendLines(adds);
  };
  const removeRow = (b) => {
    if (grid.brands.length === 1) { removeGrid(); return; }
    onRemoveIdxs(b.idxs);
  };
  const removeColumn = (q) => {
    if (grid.qtys.length <= 2) return;                            // below 2 columns it stops being a grid
    onRemoveIdxs(colIdxs(q));
  };
  const removeGrid = () => {
    if (window.confirm(`Remove "${grid.group}" and its ${all.length} option${all.length === 1 ? '' : 's'}?`)) {
      onRemoveIdxs(all);
    }
  };
  // Swap two rows by swapping their lines' array POSITIONS (each row owns
  // exactly one line per column, so the position sets are the same size).
  const moveRow = (bIdx, dir) => {
    const j = bIdx + dir;
    if (j < 0 || j >= grid.brands.length) return;
    const a = grid.brands[bIdx].idxs, b = grid.brands[j].idxs;
    onSwapLines(a.map((ai, k) => [ai, b[k]]));
  };
  const toggleRow = (pos) => setOpenRows(prev => {
    const next = new Set(prev);
    if (next.has(pos)) next.delete(pos); else next.add(pos);
    return next;
  });

  const nCols = grid.qtys.length;
  const tableCols = `minmax(280px, 1.3fr) repeat(${nCols}, minmax(122px, 1fr)) 40px`;
  const headCellSx = { color: D.faint, fontSize: 9, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase' };

  return (
    <Box sx={{
      border: `1px solid ${D.line}`,
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${D.line}`,
      borderRadius: 3, overflow: 'hidden', bgcolor: D.panel,
      transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.2s ease',
      '&:hover': { bgcolor: D.panelHi, borderColor: accent || 'rgba(255,255,255,0.14)',
        ...(accent ? { borderLeftColor: accent } : {}),
        boxShadow: '0 10px 28px rgba(0,0,0,0.34)' },
    }}>
      {/* Design header: name + shared design fields (broadcast to every cell) */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 1.75, pb: 1,
        display: 'flex', alignItems: 'flex-end', gap: 1.25, flexWrap: 'wrap' }}>
        <QF label="Design (client picks 1 option)" sx={{ width: { xs: '100%', sm: 190 } }}>
          <BufferedTF fullWidth value={grid.group} placeholder="Front-hit tee"
            onCommit={renameGroup} sx={groupChip} />
        </QF>
        <DesignAttach line={{ mockupNum: sharedVal('mockupNum'), image: sharedVal('image') || firstLine.image || '' }}
          onPatch={(patch) => onPatchIdxs(all, patch)} tf={tf}
          sx={{ width: { xs: '100%', sm: 210 } }} />
        <QF label="Print type" sx={{ width: { xs: '48%', sm: 132 } }}>
          <FormControl size="small" fullWidth sx={{ ...dropInput, '& .MuiOutlinedInput-root': inputRoot }}>
            <Select value={sharedVal('printType')} displayEmpty
              onChange={e => onPatchIdxs(all, { printType: e.target.value })}
              sx={{ color: D.text, fontSize: 13, borderRadius: 2 }}>
              <MenuItem value=""><em>{sharedMixed('printType') ? 'mixed' : '—'}</em></MenuItem>
              {PRINT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
        </QF>
        <QF label="Print details (all options)" sx={{ flex: '1 1 150px', minWidth: 130 }}>
          {/* Locked while options carry DIFFERENT print details: broadcasting
              one value would merge variant rows' identities and dissolve the
              grid mid-keystroke. Per-option edits live in each row's drawer. */}
          <TextField size="small" fullWidth value={sharedVal('printDetails')}
            disabled={sharedMixed('printDetails')}
            title={sharedMixed('printDetails') ? 'Varies per option — edit in each row\u2019s \u2304 drawer' : undefined}
            placeholder={sharedMixed('printDetails') ? 'varies per option' : '1c front + 2c back'}
            onChange={e => onPatchIdxs(all, { printDetails: e.target.value })} sx={tf} />
        </QF>
        <QF label="Setup $ (all)" sx={{ width: { xs: '31%', sm: 96 } }}>
          <TextField size="small" fullWidth type="number" value={numValOver(all, 'setupCost')}
            placeholder={numMixedOver(all, 'setupCost') ? 'varies' : '0'}
            onChange={e => onPatchIdxs(all, { setupCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Ship $ (fill all)" sx={{ width: { xs: '31%', sm: 96 } }}>
          <TextField size="small" fullWidth type="number" value={numValOver(all, 'shippingCost')}
            placeholder={numMixedOver(all, 'shippingCost') ? 'per-qty' : '0'}
            title="Fills shipping on every cell — set it per quantity in each row's ⌄ drawer for run-size shipping"
            onChange={e => onPatchIdxs(all, { shippingCost: e.target.value })} sx={tf} />
        </QF>
        <QF label="Turnaround" sx={{ width: { xs: '31%', sm: 90 } }}>
          <TextField size="small" fullWidth type="number"
            value={numValOver(all, 'turnaroundWeeks') === '0' ? '' : numValOver(all, 'turnaroundWeeks')}
            placeholder={numMixedOver(all, 'turnaroundWeeks') ? 'varies' : 'wks'}
            onChange={e => onPatchIdxs(all, { turnaroundWeeks: e.target.value })} sx={tf} />
        </QF>
        <Stack direction="row" sx={{ ml: 'auto', mb: 0.3 }} alignItems="center" gap={0.25}>
          <Button onClick={onEditAsCards} startIcon={<ViewAgendaOutlinedIcon sx={{ fontSize: 14 }} />}
            title="Open this design's options as individual line cards (full per-option control)"
            sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 11, px: 1,
              '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}>
            Edit as cards
          </Button>
          <Stack>
            <IconButton size="small" onClick={onMoveUp} disabled={!onMoveUp} title="Move design up"
              sx={{ color: D.muted, p: 0.15, '&:hover': { color: D.green }, '&.Mui-disabled': { color: D.faint, opacity: 0.35 } }}>
              <KeyboardArrowUpIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" onClick={onMoveDown} disabled={!onMoveDown} title="Move design down"
              sx={{ color: D.muted, p: 0.15, '&:hover': { color: D.green }, '&.Mui-disabled': { color: D.faint, opacity: 0.35 } }}>
              <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
          <IconButton size="small" onClick={removeGrid} title="Remove this design (all its options)"
            sx={{ color: D.muted, transition: 'color 0.18s, background-color 0.18s',
              '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}>
            <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </Box>

      {/* The matrix: option rows × quantity columns. Every cell is a real
          quote line the client can pick. Horizontal scroll on narrow screens. */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.25, overflowX: 'auto', ...scrollbar }}>
        <Box sx={{ minWidth: 400 + nCols * 130, display: 'grid', gap: 0.75, alignItems: 'stretch',
          gridTemplateColumns: tableCols }}>

          {/* Header row: option column title, then one header per quantity */}
          <Box sx={{ alignSelf: 'end', pb: 0.5, position: 'sticky', left: 0, zIndex: 2, bgcolor: D.panel }}>
            <Typography sx={headCellSx}>Options the client picks from</Typography>
            <Typography sx={{ color: D.faint, fontSize: 10, mt: 0.2, lineHeight: 1.35 }}>
              Name the brand or variant, its style #, and the blank $/unit. Open <b>⌄</b> on a row for its
              print $, setup $ &amp; shipping — set per quantity when a run size prices differently.
            </Typography>
          </Box>
          {grid.qtys.map(q => (
            <Box key={`h-${q}`} sx={{ alignSelf: 'end', textAlign: 'center', pb: 0.25 }}>
              <Stack direction="row" alignItems="center" justifyContent="center" gap={0.25}>
                <BufferedTF value={String(q)} type="number"
                  onCommit={(v) => setColQty(q, v)}
                  sx={{ ...cellTf, width: 72,
                    '& .MuiInputBase-input': { ...cellTf['& .MuiInputBase-input'], textAlign: 'center', fontWeight: 800 } }} />
                <Typography sx={{ ...headCellSx, fontSize: 8.5 }}>units</Typography>
                {grid.qtys.length > 2 && (
                  <IconButton size="small" onClick={() => removeColumn(q)} title={`Remove the ${q}-unit column`}
                    sx={{ color: D.faint, p: 0.2, '&:hover': { color: '#f87171' } }}>
                    <CloseIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                )}
              </Stack>
              <Typography sx={{ color: D.faint, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4,
                textTransform: 'uppercase', mt: 0.5, textAlign: 'center' }}>
                price / unit
              </Typography>
            </Box>
          ))}
          <Box sx={{ alignSelf: 'end', pb: 0.5, textAlign: 'center' }}>
            <IconButton size="small" onClick={addColumn} title="Add a quantity column"
              sx={{ color: D.muted, border: `1px dashed ${D.line}`, borderRadius: 1.5,
                '&:hover': { color: D.green, borderColor: D.green } }}>
              <AddCircleOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Option rows */}
          {grid.brands.map((b, bIdx) => {
            const bLine = b.first;
            const open = openRows.has(bIdx);
            const url = (bLine.supplierUrl || '').trim();
            const suggestion = url ? '' : suggestSupplierUrl(bLine);
            return (
              // Position key on purpose: a row's identity key CHANGES when its
              // name/style/print details are edited — keying by it would
              // remount the row (focus loss) and orphan its open drawer.
              <React.Fragment key={`row-${bIdx}`}>
                {/* Identity cell: reorder · product · style · blank $/unit · drawer toggle.
                    Sticky-left so the row's name stays put while you scroll the
                    quantity columns sideways. */}
                <Box sx={{ display: 'grid', gap: 0.6, alignItems: 'center', p: 0.9, borderRadius: 2,
                  bgcolor: D.inset, border: `1px solid ${open ? D.lineHi : D.line}`,
                  position: 'sticky', left: 0, zIndex: 1,
                  gridTemplateColumns: '16px minmax(100px, 1fr) 66px 96px 30px' }}>
                  <Stack>
                    <IconButton size="small" onClick={() => moveRow(bIdx, -1)} disabled={bIdx === 0}
                      sx={{ color: D.muted, p: 0, '&:hover': { color: D.green }, '&.Mui-disabled': { color: D.faint, opacity: 0.3 } }}>
                      <KeyboardArrowUpIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => moveRow(bIdx, +1)} disabled={bIdx === grid.brands.length - 1}
                      sx={{ color: D.muted, p: 0, '&:hover': { color: D.green }, '&.Mui-disabled': { color: D.faint, opacity: 0.3 } }}>
                      <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                  <BufferedTF value={bLine.description || ''} placeholder="Brand / product name"
                    onCommit={(v) => onPatchIdxs(b.idxs, { description: v })} sx={tf} />
                  <BufferedTF value={bLine.styleCode || ''} placeholder="Style #"
                    onCommit={(v) => onPatchIdxs(b.idxs, { styleCode: v })} sx={tf} />
                  {/* The number next to the style # is the BLANK COST — always labeled
                      so it's never mistaken for anything else. */}
                  <TextField size="small" type="number" value={numValOver(b.idxs, 'blankCost')}
                    placeholder={numMixedOver(b.idxs, 'blankCost') ? 'varies' : '0.00'}
                    title="Blank cost per unit for this option"
                    onChange={e => onPatchIdxs(b.idxs, { blankCost: e.target.value })}
                    InputProps={{ startAdornment: <Typography sx={{ color: D.faint, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', mr: 0.4, whiteSpace: 'nowrap' }}>blank&nbsp;$</Typography> }}
                    sx={{ ...cellTf, '& .MuiInputBase-input': { ...cellTf['& .MuiInputBase-input'], fontWeight: 600, fontSize: 12.5, textAlign: 'left' } }} />
                  <IconButton size="small" onClick={() => toggleRow(bIdx)}
                    title="Per-option costs: print $/u, setup $ & shipping (per quantity), print details, product link"
                    sx={{ color: open ? D.green : D.muted, p: 0.3,
                      transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease',
                      '&:hover': { color: D.green } }}>
                    <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                {/* Price cells */}
                {grid.qtys.map(q => {
                  const cell = grid.cellAt(b.key, q);
                  if (!cell) return <Box key={`c-${bIdx}-${q}`} />;
                  const l = cell.line;
                  const committed = lineCommitted(l);
                  const eff = lineEffectivePrice(l);
                  const cogs = lineCogsPerUnit(l);
                  const profit = eff - cogs;
                  const pct = eff > 0 ? (profit / eff) * 100 : 0;
                  return (
                    <Box key={`c-${bIdx}-${q}`} sx={{ p: 0.9, borderRadius: 2, bgcolor: D.inset,
                      border: `1px solid ${committed ? D.line : 'rgba(251,191,36,0.35)'}`,
                      display: 'flex', flexDirection: 'column', gap: 0.4, justifyContent: 'center' }}>
                      {/* Show the field EMPTY when the price is auto (0/blank) so the
                          computed auto price shows through as the placeholder — a stored
                          0 used to render a literal "0" over the real auto number. */}
                      <TextField size="small" type="number" value={num(l.unitPrice) > 0 ? l.unitPrice : ''}
                        placeholder={eff > 0 ? eff.toFixed(2) : '—'}
                        onChange={e => onSetLine(cell.idx, { unitPrice: e.target.value })}
                        onBlur={e => { if (num(e.target.value) <= 0) onSetLine(cell.idx, { unitPrice: '' }); }}
                        InputProps={{ startAdornment: <Typography sx={{ color: D.faint, fontSize: 11, mr: 0.3 }}>$</Typography> }}
                        sx={cellTf} />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
                          color: committed ? D.faint : D.amber }}>
                          {eff > 0 ? `${committed ? '' : 'auto · '}${fmt(eff * q)}` : 'set costs'}
                        </Typography>
                        <Typography sx={{ fontSize: 10, fontWeight: 800, ...mono, color: marginColor(pct) }}
                          title={`${fmt(profit)}/unit profit at ${fmt(eff)}${committed ? '' : ' (auto price)'}`}>
                          {cogs > 0 && eff > 0 ? `${pct.toFixed(0)}%` : '—'}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconButton size="small" onClick={() => removeRow(b)} title="Remove this option row"
                    sx={{ color: D.muted, '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}>
                    <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>

                {/* Row cost drawer — full cost control for THIS option: print $/u
                    and setup $ (a "7c front" row carries its extra screen's cost
                    while its "6c" sibling stays cheaper), print details, the
                    product link, and — the qty-break lane — shipping set PER
                    QUANTITY (50 units $25, 100 units $50). Keeps the price cells
                    clean while giving total control here. */}
                {open && (
                  <Box sx={{ gridColumn: '1 / -1', mt: -0.25, mb: 0.25, p: 1.25, borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.02)', border: `1px dashed ${D.line}` }}>
                    <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <QF label="Print $/u (fill all)" sx={{ width: 130 }}>
                        <TextField size="small" fullWidth type="number" value={numValOver(b.idxs, 'printCost')}
                          placeholder={numMixedOver(b.idxs, 'printCost') ? 'per-qty' : '0'}
                          title="Fills print $/u on every quantity of this option — override a single run size below when it differs (e.g. grinders cheaper at 480)"
                          onChange={e => onPatchIdxs(b.idxs, { printCost: e.target.value })} sx={tf} />
                      </QF>
                      <QF label="Setup $ (fill all)" sx={{ width: 130 }}>
                        <TextField size="small" fullWidth type="number" value={numValOver(b.idxs, 'setupCost')}
                          placeholder={numMixedOver(b.idxs, 'setupCost') ? 'per-qty' : '0'}
                          title="Fills one-time setup on every quantity of this option — override per run size below when it differs"
                          onChange={e => onPatchIdxs(b.idxs, { setupCost: e.target.value })} sx={tf} />
                      </QF>
                      <QF label="Print details (this option)" sx={{ flex: '1 1 150px', minWidth: 140 }}>
                        <BufferedTF fullWidth value={bLine.printDetails || ''} placeholder="7c front"
                          onCommit={(v) => onPatchIdxs(b.idxs, { printDetails: v })} sx={tf} />
                      </QF>
                      <QF label="Product link (client sees)" sx={{ flex: '1 1 190px', minWidth: 170 }}>
                        <Stack direction="row" gap={0.5} alignItems="center">
                          <BufferedTF fullWidth value={bLine.supplierUrl || ''} placeholder="https:// supplier product page"
                            onCommit={(v) => onPatchIdxs(b.idxs, { supplierUrl: v })}
                            sx={{ ...tf, '& .MuiInputBase-input': { color: D.muted, fontSize: 11.5, py: 0.8 } }} />
                          {url ? (
                            <IconButton size="small" title={`Open product page · ${url}`}
                              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                              sx={{ color: D.green, border: `1px solid ${D.line}`, borderRadius: 1.5,
                                '&:hover': { borderColor: D.green } }}>
                              <OpenInNewIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          ) : suggestion ? (
                            <IconButton size="small" title={`Auto-link S&S: ${suggestion}`}
                              onClick={() => onPatchIdxs(b.idxs, { supplierUrl: suggestion })}
                              sx={{ color: D.muted, border: `1px solid ${D.line}`, borderRadius: 1.5,
                                '&:hover': { color: D.green, borderColor: D.green } }}>
                              <LinkIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          ) : null}
                        </Stack>
                      </QF>
                    </Box>
                    {/* Costs PER QUANTITY — each run size can carry its own print
                        $/u, setup $ and shipping $ for this exact option, so a
                        grinder that prints cheaper at 480 than 240 (or ships more
                        in bulk) quotes right. Print $/u is per-unit; setup +
                        shipping are one-time and spread across that run's qty into
                        COGS. Each writes onto that one cell's quoteLine. */}
                    <Box sx={{ mt: 1.25, pt: 1, borderTop: `1px solid ${D.line}` }}>
                      <Typography sx={{ ...headCellSx, mb: 0.6 }}>Costs per quantity (this option) — override any run size</Typography>
                      <Stack direction="row" gap={1.25} flexWrap="wrap">
                        {grid.qtys.map(q => {
                          const cell = grid.cellAt(b.key, q);
                          if (!cell) return null;
                          const cl = cell.line;
                          return (
                            <Box key={`pq-${bIdx}-${q}`} sx={{ width: 132, p: 0.9, borderRadius: 1.5,
                              bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${D.line}` }}>
                              <Typography sx={{ ...headCellSx, mb: 0.6, color: D.text }}>{q} units</Typography>
                              <Stack gap={0.6}>
                                <TextField size="small" fullWidth type="number" value={num(cl.printCost) > 0 ? cl.printCost : ''}
                                  placeholder="print $/u" title={`Print cost per unit at ${q} units`}
                                  InputProps={{ startAdornment: <Typography sx={{ color: D.faint, fontSize: 9.5, mr: 0.5, whiteSpace: 'nowrap' }}>print</Typography> }}
                                  onChange={e => onSetLine(cell.idx, { printCost: e.target.value })} sx={tf} />
                                <TextField size="small" fullWidth type="number" value={num(cl.setupCost) > 0 ? cl.setupCost : ''}
                                  placeholder="setup $" title={`One-time setup at ${q} units`}
                                  InputProps={{ startAdornment: <Typography sx={{ color: D.faint, fontSize: 9.5, mr: 0.5, whiteSpace: 'nowrap' }}>setup</Typography> }}
                                  onChange={e => onSetLine(cell.idx, { setupCost: e.target.value })} sx={tf} />
                                <TextField size="small" fullWidth type="number" value={num(cl.shippingCost) > 0 ? cl.shippingCost : ''}
                                  placeholder="ship $" title={`Total shipping for ${q} units of this option`}
                                  InputProps={{ startAdornment: <Typography sx={{ color: D.faint, fontSize: 9.5, mr: 0.5, whiteSpace: 'nowrap' }}>ship</Typography> }}
                                  onChange={e => onSetLine(cell.idx, { shippingCost: e.target.value })} sx={tf} />
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  </Box>
                )}
              </React.Fragment>
            );
          })}
        </Box>
        <Button onClick={addRow} startIcon={<AddCircleOutlineIcon sx={{ fontSize: 15 }} />}
          sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11.5, mt: 0.75,
            borderRadius: 999, px: 1.5, '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
          Add option
        </Button>
      </Box>

      {/* One tier strip for the whole design: each cell gets the tier applied
          over its OWN unit cost, so every option/quantity prices correctly from
          a single click. Typing in a cell overrides just that cell. */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" gap={1} mb={0.75} flexWrap="wrap">
          <Typography sx={{ color: fixedPrice ? D.muted : D.green, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {fixedPrice ? 'Fixed price · no markup' : 'Markup tiers · all options'}
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 10, flex: 1, minWidth: 120 }}>
            {fixedPrice
              ? 'Promo — you type each client price; nothing marked up. COGS still reads your real cost.'
              : 'click a tier to price every cell at cost × tier (+% markup / resulting margin)'}
          </Typography>
          {/* Promo toggle — for vendor-catalog items already priced with margin. */}
          <Box onClick={toggleFixed} title="Promo items whose catalog price already includes your margin — no markup added"
            sx={{ cursor: 'pointer', flexShrink: 0, px: 1.1, py: 0.5, borderRadius: 999, fontSize: 10, fontWeight: 800,
              letterSpacing: 0.3, border: `1.5px solid ${fixedPrice ? D.green : D.line}`,
              color: fixedPrice ? D.ink : D.muted, bgcolor: fixedPrice ? D.green : 'transparent',
              transition: 'all 0.16s ease', '&:hover': { borderColor: D.green, color: fixedPrice ? D.ink : D.green } }}>
            {fixedPrice ? '✓ Promo · fixed price' : 'Promo · fixed price'}
          </Box>
        </Stack>
        {!fixedPrice && (
          <Box sx={{ bgcolor: D.inset, border: `1px solid ${D.line}`,
            borderRadius: 2.5, p: 0.5, display: 'flex',
            overflowX: 'auto', ...scrollbar }}>
            {TIERS.map(pct => {
              const sel = uniformPct === pct;
              return (
                <Box key={pct} onClick={() => applyTier(pct)} sx={{
                  cursor: 'pointer', flex: '1 0 56px', minWidth: 56, textAlign: 'center',
                  py: 0.7, px: 0.5, borderRadius: 1.75,
                  bgcolor: sel ? D.green : 'transparent',
                  boxShadow: sel ? `0 2px 12px ${D.glow}` : 'none',
                  transition: 'background-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
                  '&:hover': sel ? {} : { bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateY(-1px)' },
                }}>
                  <Typography sx={{ color: sel ? 'rgba(6,20,12,0.72)' : D.muted, fontSize: 10, fontWeight: 700 }}>
                    +{pct}%
                  </Typography>
                  <Typography sx={{ color: sel ? D.ink : D.text, fontSize: 10.5, fontWeight: 700, ...mono }}>
                    {(pct / (100 + pct) * 100).toFixed(0)}% margin
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function QuoteLineCard({ line, accent, index, gridable, onViewAsGrid, onPatch, onSelectTier, onRemove, onMoveUp, onMoveDown }) {
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
  // COMMITTED (typed / tier-locked) or AUTO (cost × markup — what the server
  // bills and the client page shows). Never display "$0" as if it were a
  // price: a cleared or zero unit price is the AUTO state, shown as such.
  const committed = lineCommitted(line);
  const unitPrice = lineEffectivePrice(line);
  const lineTotal = qty * unitPrice;
  const profit    = unitPrice - cogsPerUnit;
  const marginPct = unitPrice > 0 ? (profit / unitPrice) * 100 : 0;
  const marginCol = marginColor(marginPct);
  const selectedPct = cogsPerUnit > 0 && committed
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
        <SupplierLink line={line} onPatch={onPatch} tf={tf} sx={{ width: { xs: '100%', sm: 200 } }} />
        {gridable && (
          <Button onClick={onViewAsGrid} startIcon={<GridViewOutlinedIcon sx={{ fontSize: 14 }} />}
            title="Collapse this design's options back into the brands × quantities grid"
            sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 11, px: 1, mb: 0.3,
              '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}>
            View as grid
          </Button>
        )}
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
            overflowX: 'auto', ...scrollbar }}>
            {TIERS.map(pct => {
              const price = +(cogsPerUnit * (1 + pct / 100)).toFixed(2);
              const tierProfit = price - cogsPerUnit;   // profit per unit at this margin
              const sel = selectedPct === pct;
              return (
                <Box key={pct} onClick={() => onSelectTier(pct)} sx={{
                  cursor: 'pointer', flex: '1 0 64px', minWidth: 64, textAlign: 'center',
                  py: 0.7, px: 0.5, borderRadius: 1.75,
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
        <QF label={committed ? 'Unit price' : 'Unit price (auto)'}>
          <TextField size="small" type="number" value={num(line.unitPrice) > 0 ? line.unitPrice : ''}
            placeholder={cogsPerUnit > 0 ? unitPrice.toFixed(2) : ''}
            onChange={e => onPatch({ unitPrice: e.target.value })}
            onBlur={e => { if (num(e.target.value) <= 0) onPatch({ unitPrice: '' }); }}
            sx={{ ...tf, width: 130,
              ...(committed ? {} : { '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(251,191,36,0.4)' } }) }} />
          {!committed && (
            <Typography sx={{ color: D.amber, fontSize: 9, fontWeight: 700, mt: 0.3 }}>
              auto: cost × markup — type or click a tier to lock
            </Typography>
          )}
        </QF>
        {/* Optional lead time for THIS option. Purely informational — never
            touches pricing. Left blank, it shows nothing to the client; typed,
            it appears as "~N weeks" on their quote/approval page. */}
        <QF label="Turnaround (wks)">
          <TextField size="small" type="number" value={line.turnaroundWeeks || ''} placeholder="—"
            onChange={e => onPatch({ turnaroundWeeks: e.target.value })} sx={{ ...tf, width: 120 }} />
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
