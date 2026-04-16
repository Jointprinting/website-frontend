// src/screens/FAQ.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Button from '@mui/material/Button';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MuiTypography from '@mui/material/Typography';
import Typography from '../modules/components/Typography';
import { Link as RouterLink } from 'react-router-dom';

const faqs = [
  {
    q: 'What kinds of products can you source?',
    a: 'Most apparel (tees, crews, hoodies, hats) plus bags, drinkware, and a wide range of promo items. Check our Catalogs page for the full picture — and if you spot something not listed, just ask.',
  },
  {
    q: 'Is there a minimum order quantity?',
    a: 'Our sweet spot is 50+ units per design. We can sometimes flex lower depending on the item and print method, but pricing is always better once you hit real run numbers.',
  },
  {
    q: 'How long does a typical order take?',
    a: 'Most projects land in the 3–4 week range from approved mockups and payment, depending on decoration method and stock. If you have a hard date, we\'ll work backward and tell you honestly what\'s realistic.',
  },
  {
    q: 'Can you help with design, or just printing?',
    a: 'Both. If you already have art, we\'ll prep it for production. If you just have a logo and a half-formed idea, we can help translate that into a clean set of merch concepts.',
  },
  {
    q: 'How does pricing work?',
    a: 'Pricing is based on blank brand, decoration method, number of print locations, and quantity. We send tiered quotes (e.g., 50 / 100 / 150 units) so you can see where the best value is.',
  },
  {
    q: 'What\'s the best way to get started?',
    a: 'Hit "Get your free mockup & quote" below, pick a few products from our catalog, and send us your art or ideas. We\'ll come back with mockups, recommendations, and clear next steps — usually within 24 hours.',
  },
  {
    q: 'Do I need to know exactly what I want before reaching out?',
    a: 'Not at all. A lot of our best orders start with "I kind of want something like this." Tell us your budget, your audience, and what the merch is for — we\'ll handle the rest.',
  },
  {
    q: 'What file formats do you accept for artwork?',
    a: 'Vector files (AI, EPS, SVG) are ideal. High-res PNGs (300dpi+) work too. If you only have a low-res logo, let us know — we can often work with it or advise on a quick fix.',
  },
];

export default function FAQ() {
  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <Box sx={{ bgcolor: '#111816', py: { xs: 8, md: 10 }, textAlign: 'center' }}>
        <Container maxWidth="md">
          <MuiTypography
            variant="overline"
            sx={{ letterSpacing: 4, color: '#4ade80', display: 'block', mb: 2, fontSize: 12 }}
          >
            COMMON QUESTIONS
          </MuiTypography>
          <Typography
            variant="h3"
            component="h1"
            sx={{ color: 'white', fontWeight: 800, mb: 2, lineHeight: 1.15 }}
          >
            Everything you need to know.
          </Typography>
          <MuiTypography
            variant="h6"
            sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300, maxWidth: 500, mx: 'auto', lineHeight: 1.7 }}
          >
            Can't find your answer here? Book a 30-minute call and we'll walk through it together.
          </MuiTypography>
        </Container>
      </Box>

      {/* ── ACCORDIONS ── */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>
        {faqs.map((item, idx) => (
          <Accordion
            key={idx}
            disableGutters
            elevation={0}
            sx={{
              mb: 1.5,
              borderRadius: '12px !important',
              '&:before': { display: 'none' },
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              '&.Mui-expanded': {
                borderColor: '#1a3d2b',
                boxShadow: '0 4px 20px rgba(26,61,43,0.10)',
              },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                px: 3,
                py: 1.5,
                '&.Mui-expanded': { bgcolor: '#f9fdf9' },
              }}
            >
              <MuiTypography fontWeight={700} fontSize={16}>
                {item.q}
              </MuiTypography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, pb: 3 }}>
              <MuiTypography color="text.secondary" lineHeight={1.75}>
                {item.a}
              </MuiTypography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Container>

      {/* ── BOTTOM CTA ── */}
      <Box sx={{ bgcolor: '#111816', py: { xs: 8, md: 10 }, textAlign: 'center' }}>
        <Container maxWidth="sm">
          <MuiTypography
            variant="overline"
            sx={{ color: '#4ade80', letterSpacing: 3, display: 'block', mb: 2 }}
          >
            STILL HAVE QUESTIONS?
          </MuiTypography>
          <Typography
            variant="h4"
            sx={{ color: 'white', fontWeight: 800, mb: 2, lineHeight: 1.2 }}
          >
            The fastest answer is a free mockup.
          </Typography>
          <MuiTypography
            variant="body1"
            sx={{ color: 'rgba(255,255,255,0.6)', mb: 4, lineHeight: 1.75 }}
          >
            Pick a product, drop your art, and see exactly what your merch looks like — no cost, no commitment.
          </MuiTypography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to="/products"
              variant="contained"
              color="secondary"
              size="large"
              sx={{
                borderRadius: 999,
                px: 4,
                py: 1.6,
                fontSize: 16,
                fontWeight: 700,
                textTransform: 'none',
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
                borderColor: 'rgba(255,255,255,0.3)',
                color: 'white',
                '&:hover': { borderColor: '#4ade80', color: '#4ade80', bgcolor: 'transparent' },
              }}
            >
              Book a call instead
            </Button>
          </Box>
        </Container>
      </Box>

    </Box>
  );
}
