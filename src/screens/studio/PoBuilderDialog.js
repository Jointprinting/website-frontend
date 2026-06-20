// src/screens/studio/PoBuilderDialog.js
//
// Purchase-order builder for a project. POs mirror the hand-made Google Docs
// format ("{Vendor} x Joint Printing PO"): header fields, shipping block,
// ship method, lettered product/print items, order-summary charges, grand
// total. "New PO" seeds from the project's chosen quote lines at COST (what
// JP pays the vendor); everything stays editable because vendors vary.
// Download renders the PDF server-side; the admin emails it himself.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton, Dialog, DialogContent,
  CircularProgress, FormControlLabel, Switch, Tooltip,
} from '@mui/material';
import CloseIcon               from '@mui/icons-material/Close';
import AddCircleOutlineIcon    from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import PictureAsPdfIcon        from '@mui/icons-material/PictureAsPdf';
import ArrowBackIcon           from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon       from '@mui/icons-material/DeleteOutline';
import axios from 'axios';
import config from '../../config.json';
import { B, scrollbar, darkInput, fmt } from './_shared';

const base = `${config.backendUrl}/api`;

export default function PoBuilderDialog({ open, project, authHdr, onClose }) {
  const [pos, setPos] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);   // the PO being edited (local copy)
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    setLoading(true);
    setEditing(null);
    Promise.allSettled([
      axios.get(`${base}/orders/${project._id}/pos`, authHdr),
      axios.get(`${base}/orders/vendors`, authHdr),
    ]).then(([p, v]) => {
      if (cancelled) return;
      if (p.status === 'fulfilled') setPos(p.value.data.pos || []);
      if (v.status === 'fulfilled') setVendors(v.value.data.vendors || []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, project?._id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const grandTotal = useMemo(() =>
    (editing?.charges || []).reduce((s, c) => s + (Number(c.amount) || 0), 0), [editing]);

  if (!project) return null;

  const update = (patch) => { setEditing(prev => ({ ...prev, ...patch })); setDirty(true); };

  const createPo = async () => {
    setCreating(true);
    try {
      const d = new Date();
      const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const r = await axios.post(`${base}/orders/${project._id}/pos`, { date: localDay }, authHdr);
      setPos(prev => [r.data, ...prev]);
      setEditing({ ...r.data });
      setDirty(false);
    } catch (e) {
      alert(`Couldn't create PO: ${e.response?.data?.message || e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const savePo = async () => {
    if (!editing) return null;
    setSaving(true);
    try {
      const r = await axios.put(`${base}/orders/pos/${editing._id}`, editing, authHdr);
      setPos(prev => prev.map(p => p._id === r.data._id ? r.data : p));
      setEditing({ ...r.data });
      setDirty(false);
      return r.data;
    } catch (e) {
      alert(`Save failed: ${e.response?.data?.message || e.message}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deletePo = async (po) => {
    if (!window.confirm(`Delete PO ${po.poNumber || ''}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${base}/orders/pos/${po._id}`, authHdr);
      setPos(prev => prev.filter(p => p._id !== po._id));
      if (editing && editing._id === po._id) setEditing(null);
    } catch (e) {
      alert(`Delete failed: ${e.response?.data?.message || e.message}`);
    }
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      if (dirty) { const ok = await savePo(); if (!ok) return; }
      const r = await axios.post(`${base}/orders/pos/${editing._id}/pdf`, {},
        { ...authHdr, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(editing.vendorName || 'vendor').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-x-jp-po.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(`PDF failed: ${e.response?.data?.message || e.message}`);
    } finally {
      setPdfBusy(false);
    }
  };

  // Typing a known vendor name pre-fills their contact card — but never over
  // something already typed by hand (correcting a contact then re-touching the
  // vendor name must not wipe the correction).
  const onVendorName = (name) => {
    const v = vendors.find(x => (x.name || '').toLowerCase() === name.toLowerCase());
    update(v
      ? { vendorName: name,
          contactName: editing.contactName || v.contactName || '',
          vendorAddress: editing.vendorAddress || v.address || '',
          shipMethod: editing.shipMethod || v.shipMethod || '',
          blanksProvided: !!v.blanksProvided }
      : { vendorName: name });
  };

  const closeGuard = () => {
    if (dirty && !window.confirm('You have unsaved PO changes. Close anyway?')) return;
    onClose();
  };

  const inkInput = { ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.85 } };

  return (
    <Dialog open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick') return; closeGuard(); }}
      maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2,
        m: { xs: 1, md: 3 }, maxHeight: '94vh' } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        {editing && (
          <IconButton size="small" onClick={() => { if (!dirty || window.confirm('Unsaved changes — go back anyway?')) { setEditing(null); setDirty(false); } }}
            sx={{ color: B.muted }}><ArrowBackIcon fontSize="small" /></IconButton>
        )}
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Purchase orders
          <Typography component="span" sx={{ color: B.muted, fontSize: 11, fontWeight: 500, ml: 1 }}>
            Project #{project.projectNumber || '—'}
            {editing ? ` · ${editing.poNumber || 'new'}${dirty ? ' · unsaved' : ''}` : ''}
          </Typography>
        </Typography>
        {editing && (
          <>
            <Button size="small" disabled={pdfBusy} onClick={downloadPdf}
              startIcon={pdfBusy ? <CircularProgress size={12} sx={{ color: B.green }} /> : <PictureAsPdfIcon sx={{ fontSize: 15 }} />}
              sx={{ fontSize: 12, textTransform: 'none', fontWeight: 700, color: B.green }}>
              PDF
            </Button>
            <Button size="small" disabled={saving || !dirty} onClick={savePo}
              sx={{ fontSize: 12, textTransform: 'none', fontWeight: 700, px: 1.5,
                bgcolor: dirty ? B.green : 'transparent', color: dirty ? B.greenDk : B.muted }}>
              {saving ? <CircularProgress size={12} sx={{ color: B.greenDk }} /> : (dirty ? 'Save' : 'Saved')}
            </Button>
          </>
        )}
        <IconButton size="small" onClick={closeGuard}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, ...scrollbar }}>
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: B.green }} /></Box>
        ) : !editing ? (
          <>
            {pos.length === 0 ? (
              <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1.5, py: 5, textAlign: 'center', color: B.muted }}>
                <Typography sx={{ fontSize: 13, mb: 1.5 }}>
                  No POs yet. A new one seeds itself from the chosen quote lines at cost.
                </Typography>
              </Box>
            ) : (
              <Stack gap={1} mb={1.5}>
                {pos.map(po => (
                  <Stack key={po._id} direction="row" alignItems="center" gap={1.5}
                    onClick={() => { setEditing({ ...po }); setDirty(false); }}
                    sx={{ p: 1.5, border: `1px solid ${B.border}`, borderRadius: 1.5, cursor: 'pointer',
                      '&:hover': { borderColor: B.green } }}>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: B.green }}>
                      {po.poNumber || '—'}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: B.white }}>{po.vendorName || 'Unnamed vendor'}</Typography>
                      <Typography sx={{ fontSize: 11, color: B.muted }}>
                        {po.date ? new Date(po.date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : ''}
                        {(po.items || []).length ? ` · ${(po.items || []).length} item${(po.items || []).length === 1 ? '' : 's'}` : ''}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: B.white }}>
                      {fmt(po.grandTotal)}
                    </Typography>
                    <Tooltip title="Delete PO">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); deletePo(po); }}
                        sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            )}
            <Button onClick={createPo} disabled={creating}
              startIcon={creating ? <CircularProgress size={14} sx={{ color: B.green }} /> : <AddCircleOutlineIcon />}
              sx={{ color: B.green, textTransform: 'none', fontWeight: 700 }}>
              New PO (seeded from this project)
            </Button>
          </>
        ) : (
          <>
            {/* Header fields */}
            <Box sx={{ display: 'grid', gap: 1, mb: 2,
              gridTemplateColumns: { xs: '1fr 1fr', md: '110px 130px 1fr 1fr' } }}>
              <PF label="PO #">
                <TextField size="small" value={editing.poNumber || ''} placeholder="#008"
                  onChange={e => update({ poNumber: e.target.value })} sx={inkInput} />
              </PF>
              <PF label="Date">
                <TextField size="small" type="date"
                  value={editing.date ? String(editing.date).slice(0, 10) : ''}
                  onChange={e => update({ date: e.target.value ? new Date(`${e.target.value}T00:00:00Z`).toISOString() : null })}
                  sx={inkInput} />
              </PF>
              <PF label="Printer / vendor">
                <TextField size="small" value={editing.vendorName || ''} placeholder="Heritage Screen Printing"
                  inputProps={{ list: 'po-vendor-options' }}
                  onChange={e => onVendorName(e.target.value)} sx={inkInput} />
                <datalist id="po-vendor-options">
                  {vendors.map(v => <option key={v._id} value={v.name} />)}
                </datalist>
              </PF>
              <PF label="Contact">
                <TextField size="small" value={editing.contactName || ''} placeholder="Jaide Thomas"
                  onChange={e => update({ contactName: e.target.value })} sx={inkInput} />
              </PF>
            </Box>
            <Box sx={{ display: 'grid', gap: 1, mb: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <PF label="Vendor address">
                <TextField size="small" value={editing.vendorAddress || ''} placeholder="331 York Rd, Warminster, PA 18974"
                  onChange={e => update({ vendorAddress: e.target.value })} sx={inkInput} />
              </PF>
              <PF label="Ship method">
                <TextField size="small" value={editing.shipMethod || ''} placeholder="UPS Acct # JR2257"
                  onChange={e => update({ shipMethod: e.target.value })} sx={inkInput} />
              </PF>
            </Box>

            {/* Due date + proof toggle — optional, print only when set */}
            <Box sx={{ display: 'grid', gap: 1, mb: 1.5, gridTemplateColumns: { xs: '1fr', md: '180px 1fr' }, alignItems: 'end' }}>
              <PF label="Due / in-hands date">
                <TextField size="small" type="date"
                  value={editing.dueDate ? String(editing.dueDate).slice(0, 10) : ''}
                  onChange={e => update({ dueDate: e.target.value ? new Date(`${e.target.value}T00:00:00Z`).toISOString() : null })}
                  sx={inkInput} />
              </PF>
              <FormControlLabel sx={{ ml: 0.5, mb: 0.4 }}
                control={<Switch size="small" checked={!!editing.proofRequired}
                  onChange={e => update({ proofRequired: e.target.checked })} />}
                label={<Typography sx={{ color: B.muted, fontSize: 12 }}>
                  Proof required before production
                </Typography>} />
            </Box>

            {/* Shipping block */}
            <SectionLabel>Shipping info</SectionLabel>
            <Box sx={{ display: 'grid', gap: 1, mb: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
              {[['name', 'Shipping name'], ['attention', 'Attention'], ['streetAddress', 'Street address'], ['cityStateZip', 'City, State, Zip']].map(([k, label]) => (
                <PF key={k} label={label}>
                  <TextField size="small" value={(editing.shipping && editing.shipping[k]) || ''}
                    onChange={e => update({ shipping: { ...(editing.shipping || {}), [k]: e.target.value } })} sx={inkInput} />
                </PF>
              ))}
            </Box>

            <FormControlLabel sx={{ mb: 1 }}
              control={<Switch size="small" checked={!!editing.blanksProvided}
                onChange={e => update({ blanksProvided: e.target.checked })} />}
              label={<Typography sx={{ color: B.muted, fontSize: 12 }}>
                Blanks provided (apparel — JP supplies the garments)
              </Typography>} />

            {/* Items */}
            <SectionLabel>Product / print items</SectionLabel>
            <Stack gap={1} mb={1}>
              {(editing.items || []).map((it, i) => (
                <Box key={i} sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, p: 1.2 }}>
                  <Stack direction="row" gap={1} alignItems="center" mb={0.7}>
                    <Typography sx={{ color: B.green, fontFamily: 'monospace', fontWeight: 800, fontSize: 12 }}>
                      {String.fromCharCode(65 + (i % 26))})
                    </Typography>
                    <TextField size="small" fullWidth value={it.title || ''} placeholder="OAD OAD117 Tote Bags, Black — 25 units"
                      onChange={e => update({ items: editing.items.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })}
                      sx={inkInput} />
                    <IconButton size="small"
                      onClick={() => update({ items: editing.items.filter((_, j) => j !== i) })}
                      sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
                      <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                  <TextField size="small" fullWidth multiline minRows={1} placeholder={'One detail per line, e.g.\n1 location 1 color screen printing\n$2.40/unit * 25 units = $60'}
                    value={(it.details || []).join('\n')}
                    onChange={e => update({ items: editing.items.map((x, j) => j === i ? { ...x, details: e.target.value.split('\n') } : x) })}
                    sx={{ ...inkInput, '& .MuiInputBase-input': { color: B.muted, fontSize: 12 } }} />
                </Box>
              ))}
            </Stack>
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 15 }} />}
              onClick={() => update({ items: [...(editing.items || []), { title: '', details: [] }] })}
              sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 12, mb: 2 }}>
              Add item
            </Button>

            {/* Charges */}
            <SectionLabel>Order summary (rolls into the grand total)</SectionLabel>
            <Stack gap={0.8} mb={1}>
              {(editing.charges || []).map((c, i) => (
                <Stack key={i} direction="row" gap={1} alignItems="center">
                  <TextField size="small" fullWidth value={c.label || ''} placeholder="Run Charge: $2.40/unit * 25 units"
                    onChange={e => update({ charges: editing.charges.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })}
                    sx={inkInput} />
                  <TextField size="small" type="number" value={c.amount ?? ''} placeholder="60"
                    onChange={e => update({ charges: editing.charges.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) })}
                    sx={{ ...inkInput, width: 120 }} />
                  <IconButton size="small"
                    onClick={() => update({ charges: editing.charges.filter((_, j) => j !== i) })}
                    sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
                    <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 15 }} />}
              onClick={() => update({ charges: [...(editing.charges || []), { label: '', amount: 0 }] })}
              sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 12, mb: 2 }}>
              Add charge
            </Button>

            <PF label="Notes (optional, prints on the PO)">
              <TextField size="small" fullWidth multiline minRows={2} value={editing.notes || ''}
                onChange={e => update({ notes: e.target.value })} sx={inkInput} />
            </PF>

            <Stack direction="row" justifyContent="flex-end" alignItems="baseline" gap={2} mt={2}
              sx={{ borderTop: `1px solid ${B.border}`, pt: 1.5 }}>
              <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Grand total
              </Typography>
              <Typography sx={{ color: B.white, fontSize: 20, fontWeight: 800, fontFamily: 'monospace' }}>
                {fmt(grandTotal)}
              </Typography>
            </Stack>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
      textTransform: 'uppercase', mb: 0.8, mt: 0.5 }}>
      {children}
    </Typography>
  );
}

function PF({ label, children }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.3 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}
