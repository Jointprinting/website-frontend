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
      {/* Increase the network loading priority of the background image. */}
      <img
        style={{ display: 'none' }}
        src={backgroundImage}
        alt="increase priority"
      />

      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
        sx={{ mt: 10 }}
      >
        CUSTOM MERCH FOR MODERN BRANDS
      </Typography>

      <Typography
        color="inherit"
        align="center"
        variant="h5"
        sx={{ mb: 4, mt: { xs: 4, sm: 6 } }}
      >
        Pick your blanks, send your art, and we&apos;ll handle the rest.
      </Typography>

      <Button
        color="secondary"
        variant="contained"
        size="large"
        component="a"
        href="/products"
        sx={{ minWidth: 220 }}
      >
        Request free mockup & quote
      </Button>

      <Typography variant="body2" color="inherit" sx={{ mt: 2, opacity: 0.85 }}>
        Free mockup & quote in under 24 hours.
      </Typography>
    </ProductHeroLayout>
  );
}
