// src/screens/Home.js
import * as React from 'react';
import Box from '@mui/material/Box';
import ProductCategories from '../modules/views/ProductCategories';
import ProductSmokingHero from '../modules/views/ProductSmokingHero';
import ProductHero from '../modules/views/ProductHero';
import ProductValues from '../modules/views/ProductValues';
import ProductHowItWorks from '../modules/views/ProductHowItWorks';

function Home() {
  return (
    <Box>
      <ProductHero />
      <ProductCategories />
      <ProductValues />
      <ProductHowItWorks />
      <ProductSmokingHero />
    </Box>
  );
}

export default Home;
