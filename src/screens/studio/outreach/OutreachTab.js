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
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import config from '../../../config.json';
import { D, accentBar, mono } from '../_shared';
import OverviewView from './OverviewView';
import CampaignsView from './CampaignsView';
import QueueView from './QueueView';
import ImportView from './ImportView';

const base = `${config.backendUrl}/api/outreach`;
const crmBase = `${config.backendUrl}/api/crm`;

const NAV = [
  { id: 'overview',  label: 'Overview',     Icon: SpaceDashboardOutlinedIcon },
  { id: 'campaigns', label: 'Campaigns',    Icon: ForwardToInboxOutlinedIcon },
  { id: 'queue',     label: 'Queue',        Icon: ScheduleOutlinedIcon },
  { id: 'import',    label: 'Import leads', Icon: UploadFileOutlinedIcon },
];

export default function OutreachTab({ token, onBack, onNavigate }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [view, setView] = React.useState('overview');

  const [overview, setOverview] = React.useState(null);
  const [overviewLoading, setOverviewLoading] = React.useState(true);

  const [queue, setQueue] = React.useState([]);
  const [queueLoading, setQueueLoading] = React.useState(true);

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

  React.useEffect(() => { loadOverview(); }, [loadOverview]);
  React.useEffect(() => { if (view === 'queue') loadQueue(); }, [view, loadQueue]);

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

  // ── Lead import (reuses the CRM's battle-tested import endpoint) ──────────
  const importLeads = async (rows, { dryRun }) => {
    const { data } = await axios.post(`${crmBase}/import`, { rows, dryRun }, authHdr);
    if (!dryRun) flash(`Imported: ${data.created} new, ${data.updated} updated.`);
    return data;
  };

  const openCompany = (companyKey) => onNavigate && onNavigate({ view: 'crm', companyKey });

  // ── Render ────────────────────────────────────────────────────────────────
  const renderView = () => {
    switch (view) {
      case 'overview':
        return (
          <OverviewView
            overview={overview} loading={overviewLoading}
            onOpenCompany={openCompany}
            onMarkReplied={markReplied}
            onStop={stopEnrollment}
            onGoCampaigns={() => setView('campaigns')}
            onGoImport={() => setView('import')}
          />
        );
      case 'campaigns':
        return (
          <CampaignsView
            overview={overview} loading={overviewLoading}
            onCreate={createCampaign}
            onUpdate={updateCampaign}
            fetchCandidates={fetchCandidates}
            onEnroll={enroll}
            onError={(m) => flash(m, 'error')}
          />
        );
      case 'queue':
        return (
          <QueueView
            queue={queue} loading={queueLoading} engine={overview?.engine}
            onRunTick={runTick}
            onStop={stopEnrollment}
            onOpenCompany={openCompany}
          />
        );
      case 'import':
        return (
          <ImportView
            onImport={importLeads}
            onError={(m) => flash(m, 'error')}
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
