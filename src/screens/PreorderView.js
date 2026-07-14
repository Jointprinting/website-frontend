// src/screens/PreorderView.js
//
// PREORDER — /preorder/:token. An expiring public page where a client's
// people commit to quantities before the run is placed: name + counts,
// never payments (v1 is commitments by design — money stays a conversation).
// Sibling of the approval page + portal on purpose: same TOKENS theme (same
// localStorage key so the choice carries over), same visual language.

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Box, Stack, Typography, Button, TextField, CircularProgress } from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import config from '../config.json';
import { TOKENS, sxCard, sxEyebrow, mono } from './ApprovalView';

const keyOf = (itemId, size) => `${itemId}|${size || ''}`;

// One qty cell — tap +/− or type. Zero means "not this one".
function QtyCell({ label, value, onChange, T }) {
  const v = Number(value) || 0;
  return (
    <Stack direction="row" alignItems="center" gap={0.75}
      sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: `1px solid ${v > 0 ? T.lineHi : T.line}`,
        bgcolor: v > 0 ? 'rgba(74,222,128,0.08)' : 'transparent', transition: 'border-color .15s' }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.text, minWidth: 26 }}>{label}</Typography>
      <Box sx={{ flex: 1 }} />
      <Button onClick={() => onChange(Math.max(0, v - 1))} disabled={v === 0}
        sx={{ minWidth: 26, px: 0, py: 0, fontSize: 16, fontWeight: 800, color: T.muted, '&:hover': { color: T.text } }}>−</Button>
      <Typography sx={{ ...mono, fontSize: 14, fontWeight: 800, color: v > 0 ? T.green : T.faint, minWidth: 22, textAlign: 'center' }}>{v}</Typography>
      <Button onClick={() => onChange(v + 1)}
        sx={{ minWidth: 26, px: 0, py: 0, fontSize: 16, fontWeight: 800, color: T.muted, '&:hover': { color: T.green } }}>+</Button>
    </Stack>
  );
}

export default function PreorderView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [qtys, setQtys] = useState({});
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);   // { units } after a successful commit
  const [formErr, setFormErr] = useState('');

  // Same theme choice (and storage key) as the approval page/portal.
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
    axios.get(`${config.backendUrl}/api/preorder/${encodeURIComponent(token || '')}`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => { if (!cancelled) setErr(e.response?.data?.message || 'This link is invalid or no longer available.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => { document.title = data ? `${data.title} — preorder` : 'Preorder | Joint Printing'; }, [data]);

  const entries = useMemo(() => Object.entries(qtys)
    .map(([k, q]) => {
      const [itemId, size] = k.split('|');
      return { itemId, size, qty: Number(q) || 0 };
    })
    .filter((e) => e.qty > 0), [qtys]);
  const units = entries.reduce((t, e) => t + e.qty, 0);

  const submit = async () => {
    setFormErr('');
    if (!name.trim()) { setFormErr('Add your name so the order knows who this is for.'); return; }
    if (!entries.length) { setFormErr('Pick at least one quantity above.'); return; }
    setSending(true);
    try {
      const r = await axios.post(`${config.backendUrl}/api/preorder/${encodeURIComponent(token || '')}/commit`,
        { name, contact, note, entries });
      setDone({ units });
      setData((d) => (d ? { ...d, tally: r.data.tally } : d));
      setQtys({}); setNote('');
    } catch (e) {
      setFormErr(e.response?.data?.message || 'That didn’t go through — please try again.');
    } finally { setSending(false); }
  };

  const expiryLine = data && data.open && data.expiresAt
    ? `Open until ${new Date(data.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
    : (data && data.open ? 'Open now' : 'Closed');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: T.bg, position: 'relative',
      '&::before': { content: '""', position: 'fixed', top: -220, left: '50%', transform: 'translateX(-50%)',
        width: 900, height: 440, borderRadius: '50%', background: T.aura, filter: 'blur(90px)', pointerEvents: 'none' } }}>
      <Box sx={{ maxWidth: 620, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 5 }, position: 'relative' }}>

        {/* Header */}
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 3.5 }}>
          <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt="Joint Printing"
            sx={{ width: 40, height: 40, objectFit: 'contain' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ ...sxEyebrow(T), fontSize: 10 }}>Joint Printing · preorder</Typography>
            <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 900, color: T.text, letterSpacing: -0.5, lineHeight: 1.2 }}>
              {loading ? 'Loading…' : (data ? data.title : 'Preorder')}
            </Typography>
          </Box>
          {data && data.logo && (
            <Box component="img" src={data.logo} alt=""
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
            <Typography sx={{ color: T.muted, fontSize: 13 }}>Ask us for a fresh link — nate@jointprinting.com</Typography>
          </Box>
        ) : (
          <Stack gap={2}>
            {/* Status strip */}
            <Box sx={{ ...sxCard(T), px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: data.open ? T.green : T.muted }}>
                {data.open ? '● ' : '○ '}{expiryLine}
              </Typography>
              <Box sx={{ flex: 1 }} />
              {data.tally.people > 0 && (
                <Typography sx={{ ...mono, fontSize: 12, color: T.muted }}>
                  {data.tally.people} in · {data.tally.totalQty} units so far
                </Typography>
              )}
            </Box>

            {data.note && (
              <Typography sx={{ color: T.muted, fontSize: 14, px: 0.5, lineHeight: 1.6 }}>{data.note}</Typography>
            )}

            {done && (
              <Box sx={{ ...sxCard(T), p: 2.5, borderColor: T.lineHi, textAlign: 'center' }}>
                <Typography sx={{ color: T.green, fontWeight: 900, fontSize: 17 }}>You’re in ✓</Typography>
                <Typography sx={{ color: T.muted, fontSize: 13, mt: 0.5 }}>
                  {done.units} unit{done.units === 1 ? '' : 's'} down for {name.trim()}. Committing for someone else too? Just fill it in again.
                </Typography>
              </Box>
            )}

            {!data.open ? (
              <Box sx={{ ...sxCard(T), p: 4, textAlign: 'center' }}>
                <Typography sx={{ color: T.text, fontWeight: 800, fontSize: 16, mb: 0.5 }}>This preorder is closed.</Typography>
                <Typography sx={{ color: T.muted, fontSize: 13 }}>Missed it? Reach out to your contact — there may still be room.</Typography>
              </Box>
            ) : (
              <>
                {/* Items */}
                {data.items.map((it) => (
                  <Box key={it.id} sx={{ ...sxCard(T), p: 2.5 }}>
                    <Typography sx={{ color: T.text, fontWeight: 800, fontSize: 15, mb: 1.25 }}>{it.label}</Typography>
                    {it.sizes && it.sizes.length ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 1 }}>
                        {it.sizes.map((s) => (
                          <QtyCell key={s} label={s} T={T} value={qtys[keyOf(it.id, s)]}
                            onChange={(v) => setQtys((q) => ({ ...q, [keyOf(it.id, s)]: v }))} />
                        ))}
                      </Box>
                    ) : (
                      <Box sx={{ maxWidth: 220 }}>
                        <QtyCell label="Qty" T={T} value={qtys[keyOf(it.id, '')]}
                          onChange={(v) => setQtys((q) => ({ ...q, [keyOf(it.id, '')]: v }))} />
                      </Box>
                    )}
                  </Box>
                ))}

                {/* Who this is for */}
                <Box sx={{ ...sxCard(T), p: 2.5 }}>
                  <Typography sx={{ ...sxEyebrow(T), display: 'block', mb: 1.5 }}>Put it under</Typography>
                  <Stack gap={1.5}>
                    <TextField size="small" fullWidth placeholder="Your name *" value={name}
                      onChange={(e) => setName(e.target.value)}
                      sx={{ '& .MuiInputBase-root': { color: T.text, bgcolor: T.inset }, '& fieldset': { borderColor: `${T.line} !important` } }} />
                    <TextField size="small" fullWidth placeholder="Phone or email (optional — for questions)" value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      sx={{ '& .MuiInputBase-root': { color: T.text, bgcolor: T.inset }, '& fieldset': { borderColor: `${T.line} !important` } }} />
                    <TextField size="small" fullWidth placeholder="Anything we should know? (optional)" value={note}
                      onChange={(e) => setNote(e.target.value)} multiline minRows={1}
                      sx={{ '& .MuiInputBase-root': { color: T.text, bgcolor: T.inset }, '& fieldset': { borderColor: `${T.line} !important` } }} />
                    {formErr && <Typography sx={{ color: T.amber, fontSize: 12.5, fontWeight: 700 }}>{formErr}</Typography>}
                    <Button onClick={submit} disabled={sending}
                      sx={{ bgcolor: T.green, color: T.onAccent, fontWeight: 900, fontSize: 14.5, py: 1.1,
                        borderRadius: 2.5, textTransform: 'none', '&:hover': { bgcolor: T.green, filter: 'brightness(1.08)' },
                        '&.Mui-disabled': { bgcolor: T.inset, color: T.faint } }}>
                      {sending ? 'Sending…' : units > 0 ? `Commit ${units} unit${units === 1 ? '' : 's'} →` : 'Commit →'}
                    </Button>
                    <Typography sx={{ color: T.faint, fontSize: 11.5, textAlign: 'center' }}>
                      A commitment, not a payment — nothing is charged here.
                    </Typography>
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
