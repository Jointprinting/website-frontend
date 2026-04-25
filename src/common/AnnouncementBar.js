// src/common/AnnouncementBar.js
//
// Slim banner that sits above the navbar advertising the welcome coupon.
// Dismissible per-session so it stops bugging visitors after they close it.

import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import useMediaQuery from '@mui/material/useMediaQuery';

const STORAGE_KEY = 'jpAnnouncementDismissed_v1';

export default function AnnouncementBar() {
  const mobile = useMediaQuery('(max-width: 600px)');
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    try {
      const dismissed = window.sessionStorage.getItem(STORAGE_KEY);
      if (!dismissed) setOpen(true);
    } catch (e) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (e) {}
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText('WELCOME10');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      // no-op — clipboard might be blocked
    }
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        bgcolor: '#1a3d2b',
        color: 'white',
        py: 0.9,
        px: { xs: 1.5, sm: 3 },
        position: 'relative',
        zIndex: 1201, // above MUI AppBar (1100)
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
      role="region"
      aria-label="Site announcement"
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={mobile ? 1 : 1.5}
        sx={{ maxWidth: 1240, mx: 'auto', position: 'relative', pr: { xs: 4, sm: 5 } }}
      >
        <LocalOfferIcon sx={{ fontSize: { xs: 16, sm: 18 }, color: '#4ade80', flexShrink: 0 }} />
        <Box
          sx={{
            fontSize: { xs: 12, sm: 14 },
            fontWeight: 600,
            letterSpacing: 0.2,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {mobile ? (
            <>10% off your first order — code{' '}
              <Box
                component="button"
                onClick={handleCopy}
                sx={{
                  cursor: 'pointer',
                  color: '#4ade80',
                  fontWeight: 800,
                  bgcolor: 'transparent',
                  border: 0,
                  p: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  font: 'inherit',
                }}
              >
                {copied ? 'COPIED!' : 'WELCOME10'}
              </Box>
            </>
          ) : (
            <>
              🎉 New customer? Get 10% off your first order with code{' '}
              <Box
                component="button"
                onClick={handleCopy}
                sx={{
                  cursor: 'pointer',
                  color: '#4ade80',
                  fontWeight: 800,
                  bgcolor: 'transparent',
                  border: 0,
                  p: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  font: 'inherit',
                }}
              >
                {copied ? 'COPIED!' : 'WELCOME10'}
              </Box>
              {' '}— mention it when you request your mockup.
            </>
          )}
        </Box>
        <IconButton
          onClick={handleClose}
          aria-label="Dismiss announcement"
          size="small"
          sx={{
            position: 'absolute',
            right: 0,
            color: 'rgba(255,255,255,0.7)',
            '&:hover': { color: 'white' },
          }}
        >
          <CloseIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
        </IconButton>
      </Stack>
    </Box>
  );
}
