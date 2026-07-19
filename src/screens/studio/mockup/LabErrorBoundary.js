// src/screens/studio/mockup/LabErrorBoundary.js
//
// A crash in the mockup lab must NEVER white-screen the Studio again. This
// boundary catches any render/lifecycle error in the lab tree and shows the
// actual error message (so a report becomes a diagnosis, not a mystery) plus
// two exits: back to the Studio, or open this mockup in the classic /jpstudio
// lab — the always-working fallback.

import React from 'react';
import { Box, Stack, Typography, Button } from '@mui/material';
import { D, mono } from '../_shared';

export default class LabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    // Console carries the component stack for debugging a report.
    console.error('[MockupLab] crash:', err, info && info.componentStack);
  }

  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    const { remoteId, onBack } = this.props;
    const classicHref = `${process.env.PUBLIC_URL || ''}/jpstudio/${remoteId ? `?mockup=${encodeURIComponent(remoteId)}` : ''}`;
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ maxWidth: 520, bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3, p: 3 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16, mb: 1 }}>
            The mockup lab hit an error
          </Typography>
          <Typography sx={{ ...mono, color: '#f87171', fontSize: 12, mb: 2, wordBreak: 'break-word' }}>
            {String((err && err.message) || err)}
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 13, mb: 2.5 }}>
            Nothing was lost — your mockup is untouched in the library. Open it in the
            classic lab below, and send me the red line above so I can fix this exact crash.
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button component="a" href={classicHref} target="_blank" rel="noreferrer"
              sx={{ bgcolor: D.green, color: '#08130c', textTransform: 'none', fontWeight: 800, px: 2, borderRadius: 999, '&:hover': { bgcolor: '#3bd070' } }}>
              Open in classic lab
            </Button>
            {onBack && (
              <Button onClick={onBack}
                sx={{ color: D.text, textTransform: 'none', fontWeight: 700, border: `1px solid ${D.line}`, borderRadius: 999, px: 2, '&:hover': { borderColor: D.green, color: D.green } }}>
                Back to Studio
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    );
  }
}
