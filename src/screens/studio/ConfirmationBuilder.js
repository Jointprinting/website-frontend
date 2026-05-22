// src/screens/studio/ConfirmationBuilder.js
//
// The operational confirmation page builder. This is the doc the user sends
// to a client AFTER they approve the quote and pick a subset of items —
// "I want 50 of these in M/L/XL, 25 of those in S/M/L, ship to NYC."
//
// Layout: editor on the left (controls), live preview on the right (the
// printable / shareable doc). On narrow screens they stack.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton,
  Dialog, DialogContent, FormControlLabel, Switch, CircularProgress, MenuItem, Select, Tooltip,
} from '@mui/material';
import CloseIcon              from '@mui/icons-material/Close';
import PrintIcon              from '@mui/icons-material/Print';
import AddCircleOutlineIcon   from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import DesignServicesIcon     from '@mui/icons-material/DesignServices';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { B, scrollbar, darkInput, fmt } from './_shared';

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const PRINT_TYPES = ['Screen Print', 'DTG', 'DTF', 'Embroidery', 'Vinyl', 'Sublimation', 'None'];

function normMockupKey(n) {
  return String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();
}

function emptyItem() {
  return {
    mockupNum: '', customMockupDataUrl: '', showBack: false,
    brandName: '', styleCode: '', printType: '', color: '',
    sizes: DEFAULT_SIZES.map(s => ({ label: s, qty: 0, unitPrice: 0 })),
  };
}

export default function ConfirmationBuilder({ open, project, mockupMap, mockups, logo, brandLogo, onClose, onSave }) {
  const [local, setLocal] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    const seed = project.confirmation && Object.keys(project.confirmation).length > 0
      ? project.confirmation
      : {
        orderTitle:  `${project.companyName || project.clientName || ''} Merch`.trim(),
        orderDate:   project.orderDate || new Date().toISOString(),
        shipping:    { name: project.companyName || '', attention: project.clientName || '', streetAddress: '', cityStateZip: '' },
        items:       (project.quoteLines || []).map(seedItemFromQuote),
        customLines: [],
      };
    setLocal(JSON.parse(JSON.stringify(seed)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?._id]);

  if (!project || !local) return null;

  const update = (patch) => setLocal(prev => ({ ...prev, ...patch }));

  const persist = async () => {
    setSaving(true);
    try {
      await onSave({ confirmation: local });
    } finally {
      setSaving(false);
    }
  };

  const totals = computeTotals(local);

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2,
        m: { xs: 1, md: 3 }, maxHeight: '94vh', width: 'calc(100% - 24px)' } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Confirmation page
          <Typography component="span" sx={{ color: B.muted, fontSize: 11, fontWeight: 500, ml: 1 }}>
            Project #{project.projectNumber || '—'}
          </Typography>
        </Typography>
        <Button size="small" disabled={saving}
          onClick={persist}
          sx={{ color: saving ? B.muted : B.green, fontSize: 12, textTransform: 'none', fontWeight: 700 }}>
          {saving ? <CircularProgress size={12} sx={{ color: B.green }} /> : 'Save'}
        </Button>
        <Button size="small" startIcon={<PrintIcon sx={{ fontSize: 16 }} />}
          onClick={() => printConfirmation('confirmation-preview', project, brandLogo)}
          sx={{ fontSize: 12, textTransform: 'none', fontWeight: 700,
            bgcolor: B.green, color: B.greenDk, px: 1.5,
            '&:hover': { bgcolor: '#3bd070' } }}>
          Print / Save PDF
        </Button>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '420px 1fr' },
          minHeight: '78vh' }}>
          {/* Editor */}
          <Box sx={{ borderRight: { md: `1px solid ${B.border}` }, p: 2, overflow: 'auto', ...scrollbar,
            maxHeight: { md: '85vh' } }}>
            <Editor local={local} update={update} project={project} mockups={mockups} mockupMap={mockupMap} />
          </Box>
          {/* Preview */}
          <Box sx={{ p: { xs: 1.5, md: 3 }, bgcolor: '#e6e6df', overflow: 'auto', ...scrollbar,
            maxHeight: { md: '85vh' } }}>
            <Preview conf={local} project={project} mockupMap={mockupMap}
              clientLogo={logo} brandLogo={brandLogo} totals={totals} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

function Editor({ local, update, project, mockups, mockupMap }) {
  const updateShipping = (patch) => update({ shipping: { ...local.shipping, ...patch } });
  const updateItem = (idx, patch) =>
    update({ items: local.items.map((it, i) => i === idx ? { ...it, ...patch } : it) });
  const removeItem = (idx) =>
    update({ items: local.items.filter((_, i) => i !== idx) });
  const addItem = (seed) =>
    update({ items: [...local.items, seed || emptyItem()] });
  const moveItem = (idx, dir) => {
    const arr = [...local.items];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    update({ items: arr });
  };

  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };

  return (
    <Stack gap={2}>
      {/* Header */}
      <Section title="Header">
        <SmallField label="Order title"
          value={local.orderTitle} onChange={v => update({ orderTitle: v })} />
        <SmallField label="Order date" type="date"
          value={local.orderDate ? new Date(local.orderDate).toISOString().slice(0,10) : ''}
          onChange={v => update({ orderDate: v ? new Date(v).toISOString() : null })} />
      </Section>

      {/* Shipping */}
      <Section title="Shipping">
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <SmallField label="Shipping name" value={local.shipping.name}
            onChange={v => updateShipping({ name: v })} />
          <SmallField label="Attention" value={local.shipping.attention}
            onChange={v => updateShipping({ attention: v })} />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <SmallField label="Street address" value={local.shipping.streetAddress}
              onChange={v => updateShipping({ streetAddress: v })} />
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <SmallField label="City, State, Zip" value={local.shipping.cityStateZip}
              onChange={v => updateShipping({ cityStateZip: v })} />
          </Box>
        </Box>
      </Section>

      {/* Items */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
          <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Items · {local.items.length}
          </Typography>
          <Box>
            {(project.quoteLines || []).length > 0 && (
              <Tooltip title="Add a quote line as an item">
                <Button size="small"
                  onClick={() => {
                    const used = new Set(local.items.map(i => i.styleCode + '|' + i.color));
                    const next = (project.quoteLines || [])
                      .filter(l => !used.has((l.styleCode || '') + '|' + (l.color || '')))
                      .map(seedItemFromQuote);
                    if (next.length === 0) return;
                    update({ items: [...local.items, ...next] });
                  }}
                  sx={{ color: B.muted, fontSize: 11, textTransform: 'none' }}>
                  + From quote
                </Button>
              </Tooltip>
            )}
            <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
              onClick={() => addItem()}
              sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
              Add item
            </Button>
          </Box>
        </Stack>
        <Stack gap={1.2}>
          {local.items.map((it, i) => (
            <ItemCard key={i} idx={i} item={it} mockups={mockups} mockupMap={mockupMap}
              onUpdate={(p) => updateItem(i, p)}
              onRemove={() => removeItem(i)}
              onMove={(d) => moveItem(i, d)}
              project={project} noSpinner={noSpinner} />
          ))}
          {local.items.length === 0 && (
            <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, p: 2, textAlign: 'center', color: B.muted, fontSize: 12 }}>
              No items yet. Add one for each garment/product the client wants.
            </Box>
          )}
        </Stack>
      </Box>

      {/* Custom lines */}
      <Section title="Add-on lines"
        action={
          <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={() => update({ customLines: [...(local.customLines || []), { label: '', amount: 0, isPercent: false }] })}
            sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
            Add line
          </Button>
        }>
        <Stack gap={0.6}>
          {(local.customLines || []).map((cl, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 50px 28px',
              gap: 0.5, alignItems: 'center' }}>
              <TextField size="small" placeholder="Label (e.g. Shipping reserve)"
                value={cl.label}
                onChange={e => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })}
                sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12 } }} />
              <TextField size="small" type="number" placeholder="0.00"
                value={cl.amount || ''}
                onChange={e => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x) })}
                sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { fontSize: 12, textAlign: 'right' } }} />
              <Tooltip title="Toggle percent vs flat amount">
                <Box onClick={() => update({ customLines: local.customLines.map((x, j) => j === i ? { ...x, isPercent: !x.isPercent } : x) })}
                  sx={{ cursor: 'pointer', textAlign: 'center', color: cl.isPercent ? B.green : B.muted, fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                    border: `1px solid ${cl.isPercent ? B.green : B.faint}`, borderRadius: 0.5, py: 0.4 }}>
                  {cl.isPercent ? '%' : '$'}
                </Box>
              </Tooltip>
              <IconButton size="small"
                onClick={() => update({ customLines: local.customLines.filter((_, j) => j !== i) })}
                sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
                <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
          {(local.customLines || []).length === 0 && (
            <Typography sx={{ color: B.muted, fontSize: 11, fontStyle: 'italic' }}>
              No add-ons. Use these for shipping reserve, CC fee (2.99%), discounts, taxes…
            </Typography>
          )}
        </Stack>
      </Section>
    </Stack>
  );
}

function ItemCard({ idx, item, mockups, mockupMap, onUpdate, onRemove, onMove, project, noSpinner }) {
  const fileRef = React.useRef(null);
  const updateSize = (sIdx, patch) => onUpdate({
    sizes: item.sizes.map((s, j) => j === sIdx ? { ...s, ...patch } : s),
  });
  const addSize = () => {
    const usedLabels = new Set(item.sizes.map(s => s.label));
    const nextDefault = DEFAULT_SIZES.find(s => !usedLabels.has(s)) || '';
    onUpdate({ sizes: [...item.sizes, { label: nextDefault, qty: 0, unitPrice: item.sizes[0]?.unitPrice || 0 }] });
  };
  const removeSize = (sIdx) =>
    onUpdate({ sizes: item.sizes.filter((_, j) => j !== sIdx) });

  // Eligible mockups for this project's company
  const projectMockups = useMemo(() => {
    const co = (project.companyName || project.clientName || '').toLowerCase();
    if (!co) return mockups;
    return mockups.filter(m => (m.client || '').toLowerCase().includes(co) ||
                                (m.name || '').toLowerCase().includes(co));
  }, [mockups, project.companyName, project.clientName]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpdate({ customMockupDataUrl: reader.result, mockupNum: '' });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const lookedUp = item.mockupNum
    ? (mockupMap[item.mockupNum] || mockupMap[normMockupKey(item.mockupNum)])
    : null;
  const hasBack = !!(lookedUp && lookedUp.pageState && lookedUp.pageState.backCompositeBase64);

  return (
    <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, p: 1.2, bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Stack direction="row" alignItems="center" gap={0.5} mb={1}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>
          ITEM {idx + 1}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => onMove(-1)} sx={{ color: B.muted, p: 0.3, fontSize: 14 }}>↑</IconButton>
        <IconButton size="small" onClick={() => onMove(1)}  sx={{ color: B.muted, p: 0.3, fontSize: 14 }}>↓</IconButton>
        <IconButton size="small" onClick={onRemove} sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
          <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>

      {/* Mockup picker */}
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.3 }}>
          Mockup snapshot
        </Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <Select size="small" displayEmpty fullWidth
            value={item.mockupNum || ''}
            onChange={e => onUpdate({ mockupNum: e.target.value, customMockupDataUrl: '' })}
            sx={{ ...darkInput['& .MuiOutlinedInput-root'], color: B.white, fontSize: 12,
              '& .MuiSelect-icon': { color: B.muted } }}>
            <MenuItem value=""><em>— pick one —</em></MenuItem>
            {projectMockups.map(m => (
              <MenuItem key={m._id} value={m.pageState?.mockupNum || m.name}>
                {(m.pageState?.mockupNum || '—')} · {m.name || 'Untitled'}
              </MenuItem>
            ))}
          </Select>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
          <Tooltip title="Upload a custom mockup image instead">
            <IconButton size="small" onClick={() => fileRef.current?.click()}
              sx={{ color: item.customMockupDataUrl ? B.green : B.muted, border: `1px solid ${B.faint}`, borderRadius: 1 }}>
              <FileUploadOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
        {hasBack && (
          <FormControlLabel
            control={<Switch size="small" checked={!!item.showBack}
              onChange={e => onUpdate({ showBack: e.target.checked })} />}
            label={<Typography sx={{ color: B.muted, fontSize: 11 }}>Show back too</Typography>}
            sx={{ mt: 0.3 }}
          />
        )}
      </Box>

      {/* Garment fields */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.6, mb: 1 }}>
        <SmallField label="Brand"      value={item.brandName} onChange={v => onUpdate({ brandName: v })} />
        <SmallField label="Style code" value={item.styleCode} onChange={v => onUpdate({ styleCode: v })} />
        <Box>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.2 }}>
            Print type
          </Typography>
          <Select size="small" value={item.printType || ''}
            onChange={e => onUpdate({ printType: e.target.value })}
            displayEmpty fullWidth
            sx={{ ...darkInput['& .MuiOutlinedInput-root'], color: B.white, fontSize: 12,
              '& .MuiSelect-icon': { color: B.muted } }}>
            <MenuItem value=""><em>—</em></MenuItem>
            {PRINT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </Box>
        <SmallField label="Color"      value={item.color}     onChange={v => onUpdate({ color: v })} />
      </Box>

      {/* Sizes */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.3}>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Sizes · {item.sizes.length}
          </Typography>
          <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 13 }} />}
            onClick={addSize} sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
            Size
          </Button>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: '50px 50px 70px 26px',
          gap: 0.4, alignItems: 'center', mb: 0.2,
          fontSize: 9, fontWeight: 700, color: B.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          <Box>Size</Box><Box sx={{ textAlign: 'right' }}>Qty</Box>
          <Box sx={{ textAlign: 'right' }}>Unit $</Box><Box />
        </Box>
        {item.sizes.map((s, sIdx) => (
          <Box key={sIdx} sx={{ display: 'grid', gridTemplateColumns: '50px 50px 70px 26px',
            gap: 0.4, alignItems: 'center', mb: 0.3 }}>
            <TextField size="small" value={s.label} placeholder="M"
              onChange={e => updateSize(sIdx, { label: e.target.value })}
              sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 11, py: 0.3, textAlign: 'center' } }} />
            <TextField size="small" type="number" value={s.qty || ''}
              onChange={e => updateSize(sIdx, { qty: Number(e.target.value) || 0 })}
              sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 11, py: 0.3, textAlign: 'right' } }} />
            <TextField size="small" type="number" value={s.unitPrice || ''}
              onChange={e => updateSize(sIdx, { unitPrice: Number(e.target.value) || 0 })}
              sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 11, py: 0.3, textAlign: 'right' } }} />
            <IconButton size="small" onClick={() => removeSize(sIdx)}
              sx={{ color: B.muted, p: 0.2, '&:hover': { color: '#f87171' } }}>
              <RemoveCircleOutlineIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Section({ title, action, children }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

function SmallField({ label, value, onChange, type = 'text' }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.2 }}>
        {label}
      </Typography>
      <TextField size="small" fullWidth type={type} value={value || ''}
        onChange={e => onChange(e.target.value)}
        sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.5 } }}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined} />
    </Box>
  );
}

// ── Preview (printable) ──────────────────────────────────────────────────────

function Preview({ conf, project, mockupMap, clientLogo, brandLogo, totals }) {
  return (
    <Box id="confirmation-preview" sx={{
      bgcolor: '#fff', color: '#111', borderRadius: 1, p: { xs: 2, md: 4 },
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxShadow: '0 2px 14px rgba(0,0,0,0.08)', maxWidth: 820, mx: 'auto',
    }}>
      {/* Header band */}
      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        {brandLogo ? (
          <Box component="img" src={brandLogo} alt=""
            sx={{ maxHeight: 64, maxWidth: 220, objectFit: 'contain' }} />
        ) : (
          <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: -0.3 }}>
            JOINT PRINTING
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {clientLogo && (
          <Box sx={{ width: 64, height: 64, p: 0.4, border: '1px solid #e6e6e0',
            borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: '#fff', overflow: 'hidden' }}>
            <Box component="img" src={clientLogo} alt=""
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </Box>
        )}
      </Stack>

      <Typography sx={{ fontWeight: 900, fontSize: 28, lineHeight: 1.1, mb: 2 }}>
        {conf.orderTitle || `${project.companyName || 'Untitled'} Merch`}
      </Typography>

      {/* Basic Info / Shipping Info */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <Box sx={{ borderTop: '2px solid #111', pt: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666', mb: 0.5 }}>
            Basic Info
          </Typography>
          <InfoRow label="Order Title"  value={conf.orderTitle} />
          <InfoRow label="Client Name"  value={project.clientName || project.companyName} />
          <InfoRow label="Order Date"   value={conf.orderDate ? new Date(conf.orderDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''} />
        </Box>
        <Box sx={{ borderTop: '2px solid #111', pt: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666', mb: 0.5 }}>
            Shipping Info
          </Typography>
          <InfoRow label="Shipping Name" value={conf.shipping.name} />
          <InfoRow label="Attention"     value={conf.shipping.attention} />
          <InfoRow label="Street"        value={conf.shipping.streetAddress} />
          <InfoRow label="City/St/Zip"   value={conf.shipping.cityStateZip} />
        </Box>
      </Box>

      {/* Items */}
      <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666',
        borderTop: '2px solid #111', pt: 1, mb: 1 }}>
        Order Info
      </Typography>
      {conf.items.length === 0 ? (
        <Typography sx={{ color: '#999', fontSize: 13, fontStyle: 'italic', mb: 3 }}>
          No items added yet.
        </Typography>
      ) : conf.items.map((it, i) => (
        <ItemPreview key={i} idx={i} item={it} mockupMap={mockupMap} />
      ))}

      {/* Totals + add-ons */}
      <Box sx={{ mt: 3, borderTop: '2px solid #111', pt: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 13, py: 0.5 }}>
          <Box>Items subtotal</Box>
          <Box sx={{ fontFamily: 'monospace' }}>{fmt(totals.itemsSubtotal)}</Box>
        </Stack>
        {totals.lines.map((l, i) => (
          <Stack key={i} direction="row" justifyContent="space-between" sx={{ fontSize: 13, py: 0.5, color: '#444' }}>
            <Box>{l.label}{l.isPercent ? ` (${l.amount}%)` : ''}</Box>
            <Box sx={{ fontFamily: 'monospace' }}>{fmt(l.value)}</Box>
          </Stack>
        ))}
        <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 18, fontWeight: 900, mt: 1, pt: 1, borderTop: '1px solid #111' }}>
          <Box>Grand Total</Box>
          <Box sx={{ fontFamily: 'monospace' }}>{fmt(totals.grandTotal)}</Box>
        </Stack>
      </Box>
    </Box>
  );
}

function InfoRow({ label, value }) {
  return (
    <Stack direction="row" sx={{ fontSize: 12, py: 0.25, gap: 1 }}>
      <Box sx={{ color: '#777', minWidth: 100 }}>{label}:</Box>
      <Box sx={{ color: '#111', fontWeight: 600 }}>{value || <span style={{ color: '#bbb' }}>—</span>}</Box>
    </Stack>
  );
}

function ItemPreview({ idx, item, mockupMap }) {
  const m = item.mockupNum ? (mockupMap[item.mockupNum] || mockupMap[normMockupKey(item.mockupNum)]) : null;
  const frontImg = item.customMockupDataUrl || (m && m.thumbnail);
  const backImg  = item.showBack && m && m.pageState && m.pageState.backCompositeBase64;

  const subtotal = item.sizes.reduce((s, x) => s + (Number(x.qty) || 0) * (Number(x.unitPrice) || 0), 0);
  const nonZeroSizes = item.sizes.filter(s => Number(s.qty) > 0);

  return (
    <Box sx={{ mt: 2, mb: 1, pb: 2, borderBottom: '1px solid #eee' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#666', mb: 0.5 }}>
        Order Item {idx + 1})
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: backImg ? '160px 160px 1fr' : '160px 1fr', gap: 2 }}>
        <Box sx={{ aspectRatio: '1', bgcolor: '#f4f4f4', borderRadius: 1, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {frontImg
            ? <Box component="img" src={frontImg} alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <DesignServicesIcon sx={{ color: '#bbb' }} />}
        </Box>
        {backImg && (
          <Box sx={{ aspectRatio: '1', bgcolor: '#f4f4f4', borderRadius: 1, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box component="img" src={backImg} alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </Box>
        )}
        <Box>
          <Box sx={{ fontSize: 13, mb: 1 }}>
            <Box sx={{ fontWeight: 700 }}>{[item.brandName, item.styleCode].filter(Boolean).join(' ')}</Box>
            <Box sx={{ color: '#555' }}>
              {[item.printType, item.color].filter(Boolean).join(' · ')}
            </Box>
          </Box>
          {nonZeroSizes.length === 0 ? (
            <Box sx={{ color: '#bbb', fontSize: 12, fontStyle: 'italic' }}>No quantities set.</Box>
          ) : (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left',  fontSize: 9, color: '#777', padding: '4px 6px', borderBottom: '1px solid #ddd', textTransform: 'uppercase' }}>Size</th>
                  <th style={{ textAlign: 'right', fontSize: 9, color: '#777', padding: '4px 6px', borderBottom: '1px solid #ddd', textTransform: 'uppercase' }}>Qty</th>
                  <th style={{ textAlign: 'right', fontSize: 9, color: '#777', padding: '4px 6px', borderBottom: '1px solid #ddd', textTransform: 'uppercase' }}>Unit</th>
                  <th style={{ textAlign: 'right', fontSize: 9, color: '#777', padding: '4px 6px', borderBottom: '1px solid #ddd', textTransform: 'uppercase' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {nonZeroSizes.map((s, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f1f1' }}>{s.label}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f1f1', textAlign: 'right' }}>{s.qty}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f1f1', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(s.unitPrice)}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f1f1', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(s.qty * s.unitPrice)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ padding: '6px', textAlign: 'right', fontWeight: 700, borderTop: '1px solid #111' }}>Item subtotal</td>
                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, borderTop: '1px solid #111', fontFamily: 'monospace' }}>
                    {fmt(subtotal)}
                  </td>
                </tr>
              </tbody>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function seedItemFromQuote(line) {
  // Sensible default: pull style / brand / color / print from quote, leave
  // qty unset so the admin distributes across sizes manually.
  const description = line.description || '';
  const brandGuess = description.split(/\s/)[0] || '';
  return {
    mockupNum: '', customMockupDataUrl: '', showBack: false,
    brandName: brandGuess,
    styleCode: line.styleCode || '',
    printType: line.printType || '',
    color:     line.color || '',
    sizes:     DEFAULT_SIZES.map(s => ({ label: s, qty: 0, unitPrice: Number(line.unitPrice) || 0 })),
  };
}

function computeTotals(conf) {
  const itemsSubtotal = (conf.items || []).reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0),
    0);
  let running = itemsSubtotal;
  const lines = (conf.customLines || []).map(l => {
    const value = l.isPercent
      ? running * (Number(l.amount) || 0) / 100
      : Number(l.amount) || 0;
    running += value;
    return { label: l.label || (l.isPercent ? 'Adjustment' : 'Add-on'), amount: l.amount, isPercent: l.isPercent, value };
  });
  return { itemsSubtotal, lines, grandTotal: running };
}

function printConfirmation(elementId, project, brandLogo) {
  const el = document.getElementById(elementId);
  if (!el) return window.print();
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) {
    alert('Popup was blocked. Printing this view instead — allow popups for jointprinting.com to get a cleaner print layout next time.');
    window.print();
    return;
  }
  w.document.write(`
    <html><head><title>Confirmation — Project #${project.projectNumber || ''}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; margin: 28px; }
      img { max-width: 100%; }
      table { width: 100%; border-collapse: collapse; }
      @page { margin: 0.5in; }
    </style>
    </head><body>${el.innerHTML}</body></html>
  `);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}
