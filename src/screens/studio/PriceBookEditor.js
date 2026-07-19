// src/screens/studio/PriceBookEditor.js
//
// A printer's PRICE BOOK, embeddable inside its record. A real printer is ONE
// shop that lives in two docs — the Vendor card (its money: POs, spend, receipts)
// and the Printer catalog (its price book, read by the Quoter). This is that price
// book, rendered as a section INSIDE the Vendor card (VendorsTab) so there's one
// printer surface, not a separate "Printer Catalog" tab beside "Printers · Vendors".
//
// App-writable (no deploy to change a price): the Quoter reads the exact same
// catalog via /api/printers, so an edit here reprices every quote. Owner-only (the
// API is behind requireAdmin). Capabilities are DERIVED server-side from the price
// sections present (never hand-typed), shown read-only. Editing a section uses a
// structure-preserving grid editor (you change numbers, never the shape), so a
// hand-edit can't produce a section the engine silently can't price.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, TextField, IconButton, Button, CircularProgress,
  Chip, Divider, Dialog, DialogContent, MenuItem, Select, FormControl,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import axios from 'axios';
import config from '../../config.json';
import { D, mono, scrollbar, dropInput, dropPrimaryBtn, fmtDate } from './_shared';
import { confirmDialog, alertDialog } from './_dialog';
import { setAtPath, coerceLikeShape } from './_catalogEdit';

const base = `${config.backendUrl}/api`;
const fieldSx = { ...dropInput, '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.9 } };

// The engine's pricing models + a friendly label (mirror of the backend
// utils/printerCatalog KNOWN_MODELS + src/common/printerPricing dispatch — keep
// in sync). Used by "Add a price book" so a new section always carries a model
// the Quoter can read.
const MODEL_OPTIONS = [
  ['qty_x_colors', 'Screen — qty × colors'],
  ['qty_only', 'Digital squeegee — qty only'],
  ['qty_x_size_x_shade', 'DTG — qty × size × shade'],
  ['qty_x_size', 'DTG/DTF — qty × size'],
  ['qty_x_stitches', 'Embroidery — qty × stitches'],
  ['qty_x_size_sqin', 'DTF — qty × sq-in'],
  ['gang_sheet_flat', 'DTF gang sheet — flat'],
  ['gang_qty_x_size', 'DTF transfer — qty × size'],
];
// Canonical capability token → readable label (mirror of backend SECTION_CAPABILITY values).
const CAP_LABEL = {
  screen_printing: 'Screen Print', digital_squeegee: 'Digital Squeegee',
  dtg: 'DTG', dtf: 'DTF', embroidery: 'Embroidery',
  digitally_printed_media: 'Digitally Printed', personalization: 'Personalization',
};

// ── A structure-preserving editor for one price-book section ──────────────────
// The pure save helpers (setAtPath / coerceLikeShape) live in ./_catalogEdit so
// they're unit-testable without pulling in React/axios.
//
// Recursive render: leaves become inputs (numbers stay numeric), nested
// objects/arrays indent under their key. `model` is shown read-only — changing it
// would change the whole grid shape, which is what "Add a price book" is for.
// `only` (top level) renders just those keys — used for the "Other settings" tail
// under a pretty grid, so the grid-defining keys aren't shown twice.
function SectionTree({ node, path, onSet, only }) {
  if (node === null || node === undefined) {
    return <Typography sx={{ ...mono, fontSize: 12, color: D.faint }}>—</Typography>;
  }
  if (typeof node !== 'object') {
    // Numeric-looking leaves right-align in a narrow field; labels (e.g. "4x4",
    // "72-144") get a wider text field. Edited as strings, coerced on save.
    const looksNum = typeof node === 'number' || (typeof node === 'string' && node.trim() !== '' && !Number.isNaN(Number(node)));
    return (
      <TextField size="small" value={node === null ? '' : node}
        inputProps={{ inputMode: looksNum ? 'decimal' : 'text' }}
        onChange={(e) => onSet(path, e.target.value)}
        sx={{ ...fieldSx, width: looksNum ? 96 : 200,
          '& .MuiInputBase-input': { ...fieldSx['& .MuiInputBase-input'], ...mono, textAlign: looksNum ? 'right' : 'left', py: 0.5 } }} />
    );
  }
  let entries = Array.isArray(node) ? node.map((v, i) => [i, v]) : Object.entries(node);
  if (only && !path.length) entries = entries.filter(([k]) => only.includes(k));
  return (
    <Box sx={{ pl: path.length ? 1.5 : 0, borderLeft: path.length ? `1px solid ${D.line}` : 'none' }}>
      {entries.map(([k, v]) => {
        const leaf = v === null || typeof v !== 'object';
        const readOnly = k === 'model';
        return (
          <Box key={k} sx={{ display: leaf ? 'flex' : 'block', alignItems: 'center', gap: 1, py: 0.35 }}>
            <Typography sx={{ ...mono, fontSize: 11.5, minWidth: leaf ? 128 : 'auto',
              fontWeight: leaf ? 400 : 700, color: leaf ? D.faint : D.muted, mt: leaf ? 0 : 0.5 }}>
              {k}
            </Typography>
            {readOnly
              ? <Chip size="small" label={String(v)} sx={{ ...mono, height: 20, fontSize: 11, bgcolor: D.inset, color: D.green }} />
              : <SectionTree node={v} path={[...path, k]} onSet={onSet} />}
          </Box>
        );
      })}
    </Box>
  );
}

// ── Pretty per-model price grids ──────────────────────────────────────────────
// SectionTree can edit any shape, but a price book reads far better as the
// spreadsheet it actually is. For each engine model we render the price matrix
// as a real table — quantity tiers down the side, the method's variable (colors /
// size / stitch band / sq-in / shade) across the top — with editable numeric
// cells wired to the SAME draft/onSet path the tree uses, so the structure-
// preserving save is untouched. Headers that KEY the grid (a size that indexes
// `grid[size]`, a tier label that indexes `grid[label]`) are read-only —
// renaming them here would orphan their price row — while index-based headers
// (color columns, sq-in bands, tier minQtys) stay editable. Anything the matrix
// doesn't cover (fees, flags, minimums) drops to an "Other settings" tree below,
// so no field is ever hidden.
const arr = (x) => (Array.isArray(x) ? x : []);
const cellSx = { ...fieldSx, width: 74,
  '& .MuiInputBase-input': { ...fieldSx['& .MuiInputBase-input'], ...mono, textAlign: 'right', py: 0.4, fontSize: 12 } };

// One numeric price cell bound to a leaf path. Blank shows the N/A placeholder;
// edited as a raw string (decimals don't jump), coerced to the section's shape on save.
function PriceCell({ value, path, onSet }) {
  return (
    <TextField size="small" value={value === null || value === undefined ? '' : value}
      placeholder="—" inputProps={{ inputMode: 'decimal' }}
      onChange={(e) => onSet(path, e.target.value)} sx={cellSx} />
  );
}
// Editable header input (row/col labels + minQtys). `read` → static text (grid-key headers).
function HeadInput({ value, path, onSet, num, read, w = 62 }) {
  if (read) return <Typography sx={{ ...mono, fontSize: 11.5, color: D.text, whiteSpace: 'nowrap' }}>{value == null || value === '' ? '—' : value}</Typography>;
  return (
    <TextField size="small" value={value == null ? '' : value} inputProps={{ inputMode: num ? 'decimal' : 'text' }}
      onChange={(e) => onSet(path, e.target.value)}
      sx={{ ...fieldSx, width: w,
        '& .MuiInputBase-input': { ...fieldSx['& .MuiInputBase-input'], ...mono, textAlign: num ? 'right' : 'left', py: 0.35, fontSize: 11 } }} />
  );
}
// The bordered price matrix. `cols` = header JSX; `rows` = [{ head, cells: [] }].
function Matrix({ corner, cols, rows }) {
  const th = { padding: '4px 7px', textAlign: 'center', background: D.inset,
    borderBottom: `1px solid ${D.line}`, whiteSpace: 'nowrap' };
  const rh = { padding: '3px 10px 3px 2px', textAlign: 'left', borderBottom: `1px solid ${D.line}`, whiteSpace: 'nowrap' };
  const td = { padding: '2px 3px', textAlign: 'center', borderBottom: `1px solid ${D.line}` };
  return (
    <Box sx={{ overflowX: 'auto', ...scrollbar }}>
      <Box component="table" sx={{ borderCollapse: 'collapse' }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ ...th, textAlign: 'left', color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{corner}</Box>
            {cols.map((c, i) => <Box component="th" key={i} sx={th}>{c}</Box>)}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((r, ri) => (
            <Box component="tr" key={ri}>
              <Box component="th" sx={rh}>{r.head}</Box>
              {r.cells.map((cell, ci) => <Box component="td" key={ci} sx={td}>{cell}</Box>)}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// qty × colors — screen print. Rows = qty tiers (label + minQty editable), cols =
// color columns (index-based, editable), cell = tiers[ti].prices[ci].
function gridQtyColors(node, onSet) {
  const cols = arr(node.colorColumns), tiers = arr(node.tiers);
  return (
    <Matrix corner="min qty ↓ / colors →"
      cols={cols.map((c, ci) => <HeadInput key={ci} value={c} path={['colorColumns', ci]} onSet={onSet} w={46} />)}
      rows={tiers.map((t, ti) => ({
        head: (
          <Stack direction="row" gap={0.5} alignItems="center">
            <HeadInput value={t.label} path={['tiers', ti, 'label']} onSet={onSet} w={62} />
            <HeadInput value={t.minQty} path={['tiers', ti, 'minQty']} onSet={onSet} num w={42} />
          </Stack>
        ),
        cells: cols.map((_, ci) => <PriceCell key={ci} value={(t.prices || [])[ci]} path={['tiers', ti, 'prices', ci]} onSet={onSet} />),
      }))} />
  );
}
// qty only — digital squeegee. One price per qty tier.
function gridQtyOnly(node, onSet) {
  const tiers = arr(node.tiers);
  return (
    <Matrix corner="tier"
      cols={[<Typography key="p" sx={{ ...mono, fontSize: 10, color: D.faint }}>price / unit</Typography>]}
      rows={tiers.map((t, ti) => ({
        head: (
          <Stack direction="row" gap={0.5} alignItems="center">
            <HeadInput value={t.label} path={['tiers', ti, 'label']} onSet={onSet} w={68} />
            <HeadInput value={t.minQty} path={['tiers', ti, 'minQty']} onSet={onSet} num w={42} />
          </Stack>
        ),
        cells: [<PriceCell key="p" value={t.price} path={['tiers', ti, 'price']} onSet={onSet} />],
      }))} />
  );
}
// qty × size — DTG/DTF grid keyed by size (rows read-only), qty tiers across (minQty editable).
function gridQtySize(node, onSet) {
  const sizes = arr(node.sizes), tiers = arr(node.qtyTiers), grid = node.grid || {};
  return (
    <Matrix corner="size ↓ / qty →"
      cols={tiers.map((t, ci) => (
        <Stack key={ci} alignItems="center" gap={0.2}>
          <Typography sx={{ ...mono, fontSize: 10, color: D.muted }}>{t.label || `${t.minQty}+`}</Typography>
          <HeadInput value={t.minQty} path={['qtyTiers', ci, 'minQty']} onSet={onSet} num w={42} />
        </Stack>
      ))}
      rows={sizes.map((s) => ({
        head: <HeadInput value={s} read />,
        cells: tiers.map((_, ci) => <PriceCell key={ci} value={(grid[s] || [])[ci]} path={['grid', s, ci]} onSet={onSet} />),
      }))} />
  );
}
// qty × stitches — embroidery. Rows = qty tiers (grid keyed by label, read-only),
// cols = stitch bands (editable strings).
function gridQtyStitches(node, onSet) {
  const bands = arr(node.stitchBands), tiers = arr(node.qtyTiers), grid = node.grid || {};
  return (
    <Matrix corner="qty ↓ / stitches →"
      cols={bands.map((b, ci) => <HeadInput key={ci} value={b} path={['stitchBands', ci]} onSet={onSet} w={80} />)}
      rows={tiers.map((t) => ({
        head: <HeadInput value={t.label} read />,
        cells: bands.map((_, ci) => <PriceCell key={ci} value={(grid[t.label] || [])[ci]} path={['grid', t.label, ci]} onSet={onSet} />),
      }))} />
  );
}
// qty × sq-in — A+ DTF. Rows = qty tiers (grid keyed by the tier string, read-only),
// cols = sq-in bands (editable numbers).
function gridQtySqin(node, onSet) {
  const bands = arr(node.sizeBandsSqin), tiers = arr(node.qtyTiers), grid = node.grid || {};
  return (
    <Matrix corner="qty ↓ / max sq-in →"
      cols={bands.map((b, ci) => <HeadInput key={ci} value={b} path={['sizeBandsSqin', ci]} onSet={onSet} num w={54} />)}
      rows={tiers.map((t) => ({
        head: <HeadInput value={t} read />,
        cells: bands.map((_, ci) => <PriceCell key={ci} value={(grid[t] || [])[ci]} path={['grid', t, ci]} onSet={onSet} />),
      }))} />
  );
}
// qty × size — Contract-DTG DTF transfer. Rows = sizes (grid keyed, read-only),
// cols = qty columns (label + minQty editable).
function gridGangQtySize(node, onSet) {
  const sizes = arr(node.sizes), cols = arr(node.qtyCols), grid = node.grid || {};
  return (
    <Matrix corner="size ↓ / qty →"
      cols={cols.map((c, ci) => (
        <Stack key={ci} alignItems="center" gap={0.2}>
          <HeadInput value={c.label} path={['qtyCols', ci, 'label']} onSet={onSet} w={60} />
          <HeadInput value={c.minQty} path={['qtyCols', ci, 'minQty']} onSet={onSet} num w={42} />
        </Stack>
      ))}
      rows={sizes.map((s) => ({
        head: <HeadInput value={s} read />,
        cells: cols.map((_, ci) => <PriceCell key={ci} value={(grid[s] || [])[ci]} path={['grid', s, ci]} onSet={onSet} />),
      }))} />
  );
}
// qty × size × shade — DTG. One size × shade table per qty tier (prices are
// [dark, light, whiteInkOnly?] arrays keyed by size).
const SHADE_LABELS = ['dark', 'light', 'white-only'];
function gridQtySizeShade(node, onSet) {
  const sizes = arr(node.sizes), tiers = arr(node.tiers);
  let shadeCount = 2;
  for (const t of tiers) for (const s of sizes) { const a = t.prices && t.prices[s]; if (Array.isArray(a)) shadeCount = Math.max(shadeCount, a.length); }
  const shades = SHADE_LABELS.slice(0, shadeCount);
  return (
    <Stack gap={1.5}>
      {tiers.map((t, ti) => (
        <Box key={ti}>
          <Typography sx={{ ...mono, fontSize: 11, color: D.green, mb: 0.4 }}>
            {t.label || `${t.minQty}+`}
            <Typography component="span" sx={{ color: D.faint, fontSize: 10, ml: 0.75 }}>min {t.minQty}</Typography>
          </Typography>
          <Matrix corner="size ↓ / shade →"
            cols={shades.map((sh, si) => <Typography key={si} sx={{ ...mono, fontSize: 10.5, color: D.muted }}>{sh}</Typography>)}
            rows={sizes.map((s) => ({
              head: <HeadInput value={s} read />,
              cells: shades.map((_, si) => <PriceCell key={si} value={((t.prices && t.prices[s]) || [])[si]} path={['tiers', ti, 'prices', s, si]} onSet={onSet} />),
            }))} />
        </Box>
      ))}
    </Stack>
  );
}

// model → { keys it renders as a grid, render fn }. Absent model (Heritage
// priceGrids, gang_sheet_flat scalars) falls back to the full tree.
const GRID_LAYOUTS = {
  qty_x_colors: { keys: ['colorColumns', 'tiers'], render: gridQtyColors },
  qty_only: { keys: ['tiers'], render: gridQtyOnly },
  qty_x_size: { keys: ['sizes', 'qtyTiers', 'grid'], render: gridQtySize },
  qty_x_stitches: { keys: ['stitchBands', 'qtyTiers', 'grid'], render: gridQtyStitches },
  qty_x_size_sqin: { keys: ['sizeBandsSqin', 'qtyTiers', 'grid'], render: gridQtySqin },
  gang_qty_x_size: { keys: ['sizes', 'qtyCols', 'grid'], render: gridGangQtySize },
  qty_x_size_x_shade: { keys: ['tiers', 'sizes', 'shades'], render: gridQtySizeShade },
};

// A price book's body: the pretty grid for its model + an "Other settings" tail
// for everything the grid doesn't cover. Unknown/scalar models → the full tree.
function SectionBody({ node, onSet }) {
  const layout = node && typeof node === 'object' && !Array.isArray(node) ? GRID_LAYOUTS[node.model] : null;
  if (!layout) return <SectionTree node={node} path={[]} onSet={onSet} />;
  const omit = new Set([...layout.keys, 'model']);
  const restKeys = Object.keys(node).filter((k) => !omit.has(k));
  return (
    <Stack gap={1.25}>
      {layout.render(node, onSet)}
      {restKeys.length > 0 && (
        <Box>
          <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.4 }}>Other settings</Typography>
          <SectionTree node={node} path={[]} onSet={onSet} only={restKeys} />
        </Box>
      )}
    </Stack>
  );
}

function SectionEditor({ printerKey, sectionKey, section, authHdr, onSaved }) {
  const [draft, setDraft] = useState(section);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(section); }, [section]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(section), [draft, section]);
  const onSet = (path, val) => setDraft((d) => setAtPath(d, path, val));

  const save = async () => {
    setSaving(true);
    try {
      // Coerce the string-edited leaves back to the section's original numeric shape.
      const clean = coerceLikeShape(draft, section);
      const r = await axios.put(`${base}/printers/${printerKey}/catalog/${sectionKey}`, { section: clean }, authHdr);
      onSaved(r.data.printer);
    } catch (e) {
      alertDialog({ title: 'Couldn’t save', message: e.response?.data?.message || e.message, danger: true });
    } finally { setSaving(false); }
  };
  const archive = async () => {
    if (!await confirmDialog({ title: `Archive “${sectionKey}”?`, message: 'It stops pricing quotes but stays recoverable.', confirmLabel: 'Archive', danger: true })) return;
    setSaving(true);
    try {
      const r = await axios.delete(`${base}/printers/${printerKey}/catalog/${sectionKey}`, authHdr);
      onSaved(r.data.printer);
    } catch (e) {
      alertDialog({ title: 'Couldn’t archive', message: e.response?.data?.message || e.message, danger: true });
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2.5, bgcolor: D.panel, p: 1.75, mb: 1.5 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: D.text }}>{sectionKey}</Typography>
        {draft && draft.model && (
          <Chip size="small" label={(MODEL_OPTIONS.find(([m]) => m === draft.model) || [null, draft.model])[1]}
            title={`Pricing model: ${draft.model}`}
            sx={{ ...mono, height: 20, fontSize: 10.5, bgcolor: D.inset, color: D.green }} />
        )}
        <Box sx={{ flex: 1 }} />
        {dirty && <Chip size="small" label="unsaved" sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(251,191,36,0.16)', color: D.amber }} />}
        <IconButton size="small" onClick={archive} disabled={saving} title="Archive this price book"
          sx={{ color: D.faint, '&:hover': { color: '#f87171' } }}>
          <DeleteOutlineIcon sx={{ fontSize: 17 }} />
        </IconButton>
      </Stack>
      <SectionBody node={draft} onSet={onSet} />
      <Stack direction="row" gap={1} sx={{ mt: 1.25 }}>
        <Button size="small" onClick={save} disabled={!dirty || saving} sx={{ ...dropPrimaryBtn, fontSize: 12 }}>
          {saving ? <CircularProgress size={14} sx={{ color: D.ink }} /> : 'Save prices'}
        </Button>
        {dirty && <Button size="small" onClick={() => setDraft(section)} disabled={saving}
          sx={{ textTransform: 'none', color: D.muted, fontSize: 12 }}>Reset</Button>}
      </Stack>
    </Box>
  );
}

// ── Inline meta field (blur-commit), mirrors the Vendors ProfileField ─────────
function Field({ label, value, onCommit, placeholder, width }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  return (
    <Box sx={{ width: width || '100%' }}>
      <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.4 }}>{label}</Typography>
      <TextField size="small" fullWidth value={v} placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((v ?? '') !== (value ?? '')) onCommit(v); }}
        sx={fieldSx} />
    </Box>
  );
}

// ── Embeddable price-book panel ───────────────────────────────────────────────
// Rendered inside a Vendor card (VendorsTab) for the linked printer: derived
// capabilities, the pricing provenance + yearly re-verify nudge, and the editable
// price-book grids. Identity / contact / money are owned by the surrounding card.
export default function PriceBookEditor({ pkey, authHdr, onUnlink, vendorState }) {
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingSection, setAddingSection] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${base}/printers/${pkey}`, authHdr)
      .then((r) => setP(r.data.printer))
      .catch((e) => alertDialog({ title: 'Couldn’t load the price book', message: e.response?.data?.message || e.message, danger: true }))
      .finally(() => setLoading(false));
  }, [pkey, authHdr]);
  useEffect(() => { load(); }, [load]);

  const applyPrinter = (printer) => setP(printer);

  const patch = async (body) => {
    try {
      const r = await axios.patch(`${base}/printers/${pkey}`, body, authHdr);
      applyPrinter(r.data.printer);
    } catch (e) {
      alertDialog({ title: 'Save failed', message: e.response?.data?.message || e.message, danger: true });
    }
  };

  if (loading || !p) {
    return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={20} sx={{ color: D.green }} /></Box>;
  }

  const catalog = (p.catalog && typeof p.catalog === 'object') ? p.catalog : {};
  const NON_PRICED = new Set(['meta', 'printer', 'addOns', 'terms', 'postProduction', 'maxImprintSizes', 'colorCharts', 'policies', 'flagsForOwner', 'notes', '__archived']);
  const sectionKeys = Object.keys(catalog).filter((k) => !NON_PRICED.has(k) && catalog[k] && typeof catalog[k] === 'object');
  const archived = p.catalogArchive && typeof p.catalogArchive === 'object' ? Object.keys(p.catalogArchive) : [];
  const reviewDue = p.reviewDue;
  // Surface (don't silently reconcile) a nexus-state disagreement between the
  // vendor card and the printer catalog — the Quoter routes on the printer's.
  const stateDrift = vendorState && p.state && String(vendorState).toUpperCase() !== String(p.state).toUpperCase();

  return (
    <Stack spacing={1.5}>
      {/* Derived capabilities + the yearly re-verify flag + unlink */}
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        {(p.capabilities || []).length ? (p.capabilities || []).map((c) => (
          <Chip key={c} size="small" label={CAP_LABEL[c] || c} sx={{ height: 22, fontSize: 11, bgcolor: 'rgba(74,222,128,0.12)', color: D.green }} />
        )) : (
          <Typography sx={{ color: D.faint, fontSize: 12 }}>No priced sections yet.</Typography>
        )}
        {reviewDue && <Chip size="small" label="review due" sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(251,191,36,0.16)', color: D.amber }} />}
        <Box sx={{ flex: 1 }} />
        {onUnlink && (
          <Button size="small" onClick={onUnlink} startIcon={<LinkOffOutlinedIcon sx={{ fontSize: 15 }} />}
            title="Unlink this supplier from its price book (the price book itself is kept)"
            sx={{ textTransform: 'none', fontSize: 11.5, color: D.faint, '&:hover': { color: '#f87171' } }}>
            Unlink
          </Button>
        )}
      </Stack>

      {/* Pricing provenance — effective date, nexus home state (the Quoter's), source sheet */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.25 }}>
        <Field label="Price sheet effective" value={p.catalogEffective} onCommit={(v) => patch({ catalogEffective: v })} placeholder="2026-01-01" />
        <Field label="Nexus home state (Quoter)" value={p.state} onCommit={(v) => patch({ state: v })} placeholder="PA" />
        <Field label="Source PDF URL" value={p.sourcePdfUrl} onCommit={(v) => patch({ sourcePdfUrl: v })} placeholder="https://…" />
      </Box>
      {stateDrift && (
        <Typography sx={{ color: D.amber, fontSize: 11 }}>
          ⚠ Nexus state is <b>{String(p.state).toUpperCase()}</b> here vs <b>{String(vendorState).toUpperCase()}</b> on the card — the Quoter routes on {String(p.state).toUpperCase()}.
        </Typography>
      )}
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        <EventRepeatOutlinedIcon sx={{ fontSize: 17, color: reviewDue ? D.amber : D.faint }} />
        <Typography sx={{ fontSize: 12, color: reviewDue ? D.amber : D.muted }}>
          {reviewDue ? 'Pricing is a year old — re-verify with the printer.' : 'Pricing captured'}
          {p.capturedOn ? ` · captured ${p.capturedOn}` : ''}
          {p.pricingReviewedOn ? ` · reviewed ${p.pricingReviewedOn}` : ''}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {p.sourcePdfUrl && (
          <IconButton size="small" component="a" href={p.sourcePdfUrl} target="_blank" rel="noreferrer"
            title="Open the source price sheet" sx={{ color: D.muted, '&:hover': { color: D.green } }}>
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <Button size="small" onClick={() => patch({ markReviewed: true })} startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 15 }} />}
          sx={{ textTransform: 'none', fontSize: 12, color: D.green, border: `1px solid ${D.line}`, borderRadius: 999, px: 1.5,
            '&:hover': { borderColor: D.green } }}>
          Pricing reviewed today
        </Button>
      </Stack>
      {p.editedBy && (
        <Typography sx={{ color: D.faint, fontSize: 10.5 }}>
          Last edited by {p.editedBy}{p.editedAt ? ` · ${fmtDate(p.editedAt)}` : ''}
        </Typography>
      )}

      <Divider sx={{ borderColor: D.line }} />

      {/* Price books */}
      <Box>
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13, color: D.text, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Price books
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => setAddingSection(true)} startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', fontSize: 12, color: D.green }}>Add a price book</Button>
        </Stack>
        {sectionKeys.length === 0 && (
          <Typography sx={{ color: D.faint, fontSize: 12.5, mb: 1 }}>
            No price books yet — add one so the Quoter can price this printer.
          </Typography>
        )}
        {sectionKeys.map((sk) => (
          <SectionEditor key={sk} printerKey={pkey} sectionKey={sk} section={catalog[sk]} authHdr={authHdr} onSaved={applyPrinter} />
        ))}
        {archived.length > 0 && (
          <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.5 }}>
            Archived: {archived.join(', ')}
          </Typography>
        )}
      </Box>

      {addingSection && (
        <AddSectionDialog printerKey={pkey} authHdr={authHdr}
          existing={sectionKeys}
          onClose={() => setAddingSection(false)}
          onAdded={(printer) => { applyPrinter(printer); setAddingSection(false); }} />
      )}
    </Stack>
  );
}

// Add a new price book. The owner picks the section key + model (so it's always
// engine-priceable) and pastes the grid JSON (how catalogs are authored today);
// the server validates the model tag before saving.
function AddSectionDialog({ printerKey, authHdr, existing, onClose, onAdded }) {
  const [sectionKey, setSectionKey] = useState('');
  const [model, setModel] = useState('qty_x_colors');
  const [json, setJson] = useState('{\n  \n}');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const key = sectionKey.trim();
    if (!key) { alertDialog({ title: 'Name it', message: 'Give the price book a section key (e.g. dtg, screenPrinting).' }); return; }
    if (existing.includes(key)) { alertDialog({ title: 'Already exists', message: `“${key}” is already a price book — edit it instead.` }); return; }
    let body;
    try { body = JSON.parse(json); }
    catch (e) { alertDialog({ title: 'That isn’t valid JSON', message: e.message, danger: true }); return; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { alertDialog({ title: 'Needs an object', message: 'The price book must be a JSON object.' }); return; }
    body.model = model;   // stamp the chosen model so the engine can price it
    setSaving(true);
    try {
      const r = await axios.put(`${base}/printers/${printerKey}/catalog/${key}`, { section: body }, authHdr);
      onAdded(r.data.printer);
    } catch (e) {
      alertDialog({ title: 'Couldn’t add', message: e.response?.data?.message || e.message, danger: true });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3 } }}>
      <DialogContent sx={{ p: 2.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15, color: D.text, mb: 1.5 }}>Add a price book</Typography>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 160px' }}>
              <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', mb: 0.4 }}>Section key</Typography>
              <TextField size="small" fullWidth value={sectionKey} placeholder="dtg"
                onChange={(e) => setSectionKey(e.target.value.replace(/[^A-Za-z]/g, ''))} sx={fieldSx} />
            </Box>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', mb: 0.4 }}>Pricing model</Typography>
              <FormControl size="small" fullWidth sx={dropInput}>
                <Select value={model} onChange={(e) => setModel(e.target.value)} sx={{ color: D.text, fontSize: 13 }}>
                  {MODEL_OPTIONS.map(([m, label]) => <MenuItem key={m} value={m}>{label}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </Box>
          <Box>
            <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', mb: 0.4 }}>
              Grid JSON (tiers / prices — the `model` is stamped for you)
            </Typography>
            <TextField multiline minRows={7} fullWidth value={json} onChange={(e) => setJson(e.target.value)}
              sx={{ ...fieldSx, '& .MuiInputBase-input': { ...mono, fontSize: 12, color: D.text } }} />
          </Box>
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button size="small" onClick={onClose} sx={{ textTransform: 'none', color: D.muted }}>Cancel</Button>
            <Button size="small" onClick={save} disabled={saving} sx={dropPrimaryBtn}>
              {saving ? <CircularProgress size={14} sx={{ color: D.ink }} /> : 'Add price book'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
