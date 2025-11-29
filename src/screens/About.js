// src/screens/About.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import MuiTypography from '@mui/material/Typography';
import Typography from '../modules/components/Typography';

function About() {
  return (
    <Box bgcolor="#f5f5f5" py={8}>
      <Container maxWidth="lg">
        {/* HERO ROW: copy + image collage */}
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 3, color: 'text.secondary' }}
              >
                ABOUT JOINT PRINTING
              </Typography>
              <Typography variant="h3" component="h1">
                Merch that behaves like a brand asset, not a throwaway.
              </Typography>
              <MuiTypography variant="h5" sx={{ maxWidth: 720 }}>
                Joint Printing is a merch studio that pairs brand-level
                thinking with on-demand production. We live in the details so
                your team doesn&apos;t have to — from blank selection and print
                specs to shipping boxes landing on the right doorstep.
              </MuiTypography>
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box
              sx={{
                position: 'relative',
                height: { xs: 260, sm: 320, md: 360 },
              }}
            >
              {/* Main studio-style image */}
              <Box
                component="img"
                src="https://images.pexels.com/photos/4484078/pexels-photo-4484078.jpeg?auto=compress&cs=tinysrgb&w=1200"
                alt="Merch and apparel on a worktable"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: { xs: '4%', md: '8%' },
                  width: { xs: '78%', md: '72%' },
                  height: '80%',
                  objectFit: 'cover',
                  borderRadius: 4,
                  boxShadow: 6,
                }}
              />
              {/* Overlapping detail shot */}
              <Box
                component="img"
                src="https://images.pexels.com/photos/3738085/pexels-photo-3738085.jpeg?auto=compress&cs=tinysrgb&w=1200"
                alt="Closeup of printed garments"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: { xs: '4%', md: '6%' },
                  width: { xs: '48%', md: '44%' },
                  height: '62%',
                  objectFit: 'cover',
                  borderRadius: 4,
                  boxShadow: 5,
                  border: '4px solid #f5f5f5',
                }}
              />
              {/* Tiny badge chip */}
              <Paper
                elevation={4}
                sx={{
                  position: 'absolute',
                  bottom: 18,
                  left: { xs: '6%', md: '10%' },
                  px: 2,
                  py: 1,
                  borderRadius: 999,
                  bgcolor: '#0f1b14',
                  color: 'common.white',
                  fontSize: 12,
                }}
              >
                Real merch, real clients — no mock data.
              </Paper>
            </Box>
          </Grid>
        </Grid>

        {/* STORY / FIT / WHAT YOU GET */}
        <Grid container spacing={4} sx={{ mt: 6 }}>
          <Grid item xs={12} md={7}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: 'common.white',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <MuiTypography variant="h5" sx={{ mb: 1.5 }}>
                Built by a merch obsessive, for teams that care about brand.
              </MuiTypography>
              <MuiTypography variant="body1" sx={{ mb: 2 }}>
                We&apos;ve sat on both sides of the table — managing campaigns,
                wrangling vendors, and fixing last-minute print issues so a
                launch could actually happen. Joint Printing exists to make that
                process feel simple, predictable, and a little bit fun.
              </MuiTypography>
              <MuiTypography variant="body1" sx={{ mb: 1 }}>
                Instead of pushing whatever&apos;s easiest to print, we start
                with your brand: audience, use-case, and what &quot;success&quot;
                looks like for the drop. Then we reverse-engineer the blanks,
                decoration, and fulfillment to match.
              </MuiTypography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  bgcolor: '#0f1b14',
                  color: 'common.white',
                }}
              >
                <MuiTypography
                  variant="subtitle2"
                  sx={{ mb: 1, opacity: 0.8 }}
                >
                  WHO WE&apos;RE A FIT FOR
                </MuiTypography>
                <MuiTypography variant="body1">
                  Dispensaries, breweries, startups, and growing brands that:
                </MuiTypography>
                <Box component="ul" sx={{ mt: 1.5, pl: 3, mb: 0 }}>
                  <Box component="li" sx={{ mb: 0.5 }}>
                    <MuiTypography variant="body2">
                      Want merch people actually wear
                    </MuiTypography>
                  </Box>
                  <Box component="li" sx={{ mb: 0.5 }}>
                    <MuiTypography variant="body2">
                      Need help turning loose ideas into a clear lineup
                    </MuiTypography>
                  </Box>
                  <Box component="li">
                    <MuiTypography variant="body2">
                      Care about deadlines as much as design
                    </MuiTypography>
                  </Box>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  bgcolor: 'common.white',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <MuiTypography variant="subtitle2" sx={{ mb: 1 }}>
                  What you get with Joint Printing
                </MuiTypography>
                <MuiTypography variant="body2">
                  • A single point of contact from idea to delivery <br />
                  • Vendor-agnostic sourcing across major wholesalers <br />
                  • Honest guidance on where to splurge vs. save <br />
                  • Fast mockups and clear, line-itemed quotes
                </MuiTypography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default About;
