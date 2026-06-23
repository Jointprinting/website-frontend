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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import config from '../../config.json';
import { B, darkInput, scrollbar } from './_shared';

const base = `${config.backendUrl}/api`;
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const CATEGORIES = [
  'Customer Sales', 'Blank COGS', 'Printer COGS', 'Shipping', 'Art', 'Commission',
  'Software', 'Owner Draw', 'Owner Contribution', 'Sales Tax', 'Refund', 'Other',
];
const CAT_COLOR = {
  'Blank COGS': '#60a5fa', 'Printer COGS': '#a78bfa', 'Shipping': '#2dd4bf', 'Art': '#f472b6',
  'Commission': '#fbbf24', 'Software': '#f97316', 'Owner Draw': '#9ca3af', 'Sales Tax': '#ef4444',
  'Refund': '#fb7185', 'Other': '#6b7280',
};

export default function FinancesTab({ token, onBack }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [year, setYear]       = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [orders, setOrders]   = useState([]);
  const [txns, setTxns]       = useState([]);
  const [months, setMonths]   = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);
  const [bannerDismiss, setBannerDismiss] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jpFinBanner') || 'null'); } catch (_) { return null; }
  });
  const fileRef = useRef(null);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const [s, o, t, m, c] = await Promise.all([
        axios.get(`${base}/finances/summary`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-order`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/transactions`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-month`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-client`, { ...authHdr, params: { year } }),
      ]);
      setSummary(s.data); setOrders(o.data.orders || []); setTxns(t.data.transactions || []);
      setMonths(m.data.months || []); setClients(c.data.clients || []);
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

  const expenses = summary ? Object.entries(summary.expenseByCategory || {}).sort((a, b) => b[1] - a[1]) : [];
  const empty = !summary || (summary.income === 0 && summary.expense === 0 && txns.length === 0);

  // #1 alarm: an order that was sold but lost money (revenue in, profit negative).
  // Orders with no recorded sale yet (revenue 0) aren't losses — they're pending.
  const losers = (orders || []).filter((o) => o.revenue > 0 && o.profit < 0);
  const lossTotal = losers.reduce((s, o) => s + Math.abs(o.profit), 0);
  // Dismissable status banner: hidden only for the exact same state on the same
  // day — so it clears when you ack it, but returns tomorrow or if it changes.
  const bannerState = losers.length > 0 ? 'red' : (summary && summary.net < 0 ? 'amber' : 'green');
  const bannerSig = `${year}|${bannerState}|${losers.map((o) => o.orderNumber).join(',')}`;
  const today = new Date().toISOString().slice(0, 10);
  // A lost-money order is critical — it can't be dismissed away (no ✕, never
  // hidden). Amber/green are dismissable for the day, then they come back.
  const bannerHidden = bannerState !== 'red' && bannerDismiss && bannerDismiss.sig === bannerSig && bannerDismiss.date === today;
  const dismissBanner = () => {
    const d = { sig: bannerSig, date: today };
    try { localStorage.setItem('jpFinBanner', JSON.stringify(d)); } catch (_) {}
    setBannerDismiss(d);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
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

      <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
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
            {/* Calm-control status — three honest states:
                RED   any sold order lost money (your #1 alarm)
                AMBER orders are fine but merch net is in the red (overhead/timing — what VT3D was hiding)
                GREEN orders profitable AND merch is in the black
                ✕ clears it for the day; it returns tomorrow or if the state changes. */}
            {!bannerHidden && (
            <Box sx={{ position: 'relative' }}>
              {bannerState !== 'red' && (
                <IconButton size="small" onClick={dismissBanner} title="Dismiss for today"
                  sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, color: B.muted, '&:hover': { color: B.white } }}>
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
            ) : summary.net < 0 ? (
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
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, border: '1px solid rgba(74,222,128,0.3)',
                bgcolor: 'rgba(74,222,128,0.06)', borderRadius: 2, px: 2, py: 1.25 }}>
                <CheckCircleOutlineIcon sx={{ color: B.green }} />
                <Box>
                  <Typography sx={{ color: B.green, fontWeight: 800, fontSize: 14 }}>All clear</Typography>
                  <Typography sx={{ color: B.muted, fontSize: 12 }}>
                    Every order {year || 'on record'} made money and merch is in the black. Nothing needs you.
                  </Typography>
                </Box>
              </Box>
            )}
            </Box>
            )}

            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' } }}>
              <Stat label="Revenue" value={money(summary.income)} color={B.white} />
              <Stat label="Expenses" value={money(summary.expense)} color="#f87171" />
              <Stat label="Net profit" value={money(summary.net)} color={summary.net >= 0 ? B.green : '#f87171'} big />
              <Stat label="Margin" value={`${summary.margin}%`} color={summary.margin >= 0 ? B.green : '#f87171'} />
            </Box>
            {(summary.ownerContribution > 0 || summary.ownerDraw > 0) && (
              <Typography sx={{ color: B.muted, fontSize: 11, mt: -1 }}>
                {summary.ownerContribution > 0 && <>+ {money(summary.ownerContribution)} owner contribution</>}
                {summary.ownerContribution > 0 && summary.ownerDraw > 0 && ' · '}
                {summary.ownerDraw > 0 && <>− {money(summary.ownerDraw)} owner draw (you paid yourself)</>}
                {' '}— equity, not counted in profit
              </Typography>
            )}

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
                        <Box sx={{ width: `${Math.min(100, pct)}%`, height: '100%', bgcolor: CAT_COLOR[cat] || B.green }} />
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
                      <Box component="tr" key={t._id} onClick={() => setEditTxn(t)}
                        sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                        <Box component="td" sx={{ py: 0.6, px: 1.25, color: B.muted, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>{new Date(t.date).toISOString().slice(0, 10)}</Box>
                        <Box component="td" sx={{ py: 0.6, px: 0.5 }}>
                          <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 1, fontSize: 10, fontWeight: 700,
                            color: t.type === 'income' ? B.green : '#f87171', bgcolor: t.type === 'income' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)' }}>
                            {t.category}
                          </Box>
                        </Box>
                        <Box component="td" sx={{ py: 0.6, px: 1, color: B.white, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.party || t.description}{t.orderNumber ? <Box component="span" sx={{ color: B.muted }}> · #{t.orderNumber}</Box> : null}
                        </Box>
                        <Box component="td" sx={{ py: 0.6, px: 1, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap', color: t.type === 'income' ? B.green : '#f87171' }}>
                          {t.type === 'income' ? '+' : '−'}{money(t.amount)}
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

      {showAdd && <TxnDialog token={token} onClose={() => setShowAdd(false)} onSave={addTxn} />}
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
  const rows = (txns || []).filter((t) => String(t.orderNumber) === String(orderNumber))
    .slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const income  = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = income - expense;
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
                  <Box component="td" sx={{ py: 0.7, px: 0.5 }}>
                    <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 1, fontSize: 10, fontWeight: 700,
                      color: t.type === 'income' ? B.green : '#f87171', bgcolor: t.type === 'income' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)' }}>
                      {t.category}
                    </Box>
                  </Box>
                  <Box component="td" sx={{ py: 0.7, px: 1, color: B.white, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.party || t.description || ''}
                  </Box>
                  <Box component="td" sx={{ py: 0.7, px: 1.5, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap',
                    color: t.type === 'income' ? B.green : '#f87171' }}>
                    {t.type === 'income' ? '+' : '−'}{money(t.amount)}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ borderTop: `1px solid ${B.border}`, px: 1.5, py: 1.25, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Typography sx={{ fontSize: 12, color: B.muted }}>In <Box component="span" sx={{ color: B.green, fontFamily: 'monospace' }}>{money(income)}</Box></Typography>
          <Typography sx={{ fontSize: 12, color: B.muted }}>Out <Box component="span" sx={{ color: '#f87171', fontFamily: 'monospace' }}>{money(expense)}</Box></Typography>
          <Typography sx={{ fontSize: 12, color: B.muted }}>Net <Box component="span" sx={{ color: net >= 0 ? B.green : '#f87171', fontFamily: 'monospace', fontWeight: 700 }}>{money(net)}</Box></Typography>
        </Box>
        {rows.length > 0 && <Typography sx={{ color: B.muted, fontSize: 10.5, px: 1.5, pb: 1.5 }}>Tap a line to edit it (e.g. fix a wrong date).</Typography>}
      </DialogContent>
    </Dialog>
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
        {months.map((m) => {
          const [y, mo] = m.month.split('-');
          const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-US', { month: 'short' });
          return (
            <Box key={m.month} sx={{ minWidth: 36, flexShrink: 0, textAlign: 'center' }}
              title={`${label} ${y} · revenue ${money(m.income)} · profit ${money(m.net)}`}>
              <Box sx={{ height: 92, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0.5 }}>
                <Box sx={{ width: 9, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.22)', height: `${Math.max(2, (m.income / max) * 100)}%` }} />
                <Box sx={{ width: 9, borderRadius: 0.5, bgcolor: m.net >= 0 ? B.green : '#f87171', height: `${Math.max(2, (Math.abs(m.net) / max) * 100)}%` }} />
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

function TxnDialog({ txn, token, onClose, onSave, onDelete }) {
  const edit = !!txn;
  const [type, setType] = useState(txn?.type || 'expense');
  const [date, setDate] = useState(txn ? new Date(txn.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(txn?.category || 'Printer COGS');
  const [amount, setAmount] = useState(txn ? String(txn.amount) : '');
  const [orderNumber, setOrderNumber] = useState(txn?.orderNumber || '');
  const [party, setParty] = useState(txn?.party || '');
  const [description, setDescription] = useState(txn?.description || '');
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
      setScanNote('Auto-filled from the receipt — double-check it before saving.');
    } catch (_) {
      // leave fields as-is; the receipt is still attached for manual entry
    } finally { setScanning(false); }
  };
  const save = async () => {
    if (!amount || Number(amount) <= 0) { setErr('Enter an amount'); return; }
    setSaving(true); setErr('');
    const form = { type, date, category, amount: Number(amount), orderNumber: String(orderNumber).replace(/[^0-9]/g, ''), party, description };
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
