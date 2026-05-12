// src/screens/Studio.js
//
// Password-protected admin/studio page. Hub-based navigation — pick a tool
// from a card grid, enter it, click "Studio" to come back.
//
//   Joint Printing tools:
//     1) Manual entry — Alpha Broder XML product creation (auto-priced)
//     2) Submissions — mini-CRM for contact form leads
//     3) Mockup Studio — launches /jpstudio/ in a new tab
//   JP Webworks tools:
//     4) Cold Calls — JPW cold-call decision tree with editable script versions

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
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloseIcon from '@mui/icons-material/Close';
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

// Mirrors backend (controllers/auth.js) — display-only.
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;

const STATUS_OPTIONS = [
  { value: 'new',          label: 'New',          color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  { value: 'contacted',    label: 'Contacted',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { value: 'quoted',       label: 'Quoted',       color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  { value: 'won',          label: 'Won',          color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  { value: 'lost',         label: 'Lost',         color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  { value: 'spam',         label: 'Spam',         color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
];

const statusMeta = (s) => STATUS_OPTIONS.find((x) => x.value === s) || STATUS_OPTIONS[0];

// Shared input styling: forces select text white so dropdown values don't
// render as black-on-dark blobs (the previous bug).
const darkInputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.04)', color: BRAND.white,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: BRAND.green },
    '&.Mui-focused fieldset': { borderColor: BRAND.green },
  },
  '& .MuiInputLabel-root': { color: BRAND.muted },
  '& .MuiInputLabel-root.Mui-focused': { color: BRAND.green },
  '& .MuiSvgIcon-root': { color: BRAND.muted },
  '& .MuiSelect-select': { color: BRAND.white },
  '& input': { color: BRAND.white },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Login
// ─────────────────────────────────────────────────────────────────────────────
function Login({ onAuthed }) {
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // Local count of wrong-password tries this session — gives the user a
  // heads-up like "2 attempts left" before the backend actually locks them.
  // Resets on success.
  const [failCount, setFailCount] = React.useState(0);
  const [lockedMsg, setLockedMsg] = React.useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!pw) return;
    setBusy(true);
    try {
      const res = await axios.post(`${config.backendUrl}/api/auth/studio-login`, { password: pw });
      if (res.data?.token) {
        sessionStorage.setItem(TOKEN_KEY, res.data.token);
        setFailCount(0);
        setLockedMsg('');
        onAuthed(res.data.token);
      } else {
        setErr('Login failed.');
      }
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || 'Wrong password.';
      // 429 = locked out by the backend. Show the wait message prominently
      // and stop counting locally — the timer is now backend-controlled.
      if (status === 429) {
        setLockedMsg(msg);
        setErr('');
        setFailCount(MAX_ATTEMPTS_BEFORE_LOCKOUT);
      } else {
        setLockedMsg('');
        setFailCount((n) => n + 1);
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  // After 3 wrong passwords, hint at the consequence so the user understands
  // why the next couple of typos are a big deal.
  const remaining = Math.max(0, MAX_ATTEMPTS_BEFORE_LOCKOUT - failCount);
  const showWarning = !lockedMsg && failCount >= 3 && remaining > 0;

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
                onChange={(e) => {
                  setPw(e.target.value);
                  if (err) setErr('');
                }}
                disabled={!!lockedMsg}
                fullWidth size="medium"
                sx={darkInputSx}
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
              <Fade in={!!err && !lockedMsg}>
                <Box>
                  {err && !lockedMsg && (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                      {err}
                      {showWarning && (
                        <> · {remaining} attempt{remaining === 1 ? '' : 's'} left before a 15-min lockout.</>
                      )}
                    </Alert>
                  )}
                </Box>
              </Fade>
              <Fade in={!!lockedMsg}>
                <Box>
                  {lockedMsg && (
                    <Alert severity="warning" icon={<LockIcon fontSize="inherit" />} sx={{ borderRadius: 2 }}>
                      {lockedMsg}
                    </Alert>
                  )}
                </Box>
              </Fade>
              <Button
                type="submit" variant="contained" size="large"
                disabled={busy || !!lockedMsg} fullWidth
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
//  Mockup Studio launcher — opens /jpstudio/ in a new tab (no inline preview)
// ─────────────────────────────────────────────────────────────────────────────
function MockupLauncherTab({ token }) {
  const src = `/jpstudio/?t=${encodeURIComponent(token)}`;
  const [opened, setOpened] = React.useState(false);

  const launch = () => {
    window.open(src, '_blank', 'noopener,noreferrer');
    setOpened(true);
    setTimeout(() => setOpened(false), 2200);
  };

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      <Stack spacing={3} alignItems="flex-start">
        <MuiTypography variant="body2" sx={{ color: BRAND.muted }}>
          Mockup Studio opens in a new tab. Your studio session carries over —
          no extra login needed.
        </MuiTypography>

        <Paper elevation={0} sx={{
          width: '100%',
          bgcolor: 'rgba(74,222,128,0.04)',
          border: `1px solid ${BRAND.border}`,
          borderRadius: 3,
          p: { xs: 3, sm: 4 },
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 2, sm: 3 },
          flexDirection: { xs: 'column', sm: 'row' },
          textAlign: { xs: 'center', sm: 'left' },
        }}>
          <Box sx={{
            bgcolor: BRAND.greenDk, color: BRAND.green,
            width: 64, height: 64, borderRadius: 2.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 6px rgba(74,222,128,0.06)',
            flexShrink: 0,
          }}>
            <DesignServicesIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <MuiTypography variant="h6" fontWeight={800} sx={{ color: BRAND.white, mb: 0.5 }}>
              Mockup Studio
            </MuiTypography>
            <MuiTypography variant="body2" sx={{ color: BRAND.muted }}>
              Build apparel mockups, export PDFs, send to clients.
            </MuiTypography>
          </Box>
          <Button
            onClick={launch}
            variant="contained"
            size="large"
            endIcon={<OpenInNewIcon />}
            sx={{
              borderRadius: 2, fontWeight: 800, textTransform: 'none', px: 3, py: 1.4,
              bgcolor: BRAND.green, color: BRAND.greenDk,
              '&:hover': { bgcolor: '#22c55e', transform: 'translateY(-1px)' },
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            Open studio
          </Button>
        </Paper>

        <Fade in={opened}>
          <Alert
            severity="success"
            icon={<OpenInNewIcon fontSize="inherit" />}
            sx={{
              borderRadius: 2,
              bgcolor: 'rgba(74,222,128,0.08)',
              color: BRAND.green,
              border: `1px solid ${BRAND.border}`,
              '& .MuiAlert-icon': { color: BRAND.green },
            }}
          >
            Opened in a new tab. If nothing happened, your browser may have
            blocked the popup — check the address bar.
          </Alert>
        </Fade>

        <MuiTypography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
          Tip: bookmark the studio URL after opening for one-click access next time.
        </MuiTypography>
      </Stack>
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
                      '& .MuiSelect-select': { color: BRAND.white },
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
//  Manual entry tab — simplified
//
//  Style Code, Category, Type only. Pricing is fetched from AlphaBroder XML
//  and computed via the shared markup formula on the backend. Rating defaults
//  to 5, tag to "New Arrival" automatically.
// ─────────────────────────────────────────────────────────────────────────────
function ManualEntryTab({ token }) {
  const mobile = useMediaQuery('(max-width: 800px)');
  const [styleCode, setStyleCode] = React.useState('');
  const [category, setCategory] = React.useState('Shirts');
  const [type, setType] = React.useState('Unisex');
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState(null); // { name, priceRangeBottom, priceRangeTop } | null
  const [error, setError] = React.useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    if (!styleCode) {
      setError('Style code is required.');
      return;
    }
    try {
      setBusy(true);
      // Pricing/rating/tag intentionally omitted — backend fills from XML.
      const res = await axios.post(
        `${config.backendUrl}/api/products/add`,
        { styleCode, category, type },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const p = res?.data || {};
      setSuccess({
        name: p.name || styleCode,
        priceRangeBottom: p.priceRangeBottom,
        priceRangeTop: p.priceRangeTop,
      });
      setStyleCode('');
      setTimeout(() => setSuccess(null), 6000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not add product.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      <MuiTypography variant="body2" sx={{ color: BRAND.muted, mb: 3 }}>
        Pull product data from the Alpha Broder XML feed by style code. Name,
        colors, sizes, images, and pricing are all fetched automatically — you
        just confirm the category and audience.
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
              placeholder="e.g. G500" sx={darkInputSx}
            />
            <MuiTypography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.6, display: 'block' }}>
              Pricing is auto-calculated using the same markup as your other
              products.
            </MuiTypography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <MuiTypography variant="caption" sx={{ color: BRAND.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 0.7 }}>
                Category
              </MuiTypography>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} size={mobile ? 'small' : 'medium'} sx={darkInputSx}>
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
              <Select value={type} onChange={(e) => setType(e.target.value)} size={mobile ? 'small' : 'medium'} sx={darkInputSx}>
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
          <Fade in={!!error}>
            <Box>
              {error && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {error}
                </Alert>
              )}
            </Box>
          </Fade>
          <Fade in={!!success}>
            <Box>
              {success && (
                <Alert severity="success" sx={{
                  borderRadius: 2,
                  bgcolor: 'rgba(74,222,128,0.12)', color: BRAND.green,
                  border: `1px solid ${BRAND.green}40`,
                  '& .MuiAlert-icon': { color: BRAND.green },
                }}>
                  Added <strong>{success.name}</strong>
                  {Number.isFinite(success.priceRangeBottom) && Number.isFinite(success.priceRangeTop) && (
                    <> — priced ${success.priceRangeBottom.toFixed(2)}–${success.priceRangeTop.toFixed(2)}</>
                  )}.
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
//  Cold Calls — JPW cold call decision tree
//
//  Flow is 2-touch: (1) cold call, book a 15-min meeting on the call itself,
//  (2) the meeting, where the pre-built audit is walked through and pricing
//  is presented. The audit is prepped BEFORE the meeting; it's no longer a
//  separate email touch.
//
//  Each node has built-in "default" content (script lines, follow-ups,
//  voicemail). Click "Edit" on any field to override the default for that
//  field — overrides persist to localStorage. Click "Reset to default" to
//  restore the original.
// ─────────────────────────────────────────────────────────────────────────────
const COLD_CALL_NODES = {
  // ─── ENTRY POINTS ──────────────────────────────────────────────────────
  start: {
    stage: 'Open the line',
    script: ["Hey, is this {{name}}?"],
    direction: "Using the owner's first name lands way better than 'is this the owner of {{biz}}?' — it sounds like you know them. Spend 30 seconds researching the name before you dial (Outscraper export, GBP, LinkedIn, Facebook). If you don't have a name, fall back to 'Hey, is this the owner of {{biz}}?' but make name lookup the default.",
    next: [
      { label: 'Yes — got the owner', to: 'pattern_interrupt' },
      { label: 'No / who is this? / gatekeeper', to: 'gatekeeper' },
      { label: 'Goes to voicemail', to: 'voicemail' },
      { label: 'Not a good time / hangs up', to: 'callback' },
    ],
  },

  gatekeeper: {
    stage: 'Gatekeeper',
    script: [
      "No problem — quick one. Is {{name}} around by chance? It's about something I spotted on {{biz}}'s Google listing — wanted to give them a heads-up directly.",
    ],
    direction: "Never pitch the gatekeeper — they have no authority and treating them like a buyer breaks rapport. The 'spotted something on their Google listing' framing gets you transferred far more often than 'I'd like to talk to them about marketing' — it sounds like a real, specific reason, not a sales call. If they push back, get the best time + a direct number.",
    next: [
      { label: 'Transferring me to owner', to: 'pattern_interrupt' },
      { label: 'Owner not in — got callback time', to: 'callback' },
      { label: 'They want me to email', to: 'send_something' },
      { label: "Owner won't take cold calls", to: 'polite_exit' },
    ],
  },

  // ─── THE PATTERN-INTERRUPT OPENER ──────────────────────────────────────
  pattern_interrupt: {
    stage: 'Pattern interrupt',
    script: [
      "Hey {{name}}, this is Nate from JP Webworks over in Marlton. I'm gonna be straight with you — this is a cold call. You can hang up right now, totally fine, or give me 30 seconds and then decide. Which is easier?",
    ],
    direction: "This is the single most important line in the script. Slow down. Lower your voice — calm, not enthusiastic. The honesty disarms them — 9 out of 10 owners say 'go ahead' because the framing is so unusual. The one who hangs up was never going to buy anyway and you just saved 8 minutes. DO NOT smile-call this. Calm and grounded reads as 'this person knows what they're doing.' Excited reads as 'salesperson.'",
    next: [
      { label: '"Go ahead" / "OK, what is it?"', to: 'specific_reason' },
      { label: '"Just send me an email"', to: 'send_something' },
      { label: '"Not interested" / hangs up', to: 'not_interested' },
    ],
  },

  specific_reason: {
    stage: 'Reason + qualifier',
    script: [
      "Appreciate it. Real quick — I work with {{svc}} companies in South Jersey on the online side, helping them pull more jobs from Google.",
      "I was looking at {{biz}} before I called and there are a few specific things on your listing and website that are probably costing you jobs every week — but I don't want to assume that's even a problem for you.",
    ],
    followUp: ["Before I get into it — are you guys actually looking to take on more {{svc}} work right now, or pretty slammed?"],
    direction: "The qualifier question is doing a TON of work here. Notice 'slammed' is framed as an acceptable answer — that gives them permission to be honest. But here's the trick: even slammed owners almost always want better/bigger jobs. The question screens out the 5% who actually don't need help and surfaces the real pain in everyone else. Whatever they answer tells you which branch to take.",
    next: [
      { label: '"Yeah, we could use more work"', to: 'pain_dig' },
      { label: '"We\'re slammed / pretty full"', to: 'slammed' },
      { label: '"What did you see on our listing?"', to: 'curiosity_hook' },
      { label: '"What do you do exactly?"', to: 'what_do_you_do' },
      { label: '"What is this about? / explain the audit"', to: 'what_is_audit' },
      { label: '"We have someone doing marketing"', to: 'have_a_guy' },
      { label: '"How much does this cost?"', to: 'price_early' },
      { label: '"I don\'t need a website"', to: 'dont_need' },
      { label: '"What kind of jobs?"', to: 'pain_dig' },
      { label: '"Just send me something"', to: 'send_something' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  // ─── DISCOVERY: SURFACE THE PAIN ───────────────────────────────────────
  pain_dig: {
    stage: 'Pain dig (NEPQ)',
    script: [
      "Got it. Quick question that helps me know if we're even a fit — what's the bottleneck for you guys? Is it not enough calls coming in, or you're getting calls but the wrong kind of jobs?",
    ],
    direction: "This is the killer question. The 'either/or' frame forces them to pick — both options surface useful info, and almost nobody answers 'neither' because both options sound plausible. Listen carefully, take notes, DON'T interrupt. Whoever talks first loses — sit in the silence even if it's 10 seconds long. Their answer is the entire pitch from here forward.",
    next: [
      { label: '"Not enough calls"', to: 'pain_few_calls' },
      { label: '"Calls but wrong kind / bad leads"', to: 'pain_wrong_leads' },
      { label: '"Both, honestly"', to: 'pain_both' },
      { label: '"We want bigger / higher-ticket jobs"', to: 'pain_wrong_leads' },
      { label: '"Things are actually fine"', to: 'no_pain_pivot' },
    ],
  },

  pain_few_calls: {
    stage: 'Pain → not enough calls',
    script: [
      "Yeah, that's the most common one. And here's what most {{svc}} owners don't realize — when someone in your area needs {{svc}}, they're picking who to call within 6 minutes of searching on their phone. They call whoever shows up first, has a real website, and looks legit. If you're not in that first batch, the phone just doesn't ring. And you never know it happened.",
      "Most {{svc}} guys I talk to are missing 3 to 5 jobs a month they can't see. The specific ones I can prove you're missing — that's what I was going to flag from your listing.",
    ],
    direction: "You just named a pain they feel (phantom slow weeks they can't explain) and tied the cause to something concrete (online visibility). Don't pitch a product — pitch the diagnosis. Bridge straight to the meeting ask.",
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  pain_wrong_leads: {
    stage: 'Pain → wrong leads / wrong jobs',
    script: [
      "That's actually the harder problem to fix, but it's fixable. What's happening is your website and Google profile are attracting tire-kickers and discount-hunters instead of the real buyers. The good jobs — the bigger residential, the commercial, the insurance work — those people Google differently, and they're looking for different signals on a site before they call.",
      "So you've got two leaks: not enough volume of the right people, and what's coming in is the wrong shape. Both fixable, both come from the same place.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  pain_both: {
    stage: 'Pain → both volume and quality',
    script: [
      "Yeah — those two are almost always linked. If you're showing up for the cheap commodity searches, you get the volume but it's all low-budget tire-kickers, and the higher-ticket buyers walk past because the site doesn't signal 'these guys can handle a $20K job.'",
      "Fixing both is the same project. Make the site convert the right buyer, and Google starts showing you to the right buyer. The phantom missed jobs disappear.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  no_pain_pivot: {
    stage: 'They claim no pain',
    script: [
      "Got it — that's actually great to hear. Means whatever you're doing is working.",
      "One last question, then I'll let you go — are most of your jobs coming from referrals and repeat customers, or are you getting net-new people who Googled you and called?",
    ],
    direction: "Most 'things are fine' owners are 80%+ referral-based, which means they have ZERO visibility for net-new searchers. That's the hidden pain — they don't see it because referrals mask it. If they admit it's mostly referrals, you have your wedge into the conversation.",
    next: [
      { label: '"Mostly referrals"', to: 'referral_pivot' },
      { label: '"Pretty even mix"', to: 'pain_few_calls' },
      { label: '"Genuinely all set — not interested"', to: 'polite_exit' },
    ],
  },

  referral_pivot: {
    stage: 'Referral business → hidden leak',
    script: [
      "Cool — referrals are the best leads, no argument. Here's the catch most guys don't see: even when someone refers you, the first thing they do is Google {{biz}} to check you out. They get 6 seconds on your site before they decide if they're actually calling. If something's off — site looks dated, doesn't load on their phone, services aren't obvious — they bounce. And the referrer never finds out the referral didn't land.",
      "You're losing referrals you already earned. Probably not a ton — but every one was a free customer you should've had. That's the wedge.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  slammed: {
    stage: '"We\'re slammed"',
    script: [
      "Got it — good problem to have. Won't waste your time then.",
      "One quick thing before I let you go — is it steady year-round, or do you have a slow season? Most {{svc}} guys I know go 80% capacity in summer, 40% in winter, something like that.",
    ],
    direction: "Almost every service business has a slow season. This question reframes 'slammed' as 'slammed RIGHT NOW' — a different thing. If they admit any seasonal dip, the pivot is: the work to fill the slow season happens NOW, not when you're already empty. If they say genuinely steady, pivot to higher-ticket angle.",
    next: [
      { label: '"Yeah, it slows down in [season]"', to: 'seasonal_pain' },
      { label: '"Pretty steady all year"', to: 'higher_ticket_pivot' },
      { label: '"Actually all set, thanks"', to: 'polite_exit' },
    ],
  },

  seasonal_pain: {
    stage: 'Seasonal pain pivot',
    script: [
      "That's most {{svc}} guys. Here's the thing — building online visibility takes 60 to 90 days to actually kick in. So if you wait until your slow season hits to start fixing it, you're already 3 months behind. The guys who don't bleed cash in the slow months are the ones who set this up while they're still busy.",
      "I'd want to grab 15 minutes either way — not to pitch you anything, just to show you what I'd set up so when the slow season hits, you're not staring at empty trucks.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: 'Still not interested', to: 'polite_exit' },
    ],
  },

  higher_ticket_pivot: {
    stage: 'Bigger jobs pivot',
    script: [
      "OK then I'd reframe it — it's not about MORE jobs, it's about BIGGER jobs. Same volume, higher average ticket. The bigger commercial and residential projects, the folks who don't haggle. Those buyers are Googling {{svc}} too — they're just looking for different signals on a site before they call. Most {{svc}} guys are losing those because the site looks like they only do small jobs.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"Not interested, all set"', to: 'polite_exit' },
    ],
  },

  curiosity_hook: {
    stage: 'They asked what you saw',
    script: [
      "Good question. A few things — but I don't want to half-answer it over the phone because it'll sound generic. The real answer is a 15-minute screen-share where I pull up {{biz}} live, plus your top 3 {{svc}} competitors in the area, and I show you exactly where they're winning and where you're invisible.",
      "Trying to describe it over the phone is like describing a movie — won't land. The screen-share is the whole point.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"Just give me one specific thing"', to: 'one_specific' },
    ],
  },

  one_specific: {
    stage: 'One specific finding',
    script: [
      "Fair. One example — when I Googled '{{svc}} near me' from your area, you didn't show up on page one. The guys who did, half of them have worse reviews than you. That's the kind of thing that's fixable but you really have to see it side-by-side to make sense of it.",
    ],
    direction: "Adjust this specific based on what you actually found in your pre-call audit. If you didn't audit yet, use a generic but real observation — 'your phone number isn't tap-to-call on mobile' or 'your services page is two clicks deep' or 'no service area listed on your GBP' — these are almost always true.",
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  // ─── OBJECTIONS ────────────────────────────────────────────────────────
  have_a_guy: {
    stage: '"We have a guy"',
    script: [
      "Cool — that actually makes my job easier. If your guy's nailing it, the 15 minutes confirms it and you've got an outside benchmark to hold him to. If something's getting missed, you'd want to know before a competitor takes the next job. Either way you win.",
      "Quick question, not a trick — what's he handling? Like, full picture? Website, Google profile, reviews, ads, all of it?",
    ],
    direction: "DON'T attack the guy. That's amateur hour and the owner will defend him reflexively. Validate the decision to hire someone, then ask what he's actually doing. Most 'have a guys' are doing 30% of what the owner thinks. That gap is where you live.",
    next: [
      { label: '"Just website" / "nephew built it"', to: 'gap_uncovered' },
      { label: '"Mostly ads" / "just one piece"', to: 'gap_uncovered' },
      { label: '"Honestly I don\'t know what he does"', to: 'gap_uncovered' },
      { label: '"He handles everything, I\'m good"', to: 'have_a_guy_firm' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  gap_uncovered: {
    stage: 'Gap in current coverage',
    script: [
      "Yeah, that's pretty typical actually. Most 'guys' are doing one piece — usually the website OR the Google profile OR ads. Rarely all three working together. And those pieces only work when they're stitched together right.",
      "Not a knock on him. But it means there's probably 60% of the picture he's not touching, and that's exactly where the missed jobs come from.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
    ],
  },

  have_a_guy_firm: {
    stage: '"He handles everything" — firm',
    script: [
      "Fair. Last ask, then I'll let you go — 15 minutes, no strings. If your guy's got everything tight, you'll have an outside benchmark. If we spot something he missed, you can have a real conversation with him about it. Costs you nothing either way.",
    ],
    direction: "Don't push past TWO soft asks. Owners remember the call where you respected the no, and you can warm-follow-up in 90 days. Pushing past 2 = burned bridge. If they still say no, exit cleanly.",
    next: [
      { label: '"Alright, 15 minutes"', to: 'book_ask' },
      { label: 'Still no', to: 'polite_exit' },
    ],
  },

  price_early: {
    stage: 'Price asked early',
    script: [
      "Yeah, fair question. Honest answer — depends what's actually broken. Some guys need a Google profile cleanup, that's a couple hundred a month. Some need a full website rebuild — $749 setup, $299 a month after that. Some need ads, that sits on top.",
      "Quick number — what's an average {{svc}} job worth to you? Like a typical residential one?",
    ],
    direction: "DO NOT just quote prices and stop. Make THEM tell you their average ticket. This sets up the payback math from their own number, not yours — way more persuasive. If they refuse to give a number, go to price_general.",
    next: [
      { label: 'They gave me a number', to: 'payback_math' },
      { label: '"It varies / depends"', to: 'price_general' },
      { label: '"Too much regardless"', to: 'too_expensive' },
    ],
  },

  payback_math: {
    stage: 'Payback math',
    script: [
      "OK so let's say I'm right and we land you one extra {{svc}} job a month — people who would've called someone else. That's roughly 12 of those a year against $3,600 for the service. The math basically works on month one.",
      "Whole point of the 15-minute call is to see if I CAN land you one more a month. If I can't, it's not worth doing — and I'll tell you that.",
    ],
    direction: "Do the math out loud, slowly. If their ticket is $5K, one extra job = $60K/yr against $3,600 — that's a 16x ROI and the math sells itself. Let it land in silence.",
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"Still too much"', to: 'too_expensive' },
    ],
  },

  price_general: {
    stage: 'Price — they won\'t give a number',
    script: [
      "All good. Roughly though — every {{svc}} owner I talk to says the same thing: even one extra job a month pays for the website for the year, easy. The real question isn't 'can I afford this,' it's 'is there a way to actually land more of those jobs.' That's what the 15 minutes is for.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"Still not for me"', to: 'too_expensive' },
    ],
  },

  too_expensive: {
    stage: '"Too expensive"',
    script: [
      "Hear you. Quick reframe though — what's it costing you to NOT show up when someone searches {{svc}} in your zip? Most owners I talk to are missing 3-5 jobs a month they can't see. That's real money walking out the door every week, you just don't see it on your books because you never had it to begin with.",
      "The 15 minutes is free. Worst case I tell you there's nothing to fix and you saved yourself the money. But you'd want to know if there's a leak, right?",
    ],
    direction: "Reframe price to cost-of-inaction, not cost-of-action. Don't drop your price — drop their objection. Hormozi: every minute you don't fix it, it's costing more than fixing it would.",
    next: [
      { label: '"OK, 15 minutes"', to: 'book_ask' },
      { label: 'Hard no', to: 'not_interested' },
    ],
  },

  what_do_you_do: {
    stage: '"What do you do exactly?"',
    script: [
      "Three things, depending on the business — first, fix the website so it actually converts visitors into calls. Second, clean up the Google profile so you rank when people search {{svc}} in your area. Third, optionally run paid ads to fill capacity.",
      "Most clients we start with just the website because that's usually where the leak is. But I'd want to look at {{biz}} specifically before recommending anything — different businesses have different leaks.",
    ],
    next: [
      { label: '"Tell me more"', to: 'pain_dig' },
      { label: '"How much?"', to: 'price_early' },
      { label: '"We have someone"', to: 'have_a_guy' },
      { label: '"Just send info"', to: 'send_something' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  dont_need: {
    stage: '"Don\'t need a website"',
    script: [
      "I get it — plenty of {{svc}} guys built businesses without one. But here's what changed: when someone in your area needs {{svc}} today, the first thing they do is Google it. Phone in hand, in their driveway, deciding right then. No website, you don't show up. You don't exist to that customer.",
      "You're getting the customers who heard about you word-of-mouth. That's it. Every Google searcher walks past and calls the next guy. They don't even know to ask for you.",
    ],
    next: [
      { label: '"Hmm, fair point — keep going"', to: 'book_ask' },
      { label: '"Still don\'t care"', to: 'not_interested' },
    ],
  },

  what_is_audit: {
    stage: '"What\'s the call about?"',
    script: [
      "Simple — before our call I do what a customer does. I Google {{svc}} in your zip, screenshot the results. Where {{biz}} lands, what your site does on mobile, your Google profile, and what your top 3 competitors are doing differently. Then on a 15-minute screen-share I walk you through it.",
      "If I find nothing worth fixing, I tell you that and we go our separate ways. Most guys I do this for, there's at least 2-3 things that surprise them. The 15 minutes is free either way.",
    ],
    next: [
      { label: 'Continue to the meeting ask', to: 'book_ask' },
      { label: '"How much would the fix cost?"', to: 'price_early' },
    ],
  },

  send_something: {
    stage: '"Just send me info"',
    script: [
      "I could, but it'd be a generic brochure and you'd toss it. The reason this works is it's specific to {{biz}}.",
      "Quick one before I do anything — what kind of {{svc}} work are you most trying to grow? Bigger residential, commercial, a specific service?",
    ],
    direction: "If they answer, you just got the audit angle — pivot to send_close. If they shut down, send the Calendly link anyway — you'll have their cell for next-day follow-up.",
    next: [
      { label: 'They told me what they want', to: 'send_close' },
      { label: '"Don\'t care, just send something"', to: 'send_generic' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  send_close: {
    stage: 'Closing the soft ask',
    script: [
      "Perfect — I'll build the audit around exactly that. Way more useful than a generic pitch.",
      "What's the best cell to text the Calendly link to? You can grab whatever 15-minute slot works.",
    ],
    next: [
      { label: 'Got the cell', to: 'book_meeting' },
      { label: '"Just email instead"', to: 'send_generic' },
    ],
  },

  send_generic: {
    stage: 'Generic info / email send',
    script: [
      "All good. Best email or cell to send the Calendly link plus a quick overview of what we do?",
    ],
    direction: "Even when they shut down on the meeting, get a contact method. Next-day text with the Calendly link converts surprisingly often — they were just busy in the moment of the call.",
    next: [
      { label: 'Got cell or email', to: 'book_meeting' },
      { label: 'Refused to give contact', to: 'polite_exit' },
    ],
  },

  // ─── THE CLOSE ─────────────────────────────────────────────────────────
  book_ask: {
    stage: 'Book the meeting',
    script: [
      "Here's what I'd suggest — grab 15 minutes on the calendar this week or next. Before our call I do the full audit, then walk you through it live. You decide if any of it's worth fixing. No pitch, no surprise sales close at the end. Worst case you get 15 minutes of free intel on {{biz}}.",
    ],
    followUp: [
      "Would it be unreasonable to grab 15 minutes — Tuesday morning or Thursday afternoon, which is easier?",
    ],
    direction: "Two-option close beats open-ended 'what works for you' every time — it bypasses decision paralysis. 'Would it be unreasonable' (Josh Braun's move) is softer than 'would you' because it triggers a different yes-no calculation in their head. Adjust the two day-options based on your actual availability that week.",
    next: [
      { label: '"Tuesday morning works"', to: 'book_time_close' },
      { label: '"Thursday afternoon works"', to: 'book_time_close' },
      { label: '"Different day/time"', to: 'book_flexible' },
      { label: '"Just text me the link"', to: 'book_time_close' },
      { label: '"Send me info first"', to: 'send_close' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },

  book_flexible: {
    stage: 'They want a different time',
    script: [
      "No problem — what window works better for you? Mornings, afternoons, evenings? Earlier in the week or later?",
    ],
    direction: "Narrow with two-option questions until you have a specific time. Don't accept 'sometime next week' — keep narrowing. 'Tuesday or Wednesday?' 'Morning or afternoon?' 'Before or after lunch?' Vague = ghosted.",
    next: [
      { label: 'Got a specific time', to: 'book_time_close' },
      { label: 'Lost interest', to: 'not_interested' },
    ],
  },

  book_time_close: {
    stage: 'Confirm and close',
    script: [
      "Perfect. I'll text you my Calendly link in the next minute — grab that slot, you'll get a confirmation and a Google Meet link. What's the best cell to text it to?",
    ],
    next: [
      { label: 'Got the cell', to: 'book_meeting' },
      { label: 'Backed out', to: 'not_interested' },
    ],
  },

  // ─── EXITS ─────────────────────────────────────────────────────────────
  voicemail: {
    stage: 'Voicemail',
    end: 'warning',
    badge: 'Leave VM + send text within 2 min',
    script: ['Leave the voicemail below, then send the follow-up text within 2 minutes while your name is still in their recent calls log.'],
    voicemail: "Hey {{name}}, Nate from JP Webworks out of Marlton — I'll be straight, this is a cold call. I was looking at {{biz}} on Google and spotted a few specific things on your listing that are probably costing you {{svc}} jobs you don't know you're missing. Not a big pitch — happy to walk you through what I saw in 15 minutes. Shoot me a text or callback when you get a sec, I'll text you my number too.",
    direction: 'Cadence: leave a voicemail on attempts 1 and 4 ONLY (vary the message on 4). Attempts 2 and 3 — call and hang up if VM. After 5 untouched, move to 60-day backburner. Send the follow-up text within 2 minutes — "Hey {{name}}, Nate from JP Webworks — just left you a voicemail. Saw a couple specific things on {{biz}}\'s Google listing worth flagging. No rush — text back when you can."',
  },

  callback: {
    stage: 'Callback scheduled',
    end: 'neutral',
    badge: 'Callback scheduled',
    script: ["No problem at all — when's a better time to catch you for two minutes?"],
    direction: "Get a SPECIFIC day AND time AND confirm the number. If they're vague ('next week'), narrow with two-option: 'Tuesday or Wednesday?' 'Morning or afternoon?' Vague callbacks = ghosted callbacks. Pin it down before hanging up.",
  },

  not_interested: {
    stage: 'Polite exit (cold)',
    end: 'neutral',
    badge: 'Closed — 90-day follow-up',
    script: [
      "All good — appreciate you taking the call.",
      "One quick last thing, no pressure — is it the timing, you've been burned by marketing before, or just not a fit right now? Helps me know whether to reach back out down the road.",
    ],
    direction: "This is the Columbo close — the most valuable line in the script. The no is already in; you're not flipping it, you're collecting intel for the 90-day follow-up. Owners will tell you things in this moment they wouldn't have told you 90 seconds ago. Log whatever they say verbatim. Then exit warmly.",
  },

  polite_exit: {
    stage: 'Polite exit (warm)',
    end: 'neutral',
    badge: 'Closed — 90-day follow-up',
    script: [
      "All good — I'll let you get back to it.",
      "I'll check back in a few months. Anything changes on your end before then, you've got my number. Have a good one, {{name}}.",
    ],
    direction: "Soft no's where the call stayed friendly. Log for 90-day follow-up. Using their name at goodbye is small but it lands — they remember the call as a real conversation, not a sales call.",
  },

  book_meeting: {
    stage: 'WIN',
    end: 'success',
    badge: 'Meeting booked',
    script: [
      "Perfect, {{name}}. Texting you the Calendly link right now — calendly.com/nate-jointprinting/30min. Grab whatever 15-minute slot works for you.",
      "I'll have the audit ready when we get on the call. Talk soon — appreciate you giving me the time today.",
    ],
    direction: "Action items the second you hang up — while it's hot: (1) TEXT the Calendly link within 60 seconds: 'Hey {{name}}, Nate from JP Webworks — booking link as promised: calendly.com/nate-jointprinting/30min. Looking forward to it.' (2) Log in CRM with full call notes — what they said about pain, ticket size, current marketing. (3) Schedule 30 min in your calendar the day before the meeting to build the audit (Google their service in their zip, screenshot results, check site on mobile, identify 3 specific competitor advantages, draft 2-3 fixes). (4) On the meeting itself: walk the audit FIRST. No pricing unless they ask twice. Goal of meeting #1 is getting them to ask 'OK what would it cost to fix this?' — then quote.",
  },
};

const QUICK_REBUTTALS = [
  { q: '"I\'m driving / in a meeting / busy right now"', a: "No problem — sounds like I caught you mid-something. What's a better window — tomorrow morning or afternoon?" },
  { q: '"How did you get my number?"', a: "Public — your Google business listing. Cold call, that's all. Take 30 seconds and tell me to get lost if it's not a fit." },
  { q: '"Take me off your list"', a: "Won't call again — appreciate the time. Take care." },
  { q: '"I\'m not the decision maker"', a: "Got it — who handles the website and the Google stuff for you? Best way to reach them?" },
  { q: '"We tried marketing before, didn\'t work"', a: "Yeah, like 80% of these calls. Most agencies oversell and ghost. What specifically didn't work — were the leads not showing up, the leads were junk, or the company just stopped communicating? Helps me know if we're different or the same flavor." },
  { q: '"I just got a website built last year"', a: "Good — you took it seriously. Quick question — is it actually pulling jobs for you, or is it just sitting there looking nice? Big difference. Worth 15 minutes either way to confirm." },
  { q: '"Are you AI / a robot?"', a: "Ha — no, Nate, real person. Calling out of Marlton, I'm probably 10 minutes from you." },
  { q: '"How long does the website take to build?"', a: "Usually 1–2 weeks from kickoff. Live by week three. We handle updates after that." },
  { q: '"Can I see examples of your work?"', a: "Absolutely — I'll text you a couple links along with my Calendly. What's the best cell?" },
  { q: '"Why should I trust you over the other 50 guys calling me?"', a: "Fair question, and I'm one of those 50. Three things make me different — I'm local out of Marlton, I show you the audit live before you spend a dollar, and the website's $749 setup not the $5K agencies quote. Worst case you get 15 minutes of free intel on {{biz}}." },
  { q: '"What\'s the catch?"', a: "Honest catch — I only take on one {{svc}} company per zip in South Jersey because the work would compete with itself. So if you do say yes, I stop calling other {{svc}} companies in your area. That's it." },
  { q: '"I need to think about it"', a: "Totally fair. What specifically are you turning over — the timing, the price, or you're just not sure it'll work? Whichever it is, easier to give you the actual answer than have you guess." },
  { q: '"Call me back in a few months"', a: "Sure — but real quick, is there something specific changing in a few months, or is now just not the time? Helps me know if it's a real timing thing or a polite no, no judgment either way." },
];

// ─────────────────────────────────────────────────────────────────────────────
//  EditableScript — renders a list of script lines for one node+field, with
//  inline editing. One override per field, persisted in localStorage. No
//  version naming, no dropdowns — just edit, save, it stays. Reset to wipe.
//
//  field: 'script' | 'followUp' | 'voicemail' | 'direction'
//  defaultLines: array of strings (or single string for voicemail/direction)
// ─────────────────────────────────────────────────────────────────────────────
function EditableScript({
  nodeId, field, defaultLines, fill, sx,
  override, onSaveOverride, onResetOverride,
}) {
  const isMultiline = Array.isArray(defaultLines);
  const defaultText = isMultiline ? defaultLines.join('\n\n') : (defaultLines || '');
  const hasOverride = override != null && override !== '';
  const currentText = hasOverride ? override : defaultText;

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  const startEdit = () => {
    setDraft(currentText);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };
  const saveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed) { cancelEdit(); return; }
    if (trimmed === defaultText) {
      // They edited back to match the default — just clear the override.
      onResetOverride();
    } else {
      onSaveOverride(trimmed);
    }
    setEditing(false);
  };

  // Render lines
  const renderedLines = isMultiline
    ? currentText.split(/\n{2,}/).map((l) => l.trim()).filter(Boolean)
    : [currentText];

  return (
    <Box sx={sx}>
      {!editing ? (
        <>
          {renderedLines.map((line, i) => (
            <MuiTypography
              key={i}
              variant="body1"
              sx={{
                color: 'inherit',
                mb: i === renderedLines.length - 1 ? 0 : 1.5,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {fill ? fill(line) : line}
            </MuiTypography>
          ))}

          {/* Toolbar — edit + reset */}
          <Stack
            direction="row" spacing={1} alignItems="center"
            sx={{
              mt: 1.5, pt: 1.25, borderTop: `1px dashed ${BRAND.faint}`,
              flexWrap: 'wrap', gap: 0.75,
            }}
          >
            <Button
              size="small"
              startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={startEdit}
              sx={{
                textTransform: 'none', color: BRAND.muted, fontWeight: 600,
                fontSize: 12, py: 0.4, px: 1.25,
                '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
              }}
            >Edit</Button>

            {hasOverride && (
              <>
                <Chip
                  label="Edited"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(74,222,128,0.12)',
                    color: BRAND.green,
                    fontWeight: 700,
                    height: 20,
                    fontSize: 10,
                    border: '1px solid rgba(74,222,128,0.3)',
                  }}
                />
                <Button
                  size="small"
                  onClick={() => {
                    if (window.confirm('Reset this back to the default script?')) onResetOverride();
                  }}
                  sx={{
                    textTransform: 'none', color: 'rgba(248,113,113,0.7)',
                    fontWeight: 600, fontSize: 12, py: 0.4, px: 1.25,
                    '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.06)' },
                  }}
                >Reset to default</Button>
              </>
            )}
          </Stack>
        </>
      ) : (
        <Stack spacing={1.25}>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            multiline
            minRows={isMultiline ? 4 : 2}
            fullWidth
            autoFocus
            placeholder={isMultiline ? 'Separate paragraphs with a blank line.' : ''}
            sx={{
              ...darkInputSx,
              '& .MuiOutlinedInput-root': {
                ...darkInputSx['& .MuiOutlinedInput-root'],
                fontSize: 14, fontFamily: 'inherit',
              },
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              size="small" variant="contained"
              startIcon={<SaveOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={saveEdit}
              sx={{
                textTransform: 'none', fontWeight: 700, py: 0.6, fontSize: 12.5,
                bgcolor: BRAND.green, color: BRAND.greenDk,
                '&:hover': { bgcolor: '#22c55e' },
              }}
            >Save</Button>
            <Button
              size="small"
              startIcon={<CloseIcon sx={{ fontSize: 16 }} />}
              onClick={cancelEdit}
              sx={{
                textTransform: 'none', color: BRAND.muted, fontWeight: 600,
                py: 0.6, fontSize: 12.5,
                '&:hover': { color: BRAND.white, bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >Cancel</Button>
          </Stack>
          <MuiTypography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            Edits save to this device and stay until you reset. Click "Reset to default" any time to restore the original.
          </MuiTypography>
        </Stack>
      )}
    </Box>
  );
}

function ColdCallTab({ token }) {
  const [biz, setBiz] = React.useState('');
  const [svc, setSvc] = React.useState('');
  const [name, setName] = React.useState('');
  const [history, setHistory] = React.useState(['start']);
  const [notes, setNotes] = React.useState('');
  const [savedAt, setSavedAt] = React.useState('');

  // Overrides keyed by `${nodeId}::${field}` -> string (the edited text).
  // Persisted to localStorage. One override per field. No versions.
  const [overrides, setOverrides] = React.useState({});

  // Load persisted setup, notes, and overrides
  React.useEffect(() => {
    setBiz(localStorage.getItem('jpw_cc_biz') || '');
    setSvc(localStorage.getItem('jpw_cc_svc') || '');
    setName(localStorage.getItem('jpw_cc_name') || '');
    setNotes(localStorage.getItem('jpw_cc_notes') || '');
    try {
      const saved = JSON.parse(localStorage.getItem('jpw_cc_overrides') || '{}');
      if (saved && typeof saved === 'object') setOverrides(saved);
    } catch (e) {}
  }, []);

  React.useEffect(() => { localStorage.setItem('jpw_cc_biz', biz); }, [biz]);
  React.useEffect(() => { localStorage.setItem('jpw_cc_svc', svc); }, [svc]);
  React.useEffect(() => { localStorage.setItem('jpw_cc_name', name); }, [name]);
  React.useEffect(() => {
    localStorage.setItem('jpw_cc_overrides', JSON.stringify(overrides));
  }, [overrides]);

  // Debounced notes save to localStorage
  React.useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem('jpw_cc_notes', notes);
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 400);
    return () => clearTimeout(t);
  }, [notes]);

  const fill = React.useCallback((text) => {
    return text
      .replace(/\{\{biz\}\}/g, biz.trim() || '[Business Name]')
      .replace(/\{\{svc\}\}/g, svc.trim() || '[service]')
      .replace(/\{\{name\}\}/g, name.trim() || '[name]');
  }, [biz, svc, name]);

  const currentId = history[history.length - 1];
  const node = COLD_CALL_NODES[currentId];

  const goTo = (id) => setHistory((h) => [...h, id]);
  const goBack = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const restart = () => setHistory(['start']);

  const handleSaveOverride = (nodeId, field, text) => {
    setOverrides((m) => ({ ...m, [`${nodeId}::${field}`]: text }));
  };
  const handleResetOverride = (nodeId, field) => {
    setOverrides((m) => {
      const next = { ...m };
      delete next[`${nodeId}::${field}`];
      return next;
    });
  };

  const isEnd = !!node.end;
  const endColor = node.end === 'success' ? '#4ade80'
    : node.end === 'warning' ? '#fbbf24'
    : 'rgba(255,255,255,0.7)';
  const endBg = node.end === 'success' ? 'rgba(74,222,128,0.08)'
    : node.end === 'warning' ? 'rgba(251,191,36,0.08)'
    : 'rgba(255,255,255,0.04)';
  const endBorder = node.end === 'success' ? 'rgba(74,222,128,0.3)'
    : node.end === 'warning' ? 'rgba(251,191,36,0.3)'
    : 'rgba(255,255,255,0.12)';

  // Helper: get override for this node+field
  const overrideFor = (field) => overrides[`${currentId}::${field}`];

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      <MuiTypography variant="body2" sx={{ color: BRAND.muted, mb: 2.5 }}>
        Live decision tree for cold calls. Fill the owner's first name, business name, and service type at the top —
        every line autofills as you go. The owner name is the highest-leverage one: it changes the open from "is this the owner of ABC Plumbing" to "is this Mike" — sounds like you know them. Click "Edit" on any script to tweak it; edits stay on this device until you reset.
      </MuiTypography>

      {/* Setup inputs */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <TextField
          label="Owner first name"
          placeholder="Mike"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          sx={darkInputSx}
        />
        <TextField
          label="Business name"
          placeholder="ABC Plumbing"
          value={biz}
          onChange={(e) => setBiz(e.target.value)}
          fullWidth
          size="small"
          sx={darkInputSx}
        />
        <TextField
          label="Service type"
          placeholder="plumbing"
          value={svc}
          onChange={(e) => setSvc(e.target.value)}
          fullWidth
          size="small"
          sx={darkInputSx}
        />
      </Stack>

      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: BRAND.green }} />
        <MuiTypography variant="overline" sx={{ color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>
          {node.stage}
        </MuiTypography>
      </Stack>

      {/* Script card */}
      <Fade in key={currentId} timeout={250}>
        <Box>
          <Paper elevation={0} sx={{
            bgcolor: isEnd ? endBg : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isEnd ? endBorder : BRAND.faint}`,
            borderRadius: 3,
            p: { xs: 2.5, sm: 3 },
            mb: 2,
          }}>
            {isEnd && (
              <Chip
                label={node.badge}
                size="small"
                sx={{
                  bgcolor: endColor, color: '#0c1410', fontWeight: 800,
                  borderRadius: 999, mb: 1.5, height: 22, fontSize: 11,
                }}
              />
            )}

            {/* Main script */}
            <EditableScript
              nodeId={currentId}
              field="script"
              defaultLines={node.script}
              fill={fill}
              sx={{ color: isEnd ? endColor : BRAND.white }}
              override={overrideFor('script')}
              onSaveOverride={(t) => handleSaveOverride(currentId, 'script', t)}
              onResetOverride={() => handleResetOverride(currentId, 'script')}
            />

            {/* Voicemail block */}
            {node.voicemail && (
              <Box sx={{
                mt: 2, p: 2, borderRadius: 2,
                bgcolor: 'rgba(96,165,250,0.08)',
                border: '1px solid rgba(96,165,250,0.25)',
              }}>
                <MuiTypography variant="overline" sx={{
                  color: '#60a5fa', fontWeight: 700, letterSpacing: 1.2, display: 'block', mb: 0.5,
                }}>
                  Voicemail script
                </MuiTypography>
                <EditableScript
                  nodeId={currentId}
                  field="voicemail"
                  defaultLines={node.voicemail}
                  fill={fill}
                  sx={{ color: 'rgba(255,255,255,0.85)' }}
                  override={overrideFor('voicemail')}
                  onSaveOverride={(t) => handleSaveOverride(currentId, 'voicemail', t)}
                  onResetOverride={() => handleResetOverride(currentId, 'voicemail')}
                />
              </Box>
            )}

            {/* Direction block */}
            {node.direction && (
              <Box sx={{
                mt: 1.5, p: 1.25, borderRadius: 1.5,
                bgcolor: 'rgba(255,255,255,0.04)',
                borderLeft: `2px solid ${BRAND.green}`,
                fontStyle: 'italic',
              }}>
                <EditableScript
                  nodeId={currentId}
                  field="direction"
                  defaultLines={node.direction}
                  sx={{ color: BRAND.muted }}
                  override={overrideFor('direction')}
                  onSaveOverride={(t) => handleSaveOverride(currentId, 'direction', t)}
                  onResetOverride={() => handleResetOverride(currentId, 'direction')}
                />
              </Box>
            )}

            {/* Follow-up block */}
            {node.followUp && (
              <Box sx={{ mt: 1.5 }}>
                <EditableScript
                  nodeId={currentId}
                  field="followUp"
                  defaultLines={node.followUp}
                  fill={fill}
                  sx={{ color: BRAND.white }}
                  override={overrideFor('followUp')}
                  onSaveOverride={(t) => handleSaveOverride(currentId, 'followUp', t)}
                  onResetOverride={() => handleResetOverride(currentId, 'followUp')}
                />
              </Box>
            )}
          </Paper>

          {/* Response buttons */}
          {node.next && node.next.length > 0 && (
            <>
              <MuiTypography variant="caption" sx={{
                color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 1.2,
                fontWeight: 700, display: 'block', mb: 1,
              }}>
                They said:
              </MuiTypography>
              <Stack spacing={0.8} sx={{ mb: 2 }}>
                {node.next.map((opt, i) => (
                  <Button
                    key={`${currentId}-${i}`}
                    onClick={() => goTo(opt.to)}
                    variant="outlined"
                    sx={{
                      justifyContent: 'space-between',
                      textTransform: 'none', fontWeight: 500, fontSize: 14,
                      color: BRAND.white,
                      borderColor: 'rgba(255,255,255,0.12)',
                      bgcolor: 'rgba(255,255,255,0.02)',
                      borderRadius: 2,
                      py: 1.1, px: 1.75,
                      transition: 'all 0.12s',
                      '&:hover': {
                        borderColor: BRAND.green,
                        bgcolor: 'rgba(74,222,128,0.06)',
                        transform: 'translateX(2px)',
                      },
                    }}
                    endIcon={<ChevronRightIcon fontSize="small" sx={{ color: BRAND.muted }} />}
                  >
                    <Box sx={{ flexGrow: 1, textAlign: 'left' }}>{opt.label}</Box>
                  </Button>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Fade>

      {/* Nav controls */}
      <Stack direction="row" spacing={1} sx={{
        pt: 1.5, borderTop: `1px solid ${BRAND.faint}`, mb: 4,
      }}>
        {history.length > 1 && (
          <Button
            onClick={goBack}
            startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 12 }} />}
            size="small"
            sx={{
              textTransform: 'none', color: BRAND.muted, fontWeight: 600,
              '&:hover': { color: BRAND.white, bgcolor: 'rgba(255,255,255,0.04)' },
            }}
          >Back</Button>
        )}
        <Button
          onClick={restart}
          startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
          size="small"
          sx={{
            textTransform: 'none', color: BRAND.muted, fontWeight: 600,
            '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
          }}
        >Restart call</Button>
      </Stack>

      {/* Quick rebuttals */}
      <Box sx={{ mb: 4 }}>
        <MuiTypography variant="overline" sx={{
          color: BRAND.muted, letterSpacing: 1.5, fontWeight: 700, display: 'block', mb: 1.5,
        }}>
          Quick rebuttals
        </MuiTypography>
        {QUICK_REBUTTALS.map((r, i) => (
          <Accordion
            key={i}
            disableGutters
            elevation={0}
            sx={{
              bgcolor: 'rgba(255,255,255,0.02)',
              border: `1px solid ${BRAND.faint}`,
              borderRadius: '8px !important',
              mb: 0.6,
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: '0 0 4.8px 0' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: BRAND.muted }} />}
              sx={{
                px: 1.75,
                '& .MuiAccordionSummary-content': { my: 1.2 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
              }}
            >
              <MuiTypography variant="body2" sx={{ color: BRAND.white, fontWeight: 500 }}>
                {r.q}
              </MuiTypography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.75 }}>
              <MuiTypography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>
                {r.a}
              </MuiTypography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      {/* Notes */}
      <Box>
        <MuiTypography variant="overline" sx={{
          color: BRAND.muted, letterSpacing: 1.5, fontWeight: 700, display: 'block', mb: 1.5,
        }}>
          Notes &amp; new objections
        </MuiTypography>
        <TextField
          multiline
          minRows={4}
          fullWidth
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Track new objections you hear, prospect details, things to follow up on. Saves automatically."
          sx={darkInputSx}
        />
        <MuiTypography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.75, display: 'block' }}>
          {savedAt ? `Saved at ${savedAt}` : 'Saved automatically'}
        </MuiTypography>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hub — picks which tool to enter, grouped by brand
// ─────────────────────────────────────────────────────────────────────────────
const HUB_GROUPS = [
  {
    brand: 'Joint Printing',
    blurb: 'Apparel orders, leads, and mockup tools.',
    tools: [
      { id: 'manual',      label: 'Manual entry',  desc: 'Add Alpha Broder products by style code.', Icon: Inventory2OutlinedIcon },
      { id: 'submissions', label: 'Submissions',   desc: 'Mini-CRM for contact form leads.',         Icon: InboxIcon },
      { id: 'mockup',      label: 'Mockup Studio', desc: 'Build mockups, export PDFs for clients.',  Icon: DesignServicesIcon },
    ],
  },
  {
    brand: 'JP Webworks',
    blurb: 'Web services side — cold outreach and follow-ups.',
    tools: [
      { id: 'coldcall', label: 'Cold Calls', desc: 'JPW cold call tree with autofill + saved versions.', Icon: PhoneInTalkIcon },
    ],
  },
];

// Flat list of all tools, with brand attached, for header lookups
const HUB_TOOLS = HUB_GROUPS.flatMap((g) => g.tools.map((t) => ({ ...t, brand: g.brand })));

function HubCard({ tool, onClick, delay }) {
  const { label, desc, Icon } = tool;
  return (
    <Grow in timeout={400 + delay}>
      <Paper
        elevation={0}
        onClick={onClick}
        sx={{
          cursor: 'pointer',
          bgcolor: BRAND.panel,
          border: `1px solid ${BRAND.border}`,
          borderRadius: 3,
          p: { xs: 2.5, sm: 3 },
          transition: 'all 0.18s ease',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            borderColor: BRAND.green,
            transform: 'translateY(-3px)',
            boxShadow: '0 12px 32px -16px rgba(74,222,128,0.35)',
            '& .hub-icon': {
              bgcolor: BRAND.green,
              color: BRAND.greenDk,
              transform: 'scale(1.05)',
            },
            '& .hub-arrow': {
              opacity: 1,
              transform: 'translateX(0)',
            },
          },
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={2}>
          <Box
            className="hub-icon"
            sx={{
              flexShrink: 0,
              width: 48, height: 48, borderRadius: 2,
              bgcolor: BRAND.greenDk, color: BRAND.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.18s ease',
            }}
          >
            <Icon sx={{ fontSize: 24 }} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <MuiTypography variant="h6" fontWeight={800} sx={{
              color: BRAND.white, mb: 0.5, fontSize: 17,
            }}>
              {label}
            </MuiTypography>
            <MuiTypography variant="body2" sx={{ color: BRAND.muted, lineHeight: 1.5 }}>
              {desc}
            </MuiTypography>
          </Box>
          <ChevronRightIcon
            className="hub-arrow"
            sx={{
              color: BRAND.green,
              opacity: 0,
              transform: 'translateX(-6px)',
              transition: 'all 0.18s ease',
              alignSelf: 'center',
            }}
          />
        </Stack>
      </Paper>
    </Grow>
  );
}

function Hub({ onPick }) {
  // One counter so the Grow animations cascade across both groups instead of
  // resetting at each section header.
  let cardIdx = 0;
  return (
    <Stack spacing={4}>
      {HUB_GROUPS.map((group) => (
        <Box key={group.brand}>
          <Stack
            direction="row"
            alignItems="baseline"
            spacing={1.5}
            sx={{ mb: 1.5, flexWrap: 'wrap' }}
          >
            <MuiTypography
              variant="overline"
              sx={{
                color: BRAND.green,
                fontWeight: 800,
                letterSpacing: 2.5,
                fontSize: 11,
              }}
            >
              {group.brand}
            </MuiTypography>
            <MuiTypography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}
            >
              {group.blurb}
            </MuiTypography>
          </Stack>
          <Box sx={{
            display: 'grid',
            gap: { xs: 1.5, sm: 2 },
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          }}>
            {group.tools.map((t) => {
              const card = (
                <HubCard
                  key={t.id}
                  tool={t}
                  delay={cardIdx * 80}
                  onClick={() => onPick(t.id)}
                />
              );
              cardIdx += 1;
              return card;
            })}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main shell
// ─────────────────────────────────────────────────────────────────────────────
function StudioBody({ token, onLogout }) {
  const [view, setView] = React.useState('hub');
  const isHub = view === 'hub';
  const currentTool = HUB_TOOLS.find((t) => t.id === view);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: BRAND.bg, py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
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
              <MuiTypography variant="h3" fontWeight={900} sx={{
                color: BRAND.white, lineHeight: 1.1, fontSize: { xs: 30, md: 38 },
              }}>
                Studio
              </MuiTypography>
              <MuiTypography variant="body2" sx={{ color: BRAND.muted, mt: 0.5 }}>
                {isHub ? 'Pick a tool to get started.' : 'Manage products, leads, and mockups.'}
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

        {isHub ? (
          <Hub onPick={setView} />
        ) : (
          <Grow in timeout={350}>
            <Paper elevation={0} sx={{
              borderRadius: 3, overflow: 'hidden',
              bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`,
            }}>
              {/* Tool header bar with back button.
                  Breadcrumb: Studio › <Brand> › <Tool>. The brand step makes
                  it obvious that "Cold Calls" is JP Webworks, not part of the
                  apparel workflow. */}
              <Stack
                direction="row" alignItems="center" spacing={1.5}
                sx={{
                  px: { xs: 2.5, sm: 3 }, py: 1.75,
                  borderBottom: `1px solid ${BRAND.faint}`,
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  onClick={() => setView('hub')}
                  startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 12 }} />}
                  size="small"
                  sx={{
                    textTransform: 'none', color: BRAND.muted, fontWeight: 600,
                    minWidth: 'auto', px: 1.5,
                    '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
                  }}
                >Studio</Button>
                <Box sx={{
                  width: 4, height: 4, borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.2)',
                }} />
                {currentTool?.brand && (
                  <>
                    <MuiTypography variant="caption" sx={{
                      color: BRAND.green, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                    }}>
                      {currentTool.brand}
                    </MuiTypography>
                    <Box sx={{
                      width: 4, height: 4, borderRadius: '50%',
                      bgcolor: 'rgba(255,255,255,0.2)',
                    }} />
                  </>
                )}
                <MuiTypography variant="body2" sx={{
                  color: BRAND.white, fontWeight: 700,
                }}>
                  {currentTool?.label}
                </MuiTypography>
              </Stack>

              <Fade in key={view} timeout={300}>
                <Box>
                  {view === 'manual'      && <ManualEntryTab token={token} />}
                  {view === 'submissions' && <SubmissionsTab token={token} />}
                  {view === 'mockup'      && <MockupLauncherTab token={token} />}
                  {view === 'coldcall'    && <ColdCallTab token={token} />}
                </Box>
              </Fade>
            </Paper>
          </Grow>
        )}
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
