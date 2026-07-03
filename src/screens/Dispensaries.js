// src/screens/Dispensaries.js
//
// A conversion landing for the dispensary vertical (Joint Printing's primary
// cold-outreach + road-visit target). Reuses the public brand tokens (src/brand.js)
// and the shared process + call-CTA sections, wrapped by the site Navbar/Footer via
// App.js. Honest positioning only — every claim mirrors the homepage's.

import * as React from 'react';
import { Box, Container, Grid, Typography, Button, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import JP from '../brand';
import ProductHowItWorks from '../modules/views/ProductHowItWorks';
import ProductSmokingHero from '../modules/views/ProductSmokingHero';

const eyebrow = { fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' };
const headline = { textTransform: 'none', letterSpacing: 0, lineHeight: 1.08 };

const VALUES = [
  { t: 'Staff that looks the part', d: 'Embroidered polos, tees, and hats that make your budtenders instantly recognizable and on-brand.' },
  { t: 'Customers become walking ads', d: 'Merch people actually want to wear — hoodies, tees, and caps that put your brand on the street for years.' },
  { t: 'Promo that moves product', d: 'Giveaways, loyalty drops, and event gear for grand openings, holidays, and everything in between.' },
  { t: 'One shop, start to finish', d: 'Design, screen print, embroidery, and delivery under one roof — no juggling vendors, no surprises.' },
];

const MAKES = [
  { t: 'Staff apparel', d: 'Tees, hoodies, and embroidered polos & hats for your team.' },
  { t: 'Customer merch', d: 'Retail-quality apparel your customers happily pay to wear.' },
  { t: 'Hats & headwear', d: 'Embroidered and patch caps, beanies, and trucker hats.' },
  { t: 'Promo & giveaways', d: 'Totes, stickers, drinkware, and event swag.' },
  { t: 'Grand-opening kits', d: 'Everything you need to launch or hit a holiday looking sharp.' },
  { t: 'Bulk runs & reorders', d: 'Big quantities and easy reorders — consistent color, every time.' },
];

const STATS = [
  { n: '30,000+', l: 'units delivered' },
  { n: 'Free', l: 'mockups, every time' },
  { n: '24 hr', l: 'mockup turnaround' },
  { n: 'Local', l: 'South Jersey, hands-on' },
];

export default function Dispensaries() {
  return (
    <Box sx={{ bgcolor: JP.white }}>
      {/* Hero */}
      <Box sx={{ bgcolor: JP.ink, color: JP.onDark, py: { xs: 9, md: 14 } }}>
        <Container maxWidth="lg">
          <Typography sx={{ ...eyebrow, color: JP.emerald }}>For dispensaries</Typography>
          <Typography variant="h2" sx={{ ...headline, color: JP.onDark, mt: 2, mb: 2.5, fontSize: { xs: 34, sm: 44, md: 58 }, maxWidth: 940, fontWeight: 700 }}>
            Merch your customers actually want to wear.
          </Typography>
          <Typography variant="h6" sx={{ color: JP.onDarkMuted, maxWidth: 640, mb: 4, fontWeight: 300, lineHeight: 1.6 }}>
            Custom apparel, branded gear, and promo — designed, printed, and delivered by a South Jersey shop that treats your brand like its own.
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Button component={RouterLink} to="/contact?topic=dispensary" variant="contained" color="cta" size="large"
              sx={{ borderRadius: 999, px: 4, py: 1.6, textTransform: 'none', fontWeight: 700, fontSize: 16 }}>
              Get a free mockup →
            </Button>
            <Button component={RouterLink} to="/products" variant="outlined" size="large"
              sx={{ borderRadius: 999, px: 4, py: 1.6, textTransform: 'none', fontWeight: 700, fontSize: 16,
                color: JP.onDark, borderColor: 'rgba(244,248,245,0.4)',
                '&:hover': { borderColor: JP.onDark, bgcolor: 'rgba(255,255,255,0.06)' } }}>
              Browse products
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Why merch */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Typography sx={{ ...eyebrow, color: JP.forest }}>Why it works</Typography>
        <Typography variant="h3" sx={{ ...headline, mt: 1.5, mb: 1.5, fontSize: { xs: 28, md: 42 } }}>
          Merch is the cheapest marketing you'll ever run.
        </Typography>
        <Typography sx={{ color: JP.charcoal, opacity: 0.72, maxWidth: 640, mb: 5, fontSize: 17 }}>
          A branded hoodie gets worn for years. In a business where you can't advertise everywhere, your merch does the talking — for staff, for customers, and at every event.
        </Typography>
        <Grid container spacing={3}>
          {VALUES.map((v) => (
            <Grid item xs={12} sm={6} md={3} key={v.t}>
              <Box sx={{ height: '100%', p: 3, borderRadius: `${JP.radius.card}px`, border: `1px solid ${JP.pale}`, bgcolor: JP.paper }}>
                <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: JP.emerald, mb: 2 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>{v.t}</Typography>
                <Typography sx={{ color: JP.charcoal, opacity: 0.72, fontSize: 15, lineHeight: 1.55 }}>{v.d}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* What we make — dark band */}
      <Box sx={{ bgcolor: JP.ink, color: JP.onDark, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Typography sx={{ ...eyebrow, color: JP.emerald }}>What we make</Typography>
          <Typography variant="h3" sx={{ ...headline, color: JP.onDark, mt: 1.5, mb: 5, fontSize: { xs: 28, md: 42 } }}>
            From the counter to the street.
          </Typography>
          <Grid container spacing={3}>
            {MAKES.map((m) => (
              <Grid item xs={12} sm={6} md={4} key={m.t}>
                <Box sx={{ height: '100%', p: 3, borderRadius: `${JP.radius.card}px`,
                  border: '1px solid rgba(244,248,245,0.12)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 0.75, color: JP.onDark }}>{m.t}</Typography>
                  <Typography sx={{ color: JP.onDarkMuted, fontSize: 15, lineHeight: 1.55 }}>{m.d}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Proof */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Grid container spacing={3}>
          {STATS.map((s) => (
            <Grid item xs={6} md={3} key={s.l} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontFamily: JP.fontDisplay, fontWeight: 700, fontSize: { xs: 32, md: 46 }, color: JP.forest, lineHeight: 1 }}>{s.n}</Typography>
              <Typography sx={{ color: JP.charcoal, opacity: 0.7, fontSize: 13.5, mt: 1, textTransform: 'uppercase', letterSpacing: 1.2 }}>{s.l}</Typography>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Reuse the shared process + book-a-call CTA */}
      <ProductHowItWorks />
      <ProductSmokingHero />
    </Box>
  );
}
