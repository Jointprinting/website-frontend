// src/modules/views/ProductHero.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Button from '../components/Button';
import Typography from '../components/Typography';

const backgroundImage =
  'https://cdn.midjourney.com/02200c93-b8ea-452c-b02d-99cc2954e81f/0_2.webp';

export default function ProductHero() {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        color: 'common.white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: { xs: '80vh', md: '88vh' },
        backgroundImage: `
          linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.55),
            rgba(0, 0, 0, 0.65)
          ),
          url(${backgroundImage})
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        textAlign: 'center',
      }}
    >
      {/* Preload image in case browser wants it */}
      <img style={{ display: 'none' }} src={backgroundImage} alt="hero" />

      <Container maxWidth="md">
        <Typography
          variant="overline"
          sx={{
            letterSpacing: 6,
            textTransform: 'uppercase',
            opacity: 0.9,
          }}
        >
          INNOVATION IN INK
        </Typography>

        <Typography
          color="inherit"
          align="center"
          variant="h2"
          sx={{
            mt: 2,
            fontWeight: 700,
            fontSize: { xs: 32, sm: 40, md: 48 },
          }}
        >
          CUSTOM MERCH FOR MODERN BRANDS.
        </Typography>

        <Typography
          color="inherit"
          align="center"
          variant="h5"
          sx={{
            mt: { xs: 3, sm: 4 },
            mb: 4,
          }}
        >
          Start with a free mockup and quote in under 24 hours.
        </Typography>

        <Button
          color="secondary"
          variant="contained"
          size="large"
          component="a"
          href="/products"
          sx={{
            minWidth: 260,
            borderRadius: 999,
            fontSize: 16,
            fontWeight: 600,
            textTransform: 'none',
            px: 4,
            py: 1.4,
          }}
        >
          Get your free mockup &amp; quote
        </Button>
      </Container>
    </Box>
  );
}
