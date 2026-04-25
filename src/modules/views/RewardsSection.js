// src/modules/views/RewardsSection.js
//
// Two side-by-side cards on the home page:
//   1. Welcome coupon for first-time customers (10% off)
//   2. Tiered referral credit
// Designed to slot between ProductValues and ProductHowItWorks without
// disturbing the existing flow.

import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Typography from '../components/Typography';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const tiers = [
  { range: 'Friend orders $250 – $499', reward: '$25 credit' },
  { range: 'Friend orders $500 – $999', reward: '$50 credit' },
  { range: 'Friend orders $1,000+',     reward: '$100 credit' },
];

export default function RewardsSection() {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch (err) {
      // Clipboard blocked — fall back to selection
      const tmp = document.createElement('textarea');
      tmp.value = code;
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand('copy'); setCopied(true); } catch (_) {}
      document.body.removeChild(tmp);
    }
  };

  return (
    <Box sx={{ bgcolor: '#0c1410', py: { xs: 7, md: 10 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 4,
              color: '#4ade80',
              display: 'block',
              mb: 1.5,
              fontSize: 12,
            }}
          >
            DEALS · REFERRALS
          </Typography>
          <Typography
            variant="h3"
            component="h2"
            sx={{
              color: 'white',
              fontWeight: 800,
              mb: 1.5,
              fontSize: { xs: 28, md: 38 },
              lineHeight: 1.2,
            }}
          >
            Save on your first order. Earn for every friend you send.
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 300,
              maxWidth: 560,
              mx: 'auto',
              fontSize: { xs: 14, md: 16 },
              lineHeight: 1.7,
            }}
          >
            Two of the easiest ways to work with us — one welcomes you in, the other
            pays you back when your network turns into our next happy customer.
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 3, md: 4 }} alignItems="stretch">
          {/* WELCOME COUPON */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: 4,
                height: '100%',
                bgcolor: '#162420',
                border: '1px solid #1a3d2b',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  bgcolor: 'rgba(74,222,128,0.08)',
                }}
              />
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    bgcolor: '#1a3d2b',
                    color: '#4ade80',
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LocalOfferIcon />
                </Box>
                <Typography
                  sx={{
                    color: '#4ade80',
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  First-Order Welcome
                </Typography>
              </Stack>

              <Typography
                variant="h4"
                sx={{
                  color: 'white',
                  fontWeight: 800,
                  mb: 1.5,
                  lineHeight: 1.2,
                  fontSize: { xs: 24, md: 30 },
                }}
              >
                10% off your first order.
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.65)',
                  mb: 3,
                  fontSize: 15,
                  lineHeight: 1.6,
                }}
              >
                Mention this code when you request your mockup and we'll apply it to
                your invoice. Up to $100 off, one per customer, no minimum.
              </Typography>

              {/* Code chip */}
              <Box
                onClick={() => handleCopy('WELCOME10')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCopy('WELCOME10'); }}
                sx={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  px: 2,
                  borderRadius: 2,
                  bgcolor: '#0c1410',
                  border: '1px dashed #4ade80',
                  mb: 3,
                  alignSelf: 'flex-start',
                  transition: 'transform 0.15s',
                  '&:hover': { transform: 'translateY(-1px)' },
                }}
              >
                <Typography
                  sx={{
                    color: '#4ade80',
                    fontWeight: 900,
                    letterSpacing: 3,
                    fontSize: { xs: 18, md: 22 },
                    fontFamily: 'monospace',
                  }}
                >
                  WELCOME10
                </Typography>
                <ContentCopyIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} />
              </Box>

              <Box sx={{ flexGrow: 1 }} />

              <Button
                href="/contact"
                variant="contained"
                color="secondary"
                sx={{
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.4,
                  fontWeight: 700,
                  fontSize: 15,
                  textTransform: 'none',
                  alignSelf: 'flex-start',
                }}
              >
                Claim your 10% →
              </Button>
            </Paper>
          </Grid>

          {/* REFERRAL */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: 4,
                height: '100%',
                bgcolor: '#162420',
                border: '1px solid #1a3d2b',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  bgcolor: 'rgba(74,222,128,0.08)',
                }}
              />
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    bgcolor: '#1a3d2b',
                    color: '#4ade80',
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GroupAddIcon />
                </Box>
                <Typography
                  sx={{
                    color: '#4ade80',
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  Refer & Earn
                </Typography>
              </Stack>

              <Typography
                variant="h4"
                sx={{
                  color: 'white',
                  fontWeight: 800,
                  mb: 1.5,
                  lineHeight: 1.2,
                  fontSize: { xs: 24, md: 30 },
                }}
              >
                Earn up to $100 per referral.
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.65)',
                  mb: 2.5,
                  fontSize: 15,
                  lineHeight: 1.6,
                }}
              >
                Send us a friend or a brand and you'll earn credit on your next order
                when they place theirs. Bigger orders = bigger credit.
              </Typography>

              <Stack spacing={1} sx={{ mb: 3 }}>
                {tiers.map((t) => (
                  <Stack
                    key={t.range}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      px: 1.75,
                      py: 1.1,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5 }}>
                      {t.range}
                    </Typography>
                    <Typography sx={{ color: '#4ade80', fontSize: 14, fontWeight: 800 }}>
                      {t.reward}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Box sx={{ flexGrow: 1 }} />

              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button
                  component="a"
                  href="mailto:nate@jointprinting.com?subject=Referral%20program%20signup&body=Hey%20Nate%2C%20I%27d%20like%20to%20join%20the%20referral%20program.%20My%20name%20is%20___."
                  variant="outlined"
                  sx={{
                    borderRadius: 999,
                    px: 3,
                    py: 1.4,
                    fontWeight: 700,
                    fontSize: 14,
                    textTransform: 'none',
                    color: '#4ade80',
                    borderColor: '#4ade80',
                    '&:hover': {
                      borderColor: '#4ade80',
                      bgcolor: 'rgba(74,222,128,0.08)',
                    },
                  }}
                >
                  Become a referrer
                </Button>
                <Button
                  href="/contact"
                  variant="text"
                  sx={{
                    borderRadius: 999,
                    px: 2.5,
                    py: 1.4,
                    fontWeight: 700,
                    fontSize: 14,
                    textTransform: 'none',
                    color: 'rgba(255,255,255,0.65)',
                    '&:hover': {
                      color: 'white',
                      bgcolor: 'rgba(255,255,255,0.04)',
                    },
                  }}
                >
                  Have someone in mind?
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      <Snackbar
        open={copied}
        autoHideDuration={1800}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setCopied(false)}
          severity="success"
          variant="filled"
          sx={{ borderRadius: 999 }}
        >
          Code WELCOME10 copied
        </Alert>
      </Snackbar>
    </Box>
  );
}
