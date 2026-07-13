// src/screens/studio/NewsletterTab.js
// Newsletter — the Studio's client email blast (backend: controllers/
// newsletter.js at /api/newsletter). Compose a monthly update or a catalog
// drop, attach files (stored in R2, sent as clean download buttons — never
// heavy attachments), pick the audience, send a test, then send to every
// emailable client. Sends from a DEDICATED domain (NEWSLETTER_EMAIL_FROM) so a
// warm blast can't dent the main inbox's deliverability. Tracks sent / opened /
// replied per newsletter. Archive is the only remove (60-day auto-purge).

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, Button, TextField, MenuItem, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import config from '../../config.json';
import {
  D, accentBar, eyebrow, mono, dropInput, dropPrimaryBtn, dropGhostBtn,
  fmtRelative, useMobileFullScreen, scrollbar, ARCHIVE_TTL_DAYS, purgeDaysLeft,
} from './_shared';
import JpLoader from '../../common/JpLoader';

const API = `${config.backendUrl}/api/newsletter`;

// Customers first — the owner's rule: newsletters go to people who already
// buy (mirrors the backend default in models/Newsletter.js).
const AUDIENCES = [
  { key: 'customers', label: 'Customers only' },
  { key: 'tag', label: 'By CRM tag…' },
  { key: 'all', label: 'All clients' },
  { key: 'leads', label: 'Leads / prospects' },
];

const inkInput = { ...dropInput, '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.9 } };

// Read any file (PDF, image, doc) as a data URL for the R2 upload. Capped so a
// giant file can't choke the post — the catalog PDF should be reasonable.
function readFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 18 * 1024 * 1024) { reject(new Error('File too large — keep it under ~18 MB (link a Drive file for bigger).')); return; }
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Could not read that file'));
    fr.readAsDataURL(file);
  });
}

const StatPill = ({ label, value, tone }) => (
  <Box sx={{ textAlign: 'center', minWidth: 74 }}>
    <Typography sx={{ color: tone || D.text, fontSize: 20, fontWeight: 900, ...mono, lineHeight: 1.1 }}>{value}</Typography>
    <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mt: 0.2 }}>{label}</Typography>
  </Box>
);

export default function NewsletterTab({ token, onBack }) {
  const fullScreen = useMobileFullScreen();
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [rows, setRows] = React.useState(null);
  const [meta, setMeta] = React.useState({ canSend: false, fromAddress: '' });
  const [openId, setOpenId] = React.useState(null);      // editing/viewing one
  const [draft, setDraft] = React.useState(null);        // working copy
  const [stats, setStats] = React.useState(null);
  const [audiencePreview, setAudiencePreview] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [snack, setSnack] = React.useState(null);
  const [testOpen, setTestOpen] = React.useState(false);
  const [testTo, setTestTo] = React.useState('');
  const heroRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const toast = (msg, sev = 'success') => setSnack({ msg, sev });

  const load = React.useCallback(async () => {
    try {
      const { data } = await axios.get(API, authHdr);
      setRows(data.newsletters || []);
      setMeta({ canSend: !!data.canSend, fromAddress: data.fromAddress || '' });
    } catch (e) { setRows([]); toast('Could not load newsletters', 'error'); }
  }, [authHdr]);
  React.useEffect(() => { load(); }, [load]);

  const openOne = async (id) => {
    setOpenId(id); setDraft(null); setStats(null); setAudiencePreview(null);
    try {
      const { data } = await axios.get(`${API}/${id}`, authHdr);
      setDraft({ ...data.newsletter, files: data.newsletter.files || [] });
      setStats(data.stats || null);
      setMeta({ canSend: !!data.canSend, fromAddress: data.fromAddress || '' });
    } catch (e) { toast('Could not open', 'error'); setOpenId(null); }
  };

  const create = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(API, { subject: 'New newsletter' }, authHdr);
      await load();
      openOne(data.newsletter._id);
    } catch (e) { toast('Could not create', 'error'); } finally { setBusy(false); }
  };

  // Debounced autosave of the draft (only while editable).
  const saveTimer = React.useRef(null);
  const patch = (fields) => {
    setDraft((d) => ({ ...d, ...fields }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const id = openId;
    saveTimer.current = setTimeout(() => {
      axios.patch(`${API}/${id}`, fields, authHdr).catch(() => {});
    }, 700);
  };

  const isSent = draft && (draft.status === 'sent' || draft.status === 'sending');

  const uploadHero = async (file) => {
    try {
      const dataUrl = await readFileDataUrl(file);
      const { data } = await axios.post(`${API}/upload`, { dataUrl, filename: file.name }, authHdr);
      patch({ heroImage: data.file.url });
      toast('Banner added');
    } catch (e) { toast(e.response?.data?.message || e.message, 'error'); }
  };
  const uploadFile = async (file) => {
    try {
      const dataUrl = await readFileDataUrl(file);
      const { data } = await axios.post(`${API}/upload`, { dataUrl, filename: file.name }, authHdr);
      patch({ files: [...(draft.files || []), data.file] });
      toast('File attached');
    } catch (e) { toast(e.response?.data?.message || e.message, 'error'); }
  };

  const previewAudience = async () => {
    try {
      const { data } = await axios.get(`${API}/${openId}/audience`, authHdr);
      setAudiencePreview(data);
    } catch (e) { toast('Could not preview audience', 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (openId && draft && !isSent) previewAudience(); }, [openId, draft?.audience, draft?.audienceTag]);

  const sendTest = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/${openId}/test`, { to: testTo }, authHdr);
      toast('Test sent — check your inbox 📬'); setTestOpen(false);
    } catch (e) { toast(e.response?.data?.message || 'Test failed', 'error'); } finally { setBusy(false); }
  };

  const sendReal = async () => {
    if (!window.confirm(`Send "${draft.subject}" to ${audiencePreview ? audiencePreview.count : 'all'} client${audiencePreview && audiencePreview.count === 1 ? '' : 's'}? This can't be undone.`)) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/${openId}/send`, {}, authHdr);
      toast(`Sending to ${data.sending} client${data.sending === 1 ? '' : 's'} 🚀`);
      await openOne(openId); await load();
    } catch (e) { toast(e.response?.data?.message || 'Send failed', 'error'); } finally { setBusy(false); }
  };

  const archive = async (id, on) => {
    try { await axios.patch(`${API}/${id}`, { archived: on }, authHdr); await load(); if (openId === id) openOne(id); }
    catch (e) { toast('Could not archive', 'error'); }
  };

  // ── List view ───────────────────────────────────────────────────────────────
  if (!openId) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: D.bg, color: D.text, p: { xs: 1.5, md: 3 }, ...scrollbar }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
          <IconButton size="small" onClick={onBack} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
            <ArrowBackIosNewIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <Box sx={accentBar} />
          <MarkEmailReadOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>Newsletter</Typography>
            <Typography sx={{ color: D.muted, fontSize: 11.5 }}>Send updates &amp; catalogs to your clients — track opens &amp; replies</Typography>
          </Box>
          <Button onClick={create} disabled={busy} startIcon={<AddIcon />} sx={{ ...dropPrimaryBtn, py: 0.6, px: 2 }}>New</Button>
        </Stack>

        {!meta.canSend && (
          <Box sx={{ border: `1px solid rgba(240,180,41,0.4)`, bgcolor: 'rgba(240,180,41,0.06)', borderRadius: 2.5, p: 1.75, mb: 2 }}>
            <Typography sx={{ color: '#f0b429', fontSize: 12.5, fontWeight: 700 }}>Sending isn't set up yet</Typography>
            <Typography sx={{ color: D.muted, fontSize: 12, mt: 0.3, lineHeight: 1.5 }}>
              Add <b>NEWSLETTER_EMAIL_FROM</b> (a separate sending domain like hello@jointprintingshop.com) + its SMTP on
              the API. You can compose and preview now — you just can't send until that's set. This keeps big blasts off
              your main invoice inbox so your deliverability stays clean.
            </Typography>
          </Box>
        )}

        {rows === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><JpLoader size={64} /></Box>
        ) : rows.length === 0 ? (
          <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 3, py: 7, textAlign: 'center', color: D.muted, bgcolor: D.inset }}>
            <Typography sx={{ fontSize: 20, mb: 0.5 }}>📬</Typography>
            <Typography sx={{ fontSize: 13 }}>No newsletters yet — hit New to write your first.</Typography>
          </Box>
        ) : (
          <Stack gap={1.25}>
            {rows.map((r) => (
              <Box key={r._id} onClick={() => openOne(r._id)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5,
                p: 1.75, borderRadius: 2.5, bgcolor: D.panel, border: `1px solid ${D.line}`, cursor: 'pointer',
                opacity: r.archived ? 0.6 : 1, transition: 'border-color 0.16s, background-color 0.16s',
                '&:hover': { borderColor: D.green, bgcolor: D.panelHi } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography sx={{ color: D.text, fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.subject || 'Untitled'}
                    </Typography>
                    <Box sx={{ px: 0.9, py: 0.15, borderRadius: 999, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                      color: r.status === 'sent' ? D.green : r.status === 'sending' ? D.amber : D.muted,
                      bgcolor: r.status === 'sent' ? 'rgba(74,222,128,0.12)' : r.status === 'sending' ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)' }}>
                      {r.status}
                    </Box>
                  </Stack>
                  <Typography sx={{ color: D.muted, fontSize: 11.5, mt: 0.3 }}>
                    {r.status === 'sent'
                      ? `${r.sentCount} sent · ${r.openedCount} opened · ${r.sentCount ? Math.round(r.openedCount / r.sentCount * 100) : 0}% open · ${fmtRelative(r.sentAt)}`
                      : `${AUDIENCES.find((a) => a.key === r.audience)?.label || r.audience} · edited ${fmtRelative(r.updatedAt)}`}
                  </Typography>
                  {r.archived && (
                    <Typography sx={{ color: '#f87171', fontSize: 10.5, fontWeight: 700, mt: 0.2 }}>
                      auto-deletes in {purgeDaysLeft(r.archivedAt, r.updatedAt)} days
                    </Typography>
                  )}
                </Box>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); archive(r._id, !r.archived); }}
                  title={r.archived ? 'Restore' : `Archive (auto-deletes after ${ARCHIVE_TTL_DAYS} days)`}
                  sx={{ color: D.muted, '&:hover': { color: r.archived ? D.green : '#f87171' } }}>
                  {r.archived ? <UnarchiveOutlinedIcon sx={{ fontSize: 17 }} /> : <ArchiveOutlinedIcon sx={{ fontSize: 17 }} />}
                </IconButton>
                <ChevronRightIcon sx={{ color: D.faint, fontSize: 20 }} />
              </Box>
            ))}
          </Stack>
        )}
        <Snackbar open={!!snack} autoHideDuration={3400} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          {snack ? <Alert severity={snack.sev} variant="filled" onClose={() => setSnack(null)}>{snack.msg}</Alert> : null}
        </Snackbar>
      </Box>
    );
  }

  // ── Editor / viewer ───────────────────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg, color: D.text, p: { xs: 1.5, md: 3 }, ...scrollbar }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={() => { setOpenId(null); load(); }} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <Box sx={accentBar} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15, flex: 1 }}>
          {isSent ? 'Newsletter · sent' : 'Compose newsletter'}
        </Typography>
      </Stack>

      {!draft ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><JpLoader size={56} /></Box>
      ) : (
        <Box sx={{ maxWidth: 720, mx: 'auto' }}>
          {/* Sent stats banner */}
          {isSent && stats && (
            <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 3, bgcolor: D.panel, p: 2, mb: 2 }}>
              <Stack direction="row" gap={2} flexWrap="wrap" justifyContent="space-around">
                <StatPill label="Sent" value={stats.sent} />
                <StatPill label="Opened" value={stats.opened} tone={D.green} />
                <StatPill label="Open rate" value={`${stats.openRate}%`} tone={D.green} />
                <StatPill label="Replied" value={stats.replied} tone="#60a5fa" />
                {stats.failed > 0 && <StatPill label="Failed" value={stats.failed} tone="#f87171" />}
              </Stack>
              {draft.sentAt && <Typography sx={{ color: D.faint, fontSize: 11, textAlign: 'center', mt: 1 }}>Sent {fmtRelative(draft.sentAt)}</Typography>}
            </Box>
          )}

          <Stack gap={1.5} sx={{ opacity: isSent ? 0.85 : 1 }}>
            <TextField label="Subject line" value={draft.subject || ''} disabled={isSent}
              onChange={(e) => patch({ subject: e.target.value })} size="small" fullWidth sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />
            <TextField label="Preview text (the gray line after the subject)" value={draft.preheader || ''} disabled={isSent}
              onChange={(e) => patch({ preheader: e.target.value })} size="small" fullWidth sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />

            {/* Banner image */}
            <Box>
              <input ref={heroRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadHero(f); }} />
              {draft.heroImage ? (
                <Box sx={{ position: 'relative' }}>
                  <Box component="img" src={draft.heroImage} alt="" sx={{ width: '100%', borderRadius: 2, border: `1px solid ${D.line}`, display: 'block' }} />
                  {!isSent && (
                    <IconButton size="small" onClick={() => patch({ heroImage: '' })} sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
                      <CloseIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                </Box>
              ) : !isSent && (
                <Button onClick={() => heroRef.current?.click()} startIcon={<ImageOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...dropGhostBtn, fontSize: 12, py: 0.6 }}>
                  Add a banner image
                </Button>
              )}
            </Box>

            <TextField label="Message" value={draft.body || ''} disabled={isSent}
              onChange={(e) => patch({ body: e.target.value })} multiline minRows={7} fullWidth sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }}
              placeholder={"Hey {they'll see this as written}!\n\nHere's what's new this month…\n\n(Leave a blank line between paragraphs.)"} />

            {/* File attachments → download buttons in the email */}
            <Box>
              <Typography sx={{ ...eyebrow, mb: 0.75, display: 'block' }}>Files (sent as download buttons — great for a catalog PDF)</Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                {(draft.files || []).map((f, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.6, borderRadius: 999, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
                    <Typography sx={{ fontSize: 12, color: D.text, fontWeight: 700 }}>{f.kind === 'pdf' ? '📄' : f.kind === 'image' ? '🖼️' : '📎'} {f.filename}</Typography>
                    {!isSent && (
                      <IconButton size="small" onClick={() => patch({ files: draft.files.filter((_, j) => j !== i) })} sx={{ color: D.faint, p: 0.2, '&:hover': { color: '#f87171' } }}>
                        <CloseIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
                {!isSent && (
                  <>
                    <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadFile(f); }} />
                    <Button onClick={() => fileRef.current?.click()} startIcon={<AttachFileIcon sx={{ fontSize: 15 }} />} sx={{ ...dropGhostBtn, fontSize: 11.5, py: 0.5 }}>Attach file</Button>
                  </>
                )}
              </Stack>
            </Box>

            {/* Audience */}
            {!isSent && (
              <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2.5, p: 1.5, bgcolor: D.panel }}>
                <Typography sx={{ ...eyebrow, mb: 1, display: 'block' }}>Who gets it</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
                  <TextField select value={draft.audience || 'customers'} onChange={(e) => patch({ audience: e.target.value })} size="small" sx={{ ...inkInput, minWidth: 180 }}>
                    {AUDIENCES.map((a) => <MenuItem key={a.key} value={a.key}>{a.label}</MenuItem>)}
                  </TextField>
                  {draft.audience === 'tag' && (
                    <TextField placeholder="tag (e.g. vip)" value={draft.audienceTag || ''} onChange={(e) => patch({ audienceTag: e.target.value })} size="small" sx={{ ...inkInput, minWidth: 140 }} />
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ color: D.green, fontSize: 13, fontWeight: 800, ...mono }}>
                    {audiencePreview ? `${audiencePreview.count} recipient${audiencePreview.count === 1 ? '' : 's'}` : '…'}
                  </Typography>
                </Stack>
                <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.75 }}>Do-not-email clients are always excluded.</Typography>
              </Box>
            )}

            {/* Actions */}
            {!isSent && (
              <Stack direction="row" gap={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                <Button onClick={() => setTestOpen(true)} sx={{ ...dropGhostBtn }}>Send test to me</Button>
                <Box sx={{ flex: 1 }} />
                <Button onClick={sendReal} disabled={busy || !meta.canSend || !(audiencePreview && audiencePreview.count > 0)}
                  startIcon={<SendOutlinedIcon sx={{ fontSize: 17 }} />} sx={{ ...dropPrimaryBtn, px: 2.5 }}>
                  {busy ? <CircularProgress size={16} sx={{ color: D.ink }} /> : `Send to ${audiencePreview ? audiencePreview.count : ''} clients`}
                </Button>
              </Stack>
            )}
          </Stack>
        </Box>
      )}

      <Dialog open={testOpen} onClose={() => setTestOpen(false)} fullWidth maxWidth="xs" fullScreen={fullScreen}
        PaperProps={{ sx: { bgcolor: D.bg, color: D.text, border: `1px solid ${D.line}`, borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 15 }}>Send a test</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" label="Send test to" value={testTo} placeholder="you@jointprinting.com"
            onChange={(e) => setTestTo(e.target.value)} sx={{ ...inkInput, mt: 1 }} InputLabelProps={{ sx: { color: D.muted } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTestOpen(false)} sx={{ ...dropGhostBtn }}>Cancel</Button>
          <Button onClick={sendTest} disabled={busy || !testTo.trim()} sx={{ ...dropPrimaryBtn }}>
            {busy ? <CircularProgress size={16} sx={{ color: D.ink }} /> : 'Send test'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3400} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.sev} variant="filled" onClose={() => setSnack(null)}>{snack.msg}</Alert> : null}
      </Snackbar>
    </Box>
  );
}
