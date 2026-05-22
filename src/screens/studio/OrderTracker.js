// src/screens/studio/OrderTracker.js
// Project-first Order Tracker. Each project (= one Order document) is a card
// with its mockup thumbnails as the hero image. Click a card to drill into the
// full project view with inline editing.

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton, Chip,
  Drawer, MenuItem, Select, FormControl, Tooltip, CircularProgress, InputAdornment,
  Dialog, DialogContent,
} from '@mui/material';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import AddIcon             from '@mui/icons-material/Add';
import SearchIcon          from '@mui/icons-material/Search';
import CloseIcon           from '@mui/icons-material/Close';
import DesignServicesIcon  from '@mui/icons-material/DesignServices';
import RefreshIcon         from '@mui/icons-material/Refresh';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import DeleteOutlineIcon   from '@mui/icons-material/DeleteOutline';
import AttachFileIcon      from '@mui/icons-material/AttachFile';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PrintIcon           from '@mui/icons-material/Print';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LinkIcon from '@mui/icons-material/Link';
import axios from 'axios';
import { B, STATUS_META, STATUS_OPTIONS, fmt, fmtRelative, scrollbar, darkInput } from './_shared';
import MockupPickerDialog from './MockupPickerDialog';
import config from '../../config.json';

const base = `${config.backendUrl}/api`;
const STATUS_FILTERS = [
  { value: 'all',           label: 'All' },
  { value: 'quoted',        label: 'Quoted' },
  { value: 'approved',      label: 'Approved' },
  { value: 'placed',        label: 'Placed' },
  { value: 'in_production', label: 'In Production' },
  { value: 'shipped',       label: 'Shipped' },
  { value: 'delivered',     label: 'Delivered' },
];

export default function OrderTracker({ token, onBack }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [projects,      setProjects]      = useState([]);
  const [mockups,       setMockups]       = useState([]);
  const [logos,         setLogos]         = useState([]);
  const [stats,         setStats]         = useState({});
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [activeProject, setActiveProject] = useState(null);
  const [creating,      setCreating]      = useState(false);
  const [resyncing,     setResyncing]     = useState(false);
  const [picker,        setPicker]        = useState({ open: false, project: null });
  const [confirmation,  setConfirmation]  = useState(null);
  const [healthOpen,    setHealthOpen]    = useState(false);
  const [healthData,    setHealthData]    = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

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
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!s) return true;
      return [p.projectNumber, p.orderNumber, p.companyName, p.clientName,
              (p.items || []).map(i => i.description).join(' '),
              (p.mockupNumbers || []).join(' ')]
        .join(' ').toLowerCase().includes(s);
    });
  }, [projects, search, statusFilter]);

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

  const handleResync = async () => {
    if (!window.confirm('Re-pull all orders from the Notion seed? This wipes stale Drive imports and refreshes every project to match Notion.')) return;
    setResyncing(true);
    try {
      const r = await axios.post(`${base}/orders/seed-historical`, {}, authHdr);
      await loadProjects();
      alert(`Done.\nWiped Drive imports: ${r.data.gdriveWiped}\nCreated: ${r.data.created}\nUpdated: ${r.data.updated}`);
    } catch (e) {
      alert(`Re-sync failed: ${e.message}`);
    } finally {
      setResyncing(false);
    }
  };

  const handleConfirmMockups = async (selected) => {
    const project = picker.project;
    if (!project) return;
    await handleSave(project._id, { mockupNumbers: selected });
    setPicker({ open: false, project: null });
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
        borderBottom: `1px solid ${B.border}`, px: 3, py: 1.5,
      }}>
        <Stack direction="row" alignItems="center" gap={2}>
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
            placeholder="Search projects, mockups, invoices…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ ...darkInput, width: 320 }}
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
              px: 2, '&:hover': { bgcolor: '#3bd070' } }}>
            New project
          </Button>

          <Tooltip title="Mockup health report">
            <span>
              <IconButton onClick={handleOpenHealth} size="small"
                sx={{ color: B.muted, opacity: 0.4, '&:hover': { opacity: 1, color: B.green } }}>
                <FactCheckOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Re-sync with Notion (overwrites local edits)">
            <span>
              <IconButton onClick={handleResync} disabled={resyncing} size="small"
                sx={{ color: B.muted, opacity: 0.4, '&:hover': { opacity: 1, color: B.green } }}>
                {resyncing ? <CircularProgress size={14} sx={{ color: B.green }} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {/* Stat strip */}
        <Stack direction="row" gap={4} sx={{ mt: 1.5, pl: 6 }}>
          <Stat label="Delivered this month"  value={fmt(stats.revenueThisMonth)} accent={B.green} />
          <Stat label="Delivered this year"   value={fmt(stats.revenueThisYear)} />
          <Stat label="Open orders"           value={String(stats.openOrders || 0)} />
          <Stat label="Open quotes"           value={String(stats.openQuotes || 0)} />
          <Stat label="Unpaid"                value={fmt(stats.unpaidTotal)} accent={stats.unpaidTotal > 0 ? '#fbbf24' : undefined} />
        </Stack>

        {/* Status filter chips */}
        <Stack direction="row" gap={0.75} sx={{ mt: 1.5, pl: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => {
            const active = f.value === statusFilter;
            const count = f.value === 'all'
              ? projects.length
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
        </Stack>
      </Box>

      {/* Project grid */}
      <Box sx={{ p: 3, pb: 6 }}>
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
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}>
            {filtered.map(p => (
              <ProjectCard key={p._id} project={p}
                lookupMockup={lookupMockup}
                companyMockupPool={companyMockupPool}
                logo={logoFor(p)}
                onClick={() => setActiveProject(p)} />
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
        onOpenPicker={() => setPicker({ open: true, project: activeProject })}
        onOpenConfirmation={() => setConfirmation(activeProject)}
        token={token}
        authHdr={authHdr}
      />

      <ConfirmationDialog
        open={!!confirmation}
        project={confirmation}
        mockupMap={mockupMap}
        logo={confirmation ? logoFor(confirmation) : null}
        onClose={() => setConfirmation(null)}
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

function ProjectCard({ project, lookupMockup, companyMockupPool, logo, onClick }) {
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
      border: `1px solid ${B.border}`,
      borderRadius: 2,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.15s',
      '&:hover': {
        borderColor: B.green,
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      },
    }}>
      {/* Mockup hero */}
      <Box sx={{ position: 'relative', aspectRatio: '4/3', bgcolor: B.bg, overflow: 'hidden' }}>
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
          position: 'absolute', top: 8, left: 8,
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

function ProjectDrawer({ open, project, mockupMap, mockups, logo, onUploadLogo, onRemoveLogo, onClose, onSave, onDelete, onOpenPicker, onOpenConfirmation, token, authHdr }) {
  const [local, setLocal] = useState(null);
  const [savingField, setSavingField] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (project) setLocal({ ...project }); }, [project]);

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
                    }}>
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
                  Missing mockups exist on this project in records but aren&apos;t in your jpstudio library.
                  Open jpstudio → pick this project → save a mockup with the matching #, or use Link mockups above to attach an existing one.
                </Typography>
              )}
            </>
          );
        })()}
      </Box>

      {/* Fields */}
      <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
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
          <QuoteEditor
            lines={local.quoteLines || []}
            saving={savingField === 'quoteLines'}
            onChange={lines => updateLocal({ quoteLines: lines })}
            onCommit={async (lines) => {
              updateLocal({ quoteLines: lines });
              setSavingField('quoteLines');
              await onSave(project._id, { quoteLines: lines });
              setSavingField('');
            }}
          />
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <InlineField label="Notes (internal)" multiline value={local.notes || ''} savingHint={savingField === 'notes'}
            onChange={v => updateLocal({ notes: v })} onBlur={v => saveField('notes', v)} />
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <InlineField label="Confirmation message (shown to client)" multiline
            value={local.confirmationMessage || ''} savingHint={savingField === 'confirmationMessage'}
            onChange={v => updateLocal({ confirmationMessage: v })}
            onBlur={v => saveField('confirmationMessage', v)} />
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <InlineField label="Confirmation terms (payment / turnaround)" multiline
            value={local.confirmationTerms || ''} savingHint={savingField === 'confirmationTerms'}
            onChange={v => updateLocal({ confirmationTerms: v })}
            onBlur={v => saveField('confirmationTerms', v)} />
        </Box>
      </Box>

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

      {/* Approval activity */}
      {(local.approvalEvents || []).length > 0 && (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>
            Approval activity · {local.approvalEvents.length}
          </Typography>
          <Stack gap={0.5}>
            {[...local.approvalEvents].reverse().slice(0, 10).map((e, i) => {
              const kindMeta = e.kind === 'approved'
                ? { color: B.green,  label: 'Approved'        }
                : e.kind === 'requested_changes'
                ? { color: '#fbbf24', label: 'Requested changes' }
                : { color: B.muted,  label: 'Viewed'          };
              return (
                <Box key={i} sx={{
                  display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 1, alignItems: 'start',
                  py: 0.5, borderBottom: `1px solid ${B.faint}`, fontSize: 11,
                }}>
                  <Box sx={{ color: kindMeta.color, fontWeight: 700, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    {kindMeta.label}
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
      )}

      {/* Footer actions */}
      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: B.bg, borderTop: `1px solid ${B.border}`,
        px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace', flex: 1 }}>
          Updated {fmtRelative(local.updatedAt)}
        </Typography>
        <Button startIcon={<DescriptionOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => onOpenConfirmation()}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          Confirmation page
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
          <Box sx={{ display: 'grid', gridTemplateColumns: '44px 1fr 28px',
            gap: 0.5, px: 0.8, py: 0.4, bgcolor: B.panelHi,
            fontSize: 9, fontWeight: 700, color: B.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            <Box>Qty</Box>
            <Box>Description</Box>
            <Box />
          </Box>
          {list.map((it, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '44px 1fr 28px',
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

// ── ConfirmationDialog ───────────────────────────────────────────────────────
// Client-facing confirmation page. Printable (window.print) and screenshottable.
// Renders mockups, line items, totals, and a clean header.
function ConfirmationDialog({ open, project, mockupMap, logo, onClose }) {
  if (!project) return null;
  const _normKey = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();
  const mockupThumbs = (project.mockupNumbers || []).map(n => mockupMap[n] || mockupMap[_normKey(n)]).filter(Boolean);

  // Prefer the structured quote if present; fall back to simple items.
  const quoteLines = project.quoteLines || [];
  const items = project.items || [];
  const itemRows = quoteLines.length > 0
    ? quoteLines.map(l => {
        const blank = Number(l.blankCost) || 0;
        const print = Number(l.printCost) || 0;
        const m     = Number(l.markup)    || 1;
        const derivedUnit = +((blank + print) * m).toFixed(2);
        const unit = Number(l.unitPrice) || derivedUnit;
        const desc = [l.styleCode, l.description, l.color, l.printType && `(${l.printType}${l.printDetails ? ' · ' + l.printDetails : ''})`]
          .filter(Boolean).join(' · ');
        return { qty: l.qty, description: desc, unitPrice: unit, lineTotal: (Number(l.qty) || 0) * unit };
      })
    : items.map(i => ({
        qty: i.qty, description: i.description,
        unitPrice: i.unitPrice,
        lineTotal: (Number(i.qty) || 0) * (Number(i.unitPrice) || 0),
      }));
  const subtotal = itemRows.reduce((s, r) => s + (Number(r.lineTotal) || 0), 0);
  const total = Number(project.totalValue) || subtotal;

  const handlePrint = () => {
    const el = document.getElementById('confirmation-printable');
    if (!el) return window.print();
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) {
      // Popup blocker stopped the new window — fall back to printing the
      // current dialog so the user gets *something*.
      alert('Popup was blocked. Printing this view instead — allow popups for jointprinting.com to get a cleaner print layout next time.');
      window.print();
      return;
    }
    w.document.write(`
      <html><head><title>Confirmation #${project.projectNumber || ''}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #111; margin: 32px; }
        h1 { font-size: 22px; margin: 0 0 4px 0; }
        .meta { color: #555; font-size: 12px; margin-bottom: 24px; }
        .section { margin-bottom: 24px; }
        .section-h { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #777; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .mockup-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .mockup { aspect-ratio: 4/3; background: #f4f4f4; border-radius: 4px; overflow: hidden; }
        .mockup img { width: 100%; height: 100%; object-fit: cover; display: block; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; color: #777; padding: 6px 8px; border-bottom: 1px solid #ccc; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        td.r { text-align: right; }
        .total-row td { font-weight: 800; border-top: 2px solid #111; font-size: 15px; }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: '#f6f6f4', color: '#111', borderRadius: 2 } }}>
      <Box sx={{ position: 'sticky', top: 0, bgcolor: '#fff', borderBottom: '1px solid #e6e6e0', px: 2.5, py: 1.2,
        display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#111', flex: 1 }}>
          Confirmation page
        </Typography>
        <Button size="small" startIcon={<PrintIcon sx={{ fontSize: 16 }} />}
          onClick={handlePrint}
          sx={{ color: '#111', fontSize: 12, textTransform: 'none', fontWeight: 700 }}>
          Print / Save PDF
        </Button>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent>
        <Box id="confirmation-printable" sx={{
          bgcolor: '#fff', color: '#111', p: 4, borderRadius: 1,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
            {logo && (
              <Box sx={{
                width: 64, height: 64, p: 0.4,
                border: '1px solid #e6e6e0', borderRadius: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: '#fff', overflow: 'hidden',
              }}>
                <Box component="img" src={logo} alt=""
                  sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </Box>
            )}
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 24, mb: 0.3, color: '#111', lineHeight: 1 }}>
                JOINT PRINTING
              </Typography>
              <Typography sx={{ color: '#555', fontSize: 12 }}>
                Project #{project.projectNumber || '—'}
                {project.orderNumber ? `  ·  Invoice #${project.orderNumber}` : ''}
                {project.orderDate ? `  ·  ${new Date(project.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
              </Typography>
            </Box>
          </Box>

          <Box className="section" sx={{ mt: 3 }}>
            <Typography className="section-h" sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#777', mb: 1, borderBottom: '1px solid #eee', pb: 0.5 }}>
              Client
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
              {project.companyName || project.clientName || 'Untitled'}
            </Typography>
            {project.clientName && project.companyName && project.clientName !== project.companyName && (
              <Typography sx={{ fontSize: 13, color: '#555' }}>{project.clientName}</Typography>
            )}
          </Box>

          {project.confirmationMessage && (
            <Box className="section" sx={{ mt: 3 }}>
              <Typography sx={{ color: '#333', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5,
                p: 1.5, borderLeft: '3px solid #4ade80', bgcolor: '#f6fef9', borderRadius: '0 4px 4px 0' }}>
                {project.confirmationMessage}
              </Typography>
            </Box>
          )}

          {mockupThumbs.length > 0 && (
            <Box className="section" sx={{ mt: 3 }}>
              <Typography className="section-h" sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#777', mb: 1, borderBottom: '1px solid #eee', pb: 0.5 }}>
                Mockups
              </Typography>
              <Box className="mockup-grid" sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                {mockupThumbs.map((m, i) => (
                  <Box key={i} className="mockup" sx={{ aspectRatio: '4/3', bgcolor: '#f4f4f4', borderRadius: 1, overflow: 'hidden' }}>
                    {m.thumbnail && <Box component="img" src={m.thumbnail} alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </Box>
                ))}
              </Box>
              <Typography sx={{ mt: 1, color: '#888', fontSize: 11, fontFamily: 'monospace' }}>
                {(project.mockupNumbers || []).join(' · ')}
              </Typography>
            </Box>
          )}

          <Box className="section" sx={{ mt: 3 }}>
            <Typography className="section-h" sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#777', mb: 1, borderBottom: '1px solid #eee', pb: 0.5 }}>
              Items
            </Typography>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left',  fontSize: 10, textTransform: 'uppercase', color: '#777', padding: '6px 8px', borderBottom: '1px solid #ccc' }}>Qty</th>
                  <th style={{ textAlign: 'left',  fontSize: 10, textTransform: 'uppercase', color: '#777', padding: '6px 8px', borderBottom: '1px solid #ccc' }}>Description</th>
                  <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: '#777', padding: '6px 8px', borderBottom: '1px solid #ccc' }}>Unit $</th>
                  <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: '#777', padding: '6px 8px', borderBottom: '1px solid #ccc' }}>Line $</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '14px 8px', color: '#999', fontStyle: 'italic' }}>
                    No line items
                  </td></tr>
                ) : itemRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.qty || ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.description || ''}</td>
                    <td className="r" style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      {r.unitPrice ? fmt(r.unitPrice) : ''}
                    </td>
                    <td className="r" style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      {r.lineTotal ? fmt(r.lineTotal) : ''}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={3} className="r" style={{ padding: 10, textAlign: 'right', fontWeight: 800, borderTop: '2px solid #111', fontSize: 15 }}>Total</td>
                  <td className="r" style={{ padding: 10, textAlign: 'right', fontWeight: 800, borderTop: '2px solid #111', fontSize: 15 }}>
                    {fmt(total)}
                  </td>
                </tr>
              </tbody>
            </Box>
          </Box>

          {project.confirmationTerms && (
            <Box className="section" sx={{ mt: 3 }}>
              <Typography className="section-h" sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#777', mb: 1, borderBottom: '1px solid #eee', pb: 0.5 }}>
                Terms
              </Typography>
              <Typography sx={{ color: '#555', fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {project.confirmationTerms}
              </Typography>
            </Box>
          )}

          <Typography sx={{ mt: 5, color: '#888', fontSize: 10, textAlign: 'center' }}>
            Generated by Joint Printing · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
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

// ── QuoteEditor ──────────────────────────────────────────────────────────────
// Full cost-breakdown quoter (blank + print + markup → unit price → line total).
// Each line is a small card; quote total flows back to Order.totalValue server-side.
function QuoteEditor({ lines, onChange, onCommit, saving }) {
  const list = lines || [];
  const total = list.reduce((s, l) => {
    const unit = Number(l.unitPrice) || ((Number(l.blankCost) || 0) + (Number(l.printCost) || 0)) * (Number(l.markup) || 1);
    return s + (Number(l.qty) || 0) * unit;
  }, 0);

  const noSpinner = {
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  };
  const tfStyle = { ...darkInput, ...noSpinner, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.5 } };

  const update = (i, patch) => {
    const next = list.map((x, idx) => {
      if (idx !== i) return x;
      const merged = { ...x, ...patch };
      // Auto-recompute unitPrice if blank/print/markup change and the user
      // hasn't manually overridden (we detect by whether unitPrice was empty
      // OR matches the previously-derived value).
      if (patch.unitPrice === undefined &&
          (patch.blankCost !== undefined || patch.printCost !== undefined || patch.markup !== undefined)) {
        const blank = Number(merged.blankCost) || 0;
        const print = Number(merged.printCost) || 0;
        const m     = Number(merged.markup)    || 1;
        merged.unitPrice = +((blank + print) * m).toFixed(2);
      }
      return merged;
    });
    onChange(next);
  };
  const remove = (i) => {
    const next = list.filter((_, idx) => idx !== i);
    onChange(next);
    onCommit(next);
  };
  const add = () => {
    const next = [...list, {
      qty: 1, styleCode: '', description: '', color: '',
      supplier: '', blankCost: 0,
      printType: '', printDetails: '', printCost: 0,
      markup: 2, unitPrice: 0,
    }];
    onChange(next);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Quote {saving && <CircularProgress size={9} sx={{ color: B.green, ml: 0.5 }} />}
          {list.length > 0 && (
            <Typography component="span" sx={{ color: B.muted, fontSize: 10, ml: 0.6, textTransform: 'none', letterSpacing: 0 }}>
              · {list.length} line{list.length === 1 ? '' : 's'} · {fmt(total)}
            </Typography>
          )}
        </Typography>
        <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
          onClick={add}
          sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
          Add line
        </Button>
      </Stack>

      {list.length === 0 ? (
        <Box sx={{ border: `1px dashed ${B.border}`, borderRadius: 1, p: 1.5, textAlign: 'center', color: B.muted, fontSize: 11 }}>
          No quote yet. Add a line to start pricing this project.
        </Box>
      ) : (
        <Stack gap={1.2}>
          {list.map((line, i) => {
            const blank = Number(line.blankCost) || 0;
            const print = Number(line.printCost) || 0;
            const m     = Number(line.markup)    || 1;
            const derivedUnit = +((blank + print) * m).toFixed(2);
            const unitPrice = Number(line.unitPrice) || derivedUnit;
            const lineTotal = (Number(line.qty) || 0) * unitPrice;
            const unitOverridden = Number(line.unitPrice) > 0 && Math.abs(Number(line.unitPrice) - derivedUnit) > 0.01;

            return (
              <Box key={i} sx={{ border: `1px solid ${B.border}`, borderRadius: 1.5, p: 1.2, bgcolor: 'rgba(255,255,255,0.02)' }}>
                {/* Row 1: garment basics */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '54px 90px 1fr 100px 30px', gap: 0.6, alignItems: 'end' }}>
                  <QField label="Qty">
                    <TextField size="small" type="number" value={line.qty || ''}
                      onChange={e => update(i, { qty: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                  <QField label="Style">
                    <TextField size="small" value={line.styleCode || ''} placeholder="SS4500"
                      onChange={e => update(i, { styleCode: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                  <QField label="Description">
                    <TextField size="small" value={line.description || ''} placeholder="T-shirt"
                      onChange={e => update(i, { description: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                  <QField label="Color">
                    <TextField size="small" value={line.color || ''} placeholder="Black"
                      onChange={e => update(i, { color: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                  <IconButton size="small" onClick={() => remove(i)}
                    sx={{ color: B.muted, alignSelf: 'end', mb: 0.3, '&:hover': { color: '#f87171' } }}>
                    <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>

                {/* Row 2: blank cost */}
                <QSubhead>Garment</QSubhead>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 0.6, alignItems: 'end' }}>
                  <QField label="Supplier">
                    <TextField size="small" value={line.supplier || ''} placeholder="S&S Activewear"
                      onChange={e => update(i, { supplier: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                  <QField label="Blank $ ea">
                    <TextField size="small" type="number" value={line.blankCost || ''}
                      onChange={e => update(i, { blankCost: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                </Box>

                {/* Row 3: print */}
                <QSubhead>Print</QSubhead>
                <Box sx={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px', gap: 0.6, alignItems: 'end' }}>
                  <QField label="Type">
                    <FormControl size="small" fullWidth>
                      <Select value={line.printType || ''}
                        onChange={e => { update(i, { printType: e.target.value }); onCommit(list); }}
                        displayEmpty
                        sx={{ ...tfStyle['& .MuiInputBase-input'], color: B.white, fontSize: 12, '& .MuiSelect-icon': { color: B.muted } }}>
                        <MenuItem value=""><em>—</em></MenuItem>
                        <MenuItem value="Screen Print">Screen Print</MenuItem>
                        <MenuItem value="DTG">DTG</MenuItem>
                        <MenuItem value="DTF">DTF</MenuItem>
                        <MenuItem value="Embroidery">Embroidery</MenuItem>
                        <MenuItem value="Vinyl">Vinyl</MenuItem>
                        <MenuItem value="Sublimation">Sublimation</MenuItem>
                        <MenuItem value="None">None</MenuItem>
                      </Select>
                    </FormControl>
                  </QField>
                  <QField label="Details">
                    <TextField size="small" value={line.printDetails || ''} placeholder="1c front + 2c back"
                      onChange={e => update(i, { printDetails: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                  <QField label="Print $ ea">
                    <TextField size="small" type="number" value={line.printCost || ''}
                      onChange={e => update(i, { printCost: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                </Box>

                {/* Row 4: pricing */}
                <QSubhead>Pricing</QSubhead>
                <Box sx={{ display: 'grid', gridTemplateColumns: '70px 100px 1fr', gap: 0.6, alignItems: 'end' }}>
                  <QField label="Markup">
                    <TextField size="small" type="number" value={line.markup || ''}
                      onChange={e => update(i, { markup: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle}
                      InputProps={{ endAdornment: <Typography sx={{ color: B.muted, fontSize: 11 }}>×</Typography> }} />
                  </QField>
                  <QField label={`Unit $${unitOverridden ? ' (override)' : ''}`}>
                    <TextField size="small" type="number" value={line.unitPrice || ''} placeholder={String(derivedUnit)}
                      onChange={e => update(i, { unitPrice: e.target.value })}
                      onBlur={() => onCommit(list)} sx={tfStyle} />
                  </QField>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: B.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      Line $
                    </Typography>
                    <Typography sx={{ color: B.green, fontSize: 16, fontWeight: 800, fontFamily: 'monospace', mt: 0.2 }}>
                      {fmt(lineTotal)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}

          {/* Total bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4,
            bgcolor: 'rgba(74,222,128,0.08)', border: `1px solid ${B.green}40`, borderRadius: 1, px: 1.4, py: 1 }}>
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}>
              Quote total
            </Typography>
            <Typography sx={{ color: B.green, fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>
              {fmt(total)}
            </Typography>
          </Box>
        </Stack>
      )}
    </Box>
  );
}

function QField({ label, children }) {
  return (
    <Box>
      <Typography sx={{ color: B.muted, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.25 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function QSubhead({ children }) {
  return (
    <Typography sx={{
      color: B.muted, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
      mt: 1, mb: 0.4, opacity: 0.55,
      borderBottom: `1px solid ${B.faint}`, pb: 0.3,
    }}>
      {children}
    </Typography>
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
