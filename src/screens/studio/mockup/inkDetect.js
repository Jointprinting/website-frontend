// src/screens/studio/mockup/inkDetect.js
//
// The classic lab's ink-color detection, ported verbatim (index.html
// _inkQuantize / _inkMerge / analyzeArtwork, L3616-3685). Scans an artwork for
// its real screen-print ink colors: skips the transparent background and anti-
// aliased edges, clusters flat colors (plain RGB distance² — a luma weighting
// under-separated cream vs white), caps the palette, and flags photographic /
// too-complex art instead of dumping hundreds of near-identical colors.

export const INK = { scanMax: 300, tol: 18, mergeTol: 18, minCoverage: 0.0035, maxInks: 12, hardCap: 80 };

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const inkRgbToHex = (r, g, b) => (`#${hex2(r)}${hex2(g)}${hex2(b)}`).toUpperCase();

const dist2 = (a, r, g, b) => { const dr = a.r - r, dg = a.g - g, db = a.b - b; return dr * dr + dg * dg + db * db; };

function quantize(data, o) {
  const tol2 = o.tol * o.tol, clusters = [], bins = new Map();
  let inked = 0, overflow = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 24) continue;                  // transparent / near-transparent ≠ ink
    const r = data[i], g = data[i + 1], b = data[i + 2]; inked++;
    const bk = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    bins.set(bk, (bins.get(bk) || 0) + 1);
    let best = -1, bestD = Infinity;
    for (let c = 0; c < clusters.length; c++) { const d = dist2(clusters[c], r, g, b); if (d < bestD) { bestD = d; best = c; } }
    if (best >= 0 && bestD <= tol2) {
      const cl = clusters[best];
      cl.sr += r; cl.sg += g; cl.sb += b; cl.n++;
      cl.r = cl.sr / cl.n; cl.g = cl.sg / cl.n; cl.b = cl.sb / cl.n;
    } else if (clusters.length < o.hardCap) {
      clusters.push({ r, g, b, sr: r, sg: g, sb: b, n: 1 });
    } else {
      overflow = true;
      if (best >= 0) { const cl = clusters[best]; cl.sr += r; cl.sg += g; cl.sb += b; cl.n++; }
    }
  }
  const floor = Math.max(1, inked * 0.004); let sigBins = 0;   // distinct color regions ≥0.4%
  for (const n of bins.values()) if (n >= floor) sigBins++;
  return { clusters, inked, overflow, sigBins };
}

function merge(clusters, mergeTol) {
  const t2 = mergeTol * mergeTol; let m = true;
  while (m) {
    m = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (dist2(clusters[i], clusters[j].r, clusters[j].g, clusters[j].b) <= t2) {
          const A = clusters[i], B = clusters[j], n = A.n + B.n;
          A.r = (A.r * A.n + B.r * B.n) / n; A.g = (A.g * A.n + B.g * B.n) / n; A.b = (A.b * A.n + B.b * B.n) / n; A.n = n;
          clusters.splice(j, 1); m = true; j--;
        }
      }
    }
  }
  return clusters;
}

const loadImg = (src) => new Promise((res, rej) => {
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => res(im);
  im.onerror = () => rej(new Error('image load failed'));
  im.src = src;
});

// Analyze an artwork (data URL or same-origin/CORS-ok URL) →
// { colors:[{hex,rgb,coverage}], inked, overflow, sigBins, isComplex } or {error}.
export async function analyzeArtwork(src) {
  if (!src) return null;
  let img;
  try { img = await loadImg(src); } catch (e) { return { error: 'could not load the artwork' }; }
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) return null;
  const scale = Math.min(1, INK.scanMax / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = false;                 // nearest-neighbor: keep flat inks flat
  cx.clearRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
  let id;
  try { id = cx.getImageData(0, 0, w, h); } catch (e) { return { error: 'pixels unreadable' }; }
  const q = quantize(id.data, INK);
  merge(q.clusters, INK.mergeTol);
  const sig = q.clusters
    .map((c) => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), n: c.n, coverage: c.n / Math.max(1, q.inked) }))
    .filter((c) => c.coverage >= INK.minCoverage)
    .sort((a, b) => b.n - a.n);
  return {
    colors: sig.map((c) => ({ hex: inkRgbToHex(c.r, c.g, c.b), rgb: [c.r, c.g, c.b], coverage: c.coverage })),
    inked: q.inked, overflow: q.overflow, sigBins: q.sigBins,
    isComplex: q.overflow || sig.length > INK.maxInks || q.sigBins > INK.maxInks,
  };
}

// Screen-print gate — matches the classic _sideIsScreenPrint: auto ink counting
// applies when the side's print type is empty or mentions "screen".
export const isScreenPrintType = (type) => !type || /screen/i.test(String(type));
