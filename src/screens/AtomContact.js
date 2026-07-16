// src/screens/AtomContact.js
//
// JP ATOM — get started (/atom/contact). The questions a merch-shop tool
// should actually ask: who you are, what you run on today, how many orders a
// month, and what the studio should handle first. Feeds the same Studio
// Inquiries inbox as every other lead (source:'atom' — backend
// controllers/email.js sendAtomLead).

import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import { Box, Stack, Typography, Button, TextField, MenuItem } from '@mui/material';
import config from '../config.json';
import { A, atomMono, AtomLogo, atomPrimaryBtn } from './AtomLanding';

const RUNS_ON = ['Spreadsheets', 'QuickBooks', 'Printavo', 'shopVOX', 'Pen & paper', 'Something else'];
const VOLUMES = ['Under 10', '10–50', '50–200', '200+'];
const WANTS = ['Quoting', 'Client approvals', 'Order tracking', 'Books / finances', 'CRM / pipeline', 'Field sales', 'A custom build'];

function ChipToggle({ label, on, onToggle }) {
  return (
    <Box onClick={onToggle} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      sx={{ px: 1.75, py: 0.7, borderRadius: 999, cursor: 'pointer', userSelect: 'none',
        fontSize: 13, fontWeight: 700,
        bgcolor: on ? A.violet : 'rgba(255,255,255,0.05)',
        color: on ? A.ink : A.muted,
        border: `1px solid ${on ? A.violet : A.line}`,
        transition: 'all .15s ease',
        '&:hover': { borderColor: A.lineHi },
        '&:focus-visible': { outline: `2px solid ${A.violet}`, outlineOffset: 2 } }}>
      {label}
    </Box>
  );
}

const tf = {
  '& .MuiInputBase-root': { color: A.text, bgcolor: A.panelHi, borderRadius: 2.5 },
  '& fieldset': { borderColor: `${A.line} !important` },
  '& .MuiInputBase-input::placeholder': { color: A.faint, opacity: 1 },
};

export default function AtomContact() {
  const [name, setName] = useState('');
  const [shop, setShop] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [runsOn, setRunsOn] = useState(new Set());
  const [volume, setVolume] = useState('');
  const [wants, setWants] = useState(new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { document.title = 'Get started — JP Atom'; }, []);

  const toggle = (set, setter) => (v) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  });

  const submit = async () => {
    setErr('');
    if (!name.trim() || !shop.trim() || !email.trim()) {
      setErr('Name, shop, and email are the three we actually need.');
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/email/atom-lead`, {
        name, companyName: shop, email, phone,
        runsOn: [...runsOn].join(', '),
        monthlyVolume: volume,
        interests: [...wants].join(', '),
        notes,
      });
      setDone(true);
    } catch (e) {
      setErr(e.response?.data?.errors?.join(' · ') || e.response?.data?.message || "That didn't go through — try again, or email nate@jointprinting.com.");
    } finally { setBusy(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: A.bg, color: A.text, position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: -260, left: '50%', transform: 'translateX(-50%)', width: 900, height: 480,
        borderRadius: '50%', background: A.glow, filter: 'blur(110px)', pointerEvents: 'none' }} />

      <Box sx={{ maxWidth: 640, mx: 'auto', px: { xs: 2.5, md: 4 }, pb: 8, position: 'relative' }}>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 3 }}>
          <Box component={RouterLink} to="/atom" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: A.text }}>
            <AtomLogo size={30} />
            <Typography sx={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3 }}>JP&nbsp;Atom</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/atom/demo" sx={{ color: A.muted, textTransform: 'none', fontWeight: 700, fontSize: 13, '&:hover': { color: A.text } }}>
            Live demo
          </Button>
        </Stack>

        {done ? (
          <Box sx={{ textAlign: 'center', pt: 8 }}>
            <Typography sx={{ fontSize: 44 }}>⚛️</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: 26, letterSpacing: -0.5, mt: 1 }}>You're in the queue.</Typography>
            <Typography sx={{ color: A.muted, fontSize: 14.5, mt: 1, maxWidth: 420, mx: 'auto' }}>
              Expect a reply within one business day — a quick walkthrough with <b>your</b> shop's
              numbers in it, not demo data. Check your inbox: you can reply to the
              confirmation with exports or screenshots of what you run on today.
            </Typography>
            <Button component={RouterLink} to="/atom/demo" sx={{ ...atomPrimaryBtn, mt: 3 }}>
              Keep driving the demo
            </Button>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 28, md: 34 }, letterSpacing: -1, lineHeight: 1.1 }}>
              Let's set up <Box component="span" sx={{ color: A.violet }}>your</Box> studio.
            </Typography>
            <Typography sx={{ color: A.muted, fontSize: 14.5, mt: 1, mb: 3.5 }}>
              Two minutes of questions so the walkthrough lands with your shop's reality in it.
              No card, no commitment — this books a walkthrough, nothing else.
            </Typography>

            <Stack gap={2.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                <TextField size="small" fullWidth placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)} sx={tf} />
                <TextField size="small" fullWidth placeholder="Shop / company *" value={shop} onChange={(e) => setShop(e.target.value)} sx={tf} />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                <TextField size="small" fullWidth placeholder="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={tf} />
                <TextField size="small" fullWidth placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} sx={tf} />
              </Stack>

              <Box>
                <Typography sx={{ ...atomMono, color: A.violet, fontSize: 10.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', mb: 1 }}>
                  What do you run the shop on today?
                </Typography>
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  {RUNS_ON.map((r) => <ChipToggle key={r} label={r} on={runsOn.has(r)} onToggle={() => toggle(runsOn, setRunsOn)(r)} />)}
                </Stack>
              </Box>

              <Box>
                <Typography sx={{ ...atomMono, color: A.violet, fontSize: 10.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', mb: 1 }}>
                  Orders per month
                </Typography>
                <TextField size="small" select value={volume} onChange={(e) => setVolume(e.target.value)}
                  sx={{ ...tf, minWidth: 200 }} SelectProps={{ displayEmpty: true }}>
                  <MenuItem value=""><em style={{ color: 'rgba(255,255,255,0.4)' }}>Pick a range</em></MenuItem>
                  {VOLUMES.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
              </Box>

              <Box>
                <Typography sx={{ ...atomMono, color: A.violet, fontSize: 10.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', mb: 1 }}>
                  What should it handle first?
                </Typography>
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  {WANTS.map((w) => <ChipToggle key={w} label={w} on={wants.has(w)} onToggle={() => toggle(wants, setWants)(w)} />)}
                </Stack>
              </Box>

              <TextField size="small" fullWidth multiline minRows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else? The messiest part of your week, a tool you hate, a build you wish existed…" sx={tf} />

              {err && <Typography sx={{ color: A.amber, fontSize: 13, fontWeight: 700 }}>{err}</Typography>}
              <Button onClick={submit} disabled={busy} sx={{ ...atomPrimaryBtn, alignSelf: 'flex-start' }}>
                {busy ? 'Sending…' : 'Book a walkthrough →'}
              </Button>
              <Typography sx={{ color: A.faint, fontSize: 11.5 }}>
                Free, and yours to say no to — you'll see it working before any talk of price.
              </Typography>
            </Stack>
          </>
        )}
      </Box>
    </Box>
  );
}
