// src/screens/About.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Typography from '../modules/components/Typography';

// All images verified: merch / screen print / apparel focused
const heroImg =
  'https://images.unsplash.com/photo-1574180566232-aaad1b5b8450?auto=format&fit=crop&w=1600&q=80';
// screen printing press in action

const processImg =
  'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1600&q=80';
// folded branded apparel / merch

const teamImg =
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80';
// person working at a desk / creative work

const stats = [
  { number: '30,000+', label: 'Units delivered' },
  { number: '10+', label: 'Industries served' },
  { number: '6', label: 'Decoration methods' },
  { number: '3 days', label: 'Avg. mockup turnaround' },
];

const industries = [
  'Dispensaries',
  'Breweries & Taprooms',
  'Startups',
  'Restaurants',
  'Music & Events',
  'Sports Teams',
  'Gyms & Studios',
  'Community Brands',
  'Nonprofits',
  'Retail Shops',
];

const process = [
  {
    step: '01',
    title: 'Curated blanks, not a random catalog.',
    body: 'We pull from premium wholesalers like SanMar and S&S Activewear and narrow things down to a tight list that fits your brand, budget, and audience.',
  },
  {
    step: '02',
    title: 'Art & decoration that feel intentional.',
    body: 'From screen print to embroidery and specialty hits, we place your logo where it actually looks good — front, back, sleeves, tags, and packaging.',
  },
  {
    step: '03',
    title: 'Hands-on production & delivery.',
    body: "We manage timelines, proofs, and print details with the shops so you don't have to babysit an order. You tell us your in-hand date — we work backwards from there.",
  },
];

function About() {
  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <Box sx={{ bgcolor: '#111816', pt: { xs: 8, md: 10 }, pb: 0, overflow: 'hidden' }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="flex-end">
            <Grid item xs={12} md={6} sx={{ pb: { xs: 4, md: 6 } }}>
              <Chip
                label="Joint Printing · Merch Studio"
                sx={{ mb: 3, bgcolor: '#1a3d2b', color: '#4ade80', fontWeight: 700, letterSpacing: 0.5 }}
              />
              <Typography
                variant="h2"
                component="h1"
                sx={{ color: 'white', fontWeight: 800, lineHeight: 1.1, mb: 3, fontSize: { xs: 36, md: 48 } }}
              >
                Merch that actually{' '}
                <Box component="span" sx={{ color: '#4ade80' }}>
                  hits.
                </Box>
              </Typography>
              <Typography
                variant="h6"
                sx={{ color: 'rgba(255,255,255,0.72)', fontWeight: 300, lineHeight: 1.7, mb: 4, maxWidth: 480 }}
              >
                Joint Printing is a brand-first merch studio. We connect the dots
                between great blanks, thoughtful decoration, and the way your
                audience actually wears your gear — so the whole line feels like a
                campaign, not random swag in a box.
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.75 }}>
                Fully remote. We plug into your team like an extension of your
                brand — helping you pick the right pieces, dial in the art, and
                ship merch that people actually keep.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Box
                component="img"
                src={heroImg}
                alt="Screen printing press in action"
                sx={{
                  width: '100%',
                  height: { xs: 280, md: 400 },
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  borderRadius: '16px 16px 0 0',
                  display: 'block',
                }}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── STATS BAR ── */}
      <Box sx={{ bgcolor: '#1a3d2b', py: 4 }}>
        <Container maxWidth="lg">
          <Grid container spacing={2} justifyContent="space-around">
            {stats.map((s) => (
              <Grid item xs={6} md={3} key={s.label} sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  sx={{ color: '#4ade80', fontWeight: 900, lineHeight: 1, mb: 0.5 }}
                >
                  {s.number}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                  {s.label}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── HOW WE WORK ── */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#f5f5f5' }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 6 }}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: 3, color: 'text.secondary', display: 'block', mb: 1 }}
            >
              HOW WE WORK WITH YOU
            </Typography>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 800, maxWidth: 480 }}>
              Brand-first merch from blanks to final box.
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {process.map((p) => (
              <Grid item xs={12} md={4} key={p.step}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 4,
                    height: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: 6 },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: '#4ade80',
                      bgcolor: '#1a3d2b',
                      display: 'inline-block',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 2,
                      mb: 2,
                      letterSpacing: 1,
                    }}
                  >
                    {p.step}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, lineHeight: 1.4 }}>
                    {p.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.75 }}>
                    {p.body}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── WHO WE SERVE ── */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Grid container spacing={8} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 3, color: 'text.secondary', display: 'block', mb: 1 }}
              >
                WHO WE'RE A GREAT FIT FOR
              </Typography>
              <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
                Where we plug into your brand.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.75 }}>
                Whether you're a dispensary, brewery, startup, or community brand,
                we treat your merch like a campaign: dialed-in fits, smart
                placements, and a lineup that feels like your brand on fabric.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {industries.map((ind) => (
                  <Chip
                    key={ind}
                    label={ind}
                    sx={{
                      bgcolor: '#e5f4ea',
                      color: '#045625',
                      fontWeight: 600,
                      fontSize: 13,
                      '&:hover': { bgcolor: '#1a3d2b', color: 'white' },
                      transition: 'all 0.15s',
                    }}
                  />
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={4}
                sx={{ borderRadius: 4, overflow: 'hidden', position: 'relative' }}
              >
                <Box
                  component="img"
                  src={processImg}
                  alt="Branded folded apparel merch"
                  sx={{
                    width: '100%',
                    height: { xs: 300, md: 420 },
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    bgcolor: 'rgba(17,24,22,0.88)',
                    color: 'white',
                    px: 2,
                    py: 1,
                    borderRadius: 99,
                    fontSize: 13,
                    fontWeight: 700,
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  Premium blanks · Custom decoration
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── PROCESS VISUAL ── */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#f5f5f5' }}>
        <Container maxWidth="lg">
          <Grid container spacing={8} alignItems="center">
            <Grid item xs={12} md={6}>
              <Paper elevation={4} sx={{ borderRadius: 4, overflow: 'hidden' }}>
                <Box
                  component="img"
                  src={teamImg}
                  alt="Working on a merch order"
                  sx={{
                    width: '100%',
                    height: { xs: 260, md: 360 },
                    objectFit: 'cover',
                    objectPosition: 'center top',
                    display: 'block',
                  }}
                />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 3, color: 'text.secondary', display: 'block', mb: 1 }}
              >
                THE JOINT PRINTING DIFFERENCE
              </Typography>
              <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 3 }}>
                We're your merch department, not just a printer.
              </Typography>
              {[
                { icon: '🎯', text: 'Free mockups before you commit to anything' },
                { icon: '📦', text: 'We manage vendors, timelines, and proofs end-to-end' },
                { icon: '✉️', text: 'Direct communication — no account managers or ticket queues' },
                { icon: '🔄', text: 'Reorder-friendly: we keep your artwork on file' },
              ].map((item) => (
                <Box
                  key={item.text}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    mb: 2.5,
                    p: 2,
                    borderRadius: 3,
                    bgcolor: 'white',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ fontSize: 22, lineHeight: 1.4 }}>{item.icon}</Box>
                  <Typography variant="body1" sx={{ fontWeight: 500, lineHeight: 1.6 }}>
                    {item.text}
                  </Typography>
                </Box>
              ))}
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── CTA ── */}
      <Box sx={{ bgcolor: '#111816', py: { xs: 8, md: 10 } }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography
            variant="overline"
            sx={{ color: '#4ade80', letterSpacing: 3, display: 'block', mb: 2 }}
          >
            READY TO BUILD SOMETHING?
          </Typography>
          <Typography
            variant="h4"
            sx={{ color: 'white', fontWeight: 800, mb: 2, lineHeight: 1.2 }}
          >
            Let's turn your brand into merch people actually want.
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'rgba(255,255,255,0.6)', mb: 4, lineHeight: 1.75 }}
          >
            Book a free 30-minute call. Bring your logo, a vibe, or just an idea
            — we'll shape it into a lineup.
          </Typography>
          <Button
            component="a"
            href="https://calendly.com/nate-jointprinting/30min"
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            color="secondary"
            size="large"
            sx={{
              borderRadius: 999,
              px: 5,
              py: 1.8,
              fontSize: 17,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 5,
            }}
          >
            Book a free call
          </Button>
        </Container>
      </Box>

    </Box>
  );
}

export default About;
