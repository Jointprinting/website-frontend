// src/screens/studio/MockupEditor.js
//
// The React mockup MAKER — v1 of moving the editor out of the standalone /jpstudio
// app. A focused compositor: drop in a blank, drop a logo, drag + scale it, and
// save a flattened mockup straight into the library (linked to a client + project
// so it's connected in the CRM/order ecosystem). Built in React so every change is
// build- + Vercel-verified. Parity features (S&S blank search, back side, color
// variants, library-pick) layer on next; until then the full /jpstudio editor stays
// one click away from the library.
//
// Editing is DOM-based (the logo is an absolutely-positioned <img> over the blank)
// for robust drag/scale; only the SAVE flattens to a canvas at the blank's native
// resolution. Both images are uploaded data-URLs (same-origin), so the canvas is
// never tainted and toDataURL works.

import React, { useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, Button, TextField, Slider, CircularProgress,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import CheckIcon from '@mui/icons-material/Check';
import axios from 'axios';
import config from '../../config.json';
import { D, mono } from './_shared';

const base = `${config.backendUrl}/api/studio`;
const onlyDigits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');

const readFileAsDataURL = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(new Error('Could not read that file.'));
  r.readAsDataURL(file);
});
const loadImg = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error('Could not load image.'));
  i.src = src;
});

// A labeled upload tile that previews the chosen image.
function UploadTile({ label, img, onPick }) {
  const id = `mk-upload-${label.toLowerCase()}`;
  return (
    <Box>
      <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.5 }}>{label}</Typography>
      <Box component="label" htmlFor={id} sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
        height: 64, borderRadius: 2, cursor: 'pointer', overflow: 'hidden',
        border: `1px dashed ${img ? D.lineHi : D.line}`, bgcolor: D.inset,
        '&:hover': { borderColor: D.green },
      }}>
        {img ? (
          <Box component="img" src={img.src} alt={label} sx={{ height: '100%', maxWidth: '70%', objectFit: 'contain' }} />
        ) : (
          <><AddPhotoAlternateOutlinedIcon sx={{ fontSize: 20, color: D.faint }} />
            <Typography sx={{ color: D.muted, fontSize: 12.5 }}>Upload {label.toLowerCase()}</Typography></>
        )}
      </Box>
      <input id={id} type="file" accept="image/*" hidden onChange={onPick} />
    </Box>
  );
}

export default function MockupEditor({ token, onClose, onSaved }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [blank, setBlank] = useState(null);          // { src, w, h }
  const [logo, setLogo] = useState(null);            // { src, w, h }
  const [pos, setPos] = useState({ cx: 0.5, cy: 0.42 }); // logo CENTER as fraction of the blank
  const [scale, setScale] = useState(0.32);          // logo width as fraction of the blank width
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [projectNo, setProjectNo] = useState('');
  const [mockupNum, setMockupNum] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const stageRef = useRef(null);
  const draggingRef = useRef(false);

  const pick = (setter) => async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const src = await readFileAsDataURL(f);
      const img = await loadImg(src);
      setter({ src, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      setErr('');
    } catch (e2) { setErr(e2.message); }
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* not all browsers */ }
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const cy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    setPos({ cx, cy });
  };
  const onPointerUp = (e) => {
    draggingRef.current = false;
    try { e.target.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
  };

  const save = async () => {
    if (!blank) { setErr('Add a blank first.'); return; }
    setSaving(true); setErr('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = blank.w; canvas.height = blank.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(await loadImg(blank.src), 0, 0, blank.w, blank.h);
      if (logo) {
        const lImg = await loadImg(logo.src);
        const lw = blank.w * scale;
        const lh = lw * (logo.h / logo.w);
        ctx.drawImage(lImg, pos.cx * blank.w - lw / 2, pos.cy * blank.h - lh / 2, lw, lh);
      }
      const composite = canvas.toDataURL('image/png');
      await axios.post(`${base}/library/mockups`, {
        name: name.trim() || 'Untitled mockup',
        client: client.trim(),
        thumbnail: composite,
        data: '',
        pageState: { mockupNum: mockupNum.trim(), projectNumber: onlyDigits(projectNo) },
        savedAt: Date.now(),
      }, authHdr);
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 1.5, md: 0 }, py: 1 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={onClose} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18, flex: 1 }}>New mockup</Typography>
        <Button onClick={save} disabled={saving || !blank}
          startIcon={saving ? <CircularProgress size={15} sx={{ color: D.ink }} /> : <CheckIcon sx={{ fontSize: 18 }} />}
          sx={{ bgcolor: D.green, color: D.ink, textTransform: 'none', fontWeight: 800, borderRadius: 999, px: 2.25,
            '&:hover': { bgcolor: '#5cec8e' }, '&.Mui-disabled': { bgcolor: D.line, color: D.faint } }}>
          Save to library
        </Button>
      </Stack>

      {err && <Typography sx={{ color: '#fbbf24', fontSize: 12.5, mb: 1.5 }}>{err}</Typography>}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' } }}>
        {/* Stage */}
        <Box sx={{
          bgcolor: D.inset, border: `1px solid ${D.line}`, borderRadius: 2.5,
          minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
        }}>
          {!blank ? (
            <Stack alignItems="center" gap={1} sx={{ py: 6, color: D.faint }}>
              <ImageOutlinedIcon sx={{ fontSize: 40 }} />
              <Typography sx={{ fontSize: 13 }}>Upload a blank to start →</Typography>
            </Stack>
          ) : (
            <Box
              ref={stageRef}
              sx={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: `${blank.w} / ${blank.h}`,
                mx: 'auto', userSelect: 'none', touchAction: 'none' }}
            >
              <Box component="img" src={blank.src} alt="blank" draggable={false}
                sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
              {logo && (
                <Box component="img" src={logo.src} alt="logo" draggable={false}
                  onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                  sx={{ position: 'absolute', left: `${pos.cx * 100}%`, top: `${pos.cy * 100}%`,
                    width: `${scale * 100}%`, transform: 'translate(-50%, -50%)',
                    cursor: 'grab', touchAction: 'none', '&:active': { cursor: 'grabbing' },
                    outline: `1px dashed ${D.green}88`, outlineOffset: 2 }} />
              )}
            </Box>
          )}
        </Box>

        {/* Controls */}
        <Stack gap={1.75}>
          <UploadTile label="Blank" img={blank} onPick={pick(setBlank)} />
          <UploadTile label="Logo" img={logo} onPick={pick(setLogo)} />
          {logo && (
            <Box>
              <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.25 }}>
                Logo size · drag it on the blank to position
              </Typography>
              <Slider value={scale} min={0.05} max={0.9} step={0.01} onChange={(_e, v) => setScale(v)}
                sx={{ color: D.green, '& .MuiSlider-thumb': { width: 14, height: 14 } }} />
            </Box>
          )}
          <Box sx={{ height: 1, bgcolor: D.line, my: 0.25 }} />
          {[
            { label: 'Name', value: name, set: setName, ph: 'e.g. Front left chest — navy tee' },
            { label: 'Client', value: client, set: setClient, ph: 'Company name' },
            { label: 'Project #', value: projectNo, set: setProjectNo, ph: 'Links this mockup to an order' },
            { label: 'Mockup #', value: mockupNum, set: setMockupNum, ph: 'Optional' },
          ].map((f) => (
            <Box key={f.label}>
              <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.5 }}>{f.label}</Typography>
              <TextField value={f.value} onChange={(e) => f.set(e.target.value)} size="small" fullWidth placeholder={f.ph}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: D.inset, color: D.text, fontSize: 13,
                  '& fieldset': { borderColor: D.line }, '&:hover fieldset': { borderColor: D.lineHi } },
                  '& input': { ...(f.label.includes('#') ? mono : {}) } }} />
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
