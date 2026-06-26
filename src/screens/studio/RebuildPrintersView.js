// src/screens/studio/RebuildPrintersView.js
//
// The guided "Rebuild printers from Drive" surface — the VENDOR/PO analogue of
// crm/ReconcileView. SAFE, owner-triggered, preview → confirm flow against the
// backend rebuild endpoints:
//
//   GET  /api/orders/vendors/rebuild/preview  → the plan (writes NOTHING)
//   POST /api/orders/vendors/rebuild/apply     → execute (requires an explicit confirm)
//   POST /api/orders/vendors/rebuild/revert    → undo a batch by id
//   GET  /api/orders/vendors/rebuild/status     → has it ever been applied?
//
// Design intent (same as ReconcileView): clear and reassuring, not a firehose. It
// reads the owner's real Google Drive PO history (one subfolder per printer), shows
// EXACTLY what it will do — the 16 real printers to load (each with its PO count +
// real spend), the POs to load, the old auto-created in-app records it will ARCHIVE
// (never delete), and the flagged/unreadable Drive docs — then waits for Confirm.
// It PRESERVES the owner's one real in-app PO (the Happy Leaf order's). Nothing is
// written until Confirm. Auto-hides once it has run (this is a one-time tool).

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Button, Typography, Chip, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import config from '../../config.json';
import { D, mono, dropPrimaryBtn, dropGhostBtn } from './_shared';

const base = `${config.backendUrl}/api/orders/vendors/rebuild`;

const money = (n) => {
  const v = Number(n);
  return `$${(Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const money0 = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

// A single big number + label tile (mirrors ReconcileView's Stat).
function Stat({ value, label, tone, Icon }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 130, textAlign: 'center', p: 2,
      borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}`,
    }}>
      {Icon && <Icon sx={{ fontSize: 20, color: tone || D.muted, mb: 0.5 }} />}
      <Typography sx={{ ...mono, fontSize: 28, fontWeight: 800, color: tone || D.text, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mt: 0.75 }}>
        {label}
      </Typography>
    </Box>
  );
}

// A collapsible list section (e.g. "16 printers to load").
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
        <Stack spacing={0.5} sx={{ p: 1.25, bgcolor: D.bg, maxHeight: 300, overflowY: 'auto' }}>
          {items.map(renderItem)}
        </Stack>
      </Collapse>
    </Box>
  );
}

export default function RebuildPrintersView({ token, onApplied, onClose }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [plan, setPlan] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [result, setResult] = React.useState(null); // post-apply report (incl. batchId)
  const [status, setStatus] = React.useState(null);  // { applied, lastBatchId, at }
  const [forceShow, setForceShow] = React.useState(false);

  const loadPreview = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${base}/preview`, authHdr);
      setPlan(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the rebuild preview.');
    } finally {
      setLoading(false);
    }
  }, [authHdr]);

  const loadStatus = React.useCallback(async () => {
    try {
      const res = await axios.get(`${base}/status`, authHdr);
      setStatus(res.data || { applied: false });
    } catch (_) {
      setStatus({ applied: false });
    }
  }, [authHdr]);

  React.useEffect(() => { loadPreview(); loadStatus(); }, [loadPreview, loadStatus]);

  const alreadyApplied = !!(status && status.applied) && !forceShow && !result;

  const apply = React.useCallback(async () => {
    setApplying(true);
    try {
      const res = await axios.post(`${base}/apply`, { confirm: true }, authHdr);
      setResult(res.data);
      setConfirmOpen(false);
      if (onApplied) onApplied();
      loadPreview();
      loadStatus();
    } catch (e) {
      setError(e?.response?.data?.message || 'The rebuild could not be applied.');
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  }, [authHdr, onApplied, loadPreview, loadStatus]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={2}>
        <CircularProgress sx={{ color: D.green }} />
        <Typography sx={{ color: D.muted, fontSize: 13 }}>Reading your Drive PO history &amp; building a safe plan…</Typography>
      </Stack>
    );
  }

  if (error && !plan) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <Typography sx={{ color: '#f87171', fontWeight: 700 }}>{error}</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />} sx={dropGhostBtn}>Try again</Button>
          {onClose && <Button onClick={onClose} sx={dropGhostBtn}>Close</Button>}
        </Stack>
      </Stack>
    );
  }

  // Already loaded in a prior session → quiet confirmation, not the full firehose.
  if (alreadyApplied) {
    return (
      <Stack spacing={2} sx={{ py: 3 }} alignItems="center">
        <Box sx={{ maxWidth: 460, width: '100%', p: 3, borderRadius: 3, textAlign: 'center',
          bgcolor: D.panel, border: `1px solid ${D.line}` }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 30, color: D.green, mb: 1 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: D.text }}>Your printers are loaded.</Typography>
          <Typography sx={{ color: D.muted, fontSize: 13, mt: 0.75, lineHeight: 1.6 }}>
            This one-time rebuild already ran — your printers and their POs are in from your Drive history.
            You don’t need to do anything here.
          </Typography>
          {status && status.lastBatchId && (
            <Typography sx={{ ...mono, color: D.faint, fontSize: 11, mt: 1 }}>batch&nbsp;{status.lastBatchId}</Typography>
          )}
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
            <Button
              onClick={() => { setForceShow(true); loadPreview(); }}
              startIcon={<RefreshOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={{ textTransform: 'none', color: D.faint, fontWeight: 600, fontSize: 12,
                '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.06)' } }}
            >
              Re-run the rebuild
            </Button>
            {onClose && (
              <Button onClick={onClose} sx={{ textTransform: 'none', color: D.faint, fontWeight: 600, fontSize: 12, '&:hover': { color: D.text } }}>
                Back to printers
              </Button>
            )}
          </Stack>
        </Box>
      </Stack>
    );
  }

  const s = plan?.summary || {};
  const flagged = plan?.flagged || [];
  const nothingToDo = s.noOp;

  return (
    <Stack spacing={2.5} sx={{ pb: 4 }}>
      {/* Reassurance header */}
      <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: D.panel, border: `1px solid ${D.line}` }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <ShieldOutlinedIcon sx={{ fontSize: 26, color: D.green, mt: 0.25 }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: D.text }}>Rebuild printers from Drive</Typography>
            <Typography sx={{ color: D.muted, fontSize: 13.5, lineHeight: 1.6, mt: 0.5 }}>
              This reads your real Google Drive PO history (one folder per printer) and shows you EXACTLY what it will do
              before touching anything. It loads your <b>{s.vendorsTotal ?? 0} real printers</b> — each with their actual
              spend and the orders they printed — and their purchase orders, <b>archives the old auto-filled records</b>
              {' '}(archived, never deleted — fully restorable), and <b>keeps your hand-made Happy&nbsp;Leaf PO untouched</b>.
              Nothing is written until you press Confirm.
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* The plan at a glance */}
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
        <Stat value={(s.vendorsToCreate ?? 0) + (s.vendorsToUpdate ?? 0)} label="Printers to load" tone={D.green} Icon={StorefrontOutlinedIcon} />
        <Stat value={s.posToLoad ?? 0} label="Purchase orders to load" tone={D.text} Icon={DescriptionOutlinedIcon} />
        <Stat value={(s.vendorsToArchive ?? 0) + (s.posToArchive ?? 0)} label="Old records to archive" tone={D.amber} Icon={Inventory2OutlinedIcon} />
        <Stat value={flagged.length} label="Flagged to review" tone={flagged.length ? '#f87171' : D.muted} Icon={WarningAmberOutlinedIcon} />
      </Stack>

      {/* Total spend headline */}
      {s.totalSpend > 0 && (
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}`, textAlign: 'center' }}>
          <Typography sx={{ color: D.faint, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Total recorded spend with these printers (from your books)
          </Typography>
          <Typography sx={{ ...mono, color: D.green, fontSize: 22, fontWeight: 800, mt: 0.25 }}>{money(s.totalSpend)}</Typography>
        </Box>
      )}

      {/* The Happy-Leaf preserve note — surfaced prominently. */}
      {(s.preservedPos ?? 0) > 0 && (
        <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: 'rgba(74,222,128,0.06)', border: `1px solid ${D.lineHi}` }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ShieldOutlinedIcon sx={{ fontSize: 18, color: D.green }} />
            <Typography sx={{ color: D.muted, fontSize: 12.5, lineHeight: 1.5 }}>
              <b>{s.preservedPos}</b> existing in-app PO(s) — including your hand-made Happy&nbsp;Leaf order PO — are kept
              exactly as-is. The rebuild never touches them.
            </Typography>
          </Stack>
        </Box>
      )}

      {/* FLAGGED report — shown prominently, above the action. */}
      {flagged.length > 0 && (
        <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(248,113,113,0.06)', border: `1px solid rgba(248,113,113,0.3)` }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <WarningAmberOutlinedIcon sx={{ fontSize: 20, color: '#f87171' }} />
            <Typography sx={{ fontWeight: 800, fontSize: 15, color: D.text }}>
              Flagged Drive docs to review ({flagged.length})
            </Typography>
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 12.5, mb: 1.5, lineHeight: 1.5 }}>
            These don’t block the rebuild — they’re docs the read couldn’t fully resolve: templates with real data, blank
            placeholders, duplicate PO numbers, a vendor-format invoice, or supplier order acks that aren’t POs. Skipped
            ones aren’t loaded; flagged-but-loaded ones load with the note. Review them in Drive afterward.
          </Typography>
          <Stack spacing={0.75} sx={{ maxHeight: 240, overflowY: 'auto' }}>
            {flagged.map((f, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: D.text }} noWrap>
                    {f.vendorName} · {f.poNumber || '—'}{f.sourceTitle ? ` · ${f.sourceTitle}` : ''}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: D.faint }} noWrap>{(f.flags || []).join(', ')}</Typography>
                </Box>
                {f.skipped && <Chip label="not loaded" size="small" sx={{ height: 18, fontSize: 10, color: D.faint, bgcolor: 'transparent', border: `1px solid ${D.line}` }} />}
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* What exactly will change (collapsible detail) */}
      <Stack spacing={1.25}>
        <Section
          title="Printers to load" count={(plan.vendorsToCreate || []).length} tone={D.green} Icon={StorefrontOutlinedIcon}
          items={plan.vendorsToCreate || []} defaultOpen
          renderItem={(v) => (
            <Box key={v.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: D.text }} noWrap>{v.name}</Typography>
                {v.aliases && v.aliases.length > 0 && (
                  <Typography sx={{ fontSize: 11, color: D.faint }} noWrap>also: {v.aliases.join(', ')}</Typography>
                )}
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                <Chip label={`${v.poCount} PO${v.poCount === 1 ? '' : 's'}`} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, color: D.muted, bgcolor: 'rgba(255,255,255,0.06)' }} />
                {v.totalSpend > 0 && <Typography sx={{ ...mono, fontSize: 12, color: D.green }}>{money0(v.totalSpend)}</Typography>}
              </Stack>
            </Box>
          )}
        />
        <Section
          title="Printers to update (already in your list)" count={(plan.vendorsToUpdate || []).length} tone={D.text} Icon={StorefrontOutlinedIcon}
          items={plan.vendorsToUpdate || []}
          renderItem={(v) => (
            <Box key={v.name} sx={{ px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: D.text }} noWrap>
                {v.name}{v.liveName && v.liveName !== v.name ? <Box component="span" sx={{ color: D.faint, fontWeight: 600 }}> (was “{v.liveName}”)</Box> : null}
              </Typography>
            </Box>
          )}
        />
        <Section
          title="Purchase orders to load" count={(plan.posToLoad || []).length} tone={D.text} Icon={DescriptionOutlinedIcon}
          items={plan.posToLoad || []}
          renderItem={(p, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: D.text, ...mono }} noWrap>
                  {p.vendorName} · {p.poNumber}
                  {p.orderNumber ? <Box component="span" sx={{ color: p.linked ? D.green : D.faint, fontWeight: 600 }}> · order #{p.orderNumber}</Box> : null}
                </Typography>
                {p.client ? <Typography sx={{ fontSize: 11, color: D.faint }} noWrap>{p.client}</Typography> : null}
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                {(p.flags || []).length > 0 && <WarningAmberOutlinedIcon sx={{ fontSize: 14, color: D.amber }} />}
                {p.grandTotal != null && <Typography sx={{ ...mono, fontSize: 12, color: D.muted }}>{money0(p.grandTotal)}</Typography>}
              </Stack>
            </Box>
          )}
        />
        <Section
          title="Old in-app records to archive" count={(plan.vendorsToArchive || []).length + (plan.posToArchive || []).length} tone={D.amber} Icon={Inventory2OutlinedIcon}
          items={[
            ...(plan.vendorsToArchive || []).map((v) => ({ kind: 'printer', label: v.name, sub: `→ ${v.canonical}` })),
            ...(plan.posToArchive || []).map((p) => ({ kind: 'PO', label: `${p.vendorName} ${p.poNumber}`, sub: '' })),
          ]}
          renderItem={(x, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.25, py: 0.85, borderRadius: 1.5, bgcolor: D.inset }}>
              <Typography sx={{ fontSize: 12.5, color: D.muted }} noWrap>{x.label} {x.sub && <Box component="span" sx={{ color: D.faint }}>{x.sub}</Box>}</Typography>
              <Chip label={x.kind} size="small" sx={{ height: 18, fontSize: 10, color: D.faint, bgcolor: 'transparent', border: `1px solid ${D.line}` }} />
            </Box>
          )}
        />
      </Stack>

      <Divider sx={{ borderColor: D.line }} />

      {/* The single action. */}
      {result ? (
        <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(74,222,128,0.08)', border: `1px solid ${D.lineHi}` }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 24, color: D.green }} />
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: D.text }}>Done — your printers are loaded.</Typography>
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 13, lineHeight: 1.7 }}>
            Created {result.vendorsCreated} · updated {result.vendorsUpdated} printers · loaded {result.posLoaded} PO(s) ·
            archived {result.vendorsArchived + result.posArchived} old record(s) · kept {result.preservedPos} in-app PO(s).
            {result.errors && result.errors.length > 0 && (
              <> {result.errors.length} item(s) needed attention (e.g. a PO with no order to link) and were skipped.</>
            )}
          </Typography>
          <Typography sx={{ ...mono, color: D.faint, fontSize: 11, mt: 1 }}>
            batch&nbsp;{result.batchId} — keep this if you ever need to undo it.
          </Typography>
          {onClose && (
            <Button onClick={onClose} sx={{ ...dropPrimaryBtn, mt: 1.5 }}>See my printers</Button>
          )}
        </Box>
      ) : nothingToDo ? (
        <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: D.inset, border: `1px solid ${D.line}`, textAlign: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 24, color: D.green, mb: 0.5 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: D.text }}>Nothing to do — your printers already match your Drive history.</Typography>
          <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 0.5 }}>It’s safe to run this again any time; it won’t create duplicates.</Typography>
        </Box>
      ) : (
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
          {onClose && <Button onClick={onClose} sx={dropGhostBtn}>Cancel</Button>}
          <Button onClick={loadPreview} startIcon={<RefreshOutlinedIcon />} sx={dropGhostBtn}>Refresh plan</Button>
          <Button onClick={() => setConfirmOpen(true)} sx={dropPrimaryBtn} size="large">
            Confirm &amp; load my printers
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
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm the rebuild</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: D.muted, fontSize: 13.5, lineHeight: 1.6 }}>
            This will load/update <b>{(s.vendorsToCreate ?? 0) + (s.vendorsToUpdate ?? 0)}</b> printers and
            {' '}<b>{s.posToLoad ?? 0}</b> purchase order(s), and archive
            {' '}<b>{(s.vendorsToArchive ?? 0) + (s.posToArchive ?? 0)}</b> old auto-filled record(s)
            (archived, not deleted). Your hand-made Happy&nbsp;Leaf PO is kept untouched.
          </Typography>
          <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 1.5, lineHeight: 1.5 }}>
            Everything is reversible — it’s stamped with a batch id, and your Drive backup is the ultimate safety net.
            You can run this again safely; it won’t duplicate anything.
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
