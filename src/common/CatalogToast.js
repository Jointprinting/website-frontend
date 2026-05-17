// src/common/CatalogToast.js
//
// Slide-in toast shown on the public /catalogs page. Reads its content from
// the catalogToast site setting (editable in Studio → Catalogs). Stays out
// of the way: appears bottom-right after a short delay, auto-dismisses after
// 8 seconds, remembers dismissal for the rest of the session.
//
// Clicking the code copies it to the clipboard, mirroring the homepage
// AnnouncementBar's behavior so the interaction feels familiar.

import * as React from 'react';
import axios from 'axios';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Slide from '@mui/material/Slide';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import config from '../config.json';

const STORAGE_KEY = 'jpCatalogToastDismissed_v1';
const APPEAR_DELAY_MS = 700;
const AUTO_DISMISS_MS = 8000;

export default function CatalogToast() {
  const [toast, setToast] = React.useState(null);
  const [open, setOpen]   = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const dismissTimer = React.useRef(null);
  const appearTimer  = React.useRef(null);

  // Fetch the current toast config on mount. If the request fails, the toast
  // simply stays hidden — never block the catalogs page on this.
  React.useEffect(() => {
    let cancelled = false;
    axios.get(`${config.backendUrl}/api/site-settings/catalogToast`)
      .then((r) => { if (!cancelled) setToast(r.data.value); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Once we have a config, decide whether to show. Honor the session dismissal
  // flag so refreshing the page during the session doesn't re-trigger.
  React.useEffect(() => {
    if (!toast || !toast.enabled) return;
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    } catch (e) { /* sessionStorage unavailable — proceed */ }

    appearTimer.current = setTimeout(() => {
      setOpen(true);
      dismissTimer.current = setTimeout(() => {
        setOpen(false);
        try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
      }, AUTO_DISMISS_MS);
    }, APPEAR_DELAY_MS);

    return () => {
      clearTimeout(appearTimer.current);
      clearTimeout(dismissTimer.current);
    };
  }, [toast]);

  const closeNow = () => {
    setOpen(false);
    try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    clearTimeout(dismissTimer.current);
  };

  const copyCode = async () => {
    if (!toast?.code) return;
    try {
      await navigator.clipboard.writeText(toast.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) { /* clipboard blocked */ }
  };

  if (!toast || !toast.enabled) return null;
  const accent = toast.accentColor || '#1a3d2b';

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          right:  { xs: 16, sm: 24 },
          left:   { xs: 16, sm: 'auto' }, // full width on mobile, anchored right on desktop
          maxWidth: { sm: 380 },
          bgcolor: '#111816',
          color: 'white',
          borderRadius: 2,
          boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
          border: `1px solid ${accent}`,
          overflow: 'hidden',
          zIndex: 1300,
        }}
      >
        {/* Top accent stripe so the toast has a visual signature even at a glance */}
        <Box sx={{ height: 3, bgcolor: accent }} />
        <Box sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{
              flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
              bgcolor: `${accent}33`, color: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LocalOfferIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: 14.5, mb: 0.5 }}>
                {toast.headline}
              </Typography>
              {toast.subtext && (
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 1.45, mb: 1 }}>
                  {toast.subtext}
                </Typography>
              )}
              {toast.code && (
                <Box
                  component="button"
                  onClick={copyCode}
                  sx={{
                    appearance: 'none', bgcolor: 'rgba(255,255,255,0.06)',
                    border: `1px dashed ${accent}`, borderRadius: 1.5,
                    py: 0.75, px: 1.25, cursor: 'pointer', color: 'white',
                    display: 'inline-flex', alignItems: 'center', gap: 1,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                    letterSpacing: 1,
                    transition: 'background 0.15s ease',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <Box component="span" sx={{ color: accent }}>{toast.code}</Box>
                  {copied
                    ? <CheckIcon sx={{ fontSize: 14, color: accent }} />
                    : <ContentCopyIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }} />}
                  <Box component="span" sx={{
                    fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5,
                    color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
                  }}>
                    {copied ? 'Copied' : 'Click to copy'}
                  </Box>
                </Box>
              )}
            </Box>
            <IconButton size="small" onClick={closeNow}
              aria-label="Dismiss"
              sx={{
                color: 'rgba(255,255,255,0.5)',
                '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' },
              }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Box>
      </Box>
    </Slide>
  );
}
