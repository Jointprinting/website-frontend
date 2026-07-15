// src/screens/studio/LookbooksTab.js
// Lookbooks — the owner-side builder for the curated, shareable mockup
// galleries a client reviews (backend: controllers/lookbooks.js). Two views:
//
//   LIST    — every lookbook (title, company, pages, status, unseen-feedback
//             badge) + NEW LOOKBOOK. `initialCompanyKey` prefilters to one
//             company (the CRM / Signals deep-link entry).
//   EDITOR  — title/subtitle/layout, the ordered page grid (caption, reorder,
//             remove), ADD MOCKUPS from the library, SHARE (mints the client
//             link at /lookbook/:id?token=…), EXPORT PDF (the server
//             generator — same layout vocabulary), and the client-feedback
//             panel with MARK ALL SEEN.
//
// Edits autosave via a debounced PATCH (single-flight, sequence-tracked —
// the JpwSitesTab idiom) so the owner never hunts for a Save button. Archive
// is the delete (house rule: nothing hard-deletes).

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, Button, TextField, MenuItem, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  CircularProgress, InputAdornment,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import AddIcon from '@mui/icons-material/Add';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import IosShareIcon from '@mui/icons-material/IosShare';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import config from '../../config.json';
import {
  D, accentBar, eyebrow, mono, dropInput, dropPrimaryBtn, dropGhostBtn,
  fmtRelative, useMobileFullScreen, ARCHIVE_TTL_DAYS, purgeDaysLeft,
} from './_shared';
import { confirmDialog } from './_dialog';
import JpLoader from '../../common/JpLoader';

const API = `${config.backendUrl}/api/lookbooks`;
// The picker reads the same summary feed the library grid uses (thumbnail,
// client, mockup #, hasBack) — R2 URLs ship as-is, legacy backs collapse to a flag.
const LIB_API = `${config.backendUrl}/api/studio/library/mockups?summary=1`;
// PDF export stays on the existing server generator; the builder maps page
// remoteIds → library _ids and calls it directly.
const PDF_API = `${config.backendUrl}/api/studio/lookbook/pdf`;

// Status vocabulary — mirrors the backend Lookbook status enum (models/Lookbook.js).
const LB_STATUS = {
  draft:    { label: 'Draft',    color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
  shared:   { label: 'Shared',   color: D.green,   bg: 'rgba(74,222,128,0.14)' },
  archived: { label: 'Archived', color: D.amber,   bg: 'rgba(251,191,36,0.12)' },
};
const lbStatus = (s) => LB_STATUS[s] || LB_STATUS.draft;

// Layout vocabulary — mirrors the backend Lookbook layout enum ('auto' lets the
// PDF generator's pickLayout decide from the page count).
const LAYOUTS = [
  { value: 'auto',      label: 'Auto — page count decides' },
  { value: 'editorial', label: 'Editorial — big & roomy' },
  { value: 'grid',      label: 'Grid — dense contact sheet' },
];

// Theme = the DEFAULT palette the client first sees on the share link (they can
// still flip it live in the viewer — mirrors LookbookView.js THEMES). A swatch
// gradient previews each: page color → accent.
const THEME_SWATCHES = [
  { value: 'paper',    label: 'Paper',    bg: '#faf9f6', accent: '#15803d' },
  { value: 'summer',   label: 'Summer',   bg: '#fef5e7', accent: '#e8622a' },
  { value: 'sand',     label: 'Sand',     bg: '#efe9dd', accent: '#9a5726' },
  { value: 'charcoal', label: 'Charcoal', bg: '#17191d', accent: '#34d17f' },
  { value: 'forest',   label: 'Forest',   bg: '#0b1e12', accent: '#5fe39b' },
  { value: 'winter',   label: 'Winter',   bg: '#0e1a2b', accent: '#5cc7ee' },
];

// Same slug matching the mockup pickers use, so "Bleu Leaf Dispensary" still
// finds a library item named "BleuLeafDispensary_Merch".
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function StatusChip({ status }) {
  const meta = lbStatus(status);
  return (
    <Chip label={meta.label} size="small" sx={{
      bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: 11,
      height: 22, border: `1px solid ${meta.color}33`,
    }} />
  );
}

// Debounced-autosave readout — quiet mono text, same as the Websites editor.
function SaveIndicator({ state, onRetry }) {
  const map = {
    dirty:  { txt: 'Editing…', color: D.faint },
    saving: { txt: 'Saving…',  color: D.amber },
    saved:  { txt: '✓ Saved',  color: D.green },
    error:  { txt: 'Save failed — retry', color: '#f87171' },
  };
  const m = map[state];
  if (!m) return null;
  return (
    <Typography
      onClick={state === 'error' ? onRetry : undefined}
      sx={{
        ...mono, fontSize: 11.5, fontWeight: 700, color: m.color, whiteSpace: 'nowrap',
        cursor: state === 'error' ? 'pointer' : 'default',
        ...(state === 'error' ? { '&:hover': { textDecoration: 'underline' } } : {}),
      }}
    >
      {m.txt}
    </Typography>
  );
}

// Hairline on/off pill for the presentation toggles (back sides / labels).
function TogglePill({ label, on, onClick }) {
  return (
    <Button onClick={onClick} size="small" disableRipple
      startIcon={on ? <CheckIcon sx={{ fontSize: 14 }} /> : null}
      sx={{
        ...dropGhostBtn, px: 1.75, py: 0.5, fontSize: 12, whiteSpace: 'nowrap',
        ...(on ? {
          color: D.green, borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.08)',
          '&:hover': { borderColor: D.green, bgcolor: 'rgba(74,222,128,0.12)' },
        } : {}),
      }}>
      {label}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  New Lookbook dialog — company + optional title, that's it
// ─────────────────────────────────────────────────────────────────────────────
function NewLookbookDialog({ open, onClose, onCreate, busy, initialCompany }) {
  const fullScreen = useMobileFullScreen();
  const [company, setCompany] = React.useState('');
  const [title, setTitle] = React.useState('');
  React.useEffect(() => {
    if (open) { setCompany(initialCompany || ''); setTitle(''); }
  }, [open, initialCompany]);
  const canCreate = company.trim().length > 0 && !busy;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: D.panel, color: D.text, borderRadius: fullScreen ? 0 : 3, border: `1px solid ${D.line}` } }}>
      <DialogTitle sx={{ borderBottom: `1px solid ${D.line}` }}>
        <Typography component="span" sx={{ fontWeight: 800, fontSize: 17, display: 'block' }}>New lookbook</Typography>
        <Typography variant="caption" sx={{ color: D.muted }}>
          Name the client, then curate their mockups and share one link.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: '18px !important' }}>
        <Stack spacing={1.75}>
          <TextField
            label="Company" placeholder="Bleu Leaf Dispensary" value={company}
            onChange={(e) => setCompany(e.target.value)} size="small" fullWidth sx={dropInput}
            autoFocus disabled={busy}
          />
          <TextField
            label="Title (optional)" placeholder={`${company.trim() || 'Company'} Lookbook`} value={title}
            onChange={(e) => setTitle(e.target.value)} size="small" fullWidth sx={dropInput}
            disabled={busy}
            onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) onCreate({ companyName: company.trim(), title: title.trim() }); }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${D.line}`, px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none', color: D.muted, '&:hover': { color: D.text } }}>
          Cancel
        </Button>
        <Button
          onClick={() => onCreate({ companyName: company.trim(), title: title.trim() })}
          disabled={!canCreate} variant="contained" sx={{ ...dropPrimaryBtn, px: 2.5 }}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: D.ink }} /> : <AddIcon />}
        >
          Create &amp; open
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Add-mockups picker — the library summary grid, search by name / client
// ─────────────────────────────────────────────────────────────────────────────
// Click appends the mockup as the last page (and it drops out of the grid,
// since already-added remoteIds are excluded) — add a whole run in one open.
function AddMockupsDialog({ open, onClose, loading, library, excluded, onAdd, pageCount }) {
  const fullScreen = useMobileFullScreen();
  const [q, setQ] = React.useState('');
  React.useEffect(() => { if (open) setQ(''); }, [open]);

  const shown = React.useMemo(() => {
    const list = (library || []).filter((m) => m && m.remoteId && !excluded.has(m.remoteId));
    const needle = slug(q);
    if (!needle) return list;
    return list.filter((m) =>
      slug(`${m.client || ''} ${m.name || ''} ${m.pageState?.mockupNum || ''}`).includes(needle));
  }, [library, excluded, q]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: D.panel, color: D.text, borderRadius: fullScreen ? 0 : 3, border: `1px solid ${D.line}` } }}>
      <DialogTitle sx={{ borderBottom: `1px solid ${D.line}` }}>
        <Typography component="span" sx={{ fontWeight: 800, fontSize: 17, display: 'block' }}>Add mockups</Typography>
        <Typography variant="caption" sx={{ color: D.muted }}>
          Click a mockup to append it as a page — keep clicking to build the run.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <TextField
          value={q} onChange={(e) => setQ(e.target.value)} size="small" fullWidth autoFocus={!fullScreen}
          placeholder="Search by name, client, or mockup #…" sx={{ ...dropInput, mb: 1.5 }}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: D.faint }} /></InputAdornment>
          ) }}
        />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <JpLoader size={52} label="Loading library…" tone="dark" />
          </Box>
        ) : shown.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: D.muted }}>
            <DesignServicesIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
            <Typography sx={{ fontSize: 13 }}>
              {q ? 'No mockups match that search.' : 'Nothing left to add — every library mockup is already a page.'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 1 }}>
            {shown.map((m) => {
              const num = m.pageState?.mockupNum;
              return (
                <Box key={m._id} onClick={() => onAdd(m)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(m); } }}
                  sx={{
                    cursor: 'pointer', borderRadius: 1.5, overflow: 'hidden',
                    border: `1px solid ${D.line}`, bgcolor: D.inset,
                    transition: 'border-color 0.12s ease, transform 0.12s ease',
                    '&:hover': { borderColor: D.lineHi, transform: 'translateY(-2px)' },
                    '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: 2 },
                  }}>
                  {m.thumbnail ? (
                    <Box component="img" src={m.thumbnail} alt={m.name} loading="lazy"
                      sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <Box sx={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DesignServicesIcon sx={{ color: D.faint, fontSize: 28, opacity: 0.4 }} />
                    </Box>
                  )}
                  <Box sx={{ px: 0.9, py: 0.7 }}>
                    {num && (
                      <Typography sx={{ ...mono, color: D.green, fontSize: 9.5, fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {num}
                      </Typography>
                    )}
                    <Typography sx={{ color: D.text, fontSize: 11, fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name || 'Untitled'}
                    </Typography>
                    {m.client && (
                      <Typography sx={{ color: D.faint, fontSize: 10,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.client}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${D.line}`, px: 3, py: 2 }}>
        <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5, flex: 1 }}>
          {pageCount} page{pageCount === 1 ? '' : 's'} in the lookbook
        </Typography>
        <Button onClick={onClose} variant="contained" sx={{ ...dropPrimaryBtn, px: 2.5 }}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main tab
// ─────────────────────────────────────────────────────────────────────────────
export default function LookbooksTab({ token, onBack, onNavigate, initialCompanyKey }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [rows, setRows] = React.useState([]);
  const [listLoading, setListLoading] = React.useState(true);
  const [listErr, setListErr] = React.useState('');
  // Deep-link prefilter (a CRM card / Signals row landed here for ONE company).
  const [filterKey, setFilterKey] = React.useState(initialCompanyKey || null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [snack, setSnack] = React.useState(null);
  const flash = (msg, severity = 'success') => setSnack({ msg, severity });

  const [newOpen, setNewOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  // Editor state. `draft` is the working copy the form renders from; `byRid`
  // resolves each page's remoteId to its library tile (image, name, _id).
  const [openId, setOpenId] = React.useState(null);
  const [lb, setLb] = React.useState(null);
  const [lbLoading, setLbLoading] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const [byRid, setByRid] = React.useState({});
  const [saveState, setSaveState] = React.useState('idle'); // idle|dirty|saving|saved|error
  const draftRef = React.useRef(null);

  // Library summary for the picker — loaded once, on first open.
  const [library, setLibrary] = React.useState([]);
  const [libLoaded, setLibLoaded] = React.useState(false);
  const [libLoading, setLibLoading] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const [shareBusy, setShareBusy] = React.useState(false);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [archiveBusy, setArchiveBusy] = React.useState(false);
  const [seenBusy, setSeenBusy] = React.useState(false);

  // ── List ────────────────────────────────────────────────────────────────
  const loadList = React.useCallback(async (key = filterKey, archived = showArchived) => {
    setListLoading(true);
    setListErr('');
    try {
      const params = {};
      if (key) params.companyKey = key;
      if (archived) params.archived = 'true';
      const { data } = await axios.get(API, { ...authHdr, params });
      setRows(Array.isArray(data) ? data.filter(Boolean) : []);
    } catch (e) {
      setListErr(e.response?.data?.message || 'Could not load lookbooks — is the backend awake?');
    } finally {
      setListLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHdr, filterKey, showArchived]);
  React.useEffect(() => { loadList(); }, [loadList]);

  const clearFilter = () => { setFilterKey(null); };
  const toggleArchived = () => { setShowArchived((v) => !v); };

  const createLookbook = async ({ companyName, title }) => {
    setCreating(true);
    try {
      const { data } = await axios.post(API, { companyName, title }, authHdr);
      setNewOpen(false);
      if (data?.lookbook?._id) setOpenId(data.lookbook._id);
    } catch (e) {
      flash(e.response?.data?.message || 'Create failed.', 'error');
    } finally {
      setCreating(false);
    }
  };

  // ── Editor load ─────────────────────────────────────────────────────────
  const draftFrom = (doc) => ({
    title: doc.title || '',
    subtitle: doc.subtitle || '',
    projectNumber: doc.projectNumber || '',
    layout: doc.layout || 'auto',
    showBack: doc.showBack !== false,
    showLabels: doc.showLabels !== false,
    theme: doc.theme || 'paper',
    knockout: !!doc.knockout,
    pages: (doc.mockups || []).map((m) => ({ remoteId: m.remoteId, caption: m.caption || '' })),
  });
  const foldTiles = (map, tiles) => {
    const next = { ...map };
    (tiles || []).forEach((t) => { if (t && t.remoteId) next[t.remoteId] = t; });
    return next;
  };

  // Autosave plumbing (600ms debounce, single-flight, sequence-tracked) —
  // same guarantees as the Websites editor: PATCHes never land out of order,
  // nothing re-sends after a clean flush, and closing waits for the flush.
  const saveTimer = React.useRef(null);
  const editSeq = React.useRef(0);
  const savedSeq = React.useRef(0);
  const inFlightRef = React.useRef(Promise.resolve(true));

  React.useEffect(() => {
    if (!openId) return undefined;
    let cancelled = false;
    (async () => {
      setLbLoading(true);
      try {
        const { data } = await axios.get(`${API}/${openId}`, authHdr);
        if (cancelled) return;
        setLb(data.lookbook);
        setByRid(foldTiles({}, data.tiles));
        const d = draftFrom(data.lookbook);
        setDraft(d);
        draftRef.current = d;
        editSeq.current = 0;
        savedSeq.current = 0;
        setSaveState('idle');
      } catch (e) {
        if (!cancelled) { flash(e.response?.data?.message || 'Lookbook load failed.', 'error'); setOpenId(null); }
      } finally {
        if (!cancelled) setLbLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, authHdr]);

  const persist = React.useCallback((d, seq) => {
    setSaveState('saving');
    const body = {
      title: d.title, subtitle: d.subtitle, projectNumber: d.projectNumber,
      layout: d.layout, showBack: d.showBack, showLabels: d.showLabels,
      theme: d.theme, knockout: d.knockout,
      mockups: d.pages.map((p) => ({ remoteId: p.remoteId, caption: p.caption })),
    };
    const run = inFlightRef.current.then(async () => {
      try {
        const { data } = await axios.patch(`${API}/${openId}`, body, authHdr);
        if (data?.lookbook) setLb((prev) => ({ ...(prev || {}), ...data.lookbook }));
        if (Array.isArray(data?.tiles)) setByRid((m) => foldTiles(m, data.tiles));
        savedSeq.current = Math.max(savedSeq.current, seq);
        return true;
      } catch (e) {
        return false;
      }
    });
    inFlightRef.current = run;
    return run.then((ok) => {
      // Only the LATEST save drives the indicator — and keystrokes still
      // sitting in the debounce window (editSeq ahead of this run) keep it on
      // Editing…/Saving… instead of flashing a false "Saved" under new edits.
      if (inFlightRef.current === run && editSeq.current === seq) setSaveState(ok ? 'saved' : 'error');
      return ok;
    });
  }, [authHdr, openId]);

  const queueSave = React.useCallback((next) => {
    setDraft(next);
    draftRef.current = next;
    setSaveState('dirty');
    editSeq.current += 1;
    const seq = editSeq.current;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      persist(next, seq);
    }, 600);
  }, [persist]);

  // Push any pending edit NOW and wait for the chain — share/PDF/close all
  // flush first so what ships is exactly what's on screen.
  const flushSave = React.useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (editSeq.current > savedSeq.current) return persist(draftRef.current, editSeq.current);
    return inFlightRef.current;
  }, [persist]);

  const closeEditor = async () => {
    const ok = await flushSave();
    if (!ok) { flash('Save failed — check the connection before leaving.', 'error'); return; }
    setOpenId(null);
    setLb(null);
    setDraft(null);
    loadList();
  };

  const set = (k) => (v) => queueSave({ ...draftRef.current, [k]: v });
  const setPages = (pages) => queueSave({ ...draftRef.current, pages });

  const movePage = (i, dir) => {
    const pages = draftRef.current.pages;
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const next = pages.slice();
    const [pg] = next.splice(i, 1);
    next.splice(j, 0, pg);
    setPages(next);
  };
  const removePage = (i) => setPages(draftRef.current.pages.filter((_, idx) => idx !== i));
  const setCaption = (i, v) => setPages(draftRef.current.pages.map((p, idx) => (idx === i ? { ...p, caption: v } : p)));

  // ── Picker ──────────────────────────────────────────────────────────────
  const openPicker = async () => {
    setPickerOpen(true);
    if (libLoaded || libLoading) return;
    setLibLoading(true);
    try {
      const { data } = await axios.get(LIB_API, authHdr);
      setLibrary(Array.isArray(data) ? data.filter(Boolean) : []);
      setLibLoaded(true);
    } catch (e) {
      flash('Could not load the mockup library.', 'error');
    } finally {
      setLibLoading(false);
    }
  };
  const addMockup = (m) => {
    // Seed the tile locally from the library summary so the new page renders
    // instantly; the PATCH response's resolved tiles then take over.
    setByRid((map) => ({
      ...map,
      [m.remoteId]: map[m.remoteId] || {
        remoteId: m.remoteId,
        libraryId: String(m._id),
        name: m.name || '',
        mockupNum: m.pageState?.mockupNum ? String(m.pageState.mockupNum) : '',
        front: m.thumbnail || '',
      },
    }));
    setPages([...draftRef.current.pages, { remoteId: m.remoteId, caption: '' }]);
  };

  // ── Share / PDF / archive / feedback ────────────────────────────────────
  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      flash('Client link copied.');
    } catch (_) {
      flash('Copy blocked — select the link below and copy it.', 'warning');
    }
  };

  const share = async () => {
    setShareBusy(true);
    try {
      const ok = await flushSave();
      if (!ok) throw new Error('unsaved');
      const { data } = await axios.post(`${API}/${openId}/share`, {}, authHdr);
      setLb((p) => ({ ...(p || {}), ...(data.lookbook || {}) }));
      await copyLink(`${window.location.origin}${data.sharePath}`);
    } catch (e) {
      flash(e.response?.data?.message || 'Share failed — save your edits and try again.', 'error');
    } finally {
      setShareBusy(false);
    }
  };

  const exportPdf = async () => {
    const d = draftRef.current;
    const mockupIds = d.pages.map((p) => byRid[p.remoteId]?.libraryId).filter(Boolean);
    if (!mockupIds.length) { flash('Add at least one mockup first.', 'warning'); return; }
    setPdfBusy(true);
    try {
      await flushSave();
      const r = await axios.post(PDF_API, {
        mockupIds,
        title: d.title, subtitle: d.subtitle,
        clientName: lb?.companyName || '',
        projectNumber: d.projectNumber,
        layout: d.layout, showBack: d.showBack, showLabels: d.showLabels,
        knockout: d.knockout,
      }, { ...authHdr, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(d.title || 'lookbook').replace(/[^\w\- ]+/g, '').trim() || 'lookbook'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      flash('PDF export failed.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const archive = async () => {
    const restoring = lb?.status === 'archived';
    if (!restoring && !(await confirmDialog({ title: 'Archive lookbook?', message: `Archive "${draft?.title || 'this lookbook'}"? The client link stops working and it leaves the list — nothing is deleted.`, confirmLabel: 'Archive', danger: true }))) return;
    setArchiveBusy(true);
    try {
      const flushed = await flushSave();
      if (!flushed) { flash('Save failed — check the connection and try again.', 'error'); return; }
      const { data } = await axios.patch(`${API}/${openId}`, { status: restoring ? 'draft' : 'archived' }, authHdr);
      if (restoring) {
        setLb((p) => ({ ...(p || {}), ...(data.lookbook || {}) }));
        flash('Restored to draft.');
      } else {
        setOpenId(null);
        setLb(null);
        setDraft(null);
        loadList();
        flash('Archived.');
      }
    } catch (e) {
      flash(e.response?.data?.message || 'Update failed.', 'error');
    } finally {
      setArchiveBusy(false);
    }
  };

  const markAllSeen = async () => {
    setSeenBusy(true);
    try {
      await axios.post(`${API}/${openId}/feedback/seen`, {}, authHdr);
      const now = new Date().toISOString();
      setLb((p) => (p ? { ...p, feedback: (p.feedback || []).map((f) => (f.seenAt ? f : { ...f, seenAt: now })) } : p));
    } catch (e) {
      flash('Could not mark feedback seen.', 'error');
    } finally {
      setSeenBusy(false);
    }
  };

  // ── Shared chrome ───────────────────────────────────────────────────────
  const headerBtnSx = {
    ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: D.muted,
    textTransform: 'none', minWidth: 0, borderRadius: 999,
    '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' },
  };
  const dot = <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: D.faint, flexShrink: 0 }} />;
  const panelSx = { bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3 };

  const inEditor = !!openId;
  const unseen = (lb?.feedback || []).filter((f) => !f.seenAt).length;
  const feedbackSorted = [...(lb?.feedback || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const livePath = lb && lb.status === 'shared' && lb.shareToken
    ? `/lookbook/${lb._id}?token=${lb.shareToken}` : null;
  const liveUrl = livePath ? `${window.location.origin}${livePath}` : null;
  // Prefiltered entry: label the chip with the company's real name when a row
  // carries it (the deep-link only hands us the key).
  const filterLabel = filterKey ? (rows.find((r) => r.companyKey === filterKey)?.companyName || filterKey) : '';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg }}>
      {/* Slim full-width header — matches the CRM / Field Map tool chrome. */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: D.panel, borderBottom: `1px solid ${D.line}` }}>
        <Box sx={accentBar} />
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ height: 56, px: { xs: 1.5, sm: 2 } }}>
          <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small" sx={headerBtnSx}>
            Studio
          </Button>
          {dot}
          {inEditor ? (
            <>
              <Button onClick={closeEditor} size="small" sx={{ ...headerBtnSx, fontSize: 12 }}>Lookbooks</Button>
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                {dot}
                <Typography sx={{ ...mono, fontSize: 12, color: D.green, fontWeight: 700,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {draft?.title || 'Lookbook'}
                </Typography>
              </Box>
            </>
          ) : (
            <Typography sx={{ ...mono, fontSize: 12, color: D.green, fontWeight: 700 }}>Lookbooks</Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {inEditor && <SaveIndicator state={saveState} onRetry={flushSave} />}
        </Stack>
      </Box>

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      {inEditor ? (
        lbLoading || !draft || !lb ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <JpLoader size={64} label="Loading lookbook…" tone="dark" />
          </Box>
        ) : (
          <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 4 } }}>
            <Stack spacing={2.5}>
              {/* Cover details */}
              <Box sx={{ ...panelSx, p: { xs: 2, md: 2.5 } }}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
                  <Typography sx={eyebrow}>Cover</Typography>
                  <StatusChip status={lb.status} />
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography sx={{ color: D.muted, fontSize: 12.5, fontWeight: 600 }}>
                    {lb.companyName || lb.companyKey}
                  </Typography>
                  {onNavigate && lb.companyKey && (
                    <Button size="small" onClick={() => onNavigate({ view: 'crm', companyKey: lb.companyKey })}
                      sx={{ ...mono, fontSize: 10.5, fontWeight: 700, color: D.faint, textTransform: 'none',
                        minWidth: 0, px: 1, borderRadius: 999,
                        '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}>
                      CRM →
                    </Button>
                  )}
                </Stack>
                <Stack spacing={1.5}>
                  <TextField label="Title" value={draft.title} onChange={(e) => set('title')(e.target.value)}
                    size="small" fullWidth sx={dropInput} placeholder={`${lb.companyName || 'Client'} Lookbook`} />
                  <TextField label="Subtitle" value={draft.subtitle} onChange={(e) => set('subtitle')(e.target.value)}
                    size="small" fullWidth sx={dropInput} placeholder="Spring merch concepts — round one" />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                    <TextField label="Project #" value={draft.projectNumber}
                      onChange={(e) => set('projectNumber')(e.target.value)}
                      size="small" sx={{ ...dropInput, maxWidth: { sm: 140 } }} fullWidth />
                    <TextField select label="Layout" value={draft.layout}
                      onChange={(e) => set('layout')(e.target.value)}
                      size="small" sx={{ ...dropInput, maxWidth: { sm: 260 } }} fullWidth>
                      {LAYOUTS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </TextField>
                    <Stack direction="row" spacing={1}>
                      <TogglePill label="Back sides" on={draft.showBack} onClick={() => set('showBack')(!draft.showBack)} />
                      <TogglePill label="Labels" on={draft.showLabels} onClick={() => set('showLabels')(!draft.showLabels)} />
                    </Stack>
                  </Stack>

                  {/* Client-facing defaults — the palette + clean-background the
                      viewer first sees on the share link (they can still flip it
                      live). Theme also tints the PDF's cover accents. */}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
                    <Box>
                      <Typography sx={{ ...eyebrow, mb: 0.9, display: 'block' }}>Client theme</Typography>
                      <Stack direction="row" spacing={1.25}>
                        {THEME_SWATCHES.map((t) => {
                          const on = draft.theme === t.value;
                          return (
                            <Box key={t.value} onClick={() => set('theme')(t.value)} title={t.label}
                              sx={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{ width: 28, height: 28, borderRadius: '50%',
                                background: `linear-gradient(135deg, ${t.bg} 0 55%, ${t.accent} 55% 100%)`,
                                border: `2px solid ${on ? D.green : D.line}`,
                                boxShadow: on ? `0 0 0 2px ${D.panel}, 0 0 0 3px ${D.green}` : 'none',
                                transition: 'transform 140ms ease', '&:hover': { transform: 'scale(1.1)' } }} />
                              <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: on ? D.text : D.faint }}>{t.label}</Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                    <Box sx={{ flexGrow: 1 }} />
                    <TogglePill label="Clean background" on={draft.knockout} onClick={() => set('knockout')(!draft.knockout)} />
                  </Stack>
                </Stack>
              </Box>

              {/* Pages */}
              <Box sx={{ ...panelSx, p: { xs: 2, md: 2.5 } }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                  <Typography sx={eyebrow}>Pages</Typography>
                  <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5 }}>
                    {draft.pages.length || 'none yet'}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button onClick={openPicker} size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                    sx={{ ...dropGhostBtn, px: 1.75, py: 0.5, fontSize: 12.5 }}>
                    Add mockups
                  </Button>
                </Stack>
                {draft.pages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 5, color: D.muted, border: `1px dashed ${D.line}`, borderRadius: 2 }}>
                    <DesignServicesIcon sx={{ fontSize: 34, opacity: 0.3, mb: 1 }} />
                    <Typography sx={{ fontSize: 13 }}>No pages yet — add mockups from the library to start the story.</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1.5,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
                    {draft.pages.map((p, i) => {
                      const t = byRid[p.remoteId] || {};
                      const missing = t.missing || (!t.front && !t.libraryId);
                      return (
                        <Box key={p.remoteId} sx={{
                          borderRadius: 2, border: `1px solid ${D.line}`, bgcolor: D.inset,
                          overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        }}>
                          <Box sx={{ position: 'relative', aspectRatio: '4/3', bgcolor: 'rgba(0,0,0,0.25)' }}>
                            {t.front ? (
                              <Box component="img" src={t.front} alt={t.name} loading="lazy"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <DesignServicesIcon sx={{ color: D.faint, fontSize: 30, opacity: 0.4 }} />
                              </Box>
                            )}
                            <Typography sx={{ position: 'absolute', top: 6, left: 6, ...mono, px: 0.8, py: 0.2,
                              borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 800 }}>
                              {i + 1}
                            </Typography>
                            {missing && (
                              <Typography sx={{ position: 'absolute', bottom: 6, left: 6, px: 0.8, py: 0.2,
                                borderRadius: 1, bgcolor: 'rgba(251,191,36,0.9)', color: '#1a1206',
                                fontSize: 10, fontWeight: 800 }}>
                                Missing from library
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.name || p.remoteId}
                              </Typography>
                              {t.mockupNum && (
                                <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5 }}>#{t.mockupNum}</Typography>
                              )}
                            </Box>
                            <TextField value={p.caption} onChange={(e) => setCaption(i, e.target.value)}
                              size="small" fullWidth placeholder="Caption (optional)"
                              sx={{ ...dropInput, '& .MuiInputBase-input': { fontSize: 12.5, color: D.text } }} />
                            <Stack direction="row" alignItems="center" sx={{ mt: 'auto' }}>
                              <IconButton size="small" onClick={() => movePage(i, -1)} disabled={i === 0}
                                aria-label="Move earlier"
                                sx={{ color: D.muted, '&:hover': { color: D.green }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' } }}>
                                <KeyboardArrowUpIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" onClick={() => movePage(i, 1)} disabled={i === draft.pages.length - 1}
                                aria-label="Move later"
                                sx={{ color: D.muted, '&:hover': { color: D.green }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' } }}>
                                <KeyboardArrowDownIcon fontSize="small" />
                              </IconButton>
                              <Box sx={{ flexGrow: 1 }} />
                              <IconButton size="small" onClick={() => removePage(i)} aria-label="Remove page"
                                sx={{ color: D.faint, '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>

              {/* Share & export */}
              <Box sx={{ ...panelSx, p: { xs: 2, md: 2.5 } }}>
                <Typography sx={{ ...eyebrow, mb: 2 }}>Share &amp; export</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
                  <Button onClick={share} disabled={shareBusy || draft.pages.length === 0}
                    variant="contained" sx={{ ...dropPrimaryBtn, px: 2.5 }}
                    startIcon={shareBusy ? <CircularProgress size={14} sx={{ color: D.ink }} /> : <IosShareIcon sx={{ fontSize: 17 }} />}>
                    {livePath ? 'Copy client link' : 'Share with client'}
                  </Button>
                  <Button onClick={exportPdf} disabled={pdfBusy || draft.pages.length === 0}
                    sx={{ ...dropGhostBtn, px: 2 }}
                    startIcon={pdfBusy ? <CircularProgress size={14} sx={{ color: D.text }} /> : <FileDownloadOutlinedIcon sx={{ fontSize: 17 }} />}>
                    Export PDF
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button onClick={archive} disabled={archiveBusy}
                    sx={{ ...dropGhostBtn, px: 2,
                      ...(lb.status !== 'archived' ? { '&:hover': { borderColor: 'rgba(251,191,36,0.5)', color: D.amber, bgcolor: 'rgba(251,191,36,0.06)' } } : {}) }}
                    startIcon={archiveBusy ? <CircularProgress size={14} sx={{ color: D.text }} />
                      : lb.status === 'archived' ? <UnarchiveOutlinedIcon sx={{ fontSize: 17 }} /> : <ArchiveOutlinedIcon sx={{ fontSize: 17 }} />}>
                    {lb.status === 'archived' ? 'Restore to draft' : 'Archive'}
                  </Button>
                </Stack>
                {liveUrl && (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{
                    mt: 2, px: 1.5, py: 1, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}`,
                  }}>
                    <Typography sx={{ ...mono, color: D.muted, fontSize: 11.5, flex: 1, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {liveUrl}
                    </Typography>
                    <IconButton size="small" onClick={() => copyLink(liveUrl)} aria-label="Copy link"
                      sx={{ color: D.muted, '&:hover': { color: D.green } }}>
                      <ContentCopyIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                    <IconButton size="small" aria-label="Open the client view"
                      onClick={() => { try { window.open(liveUrl, '_blank', 'noopener,noreferrer'); } catch (_) {} }}
                      sx={{ color: D.muted, '&:hover': { color: D.green } }}>
                      <OpenInNewIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Stack>
                )}
                <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 1.5, lineHeight: 1.5 }}>
                  Sharing copies the client link — anyone with it can react, comment, and request
                  pricing, no login.
                  {lb.sharedAt ? ` First shared ${fmtRelative(lb.sharedAt)}.` : ''}
                  {lb.lastViewedAt ? ` Last viewed ${fmtRelative(lb.lastViewedAt)}.` : ''}
                  {(lb.viewCount || 0) > 0 ? ` ${lb.viewCount} visit${lb.viewCount === 1 ? '' : 's'} so far.` : ''}
                </Typography>
              </Box>

              {/* Pricing requests — the gallery's "Request pricing" submissions.
                  Each one already seeded a quote-stage project; the button jumps
                  straight to it in the Order Tracker. */}
              {(lb.pricingRequests || []).length > 0 && (
                <Box sx={{ ...panelSx, p: { xs: 2, md: 2.5 } }}>
                  <Typography sx={{ ...eyebrow, mb: 1.5, display: 'block' }}>
                    Pricing requests · {(lb.pricingRequests || []).length}
                  </Typography>
                  <Box sx={{ borderRadius: 2, border: `1px solid ${D.line}`, bgcolor: D.inset, overflow: 'hidden' }}>
                    {[...(lb.pricingRequests || [])].reverse().map((r, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, px: 1.75, py: 1.25,
                        borderTop: i === 0 ? 'none' : `1px solid ${D.line}` }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" gap={0.9} flexWrap="wrap">
                            <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 800 }}>
                              {r.by || 'The client'}
                            </Typography>
                            <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5 }}>{fmtRelative(r.at)}</Typography>
                          </Stack>
                          <Typography sx={{ color: D.muted, fontSize: 12, mt: 0.4, lineHeight: 1.55 }}>
                            {(r.picks || []).map((pk) => `${pk.name || 'design'} × ${pk.qty}`).join(' · ')}
                          </Typography>
                          {(r.shipTo || r.email || r.phone || r.note) && (
                            <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.3, lineHeight: 1.5 }}>
                              {[r.shipTo && `Ship to: ${r.shipTo}`, r.email, r.phone, r.note].filter(Boolean).join(' · ')}
                            </Typography>
                          )}
                        </Box>
                        {r.projectNumber && onNavigate && (
                          <Button size="small" onClick={() => onNavigate({ view: 'clients', projectNumber: r.projectNumber })}
                            sx={{ ...mono, fontSize: 10.5, fontWeight: 700, color: D.green, textTransform: 'none',
                              minWidth: 0, px: 1.25, borderRadius: 999, border: `1px solid rgba(74,222,128,0.35)`,
                              flexShrink: 0, '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
                            #{r.projectNumber} →
                          </Button>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Client feedback */}
              {feedbackSorted.length > 0 && (
                <Box sx={{ ...panelSx, p: { xs: 2, md: 2.5 } }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                    <Typography sx={eyebrow}>Client feedback</Typography>
                    {unseen > 0 && (
                      <Box sx={{ minWidth: 20, height: 20, px: '6px', borderRadius: '10px', bgcolor: '#ff3b30',
                        color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                        {unseen > 99 ? '99+' : unseen}
                      </Box>
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <Button onClick={markAllSeen} disabled={seenBusy || unseen === 0} size="small"
                      startIcon={seenBusy ? <CircularProgress size={12} sx={{ color: D.text }} /> : <DoneAllIcon sx={{ fontSize: 15 }} />}
                      sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 11.5 }}>
                      Mark all seen
                    </Button>
                  </Stack>
                  <Box sx={{ borderRadius: 2, border: `1px solid ${D.line}`, bgcolor: D.inset, overflow: 'hidden' }}>
                    {feedbackSorted.map((f, i) => {
                      const tile = f.mockupRemoteId ? byRid[f.mockupRemoteId] : null;
                      const about = f.mockupRemoteId
                        ? (tile?.name || tile?.mockupNum || 'a mockup')
                        : 'the whole lookbook';
                      return (
                        <Box key={f._id || i} sx={{
                          display: 'flex', alignItems: 'flex-start', gap: 1.25, px: 1.75, py: 1.25,
                          borderTop: i === 0 ? 'none' : `1px solid ${D.line}`,
                        }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', mt: 0.75, flexShrink: 0,
                            bgcolor: f.seenAt ? 'rgba(255,255,255,0.12)' : D.green,
                            boxShadow: f.seenAt ? 'none' : `0 0 8px ${D.glow}` }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" gap={0.9} flexWrap="wrap">
                              <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 800 }}>
                                {f.by || 'The client'}
                              </Typography>
                              {f.reaction === 'up' && <ThumbUpAltOutlinedIcon sx={{ fontSize: 14, color: D.green }} />}
                              {f.reaction === 'down' && <ThumbDownAltOutlinedIcon sx={{ fontSize: 14, color: D.amber }} />}
                              <Typography sx={{ color: D.faint, fontSize: 11.5 }}>on {about}</Typography>
                              <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5 }}>{fmtRelative(f.at)}</Typography>
                            </Stack>
                            {f.comment && (
                              <Typography sx={{ color: D.muted, fontSize: 13, mt: 0.4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {f.comment}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Stack>
          </Box>
        )
      ) : (
        /* ── List ───────────────────────────────────────────────────────── */
        <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 4 } }}>
          <Stack direction="row" alignItems="flex-start" gap={2} sx={{ mb: 2.5 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: D.text, fontWeight: 800, fontSize: { xs: 19, sm: 22 }, letterSpacing: -0.3 }}>
                Lookbooks
              </Typography>
              <Typography sx={{ color: D.muted, fontSize: 12.5, mt: 0.4 }}>
                Curated mockup galleries your clients react to on one link.
              </Typography>
            </Box>
            <Button onClick={() => setNewOpen(true)} variant="contained"
              startIcon={<AddIcon />} sx={{ ...dropPrimaryBtn, px: 2.25, flexShrink: 0 }}>
              New lookbook
            </Button>
          </Stack>

          {(filterKey || showArchived) && (
            <Stack direction="row" gap={1} sx={{ mb: 1.5 }} flexWrap="wrap">
              {filterKey && (
                <Chip label={`Company: ${filterLabel}`} size="small" onDelete={clearFilter}
                  sx={{ bgcolor: 'rgba(74,222,128,0.12)', color: D.green, fontWeight: 700, fontSize: 11,
                    border: `1px solid ${D.lineHi}`, '& .MuiChip-deleteIcon': { color: D.green } }} />
              )}
              {showArchived && (
                <Chip label="Showing archived" size="small" onDelete={toggleArchived}
                  sx={{ bgcolor: 'rgba(251,191,36,0.10)', color: D.amber, fontWeight: 700, fontSize: 11,
                    border: '1px solid rgba(251,191,36,0.28)', '& .MuiChip-deleteIcon': { color: D.amber } }} />
              )}
            </Stack>
          )}

          {listLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <JpLoader size={60} label="Loading lookbooks…" tone="dark" />
            </Box>
          ) : listErr ? (
            <Alert severity="error" sx={{ borderRadius: 2, bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5',
              border: '1px solid rgba(248,113,113,0.25)', '& .MuiAlert-icon': { color: '#f87171' } }}>
              {listErr}
            </Alert>
          ) : rows.length === 0 ? (
            <Box sx={{ ...panelSx, textAlign: 'center', py: 7, px: 3 }}>
              <AutoStoriesOutlinedIcon sx={{ fontSize: 42, color: D.green, opacity: 0.5, mb: 1.5 }} />
              <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16 }}>
                {showArchived ? 'No archived lookbooks' : filterKey ? 'No lookbooks for this company yet' : 'No lookbooks yet'}
              </Typography>
              <Typography sx={{ color: D.muted, fontSize: 13, mt: 0.75, maxWidth: 420, mx: 'auto', lineHeight: 1.6 }}>
                Pull mockups from the library into a curated gallery, share one link,
                and the client's reactions land right back here.
              </Typography>
              {!showArchived && (
                <Button onClick={() => setNewOpen(true)} variant="contained"
                  startIcon={<AddIcon />} sx={{ ...dropPrimaryBtn, px: 2.5, mt: 2.5 }}>
                  New lookbook
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{ borderRadius: 3, border: `1px solid ${D.line}`, bgcolor: D.panel, overflow: 'hidden' }}>
              {rows.map((r, i) => (
                <Box key={r._id} onClick={() => setOpenId(r._id)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(r._id); }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1.5, sm: 2 }, py: 1.5,
                    cursor: 'pointer', borderTop: i === 0 ? 'none' : `1px solid ${D.line}`,
                    transition: 'background-color 0.15s ease',
                    '&:hover': { bgcolor: D.panelHi },
                    '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: -2 },
                  }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: 1.5, flexShrink: 0, bgcolor: D.greenDk,
                    color: D.green, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <AutoStoriesOutlinedIcon sx={{ fontSize: 19 }} />
                    {r.unseenFeedback > 0 && (
                      <Box sx={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, px: '5px',
                        borderRadius: '9px', bgcolor: '#ff3b30', color: '#fff', fontSize: 10, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        boxShadow: `0 0 0 2px ${D.panel}` }}>
                        {r.unseenFeedback > 99 ? '99+' : r.unseenFeedback}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 14,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title || 'Untitled lookbook'}
                      </Typography>
                      <StatusChip status={r.status} />
                    </Stack>
                    <Typography sx={{ color: D.muted, fontSize: 12, mt: 0.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.companyName || r.companyKey}
                      {r.projectNumber ? <Box component="span" sx={{ ...mono }}> · #{r.projectNumber}</Box> : null}
                      {' · '}{r.pageCount} page{r.pageCount === 1 ? '' : 's'}
                      {(r.viewCount || 0) > 0 ? ` · ${r.viewCount} visit${r.viewCount === 1 ? '' : 's'}` : (r.lastViewedAt ? ` · viewed ${fmtRelative(r.lastViewedAt)}` : '')}
                      {(r.pricingRequests || 0) > 0 ? ` · ${r.pricingRequests} pricing request${r.pricingRequests === 1 ? '' : 's'}` : ''}
                    </Typography>
                    {r.status === 'archived' && (() => {
                      const left = purgeDaysLeft(r.archivedAt, r.updatedAt);
                      return (
                        <Typography sx={{ color: '#f87171', fontSize: 10.5, fontWeight: 700, mt: 0.2 }}>
                          auto-deletes in {left} day{left === 1 ? '' : 's'} — restore to keep it
                        </Typography>
                      );
                    })()}
                  </Box>
                  <Typography sx={{ ...mono, color: D.faint, fontSize: 11, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
                    {fmtRelative(r.updatedAt)}
                  </Typography>
                  <ChevronRightIcon sx={{ fontSize: 20, color: D.faint, flexShrink: 0 }} />
                </Box>
              ))}
            </Box>
          )}

          {!listLoading && !listErr && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography component="button" onClick={toggleArchived}
                sx={{ background: 'none', border: 'none', cursor: 'pointer', color: D.faint,
                  fontSize: 11.5, fontWeight: 600, '&:hover': { color: D.green } }}>
                {showArchived ? '← Back to active lookbooks' : `Show archived (auto-delete after ${ARCHIVE_TTL_DAYS} days)`}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <NewLookbookDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={createLookbook}
        busy={creating} initialCompany={filterKey ? filterLabel : ''} />

      <AddMockupsDialog open={pickerOpen} onClose={() => setPickerOpen(false)}
        loading={libLoading} library={library}
        excluded={new Set((draft?.pages || []).map((p) => p.remoteId))}
        onAdd={addMockup} pageCount={draft?.pages?.length || 0} />

      <Snackbar open={!!snack} autoHideDuration={4500} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'success'} variant="filled" onClose={() => setSnack(null)}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
