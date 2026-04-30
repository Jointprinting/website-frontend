// src/screens/Studio.js
//
// Password-protected admin/studio page. Three tabs:
//   1) Manual entry — Alpha Broder XML product creation
//   2) Submissions — mini-CRM for contact form leads
//   3) Mockup Studio — embedded mockup builder (iframes /jpstudio/)
//
// The Mockup Studio tab loads /jpstudio/index.html with the studio JWT
// passed via URL param. The tool's own auth gate verifies the token
// before showing anything, so even direct visits to /jpstudio/ are safe.

import * as React from 'react';
import axios from 'axios';
import {
  Box,
  Stack,
  TextField,
  MenuItem,
  Button,
  useMediaQuery,
  FormControl,
  Select,
  Paper,
  Container,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Divider,
  Typography as MuiTypography,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link as MuiLink,
  Fade,
  Grow,
  Slide,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import InboxIcon from '@mui/icons-material/Inbox';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import config from '../config.json';

const TOKEN_KEY = 'jpStudioToken';

const BRAND = {
  bg:       '#0c1410',
  panel:    '#162420',
  border:   '#1a3d2b',
  green:    '#4ade80',
  greenDk:  '#1a3d2b',
  white:    '#ffffff',
  muted:    'rgba(255,255,255,0.65)',
  faint:    'rgba(255,255,255,0.08)',
};

const STATUS_OPTIONS = [
  { value: 'new',          label: 'New',          color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  { value: 'contacted',    label: 'Contacted',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { value: 'quoted',       label: 'Quoted',       color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  { value: 'won',          label: 'Won',          color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  { value: 'lost',         label: 'Lost',         color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  { value: 'spam',         label: 'Spam',         color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
];

const statusMeta = (s) => STATUS_OPTIONS.find((x) => x.value === s) || STATUS_OPTIONS[0];

// ─────────────────────────────────────────────────────────────────────────────
//  Login
// ─────────────────────────────────────────────────────────────────────────────
function Login({ onAuthed }) {
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!pw) return;
    setBusy(true);
    try {
      const res = await axios.post(`${config.backendUrl}/api/auth/studio-login`, { password: pw });
      if (res.data?.token) {
        sessionStorage.setItem(TOKEN_KEY, res.data.token);
        onAuthed(res.data.token);
      } else {
        setErr('Login failed.');
      }
    } catch (e) {
      setErr(e?.response?.data?.message || 'Wrong password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: BRAND.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
      position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', top: -120, left: -120, width: 380, height: 380,
        borderRadius: '50%', bgcolor: 'rgba(74,222,128,0.06)',
        animation: 'float1 14s ease-in-out infinite',
        '@keyframes float1': {
          '0%, 100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(40px,30px)' },
        },
      }} />
      <Box sx={{
        position: 'absolute', bottom: -160, right: -160, width: 460, height: 460,
        borderRadius: '50%', bgcolor: 'rgba(74,222,128,0.04)',
        animation: 'float2 18s ease-in-out infinite',
        '@keyframes float2': {
          '0%, 100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(-50px,-20px)' },
        },
      }} />
      <Grow in timeout={500}>
        <Paper elevation={0} sx={{
          p: 4, borderRadius: 4, width: '100%', maxWidth: 420,
          bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`,
          position: 'relative', zIndex: 1,
        }}>
          <Stack spacing={2} alignItems="center" mb={3}>
            <Box sx={{
              bgcolor: BRAND.greenDk, color: BRAND.green,
              width: 56, height: 56, borderRadius: 2.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 6px rgba(74,222,128,0.06)',
            }}>
              <LockIcon sx={{ fontSize: 28 }} />
            </Box>
            <MuiTypography variant="h5" fontWeight={800} sx={{ color: BRAND.white }}>
              Joint Printing · Studio
            </MuiTypography>
            <MuiTypography variant="body2" sx={{ color: BRAND.muted, textAlign: 'center' }}>
              Enter your studio password to continue.
            </MuiTypography>
          </Stack>
          <form onSubmit={submit}>
            <Stack spacing={2}>
              <TextField
                autoFocus
                type={show ? 'text' : 'password'}
                label="Password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                fullWidth size="medium"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.04)', color: BRAND.white,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: BRAND.green },
                    '&.Mui-focused fieldset': { borderColor: BRAND.green },
                  },
                  '& .MuiInputLabel-root': { color: BRAND.muted },
                  '& .MuiInputLabel-root.Mui-focused': { color: BRAND.green },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShow((s) => !s)} edge="end" size="small" sx={{ color: BRAND.muted }}>
                        {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Fade in={!!err}>
                <Box>{err && <Alert severity="error" sx={{ borderRadius: 2 }}>{err}</Alert>}</Box>
              </Fade>
              <Button
                type="submit" variant="contained" size="large" disabled={busy} fullWidth
                sx={{
                  borderRadius: 2, fontWeight: 800, textTransform: 'none', py: 1.4,
                  bgcolor: BRAND.green, color: BRAND.greenDk,
                  '&:hover': { bgcolor: '#22c55e', transform: 'translateY(-1px)' },
                  '&:disabled': { bgcolor: 'rgba(74,222,128,0.4)' },
                  transition: 'all 0.15s',
                }}
              >
                {busy ? <CircularProgress size={22} sx={{ color: BRAND.greenDk }} /> : 'Sign in'}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Grow>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mockup Studio tab — iframes /jpstudio/ with the auth token
// ─────────────────────────────────────────────────────────────────────────────
function MockupStudioTab({ token }) {
  const iframeRef = React.useRef(null);
  const [loaded, setLoaded] = React.useState(false);
  const [iframeKey, setIframeKey] = React.useState(0); // bump to force reload

  // Pass the token via URL param on first load. The tool's auth gate handles
  // the token, then strips it from the URL.
  const src = `/jpstudio/?t=${encodeURIComponent(token)}`;

  // Belt-and-suspenders: also postMessage the token in case URL param doesn't arrive
  // fast enough (rare).
  React.useEffect(() => {
    const onLoad = () => {
      setLoaded(true);
      try {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'jp-studio-token', token },
            '*'
          );
        }
      } catch (_) {}
    };
    const node = iframeRef.current;
    if (node) {
      node.addEventListener('load', onLoad);
      return () => node.removeEventListener('load', onLoad);
    }
  }, [token, iframeKey]);

  const reload = () => {
    setLoaded(false);
    setIframeKey((k) => k + 1);
  };

  return (
    <Box sx={{ position: 'relative', height: 'calc(100vh - 220px)', minHeight: 560, bgcolor: '#080910', borderRadius: 1, overflow: 'hidden' }}>
      {/* Tiny toolbar above the iframe */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          position: 'absolute', top: 8, right: 8, zIndex: 2,
          bgcolor: 'rgba(8,9,16,.7)', backdropFilter: 'blur(8px)',
          borderRadius: 999, px: 1, py: 0.5,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <IconButton size="small" onClick={reload} title="Reload mockup studio" sx={{ color: BRAND.muted, '&:hover': { color: BRAND.green } }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          component="a"
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          sx={{ color: BRAND.muted, '&:hover': { color: BRAND.green } }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Stack>

      {!loaded && (
        <Fade in={!loaded}>
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 2, zIndex: 1,
          }}>
            <CircularProgress sx={{ color: BRAND.green }} />
            <MuiTypography variant="body2" sx={{ color: BRAND.muted }}>
              Loading mockup studio…
            </MuiTypography>
          </Box>
        </Fade>
      )}

      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={src}
        title="JP Mockup Studio"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#080910',
          display: 'block',
        }}
        // Allow downloads (PDF export), clipboard, etc. Disallow popups, parent navigation.
        allow="clipboard-read; clipboard-write; downloads"
      />
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Submissions tab (mini-CRM)
// ─────────────────────────────────────────────────────────────────────────────
function SubmissionsTab({ token }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const fetchSubmissions = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = `${config.backendUrl}/api/submissions${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setItems(res.data?.submissions || []);
    } catch (e) {
      console.error('Could not load submissions', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  React.useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const openDetail = (item) => { setSelected(item); setDialogOpen(true); };

  const updateStatus = async (id, newStatus, notesAdmin) => {
    try {
      const body = {};
      if (newStatus !== undefined) body.status = newStatus;
      if (notesAdmin !== undefined) body.notesAdmin = notesAdmin;
      const res = await axios.patch(
        `${config.backendUrl}/api/submissions/${id}`, body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated = res.data?.submission;
      if (updated) {
        setItems((arr) => arr.map((it) => (it._id === id ? updated : it)));
        if (selected && selected._id === id) setSelected(updated);
      }
    } catch (e) {
      alert('Could not update: ' + (e?.response?.data?.message || e.message));
    }
  };

  const removeSubmission = async (id) => {
    if (!window.confirm('Delete this submission permanently? This cannot be undone.')) return;
    try {
      await axios.delete(`${config.backendUrl}/api/submissions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((arr) => arr.filter((it) => it._id !== id));
      setDialogOpen(false);
    } catch (e) {
      alert('Could not delete: ' + (e?.response?.data?.message || e.message));
    }
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch { return iso; }
  };

  const statusCounts = React.useMemo(() => {
    const counts = { all: items.length };
    STATUS_OPTIONS.forEach((s) => { counts[s.value] = 0; });
    items.forEach((it) => { counts[it.status || 'new'] = (counts[it.status || 'new'] || 0) + 1; });
    return counts;
  }, [items]);

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      <MuiTypography variant="body2" sx={{ color: BRAND.muted, mb: 2.5 }}>
        Every contact form submission is saved here so you don&apos;t lose a lead even
        if email hiccups. Filter, click any row for details, update as you work.
      </MuiTypography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
        <FilterPill
          active={statusFilter === 'all'} label="All" count={statusCounts.all}
          onClick={() => setStatusFilter('all')} color={BRAND.green}
        />
        {STATUS_OPTIONS.map((s) => (
          <FilterPill
            key={s.value}
            active={statusFilter === s.value} label={s.label} count={statusCounts[s.value] || 0}
            onClick={() => setStatusFilter(s.value)} color={s.color}
          />
        ))}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          startIcon={<RefreshIcon />} onClick={fetchSubmissions} size="small"
          sx={{
            textTransform: 'none', color: BRAND.muted,
            '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.08)' },
          }}
        >Refresh</Button>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress sx={{ color: BRAND.green }} size={32} />
        </Box>
      ) : items.length === 0 ? (
        <Fade in>
          <Box py={8} textAlign="center">
            <InboxIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.18)', mb: 2 }} />
            <MuiTypography sx={{ color: BRAND.muted }}>
              {statusFilter === 'all' ? 'No submissions yet.' : `No "${statusMeta(statusFilter).label}" submissions.`}
            </MuiTypography>
            <MuiTypography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
              They&apos;ll appear here as soon as someone fills out your contact form.
            </MuiTypography>
          </Box>
        </Fade>
      ) : (
        <Stack spacing={1.2}>
          {items.map((it, idx) => (
            <Grow in timeout={Math.min(180 + idx * 50, 600)} key={it._id}>
              <Box>
                <SubmissionRow item={it} onClick={() => openDetail(it)} formatDate={formatDate} />
              </Box>
            </Grow>
          ))}
        </Stack>
      )}

      <Dialog
        open={dialogOpen} onClose={() => setDialogOpen(false)}
        maxWidth="sm" fullWidth
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' }}
        PaperProps={{
          sx: {
            bgcolor: BRAND.panel, color: BRAND.white,
            borderRadius: 3, border: `1px solid ${BRAND.border}`,
          },
        }}
      >
        <DialogTitle sx={{ pr: 6, borderBottom: `1px solid ${BRAND.faint}` }}>
          <Box>
            <MuiTypography fontWeight={800} fontSize={18}>{selected?.name}</MuiTypography>
            <MuiTypography variant="caption" sx={{ color: BRAND.muted }}>
              {selected?.companyName}
            </MuiTypography>
          </Box>
          <IconButton
            onClick={() => removeSubmission(selected._id)} size="small"
            sx={{
              position: 'absolute', right: 12, top: 12, color: '#f87171',
              '&:hover': { bgcolor: 'rgba(248,113,113,0.1)' },
            }}
            aria-label="Delete submission"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: BRAND.faint }}>
          {selected && (
            <Stack spacing={2}>
              <Box>
                <MuiTypography variant="caption" sx={{ color: BRAND.muted }}>Status</MuiTypography>
                <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                  <Select
                    value={selected.status || 'new'}
                    onChange={(e) => updateStatus(selected._id, e.target.value)}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.04)', color: BRAND.white,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                      '& .MuiSvgIcon-root': { color: BRAND.muted },
                    }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Divider sx={{ borderColor: BRAND.faint }} />
              <Box>
                <Detail label="Email">
                  <MuiLink href={`mailto:${selected.email}`} sx={{ color: BRAND.green }}>{selected.email}</MuiLink>
                </Detail>
                <Detail label="Phone">
                  <MuiLink href={`tel:${(selected.phone || '').replace(/\D/g, '')}`} sx={{ color: BRAND.green }}>{selected.phone}</MuiLink>
                </Detail>
                <Detail label="Quantity per item">{selected.quantity || '-'}</Detail>
                <Detail label="In-hand date">{selected.inHandDate || '-'}</Detail>
                <Detail label="Submitted">{formatDate(selected.createdAt)}</Detail>
                <Detail label="Email status">
                  <Chip label={selected.emailStatus || '-'} size="small" sx={{
                    bgcolor: selected.emailStatus === 'sent' ? 'rgba(74,222,128,0.14)' : 'rgba(248,113,113,0.14)',
                    color: selected.emailStatus === 'sent' ? BRAND.green : '#f87171',
                    fontWeight: 600,
                  }} />
                </Detail>
                {selected.attachments?.length > 0 && (
                  <Detail label="Attachments">
                    {selected.attachments.map((a, i) => (
                      <div key={i} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {a.filename} <span style={{ color: BRAND.muted }}>({Math.round((a.sizeBytes || 0) / 1024)}KB)</span>
                      </div>
                    ))}
                  </Detail>
                )}
              </Box>
              {selected.notes && (
                <>
                  <Divider sx={{ borderColor: BRAND.faint }} />
                  <Box>
                    <MuiTypography variant="caption" sx={{ color: BRAND.muted }}>Customer notes</MuiTypography>
                    <Paper variant="outlined" sx={{
                      p: 1.5, mt: 0.5, whiteSpace: 'pre-wrap', fontSize: 14,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      borderColor: BRAND.faint, color: BRAND.white,
                    }}>{selected.notes}</Paper>
                  </Box>
                </>
              )}
              {selected.selectedProducts?.length > 0 && (
                <>
                  <Divider sx={{ borderColor: BRAND.faint }} />
                  <Box>
                    <MuiTypography variant="caption" sx={{ color: BRAND.muted }}>Selected products</MuiTypography>
                    <Stack spacing={0.3} mt={0.5}>
                      {selected.selectedProducts.map((p, i) => (
                        <MuiTypography key={i} variant="body2" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                          • {p.vendor || ''} {p.name || ''} <span style={{ color: BRAND.muted }}>(style {p.style || 'n/a'})</span>
                        </MuiTypography>
                      ))}
                    </Stack>
                  </Box>
                </>
              )}
              <Divider sx={{ borderColor: BRAND.faint }} />
              <Box>
                <MuiTypography variant="caption" sx={{ color: BRAND.muted }}>
                  Internal notes (only visible here)
                </MuiTypography>
                <TextField
                  fullWidth multiline minRows={3} size="small"
                  sx={{
                    mt: 0.5,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255,255,255,0.04)', color: BRAND.white, fontSize: 14,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                      '&:hover fieldset': { borderColor: BRAND.green },
                      '&.Mui-focused fieldset': { borderColor: BRAND.green },
                    },
                  }}
                  value={selected.notesAdmin || ''}
                  onChange={(e) => setSelected({ ...selected, notesAdmin: e.target.value })}
                  onBlur={() => updateStatus(selected._id, undefined, selected.notesAdmin || '')}
                  placeholder="Track your conversation, quoted price, follow-up date..."
                />
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${BRAND.faint}`, px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', color: BRAND.muted, '&:hover': { color: BRAND.white } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function FilterPill({ active, label, count, onClick, color }) {
  return (
    <Box
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      sx={{
        cursor: 'pointer', px: 1.5, py: 0.7, borderRadius: 999,
        bgcolor: active ? `${color}26` : 'rgba(255,255,255,0.04)',
        color: active ? color : BRAND.muted,
        border: '1px solid',
        borderColor: active ? color : 'rgba(255,255,255,0.08)',
        fontSize: 13, fontWeight: 700, userSelect: 'none',
        transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 0.75,
        '&:hover': {
          bgcolor: active ? `${color}33` : 'rgba(255,255,255,0.06)',
          color: active ? color : BRAND.white,
          transform: 'translateY(-1px)',
        },
      }}
    >
      {label}
      <Box component="span" sx={{
        bgcolor: active ? color : 'rgba(255,255,255,0.1)',
        color: active ? '#0c1410' : BRAND.muted,
        px: 0.9, minWidth: 22, textAlign: 'center', borderRadius: 99,
        fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
      }}>
        {count}
      </Box>
    </Box>
  );
}

function SubmissionRow({ item, onClick, formatDate }) {
  const meta = statusMeta(item.status || 'new');
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2, borderRadius: 2, cursor: 'pointer',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid', borderColor: 'rgba(255,255,255,0.06)',
        transition: 'all 0.18s ease-out',
        position: 'relative', overflow: 'hidden',
        '&:hover': {
          borderColor: BRAND.green, bgcolor: 'rgba(74,222,128,0.04)',
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px -12px rgba(74,222,128,0.4)`,
        },
        '&::before': {
          content: '""', position: 'absolute',
          left: 0, top: 0, bottom: 0, width: 3, bgcolor: meta.color,
        },
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box sx={{ flexGrow: 1, minWidth: 0, pl: 0.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.4} flexWrap="wrap" useFlexGap>
            <MuiTypography fontWeight={700} fontSize={15} sx={{ color: BRAND.white }}>
              {item.name || '(no name)'}
            </MuiTypography>
            <MuiTypography variant="body2" sx={{ color: BRAND.muted }}>
              · {item.companyName || '(no company)'}
            </MuiTypography>
            {item.honeypot && <Chip label="bot" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(248,113,113,0.2)', color: '#f87171' }} />}
          </Stack>
          <MuiTypography variant="body2" sx={{
            color: BRAND.muted, fontFamily: 'monospace', fontSize: 12.5,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.email} · {item.phone} · qty {item.quantity || '?'} · in-hand {item.inHandDate || '?'}
          </MuiTypography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
          <Chip
            label={meta.label} size="small"
            sx={{
              bgcolor: meta.bg, color: meta.color, fontWeight: 700,
              fontSize: 11, height: 22, border: `1px solid ${meta.color}33`,
            }}
          />
          <MuiTypography variant="caption" sx={{ color: BRAND.muted, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
            {formatDate(item.createdAt)}
          </MuiTypography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function Detail({ label, children }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" mb={0.7}>
      <MuiTypography variant="body2" sx={{ color: BRAND.muted, minWidth: 110, flexShrink: 0, fontSize: 13 }}>
        {label}
      </MuiTypography>
      <Box sx={{ fontSize: 14, wordBreak: 'break-word', color: BRAND.white }}>{children}</Box>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Manual entry tab
// ─────────────────────────────────────────────────────────────────────────────
function ManualEntryTab({ token }) {
  const mobile = useMediaQuery('(max-width: 800px)');
  const [styleCode, setStyleCode] = React.useState('');
  const [priceRangeBottom, setPriceRangeBottom] = React.useState('');
  const [priceRangeTop, setPriceRangeTop] = React.useState('');
  const [rating, setRating] = React.useState(5);
  const [tag, setTag] = React.useState('Best Seller');
  const [category, setCategory] = React.useState('Shirts');
  const [type, setType] = React.useState('Unisex');
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!styleCode || !priceRangeBottom || !priceRangeTop) {
      alert('Please fill out all fields');
      return;
    }
    try {
      setBusy(true);
      await axios.post(
        `${config.backendUrl}/api/products/add`,
        { styleCode, priceRangeBottom, priceRangeTop, rating, tag, category, type },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStyleCode(''); setPriceRangeBottom(''); setPriceRangeTop('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert(`Could not add product: ${err?.response?.data?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.04)', color: BRAND.white,
      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
      '&:hover fieldset': { borderColor: BRAND.green },
      '&.Mui-focused fieldset': { borderColor: BRAND.green },
    },
    '& .MuiInputLabel-root': { color: BRAND.muted },
    '& .MuiInputLabel-root.Mui-focused': { color: BRAND.green },
    '& .MuiSvgIcon-root': { color: BRAND.muted },
  };

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      <MuiTypography variant="body2" sx={{ color: BRAND.muted, mb: 3 }}>
        Pull product data from the Alpha Broder XML feed by style code. The system
        auto-fetches name, colors, sizes, and images.
      </MuiTypography>
      <form onSubmit={submit}>
        <Stack spacing={2.5}>
          <Box>
            <MuiTypography variant="caption" sx={{ color: BRAND.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 0.7 }}>
              Style Code
            </MuiTypography>
            <TextField
              value={styleCode} onChange={(e) => setStyleCode(e.target.value)}
              variant="outlined" fullWidth size={mobile ? 'small' : 'medium'} required
              placeholder="e.g. G500" sx={inputSx}
            />
          </Box>
          <Box>
            <MuiTypography variant="caption" sx={{ color: BRAND.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 0.7 }}>
              Price Range ($)
            </MuiTypography>
            <Stack direction="row" width="100%" spacing={2} alignItems="center">
              <TextField value={priceRangeBottom} type="number" onChange={(e) => setPriceRangeBottom(e.target.value)} variant="outlined" size={mobile ? 'small' : 'medium'} required placeholder="Low" sx={inputSx} />
              <MuiTypography sx={{ color: BRAND.muted, fontWeight: 700 }}>—</MuiTypography>
              <TextField value={priceRangeTop} type="number" onChange={(e) => setPriceRangeTop(e.target.value)} variant="outlined" size={mobile ? 'small' : 'medium'} required placeholder="High" sx={inputSx} />
            </Stack>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <MuiTypography variant="caption" sx={{ color: BRAND.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 0.7 }}>
                Rating
              </MuiTypography>
              <Select value={rating} onChange={(e) => setRating(e.target.value)} size={mobile ? 'small' : 'medium'} sx={inputSx}>
                {[5, 4, 3, 2, 1].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <MuiTypography variant="caption" sx={{ color: BRAND.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 0.7 }}>
                Tag
              </MuiTypography>
              <Select value={tag} onChange={(e) => setTag(e.target.value)} size={mobile ? 'small' : 'medium'} sx={inputSx}>
                <MenuItem value="Best Seller">Best Seller</MenuItem>
                <MenuItem value="New Arrival">New Arrival</MenuItem>
                <MenuItem value="Clearance">Clearance</MenuItem>
                <MenuItem value="Our Favorite">Our Favorite</MenuItem>
                <MenuItem value="Exclusive">Exclusive</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <MuiTypography variant="caption" sx={{ color: BRAND.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 0.7 }}>
                Category
              </MuiTypography>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} size={mobile ? 'small' : 'medium'} sx={inputSx}>
                <MenuItem value="Shirts">Shirts</MenuItem>
                <MenuItem value="Pants">Pants</MenuItem>
                <MenuItem value="Hoodies">Hoodies</MenuItem>
                <MenuItem value="Hats">Hats</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <MuiTypography variant="caption" sx={{ color: BRAND.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 0.7 }}>
                Type
              </MuiTypography>
              <Select value={type} onChange={(e) => setType(e.target.value)} size={mobile ? 'small' : 'medium'} sx={inputSx}>
                <MenuItem value="Unisex">Unisex</MenuItem>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Kids">Kids</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Button
            variant="contained" disabled={busy} size="large" type="submit" fullWidth
            startIcon={busy ? <CircularProgress size={18} sx={{ color: BRAND.greenDk }} /> : <AddCircleOutlineIcon />}
            sx={{
              borderRadius: 2, fontWeight: 800, textTransform: 'none', py: 1.4,
              bgcolor: BRAND.green, color: BRAND.greenDk, fontSize: 15,
              '&:hover': { bgcolor: '#22c55e', transform: 'translateY(-1px)' },
              '&:disabled': { bgcolor: 'rgba(74,222,128,0.4)' },
              transition: 'all 0.15s',
            }}
          >
            {busy ? 'Adding…' : 'Add product'}
          </Button>
          <Fade in={success}>
            <Box>
              {success && (
                <Alert severity="success" sx={{
                  borderRadius: 2,
                  bgcolor: 'rgba(74,222,128,0.12)', color: BRAND.green,
                  border: `1px solid ${BRAND.green}40`,
                  '& .MuiAlert-icon': { color: BRAND.green },
                }}>
                  Product added successfully.
                </Alert>
              )}
            </Box>
          </Fade>
        </Stack>
      </form>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main shell
// ─────────────────────────────────────────────────────────────────────────────
function StudioBody({ token, onLogout }) {
  const [tab, setTab] = React.useState(0);
  // For Mockup Studio tab, we want to use the full page width (not constrained by maxWidth="md")
  const isMockupTab = tab === 2;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: BRAND.bg, py: { xs: 4, md: 6 } }}>
      <Container maxWidth={isMockupTab ? 'xl' : 'md'}>
        <Fade in timeout={350}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }} justifyContent="space-between"
            spacing={2} sx={{ mb: 3 }}
          >
            <Box>
              <MuiTypography variant="overline" sx={{
                color: BRAND.green, fontWeight: 800, letterSpacing: 3, fontSize: 11,
              }}>
                ADMIN · STUDIO
              </MuiTypography>
              <MuiTypography variant="h3" fontWeight={900} sx={{ color: BRAND.white, lineHeight: 1.1, fontSize: { xs: 30, md: 38 } }}>
                Studio
              </MuiTypography>
              <MuiTypography variant="body2" sx={{ color: BRAND.muted, mt: 0.5 }}>
                Manage products, leads, and mockups.
              </MuiTypography>
            </Box>
            <Button
              onClick={onLogout} startIcon={<LogoutIcon />} variant="outlined" size="small"
              sx={{
                borderRadius: 999, textTransform: 'none', fontWeight: 700,
                px: 2.5, py: 0.8, alignSelf: { xs: 'flex-start', sm: 'auto' },
                color: BRAND.muted, borderColor: 'rgba(255,255,255,0.15)',
                '&:hover': {
                  color: BRAND.white, borderColor: BRAND.white,
                  bgcolor: 'rgba(255,255,255,0.04)',
                },
              }}
            >Sign out</Button>
          </Stack>
        </Fade>

        <Grow in timeout={500}>
          <Paper elevation={0} sx={{
            borderRadius: 3, overflow: 'hidden',
            bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`,
          }}>
            <Tabs
              value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth"
              sx={{
                borderBottom: `1px solid ${BRAND.faint}`,
                '& .MuiTab-root': {
                  color: BRAND.muted, fontWeight: 700, textTransform: 'none',
                  fontSize: 14, letterSpacing: 0.3, py: 2,
                  transition: 'all 0.15s',
                  '&:hover': { color: BRAND.white, bgcolor: 'rgba(255,255,255,0.02)' },
                },
                '& .Mui-selected': { color: `${BRAND.green} !important` },
                '& .MuiTabs-indicator': { backgroundColor: BRAND.green, height: 3 },
              }}
            >
              <Tab label="Manual entry" />
              <Tab label="Submissions" />
              <Tab label="Mockup Studio" />
            </Tabs>

            <Fade in key={tab} timeout={300}>
              <Box>
                {tab === 0 && <ManualEntryTab token={token} />}
                {tab === 1 && <SubmissionsTab token={token} />}
                {tab === 2 && (
                  <Box sx={{ p: { xs: 1, sm: 1.5 } }}>
                    <MockupStudioTab token={token} />
                  </Box>
                )}
              </Box>
            </Fade>
          </Paper>
        </Grow>
      </Container>
    </Box>
  );
}

export default function Studio() {
  const [token, setToken] = React.useState(null);

  React.useEffect(() => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (t) {
      axios
        .get(`${config.backendUrl}/api/auth/verify`, { headers: { Authorization: `Bearer ${t}` } })
        .then(() => setToken(t))
        .catch(() => {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
        });
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return token
    ? <StudioBody token={token} onLogout={handleLogout} />
    : <Login onAuthed={setToken} />;
}
