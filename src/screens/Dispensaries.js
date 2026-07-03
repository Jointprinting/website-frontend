// src/screens/Dispensaries.js
//
// Conversion landing for the dispensary vertical — Joint Printing's primary
// cold-outreach + road-visit target. A dark, cannabis-native "drop culture"
// page built to make a dispensary owner NOT click away: full-bleed artwork hero,
// scroll-revealed sections, a bold bento lookbook of REAL client merch, and the
// ad-restriction angle that actually lands ("Meta/Google won't run cannabis ads
// — merch is the marketing you're allowed to run").
//
// The product shots are photographed on white; we drop that white with
// mix-blend-mode:multiply over a color-matched tile, so each garment melts into
// its panel instead of sitting in a gross white box. Honest claims only — every
// stat mirrors the homepage; every mockup is real work for a real dispensary.

import * as React from 'react';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
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

const eyebrow = {
  fontFamily: JP.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: 4,
  textTransform: 'uppercase', color: JP.emerald,
};
const display = { fontFamily: JP.fontDisplay, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 0.95, fontWeight: 700 };

// A faint film-grain overlay (SVG turbulence) — adds premium texture over the dark.
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

// Reveal-on-scroll: fade + rise as each block enters the viewport. Honors
// reduced-motion (shows immediately) and never blocks content if IO is missing.
function Reveal({ children, delay = 0, sx }) {
  const ref = React.useRef(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = React.useState(!!reduce);
  React.useEffect(() => {
    if (shown || typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.08 });
    io.observe(el);
    // Safety backstop: content must NEVER stay invisible. If the observer hasn't
    // fired within ~1.8s (edge browsers, odd scroll containers, capture tools),
    // reveal anyway — the animation is a bonus, visibility is non-negotiable.
    const t = setTimeout(() => setShown(true), 1800);
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

// A stylized cannabis leaf / starburst mark — pure SVG, used as faint background art.
function LeafMark({ sx }) {
  return (
    <Box component="svg" viewBox="0 0 100 100" sx={sx} aria-hidden>
      <path fill="currentColor" d="M50 4 C54 28 63 37 70 40 C60 34 55 42 50 96 C45 42 40 34 30 40 C37 37 46 28 50 4 Z M50 40 C58 30 74 24 92 26 C80 40 66 44 52 46 C60 44 54 44 50 40 Z M50 40 C42 30 26 24 8 26 C20 40 34 44 48 46 C40 44 46 44 50 40 Z" />
    </Box>
  );
}

const WHY = [
  { Icon: CampaignOutlinedIcon, t: "Ads you can't buy", d: 'Meta and Google reject cannabis. Merch is the one channel that never says no.' },
  { Icon: GroupsOutlinedIcon, t: 'Your customers advertise for you', d: 'Every branded hoodie is a walking recommendation — worn for years, not 15 seconds.' },
  { Icon: CheckroomOutlinedIcon, t: 'A shop that looks dialed-in', d: 'Matching staff apparel makes your dispensary feel legit the second someone walks in.' },
  { Icon: BoltOutlinedIcon, t: 'Built for drops & events', d: '4/20, grand openings, holidays — merch designed to move, ready when you need it.' },
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

const STATS = [
  { n: '30,000+', l: 'units delivered' },
  { n: 'Free', l: 'mockups, every time' },
  { n: '24 hr', l: 'mockup turnaround' },
  { n: 'Nationwide', l: 'we ship anywhere' },
];

const MARQUEE = ['Drop hoodies', 'Staff tees', 'Event caps', 'Grand-opening kits', 'Loyalty merch', 'Promo swag', 'Embroidered polos', 'Customer drops'];

// One blended product tile — the white photo background melts into `tint`.
function WorkTile({ w, big }) {
  return (
    <Box sx={{
      position: 'relative', borderRadius: `${JP.radius.panel}px`, overflow: 'hidden',
      background: `linear-gradient(155deg, ${w.tint[0]}, ${w.tint[1]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: big ? { xs: 340, md: '100%' } : { xs: 300, sm: 260, md: 250 },
      boxShadow: '0 30px 60px -34px rgba(0,0,0,0.7)',
      transition: 'transform .3s ease', '&:hover': { transform: 'translateY(-4px)' },
    }}>
      <Box component="img" src={w.src} alt={`${w.item} for ${w.client}${w.loc ? ` — ${w.loc}` : ''}`} loading="lazy"
        sx={{ width: big ? '74%' : '80%', maxHeight: '84%', objectFit: 'contain', mixBlendMode: 'multiply', py: 3 }} />
      <Box sx={{ position: 'absolute', left: 16, bottom: 14, zIndex: 2, pr: 2 }}>
        <Typography sx={{ ...display, fontSize: big ? 24 : 19, color: '#0b1a10', letterSpacing: 0 }}>{w.client}</Typography>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(11,26,16,0.62)' }}>
          {w.item}{w.loc ? ` · ${w.loc}` : ''}
        </Typography>
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
                The marketing you're{' '}
                <Box component="span" sx={{ color: JP.emerald }}>actually allowed</Box>{' '}
                to run.
              </Typography>
              <Typography sx={{ color: JP.onDarkMuted, maxWidth: 500, mb: 4, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.6 }}>
                Meta and Google won't touch cannabis ads. But a hoodie with your logo? It runs itself — worn around town for years. We design, print, and ship merch dispensaries are proud to put their name on.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                <Button component={RouterLink} to="/contact?topic=dispensary" variant="contained" color="cta" size="large"
                  sx={{ borderRadius: 999, px: 4, py: 1.7, textTransform: 'none', fontWeight: 700, fontSize: 16.5 }}>
                  Get a free mockup →
                </Button>
                <Button component="a" href="#work" variant="outlined" size="large"
                  sx={{ borderRadius: 999, px: 4, py: 1.7, textTransform: 'none', fontWeight: 700, fontSize: 16.5,
                    color: JP.onDark, borderColor: 'rgba(244,248,245,0.32)',
                    '&:hover': { borderColor: JP.onDark, bgcolor: 'rgba(255,255,255,0.06)' } }}>
                  See real work
                </Button>
              </Stack>
            </Reveal>

            {/* Hero spotlight — real hoodie, white blended into the tile */}
            <Reveal delay={120} sx={{ position: 'relative' }}>
              <LeafMark sx={{ position: 'absolute', width: { xs: 180, md: 260 }, top: -30, right: -20, color: JP.emerald, opacity: 0.12, zIndex: 0 }} />
              <Box sx={{
                position: 'relative', zIndex: 1, borderRadius: `${JP.radius.panel + 6}px`, p: { xs: 2.5, md: 3.5 },
                background: 'radial-gradient(120% 120% at 50% 0%, #eafaef, #d3edda)',
                boxShadow: '0 50px 100px -40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
                maxWidth: 460, mx: 'auto',
              }}>
                <Box component="img" src="/work/premier-high-life-hoodie.png"
                  alt="Custom branded hoodie we printed for Premier High Life, a cannabis dispensary"
                  sx={{ display: 'block', width: '100%', mixBlendMode: 'multiply' }} />
                <Box sx={{ position: 'absolute', left: { xs: 16, md: 22 }, bottom: { xs: 16, md: 22 },
                  display: 'flex', alignItems: 'center', gap: 1, bgcolor: JP.ink, borderRadius: 999, px: 2, py: 0.9,
                  boxShadow: '0 12px 24px -12px rgba(0,0,0,0.7)' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: JP.emerald }} />
                  <Typography sx={{ color: JP.onDark, fontSize: 12.5, fontWeight: 700 }}>Real drop · Premier High Life</Typography>
                </Box>
              </Box>
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

        {/* ── WHY MERCH ────────────────────────────────────────── */}
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 13 } }}>
          <Reveal>
            <Typography sx={eyebrow}>Why merch, why now</Typography>
            <Typography component="h2" sx={{ ...display, mt: 1.5, mb: 2, fontSize: { xs: 32, md: 52 }, maxWidth: 860 }}>
              You're marketing with one hand tied behind your back. Merch is the other hand.
            </Typography>
          </Reveal>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 2.5, mt: 4 }}>
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

        {/* ── STATS ────────────────────────────────────────────── */}
        <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>
          <Reveal>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 3,
              p: { xs: 3, md: 4 }, borderRadius: `${JP.radius.panel}px`, border: '1px solid rgba(244,248,245,0.1)',
              bgcolor: 'rgba(255,255,255,0.02)' }}>
              {STATS.map((s) => (
                <Box key={s.l} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ ...display, fontSize: { xs: 32, md: 48 }, color: JP.emerald }}>{s.n}</Typography>
                  <Typography sx={{ color: JP.onDarkMuted, fontSize: 12.5, mt: 1, textTransform: 'uppercase', letterSpacing: 1.4 }}>{s.l}</Typography>
                </Box>
              ))}
            </Box>
          </Reveal>
        </Container>
      </Box>

      {/* Shared process + book-a-call CTA (their own light/dark sections) */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <ProductHowItWorks />
        <ProductSmokingHero />
      </Box>
    </Box>
  );
}
