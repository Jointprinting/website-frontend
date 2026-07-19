// src/screens/Studio.js
//
// Password-protected admin/studio page. Hub-based navigation — pick a tool
// from a card grid, enter it, click "Studio" to come back.
//
//   Joint Printing tools:
//     1) Submissions — mini-CRM for contact form leads
//     2) Mockup Lab — launches /jpstudio/ in a new tab
//   JP Webworks tools:
//     3) Websites — build/preview/publish client subscription sites (JpwSitesTab)
//     4) Inquiries — JP Webworks' OWN inbox (view 'jpwinquiries'): the same
//        SubmissionsTab component HARD-locked to webworks leads, with its own
//        unseen badge — fully separate from the Joint Printing Inquiries tile
//     5) Cold Call Tree + Lead Recon — kept, but collapsed under "On hold"

import * as React from 'react';
import axios from 'axios';
import {
  Box,
  Stack,
  TextField,
  MenuItem,
  Button,
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
  Snackbar,
  Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import InboxIcon from '@mui/icons-material/Inbox';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import config from '../config.json';
import { D, accentBar, eyebrow, mono, BRAND, money0, money, fmtDate } from './studio/_shared';
import BrandCube, { BRAND_MARKS, brandAccent } from '../common/BrandCube';
import { SOURCE_FILTERS, SOURCE_META, visibleSubmissions, submissionSource, countsBySource, effectiveSource, statusValuesFor } from './studio/_submissions';
import { StudioDialogHost, confirmDialog, alertDialog, promptDialog } from './studio/_dialog';
import { COLD_CALL_NODES } from './studio/coldCallTree';
import CatalogManagerTab from './studio/CatalogManagerTab';
import RoadTripTab from './studio/RoadTripTab';
import JpwReconTab from './studio/JpwReconTab';
import OrderTracker from './studio/OrderTracker';
import CrmTab from './studio/crm/CrmTab';
import OutreachTab from './studio/outreach/OutreachTab';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import BackupTab from './studio/BackupTab';
import FinancesTab from './studio/FinancesTab';
import LookbooksTab from './studio/LookbooksTab';
import NativeMockupLabHost from './studio/mockup/NativeMockupLabHost';
import LabErrorBoundary from './studio/mockup/LabErrorBoundary';
import ContentTab from './studio/ContentTab';
import NewsletterTab from './studio/NewsletterTab';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import VendorsTab from './studio/VendorsTab';
import AgentsAdminTab from './studio/AgentsAdminTab';
import AgentHome from './studio/agent/AgentHome';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import BackupIcon from '@mui/icons-material/Backup';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import JpLoader from '../common/JpLoader';
import PendingSyncBadge from '../common/PendingSyncBadge';
import { setAuthProvider, startAutoFlush } from '../common/offlineSync';

// JP Webworks Websites tool — lazy so the template registry + editor stay out
// of the Studio's main chunk until the owner actually opens the tool.
const JpwSitesTab = React.lazy(() => import('./studio/JpwSitesTab'));
// JP Webworks Client Manager — run the live sites (edits queue + health + spine link).
const WebworksOpsTab = React.lazy(() => import('./studio/WebworksOpsTab'));
// Mockup Lab v2 — the in-Studio surface (browse + render mockups natively, no new tab).
const MockupLab = React.lazy(() => import('./studio/mockup/MockupLab'));

const TOKEN_KEY = 'jpStudioToken';
// The signed-in account's role ('owner' | 'agent'), stored alongside the token so
// the Studio renders the right surface (agents get a trimmed view). The token is
// still the source of truth server-side; this is a display hint only.
const ROLE_KEY = 'jpStudioRole';

// Mirrors backend (controllers/auth.js) — display-only.
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;

// The UNION of every brand's lead lifecycle (labels + chip colors). Which subset
// an inbox actually offers comes from statusValuesFor(source) in _submissions.js
// (mirrors backend STATUSES_BY_SOURCE): merch quotes, webworks previews→live,
// atom demo→onboarding→live. statusMeta falls back to 'new' for unknowns.
const STATUS_OPTIONS = [
  { value: 'new',           label: 'New',           color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  { value: 'contacted',     label: 'Contacted',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { value: 'quoted',        label: 'Quoted',        color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  { value: 'preview-built', label: 'Preview built', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  { value: 'preview-sent',  label: 'Preview sent',  color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  { value: 'demo-booked',   label: 'Demo booked',   color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  { value: 'scoped',        label: 'Scoped',        color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  { value: 'onboarding',    label: 'Onboarding',    color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  { value: 'won',           label: 'Won',           color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  { value: 'live',          label: 'Live',          color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  { value: 'lost',          label: 'Lost',          color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  { value: 'churned',       label: 'Churned',       color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  { value: 'spam',          label: 'Spam',          color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
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
  const [user, setUser] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // Success state drives the unlock animation + fade-out. Once we have a token
  // we hold the user on the Login card for ~650ms so the lock can morph and
  // the card fade away, then call onAuthed to swap to StudioBody. Without
  // this the screen would hard-cut from password form → fully rendered hub.
  const [success, setSuccess] = React.useState(false);
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
      const res = await axios.post(`${config.backendUrl}/api/auth/studio-login`,
        { username: user.trim(), password: pw }); // blank username → the backend uses 'studio' (owner)
      if (res.data?.token) {
        localStorage.setItem(TOKEN_KEY, res.data.token);
        localStorage.setItem(ROLE_KEY, res.data.role || 'owner');
        setFailCount(0);
        setLockedMsg('');
        setSuccess(true);
        // Hold the user on the success animation long enough for the unlock
        // morph + 450ms card fade-out to play, then hand off to StudioBody
        // (which Fades + Grows in on its own). 500ms keeps the handoff right
        // at the edge of the exit animation so the gap between login and hub
        // is imperceptible against the shared dark background.
        setTimeout(() => onAuthed(res.data.token), 500);
        return;
      }
      setErr('Login failed.');
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
      <Fade in={!success} timeout={success ? 450 : 0} unmountOnExit>
      <Grow in={!success} timeout={success ? 450 : 500}>
        <Paper elevation={0} sx={{
          p: 4, borderRadius: 4, width: '100%', maxWidth: 420,
          bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`,
          position: 'relative', zIndex: 1,
          transition: 'transform 0.45s ease, box-shadow 0.45s ease',
          transform: success ? 'translateY(-6px)' : 'none',
          boxShadow: success ? '0 24px 60px -28px rgba(74,222,128,0.55)' : 'none',
        }}>
          <Stack spacing={1.5} alignItems="center" mb={3}>
            <Box sx={{
              bgcolor: success ? BRAND.green : BRAND.greenDk,
              color: success ? BRAND.greenDk : BRAND.green,
              width: 48, height: 48, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: success
                ? '0 0 0 10px rgba(74,222,128,0.15)'
                : '0 0 0 5px rgba(74,222,128,0.07)',
              transition: 'all 0.35s ease',
              transform: success ? 'rotate(-8deg) scale(1.05)' : 'none',
            }}>
              {success
                ? <LockOpenIcon sx={{ fontSize: 22 }} />
                : <LockIcon sx={{ fontSize: 22 }} />}
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
                type="text"
                label="Username"
                placeholder="studio"
                autoComplete="username"
                value={user}
                onChange={(e) => { setUser(e.target.value); if (err) setErr(''); }}
                disabled={!!lockedMsg}
                fullWidth size="medium"
                sx={darkInputSx}
              />
              <TextField
                type={show ? 'text' : 'password'}
                label="Password"
                autoComplete="current-password"
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
                disabled={busy || !!lockedMsg || success} fullWidth
                sx={{
                  borderRadius: 2, fontWeight: 800, textTransform: 'none', py: 1.4,
                  bgcolor: BRAND.green, color: BRAND.greenDk,
                  '&:hover': { bgcolor: '#22c55e', transform: 'translateY(-1px)' },
                  '&:disabled': { bgcolor: success ? BRAND.green : 'rgba(74,222,128,0.4)',
                                  color: success ? BRAND.greenDk : undefined,
                                  opacity: success ? 1 : undefined },
                  transition: 'all 0.15s',
                }}
              >
                {success ? 'Welcome back' : busy ? <CircularProgress size={22} sx={{ color: BRAND.greenDk }} /> : 'Sign in'}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Grow>
      </Fade>
    </Box>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
//  Submissions tab (mini-CRM)
// ─────────────────────────────────────────────────────────────────────────────
// Source vocabulary (SOURCE_FILTERS / matchesSource / visibleSubmissions) lives
// in ./studio/_submissions — extracted so the slice logic is unit-tested.
//
// `lockedSource` HARD-scopes the inbox to one lead pipe: the JP Webworks
// Inquiries view (Studio view 'jpwinquiries') renders this same component with
// lockedSource="webworks", so it shows ONLY /webworks/start leads, hides the
// source chips, and reads as the Webworks inbox. Unset → the full Joint
// Printing inbox with the source filter chips.
function SubmissionsTab({ token, onOpenClients, lockedSource }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [sourceFilter, setSourceFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(null);
  const [projectCreated, setProjectCreated] = React.useState(null); // { projectNumber } for the success toast
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [startingProject, setStartingProject] = React.useState(false);

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
      await alertDialog({ title: 'Could not update', message: e?.response?.data?.message || e.message });
    }
  };

  const removeSubmission = async (id) => {
    if (!(await confirmDialog({ message: 'Delete this submission permanently? This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await axios.delete(`${config.backendUrl}/api/submissions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((arr) => arr.filter((it) => it._id !== id));
      setDialogOpen(false);
    } catch (e) {
      await alertDialog({ title: 'Could not delete', message: e?.response?.data?.message || e.message });
    }
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch { return iso; }
  };

  // Source filter applies first (a lockedSource always wins); the status pills
  // then count within that slice so the numbers always agree with the rows on
  // screen.
  const visible = React.useMemo(
    () => visibleSubmissions(items, { sourceFilter, lockedSource }),
    [items, sourceFilter, lockedSource]
  );

  // One pass over every source (incl. atom, which the old hand-written map
  // dropped so the JP Atom chip always read 0).
  const sourceCounts = React.useMemo(() => countsBySource(items), [items]);

  // Each brand's inbox shows ITS pipeline's pills (merch quotes, webworks
  // previews→live, atom demo→onboarding→live); the mixed 'all' view shows the
  // union. Values come from _submissions.js (mirrors the backend).
  const statusOpts = React.useMemo(() => {
    const allowed = statusValuesFor(effectiveSource(sourceFilter, lockedSource));
    return STATUS_OPTIONS.filter((s) => allowed.includes(s.value));
  }, [sourceFilter, lockedSource]);

  // Switching brand slice can strand an active pill on a status the new
  // pipeline doesn't have (e.g. 'quoted' → the webworks inbox) — fall back to
  // All so the list never silently filters on an invisible status.
  React.useEffect(() => {
    if (statusFilter !== 'all' && !statusOpts.some((s) => s.value === statusFilter)) {
      setStatusFilter('all');
    }
  }, [statusOpts, statusFilter]);

  const statusCounts = React.useMemo(() => {
    const counts = { all: visible.length };
    statusOpts.forEach((s) => { counts[s.value] = 0; });
    visible.forEach((it) => { counts[it.status || 'new'] = (counts[it.status || 'new'] || 0) + 1; });
    return counts;
  }, [visible, statusOpts]);

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      <MuiTypography variant="body2" sx={{ color: BRAND.muted, mb: 2.5 }}>
        {lockedSource === 'webworks'
          ? <>Every website lead from /webworks/start lands here — its own inbox,
              separate from the Joint Printing contact-form leads. Click a row for
              details, update as you work.</>
          : lockedSource === 'atom'
          ? <>Every JP Atom lead from /atom/contact lands here — its own inbox with
              what they run on today, monthly volume, and what they want handled
              first. Click a row for details, update as you reach out.</>
          : <>Every contact form submission is saved here so you don&apos;t lose a lead even
              if email hiccups. Filter, click any row for details, update as you work.</>}
      </MuiTypography>

      {/* Source row — which business the lead belongs to. Webworks leads keep
          their green chip on the row; this just slices the inbox. Hidden when
          the view is hard-locked to one source (the JP Webworks inbox). */}
      {!lockedSource && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.25 }}>
          {SOURCE_FILTERS.map((s) => (
            <FilterPill
              key={s.value}
              active={sourceFilter === s.value} label={s.label} count={sourceCounts[s.value] || 0}
              onClick={() => setSourceFilter(s.value)}
              color={SOURCE_META[s.value]?.chip || BRAND.green}
            />
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
        <FilterPill
          active={statusFilter === 'all'} label="All" count={statusCounts.all}
          onClick={() => setStatusFilter('all')} color={BRAND.green}
        />
        {statusOpts.map((s) => (
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
          <JpLoader size={56} label="Loading inquiries…" />
        </Box>
      ) : visible.length === 0 ? (
        <Fade in>
          <Box py={8} textAlign="center">
            <InboxIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.18)', mb: 2 }} />
            <MuiTypography sx={{ color: BRAND.muted }}>
              {lockedSource === 'atom'
                ? (statusFilter === 'all' ? 'No JP Atom inquiries yet.' : `No "${statusMeta(statusFilter).label}" inquiries.`)
                : lockedSource === 'webworks'
                ? (statusFilter === 'all' ? 'No JP Webworks inquiries yet.' : `No "${statusMeta(statusFilter).label}" inquiries.`)
                : sourceFilter !== 'all' && items.length > 0
                ? `No ${SOURCE_FILTERS.find((s) => s.value === sourceFilter)?.label} submissions here.`
                : statusFilter === 'all' ? 'No submissions yet.' : `No "${statusMeta(statusFilter).label}" submissions.`}
            </MuiTypography>
            <MuiTypography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
              {lockedSource === 'webworks'
                ? <>They&apos;ll appear here as soon as someone finishes /webworks/start.</>
                : lockedSource === 'atom'
                ? <>They&apos;ll appear here as soon as someone finishes /atom/contact.</>
                : <>They&apos;ll appear here as soon as someone fills out your contact form.</>}
            </MuiTypography>
          </Box>
        </Fade>
      ) : (
        <Stack spacing={1.2}>
          {visible.map((it, idx) => (
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
            {selected && SOURCE_META[submissionSource(selected)]?.badge && (
              <Chip label={`${SOURCE_META[submissionSource(selected)].label} lead`} size="small" sx={{
                mt: 0.6, height: 20, fontSize: 11, fontWeight: 700,
                bgcolor: SOURCE_META[submissionSource(selected)].bg,
                color: SOURCE_META[submissionSource(selected)].color,
              }} />
            )}
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
                    {/* This lead's OWN brand pipeline (merch / webworks / atom);
                        a legacy status outside it stays selectable so an old
                        row never renders an out-of-range Select. */}
                    {STATUS_OPTIONS.filter((s) =>
                      statusValuesFor(submissionSource(selected)).includes(s.value)
                      || s.value === (selected.status || 'new')
                    ).map((s) => (
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
                {selected.source === 'webworks' ? (
                  <>
                    <Detail label="Business / trade">{selected.webworks?.businessType || '-'}</Detail>
                    <Detail label="Plan interest">{selected.webworks?.planInterest || '-'}</Detail>
                    <Detail label="Current site">{selected.webworks?.currentWebsite || '-'}</Detail>
                    <Detail label="Service area">{selected.webworks?.serviceArea || '-'}</Detail>
                  </>
                ) : selected.source === 'atom' ? (
                  <>
                    <Detail label="Runs the shop on">{selected.atom?.runsOn || '-'}</Detail>
                    <Detail label="Orders / month">{selected.atom?.monthlyVolume || '-'}</Detail>
                    <Detail label="Wants handled first">{selected.atom?.interests || '-'}</Detail>
                  </>
                ) : (
                  <>
                    <Detail label="Quantity per item">{selected.quantity || '-'}</Detail>
                    <Detail label="In-hand date">{selected.inHandDate || '-'}</Detail>
                  </>
                )}
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
                    <MuiTypography variant="caption" sx={{ color: BRAND.muted }}>Client notes</MuiTypography>
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
                  onBlur={() => {
                    // Only fire if the note actually changed since the last
                    // server load — blur on focus without typing was firing
                    // a redundant PUT every time.
                    const original = items.find((x) => x._id === selected._id);
                    if ((original?.notesAdmin || '') !== (selected.notesAdmin || '')) {
                      updateStatus(selected._id, undefined, selected.notesAdmin || '');
                    }
                  }}
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
          <Box sx={{ flex: 1 }} />
          {selected?.orderId ? (
            <Chip size="small" label={`Linked to project`} sx={{ bgcolor: 'rgba(74,222,128,0.14)', color: BRAND.green, fontWeight: 700, fontSize: 11 }} />
          ) : (
            <Button
              onClick={async () => {
                if (!selected) return;
                setStartingProject(true);
                try {
                  const res = await axios.post(
                    `${config.backendUrl}/api/orders/from-submission/${selected._id}`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } },
                  );
                  const orderId = res.data?.order?._id;
                  setItems((arr) => arr.map((it) =>
                    it._id === selected._id ? { ...it, orderId, status: 'quoted' } : it,
                  ));
                  setSelected((s) => s ? { ...s, orderId, status: 'quoted' } : s);
                  setProjectCreated({ projectNumber: res.data?.order?.projectNumber || '?' });
                } catch (e) {
                  await alertDialog({ title: 'Could not start project', message: e?.response?.data?.message || e.message });
                } finally {
                  setStartingProject(false);
                }
              }}
              disabled={startingProject}
              startIcon={startingProject ? <CircularProgress size={14} sx={{ color: BRAND.greenDk }} /> : null}
              variant="contained"
              sx={{ bgcolor: BRAND.green, color: BRAND.greenDk, fontWeight: 700, textTransform: 'none',
                '&:hover': { bgcolor: '#3bd070' } }}
            >
              Start project from inquiry
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Post-create success: cleaner replacement for the old alert() — gives
          the user a one-click jump to the Order Tracker instead of asking
          them to navigate manually. */}
      <Snackbar
        open={!!projectCreated}
        autoHideDuration={8000}
        onClose={() => setProjectCreated(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setProjectCreated(null)}
          action={onOpenClients ? (
            <Button color="inherit" size="small"
              onClick={() => { onOpenClients(); setProjectCreated(null); }}
              sx={{ fontWeight: 700 }}>
              Open Order Tracker →
            </Button>
          ) : null}
          sx={{ alignItems: 'center' }}
        >
          Project #{projectCreated?.projectNumber} created from this inquiry.
        </Alert>
      </Snackbar>
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
        '&:focus-visible': { outline: `2px solid ${color}`, outlineOffset: 2 },
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
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
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
        '&:focus-visible': { outline: `2px solid ${BRAND.green}`, outlineOffset: 2 },
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
            {SOURCE_META[submissionSource(item)]?.badge && (
              <Chip label={SOURCE_META[submissionSource(item)].label} size="small" sx={{
                height: 18, fontSize: 10, fontWeight: 700,
                bgcolor: SOURCE_META[submissionSource(item)].bg,
                color: SOURCE_META[submissionSource(item)].color,
              }} />
            )}
          </Stack>
          <MuiTypography variant="body2" sx={{
            color: BRAND.muted, fontFamily: 'monospace', fontSize: 12.5,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.source === 'webworks'
              ? `${item.email}${item.phone ? ' · ' + item.phone : ''}${item.webworks?.planInterest ? ' · ' + item.webworks.planInterest : ''}`
              : item.source === 'atom'
              ? `${item.email}${item.phone ? ' · ' + item.phone : ''}`
              : `${item.email} · ${item.phone} · qty ${item.quantity || '?'} · in-hand ${item.inHandDate || '?'}`}
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
// COLD_CALL_NODES (the 50+ node script tree) lives in ./studio/coldCallTree.js
// — data only, imported above, so this shell stays navigable.

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
                  onClick={async () => {
                    if (await confirmDialog({ message: 'Reset this back to the default script?', confirmLabel: 'Reset', danger: true })) onResetOverride();
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

const CC_API = `${config.backendUrl}/api/jpw/cold-call-state`;

// Backend-persisted Cold Call state. localStorage is now only used as a
// migration source (one-shot push to backend on first load when the backend
// is empty but local has something) and as an offline draft for notes/overrides
// so a stuck network can't wipe an in-flight edit.
// Cold-call tree navigation. The previous flat-playbook revision was
// rejected as "absolutely terrible" — too much surface, hard to find the
// right response mid-call. Back to the tree, with three deliberate
// improvements over the original:
//
//   1. Sticky breadcrumb at the top showing the full path so far (Open the
//      line → Opener → Pain dig). Always visible, click any crumb to jump
//      back. Tells the user where they are AND where they've been without
//      re-reading the call.
//   2. Back / Restart pinned right next to the breadcrumb, not buried at
//      the bottom of the card. Reachable mid-call without scrolling.
//   3. Script text rendered larger and tighter line-height so the line
//      you're reading aloud is the unmistakable focal point of the page.
//
// Quick rebuttals are removed entirely per user feedback (hard to scan
// mid-call). They still live in the data file at the bottom of this file
// if we want to bring them back as a toggleable side panel later.
const CC_HISTORY_MAX = 50;

function ColdCallTab({ token }) {
  const [biz, setBiz] = React.useState('');
  const [svc, setSvc] = React.useState('');
  const [name, setName] = React.useState('');
  const [history, setHistory] = React.useState(['start']);
  const [notes, setNotes] = React.useState('');
  const [savedAt, setSavedAt] = React.useState('');
  const [storageWarning, setStorageWarning] = React.useState('');
  const [overrides, setOverrides] = React.useState({});
  const hydrated = React.useRef(false);    // suppresses the save effects on the initial load

  const _lsGet = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  };

  // Load from backend. If backend is empty but localStorage has something,
  // push the local state up so the existing edits/notes aren't lost on
  // first deploy.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const authHdr = { headers: { Authorization: `Bearer ${token}` } };
      let server = null;
      try {
        const r = await axios.get(CC_API, authHdr);
        server = r.data || {};
      } catch (e) {
        setStorageWarning('Could not reach the server — working from local cache.');
      }
      if (cancelled) return;

      const localBiz   = _lsGet('jpw_cc_biz', '');
      const localSvc   = _lsGet('jpw_cc_svc', '');
      const localName  = _lsGet('jpw_cc_name', '');
      const localNotes = _lsGet('jpw_cc_notes', '');
      let localOverrides = {};
      try {
        const raw = _lsGet('jpw_cc_overrides', '{}');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const data = parsed._v ? (parsed.data || {}) : parsed;
          Object.keys(data).forEach(k => {
            if (typeof k === 'string' && k.includes('::') && typeof data[k] === 'string') localOverrides[k] = data[k];
          });
        }
      } catch (_) {}

      // Pick whichever side has data. If backend is empty and local has
      // anything, migrate local → backend in one PUT.
      const serverEmpty = !server || (!server.biz && !server.svc && !server.name && !server.notes &&
        (!server.overrides || Object.keys(server.overrides).length === 0));
      const hasLocal = !!(localBiz || localSvc || localName || localNotes || Object.keys(localOverrides).length);

      if (serverEmpty && hasLocal) {
        try {
          await axios.put(CC_API, {
            biz: localBiz, svc: localSvc, name: localName,
            notes: localNotes, overrides: localOverrides,
          }, authHdr);
          server = { biz: localBiz, svc: localSvc, name: localName, notes: localNotes, overrides: localOverrides };
        } catch (e) {
          setStorageWarning('Migration to cloud failed — keeping local edits for now.');
        }
      }

      setBiz(server?.biz || '');
      setSvc(server?.svc || '');
      setName(server?.name || '');
      setNotes(server?.notes || '');
      setOverrides((server && server.overrides) || {});

      // One-shot handoff from the JPW Lead Recon tab — overrides what the
      // server gave us for the three setup fields.
      try {
        const handoff = sessionStorage.getItem('jpwColdCallContext');
        if (handoff) {
          const ctx = JSON.parse(handoff);
          if (ctx && typeof ctx === 'object') {
            if (typeof ctx.biz  === 'string') setBiz(ctx.biz);
            if (typeof ctx.svc  === 'string') setSvc(ctx.svc);
            if (typeof ctx.name === 'string') setName(ctx.name);
          }
          sessionStorage.removeItem('jpwColdCallContext');
        }
      } catch (e) { /* malformed handoff — skip */ }

      hydrated.current = true;
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Debounced save helper — single PATCH-like PUT with the changed bag of fields.
  const _saveDebounced = React.useCallback((patch) => {
    if (!hydrated.current) return undefined;
    const t = setTimeout(async () => {
      try {
        await axios.put(CC_API, patch, { headers: { Authorization: `Bearer ${token}` } });
        setStorageWarning('');
        setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (e) {
        setStorageWarning(`Save failed — ${e.response?.data?.message || e.message}`);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [token]);

  React.useEffect(() => _saveDebounced({ biz }),       [biz, _saveDebounced]);
  React.useEffect(() => _saveDebounced({ svc }),       [svc, _saveDebounced]);
  React.useEffect(() => _saveDebounced({ name }),      [name, _saveDebounced]);
  React.useEffect(() => _saveDebounced({ overrides }), [overrides, _saveDebounced]);

  // Notes save through the same debounced PUT path as the other fields.
  React.useEffect(() => _saveDebounced({ notes }), [notes, _saveDebounced]);

  const fill = React.useCallback((text) => {
    return text
      .replace(/\{\{biz\}\}/g, biz.trim() || '[Business Name]')
      .replace(/\{\{svc\}\}/g, svc.trim() || '[service]')
      .replace(/\{\{name\}\}/g, name.trim() || '[name]');
  }, [biz, svc, name]);

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

  const overrideFor = (nodeId, field) => overrides[`${nodeId}::${field}`];

  const currentId = history[history.length - 1];
  const node = COLD_CALL_NODES[currentId] || COLD_CALL_NODES.start;

  // Cap history at CC_HISTORY_MAX so a marathon call session can't grow the
  // array unbounded; oldest crumbs roll off the front.
  const goTo = (id) => {
    if (!COLD_CALL_NODES[id]) { console.warn(`[ColdCall] unknown node id: ${id}`); return; }
    setHistory((h) => {
      const next = [...h, id];
      return next.length > CC_HISTORY_MAX ? next.slice(-CC_HISTORY_MAX) : next;
    });
  };
  // Jump directly to a node already in our path — used by breadcrumb clicks.
  // Truncates history so the future re-routes from there if the user picks a
  // different fork the second time through.
  const jumpToIndex = (idx) => {
    if (idx < 0 || idx >= history.length - 1) return;
    setHistory((h) => h.slice(0, idx + 1));
  };
  const goBack = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const restart = () => setHistory(['start']);

  const isEnd = !!node.end;
  const endColor = node.end === 'success' ? '#4ade80'
    : node.end === 'warning' ? '#fbbf24'
    : 'rgba(255,255,255,0.85)';
  const endBg = node.end === 'success' ? 'rgba(74,222,128,0.06)'
    : node.end === 'warning' ? 'rgba(251,191,36,0.06)'
    : 'rgba(255,255,255,0.025)';
  const endBorder = node.end === 'success' ? 'rgba(74,222,128,0.3)'
    : node.end === 'warning' ? 'rgba(251,191,36,0.3)'
    : BRAND.faint;
  const ov = (field) => overrideFor(currentId, field);

  return (
    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      <MuiTypography variant="body2" sx={{ color: BRAND.muted, mb: 2.5 }}>
        Decision-tree call script. Fill the owner's first name, business name,
        and service at the top — every line autofills as you go. Click any
        crumb in the breadcrumb to jump back, or "Restart" to start the call
        over. Edits to any script save to the cloud and follow you across
        devices.
      </MuiTypography>

      {storageWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>{storageWarning}</Alert>
      )}

      {/* Setup inputs */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField label="Owner first name" placeholder="Mike"
          value={name} onChange={(e) => setName(e.target.value)}
          fullWidth size="small" sx={darkInputSx} />
        <TextField label="Business name" placeholder="ABC Plumbing"
          value={biz} onChange={(e) => setBiz(e.target.value)}
          fullWidth size="small" sx={darkInputSx} />
        <TextField label="Service type" placeholder="plumbing"
          value={svc} onChange={(e) => setSvc(e.target.value)}
          fullWidth size="small" sx={darkInputSx} />
      </Stack>

      {/* STICKY nav bar — breadcrumb + back + restart. Pinned at the top of
          the scroll so mid-call you can jump back without losing the screen.
          Breadcrumb chips are clickable; clicking the 3rd of 5 truncates the
          path so re-routing from there forward is honest. */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 4,
        bgcolor: BRAND.bg,
        py: 1.25, mb: 2.5, mx: { xs: -2.5, sm: -4 }, px: { xs: 2.5, sm: 4 },
        borderBottom: `1px solid ${BRAND.faint}`,
      }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Button
            onClick={goBack}
            disabled={history.length <= 1}
            startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />}
            size="small"
            sx={{
              textTransform: 'none', color: BRAND.muted, fontWeight: 600, fontSize: 12,
              minWidth: 'auto', px: 1,
              '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
              '&:disabled': { color: 'rgba(255,255,255,0.2)' },
            }}
          >Back</Button>
          <Button
            onClick={restart}
            disabled={history.length === 1}
            startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
            size="small"
            sx={{
              textTransform: 'none', color: BRAND.muted, fontWeight: 600, fontSize: 12,
              minWidth: 'auto', px: 1,
              '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
              '&:disabled': { color: 'rgba(255,255,255,0.2)' },
            }}
          >Restart</Button>
          <Box sx={{ width: 1, height: 18, bgcolor: BRAND.faint, mx: 0.5 }} />
          {/* Breadcrumb — full path so far. Each crumb clickable. */}
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexWrap: 'wrap', flex: 1 }}>
            {history.map((id, i) => {
              const n = COLD_CALL_NODES[id];
              const isCurrent = i === history.length - 1;
              return (
                <React.Fragment key={`${id}-${i}`}>
                  <Box
                    onClick={isCurrent ? undefined : () => jumpToIndex(i)}
                    role={isCurrent ? undefined : 'button'}
                    tabIndex={isCurrent ? undefined : 0}
                    onKeyDown={isCurrent ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToIndex(i); } }}
                    sx={{
                      fontSize: 11.5, fontWeight: isCurrent ? 800 : 600,
                      color: isCurrent ? BRAND.green : BRAND.muted,
                      cursor: isCurrent ? 'default' : 'pointer',
                      px: 0.75, py: { xs: 0.7, md: 0.3 }, borderRadius: 1,
                      minHeight: { xs: 34, md: 'auto' }, display: 'inline-flex', alignItems: 'center',
                      bgcolor: isCurrent ? 'rgba(74,222,128,0.10)' : 'transparent',
                      transition: 'color 0.15s ease, background 0.15s ease',
                      '&:hover': isCurrent ? {} : { color: BRAND.white, bgcolor: 'rgba(255,255,255,0.04)' },
                      '&:focus-visible': isCurrent ? {} : { outline: `2px solid ${BRAND.green}`, outlineOffset: 1 },
                    }}
                  >
                    {(n && n.stage) || id}
                  </Box>
                  {!isCurrent && (
                    <Box component="span" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, lineHeight: 1 }}>›</Box>
                  )}
                </React.Fragment>
              );
            })}
          </Stack>
        </Stack>
      </Box>

      {/* Script card — the focal point of the call. Bigger script text + a
          quieter "direction" coach block beneath. End-state nodes (voicemail,
          callback, win) get a colored tint so they read distinct from
          mid-call scripts. */}
      <Fade in key={currentId} timeout={220}>
        <Box>
          <Paper elevation={0} sx={{
            bgcolor: endBg,
            border: `1px solid ${endBorder}`,
            borderRadius: 3,
            p: { xs: 2.5, sm: 3.5 },
            mb: 2.5,
          }}>
            <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isEnd ? endColor : BRAND.green }} />
              <MuiTypography sx={{
                color: isEnd ? endColor : BRAND.green,
                fontWeight: 800, fontSize: 11.5,
                textTransform: 'uppercase', letterSpacing: 1.4,
              }}>
                {node.stage}
              </MuiTypography>
              {isEnd && node.badge && (
                <Chip label={node.badge} size="small" sx={{
                  bgcolor: endColor, color: '#0c1410', fontWeight: 800,
                  borderRadius: 999, ml: 0.5, height: 20, fontSize: 10,
                }} />
              )}
            </Stack>

            {/* Script — the thing you read out loud. Bigger + tighter
                line-height for readability mid-call. */}
            <Box sx={{
              '& .MuiTypography-body1': { fontSize: { xs: 15.5, sm: 16.5 }, lineHeight: 1.55 },
            }}>
              <EditableScript
                nodeId={currentId} field="script" defaultLines={node.script}
                fill={fill}
                sx={{ color: isEnd ? endColor : BRAND.white }}
                override={ov('script')}
                onSaveOverride={(t) => handleSaveOverride(currentId, 'script', t)}
                onResetOverride={() => handleResetOverride(currentId, 'script')}
              />
            </Box>

            {node.followUp && (
              <Box sx={{ mt: 1.75 }}>
                <MuiTypography variant="overline" sx={{
                  color: BRAND.muted, fontWeight: 700, letterSpacing: 1, display: 'block', fontSize: 10, mb: 0.4,
                }}>
                  Follow-up question
                </MuiTypography>
                <Box sx={{ '& .MuiTypography-body1': { fontSize: { xs: 14.5, sm: 15.5 }, lineHeight: 1.55 } }}>
                  <EditableScript
                    nodeId={currentId} field="followUp" defaultLines={node.followUp}
                    fill={fill}
                    sx={{ color: BRAND.white }}
                    override={ov('followUp')}
                    onSaveOverride={(t) => handleSaveOverride(currentId, 'followUp', t)}
                    onResetOverride={() => handleResetOverride(currentId, 'followUp')}
                  />
                </Box>
              </Box>
            )}

            {node.voicemail && (
              <Box sx={{
                mt: 2, p: 1.75, borderRadius: 1.75,
                bgcolor: 'rgba(96,165,250,0.08)',
                border: '1px solid rgba(96,165,250,0.25)',
              }}>
                <MuiTypography variant="overline" sx={{
                  color: '#60a5fa', fontWeight: 700, letterSpacing: 1.1, display: 'block', mb: 0.5, fontSize: 10,
                }}>
                  Voicemail script
                </MuiTypography>
                <EditableScript
                  nodeId={currentId} field="voicemail" defaultLines={node.voicemail}
                  fill={fill}
                  sx={{ color: 'rgba(255,255,255,0.85)' }}
                  override={ov('voicemail')}
                  onSaveOverride={(t) => handleSaveOverride(currentId, 'voicemail', t)}
                  onResetOverride={() => handleResetOverride(currentId, 'voicemail')}
                />
              </Box>
            )}

            {node.direction && (
              <Box sx={{
                mt: 1.75, p: 1.5, borderRadius: 1.5,
                bgcolor: 'rgba(255,255,255,0.03)',
                borderLeft: `2px solid ${BRAND.green}`,
                fontStyle: 'italic',
              }}>
                <MuiTypography variant="overline" sx={{
                  color: BRAND.muted, fontWeight: 700, letterSpacing: 1, display: 'block', fontSize: 10, mb: 0.3,
                  fontStyle: 'normal',
                }}>
                  Coach
                </MuiTypography>
                <EditableScript
                  nodeId={currentId} field="direction" defaultLines={node.direction}
                  sx={{ color: BRAND.muted }}
                  override={ov('direction')}
                  onSaveOverride={(t) => handleSaveOverride(currentId, 'direction', t)}
                  onResetOverride={() => handleResetOverride(currentId, 'direction')}
                />
              </Box>
            )}
          </Paper>

          {/* Response buttons — what they said next */}
          {node.next && node.next.length > 0 && (
            <>
              <MuiTypography variant="caption" sx={{
                color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 1.3,
                fontWeight: 700, display: 'block', mb: 1, fontSize: 10.5,
              }}>
                They said:
              </MuiTypography>
              <Stack spacing={0.9} sx={{ mb: 4 }}>
                {node.next.map((opt, i) => (
                  <Button
                    key={`${currentId}-${i}`}
                    onClick={() => goTo(opt.to)}
                    variant="outlined"
                    sx={{
                      justifyContent: 'space-between',
                      textTransform: 'none', fontWeight: 600, fontSize: 14.5,
                      color: BRAND.white,
                      borderColor: 'rgba(255,255,255,0.14)',
                      bgcolor: 'rgba(255,255,255,0.025)',
                      borderRadius: 2,
                      py: 1.2, px: 1.85,
                      transition: 'all 0.13s',
                      '&:hover': {
                        borderColor: BRAND.green,
                        bgcolor: 'rgba(74,222,128,0.07)',
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

      {/* Notes — running scratchpad. Persists to the cloud through the same
          CC_API save path as setup + overrides. */}
      <Box sx={{ mt: 2 }}>
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
//  Hub — picks which tool to enter, organized by REAL daily importance
// ─────────────────────────────────────────────────────────────────────────────
// The owner found the flat 9-card grid overwhelming. So the live tools are split
// into three tiers and the hub renders each at a different volume:
//   • primary   — the daily core, big bold cards: the CRM (clients, leads, and
//                 today's calls — ONE tile) and the Order Tracker (the pipeline).
//   • secondary — used often but not first: Finances, Mockups, Lookbooks,
//                 Inquiries, Catalogs. Normal-size cards.
//   • tucked    — reach-for-occasionally, small & quiet: Printers · Vendors
//                 (now a lightweight directory, no longer a heavy headline tab)
//                 and Backup.
// `target` is the StudioBody view to open; `view` lets a tile deep-link into a
// tool's internal view (the CRM tile opens it at the Clients tab; Today sits
// right beside it inside the CRM). Every destination stays reachable.
const HUB_GROUPS = [
  {
    brand: 'Joint Printing',
    tagline: 'Run the shop',
    tiers: [
      {
        id: 'primary',
        tools: [
          // ONE CRM tile (owner: "only need one CRM"). The CRM opens to Clients
          // with Today as a tab right beside it, so a separate "Today" tile was
          // redundant — it's gone. This single tile is the whole CRM.
          { id: 'crm',      label: 'CRM',           desc: 'Clients, leads, today’s calls',      Icon: ContactPhoneOutlinedIcon,  target: 'crm', view: 'companies' },
          { id: 'clients',  label: 'Order Tracker', desc: 'Projects, quotes, invoices, status', Icon: PeopleOutlineIcon },
        ],
      },
      {
        // Marketing / lead-gen tools — grouped so the two ways Nate fills the
        // funnel (in-person sweeps + cold email) sit together, and so "More
        // tools" stays a clean even row instead of wrapping one card onto its own.
        id: 'growth',
        label: 'Marketing · find leads',
        tools: [
          { id: 'roadtrip',   label: 'Field Map',  desc: 'Plan in-person sweeps',       Icon: ExploreOutlinedIcon },
          { id: 'outreach',   label: 'Outreach',   desc: 'Cold email → warm leads',     Icon: ForwardToInboxOutlinedIcon },
          { id: 'content',    label: 'Content',    desc: 'Social posts — plan & track', Icon: CampaignOutlinedIcon },
          // Client email blast — monthly updates & catalog drops to existing
          // clients, sent from the dedicated jointprintingshop domain so a warm
          // mass-send never dents the main invoice inbox's deliverability.
          { id: 'newsletter', label: 'Newsletter', desc: 'Email clients — opens & replies', Icon: MarkEmailReadOutlinedIcon },
        ],
      },
      {
        id: 'secondary',
        label: 'More tools',
        tools: [
          // Finances lifted to the cross-brand "All business" strip (money spans
          // every business, not just Joint Printing) — see CROSS_BRAND_TOOLS.
          { id: 'mockup',      label: 'Mockup Lab',   desc: 'Build mockups, export PDFs',   Icon: DesignServicesIcon },
          // Lookbooks sit right beside the Mockup Lab: the library feeds
          // the pages, the share link feeds the client, feedback feeds Signals.
          { id: 'lookbooks',   label: 'Lookbooks',    desc: 'Shareable client galleries',    Icon: AutoStoriesOutlinedIcon },
          { id: 'submissions', label: 'Inquiries',    desc: 'Contact-form leads',            Icon: InboxIcon },
          { id: 'catalogs',    label: 'Catalogs',     desc: 'Curated picks, featured items', Icon: MenuBookOutlinedIcon },
        ],
      },
      {
        id: 'tucked',
        label: 'Maintenance',
        tools: [
          { id: 'vendors', label: 'Printers', desc: 'Each printer: contact, POs, spend + price book',  Icon: LocalShippingOutlinedIcon },
          // Backup lifted to the cross-brand "All business" strip (it snapshots the
          // whole system's data across every business) — see CROSS_BRAND_TOOLS.
          // Owner-only: onboard sales agents, set goals, watch access. Gated by
          // `ownerOnly` so it never renders for an agent (they get a separate
          // shell entirely, but this keeps the hub honest either way).
          { id: 'admin',   label: 'Team',   desc: 'Agents, goals, access', Icon: ManageAccountsOutlinedIcon, ownerOnly: true },
        ],
      },
    ],
  },
  {
    brand: 'JP Webworks',
    // ACTIVE again — the website-subscription business now has a real product
    // surface (Websites: build → free preview → paid domain). The cold-call
    // tools stay dismissed: they live in `held`, which renders as a muted,
    // collapsed-by-default "On hold" sub-list under this group (the same
    // presentation the old paused group used, scoped to just those two).
    tagline: 'Websites on subscription',
    tiers: [
      {
        id: 'jpw',
        tools: [
          { id: 'jpwsites', label: 'Websites', desc: 'Build & preview client sites', Icon: LanguageOutlinedIcon },
          { id: 'webworksops', label: 'Client Manager', desc: 'Sites, edits & health', Icon: LanguageOutlinedIcon },
          // JP Webworks' OWN inbox — its own view id (no target redirect), so
          // it's fully separate from the Joint Printing Inquiries tile: the
          // SubmissionsTab renders hard-locked to webworks leads, and the tile
          // carries its own webworks-scoped unseen badge (see StudioBody).
          { id: 'jpwinquiries', label: 'Inquiries', desc: 'Leads from /webworks/start', Icon: InboxIcon },
        ],
      },
    ],
    held: {
      tools: [
        { id: 'coldcall', label: 'Cold Call Tree', desc: 'On-the-fly call script',   Icon: PhoneInTalkIcon, held: true },
        { id: 'jpwrecon', label: 'Lead Recon',     desc: 'Daily lead sweep + queue', Icon: TrackChangesOutlinedIcon, held: true },
      ],
    },
  },
  {
    // Brand-new venture: a premium studio that builds bespoke business operating
    // systems for other companies — this very Studio is the demo and the
    // jumping-off skeleton. Named "JP Atom" (owner's pick; stays in the JP family
    // since first invoices carry JP branding). No live tools yet, so instead of
    // empty tiles the group shows a `foundation` panel: what it is + the concrete
    // roadmap. Real tools (Prospects, Demo, Builds) slot into a tier here the
    // moment they exist — the switcher + section are already wired.
    brand: 'JP Atom',
    tagline: 'Bespoke business systems',
    tiers: [
      {
        id: 'atom',
        tools: [
          // JP Atom's OWN inbox — /atom/contact leads, hard-locked to
          // source:'atom' exactly like the JP Webworks Inquiries tile.
          { id: 'atominquiries', label: 'Inquiries', desc: 'Leads from /atom/contact', Icon: InboxIcon },
        ],
      },
    ],
  },
];

// All tools in a group: flattened across its tiers, plus any held ("on hold")
// sub-list — held tools still need header labels/brand when opened.
const groupTools = (g) => [
  ...(g.tiers ? g.tiers.flatMap((t) => t.tools) : (g.tools || [])),
  ...((g.held && g.held.tools) || []),
];

// Cross-brand tools — they belong to no single business, so they ride a
// persistent "All business" strip at the top of EVERY brand's hub instead of
// living inside Joint Printing's tiles: the money (one ledger across all three
// brands) and the data backup (snapshots the whole system). Reachable no matter
// which business is in focus.
const CROSS_BRAND_TOOLS = [
  { id: 'finances', label: 'Finances', desc: 'P&L across all brands',      Icon: PaidOutlinedIcon },
  { id: 'backup',   label: 'Backup',   desc: 'Snapshot the whole system',  Icon: BackupIcon,     ownerOnly: true },
];

// Flat list of all tools, with brand attached, for header lookups. De-dupes by
// the StudioBody view id (`target` || `id`) so the two CRM entry points (Today /
// Clients) resolve to a single header label without colliding. The CANONICAL
// tile (whose own id IS the view id — e.g. the "Clients" tile, id 'crm') wins the
// label, even if a deep-link alias (the 'today' tile, target 'crm') was seen
// first — so a tool's header never reads its alias's name.
const HUB_TOOLS = (() => {
  const byView = new Map();
  for (const g of HUB_GROUPS) {
    for (const t of groupTools(g)) {
      const viewId = t.target || t.id;
      const entry = { ...t, id: viewId, brand: g.brand };
      const isCanonical = t.id === viewId;
      if (!byView.has(viewId) || isCanonical) byView.set(viewId, entry);
    }
  }
  // Cross-brand tools resolve their header label the same way (they live outside
  // the brand groups but still open a StudioBody view).
  for (const t of CROSS_BRAND_TOOLS) {
    const viewId = t.target || t.id;
    if (!byView.has(viewId)) byView.set(viewId, { ...t, id: viewId, brand: 'All business' });
  }
  return [...byView.values()];
})();

// size: 'large' (primary tier), 'normal' (secondary), or muted (paused).
// `large` cards get more height, a bigger icon, and a brighter label so the
// daily-core tier reads as the headline; muted cards (paused) read quietest.
// `accent` is the active BUSINESS's color (JP green / Webworks blue / Atom
// violet) — every green treatment on the card derives from it, so switching
// business re-paints the whole grid in that brand's vibe.
function HubCard({ tool, onClick, delay, notice, countdown, badge, muted, large, stat, accent = D.green }) {
  const { label, desc, Icon } = tool;
  const badgeText = badge > 99 ? '99+' : String(badge || '');
  const iconSize = large ? 54 : (muted ? 42 : 48);
  const glyph = large ? 28 : (muted ? 21 : 24);
  return (
    <Grow in timeout={400 + delay}>
      <Paper
        elevation={0}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        sx={{
          cursor: 'pointer',
          bgcolor: D.panel,
          border: `1px solid ${large ? D.lineHi : D.line}`,
          borderRadius: 3.5,
          minHeight: large ? 150 : (muted ? 128 : 150),
          transition: 'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
          boxShadow: muted ? 'none' : '0 1px 2px rgba(0,0,0,0.20)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: large ? 1.75 : (muted ? 1.25 : 1.5),
          p: { xs: 2, sm: large ? 3 : (muted ? 2.25 : 2.5) },
          // Muted (paused) cards drop the accent wash so they read quieter; live
          // cards get the soft top-left brand glow — brighter on the primary tier.
          opacity: muted ? 0.78 : 1,
          backgroundImage: muted
            ? 'none'
            : `linear-gradient(155deg, ${alpha(accent, large ? 0.1 : 0.06)} 0%, rgba(255,255,255,0.012) 55%, transparent 100%)`,
          '&:hover': {
            borderColor: D.lineHi,
            transform: 'translateY(-3px)',
            opacity: 1,
            boxShadow: `0 16px 38px -18px ${alpha(accent, 0.45)}`,
            '& .hub-accent': { opacity: 1 },
            '& .hub-icon': { color: D.ink, bgcolor: accent, boxShadow: `0 0 0 5px ${alpha(accent, 0.12)}` },
            '& .hub-label': { color: accent },
            '& .hub-chev': { transform: 'translateX(3px)', color: accent },
          },
          '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
        }}
      >
        {/* Top accent hairline — invisible until hover (visible on the primary
            tier from the start, so the daily core glows). */}
        <Box className="hub-accent" sx={{ ...accentBar, background: accent, opacity: large ? 0.9 : 0, transition: 'opacity 0.2s ease' }} />
        <Box
          className="hub-icon"
          sx={{
            width: iconSize, height: iconSize, borderRadius: 2.5,
            background: `linear-gradient(150deg, ${alpha(accent, 0.2)} 0%, ${alpha(accent, 0.05)} 100%)`,
            color: accent,
            boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.16)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
        >
          <Icon sx={{ fontSize: glyph }} />
          {notice && !badge && (
            <Box sx={{
              position: 'absolute', top: -3, right: -3,
              width: 10, height: 10, borderRadius: '50%',
              bgcolor: accent,
              boxShadow: `0 0 6px ${alpha(accent, 0.55)}`,
            }} />
          )}
          {badge > 0 && (
            <Box sx={{
              position: 'absolute', top: -8, right: -8,
              minWidth: 20, height: 20, px: '6px',
              borderRadius: '10px',
              bgcolor: '#ff3b30', color: '#fff',
              fontSize: 11, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
              boxShadow: '0 0 0 2px ' + D.panel + ', 0 2px 6px rgba(255,59,48,0.45)',
            }}>
              {badgeText}
            </Box>
          )}
        </Box>
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <MuiTypography className="hub-label" sx={{
            color: D.text, fontWeight: 800, fontSize: large ? 18 : (muted ? 14.5 : 15.5), letterSpacing: 0.2,
            transition: 'color 0.2s ease', lineHeight: 1.25, mb: 0.4,
          }}>
            {label}
          </MuiTypography>
          {desc && (
            <MuiTypography sx={{
              color: D.muted, fontSize: large ? 12.5 : 11.5, lineHeight: 1.4,
            }}>
              {desc}
            </MuiTypography>
          )}
          {/* Live pulse line — the tool's heartbeat number(s), so the hub reads
              as a live cockpit instead of a static menu. */}
          {stat && (
            <MuiTypography sx={{
              color: accent, fontSize: 10.5, fontWeight: 700,
              letterSpacing: 0.3, mt: 0.6, ...mono,
            }}>
              {stat}
            </MuiTypography>
          )}
          {countdown && (
            <MuiTypography sx={{
              color: accent, fontSize: 10.5, fontWeight: 700,
              letterSpacing: 0.3, mt: 0.6, ...mono,
            }}>
              {countdown}
            </MuiTypography>
          )}
        </Box>
        <ChevronRightIcon className="hub-chev" sx={{
          position: 'absolute', top: 14, right: 12,
          fontSize: 18, color: D.faint,
          transition: 'transform 0.2s ease, color 0.2s ease',
        }} />
      </Paper>
    </Grow>
  );
}

// Format an ISO timestamp as a "Xh Ym" countdown (or "Xm" under an hour,
// "soon" inside a minute). Used by the Lead Recon hub tile so the user can
// glance and know when the daily budget rolls over.
function _fmtCountdown(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (!isFinite(ms) || ms <= 0) return 'soon';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Section header — accent bar + eyebrow brand label + a quiet tagline, hung
// on a hairline rule. Shared by the live and paused groups so the two read as
// the same family, just at different volumes. `right` slots optional trailing
// content (the Paused chip / collapse affordance).
function SectionHeader({ brand, tagline, dim, right, accent: accentOverride }) {
  // Real businesses wear their cube mark; utility headers (e.g. "Signals") and
  // dimmed sections keep the plain accent bar. The label + bar take the business's
  // own accent color so each section reads in that business's vibe. A utility
  // header hosted on a brand's page can pass `accent` to wear that brand's color.
  const isBrand = !!BRAND_MARKS[brand];
  const showMark = !dim && isBrand;
  const accent = accentOverride || (isBrand ? brandAccent(brand) : D.green);
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
      {showMark ? (
        <BrandCube brand={brand} size={30} />
      ) : (
        <Box sx={{
          width: 3, alignSelf: 'stretch', minHeight: 28, borderRadius: 2,
          background: dim ? 'rgba(255,255,255,0.18)' : accent,
          opacity: dim ? 1 : 0.9, flexShrink: 0,
        }} />
      )}
      <Box sx={{ minWidth: 0 }}>
        <MuiTypography sx={{
          ...eyebrow,
          color: dim ? D.faint : accent,
          fontSize: 11, letterSpacing: 2.4, lineHeight: 1.1,
        }}>
          {brand}
        </MuiTypography>
        {tagline && (
          <MuiTypography sx={{ color: D.muted, fontSize: 12, mt: 0.35, lineHeight: 1.2 }}>
            {tagline}
          </MuiTypography>
        )}
      </Box>
      <Box sx={{ flexGrow: 1, height: 1, bgcolor: 'rgba(255,255,255,0.07)' }} />
      {right}
    </Stack>
  );
}

// cols: explicit responsive column template. `large` renders the primary tier;
// `muted` the paused group. onPick receives the whole tool so a tile can
// deep-link into a tool's internal view (e.g. the CRM tile → the Clients tab).
// One tool's live pulse line, from the hub-pulse payload the signals feed
// carries. Null (no line) for tools without a heartbeat number.
function statFor(t, pulse) {
  if (!pulse) return null;
  const s = (n) => (n === 1 ? '' : 's');
  if (t.id === 'clients') {
    return pulse.ordersOpen > 0 ? `${pulse.ordersOpen} open order${s(pulse.ordersOpen)}` : 'no open orders';
  }
  if (t.id === 'crm') {
    return pulse.followUpsToday > 0 ? `${pulse.followUpsToday} follow-up${s(pulse.followUpsToday)} due` : 'follow-ups clear';
  }
  if (t.id === 'outreach') {
    const bits = [`${pulse.outreachActive || 0} in sequence`];
    if (pulse.repliesWaiting > 0) bits.push(`${pulse.repliesWaiting} repl${pulse.repliesWaiting === 1 ? 'y' : 'ies'} waiting`);
    return bits.join(' · ');
  }
  if (t.id === 'finances' && pulse.monthProfit != null) {
    return `${money0(pulse.monthProfit)} profit this month`;
  }
  return null;
}

function ToolGrid({ tools, cols, muted, large, startIdx, onPick, sweepNeeded, sweepBlocked, nextResetAt, unseenInquiries, actionBadges, pulse, accent }) {
  return (
    <Box sx={{
      display: 'grid',
      gap: { xs: 1.25, sm: 1.5 },
      gridTemplateColumns: cols,
    }}>
      {tools.map((t, i) => {
        const showNotice = t.id === 'jpwrecon' && sweepNeeded;
        const showResetCountdown = t.id === 'jpwrecon' && !sweepNeeded && sweepBlocked && nextResetAt;
        // Each Inquiries tile wears ITS OWN source-scoped unseen count — the
        // Joint Printing tile the contact-form leads, the JP Webworks tile the
        // /webworks/start leads — so one badge never clears the other's.
        const badge = t.id === 'submissions' ? (unseenInquiries?.contact || 0)
          : t.id === 'jpwinquiries' ? (unseenInquiries?.webworks || 0)
          : t.id === 'atominquiries' ? (unseenInquiries?.atom || 0)
          // App-style action badges: CRM = calls due today, Order Tracker =
          // orders needing action. A red count bubble like a phone-app icon.
          : (actionBadges && actionBadges[t.id]) || 0;
        // The owner's daily routine, one tap shorter: with calls due, the CRM
        // tile opens straight onto the Today list (its pulse line says exactly
        // that); with none due it opens Companies as always.
        const pick = (t.id === 'crm' && pulse && pulse.followUpsToday > 0)
          ? () => onPick({ ...t, target: 'crm', view: 'today' })
          : () => onPick(t);
        return (
          <HubCard
            key={t.id}
            tool={t}
            muted={muted}
            large={large}
            delay={(startIdx + i) * 50}
            onClick={pick}
            notice={showNotice ? "Today's sweep not run yet" : null}
            countdown={showResetCountdown ? `Next sweep in ${_fmtCountdown(nextResetAt)}` : null}
            badge={badge}
            stat={statFor(t, pulse)}
            accent={accent}
          />
        );
      })}
    </Box>
  );
}

// A small, quiet label that opens the secondary / tucked tiers — lighter than a
// full SectionHeader so the daily-core tier stays the visual headline.
function TierLabel({ children }) {
  return (
    <MuiTypography sx={{
      ...eyebrow, color: D.faint, fontSize: 10, letterSpacing: 2, mb: 1.25, display: 'block',
    }}>
      {children}
    </MuiTypography>
  );
}

// The persistent "All business" strip — cross-brand tools (Finances, Backup) that
// stay reachable at the top of every brand's hub, so switching to Webworks/Atom
// never hides the money or the backup. Compact + NEUTRAL (they belong to no one
// brand → no brand accent), visually quieter than the brand tiles below.
function CrossBrandStrip({ tools, onPick, isOwner }) {
  const visible = (tools || []).filter((t) => !t.ownerOnly || isOwner);
  if (!visible.length) return null;
  return (
    <Box>
      <TierLabel>All business</TierLabel>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {visible.map((t) => {
          const Icon = t.Icon;
          return (
            <Box key={t.id} onClick={() => onPick(t)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t); } }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer',
                px: 1.75, py: 1.1, borderRadius: 2.5, minWidth: 160,
                bgcolor: D.panel, border: `1px solid ${D.line}`,
                transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.18s ease',
                '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(255,255,255,0.03)', transform: 'translateY(-1px)' },
                '&:focus-visible': { outline: `2px solid ${D.muted}`, outlineOffset: 2 },
              }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 1.75, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.05)', color: D.muted }}>
                <Icon sx={{ fontSize: 19 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <MuiTypography sx={{ color: D.text, fontWeight: 750, fontSize: 13.5, lineHeight: 1.15 }}>{t.label}</MuiTypography>
                <MuiTypography sx={{ color: D.faint, fontSize: 11, lineHeight: 1.25 }}>{t.desc}</MuiTypography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// Business switcher — a row of the businesses' own cube marks, so the owner picks
// by logo (and always sees "what's from what"). The active one lights up in its
// own accent color (green / blue / violet), giving the hub that business's vibe.
// Reads brands straight off HUB_GROUPS, so a new business needs no switcher edit.
function BizSwitcher({ value, onChange, brands }) {
  return (
    <Box role="tablist" aria-label="Business" sx={{
      display: 'flex', gap: { xs: 0.75, sm: 1 }, flexWrap: 'wrap',
    }}>
      {brands.map((b) => {
        const active = value === b;
        const accent = brandAccent(b);
        return (
          <Box
            key={b}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onChange(b)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(b); } }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', userSelect: 'none',
              px: { xs: 1.25, sm: 1.5 }, py: 0.85, borderRadius: 2.5,
              border: `1px solid ${active ? accent : D.line}`,
              bgcolor: active ? `${accent}1f` : 'transparent',
              opacity: active ? 1 : 0.68,
              transition: 'opacity .18s ease, background-color .18s ease, border-color .18s ease',
              '&:hover': { opacity: 1, bgcolor: active ? `${accent}1f` : `${accent}12` },
              '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
            }}
          >
            <BrandCube brand={b} size={26} />
            <MuiTypography sx={{
              fontSize: 13, fontWeight: 800, letterSpacing: 0.2, whiteSpace: 'nowrap',
              color: active ? accent : D.muted,
            }}>
              {b}
            </MuiTypography>
          </Box>
        );
      })}
    </Box>
  );
}

// A brand-new business has no live tools yet, so its section shows this instead of
// empty tiles: a one-line "what it is" + a real roadmap checklist. Honest
// groundwork — the moment JP Atom grows real tools, they render as a tier above
// this and the panel can retire.
function FoundationPanel({ data }) {
  const done = data.steps.filter((s) => s.done).length;
  return (
    <Paper elevation={0} sx={{
      bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3.5,
      p: { xs: 2.25, sm: 3 },
      backgroundImage: `linear-gradient(155deg, rgba(74,222,128,0.05) 0%, transparent 60%)`,
    }}>
      <MuiTypography sx={{ color: D.muted, fontSize: 13.5, lineHeight: 1.6, mb: 2.25, maxWidth: '62ch' }}>
        {data.blurb}
      </MuiTypography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <MuiTypography sx={{ ...eyebrow, color: D.faint, fontSize: 10, letterSpacing: 2 }}>Roadmap</MuiTypography>
        <Box sx={{ flexGrow: 1, height: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
        <MuiTypography sx={{ ...mono, color: D.faint, fontSize: 11 }}>{done}/{data.steps.length}</MuiTypography>
      </Stack>
      <Stack spacing={1.1}>
        {data.steps.map((s, i) => (
          <Stack key={i} direction="row" alignItems="center" spacing={1.25}>
            <Box sx={{
              width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
              bgcolor: s.done ? D.green : 'transparent',
              border: `1.5px solid ${s.done ? D.green : 'rgba(255,255,255,0.22)'}`,
              boxShadow: s.done ? `0 0 0 3px rgba(74,222,128,0.12)` : 'none',
            }} />
            <MuiTypography sx={{
              color: s.done ? D.faint : D.muted, fontSize: 13.5, lineHeight: 1.4,
              textDecoration: s.done ? 'line-through' : 'none',
            }}>
              {s.label}
            </MuiTypography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

// Column templates per tier. Primary holds the two daily-core tiles, so it's a
// clean 2-up that fills the row evenly (a 3-up left an orphan empty column and
// made the tiles read tall-and-empty). Secondary fills the row; tucked is a tidy
// small row. All collapse to 2-up / 1-up on small screens.
const TIER_COLS = {
  primary:   { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)', lg: 'repeat(2, 1fr)' },
  // Marketing pair — a clean 2-up, same rhythm as primary/tucked.
  growth:    { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)', lg: 'repeat(2, 1fr)' },
  // Five operational tools — 3+2 at tablet, one even row at desktop (no single
  // orphan wrap). Single column on the smallest phones so the tile descriptions
  // don't cramp to 3–4 lines.
  secondary: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
  tucked:    { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)', lg: 'repeat(2, 1fr)' },
  // JP Webworks pair (Websites + Inquiries) — same clean 2-up as growth/tucked.
  jpw:       { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)', lg: 'repeat(2, 1fr)' },
};

// The live command-center panel: clickable rows for what needs attention, ordered
// by urgency. Order rows (aging past the owner's 2–3 week turnaround) expand to list
// the at-risk orders, each deep-linking to its project; follow-up rows jump to the
// CRM Today queue. The backup nudge lives here too (it used to be a separate top
// banner) with a ✕ to snooze it. Falls back to the calm placeholder when clear.
// (Missing-receipt nudges live on the Finances page, not here — by design.)
// Consumes GET /api/signals: the server composes open-order aging + CRM follow-ups
// into severity groups (critical → warning → info). Each group is a calm row — 8px
// glowing tone dot, 13.5/700 label — with order/CRM groups expanding to their exact
// records. A new-site-inquiry row (from the hub's unseen-inquiry count) leads the
// list, and the backup nudge (client-gated by localStorage) trails it; the whole
// section still vanishes on a clean day.
function SignalsPanel({ signals, onNavigate, onPick, brandFilter, accent = D.green, aiUsage }) {
  const [open, setOpen] = React.useState({});
  const groups = (signals && signals.groups) || { critical: [], warning: [], info: [] };
  const backup = (signals && signals.backup) || null;

  // Backup nudge, folded into Signals (unchanged): an overdue-archive nudge
  // (snooze a week) and a gentler monthly "copy it to an external drive" reminder,
  // each remembering its last dismissal in localStorage so it doesn't re-nag. The
  // monthly one also respects the real last-backup date so it can't false-fire on a
  // fresh device. ✕ snoozes; the row body opens the Backup tab.
  const [overdueSnoozedAt, setOverdueSnoozedAt] = React.useState(() => readTs(K_OVERDUE_SNOOZE));
  const [hddDismissedAt, setHddDismissedAt] = React.useState(() => readTs(K_HDD_REMINDER));
  // AI-budget warning: same dismiss pattern, plus the dismissed level so a
  // warn → blocked escalation re-surfaces the (now red) row immediately instead
  // of staying snoozed.
  const [aiSnoozedAt, setAiSnoozedAt] = React.useState(() => readTs(K_AI_BUDGET_SNOOZE));
  const [aiSnoozedLevel, setAiSnoozedLevel] = React.useState(() => {
    try { return localStorage.getItem(K_AI_BUDGET_LEVEL) || ''; } catch (_) { return ''; }
  });
  const now = Date.now();
  const dismiss = (key, setter) => (e) => {
    e.stopPropagation();
    try { localStorage.setItem(key, String(Date.now())); } catch (_) {}
    setter(Date.now());
  };
  const dismissAi = (level) => (e) => {
    e.stopPropagation();
    try {
      localStorage.setItem(K_AI_BUDGET_SNOOZE, String(Date.now()));
      localStorage.setItem(K_AI_BUDGET_LEVEL, level);
    } catch (_) {}
    setAiSnoozedAt(Date.now());
    setAiSnoozedLevel(level);
  };
  const showOverdue = !!(backup && backup.isDue) && (now - overdueSnoozedAt > SNOOZE_OVERDUE_MS);
  // The monthly hard-drive reminder must anchor to the LAST ACTUAL BACKUP, not just
  // this device's dismiss time. localStorage is per-device and defaults to 0, so a
  // phone that's never dismissed it would read `now - 0 > 30d` and nag on every load
  // even right after a fresh backup ("keep getting reminders but a month hasn't
  // passed"). Anchor to whichever is later — the last dismissal on THIS device, or
  // the last backup the server knows about (shared across devices) — and never nag
  // from a cold start with neither (the overdue row already covers "never backed up").
  const lastBackupMs = backup && backup.lastBackupAt ? new Date(backup.lastBackupAt).getTime() : 0;
  const hddAnchor = Math.max(hddDismissedAt, lastBackupMs);
  const showHdd = !showOverdue && hddAnchor > 0 && (now - hddAnchor > REMIND_HDD_MS);
  const s = (n) => (n === 1 ? '' : 's');

  // AI-copywriting budget: show a row at 'warn' (amber) / 'blocked' (red). It
  // recurs after the snooze window, and re-appears at once when warn escalates
  // to blocked (a level we haven't dismissed yet).
  const aiLevel = aiUsage && aiUsage.level;
  const aiActive = aiLevel === 'warn' || aiLevel === 'blocked';
  const showAi = aiActive && (aiLevel !== aiSnoozedLevel || (now - aiSnoozedAt > SNOOZE_AI_BUDGET_MS));

  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // Tone per severity (critical red, warning amber); info wears the hosting
  // brand's accent so each page's feed reads in its own vibe.
  const TONE = { critical: '#f87171', warning: D.amber, info: accent };

  // Deep-link one expanded item to its exact record, by the row's kind. An
  // inquiry item opens its brand's OWN inbox (the row carries the view — same
  // per-source mark-seen behavior as the hub tiles).
  const itemNav = (r, it) => {
    if (r.kind === 'order') onNavigate && onNavigate({ view: 'clients', projectNumber: it.projectNumber || null, orderNumber: it.orderNumber || null });
    else if (r.kind === 'crm') onNavigate && onNavigate({ view: 'crm', companyKey: it.companyKey || null });
    else if (r.kind === 'lookbook') onNavigate && onNavigate({ view: 'lookbooks', companyKey: it.companyKey || null });
    else if (r.kind === 'inquiry') onPick && onPick(r.view);
  };

  // Flatten the server groups into rows (critical → warning → info). Order/CRM/
  // lookbook/inquiry groups expand to their records; the reply group jumps to the
  // Outreach worklist. Every row is scoped to THIS page's brand: inquiry groups
  // carry their brand from the server; the orders/CRM/outreach/lookbook sources
  // are all Joint-Printing businesses, so an untagged group is JP's — the
  // Webworks/Atom pages show only their own rows. (The amber hub banner still
  // covers every brand's inquiry pipe on every page.)
  const rows = [];
  for (const sev of ['critical', 'warning', 'info']) {
    for (const g of (groups[sev] || [])) {
      if (!g || !g.count) continue;
      if (brandFilter && (g.brand || 'Joint Printing') !== brandFilter) continue;
      const items = Array.isArray(g.items) ? g.items : [];
      const expandable = (g.kind === 'order' || g.kind === 'crm' || g.kind === 'lookbook' || g.kind === 'inquiry') && items.length > 0;
      rows.push({
        key: g.id, tone: TONE[sev] || D.green, label: g.label, kind: g.kind, view: g.view, items, expandable,
        onClick: expandable ? null
          : g.kind === 'triage' ? () => onPick && onPick({ target: 'outreach', view: 'replies' })
          : g.kind === 'crm' ? () => onPick && onPick({ target: 'crm', view: 'today' })
          : g.kind === 'inquiry' ? () => onPick && onPick(g.view)
          : g.kind === 'webworks' ? () => onPick && onPick('webworksops')
          : null,
      });
    }
  }

  // AI-copywriting budget row — a JP WEBWORKS cost (the site copywriter), so it
  // lives on the Webworks page's feed. Blocked is urgent → lead the list (red);
  // warn is a heads-up → sit with the other nudges (amber). Body opens the
  // JP Webworks Websites tab (where the spend happens); ✕ snoozes.
  if (showAi && (!brandFilter || brandFilter === 'JP Webworks')) {
    const pct = Math.round((Number(aiUsage.pct) || 0) * 100);
    const budget = Number(aiUsage.budgetUsd) || 0;
    const used = (Number(aiUsage.estCostUsd) || 0).toFixed(2);
    const aiRow = aiLevel === 'blocked'
      ? {
        key: 'ai-budget', tone: '#f87171',
        label: 'AI copywriting is paused — monthly budget reached. Top up Anthropic credit / raise the budget.',
        onClick: () => onPick && onPick('jpwsites'),
        onDismiss: dismissAi('blocked'),
      }
      : {
        key: 'ai-budget', tone: D.amber,
        label: `AI copywriting is at ${pct}% of this month's $${budget} budget (~$${used} used)`,
        onClick: () => onPick && onPick('jpwsites'),
        onDismiss: dismissAi('warn'),
      };
    if (aiLevel === 'blocked') rows.unshift(aiRow);
    else rows.push(aiRow);
  }

  // Backup nudge rows (client-gated), appended after the data signals. The
  // backup covers the whole system's data → it nags on the home (JP) page only.
  const showBackupRows = !brandFilter || brandFilter === 'Joint Printing';
  if (showBackupRows && showOverdue) rows.push({
    key: 'backup', tone: D.amber,
    label: backup.lastBackupAt
      ? `Backup is ${backup.lastBackupDays} day${s(backup.lastBackupDays)} old — back it up`
      : `You haven't backed up yet — back it up`,
    onClick: () => onPick && onPick('backup'),
    onDismiss: dismiss(K_OVERDUE_SNOOZE, setOverdueSnoozedAt),
  });
  else if (showBackupRows && showHdd) rows.push({
    key: 'backup', tone: '#60a5fa',
    label: 'Monthly: copy the latest backup to an external drive',
    onClick: () => onPick && onPick('backup'),
    onDismiss: dismiss(K_HDD_REMINDER, setHddDismissedAt),
  });

  // Nothing needs attention → render nothing (the whole Signals section, header
  // included, disappears — no dead placeholder cluttering the hub).
  if (!rows.length) return null;

  return (
    <Box>
      <SectionHeader brand="Signals" tagline="What needs your attention" accent={accent} />
      <Box sx={{ borderRadius: 3, border: `1px solid ${D.line}`, bgcolor: D.inset, overflow: 'hidden' }}>
      {rows.map((r, i) => {
        const expanded = !!open[r.key];
        const click = r.expandable ? () => toggle(r.key) : r.onClick;
        return (
          <Box key={r.key}>
            <Box onClick={click} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' && click) click(); }}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.3, cursor: 'pointer',
                borderTop: i === 0 ? 'none' : `1px solid ${D.line}`,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: r.tone, flexShrink: 0, boxShadow: `0 0 8px ${r.tone}66` }} />
              <MuiTypography sx={{ color: D.text, fontSize: 13.5, fontWeight: 700, flexGrow: 1, minWidth: 0 }}>{r.label}</MuiTypography>
              {r.onDismiss && (
                <Box component="span" onClick={r.onDismiss} role="button" tabIndex={0} title="Dismiss"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); r.onDismiss(e); } }}
                  sx={{ color: D.faint, fontSize: 15, lineHeight: 1, mr: -0.25, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: { xs: 36, md: 'auto' }, minHeight: { xs: 36, md: 'auto' },
                    px: { xs: 1, md: 0.75 }, py: { xs: 1, md: 0.25 },
                    cursor: 'pointer', borderRadius: 1, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.06)' } }}>
                  ✕
                </Box>
              )}
              {r.expandable
                ? <ExpandMoreIcon sx={{ fontSize: 20, color: D.faint, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                : <ChevronRightIcon sx={{ fontSize: 20, color: D.faint }} />}
            </Box>
            {r.expandable && expanded && (
              <Box sx={{ pb: 0.5, bgcolor: 'rgba(0,0,0,0.16)' }}>
                {r.items.map((it, idx) => {
                  const idTxt = it.projectNumber || it.orderNumber || '';
                  return (
                    <Box key={it._id || it.companyKey || idTxt || idx}
                      onClick={() => itemNav(r, it)} role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') itemNav(r, it); }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 4.75, pr: 1.75, py: 0.85, cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                      {idTxt
                        ? <MuiTypography sx={{ ...mono, color: accent, fontSize: 12, minWidth: 50 }}>#{idTxt}</MuiTypography>
                        : null}
                      <MuiTypography sx={{ color: D.muted, fontSize: 12.5, flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name || '—'}</MuiTypography>
                      {it.metric
                        ? <MuiTypography sx={{ ...mono, color: D.faint, fontSize: 11.5 }}>{it.metric}</MuiTypography>
                        : null}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
      </Box>
    </Box>
  );
}

// The hub's opening line: today's date + a one-breath read of where the whole
// business stands (from the pulse the signals feed carries). Quiet, mono, and
// live — the first thing that makes the hub feel like a cockpit, not a menu.
function PulseBar({ pulse }) {
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const s = (n) => (n === 1 ? '' : 's');
  const bits = [];
  if (pulse) {
    if (pulse.ordersOpen > 0) bits.push(`${pulse.ordersOpen} order${s(pulse.ordersOpen)} in motion`);
    if (pulse.followUpsToday > 0) bits.push(`${pulse.followUpsToday} follow-up${s(pulse.followUpsToday)} due`);
    if (pulse.outreachActive > 0) bits.push(`${pulse.outreachActive} cold sequence${s(pulse.outreachActive)} running`);
    if (pulse.monthRevenue != null) bits.push(`${money0(pulse.monthRevenue)} in this month`);
  }
  return (
    <Box>
      <MuiTypography sx={{ color: D.text, fontWeight: 800, fontSize: { xs: 19, sm: 22 }, letterSpacing: -0.3, lineHeight: 1.2 }}>
        {day}
      </MuiTypography>
      {bits.length > 0 && (
        <MuiTypography sx={{ ...mono, color: D.muted, fontSize: 12.5, mt: 0.5 }}>
          {bits.join('  ·  ')}
        </MuiTypography>
      )}
    </Box>
  );
}

// NJ sales-tax (ST-50) reminder — appears on the hub for ~2 weeks before each
// quarterly due date (Jan/Apr/Jul/Oct 20). Pulls the quarter's NJ-taxed orders
// from the backend so the numbers to file are right there to double-check, then
// expands to the per-order breakdown. Silent + absent the rest of the year.
// Merch-season nudge — the two dispensary dates that actually move merch orders:
// 4/20 (the big one) and 7/10 (concentrate day). Shows a heads-up in the ~8 weeks
// before each so the owner pitches BEFORE the rush, not during. Pure client-side
// date math — no backend, no config.
const MERCH_SEASONS = [
  { key: '4/20', month: 3, day: 20, blurb: 'the biggest dispensary merch day of the year' },
  { key: '7/10', month: 6, day: 10, blurb: 'the 7/10 concentrate holiday' },
];
function MerchSeasonReminder({ onPick }) {
  const now = new Date();
  const LEAD = 56; // start the nudge ~8 weeks out
  let hit = null;
  for (const e of MERCH_SEASONS) {
    let d = new Date(now.getFullYear(), e.month, e.day);
    // If this year's date already passed, look to next year's.
    if (d.getTime() < now.getTime() - 86400000) d = new Date(now.getFullYear() + 1, e.month, e.day);
    const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (days >= 0 && days <= LEAD && (!hit || days < hit.days)) hit = { ...e, days };
  }
  if (!hit) return null;
  const wks = Math.max(1, Math.round(hit.days / 7));
  return (
    <Box sx={{ borderRadius: 3, border: '1px solid rgba(74,222,128,0.4)', bgcolor: 'rgba(74,222,128,0.06)',
      display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, md: 2.5 }, py: 1.75, flexWrap: 'wrap' }}>
      <Box sx={{ fontSize: 22, flexShrink: 0 }}>🌿</Box>
      <Box sx={{ flex: 1, minWidth: 180 }}>
        <MuiTypography sx={{ color: D.green, fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
          {hit.key} is {hit.days <= 0 ? 'today' : `~${wks} week${wks === 1 ? '' : 's'} out`}
        </MuiTypography>
        <MuiTypography sx={{ color: D.text, fontSize: 14.5, fontWeight: 800, mt: 0.2 }}>
          Merch season — pitch your dispensaries before the rush
        </MuiTypography>
        <MuiTypography sx={{ color: D.muted, fontSize: 12, mt: 0.15 }}>
          {hit.key} is {hit.blurb}. Lead time is tight — get quotes &amp; mockups moving now.
        </MuiTypography>
      </Box>
      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={() => onPick && onPick('outreach')} sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Plan outreach →</Button>
        <Button size="small" onClick={() => onPick && onPick('content')} sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Plan a post →</Button>
      </Stack>
    </Box>
  );
}

// Upload a state-filing confirmation into Finances AND book it as a real
// transaction in one motion. Receipts never auto-book (by design — the AI only
// fills fields), so without the confirm step a filing receipt sat invisible in
// a server-side review queue. Prompts for the true amount paid (state portals
// add a card surcharge), then: POST /receipts (store) → POST /receipts/:id/confirm
// (book the expense, linked to the file). Returns the receipt id, '' when the
// upload succeeded but booking failed (file still saved), or null if the owner
// cancelled the amount prompt.
async function bookFilingReceipt(hdr, file, { fileName, amountPrompt, defaultAmount, category, party, summary }) {
  const raw = await promptDialog({ title: 'Amount paid', message: amountPrompt, defaultValue: (Number(defaultAmount) || 0).toFixed(2), confirmLabel: 'Save' });
  if (raw === null) return null;
  const amount = Number(String(raw).replace(/[^0-9.]/g, '')) || Number(defaultAmount) || 0;
  const fileDataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Could not read the file'));
    fr.readAsDataURL(file);
  });
  const up = await axios.post(`${config.backendUrl}/api/receipts`,
    { fileDataUrl, fileName: file.name || fileName }, hdr);
  const receiptId = up.data && up.data.receipt ? up.data.receipt._id : '';
  if (!receiptId) return '';
  try {
    await axios.post(`${config.backendUrl}/api/receipts/${receiptId}/confirm`, {
      force: true,
      extracted: {
        type: 'expense', category, party, amount, summary,
        date: new Date().toISOString().slice(0, 10),
      },
    }, hdr);
  } catch (e) {
    // The file is saved either way; booking can be finished from Finances.
    console.warn('[filing] receipt booked-upload confirm failed:', e.message);
  }
  return receiptId;
}

// NJ LLC annual report — the $75/yr state filing, due by the end of April (the
// LLC's anniversary month). Same shape as the ST-50 banner: a window-scoped
// reminder with a straight-to-the-portal button and a "Mark filed" that books
// the confirmation into Finances and dismisses the year.
function LlcAnnualReportReminder({ token }) {
  const [data, setData] = React.useState(null);
  const [filing, setFiling] = React.useState(false);
  const [fileErr, setFileErr] = React.useState('');
  const fileRef = React.useRef(null);
  React.useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    axios.get(`${config.backendUrl}/api/finances/nj-annual-report`, { headers: { Authorization: `Bearer ${token}` }, timeout: 12000 })
      .then((r) => { if (!cancelled) setData(r.data || null); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [token]);

  const markFiled = async (file) => {
    if (!data || filing) return;
    setFiling(true); setFileErr('');
    try {
      const hdr = { headers: { Authorization: `Bearer ${token}` } };
      let receiptId = '';
      if (file) {
        receiptId = await bookFilingReceipt(hdr, file, {
          fileName: `nj-llc-annual-report-${data.year}.pdf`,
          amountPrompt: 'Total paid (the $75 fee plus the portal’s card fee):',
          defaultAmount: data.fee || 75,
          category: 'Other',
          party: 'NJ Division of Revenue',
          summary: `NJ LLC annual report ${data.year}`,
        });
        if (receiptId === null) return;
      }
      await axios.post(`${config.backendUrl}/api/finances/nj-annual-report/filed`,
        { year: String(data.year), receiptId: receiptId || '' }, hdr);
      setData((d) => (d ? { ...d, filed: true } : d));
    } catch (e) {
      setFileErr(e.response?.data?.message || 'Could not mark it filed — try again.');
    } finally {
      setFiling(false);
    }
  };
  const onMarkFiledClick = async () => {
    if (!data || filing) return;
    if (await confirmDialog({
      title: 'Attach the filing confirmation?',
      message: 'Choose the file — it books into Finances, then dismisses this reminder. Or mark it filed now without a receipt.',
      confirmLabel: 'Choose file',
      cancelLabel: 'File without receipt',
    })) {
      fileRef.current && fileRef.current.click();
    } else {
      markFiled(null);
    }
  };

  if (!data || !data.active || data.filed) return null;
  const soon = data.daysUntilDue <= 5;
  return (
    <Box sx={{ borderRadius: 3, border: `1px solid ${soon ? '#f0b429' : 'rgba(240,180,41,0.4)'}`,
      bgcolor: 'rgba(240,180,41,0.06)', px: { xs: 2, md: 2.5 }, py: 1.75,
      display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <BrandCube brand="Joint Printing" size={24} style={{ marginRight: 2 }} />
      <Box sx={{ fontSize: 22, flexShrink: 0 }}>🏛️</Box>
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <MuiTypography sx={{ color: '#f0b429', fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
          NJ LLC annual report due {fmtDate(data.dueDate)} · {data.daysUntilDue <= 0 ? 'due now' : `in ${data.daysUntilDue} day${data.daysUntilDue === 1 ? '' : 's'}`}
        </MuiTypography>
        <MuiTypography sx={{ color: D.text, fontSize: 14.5, fontWeight: 800, mt: 0.2 }}>
          File the {data.year} annual report — ${data.fee} + the portal's card fee
        </MuiTypography>
        {fileErr && <MuiTypography sx={{ color: '#f87171', fontSize: 11, mt: 0.2 }}>{fileErr}</MuiTypography>}
      </Box>
      <Button component="a" size="small"
        href="https://www.njportal.com/DOR/AnnualReports" target="_blank" rel="noopener noreferrer"
        sx={{ bgcolor: '#f0b429', color: '#1a1405', fontWeight: 800, fontSize: 12, px: 1.75, py: 0.5,
          borderRadius: 999, textTransform: 'none', flexShrink: 0, '&:hover': { bgcolor: '#e0a51f' } }}>
        File it →
      </Button>
      <Button size="small" onClick={onMarkFiledClick} disabled={filing}
        sx={{ color: '#f0b429', border: '1.5px solid rgba(240,180,41,0.5)', fontWeight: 800, fontSize: 12,
          px: 1.75, py: 0.4, borderRadius: 999, textTransform: 'none', flexShrink: 0,
          '&:hover': { borderColor: '#f0b429', bgcolor: 'rgba(240,180,41,0.10)' },
          '&.Mui-disabled': { color: D.faint, borderColor: D.line } }}>
        {filing ? 'Saving…' : 'Mark filed ✓'}
      </Button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
        onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) markFiled(f); }} />
    </Box>
  );
}

function NjTaxReminder({ token, onNavigate }) {
  const [data, setData] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [filing, setFiling] = React.useState(false);
  const [fileErr, setFileErr] = React.useState('');
  const fileRef = React.useRef(null);
  React.useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    axios.get(`${config.backendUrl}/api/finances/nj-sales-tax`, { headers: { Authorization: `Bearer ${token}` }, timeout: 12000 })
      .then((r) => { if (!cancelled) setData(r.data || null); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [token]);

  // "Mark filed": push the NJ confirmation into Finances AND book it as a real
  // transaction on the spot (receipts never auto-book — without the confirm
  // step the upload sat invisible in a review queue), then stamp the quarter
  // filed — which dismisses this banner for good.
  const markFiled = async (file) => {
    if (!data || !data.periodKey || filing) return;
    setFiling(true); setFileErr('');
    try {
      const hdr = { headers: { Authorization: `Bearer ${token}` } };
      let receiptId = '';
      if (file) {
        receiptId = await bookFilingReceipt(hdr, file, {
          fileName: `nj-st50-${data.periodKey}${file.name && file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.pdf'}`,
          amountPrompt: `Total paid (from the NJ confirmation — includes their card fee):`,
          defaultAmount: data.totalTax,
          category: 'Sales Tax',
          party: 'NJ Division of Taxation',
          summary: `NJ ST-50 ${data.period} sales tax remittance`,
        });
        if (receiptId === null) return; // owner cancelled the amount prompt
      }
      await axios.post(`${config.backendUrl}/api/finances/nj-sales-tax/filed`,
        { period: data.periodKey, receiptId: receiptId || '' }, hdr);
      setData((d) => (d ? { ...d, filed: true } : d));
    } catch (e) {
      setFileErr(e.response?.data?.message || 'Could not mark it filed — try again.');
    } finally {
      setFiling(false);
    }
  };
  const onMarkFiledClick = async () => {
    if (!data || !data.periodKey || filing) return;
    // Receipt first (it lands in Finances), but never block the dismissal on it.
    if (await confirmDialog({
      title: 'Attach the NJ filing confirmation?',
      message: 'Choose the file — it saves to Finances receipts, then dismisses this reminder. Or mark it filed now without a receipt.',
      confirmLabel: 'Choose file',
      cancelLabel: 'File without receipt',
    })) {
      fileRef.current && fileRef.current.click();
    } else {
      markFiled(null);
    }
  };

  if (!data || !data.active || data.filed) return null;   // window closed, or already filed
  const soon = data.daysUntilDue <= 3;
  return (
    <Box sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${soon ? '#f0b429' : 'rgba(240,180,41,0.4)'}`,
      bgcolor: 'rgba(240,180,41,0.06)' }}>
      <Box onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, md: 2.5 }, py: 1.75, cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(240,180,41,0.10)' } }}>
        {/* Joint Printing mark — so it's clear which business this belongs to. */}
        <BrandCube brand="Joint Printing" size={24} style={{ marginRight: 2 }} />
        <Box sx={{ fontSize: 22, flexShrink: 0 }}>🧾</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <MuiTypography sx={{ color: '#f0b429', fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            NJ sales tax due {fmtDate(data.dueDate)} · {data.daysUntilDue <= 0 ? 'due now' : `in ${data.daysUntilDue} day${data.daysUntilDue === 1 ? '' : 's'}`}
          </MuiTypography>
          <MuiTypography sx={{ color: D.text, fontSize: 14.5, fontWeight: 800, mt: 0.2 }}>
            File your {data.period} ST-50 — {money(data.totalTax)} collected across {data.orderCount} order{data.orderCount === 1 ? '' : 's'}
          </MuiTypography>
          <MuiTypography sx={{ color: D.muted, fontSize: 12, mt: 0.15 }}>
            {money(data.totalTaxable)} of NJ-taxable sales · tap to review the orders and double-check.
          </MuiTypography>
        </Box>
        <ExpandMoreIcon sx={{ color: '#f0b429', fontSize: 22, flexShrink: 0, transition: 'transform 0.2s ease',
          transform: open ? 'rotate(180deg)' : 'none' }} />
      </Box>
      <Collapse in={open} timeout={260} unmountOnExit>
        <Box sx={{ px: { xs: 1.5, md: 2.5 }, pb: 2 }}>
          {/* ST-50 cheat sheet — the numbers exactly as the NJ portal form asks
              for them, so filing is copy-type-done. Lines 3/5/7/9/11 calculate
              themselves on the form. Renders once the API returns totalGross. */}
          {data.totalGross != null && (
            <Box sx={{ mb: 1.5, borderRadius: 2, border: '1px solid rgba(240,180,41,0.4)', overflow: 'hidden' }}>
              <Box sx={{ px: 1.5, py: 0.7, bgcolor: 'rgba(240,180,41,0.10)', borderBottom: `1px solid ${D.line}` }}>
                <MuiTypography sx={{ color: '#f0b429', fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  ST-50 · type these into the form ({data.period})
                </MuiTypography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 0, bgcolor: D.inset }}>
                {[
                  ['Line 1', 'Total gross receipts', data.totalGross, 'every sale booked this quarter, tax excluded'],
                  ['Line 2', 'Non-taxable receipts', data.totalNonTaxable, 'out-of-state + untaxed sales'],
                  ['Line 3', 'Taxable receipts', data.totalTaxable, 'auto-calculates on the form — check it matches'],
                  ['Line 8', 'Sales tax collected', data.totalTax, 'what your orders actually charged'],
                ].map(([ln, label, val, hint]) => (
                  <Box key={ln} title={hint} sx={{ px: 1.5, py: 1, borderRight: `1px solid ${D.line}`,
                    '&:last-of-type': { borderRight: 'none' } }}>
                    <MuiTypography sx={{ color: D.faint, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {ln} · {label}
                    </MuiTypography>
                    <MuiTypography sx={{ ...mono, color: ln === 'Line 8' ? '#f0b429' : D.text, fontSize: 15, fontWeight: 800, mt: 0.2 }}>
                      {money(val)}
                    </MuiTypography>
                  </Box>
                ))}
              </Box>
              <MuiTypography sx={{ color: D.faint, fontSize: 10.5, px: 1.5, py: 0.7, borderTop: `1px solid ${D.line}`, lineHeight: 1.5 }}>
                The rate (6.625%) pre-fills; lines 3, 5, 7, 9 &amp; 11 calculate themselves. Line 10 (use tax) is
                $0 unless you bought untaxed goods for your own use.
              </MuiTypography>
            </Box>
          )}
          {data.orders.length === 0 ? (
            <MuiTypography sx={{ color: D.muted, fontSize: 12.5, py: 1 }}>
              No NJ-taxed orders booked this quarter — file a $0 return.
            </MuiTypography>
          ) : (
            <Box sx={{ borderRadius: 2, border: `1px solid ${D.line}`, overflow: 'hidden', bgcolor: D.inset }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr 1fr', gap: 1, px: 1.5, py: 0.75,
                borderBottom: `1px solid ${D.line}`, bgcolor: D.panel }}>
                {['Order', 'Date', 'NJ taxable', 'NJ tax'].map((h, i) => (
                  <MuiTypography key={h} sx={{ color: D.faint, fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                    textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</MuiTypography>
                ))}
              </Box>
              {data.orders.map((o, i) => (
                <Box key={i} onClick={() => o.projectNumber && onNavigate && onNavigate({ view: 'clients', projectNumber: o.projectNumber })}
                  sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr 1fr', gap: 1, px: 1.5, py: 0.85,
                    borderTop: i === 0 ? 'none' : `1px solid ${D.line}`, cursor: o.projectNumber ? 'pointer' : 'default',
                    '&:hover': o.projectNumber ? { bgcolor: D.panelHi } : {} }}>
                  <Box sx={{ minWidth: 0 }}>
                    <MuiTypography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.company || '—'}
                    </MuiTypography>
                    <MuiTypography sx={{ ...mono, color: D.faint, fontSize: 10.5 }}>#{o.orderNumber || o.projectNumber}</MuiTypography>
                  </Box>
                  <MuiTypography sx={{ ...mono, color: D.muted, fontSize: 11.5, alignSelf: 'center' }}>{fmtDate(o.date)}</MuiTypography>
                  <MuiTypography sx={{ ...mono, color: D.muted, fontSize: 12, alignSelf: 'center', textAlign: 'right' }}>{money(o.taxable)}</MuiTypography>
                  <MuiTypography sx={{ ...mono, color: '#f0b429', fontSize: 12.5, fontWeight: 800, alignSelf: 'center', textAlign: 'right' }}>{money(o.tax)}</MuiTypography>
                </Box>
              ))}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr 1fr', gap: 1, px: 1.5, py: 0.9,
                borderTop: `2px solid ${D.line}`, bgcolor: D.panel }}>
                <MuiTypography sx={{ color: D.text, fontSize: 12, fontWeight: 800, gridColumn: '1 / 3' }}>Total to remit</MuiTypography>
                <MuiTypography sx={{ ...mono, color: D.muted, fontSize: 12, fontWeight: 800, textAlign: 'right' }}>{money(data.totalTaxable)}</MuiTypography>
                <MuiTypography sx={{ ...mono, color: '#f0b429', fontSize: 13, fontWeight: 900, textAlign: 'right' }}>{money(data.totalTax)}</MuiTypography>
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.25, flexWrap: 'wrap' }}>
            {/* Straight to the NJ Tax Portal — no hunting through nj.gov. */}
            <Button component="a" size="small"
              href="https://www.nj.gov/treasury/taxation/taxportal/index.shtml"
              target="_blank" rel="noopener noreferrer"
              sx={{ bgcolor: '#f0b429', color: '#1a1405', fontWeight: 800, fontSize: 12, px: 1.75, py: 0.5,
                borderRadius: 999, textTransform: 'none', flexShrink: 0,
                '&:hover': { bgcolor: '#e0a51f' } }}>
              File the ST-50 →
            </Button>
            {/* Done filing → attach the confirmation (lands in Finances receipts)
                and dismiss this banner for the quarter. */}
            <Button size="small" onClick={onMarkFiledClick} disabled={filing || !data.periodKey}
              sx={{ color: '#f0b429', border: '1.5px solid rgba(240,180,41,0.5)', fontWeight: 800, fontSize: 12,
                px: 1.75, py: 0.4, borderRadius: 999, textTransform: 'none', flexShrink: 0,
                '&:hover': { borderColor: '#f0b429', bgcolor: 'rgba(240,180,41,0.10)' },
                '&.Mui-disabled': { color: D.faint, borderColor: D.line } }}>
              {filing ? 'Saving…' : 'Mark filed ✓'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
              onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) markFiled(f); }} />
            <MuiTypography sx={{ color: fileErr ? '#f87171' : D.faint, fontSize: 11, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
              {fileErr || `These are the orders that charged NJ tax with a confirmation in ${data.period} —
              double-check against your QuickBooks before you submit.`}
            </MuiTypography>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

function Hub({ onPick, onNavigate, signals, sweepNeeded, sweepBlocked, nextResetAt, unseenInquiries, aiUsage, isOwner, token }) {
  // "On hold" sub-lists (a group's dismissed tools) collapse by default —
  // present but out of the way. State keyed by brand so each remembers its own
  // open/closed for this session.
  const [openHeld, setOpenHeld] = React.useState({});
  // The Team tile is only relevant once there's actually a sales agent, so we
  // keep the hub clean until then: hide the tile at zero agents (a discreet
  // onboarding link stays at the bottom), and let it appear on its own the moment
  // the owner onboards someone. `null` = not-yet-known (treat as none → hidden).
  const [agentCount, setAgentCount] = React.useState(null);
  React.useEffect(() => {
    if (!isOwner || !token) return;
    let cancelled = false;
    axios.get(`${config.backendUrl}/api/admin/agents/count`, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 })
      .then((r) => { if (!cancelled) setAgentCount(Number(r.data?.count) || 0); })
      .catch(() => { if (!cancelled) setAgentCount(0); }); // silent — just keep it hidden
    return () => { cancelled = true; };
  }, [isOwner, token]);
  const hasAgents = (agentCount || 0) > 0;
  let cardIdx = 0;
  const pulse = (signals && signals.pulse) || null;

  // Which business is in focus — one at a time, each its own clean context (no
  // blended "all" view). Persisted so the hub reopens where the owner left it.
  // Brands come straight off HUB_GROUPS, so onboarding a future business needs no
  // switcher change; the first brand (Joint Printing) is the default.
  const brands = HUB_GROUPS.map((g) => g.brand);
  const [biz, setBiz] = React.useState(() => {
    try { const v = localStorage.getItem('jp_hub_biz'); return brands.includes(v) ? v : brands[0]; } catch (_) { return brands[0]; }
  });
  const changeBiz = React.useCallback((b) => {
    setBiz(b);
    try { localStorage.setItem('jp_hub_biz', b); } catch (_) {}
  }, []);
  const activeBiz = brands.includes(biz) ? biz : brands[0];
  const visibleGroups = HUB_GROUPS.filter((g) => g.brand === activeBiz);
  // The focused business's accent (JP green / Webworks blue / Atom violet) —
  // threaded through the tiles + command center so switching business re-paints
  // the whole hub in that brand's vibe.
  const hubAccent = brandAccent(activeBiz) || D.green;

  // App-style action badges on the two daily-driver tiles — a red count bubble
  // like a phone-app icon, so the hub tells you what needs doing at a glance:
  //   CRM           → calls due today (from the pulse)
  //   Order Tracker → orders needing action (aging past turnaround; the order
  //                   signal groups the feed already carries).
  // Both are JP tools (they only appear on the Joint Printing page), so the
  // badges naturally scope to JP.
  const ordersNeedingAction = (() => {
    const g = (signals && signals.groups) || {};
    return [...(g.critical || []), ...(g.warning || []), ...(g.info || [])]
      .filter((x) => x && x.kind === 'order')
      .reduce((n, x) => n + (Number(x.count) || 0), 0);
  })();
  const actionBadges = {
    crm: (pulse && pulse.followUpsToday) || 0,
    clients: ordersNeedingAction,
  };
  // Joint Printing's live vitals (pulse, tax window, reminders) are JP-specific,
  // so they show only when Joint Printing is the focused business. (The Signals
  // command center is per-brand now — it renders on every page, brand-scoped.)
  const showJpVitals = activeBiz === 'Joint Printing';

  // Shared props every ToolGrid needs (badges / sweep nudges / live pulse / accent).
  const gridProps = { onPick, sweepNeeded, sweepBlocked, nextResetAt, unseenInquiries, actionBadges, pulse, accent: hubAccent };

  // UNANSWERED INQUIRIES — owner rule: a waiting lead banners on ALL THREE
  // brand pages (not just its own) until he's reached out. Counts are the
  // unseen ones per source; clicking jumps to that source's inbox (which
  // marks them seen — "reached out" clears the banner).
  const inquiryBanner = (() => {
    const rows = [
      ['contact', 'Joint Printing', 'submissions'],
      ['webworks', 'JP Webworks', 'jpwinquiries'],
      ['atom', 'JP Atom', 'atominquiries'],
    ].map(([src, label, view]) => ({ src, label, view, n: (unseenInquiries && unseenInquiries[src]) || 0 }))
      .filter((r) => r.n > 0);
    return rows.length ? rows : null;
  })();

  return (
    <Stack spacing={3.5}>
      {/* Command-center header: focus one business, or 'All' for the roll-up. */}
      <BizSwitcher value={activeBiz} onChange={changeBiz} brands={brands} />

      {/* Persistent "All business" strip — Finances + Backup stay reachable no
          matter which business is in focus (switching to Atom never hides the
          money). Neutral, quiet, above the brand-specific tiles. */}
      <CrossBrandStrip tools={CROSS_BRAND_TOOLS} onPick={onPick} isOwner={isOwner} />

      {inquiryBanner && (
        <Box sx={{ border: '1px solid rgba(251,191,36,0.45)', bgcolor: 'rgba(251,191,36,0.08)',
          borderRadius: 2.5, px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <MuiTypography sx={{ color: D.amber, fontWeight: 800, fontSize: 13 }}>
            📬 {inquiryBanner.reduce((t, r) => t + r.n, 0)} inquir{inquiryBanner.reduce((t, r) => t + r.n, 0) === 1 ? 'y' : 'ies'} waiting on you
          </MuiTypography>
          {inquiryBanner.map((r) => (
            <Chip key={r.src} size="small" onClick={() => onPick && onPick(r.view)}
              label={`${r.label} · ${r.n}`}
              sx={{ bgcolor: 'rgba(251,191,36,0.15)', color: D.amber, fontWeight: 800, fontSize: 11.5, cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(251,191,36,0.28)' } }} />
          ))}
          <MuiTypography sx={{ color: D.faint, fontSize: 11, ml: 'auto' }}>clears when you open the inbox</MuiTypography>
        </Box>
      )}

      {/* The single date + the business's live vitals — the hub's one opening
          line (no greeting, no nudge copy, no duplicate date). JP-scoped. */}
      {showJpVitals && <PulseBar pulse={pulse} />}

      {/* NJ sales-tax (ST-50) reminder — only inside its ~2-week filing window. */}
      {showJpVitals && <NjTaxReminder token={token} onNavigate={onNavigate} />}
      {/* NJ LLC annual report ($75/yr, due end of April) — same window pattern. */}
      {showJpVitals && <LlcAnnualReportReminder token={token} />}

      {/* Merch-season nudge — 4/20 & 7/10, the two dispensary dates worth prepping for. */}
      {showJpVitals && <MerchSeasonReminder onPick={onPick} />}

      {/* Command center — what needs attention, on arrival. Per-brand: every
          business page gets its own feed (JP the orders/CRM/outreach signals,
          Webworks its inquiries + AI budget, Atom its inquiries), each row
          scoped by the server's brand tag. Hidden entirely (header and all)
          when nothing needs attention — no dead placeholder. */}
      <SignalsPanel signals={signals} onNavigate={onNavigate} onPick={onPick} brandFilter={activeBiz} accent={hubAccent} aiUsage={aiUsage} />

      {visibleGroups.map((group) => (
        <Box key={group.brand}>
          <SectionHeader brand={group.brand} tagline={group.tagline} />
          {/* Tiered: the daily core (primary) renders big & bold; secondary and
              tucked tiers read progressively quieter so the hub stops feeling
              overwhelming. Each tier is its own grid + a soft label. */}
          <Stack spacing={2.5}>
            {(group.tiers || []).map((tier) => {
              // Owner-only tiles (Team/Admin) drop out for agents. The Team tile
              // also stays hidden until at least one agent exists, so it doesn't
              // clutter the hub before it's relevant. A tier that ends up empty
              // renders nothing at all.
              const tools = tier.tools.filter((t) => {
                if (t.ownerOnly && !isOwner) return false;
                if (t.id === 'admin' && !hasAgents) return false;
                return true;
              });
              if (tools.length === 0) return null;
              const startIdx = cardIdx;
              cardIdx += tools.length;
              return (
                <Box key={tier.id}>
                  {tier.label && <TierLabel>{tier.label}</TierLabel>}
                  <ToolGrid
                    tools={tools}
                    cols={TIER_COLS[tier.id] || TIER_COLS.secondary}
                    large={tier.id === 'primary'}
                    startIdx={startIdx}
                    {...gridProps}
                  />
                </Box>
              );
            })}

            {/* "On hold" — the group's dismissed tools (JP Webworks' Cold Call
                Tree + Lead Recon). Kept fully functional but tucked into a
                muted, collapsed-by-default sub-list — the same presentation
                the old paused group used, now scoped to just these tools. */}
            {group.held && group.held.tools.length > 0 && (() => {
              const heldStart = cardIdx;
              cardIdx += group.held.tools.length;
              const isOpen = !!openHeld[group.brand];
              const toggle = () => setOpenHeld((m) => ({ ...m, [group.brand]: !m[group.brand] }));
              return (
                <Box>
                  <Box
                    onClick={toggle}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      cursor: 'pointer', borderRadius: 2, mx: -1, px: 1, py: 0.6,
                      transition: 'background-color 0.15s ease',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                      '&:focus-visible': { outline: `2px solid ${D.line}`, outlineOffset: 2 },
                    }}
                  >
                    <PauseCircleOutlineIcon sx={{ fontSize: 15, color: D.amber, opacity: 0.8, flexShrink: 0 }} />
                    <MuiTypography sx={{ ...eyebrow, color: D.faint, fontSize: 10, letterSpacing: 2 }}>
                      On hold
                    </MuiTypography>
                    <MuiTypography sx={{ color: D.faint, fontSize: 11.5, minWidth: 0 }}>
                      {group.held.tools.length} dismissed tool{group.held.tools.length === 1 ? '' : 's'} — tap to open.
                    </MuiTypography>
                    <Box sx={{ flexGrow: 1, height: 1, bgcolor: 'rgba(255,255,255,0.05)' }} />
                    <ExpandMoreIcon sx={{
                      color: D.faint, fontSize: 18, flexShrink: 0,
                      transition: 'transform 0.2s ease',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                    }} />
                  </Box>
                  <Collapse in={isOpen} timeout={260} unmountOnExit>
                    <Box sx={{ pt: 1 }}>
                      <ToolGrid
                        tools={group.held.tools}
                        cols={TIER_COLS.tucked}
                        muted
                        startIdx={heldStart}
                        {...gridProps}
                      />
                    </Box>
                  </Collapse>
                </Box>
              );
            })()}

            {/* Brand-new business with no live tools yet → show its foundation /
                roadmap instead of an empty section (JP Atom). */}
            {group.foundation && <FoundationPanel data={group.foundation} />}
          </Stack>
        </Box>
      ))}

      {/* Discreet first-agent onboarding. Only when the owner has NO agents yet —
          the full Team tile is hidden until then to keep the hub clean, but this
          keeps the path to onboard the first one alive. Vanishes once an agent
          exists (the Team tile takes over in Maintenance). */}
      {isOwner && agentCount === 0 && showJpVitals && (
        <Box sx={{ textAlign: 'center', pt: 0.5 }}>
          <MuiTypography
            component="button"
            onClick={() => onPick('admin')}
            sx={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: D.faint, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.2,
              transition: 'color 0.15s ease',
              '&:hover': { color: D.green },
            }}
          >
            Hiring a sales agent? Set up your team →
          </MuiTypography>
        </Box>
      )}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main shell
// ─────────────────────────────────────────────────────────────────────────────
function StudioBody({ token, onLogout }) {
  const [view, setView] = React.useState('hub');
  // Which internal view the CRM should land on when entered from a hub tile (the
  // CRM tile → 'companies', i.e. the Clients tab; cross-tab links may request
  // another). Null = the CRM's own default. Bumped with a nonce so re-picking the
  // same tile re-applies it. `companyKey` deep-links straight to one company's
  // card (a cross-tab link from an order / finance / vendor surface).
  const [crmEntry, setCrmEntry] = React.useState({ view: null, companyKey: null, nonce: 0 });
  // Cross-tab deep-link targets for the other tools (mirrors crmEntry). Each is
  // seeded by `navigate()` below and consumed by its tab's `initial*` prop, which
  // opens the named record at mount/nonce. null target = no specific record.
  //   ordersEntry   → open one project in OrderTracker (by project/order number)
  //   vendorsEntry  → open one vendor card in VendorsTab (by id, or resolve a name)
  //   lookbookEntry → open the Lookbooks builder prefiltered to one company
  const [ordersEntry, setOrdersEntry]   = React.useState({ orderNumber: null, projectNumber: null, openPos: false, nonce: 0 });
  // mockupEntry → the Mockup Lab surface. Two intents:
  //   • EDIT — open the lab (the embedded /jpstudio, in-Studio) on a mockup
  //     (editMockup = remoteId) or a new project-linked one (editProject = _id).
  //   • BROWSE — open the gallery, optionally through a lens (lensCompanyKey /
  //     lensProjectNumber) so the CRM design library + a project's mockups are
  //     the same one browser, scoped. remoteId still opens the read-only detail.
  const [mockupEntry, setMockupEntry]   = React.useState({
    editProject: null, editMockup: null, editFresh: false, editLabel: null,
    lensCompanyKey: null, lensProjectNumber: null, lensLabel: null,
    remoteId: null, companyKey: null, client: null, nonce: 0,
  });
  const [vendorsEntry, setVendorsEntry] = React.useState({ vendorId: null, vendorName: null, nonce: 0 });
  const [lookbookEntry, setLookbookEntry] = React.useState({ companyKey: null, companyName: null, projectNumber: null, newLookbook: false, nonce: 0 });
  const isHub = view === 'hub';
  const currentTool = HUB_TOOLS.find((t) => t.id === view);
  // Role gates the owner-only surfaces (the Team/Admin tile + its view). Read from
  // the stored role hint; the server still enforces access (requireOwner) — this
  // is purely so an agent never even SEES the tile. Missing/owner → owner.
  const isOwner = (localStorage.getItem(ROLE_KEY) || 'owner') !== 'agent';

  // Daily-sweep reminder: when sitting on the hub, peek at sweep state to
  // know whether today's sweep has run. If not, show a small dot on the
  // Lead Recon card. Read once on hub view; cheap enough not to bother
  // polling.
  const [sweepNeeded, setSweepNeeded] = React.useState(false);
  // When the sweep has already run today (or budget's tapped out), show
  // "Next sweep in 3h 24m" on the Lead Recon card instead of the green
  // nudge dot. nextResetAt is the server-reported UTC midnight ISO string.
  const [sweepBlocked, setSweepBlocked] = React.useState(false);
  const [nextResetAt, setNextResetAt]   = React.useState(null);
  // Unseen inquiry counts, one per lead pipe — each brand's Inquiries tile
  // wears its own badge. Fetched as source-scoped counts so a badge clears
  // only when ITS view opens.
  const [unseenInquiries, setUnseenInquiries] = React.useState({ contact: 0, webworks: 0, atom: 0 });
  // AI-copywriting budget snapshot (GET /api/jpw/ai-usage) — powers the hub's
  // low-credit Signal row so the owner isn't surprised by a drained Anthropic
  // balance. Null until the fetch lands (or if it fails — then no row shows).
  const [aiUsage, setAiUsage] = React.useState(null);
  // Command-center signals shown in the hub's Signals panel: orders aging past the
  // owner's 2–3 week turnaround, overdue/due-today follow-ups, and the backup nudge.
  // Each fetch fails silent — a down endpoint just drops its row. (Missing-receipt
  // nudges live on the Finances page, not here.)
  // Which Outreach sub-view to open when the tool is entered (e.g. the hub's reply
  // alert jumps straight to Replies). Null → the Outreach dashboard on a plain open.
  const [outreachView, setOutreachView] = React.useState(null);
  const [signals, setSignals] = React.useState({
    groups: { critical: [], warning: [], info: [] }, counts: {}, backup: null,
  });
  React.useEffect(() => {
    if (view !== 'hub') return;
    let cancelled = false;
    const authH = { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 };
    // Smart Alerts: one composed, severity-ranked feed (order aging + money owed +
    // CRM follow-ups + buyer replies) replacing the old separate orders/attention +
    // crm/today fetches. Silent-fails so a down endpoint just hides Signals.
    axios.get(`${config.backendUrl}/api/signals`, authH)
      .then((r) => { if (!cancelled) setSignals((s) => ({ ...s, groups: r.data?.groups || s.groups, counts: r.data?.counts || {} })); })
      .catch(() => { /* silent — Signals just won't show */ });
    axios.get(`${config.backendUrl}/api/admin/backup/status`, authH)
      .then((r) => { if (!cancelled) setSignals((s) => ({ ...s, backup: r.data || null })); })
      .catch(() => { /* silent — backup row just won't show */ });
    // Use /usage instead of /sweep/status. The sweep status doc gets
    // overwritten on every click, so a second click that hit the cap
    // (status='stopped', pairs_done=0) wipes out the morning's
    // successful sweep state. Today's API usage is a more robust
    // "did a sweep happen" signal — it doesn't reset on second clicks.
    const url = `${config.backendUrl}/api/jpw/usage`;
    axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 })
      .then((res) => {
        if (cancelled) return;
        const u = res.data || {};
        // The dot's a "do it" nudge — only fire when the sweep is actually
        // runnable. Two conditions:
        //   1) the sweep hasn't already burned through today's API budget
        //      (>5 calls is the floor where a real sweep starts; a stray
        //      /search/places pulls 1-2)
        //   2) there's enough remaining budget to actually start a sweep.
        //      The backend refuses to launch when remaining < 6 (callsPerPair *
        //      3 in jpwPlacesIngest), so we match that floor here. When the
        //      budget's tapped out, the dot disappears so the indicator stops
        //      nagging for an action that can't happen.
        const used = u.places_calls_today || 0;
        const cap  = u.daily_cap || 0;
        const remaining = Math.max(0, cap - used);
        const sweepRan = used > 5;
        const hasBudget = remaining >= 6;
        setSweepNeeded(!sweepRan && hasBudget);
        // Either condition means the user can't do another sweep right now —
        // we'll surface the countdown on the tile.
        setSweepBlocked(sweepRan || !hasBudget);
        setNextResetAt(u.next_reset_at || null);
      })
      .catch(() => { /* if endpoint fails, hide the dot */ });
    // One source-scoped unseen count per Inquiries tile (?source= ships with
    // the backend counterpart; an older backend ignores the param and both
    // tiles briefly show the global count — harmless, self-heals on deploy).
    ['contact', 'webworks', 'atom'].forEach((source) => {
      axios.get(`${config.backendUrl}/api/submissions/unseen-count?source=${source}`, authH)
        .then((res) => { if (!cancelled) setUnseenInquiries((u) => ({ ...u, [source]: res.data?.count || 0 })); })
        .catch(() => { /* silent — bubble just won't show */ });
    });
    // AI-credit guardrail snapshot — a 'warn'/'blocked' level lights up a
    // dismissible Signal row (see SignalsPanel). Silent-fails so an old backend
    // (no /ai-usage) just hides the row.
    axios.get(`${config.backendUrl}/api/jpw/ai-usage`, authH)
      .then((res) => { if (!cancelled) setAiUsage(res.data || null); })
      .catch(() => { /* silent — AI-budget row just won't show */ });
    return () => { cancelled = true; };
  }, [view, token]);

  // A hub tile hands the whole tool. `target` is the StudioBody view to open
  // (defaults to the tile's id); `view` deep-links into that tool's internal
  // view (the CRM tile targets 'crm' and opens its Clients tab).
  const handlePick = (tool) => {
    const id = typeof tool === 'string' ? tool : (tool && (tool.target || tool.id));
    const innerView = typeof tool === 'object' && tool ? tool.view : null;
    // 'mockup' now opens the in-Studio Mockup Lab (v2) view — no new-tab hand-off.
    // The Lab keeps a one-click "Classic editor" link to /jpstudio/ for the
    // interactive canvas until the v2 editor lands, so no capability is lost.
    // Opening an Inquiries surface clears ITS badge and marks seen ONLY its
    // source: the Joint Printing inbox owns the contact-form leads, the JP
    // Webworks inbox the /webworks/start leads — so opening one never wipes
    // the unseen state of leads the owner hasn't looked at in the other. (An
    // older backend ignores the body and marks everything — harmless.)
    if (id === 'submissions' || id === 'jpwinquiries' || id === 'atominquiries') {
      const source = id === 'jpwinquiries' ? 'webworks' : id === 'atominquiries' ? 'atom' : 'contact';
      if ((unseenInquiries[source] || 0) > 0) {
        setUnseenInquiries((u) => ({ ...u, [source]: 0 }));
        axios.post(`${config.backendUrl}/api/submissions/mark-all-seen`, { source },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 })
          .catch(() => { /* best-effort; badge already cleared locally */ });
      }
    }
    if (id === 'crm') setCrmEntry((p) => ({ view: innerView || 'companies', companyKey: null, nonce: p.nonce + 1 }));
    // Entering Orders/Vendors from the hub bumps their entry nonce with a CLEARED
    // target, so the tool remounts fresh — a stale deep-linked drawer from an
    // earlier cross-tab jump never lingers when the owner re-opens the tool plain.
    if (id === 'clients') setOrdersEntry((p) => ({ orderNumber: null, projectNumber: null, openPos: false, nonce: p.nonce + 1 }));
    if (id === 'mockup') setMockupEntry((p) => ({ editProject: null, editMockup: null, editFresh: false, editLabel: null, lensCompanyKey: null, lensProjectNumber: null, lensLabel: null, remoteId: null, companyKey: null, client: null, nonce: p.nonce + 1 }));
    if (id === 'vendors') setVendorsEntry((p) => ({ vendorId: null, vendorName: null, nonce: p.nonce + 1 }));
    if (id === 'lookbooks') setLookbookEntry((p) => ({ companyKey: null, nonce: p.nonce + 1 }));
    if (id === 'outreach') setOutreachView(innerView || null);
    setView(id);
  };

  // ── Cross-tab deep-link router ───────────────────────────────────────────────
  // The connective tissue of the ecosystem: any surface can jump to a related
  // record in another tool by calling onNavigate(target). Mirrors handlePick's
  // entry+nonce pattern so the destination tab opens the exact record at mount.
  // Purely additive — every existing flow is untouched; this only ADDS jumps.
  //   { view:'crm',     companyKey }                         → open that CRM card
  //   { view:'clients', orderNumber?|projectNumber?, openPos?} → open that order
  //   { view:'vendors', vendorId?|vendorName }               → open that vendor
  //   { view:'lookbooks', companyKey? }                      → that company's lookbooks
  // A target with no usable id still switches to the tool (never a dead-end); the
  // tab degrades gracefully (lands on its list) when the record can't be found.
  const navigate = React.useCallback((target) => {
    if (!target || !target.view) return;
    const v = target.view;
    if (v === 'crm') {
      const key = target.companyKey ? String(target.companyKey) : null;
      setCrmEntry((p) => ({ view: target.innerView || 'companies', companyKey: key, nonce: p.nonce + 1 }));
      setView('crm');
    } else if (v === 'clients') {
      setOrdersEntry((p) => ({
        orderNumber: target.orderNumber != null ? String(target.orderNumber) : null,
        projectNumber: target.projectNumber != null ? String(target.projectNumber) : null,
        openPos: !!target.openPos,
        nonce: p.nonce + 1,
      }));
      setView('clients');
    } else if (v === 'vendors') {
      setVendorsEntry((p) => ({
        vendorId: target.vendorId ? String(target.vendorId) : null,
        vendorName: target.vendorName ? String(target.vendorName) : null,
        nonce: p.nonce + 1,
      }));
      setView('vendors');
    } else if (v === 'lookbooks') {
      setLookbookEntry((p) => ({
        companyKey: target.companyKey ? String(target.companyKey) : null,
        companyName: target.companyName ? String(target.companyName) : null,
        projectNumber: target.projectNumber != null ? String(target.projectNumber) : null,
        newLookbook: !!target.newLookbook,
        nonce: p.nonce + 1,
      }));
      setView('lookbooks');
    } else if (v === 'mockup') {
      setMockupEntry((p) => ({
        // EDIT intents open the embedded lab; BROWSE/lens open the gallery.
        editProject: target.editProject ? String(target.editProject) : null,
        editMockup: target.editMockup ? String(target.editMockup) : null,
        editFresh: !!target.editFresh,
        editLabel: target.editLabel ? String(target.editLabel) : (target.client ? String(target.client) : null),
        lensCompanyKey: target.lensCompanyKey ? String(target.lensCompanyKey) : null,
        lensProjectNumber: target.lensProjectNumber != null && target.lensProjectNumber !== '' ? String(target.lensProjectNumber) : null,
        lensLabel: target.lensLabel ? String(target.lensLabel) : (target.client ? String(target.client) : null),
        remoteId: target.mockupRemoteId ? String(target.mockupRemoteId) : null,
        companyKey: target.companyKey ? String(target.companyKey) : null,
        client: target.client ? String(target.client) : null,
        nonce: p.nonce + 1,
      }));
      setView('mockup');
    } else {
      setView(v);
    }
  }, []);

  // Road Trip Recon needs the full viewport — break out of the Studio's
  // maxWidth="md" container and render a slim header instead of the usual
  // Studio chrome. Returning early keeps the rest of the function untouched.
  if (view === 'roadtrip') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: D.bg }}>
        <Stack
          direction="row" alignItems="center" spacing={2}
          sx={{
            height: 56, px: 2, position: 'relative',
            borderBottom: `1px solid ${D.line}`,
            bgcolor: D.panel, color: D.green,
          }}
        >
          <Box sx={accentBar} />
          <Button
            onClick={() => setView('hub')}
            startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />}
            size="small"
            sx={{
              ...mono,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              color: D.muted, textTransform: 'none', minWidth: 0, borderRadius: 999,
              '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' },
            }}
          >
            Studio
          </Button>
          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: D.faint }} />
          <MuiTypography sx={{
            ...mono,
            fontSize: 12, color: D.green, fontWeight: 700,
          }}>
            Field Map
          </MuiTypography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            onClick={onLogout}
            size="small"
            sx={{
              ...mono,
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
              color: D.muted, textTransform: 'none', borderRadius: 999,
              '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' },
            }}
          >
            SIGN OUT
          </Button>
        </Stack>
        <RoadTripTab token={token} onNavigate={navigate} />
      </Box>
    );
  }

  // The Mockup Lab editor, folded into the Studio — the full-featured /jpstudio
  // lab embedded in-place (keeps the S&S finder, ink detect, print areas), on an
  // existing mockup or a new project-linked one. Full viewport, like Road Trip.
  if (view === 'mockup' && (mockupEntry.editProject || mockupEntry.editMockup || mockupEntry.editFresh)) {
    return (
      <LabErrorBoundary key={mockupEntry.nonce} remoteId={mockupEntry.editMockup} onBack={() => setView('hub')}>
        <NativeMockupLabHost
          token={token}
          entry={{
            editProject: mockupEntry.editProject,
            editMockup: mockupEntry.editMockup,
            editFresh: mockupEntry.editFresh,
            client: mockupEntry.client || mockupEntry.editLabel || '',
            projectNumber: mockupEntry.lensProjectNumber || '',
          }}
          onBack={() => setView('hub')}
        />
      </LabErrorBoundary>
    );
  }


  if (view === 'clients') {
    // initialOrder deep-links to one project (from a CRM/finance/vendor row).
    // Keyed by nonce so re-navigating to the same order re-opens it.
    return (
      <OrderTracker
        key={ordersEntry.nonce}
        token={token}
        onBack={() => setView('hub')}
        onNavigate={navigate}
        initialOrder={ordersEntry}
      />
    );
  }

  if (view === 'crm') {
    // Key by the entry nonce so re-picking the CRM tile re-lands on the right
    // internal view (CrmTab reads initialView at mount). initialCompanyKey
    // deep-links straight to one company's card from another surface.
    return (
      <CrmTab
        key={crmEntry.nonce}
        token={token}
        initialView={crmEntry.view}
        initialCompanyKey={crmEntry.companyKey}
        onBack={() => setView('hub')}
        onNavigate={navigate}
      />
    );
  }

  if (view === 'outreach') {
    // Full-viewport like the CRM: the tab owns its own slim header + sub-nav.
    // Warm leads deep-link back into the CRM company card via `navigate`.
    return <OutreachTab token={token} onBack={() => setView('hub')} onNavigate={navigate} initialView={outreachView} />;
  }

  if (view === 'backup') {
    return <BackupTab token={token} onBack={() => setView('hub')} />;
  }

  if (view === 'admin' && isOwner) {
    return <AgentsAdminTab token={token} onBack={() => setView('hub')} />;
  }

  if (view === 'finances') {
    return <FinancesTab token={token} onBack={() => setView('hub')} onNavigate={navigate} />;
  }

  if (view === 'content') {
    // The social planner is self-contained — no deep links in v1, so no
    // entry-nonce machinery; the hub tile just opens it.
    return <ContentTab token={token} onBack={() => setView('hub')} />;
  }

  if (view === 'newsletter') {
    // Client email blast — self-contained like Content; opens from the hub tile.
    return <NewsletterTab token={token} onBack={() => setView('hub')} />;
  }

  if (view === 'lookbooks') {
    // Keyed by nonce so re-entering (hub tile or a deep link) remounts fresh;
    // initialCompanyKey prefilters the list to one company's lookbooks.
    return (
      <LookbooksTab
        key={lookbookEntry.nonce}
        token={token}
        onBack={() => setView('hub')}
        onNavigate={navigate}
        initialCompanyKey={lookbookEntry.companyKey}
        initialCompanyName={lookbookEntry.companyName}
        initialProjectNumber={lookbookEntry.projectNumber}
        initialNew={lookbookEntry.newLookbook}
      />
    );
  }

  if (view === 'vendors') {
    return (
      <VendorsTab
        key={vendorsEntry.nonce}
        token={token}
        onBack={() => setView('hub')}
        onNavigate={navigate}
        initialVendor={vendorsEntry}
      />
    );
  }


  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: D.bg, py: { xs: 3, md: 5 },
      // Soft brand glow anchored top-center — the same "drop" cue the client
      // approval page and builders use, so the hub feels part of the family.
      backgroundImage: 'radial-gradient(120% 60% at 50% -10%, rgba(74,222,128,0.06), rgba(11,20,16,0) 60%)',
    }}>
      {/* On the hub we want the wider 4-up grid; once you enter a tool, the
          existing tools were designed against the narrower md container so we
          keep that to avoid stretching tab UIs. */}
      <Container maxWidth={isHub ? 'lg' : 'md'}>
        <Fade in timeout={350}>
          <Stack
            direction="row"
            alignItems="center" justifyContent="space-between"
            sx={{ mb: { xs: 2.5, md: 3.5 } }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
              {/* Transparent brand mark — no tile behind it (the box is already a
                  clean cube on transparent). */}
              <BrandCube brand="Joint Printing" size={34} />

              <Box sx={{ minWidth: 0 }}>
                <MuiTypography
                  sx={{
                    ...mono,
                    fontSize: { xs: 15, md: 17 }, fontWeight: 800,
                    color: D.text, letterSpacing: 1, lineHeight: 1.1,
                  }}
                >
                  JP <Box component="span" sx={{ color: D.green }}>STUDIO</Box>
                </MuiTypography>
                {isHub && (
                  <MuiTypography sx={{ ...eyebrow, color: D.faint, fontSize: 9.5, letterSpacing: 2, mt: 0.2 }}>
                    Command center
                  </MuiTypography>
                )}
              </Box>
            </Stack>
            <Button
              onClick={onLogout} size="small"
              sx={{
                textTransform: 'none', fontWeight: 600, fontSize: 12,
                color: D.muted, borderRadius: 999,
                '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >Sign out</Button>
          </Stack>
        </Fade>

        {isHub ? (
          <Hub onPick={handlePick} onNavigate={navigate} signals={signals} sweepNeeded={sweepNeeded} sweepBlocked={sweepBlocked} nextResetAt={nextResetAt} unseenInquiries={unseenInquiries} aiUsage={aiUsage} isOwner={isOwner} token={token} />
        ) : (
          <Grow in timeout={350}>
            <Paper elevation={0} sx={{
              borderRadius: 3, overflow: 'hidden', position: 'relative',
              bgcolor: D.panel, border: `1px solid ${D.line}`,
            }}>
              {/* Brand accent across the top of the tool shell — the same cue
                  the builders + approval page share, so moving between tools
                  feels like one cohesive surface. */}
              <Box sx={accentBar} />
              <Stack
                direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap
                sx={{
                  px: { xs: 2, sm: 2.5 }, py: 1.5,
                  borderBottom: `1px solid ${D.line}`,
                }}
              >
                <Button
                  onClick={() => setView('hub')}
                  startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />}
                  size="small"
                  sx={{
                    textTransform: 'none', color: D.muted, fontWeight: 600,
                    minWidth: 'auto', px: 1, fontSize: 12, borderRadius: 999,
                    '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.06)' },
                  }}
                >Studio</Button>
                <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: D.faint }} />
                <MuiTypography sx={{ color: D.green, fontWeight: 700, fontSize: 13, ...mono,
                  minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTool?.label}
                </MuiTypography>
                {/* Only the dismissed JPW tools (Cold Call Tree / Lead Recon)
                    read as on-hold now — the Websites/Inquiries surfaces are
                    live business. */}
                {currentTool?.held && (
                  <Chip
                    icon={<PauseCircleOutlineIcon sx={{ fontSize: 13, ml: 0.5 }} />}
                    label="On hold"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(251,191,36,0.10)', color: D.amber, fontWeight: 700,
                      fontSize: 10, height: 20, border: '1px solid rgba(251,191,36,0.28)',
                      '& .MuiChip-icon': { color: D.amber },
                    }}
                  />
                )}
              </Stack>

              <Fade in key={view} timeout={300}>
                <Box>
                  {/* Two Inquiries surfaces, one component: the Joint Printing
                      inbox shows every source (with filter chips); the JP
                      Webworks one is hard-locked to /webworks/start leads. */}
                  {view === 'submissions'  && <SubmissionsTab token={token} onOpenClients={() => setView('clients')} />}
                  {view === 'jpwinquiries' && <SubmissionsTab token={token} onOpenClients={() => setView('clients')} lockedSource="webworks" />}
                  {view === 'atominquiries' && <SubmissionsTab token={token} onOpenClients={() => setView('clients')} lockedSource="atom" />}
                  {view === 'catalogs'    && <CatalogManagerTab token={token} />}
                  {view === 'mockup'      && (
                    <React.Suspense fallback={
                      <Box display="flex" justifyContent="center" py={8}>
                        <JpLoader size={56} label="Loading Mockup Lab…" />
                      </Box>
                    }>
                      <MockupLab key={mockupEntry.nonce} token={token} onBack={() => setView('hub')} onNavigate={navigate} entry={mockupEntry} />
                    </React.Suspense>
                  )}
                  {view === 'coldcall'    && <ColdCallTab token={token} />}
                  {view === 'jpwrecon'    && <JpwReconTab token={token} onOpenColdCall={() => setView('coldcall')} />}
                  {view === 'jpwsites'    && (
                    <React.Suspense fallback={
                      <Box display="flex" justifyContent="center" py={8}>
                        <JpLoader size={56} label="Loading Websites…" />
                      </Box>
                    }>
                      <JpwSitesTab token={token} />
                    </React.Suspense>
                  )}
                  {view === 'webworksops' && (
                    <React.Suspense fallback={
                      <Box display="flex" justifyContent="center" py={8}>
                        <JpLoader size={56} label="Loading Client Manager…" />
                      </Box>
                    }>
                      <WebworksOpsTab token={token} onBack={() => setView('hub')} onNavigate={navigate} />
                    </React.Suspense>
                  )}
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
  // The signed-in account's role, tracked in React state so the shell switches
  // when it resolves (localStorage alone wouldn't re-render). Owner → the full
  // Studio; agent → the trimmed, self-scoped AgentHome. Seeded from the stored
  // hint and refreshed on every login/verify.
  const [role, setRole] = React.useState(() => localStorage.getItem(ROLE_KEY) || 'owner');

  // Bounce-back support: when another tool (jpstudio) redirected here to
  // collect a login, it tagged the URL with ?return=/wherever. After we have
  // a verified token we send the user straight back there — same-origin only
  // so an attacker can't smuggle in an off-site URL.
  const handleAuthed = React.useCallback((t) => {
    setToken(t);
    setRole(localStorage.getItem(ROLE_KEY) || 'owner');
    try {
      const ret = new URLSearchParams(window.location.search).get('return');
      if (ret && ret.startsWith('/')) {
        // Strip the return param from the URL so a refresh doesn't bounce again.
        window.location.replace(ret);
      }
    } catch (_) { /* no-op */ }
  }, []);

  React.useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      axios
        .get(`${config.backendUrl}/api/auth/verify`, { headers: { Authorization: `Bearer ${t}` } })
        .then((res) => { if (res?.data?.role) localStorage.setItem(ROLE_KEY, res.data.role); handleAuthed(t); })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ROLE_KEY);
          setToken(null);
        });
    }
  }, [handleAuthed]);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    setToken(null);
    setRole('owner');
  };

  // Offline field-capture, wired once for the whole authed app: feed the
  // write-queue the current auth header (read fresh each send so a refreshed
  // token is honored) and run the background flusher (drains on reconnect /
  // interval / load). Kept at the root so it survives every tab switch.
  React.useEffect(() => {
    if (!token) return undefined;
    setAuthProvider(() => ({ headers: { Authorization: `Bearer ${token}` } }));
    return startAutoFlush({ intervalMs: 20000 });
  }, [token]);

  if (!token) return <Login onAuthed={handleAuthed} />;
  // Agents get their own trimmed, self-scoped surface (leads + orders + goal);
  // they never load the owner's hub or tools. The PendingSyncBadge is fixed-
  // position and global, so it floats over whatever tool/view is open.
  if (role === 'agent') {
    return (<><AgentHome token={token} onLogout={handleLogout} /><PendingSyncBadge /><StudioDialogHost /></>);
  }
  return (<><StudioBody token={token} onLogout={handleLogout} /><PendingSyncBadge /><StudioDialogHost /></>);
}

// ── Backup nudge state ───────────────────────────────────────────────────────
// The backup nudge now lives as a row inside the hub's Signals panel (it used to
// be a separate banner across the top). Two triggers, overdue first:
//
//   1. OVERDUE backup — backend-driven (/admin/backup/status isDue): a full
//      archive hasn't been taken in ~30 days. Dismiss (✕) snoozes it a week.
//   2. MONTHLY hard-drive reminder — a gentler heads-up to copy the latest
//      archive onto an external drive (the third, fully-offline basket beyond
//      the site DB and Google Drive). Reappears ~30 days after whichever is
//      later: it was last dismissed on this device, OR the last real backup the
//      server reports (so a fresh phone doesn't nag from an empty localStorage).
//      Shown only when NOT overdue.
//
// Each stores its last-dismissed time in localStorage so it doesn't re-nag on
// every load. See SignalsPanel for the row that consumes these.
const SNOOZE_OVERDUE_MS = 7  * 24 * 60 * 60 * 1000;   // a week
const REMIND_HDD_MS     = 30 * 24 * 60 * 60 * 1000;   // ~monthly
const K_OVERDUE_SNOOZE  = 'jpBackupOverdueSnoozedAt';
const K_HDD_REMINDER    = 'jpHddReminderDismissedAt';
// AI-budget warning: dismissible but recurring (re-nags after ~half a day), and
// re-surfaces immediately if the level escalates warn → blocked (a different
// dismissed-level than the current one clears the snooze). Mirrors the backup
// nudge's localStorage-gated pattern.
const SNOOZE_AI_BUDGET_MS = 12 * 60 * 60 * 1000;      // half a day
const K_AI_BUDGET_SNOOZE  = 'jpAiBudgetSnoozedAt';
const K_AI_BUDGET_LEVEL   = 'jpAiBudgetSnoozedLevel';

function readTs(key) {
  try { const v = parseInt(localStorage.getItem(key), 10); return Number.isFinite(v) ? v : 0; }
  catch (_) { return 0; }
}
