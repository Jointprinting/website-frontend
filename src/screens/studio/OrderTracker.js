// src/screens/studio/OrderTracker.js
// Project-first Order Tracker. Each project (= one Order document) is a card
// with its mockup thumbnails as the hero image. Click a card to drill into the
// full project view with inline editing.

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton, Chip,
  Drawer, MenuItem, Select, FormControl, Tooltip, CircularProgress, InputAdornment,
  Dialog, DialogContent, DialogActions,
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
import DeleteOutlineIcon   from '@mui/icons-material/DeleteOutline';
import AttachFileIcon      from '@mui/icons-material/AttachFile';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LinkIcon from '@mui/icons-material/Link';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import axios from 'axios';
import { B, STATUS_META, STATUS_OPTIONS, fmt, fmtRelative, scrollbar, darkInput } from './_shared';
import MockupPickerDialog from './MockupPickerDialog';
import ConfirmationBuilder from './ConfirmationBuilder';
import QuoteBuilder from './QuoteBuilder';
import config from '../../config.json';
import jpLogoWhite from '../../modules/images/logo_white.webp';

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
  const [qbOpen,      setQbOpen]      = useState(false);
  const [qbStatus,    setQbStatus]    = useState(null);
  const [qbLoading,   setQbLoading]   = useState(false);
  const [qbBusy,      setQbBusy]      = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, mk, ds, lg] = await Promise.all([
        axios.get(`${base}/orders/projects`, authHdr),
        axios.get(`${base}/studio/library/mockups`, authHdr),
        axios.get(`${base}/orders/dashboard`, authHdr),
        axios.get(`${base}/client-logos`, authHdr).catch(() => ({ data: { logos: [] } })),
      ]);
      setProjects(pr.data.projects || []);
      setMockups(mk.data.items || []);
      setStats(ds.data || {});
      setLogos(lg.data.logos || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
    });
    return m;
  }, [mockups]);

  const lookupMockup = (mockupNum) => mockupMap[mockupNum] || mockupMap[normMockupKey(mockupNum)];

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
      alert(`Save failed: ${e.message}`);
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

  const handleDuplicate = async (project) => {
    const carryMockups = window.confirm(
      'Carry the mockups over to the new project?\n\n' +
      'OK = re-order with the same mockups linked.\n' +
      'Cancel = blank slate (start a fresh design).'
    );
    try {
      const r = await axios.post(`${base}/orders/${project._id}/duplicate`,
        { carryMockups }, authHdr);
      await loadProjects();
      setActiveProject(r.data);
    } catch (e) {
      alert(`Duplicate failed: ${e.message}`);
    }
  };

  const handleConfirmMockups = async (selected) => {
    const project = picker.project;
    if (!project) return;
    await handleSave(project._id, { mockupNumbers: selected });
    setPicker({ open: false, project: null });
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

  const loadQbStatus = async () => {
    setQbLoading(true);
    try {
      const r = await axios.get(`${base}/quickbooks/status`, authHdr);
      setQbStatus(r.data);
    } catch (e) {
      setQbStatus({ configured: false, connected: false, error: e.message });
    } finally { setQbLoading(false); }
  };
  const handleOpenQb = async () => { setQbOpen(true); await loadQbStatus(); };
  const handleQbConnect = async () => {
    try {
      const r = await axios.get(`${base}/quickbooks/connect`, authHdr);
      window.open(r.data.url, '_blank', 'width=720,height=820');
    } catch (e) {
      alert(`Couldn't start QuickBooks connect: ${e.response?.data?.message || e.message}`);
    }
  };
  const handleQbSync = async () => {
    setQbBusy(true);
    try {
      const r = await axios.post(`${base}/quickbooks/sync`, {}, authHdr);
      await loadProjects();
      await loadQbStatus();
      const s = r.data;
      alert(`QuickBooks sync complete.\nInvoices checked: ${s.invoicesChecked}\nMatched to projects: ${s.matched}\nNewly marked paid: ${s.markedPaid}`);
    } catch (e) {
      alert(`Sync failed: ${e.response?.data?.message || e.message}`);
    } finally { setQbBusy(false); }
  };
  const handleQbDisconnect = async () => {
    if (!window.confirm('Disconnect QuickBooks?')) return;
    setQbBusy(true);
    try {
      await axios.post(`${base}/quickbooks/disconnect`, {}, authHdr);
      await loadQbStatus();
    } catch (e) { alert(`Disconnect failed: ${e.message}`); }
    finally { setQbBusy(false); }
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
        <Stack direction="row" alignItems="center" gap={{ xs: 1, md: 2 }} flexWrap="wrap">
          <IconButton onClick={onBack} sx={{ color: B.muted, '&:hover': { color: B.white } }}>
            <ArrowBackIcon />
          </IconButton>
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

          <Tooltip title="Clients overview">
            <span>
              <IconButton onClick={handleOpenClients} size="small"
                sx={{ color: B.muted, opacity: 0.4, '&:hover': { opacity: 1, color: B.green } }}>
                <PeopleAltOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Analytics">
            <span>
              <IconButton onClick={handleOpenAnalytics} size="small"
                sx={{ color: B.muted, opacity: 0.4, '&:hover': { opacity: 1, color: B.green } }}>
                <InsightsOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Mockup health report">
            <span>
              <IconButton onClick={handleOpenHealth} size="small"
                sx={{ color: B.muted, opacity: 0.4, '&:hover': { opacity: 1, color: B.green } }}>
                <FactCheckOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Auto-link library mockups">
            <span>
              <IconButton onClick={handleOpenAutoLink} size="small"
                sx={{ color: B.muted, opacity: 0.4, '&:hover': { opacity: 1, color: B.green } }}>
                <AutoFixHighIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Cleanup / dedupe">
            <span>
              <IconButton onClick={handleOpenCleanup} size="small"
                sx={{ color: B.muted, opacity: 0.4, '&:hover': { opacity: 1, color: B.green } }}>
                <CleaningServicesOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="QuickBooks">
            <span>
              <IconButton onClick={handleOpenQb} size="small"
                sx={{ color: B.muted, opacity: 0.4, '&:hover': { opacity: 1, color: B.green } }}>
                <ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={selectMode ? 'Exit multi-select' : 'Select multiple projects'}>
            <span>
              <IconButton onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))} size="small"
                sx={{ color: selectMode ? B.green : B.muted, opacity: selectMode ? 1 : 0.4,
                  '&:hover': { opacity: 1, color: B.green } }}>
                <ChecklistIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Box component="img" src={jpLogoWhite} alt="Joint Printing"
            sx={{ height: 22, width: 'auto', ml: 0.5, opacity: 0.92 }} />
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
            <CircularProgress sx={{ color: B.green }} />
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
            gridTemplateColumns: { xs: 'repeat(auto-fill, minmax(160px, 1fr))', sm: 'repeat(auto-fill, minmax(220px, 1fr))', md: 'repeat(auto-fill, minmax(280px, 1fr))' },
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
        logo={activeProject ? logoFor(activeProject) : null}
        onUploadLogo={(file) => activeProject && uploadLogo(activeProject, file)}
        onRemoveLogo={() => activeProject && removeLogo(activeProject)}
        onClose={() => setActiveProject(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onDuplicate={() => activeProject && handleDuplicate(activeProject)}
        onOpenPicker={() => setPicker({ open: true, project: activeProject })}
        onOpenConfirmation={() => setConfirmation(activeProject)}
        onOpenQuote={() => setQuote(activeProject)}
        token={token}
        authHdr={authHdr}
      />

      <QuoteBuilder
        open={!!quote}
        project={quote}
        onClose={() => setQuote(null)}
        onSave={async (patch) => {
          if (!quote) return;
          const updated = await handleSave(quote._id, patch);
          if (updated) setQuote(updated);
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
        onSave={async (patch) => {
          if (!confirmation) return;
          const updated = await handleSave(confirmation._id, patch);
          if (updated) setConfirmation(updated);
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

      <QuickBooksDialog
        open={qbOpen}
        status={qbStatus}
        loading={qbLoading}
        busy={qbBusy}
        onClose={() => setQbOpen(false)}
        onConnect={handleQbConnect}
        onSync={handleQbSync}
        onDisconnect={handleQbDisconnect}
        onRefresh={loadQbStatus}
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
  // intended mockup count, not just what happens to be in the studio.
  const ownTiles = (project.mockupNumbers || []).slice(0, 4).map(n => ({ num: n, item: lookupMockup(n) }));
  // Only use the "Client's work" fallback when the project has truly no
  // mockup #s assigned. Don't replace partial state with someone else's mockups.
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
      {/* Mockup hero */}
      <Box sx={{ position: 'relative', aspectRatio: '4/3', bgcolor: B.bg, overflow: 'hidden' }}>
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
            gridTemplateColumns: mockupTiles.length === 1 ? '1fr' :
                                 mockupTiles.length === 2 ? '1fr 1fr' :
                                 '2fr 1fr',
            gridTemplateRows:    mockupTiles.length <= 2 ? '1fr' : '1fr 1fr',
            height: '100%',
            gap: '2px',
          }}>
            {mockupTiles.map((t, i) => (
              <Box key={i} sx={{
                bgcolor: B.bg, position: 'relative',
                gridColumn: mockupTiles.length === 3 && i === 0 ? '1' : undefined,
                gridRow:    mockupTiles.length === 3 && i === 0 ? '1 / 3' : undefined,
              }}>
                {t.item && t.item.thumbnail ? (
                  <Box component="img" src={t.item.thumbnail} alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
        {/* Paid badge */}
        {project.paid && (
          <Box sx={{
            position: 'absolute', bottom: 8, right: 8,
            bgcolor: 'rgba(74,222,128,0.18)', color: B.green,
            px: 1, py: 0.3, borderRadius: 1,
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
          }}>
            PAID
          </Box>
        )}
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

function ProjectDrawer({ open, project, mockupMap, mockups, logo, onUploadLogo, onRemoveLogo, onClose, onSave, onDelete, onDuplicate, onOpenPicker, onOpenConfirmation, onOpenQuote, token, authHdr }) {
  const [local, setLocal] = useState(null);
  const [savingField, setSavingField] = useState('');
  const [uploading, setUploading] = useState(false);
  const [client, setClient] = useState(null);
  const [clientSaving, setClientSaving] = useState('');

  useEffect(() => { if (project) setLocal({ ...project }); }, [project]);

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

  if (!project || !local) return null;

  const meta = STATUS_META[local.status] || STATUS_META.quoted;
  const _normKey = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();

  const saveField = async (key, value) => {
    if (project[key] === value) return;
    setSavingField(key);
    await onSave(project._id, { [key]: value });
    setSavingField('');
  };

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
    <Drawer anchor="right" open={open} onClose={onClose}
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
          const cogs  = Number(local.cogs) || 0;
          const margin = total - cogs;
          const pct = total > 0 ? (margin / total) * 100 : 0;
          if (total === 0 && cogs === 0) return null;
          const ok = pct >= 30;
          return (
            <Box title={`Profit margin · total ${fmt(total)} − cogs ${fmt(cogs)}`} sx={{
              textAlign: 'right', mr: 0.4,
            }}>
              <Typography sx={{ color: B.muted, fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Margin
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
        <IconButton onClick={onClose} size="small" sx={{ color: B.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Mockup grid */}
      <Box sx={{ px: 2.5, pt: 2 }}>
        {(() => {
          const nums = local.mockupNumbers || [];
          const tiles = nums.map(n => ({ num: n, item: mockupMap[n] || mockupMap[_normKey(n)] || null }));
          const matched = tiles.filter(t => t.item).length;
          const missing = tiles.length - matched;
          return (
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Mockups · {nums.length}
                  {missing > 0 && (
                    <Typography component="span" sx={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, ml: 1, textTransform: 'none', letterSpacing: 0 }}>
                      ({missing} not in studio)
                    </Typography>
                  )}
                </Typography>
                <Button size="small" startIcon={<DesignServicesIcon sx={{ fontSize: 14 }} />}
                  onClick={onOpenPicker}
                  sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
                  {nums.length === 0 ? 'Link mockups' : 'Edit mockups'}
                </Button>
              </Stack>
              {nums.length === 0 ? (
                <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1.5, py: 3,
                  textAlign: 'center', color: B.muted, fontSize: 12 }}>
                  No mockups linked yet
                </Box>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 1 }}>
                  {tiles.map((t, i) => (
                    <Box key={i} sx={{
                      aspectRatio: '1', borderRadius: 1.5, overflow: 'hidden',
                      border: `1px solid ${t.item ? B.border : 'rgba(251,191,36,0.35)'}`,
                      bgcolor: B.panelHi, position: 'relative',
                      '&:hover .tile-x': { opacity: 1 },
                    }}>
                      <IconButton className="tile-x" size="small"
                        onClick={() => removeMockup(t.num)}
                        title={`Remove ${t.num} from this project`}
                        sx={{
                          position: 'absolute', top: 2, right: 2, zIndex: 1, p: 0.25,
                          opacity: 0, transition: 'opacity 0.12s',
                          bgcolor: 'rgba(0,0,0,0.72)', color: B.white,
                          '&:hover': { bgcolor: '#ef4444', color: '#fff' },
                        }}>
                        <CloseIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                      {t.item && t.item.thumbnail ? (
                        <Box component="img" src={t.item.thumbnail} alt={t.item.name}
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
                  ))}
                </Box>
              )}
              {missing > 0 && (
                <Typography sx={{ mt: 1, color: B.muted, fontSize: 10, fontStyle: 'italic' }}>
                  Missing mockups are on this project in records but aren&apos;t in your jpstudio library.
                  Open jpstudio → pick this project → save a mockup with the matching #, use Edit mockups to attach
                  an existing one, or hover a tile and click ✕ to drop a wrong #.
                </Typography>
              )}
            </>
          );
        })()}
      </Box>

      {/* Fields */}
      <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <InlineField label="Company"      value={local.companyName} savingHint={savingField === 'companyName'}
          onChange={v => updateLocal({ companyName: v })} onBlur={v => saveField('companyName', v)} />
        <InlineField label="Client name"  value={local.clientName} savingHint={savingField === 'clientName'}
          onChange={v => updateLocal({ clientName: v })} onBlur={v => saveField('clientName', v)} />

        <InlineSelect label="Status" value={local.status} savingHint={savingField === 'status'}
          options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          onChange={v => { updateLocal({ status: v }); saveField('status', v); }} />
        <InlineSelect label="Paid" value={local.paid ? 'yes' : 'no'} savingHint={savingField === 'paid'}
          options={[{ value: 'no', label: 'Unpaid' }, { value: 'yes', label: 'Paid' }]}
          onChange={v => { const b = v === 'yes'; updateLocal({ paid: b }); saveField('paid', b); }} />

        <InlineField label="Total $" type="number" value={local.totalValue || ''} savingHint={savingField === 'totalValue'}
          onChange={v => updateLocal({ totalValue: Number(v) || 0 })}
          onBlur={v => saveField('totalValue', Number(v) || 0)} />
        <InlineField label="COGS $" type="number" value={local.cogs || ''} savingHint={savingField === 'cogs'}
          onChange={v => updateLocal({ cogs: Number(v) || 0 })}
          onBlur={v => saveField('cogs', Number(v) || 0)} />

        <InlineField label="Printer"  value={local.printerName} savingHint={savingField === 'printerName'}
          onChange={v => updateLocal({ printerName: v })} onBlur={v => saveField('printerName', v)} />
        <InlineField label="Supplier" value={local.supplier || ''} savingHint={savingField === 'supplier'}
          onChange={v => updateLocal({ supplier: v })} onBlur={v => saveField('supplier', v)} />

        <InlineDateField label="Date of sale" value={local.orderDate}     savingHint={savingField === 'orderDate'}
          onChange={v => saveField('orderDate', v)} />
        <InlineDateField label="Arrive at printer" value={local.shipDate} savingHint={savingField === 'shipDate'}
          onChange={v => saveField('shipDate', v)} />
        <InlineDateField label="Arrive at client" value={local.deliveredDate} savingHint={savingField === 'deliveredDate'}
          onChange={v => saveField('deliveredDate', v)} />

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
        <Box sx={{ gridColumn: '1 / -1' }}>
          {(() => {
            const qLines = local.quoteLines || [];
            const lineUnit = (l) => Number(l.unitPrice)
              || ((Number(l.blankCost) || 0) + (Number(l.printCost) || 0)) * (Number(l.markup) || 1);
            const qTotal = qLines.reduce((s, l) => s + (Number(l.qty) || 0) * lineUnit(l), 0);
            return (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
                  <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    Quote
                    {qLines.length > 0 && (
                      <Typography component="span" sx={{ color: B.muted, fontSize: 10, ml: 0.6, textTransform: 'none', letterSpacing: 0 }}>
                        · {qLines.length} line{qLines.length === 1 ? '' : 's'} · {fmt(qTotal)}
                      </Typography>
                    )}
                  </Typography>
                  <Button size="small" startIcon={<RequestQuoteOutlinedIcon sx={{ fontSize: 14 }} />}
                    onClick={() => onOpenQuote()}
                    sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
                    {qLines.length === 0 ? 'Build quote' : 'Open quoter'}
                  </Button>
                </Stack>
                {qLines.length === 0 ? (
                  <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, p: 1.5,
                    textAlign: 'center', color: B.muted, fontSize: 11 }}>
                    No quote yet. Open the quoter to price this project.
                  </Box>
                ) : (
                  <Stack gap={0.2}>
                    {qLines.map((l, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 1, fontSize: 11, py: 0.5,
                        borderBottom: `1px solid ${B.faint}` }}>
                        <Typography sx={{ color: B.muted, fontFamily: 'monospace', minWidth: 38 }}>
                          {Number(l.qty) || 0}×
                        </Typography>
                        <Typography sx={{ color: B.white, flex: 1, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.description || l.styleCode || 'Item'}{l.color ? ` · ${l.color}` : ''}
                        </Typography>
                        <Typography sx={{ color: B.muted, fontFamily: 'monospace' }}>
                          {fmt(lineUnit(l))}
                        </Typography>
                        <Typography sx={{ color: B.green, fontFamily: 'monospace', fontWeight: 700,
                          minWidth: 64, textAlign: 'right' }}>
                          {fmt((Number(l.qty) || 0) * lineUnit(l))}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </>
            );
          })()}
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <InlineField label="Notes (internal)" multiline value={local.notes || ''} savingHint={savingField === 'notes'}
            onChange={v => updateLocal({ notes: v })} onBlur={v => saveField('notes', v)} />
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <InlineField label="QuickBooks invoice URL" value={local.quickbooksInvoiceUrl || ''}
            savingHint={savingField === 'quickbooksInvoiceUrl'}
            onChange={v => updateLocal({ quickbooksInvoiceUrl: v })}
            onBlur={v => saveField('quickbooksInvoiceUrl', v)} />
          {local.quickbooksInvoiceUrl && (
            <Typography component="a" href={local.quickbooksInvoiceUrl} target="_blank" rel="noreferrer"
              sx={{ display: 'inline-block', mt: 0.4, color: B.green, fontSize: 11,
                textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              Open in QuickBooks ↗
            </Typography>
          )}
        </Box>
      </Box>

      {/* Tasks */}
      <TasksSection local={local} updateLocal={updateLocal} saveField={saveField} savingField={savingField} />

      {/* Client profile (sticky info that follows this company across projects) */}
      <ClientProfileSection client={client} saving={clientSaving} saveClient={saveClient} />

      {/* Files */}
      <Box sx={{ px: 2.5, pb: 2 }}>
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
            <Typography component="a"
              href={`${base}/orders/${project._id}/files/${f.filename}?token=${token}`}
              target="_blank" rel="noreferrer"
              sx={{ color: B.white, fontSize: 12, textDecoration: 'none', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                '&:hover': { color: B.green } }}>
              {f.originalName || f.filename}
            </Typography>
            <Typography sx={{ color: B.muted, fontSize: 10 }}>
              {Math.round((f.size || 0) / 1024)} KB
            </Typography>
          </Stack>
        ))}
      </Box>

      {/* Activity timeline — merges admin activity[] + client approvalEvents[] */}
      {(() => {
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

      {/* Footer actions */}
      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: B.bg, borderTop: `1px solid ${B.border}`,
        px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace', flex: 1 }}>
          Updated {fmtRelative(local.updatedAt)}
        </Typography>
        <Button startIcon={<DescriptionOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => onOpenConfirmation()}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          Build confirmation
        </Button>
        <Button startIcon={<LinkIcon sx={{ fontSize: 16 }} />}
          onClick={async () => {
            try {
              const r = await axios.post(`${base}/orders/${project._id}/approval-link`, {}, authHdr);
              const url = `${window.location.origin}/approve/${project._id}?token=${r.data.token}`;
              try {
                await navigator.clipboard.writeText(url);
                alert(`Approval link copied to clipboard:\n\n${url}\n\nSend it to your client.`);
              } catch (_) {
                window.prompt('Copy this approval link and send it to your client:', url);
              }
            } catch (e) { alert(`Couldn't generate link: ${e.message}`); }
          }}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          Share for approval
        </Button>
        <Button startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
          onClick={onDuplicate}
          sx={{ color: B.muted, fontSize: 11, textTransform: 'none', '&:hover': { color: B.white } }}>
          Duplicate
        </Button>
        <Button startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
          onClick={() => onDelete(project._id)}
          sx={{ color: '#f87171', fontSize: 11, textTransform: 'none' }}>
          Delete project
        </Button>
      </Box>
    </Drawer>
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

function InlineDateField({ label, value, onChange, savingHint }) {
  const v = value ? new Date(value).toISOString().slice(0, 10) : '';
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.3 }}>
        {label} {savingHint && <CircularProgress size={9} sx={{ color: B.green, ml: 0.5 }} />}
      </Typography>
      <TextField
        size="small"
        fullWidth
        type="date"
        value={v}
        onChange={e => onChange(e.target.value || null)}
        sx={darkInput}
        InputLabelProps={{ shrink: true }}
      />
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

  const update = (i, patch) => {
    const next = list.map((x, idx) => idx === i ? { ...x, ...patch } : x);
    onChange(next);
  };
  const remove = (i) => {
    const next = list.filter((_, idx) => idx !== i);
    onChange(next);
    onCommit(next);
  };
  const add = () => {
    const next = [...list, { description: '', qty: 1, unitPrice: 0 }];
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
                onBlur={() => onCommit(list)}
                sx={{ ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.4, textAlign: 'right' } }} />
              <TextField size="small" value={it.description || ''}
                onChange={e => update(i, { description: e.target.value })}
                onBlur={() => onCommit(list)}
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
              <HealthStat label="Projects"    value={summary.projects} />
              <HealthStat label="Studio items" value={summary.libraryItems} />
              <HealthStat label="Linked"      value={summary.linked}   accent={B.green} />
              <HealthStat label="Missing"     value={summary.missing}  accent={summary.missing  > 0 ? '#fbbf24' : undefined} />
              <HealthStat label="Orphans"     value={summary.orphans}  accent={summary.orphans  > 0 ? '#60a5fa' : undefined} />
            </Box>

            {/* Tabs */}
            <Stack direction="row" gap={0.5} mb={1.5}>
              {[
                { id: 'missing', label: `Missing (${summary.missing})`,  color: '#fbbf24' },
                { id: 'linked',  label: `Linked (${summary.linked})`,    color: B.green   },
                { id: 'orphans', label: `Orphans (${summary.orphans})`, color: '#60a5fa' },
              ].map(t => {
                const active = tab === t.id;
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
              {tab === 'missing' && 'These mockup #s are assigned to projects but don\'t exist in your jpstudio library. Open jpstudio, pick the project, and save a mockup with the matching #.'}
              {tab === 'matched' && 'These project mockup #s are paired with a library item. Healthy state.'}
              {tab === 'orphans' && 'These library mockups aren\'t referenced by any project. Either link them via a project drawer or ignore — they may be drafts.'}
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
            <Typography sx={{ color: B.muted, fontSize: 11, mb: 1.5 }}>
              Scans every saved jpstudio mockup and matches it to a project by batch
              number (#000061A–D all belong to one project) or by the company name in
              its title. Nothing changes until you press Apply.
            </Typography>

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

// ── QuickBooksDialog ─────────────────────────────────────────────────────────
// Status / connect / sync UI for the QuickBooks Online integration. Connect
// opens the Intuit authorize URL in a popup; after authorizing, the user hits
// Refresh (the popup auto-closes). Sync pulls invoices and flips paid=true on
// matching projects whose QBO invoice is fully paid.
function QuickBooksDialog({ open, status, loading, busy, onClose, onConnect, onSync, onDisconnect, onRefresh }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, color: B.white, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: B.panel,
        borderBottom: `1px solid ${B.border}`, px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReceiptLongOutlinedIcon sx={{ color: B.green, fontSize: 18 }} />
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1 }}>QuickBooks</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ p: 2.5 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={20} sx={{ color: B.green }} />
          </Box>
        ) : !status ? (
          <Typography sx={{ color: B.muted, fontSize: 12 }}>No data.</Typography>
        ) : !status.configured ? (
          <Box>
            <Typography sx={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, mb: 1 }}>
              Not configured yet
            </Typography>
            <Typography sx={{ color: B.muted, fontSize: 11, lineHeight: 1.5 }}>
              To enable QuickBooks sync, set these env vars on the Render backend:
              <Box component="ul" sx={{ pl: 2, mt: 0.5 }}>
                <li><Box component="code" sx={{ color: B.white }}>QBO_CLIENT_ID</Box></li>
                <li><Box component="code" sx={{ color: B.white }}>QBO_CLIENT_SECRET</Box></li>
                <li><Box component="code" sx={{ color: B.white }}>QBO_REDIRECT_URI</Box> — must match the Intuit app's redirect URI exactly (e.g. <code>https://jointprinting-backend.onrender.com/api/quickbooks/callback</code>)</li>
                <li><Box component="code" sx={{ color: B.white }}>QBO_ENVIRONMENT</Box> = <code>production</code></li>
              </Box>
              Create the app at developer.intuit.com (Accounting scope).
            </Typography>
            <Button onClick={onRefresh} sx={{ color: B.green, fontSize: 11, textTransform: 'none', mt: 1 }}>
              Refresh status
            </Button>
          </Box>
        ) : !status.connected ? (
          <Box>
            <Typography sx={{ color: B.white, fontSize: 13, mb: 1 }}>Not connected.</Typography>
            <Typography sx={{ color: B.muted, fontSize: 11, mb: 1.5 }}>
              Click Connect to authorize Joint Printing in QuickBooks. A popup will open; after authorizing, hit Refresh here.
            </Typography>
            <Stack direction="row" gap={1}>
              <Button variant="contained" onClick={onConnect}
                sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, textTransform: 'none' }}>
                Connect QuickBooks
              </Button>
              <Button onClick={onRefresh} sx={{ color: B.muted, fontSize: 12, textTransform: 'none' }}>
                Refresh
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ color: B.green, fontSize: 13, fontWeight: 700, mb: 1 }}>Connected ✓</Typography>
            <Box sx={{ fontSize: 11, color: B.muted, mb: 1.5,
              display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 0.3 }}>
              <Box>Company</Box><Box sx={{ color: B.white, fontFamily: 'monospace' }}>{status.realmId || '—'}</Box>
              <Box>Environment</Box><Box sx={{ color: B.white }}>{status.environment}</Box>
              <Box>Connected</Box><Box sx={{ color: B.white }}>{fmtDate(status.connectedAt)}</Box>
              <Box>Last sync</Box><Box sx={{ color: B.white }}>{fmtDate(status.lastSyncAt)}</Box>
            </Box>
            <Typography sx={{ color: B.muted, fontSize: 10, mb: 1.5, fontStyle: 'italic' }}>
              Sync matches QuickBooks invoices to projects by invoice number (DocNumber = orderNumber).
              It only ever marks paid — never un-marks.
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button variant="contained" disabled={busy} onClick={onSync}
                sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, textTransform: 'none' }}>
                {busy ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : 'Sync invoices now'}
              </Button>
              <Button onClick={onRefresh} disabled={busy}
                sx={{ color: B.muted, fontSize: 12, textTransform: 'none' }}>
                Refresh
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button onClick={onDisconnect} disabled={busy}
                sx={{ color: '#f87171', fontSize: 12, textTransform: 'none' }}>
                Disconnect
              </Button>
            </Stack>
          </Box>
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
