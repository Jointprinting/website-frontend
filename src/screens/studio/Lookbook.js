// src/screens/studio/Lookbook.js
//
// The rebuilt Lookbook — the polished, client-branded deck the owner assembles
// and sends to show off the mockups designed for an order. Pick a client, tap
// their mockups into an ordered deck, and watch a LIVE branded preview that
// mirrors, page-for-page, the PDF the backend renders (POST
// /api/studio/lookbook/pdf). View-only by design: you curate + arrange, then
// export. The preview's layout math mirrors controllers/lookbookPdf.js exactly,
// so what you see is what the client gets.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, TextField, Button, Tooltip, CircularProgress,
  Select, MenuItem, FormControl,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import axios from 'axios';
import config from '../../config.json';
import { D, mono, scrollbar, dropInput } from './_shared';

const base = `${config.backendUrl}/api/studio`;
const onlyDigits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
// Lowercased alphanumerics — the canonical company-key convention, used to match
// a deep-linked client name to one in the (differently-cased) mockup list.
const deriveKeyLocal = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// ── layout math — MUST mirror controllers/lookbookPdf.js so the preview matches ──
const LAYOUTS = { editorial: [1, 1], grid: [2, 2], contact: [3, 3] };
const pickLayout = (n) => (n <= 2 ? 'editorial' : n <= 8 ? 'grid' : 'contact');
const resolveLayout = (l, n) => (l && l !== 'auto' && LAYOUTS[l] ? l : pickLayout(n));
const perPage = (l) => { const [c, r] = LAYOUTS[l] || LAYOUTS.grid; return c * r; };
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const idOf = (mk) => String(mk._id || mk.remoteId);
const numOf = (mk) => (mk.pageState && mk.pageState.mockupNum) || '';
// The back composite is shown in the preview only when it's a real (R2) URL —
// a legacy inline base64 back is stripped to a flag by the summary endpoint, so
// it can't be previewed (the PDF still renders it from the full doc).
const backUrlOf = (mk) => (typeof mk.data === 'string' && /^https?:\/\//i.test(mk.data) ? mk.data : null);

// ── a single mockup cell, used in every preview page (mirrors drawCell) ──
function PreviewCell({ mk, showBack, showLabels, big }) {
  const back = showBack ? backUrlOf(mk) : null;
  const num = numOf(mk);
  const name = (mk.name || '').trim();
  return (
    <Box sx={{
      position: 'relative', borderRadius: 1.5, bgcolor: '#f5f6f4', border: '1px solid #e4e7e3',
      overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'stretch', minHeight: 0, p: big ? 1.5 : 0.75, gap: 0.5 }}>
        {mk.thumbnail
          ? <Box component="img" src={mk.thumbnail} alt={name || 'mockup'} loading="lazy"
              sx={{ flex: back ? '0 0 60%' : 1, width: '100%', minWidth: 0, objectFit: 'contain' }} />
          : <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa39c', fontSize: 10 }}>no image</Box>}
        {back && (
          <Box component="img" src={back} alt="back" loading="lazy"
            sx={{ flex: '0 0 37%', minWidth: 0, objectFit: 'contain', borderLeft: '1px solid #e4e7e3', pl: 0.5 }} />
        )}
      </Box>
      {showLabels && (num || name) && (
        <Box sx={{ borderTop: '1px solid #e4e7e3', px: 0.75, py: '3px', display: 'flex', gap: 0.6,
          alignItems: 'baseline', bgcolor: '#ffffff', minWidth: 0 }}>
          {num ? <Box component="span" sx={{ ...mono, color: '#16a34a', fontWeight: 800, fontSize: big ? 11 : 8.5, flexShrink: 0 }}>#{num}</Box> : null}
          {name ? <Box component="span" sx={{ color: '#15201a', fontWeight: 700, fontSize: big ? 11 : 8.5,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Box> : null}
        </Box>
      )}
    </Box>
  );
}

// One portrait "page" at US-Letter ratio (612 / 792).
function Page({ children, dark }) {
  return (
    <Box sx={{
      aspectRatio: '612 / 792', width: '100%', borderRadius: 1.5, overflow: 'hidden',
      bgcolor: dark ? '#0e1a13' : '#ffffff',
      boxShadow: '0 8px 28px rgba(0,0,0,0.45)', border: `1px solid ${D.line}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </Box>
  );
}

function CoverPage({ info }) {
  return (
    <Page dark>
      <Box sx={{ flex: 1, p: '7%', display: 'flex', flexDirection: 'column', color: '#fff' }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ borderBottom: '1px solid #2c5a3f', pb: 1.25 }}>
          <Box sx={{ ...mono, color: '#22c55e', fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>JOINT PRINTING</Box>
        </Stack>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography sx={{ color: '#7fcf9e', fontWeight: 800, fontSize: 12, letterSpacing: 3 }}>LOOKBOOK</Typography>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 30, lineHeight: 1.1, mt: 1.25 }}>
            {info.title}
          </Typography>
          {info.subtitle && (
            <Typography sx={{ color: '#c5ccc7', fontWeight: 500, fontSize: 14, mt: 1.25 }}>{info.subtitle}</Typography>
          )}
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Typography sx={{ color: '#8b958e', fontSize: 11 }}>
            {[info.projectNumber ? `Project #${info.projectNumber}` : null, `${info.count} ${info.count === 1 ? 'style' : 'styles'}`, info.date].filter(Boolean).join('    ·    ')}
          </Typography>
          <Typography sx={{ color: '#22c55e', fontSize: 10 }}>jointprinting.com</Typography>
        </Stack>
      </Box>
    </Page>
  );
}

function ContentPage({ items, layout, info, pageNum, totalPages, showBack, showLabels }) {
  const [cols, rows] = LAYOUTS[layout] || LAYOUTS.grid;
  const big = layout === 'editorial';
  return (
    <Page>
      <Box sx={{ flex: 1, p: '5.5%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center"
          sx={{ borderBottom: '1px solid #e4e7e3', pb: 0.75, mb: 1 }}>
          <Box sx={{ ...mono, color: '#1a3d2b', fontWeight: 800, fontSize: 9 }}>JOINT PRINTING</Box>
          <Box sx={{ color: '#6b766f', fontSize: 9 }}>{info.client}</Box>
        </Stack>
        <Box sx={{
          flex: 1, minHeight: 0, display: 'grid', gap: 1,
          gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}>
          {items.map((mk) => <PreviewCell key={idOf(mk)} mk={mk} showBack={showBack} showLabels={showLabels} big={big} />)}
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center"
          sx={{ borderTop: '1px solid #e4e7e3', pt: 0.6, mt: 1, color: '#9aa39c', fontSize: 8.5 }}>
          <span>{info.date}</span>
          {totalPages > 1 && <span>{pageNum} / {totalPages}</span>}
          <Box component="span" sx={{ color: '#22c55e' }}>jointprinting.com</Box>
        </Stack>
      </Box>
    </Page>
  );
}

export default function Lookbook({ token, onBack, items: itemsProp, initialClient }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [items, setItems] = useState(Array.isArray(itemsProp) ? itemsProp : []);
  const [loading, setLoading] = useState(!Array.isArray(itemsProp) || itemsProp.length === 0);
  const [client, setClient] = useState('');
  const [deckIds, setDeckIds] = useState([]);      // ordered selected mockup ids
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [layout, setLayout] = useState('auto');
  const [showBack, setShowBack] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState('');

  // Self-sufficient: fetch the library if the parent didn't hand it down.
  useEffect(() => {
    if (Array.isArray(itemsProp) && itemsProp.length) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${base}/library/mockups?summary=1`, authHdr);
        if (!cancelled) setItems(Array.isArray(r.data) ? r.data : []);
      } catch (e) { if (!cancelled) setErr(e.response?.data?.message || e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [authHdr, itemsProp]);

  // Clients that actually have mockups, with counts — the picker's options.
  const clients = useMemo(() => {
    const m = new Map();
    items.forEach((it) => {
      const c = (it.client || '').trim();
      if (!c) return;
      m.set(c, (m.get(c) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  // Default the client: a deep-linked client (e.g. "build a lookbook for this
  // company") wins if they have mockups; otherwise whoever has the most.
  useEffect(() => {
    if (client || !clients.length) return;
    const want = (initialClient || '').trim();
    const match = want && clients.find(([c]) => deriveKeyLocal(c) === deriveKeyLocal(want));
    setClient(match ? match[0] : clients.slice().sort((a, b) => b[1] - a[1])[0][0]);
  }, [clients, client, initialClient]);

  const clientMockups = useMemo(
    () => items.filter((it) => (it.client || '').trim() === client),
    [items, client],
  );

  // The ordered deck, resolved from ids → mockup objects (drops any that vanished).
  const deck = useMemo(() => {
    const byId = new Map(items.map((it) => [idOf(it), it]));
    return deckIds.map((id) => byId.get(id)).filter(Boolean);
  }, [deckIds, items]);

  // Switching client starts a fresh deck for that client.
  const onPickClient = (c) => {
    setClient(c);
    setDeckIds([]);
    setTitleTouched(false);
  };

  // Title auto-follows the client until the owner edits it.
  const effectiveTitle = titleTouched && title.trim() ? title.trim() : (client ? `${client} Lookbook` : 'Lookbook');

  const projectNumber = useMemo(() => {
    for (const mk of deck) { const p = onlyDigits(mk.pageState && mk.pageState.projectNumber); if (p) return p; }
    return '';
  }, [deck]);

  const toggle = (mk) => {
    const id = idOf(mk);
    setDeckIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };
  const move = (id, dir) => setDeckIds((ids) => {
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return ids;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const remove = (id) => setDeckIds((ids) => ids.filter((x) => x !== id));
  const addAll = () => setDeckIds(clientMockups.map(idOf));

  const resolved = resolveLayout(layout, deck.length);
  const pages = chunk(deck, perPage(resolved));
  const info = { title: effectiveTitle, subtitle: subtitle.trim(), client, projectNumber, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), count: deck.length };

  const exportPdf = async () => {
    if (!deck.length) return;
    setExporting(true); setErr('');
    try {
      const r = await axios.post(`${base}/lookbook/pdf`, {
        mockupIds: deckIds, title: effectiveTitle, subtitle: subtitle.trim(),
        clientName: client, projectNumber, layout, showBack, showLabels,
      }, { ...authHdr, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      const cd = r.headers['content-disposition'] || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      a.download = m ? m[1] : `lookbook-${(client || 'joint-printing').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      // A 400/500 arrives as a Blob (responseType:blob) — read the JSON out of it.
      let msg = e.message;
      try { if (e.response && e.response.data && e.response.data.text) { const j = JSON.parse(await e.response.data.text()); msg = j.message || msg; } } catch (_) { /* keep msg */ }
      setErr(msg);
    } finally { setExporting(false); }
  };

  const selSet = new Set(deckIds);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: D.bg }}>
      {/* Top bar */}
      <Stack direction="row" alignItems="center" gap={1}
        sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${D.line}`, flexShrink: 0 }}>
        <IconButton size="small" onClick={onBack} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <CollectionsBookmarkOutlinedIcon sx={{ fontSize: 18, color: D.green }} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 17, flex: 1 }}>Lookbook</Typography>
        {deck.length > 0 && (
          <Typography sx={{ ...mono, color: D.faint, fontSize: 12, mr: 0.5 }}>
            {deck.length} {deck.length === 1 ? 'style' : 'styles'} · {pages.length + 1}pg
          </Typography>
        )}
        <Button
          onClick={exportPdf} disabled={!deck.length || exporting}
          startIcon={exporting ? <CircularProgress size={15} sx={{ color: D.ink }} /> : <PictureAsPdfOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{ bgcolor: D.green, color: D.ink, textTransform: 'none', fontWeight: 800, borderRadius: 999, px: 2,
            '&:hover': { bgcolor: '#5cec8e' }, '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.25)', color: 'rgba(6,20,12,0.5)' } }}>
          {exporting ? 'Building…' : 'Export PDF'}
        </Button>
      </Stack>

      {err && <Typography sx={{ color: D.amber, fontSize: 12.5, px: 2, py: 1, flexShrink: 0 }}>{err}</Typography>}

      {/* Two-pane on desktop; stacks vertically on a phone so the preview isn't
          crushed by the fixed rail. The rail caps its height on mobile and
          scrolls its mockup grid internally. */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Left rail — client + their mockups to tap into the deck */}
        <Box sx={{
          width: { xs: '100%', md: 300 }, flexShrink: 0,
          maxHeight: { xs: '40vh', md: 'none' },
          borderRight: { xs: 'none', md: `1px solid ${D.line}` },
          borderBottom: { xs: `1px solid ${D.line}`, md: 'none' },
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <Box sx={{ p: 1.5, borderBottom: `1px solid ${D.line}` }}>
            <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', mb: 0.75 }}>Client</Typography>
            <FormControl fullWidth size="small">
              <Select value={client} displayEmpty onChange={(e) => onPickClient(e.target.value)}
                sx={{ color: D.text, fontSize: 13, bgcolor: D.inset, borderRadius: 2,
                  '& fieldset': { borderColor: D.line }, '&:hover fieldset': { borderColor: D.lineHi }, '& .MuiSelect-icon': { color: D.muted } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}` } } }}>
                {clients.length === 0 && <MenuItem value="" disabled>No mockups yet</MenuItem>}
                {clients.map(([c, n]) => (
                  <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>
                    {c} <Box component="span" sx={{ ...mono, color: D.faint, ml: 0.75, fontSize: 11 }}>{n}</Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
            <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
              Mockups{clientMockups.length ? ` · ${clientMockups.length}` : ''}
            </Typography>
            {clientMockups.length > 0 && (
              <Button onClick={addAll} startIcon={<AddIcon sx={{ fontSize: 14 }} />} size="small"
                sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11, minWidth: 0, p: 0.25 }}>
                Add all
              </Button>
            )}
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.5, pb: 1.5, ...scrollbar }}>
            {loading ? (
              <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: D.green }} /></Box>
            ) : clientMockups.length === 0 ? (
              <Typography sx={{ color: D.faint, fontSize: 12, textAlign: 'center', py: 5 }}>
                {client ? 'No mockups for this client.' : 'Pick a client to begin.'}
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                {clientMockups.map((mk) => {
                  const on = selSet.has(idOf(mk));
                  return (
                    <Box key={idOf(mk)} onClick={() => toggle(mk)} title={mk.name || 'mockup'}
                      sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer',
                        border: `2px solid ${on ? D.green : D.line}`, bgcolor: D.inset, aspectRatio: '1 / 1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'border-color 0.12s ease', '&:hover': { borderColor: on ? D.green : D.lineHi } }}>
                      {mk.thumbnail
                        ? <Box component="img" src={mk.thumbnail} alt={mk.name || 'mockup'} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.5 }} />
                        : <Typography sx={{ color: D.faint, fontSize: 10 }}>no image</Typography>}
                      {numOf(mk) ? (
                        <Box sx={{ position: 'absolute', top: 4, left: 4, px: 0.5, py: '1px', borderRadius: 0.75,
                          bgcolor: 'rgba(0,0,0,0.6)', color: D.green, ...mono, fontSize: 9.5, fontWeight: 800 }}>#{numOf(mk)}</Box>
                      ) : null}
                      {on && (
                        <Box sx={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                          bgcolor: D.green, color: D.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckIcon sx={{ fontSize: 13 }} />
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* Right — settings, deck strip, and the live branded preview */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Settings */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${D.line}`, display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField size="small" placeholder="Lookbook title" value={titleTouched ? title : effectiveTitle}
              onChange={(e) => { setTitleTouched(true); setTitle(e.target.value); }}
              sx={{ ...dropInput, minWidth: 200, flex: 1 }} />
            <TextField size="small" placeholder="Note for the client (optional)" value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)} sx={{ ...dropInput, minWidth: 200, flex: 1 }} />
            <FormControl size="small">
              <Select value={layout} onChange={(e) => setLayout(e.target.value)}
                sx={{ color: D.text, fontSize: 13, bgcolor: D.inset, borderRadius: 2, minWidth: 130,
                  '& fieldset': { borderColor: D.line }, '& .MuiSelect-icon': { color: D.muted } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}` } } }}>
                <MenuItem value="auto" sx={{ fontSize: 13 }}>Auto layout{deck.length ? ` · ${resolved}` : ''}</MenuItem>
                <MenuItem value="editorial" sx={{ fontSize: 13 }}>Editorial · 1 / page</MenuItem>
                <MenuItem value="grid" sx={{ fontSize: 13 }}>Grid · 4 / page</MenuItem>
                <MenuItem value="contact" sx={{ fontSize: 13 }}>Contact · 9 / page</MenuItem>
              </Select>
            </FormControl>
            <ToggleChip on={showBack} onClick={() => setShowBack((v) => !v)} label="Back" />
            <ToggleChip on={showLabels} onClick={() => setShowLabels((v) => !v)} label="Labels" />
          </Box>

          {/* Deck strip */}
          <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${D.line}`, flexShrink: 0 }}>
            {deck.length === 0 ? (
              <Typography sx={{ color: D.faint, fontSize: 12.5 }}>Tap mockups on the left to build the deck — drag the order with the arrows.</Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, ...scrollbar }}>
                {deck.map((mk, i) => (
                  <Box key={idOf(mk)} sx={{ position: 'relative', flexShrink: 0, width: 76 }}>
                    <Box sx={{ position: 'relative', width: 76, height: 76, borderRadius: 1.5, overflow: 'hidden',
                      border: `1px solid ${D.line}`, bgcolor: D.inset, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {mk.thumbnail
                        ? <Box component="img" src={mk.thumbnail} alt={mk.name || 'mockup'} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.5 }} />
                        : <Typography sx={{ color: D.faint, fontSize: 9 }}>no image</Typography>}
                      <Box sx={{ position: 'absolute', top: 2, left: 2, px: 0.5, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: D.green, ...mono, fontSize: 9, fontWeight: 800 }}>{i + 1}</Box>
                      <IconButton onClick={() => remove(idOf(mk))} size="small"
                        sx={{ position: 'absolute', top: 0, right: 0, p: '1px', color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(248,113,113,0.85)' } }}>
                        <CloseIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                    <Stack direction="row" justifyContent="center" sx={{ mt: 0.25 }}>
                      <IconButton onClick={() => move(idOf(mk), -1)} disabled={i === 0} size="small" sx={{ p: '1px', color: D.muted, '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' } }}>
                        <KeyboardArrowUpIcon sx={{ fontSize: 16, transform: 'rotate(-90deg)' }} />
                      </IconButton>
                      <IconButton onClick={() => move(idOf(mk), 1)} disabled={i === deck.length - 1} size="small" sx={{ p: '1px', color: D.muted, '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' } }}>
                        <KeyboardArrowDownIcon sx={{ fontSize: 16, transform: 'rotate(-90deg)' }} />
                      </IconButton>
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Live preview — the view-only branded deck, page for page */}
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', bgcolor: '#0a120e', p: 3, ...scrollbar }}>
            {deck.length === 0 ? (
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: D.faint }}>
                <CollectionsBookmarkOutlinedIcon sx={{ fontSize: 40, mb: 1.5, opacity: 0.6 }} />
                <Typography sx={{ color: D.muted, fontWeight: 700, fontSize: 15 }}>Your lookbook preview lands here</Typography>
                <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>Pick a client and tap in their mockups to see the branded deck.</Typography>
              </Box>
            ) : (
              <Box sx={{ maxWidth: 480, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <CoverPage info={info} />
                {pages.map((pg, i) => (
                  <ContentPage key={i} items={pg} layout={resolved} info={info}
                    pageNum={i + 1} totalPages={pages.length} showBack={showBack} showLabels={showLabels} />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function ToggleChip({ on, onClick, label }) {
  return (
    <Tooltip title={on ? `${label} on` : `${label} off`}>
      <Box onClick={onClick} role="button"
        sx={{ px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer', userSelect: 'none', fontSize: 12, fontWeight: 700,
          border: `1px solid ${on ? D.green : D.line}`, color: on ? D.ink : D.muted, bgcolor: on ? D.green : 'transparent',
          transition: 'all 0.12s ease', '&:hover': { borderColor: on ? D.green : D.lineHi } }}>
        {label}
      </Box>
    </Tooltip>
  );
}
