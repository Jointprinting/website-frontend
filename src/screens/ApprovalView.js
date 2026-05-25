// src/screens/ApprovalView.js
// Public, token-gated approval surface that clients open from a link sent
// by the Order Tracker. They see mockups + the quote, then either approve
// or request changes with a note. Backend logs the event.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Stack, Typography, Button, TextField, CircularProgress, Dialog,
  DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EditNoteIcon from '@mui/icons-material/EditNote';
import axios from 'axios';
import config from '../config.json';
import jpLogoColored from '../modules/images/logo_colored.webp';
import JpLoader from '../common/JpLoader';

const COLORS = {
  bg:     '#f6f6f4',
  panel:  '#ffffff',
  text:   '#111111',
  muted:  '#666666',
  border: '#e6e6e0',
  brand:  '#1a3d2b',
  brandH: '#4ade80',
};

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ApprovalView() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [data, setData]   = useState(null);
  const [err, setErr]     = useState('');
  const [errReason, setErrReason] = useState('');   // '' | 'expired' | 'invalid'
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesText, setChangesText] = useState('');

  // Derived from the server's approvalStatus so reopening the link shows the
  // same locked state for the client every time.
  const p = data?.project || {};
  const approvalStatus = p.approvalStatus || 'pending';   // 'pending' | 'approved' | 'requested_changes'

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) { setErr('This link is missing a token.'); setLoading(false); return; }
      try {
        const r = await axios.get(
          `${config.backendUrl}/api/public/projects/${projectId}?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        setData(r.data);
      } catch (e) {
        if (cancelled) return;
        setErr(e.response?.data?.message || 'This link is invalid or expired.');
        setErrReason(e.response?.data?.reason || (e.response?.status === 410 ? 'expired' : 'invalid'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, token]);

  const refresh = async () => {
    try {
      const r = await axios.get(
        `${config.backendUrl}/api/public/projects/${projectId}?token=${encodeURIComponent(token)}`);
      setData(r.data);
    } catch (_) { /* keep existing data */ }
  };

  // Once approved, poll every 60s so the client sees the timeline update in
  // near-real-time when the admin ticks off a step — they don't have to
  // refresh the tab to see "Blanks shipping" turn green. Pauses when the tab
  // is hidden to avoid hammering the server while nobody's looking.
  useEffect(() => {
    if (approvalStatus !== 'approved') return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || document.hidden) return;
      refresh();
    };
    const id = setInterval(tick, 60000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalStatus, projectId, token]);

  const handleApprove = async () => {
    setActionBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/approve?token=${encodeURIComponent(token)}`);
      await refresh();
    } catch (e) {
      alert(e.response?.data?.message || 'Approval failed. Try again or contact us directly.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRequestChanges = async () => {
    setActionBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/feedback?token=${encodeURIComponent(token)}`,
        { message: changesText });
      setChangesOpen(false);
      setChangesText('');
      await refresh();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not send your feedback. Try again or reply to our email.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <JpLoader size={72} label="Loading…" tone="light" />
      </Box>
    );
  }
  if (err || !data) {
    const isExpired = errReason === 'expired';
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ bgcolor: COLORS.panel, p: 4, borderRadius: 2, maxWidth: 480, textAlign: 'center', boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          <Typography sx={{ color: isExpired ? '#b45309' : COLORS.text, fontWeight: 800, fontSize: 20, mb: 1 }}>
            {isExpired ? 'This approval link has expired' : 'Link unavailable'}
          </Typography>
          <Typography sx={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.55 }}>
            {isExpired
              ? "Reach out and we'll send you a fresh one — prices and details may need a quick refresh."
              : (err || "This approval link couldn't be loaded.")}
          </Typography>
        </Box>
      </Box>
    );
  }

  const mockups = data.mockups || [];
  const logo = data.logo;
  const quoteLines = p.quoteLines || [];
  const items = p.items || [];
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
  const total = Number(p.totalValue) || subtotal;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, color: COLORS.text, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <Box sx={{ maxWidth: 820, mx: 'auto', p: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Box sx={{ bgcolor: COLORS.panel, p: { xs: 2.5, md: 4 }, borderRadius: 2, boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          <Stack direction="row" alignItems="center" gap={2} mb={2}>
            {logo && (
              <Box sx={{ width: 56, height: 56, p: 0.5, bgcolor: '#fff', border: `1px solid ${COLORS.border}`,
                borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Box component="img" src={logo} alt=""
                  sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </Box>
            )}
            <Box>
              <Box component="img" src={jpLogoColored} alt="Joint Printing"
                sx={{ maxHeight: 56, maxWidth: 260, display: 'block', mb: 0.5 }} />
              {/* Project # hidden from the client — it's an internal handle.
                  Invoice # and order date stay since they're things the client
                  actually references when they have questions. */}
              {(p.orderNumber || p.orderDate) && (
                <Typography sx={{ color: COLORS.muted, fontSize: 12, mt: 0.5 }}>
                  {[
                    p.orderNumber ? `Invoice #${p.orderNumber}` : null,
                    p.orderDate ? new Date(p.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
                  ].filter(Boolean).join(' · ')}
                </Typography>
              )}
            </Box>
          </Stack>

          <Typography sx={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.3 }}>
            Client
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
            {p.companyName || p.clientName || 'Untitled'}
          </Typography>
          {p.clientName && p.companyName && p.clientName !== p.companyName && (
            <Typography sx={{ color: COLORS.muted, fontSize: 13 }}>{p.clientName}</Typography>
          )}

          {p.confirmationMessage && (
            <Box sx={{ mt: 2.5, p: 1.5, borderLeft: `3px solid ${COLORS.brandH}`, bgcolor: '#f6fef9', borderRadius: '0 4px 4px 0' }}>
              <Typography sx={{ color: '#333', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {p.confirmationMessage}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Mockups */}
        {mockups.length > 0 && (
          <Box sx={{ bgcolor: COLORS.panel, p: { xs: 2.5, md: 4 }, borderRadius: 2, mt: 2, boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
            <Typography sx={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
              Mockups
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {mockups.map((m, i) => (
                <Box key={i} sx={{ aspectRatio: '4/3', bgcolor: '#f4f4f4', borderRadius: 1, overflow: 'hidden' }}>
                  {m.thumbnail && <Box component="img" src={m.thumbnail} alt={m.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Items / quote */}
        <Box sx={{ bgcolor: COLORS.panel, p: { xs: 2.5, md: 4 }, borderRadius: 2, mt: 2, boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          <Typography sx={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
            Items
          </Typography>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left',  fontSize: 10, textTransform: 'uppercase', color: COLORS.muted, padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Qty</th>
                <th style={{ textAlign: 'left',  fontSize: 10, textTransform: 'uppercase', color: COLORS.muted, padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Description</th>
                <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: COLORS.muted, padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Unit $</th>
                <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: COLORS.muted, padding: '6px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Line $</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '14px 8px', color: '#999', fontStyle: 'italic' }}>
                  No line items
                </td></tr>
              ) : itemRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>{r.qty || ''}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>{r.description || ''}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>{r.unitPrice ? money(r.unitPrice) : ''}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>{r.lineTotal ? money(r.lineTotal) : ''}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, borderTop: '2px solid #111', fontSize: 16 }}>Total</td>
                <td          style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, borderTop: '2px solid #111', fontSize: 16 }}>{money(total)}</td>
              </tr>
            </tbody>
          </Box>

          {p.confirmationTerms && (
            <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${COLORS.border}` }}>
              <Typography sx={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                Terms
              </Typography>
              <Typography sx={{ color: COLORS.muted, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {p.confirmationTerms}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Action panel — locked once the client has either approved OR
            requested changes, so the link stays consistent on every reload. */}
        <Box sx={{ bgcolor: COLORS.panel, p: { xs: 2.5, md: 3 }, borderRadius: 2, mt: 2, boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          {approvalStatus === 'requested_changes' ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <EditNoteIcon sx={{ color: '#fbbf24', fontSize: 40, mb: 1 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Got it — we&apos;ll revise.</Typography>
              <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.5 }}>
                Your notes are with the team. We&apos;ll send a new proof shortly.
              </Typography>
              {p.approvalAt && (
                <Typography sx={{ color: COLORS.muted, fontSize: 11, mt: 1.5 }}>
                  Sent {new Date(p.approvalAt).toLocaleString()}
                </Typography>
              )}
            </Box>
          ) : approvalStatus === 'approved' ? (
            <Box sx={{ py: 1 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <CheckCircleOutlineIcon sx={{ color: COLORS.brandH, fontSize: 36, mb: 0.5 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 18 }}>You&apos;re approved — thank you!</Typography>
                <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.5 }}>
                  We&apos;ll move through the steps below and update this page as each one happens.
                </Typography>
              </Box>
              <TrackingTimeline steps={p.tracking?.steps || []} colors={COLORS} />
            </Box>
          ) : (
            <>
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1 }}>Ready to move forward?</Typography>
              <Typography sx={{ color: COLORS.muted, fontSize: 13, mb: 2 }}>
                Approve to lock this in for production. Request changes if anything needs to tweak.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                <Button onClick={handleApprove} disabled={actionBusy}
                  startIcon={actionBusy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CheckCircleOutlineIcon />}
                  sx={{ bgcolor: COLORS.brand, color: '#fff', fontWeight: 700, textTransform: 'none',
                    px: 3, py: 1.2, fontSize: 14, flex: 1,
                    '&:hover': { bgcolor: '#16352a' } }}>
                  Approve & proceed
                </Button>
                <Button onClick={() => setChangesOpen(true)} disabled={actionBusy}
                  startIcon={<EditNoteIcon />}
                  variant="outlined"
                  sx={{ borderColor: COLORS.border, color: COLORS.text, fontWeight: 700,
                    textTransform: 'none', px: 3, py: 1.2, fontSize: 14, flex: 1,
                    '&:hover': { borderColor: COLORS.text, bgcolor: '#fafaf8' } }}>
                  Request changes
                </Button>
              </Stack>
            </>
          )}
        </Box>
      </Box>

      <Dialog open={changesOpen} onClose={() => setChangesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Request changes</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: COLORS.muted, fontSize: 13, mb: 1.5 }}>
            What needs to be different? Be as specific as you'd like — colors, sizes, copy, anything.
          </Typography>
          <TextField fullWidth multiline minRows={4} autoFocus
            value={changesText} onChange={e => setChangesText(e.target.value)}
            placeholder="e.g. Move the back logo up a couple inches, change shirt color to forest green, swap the hoodie sizes M → L." />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setChangesOpen(false)} sx={{ color: COLORS.muted, textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleRequestChanges} disabled={actionBusy || !changesText.trim()}
            variant="contained"
            sx={{ bgcolor: COLORS.brand, color: '#fff', textTransform: 'none', fontWeight: 700,
              '&:hover': { bgcolor: '#16352a' } }}>
            {actionBusy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Send to team'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackingTimeline — the post-approval client view of where the project is.
// Each step is either complete (filled icon + timestamp) or pending (open
// circle). The vertical connector between dots shows green up to the last
// completed step so the progress is readable at a glance even on a phone.
// ─────────────────────────────────────────────────────────────────────────────
function TrackingTimeline({ steps, colors }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  // Find the index of the last completed step so the connector colors up to it.
  let lastDoneIdx = -1;
  steps.forEach((s, i) => { if (s.completedAt) lastDoneIdx = i; });

  const fmtWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  return (
    <Box sx={{ position: 'relative', maxWidth: 420, mx: 'auto', pl: 1 }}>
      {steps.map((s, i) => {
        const done = !!s.completedAt;
        const isLast = i === steps.length - 1;
        const connectorActive = i < lastDoneIdx;   // colored only if a LATER step is also done
        return (
          <Box key={s.id || i} sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative', pb: isLast ? 0 : 2.5 }}>
            {/* Vertical connector behind the dot */}
            {!isLast && (
              <Box sx={{
                position: 'absolute', left: 11, top: 22, bottom: -2, width: 2,
                bgcolor: connectorActive ? colors.brandH : colors.border,
                transition: 'background 0.4s ease',
              }} />
            )}
            {/* Dot / check */}
            <Box sx={{
              width: 24, height: 24, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, zIndex: 1,
              bgcolor: done ? colors.brandH : colors.panel,
              border: done ? `2px solid ${colors.brandH}` : `2px solid ${colors.border}`,
              color: done ? '#fff' : colors.muted,
              transition: 'all 0.3s ease',
            }}>
              {done
                ? <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                : <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} />}
            </Box>
            {/* Label + timestamp */}
            <Box sx={{ ml: 1.75, flex: 1, pt: 0.15 }}>
              <Typography sx={{
                fontSize: 14, fontWeight: done ? 700 : 600,
                color: done ? colors.text : colors.muted,
                lineHeight: 1.3,
              }}>
                {s.label}
              </Typography>
              <Typography sx={{
                fontSize: 11, mt: 0.25,
                color: done ? colors.brand : colors.muted,
                fontWeight: done ? 600 : 400,
              }}>
                {done ? fmtWhen(s.completedAt) : 'Pending'}
              </Typography>
              {done && s.note && (
                <Typography sx={{ fontSize: 11.5, color: colors.muted, mt: 0.3, lineHeight: 1.4 }}>
                  {s.note}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
