// src/screens/LookbookView.js
// Public, token-gated lookbook gallery — the link a client opens when the
// owner shares a curated set of mockups from the Studio's Lookbooks builder
// (backend: /api/public/lookbooks). Reactions and comments land back on the
// lookbook record and surface in the builder's feedback panel.
//
// Design: deliberately NOT the Studio dark theme. This is a clean, minimal,
// light gallery — white canvas, generous whitespace, the mockups huge and
// centered — closer to a printed lookbook than a dashboard. Token / fetch /
// error handling mirrors ApprovalView (404 invalid, 410 expired).

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Stack, Typography, Button, TextField, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import axios from 'axios';
import config from '../config.json';
import JpLoader from '../common/JpLoader';

// Local light tokens — this page owns its own minimal palette (the way
// ApprovalView owns its TOKENS); the Studio's dark `D` set stays out of here.
const L = {
  bg:        '#fafaf8',                  // warm off-white canvas
  panel:     '#ffffff',
  line:      'rgba(15,26,19,0.10)',      // hairline on white
  text:      '#111a14',
  muted:     'rgba(17,26,20,0.62)',
  faint:     'rgba(17,26,20,0.42)',
  green:     '#15803d',                  // deep green — legible as text on white
  greenSoft: 'rgba(21,128,61,0.08)',
  amber:     '#b45309',
  amberSoft: 'rgba(180,83,9,0.08)',
  shadow:    '0 10px 34px rgba(15,26,19,0.07)',
};

const mono = { fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };

// The viewer's name persists per browser so a returning client never retypes it.
const NAME_KEY = 'jp-lb-name';

// Text inputs on the light canvas: white fill, hairline border, green focus.
const lightField = {
  '& .MuiOutlinedInput-root': {
    bgcolor: L.panel, color: L.text, borderRadius: 2.5, fontSize: 14,
    '& fieldset': { borderColor: L.line },
    '&:hover fieldset': { borderColor: 'rgba(15,26,19,0.24)' },
    '&.Mui-focused fieldset': { borderColor: L.green },
  },
  '& .MuiInputBase-input::placeholder': { color: L.faint, opacity: 1 },
};

function ago(d) {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// One thumbs pill. `up` picks the glyph + tone; `active` is the viewer's own
// current reaction (highlighted so reopening the link shows what they said).
function ReactBtn({ up, active, count, disabled, onClick }) {
  const Icon = up ? ThumbUpAltOutlinedIcon : ThumbDownAltOutlinedIcon;
  const tone = up ? L.green : L.amber;
  const soft = up ? L.greenSoft : L.amberSoft;
  return (
    <Button onClick={onClick} disabled={disabled} aria-pressed={active}
      sx={{
        minWidth: 0, px: 2, py: 0.8, borderRadius: 999, textTransform: 'none',
        display: 'inline-flex', gap: 0.75, fontWeight: 700, fontSize: 13,
        color: active ? tone : L.muted,
        border: `1.5px solid ${active ? tone : L.line}`,
        bgcolor: active ? soft : L.panel,
        transition: 'all 160ms ease',
        '&:hover': { borderColor: tone, color: tone, bgcolor: soft },
      }}>
      <Icon sx={{ fontSize: 18 }} />
      {up ? 'Love it' : 'Not this one'}
      {count > 0 && (
        <Box component="span" sx={{ ...mono, fontSize: 12, color: active ? tone : L.faint }}>{count}</Box>
      )}
    </Button>
  );
}

// Comment thread + composer for one mockup (or the whole lookbook when
// remoteId is ''). Everyone on the client's side sees the running notes, so
// a team can react together on one link.
function CommentBlock({ comments, draft, onDraft, onSend, busy, placeholder }) {
  const canSend = !!draft.trim() && !busy;
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      {comments.length > 0 && (
        <Stack spacing={1} sx={{ mt: 2.5, textAlign: 'left' }}>
          {comments.map((f, i) => (
            <Box key={i} sx={{ bgcolor: L.panel, border: `1px solid ${L.line}`, borderRadius: 2.5, px: 1.75, py: 1.25 }}>
              <Stack direction="row" alignItems="baseline" gap={1}>
                <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: L.text }}>{f.by || 'Someone'}</Typography>
                <Typography sx={{ color: L.faint, fontSize: 11 }}>{ago(f.at)}</Typography>
              </Stack>
              <Typography sx={{ color: L.muted, fontSize: 13.5, mt: 0.4, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {f.comment}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
      <Stack direction="row" gap={1} alignItems="flex-start" sx={{ mt: 2 }}>
        <TextField
          value={draft} onChange={(e) => onDraft(e.target.value)}
          placeholder={placeholder} size="small" fullWidth multiline maxRows={4}
          sx={lightField}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canSend) { e.preventDefault(); onSend(); }
          }}
        />
        <Button onClick={onSend} disabled={!canSend}
          sx={{
            px: 2.25, py: 0.9, borderRadius: 999, textTransform: 'none', flexShrink: 0,
            fontWeight: 800, fontSize: 13, bgcolor: L.green, color: '#fff',
            '&:hover': { bgcolor: '#166534' },
            '&.Mui-disabled': { bgcolor: 'rgba(21,128,61,0.25)', color: 'rgba(255,255,255,0.7)' },
          }}>
          {busy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Send'}
        </Button>
      </Stack>
    </Box>
  );
}

export default function LookbookView() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  const q = `token=${encodeURIComponent(token || '')}`;

  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [errKind, setErrKind] = useState('');   // '' | 'invalid' | 'expired'
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(() => {
    try { return window.localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; }
  });
  const [needName, setNeedName] = useState(false);
  const [drafts, setDrafts] = useState({});     // remoteId ('' = overall) -> comment draft
  const [busyKey, setBusyKey] = useState('');   // remoteId (or 'overall') mid-POST
  // "Request pricing" — the gallery's path from browsing to a real quote.
  // sel: remoteId -> qty string for the designs the client wants priced.
  const [rpOpen, setRpOpen] = useState(false);
  const [rpSel, setRpSel] = useState({});
  const [rpMeta, setRpMeta] = useState({ email: '', phone: '', shipTo: '', note: '' });
  const [rpBusy, setRpBusy] = useState(false);
  const [rpDone, setRpDone] = useState(false);
  const [rpErr, setRpErr] = useState('');
  const nameBoxRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) { setErr('This link is missing its token.'); setErrKind('invalid'); setLoading(false); return; }
      try {
        const r = await axios.get(`${config.backendUrl}/api/public/lookbooks/${id}?${q}`);
        if (!cancelled) setData(r.data);
      } catch (e) {
        if (cancelled) return;
        setErr(e.response?.data?.message || '');
        setErrKind(e.response?.status === 410 ? 'expired' : 'invalid');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, token, q]);

  // Retitle the tab once the lookbook loads (the route meta only knows "Lookbook").
  useEffect(() => {
    if (data?.title) document.title = `${data.title} | Joint Printing`;
  }, [data]);

  const refresh = async () => {
    try {
      const r = await axios.get(`${config.backendUrl}/api/public/lookbooks/${id}?${q}`);
      setData(r.data);
    } catch (_) { /* keep what's on screen */ }
  };

  const saveName = (v) => {
    setName(v);
    if (v.trim()) setNeedName(false);
    try { window.localStorage.setItem(NAME_KEY, v); } catch (_) { /* private mode */ }
  };

  // Feedback needs a name — nudge to the top field instead of posting "".
  const requireName = () => {
    if (name.trim()) return true;
    setNeedName(true);
    try { nameBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* older browsers */ }
    setTimeout(() => { try { nameInputRef.current?.focus(); } catch (_) { /* detached */ } }, 350);
    return false;
  };

  const post = async (mockupRemoteId, { reaction = '', comment = '' }) => {
    if (!requireName()) return;
    const key = mockupRemoteId || 'overall';
    setBusyKey(key);
    try {
      const r = await axios.post(`${config.backendUrl}/api/public/lookbooks/${id}/feedback?${q}`,
        { mockupRemoteId, reaction, comment: comment.trim(), by: name.trim() });
      if (comment) setDrafts((d) => ({ ...d, [mockupRemoteId]: '' }));
      // The POST echoes the updated feedback array — patch it in place instead
      // of re-downloading the whole payload (legacy lookbooks carry inline
      // base64 images, so a full refetch is a multi-MB stall per tap).
      if (Array.isArray(r.data?.feedback)) {
        setData((prev) => (prev ? { ...prev, feedback: r.data.feedback } : prev));
      } else {
        await refresh();   // older backend without the echo — fall back
      }
    } catch (e) {
      alert(e.response?.data?.message || "That didn't send — please try again in a moment.");
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <JpLoader size={72} label="Loading…" tone="light" />
      </Box>
    );
  }
  if (err || errKind || !data) {
    const expired = errKind === 'expired';
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ bgcolor: L.panel, border: `1px solid ${L.line}`, borderRadius: 3, boxShadow: L.shadow, p: 4, maxWidth: 460, textAlign: 'center' }}>
          <Typography sx={{ color: expired ? L.amber : L.text, fontWeight: 800, fontSize: 19, mb: 1 }}>
            {expired ? 'This link has expired' : "This lookbook link isn't valid"}
          </Typography>
          <Typography sx={{ color: L.muted, fontSize: 13.5, lineHeight: 1.6 }}>
            {expired
              ? 'Ask Joint Printing for a fresh one — we’ll send it right over.'
              : (err || 'Double-check the link, or ask Joint Printing to send it again.')}
          </Typography>
        </Box>
      </Box>
    );
  }

  const mockups = data.mockups || [];
  const feedback = data.feedback || [];
  const me = name.trim();

  // Latest reaction per person for one mockup — a re-tap replaces server-side,
  // but comment entries can also carry reactions, so "current" = newest by `at`.
  const latestByPerson = (rid) => {
    const m = new Map();
    feedback.forEach((f) => {
      if ((f.mockupRemoteId || '') !== rid || !f.reaction) return;
      const cur = m.get(f.by || '');
      if (!cur || new Date(f.at) - new Date(cur.at) >= 0) m.set(f.by || '', f);
    });
    return m;
  };
  const commentsFor = (rid) => feedback
    .filter((f) => (f.mockupRemoteId || '') === rid && f.comment)
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  // Open the pricing sheet pre-checked with everything this viewer thumbed up
  // (their browsing already told us what they like) — 50 units is the seed
  // quantity, editable per design.
  const openPricing = () => {
    if (!me) { setNeedName(true); nameBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); nameInputRef.current?.focus(); return; }
    setRpDone(false);   // a second request in the same visit starts at the picker, not the old 🎉 screen
    setRpSel((prev) => {
      if (Object.keys(prev).length) return prev;   // reopening keeps their edits
      const next = {};
      mockups.forEach((m) => {
        const mine = latestByPerson(m.remoteId || '').get(me);
        if (mine && mine.reaction === 'up') next[m.remoteId] = '50';
      });
      return next;
    });
    setRpErr('');
    setRpOpen(true);
  };
  const toggleRp = (rid) => setRpSel((prev) => {
    const next = { ...prev };
    if (next[rid] !== undefined) delete next[rid]; else next[rid] = '50';
    return next;
  });
  const submitPricing = async () => {
    const picks = Object.entries(rpSel).map(([remoteId, qty]) => ({ remoteId, qty: Number(qty) || 1 }));
    if (!picks.length) { setRpErr('Tick at least one design.'); return; }
    setRpBusy(true); setRpErr('');
    try {
      await axios.post(`${config.backendUrl}/api/public/lookbooks/${id}/request-pricing?token=${encodeURIComponent(token)}`, {
        picks, by: me, ...rpMeta,
      });
      setRpDone(true);
      setRpSel({});   // next open re-derives from their 👍s instead of re-sending these
    } catch (e) {
      setRpErr(e.response?.data?.message || 'Could not send — try again in a minute.');
    } finally {
      setRpBusy(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: L.bg, color: L.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <Box sx={{ maxWidth: 880, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 4, sm: 7 } }}>
        {/* ── Header — brand whisper, client logo, big title ─────────────── */}
        <Stack alignItems="center" textAlign="center" spacing={1.25}>
          <Stack direction="row" alignItems="center" gap={0.9} sx={{ mb: 1 }}>
            <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              sx={{ width: 20, height: 20, objectFit: 'contain' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: L.faint }}>
              Joint Printing · Lookbook
            </Typography>
          </Stack>
          {data.logo && (
            <Box sx={{
              bgcolor: L.panel, border: `1px solid ${L.line}`, borderRadius: 2.5, boxShadow: L.shadow,
              p: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: 200,
            }}>
              <Box component="img" src={data.logo} alt={data.companyName || ''} loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                sx={{ maxWidth: '100%', maxHeight: 72, objectFit: 'contain', display: 'block' }} />
            </Box>
          )}
          {data.companyName && (
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: L.green }}>
              {data.companyName}
            </Typography>
          )}
          <Typography component="h1" sx={{ fontSize: { xs: 30, sm: 44 }, fontWeight: 900, letterSpacing: -1, lineHeight: 1.08 }}>
            {data.title || 'Lookbook'}
          </Typography>
          {data.subtitle && (
            <Typography sx={{ color: L.muted, fontSize: { xs: 14.5, sm: 16 }, lineHeight: 1.6, maxWidth: 560 }}>
              {data.subtitle}
            </Typography>
          )}
        </Stack>

        {/* ── Who's looking — one name unlocks reactions + notes ─────────── */}
        <Box ref={nameBoxRef} sx={{
          mt: { xs: 4, sm: 6 }, mx: 'auto', maxWidth: 440,
          bgcolor: L.panel, border: `1px solid ${needName ? L.amber : L.line}`, borderRadius: 3,
          boxShadow: L.shadow, p: 2.25, transition: 'border-color 200ms ease',
        }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: L.faint, mb: 1 }}>
            Your name
          </Typography>
          <TextField
            value={name} onChange={(e) => saveName(e.target.value)} inputRef={nameInputRef}
            placeholder="So we know who the feedback is from" size="small" fullWidth
            error={needName}
            helperText={needName ? 'Add your name first — then tap or comment away.' : ' '}
            sx={{ ...lightField, '& .MuiFormHelperText-root': { mx: 0, color: needName ? L.amber : L.faint } }}
          />
          <Typography sx={{ color: L.faint, fontSize: 12, lineHeight: 1.5, mt: -0.5 }}>
            Tap a thumb or leave a note under any design — we see it instantly.
          </Typography>
        </Box>

        {/* ── The gallery — one big card per mockup ──────────────────────── */}
        <Stack spacing={{ xs: 6, sm: 9 }} sx={{ mt: { xs: 5, sm: 8 } }}>
          {mockups.map((m, i) => {
            const rid = m.remoteId || '';
            const showBack = data.showBack !== false && !!m.back;
            const reactions = latestByPerson(rid);
            let up = 0; let down = 0;
            reactions.forEach((f) => { if (f.reaction === 'up') up += 1; else if (f.reaction === 'down') down += 1; });
            const mine = (me && reactions.get(me)?.reaction) || '';
            const busy = busyKey === (rid || 'overall');
            const frameSx = {
              bgcolor: L.panel, border: `1px solid ${L.line}`, borderRadius: 3,
              boxShadow: L.shadow, overflow: 'hidden', position: 'relative',
            };
            return (
              <Box key={rid || i} component="section" sx={{ textAlign: 'center' }}>
                {data.showLabels !== false && (
                  <Stack direction="row" alignItems="baseline" justifyContent="center" gap={1} sx={{ mb: 1.75 }}>
                    <Typography sx={{ ...mono, color: L.faint, fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: 16, sm: 18 }, color: L.text }}>
                      {m.name || 'Untitled'}
                    </Typography>
                    {m.mockupNum && (
                      <Typography sx={{ ...mono, color: L.faint, fontSize: 12 }}>#{m.mockupNum}</Typography>
                    )}
                  </Stack>
                )}
                <Box sx={{
                  display: 'grid', gap: { xs: 1.5, sm: 2 },
                  gridTemplateColumns: { xs: '1fr', sm: showBack ? '1fr 1fr' : '1fr' },
                }}>
                  <Box sx={frameSx}>
                    <Box component="img" src={m.front} alt={m.name || 'Mockup'} loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      sx={{ width: '100%', display: 'block' }} />
                    {showBack && (
                      <Typography sx={{
                        position: 'absolute', top: 10, left: 10, ...mono, fontSize: 10, fontWeight: 800,
                        letterSpacing: 1, textTransform: 'uppercase', color: L.faint,
                        bgcolor: 'rgba(255,255,255,0.85)', px: 0.9, py: 0.25, borderRadius: 1,
                      }}>Front</Typography>
                    )}
                  </Box>
                  {showBack && (
                    <Box sx={frameSx}>
                      <Box component="img" src={m.back} alt={`${m.name || 'Mockup'} — back`} loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        sx={{ width: '100%', display: 'block' }} />
                      <Typography sx={{
                        position: 'absolute', top: 10, left: 10, ...mono, fontSize: 10, fontWeight: 800,
                        letterSpacing: 1, textTransform: 'uppercase', color: L.faint,
                        bgcolor: 'rgba(255,255,255,0.85)', px: 0.9, py: 0.25, borderRadius: 1,
                      }}>Back</Typography>
                    </Box>
                  )}
                </Box>
                {m.caption && (
                  <Typography sx={{ color: L.muted, fontSize: 14.5, lineHeight: 1.6, mt: 2, maxWidth: 560, mx: 'auto' }}>
                    {m.caption}
                  </Typography>
                )}

                <Stack direction="row" justifyContent="center" gap={1.25} sx={{ mt: 2.5 }}>
                  <ReactBtn up active={mine === 'up'} count={up} disabled={busy}
                    onClick={() => { if (mine !== 'up') post(rid, { reaction: 'up' }); }} />
                  <ReactBtn up={false} active={mine === 'down'} count={down} disabled={busy}
                    onClick={() => { if (mine !== 'down') post(rid, { reaction: 'down' }); }} />
                </Stack>

                <CommentBlock
                  comments={commentsFor(rid)}
                  draft={drafts[rid] || ''}
                  onDraft={(v) => setDrafts((d) => ({ ...d, [rid]: v }))}
                  onSend={() => post(rid, { comment: drafts[rid] || '' })}
                  busy={busy}
                  placeholder="Leave a note about this one…"
                />
              </Box>
            );
          })}
        </Stack>

        {mockups.length === 0 && (
          <Typography sx={{ textAlign: 'center', color: L.muted, fontSize: 14, mt: 6 }}>
            Nothing here yet — check back soon.
          </Typography>
        )}

        {/* ── One note about the whole set (mockupRemoteId '') ───────────── */}
        {mockups.length > 0 && (
          <Box sx={{ mt: { xs: 7, sm: 10 }, mx: 'auto', maxWidth: 560, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Anything overall?</Typography>
            <Typography sx={{ color: L.muted, fontSize: 13, mt: 0.5, lineHeight: 1.6 }}>
              A note about the whole set — direction, colors, what to try next.
            </Typography>
            <CommentBlock
              comments={commentsFor('')}
              draft={drafts[''] || ''}
              onDraft={(v) => setDrafts((d) => ({ ...d, '': v }))}
              onSend={() => post('', { comment: drafts[''] || '' })}
              busy={busyKey === 'overall'}
              placeholder="Tell us what you're thinking…"
            />
          </Box>
        )}

        <Typography sx={{ textAlign: 'center', color: L.faint, fontSize: 11.5, mt: { xs: 7, sm: 10 }, pb: 9 }}>
          Designed & printed by Joint Printing · jointprinting.com
        </Typography>
      </Box>

      {/* ── Sticky "Request pricing" bar — browsing becomes a quote in one
          tap. Always reachable; the dialog pre-checks what they 👍'd. ───── */}
      {mockups.length > 0 && (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 5,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          pb: { xs: 2, sm: 3 }, pt: 4,
          background: 'linear-gradient(to top, rgba(250,250,248,0.96), rgba(250,250,248,0))' }}>
          <Button onClick={openPricing} startIcon={<RequestQuoteOutlinedIcon />}
            sx={{ pointerEvents: 'auto', bgcolor: L.green, color: '#fff', textTransform: 'none',
              fontWeight: 800, fontSize: 15, px: 3.5, py: 1.25, borderRadius: 999,
              boxShadow: '0 12px 34px rgba(21,128,61,0.35)',
              '&:hover': { bgcolor: '#116932' } }}>
            Request pricing
          </Button>
        </Box>
      )}

      <Dialog open={rpOpen} onClose={() => !rpBusy && setRpOpen(false)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { bgcolor: L.bg, color: L.text, borderRadius: 3 } }}>
        {rpDone ? (
          <DialogContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 40, mb: 1 }}>🎉</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: 20 }}>Request sent!</Typography>
            <Typography sx={{ color: L.muted, fontSize: 14, mt: 1, lineHeight: 1.6, maxWidth: 380, mx: 'auto' }}>
              We're pricing your picks now — your quote will land in your inbox shortly.
            </Typography>
            <Button onClick={() => setRpOpen(false)}
              sx={{ mt: 3, bgcolor: L.green, color: '#fff', textTransform: 'none', fontWeight: 800,
                px: 3, borderRadius: 999, '&:hover': { bgcolor: '#116932' } }}>
              Done
            </Button>
          </DialogContent>
        ) : (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 0.5 }}>
              <RequestQuoteOutlinedIcon sx={{ color: L.green }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>Request pricing</Typography>
                <Typography sx={{ color: L.muted, fontSize: 12.5 }}>
                  Tick the designs you want, set quantities — we'll send a full quote.
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => !rpBusy && setRpOpen(false)} sx={{ color: L.faint }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Stack sx={{ border: `1px solid ${L.line}`, borderRadius: 2.5, overflow: 'hidden', mt: 1 }}>
                {mockups.map((m) => {
                  const rid = m.remoteId || '';
                  const on = rpSel[rid] !== undefined;
                  return (
                    <Stack key={rid} direction="row" alignItems="center" gap={1}
                      onClick={() => toggleRp(rid)}
                      sx={{ px: 1.25, py: 0.75, cursor: 'pointer', bgcolor: on ? L.greenSoft : 'transparent',
                        borderBottom: `1px solid ${L.line}`, '&:last-of-type': { borderBottom: 'none' },
                        transition: 'background 150ms ease' }}>
                      <Checkbox size="small" checked={on} sx={{ color: L.faint, '&.Mui-checked': { color: L.green }, p: 0.5 }} />
                      {m.front && (
                        <Box component="img" src={m.front} alt="" loading="lazy"
                          sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${L.line}` }} />
                      )}
                      <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 700, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name || m.caption || 'Design'}
                      </Typography>
                      {on && (
                        <TextField size="small" type="number" value={rpSel[rid]}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRpSel((prev) => ({ ...prev, [rid]: e.target.value }))}
                          InputProps={{ endAdornment: <Typography sx={{ color: L.faint, fontSize: 11, ml: 0.5 }}>units</Typography> }}
                          sx={{ ...lightField, width: 118, '& .MuiInputBase-input': { py: 0.6, fontSize: 13, ...mono } }} />
                      )}
                    </Stack>
                  );
                })}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 0.5 }}>
                <TextField size="small" fullWidth placeholder="Email for the quote" value={rpMeta.email}
                  onChange={(e) => setRpMeta((v) => ({ ...v, email: e.target.value }))} sx={lightField} />
                <TextField size="small" fullWidth placeholder="Phone (optional)" value={rpMeta.phone}
                  onChange={(e) => setRpMeta((v) => ({ ...v, phone: e.target.value }))} sx={lightField} />
              </Stack>
              <TextField size="small" fullWidth placeholder="Ship to — address or city, state (e.g. Trenton, NJ)"
                value={rpMeta.shipTo}
                onChange={(e) => setRpMeta((v) => ({ ...v, shipTo: e.target.value }))} sx={lightField} />
              <TextField size="small" fullWidth multiline minRows={2}
                placeholder="Anything else — sizes, colors, deadline…"
                value={rpMeta.note}
                onChange={(e) => setRpMeta((v) => ({ ...v, note: e.target.value }))} sx={lightField} />
              {rpErr && <Typography sx={{ color: L.amber, fontSize: 12.5, fontWeight: 700 }}>{rpErr}</Typography>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setRpOpen(false)} disabled={rpBusy}
                sx={{ color: L.muted, textTransform: 'none', fontWeight: 700 }}>
                Cancel
              </Button>
              <Button onClick={submitPricing} disabled={rpBusy}
                sx={{ bgcolor: L.green, color: '#fff', textTransform: 'none', fontWeight: 800, px: 3,
                  borderRadius: 999, '&:hover': { bgcolor: '#116932' },
                  '&.Mui-disabled': { bgcolor: L.greenSoft, color: L.faint } }}>
                {rpBusy ? <CircularProgress size={18} sx={{ color: L.green }} /> : 'Send request'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
