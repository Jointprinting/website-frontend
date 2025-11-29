// src/screens/About.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Typography from '../modules/components/Typography';

const printShopImg =
  'https://images.pexels.com/photos/3965558/pexels-photo-3965558.jpeg?auto=compress&cs=tinysrgb&w=1600';
const rackImg =
  'https://images.pexels.com/photos/7671166/pexels-photo-7671166.jpeg?auto=compress&cs=tinysrgb&w=1600';
const detailImg =
  'https://images.pexels.com/photos/4484074/pexels-photo-4484074.jpeg?auto=compress&cs=tinysrgb&w=1600';

function About() {
  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', py: 8 }}>
      <Container maxWidth="lg">
        {/* Intro */}
        <Box sx={{ mb: 8, maxWidth: 840 }}>
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
            between the right blanks, thoughtful decoration, and the way your
            audience actually wears your gear — so your line feels like a
            campaign, not random swag in a box.
          </Typography>
        </Box>

        {/* Section 1: What we actually do */}
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: 3, color: 'text.secondary' }}
            >
              HOW WE BUILD YOUR LINEUP
            </Typography>
            <Typography
              variant="h5"
              component="h2"
              sx={{ mt: 1, mb: 2, fontWeight: 600 }}
            >
              Built for modern brands, not one-off orders.
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              We pull from premium wholesalers like SanMar and S&amp;S
              Activewear, match the right blanks to your brand, and manage all
              the print details so everything feels cohesive — from tees and
              hoodies to hats, bags, and promo.
            </Typography>
            <Typography variant="body1">
              You get a tight lineup that actually sells through instead of
              collecting dust in the back room.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box
              component="img"
              src={printShopImg}
              alt="Screen printing setup"
              sx={{
                width: '100%',
                borderRadius: 3,
                boxShadow: 4,
                objectFit: 'cover',
                maxHeight: 320,
              }}
            />
          </Grid>
        </Grid>

        {/* Section 2: Where we work best */}
        <Grid
          container
          spacing={6}
          alignItems="flex-start"
          sx={{ mt: 8 }}
        >
          <Grid item xs={12} md={6}>
            <Box
              component="img"
              src={rackImg}
              alt="Branded apparel on a rack"
              sx={{
                width: '100%',
                borderRadius: 3,
                boxShadow: 3,
                objectFit: 'cover',
                mb: 3,
              }}
            />
            <Box
              component="img"
              src={detailImg}
              alt="Close-up of merch details"
              sx={{
                width: '100%',
                borderRadius: 3,
                boxShadow: 3,
                objectFit: 'cover',
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: 3, color: 'text.secondary' }}
            >
              WHO WE&apos;RE A GREAT FIT FOR
            </Typography>
            <Typography
              variant="h5"
              component="h2"
              sx={{ mt: 1, mb: 2, fontWeight: 600 }}
            >
              Where we plug into your brand.
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Whether you&apos;re a dispensary, brewery, startup, or community
              brand, we treat your line like a campaign: dialed-in fits, smart
              placements, and a lineup that feels like your brand — on fabric.
            </Typography>

            <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
              We work best with:
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body1">
                Cannabis brands and dispensaries that want merch people
                actually wear outside the shop.
              </Typography>
              <Typography component="li" variant="body1">
                Breweries and beverage brands that live in taprooms, festivals,
                and bottle shops.
              </Typography>
              <Typography component="li" variant="body1">
                Tech / startup teams and creator brands that need runs that
                look as intentional as their product.
              </Typography>
              <Typography component="li" variant="body1">
                Any brand that wants merch to feel like an extension of their
                visual identity — not an afterthought.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default About;
