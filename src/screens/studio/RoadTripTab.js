// src/screens/studio/RoadTripTab.js — the FIELD MAP
//
// Nationwide dispensary prospecting map — the daily on-road cockpit: plan the
// day's route, work it stop by stop, capture leads, and follow the day up.
//
//   - Pins come from OUR database (GET /api/roadtrip/dispensaries?bbox=…) —
//     licensed dispensaries from state rosters (24 rec + 14 medical markets;
//     a roster autopilot keeps them fresh server-side) PLUS stores found free
//     via OpenStreetMap (rec AND medical nets). Panning both reads the DB
//     (instant) AND fires a free OSM sweep of any un-scanned tiles in the
//     viewport — dispensaries just appear as you drive the map. ZERO paid
//     API: no Google Places, no per-store enrichment, no manual state loading.
//   - Rendering is a clustered GeoJSON source (native circles), not HTML
//     markers — thousands of pins stay smooth. Pin color = status (fresh /
//     in-CRM / customer / visited / dead). AUDIENCE clickers pick the
//     markets — rec / med / hemp-THC — plus a CHAINS clicker: MSOs stay
//     hidden by default (rarely pitchable) but the header always shows how
//     many are hidden, so a chain-dominated market is never silently blank.
//   - NAVIGATE searches places AND the dispensary DB by name/city in one box.
//   - PLAN DAY (corridor) is the day builder: from → through → to (where
//     you're sleeping), pick the band, SCAN — the server live-fills the whole
//     route from OSM in one shot, then returns every store in the band in
//     driving order, honoring the audience clickers. Prune, then BUILD DAY.
//   - TODAY'S RUN is the working day: reorder with ▲▼ or OPTIMIZE (from your
//     location) → GO opens Google Maps (legs of 10 — Google's hard cap) →
//     ✓ visited → outcome → LOG VISIT captures the contact + queues tonight's
//     catalog email. FINISH archives the day into the MISSION LOG.
//   - MISSION LOG is the game layer: run streak, all-time totals, and every
//     past day replayable on the map with each stop's CURRENT CRM stage — so
//     yesterday's pitches are tonight's phone follow-ups.
//   - CRM capture happens through the run: marking a stop "pitched" upserts
//     the real CRM company (leadSource "Field Visit", visit logged); + TO-DO
//     writes a next-action into the CRM Today queue. Bulk adds never write
//     the CRM — only explicit captures do (the anti-flooding gate).
//   - CRM state flows back onto the map: pins know their company's stage.
//
// Shared pure logic (gmaps leg chunking, key derivation, pin status, streak
// math) lives in ./_roadTrip.js with tests.

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
import { lsGet, lsSet, lsGetJson, lsSetJson } from '../../common/jpStorage';
import { queuedRequest } from '../../common/offlineSync';
import {
  deriveCompanyKey, TODO_CHIPS, OUTCOME_CHIPS, SEGMENTS, CHAINS_CLICKER, INTEREST_LABELS,
  haversineMi, fmtMi, buildGmapsLegs, PIN_STATUS, pinStatusOf, runStreakDays, historyTotals,
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
// Corridor day planner: the drive's route line + the proposed stops along it.
const CORRIDOR_SRC        = 'jp-corridor-route';
const CORRIDOR_STOPS_SRC  = 'jp-corridor-stops';
const LAYER_CORRIDOR_LINE  = 'jp-corridor-line';
const LAYER_CORRIDOR_STOPS = 'jp-corridor-stop-pts';
// Mission log replay: a past day's stops ghosted onto the map.
const HISTORY_SRC        = 'jp-history-stops';
const LAYER_HISTORY_PTS  = 'jp-history-pts';
const LAYER_HISTORY_NUMS = 'jp-history-nums';

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
  if (d.isChain) badges.push(`<span style="display:inline-block;padding:2px 6px;border:1px solid ${CHAINS_CLICKER.color};color:${CHAINS_CLICKER.color};font-size:9px;font-weight:800;letter-spacing:1px;border-radius:2px;" title="${escapeAttr(d.chainName || 'multi-state chain')}">CHAIN${d.chainName ? ` · ${escapeHtml(truncate(d.chainName, 16).toUpperCase())}` : ''}</span>`);
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

  // AUDIENCE clickers (REC / MED / HEMP-THC + CHAINS) persist across sessions —
  // the owner works one market at a time for days (SEGMENTS mirrors the server
  // vocabulary in services/dispensaryStates.js — keep in sync). Stored under
  // the house jpStorage namespace; the old raw 'jpfm-segments' key migrates on
  // first read.
  const [segmentsOn, setSegmentsOn] = React.useState(() => {
    // Validate BEFORE the emptiness check — a saved array of stale ids must
    // fall through to all-on, not initialize zero clickers against a server
    // that treats the empty param as "no filter".
    const validate = (arr) => (Array.isArray(arr) ? arr.filter((s) => SEGMENTS.some((x) => x.id === s)) : []);
    const saved = validate(lsGetJson('jpfm-audience', null)?.segments);
    if (saved.length) return saved;
    try {
      const legacy = validate(JSON.parse(localStorage.getItem('jpfm-segments') || 'null'));
      if (legacy.length) return legacy;
    } catch { /* fall through */ }
    return SEGMENTS.map((s) => s.id);
  });
  const [chainsOn, setChainsOn] = React.useState(() => !!lsGetJson('jpfm-audience', null)?.chains);
  const persistAudience = (segments, chains) => lsSetJson('jpfm-audience', { segments, chains });
  const toggleSegment = (id) => setSegmentsOn((prev) => {
    // Never allow zero segments — an empty map reads as broken, not filtered.
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    if (!next.length) return prev;
    persistAudience(next, chainsOn);
    return next;
  });
  const toggleChains = () => setChainsOn((prev) => {
    persistAudience(segmentsOn, !prev);
    return !prev;
  });
  const [chainCount, setChainCount] = React.useState(0); // hidden-MSO count for the current view
  const [heatmapOn, setHeatmapOn] = React.useState(false);

  // MISSION LOG — archived days (server FieldRun history) + the replay layer.
  const [history, setHistory] = React.useState({ runs: [], loaded: false });
  const [historyOpen, setHistoryOpen] = React.useState(null);  // { id, run, summary } | null
  const [historyBusyId, setHistoryBusyId] = React.useState(null);
  const [replayId, setReplayId] = React.useState(null);        // run id ghosted on the map
  const replayRef = React.useRef(null);                        // geojson survives style swaps

  // Coverage feedback: a live OSM sweep of new ground is running, and what the
  // viewport's STATE actually holds (from the scan response) — "is it working?"
  // answered on screen: "OH · 174 LICENSED" / "LOADING ROSTER" / "NO LICENSED
  // MARKET" (Indiana isn't broken, it's empty for real).
  const [scanningGround, setScanningGround] = React.useState(false);
  const [coverage, setCoverage] = React.useState(null); // { state, rosterRows, rosterState }

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

  // TODAY cockpit — tonight's catalog queue: stops where the visit capture
  // said "email them the catalog today" and it hasn't gone out yet. (Check-in
  // calls deliberately do NOT live here — the send books them into CRM Today.)
  const [catQueue, setCatQueue] = React.useState({ rows: [], loaded: false });
  const [sendingStopId, setSendingStopId] = React.useState(null);

  // TO-DO modal
  const [todoTarget, setTodoTarget] = React.useState(null);
  const [todoForm, setTodoForm] = React.useState({ chipId: 'mockups', note: '', date: tomorrowISO() });

  // LOG VISIT modal — who I talked to at the counter, who's in charge, notes,
  // and whether to email them the catalog tonight. contactStop remembers which
  // run stop the capture came from (so the stop gets marked visited + queued),
  // and carries a per-capture dedupKey so an offline replay can't double-log.
  const [contactTarget, setContactTarget] = React.useState(null);
  const [contactStop, setContactStop] = React.useState(null); // { stopId, dedupKey }
  const [contactForm, setContactForm] = React.useState({ name: '', role: '', inCharge: '', phone: '', email: '', notes: '', interest: 0, sendCatalog: true });

  // CORRIDOR planner — from where I am, through the towns I pass, to where I'm
  // sleeping: fetch the drive from Mapbox Directions, scan our dispensary DB
  // along the band, prune the out-of-the-way ones, save the rest to the run.
  const [corForm, setCorForm] = React.useState({ from: '', via: '', to: '', bufferMi: 3 });
  const [corBusy, setCorBusy] = React.useState(false);
  const [corPlan, setCorPlan] = React.useState(null);   // { miles, stops:[…] } | null
  const corridorRef = React.useRef(null);               // { geometry, stops } — survives style swaps

  // Location
  const [myLoc, setMyLoc] = React.useState(null);
  const myLocRef = React.useRef(null);
  const myLocMarkerRef = React.useRef(null);
  const [locationSearch, setLocationSearch] = React.useState('');
  const [locationResults, setLocationResults] = React.useState([]);
  const [dispResults, setDispResults] = React.useState([]); // dispensary-name hits from our DB
  const [locationSearching, setLocationSearching] = React.useState(false);
  const searchDebounceRef = React.useRef(null);
  const searchSeqRef = React.useRef(0);

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
    // Corridor plan: the drive as a cyan line + proposed stops as rings. Added
    // here (not in a toggle effect) so a style swap re-creates them; the data
    // itself lives in corridorRef and is re-applied right after.
    if (!map.getSource(CORRIDOR_SRC)) {
      map.addSource(CORRIDOR_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: LAYER_CORRIDOR_LINE, type: 'line', source: CORRIDOR_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': TERM.cyan, 'line-width': 3.5, 'line-opacity': 0.75, 'line-dasharray': [0.1, 1.6] },
      }, map.getLayer(LAYER_CLUSTERS) ? LAYER_CLUSTERS : undefined);
    }
    if (!map.getSource(CORRIDOR_STOPS_SRC)) {
      map.addSource(CORRIDOR_STOPS_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: LAYER_CORRIDOR_STOPS, type: 'circle', source: CORRIDOR_STOPS_SRC,
        paint: {
          'circle-color': 'rgba(6,182,212,0.25)',
          'circle-stroke-color': TERM.cyan,
          'circle-stroke-width': 2,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 7, 11, 11, 15, 14],
        },
      });
    }
    // Mission-log replay: a past day's stops ghosted on the map (amber rings +
    // their day order), so "what did I drive Tuesday" is one tap.
    if (!map.getSource(HISTORY_SRC)) {
      map.addSource(HISTORY_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: LAYER_HISTORY_PTS, type: 'circle', source: HISTORY_SRC,
        paint: {
          'circle-color': 'rgba(251,191,36,0.16)',
          'circle-stroke-color': TERM.amber,
          'circle-stroke-width': 1.5,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 11, 12, 15, 15],
        },
      });
      map.addLayer({
        id: LAYER_HISTORY_NUMS, type: 'symbol', source: HISTORY_SRC,
        layout: {
          'text-field': ['get', 'n'],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 10,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': TERM.amber },
      });
    }
    // Re-hydrate corridor + replay data after a style swap wiped the sources.
    if (corridorRef.current) {
      const { geometry, stops } = corridorRef.current;
      const rs = map.getSource(CORRIDOR_SRC);
      if (rs) rs.setData(geometry ? { type: 'Feature', geometry, properties: {} } : { type: 'FeatureCollection', features: [] });
      const ss = map.getSource(CORRIDOR_STOPS_SRC);
      if (ss) ss.setData({ type: 'FeatureCollection', features: (stops || []).map((d) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: {} })) });
    }
    if (replayRef.current) {
      const hs = map.getSource(HISTORY_SRC);
      if (hs) hs.setData(replayRef.current);
    }
  }, []);

  // ── Feature building ───────────────────────────────────────────────────────
  // No client-side hide filters anymore (the old FILTERS panel thinned an
  // already-capped sample and mostly hid pins people forgot about) — status is
  // told through pin COLOR, and the audience clickers filter server-side.
  const visibleDisps = React.useMemo(
    () => disps.filter((d) => d.lat != null && d.lng != null && isFinite(d.lat) && isFinite(d.lng)),
    [disps]
  );

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
  // A dispensary picked from the search box wants its popup opened once its
  // pin is actually in the loaded set — loadArea consumes this after fetching.
  const pendingPopupRef = React.useRef(null); // { id, coords } | null

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
        ...(chainsOn ? { chains: 'true' } : {}),
      });
      const r = await axios.get(`${api}/api/roadtrip/dispensaries?${params}`, authHdr);
      const rows = r.data?.results || [];
      setDisps(rows);
      setChainCount(r.data?.chainCount || 0);
      // A search-picked dispensary lands here after the fly-to: open its popup.
      const pending = pendingPopupRef.current;
      if (pending && rows.some((d) => String(d._id) === pending.id)) {
        pendingPopupRef.current = null;
        // byIdRef updates in an effect after setDisps commits — defer a tick.
        setTimeout(() => openDispPopupRef.current(pending.id, pending.coords), 60);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Area load failed.', 'error');
    } finally {
      setLoadingArea(false);
    }
  }, [api, token, authHdr, showToast, segmentsOn, chainsOn]);

  const loadAreaRef = React.useRef(loadArea);
  React.useEffect(() => { loadAreaRef.current = loadArea; }, [loadArea]);

  // Free OSM viewport fill. When zoomed into an area, ask the server to sweep
  // any un-scanned tiles on OpenStreetMap (Overpass — no API key, no billing;
  // rec AND medical nets) and upsert new dispensaries into our DB; if it found
  // any, reload the pins. The SERVER is the tile ledger now (per-tile, 30-day
  // TTL over every tile the viewport touches) — the old client-side center-tile
  // guard could skip fringe ground the server had never seen. A cheap "cached"
  // answer is the steady state when panning worked ground; the in-flight guard
  // keeps overlapping pans from stacking requests.
  const scanBusyRef = React.useRef(false);
  const seedingNotifiedRef = React.useRef(new Set()); // one toast per state per session
  const scanOsmArea = React.useCallback(async () => {
    const map = mapRef.current;
    if (!map || !token || map.getZoom() < OSM_SCAN_ZOOM) return;
    if (scanBusyRef.current) return;
    scanBusyRef.current = true;
    const b = map.getBounds();
    try {
      setScanningGround(true);
      const r = await axios.post(`${api}/api/roadtrip/dispensaries/scan-osm`, {
        minLat: b.getSouth(), maxLat: b.getNorth(),
        minLng: b.getWest(), maxLng: b.getEast(),
      }, authHdr);
      if (r.data?.coverage) setCoverage(r.data.coverage);
      // The state under the viewport had no license roster yet — the server just
      // kicked its ingest ("hovering Cleveland, zero OH rows" heals itself).
      // Say so once and refresh as the roster lands (a big state's roster +
      // geocoding can take a few minutes; the header readout tracks it live).
      const seeding = r.data?.seeding;
      if (seeding && !seedingNotifiedRef.current.has(seeding)) {
        seedingNotifiedRef.current.add(seeding);
        showToast(`Loading ${seeding}'s license roster — watch the header count; big states take a few minutes.`, 'info');
        setTimeout(() => loadAreaRef.current(), 60_000);
        setTimeout(() => loadAreaRef.current(), 180_000);
      }
      if (r.data?.error || r.data?.cached || r.data?.skipped) return;
      // OSM finds + (when the ground still looked thin) the budget-capped
      // Google deep-sweep finds — surfaced together as one "new stores" beat.
      const added = (r.data?.added || 0) + (r.data?.gapFill?.added || 0);
      const attached = (r.data?.attached || 0) + (r.data?.gapFill?.attachedToRoster || 0);
      if (added > 0 || attached > 0) {
        loadAreaRef.current(); // surface the fresh finds
        if (added > 0) {
          const deep = r.data?.gapFill?.added || 0;
          showToast(`+${added} new store${added === 1 ? '' : 's'} found on this ground${deep > 0 ? ` (${deep} via deep sweep)` : ''}.`, 'success');
        }
      }
    } catch { /* soft — DB pins already render; a later pan retries */ }
    finally {
      scanBusyRef.current = false;
      setScanningGround(false);
    }
  }, [api, token, authHdr, showToast]);
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

  // Toggling an audience clicker (segment or chains) re-queries the viewport.
  React.useEffect(() => {
    if (mapReady) loadAreaRef.current();
  }, [mapReady, segmentsOn, chainsOn]);

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

  // Tonight's catalog queue — visited stops still owed their catalog email.
  const refreshCatQueue = React.useCallback(async () => {
    try {
      const r = await axios.get(`${api}/api/roadtrip/catalog-queue`, authHdr);
      setCatQueue({ rows: r.data?.rows || [], loaded: true });
    } catch {
      setCatQueue((prev) => ({ ...prev, loaded: true }));
    }
  }, [api, authHdr]);

  // The mission log's scoreboard rows (archived days, newest first).
  const refreshHistory = React.useCallback(async () => {
    try {
      const r = await axios.get(`${api}/api/roadtrip/run/history?limit=60`, authHdr);
      setHistory({ runs: r.data?.runs || [], loaded: true });
    } catch {
      setHistory((prev) => ({ ...prev, loaded: true }));
    }
  }, [api, authHdr]);

  // Fire one queued catalog email. Offline-safe: checking a box in a dead zone
  // queues the request and it goes out when signal returns. The server stamps
  // catalogSentAt (idempotent — a replay is a no-op) and books the ~2-day
  // "did you look at it?" check-in call into CRM Today. Sent rows stay visible
  // with a ✓ (owner's ask: checkbox semantics, not vanishing rows).
  const sendCatalogNow = React.useCallback(async (row) => {
    setSendingStopId(row.stopId);
    try {
      const res = await queuedRequest({
        method: 'post',
        url: `${api}/api/roadtrip/catalog-queue/${row.runId}/${row.stopId}/send`,
        body: {},
        label: `Catalog · ${row.name}`,
      });
      setCatQueue((prev) => ({
        ...prev,
        rows: prev.rows.map((r) => (String(r.stopId) === String(row.stopId) ? { ...r, sent: true } : r)),
      }));
      showToast(
        res.queued
          ? `Catalog to ${row.name} queued — sends when you're back on signal.`
          : `Catalog sent to ${row.email} — check-in call booked ~2 days out (CRM Today).`,
        res.queued ? 'info' : 'success',
      );
      return true;
    } catch (err) {
      const status = err?.response?.status;
      showToast(
        status === 503
          ? 'Email isn\'t configured on the server — set the outreach SMTP env vars, then retry.'
          : (err?.response?.data?.message || 'Catalog send failed.'),
        'error',
      );
      return false;
    } finally {
      setSendingStopId(null);
    }
  }, [api, showToast]);

  // "Check all" — send every unsent catalog in the queue, one after another
  // (sequential so one SMTP hiccup stops the batch instead of spraying errors).
  const [sendingAll, setSendingAll] = React.useState(false);
  const sendAllCatalogs = React.useCallback(async () => {
    const pending = (catQueue.rows || []).filter((r) => r.email && !r.sent);
    if (!pending.length) return;
    setSendingAll(true);
    try {
      for (const row of pending) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await sendCatalogNow(row);
        if (!ok) break;
      }
    } finally {
      setSendingAll(false);
    }
  }, [catQueue.rows, sendCatalogNow]);

  // Save the on-road visit capture: the people land on the company card's
  // contacts (server merges, never replaces — addContacts), the meeting + 🔥
  // interest + notes land in the visit log (with the visit date + address),
  // the card gets the 'road' tag so road-trip leads don't clog the main CRM
  // view, and the stage gets the same promote-only 'contacted' suggestion a
  // pitch does. When "email the catalog tonight" is on, the run stop is queued
  // for tonight's send (which is what books the ~2-day check-in call — so
  // check-ins live in CRM Today, not on the map). Every write is offline-safe
  // (queuedRequest), and the per-capture logDedupKey means a flaky-signal
  // replay can't double-log the visit.
  const saveContact = React.useCallback(async () => {
    const d = contactTarget;
    if (!d || !contactForm.name.trim()) return;
    const key = d?.crm?.companyKey || companyKeyFor(d);
    const who = contactForm.name.trim();
    const role = contactForm.role.trim();
    const inCharge = contactForm.inCharge.trim();
    const email = contactForm.email.trim().toLowerCase();
    const notes = contactForm.notes.trim();
    const wantCatalog = contactForm.sendCatalog && !!email;
    const fire = contactForm.interest > 0 ? ` · interest ${'🔥'.repeat(contactForm.interest)} (${INTEREST_LABELS[contactForm.interest]})` : '';
    const reach = [contactForm.phone.trim(), email].filter(Boolean).join(' · ');
    const contacts = [{ name: who, role, phone: contactForm.phone.trim(), email }];
    if (inCharge && inCharge.toLowerCase() !== who.toLowerCase()) {
      contacts.push({ name: inCharge, role: 'in charge', phone: '', email: '' });
    }
    const body = {
      companyName: d.name,
      address: d.address || '',
      phone: d.phone || '',
      source: 'field-map',
      leadSource: 'Field Visit',
      addContacts: contacts,
      addTags: ['road'],
      logText: `Visited ${d.name} — met ${who}${role ? ` (${role})` : ''}`
        + (contacts.length > 1 ? ` · in charge: ${inCharge}` : '')
        + fire + (reach ? ` · ${reach}` : '') + (notes ? ` · ${notes}` : '')
        + (wantCatalog ? ' · catalog queued for tonight' : ''),
      kind: 'visit',
      ...(contactStop?.dedupKey ? { logDedupKey: contactStop.dedupKey } : {}),
      stageSuggest: 'contacted',
    };
    try {
      const res = await queuedRequest({ method: 'patch', url: `${api}/api/crm/${encodeURIComponent(key)}`, body, label: `Visit · ${d.name}` });
      const realKey = (!res.queued && res.data?.client?.companyKey) || key;
      const stage = (!res.queued && res.data?.client?.stage) || d?.crm?.stage || 'contacted';
      if (d._id) {
        setDisps((prev) => prev.map((x) => (x._id === d._id ? { ...x, crm: { companyKey: realKey, stage } } : x)));
      }
      // Mark the run stop visited + queue tonight's catalog send on it. Same
      // offline machinery — the stop write replays alongside the CRM write.
      let stopQueued = false;
      if (contactStop?.stopId) {
        try {
          const sr = await queuedRequest({
            method: 'patch',
            url: `${api}/api/roadtrip/run/stops/${contactStop.stopId}`,
            body: { status: 'visited', ...(wantCatalog ? { catalogQueued: true } : {}), ...(email ? { contactEmail: email } : {}) },
            label: `Visited · ${d.name}`,
          });
          stopQueued = !!sr.queued;
          if (!sr.queued && sr.data?.run) { setRun(sr.data.run); refreshCatQueue(); }
        } catch { /* stop marking is best-effort — the CRM card already has the visit */ }
      }
      setContactTarget(null);
      setContactStop(null);
      if (res.queued || stopQueued) {
        showToast(`Visit saved offline — will sync when you're back on signal${wantCatalog ? ' (catalog send included)' : ''}.`, 'info');
      } else {
        showToast(
          wantCatalog
            ? `Visit logged — ${d.name} is on tonight's catalog list.`
            : `Visit logged → ${d.name}'s card.`,
          'success', { label: 'OPEN', fn: () => openInCrm({ crm: { companyKey: realKey } }) },
        );
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Visit save failed.', 'error');
    }
  }, [api, contactTarget, contactStop, contactForm, showToast, openInCrm, refreshCatQueue]);

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
    // Catalogs promised on today's visits and not yet emailed. Check-in calls
    // don't show here — sending the catalog books them into CRM Today.
    refreshCatQueue();
    refreshHistory();
  }, [token, api, authHdr, refreshRun, refreshCatQueue, refreshHistory]);

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

  // ── Corridor day planner ─────────────────────────────────────────────────────
  // Geocode one town (same Mapbox endpoint the NAVIGATE search uses).
  const geocodeOne = React.useCallback(async (q) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q.trim())}.json`
      + `?access_token=${config.mapboxToken}&limit=1&country=US`;
    const r = await fetch(url);
    const data = await r.json();
    const f = data.features && data.features[0];
    if (!f) throw new Error(`Couldn't find "${q.trim()}" — try town + state.`);
    return { label: f.place_name.split(',').slice(0, 2).join(','), lat: f.center[1], lng: f.center[0] };
  }, []);

  // Push the current plan onto the map (route line + proposed-stop rings).
  const drawCorridor = React.useCallback((geometry, stops) => {
    corridorRef.current = geometry ? { geometry, stops: stops || [] } : null;
    const map = mapRef.current;
    if (!map) return;
    const rs = map.getSource(CORRIDOR_SRC);
    if (rs) rs.setData(geometry ? { type: 'Feature', geometry, properties: {} } : { type: 'FeatureCollection', features: [] });
    const ss = map.getSource(CORRIDOR_STOPS_SRC);
    if (ss) ss.setData({ type: 'FeatureCollection', features: (stops || []).map((d) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: {} })) });
  }, []);

  // Plan the corridor: geocode FROM (or use my location) / VIA / TO, fetch the
  // drive from Mapbox Directions (browser-side, same public token the geocoder
  // uses), then scan OUR dispensary DB along the band. Needs signal — this is
  // the night-before/morning-of planning step, not an on-road capture.
  const scanCorridor = React.useCallback(async () => {
    setCorBusy(true);
    try {
      let from = null;
      if (corForm.from.trim()) from = await geocodeOne(corForm.from);
      else if (myLocRef.current) from = { label: 'My location', lat: myLocRef.current.lat, lng: myLocRef.current.lng };
      if (!from) { showToast('Set a start — tap 📍 first or type a town.', 'info'); return; }
      if (!corForm.to.trim()) { showToast("Where are you ending the day? Type the town you're sleeping in.", 'info'); return; }
      const to = await geocodeOne(corForm.to);
      const vias = [];
      for (const t of corForm.via.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3)) {
        vias.push(await geocodeOne(t)); // eslint-disable-line no-await-in-loop
      }
      const coords = [from, ...vias, to].map((p) => `${p.lng},${p.lat}`).join(';');
      const dirUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`
        + `?geometries=geojson&overview=full&access_token=${config.mapboxToken}`;
      const dr = await fetch(dirUrl);
      const dd = await dr.json();
      const route = dd.routes && dd.routes[0];
      if (!route) throw new Error(dd.message || 'No drivable route found between those points.');
      const miles = Math.round((route.distance / 1609.34) * 10) / 10;

      // Decimate the polyline (the API caps at 600 points) and scan our DB.
      const line = route.geometry.coordinates;
      const step = Math.max(1, Math.ceil(line.length / 400));
      const points = line.filter((_, i) => i % step === 0 || i === line.length - 1)
        .map(([lng, lat]) => ({ lat, lng }));
      // The server live-fills the whole route band from OSM (one free query),
      // then returns every store in the band in driving order — honoring the
      // same audience clickers the map uses, chains included only when on.
      const resp = await axios.post(`${api}/api/roadtrip/dispensaries/corridor`, {
        points,
        bufferMi: corForm.bufferMi,
        segments: segmentsOn.join(','),
        chains: chainsOn,
      }, authHdr);
      const stops = resp.data?.results || [];
      const fill = resp.data?.fill || null;
      const seedingStates = resp.data?.seedingStates || [];
      setCorPlan({ miles, stops, fromLabel: from.label, toLabel: to.label, fill, seedingStates });
      drawCorridor(route.geometry, stops);
      const b = new mapboxgl.LngLatBounds();
      line.forEach((c) => b.extend(c));
      mapRef.current?.fitBounds(b, { padding: 70 });
      const fresh = fill && !fill.failed && fill.added > 0 ? ` (+${fill.added} found live)` : '';
      const degraded = fill && fill.failed ? ' — live route scan unavailable, showing known stores' : '';
      const seedNote = seedingStates.length
        ? ` Loading ${seedingStates.join('/')} license roster${seedingStates.length === 1 ? '' : 's'} now — re-scan in ~2 min to pick those up.`
        : '';
      showToast(stops.length
        ? `${stops.length} dispos along the ${miles} mi drive${fresh}${degraded} — ✕ the out-of-the-way ones, then BUILD DAY.${seedNote}`
        : `Route found (${miles} mi) — nothing in the band${degraded}.${seedNote || ' Widen it?'}`, stops.length ? 'success' : 'info');
    } catch (err) {
      showToast(err?.response?.data?.message || err.message || 'Corridor scan failed.', 'error');
    } finally {
      setCorBusy(false);
    }
  }, [api, authHdr, corForm, segmentsOn, chainsOn, geocodeOne, drawCorridor, showToast]);

  // Prune one proposed stop (his "remove the unnecessarily-out-of-the-way ones").
  const removeCorStop = React.useCallback((d) => {
    setCorPlan((prev) => {
      if (!prev) return prev;
      const stops = prev.stops.filter((x) => String(x._id) !== String(d._id));
      drawCorridor(corridorRef.current && corridorRef.current.geometry, stops);
      return { ...prev, stops };
    });
  }, [drawCorridor]);

  const clearCorridor = React.useCallback(() => {
    setCorPlan(null);
    drawCorridor(null, []);
  }, [drawCorridor]);

  // Commit the pruned plan to Today's Run (bulk add; server dedupes + resolves
  // CRM matches per stop, capped at 80 server-side).
  const addCorridorToRun = React.useCallback(async () => {
    const ids = (corPlan?.stops || []).map((d) => String(d._id));
    if (!ids.length) return;
    try {
      const r = await axios.post(`${api}/api/roadtrip/run/stops`, { dispensaryIds: ids }, authHdr);
      if (r.data?.run) setRun(r.data.run);
      setRunMiles(null);
      const added = r.data?.added || 0;
      showToast(added
        ? `${added} stop${added === 1 ? '' : 's'} on the day${r.data?.capped ? ' (server caps a single add at 80 — trim and re-add the rest)' : ''}. Hit ⚡ OPTIMIZE when you're rolling.`
        : 'All of those are already on the day.', added ? 'success' : 'info');
      clearCorridor();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Could not add the corridor to the run.', 'error');
    }
  }, [api, authHdr, corPlan, showToast, clearCorridor]);

  // Manual reorder — move a stop up/down the day list. Optimistic local swap,
  // then persist the full order via PATCH /run {stopOrder} (already supported
  // server-side; visited stops keep their place at the head). Rapid taps fire
  // overlapping PATCHes — only the LATEST request's response may touch state,
  // or a slow earlier response visibly reverts the newer optimistic order.
  const moveSeqRef = React.useRef(0);
  const moveStop = React.useCallback(async (stop, dir) => {
    const stops = [...(run?.stops || [])].sort((a, b) => a.order - b.order);
    const i = stops.findIndex((s) => String(s._id) === String(stop._id));
    const j = i + dir;
    if (i < 0 || j < 0 || j >= stops.length) return;
    [stops[i], stops[j]] = [stops[j], stops[i]];
    setRun((prev) => (prev ? { ...prev, stops: stops.map((s, k) => ({ ...s, order: k })) } : prev));
    setRunMiles(null);
    const seq = ++moveSeqRef.current;
    try {
      const r = await axios.patch(`${api}/api/roadtrip/run`, { stopOrder: stops.map((s) => String(s._id)) }, authHdr);
      if (seq === moveSeqRef.current && r.data?.run) setRun(r.data.run);
    } catch {
      if (seq !== moveSeqRef.current) return; // a newer reorder owns the tray
      showToast('Reorder failed — refreshing.', 'error');
      refreshRun();
    }
  }, [api, authHdr, run, refreshRun, showToast]);

  // ── Mission log (run history) ──────────────────────────────────────────────
  // Ghost a past day onto the map (amber rings numbered in drive order).
  const drawReplay = React.useCallback((runDoc) => {
    const stops = (runDoc?.stops || []).filter((s) => isFinite(s.lat) && isFinite(s.lng));
    const data = {
      type: 'FeatureCollection',
      features: stops.map((s, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { n: String(i + 1) },
      })),
    };
    replayRef.current = stops.length ? data : null;
    const src = mapRef.current?.getSource(HISTORY_SRC);
    if (src) src.setData(data);
    if (stops.length && mapRef.current) {
      const b = new mapboxgl.LngLatBounds();
      stops.forEach((s) => b.extend([s.lng, s.lat]));
      mapRef.current.fitBounds(b, { padding: 80, maxZoom: 12 });
    }
  }, []);

  const clearReplay = React.useCallback(() => {
    setReplayId(null);
    replayRef.current = null;
    const src = mapRef.current?.getSource(HISTORY_SRC);
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
  }, []);

  // Open one archived day: full stops + each stop's CURRENT CRM stage.
  const openHistoryRun = React.useCallback(async (summary) => {
    if (historyOpen?.id === String(summary._id)) { setHistoryOpen(null); return; }
    setHistoryBusyId(String(summary._id));
    try {
      const r = await axios.get(`${api}/api/roadtrip/run/history/${summary._id}`, authHdr);
      setHistoryOpen({ id: String(summary._id), run: r.data?.run || null, summary: r.data?.summary || summary });
    } catch {
      showToast('Could not load that day.', 'error');
    } finally {
      setHistoryBusyId(null);
    }
  }, [api, authHdr, historyOpen, showToast]);

  const completeRun = React.useCallback(async () => {
    try {
      const r = await axios.post(`${api}/api/roadtrip/run/complete`, {}, authHdr);
      setRun(null);
      setRunMiles(null);
      // The day's scoreboard, straight to the face — then it lives in the log.
      const done = r.data?.run;
      const v = (done?.stops || []).filter((s) => s.status === 'visited').length;
      const p = (done?.stops || []).filter((s) => s.outcome === 'pitched').length;
      const q = (done?.stops || []).filter((s) => s.catalogQueued).length;
      showToast(`DAY COMPLETE — ${v} visited · ${p} pitched · ${q} catalog${q === 1 ? '' : 's'} queued. Logged.`, 'success');
      refreshHistory();
    } catch {
      showToast('Finish run failed.', 'error');
    }
  }, [api, authHdr, showToast, refreshHistory]);

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

  // ── Search: places AND dispensaries in one box ─────────────────────────────
  // "philadelphia" used to be a pure camera fly-to — the box never searched
  // dispensaries at all. Now every query races the Mapbox geocoder AND our own
  // DB name/city search; a store hit flies straight to its pin and pops it.
  // Debounced (the old version geocoded every keystroke), sequence-guarded so
  // a slow early response can't clobber a fresh one.
  const runSearch = React.useCallback(async (query) => {
    const q = query.trim();
    if (!q) { setLocationResults([]); setDispResults([]); return; }
    const seq = ++searchSeqRef.current;
    setLocationSearching(true);
    try {
      const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
        + `?access_token=${config.mapboxToken}&limit=4&country=US`;
      const [geo, disp] = await Promise.allSettled([
        fetch(geoUrl).then((r) => r.json()),
        axios.get(`${api}/api/roadtrip/dispensaries/find?q=${encodeURIComponent(q)}`, authHdr),
      ]);
      if (seq !== searchSeqRef.current) return; // superseded by newer keystrokes
      setLocationResults(geo.status === 'fulfilled' ? (geo.value.features || []) : []);
      setDispResults(disp.status === 'fulfilled' ? (disp.value.data?.results || []) : []);
    } finally {
      if (seq === searchSeqRef.current) setLocationSearching(false);
    }
  }, [api, authHdr]);

  const queueSearch = React.useCallback((query) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runSearch(query), 280);
  }, [runSearch]);

  const clearSearch = () => {
    setLocationSearch('');
    setLocationResults([]);
    setDispResults([]);
  };

  // Picking a dispensary hit: fly to the pin, and once the viewport load
  // includes it, its popup opens (pendingPopupRef consumed by loadArea).
  const pickDispResult = React.useCallback((d) => {
    pendingPopupRef.current = { id: String(d._id), coords: [d.lng, d.lat] };
    mapRef.current?.flyTo({ center: [d.lng, d.lat], zoom: 14, essential: true, duration: 1200 });
    clearSearch();
    if (window.innerWidth < 900) setMobileTab('map');
  }, []);

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

  const pickPlaceResult = (f) => {
    const [lng, lat] = f.center;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 11.5, essential: true, duration: 1200 });
    clearSearch();
    if (window.innerWidth < 900) setMobileTab('map');
  };
  // GO / Enter takes the top hit — a store beats a place (that's the search
  // people actually mean when they type a dispensary's name).
  const goTopHit = () => {
    if (dispResults.length) pickDispResult(dispResults[0]);
    else if (locationResults.length) pickPlaceResult(locationResults[0]);
    else if (locationSearch.length > 1) runSearch(locationSearch);
  };

  const navigatePanel = (
    <PanelSection title="NAVIGATE" persistKey="jpfm-nav">
      <Box sx={{ mb: 1.25 }}>
        <Box sx={{ position: 'relative', display: 'flex', gap: 0.5 }}>
          <Box sx={{ position: 'relative', flexGrow: 1 }}>
            <input
              value={locationSearch}
              onChange={(e) => {
                setLocationSearch(e.target.value);
                if (e.target.value.trim().length > 1) queueSearch(e.target.value);
                else { setLocationResults([]); setDispResults([]); }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') goTopHit(); }}
              placeholder="City, address, or dispensary name…"
              style={{ ...inputStyle, padding: '8px 32px 8px 10px', border: `1.5px solid ${TERM.border}`, background: 'rgba(74,222,128,0.04)', fontSize: 11.5, letterSpacing: 0.3 }}
            />
            {locationSearching && (
              <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: TERM.amber, fontFamily: MONO }}>…</Box>
            )}
          </Box>
          <Box role="button" tabIndex={0}
            onClick={goTopHit}
            sx={{
              fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1,
              color: TERM.greenDk, px: 1.25, flexShrink: 0, cursor: 'pointer', borderRadius: 0.5,
              bgcolor: TERM.green, border: `1.5px solid ${TERM.green}`,
              display: 'flex', alignItems: 'center',
              '&:hover': { opacity: 0.88 },
            }}>GO</Box>
        </Box>
        {(dispResults.length > 0 || locationResults.length > 0) && (
          <Box sx={{ mt: 0.5, border: `1px solid ${TERM.border}`, borderRadius: 0.5, overflow: 'hidden' }}>
            {dispResults.map((d) => {
              const seg = SEGMENTS.find((s) => s.id === d.segment);
              return (
                <Box key={String(d._id)} role="button" tabIndex={0}
                  onClick={() => pickDispResult(d)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.9,
                    fontFamily: MONO, fontSize: 10.5, color: TERM.text, px: 1.25, py: 0.85,
                    cursor: 'pointer', borderBottom: `1px solid ${TERM.borderDim}`,
                    '&:hover': { bgcolor: 'rgba(74,222,128,0.08)', color: TERM.green },
                  }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: seg ? seg.color : TERM.muted, boxShadow: `0 0 6px ${seg ? seg.color : TERM.muted}80` }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color: 'inherit' }}>
                      {d.name}{d.isChain ? ' · CHAIN' : ''}
                    </Typography>
                    <Typography noWrap sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted }}>
                      {d.address || d.state}{d.verified ? ' · licensed' : ''}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            {locationResults.map((f) => (
              <Box key={f.id} role="button" tabIndex={0}
                onClick={() => pickPlaceResult(f)}
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
          <Typography sx={{ fontFamily: MONO, fontSize: 9.5, color: TERM.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
            No day built yet. PLAN DAY maps your whole drive — from where you are, through the towns you pass, to tonight's camp — and lines up every dispensary along it in driving order. Or tap any pin → ＋ ADD TO RUN.
          </Typography>
        </Box>
      )}

      {/* Tonight's catalog sends — promises made at the counter today. Each
          send books its own ~2-day check-in call into CRM Today (check-ins
          live in the CRM, not here). */}
      {todayHdr(`CATALOGS TO SEND TONIGHT${catQueue.rows.length ? ` · ${catQueue.rows.filter((r) => !r.sent).length || '✓'}` : ''}`)}
      {!catQueue.loaded ? (
        <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, p: 1 }}>loading…</Typography>
      ) : !catQueue.rows.length ? (
        <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, p: 1, border: `1px solid ${TERM.borderDim}`, borderRadius: 0.5 }}>
          no catalogs owed ✓ — log a visit with an email and it lands here for tonight's send
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {catQueue.rows.filter((r) => r.email && !r.sent).length > 1 && (
            <Box role="button" tabIndex={0} onClick={() => !sendingAll && sendAllCatalogs()}
              sx={{
                fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1, textAlign: 'center',
                py: { xs: 1.1, md: 0.8 }, cursor: 'pointer', borderRadius: 0.5,
                color: sendingAll ? TERM.amber : TERM.greenDk,
                bgcolor: sendingAll ? 'transparent' : TERM.green,
                border: `1.5px solid ${sendingAll ? TERM.amber : TERM.green}`, '&:hover': { opacity: 0.9 },
              }}>
              {sendingAll ? 'SENDING ALL…' : `📬 SEND ALL (${catQueue.rows.filter((r) => r.email && !r.sent).length})`}
            </Box>
          )}
          {catQueue.rows.map((row) => {
            const busyRow = sendingStopId === row.stopId;
            return (
              <Box key={String(row.stopId)}
                role="button" tabIndex={0}
                onClick={() => row.email && !row.sent && !busyRow && sendCatalogNow(row)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  border: `1px solid ${row.sent ? TERM.green : TERM.amber}`, borderRadius: 0.5,
                  p: { xs: 1.25, md: 1 },
                  bgcolor: row.sent ? 'rgba(74,222,128,0.06)' : 'rgba(251,191,36,0.06)',
                  cursor: row.email && !row.sent ? 'pointer' : 'default',
                  '&:hover': row.email && !row.sent ? { borderColor: TERM.green } : {},
                }}>
                {/* Checkbox: ☐ owed → ✓ sent. Tapping the row sends. */}
                <Box sx={{
                  width: 22, height: 22, flexShrink: 0, borderRadius: 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: MONO, fontSize: 14, fontWeight: 900,
                  color: row.sent ? TERM.greenDk : (row.email ? TERM.amber : TERM.muted),
                  bgcolor: row.sent ? TERM.green : 'transparent',
                  border: `1.5px solid ${row.sent ? TERM.green : (row.email ? TERM.amber : TERM.borderDim)}`,
                }}>
                  {busyRow ? '…' : (row.sent ? '✓' : '')}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color: TERM.text, textDecoration: row.sent ? 'line-through' : 'none', opacity: row.sent ? 0.7 : 1 }}>
                    {row.name}
                  </Typography>
                  <Typography noWrap sx={{ fontFamily: MONO, fontSize: 9, color: row.sent ? TERM.green : TERM.muted }}>
                    {row.sent ? `sent to ${row.email} ✓ · check-in booked`
                      : (row.email || 'no email captured — add one via + LOG VISIT')}
                  </Typography>
                </Box>
              </Box>
            );
          })}
          <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
            check a store (or SEND ALL) to email the catalog — each send books the "did you look at it?" call ~2 days out in CRM Today
          </Typography>
        </Stack>
      )}
    </Box>
  );

  // PLAN DAY — the day builder: from → through → to (tonight's camp), scan the
  // band along the drive (server live-fills the route from OSM first), ✕ the
  // out-of-the-way ones, BUILD DAY sends the rest to Today's Run in drive order.
  const corridorPanel = (
    <PanelSection title={`PLAN DAY${corPlan ? ` · ${corPlan.stops.length}` : ''}`} persistKey="jpfm-corridor">
      {!corPlan ? (
        <Stack spacing={0.75}>
          <input value={corForm.from} onChange={(e) => setCorForm((f) => ({ ...f, from: e.target.value }))}
            placeholder={myLoc ? 'From — leave blank to use my 📍' : 'From — town, ST'}
            style={inputStyle} />
          <input value={corForm.via} onChange={(e) => setCorForm((f) => ({ ...f, via: e.target.value }))}
            placeholder="Through (optional) — towns, comma-separated"
            style={inputStyle} />
          <input value={corForm.to} onChange={(e) => setCorForm((f) => ({ ...f, to: e.target.value }))}
            placeholder="To — where you're sleeping tonight"
            style={inputStyle} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1 }}>BAND</Typography>
            {[2, 3, 5, 8, 12].map((m) => (
              <Box key={m} role="button" onClick={() => setCorForm((f) => ({ ...f, bufferMi: m }))}
                sx={{ px: 1, py: 0.3, borderRadius: 0.5, cursor: 'pointer', fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
                  color: corForm.bufferMi === m ? TERM.cyan : TERM.muted,
                  border: `1px solid ${corForm.bufferMi === m ? TERM.cyan : TERM.borderDim}`,
                  '&:hover': { color: TERM.cyan } }}>
                {m}mi
              </Box>
            ))}
          </Box>
          <Box role="button" tabIndex={0} onClick={() => !corBusy && scanCorridor()}
            sx={{
              fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1, textAlign: 'center',
              py: 0.9, cursor: 'pointer', borderRadius: 0.5,
              color: corBusy ? TERM.amber : '#06272e', bgcolor: corBusy ? 'transparent' : TERM.cyan,
              border: `1.5px solid ${corBusy ? TERM.amber : TERM.cyan}`, '&:hover': { opacity: 0.9 },
            }}>
            {corBusy ? 'SCANNING…' : '🛣 SCAN MY ROUTE'}
          </Box>
          <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
            Maps the whole day: your drive + every dispo within the band, in driving order — the route gets a live scan first, so nothing on the way is missed. Honors the AUDIENCE clickers. Needs signal — plan before you roll.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={0.5}>
          <Typography sx={{ fontFamily: MONO, fontSize: 9.5, color: TERM.muted, lineHeight: 1.5 }}>
            {corPlan.fromLabel} → {corPlan.toLabel} · {corPlan.miles} mi
            {corPlan.fill && !corPlan.fill.failed && corPlan.fill.added > 0 ? ` · +${corPlan.fill.added} found live` : ''}
            {corPlan.fill && corPlan.fill.failed ? ' · live scan unavailable (known stores only)' : ''}
            {' '}· ✕ what's out of the way
          </Typography>
          <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
            <Stack spacing={0.4}>
              {corPlan.stops.map((d, i) => (
                <Box key={String(d._id)} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, border: `1px solid ${TERM.borderDim}`, borderRadius: 0.5, px: 0.75, py: 0.5 }}>
                  <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.cyan, fontWeight: 800, width: 18, flexShrink: 0 }}>{i + 1}</Typography>
                  <Box role="button" onClick={() => mapRef.current && mapRef.current.flyTo({ center: [d.lng, d.lat], zoom: 12.5 })}
                    title="Show on the map"
                    sx={{ minWidth: 0, cursor: 'pointer', flex: 1 }}>
                    <Typography noWrap sx={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: TERM.text }}>{d.name}</Typography>
                    <Typography noWrap sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted }}>
                      {d.distanceMi} mi off route{d.crm && d.crm.stage ? ` · ${d.crm.stage}` : ''}{d.lastVisitedAt ? ' · visited before' : ''}
                    </Typography>
                  </Box>
                  <Box role="button" onClick={() => removeCorStop(d)} title="Prune — unnecessarily out of the way"
                    sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 900, color: TERM.muted, cursor: 'pointer', px: 0.5, '&:hover': { color: TERM.red } }}>✕</Box>
                </Box>
              ))}
            </Stack>
          </Box>
          {corPlan.stops.length > 0 && (
            <Box role="button" tabIndex={0} onClick={addCorridorToRun}
              sx={{
                fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1, textAlign: 'center',
                py: 0.9, cursor: 'pointer', borderRadius: 0.5, color: TERM.greenDk, bgcolor: TERM.green,
                border: `1.5px solid ${TERM.green}`, '&:hover': { opacity: 0.9 },
              }}>
              ⚑ BUILD DAY — {corPlan.stops.length} STOP{corPlan.stops.length === 1 ? '' : 'S'} IN DRIVE ORDER
            </Box>
          )}
          <Box role="button" onClick={clearCorridor}
            sx={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textAlign: 'center', py: 0.6,
              cursor: 'pointer', borderRadius: 0.5, color: TERM.muted, border: `1px solid ${TERM.borderDim}`,
              '&:hover': { color: TERM.text } }}>CLEAR PLAN</Box>
        </Stack>
      )}
    </PanelSection>
  );

  const runPanel = (
    <PanelSection title={`TODAY'S RUN · ${run?.stops?.length || 0}`} persistKey="jpfm-run">
      {(!run || !run.stops?.length) ? (
        <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, lineHeight: 1.55, py: 0.5, fontStyle: 'italic' }}>
          Empty day. Build it with PLAN DAY (your whole drive in order, ending at camp) or tap any pin → ＋ ADD TO RUN.
        </Typography>
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

          {/* Day progress — the "mission bar": visited fill + pitched ticks. */}
          <Box sx={{ mb: 0.6, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: `1px solid ${TERM.borderDim}` }}>
            <Box sx={{
              width: `${run.stops.length ? Math.round((visitedCount / run.stops.length) * 100) : 0}%`,
              height: '100%', bgcolor: TERM.green, boxShadow: `0 0 10px ${TERM.green}`,
              transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </Box>
          <Typography sx={{ fontFamily: MONO, fontSize: 9.5, color: TERM.muted, letterSpacing: 0.5, mb: 1 }}>
            {visitedCount}/{run.stops.length} visited
            <Box component="span" sx={{ color: TERM.green }}> · ⚡{(run.stops || []).filter((s) => s.outcome === 'pitched').length} pitched</Box>
            <Box component="span" sx={{ color: TERM.amber }}> · 📬{(run.stops || []).filter((s) => s.catalogQueued).length} queued</Box>
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
                        // One dedupKey per capture session — offline replays of
                        // this save can't double-log, but a second visit (or a
                        // corrected re-save) gets a fresh key.
                        setContactStop({ stopId: String(s._id), dedupKey: `visit:${s._id}:${Date.now()}` });
                        setContactForm({ name: '', role: '', inCharge: '', phone: '', email: s.contactEmail || '', notes: '', interest: 0, sendCatalog: true });
                        setOutcomeStopId(null);
                      }}
                      sx={{
                        fontFamily: MONO, fontSize: { xs: 11, md: 8.5 }, fontWeight: 900, letterSpacing: 0.5,
                        px: { xs: 1.4, md: 0.9 }, py: { xs: 0.8, md: 0.4 }, borderRadius: 0.25, cursor: 'pointer',
                        color: TERM.cyan, border: `1px dashed ${TERM.cyan}`,
                        '&:hover': { bgcolor: 'rgba(6,182,212,0.12)' },
                      }}>+ LOG VISIT</Box>
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

  // The audience clickers — which markets render: licensed rec, licensed
  // medical, hemp-derived THC retail ("bodega THC"), and the CHAINS clicker
  // (MSOs hidden by default but never silently — the count is always shown).
  // Pin colors carry the status story, so the old FILTERS panel is gone.
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
      <Box role="button" tabIndex={0}
        onClick={toggleChains}
        sx={{
          mt: 0.5, textAlign: 'center', fontFamily: MONO, fontSize: 9.5, fontWeight: 900,
          letterSpacing: 0.8, px: 0.5, py: 0.7, cursor: 'pointer', borderRadius: 0.25,
          color: chainsOn ? CHAINS_CLICKER.color : TERM.muted,
          border: `1.5px solid ${chainsOn ? CHAINS_CLICKER.color : TERM.borderDim}`,
          bgcolor: chainsOn ? `${CHAINS_CLICKER.color}14` : 'transparent',
          '&:hover': { borderColor: CHAINS_CLICKER.color },
        }}>
        {chainsOn ? '☑' : '☐'} {CHAINS_CLICKER.label}
        {!chainsOn && chainCount > 0 ? ` · +${chainCount} hidden here` : ''}
      </Box>
      <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.faint, mt: 0.75, lineHeight: 1.4 }}>
        HEMP THC = delta-8 / THCA shops in no-rec states (TX, the South). CHAINS = MSO stores (Curaleaf, RISE…) — usually corporate-buy, but never hidden without a count.
      </Typography>
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

  // ── MISSION LOG — the game layer: streak, all-time score, and every past
  // day expandable + replayable on the map with live CRM stages. ─────────────
  const streak = runStreakDays(history.runs);
  const totals = historyTotals(history.runs);
  const historyPanel = (
    <PanelSection title={`MISSION LOG${history.runs.length ? ` · ${history.runs.length}` : ''}`} persistKey="jpfm-log" defaultOpen={false}>
      {!history.loaded ? (
        <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, p: 1 }}>loading…</Typography>
      ) : !history.runs.length ? (
        <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, p: 1, border: `1px solid ${TERM.borderDim}`, borderRadius: 0.5 }}>
          no days logged yet — FINISH a run and it lands here with its scoreboard
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {streak.days > 0 && (
              <Box sx={{
                fontFamily: MONO, fontSize: 9.5, fontWeight: 900, letterSpacing: 0.5, px: 1, py: 0.5,
                borderRadius: 0.5, color: TERM.amber, border: `1px solid ${TERM.amber}`, bgcolor: 'rgba(251,191,36,0.08)',
              }}>🔥 {streak.days}-DAY STREAK</Box>
            )}
            <Box sx={{
              fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, px: 1, py: 0.5,
              borderRadius: 0.5, color: TERM.muted, border: `1px solid ${TERM.borderDim}`,
            }}>{totals.visited} visited · {totals.pitched} pitched · {totals.miles}mi all-time</Box>
          </Box>
          {replayId && (
            <Box role="button" tabIndex={0} onClick={clearReplay}
              sx={{
                fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textAlign: 'center', py: 0.6,
                cursor: 'pointer', borderRadius: 0.5, color: TERM.amber, border: `1px dashed ${TERM.amber}`,
                '&:hover': { bgcolor: 'rgba(251,191,36,0.1)' },
              }}>CLEAR REPLAY FROM MAP</Box>
          )}
          <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
            <Stack spacing={0.4}>
              {history.runs.map((r) => {
                const open = historyOpen?.id === String(r._id);
                const when = r.date ? new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : r.label;
                return (
                  <Box key={String(r._id)} sx={{ border: `1px solid ${open ? TERM.amber : TERM.borderDim}`, borderRadius: 0.5 }}>
                    <Box role="button" tabIndex={0} onClick={() => openHistoryRun(r)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.6, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(251,191,36,0.05)' } }}>
                      <Typography sx={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: TERM.text, width: 46, flexShrink: 0 }}>
                        {historyBusyId === String(r._id) ? '…' : when}
                      </Typography>
                      <Typography noWrap sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, flex: 1 }}>
                        {r.visited}/{r.stops} ✓ · ⚡{r.pitched}{r.catalogsSent ? ` · 📬${r.catalogsSent}` : ''}{r.miles ? ` · ${r.miles}mi` : ''}
                      </Typography>
                      <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.amber, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</Typography>
                    </Box>
                    {open && historyOpen?.run && (
                      <Box sx={{ borderTop: `1px solid ${TERM.borderDim}`, p: 0.75 }}>
                        <Box role="button" tabIndex={0}
                          onClick={() => { setReplayId(String(r._id)); drawReplay(historyOpen.run); if (window.innerWidth < 900) setMobileTab('map'); }}
                          sx={{
                            fontFamily: MONO, fontSize: 9.5, fontWeight: 900, letterSpacing: 1, textAlign: 'center', py: 0.6, mb: 0.6,
                            cursor: 'pointer', borderRadius: 0.5, color: TERM.amber, border: `1px solid ${TERM.amber}`,
                            bgcolor: replayId === String(r._id) ? 'rgba(251,191,36,0.14)' : 'transparent',
                            '&:hover': { bgcolor: 'rgba(251,191,36,0.1)' },
                          }}>{replayId === String(r._id) ? '◉ ON THE MAP' : '⟲ REPLAY ON MAP'}</Box>
                        <Stack spacing={0.3}>
                          {(historyOpen.run.stops || []).map((s, i) => (
                            <Box key={String(s._id)} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                              <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.amber, width: 14, flexShrink: 0 }}>{i + 1}</Typography>
                              <Typography noWrap sx={{
                                fontFamily: MONO, fontSize: 9.5, color: s.status === 'visited' ? TERM.text : TERM.muted, flex: 1, minWidth: 0,
                                textDecoration: s.status === 'visited' ? 'none' : 'line-through', textDecorationColor: TERM.faint,
                              }}>{s.name}</Typography>
                              {s.outcome && (
                                <Typography sx={{ fontFamily: MONO, fontSize: 8, color: s.outcome === 'pitched' ? TERM.green : TERM.muted, flexShrink: 0 }}>
                                  {s.outcome === 'pitched' ? '⚡' : s.outcome === 'no_buyer' ? '∅' : '✕'}
                                </Typography>
                              )}
                              {s.crm ? (
                                <Box role="button" tabIndex={0}
                                  onClick={() => onNavigate && onNavigate({ view: 'crm', companyKey: s.crm.companyKey })}
                                  sx={{
                                    fontFamily: MONO, fontSize: 8, fontWeight: 800, px: 0.5, py: 0.15, borderRadius: 0.25,
                                    color: TERM.cyan, border: `1px solid ${TERM.cyan}`, cursor: 'pointer', flexShrink: 0,
                                    '&:hover': { bgcolor: 'rgba(6,182,212,0.12)' },
                                  }}>{String(s.crm.stage || 'lead').toUpperCase()} ↗</Box>
                              ) : null}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Stack>
      )}
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
        {/* ONE stable status chip — constant layout, so mobile never reflows on
            pan. The dot tells the story: pulsing amber = loading the area,
            pulsing cyan = live OSM scan of new ground, solid green = idle. The
            coverage suffix reports what the viewport's STATE actually holds. */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.75,
          height: 18, px: 1, borderRadius: 0.5,
          bgcolor: 'rgba(74,222,128,0.12)', border: `1px solid ${TERM.green}`,
          fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1, color: TERM.green,
          whiteSpace: 'nowrap',
        }}>
          <Box sx={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            bgcolor: loadingArea ? TERM.amber : scanningGround ? TERM.cyan : TERM.green,
            boxShadow: `0 0 6px ${loadingArea ? TERM.amber : scanningGround ? TERM.cyan : TERM.green}`,
            ...(loadingArea || scanningGround ? {
              animation: 'jpfm-pulse 1s ease-in-out infinite',
              '@keyframes jpfm-pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
            } : {}),
          }} />
          {visibleDisps.length} IN VIEW
          {coverage && (
            <Box component="span" sx={{ color: TERM.muted }}>
              · {coverage.state}{' '}
              {coverage.rosterRows > 0 ? `${coverage.rosterRows} LICENSED`
                : coverage.rosterState ? 'LOADING ROSTER' : 'NO LICENSED MARKET'}
            </Box>
          )}
        </Box>
        {!chainsOn && chainCount > 0 && (
          <Chip
            label={`+${chainCount} CHAINS`}
            size="small"
            onClick={toggleChains}
            sx={{
              height: 18, fontFamily: MONO, fontSize: 9, fontWeight: 800,
              letterSpacing: 1, borderRadius: 0.5, cursor: 'pointer',
              bgcolor: 'transparent', color: CHAINS_CLICKER.color,
              border: `1px dashed ${CHAINS_CLICKER.color}`,
              '&:hover': { bgcolor: `${CHAINS_CLICKER.color}1a` },
            }}
          />
        )}
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
            {corridorPanel}
            {segmentsPanel}
            {runPanel}
            {historyPanel}
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

      {/* ── Mobile PLAN overlay (search + day builder + audience) ──────── */}
      {mobileTab === 'plan' && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, zIndex: 15,
          bgcolor: TERM.panel, flexDirection: 'column', overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
        }}>
          <Box sx={{ p: 2 }}>
            {navigatePanel}
            {corridorPanel}
            {segmentsPanel}
          </Box>
        </Box>
      )}

      {/* ── Mobile LOG overlay (the mission log) ───────────────────────── */}
      {mobileTab === 'log' && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, zIndex: 15,
          bgcolor: TERM.panel, flexDirection: 'column', overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
        }}>
          <Box sx={{ p: 2 }}>{historyPanel}</Box>
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
          { id: 'plan',  label: 'PLAN',  icon: '⊞' },
          { id: 'run',   label: run?.stops?.length ? `RUN·${visitedCount}/${run.stops.length}` : 'RUN', icon: '◉' },
          { id: 'log',   label: 'LOG',   icon: '▤' },
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

      {/* ── LOG VISIT modal — who I met, who runs the place, notes, catalog ── */}
      {contactTarget && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1000,
          bgcolor: 'rgba(5,8,10,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => { setContactTarget(null); setContactStop(null); }}>
          <Box sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
            borderRadius: 1, p: 3, width: 340, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)',
            overflowY: 'auto', fontFamily: MONO,
          }} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: TERM.cyan, letterSpacing: 1, mb: 0.5 }}>
              LOG VISIT
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, mb: 2 }}>
              {contactTarget.name} — saves the visit (date + address) on the company card.
            </Typography>
            <input value={contactForm.name} autoFocus
              onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Who you spoke to"
              style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={contactForm.role}
              onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))}
              placeholder="Their position — buyer / manager / owner…"
              style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={contactForm.inCharge}
              onChange={(e) => setContactForm((f) => ({ ...f, inCharge: e.target.value }))}
              placeholder="Person in charge (if someone else)"
              style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={contactForm.phone} type="tel"
              onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone (optional)"
              style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={contactForm.email} type="email"
              onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email — needed to send the catalog"
              style={{ ...inputStyle, marginBottom: 8 }} />
            <textarea value={contactForm.notes} rows={2}
              onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes — what they carry, objections, specifics…"
              style={{ ...inputStyle, marginBottom: 14, resize: 'vertical', minHeight: 44 }} />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>
              HOW INTERESTED?{contactForm.interest ? ` — ${INTEREST_LABELS[contactForm.interest]}` : ''}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5 }}>
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
            <Box role="button"
              onClick={() => setContactForm((f) => ({ ...f, sendCatalog: !f.sendCatalog }))}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 2.25, p: 1, cursor: 'pointer',
                borderRadius: 0.5, border: `1px solid ${contactForm.sendCatalog ? TERM.amber : TERM.borderDim}`,
                bgcolor: contactForm.sendCatalog ? 'rgba(251,191,36,0.08)' : 'transparent',
              }}>
              <Box component="span" sx={{ fontSize: 14 }}>{contactForm.sendCatalog ? '📬' : '▢'}</Box>
              <Box>
                <Typography sx={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: contactForm.sendCatalog ? TERM.amber : TERM.muted }}>
                  EMAIL THE CATALOG TONIGHT
                </Typography>
                <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted, lineHeight: 1.4 }}>
                  {contactForm.email.trim()
                    ? 'lands on tonight\'s send list — the check-in call books ~2 days after the send'
                    : 'add their email above to queue the catalog'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box role="button" onClick={saveContact}
                sx={{
                  flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  bgcolor: contactForm.name.trim() ? TERM.cyan : TERM.borderDim,
                  color: '#000', '&:hover': { opacity: 0.9 },
                }}>SAVE VISIT</Box>
              <Box role="button" onClick={() => { setContactTarget(null); setContactStop(null); }}
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
