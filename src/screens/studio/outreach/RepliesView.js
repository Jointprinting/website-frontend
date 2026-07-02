// src/screens/studio/outreach/RepliesView.js
// Gmail Reply Triage — the detection-only inbox for buyer replies to cold outreach.
// Presentational (OutreachTab owns data + transport): a clean table of detected /
// imported replies, each auto-classified + matched to its CRM company, with a
// per-row action menu to triage it. No auto-send, no AI, no auto-CRM-migration —
// the owner decides what moves deeper. V1 ingests replies manually / by paste;
// Gmail auto-sync is a later, opt-in step (the Sync button says so until then).

import * as React from 'react';
import {
  Box, Stack, Button, IconButton, Menu, MenuItem, Divider, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress, Typography,
} from '@mui/material';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import { D, mono, dropInput, dropPrimaryBtn, dropGhostBtn, fmtDate, useMobileFullScreen } from '../_shared';
import {
  StatusChip, StatPill,
  TRIAGE_CATEGORIES, triageCategoryMeta,
  TRIAGE_STATUSES, triageStatusMeta,
  TRIAGE_ACTIONS,
} from './_outreach';

const cellSx = { color: D.text, borderColor: D.line, fontSize: 12.5, py: 1, verticalAlign: 'top' };
const headSx = { color: D.faint, borderColor: D.line, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', py: 1, whiteSpace: 'nowrap' };

export default function RepliesView({
  replies = [], loading, showIgnored, onToggleIgnored,
  onSetStatus, onAddReply, onSync, onOpenCompany, onError,
}) {
  const fullScreen = useMobileFullScreen();
  const [cat, setCat] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [menu, setMenu] = React.useState(null);     // { anchor, row }
  const [adding, setAdding] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  // Client-side filter over what the container loaded (list is small + single-user).
  const rows = React.useMemo(() => replies.filter((r) =>
    (!cat || r.category === cat) && (!status || r.status === status)), [replies, cat, status]);

  const counts = React.useMemo(() => ({
    total: replies.length,
    unhandled: replies.filter((r) => r.status === 'new').length,
    hot: replies.filter((r) => r.category === 'hot_lead' || r.category === 'asked_pricing' || r.category === 'asked_mockups').length,
    matched: replies.filter((r) => r.matched).length,
  }), [replies]);

  const closeMenu = () => setMenu(null);
  const pickStatus = async (row, next) => {
    closeMenu();
    try { await onSetStatus(row._id, next); } catch (e) { onError?.(e.response?.data?.message || 'Could not update the reply'); }
  };

  const runSync = async () => {
    setSyncing(true);
    try { await onSync?.(); } finally { setSyncing(false); }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Summary strip */}
      <Stack direction="row" spacing={1.25}>
        <StatPill value={counts.unhandled} label="New" tone={counts.unhandled > 0 ? D.amber : D.muted} />
        <StatPill value={counts.hot} label="Buying signals" tone={counts.hot > 0 ? D.green : D.muted} />
        <StatPill value={counts.matched} label="Matched" tone={D.text} />
        <StatPill value={counts.total} label="Replies" tone={D.text} />
      </Stack>

      {/* Toolbar: filters + actions */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField
          select value={cat} onChange={(e) => setCat(e.target.value)} size="small"
          sx={{ ...dropInput, minWidth: 150 }} SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">All categories</MenuItem>
          {TRIAGE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{triageCategoryMeta(c).label}</MenuItem>)}
        </TextField>
        <TextField
          select value={status} onChange={(e) => setStatus(e.target.value)} size="small"
          sx={{ ...dropInput, minWidth: 140 }} SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {TRIAGE_STATUSES.map((s) => <MenuItem key={s} value={s}>{triageStatusMeta(s).label}</MenuItem>)}
        </TextField>
        <Button
          onClick={onToggleIgnored} size="small"
          sx={{ ...dropGhostBtn, color: showIgnored ? D.green : D.muted }}
        >
          {showIgnored ? 'Hide bounces/auto' : 'Show bounces/auto'}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Gmail auto-sync isn't wired yet — add replies manually for now">
          <span>
            <Button
              onClick={runSync} size="small" disabled={syncing}
              startIcon={<SyncOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...dropGhostBtn }}
            >
              {syncing ? 'Syncing…' : 'Sync Gmail'}
            </Button>
          </span>
        </Tooltip>
        <Button
          onClick={() => setAdding(true)} size="small"
          startIcon={<AddOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...dropPrimaryBtn }}
        >
          Add reply
        </Button>
      </Stack>

      {/* Table */}
      {rows.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 7, border: `1px dashed ${D.line}`, borderRadius: 3, bgcolor: D.panel }}>
          <MarkEmailUnreadOutlinedIcon sx={{ fontSize: 34, color: D.faint }} />
          <Typography sx={{ color: D.muted, fontWeight: 700, mt: 1 }}>No replies here yet</Typography>
          <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 0.5, maxWidth: 420, mx: 'auto' }}>
            When a buyer replies to your cold outreach, add it here (paste the sender, subject
            and a snippet) and it’ll be classified and matched to its CRM company automatically.
          </Typography>
          <Button onClick={() => setAdding(true)} sx={{ ...dropPrimaryBtn, mt: 2 }} startIcon={<AddOutlinedIcon sx={{ fontSize: 16 }} />}>
            Add a reply
          </Button>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto', border: `1px solid ${D.line}`, borderRadius: 3, bgcolor: D.panel }}>
          <Table size="small" sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Contact / Company</TableCell>
                <TableCell sx={headSx}>Subject &amp; snippet</TableCell>
                <TableCell sx={headSx}>Category</TableCell>
                <TableCell sx={headSx}>Suggested next step</TableCell>
                <TableCell sx={headSx}>Status</TableCell>
                <TableCell sx={headSx}>Date</TableCell>
                <TableCell sx={{ ...headSx, textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const canOpen = r.matched && r.companyKey;
                return (
                  <TableRow key={r._id} hover sx={{ '&:hover': { bgcolor: D.panelHi } }}>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: D.text }}>
                        {r.fromName || '—'}
                      </Typography>
                      <Typography
                        onClick={canOpen ? () => onOpenCompany(r.companyKey) : undefined}
                        sx={{
                          fontSize: 11.5, color: canOpen ? D.green : D.muted, mt: 0.2,
                          cursor: canOpen ? 'pointer' : 'default',
                          '&:hover': canOpen ? { textDecoration: 'underline' } : {},
                        }}
                      >
                        {r.companyName || (r.matched ? '(matched)' : 'Unmatched')}
                        {canOpen && <OpenInNewOutlinedIcon sx={{ fontSize: 12, ml: 0.4, verticalAlign: '-2px' }} />}
                      </Typography>
                      <Typography sx={{ ...mono, fontSize: 11, color: D.faint, mt: 0.2 }}>{r.fromEmail || '—'}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...cellSx, maxWidth: 320 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: D.text }}>{r.subject || '(no subject)'}</Typography>
                      {r.snippet && (
                        <Typography sx={{ fontSize: 11.5, color: D.muted, mt: 0.3,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.snippet}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}><StatusChip meta={triageCategoryMeta(r.category)} /></TableCell>
                    <TableCell sx={{ ...cellSx, color: D.muted, fontSize: 12, maxWidth: 180 }}>{r.suggestedAction || '—'}</TableCell>
                    <TableCell sx={cellSx}><StatusChip meta={triageStatusMeta(r.status)} /></TableCell>
                    <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap', color: D.faint }}>{fmtDate(r.receivedAt)}</TableCell>
                    <TableCell sx={{ ...cellSx, textAlign: 'right' }}>
                      <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, row: r })}
                        sx={{ color: D.muted, '&:hover': { color: D.green } }}>
                        <MoreVertOutlinedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Row action menu */}
      <Menu
        anchorEl={menu?.anchor} open={!!menu} onClose={closeMenu}
        PaperProps={{ sx: { bgcolor: D.panelHi, border: `1px solid ${D.line}`, color: D.text, minWidth: 190 } }}
      >
        {menu?.row?.matched && menu?.row?.companyKey && [
          <MenuItem key="crm" onClick={() => { const k = menu.row.companyKey; closeMenu(); onOpenCompany(k); }}
            sx={{ fontSize: 13, fontWeight: 700, color: D.green }}>
            <OpenInNewOutlinedIcon sx={{ fontSize: 16, mr: 1 }} /> Open in CRM
          </MenuItem>,
          <Divider key="div" sx={{ borderColor: D.line }} />,
        ]}
        {TRIAGE_ACTIONS.map((a) => (
          <MenuItem
            key={a.status} onClick={() => pickStatus(menu.row, a.status)}
            disabled={menu?.row?.status === a.status}
            sx={{ fontSize: 13, color: a.status === 'do_not_contact' ? '#f87171' : D.text }}
          >
            {a.label}
          </MenuItem>
        ))}
      </Menu>

      <AddReplyDialog
        open={adding} fullScreen={fullScreen}
        onClose={() => setAdding(false)}
        onSubmit={async (payload) => { await onAddReply(payload); setAdding(false); }}
        onError={onError}
      />
    </Stack>
  );
}

// Minimal manual-entry form — paste what a buyer sent so it gets classified +
// matched. Only the sender email OR a subject is required to file something useful.
function AddReplyDialog({ open, fullScreen, onClose, onSubmit, onError }) {
  const [f, setF] = React.useState({ fromName: '', fromEmail: '', subject: '', snippet: '', receivedAt: '' });
  const [saving, setSaving] = React.useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  React.useEffect(() => { if (open) setF({ fromName: '', fromEmail: '', subject: '', snippet: '', receivedAt: '' }); }, [open]);

  const submit = async () => {
    if (!f.fromEmail.trim() && !f.subject.trim()) { onError?.('Add at least the sender email or a subject.'); return; }
    setSaving(true);
    try {
      await onSubmit({ ...f, source: 'manual', receivedAt: f.receivedAt || undefined });
    } catch (e) {
      onError?.(e.response?.data?.message || 'Could not add the reply');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: D.bg, border: `1px solid ${D.line}`, borderRadius: fullScreen ? 0 : 3 } }}>
      <DialogTitle sx={{ ...mono, color: D.green, fontWeight: 800, fontSize: 15 }}>Add a reply</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField label="Sender name" value={f.fromName} onChange={set('fromName')} size="small" fullWidth sx={dropInput} />
            <TextField label="Sender email" value={f.fromEmail} onChange={set('fromEmail')} size="small" fullWidth sx={dropInput} />
          </Stack>
          <TextField label="Subject" value={f.subject} onChange={set('subject')} size="small" fullWidth sx={dropInput} />
          <TextField label="Reply snippet" value={f.snippet} onChange={set('snippet')} size="small" fullWidth multiline minRows={3} sx={dropInput} />
          <TextField
            label="Received" type="date" value={f.receivedAt} onChange={set('receivedAt')}
            size="small" fullWidth sx={dropInput} InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ ...dropGhostBtn }}>Cancel</Button>
        <Button onClick={submit} disabled={saving} sx={{ ...dropPrimaryBtn }}>{saving ? 'Adding…' : 'Add reply'}</Button>
      </DialogActions>
    </Dialog>
  );
}
