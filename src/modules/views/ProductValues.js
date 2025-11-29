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
  alignItems: 'flex-start',
  px: { xs: 2, md: 4 },
};

function ProductValues() {
  return (
    <Box
      component="section"
      sx={{
        display: 'flex',
        overflow: 'hidden',
        bgcolor: '#050806',
        color: 'common.white',
      }}
    >
      <Container
        sx={{
          mt: 10,
          mb: 12,
          display: 'flex',
          position: 'relative',
        }}
      >
        <Box
          component="img"
          src="https://mui.com/static/themes/onepirate/productCurvyLines.png"
          alt="curvy lines"
          sx={{
            pointerEvents: 'none',
            position: 'absolute',
            top: -140,
            opacity: 0.4,
          }}
        />
        <Grid container spacing={6}>
          <Grid item xs={12} md={4}>
            <Box sx={item}>
              <Box
                component="img"
                src={clothingImage}
                alt="clothes"
                sx={{ height: 80, mb: 3 }}
              />
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Your dedicated print concierge
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Focus on your business, not your printing. Joint Printing assigns
                you a dedicated agent who handles everything – from finding the
                perfect supplier to ensuring on-time delivery.
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
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Tailor-made printing mastery
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Your brand deserves the spotlight. Share your art and we&apos;ll
                turn it into production-ready merch, with real feedback on what
                will land with your audience.
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
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Hands-off production &amp; delivery
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                We manage vendors, timelines, and shipping. You get finished
                merch that shows up on time and on-brand — without chasing anyone
                down.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default ProductValues;
