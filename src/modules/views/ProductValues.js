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
  alignItems: 'center',
  textAlign: 'center',
  p: 4,
  borderRadius: 3,
  bgcolor: 'background.paper',
  boxShadow: 1,
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background:
      'linear-gradient(90deg, #06752b 0%, #38b08a 50%, #06752b 100%)',
    opacity: 0.7,
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: 4,
  },
};

const iconWrapper = {
  width: 72,
  height: 72,
  borderRadius: '50%',
  bgcolor: 'secondary.light',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  mb: 2.5,
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
          mb: 20,
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box
          component="img"
          src="https://mui.com/static/themes/onepirate/productCurvyLines.png"
          alt="curvy lines"
          sx={{ pointerEvents: 'none', position: 'absolute', top: -180 }}
        />

        <Typography
          variant="h4"
          marked="center"
          align="center"
          component="h2"
          sx={{ mb: 8 }}
        >
          Why brands work with us
        </Typography>

        <Grid container spacing={5}>
          <Grid item xs={12} md={4}>
            <Box sx={card}>
              <Box sx={iconWrapper}>
                <Box
                  component="img"
                  src={clothingImage}
                  alt="clothes"
                  sx={{ height: 40 }}
                />
              </Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Your Dedicated Print Concierge
              </Typography>
              <Typography variant="body1">
                Focus on your business, not your printing. Joint Printing
                assigns you a dedicated agent who handles everything – from
                finding the perfect supplier to ensuring on-time delivery. Let
                us sweat the details, so you can focus on what matters.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={card}>
              <Box sx={iconWrapper}>
                <Box
                  component="img"
                  src={tailorImage}
                  alt="tailor"
                  sx={{ height: 40 }}
                />
              </Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Tailor-Made Printing Mastery
              </Typography>
              <Typography variant="body1">
                Your brand deserves the spotlight. Submit your design, and our
                team will transform it into a masterpiece, offering expert brand
                consultations to capture the essence of your vision. With Joint
                Print you&apos;ll earn a customized experience, not just an
                order.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={card}>
              <Box sx={iconWrapper}>
                <Box
                  component="img"
                  src={deliverImage}
                  alt="deliver"
                  sx={{ height: 40 }}
                />
              </Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Home-Delivered Perfection
              </Typography>
              <Typography variant="body1">
                Who has the time to track shipments and handle logistics? We do.
                And we love it. Kick back and relax; we handle everything,
                ensuring flawless prints arrive on time.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default ProductValues;
