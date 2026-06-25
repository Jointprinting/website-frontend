// src/screens/studio/FinancesTab.js
//
// The finance tracker UI: P&L, %-of-spend by category, per-order margins, and a
// transactions log where each entry can carry its stored receipt/invoice. Pay a
// bill → "Add" → upload the receipt + enter the ACTUAL amount → it files the
// receipt and books the cost into the ledger + analytics in one step (replacing
// the manual "download invoice → personal Drive" habit). Reads /api/finances.

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import axios from 'axios';
import config from '../../config.json';
import { B, darkInput, scrollbar } from './_shared';
import { useContextMenu } from './ContextMenu';
import { buildTransactionMenu, buildFallbackMenu } from './contextMenuActions';

const base = `${config.backendUrl}/api`;
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
const CATEGORIES = [
  'Customer Sales', 'Blank COGS', 'Printer COGS', 'Shipping', 'Art', 'Commission',
  'Software', 'Owner Draw', 'Owner Contribution', 'Sales Tax', 'Refund', 'Other',
];
// COGS categories that net against an order's revenue — MUST match the backend
// Transaction.COGS_CATEGORIES so the drill-in profit reconciles with by-order.
const COGS_CATEGORIES = ['Blank COGS', 'Printer COGS', 'Shipping', 'Art', 'Commission'];
// Canonical order-number key — strips non-digits AND leading zeros, mirroring the
// backend controllers/finances.js normalizeOrderNumber so the drill-in groups a
// "0000021" row and a "21" row into the one order the by-order list keys by.
const normOrderNo = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '').replace(/^0+/, '');
// Signed amount within a row's type bucket (credit reverses direction) — matches
// backend signed(): an income credit nets revenue down, an expense credit nets cost down.
const signedAmt = (t) => (t && t.isCredit ? -(Number(t.amount) || 0) : (Number(t.amount) || 0));
const CAT_COLOR = {
  'Blank COGS': '#60a5fa', 'Printer COGS': '#a78bfa', 'Shipping': '#2dd4bf', 'Art': '#f472b6',
  'Commission': '#fbbf24', 'Software': '#f97316', 'Owner Draw': '#9ca3af', 'Sales Tax': '#ef4444',
  'Refund': '#fb7185', 'Other': '#6b7280',
};
// Is this row money coming IN to the business? Income is normally in; a credit
// flips it — an income credit (customer refund) is money OUT, an expense credit
// (supplier credit) is money IN. Drives the +/− sign and colour in the ledger.
const isInflow = (t) => (t.type === 'income') !== !!t.isCredit;

export default function FinancesTab({ token, onBack }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const { bind: bindMenu, registerFallback } = useContextMenu();
  const [year, setYear]       = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [orders, setOrders]   = useState([]);
  const [txns, setTxns]       = useState([]);
  const [months, setMonths]   = useState([]);
  const [clients, setClients] = useState([]);
  const [gaps, setGaps]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState('');
  const [showAdd, setShowAdd] = useState(false);
  // Prefill for "record payment for this order" — opens the Add-transaction
  // modal already set to Income · Customer Sales · the order's client + amount.
  const [prefill, setPrefill] = useState(null);
  const [editTxn, setEditTxn] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);
  const [bannerDismiss, setBannerDismiss] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jpFinBanner') || 'null'); } catch (_) { return null; }
  });
  const [bannerLeaving, setBannerLeaving] = useState(false);
  const fileRef = useRef(null);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const [s, o, t, m, c, g] = await Promise.all([
        axios.get(`${base}/finances/summary`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-order`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/transactions`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-month`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-client`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/payment-gaps`, { ...authHdr, params: { year } }),
      ]);
      setSummary(s.data); setOrders(o.data.orders || []); setTxns(t.data.transactions || []);
      setMonths(m.data.months || []); setClients(c.data.clients || []); setGaps(g.data || null);
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  }, [authHdr, year]);

  useEffect(() => { load(); }, [load]);

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
        <Button onClick={() => setShowAdd(true)} size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
          sx={{ color: B.green, textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Add</Button>
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <Select value={year} onChange={(e) => setYear(e.target.value)}
            sx={{ color: B.white, fontSize: 13, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', '& .MuiSvgIcon-root': { color: B.muted } }}>
            {[2024, 2025, 2026, 2027].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            <MenuItem value="">All</MenuItem>
          </Select>
        </FormControl>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; importCsv(f); }} />
        <IconButton size="small" title="Import JP Ledger CSV" onClick={() => fileRef.current?.click()}
          sx={{ color: B.muted, '&:hover': { color: B.green } }}><FileUploadOutlinedIcon fontSize="small" /></IconButton>
        <IconButton size="small" title="Export CSV" onClick={exportCsv}
          sx={{ color: B.muted, '&:hover': { color: B.green } }}><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
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
              <Stat label="Margin" value={`${summary.margin}%`} color={summary.margin >= 0 ? B.green : '#f87171'} />
            </Box>
            {/* Owner cash lens — what the business EARNED (profit, above) vs what
                you TOOK HOME (draws) vs what was LEFT IN the business. Profit
                stays draw-excluded (correct for taxes); this is the additive
                "where did the money go" answer. Shown whenever there's a draw —
                the figure people actually want to see. */}
            {summary.ownerDraw > 0 && (
              <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your money</Typography>
                  <Typography sx={{ color: B.muted, fontSize: 10.5 }}>Profit is what the business earned · draws aren’t a cost</Typography>
                </Stack>
                <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'repeat(2,1fr)' } }}>
                  <Stat label="Profit (earned)" value={money(summary.net)} color={summary.net >= 0 ? B.green : '#f87171'} />
                  <Stat label="Take-home (draws)" value={money(summary.takeHome)} color={B.white} />
                </Box>
                <Typography sx={{ color: B.muted, fontSize: 11, mt: 1 }}>
                  The business earned <Box component="span" sx={{ color: B.white }}>{money(summary.net)}</Box>;
                  you took home <Box component="span" sx={{ color: B.white }}>{money(summary.takeHome)}</Box> in owner draws.
                  {summary.ownerContribution > 0 && <> {' '}(+ {money(summary.ownerContribution)} you put in — equity, not income.)</>}
                </Typography>
              </Box>
            )}
            {summary.ownerDraw === 0 && summary.ownerContribution > 0 && (
              <Typography sx={{ color: B.muted, fontSize: 11, mt: -1 }}>
                + {money(summary.ownerContribution)} owner contribution — equity, not counted in profit
              </Typography>
            )}

            {/* Money owed to you / Unrecorded payments — the additive lens that
                EXPLAINS a low net: vendor costs entered without the matching
                client payment. One tap records the missing income, prefilled. */}
            <PaymentGaps gaps={gaps} onRecord={(row) => setPrefill({
              type: 'income', category: 'Customer Sales',
              party: row.client && row.client !== '—' ? row.client : '',
              amount: row.outstanding > 0 ? row.outstanding : (row.billed > 0 ? row.billed : ''),
              orderNumber: row.orderNumber,
              description: `Payment — order #${row.orderNumber}${row.client && row.client !== '—' ? ` · ${row.client}` : ''}`,
            })} />

            <MonthlyTrend months={months} />

            <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.25 }}>Where the money goes</Typography>
              <Stack gap={1}>
                {expenses.map(([cat, amt]) => {
                  const pct = summary.pctOfSpend?.[cat] || 0;
                  return (
                    <Box key={cat}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
                        <Typography sx={{ color: B.white, fontSize: 12 }}>{cat}</Typography>
                        <Typography sx={{ color: B.muted, fontSize: 12, fontFamily: 'monospace' }}>{money(amt)} · {pct}%</Typography>
                      </Stack>
                      <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <Box sx={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', bgcolor: CAT_COLOR[cat] || B.green,
                          transformOrigin: 'left', animation: 'jpGrowX 700ms cubic-bezier(.2,.7,.3,1) both' }} />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            <TopClients clients={clients} />

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
                    {orders.map((o) => (
                      <Box component="tr" key={o.orderNumber} onClick={() => setOpenOrder(o.orderNumber)}
                        sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.035)' }, '& td': { py: 0.7, px: 1.25, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' } }}>
                        <Box component="td" sx={{ textAlign: 'left !important', color: B.muted }}>#{o.orderNumber}</Box>
                        <Box component="td" sx={{ textAlign: 'left !important', color: B.white, fontFamily: 'inherit !important', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.client || '—'}</Box>
                        <Box component="td" sx={{ color: B.white }}>{money(o.revenue)}</Box>
                        <Box component="td" sx={{ color: '#f87171' }}>{money(o.cost)}</Box>
                        <Box component="td" sx={{ color: o.profit >= 0 ? B.green : '#f87171' }}>{money(o.profit)}</Box>
                        <Box component="td" sx={{ color: o.margin >= 0 ? B.green : '#f87171' }}>{o.margin}%</Box>
                      </Box>
                    ))}
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
                        <Box component="td" sx={{ py: 0.6, px: 1.25, color: B.muted, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>{new Date(t.date).toISOString().slice(0, 10)}</Box>
                        <Box component="td" sx={{ py: 0.6, px: 0.5, whiteSpace: 'nowrap' }}>
                          <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 1, fontSize: 10, fontWeight: 700,
                            color: t.type === 'income' ? B.green : '#f87171', bgcolor: t.type === 'income' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)' }}>
                            {t.category}
                          </Box>
                          {t.isCredit && <CreditBadge />}
                        </Box>
                        <Box component="td" sx={{ py: 0.6, px: 1, color: B.white, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.party || t.description}{t.orderNumber ? <Box component="span" sx={{ color: B.muted }}> · #{t.orderNumber}</Box> : null}
                        </Box>
                        <Box component="td" sx={{ py: 0.6, px: 1, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap', color: isInflow(t) ? B.green : '#f87171' }}>
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
        onEditTxn={(t) => { setOpenOrder(null); setEditTxn(t); }} />}
    </Box>
  );
}

// Click any order (Profit-by-order row, or a red "lost money" chip) to see every
// transaction tagged to it — revenue and every cost — with in/out/net. Tap a line
// to jump into editing it (e.g. fix a wrong date that parked an order in December).
function OrderDialog({ orderNumber, txns, onClose, onEditTxn }) {
  // Match on the CANONICAL number (leading zeros stripped, both sides) so the
  // drill-in shows the same rows the by-order grouping rolled up — a "0000021"
  // ledger row lines up with the "21" order the user clicked. (C2)
  const key = normOrderNo(orderNumber);
  const rows = (txns || []).filter((t) => normOrderNo(t.orderNumber) === key)
    .slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  // Credit-aware cash view: a supplier credit counts as money IN, a customer
  // refund as money OUT — so In/Out read true even with returns mixed in.
  const income  = rows.filter((t) => isInflow(t)).reduce((s, t) => s + t.amount, 0);
  const expense = rows.filter((t) => !isInflow(t)).reduce((s, t) => s + t.amount, 0);
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
      <Box sx={{ px: 2.5, py: 1.2, borderBottom: `1px solid ${B.border}`, display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Order #{orderNumber}{client !== '—' ? ` · ${client}` : ''}
        </Typography>
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
                    {new Date(t.date).toISOString().slice(0, 10)}
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
                  <Box component="td" sx={{ py: 0.7, px: 1.5, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap',
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
function PaymentGaps({ gaps, onRecord }) {
  const rows = (gaps && gaps.orders) || [];
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
                sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', '& td': { py: 0.7, px: 1.25, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' } }}>
                <Box component="td" sx={{ textAlign: 'left !important', color: B.muted }}>#{o.orderNumber}</Box>
                <Box component="td" sx={{ textAlign: 'left !important', color: B.white, fontFamily: 'inherit !important', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.client || '—'}</Box>
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

function MonthlyTrend({ months }) {
  if (!months || months.length === 0) return null;
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, Math.abs(m.net))));
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
          const [y, mo] = m.month.split('-');
          const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-US', { month: 'short' });
          return (
            <Box key={m.month} sx={{ minWidth: 36, flexShrink: 0, textAlign: 'center' }}
              title={`${label} ${y} · revenue ${money(m.income)} · profit ${money(m.net)}`}>
              <Box sx={{ height: 92, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0.5 }}>
                <Box sx={{ width: 9, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.22)', height: `${Math.max(2, (m.income / max) * 100)}%`,
                  transformOrigin: 'bottom', animation: 'jpGrowY 460ms ease both', animationDelay: `${mi * 45}ms` }} />
                <Box sx={{ width: 9, borderRadius: 0.5, bgcolor: m.net >= 0 ? B.green : '#f87171', height: `${Math.max(2, (Math.abs(m.net) / max) * 100)}%`,
                  transformOrigin: 'bottom', animation: 'jpGrowY 460ms ease both', animationDelay: `${mi * 45 + 60}ms` }} />
              </Box>
              <Typography sx={{ fontSize: 9.5, color: B.muted, mt: 0.4 }}>{label}</Typography>
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

function TopClients({ clients }) {
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
              <Box component="tr" key={c.client} sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', '& td': { py: 0.7, px: 1.25, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' } }}>
                <Box component="td" sx={{ textAlign: 'left !important', color: B.white, fontFamily: 'inherit !important', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.client}</Box>
                <Box component="td" sx={{ color: B.muted }}>{c.orders}</Box>
                <Box component="td" sx={{ color: B.white }}>{money(c.revenue)}</Box>
                <Box component="td" sx={{ color: c.profit >= 0 ? B.green : '#f87171' }}>{money(c.profit)}</Box>
                <Box component="td" sx={{ color: c.margin >= 0 ? B.green : '#f87171' }}>{c.margin}%</Box>
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
  const [date, setDate] = useState(txn ? new Date(txn.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(seed?.category || (seed?.type === 'income' ? 'Customer Sales' : 'Printer COGS'));
  const [amount, setAmount] = useState(seed?.amount != null && seed?.amount !== '' ? String(seed.amount) : '');
  const [orderNumber, setOrderNumber] = useState(seed?.orderNumber || '');
  const [party, setParty] = useState(seed?.party || '');
  const [description, setDescription] = useState(seed?.description || '');
  const [isCredit, setIsCredit] = useState(!!txn?.isCredit);
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
  const save = async () => {
    if (!amount || Number(amount) <= 0) { setErr('Enter an amount'); return; }
    setSaving(true); setErr('');
    const form = { type, date, category, amount: Number(amount), orderNumber: String(orderNumber).replace(/[^0-9]/g, ''), party, description, isCredit };
    if (receiptDataUrl) form.receiptDataUrl = receiptDataUrl;
    try { await onSave(form); } catch (e) { setErr(e.response?.data?.message || e.message); setSaving(false); }
  };

  const fld = { ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.9 } };
  const sel = { color: B.white, fontSize: 13, borderRadius: 1.5, '& .MuiSvgIcon-root': { color: B.muted } };
  const hasReceipt = !!(txn && txn.receiptUrl);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ px: 2.5, py: 1.2, borderBottom: `1px solid ${B.border}`, display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>{edit ? 'Edit transaction' : 'Add transaction'}</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        <Stack gap={1.25}>
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
            <TextField size="small" placeholder="Order #" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} sx={fld} />
          </Box>
          <TextField size="small" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} sx={fld} />
          {/* Credit / return toggle — books a positive amount that flows the
              opposite way, so a refund or supplier credit nets correctly instead
              of looking like a charge/sale. */}
          <Box onClick={() => setIsCredit((v) => !v)}
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, cursor: 'pointer', userSelect: 'none',
              border: `1px solid ${isCredit ? 'rgba(251,191,36,0.55)' : B.border}`, borderRadius: 1.5, px: 1.25, py: 0.85,
              bgcolor: isCredit ? 'rgba(251,191,36,0.08)' : 'transparent', transition: 'border-color 160ms ease, background 160ms ease' }}>
            <Box sx={{ width: 16, height: 16, mt: 0.15, borderRadius: 0.5, flexShrink: 0,
              border: `2px solid ${isCredit ? '#fbbf24' : B.muted}`, bgcolor: isCredit ? '#fbbf24' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 160ms ease' }}>
              {isCredit && <CheckIcon sx={{ fontSize: 12, color: '#1a1206' }} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: isCredit ? '#fbbf24' : B.white }}>Credit / return</Typography>
              <Typography sx={{ fontSize: 10.5, color: B.muted, lineHeight: 1.35 }}>
                {isCredit
                  ? (type === 'income'
                      ? 'Customer refund — money back to a client (lowers this order’s revenue).'
                      : 'Supplier credit — money back from a vendor (lowers this order’s cost).')
                  : 'Tick if this is money flowing back — a refund or a credit memo.'}
              </Typography>
            </Box>
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
          {!edit && !receiptName && (
            <Typography sx={{ color: B.muted, fontSize: 10.5, mt: -0.4 }}>
              Attach a receipt and the AI fills in vendor, amount, date &amp; category for you.
            </Typography>
          )}
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
