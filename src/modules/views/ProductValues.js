// src/modules/views/ProductValues.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import MuiTypography from '@mui/material/Typography';
import Typography from '../components/Typography';
import { Link as RouterLink } from 'react-router-dom';
import tailorImage from '../images/tailor.webp';
import deliverImage from '../images/deliver.webp';
import clothingImage from '../images/clothing.webp';

const values = [
  {
    img: clothingImage,
    alt: 'clothing',
    step: '01',
    title: 'Your dedicated print concierge',
    body: 'Focus on your business, not your printing. We handle suppliers, quoting, and logistics like an extension of your team.',
  },
  {
    img: tailorImage,
    alt: 'tailor',
    step: '02',
    title: 'Brand-first production choices',
    body: 'We match blanks, print methods, and finishes to your brand — so every piece feels intentional, not random swag.',
  },
  {
    img: deliverImage,
    alt: 'deliver',
    step: '03',
    title: 'Clear timelines, no drama',
    body: 'We obsess over dates, proofs, and tracking so your team just sees clean merch landing when you expect it.',
  },
];

function ProductValues() {
  return (
    <Box
      component="section"
      sx={{ bgcolor: '#111816', py: { xs: 10, md: 14 }, overflow: 'hidden' }}
    >
      <Container maxWidth="lg">

        {/* Section header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <MuiTypography
            variant="overline"
            sx={{ letterSpacing: 4, color: '#4ade80', display: 'block', mb: 2, fontSize: 12 }}
          >
            HOW WE WORK WITH YOU
          </MuiTypography>
          <Typography
            variant="h4"
            component="h2"
            marked="center"
            sx={{
              color: 'white',
              fontWeight: 800,
              maxWidth: 560,
              mx: 'auto',
              lineHeight: 1.2,
            }}
          >
            A dedicated merch studio with big-run capability.
          </Typography>
        </Box>

        {/* Value cards */}
        <Grid container spacing={4}>
          {values.map((v) => (
            <Grid item xs={12} md={4} key={v.step}>
              <Box
                sx={{
                  p: 4,
                  borderRadius: 4,
                  bgcolor: '#1a3d2b',
                  border: '1px solid rgba(74,222,128,0.15)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                  },
                }}
              >
                {/* Step badge + icon row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <MuiTypography
                    sx={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: '#4ade80',
                      bgcolor: 'rgba(74,222,128,0.12)',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 2,
                      letterSpacing: 1.5,
                    }}
                  >
                    {v.step}
                  </MuiTypography>
                  <Box
                    component="img"
                    src={v.img}
                    alt={v.alt}
                    sx={{
                      height: 48,
                      width: 48,
                      objectFit: 'contain',
                      opacity: 0.85,
                      filter: 'brightness(0) invert(1)',
                    }}
                  />
                </Box>

                <MuiTypography
                  variant="h6"
                  sx={{ color: 'white', fontWeight: 700, mb: 1.5, lineHeight: 1.3 }}
                >
                  {v.title}
                </MuiTypography>
                <MuiTypography
                  variant="body2"
                  sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, flex: 1 }}
                >
                  {v.body}
                </MuiTypography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Bottom CTA */}
        <Box sx={{ textAlign: 'center', mt: { xs: 7, md: 9 } }}>
          <MuiTypography
            variant="body1"
            sx={{ color: 'rgba(255,255,255,0.55)', mb: 3, fontSize: 15 }}
          >
            Ready to see what your brand looks like on merch?
          </MuiTypography>
          <Button
            component={RouterLink}
            to="/products"
            variant="contained"
            color="secondary"
            size="large"
            sx={{
              borderRadius: 999,
              px: 5,
              py: 1.6,
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              mr: 2,
            }}
          >
            Get a free mockup & quote
          </Button>
          <Button
            component="a"
            href="https://calendly.com/nate-jointprinting/30min"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            size="large"
            sx={{
              borderRadius: 999,
              px: 4,
              py: 1.6,
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              borderColor: 'rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.75)',
              '&:hover': { borderColor: '#4ade80', color: '#4ade80', bgcolor: 'transparent' },
            }}
          >
            Book a call
          </Button>
        </Box>

      </Container>
    </Box>
  );
}

export default ProductValues;
