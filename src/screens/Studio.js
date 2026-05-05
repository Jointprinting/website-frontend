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
  Tooltip,
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
import CheckIcon from '@mui/icons-material/Check';
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
//  Cold Calls — JPW cold call decision tree with editable script versions
//
//  Each node has built-in "default" content (script lines, follow-ups,
//  voicemail). Editing a line creates a new version saved to MongoDB,
//  scoped to that node + that field. You can switch between Default and
//  any of your saved versions with a dropdown — current selection persists
//  to localStorage so the call resumes where you left off.
// ─────────────────────────────────────────────────────────────────────────────
const COLD_CALL_NODES = {
  start: {
    stage: 'Open',
    script: ['Hey, is this the owner of {{biz}}?'],
    next: [
      { label: 'Yes, this is the owner', to: 'intro' },
      { label: 'No / can I help you?', to: 'gatekeeper' },
      { label: 'Goes to voicemail', to: 'voicemail' },
      { label: 'Not a good time / hangs up', to: 'callback' },
    ],
  },
  gatekeeper: {
    stage: 'Gatekeeper',
    script: ["No problem — could you point me to the owner? It's about how the business is showing up online compared to others in the {{svc}} space around here. Just wanted to give them a heads up directly."],
    direction: "Stay friendly and brief. Don't pitch the gatekeeper — they don't have authority and feel disrespected if you try. Get a name + best time to call back, or ask if they can grab the owner now.",
    next: [
      { label: 'Owner is here, transferring', to: 'intro' },
      { label: 'Got name + callback time', to: 'callback' },
      { label: 'They want me to email', to: 'send_something' },
      { label: "Owner won't talk to cold calls", to: 'polite_exit' },
    ],
  },
  intro: {
    stage: 'Intro & hook',
    script: [
      'Perfect — this is Nate with JP Webworks.',
      "Looked you up before calling — your competitors have 80–100 Google reviews, you've got 20. I do local visibility for {{svc}} companies in South Jersey. You guys still taking on new work?",
    ],
    direction: "Pause. Let the gap land. Don't over-explain — the number does the work.",
    next: [
      { label: 'Yes, taking new work', to: 'discovery' },
      { label: "We're slammed / get enough work", to: 'enough_work' },
      { label: 'We have someone doing marketing', to: 'have_a_guy' },
      { label: 'What do you do exactly?', to: 'what_do_you_do' },
      { label: 'How much does it cost?', to: 'price_early' },
      { label: "I don't need a website", to: 'dont_need' },
      { label: 'Just send me something', to: 'send_something' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },
  discovery: {
    stage: 'Discovery',
    script: [
      "Got it. That's exactly why I called.",
      "When someone in your area needs {{svc}}, the first thing they do is search. Whoever's in that 80–100 review group with a real website usually gets the call — even if you're the better operator. The 10–20 review guys never even get the chance to pitch.",
    ],
    followUp: ['Out of curiosity — are most of your customers coming from referrals right now, or do people find you through Google too?'],
    direction: 'Then shut up. Whoever talks first loses.',
    next: [
      { label: 'Mostly referrals / word of mouth', to: 'referrals' },
      { label: 'Google / online / a mix', to: 'google' },
      { label: "What's a digital audit?", to: 'what_is_audit' },
      { label: 'How much does it cost?', to: 'price_early' },
      { label: 'We have someone doing marketing', to: 'have_a_guy' },
    ],
  },
  referrals: {
    stage: 'Referrals → audit ask',
    script: [
      'That makes sense. Referrals are usually the best leads.',
      "Here's the thing though — even when someone refers you, the next thing they do is Google your name. If they see 20 reviews and a barebones website while the next {{svc}} guy has 90 and looks dialed in, you can lose a referral you already earned.",
    ],
    direction: 'Move to the audit ask.',
    followUp: [
      "I'm not trying to sell you a big marketing package over the phone.",
      'The next step would just be a quick digital audit — we look at how you show up online, what customers see before they call, and whether there are easy fixes that could help you get more calls or better jobs.',
      "What's the best cell or email to send that to?",
    ],
    next: [
      { label: 'Got cell or email', to: 'success' },
      { label: "What's a digital audit?", to: 'what_is_audit' },
      { label: 'How much does it cost?', to: 'price_early' },
      { label: 'Just send me something', to: 'send_something' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },
  google: {
    stage: 'Google → audit ask',
    script: [
      'Got it. Then the gap between you and the 80–100 review crowd is probably costing you real jobs every week.',
      "Google may show your business, but the website is what tells someone what you actually do, where you work, and why they should call you instead of the next listing. If yours looks dated or doesn't load right on a phone, they bounce.",
    ],
    direction: 'Move to the audit ask.',
    followUp: [
      "The smart move isn't guessing. I'll have my market expert run a quick digital audit first.",
      "Then I'll send you a simple recommendation — maybe website first, Google cleanup, ads later, or nothing at all if it doesn't make sense.",
      "What's the best cell or email?",
    ],
    next: [
      { label: 'Got cell or email', to: 'success' },
      { label: "What's a digital audit?", to: 'what_is_audit' },
      { label: 'How much does it cost?', to: 'price_early' },
      { label: 'Just send me something', to: 'send_something' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },
  what_is_audit: {
    stage: "Objection: what's an audit?",
    script: [
      'Simple version — we check what a customer sees when they search for you.',
      'We look at whether you show up clearly, whether your services are easy to understand, whether people have a clear way to call or request a quote, and how you compare to the {{svc}} companies winning right now in your area.',
      "Then I send a plain-English recommendation on what I'd fix first.",
    ],
    followUp: ["What's the best cell or email to send it to?"],
    next: [
      { label: 'Got cell or email', to: 'success' },
      { label: 'How much does it cost?', to: 'price_early' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },
  what_do_you_do: {
    stage: 'Objection: what do you do?',
    script: [
      'We help local service businesses get more calls and leads from the online side.',
      'For a business stuck in the 10–20 review group with no real website, we usually start with a clean site that shows services, service areas, photos, and click-to-call buttons.',
      "Then if it makes sense we can help with Google visibility, reviews, ads, tracking, follow-up. But first I'd rather audit the business and see what's actually worth fixing.",
    ],
    next: [
      { label: 'OK, sounds interesting', to: 'discovery' },
      { label: 'How much does it cost?', to: 'price_early' },
      { label: 'We have someone doing marketing', to: 'have_a_guy' },
      { label: 'Just send me something', to: 'send_something' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },
  price_early: {
    stage: 'Objection: price',
    script: [
      "Honest answer — depends on what we figure out you actually need. Some guys need a website rebuild, some have a site but their Google ranking is invisible, some need help getting reviews, some need ads. Each one's a different fix at a different price point.",
      'Cheapest stuff like reviews and Google profile cleanup runs a few hundred a month. Full website builds are $749 setup and $299 a month. Ads layer on top depending on what you want to spend.',
      "Point is, I'm not going to quote you before I look at the business. The audit tells us where the leak actually is, then I'll tell you straight what the fix costs.",
    ],
    followUp: ["What's the best cell or email to send the audit to?"],
    next: [
      { label: 'Got cell or email', to: 'success' },
      { label: 'Too expensive either way', to: 'too_expensive' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },
  too_expensive: {
    stage: 'Objection: too expensive',
    script: [
      "Totally hear you — it's a real number, especially when you don't know yet what you're actually getting back.",
      'Think about it this way — one extra job a month from looking like the 80–100 review guys instead of the 10–20 ones usually pays for the whole year. But that\'s only if the website actually moves the needle for your specific business, which is what the audit tells us.',
    ],
    followUp: ["Worth me sending the audit either way? It's free, and if a website isn't the right move for you right now I'll tell you straight up."],
    direction: "Don't drop the price or invent a discount. The audit is the de-risker, not a smaller sticker.",
    next: [
      { label: 'OK, send the audit', to: 'audit_ask' },
      { label: 'Still a no', to: 'not_interested' },
    ],
  },
  have_a_guy: {
    stage: 'Objection: already have someone',
    script: [
      "Good — that means you already take this stuff seriously. Most owners I call don't.",
      "Quick question, not a trick — what's your guy actually handling? Website, Google profile, reviews, ads, all of it?",
    ],
    direction: "Listen carefully. 'My nephew built the site' is very different from 'I pay an agency $2k/month.' Adjust based on the answer.",
    followUp: [
      "Reason I ask — most of the {{svc}} companies I call who say they have a guy are still sitting in the 10–20 review group. Either the guy isn't doing what they think he's doing, or they're paying for the wrong things. The 80–100 review crowd doesn't get there by accident.",
      "I can run the audit either way and send it over. If everything's tight, you've got a benchmark to hold your guy accountable to. What's the best cell or email?",
    ],
    next: [
      { label: 'Got cell or email', to: 'success' },
      { label: "He handles everything, we're good", to: 'have_a_guy_firm' },
      { label: "It's just a family member / nephew", to: 'discovery' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },
  have_a_guy_firm: {
    stage: 'Already have someone — firm no',
    script: [
      "Fair enough — sounds like you're set up.",
      "Mind if I send the audit anyway, no strings? Worst case it confirms your guy is doing his job. Best case you spot something he's missed before a competitor does.",
    ],
    direction: "If still no after this, drop it. Don't push past two soft asks — they'll remember you respected it and you can come back in 90 days.",
    next: [
      { label: 'OK fine, send it', to: 'audit_ask' },
      { label: 'Still no', to: 'polite_exit' },
    ],
  },
  dont_need: {
    stage: "Objection: don't need a website",
    script: [
      'Totally fair. Plenty of good businesses have grown without one.',
      "But the 80–100 review guys aren't winning because they're better at the work — they're winning because they show up when someone searches and they look established. The 10–20 review group, no real website group, just gets skipped before the phone even rings.",
    ],
    followUp: [
      "Let me do this instead — I'll run a quick digital audit and show you exactly what someone sees when they Google {{svc}} in your area. If there's nothing worth fixing, I'll tell you.",
      "What's the best email or cell?",
    ],
    next: [
      { label: 'Got cell or email', to: 'success' },
      { label: 'Still not interested', to: 'not_interested' },
    ],
  },
  enough_work: {
    stage: 'Objection: get enough work',
    script: [
      "That's a good problem to have.",
      "Then I wouldn't frame this as 'you desperately need more leads.' It's more about getting better jobs — the higher-ticket ones — and making sure when someone hears about you they don't bounce because the website looks like it was built in 2014. The 80–100 review guys are pulling the bigger jobs partly because they look like they can handle them.",
    ],
    followUp: ["The audit would show whether there's actually an opportunity worth your time, or whether you're already running tight. Worth me sending it over?"],
    next: [
      { label: 'Yes, send it', to: 'audit_ask' },
      { label: "No, I'm good", to: 'polite_exit' },
    ],
  },
  send_something: {
    stage: 'They asked: send me something',
    script: ["Absolutely. I'll keep it short."],
    followUp: ['Quick before I send it — what kind of jobs are you usually trying to get more of? Bigger residential, commercial, specific service?'],
    direction: "They're now telling you exactly what the audit should focus on. Take notes — this is gold for the follow-up.",
    next: [
      { label: 'They told me what they want', to: 'send_close' },
      { label: "They won't say / shut down", to: 'audit_ask' },
    ],
  },
  send_close: {
    stage: 'Closing the audit ask',
    script: ["Perfect. I'll build the audit around that, not just send a generic website pitch."],
    followUp: ["What's the best cell or email?"],
    next: [
      { label: 'Got cell or email', to: 'success' },
      { label: 'Hesitating', to: 'audit_ask' },
    ],
  },
  audit_ask: {
    stage: 'Audit ask (clean version)',
    script: [
      'Perfect. The next step is simple.',
      "I'll run a quick digital audit on how your business shows up online, what customers see before they call, and where you may be losing leads.",
      "Then I'll send a clear recommendation on what I'd fix first. If it makes sense, we'll talk through the right starting point from there.",
    ],
    followUp: ["What's the best cell or email?"],
    next: [
      { label: 'Got cell or email', to: 'success' },
      { label: 'Not interested', to: 'not_interested' },
    ],
  },
  voicemail: {
    stage: 'Voicemail',
    end: 'warning',
    badge: 'Leave VM + send text',
    script: ['Leave the voicemail below, then send a follow-up text within 2 minutes while your name is fresh.'],
    voicemail: 'Hey [name], this is Nate with JP Webworks. This is a cold call, figured you should know up front. I work with local service businesses in the Central/South Jersey area on their website and Google visibility side of things, and I had a couple thoughts after looking up {{biz}}. I\'ll shoot you a text so you\'ve got my number. Give me a call or text when you\'ve got a sec.',
    direction: 'Cadence rule: only leave a voicemail on attempt 1 and attempt 4 (with new info). Attempts 2 and 3, just call and hang up if it goes to VM. After 5 touches with no reply, move them to a 60-day backburner.',
  },
  callback: {
    stage: 'Callback path',
    end: 'neutral',
    badge: 'Callback scheduled',
    script: ["No problem at all — when's a better time to catch you for two minutes?"],
    direction: "Get a specific day and time. Add it to your calendar. Confirm the number to call. If they're vague ('sometime next week'), pin it down: 'Tuesday morning or afternoon better?'",
  },
  not_interested: {
    stage: 'Polite exit (cold)',
    end: 'neutral',
    badge: 'Closed — 90-day follow-up',
    script: [
      'No worries — I appreciate you taking the call.',
      'Mind if I check back in a few months in case anything changes? No newsletter, no spam — just one call.',
    ],
    direction: 'If yes: log for 90-day follow-up. If no: respect it and move on. Either way, end warm — they remember the call. Service businesses ripen; the no today is often a yes after their slow season.',
  },
  polite_exit: {
    stage: 'Polite exit (warm)',
    end: 'neutral',
    badge: 'Closed — 90-day follow-up',
    script: [
      "All good — I'll let you get back to it.",
      "I'll check back in a few months. If anything changes on your end before then, you've got my number.",
    ],
    direction: "Use this for soft no's where the relationship was friendly. Logs them in CRM with a 90-day reminder.",
  },
  success: {
    stage: 'Win',
    end: 'success',
    badge: 'Audit booked',
    script: [
      "Perfect, [name]. I'll have that audit over to you by [day]. Quick question — cool if I follow up with a call once you've had a chance to look at it?",
      "Either way, you'll have something useful in your inbox. Talk soon.",
    ],
    direction: 'Log in CRM. Schedule the audit follow-up. Set a reminder to call them back 2–3 days after sending.',
  },
};

const QUICK_REBUTTALS = [
  { q: '"I\'m driving / in a meeting / busy right now"', a: "No problem — what's a better time to catch you for two minutes? Tomorrow morning or afternoon better?" },
  { q: '"How did you get my number?"', a: 'Public records — your Google business listing. Cold call, that\'s all.' },
  { q: '"Take me off your list"', a: "No problem — won't call again. Take care." },
  { q: '"I\'m not the decision maker"', a: 'Got it — who handles the website and marketing side? Could you point me in their direction?' },
  { q: '"We tried marketing before, didn\'t work"', a: "Yeah, lots of agencies oversell. That's why I do the audit first — if it doesn't make sense for your business, I'll tell you straight up. No charge, no commitment." },
  { q: '"I just got a website built last year"', a: 'Good — even better. Mind if I send the audit anyway? If your guy did good work, you\'ve got a benchmark. If he missed something, you\'d want to know before it costs you jobs.' },
  { q: '"Are you AI / a robot?"', a: 'Ha, no — Nate, real person. Calling out of Marlton.' },
  { q: '"How long does the website take to build?"', a: "Usually 1–2 weeks from when we kick off. Then it's live and we handle updates as you need them." },
  { q: '"Can I see examples of your work?"', a: "Absolutely — I'll send a couple links along with the audit. What's the best cell or email?" },
  { q: '"Why should I trust you over the other 50 guys calling me?"', a: "Fair question. Two reasons — I do the audit first so you see what I see before paying anything, and the website's $749 setup, not the $5K most guys quote. Worst case you get a free audit out of this call." },
];

// ─────────────────────────────────────────────────────────────────────────────
//  EditableScript — renders a list of script lines for one node+field, with
//  inline editing + version dropdown.
//
//  field: 'script' | 'followUp' | 'voicemail' | 'direction'
//  defaultLines: array of strings (or single string for voicemail/direction)
// ─────────────────────────────────────────────────────────────────────────────
function EditableScript({
  nodeId, field, defaultLines, fill, sx,
  versions, activeVersionId, onChooseVersion, onSaveNewVersion, onDeleteVersion,
  isLoading,
}) {
  const isMultiline = Array.isArray(defaultLines);
  const defaultText = isMultiline ? defaultLines.join('\n\n') : (defaultLines || '');

  // Active text (what's currently shown). null = use default.
  const activeVersion = versions.find((v) => v._id === activeVersionId);
  const currentText = activeVersion ? activeVersion.text : defaultText;

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const startEdit = () => {
    setDraft(currentText);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };
  const saveEdit = async () => {
    if (!draft.trim() || draft === currentText) { cancelEdit(); return; }
    setSaving(true);
    try {
      await onSaveNewVersion(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
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

          {/* Toolbar — version picker + edit button */}
          <Stack
            direction="row" spacing={1} alignItems="center"
            sx={{
              mt: 1.5, pt: 1.25, borderTop: `1px dashed ${BRAND.faint}`,
              flexWrap: 'wrap', gap: 0.75,
            }}
          >
            {versions.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={activeVersionId || 'default'}
                  onChange={(e) => onChooseVersion(e.target.value === 'default' ? null : e.target.value)}
                  sx={{
                    fontSize: 12, height: 30,
                    bgcolor: 'rgba(255,255,255,0.04)', color: BRAND.white,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.10)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                    '& .MuiSvgIcon-root': { color: BRAND.muted },
                    '& .MuiSelect-select': { color: BRAND.white, py: 0.6 },
                  }}
                >
                  <MenuItem value="default">Default version</MenuItem>
                  {versions.map((v) => (
                    <MenuItem key={v._id} value={v._id}>
                      {v.label || `Saved ${new Date(v.createdAt).toLocaleDateString()}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Tooltip title="Edit this script">
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
            </Tooltip>

            {activeVersion && (
              <Tooltip title="Delete this saved version (default stays available)">
                <Button
                  size="small"
                  startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
                  onClick={() => onDeleteVersion(activeVersion._id)}
                  sx={{
                    textTransform: 'none', color: 'rgba(248,113,113,0.7)',
                    fontWeight: 600, fontSize: 12, py: 0.4, px: 1.25,
                    '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.06)' },
                  }}
                >Delete version</Button>
              </Tooltip>
            )}

            {isLoading && (
              <CircularProgress size={14} sx={{ color: BRAND.muted, ml: 0.5 }} />
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
            placeholder={isMultiline ? 'Separate lines with a blank line.' : ''}
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
              size="small" variant="contained" disabled={saving}
              startIcon={saving ? <CircularProgress size={14} sx={{ color: BRAND.greenDk }} /> : <SaveOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={saveEdit}
              sx={{
                textTransform: 'none', fontWeight: 700, py: 0.6, fontSize: 12.5,
                bgcolor: BRAND.green, color: BRAND.greenDk,
                '&:hover': { bgcolor: '#22c55e' },
                '&:disabled': { bgcolor: 'rgba(74,222,128,0.4)' },
              }}
            >
              {saving ? 'Saving…' : 'Save as new version'}
            </Button>
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
            Saving creates a new version — the default is always preserved and can be selected from the dropdown.
          </MuiTypography>
        </Stack>
      )}
    </Box>
  );
}

function ColdCallTab({ token }) {
  const [biz, setBiz] = React.useState('');
  const [svc, setSvc] = React.useState('');
  const [history, setHistory] = React.useState(['start']);
  const [notes, setNotes] = React.useState('');
  const [savedAt, setSavedAt] = React.useState('');

  // Versions keyed by `${nodeId}::${field}` → array of { _id, text, label, createdAt }
  const [versionsMap, setVersionsMap] = React.useState({});
  // Active version id keyed the same way (null = default)
  const [activeMap, setActiveMap] = React.useState({});
  const [versionsLoading, setVersionsLoading] = React.useState(false);

  // Load persisted setup, notes, and active selections
  React.useEffect(() => {
    setBiz(localStorage.getItem('jpw_cc_biz') || '');
    setSvc(localStorage.getItem('jpw_cc_svc') || '');
    setNotes(localStorage.getItem('jpw_cc_notes') || '');
    try {
      const saved = JSON.parse(localStorage.getItem('jpw_cc_active_versions') || '{}');
      if (saved && typeof saved === 'object') setActiveMap(saved);
    } catch (e) {}
  }, []);

  React.useEffect(() => { localStorage.setItem('jpw_cc_biz', biz); }, [biz]);
  React.useEffect(() => { localStorage.setItem('jpw_cc_svc', svc); }, [svc]);
  React.useEffect(() => {
    localStorage.setItem('jpw_cc_active_versions', JSON.stringify(activeMap));
  }, [activeMap]);

  // Debounced notes save to localStorage
  React.useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem('jpw_cc_notes', notes);
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 400);
    return () => clearTimeout(t);
  }, [notes]);

  // Fetch all versions on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      setVersionsLoading(true);
      try {
        const res = await axios.get(`${config.backendUrl}/api/script-versions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const grouped = {};
        for (const v of res.data?.versions || []) {
          const key = `${v.nodeId}::${v.field}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(v);
        }
        // Sort each by createdAt desc
        Object.values(grouped).forEach((arr) => arr.sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        ));
        setVersionsMap(grouped);
      } catch (err) {
        console.error('Could not load script versions', err);
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const fill = React.useCallback((text) => {
    return text
      .replace(/\{\{biz\}\}/g, biz.trim() || '[Business Name]')
      .replace(/\{\{svc\}\}/g, svc.trim() || '[service]');
  }, [biz, svc]);

  const currentId = history[history.length - 1];
  const node = COLD_CALL_NODES[currentId];

  const goTo = (id) => setHistory((h) => [...h, id]);
  const goBack = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const restart = () => setHistory(['start']);

  const handleSaveVersion = async (nodeId, field, text) => {
    try {
      const res = await axios.post(
        `${config.backendUrl}/api/script-versions`,
        { nodeId, field, text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newVersion = res.data?.version;
      if (newVersion) {
        const key = `${nodeId}::${field}`;
        setVersionsMap((m) => ({
          ...m,
          [key]: [newVersion, ...(m[key] || [])],
        }));
        // Auto-select the version you just made — that's almost always what you want
        setActiveMap((m) => ({ ...m, [key]: newVersion._id }));
      }
    } catch (err) {
      alert('Could not save: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleChooseVersion = (nodeId, field, versionId) => {
    const key = `${nodeId}::${field}`;
    setActiveMap((m) => ({ ...m, [key]: versionId }));
  };

  const handleDeleteVersion = async (nodeId, field, versionId) => {
    if (!window.confirm('Delete this saved version? The default is always preserved.')) return;
    try {
      await axios.delete(`${config.backendUrl}/api/script-versions/${versionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const key = `${nodeId}::${field}`;
      setVersionsMap((m) => ({
        ...m,
        [key]: (m[key] || []).filter((v) => v._id !== versionId),
      }));
      // If the deleted version was active, fall back to default
      setActiveMap((m) => {
        if (m[key] === versionId) {
          const next = { ...m };
          delete next[key];
          return next;
        }
        return m;
      });
    } catch (err) {
      alert('Could not delete: ' + (err?.response?.data?.message || err.message));
    }
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

  // Helper: get versions / active id for this node+field
  const vKey = (field) => `${currentId}::${field}`;
  const versionsFor = (field) => versionsMap[vKey(field)] || [];
  const activeFor = (field) => activeMap[vKey(field)] || null;

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      <MuiTypography variant="body2" sx={{ color: BRAND.muted, mb: 2.5 }}>
        Live decision tree for cold calls. Type the business name and service type at the top —
        every line autofills as you go. Click any script to edit it; saved versions sync across devices.
      </MuiTypography>

      {/* Setup inputs */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
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
              versions={versionsFor('script')}
              activeVersionId={activeFor('script')}
              onChooseVersion={(id) => handleChooseVersion(currentId, 'script', id)}
              onSaveNewVersion={(text) => handleSaveVersion(currentId, 'script', text)}
              onDeleteVersion={(id) => handleDeleteVersion(currentId, 'script', id)}
              isLoading={versionsLoading}
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
                  versions={versionsFor('voicemail')}
                  activeVersionId={activeFor('voicemail')}
                  onChooseVersion={(id) => handleChooseVersion(currentId, 'voicemail', id)}
                  onSaveNewVersion={(text) => handleSaveVersion(currentId, 'voicemail', text)}
                  onDeleteVersion={(id) => handleDeleteVersion(currentId, 'voicemail', id)}
                  isLoading={versionsLoading}
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
                  versions={versionsFor('direction')}
                  activeVersionId={activeFor('direction')}
                  onChooseVersion={(id) => handleChooseVersion(currentId, 'direction', id)}
                  onSaveNewVersion={(text) => handleSaveVersion(currentId, 'direction', text)}
                  onDeleteVersion={(id) => handleDeleteVersion(currentId, 'direction', id)}
                  isLoading={versionsLoading}
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
                  versions={versionsFor('followUp')}
                  activeVersionId={activeFor('followUp')}
                  onChooseVersion={(id) => handleChooseVersion(currentId, 'followUp', id)}
                  onSaveNewVersion={(text) => handleSaveVersion(currentId, 'followUp', text)}
                  onDeleteVersion={(id) => handleDeleteVersion(currentId, 'followUp', id)}
                  isLoading={versionsLoading}
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
