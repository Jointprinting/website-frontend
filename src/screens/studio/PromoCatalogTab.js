// src/screens/studio/PromoCatalogTab.js
//
// The Promo Catalog: the owner's fixed-price promotional products (lighters,
// grinders, ashtrays…) that the Quoter drops in as 0%-markup promo lines. Two
// jobs:
//   1. IMPORT — upload a vendor promo-quote PDF; the backend auto-scans it (cheap
//      Claude read, same pipeline as receipts) and returns the products for the
//      owner to review/edit before anything is saved. He's often not at his desk,
//      so "drop the PDF, it fills the table" is the whole point.
//   2. MANAGE — list / edit / activate / delete the saved promo items.
//
// Palette mirrors the other Studio tabs (BRAND + darkInputSx from _shared).

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Paper, Button, TextField, IconButton, Chip, Switch,
  Typography as MuiTypography, Alert, CircularProgress, Divider, Tooltip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import config from '../../config.json';
import { BRAND } from './_shared';

const B = BRAND;
const authHdr = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const base = `${config.backendUrl}/api/promo-catalog`;

const darkInputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.04)', color: B.white, fontSize: 13,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: B.green },
    '&.Mui-focused fieldset': { borderColor: B.green },
  },
  '& .MuiOutlinedInput-input': { color: B.white, py: 0.9 },
  '& .MuiInputLabel-root': { color: B.muted, fontSize: 13 },
  '& .MuiInputLabel-root.Mui-focused': { color: B.green },
};

// One editable field in a row.
function F({ label, value, onChange, width, type = 'text', prefix }) {
  return (
    <TextField
      label={label} value={value ?? ''} type={type}
      onChange={(e) => onChange(e.target.value)}
      size="small" variant="outlined" sx={{ ...darkInputSx, width }}
      InputProps={prefix ? { startAdornment: <span style={{ color: B.muted, fontSize: 12, marginRight: 2 }}>{prefix}</span> } : undefined}
    />
  );
}

export default function PromoCatalogTab({ token }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [ok, setOk] = React.useState('');

  // Import/review state.
  const [scanning, setScanning] = React.useState(false);
  const [review, setReview] = React.useState(null); // { rows, sourceFileName, sourcePdfUrl, confidence, flags }
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef(null);

  const flash = (msg, isErr) => { if (isErr) { setErr(msg); setOk(''); } else { setOk(msg); setErr(''); } setTimeout(() => { setErr(''); setOk(''); }, 5000); };

  const load = React.useCallback(async () => {
    try {
      const r = await axios.get(`${base}?all=1`, authHdr(token));
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch (e) { setErr(`Couldn't load promo catalog: ${e.response?.data?.message || e.message}`); }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  // ── Import ──────────────────────────────────────────────────────────────────
  const onPickFile = async (file) => {
    if (!file) return;
    setScanning(true); setReview(null); setErr(''); setOk('');
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const r = await axios.post(`${base}/scan`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      const d = r.data || {};
      if (d.error) { flash(`Scan failed: ${d.error}`, true); return; }
      if (d.configured === false) { flash(d.message || 'AI scanning is off — add items by hand below.', true); return; }
      const rows = (d.items || []).map((it) => ({ ...it, _include: true }));
      if (!rows.length) { flash('No products were read from that PDF. Try a clearer quote, or add items by hand.', true); return; }
      setReview({ rows, sourceFileName: d.sourceFileName || file.name, sourcePdfUrl: d.sourcePdfUrl || '', confidence: d.confidence, flags: d.flags || [] });
    } catch (e) {
      flash(`Scan failed: ${e.response?.data?.message || e.message}`, true);
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setRow = (i, patch) => setReview((r) => ({ ...r, rows: r.rows.map((row, j) => (j === i ? { ...row, ...patch } : row)) }));

  const saveReviewed = async () => {
    const chosen = review.rows.filter((r) => r._include && String(r.name || '').trim());
    if (!chosen.length) { flash('Tick at least one item (each needs a name).', true); return; }
    setSaving(true);
    try {
      const payload = chosen.map(({ _include, ...it }) => ({
        ...it, price: Number(it.price) || 0, cost: Number(it.cost) || 0, minQty: Number(it.minQty) || 0,
        sourceFileName: review.sourceFileName, sourcePdfUrl: review.sourcePdfUrl,
      }));
      await axios.post(base, { items: payload }, authHdr(token));
      setReview(null);
      await load();
      flash(`Added ${payload.length} promo item${payload.length === 1 ? '' : 's'} to your catalog.`);
    } catch (e) { flash(`Couldn't save: ${e.response?.data?.message || e.message}`, true); }
    finally { setSaving(false); }
  };

  // ── Manage existing ───────────────────────────────────────────────────────
  const addBlank = async () => {
    try {
      const r = await axios.post(base, { name: 'New promo item', category: 'Promo', price: 0 }, authHdr(token));
      setItems((prev) => [...(Array.isArray(r.data) ? r.data : [r.data]), ...prev]);
    } catch (e) { flash(`Couldn't add: ${e.response?.data?.message || e.message}`, true); }
  };

  const saveItem = async (id, patch) => {
    try {
      const r = await axios.put(`${base}/${id}`, patch, authHdr(token));
      setItems((prev) => prev.map((it) => (it._id === id ? r.data : it)));
    } catch (e) { flash(`Save failed: ${e.response?.data?.message || e.message}`, true); }
  };

  const removeItem = async (id) => {
    if (!window.confirm('Remove this promo item?')) return;
    try { await axios.delete(`${base}/${id}`, authHdr(token)); setItems((prev) => prev.filter((it) => it._id !== id)); }
    catch (e) { flash(`Delete failed: ${e.response?.data?.message || e.message}`, true); }
  };

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto', pb: 6 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <MuiTypography sx={{ color: B.white, fontSize: 22, fontWeight: 800 }}>Promo Catalog</MuiTypography>
        <Chip label={`${items.length}`} size="small" sx={{ bgcolor: 'rgba(74,222,128,0.14)', color: B.green, fontWeight: 700 }} />
      </Stack>
      <MuiTypography sx={{ color: B.muted, fontSize: 13, mb: 2.5 }}>
        Your fixed-price promos (lighters, grinders, ashtrays…). Import a vendor quote PDF and it auto-fills — then the Quoter drops these in at 0% markup, since the price already includes your margin.
      </MuiTypography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      {/* Import card */}
      <Paper elevation={0} sx={{ bgcolor: B.panel, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 3, p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoAwesomeIcon sx={{ color: B.green, fontSize: 20 }} />
              <MuiTypography sx={{ color: B.white, fontSize: 15, fontWeight: 700 }}>Import from a promo quote PDF</MuiTypography>
            </Stack>
            <MuiTypography sx={{ color: B.muted, fontSize: 12.5, mt: 0.5 }}>
              Drop in a vendor quote — it reads every product + price for you to confirm. Nothing saves until you say so.
            </MuiTypography>
          </Box>
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => onPickFile(e.target.files?.[0])} />
          <Button
            variant="contained" disabled={scanning}
            startIcon={scanning ? <CircularProgress size={16} sx={{ color: B.ink }} /> : <UploadFileIcon />}
            onClick={() => fileRef.current?.click()}
            sx={{ bgcolor: B.green, color: B.ink, fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#3ec96f' } }}
          >
            {scanning ? 'Reading…' : 'Upload PDF'}
          </Button>
        </Stack>

        {/* Review scanned rows */}
        {review && (
          <Box sx={{ mt: 2.5 }}>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2 }} />
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
              <MuiTypography sx={{ color: B.white, fontSize: 14, fontWeight: 700 }}>
                {review.rows.length} product{review.rows.length === 1 ? '' : 's'} read from {review.sourceFileName || 'your PDF'}
              </MuiTypography>
              {review.confidence && (
                <Chip label={`${review.confidence} confidence`} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: B.muted, fontSize: 11 }} />
              )}
            </Stack>
            {Array.isArray(review.flags) && review.flags.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1.5, fontSize: 12 }}>
                Worth a look: {review.flags.join(' · ')}
              </Alert>
            )}
            <MuiTypography sx={{ color: B.muted, fontSize: 12, mb: 1.5 }}>
              Check the price is the <b style={{ color: B.white }}>client price</b> (already marked up). Add your cost too if you want the COGS estimate. Untick anything you don't want.
            </MuiTypography>

            <Stack spacing={1.25}>
              {review.rows.map((row, i) => (
                <Paper key={i} elevation={0} sx={{
                  bgcolor: row._include ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${row._include ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 2, p: 1.5,
                }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" useFlexGap>
                    <Switch checked={!!row._include} onChange={(e) => setRow(i, { _include: e.target.checked })} size="small"
                      sx={{ '& .Mui-checked': { color: B.green }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${B.green} !important` } }} />
                    <F label="Product" value={row.name} onChange={(v) => setRow(i, { name: v })} width={190} />
                    <F label="Category" value={row.category} onChange={(v) => setRow(i, { category: v })} width={110} />
                    <F label="Item #" value={row.sku} onChange={(v) => setRow(i, { sku: v })} width={90} />
                    <F label="Client $/ea" value={row.price} onChange={(v) => setRow(i, { price: v })} width={95} type="number" prefix="$" />
                    <F label="Your cost/ea" value={row.cost} onChange={(v) => setRow(i, { cost: v })} width={100} type="number" prefix="$" />
                    <F label="Min qty" value={row.minQty} onChange={(v) => setRow(i, { minQty: v })} width={80} type="number" />
                  </Stack>
                  {(row.description || row.color) && (
                    <MuiTypography sx={{ color: B.muted, fontSize: 11.5, mt: 0.75, ml: 5.5 }}>
                      {[row.color, row.description].filter(Boolean).join(' · ')}
                    </MuiTypography>
                  )}
                </Paper>
              ))}
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button variant="contained" disabled={saving} onClick={saveReviewed}
                startIcon={saving ? <CircularProgress size={16} sx={{ color: B.ink }} /> : <AddCircleOutlineIcon />}
                sx={{ bgcolor: B.green, color: B.ink, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#3ec96f' } }}>
                Add {review.rows.filter((r) => r._include).length} to catalog
              </Button>
              <Button onClick={() => setReview(null)} sx={{ color: B.muted, textTransform: 'none' }}>Discard</Button>
            </Stack>
          </Box>
        )}
      </Paper>

      {/* Existing items */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <MuiTypography sx={{ color: B.white, fontSize: 15, fontWeight: 700 }}>Your promo items</MuiTypography>
        <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />} onClick={addBlank}
          sx={{ color: B.green, textTransform: 'none', fontSize: 12 }}>Add by hand</Button>
      </Stack>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress sx={{ color: B.green }} /></Box>
      ) : items.length === 0 ? (
        <Paper elevation={0} sx={{ bgcolor: B.panel, border: `1px dashed rgba(255,255,255,0.14)`, borderRadius: 3, p: 4, textAlign: 'center' }}>
          <MuiTypography sx={{ color: B.muted, fontSize: 13 }}>No promo items yet. Upload a vendor quote above to fill this in seconds.</MuiTypography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {items.map((it) => (
            <PromoRow key={it._id} item={it} onSave={(patch) => saveItem(it._id, patch)} onRemove={() => removeItem(it._id)} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

// One saved item — inline-editable, active toggle, delete.
function PromoRow({ item, onSave, onRemove }) {
  const [v, setV] = React.useState(item);
  React.useEffect(() => setV(item), [item]);
  const dirty = ['name', 'category', 'sku', 'price', 'cost', 'minQty', 'vendor', 'color', 'description']
    .some((k) => String(v[k] ?? '') !== String(item[k] ?? ''));
  const commit = () => { if (dirty) onSave({ name: v.name, category: v.category, sku: v.sku, price: v.price, cost: v.cost, minQty: v.minQty, vendor: v.vendor, color: v.color, description: v.description }); };
  return (
    <Paper elevation={0} sx={{
      bgcolor: B.panel, border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 2, p: 1.5,
      opacity: item.active ? 1 : 0.55,
    }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" useFlexGap onBlur={commit}>
        <F label="Product" value={v.name} onChange={(x) => setV({ ...v, name: x })} width={190} />
        <F label="Category" value={v.category} onChange={(x) => setV({ ...v, category: x })} width={110} />
        <F label="Item #" value={v.sku} onChange={(x) => setV({ ...v, sku: x })} width={90} />
        <F label="Client $/ea" value={v.price} onChange={(x) => setV({ ...v, price: x })} width={95} type="number" prefix="$" />
        <F label="Cost/ea" value={v.cost} onChange={(x) => setV({ ...v, cost: x })} width={90} type="number" prefix="$" />
        <F label="Min qty" value={v.minQty} onChange={(x) => setV({ ...v, minQty: x })} width={80} type="number" />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title={item.active ? 'Active — shows in the Quoter picker' : 'Hidden from the Quoter'}>
          <Switch checked={!!item.active} onChange={(e) => onSave({ active: e.target.checked })} size="small"
            sx={{ '& .Mui-checked': { color: B.green }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${B.green} !important` } }} />
        </Tooltip>
        <IconButton size="small" onClick={onRemove} sx={{ color: '#f87171' }}><DeleteOutlineIcon fontSize="small" /></IconButton>
      </Stack>
      {item.vendor && <MuiTypography sx={{ color: B.muted, fontSize: 11, mt: 0.5, ml: 0.5 }}>from {item.vendor}{item.sourceFileName ? ` · ${item.sourceFileName}` : ''}</MuiTypography>}
    </Paper>
  );
}
