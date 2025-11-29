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
        backgroundColor: '#0e1511', // fallback while the image loads
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      {/* Preload the background image */}
      <img
        style={{ display: 'none' }}
        src={backgroundImage}
        alt="increase priority"
      />

      {/* Line 1 */}
      <Typography
        color="inherit"
        align="center"
        variant="overline"
        sx={{
          letterSpacing: 6,
          mt: 8,
          mb: 1,
          opacity: 0.95,
        }}
      >
        INNOVATION IN INK
      </Typography>

      {/* Line 2 */}
      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
        sx={{
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        CUSTOM MERCH FOR MODERN BRANDS.
      </Typography>

      {/* Line 3 */}
      <Typography
        color="inherit"
        align="center"
        variant="h6"
        sx={{
          mt: { xs: 3, sm: 4 },
          mb: 4,
          maxWidth: 640,
          mx: 'auto',
        }}
      >
        START WITH A FREE MOCKUP AND QUOTE IN UNDER 24 HOURS.
      </Typography>

      {/* Primary CTA */}
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
          px: 4,
          py: 1.5,
        }}
      >
        Get your free mockup &amp; quote
      </Button>
    </ProductHeroLayout>
  );
}
