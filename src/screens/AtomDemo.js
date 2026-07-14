// src/screens/AtomDemo.js
//
// JP ATOM — the guided live demo (/atom/demo). Not a video, not screenshots:
// a sandbox with fake merch clients where every stop DOES something. Four
// stops — Pipeline, Quoter, Orders, Client view — each with one interaction
// that shows the studio moving by itself (share a quote → the stage moves;
// pick a margin → every price recomputes; run an order → UPS delivers it and
// the deal wins; approve as the client → the shop sees it). Same violet brand
// tokens as the landing page; bare chrome like /approve.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Stack, Typography, Button, Chip } from '@mui/material';
import { A, atomMono, AtomMark } from './AtomLanding';

const CONTACT = 'mailto:nate@jointprinting.com?subject=JP%20Atom%20—%20I%20drove%20the%20demo';
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

// One keyframe kit for the whole demo.
const FX = {
  '@keyframes atomPop': { from: { transform: 'scale(0.92)', opacity: 0.2, boxShadow: `0 0 0 10px ${A.glow}` }, to: { transform: 'scale(1)', opacity: 1, boxShadow: '0 0 0 0 rgba(0,0,0,0)' } },
  '@keyframes atomRise': { from: { transform: 'translateY(10px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
  '@keyframes atomTick': { '0%': { transform: 'scale(0.4)', opacity: 0 }, '60%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
  '@keyframes atomGlowPulse': { '0%': { boxShadow: `0 0 0 0 ${A.glow}` }, '70%': { boxShadow: '0 0 0 14px rgba(139,92,246,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(139,92,246,0)' } },
};

const card = {
  bgcolor: A.panel, border: `1px solid ${A.line}`, borderRadius: 3, p: 2,
};
const eyebrow = { ...atomMono, color: A.violet, fontSize: 11, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase' };

/* ────────────────────────────────────────────────────────────────────────────
   Stop 1 — PIPELINE. Fake deals in real stages; "Share quote" moves the card
   by itself, which is the whole pitch: stages you never drag.               */

const STAGES = [
  { key: 'details_needed', label: 'Details needed' },
  { key: 'quoting', label: 'Quoting' },
  { key: 'quote_sent', label: 'Quote sent' },
  { key: 'won', label: 'Won' },
];
const SEED_DEALS = [
  { id: 1, client: 'Summit Coffee Co.', item: '250 tees · 3-color front', value: 2975, stage: 'quoting', star: true },
  { id: 2, client: 'Ironworks Gym', item: '120 hoodies + caps', value: 4180, stage: 'details_needed' },
  { id: 3, client: 'Riverside Brewing', item: '500 pint glasses', value: 2450, stage: 'quote_sent' },
  { id: 4, client: 'Bloom Yoga', item: '80 embroidered crewnecks', value: 2320, stage: 'quoting' },
  { id: 5, client: 'Harbor Records', item: '300 totes, 2-sided', value: 1890, stage: 'won' },
  { id: 6, client: 'Northside Little League', item: '150 jerseys', value: 3300, stage: 'details_needed' },
];

function PipelineStop() {
  const [deals, setDeals] = useState(SEED_DEALS);
  const [movedId, setMovedId] = useState(null);
  const share = (id) => {
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stage: 'quote_sent' } : d)));
    setMovedId(id);
  };
  const shared = deals.find((d) => d.star)?.stage === 'quote_sent';
  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, ...FX }}>
        {STAGES.map((s) => {
          const cards = deals.filter((d) => d.stage === s.key);
          const total = cards.reduce((t, d) => t + d.value, 0);
          return (
            <Box key={s.key} sx={{ bgcolor: 'rgba(255,255,255,0.025)', border: `1px solid ${A.line}`, borderRadius: 3, p: 1.25, minHeight: 200 }}>
              <Stack direction="row" alignItems="baseline" gap={0.75} sx={{ px: 0.5, mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: s.key === 'won' ? A.green : A.text }}>{s.label}</Typography>
                <Typography sx={{ ...atomMono, color: A.faint, fontSize: 11 }}>{cards.length}</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ ...atomMono, color: A.faint, fontSize: 10.5 }}>{money0(total)}</Typography>
              </Stack>
              <Stack gap={1}>
                {cards.map((d) => (
                  <Box key={d.id} sx={{ ...card, p: 1.25, borderRadius: 2.5,
                    ...(d.id === movedId ? { animation: 'atomPop 0.6s ease', borderColor: A.lineHi } : {}) }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 12.5 }}>{d.client}</Typography>
                    <Typography sx={{ color: A.muted, fontSize: 11, mt: 0.25 }}>{d.item}</Typography>
                    <Stack direction="row" alignItems="center" sx={{ mt: 0.75 }}>
                      <Typography sx={{ ...atomMono, color: d.stage === 'won' ? A.green : A.violet, fontSize: 12, fontWeight: 700 }}>{money0(d.value)}</Typography>
                      <Box sx={{ flex: 1 }} />
                      {d.star && d.stage === 'quoting' && (
                        <Button size="small" onClick={() => share(d.id)}
                          sx={{ bgcolor: A.violet, color: A.ink, fontWeight: 800, fontSize: 10.5, textTransform: 'none',
                            px: 1.25, py: 0.2, borderRadius: 999, animation: 'atomGlowPulse 1.8s ease infinite',
                            '&:hover': { bgcolor: '#b8a3fb' } }}>
                          Share quote →
                        </Button>
                      )}
                      {d.id === movedId && <Chip size="small" label="moved itself" sx={{ ...atomMono, bgcolor: 'rgba(167,139,250,0.14)', color: A.violet, fontSize: 9.5, height: 18 }} />}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ color: shared ? A.green : A.faint, fontSize: 12.5, mt: 1.5, transition: 'color 0.4s' }}>
        {shared
          ? '✓ You shared the quote — the deal moved to Quote sent on its own. Deliver the order later and it wins itself.'
          : 'Try it: hit “Share quote” on Summit Coffee. You never drag cards — the work moves them.'}
      </Typography>
    </Box>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Stop 2 — QUOTER. Margin chips recompute every tier + the profit chip live.
   price = cost / (1 − margin): margin-true, the demo's sharpest hook.       */

const TIERS = [
  { qty: 100, cost: 6.8 },
  { qty: 250, cost: 6.1 },
  { qty: 500, cost: 5.45 },
];
const MARGINS = [0.25, 0.3, 0.35, 0.4];

function QuoterStop() {
  const [margin, setMargin] = useState(0.3);
  const [flash, setFlash] = useState(0);
  const rows = useMemo(() => TIERS.map((t) => {
    const price = t.cost / (1 - margin);
    return { ...t, price, profit: (price - t.cost) * t.qty };
  }), [margin]);
  const best = rows[rows.length - 1];
  const pick = (m) => { setMargin(m); setFlash((f) => f + 1); };
  return (
    <Box sx={FX}>
      <Box sx={{ ...card, p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Custom tee · 3-color front print</Typography>
            <Typography sx={{ color: A.muted, fontSize: 12, mt: 0.25 }}>Summit Coffee Co. · three run sizes pitched at once</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" gap={0.75}>
            {MARGINS.map((m) => (
              <Chip key={m} label={`${Math.round(m * 100)}%`} onClick={() => pick(m)}
                sx={{ ...atomMono, fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                  bgcolor: m === margin ? A.violet : 'rgba(255,255,255,0.05)',
                  color: m === margin ? A.ink : A.muted,
                  border: `1px solid ${m === margin ? A.violet : A.line}`,
                  '&:hover': { bgcolor: m === margin ? A.violet : 'rgba(167,139,250,0.14)' } }} />
            ))}
          </Stack>
        </Stack>

        <Box key={flash} sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25, animation: 'atomRise 0.35s ease' }}>
          {rows.map((r) => (
            <Box key={r.qty} sx={{ bgcolor: A.panelHi, border: `1px solid ${A.line}`, borderRadius: 2.5, p: 1.75 }}>
              <Typography sx={{ ...eyebrow, fontSize: 10 }}>{r.qty} units</Typography>
              <Typography sx={{ ...atomMono, fontSize: 24, fontWeight: 800, mt: 0.75 }}>{money(r.price)}<Typography component="span" sx={{ color: A.faint, fontSize: 12 }}> /unit</Typography></Typography>
              <Typography sx={{ color: A.faint, fontSize: 11, mt: 0.5 }}>your cost {money(r.cost)}</Typography>
              <Chip size="small" label={`you make ${money0(r.profit)}`}
                sx={{ ...atomMono, mt: 1, bgcolor: 'rgba(74,222,128,0.12)', color: A.green, fontWeight: 700, fontSize: 11 }} />
            </Box>
          ))}
        </Box>

        <Typography sx={{ color: A.muted, fontSize: 12.5, mt: 1.75 }}>
          That’s a true <Box component="span" sx={{ color: A.violet, fontWeight: 800 }}>{Math.round(margin * 100)}% margin</Box> on
          every option — not markup math — and the client picks their run size themselves on the approval page.
          Land the 500 and you bank <Box component="span" sx={{ ...atomMono, color: A.green, fontWeight: 800 }}>{money0(best.profit)}</Box>.
        </Typography>
      </Box>
    </Box>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Stop 3 — ORDERS. Press play: the timeline ticks itself, UPS delivers, the
   deal auto-wins. The point: after the quote, the system does the walking.  */

const ORDER_STEPS = [
  { id: 'placed', label: 'Order placed', at: 0 },
  { id: 'paid', label: 'Payment received', at: 0 },
  { id: 'production', label: 'In production', at: 900 },
  { id: 'shipped', label: 'Shipped — UPS 1Z 999 AA1…', at: 2100 },
  { id: 'delivered', label: 'Delivered', at: 3400 },
];

function OrdersStop() {
  const [done, setDone] = useState(2);         // placed + paid pre-ticked
  const [running, setRunning] = useState(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const run = () => {
    timers.current.forEach(clearTimeout);
    setDone(2); setRunning(true);
    ORDER_STEPS.slice(2).forEach((s, i) => {
      timers.current.push(setTimeout(() => {
        setDone(3 + i);
        if (3 + i === ORDER_STEPS.length) setRunning(false);
      }, s.at));
    });
  };
  const delivered = done >= ORDER_STEPS.length;
  return (
    <Box sx={FX}>
      <Box sx={{ ...card, p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Riverside Brewing · order #1042</Typography>
            <Typography sx={{ color: A.muted, fontSize: 12, mt: 0.25 }}>500 pint glasses · {money0(2450)} · UPS link pasted once, on ship day</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button onClick={run} disabled={running}
            sx={{ bgcolor: delivered ? 'rgba(255,255,255,0.06)' : A.violet, color: delivered ? A.text : A.ink,
              fontWeight: 800, textTransform: 'none', fontSize: 13, px: 2.5, py: 0.8, borderRadius: 999,
              ...(!running && !delivered ? { animation: 'atomGlowPulse 1.8s ease infinite' } : {}),
              '&:hover': { bgcolor: delivered ? 'rgba(255,255,255,0.1)' : '#b8a3fb' },
              '&.Mui-disabled': { color: A.faint, bgcolor: 'rgba(255,255,255,0.05)' } }}>
            {delivered ? '↻ Replay' : running ? 'Running…' : '▶ Watch it run'}
          </Button>
        </Stack>

        <Stack gap={0} sx={{ mt: 2.5, ml: 0.5 }}>
          {ORDER_STEPS.map((s, i) => {
            const ticked = i < done;
            const last = i === ORDER_STEPS.length - 1;
            return (
              <Stack key={s.id} direction="row" gap={1.5}>
                <Stack alignItems="center">
                  <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, color: A.ink, flexShrink: 0,
                    bgcolor: ticked ? (last ? A.green : A.violet) : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${ticked ? 'transparent' : A.line}`,
                    ...(ticked ? { animation: 'atomTick 0.45s ease' } : {}) }}>
                    {ticked ? '✓' : ''}
                  </Box>
                  {!last && <Box sx={{ width: 2, flex: 1, minHeight: 18, bgcolor: i < done - 1 ? A.violet : A.line, transition: 'background 0.5s' }} />}
                </Stack>
                <Box sx={{ pb: last ? 0 : 1.5 }}>
                  <Typography sx={{ fontWeight: ticked ? 800 : 600, fontSize: 13.5, color: ticked ? A.text : A.faint, transition: 'color 0.4s' }}>
                    {s.label}
                    {s.id === 'shipped' && ticked && <Chip size="small" label="hourly UPS check: on" sx={{ ...atomMono, ml: 1, bgcolor: 'rgba(167,139,250,0.14)', color: A.violet, fontSize: 9.5, height: 18 }} />}
                    {s.id === 'delivered' && ticked && <Chip size="small" label="auto-delivered via UPS ✓" sx={{ ...atomMono, ml: 1, bgcolor: 'rgba(74,222,128,0.14)', color: A.green, fontSize: 9.5, height: 18 }} />}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>

        {delivered && (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2.5, border: `1px solid rgba(74,222,128,0.35)`, bgcolor: 'rgba(74,222,128,0.07)', animation: 'atomPop 0.6s ease' }}>
            <Typography sx={{ color: A.green, fontWeight: 800, fontSize: 13 }}>
              🏆 Deal moved to Won — nobody touched it.
            </Typography>
            <Typography sx={{ color: A.muted, fontSize: 12, mt: 0.25 }}>
              UPS reported delivery on the hourly sweep, the order marked itself delivered, the client’s
              tracking page updated, and the pipeline card won itself. You were at the press.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Stop 4 — CLIENT VIEW. A browser-framed mock of the branded approval page;
   approving stamps the proof and reports back to the shop.                  */

function ClientStop() {
  const [approved, setApproved] = useState(false);
  return (
    <Box sx={FX}>
      <Box sx={{ border: `1px solid ${A.line}`, borderRadius: 3, overflow: 'hidden', maxWidth: 640, mx: 'auto' }}>
        {/* browser chrome */}
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ px: 1.5, py: 1, bgcolor: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${A.line}` }}>
          {['#f87171', '#fbbf24', '#4ade80'].map((c) => <Box key={c} sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: c, opacity: 0.8 }} />)}
          <Box sx={{ flex: 1, ml: 1, px: 1.5, py: 0.4, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${A.line}` }}>
            <Typography sx={{ ...atomMono, color: A.faint, fontSize: 11 }}>yourshop.com/approve/1041 — what your client sees</Typography>
          </Box>
        </Stack>
        {/* the approval page itself */}
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: A.panelHi }}>
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: A.violet, color: A.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15 }}>SC</Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14.5 }}>Summit Coffee Co.</Typography>
              <Typography sx={{ color: A.faint, fontSize: 11.5 }}>proof + quote · project 1041 · your logo up top, not ours</Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            {approved && <Chip size="small" label="Approved ✓" sx={{ bgcolor: 'rgba(74,222,128,0.15)', color: A.green, fontWeight: 800, fontSize: 11, animation: 'atomTick 0.45s ease' }} />}
          </Stack>

          {/* proof */}
          <Box sx={{ mt: 2, borderRadius: 2.5, border: `1px ${approved ? 'solid' : 'dashed'} ${approved ? 'rgba(74,222,128,0.45)' : A.line}`,
            bgcolor: 'rgba(255,255,255,0.03)', p: 2.5, textAlign: 'center', transition: 'border-color 0.4s' }}>
            <Typography sx={{ fontSize: 44, lineHeight: 1 }}>👕</Typography>
            <Typography sx={{ color: A.muted, fontSize: 12, mt: 0.75 }}>“Morning Ritual” tee — 3-color front, mockup v2</Typography>
          </Box>

          {/* options the client picks from */}
          <Stack gap={0.75} sx={{ mt: 1.75 }}>
            {[{ qty: 250, price: 8.71, note: 'most popular' }, { qty: 500, price: 7.79 }].map((o) => (
              <Stack key={o.qty} direction="row" alignItems="center" sx={{ px: 1.5, py: 1, borderRadius: 2, border: `1px solid ${A.line}`, bgcolor: 'rgba(255,255,255,0.03)' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{o.qty} tees</Typography>
                {o.note && <Chip size="small" label={o.note} sx={{ ml: 1, bgcolor: 'rgba(167,139,250,0.14)', color: A.violet, fontSize: 9.5, height: 18 }} />}
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ ...atomMono, fontWeight: 800, fontSize: 13 }}>{money(o.price)}<Typography component="span" sx={{ color: A.faint, fontSize: 11 }}> /unit</Typography></Typography>
              </Stack>
            ))}
          </Stack>

          <Button fullWidth disabled={approved} onClick={() => setApproved(true)}
            sx={{ mt: 2, bgcolor: approved ? 'rgba(74,222,128,0.15)' : A.violet, color: approved ? A.green : A.ink,
              fontWeight: 900, textTransform: 'none', fontSize: 14, py: 1.1, borderRadius: 2.5,
              ...(!approved ? { animation: 'atomGlowPulse 1.8s ease infinite' } : {}),
              '&:hover': { bgcolor: '#b8a3fb' },
              '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.12)', color: A.green } }}>
            {approved ? 'Proof approved — the shop already knows ✓' : 'Approve this proof (as the client)'}
          </Button>
        </Box>
      </Box>
      <Typography sx={{ color: approved ? A.green : A.faint, fontSize: 12.5, mt: 1.5, textAlign: 'center', transition: 'color 0.4s' }}>
        {approved
          ? '✓ Back in the studio the deal just stamped itself approved, with a timestamp — no “did you see my email?”'
          : 'This is the page your client gets — one link, your branding, nothing to install. Go on, approve it.'}
      </Typography>
    </Box>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The tour shell.                                                            */

const STOPS = [
  { key: 'pipeline', label: 'Pipeline', title: 'Deals move themselves', copy: 'Every job is a card. Sharing the quote, getting the approval, delivering the order — the work moves the card, not your mouse.', el: <PipelineStop /> },
  { key: 'quoter', label: 'Quoter', title: 'Margin-true quoting', copy: 'Pick a margin. Every run size reprices to a real margin — with your profit on the chip before you hit send.', el: <QuoterStop /> },
  { key: 'orders', label: 'Orders', title: 'Delivery on autopilot', copy: 'Paste the UPS link once. The tracker ticks itself, the client’s page stays current, and delivery wins the deal.', el: <OrdersStop /> },
  { key: 'client', label: 'Client view', title: 'What your client sees', copy: 'One branded link: proof, options, prices, approval. No portal logins, no PDFs bouncing around.', el: <ClientStop /> },
];

export default function AtomDemo() {
  const [stop, setStop] = useState(0);
  useEffect(() => { document.title = 'JP Atom — live demo'; }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [stop]);
  const s = STOPS[stop];
  const last = stop === STOPS.length - 1;
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: A.bg, color: A.text, position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: -280, left: '50%', transform: 'translateX(-50%)', width: 900, height: 480,
        borderRadius: '50%', background: A.glow, filter: 'blur(110px)', pointerEvents: 'none' }} />

      <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2, md: 4 }, pb: 8, position: 'relative' }}>
        {/* top bar */}
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 2.5 }}>
          <AtomMark size={26} />
          <Typography sx={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.2 }}>JP&nbsp;Atom</Typography>
          <Chip size="small" label="live demo — fake shop, real behavior" sx={{ ...atomMono, bgcolor: 'rgba(167,139,250,0.12)', color: A.violet, fontSize: 10, height: 20 }} />
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/atom" sx={{ color: A.muted, textTransform: 'none', fontWeight: 700, fontSize: 13, '&:hover': { color: A.text } }}>
            ← Back
          </Button>
        </Stack>

        {/* coach strip */}
        <Box sx={{ mt: { xs: 1, md: 3 }, mb: 2.5 }}>
          <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
            {STOPS.map((t, i) => (
              <Chip key={t.key} label={`${i + 1} · ${t.label}`} onClick={() => setStop(i)}
                sx={{ fontWeight: 800, fontSize: 12, cursor: 'pointer',
                  bgcolor: i === stop ? A.violet : 'rgba(255,255,255,0.05)',
                  color: i === stop ? A.ink : i < stop ? A.violet : A.muted,
                  border: `1px solid ${i === stop ? A.violet : A.line}`,
                  '&:hover': { bgcolor: i === stop ? A.violet : 'rgba(167,139,250,0.12)' } }} />
            ))}
          </Stack>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 24, md: 30 }, letterSpacing: -0.8, mt: 2 }}>{s.title}</Typography>
          <Typography sx={{ color: A.muted, fontSize: 14, maxWidth: 620, mt: 0.5, lineHeight: 1.55 }}>{s.copy}</Typography>
        </Box>

        {/* the stop — keyed so each entrance replays the rise */}
        <Box key={s.key} sx={{ animation: 'atomRise 0.4s ease', ...FX }}>{s.el}</Box>

        {/* tour nav / finale */}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1.5} sx={{ mt: 4 }}>
          {!last ? (
            <Button onClick={() => setStop(stop + 1)}
              sx={{ bgcolor: A.violet, color: A.ink, fontWeight: 800, textTransform: 'none', fontSize: 14, px: 3, py: 1, borderRadius: 999,
                boxShadow: `0 8px 32px ${A.glow}`, '&:hover': { bgcolor: '#b8a3fb' } }}>
              Next stop: {STOPS[stop + 1].label} →
            </Button>
          ) : (
            <Box sx={{ ...card, width: '100%', p: { xs: 2.5, md: 3 }, textAlign: 'center', borderColor: A.lineHi, animation: 'atomPop 0.6s ease' }}>
              <Typography sx={{ ...eyebrow }}>That’s the tour — the real thing goes deeper</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 20, md: 26 }, letterSpacing: -0.5, mt: 1 }}>
                Want this with <Box component="span" sx={{ color: A.violet }}>your logo</Box> on it?
              </Typography>
              <Typography sx={{ color: A.muted, fontSize: 13.5, mt: 1, maxWidth: 560, mx: 'auto' }}>
                Founding pricing: <Box component="span" sx={{ color: A.text, fontWeight: 800 }}>$995 setup + $295/mo</Box>
                <Box component="span" sx={{ color: A.faint }}> (list $2,495 + $495)</Box> — and custom builds are the point,
                not an add-on. Field sales mode, finances, content planner, whatever your shop needs wired in.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} justifyContent="center" sx={{ mt: 2.5 }}>
                <Button component="a" href={CONTACT}
                  sx={{ bgcolor: A.violet, color: A.ink, fontWeight: 800, textTransform: 'none', fontSize: 14, px: 3, py: 1, borderRadius: 999,
                    boxShadow: `0 8px 32px ${A.glow}`, '&:hover': { bgcolor: '#b8a3fb' } }}>
                  Claim founding pricing
                </Button>
                <Button component={RouterLink} to="/atom"
                  sx={{ color: A.text, fontWeight: 700, textTransform: 'none', fontSize: 14, px: 2.5, py: 1, borderRadius: 999, border: `1px solid ${A.line}`,
                    '&:hover': { borderColor: A.lineHi } }}>
                  Back to the pitch
                </Button>
              </Stack>
            </Box>
          )}
          {!last && (
            <Typography sx={{ color: A.faint, fontSize: 12 }}>
              or click any stop above — everything here is clickable
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
