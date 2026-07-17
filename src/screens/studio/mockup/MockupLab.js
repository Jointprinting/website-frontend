// src/screens/studio/mockup/MockupLab.js
//
// Mockup Lab v2 — the in-Studio surface. Phase 2: browse the mockup library and
// view every page × side rendered NATIVELY inside the Studio (no new-tab hand-off
// to the legacy /jpstudio/ editor), reading through the migration-safe model in
// mockupModel.js so page-2+ backs render correctly. The interactive canvas editor
// (place / drag / snap / flip / variants) lands on top of this in the next phase;
// until then, "Edit in classic" opens the existing editor one click away, so no
// capability is lost while the rebuild proceeds.
//
// Reuses the shared `D` palette + the existing /api/studio/library endpoints — the
// same ones OrderTracker / Lookbooks / the CRM design library already read.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, IconButton, Button, CircularProgress } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FlipOutlinedIcon from '@mui/icons-material/FlipOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import axios from 'axios';
import config from '../../../config.json';
import { D, mono, scrollbar } from '../_shared';
import { mockupFromLibraryItem, sidePreview } from './mockupModel';
import MockupEditor from './MockupEditor';

const base = `${config.backendUrl}/api`;
// The legacy editor still owns interactive editing; deep-link into it by remoteId.
const classicHref = (remoteId) => `${process.env.PUBLIC_URL || ''}/jpstudio/${remoteId ? `?mockup=${encodeURIComponent(remoteId)}` : ''}`;

export default function MockupLab({ token, onBack, onNavigate }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [list, setList] = useState(null);       // summary array | null (loading)
  const [sel, setSel] = useState(null);          // { model, item } of the opened mockup
  const [pageIdx, setPageIdx] = useState(0);
  const [side, setSide] = useState('front');
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);   // in the interactive placement editor

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${base}/studio/library/mockups?summary=1`, authHdr);
      const items = Array.isArray(r.data) ? r.data.filter(Boolean) : [];
      // Newest first; the summary carries pageState.mockupNum + thumbnail (front).
      items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      setList(items);
    } catch (e) { setBusy(e.response?.data?.message || e.message); setList([]); }
  }, [authHdr]);
  useEffect(() => { load(); }, [load]);

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

  const filtered = useMemo(() => {
    const items = list || [];
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((m) => `${m.pageState?.mockupNum || ''} ${m.name || ''} ${m.client || ''}`.toLowerCase().includes(s));
  }, [list, q]);

  // ── Interactive placement editor ─────────────────────────────────────────────
  if (editing && sel) {
    return (
      <MockupEditor token={token} mockup={sel.model} item={sel.item}
        onClose={() => setEditing(false)}
        onSaved={async () => { setEditing(false); await load(); await openMockup(sel.item); }} />
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
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
          <Button onClick={() => setEditing(true)} size="small" startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ color: D.green, textTransform: 'none', fontWeight: 800, fontSize: 11.5 }}>Edit</Button>
          <Button component="a" href={classicHref(sel.item.remoteId)} target="_blank" rel="noreferrer" size="small"
            endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
            sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 11.5, '&:hover': { color: D.green } }}>Edit in classic</Button>
        </Stack>

        {/* The rendered view */}
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

          {/* Front / back flip */}
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

        {/* Page tabs for a multi-page mockup */}
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

        {/* Print spec for the current page/side */}
        {(page.print[side]?.type || page.print[side]?.loc) && (
          <Typography sx={{ color: D.faint, fontSize: 12, mt: 1.25 }}>
            {[page.print[side].type, page.print[side].dims, page.print[side].loc].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Box>
    );
  }

  // ── Gallery ──────────────────────────────────────────────────────────────────
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
          Mockup Lab{list ? <Box component="span" sx={{ color: D.faint, fontWeight: 600, fontSize: 13, ml: 1 }}>{list.length}</Box> : null}
        </Typography>
        <Button component="a" href={classicHref('')} target="_blank" rel="noreferrer" size="small"
          endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
          sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 11.5, '&:hover': { color: D.green } }}>Classic editor</Button>
      </Stack>

      <Box component="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number, name or client…"
        sx={{ width: '100%', mb: 1.75, px: 1.5, py: 1, fontSize: 13, color: D.text, bgcolor: D.panel,
          border: `1px solid ${D.line}`, borderRadius: 2, outline: 'none',
          '&:focus': { borderColor: D.green }, '&::placeholder': { color: D.faint } }} />

      {busy && <Typography sx={{ color: busy.includes('✓') ? D.green : D.amber || '#fbbf24', fontSize: 12, mb: 1 }}>{busy}</Typography>}

      {list === null ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress size={28} sx={{ color: D.green }} /></Box>
      ) : filtered.length === 0 ? (
        <Typography sx={{ color: D.faint, fontSize: 13, py: 5, textAlign: 'center' }}>
          {list.length === 0 ? 'No mockups saved yet — build one in the classic editor and it appears here.' : 'No mockups match your search.'}
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.25 }}>
          {filtered.map((m) => (
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
      )}
    </Box>
  );
}
