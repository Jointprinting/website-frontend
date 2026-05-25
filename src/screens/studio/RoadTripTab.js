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
import {
  haversineMiles, formatMiles, formatMinutes,
} from './_roadTripGeo';
import { buildPitchPlan, bucketByProgress } from './_roadTripPlan';
import { buildSleepMarkerEl, buildSleepPopup } from './_roadTripSleep';

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

// Status values still flow through the backend (the GO mode card uses
// 'visited' / 'pre_called' / 'follow_up' / 'dead'), but the inline editor
// in the sidebar only ever toggles between 'planned' ↔ 'visited' /
// 'pre_called' per user request — everything else is tracked in the CRM.
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
function buildPopupContent({ place, layer, onSave, onHide, onError, onSetAsSleep, savedAsLeadId, hideAvailable }) {
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

  const saveLabel   = '＋ ADD TO TODAY';
  const savedLabel  = '✓ IN ITINERARY';
  const savingLabel = 'ADDING…';

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
      .catch((e) => {
        saveBtn.disabled = false; saveBtn.textContent = saveLabel; saveBtn.style.cssText = btnStyle('primary');
        if (onError) onError(e?.response?.data?.message || 'Save failed.');
      });
  });
  btnRow.appendChild(saveBtn);

  if (hideAvailable) {
    const hideBtn = document.createElement('button');
    let hidePending = false;
    let hidePendingTimer = null;
    hideBtn.textContent = '⊘ NOT A DISPENSARY';
    hideBtn.style.cssText = btnStyle('danger');
    hideBtn.addEventListener('click', () => {
      if (!hidePending) {
        hidePending = true;
        hideBtn.textContent = '⚠ CONFIRM?';
        hideBtn.style.cssText = btnStyle('danger') + 'background:rgba(248,113,113,0.18);';
        hidePendingTimer = setTimeout(() => {
          hidePending = false;
          hideBtn.textContent = '⊘ NOT A DISPENSARY';
          hideBtn.style.cssText = btnStyle('danger');
        }, 3000);
      } else {
        clearTimeout(hidePendingTimer);
        onHide(place);
      }
    });
    btnRow.appendChild(hideBtn);
  }

  // Campgrounds (and any kind of "stop") get a one-tap "set as sleep"
  // affordance so the user can promote any pin to TONIGHT without going
  // through the address-search editor.
  if (onSetAsSleep && (layer.id === 'campgrounds' || layer.id === 'parks')) {
    const sleepBtn = document.createElement('button');
    sleepBtn.textContent = '🌙 SET AS SLEEP';
    sleepBtn.style.cssText = btnStyle('amber');
    sleepBtn.addEventListener('click', () => onSetAsSleep(place));
    btnRow.appendChild(sleepBtn);
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
  if (kind === 'amber')   return base + `border-color:${TERM.amber};color:${TERM.amber};background:rgba(251,191,36,0.08);`;
  if (kind === 'neutral') return base + `border-color:${TERM.borderDim};color:${TERM.muted};`;
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


// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────
const HEATMAP_SOURCE = 'jp-heatmap-src';
const HEATMAP_LAYER  = 'jp-heatmap';

const CUSTOM_TYPE_COLORS = {
  friend:  '#06b6d4',
  client:  '#a855f7',
  printer: '#f97316',
  other:   '#94a3b8',
};
const CUSTOM_TYPE_LABELS = { friend: 'FRIEND', client: 'CLIENT', printer: 'PRINTER', other: 'WAYPOINT' };

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
  inner.animate(
    [{ transform:'rotate(45deg) scale(0)' },{ transform:'rotate(45deg) scale(1.2)' },{ transform:'rotate(45deg) scale(1)' }],
    { duration:380, easing:'cubic-bezier(0.34,1.56,0.64,1)' }
  );
  wrap.addEventListener('mouseenter', () => { inner.style.transform = 'rotate(45deg) scale(1.5)'; });
  wrap.addEventListener('mouseleave', () => { inner.style.transform = 'rotate(45deg) scale(1)'; });
  wrap.appendChild(inner);
  return wrap;
}

function buildCustomStopPopup(item) {
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
    `<div style="font-size:9.5px;color:${color};letter-spacing:1px;opacity:0.7;margin-bottom:5px;">[${typeLabel}]${item.dayLabel ? ` · ${escapeHtml(formatDayLabel(item.dayLabel)).toUpperCase()}` : ''}</div>`,
  ];
  if (item.address) lines.push(`<div style="font-size:11px;color:${TERM.muted};margin-bottom:3px;">${escapeHtml(item.address)}</div>`);
  if (item.phone)   lines.push(`<div style="font-size:11px;margin-bottom:2px;">[TEL] <a href="tel:${escapeAttr(item.phone)}" style="color:${color};text-decoration:none;">${escapeHtml(item.phone)}</a></div>`);
  if (item.notes)   lines.push(`<div style="font-size:11px;color:${TERM.muted};margin-top:6px;padding-top:6px;border-top:1px solid ${TERM.borderDim};line-height:1.5;">${escapeHtml(item.notes)}</div>`);
  div.innerHTML = lines.join('');
  return div;
}

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
  const heatmapPointsRef = React.useRef([]); // dispensary lat/lngs for heatmap
  const [heatmapOn, setHeatmapOn] = React.useState(false);
  // Map<item._id, mapboxgl.Marker> — keyed so we can diff additions / removals
  // without wiping every marker on each savedItems change (cause of the visual
  // flicker the audit caught).
  const customMarkersRef = React.useRef(new Map());
  const [layerTilesOpen, setLayerTilesOpen] = React.useState(true);
  const [savedItems, setSavedItems] = React.useState([]);
  const [toast, setToast] = React.useState(null);

  // Itinerary state — which day is currently selected for new saves, and
  // which days have their route line drawn on the map.
  const [mobileTab, setMobileTab] = React.useState('map');
  const [pendingDeleteId, setPendingDeleteId] = React.useState(null);
  const pendingDeleteTimerRef = React.useRef(null);
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

  // ── Sleep / pitch / exec state ────────────────────────────────────────────
  // Sleep pin DOM markers (parallel to customMarkersRef). Keyed by lead._id.
  const sleepMarkersRef = React.useRef(new Map());

  // PITCH ROUTE planner — open per-day, picks corridor candidates.
  const [planning, setPlanning] = React.useState({
    open: false, day: null, origin: null, sleep: null,
    candidates: [], selectedIds: new Set(), loading: false, route: null,
  });

  // GO / live execution mode — only true while actively driving the route.
  const [execMode, setExecMode] = React.useState(false);
  const [execDay, setExecDay]   = React.useState(null);
  const watchIdRef = React.useRef(null);
  const liveLocRef = React.useRef(null);
  const liveLocMarkerRef = React.useRef(null);
  const [nextStop, setNextStop] = React.useState(null);

  // Sleep editor (per-day) modal state.
  const [sleepEditor, setSleepEditor] = React.useState({
    open: false, day: null, role: null, // 'primary' | 'backup'
    query: '', results: [], kind: 'campground', searching: false,
  });

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

  // Sync custom-stop diamond markers on the map. Keyed diff (not wipe + add)
  // so editing one stop doesn't recreate every marker.
  React.useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const existing = customMarkersRef.current;          // Map<id, marker>
    const wanted = new Map();
    for (const item of savedItems) {
      if (item.source !== 'manual') continue;
      if (!isFinite(item.lat) || !isFinite(item.lng)) continue;
      wanted.set(String(item._id), item);
    }
    // Drop markers whose source items are gone.
    for (const [id, marker] of existing) {
      if (!wanted.has(id)) { try { marker.remove(); } catch {} existing.delete(id); }
    }
    // Add new + reposition moved.
    for (const [id, item] of wanted) {
      const m = existing.get(id);
      if (!m) {
        const el = buildCustomMarkerEl(item);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([item.lng, item.lat])
          .addTo(mapRef.current);
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, closeOnClick: true });
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.setLngLat([item.lng, item.lat])
               .setDOMContent(buildCustomStopPopup(item))
               .addTo(mapRef.current);
        });
        existing.set(id, marker);
      } else {
        const cur = m.getLngLat();
        if (cur.lng !== item.lng || cur.lat !== item.lat) m.setLngLat([item.lng, item.lat]);
      }
    }
  }, [savedItems, mapReady]);

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

  // ── Sleep slot helpers ───────────────────────────────────────────────────
  // Each day has at most one primary sleep, one backup sleep, and one of them
  // is the "active" sleep (TONIGHT). Derive from savedItems; no separate
  // state needed.
  const primarySleepFor = React.useCallback((day) =>
    savedItems.find(s => (s.dayLabel || 'Unassigned') === day && s.sleepRole === 'primary'),
    [savedItems]);
  const backupSleepFor = React.useCallback((day) =>
    savedItems.find(s => (s.dayLabel || 'Unassigned') === day && s.sleepRole === 'backup'),
    [savedItems]);
  const activeSleepFor = React.useCallback((day) => {
    const a = savedItems.find(s => (s.dayLabel || 'Unassigned') === day && s.isActiveSleep);
    if (a) return a;
    // Fall back to primary if nothing is explicitly active.
    return primarySleepFor(day) || backupSleepFor(day) || null;
  }, [savedItems, primarySleepFor, backupSleepFor]);

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
      // Don't leave the hold-to-confirm delete timer firing after unmount —
      // it would call setPendingDeleteId on an unmounted component.
      if (pendingDeleteTimerRef.current) {
        clearTimeout(pendingDeleteTimerRef.current);
        pendingDeleteTimerRef.current = null;
      }
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
      wasShown.forEach((day) => { refreshRouteForDay(day); });
      // Heatmap layer is wiped by style change — re-add it if it was on.
      if (heatmapOn && heatmapPointsRef.current.length) addHeatmapLayer();
    });
  };

  // ── Pin handlers ─────────────────────────────────────────────────────────
  const showToast = (message, kind = 'info') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2400);
  };

  const addHeatmapLayer = React.useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    // Source = live DISPENSARIES layer if loaded, otherwise the user's saved
    // dispensary leads. This lets the heatmap work on mobile without first
    // having to load the DISPENSARIES layer.
    const live = heatmapPointsRef.current;
    const fallback = savedItems
      .filter(s => s.type === 'dispensary' && isFinite(s.lat) && isFinite(s.lng))
      .map(s => ({ lat: s.lat, lng: s.lng }));
    const pts = live.length ? live : fallback;
    if (!pts.length) return;
    const geojson = {
      type: 'FeatureCollection',
      features: pts.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {},
      })),
    };
    if (map.getSource(HEATMAP_SOURCE)) {
      map.getSource(HEATMAP_SOURCE).setData(geojson);
    } else {
      map.addSource(HEATMAP_SOURCE, { type: 'geojson', data: geojson });
      map.addLayer({
        id: HEATMAP_LAYER, type: 'heatmap', source: HEATMAP_SOURCE,
        paint: {
          // Per-point weight 0.4 → 3 dispensaries clustered close to one
          // another saturate the gradient (≈1.2 density). 1 isolated pin
          // stays green; 2 nearby = yellow; 3+ = red.
          'heatmap-weight': 0.4,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 12, 1.0],
          'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 4, 18, 10, 34],
          'heatmap-opacity': 0.72,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(0,0,0,0)',
            0.15, 'rgba(74,222,128,0.25)',
            0.45, 'rgba(74,222,128,0.55)',
            0.7,  'rgba(251,191,36,0.7)',
            0.9,  'rgba(248,113,113,0.9)',
            1,    'rgba(248,113,113,1)',
          ],
        },
      }, 'waterway-label'); // insert below labels so city names stay readable
    }
  }, [savedItems]);

  const removeHeatmapLayer = React.useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try { if (map.getLayer(HEATMAP_LAYER))   map.removeLayer(HEATMAP_LAYER); } catch {}
    try { if (map.getSource(HEATMAP_SOURCE)) map.removeSource(HEATMAP_SOURCE); } catch {}
  }, []);

  React.useEffect(() => {
    if (!mapReady) return;
    if (heatmapOn) addHeatmapLayer();
    else removeHeatmapLayer();
  }, [heatmapOn, mapReady, addHeatmapLayer, removeHeatmapLayer, savedItems]);

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
    if (pendingDeleteId !== item._id) {
      if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
      setPendingDeleteId(item._id);
      pendingDeleteTimerRef.current = setTimeout(() => setPendingDeleteId(null), 2500);
      return;
    }
    setPendingDeleteId(null);
    if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
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
      const body = {
        source: 'manual', name: name.trim(), address: address.trim(),
        lat, lng, type: 'other', kind: 'stop',
        status: 'planned', dayLabel: '', sortOrder: 0,
        customType, notes: notes.trim(),
      };
      const res = await axios.post(
        `${config.backendUrl}/api/roadtrip/leads`, body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedItems((prev) => [res.data, ...prev]);
      setShowAddCustomPin(false);
      setCustomPinForm({ name: '', address: '', notes: '', customType: 'friend' });
      showToast(`Added "${name.trim()}" to map.`, 'success');
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
          offset: 18, closeButton: true, closeOnClick: true,
          maxWidth: 'min(340px, calc(100vw - 24px))',
        });
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.setLngLat([place.lng, place.lat])
               .setDOMContent(buildPopupContent({
                 place, layer,
                 onSave: onSaveLead,
                 onHide: onHideDispensary,
                 onError: (msg) => showToast(msg, 'error'),
                 onSetAsSleep: (p) => { popup.remove(); promptSetAsSleep(p); },
                 savedAsLeadId: leadsByExtIdRef.current.get(place.externalId),
                 hideAvailable: layer.id === 'dispensaries',
               }))
               .addTo(mapRef.current);
        });
        markersRef.current[layer.id].push({ marker, __placeId: place.externalId });
      }

      // For dispensaries, save coordinates so the heatmap can render them.
      if (layer.id === 'dispensaries') {
        const pts = results.filter((p) => isFinite(p.lat) && isFinite(p.lng)).map((p) => ({ lat: p.lat, lng: p.lng }));
        heatmapPointsRef.current = pts;
        // Auto-enable heatmap on first dispensary load (user can toggle off).
        if (pts.length && !heatmapOn) setHeatmapOn(true);
        else if (pts.length && heatmapOn) addHeatmapLayer();
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
      if (layer.id === 'dispensaries') {
        heatmapPointsRef.current = [];
        setHeatmapOn(false);
        removeHeatmapLayer();
      }
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
  // Sleep slot management — flip active, edit pin, assign new sleep lead.
  // ─────────────────────────────────────────────────────────────────────────

  const flipActiveSleep = async (day) => {
    const primary = primarySleepFor(day);
    const backup  = backupSleepFor(day);
    if (!primary && !backup) {
      showToast('Set a primary or backup sleep first.', 'error');
      return;
    }
    const current = activeSleepFor(day);
    let target;
    if (!current) target = primary || backup;
    else if (current.sleepRole === 'primary' && backup) target = backup;
    else if (current.sleepRole === 'backup'  && primary) target = primary;
    else { showToast('Only one sleep set for this day.', 'info'); return; }

    try {
      const updates = [];
      if (current && current._id !== target._id) {
        updates.push(axios.put(`${config.backendUrl}/api/roadtrip/leads/${current._id}`,
          { isActiveSleep: false }, { headers: { Authorization: `Bearer ${token}` } }));
      }
      updates.push(axios.put(`${config.backendUrl}/api/roadtrip/leads/${target._id}`,
        { isActiveSleep: true }, { headers: { Authorization: `Bearer ${token}` } }));
      await Promise.all(updates);
      setSavedItems(prev => prev.map(s => {
        const sameDay = (s.dayLabel || 'Unassigned') === day;
        if (sameDay && s._id === target._id) return { ...s, isActiveSleep: true };
        if (sameDay && s.isActiveSleep) return { ...s, isActiveSleep: false };
        return s;
      }));
      showToast(`TONIGHT: ${target.name}`, 'success');
    } catch (e) {
      showToast('Failed to switch active sleep.', 'error');
    }
  };

  const assignSleep = async ({ feature, day, role, kind, customName }) => {
    // `feature` is a Mapbox geocoder result; create a lead and mark it.
    const [lng, lat] = feature.center;
    const body = {
      source: 'manual',
      name: customName?.trim() || feature.text || feature.place_name?.split(',')[0] || 'Sleep',
      address: feature.place_name || '',
      lat, lng,
      type: kind === 'campground' ? 'campground' : 'other',
      kind: 'stop',
      customType: kind === 'park_and_ride' ? 'other' : '',
      dayLabel: day,
      sleepRole: role,
      sleepKind: kind,
      // Always default a newly-set sleep pin to active. The controller
      // demotes any prior active on the same day so this is safe.
      isActiveSleep: true,
    };
    try {
      const r = await axios.post(`${config.backendUrl}/api/roadtrip/leads`, body,
        { headers: { Authorization: `Bearer ${token}` } });
      // Refresh full list so demoted prior holders show their new state.
      const list = await axios.get(`${config.backendUrl}/api/roadtrip/leads`,
        { headers: { Authorization: `Bearer ${token}` } });
      setSavedItems(list.data);
      showToast(`${role === 'primary' ? 'PRIMARY' : 'BACKUP'} sleep set: ${body.name}`, 'success');
      return r.data;
    } catch (e) {
      showToast('Failed to set sleep pin.', 'error');
      return null;
    }
  };

  const openSleepEditor = (day, role = 'primary') => {
    setSleepEditor({
      open: true, day, role,
      query: '', results: [],
      kind: role === 'primary' ? 'campground' : 'park_and_ride',
      searching: false,
    });
  };

  const clearSleep = async (lead) => {
    if (!lead) return;
    try {
      await axios.put(`${config.backendUrl}/api/roadtrip/leads/${lead._id}`,
        { sleepRole: '', sleepKind: '', isActiveSleep: false },
        { headers: { Authorization: `Bearer ${token}` } });
      setSavedItems(prev => prev.map(s =>
        s._id === lead._id ? { ...s, sleepRole: '', sleepKind: '', isActiveSleep: false } : s));
      showToast('Cleared sleep pin.', 'info');
    } catch {
      showToast('Failed to clear.', 'error');
    }
  };

  // Auto-pick the nearest campground to a day's last sales stop. Uses the
  // existing /search/campgrounds endpoint (RIDB + Google, cached). Saves
  // the closest one as the day's primary sleep without further input.
  // Promotes any map place (campground / park / arbitrary point) into a
  // TONIGHT sleep pin. Opens a small picker so the user chooses which day
  // + which role. Defaults to today + primary.
  const [setAsSleepPicker, setSetAsSleepPicker] = React.useState(null);
  const promptSetAsSleep = (place) => {
    setSetAsSleepPicker({
      place,
      day: currentDayLabel,
      role: 'primary',
      kind: place.type === 'campground' ? 'campground'
          : place.type?.startsWith('park') ? 'campground'
          : 'other',
      nameOverride: place.name || '',
    });
  };

  const confirmSetAsSleep = async () => {
    if (!setAsSleepPicker) return;
    const { place, day, role, kind, nameOverride } = setAsSleepPicker;
    await assignSleep({
      feature: {
        center: [place.lng, place.lat],
        text: nameOverride || place.name,
        place_name: place.address || place.name,
      },
      day, role, kind,
      customName: nameOverride,
    });
    setSetAsSleepPicker(null);
  };


  const sleepEditorSearch = async (q) => {
    setSleepEditor(s => ({ ...s, query: q, searching: true }));
    try {
      const encoded = encodeURIComponent(q.trim());
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`
        + `?access_token=${config.mapboxToken}&limit=5&country=US`;
      const r = await fetch(url);
      const data = await r.json();
      setSleepEditor(s => ({ ...s, results: data.features || [], searching: false }));
    } catch {
      setSleepEditor(s => ({ ...s, results: [], searching: false }));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PITCH ROUTE planner — corridor candidates → user picks → draw live route.
  // ─────────────────────────────────────────────────────────────────────────

  const LIVE_ROUTE_SOURCE = 'jp-live-route-src';
  const LIVE_ROUTE_LAYER  = 'jp-live-route-layer';

  const removeLiveRoute = React.useCallback(() => {
    const map = mapRef.current; if (!map) return;
    try { if (map.getLayer(LIVE_ROUTE_LAYER))   map.removeLayer(LIVE_ROUTE_LAYER); } catch {}
    try { if (map.getSource(LIVE_ROUTE_SOURCE)) map.removeSource(LIVE_ROUTE_SOURCE); } catch {}
  }, []);

  const drawLiveRoute = async (geometry) => {
    const map = mapRef.current; if (!map || !geometry) return;
    const geojson = { type: 'Feature', properties: {}, geometry };
    if (map.getSource(LIVE_ROUTE_SOURCE)) {
      map.getSource(LIVE_ROUTE_SOURCE).setData(geojson);
    } else {
      map.addSource(LIVE_ROUTE_SOURCE, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LIVE_ROUTE_LAYER, type: 'line', source: LIVE_ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': TERM.amber,
          'line-width': 5,
          'line-opacity': 0.92,
          'line-dasharray': [2, 1.2],
        },
      });
    }
    const coords = geometry.coordinates || [];
    if (coords.length) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 80, duration: 1200 });
    }
  };

  const resolveOrigin = async () => {
    // 1) If we have a recent live GPS fix from execMode, use it.
    if (liveLocRef.current && Date.now() - liveLocRef.current.t < 60_000) {
      return { lat: liveLocRef.current.lat, lng: liveLocRef.current.lng, label: 'Current location' };
    }
    // 2) Otherwise prompt browser geolocation.
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Current location' }),
        ()    => resolve(null),
        { timeout: 15000, maximumAge: 120000, enableHighAccuracy: false }
      );
    });
  };

  const openPitchPlanner = async (day) => {
    const sleep = activeSleepFor(day);
    if (!sleep) {
      showToast('Set a TONIGHT sleep pin for this day first (tap + PRI or + BAK).', 'error');
      return;
    }
    setPlanning(p => ({ ...p, open: true, day, sleep, loading: true, candidates: [], route: null,
                       googleScan: null, scanMessage: '' }));
    let origin = await resolveOrigin();
    if (!origin) {
      // Final fallback: first stop of the day, otherwise sleep itself (will
      // produce a tiny corridor — user can override).
      const firstStop = stopsForDay(day)[0];
      origin = firstStop
        ? { lat: firstStop.lat, lng: firstStop.lng, label: firstStop.name }
        : { lat: sleep.lat, lng: sleep.lng, label: sleep.name };
      showToast('Using ' + origin.label + ' as start (geolocation unavailable).', 'info');
    }
    try {
      // Step 1: pull the user's existing saved leads in the corridor (zero-cost).
      const savedResp = await axios.post(
        `${config.backendUrl}/api/roadtrip/corridor/leads`,
        { from: { lat: origin.lat, lng: origin.lng },
          to:   { lat: sleep.lat,  lng: sleep.lng  },
          corridorMi: 8, types: ['dispensary'] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const savedLeads = savedResp.data.leads || [];

      // Step 2: if the saved corridor is sparse (<3 leads), auto-scan
      // Google along the route to surface candidates the user hasn't pinned.
      // The backend heavily caches each sample point.
      let googleScan = null;
      let scanMessage = '';
      if (savedLeads.length < 3) {
        try {
          const scanResp = await axios.post(
            `${config.backendUrl}/api/roadtrip/corridor/scan`,
            { from: { lat: origin.lat, lng: origin.lng },
              to:   { lat: sleep.lat,  lng: sleep.lng  },
              corridorMi: 8 },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          googleScan = scanResp.data.leads || [];
          scanMessage = scanResp.data.message || '';
        } catch (e) {
          console.warn('[planner] corridor scan failed:', e?.response?.data || e.message);
        }
      }

      // Merge: saved leads take priority (vetted), then google scans fill gaps.
      const savedExtIds = new Set(savedLeads.map(s => s.externalId).filter(Boolean));
      const merged = [
        ...savedLeads.map(s => ({ ...s, _isSaved: true })),
        ...((googleScan || [])
          .filter(s => !savedExtIds.has(s.externalId))
          .map(s => ({ ...s, _isSaved: false, _id: 'g:' + s.externalId }))),
      ];
      merged.sort((a, b) => a.progress - b.progress);

      // Intelligence: auto-pre-check up to 10 best candidates.
      // Prefer saved + low cross-track. Anything already on today stays pre-checked.
      const todays = new Set(stopsForDay(day)
        .filter(s => s.type === 'dispensary')
        .map(s => s._id));
      const scored = merged.map((c) => ({
        ...c,
        _score: (c._isSaved ? 100 : 0)
              + (todays.has(c._id) ? 50 : 0)
              + (10 - Math.min(10, c.crossTrackMi ?? 10)),
      }));
      scored.sort((a, b) => b._score - a._score);
      const topPicks = scored.slice(0, Math.min(10, merged.length));
      const selected = new Set(topPicks.map(c => c._id));
      // Always include items already on today's plan.
      for (const c of merged) if (todays.has(c._id)) selected.add(c._id);

      setPlanning(p => ({
        ...p, origin, candidates: merged,
        selectedIds: selected, loading: false,
        googleScan: googleScan ? googleScan.length : null,
        scanMessage,
      }));
    } catch (e) {
      console.error('[planner] corridor fetch failed:', e);
      showToast('Failed to load corridor leads.', 'error');
      setPlanning(p => ({ ...p, loading: false }));
    }
  };

  const togglePlannerCandidate = (id) => {
    setPlanning(p => {
      const next = new Set(p.selectedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...p, selectedIds: next };
    });
  };

  const buildPitchRoute = async () => {
    const { origin, sleep, candidates, selectedIds, day } = planning;
    if (!origin || !sleep) return;
    if (selectedIds.size + 2 > 25) {
      showToast('Too many stops (Mapbox limit 25). Uncheck a few.', 'error');
      return;
    }
    const plan = buildPitchPlan({ origin, sleep, candidates, selectedIds });

    // Some selected items are Google scan results (synthetic _id starting
    // with "g:"); save those to the DB first so they become real leads.
    const created = new Map(); // tempId -> realLead
    try {
      for (const stop of plan.stops) {
        if (stop._isSaved) continue;
        const body = {
          source:     'google_places',
          externalId: stop.externalId,
          name:       stop.name,
          address:    stop.address || '',
          phone:      stop.phone   || '',
          website:    stop.website || '',
          lat:        stop.lat,
          lng:        stop.lng,
          type:       'dispensary',
          kind:       'lead',
          status:     'planned',
          dayLabel:   day,
          tripLabel:  '',
          score:      '',
        };
        try {
          const r = await axios.post(`${config.backendUrl}/api/roadtrip/leads`, body,
            { headers: { Authorization: `Bearer ${token}` } });
          created.set(stop._id, r.data);
        } catch (err) {
          // 409 means already saved with this externalId — fetch the
          // existing one and use it.
          if (err.response?.status === 409 && err.response.data?.existing) {
            created.set(stop._id, err.response.data.existing);
          } else {
            console.warn('[planner] create lead failed for', stop.name, err.response?.data || err.message);
          }
        }
      }
    } catch (e) { console.warn('[planner] auto-save failed', e); }

    // Persist day + sortOrder for each stop (saved + just-created).
    const realStops = plan.stops.map(s => s._isSaved ? s : (created.get(s._id) || s));
    try {
      await Promise.all(realStops.map((stop, idx) =>
        axios.put(`${config.backendUrl}/api/roadtrip/leads/${stop._id}`,
          { dayLabel: day, sortOrder: idx + 1 },
          { headers: { Authorization: `Bearer ${token}` } })
      ));
      // Refresh full list so newly-created google-scan leads show up.
      const list = await axios.get(`${config.backendUrl}/api/roadtrip/leads`,
        { headers: { Authorization: `Bearer ${token}` } });
      setSavedItems(list.data);
    } catch (e) {
      console.warn('[planner] persist failed', e);
    }
    // Hit Mapbox Directions and draw the dashed amber line.
    try {
      const route = await fetchRoute(plan.coords);
      if (route) {
        await drawLiveRoute(route.geometry);
        setPlanning(p => ({ ...p, route, open: false }));
        showToast(`Route built · ${(route.distance / 1609.34).toFixed(1)}mi · ${Math.round(route.duration/60)}min`, 'success');
        // On mobile, jump to map view so the user sees the line.
        setMobileTab('map');
      }
    } catch (e) {
      showToast(e.message || 'Mapbox route failed.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATE AREA — density count + denser nearby alternatives.
  // ─────────────────────────────────────────────────────────────────────────

  // Validator removed from UI per user feedback. Backend endpoints remain
  // available for future use; the right-click + popup entry points were
  // confusing and redundant with the manual "toggle DISPENSARIES, save
  // what's relevant" workflow the user prefers.

  // ─────────────────────────────────────────────────────────────────────────
  // GO / live execution — watchPosition, NEXT STOP, VISITED / SKIP.
  // ─────────────────────────────────────────────────────────────────────────

  const updateNextStop = React.useCallback((day) => {
    if (!day) return;
    const stops = stopsForDay(day);
    const next = stops.find(s => {
      if (s.status === 'visited' || s.status === 'dead') return false;
      if (s.sleepRole === 'primary' || s.sleepRole === 'backup') return false;
      return true;
    }) || activeSleepFor(day);
    if (!next) { setNextStop(null); return; }
    const loc = liveLocRef.current;
    const distMi = loc
      ? haversineMiles(loc.lat, loc.lng, next.lat, next.lng)
      : null;
    const etaMin = distMi != null ? (distMi / 45) * 60 : null;
    setNextStop({ ...next, _distanceMi: distMi, _etaMin: etaMin });
  }, [stopsForDay, activeSleepFor]);

  const startExec = (day) => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported.', 'error');
      return;
    }
    setExecMode(true);
    setExecDay(day);
    setMobileTab('map');
    if (watchIdRef.current != null) {
      try { navigator.geolocation.clearWatch(watchIdRef.current); } catch {}
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        liveLocRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading,
          t: Date.now(),
        };
        // Render a small "you are here" marker.
        if (mapRef.current) {
          if (!liveLocMarkerRef.current) {
            const el = document.createElement('div');
            el.style.cssText = `
              width: 16px; height: 16px; border-radius: 50%;
              background: ${TERM.green}; border: 2px solid #fff;
              box-shadow: 0 0 8px ${TERM.green}, 0 0 2px #fff;
            `;
            liveLocMarkerRef.current = new mapboxgl.Marker({ element: el })
              .setLngLat([pos.coords.longitude, pos.coords.latitude])
              .addTo(mapRef.current);
          } else {
            liveLocMarkerRef.current.setLngLat([pos.coords.longitude, pos.coords.latitude]);
          }
        }
        updateNextStop(day);
      },
      (err) => {
        console.warn('[exec] watchPosition err:', err);
        showToast('Location error — GPS off?', 'error');
      },
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 20000 }
    );
    updateNextStop(day);
    showToast('GO mode on — driving the route.', 'success');
  };

  const stopExec = () => {
    if (watchIdRef.current != null) {
      try { navigator.geolocation.clearWatch(watchIdRef.current); } catch {}
      watchIdRef.current = null;
    }
    if (liveLocMarkerRef.current) {
      try { liveLocMarkerRef.current.remove(); } catch {}
      liveLocMarkerRef.current = null;
    }
    setExecMode(false);
    setExecDay(null);
    setNextStop(null);
    removeLiveRoute();
  };

  React.useEffect(() => {
    // Cleanup geolocation watcher on unmount.
    return () => {
      if (watchIdRef.current != null) {
        try { navigator.geolocation.clearWatch(watchIdRef.current); } catch {}
      }
    };
  }, []);

  const markNextStopVisited = async () => {
    if (!nextStop) return;
    try {
      await axios.put(`${config.backendUrl}/api/roadtrip/leads/${nextStop._id}`,
        { status: 'visited', visitedAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } });
      setSavedItems(prev => prev.map(s => s._id === nextStop._id
        ? { ...s, status: 'visited', visitedAt: new Date().toISOString() }
        : s));
      showToast(`✓ Visited ${nextStop.name}`, 'success');
      // Re-flow the route through remaining stops.
      if (execDay) {
        const stops = stopsForDay(execDay).filter(s => s._id !== nextStop._id);
        const remaining = stops.filter(s => s.status !== 'visited' && s.status !== 'dead');
        const sleep = activeSleepFor(execDay);
        if (sleep && remaining.length) {
          const loc = liveLocRef.current;
          const coords = [
            ...(loc ? [[loc.lng, loc.lat]] : []),
            ...remaining.filter(s => s.sleepRole !== 'primary' && s.sleepRole !== 'backup')
                        .map(s => [s.lng, s.lat]),
            [sleep.lng, sleep.lat],
          ];
          try { const r = await fetchRoute(coords); if (r) await drawLiveRoute(r.geometry); } catch {}
        }
        updateNextStop(execDay);
      }
    } catch {
      showToast('Failed to mark visited.', 'error');
    }
  };

  const skipNextStop = async () => {
    if (!nextStop || !execDay) return;
    const allStops = stopsForDay(execDay);
    const maxOrder = Math.max(0, ...allStops.map(s => s.sortOrder ?? 0));
    try {
      await axios.put(`${config.backendUrl}/api/roadtrip/leads/${nextStop._id}`,
        { sortOrder: maxOrder + 1, status: 'follow_up' },
        { headers: { Authorization: `Bearer ${token}` } });
      setSavedItems(prev => prev.map(s => s._id === nextStop._id
        ? { ...s, sortOrder: maxOrder + 1, status: 'follow_up' }
        : s));
      showToast(`Skipped ${nextStop.name} (will return)`, 'info');
      updateNextStop(execDay);
    } catch {
      showToast('Failed to skip.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Sleep markers on the map — moon glyph with role-tinted ring.
  // ─────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const existing = sleepMarkersRef.current;
    const wanted = new Map();
    for (const item of savedItems) {
      if (!item.sleepRole) continue;
      if (!isFinite(item.lat) || !isFinite(item.lng)) continue;
      wanted.set(String(item._id), item);
    }
    // Drop / refresh.
    for (const [id, marker] of existing) {
      if (!wanted.has(id)) { try { marker.remove(); } catch {} existing.delete(id); }
    }
    for (const [id, item] of wanted) {
      const prev = existing.get(id);
      const el = buildSleepMarkerEl({
        role: item.sleepRole, sleepKind: item.sleepKind,
        active: !!item.isActiveSleep,
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const popup = new mapboxgl.Popup({ offset: 22, closeButton: true, closeOnClick: true });
        const dayKey = item.dayLabel || 'Unassigned';
        const otherRole = item.sleepRole === 'primary' ? 'backup' : 'primary';
        const hasOther = !!savedItems.find(s =>
          (s.dayLabel || 'Unassigned') === dayKey && s.sleepRole === otherRole);
        const content = buildSleepPopup({
          lead: item,
          hasBackup: hasOther,
          onMakeActive: async (lead) => {
            try {
              if (!lead.isActiveSleep) {
                await axios.put(`${config.backendUrl}/api/roadtrip/leads/${lead._id}`,
                  { isActiveSleep: true },
                  { headers: { Authorization: `Bearer ${token}` } });
                setSavedItems(p => p.map(s => {
                  const sameDay = (s.dayLabel || 'Unassigned') === (lead.dayLabel || 'Unassigned');
                  if (sameDay && s._id === lead._id) return { ...s, isActiveSleep: true };
                  if (sameDay && s.isActiveSleep) return { ...s, isActiveSleep: false };
                  return s;
                }));
                showToast(`TONIGHT: ${lead.name}`, 'success');
              } else if (hasOther) {
                // Already active and there's a backup — flip to the other role.
                await flipActiveSleep(dayKey);
              }
              popup.remove();
            } catch { showToast('Failed.', 'error'); }
          },
          onReplace: (lead) => {
            popup.remove();
            openSleepEditor(lead.dayLabel || 'Unassigned', lead.sleepRole);
          },
          onClear: async (lead) => {
            popup.remove();
            await clearSleep(lead);
          },
          onEdit: (lead) => {
            popup.remove();
            setEditingStop(lead._id);
            setMobileTab('stops');
          },
        });
        popup.setLngLat([item.lng, item.lat]).setDOMContent(content).addTo(mapRef.current);
      });
      if (prev) { try { prev.remove(); } catch {} }
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([item.lng, item.lat]).addTo(mapRef.current);
      existing.set(id, marker);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedItems, mapReady, token]);

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
      <Box sx={{ flexShrink: 0, borderBottom: `1px solid ${TERM.border}` }}>
        {/* Mobile collapse toggle */}
        <Box
          role="button" tabIndex={0}
          onClick={() => setLayerTilesOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLayerTilesOpen((v) => !v); }}
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center', px: 1.5, py: 0.75,
            cursor: 'pointer', userSelect: 'none',
            fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: TERM.muted,
            gap: 1,
            '&:hover': { color: TERM.green },
          }}>
          <Box component="span" sx={{ color: TERM.green, fontSize: 9 }}>◉</Box>
          LAYERS
          {/* Active layer dots when collapsed */}
          {!layerTilesOpen && LAYERS.filter((l) => layerState[l.id].active).map((l) => (
            <Box key={l.id} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: l.color, boxShadow: `0 0 5px ${l.color}` }} />
          ))}
          <Box component="span" sx={{
            ml: 'auto', fontSize: 9, transition: 'transform 0.18s ease',
            transform: layerTilesOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}>▼</Box>
        </Box>

        {/* Tile grid */}
        <Box sx={{
          display: { xs: layerTilesOpen ? 'grid' : 'none', md: 'grid' },
          px: { xs: 1, sm: 2 }, py: { xs: 0.75, sm: 1.25 },
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: { xs: 0.5, sm: 1 },
        }}>
          {LAYERS.map((l) => (
            <LayerToggleTile
              key={l.id}
              layer={l}
              active={layerState[l.id].active}
              loading={layerState[l.id].loading}
              count={layerState[l.id].count}
              onClick={() => toggleLayer(l)}
            />
          ))}
        </Box>
      </Box>

      {/* ── Body: map + side panel ─────────────────────────────────────── */}
      <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0, position: 'relative', pb: { xs: '56px', md: 0 } }}>
        {/* Side panel — desktop only */}
        <Box sx={{
          width: 300, flexShrink: 0,
          display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
          overflow: 'auto',
          bgcolor: TERM.panel, borderRight: `1px solid ${TERM.border}`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
          '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(74,222,128,0.4)' },
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(74,222,128,0.18) transparent',
        }}>
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
                  const dayColor = colorForDay(day);
                  const sleepPri = primarySleepFor(day);
                  const sleepBak = backupSleepFor(day);
                  const sleepActive = activeSleepFor(day);
                  const sleepActiveColor =
                    sleepActive?.sleepRole === 'backup' ? TERM.amber : TERM.green;
                  return (
                    <Box key={day} sx={{ mb: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1}
                        sx={{ mb: 0.5, pb: 0.5, borderBottom: `1px solid ${TERM.borderDim}`, flexWrap: 'wrap' }}>
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
                        <Box role="button" tabIndex={0}
                          onClick={() => openPitchPlanner(day)}
                          sx={{
                            fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                            px: 1, py: 0.4, cursor: 'pointer', borderRadius: 0.25,
                            color: sleepActive ? TERM.amber : TERM.muted,
                            border: `1px dashed ${sleepActive ? TERM.amber : TERM.borderDim}`,
                            '&:hover': { bgcolor: 'rgba(251,191,36,0.08)' },
                          }}>
                          🛣 PITCH
                        </Box>
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
                      {/* TONIGHT — two rows so the name has full sidebar width */}
                      <Box sx={{
                        py: 0.5, px: 0.75, mb: 0.5,
                        bgcolor: 'rgba(74,222,128,0.025)', borderRadius: 0.5,
                        border: `1px solid ${sleepActive ? sleepActiveColor + '40' : TERM.borderDim}`,
                      }}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                          <Box sx={{ fontSize: 12, color: sleepActiveColor, lineHeight: 1 }}>🌙</Box>
                          <Typography sx={{
                            fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                            color: TERM.muted, flexShrink: 0,
                          }}>TONIGHT:</Typography>
                          {sleepActive ? (
                            <Box role="button"
                              onClick={() => flyToSaved(sleepActive)}
                              sx={{
                                fontFamily: MONO, fontSize: 10.5, fontWeight: 700,
                                color: sleepActiveColor, flexGrow: 1, minWidth: 0,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                '&:hover': { textDecoration: 'underline' },
                              }}>{sleepActive.name}</Box>
                          ) : (
                            <Box sx={{
                              fontFamily: MONO, fontSize: 10, color: TERM.muted,
                              flexGrow: 1, fontStyle: 'italic',
                            }}>not set</Box>
                          )}
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                          {/* Segmented toggle: PRI | BAK — bigger tap targets for mobile */}
                          <Box sx={{
                            display: 'flex', border: `1px solid ${TERM.borderDim}`,
                            borderRadius: 0.5, overflow: 'hidden', flexShrink: 0,
                          }}>
                            <Box role="button"
                              onClick={() => {
                                if (sleepPri) {
                                  if (sleepActive?._id !== sleepPri._id) flipActiveSleep(day);
                                } else { openSleepEditor(day, 'primary'); }
                              }}
                              sx={{
                                fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                                px: 1.25, py: 0.75, cursor: 'pointer', minHeight: 32, minWidth: 56,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: sleepActive?.sleepRole === 'primary'
                                  ? TERM.greenDk : (sleepPri ? TERM.green : TERM.muted),
                                bgcolor: sleepActive?.sleepRole === 'primary' ? TERM.green : 'transparent',
                              }}>⛺ {sleepPri ? 'PRI' : '+ PRI'}</Box>
                            <Box role="button"
                              onClick={() => {
                                if (sleepBak) {
                                  if (sleepActive?._id !== sleepBak._id) flipActiveSleep(day);
                                } else { openSleepEditor(day, 'backup'); }
                              }}
                              sx={{
                                fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                                px: 1.25, py: 0.75, cursor: 'pointer', minHeight: 32, minWidth: 56,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderLeft: `1px solid ${TERM.borderDim}`,
                                color: sleepActive?.sleepRole === 'backup'
                                  ? '#000' : (sleepBak ? TERM.amber : TERM.muted),
                                bgcolor: sleepActive?.sleepRole === 'backup' ? TERM.amber : 'transparent',
                              }}>🅿 {sleepBak ? 'BAK' : '+ BAK'}</Box>
                          </Box>
                          {sleepPri && (
                            <Box role="button"
                              onClick={() => openSleepEditor(day, 'primary')}
                              title="Edit primary sleep"
                              sx={{
                                fontFamily: MONO, fontSize: 10, fontWeight: 800,
                                px: 1, py: 0.75, cursor: 'pointer', borderRadius: 0.25,
                                minHeight: 32, display: 'flex', alignItems: 'center',
                                color: TERM.green, border: `1px solid ${TERM.borderDim}`,
                                '&:hover': { borderColor: TERM.green },
                              }}>✎ ⛺</Box>
                          )}
                          {sleepBak && (
                            <Box role="button"
                              onClick={() => openSleepEditor(day, 'backup')}
                              title="Edit backup sleep"
                              sx={{
                                fontFamily: MONO, fontSize: 10, fontWeight: 800,
                                px: 1, py: 0.75, cursor: 'pointer', borderRadius: 0.25,
                                minHeight: 32, display: 'flex', alignItems: 'center',
                                color: TERM.amber, border: `1px solid ${TERM.borderDim}`,
                                '&:hover': { borderColor: TERM.amber },
                              }}>✎ 🅿</Box>
                          )}
                          {sleepActive && (
                            <Box role="button"
                              onClick={() => clearSleep(sleepActive)}
                              title="Clear active sleep pin"
                              sx={{
                                fontFamily: MONO, fontSize: 11, fontWeight: 800,
                                ml: 'auto',
                                px: 1, py: 0.75, cursor: 'pointer', borderRadius: 0.25,
                                minHeight: 32, minWidth: 32, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                color: TERM.muted, border: `1px solid ${TERM.borderDim}`,
                                '&:hover': { color: TERM.red, borderColor: TERM.red + '66' },
                              }}>×</Box>
                          )}
                        </Stack>
                      </Box>
                      {stops.map((item, i) => {
                        const isFirst = i === 0;
                        const isLast  = i === stops.length - 1;
                        return (
                          <Box key={item._id}
                            sx={{
                              position: 'relative',
                              display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0.75,
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
                            <Box sx={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, color: TERM.muted, minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</Box>
                            {/* Score badge for dispensary leads — hidden when unset
                                so unscored rows aren't cluttered with "?". */}
                            {item.kind === 'lead' && item.score && (
                              <Box sx={{
                                fontFamily: MONO, fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
                                width: 14, height: 14, borderRadius: '2px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: scoreMeta(item.score).color + '33',
                                color: scoreMeta(item.score).color,
                                border: `1px solid ${scoreMeta(item.score).color}66`,
                              }}>{scoreMeta(item.score).label}</Box>
                            )}
                            {/* Indicator rules:
                                  sleep pin     → kind-driven emoji
                                  visited       → green ✓ pill
                                  called ahead  → amber 📞 pill (only if not yet visited)
                                  default       → red dot (haven't done anything yet) */}
                            {item.sleepRole ? (
                              <Box sx={{
                                fontSize: 14, flexShrink: 0, lineHeight: 1,
                              }} title={item.sleepRole === 'primary' ? 'Primary sleep' : 'Backup sleep'}>
                                {item.sleepRole === 'backup' ? '🅿'
                                  : item.sleepKind === 'campground' ? '⛺'
                                  : item.sleepKind === 'park_and_ride' ? '🅿'
                                  : item.sleepKind === 'hotel' ? '🏨'
                                  : item.sleepKind === 'friend' ? '🏠'
                                  : '🌙'}
                              </Box>
                            ) : item.status === 'visited' ? (
                              <Box sx={{
                                fontFamily: MONO, fontSize: 9, fontWeight: 900,
                                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: TERM.green, color: TERM.greenDk,
                              }} title="Visited">✓</Box>
                            ) : item.status === 'pre_called' ? (
                              <Box sx={{
                                fontSize: 10, flexShrink: 0,
                                width: 16, height: 16, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: TERM.amber, color: '#000',
                              }} title="Called ahead">📞</Box>
                            ) : (
                              <Box sx={{
                                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                                bgcolor: TERM.red, boxShadow: `0 0 5px ${TERM.red}66`,
                              }} title="Not visited yet" />
                            )}
                            <Typography sx={{
                              flexGrow: 1, minWidth: 0, fontFamily: MONO, fontSize: 11, fontWeight: 600,
                              color: item.sleepRole
                                ? (item.sleepRole === 'backup' ? TERM.amber : TERM.green)
                                : TERM.text,
                              letterSpacing: 0.2,
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
                                sx={{
                                  ...actionBtnSx(TERM.red, TERM.red),
                                  bgcolor: pendingDeleteId === item._id ? 'rgba(248,113,113,0.18)' : 'transparent',
                                  borderColor: pendingDeleteId === item._id ? TERM.red : 'transparent',
                                  px: pendingDeleteId === item._id ? 1 : 0.5,
                                  fontSize: pendingDeleteId === item._id ? 9 : 11,
                                }}>
                                {pendingDeleteId === item._id ? '✓?' : '×'}
                              </Box>
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
                                  /* ── Slimmed dispensary editor: SCORE + VISITED + CALLED only. ── */
                                  /* Everything else (status pipeline, buyer, notes, interests) lives in the CRM. */
                                  <>
                                    <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>SCORE</Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                                      {SCORE_OPTIONS.map((sc) => (
                                        <Box key={sc.value} role="button"
                                          onClick={() => updateStopField(item, { score: sc.value })}
                                          sx={{
                                            fontFamily: MONO, fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                                            px: 1.2, py: 0.4, borderRadius: 0.25, cursor: 'pointer',
                                            color: item.score === sc.value ? '#000' : sc.color,
                                            bgcolor: item.score === sc.value ? sc.color : 'transparent',
                                            border: `1px solid ${sc.color}`,
                                            '&:hover': { bgcolor: sc.color + '33' },
                                          }}>{sc.label}</Box>
                                      ))}
                                    </Box>
                                    {/* VISITED + CALLED toggles. No red. The "off" state is
                                        neutral (transparent). The "on" state fills green / amber.
                                        Status bubbles above the dispo name (see the list-row
                                        markup higher up) mirror these so you can see what's
                                        marked at a glance without expanding the editor. */}
                                    <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                                      {(() => {
                                        const visited = item.status === 'visited';
                                        return (
                                          <Box role="button"
                                            onClick={() => updateStopField(item, {
                                              status: visited ? 'planned' : 'visited',
                                              visitedAt: visited ? null : new Date().toISOString(),
                                            })}
                                            sx={{
                                              flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                                              px: 1, py: 0.6, textAlign: 'center', borderRadius: 0.25, cursor: 'pointer',
                                              color: visited ? TERM.greenDk : TERM.muted,
                                              bgcolor: visited ? TERM.green : 'transparent',
                                              border: `1px solid ${visited ? TERM.green : TERM.borderDim}`,
                                              '&:hover': { borderColor: TERM.green, color: visited ? TERM.greenDk : TERM.green },
                                            }}>{visited ? '✓ VISITED' : 'MARK VISITED'}</Box>
                                        );
                                      })()}
                                      {(() => {
                                        const called = item.status === 'pre_called';
                                        return (
                                          <Box role="button"
                                            onClick={() => updateStopField(item, {
                                              status: called ? 'planned' : 'pre_called',
                                            })}
                                            sx={{
                                              flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                                              px: 1, py: 0.6, textAlign: 'center', borderRadius: 0.25, cursor: 'pointer',
                                              color: called ? '#000' : TERM.muted,
                                              bgcolor: called ? TERM.amber : 'transparent',
                                              border: `1px solid ${called ? TERM.amber : TERM.borderDim}`,
                                              '&:hover': { borderColor: TERM.amber, color: called ? '#000' : TERM.amber },
                                            }}>{called ? '✓ CALLED' : 'MARK CALLED'}</Box>
                                        );
                                      })()}
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

          <MapStyleSwitcher current={styleId} onChange={onStyleChange} />

          {/* Heatmap toggle — always visible. Sources from live DISPENSARIES
              if loaded, else from saved dispensary leads, so it works on
              mobile without requiring the layer to be toggled first. */}
          <Box
            role="button" tabIndex={0}
            onClick={() => setHeatmapOn((v) => !v)}
            sx={{
              position: 'absolute', top: 60, left: 12, zIndex: 2,
              cursor: 'pointer',
              bgcolor: heatmapOn ? 'rgba(248,113,113,0.18)' : 'rgba(5,8,10,0.82)',
              border: `1px solid ${heatmapOn ? '#f87171' : TERM.borderDim}`,
              color: heatmapOn ? '#f87171' : TERM.muted,
              px: 1.25, py: 0.6, borderRadius: 0.5,
              fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.2,
              display: 'flex', alignItems: 'center', gap: 0.6,
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: '#f87171', color: '#f87171', bgcolor: 'rgba(248,113,113,0.12)' },
            }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              background: heatmapOn
                ? 'radial-gradient(circle, #f87171 0%, #fbbf24 50%, #4ade80 100%)'
                : TERM.muted,
            }} />
            DENSITY
          </Box>

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
              position: 'absolute', bottom: { xs: 70, sm: 50 }, left: '50%', transform: 'translateX(-50%)',
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

      {/* ── Mobile PLAN overlay ───────────────────────────────────────── */}
      {mobileTab === 'plan' && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, zIndex: 15,
          bgcolor: TERM.panel, flexDirection: 'column', overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
        }}>
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, letterSpacing: 1.5, mb: 1.5 }}>
              ─── NAVIGATE ───
            </Typography>
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
                      borderRadius: 4, padding: '10px 32px 10px 10px',
                      fontFamily: MONO, fontSize: 13, color: TERM.text,
                      outline: 'none', letterSpacing: 0.3,
                    }}
                  />
                  {locationSearching && (
                    <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 11, color: TERM.amber, fontFamily: MONO }}>…</Box>
                  )}
                </Box>
                <Box role="button" tabIndex={0}
                  onClick={() => { if (locationSearch.length > 1) searchLocation(locationSearch); }}
                  sx={{
                    fontFamily: MONO, fontSize: 11, fontWeight: 900, letterSpacing: 1,
                    color: TERM.greenDk, px: 1.5, flexShrink: 0,
                    cursor: 'pointer', borderRadius: 0.5,
                    bgcolor: TERM.green, border: `1.5px solid ${TERM.green}`,
                    display: 'flex', alignItems: 'center',
                    '&:hover': { opacity: 0.88 },
                  }}>
                  GO
                </Box>
              </Box>
              {locationResults.length > 0 && (
                <Box sx={{ mt: 0.5, border: `1px solid ${TERM.border}`, borderRadius: 0.5, overflow: 'hidden' }}>
                  {locationResults.map((f) => (
                    <Box key={f.id} role="button" tabIndex={0}
                      onClick={() => {
                        const [lng, lat] = f.center;
                        mapRef.current?.flyTo({ center: [lng, lat], zoom: 12, essential: true, duration: 1200 });
                        setLocationSearch('');
                        setLocationResults([]);
                        setMobileTab('map');
                      }}
                      sx={{
                        fontFamily: MONO, fontSize: 11, color: TERM.text, px: 1.25, py: 1,
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
              onClick={() => { flyToMyLocation(); setMobileTab('map'); }}
              sx={{
                fontFamily: MONO, fontSize: 13, fontWeight: 800, letterSpacing: 1,
                color: TERM.green, py: 1.25, px: 1.25, mb: 2,
                cursor: 'pointer', borderRadius: 0.5, userSelect: 'none',
                border: `1.5px solid ${TERM.green}`,
                bgcolor: 'rgba(74,222,128,0.06)',
                display: 'flex', alignItems: 'center', gap: 1,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.14)' },
              }}>
              <Box component="span" sx={{ fontSize: 16 }}>📍</Box>
              MY LOCATION
            </Box>

            <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, letterSpacing: 1.5, mb: 1 }}>
              ─── DAY PLANNER ───
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>
              ADDING PINS TO: <Box component="span" sx={{ color: TERM.green }}>{formatDayLabel(currentDayLabel).toUpperCase()}</Box>
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
              {knownDays.map((d) => {
                const isCurrent = d === currentDayLabel;
                return (
                  <Box key={d} role="button" tabIndex={0}
                    onClick={() => setCurrentDayLabel(d)}
                    sx={{
                      fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
                      px: 1.25, py: 0.75, cursor: 'pointer', borderRadius: 0.5,
                      color: isCurrent ? TERM.greenDk : TERM.muted,
                      bgcolor: isCurrent ? TERM.green : 'transparent',
                      border: `1px solid ${isCurrent ? TERM.green : TERM.borderDim}`,
                      '&:hover': { color: isCurrent ? TERM.greenDk : TERM.green, borderColor: TERM.green },
                    }}>
                    {/^\d{4}-\d{2}-\d{2}$/.test(d) ? formatDayLabel(d) : d.replace(/^Day /, 'D')}
                    {(() => { const cnt = savedItems.filter(s => (s.dayLabel || 'Unassigned') === d).length; return cnt > 0 ? <Box component="span" sx={{ ml: 0.5, opacity: 0.7, fontSize: 9 }}>·{cnt}</Box> : null; })()}
                  </Box>
                );
              })}
              <Box role="button" tabIndex={0}
                onClick={addNewDay}
                sx={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
                  px: 1.25, py: 0.75, cursor: 'pointer', borderRadius: 0.5,
                  color: TERM.amber, border: `1px dashed ${TERM.amber}`,
                  '&:hover': { bgcolor: 'rgba(251,191,36,0.08)' },
                }}>+ NEW DAY</Box>
            </Box>

            <Box role="button" tabIndex={0}
              onClick={() => setShowAddCustomPin(true)}
              sx={{
                fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: 1,
                px: 1.25, py: 1, cursor: 'pointer', borderRadius: 0.5,
                color: '#06b6d4', border: `1px dashed #06b6d4`,
                width: '100%', textAlign: 'center',
                '&:hover': { bgcolor: 'rgba(6,182,212,0.08)' },
              }}>+ ADD CUSTOM STOP</Box>
          </Box>
        </Box>
      )}

      {/* ── Mobile STOPS overlay ──────────────────────────────────────── */}
      {mobileTab === 'stops' && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, zIndex: 15,
          bgcolor: TERM.panel, flexDirection: 'column', overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(74,222,128,0.18)', borderRadius: 3 },
        }}>
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, letterSpacing: 1.5, mb: 1.5 }}>
              ─── TODAY'S STOPS · {savedItems.filter(s => (s.dayLabel || 'Unassigned') === todayISO()).length} ───
            </Typography>
            {(() => {
              const todayStops = savedItems
                .filter(s => (s.dayLabel || 'Unassigned') === todayISO())
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (new Date(a.createdAt) - new Date(b.createdAt)));
              if (todayStops.length === 0) return (
                <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, fontStyle: 'italic', py: 1 }}>
                  No stops planned for today. Tap MAP → layer pins to add some.
                </Typography>
              );
              return (
                <>
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    <Box role="button" tabIndex={0}
                      onClick={() => {
                        const coords = todayStops.map(s => `${s.lat},${s.lng}`).join('/');
                        window.open(`https://www.google.com/maps/dir/${coords}`, '_blank', 'noopener');
                      }}
                      sx={{
                        fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                        px: 1.25, py: 0.75, cursor: 'pointer', borderRadius: 0.5,
                        color: '#06b6d4', border: '1px solid #06b6d4',
                        '&:hover': { bgcolor: 'rgba(6,182,212,0.12)' },
                      }}>⤴ GOOGLE MAPS</Box>
                  </Stack>
                  {/* GO TONIGHT — build / drive the pitch route to today's active sleep */}
                  {(() => {
                    const todayLabel = todayStops[0]?.dayLabel || currentDayLabel;
                    const sleepActive = activeSleepFor(todayLabel);
                    const noSleep = !sleepActive;
                    return (
                      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                        <Box role="button" tabIndex={0}
                          onClick={() => {
                            if (execMode) { stopExec(); return; }
                            if (noSleep) {
                              showToast('Set a TONIGHT sleep pin for today first.', 'error');
                              return;
                            }
                            // If a planner-built route exists, jump into exec.
                            // Otherwise open the planner so user can pick stops first.
                            if (planning.route) startExec(todayLabel);
                            else openPitchPlanner(todayLabel);
                          }}
                          sx={{
                            flex: 1,
                            fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: 1.5,
                            px: 1.5, py: 1, cursor: 'pointer', borderRadius: 0.5,
                            color: execMode ? '#000' : (noSleep ? TERM.muted : TERM.greenDk),
                            bgcolor: execMode ? TERM.red : (noSleep ? 'transparent' : TERM.green),
                            border: `1px solid ${execMode ? TERM.red : (noSleep ? TERM.borderDim : TERM.green)}`,
                            textAlign: 'center',
                            '&:hover': { opacity: 0.9 },
                          }}>
                          {execMode ? '■ STOP TRIP' : (planning.route ? '▶ GO TONIGHT' : '🛣 BUILD ROUTE')}
                        </Box>
                        {/* Legacy CAMP TONIGHT — fly to last stop + show campgrounds (kept as fallback). */}
                        {(() => {
                          const lastStop = todayStops[todayStops.length - 1];
                          if (!lastStop) return null;
                          return (
                            <Box role="button" tabIndex={0}
                              title="Find campgrounds near your last stop"
                              onClick={() => {
                                if (isFinite(lastStop.lat) && isFinite(lastStop.lng)) {
                                  mapRef.current?.flyTo({ center: [lastStop.lng, lastStop.lat], zoom: 11, essential: true, duration: 1400 });
                                }
                                const campLayer = LAYERS.find(l => l.id === 'campgrounds');
                                if (campLayer && !layerState.campgrounds?.active) dropLayerPins(campLayer);
                                setMobileTab('map');
                              }}
                              sx={{
                                fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                                px: 1, py: 0.75, cursor: 'pointer', borderRadius: 0.5,
                                color: TERM.amber,
                                bgcolor: 'rgba(251,191,36,0.08)',
                                border: `1px solid ${TERM.amber}`,
                              }}>⛺</Box>
                          );
                        })()}
                      </Stack>
                    );
                  })()}

                  {todayStops.map((item, i) => {
                    return (
                      <Box key={item._id}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          py: 1, px: 0.75, mb: 0.5, borderRadius: 0.5,
                          cursor: 'pointer',
                          bgcolor: editingStop === item._id ? 'rgba(74,222,128,0.04)' : 'transparent',
                          '&:hover': { bgcolor: 'rgba(74,222,128,0.04)' },
                        }}
                        onClick={() => { flyToSaved(item); setEditingStop(prev => prev === item._id ? null : item._id); setMobileTab('map'); }}>
                        <Box sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, minWidth: 18, textAlign: 'right' }}>{i + 1}.</Box>
                        {/* Mobile STOPS row indicator — sleep emoji | green ✓ |
                            amber 📞 | red dot (default = not done yet). */}
                        {item.sleepRole ? (
                          <Box sx={{ fontSize: 16, flexShrink: 0 }}>
                            {item.sleepRole === 'backup' ? '🅿'
                              : item.sleepKind === 'campground' ? '⛺'
                              : item.sleepKind === 'park_and_ride' ? '🅿'
                              : item.sleepKind === 'hotel' ? '🏨'
                              : item.sleepKind === 'friend' ? '🏠'
                              : '🌙'}
                          </Box>
                        ) : item.status === 'visited' ? (
                          <Box sx={{
                            fontFamily: MONO, fontSize: 11, fontWeight: 900,
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: TERM.green, color: TERM.greenDk,
                          }}>✓</Box>
                        ) : item.status === 'pre_called' ? (
                          <Box sx={{
                            fontSize: 11, flexShrink: 0,
                            width: 20, height: 20, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: TERM.amber, color: '#000',
                          }}>📞</Box>
                        ) : (
                          <Box sx={{
                            width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                            bgcolor: TERM.red, boxShadow: `0 0 6px ${TERM.red}66`,
                          }} />
                        )}
                        <Typography sx={{
                          flexGrow: 1, fontFamily: MONO, fontSize: 12, fontWeight: 600,
                          color: item.sleepRole
                            ? (item.sleepRole === 'backup' ? TERM.amber : TERM.green)
                            : TERM.text,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{item.name}</Typography>
                        <Box role="button"
                          onClick={(e) => { e.stopPropagation(); deleteSavedItem(item); }}
                          sx={{
                            fontFamily: MONO, fontSize: 14, color: TERM.red,
                            px: 0.5, cursor: 'pointer', flexShrink: 0,
                            bgcolor: pendingDeleteId === item._id ? 'rgba(248,113,113,0.18)' : 'transparent',
                            borderRadius: 0.25,
                          }}>
                          {pendingDeleteId === item._id ? '✓?' : '×'}
                        </Box>
                      </Box>
                    );
                  })}
                </>
              );
            })()}

            {itinerary.length > 0 && (
              <>
                <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, letterSpacing: 1.5, mt: 2, mb: 1 }}>
                  ─── ALL DAYS ───
                </Typography>
                {itinerary.map(([day, stops]) => {
                  const dayColor = colorForDay(day);
                  return (
                    <Box key={day} sx={{ mb: 1.5 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dayColor, flexShrink: 0 }} />
                        <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: TERM.text, flexGrow: 1 }}>
                          {formatDayLabel(day).toUpperCase()} <Box component="span" sx={{ color: TERM.muted, fontWeight: 500 }}>· {stops.length}</Box>
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </>
            )}
          </Box>
        </Box>
      )}

      {/* ── Mobile tab bar ────────────────────────────────────────────── */}
      <Box sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
        height: 56,
        bgcolor: TERM.panel,
        borderTop: `1px solid ${TERM.border}`,
      }}>
        {[
          { id: 'map',   label: 'MAP',   icon: '⊕' },
          { id: 'plan',  label: 'PLAN',  icon: '⊞' },
          { id: 'stops', label: 'STOPS', icon: '◉' },
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
              transition: 'all 0.15s ease',
              gap: 0.25,
            }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 16, lineHeight: 1 }}>{tab.icon}</Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{tab.label}</Typography>
          </Box>
        ))}
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
              placeholder=""
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${TERM.borderDim}`, borderRadius: 3,
                padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: TERM.text,
                outline: 'none', marginBottom: 12,
              }}
            />
            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.75 }}>ADDRESS</Typography>
            <input
              value={customPinForm.address}
              onChange={(e) => setCustomPinForm(f => ({ ...f, address: e.target.value }))}
              placeholder=""
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
              placeholder=""
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

      {/* ── NEXT STOP card (mobile, only while execMode) ───────────────── */}
      {execMode && nextStop && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', left: 8, right: 8, bottom: 64, zIndex: 25,
          flexDirection: 'column', gap: 0.5,
          bgcolor: TERM.panel, border: `1px solid ${TERM.green}`,
          borderRadius: 0.5, p: 1.25,
          boxShadow: `0 -4px 16px rgba(74,222,128,0.18)`,
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{
              fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1, color: TERM.green,
            }}>
              ▶ NEXT STOP {execDay && stopsForDay(execDay).filter(s => s.status !== 'visited' && s.status !== 'dead' && !s.sleepRole).length > 0
                ? `· ${stopsForDay(execDay).filter(s => s.status !== 'visited' && s.status !== 'dead' && !s.sleepRole).findIndex(s => s._id === nextStop._id) + 1} of ${stopsForDay(execDay).filter(s => !s.sleepRole).length}`
                : ''}
            </Typography>
            <Box role="button" onClick={stopExec}
              sx={{
                fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                color: TERM.muted, cursor: 'pointer',
                '&:hover': { color: TERM.red },
              }}>■ STOP</Box>
          </Stack>
          <Typography sx={{
            fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TERM.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nextStop.name}</Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted }}>
            {nextStop._distanceMi != null ? `${formatMiles(nextStop._distanceMi)} · ETA ${formatMinutes(nextStop._etaMin)}` : 'Locating…'}
            {execDay && activeSleepFor(execDay) && nextStop._id !== activeSleepFor(execDay)._id
              ? ` · then 🌙 ${activeSleepFor(execDay).name}` : ''}
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
            <Box role="button" onClick={markNextStopVisited}
              sx={{
                flex: 1, fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                py: 0.75, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                bgcolor: TERM.green, color: TERM.greenDk,
              }}>✓ VISITED</Box>
            <Box role="button" onClick={skipNextStop}
              sx={{
                flex: 1, fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                py: 0.75, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                color: TERM.amber, border: `1px solid ${TERM.amber}`,
              }}>⤳ SKIP</Box>
            {nextStop.phone && (
              <Box role="button"
                onClick={() => window.open(`tel:${nextStop.phone}`)}
                sx={{
                  fontFamily: MONO, fontSize: 12, fontWeight: 800,
                  px: 1.2, py: 0.75, borderRadius: 0.5, cursor: 'pointer',
                  color: '#06b6d4', border: '1px solid #06b6d4',
                }}>📞</Box>
            )}
            {execDay && primarySleepFor(execDay) && backupSleepFor(execDay) && (
              <Box role="button"
                onClick={() => flipActiveSleep(execDay)}
                title="Swap to backup sleep"
                sx={{
                  fontFamily: MONO, fontSize: 12, fontWeight: 800,
                  px: 1.2, py: 0.75, borderRadius: 0.5, cursor: 'pointer',
                  color: TERM.muted, border: `1px solid ${TERM.borderDim}`,
                }}>🌙</Box>
            )}
          </Stack>
        </Box>
      )}

      {/* ── PITCH ROUTE planner modal ───────────────────────────────────── */}
      {planning.open && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1100,
          bgcolor: 'rgba(5,8,10,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          p: { xs: 1, sm: 2 },
        }} onClick={() => setPlanning(p => ({ ...p, open: false }))}>
          <Box sx={{
            bgcolor: TERM.panel, border: `1px solid ${TERM.amber}`,
            borderRadius: 0.5, p: 2,
            width: { xs: '100%', sm: 520 },
            maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: MONO,
          }} onClick={(e) => e.stopPropagation()}>
            <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: TERM.amber, letterSpacing: 1, flexGrow: 1 }}>
                🛣 PITCH ROUTE · {planning.day && formatDayLabel(planning.day).toUpperCase()}
              </Typography>
              <Box role="button" onClick={() => setPlanning(p => ({ ...p, open: false }))}
                sx={{ color: TERM.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, px: 0.5 }}>×</Box>
            </Stack>
            <Box sx={{ fontSize: 10, color: TERM.muted, mb: 1 }}>
              FROM: <Box component="span" sx={{ color: TERM.text }}>{planning.origin?.label || '—'}</Box><br/>
              TO: <Box component="span" sx={{ color: planning.sleep?.sleepRole === 'backup' ? TERM.amber : TERM.green }}>
                🌙 {planning.sleep?.name || '—'}
              </Box>
            </Box>

            {planning.loading ? (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, py: 2 }}>
                Scanning corridor (this may auto-Google sparse areas)…
              </Typography>
            ) : planning.candidates.length === 0 ? (
              <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.muted, py: 2, fontStyle: 'italic' }}>
                No dispensaries within 8mi of the line between you and tonight's sleep. The corridor
                might be too rural — try pinning a different sleep destination, or scan manually using
                the DISPENSARIES layer.
              </Typography>
            ) : (
              <>
                <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>
                  CORRIDOR · {planning.candidates.length} CANDIDATES · {planning.selectedIds.size} PICKED
                  {planning.googleScan != null && (
                    <Box component="span" sx={{ ml: 1, color: TERM.amber, fontSize: 8 }}>
                      · {planning.googleScan} from auto-scan
                    </Box>
                  )}
                </Typography>
                {planning.scanMessage && (
                  <Typography sx={{ fontFamily: MONO, fontSize: 8.5, color: TERM.faint, letterSpacing: 0.5, mb: 0.5, fontStyle: 'italic' }}>
                    {planning.scanMessage}
                  </Typography>
                )}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', borderTop: `1px solid ${TERM.borderDim}`, mb: 1 }}>
                  {bucketByProgress(planning.candidates).map(({ bucket, items }) => (
                    <Box key={bucket} sx={{ mb: 0.5 }}>
                      <Typography sx={{ fontSize: 8, color: TERM.faint, letterSpacing: 1, mt: 0.5, mb: 0.25 }}>
                        {bucket * 10}% – {(bucket + 1) * 10}%
                      </Typography>
                      {items.map((c) => {
                        const picked = planning.selectedIds.has(c._id);
                        const lowDetour = c.detourMi != null && c.detourMi < 0.5;
                        return (
                          <Box key={c._id} role="button"
                            onClick={() => togglePlannerCandidate(c._id)}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1,
                              px: 0.75, py: 0.5, borderRadius: 0.25, cursor: 'pointer',
                              bgcolor: picked ? 'rgba(74,222,128,0.06)' : 'transparent',
                              '&:hover': { bgcolor: 'rgba(74,222,128,0.08)' },
                            }}>
                            <Box sx={{
                              width: 12, height: 12, border: `1px solid ${picked ? TERM.green : TERM.borderDim}`,
                              bgcolor: picked ? TERM.green : 'transparent',
                              borderRadius: 0.25, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: TERM.greenDk, fontSize: 9, fontWeight: 900,
                            }}>{picked ? '✓' : ''}</Box>
                            <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: TERM.text, flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c._isSaved
                                ? <Box component="span" sx={{ color: TERM.green, fontSize: 8, mr: 0.5 }}>★</Box>
                                : <Box component="span" sx={{ color: TERM.amber, fontSize: 8, mr: 0.5 }}>NEW</Box>}
                              {c.name}
                              {c.chainName && <Box component="span" sx={{ color: TERM.amber, ml: 0.5, fontSize: 8 }}>CHAIN</Box>}
                            </Typography>
                            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: lowDetour ? TERM.green : TERM.muted, flexShrink: 0 }}>
                              {c.detourMi != null ? `+${c.detourMi.toFixed(1)}mi` : ''}
                            </Typography>
                            <Typography sx={{ fontFamily: MONO, fontSize: 8, color: scoreMeta(c.score).color, flexShrink: 0, minWidth: 12, textAlign: 'right' }}>
                              {scoreMeta(c.score).label}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              </>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
              <Box role="button" onClick={buildPitchRoute}
                sx={{
                  flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  bgcolor: planning.selectedIds.size === 0 ? 'transparent' : TERM.amber,
                  color: planning.selectedIds.size === 0 ? TERM.muted : '#000',
                  border: `1px solid ${TERM.amber}`,
                  opacity: planning.selectedIds.size === 0 ? 0.5 : 1,
                  pointerEvents: planning.selectedIds.size === 0 ? 'none' : 'auto',
                }}>🛣 BUILD ROUTE ({planning.selectedIds.size})</Box>
              <Box role="button" onClick={() => setPlanning(p => ({ ...p, open: false }))}
                sx={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                  px: 2, py: 1, borderRadius: 0.5, cursor: 'pointer',
                  border: `1px solid ${TERM.borderDim}`, color: TERM.muted,
                }}>CANCEL</Box>
            </Stack>
          </Box>
        </Box>
      )}

      {/* ── VALIDATE AREA modal ─────────────────────────────────────────── */}

      {/* ── Set-as-Sleep quick picker ───────────────────────────────────── */}
      {setAsSleepPicker && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1100,
          bgcolor: 'rgba(5,8,10,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          p: { xs: 1, sm: 2 },
        }} onClick={() => setSetAsSleepPicker(null)}>
          <Box sx={{
            bgcolor: TERM.panel,
            border: `1px solid ${setAsSleepPicker.role === 'backup' ? TERM.amber : TERM.green}`,
            borderRadius: 0.5, p: 2,
            width: { xs: '100%', sm: 380 },
            fontFamily: MONO,
          }} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{
              fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: 1,
              color: setAsSleepPicker.role === 'backup' ? TERM.amber : TERM.green, mb: 1,
            }}>🌙 SET AS TONIGHT'S SLEEP</Typography>

            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>NAME (rename if Google got it wrong)</Typography>
            <input
              value={setAsSleepPicker.nameOverride}
              onChange={(e) => setSetAsSleepPicker(p => ({ ...p, nameOverride: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${TERM.borderDim}`, borderRadius: 3,
                padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: TERM.text,
                outline: 'none', marginBottom: 12,
              }}
            />

            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>DAY</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {knownDays.map((d) => (
                <Box key={d} role="button"
                  onClick={() => setSetAsSleepPicker(p => ({ ...p, day: d }))}
                  sx={{
                    fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: 1,
                    px: 1, py: 0.4, cursor: 'pointer', borderRadius: 0.25,
                    color: setAsSleepPicker.day === d ? TERM.greenDk : TERM.muted,
                    bgcolor: setAsSleepPicker.day === d ? TERM.green : 'transparent',
                    border: `1px solid ${setAsSleepPicker.day === d ? TERM.green : TERM.borderDim}`,
                  }}>{/^\d{4}-\d{2}-\d{2}$/.test(d) ? formatDayLabel(d) : d.replace(/^Day /, 'D')}</Box>
              ))}
            </Box>

            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>ROLE</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5 }}>
              {[{ v: 'primary', l: '⛺ PRIMARY', c: TERM.green },
                { v: 'backup',  l: '🅿 BACKUP',  c: TERM.amber }].map((opt) => (
                <Box key={opt.v} role="button"
                  onClick={() => setSetAsSleepPicker(p => ({ ...p, role: opt.v }))}
                  sx={{
                    flex: 1, fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                    px: 1, py: 0.5, cursor: 'pointer', borderRadius: 0.25, textAlign: 'center',
                    color: setAsSleepPicker.role === opt.v ? '#000' : opt.c,
                    bgcolor: setAsSleepPicker.role === opt.v ? opt.c : 'transparent',
                    border: `1px solid ${opt.c}`,
                  }}>{opt.l}</Box>
              ))}
            </Box>

            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>KIND</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mb: 1.5 }}>
              {[
                { v: 'campground',    l: '⛺ CAMP' },
                { v: 'park_and_ride', l: '🅿 P&R' },
                { v: 'hotel',         l: '🏨 HOTEL' },
                { v: 'friend',        l: '🏠 FRIEND' },
                { v: 'other',         l: '· OTHER' },
              ].map((opt) => (
                <Box key={opt.v} role="button"
                  onClick={() => setSetAsSleepPicker(p => ({ ...p, kind: opt.v }))}
                  sx={{
                    fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                    px: 0.75, py: 0.4, cursor: 'pointer', borderRadius: 0.25,
                    color: setAsSleepPicker.kind === opt.v ? TERM.greenDk : TERM.muted,
                    bgcolor: setAsSleepPicker.kind === opt.v ? TERM.green : 'transparent',
                    border: `1px solid ${setAsSleepPicker.kind === opt.v ? TERM.green : TERM.borderDim}`,
                  }}>{opt.l}</Box>
              ))}
            </Box>

            <Stack direction="row" spacing={1}>
              <Box role="button" onClick={confirmSetAsSleep}
                sx={{
                  flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  py: 1, borderRadius: 0.5, cursor: 'pointer', textAlign: 'center',
                  bgcolor: TERM.green, color: TERM.greenDk,
                }}>CONFIRM</Box>
              <Box role="button" onClick={() => setSetAsSleepPicker(null)}
                sx={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                  px: 2, py: 1, borderRadius: 0.5, cursor: 'pointer',
                  border: `1px solid ${TERM.borderDim}`, color: TERM.muted,
                }}>CANCEL</Box>
            </Stack>
          </Box>
        </Box>
      )}

      {/* ── Sleep Editor modal ─────────────────────────────────────────── */}
      {sleepEditor.open && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1100,
          bgcolor: 'rgba(5,8,10,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          p: { xs: 1, sm: 2 },
        }} onClick={() => setSleepEditor(s => ({ ...s, open: false }))}>
          <Box sx={{
            bgcolor: TERM.panel,
            border: `1px solid ${sleepEditor.role === 'backup' ? TERM.amber : TERM.green}`,
            borderRadius: 0.5, p: 2,
            width: { xs: '100%', sm: 420 },
            fontFamily: MONO,
          }} onClick={(e) => e.stopPropagation()}>
            <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{
                fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: 1, flexGrow: 1,
                color: sleepEditor.role === 'backup' ? TERM.amber : TERM.green,
              }}>
                {sleepEditor.role === 'backup' ? '🅿 BACKUP SLEEP' : '⛺ PRIMARY SLEEP'}
                {' · '}{sleepEditor.day && formatDayLabel(sleepEditor.day).toUpperCase()}
              </Typography>
              <Box role="button" onClick={() => setSleepEditor(s => ({ ...s, open: false }))}
                sx={{ color: TERM.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, px: 0.5 }}>×</Box>
            </Stack>

            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>KIND</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
              {[
                { v: 'campground',    l: '⛺ CAMP' },
                { v: 'park_and_ride', l: '🅿 P&R' },
                { v: 'hotel',         l: '🏨 HOTEL' },
                { v: 'friend',        l: '🏠 FRIEND' },
                { v: 'other',         l: '· OTHER' },
              ].map((opt) => (
                <Box key={opt.v} role="button"
                  onClick={() => setSleepEditor(s => ({ ...s, kind: opt.v }))}
                  sx={{
                    fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                    px: 0.75, py: 0.5, cursor: 'pointer', borderRadius: 0.25,
                    color: sleepEditor.kind === opt.v ? TERM.greenDk : TERM.muted,
                    bgcolor: sleepEditor.kind === opt.v ? TERM.green : 'transparent',
                    border: `1px solid ${sleepEditor.kind === opt.v ? TERM.green : TERM.borderDim}`,
                  }}>{opt.l}</Box>
              ))}
            </Box>

            <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, letterSpacing: 1, mb: 0.5 }}>SEARCH ADDRESS OR PLACE NAME</Typography>
            <input
              autoFocus
              value={sleepEditor.query}
              onChange={(e) => sleepEditorSearch(e.target.value)}
              placeholder="e.g. High Point State Park, NJ"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${TERM.borderDim}`, borderRadius: 3,
                padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: TERM.text,
                outline: 'none', marginBottom: 8,
              }}
            />

            <Box sx={{ maxHeight: 220, overflowY: 'auto', mb: 1 }}>
              {sleepEditor.searching && (
                <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, fontStyle: 'italic' }}>Searching…</Typography>
              )}
              {!sleepEditor.searching && sleepEditor.results.map((f) => (
                <Box key={f.id}
                  sx={{
                    py: 0.75, px: 1, mb: 0.5, borderRadius: 0.25,
                    border: `1px solid ${TERM.borderDim}`,
                    '&:hover': { borderColor: TERM.green },
                  }}>
                  <Typography sx={{ fontFamily: MONO, fontSize: 11, color: TERM.text, mb: 0.25 }}>{f.text}</Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 9, color: TERM.muted, mb: 0.5 }}>{f.place_name}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Box role="button"
                      onClick={async () => {
                        const lead = await assignSleep({
                          feature: f, day: sleepEditor.day,
                          role: sleepEditor.role, kind: sleepEditor.kind,
                        });
                        if (lead) {
                          mapRef.current?.flyTo({ center: f.center, zoom: 11, duration: 1200 });
                          setSleepEditor(s => ({ ...s, open: false }));
                        }
                      }}
                      sx={{
                        fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                        px: 0.75, py: 0.4, cursor: 'pointer', borderRadius: 0.25,
                        bgcolor: TERM.green, color: TERM.greenDk,
                      }}>USE THIS NAME</Box>
                    <Box role="button"
                      onClick={() => {
                        const renamed = window.prompt('Rename this place:', f.text);
                        if (!renamed) return;
                        assignSleep({
                          feature: f, day: sleepEditor.day,
                          role: sleepEditor.role, kind: sleepEditor.kind,
                          customName: renamed,
                        }).then(lead => {
                          if (lead) {
                            mapRef.current?.flyTo({ center: f.center, zoom: 11, duration: 1200 });
                            setSleepEditor(s => ({ ...s, open: false }));
                          }
                        });
                      }}
                      sx={{
                        fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                        px: 0.75, py: 0.4, cursor: 'pointer', borderRadius: 0.25,
                        color: TERM.amber, border: `1px solid ${TERM.amber}`,
                      }}>✎ RENAME + USE</Box>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
