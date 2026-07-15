// src/screens/PreorderClientView.js
//
// PREORDER — CLIENT / organizer view (/preorder/c/:clientToken). The professional
// half of the two-door drop: the store owner running the campaign gets full
// progress at all times (the FOMO hiding is for their customers, not them), a live
// countdown, and — the main event — the CUSTOMER link to share. Read-only, gated
// by a separate clientToken so a customer can't reach the pre-MOQ numbers. Shares
// the approval-page TOKENS theme with the customer page so the family is obvious.

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import config from '../config.json';
import { TOKENS, sxCard, sxEyebrow, mono } from './ApprovalView';

function timeLeft(expiresAt, now) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return 'closing…';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function PreorderClientView() {
  const { clientToken } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
    axios.get(`${config.backendUrl}/api/preorder/client/${encodeURIComponent(clientToken || '')}`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => { if (!cancelled) setErr(e.response?.data?.message || 'This link is invalid or no longer available.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientToken]);

  useEffect(() => { document.title = data ? `${data.title} — organizer` : 'Preorder | Joint Printing'; }, [data]);
  useEffect(() => {
    if (!(data && data.open && data.expiresAt)) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data]);

  const customerUrl = data && data.customerToken
    ? `${window.location.origin}/preorder/${data.customerToken}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(customerUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch (_) { /* clipboard blocked — the field is selectable */ }
  };

  const itemLabel = new Map(((data && data.items) || []).map((it) => [it.id, it.label]));
  const moqPct = data && data.moq > 0 ? Math.min(100, Math.round((data.tally.totalQty / data.moq) * 100)) : 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: T.bg, position: 'relative',
      '&::before': { content: '""', position: 'fixed', top: -220, left: '50%', transform: 'translateX(-50%)',
        width: 900, height: 440, borderRadius: '50%', background: T.aura, filter: 'blur(90px)', pointerEvents: 'none' } }}>
      <Box sx={{ maxWidth: 620, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 5 }, position: 'relative' }}>

        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 3.5 }}>
          <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt="Joint Printing"
            sx={{ width: 40, height: 40, objectFit: 'contain' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ ...sxEyebrow(T), fontSize: 10 }}>Joint Printing · organizer view</Typography>
            <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 900, color: T.text, letterSpacing: -0.5, lineHeight: 1.2 }}>
              {loading ? 'Loading…' : (data ? data.title : 'Preorder')}
            </Typography>
          </Box>
          {data && data.logo && (
            <Box component="img" src={data.logo} alt=""
              sx={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 1.5, bgcolor: '#fff', p: 0.5, border: `1px solid ${T.line}` }} />
          )}
          <Button onClick={toggleMode} sx={{ minWidth: 0, p: 1, color: T.muted, '&:hover': { color: T.text } }} aria-label="Switch light/dark">
            {mode === 'dark' ? <LightModeOutlinedIcon sx={{ fontSize: 18 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />}
          </Button>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress size={28} sx={{ color: T.green }} /></Box>
        ) : err ? (
          <Box sx={{ ...sxCard(T), p: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 30, mb: 1 }}>🔗</Typography>
            <Typography sx={{ color: T.text, fontWeight: 800, fontSize: 16, mb: 0.5 }}>{err}</Typography>
            <Typography sx={{ color: T.muted, fontSize: 13 }}>Ask us for a fresh link — nate@jointprinting.com</Typography>
          </Box>
        ) : (
          <Stack gap={2}>
            {/* Status + countdown */}
            <Box sx={{ ...sxCard(T), px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: data.open ? T.green : T.muted }}>
                {data.open ? '● Live' : '○ Closed'}
              </Typography>
              <Box sx={{ flex: 1 }} />
              {data.open && data.expiresAt && (
                <Typography sx={{ ...mono, fontSize: 12.5, fontWeight: 800, color: T.amber }}>⏳ {timeLeft(data.expiresAt, now)}</Typography>
              )}
            </Box>

            {/* THE share card — the organizer's main action */}
            <Box sx={{ ...sxCard(T), p: 2.5, borderColor: T.lineHi }}>
              <Typography sx={{ ...sxEyebrow(T), display: 'block', mb: 1 }}>Share with your people</Typography>
              <Typography sx={{ color: T.muted, fontSize: 13, mb: 1.5, lineHeight: 1.6 }}>
                Send this link out — everyone commits their sizes here, no payment yet. When it closes and hits the goal, we send payment links.
              </Typography>
              <Stack direction="row" gap={1} alignItems="center">
                <Box sx={{ flex: 1, minWidth: 0, ...mono, fontSize: 12.5, color: T.text, bgcolor: T.inset,
                  border: `1px solid ${T.line}`, borderRadius: 2, px: 1.5, py: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {customerUrl}
                </Box>
                <Button onClick={copy} startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />}
                  sx={{ bgcolor: T.green, color: T.onAccent, fontWeight: 800, fontSize: 13, py: 1.1, px: 1.75, borderRadius: 2,
                    textTransform: 'none', flexShrink: 0, '&:hover': { bgcolor: T.green, filter: 'brightness(1.08)' } }}>
                  {copied ? 'Copied ✓' : 'Copy'}
                </Button>
              </Stack>
            </Box>

            {/* Full progress — the organizer sees everything, MOQ or not */}
            <Box sx={{ ...sxCard(T), p: 2.5 }}>
              <Stack direction="row" alignItems="baseline" gap={2} flexWrap="wrap" sx={{ mb: data.moq > 0 ? 1.5 : 0 }}>
                <Box>
                  <Typography sx={{ ...mono, fontSize: 26, fontWeight: 900, color: T.green, lineHeight: 1 }}>{data.tally.totalQty}</Typography>
                  <Typography sx={{ color: T.muted, fontSize: 11 }}>units committed</Typography>
                </Box>
                <Box>
                  <Typography sx={{ ...mono, fontSize: 26, fontWeight: 900, color: T.text, lineHeight: 1 }}>{data.tally.people}</Typography>
                  <Typography sx={{ color: T.muted, fontSize: 11 }}>{data.tally.people === 1 ? 'person' : 'people'} in</Typography>
                </Box>
                {data.moq > 0 && (
                  <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                    <Typography sx={{ ...mono, fontSize: 15, fontWeight: 800, color: data.moqReached ? T.green : T.amber }}>
                      {data.moqReached ? 'Goal hit ✓' : `${data.tally.totalQty} / ${data.moq}`}
                    </Typography>
                    <Typography sx={{ color: T.muted, fontSize: 11 }}>{data.moqReached ? 'ready to produce' : 'to the minimum'}</Typography>
                  </Box>
                )}
              </Stack>
              {data.moq > 0 && (
                <Box sx={{ height: 8, borderRadius: 4, bgcolor: T.inset, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${moqPct}%`, borderRadius: 4, transition: 'width .4s',
                    background: data.moqReached ? `linear-gradient(90deg, ${T.green}, #2dd4bf)` : T.amber }} />
                </Box>
              )}
            </Box>

            {/* Per-item breakdown */}
            {data.tally.totalQty > 0 && (
              <Box sx={{ ...sxCard(T), p: 2.5 }}>
                <Typography sx={{ ...sxEyebrow(T), display: 'block', mb: 1.25 }}>By item</Typography>
                <Stack gap={0.75}>
                  {Object.entries(data.tally.byItem).map(([id, t]) => (
                    <Box key={id}>
                      <Typography sx={{ color: T.text, fontSize: 13, fontWeight: 700 }}>
                        {itemLabel.get(id) || 'Item'} <Box component="span" sx={{ ...mono, color: T.green }}>· {t.qty}</Box>
                      </Typography>
                      <Typography sx={{ color: T.muted, fontSize: 11.5 }}>
                        {Object.entries(t.bySize).map(([s, q]) => `${s} ${q}`).join(' · ')}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {data.pickupLocation && (
              <Typography sx={{ color: T.muted, fontSize: 12.5, px: 0.5 }}>
                📍 Pickup: <Box component="span" sx={{ color: T.text, fontWeight: 700 }}>{data.pickupLocation}</Box>
              </Typography>
            )}
            {data.note && (
              <Typography sx={{ color: T.faint, fontSize: 12.5, px: 0.5, lineHeight: 1.6 }}>{data.note}</Typography>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
