// src/screens/studio/RoadTripTab.js
//
// Phase 2a: minimal shell to verify Mapbox renders correctly. Just the map,
// a header bar, a side panel skeleton, and a small "status readout" footer.
// No data layers, no place search, no leads yet — those land in phases 2b/3.
//
// The visual language is intentionally different from the rest of Studio —
// monospace UI font, bracketed labels, dark near-black background — to feel
// like an intel terminal while still being anchored by the Joint Printing
// brand header. The Studio shell needs to drop its maxWidth container when
// this tab is active (handled in Studio.js).

import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import config from '../../config.json';

// ── Terminal palette. Keep Joint Printing green as the accent so the tool
//    still feels on-brand even with a totally different visual register. ──
const TERM = {
  bg:      '#05080a',
  panel:   '#0a0e10',
  border:  '#1a3d2b',
  borderDim: 'rgba(74,222,128,0.12)',
  green:   '#4ade80',
  greenDk: '#1a3d2b',
  amber:   '#fbbf24',
  red:     '#f87171',
  text:    '#d4f4dd',
  muted:   'rgba(212,244,221,0.5)',
  faint:   'rgba(212,244,221,0.18)',
};

const MONO = 'ui-monospace, "JetBrains Mono", "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';

// Starting view: somewhere in central NJ, zoomed to show the Northeast.
const INITIAL_CENTER = [-74.5, 40.5];
const INITIAL_ZOOM   = 6.2;

export default function RoadTripTab() {
  const mapContainerRef = React.useRef(null);
  const mapRef          = React.useRef(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [mapError, setMapError] = React.useState('');
  const [center, setCenter] = React.useState({ lng: INITIAL_CENTER[0], lat: INITIAL_CENTER[1] });
  const [zoom, setZoom]     = React.useState(INITIAL_ZOOM);

  // Initialize the map once on mount, tear it down on unmount.
  React.useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!config.mapboxToken) {
      setMapError('No Mapbox token configured.');
      return;
    }

    try {
      mapboxgl.accessToken = config.mapboxToken;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => setMapReady(true));
      map.on('error', (e) => {
        const msg = e?.error?.message || 'Map error.';
        // Suppress non-fatal tile fetch hiccups so the panel doesn't flicker.
        if (/source|tile/i.test(msg) && /timeout|aborted/i.test(msg)) return;
        setMapError(msg);
      });
      map.on('move', () => {
        const c = map.getCenter();
        setCenter({ lng: c.lng, lat: c.lat });
        setZoom(map.getZoom());
      });

      mapRef.current = map;
    } catch (err) {
      setMapError(err.message || 'Failed to initialize map.');
    }

    return () => {
      try { mapRef.current?.remove(); } catch (e) {}
      mapRef.current = null;
    };
  }, []);

  // Reusable label/value row for the side panel
  const Stat = ({ label, value, color = TERM.text }) => (
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

  return (
    <Box sx={{
      bgcolor: TERM.bg, color: TERM.text,
      // Full viewport minus the Studio top bar so the map can breathe.
      height: 'calc(100vh - 56px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: MONO,
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
          label={mapReady ? 'LINK ESTABLISHED' : 'CONNECTING...'}
          size="small"
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
            <Typography sx={{
              fontFamily: MONO, fontSize: 10, color: TERM.muted,
              letterSpacing: 1.5, mb: 1.5,
            }}>
              ─── COORDINATES ───
            </Typography>
            <Stat label="LON" value={center.lng.toFixed(4)} />
            <Stat label="LAT" value={center.lat.toFixed(4)} />
            <Stat label="ZOOM" value={zoom.toFixed(2)} color={TERM.green} />

            <Typography sx={{
              fontFamily: MONO, fontSize: 10, color: TERM.muted,
              letterSpacing: 1.5, mt: 3, mb: 1.5,
            }}>
              ─── ASSETS ───
            </Typography>
            <Stat label="DISPENSARIES" value="—" />
            <Stat label="COFFEE / WIFI" value="—" />
            <Stat label="PARKS"         value="—" />
            <Stat label="CAMPGROUNDS"   value="—" />
            <Stat label="LEADS"         value="—" />

            <Typography sx={{
              fontFamily: MONO, fontSize: 10, color: TERM.muted,
              letterSpacing: 1.5, mt: 3, mb: 1.5,
            }}>
              ─── SYSTEM ───
            </Typography>
            <Stat label="MAP_ENGINE" value="mapbox/dark-v11" color={TERM.green} />
            <Stat label="STATUS"     value={mapReady ? 'OPERATIONAL' : 'INIT'}
              color={mapReady ? TERM.green : TERM.amber} />
            <Stat label="PHASE"      value="2a/4" color={TERM.amber} />

            <Box sx={{
              mt: 3, p: 1.5, border: `1px dashed ${TERM.borderDim}`, borderRadius: 0.5,
            }}>
              <Typography sx={{
                fontFamily: MONO, fontSize: 10, color: TERM.muted, lineHeight: 1.55,
              }}>
                {'>'} SHELL_READY. NO_DATA_LAYERS_LOADED.<br />
                {'>'} AWAITING_PHASE_2B_FOR_LEADS,<br />
                {'>'} PHASE_3_FOR_PLACE_SEARCH.
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
            }}
          />

          {/* Bottom-left crosshair / brand watermark */}
          <Box sx={{
            position: 'absolute', left: 12, bottom: 12, zIndex: 1,
            px: 1.25, py: 0.5, borderRadius: 0.5,
            bgcolor: 'rgba(5,8,10,0.78)', border: `1px solid ${TERM.borderDim}`,
            fontFamily: MONO, fontSize: 10, color: TERM.green, letterSpacing: 1.5,
          }}>
            ◢ JP_RECON · LIVE
          </Box>

          {mapError && (
            <Box sx={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              zIndex: 2, maxWidth: 480,
            }}>
              <Alert severity="error"
                sx={{
                  bgcolor: 'rgba(248,113,113,0.12)', color: TERM.red,
                  border: `1px solid ${TERM.red}`,
                  fontFamily: MONO, fontSize: 12,
                }}>
                MAP_ERROR: {mapError}
              </Alert>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
