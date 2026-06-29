// src/screens/studio/FinancesTab.js
//
// The finance tracker UI: P&L, %-of-spend by category, per-order margins, and a
// transactions log where each entry can carry its stored receipt/invoice. Pay a
// bill → "Add" → upload the receipt + enter the ACTUAL amount → it files the
// receipt and books the cost into the ledger + analytics in one step (replacing
// the manual "download invoice → personal Drive" habit). Reads /api/finances.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, FormControl, Select, MenuItem, CircularProgress,
  Dialog, DialogContent, TextField,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import axios from 'axios';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import config from '../../config.json';
import { B, darkInput, scrollbar, mono } from './_shared';
import { useContextMenu } from './ContextMenu';
import { buildTransactionMenu, buildFallbackMenu } from './contextMenuActions';
import FinanceRestartView from './FinanceRestartView';
import FinanceDedupeView from './FinanceDedupeView';

const base = `${config.backendUrl}/api`;
// money()/pct() are the ONLY places a number reaches the screen — they hard-coerce
// to a finite number first (Number(n) || 0 turns NaN/undefined/null/'' → 0), so no
// odd/missing value can ever render "$NaN" or white-screen the finance tab.
const money = (n) => {
  const v = Number(n);
  return `$${(Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
// A percentage for display — finite-guarded the same way (a bad value shows 0%).
const pct = (n) => { const v = Number(n); return Number.isFinite(v) ? v : 0; };
// Mirror the backend round2 EXACTLY (it adds Number.EPSILON) so the previewed
// processing fee equals the cent the backend books — without the epsilon, certain
// half-cent amounts (e.g. a 1% ACH fee on $14.50) would preview a cent low.
const round = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
// Safe YYYY-MM-DD for display — new Date(bad).toISOString() THROWS, which would
// white-screen the whole tab over one row with a missing/garbage date. Returns an
// em dash for anything unparseable so the ledger always renders.
const ymd = (d) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : '—';
};
const CATEGORIES = [
  'Customer Sales', 'Blank COGS', 'Printer COGS', 'Shipping', 'Art', 'Commission',
  'Processing Fee', 'Software', 'Owner Draw', 'Owner Contribution', 'Sales Tax', 'Refund', 'Other',
];
// COGS categories that net against an order's revenue — MUST match the backend
// Transaction.COGS_CATEGORIES so the drill-in profit reconciles with by-order.
const COGS_CATEGORIES = ['Blank COGS', 'Printer COGS', 'Shipping', 'Art', 'Commission', 'Processing Fee'];
// Merchant processing-fee rates (fractions of the payment) — MUST match the backend
// Transaction.PROCESSING_FEE_RATES so the fee the UI previews equals the one booked.
const PROCESSING_FEE_RATES = { cc: 0.0299, ach: 0.01, none: 0 };
const FEE_METHOD_LABEL = { cc: 'Credit card (2.99%)', ach: 'ACH / bank (1%)', none: 'No fee (cash / check)' };
// Canonical order-number key — strips non-digits AND leading zeros, mirroring the
// backend controllers/finances.js normalizeOrderNumber so the drill-in groups a
// "0000021" row and a "21" row into the one order the by-order list keys by.
const normOrderNo = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '').replace(/^0+/, '');
// Signed amount within a row's type bucket (credit reverses direction) — matches
// backend signed(): an income credit nets revenue down, an expense credit nets cost down.
const signedAmt = (t) => (t && t.isCredit ? -(Number(t.amount) || 0) : (Number(t.amount) || 0));
const CAT_COLOR = {
  'Blank COGS': '#60a5fa', 'Printer COGS': '#a78bfa', 'Shipping': '#2dd4bf', 'Art': '#f472b6',
  'Commission': '#fbbf24', 'Processing Fee': '#34d399', 'Software': '#f97316', 'Owner Draw': '#9ca3af',
  'Sales Tax': '#ef4444', 'Refund': '#fb7185', 'Other': '#6b7280',
  // Operating-expense categories the budget restart introduces (not order COGS).
  'Marketing': '#e879f9', 'Travel/Field': '#38bdf8', 'Accounting': '#facc15',
};
// Is this row money coming IN to the business? Income is normally in; a credit
// flips it — an income credit (customer refund) is money OUT, an expense credit
// (supplier credit) is money IN. Drives the +/− sign and colour in the ledger.
const isInflow = (t) => (t.type === 'income') !== !!t.isCredit;

export default function FinancesTab({ token, onBack, onNavigate }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const { bind: bindMenu, registerFallback } = useContextMenu();
  const [year, setYear]       = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [orders, setOrders]   = useState([]);
  const [txns, setTxns]       = useState([]);
  const [months, setMonths]   = useState([]);
  const [clients, setClients] = useState([]);
  const [gaps, setGaps]       = useState(null);
  // In-progress orders (paid or in production) missing a cost receipt I haven't
  // entered yet — printer / blanks / shipping. From /api/finances/missing-receipts.
  const [needsReceipts, setNeedsReceipts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState('');
  const [showAdd, setShowAdd] = useState(false);
  // Prefill for "record payment for this order" — opens the Add-transaction
  // modal already set to Income · Customer Sales · the order's client + amount.
  const [prefill, setPrefill] = useState(null);
  const [editTxn, setEditTxn] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);
  // The "Restart finances from my budgets" surface (preview→confirm→apply, reversible).
  // A full-screen sub-view, mirroring the CRM ReconcileView pattern.
  const [showRestart, setShowRestart] = useState(false);
  // "Restart from my budgets" is a ONE-TIME tool. Once it's applied (a finance
  // restart batch exists), the prominent header button auto-hides — it stays
  // reachable as a small, quiet link tucked next to the year picker. null = unknown
  // (treated as "not yet applied" so the button shows until we hear otherwise).
  const [restartApplied, setRestartApplied] = useState(false);
  // The "Review duplicate transactions" surface (merge cross-source dupes the budget
  // restart left behind; preview→confirm→apply, reversible). A full-screen sub-view,
  // mirroring the CRM CleanupView pattern. Its entry point auto-HIDES when there are
  // zero duplicate pairs (the live count drives visibility — no dupes, no clutter).
  const [showDedupe, setShowDedupe] = useState(false);
  const [dedupeCount, setDedupeCount] = useState(0);
  const [bannerDismiss, setBannerDismiss] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jpFinBanner') || 'null'); } catch (_) { return null; }
  });
  const [bannerLeaving, setBannerLeaving] = useState(false);
  const fileRef = useRef(null);

  // Has a finance restart ever been applied? Cheap status check on mount; a failure
  // just leaves the button visible (safe default). Re-checked when the restart view
  // closes (so applying it this session hides the prominent button right after).
  const loadRestartStatus = useCallback(async () => {
    try {
      const r = await axios.get(`${base}/finances/restart/status`, authHdr);
      setRestartApplied(!!(r.data && r.data.applied));
    } catch (_) { /* leave as-is; the button stays available */ }
  }, [authHdr]);

  // How many cross-source duplicate pairs are in the ledger right now? Drives whether
  // the "Review duplicates" entry shows at all (auto-hidden at zero). Cheap preview
  // read; a failure just hides the entry (safe default). Re-checked when the dedupe
  // view closes (so merging this session updates/hides the entry right after).
  const loadDedupeCount = useCallback(async () => {
    try {
      const r = await axios.get(`${base}/finances/dedupe/preview`, authHdr);
      const n = (r.data && r.data.summary && r.data.summary.duplicatePairs) || 0;
      setDedupeCount(Number(n) || 0);
    } catch (_) { setDedupeCount(0); /* hide the entry on failure */ }
  }, [authHdr]);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const [s, o, t, m, c, g, nr] = await Promise.all([
        axios.get(`${base}/finances/summary`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-order`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/transactions`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-month`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-client`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/payment-gaps`, { ...authHdr, params: { year } }),
        // In-progress orders missing a cost receipt — current by nature, not year-scoped.
        // Guarded so a momentary backend gap (e.g. right after a deploy, before the
        // route is live) can't reject the whole load and blank out the finance tab.
        axios.get(`${base}/finances/missing-receipts`, authHdr).catch(() => ({ data: null })),
      ]);
      // Coerce every list to an array of non-null rows at the boundary, so no
      // downstream .map can hit a null row and white-screen the tab regardless of
      // what the API returns. (The backend is also hardened, but this is belt-and-
      // suspenders for the screen the owner is actively using.)
      const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
      setSummary(s.data || null);
      setOrders(arr(o.data && o.data.orders));
      setTxns(arr(t.data && t.data.transactions));
      setMonths(arr(m.data && m.data.months));
      setClients(arr(c.data && c.data.clients));
      setGaps(g.data || null);
      setNeedsReceipts(nr.data || null);
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  }, [authHdr, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRestartStatus(); }, [loadRestartStatus]);
  useEffect(() => { loadDedupeCount(); }, [loadDedupeCount]);

  const exportCsv = async () => {
    try {
      const r = await axios.get(`${base}/finances/export`, { ...authHdr, params: { year }, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `JP-Ledger-${year}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };
  const importCsv = async (file) => {
    if (!file) return;
    setBusy('Importing…');
    try {
      const csv = await file.text();
      const r = await axios.post(`${base}/finances/import`, { csv }, authHdr);
      setBusy(`Imported ${r.data.imported} rows ✓`); await load();
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };
  const addTxn = async (form) => {
    await axios.post(`${base}/finances/transactions`, form, authHdr);
    setShowAdd(false); await load();
  };
  const saveTxn = async (form) => {
    await axios.put(`${base}/finances/transactions/${editTxn._id}`, form, authHdr);
    setEditTxn(null); await load();
  };
  const deleteTxn = async () => {
    if (!window.confirm('Delete this transaction?')) return;
    await axios.delete(`${base}/finances/transactions/${editTxn._id}`, authHdr);
    setEditTxn(null); await load();
  };

  // Delete a SPECIFIC transaction (used by the right-click menu, which already
  // confirms). Mirrors deleteTxn but targets the passed row instead of editTxn.
  const deleteTxnById = async (t) => {
    if (!t || !t._id) return;
    try {
      await axios.delete(`${base}/finances/transactions/${t._id}`, authHdr);
      if (editTxn && editTxn._id === t._id) setEditTxn(null);
      await load();
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };

  // ── Right-click menu wiring ───────────────────────────────────────────────
  // bindTxn(transaction) → props a ledger row spreads onto its <tr>. Edit reuses
  // the existing edit dialog; delete uses the row-targeted helper above.
  const bindTxn = (t) => bindMenu(() => buildTransactionMenu(t, {
    onEdit: (txn) => setEditTxn(txn),
    onDelete: deleteTxnById,
  }));

  useEffect(() => registerFallback(() => buildFallbackMenu({
    onBackToHub: onBack,
  })), [registerFallback, onBack]);

  // ── Cross-tab deep links OUT (additive) ──────────────────────────────────────
  // The order # on any finance row jumps to that order's project page; the client
  // name jumps to its CRM card. The CRM jump needs an authoritative companyKey —
  // the by-order API now returns one per row (Order join on the canonical number,
  // '' when ambiguous/unknown). We index it by canonical order # so a transaction
  // row (which carries only an order # + a party name) can resolve the SAME key.
  const ckByOrder = useMemo(() => {
    const m = {};
    (orders || []).forEach((o) => {
      const k = normOrderNo(o && o.orderNumber);
      if (k && o.companyKey) m[k] = o.companyKey;   // '' keys are intentionally skipped (not linkable)
    });
    return m;
  }, [orders]);
  const goOrder = useCallback((orderNumber) => {
    const k = normOrderNo(orderNumber);
    if (!onNavigate || !k) return;
    onNavigate({ view: 'clients', orderNumber: k });
  }, [onNavigate]);
  const goCompanyForOrder = useCallback((orderNumber) => {
    const ck = ckByOrder[normOrderNo(orderNumber)];
    if (!onNavigate || !ck) return;
    onNavigate({ view: 'crm', companyKey: ck });
  }, [onNavigate, ckByOrder]);
  // The by-client API now carries an authoritative companyKey per row, so a Top
  // Clients name deep-links straight to its CRM card (no dead-end). '' = not linkable.
  const goCompanyByKey = useCallback((ck) => {
    if (!onNavigate || !ck) return;
    onNavigate({ view: 'crm', companyKey: ck });
  }, [onNavigate]);

  const expenses = summary ? Object.entries(summary.expenseByCategory || {}).sort((a, b) => b[1] - a[1]) : [];
  const empty = !summary || (summary.income === 0 && summary.expense === 0 && txns.length === 0);

  // #1 alarm: an order that was sold but lost money (revenue in, profit negative).
  // Orders with no recorded sale yet (revenue 0) aren't losses — they're pending.
  const losers = (orders || []).filter((o) => o.revenue > 0 && o.profit < 0);
  const lossTotal = losers.reduce((s, o) => s + Math.abs(o.profit), 0);
  // Banner shows ONLY when something needs you — pristine (no banner) when all's
  // well. RED = a sold order lost money; AMBER = merch net negative.
  const showBanner = losers.length > 0 || (summary && summary.net < 0);
  const bannerState = losers.length > 0 ? 'red' : 'amber';
  const bannerSig = `${year}|${bannerState}|${losers.map((o) => o.orderNumber).join(',')}`;
  const today = new Date().toISOString().slice(0, 10);
  // RED is critical — never dismissable (no ✕). AMBER clears for the day, returns.
  const bannerHidden = bannerState !== 'red' && bannerDismiss && bannerDismiss.sig === bannerSig && bannerDismiss.date === today;
  const dismissBanner = () => {
    const d = { sig: bannerSig, date: today };
    try { localStorage.setItem('jpFinBanner', JSON.stringify(d)); } catch (_) {}
    setBannerDismiss(d);
  };

  // The restart surface takes over the whole tab (its own back button returns
  // here). On apply it reloads the finance data so the page shows the new truth.
  if (showRestart) {
    return (
      <FinanceRestartView
        token={token}
        onBack={() => { setShowRestart(false); loadRestartStatus(); }}
        onApplied={() => { load(); loadRestartStatus(); }}
      />
    );
  }

  // The "Review duplicate transactions" surface also takes over the whole tab. On a
  // merge it reloads the finance data (the merged amount now counts once) and the
  // duplicate count (so the entry hides once everything is merged).
  if (showDedupe) {
    return (
      <FinanceDedupeView
        token={token}
        onBack={() => { setShowDedupe(false); loadDedupeCount(); }}
        onApplied={() => { load(); loadDedupeCount(); }}
      />
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white,
      '@keyframes jpBannerIn':  { from: { opacity: 0, transform: 'translateY(-8px)' },  to: { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes jpBannerOut': { from: { opacity: 1, transform: 'translateY(0)' },     to: { opacity: 0, transform: 'translateY(-12px)' } },
      '@keyframes jpRise':      { from: { opacity: 0, transform: 'translateY(10px)' },   to: { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes jpGrowX':     { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      '@keyframes jpGrowY':     { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: B.panel, borderBottom: `1px solid ${B.border}`,
        px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
          sx={{ textTransform: 'none', color: B.muted, fontWeight: 600, minWidth: 'auto', px: 1, fontSize: 12,
            '&:hover': { color: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>Studio</Button>
        <Typography sx={{ color: B.green, fontWeight: 800, fontSize: 14, flex: 1 }}>Finances</Typography>
        {busy && <Typography sx={{ fontSize: 11, color: busy.includes('✓') ? B.green : B.muted }}>{busy}</Typography>}
        {/* "Review duplicate transactions" — shown ONLY when the ledger actually has
            cross-source duplicate pairs (auto-hides at zero). One tap opens the merge
            surface; the count keeps it honest. */}
        {dedupeCount > 0 && (
          <Button onClick={() => setShowDedupe(true)} size="small" startIcon={<MergeTypeOutlinedIcon sx={{ fontSize: 16 }} />}
            title="Merge duplicate transactions left by the budget restart (preview first — reversible)"
            sx={{ color: '#06281a', bgcolor: B.green, textTransform: 'none', fontWeight: 800, fontSize: 12, px: 1.5,
              '&:hover': { bgcolor: '#3cc56f' } }}>
            Review duplicates ({dedupeCount})
          </Button>
        )}
        <Button onClick={() => setShowAdd(true)} size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
          sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Add</Button>
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <Select value={year} onChange={(e) => setYear(e.target.value)}
            sx={{ color: B.white, fontSize: 13, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', '& .MuiSvgIcon-root': { color: B.muted } }}>
            {[2024, 2025, 2026, 2027].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            <MenuItem value="">All</MenuItem>
          </Select>
        </FormControl>
        {/* CSV import is a ONE-TIME bulk load. Once the ledger has any rows it
            auto-hides — going forward, entries are added individually (Add). */}
        {txns.length === 0 && (
          <>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; importCsv(f); }} />
            <IconButton size="small" title="Import JP Ledger CSV" onClick={() => fileRef.current?.click()}
              sx={{ color: B.muted, '&:hover': { color: B.green } }}><FileUploadOutlinedIcon fontSize="small" /></IconButton>
          </>
        )}
        <IconButton size="small" title="Export CSV" onClick={exportCsv}
          sx={{ color: B.muted, '&:hover': { color: B.green } }}><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
        {/* "Restart from budgets" is a one-time, destructive rebuild. Before it's
            ever applied it's a prominent button; once applied it's hidden — leaving a
            mystery ↻ circle in the daily finance bar was just clutter. (Still fully
            available + reversible; resurface it on request if you ever need to re-run.) */}
        {!restartApplied && (
          <Button onClick={() => setShowRestart(true)} size="small" startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            title="Rebuild your finances from your budget trackers (preview first — reversible)"
            sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, fontSize: 12, '&:hover': { color: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>
            Restart from budgets
          </Button>
        )}
      </Box>

      <Box data-ctx-chrome sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: B.green }} /></Box>
        ) : empty ? (
          <Box sx={{ border: '1px dashed rgba(255,255,255,0.14)', borderRadius: 3, py: 6, textAlign: 'center', color: B.muted }}>
            <Typography sx={{ fontSize: 13, mb: 1 }}>No transactions for {year || 'any year'} yet.</Typography>
            <Stack direction="row" gap={1} justifyContent="center">
              <Button onClick={() => fileRef.current?.click()} startIcon={<FileUploadOutlinedIcon />}
                sx={{ color: B.green, textTransform: 'none', fontWeight: 700 }}>Import ledger CSV</Button>
              <Button onClick={() => setShowAdd(true)} startIcon={<AddCircleOutlineIcon />}
                sx={{ color: B.green, textTransform: 'none', fontWeight: 700 }}>Add one</Button>
            </Stack>
            <Typography sx={{ fontSize: 11, mt: 1 }}>From the ledger Sheet: File → Download → CSV, then import here.</Typography>
          </Box>
        ) : (
          <Stack gap={2.5}>
            {/* Status banner — shows ONLY when something needs you (pristine when fine):
                RED   a sold order lost money (critical — no ✕, always shows)
                AMBER merch net negative (dismissable for the day; returns next day / on change)
                Animated in/out; the ✕ spins on hover for a satisfying dismiss. */}
            {showBanner && !bannerHidden && (
            <Box sx={{ position: 'relative',
              animation: bannerLeaving ? 'jpBannerOut 260ms ease forwards' : 'jpBannerIn 360ms cubic-bezier(.2,.7,.3,1) both' }}>
              {bannerState !== 'red' && (
                <IconButton size="small" title="Dismiss for today"
                  onClick={() => { setBannerLeaving(true); setTimeout(() => { dismissBanner(); setBannerLeaving(false); }, 250); }}
                  sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, color: B.muted,
                    transition: 'transform 220ms ease, color 220ms ease',
                    '&:hover': { color: B.white, transform: 'rotate(90deg) scale(1.12)' } }}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            {losers.length > 0 ? (
              <Box sx={{ border: '1px solid rgba(248,113,113,0.4)', bgcolor: 'rgba(248,113,113,0.07)', borderRadius: 2, px: 2, py: 1.25 }}>
                <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 0.75 }}>
                  <ErrorOutlineIcon sx={{ color: '#f87171' }} />
                  <Typography sx={{ color: '#f87171', fontWeight: 800, fontSize: 14, flex: 1 }}>
                    {losers.length} order{losers.length > 1 ? 's' : ''} lost money — {money(lossTotal)} underwater
                  </Typography>
                </Stack>
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ pl: 4 }}>
                  {losers.map((o) => (
                    <Box key={o.orderNumber} onClick={() => setOpenOrder(o.orderNumber)}
                      sx={{ fontSize: 11, color: B.muted, bgcolor: 'rgba(255,255,255,0.04)', cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1, px: 0.75, py: 0.25,
                      '&:hover': { borderColor: 'rgba(248,113,113,0.55)' } }}>
                      #{o.orderNumber}{o.client ? ` · ${o.client}` : ''}{' '}
                      <Box component="span" sx={{ color: '#f87171', fontWeight: 700 }}>{money(o.profit)}</Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, border: '1px solid rgba(251,191,36,0.4)',
                bgcolor: 'rgba(251,191,36,0.06)', borderRadius: 2, px: 2, py: 1.25 }}>
                <ErrorOutlineIcon sx={{ color: '#fbbf24', mt: 0.2 }} />
                <Box>
                  <Typography sx={{ color: '#fbbf24', fontWeight: 800, fontSize: 14 }}>
                    Merch is in the red — −{money(Math.abs(summary.net))} {year ? `in ${year}` : 'overall'}
                  </Typography>
                  <Typography sx={{ color: B.muted, fontSize: 12 }}>
                    No single order lost money, but costs are outpacing sales this period.
                  </Typography>
                </Box>
              </Box>
            )}
            </Box>
            )}

            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' },
              '& > *': { animation: 'jpRise 460ms ease both' },
              '& > *:nth-of-type(2)': { animationDelay: '70ms' },
              '& > *:nth-of-type(3)': { animationDelay: '140ms' },
              '& > *:nth-of-type(4)': { animationDelay: '210ms' } }}>
              <Stat label="Revenue" value={money(summary.income)} color={B.white} />
              <Stat label="Expenses" value={money(summary.expense)} color="#f87171" />
              <Stat label="Net profit" value={money(summary.net)} color={summary.net >= 0 ? B.green : '#f87171'} big />
              <Stat label="Margin" value={`${pct(summary.margin)}%`} color={pct(summary.margin) >= 0 ? B.green : '#f87171'} />
            </Box>
            {/* Owner cash lens — profit (earned), take-home (draws), and any owner
                contribution. Profit stays draw-excluded (correct for taxes). Numbers
                + labels only; the figures speak for themselves. Shown whenever
                there's a draw or a contribution to report. */}
            {(summary.ownerDraw > 0 || summary.ownerContribution > 0) && (
              <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>Your money</Typography>
                <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'repeat(2,1fr)', md: summary.ownerContribution > 0 ? 'repeat(3,1fr)' : 'repeat(2,1fr)' } }}>
                  <Stat label="Profit (earned)" value={money(summary.net)} color={summary.net >= 0 ? B.green : '#f87171'} />
                  <Stat label="Take-home (draws)" value={money(summary.takeHome)} color={B.white} />
                  {summary.ownerContribution > 0 && (
                    <Stat label="Owner contribution" value={money(summary.ownerContribution)} color={B.white} />
                  )}
                </Box>
              </Box>
            )}

            {/* Money owed to you / Unrecorded payments — the additive lens that
                EXPLAINS a low net: vendor costs entered without the matching
                client payment. One tap records the missing income, prefilled. */}
            <PaymentGaps gaps={gaps}
              onOpenOrder={onNavigate ? (orderNumber) => goOrder(orderNumber) : undefined}
              onOpenClient={onNavigate ? (orderNumber) => goCompanyForOrder(orderNumber) : undefined}
              canOpenClient={(orderNumber) => !!ckByOrder[normOrderNo(orderNumber)]}
              onRecord={(row) => setPrefill({
              type: 'income', category: 'Customer Sales',
              party: row.client && row.client !== '—' ? row.client : '',
              amount: row.outstanding > 0 ? row.outstanding : (row.billed > 0 ? row.billed : ''),
              orderNumber: row.orderNumber,
              description: `Payment — order #${row.orderNumber}${row.client && row.client !== '—' ? ` · ${row.client}` : ''}`,
            })} />

            {/* In-progress orders missing a cost receipt I haven't entered yet
                (printer / blanks / shipping). One tap opens the expense modal
                prefilled for that order. */}
            <NeedsReceipts data={needsReceipts}
              onOpenOrder={onNavigate ? (orderNumber) => goOrder(orderNumber) : undefined}
              onAdd={(row) => setPrefill({
                type: 'expense',
                category: (row.missing && row.missing[0]) || 'Printer COGS',
                party: '',
                amount: '',
                orderNumber: row.orderNumber,
                description: `${(row.missingLabels && row.missingLabels[0]) || 'cost'} receipt — order #${row.orderNumber}${row.client && row.client !== '—' ? ` · ${row.client}` : ''}`,
              })} />

            <MonthlyTrend months={months} />

            <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.25 }}>Where the money goes</Typography>
              <Stack gap={1}>
                {expenses.map(([cat, amt]) => {
                  const share = pct(summary.pctOfSpend?.[cat]);
                  return (
                    <Box key={cat}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
                        <Typography sx={{ color: B.white, fontSize: 12 }}>{cat}</Typography>
                        <Typography sx={{ color: B.muted, fontSize: 12, fontFamily: 'monospace' }}>{money(amt)} · {share}%</Typography>
                      </Stack>
                      <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <Box sx={{ width: `${Math.max(0, Math.min(100, share))}%`, height: '100%', bgcolor: CAT_COLOR[cat] || B.green,
                          transformOrigin: 'left', animation: 'jpGrowX 700ms cubic-bezier(.2,.7,.3,1) both' }} />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            <TopClients clients={clients} onClient={goCompanyByKey} />

            <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, px: 1.5, pt: 1.25, pb: 0.5 }}>Profit by order ({orders.length})</Typography>
              <Box sx={{ overflowX: 'auto', ...scrollbar }}>
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <Box component="thead">
                    <Box component="tr" sx={{ '& th': { color: B.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', textAlign: 'right', py: 0.75, px: 1.25, whiteSpace: 'nowrap' } }}>
                      <Box component="th" sx={{ textAlign: 'left !important' }}>Order</Box>
                      <Box component="th" sx={{ textAlign: 'left !important' }}>Client</Box>
                      <Box component="th">Revenue</Box><Box component="th">Cost</Box><Box component="th">Profit</Box><Box component="th">Margin</Box>
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {orders.map((o) => {
                      // The row still drills into the in-tab order ledger (unchanged).
                      // Two ADDITIVE deep links sit on top: the order # opens the
                      // order's project page; the client name opens its CRM card
                      // (only when an authoritative companyKey resolved).
                      const canOrder = !!onNavigate && !!normOrderNo(o.orderNumber);
                      const ck = ckByOrder[normOrderNo(o.orderNumber)];
                      const canClient = !!onNavigate && !!ck && !!o.client;
                      return (
                      <Box component="tr" key={o.orderNumber} onClick={() => setOpenOrder(o.orderNumber)}
                        sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.035)' }, '& td': { py: 0.7, px: 1.25, textAlign: 'right', ...mono, whiteSpace: 'nowrap' } }}>
                        <Box component="td" sx={{ textAlign: 'left !important', color: canOrder ? B.green : B.muted }}>
                          <Box component="span"
                            onClick={canOrder ? (e) => { e.stopPropagation(); goOrder(o.orderNumber); } : undefined}
                            title={canOrder ? 'Open this order' : undefined}
                            sx={{ cursor: canOrder ? 'pointer' : 'inherit', '&:hover': canOrder ? { textDecoration: 'underline' } : undefined }}>
                            #{o.orderNumber}
                          </Box>
                        </Box>
                        <Box component="td" sx={{ textAlign: 'left !important', color: B.white, fontFamily: 'inherit !important', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {canClient ? (
                            <Box component="span"
                              onClick={(e) => { e.stopPropagation(); goCompanyForOrder(o.orderNumber); }}
                              title="Open this client's CRM card"
                              sx={{ color: B.green, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                              {o.client}
                            </Box>
                          ) : (o.client || '—')}
                        </Box>
                        <Box component="td" sx={{ color: B.white }}>{money(o.revenue)}</Box>
                        <Box component="td" sx={{ color: '#f87171' }}>{money(o.cost)}</Box>
                        <Box component="td" sx={{ color: o.profit >= 0 ? B.green : '#f87171' }}>{money(o.profit)}</Box>
                        <Box component="td" sx={{ color: pct(o.margin) >= 0 ? B.green : '#f87171' }}>{pct(o.margin)}%</Box>
                      </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Transactions log + receipts */}
            <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, px: 1.5, pt: 1.25, pb: 0.5 }}>Transactions ({txns.length})</Typography>
              <Box sx={{ maxHeight: 460, overflowY: 'auto', ...scrollbar }}>
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <Box component="tbody">
                    {txns.slice().reverse().map((t) => (
                      <Box component="tr" key={t._id} onClick={() => setEditTxn(t)} {...bindTxn(t)}
                        sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                        <Box component="td" sx={{ py: 0.6, px: 1.25, color: B.muted, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>{ymd(t.date)}</Box>
                        <Box component="td" sx={{ py: 0.6, px: 0.5, whiteSpace: 'nowrap' }}>
                          <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 1, fontSize: 10, fontWeight: 700,
                            color: t.type === 'income' ? B.green : '#f87171', bgcolor: t.type === 'income' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)' }}>
                            {t.category}
                          </Box>
                          {t.isCredit && <CreditBadge />}
                        </Box>
                        <Box component="td" sx={{ py: 0.6, px: 1, color: B.white, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(() => {
                            // The order # on a transaction links to its order page
                            // (link #6); the party name links to that order's CRM
                            // card when an authoritative companyKey resolves. Both
                            // stop propagation so the row's own edit-open still works.
                            const canOrder = !!onNavigate && !!normOrderNo(t.orderNumber);
                            const ck = ckByOrder[normOrderNo(t.orderNumber)];
                            const canClient = !!onNavigate && !!ck && t.type === 'income' && !!t.party;
                            const nameNode = canClient ? (
                              <Box component="span"
                                onClick={(e) => { e.stopPropagation(); goCompanyForOrder(t.orderNumber); }}
                                title="Open this client's CRM card"
                                sx={{ color: B.green, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                                {t.party}
                              </Box>
                            ) : (t.party || t.description);
                            return (
                              <>
                                {nameNode}
                                {t.orderNumber ? (
                                  <Box component="span" sx={{ color: canOrder ? B.green : B.muted }}> · {
                                    canOrder ? (
                                      <Box component="span"
                                        onClick={(e) => { e.stopPropagation(); goOrder(t.orderNumber); }}
                                        title={`Open order #${t.orderNumber}`}
                                        sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                                        #{t.orderNumber}
                                      </Box>
                                    ) : `#${t.orderNumber}`
                                  }</Box>
                                ) : null}
                              </>
                            );
                          })()}
                        </Box>
                        <Box component="td" sx={{ py: 0.6, px: 1, textAlign: 'right', ...mono, whiteSpace: 'nowrap', color: isInflow(t) ? B.green : '#f87171' }}>
                          {isInflow(t) ? '+' : '−'}{money(t.amount)}
                        </Box>
                        <Box component="td" sx={{ py: 0.6, px: 1, width: 28, textAlign: 'center' }}>
                          {t.receiptUrl
                            ? <a href={t.receiptUrl} target="_blank" rel="noreferrer" title="View receipt" onClick={(e) => e.stopPropagation()} style={{ color: B.green, display: 'inline-flex' }}><ReceiptLongOutlinedIcon sx={{ fontSize: 15 }} /></a>
                            : null}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Stack>
        )}
      </Box>

      {(showAdd || prefill) && (
        <TxnDialog token={token} prefill={prefill}
          onClose={() => { setShowAdd(false); setPrefill(null); }}
          onSave={async (form) => { await addTxn(form); setPrefill(null); }} />
      )}
      {editTxn && <TxnDialog token={token} txn={editTxn} onClose={() => setEditTxn(null)} onSave={saveTxn} onDelete={deleteTxn} />}
      {openOrder && <OrderDialog orderNumber={openOrder} txns={txns} onClose={() => setOpenOrder(null)}
        onEditTxn={(t) => { setOpenOrder(null); setEditTxn(t); }}
        onOpenOrderPage={onNavigate ? () => { setOpenOrder(null); goOrder(openOrder); } : undefined}
        onOpenClient={(onNavigate && ckByOrder[normOrderNo(openOrder)]) ? () => { setOpenOrder(null); goCompanyForOrder(openOrder); } : undefined} />}
    </Box>
  );
}

// Click any order (Profit-by-order row, or a red "lost money" chip) to see every
// transaction tagged to it — revenue and every cost — with in/out/net. Tap a line
// to jump into editing it (e.g. fix a wrong date that parked an order in December).
function OrderDialog({ orderNumber, txns, onClose, onEditTxn, onOpenOrderPage, onOpenClient }) {
  // Match on the CANONICAL number (leading zeros stripped, both sides) so the
  // drill-in shows the same rows the by-order grouping rolled up — a "0000021"
  // ledger row lines up with the "21" order the user clicked. (C2)
  const key = normOrderNo(orderNumber);
  const rows = (txns || []).filter((t) => t && normOrderNo(t.orderNumber) === key)
    .slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  // Credit-aware cash view: a supplier credit counts as money IN, a customer
  // refund as money OUT — so In/Out read true even with returns mixed in.
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const income  = rows.filter((t) => isInflow(t)).reduce((s, t) => s + num(t.amount), 0);
  const expense = rows.filter((t) => !isInflow(t)).reduce((s, t) => s + num(t.amount), 0);
  // Profit reconciles EXACTLY with the by-order list (M6): the SAME definition —
  // signed Customer-Sales revenue minus signed COGS — not the all-categories cash
  // Net. (Cash In/Out above stays a separate lens; profit is the margin number.)
  const revenue = rows.filter((t) => t.type === 'income' && t.category === 'Customer Sales')
    .reduce((s, t) => s + signedAmt(t), 0);
  const cost = rows.filter((t) => t.type === 'expense' && COGS_CATEGORIES.includes(t.category))
    .reduce((s, t) => s + signedAmt(t), 0);
  const profit = revenue - cost;
  const client = (rows.find((t) => t.type === 'income' && t.party) || rows.find((t) => t.party) || {}).party || '—';
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ px: 2.5, py: 1.2, borderBottom: `1px solid ${B.border}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Order #{orderNumber}{client !== '—' ? ` · ${client}` : ''}
        </Typography>
        {/* Jump out to the full surfaces — additive shortcuts beside the close X. */}
        {onOpenOrderPage && (
          <Box component="button" type="button" onClick={onOpenOrderPage}
            sx={{ background: 'none', border: `1px solid ${B.border}`, borderRadius: 1, color: B.green, cursor: 'pointer',
              fontSize: 11, fontWeight: 700, px: 1, py: 0.4, whiteSpace: 'nowrap', '&:hover': { borderColor: B.green } }}>
            Open order
          </Box>
        )}
        {onOpenClient && (
          <Box component="button" type="button" onClick={onOpenClient}
            sx={{ background: 'none', border: `1px solid ${B.border}`, borderRadius: 1, color: B.green, cursor: 'pointer',
              fontSize: 11, fontWeight: 700, px: 1, py: 0.4, whiteSpace: 'nowrap', '&:hover': { borderColor: B.green } }}>
            Open client
          </Box>
        )}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 0 }}>
        {rows.length === 0 ? (
          <Typography sx={{ color: B.muted, fontSize: 12, p: 2.5 }}>No transactions tagged to this order.</Typography>
        ) : (
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <Box component="tbody">
              {rows.map((t) => (
                <Box component="tr" key={t._id} onClick={() => onEditTxn && onEditTxn(t)}
                  sx={{ borderTop: `1px solid ${B.border}`, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                  <Box component="td" sx={{ py: 0.7, px: 1.5, color: B.muted, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>
                    {ymd(t.date)}
                  </Box>
                  <Box component="td" sx={{ py: 0.7, px: 0.5, whiteSpace: 'nowrap' }}>
                    <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 1, fontSize: 10, fontWeight: 700,
                      color: t.type === 'income' ? B.green : '#f87171', bgcolor: t.type === 'income' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)' }}>
                      {t.category}
                    </Box>
                    {t.isCredit && <CreditBadge />}
                  </Box>
                  <Box component="td" sx={{ py: 0.7, px: 1, color: B.white, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.party || t.description || ''}
                  </Box>
                  <Box component="td" sx={{ py: 0.7, px: 1.5, textAlign: 'right', ...mono, whiteSpace: 'nowrap',
                    color: isInflow(t) ? B.green : '#f87171' }}>
                    {isInflow(t) ? '+' : '−'}{money(t.amount)}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ borderTop: `1px solid ${B.border}`, px: 1.5, py: 1.25, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Typography sx={{ fontSize: 12, color: B.muted }}>In <Box component="span" sx={{ color: B.green, fontFamily: 'monospace' }}>{money(income)}</Box></Typography>
          <Typography sx={{ fontSize: 12, color: B.muted }}>Out <Box component="span" sx={{ color: '#f87171', fontFamily: 'monospace' }}>{money(expense)}</Box></Typography>
          <Typography sx={{ fontSize: 12, color: B.muted }}>Profit <Box component="span" sx={{ color: profit >= 0 ? B.green : '#f87171', fontFamily: 'monospace', fontWeight: 700 }}>{money(profit)}</Box></Typography>
        </Box>
        {rows.length > 0 && <Typography sx={{ color: B.muted, fontSize: 10.5, px: 1.5, pb: 1.5 }}>Tap a line to edit it (e.g. fix a wrong date).</Typography>}
      </DialogContent>
    </Dialog>
  );
}

// "Money owed to you" — surfaces the revenue gap that hides real profit. Two
// signals from /api/finances/payment-gaps: orders with COST recorded but NO client
// payment (the loudest — money out, income not yet entered), and orders billed but
// not yet collected (outstanding). Each row offers a one-tap "Record payment" that
// opens the Add-transaction modal prefilled with the client + amount, so closing
// the gap is a single confirm. Renders nothing when there's no gap (pristine).
function PaymentGaps({ gaps, onRecord, onOpenOrder, onOpenClient, canOpenClient }) {
  const rows = (gaps && Array.isArray(gaps.orders) ? gaps.orders : []).filter(Boolean);
  const totals = (gaps && gaps.totals) || {};
  if (!rows.length) return null;
  const noPay = round(totals.costWithoutPayment);
  const noPayN = totals.costWithoutPaymentCount || 0;
  const owed = round(totals.billedNotCollected);
  return (
    <Box sx={{ border: '1px solid rgba(251,191,36,0.4)', bgcolor: 'rgba(251,191,36,0.05)', borderRadius: 2, overflow: 'hidden',
      animation: 'jpRise 460ms ease both' }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 0.5 }}>
          <ErrorOutlineIcon sx={{ color: '#fbbf24' }} />
          <Typography sx={{ color: '#fbbf24', fontWeight: 800, fontSize: 14, flex: 1 }}>Money owed to you</Typography>
        </Stack>
        <Typography sx={{ color: B.muted, fontSize: 12, pl: 4 }}>
          {noPayN > 0 && (
            <>
              <Box component="span" sx={{ color: B.white, fontWeight: 700 }}>{money(noPay)}</Box> in costs across {noPayN} order{noPayN > 1 ? 's' : ''} have no recorded client payment
              {owed > 0 ? '; ' : '.'}
            </>
          )}
          {owed > 0 && (
            <>
              <Box component="span" sx={{ color: B.white, fontWeight: 700 }}>{money(owed)}</Box> billed but not yet collected.
            </>
          )}
          {' '}This isn’t in your profit yet — record the payments to close the gap.
        </Typography>
      </Box>
      <Box sx={{ overflowX: 'auto', ...scrollbar }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <Box component="thead">
            <Box component="tr" sx={{ '& th': { color: B.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', textAlign: 'right', py: 0.75, px: 1.25, whiteSpace: 'nowrap' } }}>
              <Box component="th" sx={{ textAlign: 'left !important' }}>Order</Box>
              <Box component="th" sx={{ textAlign: 'left !important' }}>Client</Box>
              <Box component="th">Billed</Box><Box component="th">Collected</Box><Box component="th">Cost</Box>
              <Box component="th" sx={{ textAlign: 'left !important' }}>Gap</Box>
              <Box component="th" />
            </Box>
          </Box>
          <Box component="tbody">
            {rows.map((o) => (
              <Box component="tr" key={o.orderNumber}
                sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', '& td': { py: 0.7, px: 1.25, textAlign: 'right', ...mono, whiteSpace: 'nowrap' } }}>
                <Box component="td" sx={{ textAlign: 'left !important', color: onOpenOrder ? B.green : B.muted }}>
                  {onOpenOrder ? (
                    <Box component="span" onClick={() => onOpenOrder(o.orderNumber)} title="Open this order"
                      sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>#{o.orderNumber}</Box>
                  ) : `#${o.orderNumber}`}
                </Box>
                <Box component="td" sx={{ textAlign: 'left !important', color: B.white, fontFamily: 'inherit !important', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(onOpenClient && o.client && canOpenClient && canOpenClient(o.orderNumber)) ? (
                    <Box component="span" onClick={() => onOpenClient(o.orderNumber)} title="Open this client's CRM card"
                      sx={{ color: B.green, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>{o.client}</Box>
                  ) : (o.client || '—')}
                </Box>
                <Box component="td" sx={{ color: B.white }}>{o.billed ? money(o.billed) : '—'}</Box>
                <Box component="td" sx={{ color: o.collected > 0 ? B.green : B.muted }}>{money(o.collected)}</Box>
                <Box component="td" sx={{ color: '#f87171' }}>{money(o.cost)}</Box>
                <Box component="td" sx={{ textAlign: 'left !important' }}>
                  {o.costWithoutPayment
                    ? <Box component="span" sx={{ fontSize: 9.5, fontWeight: 800, color: '#fbbf24', bgcolor: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.32)', borderRadius: 1, px: 0.55, py: 0.15, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: 'inherit' }}>No payment</Box>
                    : <Box component="span" sx={{ color: '#fbbf24', fontFamily: 'inherit' }}>{money(o.outstanding)} owed</Box>}
                </Box>
                <Box component="td">
                  <Button size="small" onClick={() => onRecord(o)}
                    sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 11, minWidth: 'auto', px: 1,
                      '&:hover': { bgcolor: 'rgba(74,222,128,0.08)' } }}>Record payment</Button>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// "Needs receipts" — in-progress orders (paid or in production) missing a cost
// receipt the owner hasn't entered yet, from /api/finances/missing-receipts. Each
// row names the specific missing type(s) — printer / blanks / shipping — and a
// one-tap "Add" opens the expense modal prefilled to that order. Renders nothing
// when everything's accounted for (pristine), so it only ever appears as a nudge.
function NeedsReceipts({ data, onOpenOrder, onAdd }) {
  const rows = (data && Array.isArray(data.orders) ? data.orders : []).filter(Boolean);
  if (!rows.length) return null;
  const blue = '#60a5fa';
  return (
    <Box sx={{ border: `1px solid rgba(96,165,250,0.4)`, bgcolor: 'rgba(96,165,250,0.05)', borderRadius: 2, overflow: 'hidden',
      animation: 'jpRise 460ms ease both' }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 0.5 }}>
          <ReceiptLongOutlinedIcon sx={{ color: blue }} />
          <Typography sx={{ color: blue, fontWeight: 800, fontSize: 14, flex: 1 }}>Needs receipts</Typography>
        </Stack>
        <Typography sx={{ color: B.muted, fontSize: 12, pl: 4 }}>
          {rows.length} in-progress order{rows.length > 1 ? 's' : ''} {rows.length > 1 ? 'are' : 'is'} missing a cost receipt you haven’t entered yet.
        </Typography>
      </Box>
      <Box sx={{ overflowX: 'auto', ...scrollbar }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <Box component="thead">
            <Box component="tr" sx={{ '& th': { color: B.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', textAlign: 'left', py: 0.75, px: 1.25, whiteSpace: 'nowrap' } }}>
              <Box component="th">Order</Box>
              <Box component="th">Client</Box>
              <Box component="th">Missing</Box>
              <Box component="th" />
            </Box>
          </Box>
          <Box component="tbody">
            {rows.map((o) => (
              <Box component="tr" key={o.orderNumber}
                sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', '& td': { py: 0.7, px: 1.25, whiteSpace: 'nowrap' } }}>
                <Box component="td" sx={{ fontFamily: 'monospace', color: onOpenOrder ? B.green : B.muted }}>
                  {onOpenOrder ? (
                    <Box component="span" onClick={() => onOpenOrder(o.orderNumber)} title="Open this order"
                      sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>#{o.orderNumber}</Box>
                  ) : `#${o.orderNumber}`}
                </Box>
                <Box component="td" sx={{ color: B.white, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.client || '—'}</Box>
                <Box component="td">
                  <Stack direction="row" gap={0.5} sx={{ flexWrap: 'wrap' }}>
                    {(o.missingLabels || []).map((m) => (
                      <Box key={m} component="span" sx={{ fontSize: 9.5, fontWeight: 800, color: blue, bgcolor: 'rgba(96,165,250,0.14)',
                        border: '1px solid rgba(96,165,250,0.32)', borderRadius: 1, px: 0.55, py: 0.15, letterSpacing: 0.3, textTransform: 'uppercase' }}>{m}</Box>
                    ))}
                  </Stack>
                </Box>
                <Box component="td" sx={{ textAlign: 'right' }}>
                  {onAdd && (
                    <Button size="small" onClick={() => onAdd(o)}
                      sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 11, minWidth: 'auto', px: 1,
                        '&:hover': { bgcolor: 'rgba(74,222,128,0.08)' } }}>Add receipt</Button>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function MonthlyTrend({ months }) {
  // Defensive: drop any null/month-less entry so one bad row can't break the chart.
  const safe = (months || []).filter((m) => m && typeof m.month === 'string');
  if (safe.length === 0) return null;
  months = safe;
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);   // finite bar heights only
  const max = Math.max(1, ...months.map((m) => Math.max(n(m.income), Math.abs(n(m.net)))));
  // On "All" the months span multiple years — show the year so two different
  // "Jan" bars don't read as one confusing jumble.
  const multiYear = new Set(months.map((m) => String(m.month).split('-')[0])).size > 1;
  return (
    <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly trend</Typography>
        <Stack direction="row" gap={1.5}>
          <Legend color="rgba(255,255,255,0.22)" label="Revenue" />
          <Legend color={B.green} label="Profit" />
        </Stack>
      </Stack>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', overflowX: 'auto', ...scrollbar, pb: 0.5 }}>
        {months.map((m, mi) => {
          const [y, mo] = String(m.month).split('-');
          const mShort = new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-US', { month: 'short' });
          const label = multiYear ? `${mShort} ’${String(y).slice(2)}` : mShort;
          const inc = n(m.income), net = n(m.net);
          return (
            <Box key={m.month} sx={{ minWidth: multiYear ? 46 : 36, flexShrink: 0, textAlign: 'center' }}
              title={`${mShort} ${y} · revenue ${money(inc)} · profit ${money(net)}`}>
              <Box sx={{ height: 92, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0.5 }}>
                <Box sx={{ width: 9, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.22)', height: `${Math.max(2, (inc / max) * 100)}%`,
                  transformOrigin: 'bottom', animation: 'jpGrowY 460ms ease both', animationDelay: `${mi * 45}ms` }} />
                <Box sx={{ width: 9, borderRadius: 0.5, bgcolor: net >= 0 ? B.green : '#f87171', height: `${Math.max(2, (Math.abs(net) / max) * 100)}%`,
                  transformOrigin: 'bottom', animation: 'jpGrowY 460ms ease both', animationDelay: `${mi * 45 + 60}ms` }} />
              </Box>
              <Typography sx={{ fontSize: 9.5, color: B.muted, mt: 0.4, whiteSpace: 'nowrap' }}>{label}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function Legend({ color, label }) {
  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <Box sx={{ width: 9, height: 9, borderRadius: 0.5, bgcolor: color }} />
      <Typography sx={{ fontSize: 10, color: B.muted }}>{label}</Typography>
    </Stack>
  );
}

function TopClients({ clients, onClient }) {
  if (!clients || clients.length === 0) return null;
  return (
    <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, px: 1.5, pt: 1.25, pb: 0.5 }}>Top clients ({clients.length})</Typography>
      <Box sx={{ overflowX: 'auto', ...scrollbar }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <Box component="thead">
            <Box component="tr" sx={{ '& th': { color: B.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', textAlign: 'right', py: 0.75, px: 1.25, whiteSpace: 'nowrap' } }}>
              <Box component="th" sx={{ textAlign: 'left !important' }}>Client</Box>
              <Box component="th">Orders</Box><Box component="th">Revenue</Box><Box component="th">Profit</Box><Box component="th">Margin</Box>
            </Box>
          </Box>
          <Box component="tbody">
            {clients.slice(0, 20).map((c) => (
              <Box component="tr" key={c.client} sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', '& td': { py: 0.7, px: 1.25, textAlign: 'right', ...mono, whiteSpace: 'nowrap' } }}>
                <Box component="td" sx={{ textAlign: 'left !important', color: B.white, fontFamily: 'inherit !important', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.companyKey && onClient ? (
                    <Box component="span" onClick={() => onClient(c.companyKey)}
                      sx={{ cursor: 'pointer', borderBottom: '1px dotted rgba(255,255,255,0.35)', '&:hover': { color: B.green, borderBottomColor: B.green } }}>
                      {c.client}
                    </Box>
                  ) : c.client}
                </Box>
                <Box component="td" sx={{ color: B.muted }}>{c.orders}</Box>
                <Box component="td" sx={{ color: B.white }}>{money(c.revenue)}</Box>
                <Box component="td" sx={{ color: c.profit >= 0 ? B.green : '#f87171' }}>{money(c.profit)}</Box>
                <Box component="td" sx={{ color: pct(c.margin) >= 0 ? B.green : '#f87171' }}>{pct(c.margin)}%</Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function TxnDialog({ txn, prefill, token, onClose, onSave, onDelete }) {
  const edit = !!txn;
  // `prefill` (from "record payment for this order") seeds a NEW entry already set
  // to the client's payment — Income · Customer Sales · the order's client + amount.
  const seed = txn || prefill || null;
  const [type, setType] = useState(seed?.type || 'expense');
  const [date, setDate] = useState(() => {
    const d = txn && txn.date ? new Date(txn.date) : null;
    return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  });
  const [category, setCategory] = useState(seed?.category || (seed?.type === 'income' ? 'Customer Sales' : 'Printer COGS'));
  const [amount, setAmount] = useState(seed?.amount != null && seed?.amount !== '' ? String(seed.amount) : '');
  const [orderNumber, setOrderNumber] = useState(seed?.orderNumber || '');
  const [party, setParty] = useState(seed?.party || '');
  const [description, setDescription] = useState(seed?.description || '');
  const [isCredit, setIsCredit] = useState(!!txn?.isCredit);
  // Payment method on a CLIENT PAYMENT (income · Customer Sales) → drives the
  // auto-booked Processing Fee. Defaults to the saved method when editing, else
  // 'none' so a NEW payment never silently adds a fee until the owner picks CC/ACH.
  const [paymentMethod, setPaymentMethod] = useState(seed?.paymentMethod || 'none');
  const [receiptName, setReceiptName] = useState('');
  const [receiptDataUrl, setReceiptDataUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const pickReceipt = (file) => {
    if (!file) return;
    setReceiptName(file.name);
    setScanNote('');
    const r = new FileReader();
    r.onload = () => {
      setReceiptDataUrl(r.result);
      // On a NEW entry, let the AI read the receipt and pre-fill what it can —
      // you review + correct the rest. Best-effort: any failure (no API key,
      // unreadable file) just leaves the file attached for manual entry. We
      // never auto-fill on an edit, so it can't clobber values you already have.
      if (!edit) scanReceipt(r.result);
    };
    r.readAsDataURL(file);
  };

  const scanReceipt = async (dataUrl) => {
    setScanning(true); setErr('');
    try {
      const authHdr = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${base}/receipts/scan`, { dataUrl }, authHdr);
      const f = res.data && res.data.configured && res.data.fields;
      if (!f) { setScanning(false); return; }
      if (f.type) { setType(f.type); setCategory(f.category || (f.type === 'income' ? 'Customer Sales' : 'Other')); }
      if (f.party) setParty(f.party);
      if (f.amount !== '' && f.amount != null) setAmount(String(f.amount));
      if (f.date) setDate(f.date);
      if (f.orderNumber) setOrderNumber(f.orderNumber);
      if (f.description) setDescription(f.description);
      if (typeof f.isCredit === 'boolean') setIsCredit(f.isCredit);
      setScanNote(f.isCredit
        ? 'Looks like a credit / return — I marked it as a credit. Double-check the direction before saving.'
        : 'Auto-filled from the receipt — double-check it before saving.');
    } catch (_) {
      // leave fields as-is; the receipt is still attached for manual entry
    } finally { setScanning(false); }
  };
  // A real CLIENT PAYMENT (money IN for a sale, not a refund) — the only row a
  // merchant Processing Fee applies to. Drives whether the payment-method picker
  // and the fee preview show.
  const isClientPayment = type === 'income' && category === 'Customer Sales' && !isCredit;
  // What the processor will take, previewed live so the owner sees it before saving.
  // Mirrors the backend computeProcessingFee exactly (amount × rate, 2dp).
  const feeRate = PROCESSING_FEE_RATES[paymentMethod] || 0;
  const feeAmount = isClientPayment ? round((Number(amount) || 0) * feeRate) : 0;

  // One-tap "this is a refund": set Income · Customer Sales · Credit so it books as
  // contra-revenue against the order (the owner never has to reason about the
  // Credit toggle). The order # is what links it to the right order, so we surface
  // that the field is required right here.
  const makeRefund = () => {
    setType('income');
    setCategory('Customer Sales');
    setIsCredit(true);
    setPaymentMethod('none');     // a refund is never charged a processing fee
    setErr('');
  };

  const save = async () => {
    if (!amount || Number(amount) <= 0) { setErr('Enter an amount'); return; }
    // A refund without an order # can't reduce the right order — make that obvious
    // instead of silently booking an unlinked credit.
    if (isCredit && type === 'income' && !String(orderNumber).replace(/[^0-9]/g, '')) {
      setErr('Add the order # this refund is for'); return;
    }
    setSaving(true); setErr('');
    const form = { type, date, category, amount: Number(amount), orderNumber: String(orderNumber).replace(/[^0-9]/g, ''), party, description, isCredit };
    // Tag the payment method on a client payment so the backend auto-books the
    // Processing Fee as a linked cost on the same order. Sent on edits too, so
    // changing/removing the method re-syncs (or clears) the fee row.
    if (type === 'income' && category === 'Customer Sales') form.paymentMethod = isCredit ? 'none' : paymentMethod;
    if (receiptDataUrl) form.receiptDataUrl = receiptDataUrl;
    try { await onSave(form); } catch (e) { setErr(e.response?.data?.message || e.message); setSaving(false); }
  };

  const fld = { ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.9 } };
  const sel = { color: B.white, fontSize: 13, borderRadius: 1.5, '& .MuiSvgIcon-root': { color: B.muted } };
  const hasReceipt = !!(txn && txn.receiptUrl);
  // A refund is currently being entered (income credit) — the dialog reflects it.
  const isRefundMode = type === 'income' && isCredit;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ px: 2.5, py: 1.2, borderBottom: `1px solid ${B.border}`, display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          {edit ? 'Edit transaction' : isRefundMode ? 'Record a refund' : 'Add transaction'}
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        <Stack gap={1.25}>
          {/* Quick actions on a NEW entry — so the owner doesn't have to remember the
              Income/Customer Sales/Credit combo. "Refund a customer" sets it all up
              and just asks for the order #. Hidden once already in refund mode. */}
          {!edit && !isRefundMode && (
            <Button onClick={makeRefund} startIcon={<ReplayIcon sx={{ fontSize: 14 }} />} size="small"
              sx={{ alignSelf: 'flex-start', color: '#fb7185', textTransform: 'none', fontWeight: 600, fontSize: 11.5,
                px: 0.75, py: 0.25, minWidth: 0, '&:hover': { bgcolor: 'rgba(251,113,133,0.08)' } }}>
              Refund a customer
            </Button>
          )}
          {isRefundMode && (
            <Box sx={{ border: '1px solid rgba(251,113,133,0.4)', bgcolor: 'rgba(251,113,133,0.07)', borderRadius: 1.5, px: 1.25, py: 0.85 }}>
              <Typography sx={{ color: '#fb7185', fontWeight: 700, fontSize: 12 }}>Customer refund</Typography>
              <Typography sx={{ color: B.muted, fontSize: 10.5, lineHeight: 1.35 }}>
                Money back to a client — this lowers the order&apos;s revenue and profit. Enter the amount refunded and the order&nbsp;#.
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <FormControl size="small" sx={fld}>
              <Select value={type} onChange={(e) => { setType(e.target.value); setCategory(e.target.value === 'income' ? 'Customer Sales' : 'Printer COGS'); }} sx={sel}>
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" type="date" value={date} onChange={(e) => setDate(e.target.value)} sx={fld} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 1 }}>
            <FormControl size="small" sx={fld}>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} sx={sel}>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} sx={fld} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <TextField size="small" placeholder={type === 'income' ? 'Client' : 'Vendor'} value={party} onChange={(e) => setParty(e.target.value)} sx={fld} />
            <TextField size="small" placeholder={isRefundMode ? 'Order # (required)' : 'Order #'} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
              sx={isRefundMode && !String(orderNumber).replace(/[^0-9]/g, '')
                ? { ...fld, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(251,113,133,0.6)' } }
                : fld} />
          </Box>
          <TextField size="small" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} sx={fld} />
          {/* Payment method → auto-books the merchant Processing Fee as a cost on
              this order. Only on a real client payment (income · Customer Sales, not
              a refund). The fee is previewed live so the owner sees what's deducted. */}
          {isClientPayment && (
            <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, px: 1.25, py: 1, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.75 }}>
                <CreditCardOutlinedIcon sx={{ fontSize: 15, color: B.muted }} />
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: B.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>How was it paid?</Typography>
              </Stack>
              <FormControl size="small" sx={{ ...fld, width: '100%' }}>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} sx={sel}>
                  {['none', 'cc', 'ach'].map((m) => <MenuItem key={m} value={m}>{FEE_METHOD_LABEL[m]}</MenuItem>)}
                </Select>
              </FormControl>
              {feeAmount > 0 ? (
                <Typography sx={{ color: B.muted, fontSize: 11, mt: 0.75 }}>
                  Processing fee <Box component="span" sx={{ color: '#f87171', fontWeight: 700 }}>{money(feeAmount)}</Box>
                  {' '}({(feeRate * 100).toFixed(2)}%) will be booked as a cost on
                  {orderNumber ? <> order <Box component="span" sx={{ color: B.white }}>#{String(orderNumber).replace(/[^0-9]/g, '')}</Box></> : ' this order'}.
                  Net into the business: <Box component="span" sx={{ color: B.white, fontWeight: 700 }}>{money((Number(amount) || 0) - feeAmount)}</Box>.
                </Typography>
              ) : (
                <Typography sx={{ color: B.muted, fontSize: 10.5, mt: 0.75 }}>
                  No processor fee (cash, check, or a waived fee). Pick CC/ACH to auto-book the merchant fee.
                </Typography>
              )}
            </Box>
          )}
          {/* Credit / return toggle — books a positive amount that flows the
              opposite way, so a refund or supplier credit nets correctly instead
              of looking like a charge/sale. */}
          <Box onClick={() => setIsCredit((v) => !v)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', userSelect: 'none',
              border: `1px solid ${isCredit ? 'rgba(251,191,36,0.55)' : B.border}`, borderRadius: 1.5, px: 1.25, py: 0.5,
              bgcolor: isCredit ? 'rgba(251,191,36,0.08)' : 'transparent', transition: 'border-color 160ms ease, background 160ms ease' }}>
            <Box sx={{ width: 15, height: 15, borderRadius: 0.5, flexShrink: 0,
              border: `2px solid ${isCredit ? '#fbbf24' : B.muted}`, bgcolor: isCredit ? '#fbbf24' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 160ms ease' }}>
              {isCredit && <CheckIcon sx={{ fontSize: 11, color: '#1a1206' }} />}
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: isCredit ? '#fbbf24' : B.white, whiteSpace: 'nowrap' }}>Credit / return</Typography>
            {isCredit && (
              <Typography sx={{ fontSize: 10.5, color: B.muted, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                · {type === 'income' ? 'refund out (lowers revenue)' : 'credit in (lowers cost)'}
              </Typography>
            )}
          </Box>
          {hasReceipt && !receiptDataUrl && (
            <a href={txn.receiptUrl} target="_blank" rel="noreferrer" style={{ color: B.green, fontSize: 12, textDecoration: 'none' }}>
              View attached receipt ↗
            </a>
          )}
          <Button component="label" disabled={scanning}
            startIcon={scanning ? <CircularProgress size={14} sx={{ color: B.green }} /> : <ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ color: receiptName ? B.green : B.muted, textTransform: 'none', justifyContent: 'flex-start', fontSize: 12, border: `1px dashed ${B.border}`, borderRadius: 1.5, py: 0.75 }}>
            {scanning ? 'Reading receipt…' : (receiptName || (hasReceipt ? 'Replace receipt' : 'Attach receipt / invoice (image or PDF)'))}
            <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => pickReceipt(e.target.files?.[0])} />
          </Button>
          {scanNote && <Typography sx={{ color: B.green, fontSize: 11 }}>{scanNote}</Typography>}
          {err && <Typography sx={{ color: '#fbbf24', fontSize: 11 }}>{err}</Typography>}
          <Stack direction="row" justifyContent="flex-end" gap={1} alignItems="center">
            {edit && onDelete && (
              <Button size="small" onClick={onDelete} sx={{ color: '#f87171', textTransform: 'none', mr: 'auto', '&:hover': { bgcolor: 'rgba(248,113,113,0.08)' } }}>Delete</Button>
            )}
            <Button size="small" onClick={onClose} sx={{ color: B.muted, textTransform: 'none' }}>Cancel</Button>
            <Button size="small" variant="contained" disabled={saving || scanning} onClick={save}
              sx={{ bgcolor: B.green, color: B.greenDk, textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: B.green } }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, color, big }) {
  return (
    <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ color, fontSize: big ? 24 : 19, fontWeight: 800, fontFamily: 'monospace', mt: 0.25 }}>{value}</Typography>
    </Box>
  );
}

// Little amber pill marking a row as a credit / return (a refund or supplier
// credit) — so a reversed-direction entry is obvious at a glance in the ledger.
function CreditBadge() {
  return (
    <Box component="span" sx={{ ml: 0.5, px: 0.55, py: 0.15, borderRadius: 1, fontSize: 8.5, fontWeight: 800,
      letterSpacing: 0.4, textTransform: 'uppercase', color: '#fbbf24',
      bgcolor: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.32)' }}>
      Credit
    </Box>
  );
}
