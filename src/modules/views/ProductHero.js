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
      }}
    >
      {/* Preload image */}
      <img
        style={{ display: 'none' }}
        src={backgroundImage}
        alt="increase priority"
      />

      <Typography
        variant="overline"
        align="center"
        sx={{
          letterSpacing: 6,
          fontSize: 14,
          opacity: 0.85,
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
          mt: 3,
          textTransform: 'uppercase',
          letterSpacing: 3,
        }}
      >
        CUSTOM MERCH FOR MODERN BRANDS
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h5"
        sx={{
          mt: 3,
          mb: 5,
          maxWidth: 640,
          mx: 'auto',
        }}
      >
        START WITH A FREE MOCKUP AND QUOTE IN UNDER 24 HOURS.
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
        }}
      >
        Get your free mockup & quote
      </Button>
    </ProductHeroLayout>
  );
}
