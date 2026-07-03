// src/screens/Dispensaries.js
//
// Conversion landing for the dispensary vertical (Joint Printing's primary
// cold-outreach + road-visit target). Leads with the angle that actually lands
// with dispensaries: cannabis brands can't buy Google/Meta ads, so merch is the
// marketing they ARE allowed to run. Now anchored by REAL work — the hero shows
// an actual dispensary hoodie we produced, and a "Real work" gallery proves it
// with mockups from real dispensary clients (Premier High Life, Shaggy's Baggy).
// Reuses the public brand tokens + shared process/CTA sections; wrapped by the
// site Navbar/Footer via App.js. Honest claims only — every stat mirrors the
// homepage.

import * as React from 'react';
import { Box, Container, Grid, Typography, Button, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import CheckroomOutlinedIcon from '@mui/icons-material/CheckroomOutlined';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LoyaltyOutlinedIcon from '@mui/icons-material/LoyaltyOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import JP from '../brand';
import ProductHowItWorks from '../modules/views/ProductHowItWorks';
import ProductSmokingHero from '../modules/views/ProductSmokingHero';

const eyebrow = { fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' };
const headline = { textTransform: 'none', letterSpacing: 0, lineHeight: 1.06 };

const WHY = [
  { Icon: CampaignOutlinedIcon, t: "Ads you can't buy", d: 'Meta and Google reject cannabis. Merch is the one marketing channel that never says no.' },
  { Icon: GroupsOutlinedIcon, t: 'Customers do the advertising', d: 'Every branded hoodie is a walking recommendation — worn around town for years, not 15 seconds.' },
  { Icon: CheckroomOutlinedIcon, t: 'A shop that looks dialed-in', d: 'Matching staff apparel makes your dispensary feel legit and trustworthy the second someone walks in.' },
  { Icon: BoltOutlinedIcon, t: 'Built for drops & events', d: '4/20, grand openings, holidays — merch designed to move, ready when you need it.' },
];

const MAKES = [
  { Icon: GroupsOutlinedIcon, t: 'Staff apparel', d: 'Matching tees, hoodies, and embroidered polos & hats for your team.' },
  { Icon: LocalMallOutlinedIcon, t: 'Customer merch drops', d: 'Retail-quality apparel your customers happily pay to wear.' },
  { Icon: CheckroomOutlinedIcon, t: 'Hats & headwear', d: 'Embroidered and patch caps, beanies, and trucker hats.' },
  { Icon: RedeemOutlinedIcon, t: 'Promo & giveaways', d: 'Totes, stickers, drinkware, and event swag that get used.' },
  { Icon: StorefrontOutlinedIcon, t: 'Grand-opening kits', d: 'Everything you need to launch — or hit a holiday — looking sharp.' },
  { Icon: LoyaltyOutlinedIcon, t: 'Loyalty & VIP gear', d: 'Reward your regulars with merch they actually want to keep.' },
];

// Real mockups we produced for real dispensary clients — the proof that makes
// this page land. Files live in public/work/. Captions are factual (who / where
// / what was made); no invented metrics or testimonials.
const WORK = [
  { src: '/work/premier-high-life-hoodie.png', client: 'Premier High Life', loc: 'Las Cruces, NM', item: 'Branded pullover hoodie', span: true },
  { src: '/work/shaggys-baggy-local-drop.png', client: "Shaggy's Baggy", loc: 'Auburn, ME', item: 'Local-drop tee' },
  { src: '/work/shaggys-baggy-flower-tee.png', client: "Shaggy's Baggy", loc: 'Auburn, ME', item: 'Retail customer tee' },
  { src: '/work/premier-staff-tee.png', client: 'Premier High Life', loc: 'Las Cruces, NM', item: 'Staff tee' },
  { src: '/work/dispensary-trucker-cap.png', client: 'Dispensary drop', loc: '', item: 'Embroidered trucker cap' },
];

const STATS = [
  { n: '30,000+', l: 'units delivered' },
  { n: 'Free', l: 'mockups, every time' },
  { n: '24 hr', l: 'mockup turnaround' },
  { n: 'Nationwide', l: 'we ship anywhere' },
];

// The hero product shot: a real dispensary hoodie in a soft card with a small
// "real client" tag — reads as proof, not a stock placeholder.
function HeroMockup() {
  return (
    <Box sx={{ position: 'relative', maxWidth: 440, mx: 'auto' }}>
      <Box sx={{
        borderRadius: `${JP.radius.card + 6}px`, overflow: 'hidden', bgcolor: JP.white,
        border: '1px solid rgba(244,248,245,0.12)', boxShadow: '0 30px 60px -30px rgba(0,0,0,0.6)',
      }}>
        <Box component="img" src="/work/premier-high-life-hoodie.png"
          alt="Custom branded hoodie we printed for Premier High Life, a cannabis dispensary"
          sx={{ display: 'block', width: '100%', height: 'auto' }} />
      </Box>
      <Box sx={{
        position: 'absolute', bottom: -14, left: -10,
        bgcolor: JP.ink, border: '1px solid rgba(244,248,245,0.16)',
        borderRadius: 999, px: 2, py: 0.9, display: 'flex', alignItems: 'center', gap: 1,
        boxShadow: '0 12px 24px -12px rgba(0,0,0,0.7)',
      }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: JP.emerald }} />
        <Typography sx={{ color: JP.onDark, fontSize: 12.5, fontWeight: 700 }}>
          Real client · Premier High Life
        </Typography>
      </Box>
    </Box>
  );
}

export default function Dispensaries() {
  return (
    <Box sx={{ bgcolor: JP.white }}>
      {/* Hero */}
      <Box sx={{ bgcolor: JP.ink, color: JP.onDark, py: { xs: 7, md: 13 }, overflow: 'hidden' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 6 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography sx={{ ...eyebrow, color: JP.emerald }}>For dispensaries</Typography>
              <Typography variant="h2" sx={{ ...headline, color: JP.onDark, mt: 2, mb: 2.5, fontSize: { xs: 32, sm: 42, md: 54 }, fontWeight: 700 }}>
                The marketing your dispensary is actually allowed to run.
              </Typography>
              <Typography variant="h6" sx={{ color: JP.onDarkMuted, maxWidth: 540, mb: 4, fontWeight: 300, lineHeight: 1.6, fontSize: { xs: 16, md: 19 } }}>
                Meta and Google won't run cannabis ads. But a hoodie with your logo? It runs itself — worn around town for years. We design, print, and deliver merch dispensaries are proud to put their name on.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                <Button component={RouterLink} to="/contact?topic=dispensary" variant="contained" color="cta" size="large"
                  sx={{ borderRadius: 999, px: 4, py: 1.6, textTransform: 'none', fontWeight: 700, fontSize: 16 }}>
                  Get a free mockup →
                </Button>
                <Button component="a" href="#work" variant="outlined" size="large"
                  sx={{ borderRadius: 999, px: 4, py: 1.6, textTransform: 'none', fontWeight: 700, fontSize: 16,
                    color: JP.onDark, borderColor: 'rgba(244,248,245,0.4)',
                    '&:hover': { borderColor: JP.onDark, bgcolor: 'rgba(255,255,255,0.06)' } }}>
                  See real work
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <HeroMockup />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Why merch */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Typography sx={{ ...eyebrow, color: JP.forest }}>Why merch, why now</Typography>
        <Typography variant="h3" sx={{ ...headline, mt: 1.5, mb: 1.5, fontSize: { xs: 26, md: 40 }, maxWidth: 720 }}>
          You're marketing with one hand tied behind your back. Merch is the other hand.
        </Typography>
        <Typography sx={{ color: JP.charcoal, opacity: 0.72, maxWidth: 640, mb: 5, fontSize: { xs: 16, md: 17 } }}>
          Dispensaries can't buy their way onto most screens — so the brands that win put their name on things people wear and carry every day.
        </Typography>
        <Grid container spacing={{ xs: 2, md: 3 }}>
          {WHY.map(({ Icon, t, d }) => (
            <Grid item xs={12} sm={6} md={3} key={t}>
              <Box sx={{ height: '100%', p: 3, borderRadius: `${JP.radius.card}px`, border: `1px solid ${JP.pale}`, bgcolor: JP.paper }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, display: 'grid', placeItems: 'center', mb: 2, bgcolor: JP.emeraldSoft(0.14), color: JP.forest }}>
                  <Icon sx={{ fontSize: 24 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>{t}</Typography>
                <Typography sx={{ color: JP.charcoal, opacity: 0.72, fontSize: 15, lineHeight: 1.55 }}>{d}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Real work — the proof. Product mockups from real dispensary clients. */}
      <Box id="work" sx={{ bgcolor: JP.paper, borderTop: `1px solid ${JP.pale}`, borderBottom: `1px solid ${JP.pale}` }}>
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Typography sx={{ ...eyebrow, color: JP.forest }}>Real work</Typography>
          <Typography variant="h3" sx={{ ...headline, mt: 1.5, mb: 1.5, fontSize: { xs: 26, md: 40 }, maxWidth: 720 }}>
            Merch we've actually made for dispensaries.
          </Typography>
          <Typography sx={{ color: JP.charcoal, opacity: 0.72, maxWidth: 640, mb: 5, fontSize: { xs: 16, md: 17 } }}>
            Real clients, real drops — staff apparel, customer merch, and event gear, printed and shipped nationwide. Yours is next.
          </Typography>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {WORK.map((w) => (
              <Grid item xs={12} sm={6} md={w.span ? 6 : 3} key={w.src}>
                <Box sx={{ height: '100%', borderRadius: `${JP.radius.card}px`, overflow: 'hidden',
                  border: `1px solid ${JP.pale}`, bgcolor: JP.white, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ bgcolor: JP.white, display: 'grid', placeItems: 'center', p: { xs: 2, md: 2.5 } }}>
                    <Box component="img" src={w.src}
                      alt={`${w.item} for ${w.client}${w.loc ? ` — ${w.loc}` : ''}`}
                      loading="lazy"
                      sx={{ width: '100%', height: w.span ? { xs: 260, md: 340 } : { xs: 220, md: 240 }, objectFit: 'contain' }} />
                  </Box>
                  <Box sx={{ px: 2.5, py: 2, borderTop: `1px solid ${JP.pale}`, mt: 'auto' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15.5 }}>{w.client}</Typography>
                    <Typography sx={{ color: JP.charcoal, opacity: 0.66, fontSize: 13.5 }}>
                      {w.item}{w.loc ? ` · ${w.loc}` : ''}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* What we make — dark band */}
      <Box sx={{ bgcolor: JP.ink, color: JP.onDark, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Typography sx={{ ...eyebrow, color: JP.emerald }}>What we make</Typography>
          <Typography variant="h3" sx={{ ...headline, color: JP.onDark, mt: 1.5, mb: 5, fontSize: { xs: 26, md: 40 } }}>
            From the counter to the street.
          </Typography>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {MAKES.map(({ Icon, t, d }) => (
              <Grid item xs={12} sm={6} md={4} key={t}>
                <Box sx={{ height: '100%', p: 3, borderRadius: `${JP.radius.card}px`, display: 'flex', gap: 2,
                  border: '1px solid rgba(244,248,245,0.12)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: JP.emeraldSoft(0.14), color: JP.emerald }}>
                    <Icon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 17.5, mb: 0.5, color: JP.onDark }}>{t}</Typography>
                    <Typography sx={{ color: JP.onDarkMuted, fontSize: 14.5, lineHeight: 1.55 }}>{d}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Proof */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Grid container spacing={{ xs: 3, md: 3 }}>
          {STATS.map((s) => (
            <Grid item xs={6} md={3} key={s.l} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontFamily: JP.fontDisplay, fontWeight: 700, fontSize: { xs: 28, md: 44 }, color: JP.forest, lineHeight: 1 }}>{s.n}</Typography>
              <Typography sx={{ color: JP.charcoal, opacity: 0.7, fontSize: 13, mt: 1, textTransform: 'uppercase', letterSpacing: 1.2 }}>{s.l}</Typography>
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
