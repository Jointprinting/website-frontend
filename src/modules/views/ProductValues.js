// src/modules/views/ProductValues.js
import * as React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Typography from '../components/Typography';
import tailorImage from '../images/tailor.webp';
import deliverImage from '../images/deliver.webp';
import clothingImage from '../images/clothing.webp';

const item = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  px: 5,
};

function ProductValues() {
  return (
    <Box
      component="section"
      sx={{ display: 'flex', overflow: 'hidden', bgcolor: 'secondary.light' }}
    >
      <Container sx={{ mt: 15, mb: 30, display: 'flex', position: 'relative' }}>
        <Box
          component="img"
          src="https://mui.com/static/themes/onepirate/productCurvyLines.png"
          alt="curvy lines"
          sx={{ pointerEvents: 'none', position: 'absolute', top: -180 }}
        />
        <Grid container spacing={5}>
          <Grid item xs={12} md={4}>
            <Box sx={item}>
              <Box
                component="img"
                src={clothingImage}
                alt="clothes"
                sx={{ height: 80 }}
              />
              <Typography variant="h6" sx={{ my: 3 }} textAlign="center">
                A real person on your project
              </Typography>
              <Typography variant="h5" textAlign="center">
                You get a dedicated merch partner who handles vendors, proofs,
                and logistics — so you can stay focused on the business.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={item}>
              <Box
                component="img"
                src={tailorImage}
                alt="tailor"
                sx={{ height: 80 }}
              />
              <Typography variant="h6" sx={{ my: 3 }} textAlign="center">
                Design help included
              </Typography>
              <Typography variant="h5" textAlign="center">
                Already have art or just a rough idea? We’ll clean it up,
                place it on the right products, and make sure it feels on-brand.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={item}>
              <Box
                component="img"
                src={deliverImage}
                alt="deliver"
                sx={{ height: 80 }}
              />
              <Typography variant="h6" sx={{ my: 3 }} textAlign="center">
                Worry-free delivery
              </Typography>
              <Typography variant="h5" textAlign="center">
                We manage production and shipping end-to-end, with clear
                timelines and updates so your merch shows up when you need it.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default ProductValues;
