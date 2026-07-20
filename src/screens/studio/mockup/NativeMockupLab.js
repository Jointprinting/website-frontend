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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, Button, TextField, MenuItem, CircularProgress, Divider, Autocomplete,
  Dialog, DialogTitle, DialogContent, Checkbox, Tooltip,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
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
import { emptyPage, hydratePages, mockupToLibraryItem, pageToState, pageFromState } from './mockupModel';
import { PRESETS, PRESET_ORDER, PRINT_AREAS, CATEGORY_ORDER, printAreaRect } from './printAreas';
import { exportMockupPdf } from './mockupPdf';
import { analyzeArtwork, isScreenPrintType, INK } from './inkDetect';
import { detectSolidBg, removeBackground, recolorInk, fnvHash } from './artTools';
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
  // The linked project — state (not just props) so the typeahead can pick or
  // switch it, exactly like the classic lab's required Project field. Save is
  // gated on it: a mockup must belong to a project to letter-in and be findable.
  const [proj, setProj] = useState(() => ({
    id: (project && project.id) || (item && item.pageState && item.pageState.projectId) || '',
    projectNumber: (mockup && mockup.projectNumber) || (project && project.projectNumber) || '',
    label: '',
  }));
  const orderId = proj.id;
  const projectNumber = proj.projectNumber;
  const prevStates = useMemo(() => (isNew ? [] : hydratePages(item)), [item, isNew]);
  const canvasRef = useRef(null);

  // Project list for the typeahead — same endpoint + label the classic lab uses
  // ("#133 · Bleu Leaf"). Loaded once; resolves the current id to its label.
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data } = await axios.get(`${base}/orders/projects`, authHdr);
        if (!live) return;
        const list = (data.projects || []).map((p) => ({
          id: p._id,
          projectNumber: p.projectNumber != null ? String(p.projectNumber) : '',
          client: p.clientName || p.companyName || '',
          company: p.companyName || p.clientName || 'Untitled',
          label: `#${p.projectNumber || '?'} · ${p.companyName || p.clientName || 'Untitled'}`,
        }));
        setProjects(list);
        setProj((prev) => {
          const hit = prev.id && list.find((p) => p.id === prev.id);
          return hit ? { ...prev, projectNumber: hit.projectNumber || prev.projectNumber, label: hit.label } : prev;
        });
      } catch (_) { /* best-effort — typing still works, save gate still guards */ }
    })();
    return () => { live = false; };
  }, [authHdr]);

  const pickProject = (p) => {
    if (!p) { setProj({ id: '', projectNumber: '', label: '' }); return; }
    setProj({ id: p.id, projectNumber: p.projectNumber, label: p.label });
    // Auto-fills, classic-style: client always follows the project; title
    // "<Company> Merch" only when empty or still the previous auto value.
    setMeta((m) => {
      const autoTitle = `${p.company} Merch`;
      const prevAuto = m._autoTitle && m.title === m._autoTitle;
      return {
        ...m,
        client: p.client || m.client,
        title: (!m.title || prevAuto) ? autoTitle : m.title,
        _autoTitle: autoTitle,
      };
    });
  };

  const page = pages[pageIdx] || pages[0];
  const sd = page.sides[side];

  const patchSide = useCallback((patch) => {
    setPages((prev) => { const n = clonePages(prev); Object.assign(n[pageIdx].sides[side], patch); return n; });
  }, [pageIdx, side]);

  // The blank's natural dims → its box in the 620×500 stage → the printable
  // area (in stage px + ppi) for the page's product category. One ratio powers
  // the guide box, the clamps, the inch presets, and the smart Dimensions.
  const [natBlank, setNatBlank] = useState(null);
  const blankSrcCur = sd.blank || sd.composite || null;
  useEffect(() => {
    let live = true;
    (async () => {
      const img = await loadImg(blankSrcCur);
      if (live) setNatBlank(img ? { w: img.naturalWidth, h: img.naturalHeight } : null);
    })();
    return () => { live = false; };
  }, [blankSrcCur]);
  const area = useMemo(() => {
    if (!natBlank) return null;
    return printAreaRect(page.category || 'generic', side, blankBox(natBlank.w, natBlank.h));
  }, [natBlank, page.category, side]);

  // Smart Dimensions — placement → real inches, auto-written into the print
  // spec ("4.00\"w × 2.72\"h — 3.00\" below collar") unless hand-edited.
  const autoDimsRef = useRef({});
  const [inchInfo, setInchInfo] = useState(null);
  // Dims ⇄ logo size link. Linked (default): typing a size resizes the logo and
  // placing the logo rewrites the text. Unlocked: the two move independently
  // (edge cases — e.g. spec'ing a size the photo can't show). Per Nate's spec.
  const [dimsLinked, setDimsLinked] = useState(true);
  const dimsLinkedRef = useRef(true);
  dimsLinkedRef.current = dimsLinked;
  const [dimsDraft, setDimsDraft] = useState(null);   // non-null while the field is focused
  const applyDimsText = (text) => {
    setPrint('dims', text);
    if (!dimsLinkedRef.current || !area || !area.ppi) return;
    const m = /([\d.]+)/.exec(String(text));           // first number = target width in inches
    const wIn = m ? parseFloat(m[1]) : NaN;
    if (Number.isFinite(wIn) && wIn > 0 && canvasRef.current) {
      canvasRef.current.setSizeInches(Math.min(wIn, area.maxWIn));
    }
  };
  const setPos = useCallback((pos, geom) => {
    // Inches computed OUTSIDE the state updater (updaters must stay pure).
    let dims = null;
    if (geom && geom.logo && geom.blank && area && area.ppi) {
      const wIn = geom.logo.width / area.ppi;
      const hIn = geom.logo.height / area.ppi;
      const belowIn = Math.max(0, (pos.y - area.top) / area.ppi);
      dims = `${wIn.toFixed(2)}"w × ${hIn.toFixed(2)}"h — ${belowIn.toFixed(2)}" below collar`;
      setInchInfo({ wIn, hIn, maxWIn: area.maxWIn, maxHIn: area.maxHIn, method: area.method,
        atMax: wIn >= area.maxWIn - 0.05 || hIn >= area.maxHIn - 0.05 });
    } else if (geom) {
      setInchInfo(null);
    }
    const key = `${pageIdx}:${side}`;
    const writeDims = dims && dimsLinkedRef.current;   // unlocked → text is independent
    setPages((prev) => {
      const n = clonePages(prev);
      n[pageIdx].sides[side].pos = pos;
      // Smart Dimensions: while LINKED the placement is the truth — the text
      // always follows the logo (type a size → logo resizes → text canonicalizes).
      // Unlock (⛓️) to edit the text freely without touching the logo.
      if (writeDims) n[pageIdx].print[side].dims = dims;
      return n;
    });
    if (writeDims) autoDimsRef.current[key] = dims;
  }, [pageIdx, side, area]);
  const setPrint = useCallback((field, value) => {
    setPages((prev) => { const n = clonePages(prev); n[pageIdx].print[side][field] = value; return n; });
  }, [pageIdx, side]);
  const setPageField = useCallback((field, value) => {
    setPages((prev) => { const n = clonePages(prev); n[pageIdx][field] = value; return n; });
  }, [pageIdx]);

  // Intelligent logo filing — an uploaded logo is worth more than one mockup:
  // (a) it lands in the logos LIBRARY tagged to this client + project so it's
  // reusable everywhere, and (b) if the client has NO brand logo on their CRM
  // card yet, it becomes it (never clobbers an existing card logo). Best-effort
  // — a filing hiccup must never block the mockup work.
  const fileLogoToClient = useCallback(async (url) => {
    const client = meta.client || (project && project.client) || '';
    try {
      await axios.post(`${base}/studio/library/logos`, {
        name: `${client || 'Logo'}${projectNumber ? ` · #${projectNumber}` : ''}`,
        data: url, thumbnail: url, client,
        savedAt: Date.now(), remoteId: `logo-${uid()}`,
      }, authHdr);
    } catch (_) { /* library filing is best-effort */ }
    if (!client) return;
    try {
      const key = deriveCompanyKey(client);
      const { data } = await axios.get(`${base}/client-logos`, authHdr);
      // The endpoint returns { logos: [...] } (OrderTracker reads it the same way).
      const list = Array.isArray(data) ? data : ((data && data.logos) || []);
      const has = list.some((l) => l && l.companyKey === key);
      if (!has) {
        await axios.post(`${base}/client-logos`, { companyName: client, clientName: client, imageDataUrl: url }, authHdr);
      }
    } catch (_) { /* card filing is best-effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.client, projectNumber, authHdr]);

  const onUpload = (field) => async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const url = await fileToDataUrl(f);
    if (url) {
      patchSide(field === 'logo' ? { logo: url, composite: null } : { blank: url, composite: null });
      if (field === 'logo') fileLogoToClient(url);   // fire-and-forget
    }
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

  // ── Ink colors — the classic ✨ auto-detect, ported ──────────────────────────
  const [inkBusy, setInkBusy] = useState(false);
  const [inkMsg, setInkMsg] = useState('');
  useEffect(() => { setInkMsg(''); }, [pageIdx, side]);
  const sideColors = (sd.colors || []).map((c) => (typeof c === 'string' ? { hex: c, name: '' } : { hex: c.hex || '', name: c.name || '' }));
  const setColors = (colors) => patchSide({ colors });
  const autoDetect = async () => {
    if (!sd.logo) { setInkMsg(`Upload the ${side} artwork first, then I can read its colors.`); return; }
    setInkBusy(true); setInkMsg('Scanning…');
    let res;
    try { res = await analyzeArtwork(sd.logo); } catch (e) { res = { error: 'could not read the artwork' }; }
    setInkBusy(false);
    if (!res || res.error) { setInkMsg(res && res.error ? `Couldn't read that artwork (${res.error}).` : 'Nothing to scan.'); return; }
    const top = res.colors.slice(0, INK.maxInks);
    if (!top.length) { setInkMsg('No solid colors found — the artwork may be empty or fully transparent.'); return; }
    setColors(top.map((c) => ({ hex: c.hex.toLowerCase(), name: '' })));
    setInkMsg(res.isComplex
      ? `Complex / photographic design (${res.overflow ? 'lots of' : `${res.colors.length}+`} colors) — filled the ${top.length} most-used; review before quoting.`
      : `Found ${top.length} ink color${top.length === 1 ? '' : 's'} and filled them in.`);
  };

  // ── Save / PDF ───────────────────────────────────────────────────────────────
  const buildFlat = async (num, pgsIn, metaIn) => {
    const pgs = pgsIn || pages;
    const m = metaIn || meta;
    const pdfName = num ? `${String(num).replace(/^#/, '')}.pdf` : (mockupNum ? `${mockupNum.replace(/^#/, '')}.pdf` : '');
    const flat = clonePages(pgs);
    for (let i = 0; i < flat.length; i++) {
      flat[i]._extra = {
        ...flat[i]._extra,
        title: m.title, subtitle: m.subtitle, notes: m.notes, client: m.client,
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

  // ── Background removal (conservative) ────────────────────────────────────────
  // The button only appears when a SOLID background is confidently detected
  // (corners + edge midpoints agree) — so the feature can't half-work. The
  // original is kept in memory for one-tap undo.
  const [bgState, setBgState] = useState({ offer: false, busy: false, original: null });
  useEffect(() => {
    let live = true;
    setBgState((s) => ({ ...s, offer: false, original: null }));
    if (!sd.logo || sd.logo.length > 8_000_000) return undefined;
    detectSolidBg(sd.logo).then((r) => { if (live && r.confident) setBgState({ offer: true, busy: false, original: null, bg: r.bg }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sd.logo && sd.logo.slice(-32), pageIdx, side]);
  const stripBg = async () => {
    if (!sd.logo || bgState.busy) return;
    setBgState((s) => ({ ...s, busy: true }));
    try {
      const out = await removeBackground(sd.logo, bgState.bg);
      setBgState({ offer: false, busy: false, original: sd.logo });
      patchSide({ logo: out, composite: null });
    } catch (_) { setBgState((s) => ({ ...s, busy: false })); }
  };
  const undoBg = () => {
    if (!bgState.original) return;
    patchSide({ logo: bgState.original, composite: null });
    setBgState({ offer: true, busy: false, original: null, bg: bgState.bg });
  };

  // ── Swap-ink recolor (screen print only) ─────────────────────────────────────
  // Tap a swatch's paint icon → pick a new color → every pixel of that ink in
  // the ACTUAL artwork recolors (classic behavior). Gated to screen-print sides.
  const inkSwapRef = useRef(null);
  const [inkSwapIdx, setInkSwapIdx] = useState(null);
  const startInkSwap = (i) => { setInkSwapIdx(i); if (inkSwapRef.current) { inkSwapRef.current.value = sideColors[i] ? sideColors[i].hex : '#000000'; inkSwapRef.current.click(); } };
  const finishInkSwap = async (to) => {
    const i = inkSwapIdx;
    setInkSwapIdx(null);
    if (i == null || !sd.logo || !sideColors[i]) return;
    const from = sideColors[i].hex;
    setInkMsg('Recoloring…');
    const { url, changed } = await recolorInk(sd.logo, from, to);
    if (!changed) { setInkMsg('No pixels matched that ink — it may have been edited already.'); return; }
    patchSide({ logo: url, composite: null });
    setColors(sideColors.map((c, j) => (j === i ? { ...c, hex: to.toLowerCase() } : c)));
    setInkMsg(`Swapped ${from} → ${to} across the artwork (${changed.toLocaleString()} px).`);
  };

  // ── One-click colorways ──────────────────────────────────────────────────────
  // Multi-select S&S colors → each becomes its OWN mockup: same logo, same
  // placement, that colorway's blank(s), flattened, numbered by the server
  // (A/B/C… letters-in), saved to the library project-linked.
  const [cwPick, setCwPick] = useState({});          // color label → color obj
  const [cwBusy, setCwBusy] = useState('');
  const cwCount = Object.keys(cwPick).length;
  const makeColorways = async () => {
    const picks = Object.values(cwPick);
    if (!picks.length || !orderId) return;
    const src = pages[pageIdx];
    setCwBusy(`Colorway 0/${picks.length}…`);
    let made = 0;
    try {
      for (let i = 0; i < picks.length; i++) {
        const c = picks[i];
        setCwBusy(`Colorway ${i + 1}/${picks.length} — ${c.color || ''}…`);
        const pg = clonePages([src])[0];
        if (c.front) { pg.sides.front.blank = c.front; pg.sides.front.composite = null; }
        if (c.back) { pg.sides.back.blank = c.back; pg.sides.back.composite = null; }
        for (const s of ['front', 'back']) {
          const sdx = pg.sides[s];
          if (sdx.blank && sdx.logo && sdx.pos && sdx.pos.x != null) {
            const comp = await flattenHeadless(sdx.blank, sdx.logo, sdx.pos);
            if (comp) sdx.composite = comp;
          }
        }
        const asg = await axios.post(`${base}/orders/${orderId}/mockups/assign`, {}, authHdr);
        const num = (asg.data && asg.data.mockupNum) || '';
        const subtitle = [c.styleName || ssStyle, c.color].filter(Boolean).join(', ');
        pg._extra = { ...pg._extra, title: meta.title, subtitle, notes: meta.notes, client: meta.client,
          mockupNum: num, pdfName: num ? `${num.replace(/^#/, '')}.pdf` : '',
          ...(projectNumber ? { projectNumber } : {}), ...(orderId ? { projectId: orderId } : {}) };
        const model = {
          id: null, remoteId: `studio-${uid()}`, mockupNum: num,
          name: `${meta.title || meta.client || 'Mockup'}${c.color ? ` · ${c.color}` : ''}`,
          client: meta.client, projectNumber, pages: [pg],
        };
        const body = mockupToLibraryItem(model, []);
        body.companyKey = deriveCompanyKey(meta.client);
        body.savedAt = Date.now();
        await axios.post(`${base}/studio/library/mockups`, body, authHdr);
        made++;
      }
      setCwBusy('');
      setCwPick({});
      setBusy(`✓ ${made} colorway${made === 1 ? '' : 's'} created & lettered — they're on the project now.`);
      if (onSaved) onSaved();
    } catch (e) {
      setCwBusy('');
      setBusy(`Made ${made}/${picks.length} before an error: ${e.response?.data?.message || e.message}`);
    }
  };

  // ── S&S manual lane + product link ───────────────────────────────────────────
  const [ssManual, setSsManual] = useState(false);
  const [ssFrontUrl, setSsFrontUrl] = useState('');
  const [ssBackUrl, setSsBackUrl] = useState('');
  const applyManualUrls = () => {
    setPages((prev) => {
      const n = clonePages(prev);
      if (ssFrontUrl.trim()) { n[pageIdx].sides.front.blank = ssFrontUrl.trim(); n[pageIdx].sides.front.composite = null; }
      if (ssBackUrl.trim()) { n[pageIdx].sides.back.blank = ssBackUrl.trim(); n[pageIdx].sides.back.composite = null; }
      return n;
    });
    setSsMsg('✓ URLs applied');
  };

  // ── Fit the canvas to its container + keyboard shortcuts ─────────────────────
  const cvWrapRef = useRef(null);
  const [cvScale, setCvScale] = useState(1);
  useEffect(() => {
    const el = cvWrapRef.current; if (!el) return undefined;
    const measure = () => setCvScale(Math.min(1, Math.max(0.3, (el.clientWidth - 4) / STAGE_W)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Arrows nudge the logo (Shift = ×5); [ / ] flip pages. Never while typing.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const step = e.shiftKey ? 10 : 2;
      const nudges = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (nudges[e.key] && canvasRef.current) { e.preventDefault(); canvasRef.current.nudge(...nudges[e.key]); }
      else if (e.key === '[') setPageIdx((i) => Math.max(0, i - 1));
      else if (e.key === ']') setPageIdx((i) => Math.min(pages.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length]);

  // ── PDF sheet preview + borders toggle ───────────────────────────────────────
  const [borders, setBorders] = useState(false);
  const [pvUrl, setPvUrl] = useState(null);
  const [pvBusy, setPvBusy] = useState(false);
  const openPreview = async () => {
    if (pvBusy) return;
    setPvBusy(true);
    try {
      const { buildMockupPdfBytes } = await import('./mockupPdf');
      const flat = await buildFlat(mockupNum);
      const states = flat.map((pg, i) => pageToState(pg, prevStates[i]));
      const bytes = await buildMockupPdfBytes(states, { placeholders: borders });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setPvUrl(URL.createObjectURL(blob));
    } catch (e) { setBusy('Preview failed: ' + e.message); }
    finally { setPvBusy(false); }
  };
  const closePreview = () => { if (pvUrl) URL.revokeObjectURL(pvUrl); setPvUrl(null); };

  // ── Save + AUTOSAVE + intelligent version history ────────────────────────────
  // No Ctrl+S: edits autosave (1.5s debounce, single-flight, re-queued if edits
  // land mid-save). A save also pushes a VERSION snapshot, classified by what
  // actually changed — a garment/blank swap files as a "colorway", art/placement
  // as an "edit", text-only as "details" — so history reads like a story, not a
  // pile of identical rows. Server dedups identical snapshots by hash.
  const [saveState, setSaveState] = useState('idle');   // idle|dirty|saving|saved|error
  const saveTimer = useRef(null);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const mockupNumRef = useRef(mockupNum);
  mockupNumRef.current = mockupNum;
  const stateRef = useRef({ pages, meta });
  stateRef.current = { pages, meta };
  const lastSigRef = useRef(null);      // last-saved signature (for version classification)
  const lastPushRef = useRef({ hash: '', at: 0, kind: '' });

  const pageSig = (pgs, m) => {
    const p0 = pgs[0] || {};
    const f = (p0.sides && p0.sides.front) || {}, b = (p0.sides && p0.sides.back) || {};
    const tail = (s) => (s ? String(s).slice(-64) : '');
    return {
      garment: `${tail(f.blank)}|${tail(b.blank)}`,
      art: `${tail(f.logo)}|${tail(b.logo)}|${JSON.stringify(f.pos)}|${JSON.stringify(b.pos)}|${pgs.length}`,
      details: JSON.stringify([m.title, m.subtitle, m.notes, m.client, p0.print, p0.template, p0.category, f.colors, b.colors]),
    };
  };
  const classify = (prev, next) => {
    if (!prev) return 'save';
    if (prev.garment !== next.garment) return 'garment';
    if (prev.art !== next.art) return 'edit';
    if (prev.details !== next.details) return 'details';
    return 'same';
  };

  const pushVersion = async (flat, num, kind) => {
    try {
      const states = flat.map((pg, i) => pageToState(pg, prevStates[i]));
      const p0 = states[0] || {};
      const hash = fnvHash(JSON.stringify(states.map((s) => [s.frontLogoPosSize, s.backLogoPosSize, s.printFront, s.printBack, s.title, s.subtitle,
        String(s.frontCompositeBase64 || '').slice(-80), String(s.backCompositeBase64 || '').slice(-80)])));
      const now = Date.now();
      const lp = lastPushRef.current;
      if (hash === lp.hash) return;
      if (kind === 'details' && now - lp.at < 120000) return;    // don't journal every keystroke
      lastPushRef.current = { hash, at: now, kind };
      const slim = { ...p0, frontBlankBase64: null, backBlankBase64: null, frontLogoBase64: null, backLogoBase64: null,
        frontCompositeBase64: null, backCompositeBase64: null, frontBlankImg: null, backBlankImg: null, frontLogoImg: null, backLogoImg: null };
      await axios.post(`${base}/studio/versions`, {
        mockupRemoteId: remoteIdRef.current, versionRemoteId: `ver-${uid()}`,
        name: meta.title || meta.client || 'Mockup', mockupNum: num || '', client: meta.client || '',
        trigger: kind, hash,
        thumbnail: p0.frontCompositeBase64 || p0.frontBlankBase64 || '',
        data: p0.backCompositeBase64 || p0.backBlankBase64 || '',
        pageState: slim, savedAt: now,
      }, authHdr);
    } catch (_) { /* history is best-effort — never blocks a save */ }
  };

  const performSave = useCallback(async (manual) => {
    if (!orderId) { if (manual) setBusy('Pick a project first — the mockup number and order link come from it.'); return; }
    if (inFlight.current) { queued.current = true; return; }
    inFlight.current = true;
    setSaveState('saving');
    try {
      let num = mockupNumRef.current;
      if (!num) {
        const asg = await axios.post(`${base}/orders/${orderId}/mockups/assign`, {}, authHdr);
        num = (asg.data && asg.data.mockupNum) || '';
        if (num) setMockupNum(num);
      }
      const { pages: curPages, meta: curMeta } = stateRef.current;
      const flat = await buildFlat(num, curPages, curMeta);
      const model = {
        id: (!isNew && mockup.id != null) ? mockup.id : null,
        remoteId: remoteIdRef.current,
        mockupNum: num || '',
        name: curMeta.title || curMeta.client || 'Mockup',
        client: curMeta.client, projectNumber, pages: flat,
      };
      const body = mockupToLibraryItem(model, prevStates);
      body.companyKey = deriveCompanyKey(curMeta.client);
      body.savedAt = Date.now();
      await axios.post(`${base}/studio/library/mockups`, body, authHdr);
      const sig = pageSig(flat, curMeta);
      const kind = classify(lastSigRef.current, sig);
      lastSigRef.current = sig;
      if (kind !== 'same') pushVersion(flat, num, kind === 'save' ? 'save' : kind);
      setSaveState('saved');
      if (manual) setBusy(`Saved ✓ ${num ? `#${num.replace(/^#/, '')}` : ''}`);
      if (onSaved) onSaved();
    } catch (err) {
      setSaveState('error');
      setBusy(err.response?.data?.message || err.message);
    } finally {
      inFlight.current = false;
      if (queued.current) { queued.current = false; performSave(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, authHdr, isNew, projectNumber, prevStates]);

  const save = () => performSave(true);

  // Autosave: any change to pages/meta marks dirty and re-arms the debounce.
  // A brand-new mockup starts autosaving once it's project-linked AND carries
  // something worth keeping (art or a title) — no junk docs from empty opens.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return undefined; }
    const hasSubstance = !isNew || meta.title
      || pages.some((pg) => ['front', 'back'].some((s) => pg.sides[s].blank || pg.sides[s].logo || pg.sides[s].composite));
    if (!orderId || !hasSubstance) return undefined;
    setSaveState('dirty');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => performSave(false), 1500);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, meta, orderId]);

  // ── Version history dialog ───────────────────────────────────────────────────
  const [histOpen, setHistOpen] = useState(false);
  const [histRows, setHistRows] = useState(null);
  const KIND_META = {
    garment: { label: 'colorway', color: '#8fb7e6' },
    edit: { label: 'art edit', color: D.green },
    details: { label: 'details', color: D.faint },
    save: { label: 'saved', color: D.muted },
    restore: { label: 'restore', color: '#e6b45c' },
  };
  const openHistory = async () => {
    setHistOpen(true); setHistRows(null);
    try {
      const { data } = await axios.get(`${base}/studio/versions/${encodeURIComponent(remoteIdRef.current)}`, authHdr);
      setHistRows(Array.isArray(data) ? data : []);
    } catch (_) { setHistRows([]); }
  };
  const restoreVersion = async (row) => {
    try {
      const { data } = await axios.get(`${base}/studio/version/${encodeURIComponent(row.versionRemoteId || row._id)}`, authHdr);
      const ps = { ...(data.pageState || {}) };
      if (!ps.frontCompositeBase64 && data.thumbnail) { ps.frontCompositeBase64 = data.thumbnail; ps.frontBlankBase64 = ps.frontBlankBase64 || data.thumbnail; }
      if (!ps.backCompositeBase64 && data.data) { ps.backCompositeBase64 = data.data; ps.backBlankBase64 = ps.backBlankBase64 || data.data; }
      const pg = pageFromState(ps);
      setPages((prev) => { const n = clonePages(prev); n[pageIdx] = pg; return n; });
      setMeta((m) => ({ ...m, title: ps.title || m.title, subtitle: ps.subtitle || m.subtitle, notes: ps.notes || m.notes }));
      lastPushRef.current = { hash: '', at: 0, kind: 'restore' };
      setHistOpen(false);
      setBusy(`Restored the ${KIND_META[row.trigger] ? KIND_META[row.trigger].label : ''} version — review, it autosaves.`);
    } catch (e) { setBusy('Could not restore that version.'); }
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const exportPdf = async () => {
    if (pdfBusy) return; setPdfBusy(true); setBusy('Building PDF…');
    try {
      const flat = await buildFlat(mockupNum);
      const pageStates = flat.map((pg, i) => pageToState(pg, prevStates[i]));
      const fname = mockupNum ? `${mockupNum.replace(/^#/, '')}.pdf` : `${(meta.title || 'mockup').replace(/[^\w-]+/g, '_')}.pdf`;
      await exportMockupPdf(pageStates, fname, { placeholders: borders }); setBusy('PDF exported ✓');
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

  const canvasKey = `${pageIdx}:${side}:${sd.blank ? sd.blank.slice(-24) : 'x'}:${sd.logo ? sd.logo.slice(-24) : 'x'}`;
  const field = (label, value, onChange, opts = {}) => (
    <TextField label={label} value={value} onChange={(e) => onChange(e.target.value)} size="small" fullWidth
      multiline={!!opts.multiline} minRows={opts.multiline ? 2 : undefined} select={!!opts.select} sx={{ ...dropInput }}>
      {opts.select && opts.children}
    </TextField>
  );
  // Upload buttons double as DROP targets — drag a file straight onto the slot.
  const dropFile = (f) => async (e) => {
    e.preventDefault();
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    if (url) {
      patchSide(f === 'logo' ? { logo: url, composite: null } : { blank: url, composite: null });
      if (f === 'logo') fileLogoToClient(url);
    }
  };
  const uploadBtn = (label, f) => (
    <Button component="label" size="small" startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 14 }} />}
      onDragOver={(e) => e.preventDefault()} onDrop={dropFile(f)}
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
        {(busy || cwBusy) && <Typography sx={{ fontSize: 12, maxWidth: 340, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: (busy + cwBusy).includes('✓') ? D.green : '#fbbf24' }}>{cwBusy || busy}</Typography>}
        {/* Autosave pill — no Ctrl+S in this lab; edits save themselves. */}
        <Typography sx={{ ...mono, fontSize: 10.5, px: 1, whiteSpace: 'nowrap',
          color: saveState === 'error' ? '#f87171' : saveState === 'saving' ? '#fbbf24' : saveState === 'dirty' ? D.faint : D.green }}>
          {!orderId ? 'pick a project to save' : saveState === 'saving' ? 'saving…' : saveState === 'dirty' ? 'edits pending…' : saveState === 'error' ? 'save failed — retrying on next edit' : 'all changes saved ✓'}
        </Typography>
        <Tooltip title="Version history"><span>
          <IconButton onClick={openHistory} size="small" disabled={isNew && !mockupNum}
            sx={{ color: D.muted, border: `1px solid ${D.line}`, borderRadius: 999, '&:hover': { color: D.green, borderColor: D.green } }}>
            <HistoryIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span></Tooltip>
        <Button onClick={() => setBorders((v) => !v)} size="small"
          title="Placeholder borders in the exported/previewed PDF for empty image slots"
          sx={{ ...mono, color: borders ? D.green : D.muted, textTransform: 'none', fontWeight: 700, fontSize: 10.5, border: `1px solid ${borders ? 'rgba(74,222,128,0.4)' : D.line}`, borderRadius: 999, px: 1.25 }}>
          Borders: {borders ? 'ON' : 'OFF'}
        </Button>
        <Button onClick={openPreview} disabled={pvBusy} size="small"
          startIcon={pvBusy ? <CircularProgress size={13} sx={{ color: D.green }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />}
          sx={{ color: D.text, textTransform: 'none', fontWeight: 700, fontSize: 12, border: `1px solid ${D.line}`, borderRadius: 999, px: 1.5, '&:hover': { borderColor: D.green, color: D.green } }}>Preview</Button>
        <Button onClick={exportPdf} disabled={pdfBusy} size="small" startIcon={pdfBusy ? <CircularProgress size={13} sx={{ color: D.green }} /> : <PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ color: D.text, textTransform: 'none', fontWeight: 700, fontSize: 12, border: `1px solid ${D.line}`, borderRadius: 999, px: 1.5, '&:hover': { borderColor: D.green, color: D.green } }}>PDF</Button>
        <Button onClick={save} disabled={saveState === 'saving' || !orderId}
          title={!orderId ? 'Pick a project first — the mockup number and order link come from it' : 'Autosave is on — this just saves right now'}
          startIcon={saveState === 'saving' ? <CircularProgress size={13} sx={{ color: '#08130c' }} /> : <CheckIcon sx={{ fontSize: 16 }} />}
          sx={{ bgcolor: D.green, color: '#08130c', textTransform: 'none', fontWeight: 800, px: 2, borderRadius: 999, '&:hover': { bgcolor: '#3bd070' }, '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.3)' } }}>Save now</Button>
      </Stack>

      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '236px 1fr 300px' }, gap: 0, overflow: 'hidden' }}>
        {/* Left — garment / logo / S&S / auto-placement */}
        <Box sx={{ borderRight: { md: `1px solid ${D.line}` }, p: 1.5, overflowY: 'auto', ...scrollbar }}>
          <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 1, mb: 1 }}>GARMENT · {side.toUpperCase()}</Typography>
          <Stack direction="row" gap={1} sx={{ mb: 1 }}>{uploadBtn(sd.blank ? 'Blank ✓' : 'Blank', 'blank')}{uploadBtn(sd.logo ? 'Logo ✓' : 'Logo', 'logo')}</Stack>
          {(bgState.offer || bgState.original) && (
            <Button onClick={bgState.original ? undoBg : stripBg} disabled={bgState.busy} size="small" fullWidth
              startIcon={bgState.busy ? <CircularProgress size={12} sx={{ color: D.green }} /> : <AutoFixHighIcon sx={{ fontSize: 14 }} />}
              sx={{ mb: 1, color: bgState.original ? '#fbbf24' : D.green, textTransform: 'none', fontWeight: 700, fontSize: 11,
                border: `1px solid ${D.line}`, borderRadius: 1.5, '&:hover': { borderColor: D.green } }}>
              {bgState.original ? 'Undo background removal' : 'Remove solid background'}
            </Button>
          )}

          <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 1, mt: 1.5, mb: 0.75 }}>S&amp;S FINDER</Typography>
          <Stack direction="row" gap={0.75}>
            <TextField value={ssStyle} onChange={(e) => setSsStyle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') searchSs(); }}
              placeholder="Style (e.g. 3001)" size="small" fullWidth sx={{ ...dropInput }} />
            <IconButton onClick={() => searchSs()} disabled={ssBusy} size="small" sx={{ color: D.green, border: `1px solid ${D.line}`, borderRadius: 1.5 }}>
              {ssBusy ? <CircularProgress size={14} sx={{ color: D.green }} /> : <SearchIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 0.25 }}>
            {ssStyle.trim() && (
              <Typography component="a" href={`https://www.ssactivewear.com/ps/?q=${encodeURIComponent(ssStyle.trim())}`} target="_blank" rel="noreferrer"
                sx={{ fontSize: 10, color: D.faint, textDecoration: 'none', '&:hover': { color: D.green } }}>Open on S&amp;S ↗</Typography>
            )}
            <Typography component="button" onClick={() => setSsManual((v) => !v)}
              sx={{ background: 'none', border: 'none', p: 0, cursor: 'pointer', fontSize: 10, color: ssManual ? D.green : D.faint, fontWeight: 700 }}>
              {ssManual ? 'auto search' : 'paste URLs'}
            </Typography>
          </Stack>
          {ssManual && (
            <Stack gap={0.6} sx={{ mt: 0.6 }}>
              <TextField value={ssFrontUrl} onChange={(e) => setSsFrontUrl(e.target.value)} placeholder="Front image URL (right-click on S&S → copy image address)" size="small" fullWidth sx={{ ...dropInput, '& input': { fontSize: 10.5 } }} />
              <TextField value={ssBackUrl} onChange={(e) => setSsBackUrl(e.target.value)} placeholder="Back image URL" size="small" fullWidth sx={{ ...dropInput, '& input': { fontSize: 10.5 } }} />
              <Button onClick={applyManualUrls} disabled={!ssFrontUrl.trim() && !ssBackUrl.trim()} size="small"
                sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11, border: `1px solid ${D.line}`, borderRadius: 1 }}>Apply to canvas</Button>
            </Stack>
          )}
          {ssMsg && <Typography sx={{ fontSize: 10.5, color: ssMsg.startsWith('✗') ? '#f87171' : D.faint, mt: 0.5 }}>{ssMsg}</Typography>}
          {ssColors && (
            <Stack gap={0.4} sx={{ mt: 0.75, maxHeight: 200, overflowY: 'auto', ...scrollbar }}>
              {ssColors.map((c, i) => (
                <Stack key={i} direction="row" alignItems="center" gap={0.25}>
                  {c.pick === 'color' && (
                    <Checkbox size="small" checked={!!cwPick[c.color || i]}
                      onChange={(e) => setCwPick((m) => { const n = { ...m }; if (e.target.checked) n[c.color || i] = c; else delete n[c.color || i]; return n; })}
                      title="Select for one-click colorways"
                      sx={{ p: 0.25, color: D.faint, '&.Mui-checked': { color: D.green } }} />
                  )}
                  <Button onClick={() => (c.pick === 'style' ? searchSs(c.styleID) : applySsColor(c))} size="small" fullWidth
                    sx={{ justifyContent: 'flex-start', color: D.text, textTransform: 'none', fontSize: 11, border: `1px solid ${D.line}`, borderRadius: 1, px: 1, '&:hover': { borderColor: D.green } }}>
                    {(c.swatch1 || c.swatch) && <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', mr: 0.75, flex: 'none', border: `1px solid ${D.line}`, bgcolor: c.swatch1 || c.swatch }} />}
                    {c.pick === 'style' ? (c.label || c.styleName) : (c.color || 'color')}
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
          {cwCount > 0 && (
            <Button onClick={makeColorways} disabled={!!cwBusy || !orderId || !sd.logo} fullWidth size="small"
              title={!orderId ? 'Link a project first' : !sd.logo ? 'Place a logo first — colorways reuse this placement' : ''}
              startIcon={cwBusy ? <CircularProgress size={12} sx={{ color: '#08130c' }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
              sx={{ mt: 0.75, bgcolor: D.green, color: '#08130c', textTransform: 'none', fontWeight: 800, fontSize: 11, borderRadius: 1.5, '&:hover': { bgcolor: '#3bd070' }, '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.3)' } }}>
              Create {cwCount} colorway{cwCount === 1 ? '' : 's'} (A/B/C…)
            </Button>
          )}

          <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 1, mt: 1.75, mb: 0.75 }}>PRODUCT</Typography>
          <TextField select size="small" fullWidth value={page.category || 'generic'}
            onChange={(e) => setPageField('category', e.target.value)} sx={{ ...dropInput }}>
            {CATEGORY_ORDER.map((k) => <MenuItem key={k} value={k}>{PRINT_AREAS[k].label}</MenuItem>)}
          </TextField>
          {area && (
            <Typography sx={{ color: D.faint, fontSize: 10, mt: 0.5 }}>
              Max {area.maxWIn}″ × {area.maxHIn}″ · {area.method} · dashed box = printable
            </Typography>
          )}

          {sd.logo && (
            <>
              <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 1, mt: 1.75, mb: 0.75 }}>AUTO-PLACEMENT</Typography>
              {area ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                  {area.presets.map((p) => (
                    <Button key={p.label} onClick={() => canvasRef.current && canvasRef.current.applyAreaPreset(p)} size="small"
                      sx={{ color: D.text, fontSize: 10, textTransform: 'none', fontWeight: 600, border: `1px solid ${D.line}`, borderRadius: 1, minWidth: 0, px: 0.5, '&:hover': { borderColor: D.green, color: D.green } }}>
                      {p.label} {p.wIn}″
                    </Button>
                  ))}
                </Box>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5 }}>
                  {PRESET_ORDER.map((k) => (
                    <Button key={k} onClick={() => canvasRef.current && canvasRef.current.applyPreset(PRESETS[k])} size="small"
                      sx={{ color: D.text, fontSize: 10, textTransform: 'none', fontWeight: 600, border: `1px solid ${D.line}`, borderRadius: 1, minWidth: 0, px: 0.5, '&:hover': { borderColor: D.green, color: D.green } }}>{PRESETS[k].label}</Button>
                  ))}
                </Box>
              )}
              <Stack direction="row" gap={0.5} alignItems="center" sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: 10, color: D.faint, fontWeight: 700 }}>Nudge</Typography>
                {[['←', -2, 0], ['→', 2, 0], ['↑', 0, -2], ['↓', 0, 2]].map(([l, dx, dy]) => (
                  <Button key={l} onClick={() => canvasRef.current && canvasRef.current.nudge(dx, dy)} size="small"
                    sx={{ minWidth: 26, color: D.text, border: `1px solid ${D.line}`, borderRadius: 1, fontSize: 13, fontWeight: 800, '&:hover': { borderColor: D.green, color: D.green } }}>{l}</Button>
                ))}
                <Button onClick={() => canvasRef.current && canvasRef.current.resetPosition()} size="small"
                  sx={{ minWidth: 0, px: 1, color: D.muted, border: `1px solid ${D.line}`, borderRadius: 1, fontSize: 11, fontWeight: 700, '&:hover': { borderColor: D.green, color: D.green } }}>↺</Button>
              </Stack>
              {inchInfo && (
                <Typography sx={{ ...mono, fontSize: 10.5, mt: 0.75, color: inchInfo.atMax ? '#fbbf24' : D.green }}>
                  {inchInfo.wIn.toFixed(2)}″ × {inchInfo.hIn.toFixed(2)}″
                  {inchInfo.atMax ? ` · at the ${inchInfo.method} max` : ''}
                </Typography>
              )}
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
          <Box ref={cvWrapRef} sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2, overflow: 'hidden' }}>
              <MockupCanvas ref={canvasRef} key={canvasKey} width={STAGE_W} height={STAGE_H} displayScale={cvScale}
                blankSrc={sd.blank || sd.composite || null} logoSrc={sd.logo || null} pos={sd.pos}
                area={area} onChange={setPos} />
            </Box>
          </Box>
          <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
            {['front', 'back'].map((s) => {
              const on = s === side;
              const sdx = page.sides[s];
              const hasArt = !!(sdx.blank || sdx.logo || sdx.composite);
              return (
                <Button key={s} onClick={() => setSide(s)} size="small"
                  sx={{ textTransform: 'capitalize', fontWeight: 800, fontSize: 12, px: 2, color: on ? '#08130c' : D.text, bgcolor: on ? D.green : 'transparent', border: `1px solid ${on ? D.green : D.line}`, borderRadius: 999, '&:hover': { bgcolor: on ? D.green : D.panelHi } }}>
                  {s}
                  {/* dot = this side carries art — no surprise-empty flips */}
                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', ml: 0.75,
                    bgcolor: hasArt ? (on ? '#08130c' : D.green) : 'transparent',
                    border: hasArt ? 'none' : `1px solid ${on ? 'rgba(8,19,12,0.4)' : D.faint}` }} />
                </Button>
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
            <Autocomplete
              size="small"
              options={projects}
              getOptionLabel={(o) => o.label || ''}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={projects.find((p) => p.id === proj.id) || (proj.id ? { id: proj.id, label: proj.label || `#${proj.projectNumber}` } : null)}
              onChange={(_, v) => pickProject(v)}
              renderInput={(params) => (
                <TextField {...params} label="Project *" placeholder="Type a project — #133 Dredo, Bleu Leaf"
                  sx={{ ...dropInput }} error={!proj.id}
                  helperText={!proj.id ? 'Required — the number + order link come from it' : undefined} />
              )}
              slotProps={{ paper: { sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}` } } }}
            />
            {field('Client', meta.client, (v) => setMeta((m) => ({ ...m, client: v })))}
            {field('Title', meta.title, (v) => setMeta((m) => ({ ...m, title: v })))}
            {field('Subtitle', meta.subtitle, (v) => setMeta((m) => ({ ...m, subtitle: v })))}
            <Stack direction="row" gap={1.25}>
              <TextField label="Mockup # · auto" value={mockupNum || '— on save —'} size="small" fullWidth
                InputProps={{ readOnly: true }} sx={{ ...dropInput, opacity: 0.8 }} />
              <TextField label="PDF · auto" value={mockupNum ? `${mockupNum.replace(/^#/, '')}.pdf` : '—'} size="small" fullWidth
                InputProps={{ readOnly: true }} sx={{ ...dropInput, opacity: 0.8 }} />
            </Stack>
            {field('Notes', meta.notes, (v) => setMeta((m) => ({ ...m, notes: v })), { multiline: true })}
            {field('Template', page.template, (v) => setPageField('template', Number(v)), { select: true, children: [<MenuItem key={1} value={1}>Front + Back</MenuItem>, <MenuItem key={2} value={2}>Front only</MenuItem>] })}
            <Divider sx={{ borderColor: D.line }} />
            <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{side} print spec</Typography>
            {field('Type', page.print[side].type, (v) => setPrint('type', v))}
            <Stack direction="row" gap={0.5} alignItems="center">
              <TextField label={`Dimensions${dimsLinked ? ' · linked to logo' : ''}`} size="small" fullWidth
                value={dimsDraft != null ? dimsDraft : page.print[side].dims}
                onChange={(e) => setDimsDraft(e.target.value)}
                onFocus={() => setDimsDraft(page.print[side].dims)}
                onBlur={() => { if (dimsDraft != null) applyDimsText(dimsDraft); setDimsDraft(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
                placeholder={area ? 'e.g. 10 (inches wide)' : ''}
                sx={{ ...dropInput }} />
              <Tooltip title={dimsLinked
                ? 'Linked: typing a size resizes the logo; moving the logo rewrites this text. Click to unlock and edit them separately.'
                : 'Unlocked: this text and the logo size are independent. Click to re-link.'}>
                <IconButton onClick={() => setDimsLinked((v) => !v)} size="small"
                  sx={{ color: dimsLinked ? D.green : '#fbbf24', border: `1px solid ${D.line}`, borderRadius: 1.5 }}>
                  {dimsLinked ? <LinkIcon sx={{ fontSize: 15 }} /> : <LinkOffIcon sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>
            </Stack>
            {field('Location', page.print[side].loc, (v) => setPrint('loc', v))}
            <Divider sx={{ borderColor: D.line }} />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{side} logo colors</Typography>
              <Button onClick={autoDetect} disabled={inkBusy} size="small"
                sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11, minWidth: 0, px: 1 }}>
                {inkBusy ? <CircularProgress size={12} sx={{ color: D.green }} /> : '✨ Auto-detect'}
              </Button>
            </Stack>
            {!isScreenPrintType(page.print[side].type) && (
              <Typography sx={{ color: D.faint, fontSize: 10.5, mt: -0.75 }}>
                {page.print[side].type} doesn't price by ink color — palette optional.
              </Typography>
            )}
            {inkMsg && <Typography sx={{ color: D.muted, fontSize: 11, mt: -0.5 }}>{inkMsg}</Typography>}
            {sideColors.map((c, i) => (
              <Stack key={i} direction="row" gap={0.75} alignItems="center" sx={{ mt: i === 0 ? 0 : -0.75 }}>
                <Box component="input" type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#000000'}
                  onChange={(e) => setColors(sideColors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                  sx={{ width: 26, height: 26, p: 0, border: `1px solid ${D.line}`, borderRadius: 1, bgcolor: 'transparent', cursor: 'pointer' }} />
                <TextField value={c.hex} onChange={(e) => setColors(sideColors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                  size="small" sx={{ ...dropInput, width: 92, '& input': { ...mono, fontSize: 11 } }} />
                <TextField value={c.name} placeholder="name (shows in PDF)"
                  onChange={(e) => setColors(sideColors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  size="small" fullWidth sx={{ ...dropInput, '& input': { fontSize: 11 } }} />
                {sd.logo && isScreenPrintType(page.print[side].type) && (
                  <Tooltip title="Swap this ink across the actual artwork (screen print)">
                    <IconButton onClick={() => startInkSwap(i)} size="small" sx={{ color: D.faint, '&:hover': { color: D.green } }}>
                      <Typography component="span" sx={{ fontSize: 12, fontWeight: 800 }}>⇄</Typography>
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton onClick={() => setColors(sideColors.filter((_, j) => j !== i))} size="small" sx={{ color: D.faint, '&:hover': { color: '#f87171' } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Stack>
            ))}
            <Box component="input" type="color" ref={inkSwapRef}
              onChange={(e) => finishInkSwap(e.target.value)}
              sx={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
            {sideColors.length < INK.maxInks && (
              <Button onClick={() => setColors([...sideColors, { hex: '#000000', name: '' }])} size="small"
                sx={{ color: D.faint, textTransform: 'none', fontWeight: 600, fontSize: 11, border: `1px dashed ${D.line}`, borderRadius: 1.5, '&:hover': { color: D.green, borderColor: D.green } }}>
                + Add a color
              </Button>
            )}
            {canDuplicate && (
              <Button onClick={duplicate} disabled={dupBusy} size="small" startIcon={dupBusy ? <CircularProgress size={13} sx={{ color: D.green }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
                sx={{ color: D.text, textTransform: 'none', fontWeight: 700, fontSize: 12, border: `1px solid ${D.line}`, borderRadius: 999, mt: 1, '&:hover': { borderColor: D.green, color: D.green } }}>Add a variation</Button>
            )}
          </Stack>
        </Box>
      </Box>

      {/* PDF sheet preview — the real export, rendered inline */}
      <Dialog open={!!pvUrl} onClose={closePreview} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`, height: '88vh' } }}>
        <DialogTitle sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${D.line}`, display: 'flex', alignItems: 'center' }}>
          <Typography component="span" sx={{ fontWeight: 800, fontSize: 14, flex: 1 }}>PDF preview — exactly what exports</Typography>
          <Button onClick={closePreview} size="small" sx={{ color: D.muted, textTransform: 'none' }}>Close</Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {pvUrl && <Box component="iframe" title="PDF preview" src={pvUrl} sx={{ width: '100%', height: '100%', border: 0, bgcolor: '#525659' }} />}
        </DialogContent>
      </Dialog>

      {/* Version history — colorways vs art edits vs details, restorable */}
      <Dialog open={histOpen} onClose={() => setHistOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}` } }}>
        <DialogTitle sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${D.line}` }}>
          <Typography component="span" sx={{ fontWeight: 800, fontSize: 14 }}>Version history</Typography>
          <Typography sx={{ color: D.faint, fontSize: 11 }}>Every meaningful save, classified: 🎨 colorway (garment changed) · ✏️ art edit · 📝 details. Restore replaces this page — it autosaves after.</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 1.5, ...scrollbar }}>
          {histRows === null ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} sx={{ color: D.green }} /></Box>
          ) : histRows.length === 0 ? (
            <Typography sx={{ color: D.faint, fontSize: 12.5, textAlign: 'center', py: 3 }}>No versions yet — they'll appear as you edit (autosave journals each meaningful change).</Typography>
          ) : histRows.map((r) => {
            const km = KIND_META[r.trigger] || KIND_META.save;
            return (
              <Stack key={r._id} direction="row" alignItems="center" gap={1.25} sx={{ py: 0.75, borderBottom: `1px solid ${D.line}` }}>
                <Box sx={{ width: 42, height: 42, borderRadius: 1, bgcolor: '#fff', overflow: 'hidden', flex: 'none', border: `1px solid ${D.line}` }}>
                  {r.thumbnail && <Box component="img" src={r.thumbnail} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name || 'Mockup'}</Typography>
                    <Typography component="span" sx={{ ...mono, fontSize: 9, fontWeight: 700, px: 0.75, py: 0.1, borderRadius: 999, color: km.color, border: `1px solid ${km.color}55`, whiteSpace: 'nowrap' }}>
                      {r.trigger === 'garment' ? '🎨 ' : r.trigger === 'edit' ? '✏️ ' : '📝 '}{km.label}
                    </Typography>
                  </Stack>
                  <Typography sx={{ ...mono, color: D.faint, fontSize: 10 }}>
                    {r.mockupNum ? `#${String(r.mockupNum).replace(/^#/, '')} · ` : ''}{new Date(r.savedAt).toLocaleString()}
                  </Typography>
                </Box>
                <Button onClick={() => restoreVersion(r)} size="small"
                  sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11.5, border: `1px solid ${D.line}`, borderRadius: 999, px: 1.25, '&:hover': { borderColor: D.green } }}>Restore</Button>
              </Stack>
            );
          })}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
