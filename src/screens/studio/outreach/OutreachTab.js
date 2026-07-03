// src/screens/studio/outreach/OutreachTab.js
// Outreach — the cold-email engine's cockpit. Full-viewport Studio tool (same
// chrome as the CRM): slim header + an internal sub-nav across four views:
//
//   Overview  → /api/outreach/overview   engine status, funnels, WARM LEADS
//   Campaigns → campaign CRUD + enroll   sequences of merge-templated steps
//   Queue     → /api/outreach/queue      what sends next + "send now"
//   Import    → /api/crm/import          state license lists → CRM leads
//
// This component owns ALL data + transport (views stay presentational), and
// every cross-tool jump goes through onNavigate — a warm lead opens straight
// onto its CRM company card, same as every other Studio deep link.

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Button, Snackbar, Alert, Typography as MuiTypography,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import config from '../../../config.json';
import { D, accentBar, mono } from '../_shared';
import OverviewView from './OverviewView';
import CampaignsView from './CampaignsView';
import QueueView from './QueueView';
import ImportView from './ImportView';
import AnalyticsView from './AnalyticsView';
import RepliesView from './RepliesView';

const base = `${config.backendUrl}/api/outreach`;
const triageBase = `${config.backendUrl}/api/triage`;

// Four tabs: the engine dashboard (overview + send queue + analytics stacked),
// campaigns, the reply command center, and lead finding.
const NAV = [
  { id: 'dashboard', label: 'Dashboard',  Icon: SpaceDashboardOutlinedIcon },
  { id: 'campaigns', label: 'Campaigns',  Icon: ForwardToInboxOutlinedIcon },
  { id: 'replies',   label: 'Replies',    Icon: MarkEmailUnreadOutlinedIcon },
  { id: 'import',    label: 'Find leads', Icon: TravelExploreOutlinedIcon },
];

export default function OutreachTab({ token, onBack, onNavigate, initialView }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // initialView lets a deep-link (e.g. the hub's "reply awaiting response" alert)
  // open straight onto a sub-view like Replies; a plain open falls back to Dashboard.
  const [view, setView] = React.useState(initialView || 'dashboard');

  const [overview, setOverview] = React.useState(null);
  const [overviewLoading, setOverviewLoading] = React.useState(true);

  const [queue, setQueue] = React.useState([]);
  const [queueLoading, setQueueLoading] = React.useState(true);

  const [analytics, setAnalytics] = React.useState(null);
  const [analyticsLoading, setAnalyticsLoading] = React.useState(true);

  const [replies, setReplies] = React.useState([]);
  const [repliesLoading, setRepliesLoading] = React.useState(true);
  const [showIgnored, setShowIgnored] = React.useState(false);
  const [worklist, setWorklist] = React.useState(null);
  const [worklistLoading, setWorklistLoading] = React.useState(true);

  // Find-leads state lives HERE, not inside ImportView, so an in-flight scan and
  // its results survive switching tabs and back — a sweep can take a minute+, and
  // it used to vanish (and lose the result) the moment you clicked away.
  const [importRegion, setImportRegion] = React.useState('nj');
  const [importBusy, setImportBusy] = React.useState(false);
  const [importResult, setImportResult] = React.useState(null);
  const [importFrontier, setImportFrontier] = React.useState(null);
  const [importAutoBusy, setImportAutoBusy] = React.useState(false);

  const [snack, setSnack] = React.useState(null); // { msg, severity }
  const flash = (msg, severity = 'success') => setSnack({ msg, severity });

  // ── Loads ─────────────────────────────────────────────────────────────────
  const loadOverview = React.useCallback(async () => {
    setOverviewLoading(true);
    try {
      const { data } = await axios.get(`${base}/overview`, authHdr);
      setOverview(data);
    } catch (e) {
      flash(e.response?.data?.message || 'Could not load outreach overview', 'error');
    } finally {
      setOverviewLoading(false);
    }
  }, [authHdr]);

  const loadQueue = React.useCallback(async () => {
    setQueueLoading(true);
    try {
      const { data } = await axios.get(`${base}/queue`, authHdr);
      setQueue(data.queue || []);
    } catch (e) {
      flash(e.response?.data?.message || 'Could not load the queue', 'error');
    } finally {
      setQueueLoading(false);
    }
  }, [authHdr]);

  const loadAnalytics = React.useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const { data } = await axios.get(`${base}/analytics`, authHdr);
      setAnalytics(data);
    } catch (e) {
      flash(e.response?.data?.message || 'Could not load analytics', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [authHdr]);

  const loadReplies = React.useCallback(async () => {
    setRepliesLoading(true);
    try {
      const { data } = await axios.get(`${triageBase}/replies`, { ...authHdr, params: { includeIgnored: showIgnored } });
      setReplies(data.replies || []);
    } catch (e) {
      flash(e.response?.data?.message || 'Could not load replies', 'error');
    } finally {
      setRepliesLoading(false);
    }
  }, [authHdr, showIgnored]);

  const loadWorklist = React.useCallback(async () => {
    setWorklistLoading(true);
    try {
      const { data } = await axios.get(`${triageBase}/worklist`, authHdr);
      setWorklist(data);
    } catch (e) {
      flash(e.response?.data?.message || 'Could not load the follow-up worklist', 'error');
    } finally {
      setWorklistLoading(false);
    }
  }, [authHdr]);

  React.useEffect(() => { loadOverview(); }, [loadOverview]);
  React.useEffect(() => { if (view === 'dashboard') { loadQueue(); loadAnalytics(); } }, [view, loadQueue, loadAnalytics]);
  React.useEffect(() => { if (view === 'replies') { loadReplies(); loadWorklist(); } }, [view, loadReplies, loadWorklist]);

  // ── Campaign actions ──────────────────────────────────────────────────────
  const createCampaign = async (payload) => {
    const { data } = await axios.post(`${base}/campaigns`, payload, authHdr);
    flash(`Campaign “${data.campaign.name}” created — activate it when the copy reads right.`);
    await loadOverview();
    return data.campaign;
  };

  const updateCampaign = async (id, patch) => {
    const { data } = await axios.patch(`${base}/campaigns/${id}`, patch, authHdr);
    if (patch.status === 'active') flash('Campaign live — the engine takes it from here.');
    else if (patch.status === 'paused') flash('Campaign paused — nothing more sends until you resume.');
    else flash('Campaign saved.');
    await loadOverview();
    return data.campaign;
  };

  // One-click go: activate + kick a send tick immediately, so touch 1 leaves now
  // (in-window) and the follow-ups drip on their own. The response tells us what
  // actually happened so the toast is honest instead of a hopeful "done".
  const launchCampaign = async (id) => {
    const { data } = await axios.post(`${base}/campaigns/${id}/launch`, {}, authHdr);
    const t = data.tick || {};
    if (t.sent > 0) flash(`Launched — ${t.sent} email${t.sent === 1 ? '' : 's'} going out now. The rest drip automatically.`);
    else if (t.skipped === 'outside-window') flash('Launched & active — sends begin in the window (Mon–Fri 9a–5p ET).');
    else if (t.skipped === 'daily-cap') flash("Launched — today's warm-up cap is used up; more goes out tomorrow.");
    else if (t.sent === 0 && t.skipped) flash('Launched & active — no emails were due to send this minute; the engine will send as they come due.');
    else flash('Launched — the engine will start sending due emails.');
    await loadOverview();
    return data;
  };

  const fetchCandidates = async (params) => {
    const { data } = await axios.get(`${base}/candidates`, { ...authHdr, params });
    return data.candidates || [];
  };

  const enroll = async (campaignId, companyKeys) => {
    const { data } = await axios.post(`${base}/campaigns/${campaignId}/enroll`, { companyKeys }, authHdr);
    const skips = (data.skipped || []).length;
    flash(`Enrolled ${data.enrolled} compan${data.enrolled === 1 ? 'y' : 'ies'}${skips ? ` (${skips} skipped)` : ''}.`);
    await loadOverview();
    return data;
  };

  // ── Enrollment actions ────────────────────────────────────────────────────
  const markReplied = async (enrollmentId) => {
    await axios.post(`${base}/enrollments/${enrollmentId}/replied`, {}, authHdr);
    flash('Marked replied — they’re tagged warm and on today’s call list.');
    await loadOverview();
    if (view === 'queue') loadQueue();
  };

  const stopEnrollment = async (enrollmentId) => {
    await axios.post(`${base}/enrollments/${enrollmentId}/stop`, {}, authHdr);
    flash('Sequence stopped for that company.');
    await loadOverview();
    if (view === 'queue') loadQueue();
  };

  const runTick = async () => {
    const { data } = await axios.post(`${base}/run-tick`, {}, authHdr);
    if (data.skipped === 'sender-not-configured') flash('Holding: set OUTREACH_EMAIL_FROM on the API first (see Overview).', 'warning');
    else if (data.skipped === 'smtp-not-configured') flash('Holding: SMTP isn’t configured on the API.', 'warning');
    else if (data.skipped === 'outside-window') flash('Outside the send window (Mon–Fri 9a–5p ET) — the engine only sends business hours.', 'warning');
    else if (data.skipped === 'daily-cap') flash(`Today’s warm-up cap (${data.cap}) is used up — more goes out tomorrow.`, 'warning');
    else if (data.skipped === 'no-active-campaigns') flash('No active campaign — activate one under Campaigns.', 'warning');
    else flash(`Sent ${data.sent || 0} now (${data.sentToday || 0} today).`);
    await loadOverview();
    loadQueue();
    return data;
  };

  // ── Free auto-finder (OSM dispensary discovery → email scrape → import) ───
  // All finder state is owned here so it survives tab switches (see the import*
  // state above). runImport drives the scan; its result lands in importResult
  // even if the user has navigated to another sub-tab while it ran.
  const loadFinderStatus = React.useCallback(async () => {
    try {
      const { data } = await axios.get(`${base}/find-leads/status`, authHdr);
      setImportFrontier(data.frontier || null);
    } catch { /* the panel still works without status */ }
  }, [authHdr]);

  React.useEffect(() => { loadFinderStatus(); }, [loadFinderStatus]);

  const runImport = async () => {
    setImportBusy(true);
    try {
      const { data } = await axios.post(`${base}/find-leads`, { region: importRegion, dryRun: false }, authHdr);
      setImportResult(data);
      flash(`${data.label}: found ${data.found}, ${data.withEmail} with email — ${data.created} new lead${data.created === 1 ? '' : 's'} imported.`);
      await Promise.all([loadOverview(), loadFinderStatus()]);
    } catch (e) {
      flash(e.response?.data?.message || 'Lead finder failed — the discovery service may be busy, try again.', 'error');
    } finally {
      setImportBusy(false);
    }
  };

  const toggleImportAuto = async (enabled) => {
    setImportAutoBusy(true);
    try {
      const { data } = await axios.post(`${base}/find-leads/auto`, { enabled }, authHdr);
      setImportFrontier(data.frontier || null);
      flash(enabled
        ? 'Auto-pilot on — it refills the lead pool across states as you send, so you never run dry.'
        : 'Auto-pilot off.');
    } catch (e) {
      flash(e.response?.data?.message || 'Could not update the auto-pilot.', 'error');
    } finally {
      setImportAutoBusy(false);
    }
  };

  // ── Reply triage actions ──────────────────────────────────────────────────
  const refreshTriage = () => Promise.all([loadReplies(), loadWorklist()]);

  const setReplyStatus = async (id, status) => {
    const { data } = await axios.patch(`${triageBase}/replies/${id}`, { status }, authHdr);
    flash('Reply updated.');
    if (data.sideEffectWarning) flash(`Updated, but the linked-company change hit a snag: ${data.sideEffectWarning}`, 'warning');
    await refreshTriage();
  };

  const addReply = async (payload) => {
    const { data } = await axios.post(`${triageBase}/replies`, payload, authHdr);
    if (data.added) flash(`Reply added — ${data.replies?.[0]?.matched ? 'matched to a company.' : 'unmatched (still shown).'}`);
    else flash('Looked like a bounce/auto-reply or your own mail — nothing added.', 'warning');
    await refreshTriage();
    return data;
  };

  const syncGmail = async () => {
    const { data } = await axios.post(`${triageBase}/sync`, {}, authHdr);
    flash(data.message || 'Sync complete.', data.configured ? 'success' : 'warning');
    if (data.imported) await refreshTriage();
    return data;
  };

  const toggleIgnored = () => setShowIgnored((v) => !v);

  const openCompany = (companyKey) => onNavigate && onNavigate({ view: 'crm', companyKey });

  // ── Render ────────────────────────────────────────────────────────────────
  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return (
          <Stack spacing={3.5}>
            <OverviewView
              overview={overview} loading={overviewLoading}
              onOpenCompany={openCompany}
              onMarkReplied={markReplied}
              onStop={stopEnrollment}
              onGoCampaigns={() => setView('campaigns')}
              onGoImport={() => setView('import')}
            />
            <Box>
              <MuiTypography sx={{ ...mono, fontSize: 11, color: D.faint, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', mb: 1 }}>Send queue</MuiTypography>
              <QueueView
                queue={queue} loading={queueLoading} engine={overview?.engine}
                onRunTick={runTick}
                onStop={stopEnrollment}
                onOpenCompany={openCompany}
              />
            </Box>
            <Box>
              <MuiTypography sx={{ ...mono, fontSize: 11, color: D.faint, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', mb: 1 }}>Analytics</MuiTypography>
              <AnalyticsView analytics={analytics} loading={analyticsLoading} />
            </Box>
          </Stack>
        );
      case 'campaigns':
        return (
          <CampaignsView
            overview={overview} loading={overviewLoading}
            onCreate={createCampaign}
            onUpdate={updateCampaign}
            onLaunch={launchCampaign}
            fetchCandidates={fetchCandidates}
            onEnroll={enroll}
            onError={(m) => flash(m, 'error')}
          />
        );
      case 'replies':
        return (
          <RepliesView
            replies={replies} loading={repliesLoading}
            worklist={worklist} worklistLoading={worklistLoading}
            showIgnored={showIgnored} onToggleIgnored={toggleIgnored}
            onSetStatus={setReplyStatus}
            onAddReply={addReply}
            onSync={syncGmail}
            onOpenCompany={openCompany}
            onError={(m) => flash(m, 'error')}
          />
        );
      case 'import':
        return (
          <ImportView
            region={importRegion} onRegion={setImportRegion}
            busy={importBusy} result={importResult}
            frontier={importFrontier} autoBusy={importAutoBusy}
            onRun={runImport} onToggleAuto={toggleImportAuto}
            onGoCampaigns={() => setView('campaigns')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg }}>
      {/* Slim full-width header — matches the CRM / Field Map tool chrome. */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: D.panel, borderBottom: `1px solid ${D.line}` }}>
        <Box sx={accentBar} />
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ height: 56, px: { xs: 1.5, sm: 2 } }}>
          <Button
            onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
            sx={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: D.muted,
              textTransform: 'none', minWidth: 0, borderRadius: 999,
              '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}
          >
            Studio
          </Button>
          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: D.faint }} />
          <MuiTypography sx={{ ...mono, fontSize: 12, color: D.green, fontWeight: 700 }}>Outreach</MuiTypography>
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: { xs: 1, sm: 2 }, pb: 0, overflowX: 'auto',
          '&::-webkit-scrollbar': { height: 0 } }}>
          {NAV.map((n) => {
            const active = view === n.id;
            const Icon = n.Icon;
            return (
              <Button
                key={n.id} onClick={() => setView(n.id)}
                startIcon={<Icon sx={{ fontSize: 17 }} />}
                sx={{
                  textTransform: 'none', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
                  color: active ? D.green : D.muted, borderRadius: 0, px: 1.5, py: 1,
                  borderBottom: `2px solid ${active ? D.green : 'transparent'}`,
                  '&:hover': { color: active ? D.green : D.text, bgcolor: 'rgba(255,255,255,0.03)' },
                }}
              >
                {n.label}
              </Button>
            );
          })}
        </Stack>
      </Box>

      <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 1.5, sm: 2.5 }, py: { xs: 2, sm: 3 } }}>
        {renderView()}
      </Box>

      <Snackbar
        open={!!snack} autoHideDuration={4200} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)} sx={{ fontWeight: 600 }}>
            {snack.msg}
          </Alert>
        ) : <span />}
      </Snackbar>
    </Box>
  );
}
