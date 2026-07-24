// src/screens/studio/mockup/CarryMockupsDialog.js
//
// "Carry over from previous projects" — the picker a returning client's next job
// starts from.
//
// The problem it solves: a long-term client accumulates a lot of work. The old
// pickers showed one flat, company-wide wall of every mockup that client had
// ever had, newest first, with a text search as the only way through — at fifty
// orders that is unusable. This groups by PROJECT, newest first, collapsed past
// the first couple, so "the hoodie from the spring run" is two taps rather than a
// scroll through hundreds of thumbnails.
//
// Carrying re-letters the design under this project (#000150A → #000200A) and
// records where it came from, server-side — see POST /orders/:id/mockups/carry.
// The art is cloned, so editing the new copy never changes what a past client
// already approved.

import React from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Typography, Button,
  IconButton, CircularProgress, Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';
import config from '../../../config.json';
import { D, mono, scrollbar, useMobileFullScreen } from '../_shared';
import { sortMockupTiles, mockupBadge } from '../_mockupNumbers';

const base = `${config.backendUrl}/api`;

// How many project groups start expanded. The most recent work is what gets
// carried over in practice; everything older is one tap away.
const OPEN_BY_DEFAULT = 2;

export default function CarryMockupsDialog({
  open, onClose, onCarried, project, companyKey, authHdr, onToast,
}) {
  const fullScreen = useMobileFullScreen();
  const [items, setItems] = React.useState(null);      // null = loading
  const [selected, setSelected] = React.useState([]);  // remoteIds
  const [openGroups, setOpenGroups] = React.useState({});
  const [busy, setBusy] = React.useState(false);

  const thisProject = String(project?.projectNumber || '');

  // The client's whole library, by the canonical companyKey — one indexed query,
  // never a fuzzy name match. Grouped into projects below.
  React.useEffect(() => {
    if (!open || !companyKey) return undefined;
    let live = true;
    setItems(null); setSelected([]);
    (async () => {
      try {
        const r = await axios.get(`${base}/studio/library/mockups`, {
          ...authHdr,
          params: { summary: 1, companyKey },
        });
        if (!live) return;
        setItems(Array.isArray(r.data) ? r.data : []);
      } catch (e) {
        if (!live) return;
        setItems([]);
        onToast?.(e.response?.data?.message || e.message || 'Could not load past designs.', 'error');
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyKey]);

  // Group by project, newest project first. This project's own designs are
  // excluded — you can't carry something into where it already lives.
  const groups = React.useMemo(() => {
    const by = new Map();
    for (const m of (items || [])) {
      const pn = String(m.projectNumber || m.pageState?.projectNumber || '');
      if (pn && pn === thisProject) continue;
      const key = pn || '__unlinked';
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(m);
    }
    const numOf = (k) => (k === '__unlinked' ? -1 : parseInt(String(k).split('-')[0], 10) || 0);
    return [...by.entries()]
      .sort((a, b) => numOf(b[0]) - numOf(a[0]))
      .map(([key, list]) => ({
        key,
        label: key === '__unlinked' ? 'Not on a project yet' : `Project #${key}`,
        items: sortMockupTiles(list, (m) => m.pageState?.mockupNum || ''),
      }));
  }, [items, thisProject]);

  // Seed which groups are open once the data lands — most recent first.
  React.useEffect(() => {
    if (!groups.length) return;
    setOpenGroups((prev) => {
      if (Object.keys(prev).length) return prev;
      const next = {};
      groups.slice(0, OPEN_BY_DEFAULT).forEach((g) => { next[g.key] = true; });
      return next;
    });
  }, [groups]);

  React.useEffect(() => { if (!open) setOpenGroups({}); }, [open]);

  const toggle = (remoteId) => setSelected((prev) => (
    prev.includes(remoteId) ? prev.filter((x) => x !== remoteId) : [...prev, remoteId]
  ));

  const carry = async () => {
    if (!selected.length || !project?._id) return;
    setBusy(true);
    try {
      const r = await axios.post(
        `${base}/orders/${project._id}/mockups/carry`,
        { remoteIds: selected },
        authHdr,
      );
      const carried = (r.data && r.data.carried) || [];
      const skipped = (r.data && r.data.skipped) || [];
      if (carried.length) {
        onToast?.(
          `Carried over ${carried.length} design${carried.length === 1 ? '' : 's'} · `
          + carried.map((c) => c.mockupNum).join(', '),
          'success',
        );
      }
      if (skipped.length && !carried.length) {
        onToast?.(skipped[0].reason || 'Nothing could be carried over.', 'error');
      }
      await onCarried?.();
      onClose?.();
    } catch (e) {
      onToast?.(e.response?.data?.message || e.message || 'Carry over failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`, borderRadius: fullScreen ? 0 : 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: D.panel, borderBottom: `1px solid ${D.line}`,
        px: 2.5, py: 1.2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <DesignServicesIcon sx={{ color: D.green, fontSize: 18 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14 }}>Carry over a design</Typography>
          <Typography sx={{ color: D.faint, fontSize: 11 }}>
            Into project #{thisProject || '—'} · gets a new number here, keeps its history
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={busy}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: 2.5, ...scrollbar }}>
        {items === null ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={24} sx={{ color: D.green }} /></Box>
        ) : total === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: D.faint }}>
            <DesignServicesIcon sx={{ fontSize: 34, opacity: 0.3, mb: 1 }} />
            <Typography sx={{ fontSize: 13 }}>
              No earlier designs for this client — this is their first job.
            </Typography>
          </Box>
        ) : (
          groups.map((g) => {
            const isOpen = !!openGroups[g.key];
            const picked = g.items.filter((m) => selected.includes(m.remoteId)).length;
            return (
              <Box key={g.key} sx={{ mb: 1.25, border: `1px solid ${D.line}`, borderRadius: 1.5, overflow: 'hidden' }}>
                <Box
                  onClick={() => setOpenGroups((p) => ({ ...p, [g.key]: !p[g.key] }))}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenGroups((p) => ({ ...p, [g.key]: !p[g.key] })); } }}
                  sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                    bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                >
                  <ExpandMoreIcon sx={{ fontSize: 18, color: D.faint, transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                  <Typography sx={{ ...mono, color: D.text, fontSize: 12, fontWeight: 700, flex: 1 }}>
                    {g.label}
                    <Box component="span" sx={{ color: D.faint, fontWeight: 600, ml: 1 }}>· {g.items.length}</Box>
                  </Typography>
                  {picked > 0 && (
                    <Box sx={{ ...mono, fontSize: 10, fontWeight: 800, color: D.green,
                      bgcolor: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)',
                      px: 0.75, py: 0.15, borderRadius: 999 }}>{picked} picked</Box>
                  )}
                </Box>
                <Collapse in={isOpen} unmountOnExit>
                  <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 1 }}>
                    {g.items.map((m) => {
                      const on = selected.includes(m.remoteId);
                      const num = m.pageState?.mockupNum || '';
                      return (
                        <Box key={m.remoteId || m._id} onClick={() => toggle(m.remoteId)}
                          role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(m.remoteId); } }}
                          sx={{ position: 'relative', cursor: 'pointer', borderRadius: 1.5, overflow: 'hidden',
                            border: `2px solid ${on ? D.green : D.line}`, opacity: on ? 1 : 0.8,
                            transition: 'opacity .12s, border-color .12s', outline: 'none',
                            '&:hover, &:focus-visible': { opacity: 1, borderColor: D.green } }}>
                          {on && (
                            <CheckCircleIcon sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1,
                              fontSize: 18, color: D.green, bgcolor: '#08130c', borderRadius: '50%' }} />
                          )}
                          {m.thumbnail ? (
                            <Box component="img" src={m.thumbnail} alt={m.name} loading="lazy"
                              sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', bgcolor: '#fff' }} />
                          ) : (
                            <Box sx={{ aspectRatio: '1', bgcolor: D.panelHi, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <DesignServicesIcon sx={{ color: D.faint, fontSize: 24 }} />
                            </Box>
                          )}
                          <Box sx={{ px: 0.75, py: 0.5, bgcolor: on ? 'rgba(74,222,128,0.10)' : 'transparent' }}>
                            <Typography sx={{ ...mono, fontSize: 9, fontWeight: 700, color: on ? D.green : D.faint,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {num ? `#${String(num).replace(/^#/, '')}` : '—'}
                              {mockupBadge(num) ? ` · ${mockupBadge(num)}` : ''}
                            </Typography>
                            <Typography sx={{ fontSize: 10, fontWeight: 600, color: on ? D.green : D.text,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.name || 'Untitled'}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          })
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Typography sx={{ ...mono, fontSize: 11, color: D.faint, flex: 1 }}>
          {selected.length ? `${selected.length} selected` : ''}
        </Typography>
        <Button onClick={onClose} disabled={busy} sx={{ color: D.muted, textTransform: 'none' }}>Cancel</Button>
        <Button onClick={carry} disabled={!selected.length || busy} variant="contained"
          sx={{ bgcolor: D.green, color: '#08130c', fontWeight: 800, textTransform: 'none',
            '&:hover': { bgcolor: '#3bd070' } }}>
          {busy
            ? <CircularProgress size={16} sx={{ color: '#08130c' }} />
            : `Carry over${selected.length ? ` ${selected.length}` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
