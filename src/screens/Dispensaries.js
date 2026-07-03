// src/screens/Dispensaries.js
//
// Conversion landing for the dispensary vertical — Joint Printing's primary
// cold-outreach + road-visit target. A dark, cannabis-native "drop culture"
// page built to make a dispensary owner NOT click away. The angle is confident
// and positive: merch BUILDS a brand people rep (walking advertising + loyalty),
// with the ad-restriction fact demoted to one supporting point rather than the
// defensive headline. Real client mockups anchor it — the white photo backgrounds
// are dropped with mix-blend-mode:multiply over a color-matched tile.
//
// Built to convert: risk-reversal micro-copy, honest client proof, a dark
// dispensary-native order flow (free mockup → approve → print in-house → ship),
// a closing offer, and a sticky "free mockup" bar that follows the scroll — so
// the next step is always one tap away. The page stays fully dark end-to-end
// (its own process + CTA blocks) instead of handing off to the light shared
// components, which would break the immersive mood.
//
// Honest claims only — every stat mirrors the homepage; every mockup is real
// work; the proof strip names real clients, never invented testimonials.

import * as React from 'react';
import { Box, Container, Typography, Button, Stack, IconButton } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import CheckroomOutlinedIcon from '@mui/icons-material/CheckroomOutlined';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LoyaltyOutlinedIcon from '@mui/icons-material/LoyaltyOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import JP from '../brand';

const eyebrow = {
  fontFamily: JP.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: 4,
  textTransform: 'uppercase', color: JP.emerald,
};
const display = { fontFamily: JP.fontDisplay, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 0.95, fontWeight: 700 };

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const usesReducedMotion = () => typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal-on-scroll with a hard backstop: content must NEVER stay invisible.
function Reveal({ children, delay = 0, sx }) {
  const ref = React.useRef(null);
  const [shown, setShown] = React.useState(usesReducedMotion());
  React.useEffect(() => {
    if (shown || typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.08 });
    io.observe(el);
    const t = setTimeout(() => setShown(true), 1800); // backstop
    return () => { io.disconnect(); clearTimeout(t); };
  }, [shown]);
  return (
    <Box ref={ref} sx={{
      opacity: shown ? 1 : 0,
      transform: shown ? 'none' : 'translateY(26px)',
      transition: `opacity .7s cubic-bezier(.2,.7,.2,1) ${delay}ms, transform .7s cubic-bezier(.2,.7,.2,1) ${delay}ms`,
      ...sx,
    }}>{children}</Box>
  );
}

function LeafMark({ sx }) {
  return (
    <Box component="svg" viewBox="0 0 100 100" sx={sx} aria-hidden>
      <path fill="currentColor" d="M50 4 C54 28 63 37 70 40 C60 34 55 42 50 96 C45 42 40 34 30 40 C37 37 46 28 50 4 Z M50 40 C58 30 74 24 92 26 C80 40 66 44 52 46 C60 44 54 44 50 40 Z M50 40 C42 30 26 24 8 26 C20 40 34 44 48 46 C40 44 46 44 50 40 Z" />
    </Box>
  );
}

const WHY = [
  { Icon: GroupsOutlinedIcon, t: 'Walking advertising', d: 'Every branded hoodie gets seen around town for years — not 15 seconds like an ad.' },
  { Icon: LoyaltyOutlinedIcon, t: 'Loyalty you can wear', d: 'Regulars rep the brands they love. Merch turns a customer into a fan who keeps coming back.' },
  { Icon: CheckroomOutlinedIcon, t: 'Looks legit', d: 'Matching staff apparel makes your shop feel dialed-in and trustworthy on sight.' },
  { Icon: CampaignOutlinedIcon, t: 'A channel you can actually use', d: 'When Google and Meta reject cannabis ads, merch is the marketing that never says no.' },
];

const MAKES = [
  { Icon: GroupsOutlinedIcon, t: 'Staff apparel', d: 'Matching tees, hoodies, embroidered polos & hats for your team.' },
  { Icon: LocalMallOutlinedIcon, t: 'Customer drops', d: 'Retail-quality apparel your customers happily pay to wear.' },
  { Icon: CheckroomOutlinedIcon, t: 'Hats & headwear', d: 'Embroidered and patch caps, beanies, and trucker hats.' },
  { Icon: RedeemOutlinedIcon, t: 'Promo & giveaways', d: 'Totes, stickers, drinkware, and event swag that get used.' },
  { Icon: StorefrontOutlinedIcon, t: 'Grand-opening kits', d: 'Everything you need to launch — or hit a holiday — looking sharp.' },
  { Icon: LoyaltyOutlinedIcon, t: 'Loyalty & VIP gear', d: 'Reward your regulars with merch they actually want to keep.' },
];

// Real client mockups. `tint` = the color tile the white-bg photo blends into.
const WORK = [
  { src: '/work/premier-high-life-hoodie.png', client: 'Premier High Life', loc: 'Las Cruces, NM', item: 'Branded pullover hoodie', tint: ['#eafaef', '#cdeed6'], big: true },
  { src: '/work/shaggys-baggy-local-drop.png', client: "Shaggy's Baggy", loc: 'Auburn, ME', item: 'Local-drop tee', tint: ['#fde4f0', '#f8c9e0'] },
  { src: '/work/shaggys-baggy-flower-tee.png', client: "Shaggy's Baggy", loc: 'Auburn, ME', item: 'Retail customer tee', tint: ['#fdead9', '#fbd3ad'] },
  { src: '/work/premier-staff-tee.png', client: 'Premier High Life', loc: 'Las Cruces, NM', item: 'Staff tee', tint: ['#e8f0ea', '#d3e6d8'] },
  { src: '/work/dispensary-trucker-cap.png', client: 'Dispensary drop', loc: '', item: 'Embroidered trucker cap', tint: ['#fbe4ef', '#f6cfe2'] },
];
// The hero rotates through the most striking full-garment shots.
const HERO_SHOTS = [WORK[0], WORK[1], WORK[2], WORK[3]];

// Honest client proof — real shops we've printed for, spanning the country
// (NM → ME reinforces "we ship anywhere"). Never invented quotes.
const PROOF = [
  { name: 'Premier High Life', loc: 'Las Cruces, NM' },
  { name: "Shaggy's Baggy", loc: 'Auburn, ME' },
];

// The real order flow, worded for a dispensary owner. Step 1 is the entry point.
const PROCESS = [
  { Icon: DesignServicesOutlinedIcon, k: '01', t: 'Free mockup', d: 'Send your logo — or a rough idea on a napkin. We design a real mockup on real blanks and send it back. Free, no commitment.' },
  { Icon: CheckroomOutlinedIcon, k: '02', t: 'Approve & pick your blanks', d: "Love it? Pick your pieces — budget tees to premium heavyweight hoodies. We handle sizes, quantities, and the art files." },
  { Icon: PrintOutlinedIcon, k: '03', t: 'We print in-house', d: 'No middleman, no drop-ship markup. We screen-print and embroider everything ourselves, so quality and timing are on us.' },
  { Icon: LocalShippingOutlinedIcon, k: '04', t: 'Ships to your shop', d: 'Boxes at your door, on time and on-brand. Need a restock or a new seasonal drop? A couple clicks and it’s moving.' },
];

const TRUST = ['Free mockup, no commitment', 'No minimums to start', 'Printed in-house — no middleman', 'Ships nationwide'];

const STATS = [
  { n: '30,000+', l: 'units delivered' },
  { n: 'In-house', l: 'design + print' },
  { n: '24 hr', l: 'mockup turnaround' },
  { n: 'Nationwide', l: 'we ship anywhere' },
];

const MARQUEE = ['Drop hoodies', 'Staff tees', 'Event caps', 'Grand-opening kits', 'Loyalty merch', 'Promo swag', 'Embroidered polos', 'Customer drops'];

// One blended product tile: product in a top zone (white melts into the tint),
// label in its OWN footer band so it never overlaps the garment.
function WorkTile({ w, big }) {
  return (
    <Box sx={{
      position: 'relative', height: '100%', borderRadius: `${JP.radius.panel}px`, overflow: 'hidden',
      background: `linear-gradient(155deg, ${w.tint[0]}, ${w.tint[1]})`,
      display: 'flex', flexDirection: 'column',
      minHeight: big ? { xs: 360, md: '100%' } : { xs: 300, sm: 280, md: 250 },
      boxShadow: '0 30px 60px -34px rgba(0,0,0,0.7)',
      transition: 'transform .3s ease', '&:hover': { transform: 'translateY(-4px)' },
    }}>
      <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Box component="img" src={w.src} alt={`${w.item} for ${w.client}${w.loc ? ` — ${w.loc}` : ''}`} loading="lazy"
          sx={{ maxWidth: big ? '80%' : '86%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
      </Box>
      <Box sx={{ px: 2.25, py: 1.75, bgcolor: 'rgba(0,0,0,0.04)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <Typography sx={{ ...display, fontSize: big ? 22 : 18, color: '#0b1a10', letterSpacing: 0, lineHeight: 1 }}>{w.client}</Typography>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(11,26,16,0.6)', mt: 0.4 }}>
          {w.item}{w.loc ? ` · ${w.loc}` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

// The hero spotlight — auto-rotates through the striking shots; the tile tint
// tracks the current product so the white always melts cleanly.
function HeroSpotlight() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (usesReducedMotion()) return undefined;
    const id = setInterval(() => setI((v) => (v + 1) % HERO_SHOTS.length), 3800);
    return () => clearInterval(id);
  }, []);
  const cur = HERO_SHOTS[i];
  return (
    <Box sx={{ position: 'relative' }}>
      <LeafMark sx={{ position: 'absolute', width: { xs: 180, md: 260 }, top: -30, right: -20, color: JP.emerald, opacity: 0.12, zIndex: 0 }} />
      <Box sx={{
        position: 'relative', zIndex: 1, borderRadius: `${JP.radius.panel + 6}px`, overflow: 'hidden',
        background: `radial-gradient(120% 120% at 50% 0%, ${cur.tint[0]}, ${cur.tint[1]})`,
        boxShadow: '0 50px 100px -40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
        maxWidth: 460, mx: 'auto', transition: 'background .6s ease',
        aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, md: 4 },
      }}>
        <Box component="img" key={i} src={cur.src} alt={`${cur.item} for ${cur.client}`}
          sx={{ maxWidth: '82%', maxHeight: '92%', objectFit: 'contain', mixBlendMode: 'multiply',
            animation: 'jpFadeIn .6s ease', '@keyframes jpFadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }} />
        <Box sx={{ position: 'absolute', left: { xs: 16, md: 22 }, bottom: { xs: 16, md: 22 },
          display: 'flex', alignItems: 'center', gap: 1, bgcolor: JP.ink, borderRadius: 999, px: 2, py: 0.9,
          boxShadow: '0 12px 24px -12px rgba(0,0,0,0.7)' }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: JP.emerald }} />
          <Typography sx={{ color: JP.onDark, fontSize: 12.5, fontWeight: 700 }}>Real drop · {cur.client}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

// Small check row used under the hero and in the closing offer.
function TrustRow({ items, sx }) {
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={{ xs: 1.5, sm: 2.5 }} sx={sx}>
      {items.map((t) => (
        <Stack key={t} direction="row" spacing={0.75} alignItems="center">
          <CheckCircleRoundedIcon sx={{ fontSize: 17, color: JP.emerald }} />
          <Typography sx={{ color: JP.onDarkMuted, fontSize: 13.5, fontWeight: 600 }}>{t}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

// Sticky "free mockup" bar — slides up once the visitor scrolls past the hero
// so the primary action is always one tap away. Dismissible; motion-safe.
function StickyMockupBar() {
  const [show, setShow] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 640);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (dismissed) return null;
  return (
    <Box sx={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1250,
      px: { xs: 0, sm: 2 }, pb: { xs: 0, sm: 2 }, pointerEvents: 'none',
    }}>
      <Box sx={{
        maxWidth: 1080, mx: 'auto', pointerEvents: show ? 'auto' : 'none',
        display: 'flex', alignItems: 'center', gap: { xs: 1.25, sm: 2 },
        bgcolor: 'rgba(17,24,22,0.94)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(74,222,128,0.32)', borderRadius: { xs: 0, sm: 999 },
        px: { xs: 2, sm: 3 }, py: { xs: 1.25, sm: 1.5 },
        boxShadow: '0 -12px 44px -20px rgba(0,0,0,0.85)',
        transform: show ? 'translateY(0)' : 'translateY(140%)',
        transition: 'transform .45s cubic-bezier(.2,.7,.2,1)',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}>
        <LeafMark sx={{ width: 26, height: 26, color: JP.emerald, flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ ...display, fontSize: { xs: 15, sm: 17 }, color: JP.onDark, letterSpacing: 0, lineHeight: 1.05 }}>
            Free dispensary mockup
          </Typography>
          <Typography sx={{ color: JP.onDarkMuted, fontSize: 12.5, display: { xs: 'none', md: 'block' } }}>
            Send your logo — get a real mockup on real blanks. No commitment.
          </Typography>
        </Box>
        <Button component={RouterLink} to="/contact?topic=dispensary" variant="contained" color="cta"
          sx={{ borderRadius: 999, px: { xs: 2, sm: 3 }, py: 1.05, textTransform: 'none', fontWeight: 700,
            fontSize: { xs: 13.5, sm: 15 }, whiteSpace: 'nowrap', flexShrink: 0 }}>
          Get a free mockup&nbsp;→
        </Button>
        <IconButton aria-label="Dismiss" onClick={() => setDismissed(true)} size="small"
          sx={{ color: JP.onDarkMuted, flexShrink: 0, '&:hover': { color: JP.onDark } }}>
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default function Dispensaries() {
  const [big, ...rest] = WORK;
  return (
    <Box sx={{ bgcolor: JP.ink, color: JP.onDark, position: 'relative', overflow: 'hidden' }}>
      {/* Fixed atmosphere: drifting emerald/gold glows + film grain */}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        '&::before': {
          content: '""', position: 'absolute', top: '-12%', right: '-12%', width: '62vw', height: '62vw',
          borderRadius: '50%', background: `radial-gradient(circle, ${JP.emeraldSoft(0.22)}, transparent 62%)`,
          animation: 'jpDrift1 16s ease-in-out infinite alternate',
        },
        '&::after': {
          content: '""', position: 'absolute', bottom: '4%', left: '-16%', width: '56vw', height: '56vw',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,161,58,0.14), transparent 62%)',
          animation: 'jpDrift2 20s ease-in-out infinite alternate',
        },
        '@keyframes jpDrift1': { from: { transform: 'translate(0,0)' }, to: { transform: 'translate(-40px,30px)' } },
        '@keyframes jpDrift2': { from: { transform: 'translate(0,0)' }, to: { transform: 'translate(40px,-24px)' } },
        '@media (prefers-reduced-motion: reduce)': { '&::before, &::after': { animation: 'none' } },
      }} />
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.05, mixBlendMode: 'overlay', backgroundImage: GRAIN }} />

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* ── HERO ─────────────────────────────────────────────── */}
        <Container maxWidth="lg" sx={{ pt: { xs: 7, md: 12 }, pb: { xs: 6, md: 10 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' }, gap: { xs: 5, md: 7 }, alignItems: 'center' }}>
            <Reveal>
              <Typography sx={eyebrow}>For dispensaries</Typography>
              <Typography component="h1" sx={{ ...display, mt: 2, mb: 2.5, fontSize: { xs: 46, sm: 62, md: 78 } }}>
                Build a brand your{' '}
                <Box component="span" sx={{ color: JP.emerald }}>customers wear</Box>.
              </Typography>
              <Typography sx={{ color: JP.onDarkMuted, maxWidth: 520, mb: 3.5, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.6 }}>
                Staff apparel, customer drops, and event gear your community actually reps — turning your best customers into your best advertising. We design, print, and ship merch dispensaries are proud to put their name on.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                <Button component={RouterLink} to="/contact?topic=dispensary" variant="contained" color="cta" size="large"
                  sx={{ borderRadius: 999, px: 4, py: 1.7, textTransform: 'none', fontWeight: 700, fontSize: 16.5 }}>
                  Get a free mockup →
                </Button>
                <Button component={RouterLink} to="/products" variant="outlined" size="large"
                  sx={{ borderRadius: 999, px: 4, py: 1.7, textTransform: 'none', fontWeight: 700, fontSize: 16.5,
                    color: JP.onDark, borderColor: 'rgba(244,248,245,0.32)',
                    '&:hover': { borderColor: JP.onDark, bgcolor: 'rgba(255,255,255,0.06)' } }}>
                  Browse products
                </Button>
              </Stack>
              <TrustRow items={['Free mockup', 'No minimums to start', 'Ships nationwide']} sx={{ mt: 3 }} />
            </Reveal>
            <Reveal delay={120}>
              <HeroSpotlight />
            </Reveal>
          </Box>
        </Container>

        {/* ── MARQUEE band ─────────────────────────────────────── */}
        <Box sx={{ py: { xs: 2, md: 2.5 }, borderTop: '1px solid rgba(244,248,245,0.08)', borderBottom: '1px solid rgba(244,248,245,0.08)',
          bgcolor: 'rgba(255,255,255,0.015)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'inline-flex', gap: 5, animation: 'jpMarquee 26s linear infinite',
            '@keyframes jpMarquee': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <Box key={i} sx={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Typography component="span" sx={{ ...display, fontSize: { xs: 18, md: 22 }, color: JP.onDarkMuted, letterSpacing: 1 }}>{m}</Typography>
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: JP.emerald, flexShrink: 0 }} />
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── PROOF strip — honest client social proof, coast to coast ── */}
        <Container maxWidth="lg" sx={{ py: { xs: 3.5, md: 4.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 3 }} alignItems="center"
            justifyContent="center" sx={{ textAlign: 'center' }}>
            <Typography sx={{ ...eyebrow, fontSize: 12.5, letterSpacing: 3, color: JP.onDarkMuted }}>
              Trusted by real dispensaries
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap justifyContent="center" spacing={1.25}>
              {PROOF.map((p) => (
                <Box key={p.name} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.9, px: 1.75, py: 0.7,
                  borderRadius: 999, border: '1px solid rgba(244,248,245,0.14)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: JP.emerald }} />
                  <Typography component="span" sx={{ fontWeight: 800, fontSize: 13.5, color: JP.onDark }}>{p.name}</Typography>
                  <Typography component="span" sx={{ fontSize: 12.5, color: JP.onDarkMuted }}>· {p.loc}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1.75, py: 0.7, borderRadius: 999,
                border: '1px dashed rgba(244,248,245,0.14)' }}>
                <Typography component="span" sx={{ fontSize: 12.5, color: JP.onDarkMuted, fontWeight: 600 }}>+ shops nationwide</Typography>
              </Box>
            </Stack>
          </Stack>
        </Container>

        {/* ── WHY MERCH ────────────────────────────────────────── */}
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 12 } }}>
          <Reveal>
            <Typography sx={eyebrow}>Why merch</Typography>
            <Typography component="h2" sx={{ ...display, mt: 1.5, mb: 2, fontSize: { xs: 32, md: 52 }, maxWidth: 860 }}>
              Merch is how dispensaries build a following.
            </Typography>
            <Typography sx={{ color: JP.onDarkMuted, maxWidth: 660, mb: 5, fontSize: { xs: 16, md: 18 } }}>
              The shops that win don't just move product — they build a brand people rep. Merch gets your name worn around town, every single day.
            </Typography>
          </Reveal>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 2.5 }}>
            {WHY.map(({ Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 80}>
                <Box sx={{ height: '100%', p: 3, borderRadius: `${JP.radius.card}px`,
                  border: '1px solid rgba(244,248,245,0.1)', bgcolor: 'rgba(255,255,255,0.025)',
                  transition: 'border-color .25s ease, background .25s ease',
                  '&:hover': { borderColor: JP.emeraldSoft(0.4), bgcolor: 'rgba(255,255,255,0.05)' } }}>
                  <Box sx={{ width: 46, height: 46, borderRadius: 2.5, display: 'grid', placeItems: 'center', mb: 2,
                    bgcolor: JP.emeraldSoft(0.14), color: JP.emerald }}>
                    <Icon sx={{ fontSize: 25 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 18.5, mb: 1 }}>{t}</Typography>
                  <Typography sx={{ color: JP.onDarkMuted, fontSize: 15, lineHeight: 1.55 }}>{d}</Typography>
                </Box>
              </Reveal>
            ))}
          </Box>
        </Container>

        {/* ── REAL WORK — bento lookbook ───────────────────────── */}
        <Box id="work" sx={{ py: { xs: 8, md: 13 }, borderTop: '1px solid rgba(244,248,245,0.07)', bgcolor: 'rgba(0,0,0,0.25)' }}>
          <Container maxWidth="lg">
            <Reveal>
              <Typography sx={eyebrow}>Real work</Typography>
              <Typography component="h2" sx={{ ...display, mt: 1.5, mb: 1.5, fontSize: { xs: 32, md: 52 } }}>
                Merch that actually moves.
              </Typography>
              <Typography sx={{ color: JP.onDarkMuted, maxWidth: 600, mb: 5, fontSize: { xs: 16, md: 18 } }}>
                Real dispensary clients, real drops — staff apparel, customer merch, and event gear, printed and shipped nationwide. Yours is next.
              </Typography>
            </Reveal>
            <Reveal delay={80}>
              <Box sx={{ display: 'grid', gap: 2.5,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(4,1fr)' },
                gridAutoRows: { md: '250px' } }}>
                <Box sx={{ gridColumn: { sm: 'span 2' }, gridRow: { md: 'span 2' } }}>
                  <WorkTile w={big} big />
                </Box>
                {rest.map((w) => (
                  <Box key={w.src}><WorkTile w={w} /></Box>
                ))}
              </Box>
            </Reveal>
          </Container>
        </Box>

        {/* ── WHAT WE MAKE ─────────────────────────────────────── */}
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 13 } }}>
          <Reveal>
            <Typography sx={eyebrow}>What we make</Typography>
            <Typography component="h2" sx={{ ...display, mt: 1.5, mb: 5, fontSize: { xs: 32, md: 52 } }}>
              From the counter to the street.
            </Typography>
          </Reveal>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' }, gap: 2.5 }}>
            {MAKES.map(({ Icon, t, d }, i) => (
              <Reveal key={t} delay={(i % 3) * 80}>
                <Box sx={{ height: '100%', p: 3, borderRadius: `${JP.radius.card}px`, display: 'flex', gap: 2,
                  border: '1px solid rgba(244,248,245,0.1)', bgcolor: 'rgba(255,255,255,0.025)' }}>
                  <Box sx={{ width: 46, height: 46, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center',
                    bgcolor: JP.emeraldSoft(0.14), color: JP.emerald }}>
                    <Icon sx={{ fontSize: 25 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.5 }}>{t}</Typography>
                    <Typography sx={{ color: JP.onDarkMuted, fontSize: 14.5, lineHeight: 1.55 }}>{d}</Typography>
                  </Box>
                </Box>
              </Reveal>
            ))}
          </Box>
        </Container>

        {/* ── HOW IT WORKS — dark, dispensary-native order flow ─── */}
        <Box sx={{ py: { xs: 8, md: 13 }, borderTop: '1px solid rgba(244,248,245,0.07)', bgcolor: 'rgba(0,0,0,0.25)' }}>
          <Container maxWidth="lg">
            <Reveal>
              <Typography sx={eyebrow}>How it works</Typography>
              <Typography component="h2" sx={{ ...display, mt: 1.5, mb: 2, fontSize: { xs: 32, md: 52 } }}>
                How your drop comes together.
              </Typography>
              <Typography sx={{ color: JP.onDarkMuted, maxWidth: 620, mb: 5, fontSize: { xs: 16, md: 18 } }}>
                No agencies, no minimum-order runaround. Four steps from your logo to boxes at the shop — and it starts free.
              </Typography>
            </Reveal>
            <Box sx={{ position: 'relative', display: 'grid', gap: 2.5,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(4,1fr)' } }}>
              {/* connecting line on desktop */}
              <Box aria-hidden sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: 34, left: '12%', right: '12%',
                height: '1px', background: `linear-gradient(90deg, ${JP.emeraldSoft(0)}, ${JP.emeraldSoft(0.5)}, ${JP.emeraldSoft(0)})` }} />
              {PROCESS.map(({ Icon, k, t, d }, i) => {
                const isEntry = i === 0;
                const card = (
                  <Box sx={{ height: '100%', position: 'relative', p: 3, borderRadius: `${JP.radius.card}px`,
                    border: `1px solid ${isEntry ? JP.emeraldSoft(0.5) : 'rgba(244,248,245,0.1)'}`,
                    bgcolor: isEntry ? JP.emeraldSoft(0.07) : 'rgba(255,255,255,0.025)',
                    transition: 'border-color .25s ease, background .25s ease, transform .25s ease',
                    '&:hover': { borderColor: JP.emeraldSoft(0.5), bgcolor: 'rgba(255,255,255,0.05)', transform: 'translateY(-4px)' } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                      <Box sx={{ width: 46, height: 46, borderRadius: 2.5, display: 'grid', placeItems: 'center',
                        bgcolor: JP.emeraldSoft(0.14), color: JP.emerald }}>
                        <Icon sx={{ fontSize: 25 }} />
                      </Box>
                      <Typography sx={{ ...display, fontSize: 30, color: 'rgba(244,248,245,0.16)', letterSpacing: 0 }}>{k}</Typography>
                    </Stack>
                    <Typography sx={{ fontWeight: 800, fontSize: 18.5, mb: 1 }}>{t}</Typography>
                    <Typography sx={{ color: JP.onDarkMuted, fontSize: 14.5, lineHeight: 1.55 }}>{d}</Typography>
                    {isEntry && (
                      <Typography sx={{ mt: 1.75, color: JP.emerald, fontWeight: 800, fontSize: 14 }}>Start here →</Typography>
                    )}
                  </Box>
                );
                return (
                  <Reveal key={k} delay={i * 80} sx={{ height: '100%' }}>
                    {isEntry ? (
                      <Box component={RouterLink} to="/contact?topic=dispensary"
                        sx={{ display: 'block', height: '100%', textDecoration: 'none', color: 'inherit' }}>
                        {card}
                      </Box>
                    ) : card}
                  </Reveal>
                );
              })}
            </Box>
          </Container>
        </Box>

        {/* ── STATS ────────────────────────────────────────────── */}
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Reveal>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 3,
              p: { xs: 3, md: 4 }, borderRadius: `${JP.radius.panel}px`, border: '1px solid rgba(244,248,245,0.1)',
              bgcolor: 'rgba(255,255,255,0.02)' }}>
              {STATS.map((s) => (
                <Box key={s.l} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ ...display, fontSize: { xs: 30, md: 46 }, color: JP.emerald }}>{s.n}</Typography>
                  <Typography sx={{ color: JP.onDarkMuted, fontSize: 12.5, mt: 1, textTransform: 'uppercase', letterSpacing: 1.4 }}>{s.l}</Typography>
                </Box>
              ))}
            </Box>
          </Reveal>
        </Container>

        {/* ── CLOSING OFFER ────────────────────────────────────── */}
        <Container maxWidth="lg" sx={{ pb: { xs: 12, md: 18 } }}>
          <Reveal>
            <Box sx={{ position: 'relative', overflow: 'hidden', textAlign: 'center',
              borderRadius: `${JP.radius.panel}px`, border: `1px solid ${JP.emeraldSoft(0.3)}`,
              background: `linear-gradient(160deg, ${JP.emeraldSoft(0.12)}, rgba(255,255,255,0.02) 55%)`,
              px: { xs: 3, md: 8 }, py: { xs: 6, md: 9 } }}>
              <LeafMark sx={{ position: 'absolute', width: { xs: 200, md: 300 }, top: -50, right: -40, color: JP.emerald, opacity: 0.08 }} />
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography sx={eyebrow}>Start your drop</Typography>
                <Typography component="h2" sx={{ ...display, mt: 1.5, mb: 2, fontSize: { xs: 34, md: 56 }, maxWidth: 720, mx: 'auto' }}>
                  Your next drop starts with a free mockup.
                </Typography>
                <Typography sx={{ color: JP.onDarkMuted, maxWidth: 560, mx: 'auto', mb: 4, fontSize: { xs: 16, md: 18.5 }, lineHeight: 1.6 }}>
                  Send your logo — or a rough idea — and we'll send back a real mockup on real blanks. No cost, no commitment. Love it? We print in-house and ship it to your shop.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                  <Button component={RouterLink} to="/contact?topic=dispensary" variant="contained" color="cta" size="large"
                    sx={{ borderRadius: 999, px: 4.5, py: 1.7, textTransform: 'none', fontWeight: 700, fontSize: 16.5 }}>
                    Get a free mockup →
                  </Button>
                  <Button component="a" href="https://calendly.com/nate-jointprinting/30min" target="_blank" rel="noopener noreferrer"
                    variant="outlined" size="large"
                    sx={{ borderRadius: 999, px: 4.5, py: 1.7, textTransform: 'none', fontWeight: 700, fontSize: 16.5,
                      color: JP.onDark, borderColor: 'rgba(244,248,245,0.32)',
                      '&:hover': { borderColor: JP.onDark, bgcolor: 'rgba(255,255,255,0.06)' } }}>
                    Book a 15-min call
                  </Button>
                </Stack>
                <TrustRow items={TRUST} sx={{ mt: 4, justifyContent: 'center' }} />
              </Box>
            </Box>
          </Reveal>
        </Container>
      </Box>

      <StickyMockupBar />
    </Box>
  );
}
