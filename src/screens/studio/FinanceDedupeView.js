// src/screens/studio/FinanceDedupeView.js
//
// The "Review duplicate transactions" surface — the finance analogue of the CRM
// CleanupView, for the CROSS-SOURCE duplicates the budget restart left behind. After
// "restart from my budgets" ran, a handful of payments now appear TWICE: once from the
// budget and once as the owner's own manual/receipt entry of the SAME payment, whose
// dates drifted ~2 weeks apart (so the restart's date-strict dedup missed them). Each
// copy carries DIFFERENT linked data — one has the project/order link, the other an
// uploaded receipt + invoice #. This view shows each duplicate PAIR side by side with
// their links and the single MERGED result, and lets the owner Merge one or Merge all.
// The merge keeps EVERY link and removes the redundant row so the amount counts ONCE.
// Nothing is deleted that isn't first folded onto the survivor; everything is
// reversible (batch id). Auto-hides when there are zero duplicates.
//
// Flow against the backend dedupe endpoints:
//   GET  /api/finances/dedupe/preview  → the duplicate groups + merged previews
//   POST /api/finances/dedupe/apply    → merge (requires confirm; optional pairKeys subset)
//   POST /api/finances/dedupe/revert   → undo a batch by id

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Button, Typography, Chip, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import config from '../../config.json';
import { B, money, ymd } from './_shared';

const base = `${config.backendUrl}/api/finances`;


// The small link chips (receipt / order link / invoice #) shown on a row and on the
// merged result, so the owner SEES exactly which links are being preserved.
function LinkChips({ row, strong }) {
  const chips = [];
  if (row.receiptUrl) chips.push({ label: 'receipt', Icon: ReceiptLongOutlinedIcon });
  if (row.orderNumber) chips.push({ label: `order #${row.orderNumber}`, Icon: LinkOutlinedIcon });
  if (row.invoiceNumber) chips.push({ label: `invoice #${row.invoiceNumber}`, Icon: DescriptionOutlinedIcon });
  if (chips.length === 0) return <Typography sx={{ color: B.muted, fontSize: 10.5, fontStyle: 'italic' }}>no links</Typography>;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {chips.map((c) => (
        <Chip
          key={c.label}
          icon={<c.Icon sx={{ fontSize: 13 }} />}
          label={c.label}
          size="small"
          sx={{
            height: 20, fontSize: 10, fontWeight: 700,
            color: strong ? '#06281a' : B.green,
            bgcolor: strong ? B.green : 'rgba(74,222,128,0.12)',
            '& .MuiChip-icon': { color: strong ? '#06281a' : B.green, ml: 0.5 },
          }}
        />
      ))}
    </Stack>
  );
}

// One source row (the budget copy or the manual/receipt copy) inside a pair card.
function SourceRow({ row, tag, tagColor }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${B.border}` }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
        <Chip label={tag} size="small" sx={{ height: 18, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color: tagColor, bgcolor: 'transparent', border: `1px solid ${tagColor}55` }} />
        <Typography sx={{ color: B.muted, fontSize: 11, fontFamily: 'monospace' }}>{ymd(row.date)}</Typography>
      </Stack>
      <Typography sx={{ color: B.white, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.party || row.description || '—'}
      </Typography>
      {row.description && row.description !== row.party && (
        <Typography sx={{ color: B.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</Typography>
      )}
      <Typography sx={{ color: row.type === 'income' ? B.green : '#f87171', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, my: 0.5 }}>
        {row.type === 'income' ? '+' : '−'}{money(row.amount)}
      </Typography>
      <LinkChips row={row} />
    </Box>
  );
}

// One duplicate pair: the two source rows side by side, an arrow, the merged result,
// and a one-tap Merge button for just this pair.
function PairCard({ group, onMerge }) {
  const [busy, setBusy] = React.useState(false);
  const doMerge = async () => {
    setBusy(true);
    try { await onMerge(group.key); } finally { setBusy(false); }
  };
  const m = group.merged;
  return (
    <Box sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2.5, p: 1.75 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="stretch">
        <SourceRow row={group.budget} tag="from budget" tagColor={B.muted} />
        <SourceRow row={group.manual} tag="your entry" tagColor={B.green} />
        <Stack alignItems="center" justifyContent="center" sx={{ px: 0.5 }}>
          <ArrowForwardIcon sx={{ color: B.green, fontSize: 20, display: { xs: 'none', md: 'block' } }} />
        </Stack>
        {/* The single merged result. */}
        <Box sx={{ flex: 1, minWidth: 0, p: 1.25, borderRadius: 2, bgcolor: 'rgba(74,222,128,0.06)', border: `1px solid ${B.green}55` }}>
          <Typography sx={{ color: B.green, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', mb: 0.5 }}>one merged transaction</Typography>
          <Typography sx={{ color: B.white, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.party || m.description || '—'}</Typography>
          <Typography sx={{ color: m.type === 'income' ? B.green : '#f87171', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, my: 0.5 }}>
            {m.type === 'income' ? '+' : '−'}{money(m.amount)} <Box component="span" sx={{ color: B.muted, fontWeight: 400, fontSize: 10.5 }}>(counts once)</Box>
          </Typography>
          <LinkChips row={m} strong />
        </Box>
      </Stack>
      <Divider sx={{ borderColor: B.border, my: 1.25 }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ color: B.muted, fontSize: 11.5 }}>
          {group.daysApart != null ? `Dates ${group.daysApart} day${group.daysApart === 1 ? '' : 's'} apart. ` : ''}
          Every link is kept; the duplicate is removed so the amount counts once.
        </Typography>
        <Button onClick={doMerge} disabled={busy} size="small"
          startIcon={!busy ? <MergeTypeOutlinedIcon /> : null}
          sx={{ bgcolor: B.green, color: '#06281a', fontWeight: 800, textTransform: 'none', px: 2, '&:hover': { bgcolor: '#3cc56f' }, '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.25)' } }}>
          {busy ? <CircularProgress size={16} sx={{ color: '#06281a' }} /> : 'Merge'}
        </Button>
      </Stack>
    </Box>
  );
}

export default function FinanceDedupeView({ token, onBack, onApplied }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [plan, setPlan] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const loadPreview = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${base}/dedupe/preview`, authHdr);
      setPlan(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the duplicate-transactions preview.');
    } finally {
      setLoading(false);
    }
  }, [authHdr]);

  React.useEffect(() => { loadPreview(); }, [loadPreview]);

  // Merge a subset (one pair) or all. `pairKeys` undefined → all.
  const apply = React.useCallback(async (pairKeys) => {
    const body = { confirm: true };
    if (Array.isArray(pairKeys) && pairKeys.length) body.pairKeys = pairKeys;
    const res = await axios.post(`${base}/dedupe/apply`, body, authHdr);
    if (onApplied) onApplied();
    await loadPreview();
    return res.data;
  }, [authHdr, onApplied, loadPreview]);

  const mergeOne = React.useCallback(async (key) => {
    try { await apply([key]); } catch (e) { setError(e?.response?.data?.message || 'That merge could not be applied.'); }
  }, [apply]);

  const mergeAll = React.useCallback(async () => {
    setApplying(true);
    try {
      const data = await apply(undefined);
      setResult(data);
      setConfirmOpen(false);
    } catch (e) {
      setError(e?.response?.data?.message || 'The merge could not be applied.');
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  }, [apply]);

  const s = plan?.summary || {};
  const groups = plan?.groups || [];

  const Header = (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: B.panel, borderBottom: `1px solid ${B.border}`,
      px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
        sx={{ textTransform: 'none', color: B.muted, fontWeight: 600, minWidth: 'auto', px: 1, fontSize: 12,
          '&:hover': { color: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>Finances</Button>
      <Typography sx={{ color: B.green, fontWeight: 800, fontSize: 14, flex: 1 }}>Review duplicate transactions</Typography>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
        {Header}
        <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }} spacing={2}>
          <CircularProgress sx={{ color: B.green }} />
          <Typography sx={{ color: B.muted, fontSize: 13 }}>Scanning your ledger for duplicate payments…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error && !plan) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
        {Header}
        <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
          <Typography sx={{ color: '#f87171', fontWeight: 700 }}>{error}</Typography>
          <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />} sx={{ color: B.green, textTransform: 'none', fontWeight: 700 }}>Try again</Button>
        </Stack>
      </Box>
    );
  }

  // Auto-hide / clean state: zero duplicates (or everything just merged).
  const noneLeft = groups.length === 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
      {Header}
      <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
        <Stack spacing={2.5} sx={{ pb: 6 }}>
          {/* Reassurance header */}
          <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: B.panel, border: `1px solid ${B.border}` }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <ShieldOutlinedIcon sx={{ fontSize: 26, color: B.green, mt: 0.25 }} />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: B.white }}>Review duplicate transactions</Typography>
                <Typography sx={{ color: B.muted, fontSize: 13.5, lineHeight: 1.6, mt: 0.5 }}>
                  After restarting from your budgets, a few payments show up twice — once from the budget and once
                  as your own entry of the SAME payment (the dates drifted a couple of weeks apart, so the restart
                  didn’t catch them). Each copy carries different links (one has the project/order link, the other a
                  receipt &amp; invoice #). Merging combines them into <b>one transaction that keeps every link</b> and
                  removes the duplicate so the amount counts once. <b>Nothing is deleted that isn’t first folded in,
                  and it’s reversible.</b>
                </Typography>
              </Box>
            </Stack>
          </Box>

          {result ? (
            <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(74,222,128,0.08)', border: `1px solid ${B.green}55` }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 24, color: B.green }} />
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: B.white }}>Done — duplicates merged.</Typography>
              </Stack>
              <Typography sx={{ color: B.muted, fontSize: 13, lineHeight: 1.7 }}>
                Merged {result.merged} duplicate {result.merged === 1 ? 'pair' : 'pairs'} into one transaction each,
                keeping every receipt and link. Removed {result.removed} duplicate {result.removed === 1 ? 'row' : 'rows'}.
              </Typography>
              {result.batchId && (
                <Typography sx={{ fontFamily: 'monospace', color: B.muted, fontSize: 11, mt: 1 }}>
                  batch {result.batchId} — keep this if you ever need to undo it.
                </Typography>
              )}
            </Box>
          ) : noneLeft ? (
            <Box sx={{ border: '1px dashed rgba(255,255,255,0.14)', borderRadius: 3, py: 7, textAlign: 'center' }}>
              <TaskAltOutlinedIcon sx={{ fontSize: 34, color: B.green, mb: 1 }} />
              <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 15 }}>No duplicate transactions</Typography>
              <Typography sx={{ color: B.muted, fontSize: 12.5, mt: 0.5 }}>Your ledger is clean — every payment appears once.</Typography>
            </Box>
          ) : (
            <>
              {/* What will be preserved — the owner's reassurance that nothing is lost. */}
              <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: 1.75, bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>What the merge preserves</Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Stat label="Duplicate pairs" value={s.duplicatePairs ?? groups.length} />
                  <Stat label="Receipts kept" value={s.receiptsPreserved ?? 0} />
                  <Stat label="Order links kept" value={s.orderLinksPreserved ?? 0} />
                  <Stat label="Invoice #s kept" value={s.invoicesPreserved ?? 0} />
                </Stack>
              </Box>

              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14 }}>
                  {groups.length} duplicate {groups.length === 1 ? 'pair' : 'pairs'} to review
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />} size="small"
                    sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, '&:hover': { color: B.green } }}>Refresh</Button>
                  <Button onClick={() => setConfirmOpen(true)} variant="contained" size="small"
                    startIcon={<MergeTypeOutlinedIcon />}
                    sx={{ bgcolor: B.green, color: '#06281a', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#3cc56f' } }}>
                    Merge all
                  </Button>
                </Stack>
              </Stack>

              <Stack spacing={1.5}>
                {groups.map((g) => (
                  <PairCard key={g.key} group={g} onMerge={mergeOne} />
                ))}
              </Stack>

              {error && (
                <Typography sx={{ color: '#f87171', fontSize: 12.5, textAlign: 'right' }}>{error}</Typography>
              )}
            </>
          )}
        </Stack>
      </Box>

      {/* Merge-all confirm gate. */}
      <Dialog
        open={confirmOpen} onClose={applying ? undefined : () => setConfirmOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, backgroundImage: 'none', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Merge all duplicates</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: B.muted, fontSize: 13.5, lineHeight: 1.6 }}>
            This merges <b>{groups.length}</b> duplicate {groups.length === 1 ? 'pair' : 'pairs'} into one transaction
            each. Every receipt, order link, and invoice # is kept on the surviving row, and the duplicate is removed
            so the amount counts once.
          </Typography>
          <Typography sx={{ color: B.muted, fontSize: 12.5, mt: 1.5, lineHeight: 1.5 }}>
            It’s reversible — stamped with a batch id, with both original rows backed up, so you can undo it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={applying} sx={{ color: B.muted, textTransform: 'none' }}>Cancel</Button>
          <Button onClick={mergeAll} disabled={applying} variant="contained"
            sx={{ bgcolor: B.green, color: '#06281a', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#3cc56f' } }}>
            {applying ? <CircularProgress size={18} sx={{ color: '#06281a' }} /> : 'Yes, merge them'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// A small number + label tile.
function Stat({ value, label }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 90 }}>
      <Typography sx={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: B.white, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mt: 0.5 }}>{label}</Typography>
    </Box>
  );
}
