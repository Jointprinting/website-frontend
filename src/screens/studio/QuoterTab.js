// src/screens/studio/QuoterTab.js
import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, TextField, MenuItem, Button, IconButton,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Chip, Tooltip, Autocomplete, Select,
  FormControl, InputLabel, Paper, Collapse, InputAdornment, Popover,
  Table, TableHead, TableBody, TableRow, TableCell,
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
import OpenInNewIcon              from '@mui/icons-material/OpenInNew';
import LocalShippingOutlinedIcon  from '@mui/icons-material/LocalShippingOutlined';
import config from '../../config.json';

// ─── Brand colours ───────────────────────────────────────────────────────────
const B = {
  bg: '#0c1410', panel: '#162420', panelHi: '#1c2e28',
  border: '#1a3d2b', green: '#4ade80', greenDk: '#1a3d2b',
  white: '#ffffff', muted: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.06)',
  budget: '#60a5fa', mid: '#a78bfa', premium: '#f59e0b',
};

const HEADER_H = 56;

// ─── Constants ───────────────────────────────────────────────────────────────
const GARMENT_TYPES = [
  'T-Shirt', 'Long Sleeve Shirt', 'Polo', 'Hoodie', 'Crewneck',
  'Zip-Up Hoodie', 'Quarter-Zip', 'Sweatpant', 'Hat', 'Beanie', 'Tote Bag', 'Other',
];
const PRINT_TYPES = [
  'Screen Printing', 'DTF', 'DTG', 'Embroidery', 'Sublimation',
  'Heat Transfer', 'Supacolor', 'Other',
];
const MARGINS = [15, 20, 25, 30, 35, 40, 45, 50];
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const PAYMENT = {
  card:  { label: 'Credit Card',  rate: 0.0299 },
  ach:   { label: 'ACH Transfer', rate: 0.01 },
  venmo: { label: 'Venmo',        rate: 0.019 },
  other: { label: 'Other',        rate: 0 },
};

const TIER_META = {
  budget:  { label: 'BUDGET',  color: B.budget },
  mid:     { label: 'MID',     color: B.mid },
  premium: { label: 'PREMIUM', color: B.premium },
};

// Approximate weight (lbs) per piece by garment type
const GARMENT_WEIGHT_LB = {
  'T-Shirt': 0.45, 'Long Sleeve Shirt': 0.60, 'Polo': 0.50,
  'Hoodie': 1.60, 'Crewneck': 1.30, 'Zip-Up Hoodie': 1.75,
  'Quarter-Zip': 1.40, 'Sweatpant': 1.30, 'Hat': 0.40,
  'Beanie': 0.30, 'Tote Bag': 0.50, 'Other': 0.75,
};

const estimateShipping = (lbs) => {
  if (lbs <= 0) return 0;
  if (lbs <= 5) return 9;
  if (lbs <= 10) return 13;
  if (lbs <= 20) return 18;
  if (lbs <= 35) return 25;
  if (lbs <= 50) return 35;
  if (lbs <= 75) return 48;
  if (lbs <= 100) return 62;
  return Math.round(lbs * 0.65);
};

// Margin colour band
const marginColor = (pct) => {
  if (pct >= 40) return '#4ade80';
  if (pct >= 30) return '#86efac';
  if (pct >= 25) return '#bef264';
  if (pct >= 20) return '#fde047';
  if (pct >= 15) return '#fb923c';
  return '#f87171';
};
const marginBg = (pct) => marginColor(pct) + '22';

// ─── Helpers ─────────────────────────────────────────────────────────────────
let _rid = 0;
const uid = () => `r${++_rid}`;

const emptyRow = (tier = 'mid', qty = 48) => ({
  _uid: uid(), styleCode: '', brand: '', productType: '',
  tier, quantity: qty, blankPrice: 0,
  printType: 'Screen Printing', printColors: 1, locations: 1,
  printCostPerUnit: 0, setupCost: 0, shippingCost: 0,
  selected: false, selectedMargin: 30, garmentColor: '', notes: '',
});

const emptyGroup = (garmentType = '') => ({ _uid: uid(), garmentType, qtyTiers: [], rows: [] });

const emptyQuote = () => ({
  clientName: '', companyName: '', printerName: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  garmentGroups: [],
  confPage: {
    shippingName: '', attentionName: '', streetAddress: '', cityStateZip: '',
    items: [], paymentMethod: 'card',
  },
});

const calcCOGS = (r, qtyOverride) => {
  const qty = qtyOverride ?? (Number(r.quantity) || 1);
  return (
    Number(r.blankPrice) +
    Number(r.printCostPerUnit) +
    Number(r.setupCost) / qty +
    Number(r.shippingCost) / qty
  );
};
const calcPrice = (cogs, pct) => cogs / (1 - pct / 100);
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sizeQty = (bd) => Object.values(bd || {}).reduce((s, v) => s + (Number(v) || 0), 0);

// ─── Shared input styling ────────────────────────────────────────────────────
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
const selectSx = {
  fontSize: 12, color: B.white, bgcolor: 'rgba(255,255,255,0.04)',
  '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
  '& .MuiSelect-icon': { color: B.muted, fontSize: 18 },
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function QuoterTab({ token, onBack }) {
  const [page, setPage]       = React.useState('list'); // 'list' | 'editor' | 'conf'
  const [quotes, setQuotes]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr]         = React.useState('');
  const [search, setSearch]   = React.useState('');
  const [quote, setQuote]     = React.useState(null);
  const [saving, setSaving]   = React.useState(false);
  const [saveOk, setSaveOk]   = React.useState('');
  const [saveErr, setSaveErr] = React.useState('');
  const [clients, setClients] = React.useState({ clients: [], companies: [] });

  // Add-group dialog
  const [addOpen, setAddOpen]               = React.useState(false);
  const [newType, setNewType]               = React.useState('T-Shirt');
  const [newQtyTiersInput, setNewQtyTiersInput] = React.useState('48');
  const [suggesting, setSuggesting]         = React.useState(false);
  const [suggestErr, setSuggestErr]         = React.useState('');

  // Active qty tier per group (local, not persisted): { [group._uid]: number }
  const [activeQtyPerGroup, setActiveQtyPerGroup] = React.useState({});

  const authHdr = React.useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );
  const baseUrl = `${config.backendUrl}/api/quoter`;

  // ── Load quotes ──────────────────────────────────────────────────────────
  const loadQuotes = React.useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await axios.get(`${baseUrl}/quotes`, authHdr);
      setQuotes(Array.isArray(r.data) ? r.data : (r.data?.quotes || []));
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load quotes.');
    } finally { setLoading(false); }
  }, [authHdr, baseUrl]);

  React.useEffect(() => { loadQuotes(); }, [loadQuotes]);

  React.useEffect(() => {
    axios.get(`${baseUrl}/clients`, authHdr)
      .then(r => setClients({
        clients: r.data?.clients || [],
        companies: r.data?.companies || [],
      }))
      .catch(() => {});
  }, [authHdr, baseUrl]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveQuote = async (q = quote) => {
    if (!q) return;
    setSaving(true); setSaveErr(''); setSaveOk('');
    try {
      let saved;
      if (q._id) {
        const r = await axios.put(`${baseUrl}/quotes/${q._id}`, q, authHdr);
        saved = r.data;
      } else {
        const r = await axios.post(`${baseUrl}/quotes`, q, authHdr);
        saved = r.data;
      }
      setQuote(saved);
      setSaveOk('Saved');
      setTimeout(() => setSaveOk(''), 2000);
      await loadQuotes();
    } catch (e) {
      setSaveErr(e?.response?.data?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteQuote = async (id) => {
    if (!window.confirm('Delete this quote?')) return;
    try {
      await axios.delete(`${baseUrl}/quotes/${id}`, authHdr);
      await loadQuotes();
      if (quote?._id === id) { setQuote(null); setPage('list'); }
    } catch (e) {
      alert(e?.response?.data?.message || 'Delete failed.');
    }
  };

  // ── Open / New ───────────────────────────────────────────────────────────
  const openQuote = (q) => {
    const loaded = {
      ...emptyQuote(), ...q,
      confPage: { ...emptyQuote().confPage, ...(q.confPage || {}) },
      garmentGroups: (q.garmentGroups || []).map(g => ({
        _uid: g._uid || uid(),
        garmentType: g.garmentType || '',
        qtyTiers: g.qtyTiers || [],
        rows: (g.rows || []).map(r => ({ ...emptyRow(), ...r, _uid: r._uid || uid() })),
      })),
    };
    setQuote(loaded);
    setSaveOk(''); setSaveErr('');
    setPage('editor');
  };

  const newQuote = () => {
    setQuote(emptyQuote());
    setSaveOk(''); setSaveErr('');
    setPage('editor');
  };

  // ── Add garment group ────────────────────────────────────────────────────
  const addGroup = async () => {
    setSuggesting(true); setSuggestErr('');
    try {
      const r = await axios.get(
        `${baseUrl}/suggest?garmentType=${encodeURIComponent(newType)}`, authHdr,
      );
      const { budget, mid, premium } = r.data || {};

      // Parse qty tiers from the input (e.g. "48" or "25, 50, 75")
      const parsedTiers = newQtyTiersInput
        .split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
      const qtyTiers = parsedTiers.length > 1 ? parsedTiers : [];
      const baseQty  = parsedTiers[0] || 48;

      const tiers = [
        { tier: 'budget', prod: budget },
        { tier: 'mid', prod: mid },
        { tier: 'premium', prod: premium },
      ];
      const rows = tiers.map(({ tier, prod }) => {
        const row = emptyRow(tier, baseQty);
        row.productType = newType;
        if (prod) {
          row.styleCode  = prod.style || '';
          row.brand      = prod.brandName || '';
          row.blankPrice = prod.avgPrice || prod.basePrice || 0;
        }
        return row;
      });
      const group = emptyGroup(newType);
      group.rows = rows;
      group.qtyTiers = qtyTiers;
      setQuote(prev => ({ ...prev, garmentGroups: [...(prev.garmentGroups || []), group] }));
      setAddOpen(false);
    } catch (e) {
      setSuggestErr(e?.response?.data?.message || 'Could not load product suggestions.');
    } finally { setSuggesting(false); }
  };

  // ── Style lookup ─────────────────────────────────────────────────────────
  const lookupStyle = async (gIdx, rIdx, code) => {
    if (!code || !code.trim()) return;
    try {
      const r = await axios.get(
        `${baseUrl}/style/${encodeURIComponent(code.trim())}`, authHdr,
      );
      updateRow(gIdx, rIdx, {
        brand: r.data?.brandName || '',
        blankPrice: r.data?.avgPrice || r.data?.basePrice || 0,
      });
    } catch (_) { /* not found — manual entry ok */ }
  };

  // ── Mutate helpers ───────────────────────────────────────────────────────
  const updateQuoteField = (field, val) =>
    setQuote(prev => ({ ...prev, [field]: val }));

  const updateGroup = (gIdx, field, val) =>
    setQuote(prev => {
      const groups = prev.garmentGroups.map((g, i) =>
        i === gIdx ? { ...g, [field]: val } : g);
      return { ...prev, garmentGroups: groups };
    });

  const updateRow = (gIdx, rIdx, patch) =>
    setQuote(prev => {
      const groups = prev.garmentGroups.map((g, gi) => {
        if (gi !== gIdx) return g;
        return { ...g, rows: g.rows.map((r, ri) => ri === rIdx ? { ...r, ...patch } : r) };
      });
      return { ...prev, garmentGroups: groups };
    });

  const removeGroup = (gIdx) =>
    setQuote(prev => ({
      ...prev, garmentGroups: prev.garmentGroups.filter((_, i) => i !== gIdx),
    }));

  const removeRow = (gIdx, rIdx) =>
    setQuote(prev => {
      const groups = prev.garmentGroups.map((g, gi) =>
        gi !== gIdx ? g : { ...g, rows: g.rows.filter((_, ri) => ri !== rIdx) });
      return { ...prev, garmentGroups: groups };
    });

  const addBlankRow = (gIdx) =>
    setQuote(prev => {
      const groups = prev.garmentGroups.map((g, gi) =>
        gi !== gIdx ? g : { ...g, rows: [...g.rows, emptyRow('mid', 48)] });
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
      const activeQty = g.qtyTiers?.length > 1
        ? (activeQtyPerGroup[g._uid] ?? g.qtyTiers[0])
        : null;
      for (const r of (g.rows || [])) {
        if (!r.selected) continue;
        const cogs  = calcCOGS(r, activeQty);
        const price = calcPrice(cogs, r.selectedMargin || 30);
        selected.push({
          fromQuoter: true,
          label: `${r.productType || g.garmentType} — ${r.styleCode || ''}`.trim(),
          brand: r.brand || '',
          styleCode: r.styleCode || '',
          printType: r.printType || '',
          garmentColor: r.garmentColor || '',
          productName: '',
          unitPrice: Number(price.toFixed(2)),
          sizeBreakdown: { S: 0, M: 0, L: 0, XL: 0 },
          notes: r.notes || '',
        });
      }
    }
    const prevItems = (quote.confPage?.items || []).filter(i => !i.fromQuoter);
    const confPage = {
      ...emptyQuote().confPage,
      ...(quote.confPage || {}),
      shippingName:  quote.confPage?.shippingName  || quote.companyName || '',
      attentionName: quote.confPage?.attentionName || quote.clientName  || '',
      items: [...selected, ...prevItems],
      paymentMethod: quote.confPage?.paymentMethod || 'card',
    };
    delete confPage.shippingReserve;
    setQuote(prev => ({ ...prev, confPage }));
    setPage('conf');
  };

  const updateConfField = (field, val) =>
    setQuote(prev => ({ ...prev, confPage: { ...prev.confPage, [field]: val } }));

  const updateConfItem = (idx, patch) =>
    setQuote(prev => ({
      ...prev,
      confPage: {
        ...prev.confPage,
        items: prev.confPage.items.map((it, i) => i === idx ? { ...it, ...patch } : it),
      },
    }));

  const removeConfItem = (idx) =>
    setQuote(prev => ({
      ...prev,
      confPage: {
        ...prev.confPage,
        items: prev.confPage.items.filter((_, i) => i !== idx),
      },
    }));

  const addCustomConfItem = (custom) =>
    setQuote(prev => ({
      ...prev,
      confPage: {
        ...prev.confPage,
        items: [
          ...(prev.confPage?.items || []),
          {
            fromQuoter: false, label: custom.label || '', brand: '', styleCode: '',
            printType: '', garmentColor: '', productName: custom.label || '',
            unitPrice: Number(custom.unitPrice) || 0,
            sizeBreakdown: { OS: Number(custom.qty) || 1 },
            notes: custom.notes || '',
          },
        ],
      },
    }));

  // ── Print confirmation page ──────────────────────────────────────────────
  const printConfPage = () => {
    const c = quote.confPage || {};
    const items = c.items || [];

    const itemsHtml = items.map((item, idx) => {
      const sizes = item.sizeBreakdown || {};
      const active = Object.entries(sizes).filter(([, q]) => Number(q) > 0);
      const tQty = sizeQty(sizes);
      const tAmt = tQty * (Number(item.unitPrice) || 0);
      const header = item.fromQuoter
        ? `${item.brand || ''} ${item.styleCode || ''}`.trim() || (item.label || `Item ${idx + 1}`)
        : (item.productName || item.label || `Item ${idx + 1}`);
      const sizeCells = active.length
        ? active.map(([sz, q]) => `<td style="text-align:center"><b>${sz}</b><br>${q}</td>`).join('')
        : '<td>—</td>';
      return `
        <div class="item">
          <div class="item-head">
            <span class="item-name">${idx + 1}) ${header}</span>
            <span class="item-amt">${tQty} @ $${money(item.unitPrice)} = $${money(tAmt)}</span>
          </div>
          <table class="size-table"><tr>${sizeCells}</tr></table>
          ${item.printType ? `<div class="meta">Print: ${item.printType}</div>` : ''}
          ${item.garmentColor ? `<div class="meta">Color: ${item.garmentColor}</div>` : ''}
          ${item.notes ? `<div class="meta">Notes: ${item.notes}</div>` : ''}
        </div>`;
    }).join('');

    const subtotal = items.reduce(
      (s, it) => s + sizeQty(it.sizeBreakdown) * (Number(it.unitPrice) || 0), 0);
    const method = c.paymentMethod || 'card';
    const pm = PAYMENT[method] || PAYMENT.other;
    const fee = subtotal * pm.rate;
    const total = subtotal + fee;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Confirmation Page</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;padding:36px;max-width:800px;margin:0 auto;}
  .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;}
  .brand{text-align:right;}
  .brand .name{font-size:18px;font-weight:bold;}
  .brand .url{font-size:12px;color:#555;}
  h1{font-size:18px;letter-spacing:1px;margin:18px 0 4px;}
  hr{border:none;border-top:1px solid #ccc;margin:10px 0;}
  .ship{display:flex;justify-content:space-between;}
  .item{margin:14px 0;border-left:3px solid #bbb;padding-left:12px;}
  .item-head{display:flex;justify-content:space-between;font-weight:bold;}
  .size-table{border-collapse:collapse;margin:6px 0;}
  .size-table td{border:1px solid #ddd;padding:4px 12px;font-size:12px;}
  .meta{font-size:11px;color:#555;}
  .totals{margin-top:18px;text-align:right;}
  .totals .row{margin:3px 0;}
  .grand{font-size:16px;font-weight:bold;}
  @media print{body{padding:0;}}
</style></head><body>
  <div class="top">
    <img src="/jp-logo.png" height="55" onerror="this.style.display='none'" alt="" />
    <div class="brand"><div class="name">Joint Printing</div><div class="url">jointprinting.com</div></div>
  </div>
  <h1>CONFIRMATION PAGE</h1>
  <hr/>
  <div class="ship">
    <div><b>Ship to:</b> ${c.shippingName || ''}</div>
    <div><b>Attn:</b> ${c.attentionName || ''}</div>
  </div>
  <div>${c.streetAddress || ''}</div>
  <div>${c.cityStateZip || ''}</div>
  <hr/>
  ${itemsHtml || '<div class="meta">No items.</div>'}
  <hr/>
  <div class="totals">
    <div class="row">Subtotal: $${money(subtotal)}</div>
    ${fee > 0 ? `<div class="row">${pm.label} fee: +$${money(fee)}</div>` : ''}
    <div class="row grand">Grand Total: $${money(total)}</div>
  </div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const selectedCount = React.useMemo(() => (
    (quote?.garmentGroups || []).reduce(
      (s, g) => s + (g.rows || []).filter(r => r.selected).length, 0)
  ), [quote]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: B.bg, overflow: 'hidden' }}>
      {page === 'list' && (
        <ListPage
          quotes={quotes} loading={loading} err={err}
          search={search} setSearch={setSearch}
          onBack={onBack} onNew={newQuote}
          onOpen={openQuote} onDelete={deleteQuote}
        />
      )}

      {page === 'editor' && quote && (
        <EditorPage
          quote={quote} clients={clients}
          saving={saving} saveOk={saveOk} saveErr={saveErr}
          selectedCount={selectedCount}
          activeQtyPerGroup={activeQtyPerGroup}
          onSetActiveQty={(groupUid, qty) =>
            setActiveQtyPerGroup(prev => ({ ...prev, [groupUid]: qty }))}
          onBack={() => { setPage('list'); loadQuotes(); }}
          onSave={() => saveQuote()}
          onBuildConf={buildConfPage}
          updateQuoteField={updateQuoteField}
          updateGroup={updateGroup}
          updateRow={updateRow}
          removeGroup={removeGroup}
          removeRow={removeRow}
          addBlankRow={addBlankRow}
          duplicateRow={duplicateRow}
          lookupStyle={lookupStyle}
          onAddGroup={() => { setSuggestErr(''); setAddOpen(true); }}
        />
      )}

      {page === 'conf' && quote && (
        <ConfPage
          quote={quote}
          onBack={() => setPage('editor')}
          onPrint={printConfPage}
          updateConfField={updateConfField}
          updateConfItem={updateConfItem}
          removeConfItem={removeConfItem}
          addCustomItem={addCustomConfItem}
        />
      )}

      <AddGroupDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        garmentType={newType} setGarmentType={setNewType}
        qtyTiersInput={newQtyTiersInput} setQtyTiersInput={setNewQtyTiersInput}
        onAdd={addGroup}
        suggesting={suggesting} suggestErr={suggestErr}
      />
    </Box>
  );
}

// ─── Header bar ──────────────────────────────────────────────────────────────
function HeaderBar({ children }) {
  return (
    <Box sx={{
      position: 'fixed', top: 0, left: 0, right: 0, height: HEADER_H, zIndex: 10,
      bgcolor: '#0a1612', borderBottom: '1px solid #1a3d2b',
      display: 'flex', alignItems: 'center', px: { xs: 1.5, md: 2 },
    }}>
      {children}
    </Box>
  );
}

// ─── Page 1: Quote List ──────────────────────────────────────────────────────
function ListPage({ quotes, loading, err, search, setSearch, onBack, onNew, onOpen, onDelete }) {
  const filtered = React.useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return quotes;
    return quotes.filter(q =>
      (q.clientName || '').toLowerCase().includes(t) ||
      (q.companyName || '').toLowerCase().includes(t));
  }, [quotes, search]);

  const cellSx = { color: B.white, borderColor: B.border, fontSize: 13, py: 1.2 };
  const headSx = {
    color: B.muted, borderColor: B.border, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700,
  };

  return (
    <>
      <HeaderBar>
        <IconButton onClick={onBack} sx={{ color: B.muted, '&:hover': { color: B.green } }}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 16, letterSpacing: 0.5, ml: 0.5 }}>
          QUOTER
        </Typography>
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small" placeholder="Search client / company…"
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ ...darkInput, width: { xs: 150, sm: 240 }, mr: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: B.muted, fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />
        <Button
          onClick={onNew} variant="contained" startIcon={<AddCircleOutlineIcon />}
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, fontSize: 13,
            whiteSpace: 'nowrap', '&:hover': { bgcolor: '#86efac' } }}
        >
          New Quote
        </Button>
      </HeaderBar>

      <Box sx={{ position: 'absolute', inset: 0, pt: `${HEADER_H}px`, overflowY: 'auto' }}>
        <Box sx={{ p: { xs: 1.5, md: 3 } }}>
          {err && (
            <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5', mb: 2 }}>
              {err}
            </Alert>
          )}
          {loading && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress sx={{ color: B.green }} />
            </Box>
          )}
          {!loading && filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 10, color: B.muted }}>
              <ReceiptLongOutlinedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography>{quotes.length ? 'No matching quotes.' : 'No quotes yet.'}</Typography>
            </Box>
          )}

          {!loading && filtered.length > 0 && (
            <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.25)' }}>
                      <TableCell sx={headSx}>Client Name</TableCell>
                      <TableCell sx={headSx}>Company</TableCell>
                      <TableCell sx={headSx}>Garments</TableCell>
                      <TableCell sx={headSx}>Date</TableCell>
                      <TableCell sx={headSx} align="center">Open</TableCell>
                      <TableCell sx={headSx} align="center">Delete</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((q) => {
                      const garments = (q.garmentGroups || [])
                        .map(g => g.garmentType).filter(Boolean).join(', ');
                      const dateStr = q.date
                        ? new Date(q.date).toLocaleDateString('en-US',
                          { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—';
                      return (
                        <TableRow
                          key={q._id}
                          hover onClick={() => onOpen(q)}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: B.panelHi } }}
                        >
                          <TableCell sx={{ ...cellSx, fontWeight: 600 }}>
                            {q.clientName || '—'}
                          </TableCell>
                          <TableCell sx={cellSx}>{q.companyName || '—'}</TableCell>
                          <TableCell sx={{ ...cellSx, color: B.muted }}>
                            {garments || '—'}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, color: B.muted }}>{dateStr}</TableCell>
                          <TableCell sx={cellSx} align="center">
                            <IconButton
                              size="small"
                              onClick={e => { e.stopPropagation(); onOpen(q); }}
                              sx={{ color: B.muted, '&:hover': { color: B.green } }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                          <TableCell sx={cellSx} align="center">
                            <IconButton
                              size="small"
                              onClick={e => { e.stopPropagation(); onDelete(q._id); }}
                              sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>
    </>
  );
}

// ─── Page 2: Quote Editor ────────────────────────────────────────────────────
function EditorPage({
  quote, clients, saving, saveOk, saveErr, selectedCount,
  activeQtyPerGroup, onSetActiveQty,
  onBack, onSave, onBuildConf,
  updateQuoteField, updateGroup, updateRow,
  removeGroup, removeRow, addBlankRow, duplicateRow, lookupStyle, onAddGroup,
}) {
  return (
    <>
      <HeaderBar>
        <IconButton onClick={onBack} sx={{ color: B.muted, '&:hover': { color: B.green } }}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 16, letterSpacing: 0.5, ml: 0.5 }}>
          {quote.companyName || quote.clientName || 'NEW QUOTE'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {saveOk && <Chip label={saveOk} size="small"
          sx={{ bgcolor: 'rgba(74,222,128,0.15)', color: B.green, mr: 1 }} />}
      </HeaderBar>

      <Box sx={{ position: 'absolute', inset: 0, pt: `${HEADER_H}px`, overflowY: 'auto' }}>
        <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
          {saveErr && (
            <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5', mb: 2 }}>
              {saveErr}
            </Alert>
          )}

          {/* Meta header */}
          <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: 1.5, mb: 2 }}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
              <Autocomplete
                freeSolo options={clients.clients}
                value={quote.clientName || ''}
                onInputChange={(_, v) => updateQuoteField('clientName', v)}
                sx={{ minWidth: 180, flex: 1 }}
                renderInput={p => (
                  <TextField {...p} label="Client Name" size="small" sx={darkInput} />
                )}
              />
              <TextField
                label="Company" size="small" value={quote.companyName || ''}
                onChange={e => updateQuoteField('companyName', e.target.value)}
                sx={{ ...darkInput, minWidth: 160, flex: 1 }}
              />
              <TextField
                label="Printer" size="small" value={quote.printerName || ''}
                onChange={e => updateQuoteField('printerName', e.target.value)}
                sx={{ ...darkInput, minWidth: 140 }}
              />
              <TextField
                label="Date" type="date" size="small"
                value={(quote.date || '').slice(0, 10)}
                onChange={e => updateQuoteField('date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ ...darkInput, minWidth: 150 }}
              />
              <Box sx={{ flex: 1 }} />
              <Button
                onClick={onSave} disabled={saving} variant="contained"
                startIcon={saving
                  ? <CircularProgress size={14} sx={{ color: B.greenDk }} />
                  : <SaveOutlinedIcon />}
                sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, fontSize: 13,
                  '&:hover': { bgcolor: '#86efac' } }}
              >
                Save
              </Button>
              <Button
                onClick={onBuildConf} disabled={selectedCount === 0} variant="outlined"
                startIcon={<ReceiptLongOutlinedIcon />}
                sx={{ borderColor: B.premium, color: B.premium, fontWeight: 700, fontSize: 13,
                  '&.Mui-disabled': { borderColor: 'rgba(245,158,11,0.3)', color: 'rgba(245,158,11,0.4)' },
                  '&:hover': { borderColor: B.premium, bgcolor: 'rgba(245,158,11,0.1)' } }}
              >
                Conf Page ({selectedCount})
              </Button>
            </Stack>
          </Paper>

          {/* Garment groups */}
          <Stack spacing={2}>
            {(quote.garmentGroups || []).map((group, gIdx) => {
              const activeQty = group.qtyTiers?.length > 1
                ? (activeQtyPerGroup[group._uid] ?? group.qtyTiers[0])
                : null;
              return (
                <GarmentGroup
                  key={group._uid || gIdx}
                  group={group}
                  activeQty={activeQty}
                  onQtyTierChange={tier => onSetActiveQty(group._uid, tier)}
                  onLabelChange={v => updateGroup(gIdx, 'garmentType', v)}
                  onRemoveGroup={() => removeGroup(gIdx)}
                  onUpdateRow={(rIdx, patch) => updateRow(gIdx, rIdx, patch)}
                  onRemoveRow={rIdx => removeRow(gIdx, rIdx)}
                  onAddRow={() => addBlankRow(gIdx)}
                  onDuplicateRow={rIdx => duplicateRow(gIdx, rIdx)}
                  onLookup={(rIdx, code) => lookupStyle(gIdx, rIdx, code)}
                />
              );
            })}
          </Stack>

          <Button
            onClick={onAddGroup} fullWidth startIcon={<AddCircleOutlineIcon />}
            sx={{ mt: 2, color: B.green, border: '1px dashed', borderColor: B.border,
              borderRadius: 2, py: 1.5,
              '&:hover': { borderColor: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}
          >
            Add Garment Group
          </Button>
        </Box>
      </Box>
    </>
  );
}

// ─── Garment Group ───────────────────────────────────────────────────────────
const ROW_COLS =
  '32px 92px 96px 110px 66px 86px 124px 56px 56px 80px 80px 86px 92px 30px 30px 30px';
const COL_HEADERS = [
  '', 'TIER', 'STYLE', 'BRAND', 'QTY', 'BLANK', 'PRINT TYPE', 'CLRS', 'LOCS',
  'PRINT/UNIT', 'SETUP', 'SHIP', 'COGS', '↕', '✕', '⧉',
];

function GarmentGroup({
  group, activeQty, onQtyTierChange,
  onLabelChange, onRemoveGroup, onUpdateRow, onRemoveRow,
  onAddRow, onDuplicateRow, onLookup,
}) {
  const [expanded, setExpanded] = React.useState(true);
  const selectedInGroup = (group.rows || []).filter(r => r.selected).length;

  return (
    <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden' }}>
      {/* Group header */}
      <Stack direction="row" alignItems="center" spacing={1}
        sx={{ px: 2, py: 1.2, bgcolor: B.panelHi, borderBottom: `1px solid ${B.border}` }}>
        <TextField
          size="small" variant="standard" value={group.garmentType || ''}
          onChange={e => onLabelChange(e.target.value)}
          placeholder="Garment type"
          sx={{ flex: 1, maxWidth: 320,
            '& .MuiInputBase-input': { color: B.white, fontWeight: 700, fontSize: 15 },
            '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
            '& .MuiInput-underline:after': { borderBottomColor: B.green } }}
        />
        {/* Qty tier tabs */}
        {group.qtyTiers?.length > 1 && (
          <Stack direction="row" spacing={0.4} alignItems="center">
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mr: 0.5 }}>QTY</Typography>
            {group.qtyTiers.map(tier => (
              <Box
                key={tier}
                onClick={() => onQtyTierChange(tier)}
                sx={{
                  px: 1.2, py: 0.3, borderRadius: 1, cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  bgcolor: activeQty === tier ? B.green : 'rgba(255,255,255,0.07)',
                  color: activeQty === tier ? B.greenDk : B.muted,
                  border: `1px solid ${activeQty === tier ? B.green : 'transparent'}`,
                  transition: 'all 0.12s',
                  '&:hover': { bgcolor: activeQty === tier ? B.green : 'rgba(255,255,255,0.12)' },
                }}
              >
                {tier}
              </Box>
            ))}
          </Stack>
        )}
        {selectedInGroup > 0 && (
          <Chip label={`${selectedInGroup} selected`} size="small"
            sx={{ bgcolor: 'rgba(74,222,128,0.15)', color: B.green, fontSize: 11, height: 20 }} />
        )}
        <IconButton size="small" onClick={() => setExpanded(v => !v)} sx={{ color: B.muted }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={onRemoveGroup}
          sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ overflowX: 'auto' }}>
          {/* Column headers */}
          <Box sx={{
            display: 'grid', gridTemplateColumns: ROW_COLS, gap: '4px',
            px: 2, py: 0.8, minWidth: 1060,
            bgcolor: 'rgba(0,0,0,0.25)', borderBottom: `1px solid ${B.border}`,
          }}>
            {COL_HEADERS.map((h, i) => (
              <Typography key={i} sx={{
                color: B.muted, fontSize: 9.5, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.4,
                textAlign: i >= 13 ? 'center' : 'left',
              }}>
                {h}
              </Typography>
            ))}
          </Box>

          {/* Rows */}
          <Stack divider={<Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}>
            {(group.rows || []).map((row, rIdx) => (
              <QuoteRow
                key={row._uid || rIdx}
                row={row} garmentType={group.garmentType}
                activeQty={activeQty}
                onChange={patch => onUpdateRow(rIdx, patch)}
                onRemove={() => onRemoveRow(rIdx)}
                onDuplicate={() => onDuplicateRow(rIdx)}
                onLookup={code => onLookup(rIdx, code)}
              />
            ))}
          </Stack>

          {(group.rows || []).length === 0 && (
            <Box sx={{ py: 3, textAlign: 'center', color: B.muted }}>
              <Typography sx={{ fontSize: 13 }}>No rows yet.</Typography>
            </Box>
          )}

          <Box sx={{ px: 2, py: 1, borderTop: `1px solid ${B.border}` }}>
            <Button
              size="small" onClick={onAddRow} startIcon={<AddCircleOutlineIcon sx={{ fontSize: 15 }} />}
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

// ─── Quote Row ───────────────────────────────────────────────────────────────
const tinyInput = {
  ...darkInput,
  '& .MuiOutlinedInput-root': {
    ...darkInput['& .MuiOutlinedInput-root'],
  },
  '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: '6px' },
  '& input[type=number]': {
    MozAppearance: 'textfield',
    '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
  },
};

function QuoteRow({ row, garmentType, activeQty, onChange, onRemove, onDuplicate, onLookup }) {
  const [expanded, setExpanded] = React.useState(false);
  const [shipAnchor, setShipAnchor] = React.useState(null);

  const cogs = calcCOGS(row, activeQty);
  const qty = activeQty ?? (Number(row.quantity) || 1);
  const lbPerPiece = GARMENT_WEIGHT_LB[garmentType] ?? 0.5;
  const totalLbs = lbPerPiece * qty;
  const estShip = estimateShipping(totalLbs);

  const numField = (val, key, extra = {}) => (
    <TextField
      size="small" type="number" value={val === 0 ? '' : (val ?? '')}
      onChange={e => onChange({ [key]: Number(e.target.value) || 0 })}
      sx={tinyInput} {...extra}
    />
  );
  const dollarAdorn = {
    startAdornment: (
      <InputAdornment position="start">
        <Typography sx={{ color: B.muted, fontSize: 11 }}>$</Typography>
      </InputAdornment>
    ),
  };

  return (
    <Box sx={{ minWidth: 1060 }}>
      {/* Top row */}
      <Box sx={{
        display: 'grid', gridTemplateColumns: ROW_COLS, gap: '4px',
        px: 2, py: 1, alignItems: 'center',
      }}>
        {/* Select */}
        <IconButton
          size="small" onClick={() => onChange({ selected: !row.selected })}
          sx={{ color: row.selected ? B.green : B.muted, p: 0.25 }}
        >
          {row.selected
            ? <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
            : <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />}
        </IconButton>

        {/* Tier badge */}
        <Tooltip title="Click to cycle tier">
          <Chip
            label={TIER_META[row.tier]?.label || 'MID'}
            size="small"
            onClick={() => {
              const order = ['budget', 'mid', 'premium'];
              const next = order[(order.indexOf(row.tier) + 1) % 3];
              onChange({ tier: next });
            }}
            sx={{
              height: 22, fontSize: 9.5, fontWeight: 800, cursor: 'pointer',
              bgcolor: (TIER_META[row.tier]?.color || B.mid) + '22',
              color: TIER_META[row.tier]?.color || B.mid,
              border: `1px solid ${(TIER_META[row.tier]?.color || B.mid)}55`,
            }}
          />
        </Tooltip>

        {/* Style code */}
        <TextField
          size="small" value={row.styleCode || ''}
          onChange={e => onChange({ styleCode: e.target.value })}
          onBlur={e => onLookup(e.target.value)}
          placeholder="Style" sx={tinyInput}
        />

        {/* Brand (read-only display) */}
        <Typography sx={{ color: B.muted, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.brand || '—'}
        </Typography>

        {/* Qty — read-only display when group uses qty tiers */}
        {activeQty != null
          ? <Typography sx={{ color: B.muted, fontSize: 12, fontFamily: 'monospace' }}>{activeQty}</Typography>
          : numField(row.quantity, 'quantity')}

        {/* Blank price */}
        {numField(row.blankPrice, 'blankPrice', { InputProps: dollarAdorn })}

        {/* Print type */}
        <FormControl size="small">
          <Select
            value={row.printType || 'Screen Printing'}
            onChange={e => onChange({ printType: e.target.value })}
            sx={{ ...selectSx, fontSize: 11 }}
          >
            {PRINT_TYPES.map(t => (
              <MenuItem key={t} value={t} sx={{ fontSize: 12 }}>{t}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Colors */}
        {numField(row.printColors, 'printColors',
          { sx: { ...tinyInput, '& .MuiInputBase-input': { ...tinyInput['& .MuiInputBase-input'], textAlign: 'center' } } })}

        {/* Locations */}
        {numField(row.locations, 'locations',
          { sx: { ...tinyInput, '& .MuiInputBase-input': { ...tinyInput['& .MuiInputBase-input'], textAlign: 'center' } } })}

        {/* Print/unit */}
        {numField(row.printCostPerUnit, 'printCostPerUnit', { InputProps: dollarAdorn })}

        {/* Setup */}
        {numField(row.setupCost, 'setupCost', { InputProps: dollarAdorn })}

        {/* Ship + estimator */}
        <Stack direction="row" spacing={0.2} alignItems="center">
          {numField(row.shippingCost, 'shippingCost',
            { InputProps: dollarAdorn, sx: { ...tinyInput, minWidth: 56 } })}
          <Tooltip title="Estimate shipping">
            <IconButton
              size="small" onClick={e => setShipAnchor(e.currentTarget)}
              sx={{ color: row.shippingCost ? B.green : B.muted, p: '2px' }}
            >
              <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(shipAnchor)} anchorEl={shipAnchor}
            onClose={() => setShipAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}
          >
            <Box sx={{ p: 2, bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, minWidth: 220 }}>
              <Typography sx={{ color: B.green, fontSize: 12, fontWeight: 700, mb: 1 }}>
                Shipping Estimator
              </Typography>
              <Stack spacing={0.5}>
                <EstRow label="Garment type" val={garmentType || '—'} />
                <EstRow label="Wt / piece" val={`${lbPerPiece} lb`} />
                <EstRow label="Qty" val={qty} />
                <EstRow label="Total weight" val={`${totalLbs.toFixed(1)} lb`} />
                <Divider sx={{ borderColor: B.border, my: 0.5 }} />
                <EstRow label="Estimated cost" val={`$${estShip}`} highlight />
              </Stack>
              <Button
                size="small" fullWidth
                onClick={() => { onChange({ shippingCost: estShip }); setShipAnchor(null); }}
                sx={{ mt: 1.5, bgcolor: B.green, color: B.greenDk, fontWeight: 700, fontSize: 11,
                  '&:hover': { bgcolor: '#86efac' } }}
              >
                Use ${estShip}
              </Button>
            </Box>
          </Popover>
        </Stack>

        {/* COGS */}
        <Typography sx={{ color: B.white, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
          {fmt(cogs)}
        </Typography>

        {/* Expand */}
        <IconButton size="small" onClick={() => setExpanded(v => !v)}
          sx={{ color: B.muted, p: 0.3 }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </IconButton>

        {/* Delete */}
        <IconButton size="small" onClick={onRemove}
          sx={{ color: B.muted, p: 0.3, '&:hover': { color: '#f87171' } }}>
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>

        {/* Duplicate */}
        <IconButton size="small" onClick={onDuplicate}
          sx={{ color: B.muted, p: 0.3, '&:hover': { color: B.mid } }}>
          <ContentCopyIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      {/* Margin strip */}
      <Box sx={{ px: 2, pb: 1, pt: 0.25 }}>
        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
          {MARGINS.map(pct => {
            const price = calcPrice(cogs, pct);
            const isSel = row.selectedMargin === pct;
            return (
              <Box
                key={pct}
                onClick={() => onChange({ selectedMargin: pct, selected: true })}
                sx={{
                  flex: '1 1 0', minWidth: 64, textAlign: 'center',
                  px: 0.5, py: 0.5, borderRadius: 1, cursor: 'pointer',
                  bgcolor: marginBg(pct),
                  border: isSel ? `2px solid ${B.green}` : `1px solid ${marginColor(pct)}33`,
                  transition: 'all 0.12s',
                  '&:hover': { transform: 'translateY(-1px)' },
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: marginColor(pct), lineHeight: 1.3 }}>
                  {pct}%
                </Typography>
                <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: B.white, lineHeight: 1.3 }}>
                  {fmt(price)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Collapse section */}
      <Collapse in={expanded}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ px: 2, pb: 1.5 }}>
          <TextField
            label="Garment Color" size="small" value={row.garmentColor || ''}
            onChange={e => onChange({ garmentColor: e.target.value })}
            sx={{ ...darkInput, minWidth: 200 }}
          />
          <TextField
            label="Notes" size="small" fullWidth value={row.notes || ''}
            onChange={e => onChange({ notes: e.target.value })}
            sx={{ ...darkInput, flex: 1 }}
          />
        </Stack>
      </Collapse>
    </Box>
  );
}

function EstRow({ label, val, highlight }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography sx={{ color: B.muted, fontSize: 11 }}>{label}</Typography>
      <Typography sx={{
        color: highlight ? B.green : B.white,
        fontSize: highlight ? 12 : 11,
        fontWeight: highlight ? 700 : 400,
      }}>
        {val}
      </Typography>
    </Stack>
  );
}

// ─── Add Group Dialog ────────────────────────────────────────────────────────
function AddGroupDialog({ open, onClose, garmentType, setGarmentType, qtyTiersInput, setQtyTiersInput, onAdd, suggesting, suggestErr }) {
  return (
    <Dialog
      open={open} onClose={onClose}
      PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, minWidth: 340 } }}
    >
      <DialogTitle sx={{ color: B.white, fontWeight: 700, fontSize: 16 }}>
        Add Garment Group
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: B.muted }}>Garment Type</InputLabel>
            <Select
              label="Garment Type" value={garmentType}
              onChange={e => setGarmentType(e.target.value)}
              sx={selectSx}
            >
              {GARMENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="Qty / Qty Tiers" size="small" value={qtyTiersInput}
            onChange={e => setQtyTiersInput(e.target.value)}
            placeholder="e.g. 48  or  25, 50, 75"
            sx={darkInput}
            helperText={
              <Typography component="span" sx={{ color: B.muted, fontSize: 11 }}>
                Single number = one qty. Comma-separated = qty tier tabs on the group.
              </Typography>
            }
          />
          <Typography sx={{ color: B.muted, fontSize: 12 }}>
            Creates 3 product tiers (Budget / Mid / Premium) auto-filled from your
            product database.
          </Typography>
          {suggestErr && (
            <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5', fontSize: 12 }}>
              {suggestErr}
            </Alert>
          )}
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

// ─── Page 3: Confirmation Page ───────────────────────────────────────────────
function ConfPage({ quote, onBack, onPrint, updateConfField, updateConfItem, removeConfItem, addCustomItem }) {
  const c = quote.confPage || {};
  const items = c.items || [];
  const [customOpen, setCustomOpen] = React.useState(false);

  const subtotal = items.reduce(
    (s, it) => s + sizeQty(it.sizeBreakdown) * (Number(it.unitPrice) || 0), 0);
  const method = c.paymentMethod || 'card';
  const pm = PAYMENT[method] || PAYMENT.other;
  const fee = subtotal * pm.rate;
  const total = subtotal + fee;

  return (
    <>
      <HeaderBar>
        <Button
          onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 14 }} />}
          sx={{ color: B.muted, fontWeight: 600, '&:hover': { color: B.green } }}
        >
          Quote
        </Button>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 16, letterSpacing: 0.5, ml: 1 }}>
          CONFIRMATION PAGE
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={onPrint} variant="contained" startIcon={<PrintOutlinedIcon />}
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, fontSize: 13,
            '&:hover': { bgcolor: '#86efac' } }}
        >
          Print
        </Button>
      </HeaderBar>

      <Box sx={{ position: 'absolute', inset: 0, pt: `${HEADER_H}px`, overflowY: 'auto', bgcolor: '#ffffff' }}>
        <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 4 }, color: '#111' }}>
          {/* Brand header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
            <img
              src="/jp-logo.png" height={55} alt=""
              onError={e => { e.target.style.display = 'none'; }}
            />
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>Joint Printing</Typography>
              <Typography sx={{ fontSize: 12, color: '#555' }}>jointprinting.com</Typography>
            </Box>
          </Stack>

          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, mt: 2 }}>
            CONFIRMATION PAGE
          </Typography>
          <Divider sx={{ my: 1.5, borderColor: '#ccc' }} />

          {/* Ship-to fields */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Ship to (Name)" size="small" fullWidth value={c.shippingName || ''}
              onChange={e => updateConfField('shippingName', e.target.value)}
            />
            <TextField
              label="Attn" size="small" fullWidth value={c.attentionName || ''}
              onChange={e => updateConfField('attentionName', e.target.value)}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1.5 }}>
            <TextField
              label="Street Address" size="small" fullWidth value={c.streetAddress || ''}
              onChange={e => updateConfField('streetAddress', e.target.value)}
            />
            <TextField
              label="City, State, Zip" size="small" fullWidth value={c.cityStateZip || ''}
              onChange={e => updateConfField('cityStateZip', e.target.value)}
            />
          </Stack>

          <Divider sx={{ my: 2, borderColor: '#ccc' }} />

          {/* Items */}
          <Stack spacing={1.5}>
            {items.map((item, idx) => (
              <ConfItemCard
                key={idx} item={item} idx={idx}
                onChange={patch => updateConfItem(idx, patch)}
                onRemove={() => removeConfItem(idx)}
              />
            ))}
          </Stack>
          {items.length === 0 && (
            <Typography sx={{ color: '#888', textAlign: 'center', py: 3 }}>
              No items. Add a custom item below.
            </Typography>
          )}

          <Button
            onClick={() => setCustomOpen(true)} fullWidth startIcon={<AddCircleOutlineIcon />}
            sx={{ mt: 1.5, color: '#16794a', border: '1px dashed #bbb', borderRadius: 2, py: 1.2,
              '&:hover': { borderColor: '#16794a', bgcolor: 'rgba(22,121,74,0.05)' } }}
          >
            Add Custom Item
          </Button>

          <Divider sx={{ my: 2, borderColor: '#ccc' }} />

          {/* Payment + totals */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Payment Method</InputLabel>
              <Select
                label="Payment Method" value={method}
                onChange={e => updateConfField('paymentMethod', e.target.value)}
              >
                {Object.entries(PAYMENT).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v.label}{v.rate ? ` (+${(v.rate * 100).toFixed(v.rate * 100 % 1 ? 1 : 0)}%)` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }} />
            <Stack spacing={0.5} sx={{ minWidth: 240 }}>
              <TotalLine label="Subtotal" val={`$${money(subtotal)}`} />
              {fee > 0 && <TotalLine label={`${pm.label} fee`} val={`+$${money(fee)}`} />}
              <Divider sx={{ borderColor: '#333', my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Grand Total</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16, fontFamily: 'monospace' }}>
                  ${money(total)}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Box>
      </Box>

      <CustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={(item) => { addCustomItem(item); setCustomOpen(false); }}
      />
    </>
  );
}

function TotalLine({ label, val }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography sx={{ fontSize: 13, color: '#555' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontFamily: 'monospace' }}>{val}</Typography>
    </Stack>
  );
}

// ─── Conf Item Card ──────────────────────────────────────────────────────────
function ConfItemCard({ item, idx, onChange, onRemove }) {
  const [open, setOpen] = React.useState(false);
  const bd = item.sizeBreakdown || {};
  const activeSizes = SIZE_OPTIONS.filter(s => (bd[s] || 0) > 0);
  const displaySizes = activeSizes.length ? activeSizes : ['S', 'M', 'L', 'XL'];
  const totalQty = sizeQty(bd);
  const unit = Number(item.unitPrice) || 0;
  const itemSub = totalQty * unit;

  const setSize = (size, val) =>
    onChange({ sizeBreakdown: { ...bd, [size]: Math.max(0, Number(val) || 0) } });

  const evenSplit = () => {
    const order = ['S', 'M', 'L', 'XL'];
    const base = Math.floor(totalQty / 4);
    let rem = totalQty - base * 4;
    const next = {};
    order.forEach(sz => { next[sz] = base; });
    if (rem > 0) { next.M += 1; rem -= 1; }
    if (rem > 0) { next.L += 1; rem -= 1; }
    onChange({ sizeBreakdown: next });
  };

  const mlHeavy = () => {
    const pcts = { S: 0.10, M: 0.30, L: 0.35, XL: 0.20, '2XL': 0.05 };
    const order = ['S', 'M', 'L', 'XL', '2XL'];
    const next = {};
    let assigned = 0;
    order.forEach(sz => {
      next[sz] = Math.round(totalQty * pcts[sz]);
      assigned += next[sz];
    });
    next.L += totalQty - assigned; // remainder absorbed into L
    onChange({ sizeBreakdown: next });
  };

  const name = item.fromQuoter
    ? (`${item.brand || ''} ${item.styleCode || ''}`.trim() || item.label || `Item ${idx + 1}`)
    : (item.productName || item.label || `Item ${idx + 1}`);

  return (
    <Box sx={{ border: '1px solid #ddd', borderRadius: 1.5, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1}
        sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5' }}>
        <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{name}</Typography>
        <Typography sx={{ fontSize: 13, color: '#555' }}>{totalQty} pcs</Typography>
        <Typography sx={{ fontSize: 13, fontFamily: 'monospace' }}>${money(unit)}</Typography>
        <Typography sx={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>
          ${money(itemSub)}
        </Typography>
        <IconButton size="small" onClick={() => setOpen(v => !v)}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={onRemove} sx={{ '&:hover': { color: '#c0392b' } }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Collapse in={open}>
        <Box sx={{ p: 1.5 }}>
          {/* Size breakdown */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            {displaySizes.map(sz => (
              <TextField
                key={sz} label={sz} size="small" type="number"
                value={bd[sz] || ''}
                onChange={e => setSize(sz, e.target.value)}
                sx={{ width: 76 }}
                InputProps={{ inputProps: { min: 0 } }}
              />
            ))}
          </Stack>

          {/* Presets */}
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Button size="small" variant="outlined" onClick={evenSplit}
              disabled={totalQty === 0}>
              Even Split
            </Button>
            <Button size="small" variant="outlined" onClick={mlHeavy}
              disabled={totalQty === 0}>
              M/L Heavy
            </Button>
          </Stack>

          {/* Overrides */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Unit Price ($)" size="small" type="number"
              value={item.unitPrice || ''}
              onChange={e => onChange({ unitPrice: Number(e.target.value) || 0 })}
              sx={{ width: { xs: '100%', sm: 160 } }}
            />
            <TextField
              label="Notes" size="small" fullWidth value={item.notes || ''}
              onChange={e => onChange({ notes: e.target.value })}
            />
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

// ─── Custom Item Dialog ──────────────────────────────────────────────────────
function CustomItemDialog({ open, onClose, onAdd }) {
  const [label, setLabel] = React.useState('');
  const [qty, setQty] = React.useState(1);
  const [unitPrice, setUnitPrice] = React.useState(0);
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (open) { setLabel(''); setQty(1); setUnitPrice(0); setNotes(''); }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { minWidth: 340 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Add Custom Item</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Item Name" size="small" autoFocus value={label}
            onChange={e => setLabel(e.target.value)}
          />
          <TextField
            label="Quantity" size="small" type="number" value={qty}
            onChange={e => setQty(Number(e.target.value) || 0)}
          />
          <TextField
            label="Unit Price ($)" size="small" type="number" value={unitPrice}
            onChange={e => setUnitPrice(Number(e.target.value) || 0)}
          />
          <TextField
            label="Notes" size="small" value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: '#777' }}>Cancel</Button>
        <Button
          onClick={() => onAdd({ label, qty, unitPrice, notes })}
          disabled={!label.trim()} variant="contained"
          sx={{ bgcolor: '#16794a', fontWeight: 700, '&:hover': { bgcolor: '#1a8f57' } }}
        >
          Add Item
        </Button>
      </DialogActions>
    </Dialog>
  );
}
