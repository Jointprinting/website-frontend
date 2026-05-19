// src/screens/studio/QuoterTab.js
import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, TextField, MenuItem, Button, IconButton,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Chip, Tooltip, Autocomplete, Select,
  FormControl, InputLabel, Paper, Collapse, InputAdornment, Popover,
} from '@mui/material';
import AddCircleOutlineIcon       from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon          from '@mui/icons-material/DeleteOutline';
import ArrowBackIosNewIcon        from '@mui/icons-material/ArrowBackIosNew';
import SaveOutlinedIcon           from '@mui/icons-material/SaveOutlined';
import ReceiptLongOutlinedIcon    from '@mui/icons-material/ReceiptLongOutlined';
import ContentCopyIcon            from '@mui/icons-material/ContentCopy';
import SearchIcon                 from '@mui/icons-material/Search';
import CheckCircleOutlineIcon     from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon   from '@mui/icons-material/RadioButtonUnchecked';
import PrintOutlinedIcon          from '@mui/icons-material/PrintOutlined';
import ExpandMoreIcon             from '@mui/icons-material/ExpandMore';
import ExpandLessIcon             from '@mui/icons-material/ExpandLess';
import RefreshIcon                from '@mui/icons-material/Refresh';
import AddIcon                    from '@mui/icons-material/Add';
import RemoveIcon                 from '@mui/icons-material/Remove';
import LocalShippingOutlinedIcon  from '@mui/icons-material/LocalShippingOutlined';
import config from '../../config.json';

// ─── Brand colours (matches Studio.js) ───────────────────────────────────────
const B = {
  bg:      '#0c1410',
  panel:   '#162420',
  panelHi: '#1c2e28',
  border:  '#1a3d2b',
  green:   '#4ade80',
  greenDk: '#1a3d2b',
  white:   '#ffffff',
  muted:   'rgba(255,255,255,0.55)',
  faint:   'rgba(255,255,255,0.06)',
  budget:  '#60a5fa',
  mid:     '#a78bfa',
  premium: '#f59e0b',
};

// Margin colour bands
const marginColor = (pct) => {
  if (pct >= 40) return '#4ade80';
  if (pct >= 30) return '#86efac';
  if (pct >= 25) return '#bef264';
  if (pct >= 20) return '#fde047';
  if (pct >= 15) return '#fb923c';
  return '#f87171';
};
const marginBg = (pct) => marginColor(pct) + '22';

const MARGINS = [15, 20, 25, 30, 35, 40, 45, 50];

const TIER_META = {
  budget:  { label: 'Budget',  color: B.budget  },
  mid:     { label: 'Mid',     color: B.mid     },
  premium: { label: 'Premium', color: B.premium },
};

const GARMENT_TYPES = [
  'T-Shirt', 'Long Sleeve Shirt', 'Polo', 'Hoodie', 'Crewneck',
  'Zip-Up Hoodie', 'Quarter-Zip', 'Sweatpant', 'Hat', 'Beanie', 'Tote Bag', 'Other',
];

const PRINT_TYPES = [
  'Screen Printing', 'DTF', 'DTG', 'Embroidery', 'Sublimation',
  'Heat Transfer', 'Supacolor', 'Other',
];

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'OS'];

const PAYMENT_RATES = { card: 0.0299, ach: 0.01, venmo: 0.019 };
const PAYMENT_LABELS = {
  card:  'Credit Card (+2.99%)',
  ach:   'ACH Bank Transfer (+1%)',
  venmo: 'Venmo (+1.9% + $0.10)',
  other: 'Other / No fee',
};

// Approximate weight (lbs) per piece by garment type — used by shipping estimator
const GARMENT_WEIGHT_LB = {
  'T-Shirt':           0.40,
  'Long Sleeve Shirt': 0.55,
  'Polo':              0.45,
  'Hoodie':            1.50,
  'Crewneck':          1.20,
  'Zip-Up Hoodie':     1.60,
  'Quarter-Zip':       1.30,
  'Sweatpant':         1.20,
  'Hat':               0.35,
  'Beanie':            0.25,
  'Tote Bag':          0.40,
  'Other':             0.50,
};

// Simple ground shipping rate card (UPS/FedEx rough averages)
const estimateShipping = (totalLbs) => {
  if (totalLbs <= 0) return 0;
  if (totalLbs <= 5)   return 9;
  if (totalLbs <= 10)  return 13;
  if (totalLbs <= 20)  return 18;
  if (totalLbs <= 35)  return 25;
  if (totalLbs <= 50)  return 35;
  if (totalLbs <= 75)  return 48;
  if (totalLbs <= 100) return 62;
  return Math.round(totalLbs * 0.65); // ~$0.65/lb for heavy freight
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
let _rid = 0;
const uid = () => `r${++_rid}`;

const emptyRow = (tier = 'mid', qty = 48) => ({
  _uid: uid(),
  styleCode: '', brand: '', productType: '',
  tier, quantity: qty,
  blankPrice: 0, printType: 'Screen Printing', printColors: 1, locations: 1,
  printCostPerUnit: 0, setupCost: 0, shippingCost: 0,
  selected: false, selectedMargin: 30,
  garmentColor: '', notes: '',
});

const emptyGroup = (garmentType = '') => ({
  _uid: uid(), garmentType, rows: [],
});

const calcCOGS = (r) => {
  const qty = Number(r.quantity) || 1;
  return (
    Number(r.blankPrice) +
    Number(r.printCostPerUnit) +
    Number(r.setupCost) / qty +
    Number(r.shippingCost) / qty
  );
};

const calcPrice = (cogs, pct) => cogs / (1 - pct / 100);

const fmt = (n) => `$${Number(n).toFixed(2)}`;

const darkInput = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.04)', color: B.white,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: B.green },
    '&.Mui-focused fieldset': { borderColor: B.green },
  },
  '& .MuiInputLabel-root': { color: B.muted },
  '& .MuiInputLabel-root.Mui-focused': { color: B.green },
  '& .MuiInputBase-input': { color: B.white },
  '& .MuiSelect-icon': { color: B.muted },
  '& .MuiAutocomplete-endAdornment .MuiIconButton-root': { color: B.muted },
  input: { color: B.white },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuoterTab({ token }) {
  const [view, setView]         = React.useState('list');   // 'list' | 'editor' | 'conf'
  const [quotes, setQuotes]     = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [err, setErr]           = React.useState('');
  const [search, setSearch]     = React.useState('');
  const [quote, setQuote]       = React.useState(null);
  const [saving, setSaving]     = React.useState(false);
  const [saveOk, setSaveOk]     = React.useState('');
  const [saveErr, setSaveErr]   = React.useState('');
  const [clients, setClients]   = React.useState({ clients: [], companies: [] });

  // Add-group dialog
  const [addOpen, setAddOpen]       = React.useState(false);
  const [newType, setNewType]       = React.useState('T-Shirt');
  const [newQtys, setNewQtys]       = React.useState([48, 96]);
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestErr, setSuggestErr] = React.useState('');

  const authHdr = { headers: { Authorization: `Bearer ${token}` } };

  // ── Load quote list ──────────────────────────────────────────────────────
  const loadQuotes = React.useCallback(async (q = '') => {
    setLoading(true); setErr('');
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const r = await axios.get(`${config.backendUrl}/api/quoter/quotes${params}`, authHdr);
      setQuotes(r.data);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load quotes.');
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  React.useEffect(() => { loadQuotes(); }, [loadQuotes]);

  React.useEffect(() => {
    axios.get(`${config.backendUrl}/api/quoter/clients`, authHdr)
      .then(r => setClients(r.data)).catch(() => {});
  }, []); // eslint-disable-line

  // ── Save quote ───────────────────────────────────────────────────────────
  const saveQuote = async (q = quote) => {
    setSaving(true); setSaveErr(''); setSaveOk('');
    try {
      let saved;
      if (q._id) {
        const r = await axios.put(`${config.backendUrl}/api/quoter/quotes/${q._id}`, q, authHdr);
        saved = r.data;
      } else {
        const r = await axios.post(`${config.backendUrl}/api/quoter/quotes`, q, authHdr);
        saved = r.data;
      }
      setQuote(saved);
      setSaveOk('Saved!');
      setTimeout(() => setSaveOk(''), 2000);
      await loadQuotes();
    } catch (e) {
      setSaveErr(e?.response?.data?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  // ── Delete quote ─────────────────────────────────────────────────────────
  const deleteQuote = async (id) => {
    if (!window.confirm('Delete this quote?')) return;
    try {
      await axios.delete(`${config.backendUrl}/api/quoter/quotes/${id}`, authHdr);
      await loadQuotes();
      if (quote?._id === id) { setQuote(null); setView('list'); }
    } catch (e) { alert(e?.response?.data?.message || 'Delete failed.'); }
  };

  // ── Open a quote for editing ─────────────────────────────────────────────
  const openQuote = async (id) => {
    try {
      const r = await axios.get(`${config.backendUrl}/api/quoter/quotes/${id}`, authHdr);
      setQuote(r.data);
      setSaveOk(''); setSaveErr('');
      setView('editor');
    } catch (e) { alert('Failed to load quote.'); }
  };

  const newQuote = () => {
    setQuote({
      clientName: '', companyName: '', printerName: '',
      date: new Date().toISOString().split('T')[0],
      notes: '', garmentGroups: [], status: 'draft',
      confPage: {
        orderTitle: '', shippingName: '', attentionName: '',
        streetAddress: '', cityStateZip: '',
        items: [], shippingReserve: 0, paymentMethod: 'card',
      },
    });
    setSaveOk(''); setSaveErr('');
    setView('editor');
  };

  // ── Add garment group ────────────────────────────────────────────────────
  const addGroup = async () => {
    setSuggesting(true); setSuggestErr('');
    try {
      const r = await axios.get(
        `${config.backendUrl}/api/quoter/suggest?garmentType=${encodeURIComponent(newType)}`,
        authHdr,
      );
      const { budget, mid, premium } = r.data;

      const tiers = [
        { tier: 'budget',  prod: budget  },
        { tier: 'mid',     prod: mid     },
        { tier: 'premium', prod: premium },
      ].filter(t => t.prod);

      const rows = [];
      for (const { tier, prod } of tiers) {
        for (const qty of newQtys) {
          const row = emptyRow(tier, qty);
          row.styleCode  = prod.style || '';
          row.brand      = prod.brandName || prod.name || '';
          row.blankPrice = prod.basePrice || 0;
          row.productType = newType;
          rows.push(row);
        }
      }

      const group = emptyGroup(newType);
      group.rows = rows;

      setQuote(prev => ({
        ...prev,
        garmentGroups: [...(prev.garmentGroups || []), group],
      }));
      setAddOpen(false);
    } catch (e) {
      setSuggestErr(e?.response?.data?.message || 'Could not load product suggestions.');
    } finally { setSuggesting(false); }
  };

  // ── Lookup style code ────────────────────────────────────────────────────
  const lookupStyle = async (gIdx, rIdx, styleCode) => {
    if (!styleCode.trim()) return;
    try {
      const r = await axios.get(
        `${config.backendUrl}/api/quoter/style/${encodeURIComponent(styleCode.trim())}`,
        authHdr,
      );
      updateRow(gIdx, rIdx, {
        brand: r.data.brandName || r.data.name || '',
        blankPrice: r.data.basePrice || 0,
      });
    } catch (_) { /* style not found — that's ok, user can enter manually */ }
  };

  // ── Mutate helpers ───────────────────────────────────────────────────────
  const updateQuoteField = (field, val) =>
    setQuote(prev => ({ ...prev, [field]: val }));

  const updateGroup = (gIdx, field, val) =>
    setQuote(prev => {
      const groups = [...prev.garmentGroups];
      groups[gIdx] = { ...groups[gIdx], [field]: val };
      return { ...prev, garmentGroups: groups };
    });

  const updateRow = (gIdx, rIdx, patch) =>
    setQuote(prev => {
      const groups = prev.garmentGroups.map((g, gi) => {
        if (gi !== gIdx) return g;
        const rows = g.rows.map((r, ri) => ri === rIdx ? { ...r, ...patch } : r);
        return { ...g, rows };
      });
      return { ...prev, garmentGroups: groups };
    });

  const removeGroup = (gIdx) =>
    setQuote(prev => ({
      ...prev,
      garmentGroups: prev.garmentGroups.filter((_, i) => i !== gIdx),
    }));

  const removeRow = (gIdx, rIdx) =>
    setQuote(prev => {
      const groups = prev.garmentGroups.map((g, gi) => {
        if (gi !== gIdx) return g;
        return { ...g, rows: g.rows.filter((_, ri) => ri !== rIdx) };
      });
      return { ...prev, garmentGroups: groups };
    });

  const addBlankRow = (gIdx) =>
    setQuote(prev => {
      const groups = prev.garmentGroups.map((g, gi) => {
        if (gi !== gIdx) return g;
        return { ...g, rows: [...g.rows, emptyRow('mid', 48)] };
      });
      return { ...prev, garmentGroups: groups };
    });

  const duplicateRow = (gIdx, rIdx) =>
    setQuote(prev => {
      const groups = prev.garmentGroups.map((g, gi) => {
        if (gi !== gIdx) return g;
        const clone = { ...g.rows[rIdx], _uid: uid(), selected: false };
        const rows = [...g.rows];
        rows.splice(rIdx + 1, 0, clone);
        return { ...g, rows };
      });
      return { ...prev, garmentGroups: groups };
    });

  // ── Build confirmation page ──────────────────────────────────────────────
  const buildConfPage = () => {
    const selected = [];
    for (const g of (quote.garmentGroups || [])) {
      for (const r of (g.rows || [])) {
        if (!r.selected) continue;
        const cogs  = calcCOGS(r);
        const price = calcPrice(cogs, r.selectedMargin || 30);
        selected.push({
          fromQuoter: true,
          label: `${r.productType || g.garmentType} — ${r.styleCode}`,
          brand: r.brand,
          styleCode: r.styleCode,
          printType: r.printType,
          garmentColor: r.garmentColor,
          unitPrice: price,
          productName: '',
          sizeBreakdown: { S: 0, M: 0, L: 0, XL: 0 },
          notes: r.notes,
        });
      }
    }

    const confPage = {
      ...(quote.confPage || {}),
      orderTitle:    quote.confPage?.orderTitle    || `${quote.companyName || quote.clientName} Merch`,
      shippingName:  quote.confPage?.shippingName  || quote.companyName || '',
      attentionName: quote.confPage?.attentionName || quote.clientName  || '',
      streetAddress: quote.confPage?.streetAddress || '',
      cityStateZip:  quote.confPage?.cityStateZip  || '',
      items: [
        ...selected,
        ...((quote.confPage?.items || []).filter(i => !i.fromQuoter)),
      ],
      shippingReserve: quote.confPage?.shippingReserve || 0,
      paymentMethod:   quote.confPage?.paymentMethod   || 'card',
    };

    setQuote(prev => ({ ...prev, confPage }));
    setView('conf');
  };

  const updateConfField = (field, val) =>
    setQuote(prev => ({ ...prev, confPage: { ...prev.confPage, [field]: val } }));

  const updateConfItem = (idx, patch) =>
    setQuote(prev => {
      const items = prev.confPage.items.map((it, i) => i === idx ? { ...it, ...patch } : it);
      return { ...prev, confPage: { ...prev.confPage, items } };
    });

  const updateSizeBreakdown = (itemIdx, size, val) =>
    setQuote(prev => {
      const items = prev.confPage.items.map((it, i) => {
        if (i !== itemIdx) return it;
        return { ...it, sizeBreakdown: { ...it.sizeBreakdown, [size]: Number(val) || 0 } };
      });
      return { ...prev, confPage: { ...prev.confPage, items } };
    });

  const addCustomConfItem = () =>
    setQuote(prev => ({
      ...prev,
      confPage: {
        ...prev.confPage,
        items: [
          ...(prev.confPage?.items || []),
          { fromQuoter: false, label: '', brand: '', styleCode: '', printType: '', garmentColor: '',
            unitPrice: 0, productName: '', sizeBreakdown: { OS: 0 }, notes: '' },
        ],
      },
    }));

  const removeConfItem = (idx) =>
    setQuote(prev => ({
      ...prev,
      confPage: { ...prev.confPage, items: prev.confPage.items.filter((_, i) => i !== idx) },
    }));

  // ── Print confirmation page ──────────────────────────────────────────────
  const printConfPage = () => {
    const c = quote.confPage || {};
    const allItems = c.items || [];

    const itemsHtml = allItems.map((item, idx) => {
      const sizes = item.sizeBreakdown || {};
      const totalQty = Object.values(sizes).reduce((s, v) => s + (Number(v) || 0), 0);
      const totalAmt = totalQty * (Number(item.unitPrice) || 0);
      const sizeRows = Object.entries(sizes)
        .map(([sz, q]) => `<tr><td>${sz}</td><td>${q || ''}</td><td>$${Number(item.unitPrice).toFixed(2)}</td></tr>`)
        .join('');

      const header = item.fromQuoter
        ? `${item.brand || ''} ${item.styleCode || ''}`.trim()
        : (item.productName || item.label || '');

      return `
        <div class="item">
          <h3>Order Item ${idx + 1}) ${header}</h3>
          <table class="size-table">
            <thead><tr><th>Size</th><th>Quantity</th><th>Unit Price</th></tr></thead>
            <tbody>${sizeRows}</tbody>
            <tfoot><tr><td>Total</td><td>${totalQty}</td><td>$${totalAmt.toFixed(2)}</td></tr></tfoot>
          </table>
          ${item.brand ? `<p class="meta">Brand: ${item.brand}</p>` : ''}
          ${item.styleCode ? `<p class="meta">Style Code: ${item.styleCode}</p>` : ''}
          ${item.printType ? `<p class="meta">Print Type: ${item.printType}</p>` : ''}
          ${item.garmentColor ? `<p class="meta">Garment Color: ${item.garmentColor}</p>` : ''}
          ${item.productName && !item.fromQuoter ? `<p class="meta">Product: ${item.productName}</p>` : ''}
        </div>`;
    }).join('');

    const grandSubtotal = allItems.reduce((s, item) => {
      const totalQty = Object.values(item.sizeBreakdown || {}).reduce((a, v) => a + (Number(v) || 0), 0);
      return s + totalQty * (Number(item.unitPrice) || 0);
    }, 0);

    const shipReserve = Number(c.shippingReserve) || 0;
    const method = c.paymentMethod || 'card';
    const rate   = PAYMENT_RATES[method] || 0;
    const venmoFixed = method === 'venmo' ? 0.10 : 0;
    const feeBase = grandSubtotal + shipReserve;
    const fee   = feeBase * rate + venmoFixed;
    const total = feeBase + fee;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${c.orderTitle || 'Confirmation Page'}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 13px; margin: 16px 0 6px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; }
  .header-grid p { margin: 2px 0; }
  .label { font-weight: bold; }
  .item { margin-bottom: 24px; border-left: 3px solid #bbb; padding-left: 12px; }
  .size-table { border-collapse: collapse; margin: 6px 0 8px; }
  .size-table th, .size-table td { border: 1px solid #ddd; padding: 4px 10px; text-align: left; }
  .size-table thead { background: #f5f5f5; }
  .size-table tfoot { font-weight: bold; background: #f0f0f0; }
  .meta { margin: 2px 0; color: #444; }
  .totals { margin-top: 24px; border-top: 2px solid #333; padding-top: 12px; }
  .totals p { margin: 4px 0; }
  .grand-total { font-size: 16px; font-weight: bold; margin-top: 8px; }
  .payment-info { margin-top: 16px; font-size: 11px; color: #555; border: 1px solid #ddd; padding: 10px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${c.orderTitle || 'Merch Order'}</h1>
  <div class="header-grid">
    <div>
      <h2>Basic Info</h2>
      <p><span class="label">Client Name:</span> ${quote.clientName || ''}</p>
      <p><span class="label">Order Date:</span> ${new Date(quote.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p><span class="label">Printer:</span> ${quote.printerName || ''}</p>
    </div>
    <div>
      <h2>Shipping Info</h2>
      <p><span class="label">Shipping Name:</span> ${c.shippingName || ''}</p>
      <p><span class="label">Attention:</span> ${c.attentionName || ''}</p>
      <p><span class="label">Address:</span> ${c.streetAddress || ''}</p>
      <p>${c.cityStateZip || ''}</p>
    </div>
  </div>

  <h2>Order Info</h2>
  ${itemsHtml}

  <div class="totals">
    ${shipReserve ? `<p>Outbound Shipping Reserve: $${shipReserve.toFixed(2)}</p>` : ''}
    ${fee ? `<p>${PAYMENT_LABELS[method] || 'Processing Fee'}: $${fee.toFixed(2)}</p>` : ''}
    <p class="grand-total">Grand Total: $${total.toFixed(2)}</p>
  </div>

  <div class="payment-info">
    Credit Card Payments: 2.99% charge added to total<br>
    ACH Bank Transfers: 1% charge added to total<br>
    Venmo: 1.9% + $0.10 &nbsp;@jointprinting
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // ── Render ────────────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <QuoteListView
      quotes={quotes} loading={loading} err={err}
      search={search} setSearch={setSearch}
      onSearch={loadQuotes} onNew={newQuote}
      onOpen={openQuote} onDelete={deleteQuote}
    />
  );

  if (view === 'conf' && quote) return (
    <ConfirmationView
      quote={quote}
      onBack={() => setView('editor')}
      onBackToList={() => { setView('list'); loadQuotes(); }}
      onSave={() => saveQuote()}
      saving={saving} saveOk={saveOk} saveErr={saveErr}
      updateConfField={updateConfField}
      updateConfItem={updateConfItem}
      updateSizeBreakdown={updateSizeBreakdown}
      addCustomItem={addCustomConfItem}
      removeConfItem={removeConfItem}
      onPrint={printConfPage}
    />
  );

  if (view === 'editor' && quote) return (
    <EditorView
      quote={quote}
      saving={saving} saveOk={saveOk} saveErr={saveErr}
      onBack={() => { setView('list'); loadQuotes(); }}
      onSave={() => saveQuote()}
      onDelete={() => quote._id && deleteQuote(quote._id)}
      onBuildConf={buildConfPage}
      updateQuoteField={updateQuoteField}
      updateGroup={updateGroup}
      updateRow={updateRow}
      removeGroup={removeGroup}
      removeRow={removeRow}
      addBlankRow={addBlankRow}
      duplicateRow={duplicateRow}
      lookupStyle={lookupStyle}
      onAddGroup={() => { setAddOpen(true); setSuggestErr(''); }}
      clients={clients}
    >
      {/* Add Group Dialog */}
      <AddGroupDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        garmentType={newType}
        setGarmentType={setNewType}
        quantities={newQtys}
        setQuantities={setNewQtys}
        onAdd={addGroup}
        suggesting={suggesting}
        suggestErr={suggestErr}
      />
    </EditorView>
  );

  return null;
}

// ─── Quote List View ──────────────────────────────────────────────────────────
function QuoteListView({ quotes, loading, err, search, setSearch, onSearch, onNew, onOpen, onDelete }) {
  const [term, setTerm] = React.useState(search);
  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(term);
    onSearch(term);
  };

  const grouped = React.useMemo(() => {
    const map = {};
    for (const q of quotes) {
      const key = q.companyName || q.clientName || 'Unknown';
      if (!map[key]) map[key] = [];
      map[key].push(q);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [quotes]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography sx={{ color: B.white, fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>
          CEO Quoter
        </Typography>
        <Button
          onClick={onNew}
          startIcon={<AddCircleOutlineIcon />}
          variant="contained"
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, '&:hover': { bgcolor: '#86efac' } }}
        >
          New Quote
        </Button>
      </Stack>

      <Box component="form" onSubmit={handleSearch} sx={{ mb: 3 }}>
        <TextField
          fullWidth size="small" placeholder="Search by client or company…"
          value={term} onChange={e => setTerm(e.target.value)}
          sx={{ ...darkInput }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: B.muted, fontSize: 18 }} /></InputAdornment>,
            endAdornment: term ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setTerm(''); setSearch(''); onSearch(''); }} sx={{ color: B.muted }}>
                  <RemoveIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress sx={{ color: B.green }} /></Box>}
      {err && <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5', mb: 2 }}>{err}</Alert>}

      {!loading && quotes.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8, color: B.muted }}>
          <ReceiptLongOutlinedIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography>No quotes yet. Create your first one.</Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {grouped.map(([clientKey, clientQuotes]) => (
          <Box key={clientKey}>
            <Typography sx={{ color: B.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', mb: 0.5, px: 0.5 }}>
              {clientKey}
            </Typography>
            <Stack spacing={0.5}>
              {clientQuotes.map(q => {
                const totalItems = (q.garmentGroups || []).reduce((s, g) => s + (g.rows || []).length, 0);
                const dateStr = new Date(q.date || q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <Paper
                    key={q._id}
                    onClick={() => onOpen(q._id)}
                    sx={{
                      bgcolor: B.panel, border: `1px solid ${B.border}`,
                      borderRadius: 2, p: '12px 16px', cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                      '&:hover': { borderColor: B.green, bgcolor: B.panelHi },
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack spacing={0.3}>
                        <Typography sx={{ color: B.white, fontWeight: 600, fontSize: 14 }}>
                          {q.companyName || q.clientName}
                          {q.notes && <Typography component="span" sx={{ color: B.muted, fontSize: 12, ml: 1 }}>— {q.notes.slice(0, 40)}</Typography>}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ color: B.muted, fontSize: 12 }}>{dateStr}</Typography>
                          {q.printerName && <Chip label={q.printerName} size="small" sx={{ bgcolor: B.faint, color: B.muted, height: 18, fontSize: 10 }} />}
                          {totalItems > 0 && <Chip label={`${totalItems} row${totalItems !== 1 ? 's' : ''}`} size="small" sx={{ bgcolor: B.faint, color: B.muted, height: 18, fontSize: 10 }} />}
                          <Chip
                            label={q.status === 'finalized' ? 'Finalized' : 'Draft'}
                            size="small"
                            sx={{
                              bgcolor: q.status === 'finalized' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.12)',
                              color:   q.status === 'finalized' ? B.green : '#fbbf24',
                              height: 18, fontSize: 10,
                            }}
                          />
                        </Stack>
                      </Stack>
                      <IconButton
                        size="small"
                        onClick={e => { e.stopPropagation(); onDelete(q._id); }}
                        sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

// ─── Editor View ──────────────────────────────────────────────────────────────
function EditorView({
  quote, saving, saveOk, saveErr,
  onBack, onSave, onDelete, onBuildConf,
  updateQuoteField, updateGroup, updateRow,
  removeGroup, removeRow, addBlankRow, duplicateRow, lookupStyle,
  onAddGroup, clients, children,
}) {
  const selectedCount = (quote.garmentGroups || []).reduce(
    (s, g) => s + (g.rows || []).filter(r => r.selected).length, 0,
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Top bar */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <IconButton onClick={onBack} sx={{ color: B.muted, '&:hover': { color: B.green } }}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 18, flex: 1 }}>
          {quote.companyName || quote.clientName || 'New Quote'}
        </Typography>
        {saveOk && <Chip label={saveOk} size="small" sx={{ bgcolor: 'rgba(74,222,128,0.15)', color: B.green }} />}
        {saveErr && <Typography sx={{ color: '#f87171', fontSize: 12 }}>{saveErr}</Typography>}
        <Button
          onClick={onSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : <SaveOutlinedIcon />}
          variant="contained"
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, fontSize: 13, '&:hover': { bgcolor: '#86efac' } }}
        >
          Save
        </Button>
        {selectedCount > 0 && (
          <Button
            onClick={onBuildConf}
            startIcon={<ReceiptLongOutlinedIcon />}
            variant="outlined"
            sx={{ borderColor: B.premium, color: B.premium, fontWeight: 700, fontSize: 13,
              '&:hover': { borderColor: B.premium, bgcolor: 'rgba(245,158,11,0.1)' } }}
          >
            Confirmation Page ({selectedCount})
          </Button>
        )}
      </Stack>

      {/* Quote header fields */}
      <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <Autocomplete
            freeSolo options={clients.clients}
            value={quote.clientName || ''}
            onInputChange={(_, v) => updateQuoteField('clientName', v)}
            renderInput={p => <TextField {...p} label="Client Name" size="small" sx={{ ...darkInput, minWidth: 180 }} />}
            sx={{ flex: 1 }}
          />
          <Autocomplete
            freeSolo options={clients.companies}
            value={quote.companyName || ''}
            onInputChange={(_, v) => updateQuoteField('companyName', v)}
            renderInput={p => <TextField {...p} label="Company Name" size="small" sx={{ ...darkInput, minWidth: 180 }} />}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Printer" size="small" value={quote.printerName || ''}
            onChange={e => updateQuoteField('printerName', e.target.value)}
            sx={{ ...darkInput, minWidth: 150 }}
          />
          <TextField
            label="Date" type="date" size="small" value={quote.date?.split('T')[0] || ''}
            onChange={e => updateQuoteField('date', e.target.value)}
            sx={{ ...darkInput, minWidth: 150 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Notes" size="small" value={quote.notes || ''}
            onChange={e => updateQuoteField('notes', e.target.value)}
            sx={{ ...darkInput, flex: 2, minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: B.muted }}>Status</InputLabel>
            <Select
              value={quote.status || 'draft'}
              onChange={e => updateQuoteField('status', e.target.value)}
              label="Status"
              sx={{ ...darkInput['& .MuiOutlinedInput-root'], color: B.white }}
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="finalized">Finalized</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Garment groups */}
      <Stack spacing={3}>
        {(quote.garmentGroups || []).map((group, gIdx) => (
          <GarmentGroup
            key={group._uid || gIdx}
            group={group} gIdx={gIdx}
            onLabelChange={v => updateGroup(gIdx, 'garmentType', v)}
            onRemoveGroup={() => removeGroup(gIdx)}
            onUpdateRow={(rIdx, patch) => updateRow(gIdx, rIdx, patch)}
            onRemoveRow={rIdx => removeRow(gIdx, rIdx)}
            onAddRow={() => addBlankRow(gIdx)}
            onDuplicateRow={rIdx => duplicateRow(gIdx, rIdx)}
            onLookupStyle={(rIdx, code) => lookupStyle(gIdx, rIdx, code)}
          />
        ))}
      </Stack>

      {/* Add group */}
      <Button
        onClick={onAddGroup}
        startIcon={<AddCircleOutlineIcon />}
        sx={{ mt: 3, color: B.green, borderColor: B.border, border: '1px dashed', borderRadius: 2, px: 3, py: 1.5,
          '&:hover': { borderColor: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}
        fullWidth
      >
        Add Garment Group
      </Button>

      {children}
    </Box>
  );
}

// ─── Garment Group ────────────────────────────────────────────────────────────
function GarmentGroup({ group, gIdx, onLabelChange, onRemoveGroup, onUpdateRow, onRemoveRow, onAddRow, onDuplicateRow, onLookupStyle }) {
  const [expanded, setExpanded] = React.useState(true);
  const selectedInGroup = (group.rows || []).filter(r => r.selected).length;

  return (
    <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden' }}>
      {/* Group header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.5, bgcolor: B.panelHi, borderBottom: `1px solid ${B.border}` }}>
        <TextField
          size="small" value={group.garmentType || ''}
          onChange={e => onLabelChange(e.target.value)}
          placeholder="Group label (e.g. Hoodies)"
          variant="standard"
          sx={{ flex: 1, '& .MuiInputBase-input': { color: B.white, fontWeight: 700, fontSize: 15 }, '& .MuiInput-underline:before': { borderBottomColor: 'transparent' }, '& .MuiInput-underline:after': { borderBottomColor: B.green } }}
        />
        {selectedInGroup > 0 && <Chip label={`${selectedInGroup} selected`} size="small" sx={{ bgcolor: 'rgba(74,222,128,0.15)', color: B.green, fontSize: 11 }} />}
        <IconButton size="small" onClick={() => setExpanded(v => !v)} sx={{ color: B.muted }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={onRemoveGroup} sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ overflowX: 'auto' }}>
          {/* Column headers */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: '28px 80px 90px 110px 60px 72px 110px 48px 48px 80px 80px 80px 90px 1fr 28px 28px',
            gap: '4px', px: 2, py: 1,
            bgcolor: 'rgba(0,0,0,0.2)', borderBottom: `1px solid ${B.border}`,
            minWidth: 1000,
          }}>
            {['', 'Tier', 'Style', 'Brand', 'Qty', 'Blank', 'Print Type', 'Clrs', 'Locs', 'Print/unit', 'Setup$', 'Ship$', 'COGS', 'Margins →', '', ''].map((h, i) => (
              <Typography key={i} sx={{ color: B.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i >= 14 ? 'center' : 'left' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {/* Rows */}
          <Stack divider={<Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}>
            {(group.rows || []).map((row, rIdx) => (
              <QuoteRow
                key={row._uid || rIdx}
                row={row} rIdx={rIdx} gIdx={gIdx}
                garmentType={group.garmentType}
                onChange={patch => onUpdateRow(rIdx, patch)}
                onRemove={() => onRemoveRow(rIdx)}
                onDuplicate={() => onDuplicateRow(rIdx)}
                onLookup={code => onLookupStyle(rIdx, code)}
              />
            ))}
          </Stack>

          {(group.rows || []).length === 0 && (
            <Box sx={{ py: 3, textAlign: 'center', color: B.muted }}>
              <Typography sx={{ fontSize: 13 }}>No rows yet.</Typography>
            </Box>
          )}

          <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${B.border}` }}>
            <Button
              size="small" onClick={onAddRow}
              startIcon={<AddIcon sx={{ fontSize: 15 }} />}
              sx={{ color: B.muted, fontSize: 12, '&:hover': { color: B.green } }}
            >
              Add row
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}

// ─── Quote Row ────────────────────────────────────────────────────────────────
function QuoteRow({ row, garmentType, onChange, onRemove, onDuplicate, onLookup }) {
  const [showMargins, setShowMargins] = React.useState(true);
  const [shipAnchor, setShipAnchor] = React.useState(null);
  const cogs = calcCOGS(row);

  const lbPerPiece = GARMENT_WEIGHT_LB[garmentType] ?? 0.5;
  const totalLbs   = lbPerPiece * (Number(row.quantity) || 48);
  const suggestedShip = estimateShipping(totalLbs);

  const gridCols = '28px 80px 90px 110px 60px 72px 110px 48px 48px 80px 80px 80px 90px 1fr 28px 28px';

  return (
    <Box sx={{ minWidth: 1000 }}>
      {/* Main input row */}
      <Box sx={{
        display: 'grid', gridTemplateColumns: gridCols,
        gap: '4px', px: 2, py: 1, alignItems: 'center',
      }}>
        {/* Select checkbox */}
        <IconButton
          size="small"
          onClick={() => onChange({ selected: !row.selected })}
          sx={{ color: row.selected ? B.green : B.muted, p: 0.25 }}
        >
          {row.selected
            ? <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
            : <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />
          }
        </IconButton>

        {/* Tier */}
        <FormControl size="small" variant="outlined">
          <Select
            value={row.tier || 'mid'}
            onChange={e => onChange({ tier: e.target.value })}
            sx={{ fontSize: 11, color: TIER_META[row.tier]?.color || B.muted,
              bgcolor: 'rgba(255,255,255,0.03)', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '& .MuiSelect-icon': { color: B.muted, fontSize: 16 },
            }}
          >
            {Object.entries(TIER_META).map(([k, v]) => (
              <MenuItem key={k} value={k} sx={{ fontSize: 12 }}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Style code */}
        <TextField
          size="small" value={row.styleCode || ''}
          onChange={e => onChange({ styleCode: e.target.value })}
          onBlur={e => onLookup(e.target.value)}
          placeholder="Style"
          sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px' } }}
        />

        {/* Brand */}
        <TextField
          size="small" value={row.brand || ''}
          onChange={e => onChange({ brand: e.target.value })}
          placeholder="Brand"
          sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px' } }}
        />

        {/* Quantity */}
        <TextField
          size="small" type="number" value={row.quantity || ''}
          onChange={e => onChange({ quantity: Number(e.target.value) })}
          sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px', textAlign: 'right' } }}
        />

        {/* Blank price */}
        <TextField
          size="small" type="number" value={row.blankPrice || ''}
          onChange={e => onChange({ blankPrice: Number(e.target.value) })}
          InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ color: B.muted, fontSize: 11 }}>$</Typography></InputAdornment> }}
          sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px' } }}
        />

        {/* Print type */}
        <FormControl size="small">
          <Select
            value={row.printType || 'Screen Printing'}
            onChange={e => onChange({ printType: e.target.value })}
            sx={{ fontSize: 11, color: B.white, bgcolor: 'rgba(255,255,255,0.03)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '& .MuiSelect-icon': { color: B.muted, fontSize: 16 },
            }}
          >
            {PRINT_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: 12 }}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Print colors */}
        <TextField
          size="small" type="number" value={row.printColors || 1}
          onChange={e => onChange({ printColors: Number(e.target.value) })}
          sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px', textAlign: 'center' } }}
        />

        {/* Locations */}
        <TextField
          size="small" type="number" value={row.locations || 1}
          onChange={e => onChange({ locations: Number(e.target.value) })}
          sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px', textAlign: 'center' } }}
        />

        {/* Print cost/unit */}
        <TextField
          size="small" type="number" value={row.printCostPerUnit || ''}
          onChange={e => onChange({ printCostPerUnit: Number(e.target.value) })}
          InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ color: B.muted, fontSize: 11 }}>$</Typography></InputAdornment> }}
          sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px' } }}
        />

        {/* Setup cost */}
        <TextField
          size="small" type="number" value={row.setupCost || ''}
          onChange={e => onChange({ setupCost: Number(e.target.value) })}
          InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ color: B.muted, fontSize: 11 }}>$</Typography></InputAdornment> }}
          sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px' } }}
        />

        {/* Shipping cost + estimator */}
        <Stack direction="row" spacing={0.3} alignItems="center">
          <TextField
            size="small" type="number" value={row.shippingCost || ''}
            onChange={e => onChange({ shippingCost: Number(e.target.value) })}
            InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ color: B.muted, fontSize: 11 }}>$</Typography></InputAdornment> }}
            sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '6px' }, minWidth: 60 }}
          />
          <Tooltip title="Estimate shipping">
            <IconButton size="small" onClick={e => setShipAnchor(e.currentTarget)}
              sx={{ color: row.shippingCost ? B.green : B.muted, p: '2px', '&:hover': { color: B.green } }}>
              <LocalShippingOutlinedIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(shipAnchor)} anchorEl={shipAnchor}
            onClose={() => setShipAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Box sx={{ p: 2, bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, minWidth: 220 }}>
              <Typography sx={{ color: B.green, fontSize: 12, fontWeight: 700, mb: 1 }}>
                Shipping Estimator
              </Typography>
              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: B.muted, fontSize: 11 }}>Garment type</Typography>
                  <Typography sx={{ color: B.white, fontSize: 11 }}>{garmentType || '—'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: B.muted, fontSize: 11 }}>Wt/piece</Typography>
                  <Typography sx={{ color: B.white, fontSize: 11 }}>{lbPerPiece} lb</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: B.muted, fontSize: 11 }}>Qty</Typography>
                  <Typography sx={{ color: B.white, fontSize: 11 }}>{row.quantity}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: B.muted, fontSize: 11 }}>Total weight</Typography>
                  <Typography sx={{ color: B.white, fontSize: 11 }}>{totalLbs.toFixed(1)} lb</Typography>
                </Stack>
                <Divider sx={{ borderColor: B.border, my: 0.5 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: B.muted, fontSize: 11 }}>Est. ground ship</Typography>
                  <Typography sx={{ color: B.green, fontSize: 12, fontWeight: 700 }}>${suggestedShip}</Typography>
                </Stack>
              </Stack>
              <Button
                size="small" fullWidth
                onClick={() => { onChange({ shippingCost: suggestedShip }); setShipAnchor(null); }}
                sx={{ mt: 1.5, bgcolor: B.green, color: B.greenDk, fontWeight: 700, fontSize: 11,
                  '&:hover': { bgcolor: '#86efac' } }}
              >
                Use ${suggestedShip}
              </Button>
              <Typography sx={{ color: B.muted, fontSize: 9, mt: 0.75, textAlign: 'center' }}>
                Rough ground rate — adjust as needed
              </Typography>
            </Box>
          </Popover>
        </Stack>

        {/* COGS */}
        <Typography sx={{ color: B.white, fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
          {fmt(cogs)}
        </Typography>

        {/* Margin toggle */}
        <Box>
          <IconButton size="small" onClick={() => setShowMargins(v => !v)} sx={{ color: B.muted, p: 0.3 }}>
            {showMargins ? <ExpandLessIcon sx={{ fontSize: 15 }} /> : <ExpandMoreIcon sx={{ fontSize: 15 }} />}
          </IconButton>
        </Box>

        {/* Duplicate */}
        <IconButton size="small" onClick={onDuplicate} sx={{ color: B.muted, p: 0.3, '&:hover': { color: B.mid } }}>
          <ContentCopyIcon sx={{ fontSize: 14 }} />
        </IconButton>

        {/* Delete */}
        <IconButton size="small" onClick={onRemove} sx={{ color: B.muted, p: 0.3, '&:hover': { color: '#f87171' } }}>
          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>

      {/* Margin cells */}
      <Collapse in={showMargins}>
        <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {MARGINS.map(pct => {
              const price = calcPrice(cogs, pct);
              const total = price * (row.quantity || 1);
              const profit = (price - cogs) * (row.quantity || 1);
              const isSelected = row.selected && row.selectedMargin === pct;
              return (
                <Tooltip
                  key={pct}
                  title={
                    <Box sx={{ fontSize: 12 }}>
                      <div><b>{pct}% margin</b></div>
                      <div>Unit price: {fmt(price)}</div>
                      <div>Total: {fmt(total)}</div>
                      <div>Profit: {fmt(profit)}</div>
                    </Box>
                  }
                  arrow
                >
                  <Box
                    onClick={() => onChange({ selected: true, selectedMargin: pct })}
                    sx={{
                      px: 1.2, py: 0.6, borderRadius: 1, cursor: 'pointer',
                      bgcolor: isSelected ? marginColor(pct) : marginBg(pct),
                      border: `1px solid ${isSelected ? marginColor(pct) : marginBg(pct)}`,
                      transition: 'all 0.12s',
                      '&:hover': { border: `1px solid ${marginColor(pct)}`, transform: 'translateY(-1px)' },
                    }}
                  >
                    <Typography sx={{
                      fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                      color: isSelected ? '#000' : marginColor(pct),
                      lineHeight: 1.2,
                    }}>
                      {pct}%
                    </Typography>
                    <Typography sx={{
                      fontSize: 11, fontFamily: 'monospace',
                      color: isSelected ? 'rgba(0,0,0,0.75)' : marginColor(pct),
                    }}>
                      {fmt(price)}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Stack>

          {/* Extra row fields (colour, notes) */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField
              size="small" value={row.garmentColor || ''}
              onChange={e => onChange({ garmentColor: e.target.value })}
              placeholder="Garment color"
              sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '5px' }, width: 180 }}
            />
            <TextField
              size="small" value={row.notes || ''}
              onChange={e => onChange({ notes: e.target.value })}
              placeholder="Notes"
              sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: '5px' }, flex: 1 }}
            />
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

// ─── Add Group Dialog ─────────────────────────────────────────────────────────
function AddGroupDialog({ open, onClose, garmentType, setGarmentType, quantities, setQuantities, onAdd, suggesting, suggestErr }) {
  const addQty = () => setQuantities(prev => [...prev, 96]);
  const removeQty = (i) => setQuantities(prev => prev.filter((_, idx) => idx !== i));
  const updateQty = (i, v) => setQuantities(prev => prev.map((q, idx) => idx === i ? Number(v) : q));

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, minWidth: 360 } }}>
      <DialogTitle sx={{ color: B.white, fontWeight: 700, fontSize: 16 }}>Add Garment Group</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: B.muted }}>Garment Type</InputLabel>
            <Select value={garmentType} onChange={e => setGarmentType(e.target.value)} label="Garment Type"
              sx={{ color: B.white, bgcolor: 'rgba(255,255,255,0.04)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-icon': { color: B.muted } }}
            >
              {GARMENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>

          <Box>
            <Typography sx={{ color: B.muted, fontSize: 12, mb: 1 }}>Quantity tiers to compare</Typography>
            <Stack spacing={1}>
              {quantities.map((q, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small" type="number" value={q}
                    onChange={e => updateQty(i, e.target.value)}
                    label={`Qty ${i + 1}`}
                    sx={{ ...darkInput, width: 120 }}
                  />
                  {quantities.length > 1 && (
                    <IconButton size="small" onClick={() => removeQty(i)} sx={{ color: B.muted }}>
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
              {quantities.length < 4 && (
                <Button size="small" startIcon={<AddIcon />} onClick={addQty} sx={{ color: B.muted, alignSelf: 'flex-start' }}>
                  Add quantity tier
                </Button>
              )}
            </Stack>
          </Box>

          <Typography sx={{ color: B.muted, fontSize: 12 }}>
            Creates <b style={{ color: B.white }}>3 product tiers × {quantities.length} quantities = {3 * quantities.length} rows</b> auto-filled from your product database.
          </Typography>

          {suggestErr && <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5', fontSize: 12 }}>{suggestErr}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: B.muted }}>Cancel</Button>
        <Button
          onClick={onAdd} disabled={suggesting} variant="contained"
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700 }}
        >
          {suggesting ? <CircularProgress size={16} sx={{ color: B.greenDk }} /> : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Confirmation Page View ───────────────────────────────────────────────────
function ConfirmationView({
  quote, onBack, onBackToList, onSave, saving, saveOk, saveErr,
  updateConfField, updateConfItem, updateSizeBreakdown,
  addCustomItem, removeConfItem, onPrint,
}) {
  const c = quote.confPage || {};
  const items = c.items || [];

  const grandSubtotal = items.reduce((s, item) => {
    const qty = Object.values(item.sizeBreakdown || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    return s + qty * (Number(item.unitPrice) || 0);
  }, 0);

  const shipReserve = Number(c.shippingReserve) || 0;
  const method = c.paymentMethod || 'card';
  const rate   = PAYMENT_RATES[method] || 0;
  const venmoFixed = method === 'venmo' ? 0.10 : 0;
  const fee    = (grandSubtotal + shipReserve) * rate + venmoFixed;
  const total  = grandSubtotal + shipReserve + fee;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      {/* Top bar */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <IconButton onClick={onBack} sx={{ color: B.muted, '&:hover': { color: B.green } }}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 18, flex: 1 }}>
          Confirmation Page
        </Typography>
        {saveOk && <Chip label={saveOk} size="small" sx={{ bgcolor: 'rgba(74,222,128,0.15)', color: B.green }} />}
        <Button onClick={onPrint} startIcon={<PrintOutlinedIcon />} variant="outlined"
          sx={{ borderColor: B.border, color: B.muted, '&:hover': { borderColor: B.green, color: B.green } }}>
          Print / PDF
        </Button>
        <Button onClick={onSave} disabled={saving} startIcon={saving ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : <SaveOutlinedIcon />}
          variant="contained" sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, '&:hover': { bgcolor: '#86efac' } }}>
          Save
        </Button>
      </Stack>

      {saveErr && <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5', mb: 2 }}>{saveErr}</Alert>}

      {/* Order header */}
      <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: 2, mb: 2 }}>
        <Typography sx={{ color: B.white, fontWeight: 700, mb: 1.5 }}>Order Details</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Stack spacing={1.5} flex={1}>
            <TextField label="Order Title" size="small" value={c.orderTitle || ''} onChange={e => updateConfField('orderTitle', e.target.value)} sx={{ ...darkInput }} />
            <TextField label="Client Name" size="small" value={quote.clientName || ''} disabled sx={{ ...darkInput }} />
            <TextField label="Order Date" size="small" value={new Date(quote.date || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} disabled sx={{ ...darkInput }} />
          </Stack>
          <Stack spacing={1.5} flex={1}>
            <TextField label="Shipping Name" size="small" value={c.shippingName || ''} onChange={e => updateConfField('shippingName', e.target.value)} sx={{ ...darkInput }} />
            <TextField label="Attention Name" size="small" value={c.attentionName || ''} onChange={e => updateConfField('attentionName', e.target.value)} sx={{ ...darkInput }} />
            <TextField label="Street Address" size="small" value={c.streetAddress || ''} onChange={e => updateConfField('streetAddress', e.target.value)} sx={{ ...darkInput }} />
            <TextField label="City, State, Zip" size="small" value={c.cityStateZip || ''} onChange={e => updateConfField('cityStateZip', e.target.value)} sx={{ ...darkInput }} />
          </Stack>
        </Stack>
      </Paper>

      {/* Order items */}
      <Stack spacing={2} sx={{ mb: 2 }}>
        {items.map((item, idx) => (
          <ConfItem
            key={idx} item={item} idx={idx}
            onChange={patch => updateConfItem(idx, patch)}
            onSizeChange={(sz, v) => updateSizeBreakdown(idx, sz, v)}
            onRemove={() => removeConfItem(idx)}
          />
        ))}
      </Stack>

      <Button onClick={addCustomItem} startIcon={<AddCircleOutlineIcon />} fullWidth
        sx={{ mb: 3, border: '1px dashed', borderColor: B.border, borderRadius: 2, color: B.muted, py: 1.5,
          '&:hover': { borderColor: B.green, color: B.green, bgcolor: 'rgba(74,222,128,0.04)' } }}>
        Add Custom Item
      </Button>

      {/* Totals + payment */}
      <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: 2 }}>
        <Typography sx={{ color: B.white, fontWeight: 700, mb: 2 }}>Payment & Total</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          <Stack spacing={1.5} flex={1}>
            <FormControl size="small">
              <InputLabel sx={{ color: B.muted }}>Payment Method</InputLabel>
              <Select value={method} onChange={e => updateConfField('paymentMethod', e.target.value)} label="Payment Method"
                sx={{ color: B.white, bgcolor: 'rgba(255,255,255,0.04)', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-icon': { color: B.muted } }}>
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Shipping Reserve ($)" size="small" type="number"
              value={c.shippingReserve || ''} onChange={e => updateConfField('shippingReserve', Number(e.target.value))}
              sx={{ ...darkInput }}
            />
          </Stack>
          <Stack spacing={0.5} flex={1} sx={{ bgcolor: B.panelHi, borderRadius: 1.5, p: 1.5 }}>
            <Row label="Subtotal" val={fmt(grandSubtotal)} />
            {shipReserve > 0 && <Row label="Shipping reserve" val={fmt(shipReserve)} />}
            {fee > 0 && <Row label={`${PAYMENT_LABELS[method] || 'Fee'}`} val={fmt(fee)} />}
            <Divider sx={{ borderColor: B.border, my: 0.5 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 16 }}>Grand Total</Typography>
              <Typography sx={{ color: B.green, fontWeight: 700, fontSize: 18, fontFamily: 'monospace' }}>{fmt(total)}</Typography>
            </Stack>
          </Stack>
        </Stack>
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, border: `1px solid ${B.border}` }}>
          <Typography sx={{ color: B.muted, fontSize: 11, lineHeight: 1.7 }}>
            Credit Card Payments: 2.99% charge added to total<br />
            ACH Bank Transfers: 1% charge added to total<br />
            Venmo: 1.9% + $0.10 &nbsp;&nbsp;@jointprinting
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

function Row({ label, val }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography sx={{ color: B.muted, fontSize: 13 }}>{label}</Typography>
      <Typography sx={{ color: B.white, fontSize: 13, fontFamily: 'monospace' }}>{val}</Typography>
    </Stack>
  );
}

// ─── Confirmation Item ────────────────────────────────────────────────────────
function ConfItem({ item, idx, onChange, onSizeChange, onRemove }) {
  const [open, setOpen] = React.useState(true);
  const [newSize, setNewSize] = React.useState('');
  const sizes = Object.keys(item.sizeBreakdown || {});
  const totalQty = Object.values(item.sizeBreakdown || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalAmt = totalQty * (Number(item.unitPrice) || 0);

  const addSize = () => {
    const sz = newSize.trim().toUpperCase();
    if (!sz || sizes.includes(sz)) return;
    onSizeChange(sz, 0);
    setNewSize('');
  };

  const removeSize = (sz) => {
    const bd = { ...item.sizeBreakdown };
    delete bd[sz];
    onChange({ sizeBreakdown: bd });
  };

  return (
    <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.2, bgcolor: B.panelHi, borderBottom: open ? `1px solid ${B.border}` : 'none' }}>
        <Typography sx={{ color: B.muted, fontSize: 12, mr: 1 }}>Item {idx + 1}</Typography>
        <Typography sx={{ color: B.white, fontWeight: 600, fontSize: 13, flex: 1 }}>
          {item.brand && item.styleCode ? `${item.brand} ${item.styleCode}` : item.productName || item.label || 'Custom Item'}
        </Typography>
        <Typography sx={{ color: B.green, fontFamily: 'monospace', fontSize: 13, mr: 1 }}>{fmt(totalAmt)}</Typography>
        <IconButton size="small" onClick={() => setOpen(v => !v)} sx={{ color: B.muted, mr: 0.5 }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={onRemove} sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Collapse in={open}>
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {/* Left: product info */}
            <Stack spacing={1.5} sx={{ minWidth: 200 }}>
              {!item.fromQuoter && (
                <TextField label="Product Name" size="small" value={item.productName || ''} onChange={e => onChange({ productName: e.target.value })} sx={{ ...darkInput }} />
              )}
              {item.fromQuoter && (
                <>
                  <TextField label="Brand" size="small" value={item.brand || ''} onChange={e => onChange({ brand: e.target.value })} sx={{ ...darkInput }} />
                  <TextField label="Style Code" size="small" value={item.styleCode || ''} onChange={e => onChange({ styleCode: e.target.value })} sx={{ ...darkInput }} />
                  <TextField label="Print Type" size="small" value={item.printType || ''} onChange={e => onChange({ printType: e.target.value })} sx={{ ...darkInput }} />
                  <TextField label="Garment Color" size="small" value={item.garmentColor || ''} onChange={e => onChange({ garmentColor: e.target.value })} sx={{ ...darkInput }} />
                </>
              )}
              <TextField
                label="Unit Price ($)" size="small" type="number"
                value={item.unitPrice || ''}
                onChange={e => onChange({ unitPrice: Number(e.target.value) })}
                sx={{ ...darkInput }}
              />
              <TextField label="Notes" size="small" value={item.notes || ''} onChange={e => onChange({ notes: e.target.value })} sx={{ ...darkInput }} />
            </Stack>

            {/* Right: size breakdown */}
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: B.muted, fontSize: 12, mb: 1 }}>Size Breakdown</Typography>
              <Stack spacing={0.75}>
                {sizes.map(sz => (
                  <Stack key={sz} direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ color: B.muted, fontSize: 12, width: 36 }}>{sz}</Typography>
                    <TextField
                      size="small" type="number"
                      value={item.sizeBreakdown[sz] || ''}
                      onChange={e => onSizeChange(sz, e.target.value)}
                      sx={{ ...darkInput, width: 90, '& .MuiInputBase-input': { py: '5px', textAlign: 'right' } }}
                    />
                    <IconButton size="small" onClick={() => removeSize(sz)} sx={{ color: B.muted, p: 0.25, '&:hover': { color: '#f87171' } }}>
                      <RemoveIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                ))}

                {/* Total row */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5, borderTop: `1px solid ${B.border}` }}>
                  <Typography sx={{ color: B.muted, fontSize: 12, width: 36 }}>Total</Typography>
                  <Typography sx={{ color: B.white, fontFamily: 'monospace', fontSize: 13, width: 90, textAlign: 'right' }}>{totalQty}</Typography>
                  <Typography sx={{ color: B.green, fontFamily: 'monospace', fontSize: 13, pl: 1 }}>{fmt(totalAmt)}</Typography>
                </Stack>

                {/* Add size */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
                  <FormControl size="small" sx={{ width: 90 }}>
                    <Select
                      value={newSize} onChange={e => setNewSize(e.target.value)}
                      displayEmpty
                      sx={{ fontSize: 12, color: B.muted, bgcolor: 'rgba(255,255,255,0.03)',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '& .MuiSelect-icon': { color: B.muted, fontSize: 16 } }}
                    >
                      <MenuItem value="" sx={{ fontSize: 12, color: '#888' }}>+ Size</MenuItem>
                      {SIZE_OPTIONS.filter(s => !sizes.includes(s)).map(s => (
                        <MenuItem key={s} value={s} sx={{ fontSize: 12 }}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button size="small" onClick={addSize} disabled={!newSize}
                    sx={{ color: B.green, fontSize: 11, minWidth: 0, px: 1, '&:hover': { bgcolor: 'rgba(74,222,128,0.08)' } }}>
                    Add
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}
