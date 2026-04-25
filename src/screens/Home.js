// src/screens/Home.js
import * as React from 'react';
import Box from '@mui/material/Box';
import ProductHero from '../modules/views/ProductHero';
import ProductCategories from '../modules/views/ProductCategories';
import ProductValues from '../modules/views/ProductValues';
import ProductHowItWorks from '../modules/views/ProductHowItWorks';
import ProductSmokingHero from '../modules/views/ProductSmokingHero';
import RewardsSection from '../modules/views/RewardsSection';

function Home() {
  return (
    <Box sx={{ bgcolor: '#050806' }}>
      <ProductHero />
      <ProductCategories />
      <ProductValues />
      {/* New: 10% welcome coupon + tiered referral program */}
      <RewardsSection />
      <ProductHowItWorks />
      <ProductSmokingHero />
    </Box>
  );
}

export default Home;
