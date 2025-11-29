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
        backgroundColor: '#7fc7d9', // average color of the background image
        backgroundPosition: 'center',
      }}
    >
      {/* Increase the network loading priority of the background image. */}
      <img
        style={{ display: 'none' }}
        src={backgroundImage}
        alt="increase priority"
      />

      {/* Headline */}
      <Typography
        color="inherit"
        align="center"
        variant="h2"
        marked="center"
        sx={{ mt: 10 }}
      >
        Modern merch for growing brands.
      </Typography>

      {/* Subhead */}
      <Typography
        color="inherit"
        align="center"
        variant="h5"
        sx={{ mb: 4, mt: { xs: 4, sm: 10 }, maxWidth: 700, mx: 'auto' }}
      >
        We help teams design and produce merch that actually gets worn —
        from first idea to shipped boxes — with free mockups and clear quotes
        on every project.
      </Typography>

      {/* Primary CTA – goes straight to Contact */}
      <Button
        color="secondary"
        variant="contained"
        size="large"
        component="a"
        href="/contact"
        sx={{ minWidth: 220 }}
      >
        Request free mockup &amp; quote
      </Button>

      <Typography variant="body2" color="inherit" sx={{ mt: 2 }}>
        Free mockup &amp; quote within 24 hours on most projects.
      </Typography>

      {/* Soft B2B positioning so you don’t get 1-shirt requests */}
      <Typography
        variant="caption"
        color="inherit"
        sx={{ mt: 1, opacity: 0.9 }}
      >
        Best for teams planning drops of around 50+ units per design.
      </Typography>
    </ProductHeroLayout>
  );
}
