// src/modules/views/ProductHero.js
import * as React from 'react';
import { keyframes } from '@mui/system';
import Button from '../components/Button';
import Typography from '../components/Typography';
import ProductHeroLayout from './ProductHeroLayout';

const backgroundImage =
  'https://cdn.midjourney.com/02200c93-b8ea-452c-b02d-99cc2954e81f/0_2.webp';

// Simple motion for headings / button
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

// Floating scroll indicator
const floatArrow = keyframes`
  0% { transform: translateY(0); }
  50% { transform: translateY(6px); }
  100% { transform: translateY(0); }
`;

export default function ProductHero() {
  return (
    <ProductHeroLayout
      sxBackground={{
        backgroundImage: `linear-gradient(
          to bottom,
          rgba(3, 7, 5, 0.5),
          rgba(3, 7, 5, 0.88)
        ), url(${backgroundImage})`,
        backgroundColor: '#0e1511',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      {/* Preload background */}
      <img
        style={{ display: 'none' }}
        src={backgroundImage}
        alt="increase priority"
      />

      {/* Tagline */}
      <Typography
        color="inherit"
        align="center"
        variant="overline"
        sx={{
          letterSpacing: 6,
          mb: 2,
          opacity: 0,
          animation: `${fadeUp} 700ms ease-out forwards`,
        }}
      >
        INNOVATION IN INK
      </Typography>

      {/* Main headline */}
      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
        sx={{
          mt: 2,
          maxWidth: 900,
          mx: 'auto',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          textShadow: '0 24px 60px rgba(0,0,0,0.75)',
          opacity: 0,
          animation: `${fadeUp} 800ms ease-out forwards`,
          animationDelay: '80ms',
        }}
      >
        CUSTOM MERCH FOR MODERN BRANDS.
      </Typography>

      {/* Subheadline */}
      <Typography
        color="inherit"
        align="center"
        variant="h5"
        sx={{
          mb: 4,
          mt: { xs: 3, sm: 4 },
          maxWidth: 640,
          mx: 'auto',
          textShadow: '0 16px 40px rgba(0,0,0,0.7)',
          opacity: 0,
          animation: `${fadeUp} 800ms ease-out forwards`,
          animationDelay: '160ms',
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
          px: 5,
          py: 1.6,
          boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
          opacity: 0,
          animation: `${fadeUp} 800ms ease-out forwards`,
          animationDelay: '260ms',
        }}
      >
        Get your free mockup &amp; quote
      </Button>

      {/* Small line under button – existing copy, just styled */}
      <Typography
        variant="body2"
        color="inherit"
        sx={{
          mt: 2.5,
          opacity: 0.9,
          textShadow: '0 12px 32px rgba(0,0,0,0.6)',
          opacity: 0,
          animation: `${fadeUp} 800ms ease-out forwards`,
          animationDelay: '340ms',
        }}
      >
        Free mockup &amp; quote in under 24 hours.
      </Typography>

      {/* Scroll cue (no extra text, just motion) */}
      <div
        style={{
          marginTop: '40px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 22,
            height: 34,
            borderRadius: 999,
            border: '2px solid rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 4,
          }}
        >
          <span
            style={{
              fontSize: 16,
              color: '#fff',
              animation: `${floatArrow} 1400ms ease-in-out infinite`,
              lineHeight: 1,
            }}
          >
            ↓
          </span>
        </div>
      </div>
    </ProductHeroLayout>
  );
}
