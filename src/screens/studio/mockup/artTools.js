// src/screens/studio/mockup/artTools.js
//
// Pixel tools for the lab's artwork: conservative solid-background removal and
// the classic swap-ink recolor (screen print). Pure canvas math, no deps.

const load = (src) => new Promise((res, rej) => {
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => res(im); im.onerror = () => rej(new Error('image load failed')); im.src = src;
});

const toCanvas = (img) => {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  return { c, x };
};

const dist2 = (r1, g1, b1, r2, g2, b2) => { const dr = r1 - r2, dg = g1 - g2, db = b1 - b2; return dr * dr + dg * dg + db * db; };
const hexToRgb = (h) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
  if (!m) return null;
  let s = m[1]; if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const i = parseInt(s, 16); return [(i >> 16) & 255, (i >> 8) & 255, i & 255];
};

// Detect a solid background CONSERVATIVELY: sample the 4 corners + edge
// midpoints; confident only when ≥7 of 8 samples are opaque and agree within a
// tight tolerance. Returns { confident, bg:[r,g,b] } — the "Remove background"
// button only appears when confident, so the feature can't half-work.
export async function detectSolidBg(src) {
  let img; try { img = await load(src); } catch (_) { return { confident: false }; }
  const { c, x } = toCanvas(img);
  let d; try { d = x.getImageData(0, 0, c.width, c.height).data; } catch (_) { return { confident: false }; }
  const w = c.width, h = c.height;
  const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [w >> 1, h - 1], [0, h >> 1], [w - 1, h >> 1]];
  const px = pts.map(([px_, py]) => { const i = (py * w + px_) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; });
  const opaque = px.filter((p) => p[3] > 200);
  if (opaque.length < 7) return { confident: false };            // already transparent-ish
  const [r0, g0, b0] = opaque[0];
  const agree = opaque.filter((p) => dist2(p[0], p[1], p[2], r0, g0, b0) <= 30 * 30);
  if (agree.length < 7) return { confident: false };
  const avg = agree.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => Math.round(v / agree.length));
  return { confident: true, bg: avg };
}

// Remove a detected solid background: pixels within `tol` of the bg go fully
// transparent; a soft band above tol feathers alpha so edges stay clean.
export async function removeBackground(src, bg, tol = 40) {
  const img = await load(src);
  const { c, x } = toCanvas(img);
  const id = x.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const t2 = tol * tol, soft2 = (tol * 1.6) * (tol * 1.6);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const ds = dist2(d[i], d[i + 1], d[i + 2], bg[0], bg[1], bg[2]);
    if (ds <= t2) d[i + 3] = 0;
    else if (ds <= soft2) {
      const f = (ds - t2) / (soft2 - t2);                       // 0 at tol → 1 at soft edge
      d[i + 3] = Math.min(d[i + 3], Math.round(d[i + 3] * f));
    }
  }
  x.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}

// The classic swap-ink recolor (screen print): every pixel within the classic
// merge tolerance of `fromHex` becomes `toHex`, alpha preserved (so anti-aliased
// edges keep their softness). Returns { url, changed }.
export async function recolorInk(src, fromHex, toHex, tol = 18) {
  const from = hexToRgb(fromHex), to = hexToRgb(toHex);
  if (!from || !to) return { url: src, changed: 0 };
  const img = await load(src);
  const { c, x } = toCanvas(img);
  const id = x.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const t2 = tol * tol; let changed = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 24) continue;
    if (dist2(d[i], d[i + 1], d[i + 2], from[0], from[1], from[2]) <= t2) {
      d[i] = to[0]; d[i + 1] = to[1]; d[i + 2] = to[2]; changed++;
    }
  }
  if (!changed) return { url: src, changed: 0 };
  x.putImageData(id, 0, 0);
  return { url: c.toDataURL('image/png'), changed };
}

// Tiny FNV-1a over a string — the version-history dedup hash (classic parity).
export function fnvHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(36);
}
