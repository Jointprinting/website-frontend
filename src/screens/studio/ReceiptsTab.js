// src/screens/studio/ReceiptsTab.js
//
// The receipt inbox. Pay an invoice → upload the receipt (image, PDF, or a whole
// zip) → Claude reads vendor/amount/date/order#/category → you review & correct →
// "Book" files a clean expense into the ledger with the receipt attached. The
// original file is stored the moment it's uploaded, so a cost is never lost even
// if the read is delayed by a rate limit (the queue resumes on its own).
//
// Reads /api/receipts. Every step is in your control — the AI only fills fields.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, FormControl, Select, MenuItem,
  CircularProgress, Dialog, DialogContent, TextField, Chip, Tooltip, Autocomplete,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import axios from 'axios';
import config from '../../config.json';
import { B, darkInput, scrollbar, fmt, fmtDate } from './_shared';

const base = `${config.backendUrl}/api`;

// A paid receipt is always an expense — only the cost buckets apply.
const EXPENSE_CATEGORIES = [
  'Blank COGS', 'Printer COGS', 'Shipping', 'Art', 'Commission', 'Software', 'Sales Tax', 'Other',
];

const STATUS = {
  pending:    { label: 'Queued',       color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  processing: { label: 'Reading…',     color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  review:     { label: 'Needs review', color: '#fbbf24', bg: 'rgba(251,191,36,0.16)' },
  booked:     { label: 'Booked',       color: '#4ade80', bg: 'rgba(74,222,128,0.16)' },
  failed:     { label: 'Failed',       color: '#f87171', bg: 'rgba(248,113,113,0.16)' },
  ignored:    { label: 'Backup',       color: '#6b7280', bg: 'rgba(107,114,128,0.14)' },
};
const conf = { high: '#4ade80', medium: '#fbbf24', low: '#f87171' };

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const isImg = (m) => /^image\//.test(m || '') && !/heic|heif/.test(m || '');
const digits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
const orderLabel = (o) => `#${o.orderNumber}${o.companyName || o.clientName ? ` · ${o.companyName || o.clientName}` : ''}`;

export default function ReceiptsTab({ token, onBack }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [receipts, setReceipts] = useState([]);
  const [counts, setCounts] = useState({});
  const [queue, setQueue] = useState({});
  const [filter, setFilter] = useState('');       // '' = all
  const [year, setYear] = useState('');           // '' = all years
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [review, setReview] = useState(null);     // receipt being reviewed
  const [orders, setOrders] = useState([]);       // for the order picker in review
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading((l) => (receipts.length ? l : true));
    try {
      const params = {};
      if (filter) params.status = filter;
      if (year) params.year = year;
      const r = await axios.get(`${base}/receipts`, { ...authHdr, params });
      setReceipts(r.data.receipts || []);
      setCounts(r.data.counts || {});
      setQueue(r.data.queue || {});
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  }, [authHdr, filter, year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Load recent orders once so receipt review can tag the right job from a
  // dropdown — a supplier invoice rarely prints YOUR order #, so you pick it.
  useEffect(() => {
    axios.get(`${base}/orders`, { ...authHdr, params: { limit: 200 } })
      .then((r) => setOrders(r.data.orders || []))
      .catch(() => {});
  }, [authHdr]);

  // Poll while there's active work so statuses flip from Reading… → Needs review
  // without a manual refresh (and so a rate-limit pause visibly resumes).
  const active = queue.running || queue.paused || (counts.pending || 0) > 0 || (counts.processing || 0) > 0;
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [active, load]);

  const upload = async (files) => {
    const arr = files ? [...files] : [];
    if (!arr.length) return;
    const fd = new FormData();
    arr.forEach((f) => fd.append('files', f));
    setBusy(`Uploading ${arr.length} file${arr.length === 1 ? '' : 's'}…`);
    try {
      const r = await axios.post(`${base}/receipts/batch`, fd, { ...authHdr, timeout: 180000 });
      const skipped = (r.data.skipped || []).length;
      setBusy(`Queued ${r.data.created} receipt${r.data.created === 1 ? '' : 's'}${skipped ? ` · skipped ${skipped}` : ''} ✓`);
    } catch (e) {
      setBusy(e.response?.data?.message || e.message || 'Upload failed');
    } finally {
      await load();   // surface whatever landed, even if the request errored/timed out
    }
  };

  const reprocess = async (id) => {
    try { await axios.post(`${base}/receipts/${id}/reprocess`, {}, authHdr); await load(); }
    catch (e) { setBusy(e.response?.data?.message || e.message); }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this receipt? (A booked ledger entry stays — delete that in Finances.)')) return;
    try { await axios.delete(`${base}/receipts/${id}`, authHdr); await load(); }
    catch (e) { setBusy(e.response?.data?.message || e.message); }
  };
  // Link every read receipt that matches an existing ledger expense (attaches
  // the file, no new charges) so a big back-catalog clears in one click; only
  // the unmatched stay for manual review.
  const bulkLink = async () => {
    if (!window.confirm('Attach each receipt to the matching expense already in your ledger (no new charges — your ledger stays the source of truth). Anything without a match stays in review. Continue?')) return;
    setBusy('Linking…');
    try {
      const r = await axios.post(`${base}/receipts/bulk-reconcile`, {}, authHdr);
      setBusy(`Linked ${r.data.linked} · ${r.data.unmatched} left to review ✓`);
      await load();
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };
  // Clear the nag: everything left in review is already saved + searchable; mark
  // it kept-as-backup so the review count goes to zero.
  const archiveRest = async () => {
    setBusy('Filing…');
    try {
      const r = await axios.post(`${base}/receipts/archive-rest`, {}, authHdr);
      setBusy(`${r.data.archived} kept as backup ✓`);
      await load();
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };

  const pills = [
    { v: '', label: 'All', n: receipts.length && !filter ? receipts.length : (counts.review || 0) + (counts.pending || 0) + (counts.processing || 0) + (counts.booked || 0) + (counts.failed || 0) + (counts.ignored || 0) },
    { v: 'review', label: 'Needs review', n: counts.review || 0 },
    { v: 'processing', label: 'Reading', n: (counts.processing || 0) + (counts.pending || 0) },
    { v: 'booked', label: 'Booked', n: counts.booked || 0 },
    { v: 'failed', label: 'Failed', n: counts.failed || 0 },
    { v: 'ignored', label: 'Backup', n: counts.ignored || 0 },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
      {/* header */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: B.panel, borderBottom: `1px solid ${B.border}`,
        px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
          sx={{ textTransform: 'none', color: B.muted, fontWeight: 600, minWidth: 'auto', px: 1, fontSize: 12,
            '&:hover': { color: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>Studio</Button>
        <Typography sx={{ color: B.green, fontWeight: 800, fontSize: 14, flex: 1 }}>Receipts</Typography>
        {busy && <Typography sx={{ fontSize: 11, color: busy.includes('✓') ? B.green : B.muted }}>{busy}</Typography>}
        <Button onClick={bulkLink} size="small" startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
          sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, fontSize: 12, '&:hover': { color: B.green } }}>
          Link matches
        </Button>
        <Button onClick={archiveRest} size="small" startIcon={<InventoryOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, fontSize: 12, '&:hover': { color: B.green } }}>
          Keep rest as backup
        </Button>
        <FormControl size="small" sx={{ minWidth: 84 }}>
          <Select value={year} displayEmpty onChange={(e) => setYear(e.target.value)}
            sx={{ color: B.white, fontSize: 13, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', '& .MuiSvgIcon-root': { color: B.muted } }}>
            <MenuItem value="">All yrs</MenuItem>
            {[2024, 2025, 2026, 2027].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf,.heic,.heif,.zip" multiple hidden
          onChange={(e) => { const fs = [...e.target.files]; e.target.value = ''; upload(fs); }} />
        <Button onClick={() => fileRef.current?.click()} size="small" variant="contained"
          startIcon={<CloudUploadOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ bgcolor: B.green, color: B.greenDk, textTransform: 'none', fontWeight: 800, fontSize: 12,
            '&:hover': { bgcolor: '#3bd070' } }}>Upload</Button>
      </Box>

      <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
        {/* scanner status banner */}
        {queue.configured === false && (
          <Banner color="#fbbf24" icon={<WarningAmberOutlinedIcon sx={{ fontSize: 18 }} />}>
            Auto-reading is off — set <code style={{ color: B.white }}>ANTHROPIC_API_KEY</code> on the backend to turn it on.
            You can still upload receipts and fill them in by hand.
          </Banner>
        )}
        {queue.paused && (
          <Banner color="#60a5fa" icon={<CircularProgress size={14} sx={{ color: '#60a5fa' }} />}>
            Paused for a rate limit — it’ll resume reading automatically, nothing is lost.
          </Banner>
        )}
        {queue.configured && !queue.paused && active && (
          <Banner color="#60a5fa" icon={<CircularProgress size={14} sx={{ color: '#60a5fa' }} />}>
            Reading receipts… {queue.queued || 0} in the queue.
          </Banner>
        )}

        {/* filter pills */}
        <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ mb: 2, mt: queue.configured === false || active || queue.paused ? 1.5 : 0 }}>
          {pills.map((p) => (
            <Box key={p.v || 'all'} onClick={() => setFilter(p.v)} role="button"
              sx={{ cursor: 'pointer', px: 1.4, py: 0.5, borderRadius: 99, fontSize: 12.5, fontWeight: 700, userSelect: 'none',
                border: '1px solid', transition: 'all .15s',
                borderColor: filter === p.v ? B.green : 'rgba(255,255,255,0.1)',
                bgcolor: filter === p.v ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.03)',
                color: filter === p.v ? B.green : B.muted,
                '&:hover': { color: B.white } }}>
              {p.label}<Box component="span" sx={{ ml: 0.7, fontFamily: 'monospace', fontSize: 11, color: filter === p.v ? B.green : 'rgba(255,255,255,0.4)' }}>{p.n}</Box>
            </Box>
          ))}
        </Stack>

        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: B.green }} /></Box>
        ) : receipts.length === 0 ? (
          <Box sx={{ border: '1px dashed rgba(255,255,255,0.14)', borderRadius: 3, py: 6, px: 2, textAlign: 'center', color: B.muted }}>
            <CloudUploadOutlinedIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
            <Typography sx={{ fontSize: 13, mb: 0.5 }}>No receipts here yet.</Typography>
            <Typography sx={{ fontSize: 12 }}>
              Upload a paid receipt — image, PDF, or a whole zip — and it’ll read each one, then let you review and book it.
            </Typography>
            <Button onClick={() => fileRef.current?.click()} startIcon={<CloudUploadOutlinedIcon />}
              sx={{ mt: 1.5, color: B.green, textTransform: 'none', fontWeight: 700 }}>Upload receipts</Button>
          </Box>
        ) : (
          <Stack gap={1}>
            {receipts.map((r) => (
              <ReceiptRow key={r._id} r={r} onReview={() => setReview(r)} onRetry={() => reprocess(r._id)} onDelete={() => remove(r._id)} />
            ))}
          </Stack>
        )}
      </Box>

      {review && (
        <ReviewDialog key={review._id} rec={review} authHdr={authHdr} orders={orders} onClose={() => setReview(null)}
          onChanged={() => { setReview(null); load(); }} />
      )}
    </Box>
  );
}

function Banner({ color, icon, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, mb: 1.5,
      bgcolor: `${color}14`, border: `1px solid ${color}33`, color }}>
      {icon}
      <Typography sx={{ fontSize: 12.5, color: B.white, opacity: 0.92 }}>{children}</Typography>
    </Box>
  );
}

function ReceiptRow({ r, onReview, onRetry, onDelete }) {
  const s = STATUS[r.status] || STATUS.pending;
  const e = r.extracted || {};
  const reviewable = r.status === 'review' || r.status === 'failed' || r.status === 'pending';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: 2,
      bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      transition: 'all .15s', '&:hover': { borderColor: 'rgba(74,222,128,0.3)' } }}>
      <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10.5, height: 22, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: B.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
            {e.vendor || r.fileName || 'Untitled receipt'}
          </Typography>
          {e.confidence && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: conf[e.confidence] || '#9ca3af', flexShrink: 0 }} title={`${e.confidence} confidence`} />}
        </Stack>
        <Typography sx={{ color: B.muted, fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {e.category || '—'}{e.orderNumber ? ` · #${e.orderNumber}` : ''}{e.date ? ` · ${fmtDate(e.date)}` : ''}
          {(r.flags || []).length ? ` · ⚠ ${r.flags.join(', ')}` : ''}
          {r.status === 'failed' && r.extractionError ? ` · ${r.extractionError}` : ''}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 14, color: e.amount ? B.white : B.muted, flexShrink: 0, fontFamily: 'monospace' }}>
        {e.amount != null ? fmt(e.amount) : '—'}
      </Typography>
      {r.fileUrl && (
        <Tooltip title="Open file"><IconButton size="small" component="a" href={r.fileUrl} target="_blank" rel="noreferrer"
          sx={{ color: B.muted, '&:hover': { color: B.green } }}><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      )}
      {r.status === 'failed' && (
        <Tooltip title="Read again"><IconButton size="small" onClick={onRetry} sx={{ color: B.muted, '&:hover': { color: B.green } }}><RefreshIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      )}
      {reviewable && (
        <Button onClick={onReview} size="small" variant="contained"
          sx={{ bgcolor: r.status === 'review' ? B.green : 'rgba(255,255,255,0.08)', color: r.status === 'review' ? B.greenDk : B.white,
            textTransform: 'none', fontWeight: 700, fontSize: 11.5, minWidth: 'auto', px: 1.25, '&:hover': { bgcolor: r.status === 'review' ? '#3bd070' : 'rgba(255,255,255,0.16)' } }}>
          Review
        </Button>
      )}
      <Tooltip title="Delete"><IconButton size="small" onClick={onDelete} sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
    </Box>
  );
}

function ReviewDialog({ rec, authHdr, orders = [], onClose, onChanged }) {
  const e0 = rec.extracted || {};
  const [vendor, setVendor] = useState(e0.vendor || '');
  const [date, setDate] = useState(toDateInput(e0.date));
  const [amount, setAmount] = useState(e0.amount != null ? String(e0.amount) : '');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES.includes(e0.category) ? e0.category : 'Other');
  const [orderNumber, setOrderNumber] = useState('');  // blank by default — a receipt's printed # is the supplier's invoice #, not one of our order #s
  const [summary, setSummary] = useState(e0.summary || '');
  const [kind, setKind] = useState(e0.kind === 'refund' ? 'refund' : 'charge');
  const [saving, setSaving] = useState('');
  const [err, setErr] = useState('');
  const [dup, setDup] = useState(null);

  const payload = () => ({ vendor, date, amount: Number(amount), category, orderNumber, summary, kind });

  const book = async (force = false) => {
    if (!amount || Number(amount) <= 0) { setErr('Enter an amount.'); return; }
    setSaving('book'); setErr(''); setDup(null);
    try {
      await axios.post(`${base}/receipts/${rec._id}/confirm`, { extracted: payload(), force }, authHdr);
      onChanged();
    } catch (ex) {
      if (ex.response?.status === 409) { setDup(ex.response.data.duplicate); setSaving(''); }
      else { setErr(ex.response?.data?.message || ex.message); setSaving(''); }
    }
  };
  const saveDraft = async () => {
    setSaving('draft'); setErr('');
    try { await axios.put(`${base}/receipts/${rec._id}`, { extracted: payload() }, authHdr); onChanged(); }
    catch (ex) { setErr(ex.response?.data?.message || ex.message); setSaving(''); }
  };
  const ignore = async () => {
    setSaving('ignore');
    try { await axios.put(`${base}/receipts/${rec._id}`, { status: 'ignored' }, authHdr); onChanged(); }
    catch (ex) { setErr(ex.response?.data?.message || ex.message); setSaving(''); }
  };

  const lines = e0.lineItems || [];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, borderRadius: 3, border: `1px solid ${B.border}` } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, py: 1.5, borderBottom: `1px solid ${B.faint}` }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Review receipt</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: B.muted }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ ...scrollbar }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {/* file preview */}
          <Box sx={{ bgcolor: '#0c1410', borderRadius: 2, border: `1px solid ${B.faint}`, minHeight: 240, display: 'flex',
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {isImg(rec.fileMime) ? (
              <Box component="img" src={rec.fileUrl} alt="receipt" sx={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />
            ) : (
              <Stack alignItems="center" spacing={1} sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ color: B.muted, fontSize: 12 }}>{rec.fileName || 'Receipt file'}</Typography>
                <Button component="a" href={rec.fileUrl} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />}
                  sx={{ color: B.green, textTransform: 'none', fontWeight: 700 }}>Open {/(pdf)/i.test(rec.fileMime) ? 'PDF' : 'file'}</Button>
              </Stack>
            )}
          </Box>

          {/* fields */}
          <Stack gap={1.5}>
            <Field label="Vendor"><TextField value={vendor} onChange={(e) => setVendor(e.target.value)} size="small" fullWidth sx={darkInput} /></Field>
            <Field label="Type">
              <FormControl size="small" fullWidth sx={darkInput}>
                <Select value={kind} onChange={(ev) => setKind(ev.target.value)}>
                  <MenuItem value="charge">Charge — money out (expense)</MenuItem>
                  <MenuItem value="refund">Credit / refund — money back (income)</MenuItem>
                </Select>
              </FormControl>
            </Field>
            <Stack direction="row" gap={1.5}>
              <Field label="Amount (total charged)"><TextField value={amount} onChange={(e) => setAmount(e.target.value)} size="small" fullWidth sx={darkInput}
                InputProps={{ startAdornment: <Typography sx={{ color: B.muted, mr: 0.5 }}>$</Typography> }} /></Field>
              <Field label="Date"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} size="small" fullWidth sx={darkInput} /></Field>
            </Stack>
            <Stack direction="row" gap={1.5}>
              <Field label="Category">
                <FormControl size="small" fullWidth sx={darkInput}>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {EXPENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Field>
              <Field label="Order # (links to the job)">
                <Autocomplete
                  freeSolo autoSelect handleHomeEndKeys
                  options={orders}
                  getOptionLabel={(o) => (typeof o === 'string' ? o : orderLabel(o))}
                  defaultValue={orderNumber || null}
                  onChange={(_e, v) => setOrderNumber(digits(typeof v === 'string' ? v : (v ? String(v.orderNumber) : '')))}
                  renderOption={(props, o) => {
                    const { key, ...rest } = props;
                    return <li key={o._id || o.orderNumber} {...rest}>{orderLabel(o)}{o.status ? ` · ${o.status}` : ''}</li>;
                  }}
                  renderInput={(params) => <TextField {...params} size="small" fullWidth sx={darkInput} placeholder="optional — type # or pick the job" />}
                />
              </Field>
            </Stack>
            <Field label="Description"><TextField value={summary} onChange={(e) => setSummary(e.target.value)} size="small" fullWidth sx={darkInput} /></Field>

            {(rec.flags || []).length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', color: '#fbbf24', fontSize: 12 }}>
                <WarningAmberOutlinedIcon sx={{ fontSize: 16, mt: 0.1 }} />
                <Typography sx={{ fontSize: 12, color: '#fbbf24' }}>{rec.flags.join(' · ')}</Typography>
              </Box>
            )}
            {lines.length > 0 && (
              <Box sx={{ border: `1px solid ${B.faint}`, borderRadius: 1.5, p: 1, maxHeight: 120, overflow: 'auto', ...scrollbar }}>
                <Typography sx={{ fontSize: 10.5, color: B.muted, mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Line items (read-only)</Typography>
                {lines.map((li, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between" sx={{ fontSize: 11.5, color: B.white, opacity: 0.85, py: 0.2 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{li.qty ? `${li.qty}× ` : ''}{li.description}</span>
                    <span style={{ fontFamily: 'monospace', flexShrink: 0 }}>{li.amount != null ? fmt(li.amount) : ''}</span>
                  </Stack>
                ))}
              </Box>
            )}
          </Stack>
        </Box>

        {dup && (
          <Box sx={{ mt: 2, p: 1.25, borderRadius: 2, bgcolor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)' }}>
            <Typography sx={{ fontSize: 12.5, color: '#fbbf24', fontWeight: 700, mb: 0.3 }}>Possible duplicate already in the ledger</Typography>
            <Typography sx={{ fontSize: 12, color: B.white, opacity: 0.9 }}>
              {fmtDate(dup.date)} · {dup.party || '—'} · {fmt(dup.amount)} · {dup.category}{dup.orderNumber ? ` · #${dup.orderNumber}` : ''}
            </Typography>
            <Stack direction="row" gap={1} sx={{ mt: 1 }}>
              <Button onClick={() => book(true)} size="small" variant="contained"
                sx={{ bgcolor: '#fbbf24', color: '#1a1300', textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#f0b000' } }}>Book anyway</Button>
              <Button onClick={() => setDup(null)} size="small" sx={{ color: B.muted, textTransform: 'none' }}>Cancel</Button>
            </Stack>
          </Box>
        )}
        {err && <Typography sx={{ color: '#f87171', fontSize: 12, mt: 1.5 }}>{err}</Typography>}

        {!dup && (
          <Stack direction="row" gap={1} sx={{ mt: 2.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button onClick={ignore} disabled={!!saving} size="small" sx={{ color: B.muted, textTransform: 'none', mr: 'auto' }}>Ignore</Button>
            <Button onClick={saveDraft} disabled={!!saving} size="small"
              sx={{ color: B.white, textTransform: 'none', fontWeight: 700, border: '1px solid rgba(255,255,255,0.16)' }}>
              {saving === 'draft' ? <CircularProgress size={16} sx={{ color: B.white }} /> : 'Save edits'}
            </Button>
            <Button onClick={() => book(false)} disabled={!!saving} size="small" variant="contained"
              startIcon={saving === 'book' ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />}
              sx={{ bgcolor: B.green, color: B.greenDk, textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#3bd070' } }}>
              Book into ledger
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography sx={{ fontSize: 10.5, color: B.muted, mb: 0.4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
      {children}
    </Box>
  );
}

