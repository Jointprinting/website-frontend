// src/screens/Home.js
import * as React from 'react';
import Box from '@mui/material/Box';
import ProductHero from '../modules/views/ProductHero';
import ProductCategories from '../modules/views/ProductCategories';
import ProductValues from '../modules/views/ProductValues';
import ProductHowItWorks from '../modules/views/ProductHowItWorks';
import ProductSmokingHero from '../modules/views/ProductSmokingHero';

function Home() {
  return (
    <Box sx={{ bgcolor: '#050806' }}>
      <ProductHero />
      <ProductCategories />
      <ProductValues />
      <ProductHowItWorks />
      <ProductSmokingHero />
    </Box>
  );
}

export default Home;
