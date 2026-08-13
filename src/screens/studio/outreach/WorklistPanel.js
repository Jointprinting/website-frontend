// src/screens/studio/outreach/WorklistPanel.js
// Follow-Up Command Center (Release 2) — the action worklist inside the Replies
// tab. It turns triaged replies into a "what needs doing now" list grouped into
// buckets (needs a response / quote requested / mockup requested / follow up),
// plus a bridge bucket of leads you marked replied but haven't triaged yet. Each
// card jumps to the CRM company, offers the same one-click triage actions, and
// can AI-draft a suggested reply (AI drafts, owner sends — the draft is only
// text the owner edits, copies, or opens in his mail client himself).
// Presentational — OutreachTab owns data + transport.

import * as React from 'react';
import {
  Box, Stack, Button, IconButton, Menu, MenuItem, Divider, Typography, CircularProgress, Chip, TextField,
} from '@mui/material';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import { D, mono, fmtDate, dropInput, dropGhostBtn } from '../_shared';
import { StatusChip, triageCategoryMeta, WORKLIST_BUCKETS, TRIAGE_ACTIONS } from './_outreach';

// One row's AI-draft workspace. The button asks the API for a suggested reply
// (persisted server-side as aiDraft, so it shows immediately on later loads);
// the textarea is the owner's editing surface; sending stays a human act —
// copy the text, or open it pre-filled in the mail client via mailto:.
// CONTROLLED for `text`: the edited draft lives in WorklistPanel keyed by the
// reply's _id, because triaging a row re-buckets it (new parent → this box
// remounts) — component-local state would silently revert the owner's edits
// back to the stored aiDraft.
function DraftReplyBox({ row, text, onChangeText, onDraftReply, onError }) {
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const generate = async (regenerate) => {
    setBusy(true);
    try {
      const draft = await onDraftReply(row._id, regenerate);
      onChangeText(draft?.body || '');
    } catch (e) {
      onError?.(e.response?.data?.message || 'Could not draft a reply');
    } finally {
      setBusy(false);
    }
  };

  if (text == null) {
    return (
      <Button
        size="small" disabled={busy} onClick={() => generate(false)}
        sx={{ ...dropGhostBtn, mt: 0.75, px: 1.25, py: 0.3, fontSize: 11, color: '#c084fc' }}
      >
        {busy ? 'Drafting…' : '✨ Draft reply'}
      </Button>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      onError?.('Could not copy — select the text and copy it manually.');
    }
  };

  // mailto: straight to the sender, threading as "Re: <original>" (never
  // "Re: Re:"), body = whatever the owner has edited the draft into. OS mailto
  // handlers silently truncate or drop URLs past ~2k chars, so a long body is
  // left OUT of the link (subject-only + a hint) — Copy carries the full text.
  const encodedBody = encodeURIComponent(text);
  const bodyFits = encodedBody.length <= 1800;
  const mailtoParams = [
    row.subject ? `subject=${encodeURIComponent(`Re: ${String(row.subject).replace(/^(?:\s*re:\s*)+/i, '')}`)}` : '',
    bodyFits ? `body=${encodedBody}` : '',
  ].filter(Boolean);
  const mailto = row.fromEmail
    ? `mailto:${encodeURIComponent(row.fromEmail)}${mailtoParams.length ? `?${mailtoParams.join('&')}` : ''}`
    : '';

  return (
    <Box sx={{ mt: 1, p: 1.25, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
      <Typography sx={{ ...mono, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, color: '#c084fc', textTransform: 'uppercase', mb: 0.75 }}>
        ✨ AI draft — edit it, then send it yourself
      </Typography>
      <TextField
        value={text} onChange={(e) => onChangeText(e.target.value)}
        multiline minRows={4} fullWidth size="small" sx={dropInput}
        inputProps={{ style: { fontSize: 12.5, lineHeight: 1.5 } }}
      />
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
        <Button size="small" onClick={copy}
          sx={{ ...dropGhostBtn, px: 1.25, py: 0.3, fontSize: 11, color: copied ? D.green : D.text }}>
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
        {mailto && (
          <Button size="small" component="a" href={mailto}
            sx={{ ...dropGhostBtn, px: 1.25, py: 0.3, fontSize: 11 }}>
            Open in email
          </Button>
        )}
        {mailto && !bodyFits && (
          <Typography sx={{ fontSize: 10.5, color: D.faint }}>
            long draft — opens without the body, use Copy
          </Typography>
        )}
        <Button size="small" disabled={busy} onClick={() => generate(true)}
          sx={{ ...dropGhostBtn, px: 1.25, py: 0.3, fontSize: 11, color: D.muted }}>
          {busy ? 'Drafting…' : 'Regenerate'}
        </Button>
      </Stack>
    </Box>
  );
}

export default function WorklistPanel({ worklist, loading, onSetStatus, onStartJob, onNotAReply, onOpenCompany, onDraftReply, onError }) {
  const [menu, setMenu] = React.useState(null); // { anchor, row }
  const [dismissing, setDismissing] = React.useState({}); // enrollmentId → busy
  // The owner's in-progress draft edits, keyed by reply _id. Lives HERE (not in
  // DraftReplyBox) so an edit survives the row re-bucketing when its status
  // changes and the silent worklist refreshes — session-only, by design: the
  // persisted text is the server-side aiDraft.
  const [draftEdits, setDraftEdits] = React.useState({});
  const setDraftEdit = (id, text) => setDraftEdits((prev) => ({ ...prev, [id]: text }));
  const closeMenu = () => setMenu(null);
  const [starting, setStarting] = React.useState({});     // reply _id → busy

  // The conversion the whole engine exists to produce.
  const runStartJob = async (row, enrollment = false) => {
    closeMenu();
    if (!row || !row.companyKey) return;
    setStarting((p) => ({ ...p, [row._id]: true }));
    try { await onStartJob?.(enrollment ? row.enrollmentId : row._id, { enrollment }); }
    catch (e) { onError?.(e.response?.data?.message || 'Could not start the job'); }
    finally { setStarting((p) => ({ ...p, [row._id]: false })); }
  };

  const pickStatus = async (row, next, extra) => {
    closeMenu();
    try { await onSetStatus(row._id, next, extra); } catch (e) { onError?.(e.response?.data?.message || 'Could not update the reply'); }
  };

  // Bridge-bucket correction: a lead marked 'replied' that was really an
  // auto-responder (no triaged reply exists to run the menu action on). Undo the
  // false warm by ENROLLMENT id — resumes the drip, drops the warm tag — the same
  // fix the "not a real reply" reply action makes, one tap from where it shows.
  const dismissBridge = async (row) => {
    if (!row.enrollmentId || !onNotAReply) return;
    setDismissing((p) => ({ ...p, [row.enrollmentId]: true }));
    try { await onNotAReply(row.enrollmentId); }
    catch (e) { onError?.(e.response?.data?.message || 'Could not correct that lead'); }
    finally { setDismissing((p) => ({ ...p, [row.enrollmentId]: false })); }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: D.green }} /></Box>;
  }

  // ONE list. The five buckets were five places to look for the same question —
  // "who is waiting on me?" — and the reader now answers that on its own (it
  // watches the Sent folder, so a conversation you've answered clears itself and
  // comes back when they write again). What's left doesn't need sorting into
  // boxes; it needs an order. Bucket order is that order: new buying signals
  // first, then the work you owe people, oldest-waiting inside each — which is
  // exactly how the server already sorted them.
  const rows = WORKLIST_BUCKETS.flatMap((b) => (worklist?.[b.key] || []).map((r) => ({ ...r, _bucket: b })));

  if (!rows.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, border: `1px dashed ${D.line}`, borderRadius: 3, bgcolor: D.panel }}>
        <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 40, color: D.green }} />
        <Typography sx={{ color: D.text, fontWeight: 800, mt: 1 }}>You’re all caught up</Typography>
        <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 0.5 }}>
          No replies are waiting on a next step. New replies land here as they’re triaged.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: D.green }} />
          <Typography sx={{ ...mono, fontSize: 12.5, fontWeight: 800, color: D.text, letterSpacing: 0.3 }}>
            Your turn
          </Typography>
          <Chip label={rows.length} size="small" sx={{ height: 18, fontSize: 10.5, fontWeight: 800, bgcolor: `${D.green}22`, color: D.green }} />
        </Stack>
        <Typography sx={{ color: D.faint, fontSize: 11.5, mb: 1 }}>
          Conversations where they spoke last — buying signals first. Answer in Gmail and the card clears itself;
          it comes back the moment they write again.
        </Typography>

        <Stack spacing={0.75}>
          {rows.map((r) => {
                const b = r._bucket;
                const bridge = b.key === 'untriagedReplied';
                const canOpen = r.matched && r.companyKey;
                return (
                  <Stack
                    key={r._id} direction="row" spacing={1} alignItems="flex-start"
                    sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: D.panel, border: `1px solid ${D.line}`,
                      '&:hover': { borderColor: D.lineHi } }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography
                          onClick={canOpen ? () => onOpenCompany(r.companyKey) : undefined}
                          sx={{ fontSize: 13, fontWeight: 700, color: canOpen ? D.green : D.text,
                            cursor: canOpen ? 'pointer' : 'default', '&:hover': canOpen ? { textDecoration: 'underline' } : {} }}
                        >
                          {r.companyName || r.fromEmail || 'Unknown company'}
                          {canOpen && <OpenInNewOutlinedIcon sx={{ fontSize: 12, ml: 0.4, verticalAlign: '-2px' }} />}
                        </Typography>
                        {!bridge && r.category && <StatusChip meta={triageCategoryMeta(r.category)} />}
                        {/* On a single list the bucket is no longer a heading, so
                            the state the OWNER set has to ride on the card — a
                            quote he owes someone must not read like a new reply. */}
                        {b.key !== 'needsResponse' && (
                          <Chip
                            size="small"
                            label={b.label}
                            sx={{ height: 18, fontSize: 10, fontWeight: 800, bgcolor: `${b.tone}22`,
                              color: b.tone, border: `1px solid ${b.tone}44` }}
                          />
                        )}
                        {/* This shop wrote more than once. The card shows their most
                            actionable message; the rest are in All replies. Without
                            this the same company appeared as two separate cards in
                            two buckets, which read as double-counting. */}
                        {r.alsoWaiting > 0 && (
                          <Chip
                            size="small"
                            label={`+${r.alsoWaiting} more`}
                            sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: D.inset,
                              color: D.muted, border: `1px solid ${D.line}` }}
                          />
                        )}
                      </Stack>
                      {bridge ? (
                        <Typography sx={{ fontSize: 11.5, color: D.muted, mt: 0.3 }}>
                          Marked replied {r.repliedAt ? fmtDate(r.repliedAt) : ''} — no triaged reply yet. Open the company to log it,
                          or hit <b>Not a real reply</b> if it was an auto-responder (resumes the drip, drops the warm tag).
                        </Typography>
                      ) : (
                        <>
                          {r.subject && <Typography sx={{ fontSize: 12, color: D.text, mt: 0.3, fontWeight: 600 }}>{r.subject}</Typography>}
                          {r.snippet && (
                            <Typography sx={{ fontSize: 11.5, color: D.muted, mt: 0.2,
                              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {r.snippet}
                            </Typography>
                          )}
                          {r.suggestedAction && (
                            <Typography sx={{ fontSize: 11, color: b.tone, mt: 0.3, fontWeight: 700 }}>→ {r.suggestedAction}</Typography>
                          )}
                          {onDraftReply && (
                            <DraftReplyBox
                              row={r}
                              text={draftEdits[r._id] !== undefined ? draftEdits[r._id] : (r.aiDraft?.body ?? null)}
                              onChangeText={(t) => setDraftEdit(r._id, t)}
                              onDraftReply={onDraftReply} onError={onError}
                            />
                          )}
                        </>
                      )}
                    </Box>
                    {bridge ? (
                      <Stack spacing={0.25} alignItems="flex-end" sx={{ flexShrink: 0 }}>
                        {canOpen && onStartJob && (
                          <Button size="small" disabled={!!starting[r._id]}
                            onClick={() => runStartJob(r, true)}
                            sx={{ color: D.green, fontSize: 11, fontWeight: 800, textTransform: 'none' }}>
                            {starting[r._id] ? 'Starting…' : 'Start a job →'}
                          </Button>
                        )}
                        {canOpen && (
                          <Button size="small" onClick={() => onOpenCompany(r.companyKey)}
                            sx={{ color: D.muted, fontSize: 11, fontWeight: 700, textTransform: 'none', '&:hover': { color: D.green } }}>
                            Open in CRM
                          </Button>
                        )}
                        {onNotAReply && r.enrollmentId && (
                          <Button size="small" disabled={!!dismissing[r.enrollmentId]}
                            onClick={() => dismissBridge(r)}
                            sx={{ color: D.faint, fontSize: 10.5, fontWeight: 700, textTransform: 'none',
                              '&:hover': { color: '#f87171' } }}>
                            {dismissing[r.enrollmentId] ? 'Correcting…' : 'Not a real reply'}
                          </Button>
                        )}
                      </Stack>
                    ) : (
                      <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, row: r })}
                        sx={{ color: D.muted, '&:hover': { color: D.green } }}>
                        <MoreVertOutlinedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    )}
                  </Stack>
                );
          })}
        </Stack>
      </Box>

      <Menu
        anchorEl={menu?.anchor} open={!!menu} onClose={closeMenu}
        PaperProps={{ sx: { bgcolor: D.panelHi, border: `1px solid ${D.line}`, color: D.text, minWidth: 190 } }}
      >
        {menu?.row?.matched && menu?.row?.companyKey && [
          <MenuItem key="job" onClick={() => runStartJob(menu.row)}
            sx={{ fontSize: 13, fontWeight: 800, color: D.green }}>
            <RocketLaunchOutlinedIcon sx={{ fontSize: 16, mr: 1 }} /> Start a job →
          </MenuItem>,
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
        <Divider sx={{ borderColor: D.line }} />
        {/* The classifier missed one: reclassifies as an auto-responder AND
            undoes the warm it caused (drip resumes, warm tag off). */}
        <MenuItem onClick={() => pickStatus(menu.row, 'ignored', { notARealReply: true })}
          sx={{ fontSize: 13, color: D.muted }}>
          Not a real reply (auto-responder)
        </MenuItem>
      </Menu>
    </Stack>
  );
}
