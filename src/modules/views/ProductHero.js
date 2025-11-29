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
        sx={{ letterSpacing: 4, opacity: 0.9 }}
      >
        BRAND-FIRST MERCH STUDIO
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
        sx={{ mt: 2 }}
      >
        CUSTOM MERCH FOR MODERN BRANDS
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h5"
        sx={{ mb: 4, mt: { xs: 3, sm: 4 }, maxWidth: 620 }}
      >
        Pick your blanks, send your art, and we&apos;ll handle the rest — from
        sourcing to delivery.
      </Typography>

      <Box
        sx={{
          mt: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Button
          color="secondary"
          variant="contained"
          size="large"
          component="a"
          href="/products"
          sx={{
            minWidth: 240,
            borderRadius: 999,
            px: 4,
            py: 1.4,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: 18,
            boxShadow: '0 18px 45px rgba(0,0,0,0.55)',
            transition: 'all 160ms ease-out',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 22px 55px rgba(0,0,0,0.7)',
            },
          }}
        >
          Get your mockup &amp; quote
        </Button>

        <Typography
          variant="body2"
          color="inherit"
          sx={{ opacity: 0.9, maxWidth: 360, textAlign: 'center' }}
        >
          Free mockup &amp; quote in under 24 hours. No spam, no pressure — just
          a clear starting point.
        </Typography>
      </Box>
    </ProductHeroLayout>
  );
}
