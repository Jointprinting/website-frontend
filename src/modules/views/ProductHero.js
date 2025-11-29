// src/modules/views/ProductHero.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '../components/Button';
import Typography from '../components/Typography';
import ProductHeroLayout from './ProductHeroLayout';

const backgroundImage =
  'https://cdn.midjourney.com/02200c93-b8ea-452c-b02d-99cc2954e81f/0_2.webp';

export default function ProductHero() {
  return (
    <ProductHeroLayout
      sxBackground={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundColor: '#0e1511',
        backgroundPosition: 'center',
      }}
    >
      {/* Increase the network loading priority of the background image. */}
      <img
        style={{ display: 'none' }}
        src={backgroundImage}
        alt="increase priority"
      />

      <Typography
        color="inherit"
        align="center"
        variant="overline"
        sx={{
          letterSpacing: 4,
          opacity: 0.85,
          mt: { xs: 6, sm: 8 },
        }}
      >
        JOINT PRINTING · MERCH STUDIO
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
        sx={{ mt: 2 }}
      >
        Brand-first merch that actually gets worn.
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h5"
        sx={{ mb: 3, mt: { xs: 3, sm: 4 }, maxWidth: 700, mx: 'auto' }}
      >
        We treat your line like a campaign — dialing in blanks, fit and
        decoration so your logo feels at home on every piece.
      </Typography>

      <Box
        sx={{
          mt: { xs: 3, sm: 4 },
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Button
          color="secondary"
          variant="contained"
          size="large"
          component="a"
          href="/products"
          sx={{ minWidth: 220, borderRadius: 999, textTransform: 'none' }}
        >
          Start with products
        </Button>

        <Button
          color="inherit"
          variant="text"
          size="large"
          component="a"
          href="/contact"
          sx={{
            textTransform: 'none',
            borderRadius: 999,
            px: 2.5,
            opacity: 0.9,
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.08)',
            },
          }}
        >
          Or send us your art →
        </Button>
      </Box>

      <Typography
        variant="body2"
        color="inherit"
        sx={{ mt: 3, opacity: 0.85 }}
      >
        Free mockup & quote in under 24 hours. No pressure, no minimum spend.
      </Typography>
    </ProductHeroLayout>
  );
}
