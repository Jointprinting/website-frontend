// src/screens/studio/FinanceRestartView.js
//
// The guided "Restart finances from my budgets" surface — the finance analogue of
// crm/ReconcileView. SAFE, owner-triggered, preview → confirm flow against the
// backend restart endpoints:
//
//   GET  /api/finances/restart/preview  → the plan (writes NOTHING)
//   POST /api/finances/restart/apply    → execute (requires an explicit confirm)
//   POST /api/finances/restart/revert   → undo a batch by id
//
// Design intent (same as ReconcileView): clear and reassuring, not a firehose. The
// owner reviews the totals / cash position / per-order P&L / discrepancy list, then
// presses Confirm twice. Nothing writes until then. It REPLACES the budget-sourced
// finance rows with his verified ledger and PRESERVES any manual in-app entries the
// budget doesn't represent (so his latest hand entries survive).

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Button, Typography, Chip, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import config from '../../config.json';
import { B, scrollbar } from './_shared';

const base = `${config.backendUrl}/api/finances`;

const money = (n) => {
  const v = Number(n);
  return `$${(Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// A single big number + label tile (mirrors ReconcileView's Stat).
function Stat({ value, label, tone, Icon, sub }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 140, textAlign: 'center', p: 2,
      borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${B.border}`,
    }}>
      {Icon && <Icon sx={{ fontSize: 20, color: tone || B.muted, mb: 0.5 }} />}
      <Typography sx={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 800, color: tone || B.white, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ color: B.muted, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mt: 0.75 }}>
        {label}
      </Typography>
      {sub && <Typography sx={{ color: B.muted, fontSize: 10, mt: 0.4 }}>{sub}</Typography>}
    </Box>
  );
}

const SEV_TONE = { error: '#f87171', warn: '#fbbf24', info: B.muted };

function DiscrepancyRow({ d }) {
  const tone = SEV_TONE[d.severity] || B.muted;
  return (
    <Box sx={{ display: 'flex', gap: 1.25, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${B.border}` }}>
      <WarningAmberOutlinedIcon sx={{ fontSize: 18, color: tone, mt: 0.25, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25, flexWrap: 'wrap' }}>
          <Chip
            label={d.ownerFlagged ? 'you flagged this' : d.kind}
            size="small"
            sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)', color: tone, border: `1px solid ${tone}55` }}
          />
          {d.budgetHint && <Chip label={`budget #${d.budgetHint}`} size="small" sx={{ height: 18, fontSize: 10, color: B.muted, bgcolor: 'transparent', border: `1px solid ${B.border}` }} />}
          {d.projectNumber && <Chip label={`project #${d.projectNumber}`} size="small" sx={{ height: 18, fontSize: 10, color: B.green, bgcolor: 'rgba(74,222,128,0.1)' }} />}
          {d.invoiceNumber && <Chip label={`invoice #${d.invoiceNumber}`} size="small" sx={{ height: 18, fontSize: 10, color: B.muted, bgcolor: 'transparent', border: `1px solid ${B.border}` }} />}
        </Stack>
        <Typography sx={{ color: B.muted, fontSize: 12.5, lineHeight: 1.5 }}>{d.detail}</Typography>
      </Box>
    </Box>
  );
}

// A collapsible list section.
function Section({ title, count, tone, Icon, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  if (!count) return null;
  return (
    <Box sx={{ borderRadius: 2, border: `1px solid ${B.border}`, overflow: 'hidden' }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, cursor: 'pointer',
          bgcolor: B.panelHi, '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
      >
        {Icon && <Icon sx={{ fontSize: 18, color: tone || B.muted }} />}
        <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: B.white, flex: 1 }}>{title}</Typography>
        <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, color: tone || B.white, fontSize: 15 }}>{count}</Typography>
        <ExpandMoreIcon sx={{ fontSize: 20, color: B.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
      </Box>
      <Collapse in={open}>
        <Box sx={{ p: 1.25, bgcolor: B.bg, maxHeight: 320, overflowY: 'auto', ...scrollbar }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function FinanceRestartView({ token, onBack, onApplied }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [plan, setPlan] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [result, setResult] = React.useState(null); // post-apply report (incl. batchId)

  const loadPreview = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${base}/restart/preview`, authHdr);
      setPlan(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the finance restart preview.');
    } finally {
      setLoading(false);
    }
  }, [authHdr]);

  React.useEffect(() => { loadPreview(); }, [loadPreview]);

  const apply = React.useCallback(async () => {
    setApplying(true);
    try {
      const res = await axios.post(`${base}/restart/apply`, { confirm: true }, authHdr);
      setResult(res.data);
      setConfirmOpen(false);
      if (onApplied) onApplied();
      loadPreview();
    } catch (e) {
      setError(e?.response?.data?.message || 'The finance restart could not be applied.');
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  }, [authHdr, onApplied, loadPreview]);

  const s = plan?.summary || {};
  const discrepancies = plan?.discrepancies || [];
  const byOrder = plan?.byOrder || [];
  const perCat = plan?.perCategory || {};

  const Header = (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: B.panel, borderBottom: `1px solid ${B.border}`,
      px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
        sx={{ textTransform: 'none', color: B.muted, fontWeight: 600, minWidth: 'auto', px: 1, fontSize: 12,
          '&:hover': { color: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>Finances</Button>
      <Typography sx={{ color: B.green, fontWeight: 800, fontSize: 14, flex: 1 }}>Restart from my budgets</Typography>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
        {Header}
        <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }} spacing={2}>
          <CircularProgress sx={{ color: B.green }} />
          <Typography sx={{ color: B.muted, fontSize: 13 }}>Reading your budgets &amp; building a safe plan…</Typography>
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
      {Header}
      <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1000, mx: 'auto' }}>
        <Stack spacing={2.5} sx={{ pb: 6 }}>
          {/* Reassurance header */}
          <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: B.panel, border: `1px solid ${B.border}` }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <ShieldOutlinedIcon sx={{ fontSize: 26, color: B.green, mt: 0.25 }} />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: B.white }}>Restart finances from my budgets</Typography>
                <Typography sx={{ color: B.muted, fontSize: 13.5, lineHeight: 1.6, mt: 0.5 }}>
                  This rebuilds your finance page from your monthly budget trackers — your real cash ledger —
                  and shows you EXACTLY what it will do before touching anything. It REPLACES the budget-sourced
                  rows with the verified ledger and <b>KEEPS any entries you added in-app that the budget doesn’t
                  have</b> (your latest hand entries survive). Everything is reversible. Nothing is written until you press Confirm.
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Totals + cash position at a glance */}
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
            <Stat value={money(s.income)} label="Revenue" tone={B.white} />
            <Stat value={money(s.expense)} label="Expenses" tone="#f87171" />
            <Stat value={money(s.net)} label="Net profit" tone={(s.net ?? 0) >= 0 ? B.green : '#f87171'} />
            <Stat value={money(s.cashPosition)} label="Cash position" tone={B.green} Icon={AccountBalanceWalletOutlinedIcon} sub="every debit − every credit" />
          </Stack>

          {/* Owner equity lens (kept OUT of profit) */}
          {((s.ownerContribution ?? 0) > 0 || (s.ownerDraw ?? 0) > 0) && (
            <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: 1.75, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <SavingsOutlinedIcon sx={{ fontSize: 18, color: B.muted }} />
                <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: B.white }}>Your equity (not in profit)</Typography>
              </Stack>
              <Typography sx={{ color: B.muted, fontSize: 12.5, lineHeight: 1.6 }}>
                You put in <Box component="span" sx={{ color: B.white }}>{money(s.ownerContribution)}</Box> (owner contribution — equity, not a sale)
                and took out <Box component="span" sx={{ color: B.white }}>{money(s.ownerDraw)}</Box> (owner draws — not a business cost).
                Neither touches the net profit above; both move your cash position.
              </Typography>
            </Box>
          )}

          {/* What the restart will do to the ledger */}
          <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 2, p: 1.75, bgcolor: 'rgba(255,255,255,0.02)' }}>
            <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>What changes</Typography>
            <Stack spacing={0.75}>
              <Line label="Rows from your budgets to load" value={s.rowsToInsert ?? 0} tone={B.green} />
              <Line label="Prior budget rows to replace" value={s.budgetRowsToReplace ?? 0} tone={B.muted} />
              <Line label="Your manual entries kept (not in the budget)" value={s.manualRowsPreserved ?? 0} tone={B.green} />
              {(s.manualDuplicatesDropped ?? 0) > 0 && (
                <Line label="Manual rows that duplicate a budget row (won’t double-count)" value={s.manualDuplicatesDropped} tone="#fbbf24" />
              )}
              <Line label="Orders found" value={s.orderCount ?? 0} tone={B.white} />
            </Stack>
          </Box>

          {/* DISCREPANCY REPORT — shown prominently, above the action. */}
          {discrepancies.length > 0 && (
            <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <WarningAmberOutlinedIcon sx={{ fontSize: 20, color: '#fbbf24' }} />
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: B.white }}>
                  Review before you confirm ({discrepancies.length})
                </Typography>
              </Stack>
              <Typography sx={{ color: B.muted, fontSize: 12.5, mb: 1.5, lineHeight: 1.5 }}>
                These don’t block the restart — they’re things the budget can’t resolve on its own (e.g. an order
                number you wrote that doesn’t match the app’s project #). The numbers still load; reconcile these
                afterward.
              </Typography>
              <Stack spacing={1}>
                {discrepancies.map((d, i) => <DiscrepancyRow key={i} d={d} />)}
              </Stack>
            </Box>
          )}

          {/* Per-order P&L (the headline of the restart — ALL orders, not 1). */}
          <Section
            title={`Profit by order (${byOrder.length})`} count={byOrder.length} tone={B.white} Icon={ReceiptLongOutlinedIcon}
            defaultOpen
          >
            <Box sx={{ overflowX: 'auto', ...scrollbar }}>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <Box component="thead">
                  <Box component="tr" sx={{ '& th': { color: B.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', textAlign: 'right', py: 0.75, px: 1.25, whiteSpace: 'nowrap' } }}>
                    <Box component="th" sx={{ textAlign: 'left !important' }}>Client</Box>
                    <Box component="th" sx={{ textAlign: 'left !important' }}>Budget #</Box>
                    <Box component="th">Revenue</Box><Box component="th">Cost</Box><Box component="th">Profit</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {byOrder.map((o, i) => (
                    <Box component="tr" key={i}
                      sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', '& td': { py: 0.7, px: 1.25, textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' } }}>
                      <Box component="td" sx={{ textAlign: 'left !important', color: B.white, fontFamily: 'inherit !important', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.client || '—'}
                        {o.ambiguous && <Box component="span" title={o.ambiguousReason} sx={{ ml: 0.75, fontSize: 9.5, fontWeight: 800, color: '#fbbf24' }}>review</Box>}
                      </Box>
                      <Box component="td" sx={{ textAlign: 'left !important', color: B.muted }}>{(o.budgetHints || []).map((h) => `#${h}`).join(', ') || '—'}</Box>
                      <Box component="td" sx={{ color: B.white }}>{money(o.revenue)}</Box>
                      <Box component="td" sx={{ color: '#f87171' }}>{money(o.cost)}</Box>
                      <Box component="td" sx={{ color: (o.profit ?? 0) >= 0 ? B.green : '#f87171' }}>{money(o.profit)}</Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Section>

          {/* Category breakdown */}
          <Section title="Category breakdown" count={Object.keys(perCat.expense || {}).length + Object.keys(perCat.income || {}).length} tone={B.muted}>
            <Stack spacing={0.5}>
              {Object.entries(perCat.income || {}).map(([k, v]) => (
                <Line key={`i-${k}`} label={`${k} (income)`} value={money(v)} tone={B.green} mono />
              ))}
              {Object.entries(perCat.expense || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <Line key={`e-${k}`} label={k} value={money(v)} tone="#f87171" mono />
              ))}
            </Stack>
          </Section>

          {/* Preserved manual entries (so the owner SEES their recent rows survive) */}
          {(plan?.preservedSample || []).length > 0 && (
            <Section title="Your manual entries that will be kept" count={s.manualRowsPreserved ?? (plan.preservedSample || []).length} tone={B.green}>
              <Stack spacing={0.5}>
                {(plan.preservedSample || []).map((t, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.25, py: 0.6, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Typography sx={{ fontSize: 12, color: B.white }} noWrap>{t.party || t.description || '—'}{t.orderNumber ? ` · #${t.orderNumber}` : ''}</Typography>
                    <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: t.type === 'income' ? B.green : '#f87171' }}>{money(t.amount)}</Typography>
                  </Box>
                ))}
              </Stack>
            </Section>
          )}

          <Divider sx={{ borderColor: B.border }} />

          {/* The single action. */}
          {result ? (
            <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(74,222,128,0.08)', border: `1px solid ${B.green}55` }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 24, color: B.green }} />
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: B.white }}>Done — your finances are restarted from your budgets.</Typography>
              </Stack>
              <Typography sx={{ color: B.muted, fontSize: 13, lineHeight: 1.7 }}>
                Loaded {result.inserted} budget row(s) · replaced {result.replaced} prior budget row(s) ·
                kept {result.preserved} of your manual entries
                {result.removedManualDuplicates > 0 ? ` · removed ${result.removedManualDuplicates} duplicate(s) of a budget row` : ''}.
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', color: B.muted, fontSize: 11, mt: 1 }}>
                batch {result.batchId} — keep this if you ever need to undo it.
              </Typography>
            </Box>
          ) : (
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
              <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />}
                sx={{ color: B.muted, textTransform: 'none', fontWeight: 700, '&:hover': { color: B.green } }}>Refresh plan</Button>
              <Button onClick={() => setConfirmOpen(true)} variant="contained" size="large"
                sx={{ bgcolor: B.green, color: '#06281a', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#3cc56f' } }}>
                Confirm &amp; restart finances
              </Button>
            </Stack>
          )}

          {error && plan && (
            <Typography sx={{ color: '#f87171', fontSize: 12.5, textAlign: 'right' }}>{error}</Typography>
          )}
        </Stack>
      </Box>

      {/* Second deliberate step — the confirm gate. */}
      <Dialog
        open={confirmOpen} onClose={applying ? undefined : () => setConfirmOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, backgroundImage: 'none', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm the restart</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: B.muted, fontSize: 13.5, lineHeight: 1.6 }}>
            This will load <b>{s.rowsToInsert ?? 0}</b> rows from your budgets, replace <b>{s.budgetRowsToReplace ?? 0}</b> prior
            budget row(s), and <b>keep {s.manualRowsPreserved ?? 0}</b> of your own in-app entries that the budget
            doesn’t have. Your finance page will then read your real cash ledger
            ({money(s.cashPosition)} cash position).
          </Typography>
          <Typography sx={{ color: B.muted, fontSize: 12.5, mt: 1.5, lineHeight: 1.5 }}>
            Everything is reversible — it’s stamped with a batch id and the prior rows are backed up, so you can
            undo it. You can run this again safely; it won’t duplicate anything.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={applying} sx={{ color: B.muted, textTransform: 'none' }}>Cancel</Button>
          <Button onClick={apply} disabled={applying} variant="contained"
            sx={{ bgcolor: B.green, color: '#06281a', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#3cc56f' } }}>
            {applying ? <CircularProgress size={18} sx={{ color: '#06281a' }} /> : 'Yes, restart it'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// A label → value row (used in the "what changes" + category breakdown lists).
function Line({ label, value, tone, mono }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5 }}>
      <Typography sx={{ color: B.muted, fontSize: 12.5 }}>{label}</Typography>
      <Typography sx={{ color: tone || B.white, fontSize: 13, fontWeight: 700, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</Typography>
    </Stack>
  );
}
