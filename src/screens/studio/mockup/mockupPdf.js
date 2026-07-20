// src/screens/studio/mockup/mockupPdf.js
//
// Mockup Lab v2 — the branded PDF export. A faithful port of the legacy /jpstudio
// exportPdf pipeline (renderTemplate1 = front+back two-up, renderTemplate2 =
// front-only), so a mockup Nate exports from the new in-Studio editor is
// pixel-for-pixel the sheet he already sends clients: JP mark + site/insta in the
// header, the green accent bar, print specs, logo art, colour swatches, and the
// "INNOVATION IN INK · Mockup #…" footer.
//
// Input is the SAME flat `pageState` array the storage format uses (what
// mockupToLibraryItem emits via pageToState) — frontCompositeBase64 / printFront /
// frontColors / title / mockupNum / template … — so the export reads exactly what
// gets saved. `pdf-lib` is imported DYNAMICALLY: it (and the ~15KB brand marks)
// never touch the main bundle; they load only when Export PDF is pressed.

import { JP_LOGO_B64, JP_GLOBE_B64, JP_INSTA_B64 } from './brandAssets';

const PAGE_WIDTH = 720;
const PAGE_HEIGHT = 1080;
// Placeholder borders for missing images — the lab's "Borders" toggle. Module
// state set per-build (the classic showPrintPreview flag).
let SHOW_PLACEHOLDER = true;

const hexToRgb = (rgb, hex) => {
  let h = String(hex || '').replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return rgb(
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  );
};

async function b64ToBytes(b64) {
  const r = await fetch(b64);
  return r.arrayBuffer();
}

async function embedImg(pdfDoc, b64) {
  if (!b64) return null;
  try {
    const bytes = await b64ToBytes(b64);
    const isPng = b64.startsWith('data:image/png');
    try { return isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes); }
    catch (e) {
      try { return await pdfDoc.embedPng(bytes); }
      catch (e2) { try { return await pdfDoc.embedJpg(bytes); } catch (e3) { return null; } }
    }
  } catch (e) { return null; }
}

function drawPlaceholder(rgb, page, x, y, w, h, label, font) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.5 });
  if (label && font) {
    const fs = 14;
    page.drawText(label, { x: x + w / 2 - font.widthOfTextAtSize(label, fs) / 2, y: y + h / 2 - fs / 2, size: fs, font, color: rgb(0.7, 0.7, 0.7) });
  }
}

const normalizeColors = (arr) => (arr || []).map((c) => (typeof c === 'object' ? c : { hex: c, name: '' }));
function buildCaption(print) {
  const p = print || {};
  const l = [];
  if (p.type) l.push('Type: ' + p.type);
  if (p.dims) l.push('Dims: ' + p.dims);
  if (p.loc) l.push('Location: ' + p.loc);
  return l;
}

function drawColorCircles(rgb, page, startX, startY, colors, radius, font, maxX) {
  if (!colors || !colors.length) return;
  const step = radius * 2.8;
  const containerW = maxX - startX;
  const perRow = Math.max(1, Math.floor((containerW + (step - radius * 2)) / step));
  const rows = [];
  for (let i = 0; i < colors.length; i += perRow) rows.push(colors.slice(i, i + perRow));
  const anyName = colors.some((c) => ((typeof c === 'object' ? c.name : '') || '').trim().length > 0);
  const rowGap = radius * 2 + (anyName ? 14 : 0) + 10;
  let cy = startY;
  for (const row of rows) {
    const rowSpan = (row.length - 1) * step + radius * 2;
    let cx = startX + (containerW - rowSpan) / 2 + radius;
    for (const c of row) {
      const hex = typeof c === 'object' ? c.hex : c;
      const name = typeof c === 'object' ? c.name : '';
      if (!hex) { cx += step; continue; }
      try {
        const col = hexToRgb(rgb, hex);
        const lum = 0.2126 * col.red + 0.7152 * col.green + 0.0722 * col.blue;
        const isWhite = hex.replace('#', '').toLowerCase() === 'ffffff';
        const borderCol = isWhite ? rgb(0.7, 0.7, 0.7) : col;
        page.drawCircle({ x: cx, y: cy, size: radius, color: col, borderWidth: isWhite ? 1 : 0.5, borderColor: borderCol });
        const hexLabel = '#' + hex.replace('#', '').toUpperCase();
        const hfs = Math.max(6, Math.round(radius * 0.46));
        const htw = font.widthOfTextAtSize(hexLabel, hfs);
        page.drawText(hexLabel, { x: cx - htw / 2, y: cy - hfs / 2, size: hfs, font, color: lum < 0.5 ? rgb(0.95, 0.95, 0.95) : rgb(0.12, 0.12, 0.12) });
        if (name && name.trim()) {
          const nfs = Math.max(7.5, Math.round(radius * 0.62));
          const ntw = font.widthOfTextAtSize(name.trim(), nfs);
          page.drawText(name.trim(), { x: cx - ntw / 2, y: cy - radius - nfs - 3, size: nfs, font, color: rgb(0.22, 0.22, 0.22) });
        }
      } catch (e) { /* skip a bad swatch */ }
      cx += step;
    }
    cy -= rowGap;
  }
}

// ── Template 1 — front + back two-up (the default sheet) ─────────────────────
async function renderTemplate1(lib, pdfDoc, page, pg) {
  const { rgb, StandardFonts } = lib;
  const mS = 32;
  const titleFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const captFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });

  const HDR = 62;
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - HDR, width: PAGE_WIDTH, height: HDR, color: rgb(0.98, 0.99, 0.97) });
  page.drawLine({ start: { x: 0, y: PAGE_HEIGHT - HDR }, end: { x: PAGE_WIDTH, y: PAGE_HEIGHT - HDR }, thickness: 1, color: rgb(0.88, 0.88, 0.88) });

  const ji = await embedImg(pdfDoc, JP_LOGO_B64);
  if (ji) {
    const maxW = 110, maxH = HDR - 22;
    const s = ji.scale(1);
    const sc = Math.min(maxW / s.width, maxH / s.height, 1);
    const lw = s.width * sc, lh = s.height * sc;
    page.drawImage(ji, { x: mS, y: PAGE_HEIGHT - HDR + (HDR - lh) / 2, width: lw, height: lh });
  }
  const icS = 12, txtFs = 9;
  const rightX = PAGE_WIDTH - mS;
  const line1Y = PAGE_HEIGHT - HDR + (HDR / 2) + 5;
  const line2Y = line1Y - icS - 4;
  const siteStr = 'www.jointprinting.com';
  const instaStr = '@jointprinting';
  const siteW = boldFont.widthOfTextAtSize(siteStr, txtFs);
  const instaW = titleFont.widthOfTextAtSize(instaStr, txtFs);
  const gi = await embedImg(pdfDoc, JP_GLOBE_B64);
  if (gi) page.drawImage(gi, { x: rightX - siteW - icS - 4, y: line1Y, width: icS, height: icS });
  page.drawText(siteStr, { x: rightX - siteW, y: line1Y + 1, size: txtFs, font: boldFont, color: rgb(0.18, 0.45, 0.08) });
  const ii = await embedImg(pdfDoc, JP_INSTA_B64);
  if (ii) page.drawImage(ii, { x: rightX - instaW - icS - 4, y: line2Y, width: icS, height: icS });
  page.drawText(instaStr, { x: rightX - instaW, y: line2Y + 1, size: txtFs, font: titleFont, color: rgb(0.35, 0.35, 0.35) });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 3, width: PAGE_WIDTH, height: 3, color: rgb(0.45, 0.78, 0.18) });

  const titleGap = 18;
  const tBaseY = PAGE_HEIGHT - HDR - titleGap;
  if (pg.title) {
    const titleStr = pg.title.length > 36 ? pg.title.slice(0, 35) + '…' : pg.title;
    page.drawText(titleStr, { x: mS, y: tBaseY, size: 22, font: boldFont, color: rgb(0.08, 0.08, 0.08) });
  }
  if (pg.subtitle) {
    const subStr = pg.subtitle.length > 52 ? pg.subtitle.slice(0, 51) + '…' : pg.subtitle;
    page.drawText(subStr, { x: mS, y: tBaseY - 22, size: 11, font: titleFont, color: rgb(0.4, 0.4, 0.4) });
  }

  const titleBottom = tBaseY - (pg.subtitle ? 22 + 13 : 0) - 6;
  const avail = titleBottom - 110;
  const imgH = Math.min(avail * 0.62, 320);
  const imgW = imgH * 0.82;
  const gap = (PAGE_WIDTH - mS * 2 - imgW * 2);
  const frontX = mS, backX = mS + imgW + gap;
  const imgY = titleBottom - 14 - imgH;
  const frontSrc = pg.frontCompositeBase64 || pg.frontBlankBase64;
  if (frontSrc) { const img = await embedImg(pdfDoc, frontSrc); if (img) page.drawImage(img, { x: frontX, y: imgY, width: imgW, height: imgH }); else if (SHOW_PLACEHOLDER) drawPlaceholder(rgb, page, frontX, imgY, imgW, imgH, 'FRONT', boldFont); }
  else if (SHOW_PLACEHOLDER) drawPlaceholder(rgb, page, frontX, imgY, imgW, imgH, 'FRONT', boldFont);
  const backSrc = pg.backCompositeBase64 || pg.backBlankBase64;
  if (backSrc) { const img = await embedImg(pdfDoc, backSrc); if (img) page.drawImage(img, { x: backX, y: imgY, width: imgW, height: imgH }); else if (SHOW_PLACEHOLDER) drawPlaceholder(rgb, page, backX, imgY, imgW, imgH, 'BACK', boldFont); }
  else if (SHOW_PLACEHOLDER) drawPlaceholder(rgb, page, backX, imgY, imgW, imgH, 'BACK', boldFont);

  const divY = imgY - 14;
  page.drawLine({ start: { x: mS, y: divY }, end: { x: PAGE_WIDTH - mS, y: divY }, thickness: 0.6, color: rgb(0.82, 0.82, 0.82) });

  let specY = divY - 14;
  const capFs = 10, capLH = 15;
  const labelCol = rgb(0.22, 0.22, 0.22);
  const valueCol = rgb(0.4, 0.4, 0.4);
  const fc = buildCaption(pg.printFront), bc = buildCaption(pg.printBack);
  if (fc.length) {
    page.drawText('FRONT PRINT', { x: frontX, y: specY, size: 7, font: boldFont, color: rgb(0.55, 0.7, 0.4) });
    let sy = specY - 11;
    for (const s of fc) { page.drawText(s, { x: frontX, y: sy, size: capFs, font: captFont, color: labelCol }); sy -= capLH; }
  }
  if (bc.length) {
    page.drawText('BACK PRINT', { x: backX, y: specY, size: 7, font: boldFont, color: rgb(0.55, 0.7, 0.4) });
    let sy = specY - 11;
    for (const s of bc) { page.drawText(s, { x: backX, y: sy, size: capFs, font: captFont, color: valueCol }); sy -= capLH; }
  }

  const maxSpecLines = Math.max(fc.length || 0, bc.length || 0);
  const logoAreaY = (fc.length || bc.length) ? specY - 14 - (maxSpecLines * capLH) - 10 : specY - 14;
  const boxSize = Math.min(imgW * 0.62, 170);
  const frontLogoX = frontX + imgW / 2 - boxSize / 2;
  const backLogoX = backX + imgW / 2 - boxSize / 2;
  if (pg.frontLogoBase64) { const li = await embedImg(pdfDoc, pg.frontLogoBase64); if (li) page.drawImage(li, { x: frontLogoX, y: logoAreaY - boxSize, width: boxSize, height: boxSize }); }
  if (pg.backLogoBase64) { const li = await embedImg(pdfDoc, pg.backLogoBase64); if (li) page.drawImage(li, { x: backLogoX, y: logoAreaY - boxSize, width: boxSize, height: boxSize }); }

  const fColors = normalizeColors(pg.frontColors), bColors = normalizeColors(pg.backColors);
  const swatchY = (pg.frontLogoBase64 || pg.backLogoBase64) ? logoAreaY - boxSize - 18 : logoAreaY - 16;
  if (fColors.length) {
    page.drawText('COLORS', { x: frontX, y: swatchY, size: 7, font: boldFont, color: rgb(0.55, 0.7, 0.4) });
    drawColorCircles(rgb, page, frontX, swatchY - 16, fColors, 14, captFont, frontX + imgW);
  }
  if (bColors.length) {
    page.drawText('COLORS', { x: backX, y: swatchY, size: 7, font: boldFont, color: rgb(0.55, 0.7, 0.4) });
    drawColorCircles(rgb, page, backX, swatchY - 16, bColors, 14, captFont, backX + imgW);
  }

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 38, color: rgb(0.05, 0.05, 0.07) });
  page.drawRectangle({ x: 0, y: 38, width: PAGE_WIDTH, height: 1, color: rgb(0.15, 0.15, 0.18) });
  page.drawText('INNOVATION IN INK', { x: mS, y: 13, size: 10, font: boldFont, color: rgb(0.5, 0.73, 0.28) });
  const mn = 'Mockup ' + (pg.mockupNum || '');
  const mW = titleFont.widthOfTextAtSize(mn, 9);
  page.drawText(mn, { x: PAGE_WIDTH - mS - mW, y: 13, size: 9, font: titleFont, color: rgb(0.55, 0.55, 0.6) });
}

// ── Template 2 — front only (single large garment) ──────────────────────────
async function renderTemplate2(lib, pdfDoc, page, pg) {
  const { rgb, StandardFonts } = lib;
  const mS = 40;
  const titleFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const captFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
  const HDR = 68;
  const ji = await embedImg(pdfDoc, JP_LOGO_B64);
  if (ji) { const maxW = 150, maxH = HDR - 16; const s = ji.scale(1); const sc = Math.min(maxW / s.width, maxH / s.height, 1); const lw = s.width * sc, lh = s.height * sc; page.drawImage(ji, { x: mS, y: PAGE_HEIGHT - HDR + (HDR - lh) / 2, width: lw, height: lh }); }
  const icS = 14, txtFs = 9.5, rightX = PAGE_WIDTH - mS;
  const line1Y = PAGE_HEIGHT - HDR + (HDR / 2) + 4; const line2Y = line1Y - icS - 3;
  const siteStr = 'www.jointprinting.com'; const instaStr = '@jointprinting';
  const siteW = boldFont.widthOfTextAtSize(siteStr, txtFs); const instaW = boldFont.widthOfTextAtSize(instaStr, txtFs);
  const gi = await embedImg(pdfDoc, JP_GLOBE_B64);
  if (gi) page.drawImage(gi, { x: rightX - siteW - icS - 5, y: line1Y - 1, width: icS, height: icS });
  page.drawText(siteStr, { x: rightX - siteW, y: line1Y, size: txtFs, font: boldFont, color: rgb(0.15, 0.36, 0.08) });
  const ii = await embedImg(pdfDoc, JP_INSTA_B64);
  if (ii) page.drawImage(ii, { x: rightX - instaW - icS - 5, y: line2Y - 1, width: icS, height: icS });
  page.drawText(instaStr, { x: rightX - instaW, y: line2Y, size: txtFs, font: titleFont, color: rgb(0.28, 0.28, 0.28) });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 3, width: PAGE_WIDTH, height: 3, color: rgb(0.45, 0.78, 0.18) });

  const titlePad = 14;
  const tBaseY = PAGE_HEIGHT - HDR - titlePad;
  if (pg.title) page.drawText(pg.title, { x: mS, y: tBaseY, size: 30, font: boldFont, color: rgb(0.08, 0.08, 0.08) });
  if (pg.subtitle) page.drawText(pg.subtitle, { x: mS, y: tBaseY - 26, size: 15, font: titleFont, color: rgb(0.4, 0.4, 0.4) });
  const titleBottom = tBaseY - (pg.subtitle ? 26 + 15 : 0);
  const imgW = PAGE_WIDTH * 0.5, imgH = Math.min(imgW * 1.2, titleBottom - 80), imgX = (PAGE_WIDTH - imgW) / 2;
  const imgY = titleBottom - 20 - imgH;
  const src = pg.frontCompositeBase64 || pg.frontBlankBase64;
  if (src) { const img = await embedImg(pdfDoc, src); if (img) page.drawImage(img, { x: imgX, y: imgY, width: imgW, height: imgH }); else if (SHOW_PLACEHOLDER) drawPlaceholder(rgb, page, imgX, imgY, imgW, imgH, 'GARMENT', boldFont); }
  else if (SHOW_PLACEHOLDER) drawPlaceholder(rgb, page, imgX, imgY, imgW, imgH, 'GARMENT', boldFont);
  const divY = imgY - 12;
  page.drawLine({ start: { x: mS, y: divY }, end: { x: PAGE_WIDTH - mS, y: divY }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  let specY = divY - 16;
  const cap = buildCaption(pg.printFront);
  if (cap.length) { for (const s of cap) { page.drawText(s, { x: mS, y: specY, size: 11, font: captFont, color: rgb(0.22, 0.22, 0.22) }); specY -= 16; } }

  const fColors = normalizeColors(pg.frontColors);
  const FOOTER_H = 40;
  const padBelowSpecs = 14;
  const padAroundColors = 18;
  const colorsHeight = fColors.length ? 44 : 0;
  const availV = (specY - padBelowSpecs) - (FOOTER_H + 20) - colorsHeight - padAroundColors;
  const lbW = Math.max(120, Math.min(availV, PAGE_WIDTH * 0.46, 300));
  const lbX = (PAGE_WIDTH - lbW) / 2;
  const logoY = specY - padBelowSpecs - lbW;
  if (pg.frontLogoBase64) { const li = await embedImg(pdfDoc, pg.frontLogoBase64); if (li) page.drawImage(li, { x: lbX, y: logoY, width: lbW, height: lbW }); }
  if (fColors.length) drawColorCircles(rgb, page, mS, logoY - padAroundColors, fColors, 15, captFont, PAGE_WIDTH - mS);

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 40, color: rgb(0.06, 0.06, 0.06) });
  page.drawText('INNOVATION IN INK', { x: mS, y: 13, size: 11, font: boldFont, color: rgb(0.55, 0.7, 0.42) });
  const mn = 'Mockup ' + (pg.mockupNum || '');
  const mW = titleFont.widthOfTextAtSize(mn, 10);
  page.drawText(mn, { x: PAGE_WIDTH - mS - mW, y: 13, size: 10, font: titleFont, color: rgb(0.62, 0.62, 0.62) });
}

// Build the PDF bytes from an array of legacy pageState objects.
export async function buildMockupPdfBytes(pageStates, opts) {
  SHOW_PLACEHOLDER = !opts || opts.placeholders !== false;
  const lib = await import('pdf-lib');
  const { PDFDocument } = lib;
  const pdfDoc = await PDFDocument.create();
  const pages = (pageStates || []).length ? pageStates : [{}];
  for (const pg of pages) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if ((pg.template != null ? pg.template : 1) === 1) await renderTemplate1(lib, pdfDoc, page, pg || {});
    else await renderTemplate2(lib, pdfDoc, page, pg || {});
  }
  return pdfDoc.save();
}

// Build the PDF and trigger a browser download. `filename` defaults to the mockup
// number ("000150A.pdf"), matching the legacy pdfName.
export async function exportMockupPdf(pageStates, filename, opts) {
  const bytes = await buildMockupPdfBytes(pageStates, opts);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'mockup.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
