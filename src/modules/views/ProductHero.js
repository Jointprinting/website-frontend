// src/modules/views/ProductHero.js
import * as React from 'react';
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
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Preload hero image */}
      <img style={{ display: 'none' }} src={backgroundImage} alt="increase priority" />

      <Typography
        color="inherit"
        align="center"
        variant="overline"
        sx={{
          letterSpacing: 6,
          textTransform: 'uppercase',
          opacity: 0.9,
          mb: 1,
        }}
      >
        INNOVATION IN INK
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
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
          mb: 4,
          mt: { xs: 3, sm: 4 },
        }}
      >
        Get a free mockup & quote in under 24 hours.
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
        Get your free mockup & quote
      </Button>
    </ProductHeroLayout>
  );
}
