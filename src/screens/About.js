// src/screens/About.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '../modules/components/Typography';

// Merch / print related imagery
const heroImg =
  'https://images.pexels.com/photos/3738081/pexels-photo-3738081.jpeg?auto=compress&cs=tinysrgb&w=1600&dpr=2'; // person working in a print/apparel shop
const rackImg =
  'https://images.pexels.com/photos/7691086/pexels-photo-7691086.jpeg?auto=compress&cs=tinysrgb&w=1600&dpr=2'; // apparel on racks
const detailImg =
  'https://images.pexels.com/photos/3738082/pexels-photo-3738082.jpeg?auto=compress&cs=tinysrgb&w=1600&dpr=2'; // close-up of print/garment detail

function About() {
  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', py: 8 }}>
      <Container maxWidth="lg">
        {/* HERO ROW */}
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Chip
              label="Joint Printing · Merch Studio"
              sx={{
                mb: 2,
                bgcolor: '#e5f4ea',
                color: '#045625',
                fontWeight: 600,
              }}
            />
            <Typography variant="h3" component="h1" gutterBottom>
              About Joint Printing
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 300, mb: 2 }}>
              Joint Printing is a brand-first merch studio. We connect the dots
              between great blanks, thoughtful decoration, and the way your
              audience actually wears your gear — so the whole line feels like a
              campaign, not random swag in a box.
            </Typography>
            <Typography variant="body1">
              We&apos;re fully remote and plug into your team like an extension
              of your brand: helping you pick the right pieces, dial in the art,
              and ship merch that people actually keep.
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper
              elevation={4}
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src={heroImg}
                alt="Merch and apparel production"
                sx={{
                  width: '100%',
                  height: { xs: 260, md: 320 },
                  objectFit: 'cover',
                }}
              />
            </Paper>
          </Grid>
        </Grid>

        {/* HOW WE WORK SECTION */}
        <Box sx={{ mt: 8 }}>
          <Typography
            variant="overline"
            sx={{ letterSpacing: 3, color: 'text.secondary', mb: 1 }}
          >
            HOW WE WORK WITH YOU
          </Typography>
          <Typography
            variant="h5"
            component="h2"
            sx={{ mb: 3, fontWeight: 600 }}
          >
            Brand-first merch from blanks to final box.
          </Typography>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Curated blanks, not a random catalog.
                </Typography>
                <Typography variant="body2">
                  We pull from premium wholesalers like SanMar and S&amp;S
                  Activewear and narrow things down to a tight list that fits
                  your brand, budget, and audience.
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Art & decoration that feel intentional.
                </Typography>
                <Typography variant="body2">
                  From screen print to embroidery and specialty hits, we place
                  your logo where it actually looks good — front, back, sleeves,
                  tags, and packaging.
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Hands-on production & delivery.
                </Typography>
                <Typography variant="body2">
                  We manage timelines, proofs, and print details with the shops
                  so you don&apos;t have to babysit an order. You tell us your
                  in-hand date — we work backwards from there.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        {/* BRAND FIT + IMAGERY */}
        <Grid container spacing={6} alignItems="center" sx={{ mt: 10 }}>
          <Grid item xs={12} md={6}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: 3, color: 'text.secondary', mb: 1 }}
            >
              WHO WE&apos;RE A GREAT FIT FOR
            </Typography>
            <Typography
              variant="h5"
              component="h2"
              sx={{ mb: 2, fontWeight: 600 }}
            >
              Where we plug into your brand.
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Whether you&apos;re a dispensary, brewery, startup, or community
              brand, we treat your merch like a campaign: dialed-in fits, smart
              placements, and a lineup that feels like your brand on fabric.
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Box
                  component="img"
                  src={rackImg}
                  alt="Branded apparel on racks"
                  sx={{
                    width: '100%',
                    height: 220,
                    objectFit: 'cover',
                  }}
                />
              </Paper>
              <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Box
                  component="img"
                  src={detailImg}
                  alt="Close-up of printed merch detail"
                  sx={{
                    width: '100%',
                    height: 220,
                    objectFit: 'cover',
                  }}
                />
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default About;
