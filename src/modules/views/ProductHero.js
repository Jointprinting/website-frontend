// src/modules/views/ProductHero.js
import * as React from 'react';
import { keyframes } from '@mui/system';
import Button from '../components/Button';
import Typography from '../components/Typography';
import ProductHeroLayout from './ProductHeroLayout';

const backgroundImage =
  'https://cdn.midjourney.com/02200c93-b8ea-452c-b02d-99cc2954e81f/0_2.webp';

// Simple fade-up animation for hero content
const fadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export default function ProductHero() {
  return (
    <ProductHeroLayout
      sxBackground={{
        // Dark gradient over the hero image so text feels sharper
        backgroundImage: `linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.65),
          rgba(0, 0, 0, 0.55)
        ), url(${backgroundImage})`,
        backgroundColor: '#151515',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Increase the network loading priority of the background image. */}
      <img
        style={{ display: 'none' }}
        src={backgroundImage}
        alt="increase priority"
      />

      {/* Small B2B signal */}
      <Typography
        color="secondary.light"
        align="center"
        variant="overline"
        sx={{
          letterSpacing: 3,
          mb: 1,
          opacity: 0,
          animation: `${fadeUp} 700ms ease-out forwards`,
          animationDelay: '80ms',
        }}
      >
        CUSTOM MERCH FOR MODERN BRANDS
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
        sx={{
          mt: 6,
          opacity: 0,
          animation: `${fadeUp} 750ms ease-out forwards`,
          animationDelay: '160ms',
        }}
      >
        Innovation in Ink
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h5"
        sx={{
          mb: 4,
          mt: { xs: 3, sm: 6 },
          maxWidth: 640,
          mx: 'auto',
          opacity: 0,
          animation: `${fadeUp} 780ms ease-out forwards`,
          animationDelay: '260ms',
        }}
      >
        Elevate your brand with our unmatched quality &amp; service.
      </Typography>

      <Button
        color="secondary"
        variant="contained"
        size="large"
        component="a"
        href="/products"
        sx={{
          minWidth: 220,
          opacity: 0,
          animation: `${fadeUp} 820ms ease-out forwards`,
          animationDelay: '340ms',
          borderRadius: 999,
          px: 4,
          py: 1.4,
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          },
        }}
      >
        Request Free Mockup
      </Button>

      <Typography
        variant="body2"
        color="inherit"
        sx={{
          mt: 2,
          opacity: 0,
          animation: `${fadeUp} 840ms ease-out forwards`,
          animationDelay: '420ms',
        }}
      >
        (24-hr turnaround)
      </Typography>

      <Typography
        variant="body2"
        color="secondary.light"
        sx={{
          mt: 0.5,
          opacity: 0,
          animation: `${fadeUp} 860ms ease-out forwards`,
          animationDelay: '500ms',
        }}
      >
        Built for teams, events &amp; growing brands.
      </Typography>
    </ProductHeroLayout>
  );
}
