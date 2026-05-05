// src/modules/views/ProductHowItWorks.js
import * as React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import { Link as RouterLink } from 'react-router-dom';
import Button from '../components/Button';
import Typography from '../components/Typography';

import drawImage from '../images/draw.webp';
import relaxImage from '../images/relax.webp';
import deliveryImage from '../images/delivery.webp';
import clothingImage from '../images/clothing.webp';

// height: '100%' (instead of minHeight) lets MUI Grid stretch every card to
// the tallest sibling — fixes the "Approve quote & designs" card sitting
// shorter than the rest because its body text wrapped to fewer lines.
const cardBase = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  p: 4,
  borderRadius: 3,
  bgcolor: 'common.white',
  boxShadow: 1,
  height: '100%',
  position: 'relative',
  transition: 'transform 180ms ease-out, box-shadow 180ms ease-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: 5,
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
  flexShrink: 0,
};

const imageStyle = {
  height: 55,
  my: 3,
};

function ProductHowItWorks() {
  // Step 1 is the entry point — clickable and links to /products. The other
  // cards stay non-interactive so we don't imply the user can jump ahead.
  const steps = [
    {
      num: '1',
      img: drawImage,
      title: 'Start your free mockup',
      body:
        "Tell us what you're trying to do — launch, restock, or test an idea. Pick your blanks and we'll build the mockup.",
      to: '/products',
      ctaLabel: 'Start here →',
    },
    {
      num: '2',
      img: clothingImage,
      title: 'Pick a few products',
      body:
        "Pick a few pieces you're into. We'll bring options from budget to premium and handle the art.",
    },
    {
      num: '3',
      img: relaxImage,
      title: 'Approve quote & designs',
      body:
        'Review mockups and pricing, tweak anything you need, and lock in the final lineup.',
    },
    {
      num: '4',
      img: deliveryImage,
      title: 'We print & ship',
      body:
        'We manage production and fulfillment so your merch shows up on time and on-brand.',
    },
  ];

  return (
    <Box
      component="section"
      sx={{
        display: 'flex',
        bgcolor: '#f4f6f5',
        overflow: 'hidden',
      }}
    >
      <Container
        sx={{
          mt: 8,
          mb: 10,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="overline"
          align="center"
          sx={{ letterSpacing: 3, color: 'text.secondary', mb: 1 }}
        >
          THE PROCESS
        </Typography>

        <Typography variant="h4" marked="center" component="h2" sx={{ mb: 8 }}>
          From idea to boxes at your door
        </Typography>

        <Grid container spacing={4} alignItems="stretch">
          {steps.map((step) => {
            const linkProps = step.to
              ? {
                  component: RouterLink,
                  to: step.to,
                  sx: {
                    ...cardBase,
                    textDecoration: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 5,
                      borderColor: 'secondary.main',
                    },
                  },
                }
              : { sx: cardBase };

            return (
              <Grid item xs={12} sm={6} md={3} key={step.num} sx={{ display: 'flex' }}>
                <Box {...linkProps}>
                  <Box sx={numberCircle}>{step.num}</Box>
                  <Box component="img" src={step.img} alt={step.title} sx={imageStyle} />
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body1" sx={{ flexGrow: 1 }}>
                    {step.body}
                  </Typography>
                  {step.ctaLabel && (
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 2,
                        color: 'secondary.main',
                        fontWeight: 700,
                      }}
                    >
                      {step.ctaLabel}
                    </Typography>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>

        <Button
          color="secondary"
          size="large"
          variant="contained"
          component={RouterLink}
          to="/products"
          sx={{
            mt: 8,
            borderRadius: 999,
            px: 4,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Start with products
        </Button>
      </Container>
    </Box>
  );
}

export default ProductHowItWorks;
