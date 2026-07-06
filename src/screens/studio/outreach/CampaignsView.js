// src/screens/studio/outreach/CampaignsView.js
// Campaign management: list + status toggles, the sequence editor (with a live
// merge-field preview against a sample company), and the enroll dialog (pick
// eligible CRM leads — has email, not opted out, not already customers).

import * as React from 'react';
import {
  Box, Stack, Typography, CircularProgress, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Tooltip, Checkbox,
  Chip, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import { D, mono, dropInput, dropPrimaryBtn, dropGhostBtn, useMobileFullScreen } from '../_shared';
import { EmptyState, Eyebrow, StageChip } from '../crm/_crm';
import {
  StatusChip, campaignStatusMeta, renderPreview, hasSpintax, lintContent, SAMPLE_CONTEXT, MERGE_FIELDS,
  DEFAULT_SEQUENCE, LEAD_VERTICALS, DEFAULT_VERTICAL_ID, verticalMeta,
} from './_outreach';

// ── Sequence editor dialog ────────────────────────────────────────────────────
function CampaignEditor({ open, campaign, onClose, onSave, verticals }) {
  const fullScreen = useMobileFullScreen();
  const isNew = !campaign?._id;
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [vertical, setVertical] = React.useState(DEFAULT_VERTICAL_ID);
  const [steps, setSteps] = React.useState([]);
  const [previewIdx, setPreviewIdx] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  // Live list from the API when present, else the client mirror.
  const verticalList = (Array.isArray(verticals) && verticals.length) ? verticals : LEAD_VERTICALS;

  React.useEffect(() => {
    if (!open) return;
    setName(campaign?.name || 'Dispensary intro');
    setDescription(campaign?.description || '');
    setVertical(campaign?.vertical || DEFAULT_VERTICAL_ID);
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
      await onSave({ name, description, steps, vertical });
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

          {/* Which business type the free finder hunts + this campaign enrolls.
              Dispensaries is the default; picking another (e.g. Breweries) points
              the engine at that vertical and searches every state for it. */}
          <Box>
            <TextField select label="Who this targets" value={vertical}
              onChange={(e) => setVertical(e.target.value)} size="small"
              sx={{ ...dropInput, minWidth: 260, maxWidth: 360 }}>
              {verticalList.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.label}{v.isDefault ? ' (default)' : ''}{v.experimental ? ' · experimental' : ''}
                </MenuItem>
              ))}
            </TextField>
            <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.6 }}>
              The free lead engine searches every state for {verticalMeta(vertical).short}; this campaign only
              enrolls {verticalMeta(vertical).short} — never leads from another vertical.
              {verticalMeta(vertical).experimental ? ' (Sparsely mapped on OSM — expect lighter, noisier results.)' : ''}
            </Typography>
          </Box>

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
                    {/* Subject A/B — only where the subject is actually used
                        (touch 1; follow-ups thread as "Re: …" and ignore it). */}
                    {(i === 0 || s.freshSubject) && (
                      <TextField label="Subject B — A/B test (optional)" value={s.subjectB || ''}
                        onChange={(e) => patchStep(i, { subjectB: e.target.value })}
                        size="small" fullWidth sx={dropInput}
                        helperText="Half the shops get this subject instead — results show on the campaign card."
                        FormHelperTextProps={{ sx: { color: D.faint, fontSize: 10.5, mx: 0.5 } }} />
                    )}
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

            {/* Live preview — exactly what the backend will render (merge +
                spintax), including the "Re: …" threading on follow-ups. */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Eyebrow sx={{ mb: 1 }}>Preview — as {SAMPLE_CONTEXT.companyName} sees it</Eyebrow>
              <Box sx={{ borderRadius: 2, border: `1px solid ${D.line}`, bgcolor: '#f6f6f4', p: 2, minHeight: 220 }}>
                <Typography sx={{ color: '#111', fontWeight: 700, fontSize: 14, mb: 1.25 }}>
                  {(previewIdx > 0 && !preview.freshSubject && steps[0])
                    ? `Re: ${renderPreview(steps[0].subject, SAMPLE_CONTEXT, 'seed0:subj').replace(/^(?:re:\s*)+/i, '')}`
                    : renderPreview(preview.subject, SAMPLE_CONTEXT, `seed${previewIdx}:subj`) || '(no subject)'}
                </Typography>
                <Typography component="div" sx={{ color: '#333', fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {renderPreview(preview.body, SAMPLE_CONTEXT, `seed${previewIdx}:body`)}
                </Typography>
                <Typography sx={{ color: '#999', fontSize: 10.5, mt: 2, pt: 1.25, borderTop: '1px solid #e2e2de' }}>
                  Joint Printing · jointprinting.com — Unsubscribe
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                {hasSpintax(`${preview.subject} ${preview.body}`) && (
                  <Typography sx={{ color: D.green, fontSize: 11, fontWeight: 700 }}>
                    ✦ Varies per recipient (spintax) — each shop gets a different wording
                  </Typography>
                )}
                {String(preview.subjectB || '').trim() && (previewIdx === 0 || preview.freshSubject) && (
                  <Typography sx={{ color: '#c084fc', fontSize: 11, fontWeight: 700 }}>
                    ⚖ A/B — half get: “{renderPreview(preview.subjectB, SAMPLE_CONTEXT, `seed${previewIdx}:subjB`)}”
                  </Typography>
                )}
                {previewIdx > 0 && !preview.freshSubject && (
                  <Typography sx={{ color: D.faint, fontSize: 11 }}>
                    ↩ Threads into the first email (same conversation)
                  </Typography>
                )}
              </Stack>
              <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.75 }}>
                The address + unsubscribe footer is added automatically to every send (legally required).
              </Typography>

              {/* Live deliverability check for this step — advisory, never blocks.
                  A B-subject is linted through the same subject rules, tagged so
                  the owner knows which arm tripped. */}
              {(() => {
                const lint = lintContent({ subject: preview.subject, body: preview.body });
                if (String(preview.subjectB || '').trim()) {
                  const bIssues = lintContent({ subject: preview.subjectB, body: 'x' }).issues
                    .filter((iss) => iss.code.startsWith('subject') || iss.code === 'spam-words')
                    .map((iss) => ({ ...iss, code: `B-${iss.code}`, msg: `Subject B: ${iss.msg}` }));
                  if (bIssues.length) {
                    lint.issues = [...lint.issues, ...bIssues];
                    const penalty = lint.issues.reduce((n, x) => n + (x.level === 'warn' ? 15 : 5), 0);
                    lint.score = Math.max(0, 100 - penalty);
                    lint.level = lint.score >= 80 ? 'ok' : lint.score >= 55 ? 'warn' : 'action';
                  }
                }
                const tone = lint.level === 'ok' ? D.green : lint.level === 'warn' ? '#fbbf24' : '#f87171';
                return (
                  <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 2, border: `1px solid ${tone}44`, bgcolor: `${tone}14` }}>
                    <Typography sx={{ color: tone, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.3 }}>
                      Deliverability check — {lint.score}/100 {lint.level === 'ok' ? '· looks clean ✓' : ''}
                    </Typography>
                    {lint.issues.length > 0 && (
                      <Stack component="ul" sx={{ m: 0, mt: 0.5, pl: 2 }} spacing={0.25}>
                        {lint.issues.map((iss) => (
                          <Typography key={iss.code} component="li" sx={{ color: D.muted, fontSize: 11.5 }}>
                            {iss.msg}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                  </Box>
                );
              })()}
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
  const [checked, setChecked] = React.useState(() => new Set());
  const [enrolling, setEnrolling] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!campaign) return;
    setLoading(true);
    try {
      const list = await fetchCandidates({ campaignId: campaign._id, q });
      setRows(list);
      setChecked(new Set());
    } catch (e) {
      onError(e.response?.data?.message || 'Could not load candidates');
    } finally {
      setLoading(false);
    }
  }, [campaign, q, fetchCandidates, onError]);

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
            not a customer, not opted out, not already enrolled. Anyone you’ve called, texted, or visited is hidden,
            big chains are skipped at import, and <b>no email address appears twice</b> — so one inbox never gets
            two cold emails.
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField placeholder="Search name / email / address…" value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              size="small" fullWidth sx={dropInput} />
            <Button onClick={load} sx={{ ...dropGhostBtn, px: 2, flexShrink: 0 }}>Search</Button>
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
              hint="The lead engine is stacking cold leads in the background — check its progress under Lead engine, or hit Refill now there." />
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

// ── Launch confirmation + "send me a test first" gate ────────────────────────
// Launch is the moment real cold email starts going out, so it no longer fires
// on a single click. This dialog says exactly what's about to happen (paced,
// per-lead) and lets the owner send themselves a live test through the real
// sender before a single lead is touched.
function LaunchDialog({ open, campaign, onClose, onLaunch, onTestSend, onError }) {
  const fullScreen = useMobileFullScreen();
  const [testTo, setTestTo] = React.useState('');
  const [testing, setTesting] = React.useState(false);
  const [testedOk, setTestedOk] = React.useState(false);
  const [launching, setLaunching] = React.useState(false);
  React.useEffect(() => {
    if (open) { setTestTo(''); setTestedOk(false); setTesting(false); setLaunching(false); }
  }, [open]);
  if (!campaign) return null;
  const enrolled = (campaign.stats && campaign.stats.enrolled) || 0;
  const steps = (campaign.steps || []).length;

  const runTest = async () => {
    if (!onTestSend) return;
    setTesting(true);
    try { await onTestSend(testTo.trim()); setTestedOk(true); }
    catch (e) { onError && onError(e?.response?.data?.message || 'Test send failed.'); }
    finally { setTesting(false); }
  };
  const go = async () => {
    setLaunching(true);
    try { await onLaunch(campaign._id); onClose(); }
    catch (e) { onError && onError(e?.response?.data?.message || 'Launch failed.'); setLaunching(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: D.panel, border: `1px solid ${D.line}`, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ color: D.text, fontWeight: 800 }}>Launch “{campaign.name}”</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: D.muted, fontSize: 13.5, lineHeight: 1.6, mb: 2 }}>
          This starts real cold email{enrolled ? ` to your ${enrolled} enrolled lead${enrolled === 1 ? '' : 's'}` : ''} and
          turns on auto-enroll to keep it fed. It ramps up gently (~10/day in week one, doubling weekly) — it will not blast
          everyone at once. Each lead walks its own {steps}-touch sequence, warm follow-ups always go first, and anyone who
          replies drops out of the drip.
        </Typography>
        <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
          <Typography sx={{ color: D.text, fontSize: 13, fontWeight: 700, mb: 0.75 }}>Send yourself a test first</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@yourinbox.com (blank = your sender)"
              size="small" fullWidth type="email" sx={dropInput} />
            <Button onClick={runTest} disabled={testing}
              sx={{ ...dropGhostBtn, px: 2, py: 0.6, flexShrink: 0, color: testedOk ? D.green : D.text }}>
              {testing ? 'Sending…' : testedOk ? 'Sent ✓ — again' : 'Send test'}
            </Button>
          </Stack>
          <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.75 }}>
            Uses your real sender + SMTP — check it lands in the inbox (not spam) before a single lead gets it.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ ...dropGhostBtn, px: 2 }}>Cancel</Button>
        <Button onClick={go} disabled={launching} startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 17 }} />}
          sx={{ ...dropPrimaryBtn, px: 2.5 }}>
          {launching ? 'Starting…' : 'Start sending'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
// Health-signal color (mirrors backend campaignHealth levels).
const HEALTH_TONE = { ok: D.green, warn: D.amber, action: '#f87171' };

export default function CampaignsView({ overview, loading, autoEnrollCampaignId = null, onCreate, onUpdate, onLaunch, onUnenrollAll, onReset, onDelete, onAutoEnroll, onTestSend, onRecoverSends, fetchCandidates, onEnroll, onError }) {
  const [editor, setEditor] = React.useState(null);      // null | { campaign|null }
  const [enrollFor, setEnrollFor] = React.useState(null); // campaign | null
  const [launchFor, setLaunchFor] = React.useState(null); // campaign | null (confirm + test gate)

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
          hint={`“New campaign” starts you off with the ${DEFAULT_SEQUENCE.length}-touch dispensary sequence — edit and activate.`} />
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
                      {/* Only badge non-default verticals — a dispensary campaign
                          (the common case) stays uncluttered. */}
                      {c.vertical && c.vertical !== DEFAULT_VERTICAL_ID && (
                        <Chip label={verticalMeta(c.vertical).label} size="small"
                          sx={{ height: 20, fontSize: 10.5, bgcolor: D.inset, color: D.green, border: `1px solid ${D.line}` }} />
                      )}
                    </Stack>
                    <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.4 }}>
                      {(c.steps || []).length} step{(c.steps || []).length === 1 ? '' : 's'} ·{' '}
                      {c.stats.enrolled} enrolled · {c.stats.sent} sent · {c.stats.replied} replied
                      {c.description ? ` — ${c.description}` : ''}
                    </Typography>
                    {/* The "why isn't it sending?" signal — names the exact blocker
                        (e.g. "48 missing email") instead of leaving a wall of zeros. */}
                    {c.health && (
                      <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 0.6 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', mt: '5px', flexShrink: 0,
                          bgcolor: HEALTH_TONE[c.health.level] || D.faint }} />
                        <Typography sx={{ fontSize: 11.5, lineHeight: 1.45 }}>
                          <Box component="span" sx={{ color: HEALTH_TONE[c.health.level] || D.text, fontWeight: 800 }}>{c.health.label}</Box>
                          {c.health.hint ? <Box component="span" sx={{ color: D.faint }}> — {c.health.hint}</Box> : null}
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.75} flexShrink={0}>
                    <Tooltip title="Enroll CRM leads into this sequence">
                      <Button onClick={() => setEnrollFor(c)} startIcon={<GroupAddOutlinedIcon sx={{ fontSize: 16 }} />}
                        sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12 }}>
                        Enroll
                      </Button>
                    </Tooltip>
                    {onRecoverSends && ((c.stats.failed || 0) + (c.stats.stopped || 0)) > 0 && (
                      <Tooltip title="Requeue leads dropped by a SENDER-side send error (SMTP down, auth, unverified sender) — undoes the wrongful suppression + do-not-email so the drip resumes. Real bounces and opt-outs stay blocked.">
                        <Button
                          onClick={() => {
                            // eslint-disable-next-line no-alert
                            if (window.confirm('Requeue leads that were dropped by a sender-side send error?\n\nThis reverses only drops caused by an SMTP/sender problem — real bounces and opt-outs are kept blocked — and resumes the drip. Safe to run.')) onRecoverSends();
                          }}
                          startIcon={<ForwardToInboxOutlinedIcon sx={{ fontSize: 16 }} />}
                          sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12, color: D.amber }}>
                          Requeue dropped
                        </Button>
                      </Tooltip>
                    )}
                    {onUnenrollAll && c.stats.enrolled > 0 && (
                      <Tooltip title="Remove everyone from this campaign so you can re-enroll fresh leads (keeps anyone already emailed)">
                        <Button
                          onClick={() => {
                            // eslint-disable-next-line no-alert
                            if (window.confirm(`Unenroll all ${c.stats.enrolled} from "${c.name}"? Anyone already emailed is kept.`)) onUnenrollAll(c._id);
                          }}
                          startIcon={<PersonRemoveOutlinedIcon sx={{ fontSize: 16 }} />}
                          sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12, color: '#f87171' }}>
                          Unenroll all
                        </Button>
                      </Tooltip>
                    )}
                    {onReset && c.stats.enrolled > 0 && (
                      <Tooltip title="Full fresh start — clears the WHOLE roster (including already-emailed) so the campaign re-runs from email 1. Opt-outs and CRM contacts are kept.">
                        <Button
                          onClick={() => {
                            // eslint-disable-next-line no-alert
                            if (window.confirm(`Reset "${c.name}"?\n\nThis clears ALL ${c.stats.enrolled} enrollments — including anyone already emailed — so the campaign re-runs cleanly from email 1 as leads refill.\n\nOpt-outs/unsubscribes and every CRM contact are kept. Old-run stats are cleared.`)) onReset(c._id);
                          }}
                          startIcon={<RestartAltOutlinedIcon sx={{ fontSize: 16 }} />}
                          sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12, color: '#f87171' }}>
                          Reset
                        </Button>
                      </Tooltip>
                    )}
                    {onDelete && (
                      <Tooltip title="Delete this campaign for good — removes it and any enrollments. Opt-outs and CRM contacts are kept.">
                        <Button
                          onClick={() => {
                            // eslint-disable-next-line no-alert
                            if (window.confirm(`Delete "${c.name}" for good?\n\nThis removes the campaign${c.stats.enrolled ? ` and all ${c.stats.enrolled} enrollments` : ''}. Opt-outs and CRM contacts are kept. This can't be undone.`)) onDelete(c._id);
                          }}
                          startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                          sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12, color: '#f87171' }}>
                          Delete
                        </Button>
                      </Tooltip>
                    )}
                    {onAutoEnroll && active && (() => {
                      const on = autoEnrollCampaignId === c._id;
                      return (
                        <Tooltip title={on
                          ? 'Auto-enroll is ON — new cold leads flow into this campaign automatically. Click to turn off.'
                          : 'Auto-enroll: keep this campaign topped up from your lead reserve automatically (still respects the daily cap + all guards).'}>
                          <Button onClick={() => onAutoEnroll(c._id, !on)}
                            startIcon={<AutoModeOutlinedIcon sx={{ fontSize: 16 }} />}
                            sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12, color: on ? D.green : D.muted,
                              ...(on ? { border: `1px solid ${D.green}55`, bgcolor: 'rgba(74,222,128,0.08)' } : {}) }}>
                            Auto-enroll{on ? ': on' : ''}
                          </Button>
                        </Tooltip>
                      );
                    })()}
                    <Tooltip title="Edit the sequence">
                      <Button onClick={() => setEditor({ campaign: c })} startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
                        sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12 }}>
                        Edit
                      </Button>
                    </Tooltip>
                    <Tooltip title={active ? 'Pause — nothing more sends' : 'Launch — review, send yourself a test, then start sending'}>
                      <Button
                        onClick={() => (active ? onUpdate(c._id, { status: 'paused' }) : setLaunchFor(c))}
                        startIcon={active ? <PauseRoundedIcon sx={{ fontSize: 16 }} /> : <PlayArrowRoundedIcon sx={{ fontSize: 17 }} />}
                        sx={active
                          ? { ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12, color: D.amber }
                          : { ...dropPrimaryBtn, px: 1.5, py: 0.4, fontSize: 12 }}
                      >
                        {active ? 'Pause' : 'Launch'}
                      </Button>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <CampaignEditor open={!!editor} campaign={editor?.campaign} onClose={() => setEditor(null)} onSave={save}
        verticals={overview?.verticals} />
      <EnrollDialog open={!!enrollFor} campaign={enrollFor} onClose={() => setEnrollFor(null)}
        fetchCandidates={fetchCandidates} onEnroll={onEnroll} onError={onError} />
      <LaunchDialog open={!!launchFor} campaign={launchFor} onClose={() => setLaunchFor(null)}
        onLaunch={onLaunch} onTestSend={onTestSend} onError={onError} />
    </Stack>
  );
}
