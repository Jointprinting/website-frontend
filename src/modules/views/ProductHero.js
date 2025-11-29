// src/modules/views/ProductHero.js
import * as React from 'react';
import Box from '@mui/material/Box';
import { keyframes } from '@mui/system';
import Button from '../components/Button';
import Typography from '../components/Typography';
import ProductHeroLayout from './ProductHeroLayout';

const backgroundImage =
  'https://cdn.midjourney.com/02200c93-b8ea-452c-b02d-99cc2954e81f/0_2.webp';

const fadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
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

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: `${fadeUp} 700ms ease-out`,
        }}
      >
        <Typography
          color="inherit"
          variant="overline"
          sx={{ letterSpacing: 4, opacity: 0.9 }}
        >
          INNOVATION IN INK
        </Typography>

        <Typography
          color="inherit"
          align="center"
          variant="h2"
          marked="center"
          sx={{ mt: 2, maxWidth: 960 }}
        >
          Brand-first merch that actually gets worn.
        </Typography>

        <Typography
          color="inherit"
          align="center"
          variant="h5"
          sx={{ mt: 3, mb: 4, maxWidth: 560, opacity: 0.9 }}
        >
          One place for blanks, art, and fulfillment — built for modern brands.
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
            px: 4,
            py: 1.5,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: 18,
            boxShadow: '0 18px 45px rgba(0,0,0,0.55)',
            transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 22px 55px rgba(0,0,0,0.75)',
            },
          }}
        >
          Get your free mockup &amp; quote
        </Button>
      </Box>
    </ProductHeroLayout>
  );
}
