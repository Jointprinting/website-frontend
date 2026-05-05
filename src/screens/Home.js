// src/screens/Home.js
//
// Home page section order (top → bottom):
//   1. Hero
//   2. ProductValues — "A dedicated merch studio with big-run capability."
//   3. RewardsSection — "Save on your first order. Earn for every friend you send."
//   4. ProductHowItWorks — "THE PROCESS — From idea to boxes at your door"
//   5. ProductSmokingHero — "Hop on a quick call about your next drop"
//
// Removed: ProductCategories tile grid (was redundant with the products page).

import * as React from 'react';
import Box from '@mui/material/Box';
import ProductHero from '../modules/views/ProductHero';
import ProductValues from '../modules/views/ProductValues';
import ProductHowItWorks from '../modules/views/ProductHowItWorks';
import ProductSmokingHero from '../modules/views/ProductSmokingHero';
import RewardsSection from '../modules/views/RewardsSection';

function Home() {
  return (
    <Box sx={{ bgcolor: '#050806' }}>
      <ProductHero />
      <ProductValues />
      <RewardsSection />
      <ProductHowItWorks />
      <ProductSmokingHero />
    </Box>
  );
}

export default Home;
