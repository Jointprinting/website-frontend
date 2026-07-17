// src/screens/studio/mockup/MockupEditor.js
//
// Mockup Lab v2 — the interactive placement editor (Phase 3). Opens a mockup in the
// Studio, lets the owner place / drag / scale / rotate the logo on a garment blank
// (front and back), flattens it exactly the way the legacy /jpstudio editor does,
// and saves through the migration-safe mockupToLibraryItem so the backlog + every
// downstream surface (Order Tracker, Approval, Lookbook, Confirmation PDF, CRM design
// library) keep working byte-for-byte — no format change, no migration.
//
// COORDINATE SPACE: a fixed 620×500 logical stage (the legacy editor's desktop canvas
// size), so a placement stays interoperable with the classic editor. The blank is fit
// into that stage the same way legacy does (scale = min(620/w,500/h)*0.93, centered).
// The stage is drawn scaled-to-fit the responsive container. The flatten maps the
// stage coords back to the blank's NATURAL pixels exactly like legacy confirmLogoPosition
// (sX = naturalW / displayW), so what you see is what bakes.
//
// SOURCE ART: synced mockups keep only the flattened composite (the legacy sync trims
// the separable blank/logo), so re-placing needs the logo re-supplied. Upload a logo
// (and optionally a fresh blank) right here; a placement then flattens onto the blank.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Typography, IconButton, Button, Slider, CircularProgress } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import CheckIcon from '@mui/icons-material/Check';
import axios from 'axios';
import config from '../../../config.json';
import { D, mono, scrollbar } from '../_shared';
import { mockupToLibraryItem, hydratePages, emptyPos } from './mockupModel';

const base = `${config.backendUrl}/api`;
const STAGE_W = 620;
const STAGE_H = 500;         // the legacy desktop canvas size — keep for interop
const BLANK_FIT = 0.93;      // legacy blankImg fit factor

// The blank's box within the 620×500 stage — same fit/center math as the legacy tool.
function blankBox(natW, natH) {
  const scale = Math.min(STAGE_W / natW, STAGE_H / natH) * BLANK_FIT;
  const dispW = natW * scale, dispH = natH * scale;
  return { scale, dispW, dispH, originX: (STAGE_W - dispW) / 2, originY: (STAGE_H - dispH) / 2 };
}

const loadImg = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';          // R2-hosted blanks need this or toDataURL taints
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const fileToDataUrl = (file) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => resolve(null);
  r.readAsDataURL(file);
});

// Flatten one side to a PNG data URL — the EXACT legacy confirmLogoPosition math:
// blank at natural size, logo mapped from stage coords to natural via sX = natW/dispW,
// rotated about its center. Returns null if either image can't load.
async function flattenSide(blankSrc, logoSrc, pos) {
  const [blank, logo] = await Promise.all([loadImg(blankSrc), loadImg(logoSrc)]);
  if (!blank) return null;
  const bW = blank.naturalWidth, bH = blank.naturalHeight;
  const off = document.createElement('canvas');
  off.width = bW; off.height = bH;
  const ctx = off.getContext('2d');
  ctx.drawImage(blank, 0, 0, bW, bH);
  if (logo && pos && pos.x != null) {
    const box = blankBox(bW, bH);
    const sX = bW / box.dispW, sY = bH / box.dispH;         // stage → natural
    const lw = logo.naturalWidth * (pos.w || 1) * sX;
    const lh = logo.naturalHeight * (pos.h || 1) * sY;
    const lx = (pos.x - box.originX) * sX;
    const ly = (pos.y - box.originY) * sY;
    const cx = lx + lw / 2, cy = ly + lh / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((pos.angle || 0) * Math.PI) / 180);
    ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();
  }
  try { return off.toDataURL('image/png'); } catch (_) { return null; }
}

// Deep-ish clone of the page list so edits don't mutate the parent's model.
const clonePages = (pages) => (pages || []).map((pg) => ({
  ...pg,
  print: { front: { ...pg.print.front }, back: { ...pg.print.back } },
  sides: {
    front: { ...pg.sides.front, pos: { ...pg.sides.front.pos } },
    back: { ...pg.sides.back, pos: { ...pg.sides.back.pos } },
  },
  _extra: { ...pg._extra },
}));

export default function MockupEditor({ token, mockup, item, onClose, onSaved }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [pages, setPages] = useState(() => clonePages(mockup.pages));
  const [pageIdx, setPageIdx] = useState(0);
  const [side, setSide] = useState('front');
  const [busy, setBusy] = useState('');
  const [nat, setNat] = useState({ blank: null, logo: null }); // natural dims of the loaded imgs
  const stageRef = useRef(null);
  const [scaleToFit, setScaleToFit] = useState(1);
  const dragRef = useRef(null);

  // Original page states — passed to mockupToLibraryItem so untracked legacy fields survive.
  const prevStates = useMemo(() => hydratePages(item), [item]);

  const page = pages[pageIdx] || pages[0];
  const sd = page.sides[side];
  const blankSrc = sd.blank || sd.composite || null;   // fall back to composite as the backdrop
  const logoSrc = sd.logo || null;

  // Load natural dims for the current blank + logo (drives the stage geometry).
  useEffect(() => {
    let live = true;
    (async () => {
      const [b, l] = await Promise.all([loadImg(blankSrc), loadImg(logoSrc)]);
      if (!live) return;
      setNat({
        blank: b ? { w: b.naturalWidth, h: b.naturalHeight } : null,
        logo: l ? { w: l.naturalWidth, h: l.naturalHeight } : null,
      });
    })();
    return () => { live = false; };
  }, [blankSrc, logoSrc]);

  // Fit the 620×500 stage into the responsive container.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => setScaleToFit(Math.max(0.2, el.clientWidth / STAGE_W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const box = nat.blank ? blankBox(nat.blank.w, nat.blank.h) : null;

  // Mutate the current side's placement (patch merged into pos).
  const patchPos = useCallback((patch) => {
    setPages((prev) => {
      const next = clonePages(prev);
      const s = next[pageIdx].sides[side];
      s.pos = { ...emptyPos(), ...s.pos, ...patch };
      return next;
    });
  }, [pageIdx, side]);

  const setSideField = useCallback((field, value) => {
    setPages((prev) => {
      const next = clonePages(prev);
      next[pageIdx].sides[side][field] = value;
      return next;
    });
  }, [pageIdx, side]);

  // Center the logo at a default size when it's first added / never placed.
  useEffect(() => {
    if (!box || !nat.logo || !logoSrc) return;
    if (sd.pos && sd.pos.x != null) return;              // already placed
    const targetW = box.dispW * 0.42;                    // ~42% of the blank width
    const w = targetW / nat.logo.w;                      // scaleX
    const dispW = nat.logo.w * w, dispH = nat.logo.h * w;
    patchPos({ x: box.originX + (box.dispW - dispW) / 2, y: box.originY + (box.dispH - dispH) / 2, w, h: w, angle: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, nat.logo, logoSrc, side, pageIdx]);

  // ── Pointer drag of the logo body (in stage coords) ──────────────────────────
  const onLogoPointerDown = (e) => {
    if (!box || !nat.logo || sd.pos.x == null) return;
    e.preventDefault();
    const rect = stageRef.current.getBoundingClientRect();
    const toStage = (cx, cy) => ({ x: (cx - rect.left) / scaleToFit, y: (cy - rect.top) / scaleToFit });
    const start = toStage(e.clientX, e.clientY);
    dragRef.current = { startX: start.x, startY: start.y, origX: sd.pos.x, origY: sd.pos.y };
    const move = (ev) => {
      const p = toStage(ev.clientX, ev.clientY);
      patchPos({ x: dragRef.current.origX + (p.x - dragRef.current.startX), y: dragRef.current.origY + (p.y - dragRef.current.startY) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Size slider: uniform scale keyed to the logo's width as a % of the blank width.
  const sizePct = (box && nat.logo && sd.pos.w != null) ? Math.round((nat.logo.w * sd.pos.w / box.dispW) * 100) : 42;
  const onSizePct = (pct) => {
    if (!box || !nat.logo) return;
    const targetW = box.dispW * (pct / 100);
    const w = targetW / nat.logo.w;
    // keep the logo centered on its current center as it scales
    const oldW = nat.logo.w * (sd.pos.w || w), oldH = nat.logo.h * (sd.pos.h || w);
    const cx = (sd.pos.x != null ? sd.pos.x : box.originX) + oldW / 2;
    const cy = (sd.pos.y != null ? sd.pos.y : box.originY) + oldH / 2;
    const newW = nat.logo.w * w, newH = nat.logo.h * w;
    patchPos({ w, h: w, x: cx - newW / 2, y: cy - newH / 2 });
  };

  const onUpload = (field) => async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = await fileToDataUrl(f);
    if (url) {
      setSideField(field, url);
      if (field === 'logo') setSideField('composite', null); // force a re-flatten
    }
    e.target.value = '';
  };

  const save = async () => {
    setBusy('Saving…');
    try {
      const flat = clonePages(pages);
      for (let i = 0; i < flat.length; i++) {
        for (const s of ['front', 'back']) {
          const p = flat[i].sides[s];
          if (p.blank && p.logo && p.pos && p.pos.x != null) {
            const comp = await flattenSide(p.blank, p.logo, p.pos);
            if (comp) flat[i].sides[s] = { ...p, composite: comp };
          }
        }
      }
      const model = { ...mockup, pages: flat };
      const body = mockupToLibraryItem(model, prevStates);
      // Keep the existing identity: same remoteId + mockup number → saves in place,
      // no server letter assignment, no anti-clobber fork. Backlog-safe.
      await axios.post(`${base}/studio/library/mockups`, body, authHdr);
      setBusy('Saved ✓');
      if (onSaved) onSaved();
    } catch (err) {
      setBusy(err.response?.data?.message || err.message);
    }
  };

  useEffect(() => {
    if (!busy || String(busy).endsWith('…')) return undefined;
    const t = setTimeout(() => setBusy(''), 4000); return () => clearTimeout(t);
  }, [busy]);

  const stageDisplayH = STAGE_H * scaleToFit;
  const placed = sd.pos && sd.pos.x != null && !!logoSrc && !!nat.logo;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 1.5, md: 2 }, py: 2, ...scrollbar }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <IconButton onClick={onClose} size="small" sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Edit placement — {mockup.name || 'Untitled'}
            {mockup.mockupNum && <Box component="span" sx={{ ...mono, color: D.faint, fontSize: 12, fontWeight: 600, ml: 1 }}>#{mockup.mockupNum}</Box>}
          </Typography>
        </Box>
        <Button onClick={save} disabled={busy.endsWith('…')} startIcon={busy.endsWith('…') ? <CircularProgress size={13} sx={{ color: '#08130c' }} /> : <CheckIcon sx={{ fontSize: 16 }} />}
          sx={{ bgcolor: D.green, color: '#08130c', textTransform: 'none', fontWeight: 800, px: 2, borderRadius: 999, '&:hover': { bgcolor: '#3bd070' }, '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.3)' } }}>
          Save
        </Button>
      </Stack>
      {busy && <Typography sx={{ color: busy.includes('✓') ? D.green : '#fbbf24', fontSize: 12, mb: 1 }}>{busy}</Typography>}

      {/* Page tabs */}
      {pages.length > 1 && (
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1 }}>
          {pages.map((_, i) => (
            <Button key={i} onClick={() => setPageIdx(i)} size="small"
              sx={{ minWidth: 0, px: 1.5, fontWeight: 800, fontSize: 12, borderRadius: 1.5,
                color: i === pageIdx ? D.green : D.muted, bgcolor: i === pageIdx ? 'rgba(74,222,128,0.10)' : 'transparent',
                border: `1px solid ${i === pageIdx ? 'rgba(74,222,128,0.4)' : D.line}` }}>Page {i + 1}</Button>
          ))}
        </Stack>
      )}

      {/* The stage */}
      <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3, p: { xs: 1.25, md: 2 } }}>
        <Box ref={stageRef} sx={{ position: 'relative', width: '100%', height: stageDisplayH, bgcolor: '#fff', borderRadius: 2, overflow: 'hidden', touchAction: 'none' }}>
          {/* scaled 620×500 stage */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: STAGE_W, height: STAGE_H, transform: `scale(${scaleToFit})`, transformOrigin: 'top left' }}>
            {box && blankSrc ? (
              <Box component="img" src={blankSrc} alt="blank" crossOrigin="anonymous" draggable={false}
                sx={{ position: 'absolute', left: box.originX, top: box.originY, width: box.dispW, height: box.dispH, userSelect: 'none' }} />
            ) : (
              <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, color: '#b8c2bc' }}>
                <Typography sx={{ fontSize: 13 }}>Upload a garment blank to start</Typography>
              </Stack>
            )}
            {box && placed && (
              <Box onPointerDown={onLogoPointerDown}
                sx={{ position: 'absolute', left: sd.pos.x, top: sd.pos.y,
                  width: nat.logo.w * sd.pos.w, height: nat.logo.h * sd.pos.h,
                  transform: `rotate(${sd.pos.angle || 0}deg)`, transformOrigin: 'center center',
                  cursor: 'move', outline: '1.5px dashed rgba(74,222,128,0.9)', outlineOffset: 2 }}>
                <Box component="img" src={logoSrc} alt="logo" crossOrigin="anonymous" draggable={false}
                  sx={{ width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none' }} />
              </Box>
            )}
          </Box>
        </Box>

        {/* Front / back */}
        <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 1.5 }}>
          {['front', 'back'].map((s) => {
            const on = s === side;
            return (
              <Button key={s} onClick={() => setSide(s)} size="small"
                sx={{ textTransform: 'capitalize', fontWeight: 800, fontSize: 12, px: 1.75,
                  color: on ? '#08130c' : D.text, bgcolor: on ? D.green : 'transparent',
                  border: `1px solid ${on ? D.green : D.line}`, borderRadius: 999, '&:hover': { bgcolor: on ? D.green : D.panelHi } }}>{s}</Button>
            );
          })}
        </Stack>
      </Box>

      {/* Controls */}
      <Box sx={{ mt: 1.5, bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3, p: 2 }}>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: placed ? 1.5 : 0 }}>
          <Button component="label" size="small" startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 12, border: `1px dashed ${D.line}`, borderRadius: 1.5, '&:hover': { color: D.green, borderColor: D.green } }}>
            {logoSrc ? 'Replace logo' : 'Upload logo'}
            <input type="file" hidden accept="image/*" onChange={onUpload('logo')} />
          </Button>
          <Button component="label" size="small" startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 12, border: `1px dashed ${D.line}`, borderRadius: 1.5, '&:hover': { color: D.green, borderColor: D.green } }}>
            {sd.blank ? 'Replace blank' : 'Upload blank'}
            <input type="file" hidden accept="image/*" onChange={onUpload('blank')} />
          </Button>
        </Stack>

        {placed && (
          <Stack gap={1.25}>
            <Box>
              <Typography sx={{ color: D.faint, fontSize: 11, fontWeight: 700, mb: 0.25 }}>Size — {sizePct}% of the garment width</Typography>
              <Slider size="small" min={5} max={100} value={sizePct} onChange={(_, v) => onSizePct(v)}
                sx={{ color: D.green, '& .MuiSlider-thumb': { width: 14, height: 14 } }} />
            </Box>
            <Box>
              <Typography sx={{ color: D.faint, fontSize: 11, fontWeight: 700, mb: 0.25 }}>
                <RotateRightIcon sx={{ fontSize: 13, verticalAlign: 'text-bottom', mr: 0.4 }} />Rotation — {Math.round(sd.pos.angle || 0)}°
              </Typography>
              <Slider size="small" min={-180} max={180} value={Math.round(sd.pos.angle || 0)} onChange={(_, v) => patchPos({ angle: v })}
                sx={{ color: D.green, '& .MuiSlider-thumb': { width: 14, height: 14 } }} />
            </Box>
            <Stack direction="row" gap={0.75} alignItems="center">
              <Typography sx={{ color: D.faint, fontSize: 11, fontWeight: 700, mr: 0.5 }}>Nudge</Typography>
              {[['←', -1, 0], ['→', 1, 0], ['↑', 0, -1], ['↓', 0, 1]].map(([lbl, dx, dy]) => (
                <Button key={lbl} onClick={() => patchPos({ x: sd.pos.x + dx * 4, y: sd.pos.y + dy * 4 })} size="small"
                  sx={{ minWidth: 32, color: D.text, border: `1px solid ${D.line}`, borderRadius: 1.5, fontSize: 14, fontWeight: 800, '&:hover': { borderColor: D.green, color: D.green } }}>{lbl}</Button>
              ))}
            </Stack>
          </Stack>
        )}
        {!placed && logoSrc && (
          <Typography sx={{ color: D.faint, fontSize: 12, mt: 1 }}>Loading the logo…</Typography>
        )}
        {!logoSrc && (
          <Typography sx={{ color: D.faint, fontSize: 12, mt: 1 }}>
            This side has no separable logo (synced mockups keep only the flattened image). Upload the logo art to place it, then Save.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
