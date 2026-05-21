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
import DeleteOutlineIcon   from '@mui/icons-material/DeleteOutline';
import AttachFileIcon      from '@mui/icons-material/AttachFile';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PrintIcon           from '@mui/icons-material/Print';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
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
  const [stats,         setStats]         = useState({});
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [activeProject, setActiveProject] = useState(null);
  const [creating,      setCreating]      = useState(false);
  const [resyncing,     setResyncing]     = useState(false);
  const [picker,        setPicker]        = useState({ open: false, project: null });
  const [confirmation,  setConfirmation]  = useState(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, mk, ds] = await Promise.all([
        axios.get(`${base}/orders/projects`, authHdr),
        axios.get(`${base}/studio/library/mockups`, authHdr),
        axios.get(`${base}/orders/dashboard`, authHdr),
      ]);
      setProjects(pr.data.projects || []);
      setMockups(mk.data.items || []);
      setStats(ds.data || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authHdr]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const mockupMap = useMemo(() => {
    const m = {};
    mockups.forEach(x => {
      const k = x.pageState?.mockupNum;
      if (k) m[k] = x;
      if (x.name && !m[x.name]) m[x.name] = x;
    });
    return m;
  }, [mockups]);

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

          <Tooltip title="Re-pull from Notion seed">
            <span>
              <IconButton onClick={handleResync} disabled={resyncing}
                sx={{ color: B.muted, '&:hover': { color: B.green } }}>
                {resyncing ? <CircularProgress size={18} sx={{ color: B.green }} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>

          <Button
            startIcon={creating ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : <AddIcon />}
            onClick={handleCreate}
            disabled={creating}
            sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, textTransform: 'none',
              px: 2, '&:hover': { bgcolor: '#3bd070' } }}>
            New project
          </Button>
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
              <ProjectCard key={p._id} project={p} mockupMap={mockupMap}
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
        onClose={() => setConfirmation(null)}
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

function ProjectCard({ project, mockupMap, onClick }) {
  const meta = STATUS_META[project.status] || STATUS_META.quoted;
  const itemSummary = (project.items || []).map(i => i.description).filter(Boolean).join(' · ') || '—';
  const mockupThumbs = (project.mockupNumbers || []).slice(0, 4).map(n => mockupMap[n]).filter(Boolean);

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
        {mockupThumbs.length > 0 ? (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: mockupThumbs.length === 1 ? '1fr' :
                                 mockupThumbs.length === 2 ? '1fr 1fr' :
                                 '2fr 1fr',
            gridTemplateRows:    mockupThumbs.length <= 2 ? '1fr' : '1fr 1fr',
            height: '100%',
            gap: '2px',
          }}>
            {mockupThumbs.map((m, i) => (
              <Box key={i} sx={{
                bgcolor: B.bg,
                gridColumn: mockupThumbs.length === 3 && i === 0 ? '1' : undefined,
                gridRow:    mockupThumbs.length === 3 && i === 0 ? '1 / 3' : undefined,
              }}>
                {m.thumbnail ? (
                  <Box component="img" src={m.thumbnail} alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', bgcolor: B.panelHi,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DesignServicesIcon sx={{ color: B.muted, opacity: 0.3 }} />
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

function ProjectDrawer({ open, project, mockupMap, mockups, onClose, onSave, onDelete, onOpenPicker, onOpenConfirmation, token, authHdr }) {
  const [local, setLocal] = useState(null);
  const [savingField, setSavingField] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (project) setLocal({ ...project }); }, [project]);

  if (!project || !local) return null;

  const meta = STATUS_META[local.status] || STATUS_META.quoted;
  const thumbs = (local.mockupNumbers || []).map(n => mockupMap[n]).filter(Boolean);

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
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Mockups · {thumbs.length}
          </Typography>
          <Button size="small" startIcon={<DesignServicesIcon sx={{ fontSize: 14 }} />}
            onClick={onOpenPicker}
            sx={{ color: B.green, fontSize: 11, textTransform: 'none' }}>
            {thumbs.length === 0 ? 'Link mockups' : 'Edit mockups'}
          </Button>
        </Stack>
        {thumbs.length > 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 1 }}>
            {thumbs.map((m, i) => (
              <Box key={i} sx={{
                aspectRatio: '1', borderRadius: 1.5, overflow: 'hidden',
                border: `1px solid ${B.border}`, bgcolor: B.panelHi,
              }}>
                {m.thumbnail ? (
                  <Box component="img" src={m.thumbnail} alt={m.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DesignServicesIcon sx={{ color: B.muted, opacity: 0.3 }} />
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{
            border: `1px dashed ${B.border}`, borderRadius: 1.5, py: 3,
            textAlign: 'center', color: B.muted, fontSize: 12,
          }}>
            No mockups linked yet
          </Box>
        )}
        {(local.mockupNumbers || []).length > 0 && (
          <Typography sx={{ mt: 1, color: B.muted, fontSize: 10, fontFamily: 'monospace' }}>
            {(local.mockupNumbers || []).join(' · ')}
          </Typography>
        )}
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
              const totalValue = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
              updateLocal({ items, totalValue });
              setSavingField('items');
              await onSave(project._id, { items, totalValue });
              setSavingField('');
            }}
          />
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <InlineField label="Notes" multiline value={local.notes || ''} savingHint={savingField === 'notes'}
            onChange={v => updateLocal({ notes: v })} onBlur={v => saveField('notes', v)} />
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
        sx={darkInput}
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
function ItemsEditor({ items, onChange, onCommit, saving }) {
  const list = items && items.length > 0 ? items : [];
  const total = list.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);

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
          No line items yet. Add one to build the quote.
        </Box>
      ) : (
        <Box sx={{ border: `1px solid ${B.border}`, borderRadius: 1, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '46px 1fr 80px 80px 28px',
            gap: 0.5, px: 0.8, py: 0.4, bgcolor: B.panelHi,
            fontSize: 9, fontWeight: 700, color: B.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            <Box>Qty</Box>
            <Box>Description</Box>
            <Box sx={{ textAlign: 'right' }}>Unit $</Box>
            <Box sx={{ textAlign: 'right' }}>Line $</Box>
            <Box />
          </Box>
          {list.map((it, i) => {
            const line = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
            return (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '46px 1fr 80px 80px 28px',
                gap: 0.5, alignItems: 'center', px: 0.8, py: 0.4,
                borderTop: `1px solid ${B.faint}` }}>
                <TextField size="small" type="number" value={it.qty || ''}
                  onChange={e => update(i, { qty: e.target.value })}
                  onBlur={() => onCommit(list)}
                  sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.4, textAlign: 'right' } }} />
                <TextField size="small" value={it.description || ''}
                  onChange={e => update(i, { description: e.target.value })}
                  onBlur={() => onCommit(list)}
                  placeholder="50 Bella+Canvas 3001, Black, screen print"
                  sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.4 } }} />
                <TextField size="small" type="number" value={it.unitPrice || ''}
                  onChange={e => update(i, { unitPrice: e.target.value })}
                  onBlur={() => onCommit(list)}
                  sx={{ ...darkInput, '& .MuiInputBase-input': { color: B.white, fontSize: 12, py: 0.4, textAlign: 'right' } }} />
                <Box sx={{ color: B.white, fontSize: 12, fontFamily: 'monospace', textAlign: 'right', py: 0.4 }}>
                  {fmt(line)}
                </Box>
                <IconButton size="small" onClick={() => remove(i)}
                  sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
                  <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            );
          })}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px',
            gap: 0.5, alignItems: 'center', px: 0.8, py: 0.6,
            borderTop: `2px solid ${B.border}`, bgcolor: B.panelHi }}>
            <Box sx={{ color: B.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Quote total
            </Box>
            <Box sx={{ color: B.green, fontSize: 14, fontWeight: 800, fontFamily: 'monospace', textAlign: 'right' }}>
              {fmt(total)}
            </Box>
            <Box />
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── ConfirmationDialog ───────────────────────────────────────────────────────
// Client-facing confirmation page. Printable (window.print) and screenshottable.
// Renders mockups, line items, totals, and a clean header.
function ConfirmationDialog({ open, project, mockupMap, onClose }) {
  if (!project) return null;
  const mockupThumbs = (project.mockupNumbers || []).map(n => mockupMap[n]).filter(Boolean);
  const items = project.items || [];
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const total = Number(project.totalValue) || subtotal;

  const handlePrint = () => {
    const el = document.getElementById('confirmation-printable');
    if (!el) return window.print();
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
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
          <Typography sx={{ fontWeight: 800, fontSize: 24, mb: 0.3, color: '#111' }}>
            JOINT PRINTING
          </Typography>
          <Typography sx={{ color: '#555', fontSize: 12 }}>
            Project #{project.projectNumber || '—'}
            {project.orderNumber ? `  ·  Invoice #${project.orderNumber}` : ''}
            {project.orderDate ? `  ·  ${new Date(project.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
          </Typography>

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
                {items.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '14px 8px', color: '#999', fontStyle: 'italic' }}>
                    No line items
                  </td></tr>
                ) : items.map((it, i) => {
                  const line = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
                  return (
                    <tr key={i}>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{it.qty || ''}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{it.description || ''}</td>
                      <td className="r" style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                        {it.unitPrice ? fmt(it.unitPrice) : ''}
                      </td>
                      <td className="r" style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                        {line ? fmt(line) : ''}
                      </td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td colSpan={3} className="r" style={{ padding: 10, textAlign: 'right', fontWeight: 800, borderTop: '2px solid #111', fontSize: 15 }}>Total</td>
                  <td className="r" style={{ padding: 10, textAlign: 'right', fontWeight: 800, borderTop: '2px solid #111', fontSize: 15 }}>
                    {fmt(total)}
                  </td>
                </tr>
              </tbody>
            </Box>
          </Box>

          {project.notes && (
            <Box className="section" sx={{ mt: 3 }}>
              <Typography className="section-h" sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#777', mb: 1, borderBottom: '1px solid #eee', pb: 0.5 }}>
                Notes
              </Typography>
              <Typography sx={{ color: '#333', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {project.notes}
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
