// src/screens/About.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '../modules/components/Typography';

function About() {
  return (
    <Box bgcolor="#f5f5f5" py={8}>
      <Container maxWidth="lg">
        {/* Hero copy */}
        <Stack spacing={2} mb={6}>
          <Typography
            variant="overline"
            sx={{ letterSpacing: 3, color: 'text.secondary' }}
          >
            ABOUT JOINT PRINTING
          </Typography>
          <Typography variant="h3" component="h1">
            Merch that behaves like a brand asset, not a throwaway.
          </Typography>
          <Typography variant="h5" sx={{ maxWidth: 720 }}>
            Joint Printing is a merch studio that pairs brand-level thinking
            with on-demand production. We live in the details so your team
            doesn&apos;t have to — from blank selection and print specs to
            shipping boxes landing on the right doorstep.
          </Typography>
        </Stack>

        {/* Two-column story + who we help */}
        <Grid container spacing={4}>
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
              <Typography variant="h5" sx={{ mb: 1.5 }}>
                Built by a merch obsessive, for teams that care about brand.
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                We&apos;ve sat on both sides of the table — managing campaigns,
                wrangling vendors, and fixing last-minute print issues so a
                launch could actually happen. Joint Printing exists to make that
                process feel simple, predictable, and a little bit fun.
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                Instead of pushing whatever&apos;s easiest to print, we start
                with your brand: audience, use-case, and what &quot;success&quot;
                looks like for the drop. Then we reverse-engineer the blanks,
                decoration, and fulfillment to match.
              </Typography>
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
                <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.8 }}>
                  WHO WE&apos;RE A FIT FOR
                </Typography>
                <Typography variant="body1">
                  Dispensaries, breweries, startups, and growing brands that:
                </Typography>
                <ul style={{ marginTop: 12, paddingLeft: 20 }}>
                  <li>Want merch people actually wear</li>
                  <li>Need help turning loose ideas into a clear lineup</li>
                  <li>Care about deadlines as much as design</li>
                </ul>
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
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  What you get with Joint Printing
                </Typography>
                <Typography variant="body2">
                  • A single point of contact from idea to delivery <br />
                  • Vendor-agnostic sourcing across major wholesalers <br />
                  • Honest guidance on where to splurge vs. save <br />
                  • Fast mockups and clear, line-itemed quotes
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default About;
