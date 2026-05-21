// src/screens/Studio.js
//
// Password-protected admin/studio page. Hub-based navigation — pick a tool
// from a card grid, enter it, click "Studio" to come back.
//
//   Joint Printing tools:
//     1) Submissions — mini-CRM for contact form leads
//     2) Mockup Studio — launches /jpstudio/ in a new tab
//   JP Webworks tools:
//     3) Cold Calls — JPW cold-call decision tree with editable script versions

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
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import InboxIcon from '@mui/icons-material/Inbox';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import config from '../config.json';
import CatalogManagerTab from './studio/CatalogManagerTab';
import RoadTripTab from './studio/RoadTripTab';
import QuoterTab from './studio/QuoterTab';
import JpwReconTab from './studio/JpwReconTab';
import ClientHubTab from './studio/ClientHubTab';

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
        localStorage.setItem(TOKEN_KEY, res.data.token);
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
          <Stack spacing={1.5} alignItems="center" mb={3}>
            <Box sx={{
              bgcolor: BRAND.greenDk, color: BRAND.green,
              width: 48, height: 48, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 5px rgba(74,222,128,0.07)',
            }}>
              <LockIcon sx={{ fontSize: 22 }} />
            </Box>
            <MuiTypography
              sx={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 16, fontWeight: 800, color: BRAND.white, letterSpacing: 1,
              }}
            >
              JP <Box component="span" sx={{ color: BRAND.green }}>STUDIO</Box>
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

    // One-shot handoff from the JPW Lead Recon tab: when the user clicks
    // "Cold Call Tree" on a lead, that tab writes the lead context to
    // sessionStorage just before switching views. We pick it up here and
    // pre-fill the three setup fields, then clear it so re-entering the
    // tree later doesn't re-apply the same lead.
    try {
      const handoff = sessionStorage.getItem('jpwColdCallContext');
      if (handoff) {
        const ctx = JSON.parse(handoff);
        if (ctx && typeof ctx === 'object') {
          if (ctx.biz)  setBiz(ctx.biz);
          if (ctx.svc)  setSvc(ctx.svc);
          if (ctx.name) setName(ctx.name);
        }
        sessionStorage.removeItem('jpwColdCallContext');
      }
    } catch (e) { /* malformed handoff — skip */ }
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
    tools: [
      { id: 'submissions', label: 'Inquiries',            Icon: InboxIcon },
      { id: 'quoter',      label: 'Quoter',               Icon: RequestQuoteOutlinedIcon },
      { id: 'clients',     label: 'Order Tracker',         Icon: PeopleOutlineIcon },
      { id: 'catalogs',    label: 'Catalogs',             Icon: MenuBookOutlinedIcon },
      { id: 'roadtrip',    label: 'Field Map',             Icon: ExploreOutlinedIcon },
      { id: 'mockup',      label: 'Mockup Studio',        Icon: DesignServicesIcon },
    ],
  },
  {
    brand: 'JP Webworks',
    tools: [
      { id: 'coldcall',  label: 'Cold Call Tree', Icon: PhoneInTalkIcon },
      { id: 'jpwrecon',  label: 'Lead Recon',     Icon: TrackChangesOutlinedIcon },
    ],
  },
];

// Flat list of all tools, with brand attached, for header lookups
const HUB_TOOLS = HUB_GROUPS.flatMap((g) => g.tools.map((t) => ({ ...t, brand: g.brand })));

function HubCard({ tool, onClick, delay }) {
  const { label, Icon } = tool;
  return (
    <Grow in timeout={400 + delay}>
      <Paper
        elevation={0}
        onClick={onClick}
        sx={{
          cursor: 'pointer',
          bgcolor: BRAND.panel,
          border: `1px solid ${BRAND.border}`,
          borderRadius: 2,
          p: { xs: 1.75, sm: 2 },
          transition: 'all 0.18s ease',
          '&:hover': {
            borderColor: BRAND.green,
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px -12px rgba(74,222,128,0.35)',
            '& .hub-icon': {
              bgcolor: BRAND.green,
              color: BRAND.greenDk,
            },
            '& .hub-arrow': {
              opacity: 1,
              transform: 'translateX(0)',
            },
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            className="hub-icon"
            sx={{
              flexShrink: 0,
              width: 38, height: 38, borderRadius: 1.5,
              bgcolor: BRAND.greenDk, color: BRAND.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.18s ease',
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Box>
          <MuiTypography fontWeight={700} sx={{
            color: BRAND.white, fontSize: 14.5, flexGrow: 1,
          }}>
            {label}
          </MuiTypography>
          <ChevronRightIcon
            className="hub-arrow"
            sx={{
              color: BRAND.green, fontSize: 18,
              opacity: 0,
              transform: 'translateX(-4px)',
              transition: 'all 0.18s ease',
            }}
          />
        </Stack>
      </Paper>
    </Grow>
  );
}

function Hub({ onPick }) {
  let cardIdx = 0;
  return (
    <Stack spacing={3}>
      {HUB_GROUPS.map((group) => (
        <Box key={group.brand}>
          <MuiTypography
            variant="overline"
            sx={{
              color: BRAND.green, fontWeight: 800, letterSpacing: 2.5,
              fontSize: 10, display: 'block', mb: 1,
            }}
          >
            {group.brand}
          </MuiTypography>
          <Box sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}>
            {group.tools.map((t) => {
              const card = (
                <HubCard
                  key={t.id}
                  tool={t}
                  delay={cardIdx * 60}
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

  const handlePick = (id) => {
    if (id === 'mockup') {
      window.open(`/jpstudio/?t=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    setView(id);
  };

  // Road Trip Recon needs the full viewport — break out of the Studio's
  // maxWidth="md" container and render a slim header instead of the usual
  // Studio chrome. Returning early keeps the rest of the function untouched.
  if (view === 'roadtrip') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#05080a' }}>
        <Stack
          direction="row" alignItems="center" spacing={2}
          sx={{
            height: 56, px: 2, borderBottom: '1px solid #1a3d2b',
            bgcolor: '#0a0e10', color: BRAND.green,
          }}
        >
          <Button
            onClick={() => setView('hub')}
            startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />}
            size="small"
            sx={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              color: BRAND.muted, textTransform: 'none', minWidth: 0,
              '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.08)' },
            }}
          >
            Studio
          </Button>
          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)' }} />
          <MuiTypography sx={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12, color: BRAND.green, fontWeight: 700,
          }}>
            Field Map
          </MuiTypography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            onClick={onLogout}
            size="small"
            sx={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
              color: 'rgba(212,244,221,0.6)', textTransform: 'none',
              '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.08)' },
            }}
          >
            SIGN OUT
          </Button>
        </Stack>
        <RoadTripTab token={token} />
      </Box>
    );
  }


  if (view === 'quoter') {
    return <QuoterTab token={token} onBack={() => setView('hub')} />;
  }

  if (view === 'clients') {
    return <ClientHubTab token={token} onBack={() => setView('hub')} />;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: BRAND.bg, py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        <Fade in timeout={350}>
          <Stack
            direction="row"
            alignItems="center" justifyContent="space-between"
            sx={{ mb: { xs: 2.5, md: 3.5 } }}
          >
            <MuiTypography
              sx={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: { xs: 15, md: 17 }, fontWeight: 800,
                color: BRAND.white, letterSpacing: 1,
              }}
            >
              JP <Box component="span" sx={{ color: BRAND.green }}>STUDIO</Box>
            </MuiTypography>
            <Button
              onClick={onLogout} size="small"
              sx={{
                textTransform: 'none', fontWeight: 600, fontSize: 12,
                color: BRAND.muted,
                '&:hover': { color: BRAND.white, bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >Sign out</Button>
          </Stack>
        </Fade>

        {isHub ? (
          <Hub onPick={handlePick} />
        ) : (
          <Grow in timeout={350}>
            <Paper elevation={0} sx={{
              borderRadius: 3, overflow: 'hidden',
              bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`,
            }}>
              <Stack
                direction="row" alignItems="center" spacing={1.5}
                sx={{
                  px: { xs: 2, sm: 2.5 }, py: 1.5,
                  borderBottom: `1px solid ${BRAND.faint}`,
                }}
              >
                <Button
                  onClick={() => setView('hub')}
                  startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />}
                  size="small"
                  sx={{
                    textTransform: 'none', color: BRAND.muted, fontWeight: 600,
                    minWidth: 'auto', px: 1, fontSize: 12,
                    '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
                  }}
                >Studio</Button>
                <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)' }} />
                <MuiTypography sx={{ color: BRAND.green, fontWeight: 700, fontSize: 13 }}>
                  {currentTool?.label}
                </MuiTypography>
              </Stack>

              <Fade in key={view} timeout={300}>
                <Box>
                  {view === 'submissions' && <SubmissionsTab token={token} />}
                  {view === 'catalogs'    && <CatalogManagerTab token={token} />}
                  {view === 'mockup'      && <MockupLauncherTab token={token} />}
                  {view === 'coldcall'    && <ColdCallTab token={token} />}
                  {view === 'jpwrecon'    && <JpwReconTab token={token} onOpenColdCall={() => setView('coldcall')} />}
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
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      axios
        .get(`${config.backendUrl}/api/auth/verify`, { headers: { Authorization: `Bearer ${t}` } })
        .then(() => setToken(t))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return token
    ? <StudioBody token={token} onLogout={handleLogout} />
    : <Login onAuthed={setToken} />;
}
