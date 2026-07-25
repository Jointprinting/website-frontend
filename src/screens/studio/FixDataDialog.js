// src/screens/studio/FixDataDialog.js
//
// "Fix data" — the owner-run repair tool, preview → confirm → revert.
//
// The API for this has existed for a while (GET/POST /api/crm/data-cleanup/*)
// but nothing in the Studio ever called it, so four working detections had no
// way to be run. This is that surface.
//
// (It briefly carried a fifth: a one-time repair for mockups the old
// company-name matcher had attached to the wrong project. That migration has
// been run, so the section and its detector are gone — a one-time tool must not
// leave a leftover button behind.)
//
// House rules for anything that touches live data (docs/ECOSYSTEM.md): preview
// first, never apply without an explicit confirm, snapshot before mutating so
// every run is revertible by batchId, and auto-hide the entry when there is
// nothing to do. All four are honoured here — the caller only shows this when
// /status reports a non-zero total, and each section disappears at zero.

import React from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Typography, Button,
  IconButton, CircularProgress, Checkbox, Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UndoIcon from '@mui/icons-material/Undo';
import axios from 'axios';
import config from '../../config.json';
import { D, mono, scrollbar, useMobileFullScreen } from './_shared';

const base = `${config.backendUrl}/api`;

// Each detection: how to identify a row, what to call it, and how to render one.
const SECTIONS = [
  {
    key: 'orphans',
    idField: 'orderId',
    bodyKey: 'orphanIds',
    title: 'Orders with no client link',
    blurb: 'A real order with a company name but no companyKey — it can’t reach its client card or count toward customers.',
    render: (r) => (
      <Typography sx={{ fontSize: 11.5, color: D.text }}>
        {r.companyName || r.clientName}
        <Box component="span" sx={{ ...mono, color: D.faint, ml: 1 }}>→ {r.derivedKey}</Box>
      </Typography>
    ),
  },
  {
    key: 'polluted',
    idField: 'clientId',
    bodyKey: 'clientIds',
    title: 'Contact name baked into the company',
    blurb: 'e.g. “Nathan Vigil, Happy Leaf Dispensary” — split into a company and a contact.',
    render: (r) => (
      <Typography sx={{ fontSize: 11.5, color: D.text }}>
        {r.companyName}
        <Box component="span" sx={{ color: D.green, ml: 1 }}>→ {r.cleanCompany} · {r.contact}</Box>
      </Typography>
    ),
  },
  {
    key: 'dupeSales',
    idField: 'txnId',
    bodyKey: 'dupeSaleIds',
    title: 'Duplicate revenue rows',
    blurb: 'The same sale booked twice. The row is archived (not lost) and a revert puts it back.',
    render: (r) => (
      <Typography sx={{ fontSize: 11.5, color: D.text }}>
        #{r.orderNumber} · {r.party}
        <Box component="span" sx={{ ...mono, color: '#fbbf24', ml: 1 }}>${r.amount}</Box>
      </Typography>
    ),
  },
];

export default function FixDataDialog({ open, onClose, authHdr, onToast, onApplied }) {
  const fullScreen = useMobileFullScreen();
  const [plan, setPlan] = React.useState(null);      // null = loading
  const [picked, setPicked] = React.useState({});    // key → Set of ids
  const [openSections, setOpenSections] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [lastBatch, setLastBatch] = React.useState('');

  const load = React.useCallback(async () => {
    setPlan(null);
    try {
      const r = await axios.get(`${base}/crm/data-cleanup/preview`, authHdr);
      setPlan(r.data);
      // Everything detected starts selected — the common case is "fix it all",
      // and un-ticking is easier than hunting for what to tick.
      const next = {};
      for (const s of SECTIONS) {
        next[s.key] = new Set((r.data[s.key] || []).map((row) => String(row[s.idField])));
      }
      setPicked(next);
      setOpenSections(SECTIONS.length ? { [SECTIONS[0].key]: true } : {});
    } catch (e) {
      setPlan({ counts: { total: 0 } });
      onToast?.(e.response?.data?.message || e.message || 'Could not load the repair plan.', 'error');
    }
  }, [authHdr, onToast]);

  React.useEffect(() => { if (open) load(); }, [open, load]);

  const toggle = (key, id) => setPicked((prev) => {
    const set = new Set(prev[key] || []);
    if (set.has(id)) set.delete(id); else set.add(id);
    return { ...prev, [key]: set };
  });

  const toggleAll = (key, rows, idField) => setPicked((prev) => {
    const set = new Set(prev[key] || []);
    const all = rows.map((r) => String(r[idField]));
    const every = all.every((id) => set.has(id));
    return { ...prev, [key]: new Set(every ? [] : all) };
  });

  const totalPicked = SECTIONS.reduce((n, s) => n + ((picked[s.key] && picked[s.key].size) || 0), 0);

  const apply = async () => {
    if (!totalPicked) return;
    setBusy(true);
    try {
      const body = { confirm: true };
      for (const s of SECTIONS) body[s.bodyKey] = [...(picked[s.key] || [])];
      const r = await axios.post(`${base}/crm/data-cleanup/apply`, body, authHdr);
      setLastBatch(r.data.batchId || '');
      const f = r.data.fixed || {};
      onToast?.(
        `Fixed — orders ${f.orders || 0} · names ${f.names || 0} · receipts ${f.receipts || 0} · rows ${f.removedRows || 0}`,
        'success',
      );
      await onApplied?.();
      await load();
    } catch (e) {
      onToast?.(e.response?.data?.message || e.message || 'Apply failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    if (!lastBatch) return;
    setBusy(true);
    try {
      await axios.post(`${base}/crm/data-cleanup/revert`, { batchId: lastBatch, confirm: true }, authHdr);
      onToast?.(`Reverted ${lastBatch} — everything is back as it was.`, 'success');
      setLastBatch('');
      await onApplied?.();
      await load();
    } catch (e) {
      onToast?.(e.response?.data?.message || e.message || 'Revert failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const counts = (plan && plan.counts) || {};
  const nothingToDo = plan && !plan.__loading && (counts.total || 0) === 0;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`, borderRadius: fullScreen ? 0 : 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: D.panel, borderBottom: `1px solid ${D.line}`,
        px: 2.5, py: 1.2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CleaningServicesOutlinedIcon sx={{ color: D.green, fontSize: 18 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14 }}>Fix data</Typography>
          <Typography sx={{ color: D.faint, fontSize: 11 }}>
            Nothing changes until you apply · every run is revertible
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={busy}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: 2.5, ...scrollbar }}>
        {plan === null ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={24} sx={{ color: D.green }} /></Box>
        ) : nothingToDo ? (
          <Box sx={{ textAlign: 'center', py: 6, color: D.faint }}>
            <Typography sx={{ fontSize: 13 }}>Nothing to fix. ✓</Typography>
            <Typography sx={{ fontSize: 11.5, mt: 0.5 }}>Your data is consistent — this tool hides itself when it has no work.</Typography>
          </Box>
        ) : SECTIONS.map((s) => {
          const rows = (plan[s.key] || []);
          if (!rows.length) return null;
          const isOpen = !!openSections[s.key];
          const sel = picked[s.key] || new Set();
          return (
            <Box key={s.key} sx={{ mb: 1.25, border: `1px solid ${D.line}`, borderRadius: 1.5, overflow: 'hidden' }}>
              <Box onClick={() => setOpenSections((p) => ({ ...p, [s.key]: !p[s.key] }))}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenSections((p) => ({ ...p, [s.key]: !p[s.key] })); } }}
                sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                  bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <ExpandMoreIcon sx={{ fontSize: 18, color: D.faint, transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700, flex: 1 }}>
                  {s.title}
                  <Box component="span" sx={{ ...mono, color: D.faint, fontWeight: 600, ml: 1 }}>· {rows.length}</Box>
                </Typography>
                <Typography component="span" onClick={(e) => { e.stopPropagation(); toggleAll(s.key, rows, s.idField); }}
                  sx={{ ...mono, fontSize: 10, color: D.green, cursor: 'pointer', fontWeight: 700,
                    '&:hover': { color: '#3bd070' } }}>
                  {sel.size === rows.length ? 'none' : 'all'}
                </Typography>
              </Box>
              <Collapse in={isOpen} unmountOnExit>
                <Typography sx={{ px: 1.5, pt: 1, fontSize: 11, color: D.faint, lineHeight: 1.5 }}>{s.blurb}</Typography>
                <Box sx={{ maxHeight: 260, overflow: 'auto', ...scrollbar, mt: 0.5 }}>
                  {rows.map((r) => {
                    const id = String(r[s.idField]);
                    return (
                      <Box key={id} sx={{ px: 1, py: 0.6, display: 'flex', alignItems: 'flex-start', gap: 0.5,
                        borderTop: `1px solid ${D.line}` }}>
                        <Checkbox size="small" checked={sel.has(id)} onChange={() => toggle(s.key, id)}
                          sx={{ p: 0.5, color: D.faint, '&.Mui-checked': { color: D.green } }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>{s.render(r)}</Box>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        {lastBatch && (
          <Button onClick={revert} disabled={busy} startIcon={<UndoIcon sx={{ fontSize: 15 }} />}
            sx={{ color: '#fbbf24', textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
            Undo last fix
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy} sx={{ color: D.muted, textTransform: 'none' }}>Close</Button>
        <Button onClick={apply} disabled={!totalPicked || busy} variant="contained"
          sx={{ bgcolor: D.green, color: '#08130c', fontWeight: 800, textTransform: 'none',
            '&:hover': { bgcolor: '#3bd070' } }}>
          {busy ? <CircularProgress size={16} sx={{ color: '#08130c' }} /> : `Apply ${totalPicked || ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
