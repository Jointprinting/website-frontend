// src/screens/studio/RoadTripTab.js  (Phase 3b)
//
// What's new vs phase 2a:
//   - 4 big layer toggle tiles (DISPENSARIES / COFFEE / PARKS / CAMPING)
//   - Map style switcher (DARK / SATELLITE / STREETS)
//   - Real pins on the map for each active layer
//   - Click any pin → info popup with phone, website, "Save as Lead" button
//   - Chain dispensaries get an amber ring around their pin (visual cue)
//   - "Search this area" badge appears after you pan/zoom significantly
//   - Coordinate readout section is collapsible (state persisted)
//   - Pin counts live-update in the side panel
//
// Architecture notes:
//   - Markers are HTML elements (not Mapbox-native circles) so we can style
//     them with full CSS, animate them in, and put a chain ring around the
//     dispensary ones. Fine up to a few hundred markers; if we ever exceed
//     that we'd migrate to a GeoJSON source with native rendering.
//   - markersRef holds DOM refs by layer so toggling off is O(1) cleanup.
//   - Popups use setDOMContent with handlers attached inline so each pin
//     captures its own place data without any global state.

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

// ─────────────────────────────────────────────────────────────────────────────
// Terminal palette (mirrored from phase 2a)
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
  text:     '#d4f4dd',
  muted:    'rgba(212,244,221,0.5)',
  faint:    'rgba(212,244,221,0.18)',
};
const MONO = 'ui-monospace, "JetBrains Mono", "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';
const INITIAL_CENTER = [-74.5, 40.5];
const INITIAL_ZOOM   = 6.2;

// ─────────────────────────────────────────────────────────────────────────────
// Layer + style definitions
// ─────────────────────────────────────────────────────────────────────────────
const LAYERS = [
  {
    id:    'dispensaries',
    label: 'DISPENSARIES',
    short: 'DISP',
    color: '#4ade80', // green — cannabis association
    icon:  '🌿',
    endpoint: '/api/roadtrip/search/dispensaries',
    defaultRadius: 20000,
    kind:  'lead',    // dispensaries are sales prospects
  },
  {
    id:    'coffee',
    label: 'COFFEE',
    short: 'CAFE',
    color: '#c69d6f', // warm tan — coffee beans
    icon:  '💻',
    endpoint: '/api/roadtrip/search/coffee',
    defaultRadius: 10000,
    kind:  'stop',
  },
  {
    id:    'parks',
    label: 'PARKS',
    short: 'PARK',
    color: '#06b6d4', // cyan — water/sky/nature, distinct from disp green
    icon:  '🌲',
    endpoint: '/api/roadtrip/search/parks',
    defaultRadius: 150000, // 150km — parks worth driving to on a trip
    kind:  'stop',
  },
  {
    id:    'campgrounds',
    label: 'CAMPING',
    short: 'CAMP',
    color: '#ef4444', // red — campfire, distinct from coffee tan
    icon:  '⛺',
    endpoint: '/api/roadtrip/search/campgrounds',
    defaultRadius: 50000,
    kind:  'stop',
  },
];

const MAP_STYLES = [
  { id: 'dark',      label: 'DARK', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'satellite', label: 'SAT',  url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'streets',   label: 'STR',  url: 'mapbox://styles/mapbox/streets-v12' },
];

const SALES_STATUSES = [
  { value: 'planned',          label: 'PLANNED',       color: 'rgba(212,244,221,0.5)' },
  { value: 'pre_called',       label: 'PRE-CALLED',    color: '#84cc16' },
  { value: 'visited',          label: 'VISITED',       color: '#fbbf24' },
  { value: 'buyer_identified', label: 'BUYER ID',      color: '#06b6d4' },
  { value: 'pitched',          label: 'PITCHED',       color: '#a78bfa' },
  { value: 'catalog_sent',     label: 'CATALOG SENT',  color: '#a855f7' },
  { value: 'mockup_needed',    label: 'MOCKUP NEEDED', color: '#f97316' },
  { value: 'quote_needed',     label: 'QUOTE NEEDED',  color: '#fbbf24' },
  { value: 'follow_up',        label: 'FOLLOW-UP',     color: '#4ade80' },
  { value: 'won',              label: 'WON ✓',         color: '#4ade80' },
  { value: 'dead',             label: 'DEAD',          color: '#6b7280' },
];
const SCORE_OPTIONS = [
  { value: 'A', label: 'A', color: '#4ade80' },
  { value: 'B', label: 'B', color: '#fbbf24' },
  { value: 'C', label: 'C', color: '#6b7280' },
  { value: '',  label: '?', color: 'rgba(212,244,221,0.18)' },
];
// eslint-disable-next-line no-unused-vars
const ITEM_TAGS = ['T-shirts','Hoodies','Staff uniforms','Hats','Tote bags','Lighters','Rolling trays','Grinders','Lanyards','Stickers','Display/signage'];

// ─────────────────────────────────────────────────────────────────────────────
// Marker DOM builder
//
// IMPORTANT: Mapbox positions markers by setting CSS `transform` on the
// marker's outer element (e.g. `translate(-50%, -50%) translate(123px, 456px)`).
// If we set `transform` on that same element for our hover scale, we
// clobber Mapbox's positioning and the pin teleports to coordinate 0,0.
//
// Fix: outer wrapper has zero styling (Mapbox owns its transform); a child
// `inner` element holds the dot, ring, and scale animation.
// ─────────────────────────────────────────────────────────────────────────────
function buildMarkerEl(layer, place) {
  const wrap = document.createElement('div');
  wrap.className = 'jp-marker-wrap';
  // No inline style on wrap — Mapbox manages this element's transform.

  const inner = document.createElement('div');
  inner.className = 'jp-marker-inner';
  inner.style.cssText = `
    position: relative;
    width: 22px; height: 22px;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
    display: flex; align-items: center; justify-content: center;
  `;

  // Chain ring (only on dispensary chains)
  if (place.isChain) {
    const ring = document.createElement('div');
    ring.style.cssText = `
      position: absolute; inset: -4px;
      border: 1.5px dashed ${TERM.amber};
      border-radius: 50%;
      opacity: 0.85;
    `;
    inner.appendChild(ring);
  }

  // Main dot
  const dot = document.createElement('div');
  dot.style.cssText = `
    width: 14px; height: 14px;
    border-radius: 50%;
    background: ${layer.color};
    border: 2px solid #05080a;
    box-shadow: 0 0 0 1px ${layer.color}, 0 0 12px ${layer.color}80;
  `;
  inner.appendChild(dot);

  // Drop-in animation on the inner element
  inner.animate(
    [{ transform: 'scale(0)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
    { duration: 380, easing: 'cubic-bezier(0.34,1.56,0.64,1)' }
  );

  // Hover bounce — scales the INNER element so we don't fight Mapbox.
  wrap.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.4)'; });
  wrap.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)'; });

  wrap.appendChild(inner);
  return wrap;
}

// Popup HTML/DOM
function buildPopupContent({ place, layer, onSave, onHide, savedAsLeadId, hideAvailable, currentDayLabel }) {
  const div = document.createElement('div');
  div.style.cssText = `
    font-family: ${MONO};
    color: ${TERM.text};
    background: ${TERM.panel};
    border: 1px solid ${TERM.border};
    border-radius: 4px;
    padding: 12px 14px;
    min-width: 240px;
    max-width: 320px;
  `;

  const chainBadge = place.chainName
    ? `<span style="display:inline-block;padding:2px 6px;border:1px solid ${TERM.amber};color:${TERM.amber};font-size:9px;font-weight:800;letter-spacing:1px;border-radius:2px;margin-left:6px;">CHAIN · ${escapeHtml(place.chainName)}</span>`
    : '';

  const lines = [
    `<div style="font-weight:800;font-size:13px;color:${layer.color};letter-spacing:0.5px;margin-bottom:6px;line-height:1.3;">${escapeHtml(place.name)}${chainBadge}</div>`,
  ];

  if (place.address) {
    lines.push(`<div style="font-size:11px;color:${TERM.muted};margin-bottom:4px;line-height:1.4;">${escapeHtml(place.address)}</div>`);
  }
  if (place.phone) {
    lines.push(`<div style="font-size:11px;color:${TERM.text};margin-bottom:2px;">[TEL] <a href="tel:${escapeAttr(place.phone)}" style="color:${TERM.green};text-decoration:none;">${escapeHtml(place.phone)}</a></div>`);
  }
  if (place.website) {
    const url = escapeAttr(place.website);
    lines.push(`<div style="font-size:11px;color:${TERM.text};margin-bottom:2px;"><a href="${url}" target="_blank" rel="noopener" style="color:${TERM.green};text-decoration:none;">[WEB] ${escapeHtml(truncate(place.website, 38))}</a></div>`);
  }
  if (place.extras?.googleMapsUri) {
    lines.push(`<div style="font-size:11px;color:${TERM.text};margin-bottom:2px;"><a href="${escapeAttr(place.extras.googleMapsUri)}" target="_blank" rel="noopener" style="color:${TERM.green};text-decoration:none;">[MAPS] open in google maps</a></div>`);
  }
  if (place.rating != null) {
    lines.push(`<div style="font-size:11px;color:${TERM.muted};margin-top:4px;">[RATING] ${place.rating.toFixed(1)} ★ (${place.extras?.ratingCount ?? '—'} reviews)</div>`);
  }

  div.innerHTML = lines.join('');

  // Button row
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;';

  const dayUpper = formatDayLabel(currentDayLabel || 'Day 1').toUpperCase();
  const saveLabel    = `＋ ADD TO ${dayUpper}`;
  const savedLabel   = `✓ IN ITINERARY`;
  const savingLabel  = 'ADDING…';

  const saveBtn = document.createElement('button');
  const savedNow = !!savedAsLeadId;
  saveBtn.textContent = savedNow ? savedLabel : saveLabel;
  saveBtn.disabled   = savedNow;
  saveBtn.style.cssText = btnStyle(savedNow ? 'success' : 'primary');
  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true;
    saveBtn.textContent = savingLabel;
    onSave(place, layer)
      .then(() => { saveBtn.textContent = savedLabel; saveBtn.style.cssText = btnStyle('success'); })
      .catch((e) => { saveBtn.disabled = false; saveBtn.textContent = saveLabel; saveBtn.style.cssText = btnStyle('primary');
        window.alert(e?.response?.data?.message || 'Save failed.');
      });
  });
  btnRow.appendChild(saveBtn);

  if (hideAvailable) {
    const hideBtn = document.createElement('button');
    hideBtn.textContent = '⊘ NOT A DISPENSARY';
    hideBtn.style.cssText = btnStyle('danger');
    hideBtn.addEventListener('click', () => {
      if (!window.confirm(`Hide "${place.name}" from future dispensary searches?`)) return;
      onHide(place);
    });
    btnRow.appendChild(hideBtn);
  }
  div.appendChild(btnRow);

  return div;
}

// Small style helpers for the popup buttons
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
  return base;
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return escapeHtml(s); }
function truncate(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function formatDayLabel(label) {
  if (!label || label === 'Unassigned') return label;
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const d = new Date(label + 'T12:00:00');
    if (!isNaN(d.getTime()))
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return label;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function nextAvailDateISO(existingDays) {
  const dates = existingDays.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!dates.length) return todayISO();
  const last = new Date(dates[dates.length - 1] + 'T12:00:00');
  last.setDate(last.getDate() + 1);
  return last.toISOString().slice(0, 10);
}
function statusMeta(value) {
  return SALES_STATUSES.find(s => s.value === value) || SALES_STATUSES[0];
}
function scoreMeta(value) {
  return SCORE_OPTIONS.find(s => s.value === value) || SCORE_OPTIONS[3];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function LayerToggleTile({ layer, active, loading, count, onClick }) {
  const isOn = active && !loading;
  return (
    <Box
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      sx={{
        position: 'relative',
        flex: 1, minWidth: 0, height: 56, px: 1.5,
        bgcolor: isOn ? `${layer.color}1a` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isOn ? layer.color : TERM.borderDim}`,
        borderLeft: `3px solid ${isOn ? layer.color : 'rgba(212,244,221,0.18)'}`,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 1.25,
        transition: 'all 0.2s ease',
        userSelect: 'none',
        '&:hover': {
          bgcolor: isOn ? `${layer.color}25` : 'rgba(255,255,255,0.04)',
          borderColor: layer.color,
          boxShadow: isOn ? `0 0 18px ${layer.color}40` : 'none',
        },
      }}
    >
      <Box sx={{
        width: 30, height: 30, borderRadius: 0.5,
        bgcolor: isOn ? layer.color : 'rgba(212,244,221,0.06)',
        color: isOn ? '#000' : TERM.muted,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, flexShrink: 0,
        transition: 'all 0.2s ease',
      }}>
        {layer.icon}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{
          fontFamily: MONO, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5,
          color: isOn ? layer.color : TERM.muted, lineHeight: 1,
        }}>
          {layer.label}
        </Typography>
        <Typography sx={{
          fontFamily: MONO, fontSize: 13, fontWeight: 700,
          color: isOn ? TERM.text : TERM.muted, lineHeight: 1.4,
        }}>
          {loading
            ? <span style={{ color: TERM.amber }}>loading…</span>
            : isOn
              ? <span>{count} <Box component="span" sx={{ color: TERM.muted, fontSize: 10 }}>active</Box></span>
              : <Box component="span" sx={{ color: TERM.muted, fontSize: 11 }}>tap to load</Box>}
        </Typography>
      </Box>
      {isOn && (
        <Box sx={{
          width: 6, height: 6, borderRadius: '50%',
          bgcolor: layer.color, boxShadow: `0 0 8px ${layer.color}`,
          animation: 'jpPulse 1.6s ease-in-out infinite',
          '@keyframes jpPulse': {
            '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 },
          },
        }} />
      )}
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
          <Box key={s.id}
            role="button" tabIndex={0}
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

function PanelSection({ title, defaultOpen = true, persistKey, children }) {
  const [open, setOpen] = React.useState(() => {
    if (!persistKey) return defaultOpen;
    try {
      const v = localStorage.getItem(persistKey);
      return v == null ? defaultOpen : v === '1';
    } catch { return defaultOpen; }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (persistKey) {
      try { localStorage.setItem(persistKey, next ? '1' : '0'); } catch {}
    }
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
        <Box component="span" sx={{ color: TERM.green, fontSize: 10, transition: 'transform 0.18s ease',
          display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        }}>▼</Box>
        ─── {title} ───
      </Box>
      {open && <Box>{children}</Box>}
    </Box>
  );
}

// Small inline action button used by itinerary stop rows (↑/↓/→/×).
const actionBtnSx = (color, hoverColor) => ({
  fontFamily: MONO, fontSize: 11, fontWeight: 800,
  color, px: 0.5, py: 0, minWidth: 16, cursor: 'pointer',
  borderRadius: 0.25, lineHeight: 1.2,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid transparent',
  '&:hover': { color: hoverColor, borderColor: hoverColor, bgcolor: `${hoverColor}1a` },
});

function Stat({ label, value, color = TERM.text }) {  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline"
      sx={{ borderBottom: `1px dashed ${TERM.borderDim}`, py: 0.75 }}>
      <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, letterSpacing: 0.5 }}>
        [{label}]
      </Typography>
      <Typography sx={{ fontFamily: MONO, fontSize: 12, color, fontWeight: 600 }}>
        {value}
      </Typography>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────
export default function RoadTripTab({ token }) {
  const mapContainerRef = React.useRef(null);
  const mapRef          = React.useRef(null);

  const [styleId, setStyleId]   = React.useState('dark');
  const [mapReady, setMapReady] = React.useState(false);
  const [mapError, setMapError] = React.useState('');

  // Per-layer state — just for UI counts/loading. Markers themselves live
  // in markersRef so React state churn doesn't force GC / re-render of
  // hundreds of DOM nodes.
  const [layerState, setLayerState] = React.useState(() => {
    const init = {};
    for (const l of LAYERS) init[l.id] = { active: false, loading: false, count: 0, lastSearchAt: null };
    return init;
  });

  // Saved items (leads + stops). Full objects in state so we can render a
  // list in the side panel. leadsByExtIdRef is derived from this — refs are
  // used because popup builders run outside React's render cycle.
  const markersRef       = React.useRef({ dispensaries: [], coffee: [], parks: [], campgrounds: [] });
  const leadsByExtIdRef  = React.useRef(new Map());
  const [savedItems, setSavedItems] = React.useState([]);
  const [toast, setToast] = React.useState(null);

  // Itinerary state — which day is currently selected for new saves, and
  // which days have their route line drawn on the map.
  const [mobilePanelOpen, setMobilePanelOpen] = React.useState(false);
  const [currentDayLabel, setCurrentDayLabel] = React.useState(todayISO);
  const [routesShown, setRoutesShown] = React.useState({}); // dayLabel -> true
  // Route layer registry. Tracks the source/layer IDs we've added so we
  // can clean them up on toggle-off or style change. Lives in a ref because
  // it shadows the map's own state, not React's.
  const routeLayersRef = React.useRef({}); // dayLabel -> { sourceId, layerId }

  // Location search state
  const [locationSearch, setLocationSearch] = React.useState('');
  const [locationResults, setLocationResults] = React.useState([]);
  const [locationSearching, setLocationSearching] = React.useState(false);
  const [showAddCustomPin, setShowAddCustomPin] = React.useState(false);
  const [customPinForm, setCustomPinForm] = React.useState({ name: '', address: '', notes: '', customType: 'friend' });
  const [editingStop, setEditingStop] = React.useState(null);
  const [movingStopId, setMovingStopId] = React.useState(null);

  // Distinct route colors per day so multi-day overlays don't blur together.
  const DAY_ROUTE_COLORS = ['#4ade80', '#06b6d4', '#fbbf24', '#ef4444', '#a855f7', '#f472b6', '#84cc16', '#f97316'];
  const colorForDay = React.useCallback((label) => {
    // Stable hash so the same day always gets the same color
    let h = 0;
    for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) & 0xffff;
    return DAY_ROUTE_COLORS[h % DAY_ROUTE_COLORS.length];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the externalId map in sync with savedItems for popup logic.
  React.useEffect(() => {
    const m = new Map();
    for (const s of savedItems) {
      if (s.externalId) m.set(s.externalId, s._id);
    }
    leadsByExtIdRef.current = m;
  }, [savedItems]);

  // Derive day groupings from savedItems
  const itinerary = React.useMemo(() => {
    const byDay = new Map();
    for (const item of savedItems) {
      const day = item.dayLabel || 'Unassigned';
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(item);
    }
    // Sort each day's items by sortOrder, then createdAt
    for (const list of byDay.values()) {
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
                       || (new Date(a.createdAt) - new Date(b.createdAt)));
    }
    // Sort days: ISO dates first (sorted), then Day N labels, then Unassigned last
    const dayList = Array.from(byDay.entries()).sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      const aIsDate = /^\d{4}-\d{2}-\d{2}$/.test(a);
      const bIsDate = /^\d{4}-\d{2}-\d{2}$/.test(b);
      if (aIsDate && bIsDate) return a.localeCompare(b);
      if (aIsDate && !bIsDate) return -1;
      if (!aIsDate && bIsDate) return 1;
      const na = parseInt(a.replace(/[^0-9]/g, ''), 10);
      const nb = parseInt(b.replace(/[^0-9]/g, ''), 10);
      if (isFinite(na) && isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });
    return dayList; // [['Day 1', [items]], ['Day 2', [items]], ...]
  }, [savedItems]);

  // All known day labels (used by the day picker)
  const knownDays = React.useMemo(() => {
    const set = new Set(itinerary.map(([d]) => d).filter((d) => d !== 'Unassigned'));
    set.add(todayISO()); // always at least one option
    if (currentDayLabel) set.add(currentDayLabel);
    return Array.from(set).sort((a, b) => {
      const aIsDate = /^\d{4}-\d{2}-\d{2}$/.test(a);
      const bIsDate = /^\d{4}-\d{2}-\d{2}$/.test(b);
      if (aIsDate && bIsDate) return a.localeCompare(b);
      if (aIsDate && !bIsDate) return -1;
      if (!aIsDate && bIsDate) return 1;
      const na = parseInt(a.replace(/[^0-9]/g, ''), 10);
      const nb = parseInt(b.replace(/[^0-9]/g, ''), 10);
      if (isFinite(na) && isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [itinerary, currentDayLabel]);

  const stopCount = savedItems.length;

  // Has the map moved since the last search? Used to show the "refresh"
  // badge. Reset whenever we kick a new search off.
  const [mapMoved, setMapMoved] = React.useState(false);
  const lastSearchCenterRef = React.useRef(null);

  // ── Init map ─────────────────────────────────────────────────────────────
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
        setMapError(msg);
      });
      map.on('move', () => {
        // We don't display lat/lng/zoom anymore, but we still watch how far
        // the map has drifted from the last search center so the
        // "↻ SEARCH THIS AREA" badge can appear at the right moment.
        if (lastSearchCenterRef.current) {
          const c = map.getCenter();
          const dx = c.lng - lastSearchCenterRef.current.lng;
          const dy = c.lat - lastSearchCenterRef.current.lat;
          if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) setMapMoved(true);
        }
      });
      mapRef.current = map;
    } catch (err) {
      setMapError(err.message || 'Failed to initialize map.');
    }
    return () => {
      try { mapRef.current?.remove(); } catch {}
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initial saved-items load — populates the SAVED panel + popup state ──
  React.useEffect(() => {
    if (!token) return;
    axios.get(`${config.backendUrl}/api/roadtrip/leads`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      setSavedItems(r.data || []);
    }).catch(() => {});
  }, [token]);

  // ── Style switching — preserves layers ───────────────────────────────────
  const onStyleChange = (id) => {
    if (!mapRef.current) return;
    const style = MAP_STYLES.find((s) => s.id === id);
    if (!style || id === styleId) return;

    // Mapbox wipes all custom sources/layers when the style changes. Capture
    // which day routes were visible so we can recreate them after load.
    const wasShown = Object.keys(routesShown);
    routeLayersRef.current = {};

    setStyleId(id);
    mapRef.current.setStyle(style.url);
    mapRef.current.once('style.load', () => {
      // Re-add previously visible routes
      wasShown.forEach((day) => { refreshRouteForDay(day); });
      // markers persist on the map automatically; nothing else to do.
    });
  };

  // ── Pin handlers ─────────────────────────────────────────────────────────
  const showToast = (message, kind = 'info') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2400);
  };

  const onSaveLead = async (place, layer) => {
    // Compute next sortOrder for current day so item lands at the end of the list
    const existingInDay = savedItems.filter((s) => (s.dayLabel || 'Unassigned') === currentDayLabel);
    const nextOrder = existingInDay.length === 0
      ? 0
      : Math.max(...existingInDay.map((s) => s.sortOrder ?? 0)) + 1;

    const body = {
      source:     place.source,
      externalId: place.externalId,
      name:       place.name,
      address:    place.address,
      phone:      place.phone,
      website:    place.website,
      lat:        place.lat,
      lng:        place.lng,
      type:       layer.id === 'parks' ? 'park_national'
                : layer.id === 'campgrounds' ? 'campground'
                : layer.id === 'coffee' ? 'coffee'
                : 'dispensary',
      kind:       layer.kind || 'lead',
      status:     'planned',
      dayLabel:   currentDayLabel,
      sortOrder:  nextOrder,
    };
    const r = await axios.post(
      `${config.backendUrl}/api/roadtrip/leads`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setSavedItems((prev) => [r.data, ...prev]);
    // If this day already has its route drawn, refresh it to include the new stop.
    if (routesShown[currentDayLabel]) {
      // Defer one tick so savedItems state has updated
      setTimeout(() => refreshRouteForDay(currentDayLabel), 0);
    }
    showToast(`Added "${place.name}" to ${formatDayLabel(currentDayLabel)}.`, 'success');
  };

  const deleteSavedItem = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from your itinerary?`)) return;
    try {
      await axios.delete(
        `${config.backendUrl}/api/roadtrip/leads/${item._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedItems((prev) => prev.filter((s) => s._id !== item._id));
      const day = item.dayLabel || 'Unassigned';
      // Refresh that day's route if it was shown — but only if at least 2
      // stops remain. Else just hide it.
      if (routesShown[day]) {
        const remaining = savedItems.filter(
          (s) => (s.dayLabel || 'Unassigned') === day && s._id !== item._id
        );
        if (remaining.length >= 2) setTimeout(() => refreshRouteForDay(day), 0);
        else hideRouteForDay(day);
      }
      showToast(`Removed "${item.name}".`, 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed.', 'error');
    }
  };

  const flyToSaved = (item) => {
    if (!mapRef.current || !isFinite(item.lat) || !isFinite(item.lng)) return;
    mapRef.current.flyTo({
      center: [item.lng, item.lat], zoom: 14, essential: true, duration: 1400,
    });
  };

  const onHideDispensary = async (place) => {    try {
      await axios.post(
        `${config.backendUrl}/api/roadtrip/denylist`,
        { placeId: place.externalId, name: place.name, reason: 'not a real dispensary' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Remove that marker from the map immediately.
      const list = markersRef.current.dispensaries || [];
      const i = list.findIndex((m) => m.__placeId === place.externalId);
      if (i >= 0) { list[i].marker.remove(); list.splice(i, 1); }
      setLayerState((s) => ({
        ...s,
        dispensaries: { ...s.dispensaries, count: (s.dispensaries.count || 1) - 1 },
      }));
      showToast(`Hidden "${place.name}" — won't show in future dispensary searches.`, 'success');
    } catch (err) {
      showToast('Failed to hide.', 'error');
    }
  };

  // ── Itinerary helpers ────────────────────────────────────────────────────

  /**
   * Returns sorted stops for a given day. Pure helper — no side effects.
   */
  const stopsForDay = React.useCallback((dayLabel) => {
    return savedItems
      .filter((s) => (s.dayLabel || 'Unassigned') === dayLabel)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
                   || (new Date(a.createdAt) - new Date(b.createdAt)));
  }, [savedItems]);

  /**
   * Fetches a driving route through the given coordinates from Mapbox
   * Directions API. Returns GeoJSON LineString plus total distance/duration.
   */
  const fetchRoute = async (coords) => {
    if (!coords || coords.length < 2) return null;
    const path = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}`
      + `?access_token=${config.mapboxToken}&geometries=geojson&overview=full`;
    const r = await fetch(url);
    const data = await r.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'No route found.');
    }
    return data.routes[0];
  };

  /**
   * Draws (or re-draws) the route line for a given day. Idempotent — call it
   * again after stops change to refresh. Sets routesShown[day] = true.
   */
  const refreshRouteForDay = React.useCallback(async (dayLabel) => {
    if (!mapRef.current) return;
    const stops = savedItems
      .filter((s) => (s.dayLabel || 'Unassigned') === dayLabel)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (stops.length < 2) {
      showToast(`${dayLabel} needs at least 2 stops for a route.`, 'error');
      return;
    }
    try {
      const route = await fetchRoute(stops.map((s) => [s.lng, s.lat]));
      const sourceId = `jp-route-src-${dayLabel.replace(/\s+/g, '-')}`;
      const layerId  = `jp-route-layer-${dayLabel.replace(/\s+/g, '-')}`;
      const geojson = { type: 'Feature', properties: {}, geometry: route.geometry };

      // If already drawn, just update the source data. Else add fresh.
      if (mapRef.current.getSource(sourceId)) {
        mapRef.current.getSource(sourceId).setData(geojson);
      } else {
        mapRef.current.addSource(sourceId, { type: 'geojson', data: geojson });
        mapRef.current.addLayer({
          id: layerId, type: 'line', source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': colorForDay(dayLabel),
            'line-width': 4,
            'line-opacity': 0.85,
          },
        });
      }
      routeLayersRef.current[dayLabel] = { sourceId, layerId };
      setRoutesShown((prev) => ({ ...prev, [dayLabel]: true }));

      // Fit the map to the route bounds
      const coords = geojson.geometry.coordinates;
      if (coords.length) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        mapRef.current.fitBounds(bounds, { padding: 60, duration: 1200 });
      }
    } catch (err) {
      showToast(err.message || 'Route lookup failed.', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedItems, colorForDay]);

  const hideRouteForDay = React.useCallback((dayLabel) => {
    const reg = routeLayersRef.current[dayLabel];
    if (reg && mapRef.current) {
      try { if (mapRef.current.getLayer(reg.layerId))  mapRef.current.removeLayer(reg.layerId); } catch {}
      try { if (mapRef.current.getSource(reg.sourceId)) mapRef.current.removeSource(reg.sourceId); } catch {}
    }
    delete routeLayersRef.current[dayLabel];
    setRoutesShown((prev) => {
      const next = { ...prev }; delete next[dayLabel]; return next;
    });
  }, []);

  const toggleRouteForDay = (dayLabel) => {
    if (routesShown[dayLabel]) hideRouteForDay(dayLabel);
    else refreshRouteForDay(dayLabel);
  };

  /**
   * Adds a new day at the end (Day N+1). Sets it as current so subsequent
   * pin clicks add stops to it.
   */
  const addNewDay = () => {
    const allDays = knownDays;
    const nextDate = nextAvailDateISO(allDays);
    setCurrentDayLabel(nextDate);
    showToast(`Added ${formatDayLabel(nextDate)}. New pins will save here.`, 'success');
  };

  const moveStop = async (item, direction) => {
    const dayStops = stopsForDay(item.dayLabel || 'Unassigned');
    const idx = dayStops.findIndex((s) => s._id === item._id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= dayStops.length) return;
    const a = dayStops[idx];
    const b = dayStops[targetIdx];
    try {
      // Swap sortOrders
      await Promise.all([
        axios.put(`${config.backendUrl}/api/roadtrip/leads/${a._id}`,
          { sortOrder: b.sortOrder },
          { headers: { Authorization: `Bearer ${token}` } }),
        axios.put(`${config.backendUrl}/api/roadtrip/leads/${b._id}`,
          { sortOrder: a.sortOrder },
          { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setSavedItems((prev) => prev.map((s) =>
        s._id === a._id ? { ...s, sortOrder: b.sortOrder }
      : s._id === b._id ? { ...s, sortOrder: a.sortOrder }
      : s
      ));
      // If route is shown, refresh
      if (routesShown[item.dayLabel || 'Unassigned']) {
        setTimeout(() => refreshRouteForDay(item.dayLabel || 'Unassigned'), 0);
      }
    } catch (err) {
      showToast('Reorder failed.', 'error');
    }
  };

  const moveStopToDay = async (item, newDayLabel) => {
    try {
      const r = await axios.put(
        `${config.backendUrl}/api/roadtrip/leads/${item._id}`,
        { dayLabel: newDayLabel, sortOrder: 9999 }, // bottom of new day
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedItems((prev) => prev.map((s) => s._id === item._id ? r.data : s));
      const oldDay = item.dayLabel || 'Unassigned';
      if (routesShown[oldDay])       setTimeout(() => refreshRouteForDay(oldDay), 0);
      if (routesShown[newDayLabel])  setTimeout(() => refreshRouteForDay(newDayLabel), 0);
      showToast(`Moved "${item.name}" to ${formatDayLabel(newDayLabel)}.`, 'success');
    } catch (err) {
      showToast('Move failed.', 'error');
    }
  };

  const updateStopField = async (item, updates) => {
    try {
      const r = await axios.put(
        `${config.backendUrl}/api/roadtrip/leads/${item._id}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedItems((prev) => prev.map((s) => s._id === item._id ? r.data : s));
    } catch {
      showToast('Update failed.', 'error');
    }
  };

  const addCustomPin = async () => {
    const { name, address, notes, customType } = customPinForm;
    if (!name.trim()) { showToast('Name required.', 'error'); return; }
    try {
      let lat = mapRef.current?.getCenter().lat ?? 40.5;
      let lng = mapRef.current?.getCenter().lng ?? -74.5;
      // Geocode address if provided
      if (address.trim()) {
        const encoded = encodeURIComponent(address.trim());
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`
          + `?access_token=${config.mapboxToken}&limit=1&country=US`;
        const r = await fetch(url);
        const data = await r.json();
        if (data.features && data.features.length > 0) {
          [lng, lat] = data.features[0].center;
        }
      }
      const existingInDay = savedItems.filter((s) => (s.dayLabel || 'Unassigned') === currentDayLabel);
      const nextOrder = existingInDay.length === 0 ? 0 : Math.max(...existingInDay.map((s) => s.sortOrder ?? 0)) + 1;
      const body = {
        source: 'manual', name: name.trim(), address: address.trim(),
        lat, lng, type: 'other', kind: 'stop',
        status: 'planned', dayLabel: currentDayLabel, sortOrder: nextOrder,
        customType, notes: notes.trim(),
      };
      const res = await axios.post(
        `${config.backendUrl}/api/roadtrip/leads`, body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedItems((prev) => [res.data, ...prev]);
      setShowAddCustomPin(false);
      setCustomPinForm({ name: '', address: '', notes: '', customType: 'friend' });
      showToast(`Added "${name.trim()}" to ${formatDayLabel(currentDayLabel)}.`, 'success');
      if (mapRef.current) mapRef.current.flyTo({ center: [lng, lat], zoom: 13, essential: true, duration: 1200 });
    } catch (err) {
      showToast(err?.response?.data?.message || 'Add failed.', 'error');
    }
  };

  /**
   * Flies the map to the user's current location. Uses browser geolocation.
   * Browsers prompt once for permission; subsequent calls remember it.
   */
  const flyToMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported in this browser.', 'error');
      return;
    }
    showToast('Locating…', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mapRef.current) return;
        mapRef.current.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 13, essential: true, duration: 1400,
        });
        showToast('Location found.', 'success');
      },
      (err) => {
        const hint = err.code === 1
          ? 'Location permission denied — check browser settings.'
          : err.code === 3
          ? 'Location timed out — move outdoors or try again.'
          : `Location unavailable: ${err.message}`;
        showToast(hint, 'error');
      },
      { timeout: 30000, maximumAge: 120000, enableHighAccuracy: false }
    );
  };

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

  // ── Layer toggle ─────────────────────────────────────────────────────────
  const clearLayerMarkers = (layerId) => {
    for (const m of markersRef.current[layerId]) {
      try { m.marker.remove(); } catch {}
    }
    markersRef.current[layerId] = [];
  };

  const dropLayerPins = async (layer) => {
    setLayerState((s) => ({ ...s, [layer.id]: { ...s[layer.id], loading: true, active: true } }));
    try {
      const c = mapRef.current.getCenter();
      const url = `${config.backendUrl}${layer.endpoint}?lat=${c.lat}&lng=${c.lng}&radius=${layer.defaultRadius}`;
      const r = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      const results = r.data?.results || [];
      clearLayerMarkers(layer.id);

      for (const place of results) {
        if (!isFinite(place.lat) || !isFinite(place.lng)) continue;
        const el = buildMarkerEl(layer, place);
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([place.lng, place.lat])
          .addTo(mapRef.current);

        const popup = new mapboxgl.Popup({
          offset: 18, closeButton: true, closeOnClick: true, maxWidth: '340px',
        });
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.setLngLat([place.lng, place.lat])
               .setDOMContent(buildPopupContent({
                 place, layer,
                 onSave: onSaveLead,
                 onHide: onHideDispensary,
                 savedAsLeadId: leadsByExtIdRef.current.get(place.externalId),
                 hideAvailable: layer.id === 'dispensaries',
                 currentDayLabel,
               }))
               .addTo(mapRef.current);
        });
        markersRef.current[layer.id].push({ marker, __placeId: place.externalId });
      }

      lastSearchCenterRef.current = { lng: c.lng, lat: c.lat };
      setMapMoved(false);
      setLayerState((s) => ({
        ...s,
        [layer.id]: { active: true, loading: false, count: results.length, lastSearchAt: Date.now() },
      }));
    } catch (err) {
      console.error(`[${layer.id}] search failed:`, err.response?.data || err.message);
      showToast(`${layer.label}: ${err.response?.data?.message || 'search failed.'}`, 'error');
      setLayerState((s) => ({ ...s, [layer.id]: { ...s[layer.id], loading: false, active: false } }));
    }
  };

  const toggleLayer = (layer) => {
    const cur = layerState[layer.id];
    if (cur.loading) return;
    if (cur.active) {
      clearLayerMarkers(layer.id);
      setLayerState((s) => ({ ...s, [layer.id]: { active: false, loading: false, count: 0, lastSearchAt: null } }));
    } else {
      dropLayerPins(layer);
    }
  };

  const refreshActiveLayers = async () => {
    for (const l of LAYERS) {
      if (layerState[l.id].active) await dropLayerPins(l);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const anyActive = LAYERS.some((l) => layerState[l.id].active);

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
          <Typography sx={{
            fontFamily: MONO, fontSize: 11.5, color: TERM.green, fontWeight: 700,
            letterSpacing: 1.5,
          }}>
            JP.SALES // COMMAND_CENTER
          </Typography>
        </Stack>
        <Chip
          label={mapReady ? 'LINK ESTABLISHED' : 'CONNECTING...'} size="small"
          sx={{
            height: 18, fontFamily: MONO, fontSize: 9, fontWeight: 800,
            letterSpacing: 1, borderRadius: 0.5,
            bgcolor: mapReady ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
            color: mapReady ? TERM.green : TERM.amber,
            border: `1px solid ${mapReady ? TERM.green : TERM.amber}`,
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.muted, letterSpacing: 0.5 }}>
          [ JOINT PRINTING · FIELD OPS ]
        </Typography>
      </Box>

      {/* ── Layer toggle tiles ─────────────────────────────────────────── */}
      <Box sx={{
        flexShrink: 0, px: { xs: 1.5, sm: 2 }, py: 1.25,
        borderBottom: `1px solid ${TERM.border}`,
        display: 'flex', gap: 1, flexWrap: 'nowrap',
        overflowX: 'auto',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}>
        {LAYERS.map((l) => (
          <Box key={l.id} sx={{ flexShrink: 0, minWidth: 80 }}>
            <LayerToggleTile
              layer={l}
              active={layerState[l.id].active}
              loading={layerState[l.id].loading}
              count={layerState[l.id].count}
              onClick={() => toggleLayer(l)}
            />
          </Box>
        ))}
      </Box>

      {/* ── Body: map + side panel ─────────────────────────────────────── */}
      <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* Side panel */}
        <Box sx={{
          width: { xs: mobilePanelOpen ? '100%' : 0, md: 300 }, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          position: { xs: 'fixed', md: 'relative' },
          zIndex: { xs: 10, md: 'auto' },
          top: { xs: 0, md: 'auto' },
          left: { xs: 0, md: 'auto' },
          bottom: { xs: 0, md: 'auto' },
          transition: 'width 0.25s ease',
          overflow: mobilePanelOpen ? 'auto' : 'hidden',
          bgcolor: TERM.panel, borderRight: `1px solid ${TERM.border}`,
          // Custom scrollbar — thin green sliver that matches the terminal vibe
          // instead of the chunky default OS scrollbar
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(74,222,128,0.18)',
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(74,222,128,0.4)' },
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(74,222,128,0.18) transparent',
        }}>
          {/* Mobile close backdrop */}
          <Box
            sx={{ display: { xs: mobilePanelOpen ? 'block' : 'none', md: 'none' }, position: 'fixed', inset: 0, zIndex: -1, bgcolor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setMobilePanelOpen(false)}
          />
          <Box sx={{ p: 2 }}>
            <PanelSection title="NAVIGATE">
              {/* Location search */}
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
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'rgba(74,222,128,0.04)',
                        border: `1.5px solid ${TERM.border}`,
                        borderRadius: 4, padding: '8px 32px 8px 10px',
                        fontFamily: MONO, fontSize: 11.5, color: TERM.text,
                        outline: 'none',
                        letterSpacing: 0.3,
                      }}
                    />
                    {locationSearching && (
                      <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 11, color: TERM.amber, fontFamily: MONO }}>…</Box>
                    )}
                  </Box>
                  <Box
                    role="button" tabIndex={0}
                    onClick={() => { if (locationSearch.length > 1) searchLocation(locationSearch); }}
                    sx={{
                      fontFamily: MONO, fontSize: 10, fontWeight: 900, letterSpacing: 1,
                      color: TERM.greenDk, px: 1.25, flexShrink: 0,
                      cursor: 'pointer', borderRadius: 0.5,
                      bgcolor: TERM.green,
                      border: `1.5px solid ${TERM.green}`,
                      display: 'flex', alignItems: 'center',
                      '&:hover': { opacity: 0.88 },
                    }}>
                    GO
                  </Box>
                </Box>
                {locationResults.length > 0 && (
                  <Box sx={{ mt: 0.5, border: `1px solid ${TERM.border}`, borderRadius: 0.5, overflow: 'hidden' }}>
                    {locationResults.map((f) => (
                      <Box key={f.id}
                        role="button" tabIndex={0}
                        onClick={() => {
                          const [lng, lat] = f.center;
                          mapRef.current?.flyTo({ center: [lng, lat], zoom: 12, essential: true, duration: 1200 });
                          setLocationSearch('');
                          setLocationResults([]);
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

              {/* My location button */}
              <Box
                role="button" tabIndex={0}
                onClick={flyToMyLocation}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') flyToMyLocation(); }}
                sx={{
                  fontFamily: MONO, fontSize: 11.5, fontWeight: 800, letterSpacing: 1,
                  color: TERM.green, py: 1, px: 1.25, mb: 0.5,
                  cursor: 'pointer', borderRadius: 0.5, userSelect: 'none',
                  border: `1.5px solid ${TERM.green}`,
                  bgcolor: 'rgba(74,222,128,0.06)',
                  transition: 'all 0.15s ease',
                  display: 'flex', alignItems: 'center', gap: 1,
                  '&:hover': {
                    bgcolor: 'rgba(74,222,128,0.14)',
                    boxShadow: `0 0 14px ${TERM.green}30`,
                  },
                }}>
                <Box component="span" sx={{ fontSize: 14 }}>📍</Box>
                MY LOCATION
              </Box>
            </PanelSection>

            <PanelSection title="ASSETS">
              {LAYERS.map((l) => (
                <Stat key={l.id}
                  label={l.short}
                  value={layerState[l.id].active
                    ? (layerState[l.id].loading ? '…' : layerState[l.id].count)
                    : '—'}
                  color={layerState[l.id].active ? l.color : TERM.text}
                />
              ))}
              <Stat label="STOPS"
                value={stopCount}
                color={stopCount > 0 ? TERM.green : TERM.text} />
            </PanelSection>

            <PanelSection title={`SALES · ${stopCount}`}>
              {/* Day picker — which day new pin saves go to */}
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{
                  fontFamily: MONO, fontSize: 9.5, color: TERM.muted,
                  letterSpacing: 1, mb: 0.75,
                }}>
                  ADD NEW PINS TO: <Box component="span" sx={{ color: TERM.green }}>{formatDayLabel(currentDayLabel).toUpperCase()}</Box>
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {knownDays.map((d) => {
                    const isCurrent = d === currentDayLabel;
                    return (
                      <Box key={d}
                        role="button" tabIndex={0}
                        onClick={() => setCurrentDayLabel(d)}
                        sx={{
                          fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                          px: 1, py: 0.5, cursor: 'pointer', borderRadius: 0.25,
                          color: isCurrent ? TERM.greenDk : TERM.muted,
                          bgcolor: isCurrent ? TERM.green : 'transparent',
                          border: `1px solid ${isCurrent ? TERM.green : TERM.borderDim}`,
                          '&:hover': {
                            color: isCurrent ? TERM.greenDk : TERM.green,
                            borderColor: TERM.green,
                          },
                        }}>
                        {/^\d{4}-\d{2}-\d{2}$/.test(d) ? formatDayLabel(d) : d.replace(/^Day /, 'D')}
                        {(() => { const cnt = savedItems.filter(s => (s.dayLabel || 'Unassigned') === d).length; return cnt > 0 ? <Box component="span" sx={{ ml: 0.5, opacity: 0.7, fontSize: 9 }}>·{cnt}</Box> : null; })()}
                      </Box>
                    );
                  })}
                  <Box
                    role="button" tabIndex={0}
                    onClick={addNewDay}
                    sx={{
                      fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                      px: 1, py: 0.5, cursor: 'pointer', borderRadius: 0.25,
                      color: TERM.amber, border: `1px dashed ${TERM.amber}`,
                      '&:hover': { bgcolor: 'rgba(251,191,36,0.08)' },
                    }}>
                    + NEW
                  </Box>
                </Box>
                <Box
                  role="button" tabIndex={0}
                  onClick={() => setShowAddCustomPin(true)}
                  sx={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                    px: 1, py: 0.5, cursor: 'pointer', borderRadius: 0.25, mt: 0.75,
                    color: '#06b6d4', border: `1px dashed #06b6d4`,
                    width: '100%', textAlign: 'center',
                    '&:hover': { bgcolor: 'rgba(6,182,212,0.08)' },
                  }}>
                  + ADD CUSTOM STOP
                </Box>
              </Box>

              {/* Day groups */}
              {itinerary.length === 0 ? (
                <Typography sx={{
                  fontFamily: MONO, fontSize: 10.5, color: TERM.muted,
                  lineHeight: 1.55, py: 1, fontStyle: 'italic',
                }}>
                  Empty. Click any pin on the map → ADD TO {formatDayLabel(currentDayLabel).toUpperCase()}.
                </Typography>
              ) : (
                itinerary.map(([day, stops]) => {
                  const isVisible = !!routesShown[day];
                  const dayColor = colorForDay(day);
                  return (
                    <Box key={day} sx={{ mb: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1}
                        sx={{ mb: 0.5, pb: 0.5, borderBottom: `1px solid ${TERM.borderDim}` }}>
                        <Box sx={{
                          width: 8, height: 8, borderRadius: '50%',
                          bgcolor: dayColor, boxShadow: `0 0 6px ${dayColor}`,
                          flexShrink: 0,
                        }} />
                        <Typography sx={{
                          fontFamily: MONO, fontSize: 11, fontWeight: 800,
                          color: TERM.text, letterSpacing: 0.5, flexGrow: 1,
                        }}>
                          {formatDayLabel(day).toUpperCase()} <Box component="span" sx={{ color: TERM.muted, fontWeight: 600 }}>· {stops.length}</Box>
                        </Typography>
                        {stops.length >= 2 && (
                          <Box role="button" tabIndex={0}
                            onClick={() => toggleRouteForDay(day)}
                            sx={{
                              fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                              px: 0.75, py: 0.25, cursor: 'pointer', borderRadius: 0.25,
                              color: isVisible ? TERM.greenDk : dayColor,
                              bgcolor: isVisible ? dayColor : 'transparent',
                              border: `1px solid ${dayColor}`,
                              '&:hover': { opacity: 0.85 },
                            }}>
                            {isVisible ? '◼ HIDE' : '▶ ROUTE'}
                          </Box>
                        )}
                        {stops.length >= 1 && (
                          <Box role="button" tabIndex={0}
                            onClick={() => {
                              const coords = stops.map((s) => `${s.lat},${s.lng}`).join('/');
                              window.open(`https://www.google.com/maps/dir/${coords}`, '_blank', 'noopener');
                            }}
                            sx={{
                              fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                              px: 0.75, py: 0.25, cursor: 'pointer', borderRadius: 0.25,
                              color: '#06b6d4', border: '1px solid #06b6d4',
                              '&:hover': { bgcolor: 'rgba(6,182,212,0.12)' },
                            }}>
                            ⤴ MAPS
                          </Box>
                        )}
                      </Stack>
                      {stops.map((item, i) => {
                        const layerForItem =
                             item.type === 'dispensary'    ? LAYERS[0]
                           : item.type === 'coffee'        ? LAYERS[1]
                           : item.type === 'park_national' || item.type === 'park_state' ? LAYERS[2]
                           : item.type === 'campground'   ? LAYERS[3]
                           : LAYERS[0];
                        const isFirst = i === 0;
                        const isLast  = i === stops.length - 1;
                        return (
                          <Box key={item._id}
                            sx={{
                              position: 'relative',
                              display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 0.75,
                              py: 0.6, px: 0.75, mb: 0.25,
                              borderRadius: 0.5,
                              transition: 'all 0.15s ease',
                              cursor: 'pointer',
                              bgcolor: editingStop === item._id ? 'rgba(74,222,128,0.04)' : 'transparent',
                              '&:hover': {
                                bgcolor: 'rgba(74,222,128,0.04)',
                                transform: 'translateX(2px)',
                              },
                              '&:hover .jp-stop-actions': { opacity: 1 },
                            }}
                            onClick={() => {
                              flyToSaved(item);
                              setEditingStop(prev => prev === item._id ? null : item._id);
                            }}>
                            <Box sx={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, color: TERM.muted, minWidth: 16, textAlign: 'right' }}>{i + 1}.</Box>
                            {/* Score badge for dispensary leads */}
                            {item.kind === 'lead' && (
                              <Box sx={{
                                fontFamily: MONO, fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
                                width: 14, height: 14, borderRadius: '2px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: scoreMeta(item.score).color + '33',
                                color: scoreMeta(item.score).color,
                                border: `1px solid ${scoreMeta(item.score).color}66`,
                              }}>{scoreMeta(item.score).label}</Box>
                            )}
                            <Box role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.kind === 'lead') {
                                  const idx = SALES_STATUSES.findIndex(s => s.value === item.status);
                                  const next = SALES_STATUSES[(idx + 1) % SALES_STATUSES.length];
                                  updateStopField(item, { status: next.value });
                                } else if (item.customType === 'printer') {
                                  const PRINTER_S = ['planned','pre_called','visited','won'];
                                  const idx = PRINTER_S.indexOf(item.status);
                                  updateStopField(item, { status: PRINTER_S[(idx + 1) % PRINTER_S.length] });
                                } else {
                                  updateStopField(item, { status: item.status === 'visited' ? 'planned' : 'visited' });
                                }
                              }}
                              sx={{
                                width: 7, height: 7, borderRadius: '50%', flexShrink: 0, mt: 0.35,
                                bgcolor: item.status && item.status !== 'planned' ? statusMeta(item.status).color : layerForItem.color,
                                cursor: 'pointer', transition: 'transform 0.12s',
                                '&:hover': { transform: 'scale(1.6)' },
                              }} />
                            <Typography sx={{
                              flexGrow: 1, minWidth: 0, fontFamily: MONO, fontSize: 10.5, fontWeight: 600,
                              color: TERM.text, letterSpacing: 0.2,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{item.name}</Typography>
                            <Box className="jp-stop-actions"
                              sx={{ opacity: 0, display: 'flex', gap: 0.25, transition: 'opacity 0.15s' }}>
                              {!isFirst && (
                                <Box role="button"
                                  onClick={(e) => { e.stopPropagation(); moveStop(item, 'up'); }}
                                  sx={actionBtnSx(TERM.muted, TERM.green)}>↑</Box>
                              )}
                              {!isLast && (
                                <Box role="button"
                                  onClick={(e) => { e.stopPropagation(); moveStop(item, 'down'); }}
                                  sx={actionBtnSx(TERM.muted, TERM.green)}>↓</Box>
                              )}
                              <Box role="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMovingStopId(prev => prev === item._id ? null : item._id);
                                }}
                                sx={actionBtnSx(movingStopId === item._id ? TERM.amber : TERM.muted, TERM.amber)}>→</Box>
                              <Box role="button"
                                onClick={(e) => { e.stopPropagation(); deleteSavedItem(item); }}
                                sx={actionBtnSx(TERM.red, TERM.red)}>×</Box>
                            </Box>
                            {movingStopId === item._id && (
                              <Box sx={{ width: '100%', mt: 0.5 }} onClick={(e) => e.stopPropagation()}>
                                <Typography sx={{ fontFamily: MONO, fontSize: 8, color: TERM.amber, letterSpacing: 1, mb: 0.4 }}>MOVE TO DAY</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                                  {knownDays.filter(d => d !== (item.dayLabel || 'Unassigned')).map(d => (
                                    <Box key={d} role="button"
                                      onClick={() => { moveStopToDay(item, d); setMovingStopId(null); }}
                                      sx={{
                                        fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5,
                                        px: 0.75, py: 0.25, borderRadius: 0.25, cursor: 'pointer',
                                        color: TERM.amber, border: `1px solid ${TERM.amber}55`,
                                        '&:hover': { bgcolor: 'rgba(251,191,36,0.12)', borderColor: TERM.amber },
                                      }}>{/^\d{4}-\d{2}-\d{2}$/.test(d) ? formatDayLabel(d) : d}</Box>
                                  ))}
                                </Box>
                              </Box>
                            )}
                            {editingStop === item._id && (
                              <Box sx={{ width: '100%', mt: 0.5, ml: 2, pl: 1, borderLeft: `2px solid ${TERM.borderDim}` }}
                                onClick={(e) => e.stopPropagation()}>
                                {item.kind === 'lead' ? (
                                  /* ── Full sales pipeline editor ── */
                                  <>
                                    <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>STATUS</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mb: 1 }}>
                                      {SALES_STATUSES.map((s) => (
                                        <Box key={s.value} role="button"
                                          onClick={() => updateStopField(item, { status: s.value })}
                                          sx={{
                                            fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5,
                                            px: 0.75, py: 0.25, borderRadius: 0.25, cursor: 'pointer',
                                            color: item.status === s.value ? '#000' : s.color,
                                            bgcolor: item.status === s.value ? s.color : 'transparent',
                                            border: `1px solid ${s.color}`,
                                            '&:hover': { bgcolor: s.color + '22' },
                                          }}>{s.label}</Box>
                                      ))}
                                    </Box>
                                    <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>SCORE</Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                                      {SCORE_OPTIONS.map((sc) => (
                                        <Box key={sc.value} role="button"
                                          onClick={() => updateStopField(item, { score: sc.value })}
                                          sx={{
                                            fontFamily: MONO, fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                                            px: 1, py: 0.4, borderRadius: 0.25, cursor: 'pointer',
                                            color: item.score === sc.value ? '#000' : sc.color,
                                            bgcolor: item.score === sc.value ? sc.color : 'transparent',
                                            border: `1px solid ${sc.color}`,
                                            '&:hover': { bgcolor: sc.color + '33' },
                                          }}>{sc.label}</Box>
                                      ))}
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, mb: 0.75 }}>
                                      <input placeholder="Buyer name…" defaultValue={item.contactName || ''}
                                        onBlur={(e) => { if (e.target.value !== (item.contactName || '')) updateStopField(item, { contactName: e.target.value }); }}
                                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TERM.borderDim}`, borderRadius: 2, padding: '4px 7px', fontFamily: MONO, fontSize: 9.5, color: TERM.text, outline: 'none', width: '100%' }} />
                                      <textarea placeholder="Notes…" defaultValue={item.notes || ''} rows={3}
                                        onBlur={(e) => { if (e.target.value !== (item.notes || '')) updateStopField(item, { notes: e.target.value }); }}
                                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TERM.borderDim}`, borderRadius: 2, padding: '4px 7px', fontFamily: MONO, fontSize: 9.5, color: TERM.text, outline: 'none', width: '100%', resize: 'vertical', minHeight: 54 }} />
                                    </Box>
                                    <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted, letterSpacing: 1, mb: 0.4 }}>INTERESTS</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mb: 0.5 }}>
                                      {ITEM_TAGS.map((tag) => {
                                        const active = (item.itemInterests || []).includes(tag);
                                        return (
                                          <Box key={tag} role="button"
                                            onClick={() => {
                                              const cur = item.itemInterests || [];
                                              const next = active ? cur.filter(t => t !== tag) : [...cur, tag];
                                              updateStopField(item, { itemInterests: next });
                                            }}
                                            sx={{
                                              fontFamily: MONO, fontSize: 8, px: 0.7, py: 0.2,
                                              borderRadius: 0.25, cursor: 'pointer',
                                              border: `1px solid ${active ? TERM.green : TERM.borderDim}`,
                                              color: active ? TERM.green : TERM.muted,
                                              bgcolor: active ? 'rgba(74,222,128,0.1)' : 'transparent',
                                              transition: 'all 0.12s',
                                              '&:hover': { borderColor: TERM.green, color: TERM.green },
                                            }}>{tag}</Box>
                                        );
                                      })}
                                    </Box>
                                  </>
                                ) : item.customType === 'printer' ? (
                                  /* ── Printer: logistics only ── */
                                  <>
                                    <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>STATUS</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mb: 1 }}>
                                      {[
                                        { value: 'planned',   label: 'TO VISIT',     color: 'rgba(212,244,221,0.5)' },
                                        { value: 'pre_called',label: 'CALLED AHEAD', color: '#84cc16' },
                                        { value: 'visited',   label: 'VISITED',      color: '#fbbf24' },
                                        { value: 'won',       label: 'ORDER PLACED', color: '#4ade80' },
                                      ].map((s) => (
                                        <Box key={s.value} role="button"
                                          onClick={() => updateStopField(item, { status: s.value })}
                                          sx={{
                                            fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5,
                                            px: 0.75, py: 0.25, borderRadius: 0.25, cursor: 'pointer',
                                            color: item.status === s.value ? '#000' : s.color,
                                            bgcolor: item.status === s.value ? s.color : 'transparent',
                                            border: `1px solid ${s.color}`,
                                            '&:hover': { bgcolor: s.color + '22' },
                                          }}>{s.label}</Box>
                                      ))}
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, mb: 0.75 }}>
                                      <input placeholder="Phone…" defaultValue={item.phone || ''}
                                        onBlur={(e) => { if (e.target.value !== (item.phone || '')) updateStopField(item, { phone: e.target.value }); }}
                                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TERM.borderDim}`, borderRadius: 2, padding: '4px 7px', fontFamily: MONO, fontSize: 9.5, color: TERM.text, outline: 'none', width: '100%' }} />
                                      <textarea placeholder="Notes…" defaultValue={item.notes || ''} rows={3}
                                        onBlur={(e) => { if (e.target.value !== (item.notes || '')) updateStopField(item, { notes: e.target.value }); }}
                                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TERM.borderDim}`, borderRadius: 2, padding: '4px 7px', fontFamily: MONO, fontSize: 9.5, color: TERM.text, outline: 'none', width: '100%', resize: 'vertical', minHeight: 54 }} />
                                    </Box>
                                  </>
                                ) : (
                                  /* ── Friend / client / waypoint: simple ── */
                                  <>
                                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                                      {[
                                        { value: 'planned', label: 'PLANNED',  color: 'rgba(212,244,221,0.5)' },
                                        { value: 'visited', label: 'VISITED',  color: '#fbbf24' },
                                      ].map((s) => (
                                        <Box key={s.value} role="button"
                                          onClick={() => updateStopField(item, { status: s.value })}
                                          sx={{
                                            fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5,
                                            px: 0.75, py: 0.25, borderRadius: 0.25, cursor: 'pointer',
                                            color: item.status === s.value ? '#000' : s.color,
                                            bgcolor: item.status === s.value ? s.color : 'transparent',
                                            border: `1px solid ${s.color}`,
                                            '&:hover': { bgcolor: s.color + '22' },
                                          }}>{s.label}</Box>
                                      ))}
                                    </Box>
                                    <textarea placeholder="Notes…" defaultValue={item.notes || ''} rows={3}
                                      onBlur={(e) => { if (e.target.value !== (item.notes || '')) updateStopField(item, { notes: e.target.value }); }}
                                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TERM.borderDim}`, borderRadius: 2, padding: '4px 7px', fontFamily: MONO, fontSize: 9.5, color: TERM.text, outline: 'none', width: '100%', resize: 'vertical', minHeight: 54, marginBottom: 4 }} />
                                  </>
                                )}
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })
              )}
            </PanelSection>

            <Box sx={{ mt: 1.5, p: 1.25, border: `1px solid ${TERM.borderDim}`, borderRadius: 0.5, bgcolor: 'rgba(74,222,128,0.02)' }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 9.5, color: TERM.muted, lineHeight: 1.65 }}>
                {anyActive
                  ? <>{'>'} CLICK A PIN → SAVE AS LEAD<br />
                      {'>'} TAP STOP → EXPAND TO EDIT<br />
                      {'>'} PAN MAP, THEN REFRESH</>
                  : <>{'>'} TAP LAYER TILE TO LOAD PINS<br />
                      {'>'} CLICK PIN → ADD TO DAY<br />
                      {'>'} EXPAND STOP → UPDATE STATUS</>}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Map */}
        <Box sx={{ flexGrow: 1, position: 'relative', minWidth: 0 }}>
          <Box
            ref={mapContainerRef}
            sx={{
              position: 'absolute', inset: 0,
              '& .mapboxgl-ctrl-attrib': {
                bgcolor: 'rgba(5,8,10,0.7) !important', color: `${TERM.muted} !important`,
                fontFamily: MONO,
              },
              '& .mapboxgl-ctrl-attrib a': { color: `${TERM.green} !important` },
              '& .mapboxgl-ctrl-group': {
                bgcolor: `${TERM.panel} !important`, border: `1px solid ${TERM.border}`,
              },
              '& .mapboxgl-ctrl-group button': { filter: 'invert(0.85) hue-rotate(85deg)' },
              '& .mapboxgl-popup-content': { background: 'transparent !important', boxShadow: 'none !important', padding: '0 !important', borderRadius: 0 },
              '& .mapboxgl-popup-tip': { borderTopColor: `${TERM.border} !important`, borderBottomColor: `${TERM.border} !important` },
              '& .mapboxgl-popup-close-button': {
                color: `${TERM.muted} !important`, fontSize: '20px !important',
                padding: '4px 8px !important', top: '4px !important', right: '4px !important',
              },
            }}
          />

          {/* Mobile panel toggle — only shown on small screens */}
          <Box
            role="button"
            onClick={() => setMobilePanelOpen(p => !p)}
            sx={{
              display: { xs: 'flex', md: 'none' },
              position: 'absolute', bottom: 80, right: 16, zIndex: 11,
              width: 48, height: 48, borderRadius: '50%',
              bgcolor: mobilePanelOpen ? TERM.green : TERM.panel,
              color: mobilePanelOpen ? '#000' : TERM.green,
              border: `2px solid ${TERM.green}`,
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 12px ${TERM.green}40`,
              fontFamily: MONO, fontSize: 18, fontWeight: 800,
              transition: 'all 0.2s ease',
            }}>
            {mobilePanelOpen ? '×' : '☰'}
          </Box>

          <MapStyleSwitcher current={styleId} onChange={onStyleChange} />

          {/* "Refresh this area" badge */}
          {anyActive && mapMoved && (
            <Box
              role="button" tabIndex={0}
              onClick={refreshActiveLayers}
              sx={{
                position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                zIndex: 2, cursor: 'pointer',
                bgcolor: 'rgba(5,8,10,0.92)', border: `1px solid ${TERM.green}`,
                color: TERM.green,
                px: 2, py: 0.75, borderRadius: 0.5,
                fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
                boxShadow: `0 0 18px ${TERM.green}40`,
                animation: 'jpRefreshPulse 1.8s ease-in-out infinite',
                '@keyframes jpRefreshPulse': {
                  '0%, 100%': { boxShadow: `0 0 12px ${TERM.green}30` },
                  '50%':      { boxShadow: `0 0 22px ${TERM.green}60` },
                },
                '&:hover': { bgcolor: 'rgba(74,222,128,0.14)' },
              }}>
              ↻ SEARCH THIS AREA
            </Box>
          )}

          {mapError && (
            <Box sx={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 2, maxWidth: 480 }}>
              <Alert severity="error" sx={{
                bgcolor: 'rgba(248,113,113,0.12)', color: TERM.red,
                border: `1px solid ${TERM.red}`, fontFamily: MONO, fontSize: 12,
              }}>MAP_ERROR: {mapError}</Alert>
            </Box>
          )}

          {/* Toast */}
          {toast && (
            <Box sx={{
              position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)',
              zIndex: 3,
              bgcolor: 'rgba(5,8,10,0.95)',
              border: `1px solid ${toast.kind === 'error' ? TERM.red : toast.kind === 'success' ? TERM.green : TERM.borderDim}`,
              color: toast.kind === 'error' ? TERM.red : toast.kind === 'success' ? TERM.green : TERM.text,
              px: 2.5, py: 1, borderRadius: 0.5,
              fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
              animation: 'jpToastIn 0.25s ease',
              '@keyframes jpToastIn': {
                '0%': { opacity: 0, transform: 'translate(-50%, 12px)' },
                '100%': { opacity: 1, transform: 'translate(-50%, 0)' },
              },
            }}>
              {toast.message}
            </Box>
          )}
        </Box>
      </Box>

      {/* Add Custom Stop modal */}
      {showAddCustomPin && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1000,
          bgcolor: 'rgba(5,8,10,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowAddCustomPin(false)}>
          <Box sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.border}`,
            borderRadius: 1, p: 3, width: 340, fontFamily: MONO,
          }} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: TERM.green, letterSpacing: 1, mb: 2 }}>
              + ADD CUSTOM STOP
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>TYPE</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
              {[
                { value: 'friend',  label: '🏠 Friend' },
                { value: 'client',  label: '💼 Client' },
                { value: 'printer', label: '🖨 Printer' },
                { value: 'other',   label: '📌 Other' },
              ].map((t) => (
                <Box key={t.value}
                  role="button"
                  onClick={() => setCustomPinForm(f => ({ ...f, customType: t.value }))}
                  sx={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700, px: 1, py: 0.5, borderRadius: 0.5, cursor: 'pointer',
                    bgcolor: customPinForm.customType === t.value ? TERM.green : 'transparent',
                    color: customPinForm.customType === t.value ? '#000' : TERM.text,
                    border: `1px solid ${customPinForm.customType === t.value ? TERM.green : TERM.borderDim}`,
                  }}>{t.label}</Box>
              ))}
            </Box>
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>NAME *</Typography>
            <input
              value={customPinForm.name}
              onChange={(e) => setCustomPinForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Jake's house, Green Leaf Dispensary"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${TERM.borderDim}`, borderRadius: 3,
                padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: TERM.text,
                outline: 'none', marginBottom: 12,
              }}
            />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>ADDRESS (optional — for geocoding)</Typography>
            <input
              value={customPinForm.address}
              onChange={(e) => setCustomPinForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Street address or city"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${TERM.borderDim}`, borderRadius: 3,
                padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: TERM.text,
                outline: 'none', marginBottom: 12,
              }}
            />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>NOTES (optional)</Typography>
            <textarea
              value={customPinForm.notes}
              onChange={(e) => setCustomPinForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Hours, who to ask for, what to bring…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${TERM.borderDim}`, borderRadius: 3,
                padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: TERM.text,
                outline: 'none', resize: 'vertical', minHeight: 62, marginBottom: 16,
              }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box role="button" onClick={addCustomPin}
                sx={{
                  flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  bgcolor: TERM.green, color: '#000',
                  '&:hover': { opacity: 0.9 },
                }}>ADD TO {formatDayLabel(currentDayLabel).toUpperCase()}</Box>
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
