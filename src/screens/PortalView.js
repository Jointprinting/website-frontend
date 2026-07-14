// src/screens/PortalView.js
//
// The CLIENT PORTAL — /portal/:token. One magic link per company (no login,
// no password): every order's status with the same tracking timeline the
// approval page shows, plus deep links into each order's live approval page
// and invoice/receipt PDFs. View-only by design — reordering is a
// conversation in v1, and the footer says exactly how to start one.
//
// Feels like a sibling of the approval page on purpose: same TOKENS theme
// (light/dark, shared localStorage key so the client's choice carries over),
// same TrackingTimeline, same visual language.

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import config from '../config.json';
import { TOKENS, sxCard, sxEyebrow, mono, TrackingTimeline } from './ApprovalView';

const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Client-facing words for an order's status — never the internal vocabulary.
const STATUS_LABEL = {
  quoted:        { label: 'Quote in progress', tone: 'muted' },
  approved:      { label: 'Approved',          tone: 'green' },
  placed:        { label: 'Order placed',      tone: 'green' },
  in_production: { label: 'In production',     tone: 'green' },
  shipped:       { label: 'Shipped',           tone: 'green' },
  delivered:     { label: 'Delivered',         tone: 'green' },
  cancelled:     { label: 'Cancelled',         tone: 'muted' },
};

function StatusPill({ status, T }) {
  const meta = STATUS_LABEL[status] || { label: status, tone: 'muted' };
  const green = meta.tone === 'green';
  return (
    <Box sx={{ display: 'inline-flex', px: 1.2, py: 0.3, borderRadius: 999, flexShrink: 0,
      bgcolor: green ? 'rgba(74,222,128,0.14)' : 'transparent',
      border: `1px solid ${green ? T.lineHi : T.line}` }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
        color: green ? T.green : T.muted }}>{meta.label}</Typography>
    </Box>
  );
}

// One order — the card. ACTIVE orders open with their timeline showing;
// finished ones start collapsed so a long history stays scannable.
function OrderCard({ o, T, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const eyebrow = sxEyebrow(T);
  const title = o.summary || (o.orderNumber ? `Order #${o.orderNumber}` : `Project #${o.projectNumber}`);
  const approveUrl = o.approvalLive ? `/approve/${o.id}?token=${encodeURIComponent(o.approvalToken)}` : '';
  const pdfBase = `${config.backendUrl}/api/public/projects/${o.id}`;
  const pdfQ = `token=${encodeURIComponent(o.approvalToken || '')}`;
  const needsEyes = o.approvalLive && !o.approved && o.status === 'quoted';
  return (
    <Box sx={{ ...sxCard(T), overflow: 'hidden' }}>
      <Box role="button" tabIndex={0} onClick={() => setOpen((v) => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 2, p: { xs: 2, sm: 2.5 }, cursor: 'pointer',
          '&:hover': { bgcolor: T.panelHi } }}>
        {o.thumbnail ? (
          <Box component="img" src={o.thumbnail} alt=""
            sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 2, border: `1px solid ${T.line}`, flexShrink: 0, bgcolor: '#fff' }} />
        ) : (
          <Box sx={{ width: 64, height: 64, borderRadius: 2, border: `1px dashed ${T.line}`, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.faint, fontSize: 22 }}>🎨</Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ ...eyebrow, color: T.faint, fontSize: 10 }}>
            {o.orderNumber ? `Order #${o.orderNumber}` : `Project #${o.projectNumber}`}
            {o.orderDate ? ` · ${new Date(o.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
          </Typography>
          <Typography noWrap sx={{ fontSize: 15.5, fontWeight: 800, color: T.text, mt: 0.3 }}>{title}</Typography>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.6, flexWrap: 'wrap' }}>
            <StatusPill status={o.status} T={T} />
            {Number(o.totalValue) > 0 && (
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: T.text, ...mono }}>{money(o.totalValue)}</Typography>
            )}
            {o.paid && <Typography sx={{ fontSize: 11, fontWeight: 800, color: T.green }}>PAID ✓</Typography>}
          </Stack>
        </Box>
        <ExpandMoreRoundedIcon sx={{ color: T.faint, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
      </Box>

      {open && (
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: { xs: 2, sm: 2.5 } }}>
          {needsEyes && (
            <Box component="a" href={approveUrl}
              sx={{ display: 'block', textAlign: 'center', mb: 1.5, px: 2, py: 1.2, borderRadius: 2, textDecoration: 'none',
                bgcolor: T.green, color: T.onAccent, fontWeight: 800, fontSize: 14,
                '&:hover': { opacity: 0.92 } }}>
              Your proof is ready — review &amp; approve →
            </Box>
          )}
          <TrackingTimeline steps={(o.tracking && o.tracking.steps) || []} T={T} />
          {(o.approvalLive || (o.approved && o.approvalLive)) && (
            <Stack direction="row" gap={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
              {o.approvalLive && !needsEyes && (
                <Button component="a" href={approveUrl} size="small"
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: T.green,
                    border: `1px solid ${T.lineHi}`, borderRadius: 999, px: 1.75,
                    '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
                  Order page →
                </Button>
              )}
              {o.approved && o.approvalLive && (
                <Button component="a" href={`${pdfBase}/invoice.pdf?${pdfQ}`} target="_blank" rel="noreferrer" size="small"
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: T.muted,
                    border: `1px solid ${T.line}`, borderRadius: 999, px: 1.75, '&:hover': { color: T.text } }}>
                  Invoice (PDF)
                </Button>
              )}
              {o.paid && o.approvalLive && (
                <Button component="a" href={`${pdfBase}/receipt.pdf?${pdfQ}`} target="_blank" rel="noreferrer" size="small"
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: T.muted,
                    border: `1px solid ${T.line}`, borderRadius: 999, px: 1.75, '&:hover': { color: T.text } }}>
                  Receipt (PDF)
                </Button>
              )}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function PortalView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // Same theme choice (and storage key) as the approval page — the client's
  // preference follows them between the two surfaces.
  const [mode, setMode] = useState(() => {
    try {
      const saved = window.localStorage.getItem('jpw-approve-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch (_) { /* fall through */ }
    return 'dark';
  });
  const toggleMode = () => setMode((m) => {
    const next = m === 'dark' ? 'light' : 'dark';
    try { window.localStorage.setItem('jpw-approve-theme', next); } catch (_) { /* ignore */ }
    return next;
  });
  const T = TOKENS[mode] || TOKENS.dark;

  useEffect(() => {
    let cancelled = false;
    axios.get(`${config.backendUrl}/api/portal/${encodeURIComponent(token || '')}`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => { if (!cancelled) setErr(e.response?.data?.message || 'This link is invalid or no longer available.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const orders = (data && data.orders) || [];
  const ACTIVE = ['quoted', 'approved', 'placed', 'in_production', 'shipped'];
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: T.bg, position: 'relative',
      '&::before': { content: '""', position: 'fixed', top: -220, left: '50%', transform: 'translateX(-50%)',
        width: 900, height: 440, borderRadius: '50%', background: T.aura, filter: 'blur(90px)', pointerEvents: 'none' } }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 5 }, position: 'relative' }}>

        {/* Header */}
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 4 }}>
          <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt="Joint Printing"
            sx={{ width: 40, height: 40, objectFit: 'contain' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ ...sxEyebrow(T), fontSize: 10 }}>Joint Printing · client portal</Typography>
            <Typography noWrap sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 900, color: T.text, letterSpacing: -0.5, lineHeight: 1.2 }}>
              {loading ? 'Loading…' : (data ? data.company.companyName : 'Your orders')}
            </Typography>
          </Box>
          {data && data.company.logo && (
            <Box component="img" src={data.company.logo} alt=""
              sx={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 1.5, bgcolor: '#fff', p: 0.5, border: `1px solid ${T.line}` }} />
          )}
          <Button onClick={toggleMode} sx={{ minWidth: 0, p: 1, color: T.muted, '&:hover': { color: T.text } }}
            aria-label="Switch light/dark">
            {mode === 'dark' ? <LightModeOutlinedIcon sx={{ fontSize: 18 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />}
          </Button>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress size={28} sx={{ color: T.green }} />
          </Box>
        ) : err ? (
          <Box sx={{ ...sxCard(T), p: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 30, mb: 1 }}>🔗</Typography>
            <Typography sx={{ color: T.text, fontWeight: 800, fontSize: 16, mb: 0.5 }}>{err}</Typography>
            <Typography sx={{ color: T.muted, fontSize: 13 }}>
              Ask us for a fresh link — nate@jointprinting.com
            </Typography>
          </Box>
        ) : (
          <Stack gap={3.5}>
            {active.length > 0 && (
              <Box>
                <Typography sx={{ ...sxEyebrow(T), mb: 1.25, display: 'block' }}>
                  In the works · {active.length}
                </Typography>
                <Stack gap={1.5}>
                  {active.map((o) => <OrderCard key={o.id} o={o} T={T} defaultOpen />)}
                </Stack>
              </Box>
            )}
            {past.length > 0 && (
              <Box>
                <Typography sx={{ ...sxEyebrow(T), color: T.faint, mb: 1.25, display: 'block' }}>
                  Delivered &amp; past · {past.length}
                </Typography>
                <Stack gap={1.25}>
                  {past.map((o) => <OrderCard key={o.id} o={o} T={T} defaultOpen={false} />)}
                </Stack>
              </Box>
            )}
            {orders.length === 0 && (
              <Box sx={{ ...sxCard(T), p: 4, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 28, mb: 1 }}>🖨️</Typography>
                <Typography sx={{ color: T.text, fontWeight: 800, fontSize: 15 }}>Nothing in the works right now</Typography>
                <Typography sx={{ color: T.muted, fontSize: 13, mt: 0.5 }}>Your next order will show up here the moment we start on it.</Typography>
              </Box>
            )}

            {/* Reorder = a conversation (v1) — say exactly how to start one. */}
            <Box sx={{ ...sxCard(T), p: { xs: 2.5, sm: 3 }, textAlign: 'center', borderStyle: 'dashed' }}>
              <Typography sx={{ color: T.text, fontWeight: 800, fontSize: 14.5 }}>
                Ready for a reorder — or something new?
              </Typography>
              <Typography sx={{ color: T.muted, fontSize: 13, mt: 0.5, lineHeight: 1.55 }}>
                Just reply to our email or text Nate what you're thinking. We re-quote at current blank + print
                pricing, so numbers can shift a little between runs — you'll always see the quote before anything moves.
              </Typography>
              <Button component="a" href="mailto:nate@jointprinting.com" size="small"
                sx={{ mt: 1.5, textTransform: 'none', fontWeight: 800, fontSize: 13, px: 2.5, borderRadius: 999,
                  bgcolor: T.green, color: T.onAccent, '&:hover': { bgcolor: T.green, opacity: 0.92 } }}>
                Email nate@jointprinting.com
              </Button>
            </Box>

            <Typography sx={{ color: T.faint, fontSize: 11, textAlign: 'center', pb: 2 }}>
              This page updates itself as your orders move — bookmark it. · Joint Printing, NJ
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
