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
import axios from 'axios';
import {
  Box, Stack, Typography, Button, TextField, IconButton,
  Dialog, DialogContent, FormControl, Select, MenuItem, Chip, CircularProgress, Checkbox,
} from '@mui/material';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import config from '../../config.json';
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
import VisibilityOutlinedIcon    from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { D, scrollbar, dropInput, fmt, mono, accentBar, useMobileFullScreen } from './_shared';
import { lsGet, lsSet, lsRemove } from '../../common/jpStorage';
import { quoteRowKey, detectGridRows } from '../../common/quoteGrid';

// Pricing tiers are TARGET MARGINS (the owner thinks in margin, not markup):
// clicking 30% prices the line so that exactly 30% of what the client pays is
// profit — price = cost / (1 − margin). The old strip applied +% MARKUP over
// cost, so clicking "10%" yielded a 9.1% margin and read as broken.
const TIERS = [];
for (let p = 5; p <= 70; p += 5) TIERS.push(p);
const priceAtMargin = (cogs, marginPct) =>
  marginPct >= 100 ? 0 : cogs / (1 - marginPct / 100);

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

// Margin guardrail: warn (⚠) when a priced line's margin drops below this floor,
// so a cell never gets sent underpriced by accident. Promo/fixed lines with no
// cost entered read as no-margin-known and are skipped (not flagged).
const MARGIN_FLOOR = 20;

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

// Signature of what the CLIENT would see for a set of lines — used to compare
// the builder's current state against the pushed snapshot (quoteLinesPublished)
// so the header can say "client link current ✓" vs "push your edits". Hidden
// lines are excluded (they never reach the client) and every field is
// normalized (inputs hold strings, the server holds numbers).
const SIG_NUM = ['qty', 'unitPrice', 'markup', 'blankCost', 'printCost', 'setupCost', 'shippingCost', 'turnaroundWeeks'];
const SIG_STR = ['group', 'description', 'styleCode', 'color', 'printType', 'printDetails', 'supplierUrl', 'image', 'mockupNum'];
function quoteSig(lines) {
  return JSON.stringify((Array.isArray(lines) ? lines : [])
    .filter(l => l && !l.hiddenFromClient)
    .map(l => [
      ...SIG_NUM.map(k => num(l[k])),
      ...SIG_STR.map(k => String(l[k] ?? '')),
      l.noMarkup ? 1 : 0,
    ]));
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

export default function QuoteBuilder({ open, project, authHdr, onClose, onSave }) {
  const fullScreen = useMobileFullScreen();
  const [lines,        setLines]        = useState([]);
  const [shipToState,  setShipToState]  = useState('');
  const [printerName,  setPrinterName]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [dirty,        setDirty]        = useState(false);
  // Groups the owner explicitly opened up as individual cards (per-line
  // control for one odd option). UI-only escape hatch — nothing is stored.
  const [cardView,     setCardView]     = useState(() => new Set());
  // The promo catalog picker (vendor items with client price + net cost baked in).
  const [promoOpen,    setPromoOpen]    = useState(false);
  // What the CLIENT's link currently shows (signature of the pushed snapshot).
  // Autosave keeps edits owner-side; "Push to client" updates the link.
  const [pushedSig, setPushedSig] = useState(null);
  const [pushing,   setPushing]   = useState(false);

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
    setPushedSig(project.quotePushedAt && Array.isArray(project.quoteLinesPublished)
      ? quoteSig(project.quoteLinesPublished) : null);
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
    // 0% = the promo / fixed-price lane: nothing marked up — the price sits at
    // cost until the owner types the client price. Click again to leave.
    if (pct === 0) {
      setLine(i, lines[i].noMarkup
        ? { noMarkup: false }
        : { noMarkup: true, markup: 1, unitPrice: '' });
      return;
    }
    // Target MARGIN: price so that pct% of what the client pays is profit.
    const c = lineCogsPerUnit(lines[i]);
    const price = +priceAtMargin(c, pct).toFixed(2);
    setLine(i, {
      unitPrice: price,
      markup:    c > 0 ? +(price / c).toFixed(4) : 1,
      noMarkup:  false,
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

  // Insert a picked promo product as quote lines: one line per chosen quantity,
  // all in one group (2+ quantities render as a design grid automatically).
  // The client price arrives COMMITTED at 0% markup — the catalog price already
  // carries the margin — and the net cost lands in the cost fields, so the
  // margin chips read true. Group name de-duped against the quote.
  const addPromoLines = (newLines) => {
    if (!newLines || !newLines.length) return;
    const used = new Set(lines.map(l => (l.group || '').trim().toLowerCase()).filter(Boolean));
    let g = (newLines[0].group || 'Promo').trim();
    if (used.has(g.toLowerCase())) {
      let n = 2; while (used.has(`${g} ${n}`.toLowerCase())) n += 1; g = `${g} ${n}`;
    }
    appendLines(newLines.map(l => ({ ...l, group: g })));
    setPromoOpen(false);
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

  // Send the current quote to the CLIENT's link. Autosave only ever updates
  // the owner's copy; the approval page serves the last pushed snapshot, so
  // mid-edit numbers never flash at the client. Sharing the link the first
  // time pushes automatically (backend); this button is for edits after that.
  const pushToClient = async () => {
    setPushing(true);
    try {
      if (dirty) await persist();
      await axios.post(`${config.backendUrl}/api/orders/${project._id}/quote/push`, {}, authHdr);
      setPushedSig(quoteSig(lines));
    } catch (e) { /* header keeps showing "push your edits" — retry is one click */ }
    finally { setPushing(false); }
  };
  const shared = !!project.approvalToken;
  const clientCurrent = pushedSig != null && pushedSig === quoteSig(lines);

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
        {/* The client's link shows the last PUSHED version — autosave keeps
            edits owner-side. Only relevant once a link has been shared. */}
        {shared && (clientCurrent ? (
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: D.green, whiteSpace: 'nowrap', mr: 0.5 }}
            title="The client's quote link matches what you see here.">
            Client link current ✓
          </Typography>
        ) : (
          <Button size="small" onClick={pushToClient} disabled={pushing}
            title="Your edits are saved but the client's link still shows the last pushed version — this sends the update."
            sx={{ bgcolor: D.amber, color: '#211703', fontWeight: 800, fontSize: 11, textTransform: 'none',
              px: 1.5, py: 0.4, borderRadius: 999, whiteSpace: 'nowrap', mr: 0.5,
              '&:hover': { bgcolor: '#f5cd53' }, '&.Mui-disabled': { bgcolor: D.inset, color: D.faint } }}>
            {pushing ? 'Pushing…' : 'Push update to client'}
          </Button>
        ))}
        <IconButton size="small" onClick={closeWithSave} sx={{ color: D.muted, '&:hover': { color: D.text } }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, ...scrollbar }}>
        {/* Project-level meta — sticks with the quote so re-quotes don't forget.
            Setup + shipping moved onto each line (each option carries its own). */}
        <Box sx={{ display: 'grid', gap: 1.25, mb: 1, maxWidth: 640,
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
        <PrinterSuggest shipToState={shipToState} printerName={printerName}
          onPick={(name) => setMeta(setPrinterName)(name)} authHdr={authHdr} />

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
            A design grid pitches one design across options × quantities (brands or print variants); the client
            picks ONE per design. Ungrouped single lines are always included. Nothing counts toward the total until they pick.
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
              <Button onClick={() => setPromoOpen(true)} startIcon={<LocalOfferOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, borderRadius: 999,
                  px: 2, transition: 'background-color 0.18s, color 0.18s',
                  '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.10)' } }}>
                Add promo item
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
            <Button onClick={() => setPromoOpen(true)} startIcon={<LocalOfferOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 12,
                borderRadius: 999, px: 1.75, transition: 'background-color 0.18s, color 0.18s',
                '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Add promo item
            </Button>
          </Stack>
        )}

        <PromoPickerDialog open={promoOpen} onClose={() => setPromoOpen(false)}
          authHdr={authHdr} onAdd={addPromoLines} />
      </DialogContent>
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

  // The tier strip highlights a margin only when EVERY visible cell is
  // committed at it (hidden rows are parked — they don't vote).
  const uniformPct = (() => {
    const pcts = all.filter(i => !(lines[i] && lines[i].hiddenFromClient)).map(i => {
      const l = lines[i];
      const c = lineCogsPerUnit(l);
      const p = num(l.unitPrice);
      return c > 0 && p > 0 ? Math.round((1 - c / p) * 100) : null;
    });
    return pcts.length && pcts.every(p => p !== null && p === pcts[0]) ? pcts[0] : null;
  })();

  // Price every cell to hit the target MARGIN over its own cost.
  const applyTier = (pct) => onPatchIdxs(all, (l) => {
    const c = lineCogsPerUnit(l);
    const price = +priceAtMargin(c, pct).toFixed(2);
    return {
      unitPrice: price,
      markup:    c > 0 ? +(price / c).toFixed(4) : 1,
      noMarkup:  false,   // choosing a margin turns off fixed-price
    };
  });

  // "How much do I make at m%?" — the whole design's profit at a given margin
  // (every visible cell priced at its own cost / (1 − m)), shown on each chip.
  const profitAtMargin = (pct) => all.reduce((sum, i) => {
    const l = lines[i];
    if (l && l.hiddenFromClient) return sum;
    const c = lineCogsPerUnit(l);
    if (c <= 0) return sum;
    return sum + num(l.qty) * (priceAtMargin(c, pct) - c);
  }, 0);

  // Promo / fixed-price (the 0% chip): the vendor catalog already has margin
  // baked in, so this design carries no markup. Clicking 0% resets EVERY cell
  // to its own COGS (auto, 0% margin — "same as cost") exactly like clicking
  // any other tier reprices every cell; you then type each client price.
  // Clicking again leaves promo mode and restores the plain ×1.4 auto default.
  const fixedPrice = all.length > 0 && all.every(i => lines[i] && lines[i].noMarkup);
  const toggleFixed = () => onPatchIdxs(all, () => (
    fixedPrice
      ? { noMarkup: false, unitPrice: 0, markup: 1.4 }
      : { noMarkup: true, unitPrice: 0, markup: 1 }
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
  const tableCols = `minmax(280px, 1.3fr) repeat(${nCols}, minmax(158px, 1fr)) 40px`;
  const headCellSx = { color: D.faint, fontSize: 9, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase' };

  // Visible (non-hidden) cells only — hidden rows are owner-side parking and
  // never part of what the client can take, so never part of the design math.
  const visible = all.filter(i => !(lines[i] && lines[i].hiddenFromClient));
  // Design rollup at CURRENT prices: what the client pays, what you make, and
  // what it costs you if they take every visible option. Recomputes live as
  // margins are clicked or costs typed.
  const designTotals = visible.reduce((t, i) => {
    const l = lines[i];
    const q = num(l.qty);
    const c = lineCogsPerUnit(l);
    const e = lineEffectivePrice(l);
    if (c > 0 || e > 0) { t.billed += e * q; t.cogs += c * q; t.profit += (e - c) * q; }
    return t;
  }, { billed: 0, cogs: 0, profit: 0 });

  // Price ONE option row at a target margin (same math as the design strip).
  const applyRowTier = (idxs, pct) => onPatchIdxs(idxs, (l) => {
    const c = lineCogsPerUnit(l);
    const price = +priceAtMargin(c, pct).toFixed(2);
    return { unitPrice: price, markup: c > 0 ? +(price / c).toFixed(4) : 1, noMarkup: false };
  });

  // Copy THIS option's costs (print $/u, setup, shipping, print specs) to
  // every other option at the matching run size — brands usually share print
  // pricing and differ only on the blank. Blank $, prices, links stay per-row.
  const copyCostsToAll = (b) => {
    const srcByQty = {};
    grid.qtys.forEach(q => { const c = grid.cellAt(b.key, q); if (c) srcByQty[q] = c.line; });
    const mine = new Set(b.idxs);
    onPatchIdxs(all.filter(i => !mine.has(i)), (l) => {
      const s = srcByQty[num(l.qty)];
      return s ? {
        printCost: s.printCost, setupCost: s.setupCost, shippingCost: s.shippingCost,
        printType: s.printType, printDetails: s.printDetails,
      } : {};
    });
  };

  const toggleRowHidden = (b) => {
    const hide = !(b.first && b.first.hiddenFromClient);
    onPatchIdxs(b.idxs, { hiddenFromClient: hide, ...(hide ? { accepted: false } : {}) });
  };

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
      {/* Design header, two calm rows:
          row 1 — WHAT this design is (name + the mockup/render the client signs
          off), with the card actions on the right;
          row 2 — design-wide production fields broadcast to every cell (print,
          setup, shipping, turnaround). Per-option overrides stay in each row's
          ⌄ drawer. */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 1.75, pb: 0.25,
        display: 'flex', alignItems: 'flex-end', gap: 1.25, flexWrap: 'wrap' }}>
        <QF label="Design (client picks 1 option)" sx={{ width: { xs: '100%', sm: 230 } }}>
          <BufferedTF fullWidth value={grid.group} placeholder="Front-hit tee"
            onCommit={renameGroup} sx={groupChip} />
        </QF>
        <DesignAttach line={{ mockupNum: sharedVal('mockupNum'), image: sharedVal('image') || firstLine.image || '' }}
          onPatch={(patch) => onPatchIdxs(all, patch)} tf={tf}
          sx={{ width: { xs: '100%', sm: 230 } }} />
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
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1,
        display: 'flex', alignItems: 'flex-end', gap: 1.25, flexWrap: 'wrap' }}>
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
              Name each option + its blank $/unit. Open <b>⌄</b> for print, setup &amp; shipping (per run size).
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
                  opacity: bLine.hiddenFromClient ? 0.5 : 1,
                  gridTemplateColumns: '16px minmax(100px, 1fr) 66px 96px 26px 30px' }}>
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
                  {/* Park this option: stays here with all its costs, but the
                      client never sees it (and it drops out of the design math). */}
                  <IconButton size="small" onClick={() => toggleRowHidden(b)}
                    title={bLine.hiddenFromClient
                      ? 'Hidden from the client — click to show it on their quote again'
                      : 'Hide this option from the client (kept here for you)'}
                    sx={{ color: bLine.hiddenFromClient ? D.amber : D.faint, p: 0.3, '&:hover': { color: D.amber } }}>
                    {bLine.hiddenFromClient
                      ? <VisibilityOffOutlinedIcon sx={{ fontSize: 15 }} />
                      : <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />}
                  </IconButton>
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
                  // 0% promo lane with no typed price yet: sitting AT COST is the
                  // expected state, not an underpricing accident — no red ⚠.
                  const promoAuto = !!l.noMarkup && !committed;
                  const lowMargin = !promoAuto && cogs > 0 && eff > 0 && pct < MARGIN_FLOOR;
                  const cellLabel = { fontSize: 8, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: D.faint, lineHeight: 1.6 };
                  const cellVal = { fontSize: 10, fontWeight: 700, ...mono, lineHeight: 1.6, textAlign: 'right' };
                  return (
                    <Box key={`c-${bIdx}-${q}`} sx={{ p: 0.9, borderRadius: 2, bgcolor: D.inset,
                      border: `1px solid ${committed ? D.line : 'rgba(251,191,36,0.35)'}`,
                      opacity: l.hiddenFromClient ? 0.5 : 1,
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
                      {/* Every number LABELED, per-unit AND total: what the client
                          is billed, what you make, what it costs you. All three
                          recompute live as margins are clicked. */}
                      {cogs > 0 && eff > 0 ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', columnGap: 0.6 }}>
                          <Typography sx={cellLabel}>{committed ? 'Client' : 'Client·auto'}</Typography>
                          <Typography sx={{ ...cellVal, color: committed ? D.text : D.amber }}>{fmt(eff)}/u</Typography>
                          <Typography sx={{ ...cellVal, color: committed ? D.text : D.amber, fontWeight: 800 }}
                            title={`Order total billed to the client for ${q} units`}>{fmt(eff * q)}</Typography>
                          <Typography sx={cellLabel}>Profit</Typography>
                          <Typography sx={{ ...cellVal, color: lowMargin ? '#f87171' : promoAuto ? D.amber : marginColor(pct) }}
                            title={promoAuto
                              ? `0% margin — the price sits at COGS until you type the client price`
                              : lowMargin
                                ? `⚠ ${pct.toFixed(1)}% is under your ${MARGIN_FLOOR}% margin floor — raise the price or check the costs`
                                : `${pct < 25 ? pct.toFixed(1) : pct.toFixed(0)}% margin`}>
                            {promoAuto ? 'at cost' : `${lowMargin ? '⚠ ' : ''}${fmt(profit)}/u`}
                          </Typography>
                          <Typography sx={{ ...cellVal, color: lowMargin ? '#f87171' : promoAuto ? D.amber : marginColor(pct), fontWeight: 800 }}>
                            {promoAuto ? '0%' : `${fmt(profit * q)} · ${pct < 25 ? pct.toFixed(1) : pct.toFixed(0)}%`}
                          </Typography>
                          <Typography sx={cellLabel}>COGS</Typography>
                          <Typography sx={{ ...cellVal, color: D.muted }}>{fmt(cogs)}/u</Typography>
                          <Typography sx={{ ...cellVal, color: D.muted }}>{fmt(cogs * q)}</Typography>
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: D.amber }}>
                          set costs
                        </Typography>
                      )}
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
                    {/* Row toolbelt: price JUST this option at its own margin (an
                        expensive product can run leaner than its grid-mates), and
                        copy this row's costs onto every other option — brands
                        usually share print pricing and differ only on the blank. */}
                    <Box sx={{ mt: 1.25, pt: 1, borderTop: `1px solid ${D.line}`,
                      display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      <Typography sx={headCellSx}>Margin · this option only</Typography>
                      {[20, 25, 30, 35, 40, 45, 50].map(p => {
                        const rowSel = b.idxs.every(i => {
                          const l2 = lines[i]; const c2 = lineCogsPerUnit(l2); const up = num(l2 && l2.unitPrice);
                          return c2 > 0 && up > 0 && Math.round((1 - c2 / up) * 100) === p;
                        });
                        return (
                          <Chip key={p} size="small" label={`${p}%`} onClick={() => applyRowTier(b.idxs, p)}
                            sx={{ ...mono, fontWeight: 800, fontSize: 11, cursor: 'pointer', height: 22,
                              bgcolor: rowSel ? D.green : 'rgba(255,255,255,0.05)',
                              color: rowSel ? D.ink : D.muted,
                              border: `1px solid ${rowSel ? D.green : D.line}`,
                              '&:hover': { bgcolor: rowSel ? D.green : 'rgba(74,222,128,0.12)' } }} />
                        );
                      })}
                      <Box sx={{ flex: 1 }} />
                      {grid.brands.length > 1 && (
                        <Button size="small" onClick={() => copyCostsToAll(b)}
                          title="Copy this option's print $/u, setup, shipping and print specs onto every other option at the matching run size — blank $ and prices stay per-option"
                          sx={{ color: D.green, fontSize: 11, fontWeight: 700, textTransform: 'none',
                            border: `1px dashed ${D.line}`, borderRadius: 999, px: 1.5,
                            '&:hover': { borderColor: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}>
                          Copy costs → all options
                        </Button>
                      )}
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

      {/* One markup strip for the whole design: each cell gets the markup applied
          over its OWN unit cost, so every option/quantity prices correctly from a
          single click. Typing in a cell overrides just that cell. "0%" is the
          promo / fixed-price lane: nothing is marked up — you type each client
          price (catalog price already carries the margin); COGS stays honest. */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5 }}>
        {/* Design rollup at CURRENT prices — the three numbers that matter,
            recomputed live as margins are clicked. "Take everything" = every
            visible option; the client usually picks one per design, so per-cell
            totals above are the per-pick truth. */}
        {designTotals.billed > 0 && (
          <Stack direction="row" alignItems="baseline" gap={2} mb={1} flexWrap="wrap"
            sx={{ bgcolor: 'rgba(255,255,255,0.025)', border: `1px solid ${D.line}`, borderRadius: 2, px: 1.5, py: 0.8 }}>
            <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
              If they take every option
            </Typography>
            <Typography sx={{ ...mono, color: D.text, fontSize: 12, fontWeight: 800 }}>
              client billed {fmt(designTotals.billed)}
            </Typography>
            <Typography sx={{ ...mono, color: marginColor(designTotals.billed > 0 ? (designTotals.profit / designTotals.billed) * 100 : 0), fontSize: 12, fontWeight: 800 }}>
              your profit {fmt(designTotals.profit)}
            </Typography>
            <Typography sx={{ ...mono, color: D.muted, fontSize: 12, fontWeight: 700 }}>
              COGS {fmt(designTotals.cogs)}
            </Typography>
          </Stack>
        )}
        <Stack direction="row" alignItems="center" gap={1} mb={0.75} flexWrap="wrap">
          <Typography sx={{ color: fixedPrice ? D.amber : D.green, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {fixedPrice ? 'Margin 0% · you set the prices' : 'Margin · all options'}
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 10, flex: 1, minWidth: 120 }}>
            {fixedPrice
              ? 'type each client price — COGS still reads your real cost'
              : uniformPct != null && uniformPct > 0
                ? `every option priced at a true ${uniformPct}% margin — you make ${fmt(profitAtMargin(uniformPct))} total if they take everything`
                : 'click a margin — every option reprices to hit it; the number on each chip is YOUR TOTAL PROFIT at that margin (per-option margins live in each row’s ⌄ drawer)'}
          </Typography>
        </Stack>
        <Box sx={{ bgcolor: D.inset, border: `1px solid ${D.line}`,
          borderRadius: 2.5, p: 0.5, display: 'flex',
          overflowX: 'auto', ...scrollbar }}>
          <Box onClick={toggleFixed}
            title="No markup — promo / catalog items whose price already includes your margin; you type each client price"
            sx={{
              cursor: 'pointer', flex: '1 0 56px', minWidth: 56, textAlign: 'center',
              py: 0.95, px: 0.5, borderRadius: 1.75,
              bgcolor: fixedPrice ? D.amber : 'transparent',
              transition: 'background-color 0.18s ease, transform 0.15s ease',
              '&:hover': fixedPrice ? {} : { bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateY(-1px)' },
            }}>
            <Typography sx={{ color: fixedPrice ? D.ink : D.muted, fontSize: 13, fontWeight: 800, ...mono }}>
              0%
            </Typography>
          </Box>
          {TIERS.map(pct => {
            const sel = !fixedPrice && uniformPct === pct;
            const totalProfit = profitAtMargin(pct);
            return (
              <Box key={pct} onClick={() => applyTier(pct)} sx={{
                cursor: 'pointer', flex: '1 0 62px', minWidth: 62, textAlign: 'center',
                py: 0.7, px: 0.5, borderRadius: 1.75,
                bgcolor: sel ? D.green : 'transparent',
                boxShadow: sel ? `0 2px 12px ${D.glow}` : 'none',
                transition: 'background-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
                '&:hover': sel ? {} : { bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateY(-1px)' },
              }}
                title={`price every option at a true ${pct}% margin — ${fmt(totalProfit)} total profit if the client takes everything`}>
                <Typography sx={{ color: sel ? D.ink : D.text, fontSize: 12.5, fontWeight: 800, ...mono }}>
                  {pct}%
                </Typography>
                <Typography sx={{ color: sel ? 'rgba(6,20,12,0.72)' : D.muted, fontSize: 9, fontWeight: 700, ...mono, mt: 0.1 }}>
                  {totalProfit > 0 ? `${fmt(totalProfit)} profit` : '—'}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

// Printer network strip under the quote meta: which of your printers can
// legally take this job (nexus rule: the printer's home state must differ
// from the ship-to state), one click to set. Suggestion only — the text field
// stays free-form for printers not in the network yet.
function PrinterSuggest({ shipToState, printerName, onPick, authHdr }) {
  const [printers, setPrinters] = useState(null);
  useEffect(() => {
    let gone = false;
    axios.get(`${config.backendUrl}/api/printers`, authHdr)
      .then(r => { if (!gone) setPrinters(r.data.printers || []); })
      .catch(() => { if (!gone) setPrinters([]); });
    return () => { gone = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!printers || !printers.length) return <Box sx={{ mb: 1.5 }} />;
  const st = String(shipToState || '').trim().toUpperCase();
  return (
    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap" sx={{ mb: 2.5 }}>
      <Typography sx={{ color: D.faint, fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
        Your network
      </Typography>
      {printers.map(p => {
        const blocked = !!st && String(p.state).toUpperCase() === st;
        const picked = (printerName || '').toLowerCase().includes(String(p.name || '').split(' ')[0].toLowerCase());
        return (
          <Chip key={p.key} size="small"
            label={`${p.name.replace(/,? Inc\.?$/i, '')} · ${p.state}${blocked ? ' — nexus ⚠' : ''}`}
            onClick={() => !blocked && onPick(p.name)}
            title={blocked
              ? `Ships to ${st} — same state as this printer. Nexus rule: pick an out-of-state printer.`
              : `${p.location || p.state} · ${(p.capabilities || []).slice(0, 3).join(', ')}${p.catalogEffective ? ` · pricing eff. ${p.catalogEffective}` : ''}`}
            sx={{ fontWeight: 700, fontSize: 11, height: 24,
              cursor: blocked ? 'not-allowed' : 'pointer',
              bgcolor: picked ? D.green : blocked ? 'rgba(248,113,113,0.10)' : 'rgba(255,255,255,0.05)',
              color: picked ? D.ink : blocked ? '#f87171' : D.muted,
              border: `1px solid ${picked ? D.green : blocked ? 'rgba(248,113,113,0.4)' : D.line}`,
              '&:hover': blocked || picked ? {} : { bgcolor: 'rgba(74,222,128,0.12)', color: D.text } }} />
        );
      })}
      {st && printers.every(p => String(p.state).toUpperCase() === st) && (
        <Typography sx={{ color: D.amber, fontSize: 11, fontWeight: 700 }}>
          every network printer is in {st} — you'll need one out of state for this job
        </Typography>
      )}
    </Stack>
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
  // The committed price's true margin — what the tier strip highlights.
  const selectedPct = cogsPerUnit > 0 && committed && num(line.unitPrice) > 0
    ? Math.round((1 - cogsPerUnit / num(line.unitPrice)) * 100)
    : null;

  return (
    <Box sx={{
      opacity: line.hiddenFromClient ? 0.55 : 1,
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
        {/* Park this line: kept for you (costs, notes, math) but the client
            never sees it and it never counts toward totals. */}
        <IconButton size="small"
          onClick={() => onPatch({ hiddenFromClient: !line.hiddenFromClient, ...(line.hiddenFromClient ? {} : { accepted: false }) })}
          title={line.hiddenFromClient
            ? 'Hidden from the client — click to show it on their quote again'
            : 'Hide this line from the client (kept here for you)'}
          sx={{ color: line.hiddenFromClient ? D.amber : D.faint, mb: 0.3, '&:hover': { color: D.amber } }}>
          {line.hiddenFromClient
            ? <VisibilityOffOutlinedIcon sx={{ fontSize: 17 }} />
            : <VisibilityOutlinedIcon sx={{ fontSize: 17 }} />}
        </IconButton>
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

      {/* Markup strip — a segmented control on an inset darker track. Each chip
          reads "+markup%" over the PRICE this line would sell at ("markup, then
          the cost at that number"). Only the SELECTED tier wears the brand green.
          "0%" is the promo / fixed-price lane: no markup added, you type the
          client price. Profit/unit + margin land in the footer on selection. */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5 }}>
        <Stack direction="row" alignItems="baseline" gap={1} mb={0.75} flexWrap="wrap">
          <Typography sx={{ color: line.noMarkup ? D.amber : D.green, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {line.noMarkup ? 'Margin 0% · you set the price' : 'Margin'}
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 10 }}>
            COGS {fmt(cogsPerUnit)}/unit
            {setupShipPerUnit > 0 ? ` (incl. ${fmt(setupShipPerUnit)} setup+ship/unit)` : ''} — click your margin; the $ is your total profit at it
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
            <Box onClick={() => onSelectTier(0)}
              title="No markup — promo / catalog price already includes your margin; type the client price"
              sx={{
                cursor: 'pointer', flex: '1 0 64px', minWidth: 64, textAlign: 'center',
                py: 0.7, px: 0.5, borderRadius: 1.75,
                bgcolor: line.noMarkup ? D.amber : 'transparent',
                transition: 'background-color 0.18s ease, transform 0.15s ease',
                '&:hover': line.noMarkup ? {} : { bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateY(-1px)' },
              }}>
              <Typography sx={{ color: line.noMarkup ? D.ink : D.muted, fontSize: 10, fontWeight: 700 }}>
                0%
              </Typography>
              <Typography sx={{ color: line.noMarkup ? D.ink : D.text, fontSize: 13, fontWeight: 800, ...mono }}>
                {fmt(cogsPerUnit)}
              </Typography>
            </Box>
            {TIERS.map(pct => {
              // A true pct% margin: price = cost / (1 − pct). The chip shows the
              // margin, the resulting unit price, and the TOTAL profit at this
              // line's quantity — "how much do I make at 30%?" at a glance.
              const price = +priceAtMargin(cogsPerUnit, pct).toFixed(2);
              const tierProfitTotal = (price - cogsPerUnit) * qty;
              const sel = !line.noMarkup && selectedPct === pct;
              return (
                <Box key={pct} onClick={() => onSelectTier(pct)} sx={{
                  cursor: 'pointer', flex: '1 0 70px', minWidth: 70, textAlign: 'center',
                  py: 0.7, px: 0.5, borderRadius: 1.75,
                  bgcolor: sel ? D.green : 'transparent',
                  boxShadow: sel ? `0 2px 12px ${D.glow}` : 'none',
                  transition: 'background-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
                  '&:hover': sel ? {} : { bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateY(-1px)' },
                }}
                  title={`${pct}% margin → ${fmt(price)}/unit · ${fmt(tierProfitTotal)} total profit at ${qty} units`}>
                  <Typography sx={{ color: sel ? 'rgba(6,20,12,0.72)' : D.muted, fontSize: 10, fontWeight: 700,
                    transition: 'color 0.18s' }}>
                    {pct}%
                  </Typography>
                  <Typography sx={{ color: sel ? D.ink : D.text, fontSize: 12.5, fontWeight: 800,
                    ...mono, transition: 'color 0.18s' }}>
                    {fmt(price)}
                  </Typography>
                  <Typography sx={{ color: sel ? 'rgba(6,20,12,0.72)' : D.muted, fontSize: 9, fontWeight: 700, ...mono, mt: 0.1 }}>
                    +{fmt(tierProfitTotal)}
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

// ── Promo catalog picker ──────────────────────────────────────────────────────
//
// Vendor promo items (grinders, trays, mylar bags…) with the client price AND
// the owner's net cost per quantity tier, MOQ, setup, turnaround and print
// method — scraped from the vendor catalogs into /api/promo-products. Pick a
// product, tick the run sizes to pitch, and each becomes a quote line with the
// client price COMMITTED at 0% markup (the catalog price already carries the
// margin) and the net cost in the cost fields, so the margin chips read true.

// CLIENT MIRRORS of services/promoCatalog.js (backend) — keep in sync.
// The break a quantity prices at: the largest tier ≤ qty ("at 500+, this price").
function promoBreakAt(breaks, qty, valKey) {
  const arr = Array.isArray(breaks) ? breaks : [];
  if (!arr.length) return { qty: 0, value: 0 };
  let best = null;
  for (const b of arr) if (b.qty <= qty && (!best || b.qty > best.qty)) best = b;
  return best ? { qty: best.qty, value: num(best[valKey]) } : { qty: arr[0].qty, value: num(arr[0][valKey]) };
}
// "$50 (G)" → 50; blank/junk → 0.
function promoMoney(s) {
  const m = String(s || '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}
// "3-5 Business Days" → 1, "7-10 business days" → 2, "8-10 weeks" → 10. The
// max number in the string, converted to whole weeks (5 business days ≈ 1wk).
function promoWeeks(s) {
  const str = String(s || '');
  const nums = (str.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!nums.length) return '';
  const max = Math.max(...nums);
  if (/week/i.test(str)) return Math.ceil(max);
  if (/day/i.test(str)) return Math.max(1, Math.ceil(max / 5));
  return '';
}

function PromoPickerDialog({ open, onClose, authHdr, onAdd }) {
  const [products, setProducts] = useState(null);   // null = loading
  const [error,    setError]    = useState('');
  const [q,        setQ]        = useState('');
  const [cat,      setCat]      = useState('');
  const [picked,   setPicked]   = useState(null);   // the product being configured
  const [qtys,     setQtys]     = useState(() => new Set());

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError('');
    axios.get(`${config.backendUrl}/api/promo-products`, authHdr)
      .then((r) => { if (!cancelled) setProducts(r.data.products || []); })
      .catch((e) => { if (!cancelled) { setProducts([]); setError(e.response?.data?.message || 'Could not load the promo catalog'); } });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (!open) { setPicked(null); setQ(''); setCat(''); } }, [open]);

  const cats = [...new Set((products || []).map((p) => p.category).filter(Boolean))].sort();
  const needle = q.trim().toLowerCase();
  const rows = (products || []).filter((p) =>
    (!cat || p.category === cat) &&
    (!needle || `${p.name} ${p.sku} ${p.category} ${p.description}`.toLowerCase().includes(needle)));

  const pick = (p) => {
    setPicked(p);
    // Pre-tick the first three run sizes — the usual "here are your options" pitch.
    setQtys(new Set((p.clientPriceBreaks || []).slice(0, 3).map((b) => b.qty)));
  };
  const toggleQty = (n) => setQtys((prev) => {
    const next = new Set(prev);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  const add = () => {
    if (!picked || !qtys.size) return;
    const label = picked.variant === 'overseas' ? `${picked.name} (overseas)` : picked.name;
    const lines = [...qtys].sort((a, b) => a - b).map((qty) => {
      const price = promoBreakAt(picked.clientPriceBreaks, qty, 'price').value;
      const cost  = promoBreakAt(picked.netCostBreaks, qty, 'cost').value;
      return {
        ...emptyLine(),
        group: label, description: label, styleCode: picked.sku || '',
        qty,
        blankCost: cost, printCost: 0,
        setupCost: promoMoney(picked.setupCostNet || picked.setupCostClient),
        printType: 'None', printDetails: picked.printMethod || '',
        turnaroundWeeks: promoWeeks(picked.turnaround),
        unitPrice: price, markup: 1, noMarkup: true,
      };
    });
    onAdd(lines);
  };

  const minQty = picked ? Math.max(picked.moq || 0, (picked.clientPriceBreaks || [])[0]?.qty || 0) : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: D.bg, color: D.text, border: `1px solid ${D.line}`, borderRadius: 3, maxHeight: '86vh' } }}>
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${D.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={accentBar} />
        <Typography sx={{ fontWeight: 800, fontSize: 14, flex: 1 }}>
          Cannabis Promotions
          <Typography component="span" sx={{ color: D.muted, fontSize: 11, fontWeight: 500, ml: 1 }}>
            client price + your cost per run size — every item here POs to Cannabis Promotions
          </Typography>
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: D.muted, '&:hover': { color: D.text } }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: 2, ...scrollbar }}>
        {products === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: D.green }} size={28} /></Box>
        ) : picked ? (
          /* ── Configure the picked product: tick the run sizes to pitch ── */
          <Box>
            <Button onClick={() => setPicked(null)} sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 12, mb: 1, px: 1 }}>
              ← All products
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
              {picked.name}{picked.variant === 'overseas' ? ' · overseas' : ''}
            </Typography>
            <Typography sx={{ color: D.muted, fontSize: 12, mt: 0.25 }}>
              {[picked.sku, picked.category, picked.turnaround, picked.printMethod].filter(Boolean).join(' · ')}
            </Typography>
            {picked.description && (
              <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.5, maxWidth: 640 }}>{picked.description}</Typography>
            )}
            <Stack direction="row" gap={0.75} mt={1} flexWrap="wrap">
              {minQty > 0 && <Chip size="small" label={`Minimum ${minQty}`} sx={{ bgcolor: 'rgba(251,191,36,0.12)', color: D.amber, fontWeight: 700, fontSize: 11 }} />}
              {(picked.setupCostClient || picked.setupCostNet) && (
                <Chip size="small" label={`Setup: client ${picked.setupCostClient || '—'} · you ${picked.setupCostNet || '—'}`}
                  sx={{ bgcolor: D.inset, color: D.muted, fontWeight: 700, fontSize: 11 }} />
              )}
              {(picked.flags || []).map((f) => (
                <Chip key={f} size="small" label={f} sx={{ bgcolor: D.inset, color: D.faint, fontSize: 10.5 }} />
              ))}
            </Stack>

            <Typography sx={{ color: D.faint, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', mt: 2, mb: 0.75 }}>
              Run sizes to pitch (each becomes a column the client picks from)
            </Typography>
            <Stack gap={0.5}>
              {(picked.clientPriceBreaks || []).map((b) => {
                const cost = promoBreakAt(picked.netCostBreaks, b.qty, 'cost').value;
                const margin = b.price > 0 && cost > 0 ? ((b.price - cost) / b.price) * 100 : null;
                return (
                  <Stack key={b.qty} direction="row" alignItems="center" gap={1}
                    onClick={() => toggleQty(b.qty)}
                    sx={{ px: 1.25, py: 0.6, borderRadius: 2, cursor: 'pointer', border: `1px solid ${qtys.has(b.qty) ? D.green : D.line}`,
                      bgcolor: qtys.has(b.qty) ? 'rgba(74,222,128,0.07)' : D.inset,
                      transition: 'border-color 0.15s, background-color 0.15s' }}>
                    <Checkbox size="small" checked={qtys.has(b.qty)} sx={{ p: 0.25, color: D.faint, '&.Mui-checked': { color: D.green } }} />
                    <Typography sx={{ ...mono, fontWeight: 800, fontSize: 13, width: 76 }}>{b.qty.toLocaleString()}</Typography>
                    <Typography sx={{ ...mono, fontSize: 12.5, color: D.text, width: 110 }}>client {fmt(b.price)}</Typography>
                    <Typography sx={{ ...mono, fontSize: 12, color: D.muted, width: 100 }}>{cost > 0 ? `you ${fmt(cost)}` : '—'}</Typography>
                    {margin != null && (
                      <Typography sx={{ ...mono, fontSize: 11.5, fontWeight: 800, color: marginColor(margin) }}>
                        {margin.toFixed(0)}% margin
                      </Typography>
                    )}
                  </Stack>
                );
              })}
            </Stack>

            <Stack direction="row" gap={1} mt={2} alignItems="center">
              <Button onClick={add} disabled={!qtys.size}
                sx={{ bgcolor: D.green, color: D.ink, fontWeight: 800, textTransform: 'none', px: 2.5, borderRadius: 999,
                  '&:hover': { bgcolor: '#3fce72' }, '&.Mui-disabled': { bgcolor: D.inset, color: D.faint } }}>
                Add to quote · {qtys.size} run size{qtys.size === 1 ? '' : 's'}
              </Button>
              <Typography sx={{ color: D.faint, fontSize: 11 }}>
                Prices land committed at 0% markup — the catalog price already includes your margin.
              </Typography>
            </Stack>
          </Box>
        ) : (
          /* ── Browse/search the catalog ── */
          <Box>
            <Stack direction="row" gap={1} mb={1.25} flexWrap="wrap" alignItems="center">
              <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search grinders, trays, mylar…"
                sx={{ ...dropInput, flex: '1 1 220px', '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.9 } }} autoFocus />
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                <Chip size="small" label="All" onClick={() => setCat('')}
                  sx={{ fontWeight: 700, fontSize: 11, cursor: 'pointer',
                    bgcolor: !cat ? D.green : D.inset, color: !cat ? D.ink : D.muted }} />
                {cats.map((c) => (
                  <Chip key={c} size="small" label={c} onClick={() => setCat(c === cat ? '' : c)}
                    sx={{ fontWeight: 700, fontSize: 11, cursor: 'pointer',
                      bgcolor: cat === c ? D.green : D.inset, color: cat === c ? D.ink : D.muted }} />
                ))}
              </Stack>
            </Stack>
            {error && <Typography sx={{ color: '#f87171', fontSize: 12, mb: 1 }}>{error}</Typography>}
            {!rows.length ? (
              <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 3, py: 5, textAlign: 'center', color: D.muted, fontSize: 13 }}>
                {products.length ? 'No products match.' : 'Catalog is empty — it seeds on the next API deploy.'}
              </Box>
            ) : (
              <Stack gap={0.5}>
                {rows.map((p) => {
                  const lo = (p.clientPriceBreaks || [])[0];
                  const hi = (p.clientPriceBreaks || [])[(p.clientPriceBreaks || []).length - 1];
                  return (
                    <Stack key={p._id} direction="row" alignItems="center" gap={1.25} onClick={() => pick(p)}
                      sx={{ px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer', border: `1px solid ${D.line}`, bgcolor: D.panel,
                        transition: 'border-color 0.15s, background-color 0.15s',
                        '&:hover': { borderColor: D.green, bgcolor: D.panelHi } }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}{p.variant === 'overseas' ? ' · overseas' : ''}
                        </Typography>
                        <Typography sx={{ color: D.faint, fontSize: 11 }}>
                          {[p.sku, p.category, p.turnaround].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      {lo && (
                        <Typography sx={{ ...mono, color: D.muted, fontSize: 11.5, flexShrink: 0 }}>
                          {fmt(hi.price)}–{fmt(lo.price)}/u
                        </Typography>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
