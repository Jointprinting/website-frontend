import * as React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Button from '../components/Button';
import Typography from '../components/Typography';

import drawImage from '../images/draw.webp';
import relaxImage from '../images/relax.webp';
import deliveryImage from '../images/delivery.webp';
import clothingImage from '../images/clothing.webp'; // new image so 2 & 4 aren't the same

const cardBase = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  p: 4,
  borderRadius: 3,
  bgcolor: 'common.white',
  boxShadow: 2,
  minHeight: 260,
  position: 'relative',
  transition: 'transform 180ms ease-out, box-shadow 180ms ease-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: 6,
  },
};

const numberCircle = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: '2px solid #06752b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  color: 'secondary.main',
  mb: 2,
  bgcolor: 'secondary.light',
};

const imageStyle = {
  height: 55,
  my: 3,
};

function ProductHowItWorks() {
  const steps = [
    {
      num: '1',
      img: drawImage,
      title: 'Request a free mockup',
      body:
        "Request a free mockup and tell us your vision — we're ready to listen around the clock.",
    },
    {
      num: '2',
      img: clothingImage,
      title: 'Pick a few products',
      body:
        "Pick a few products you're into — we'll send options from budget to premium and handle the art.",
    },
    {
      num: '3',
      img: relaxImage,
      title: 'Approve quote & designs',
      body:
        'Review your mockups and quote, tweak anything you need, and lock in the final lineup.',
    },
    {
      num: '4',
      img: deliveryImage,
      title: 'We print & ship',
      body:
        'We handle production and delivery so your merch shows up on time and on-brand.',
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
            opacity: 0.7,
          }}
        />

        <Typography variant="h4" marked="center" component="h2" sx={{ mb: 10 }}>
          How it works
        </Typography>

        <Grid container spacing={4}>
          {steps.map((step) => (
            <Grid item xs={12} sm={6} md={3} key={step.num}>
              <Box sx={cardBase}>
                <Box sx={numberCircle}>{step.num}</Box>
                <Box component="img" src={step.img} alt={step.title} sx={imageStyle} />
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  {step.title}
                </Typography>
                <Typography variant="body1">{step.body}</Typography>
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
          Get started
        </Button>
      </Container>
    </Box>
  );
}

export default ProductHowItWorks;
