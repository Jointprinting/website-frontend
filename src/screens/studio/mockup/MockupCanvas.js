// src/screens/studio/mockup/MockupCanvas.js
//
// The native mockup canvas — a faithful React port of the classic lab's
// openLogoEditor / confirmLogoPosition (public/jpstudio/index.html), on the SAME
// fabric.js major (5.x). It shows the garment blank fit into the stage (×0.93,
// centered, locked) with the logo draggable / scalable / rotatable on top, and
// flattens to a composite at the blank's NATURAL resolution using the exact
// stage→natural mapping the classic tool uses — so what you place is pixel-for-
// pixel what bakes. Imperative handle exposes applyPreset() (auto-placement) and
// flatten() (the composite PNG) to the lab shell.

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { fabric } from 'fabric';

const FIT = 0.93;                 // classic blankImg fit factor
const DEFAULT_LOGO = 0.28;        // classic default logo scale (min(w,h)/max(logo)) ×0.28

const loadFabricImage = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  fabric.Image.fromURL(src, (img) => resolve(img || null), { crossOrigin: 'anonymous' });
});

const loadHtmlImage = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => resolve(im);
  im.onerror = () => resolve(null);
  im.src = src;
});

// The exact confirmLogoPosition composite: map the logo from stage coords to the
// blank's natural pixels (sX = naturalW / displayW), rotate about its center,
// draw onto the full-res blank. Returns a PNG data URL (or the bare blank).
async function compositeNatural(blankSrc, logoSrc, blankObj, logoObj) {
  const blankNative = await loadHtmlImage(blankSrc);
  if (!blankNative) return null;
  const bW = blankNative.naturalWidth, bH = blankNative.naturalHeight;
  const displayW = blankObj ? blankObj.getScaledWidth() : bW;
  const displayH = blankObj ? blankObj.getScaledHeight() : bH;
  const originX = blankObj ? blankObj.left : 0;
  const originY = blankObj ? blankObj.top : 0;
  const sX = bW / displayW, sY = bH / displayH;
  const off = document.createElement('canvas');
  off.width = bW; off.height = bH;
  const ctx = off.getContext('2d');
  ctx.drawImage(blankNative, 0, 0, bW, bH);
  const logoNative = await loadHtmlImage(logoSrc);
  if (logoNative && logoObj) {
    const lx = (logoObj.left - originX) * sX, ly = (logoObj.top - originY) * sY;
    const lw = logoObj.getScaledWidth() * sX, lh = logoObj.getScaledHeight() * sY;
    const angle = (logoObj.angle || 0) * Math.PI / 180;
    const cx = lx + lw / 2, cy = ly + lh / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.drawImage(logoNative, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();
  }
  try { return off.toDataURL('image/png'); } catch (_) { return null; }
}

const MockupCanvas = forwardRef(function MockupCanvas(
  { blankSrc, logoSrc, pos, width = 620, height = 500, onChange }, ref,
) {
  const elRef = useRef(null);
  const fcRef = useRef(null);
  const blankRef = useRef(null);
  const logoRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emit = () => {
    const lg = logoRef.current;
    if (lg && onChangeRef.current) {
      onChangeRef.current({ x: lg.left, y: lg.top, w: lg.scaleX, h: lg.scaleY, angle: lg.angle || 0 });
    }
  };

  // Init the fabric canvas once.
  useEffect(() => {
    const fc = new fabric.Canvas(elRef.current, { backgroundColor: '#1c1c1c', preserveObjectStacking: true });
    fc.setWidth(width); fc.setHeight(height);
    fc.on('object:modified', emit);
    fcRef.current = fc;
    return () => { try { fc.dispose(); } catch (_) { /* already gone */ } fcRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load / swap the blank (fit ×0.93, centered, locked; kept at the bottom).
  useEffect(() => {
    let live = true;
    (async () => {
      const fc = fcRef.current; if (!fc) return;
      if (blankRef.current) { fc.remove(blankRef.current); blankRef.current = null; }
      const img = await loadFabricImage(blankSrc);
      if (!live || !fcRef.current) return;
      if (img) {
        const scale = Math.min(width / img.width, height / img.height) * FIT;
        img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false });
        fc.centerObject(img);
        fc.add(img);
        if (typeof img.moveTo === 'function') img.moveTo(0);  // behind the logo
        blankRef.current = img;
      }
      fc.requestRenderAll();
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blankSrc, width, height]);

  // Load / swap the logo (saved placement, else default-centered). `pos` is read
  // only when the logo first loads — re-applying it every render would fight the
  // owner's drag.
  useEffect(() => {
    let live = true;
    (async () => {
      const fc = fcRef.current; if (!fc) return;
      if (logoRef.current) { fc.remove(logoRef.current); logoRef.current = null; }
      const img = await loadFabricImage(logoSrc);
      if (!live || !fcRef.current) return;
      if (img) {
        if (pos && pos.x != null) {
          img.set({ left: pos.x, top: pos.y, scaleX: pos.w, scaleY: pos.h, angle: pos.angle || 0 });
        } else {
          const def = (Math.min(width, height) / Math.max(img.width, img.height)) * DEFAULT_LOGO;
          img.set({ scaleX: def, scaleY: def });
          fc.centerObject(img);
        }
        img.set({ lockUniScaling: true });
        fc.add(img);
        fc.setActiveObject(img);
        logoRef.current = img;
        emit();
      }
      fc.requestRenderAll();
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoSrc]);

  useImperativeHandle(ref, () => ({
    // Drop the logo on a print-area preset (percent of the blank bounds), the
    // same geometry as the classic applyPreset.
    applyPreset(preset) {
      const fc = fcRef.current, blank = blankRef.current, logo = logoRef.current;
      if (!fc || !blank || !logo || !preset) return;
      const bL = blank.left, bT = blank.top;
      const bW = blank.getScaledWidth(), bH = blank.getScaledHeight();
      const targetW = bW * (preset.wPct || 0.3);
      const lScale = targetW / logo.width;
      logo.set({ angle: 0, scaleX: lScale, scaleY: lScale });
      const w = logo.getScaledWidth(), h = logo.getScaledHeight();
      logo.set({ left: bL + bW * (preset.xPct || 0.5) - w / 2, top: bT + bH * (preset.yPct || 0.4) - h / 2 });
      logo.setCoords();
      fc.setActiveObject(logo);
      fc.requestRenderAll();
      emit();
    },
    nudge(dx, dy) {
      const logo = logoRef.current, fc = fcRef.current;
      if (!logo || !fc) return;
      logo.set({ left: logo.left + dx, top: logo.top + dy });
      logo.setCoords(); fc.requestRenderAll(); emit();
    },
    setRotation(angle) {
      const logo = logoRef.current, fc = fcRef.current;
      if (!logo || !fc) return;
      logo.set({ angle }); logo.setCoords(); fc.requestRenderAll(); emit();
    },
    // Flatten to a composite PNG at the blank's natural resolution.
    flatten() {
      return compositeNatural(blankSrc, logoSrc, blankRef.current, logoRef.current);
    },
  }));

  return <canvas ref={elRef} width={width} height={height} />;
});

export default MockupCanvas;
