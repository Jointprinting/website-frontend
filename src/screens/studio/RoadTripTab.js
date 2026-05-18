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
import CircularProgress from '@mui/material/CircularProgress';
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
const COORDS_COLLAPSED_KEY = 'jpRoadTripCoordsCollapsed';

// ─────────────────────────────────────────────────────────────────────────────
// Layer + style definitions
// ─────────────────────────────────────────────────────────────────────────────
const LAYERS = [
  {
    id:    'dispensaries',
    label: 'DISPENSARIES',
    short: 'DISP',
    color: '#4ade80',
    icon:  '◉',
    endpoint: '/api/roadtrip/search/dispensaries',
    defaultRadius: 20000,
  },
  {
    id:    'coffee',
    label: 'COFFEE',
    short: 'CAFE',
    color: '#d4a76a',
    icon:  '☕',
    endpoint: '/api/roadtrip/search/coffee',
    defaultRadius: 10000,
  },
  {
    id:    'parks',
    label: 'PARKS',
    short: 'PARK',
    color: '#22c55e',
    icon:  '▲',
    endpoint: '/api/roadtrip/search/parks',
    defaultRadius: 80000,
  },
  {
    id:    'campgrounds',
    label: 'CAMPING',
    short: 'CAMP',
    color: '#fb923c',
    icon:  '⛺',
    endpoint: '/api/roadtrip/search/campgrounds',
    defaultRadius: 50000,
  },
];

const MAP_STYLES = [
  { id: 'dark',      label: 'DARK', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'satellite', label: 'SAT',  url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'streets',   label: 'STR',  url: 'mapbox://styles/mapbox/streets-v12' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Marker DOM builder
// ─────────────────────────────────────────────────────────────────────────────
function buildMarkerEl(layer, place) {
  const el = document.createElement('div');
  el.className = 'jp-marker';
  const isChain = place.isChain;
  const color   = layer.color;

  // Outer wrapper handles the chain ring + hover scale
  el.style.cssText = `
    position: relative;
    width: 22px; height: 22px;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
    display: flex; align-items: center; justify-content: center;
  `;

  // Chain ring (only on dispensary chains)
  if (isChain) {
    const ring = document.createElement('div');
    ring.style.cssText = `
      position: absolute; inset: -4px;
      border: 1.5px dashed ${TERM.amber};
      border-radius: 50%;
      opacity: 0.85;
    `;
    el.appendChild(ring);
  }

  // Main dot
  const dot = document.createElement('div');
  dot.style.cssText = `
    width: 14px; height: 14px;
    border-radius: 50%;
    background: ${color};
    border: 2px solid #05080a;
    box-shadow: 0 0 0 1px ${color}, 0 0 12px ${color}80;
  `;
  el.appendChild(dot);

  // Animate in: scale from 0 to 1
  el.animate(
    [{ transform: 'scale(0)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
    { duration: 380, easing: 'cubic-bezier(0.34,1.56,0.64,1)' }
  );

  // Hover bounce
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.4)'; });
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

  return el;
}

// Popup HTML/DOM
function buildPopupContent({ place, layer, onSave, onHide, savedAsLeadId, hideAvailable }) {
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

  const saveBtn = document.createElement('button');
  const savedNow = !!savedAsLeadId;
  saveBtn.textContent = savedNow ? '✓ SAVED AS LEAD' : '＋ SAVE AS LEAD';
  saveBtn.disabled   = savedNow;
  saveBtn.style.cssText = btnStyle(savedNow ? 'success' : 'primary');
  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'SAVING…';
    onSave(place, layer)
      .then(() => { saveBtn.textContent = '✓ SAVED AS LEAD'; saveBtn.style.cssText = btnStyle('success'); })
      .catch((e) => { saveBtn.disabled = false; saveBtn.textContent = '＋ SAVE AS LEAD'; saveBtn.style.cssText = btnStyle('primary');
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

function Stat({ label, value, color = TERM.text }) {
  return (
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
  const [center, setCenter]     = React.useState({ lng: INITIAL_CENTER[0], lat: INITIAL_CENTER[1] });
  const [zoom, setZoom]         = React.useState(INITIAL_ZOOM);

  // Per-layer state — just for UI counts/loading. Markers themselves live
  // in markersRef so React state churn doesn't force GC / re-render of
  // hundreds of DOM nodes.
  const [layerState, setLayerState] = React.useState(() => {
    const init = {};
    for (const l of LAYERS) init[l.id] = { active: false, loading: false, count: 0, lastSearchAt: null };
    return init;
  });

  // Markers + active leads (so popups can show "already saved" state)
  const markersRef       = React.useRef({ dispensaries: [], coffee: [], parks: [], campgrounds: [] });
  const leadsByExtIdRef  = React.useRef(new Map()); // externalId -> leadId
  const [leadCount, setLeadCount] = React.useState(0);
  const [toast, setToast] = React.useState(null); // {message, kind}

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
        const c = map.getCenter();
        setCenter({ lng: c.lng, lat: c.lat });
        setZoom(map.getZoom());

        if (lastSearchCenterRef.current) {
          const dx = c.lng - lastSearchCenterRef.current.lng;
          const dy = c.lat - lastSearchCenterRef.current.lat;
          // Crude "moved enough to warrant a refresh" threshold (~5km).
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

  // ── Initial leads load — so popups know what's already saved ────────────
  React.useEffect(() => {
    if (!token) return;
    axios.get(`${config.backendUrl}/api/roadtrip/leads`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      const map = new Map();
      for (const lead of r.data || []) {
        if (lead.externalId) map.set(lead.externalId, lead._id);
      }
      leadsByExtIdRef.current = map;
      setLeadCount(r.data?.length || 0);
    }).catch(() => {});
  }, [token]);

  // ── Style switching — preserves layers ───────────────────────────────────
  const onStyleChange = (id) => {
    if (!mapRef.current) return;
    const style = MAP_STYLES.find((s) => s.id === id);
    if (!style || id === styleId) return;
    setStyleId(id);
    mapRef.current.setStyle(style.url);
    // Re-apply markers after style finishes loading (otherwise they'd be
    // wiped). One-shot listener.
    mapRef.current.once('style.load', () => {
      // markers persist on the map automatically; nothing else to do.
    });
  };

  // ── Pin handlers ─────────────────────────────────────────────────────────
  const showToast = (message, kind = 'info') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2400);
  };

  const onSaveLead = async (place, layer) => {
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
      status:     'planned',
    };
    const r = await axios.post(
      `${config.backendUrl}/api/roadtrip/leads`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    leadsByExtIdRef.current.set(place.externalId, r.data._id);
    setLeadCount((c) => c + 1);
    showToast(`Saved "${place.name}" as lead.`, 'success');
  };

  const onHideDispensary = async (place) => {
    try {
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
          offset: 18, closeButton: true, closeOnClick: false, maxWidth: '340px',
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
            JP.RECON // ROAD_TRIP_v0
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
        display: 'flex', gap: 1, flexWrap: { xs: 'wrap', md: 'nowrap' },
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

      {/* ── Body: map + side panel ─────────────────────────────────────── */}
      <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* Side panel */}
        <Box sx={{
          width: { xs: 0, md: 280 }, flexShrink: 0,
          display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
          bgcolor: TERM.panel, borderRight: `1px solid ${TERM.border}`,
          overflow: 'auto',
        }}>
          <Box sx={{ p: 2 }}>
            <PanelSection title="COORDINATES" defaultOpen={false} persistKey={COORDS_COLLAPSED_KEY}>
              <Stat label="LON" value={center.lng.toFixed(4)} />
              <Stat label="LAT" value={center.lat.toFixed(4)} />
              <Stat label="ZOOM" value={zoom.toFixed(2)} color={TERM.green} />
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
              <Stat label="LEADS"
                value={leadCount}
                color={leadCount > 0 ? TERM.green : TERM.text} />
            </PanelSection>

            <PanelSection title="SYSTEM" defaultOpen={false}>
              <Stat label="STYLE" value={styleId.toUpperCase()} color={TERM.green} />
              <Stat label="STATUS" value={mapReady ? 'OPERATIONAL' : 'INIT'}
                color={mapReady ? TERM.green : TERM.amber} />
              <Stat label="PHASE" value="3b/4" color={TERM.amber} />
            </PanelSection>

            <Box sx={{ mt: 2, p: 1.5, border: `1px dashed ${TERM.borderDim}`, borderRadius: 0.5 }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 10, color: TERM.muted, lineHeight: 1.55 }}>
                {anyActive
                  ? <>{'>'} {LAYERS.filter((l) => layerState[l.id].active).length} LAYERS ACTIVE.<br />
                      {'>'} CLICK A PIN FOR DETAILS.<br />
                      {'>'} PAN MAP, HIT REFRESH TO RE-SEARCH.</>
                  : <>{'>'} TAP A LAYER TILE TO LOAD PINS.<br />
                      {'>'} CHAIN DISPENSARIES SHOW W/ AMBER RING.<br />
                      {'>'} ALL DATA STAYS IN YOUR DB.</>}
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

          {/* Brand watermark */}
          <Box sx={{
            position: 'absolute', left: 12, bottom: 12, zIndex: 1,
            px: 1.25, py: 0.5, borderRadius: 0.5,
            bgcolor: 'rgba(5,8,10,0.78)', border: `1px solid ${TERM.borderDim}`,
            fontFamily: MONO, fontSize: 10, color: TERM.green, letterSpacing: 1.5,
          }}>
            ◢ JP_RECON · LIVE
          </Box>

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
    </Box>
  );
}
