// src/screens/studio/OrderReconcileView.js
//
// "Reconcile order #" — the one-tap surface that folds a single real order's SCATTERED
// numbers down to one canonical # (e.g. Happy Leaf was written as #141 in the ledger,
// #1050/#1052 elsewhere — all the SAME order). It previews EXACTLY which ledger rows and
// order docs would change (old # → #138) so the owner sees it before anything is written,
// applies on confirm, and is fully reversible (batch id). Auto-hides upstream once the
// preview comes back empty (everything already reads the canonical number) — so it leaves
// no lingering clutter.
//
//   GET  /api/finances/order-reconcile/preview → the plan (no writes)
//   POST /api/finances/order-reconcile/apply    → renumber (requires confirm)
//   POST /api/finances/order-reconcile/revert   → undo a batch by id

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Button, Typography, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import config from '../../config.json';
import { B } from './_shared';

const base = `${config.backendUrl}/api/finances`;
const money = (n) => {
  const v = Number(n);
  return `$${(Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// One record that will be renumbered: its kind + detail on the left, old # → new # right.
function ChangeRow({ c }) {
  const isOrder = c.collection === 'Order';
  const label = isOrder
    ? `Order · ${c.client || '—'}${c.status ? ` · ${c.status}` : ''}`
    : `${c.type === 'income' ? 'Payment' : 'Cost'} · ${c.party || '—'}`;
  const detail = isOrder
    ? (c.totalValue ? money(c.totalValue) : '')
    : `${c.type === 'income' ? '+' : '−'}${money(c.amount)}${c.description ? ` · ${c.description}` : ''}`;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.7, px: 1.25,
      borderTop: `1px solid ${B.border}` }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: B.white, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Typography>
        <Typography sx={{ color: B.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</Typography>
      </Box>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
        <Chip label={`#${c.from || '—'}`} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 800, fontFamily: 'monospace', color: B.muted, bgcolor: 'rgba(255,255,255,0.05)' }} />
        <ArrowForwardIcon sx={{ color: B.green, fontSize: 15 }} />
        <Chip label={`#${c.to}`} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 800, fontFamily: 'monospace', color: '#06281a', bgcolor: B.green }} />
      </Stack>
    </Box>
  );
}

// One target order's fold: its label + canonical #, and every record that moves onto it.
function PlanCard({ plan }) {
  return (
    <Box sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2.5, overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 13.5, flex: 1 }}>
          {plan.target.label}
        </Typography>
        <Typography sx={{ color: B.muted, fontSize: 11.5 }}>
          {plan.count} record{plan.count === 1 ? '' : 's'} → <Box component="span" sx={{ color: B.green, fontWeight: 800, fontFamily: 'monospace' }}>#{plan.canonical}</Box>
        </Typography>
      </Box>
      {plan.canonicalChanged && (
        <Typography sx={{ color: '#fbbf24', fontSize: 11, px: 1.5, pb: 0.75 }}>
          #{plan.target.label} note: the first-choice number was already a different order, so these fold to #{plan.canonical} instead.
        </Typography>
      )}
      {plan.changes.map((c) => <ChangeRow key={`${c.collection}-${c.id}`} c={c} />)}
    </Box>
  );
}

export default function OrderReconcileView({ token, onBack, onApplied }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [plan, setPlan] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const loadPreview = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(`${base}/order-reconcile/preview`, authHdr);
      setPlan(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the reconcile preview.');
    } finally { setLoading(false); }
  }, [authHdr]);

  React.useEffect(() => { loadPreview(); }, [loadPreview]);

  const apply = React.useCallback(async () => {
    setApplying(true);
    try {
      const res = await axios.post(`${base}/order-reconcile/apply`, { confirm: true }, authHdr);
      setResult(res.data);
      setConfirmOpen(false);
      if (onApplied) onApplied();
      await loadPreview();
    } catch (e) {
      setError(e?.response?.data?.message || 'The reconcile could not be applied.');
      setConfirmOpen(false);
    } finally { setApplying(false); }
  }, [authHdr, onApplied, loadPreview]);

  const s = plan?.summary || {};
  const plans = plan?.plans || [];
  const noneLeft = plans.length === 0;

  const Header = (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: B.panel, borderBottom: `1px solid ${B.border}`,
      px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
        sx={{ textTransform: 'none', color: B.muted, fontWeight: 600, minWidth: 'auto', px: 1, fontSize: 12,
          '&:hover': { color: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>Finances</Button>
      <Typography sx={{ color: B.green, fontWeight: 800, fontSize: 14, flex: 1 }}>Reconcile order numbers</Typography>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
        {Header}
        <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }} spacing={2}>
          <CircularProgress sx={{ color: B.green }} />
          <Typography sx={{ color: B.muted, fontSize: 13 }}>Scanning for orders with scattered numbers…</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
      {Header}
      <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 920, mx: 'auto' }}>
        <Stack spacing={2.5} sx={{ pb: 6 }}>
          <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: B.panel, border: `1px solid ${B.border}` }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <ShieldOutlinedIcon sx={{ fontSize: 26, color: B.green, mt: 0.25 }} />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: B.white }}>Reconcile order numbers</Typography>
                <Typography sx={{ color: B.muted, fontSize: 13.5, lineHeight: 1.6, mt: 0.5 }}>
                  One real order sometimes ends up under several numbers (a budget #, an invoice #, the project #).
                  This folds every ledger row and order doc that points at one of those numbers onto a single
                  canonical # so the finances line up. <b>You see exactly what changes below before anything is
                  written, and it’s fully reversible.</b>
                </Typography>
              </Box>
            </Stack>
          </Box>

          {result ? (
            <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(74,222,128,0.08)', border: `1px solid ${B.green}55` }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 24, color: B.green }} />
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: B.white }}>Done — numbers reconciled.</Typography>
              </Stack>
              <Typography sx={{ color: B.muted, fontSize: 13, lineHeight: 1.7 }}>
                Renumbered {result.count} record{result.count === 1 ? '' : 's'}
                {result.transactions != null ? ` (${result.transactions} ledger row${result.transactions === 1 ? '' : 's'}, ${result.orders} order doc${result.orders === 1 ? '' : 's'})` : ''}.
                This surface will disappear on its own now that everything reads one number.
              </Typography>
              {result.batchId && (
                <Typography sx={{ fontFamily: 'monospace', color: B.muted, fontSize: 11, mt: 1 }}>
                  batch {result.batchId} — keep this if you ever need to undo it.
                </Typography>
              )}
              <Button onClick={onBack} sx={{ mt: 1.5, color: B.green, textTransform: 'none', fontWeight: 700 }}>← Back to Finances</Button>
            </Box>
          ) : noneLeft ? (
            <Box sx={{ border: '1px dashed rgba(255,255,255,0.14)', borderRadius: 3, py: 7, textAlign: 'center' }}>
              <TaskAltOutlinedIcon sx={{ fontSize: 34, color: B.green, mb: 1 }} />
              <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 15 }}>Nothing to reconcile</Typography>
              <Typography sx={{ color: B.muted, fontSize: 12.5, mt: 0.5 }}>Every order already reads a single number.</Typography>
            </Box>
          ) : (
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14 }}>
                  {s.orders} order{s.orders === 1 ? '' : 's'} · {s.count} record{s.count === 1 ? '' : 's'} to fold
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />} size="small"
                    sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, '&:hover': { color: B.green } }}>Refresh</Button>
                  <Button onClick={() => setConfirmOpen(true)} variant="contained" size="small"
                    startIcon={<MergeTypeOutlinedIcon />}
                    sx={{ bgcolor: B.green, color: '#06281a', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#3cc56f' } }}>
                    Reconcile all
                  </Button>
                </Stack>
              </Stack>
              <Stack spacing={1.5}>
                {plans.map((p) => <PlanCard key={p.target.key} plan={p} />)}
              </Stack>
              {error && <Typography sx={{ color: '#f87171', fontSize: 12.5, textAlign: 'right' }}>{error}</Typography>}
            </>
          )}

          {error && !plan && (
            <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
              <Typography sx={{ color: '#f87171', fontWeight: 700 }}>{error}</Typography>
              <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />} sx={{ color: B.green, textTransform: 'none', fontWeight: 700 }}>Try again</Button>
            </Stack>
          )}
        </Stack>
      </Box>

      <Dialog open={confirmOpen} onClose={applying ? undefined : () => setConfirmOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, backgroundImage: 'none', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Reconcile these numbers?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: B.muted, fontSize: 13.5, lineHeight: 1.6 }}>
            This renumbers <b>{s.count}</b> record{s.count === 1 ? '' : 's'} across <b>{s.orders}</b> order{s.orders === 1 ? '' : 's'} to their canonical number. It’s stamped with a batch id and fully reversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={applying} sx={{ color: B.muted, textTransform: 'none' }}>Cancel</Button>
          <Button onClick={apply} disabled={applying} variant="contained"
            sx={{ bgcolor: B.green, color: '#06281a', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#3cc56f' } }}>
            {applying ? <CircularProgress size={18} sx={{ color: '#06281a' }} /> : 'Yes, reconcile'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
