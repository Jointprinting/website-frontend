// src/screens/studio/PrinterCatalogTab.js
//
// The PRINTER CATALOG editor — the in-Studio home for the quoter's price network.
// Until now a printer's price book could only change by hand-editing a committed
// JSON and redeploying; this surface makes it app-writable: edit prices, add a
// printer, mark a sheet re-verified, all without a deploy. The Quoter reads the
// exact same catalog (via /api/printers), so an edit here reprices every quote.
//
// Mirrors the Vendors tab shape (self-chrome list → detail) and reuses the shared
// D palette / dialogs. Owner-only (the API is behind requireAdmin). Capabilities
// are DERIVED server-side from the price sections present (never hand-typed), so
// they're shown read-only here. Editing a section uses a structure-preserving
// tree editor (you change numbers, never the shape), so a hand-edit can't produce
// a section the engine silently can't price.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, TextField, IconButton, Button, CircularProgress,
  Chip, Divider, Dialog, DialogContent, MenuItem, Select, FormControl,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import axios from 'axios';
import config from '../../config.json';
import { D, mono, accentBar, scrollbar, dropInput, dropPrimaryBtn, fmtDate } from './_shared';
import { confirmDialog, alertDialog, promptDialog } from './_dialog';

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
// Immutable deep-set along a key/index path — edits a number/string leaf without
// touching the section's shape (so the engine's `model` contract always holds).
function setAtPath(root, path, val) {
  if (!path.length) return val;
  const [head, ...rest] = path;
  const clone = Array.isArray(root) ? root.slice() : { ...(root || {}) };
  clone[head] = setAtPath(root ? root[head] : undefined, rest, val);
  return clone;
}

// Leaves are edited as raw strings (so typing a decimal like "6.60" never jumps),
// then coerced back to the ORIGINAL section's shape on save: a value that was a
// number stays a number (blank/garbage → 0), a string stays a string. The tree
// only edits leaves, never adds/removes keys, so `orig` is the shape of record.
function coerceLikeShape(draft, orig) {
  if (orig !== null && typeof orig === 'object') {
    if (Array.isArray(orig)) return orig.map((o, i) => coerceLikeShape(draft ? draft[i] : undefined, o));
    const out = {};
    for (const k of Object.keys(orig)) out[k] = coerceLikeShape(draft ? draft[k] : undefined, orig[k]);
    return out;
  }
  if (typeof orig === 'number') { const n = Number(draft); return Number.isFinite(n) ? n : 0; }
  return draft;   // string / boolean / null pass through
}

// Recursive render: leaves become inputs (numbers stay numeric), nested
// objects/arrays indent under their key. `model` is shown read-only — changing it
// would change the whole grid shape, which is what "Add a price book" is for.
function SectionTree({ node, path, onSet }) {
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
  const entries = Array.isArray(node) ? node.map((v, i) => [i, v]) : Object.entries(node);
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
        <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: D.text, flex: 1 }}>{sectionKey}</Typography>
        {dirty && <Chip size="small" label="unsaved" sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(251,191,36,0.16)', color: D.amber }} />}
        <IconButton size="small" onClick={archive} disabled={saving} title="Archive this price book"
          sx={{ color: D.faint, '&:hover': { color: '#f87171' } }}>
          <DeleteOutlineIcon sx={{ fontSize: 17 }} />
        </IconButton>
      </Stack>
      <Box sx={{ overflowX: 'auto', ...scrollbar }}>
        <SectionTree node={draft} path={[]} onSet={onSet} />
      </Box>
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

// ── Printer detail ────────────────────────────────────────────────────────────
function PrinterDetail({ pkey, authHdr, onBack, onPrinterChanged }) {
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingSection, setAddingSection] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${base}/printers/${pkey}`, authHdr)
      .then((r) => setP(r.data.printer))
      .catch((e) => { alertDialog({ title: 'Couldn’t load printer', message: e.response?.data?.message || e.message, danger: true }); onBack(); })
      .finally(() => setLoading(false));
  }, [pkey, authHdr, onBack]);
  useEffect(() => { load(); }, [load]);

  const applyPrinter = (printer) => { setP(printer); onPrinterChanged?.(printer); };

  const patch = async (body) => {
    try {
      const r = await axios.patch(`${base}/printers/${pkey}`, body, authHdr);
      applyPrinter(r.data.printer);
    } catch (e) {
      alertDialog({ title: 'Save failed', message: e.response?.data?.message || e.message, danger: true });
    }
  };

  if (loading || !p) {
    return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: D.green }} /></Box>;
  }

  const catalog = (p.catalog && typeof p.catalog === 'object') ? p.catalog : {};
  const NON_PRICED = new Set(['meta', 'printer', 'addOns', 'terms', 'postProduction', 'maxImprintSizes', 'colorCharts', 'policies', 'flagsForOwner', 'notes', '__archived']);
  const sectionKeys = Object.keys(catalog).filter((k) => !NON_PRICED.has(k) && catalog[k] && typeof catalog[k] === 'object');
  const archived = p.catalogArchive && typeof p.catalogArchive === 'object' ? Object.keys(p.catalogArchive) : [];
  const reviewDue = p.reviewDue;

  return (
    <Stack spacing={2}>
      <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
        sx={{ textTransform: 'none', color: D.muted, fontWeight: 600, px: 0.5, alignSelf: 'flex-start', '&:hover': { color: D.green, bgcolor: 'transparent' } }}>
        All printers
      </Button>

      {/* Identity + meta */}
      <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2.5, bgcolor: D.panel, p: 2 }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: D.text }}>{p.name}</Typography>
          <Chip size="small" label={p.state || '—'} sx={{ ...mono, height: 22, bgcolor: D.inset, color: D.muted }} />
          {(p.capabilities || []).map((c) => (
            <Chip key={c} size="small" label={CAP_LABEL[c] || c} sx={{ height: 22, fontSize: 11, bgcolor: 'rgba(74,222,128,0.12)', color: D.green }} />
          ))}
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Field label="Name" value={p.name} onCommit={(v) => patch({ name: v })} />
          <Field label="Home state (nexus)" value={p.state} onCommit={(v) => patch({ state: v })} width={120} placeholder="PA" />
          <Field label="Location" value={p.location} onCommit={(v) => patch({ location: v })} />
          <Field label="Price sheet effective" value={p.catalogEffective} onCommit={(v) => patch({ catalogEffective: v })} placeholder="2026-01-01" />
          <Field label="Source PDF URL" value={p.sourcePdfUrl} onCommit={(v) => patch({ sourcePdfUrl: v })} placeholder="https://…" />
          <Field label="Notes" value={p.notes} onCommit={(v) => patch({ notes: v })} />
        </Box>

        {/* Yearly re-verify nudge — surfaced, cleared with one tap */}
        <Divider sx={{ borderColor: D.line, my: 1.75 }} />
        <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
          <EventRepeatOutlinedIcon sx={{ fontSize: 18, color: reviewDue ? D.amber : D.faint }} />
          <Typography sx={{ fontSize: 12.5, color: reviewDue ? D.amber : D.muted }}>
            {reviewDue ? 'Pricing is a year old — re-verify with the printer.' : 'Pricing captured'}
            {p.capturedOn ? ` · captured ${p.capturedOn}` : ''}
            {p.pricingReviewedOn ? ` · reviewed ${p.pricingReviewedOn}` : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => patch({ markReviewed: true })} startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, color: D.green, border: `1px solid ${D.line}`, borderRadius: 999, px: 1.5,
              '&:hover': { borderColor: D.green } }}>
            Pricing reviewed today
          </Button>
          {p.sourcePdfUrl && (
            <IconButton size="small" component="a" href={p.sourcePdfUrl} target="_blank" rel="noreferrer"
              title="Open the source price sheet" sx={{ color: D.muted, '&:hover': { color: D.green } }}>
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Stack>
        {p.editedBy && (
          <Typography sx={{ color: D.faint, fontSize: 10.5, mt: 1 }}>
            Last edited by {p.editedBy}{p.editedAt ? ` · ${fmtDate(p.editedAt)}` : ''}
          </Typography>
        )}
      </Box>

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

// ── List ──────────────────────────────────────────────────────────────────────
function PrinterRow({ p, onOpen }) {
  return (
    <Box onClick={() => onOpen(p.key)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.key); }}
      sx={{ cursor: 'pointer', bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 1.6,
        display: 'flex', alignItems: 'center', gap: 1.25, transition: 'border-color .15s, background-color .15s',
        '&:hover': { borderColor: D.green, bgcolor: D.panelHi } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: D.text }}>{p.name}</Typography>
          <Chip size="small" label={p.state || '—'} sx={{ ...mono, height: 19, fontSize: 10.5, bgcolor: D.inset, color: D.muted }} />
          {p.reviewDue && <Chip size="small" label="review due" sx={{ height: 19, fontSize: 10, bgcolor: 'rgba(251,191,36,0.16)', color: D.amber }} />}
        </Stack>
        <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.3 }}>
          {(p.capabilities || []).map((c) => CAP_LABEL[c] || c).join(' · ') || 'no price books yet'}
          {p.capturedOn ? ` · captured ${p.capturedOn}` : ''}
        </Typography>
      </Box>
      <ChevronRightIcon sx={{ color: D.faint }} />
    </Box>
  );
}

// ── Tab shell ─────────────────────────────────────────────────────────────────
export default function PrinterCatalogTab({ token, onBack }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${base}/printers`, authHdr)
      .then((r) => setPrinters(r.data.printers || []))
      .catch(() => setPrinters([]))
      .finally(() => setLoading(false));
  }, [authHdr]);
  useEffect(() => { load(); }, [load]);

  const addPrinter = async () => {
    const name = await promptDialog({ title: 'Add a printer', message: 'Printer name (you can add prices next):', placeholder: 'e.g. Anchor & Ink' });
    if (!name) return;
    try {
      const r = await axios.post(`${base}/printers`, { name }, authHdr);
      load();
      setOpenKey(r.data.printer.key);
    } catch (e) {
      alertDialog({ title: 'Couldn’t add printer', message: e.response?.data?.message || e.message, danger: true });
    }
  };

  const shown = printers.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${p.name} ${p.state} ${(p.capabilities || []).join(' ')}`.toLowerCase().includes(q);
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg, color: D.text }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 5, bgcolor: D.panel, borderBottom: `1px solid ${D.line}`,
        px: { xs: 1.5, md: 3 }, py: 1.35, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={accentBar} />
        <IconButton size="small" onClick={onBack} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <FactoryOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15, flex: 1, letterSpacing: 0.2 }}>
          Printer Catalog
          <Typography component="span" sx={{ color: D.muted, fontSize: 11.5, fontWeight: 500, ml: 1 }}>
            Price books &amp; routing
          </Typography>
        </Typography>
      </Box>

      <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 3 }, ...scrollbar }}>
        {openKey ? (
          <PrinterDetail pkey={openKey} authHdr={authHdr} onBack={() => setOpenKey(null)}
            onPrinterChanged={(printer) => setPrinters((prev) => prev.map((x) => x.key === printer.key
              ? { ...x, name: printer.name, state: printer.state, capabilities: printer.capabilities, capturedOn: printer.capturedOn, reviewDue: false }
              : x))} />
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" gap={1.5} alignItems="center">
              <TextField size="small" fullWidth value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search printers…"
                InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 18, color: D.faint, mr: 1 }} /> }}
                sx={fieldSx} />
              <Button size="small" onClick={addPrinter} startIcon={<AddIcon sx={{ fontSize: 16 }} />} sx={{ ...dropPrimaryBtn, whiteSpace: 'nowrap' }}>
                Add printer
              </Button>
            </Stack>
            {loading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: D.green }} /></Box>
            ) : shown.length === 0 ? (
              <Typography sx={{ color: D.faint, fontSize: 13, textAlign: 'center', py: 6 }}>
                {query ? 'No printers match.' : 'No printers yet — add one.'}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {shown.map((p) => <PrinterRow key={p.key} p={p} onOpen={setOpenKey} />)}
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
