// src/screens/studio/mockup/MockupLab.js
//
// Mockup Lab — the in-Studio BROWSER over the one mockup library. It's the single
// grid the whole "visuals of the job" area shares: open it plain to browse every
// mockup, or through a LENS (one client / one project) so the CRM design library
// and a project's mockups are this same browser, scoped — not five parallel grids.
//
// Browsing (grid + read-only detail) lives here; EDITING hands off to the lab
// itself — the full-featured /jpstudio, now embedded IN the Studio (Studio.js
// renders MockupLabFrame), so the S&S blank finder, ink auto-detect, print areas,
// and the workshop feel are all intact. "Edit"/"New" navigate to that embed.
//
// Reuses the shared `D` palette + the /api/studio/library endpoints (incl. the
// ?companyKey client scope), the same ones OrderTracker / Lookbooks / CRM read.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, IconButton, Button, CircularProgress, Chip } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FlipOutlinedIcon from '@mui/icons-material/FlipOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';
import config from '../../../config.json';
import { D, mono, scrollbar } from '../_shared';
import { mockupFromLibraryItem, sidePreview } from './mockupModel';

const base = `${config.backendUrl}/api`;

export default function MockupLab({ token, onBack, onNavigate, entry }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [list, setList] = useState(null);       // summary array | null (loading)
  const [sel, setSel] = useState(null);          // { model, item } of the opened mockup
  const [pageIdx, setPageIdx] = useState(0);
  const [side, setSide] = useState('front');
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  // Overview-style grouping: tiles grouped by linked project (classic Overview
  // tab behavior), "Unlinked" last. Toggleable to a flat newest-first grid.
  const [byProject, setByProject] = useState(true);

  // Browser lens — scope the grid to one client (companyKey) or project. Seeded
  // from the entry (a CRM "see all" / a project deep-link), clearable back to all.
  const [lens, setLens] = useState(() => ({
    companyKey: (entry && entry.lensCompanyKey) || '',
    projectNumber: (entry && entry.lensProjectNumber) || '',
    label: (entry && entry.lensLabel) || '',
  }));

  const load = useCallback(async () => {
    try {
      const params = { summary: 1 };
      if (lens.companyKey) params.companyKey = lens.companyKey;   // client lens → server-scoped
      const r = await axios.get(`${base}/studio/library/mockups`, { ...authHdr, params });
      const items = Array.isArray(r.data) ? r.data.filter(Boolean) : [];
      items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      setList(items);
    } catch (e) { setBusy(e.response?.data?.message || e.message); setList([]); }
  }, [authHdr, lens.companyKey]);
  useEffect(() => { setList(null); load(); }, [load]);

  // Open one mockup: pull the full doc (so inline-stored backs hydrate) and model it.
  const openMockup = useCallback(async (item) => {
    setBusy('Loading…'); setPageIdx(0); setSide('front');
    try {
      let full = item;
      if (item.remoteId) {
        const r = await axios.get(`${base}/studio/library/mockups/full`, { ...authHdr, params: { ids: item.remoteId } });
        if (Array.isArray(r.data) && r.data[0]) full = r.data[0];
      }
      setSel({ model: mockupFromLibraryItem(full), item: full });
      setBusy('');
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  }, [authHdr]);

  useEffect(() => {
    if (!busy || String(busy).endsWith('…')) return undefined;
    const t = setTimeout(() => setBusy(''), 5000); return () => clearTimeout(t);
  }, [busy]);

  // A remoteId deep-link opens the read-only detail; "Edit" then hands to the lab.
  useEffect(() => {
    if (entry && entry.remoteId) openMockup({ remoteId: entry.remoteId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editMockup = (remoteId, client) => onNavigate && onNavigate({ view: 'mockup', editMockup: remoteId, client });
  const newInLab = () => onNavigate && onNavigate({ view: 'mockup', editFresh: true });
  const clearLens = () => setLens({ companyKey: '', projectNumber: '', label: '' });

  const filtered = useMemo(() => {
    let items = list || [];
    if (lens.projectNumber) items = items.filter((m) => String(m.pageState?.projectNumber || '') === String(lens.projectNumber));
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((m) => `${m.pageState?.mockupNum || ''} ${m.name || ''} ${m.client || ''}`.toLowerCase().includes(s));
  }, [list, q, lens.projectNumber]);

  // ── Detail view (read-only) ───────────────────────────────────────────────────
  if (sel) {
    const m = sel.model;
    const page = m.pages[pageIdx] || m.pages[0];
    const src = sidePreview(page.sides[side]);
    const otherSide = side === 'front' ? 'back' : 'front';
    const projectNumber = m.projectNumber;
    return (
      <Box sx={{ maxWidth: 920, mx: 'auto', px: { xs: 1.5, md: 2 }, py: 2, ...scrollbar }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <IconButton onClick={() => setSel(null)} size="small" sx={{ color: D.muted, '&:hover': { color: D.text } }}>
            <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {m.name || 'Untitled'}
              {m.mockupNum && <Box component="span" sx={{ ...mono, color: D.faint, fontSize: 12, fontWeight: 600, ml: 1 }}>#{m.mockupNum}</Box>}
            </Typography>
            {m.client && <Typography sx={{ color: D.faint, fontSize: 11.5 }}>{m.client}</Typography>}
          </Box>
          {projectNumber && onNavigate && (
            <Button onClick={() => onNavigate({ view: 'clients', projectNumber })} size="small"
              sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11.5 }}>Open order →</Button>
          )}
          <Button onClick={() => editMockup(sel.item.remoteId, m.client)} size="small"
            startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ color: D.green, textTransform: 'none', fontWeight: 800, fontSize: 11.5, '&:hover': { color: '#3bd070' } }}>Edit in lab</Button>
        </Stack>

        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3, p: { xs: 1.5, md: 2.5 } }}>
          <Box sx={{ position: 'relative', bgcolor: '#fff', borderRadius: 2, overflow: 'hidden',
            aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {src ? (
              <Box component="img" src={src} alt={`${m.name} ${side}`}
                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
            ) : (
              <Stack alignItems="center" sx={{ color: '#b8c2bc' }}>
                <DesignServicesIcon sx={{ fontSize: 40, opacity: 0.4 }} />
                <Typography sx={{ fontSize: 12, mt: 0.5 }}>No {side} view</Typography>
              </Stack>
            )}
          </Box>

          <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 1.5 }}>
            {['front', 'back'].map((s) => {
              const on = s === side;
              const enabled = !!sidePreview(page.sides[s]);
              return (
                <Button key={s} onClick={() => enabled && setSide(s)} disabled={!enabled} size="small"
                  startIcon={s === otherSide ? <FlipOutlinedIcon sx={{ fontSize: 15 }} /> : null}
                  sx={{ textTransform: 'capitalize', fontWeight: 800, fontSize: 12, px: 1.75,
                    color: on ? '#08130c' : (enabled ? D.text : D.faint), bgcolor: on ? D.green : 'transparent',
                    border: `1px solid ${on ? D.green : D.line}`, borderRadius: 999,
                    '&:hover': { bgcolor: on ? D.green : D.panelHi } }}>{s}</Button>
              );
            })}
          </Stack>
        </Box>

        {m.pages.length > 1 && (
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
            {m.pages.map((_, i) => (
              <Button key={i} onClick={() => { setPageIdx(i); setSide('front'); }} size="small"
                sx={{ minWidth: 0, px: 1.5, fontWeight: 800, fontSize: 12, borderRadius: 1.5,
                  color: i === pageIdx ? D.green : D.muted, bgcolor: i === pageIdx ? 'rgba(74,222,128,0.10)' : 'transparent',
                  border: `1px solid ${i === pageIdx ? 'rgba(74,222,128,0.4)' : D.line}` }}>Page {i + 1}</Button>
            ))}
          </Stack>
        )}

        {(page.print[side]?.type || page.print[side]?.loc) && (
          <Typography sx={{ color: D.faint, fontSize: 12, mt: 1.25 }}>
            {[page.print[side].type, page.print[side].dims, page.print[side].loc].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Box>
    );
  }

  // ── Gallery ──────────────────────────────────────────────────────────────────
  const lensOn = !!(lens.companyKey || lens.projectNumber);
  return (
    <Box sx={{ maxWidth: 920, mx: 'auto', px: { xs: 1.5, md: 2 }, py: 2, ...scrollbar }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        {onBack && (
          <IconButton onClick={onBack} size="small" sx={{ color: D.muted, '&:hover': { color: D.text } }}>
            <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <DesignServicesIcon sx={{ color: D.green, fontSize: 20 }} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18, flex: 1 }}>
          Mockup Lab{list ? <Box component="span" sx={{ color: D.faint, fontWeight: 600, fontSize: 13, ml: 1 }}>{filtered.length}</Box> : null}
        </Typography>
        <Button onClick={newInLab} size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          sx={{ color: D.green, textTransform: 'none', fontWeight: 800, fontSize: 11.5, '&:hover': { color: '#3bd070' } }}>New in lab</Button>
      </Stack>

      {lensOn && (
        <Box sx={{ mb: 1.5 }}>
          <Chip label={`Showing: ${lens.label || lens.companyKey || `project #${lens.projectNumber}`}`}
            onDelete={clearLens} size="small"
            sx={{ bgcolor: 'rgba(74,222,128,0.12)', color: D.green, fontWeight: 700, border: `1px solid rgba(74,222,128,0.4)`,
              '& .MuiChip-deleteIcon': { color: D.green, '&:hover': { color: '#3bd070' } } }} />
        </Box>
      )}

      <Box component="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number, name or client…"
        sx={{ width: '100%', mb: 1.75, px: 1.5, py: 1, fontSize: 13, color: D.text, bgcolor: D.panel,
          border: `1px solid ${D.line}`, borderRadius: 2, outline: 'none',
          '&:focus': { borderColor: D.green }, '&::placeholder': { color: D.faint } }} />

      {busy && <Typography sx={{ color: busy.includes('✓') ? D.green : D.amber || '#fbbf24', fontSize: 12, mb: 1 }}>{busy}</Typography>}

      {list === null ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress size={28} sx={{ color: D.green }} /></Box>
      ) : filtered.length === 0 ? (
        <Typography sx={{ color: D.faint, fontSize: 13, py: 5, textAlign: 'center' }}>
          {lensOn ? 'No mockups for this filter yet — open the lab to make one.' : (list.length === 0 ? 'No mockups yet — “New in lab” opens the lab to make one.' : 'No mockups match your search.')}
        </Typography>
      ) : (
        <>
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.75 }}>
          <Typography component="button" onClick={() => setByProject((v) => !v)}
            sx={{ background: 'none', border: 'none', cursor: 'pointer', color: D.faint, fontSize: 11, fontWeight: 700, '&:hover': { color: D.green } }}>
            {byProject ? 'view: by project' : 'view: all (newest first)'}
          </Typography>
        </Stack>
        {(byProject
          ? (() => {
              const groups = new Map();
              for (const m of filtered) {
                const k = (m.pageState && m.pageState.projectNumber) ? String(m.pageState.projectNumber) : '';
                if (!groups.has(k)) groups.set(k, []);
                groups.get(k).push(m);
              }
              const keys = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : Number(b) - Number(a)));
              return keys.map((k) => ({ key: k, label: k ? `#${k} · ${groups.get(k)[0].client || ''}` : 'Unlinked', items: groups.get(k) }));
            })()
          : [{ key: 'all', label: '', items: filtered }]
        ).map((g) => (
        <Box key={g.key} sx={{ mb: 2 }}>
          {g.label && (
            <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.75 }}>
              {g.label} <Box component="span" sx={{ color: 'rgba(255,255,255,0.25)' }}>· {g.items.length}</Box>
            </Typography>
          )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.25 }}>
          {g.items.map((m) => (
            <Box key={m._id} onClick={() => openMockup(m)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMockup(m); } }}
              sx={{ cursor: 'pointer', borderRadius: 2, overflow: 'hidden', border: `1px solid ${D.line}`, bgcolor: D.panel,
                transition: 'border-color .15s, transform .15s', outline: 'none',
                '&:hover, &:focus-visible': { borderColor: D.green, transform: 'translateY(-2px)' } }}>
              {m.thumbnail ? (
                <Box component="img" src={m.thumbnail} alt={m.name} loading="lazy"
                  sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', bgcolor: '#fff' }} />
              ) : (
                <Box sx={{ aspectRatio: '1', bgcolor: D.panelHi, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DesignServicesIcon sx={{ color: D.faint, fontSize: 26 }} />
                </Box>
              )}
              <Box sx={{ px: 1, py: 0.8 }}>
                {m.pageState?.mockupNum && (
                  <Typography sx={{ ...mono, color: D.faint, fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{m.pageState.mockupNum}</Typography>
                )}
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography sx={{ color: D.text, fontSize: 11.5, fontWeight: 700, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name || 'Untitled'}</Typography>
                  <ChevronRightIcon sx={{ color: D.faint, fontSize: 15 }} />
                </Stack>
              </Box>
            </Box>
          ))}
        </Box>
        </Box>
        ))}
        </>
      )}
    </Box>
  );
}
