// src/screens/studio/RoadTripTab.js — the FIELD MAP
//
// Nationwide dispensary prospecting map. How it works:
//
//   - Pins come from OUR database (GET /api/roadtrip/dispensaries?bbox=…) —
//     licensed rec dispensaries seeded from state rosters, PLUS stores found
//     free via OpenStreetMap. Panning both reads the DB (instant) AND fires a
//     free OSM sweep of the viewport (POST …/scan-osm) that fills in any new
//     stores — so dispensaries just appear as you drive the map. ZERO paid
//     API: no Google Places, no per-store enrichment, no manual state loading.
//   - Rendering is a clustered GeoJSON source (native circles), not HTML
//     markers — thousands of pins stay smooth. Pin color = status (fresh /
//     in-CRM / customer / visited / dead). Chains never render (owner
//     decision — too hard to pitch; excluded server-side). AUDIENCE clickers
//     pick the markets: rec / med / hemp-THC (mirrors dispensaryStates).
//   - TODAY'S RUN is the day plan: search the city → ADD ALL IN VIEW (or tap
//     pins one at a time) → reorder with ▲▼ or OPTIMIZE (from your location)
//     → GO opens Google Maps. Runs over 10 stops split into consecutive legs
//     (Google's hard cap).
//   - CRM capture happens through the run: marking a stop "pitched" upserts
//     the real CRM company (leadSource "Field Visit", visit logged); the run
//     tray's + TO-DO writes a next-action so it lands in the CRM Today queue.
//   - CRM state flows back onto the map: pins know their company's stage.
//
// Shared pure logic (gmaps leg chunking, key derivation, pin status) lives
// in ./_roadTrip.js with tests.

import * as React from 'react';
import axios from 'axios';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import config from '../../config.json';
import { lsGet, lsSet } from '../../common/jpStorage';
import { queuedRequest } from '../../common/offlineSync';
import {
  deriveCompanyKey, TODO_CHIPS, OUTCOME_CHIPS, SEGMENTS, INTEREST_LABELS,
  haversineMi, fmtMi, buildGmapsLegs, PIN_STATUS, pinStatusOf,
} from './_roadTrip';

// ─────────────────────────────────────────────────────────────────────────────
// Terminal palette (the Field Map's own skin — deliberately distinct from the
// rest of the Studio)
// ─────────────────────────────────────────────────────────────────────────────
const TERM = {
  bg:       '#05080a',
  panel:    '#0a0e10',
  border:   '#1a3d2b',
  borderDim:'rgba(74,222,128,0.12)',
  green:    '#4ade80',
  greenDk:  '#1a3d2b',
  amber:    '#fbbf24',
  red:      '#f87171',
  cyan:     '#06b6d4',
  text:     '#d4f4dd',
  muted:    'rgba(212,244,221,0.5)',
  faint:    'rgba(212,244,221,0.18)',
};
const MONO = 'ui-monospace, "JetBrains Mono", "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';
const INITIAL_CENTER = [-74.5, 40.5];
const INITIAL_ZOOM   = 6.8;
const MIN_LOAD_ZOOM  = 5.4; // below this a bbox would cover half the country
const OSM_SCAN_ZOOM  = 9;   // only free-scan OSM once zoomed in enough to be an "area"

const MAP_STYLES = [
  { id: 'dark',      label: 'DARK', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'satellite', label: 'SAT',  url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'streets',   label: 'STR',  url: 'mapbox://styles/mapbox/streets-v12' },
];

const DISP_SRC = 'jp-disp';
const HEAT_SRC = 'jp-heat';
const LAYER_CLUSTERS = 'jp-disp-clusters';
const LAYER_COUNTS   = 'jp-disp-counts';
const LAYER_POINTS   = 'jp-disp-points';
const LAYER_HEAT     = 'jp-heat-layer';

const CUSTOM_TYPE_COLORS = { friend: '#06b6d4', client: '#a855f7', printer: '#f97316', other: '#94a3b8' };
const CUSTOM_TYPE_LABELS = { friend: 'FRIEND', client: 'CLIENT', printer: 'PRINTER', other: 'WAYPOINT' };

// ─────────────────────────────────────────────────────────────────────────────
// Small shared bits
// ─────────────────────────────────────────────────────────────────────────────
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
function truncate(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function tomorrowISO() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

function btnStyle(kind) {
  const base = `
    font-family: ${MONO};
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 6px 10px;
    border-radius: 3px;
    cursor: pointer;
    border: 1px solid;
    background: transparent;
    transition: filter 0.15s ease;
  `;
  if (kind === 'primary') return base + `border-color:${TERM.green};color:${TERM.green};background:rgba(74,222,128,0.06);`;
  if (kind === 'success') return base + `border-color:${TERM.green};color:${TERM.greenDk};background:${TERM.green};cursor:default;`;
  if (kind === 'danger')  return base + `border-color:${TERM.red};color:${TERM.red};background:rgba(248,113,113,0.04);`;
  if (kind === 'amber')   return base + `border-color:${TERM.amber};color:${TERM.amber};background:rgba(251,191,36,0.08);`;
  if (kind === 'cyan')    return base + `border-color:${TERM.cyan};color:${TERM.cyan};background:rgba(6,182,212,0.08);`;
  if (kind === 'neutral') return base + `border-color:${TERM.borderDim};color:${TERM.muted};`;
  return base;
}

function PanelSection({ title, defaultOpen = true, persistKey, children }) {
  const [open, setOpen] = React.useState(() => {
    if (!persistKey) return defaultOpen;
    const v = lsGet(persistKey, null);
    return v == null ? defaultOpen : v === '1';
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (persistKey) lsSet(persistKey, next ? '1' : '0');
  };
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box role="button" tabIndex={0} onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(); }}
        sx={{
          fontFamily: MONO, fontSize: 10, color: TERM.muted,
          letterSpacing: 1.5, mb: 1, cursor: 'pointer', userSelect: 'none',
          display: 'flex', alignItems: 'center', gap: 1,
          '&:hover': { color: TERM.green },
        }}>
        <Box component="span" sx={{
          color: TERM.green, fontSize: 10, transition: 'transform 0.18s ease',
          display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        }}>▼</Box>
        ─── {title} ───
      </Box>
      {open && <Box>{children}</Box>}
    </Box>
  );
}

function MapStyleSwitcher({ current, onChange }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{
      position: 'absolute', top: 12, left: 12, zIndex: 2,
      bgcolor: 'rgba(5,8,10,0.82)', border: `1px solid ${TERM.borderDim}`,
      borderRadius: 0.5, p: 0.5,
    }}>
      {MAP_STYLES.map((s) => {
        const isCurrent = current === s.id;
        return (
          <Box key={s.id} role="button" tabIndex={0}
            onClick={() => onChange(s.id)}
            sx={{
              fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
              px: 1, py: 0.5, cursor: 'pointer', borderRadius: 0.25,
              color: isCurrent ? TERM.green : TERM.muted,
              bgcolor: isCurrent ? 'rgba(74,222,128,0.14)' : 'transparent',
              '&:hover': { color: TERM.green, bgcolor: 'rgba(74,222,128,0.08)' },
              transition: 'all 0.15s ease',
            }}>
            {s.label}
          </Box>
        );
      })}
    </Stack>
  );
}

// Overlay toggle/button chip on the map
const overlayChipSx = (active, color) => ({
  cursor: 'pointer',
  bgcolor: active ? `${color}2e` : 'rgba(5,8,10,0.82)',
  border: `1px solid ${active ? color : TERM.borderDim}`,
  color: active ? color : TERM.muted,
  px: 1.25, py: 0.6, borderRadius: 0.5,
  fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.2,
  display: 'flex', alignItems: 'center', gap: 0.6,
  transition: 'all 0.15s ease',
  '&:hover': { borderColor: color, color },
});

const actionBtnSx = (color, hoverColor) => ({
  fontFamily: MONO, fontSize: 11, fontWeight: 800,
  color, px: { xs: 1, md: 0.5 }, py: 0,
  // Real ~40px touch targets on phones (this is the primary field surface);
  // stays compact at the desktop hover size on md+.
  minWidth: { xs: 40, md: 16 }, minHeight: { xs: 40, md: 'auto' }, cursor: 'pointer',
  borderRadius: 0.25, lineHeight: 1.2,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid transparent',
  '&:hover': { color: hoverColor, borderColor: hoverColor, bgcolor: `${hoverColor}1a` },
});

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${TERM.borderDim}`, borderRadius: 3,
  padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: TERM.text,
  outline: 'none',
};

// ─────────────────────────────────────────────────────────────────────────────
// Popup DOM builders (run outside React — handlers close over live refs)
// ─────────────────────────────────────────────────────────────────────────────

function buildDispPopup({ d, inRun, onAddToRun, onHide, onOpenCrm }) {
  const status = pinStatusOf(d);
  const statusMeta = PIN_STATUS[status];
  const div = document.createElement('div');
  div.style.cssText = `
    font-family: ${MONO};
    color: ${TERM.text};
    background: ${TERM.panel};
    border: 1px solid ${TERM.border};
    border-radius: 4px;
    padding: 12px 14px;
    max-width: min(340px, calc(100vw - 24px));
  `;

  const badges = [];
  const seg = SEGMENTS.find((s) => s.id === d.segment);
  if (seg) badges.push(`<span style="display:inline-block;padding:2px 6px;border:1px solid ${seg.color};color:${seg.color};font-size:9px;font-weight:800;letter-spacing:1px;border-radius:2px;">${seg.label}</span>`);
  if (d.crm) badges.push(`<span data-jp="crm" style="display:inline-block;padding:2px 6px;border:1px solid ${statusMeta.color};color:${statusMeta.color};font-size:9px;font-weight:800;letter-spacing:1px;border-radius:2px;cursor:pointer;">CRM · ${escapeHtml(String(d.crm.stage).toUpperCase())} ↗</span>`);
  if (!d.verified) badges.push(`<span style="display:inline-block;padding:2px 6px;border:1px solid ${TERM.faint};color:${TERM.muted};font-size:9px;font-weight:800;letter-spacing:1px;border-radius:2px;">UNVERIFIED</span>`);
  if (d.verified && d.licenseNumber) badges.push(`<span style="display:inline-block;padding:2px 6px;border:1px solid ${TERM.borderDim};color:${TERM.muted};font-size:9px;font-weight:800;letter-spacing:1px;border-radius:2px;" title="${escapeAttr(d.licenseNumber)}">LICENSED</span>`);

  const lines = [
    `<div style="font-weight:800;font-size:13px;color:${TERM.green};letter-spacing:0.5px;line-height:1.3;">${escapeHtml(d.name)}</div>`,
    badges.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;">${badges.join('')}</div>` : '',
  ];
  if (d.address) lines.push(`<div style="font-size:11px;color:${TERM.muted};margin-top:6px;line-height:1.4;">${escapeHtml(d.address)}</div>`);
  if (d.phone) lines.push(`<div style="font-size:11px;margin-top:4px;">[TEL] <a href="tel:${escapeAttr(d.phone)}" style="color:${TERM.green};text-decoration:none;">${escapeHtml(d.phone)}</a></div>`);
  if (d.website) lines.push(`<div style="font-size:11px;margin-top:2px;"><a href="${escapeAttr(d.website)}" target="_blank" rel="noopener" style="color:${TERM.green};text-decoration:none;">[WEB] ${escapeHtml(truncate(d.website, 38))}</a></div>`);
  if (d.googleMapsUri) lines.push(`<div style="font-size:11px;margin-top:2px;"><a href="${escapeAttr(d.googleMapsUri)}" target="_blank" rel="noopener" style="color:${TERM.green};text-decoration:none;">[MAPS] open in google maps</a></div>`);
  if (d.lastVisitedAt) lines.push(`<div style="font-size:10px;color:${TERM.amber};margin-top:4px;">✓ visited ${new Date(d.lastVisitedAt).toLocaleDateString()}</div>`);

  div.innerHTML = lines.filter(Boolean).join('');

  const crmBadge = div.querySelector('[data-jp="crm"]');
  if (crmBadge && onOpenCrm) crmBadge.addEventListener('click', () => onOpenCrm(d));

  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;';

  const runBtn = document.createElement('button');
  runBtn.textContent = inRun ? '✓ IN RUN' : '＋ ADD TO RUN';
  runBtn.disabled = inRun;
  runBtn.style.cssText = btnStyle(inRun ? 'success' : 'primary');
  runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    runBtn.textContent = 'ADDING…';
    onAddToRun(d)
      .then(() => { runBtn.textContent = '✓ IN RUN'; runBtn.style.cssText = btnStyle('success'); })
      .catch(() => { runBtn.disabled = false; runBtn.textContent = '＋ ADD TO RUN'; });
  });
  row1.appendChild(runBtn);

  const row2 = document.createElement('div');
  row2.style.cssText = 'display:flex;gap:6px;margin-top:6px;';
  const hideBtn = document.createElement('button');
  let hidePending = false;
  let hideTimer = null;
  hideBtn.textContent = '⊘ NOT A DISPENSARY';
  hideBtn.style.cssText = btnStyle('danger');
  hideBtn.addEventListener('click', () => {
    if (!hidePending) {
      hidePending = true;
      hideBtn.textContent = '⚠ CONFIRM?';
      hideBtn.style.cssText = btnStyle('danger') + 'background:rgba(248,113,113,0.18);';
      hideTimer = setTimeout(() => {
        hidePending = false;
        hideBtn.textContent = '⊘ NOT A DISPENSARY';
        hideBtn.style.cssText = btnStyle('danger');
      }, 3000);
    } else {
      clearTimeout(hideTimer);
      onHide(d);
    }
  });
  row2.appendChild(hideBtn);

  div.appendChild(row1);
  div.appendChild(row2);
  return div;
}

function buildCustomMarkerEl(item) {
  const color = CUSTOM_TYPE_COLORS[item.customType] || CUSTOM_TYPE_COLORS.other;
  const wrap = document.createElement('div');
  wrap.className = 'jp-marker-wrap';
  const inner = document.createElement('div');
  inner.style.cssText = `
    position:relative;width:14px;height:14px;cursor:pointer;
    transform:rotate(45deg);
    transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
    background:${color};border:2px solid #05080a;border-radius:2px;
    box-shadow:0 0 0 1px ${color},0 0 8px ${color}80;
  `;
  wrap.addEventListener('mouseenter', () => { inner.style.transform = 'rotate(45deg) scale(1.5)'; });
  wrap.addEventListener('mouseleave', () => { inner.style.transform = 'rotate(45deg) scale(1)'; });
  wrap.appendChild(inner);
  return wrap;
}

function buildCustomStopPopup(item, { inRun, onAddToRun }) {
  const color = CUSTOM_TYPE_COLORS[item.customType] || CUSTOM_TYPE_COLORS.other;
  const typeLabel = CUSTOM_TYPE_LABELS[item.customType] || 'STOP';
  const div = document.createElement('div');
  div.style.cssText = `
    font-family:${MONO};color:${TERM.text};background:${TERM.panel};
    border:1px solid ${color}55;border-left:3px solid ${color};
    border-radius:4px;padding:10px 12px;
    max-width:min(300px,calc(100vw - 24px));
  `;
  const lines = [
    `<div style="font-weight:800;font-size:12px;color:${color};letter-spacing:0.5px;margin-bottom:4px;">${escapeHtml(item.name)}</div>`,
    `<div style="font-size:9.5px;color:${color};letter-spacing:1px;opacity:0.7;margin-bottom:5px;">[${typeLabel}]</div>`,
  ];
  if (item.address) lines.push(`<div style="font-size:11px;color:${TERM.muted};margin-bottom:3px;">${escapeHtml(item.address)}</div>`);
  if (item.phone) lines.push(`<div style="font-size:11px;margin-bottom:2px;">[TEL] <a href="tel:${escapeAttr(item.phone)}" style="color:${color};text-decoration:none;">${escapeHtml(item.phone)}</a></div>`);
  if (item.notes) lines.push(`<div style="font-size:11px;color:${TERM.muted};margin-top:6px;padding-top:6px;border-top:1px solid ${TERM.borderDim};line-height:1.5;">${escapeHtml(item.notes)}</div>`);
  div.innerHTML = lines.join('');

  const btn = document.createElement('button');
  btn.textContent = inRun ? '✓ IN RUN' : '＋ ADD TO RUN';
  btn.disabled = inRun;
  btn.style.cssText = btnStyle(inRun ? 'success' : 'primary') + 'margin-top:8px;';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    onAddToRun(item)
      .then(() => { btn.textContent = '✓ IN RUN'; btn.style.cssText = btnStyle('success') + 'margin-top:8px;'; })
      .catch(() => { btn.disabled = false; });
  });
  div.appendChild(btn);
  return div;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────
export default function RoadTripTab({ token, onNavigate }) {
  const mapContainerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const popupRef = React.useRef(null);

  const [styleId, setStyleId] = React.useState('dark');
  const [mapReady, setMapReady] = React.useState(false);
  const [mapError, setMapError] = React.useState('');
  const [toast, setToast] = React.useState(null);
  const toastTimerRef = React.useRef(null);

  // Dispensaries currently loaded for the viewport
  const [disps, setDisps] = React.useState([]);
  const [loadingArea, setLoadingArea] = React.useState(false);
  const [zoomedOut, setZoomedOut] = React.useState(false);
  const byIdRef = React.useRef(new Map());    // _id -> dispensary

  // Filters. Segment clickers (REC / MED / HEMP-THC) persist across sessions —
  // the owner works one market at a time for days (SEGMENTS mirrors the server
  // vocabulary in services/dispensaryStates.js — keep in sync).
  const [segmentsOn, setSegmentsOn] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('jpfm-segments') || 'null');
      if (Array.isArray(saved) && saved.length) return saved.filter((s) => SEGMENTS.some((x) => x.id === s));
    } catch { /* fall through */ }
    return SEGMENTS.map((s) => s.id);
  });
  const toggleSegment = (id) => setSegmentsOn((prev) => {
    // Never allow zero segments — an empty map reads as broken, not filtered.
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    if (!next.length) return prev;
    try { localStorage.setItem('jpfm-segments', JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [hideVisited, setHideVisited] = React.useState(false);
  const [hideCustomers, setHideCustomers] = React.useState(false);
  const [heatmapOn, setHeatmapOn] = React.useState(false);

  // Today's Run
  const [run, setRun] = React.useState(null);
  const runRef = React.useRef(null);
  const [runMiles, setRunMiles] = React.useState(null);
  const [optimizing, setOptimizing] = React.useState(false);
  const runMarkersRef = React.useRef(new Map());

  // Custom pins (friends / printers / waypoints) — still RoadTripLead docs
  const [customPins, setCustomPins] = React.useState([]);
  const customMarkersRef = React.useRef(new Map());
  const [showAddCustomPin, setShowAddCustomPin] = React.useState(false);
  const [customPinForm, setCustomPinForm] = React.useState({ name: '', address: '', notes: '', customType: 'friend' });

  // TODAY cockpit — how many CRM follow-ups are due today; a read-only glance
  // that deep-links into the CRM queue.
  const [followUps, setFollowUps] = React.useState({ count: 0, loaded: false });

  // TO-DO modal
  const [todoTarget, setTodoTarget] = React.useState(null);
  const [todoForm, setTodoForm] = React.useState({ chipId: 'mockups', note: '', date: tomorrowISO() });

  // CONTACT capture modal — who did I talk to at the counter
  const [contactTarget, setContactTarget] = React.useState(null);
  const [contactForm, setContactForm] = React.useState({ name: '', role: '', phone: '', email: '', interest: 0 });

  // Location
  const [myLoc, setMyLoc] = React.useState(null);
  const myLocRef = React.useRef(null);
  const myLocMarkerRef = React.useRef(null);
  const [locationSearch, setLocationSearch] = React.useState('');
  const [locationResults, setLocationResults] = React.useState([]);
  const [locationSearching, setLocationSearching] = React.useState(false);

  // Mobile — land on TODAY (the day's cockpit), not the raw map.
  const [mobileTab, setMobileTab] = React.useState('today');
  const [outcomeStopId, setOutcomeStopId] = React.useState(null);
  const [pendingDeleteId, setPendingDeleteId] = React.useState(null);
  const pendingDeleteTimerRef = React.useRef(null);

  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const api = config.backendUrl;

  React.useEffect(() => { byIdRef.current = new Map(disps.map((d) => [String(d._id), d])); }, [disps]);
  React.useEffect(() => { runRef.current = run; }, [run]);
  React.useEffect(() => { myLocRef.current = myLoc; }, [myLoc]);

  const showToast = React.useCallback((message, kind = 'info', action = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, kind, action });
    toastTimerRef.current = setTimeout(() => setToast(null), action ? 6000 : 2600);
  }, []);

  // ── Map init ───────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!config.mapboxToken) { setMapError('No Mapbox token configured.'); return; }
    try {
      mapboxgl.accessToken = config.mapboxToken;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLES[0].url,
        center: INITIAL_CENTER, zoom: INITIAL_ZOOM,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      map.on('load', () => setMapReady(true));
      map.on('error', (e) => {
        const msg = e?.error?.message || 'Map error.';
        if (/source|tile/i.test(msg) && /timeout|aborted/i.test(msg)) return;
        if (/glyph/i.test(msg)) return; // non-fatal font hiccup on style swap
        setMapError(msg);
      });
      mapRef.current = map;
    } catch (err) {
      setMapError(err.message || 'Failed to initialize map.');
    }
    return () => {
      try { mapRef.current?.remove(); } catch {}
      mapRef.current = null;
      if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GeoJSON sources + layers (re-added after every style change) ──────────
  const ensureLayers = React.useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getSource(DISP_SRC)) {
      map.addSource(DISP_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true, clusterMaxZoom: 12, clusterRadius: 46,
      });
      map.addLayer({
        id: LAYER_CLUSTERS, type: 'circle', source: DISP_SRC,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'rgba(10,14,16,0.85)',
          'circle-stroke-color': TERM.green,
          'circle-stroke-width': 1.5,
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24, 200, 30],
        },
      });
      map.addLayer({
        id: LAYER_COUNTS, type: 'symbol', source: DISP_SRC,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': TERM.green },
      });
      map.addLayer({
        id: LAYER_POINTS, type: 'circle', source: DISP_SRC,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            6, ['case', ['get', 'inRun'], 6, 4],
            11, ['case', ['get', 'inRun'], 10, 7],
            15, ['case', ['get', 'inRun'], 13, 9],
          ],
          'circle-stroke-color': '#05080a',
          'circle-stroke-width': 1.5,
        },
      });
      map.on('click', LAYER_CLUSTERS, (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: [LAYER_CLUSTERS] })[0];
        if (!f) return;
        map.getSource(DISP_SRC).getClusterExpansionZoom(f.properties.cluster_id, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 0.4, duration: 600 });
        });
      });
      map.on('click', LAYER_POINTS, (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        openDispPopupRef.current(String(f.properties.id), f.geometry.coordinates.slice());
      });
      for (const l of [LAYER_CLUSTERS, LAYER_POINTS]) {
        map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
      }
    }
    if (!map.getSource(HEAT_SRC)) {
      map.addSource(HEAT_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
  }, []);

  // ── Feature building (filters applied here) ────────────────────────────────
  const visibleDisps = React.useMemo(() => {
    return disps.filter((d) => {
      if (d.lat == null || d.lng == null || !isFinite(d.lat) || !isFinite(d.lng)) return false;
      if (verifiedOnly && !d.verified) return false;
      const st = pinStatusOf(d);
      if (hideVisited && (st === 'visited' || d.lastVisitedAt)) return false;
      if (hideCustomers && (st === 'customer' || st === 'dead')) return false;
      return true;
    });
  }, [disps, verifiedOnly, hideVisited, hideCustomers]);

  const visibleDispsRef = React.useRef([]);
  React.useEffect(() => { visibleDispsRef.current = visibleDisps; }, [visibleDisps]);

  const syncMapData = React.useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(DISP_SRC)) return;
    const runIds = new Set((runRef.current?.stops || []).map((s) => String(s.dispensaryId || '')));
    const features = visibleDisps.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: {
        id: String(d._id),
        color: PIN_STATUS[pinStatusOf(d)].color,
        inRun: runIds.has(String(d._id)),
      },
    }));
    map.getSource(DISP_SRC).setData({ type: 'FeatureCollection', features });
    if (map.getSource(HEAT_SRC)) {
      map.getSource(HEAT_SRC).setData({ type: 'FeatureCollection', features });
    }
  }, [visibleDisps]);

  React.useEffect(() => { if (mapReady) { ensureLayers(); syncMapData(); } }, [mapReady, ensureLayers, syncMapData, run]);

  // ── Heatmap layer toggle ───────────────────────────────────────────────────
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const apply = () => {
      ensureLayers();
      const has = map.getLayer(LAYER_HEAT);
      if (heatmapOn && !has) {
        map.addLayer({
          id: LAYER_HEAT, type: 'heatmap', source: HEAT_SRC,
          paint: {
            'heatmap-weight': 0.6,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 9, 1.6, 14, 2.4],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 30, 8, 55, 12, 90],
            'heatmap-opacity': 0.9,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.08, 'rgba(74,222,128,0.35)',
              0.30, 'rgba(74,222,128,0.7)',
              0.55, 'rgba(251,191,36,0.85)',
              0.80, 'rgba(248,113,113,0.95)',
              1, 'rgba(248,113,113,1)',
            ],
          },
        });
      } else if (!heatmapOn && has) {
        try { map.removeLayer(LAYER_HEAT); } catch {}
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('style.load', apply);
  }, [heatmapOn, mapReady, ensureLayers]);

  // ── Style switching (layers get wiped — re-add) ────────────────────────────
  const onStyleChange = (id) => {
    const map = mapRef.current;
    if (!map) return;
    const style = MAP_STYLES.find((s) => s.id === id);
    if (!style || id === styleId) return;
    setStyleId(id);
    const heatWasOn = heatmapOn;
    setHeatmapOn(false);
    map.setStyle(style.url);
    map.once('style.load', () => {
      ensureLayers();
      syncMapData();
      if (heatWasOn) setHeatmapOn(true);
    });
  };

  // ── Viewport loading ───────────────────────────────────────────────────────
  const loadArea = React.useCallback(async () => {
    const map = mapRef.current;
    if (!map || !token) return;
    if (map.getZoom() < MIN_LOAD_ZOOM) { setZoomedOut(true); return; }
    setZoomedOut(false);
    const b = map.getBounds();
    setLoadingArea(true);
    try {
      const params = new URLSearchParams({
        minLat: b.getSouth(), maxLat: b.getNorth(),
        minLng: b.getWest(), maxLng: b.getEast(),
        segments: segmentsOn.join(','),
      });
      const r = await axios.get(`${api}/api/roadtrip/dispensaries?${params}`, authHdr);
      setDisps(r.data?.results || []);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Area load failed.', 'error');
    } finally {
      setLoadingArea(false);
    }
  }, [api, token, authHdr, showToast, segmentsOn]);

  const loadAreaRef = React.useRef(loadArea);
  React.useEffect(() => { loadAreaRef.current = loadArea; }, [loadArea]);

  // Free OSM viewport fill. When zoomed into an area, ask the server to sweep it
  // on OpenStreetMap (Overpass — no API key, no billing) and upsert any new
  // dispensaries into our DB; if it found any, reload the pins. A client-side
  // tile guard (matching the server's ~0.5° tile throttle) means each area is
  // only requested once per session — panning around a worked area stays free
  // and instant. This is what makes stores "just appear" as you drive the map.
  const scannedTilesRef = React.useRef(new Set());
  const scanOsmArea = React.useCallback(async () => {
    const map = mapRef.current;
    if (!map || !token || map.getZoom() < OSM_SCAN_ZOOM) return;
    const c = map.getCenter();
    const tileKey = `${Math.floor(c.lat / 0.5) * 0.5}_${Math.floor(c.lng / 0.5) * 0.5}`;
    if (scannedTilesRef.current.has(tileKey)) return;
    scannedTilesRef.current.add(tileKey);
    const b = map.getBounds();
    try {
      const r = await axios.post(`${api}/api/roadtrip/dispensaries/scan-osm`, {
        minLat: b.getSouth(), maxLat: b.getNorth(),
        minLng: b.getWest(), maxLng: b.getEast(),
      }, authHdr);
      if (r.data?.error) {
        // Soft failure (HTTP 200 + {error} — Overpass down or backing off).
        // Unflag the tile so a later pan retries; otherwise this area would
        // never scan again this session and its stores would never appear.
        scannedTilesRef.current.delete(tileKey);
        return;
      }
      if ((r.data?.added || 0) > 0 || (r.data?.attached || 0) > 0) {
        loadAreaRef.current(); // surface the fresh finds
      }
    } catch {
      scannedTilesRef.current.delete(tileKey); // let a later pan retry
    }
  }, [api, token, authHdr]);
  const scanOsmAreaRef = React.useRef(scanOsmArea);
  React.useEffect(() => { scanOsmAreaRef.current = scanOsmArea; }, [scanOsmArea]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let t = null;
    const onMoveEnd = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { loadAreaRef.current(); scanOsmAreaRef.current(); }, 500);
    };
    map.on('moveend', onMoveEnd);
    loadAreaRef.current();     // initial DB load
    scanOsmAreaRef.current();  // initial free OSM fill
    return () => { map.off('moveend', onMoveEnd); if (t) clearTimeout(t); };
  }, [mapReady]);

  // Toggling a segment clicker re-queries the viewport with the new mix.
  React.useEffect(() => {
    if (mapReady) loadAreaRef.current();
  }, [mapReady, segmentsOn]);

  // ── CRM actions ────────────────────────────────────────────────────────────
  const companyKeyFor = (d) => d.companyKey || deriveCompanyKey(d.name);

  const openInCrm = React.useCallback((d) => {
    const key = d?.crm?.companyKey || companyKeyFor(d);
    if (onNavigate) onNavigate({ view: 'crm', companyKey: key });
    else showToast('CRM navigation unavailable here.', 'error');
  }, [onNavigate, showToast]);

  /**
   * Upsert the company in the REAL CRM. Stage is a promote-only SUGGESTION —
   * the server (crm patchOne `stageSuggest` → promoteStage) moves the funnel
   * forward only: a fresh record seeds at lead/contacted, a lead + visit bumps
   * to contacted, and an owner-advanced or closed deal is never touched — no
   * matter how stale this tab's loaded view of the record is.
   */
  const addOpportunity = React.useCallback(async (d, { visited = false, logText = null } = {}) => {
    // Prefer the MATCHED CRM record's real key (same as openInCrm) — the map
    // joins by companyKey OR the fuzzier matchKey, so a pin's derived key can
    // differ from the CRM card's actual key. Writing to the derived key would
    // upsert a DUPLICATE company; the visit/to-do must land on the real card.
    const key = d?.crm?.companyKey || companyKeyFor(d);
    const body = {
      companyName: d.name,
      address: d.address || '',
      phone: d.phone || '',
      source: 'field-map',
      leadSource: 'Field Visit',
      logText: logText || (visited ? `Field visit — pitched at ${d.name}` : 'Added from Field Map'),
      kind: visited ? 'visit' : 'note',
      stageSuggest: visited ? 'contacted' : 'lead',
    };
    try {
      // Offline-safe: a pitch/lead captured in a dead zone is queued and synced
      // when signal returns — never lost. queuedRequest only throws on a real
      // server refusal (4xx); a connectivity failure resolves as { queued }.
      const res = await queuedRequest({ method: 'patch', url: `${api}/api/crm/${encodeURIComponent(key)}`, body, label: `CRM · ${d.name}` });
      // Local pin stage + key: server truth when online (patchOne may have
      // re-resolved a stale/derived key onto the real card at write time);
      // offline, keep the stage we already knew (promote-only means it can
      // only be right or too low) and fall back to the suggestion for a
      // brand-new record.
      const stage = (!res.queued && res.data?.client?.stage) || d?.crm?.stage || body.stageSuggest;
      const realKey = (!res.queued && res.data?.client?.companyKey) || key;
      if (d._id) {
        setDisps((prev) => prev.map((x) => (x._id === d._id ? { ...x, crm: { companyKey: realKey, stage } } : x)));
      }
      if (res.queued) {
        showToast(`"${d.name}" saved offline — will sync when you're back on signal.`, 'info');
      } else {
        showToast(`"${d.name}" → CRM (${stage}).`, 'success', { label: 'OPEN', fn: () => openInCrm({ crm: { companyKey: realKey } }) });
      }
      return res.data;
    } catch (err) {
      showToast(err?.response?.data?.message || 'CRM add failed.', 'error');
      throw err;
    }
  }, [api, showToast, openInCrm]);

  const saveTodo = React.useCallback(async () => {
    const d = todoTarget;
    if (!d) return;
    const chip = TODO_CHIPS.find((c) => c.id === todoForm.chipId) || TODO_CHIPS[0];
    // Matched CRM record's real key wins (see addOpportunity) — never write the
    // to-do onto a derived-key duplicate.
    const key = d?.crm?.companyKey || companyKeyFor(d);
    const body = {
      companyName: d.name,
      address: d.address || '',
      phone: d.phone || '',
      source: 'field-map',
      leadSource: 'Field Visit',
      logText: `${chip.logText} — ${d.name}${todoForm.note ? ` · ${todoForm.note}` : ''}`,
      kind: 'next-action',
      nextFollowUp: todoForm.date ? `${todoForm.date}T12:00:00.000Z` : null,
      // Promote-only: seeds a fresh record at 'lead', never moves an existing
      // one (the server's promoteStage decides — see addOpportunity).
      stageSuggest: 'lead',
    };
    try {
      const res = await queuedRequest({ method: 'patch', url: `${api}/api/crm/${encodeURIComponent(key)}`, body, label: `To-do · ${d.name}` });
      // Server truth for the card's key when online — patchOne may have
      // re-resolved a stale/derived key onto the real card at write time.
      const realKey = (!res.queued && res.data?.client?.companyKey) || key;
      if (d._id) {
        setDisps((prev) => prev.map((x) => (x._id === d._id && !x.crm ? { ...x, crm: { companyKey: realKey, stage: (!res.queued && res.data?.client?.stage) || 'lead' } } : x)));
      }
      setTodoTarget(null);
      if (res.queued) {
        showToast(`To-do saved offline — will sync when you're back on signal.`, 'info');
      } else {
        showToast(`To-do saved — shows in CRM Today (${todoForm.date}).`, 'success', { label: 'OPEN', fn: () => openInCrm({ crm: { companyKey: realKey } }) });
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'To-do save failed.', 'error');
    }
  }, [api, todoTarget, todoForm, showToast, openInCrm]);

  // Save the on-road contact capture: the person lands on the company card's
  // contacts (server merges, never replaces — addContact), the meeting + 🔥
  // interest land in the visit log, and the stage gets the same promote-only
  // 'contacted' suggestion a pitch does. Offline-safe like every field write.
  const saveContact = React.useCallback(async () => {
    const d = contactTarget;
    if (!d || !contactForm.name.trim()) return;
    const key = d?.crm?.companyKey || companyKeyFor(d);
    const who = contactForm.name.trim();
    const role = contactForm.role.trim();
    const fire = contactForm.interest > 0 ? ` · interest ${'🔥'.repeat(contactForm.interest)} (${INTEREST_LABELS[contactForm.interest]})` : '';
    const reach = [contactForm.phone.trim(), contactForm.email.trim()].filter(Boolean).join(' · ');
    const body = {
      companyName: d.name,
      address: d.address || '',
      phone: d.phone || '',
      source: 'field-map',
      leadSource: 'Field Visit',
      addContact: { name: who, role, phone: contactForm.phone.trim(), email: contactForm.email.trim() },
      logText: `Met ${who}${role ? ` (${role})` : ''} at ${d.name}${fire}${reach ? ` · ${reach}` : ''}`,
      kind: 'visit',
      stageSuggest: 'contacted',
    };
    try {
      const res = await queuedRequest({ method: 'patch', url: `${api}/api/crm/${encodeURIComponent(key)}`, body, label: `Contact · ${d.name}` });
      const realKey = (!res.queued && res.data?.client?.companyKey) || key;
      const stage = (!res.queued && res.data?.client?.stage) || d?.crm?.stage || 'contacted';
      if (d._id) {
        setDisps((prev) => prev.map((x) => (x._id === d._id ? { ...x, crm: { companyKey: realKey, stage } } : x)));
      }
      setContactTarget(null);
      if (res.queued) {
        showToast(`${who} saved offline — will sync when you're back on signal.`, 'info');
      } else {
        showToast(`${who} → ${d.name}'s card.`, 'success', { label: 'OPEN', fn: () => openInCrm({ crm: { companyKey: realKey } }) });
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Contact save failed.', 'error');
    }
  }, [api, contactTarget, contactForm, showToast, openInCrm]);

  const hideDispensary = React.useCallback(async (d) => {
    try {
      const res = await queuedRequest({ method: 'post', url: `${api}/api/roadtrip/dispensaries/${d._id}/hide`, body: {}, label: `Hide · ${d.name}` });
      setDisps((prev) => prev.filter((x) => x._id !== d._id));
      showToast(res.queued ? `Hidden "${d.name}" — will sync.` : `Hidden "${d.name}" — won't show again.`, 'success');
    } catch {
      showToast('Failed to hide.', 'error');
    }
  }, [api, showToast]);

  // ── Run actions ────────────────────────────────────────────────────────────
  const refreshRun = React.useCallback(async () => {
    try {
      const r = await axios.get(`${api}/api/roadtrip/run`, authHdr);
      setRun(r.data?.run || null);
    } catch { /* ignore */ }
  }, [api, authHdr]);

  React.useEffect(() => {
    if (!token) return;
    refreshRun();
    axios.get(`${api}/api/roadtrip/leads`, authHdr)
      .then((r) => {
        const leads = r.data || [];
        setCustomPins(leads.filter((l) => l.source === 'manual'));
      })
      .catch(() => {});
    // CRM follow-ups needing action now — overdue + due today (the nightly
    // follow-up discipline). Deep-links into the CRM Today queue. Shape:
    // { summary: { overdue, dueToday, total }, rows }.
    axios.get(`${api}/api/crm/today`, authHdr)
      .then((r) => {
        const s = (r.data && r.data.summary) || {};
        const count = (Number(s.overdue) || 0) + (Number(s.dueToday) || 0);
        setFollowUps({ count, loaded: true });
      })
      .catch(() => setFollowUps({ count: 0, loaded: true }));
  }, [token, api, authHdr, refreshRun]);

  const addDispToRun = React.useCallback(async (d) => {
    try {
      const r = await axios.post(`${api}/api/roadtrip/run/stops`, { dispensaryId: d._id }, authHdr);
      setRun(r.data?.run || null);
      setRunMiles(null);
      if (!r.data?.duplicate) showToast(`"${d.name}" added to run.`, 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Add to run failed.', 'error');
      throw err;
    }
  }, [api, authHdr, showToast]);

  const addCustomToRun = React.useCallback(async (item) => {
    try {
      const r = await axios.post(`${api}/api/roadtrip/run/stops`, {
        leadId: item._id, name: item.name, address: item.address || '',
        phone: item.phone || '', lat: item.lat, lng: item.lng,
      }, authHdr);
      setRun(r.data?.run || null);
      setRunMiles(null);
      showToast(`"${item.name}" added to run.`, 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Add to run failed.', 'error');
      throw err;
    }
  }, [api, authHdr, showToast]);

  const removeStop = React.useCallback(async (stop) => {
    if (pendingDeleteId !== stop._id) {
      if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
      setPendingDeleteId(stop._id);
      pendingDeleteTimerRef.current = setTimeout(() => setPendingDeleteId(null), 2500);
      return;
    }
    setPendingDeleteId(null);
    try {
      const r = await axios.delete(`${api}/api/roadtrip/run/stops/${stop._id}`, authHdr);
      setRun(r.data?.run || null);
      setRunMiles(null);
    } catch {
      showToast('Remove failed.', 'error');
    }
  }, [api, authHdr, pendingDeleteId, showToast]);

  const patchStop = React.useCallback(async (stop, updates) => {
    // Optimistic first: reflect the visit/outcome on the local run immediately so
    // the tap "sticks" even with no signal. The write is queued if offline and
    // synced later; only a real server refusal (4xx) surfaces an error.
    setRun((prev) => (prev
      ? { ...prev, stops: (prev.stops || []).map((s) => (String(s._id) === String(stop._id) ? { ...s, ...updates } : s)) }
      : prev));
    try {
      const res = await queuedRequest({ method: 'patch', url: `${api}/api/roadtrip/run/stops/${stop._id}`, body: updates, label: `Visit · ${stop.name || 'stop'}` });
      if (!res.queued && res.data?.run) setRun(res.data.run);
      return res.queued ? null : res.data?.run;
    } catch {
      showToast('Stop update failed.', 'error');
      return null;
    }
  }, [api, showToast]);

  const markVisited = React.useCallback(async (stop) => {
    await patchStop(stop, { status: 'visited' });
    if (stop.dispensaryId) {
      setDisps((prev) => prev.map((x) => (String(x._id) === String(stop.dispensaryId) ? { ...x, lastVisitedAt: new Date().toISOString() } : x)));
    }
    setOutcomeStopId(stop._id);
  }, [patchStop]);

  // A run stop as a CRM-writable target, for when its dispensary isn't in the
  // loaded viewport (runs routinely outlive the map view). The stop carries
  // the CRM match resolved server-side at ADD time: companyKey is the card's
  // REAL key (never a derived-key duplicate), crmStage '' means no card
  // existed then. Stage itself stays promote-only server-side, so even a
  // stale snapshot can't demote a deal.
  const stopAsCrmTarget = (s) => ({
    _id: null, name: s.name, address: s.address, phone: s.phone,
    companyKey: s.companyKey,
    crm: s.crmStage ? { companyKey: s.companyKey, stage: s.crmStage } : null,
  });

  const setOutcome = React.useCallback(async (stop, outcome) => {
    await patchStop(stop, { outcome: outcome.id });
    setOutcomeStopId(null);
    if (outcome.id === 'pitched') {
      const d = stop.dispensaryId ? byIdRef.current.get(String(stop.dispensaryId)) : null;
      await addOpportunity(d || stopAsCrmTarget(stop), { visited: true });
    }
  }, [patchStop, addOpportunity]);

  const getLocation = React.useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported.')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLoc(loc);
        resolve(loc);
      },
      (err) => reject(new Error(
        err.code === 1 ? 'Location permission denied — check browser settings.'
        : err.code === 3 ? 'Location timed out — try again.'
        : `Location unavailable: ${err.message}`
      )),
      { timeout: 30000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }), []);

  const optimizeRun = React.useCallback(async () => {
    if (!run || !run.stops?.length) return;
    setOptimizing(true);
    try {
      const loc = myLocRef.current || await getLocation();
      const r = await axios.post(`${api}/api/roadtrip/run/optimize`, loc, authHdr);
      setRun(r.data?.run || null);
      setRunMiles(r.data?.miles ?? null);
      showToast(`Route optimized from your location — ~${r.data?.miles}mi of driving.`, 'success');
    } catch (err) {
      showToast(err?.message || err?.response?.data?.message || 'Optimize failed.', 'error');
    } finally {
      setOptimizing(false);
    }
  }, [api, authHdr, run, getLocation, showToast]);

  // "Add all in view" — the day-planning flow: search the city being visited,
  // let the viewport fill with stores, add every visible one to the day in a
  // single tap (server-side bulk with dedupe), then reorder / optimize / hand
  // off to Google Maps.
  const [bulkAdding, setBulkAdding] = React.useState(false);
  const addAllInView = React.useCallback(async () => {
    const targets = (visibleDispsRef.current || []).filter((d) => d._id);
    if (!targets.length) { showToast('No stores in view — search a city or zoom out a touch.', 'info'); return; }
    setBulkAdding(true);
    try {
      const r = await axios.post(`${api}/api/roadtrip/run/stops`, {
        dispensaryIds: targets.map((d) => String(d._id)),
      }, authHdr);
      if (r.data?.run) setRun(r.data.run);
      setRunMiles(null);
      const added = r.data?.added || 0;
      showToast(
        added
          ? `Added ${added} store${added === 1 ? '' : 's'} to the day${r.data?.capped ? ' (capped — zoom in for the rest)' : ''}.`
          : 'Everything in view is already on the day.',
        added ? 'success' : 'info',
      );
    } catch (err) {
      showToast(err?.response?.data?.message || 'Bulk add failed.', 'error');
    } finally {
      setBulkAdding(false);
    }
  }, [api, authHdr, showToast]);

  // Manual reorder — move a stop up/down the day list. Optimistic local swap,
  // then persist the full order via PATCH /run {stopOrder} (already supported
  // server-side; visited stops keep their place at the head).
  const moveStop = React.useCallback(async (stop, dir) => {
    const stops = [...(run?.stops || [])].sort((a, b) => a.order - b.order);
    const i = stops.findIndex((s) => String(s._id) === String(stop._id));
    const j = i + dir;
    if (i < 0 || j < 0 || j >= stops.length) return;
    [stops[i], stops[j]] = [stops[j], stops[i]];
    setRun((prev) => (prev ? { ...prev, stops: stops.map((s, k) => ({ ...s, order: k })) } : prev));
    setRunMiles(null);
    try {
      const r = await axios.patch(`${api}/api/roadtrip/run`, { stopOrder: stops.map((s) => String(s._id)) }, authHdr);
      if (r.data?.run) setRun(r.data.run);
    } catch {
      showToast('Reorder failed — refreshing.', 'error');
      refreshRun();
    }
  }, [api, authHdr, run, refreshRun, showToast]);

  const completeRun = React.useCallback(async () => {
    try {
      await axios.post(`${api}/api/roadtrip/run/complete`, {}, authHdr);
      setRun(null);
      setRunMiles(null);
      showToast('Run finished — next stop starts a fresh one.', 'success');
    } catch {
      showToast('Finish run failed.', 'error');
    }
  }, [api, authHdr, showToast]);

  const pendingStops = React.useMemo(
    () => (run?.stops || []).filter((s) => s.status === 'pending').sort((a, b) => a.order - b.order),
    [run]
  );
  const gmapsLegs = React.useMemo(
    () => buildGmapsLegs(myLoc, pendingStops.map((s) => ({ lat: s.lat, lng: s.lng, placeId: s.placeId }))),
    [myLoc, pendingStops]
  );

  // ── Popup opening (single reusable popup; ref keeps handlers fresh) ───────
  const openDispPopupRef = React.useRef(() => {});
  React.useEffect(() => {
    openDispPopupRef.current = (id, coords) => {
      const map = mapRef.current;
      const d = byIdRef.current.get(id);
      if (!map || !d) return;
      if (popupRef.current) { try { popupRef.current.remove(); } catch {} }
      const inRun = (runRef.current?.stops || []).some((s) => String(s.dispensaryId || '') === id);
      const popup = new mapboxgl.Popup({
        offset: 14, closeButton: true, closeOnClick: true,
        maxWidth: 'min(340px, calc(100vw - 24px))',
      });
      popup.setLngLat(coords)
        .setDOMContent(buildDispPopup({
          d, inRun,
          onAddToRun: (dd) => addDispToRun(dd),
          onHide: (dd) => { hideDispensary(dd); popup.remove(); },
          onOpenCrm: (dd) => openInCrm(dd),
        }))
        .addTo(map);
      popupRef.current = popup;
    };
  });

  // ── Run markers (numbered HTML pins — few, so DOM markers are fine) ───────
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const existing = runMarkersRef.current;
    const wanted = new Map();
    (run?.stops || []).forEach((s) => {
      if (!isFinite(s.lat) || !isFinite(s.lng)) return;
      wanted.set(String(s._id), s);
    });
    for (const [id, marker] of existing) {
      if (!wanted.has(id)) { try { marker.remove(); } catch {} existing.delete(id); }
    }
    const ordered = [...wanted.values()].sort((a, b) => a.order - b.order);
    ordered.forEach((s, i) => {
      const id = String(s._id);
      const label = s.status === 'visited' ? '✓' : String(i + 1);
      const color = s.status === 'visited' ? TERM.green : TERM.cyan;
      let marker = existing.get(id);
      if (marker) {
        marker.setLngLat([s.lng, s.lat]);
        const el = marker.getElement().firstChild;
        if (el) { el.textContent = label; el.style.background = color; el.style.boxShadow = `0 0 0 1.5px ${color}, 0 0 10px ${color}90`; }
      } else {
        const wrap = document.createElement('div');
        const inner = document.createElement('div');
        inner.textContent = label;
        inner.style.cssText = `
          min-width: 20px; height: 20px; border-radius: 50%;
          background: ${color}; color: #05080a;
          font-family: ${MONO}; font-size: 11px; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #05080a; box-shadow: 0 0 0 1.5px ${color}, 0 0 10px ${color}90;
          padding: 0 3px; cursor: pointer;
        `;
        wrap.appendChild(inner);
        marker = new mapboxgl.Marker({ element: wrap, anchor: 'center', offset: [0, -14] })
          .setLngLat([s.lng, s.lat]).addTo(map);
        existing.set(id, marker);
      }
    });
  }, [run, mapReady]);

  // ── Custom pin markers ─────────────────────────────────────────────────────
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const existing = customMarkersRef.current;
    const wanted = new Map();
    for (const item of customPins) {
      if (!isFinite(item.lat) || !isFinite(item.lng)) continue;
      wanted.set(String(item._id), item);
    }
    for (const [id, marker] of existing) {
      if (!wanted.has(id)) { try { marker.remove(); } catch {} existing.delete(id); }
    }
    for (const [id, item] of wanted) {
      if (existing.has(id)) continue;
      const el = buildCustomMarkerEl(item);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([item.lng, item.lat]).addTo(map);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popupRef.current) { try { popupRef.current.remove(); } catch {} }
        const inRun = (runRef.current?.stops || []).some((s) => String(s.leadId || '') === id);
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, closeOnClick: true });
        popup.setLngLat([item.lng, item.lat])
          .setDOMContent(buildCustomStopPopup(item, { inRun, onAddToRun: addCustomToRun }))
          .addTo(map);
        popupRef.current = popup;
      });
      existing.set(id, marker);
    }
  }, [customPins, mapReady, addCustomToRun]);

  // ── My-location marker ─────────────────────────────────────────────────────
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !myLoc) return;
    if (!myLocMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 16px; height: 16px; border-radius: 50%;
        background: #38bdf8; border: 3px solid #05080a;
        box-shadow: 0 0 0 2px #38bdf8, 0 0 16px #38bdf8;
      `;
      myLocMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([myLoc.lng, myLoc.lat]).addTo(map);
    } else {
      myLocMarkerRef.current.setLngLat([myLoc.lng, myLoc.lat]);
    }
  }, [myLoc, mapReady]);

  const flyToMyLocation = React.useCallback(() => {
    showToast('Locating…', 'info');
    getLocation()
      .then((loc) => {
        mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 11.5, essential: true, duration: 1400 });
        showToast('Location found.', 'success');
      })
      .catch((err) => showToast(err.message, 'error'));
  }, [getLocation, showToast]);

  // ── Location search ────────────────────────────────────────────────────────
  const searchLocation = async (query) => {
    if (!query.trim()) { setLocationResults([]); return; }
    setLocationSearching(true);
    try {
      const encoded = encodeURIComponent(query.trim());
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`
        + `?access_token=${config.mapboxToken}&limit=5&country=US`;
      const r = await fetch(url);
      const data = await r.json();
      setLocationResults(data.features || []);
    } catch {
      setLocationResults([]);
    } finally {
      setLocationSearching(false);
    }
  };

  // ── Custom pin add ─────────────────────────────────────────────────────────
  const addCustomPin = async () => {
    const { name, address, notes, customType } = customPinForm;
    if (!name.trim()) { showToast('Name required.', 'error'); return; }
    try {
      let lat = mapRef.current?.getCenter().lat ?? 40.5;
      let lng = mapRef.current?.getCenter().lng ?? -74.5;
      let located = !address.trim(); // no address = map center is the intent
      if (address.trim()) {
        const encoded = encodeURIComponent(address.trim());
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`
          + `?access_token=${config.mapboxToken}&limit=1&country=US`;
        const r = await fetch(url);
        const data = await r.json();
        if (data.features && data.features.length > 0) { [lng, lat] = data.features[0].center; located = true; }
      }
      const body = {
        source: 'manual', name: name.trim(), address: address.trim(),
        lat, lng, type: 'other', kind: 'stop', status: 'planned',
        customType, notes: notes.trim(),
      };
      const res = await axios.post(`${api}/api/roadtrip/leads`, body, authHdr);
      setCustomPins((prev) => [res.data, ...prev]);
      setShowAddCustomPin(false);
      setCustomPinForm({ name: '', address: '', notes: '', customType: 'friend' });
      // A typed address that didn't geocode must NOT read as a clean add — the
      // pin landed at the map center, not where the owner thinks it is.
      if (located) showToast(`Added "${name.trim()}" to map.`, 'success');
      else showToast(`Couldn't find "${address.trim()}" — "${name.trim()}" was pinned at the map center. Drag the map there or re-add it with a fuller address.`, 'error');
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 13, essential: true, duration: 1200 });
    } catch (err) {
      showToast(err?.response?.data?.message || 'Add failed.', 'error');
    }
  };

  // ── Derived UI bits ────────────────────────────────────────────────────────
  const visitedCount = (run?.stops || []).filter((s) => s.status === 'visited').length;

  const flyToStop = (s) => {
    if (!mapRef.current || !isFinite(s.lat)) return;
    mapRef.current.flyTo({ center: [s.lng, s.lat], zoom: 13.5, essential: true, duration: 1200 });
    if (window.innerWidth < 900) setMobileTab('map');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Panels (shared between desktop sidebar + mobile overlays)
  // ─────────────────────────────────────────────────────────────────────────

  const navigatePanel = (
    <PanelSection title="NAVIGATE" persistKey="jpfm-nav">
      <Box sx={{ mb: 1.25 }}>
        <Box sx={{ position: 'relative', display: 'flex', gap: 0.5 }}>
          <Box sx={{ position: 'relative', flexGrow: 1 }}>
            <input
              value={locationSearch}
              onChange={(e) => {
                setLocationSearch(e.target.value);
                if (e.target.value.length > 2) searchLocation(e.target.value);
                else setLocationResults([]);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && locationSearch.length > 1) searchLocation(locationSearch); }}
              placeholder="Search city or address…"
              style={{ ...inputStyle, padding: '8px 32px 8px 10px', border: `1.5px solid ${TERM.border}`, background: 'rgba(74,222,128,0.04)', fontSize: 11.5, letterSpacing: 0.3 }}
            />
            {locationSearching && (
              <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: TERM.amber, fontFamily: MONO }}>…</Box>
            )}
          </Box>
          <Box role="button" tabIndex={0}
            onClick={() => { if (locationSearch.length > 1) searchLocation(locationSearch); }}
            sx={{
              fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1,
              color: TERM.greenDk, px: 1.25, flexShrink: 0, cursor: 'pointer', borderRadius: 0.5,
              bgcolor: TERM.green, border: `1.5px solid ${TERM.green}`,
              display: 'flex', alignItems: 'center',
              '&:hover': { opacity: 0.88 },
            }}>GO</Box>
        </Box>
        {locationResults.length > 0 && (
          <Box sx={{ mt: 0.5, border: `1px solid ${TERM.border}`, borderRadius: 0.5, overflow: 'hidden' }}>
            {locationResults.map((f) => (
              <Box key={f.id} role="button" tabIndex={0}
                onClick={() => {
                  const [lng, lat] = f.center;
                  mapRef.current?.flyTo({ center: [lng, lat], zoom: 11.5, essential: true, duration: 1200 });
                  setLocationSearch('');
                  setLocationResults([]);
                  if (window.innerWidth < 900) setMobileTab('map');
                }}
                sx={{
                  fontFamily: MONO, fontSize: 10.5, color: TERM.text, px: 1.25, py: 0.85,
                  cursor: 'pointer', borderBottom: `1px solid ${TERM.borderDim}`,
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: 'rgba(74,222,128,0.08)', color: TERM.green },
                }}>
                {f.place_name}
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <Box role="button" tabIndex={0}
        onClick={() => { flyToMyLocation(); if (window.innerWidth < 900) setMobileTab('map'); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') flyToMyLocation(); }}
        sx={{
          fontFamily: MONO, fontSize: 11.5, fontWeight: 800, letterSpacing: 1,
          color: TERM.green, py: 1, px: 1.25,
          cursor: 'pointer', borderRadius: 0.5, userSelect: 'none',
          border: `1.5px solid ${TERM.green}`, bgcolor: 'rgba(74,222,128,0.06)',
          display: 'flex', alignItems: 'center', gap: 1,
          '&:hover': { bgcolor: 'rgba(74,222,128,0.14)', boxShadow: `0 0 14px ${TERM.green}30` },
        }}>
        <Box component="span" sx={{ fontSize: 14 }}>📍</Box>
        MY LOCATION
      </Box>
      <Box role="button" tabIndex={0}
        onClick={() => setShowAddCustomPin(true)}
        sx={{
          fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
          px: 1, py: 0.6, cursor: 'pointer', borderRadius: 0.25, mt: 0.75,
          color: TERM.cyan, border: `1px dashed ${TERM.cyan}`,
          width: '100%', textAlign: 'center', boxSizing: 'border-box',
          '&:hover': { bgcolor: 'rgba(6,182,212,0.08)' },
        }}>
        + ADD CUSTOM STOP
      </Box>
    </PanelSection>
  );

  // ── TODAY cockpit surface — the whole day at a glance: the durable route
  //    (your saved day + reopenable Google Maps legs) and how many follow-ups
  //    are due. Composes existing data + handlers only.
  const nextStop = (run?.stops || []).find((s) => s.status !== 'visited') || null;
  const todayHdr = (label, right) => (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.9, mt: 0.5 }}>
      <Typography sx={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: TERM.muted }}>{label}</Typography>
      {right || null}
    </Box>
  );
  const todayPanel = (
    <Box sx={{ mb: 2.5 }}>
      {/* Route today — the durable run + reopenable legs (never rewrite in gmaps) */}
      {todayHdr("ROUTE TODAY", run?.stops?.length ? (
        <Typography sx={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, color: TERM.green }}>
          {visitedCount}/{run.stops.length} done{runMiles != null ? ` · ~${runMiles}mi` : ''}
        </Typography>
      ) : null)}
      {run?.stops?.length ? (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 9.5, color: TERM.green, mb: 1, display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Box component="span">✓</Box> Saved — {run.stops.length} stops. Reopen the legs anytime; nothing to rewrite.
          </Typography>
          {nextStop && (
            <Box sx={{ border: `1px solid ${TERM.borderDim}`, borderRadius: 0.5, p: 1, mb: 1, bgcolor: 'rgba(74,222,128,0.04)' }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1, color: TERM.muted }}>NEXT STOP</Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: TERM.text, mt: 0.2 }}>{nextStop.name}</Typography>
            </Box>
          )}
          {gmapsLegs.length > 0 && (
            <Stack spacing={0.5} sx={{ mb: 1 }}>
              {gmapsLegs.map((leg, i) => (
                <Box key={leg.url} role="button" tabIndex={0}
                  onClick={() => window.open(leg.url, '_blank', 'noopener')}
                  sx={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                    px: 1, py: 0.7, cursor: 'pointer', borderRadius: 0.5,
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    color: TERM.cyan, border: `1px solid ${TERM.cyan}`,
                    '&:hover': { bgcolor: 'rgba(6,182,212,0.12)' },
                  }}>
                  <Box component="span">▶</Box>
                  {gmapsLegs.length > 1 ? `OPEN LEG ${i + 1}/${gmapsLegs.length}` : 'OPEN IN GOOGLE MAPS'}
                  <Box component="span" sx={{ ml: 'auto', color: TERM.muted }}>{leg.count} stop{leg.count === 1 ? '' : 's'}</Box>
                </Box>
              ))}
            </Stack>
          )}
          <Box role="button" tabIndex={0} onClick={() => setMobileTab('run')}
            sx={{
              fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textAlign: 'center',
              py: 0.7, cursor: 'pointer', borderRadius: 0.5, color: TERM.muted,
              border: `1px solid ${TERM.borderDim}`, '&:hover': { color: TERM.green, borderColor: TERM.green },
            }}>OPEN FULL RUN →</Box>
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          <Box role="button" tabIndex={0} onClick={addAllInView}
            sx={{
              fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1, textAlign: 'center',
              py: 0.9, mb: 0.75, cursor: 'pointer', borderRadius: 0.5,
              color: bulkAdding ? TERM.amber : TERM.greenDk, bgcolor: bulkAdding ? 'transparent' : TERM.green,
              border: `1.5px solid ${bulkAdding ? TERM.amber : TERM.green}`, '&:hover': { opacity: 0.9 },
            }}>{bulkAdding ? 'ADDING…' : `＋ ADD ALL IN VIEW${visibleDisps.length ? ` (${visibleDisps.length})` : ''}`}</Box>
          <Typography sx={{ fontFamily: MONO, fontSize: 9.5, color: TERM.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
            Search the city you're visiting, then add every store in view — or tap pins one at a time. Your day is saved here; even 20 stops chunk into Google Maps legs you reopen anytime.
          </Typography>
        </Box>
      )}

      {/* Follow-ups due — opens the CRM Today queue */}
      {todayHdr("NIGHTLY FOLLOW-UP")}
      <Box role="button" tabIndex={0}
        onClick={() => onNavigate && onNavigate({ view: 'crm' })}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, cursor: onNavigate ? 'pointer' : 'default',
          border: `1px solid ${followUps.count > 0 ? TERM.amber : TERM.borderDim}`, borderRadius: 0.5, p: 1,
          bgcolor: followUps.count > 0 ? 'rgba(251,191,36,0.06)' : 'transparent',
          '&:hover': onNavigate ? { borderColor: followUps.count > 0 ? TERM.amber : TERM.green } : {},
        }}>
        <Typography sx={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, lineHeight: 1, color: followUps.count > 0 ? TERM.amber : TERM.muted }}>
          {followUps.loaded ? followUps.count : '·'}
        </Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, lineHeight: 1.4 }}>
          {followUps.count > 0 ? 'follow-ups due — buyers waiting on a quote or catalog' : (followUps.loaded ? 'all caught up ✓' : 'loading…')}
        </Typography>
        {onNavigate && <Box component="span" sx={{ ml: 'auto', fontFamily: MONO, fontSize: 14, color: followUps.count > 0 ? TERM.amber : TERM.muted }}>→</Box>}
      </Box>
    </Box>
  );

  const runPanel = (
    <PanelSection title={`TODAY'S RUN · ${run?.stops?.length || 0}`} persistKey="jpfm-run">
      {(!run || !run.stops?.length) ? (
        <>
          <Box role="button" tabIndex={0}
            onClick={addAllInView}
            onKeyDown={(e) => { if (e.key === 'Enter') addAllInView(); }}
            sx={{
              fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1,
              py: 0.9, mb: 1, textAlign: 'center', cursor: 'pointer', borderRadius: 0.5,
              color: bulkAdding ? TERM.amber : TERM.greenDk,
              bgcolor: bulkAdding ? 'transparent' : TERM.green,
              border: `1.5px solid ${bulkAdding ? TERM.amber : TERM.green}`,
              '&:hover': { opacity: 0.9 },
            }}>
            {bulkAdding ? 'ADDING…' : `＋ ADD ALL IN VIEW${visibleDisps.length ? ` (${visibleDisps.length})` : ''}`}
          </Box>
          <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, lineHeight: 1.55, py: 0.5, fontStyle: 'italic' }}>
            Search the city you're visiting, then save every store in view to the day. Or tap any pin → ＋ ADD TO RUN.
          </Typography>
        </>
      ) : (
        <>
          <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Box role="button" tabIndex={0}
              onClick={optimizeRun}
              sx={{
                flex: 1, fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1,
                py: 0.8, textAlign: 'center', cursor: 'pointer', borderRadius: 0.5,
                color: optimizing ? TERM.amber : TERM.greenDk,
                bgcolor: optimizing ? 'transparent' : TERM.green,
                border: `1.5px solid ${optimizing ? TERM.amber : TERM.green}`,
                '&:hover': { opacity: 0.9 },
              }}>
              {optimizing ? 'OPTIMIZING…' : '⚡ OPTIMIZE'}
            </Box>
            <Box role="button" tabIndex={0}
              onClick={addAllInView}
              title="Add every store in the current view to the day"
              sx={{
                fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                py: 0.8, px: 1.25, textAlign: 'center', cursor: 'pointer', borderRadius: 0.5,
                color: bulkAdding ? TERM.amber : TERM.cyan, border: `1px solid ${bulkAdding ? TERM.amber : TERM.cyan}`,
                '&:hover': { bgcolor: 'rgba(6,182,212,0.12)' },
              }}>
              {bulkAdding ? '…' : '＋ VIEW'}
            </Box>
            <Box role="button" tabIndex={0}
              onClick={completeRun}
              sx={{
                fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                py: 0.8, px: 1.25, textAlign: 'center', cursor: 'pointer', borderRadius: 0.5,
                color: TERM.muted, border: `1px solid ${TERM.borderDim}`,
                '&:hover': { color: TERM.red, borderColor: TERM.red },
              }}>
              FINISH
            </Box>
          </Stack>

          <Typography sx={{ fontFamily: MONO, fontSize: 9.5, color: TERM.muted, letterSpacing: 0.5, mb: 1 }}>
            {visitedCount}/{run.stops.length} visited
            {runMiles != null && <Box component="span" sx={{ color: TERM.green }}> · ~{runMiles}mi</Box>}
            {myLoc == null && <Box component="span" sx={{ color: TERM.amber }}> · tap MY LOCATION for distances</Box>}
          </Typography>

          {gmapsLegs.length > 0 && (
            <Stack spacing={0.5} sx={{ mb: 1.25 }}>
              {gmapsLegs.map((leg, i) => (
                <Box key={leg.url} role="button" tabIndex={0}
                  onClick={() => window.open(leg.url, '_blank', 'noopener')}
                  sx={{
                    fontFamily: MONO, fontSize: 10.5, fontWeight: 900, letterSpacing: 1,
                    py: 0.9, textAlign: 'center', cursor: 'pointer', borderRadius: 0.5,
                    color: TERM.cyan, border: `1.5px solid ${TERM.cyan}`,
                    bgcolor: 'rgba(6,182,212,0.08)',
                    '&:hover': { bgcolor: 'rgba(6,182,212,0.16)' },
                  }}>
                  ⤴ {gmapsLegs.length === 1 ? 'GO — GOOGLE MAPS' : `GO · LEG ${i + 1} (stops ${leg.from}–${leg.to})`}
                </Box>
              ))}
              {gmapsLegs.length > 1 && (
                <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted, lineHeight: 1.4 }}>
                  Google Maps caps a route at 10 stops — finish a leg, then tap the next.
                </Typography>
              )}
            </Stack>
          )}

          {[...run.stops].sort((a, b) => a.order - b.order).map((s, i) => {
            const done = s.status === 'visited';
            const dist = myLoc ? haversineMi(myLoc, s) : null;
            return (
              <Box key={s._id}
                sx={{
                  py: 0.6, px: 0.75, mb: 0.25, borderRadius: 0.5, cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: done ? 0.55 : 1,
                  '&:hover': { bgcolor: 'rgba(74,222,128,0.04)', transform: 'translateX(2px)' },
                  '&:hover .jp-stop-actions': { opacity: 1 },
                }}
                onClick={() => flyToStop(s)}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{
                    fontFamily: MONO, fontSize: 9.5, fontWeight: 900,
                    minWidth: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: done ? TERM.green : 'transparent',
                    color: done ? TERM.greenDk : TERM.cyan,
                    border: `1.5px solid ${done ? TERM.green : TERM.cyan}`,
                  }}>{done ? '✓' : i + 1}</Box>
                  <Typography sx={{
                    flexGrow: 1, minWidth: 0, fontFamily: MONO, fontSize: 11, fontWeight: 600,
                    color: TERM.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {s.name}
                  </Typography>
                  {dist != null && !done && (
                    <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, flexShrink: 0 }}>{fmtMi(dist)}</Typography>
                  )}
                  <Box className="jp-stop-actions" sx={{ opacity: { xs: 1, md: 0 }, display: 'flex', gap: { xs: 1, md: 0.25 }, flexShrink: 0, transition: 'opacity 0.15s' }}>
                    {!done && (
                      <>
                        <Box role="button"
                          onClick={(e) => { e.stopPropagation(); moveStop(s, -1); }}
                          sx={actionBtnSx(TERM.muted, TERM.cyan)} title="Move up">▲</Box>
                        <Box role="button"
                          onClick={(e) => { e.stopPropagation(); moveStop(s, 1); }}
                          sx={actionBtnSx(TERM.muted, TERM.cyan)} title="Move down">▼</Box>
                      </>
                    )}
                    {!done && (
                      <Box role="button"
                        onClick={(e) => { e.stopPropagation(); markVisited(s); }}
                        sx={actionBtnSx(TERM.muted, TERM.green)} title="Mark visited">✓</Box>
                    )}
                    {s.phone ? (
                      <Box component="a" href={`tel:${s.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ ...actionBtnSx(TERM.muted, TERM.amber), textDecoration: 'none' }} title="Call ahead">📞</Box>
                    ) : null}
                    <Box role="button"
                      onClick={(e) => { e.stopPropagation(); removeStop(s); }}
                      sx={{
                        ...actionBtnSx(TERM.red, TERM.red),
                        bgcolor: pendingDeleteId === s._id ? 'rgba(248,113,113,0.18)' : 'transparent',
                        borderColor: pendingDeleteId === s._id ? TERM.red : 'transparent',
                      }}>
                      {pendingDeleteId === s._id ? '✓?' : '×'}
                    </Box>
                  </Box>
                </Box>
                {outcomeStopId === s._id && (
                  <Box sx={{ mt: 0.6, ml: 3, display: 'flex', gap: 0.5, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    {OUTCOME_CHIPS.map((o) => (
                      <Box key={o.id} role="button"
                        onClick={() => setOutcome(s, o)}
                        sx={{
                          fontFamily: MONO, fontSize: { xs: 11, md: 8.5 }, fontWeight: 900, letterSpacing: 0.5,
                          px: { xs: 1.4, md: 0.9 }, py: { xs: 0.8, md: 0.4 }, borderRadius: 0.25, cursor: 'pointer',
                          color: o.color, border: `1px solid ${o.color}`,
                          '&:hover': { bgcolor: `${o.color}22` },
                        }}>{o.label}</Box>
                    ))}
                    <Box role="button"
                      onClick={() => {
                        const d = s.dispensaryId ? byIdRef.current.get(String(s.dispensaryId)) : null;
                        setContactTarget(d || stopAsCrmTarget(s));
                        setContactForm({ name: '', role: '', phone: '', email: '', interest: 0 });
                        setOutcomeStopId(null);
                      }}
                      sx={{
                        fontFamily: MONO, fontSize: { xs: 11, md: 8.5 }, fontWeight: 900, letterSpacing: 0.5,
                        px: { xs: 1.4, md: 0.9 }, py: { xs: 0.8, md: 0.4 }, borderRadius: 0.25, cursor: 'pointer',
                        color: TERM.cyan, border: `1px dashed ${TERM.cyan}`,
                        '&:hover': { bgcolor: 'rgba(6,182,212,0.12)' },
                      }}>+ CONTACT</Box>
                    <Box role="button"
                      onClick={() => {
                        const d = s.dispensaryId ? byIdRef.current.get(String(s.dispensaryId)) : null;
                        setTodoTarget(d || stopAsCrmTarget(s));
                        setTodoForm({ chipId: 'mockups', note: '', date: tomorrowISO() });
                        setOutcomeStopId(null);
                      }}
                      sx={{
                        fontFamily: MONO, fontSize: { xs: 11, md: 8.5 }, fontWeight: 900, letterSpacing: 0.5,
                        px: { xs: 1.4, md: 0.9 }, py: { xs: 0.8, md: 0.4 }, borderRadius: 0.25, cursor: 'pointer',
                        color: TERM.amber, border: `1px dashed ${TERM.amber}`,
                        '&:hover': { bgcolor: 'rgba(251,191,36,0.12)' },
                      }}>+ TO-DO</Box>
                  </Box>
                )}
              </Box>
            );
          })}
        </>
      )}
    </PanelSection>
  );

  const filtersPanel = (
    <PanelSection title="FILTERS" persistKey="jpfm-filters" defaultOpen={false}>
      {[
        { label: 'LICENSED ONLY', on: verifiedOnly, set: setVerifiedOnly },
        { label: 'HIDE VISITED', on: hideVisited, set: setHideVisited },
        { label: 'HIDE CUSTOMERS + DEAD', on: hideCustomers, set: setHideCustomers },
      ].map((f) => (
        <Box key={f.label} role="button" tabIndex={0}
          onClick={() => f.set((v) => !v)}
          sx={{
            fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: 1,
            px: 1, py: 0.6, mb: 0.5, cursor: 'pointer', borderRadius: 0.25,
            display: 'flex', alignItems: 'center', gap: 1,
            color: f.on ? TERM.green : TERM.muted,
            border: `1px solid ${f.on ? TERM.green : TERM.borderDim}`,
            bgcolor: f.on ? 'rgba(74,222,128,0.08)' : 'transparent',
            '&:hover': { borderColor: TERM.green },
          }}>
          <Box component="span">{f.on ? '☑' : '☐'}</Box> {f.label}
        </Box>
      ))}
      <Box sx={{ mt: 1 }}>
        {Object.entries(PIN_STATUS).map(([k, v]) => (
          <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: v.color, flexShrink: 0, border: '1.5px solid #05080a', boxShadow: `0 0 0 1px ${v.color}` }} />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted }}>{v.label}</Typography>
          </Box>
        ))}
      </Box>
    </PanelSection>
  );

  // The audience clickers — which markets render: licensed rec, licensed
  // medical, and hemp-derived THC retail ("bodega THC"). Chains never render
  // at all (server-side exclusion — too hard to pitch).
  const segmentsPanel = (
    <PanelSection title="AUDIENCE" persistKey="jpfm-segments-panel">
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {SEGMENTS.map((seg) => {
          const on = segmentsOn.includes(seg.id);
          return (
            <Box key={seg.id} role="button" tabIndex={0}
              onClick={() => toggleSegment(seg.id)}
              sx={{
                flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 9.5, fontWeight: 900,
                letterSpacing: 0.8, px: 0.5, py: 0.7, cursor: 'pointer', borderRadius: 0.25,
                color: on ? seg.color : TERM.muted,
                border: `1.5px solid ${on ? seg.color : TERM.borderDim}`,
                bgcolor: on ? `${seg.color}14` : 'transparent',
                '&:hover': { borderColor: seg.color },
              }}>
              {on ? '☑' : '☐'} {seg.label}
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.faint, mt: 0.75, lineHeight: 1.4 }}>
        HEMP THC = delta-8 / THCA shops in no-rec states (TX, the South). Chains never show.
      </Typography>
    </PanelSection>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      bgcolor: TERM.bg, color: TERM.text, height: 'calc(100vh - 56px)',
      display: 'flex', flexDirection: 'column', fontFamily: MONO,
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{
        flexShrink: 0, px: { xs: 1.5, sm: 2.5 }, py: 1.25,
        borderBottom: `1px solid ${TERM.border}`,
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%',
            bgcolor: mapReady ? TERM.green : TERM.amber,
            boxShadow: `0 0 8px ${mapReady ? TERM.green : TERM.amber}`,
          }} />
          <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: TERM.green, fontWeight: 700, letterSpacing: 1.5 }}>
            JP.FIELD_MAP // NATIONWIDE
          </Typography>
        </Stack>
        <Chip
          label={loadingArea ? 'LOADING AREA…' : `${visibleDisps.length} IN VIEW`}
          size="small"
          sx={{
            height: 18, fontFamily: MONO, fontSize: 9, fontWeight: 800,
            letterSpacing: 1, borderRadius: 0.5,
            bgcolor: loadingArea ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.15)',
            color: loadingArea ? TERM.amber : TERM.green,
            border: `1px solid ${loadingArea ? TERM.amber : TERM.green}`,
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, letterSpacing: 0.5, display: { xs: 'none', sm: 'block' } }}>
          [ JOINT PRINTING · FIELD OPS ]
        </Typography>
      </Box>

      {/* ── Body: side panel + map ─────────────────────────────────────── */}
      <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0, position: 'relative', pb: { xs: '56px', md: 0 } }}>
        {/* Side panel — desktop */}
        <Box sx={{
          width: 310, flexShrink: 0,
          display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
          overflow: 'auto',
          bgcolor: TERM.panel, borderRight: `1px solid ${TERM.border}`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(74,222,128,0.18) transparent',
        }}>
          <Box sx={{ p: 2 }}>
            {todayPanel}
            {navigatePanel}
            {segmentsPanel}
            {runPanel}
            {filtersPanel}
          </Box>
        </Box>

        {/* Map */}
        <Box sx={{ flexGrow: 1, position: 'relative', minWidth: 0 }}>
          <Box
            ref={mapContainerRef}
            sx={{
              position: 'absolute', inset: 0,
              '& .mapboxgl-ctrl-attrib': { bgcolor: 'rgba(5,8,10,0.7) !important', color: `${TERM.muted} !important`, fontFamily: MONO },
              '& .mapboxgl-ctrl-attrib a': { color: `${TERM.green} !important` },
              '& .mapboxgl-ctrl-group': { bgcolor: `${TERM.panel} !important`, border: `1px solid ${TERM.border}` },
              '& .mapboxgl-ctrl-group button': { filter: 'invert(0.85) hue-rotate(85deg)' },
              '& .mapboxgl-popup-content': { background: 'transparent !important', boxShadow: 'none !important', padding: '0 !important', borderRadius: 0 },
              '& .mapboxgl-popup-tip': { borderTopColor: `${TERM.border} !important`, borderBottomColor: `${TERM.border} !important` },
              '& .mapboxgl-popup-close-button': {
                color: `${TERM.muted} !important`, fontSize: '20px !important',
                padding: '4px 8px !important', top: '4px !important', right: '4px !important',
              },
            }}
          />

          <MapStyleSwitcher current={styleId} onChange={onStyleChange} />

          <Stack spacing={0.75} sx={{ position: 'absolute', top: 60, left: 12, zIndex: 2 }}>
            <Box role="button" tabIndex={0} onClick={() => setHeatmapOn((v) => !v)}
              sx={overlayChipSx(heatmapOn, TERM.red)}>
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%',
                background: heatmapOn ? 'radial-gradient(circle, #f87171 0%, #fbbf24 50%, #4ade80 100%)' : TERM.muted,
              }} />
              DENSITY
            </Box>
          </Stack>

          {zoomedOut && (
            <Box sx={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              zIndex: 2, bgcolor: 'rgba(5,8,10,0.92)', border: `1px solid ${TERM.amber}`,
              color: TERM.amber, px: 2, py: 0.75, borderRadius: 0.5,
              fontFamily: MONO, fontSize: 10.5, fontWeight: 800, letterSpacing: 1,
            }}>
              ZOOM IN TO LOAD DISPENSARIES
            </Box>
          )}

          {mapError && (
            <Box sx={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 2, width: 'calc(100vw - 24px)', maxWidth: 480 }}>
              <Alert severity="error" sx={{
                bgcolor: 'rgba(248,113,113,0.12)', color: TERM.red,
                border: `1px solid ${TERM.red}`, fontFamily: MONO, fontSize: 12,
              }}>MAP_ERROR: {mapError}</Alert>
            </Box>
          )}

          {toast && (
            <Box sx={{
              position: 'absolute', bottom: { xs: 70, sm: 50 }, left: '50%', transform: 'translateX(-50%)',
              zIndex: 3, display: 'flex', alignItems: 'center', gap: 1.5,
              bgcolor: 'rgba(5,8,10,0.95)',
              border: `1px solid ${toast.kind === 'error' ? TERM.red : toast.kind === 'success' ? TERM.green : TERM.borderDim}`,
              color: toast.kind === 'error' ? TERM.red : toast.kind === 'success' ? TERM.green : TERM.text,
              px: 2.5, py: 1, borderRadius: 0.5,
              fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              maxWidth: 'calc(100vw - 32px)',
            }}>
              <Box component="span">{toast.message}</Box>
              {toast.action && (
                <Box role="button" tabIndex={0}
                  onClick={() => { toast.action.fn(); setToast(null); }}
                  sx={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1,
                    px: 1, py: 0.4, cursor: 'pointer', borderRadius: 0.25, flexShrink: 0,
                    color: TERM.cyan, border: `1px solid ${TERM.cyan}`,
                    '&:hover': { bgcolor: 'rgba(6,182,212,0.14)' },
                  }}>{toast.action.label}</Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Mobile TODAY overlay (the day's cockpit) ──────────────────── */}
      {mobileTab === 'today' && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, zIndex: 15,
          bgcolor: TERM.panel, flexDirection: 'column', overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
        }}>
          <Box sx={{ p: 2 }}>{todayPanel}</Box>
        </Box>
      )}

      {/* ── Mobile RUN overlay ────────────────────────────────────────── */}
      {mobileTab === 'run' && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, zIndex: 15,
          bgcolor: TERM.panel, flexDirection: 'column', overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
        }}>
          <Box sx={{ p: 2 }}>{runPanel}</Box>
        </Box>
      )}

      {/* ── Mobile LEADS overlay (search pins + audience + filters) ────── */}
      {mobileTab === 'leads' && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, zIndex: 15,
          bgcolor: TERM.panel, flexDirection: 'column', overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
        }}>
          <Box sx={{ p: 2 }}>
            {navigatePanel}
            {segmentsPanel}
            {filtersPanel}
          </Box>
        </Box>
      )}

      {/* ── Mobile tab bar ────────────────────────────────────────────── */}
      <Box sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
        height: 56, bgcolor: TERM.panel, borderTop: `1px solid ${TERM.border}`,
      }}>
        {[
          { id: 'today', label: 'TODAY', icon: '◎' },
          { id: 'map',   label: 'MAP',   icon: '⊕' },
          { id: 'leads', label: 'LEADS', icon: '⊞' },
          { id: 'run',   label: run?.stops?.length ? `RUN·${visitedCount}/${run.stops.length}` : 'RUN', icon: '◉' },
        ].map((tab) => (
          <Box key={tab.id} role="button" tabIndex={0}
            onClick={() => setMobileTab(tab.id)}
            sx={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: mobileTab === tab.id ? TERM.green : TERM.muted,
              bgcolor: mobileTab === tab.id ? 'rgba(74,222,128,0.08)' : 'transparent',
              borderTop: `2px solid ${mobileTab === tab.id ? TERM.green : 'transparent'}`,
              transition: 'all 0.15s ease', gap: 0.25,
            }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 16, lineHeight: 1 }}>{tab.icon}</Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{tab.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* ── TO-DO modal ────────────────────────────────────────────────── */}
      {todoTarget && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1000,
          bgcolor: 'rgba(5,8,10,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setTodoTarget(null)}>
          <Box sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
            borderRadius: 1, p: 3, width: 340, maxWidth: 'calc(100vw - 32px)', fontFamily: MONO,
          }} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: TERM.amber, letterSpacing: 1, mb: 0.5 }}>
              + TO-DO
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, mb: 2 }}>
              {todoTarget.name} — lands in your CRM Today list.
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
              {TODO_CHIPS.map((c) => (
                <Box key={c.id} role="button"
                  onClick={() => setTodoForm((f) => ({ ...f, chipId: c.id }))}
                  sx={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 800, px: 1.25, py: 0.6, borderRadius: 0.5, cursor: 'pointer',
                    bgcolor: todoForm.chipId === c.id ? TERM.amber : 'transparent',
                    color: todoForm.chipId === c.id ? '#000' : TERM.amber,
                    border: `1px solid ${TERM.amber}`,
                  }}>{c.label}</Box>
              ))}
            </Box>
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>WHEN</Typography>
            <input type="date" value={todoForm.date}
              onChange={(e) => setTodoForm((f) => ({ ...f, date: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 12, colorScheme: 'dark' }} />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>NOTE (optional)</Typography>
            <input value={todoForm.note}
              onChange={(e) => setTodoForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. wants hoodies w/ their logo"
              style={{ ...inputStyle, marginBottom: 16 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box role="button" onClick={saveTodo}
                sx={{
                  flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  bgcolor: TERM.amber, color: '#000', '&:hover': { opacity: 0.9 },
                }}>SAVE TO-DO</Box>
              <Box role="button" onClick={() => setTodoTarget(null)}
                sx={{
                  px: 2, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  border: `1px solid ${TERM.borderDim}`, color: TERM.muted,
                  '&:hover': { color: TERM.text },
                }}>CANCEL</Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── CONTACT capture modal — who did I talk to ─────────────────── */}
      {contactTarget && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1000,
          bgcolor: 'rgba(5,8,10,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setContactTarget(null)}>
          <Box sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
            borderRadius: 1, p: 3, width: 340, maxWidth: 'calc(100vw - 32px)', fontFamily: MONO,
          }} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: TERM.cyan, letterSpacing: 1, mb: 0.5 }}>
              + CONTACT
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, mb: 2 }}>
              {contactTarget.name} — lands on the company card + visit log.
            </Typography>
            <input value={contactForm.name} autoFocus
              onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name — who you talked to"
              style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={contactForm.role}
              onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))}
              placeholder="Position — buyer / manager / owner…"
              style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={contactForm.phone} type="tel"
              onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone (optional)"
              style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={contactForm.email} type="email"
              onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email (optional)"
              style={{ ...inputStyle, marginBottom: 14 }} />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>
              HOW INTERESTED?{contactForm.interest ? ` — ${INTEREST_LABELS[contactForm.interest]}` : ''}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2.25 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Box key={n} role="button"
                  onClick={() => setContactForm((f) => ({ ...f, interest: f.interest === n ? 0 : n }))}
                  sx={{
                    flex: 1, textAlign: 'center', fontSize: 18, py: 0.5, cursor: 'pointer',
                    borderRadius: 0.5, border: `1px solid ${contactForm.interest >= n ? TERM.amber : TERM.borderDim}`,
                    bgcolor: contactForm.interest >= n ? 'rgba(251,191,36,0.12)' : 'transparent',
                    filter: contactForm.interest >= n ? 'none' : 'grayscale(1) opacity(0.45)',
                    '&:hover': { borderColor: TERM.amber },
                  }}>🔥</Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box role="button" onClick={saveContact}
                sx={{
                  flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  bgcolor: contactForm.name.trim() ? TERM.cyan : TERM.borderDim,
                  color: '#000', '&:hover': { opacity: 0.9 },
                }}>SAVE CONTACT</Box>
              <Box role="button" onClick={() => setContactTarget(null)}
                sx={{
                  px: 2, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  border: `1px solid ${TERM.borderDim}`, color: TERM.muted,
                  '&:hover': { color: TERM.text },
                }}>CANCEL</Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Add Custom Stop modal ──────────────────────────────────────── */}
      {showAddCustomPin && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1000,
          bgcolor: 'rgba(5,8,10,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowAddCustomPin(false)}>
          <Box sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
            borderRadius: 1, p: 3, width: 340, maxWidth: 'calc(100vw - 32px)', fontFamily: MONO,
          }} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: TERM.green, letterSpacing: 1, mb: 2 }}>
              + ADD CUSTOM STOP
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>TYPE</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
              {[
                { value: 'friend', label: '🏠 Friend' },
                { value: 'client', label: '💼 Client' },
                { value: 'printer', label: '🖨 Printer' },
                { value: 'other', label: '📌 Other' },
              ].map((t) => (
                <Box key={t.value} role="button"
                  onClick={() => setCustomPinForm((f) => ({ ...f, customType: t.value }))}
                  sx={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700, px: 1, py: 0.5, borderRadius: 0.5, cursor: 'pointer',
                    bgcolor: customPinForm.customType === t.value ? TERM.green : 'transparent',
                    color: customPinForm.customType === t.value ? '#000' : TERM.text,
                    border: `1px solid ${customPinForm.customType === t.value ? TERM.green : TERM.borderDim}`,
                  }}>{t.label}</Box>
              ))}
            </Box>
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>NAME *</Typography>
            <input value={customPinForm.name}
              onChange={(e) => setCustomPinForm((f) => ({ ...f, name: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 12 }} />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>ADDRESS</Typography>
            <input value={customPinForm.address}
              onChange={(e) => setCustomPinForm((f) => ({ ...f, address: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 12 }} />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>NOTES (optional)</Typography>
            <textarea value={customPinForm.notes}
              onChange={(e) => setCustomPinForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 62, marginBottom: 16 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box role="button" onClick={addCustomPin}
                sx={{
                  flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  bgcolor: TERM.green, color: '#000', '&:hover': { opacity: 0.9 },
                }}>ADD TO MAP</Box>
              <Box role="button" onClick={() => setShowAddCustomPin(false)}
                sx={{
                  px: 2, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  border: `1px solid ${TERM.borderDim}`, color: TERM.muted,
                  '&:hover': { color: TERM.text },
                }}>CANCEL</Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
