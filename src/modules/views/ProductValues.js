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
  textAlign: 'center',
};

function ProductValues() {
  return (
    <Box
      component="section"
      sx={{ display: 'flex', overflow: 'hidden', bgcolor: 'secondary.light' }}
    >
      <Container
        sx={{
          mt: 12,
          mb: 18,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <Box
          component="img"
          src="https://mui.com/static/themes/onepirate/productCurvyLines.png"
          alt="curvy lines"
          sx={{ pointerEvents: 'none', position: 'absolute', top: -180 }}
        />

        {/* Section heading */}
        <Typography
          variant="overline"
          align="center"
          sx={{ letterSpacing: 3, color: 'text.secondary', mb: 1 }}
        >
          HOW WE WORK WITH YOU
        </Typography>
        <Typography
          variant="h4"
          marked="center"
          align="center"
          component="h2"
          sx={{ mb: 8 }}
        >
          A dedicated merch studio with big-run capability.
        </Typography>

        {/* Value cards */}
        <Grid container spacing={5}>
          <Grid item xs={12} md={4}>
            <Box sx={item}>
              <Box
                component="img"
                src={clothingImage}
                alt="clothes"
                sx={{ height: 80, mb: 3 }}
              />
              <Typography variant="h6" sx={{ my: 2 }}>
                Your dedicated print concierge
              </Typography>
              <Typography variant="h5">
                Focus on your business, not your printing. We handle suppliers,
                quoting, and logistics like an extension of your team.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={item}>
              <Box
                component="img"
                src={tailorImage}
                alt="tailor"
                sx={{ height: 80, mb: 3 }}
              />
              <Typography variant="h6" sx={{ my: 2 }}>
                Brand-first production choices
              </Typography>
              <Typography variant="h5">
                We match blanks, print methods, and finishes to your brand —
                so every piece feels intentional, not random swag.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={item}>
              <Box
                component="img"
                src={deliverImage}
                alt="deliver"
                sx={{ height: 80, mb: 3 }}
              />
              <Typography variant="h6" sx={{ my: 2 }}>
                Clear timelines, no drama
              </Typography>
              <Typography variant="h5">
                We obsess over dates, proofs, and tracking so your team just
                sees clean merch landing when you expect it.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default ProductValues;
