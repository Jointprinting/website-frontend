// src/screens/studio/crm/ReconcileView.js
//
// The guided "Load / reconcile my data" surface. This REPLACES the removed
// one-click CRM import footgun with a SAFE, owner-triggered, preview → confirm
// flow against the backend reconcile endpoints:
//
//   GET  /api/crm/reconcile/preview  → the plan (writes NOTHING)
//   POST /api/crm/reconcile/apply    → execute (requires an explicit confirm)
//   POST /api/crm/reconcile/revert   → undo a batch by id
//
// Design intent: clear and reassuring, NOT a firehose. The owner just got burned
// by a one-click import, so nothing here writes until they read the plan + the
// discrepancy report and press Confirm twice. The plan is loaded once and shown;
// Confirm sends the same plan the preview described back to the server.

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Button, Typography, Chip, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import config from '../../../config.json';
import { D, mono, dropPrimaryBtn, dropGhostBtn } from '../_shared';

const base = `${config.backendUrl}/api/crm`;

// A single big number + label tile (mirrors the old import preview's ResultStat).
function Stat({ value, label, tone, Icon }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 120, textAlign: 'center', p: 2,
      borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}`,
    }}>
      {Icon && <Icon sx={{ fontSize: 20, color: tone || D.muted, mb: 0.5 }} />}
      <Typography sx={{ ...mono, fontSize: 30, fontWeight: 800, color: tone || D.text, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mt: 0.75 }}>
        {label}
      </Typography>
    </Box>
  );
}

const SEV_TONE = { error: '#f87171', warn: D.amber, info: D.muted };

// One discrepancy row in the report.
function DiscrepancyRow({ d }) {
  const tone = SEV_TONE[d.severity] || D.muted;
  return (
    <Box sx={{ display: 'flex', gap: 1.25, p: 1.5, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
      <WarningAmberOutlinedIcon sx={{ fontSize: 18, color: tone, mt: 0.25, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: D.text }}>{d.company || '—'}</Typography>
          <Chip
            label={d.ownerFlagged ? 'you flagged this' : d.kind}
            size="small"
            sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)', color: tone, border: `1px solid ${tone}55` }}
          />
        </Stack>
        <Typography sx={{ color: D.muted, fontSize: 12.5, lineHeight: 1.5 }}>{d.detail}</Typography>
      </Box>
    </Box>
  );
}

// A collapsible list section (e.g. "53 companies to add").
function Section({ title, count, tone, Icon, items, renderItem, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  if (!count) return null;
  return (
    <Box sx={{ borderRadius: 2, border: `1px solid ${D.line}`, overflow: 'hidden' }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, cursor: 'pointer',
          bgcolor: D.panelHi, '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
      >
        {Icon && <Icon sx={{ fontSize: 18, color: tone || D.muted }} />}
        <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: D.text, flex: 1 }}>{title}</Typography>
        <Typography sx={{ ...mono, fontWeight: 800, color: tone || D.text, fontSize: 15 }}>{count}</Typography>
        <ExpandMoreIcon sx={{ fontSize: 20, color: D.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
      </Box>
      <Collapse in={open}>
        <Stack spacing={0.5} sx={{ p: 1.25, bgcolor: D.bg, maxHeight: 280, overflowY: 'auto' }}>
          {items.map(renderItem)}
        </Stack>
      </Collapse>
    </Box>
  );
}

export default function ReconcileView({ token, onApplied }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [plan, setPlan] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [result, setResult] = React.useState(null); // post-apply report (incl. batchId)
  // Has reconcile EVER been applied (any prior session)? This is a ONE-TIME tool —
  // once the data's loaded we don't shove the full plan + a big "Confirm" button at
  // the owner again; we show a quiet "already loaded" card with a small re-run link.
  const [status, setStatus] = React.useState(null);     // { applied, lastBatchId, at }
  const [forceShow, setForceShow] = React.useState(false); // owner clicked "re-run"

  // Load the PLAN (dry-run; writes nothing). Re-runnable.
  const loadPreview = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${base}/reconcile/preview`, authHdr);
      setPlan(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the reconcile preview.');
    } finally {
      setLoading(false);
    }
  }, [authHdr]);

  // Has it been applied before? Cheap status check; failure just falls back to the
  // normal flow (treated as "not applied").
  const loadStatus = React.useCallback(async () => {
    try {
      const res = await axios.get(`${base}/reconcile/status`, authHdr);
      setStatus(res.data || { applied: false });
    } catch (_) {
      setStatus({ applied: false });
    }
  }, [authHdr]);

  React.useEffect(() => { loadPreview(); loadStatus(); }, [loadPreview, loadStatus]);

  // Auto-hide gate: when it's already applied (and the owner hasn't explicitly
  // chosen to re-run this session) AND there's nothing fresh waiting, show the
  // quiet "done" card instead of the firehose.
  const alreadyApplied = !!(status && status.applied) && !forceShow && !result;

  // Apply — the ONLY write. Requires the explicit confirm flag; the dialog gate is
  // the second deliberate step.
  const apply = React.useCallback(async () => {
    setApplying(true);
    try {
      const res = await axios.post(`${base}/reconcile/apply`, { confirm: true }, authHdr);
      setResult(res.data);
      setConfirmOpen(false);
      if (onApplied) onApplied();
      // Re-pull the preview so it now reads as a no-op (idempotency made visible),
      // and refresh status so the next visit lands on the quiet "already loaded" card.
      loadPreview();
      loadStatus();
    } catch (e) {
      setError(e?.response?.data?.message || 'The reconcile could not be applied.');
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  }, [authHdr, onApplied, loadPreview, loadStatus]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }} spacing={2}>
        <CircularProgress sx={{ color: D.green }} />
        <Typography sx={{ color: D.muted, fontSize: 13 }}>Reading your data &amp; building a safe plan…</Typography>
      </Stack>
    );
  }

  if (error && !plan) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
        <Typography sx={{ color: '#f87171', fontWeight: 700 }}>{error}</Typography>
        <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />} sx={dropGhostBtn}>Try again</Button>
      </Stack>
    );
  }

  // Already loaded in a prior session → quiet confirmation, not the full firehose.
  // A small "re-run" link reveals the whole plan + Confirm again if ever needed,
  // so nothing is lost — just out of the way.
  if (alreadyApplied) {
    return (
      <Stack spacing={2} sx={{ py: 4 }} alignItems="center">
        <Box sx={{ maxWidth: 460, width: '100%', p: 3, borderRadius: 3, textAlign: 'center',
          bgcolor: D.panel, border: `1px solid ${D.line}` }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 30, color: D.green, mb: 1 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: D.text }}>Your data is loaded.</Typography>
          <Typography sx={{ color: D.muted, fontSize: 13, mt: 0.75, lineHeight: 1.6 }}>
            This one-time load already ran — your CRM is reconciled. You don’t need to do anything here.
          </Typography>
          {status && status.lastBatchId && (
            <Typography sx={{ ...mono, color: D.faint, fontSize: 11, mt: 1 }}>batch&nbsp;{status.lastBatchId}</Typography>
          )}
          <Button
            onClick={() => { setForceShow(true); loadPreview(); }}
            startIcon={<RefreshOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ mt: 2, textTransform: 'none', color: D.faint, fontWeight: 600, fontSize: 12,
              '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.06)' } }}
          >
            Re-run the load
          </Button>
        </Box>
      </Stack>
    );
  }

  const s = plan?.summary || {};
  const discrepancies = plan?.discrepancies || [];
  const nothingToDo = s.noOp;

  return (
    <Stack spacing={2.5} sx={{ pb: 6 }}>
      {/* Reassurance header */}
      <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: D.panel, border: `1px solid ${D.line}` }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <ShieldOutlinedIcon sx={{ fontSize: 26, color: D.green, mt: 0.25 }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: D.text }}>Load / reconcile my data</Typography>
            <Typography sx={{ color: D.muted, fontSize: 13.5, lineHeight: 1.6, mt: 0.5 }}>
              This reads your cleaned Notion CRM and shows you EXACTLY what it will do before touching anything.
              It loads your real clients, <b>archives the {s.metaAdJunkToArchive ?? 0} bad “Meta Ad” rows</b> (archived,
              never deleted — fully restorable), loads your past orders, and lists anything that needs a look.
              Nothing is written until you press Confirm.
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* The plan at a glance */}
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
        <Stat value={(s.clientsToCreate ?? 0) + (s.clientsToUpdate ?? 0)} label="Real clients to load" tone={D.green} Icon={GroupAddOutlinedIcon} />
        <Stat value={s.metaAdJunkToArchive ?? 0} label="Meta-ad rows to archive" tone={D.amber} Icon={Inventory2OutlinedIcon} />
        <Stat value={s.ordersToLoad ?? 0} label="Past orders to load" tone={D.text} Icon={ReceiptLongOutlinedIcon} />
        <Stat value={discrepancies.length} label="Things to review" tone={discrepancies.length ? '#f87171' : D.muted} Icon={WarningAmberOutlinedIcon} />
      </Stack>

      {/* DISCREPANCY REPORT — shown prominently, above the action. */}
      {discrepancies.length > 0 && (
        <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(248,113,113,0.06)', border: `1px solid rgba(248,113,113,0.3)` }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <WarningAmberOutlinedIcon sx={{ fontSize: 20, color: '#f87171' }} />
            <Typography sx={{ fontWeight: 800, fontSize: 15, color: D.text }}>
              Review before you confirm ({discrepancies.length})
            </Typography>
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 12.5, mb: 1.5, lineHeight: 1.5 }}>
            These don’t block the load — they’re things the data couldn’t resolve on its own. Loading still proceeds;
            fix these afterward (e.g. add a missing order number) or in your Notion export and re-run.
          </Typography>
          <Stack spacing={1}>
            {discrepancies.map((d, i) => <DiscrepancyRow key={i} d={d} />)}
          </Stack>
        </Box>
      )}

      {/* What exactly will change (collapsible detail) */}
      <Stack spacing={1.25}>
        <Section
          title="Companies to add" count={(plan.clientsToCreate || []).length} tone={D.green} Icon={GroupAddOutlinedIcon}
          items={plan.clientsToCreate || []}
          renderItem={(c) => (
            <Box key={c.companyKey} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: D.text }} noWrap>{c.name}</Typography>
                {c.akas && c.akas.length > 0 && (
                  <Typography sx={{ fontSize: 11, color: D.faint }} noWrap>also: {c.akas.join(', ')}</Typography>
                )}
              </Box>
              <Chip label={c.stage} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, color: D.green, bgcolor: 'rgba(74,222,128,0.1)' }} />
            </Box>
          )}
        />
        <Section
          title="Companies to update (already in your CRM)" count={(plan.clientsToUpdate || []).length} tone={D.text} Icon={GroupAddOutlinedIcon}
          items={plan.clientsToUpdate || []}
          renderItem={(c) => (
            <Box key={c.companyKey} sx={{ px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: D.text }} noWrap>{c.name}</Typography>
            </Box>
          )}
        />
        <Section
          title="Past orders to load" count={(plan.ordersToLoad || []).length} tone={D.text} Icon={ReceiptLongOutlinedIcon}
          items={plan.ordersToLoad || []}
          renderItem={(o, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: D.text }} noWrap>#{o.orderNumber} · {o.company}</Typography>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Chip label={o.status} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, color: D.muted, bgcolor: 'rgba(255,255,255,0.06)' }} />
                {o.totalValue > 0 && <Typography sx={{ ...mono, fontSize: 12, color: D.muted }}>${o.totalValue.toLocaleString()}</Typography>}
              </Stack>
            </Box>
          )}
        />
        <Section
          title="Meta-ad rows to archive (the bad import)" count={(plan.metaAdJunkToArchive || []).length} tone={D.amber} Icon={Inventory2OutlinedIcon}
          items={plan.metaAdJunkToArchive || []}
          renderItem={(j) => (
            <Box key={j.companyKey} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
              <Typography sx={{ fontSize: 12.5, color: D.muted }} noWrap>{j.name}</Typography>
              {j.alreadyArchived
                ? <Chip label="already archived" size="small" sx={{ height: 18, fontSize: 10, color: D.faint, bgcolor: 'transparent', border: `1px solid ${D.line}` }} />
                : !j.present
                  ? <Chip label="not present" size="small" sx={{ height: 18, fontSize: 10, color: D.faint, bgcolor: 'transparent', border: `1px solid ${D.line}` }} />
                  : null}
            </Box>
          )}
        />
        {(plan.otherBadImportToArchive || []).length > 0 && (
          <Section
            title="Other stray records from today’s import to archive" count={plan.otherBadImportToArchive.length} tone={D.amber} Icon={Inventory2OutlinedIcon}
            items={plan.otherBadImportToArchive}
            renderItem={(x) => (
              <Box key={x.companyKey} sx={{ px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
                <Typography sx={{ fontSize: 12.5, color: D.muted }} noWrap>{x.name}</Typography>
              </Box>
            )}
          />
        )}
      </Stack>

      {/* Look-alike merge proposals (informational; never auto-merged). */}
      {(plan.proposedMerges || []).length > 0 && (
        <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13, color: D.text, mb: 0.5 }}>
            Possible look-alikes ({plan.proposedMerges.length})
          </Typography>
          <Typography sx={{ color: D.faint, fontSize: 12, lineHeight: 1.5 }}>
            A few new companies resemble ones already in your CRM. They are kept SEPARATE (never auto-merged) — use the
            Clean&nbsp;up tab to merge by hand if they’re truly the same.
          </Typography>
        </Box>
      )}

      <Divider sx={{ borderColor: D.line }} />

      {/* The single action. */}
      {result ? (
        <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(74,222,128,0.08)', border: `1px solid ${D.lineHi}` }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 24, color: D.green }} />
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: D.text }}>Done — your data is loaded.</Typography>
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 13, lineHeight: 1.7 }}>
            Added {result.created} · updated {result.updated} · archived {result.metaAdArchived + result.otherBadImportArchived} bad rows ·
            loaded {result.ordersLoaded} order(s).
            {result.errors && result.errors.length > 0 && (
              <> {result.errors.length} row(s) had a problem and were skipped.</>
            )}
          </Typography>
          <Typography sx={{ ...mono, color: D.faint, fontSize: 11, mt: 1 }}>
            batch&nbsp;{result.batchId} — keep this if you ever need to undo it.
          </Typography>
        </Box>
      ) : nothingToDo ? (
        <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: D.inset, border: `1px solid ${D.line}`, textAlign: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 24, color: D.green, mb: 0.5 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: D.text }}>Nothing to do — your CRM already matches the cleaned data.</Typography>
          <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 0.5 }}>It’s safe to run this again any time; it won’t create duplicates.</Typography>
        </Box>
      ) : (
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
          <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />} sx={dropGhostBtn}>Refresh plan</Button>
          <Button onClick={() => setConfirmOpen(true)} sx={dropPrimaryBtn} size="large">
            Confirm &amp; load my data
          </Button>
        </Stack>
      )}

      {error && plan && (
        <Typography sx={{ color: '#f87171', fontSize: 12.5, textAlign: 'right' }}>{error}</Typography>
      )}

      {/* Second deliberate step — the confirm gate. */}
      <Dialog
        open={confirmOpen} onClose={applying ? undefined : () => setConfirmOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`, backgroundImage: 'none', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm the load</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: D.muted, fontSize: 13.5, lineHeight: 1.6 }}>
            This will add/update <b>{(s.clientsToCreate ?? 0) + (s.clientsToUpdate ?? 0)}</b> clients,
            archive <b>{(s.metaAdJunkToArchive ?? 0) + (s.otherBadImportToArchive ?? 0)}</b> bad rows
            (archived, not deleted), and load <b>{s.ordersToLoad ?? 0}</b> past order(s).
          </Typography>
          <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 1.5, lineHeight: 1.5 }}>
            Everything is reversible — it’s stamped with a batch id, and your June&nbsp;22 Drive backup is the ultimate
            safety net. You can run this again safely; it won’t duplicate anything.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={applying} sx={dropGhostBtn}>Cancel</Button>
          <Button onClick={apply} disabled={applying} sx={dropPrimaryBtn}>
            {applying ? <CircularProgress size={18} sx={{ color: D.ink }} /> : 'Yes, load it'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
