// src/screens/studio/crm/DataCleanupView.js
//
// The owner-run "Fix data" cleanup — a preview→confirm surface that lists ONLY the
// genuine data problems the backend detects (orphaned orders, contact-polluted
// company names, mis-keyed cost receipts) and fixes them in one reversible batch.
// It never asks the owner to re-enter history; orphans + name-splits are proposed
// automatically, and only a mis-keyed receipt needs him to pick the right order #.
// When nothing's left to fix, the whole entry point auto-hides (see CrmTab).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, IconButton, Autocomplete, TextField,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import axios from 'axios';
import config from '../../config.json';
import { D, mono } from '../_shared';

const base = `${config.backendUrl}/api/crm`;
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ymd = (d) => { const t = d ? new Date(d) : null; return t && !isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : ''; };

function Section({ icon, title, count, children }) {
  if (!count) return null;
  return (
    <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2.5, bgcolor: D.panel, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${D.line}` }}>
        {icon}
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13.5, flex: 1 }}>{title}</Typography>
        <Typography sx={{ ...mono, color: D.faint, fontSize: 12 }}>{count}</Typography>
      </Stack>
      <Box>{children}</Box>
    </Box>
  );
}

export default function DataCleanupView({ token, onBack, onApplied }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState('');
  const [receiptTargets, setReceiptTargets] = useState({});   // txnId -> order #
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await axios.get(`${base}/data-cleanup/preview`, authHdr);
      setPlan(r.data || null);
    } catch (e) { setErr(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  }, [authHdr]);

  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    setApplying(true); setErr('');
    try {
      const receipts = Object.entries(receiptTargets)
        .filter(([, v]) => String(v || '').replace(/[^0-9]/g, ''))
        .map(([txnId, orderNumber]) => ({ txnId, orderNumber }));
      await axios.post(`${base}/data-cleanup/apply`, { confirm: true, receipts }, authHdr);
      setConfirmOpen(false);
      setReceiptTargets({});
      await load();
      if (onApplied) onApplied();
    } catch (e) { setErr(e.response?.data?.message || e.message); setConfirmOpen(false); }
    finally { setApplying(false); }
  };

  const counts = plan?.counts || { orphans: 0, polluted: 0, misKeyed: 0, total: 0 };
  const orderOptions = useMemo(() => (plan?.orderOptions || []).map((o) => o.orderNumber), [plan]);

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 1.5, md: 0 }, py: 1 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={onBack} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16, flex: 1 }}>Fix data</Typography>
        {!loading && counts.total > 0 && (
          <Button onClick={() => setConfirmOpen(true)} disabled={applying}
            sx={{ bgcolor: D.green, color: D.ink, textTransform: 'none', fontWeight: 800, borderRadius: 999, px: 2,
              '&:hover': { bgcolor: '#5cec8e' } }}>
            Fix all
          </Button>
        )}
      </Stack>

      {err && <Typography sx={{ color: '#fbbf24', fontSize: 12.5, mb: 1.5 }}>{err}</Typography>}

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress sx={{ color: D.green }} /></Box>
      ) : counts.total === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 34, color: D.green, mb: 1 }} />
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16 }}>Nothing to fix</Typography>
          <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 0.5 }}>Your records are clean.</Typography>
        </Box>
      ) : (
        <Stack gap={2}>
          <Section icon={<BadgeOutlinedIcon sx={{ fontSize: 18, color: '#60a5fa' }} />}
            title="Names with the contact mixed in" count={counts.polluted}>
            {(plan.polluted || []).map((c) => (
              <Stack key={c.clientId} direction="row" alignItems="center" gap={1.5}
                sx={{ px: 2, py: 1, borderTop: `1px solid ${D.line}` }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: D.muted, fontSize: 12.5, textDecoration: 'line-through' }}>{c.companyName}</Typography>
                  <Typography sx={{ color: D.text, fontSize: 13.5, fontWeight: 700 }}>
                    {c.cleanCompany} <Box component="span" sx={{ color: D.faint, fontWeight: 500 }}>· contact: {c.contact}</Box>
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Section>

          <Section icon={<LinkOffOutlinedIcon sx={{ fontSize: 18, color: '#fbbf24' }} />}
            title="Orders not linked to a client" count={counts.orphans}>
            {(plan.orphans || []).map((o) => (
              <Stack key={o.orderId} direction="row" alignItems="center" gap={1.5}
                sx={{ px: 2, py: 1, borderTop: `1px solid ${D.line}` }}>
                <Typography sx={{ ...mono, color: D.green, fontSize: 12.5, minWidth: 56 }}>#{o.orderNumber || '—'}</Typography>
                <Typography sx={{ color: D.text, fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {o.companyName || o.clientName || '—'}
                </Typography>
                <Typography sx={{ color: D.faint, fontSize: 11.5 }}>will link</Typography>
              </Stack>
            ))}
          </Section>

          <Section icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18, color: '#fb7185' }} />}
            title="Receipts on an order # that doesn't exist" count={counts.misKeyed}>
            {(plan.misKeyed || []).map((r) => (
              <Stack key={r.txnId} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}
                sx={{ px: 2, py: 1.25, borderTop: `1px solid ${D.line}` }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: D.text, fontSize: 13, fontWeight: 700 }}>
                    {r.party || '—'} <Box component="span" sx={{ ...mono, color: '#f87171', fontWeight: 600 }}>{money(r.amount)}</Box>
                  </Typography>
                  <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
                    {r.category}{r.date ? ` · ${ymd(r.date)}` : ''} · was on #{String(r.orderNumber).replace(/[^0-9]/g, '') || '—'}
                  </Typography>
                </Box>
                <Autocomplete
                  freeSolo size="small" options={orderOptions} sx={{ width: { xs: '100%', sm: 170 } }}
                  value={receiptTargets[r.txnId] || ''}
                  onChange={(_e, v) => setReceiptTargets((p) => ({ ...p, [r.txnId]: v || '' }))}
                  onInputChange={(_e, v, reason) => { if (reason === 'input') setReceiptTargets((p) => ({ ...p, [r.txnId]: v || '' })); }}
                  renderInput={(params) => <TextField {...params} placeholder="Correct order #"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: D.inset, color: D.text, fontSize: 12.5,
                      '& fieldset': { borderColor: D.line } } }} />}
                />
              </Stack>
            ))}
          </Section>

          <Typography sx={{ color: D.faint, fontSize: 11.5, lineHeight: 1.5, px: 0.5 }}>
            "Fix all" applies the name splits and order links above, plus any receipt you've re-pointed. It's one reversible
            batch — undo it anytime from the same place. Merging an actual duplicate company stays in Clean up.
          </Typography>
        </Stack>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}
        PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Fix these now?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: D.muted, fontSize: 13.5 }}>
            Applies {counts.polluted} name fix{counts.polluted === 1 ? '' : 'es'}, links {counts.orphans} order{counts.orphans === 1 ? '' : 's'},
            and re-points {Object.values(receiptTargets).filter((v) => String(v || '').replace(/[^0-9]/g, '')).length} receipt(s).
            Reversible.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: D.muted, textTransform: 'none' }}>Cancel</Button>
          <Button onClick={apply} disabled={applying}
            sx={{ bgcolor: D.green, color: D.ink, textTransform: 'none', fontWeight: 800, borderRadius: 999, px: 2.5,
              '&:hover': { bgcolor: '#5cec8e' } }}>
            {applying ? <CircularProgress size={16} sx={{ color: D.ink }} /> : 'Fix all'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
