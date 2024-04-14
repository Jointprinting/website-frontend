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
              <Typography variant="h6" sx={{ my: 5 }} textAlign='center'>
                Your Dedicated Print Concierge
              </Typography>
              <Typography variant="h5" textAlign='center'>
              Focus on your business, not your printing. 
              Joint Printing assigns you a dedicated agent who handles everything – from finding the perfect supplier to ensuring on-time delivery.
              Let us sweat the details, so you can focus on what matters.
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
              <Typography variant="h6" sx={{ my: 5 }} textAlign='center'>
                Tailor-Made Printing Mastery
              </Typography>
              <Typography variant="h5" textAlign='center'>
                  Your brand deserves the spotlight. Submit your design, and our team will transform it into a masterpiece, offering expert brand consultations to capture the essence of your vision. With Joint Print you'll earn a customized experience, not just an order.
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
              <Typography variant="h6" sx={{ my: 5 }} textAlign='center'>
                Home-Delivered Perfection
              </Typography>
              <Typography variant="h5" textAlign='center'>
              Who has the time to track shipments and handle logistics? We do. And we love it. Kick back and relax; We handle everything, ensuring flawless prints arrive on time.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default ProductValues;