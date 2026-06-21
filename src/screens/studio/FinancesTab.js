// src/screens/studio/FinancesTab.js
//
// The finance tracker UI: P&L, %-of-spend by category, and per-order margins —
// the analytics that replace the manual spreadsheet + QuickBooks re-keying.
// Reads the deterministic /api/finances reports. Load history once by importing
// the JP Ledger CSV; export anytime for your accountant.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, FormControl, Select, MenuItem, CircularProgress,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import axios from 'axios';
import config from '../../config.json';
import { B, scrollbar } from './_shared';

const base = `${config.backendUrl}/api`;
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState('');
  const fileRef = useRef(null);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        axios.get(`${base}/finances/summary`, { ...authHdr, params: { year } }),
        axios.get(`${base}/finances/by-order`, { ...authHdr, params: { year } }),
      ]);
      setSummary(s.data); setOrders(o.data.orders || []);
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
      setBusy(`Imported ${r.data.imported} rows ✓`);
      await load();
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };

  const expenses = summary ? Object.entries(summary.expenseByCategory || {}).sort((a, b) => b[1] - a[1]) : [];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: B.panel, borderBottom: `1px solid ${B.border}`,
        px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
          sx={{ textTransform: 'none', color: B.muted, fontWeight: 600, minWidth: 'auto', px: 1, fontSize: 12,
            '&:hover': { color: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>Studio</Button>
        <Typography sx={{ color: B.green, fontWeight: 800, fontSize: 14, flex: 1 }}>Finances</Typography>
        {busy && <Typography sx={{ fontSize: 11, color: busy.includes('✓') ? B.green : B.muted }}>{busy}</Typography>}
        <FormControl size="small" sx={{ minWidth: 96 }}>
          <Select value={year} onChange={(e) => setYear(e.target.value)}
            sx={{ color: B.white, fontSize: 13, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', '& .MuiSvgIcon-root': { color: B.muted } }}>
            {[2024, 2025, 2026, 2027].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            <MenuItem value="">All years</MenuItem>
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
        ) : !summary || (summary.income === 0 && summary.expense === 0) ? (
          <Box sx={{ border: '1px dashed rgba(255,255,255,0.14)', borderRadius: 3, py: 6, textAlign: 'center', color: B.muted }}>
            <Typography sx={{ fontSize: 13, mb: 1 }}>No transactions for {year || 'any year'} yet.</Typography>
            <Button onClick={() => fileRef.current?.click()} startIcon={<FileUploadOutlinedIcon />}
              sx={{ color: B.green, textTransform: 'none', fontWeight: 700 }}>
              Import your JP Ledger CSV
            </Button>
            <Typography sx={{ fontSize: 11, mt: 1 }}>From the ledger Sheet: File → Download → CSV, then upload here.</Typography>
          </Box>
        ) : (
          <Stack gap={2.5}>
            {/* P&L summary cards */}
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' } }}>
              <Stat label="Revenue" value={money(summary.income)} color={B.white} />
              <Stat label="Expenses" value={money(summary.expense)} color="#f87171" />
              <Stat label="Net profit" value={money(summary.net)} color={summary.net >= 0 ? B.green : '#f87171'} big />
              <Stat label="Margin" value={`${summary.margin}%`} color={summary.margin >= 0 ? B.green : '#f87171'} />
            </Box>
            {summary.ownerContribution > 0 && (
              <Typography sx={{ color: B.muted, fontSize: 11, mt: -1 }}>
                + {money(summary.ownerContribution)} owner contribution (equity, not counted in profit)
              </Typography>
            )}

            {/* Where the money goes */}
            <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 1.5, md: 2 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.25 }}>
                Where the money goes
              </Typography>
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

            {/* Per-order margins */}
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
                      <Box component="th">Revenue</Box><Box component="th">Cost</Box>
                      <Box component="th">Profit</Box><Box component="th">Margin</Box>
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {orders.map((o) => (
                      <Box component="tr" key={o.orderNumber} sx={{ borderTop: '1px solid rgba(255,255,255,0.05)',
                        '& td': { py: 0.7, px: 1.25, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' } }}>
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
          </Stack>
        )}
      </Box>
    </Box>
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
