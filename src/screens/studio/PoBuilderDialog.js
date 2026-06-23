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
import BoltIcon                from '@mui/icons-material/Bolt';
import axios from 'axios';
import config from '../../config.json';
import { D, scrollbar, dropInput, fmt, mono, accentBar, dropPrimaryBtn, hasConfirmation } from './_shared';

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
  const [generating, setGenerating] = useState(false);

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
      const r = await axios.post(`${base}/orders/${project._id}/pos`, { date: localDay() }, authHdr);
      setPos(prev => [r.data, ...prev]);
      setEditing({ ...r.data });
      setDirty(false);
    } catch (e) {
      alert(`Couldn't create PO: ${e.response?.data?.message || e.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Build one PO per supplier straight from the approved confirmation — the
  // doc the client actually signed off, priced at the vendor's internal cost.
  // The backend skips suppliers that already have a PO on this order, so this
  // is safe to re-run; we surface exactly what it created (or why it didn't).
  const localDay = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const generateFromConfirmation = async () => {
    setGenerating(true);
    try {
      const r = await axios.post(`${base}/orders/${project._id}/pos/from-confirmation`, { date: localDay() }, authHdr);
      const made = r.data.pos || [];
      const s = r.data.summary || {};
      setPos(prev => [...made, ...prev]);   // dialog already lists newest-first
      if (made.length) {
        const names = (s.vendors || made.map(p => p.vendorName)).filter(Boolean).join(', ');
        const skipNote = (s.skipped && s.skipped.length)
          ? ` Skipped ${s.skipped.length} already-built: ${s.skipped.join(', ')}.` : '';
        alert(`Created ${made.length} PO${made.length === 1 ? '' : 's'}${names ? ` — ${names}` : ''}.${skipNote}`);
      } else {
        const skipped = (s.skipped || []).filter(Boolean);
        alert(skipped.length
          ? `No new POs — every supplier already has one (${skipped.join(', ')}). Open or delete those to rebuild.`
          : 'No POs were generated from the confirmation.');
      }
    } catch (e) {
      alert(`Couldn't generate POs: ${e.response?.data?.message || e.message}`);
    } finally {
      setGenerating(false);
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

  const inkInput = { ...dropInput, '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.85 } };

  return (
    <Dialog open={open}
      onClose={(_, reason) => { if (reason === 'backdropClick') return; closeGuard(); }}
      maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: D.bg, color: D.text, border: `1px solid ${D.line}`, borderRadius: 3,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        m: { xs: 1, md: 3 }, maxHeight: '94vh' } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: D.panel,
        borderBottom: `1px solid ${D.line}`, px: 2.5, py: 1.35,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={accentBar} />
        {editing && (
          <IconButton size="small" onClick={() => { if (!dirty || window.confirm('Unsaved changes — go back anyway?')) { setEditing(null); setDirty(false); } }}
            sx={{ color: D.muted, '&:hover': { color: D.text } }}><ArrowBackIcon fontSize="small" /></IconButton>
        )}
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14, flex: 1, letterSpacing: 0.2 }}>
          Purchase orders
          <Typography component="span" sx={{ color: D.muted, fontSize: 11, fontWeight: 500, ml: 1 }}>
            Project #{project.projectNumber || '—'}
            {editing ? ` · ${editing.poNumber || 'new'}${dirty ? ' · unsaved' : ''}` : ''}
          </Typography>
        </Typography>
        {editing && (
          <>
            <Button size="small" disabled={pdfBusy} onClick={downloadPdf}
              startIcon={pdfBusy ? <CircularProgress size={12} sx={{ color: D.green }} /> : <PictureAsPdfIcon sx={{ fontSize: 15 }} />}
              sx={{ fontSize: 12, textTransform: 'none', fontWeight: 700, color: D.green, borderRadius: 999,
                transition: 'color 0.18s ease', '&:hover': { color: '#5cec8e' } }}>
              PDF
            </Button>
            <Button size="small" disabled={saving || !dirty} onClick={savePo}
              sx={{ fontSize: 12, textTransform: 'none', fontWeight: 800, px: 1.75, py: 0.5, borderRadius: 999,
                bgcolor: dirty ? D.green : 'transparent', color: dirty ? D.ink : D.muted,
                boxShadow: dirty ? `0 6px 18px ${D.glow}` : 'none',
                transition: 'transform 0.15s ease, box-shadow 0.2s ease, background-color 0.15s ease',
                '&:hover': dirty ? { bgcolor: '#5cec8e', transform: 'translateY(-1px)', boxShadow: `0 10px 26px ${D.glow}` } : {} }}>
              {saving ? <CircularProgress size={12} sx={{ color: D.ink }} /> : (dirty ? 'Save' : 'Saved')}
            </Button>
          </>
        )}
        <IconButton size="small" onClick={closeGuard} sx={{ color: D.muted, '&:hover': { color: D.text } }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, ...scrollbar }}>
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: D.green }} /></Box>
        ) : !editing ? (
          <>
            {pos.length === 0 ? (
              <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 2.5, py: 5, textAlign: 'center', color: D.muted, bgcolor: D.inset }}>
                <Typography sx={{ fontSize: 13, mb: 1.5 }}>
                  No POs yet. A new one seeds itself from the chosen quote lines at cost.
                </Typography>
              </Box>
            ) : (
              <Stack gap={1} mb={1.5}>
                {pos.map(po => (
                  <Stack key={po._id} direction="row" alignItems="center" gap={1.5}
                    onClick={() => { setEditing({ ...po }); setDirty(false); }}
                    sx={{ p: 1.5, border: `1px solid ${D.line}`, borderRadius: 2.5, cursor: 'pointer', bgcolor: D.panel,
                      transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.2s ease, transform 0.15s ease',
                      '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi, transform: 'translateY(-1px)',
                        boxShadow: '0 10px 28px rgba(0,0,0,0.34)' } }}>
                    <Typography sx={{ ...mono, fontWeight: 800, fontSize: 13, color: D.green }}>
                      {po.poNumber || '—'}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: D.text }}>{po.vendorName || 'Unnamed vendor'}</Typography>
                      <Typography sx={{ fontSize: 11, color: D.muted }}>
                        {po.date ? new Date(po.date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : ''}
                        {(po.items || []).length ? ` · ${(po.items || []).length} item${(po.items || []).length === 1 ? '' : 's'}` : ''}
                      </Typography>
                    </Box>
                    <Typography sx={{ ...mono, fontWeight: 800, fontSize: 13, color: D.text }}>
                      {fmt(po.grandTotal)}
                    </Typography>
                    <Tooltip title="Delete PO">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); deletePo(po); }}
                        sx={{ color: D.muted, '&:hover': { color: '#f87171' } }}>
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            )}
            {/* Primary path: build real vendor POs straight from the APPROVED
                confirmation, auto-split one-per-supplier. Only offered once a
                confirmation exists — otherwise there's nothing approved to
                build from and the manual seed below is the only option. */}
            {hasConfirmation(project.confirmation) && (
              <Box sx={{ mb: 1.5 }}>
                <Button onClick={generateFromConfirmation} disabled={generating || creating}
                  startIcon={generating ? <CircularProgress size={14} sx={{ color: D.ink }} /> : <BoltIcon sx={{ fontSize: 18 }} />}
                  sx={{ ...dropPrimaryBtn, px: 2.25, py: 0.85 }}>
                  {generating ? 'Generating…' : 'Generate POs from confirmation'}
                </Button>
                <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.6 }}>
                  One PO per supplier, priced at vendor cost from the approved confirmation. Re-running skips suppliers that already have a PO.
                </Typography>
              </Box>
            )}
            <Button onClick={createPo} disabled={creating || generating}
              startIcon={creating ? <CircularProgress size={14} sx={{ color: D.green }} /> : <AddCircleOutlineIcon />}
              sx={{ color: D.green, textTransform: 'none', fontWeight: 700, borderRadius: 999,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
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
                label={<Typography sx={{ color: D.muted, fontSize: 12 }}>
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
              label={<Typography sx={{ color: D.muted, fontSize: 12 }}>
                Blanks provided (apparel — JP supplies the garments)
              </Typography>} />

            {/* Items */}
            <SectionLabel>Product / print items</SectionLabel>
            <Stack gap={1} mb={1}>
              {(editing.items || []).map((it, i) => (
                <Box key={i} sx={{ border: `1px solid ${D.line}`, borderRadius: 2, p: 1.3, bgcolor: D.panel,
                  transition: 'background-color 0.18s ease, border-color 0.18s ease',
                  '&:hover': { bgcolor: D.panelHi, borderColor: 'rgba(255,255,255,0.14)' } }}>
                  <Stack direction="row" gap={1} alignItems="center" mb={0.7}>
                    <Typography sx={{ color: D.green, ...mono, fontWeight: 800, fontSize: 12 }}>
                      {String.fromCharCode(65 + (i % 26))})
                    </Typography>
                    <TextField size="small" fullWidth value={it.title || ''} placeholder="OAD OAD117 Tote Bags, Black — 25 units"
                      onChange={e => update({ items: editing.items.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })}
                      sx={inkInput} />
                    <IconButton size="small"
                      onClick={() => update({ items: editing.items.filter((_, j) => j !== i) })}
                      sx={{ color: D.muted, '&:hover': { color: '#f87171' } }}>
                      <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                  <TextField size="small" fullWidth multiline minRows={1} placeholder={'One detail per line, e.g.\n1 location 1 color screen printing\n$2.40/unit * 25 units = $60'}
                    value={(it.details || []).join('\n')}
                    onChange={e => update({ items: editing.items.map((x, j) => j === i ? { ...x, details: e.target.value.split('\n') } : x) })}
                    sx={{ ...inkInput, '& .MuiInputBase-input': { color: D.muted, fontSize: 12 } }} />
                </Box>
              ))}
            </Stack>
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 15 }} />}
              onClick={() => update({ items: [...(editing.items || []), { title: '', details: [] }] })}
              sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 12, mb: 2, borderRadius: 999,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
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
                    sx={{ ...inkInput, width: 120, '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.85, textAlign: 'right', ...mono } }} />
                  <IconButton size="small"
                    onClick={() => update({ charges: editing.charges.filter((_, j) => j !== i) })}
                    sx={{ color: D.muted, '&:hover': { color: '#f87171' } }}>
                    <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 15 }} />}
              onClick={() => update({ charges: [...(editing.charges || []), { label: '', amount: 0 }] })}
              sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 12, mb: 2, borderRadius: 999,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
              Add charge
            </Button>

            <PF label="Notes (optional, prints on the PO)">
              <TextField size="small" fullWidth multiline minRows={2} value={editing.notes || ''}
                onChange={e => update({ notes: e.target.value })} sx={inkInput} />
            </PF>

            <Box sx={{ mt: 2, p: { xs: 1.75, md: 2 }, borderRadius: 2.5, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2}
                sx={{ borderTop: `2px solid ${D.green}`, pt: 1.25 }}>
                <Typography sx={{ color: D.text, fontSize: 15, fontWeight: 800 }}>
                  Grand total
                </Typography>
                <Typography sx={{ color: D.green, fontSize: 24, fontWeight: 900, letterSpacing: -0.5, ...mono }}>
                  {fmt(grandTotal)}
                </Typography>
              </Stack>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{ color: D.green, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6,
      textTransform: 'uppercase', mb: 0.8, mt: 0.5 }}>
      {children}
    </Typography>
  );
}

function PF({ label, children }) {
  return (
    <Box>
      <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.3 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}
