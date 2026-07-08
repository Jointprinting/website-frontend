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
import CloudSyncIcon       from '@mui/icons-material/CloudSync';
import { B, fmtDate, fmtRelative } from './_shared';
import { useContextMenu } from './ContextMenu';
import { buildFallbackMenu } from './contextMenuActions';
import config from '../../config.json';
import JpLoader from '../../common/JpLoader';

const base = `${config.backendUrl}/api`;

export default function BackupTab({ token, onBack }) {
  const authHdr = { headers: { Authorization: `Bearer ${token}` } };
  const [stat, setStat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const fileRef = useRef(null);

  // Google Drive off-site auto-backup
  const [drive, setDrive] = useState(null);
  const [driveBusy, setDriveBusy] = useState(false);          // connect / disconnect
  const [driveBackingUp, setDriveBackingUp] = useState(false);

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

  // Right-click on empty chrome offers "Back to hub" — parity with the other
  // Studio screens (Finances / Vendors / CRM / Orders) so no surface is a
  // dead-end on right-click.
  const { registerFallback } = useContextMenu();
  useEffect(() => registerFallback(() => buildFallbackMenu({
    onBackToHub: onBack,
  })), [registerFallback, onBack]);

  const loadDrive = useCallback(async () => {
    try {
      const res = await fetch(`${base}/gdrive/status`, authHdr);
      const data = await res.json();
      setDrive(res.ok ? data : { error: data.message || `HTTP ${res.status}` });
    } catch (e) { setDrive({ error: e.message }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadDrive(); }, [loadDrive]);

  const handleDriveConnect = async () => {
    setDriveBusy(true);
    try {
      const res = await fetch(`${base}/gdrive/connect`, authHdr);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Connect failed');
      const w = window.open(data.url, 'gdrive-connect', 'width=520,height=700');
      // Reload status once the consent popup closes.
      const timer = setInterval(() => {
        if (!w || w.closed) { clearInterval(timer); loadDrive(); }
      }, 1000);
    } catch (e) {
      alert(`Couldn't start Google Drive connect: ${e.message}`);
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDriveBackupNow = async () => {
    setDriveBackingUp(true);
    try {
      const res = await fetch(`${base}/gdrive/backup-now`, { method: 'POST', headers: authHdr.headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Backup failed');
      await loadDrive();
      alert(`Backed up to Google Drive ✓\n${data.fileName} (${(data.sizeBytes / 1024 / 1024).toFixed(1)} MB)`);
    } catch (e) {
      alert(`Drive backup failed: ${e.message}`);
      await loadDrive();
    } finally {
      setDriveBackingUp(false);
    }
  };

  const handleDriveDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? The site will stop auto-saving backups there.')) return;
    setDriveBusy(true);
    try {
      await fetch(`${base}/gdrive/disconnect`, { method: 'POST', headers: authHdr.headers });
      await loadDrive();
    } finally { setDriveBusy(false); }
  };

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

    // Default restore is the SAFE one: merge/upsert by record id. It adds and
    // updates from the backup but never deletes anything already on the server,
    // so re-importing a backup can't lose newer data and a stray click can't
    // wipe the database. (The backend validates the whole archive before it
    // writes a single record — a wrong file is rejected with the data intact.)
    if (!window.confirm(
      `Restore from "${file.name}"?\n\n` +
      'This MERGES the backup into the current data: every record in the ZIP ' +
      'is added or updated (matched by its id). Nothing currently on the ' +
      'server is deleted, so this is safe to run.\n\n' +
      'OK to restore (merge)?'
    )) return;

    // Optional, deliberately separate, destructive path. Only reached if the
    // owner asks for it AND types the confirmation — so it can never happen by
    // accident. This is the "wipe and replace with exactly this backup" mode.
    let mode = 'merge';
    const wantsReplace = window.confirm(
      'Advanced: do a FULL REPLACE instead?\n\n' +
      'Click Cancel to keep the safe merge above (recommended).\n\n' +
      'Click OK only if you want to WIPE all current data and replace it with ' +
      'exactly what is in this backup — every project, client, vendor, PO, ' +
      'finance record, and file not in the ZIP is permanently deleted. No undo.'
    );
    if (wantsReplace) {
      const typed = window.prompt('Type REPLACE to confirm a full destructive replace, or Cancel to keep merge:');
      if (typed === 'REPLACE') mode = 'replace';
      else if (typed !== null) { alert('Confirmation did not match — keeping the safe merge.'); }
    }

    setRestoring(true);
    setRestoreResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('mode', mode);
      if (mode === 'replace') form.append('confirm', 'REPLACE');
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
    <Box data-ctx-chrome sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white, p: { xs: 2, md: 4 } }}>
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
          <JpLoader size={56} label="Loading backups…" />
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
                ? `Restored ${restoreResult.totalDocs} records and ${restoreResult.fileCount} files` +
                  `${restoreResult.mode === 'replace' ? ' (full replace)' : ' (safe merge)'}.`
                : `Restore failed: ${restoreResult.error}`}
            </Alert>
          )}

          {/* Google Drive off-site auto-backup */}
          <Box sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 2, md: 3 }, mb: 2 }}>
            <Stack direction="row" alignItems="flex-start" gap={1.5} mb={1}>
              <CloudSyncIcon sx={{ color: B.green, fontSize: 24, mt: 0.3 }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 16 }}>
                  Off-site auto-backup · Google Drive
                </Typography>
                <Typography sx={{ color: B.muted, fontSize: 12, mt: 0.3 }}>
                  A full backup — ledger, projects, files, and receipt images — pushed to your Drive
                  every week and on demand. Your second basket if the site or Cloudflare goes down.
                </Typography>
              </Box>
            </Stack>

            {!drive ? (
              <Typography sx={{ color: B.muted, fontSize: 12 }}>Checking…</Typography>
            ) : drive.error ? (
              <Alert severity="warning" sx={{ mt: 1 }}>Couldn’t reach the Drive service — {drive.error}</Alert>
            ) : !drive.configured ? (
              <Typography sx={{ color: B.muted, fontSize: 12, mt: 1 }}>
                Not enabled yet. Set <Box component="code" sx={{ color: B.white }}>GDRIVE_CLIENT_ID</Box> and{' '}
                <Box component="code" sx={{ color: B.white }}>GDRIVE_CLIENT_SECRET</Box> on the Render backend, then reload this page.
              </Typography>
            ) : !drive.connected ? (
              <Box sx={{ mt: 1 }}>
                <Typography sx={{ color: B.muted, fontSize: 12, mb: 1.5 }}>
                  Connect once — a Google window opens, pick your account and allow access. After that it’s hands-off.
                </Typography>
                <Button onClick={handleDriveConnect} disabled={driveBusy}
                  startIcon={driveBusy ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : <CloudSyncIcon />}
                  sx={{ bgcolor: B.green, color: B.greenDk, textTransform: 'none', fontWeight: 700, py: 1, px: 2,
                    '&:hover': { bgcolor: '#3bd070' } }}>
                  Connect Google Drive
                </Button>
              </Box>
            ) : (
              <Box sx={{ mt: 1 }}>
                {/* Loud alarm if off-site auto-backups appear to have stopped —
                    the one thing to catch before heading out on the road. */}
                {drive.stale && (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    Off-site auto-backups look stopped —{' '}
                    {drive.lastBackupAt
                      ? `last successful push was ${fmtRelative(drive.lastBackupAt)} (over ${drive.staleAfterDays ?? 9}d ago).`
                      : 'none has run yet.'}{' '}
                    Run one now to confirm Drive is working before you leave.
                  </Alert>
                )}
                <Stack direction="row" gap={1} alignItems="center" mb={1} flexWrap="wrap">
                  <Chip size="small" label={`Connected${drive.email ? ' · ' + drive.email : ''}`}
                    sx={{ bgcolor: 'rgba(74,222,128,0.12)', color: B.green,
                      border: '1px solid rgba(74,222,128,0.3)', fontWeight: 700 }} />
                  {drive.lastBackupAt
                    ? <Typography sx={{ color: B.muted, fontSize: 12 }}>
                        Last push: {fmtDate(drive.lastBackupAt)} ({fmtRelative(drive.lastBackupAt)})
                        {drive.lastBackupBytes ? ` · ${(drive.lastBackupBytes / 1024 / 1024).toFixed(1)} MB` : ''}
                      </Typography>
                    : <Typography sx={{ color: B.muted, fontSize: 12 }}>No push yet — run one now to confirm it works.</Typography>}
                </Stack>
                {drive.lastError && (
                  <Alert severity="error" sx={{ mb: 1 }}>Last backup error: {drive.lastError}</Alert>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  <Button onClick={handleDriveBackupNow} disabled={driveBackingUp}
                    startIcon={driveBackingUp ? <CircularProgress size={14} sx={{ color: B.greenDk }} /> : <CloudSyncIcon />}
                    sx={{ bgcolor: B.green, color: B.greenDk, textTransform: 'none', fontWeight: 700, py: 1,
                      '&:hover': { bgcolor: '#3bd070' } }}>
                    {driveBackingUp ? 'Backing up to Drive…' : 'Back up to Drive now'}
                  </Button>
                  <Button onClick={handleDriveDisconnect} disabled={driveBusy} variant="outlined"
                    sx={{ color: B.muted, borderColor: B.border, textTransform: 'none', fontWeight: 700, py: 1,
                      '&:hover': { borderColor: '#f87171', color: '#f87171' } }}>
                    Disconnect
                  </Button>
                </Stack>
                <Typography sx={{ color: B.muted, fontSize: 11, mt: 1.2 }}>
                  {`Auto-runs ${(drive.schedule || 'weekly').toLowerCase()}.`} Saved to a “Joint Printing Backups” folder in your Drive.
                </Typography>
              </Box>
            )}
          </Box>

          {/* What's included */}
          <Box sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: { xs: 2, md: 3 } }}>
            <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 1.5 }}>
              What goes in a backup
            </Typography>
            <Stack gap={0.6}>
              {[
                ['Order Tracker', 'Every project — quotes, items, mockup links, confirmations, activity, approval events'],
                ['Clients + CRM',  'Customer records, contacts, cold-call state'],
                ['Vendors + POs',  'Printer/supplier cards and every purchase order'],
                ['Mockup Studio',  'Saved mockups, blanks, logos — full pageState + thumbnails'],
                ['Client logos',   'Per-company brand logos'],
                ['Inquiries',      'Contact form submissions with status + admin notes'],
                ['Site settings',  'Brand logo, banner messages, theme'],
                ['Catalogs + products', 'Product catalog + custom catalog overrides'],
                ['Finances',       'The full income/expense ledger — every transaction'],
                ['Receipt images', 'Receipt/invoice files attached to finances (pulled from R2)'],
                ['Numbering',      'Order / PO counters, so restored numbers never collide'],
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
            drive and a cloud folder (Drive, Dropbox, S3). The ZIP is <em>every</em> collection in the
            database, so it's everything you need to rebuild from scratch. Restore <strong>merges</strong> a
            backup in by default (adds &amp; updates, never deletes) — safe to run anytime; a full
            destructive replace is available behind an explicit typed confirmation.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
