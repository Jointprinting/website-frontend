// src/modules/views/ProductHero.js
import * as React from 'react';
import Button from '../components/Button';
import Typography from '../components/Typography';
import ProductHeroLayout from './ProductHeroLayout';

const heroImage =
  'https://cdn.midjourney.com/02200c93-b8ea-452c-b02d-99cc2954e81f/0_2.webp';

export default function ProductHero() {
  return (
    <ProductHeroLayout
      sxBackground={{
        backgroundImage: `linear-gradient(to bottom, rgba(5, 10, 8, 0.55), rgba(5, 10, 8, 0.9)), url(${heroImage})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#050808',
      }}
    >
      {/* Preload image */}
      <img style={{ display: 'none' }} src={heroImage} alt="increase priority" />

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
          maxWidth: 640,
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
        Get your free mockup & quote
      </Button>

      <Typography
        variant="body2"
        color="inherit"
        sx={{
          mt: 6,
          fontSize: 22,
          opacity: 0.8,
          animation: 'jp-bounce 1.6s infinite',
          '@keyframes jp-bounce': {
            '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
            '40%': { transform: 'translateY(8px)' },
            '60%': { transform: 'translateY(4px)' },
          },
        }}
      >
        ↓
      </Typography>
    </ProductHeroLayout>
  );
}
