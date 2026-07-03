// src/screens/studio/outreach/ImportView.js
// The lead machine — one free, automated path: pick a region (or let the
// auto-pilot run) and the server sweeps OpenStreetMap for dispensaries, scrapes
// each shop's site for a contact email, verifies deliverability, and imports the
// good ones as Cold Outreach leads. $0, no API key, no manual CSV.
//
// PRESENTATIONAL ONLY: all state (region, in-flight scan, results, frontier)
// lives in the parent OutreachTab and is passed in as props — so a scan that
// takes a minute+ (and its results) survives switching sub-tabs and back.

import * as React from 'react';
import {
  Box, Stack, Typography, Button, TextField, MenuItem, Alert, CircularProgress,
  Switch, Tooltip, LinearProgress,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import { D, mono, dropInput, dropPrimaryBtn } from '../_shared';
import { FINDER_REGIONS, StatPill } from './_outreach';

function AutoFinder({ region, onRegion, busy, result, frontier, autoBusy, onRun, onToggleAuto, onGoCampaigns }) {
  const regionLabel = (FINDER_REGIONS.find((r) => r.id === region) || {}).label || region;

  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.lineHi}`, borderRadius: 2.5, p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <TravelExploreOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15 }}>Auto-find dispensaries</Typography>
        <Box sx={{ px: 1, py: 0.2, borderRadius: 999, bgcolor: 'rgba(74,222,128,0.14)', border: `1px solid ${D.line}` }}>
          <Typography sx={{ ...mono, color: D.green, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>FREE</Typography>
        </Box>
      </Stack>
      <Typography sx={{ color: D.muted, fontSize: 12.5, mb: 1.5 }}>
        Sweeps OpenStreetMap for every dispensary in a region, scrapes each shop’s own website for a
        contact email, and imports the reachable ones as Cold Outreach leads — no cost, no API key.
        Start with New Jersey; expand outward once you’ve worked through it.
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField select size="small" value={region} onChange={(e) => onRegion(e.target.value)}
          sx={{ ...dropInput, minWidth: 170 }}>
          {FINDER_REGIONS.map((r) => (
            <MenuItem key={r.id} value={r.id}>{r.label}{r.id === 'nj' ? ' (start here)' : ''}</MenuItem>
          ))}
        </TextField>
        <Button onClick={onRun} disabled={busy}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: D.ink }} /> : <TravelExploreOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ ...dropPrimaryBtn, px: 2.5, py: 0.6, fontSize: 12.5 }}>
          {busy ? 'Finding…' : `Find & import ${regionLabel}`}
        </Button>
      </Stack>

      {busy && (
        <Box sx={{ mt: 1.75, p: 1.5, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.lineHi}` }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <CircularProgress size={15} sx={{ color: D.green }} />
            <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700 }}>
              Scanning {regionLabel}…
            </Typography>
          </Stack>
          <LinearProgress sx={{ height: 6, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.06)',
            '& .MuiLinearProgress-bar': { bgcolor: D.green } }} />
          <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.9 }}>
            Searching OpenStreetMap → scraping each shop’s site for a contact email → verifying &amp; importing.
            A full state can take a minute or two — this keeps running even if you switch tabs.
          </Typography>
        </Box>
      )}

      {/* Auto-pilot — the long-term system: works the frontier state weekly, then
          rolls to the next once it runs dry. */}
      <Box sx={{ mt: 1.75, pt: 1.5, borderTop: `1px solid ${D.line}` }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <AutoModeOutlinedIcon sx={{ color: frontier?.autoAdvance ? D.green : D.faint, fontSize: 19 }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13 }}>
              Auto-pilot {frontier?.autoAdvance ? 'on' : 'off'}
              {frontier?.activeLabel ? ` — frontier: ${frontier.activeLabel}` : ''}
              {frontier?.availableColdLeads != null
                ? ` · ${frontier.availableColdLeads} cold leads in reserve`
                : ''}
            </Typography>
            <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
              {frontier?.autoAdvance
                ? 'Watches your reserve and auto-refills — sweeps several states at once whenever leads run low, so supply keeps up with your sending. Wraps the country and loops back for new openings.'
                : 'Turn on to keep the lead pool full automatically: it refills across states whenever you run low, so you never run dry.'}
              {frontier?.lastResult ? ` · ${frontier.lastResult}` : ''}
            </Typography>
          </Box>
          <Tooltip title={frontier?.autoAdvance ? 'Stop the auto-finder' : 'Auto-refill the lead pool as you send'}>
            <span>
              <Switch
                checked={!!frontier?.autoAdvance}
                disabled={autoBusy}
                onChange={(e) => onToggleAuto(e.target.checked)}
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: D.green },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: D.green } }}
              />
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {result && !busy && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={1.25} sx={{ mb: 1.25 }} flexWrap="wrap" useFlexGap>
            <StatPill value={result.found} label="Found" tone={D.text} />
            <StatPill value={result.withEmail} label="With email" tone={D.green} />
            <StatPill value={result.created} label="New leads" tone={D.green} />
          </Stack>
          <Alert icon={<CheckCircleOutlineIcon />} severity="success" variant="outlined"
            sx={{ borderColor: D.green, color: D.text, '& .MuiAlert-icon': { color: D.green } }}>
            {result.label}: imported <b>{result.created} new</b> lead{result.created === 1 ? '' : 's'}
            {result.updated ? `, ${result.updated} updated` : ''} ({result.enriched} email
            {result.enriched === 1 ? '' : 's'} scraped from shop sites, {result.verified ?? result.withEmail} verified
            deliverable{result.skippedChains ? `, ${result.skippedChains} big-chain location${result.skippedChains === 1 ? '' : 's'} skipped` : ''}).
            They’re independents, tagged
            <Box component="code" sx={{ ...mono, mx: 0.5 }}>dispensary</Box> and sourced Cold Outreach.
            <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
              <Button onClick={onGoCampaigns} sx={{ ...dropPrimaryBtn, px: 2, py: 0.5, fontSize: 12.5 }}>
                Enroll them in a campaign →
              </Button>
            </Stack>
          </Alert>
        </Box>
      )}
    </Box>
  );
}

export default function ImportView(props) {
  return (
    <Stack spacing={2.5}>
      <AutoFinder {...props} />
    </Stack>
  );
}
