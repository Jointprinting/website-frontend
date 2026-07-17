// src/screens/AtomLanding.js
//
// JP ATOM — the landing page (/atom). Own brand (violet box mark, ink ground),
// fully separate from Joint Printing's marketing site and JP Webworks.
// v2 principle: SHOW, don't tell — the hero is a living, auto-playing slice of
// the studio (pipeline card moves itself → quoter reprices at a margin click →
// order auto-delivers), and almost every paragraph from v1 is gone. One job:
// get them into /atom/demo or /atom/contact.

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Stack, Typography, Button } from '@mui/material';
import markJpn from '../modules/images/mark_jpn.png';

// JP Atom brand tokens — violet on deep ink. Sibling of, not the same as,
// Joint Printing's green Studio.
export const A = {
  bg: '#0b0a12', panel: '#131126', panelHi: '#1a1732',
  line: 'rgba(255,255,255,0.09)', lineHi: 'rgba(167,139,250,0.5)',
  violet: '#a78bfa', violetDeep: '#7c3aed', glow: 'rgba(139,92,246,0.28)',
  text: '#f3f1fb', muted: 'rgba(255,255,255,0.64)', faint: 'rgba(255,255,255,0.42)',
  green: '#4ade80', amber: '#fbbf24', ink: '#0b0a12',
};
export const atomMono = { fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };

// The REAL mark — the JP box recolored violet (same family as Joint Printing
// green and Webworks blue; see src/common/BrandCube.js).
export function AtomLogo({ size = 34, style }) {
  return <img src={markJpn} alt="JP Atom" width={size} height={size}
    style={{ display: 'block', flexShrink: 0, objectFit: 'contain', ...style }} />;
}

export const atomPrimaryBtn = {
  bgcolor: A.violet, color: A.ink, fontWeight: 800, textTransform: 'none', fontSize: 15,
  px: 3.5, py: 1.4, borderRadius: 999, letterSpacing: 0.2,
  boxShadow: `0 8px 32px ${A.glow}`,
  '&:hover': { bgcolor: '#b8a3fb', boxShadow: `0 10px 40px ${A.glow}` },
};
export const atomGhostBtn = {
  color: A.text, fontWeight: 700, textTransform: 'none', fontSize: 15, px: 3, py: 1.3,
  borderRadius: 999, border: `1px solid ${A.line}`,
  '&:hover': { borderColor: A.lineHi, bgcolor: 'rgba(167,139,250,0.08)' },
};

const FX = {
  '@keyframes atomSlideIn': { from: { transform: 'translateX(-14px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
  '@keyframes atomTickL': { '0%': { transform: 'scale(0.4)', opacity: 0 }, '60%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
  '@keyframes atomFadeL': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
};

/* ── The living hero: three auto-playing scenes on loop.
      Scene 0 — a deal card moves itself to Quote sent.
      Scene 1 — a margin chip "clicks" and every number reprices.
      Scene 2 — an order ticks itself to auto-delivered and the deal wins.
   Clicking anywhere jumps into the real drivable demo.                    */
function LiveShowcase() {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBeat((b) => b + 1), 1400);
    return () => clearInterval(t);
  }, []);
  const scene = Math.floor(beat / 3) % 3;
  const step = beat % 3;

  const label = { ...atomMono, fontSize: 9.5, letterSpacing: 1.8, textTransform: 'uppercase', color: A.faint, fontWeight: 700 };
  const margins = [25, 30, 35];
  const m = margins[step] / 100;
  const price = 6.1 / (1 - m);

  return (
    <Box component={RouterLink} to="/atom/demo" aria-label="Open the live demo"
      sx={{ display: 'block', textDecoration: 'none', cursor: 'pointer', ...FX,
        border: `1px solid ${A.line}`, borderRadius: 4, overflow: 'hidden',
        bgcolor: A.panel, boxShadow: `0 30px 90px rgba(0,0,0,0.5), 0 0 60px ${A.glow}`,
        transition: 'transform .25s ease, box-shadow .25s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 36px 100px rgba(0,0,0,0.55), 0 0 80px ${A.glow}` } }}>
      {/* window chrome */}
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ px: 1.75, py: 1, borderBottom: `1px solid ${A.line}` }}>
        {['#f87171', '#fbbf24', '#4ade80'].map((c) => <Box key={c} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c, opacity: 0.8 }} />)}
        <Typography sx={{ ...atomMono, color: A.faint, fontSize: 10.5, ml: 1 }}>
          {scene === 0 ? 'pipeline — the card moves itself' : scene === 1 ? 'quoter — one click reprices everything' : 'orders — UPS delivers, the deal wins'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ ...atomMono, color: A.violet, fontSize: 10, fontWeight: 700 }}>▶ drive it</Typography>
      </Stack>

      <Box sx={{ p: { xs: 2, sm: 2.5 }, minHeight: 238, color: A.text }}>
        {scene === 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, animation: 'atomFadeL .4s ease' }}>
            {['Quoting', 'Quote sent', 'Won'].map((col) => (
              <Box key={col} sx={{ border: `1px solid ${A.line}`, borderRadius: 2.5, p: 1, minHeight: 190, bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography sx={{ ...label, mb: 0.75, display: 'block', color: col === 'Won' ? A.green : A.faint }}>{col}</Typography>
                {col === 'Quoting' && step === 0 && (
                  <DemoCard name="Summit Coffee Co." sub="250 tees · 3-color" val="$2,975" pulse />
                )}
                {col === 'Quote sent' && step >= 1 && (
                  <DemoCard name="Summit Coffee Co." sub="250 tees · 3-color" val="$2,975" enter chip="moved itself" />
                )}
                {col === 'Quote sent' && <DemoCard name="Riverside Brewing" sub="500 pint glasses" val="$2,450" dim />}
                {col === 'Won' && <DemoCard name="Harbor Records" sub="300 totes" val="$1,890" dim win />}
              </Box>
            ))}
          </Box>
        )}
        {scene === 1 && (
          <Box sx={{ animation: 'atomFadeL .4s ease' }}>
            <Stack direction="row" gap={0.75} mb={1.5} flexWrap="wrap">
              {margins.map((pc, i) => (
                <Box key={pc} sx={{ px: 1.75, py: 0.6, borderRadius: 999, ...atomMono, fontSize: 13, fontWeight: 800,
                  bgcolor: i === step ? A.violet : 'rgba(255,255,255,0.05)',
                  color: i === step ? A.ink : A.muted,
                  border: `1px solid ${i === step ? A.violet : A.line}`,
                  transition: 'all .3s ease', ...(i === step ? { animation: 'atomTickL .4s ease' } : {}) }}>
                  {pc}%
                </Box>
              ))}
              <Typography sx={{ ...label, alignSelf: 'center', ml: 0.5 }}>true margin — not markup</Typography>
            </Stack>
            <Box key={step} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, animation: 'atomFadeL .35s ease' }}>
              {[100, 250, 500].map((q) => (
                <Box key={q} sx={{ border: `1px solid ${A.line}`, borderRadius: 2.5, p: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <Typography sx={label}>{q} units</Typography>
                  <Typography sx={{ ...atomMono, fontSize: 21, fontWeight: 800, mt: 0.5 }}>${price.toFixed(2)}</Typography>
                  <Typography sx={{ ...atomMono, fontSize: 11, color: A.green, fontWeight: 700, mt: 0.25 }}>
                    +${Math.round((price - 6.1) * q).toLocaleString()} profit
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        {scene === 2 && (
          <Box sx={{ animation: 'atomFadeL .4s ease' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1.25 }}>Riverside Brewing · order #1042</Typography>
            <Stack gap={1}>
              {[['Order placed', true], ['In production', true], ['Shipped — UPS linked', step >= 1], ['Delivered', step >= 2]].map(([lbl, on], i) => (
                <Stack key={lbl} direction="row" alignItems="center" gap={1.25}>
                  <Box sx={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 900, color: A.ink, flexShrink: 0,
                    bgcolor: on ? (i === 3 ? A.green : A.violet) : 'rgba(255,255,255,0.08)',
                    ...(on ? { animation: 'atomTickL .4s ease' } : {}) }}>
                    {on ? '✓' : ''}
                  </Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? A.text : A.faint }}>
                    {lbl}
                    {i === 3 && on && (
                      <Box component="span" sx={{ ...atomMono, ml: 1, fontSize: 10, color: A.green }}>auto-delivered via UPS — deal won 🏆</Box>
                    )}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Typography sx={{ ...label, mt: 1.5, display: 'block' }}>nobody touched anything after the link was pasted</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function DemoCard({ name, sub, val, dim, win, pulse, enter, chip }) {
  return (
    <Box sx={{ border: `1px solid ${A.line}`, borderRadius: 2, p: 1.1, mb: 0.75, bgcolor: A.panelHi,
      opacity: dim ? 0.55 : 1, ...(enter ? { animation: 'atomSlideIn .5s ease' } : {}) }}>
      <Typography sx={{ fontWeight: 800, fontSize: 12 }}>{name}</Typography>
      <Typography sx={{ color: A.muted, fontSize: 10.5 }}>{sub}</Typography>
      <Stack direction="row" alignItems="center" gap={0.75} mt={0.4}>
        <Typography sx={{ ...atomMono, color: win ? A.green : A.violet, fontSize: 11.5, fontWeight: 700 }}>{val}</Typography>
        {pulse && <Box sx={{ px: 1, py: 0.1, borderRadius: 999, bgcolor: A.violet, color: A.ink, fontSize: 9, fontWeight: 800 }}>Share quote →</Box>}
        {chip && <Typography sx={{ ...atomMono, fontSize: 9, color: A.violet }}>{chip}</Typography>}
      </Stack>
    </Box>
  );
}

const CAPABILITIES = [
  ['🧲', 'Pipeline'], ['💰', 'Margin-true quoter'], ['✍️', 'One-link approvals'],
  ['🚚', 'Self-updating orders'], ['🧮', 'Books that keep themselves'], ['🗺️', 'Field-sales mode'],
];

export default function AtomLanding() {
  useEffect(() => { document.title = 'JP Atom — the studio your merch shop runs on'; }, []);
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: A.bg, color: A.text, position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: -260, left: '50%', transform: 'translateX(-50%)', width: 1000, height: 520,
        borderRadius: '50%', background: A.glow, filter: 'blur(110px)', pointerEvents: 'none' }} />

      <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2.5, md: 4 }, position: 'relative' }}>

        {/* Nav */}
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 3 }}>
          <AtomLogo size={34} />
          <Typography sx={{ fontWeight: 900, fontSize: 19, letterSpacing: -0.3 }}>JP&nbsp;Atom</Typography>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/atom/demo" sx={{ ...atomGhostBtn, fontSize: 13.5, px: 2, py: 0.7, display: { xs: 'none', sm: 'inline-flex' } }}>
            Live demo
          </Button>
          <Button component={RouterLink} to="/atom/contact" sx={{ ...atomPrimaryBtn, fontSize: 13.5, px: 2.25, py: 0.7, boxShadow: 'none' }}>
            Get started
          </Button>
        </Stack>

        {/* Hero — one line of words, then the product itself, running. */}
        <Box sx={{ pt: { xs: 4, md: 6 }, pb: { xs: 3, md: 4 }, textAlign: 'center' }}>
          <Typography sx={{ ...atomMono, color: A.violet, fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', mb: 2 }}>
            For custom-merch shops & promo distributors
          </Typography>
          <Typography component="h1" sx={{ fontSize: { xs: 36, md: 54 }, fontWeight: 900, lineHeight: 1.06, letterSpacing: -1.5, maxWidth: 780, mx: 'auto' }}>
            The studio your merch business{' '}
            <Box component="span" sx={{ color: A.violet }}>runs itself on</Box>.
          </Typography>
          <Typography sx={{ color: A.muted, fontSize: { xs: 15, md: 17 }, maxWidth: 520, mx: 'auto', mt: 2 }}>
            This is it, below — live. Watch it work, then drive it.
          </Typography>
        </Box>

        <Box sx={{ maxWidth: 780, mx: 'auto' }}>
          <LiveShowcase />
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="center" sx={{ mt: 4 }}>
          <Button component={RouterLink} to="/atom/demo" sx={atomPrimaryBtn}>▶&nbsp; Drive the live demo</Button>
          <Button component={RouterLink} to="/atom/contact" sx={atomGhostBtn}>Get it for your shop</Button>
        </Stack>
        <Typography sx={{ color: A.faint, fontSize: 12.5, mt: 2.5, textAlign: 'center' }}>
          Built and battle-tested every day inside a real merch shop.
        </Typography>

        {/* Capabilities — words, not paragraphs. The demo carries the detail. */}
        <Stack direction="row" gap={1} justifyContent="center" flexWrap="wrap" sx={{ mt: 7, mb: 2 }}>
          {CAPABILITIES.map(([emoji, name]) => (
            <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2, py: 1,
              borderRadius: 999, border: `1px solid ${A.line}`, bgcolor: A.panel }}>
              <Box component="span" sx={{ fontSize: 15 }} aria-hidden>{emoji}</Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{name}</Typography>
            </Box>
          ))}
        </Stack>
        <Typography sx={{ color: A.faint, fontSize: 12.5, textAlign: 'center' }}>
          One studio. Every piece talks to every other piece.
        </Typography>

        {/* Pricing — founding offer, no essay. */}
        <Box id="pricing" sx={{ maxWidth: 560, mx: 'auto', mt: 8, mb: 6, p: { xs: 3, md: 4 }, textAlign: 'center',
          bgcolor: A.panel, border: `1px solid ${A.lineHi}`, borderRadius: 4, boxShadow: `0 0 60px ${A.glow}` }}>
          <Typography sx={{ ...atomMono, color: A.violet, fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase' }}>
            Founding pricing — first shops only
          </Typography>
          <Stack direction="row" gap={3} justifyContent="center" alignItems="baseline" sx={{ mt: 2 }}>
            <Box>
              <Typography sx={{ ...atomMono, color: A.faint, fontSize: 14, textDecoration: 'line-through' }}>$2,495</Typography>
              <Typography sx={{ ...atomMono, fontSize: 34, fontWeight: 800 }}>$999</Typography>
              <Typography sx={{ color: A.muted, fontSize: 12 }}>setup — yours, branded</Typography>
            </Box>
            <Typography sx={{ color: A.faint, fontSize: 22 }}>+</Typography>
            <Box>
              <Typography sx={{ ...atomMono, color: A.faint, fontSize: 14, textDecoration: 'line-through' }}>$495</Typography>
              <Typography sx={{ ...atomMono, fontSize: 34, fontWeight: 800 }}>$299<Typography component="span" sx={{ fontSize: 14, color: A.muted }}>/mo</Typography></Typography>
              <Typography sx={{ color: A.muted, fontSize: 12 }}>everything, hosted + updated</Typography>
            </Box>
          </Stack>
          <Typography sx={{ color: A.muted, fontSize: 13, mt: 2 }}>
            Data import, white-glove onboarding, your branding on every client page —
            and <b>custom builds are the point</b>: the studio grows around your shop.
          </Typography>
          <Button component={RouterLink} to="/atom/contact" sx={{ ...atomPrimaryBtn, mt: 2.5 }}>
            Claim founding pricing
          </Button>
        </Box>

        <Typography sx={{ color: A.faint, fontSize: 12, textAlign: 'center', pb: 5 }}>
          JP Atom · by the team behind Joint Printing ·{' '}
          <Box component={RouterLink} to="/atom/contact" sx={{ color: A.violet, fontWeight: 700, textDecoration: 'none' }}>talk to us</Box>
        </Typography>
      </Box>
    </Box>
  );
}
