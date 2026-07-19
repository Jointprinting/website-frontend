// src/screens/studio/mockup/MockupLabFrame.js
//
// The mockup lab, folded INTO the Studio. Rather than a from-scratch rewrite
// (which lost the S&S blank finder, ink auto-detect, per-garment print areas,
// and the workshop feel), this embeds the proven /jpstudio lab in-place — a
// same-origin iframe, so it shares the Studio's session from localStorage and
// keeps EVERY feature — reached inside the Studio instead of a jarring new tab.
//
// Deep-link context rides in the iframe URL exactly as the standalone lab reads
// it: ?mockup=<remoteId> to open an existing mockup, ?project=<id> to start a
// new one linked to that project (so it letters-in and links back). A slim
// "← Studio" bar returns to the hub; "Full screen ↗" pops the lab out to its own
// tab for anyone who wants the whole viewport.

import React from 'react';
import { Box, Stack, Button, Typography } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import { D, mono, accentBar } from '../_shared';

const jpBase = `${process.env.PUBLIC_URL || ''}/jpstudio/`;

export function labHref({ project, mockup } = {}) {
  if (mockup) return `${jpBase}?mockup=${encodeURIComponent(mockup)}`;
  if (project) return `${jpBase}?project=${encodeURIComponent(project)}`;
  return jpBase;
}

export default function MockupLabFrame({ project, mockup, label, onBack }) {
  const src = React.useMemo(() => labHref({ project, mockup }), [project, mockup]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" spacing={1.5}
        sx={{ height: 52, px: 2, position: 'relative', flex: '0 0 auto',
          borderBottom: `1px solid ${D.line}`, bgcolor: D.panel }}>
        <Box sx={accentBar} />
        <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
          sx={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: D.muted,
            textTransform: 'none', minWidth: 0, borderRadius: 999,
            '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}>
          Studio
        </Button>
        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: D.faint }} />
        <DesignServicesIcon sx={{ color: D.green, fontSize: 16 }} />
        <Typography sx={{ ...mono, fontSize: 12, color: D.green, fontWeight: 700 }}>Mockup Lab</Typography>
        {label && (
          <Typography sx={{ ...mono, fontSize: 11.5, color: D.faint, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>· {label}</Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button component="a" href={src} target="_blank" rel="noreferrer" size="small"
          endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
          sx={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: 'none', borderRadius: 999,
            '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}>
          Full screen
        </Button>
      </Stack>
      <Box component="iframe" src={src} title="Mockup Lab"
        sx={{ flex: 1, width: '100%', border: 0, display: 'block', bgcolor: '#fff' }} />
    </Box>
  );
}
