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
  Dialog, DialogContent, TextField, Autocomplete,
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
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import config from '../../config.json';
import { B, darkInput, scrollbar, mono, money, ymd, normOrderNo, roundCents as round } from './_shared';
import QuickbooksCard from './QuickbooksCard';
import { useContextMenu } from './ContextMenu';
import { buildTransactionMenu, buildFallbackMenu } from './contextMenuActions';
import FinanceDedupeView from './FinanceDedupeView';
import OrderReconcileView from './OrderReconcileView';

const base = `${config.backendUrl}/api`;
// money/ymd/round(=roundCents)/normOrderNo come from _shared — the ONE definition
// every tab renders with (finite-guarded, backend-mirrored). pct stays local: a
// display guard for an already-computed percentage (a bad value shows 0%).
const pct = (n) => { const v = Number(n); return Number.isFinite(v) ? v : 0; };
// Finance vocabulary — the OFFLINE FALLBACK for GET /api/finances/config. The live
// values (served straight from the backend Transaction model) are fetched on mount
// and used everywhere below; these mirrors only apply while that fetch fails, so
// keep them matching the backend all the same.
const CATEGORIES = [
  'Client Sales', 'Blank COGS', 'Printer COGS', 'Shipping', 'Art', 'Commission',
  'Processing Fee', 'Software', 'Marketing', 'Accounting', 'Travel/Field',
  'Office Supplies', 'Owner Draw', 'Owner Contribution', 'Sales Tax', 'Refund', 'Other',
];
// COGS categories that net against an order's revenue — offline fallback for
// /api/finances/config (cogsCategories); mirrors backend Transaction.COGS_CATEGORIES
// so the drill-in profit reconciles with by-order even when the config fetch fails.
const COGS_CATEGORIES = ['Blank COGS', 'Printer COGS', 'Shipping', 'Art', 'Commission', 'Processing Fee'];
// Merchant processing-fee rates (fractions of the payment) — offline fallback for
// /api/finances/config (processingFeeRates); mirrors backend
// Transaction.PROCESSING_FEE_RATES so the fee the UI previews equals the one booked.
const PROCESSING_FEE_RATES = { cc: 0.0299, ach: 0.01, none: 0 };
// Payment-method labels derived from the LIVE fee rates, so a negotiated rate
// change server-side shows its true percentage the moment the config loads.
const feeMethodLabels = (rates) => ({
  cc: `Credit card (${+(((rates && rates.cc) || 0) * 100).toFixed(2)}%)`,
  ach: `ACH / bank (${+(((rates && rates.ach) || 0) * 100).toFixed(2)}%)`,
  none: 'No fee (cash / check)',
});
// Year picker range: 2024 (the first ledger year) through next year — computed so
// the picker never goes stale at a year rollover (was a hardcoded list).
const YEAR_OPTIONS = (() => {
  const ys = [];
  for (let y = 2024, end = new Date().getFullYear() + 1; y <= end; y += 1) ys.push(y);
  return ys;
})();
// Shown when the AI receipt scan errors or reads nothing usable — the upload
// itself still succeeded, so the owner just fills the fields by hand.
const SCAN_FAIL_NOTE = 'Couldn’t read the receipt — fill the fields in manually. The file is still attached.';
// Signed amount within a row's type bucket (credit reverses direction) — matches
// backend signed(): an income credit nets revenue down, an expense credit nets cost down.
const signedAmt = (t) => (t && t.isCredit ? -(Number(t.amount) || 0) : (Number(t.amount) || 0));

// What ONE income row contributes to an order's REVENUE — the exact client mirror
// of backend controllers/finances.orderRevenueContribution, so the OrderDialog's
// revenue/profit reconcile to the by-order P&L and the headline (keep in sync):
//   • 'Client Sales' → signedAmt(t)   (a Customer-Sales CREDIT nets down)
//   • 'Refund'       → −|signedAmt(t)| (contra-revenue — always reduces)
//   • anything else  → 0              (never was order revenue)
const orderRevenueContribution = (t) => {
  if (!t || t.type !== 'income') return 0;
  if (t.category === 'Client Sales') return signedAmt(t);
  if (t.category === 'Refund') return -Math.abs(signedAmt(t));
  return 0;
};
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
  // Receipt inbox: uploaded receipts the scanner could NOT auto-attach to an
  // existing ledger row — they sit at status pending/review/failed until booked
  // or dismissed here. This is the surface that was missing when the first
  // ST-50 receipt "disappeared": uploads never auto-book a new transaction.
  const [receiptInbox, setReceiptInbox] = useState([]);
  const [bookRec, setBookRec] = useState(null);   // the receipt being booked (dialog)
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState('');
  const [showAdd, setShowAdd] = useState(false);
  // Prefill for "record payment for this order" — opens the Add-transaction
  // modal already set to Income · Client Sales · the order's client + amount.
  const [prefill, setPrefill] = useState(null);
  const [editTxn, setEditTxn] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);
  // Live finance vocabulary from /api/finances/config (categories / COGS set /
  // processing-fee rates) — the anti-drift source of truth. Starts as the
  // hardcoded mirrors (offline fallback) and is replaced by the served values.
  const [finCfg, setFinCfg] = useState({
    categories: CATEGORIES, customCategories: [], cogsCategories: COGS_CATEGORIES, processingFeeRates: PROCESSING_FEE_RATES,
  });
  // "Manage categories" dialog (opened from the transaction dialog's category list).
  const [showCats, setShowCats] = useState(false);
  // The "Review duplicate transactions" surface (merge cross-source dupes the budget
  // restart left behind; preview→confirm→apply, reversible). A full-screen sub-view,
  // mirroring the CRM CleanupView pattern. Its entry point auto-HIDES when there are
  // zero duplicate pairs (the live count drives visibility — no dupes, no clutter).
  const [showDedupe, setShowDedupe] = useState(false);
  const [dedupeCount, setDedupeCount] = useState(0);
  const [showReconcile, setShowReconcile] = useState(false);
  const [reconcileCount, setReconcileCount] = useState(0);
  const [bannerDismiss, setBannerDismiss] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jpFinBanner') || 'null'); } catch (_) { return null; }
  });
  const [bannerLeaving, setBannerLeaving] = useState(false);
  const fileRef = useRef(null);

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

  // How many records still carry a scattered (non-canonical) order number? Drives whether
  // the "Reconcile order #" entry shows at all (auto-hidden at zero, so it leaves no
  // clutter once everything reads one number). Re-checked when the view closes.
  const loadReconcileCount = useCallback(async () => {
    try {
      const r = await axios.get(`${base}/finances/order-reconcile/preview`, authHdr);
      const n = (r.data && r.data.summary && r.data.summary.count) || 0;
      setReconcileCount(Number(n) || 0);
    } catch (_) { setReconcileCount(0); /* hide the entry on failure */ }
  }, [authHdr]);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const [s, o, t, m, c, g, nr, rc] = await Promise.all([
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
        // Uploaded receipts awaiting review/booking — same guard.
        axios.get(`${base}/receipts`, authHdr).catch(() => ({ data: null })),
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
      setReceiptInbox(arr(rc.data && rc.data.receipts)
        .filter((r) => ['pending', 'processing', 'review', 'failed'].includes(r.status)));
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  }, [authHdr, year]);

  useEffect(() => { load(); }, [load]);
    useEffect(() => { loadDedupeCount(); }, [loadDedupeCount]);
  useEffect(() => { loadReconcileCount(); }, [loadReconcileCount]);

  // Status lines auto-clear — "Cleared 46 receipts ✓" must not live in the
  // header forever. In-flight messages (ending in …) stay until replaced.
  useEffect(() => {
    if (!busy || String(busy).endsWith('…')) return undefined;
    const t = setTimeout(() => setBusy(''), 6000);
    return () => clearTimeout(t);
  }, [busy]);

  // Live finance config (categories incl. the owner's custom ones / COGS set /
  // fee rates). Reusable so the manage-categories dialog can refresh it after an
  // add/remove; a failure just keeps the hardcoded mirrors — same numbers as before.
  const applyFinCfg = useCallback((d) => {
    if (!d) return;
    // Partial-safe: the category add/remove responses only carry the category
    // lists — anything absent keeps its current (mirror-seeded) value.
    setFinCfg((prev) => ({
      categories: Array.isArray(d.categories) && d.categories.length ? d.categories : prev.categories,
      customCategories: Array.isArray(d.customCategories) ? d.customCategories : prev.customCategories,
      cogsCategories: Array.isArray(d.cogsCategories) && d.cogsCategories.length ? d.cogsCategories : prev.cogsCategories,
      processingFeeRates: (d.processingFeeRates && typeof d.processingFeeRates === 'object') ? d.processingFeeRates : prev.processingFeeRates,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${base}/finances/config`, authHdr).then((r) => {
      if (cancelled || !r.data) return;
      applyFinCfg(r.data);
    }).catch(() => { /* keep the hardcoded fallback */ });
    return () => { cancelled = true; };
  }, [authHdr, applyFinCfg]);

  // Owner-managed custom categories (the manage dialog's actions). The response
  // carries the updated lists, so the select repaints without a second fetch.
  const addCategory = async (name) => {
    const r = await axios.post(`${base}/finances/categories`, { name }, authHdr);
    applyFinCfg(r.data);
  };
  const removeCategory = async (name) => {
    const r = await axios.delete(`${base}/finances/categories/${encodeURIComponent(name)}`, authHdr);
    applyFinCfg(r.data);
  };

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

  // ── Receipt inbox actions ────────────────────────────────────────────────
  // Book an inbox receipt into the ledger: POST /receipts/:id/confirm with the
  // (owner-edited) extracted fields. The API's 409 duplicate guard surfaces as
  // a confirm — "book anyway" retries with force. Booking links the Transaction
  // to the stored file, so the ledger row carries the receipt automatically.
  const bookReceipt = async (rec, extracted, { force = false } = {}) => {
    try {
      await axios.post(`${base}/receipts/${rec._id}/confirm`, { extracted, force }, authHdr);
      setBookRec(null);
      setBusy('Receipt booked into the ledger ✓');
      await load();
    } catch (e) {
      if (e?.response?.status === 409 && !force) {
        if (window.confirm('This looks like a duplicate of a transaction already in the ledger. Book it anyway?')) {
          return bookReceipt(rec, extracted, { force: true });
        }
        return;
      }
      setBusy(e?.response?.data?.message || 'Could not book the receipt.');
    }
  };
  // Not a real cost (junk shot, duplicate photo) → soft-dismiss. The file stays
  // stored and searchable; it just leaves the inbox.
  const dismissReceipt = async (rec) => {
    if (!window.confirm(`Ignore "${rec.fileName || 'this receipt'}"? The file stays stored — it just leaves the inbox.`)) return;
    try {
      await axios.put(`${base}/receipts/${rec._id}`, { status: 'ignored' }, authHdr);
      await load();
    } catch (e) { setBusy(e?.response?.data?.message || 'Could not dismiss the receipt.'); }
  };
  // A failed read gets one more shot at the AI scanner.
  const reprocessReceipt = async (rec) => {
    try {
      await axios.post(`${base}/receipts/${rec._id}/reprocess`, {}, authHdr);
      setBusy('Re-reading the receipt — give it a minute, then refresh.');
    } catch (e) { setBusy(e?.response?.data?.message || 'Could not re-read the receipt.'); }
  };
  // One tap clears a whole backlog (e.g. a batch upload full of non-order
  // receipts): every review-status receipt flips to ignored. Files stay stored.
  const ignoreAllReceipts = async () => {
    const n = receiptInbox.filter((r) => r.status === 'review').length;
    if (!n) return;
    if (!window.confirm(`Ignore all ${n} waiting receipt${n === 1 ? '' : 's'}? Files stay stored — they just leave the inbox. Book the real ones first.`)) return;
    try {
      await axios.post(`${base}/receipts/archive-rest`, {}, authHdr);
      setBusy(`Cleared ${n} receipt${n === 1 ? '' : 's'} from the inbox ✓`);
      await load();
    } catch (e) { setBusy(e?.response?.data?.message || 'Could not clear the inbox.'); }
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
  // the existing edit dialog; delete uses the row-targeted helper above. The
  // "Open order / client" jumps reuse the SAME deep links the row's inline order #
  // and party name use — and are only offered when the target actually resolves.
  const bindTxn = (t) => {
    const k = normOrderNo(t.orderNumber);
    const ck = ckByOrder[k];
    return bindMenu(() => buildTransactionMenu(t, {
      onEdit: (txn) => setEditTxn(txn),
      onDelete: deleteTxnById,
      onOpenOrder: (onNavigate && k) ? () => goOrder(t.orderNumber) : undefined,
      onOpenClient: (onNavigate && ck && t.type === 'income' && t.party) ? () => goCompanyForOrder(t.orderNumber) : undefined,
      onOpenVendor: (onNavigate && t.type === 'expense' && t.vendorId) ? () => goVendor(t.vendorId) : undefined,
    }));
  };

  useEffect(() => registerFallback(() => buildFallbackMenu({
    onNew: () => setShowAdd(true),
    newLabel: 'Add transaction',
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
  // An expense row that carries a hard vendor link (vendorId, resolved/set on the
  // backend) deep-links to that Vendor card — the supplier-side twin of the
  // income→CRM jump above. Studio resolves the id directly.
  const goVendor = useCallback((vendorId) => {
    if (!onNavigate || !vendorId) return;
    onNavigate({ view: 'vendors', vendorId });
  }, [onNavigate]);

  const expenses = summary ? Object.entries(summary.expenseByCategory || {}).sort((a, b) => b[1] - a[1]) : [];
  const empty = !summary || (summary.income === 0 && summary.expense === 0 && txns.length === 0);

  // The owner asked not to be alarmed about losses on OLD/finished orders — a loss on
  // a delivered job is water under the bridge, not something he can act on, and a
  // half-recorded in-flight order can read "negative" mid-job (a false alarm). So the
  // per-order "lost money / underwater" RED banner is retired. Per-order losses are
  // still visible — non-nagging — in the Profit-by-order table below. The only banner
  // left is the current-period AMBER "merch is in the red" signal (dismissable).
  const showBanner = !!(summary && summary.net < 0);
  const bannerSig = `${year}|amber`;
  const today = new Date().toISOString().slice(0, 10);
  const bannerHidden = bannerDismiss && bannerDismiss.sig === bannerSig && bannerDismiss.date === today;
  const dismissBanner = () => {
    const d = { sig: bannerSig, date: today };
    try { localStorage.setItem('jpFinBanner', JSON.stringify(d)); } catch (_) {}
    setBannerDismiss(d);
  };


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

  // The "Reconcile order #" surface takes over the whole tab. On apply it reloads the
  // finance data (the folded rows now read one number) and the reconcile count (so the
  // entry hides once nothing is left to fold).
  if (showReconcile) {
    return (
      <OrderReconcileView
        token={token}
        onBack={() => { setShowReconcile(false); loadReconcileCount(); }}
        onApplied={() => { load(); loadReconcileCount(); }}
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
        {/* "Reconcile order #" — shown ONLY while some order still carries a scattered
            number (auto-hides at zero, so it leaves no clutter once everything's folded
            onto one number). One tap opens the preview→confirm surface; reversible. */}
        {reconcileCount > 0 && (
          <Button onClick={() => setShowReconcile(true)} size="small" startIcon={<MergeTypeOutlinedIcon sx={{ fontSize: 16 }} />}
            title="Fold one order's scattered numbers (e.g. Happy Leaf #141/#1050) onto a single # (preview first — reversible)"
            sx={{ color: '#06281a', bgcolor: '#fbbf24', textTransform: 'none', fontWeight: 800, fontSize: 12, px: 1.5,
              '&:hover': { bgcolor: '#f59e0b' } }}>
            Reconcile order # ({reconcileCount})
          </Button>
        )}
        <Button onClick={() => setShowAdd(true)} size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
          sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Add</Button>
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <Select value={year} onChange={(e) => setYear(e.target.value)}
            sx={{ color: B.white, fontSize: 13, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', '& .MuiSvgIcon-root': { color: B.muted } }}>
            {YEAR_OPTIONS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
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
      </Box>

      <Box data-ctx-chrome sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
        {/* QuickBooks connection — the connector for invoices/payments + pay-at-close. */}
        <Box sx={{ mb: 2.5 }}><QuickbooksCard token={token} /></Box>
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
              <IconButton size="small" title="Dismiss for today"
                onClick={() => { setBannerLeaving(true); setTimeout(() => { dismissBanner(); setBannerLeaving(false); }, 250); }}
                sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, color: B.muted,
                  transition: 'transform 220ms ease, color 220ms ease',
                  '&:hover': { color: B.white, transform: 'rotate(90deg) scale(1.12)' } }}>
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, border: '1px solid rgba(251,191,36,0.4)',
                bgcolor: 'rgba(251,191,36,0.06)', borderRadius: 2, px: 2, py: 1.25 }}>
                <ErrorOutlineIcon sx={{ color: '#fbbf24', mt: 0.2 }} />
                <Box>
                  <Typography sx={{ color: '#fbbf24', fontWeight: 800, fontSize: 14 }}>
                    Merch is in the red — −{money(Math.abs(summary.net))} {year ? `in ${year}` : 'overall'}
                  </Typography>
                  <Typography sx={{ color: B.muted, fontSize: 12 }}>
                    Costs are outpacing sales this period.
                  </Typography>
                </Box>
              </Box>
            </Box>
            )}

            {/* Two margin lenses, labeled — one ambiguous "Margin" used to sit
                here and read like an order margin while actually being NET
                (every expense incl. monthly overhead). GROSS = revenue vs the
                order-linked COGS categories only (the same cost set the
                per-order tables use); NET = after overhead too. */}
            <Box sx={{ display: 'grid', gap: 1.25,
              gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(3,1fr)', lg: 'repeat(5,1fr)' },
              '& > *': { animation: 'jpRise 460ms ease both' },
              '& > *:nth-of-type(2)': { animationDelay: '70ms' },
              '& > *:nth-of-type(3)': { animationDelay: '140ms' },
              '& > *:nth-of-type(4)': { animationDelay: '210ms' },
              '& > *:nth-of-type(5)': { animationDelay: '280ms' } }}>
              <Stat label="Revenue" value={money(summary.income)} color={B.white} sub="Recorded income · cash collected" />
              <Stat label="Expenses" value={money(summary.expense)} color="#f87171"
                sub={`${money(summary.cogs || 0)} order costs · ${money(summary.overhead || 0)} overhead`} />
              <Stat label="Net profit" value={money(summary.net)} color={summary.net >= 0 ? B.green : '#f87171'} big />
              <Stat label="Gross margin" value={`${pct(summary.grossMargin ?? summary.margin)}%`}
                color={pct(summary.grossMargin ?? summary.margin) >= 0 ? B.green : '#f87171'}
                sub="on the merch — revenue vs order costs" />
              <Stat label="Net margin" value={`${pct(summary.margin)}%`}
                color={pct(summary.margin) >= 0 ? B.green : '#f87171'}
                sub="after monthly overhead too" />
            </Box>
            {/* Owner cash lens, demoted to a footnote (owner: profit EARNED is the
                headline — what he took out is bookkeeping, not the story). One
                quiet line instead of tiles that shouted TAKE-HOME. */}
            {(summary.ownerDraw > 0 || summary.ownerContribution > 0) && (
              <Typography sx={{ color: B.muted, fontSize: 11.5, px: 0.5, lineHeight: 1.5 }}>
                Draws so far: <Box component="span" sx={{ color: B.white, fontFamily: 'monospace', fontWeight: 700 }}>{money(summary.takeHome)}</Box>
                {summary.ownerContribution > 0 && <> · contributed back: <Box component="span" sx={{ color: B.white, fontFamily: 'monospace', fontWeight: 700 }}>{money(summary.ownerContribution)}</Box></>}
                {' '}— net profit above is what you earned, whether or not you took it out.
              </Typography>
            )}

            {/* Money owed to you / Unrecorded payments — the additive lens that
                EXPLAINS a low net: vendor costs entered without the matching
                client payment. One tap records the missing income, prefilled. */}
            <PaymentGaps gaps={gaps}
              onOpenOrder={onNavigate ? (orderNumber) => goOrder(orderNumber) : undefined}
              onOpenClient={onNavigate ? (orderNumber) => goCompanyForOrder(orderNumber) : undefined}
              canOpenClient={(orderNumber) => !!ckByOrder[normOrderNo(orderNumber)]}
              onRecord={(row) => setPrefill({
              type: 'income', category: 'Client Sales',
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

            {/* Receipt inbox — uploads the scanner couldn't auto-attach. Booking
                here is what actually puts them in the ledger (uploads never
                auto-book), so nothing "disappears" after an upload again. */}
            <ReceiptInbox receipts={receiptInbox}
              onBook={(rec) => setBookRec(rec)}
              onDismiss={dismissReceipt}
              onReprocess={reprocessReceipt}
              onIgnoreAll={ignoreAllReceipts} />

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
              <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, px: 1.5, pt: 1.25, pb: 0.5 }}>
                Profit by order ({orders.length})
              </Typography>
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
                            // An expense's party links to its Vendor card when the
                            // row carries a hard vendorId link (auto-resolved or
                            // explicitly set server-side) — the supplier-side twin
                            // of the income→CRM jump.
                            const canVendor = !!onNavigate && t.type === 'expense' && !!t.vendorId && !!t.party;
                            const nameNode = canClient ? (
                              <Box component="span"
                                onClick={(e) => { e.stopPropagation(); goCompanyForOrder(t.orderNumber); }}
                                title="Open this client's CRM card"
                                sx={{ color: B.green, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                                {t.party}
                              </Box>
                            ) : canVendor ? (
                              <Box component="span"
                                onClick={(e) => { e.stopPropagation(); goVendor(t.vendorId); }}
                                title="Open this vendor's card"
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
          categories={finCfg.categories} feeRates={finCfg.processingFeeRates}
          onManageCategories={() => setShowCats(true)}
          onClose={() => { setShowAdd(false); setPrefill(null); }}
          onSave={async (form) => { await addTxn(form); setPrefill(null); }} />
      )}
      {editTxn && <TxnDialog token={token} txn={editTxn}
        categories={finCfg.categories} feeRates={finCfg.processingFeeRates}
        onManageCategories={() => setShowCats(true)}
        onClose={() => setEditTxn(null)} onSave={saveTxn} onDelete={deleteTxn} />}
      {showCats && (
        <ManageCategoriesDialog
          categories={finCfg.categories} custom={finCfg.customCategories}
          onAdd={addCategory} onRemove={removeCategory}
          onClose={() => setShowCats(false)} />
      )}
      {bookRec && (
        <BookReceiptDialog receipt={bookRec} categories={finCfg.categories}
          onClose={() => setBookRec(null)}
          onBook={(extracted) => bookReceipt(bookRec, extracted)} />
      )}
      {openOrder && <OrderDialog orderNumber={openOrder} txns={txns} cogsCategories={finCfg.cogsCategories}
        onClose={() => setOpenOrder(null)}
        onEditTxn={(t) => { setOpenOrder(null); setEditTxn(t); }}
        onOpenOrderPage={onNavigate ? () => { setOpenOrder(null); goOrder(openOrder); } : undefined}
        onOpenClient={(onNavigate && ckByOrder[normOrderNo(openOrder)]) ? () => { setOpenOrder(null); goCompanyForOrder(openOrder); } : undefined}
        onOpenVendor={onNavigate ? (t) => { setOpenOrder(null); goVendor(t.vendorId); } : undefined} />}
    </Box>
  );
}

// Click any order (Profit-by-order row, or a red "lost money" chip) to see every
// transaction tagged to it — revenue and every cost — with in/out/net. Tap a line
// to jump into editing it (e.g. fix a wrong date that parked an order in December).
function OrderDialog({ orderNumber, txns, onClose, onEditTxn, onOpenOrderPage, onOpenClient, onOpenVendor, cogsCategories = COGS_CATEGORIES }) {
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
  // Profit reconciles EXACTLY with the by-order list (M6): the SAME definition as
  // the backend — Customer-Sales revenue with a customer REFUND netted down as
  // contra-revenue (orderRevenueContribution), minus signed COGS — not the
  // all-categories cash Net. Without the contra a refunded order showed full
  // revenue here yet a reduced top-line on the P&L; now they match. (Cash In/Out
  // above stays a separate lens; profit is the margin number.)
  const revenue = rows.reduce((s, t) => s + orderRevenueContribution(t), 0);
  const cost = rows.filter((t) => t.type === 'expense' && cogsCategories.includes(t.category))
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
                    {/* Same vendor deep link as the main ledger: an expense's party
                        with a hard vendorId link opens the Vendor card. */}
                    {(onOpenVendor && t.type === 'expense' && t.vendorId && t.party) ? (
                      <Box component="span"
                        onClick={(e) => { e.stopPropagation(); onOpenVendor(t); }}
                        title="Open this vendor's card"
                        sx={{ color: B.green, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                        {t.party}
                      </Box>
                    ) : (t.party || t.description || '')}
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

// "Receipt inbox" — uploaded receipts the AI scanner could not auto-attach to an
// existing ledger row (status pending/review/failed). Each row: what the scanner
// read, a link to the stored file, and one-tap Book / Ignore. Renders nothing
// when the inbox is empty — it's a nudge, not furniture. Mirrors NeedsReceipts'
// shape so the two receipt surfaces read as siblings.
function ReceiptInbox({ receipts, onBook, onDismiss, onReprocess, onIgnoreAll }) {
  const rows = Array.isArray(receipts) ? receipts : [];
  if (!rows.length) return null;
  const amber = '#fbbf24';
  const statusLabel = (r) => (
    r.status === 'review' ? 'needs review'
      : r.status === 'failed' ? 'read failed'
        : 'scanning…');
  const reviewCount = rows.filter((r) => r.status === 'review').length;
  return (
    <Box sx={{ border: `1px solid rgba(251,191,36,0.4)`, bgcolor: 'rgba(251,191,36,0.05)', borderRadius: 2, overflow: 'hidden',
      animation: 'jpRise 460ms ease both' }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 0.5 }}>
          <ReceiptLongOutlinedIcon sx={{ color: amber }} />
          <Typography sx={{ color: amber, fontWeight: 800, fontSize: 14, flex: 1 }}>Receipt inbox</Typography>
          {onIgnoreAll && reviewCount > 1 && (
            <Button size="small" onClick={onIgnoreAll}
              sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, fontSize: 11, px: 1,
                border: `1px solid ${B.border}`, borderRadius: 999, '&:hover': { color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' } }}>
              Ignore all {reviewCount}
            </Button>
          )}
          <Typography sx={{ ...mono, color: amber, fontWeight: 800, fontSize: 13 }}>{rows.length}</Typography>
        </Stack>
        <Typography sx={{ color: B.muted, fontSize: 12, pl: 4 }}>
          Clean reads book themselves into the ledger automatically — these are the ones that need your eyes
          (unclear read, possible duplicate, or a refund).
        </Typography>
      </Box>
      <Box sx={{ overflowX: 'auto', ...scrollbar }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <Box component="thead">
            <Box component="tr" sx={{ '& th': { color: B.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', textAlign: 'left', py: 0.75, px: 1.25, whiteSpace: 'nowrap' } }}>
              <Box component="th">Uploaded</Box>
              <Box component="th">What the scanner read</Box>
              <Box component="th">Status</Box>
              <Box component="th" />
            </Box>
          </Box>
          <Box component="tbody">
            {rows.map((r) => {
              const ex = r.extracted || {};
              const readBits = [
                ex.vendor || ex.seller,
                ex.amount ? money(ex.amount) : '',
                ex.category || '',
                ex.date || '',
              ].filter(Boolean).join(' · ');
              return (
                <Box component="tr" key={r._id}
                  sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', '& td': { py: 0.7, px: 1.25, whiteSpace: 'nowrap' } }}>
                  <Box component="td" sx={{ color: B.muted, fontSize: 11.5 }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                  </Box>
                  <Box component="td" sx={{ color: B.white, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.fileUrl ? (
                      <Box component="a" href={r.fileUrl} target="_blank" rel="noreferrer"
                        sx={{ color: B.green, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        {r.fileName || 'receipt'}
                      </Box>
                    ) : (r.fileName || 'receipt')}
                    {readBits && (
                      <Box component="span" sx={{ color: B.muted, ml: 0.75, fontSize: 11.5 }}>— {readBits}</Box>
                    )}
                  </Box>
                  <Box component="td">
                    <Box component="span" sx={{ fontSize: 9.5, fontWeight: 800, color: amber, bgcolor: 'rgba(251,191,36,0.14)',
                      border: '1px solid rgba(251,191,36,0.32)', borderRadius: 1, px: 0.55, py: 0.15, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                      {statusLabel(r)}
                    </Box>
                  </Box>
                  <Box component="td" sx={{ textAlign: 'right' }}>
                    <Button size="small" onClick={() => onBook(r)}
                      sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 11, minWidth: 'auto', px: 1,
                        '&:hover': { bgcolor: 'rgba(74,222,128,0.08)' } }}>Book</Button>
                    {r.status === 'failed' && (
                      <Button size="small" onClick={() => onReprocess(r)}
                        sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, fontSize: 11, minWidth: 'auto', px: 1,
                          '&:hover': { color: B.white } }}>Re-read</Button>
                    )}
                    <Button size="small" onClick={() => onDismiss(r)}
                      sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, fontSize: 11, minWidth: 'auto', px: 1,
                        '&:hover': { color: '#f87171' } }}>Ignore</Button>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// The booking editor for one inbox receipt: the scanner's read, editable, then
// CONFIRM → /receipts/:id/confirm books the Transaction with the file attached.
function BookReceiptDialog({ receipt, categories = CATEGORIES, onClose, onBook }) {
  const ex = receipt.extracted || {};
  const [type, setType] = useState(ex.documentKind === 'sales_invoice' ? 'income' : 'expense');
  const [category, setCategory] = useState(ex.category || 'Other');
  const [party, setParty] = useState(ex.vendor || ex.seller || '');
  const [amount, setAmount] = useState(ex.amount ? String(ex.amount) : '');
  const [date, setDate] = useState(ex.date || ymd(new Date()));
  const [orderNumber, setOrderNumber] = useState(ex.orderNumber || '');
  const [summary, setSummary] = useState(ex.summary || '');
  const [saving, setSaving] = useState(false);
  const canBook = Number(amount) > 0 && !saving;

  const submit = async () => {
    if (!canBook) return;
    setSaving(true);
    try {
      await onBook({
        type, category, party, amount: Number(amount), date,
        orderNumber: String(orderNumber).replace(/[^0-9-]/g, ''), summary,
      });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, backgroundImage: 'none' } }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1, borderBottom: `1px solid ${B.border}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReceiptLongOutlinedIcon sx={{ color: B.green, fontSize: 18 }} />
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>Book receipt</Typography>
        {receipt.fileUrl && (
          <Button component="a" href={receipt.fileUrl} target="_blank" rel="noreferrer" size="small"
            sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, fontSize: 11, '&:hover': { color: B.green } }}>
            View file ↗
          </Button>
        )}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        <Stack gap={1.5}>
          <Stack direction="row" gap={1}>
            <FormControl size="small" fullWidth>
              <Select value={type} onChange={(e) => setType(e.target.value)} sx={darkInput}>
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <Select value={categories.includes(category) ? category : 'Other'}
                onChange={(e) => setCategory(e.target.value)} sx={darkInput}>
                {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <TextField size="small" label="Who (vendor / payer)" value={party}
            onChange={(e) => setParty(e.target.value)} sx={darkInput} InputLabelProps={{ sx: { color: B.muted } }} />
          <Stack direction="row" gap={1}>
            <TextField size="small" label="Amount" type="number" value={amount} autoFocus={!Number(amount)}
              onChange={(e) => setAmount(e.target.value)} sx={darkInput} InputLabelProps={{ sx: { color: B.muted } }} />
            <TextField size="small" label="Date" type="date" value={date}
              onChange={(e) => setDate(e.target.value)} sx={darkInput} InputLabelProps={{ shrink: true, sx: { color: B.muted } }} />
          </Stack>
          <TextField size="small" label="Order # (optional — links it to the job)" value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)} sx={darkInput} InputLabelProps={{ sx: { color: B.muted } }} />
          <TextField size="small" label="Note" value={summary} multiline minRows={2}
            onChange={(e) => setSummary(e.target.value)} sx={darkInput} InputLabelProps={{ sx: { color: B.muted } }} />
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button onClick={onClose} sx={{ color: B.muted, textTransform: 'none', fontWeight: 700 }}>Cancel</Button>
            <Button onClick={submit} disabled={!canBook} startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
              sx={{ bgcolor: canBook ? B.green : 'rgba(255,255,255,0.08)', color: canBook ? '#08130c' : B.muted,
                textTransform: 'none', fontWeight: 800, px: 2, '&:hover': { bgcolor: B.green, opacity: 0.9 } }}>
              {saving ? 'Booking…' : 'Book it'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
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

// Owner-managed category list — opened from the transaction dialog's category
// dropdown ("＋ Edit category list…"). Built-ins are shown locked (they drive the
// P&L math: Client Sales = revenue, the COGS set = per-order margins); customs
// add/remove freely and roll up as operating expenses. Removing one never touches
// existing rows — they keep their label (the edit dialog keeps an off-list saved
// category selectable), it just stops being offered for new entries.
function ManageCategoriesDialog({ categories = [], custom = [], onAdd, onRemove, onClose }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const customSet = new Set(custom.map((c) => c.toLowerCase()));
  const builtIns = categories.filter((c) => !customSet.has(c.toLowerCase()));

  const add = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true); setErr('');
    try { await onAdd(n); setName(''); }
    catch (e) { setErr(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };
  const remove = async (n) => {
    if (busy) return;
    setBusy(true); setErr('');
    try { await onRemove(n); }
    catch (e) { setErr(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };

  const pill = (locked) => ({
    display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.4,
    borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)',
    bgcolor: 'rgba(255,255,255,0.05)', color: locked ? 'rgba(255,255,255,0.55)' : '#e7efe9',
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#14181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}>
      <DialogContent>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 16, mb: 0.5 }}>Transaction categories</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5, mb: 2 }}>
          Built-in categories are locked — the P&amp;L math depends on them. Your own are removable;
          rows already saved under a removed category keep their label.
        </Typography>

        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mb: 0.75 }}>
          Built-in
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
          {builtIns.map((c) => <Box key={c} sx={pill(true)}>{c}</Box>)}
        </Box>

        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mb: 0.75 }}>
          Yours
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
          {custom.length === 0 && (
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 12.5 }}>None yet — add one below.</Typography>
          )}
          {custom.map((c) => (
            <Box key={c} sx={pill(false)}>
              {c}
              <IconButton size="small" disabled={busy} onClick={() => remove(c)}
                sx={{ p: 0.1, ml: 0.25, color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#f87171' } }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" fullWidth placeholder="New category (e.g. Trade Shows)"
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            inputProps={{ maxLength: 40 }}
            sx={darkInput} />
          <Button onClick={add} disabled={busy || !name.trim()}
            sx={{ px: 2, fontWeight: 700, textTransform: 'none', color: '#4ade80',
              border: '1px solid rgba(74,222,128,0.4)', borderRadius: 2,
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.1)' } }}>
            {busy ? '…' : 'Add'}
          </Button>
        </Box>
        {err && <Typography sx={{ color: '#f87171', fontSize: 12, mt: 1 }}>{err}</Typography>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>Done</Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// `categories` / `feeRates` are the LIVE values from /api/finances/config, handed
// down by the tab (defaulting to the hardcoded mirrors so the dialog stays safe
// standalone / while the config fetch is in flight).
function TxnDialog({ txn, prefill, token, onClose, onSave, onDelete, categories = CATEGORIES, feeRates = PROCESSING_FEE_RATES, onManageCategories }) {
  const edit = !!txn;
  // `prefill` (from "record payment for this order") seeds a NEW entry already set
  // to the client's payment — Income · Client Sales · the order's client + amount.
  const seed = txn || prefill || null;
  const [type, setType] = useState(seed?.type || 'expense');
  const [date, setDate] = useState(() => {
    const d = txn && txn.date ? new Date(txn.date) : null;
    return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  });
  const [category, setCategory] = useState(seed?.category || (seed?.type === 'income' ? 'Client Sales' : 'Printer COGS'));
  const [amount, setAmount] = useState(seed?.amount != null && seed?.amount !== '' ? String(seed.amount) : '');
  const [orderNumber, setOrderNumber] = useState(seed?.orderNumber || '');
  const [party, setParty] = useState(seed?.party || '');
  // Hard vendor link on an EXPENSE: set when a vendor is picked from the party
  // suggestions (or preloaded when editing a linked row); cleared the moment the
  // party is free-typed, so the server auto-resolves the name instead (it never
  // guesses on ambiguity).
  const [vendorId, setVendorId] = useState(seed?.vendorId ? String(seed.vendorId) : '');
  const [description, setDescription] = useState(seed?.description || '');
  const [isCredit, setIsCredit] = useState(!!txn?.isCredit);
  // Payment method on a CLIENT PAYMENT (income · Client Sales) → drives the
  // auto-booked Processing Fee. Defaults to the saved method when editing, else
  // 'none' so a NEW payment never silently adds a fee until the owner picks CC/ACH.
  const [paymentMethod, setPaymentMethod] = useState(seed?.paymentMethod || 'none');
  const [receiptName, setReceiptName] = useState('');
  const [receiptDataUrl, setReceiptDataUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  // Inline notice when the AI scan errors / reads nothing usable — instead of the
  // fields just staying blank in silence. Cleared on the next upload/scan.
  const [scanErr, setScanErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Vendor list for the expense party picker (the same GET /api/orders/vendors
  // the PO builder loads). Fetched once, lazily — only when the dialog is (or
  // becomes) an expense. null = not loaded yet; [] = loaded (possibly empty).
  const [vendors, setVendors] = useState(null);
  useEffect(() => {
    if (type !== 'expense' || vendors !== null) return undefined;
    let cancelled = false;
    axios.get(`${base}/orders/vendors`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!cancelled) setVendors((r.data && r.data.vendors) || []); })
      .catch(() => { if (!cancelled) setVendors([]); });
    return () => { cancelled = true; };
  }, [type, vendors, token]);

  const pickReceipt = (file) => {
    if (!file) return;
    setReceiptName(file.name);
    setScanNote('');
    setScanErr('');
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
    setScanning(true); setErr(''); setScanErr('');
    try {
      const authHdr = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${base}/receipts/scan`, { dataUrl }, authHdr);
      const f = res.data && res.data.configured && res.data.fields;
      // Nothing usable came back (not configured / unreadable file) — say so
      // instead of leaving the fields silently blank. The upload still stands.
      if (!f) { setScanErr(SCAN_FAIL_NOTE); return; }
      if (f.type) { setType(f.type); setCategory(f.category || (f.type === 'income' ? 'Client Sales' : 'Other')); }
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
      // Fields stay as-is; the receipt is still attached for manual entry — but
      // say so, so a failed scan doesn't read as the AI silently doing nothing.
      setScanErr(SCAN_FAIL_NOTE);
    } finally { setScanning(false); }
  };
  // A real CLIENT PAYMENT (money IN for a sale, not a refund) — the only row a
  // merchant Processing Fee applies to. Drives whether the payment-method picker
  // and the fee preview show.
  const isClientPayment = type === 'income' && category === 'Client Sales' && !isCredit;
  // What the processor will take, previewed live so the owner sees it before saving.
  // Mirrors the backend computeProcessingFee exactly (amount × rate, 2dp) — using
  // the LIVE rates from /api/finances/config, so the preview equals the booked fee.
  const feeRate = feeRates[paymentMethod] || 0;
  const feeLabels = feeMethodLabels(feeRates);
  const feeAmount = isClientPayment ? round((Number(amount) || 0) * feeRate) : 0;

  // One-tap "this is a refund": set Income · Client Sales · Credit so it books as
  // contra-revenue against the order (the owner never has to reason about the
  // Credit toggle). The order # is what links it to the right order, so we surface
  // that the field is required right here.
  const makeRefund = () => {
    setType('income');
    setCategory('Client Sales');
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
    // A vendor PICKED from the suggestions sends its hard link; free-typed text
    // sends none, so the server auto-resolves from the party name instead.
    if (type === 'expense' && vendorId) form.vendorId = vendorId;
    // Tag the payment method on a client payment so the backend auto-books the
    // Processing Fee as a linked cost on the same order. Sent on edits too, so
    // changing/removing the method re-syncs (or clears) the fee row.
    if (type === 'income' && category === 'Client Sales') form.paymentMethod = isCredit ? 'none' : paymentMethod;
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
              Income/Client Sales/Credit combo. "Refund a customer" sets it all up
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
              <Select value={type} onChange={(e) => { setType(e.target.value); setCategory(e.target.value === 'income' ? 'Client Sales' : 'Printer COGS'); }} sx={sel}>
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" type="date" value={date} onChange={(e) => setDate(e.target.value)} sx={fld} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 1 }}>
            <FormControl size="small" sx={fld}>
              <Select value={category}
                onChange={(e) => {
                  // The last row is an action, not a category — open the manager
                  // and leave the current pick untouched.
                  if (e.target.value === '__manage') { if (onManageCategories) onManageCategories(); return; }
                  setCategory(e.target.value);
                }} sx={sel}>
                {/* Live categories from /api/finances/config; keep an off-list saved
                    category selectable so editing an old row can't blank the field. */}
                {(categories.includes(category) ? categories : [...categories, category])
                  .map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                {onManageCategories && (
                  <MenuItem value="__manage" sx={{ borderTop: '1px solid rgba(255,255,255,0.09)', color: '#4ade80', fontWeight: 700 }}>
                    ＋ Edit category list…
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            <TextField size="small" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} sx={fld} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {type === 'expense' ? (
              /* Free-solo vendor picker (the PO builder's pattern): typing stays
                 free-text; picking a suggestion sets the party to the vendor's name
                 AND its hard vendorId link. Retyping clears the link so the server
                 re-resolves the name (never guessing on ambiguity). */
              <Autocomplete
                freeSolo selectOnFocus handleHomeEndKeys
                options={vendors || []}
                value={party}
                getOptionLabel={(o) => (typeof o === 'string' ? o : (o?.name || ''))}
                isOptionEqualToValue={(o, val) =>
                  (typeof o === 'string' ? o : o?.name) === (typeof val === 'string' ? val : val?.name)}
                filterOptions={(opts, state) => {
                  const q = state.inputValue.trim().toLowerCase();
                  if (!q) return opts;
                  return opts.filter((o) =>
                    [o.name, o.contactName, o.address].filter(Boolean).join(' ').toLowerCase().includes(q));
                }}
                onChange={(_e, val) => {
                  if (val && typeof val === 'object') { setParty(val.name || ''); setVendorId(val._id || ''); }
                  else { setParty(typeof val === 'string' ? val : ''); setVendorId(''); }
                }}
                onInputChange={(_e, val, reason) => { if (reason === 'input') { setParty(val); setVendorId(''); } }}
                renderOption={(props, o) => (
                  <Box component="li" {...props} key={o._id} sx={{ fontSize: 13 }}>{o.name}</Box>
                )}
                renderInput={(params) => (
                  <TextField {...params} size="small" placeholder="Vendor" sx={fld} />
                )}
                componentsProps={{ paper: { sx: {
                  bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`,
                  '& .MuiAutocomplete-option': { '&[aria-selected="true"], &.Mui-focused': { bgcolor: 'rgba(74,222,128,0.10)' } },
                } } }}
              />
            ) : (
              <TextField size="small" placeholder="Client" value={party} onChange={(e) => setParty(e.target.value)} sx={fld} />
            )}
            <TextField size="small" placeholder={isRefundMode ? 'Order # (required)' : 'Order #'} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
              sx={isRefundMode && !String(orderNumber).replace(/[^0-9]/g, '')
                ? { ...fld, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(251,113,133,0.6)' } }
                : fld} />
          </Box>
          <TextField size="small" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} sx={fld} />
          {/* Payment method → auto-books the merchant Processing Fee as a cost on
              this order. Only on a real client payment (income · Client Sales, not
              a refund). The fee is previewed live so the owner sees what's deducted. */}
          {isClientPayment && (
            <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, px: 1.25, py: 1, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.75 }}>
                <CreditCardOutlinedIcon sx={{ fontSize: 15, color: B.muted }} />
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: B.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>How was it paid?</Typography>
              </Stack>
              <FormControl size="small" sx={{ ...fld, width: '100%' }}>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} sx={sel}>
                  {['none', 'cc', 'ach'].map((m) => <MenuItem key={m} value={m}>{feeLabels[m]}</MenuItem>)}
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
          {scanErr && <Typography sx={{ color: '#fbbf24', fontSize: 11, opacity: 0.9 }}>{scanErr}</Typography>}
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

function Stat({ label, value, color, big, sub }) {
  return (
    <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ color, fontSize: big ? 24 : 19, fontWeight: 800, fontFamily: 'monospace', mt: 0.25 }}>{value}</Typography>
      {sub && <Typography sx={{ color: B.muted, fontSize: 9, mt: 0.3, lineHeight: 1.3 }}>{sub}</Typography>}
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
