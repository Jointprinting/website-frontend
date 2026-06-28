// src/screens/studio/MockupEditor.js
//
// The React mockup MAKER — v2. A focused compositor: drop in a blank, drop a
// logo, drag + scale it, and save a flattened mockup straight into the library
// (linked to a client + project so it's connected in the CRM/order ecosystem).
// Built in React so every change is build- + Vercel-verified.
//
// v2 adds the "remember" parity pieces:
//   • LIBRARY PICK — choose a blank or logo from everything you've saved before,
//     instead of re-uploading it every time.
//   • BACK SIDE — compose a front AND a back; front is the library thumbnail,
//     back rides in `data` (the same shape the confirmation/lookbook PDFs read).
// Still to layer on: S&S blank search, garment-color variants, auto mockup #.
//
// Editing is DOM-based (the logo is an absolutely-positioned <img> over the
// blank) for robust drag/scale; only SAVE flattens each side to a canvas at the
// blank's native resolution. Images are same-origin data-URLs / R2 URLs, so the
// canvas isn't tainted and toDataURL works.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, Button, TextField, Slider, CircularProgress,
  Dialog, DialogContent, Autocomplete,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import config from '../../config.json';
import { D, mono, scrollbar } from './_shared';

const base = `${config.backendUrl}/api/studio`;
const ordersBase = `${config.backendUrl}/api/orders`;
const onlyDigits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
const DEFAULT_SIDE = () => ({ blank: null, logo: null, pos: { cx: 0.5, cy: 0.42 }, scale: 0.32 });
// MUST match the company-key convention used everywhere else (lowercased alphanumerics).
const deriveCompanyKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// The next free mockup letter for a project, mirroring the backend's project-
// scoped lettering (132 → 132A, 132B, … 132Z, 132AA). A suggestion only — the
// owner can override, and the real claim still happens server-side.
const idxToLetters = (i) => {
  let s = ''; let n = i + 1;
  while (n > 0) { n -= 1; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
};
const nextMockupLetter = (projectNumber, mockupNumbers) => {
  const proj = onlyDigits(projectNumber);
  if (!proj) return '';
  const used = new Set((mockupNumbers || []).map((m) => String(m).toUpperCase().trim()));
  for (let i = 0; i < 260; i += 1) {
    const cand = `${proj}${idxToLetters(i)}`;
    if (!used.has(cand.toUpperCase())) return cand;
  }
  return '';
};

const readFileAsDataURL = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(new Error('Could not read that file.'));
  r.readAsDataURL(file);
});
const loadImg = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.crossOrigin = 'anonymous';   // R2 URLs are CORS-enabled; keeps the canvas untainted
  i.onload = () => res(i);
  i.onerror = () => rej(new Error('Could not load image.'));
  i.src = src;
});
// blanks/logos store the image in `data` (base64 or an R2 URL); `thumbnail` is a
// lighter preview. Use the preview to show, the full image to compose.
const itemPreview = (it) => it.thumbnail || it.data || '';
const itemImage = (it) => it.data || it.thumbnail || '';

// A labeled tile: upload a file, OR pick one from the saved library.
function SourceTile({ label, img, onPick, onOpenLibrary }) {
  const id = `mk-upload-${label.toLowerCase()}`;
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Typography>
        <Button onClick={onOpenLibrary} startIcon={<CollectionsOutlinedIcon sx={{ fontSize: 14 }} />} size="small"
          sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11, minWidth: 0, p: 0.25,
            '&:hover': { bgcolor: 'rgba(74,222,128,0.08)' } }}>
          Library
        </Button>
      </Stack>
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

// A modal grid of everything saved in one library store (blanks or logos).
function LibraryPicker({ open, store, token, onPick, onClose }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !store) return;
    let cancelled = false;
    setLoading(true); setErr('');
    // Full docs (not ?summary=1): the picker needs the actual image in `data`,
    // which summary strips for inline-base64 items.
    axios.get(`${base}/library/${store}`, authHdr)
      .then((r) => { if (!cancelled) setItems(Array.isArray(r.data) ? r.data : []); })
      .catch((e) => { if (!cancelled) setErr(e.response?.data?.message || e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, store, authHdr]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${D.line}` }}>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15, flex: 1, textTransform: 'capitalize' }}>
          Pick a saved {store === 'blanks' ? 'blank' : 'logo'}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: D.muted, '&:hover': { color: D.text } }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </Stack>
      <DialogContent sx={{ p: 2, ...scrollbar }}>
        {err && <Typography sx={{ color: D.amber, fontSize: 12.5, mb: 1 }}>{err}</Typography>}
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: D.green }} /></Box>
        ) : items.length === 0 ? (
          <Typography sx={{ color: D.faint, fontSize: 13, textAlign: 'center', py: 6 }}>
            Nothing saved here yet — upload one and it’ll be here next time.
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
            {items.map((it) => (
              <Box key={it._id || it.remoteId} onClick={() => onPick(it)} title={it.name || ''}
                sx={{ borderRadius: 2, overflow: 'hidden', cursor: 'pointer', bgcolor: D.inset,
                  border: `1px solid ${D.line}`, aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color 0.12s ease, transform 0.12s ease',
                  '&:hover': { borderColor: D.green, transform: 'translateY(-2px)' } }}>
                {itemPreview(it)
                  ? <Box component="img" src={itemPreview(it)} alt={it.name || store} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.75 }} />
                  : <ImageOutlinedIcon sx={{ fontSize: 24, color: D.faint }} />}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

// A small segmented Front | Back switch. The back chip carries a dot once it has
// a blank, so you can tell at a glance that a back exists.
function SideSwitch({ side, onSide, hasBack }) {
  const Item = ({ id, label, dot }) => (
    <Box onClick={() => onSide(id)} role="button"
      sx={{ px: 1.75, py: 0.6, borderRadius: 999, cursor: 'pointer', userSelect: 'none', fontSize: 12.5, fontWeight: 800,
        display: 'flex', alignItems: 'center', gap: 0.6,
        bgcolor: side === id ? D.green : 'transparent', color: side === id ? D.ink : D.muted,
        transition: 'all 0.12s ease', '&:hover': side === id ? {} : { color: D.text } }}>
      {label}
      {dot && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: side === id ? D.ink : D.green }} />}
    </Box>
  );
  return (
    <Stack direction="row" sx={{ display: 'inline-flex', p: 0.4, borderRadius: 999, border: `1px solid ${D.line}`, bgcolor: D.inset }}>
      <Item id="front" label="Front" />
      <Item id="back" label="Back" dot={hasBack} />
    </Stack>
  );
}

export default function MockupEditor({ token, onClose, onSaved }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [side, setSide] = useState('front');
  const [sides, setSides] = useState({ front: DEFAULT_SIDE(), back: DEFAULT_SIDE() });
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [projectNo, setProjectNo] = useState('');
  const [mockupNum, setMockupNum] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [picker, setPicker] = useState({ open: false, store: null, slot: null });   // slot: 'blank' | 'logo'
  const [projects, setProjects] = useState([]);
  const stageRef = useRef(null);
  const draggingRef = useRef(false);

  const cur = sides[side];
  const setCur = (patch) => setSides((s) => ({ ...s, [side]: { ...s[side], ...patch } }));

  // The maker's connective tissue: every saved order powers the Client + Project
  // pickers, so a mockup is born referencing a REAL company + project — it then
  // deep-links both ways from the library (→ CRM card, → order). Free text still
  // works for a brand-new client you're quoting before there's an order.
  useEffect(() => {
    let cancelled = false;
    axios.get(`${ordersBase}/projects`, authHdr)
      .then((r) => { if (!cancelled) setProjects(Array.isArray(r.data && r.data.projects) ? r.data.projects : []); })
      .catch(() => { /* free-text fallback — the pickers just have no options */ });
    return () => { cancelled = true; };
  }, [authHdr]);

  const companyOptions = useMemo(() => {
    const m = new Map();
    projects.forEach((o) => {
      const nm = (o.companyName || o.clientName || '').trim();
      if (!nm) return;
      const key = o.companyKey || deriveCompanyKey(nm);
      if (!m.has(key)) m.set(key, nm);
    });
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const clientKey = deriveCompanyKey(client);
  const projectOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    projects.forEach((o) => {
      const pk = (o.projectNumber || '').trim();
      if (!pk || seen.has(pk)) return;
      const key = o.companyKey || deriveCompanyKey(o.companyName || o.clientName);
      if (clientKey && key !== clientKey) return;   // scope to the chosen client
      seen.add(pk); out.push(pk);
    });
    return out;
  }, [projects, clientKey]);

  // Choosing a real project prefills its client (when blank) and suggests the
  // next mockup letter from that order's existing mockups — connected by default.
  const onProjectChosen = (value) => {
    const v = (value || '').trim();
    setProjectNo(v);
    const ord = projects.find((o) => (o.projectNumber || '').trim() === v);
    if (!ord) return;
    if (!client.trim() && (ord.companyName || ord.clientName)) setClient((ord.companyName || ord.clientName).trim());
    if (!mockupNum.trim()) {
      const suggested = nextMockupLetter(ord.projectNumber, ord.mockupNumbers);
      if (suggested) setMockupNum(suggested);
    }
  };

  // Upload a file into the current side's blank or logo slot.
  const pickFile = (slot) => async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const src = await readFileAsDataURL(f);
      const img = await loadImg(src);
      setCur({ [slot]: { src, w: img.naturalWidth || 1, h: img.naturalHeight || 1 } });
      setErr('');
    } catch (e2) { setErr(e2.message); }
  };

  // Pick a saved library item into the current side's blank or logo slot.
  const pickFromLibrary = async (it) => {
    const src = itemImage(it);
    const { slot } = picker;
    setPicker({ open: false, store: null, slot: null });
    if (!src || !slot) return;
    try {
      const img = await loadImg(src);
      setCur({ [slot]: { src, w: img.naturalWidth || 1, h: img.naturalHeight || 1 } });
      setErr('');
      if (slot === 'blank' && !name.trim() && it.name) setName(it.name);
    } catch (e2) { setErr(e2.message); }
  };
  const openLibrary = (slot) => setPicker({ open: true, store: slot === 'blank' ? 'blanks' : 'logos', slot });

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
    setCur({ pos: { cx, cy } });
  };
  const onPointerUp = (e) => {
    draggingRef.current = false;
    try { e.target.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
  };

  // Flatten one side to a PNG data-URL at the blank's native resolution. Returns
  // null when the side has no blank.
  const compositeSide = async (s) => {
    if (!s.blank) return null;
    const canvas = document.createElement('canvas');
    canvas.width = s.blank.w; canvas.height = s.blank.h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(await loadImg(s.blank.src), 0, 0, s.blank.w, s.blank.h);
    if (s.logo) {
      const lImg = await loadImg(s.logo.src);
      const lw = s.blank.w * s.scale;
      const lh = lw * (s.logo.h / s.logo.w);
      ctx.drawImage(lImg, s.pos.cx * s.blank.w - lw / 2, s.pos.cy * s.blank.h - lh / 2, lw, lh);
    }
    return canvas.toDataURL('image/png');
  };

  const save = async () => {
    if (!sides.front.blank) { setErr('Add a front blank first.'); setSide('front'); return; }
    setSaving(true); setErr('');
    try {
      const front = await compositeSide(sides.front);
      const back = await compositeSide(sides.back);   // null when no back blank
      await axios.post(`${base}/library/mockups`, {
        name: name.trim() || 'Untitled mockup',
        client: client.trim(),
        thumbnail: front,
        data: back || '',
        pageState: { mockupNum: mockupNum.trim(), projectNumber: onlyDigits(projectNo) },
        savedAt: Date.now(),
      }, authHdr);
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    } finally { setSaving(false); }
  };

  const hasBack = !!sides.back.blank;

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 1.5, md: 0 }, py: 1 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={onClose} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18, flex: 1 }}>New mockup</Typography>
        <Button onClick={save} disabled={saving || !sides.front.blank}
          startIcon={saving ? <CircularProgress size={15} sx={{ color: D.ink }} /> : <CheckIcon sx={{ fontSize: 18 }} />}
          sx={{ bgcolor: D.green, color: D.ink, textTransform: 'none', fontWeight: 800, borderRadius: 999, px: 2.25,
            '&:hover': { bgcolor: '#5cec8e' }, '&.Mui-disabled': { bgcolor: D.line, color: D.faint } }}>
          Save to library
        </Button>
      </Stack>

      {err && <Typography sx={{ color: '#fbbf24', fontSize: 12.5, mb: 1.5 }}>{err}</Typography>}

      <Box sx={{ mb: 1.5 }}>
        <SideSwitch side={side} onSide={setSide} hasBack={hasBack} />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' } }}>
        {/* Stage */}
        <Box sx={{
          bgcolor: D.inset, border: `1px solid ${D.line}`, borderRadius: 2.5,
          minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
        }}>
          {!cur.blank ? (
            <Stack alignItems="center" gap={1} sx={{ py: 6, color: D.faint }}>
              <ImageOutlinedIcon sx={{ fontSize: 40 }} />
              <Typography sx={{ fontSize: 13 }}>
                {side === 'back' ? 'Add a back blank (optional) →' : 'Add a blank to start →'}
              </Typography>
            </Stack>
          ) : (
            <Box
              ref={stageRef}
              sx={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: `${cur.blank.w} / ${cur.blank.h}`,
                mx: 'auto', userSelect: 'none', touchAction: 'none' }}
            >
              <Box component="img" src={cur.blank.src} alt="blank" draggable={false}
                sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
              {cur.logo && (
                <Box component="img" src={cur.logo.src} alt="logo" draggable={false}
                  onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                  sx={{ position: 'absolute', left: `${cur.pos.cx * 100}%`, top: `${cur.pos.cy * 100}%`,
                    width: `${cur.scale * 100}%`, transform: 'translate(-50%, -50%)',
                    cursor: 'grab', touchAction: 'none', '&:active': { cursor: 'grabbing' },
                    outline: `1px dashed ${D.green}88`, outlineOffset: 2 }} />
              )}
            </Box>
          )}
        </Box>

        {/* Controls */}
        <Stack gap={1.75}>
          <SourceTile label="Blank" img={cur.blank} onPick={pickFile('blank')} onOpenLibrary={() => openLibrary('blank')} />
          <SourceTile label="Logo" img={cur.logo} onPick={pickFile('logo')} onOpenLibrary={() => openLibrary('logo')} />
          {cur.logo && (
            <Box>
              <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.25 }}>
                Logo size · drag it on the blank to position
              </Typography>
              <Slider value={cur.scale} min={0.05} max={0.9} step={0.01} onChange={(_e, v) => setCur({ scale: v })}
                sx={{ color: D.green, '& .MuiSlider-thumb': { width: 14, height: 14 } }} />
            </Box>
          )}
          <Box sx={{ height: 1, bgcolor: D.line, my: 0.25 }} />
          {(() => {
            const lbl = { color: D.faint, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.5 };
            const inputSx = (isMono) => ({
              '& .MuiOutlinedInput-root': { bgcolor: D.inset, color: D.text, fontSize: 13,
                '& fieldset': { borderColor: D.line }, '&:hover fieldset': { borderColor: D.lineHi } },
              '& input': { ...(isMono ? mono : {}) },
              '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': { color: D.faint },
            });
            const acPaper = { paper: { sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`,
              '& .MuiAutocomplete-option': { fontSize: 13 }, '& .MuiAutocomplete-noOptions': { color: D.faint, fontSize: 12.5 } } } };
            return (
              <>
                <Box>
                  <Typography sx={lbl}>Name</Typography>
                  <TextField value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth
                    placeholder="e.g. Front left chest — navy tee" sx={inputSx(false)} />
                </Box>
                <Box>
                  <Typography sx={lbl}>Client</Typography>
                  <Autocomplete freeSolo autoHighlight options={companyOptions} inputValue={client}
                    onInputChange={(_e, v) => setClient(v)} componentsProps={acPaper}
                    renderInput={(p) => <TextField {...p} size="small" placeholder="Search your companies…" sx={inputSx(false)} />} />
                </Box>
                <Box>
                  <Typography sx={lbl}>Project #</Typography>
                  <Autocomplete freeSolo autoHighlight options={projectOptions} inputValue={projectNo}
                    onInputChange={(_e, v) => setProjectNo(v)} onChange={(_e, v) => onProjectChosen(v || '')}
                    componentsProps={acPaper}
                    renderInput={(p) => <TextField {...p} size="small" placeholder="Links this mockup to an order" sx={inputSx(true)} />} />
                </Box>
                <Box>
                  <Typography sx={lbl}>Mockup #</Typography>
                  <TextField value={mockupNum} onChange={(e) => setMockupNum(e.target.value)} size="small" fullWidth
                    placeholder="Auto-suggested from the project" sx={inputSx(true)} />
                </Box>
              </>
            );
          })()}
        </Stack>
      </Box>

      <LibraryPicker
        open={picker.open} store={picker.store} token={token}
        onPick={pickFromLibrary} onClose={() => setPicker({ open: false, store: null, slot: null })}
      />
    </Box>
  );
}
