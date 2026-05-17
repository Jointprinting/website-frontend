// src/screens/studio/CatalogManagerTab.js
//
// Catalogs admin tab. Three jobs:
//   1. One-click import of the four legacy catalogs (empty-state button).
//   2. CRUD for catalogs: title, description, tags, preset, accent, emoji,
//      published state, PDF upload/replace, reorder, delete.
//   3. Edit the public /catalogs page toast settings (headline, code, etc.)
//
// The tab uses its own copy of BRAND/darkInputSx so it can live in its own
// file without forcing a refactor of Studio.js. If those palette values ever
// change in Studio.js, mirror them here.

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Paper, Button, TextField, MenuItem, IconButton, Chip,
  Typography as MuiTypography, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Switch, FormControlLabel, Accordion,
  AccordionSummary, AccordionDetails, Divider, Tooltip,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import LaunchIcon from '@mui/icons-material/Launch';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import config from '../../config.json';

const BRAND = {
  bg:       '#0c1410',
  panel:    '#162420',
  border:   '#1a3d2b',
  green:    '#4ade80',
  greenDk:  '#1a3d2b',
  white:    '#ffffff',
  muted:    'rgba(255,255,255,0.65)',
  faint:    'rgba(255,255,255,0.08)',
};

const darkInputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.04)', color: BRAND.white,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: BRAND.green },
    '&.Mui-focused fieldset': { borderColor: BRAND.green },
  },
  '& .MuiOutlinedInput-input': { color: BRAND.white },
  '& .MuiInputBase-input': { color: BRAND.white },
  '& .MuiSelect-select': { color: BRAND.white },
  '& .MuiSelect-icon': { color: BRAND.muted },
  '& .MuiInputLabel-root': { color: BRAND.muted },
  '& .MuiInputLabel-root.Mui-focused': { color: BRAND.green },
  '& .MuiFormHelperText-root': { color: BRAND.muted },
};

// Mirrors the enum in models/Catalog.js. Keep in sync if you add a preset.
const PRESET_OPTIONS = [
  { id: 'default',   label: 'Default — emoji + clean title',     defaultAccent: '#2e7d32' },
  { id: 'patriotic', label: 'Patriotic — flag + tricolor words',  defaultAccent: '#B22234' },
  { id: 'holiday',   label: 'Holiday — winter shimmer gradient',  defaultAccent: '#0f766e' },
  { id: 'canopy',    label: 'Canopy — deep cannabis green',       defaultAccent: '#1b5e20' },
  { id: 'prestige',  label: 'Prestige — gold + serif italic',     defaultAccent: '#b8860b' },
  { id: 'neon',      label: 'Neon — cyberpunk gradient + mono',   defaultAccent: '#a855f7' },
];

const presetMeta = (id) => PRESET_OPTIONS.find((p) => p.id === id) || PRESET_OPTIONS[0];

// ─────────────────────────────────────────────────────────────────────────────
// Toast settings panel — collapsible
// ─────────────────────────────────────────────────────────────────────────────
function ToastSettingsPanel({ token }) {
  const [loading, setLoading]   = React.useState(true);
  const [saving, setSaving]     = React.useState(false);
  const [err, setErr]           = React.useState('');
  const [ok, setOk]             = React.useState('');
  const [val, setVal] = React.useState({
    enabled: false, headline: '', code: '', subtext: '', accentColor: '#1a3d2b',
  });

  React.useEffect(() => {
    let cancelled = false;
    axios.get(`${config.backendUrl}/api/site-settings/catalogToast`)
      .then((r) => { if (!cancelled) setVal(r.data.value || val); })
      .catch((e) => { if (!cancelled) setErr(e?.response?.data?.message || 'Failed to load toast settings.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setErr(''); setOk(''); setSaving(true);
    try {
      const r = await axios.put(
        `${config.backendUrl}/api/site-settings/catalogToast`,
        { value: val },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVal(r.data.value);
      setOk('Toast settings saved.');
      setTimeout(() => setOk(''), 2400);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Accordion
      defaultExpanded={false}
      disableGutters
      elevation={0}
      sx={{
        bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 2,
        mb: 2.5, '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: BRAND.muted }} />}
        sx={{
          px: 2.5, py: 1.5,
          '& .MuiAccordionSummary-content': { my: 0.5 },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
          <MuiTypography sx={{ color: BRAND.white, fontWeight: 700 }}>
            Catalog page toast
          </MuiTypography>
          <Chip
            size="small"
            label={val.enabled ? 'LIVE' : 'OFF'}
            sx={{
              fontSize: 10, fontWeight: 800, letterSpacing: 1,
              bgcolor: val.enabled ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.08)',
              color: val.enabled ? BRAND.green : BRAND.muted,
            }}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={20} sx={{ color: BRAND.green }} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <MuiTypography variant="caption" sx={{ color: BRAND.muted }}>
              Shown to visitors on /catalogs as a slide-in toast (bottom right).
              Auto-dismisses after 8 seconds. Doesn't show again the same session.
            </MuiTypography>
            <FormControlLabel
              control={
                <Switch
                  checked={!!val.enabled}
                  onChange={(e) => setVal({ ...val, enabled: e.target.checked })}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND.green },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: BRAND.green },
                  }}
                />
              }
              label={<MuiTypography sx={{ color: BRAND.white, fontWeight: 600 }}>Enabled</MuiTypography>}
            />
            <TextField
              label="Headline" fullWidth size="small" sx={darkInputSx}
              value={val.headline}
              onChange={(e) => setVal({ ...val, headline: e.target.value })}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Discount code" fullWidth size="small" sx={darkInputSx}
              value={val.code}
              onChange={(e) => setVal({ ...val, code: e.target.value })}
              inputProps={{ maxLength: 40 }}
              helperText="Code visitors will click to copy."
            />
            <TextField
              label="Subtext" fullWidth multiline minRows={2} sx={darkInputSx}
              value={val.subtext}
              onChange={(e) => setVal({ ...val, subtext: e.target.value })}
              inputProps={{ maxLength: 240 }}
            />
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <TextField
                label="Accent color"
                size="small"
                sx={{ ...darkInputSx, width: 160 }}
                value={val.accentColor}
                onChange={(e) => setVal({ ...val, accentColor: e.target.value })}
                inputProps={{ maxLength: 32 }}
              />
              <Box
                component="input"
                type="color"
                value={val.accentColor}
                onChange={(e) => setVal({ ...val, accentColor: e.target.value })}
                sx={{
                  width: 44, height: 36, borderRadius: 1, border: `1px solid ${BRAND.border}`,
                  bgcolor: 'transparent', cursor: 'pointer', p: 0,
                }}
              />
            </Stack>
            {err && <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5' }}>{err}</Alert>}
            {ok && <Alert severity="success" sx={{ bgcolor: 'rgba(74,222,128,0.08)', color: BRAND.green }}>{ok}</Alert>}
            <Stack direction="row" spacing={1.5}>
              <Button
                onClick={save} disabled={saving}
                variant="contained"
                sx={{
                  bgcolor: BRAND.green, color: BRAND.greenDk, fontWeight: 700,
                  textTransform: 'none', borderRadius: 999, px: 3,
                  '&:hover': { bgcolor: BRAND.green, filter: 'brightness(1.08)' },
                  '&.Mui-disabled': { bgcolor: BRAND.greenDk, color: BRAND.muted },
                }}
              >
                {saving ? 'Saving…' : 'Save toast settings'}
              </Button>
            </Stack>
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit / Create dialog
// ─────────────────────────────────────────────────────────────────────────────
function EditCatalogDialog({ open, onClose, onSaved, token, initial }) {
  const isNew = !initial;
  const [form, setForm] = React.useState(() => ({
    title:       initial?.title || '',
    description: initial?.description || '',
    tags:        (initial?.tags || []).join(', '),
    stylePreset: initial?.stylePreset || 'default',
    accentColor: initial?.accentColor || '#2e7d32',
    emoji:       initial?.emoji || '📘',
    isPublished: initial?.isPublished ?? true,
  }));
  const [pdfFile, setPdfFile]   = React.useState(null);
  const [saving, setSaving]     = React.useState(false);
  const [err, setErr]           = React.useState('');

  // When the user picks a preset, auto-fill the accent color the first time
  // (don't overwrite if they've already customized it).
  const onPresetChange = (id) => {
    const m = presetMeta(id);
    setForm((f) => ({
      ...f,
      stylePreset: id,
      // only auto-update accent if it currently matches a known preset default
      accentColor: PRESET_OPTIONS.some((p) => p.defaultAccent === f.accentColor)
        ? m.defaultAccent
        : f.accentColor,
    }));
  };

  const save = async () => {
    setErr(''); setSaving(true);
    try {
      if (!form.title.trim()) throw new Error('Title is required.');
      if (isNew && !pdfFile) throw new Error('PDF file is required for new catalogs.');

      let saved;
      if (isNew) {
        // Create with PDF in one multipart request.
        const fd = new FormData();
        fd.append('title',       form.title.trim());
        fd.append('description', form.description.trim());
        fd.append('tags',        form.tags);
        fd.append('stylePreset', form.stylePreset);
        fd.append('accentColor', form.accentColor);
        fd.append('emoji',       form.emoji);
        fd.append('isPublished', form.isPublished ? 'true' : 'false');
        fd.append('pdf', pdfFile);
        const r = await axios.post(
          `${config.backendUrl}/api/catalogs`,
          fd,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        saved = r.data;
      } else {
        // Update metadata first, then PDF if user picked a new file.
        const r = await axios.put(
          `${config.backendUrl}/api/catalogs/${initial._id}`,
          {
            title:       form.title.trim(),
            description: form.description.trim(),
            tags:        form.tags,
            stylePreset: form.stylePreset,
            accentColor: form.accentColor,
            emoji:       form.emoji,
            isPublished: form.isPublished,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        saved = r.data;
        if (pdfFile) {
          const fd = new FormData();
          fd.append('pdf', pdfFile);
          const r2 = await axios.put(
            `${config.backendUrl}/api/catalogs/${initial._id}/pdf`,
            fd,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          saved = r2.data;
        }
      }

      onSaved(saved);
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open} onClose={saving ? undefined : onClose}
      maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`, color: BRAND.white } }}
    >
      <DialogTitle sx={{ color: BRAND.white, fontWeight: 800, borderBottom: `1px solid ${BRAND.faint}` }}>
        {isNew ? 'Add catalog' : 'Edit catalog'}
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Title *" fullWidth size="small" sx={darkInputSx}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            label="Description" fullWidth multiline minRows={3} sx={darkInputSx}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <TextField
            label="Tags (comma-separated)" fullWidth size="small" sx={darkInputSx}
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            helperText='e.g. "Apparel, Dispensary, Promos"'
          />
          <TextField
            select label="Style preset" fullWidth size="small" sx={darkInputSx}
            value={form.stylePreset}
            onChange={(e) => onPresetChange(e.target.value)}
          >
            {PRESET_OPTIONS.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              label="Accent color" size="small"
              sx={{ ...darkInputSx, width: 160 }}
              value={form.accentColor}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
            />
            <Box
              component="input" type="color"
              value={form.accentColor}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              sx={{
                width: 44, height: 36, borderRadius: 1, border: `1px solid ${BRAND.border}`,
                bgcolor: 'transparent', cursor: 'pointer', p: 0,
              }}
            />
            {form.stylePreset === 'default' && (
              <TextField
                label="Emoji" size="small"
                sx={{ ...darkInputSx, width: 110 }}
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                inputProps={{ maxLength: 8 }}
              />
            )}
          </Stack>
          <Box
            sx={{
              border: `1px dashed ${BRAND.border}`, borderRadius: 2,
              p: 2, bgcolor: 'rgba(255,255,255,0.02)',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <UploadFileIcon sx={{ color: BRAND.green }} />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <MuiTypography sx={{ color: BRAND.white, fontWeight: 600, fontSize: 14 }}>
                  {isNew ? 'PDF file *' : 'Replace PDF (optional)'}
                </MuiTypography>
                <MuiTypography sx={{ color: BRAND.muted, fontSize: 12 }}>
                  {pdfFile
                    ? `${pdfFile.name} · ${(pdfFile.size / 1024 / 1024).toFixed(1)} MB`
                    : (initial?.pdfFileName
                        ? `Current: ${initial.pdfFileName}`
                        : 'No file selected · max 30 MB'
                      )}
                </MuiTypography>
              </Box>
              <Button
                component="label" size="small" variant="outlined"
                startIcon={<UploadFileIcon />}
                sx={{
                  textTransform: 'none', borderRadius: 999, fontWeight: 600,
                  color: BRAND.green, borderColor: BRAND.green,
                  '&:hover': { borderColor: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
                }}
              >
                Choose PDF
                <input
                  hidden type="file" accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                />
              </Button>
            </Stack>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={!!form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND.green },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: BRAND.green },
                }}
              />
            }
            label={<MuiTypography sx={{ color: BRAND.white, fontWeight: 600 }}>
              Published (visible on the public catalogs page)
            </MuiTypography>}
          />
          {err && (
            <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5' }}>
              {err}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${BRAND.faint}` }}>
        <Button
          onClick={onClose} disabled={saving}
          sx={{ color: BRAND.muted, textTransform: 'none', fontWeight: 600 }}
        >Cancel</Button>
        <Button
          onClick={save} disabled={saving}
          variant="contained"
          sx={{
            bgcolor: BRAND.green, color: BRAND.greenDk, fontWeight: 700,
            textTransform: 'none', borderRadius: 999, px: 3,
            '&:hover': { bgcolor: BRAND.green, filter: 'brightness(1.08)' },
            '&.Mui-disabled': { bgcolor: BRAND.greenDk, color: BRAND.muted },
          }}
        >
          {saving ? (isNew ? 'Creating…' : 'Saving…') : (isNew ? 'Create' : 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One catalog row
// ─────────────────────────────────────────────────────────────────────────────
function CatalogRow({ catalog, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const accent = catalog.accentColor || presetMeta(catalog.stylePreset).defaultAccent;
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`,
        borderRadius: 2, p: 2, mb: 1.25, position: 'relative', overflow: 'hidden',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        {/* Visual hint — emoji or preset badge */}
        <Box sx={{
          width: 44, height: 44, borderRadius: 1.5,
          bgcolor: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, flexShrink: 0,
        }}>
          {catalog.emoji || '📘'}
        </Box>

        {/* Main column */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.5 }}>
            <MuiTypography sx={{ color: BRAND.white, fontWeight: 700, fontSize: 15 }}>
              {catalog.title}
            </MuiTypography>
            {!catalog.isPublished && (
              <Chip size="small" label="DRAFT"
                sx={{
                  fontSize: 10, fontWeight: 800, letterSpacing: 1, height: 18,
                  bgcolor: 'rgba(255,255,255,0.08)', color: BRAND.muted,
                }}
              />
            )}
            <Chip size="small" label={catalog.stylePreset?.toUpperCase()}
              sx={{
                fontSize: 9, fontWeight: 800, letterSpacing: 1, height: 18,
                bgcolor: `${accent}22`, color: accent,
              }}
            />
          </Stack>
          <MuiTypography sx={{ color: BRAND.muted, fontSize: 12.5, lineHeight: 1.45,
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
          }}>
            {catalog.description || <em>No description</em>}
          </MuiTypography>
          <Stack direction="row" spacing={2} sx={{ mt: 0.75 }}>
            <MuiTypography sx={{ color: BRAND.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VisibilityIcon sx={{ fontSize: 13 }} /> {catalog.viewCount || 0}
            </MuiTypography>
            <MuiTypography sx={{ color: BRAND.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <DownloadIcon sx={{ fontSize: 13 }} /> {catalog.downloadCount || 0}
            </MuiTypography>
          </Stack>
        </Box>

        {/* Action buttons */}
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Tooltip title="Move up">
            <span>
              <IconButton size="small" onClick={() => onMoveUp(catalog)} disabled={isFirst}
                sx={{ color: BRAND.muted, '&:hover': { color: BRAND.green }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' } }}>
                <ArrowUpwardIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Move down">
            <span>
              <IconButton size="small" onClick={() => onMoveDown(catalog)} disabled={isLast}
                sx={{ color: BRAND.muted, '&:hover': { color: BRAND.green }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' } }}>
                <ArrowDownwardIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Open PDF">
            <IconButton
              size="small"
              component="a"
              href={`${config.backendUrl}/api/catalogs/${catalog._id}/pdf`}
              target="_blank" rel="noopener noreferrer"
              sx={{ color: BRAND.muted, '&:hover': { color: BRAND.green } }}
            >
              <LaunchIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(catalog)}
              sx={{ color: BRAND.muted, '&:hover': { color: BRAND.green } }}>
              <EditOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => onDelete(catalog)}
              sx={{ color: BRAND.muted, '&:hover': { color: '#f87171' } }}>
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────
export default function CatalogManagerTab({ token }) {
  const [catalogs, setCatalogs]   = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [err, setErr]             = React.useState('');
  const [info, setInfo]           = React.useState('');
  const [seeding, setSeeding]     = React.useState(false);
  const [editing, setEditing]     = React.useState(null);  // catalog being edited, or null
  const [creating, setCreating]   = React.useState(false); // true when "Add" dialog is open
  const [confirmDel, setConfirmDel] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await axios.get(`${config.backendUrl}/api/catalogs/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCatalogs(r.data);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load catalogs.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const runSeed = async () => {
    setSeeding(true); setErr(''); setInfo('');
    try {
      const r = await axios.post(
        `${config.backendUrl}/api/catalogs/seed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { created = [], failed = [] } = r.data;
      let msg = `Imported ${created.length} catalog(s).`;
      if (failed.length) msg += ` ${failed.length} failed: ${failed.map((f) => f.title).join(', ')}.`;
      setInfo(msg);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Import failed.');
    } finally {
      setSeeding(false);
    }
  };

  const onSaved = (saved) => {
    setInfo(`Saved "${saved.title}".`);
    setTimeout(() => setInfo(''), 2400);
    load();
  };

  const onDelete = async (cat) => {
    setErr(''); setInfo('');
    try {
      await axios.delete(
        `${config.backendUrl}/api/catalogs/${cat._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInfo(`Deleted "${cat.title}".`);
      setTimeout(() => setInfo(''), 2400);
      load();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Delete failed.');
    } finally {
      setConfirmDel(null);
    }
  };

  /**
   * Swap sortOrder with the neighbor in the requested direction.
   * Server only knows about whatever we send via the reorder endpoint, so
   * we just push the whole reordered list and trust it.
   */
  const move = async (cat, dir) => {
    const idx = catalogs.findIndex((c) => c._id === cat._id);
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= catalogs.length) return;

    const newList = [...catalogs];
    [newList[idx], newList[targetIdx]] = [newList[targetIdx], newList[idx]];
    // Renumber for clean integer sort orders
    const renumbered = newList.map((c, i) => ({ ...c, sortOrder: i }));
    setCatalogs(renumbered); // optimistic

    try {
      await axios.put(
        `${config.backendUrl}/api/catalogs/reorder`,
        { order: renumbered.map((c) => ({ id: c._id, sortOrder: c.sortOrder })) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      setErr('Reorder failed. Reloading…');
      load();
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header row */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }}
        justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <MuiTypography sx={{ color: BRAND.white, fontWeight: 800, fontSize: 20 }}>
            Catalogs
          </MuiTypography>
          <MuiTypography sx={{ color: BRAND.muted, fontSize: 13 }}>
            Manage the PDFs and styling shown on the public /catalogs page.
          </MuiTypography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            onClick={load} size="small"
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none', fontWeight: 600, color: BRAND.muted,
              '&:hover': { color: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
            }}
          >Refresh</Button>
          <Button
            onClick={() => setCreating(true)}
            startIcon={<AddCircleOutlineIcon />}
            variant="contained"
            sx={{
              bgcolor: BRAND.green, color: BRAND.greenDk, fontWeight: 700,
              textTransform: 'none', borderRadius: 999, px: 2.5,
              '&:hover': { bgcolor: BRAND.green, filter: 'brightness(1.08)' },
            }}
          >Add catalog</Button>
        </Stack>
      </Stack>

      <ToastSettingsPanel token={token} />
      <Divider sx={{ borderColor: BRAND.faint, mb: 2 }} />

      {/* Alerts */}
      {err && <Alert severity="error"
        sx={{ mb: 2, bgcolor: 'rgba(248,113,113,0.08)', color: '#fca5a5' }}>{err}</Alert>}
      {info && <Alert severity="success"
        sx={{ mb: 2, bgcolor: 'rgba(74,222,128,0.08)', color: BRAND.green }}>{info}</Alert>}

      {/* Body */}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} sx={{ color: BRAND.green }} />
        </Stack>
      ) : catalogs.length === 0 ? (
        <Paper elevation={0} sx={{
          bgcolor: BRAND.panel, border: `1px dashed ${BRAND.border}`,
          borderRadius: 3, p: 5, textAlign: 'center',
        }}>
          <CloudUploadIcon sx={{ fontSize: 44, color: BRAND.muted, mb: 1 }} />
          <MuiTypography sx={{ color: BRAND.white, fontWeight: 700, mb: 0.5 }}>
            No catalogs yet
          </MuiTypography>
          <MuiTypography sx={{ color: BRAND.muted, mb: 3, maxWidth: 460, mx: 'auto' }}>
            Import the four catalogs that currently live on jointprinting.com/catalogs —
            this copies their PDFs into the database so you can edit them from here.
          </MuiTypography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
            justifyContent="center" alignItems="center">
            <Button
              onClick={runSeed} disabled={seeding}
              variant="contained"
              startIcon={seeding
                ? <CircularProgress size={16} sx={{ color: BRAND.greenDk }} />
                : <CloudUploadIcon />}
              sx={{
                bgcolor: BRAND.green, color: BRAND.greenDk, fontWeight: 700,
                textTransform: 'none', borderRadius: 999, px: 3,
                '&:hover': { bgcolor: BRAND.green, filter: 'brightness(1.08)' },
                '&.Mui-disabled': { bgcolor: BRAND.greenDk, color: BRAND.muted },
              }}
            >
              {seeding ? 'Importing…' : 'Import existing 4 catalogs'}
            </Button>
            <MuiTypography sx={{ color: BRAND.muted, fontSize: 13 }}>or</MuiTypography>
            <Button
              onClick={() => setCreating(true)}
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              sx={{
                textTransform: 'none', fontWeight: 600, borderRadius: 999, px: 3,
                color: BRAND.green, borderColor: BRAND.green,
                '&:hover': { borderColor: BRAND.green, bgcolor: 'rgba(74,222,128,0.06)' },
              }}
            >Add manually</Button>
          </Stack>
        </Paper>
      ) : (
        <Box>
          {catalogs.map((c, i) => (
            <CatalogRow
              key={c._id}
              catalog={c}
              isFirst={i === 0}
              isLast={i === catalogs.length - 1}
              onEdit={(x) => setEditing(x)}
              onDelete={(x) => setConfirmDel(x)}
              onMoveUp={(x) => move(x, 'up')}
              onMoveDown={(x) => move(x, 'down')}
            />
          ))}
        </Box>
      )}

      {/* Edit dialog */}
      {(editing || creating) && (
        <EditCatalogDialog
          open
          initial={editing}
          token={token}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={(saved) => { setEditing(null); setCreating(false); onSaved(saved); }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)}
        PaperProps={{ sx: { bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`, color: BRAND.white } }}
      >
        <DialogTitle sx={{ color: BRAND.white, fontWeight: 800 }}>Delete catalog?</DialogTitle>
        <DialogContent>
          <MuiTypography sx={{ color: BRAND.muted }}>
            "{confirmDel?.title}" and its PDF will be permanently deleted. This can't be undone.
          </MuiTypography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConfirmDel(null)}
            sx={{ color: BRAND.muted, textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={() => onDelete(confirmDel)}
            variant="contained"
            sx={{
              bgcolor: '#f87171', color: '#7f1d1d', fontWeight: 700,
              textTransform: 'none', borderRadius: 999, px: 3,
              '&:hover': { bgcolor: '#f87171', filter: 'brightness(1.08)' },
            }}
          >Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
