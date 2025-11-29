// src/modules/views/ProductValues.js
import * as React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Typography from '../components/Typography';
import tailorImage from '../images/tailor.webp';
import deliverImage from '../images/deliver.webp';
import clothingImage from '../images/clothing.webp';

const card = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  p: 3,
  borderRadius: 3,
  bgcolor: 'background.paper',
  boxShadow: 1,
  height: '100%',
  transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: 4,
  },
};

const iconStyle = {
  height: 72,
  mb: 2,
};

function ProductValues() {
  return (
    <Box
      component="section"
      sx={{
        display: 'flex',
        overflow: 'hidden',
        bgcolor: '#f4f6f5',
      }}
    >
      <Container sx={{ mt: 10, mb: 12, position: 'relative' }}>
        <Typography
          variant="overline"
          sx={{ letterSpacing: 3, color: 'text.secondary', mb: 1 }}
          align="center"
        >
          HOW WE WORK WITH YOU
        </Typography>
        <Typography
          variant="h4"
          marked="center"
          align="center"
          component="h2"
          sx={{ mb: 6 }}
        >
          A small studio feel with big-run capability
        </Typography>

        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Box sx={card}>
              <Box component="img" src={clothingImage} alt="clothes" sx={iconStyle} />
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Dedicated merch partner
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                One person who actually knows your brand, not a support ticket.
                From day one you get a point of contact who steers suppliers,
                samples, and timelines for you.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={card}>
              <Box component="img" src={tailorImage} alt="tailor" sx={iconStyle} />
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Design &amp; decoration dialed in
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                You send art, brand folder, or even a rough idea. We turn it
                into clean mockups with the right print method so everything
                feels intentional — not slapped on.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={card}>
              <Box component="img" src={deliverImage} alt="deliver" sx={iconStyle} />
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Production you don&apos;t have to babysit
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                We manage vendors, QA, and shipping so boxes just show up where
                they need to be — for launches, events, and re-orders.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default ProductValues;
