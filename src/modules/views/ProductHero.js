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
        backgroundImage: `linear-gradient(
          rgba(5, 15, 10, 0.35),
          rgba(5, 15, 10, 0.65)
        ), url(${backgroundImage})`,
        backgroundColor: '#0e1511',
        backgroundPosition: 'center',
      }}
    >
      {/* Preload the image */}
      <img
        style={{ display: 'none' }}
        src={backgroundImage}
        alt="increase priority"
      />

      {/* Overline */}
      <Typography
        color="inherit"
        align="center"
        variant="overline"
        sx={{
          letterSpacing: 6,
          mb: 2,
          opacity: 0.9,
        }}
      >
        INNOVATION IN INK
      </Typography>

      {/* Main line */}
      <Typography
        color="inherit"
        align="center"
        variant="h2"
        component="h1"
        sx={{
          maxWidth: 760,
          mx: 'auto',
        }}
      >
        Custom merch for modern brands.
      </Typography>

      {/* Secondary line (short + optional) */}
      <Typography
        color="inherit"
        align="center"
        variant="h6"
        sx={{
          mt: { xs: 3, sm: 4 },
          mb: 4,
          maxWidth: 640,
          mx: 'auto',
          opacity: 0.9,
          fontWeight: 400,
        }}
      >
        Start with a free mockup and quote in under 24 hours.
      </Typography>

      {/* Single primary CTA */}
      <Button
        color="secondary"
        variant="contained"
        size="large"
        component="a"
        href="/products"
        sx={{
          minWidth: 260,
          borderRadius: 999,
          fontSize: 18,
          fontWeight: 600,
          textTransform: 'none',
        }}
      >
        Get your free mockup &amp; quote
      </Button>
    </ProductHeroLayout>
  );
}
