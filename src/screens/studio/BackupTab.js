// src/screens/studio/BackupTab.js
// Full-site backup / restore. Used both inline (as a Studio screen) and
// surfaced as a banner-trigger when a weekly backup is overdue.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Alert, Chip,
} from '@mui/material';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import CloudDownloadIcon   from '@mui/icons-material/CloudDownload';
import CloudUploadIcon     from '@mui/icons-material/CloudUpload';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon    from '@mui/icons-material/ErrorOutline';
import { B, fmtDate, fmtRelative } from './_shared';
import config from '../../config.json';

const base = `${config.backendUrl}/api`;

export default function BackupTab({ token, onBack }) {
  const authHdr = { headers: { Authorization: `Bearer ${token}` } };
  const [stat, setStat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const fileRef = useRef(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}/admin/backup/status`, authHdr);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (_) {}
        throw new Error(msg);
      }
      const data = await res.json();
      setStat(data);
    } catch (e) {
      setStat({ error: e.message });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${base}/admin/backup/export`, authHdr);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // ISO timestamp (with time, colons swapped) so two same-day backups don't overwrite each other.
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `joint-printing-backup-${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await loadStatus();
    } catch (e) {
      alert(`Backup failed: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm(
      `Restore from "${file.name}"?\n\n` +
      'THIS WILL REPLACE ALL DATA. Every project, mockup, client logo, ' +
      'setting, and file currently on the server gets wiped and replaced ' +
      'with what\'s in this backup ZIP. Make sure you really want to do ' +
      'this — there\'s no undo.'
    )) return;

    setRestoring(true);
    setRestoreResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${base}/admin/backup/restore`, {
        method: 'POST', headers: authHdr.headers, body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Restore failed');
      setRestoreResult({ ok: true, ...data });
      await loadStatus();
    } catch (e) {
      setRestoreResult({ ok: false, error: e.message });
    } finally {
      setRestoring(false);
    }
  };

  const isDue = stat && stat.isDue;
  const days  = stat ? stat.lastBackupDays : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white, p: { xs: 2, md: 4 } }}>
      <Stack direction="row" alignItems="center" gap={1.5} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack}
          sx={{ color: B.muted, textTransform: 'none', '&:hover': { color: B.white } }}>
          Back
        </Button>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 20 }}>
          Backup & restore
        </Typography>
      </Stack>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress sx={{ color: B.green }} />
        </Box>
      ) : (
        <Box sx={{ maxWidth: 720 }}>
          {stat && stat.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Could not reach the backup service — {stat.error}
            </Alert>
          )}

          {/* Status */}
          <Box sx={{ bgcolor: B.panel, border: `1px solid ${isDue ? '#fbbf24' : B.border}`,
            borderRadius: 2, p: { xs: 2, md: 3 }, mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} mb={2}>
              {isDue
                ? <ErrorOutlineIcon sx={{ color: '#fbbf24', fontSize: 28 }} />
                : <CheckCircleOutlineIcon sx={{ color: B.green, fontSize: 28 }} />}
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 16 }}>
                  {stat && stat.lastBackupAt
                    ? (isDue ? 'Backup overdue' : 'Backups up to date')
                    : 'No backup yet'}
                </Typography>
                <Typography sx={{ color: B.muted, fontSize: 12, mt: 0.4 }}>
                  {stat && stat.lastBackupAt ? (
                    <>Last export: {fmtDate(stat.lastBackupAt)} ({fmtRelative(stat.lastBackupAt)}) · {days}d ago.{' '}
                    {isDue ? `Aim for one every ${stat.dueAfterDays} days.` : `Next due ~${stat.dueAfterDays - days}d.`}</>
                  ) : (
                    'Download your first backup now and save it somewhere safe — hard drive, cloud storage, both.'
                  )}
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
              <Button onClick={handleDownload} disabled={downloading}
                startIcon={downloading
                  ? <CircularProgress size={14} sx={{ color: B.greenDk }} />
                  : <CloudDownloadIcon />}
                sx={{ bgcolor: B.green, color: B.greenDk, textTransform: 'none', fontWeight: 700,
                  flex: 1, py: 1, '&:hover': { bgcolor: '#3bd070' } }}>
                {downloading ? 'Preparing archive…' : 'Download backup now'}
              </Button>
              <input ref={fileRef} type="file" accept=".zip" hidden onChange={handleRestore} />
              <Button onClick={() => fileRef.current?.click()} disabled={restoring}
                startIcon={restoring
                  ? <CircularProgress size={14} sx={{ color: '#f87171' }} />
                  : <CloudUploadIcon />}
                variant="outlined"
                sx={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.4)', textTransform: 'none', fontWeight: 700,
                  flex: 1, py: 1, '&:hover': { borderColor: '#f87171', bgcolor: 'rgba(248,113,113,0.06)' } }}>
                {restoring ? 'Restoring…' : 'Restore from backup'}
              </Button>
            </Stack>
          </Box>

          {/* Restore result */}
          {restoreResult && (
            <Alert severity={restoreResult.ok ? 'success' : 'error'}
              icon={restoreResult.ok ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
              sx={{
                bgcolor: restoreResult.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                color: restoreResult.ok ? B.green : '#f87171',
                border: `1px solid ${restoreResult.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                mb: 2,
              }}>
              {restoreResult.ok
                ? `Restored ${restoreResult.totalDocs} records and ${restoreResult.fileCount} files.`
                : `Restore failed: ${restoreResult.error}`}
            </Alert>
          )}

          {/* What's included */}
          <Box sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 2, md: 3 } }}>
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 1.5 }}>
              What goes in a backup
            </Typography>
            <Stack gap={0.6}>
              {[
                ['Order Tracker', 'Every project — quotes, items, mockup links, confirmations, activity, approval events'],
                ['Mockup Studio',  'Saved mockups, blanks, logos — full pageState + thumbnails'],
                ['Client logos',   'Per-company brand logos'],
                ['Inquiries',      'Contact form submissions with status + admin notes'],
                ['Site settings',  'Brand logo, banner messages, theme'],
                ['Catalogs + products', 'Product catalog + custom catalog overrides'],
                ['Admin users',    'Login records (passwords already hashed)'],
                ['Files',          'Every uploaded project file in /uploads'],
              ].map(([label, desc]) => (
                <Stack key={label} direction="row" gap={1.5} sx={{ fontSize: 12 }}>
                  <Box sx={{ color: B.green, fontWeight: 700, minWidth: 160 }}>{label}</Box>
                  <Box sx={{ color: B.muted }}>{desc}</Box>
                </Stack>
              ))}
            </Stack>
            {stat && stat.collections && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${B.faint}` }}>
                <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.6 }}>
                  Last export totals
                </Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {Object.entries(stat.collections).map(([k, v]) => (
                    <Chip key={k} label={`${k} · ${v}`} size="small" sx={{
                      bgcolor: 'rgba(255,255,255,0.04)', color: B.muted, fontSize: 10,
                      border: `1px solid ${B.faint}`,
                    }} />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>

          {/* Practice tips */}
          <Typography sx={{ color: B.muted, fontSize: 11, mt: 2.5, lineHeight: 1.6 }}>
            <strong>Tip:</strong> Save your weekly backups to at least two places — an external hard
            drive and a cloud folder (Drive, Dropbox, S3). The ZIP is everything you need to rebuild
            from scratch. Restore wipes the current database and replaces it with the archive contents,
            so use it carefully.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
