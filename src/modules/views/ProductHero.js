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
      <img style={{ display: 'none' }} src={backgroundImage} alt="increase priority" />

      <Typography
        variant="overline"
        align="center"
        sx={{ letterSpacing: 6, fontSize: 13, opacity: 0.7 }}
      >
        FREE MOCKUPS · NO COMMITMENT
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
        sx={{
          mt: 2,
          mb: 1,
          textTransform: 'uppercase',
          letterSpacing: 2,
          fontSize: { xs: 32, sm: 44, md: 54 },
          fontWeight: 900,
          lineHeight: 1.1,
        }}
      >
        Custom merch your brand will keep.
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h6"
        sx={{
          mt: 2,
          mb: 5,
          maxWidth: 560,
          mx: 'auto',
          opacity: 0.82,
          fontWeight: 300,
          lineHeight: 1.65,
        }}
      >
        Pick your products, send your art — get a mockup and quote back in under 24 hours. No account needed.
      </Typography>

      <Button
        color="secondary"
        variant="contained"
        size="large"
        component="a"
        href="/products"
        sx={{
          minWidth: 280,
          borderRadius: 999,
          fontSize: 17,
          fontWeight: 700,
          py: 1.8,
          mb: 2,
          textTransform: 'none',
        }}
      >
        Get your free mockup & quote →
      </Button>

      <Box sx={{ mt: 1 }}>
        <Typography
          component="a"
          href="https://calendly.com/nate-jointprinting/30min"
          target="_blank"
          rel="noopener noreferrer"
          align="center"
          sx={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 14,
            textDecoration: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.3)',
            pb: 0.2,
            cursor: 'pointer',
            '&:hover': { color: 'rgba(255,255,255,0.9)' },
          }}
        >
          Prefer to talk first? Book a free 15-min call
        </Typography>
      </Box>

      <Typography
        align="center"
        sx={{ mt: 4, color: 'rgba(255,255,255,0.45)', fontSize: 13, letterSpacing: 1 }}
      >
        30,000+ units delivered · Screen print · Embroidery · Promo products · Made easy
      </Typography>
    </ProductHeroLayout>
  );
}
