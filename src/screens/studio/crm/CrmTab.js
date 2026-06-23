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
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import config from '../../../config.json';
import { D, accentBar, mono } from '../_shared';
import { dayKey } from './_crm';
import { LogTouchDialog, RescheduleDialog } from './CrmDialogs';
import TodayView from './TodayView';
import CalendarView from './CalendarView';
import CompaniesView from './CompaniesView';
import CompanyDetail from './CompanyDetail';
import ImportView from './ImportView';

const base = `${config.backendUrl}/api/crm`;

const NAV = [
  { id: 'today',     label: 'Today',     Icon: TodayOutlinedIcon },
  { id: 'calendar',  label: 'Calendar',  Icon: CalendarMonthOutlinedIcon },
  { id: 'companies', label: 'Companies', Icon: PeopleAltOutlinedIcon },
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

  const [view, setView] = React.useState('today');
  const [openKey, setOpenKey] = React.useState(null); // company detail overlay (null = closed)

  // ── Per-view data ────────────────────────────────────────────────────────
  const [today, setToday] = React.useState({ summary: {}, rows: [] });
  const [todayLoading, setTodayLoading] = React.useState(true);

  const [calCursor, setCalCursor] = React.useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [calEvents, setCalEvents] = React.useState([]);
  const [calLoading, setCalLoading] = React.useState(true);

  const [clients, setClients] = React.useState([]);
  const [companiesLoading, setCompaniesLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState('all');

  const [detail, setDetail] = React.useState(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // Shared dialog state. `target` carries the companyKey + display name + the
  // current nextFollowUp so the dialogs can prefill / label without a refetch.
  const [logDlg, setLogDlg] = React.useState({ open: false, target: null });
  const [reschedDlg, setReschedDlg] = React.useState({ open: false, target: null });

  const [toast, setToast] = React.useState({ open: false, msg: '', sev: 'success' });
  const flash = React.useCallback((msg, sev = 'success') => setToast({ open: true, msg, sev }), []);

  // ── Fetchers ─────────────────────────────────────────────────────────────
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

  const loadCompanies = React.useCallback(async (q, stage) => {
    setCompaniesLoading(true);
    try {
      const params = {};
      if (q && q.trim()) params.q = q.trim();
      if (stage && stage !== 'all') params.stage = stage;
      const res = await axios.get(base, { ...authHdr, params });
      setClients(res.data?.clients || []);
    } catch (e) {
      flash('Could not load companies.', 'error');
    } finally { setCompaniesLoading(false); }
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

  // ── Effects: load each view's data lazily on first entry, refetch on deps ──
  React.useEffect(() => { loadToday(); }, [loadToday]);
  React.useEffect(() => { loadCalendar(calCursor); }, [calCursor, loadCalendar]);

  // Companies: debounce the search box so we don't fire a request per keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => loadCompanies(query, stageFilter), 280);
    return () => clearTimeout(id);
  }, [query, stageFilter, loadCompanies]);

  // Detail: (re)load whenever the open company changes.
  React.useEffect(() => {
    if (openKey) loadDetail(openKey);
    else setDetail(null);
  }, [openKey, loadDetail]);

  // After any write, refresh whatever's currently visible + the open detail so
  // counts/badges/timelines stay truthful without a blanket refetch of all four.
  const refreshAffected = React.useCallback(() => {
    loadToday();
    loadCalendar(calCursor);
    loadCompanies(query, stageFilter);
    if (openKey) loadDetail(openKey);
  }, [loadToday, loadCalendar, calCursor, loadCompanies, query, stageFilter, openKey, loadDetail]);

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

  const importCsv = React.useCallback(async (csv) => {
    const res = await axios.post(`${base}/import`, { csv }, authHdr);
    return res.data; // { created, updated, skipped, total }
  }, [authHdr]);

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

  // Detail field edit → PATCH a single whitelisted field, then refresh detail
  // (and lists, since stage/area/etc. change list rows).
  const patchDetailField = async (patch) => {
    if (!detail?.client) return;
    await patchCompany(detail.client.companyKey, patch);
    refreshAffected();
  };

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
        />
      );
    }
    switch (view) {
      case 'today':
        return (
          <TodayView
            summary={today.summary} rows={today.rows} loading={todayLoading}
            onOpen={openCompany}
            onLog={(row) => openLog({ companyKey: row.companyKey, name: row.name, nextFollowUp: row.nextFollowUp })}
            onReschedule={(row) => openResched({ companyKey: row.companyKey, name: row.name, nextFollowUp: row.nextFollowUp })}
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
            onOpen={openCompany}
          />
        );
      case 'import':
        return <ImportView onImport={importCsv} onImported={() => { refreshAffected(); flash('Lists refreshed with your import.'); }} />;
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

      {/* Body */}
      <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 1.5, sm: 2.5 }, py: { xs: 2, sm: 3 } }}>
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
