// src/screens/About.js
import * as React from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
  Chip,
} from '@mui/material';

function About() {
  return (
    <Box bgcolor="#f5f5f5" py={{ xs: 6, md: 10 }}>
      <Container maxWidth="lg">
        {/* Intro */}
        <Stack spacing={1} mb={{ xs: 5, md: 7 }}>
          <Chip
            label="Joint Printing · Merch Studio"
            color="secondary"
            sx={{
              alignSelf: 'flex-start',
              borderRadius: 999,
              fontWeight: 500,
            }}
          />
          <Typography variant="h4" fontWeight={700}>
            ABOUT JOINT PRINTING
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            maxWidth={720}
          >
            Joint Printing is a brand-first merch studio. We connect the dots
            between great blanks, thoughtful decoration, and the way your
            audience actually wears your gear — so you get more than just random
            swag in a box.
          </Typography>
        </Stack>

        <Grid container spacing={6} alignItems="center">
          {/* Text */}
          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight={600}>
                Built for modern brands, not just one-off orders.
              </Typography>

              <Typography variant="body1" color="text.secondary">
                We pull from premium wholesalers like SanMar and S&amp;S
                Activewear, match the right blanks to your brand, and manage the
                print details so everything feels cohesive — from tees and
                hoodies to hats, bags, and promo.
              </Typography>

              <Typography variant="body1" color="text.secondary">
                Whether you&apos;re a dispensary, brewery, startup or community
                brand, we treat your line like a campaign: dialed-in fits, smart
                placements, and a lineup that actually sells through instead of
                collecting dust.
              </Typography>

              <Stack spacing={1.2}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Where we work best
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Cannabis brands and dispensaries
                  <br />
                  • Breweries and beverage brands
                  <br />
                  • Tech/startup teams and creator projects
                  <br />
                  • Any brand that wants merch people actually wear
                </Typography>
              </Stack>
            </Stack>
          </Grid>

          {/* Images */}
          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              <Paper
                elevation={4}
                sx={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  height: 260,
                }}
              >
                <Box
                  component="img"
                  src="https://images.pexels.com/photos/3965558/pexels-photo-3965558.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  alt="Screen printing setup"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Paper>

              <Paper
                elevation={2}
                sx={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  height: 220,
                }}
              >
                <Box
                  component="img"
                  src="https://images.pexels.com/photos/7671166/pexels-photo-7671166.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  alt="Rack of branded apparel"
                  sx={{
                    width: '100%',
                    height: '100%',
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
