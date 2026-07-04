// src/screens/studio/outreach/ImportView.js
// The lead engine's progress readout. The engine itself runs on the API —
// always on, queue-aware: it watches the cold-lead reserve, sweeps OpenStreetMap
// state by state (scraping each shop's own site for a contact email, verifying,
// importing), milks a state dry, then advances the frontier and eventually wraps
// the country to re-catch new openings. There is nothing to operate here — the
// owner asked for exactly that ("something I shouldn't even see") — just live
// progress, plus one "Refill now" to force a sweep early.
//
// PRESENTATIONAL ONLY: frontier/regions/busy state lives in OutreachTab so an
// in-flight forced sweep survives switching sub-tabs and back.

import * as React from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, LinearProgress,
} from '@mui/material';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { D, mono, dropPrimaryBtn } from '../_shared';
import { StatPill } from './_outreach';

// "2h ago" style — small helper for swept/last-run notes.
function agoLabel(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// One state's tile in the coverage map: swept states show their last haul,
// the frontier state glows, untouched states sit dim until the engine arrives.
function RegionTile({ r, isFrontier }) {
  const swept = !!r.lastSweptAt;
  return (
    <Box sx={{
      px: 1.25, py: 0.9, borderRadius: 2, bgcolor: D.inset, minWidth: 0,
      border: `1px solid ${isFrontier ? D.green : swept ? D.lineHi : D.line}`,
      opacity: swept || isFrontier ? 1 : 0.55,
    }}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Typography sx={{ ...mono, fontSize: 11.5, fontWeight: 800, color: isFrontier ? D.green : swept ? D.text : D.faint }}>
          {r.label}
        </Typography>
        {isFrontier && (
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: D.green,
            boxShadow: '0 0 0 3px rgba(74,222,128,0.18)' }} />
        )}
      </Stack>
      <Typography sx={{ color: D.faint, fontSize: 10.5, mt: 0.25 }}>
        {isFrontier && !swept ? 'up next'
          : swept ? `+${r.lastNew ?? 0} · ${agoLabel(r.lastSweptAt)}`
            : 'not reached yet'}
      </Typography>
    </Box>
  );
}

export default function ImportView({ busy, frontier, regions = [], onRefillNow }) {
  const reserve = frontier?.availableColdLeads;
  const sweptCount = regions.filter((r) => r.lastSweptAt).length;

  return (
    <Stack spacing={2.5}>
      <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.lineHi}`, borderRadius: 2.5, p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <TravelExploreOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15 }}>Lead engine</Typography>
          <Box sx={{ px: 1, py: 0.2, borderRadius: 999, bgcolor: 'rgba(74,222,128,0.14)', border: `1px solid ${D.line}` }}>
            <Typography sx={{ ...mono, color: D.green, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>ALWAYS ON · FREE</Typography>
          </Box>
        </Stack>
        <Typography sx={{ color: D.muted, fontSize: 12.5, mb: 1.75 }}>
          Runs by itself in the background: it watches your cold-lead reserve, and whenever it dips low it sweeps
          the next states on the map — every dispensary OpenStreetMap knows about, each shop’s own site scraped
          for a real contact email, verified, imported. It drains a state, moves to the next, and loops the
          country to catch new openings. Nothing here to manage.
        </Typography>

        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <StatPill value={reserve != null ? reserve : '—'} label="Cold leads in reserve"
            tone={reserve > 20 ? D.green : D.amber} />
          <StatPill value={frontier?.activeLabel || '—'} label="Next state up" tone={D.text} />
          <StatPill value={`${sweptCount}/${regions.length || '—'}`} label="States swept" tone={D.text} />
          <StatPill value={frontier?.lastRunAt ? agoLabel(frontier.lastRunAt) : 'soon'} label="Last check" tone={D.muted} />
        </Stack>

        {frontier?.lastResult ? (
          <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5, mb: 1.5 }}>
            {frontier.lastResult}
          </Typography>
        ) : null}

        {busy ? (
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.lineHi}` }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <CircularProgress size={15} sx={{ color: D.green }} />
              <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700 }}>
                Sweeping{frontier?.activeLabel ? ` from ${frontier.activeLabel}` : ''}…
              </Typography>
            </Stack>
            <LinearProgress sx={{ height: 6, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': { bgcolor: D.green } }} />
            <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.9 }}>
              OpenStreetMap → each shop’s site → verify → import. A few states can take a couple of minutes —
              this keeps running if you switch tabs.
            </Typography>
          </Box>
        ) : (
          // Arrow wrapper: the click event must never leak into the restart param.
          <Button onClick={() => onRefillNow()}
            startIcon={<BoltOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ ...dropPrimaryBtn, px: 2.5, py: 0.6, fontSize: 12.5 }}>
            Refill now
          </Button>
        )}
      </Box>

      {/* Coverage map — where the engine has been, where it is, what's next. */}
      {regions.length > 0 && (
        <Box>
          <Typography sx={{ ...mono, fontSize: 11, color: D.faint, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', mb: 1 }}>
            Coverage — {sweptCount} of {regions.length} states swept
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 1 }}>
            {regions.map((r) => (
              <RegionTile key={r.id} r={r} isFrontier={frontier?.activeRegion === r.id} />
            ))}
          </Box>
          {/* One-time catch-up after the finder itself improves: rewind to state
              one and re-milk the map. Dedupe makes it purely additive. */}
          {sweptCount > 0 && !busy && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
              <Button onClick={() => onRefillNow(true)} startIcon={<ReplayIcon sx={{ fontSize: 15 }} />}
                sx={{ color: D.muted, fontSize: 12, fontWeight: 700, textTransform: 'none', borderRadius: 999,
                  px: 1.5, py: 0.3, border: `1px solid ${D.line}`,
                  '&:hover': { color: D.text, borderColor: D.lineHi, bgcolor: 'rgba(255,255,255,0.04)' } }}>
                Re-sweep from the start
              </Button>
              <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
                The finder got smarter since the first pass — a re-sweep only adds shops it missed (nothing duplicates).
              </Typography>
            </Stack>
          )}
        </Box>
      )}
    </Stack>
  );
}
