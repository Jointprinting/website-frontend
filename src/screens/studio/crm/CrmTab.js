// src/screens/studio/crm/CrmTab.js
// The CRM — Joint Printing's sales command center, built on the unified Client
// record (one company per companyKey). Full-viewport Studio tool (like Field
// Map): its own slim header + an internal sub-nav across five views:
//
//   Today      → /api/crm/today      the daily call list (default)
//   Calendar   → /api/crm/calendar   month grid of follow-ups, drag to reschedule
//   Companies  → /api/crm            searchable / filterable list
//   (Detail)   → /api/crm/:key       one company, opened from any list
//   Import     → /api/crm/import     load the field tracker from CSV
//
// This component owns ALL data + transport so the view components stay
// presentational and the write paths (log a touch, reschedule, field edit,
// import) invalidate the right caches in one place. New views (Kanban, a
// dashboard) slot in by adding a NAV entry + a branch in renderView — the data
// helpers here are already shaped for them.

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Button, Snackbar, Alert, Typography as MuiTypography,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import config from '../../../config.json';
import { D, accentBar, mono } from '../_shared';
import { dayKey, stageMeta } from './_crm';
import { LogTouchDialog, RescheduleDialog, LostReasonDialog } from './CrmDialogs';
import DashboardView from './DashboardView';
import TodayView from './TodayView';
import CalendarView from './CalendarView';
import CompaniesView from './CompaniesView';
import CompanyDetail from './CompanyDetail';
import ImportView from './ImportView';
import PipelineView from './PipelineView';
import CleanupView from './CleanupView';

const base = `${config.backendUrl}/api/crm`;

const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: SpaceDashboardOutlinedIcon },
  { id: 'today',     label: 'Today',     Icon: TodayOutlinedIcon },
  { id: 'pipeline',  label: 'Pipeline',  Icon: ViewKanbanOutlinedIcon },
  { id: 'calendar',  label: 'Calendar',  Icon: CalendarMonthOutlinedIcon },
  { id: 'companies', label: 'Companies', Icon: PeopleAltOutlinedIcon },
  { id: 'cleanup',   label: 'Clean up',  Icon: CleaningServicesOutlinedIcon },
  { id: 'import',    label: 'Import',    Icon: UploadFileOutlinedIcon },
];

// First & last day (YYYY-MM-DD) of the full Sun→Sat grid that contains `month`
// of `year` — the exact window the calendar grid renders, so every visible cell
// (incl. adjacent-month spill days) has its events. Built in UTC to match
// CalendarView's UTC grid (see the date-helper note in _crm.js).
function gridRange(year, month) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const startMs = Date.UTC(year, month, 1 - firstDow);
  return { from: dayKey(new Date(startMs)), to: dayKey(new Date(startMs + 41 * 86400000)) };
}

export default function CrmTab({ token, onBack }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [view, setView] = React.useState('dashboard');
  const [openKey, setOpenKey] = React.useState(null); // company detail overlay (null = closed)

  // ── Per-view data ────────────────────────────────────────────────────────
  // Dashboard — the one-shot aggregate (/dashboard): pipeline + follow-ups +
  // activity + breakdowns + the heads-up feed, all server-computed.
  const [dashboard, setDashboard] = React.useState(null);
  const [dashboardLoading, setDashboardLoading] = React.useState(true);

  const [today, setToday] = React.useState({ summary: {}, rows: [] });
  const [todayLoading, setTodayLoading] = React.useState(true);

  const [calCursor, setCalCursor] = React.useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [calEvents, setCalEvents] = React.useState([]);
  const [calLoading, setCalLoading] = React.useState(true);

  const [clients, setClients] = React.useState([]);
  const [companiesLoading, setCompaniesLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState('all');
  const [tagFilter, setTagFilter] = React.useState('all');

  // Pipeline (Kanban) — its own filter pair so it doesn't fight the Companies
  // search box, plus the server-computed groups/summary/probability from
  // /pipeline.
  const [pipeline, setPipeline] = React.useState({ groups: [], summary: {}, probability: null });
  const [pipelineLoading, setPipelineLoading] = React.useState(true);
  const [pipeQuery, setPipeQuery] = React.useState('');
  const [pipeTag, setPipeTag] = React.useState('all');

  // Clean up — duplicate groups (/duplicates) + dead/no-follow-up archive
  // candidates. The dead list is derived from an UNFILTERED company fetch (its
  // own state, so the Companies tab's active search/stage/tag filters can't
  // silently narrow the cleanup candidate set).
  const [duplicates, setDuplicates] = React.useState([]);
  const [duplicatesLoading, setDuplicatesLoading] = React.useState(false);
  const [cleanupClients, setCleanupClients] = React.useState([]);
  const [cleanupClientsLoading, setCleanupClientsLoading] = React.useState(false);

  const [detail, setDetail] = React.useState(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // Shared dialog state. `target` carries the companyKey + display name + the
  // current nextFollowUp so the dialogs can prefill / label without a refetch.
  const [logDlg, setLogDlg] = React.useState({ open: false, target: null });
  const [reschedDlg, setReschedDlg] = React.useState({ open: false, target: null });
  // Lost-reason prompt — opened when a card is dragged into the Lost column.
  // `target` carries the companyKey + name + the card's previous stage so we can
  // revert the optimistic move if the prompt is cancelled.
  const [lostDlg, setLostDlg] = React.useState({ open: false, target: null });

  const [toast, setToast] = React.useState({ open: false, msg: '', sev: 'success' });
  const flash = React.useCallback((msg, sev = 'success') => setToast({ open: true, msg, sev }), []);

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const loadDashboard = React.useCallback(async () => {
    setDashboardLoading(true);
    try {
      const res = await axios.get(`${base}/dashboard`, authHdr);
      setDashboard(res.data || null);
    } catch (e) {
      flash('Could not load the dashboard.', 'error');
    } finally { setDashboardLoading(false); }
  }, [authHdr, flash]);

  const loadToday = React.useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await axios.get(`${base}/today`, authHdr);
      setToday({ summary: res.data?.summary || {}, rows: res.data?.rows || [] });
    } catch (e) {
      flash('Could not load today’s calls.', 'error');
    } finally { setTodayLoading(false); }
  }, [authHdr, flash]);

  const loadCalendar = React.useCallback(async (cursor) => {
    setCalLoading(true);
    try {
      const { from, to } = gridRange(cursor.year, cursor.month);
      const res = await axios.get(`${base}/calendar`, { ...authHdr, params: { from, to } });
      setCalEvents(res.data?.events || []);
    } catch (e) {
      flash('Could not load the calendar.', 'error');
    } finally { setCalLoading(false); }
  }, [authHdr, flash]);

  const loadCompanies = React.useCallback(async (q, stage, tag) => {
    setCompaniesLoading(true);
    try {
      const params = {};
      if (q && q.trim()) params.q = q.trim();
      if (stage && stage !== 'all') params.stage = stage;
      if (tag && tag !== 'all') params.tag = tag;
      const res = await axios.get(base, { ...authHdr, params });
      setClients(res.data?.clients || []);
    } catch (e) {
      flash('Could not load companies.', 'error');
    } finally { setCompaniesLoading(false); }
  }, [authHdr, flash]);

  const loadPipeline = React.useCallback(async (q, tag) => {
    setPipelineLoading(true);
    try {
      const params = {};
      if (q && q.trim()) params.q = q.trim();
      if (tag && tag !== 'all') params.tag = tag;
      const res = await axios.get(`${base}/pipeline`, { ...authHdr, params });
      setPipeline({
        groups: res.data?.groups || [],
        summary: res.data?.summary || {},
        probability: res.data?.probability || null,
      });
    } catch (e) {
      flash('Could not load the pipeline.', 'error');
    } finally { setPipelineLoading(false); }
  }, [authHdr, flash]);

  const loadDetail = React.useCallback(async (key) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(`${base}/${encodeURIComponent(key)}`, authHdr);
      setDetail(res.data || null);
    } catch (e) {
      flash('Could not open that company.', 'error');
      setOpenKey(null);
    } finally { setDetailLoading(false); }
  }, [authHdr, flash]);

  const loadDuplicates = React.useCallback(async () => {
    setDuplicatesLoading(true);
    try {
      const res = await axios.get(`${base}/duplicates`, authHdr);
      setDuplicates(res.data?.groups || []);
    } catch (e) {
      flash('Could not load duplicates.', 'error');
    } finally { setDuplicatesLoading(false); }
  }, [authHdr, flash]);

  // The UNFILTERED company set for the Clean-up dead/no-follow-up list — never
  // narrowed by the Companies tab filters.
  const loadCleanupClients = React.useCallback(async () => {
    setCleanupClientsLoading(true);
    try {
      const res = await axios.get(base, authHdr); // no params -> full (non-archived) set
      setCleanupClients(res.data?.clients || []);
    } catch (e) {
      flash('Could not load companies.', 'error');
    } finally { setCleanupClientsLoading(false); }
  }, [authHdr, flash]);

  // ── Effects: load each view's data lazily on first entry, refetch on deps ──
  React.useEffect(() => { loadDashboard(); }, [loadDashboard]);
  React.useEffect(() => { loadToday(); }, [loadToday]);
  React.useEffect(() => { loadCalendar(calCursor); }, [calCursor, loadCalendar]);

  // Companies: debounce the search box so we don't fire a request per keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => loadCompanies(query, stageFilter, tagFilter), 280);
    return () => clearTimeout(id);
  }, [query, stageFilter, tagFilter, loadCompanies]);

  // Pipeline: same debounced-search treatment as Companies.
  React.useEffect(() => {
    const id = setTimeout(() => loadPipeline(pipeQuery, pipeTag), 280);
    return () => clearTimeout(id);
  }, [pipeQuery, pipeTag, loadPipeline]);

  // Detail: (re)load whenever the open company changes.
  React.useEffect(() => {
    if (openKey) loadDetail(openKey);
    else setDetail(null);
  }, [openKey, loadDetail]);

  // Clean up: load duplicates lazily on first entry. The dead/no-follow-up list
  // is derived from the already-loaded Companies set (loadCompanies runs on
  // mount), so entering the tab also ensures that's fresh.
  React.useEffect(() => {
    if (view === 'cleanup' && !openKey) {
      loadDuplicates();
      loadCleanupClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, openKey, loadDuplicates, loadCleanupClients]);

  // After any write, refresh whatever's currently visible + the open detail so
  // counts/badges/timelines stay truthful without a blanket refetch of all views.
  const refreshAffected = React.useCallback(() => {
    loadDashboard();
    loadToday();
    loadCalendar(calCursor);
    loadCompanies(query, stageFilter, tagFilter);
    loadPipeline(pipeQuery, pipeTag);
    if (view === 'cleanup') { loadDuplicates(); loadCleanupClients(); }
    if (openKey) loadDetail(openKey);
  }, [loadDashboard, loadToday, loadCalendar, calCursor, loadCompanies, query, stageFilter, tagFilter,
      loadPipeline, pipeQuery, pipeTag, view, loadDuplicates, loadCleanupClients, openKey, loadDetail]);

  // ── Write transport ───────────────────────────────────────────────────────
  // One PATCH path for everything: field edits, log-a-touch, reschedule. The
  // backend disambiguates by body shape.
  const patchCompany = React.useCallback(async (key, body) => {
    try {
      const res = await axios.patch(`${base}/${encodeURIComponent(key)}`, body, authHdr);
      return res.data?.client || null;
    } catch (e) {
      flash(e?.response?.data?.message || 'That change didn’t save.', 'error');
      throw e;
    }
  }, [authHdr, flash]);

  // Import — two-step: preview (dry-run, writes nothing) then commit. `opts`
  // carries { mode: 'merge' | 'replace' }.
  const importPreview = React.useCallback(async (csv, opts = {}) => {
    const res = await axios.post(`${base}/import`, { csv, dryRun: true, mode: opts.mode || 'merge' }, authHdr);
    return res.data; // { dryRun, willCreate, willUpdate, willSkip, proposedMerges, ... }
  }, [authHdr]);

  const importCommit = React.useCallback(async (csv, opts = {}) => {
    const res = await axios.post(`${base}/import`, { csv, mode: opts.mode || 'merge' }, authHdr);
    return res.data; // { created, updated, skipped, replacedArchived, ... }
  }, [authHdr]);

  // Merge one duplicate into a survivor (folds + re-points orders, archives the
  // merged record server-side).
  const mergeCompany = React.useCallback(async (survivorKey, mergedKey) => {
    try {
      const res = await axios.post(`${base}/merge`, { survivorKey, mergedKey }, authHdr);
      flash(`Merged. ${res.data?.ordersRepointed || 0} order(s) re-pointed.`);
      loadDuplicates();
      refreshAffected();
      return res.data;
    } catch (e) {
      flash(e?.response?.data?.message || 'Merge failed.', 'error');
      throw e;
    }
  }, [authHdr, flash, loadDuplicates, refreshAffected]);

  // Delete ONE log entry from a company card (owner: "i cant delete notes"). The
  // entry id is its _id (or a numeric index for legacy id-less entries). Refreshes
  // the open detail so the timeline updates.
  const deleteLogEntry = React.useCallback(async (key, entryId) => {
    try {
      await axios.delete(`${base}/${encodeURIComponent(key)}/log/${encodeURIComponent(entryId)}`, authHdr);
      flash('Note deleted.');
      refreshAffected();
    } catch (e) {
      flash(e?.response?.data?.message || 'Could not delete that note.', 'error');
      throw e;
    }
  }, [authHdr, flash, refreshAffected]);

  // Archive (soft-delete) THIS one card from its detail page (owner: "fine
  // removing their card"). Soft / reversible; returns to the list after.
  const archiveOne = React.useCallback(async (key) => {
    try {
      const res = await axios.post(`${base}/${encodeURIComponent(key)}/archive`, {}, authHdr);
      flash('Card archived. Recover it from Companies → Archived.');
      setOpenKey(null);
      refreshAffected();
      return res.data;
    } catch (e) {
      flash(e?.response?.data?.message || 'Could not archive that card.', 'error');
      throw e;
    }
  }, [authHdr, flash, refreshAffected]);

  // Archive (soft-delete) a set of records.
  const archiveCompanies = React.useCallback(async (keys) => {
    try {
      const res = await axios.post(`${base}/archive`, { keys }, authHdr);
      const n = res.data?.archived || 0;
      const skipped = (res.data?.skippedWithOrders || []).length;
      flash(skipped > 0
        ? `Archived ${n}. Kept ${skipped} with orders (recover or force-archive from Companies).`
        : `Archived ${n} ${n === 1 ? 'record' : 'records'}.`,
      skipped > 0 ? 'info' : 'success');
      refreshAffected();
      return res.data;
    } catch (e) {
      flash(e?.response?.data?.message || 'Archive failed.', 'error');
      throw e;
    }
  }, [authHdr, flash, refreshAffected]);

  // ── Action handlers wired into the views/dialogs ──────────────────────────
  const openCompany = (key) => setOpenKey(key);

  const openLog = (target) => setLogDlg({ open: true, target });
  const openResched = (target) => setReschedDlg({ open: true, target });

  // From the detail view, "log a touch" reuses the same dialog with the open
  // company as the target.
  const openLogForDetail = () => {
    if (detail?.client) {
      setLogDlg({ open: true, target: {
        companyKey: detail.client.companyKey,
        name: detail.client.companyName || detail.client.clientName || detail.client.companyKey,
        nextFollowUp: detail.client.nextFollowUp,
      } });
    }
  };

  const submitLog = async (body) => {
    const t = logDlg.target;
    if (!t) return;
    await patchCompany(t.companyKey, body);
    flash('Logged.');
    refreshAffected();
  };

  const submitReschedule = async (body) => {
    const t = reschedDlg.target;
    if (!t) return;
    await patchCompany(t.companyKey, body);
    flash(body.nextFollowUp ? 'Follow-up moved.' : 'Follow-up cleared.');
    refreshAffected();
  };

  // Calendar drag-drop: optimistic move, then PATCH; refetch reconciles. The
  // optimistic value is UTC-noon of the dropped day so it re-buckets onto the
  // same cell (dayKey reads UTC) before the server echoes back UTC midnight.
  const calendarReschedule = async (key, newDayKey, ev) => {
    setCalEvents((list) => list.map((e) => (e.companyKey === key ? { ...e, nextFollowUp: `${newDayKey}T12:00:00Z` } : e)));
    try {
      await patchCompany(key, { nextFollowUp: newDayKey });
      const nice = new Date(`${newDayKey}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      flash(`${ev?.name || 'Follow-up'} → ${nice}`);
    } catch (_) {
      // revert on failure by refetching the window
      loadCalendar(calCursor);
      return;
    }
    refreshAffected();
  };

  // Optimistically move a card from one stage column to another in the board
  // state — pull it out of its old group, drop it into the new one, and fix both
  // columns' count + totalValue. The summary band is reconciled by the /pipeline
  // refetch that follows the PATCH (keeps the weighted math server-authoritative).
  const optimisticMove = React.useCallback((key, toStage) => {
    setPipeline((prev) => {
      let moved = null;
      const groups = (prev.groups || []).map((g) => {
        const idx = (g.clients || []).findIndex((c) => c.companyKey === key);
        if (idx === -1) return g;
        moved = g.clients[idx];
        const clients = g.clients.filter((_, i) => i !== idx);
        return { ...g, clients, count: clients.length, totalValue: Math.max(0, (g.totalValue || 0) - (moved.dealValue || 0)) };
      });
      if (!moved) return prev;
      const card = { ...moved, stage: toStage };
      const next = groups.map((g) => (
        g.stage === toStage
          ? { ...g, clients: [card, ...(g.clients || [])], count: (g.count || 0) + 1, totalValue: (g.totalValue || 0) + (card.dealValue || 0) }
          : g
      ));
      return { ...prev, groups: next };
    });
  }, []);

  // Pipeline drag-drop: move a card to a new stage. Dropping into Lost is special
  // — we move the card optimistically, then open the reason prompt; submitting
  // PATCHes { stage:'lost', lostReason }, cancelling reverts via refetch. Every
  // other stage is a straight optimistic move + PATCH { stage } (CalendarView's
  // pattern), reconciled by refreshAffected().
  const pipelineMoveStage = async (key, toStage, card) => {
    optimisticMove(key, toStage);
    if (toStage === 'lost') {
      // Card is already optimistically in Lost; the prompt confirms (PATCH) or
      // cancels (revert via refetch), so we don't need the prior stage here.
      setLostDlg({ open: true, target: { companyKey: key, name: card?.name || key } });
      return;
    }
    try {
      await patchCompany(key, { stage: toStage });
      flash(`${card?.name || 'Deal'} → ${stageMeta(toStage).label}`);
    } catch (_) {
      loadPipeline(pipeQuery, pipeTag); // revert the optimistic move
      return;
    }
    refreshAffected();
  };

  const submitLost = async (body) => {
    const t = lostDlg.target;
    if (!t) return;
    await patchCompany(t.companyKey, body); // { stage: 'lost', lostReason }
    setLostDlg({ open: false, target: null }); // success → close without reverting
    flash(`${t.name} marked lost.`);
    refreshAffected();
  };

  // Cancelling the lost prompt aborts the move — revert the optimistic shuffle.
  const cancelLost = () => {
    setLostDlg({ open: false, target: null });
    loadPipeline(pipeQuery, pipeTag);
  };

  // Detail field edit → PATCH a single whitelisted field, then refresh detail
  // (and lists, since stage/area/etc. change list rows).
  const patchDetailField = async (patch) => {
    if (!detail?.client) return;
    await patchCompany(detail.client.companyKey, patch);
    refreshAffected();
  };

  // Distinct tags across the loaded company set — feeds the tag-filter selects on
  // both Companies and Pipeline so the owner picks from tags that actually exist.
  const tagOptions = React.useMemo(() => {
    const set = new Set();
    (clients || []).forEach((c) => (c.tags || []).forEach((t) => { if (t) set.add(t); }));
    (pipeline.groups || []).forEach((g) => (g.clients || []).forEach((c) => (c.tags || []).forEach((t) => { if (t) set.add(t); })));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients, pipeline]);

  // Dead / no-follow-up archive candidates, derived from the loaded Companies
  // set. A candidate is a lead that's parked (lost/dormant) OR an early-funnel
  // lead with no next step (lead/contacted + no nextFollowUp). We deliberately
  // EXCLUDE won/customer (those are real customers, never "dead") and any
  // quoting/sampling deal that's just missing a date — so the owner is never
  // offered an active customer to archive. The server also refuses to archive
  // order-bearing records unless forced, as a backstop. (The list endpoint
  // already excludes archived records.)
  const deadCandidates = React.useMemo(() => {
    const PARKED = ['lost', 'dormant'];
    const EARLY = ['lead', 'contacted'];
    return (cleanupClients || [])
      .filter((c) => PARKED.includes(c.stage) || (EARLY.includes(c.stage) && !c.nextFollowUp))
      .sort((a, b) => (a.companyName || a.companyKey).localeCompare(b.companyName || b.companyKey));
  }, [cleanupClients]);

  // ── Render ────────────────────────────────────────────────────────────────
  const renderView = () => {
    if (openKey) {
      return (
        <CompanyDetail
          data={detail}
          loading={detailLoading}
          onBack={() => setOpenKey(null)}
          onPatch={patchDetailField}
          onLog={openLogForDetail}
          onDeleteLog={(entryId) => detail?.client && deleteLogEntry(detail.client.companyKey, entryId)}
          onArchive={() => detail?.client && archiveOne(detail.client.companyKey)}
        />
      );
    }
    switch (view) {
      case 'dashboard':
        return (
          <DashboardView
            data={dashboard} loading={dashboardLoading}
            onOpen={openCompany}
            onLog={(item) => openLog({ companyKey: item.companyKey, name: item.name, nextFollowUp: null })}
            onReschedule={(item) => openResched({ companyKey: item.companyKey, name: item.name, nextFollowUp: null })}
          />
        );
      case 'today':
        return (
          <TodayView
            summary={today.summary} rows={today.rows} loading={todayLoading}
            onOpen={openCompany}
            onLog={(row) => openLog({ companyKey: row.companyKey, name: row.name, nextFollowUp: row.nextFollowUp })}
            onReschedule={(row) => openResched({ companyKey: row.companyKey, name: row.name, nextFollowUp: row.nextFollowUp })}
          />
        );
      case 'pipeline':
        return (
          <PipelineView
            groups={pipeline.groups} summary={pipeline.summary} probability={pipeline.probability}
            loading={pipelineLoading}
            query={pipeQuery} onQueryChange={setPipeQuery}
            tag={pipeTag} onTagChange={setPipeTag} tagOptions={tagOptions}
            onOpen={openCompany}
            onMoveStage={pipelineMoveStage}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            events={calEvents} loading={calLoading} cursor={calCursor}
            onCursorChange={setCalCursor}
            onOpen={openCompany}
            onReschedule={calendarReschedule}
          />
        );
      case 'companies':
        return (
          <CompaniesView
            clients={clients} loading={companiesLoading}
            query={query} onQueryChange={setQuery}
            stage={stageFilter} onStageChange={setStageFilter}
            tag={tagFilter} onTagChange={setTagFilter} tagOptions={tagOptions}
            onOpen={openCompany}
          />
        );
      case 'cleanup':
        return (
          <CleanupView
            duplicates={duplicates} duplicatesLoading={duplicatesLoading}
            deadCandidates={deadCandidates} deadLoading={cleanupClientsLoading}
            onMerge={mergeCompany}
            onArchive={archiveCompanies}
            onRefresh={() => { loadDuplicates(); loadCleanupClients(); }}
          />
        );
      case 'import':
        return (
          <ImportView
            onPreview={importPreview}
            onCommit={importCommit}
            onImported={() => { refreshAffected(); flash('Lists refreshed with your import.'); }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg }}>
      {/* Slim full-width header — matches the Field Map tool chrome. */}
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
          <MuiTypography sx={{ ...mono, fontSize: 12, color: D.green, fontWeight: 700 }}>CRM</MuiTypography>
          <Box sx={{ flexGrow: 1 }} />
        </Stack>

        {/* Sub-nav — hidden while a company detail is open (its own back button
            returns to the list it came from). */}
        {!openKey && (
          <Stack direction="row" spacing={0.5} sx={{ px: { xs: 1, sm: 2 }, pb: 0, overflowX: 'auto',
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
        )}
      </Box>

      {/* Body — the Kanban board gets a wider canvas (its columns scroll
          horizontally); every other view keeps the comfortable reading column. */}
      <Box sx={{
        maxWidth: (view === 'pipeline' && !openKey) ? 1440 : 1080,
        mx: 'auto', px: { xs: 1.5, sm: 2.5 }, py: { xs: 2, sm: 3 },
      }}>
        {renderView()}
      </Box>

      {/* Shared write modals */}
      <LogTouchDialog
        open={logDlg.open}
        onClose={() => setLogDlg({ open: false, target: null })}
        onSubmit={submitLog}
        companyName={logDlg.target?.name}
      />
      <RescheduleDialog
        open={reschedDlg.open}
        onClose={() => setReschedDlg({ open: false, target: null })}
        onSubmit={submitReschedule}
        companyName={reschedDlg.target?.name}
        current={reschedDlg.target?.nextFollowUp}
      />
      <LostReasonDialog
        open={lostDlg.open}
        onClose={cancelLost}
        onSubmit={submitLost}
        companyName={lostDlg.target?.name}
      />

      <Snackbar
        open={toast.open} autoHideDuration={3200} onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.sev} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
