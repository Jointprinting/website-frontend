// src/screens/AtomLanding.js
//
// JP ATOM — the landing page (/atom). Its own brand (violet-on-ink, atom
// glyph), deliberately separate from Joint Printing's marketing site and JP
// Webworks: bare chrome, no shared nav. The page's one job: make a
// custom-merch shop owner feel "I need this" and click into the live demo
// (/atom/demo) or email. Pricing is the agreed founding offer: $995 setup +
// $295/mo (list $2,495 / $495 shown crossed out). Custom builds stay
// open-ended by design — the studio is living software.

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Stack, Typography, Button } from '@mui/material';

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

const CONTACT = 'mailto:nate@jointprinting.com?subject=JP%20Atom%20—%20tell%20me%20more';

const primaryBtn = {
  bgcolor: A.violet, color: A.ink, fontWeight: 800, textTransform: 'none', fontSize: 15,
  px: 3.5, py: 1.4, borderRadius: 999, letterSpacing: 0.2,
  boxShadow: `0 8px 32px ${A.glow}`,
  '&:hover': { bgcolor: '#b8a3fb', boxShadow: `0 10px 40px ${A.glow}` },
};
const ghostBtn = {
  color: A.text, fontWeight: 700, textTransform: 'none', fontSize: 15, px: 3, py: 1.3,
  borderRadius: 999, border: `1px solid ${A.line}`,
  '&:hover': { borderColor: A.lineHi, bgcolor: 'rgba(167,139,250,0.08)' },
};

// The atom mark — pure CSS/SVG, no asset needed.
export function AtomMark({ size = 34 }) {
  return (
    <Box component="svg" viewBox="0 0 48 48" sx={{ width: size, height: size, flexShrink: 0 }} aria-hidden>
      <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke={A.violet} strokeWidth="2" />
      <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke={A.violet} strokeWidth="2" transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke={A.violet} strokeWidth="2" transform="rotate(120 24 24)" />
      <circle cx="24" cy="24" r="4" fill={A.violet} />
    </Box>
  );
}

const PAINS = [
  { emoji: '🧾', title: 'Quotes live in spreadsheets', body: 'Margins guessed, versions everywhere, one typo away from working a job for free.' },
  { emoji: '📱', title: '"Did they approve it yet?"', body: 'Proofs buried in texts and email threads. Clients ask you for status — because they have nowhere to look.' },
  { emoji: '🗂️', title: 'Seventeen tools, zero system', body: 'CRM here, invoices there, orders in your head. Nothing talks to anything, and you are the glue.' },
];

const FEATURES = [
  { emoji: '🧲', title: 'Pipeline that runs itself', body: 'Every job is a deal card. Share the quote → it moves to Quote sent. Deliver the order → it wins. You never drag a card you didn’t mean to.' },
  { emoji: '💰', title: 'Margin-true quoting', body: 'Click 30% and every option prices to a real 30% margin — with your total profit on the chip before you send it. No markup-vs-margin traps.' },
  { emoji: '✍️', title: 'One-link client approvals', body: 'Clients pick options, approve the proof, and pay-choice on one branded page. You see every view and sign-off.' },
  { emoji: '🚚', title: 'Orders that update themselves', body: 'Paste a UPS link once — the tracker ticks itself, your client’s page updates, and the deal auto-wins on delivery.' },
  { emoji: '🧮', title: 'Books that keep themselves', body: 'Photograph a receipt and it books itself into the ledger — categorized, linked to the job, P&L per order.' },
  { emoji: '🗺️', title: 'A road mode for field sales', body: 'Plan a route, log visits at the counter, send catalogs that night, and get the follow-up call booked automatically. Works offline.' },
];

const INCLUDED = [
  'Your own private studio — CRM, quoter, orders, approvals, finances, content planner',
  'Your branding on every client-facing page',
  'Data import from your spreadsheets',
  'White-glove onboarding + a walkthrough call',
  'Hosting, backups, and updates handled',
  'Direct line to the builder — not a ticket queue',
];

export default function AtomLanding() {
  React.useEffect(() => { document.title = 'JP Atom — run your whole merch business from one studio'; }, []);
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: A.bg, color: A.text, position: 'relative', overflow: 'hidden' }}>
      {/* ambient glow */}
      <Box sx={{ position: 'absolute', top: -260, left: '50%', transform: 'translateX(-50%)', width: 1000, height: 520,
        borderRadius: '50%', background: A.glow, filter: 'blur(110px)', pointerEvents: 'none' }} />

      <Box sx={{ maxWidth: 1060, mx: 'auto', px: { xs: 2.5, md: 4 }, position: 'relative' }}>

        {/* Nav */}
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 3 }}>
          <AtomMark size={30} />
          <Typography sx={{ fontWeight: 900, fontSize: 19, letterSpacing: -0.3 }}>JP&nbsp;Atom</Typography>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/atom/demo" sx={{ ...ghostBtn, fontSize: 13.5, px: 2, py: 0.7, display: { xs: 'none', sm: 'inline-flex' } }}>
            Live demo
          </Button>
          <Button component="a" href={CONTACT} sx={{ ...primaryBtn, fontSize: 13.5, px: 2.25, py: 0.7, boxShadow: 'none' }}>
            Get started
          </Button>
        </Stack>

        {/* Hero */}
        <Box sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 7, md: 10 }, textAlign: 'center' }}>
          <Typography sx={{ ...atomMono, color: A.violet, fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', mb: 2 }}>
            For custom-merch shops & promo distributors
          </Typography>
          <Typography component="h1" sx={{ fontSize: { xs: 38, md: 58 }, fontWeight: 900, lineHeight: 1.06, letterSpacing: -1.5, maxWidth: 820, mx: 'auto' }}>
            Run your whole merch business from{' '}
            <Box component="span" sx={{ color: A.violet }}>one studio</Box>.
          </Typography>
          <Typography sx={{ color: A.muted, fontSize: { xs: 16, md: 18.5 }, lineHeight: 1.6, maxWidth: 640, mx: 'auto', mt: 2.5 }}>
            CRM, margin-true quoting, client approvals, order tracking, books that keep
            themselves — wired together the way a print shop actually works. Not seventeen tabs.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="center" sx={{ mt: 4.5 }}>
            <Button component={RouterLink} to="/atom/demo" sx={primaryBtn}>▶&nbsp; Play with the live demo</Button>
            <Button component="a" href="#pricing" sx={ghostBtn}>Founding pricing</Button>
          </Stack>
          <Typography sx={{ color: A.faint, fontSize: 12.5, mt: 3 }}>
            Built and battle-tested every day inside a real merch shop.
          </Typography>
        </Box>

        {/* Pain */}
        <Box sx={{ pb: { xs: 7, md: 9 } }}>
          <Typography sx={{ textAlign: 'center', color: A.faint, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', mb: 3, ...atomMono }}>
            Sound familiar?
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' } }}>
            {PAINS.map((p) => (
              <Box key={p.title} sx={{ bgcolor: A.panel, border: `1px solid ${A.line}`, borderRadius: 3, p: 3 }}>
                <Typography sx={{ fontSize: 26, mb: 1 }}>{p.emoji}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.75 }}>{p.title}</Typography>
                <Typography sx={{ color: A.muted, fontSize: 13.5, lineHeight: 1.6 }}>{p.body}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Features */}
        <Box sx={{ pb: { xs: 7, md: 9 } }}>
          <Typography sx={{ textAlign: 'center', fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 1 }}>
            One system. The whole shop.
          </Typography>
          <Typography sx={{ textAlign: 'center', color: A.muted, fontSize: 15, mb: 4.5, maxWidth: 560, mx: 'auto' }}>
            Every tool below already runs a working merch business daily — this isn’t a mockup of software we might build.
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' } }}>
            {FEATURES.map((f) => (
              <Box key={f.title} sx={{ bgcolor: A.panel, border: `1px solid ${A.line}`, borderRadius: 3, p: 3,
                transition: 'transform .18s ease, border-color .18s ease',
                '&:hover': { transform: 'translateY(-3px)', borderColor: A.lineHi } }}>
                <Typography sx={{ fontSize: 24, mb: 1 }}>{f.emoji}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 15.5, mb: 0.75 }}>{f.title}</Typography>
                <Typography sx={{ color: A.muted, fontSize: 13, lineHeight: 1.6 }}>{f.body}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Demo band */}
        <Box sx={{ pb: { xs: 7, md: 9 } }}>
          <Box sx={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: `1px solid ${A.lineHi}`,
            background: `linear-gradient(160deg, ${A.panelHi}, ${A.panel})`, p: { xs: 3.5, md: 6 }, textAlign: 'center',
            boxShadow: `0 30px 80px ${A.glow}` }}>
            <AtomMark size={44} />
            <Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 900, letterSpacing: -0.7, mt: 1.5 }}>
              Don’t take the tour. Drive it.
            </Typography>
            <Typography sx={{ color: A.muted, fontSize: 15, maxWidth: 520, mx: 'auto', mt: 1.25, lineHeight: 1.6 }}>
              The demo is the real interface on sample data — click margin chips and watch profit
              recompute, walk a client’s approval page, see an order deliver itself.
            </Typography>
            <Button component={RouterLink} to="/atom/demo" sx={{ ...primaryBtn, mt: 3.5 }}>Open the demo studio →</Button>
          </Box>
        </Box>

        {/* Pricing */}
        <Box id="pricing" sx={{ pb: { xs: 7, md: 9 } }}>
          <Box sx={{ maxWidth: 560, mx: 'auto', bgcolor: A.panel, border: `1px solid ${A.line}`, borderRadius: 4, p: { xs: 3, md: 4.5 }, textAlign: 'center' }}>
            <Typography sx={{ ...atomMono, color: A.amber, fontSize: 11.5, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase' }}>
              Founding partner pricing
            </Typography>
            <Stack direction="row" justifyContent="center" alignItems="baseline" gap={1.5} sx={{ mt: 2 }}>
              <Typography sx={{ color: A.faint, fontSize: 20, textDecoration: 'line-through', ...atomMono }}>$2,495</Typography>
              <Typography sx={{ fontSize: 44, fontWeight: 900, letterSpacing: -1, ...atomMono }}>$995</Typography>
              <Typography sx={{ color: A.muted, fontSize: 15 }}>setup</Typography>
            </Stack>
            <Stack direction="row" justifyContent="center" alignItems="baseline" gap={1.5} sx={{ mt: 0.5 }}>
              <Typography sx={{ color: A.faint, fontSize: 16, textDecoration: 'line-through', ...atomMono }}>$495</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900, ...atomMono }}>$295</Typography>
              <Typography sx={{ color: A.muted, fontSize: 15 }}>/ month</Typography>
            </Stack>
            <Box sx={{ textAlign: 'left', mt: 3, mx: 'auto', maxWidth: 420 }}>
              {INCLUDED.map((line) => (
                <Typography key={line} sx={{ color: A.muted, fontSize: 13.5, py: 0.5, pl: 3, position: 'relative', lineHeight: 1.5,
                  '&::before': { content: '"✓"', position: 'absolute', left: 4, color: A.green, fontWeight: 900 } }}>
                  {line}
                </Typography>
              ))}
            </Box>
            <Button component="a" href={CONTACT} sx={{ ...primaryBtn, mt: 3.5, width: '100%' }}>Claim founding pricing</Button>
            <Typography sx={{ color: A.faint, fontSize: 11.5, mt: 1.5 }}>
              Founding rate locks in for as long as you stay. No contracts — cancel anytime.
            </Typography>
          </Box>
        </Box>

        {/* Custom builds — deliberately open-ended */}
        <Box sx={{ pb: { xs: 8, md: 11 } }}>
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 900, letterSpacing: -0.7 }}>
                Your shop isn’t cookie-cutter.<br />Your studio shouldn’t be either.
              </Typography>
              <Typography sx={{ color: A.muted, fontSize: 15, lineHeight: 1.65, mt: 2 }}>
                JP Atom is living software. Run embroidery with three outsourced printers? Sell into a
                niche with its own compliance dates? Want your vendor catalogs quotable in one click?
                Tell us how your shop actually runs — we build your workflow in, and it ships to your
                studio in days, not quarters.
              </Typography>
              <Button component="a" href={CONTACT} sx={{ ...ghostBtn, mt: 3 }}>Tell us about your shop →</Button>
            </Box>
            <Box sx={{ bgcolor: A.panel, border: `1px solid ${A.line}`, borderRadius: 3, p: 3 }}>
              {['“Can it import my S&S order history?”', '“We invoice 50% up front — can it do deposits?”', '“Our reps need it on a phone, offline.”']
                .map((q) => (
                  <Typography key={q} sx={{ color: A.text, fontSize: 14, fontWeight: 700, py: 1.1, pl: 3, position: 'relative',
                    borderBottom: `1px solid ${A.line}`, '&:last-of-type': { borderBottom: 'none' },
                    '&::before': { content: '"→"', position: 'absolute', left: 2, color: A.violet, fontWeight: 900 } }}>
                    {q}
                  </Typography>
                ))}
              <Typography sx={{ color: A.green, fontSize: 13.5, fontWeight: 800, mt: 1.5 }}>Yes. That’s the point.</Typography>
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ borderTop: `1px solid ${A.line}`, py: 4, textAlign: 'center' }}>
          <Typography sx={{ color: A.faint, fontSize: 12.5 }}>
            JP Atom · by the team behind Joint Printing · nate@jointprinting.com
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
