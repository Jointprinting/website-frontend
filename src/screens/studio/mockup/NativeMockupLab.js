// src/screens/studio/mockup/NativeMockupLab.js
//
// The native, in-Studio Mockup Lab — a React rebuild of the classic /jpstudio
// editor that KEEPS its proven engine: the fabric.js canvas (MockupCanvas, a
// faithful port of openLogoEditor/confirmLogoPosition), the S&S blank finder
// (the same /api/products/ss/finder backend), the print-area auto-placement
// (printAreas.js), and the branded PDF (mockupPdf.js) — all inside the Studio,
// no new tab. Saves through the migration-safe mockupModel adapters (same
// StudioLibraryItem format, companyKey-stamped), and reserves mockup numbers
// server-side. Garment/ink colours + multi-page carry over unchanged.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, Button, TextField, MenuItem, CircularProgress, Divider,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CheckIcon from '@mui/icons-material/Check';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import axios from 'axios';
import config from '../../../config.json';
import { D, mono, scrollbar, dropInput, accentBar, deriveCompanyKey } from '../_shared';
import { emptyPage, hydratePages, mockupToLibraryItem, pageToState } from './mockupModel';
import { PRESETS, PRESET_ORDER } from './printAreas';
import { exportMockupPdf } from './mockupPdf';
import MockupCanvas from './MockupCanvas';

const base = `${config.backendUrl}/api`;
const STAGE_W = 620, STAGE_H = 500, FIT = 0.93;

const uid = () => (window.crypto && window.crypto.randomUUID)
  ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const fileToDataUrl = (file) => new Promise((resolve) => {
  const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(file);
});
const loadImg = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src;
});

// Headless flatten for save/PDF — the same fit + stage→natural mapping the
// canvas uses, so every side (not just the one on screen) bakes identically.
function blankBox(natW, natH) {
  const scale = Math.min(STAGE_W / natW, STAGE_H / natH) * FIT;
  const dispW = natW * scale, dispH = natH * scale;
  return { dispW, dispH, originX: (STAGE_W - dispW) / 2, originY: (STAGE_H - dispH) / 2 };
}
async function flattenHeadless(blankSrc, logoSrc, pos) {
  const [blank, logo] = await Promise.all([loadImg(blankSrc), loadImg(logoSrc)]);
  if (!blank) return null;
  const bW = blank.naturalWidth, bH = blank.naturalHeight;
  const off = document.createElement('canvas'); off.width = bW; off.height = bH;
  const ctx = off.getContext('2d');
  ctx.drawImage(blank, 0, 0, bW, bH);
  if (logo && pos && pos.x != null) {
    const box = blankBox(bW, bH);
    const sX = bW / box.dispW, sY = bH / box.dispH;
    const lw = logo.naturalWidth * (pos.w || 1) * sX, lh = logo.naturalHeight * (pos.h || 1) * sY;
    const lx = (pos.x - box.originX) * sX, ly = (pos.y - box.originY) * sY;
    const cx = lx + lw / 2, cy = ly + lh / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(((pos.angle || 0) * Math.PI) / 180);
    ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh); ctx.restore();
  }
  try { return off.toDataURL('image/png'); } catch (_) { return null; }
}

const clonePages = (pages) => (pages || []).map((pg) => ({
  ...pg,
  category: pg.category || 'generic',
  template: pg.template != null ? pg.template : 1,
  print: { front: { ...pg.print.front }, back: { ...pg.print.back } },
  sides: {
    front: { ...pg.sides.front, pos: { ...pg.sides.front.pos } },
    back: { ...pg.sides.back, pos: { ...pg.sides.back.pos } },
  },
  _extra: { ...pg._extra },
}));

export default function NativeMockupLab({ token, mode, mockup, item, project, onBack, onSaved }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const isNew = mode === 'new' || !mockup;

  const initial = useMemo(
    () => (isNew ? [emptyPage()] : clonePages(mockup.pages && mockup.pages.length ? mockup.pages : [emptyPage()])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [pages, setPages] = useState(initial);
  const [pageIdx, setPageIdx] = useState(0);
  const [side, setSide] = useState('front');
  const [busy, setBusy] = useState('');
  const [mockupNum, setMockupNum] = useState(isNew ? '' : (mockup.mockupNum || ''));
  const remoteIdRef = useRef(isNew ? `studio-${uid()}` : (String((item && item.remoteId) || mockup.remoteId || '') || `studio-${uid()}`));
  const p0extra = (!isNew && mockup.pages && mockup.pages[0] && mockup.pages[0]._extra) || {};
  const [meta, setMeta] = useState({
    title: isNew ? '' : (mockup.name || p0extra.title || ''),
    subtitle: isNew ? '' : (p0extra.subtitle || ''),
    notes: isNew ? '' : (p0extra.notes || ''),
    client: isNew ? (project && project.client) || '' : (mockup.client || (project && project.client) || ''),
  });
  const orderId = (project && project.id) || (item && item.pageState && item.pageState.projectId) || '';
  const projectNumber = (mockup && mockup.projectNumber) || (project && project.projectNumber) || '';
  const prevStates = useMemo(() => (isNew ? [] : hydratePages(item)), [item, isNew]);
  const canvasRef = useRef(null);

  const page = pages[pageIdx] || pages[0];
  const sd = page.sides[side];

  const patchSide = useCallback((patch) => {
    setPages((prev) => { const n = clonePages(prev); Object.assign(n[pageIdx].sides[side], patch); return n; });
  }, [pageIdx, side]);
  const setPos = useCallback((pos) => {
    setPages((prev) => { const n = clonePages(prev); n[pageIdx].sides[side].pos = pos; return n; });
  }, [pageIdx, side]);
  const setPrint = useCallback((field, value) => {
    setPages((prev) => { const n = clonePages(prev); n[pageIdx].print[side][field] = value; return n; });
  }, [pageIdx, side]);
  const setPageField = useCallback((field, value) => {
    setPages((prev) => { const n = clonePages(prev); n[pageIdx][field] = value; return n; });
  }, [pageIdx]);

  const onUpload = (field) => async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const url = await fileToDataUrl(f);
    if (url) patchSide(field === 'logo' ? { logo: url, composite: null } : { blank: url, composite: null });
    e.target.value = '';
  };

  // ── S&S blank finder — same backend the classic lab uses ─────────────────────
  const [ssStyle, setSsStyle] = useState('');
  const [ssBusy, setSsBusy] = useState(false);
  const [ssMsg, setSsMsg] = useState('');
  const [ssColors, setSsColors] = useState(null);
  const applySsColor = (c) => {
    setPages((prev) => {
      const n = clonePages(prev);
      if (c.front) { n[pageIdx].sides.front.blank = c.front; n[pageIdx].sides.front.composite = null; }
      if (c.back) { n[pageIdx].sides.back.blank = c.back; n[pageIdx].sides.back.composite = null; }
      return n;
    });
    if (!meta.subtitle && (c.color || c.style)) setMeta((m) => ({ ...m, subtitle: [c.styleName || ssStyle, c.color].filter(Boolean).join(', ') }));
    setSsColors(null); setSsMsg(`✓ ${c.color || 'loaded'}`);
  };
  const searchSs = async (styleid) => {
    const style = ssStyle.trim(); if (!style && !styleid) { setSsMsg('Enter a style code'); return; }
    setSsBusy(true); setSsMsg('Searching S&S…'); setSsColors(null);
    try {
      const params = {}; if (styleid) params.styleid = styleid; else params.style = style;
      const { data } = await axios.get(`${base}/products/ss/finder`, { ...authHdr, params });
      if (data.error) { setSsMsg(`✗ ${data.error}`); return; }
      if (data.multipleMatches && data.matches?.length) { setSsColors(data.matches.map((m) => ({ pick: 'style', ...m })));  setSsMsg(`${data.matches.length} styles — pick one`); return; }
      if (data.match) { applySsColor(data.match); return; }
      if (data.colors?.length) { setSsColors(data.colors.map((c) => ({ pick: 'color', styleName: data.name, ...c }))); setSsMsg(`${data.name || style} · ${data.colors.length} colors — pick one`); return; }
      setSsMsg('No results for that style');
    } catch (e) { setSsMsg('✗ ' + (e.response?.data?.error || e.message)); }
    finally { setSsBusy(false); }
  };

  // ── Save / PDF ───────────────────────────────────────────────────────────────
  const buildFlat = async (num) => {
    const pdfName = num ? `${String(num).replace(/^#/, '')}.pdf` : (mockupNum ? `${mockupNum.replace(/^#/, '')}.pdf` : '');
    const flat = clonePages(pages);
    for (let i = 0; i < flat.length; i++) {
      flat[i]._extra = {
        ...flat[i]._extra,
        title: meta.title, subtitle: meta.subtitle, notes: meta.notes, client: meta.client,
        mockupNum: num || mockupNum || flat[i]._extra.mockupNum || '',
        ...(pdfName ? { pdfName } : {}),
        ...(projectNumber ? { projectNumber } : {}),
        ...(orderId ? { projectId: orderId } : {}),
      };
      for (const s of ['front', 'back']) {
        const p = flat[i].sides[s];
        if (p.blank && p.logo && p.pos && p.pos.x != null) {
          const comp = await flattenHeadless(p.blank, p.logo, p.pos);
          if (comp) flat[i].sides[s] = { ...p, composite: comp };
        }
      }
    }
    return flat;
  };

  const save = async () => {
    setBusy('Saving…');
    try {
      let num = mockupNum;
      if (isNew && !num && orderId) {
        const asg = await axios.post(`${base}/orders/${orderId}/mockups/assign`, {}, authHdr);
        num = (asg.data && asg.data.mockupNum) || ''; if (num) setMockupNum(num);
      }
      const flat = await buildFlat(num);
      const model = {
        id: (!isNew && mockup.id != null) ? mockup.id : null,
        remoteId: remoteIdRef.current,
        mockupNum: num || mockupNum || '',
        name: meta.title || meta.client || 'Mockup',
        client: meta.client, projectNumber, pages: flat,
      };
      const body = mockupToLibraryItem(model, prevStates);
      body.companyKey = deriveCompanyKey(meta.client);
      body.savedAt = Date.now();
      await axios.post(`${base}/studio/library/mockups`, body, authHdr);
      setPages(flat); setBusy('Saved ✓'); if (onSaved) onSaved();
    } catch (err) { setBusy(err.response?.data?.message || err.message); }
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const exportPdf = async () => {
    if (pdfBusy) return; setPdfBusy(true); setBusy('Building PDF…');
    try {
      const flat = await buildFlat(mockupNum);
      const pageStates = flat.map((pg, i) => pageToState(pg, prevStates[i]));
      const fname = mockupNum ? `${mockupNum.replace(/^#/, '')}.pdf` : `${(meta.title || 'mockup').replace(/[^\w-]+/g, '_')}.pdf`;
      await exportMockupPdf(pageStates, fname); setBusy('PDF exported ✓');
    } catch (e) { setBusy(e.message || 'PDF export failed'); }
    finally { setPdfBusy(false); }
  };

  const [dupBusy, setDupBusy] = useState(false);
  const canDuplicate = !!orderId && !!mockupNum && !isNew;
  const duplicate = async () => {
    if (!canDuplicate || dupBusy) return; setDupBusy(true);
    try {
      const { data } = await axios.post(`${base}/orders/${orderId}/mockups/duplicate`, { remoteId: remoteIdRef.current, mockupNum }, authHdr);
      setBusy(`Variation added · ${data.mockupNum}`); if (onSaved) onSaved();
    } catch (e) { setBusy(e.response?.data?.message || 'Could not add a variation'); }
    finally { setDupBusy(false); }
  };

  React.useEffect(() => {
    if (!busy || String(busy).endsWith('…')) return undefined;
    const t = setTimeout(() => setBusy(''), 4000); return () => clearTimeout(t);
  }, [busy]);

  const addPage = () => { setPages((p) => [...p, emptyPage()]); setPageIdx(pages.length); setSide('front'); };
  const removePage = () => { if (pages.length <= 1) return; setPages((p) => p.filter((_, i) => i !== pageIdx)); setPageIdx((i) => Math.max(0, i - 1)); setSide('front'); };

  const saving = busy.endsWith('…');
  const canvasKey = `${pageIdx}:${side}:${sd.blank ? sd.blank.slice(-24) : 'x'}:${sd.logo ? sd.logo.slice(-24) : 'x'}`;
  const field = (label, value, onChange, opts = {}) => (
    <TextField label={label} value={value} onChange={(e) => onChange(e.target.value)} size="small" fullWidth
      multiline={!!opts.multiline} minRows={opts.multiline ? 2 : undefined} select={!!opts.select} sx={{ ...dropInput }}>
      {opts.select && opts.children}
    </TextField>
  );
  const uploadBtn = (label, f) => (
    <Button component="label" size="small" startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 14 }} />}
      sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 11.5, border: `1px dashed ${D.line}`, borderRadius: 1.5, '&:hover': { color: D.green, borderColor: D.green } }}>
      {label}<input type="file" hidden accept="image/*" onChange={onUpload(f)} />
    </Button>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg, display: 'flex', flexDirection: 'column', ...scrollbar }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ height: 52, px: 2, position: 'relative', flex: '0 0 auto', borderBottom: `1px solid ${D.line}`, bgcolor: D.panel }}>
        <Box sx={accentBar} />
        <IconButton onClick={onBack} size="small" sx={{ color: D.muted, '&:hover': { color: D.text } }}><ArrowBackIosNewIcon sx={{ fontSize: 15 }} /></IconButton>
        <Typography sx={{ ...mono, fontSize: 13, color: D.green, fontWeight: 800 }}>MOCKUP LAB</Typography>
        {mockupNum && <Typography sx={{ ...mono, fontSize: 12, color: D.faint }}>#{mockupNum}</Typography>}
        <Box sx={{ flexGrow: 1 }} />
        {busy && <Typography sx={{ fontSize: 12, color: busy.includes('✓') ? D.green : '#fbbf24' }}>{busy}</Typography>}
        <Button onClick={exportPdf} disabled={pdfBusy} size="small" startIcon={pdfBusy ? <CircularProgress size={13} sx={{ color: D.green }} /> : <PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ color: D.text, textTransform: 'none', fontWeight: 700, fontSize: 12, border: `1px solid ${D.line}`, borderRadius: 999, px: 1.5, '&:hover': { borderColor: D.green, color: D.green } }}>PDF</Button>
        <Button onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={13} sx={{ color: '#08130c' }} /> : <CheckIcon sx={{ fontSize: 16 }} />}
          sx={{ bgcolor: D.green, color: '#08130c', textTransform: 'none', fontWeight: 800, px: 2, borderRadius: 999, '&:hover': { bgcolor: '#3bd070' }, '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.3)' } }}>Save</Button>
      </Stack>

      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '236px 1fr 300px' }, gap: 0, overflow: 'hidden' }}>
        {/* Left — garment / logo / S&S / auto-placement */}
        <Box sx={{ borderRight: { md: `1px solid ${D.line}` }, p: 1.5, overflowY: 'auto', ...scrollbar }}>
          <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 1, mb: 1 }}>GARMENT · {side.toUpperCase()}</Typography>
          <Stack direction="row" gap={1} sx={{ mb: 1 }}>{uploadBtn(sd.blank ? 'Blank ✓' : 'Blank', 'blank')}{uploadBtn(sd.logo ? 'Logo ✓' : 'Logo', 'logo')}</Stack>

          <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 1, mt: 1.5, mb: 0.75 }}>S&amp;S FINDER</Typography>
          <Stack direction="row" gap={0.75}>
            <TextField value={ssStyle} onChange={(e) => setSsStyle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') searchSs(); }}
              placeholder="Style (e.g. 3001)" size="small" fullWidth sx={{ ...dropInput }} />
            <IconButton onClick={() => searchSs()} disabled={ssBusy} size="small" sx={{ color: D.green, border: `1px solid ${D.line}`, borderRadius: 1.5 }}>
              {ssBusy ? <CircularProgress size={14} sx={{ color: D.green }} /> : <SearchIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Stack>
          {ssMsg && <Typography sx={{ fontSize: 10.5, color: ssMsg.startsWith('✗') ? '#f87171' : D.faint, mt: 0.5 }}>{ssMsg}</Typography>}
          {ssColors && (
            <Stack gap={0.4} sx={{ mt: 0.75, maxHeight: 180, overflowY: 'auto', ...scrollbar }}>
              {ssColors.map((c, i) => (
                <Button key={i} onClick={() => (c.pick === 'style' ? searchSs(c.styleID) : applySsColor(c))} size="small"
                  sx={{ justifyContent: 'flex-start', color: D.text, textTransform: 'none', fontSize: 11, border: `1px solid ${D.line}`, borderRadius: 1, px: 1, '&:hover': { borderColor: D.green } }}>
                  {c.pick === 'style' ? (c.label || c.styleName) : (c.color || 'color')}
                </Button>
              ))}
            </Stack>
          )}

          {sd.logo && (
            <>
              <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 1, mt: 1.75, mb: 0.75 }}>AUTO-PLACEMENT</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5 }}>
                {PRESET_ORDER.map((k) => (
                  <Button key={k} onClick={() => canvasRef.current && canvasRef.current.applyPreset(PRESETS[k])} size="small"
                    sx={{ color: D.text, fontSize: 10, textTransform: 'none', fontWeight: 600, border: `1px solid ${D.line}`, borderRadius: 1, minWidth: 0, px: 0.5, '&:hover': { borderColor: D.green, color: D.green } }}>{PRESETS[k].label}</Button>
                ))}
              </Box>
              <Stack direction="row" gap={0.5} alignItems="center" sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: 10, color: D.faint, fontWeight: 700 }}>Nudge</Typography>
                {[['←', -2, 0], ['→', 2, 0], ['↑', 0, -2], ['↓', 0, 2]].map(([l, dx, dy]) => (
                  <Button key={l} onClick={() => canvasRef.current && canvasRef.current.nudge(dx, dy)} size="small"
                    sx={{ minWidth: 26, color: D.text, border: `1px solid ${D.line}`, borderRadius: 1, fontSize: 13, fontWeight: 800, '&:hover': { borderColor: D.green, color: D.green } }}>{l}</Button>
                ))}
              </Stack>
            </>
          )}
        </Box>

        {/* Center — canvas + side/page controls */}
        <Box sx={{ p: 2, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', ...scrollbar }}>
          <Stack direction="row" gap={0.75} sx={{ mb: 1 }} flexWrap="wrap" justifyContent="center">
            {pages.map((_, i) => (
              <Button key={i} onClick={() => { setPageIdx(i); setSide('front'); }} size="small"
                sx={{ minWidth: 0, px: 1.25, fontWeight: 800, fontSize: 11, borderRadius: 1.5, color: i === pageIdx ? D.green : D.muted, bgcolor: i === pageIdx ? 'rgba(74,222,128,0.10)' : 'transparent', border: `1px solid ${i === pageIdx ? 'rgba(74,222,128,0.4)' : D.line}` }}>Pg {i + 1}</Button>
            ))}
            <IconButton onClick={addPage} size="small" sx={{ color: D.muted, border: `1px dashed ${D.line}`, borderRadius: 1.5 }}><AddIcon sx={{ fontSize: 14 }} /></IconButton>
            {pages.length > 1 && <IconButton onClick={removePage} size="small" sx={{ color: D.muted, '&:hover': { color: '#f87171' } }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton>}
          </Stack>
          <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2, overflow: 'hidden', maxWidth: '100%' }}>
            <MockupCanvas ref={canvasRef} key={canvasKey} width={STAGE_W} height={STAGE_H}
              blankSrc={sd.blank || sd.composite || null} logoSrc={sd.logo || null} pos={sd.pos} onChange={setPos} />
          </Box>
          <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
            {['front', 'back'].map((s) => {
              const on = s === side;
              return (
                <Button key={s} onClick={() => setSide(s)} size="small"
                  sx={{ textTransform: 'capitalize', fontWeight: 800, fontSize: 12, px: 2, color: on ? '#08130c' : D.text, bgcolor: on ? D.green : 'transparent', border: `1px solid ${on ? D.green : D.line}`, borderRadius: 999, '&:hover': { bgcolor: on ? D.green : D.panelHi } }}>{s}</Button>
              );
            })}
          </Stack>
          {!sd.logo && (
            <Typography sx={{ color: D.faint, fontSize: 12, mt: 1.5, textAlign: 'center', maxWidth: 340 }}>
              {sd.composite ? 'This side has only the flattened image (synced). Upload the logo to re-place it, or use S&S to load a fresh blank.' : 'Upload a blank + logo (or use the S&S finder), then drag it on the garment.'}
            </Typography>
          )}
        </Box>

        {/* Right — mockup info */}
        <Box sx={{ borderLeft: { md: `1px solid ${D.line}` }, p: 1.75, overflowY: 'auto', ...scrollbar }}>
          <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 1, mb: 1 }}>MOCKUP INFO</Typography>
          <Stack gap={1.25}>
            {field('Title', meta.title, (v) => setMeta((m) => ({ ...m, title: v })))}
            {field('Client', meta.client, (v) => setMeta((m) => ({ ...m, client: v })))}
            {field('Subtitle', meta.subtitle, (v) => setMeta((m) => ({ ...m, subtitle: v })))}
            {field('Notes', meta.notes, (v) => setMeta((m) => ({ ...m, notes: v })), { multiline: true })}
            {field('Template', page.template, (v) => setPageField('template', Number(v)), { select: true, children: [<MenuItem key={1} value={1}>Front + Back</MenuItem>, <MenuItem key={2} value={2}>Front only</MenuItem>] })}
            <Divider sx={{ borderColor: D.line }} />
            <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{side} print spec</Typography>
            {field('Type', page.print[side].type, (v) => setPrint('type', v))}
            {field('Dimensions', page.print[side].dims, (v) => setPrint('dims', v))}
            {field('Location', page.print[side].loc, (v) => setPrint('loc', v))}
            {canDuplicate && (
              <Button onClick={duplicate} disabled={dupBusy} size="small" startIcon={dupBusy ? <CircularProgress size={13} sx={{ color: D.green }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
                sx={{ color: D.text, textTransform: 'none', fontWeight: 700, fontSize: 12, border: `1px solid ${D.line}`, borderRadius: 999, mt: 1, '&:hover': { borderColor: D.green, color: D.green } }}>Add a variation</Button>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
