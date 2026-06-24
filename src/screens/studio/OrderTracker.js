// src/screens/studio/OrderTracker.js
// Project-first Order Tracker. Each project (= one Order document) is a card
// with its mockup thumbnails as the hero image. Click a card to drill into the
// full project view with inline editing.

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton, Chip,
  Drawer, MenuItem, Select, FormControl, Tooltip, CircularProgress, InputAdornment,
  Dialog, DialogContent, DialogActions, Menu, ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import AddIcon             from '@mui/icons-material/Add';
import SearchIcon          from '@mui/icons-material/Search';
import CloseIcon           from '@mui/icons-material/Close';
import DesignServicesIcon  from '@mui/icons-material/DesignServices';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import AutoFixHighIcon    from '@mui/icons-material/AutoFixHigh';
import ChecklistIcon      from '@mui/icons-material/Checklist';
import CheckIcon          from '@mui/icons-material/Check';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import MoreVertIcon       from '@mui/icons-material/MoreVert';
import SendIcon           from '@mui/icons-material/Send';
import DeleteOutlineIcon   from '@mui/icons-material/DeleteOutline';
import AttachFileIcon      from '@mui/icons-material/AttachFile';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LinkIcon from '@mui/icons-material/Link';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import axios from 'axios';
import { B, STATUS_META, STATUS_OPTIONS, fmt, fmtRelative, scrollbar, darkInput, hasConfirmation, confRevenue, confCogs } from './_shared';
import MockupPickerDialog from './MockupPickerDialog';
import ConfirmationBuilder from './ConfirmationBuilder';
import PoBuilderDialog from './PoBuilderDialog';
import FlowPipeline from './FlowPipeline';
import QuoteBuilder from './QuoteBuilder';
import config from '../../config.json';
import jpLogoWhite from '../../modules/images/logo_white.webp';
import JpLoader from '../../common/JpLoader';

const base = `${config.backendUrl}/api`;
// Primary filters: the ones you actually act on. Delivered / Cancelled stay
// accessible via the overflow select beside the chips.
const STATUS_FILTERS = [
  { value: 'active',        label: 'Active' },          // virtual: everything except delivered/cancelled
  { value: 'quoted',        label: 'Quoted' },
  { value: 'approved',      label: 'Approved' },
  { value: 'placed',        label: 'Placed' },
  { value: 'in_production', label: 'In Production' },
  { value: 'shipped',       label: 'Shipped' },
];
const SECONDARY_FILTERS = [
  { value: 'all',           label: 'All' },
  { value: 'delivered',     label: 'Delivered' },
  { value: 'cancelled',     label: 'Cancelled' },
];

export default function OrderTracker({ token, onBack }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [projects,      setProjects]      = useState([]);
  const [mockups,       setMockups]       = useState([]);
  const [logos,         setLogos]         = useState([]);
  const [stats,         setStats]         = useState({});
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('active');
  const [sortMode,      setSortMode]      = useState('projectNumber');  // projectNumber | totalValue | updatedAt | company
  const [activeProject, setActiveProject] = useState(null);
  const [creating,      setCreating]      = useState(false);
  const [picker,        setPicker]        = useState({ open: false, project: null });
  const [confirmation,  setConfirmation]  = useState(null);
  const [quote,         setQuote]         = useState(null);
  const [healthOpen,    setHealthOpen]    = useState(false);
  const [healthData,    setHealthData]    = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [analyticsOpen,    setAnalyticsOpen]    = useState(false);
  const [analyticsData,    setAnalyticsData]    = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [clientsOpen,    setClientsOpen]    = useState(false);
  const [clientsData,    setClientsData]    = useState(null);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [cleanupOpen,    setCleanupOpen]    = useState(false);
  const [cleanupData,    setCleanupData]    = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [autoLinkOpen,     setAutoLinkOpen]     = useState(false);
  const [autoLinkData,     setAutoLinkData]     = useState(null);
  const [autoLinkLoading,  setAutoLinkLoading]  = useState(false);
  const [autoLinkApplying, setAutoLinkApplying] = useState(false);
  const [selectMode,  setSelectMode]  = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkSaving,  setBulkSaving]  = useState(false);
  const [moreAnchor,  setMoreAnchor]  = useState(null);
  const [shareDialog, setShareDialog] = useState({
    open: false, projectId: null, ttl: 7, emails: '',
    url: '', expiresAt: null, recipients: [], status: null,
    loading: false, busy: false, err: '', notice: '',
  });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    // allSettled so one slow/broken endpoint doesn't blank the whole tab.
    // We commit each settled response independently — if /dashboard 500s
    // the project list still renders, just with stale stats.
    const [pr, mk, ds, lg] = await Promise.allSettled([
      axios.get(`${base}/orders/projects`, authHdr),
      axios.get(`${base}/studio/library/mockups?summary=1`, authHdr),
      axios.get(`${base}/orders/dashboard`, authHdr),
      axios.get(`${base}/client-logos`, authHdr),
    ]);
    if (pr.status === 'fulfilled') setProjects(pr.value.data.projects || []);
    else console.error('loadProjects /orders/projects failed:', pr.reason?.message || pr.reason);
    if (mk.status === 'fulfilled') {
      // /studio/library/mockups returns a bare array, NOT { items: [...] }.
      // The .items lookup was always undefined, so mockups stayed [] even
      // when the cloud had 59 items — that's why cards showed "No mockups
      // yet" and the Link picker came up empty.
      const d = mk.value.data;
      setMockups(Array.isArray(d) ? d : (d.items || []));
    } else console.error('loadProjects /studio/library/mockups failed:', mk.reason?.message || mk.reason);
    if (ds.status === 'fulfilled') setStats(ds.value.data || {});
    else console.error('loadProjects /orders/dashboard failed:', ds.reason?.message || ds.reason);
    if (lg.status === 'fulfilled') setLogos(lg.value.data?.logos || []);
    else setLogos([]);  // client logos are aesthetic only; silently fall back
    setLoading(false);
  }, [authHdr]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Keyboard shortcuts: `/` focuses search, `n` creates a new project,
  // `Esc` closes the drawer. Ignore when typing in any input.
  const searchInputRef = React.useRef(null);
  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing && e.key !== 'Escape') return;
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleCreate();
      } else if (e.key === 'Escape' && activeProject) {
        setActiveProject(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  // Normalize a mockup # so old "61A" and new "#000061A" map to the same key.
  // Strips the leading hash, drops leading zeros, uppercases letters.
  const normMockupKey = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();

  const mockupMap = useMemo(() => {
    const m = {};
    mockups.forEach(x => {
      const k = x.pageState?.mockupNum;
      if (k) {
        m[k] = x;
        m[normMockupKey(k)] = x;
      }
      if (x.name && !m[x.name]) m[x.name] = x;
      // The confirmation builder's picker stores NORMALIZED values (uppercase,
      // #/zeros stripped) — name-keyed mockups must resolve through the same
      // key or their image breaks in the builder while fine on the PDF.
      const nk = normMockupKey(x.name);
      if (nk && !m[nk]) m[nk] = x;
    });
    return m;
  }, [mockups]);

  const lookupMockup = (mockupNum) => mockupMap[mockupNum] || mockupMap[normMockupKey(mockupNum)];

  // Index mockups by slugged client so "Highway 90 Merch" auto-attaches to
  // the Highway 90 project without anyone typing a mockup #.
  const _slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const mockupsByClientSlug = useMemo(() => {
    const map = {};
    mockups.forEach(m => {
      const client = m.pageState?.client || m.client || '';
      const name = m.name || '';
      // Pull a client guess from the title — "Highway 90 Merch" → "highway90".
      const titleClient = name.replace(/\s+merch\s*$/i, '').trim();
      [client, titleClient].forEach(raw => {
        const k = _slug(raw);
        if (!k) return;
        (map[k] = map[k] || []).push(m);
      });
    });
    return map;
  }, [mockups]);

  // Match a project to mockups. First by exact slug, then a fuzzy fallback
  // where either slug starts-with or contains the other — covers "Cannapi
  // LLC" project vs "Cannapi Merch" mockup, "Highway 90" vs "Highway90 Co".
  const autoMockupsFor = (project) => {
    if (!project) return [];
    const projSlugs = [project.companyName, project.clientName]
      .map(_slug).filter(Boolean);
    if (!projSlugs.length) return [];
    const out = [];
    const seenIds = new Set();
    const push = (m) => {
      const id = m._id || m.remoteId || m.name;
      if (!seenIds.has(id)) { seenIds.add(id); out.push(m); }
    };
    // Exact slug match first
    projSlugs.forEach(k => (mockupsByClientSlug[k] || []).forEach(push));
    // Fuzzy: any mockup-slug that's a prefix/substring of a project-slug
    // (or vice versa) within reason (min 4 chars to avoid false positives).
    if (out.length === 0) {
      Object.keys(mockupsByClientSlug).forEach(mk => {
        if (mk.length < 4) return;
        const hit = projSlugs.some(pk =>
          pk.length >= 4 && (pk.startsWith(mk) || mk.startsWith(pk) || pk.includes(mk) || mk.includes(pk))
        );
        if (hit) mockupsByClientSlug[mk].forEach(push);
      });
    }
    return out;
  };

  // For card hero fallback: when a project has no mockups linked, show
  // other mockups from the same company so the card isn't blank.
  const companyMockupPool = useMemo(() => {
    const byCompany = {};
    projects.forEach(p => {
      const key = (p.companyKey || (p.companyName || p.clientName || '').toLowerCase().replace(/[^a-z0-9]+/g, ''));
      if (!key) return;
      (p.mockupNumbers || []).forEach(n => {
        if (!byCompany[key]) byCompany[key] = [];
        if (!byCompany[key].includes(n)) byCompany[key].push(n);
      });
    });
    return byCompany;
  }, [projects]);

  // Map company → logo data URL for cards + drawer + confirmation page.
  const logoMap = useMemo(() => {
    const m = {};
    logos.forEach(l => { if (l.companyKey) m[l.companyKey] = l.imageDataUrl; });
    return m;
  }, [logos]);
  const logoFor = (project) => {
    const key = project.companyKey || (project.companyName || project.clientName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return key ? logoMap[key] : null;
  };

  const uploadLogo = async (project, file) => {
    if (!file) return;
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const r = await axios.post(`${base}/client-logos`, {
            companyName: project.companyName || '',
            clientName:  project.clientName  || '',
            imageDataUrl: reader.result,
          }, authHdr);
          setLogos(prev => {
            const filtered = prev.filter(l => l.companyKey !== r.data.logo.companyKey);
            return [...filtered, r.data.logo];
          });
          resolve(r.data.logo);
        } catch (e) {
          alert(`Logo upload failed: ${e.response?.data?.message || e.message}`);
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeLogo = async (project) => {
    const key = project.companyKey || (project.companyName || project.clientName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!key) return;
    if (!window.confirm('Remove the logo for this company?')) return;
    try {
      await axios.delete(`${base}/client-logos/${encodeURIComponent(key)}`, authHdr);
      setLogos(prev => prev.filter(l => l.companyKey !== key));
    } catch (e) {
      alert(`Couldn't remove: ${e.message}`);
    }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = projects.filter(p => {
      if (statusFilter === 'active') {
        if (p.status === 'delivered' || p.status === 'cancelled') return false;
      } else if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }
      if (!s) return true;
      return [p.projectNumber, p.orderNumber, p.companyName, p.clientName,
              (p.items || []).map(i => i.description).join(' '),
              (p.mockupNumbers || []).join(' ')]
        .join(' ').toLowerCase().includes(s);
    });
    const sorted = [...list];
    if (sortMode === 'totalValue') {
      sorted.sort((a, b) => (Number(b.totalValue) || 0) - (Number(a.totalValue) || 0));
    } else if (sortMode === 'updatedAt') {
      sorted.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    } else if (sortMode === 'company') {
      sorted.sort((a, b) => (a.companyName || a.clientName || '').localeCompare(b.companyName || b.clientName || ''));
    } // else server's projectNumber order is the default
    return sorted;
  }, [projects, search, statusFilter, sortMode]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const r = await axios.post(`${base}/orders`, { status: 'quoted', companyName: '', clientName: '' }, authHdr);
      await loadProjects();
      setActiveProject(r.data);
    } catch (e) {
      alert(`Couldn't create project: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (id, patch) => {
    try {
      const r = await axios.put(`${base}/orders/${id}`, patch, authHdr);
      setProjects(prev => prev.map(p => p._id === id ? r.data : p));
      if (activeProject?._id === id) setActiveProject(r.data);
      return r.data;
    } catch (e) {
      // Let callers detect failure so they can avoid closing a dialog over
      // an unsaved change. Still surface the error to the user immediately.
      alert(`Save failed: ${e.response?.data?.message || e.message}`);
      return null;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    try {
      await axios.delete(`${base}/orders/${id}`, authHdr);
      setProjects(prev => prev.filter(p => p._id !== id));
      setActiveProject(null);
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleConfirmMockups = async (selected) => {
    const project = picker.project;
    if (!project) return;
    const saved = await handleSave(project._id, { mockupNumbers: selected });
    // Only close the picker if the save actually landed. handleSave returns
    // null on failure (after alerting the user), so the dialog stays open
    // with the selection intact and they can retry without re-picking.
    if (saved) setPicker({ open: false, project: null });
  };

  const handleOpenCleanup = async () => {
    setCleanupOpen(true);
    setCleanupLoading(true);
    try {
      const r = await axios.get(`${base}/orders/cleanup-candidates`, authHdr);
      setCleanupData(r.data);
    } catch (e) {
      alert(`Couldn't load cleanup: ${e.message}`);
      setCleanupOpen(false);
    } finally {
      setCleanupLoading(false);
    }
  };
  const handleCleanupDelete = async (ids) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} empty project${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    try {
      await axios.post(`${base}/orders/cleanup-delete`, { ids }, authHdr);
      await loadProjects();
      await handleOpenCleanup();   // refresh the list
    } catch (e) { alert(`Delete failed: ${e.message}`); }
  };
  const handleMergeCompany = async (from, to) => {
    if (!from || !to || from === to) return;
    if (!window.confirm(`Merge "${from}" into "${to}"?\n\nEvery project, mockup, and logo currently under "${from}" will be re-pointed to "${to}".`)) return;
    try {
      const r = await axios.post(`${base}/orders/merge-company`, { from, to }, authHdr);
      await loadProjects();
      await handleOpenCleanup();
      alert(`Merged.\nProjects updated: ${r.data.ordersUpdated}\nMockups updated: ${r.data.mockupsUpdated}\nLogos consolidated: ${r.data.logosMerged}`);
    } catch (e) { alert(`Merge failed: ${e.response?.data?.message || e.message}`); }
  };

  const handleOpenClients = async () => {
    setClientsOpen(true);
    setClientsLoading(true);
    try {
      const r = await axios.get(`${base}/orders/clients-summary`, authHdr);
      setClientsData(r.data);
    } catch (e) {
      alert(`Couldn't load clients: ${e.message}`);
      setClientsOpen(false);
    } finally {
      setClientsLoading(false);
    }
  };

  const handleOpenAnalytics = async () => {
    setAnalyticsOpen(true);
    setAnalyticsLoading(true);
    try {
      const r = await axios.get(`${base}/orders/analytics`, authHdr);
      setAnalyticsData(r.data);
    } catch (e) {
      alert(`Couldn't load analytics: ${e.message}`);
      setAnalyticsOpen(false);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleOpenAutoLink = async () => {
    setAutoLinkOpen(true);
    setAutoLinkLoading(true);
    setAutoLinkData(null);
    try {
      const r = await axios.post(`${base}/orders/mockups/auto-link`, { commit: false }, authHdr);
      setAutoLinkData(r.data);
    } catch (e) {
      alert(`Couldn't scan the library: ${e.response?.data?.message || e.message}`);
      setAutoLinkOpen(false);
    } finally {
      setAutoLinkLoading(false);
    }
  };
  const handleApplyAutoLink = async () => {
    setAutoLinkApplying(true);
    try {
      const r = await axios.post(`${base}/orders/mockups/auto-link`, { commit: true }, authHdr);
      await loadProjects();
      setAutoLinkOpen(false);
      const s = r.data.summary;
      alert(`Linked ${s.mockupsLinked} mockup${s.mockupsLinked === 1 ? '' : 's'} across ${s.projectsAffected} project${s.projectsAffected === 1 ? '' : 's'}.`);
    } catch (e) {
      alert(`Apply failed: ${e.response?.data?.message || e.message}`);
    } finally {
      setAutoLinkApplying(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  const handleBulkUpdate = async (patch, label) => {
    if (selectedIds.length === 0) return;
    const n = selectedIds.length;
    if (!window.confirm(`${label} — apply to ${n} project${n === 1 ? '' : 's'}?`)) return;
    setBulkSaving(true);
    try {
      for (const id of selectedIds) {
        await axios.put(`${base}/orders/${id}`, patch, authHdr);
      }
      await loadProjects();
      exitSelectMode();
    } catch (e) {
      alert(`Bulk update failed: ${e.response?.data?.message || e.message}`);
    } finally {
      setBulkSaving(false);
    }
  };

  // Shared between the drawer "Share for approval" button and the confirmation
  // builder's header button. Opens a real dialog (browser prompt was ugly)
  // where the user picks TTL, generates the link, and copies it from a field
  // they can verify before sending.
  const shareApprovalFor = async (projectId) => {
    if (!projectId) return;
    setShareDialog({
      open: true, projectId, ttl: 7, emails: '',
      url: '', expiresAt: null, recipients: [], status: null,
      loading: true, busy: false, err: '', notice: '',
    });
    try {
      // Reuse-or-mint the shared hub token. rotate:false never disturbs a live
      // link, so just opening the dialog is safe.
      const r = await axios.post(`${base}/orders/${projectId}/approval-link`, { rotate: false }, authHdr);
      const url = `${window.location.origin}/approve/${projectId}?token=${r.data.token}`;
      setShareDialog(s => (s.projectId === projectId && s.open) ? {
        ...s, loading: false, url, expiresAt: r.data.expiresAt,
        recipients: r.data.recipients || [], status: r.data.approvalStatus || null,
      } : s);
    } catch (e) {
      setShareDialog(s => (s.projectId === projectId && s.open) ? {
        ...s, loading: false, err: e.response?.data?.message || e.message,
      } : s);
    }
  };

  const handleOpenHealth = async () => {
    setHealthOpen(true);
    setHealthLoading(true);
    try {
      const r = await axios.get(`${base}/orders/mockup-health`, authHdr);
      setHealthData(r.data);
    } catch (e) {
      alert(`Couldn't load mockup health: ${e.message}`);
      setHealthOpen(false);
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
      {/* Header */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 5,
        bgcolor: 'rgba(12,20,16,0.92)', backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${B.border}`, px: { xs: 1.5, md: 3 }, py: 1.5,
      }}>
        <Stack direction="row" alignItems="center" gap={{ xs: 1, md: 1.5 }} flexWrap="wrap">
          <IconButton onClick={onBack} sx={{ color: B.muted, '&:hover': { color: B.white } }}>
            <ArrowBackIcon />
          </IconButton>
          <Box component="img" src={jpLogoWhite} alt="Joint Printing"
            sx={{
              height: { xs: 22, md: 26 }, width: 'auto', opacity: 0.95,
              display: { xs: 'none', sm: 'block' },
            }} />
          <Box sx={{
            width: '1px', height: 20, bgcolor: B.border,
            display: { xs: 'none', sm: 'block' },
          }} />
          <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>
            Order Tracker
          </Typography>
          <Typography sx={{ color: B.muted, fontSize: 12, ml: 0.5 }}>
            {projects.length} projects
          </Typography>

          <Box sx={{ flex: 1 }} />

          <TextField
            size="small"
            placeholder="Search · press / to focus"
            value={search}
            onChange={e => setSearch(e.target.value)}
            inputRef={searchInputRef}
            sx={{ ...darkInput, width: { xs: '100%', sm: 220, md: 320 }, order: { xs: 5, md: 0 }, flex: { xs: '1 1 100%', sm: 'unset' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: B.muted, fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />

          <Button
            startIcon={creating ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : <AddIcon />}
            onClick={handleCreate}
            disabled={creating}
            sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, textTransform: 'none',
              px: { xs: 1.5, md: 2 }, minWidth: 0,
              '&:hover': { bgcolor: '#3bd070' },
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.7 } } }}>
            <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>New project</Box>
          </Button>

          {/* Priority-ordered: workflow (multi-select) and lookup (clients)
              stay visible. Diagnostics/reports/maintenance live in More. */}
          <Tooltip title={selectMode ? 'Exit multi-select' : 'Select multiple projects'}>
            <span>
              <IconButton onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))} size="small"
                sx={{ color: selectMode ? B.green : B.muted, opacity: selectMode ? 1 : 0.55,
                  '&:hover': { opacity: 1, color: B.green } }}>
                <ChecklistIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Clients overview">
            <span>
              <IconButton onClick={handleOpenClients} size="small"
                sx={{ color: B.muted, opacity: 0.55, '&:hover': { opacity: 1, color: B.green } }}>
                <PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="More — analytics, mockup health, auto-link, cleanup">
            <span>
              <IconButton onClick={(e) => setMoreAnchor(e.currentTarget)} size="small"
                sx={{ color: B.muted, opacity: 0.55, '&:hover': { opacity: 1, color: B.green } }}>
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}
            PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, minWidth: 220 } }}>
            <MenuItem onClick={() => { setMoreAnchor(null); handleOpenAnalytics(); }}>
              <ListItemIcon sx={{ color: B.muted }}><InsightsOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ sx: { fontSize: 13 } }}>Analytics</ListItemText>
            </MenuItem>
            <Divider sx={{ borderColor: B.border }} />
            <MenuItem onClick={() => { setMoreAnchor(null); handleOpenHealth(); }}>
              <ListItemIcon sx={{ color: B.muted }}><FactCheckOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ sx: { fontSize: 13 } }}
                secondaryTypographyProps={{ sx: { fontSize: 10, color: B.muted } }}
                secondary="Find missing / orphan mockups">Mockup health</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setMoreAnchor(null); handleOpenAutoLink(); }}>
              <ListItemIcon sx={{ color: B.muted }}><AutoFixHighIcon fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ sx: { fontSize: 13 } }}
                secondaryTypographyProps={{ sx: { fontSize: 10, color: B.muted } }}
                secondary="Bulk-link orphan mockups">Auto-link mockups</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setMoreAnchor(null); handleOpenCleanup(); }}>
              <ListItemIcon sx={{ color: B.muted }}><CleaningServicesOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ sx: { fontSize: 13 } }}
                secondaryTypographyProps={{ sx: { fontSize: 10, color: B.muted } }}
                secondary="Empty projects + duplicates">Cleanup</ListItemText>
            </MenuItem>
          </Menu>
        </Stack>

        {/* Stat strip */}
        <Stack direction="row" gap={{ xs: 2.5, md: 4 }} sx={{ mt: 1.5, pl: { xs: 0, md: 6 }, flexWrap: 'wrap', rowGap: 1 }}>
          <Stat label="Delivered this month"  value={fmt(stats.revenueThisMonth)} accent={B.green} />
          <Stat label="Delivered this year"   value={fmt(stats.revenueThisYear)} />
          <Stat label="Open orders"           value={String(stats.openOrders || 0)} />
          <Stat label="Open quotes"           value={String(stats.openQuotes || 0)} />
          <Stat label="Unpaid"                value={fmt(stats.unpaidTotal)} accent={stats.unpaidTotal > 0 ? '#fbbf24' : undefined} />
        </Stack>

        {/* Status filter chips + sort */}
        <Stack direction="row" gap={0.75} sx={{ mt: 1.5, pl: { xs: 0, md: 6 }, flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_FILTERS.map(f => {
            const active = f.value === statusFilter;
            const count = f.value === 'active'
              ? projects.filter(p => p.status !== 'delivered' && p.status !== 'cancelled').length
              : projects.filter(p => p.status === f.value).length;
            return (
              <Chip
                key={f.value}
                label={`${f.label} · ${count}`}
                onClick={() => setStatusFilter(f.value)}
                sx={{
                  bgcolor: active ? B.green : 'rgba(255,255,255,0.04)',
                  color:   active ? B.greenDk : B.muted,
                  fontWeight: active ? 700 : 500,
                  fontSize: 11,
                  height: 24,
                  cursor: 'pointer',
                  border: `1px solid ${active ? B.green : 'rgba(255,255,255,0.08)'}`,
                  '&:hover': { bgcolor: active ? B.green : 'rgba(255,255,255,0.08)' },
                }}
              />
            );
          })}
          {/* Overflow: All / Delivered / Cancelled */}
          <Select
            value={SECONDARY_FILTERS.find(s => s.value === statusFilter)?.value || ''}
            onChange={e => setStatusFilter(e.target.value)}
            displayEmpty
            size="small"
            renderValue={(v) => {
              if (!v) return 'More…';
              const f = SECONDARY_FILTERS.find(s => s.value === v);
              const count = v === 'all' ? projects.length : projects.filter(p => p.status === v).length;
              return `${f.label} · ${count}`;
            }}
            sx={{
              fontSize: 11, height: 24, ml: 0.5,
              color: SECONDARY_FILTERS.some(s => s.value === statusFilter) ? B.greenDk : B.muted,
              bgcolor: SECONDARY_FILTERS.some(s => s.value === statusFilter) ? B.green : 'rgba(255,255,255,0.04)',
              borderRadius: 999,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' },
              '& .MuiSelect-icon': { color: SECONDARY_FILTERS.some(s => s.value === statusFilter) ? B.greenDk : B.muted },
              '& .MuiSelect-select': { py: 0.4, pr: 3 },
            }}>
            {SECONDARY_FILTERS.map(s => {
              const c = s.value === 'all' ? projects.length : projects.filter(p => p.status === s.value).length;
              return <MenuItem key={s.value} value={s.value}>{s.label} · {c}</MenuItem>;
            })}
          </Select>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', mr: 0.5 }}>
              Sort
            </Typography>
            <Select value={sortMode} onChange={e => setSortMode(e.target.value)} size="small"
              sx={{
                color: B.white, fontSize: 11, height: 26,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                '& .MuiSelect-icon': { color: B.muted },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: B.green },
              }}>
              <MenuItem value="projectNumber">Project # (newest)</MenuItem>
              <MenuItem value="updatedAt">Recently updated</MenuItem>
              <MenuItem value="totalValue">Total $ (high → low)</MenuItem>
              <MenuItem value="company">Company (A → Z)</MenuItem>
            </Select>
          </Box>
        </Stack>
      </Box>

      {/* Project grid */}
      <Box sx={{ p: 3, pb: selectMode ? 12 : 6 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <JpLoader size={60} label="Loading projects…" />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10, color: B.muted }}>
            <DesignServicesIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography sx={{ fontSize: 14 }}>No projects match.</Typography>
            {search && (
              <Button onClick={() => setSearch('')} sx={{ color: B.green, mt: 1, fontSize: 12, textTransform: 'none' }}>
                Clear search
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{
            display: 'grid',
            gap: { xs: 1.2, md: 2 },
            // Slightly narrower minmax than before so the new taller (1:1
            // hero) cards still feel balanced — width drops with the height
            // increase instead of looking like big squares.
            gridTemplateColumns: { xs: 'repeat(auto-fill, minmax(150px, 1fr))', sm: 'repeat(auto-fill, minmax(200px, 1fr))', md: 'repeat(auto-fill, minmax(240px, 1fr))' },
          }}>
            {filtered.map(p => (
              <ProjectCard key={p._id} project={p}
                lookupMockup={lookupMockup}
                companyMockupPool={companyMockupPool}
                logo={logoFor(p)}
                selectMode={selectMode}
                selected={selectedIds.includes(p._id)}
                onClick={() => (selectMode ? toggleSelect(p._id) : setActiveProject(p))} />
            ))}
          </Box>
        )}
      </Box>

      {/* Detail drawer */}
      <ProjectDrawer
        open={!!activeProject}
        project={activeProject}
        mockupMap={mockupMap}
        mockups={mockups}
        autoMatched={activeProject ? autoMockupsFor(activeProject) : []}
        logo={activeProject ? logoFor(activeProject) : null}
        onUploadLogo={(file) => activeProject && uploadLogo(activeProject, file)}
        onRemoveLogo={() => activeProject && removeLogo(activeProject)}
        onClose={() => setActiveProject(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onShareApproval={() => activeProject && shareApprovalFor(activeProject._id)}
        onOpenPicker={() => setPicker({ open: true, project: activeProject })}
        onOpenConfirmation={() => setConfirmation(activeProject)}
        onOpenQuote={() => setQuote(activeProject)}
        token={token}
        authHdr={authHdr}
      />

      <QuoteBuilder
        open={!!quote}
        project={quote}
        authHdr={authHdr}
        onClose={() => setQuote(null)}
        onSave={async (patch) => {
          if (!quote) return null;
          const updated = await handleSave(quote._id, patch);
          if (updated) setQuote(updated);
          return updated;   // truthy = server confirmed; lets the quoter clear its draft
        }}
      />

      <ConfirmationBuilder
        open={!!confirmation}
        project={confirmation}
        mockupMap={mockupMap}
        mockups={mockups}
        logo={confirmation ? logoFor(confirmation) : null}
        token={token}
        onClose={() => setConfirmation(null)}
        onShareApproval={() => confirmation && shareApprovalFor(confirmation._id)}
        onSave={async (patch) => {
          if (!confirmation) return null;
          const updated = await handleSave(confirmation._id, patch);
          if (updated) setConfirmation(updated);
          return updated;
        }}
      />

      <MockupHealthDialog
        open={healthOpen}
        data={healthData}
        loading={healthLoading}
        projects={projects}
        onClose={() => setHealthOpen(false)}
        onJumpToProject={(projectNumber) => {
          const p = projects.find(x => x.projectNumber === projectNumber);
          if (p) { setHealthOpen(false); setActiveProject(p); }
        }}
      />

      <AutoLinkDialog
        open={autoLinkOpen}
        data={autoLinkData}
        loading={autoLinkLoading}
        applying={autoLinkApplying}
        onClose={() => setAutoLinkOpen(false)}
        onApply={handleApplyAutoLink}
      />

      <ShareApprovalDialog
        state={shareDialog}
        setTtl={(v) => setShareDialog(s => ({ ...s, ttl: v }))}
        setEmails={(v) => setShareDialog(s => ({ ...s, emails: v }))}
        onClose={() => setShareDialog(s => ({ ...s, open: false }))}
        onSend={async () => {
          const list = parseEmails(shareDialog.emails);
          if (list.length === 0) { setShareDialog(s => ({ ...s, err: 'Enter at least one email address.' })); return; }
          setShareDialog(s => ({ ...s, busy: true, err: '', notice: '' }));
          try {
            const ttlDays = Math.max(1, Math.min(365, Math.round(Number(shareDialog.ttl) || 7)));
            // rotate:false → everyone shares the SAME hub link; adding a person
            // never breaks the ones already invited.
            const r = await axios.post(`${base}/orders/${shareDialog.projectId}/approval-link/send`, {
              emails: list, ttlDays, rotate: false, frontendOrigin: window.location.origin,
            }, authHdr);
            const failedNote = (r.data.failed && r.data.failed.length)
              ? ` · couldn't reach ${r.data.failed.map(f => f.email).join(', ')}` : '';
            setShareDialog(s => ({
              ...s, busy: false, emails: '',
              url: r.data.url, expiresAt: r.data.expiresAt,
              recipients: r.data.recipients || s.recipients,
              notice: `Sent to ${(r.data.sentTo || []).join(', ')} ✓${failedNote}`,
            }));
          } catch (e) {
            setShareDialog(s => ({ ...s, busy: false, err: e.response?.data?.message || e.message }));
          }
        }}
        onStartFresh={async () => {
          if (!window.confirm('Start a fresh link? The current link stops working and any approvals so far reset. Use this when the quote or proof has changed.')) return;
          setShareDialog(s => ({ ...s, busy: true, err: '', notice: '' }));
          try {
            const ttlDays = Math.max(1, Math.min(365, Math.round(Number(shareDialog.ttl) || 7)));
            const r = await axios.post(`${base}/orders/${shareDialog.projectId}/approval-link`,
              { ttlDays, rotate: true }, authHdr);
            const url = `${window.location.origin}/approve/${shareDialog.projectId}?token=${r.data.token}`;
            setShareDialog(s => ({
              ...s, busy: false, url, expiresAt: r.data.expiresAt,
              recipients: r.data.recipients || [], status: r.data.approvalStatus || null,
              notice: 'Fresh link ready — the old one no longer works.',
            }));
          } catch (e) {
            setShareDialog(s => ({ ...s, busy: false, err: e.response?.data?.message || e.message }));
          }
        }}
      />

      <AnalyticsDialog
        open={analyticsOpen}
        data={analyticsData}
        loading={analyticsLoading}
        onClose={() => setAnalyticsOpen(false)}
      />

      <ClientsDialog
        open={clientsOpen}
        data={clientsData}
        loading={clientsLoading}
        logoMap={logoMap}
        onClose={() => setClientsOpen(false)}
        onPickClient={(name) => {
          setSearch(name);
          setStatusFilter('all');
          setClientsOpen(false);
        }}
      />

      <CleanupDialog
        open={cleanupOpen}
        data={cleanupData}
        loading={cleanupLoading}
        onClose={() => setCleanupOpen(false)}
        onBulkDelete={handleCleanupDelete}
        onMerge={handleMergeCompany}
      />

      <MockupPickerDialog
        open={picker.open}
        onClose={() => setPicker({ open: false, project: null })}
        onConfirm={handleConfirmMockups}
        mockups={mockups}
        companyName={picker.project?.companyName || ''}
        clientName={picker.project?.clientName || ''}
        initialSelected={picker.project?.mockupNumbers || []}
        title={`Link mockups · Project #${picker.project?.projectNumber || ''}`}
        confirmLabel="Save"
      />

      {/* Bulk action bar */}
      {selectMode && (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
          bgcolor: 'rgba(12,20,16,0.97)', backdropFilter: 'blur(10px)',
          borderTop: `1px solid ${B.border}`, px: { xs: 1.5, md: 3 }, py: 1.2,
          display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 }, flexWrap: 'wrap' }}>
          <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 13 }}>
            {selectedIds.length} selected
          </Typography>
          <Button size="small" onClick={() => setSelectedIds(filtered.map(p => p._id))}
            sx={{ color: B.muted, fontSize: 11, textTransform: 'none', minWidth: 0 }}>
            Select all ({filtered.length})
          </Button>
          <Button size="small" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}
            sx={{ color: B.muted, fontSize: 11, textTransform: 'none', minWidth: 0 }}>
            Clear
          </Button>
          <Box sx={{ flex: 1 }} />
          {bulkSaving && <CircularProgress size={16} sx={{ color: B.green }} />}
          <Button size="small" disabled={bulkSaving || selectedIds.length === 0}
            onClick={() => handleBulkUpdate({ paid: true }, 'Mark paid')}
            sx={{ color: B.green, fontSize: 11, textTransform: 'none', fontWeight: 700,
              border: `1px solid ${B.green}40`, '&:hover': { bgcolor: 'rgba(74,222,128,0.1)' } }}>
            Mark paid
          </Button>
          <Button size="small" disabled={bulkSaving || selectedIds.length === 0}
            onClick={() => handleBulkUpdate({ paid: false }, 'Mark unpaid')}
            sx={{ color: B.muted, fontSize: 11, textTransform: 'none', fontWeight: 700,
              border: `1px solid rgba(255,255,255,0.12)`, '&:hover': { color: B.white } }}>
            Mark unpaid
          </Button>
          <Select
            value=""
            displayEmpty
            disabled={bulkSaving || selectedIds.length === 0}
            onChange={(e) => {
              const opt = STATUS_OPTIONS.find(s => s.value === e.target.value);
              if (opt) handleBulkUpdate({ status: opt.value }, `Set status to ${opt.label}`);
            }}
            renderValue={() => 'Set status…'}
            size="small"
            sx={{ fontSize: 11, height: 30, color: B.white,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
              '& .MuiSelect-icon': { color: B.muted } }}>
            {STATUS_OPTIONS.map(s => (
              <MenuItem key={s.value} value={s.value} sx={{ fontSize: 12 }}>{s.label}</MenuItem>
            ))}
          </Select>
          <Button size="small" onClick={exitSelectMode}
            sx={{ bgcolor: B.green, color: B.greenDk, fontSize: 11, textTransform: 'none',
              fontWeight: 700, px: 1.5, '&:hover': { bgcolor: '#3bd070' } }}>
            Done
          </Button>
        </Box>
      )}
    </Box>
  );
}

function Stat({ label, value, accent }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography sx={{ color: accent || B.white, fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>
        {value}
      </Typography>
    </Box>
  );
}

function ProjectCard({ project, lookupMockup, companyMockupPool, logo, onClick, selectMode, selected }) {
  const meta = STATUS_META[project.status] || STATUS_META.quoted;
  const itemSummary = (project.items || []).map(i => i.description).filter(Boolean).join(' · ') || '—';

  // Tiles for this project: one slot per mockup#, with the library item
  // attached if we can find a match. Slots without a match render as
  // amber-bordered placeholders so the card honestly reflects the project's
  // Keep unresolved tiles in — they render as "NOT IN STUDIO" amber boxes
  // and the user uses that as a flag for "this is a legacy mockup from my
  // old GDrive system, not in jpstudio yet".
  const ownTiles = (project.mockupNumbers || []).slice(0, 4).map(n => ({ num: n, item: lookupMockup(n) }));
  let mockupTiles = ownTiles;
  let usingFallback = false;
  if (mockupTiles.length === 0) {
    const companyKey = project.companyKey || (project.companyName || project.clientName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const pool = (companyMockupPool && companyMockupPool[companyKey]) || [];
    const others = pool.slice(0, 4)
      .map(n => ({ num: n, item: lookupMockup(n) }))
      .filter(t => t.item);
    if (others.length > 0) { mockupTiles = others; usingFallback = true; }
  }

  return (
    <Box onClick={onClick} sx={{
      bgcolor: B.panel,
      border: `1px solid ${selected ? B.green : B.border}`,
      borderRadius: 2,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.15s',
      boxShadow: selected ? `0 0 0 1px ${B.green}` : 'none',
      '&:hover': {
        borderColor: B.green,
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      },
    }}>
      {/* Square hero for every card. Pairs well with the narrower grid:
          shirt mockups (portrait) fit cleanly in a 1:1 cell — and in the 2x2
          grid each cell becomes 1:2 portrait which is exactly a shirt's
          shape, so no clipping anywhere. */}
      <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: B.bg, overflow: 'hidden' }}>
        {selectMode && (
          <Box sx={{
            position: 'absolute', top: 8, left: 8, zIndex: 3,
            width: 22, height: 22, borderRadius: '50%',
            border: `2px solid ${selected ? B.green : 'rgba(255,255,255,0.65)'}`,
            bgcolor: selected ? B.green : 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selected && <CheckIcon sx={{ fontSize: 15, color: B.greenDk }} />}
          </Box>
        )}
        {usingFallback && (
          <Box sx={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            zIndex: 2, bgcolor: 'rgba(0,0,0,0.65)', color: B.muted,
            px: 1, py: 0.2, borderRadius: 1, fontSize: 9, fontWeight: 700,
            letterSpacing: 0.6, textTransform: 'uppercase',
          }}>
            Client&apos;s work
          </Box>
        )}
        {mockupTiles.length > 0 ? (
          <Box sx={{
            display: 'grid',
            // 1: single tile. 2: side-by-side. 3 or 4: clean 2×2 grid
            // (3 leaves one empty cell, which is cleaner than the old
            // big-tile-spans-two-rows look).
            gridTemplateColumns: mockupTiles.length === 1 ? '1fr' : '1fr 1fr',
            gridTemplateRows:    mockupTiles.length <= 2 ? '1fr' : '1fr 1fr',
            height: '100%',
            gap: '2px',
          }}>
            {mockupTiles.map((t, i) => (
              <Box key={i} sx={{
                bgcolor: B.bg, position: 'relative',
              }}>
                {t.item && t.item.thumbnail ? (
                  <Box component="img" src={t.item.thumbnail} alt="" loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                      // Keep the full mockup visible (shirts are tall, the
                      // hero cell is squat-ish). cover was cropping the
                      // garment bottom under the PAID badge / client logo.
                      backgroundColor: B.bg }} />
                ) : (
                  <Box sx={{ width: '100%', height: '100%',
                    bgcolor: t.item ? B.panelHi : 'rgba(251,191,36,0.05)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.3 }}>
                    <DesignServicesIcon sx={{ color: t.item ? B.muted : '#fbbf24', opacity: 0.45, fontSize: 22 }} />
                    {!t.item && (
                      <Typography sx={{ color: '#fbbf24', fontSize: 8, fontWeight: 700, letterSpacing: 0.5 }}>
                        NOT IN STUDIO
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${B.panel} 0%, ${B.panelHi} 100%)`,
          }}>
            <DesignServicesIcon sx={{ color: B.muted, fontSize: 36, opacity: 0.2 }} />
            <Typography sx={{ position: 'absolute', bottom: 12, color: B.muted, fontSize: 11 }}>
              No mockups yet
            </Typography>
          </Box>
        )}
        {/* Project # badge */}
        <Box sx={{
          position: 'absolute', top: 8, left: selectMode ? 36 : 8,
          bgcolor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          px: 1, py: 0.3, borderRadius: 1,
          color: B.white, fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
        }}>
          #{project.projectNumber || '—'}
        </Box>
        {/* Status badge */}
        <Box sx={{
          position: 'absolute', top: 8, right: 8,
          bgcolor: meta.bg, color: meta.color,
          px: 1, py: 0.3, borderRadius: 1,
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
          border: `1px solid ${meta.color}40`,
        }}>
          {meta.label}
        </Box>
        {/* Client picked their quote options — needs a confirmation built.
            Only meaningful pre-confirmation; the status chip takes over after. */}
        {project.status === 'quoted' && project.optionsPickedAt && !hasConfirmation(project.confirmation) && (
          <Box sx={{
            position: 'absolute', top: 34, right: 8,
            bgcolor: 'rgba(74,222,128,0.18)', color: B.green,
            px: 1, py: 0.3, borderRadius: 1,
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
            border: `1px solid ${B.green}40`,
          }}>
            PICKED ✓
          </Box>
        )}
        {/* Payment badge: PAID when the manual paid checkbox is set, else nothing. */}
        {project.paid ? (
          <Box sx={{
            position: 'absolute', bottom: 8, right: 8,
            bgcolor: 'rgba(74,222,128,0.18)', color: B.green,
            px: 1, py: 0.3, borderRadius: 1,
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
          }}>
            PAID
          </Box>
        ) : null}
        {/* Client logo (corner) */}
        {logo && (
          <Box sx={{
            position: 'absolute', bottom: 8, left: 8,
            width: 36, height: 36, borderRadius: 1,
            bgcolor: '#fff', p: 0.4,
            border: `1px solid rgba(255,255,255,0.2)`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <Box component="img" src={logo} alt="logo"
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </Box>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 14, lineHeight: 1.25,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.companyName || project.clientName || 'Untitled project'}
        </Typography>
        {project.clientName && project.companyName && project.clientName !== project.companyName && (
          <Typography sx={{ color: B.muted, fontSize: 11, mt: 0.1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.clientName}
          </Typography>
        )}
        <Typography sx={{ color: B.muted, fontSize: 11, mt: 0.6,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {itemSummary}
        </Typography>

        <Stack direction="row" alignItems="center" justifyContent="space-between" mt={1}>
          <Typography sx={{ color: B.white, fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
            {project.totalValue > 0 ? fmt(project.totalValue) : '—'}
          </Typography>
          <Typography sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace' }}>
            {project.orderNumber ? `INV #${project.orderNumber}` : 'no invoice'}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function ProjectDrawer({ open, project, mockupMap, mockups, autoMatched, logo, onUploadLogo, onRemoveLogo, onClose, onSave, onDelete, onShareApproval, onOpenPicker, onOpenConfirmation, onOpenQuote, token, authHdr }) {
  const [poOpen, setPoOpen] = useState(false);
  const [local, setLocal] = useState(null);
  const [savingField, setSavingField] = useState('');
  const [uploading, setUploading] = useState(false);
  const [client, setClient] = useState(null);
  const [clientSaving, setClientSaving] = useState('');
  // Receipt-derived ACTUAL cost for this order — the real source of truth (the
  // expense receipts linked by order #), as opposed to the quote/confirmation
  // ESTIMATE in local.cogs. { actualCost, receiptCount, hasReceipts }.
  const [actual, setActual] = useState(null);
  // Which drawer tab is showing. Overview is the everyday editing surface, so
  // each open lands there; the choice is plain component state — nothing
  // persists across opens and the URL never changes.
  const [tab, setTab] = useState('overview');
  useEffect(() => { if (open) setTab('overview'); }, [open]);

  // Full re-seed only when a DIFFERENT project opens. Keyed on id so an
  // autosave round-trip — which hands back a fresh project object with the same
  // id — can't reset the form and wipe whatever the user is mid-typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (project) setLocal({ ...project }); }, [project?._id]);

  // Server-driven fields still need to flow back in: mockups attached by the
  // picker / auto-link, uploaded files, quote lines edited in the quoter, and —
  // since money + sale date now derive from the confirmation — totalValue, cogs,
  // orderDate, and the confirmation itself. Sync just those without touching the
  // text fields being edited.
  useEffect(() => {
    if (!project) return;
    setLocal(prev => (prev ? {
      ...prev,
      mockupNumbers: project.mockupNumbers || [],
      files:         project.files,
      quoteLines:    project.quoteLines,
      confirmation:  project.confirmation,
      totalValue:    project.totalValue,
      cogs:          project.cogs,
      orderDate:     project.orderDate,
    } : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.mockupNumbers, project?.files, project?.quoteLines, project?.confirmation, project?.totalValue, project?.cogs, project?.orderDate]);

  // Auto-link: silently promote auto-matched mockups when the drawer opens.
  // ADD-ONLY by design — never prune existing refs here. Pruning against the
  // studio library destroyed real data in two cases: (a) the library fetch
  // failed or came back empty, wiping EVERY link on the project, and (b)
  // legacy GDrive mockup refs aren't in jpstudio but are intentionally kept
  // as "NOT IN STUDIO" flags on the card.
  const lastAutoLinkedRef = React.useRef(null);
  useEffect(() => {
    if (!project || !project._id) return;
    if (lastAutoLinkedRef.current === project._id) return;     // once per session/project
    if (!mockups || mockups.length === 0) return;              // library not loaded — don't touch links
    const norm = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();
    const current = project.mockupNumbers || [];
    const currentKeys = new Set(current.map(norm));
    const toAdd = (autoMatched || [])
      .map(m => m.pageState && m.pageState.mockupNum)
      .filter(n => n && !currentKeys.has(norm(n)));
    lastAutoLinkedRef.current = project._id;
    if (toAdd.length > 0) {
      onSave(project._id, { mockupNumbers: [...current, ...toAdd] })
        .catch(() => { /* keep silent — drawer still works */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?._id, mockups, autoMatched]);

  // Load (or auto-create) the client profile for this project's company.
  useEffect(() => {
    if (!project) { setClient(null); return; }
    const key = project.companyKey || (project.companyName || project.clientName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!key) { setClient(null); return; }
    let cancelled = false;
    axios.get(`${base}/clients/${encodeURIComponent(key)}`, authHdr)
      .then(r => { if (!cancelled) setClient(r.data.client); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [project, authHdr]);

  // Pull the ACTUAL cost from the receipts/expense ledger for THIS order — the
  // figure Nate treats as the source of truth. Keyed on the order number (invoice
  // #); reuses the shared backend math so it equals the finance by-order cost to
  // the cent. Best-effort: a failure just hides the actual and we show the estimate.
  useEffect(() => {
    const ord = project && project.orderNumber;
    if (!ord) { setActual(null); return; }
    let cancelled = false;
    setActual(null);
    axios.get(`${base}/finances/order-actuals`, { ...authHdr, params: { orderNumbers: ord } })
      .then((r) => {
        if (cancelled) return;
        const key = String(ord).replace(/[^0-9]/g, '').replace(/^0+/, '');
        setActual((r.data && r.data.actuals && r.data.actuals[key]) || { actualCost: 0, receiptCount: 0, hasReceipts: false });
      })
      .catch(() => { if (!cancelled) setActual(null); });
    return () => { cancelled = true; };
  }, [project?.orderNumber, authHdr]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveClient = async (field, value) => {
    if (!client) return;
    setClientSaving(field);
    try {
      const r = await axios.put(`${base}/clients/${encodeURIComponent(client.companyKey)}`,
        { [field]: value }, authHdr);
      setClient(r.data.client);
    } catch (e) {
      alert(`Couldn't save client field: ${e.message}`);
    } finally {
      setClientSaving('');
    }
  };

  // ── Invisible autosave ──────────────────────────────────────────────────
  // Text fields stream edits through a debounced queue so work commits ~700ms
  // after you stop typing — not just on blur — so a mid-type tab close / crash
  // can't lose the field you're in. Selects, toggles, dates and list commits
  // save immediately. Multiple pending fields fold into one PUT.
  //
  // Pending edits are tagged with the project id they belong to, so a flush
  // that lands after the user has switched projects can never write one order's
  // edits onto another. These hooks must stay ABOVE the early return.
  const pendingRef   = React.useRef({ id: null, patch: {} });
  const saveTimerRef = React.useRef(null);

  const flushFields = React.useCallback(async () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const { id, patch } = pendingRef.current;
    pendingRef.current = { id: null, patch: {} };
    const keys = Object.keys(patch);
    if (!id || keys.length === 0) return;
    setSavingField(keys[0]);
    try { await onSave(id, patch); }
    finally { setSavingField(''); }
  }, [onSave]);

  // Flush the freshest pending edits on unmount, without re-subscribing each render.
  const flushRef = React.useRef(flushFields);
  flushRef.current = flushFields;
  useEffect(() => () => { flushRef.current(); }, []);

  // Warn before a tab close if a debounced edit hasn't reached the server yet.
  useEffect(() => {
    const onUnload = (e) => {
      if (Object.keys(pendingRef.current.patch).length === 0) return;
      e.preventDefault(); e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  if (!project || !local) return null;

  const meta = STATUS_META[local.status] || STATUS_META.quoted;
  const _normKey = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();

  // Stage a change against the CURRENT project. If something for another project
  // is still queued, commit that first (against its own id).
  const stageField = (key, value) => {
    if (pendingRef.current.id && pendingRef.current.id !== project._id) flushFields();
    const cur = pendingRef.current.id === project._id ? pendingRef.current.patch : {};
    pendingRef.current = { id: project._id, patch: { ...cur, [key]: value } };
  };

  // Debounced (text typing). Skips values that already match what's saved.
  const queueField = (key, value) => {
    if (project[key] === value) {
      if (pendingRef.current.id === project._id) delete pendingRef.current.patch[key];
      return;
    }
    stageField(key, value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { flushFields(); }, 700);
  };

  // Immediate (blur, selects, dates, list commits). Folds in any queued text.
  const saveField = (key, value) => {
    if (project[key] !== value) stageField(key, value);
    else if (pendingRef.current.id === project._id) delete pendingRef.current.patch[key];
    flushFields();
  };

  // Commit any queued edit before the drawer closes, then hand off to the parent.
  const handleClose = () => { flushFields(); onClose(); };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await axios.post(`${base}/orders/${project._id}/files`, form, {
        ...authHdr, headers: { ...authHdr.headers, 'Content-Type': 'multipart/form-data' },
      });
      const r = await axios.get(`${base}/orders/${project._id}`, authHdr);
      onSave(project._id, { files: r.data.files });
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const updateLocal = (patch) => setLocal(prev => ({ ...prev, ...patch }));

  // Drop one mockup # from this project (typo, wrong #, never-made design).
  const removeMockup = async (num) => {
    const next = (local.mockupNumbers || []).filter(n => n !== num);
    updateLocal({ mockupNumbers: next });
    await onSave(project._id, { mockupNumbers: next });
  };

  return (
    <Drawer anchor="right" open={open} onClose={handleClose}
      PaperProps={{ sx: { bgcolor: B.bg, color: B.white, width: { xs: '100%', md: 560 }, ...scrollbar } }}>
      {/* Drawer header */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: B.bg, borderBottom: `1px solid ${B.border}`,
        px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ClientLogoSlot logo={logo} companyName={local.companyName || local.clientName}
          onUpload={onUploadLogo} onRemove={onRemoveLogo} />
        <Box>
          <Typography sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace', letterSpacing: 0.4 }}>
            PROJECT #{local.projectNumber || '—'}
            {local.orderNumber && ` · INVOICE #${local.orderNumber}`}
          </Typography>
          <Typography sx={{ color: B.white, fontSize: 18, fontWeight: 800, mt: 0.2 }}>
            {local.companyName || local.clientName || 'Untitled'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {(() => {
          const total = Number(local.totalValue) || 0;
          const estCogs = Number(local.cogs) || 0;
          // The receipts are the source of truth: when any COGS receipt is linked,
          // the margin headline uses the ACTUAL cost; otherwise it falls back to
          // the estimate (and we flag that no receipts are in yet). hasActual gates
          // both the number shown and the "Actual/Est" label.
          const hasActual = !!(actual && actual.hasReceipts);
          const cogs = hasActual ? Number(actual.actualCost) || 0 : estCogs;
          const margin = total - cogs;
          const pct = total > 0 ? (margin / total) * 100 : 0;
          if (total === 0 && estCogs === 0 && !hasActual) return null;
          const ok = pct >= 30;
          const title = hasActual
            ? `Profit margin (ACTUAL) · total ${fmt(total)} − ${fmt(cogs)} from ${actual.receiptCount} receipt${actual.receiptCount === 1 ? '' : 's'} · est cost ${fmt(estCogs)}`
            : `Profit margin (ESTIMATE) · total ${fmt(total)} − est cost ${fmt(estCogs)} · no receipts linked yet`;
          return (
            <Box title={title} sx={{ textAlign: 'right', mr: 0.4 }}>
              <Typography sx={{ color: hasActual ? B.green : '#fbbf24', fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Margin · {hasActual ? 'actual' : 'est'}
              </Typography>
              <Typography sx={{ color: ok ? B.green : '#fbbf24', fontSize: 12, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1 }}>
                {fmt(margin)}
                <Typography component="span" sx={{ color: B.muted, fontSize: 10, fontWeight: 600, ml: 0.5 }}>
                  · {pct.toFixed(0)}%
                </Typography>
              </Typography>
            </Box>
          );
        })()}
        <Box sx={{
          bgcolor: meta.bg, color: meta.color, border: `1px solid ${meta.color}40`,
          px: 1.2, py: 0.4, borderRadius: 1, fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>{meta.label}</Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: B.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* The order's journey at a glance — each lit stage is done, the
          pulsing one is where the project is right now. Quote / Confirmation
          / PO are shortcuts into their tools. */}
      <FlowPipeline project={local} authHdr={authHdr}
        onOpenQuote={onOpenQuote}
        onOpenConfirmation={onOpenConfirmation}
        onOpenPos={() => setPoOpen(true)} />

      {/* Tab bar — the drawer's sections grouped into three panels so it
          reads as one organized surface instead of a long scroll. Overview
          (default) = the editable project; Approval = the client-facing
          side; Files & Activity = uploads + the history trail. Full-width
          tabs on mobile, inline on desktop. */}
      <Box role="tablist" sx={{
        display: 'flex', alignItems: 'stretch', mt: 1.5,
        borderBottom: `1px solid ${B.border}`,
        px: { xs: 0, md: 2.5 },
      }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'approval', label: 'Approval' },
          { id: 'files',    label: 'Files & Activity' },
        ].map(t => {
          const active = tab === t.id;
          return (
            <Box key={t.id} role="tab" aria-selected={active}
              onClick={() => setTab(t.id)}
              sx={{
                flex: { xs: 1, md: '0 0 auto' },
                textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                px: { xs: 0.5, md: 2 }, py: 1.1,
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                textTransform: 'uppercase', whiteSpace: 'nowrap',
                color: active ? B.green : B.muted,
                boxShadow: active
                  ? `inset 0 -2px 0 0 ${B.green}`
                  : 'inset 0 -2px 0 0 transparent',
                transition: 'color 180ms ease, box-shadow 180ms ease',
                '&:hover': { color: active ? B.green : B.white },
              }}>
              {t.label}
            </Box>
          );
        })}
      </Box>

      {tab === 'overview' && (<>
      {/* Mockup grid */}
      <Box sx={{ px: 2.5, pt: 2 }}>
        {(() => {
          const explicitNums = local.mockupNumbers || [];
          const explicitKeys = new Set(explicitNums.map(n => _normKey(n)));
          // Auto-matched mockups (by client/title slug) that aren't already in
          // the explicit list. These appear without anyone manually typing #s.
          const autoTiles = (autoMatched || [])
            .filter(m => {
              const k = _normKey(m.pageState?.mockupNum || '');
              return k && !explicitKeys.has(k);
            })
            .map(m => ({ num: m.pageState?.mockupNum || '', item: m, source: 'auto' }));
          const explicitTiles = explicitNums.map(n => ({
            num: n, item: mockupMap[n] || mockupMap[_normKey(n)] || null, source: 'linked',
          }));
          // Drop tiles that don't resolve to a studio item — the silent
          // auto-link effect prunes them from mockupNumbers shortly after, so
          // showing an orange "NOT IN STUDIO" placeholder just confuses.
          const tiles = [...explicitTiles.filter(t => t.item), ...autoTiles];
          return (
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Mockups · {tiles.length}
                </Typography>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  {/* Always-present "New mockup" — opens a fresh studio deep-linked
                      to this project so each click starts a NEW lettered mockup
                      (A, B, C…). Previously the only studio entry point lived in the
                      empty state, so once one mockup existed there was no way to add
                      another. "Edit"/"Link" still opens the picker to attach existing
                      mockups. */}
                  <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                    onClick={() => window.open(`/jpstudio/?t=${encodeURIComponent(token || '')}&project=${encodeURIComponent(project._id)}`, '_blank', 'noopener,noreferrer')}
                    sx={{ color: B.green, fontSize: 11, textTransform: 'none', fontWeight: 700 }}>
                    New mockup
                  </Button>
                  <Button size="small" startIcon={<DesignServicesIcon sx={{ fontSize: 14 }} />}
                    onClick={onOpenPicker}
                    sx={{ color: B.muted, fontSize: 11, textTransform: 'none' }}>
                    {tiles.length === 0 ? 'Link' : 'Edit'}
                  </Button>
                </Stack>
              </Stack>
              {tiles.length === 0 ? (
                <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1.5, py: 3,
                  textAlign: 'center', color: B.muted, fontSize: 12 }}>
                  No mockups for this client yet — save one in jpstudio with title "{(project.companyName || project.clientName || '').trim() || 'Company'} Merch" and it'll auto-appear here.
                  <Box sx={{ mt: 1 }}>
                    <Button size="small" startIcon={<DesignServicesIcon sx={{ fontSize: 14 }} />}
                      onClick={() => window.open(`/jpstudio/?t=${encodeURIComponent(token || '')}&project=${encodeURIComponent(project._id)}`, '_blank', 'noopener,noreferrer')}
                      sx={{ color: B.green, fontSize: 11, textTransform: 'none', fontWeight: 700 }}>
                      Open Mockup Studio for this project
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 1 }}>
                  {tiles.map((t, i) => {
                    // Click a tile → open jpstudio with both the project and
                    // the specific mockup deep-linked. The user can edit it
                    // and re-save with one click. Stable identifier is the
                    // mockup's remoteId (UUID, same value local + cloud).
                    const remoteId = t.item?.remoteId || '';
                    const editUrl = t.item
                      ? `/jpstudio/?t=${encodeURIComponent(token || '')}&project=${encodeURIComponent(project._id)}&mockup=${encodeURIComponent(remoteId)}`
                      : null;
                    return (
                    <Box key={i} onClick={() => editUrl && window.open(editUrl, '_blank', 'noopener,noreferrer')}
                      title={t.item ? `Click to edit "${t.item.name || t.num}" in Mockup Studio` : ''}
                      sx={{
                      aspectRatio: '1', borderRadius: 1.5, overflow: 'hidden',
                      border: `1px solid ${t.item ? B.border : 'rgba(251,191,36,0.35)'}`,
                      bgcolor: B.panelHi, position: 'relative',
                      cursor: t.item ? 'pointer' : 'default',
                      transition: 'border-color 0.12s, transform 0.12s',
                      '&:hover .tile-x': { opacity: 1 },
                      '&:hover': t.item ? { borderColor: B.green, transform: 'translateY(-1px)' } : {},
                    }}>
                      {t.source !== 'auto' && (
                        <IconButton className="tile-x" size="small"
                          onClick={(e) => { e.stopPropagation(); removeMockup(t.num); }}
                          title={`Remove ${t.num} from this project`}
                          sx={{
                            position: 'absolute', top: 2, right: 2, zIndex: 1, p: 0.25,
                            opacity: 0, transition: 'opacity 0.12s',
                            bgcolor: 'rgba(0,0,0,0.72)', color: B.white,
                            '&:hover': { bgcolor: '#ef4444', color: '#fff' },
                          }}>
                          <CloseIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      )}
                      {t.source === 'auto' && (
                        <Box sx={{
                          position: 'absolute', top: 2, left: 2, zIndex: 1,
                          bgcolor: 'rgba(34,197,94,0.85)', color: '#062414',
                          fontSize: 7, fontWeight: 800, letterSpacing: 0.6,
                          px: 0.6, py: 0.1, borderRadius: 0.5,
                        }} title="Matched automatically by client name">AUTO</Box>
                      )}
                      {t.item && t.item.thumbnail ? (
                        <Box component="img" src={t.item.thumbnail} alt={t.item.name} loading="lazy"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 0.5,
                          bgcolor: t.item ? B.panelHi : 'rgba(251,191,36,0.04)' }}>
                          <DesignServicesIcon sx={{ color: t.item ? B.muted : '#fbbf24', opacity: 0.5, fontSize: 22 }} />
                          {!t.item && (
                            <Typography sx={{ color: '#fbbf24', fontSize: 8, fontWeight: 700, letterSpacing: 0.5 }}>
                              MISSING
                            </Typography>
                          )}
                        </Box>
                      )}
                      <Box sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        bgcolor: 'rgba(0,0,0,0.7)', color: B.white,
                        fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                        textAlign: 'center', py: 0.2,
                      }}>
                        {t.num}
                      </Box>
                    </Box>
                  );
                  })}
                </Box>
              )}
            </>
          );
        })()}
      </Box>

      {/* Fields */}
      <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <InlineField label="Company"      value={local.companyName} savingHint={savingField === 'companyName'}
          onChange={v => { updateLocal({ companyName: v }); queueField('companyName', v); }} onBlur={v => saveField('companyName', v)} />
        <InlineField label="Client name"  value={local.clientName} savingHint={savingField === 'clientName'}
          onChange={v => { updateLocal({ clientName: v }); queueField('clientName', v); }} onBlur={v => saveField('clientName', v)} />

        <InlineSelect label="Status" value={local.status} savingHint={savingField === 'status'}
          options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          onChange={v => { updateLocal({ status: v }); saveField('status', v); }} />
        <InlineSelect label="Paid" value={local.paid ? 'yes' : 'no'} savingHint={savingField === 'paid'}
          options={[{ value: 'no', label: 'Unpaid' }, { value: 'yes', label: 'Paid' }]}
          onChange={v => { const b = v === 'yes'; updateLocal({ paid: b }); saveField('paid', b); }} />

        {hasConfirmation(local.confirmation) ? (
          <>
            {/* Money is the approved confirmation's, not hand-typed — the quoter
                is pre-approval options; the confirmation is the real order. */}
            <ReadonlyField label="Total $" value={fmt(confRevenue(local.confirmation))} hint="From confirmation" />
            <ReadonlyField label="Est COGS $"  value={fmt(confCogs(local.confirmation))}  hint="From confirmation" />
          </>
        ) : (
          <>
            <InlineField label="Total $" type="number" value={local.totalValue || ''} savingHint={savingField === 'totalValue'}
              onChange={v => { updateLocal({ totalValue: Number(v) || 0 }); queueField('totalValue', Number(v) || 0); }}
              onBlur={v => saveField('totalValue', Number(v) || 0)} />
            <InlineField label="Est COGS $" type="number" value={local.cogs || ''} savingHint={savingField === 'cogs'}
              onChange={v => { updateLocal({ cogs: Number(v) || 0 }); queueField('cogs', Number(v) || 0); }}
              onBlur={v => saveField('cogs', Number(v) || 0)} />
          </>
        )}

        {/* ACTUAL cost from the receipts linked to this order — the real money,
            shown next to the estimate so a gap (or a missing receipt) is obvious.
            The receipts ARE the source of truth; the estimate is the plan. */}
        <Box sx={{ gridColumn: '1 / -1' }}>
          <ActualCostStrip actual={actual} estCogs={hasConfirmation(local.confirmation) ? confCogs(local.confirmation) : Number(local.cogs) || 0} orderNumber={local.orderNumber} />
        </Box>

        <InlineField label="Printer"  value={local.printerName} savingHint={savingField === 'printerName'}
          onChange={v => { updateLocal({ printerName: v }); queueField('printerName', v); }} onBlur={v => saveField('printerName', v)} />
        <InlineField label="Supplier" value={local.supplier || ''} savingHint={savingField === 'supplier'}
          onChange={v => { updateLocal({ supplier: v }); queueField('supplier', v); }} onBlur={v => saveField('supplier', v)} />

        {/* Multi-vendor: a mixed promos + apparel job runs across several
            printers/suppliers, not the one project-level field above. Surface
            every distinct supplier on this project — derived from the
            confirmation items' printerName and the generated POs' vendors — so
            the owner sees the full set at a glance. A single-supplier job just
            shows one chip (or nothing if none is set yet). */}
        <Box sx={{ gridColumn: '1 / -1' }}>
          <SuppliersStrip project={local} authHdr={authHdr} />
        </Box>

        {/* Sale + delivery dates aren't hand-entered here anymore — date of sale
            comes from the confirmation, and delivery progress lives in the
            tracker timeline below. */}

        <Box sx={{ gridColumn: '1 / -1' }}>
          <ItemsEditor
            items={local.items || []}
            saving={savingField === 'items'}
            onChange={items => updateLocal({ items })}
            onCommit={async (items) => {
              updateLocal({ items });
              setSavingField('items');
              await onSave(project._id, { items });
              setSavingField('');
            }}
          />
        </Box>
        {/* Documents — open the Quote / Confirmation / POs directly. The inline
            quote preview that used to live here was removed: the owner just wants
            to OPEN the doc, not skim a mini-table. Each action shows a tiny
            "built / not yet" hint so the state is still legible at a glance. */}
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.75 }}>
            Documents
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <DocAction
              icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 16 }} />}
              label="Open Quote"
              hint={(local.quoteLines || []).length > 0 ? `${(local.quoteLines || []).length} line${(local.quoteLines || []).length === 1 ? '' : 's'}` : 'Not started'}
              ready={(local.quoteLines || []).length > 0}
              onClick={() => onOpenQuote()}
            />
            <DocAction
              icon={<DescriptionOutlinedIcon sx={{ fontSize: 16 }} />}
              label="Open Confirmation"
              hint={hasConfirmation(local.confirmation) ? 'Built' : 'Not built'}
              ready={hasConfirmation(local.confirmation)}
              onClick={() => onOpenConfirmation()}
            />
            <DocAction
              icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />}
              label="Open POs"
              hint="Purchase orders"
              ready={false}
              onClick={() => setPoOpen(true)}
            />
          </Stack>
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <InlineField label="Notes (internal)" multiline value={local.notes || ''} savingHint={savingField === 'notes'}
            onChange={v => { updateLocal({ notes: v }); queueField('notes', v); }} onBlur={v => saveField('notes', v)} />
        </Box>
      </Box>

      {/* Tasks */}
      <TasksSection local={local} updateLocal={updateLocal} saveField={saveField} savingField={savingField} />

      {/* Client profile (sticky info that follows this company across projects) */}
      <ClientProfileSection client={client} saving={clientSaving} saveClient={saveClient} />
      </>)}

      {tab === 'files' && (
      /* Files */
      <Box sx={{ px: 2.5, pt: 2, pb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Files · {(local.files || []).length}
          </Typography>
          <Button component="label" size="small" startIcon={uploading
            ? <CircularProgress size={12} sx={{ color: B.green }} />
            : <AttachFileIcon sx={{ fontSize: 14 }} />}
            sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
            Upload
            <input type="file" hidden onChange={handleUpload} />
          </Button>
        </Stack>
        {(local.files || []).map((f, i) => (
          <Stack key={i} direction="row" alignItems="center" gap={1}
            sx={{ py: 0.5, borderBottom: `1px solid ${B.faint}`, fontSize: 12 }}>
            <AttachFileIcon sx={{ fontSize: 13, color: B.muted }} />
            {/* Fetched with the Authorization header, not a ?token= link —
                the backend only reads the header (plain links always 401'd)
                and this keeps the admin JWT out of URLs/history. */}
            <Typography component="a" href="#download"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const r = await axios.get(
                    `${base}/orders/${project._id}/files/${encodeURIComponent(f.filename)}`,
                    { ...authHdr, responseType: 'blob' });
                  const url = URL.createObjectURL(r.data);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = f.originalName || f.filename;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (err) {
                  alert(`Download failed: ${err.response?.data?.message || err.message}`);
                }
              }}
              sx={{ color: B.white, fontSize: 12, textDecoration: 'none', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                cursor: 'pointer', '&:hover': { color: B.green } }}>
              {f.originalName || f.filename}
            </Typography>
            <Typography sx={{ color: B.muted, fontSize: 10 }}>
              {Math.round((f.size || 0) / 1024)} KB
            </Typography>
          </Stack>
        ))}
      </Box>
      )}

      {tab === 'approval' && (<>
      {/* Share for approval — the one shared hub link per project. The dialog
          (opened from here or from the confirmation builder's header button)
          handles generating/copying the link, emailing recipients, and
          rotating the token; this panel is the drawer-side entry point. */}
      <Box sx={{ px: 2.5, pt: 2, pb: 2 }}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>
          Client approval
        </Typography>
        <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, p: 1.5 }}>
          <Typography sx={{ color: B.muted, fontSize: 11, lineHeight: 1.5, mb: 1 }}>
            One shared link for everyone who needs to weigh in. Open the share
            dialog to generate or copy the link, email it to recipients, and
            see who already has it.
          </Typography>
          <Button startIcon={<LinkIcon sx={{ fontSize: 16 }} />}
            onClick={() => onShareApproval()}
            sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, fontSize: 11,
              textTransform: 'none', px: 1.5, '&:hover': { bgcolor: '#3bd070' } }}>
            Share approval link
          </Button>
        </Box>
      </Box>

      {/* Approval events — what the client did on the shared link. The full
          merged history (admin + client) lives under Files & Activity. */}
      {(() => {
        const EV_META = {
          viewed:            { color: B.muted,   label: 'Viewed' },
          approved:          { color: B.green,   label: 'Approved' },
          requested_changes: { color: '#fbbf24', label: 'Requested changes' },
        };
        const events = [...(local.approvalEvents || [])]
          .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
        return (
          <Box sx={{ px: 2.5, pb: 2 }}>
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>
              Approval events · {events.length}
            </Typography>
            {events.length === 0 ? (
              <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, p: 1.5,
                textAlign: 'center', color: B.muted, fontSize: 11 }}>
                Nothing yet — events appear when the client opens, approves, or
                requests changes on the shared link.
              </Box>
            ) : (
              <Stack gap={0.5}>
                {events.slice(0, 15).map((e, i) => {
                  const km = EV_META[e.kind] || { color: B.muted, label: e.kind || '—' };
                  return (
                    <Box key={i} sx={{
                      display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 1, alignItems: 'start',
                      py: 0.5, borderBottom: `1px solid ${B.faint}`, fontSize: 11,
                    }}>
                      <Box sx={{ color: km.color, fontWeight: 700, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                        {km.label}
                      </Box>
                      <Box sx={{ color: B.white, fontSize: 11, whiteSpace: 'pre-wrap' }}>
                        {e.message || (e.kind === 'viewed' ? 'Client opened the approval page' : '—')}
                        {(e.by || e.email) && (
                          <Box component="span" sx={{ color: B.green, fontSize: 10, display: 'block', mt: 0.2 }}>
                            {[e.by, e.email && `<${e.email}>`].filter(Boolean).join(' ')}
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace', textAlign: 'right' }}>
                        {fmtRelative(e.at)}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        );
      })()}

      {/* Client tracking timeline — shown to the client on the same approval
          link after they approve. Admin ticks off steps as the project moves
          and the client's open page updates within a minute. */}
      <TrackingPanel project={local} authHdr={authHdr} onLocal={setLocal} />
      </>)}

      <PoBuilderDialog open={poOpen} project={project} authHdr={authHdr}
        onClose={() => setPoOpen(false)} />

      {/* Activity timeline — merges admin activity[] + client approvalEvents[] */}
      {tab === 'files' && (() => {
        const KIND_META = {
          // client-side approvalEvents
          viewed:             { color: B.muted,   label: 'Viewed',             actor: 'client' },
          approved:           { color: B.green,   label: 'Approved',           actor: 'client' },
          requested_changes:  { color: '#fbbf24', label: 'Requested changes',  actor: 'client' },
          // admin / system activity
          created:            { color: '#60a5fa', label: 'Created',            actor: 'admin'  },
          status_changed:     { color: '#a78bfa', label: 'Status changed',     actor: 'admin'  },
          paid_changed:       { color: B.green,   label: 'Paid changed',       actor: 'admin'  },
          duplicated_from:    { color: '#60a5fa', label: 'Cloned',             actor: 'admin'  },
          file_uploaded:      { color: '#2dd4bf', label: 'File uploaded',      actor: 'admin'  },
          mockups_linked:     { color: B.green,   label: 'Mockup linked',      actor: 'admin'  },
        };
        const merged = [
          ...(local.activity || []).map(e => ({ ...e, source: 'activity' })),
          ...(local.approvalEvents || []).map(e => ({ ...e, source: 'approval', actor: 'client' })),
        ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());

        if (merged.length === 0) return null;
        return (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>
            Activity · {merged.length}
          </Typography>
          <Stack gap={0.5}>
            {merged.slice(0, 15).map((e, i) => {
              const km = KIND_META[e.kind] || { color: B.muted, label: e.kind || '—', actor: e.actor || 'admin' };
              const actorTag = (e.actor || km.actor) === 'client' ? '· client' : '';
              return (
                <Box key={i} sx={{
                  display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 1, alignItems: 'start',
                  py: 0.5, borderBottom: `1px solid ${B.faint}`, fontSize: 11,
                }}>
                  <Box>
                    <Box sx={{ color: km.color, fontWeight: 700, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      {km.label}
                    </Box>
                    {actorTag && <Box sx={{ color: B.muted, fontSize: 9, fontStyle: 'italic' }}>{actorTag}</Box>}
                  </Box>
                  <Box sx={{ color: B.white, fontSize: 11, whiteSpace: 'pre-wrap' }}>
                    {e.message || (e.kind === 'viewed' ? 'Client opened the approval page' : '—')}
                    {(e.by || e.email) && (
                      <Box component="span" sx={{ color: B.green, fontSize: 10, display: 'block', mt: 0.2 }}>
                        {[e.by, e.email && `<${e.email}>`].filter(Boolean).join(' ')}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace', textAlign: 'right' }}>
                    {fmtRelative(e.at)}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
        );
      })()}

      {/* Pushes the footer to the drawer's bottom edge when the active tab's
          content is shorter than the viewport (sticky alone won't). */}
      <Box sx={{ flex: 1 }} />

      {/* Footer actions — visible on every tab */}
      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: B.bg, borderTop: `1px solid ${B.border}`,
        px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace', flex: 1 }}>
          Updated {fmtRelative(local.updatedAt)}
        </Typography>
        {/* Open Quote · Confirmation · POs — the three docs, reachable from every
            tab (the Overview tab also lists them inline under "Documents"). */}
        <Button startIcon={<RequestQuoteOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => onOpenQuote()}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          Quote
        </Button>
        <Button startIcon={<DescriptionOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => onOpenConfirmation()}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          Confirmation
        </Button>
        <Button startIcon={<ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => setPoOpen(true)}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          POs
        </Button>
        {/* "Share for approval" lives on the Approval tab (and in the
            confirmation builder's header) — not in this footer. */}
        <Button startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
          onClick={() => onDelete(project._id)}
          sx={{ color: '#f87171', fontSize: 11, textTransform: 'none' }}>
          Delete project
        </Button>
      </Box>
    </Drawer>
  );
}

// One "Documents" action: a labeled button with a tiny state hint and a
// ready/not-ready dot. Replaces the old inline quote preview — the owner opens
// the doc instead of skimming a mini-table.
function DocAction({ icon, label, hint, ready, onClick }) {
  return (
    <Button onClick={onClick} startIcon={icon}
      sx={{ flex: 1, justifyContent: 'flex-start', textTransform: 'none', color: B.white,
        border: `1px solid ${B.border}`, borderRadius: 1.5, px: 1.5, py: 1, gap: 0.5,
        '&:hover': { borderColor: B.green, bgcolor: B.panelHi } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{label}</Typography>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ready ? B.green : B.muted, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 10, color: B.muted, lineHeight: 1.2 }}>{hint}</Typography>
        </Stack>
      </Box>
    </Button>
  );
}

// Multi-vendor strip: every DISTINCT supplier on a project, since a mixed
// promos + apparel job runs across several. Sources, merged + de-duped
// case-insensitively (first-seen casing wins):
//   • each confirmation item's printerName (the per-item supplier)
//   • the project-level printerName / supplier fields (the legacy single case)
//   • the generated POs' vendorName (fetched like FlowPipeline does)
// A single-supplier job renders one chip; none yet → a quiet hint. The PO fetch
// is best-effort and never blocks the render.
function SuppliersStrip({ project, authHdr }) {
  const [poVendors, setPoVendors] = useState([]);
  useEffect(() => {
    if (!project || !project._id) { setPoVendors([]); return undefined; }
    let cancelled = false;
    setPoVendors([]);
    axios.get(`${config.backendUrl}/api/orders/${project._id}/pos`, authHdr)
      .then(r => { if (!cancelled) setPoVendors((r.data.pos || []).map(p => p && p.vendorName).filter(Boolean)); })
      .catch(() => { if (!cancelled) setPoVendors([]); });
    return () => { cancelled = true; };
  }, [project?._id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const confItems = (project.confirmation && Array.isArray(project.confirmation.items)) ? project.confirmation.items : [];
  const raw = [
    ...confItems.map(it => it && it.printerName),
    project.printerName,
    project.supplier,
    ...poVendors,
  ];
  const seen = new Map();   // lowercased -> display
  raw.forEach(name => {
    const s = String(name || '').trim();
    if (!s) return;
    const k = s.toLowerCase();
    if (!seen.has(k)) seen.set(k, s);
  });
  const suppliers = Array.from(seen.values());

  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
        {suppliers.length > 1 ? `Suppliers · ${suppliers.length}` : 'Supplier'}
      </Typography>
      {suppliers.length === 0 ? (
        <Typography sx={{ color: B.muted, fontSize: 11, fontStyle: 'italic' }}>
          None set yet — add a printer above, or build the confirmation / POs.
        </Typography>
      ) : (
        <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
          {suppliers.map((s, i) => (
            <Chip key={i} size="small" label={s}
              sx={{ bgcolor: B.panelHi, color: B.white, border: `1px solid ${B.border}`,
                fontSize: 11, maxWidth: 220, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function InlineField({ label, value, onChange, onBlur, type = 'text', multiline = false, savingHint }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const noSpinner = type === 'number' ? {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  } : {};
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.3 }}>
        {label} {savingHint && <CircularProgress size={9} sx={{ color: B.green, ml: 0.5 }} />}
      </Typography>
      <TextField
        size="small"
        fullWidth
        type={type}
        multiline={multiline}
        minRows={multiline ? 2 : undefined}
        value={v}
        onChange={e => { setV(e.target.value); onChange?.(e.target.value); }}
        onBlur={e => onBlur?.(e.target.value)}
        sx={{ ...darkInput, ...noSpinner }}
      />
    </Box>
  );
}

function InlineSelect({ label, value, options, onChange, savingHint }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.3 }}>
        {label} {savingHint && <CircularProgress size={9} sx={{ color: B.green, ml: 0.5 }} />}
      </Typography>
      <FormControl size="small" fullWidth>
        <Select value={value} onChange={e => onChange(e.target.value)} sx={{
          ...darkInput['& .MuiOutlinedInput-root'],
          color: B.white,
          '& .MuiSelect-icon': { color: B.muted },
        }}>
          {options.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </Select>
      </FormControl>
    </Box>
  );
}

// Read-only money cell — used for Total/COGS once they derive from the
// confirmation, so the admin sees the number but can't hand-edit it.
function ReadonlyField({ label, value, hint }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.3 }}>
        {label}
      </Typography>
      <Box sx={{ height: 40, display: 'flex', alignItems: 'center', px: 1.5, borderRadius: 1,
        border: `1px solid ${B.faint}`, bgcolor: 'rgba(255,255,255,0.03)' }}>
        <Typography sx={{ color: B.white, fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{value}</Typography>
      </Box>
      {hint && <Typography sx={{ color: B.muted, fontSize: 9, mt: 0.3, fontStyle: 'italic' }}>{hint}</Typography>}
    </Box>
  );
}

// ── ActualCostStrip ──────────────────────────────────────────────────────────
// The receipts Nate uploads are the real source of truth for what an order COST;
// the estimate (quote/confirmation) is the plan. This strip surfaces the ACTUAL
// (Σ of the order's linked COGS expense receipts, from the finance ledger) as the
// headline next to the estimate, so the real number — and any variance, or a
// missing receipt — is visible right on the order. Reads the per-order actuals the
// backend computes with the shared finance math (so it equals the finance tab's
// by-order cost). When no receipts are linked yet, it says so plainly instead of
// implying the cost is $0.
function ActualCostStrip({ actual, estCogs, orderNumber }) {
  const est = Number(estCogs) || 0;
  const loading = actual === null;       // fetch in flight (or no order # yet)
  const has = !!(actual && actual.hasReceipts);
  const actualCost = has ? Number(actual.actualCost) || 0 : 0;
  const variance = actualCost - est;     // + over the estimate, − under
  // No order number → can't link receipts at all; keep the strip quiet.
  if (!orderNumber) return null;
  return (
    <Box sx={{ borderRadius: 1.5, px: 1.5, py: 1, border: `1px solid ${has ? 'rgba(74,222,128,0.35)' : B.faint}`,
      bgcolor: has ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.02)' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Box>
          <Typography sx={{ color: has ? B.green : B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Actual cost · from receipts
          </Typography>
          {loading ? (
            <Typography sx={{ color: B.muted, fontSize: 13, mt: 0.2 }}>Checking receipts…</Typography>
          ) : has ? (
            <Typography sx={{ color: B.white, fontSize: 16, fontWeight: 800, fontFamily: 'monospace', mt: 0.1 }}>
              {fmt(actualCost)}
              <Typography component="span" sx={{ color: B.muted, fontSize: 10.5, fontWeight: 600, ml: 0.6 }}>
                from {actual.receiptCount} receipt{actual.receiptCount === 1 ? '' : 's'}
              </Typography>
            </Typography>
          ) : (
            <Typography sx={{ color: '#fbbf24', fontSize: 12.5, fontWeight: 700, mt: 0.1 }}>
              No receipts linked yet — showing the estimate
            </Typography>
          )}
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>Est</Typography>
          <Typography sx={{ color: B.muted, fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{fmt(est)}</Typography>
        </Box>
      </Stack>
      {has && est > 0 && Math.abs(variance) >= 0.005 && (
        <Typography sx={{ fontSize: 10.5, mt: 0.5, color: variance > 0 ? '#fbbf24' : B.green }}>
          {variance > 0 ? `${fmt(variance)} over estimate` : `${fmt(-variance)} under estimate`}
        </Typography>
      )}
    </Box>
  );
}

// ── ItemsEditor ──────────────────────────────────────────────────────────────
// Real line-item editor (replaces the textarea). Adds/removes rows, edits qty,
// description, unit price; auto-sums totalValue on commit.
// Lightweight items editor for Order Tracker — just qty + description.
// Real cost-breakdown quoting (blank cost, print cost, etc.) lives in the
// dedicated quoter (not built yet).
function ItemsEditor({ items, onChange, onCommit, saving }) {
  const list = items && items.length > 0 ? items : [];
  // onChange updates parent state asynchronously, so the `list` a blur handler
  // closes over can trail the last keystroke. Track the freshest array in a ref
  // and commit THAT on blur, so the final edit is never dropped. Reset whenever
  // the parent supplies a new array (a blur with no fresh edit commits `list`).
  const draftRef = useRef(null);
  useEffect(() => { draftRef.current = null; }, [items]);

  const update = (i, patch) => {
    const next = list.map((x, idx) => idx === i ? { ...x, ...patch } : x);
    draftRef.current = next;
    onChange(next);
  };
  const commit = () => onCommit(draftRef.current || list);
  const remove = (i) => {
    const next = list.filter((_, idx) => idx !== i);
    draftRef.current = next;
    onChange(next);
    onCommit(next);
  };
  const add = () => {
    const next = [...list, { description: '', qty: 1, unitPrice: 0 }];
    draftRef.current = next;
    onChange(next);
  };

  // CSS to strip the native number spinners on QTY inputs.
  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Items {saving && <CircularProgress size={9} sx={{ color: B.green, ml: 0.5 }} />}
        </Typography>
        <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
          onClick={add}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          Add line
        </Button>
      </Stack>
      {list.length === 0 ? (
        <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, p: 1.5, textAlign: 'center', color: B.muted, fontSize: 11 }}>
          No items yet. Add one to describe what&apos;s in this project.
        </Box>
      ) : (
        <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '68px 1fr 28px',
            gap: 0.5, px: 0.8, py: 0.4, bgcolor: B.panelHi,
            fontSize: 9, fontWeight: 700, color: B.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            <Box>Qty</Box>
            <Box>Description</Box>
            <Box />
          </Box>
          {list.map((it, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '68px 1fr 28px',
              gap: 0.5, alignItems: 'center', px: 0.8, py: 0.4,
              borderTop: `1px solid ${B.faint}` }}>
              <TextField size="small" type="number" value={it.qty || ''}
                onChange={e => update(i, { qty: e.target.value })}
                onBlur={commit}
                sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.4, textAlign: 'right' } }} />
              <TextField size="small" value={it.description || ''}
                onChange={e => update(i, { description: e.target.value })}
                onBlur={commit}
                placeholder="50 Bella+Canvas 3001, Black, screen print"
                sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.4 } }} />
              <IconButton size="small" onClick={() => remove(i)}
                sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
                <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── MockupHealthDialog ───────────────────────────────────────────────────────
// Diagnostic view of the link state between projects' mockupNumbers[] and the
// jpstudio library. Shows totals, then drills into missing #s (projects that
// reference a mockup not in the studio) and orphans (studio items not used
// by any project).
function MockupHealthDialog({ open, data, loading, projects, onClose, onJumpToProject }) {
  const [tab, setTab] = React.useState('missing');

  React.useEffect(() => { if (open) setTab('missing'); }, [open]);

  const summary = data && data.summary;
  const list = data ? (data[tab] || []) : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <FactCheckOutlinedIcon sx={{ color: B.green, fontSize: 18 }} />
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Mockup health
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: B.green }} />
          </Box>
        ) : !data ? (
          <Typography sx={{ color: B.muted, fontSize: 12 }}>No data.</Typography>
        ) : (
          <>
            {/* Summary tiles */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1, mb: 2 }}>
              <HealthStat label="Projects"     value={summary.projects} />
              <HealthStat label="Studio items" value={summary.libraryItems} />
              <HealthStat label="Linked"       value={summary.linked}      accent={B.green} />
              <HealthStat label="Auto-matched" value={summary.autoMatched ?? 0} accent={(summary.autoMatched ?? 0) > 0 ? B.green : undefined} />
              <HealthStat label="Missing"      value={summary.missing}     accent={summary.missing > 0 ? '#fbbf24' : undefined} />
              <HealthStat label="Orphans"      value={summary.orphans}     accent={summary.orphans > 0 ? '#60a5fa' : undefined} />
            </Box>

            {/* Tabs */}
            <Stack direction="row" gap={0.5} mb={1.5} flexWrap="wrap">
              {[
                { id: 'missing',     label: `Missing (${summary.missing})`,             color: '#fbbf24' },
                { id: 'linked',      label: `Linked (${summary.linked})`,               color: B.green   },
                { id: 'autoMatched', label: `Auto-matched (${summary.autoMatched ?? 0})`, color: B.green   },
                { id: 'orphans',     label: `Orphans (${summary.orphans})`,             color: '#60a5fa' },
              ].map(t => {
                const active = tab === (t.id === 'linked' ? 'matched' : t.id);
                return (
                  <Box key={t.id} onClick={() => setTab(t.id === 'linked' ? 'matched' : t.id)}
                    sx={{
                      px: 1.5, py: 0.6, borderRadius: 1, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      bgcolor: active ? t.color : 'rgba(255,255,255,0.04)',
                      color: active ? B.greenDk : B.muted,
                      border: `1px solid ${active ? t.color : 'rgba(255,255,255,0.08)'}`,
                      '&:hover': { color: active ? B.greenDk : B.white },
                    }}>
                    {t.label}
                  </Box>
                );
              })}
            </Stack>

            {/* Hint */}
            <Typography sx={{ color: B.muted, fontSize: 11, mb: 1 }}>
              {tab === 'missing'     && 'These mockup #s are assigned to projects but don\'t exist in your jpstudio library. Open jpstudio, pick the project, and save a mockup with the matching #.'}
              {tab === 'matched'     && 'These project mockup #s are paired with a library item. Healthy state.'}
              {tab === 'autoMatched' && 'These library mockups aren\'t in any project\'s mockupNumbers list, but their client name matches a project — they auto-appear there with the green AUTO badge. Open the project drawer + hit Tidy to make the link permanent.'}
              {tab === 'orphans'     && 'These library mockups aren\'t referenced by any project AND don\'t client-match any project. Probably drafts or mockups for a client you haven\'t created a project for yet.'}
            </Typography>

            {/* List */}
            {list.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: B.muted, fontSize: 12 }}>
                Nothing here. ✓
              </Box>
            ) : (
              <Box sx={{ maxHeight: 360, overflow: 'auto', ...scrollbar, border: `1px solid ${B.border}`, borderRadius: 1 }}>
                {list.map((row, i) => (
                  <Box key={i} sx={{
                    px: 1.5, py: 0.8, display: 'flex', alignItems: 'center', gap: 1.5,
                    fontSize: 12, borderBottom: `1px solid ${B.faint}`,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                  }}>
                    <Typography sx={{ color: B.white, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, minWidth: 78 }}>
                      {row.mockupNum || '—'}
                    </Typography>
                    <Typography sx={{ flex: 1, color: B.white, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.companyName || row.clientName || row.client || row.itemName || row.name || 'Untitled'}
                    </Typography>
                    {row.projectNumber && (
                      <Box onClick={() => onJumpToProject(row.projectNumber)}
                        sx={{ cursor: 'pointer', color: B.green, fontSize: 10, fontWeight: 700,
                          fontFamily: 'monospace', '&:hover': { textDecoration: 'underline' } }}>
                        Open #{row.projectNumber}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HealthStat({ label, value, accent }) {
  return (
    <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${B.faint}`, borderRadius: 1, p: 1 }}>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ color: accent || B.white, fontSize: 18, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1, mt: 0.2 }}>
        {value}
      </Typography>
    </Box>
  );
}

// ── AutoLinkDialog ───────────────────────────────────────────────────────────
// Preview + apply for the auto-link scan. Shows which orphan jpstudio mockups
// can be attached to a project (by batch number or company name) before the
// user commits the bulk update. Nothing changes until Apply is pressed.
function AutoLinkDialog({ open, data, loading, applying, onClose, onApply }) {
  const summary   = data && data.summary;
  const links     = (data && data.links) || [];
  const ambiguous = (data && data.ambiguous) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoFixHighIcon sx={{ color: B.green, fontSize: 18 }} />
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Auto-link library mockups
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: B.green }} />
          </Box>
        ) : !data || !summary ? (
          <Typography sx={{ color: B.muted, fontSize: 12 }}>No data.</Typography>
        ) : (
          <>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1, mb: 2 }}>
              <HealthStat label="Library"        value={summary.libraryMockups} />
              <HealthStat label="Already linked" value={summary.alreadyLinked} />
              <HealthStat label="To link"        value={summary.proposed}  accent={summary.proposed  > 0 ? B.green : undefined} />
              <HealthStat label="Ambiguous"      value={summary.ambiguous} accent={summary.ambiguous > 0 ? '#fbbf24' : undefined} />
              <HealthStat label="Unmatched"      value={summary.unmatched} accent={summary.unmatched > 0 ? '#60a5fa' : undefined} />
            </Box>

            {links.length > 0 && (
              <>
                <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
                  Will link {summary.proposed} mockup{summary.proposed === 1 ? '' : 's'} → {summary.projectsAffected} project{summary.projectsAffected === 1 ? '' : 's'}
                </Typography>
                <Box sx={{ maxHeight: 300, overflow: 'auto', ...scrollbar, border: `1px solid ${B.border}`,
                  borderRadius: 1, mb: ambiguous.length ? 2 : 0 }}>
                  {links.map((l, i) => (
                    <Box key={i} sx={{ px: 1.5, py: 0.8, display: 'flex', alignItems: 'center', gap: 1.5,
                      fontSize: 12, borderBottom: `1px solid ${B.faint}` }}>
                      <Typography sx={{ color: B.white, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, minWidth: 78 }}>
                        {l.mockupNum || '—'}
                      </Typography>
                      <Typography sx={{ flex: 1, color: B.white, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.itemName || 'Untitled'}
                      </Typography>
                      <Typography sx={{ color: B.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', maxWidth: 150, textAlign: 'right' }}>
                        #{l.projectNumber} · {l.projectCompany || '—'}
                      </Typography>
                      <Box sx={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                        color: l.via === 'base' ? B.green : '#60a5fa',
                        border: `1px solid ${l.via === 'base' ? B.green : '#60a5fa'}`,
                        borderRadius: 0.5, px: 0.5, py: 0.1, whiteSpace: 'nowrap' }}>
                        {l.via === 'base' ? 'batch #' : 'name'}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {ambiguous.length > 0 && (
              <>
                <Typography sx={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
                  {ambiguous.length} ambiguous — link these by hand
                </Typography>
                <Box sx={{ maxHeight: 160, overflow: 'auto', ...scrollbar, border: `1px solid ${B.border}`, borderRadius: 1 }}>
                  {ambiguous.map((a, i) => (
                    <Box key={i} sx={{ px: 1.5, py: 0.8, fontSize: 12, borderBottom: `1px solid ${B.faint}` }}>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Typography sx={{ color: B.white, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, minWidth: 78 }}>
                          {a.mockupNum || '—'}
                        </Typography>
                        <Typography sx={{ flex: 1, color: B.white, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.itemName || 'Untitled'}
                        </Typography>
                      </Stack>
                      <Typography sx={{ color: B.muted, fontSize: 10, mt: 0.3 }}>
                        Matches: {(a.candidates || []).map(c => `#${c.projectNumber} ${c.companyName}`).join(' · ')}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {links.length === 0 && ambiguous.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4, color: B.muted, fontSize: 12 }}>
                Nothing to link — every library mockup is already attached. ✓
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: B.muted }} disabled={applying}>Close</Button>
        <Button onClick={onApply} variant="contained"
          disabled={applying || loading || !summary || summary.proposed === 0}
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700 }}>
          {applying ? <CircularProgress size={16} sx={{ color: B.greenDk }} />
            : `Apply${summary && summary.proposed ? ` · ${summary.proposed}` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Split a free-text field ("a@x.com, b@y.com  c@z.com") into a deduped list.
// The backend re-validates and reports any address it couldn't use.
function parseEmails(str) {
  const seen = new Set();
  return String(str || '')
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(e => { const k = e.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

// ── ShareApprovalDialog ──────────────────────────────────────────────────────
// One shared "hub" link for a project's approval page. Send it to as many people
// as needed — everyone gets the SAME URL, and the first approve / change-request
// locks it in (enforced atomically server-side). Adding a recipient never breaks
// the people already invited; "Start a fresh link" is the only thing that rotates
// the token, for when the quote/proof has changed.
function ShareApprovalDialog({ state, setTtl, setEmails, onClose, onSend, onStartFresh }) {
  const { open, ttl, emails, url, expiresAt, recipients = [], status, loading, busy, err, notice } = state;
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { if (open) setCopied(false); }, [open, url]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch (_) { /* clipboard blocked — user can still select+copy */ }
  };
  const kind = status && status.status;
  const statusLabel = kind === 'approved'
    ? `Approved${status.by ? ` by ${status.by}` : ''}${status.at ? ` · ${new Date(status.at).toLocaleDateString()}` : ''}`
    : kind === 'requested_changes'
      ? `Changes requested${status.by ? ` by ${status.by}` : ''}`
      : 'Awaiting review';
  const statusColor = kind === 'approved' ? B.green : kind === 'requested_changes' ? '#fbbf24' : B.muted;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon sx={{ color: B.green, fontSize: 18 }} />
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>Share approval link</Typography>
        <IconButton size="small" onClick={onClose} disabled={busy}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress size={22} sx={{ color: B.green }} /></Box>
        ) : (
          <>
            <Typography sx={{ color: B.muted, fontSize: 12, mb: 2 }}>
              One shared link for everyone who needs to weigh in — send it to as many people as you like.
              They all see the same page, and the first approval (or change request) locks it in.
            </Typography>

            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusColor }} />
              <Typography sx={{ color: statusColor, fontSize: 12, fontWeight: 700 }}>{statusLabel}</Typography>
            </Stack>

            {url && (
              <>
                <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.5 }}>
                  Shared link
                </Typography>
                <Stack direction="row" gap={1} sx={{ mb: 0.5 }}>
                  <TextField fullWidth value={url} InputProps={{ readOnly: true }} onFocus={e => e.target.select()}
                    sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 12, fontFamily: 'monospace', py: 0.7 } }} />
                  <Button variant="contained" onClick={copy}
                    sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}>
                    {copied ? 'Copied ✓' : 'Copy'}
                  </Button>
                </Stack>
                {/* See exactly what the client sees — read-only, no view logged,
                    works even after they've approved. */}
                <Button onClick={() => window.open(`${url}&preview=1`, '_blank', 'noopener')}
                  startIcon={<VisibilityOutlinedIcon sx={{ fontSize: 16 }} />}
                  sx={{ color: B.green, fontSize: 12, textTransform: 'none', fontWeight: 700, px: 0.5, mb: 1 }}>
                  Preview as client
                </Button>
                {expiresAt && (
                  <Typography sx={{ color: B.muted, fontSize: 11, mb: 2 }}>
                    Works until {new Date(expiresAt).toLocaleString()}.
                  </Typography>
                )}
              </>
            )}

            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mt: 1, mb: 0.5 }}>
              Email it to one or more people
            </Typography>
            <TextField fullWidth multiline minRows={2} value={emails || ''}
              placeholder="client@company.com, partner@company.com"
              onChange={e => setEmails(e.target.value)}
              sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 13 } }} />
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
              <Button variant="contained" disabled={busy || !String(emails || '').trim()} onClick={onSend}
                startIcon={busy ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : <SendIcon sx={{ fontSize: 16 }} />}
                sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, textTransform: 'none' }}>
                Send
              </Button>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography sx={{ color: B.muted, fontSize: 12 }}>Live for</Typography>
                <TextField type="number" size="small" value={ttl} onChange={e => setTtl(e.target.value)}
                  inputProps={{ min: 1, max: 365 }}
                  sx={{ width: 64, ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 13, py: 0.5, textAlign: 'right' } }} />
                <Typography sx={{ color: B.muted, fontSize: 12 }}>days</Typography>
              </Stack>
            </Stack>

            {notice && <Typography sx={{ color: B.green, fontSize: 12, mt: 1.5 }}>{notice}</Typography>}
            {err && <Typography sx={{ color: '#f87171', fontSize: 12, mt: 1.5 }}>{err}</Typography>}

            {recipients.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
                  Already sent to ({recipients.length})
                </Typography>
                <Stack gap={0.3}>
                  {recipients.map((r, i) => (
                    <Stack key={i} direction="row" justifyContent="space-between" alignItems="center"
                      sx={{ fontSize: 12, color: B.white, borderBottom: `1px solid ${B.faint}`, py: 0.35 }}>
                      <span>{r.email}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                        {r.sentAt ? new Date(r.sentAt).toLocaleDateString() : ''}
                      </span>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            <Box sx={{ mt: 2.5, pt: 1.5, borderTop: `1px solid ${B.faint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button onClick={onStartFresh} disabled={busy}
                sx={{ color: B.muted, fontSize: 11, textTransform: 'none', '&:hover': { color: '#f87171', bgcolor: 'transparent' } }}>
                Start a fresh link
              </Button>
              <Button onClick={onClose} disabled={busy}
                sx={{ color: B.muted, textTransform: 'none', fontSize: 12 }}>
                Done
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── ClientLogoSlot ────────────────────────────────────────────────────────────
// 40×40 logo well used in the drawer header. Empty state = upload icon + click
// target. Filled = the logo with hover overlay to swap or remove.
function ClientLogoSlot({ logo, companyName, onUpload, onRemove }) {
  const inputRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const trigger = () => inputRef.current?.click();
  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { await onUpload(file); } finally { setBusy(false); e.target.value = ''; }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onChange} />
      {logo ? (
        <Box onClick={trigger} title={`Replace ${companyName} logo`}
          sx={{
            width: 44, height: 44, p: 0.5, borderRadius: 1, cursor: 'pointer',
            bgcolor: '#fff', border: `1px solid ${B.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
            '&:hover .logo-overlay': { opacity: 1 },
          }}>
          <Box component="img" src={logo} alt=""
            sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          <Box className="logo-overlay" sx={{
            position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.55)',
            color: B.white, fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.12s',
          }}>{busy ? '…' : 'REPLACE'}</Box>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            sx={{
              position: 'absolute', top: -8, right: -8, p: 0.2, bgcolor: B.bg,
              color: '#f87171', border: `1px solid ${B.border}`,
              '&:hover': { bgcolor: B.bg, color: '#f87171' },
            }}>
            <CloseIcon sx={{ fontSize: 11 }} />
          </IconButton>
        </Box>
      ) : (
        <Box onClick={trigger} title={`Add logo for ${companyName || 'this company'}`}
          sx={{
            width: 44, height: 44, borderRadius: 1, cursor: 'pointer',
            border: `1px dashed ${B.border}`, bgcolor: 'rgba(255,255,255,0.02)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: B.muted, '&:hover': { borderColor: B.green, color: B.green },
          }}>
          {busy ? <CircularProgress size={14} sx={{ color: B.green }} /> : <ImageOutlinedIcon sx={{ fontSize: 18 }} />}
        </Box>
      )}
    </Box>
  );
}

// ── AnalyticsDialog ──────────────────────────────────────────────────────────
// Lightweight visual dashboard: revenue by month bar chart (pure CSS,
// no chart library), top clients by delivered revenue, top garment styles
// by qty across all quote lines, overall margin %.
function AnalyticsDialog({ open, data, loading, onClose }) {
  const months = (data && data.revenueByMonth) || [];
  const maxRev = months.reduce((m, x) => Math.max(m, x.revenue || 0), 0);
  const topClients = (data && data.topClients) || [];
  const overall    = (data && data.overall)    || { revenue: 0, cogs: 0, margin: 0, marginPct: 0 };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <InsightsOutlinedIcon sx={{ color: B.green, fontSize: 18 }} />
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Analytics
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        {loading || !data ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: B.green }} />
          </Box>
        ) : (
          <>
            {/* Overall margin */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(auto-fit, minmax(140px, 1fr))' }, gap: 1, mb: 2.5 }}>
              <HealthStat label="Lifetime revenue" value={fmt(overall.revenue)} accent={B.green} />
              <HealthStat label="Lifetime COGS"    value={fmt(overall.cogs)} />
              <HealthStat label="Profit"           value={fmt(overall.margin)} accent={overall.margin > 0 ? B.green : '#f87171'} />
              <HealthStat label="Margin %"         value={`${overall.marginPct.toFixed(1)}%`} accent={overall.marginPct >= 30 ? B.green : '#fbbf24'} />
            </Box>

            {/* Revenue by month */}
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>
              Delivered revenue · last 12 months
            </Typography>
            {maxRev === 0 ? (
              <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, p: 2, textAlign: 'center', color: B.muted, fontSize: 12, mb: 2.5 }}>
                No delivered revenue in the last 12 months.
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.4, height: 140, mb: 0.5,
                borderBottom: `1px solid ${B.faint}`, pb: 0.4 }}>
                {months.map((m, i) => {
                  const h = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0;
                  return (
                    <Box key={i} title={`${m.month} · ${fmt(m.revenue)} · ${m.orders} order${m.orders === 1 ? '' : 's'}`}
                      sx={{
                        flex: 1, height: '100%', position: 'relative',
                        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        cursor: 'help',
                      }}>
                      {m.revenue > 0 && (
                        <Typography sx={{
                          color: B.muted, fontSize: 8, fontWeight: 700, fontFamily: 'monospace',
                          textAlign: 'center', mb: 0.3,
                        }}>
                          {Math.round(m.revenue / 1000)}k
                        </Typography>
                      )}
                      <Box sx={{
                        height: `${Math.max(h, m.revenue > 0 ? 2 : 0)}%`, width: '100%',
                        bgcolor: m.revenue > 0 ? B.green : 'rgba(255,255,255,0.06)',
                        borderRadius: '2px 2px 0 0',
                        opacity: m.revenue > 0 ? 0.9 : 0.4,
                        transition: 'opacity 0.12s',
                        '&:hover': { opacity: 1 },
                      }} />
                    </Box>
                  );
                })}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 0.4, mb: 2.5 }}>
              {months.map((m, i) => (
                <Box key={i} sx={{ flex: 1, textAlign: 'center', color: B.muted, fontSize: 8, fontFamily: 'monospace' }}>
                  {m.month.slice(5)}
                </Box>
              ))}
            </Box>

            {/* Top clients */}
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>
              Top clients · all-time delivered
            </Typography>
            {topClients.length === 0 ? (
              <Box sx={{ color: B.muted, fontSize: 12, mb: 2.5 }}>No delivered revenue yet.</Box>
            ) : (
              <Box sx={{ mb: 2.5 }}>
                {topClients.map((c, i) => {
                  const max = topClients[0].revenue || 1;
                  const w = (c.revenue / max) * 100;
                  return (
                    <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 90px', alignItems: 'center', gap: 1, py: 0.6, borderBottom: `1px solid ${B.faint}` }}>
                      <Box sx={{ position: 'relative' }}>
                        <Box sx={{ position: 'absolute', inset: 0, width: `${w}%`, bgcolor: 'rgba(74,222,128,0.08)', borderRadius: 0.5 }} />
                        <Box sx={{ position: 'relative', px: 1, py: 0.4 }}>
                          <Typography sx={{ color: B.white, fontSize: 12, fontWeight: 700 }}>
                            {c.companyName || c.clientName || c.companyKey}
                          </Typography>
                          <Typography sx={{ color: B.muted, fontSize: 10 }}>
                            {c.orders} order{c.orders === 1 ? '' : 's'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ color: B.green, fontSize: 13, fontWeight: 800, fontFamily: 'monospace', textAlign: 'right' }}>
                        {fmt(c.revenue)}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── ClientsDialog ────────────────────────────────────────────────────────────
// One row per unique client (by companyKey), with logo, project counts,
// delivered revenue, open value, unpaid AR, last activity. Click any row to
// filter the project grid down to that client.
function ClientsDialog({ open, data, loading, logoMap, onClose, onPickClient }) {
  const [q, setQ] = React.useState('');
  React.useEffect(() => { if (open) setQ(''); }, [open]);

  const clients = (data && data.clients) || [];
  const filtered = q.trim()
    ? clients.filter(c => (c.companyName || c.clientName || '').toLowerCase().includes(q.toLowerCase()))
    : clients;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <PeopleAltOutlinedIcon sx={{ color: B.green, fontSize: 18 }} />
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Clients · {clients.length}
        </Typography>
        <TextField size="small" placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)}
          sx={{ ...darkInput, width: 180 }} />
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        {loading || !data ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: B.green }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: B.muted, fontSize: 12 }}>
            {q ? 'No clients match.' : 'No clients yet.'}
          </Box>
        ) : (
          <Box sx={{ maxHeight: 500, overflow: 'auto', ...scrollbar }}>
            {filtered.map((c, i) => {
              const name = c.companyName || c.clientName || c.companyKey;
              const logo = logoMap && logoMap[c.companyKey];
              return (
                <Box key={i}
                  onClick={() => onPickClient(name)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '44px 1fr', sm: '44px 1fr 80px 110px 110px 90px' },
                    alignItems: 'center', gap: 1.2, px: 1, py: 1,
                    borderBottom: `1px solid ${B.faint}`, cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                    '& > *:nth-of-type(3)': { display: { xs: 'none', sm: 'block' } },
                    '& > *:nth-of-type(4)': { display: { xs: 'none', sm: 'block' } },
                    '& > *:nth-of-type(5)': { display: { xs: 'none', sm: 'block' } },
                    '& > *:nth-of-type(6)': { display: { xs: 'none', sm: 'block' } },
                  }}>
                  <Box sx={{
                    width: 36, height: 36, p: 0.4, borderRadius: 1,
                    bgcolor: logo ? '#fff' : B.panelHi, border: `1px solid ${B.faint}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {logo ? (
                      <Box component="img" src={logo} alt=""
                        sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <Typography sx={{ color: B.muted, fontSize: 14, fontWeight: 800 }}>
                        {name.charAt(0).toUpperCase()}
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography sx={{ color: B.white, fontSize: 13, fontWeight: 700,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </Typography>
                    {c.clientName && c.companyName && c.clientName !== c.companyName && (
                      <Typography sx={{ color: B.muted, fontSize: 11 }}>{c.clientName}</Typography>
                    )}
                    {/* Mobile-only compact stats line */}
                    <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1.2, mt: 0.3, fontSize: 10, fontFamily: 'monospace' }}>
                      <Box sx={{ color: B.muted }}>{c.projectCount} proj</Box>
                      <Box sx={{ color: B.green }}>{fmt(c.deliveredRevenue)}</Box>
                      {c.unpaidValue > 0 && <Box sx={{ color: '#fbbf24' }}>{fmt(c.unpaidValue)} unpaid</Box>}
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ color: B.white, fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                      {c.projectCount}
                    </Typography>
                    <Typography sx={{ color: B.muted, fontSize: 9 }}>projects</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: B.green, fontSize: 12, fontWeight: 800, fontFamily: 'monospace' }}>
                      {fmt(c.deliveredRevenue)}
                    </Typography>
                    <Typography sx={{ color: B.muted, fontSize: 9 }}>
                      {c.deliveredCount} delivered
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: c.unpaidValue > 0 ? '#fbbf24' : B.muted, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                      {fmt(c.unpaidValue)}
                    </Typography>
                    <Typography sx={{ color: B.muted, fontSize: 9 }}>unpaid</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', color: B.muted, fontSize: 10, fontFamily: 'monospace' }}>
                    {fmtRelative(c.lastActivity)}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── CleanupDialog ────────────────────────────────────────────────────────────
// Two sections:
// 1) Empty projects — projects with no company, no items, no quote, no mockups,
//    no files, no value. Usually leftover "New project" clicks. Bulk-delete.
// 2) Company name collisions — multiple companyName strings that all reduce to
//    the same companyKey (typos / variants). Merge into one canonical name.
function CleanupDialog({ open, data, loading, onClose, onBulkDelete, onMerge }) {
  const [selectedIds, setSelectedIds] = React.useState({});
  const [mergeTargets, setMergeTargets] = React.useState({});  // companyKey → chosen canonical name
  React.useEffect(() => { if (open) { setSelectedIds({}); setMergeTargets({}); } }, [open]);

  const empty = (data && data.empty) || [];
  const collisions = (data && data.nameCollisions) || [];
  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  const toggleAll = () => {
    if (selectedCount === empty.length) setSelectedIds({});
    else {
      const next = {};
      empty.forEach(e => { next[e._id] = true; });
      setSelectedIds(next);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <CleaningServicesOutlinedIcon sx={{ color: B.green, fontSize: 18 }} />
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>
          Cleanup
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        {loading || !data ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: B.green }} />
          </Box>
        ) : (
          <>
            {/* Empty projects */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Empty projects · {empty.length}
              </Typography>
              {empty.length > 0 && (
                <Stack direction="row" gap={1}>
                  <Button size="small" onClick={toggleAll}
                    sx={{ color: B.muted, fontSize: 11, textTransform: 'none' }}>
                    {selectedCount === empty.length ? 'Deselect all' : 'Select all'}
                  </Button>
                  <Button size="small"
                    onClick={() => onBulkDelete(Object.keys(selectedIds).filter(k => selectedIds[k]))}
                    disabled={selectedCount === 0}
                    sx={{ color: '#f87171', fontSize: 11, textTransform: 'none', fontWeight: 700 }}>
                    Delete selected ({selectedCount})
                  </Button>
                </Stack>
              )}
            </Stack>
            {empty.length === 0 ? (
              <Box sx={{ color: B.muted, fontSize: 12, mb: 3, p: 1.5, border: `1px dashed ${B.border}`, borderRadius: 1, textAlign: 'center' }}>
                Nothing empty. ✓
              </Box>
            ) : (
              <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1, mb: 3, maxHeight: 200, overflow: 'auto', ...scrollbar }}>
                {empty.map((e, i) => {
                  const checked = !!selectedIds[e._id];
                  return (
                    <Box key={i}
                      onClick={() => setSelectedIds(s => ({ ...s, [e._id]: !s[e._id] }))}
                      sx={{
                        display: 'grid', gridTemplateColumns: '20px 80px 1fr auto',
                        gap: 1, alignItems: 'center', px: 1, py: 0.6,
                        borderBottom: `1px solid ${B.faint}`, cursor: 'pointer',
                        bgcolor: checked ? 'rgba(248,113,113,0.06)' : 'transparent',
                        '&:hover': { bgcolor: checked ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)' },
                      }}>
                      <Box sx={{
                        width: 14, height: 14, border: `1.5px solid ${checked ? '#f87171' : B.muted}`,
                        bgcolor: checked ? '#f87171' : 'transparent',
                        borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <CloseIcon sx={{ color: '#fff', fontSize: 10 }} />}
                      </Box>
                      <Typography sx={{ color: B.white, fontSize: 11, fontFamily: 'monospace' }}>
                        #{e.projectNumber || '?'}
                      </Typography>
                      <Typography sx={{ color: B.muted, fontSize: 11 }}>
                        Untitled · status {e.status || '?'} · no items
                      </Typography>
                      <Typography sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace' }}>
                        {fmtRelative(e.createdAt)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* Company collisions */}
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>
              Company name variants · {collisions.length}
            </Typography>
            {collisions.length === 0 ? (
              <Box sx={{ color: B.muted, fontSize: 12, p: 1.5, border: `1px dashed ${B.border}`, borderRadius: 1, textAlign: 'center' }}>
                No accidental variants. Clients are deduped.
              </Box>
            ) : (
              <Stack gap={1}>
                {collisions.map((c, i) => {
                  const chosen = mergeTargets[c.companyKey] || c.variants[0].name;
                  const sources = c.variants.filter(v => v.name !== chosen);
                  return (
                    <Box key={i} sx={{ border: `1px solid ${B.border}`, borderRadius: 1, p: 1.2 }}>
                      <Typography sx={{ color: B.muted, fontSize: 10, mb: 0.5, fontFamily: 'monospace' }}>
                        key: {c.companyKey} · {c.projectCount} project{c.projectCount === 1 ? '' : 's'}
                      </Typography>
                      <Stack direction="row" gap={1} mb={1} flexWrap="wrap">
                        {c.variants.map((v, j) => (
                          <Chip key={j} size="small"
                            label={`${v.name} · ${v.count}`}
                            onClick={() => setMergeTargets(t => ({ ...t, [c.companyKey]: v.name }))}
                            sx={{
                              bgcolor: v.name === chosen ? B.green : 'rgba(255,255,255,0.04)',
                              color:   v.name === chosen ? B.greenDk : B.white,
                              fontWeight: v.name === chosen ? 700 : 500,
                              fontSize: 11,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: v.name === chosen ? B.green : 'rgba(255,255,255,0.08)' },
                            }}
                          />
                        ))}
                      </Stack>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Typography sx={{ color: B.muted, fontSize: 11, flex: 1 }}>
                          Click a name to choose canonical, then merge the rest into it.
                        </Typography>
                        {sources.map((s, j) => (
                          <Button key={j} size="small" onClick={() => onMerge(s.name, chosen)}
                            sx={{ color: B.green, fontSize: 11, textTransform: 'none', fontWeight: 700 }}>
                            Merge "{s.name}" → "{chosen}"
                          </Button>
                        ))}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}

            {/* Manual merge for non-collision cases (different keys entirely) */}
            <Box sx={{ mt: 3, p: 1.5, border: `1px dashed ${B.border}`, borderRadius: 1 }}>
              <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>
                Manual merge (different names, same client)
              </Typography>
              <ManualMergeForm onMerge={onMerge} />
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualMergeForm({ onMerge }) {
  const [from, setFrom] = React.useState('');
  const [to,   setTo]   = React.useState('');
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
      <TextField size="small" placeholder="From (e.g. Green Gold)"
        value={from} onChange={e => setFrom(e.target.value)} sx={{ ...darkInput, flex: 1 }} />
      <TextField size="small" placeholder="To (e.g. Bract House)"
        value={to} onChange={e => setTo(e.target.value)} sx={{ ...darkInput, flex: 1 }} />
      <Button onClick={() => { onMerge(from.trim(), to.trim()); setFrom(''); setTo(''); }}
        disabled={!from.trim() || !to.trim()}
        sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#3bd070' } }}>
        Merge
      </Button>
    </Stack>
  );
}

// ── TasksSection ─────────────────────────────────────────────────────────────
// Lightweight per-project checklist. Add a line, check it off, see when it
// was completed. Saves on blur / toggle. Different from notes — these are
// the "what's left to do" list that prevents things falling through.
function TasksSection({ local, updateLocal, saveField, savingField }) {
  const tasks = local.tasks || [];
  const remaining = tasks.filter(t => !t.done).length;
  const [draft, setDraft] = React.useState('');

  const update = (next) => {
    updateLocal({ tasks: next });
    saveField('tasks', next);
  };
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    update([...tasks, { text, done: false, dueDate: null, completedAt: null }]);
    setDraft('');
  };
  const toggle = (i) => {
    update(tasks.map((t, j) => j === i
      ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : null }
      : t));
  };
  const remove = (i) => update(tasks.filter((_, j) => j !== i));

  return (
    <Box sx={{ px: 2.5, pb: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Tasks · {remaining}/{tasks.length}
          {savingField === 'tasks' && <CircularProgress size={9} sx={{ color: B.green, ml: 0.5 }} />}
        </Typography>
      </Stack>
      <Stack gap={0.4}>
        {tasks.length === 0 && (
          <Typography sx={{ color: B.muted, fontSize: 11, fontStyle: 'italic', mb: 0.5 }}>
            No tasks. Add one to track what's left on this project.
          </Typography>
        )}
        {tasks.map((t, i) => (
          <Stack key={i} direction="row" alignItems="center" gap={0.5}
            sx={{ py: 0.4, borderBottom: `1px solid ${B.faint}`, fontSize: 12 }}>
            <Box onClick={() => toggle(i)} sx={{
              width: 16, height: 16, borderRadius: 0.5, cursor: 'pointer',
              border: `1.5px solid ${t.done ? B.green : 'rgba(255,255,255,0.3)'}`,
              bgcolor: t.done ? B.green : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: B.greenDk, fontSize: 11, fontWeight: 900, lineHeight: 1,
            }}>
              {t.done && '✓'}
            </Box>
            <Box sx={{ flex: 1, color: t.done ? B.muted : B.white, fontSize: 12,
              textDecoration: t.done ? 'line-through' : 'none' }}>
              {t.text}
            </Box>
            {t.done && t.completedAt && (
              <Typography sx={{ color: B.muted, fontSize: 9, fontFamily: 'monospace' }}>
                {fmtRelative(t.completedAt)}
              </Typography>
            )}
            <IconButton size="small" onClick={() => remove(i)}
              sx={{ color: B.muted, p: 0.2, '&:hover': { color: '#f87171' } }}>
              <RemoveCircleOutlineIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" gap={0.5} mt={0.6}>
        <TextField size="small" fullWidth placeholder="New task — Enter to add"
          value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.5 } }} />
        <Button size="small" onClick={add} disabled={!draft.trim()}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          Add
        </Button>
      </Stack>
    </Box>
  );
}

// ── ClientProfileSection ─────────────────────────────────────────────────────
// Sticky per-company info (email, phone, payment terms, default printer /
// supplier / markup, freeform notes) that follows the client across every
// project of theirs. Defaults auto-fill on new projects (server-side).
function ClientProfileSection({ client, saving, saveClient }) {
  const [open, setOpen] = React.useState(false);
  if (!client) return null;

  const Field = ({ label, field, type = 'text', multiline = false }) => {
    const [v, setV] = React.useState(client[field] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => { setV(client[field] ?? ''); }, [client[field], field]);
    const noSpinner = type === 'number' ? {
      '& input[type=number]': { MozAppearance: 'textfield' },
      '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
      '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
    } : {};
    return (
      <Box>
        <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.2 }}>
          {label} {saving === field && <CircularProgress size={8} sx={{ color: B.green, ml: 0.5 }} />}
        </Typography>
        <TextField size="small" fullWidth type={type} multiline={multiline}
          minRows={multiline ? 2 : undefined}
          value={v}
          onChange={e => setV(e.target.value)}
          onBlur={e => {
            const next = type === 'number' ? Number(e.target.value) || 0 : e.target.value;
            if (next !== client[field]) saveClient(field, next);
          }}
          sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.5 } }} />
      </Box>
    );
  };

  return (
    <Box sx={{ px: 2.5, pb: 2 }}>
      <Stack direction="row" alignItems="center" gap={0.5} onClick={() => setOpen(o => !o)}
        sx={{ cursor: 'pointer', mb: open ? 1 : 0,
          '&:hover .lbl': { color: B.white } }}>
        <Typography className="lbl" sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Client profile {open ? '▾' : '▸'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ color: B.muted, fontSize: 10, fontStyle: 'italic' }}>
          Follows the company across every project
        </Typography>
      </Stack>
      {open && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
          <Field label="Email"            field="email" />
          <Field label="Phone"            field="phone" />
          <Field label="Payment terms"    field="paymentTerms" />
          <Field label="Default markup"   field="defaultMarkup" type="number" />
          <Field label="Default printer"  field="defaultPrinter" />
          <Field label="Default supplier" field="defaultSupplier" />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Field label="Sticky notes (per client)" field="notes" multiline />
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── TrackingPanel ───────────────────────────────────────────────────────────
// Client-facing order tracking timeline editor. Admin checks off each step
// as it happens; the client (viewing the same approval link) sees the
// timeline fill in green within ~60s. Edits are saved by PATCHing the whole
// steps array — cheaper than per-step endpoints and keeps add/remove/reorder
// trivial.
//
// Hidden steps: keep the row visible in this admin view but suppress it
// from the client. Useful when the blank vendor and printer are the same
// place (hide one of those two), or when the client picks up in-person
// (hide "On the way to you").
function TrackingPanel({ project, authHdr, onLocal }) {
  const initial = (project && project.tracking && project.tracking.steps) || [];
  const [steps, setSteps] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const [editingLabelIdx, setEditingLabelIdx] = React.useState(-1);
  const [draftLabel, setDraftLabel] = React.useState('');
  // Row index whose link input is currently expanded. Only one row at a time
  // so the panel doesn't grow uncontrollably. -1 = no row expanded.
  const [editingLinkIdx, setEditingLinkIdx] = React.useState(-1);
  const saveTimerRef = React.useRef(null);

  // When the parent's project changes (different project opened), reset our
  // local steps. Otherwise we'd render the previous project's tracking on
  // top of the new one for a frame.
  React.useEffect(() => {
    const next = (project && project.tracking && project.tracking.steps) || [];
    setSteps(next);
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?._id]);

  const persist = React.useCallback(async (nextSteps) => {
    if (!project || !project._id) return;
    setSaving(true);
    try {
      const r = await axios.patch(`${base}/orders/${project._id}/tracking`,
        { steps: nextSteps }, authHdr);
      const returned = (r.data && r.data.tracking && r.data.tracking.steps) || nextSteps;
      // Propagate to parent so the drawer's `local` reflects the latest steps
      // (matters for subsequent re-opens of the drawer).
      if (onLocal) {
        onLocal(prev => prev ? { ...prev, tracking: { steps: returned } } : prev);
      }
      setSavedAt(Date.now());
    } catch (e) {
      alert(`Couldn't save tracking: ${e.response?.data?.message || e.message}`);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?._id, authHdr, onLocal]);

  // Debounced save: many UI mutations in quick succession (typing a label,
  // dragging a date picker) become one network round-trip ~600ms after the
  // last edit. Critical actions (tick / hide / add / remove) save immediately
  // by calling persistNow() instead of going through the debounce.
  const scheduleSave = React.useCallback((nextSteps) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persist(nextSteps), 600);
  }, [persist]);
  const persistNow = React.useCallback((nextSteps) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    persist(nextSteps);
  }, [persist]);

  React.useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const updateStep = (idx, patch, immediate = false) => {
    const next = steps.map((s, i) => i === idx ? { ...s, ...patch } : s);
    setSteps(next);
    if (immediate) persistNow(next); else scheduleSave(next);
  };

  const initDefaults = async () => {
    if (!project || !project._id) return;
    if (steps.length > 0) return;
    setSaving(true);
    try {
      const r = await axios.post(`${base}/orders/${project._id}/tracking/init`, {}, authHdr);
      const returned = (r.data && r.data.tracking && r.data.tracking.steps) || [];
      setSteps(returned);
      if (onLocal) {
        onLocal(prev => prev ? { ...prev, tracking: { steps: returned } } : prev);
      }
      setSavedAt(Date.now());
    } catch (e) {
      alert(`Couldn't initialize tracking: ${e.response?.data?.message || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = (idx) => {
    const cur = steps[idx];
    const next = { ...cur, completedAt: cur.completedAt ? null : new Date().toISOString() };
    const arr = steps.map((s, i) => i === idx ? next : s);
    setSteps(arr);
    persistNow(arr);
  };

  const toggleHidden = (idx) => {
    updateStep(idx, { hidden: !steps[idx].hidden }, true);
  };

  const removeStep = (idx) => {
    const arr = steps.filter((_, i) => i !== idx);
    setSteps(arr);
    persistNow(arr);
  };

  const moveStep = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const arr = [...steps];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setSteps(arr);
    persistNow(arr);
  };

  const addCustom = () => {
    const id = `custom_${Date.now().toString(36)}`;
    const arr = [...steps, { id, label: 'New step', completedAt: null, note: '', hidden: false }];
    setSteps(arr);
    persistNow(arr);
    setEditingLabelIdx(arr.length - 1);
    setDraftLabel('New step');
  };

  const commitLabelEdit = (idx) => {
    const trimmed = String(draftLabel || '').slice(0, 80);
    if (trimmed && trimmed !== steps[idx].label) {
      updateStep(idx, { label: trimmed }, true);
    }
    setEditingLabelIdx(-1);
    setDraftLabel('');
  };

  // datetime-local needs YYYY-MM-DDTHH:mm in local time. Empty if not set.
  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const fromLocalInput = (s) => {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  return (
    <Box sx={{ px: 2.5, pb: 2 }}>
      <Stack direction="row" alignItems="center" gap={1} mb={1}>
        <TimelineIcon sx={{ color: B.green, fontSize: 14 }} />
        <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Client tracking
        </Typography>
        <Box sx={{ flex: 1 }} />
        {saving ? (
          <Typography sx={{ color: B.muted, fontSize: 10, fontStyle: 'italic' }}>Saving…</Typography>
        ) : savedAt && (
          <Typography sx={{ color: B.green, fontSize: 10 }}>Saved</Typography>
        )}
      </Stack>

      {steps.length === 0 ? (
        <Box sx={{
          border: `1px dashed ${B.faint}`, borderRadius: 1.5, p: 1.75,
          textAlign: 'center',
        }}>
          <Typography sx={{ color: B.muted, fontSize: 11.5, mb: 1, lineHeight: 1.5 }}>
            No tracking timeline yet. Initialize the default steps (confirmation
            approved → arrived) — the client sees them on the same approval link
            once they approve.
          </Typography>
          <Button onClick={initDefaults} disabled={saving}
            startIcon={saving ? <CircularProgress size={12} sx={{ color: B.greenDk }} /> : <TimelineIcon sx={{ fontSize: 14 }} />}
            sx={{
              bgcolor: B.green, color: B.greenDk, fontSize: 11, fontWeight: 700,
              textTransform: 'none', px: 1.5, py: 0.5,
              '&:hover': { bgcolor: '#3bd070' },
            }}>
            Start tracking
          </Button>
        </Box>
      ) : (
        <Stack gap={0.5}>
          {steps.map((s, i) => {
            const done = !!s.completedAt;
            const editing = editingLabelIdx === i;
            return (
              <Box key={s.id || i}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr auto auto',
                  alignItems: 'center', gap: 1,
                  py: 0.6, px: 0.5,
                  borderBottom: `1px solid ${B.faint}`,
                  opacity: s.hidden ? 0.45 : 1,
                }}>
                {/* Tick / un-tick */}
                <Tooltip title={done ? 'Mark not done' : 'Mark complete (sets timestamp to now)'}>
                  <IconButton onClick={() => toggleComplete(i)} size="small" sx={{ p: 0 }}>
                    {done
                      ? <CheckCircleIcon sx={{ fontSize: 18, color: B.green }} />
                      : <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: B.muted }} />}
                  </IconButton>
                </Tooltip>

                {/* Label */}
                {editing ? (
                  <TextField value={draftLabel} autoFocus size="small"
                    onChange={e => setDraftLabel(e.target.value)}
                    onBlur={() => commitLabelEdit(i)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitLabelEdit(i); }
                      if (e.key === 'Escape') { setEditingLabelIdx(-1); setDraftLabel(''); }
                    }}
                    sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 12, py: 0.5, color: B.white } }} />
                ) : (
                  <Box onClick={() => { setEditingLabelIdx(i); setDraftLabel(s.label || ''); }}
                    sx={{
                      cursor: 'text', fontSize: 12,
                      color: done ? B.white : B.muted,
                      fontWeight: done ? 700 : 500,
                      textDecoration: s.hidden ? 'line-through' : 'none',
                      '&:hover': { color: B.green },
                    }}>
                    {s.label || <em style={{ color: B.muted }}>Unlabeled</em>}
                  </Box>
                )}

                {/* Timestamp picker */}
                <TextField type="datetime-local" size="small"
                  value={toLocalInput(s.completedAt)}
                  onChange={e => updateStep(i, { completedAt: fromLocalInput(e.target.value) })}
                  sx={{
                    ...darkInput,
                    '& .MuiInputBase-input': { fontSize: 10.5, py: 0.4, color: done ? B.white : B.muted, minWidth: 150 },
                  }} />

                {/* Per-row actions */}
                <Stack direction="row" gap={0}>
                  <Tooltip title="Move up">
                    <span>
                      <IconButton onClick={() => moveStep(i, -1)} size="small" disabled={i === 0}
                        sx={{ p: 0.3, color: B.muted, '&:hover': { color: B.green } }}>
                        <Box component="span" sx={{ fontSize: 11, lineHeight: 1 }}>▲</Box>
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton onClick={() => moveStep(i, 1)} size="small" disabled={i === steps.length - 1}
                        sx={{ p: 0.3, color: B.muted, '&:hover': { color: B.green } }}>
                        <Box component="span" sx={{ fontSize: 11, lineHeight: 1 }}>▼</Box>
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={s.link ? 'Edit shipping / tracking link' : 'Attach a shipping or tracking URL'}>
                    <IconButton onClick={() => setEditingLinkIdx(editingLinkIdx === i ? -1 : i)} size="small"
                      sx={{ p: 0.3, color: s.link ? B.green : B.muted, '&:hover': { color: B.green } }}>
                      <LinkIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={s.hidden ? 'Show to client' : 'Hide from client (kept in your view)'}>
                    <IconButton onClick={() => toggleHidden(i)} size="small"
                      sx={{ p: 0.3, color: s.hidden ? '#fbbf24' : B.muted, '&:hover': { color: B.green } }}>
                      {s.hidden ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove step">
                    <IconButton onClick={() => removeStep(i)} size="small"
                      sx={{ p: 0.3, color: B.muted, '&:hover': { color: '#f87171' } }}>
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                {/* Inline link editor — full width below the step row when
                    the link icon is toggled on, or when a link is already
                    saved so admin can see what's attached without re-toggling. */}
                {(editingLinkIdx === i || s.link) && (
                  <Box sx={{
                    gridColumn: '1 / -1',
                    display: 'flex', alignItems: 'center', gap: 1,
                    pl: 3.5, pr: 0.5, pb: 0.4,
                  }}>
                    <LinkIcon sx={{ fontSize: 12, color: B.muted }} />
                    <TextField placeholder="https://carrier.com/track/123…" size="small" fullWidth
                      value={s.link || ''}
                      onChange={e => updateStep(i, { link: e.target.value })}
                      onBlur={() => persistNow(steps)}
                      sx={{ ...darkInput, '& .MuiInputBase-input': { fontSize: 11, py: 0.4, color: B.white } }} />
                  </Box>
                )}
              </Box>
            );
          })}
          <Stack direction="row" gap={1} sx={{ pt: 0.5 }}>
            <Button onClick={addCustom}
              startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
              sx={{ color: B.green, fontSize: 10.5, textTransform: 'none', minWidth: 0, px: 1 }}>
              Add step
            </Button>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ color: B.muted, fontSize: 10, fontStyle: 'italic' }}>
              Client view auto-refreshes within a minute.
            </Typography>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
