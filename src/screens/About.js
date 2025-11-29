// src/screens/About.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '../modules/components/Typography';

// Swap these later for your own product / shop photos if you’d like
const heroImg =
  'https://images.pexels.com/photos/3965558/pexels-photo-3965558.jpeg?auto=compress&cs=tinysrgb&w=1600';
const rackImg =
  'https://images.pexels.com/photos/7671166/pexels-photo-7671166.jpeg?auto=compress&cs=tinysrgb&w=1600';
const detailImg =
  'https://images.pexels.com/photos/4484074/pexels-photo-4484074.jpeg?auto=compress&cs=tinysrgb&w=1600';

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
                alt="Screen printing shop"
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
                    We manage timelines, proofs, and print details with the
                    shops so you don&apos;t have to babysit an order. You tell
                    us your in-hand date — we work backwards from there.
                  </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        {/* WHO WE'RE BEST FOR + IMAGES */}
        <Grid
          container
          spacing={6}
          alignItems="center"
          sx={{ mt: 10 }}
        >
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

            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
              We work best with:
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body1">
                Cannabis brands and dispensaries that want pieces people wear
                outside the shop.
              </Typography>
              <Typography component="li" variant="body1">
                Breweries and beverage brands that live in taprooms, festivals,
                and bottle shops.
              </Typography>
              <Typography component="li" variant="body1">
                Tech / startup teams and creators that need runs that look as
                intentional as their product.
              </Typography>
              <Typography component="li" variant="body1">
                Any brand that wants merch to feel like a real extension of
                their identity — not an afterthought.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              <Paper
                elevation={3}
                sx={{ borderRadius: 3, overflow: 'hidden' }}
              >
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
              <Paper
                elevation={3}
                sx={{ borderRadius: 3, overflow: 'hidden' }}
              >
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
