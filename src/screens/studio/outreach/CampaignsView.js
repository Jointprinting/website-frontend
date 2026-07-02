// src/screens/studio/outreach/CampaignsView.js
// Campaign management: list + status toggles, the sequence editor (with a live
// merge-field preview against a sample company), and the enroll dialog (pick
// eligible CRM leads — has email, not opted out, not already customers).

import * as React from 'react';
import {
  Box, Stack, Typography, CircularProgress, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Tooltip, Checkbox,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import { D, mono, dropInput, dropPrimaryBtn, dropGhostBtn, useMobileFullScreen } from '../_shared';
import { EmptyState, Eyebrow, StageChip } from '../crm/_crm';
import {
  StatusChip, campaignStatusMeta, renderTemplate, SAMPLE_CONTEXT, MERGE_FIELDS,
  DEFAULT_SEQUENCE,
} from './_outreach';

// ── Sequence editor dialog ────────────────────────────────────────────────────
function CampaignEditor({ open, campaign, onClose, onSave }) {
  const fullScreen = useMobileFullScreen();
  const isNew = !campaign?._id;
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [steps, setSteps] = React.useState([]);
  const [previewIdx, setPreviewIdx] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(campaign?.name || 'Dispensary intro');
    setDescription(campaign?.description || '');
    setSteps(campaign?.steps?.length ? campaign.steps.map((s) => ({ ...s })) : DEFAULT_SEQUENCE.map((s) => ({ ...s })));
    setPreviewIdx(0);
  }, [open, campaign]);

  const patchStep = (i, patch) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const removeStep = (i) => {
    setSteps((prev) => prev.filter((_, j) => j !== i));
    setPreviewIdx((p) => Math.max(0, Math.min(p, steps.length - 2)));
  };
  const addStep = () => setSteps((prev) => [...prev, { offsetDays: 4, subject: '', body: '' }]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ name, description, steps });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const preview = steps[previewIdx] || { subject: '', body: '' };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="lg" fullWidth
      PaperProps={{ sx: { bgcolor: D.bg, border: `1px solid ${D.line}`, borderRadius: fullScreen ? 0 : 3 } }}>
      <DialogTitle sx={{ color: D.text, fontWeight: 800 }}>
        {isNew ? 'New campaign' : `Edit — ${campaign.name}`}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField label="Campaign name" value={name} onChange={(e) => setName(e.target.value)}
              size="small" fullWidth sx={dropInput} />
            <TextField label="Notes (only you see this)" value={description} onChange={(e) => setDescription(e.target.value)}
              size="small" fullWidth sx={dropInput} />
          </Stack>

          {/* Merge-field cheatsheet */}
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <Typography sx={{ color: D.faint, fontSize: 11.5, fontWeight: 700 }}>Merge fields:</Typography>
            {MERGE_FIELDS.map((f) => (
              <Tooltip key={f.token} title={f.hint}>
                <Chip label={f.token} size="small"
                  sx={{ ...mono, height: 20, fontSize: 10.5, bgcolor: D.inset, color: D.green, border: `1px solid ${D.line}` }} />
              </Tooltip>
            ))}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
            {/* Steps */}
            <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
              {steps.map((s, i) => (
                <Box key={i} onClick={() => setPreviewIdx(i)}
                  sx={{ p: 1.5, borderRadius: 2, bgcolor: D.panel, cursor: 'pointer',
                    border: `1px solid ${previewIdx === i ? D.lineHi : D.line}` }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography sx={{ ...mono, color: D.green, fontSize: 11.5, fontWeight: 800 }}>
                      STEP {i + 1}
                    </Typography>
                    {i > 0 ? (
                      <TextField
                        value={s.offsetDays} onChange={(e) => patchStep(i, { offsetDays: e.target.value })}
                        size="small" type="number" sx={{ ...dropInput, width: 74 }}
                        inputProps={{ min: 1, style: { padding: '4px 8px', fontSize: 12.5 } }}
                      />
                    ) : null}
                    <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
                      {i === 0 ? 'sends first (paced by the daily cap)' : 'days after the previous email'}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    {steps.length > 1 && (
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeStep(i); }}
                        sx={{ color: D.faint, '&:hover': { color: '#f87171' } }}>
                        <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    )}
                  </Stack>
                  <Stack spacing={1}>
                    <TextField label="Subject" value={s.subject} onChange={(e) => patchStep(i, { subject: e.target.value })}
                      size="small" fullWidth sx={dropInput} />
                    <TextField label="Body" value={s.body} onChange={(e) => patchStep(i, { body: e.target.value })}
                      multiline minRows={4} fullWidth sx={dropInput} />
                  </Stack>
                </Box>
              ))}
              <Button onClick={addStep} startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                sx={{ ...dropGhostBtn, alignSelf: 'flex-start', px: 1.75, py: 0.5, fontSize: 12.5 }}>
                Add a follow-up
              </Button>
            </Stack>

            {/* Live preview — exactly what the backend will render. */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Eyebrow sx={{ mb: 1 }}>Preview — as {SAMPLE_CONTEXT.companyName} sees it</Eyebrow>
              <Box sx={{ borderRadius: 2, border: `1px solid ${D.line}`, bgcolor: '#f6f6f4', p: 2, minHeight: 220 }}>
                <Typography sx={{ color: '#111', fontWeight: 700, fontSize: 14, mb: 1.25 }}>
                  {renderTemplate(preview.subject, SAMPLE_CONTEXT) || '(no subject)'}
                </Typography>
                <Typography component="div" sx={{ color: '#333', fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {renderTemplate(preview.body, SAMPLE_CONTEXT)}
                </Typography>
                <Typography sx={{ color: '#999', fontSize: 10.5, mt: 2, pt: 1.25, borderTop: '1px solid #e2e2de' }}>
                  Joint Printing · New Jersey, USA — Unsubscribe
                </Typography>
              </Box>
              <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.75 }}>
                The address + unsubscribe footer is added automatically to every send (legally required).
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: D.muted }}>Cancel</Button>
        <Button onClick={save} disabled={saving || !name.trim()} sx={{ ...dropPrimaryBtn, px: 3 }}>
          {saving ? 'Saving…' : (isNew ? 'Create campaign' : 'Save changes')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Enroll dialog ─────────────────────────────────────────────────────────────
function EnrollDialog({ open, campaign, onClose, fetchCandidates, onEnroll, onError }) {
  const fullScreen = useMobileFullScreen();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [includeContacted, setIncludeContacted] = React.useState(false);
  const [checked, setChecked] = React.useState(() => new Set());
  const [enrolling, setEnrolling] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!campaign) return;
    setLoading(true);
    try {
      const list = await fetchCandidates({ campaignId: campaign._id, q, includeContacted });
      setRows(list);
      setChecked(new Set());
    } catch (e) {
      onError(e.response?.data?.message || 'Could not load candidates');
    } finally {
      setLoading(false);
    }
  }, [campaign, q, includeContacted, fetchCandidates, onError]);

  React.useEffect(() => { if (open) load(); }, [open, load]);

  const toggle = (key) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allChecked = rows.length > 0 && checked.size === rows.length;

  const enroll = async () => {
    setEnrolling(true);
    try {
      await onEnroll(campaign._id, [...checked]);
      onClose();
    } catch (e) {
      onError(e.response?.data?.message || 'Enroll failed');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: D.bg, border: `1px solid ${D.line}`, borderRadius: fullScreen ? 0 : 3 } }}>
      <DialogTitle sx={{ color: D.text, fontWeight: 800 }}>
        Enroll leads — {campaign?.name}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Typography sx={{ color: D.faint, fontSize: 12.5 }}>
            Only genuinely <b>cold</b> companies show here — has an email, <b>never personally contacted by you</b>,
            not a customer, not opted out, not already enrolled. Anyone you’ve called, texted, or visited is hidden
            so they never get a stranger’s cold intro.
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField placeholder="Search name / email / address…" value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              size="small" fullWidth sx={dropInput} />
            <Button onClick={load} sx={{ ...dropGhostBtn, px: 2, flexShrink: 0 }}>Search</Button>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: -0.5 }}>
            <Checkbox size="small" checked={includeContacted}
              onChange={(e) => { setIncludeContacted(e.target.checked); }}
              sx={{ p: 0.5, color: D.muted, '&.Mui-checked': { color: D.amber } }} />
            <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
              Include leads I’ve already contacted (override — use only if you mean to re-warm someone)
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Checkbox
              checked={allChecked}
              indeterminate={checked.size > 0 && !allChecked}
              onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.companyKey)))}
              sx={{ color: D.muted, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: D.green } }}
            />
            <Typography sx={{ color: D.muted, fontSize: 12.5, fontWeight: 700 }}>
              {checked.size} of {rows.length} selected
            </Typography>
          </Stack>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={26} sx={{ color: D.green }} />
            </Box>
          ) : rows.length === 0 ? (
            <EmptyState icon={<GroupAddOutlinedIcon />} title="No eligible leads"
              hint="Import leads (with emails) first, or widen the filter." />
          ) : (
            <Stack spacing={0.5} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
              {rows.map((r) => (
                <Stack key={r.companyKey} direction="row" alignItems="center" spacing={1}
                  onClick={() => toggle(r.companyKey)}
                  sx={{ px: 1, py: 0.6, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: checked.has(r.companyKey) ? 'rgba(74,222,128,0.07)' : D.inset,
                    border: `1px solid ${checked.has(r.companyKey) ? D.lineHi : D.line}` }}>
                  <Checkbox checked={checked.has(r.companyKey)} size="small" tabIndex={-1}
                    sx={{ p: 0.5, color: D.muted, '&.Mui-checked': { color: D.green } }} />
                  <Typography sx={{ color: D.text, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {r.companyName || r.clientName || r.companyKey}
                  </Typography>
                  <StageChip stage={r.stage} />
                  <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5, minWidth: 0, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                    {r.outreachEmail}
                  </Typography>
                  <Typography sx={{ color: D.faint, fontSize: 11, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
                    {r.address || r.area || ''}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: D.muted }}>Cancel</Button>
        <Button onClick={enroll} disabled={enrolling || checked.size === 0} sx={{ ...dropPrimaryBtn, px: 3 }}>
          {enrolling ? 'Enrolling…' : `Enroll ${checked.size || ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function CampaignsView({ overview, loading, onCreate, onUpdate, fetchCandidates, onEnroll, onError }) {
  const [editor, setEditor] = React.useState(null);      // null | { campaign|null }
  const [enrollFor, setEnrollFor] = React.useState(null); // campaign | null

  if (loading && !overview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }
  const campaigns = overview?.campaigns || [];

  const save = async (payload) => {
    if (editor?.campaign?._id) await onUpdate(editor.campaign._id, payload);
    else await onCreate(payload);
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="center">
        <Eyebrow>Campaigns — sequences the engine works through</Eyebrow>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={() => setEditor({ campaign: null })} startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          sx={{ ...dropPrimaryBtn, px: 2, py: 0.6, fontSize: 12.5 }}>
          New campaign
        </Button>
      </Stack>

      {campaigns.length === 0 ? (
        <EmptyState icon={<ForwardToInboxOutlinedIcon />} title="No campaigns yet"
          hint="“New campaign” starts you off with a proven 3-step dispensary sequence — edit and activate." />
      ) : (
        <Stack spacing={1.5}>
          {campaigns.map((c) => {
            const active = c.status === 'active';
            return (
              <Box key={c._id} sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5 }}>{c.name}</Typography>
                      <StatusChip meta={campaignStatusMeta(c.status)} />
                    </Stack>
                    <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.4 }}>
                      {(c.steps || []).length} step{(c.steps || []).length === 1 ? '' : 's'} ·{' '}
                      {c.stats.enrolled} enrolled · {c.stats.replied} replied
                      {c.description ? ` — ${c.description}` : ''}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} flexShrink={0}>
                    <Tooltip title="Enroll CRM leads into this sequence">
                      <Button onClick={() => setEnrollFor(c)} startIcon={<GroupAddOutlinedIcon sx={{ fontSize: 16 }} />}
                        sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12 }}>
                        Enroll
                      </Button>
                    </Tooltip>
                    <Tooltip title="Edit the sequence">
                      <Button onClick={() => setEditor({ campaign: c })} startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
                        sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12 }}>
                        Edit
                      </Button>
                    </Tooltip>
                    <Tooltip title={active ? 'Pause — nothing more sends' : 'Go live'}>
                      <Button
                        onClick={() => onUpdate(c._id, { status: active ? 'paused' : 'active' })}
                        startIcon={active ? <PauseRoundedIcon sx={{ fontSize: 16 }} /> : <PlayArrowRoundedIcon sx={{ fontSize: 17 }} />}
                        sx={active
                          ? { ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12, color: D.amber }
                          : { ...dropPrimaryBtn, px: 1.5, py: 0.4, fontSize: 12 }}
                      >
                        {active ? 'Pause' : 'Activate'}
                      </Button>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <CampaignEditor open={!!editor} campaign={editor?.campaign} onClose={() => setEditor(null)} onSave={save} />
      <EnrollDialog open={!!enrollFor} campaign={enrollFor} onClose={() => setEnrollFor(null)}
        fetchCandidates={fetchCandidates} onEnroll={onEnroll} onError={onError} />
    </Stack>
  );
}
