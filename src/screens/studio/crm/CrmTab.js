// src/screens/studio/crm/CrmTab.js
// The CRM — Joint Printing's sales command center, built on the unified Client
// record (one company per companyKey). Full-viewport Studio tool (like Field
// Map): its own slim header + an internal sub-nav across five views:
//
//   Today      → /api/crm/today      the daily call list (default)
//   Calendar   → /api/crm/calendar   month grid of follow-ups, drag to reschedule
//   Companies  → /api/crm            searchable / filterable list
//   (Detail)   → /api/crm/:key       one company, opened from any list
//
// This component owns ALL data + transport so the view components stay
// presentational and the write paths (log a touch, reschedule, field edit)
// invalidate the right caches in one place. New views (Kanban, a dashboard) slot
// in by adding a NAV entry + a branch in renderView — the data helpers here are
// already shaped for them.

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Button, Snackbar, Alert, Typography as MuiTypography,
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import config from '../../../config.json';
import { D, accentBar, mono } from '../_shared';
import { dayKey, stageMeta } from './_crm';
import { useContextMenu } from '../ContextMenu';
import { buildCompanyMenu, buildFallbackMenu } from '../contextMenuActions';
import { LogTouchDialog, RescheduleDialog, LostReasonDialog } from './CrmDialogs';
import AddCompanyDialog from './AddCompanyDialog';
import CrmSearch from './CrmSearch';
import DashboardView from './DashboardView';
import TodayView from './TodayView';
import CalendarView from './CalendarView';
import CompaniesView from './CompaniesView';
import CompanyDetail from './CompanyDetail';
import PipelineView from './PipelineView';
import CleanupView from './CleanupView';
import ReconcileView from './ReconcileView';

const base = `${config.backendUrl}/api/crm`;

// Primary tab bar — ordered by daily importance. The segmented company book
// (Clients / Active leads / Everyone else) leads as the CRM's home, with the
// daily call queue (Today) right beside it; Pipeline / Calendar / Dashboard
// follow. Clean up / reconcile / archived live in the overflow "•••" menu so
// the main bar stays focused.
const NAV = [
  { id: 'companies', label: 'Clients',   Icon: PeopleAltOutlinedIcon },
  { id: 'today',     label: 'Today',     Icon: TodayOutlinedIcon },
  { id: 'pipeline',  label: 'Pipeline',  Icon: ViewKanbanOutlinedIcon },
  { id: 'calendar',  label: 'Calendar',  Icon: CalendarMonthOutlinedIcon },
  { id: 'dashboard', label: 'Dashboard', Icon: SpaceDashboardOutlinedIcon },
];

// Overflow ("•••") menu — still fully reachable, just tucked out of the daily
// flow: housekeeping tools the owner reaches for occasionally.
const OVERFLOW_NAV = [
  { id: 'reconcile', label: 'Load / reconcile data', Icon: CloudSyncOutlinedIcon },
  { id: 'cleanup',  label: 'Clean up',      Icon: CleaningServicesOutlinedIcon },
  { id: 'archived', label: 'Archived',      Icon: Inventory2OutlinedIcon },
];
const ALL_NAV = [...NAV, ...OVERFLOW_NAV];

// First & last day (YYYY-MM-DD) of the full Sun→Sat grid that contains `month`
// of `year` — the exact window the calendar grid renders, so every visible cell
// (incl. adjacent-month spill days) has its events. Built in UTC to match
// CalendarView's UTC grid (see the date-helper note in _crm.js).
function gridRange(year, month) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const startMs = Date.UTC(year, month, 1 - firstDow);
  return { from: dayKey(new Date(startMs)), to: dayKey(new Date(startMs + 41 * 86400000)) };
}

export default function CrmTab({ token, onBack, initialView }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const { bind: bindMenu, registerFallback } = useContextMenu();

  // The segmented company book leads by default (Clients first); a hub deep-link
  // can request a specific landing view (e.g. 'today') via initialView.
  const [view, setView] = React.useState(
    initialView && ['companies', 'today', 'pipeline', 'calendar', 'dashboard'].includes(initialView)
      ? initialView : 'companies',
  );
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
  const [tagFilter, setTagFilter] = React.useState('all');
  // The active company segment (Clients / Active leads / Everyone else). Client-
  // side over the loaded book, so switching is instant. Defaults to Clients.
  const [segment, setSegment] = React.useState('clients');

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

  // Archived records (recover surface) — loaded lazily when the Archived view is
  // opened, so the soft-delete is genuinely reversible (owner: "nothing deleted").
  const [archived, setArchived] = React.useState([]);
  const [archivedLoading, setArchivedLoading] = React.useState(false);

  // Global search (F) — the command palette + the overflow menu anchor (J).
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [overflowAnchor, setOverflowAnchor] = React.useState(null);

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
  // Add-company dialog (the deduped manual entry point).
  const [addOpen, setAddOpen] = React.useState(false);

  const [toast, setToast] = React.useState({ open: false, msg: '', sev: 'success', action: null });
  const flash = React.useCallback((msg, sev = 'success', action = null) => setToast({ open: true, msg, sev, action }), []);

  // ⌘K / Ctrl-K opens global search from anywhere in the CRM — the Notion reflex.
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Right-click on empty CRM chrome → the global niceties (search ⌘K, back to
  // the Studio hub). Registered while this tool is mounted; cleaned up on unmount
  // so another tool's fallback takes over.
  React.useEffect(() => registerFallback(() => buildFallbackMenu({
    onSearch: () => setSearchOpen(true),
    onBackToHub: onBack,
  })), [registerFallback, onBack]);

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

  // The whole non-archived book (scoped only by search + tag); the segment split
  // (Clients / leads / everyone) is applied client-side in CompaniesView, so
  // switching segments is instant and the counts always reflect the full set.
  const loadCompanies = React.useCallback(async (q, tag) => {
    setCompaniesLoading(true);
    try {
      const params = {};
      if (q && q.trim()) params.q = q.trim();
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

  // Archived records, for the recover surface. ?archived=1 returns ONLY archived.
  const loadArchived = React.useCallback(async () => {
    setArchivedLoading(true);
    try {
      const res = await axios.get(base, { ...authHdr, params: { archived: '1' } });
      setArchived(res.data?.clients || []);
    } catch (e) {
      flash('Could not load archived companies.', 'error');
    } finally { setArchivedLoading(false); }
  }, [authHdr, flash]);

  // Global search transport for the command palette (F). Hits the backend's
  // ?q= global search (company + client + email + phone + tags + contacts, any
  // stage) and hands the rows back to the palette. Errors bubble so the palette
  // can show an empty state without a toast spam.
  const searchCrm = React.useCallback(async (q) => {
    const res = await axios.get(base, { ...authHdr, params: { q } });
    return res.data?.clients || [];
  }, [authHdr]);

  // ── Effects: load each view's data lazily on first entry, refetch on deps ──
  React.useEffect(() => { loadDashboard(); }, [loadDashboard]);
  React.useEffect(() => { loadToday(); }, [loadToday]);
  React.useEffect(() => { loadCalendar(calCursor); }, [calCursor, loadCalendar]);

  // Companies: debounce the search box so we don't fire a request per keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => loadCompanies(query, tagFilter), 280);
    return () => clearTimeout(id);
  }, [query, tagFilter, loadCompanies]);

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

  // Archived: load lazily on first entry to the recover surface.
  React.useEffect(() => {
    if (view === 'archived' && !openKey) loadArchived();
  }, [view, openKey, loadArchived]);

  // After any write, refresh whatever's currently visible + the open detail so
  // counts/badges/timelines stay truthful without a blanket refetch of all views.
  const refreshAffected = React.useCallback(() => {
    loadDashboard();
    loadToday();
    loadCalendar(calCursor);
    loadCompanies(query, tagFilter);
    loadPipeline(pipeQuery, pipeTag);
    if (view === 'cleanup') { loadDuplicates(); loadCleanupClients(); }
    if (view === 'archived') loadArchived();
    if (openKey) loadDetail(openKey);
  }, [loadDashboard, loadToday, loadCalendar, calCursor, loadCompanies, query, tagFilter,
      loadPipeline, pipeQuery, pipeTag, view, loadDuplicates, loadCleanupClients, loadArchived, openKey, loadDetail]);

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

  // Unarchive (restore) ONE card — the undo for archiveOne + the Archived view's
  // per-row restore. Brings it straight back into the working surfaces.
  const unarchiveOne = React.useCallback(async (key, opts = {}) => {
    try {
      await axios.post(`${base}/${encodeURIComponent(key)}/unarchive`, {}, authHdr);
      if (!opts.silent) flash('Restored.');
      refreshAffected();
    } catch (e) {
      flash(e?.response?.data?.message || 'Could not restore that card.', 'error');
      throw e;
    }
  }, [authHdr, flash, refreshAffected]);

  // Archive (soft-delete) THIS one card from its detail page (owner: "fine
  // removing their card"). Soft / reversible; returns to the list after, and the
  // toast carries a one-tap UNDO that unarchives it (reassures it's recoverable).
  const archiveOne = React.useCallback(async (key) => {
    try {
      const res = await axios.post(`${base}/${encodeURIComponent(key)}/archive`, {}, authHdr);
      setOpenKey(null);
      refreshAffected();
      flash('Card archived — recoverable.', 'success', {
        label: 'Undo',
        run: () => unarchiveOne(key),
      });
      return res.data;
    } catch (e) {
      flash(e?.response?.data?.message || 'Could not archive that card.', 'error');
      throw e;
    }
  }, [authHdr, flash, refreshAffected, unarchiveOne]);

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

  // Create a company by hand (the deduped Add-company dialog). Reuses the PATCH
  // /:companyKey upsert (get-or-create by companyKey) — the same path field edits
  // take — so there's no special create endpoint. After it lands, jump straight
  // into the new card so the owner can keep filling it in.
  const createCompany = React.useCallback(async (key, patch) => {
    await patchCompany(key, patch);
    flash('Company added.');
    refreshAffected();
    setOpenKey(key);
  }, [patchCompany, flash, refreshAffected]);

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

  // Per-card PENDING LOCK (race guard): while a card's stage PATCH is in flight,
  // a second drag of the SAME card is ignored — otherwise a fast double-drag can
  // fire two PATCHes whose refetches race and clobber each other (the card snaps
  // back to a stale column). The lock is a ref-backed Set so the guard is
  // synchronous (state would lag the second drop within the same tick).
  const pendingMovesRef = React.useRef(new Set());

  // Pipeline drag-drop: move a card to a new stage. Dropping into Lost is special
  // — we move the card optimistically, then open the reason prompt; submitting
  // PATCHes { stage:'lost', lostReason }, cancelling reverts via refetch. Every
  // other stage is a straight optimistic move + PATCH { stage } (CalendarView's
  // pattern), reconciled by refreshAffected().
  const pipelineMoveStage = async (key, toStage, card) => {
    // Guard: ignore a re-drag of a card whose previous move hasn't settled.
    if (pendingMovesRef.current.has(key)) return;

    optimisticMove(key, toStage);
    if (toStage === 'lost') {
      // Card is already optimistically in Lost; the prompt confirms (PATCH) or
      // cancels (revert via refetch), so we don't need the prior stage here. The
      // lost dialog owns its own busy state, so no pending lock needed here.
      setLostDlg({ open: true, target: { companyKey: key, name: card?.name || key } });
      return;
    }
    pendingMovesRef.current.add(key);
    try {
      await patchCompany(key, { stage: toStage });
      flash(`${card?.name || 'Deal'} → ${stageMeta(toStage).label}`);
    } catch (_) {
      loadPipeline(pipeQuery, pipeTag); // revert the optimistic move
      return;
    } finally {
      pendingMovesRef.current.delete(key);
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

  // ── Right-click menu wiring ───────────────────────────────────────────────
  // Quick "Add tag" from a row's context menu — a tiny prompt that appends one
  // tag (case-insensitive de-dupe) and PATCHes the whole tags array, the same
  // shape the detail TagEditor commits.
  const addTagToCompany = React.useCallback(async (key, currentTags) => {
    const raw = window.prompt('Add a tag');
    const t = (raw || '').trim();
    if (!t) return;
    const existing = Array.isArray(currentTags) ? currentTags : [];
    if (existing.some((x) => String(x).toLowerCase() === t.toLowerCase())) { flash('Already tagged.'); return; }
    try {
      await patchCompany(key, { tags: [...existing, t] });
      flash(`Tagged “${t}”.`);
      refreshAffected();
    } catch (_) { /* patchCompany already flashed */ }
  }, [patchCompany, flash, refreshAffected]);

  // Set stage straight from a row (any view). Reuses pipelineMoveStage so the
  // Lost-reason prompt + optimistic board update + PATCH path are identical to a
  // drag — from non-board views the optimistic shuffle is just a harmless no-op.
  const setStageQuick = React.useCallback((key, stage, card) => {
    pipelineMoveStage(key, stage, card);
  // pipelineMoveStage is a stable closure over refs/setters; intentionally not
  // listed to avoid re-creating this every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The shared handler bundle every company surface reuses. Memoised so the bound
  // onContextMenu prop is stable; the item list itself is built lazily per
  // right-click (so handlers always close over fresh data).
  const companyMenuHandlers = React.useMemo(() => ({
    onOpen: openCompany,
    onLog: openLog,
    onReschedule: openResched,
    onSetStage: setStageQuick,
    onAddTag: addTagToCompany,
    onArchive: archiveOne,
    flash,
  // openCompany/openLog/openResched/archiveOne are recreated each render (plain
  // fns) but only ever do setState — safe to omit; setStageQuick/addTagToCompany
  // /flash are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [setStageQuick, addTagToCompany, flash]);

  // bindCompany(record) → props an actionable company row/card spreads onto its
  // container. Built at right-click time from the live record.
  const bindCompany = React.useCallback(
    (rec) => bindMenu(() => buildCompanyMenu(rec, companyMenuHandlers)),
    [bindMenu, companyMenuHandlers],
  );

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
            onArchive={(item) => archiveOne(item.companyKey)}
            onGoToday={() => setView('today')}
          />
        );
      case 'today':
        return (
          <TodayView
            summary={today.summary} rows={today.rows} loading={todayLoading}
            onOpen={openCompany}
            onLog={(row) => openLog({ companyKey: row.companyKey, name: row.name, nextFollowUp: row.nextFollowUp })}
            onReschedule={(row) => openResched({ companyKey: row.companyKey, name: row.name, nextFollowUp: row.nextFollowUp })}
            bindCompany={bindCompany}
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
            bindCompany={bindCompany}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            events={calEvents} loading={calLoading} cursor={calCursor}
            onCursorChange={setCalCursor}
            onOpen={openCompany}
            onReschedule={calendarReschedule}
            onPickReschedule={(ev) => openResched({ companyKey: ev.companyKey, name: ev.name, nextFollowUp: ev.nextFollowUp })}
            bindCompany={bindCompany}
          />
        );
      case 'companies':
        return (
          <CompaniesView
            clients={clients} loading={companiesLoading}
            query={query} onQueryChange={setQuery}
            tag={tagFilter} onTagChange={setTagFilter} tagOptions={tagOptions}
            segment={segment} onSegmentChange={setSegment}
            onAddCompany={() => setAddOpen(true)}
            onOpen={openCompany}
            bindCompany={bindCompany}
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
      case 'reconcile':
        return (
          <ReconcileView
            token={token}
            onApplied={() => { refreshAffected(); flash('Data loaded. Your CRM is reconciled.'); }}
          />
        );
      case 'archived':
        return (
          <CompaniesView
            archived
            clients={archived} loading={archivedLoading}
            onOpen={openCompany}
            onUnarchive={(key) => unarchiveOne(key)}
          />
        );
      default:
        return null;
    }
  };

  // Label for the current view (header context line) — covers overflow views too.
  const currentNav = ALL_NAV.find((n) => n.id === view);

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
          {currentNav && (
            <>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: D.faint, display: { xs: 'none', sm: 'block' } }} />
              <MuiTypography sx={{ ...mono, fontSize: 12, color: D.faint, fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
                {currentNav.label}
              </MuiTypography>
            </>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {/* Global search — the Notion-style command palette (⌘K). Reachable from
              every view, including Calendar (owner's specific ask). */}
          <Button
            onClick={() => setSearchOpen(true)} startIcon={<SearchIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', color: D.muted, fontWeight: 600, fontSize: 12.5,
              border: `1px solid ${D.line}`, borderRadius: 999, px: { xs: 1.25, sm: 1.75 }, py: 0.5,
              minWidth: 0,
              '&:hover': { color: D.green, borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.06)' } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Search</Box>
            <Box component="span" sx={{ ...mono, ml: { sm: 1 }, fontSize: 10.5, color: D.faint,
              border: `1px solid ${D.line}`, borderRadius: 0.75, px: 0.6, py: 0.1,
              display: { xs: 'none', md: 'inline' } }}>
              ⌘K
            </Box>
          </Button>
        </Stack>

        {/* Sub-nav — hidden while a company detail is open (its own back button
            returns to the list it came from). */}
        {!openKey && (
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
            {/* Overflow ("•••") — Clean up / Archived. Highlighted when an
                overflow view is active so the owner sees where they are. */}
            <Tooltip title="More — Clean up, Archived">
              <IconButton
                onClick={(e) => setOverflowAnchor(e.currentTarget)}
                size="small"
                sx={{
                  ml: 0.25, my: 0.5, borderRadius: 1.5,
                  color: OVERFLOW_NAV.some((n) => n.id === view) ? D.green : D.muted,
                  border: `1px solid ${OVERFLOW_NAV.some((n) => n.id === view) ? D.lineHi : 'transparent'}`,
                  '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.06)' },
                }}
              >
                <MoreHorizIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>

      {/* Overflow menu — housekeeping views, still one tap away */}
      <Menu
        anchorEl={overflowAnchor} open={Boolean(overflowAnchor)} onClose={() => setOverflowAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`,
          backgroundImage: 'none', borderRadius: 2, minWidth: 200, mt: 0.5 } }}
      >
        {OVERFLOW_NAV.map((n) => {
          const Icon = n.Icon;
          const active = view === n.id;
          return (
            <MenuItem
              key={n.id}
              onClick={() => { setView(n.id); setOverflowAnchor(null); }}
              sx={{ py: 1, color: active ? D.green : D.text,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.06)' } }}
            >
              <ListItemIcon sx={{ color: active ? D.green : D.muted, minWidth: 34 }}>
                <Icon sx={{ fontSize: 19 }} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }}>
                {n.label}
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>

      {/* Body — the Kanban board gets a wider canvas (its columns scroll
          horizontally); every other view keeps the comfortable reading column.
          data-ctx-chrome opts the empty body space into the global right-click
          fallback (search / back-to-hub) without hijacking text or bound rows. */}
      <Box data-ctx-chrome sx={{
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

      {/* Add a company — deduped manual entry (suggests existing matches first) */}
      <AddCompanyDialog
        open={addOpen}
        token={token}
        onClose={() => setAddOpen(false)}
        onCreate={createCompany}
        onOpenExisting={openCompany}
      />

      {/* Global search command palette */}
      <CrmSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSearch={searchCrm}
        onOpen={openCompany}
        bindCompany={bindCompany}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.action ? 6000 : 3200}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.sev} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ borderRadius: 2, fontWeight: 600, alignItems: 'center' }}
          action={toast.action ? (
            <Button
              size="small"
              onClick={() => { toast.action.run(); setToast((t) => ({ ...t, open: false })); }}
              sx={{ color: 'inherit', fontWeight: 800, textTransform: 'none',
                border: '1px solid rgba(255,255,255,0.5)', borderRadius: 999, px: 1.5, py: 0.1 }}
            >
              {toast.action.label}
            </Button>
          ) : undefined}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
