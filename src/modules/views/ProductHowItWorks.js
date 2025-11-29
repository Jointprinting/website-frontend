// src/modules/views/ProductHowItWorks.js
import * as React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Button from '../components/Button';
import Typography from '../components/Typography';

const stepCard = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  p: 3,
  borderRadius: 3,
  border: '1px solid rgba(0,0,0,0.08)',
  bgcolor: 'background.paper',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
};

const stepNumber = {
  fontSize: 24,
  fontFamily: 'default',
  color: 'secondary.main',
  fontWeight: 'medium',
  mb: 1,
};

function ProductHowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Share your brand & goals',
      body:
        'Tell us who you’re serving, what the merch is for, and your rough timeline and budget. We keep it simple and straight to the point.',
    },
    {
      number: '02',
      title: 'Pick a few products you’re into',
      body:
        'Pick a few products you’re into — we’ll send options from budget to premium and handle the art, so you don’t have to play merch roulette.',
    },
    {
      number: '03',
      title: 'Get mockups & a clear quote',
      body:
        'We send free digital mockups plus a clean price breakdown per product, including printing and shipping, so you can decide quickly.',
    },
    {
      number: '04',
      title: 'Approve & launch',
      body:
        'You sign off, we run production and logistics with our supplier network, and boxes show up ready to wear or sell.',
    },
  ];

  return (
    <Box
      component="section"
      sx={{ display: 'flex', bgcolor: 'secondary.light', overflow: 'hidden' }}
    >
      <Container
        sx={{
          mt: 10,
          mb: 15,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box
          component="img"
          src="https://mui.com/static/themes/onepirate/productCurvyLines.png"
          alt="curvy lines"
          sx={{
            pointerEvents: 'none',
            position: 'absolute',
            top: -180,
            opacity: 0.6,
          }}
        />

        <Typography variant="h4" marked="center" component="h2" sx={{ mb: 4 }}>
          How it works
        </Typography>

        <Typography
          variant="h5"
          align="center"
          sx={{
            mb: 10,
            maxWidth: 720,
          }}
        >
          A clear, four-step path from idea to finished merch — with us doing the
          heavy lifting so you can stay focused on your brand.
        </Typography>

        <Grid container spacing={4}>
          {steps.map((step) => (
            <Grid item xs={12} sm={6} md={3} key={step.number}>
              <Box sx={stepCard}>
                <Box sx={stepNumber}>{step.number}.</Box>
                <Typography
                  variant="h6"
                  align="left"
                  sx={{ mb: 1.5, textTransform: 'none' }}
                >
                  {step.title}
                </Typography>
                <Typography variant="h5" align="left" sx={{ fontSize: 16 }}>
                  {step.body}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Button
          color="secondary"
          size="large"
          variant="contained"
          component="a"
          href="/products"
          sx={{ mt: 8 }}
        >
          Start by browsing products
        </Button>
      </Container>
    </Box>
  );
}

export default ProductHowItWorks;
