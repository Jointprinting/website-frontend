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

const _norm = (n) => String(n || '').replace(/^#/, '').replace(/^0+/, '').toUpperCase();

// Mirror the server PDF's confirmation totals: percent custom-lines apply to
// the running subtotal, in order.
function computeConfTotals(conf) {
  const items = Array.isArray(conf?.items) ? conf.items : [];
  const itemsSubtotal = items.reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0), 0);
  let running = itemsSubtotal;
  const lines = (conf?.customLines || []).map(l => {
    const isPct = !!l.isPercent;
    const amt = Number(l.amount) || 0;
    const value = isPct ? running * amt / 100 : amt;
    running += value;
    const base = l.label || (isPct ? 'Adjustment' : 'Add-on');
    return { label: isPct ? `${base} - ${amt}%` : base, value };
  });
  return { itemsSubtotal, lines, grandTotal: running };
}

function confItemTitle(it, idx) {
  const productLabel = it.productName || it.brandName || '';
  const head = productLabel && it.styleCode ? `${productLabel} (${it.styleCode})` : (productLabel || it.styleCode);
  return [head, it.color, it.printType].filter(Boolean).join(' · ') || `Item ${idx + 1}`;
}

export default function ApprovalView() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  // Admin "preview as client" mode (?preview=1): renders the client review
  // exactly as they see it, but read-only — actions disabled, no view logged,
  // and the pre-approval layout shows even after the order is approved/locked.
  const isPreview = params.get('preview') === '1';

  const [data, setData]   = useState(null);
  const [err, setErr]     = useState('');
  const [errReason, setErrReason] = useState('');   // '' | 'expired' | 'invalid'
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesText, setChangesText] = useState('');
  const [name, setName] = useState('');          // optional — so we know who on the team acted
  const [email, setEmail] = useState('');        // optional — so we know which email approved
  const [lockedNote, setLockedNote] = useState(''); // friendly note when someone else just decided

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
          `${config.backendUrl}/api/public/projects/${projectId}?token=${encodeURIComponent(token)}${isPreview ? '&preview=1' : ''}`);
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
  }, [projectId, token, isPreview]);

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
    if (approvalStatus !== 'approved' || isPreview) return;
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
    // Preview renders the client's page 1:1; intercept the action so the admin
    // can't approve on the client's behalf.
    if (isPreview) { alert("Preview only — this is exactly what your client sees. Approve / Request changes work on the real link, not in preview."); return; }
    setActionBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/approve?token=${encodeURIComponent(token)}`,
        { name: name.trim(), email: email.trim() });
      await refresh();
    } catch (e) {
      // 409 = someone on the team already approved or sent it back. Not an
      // error from this person's point of view — just refresh into the locked
      // state and show the friendly note instead of a scary alert.
      if (e.response?.status === 409) {
        setLockedNote(e.response.data?.message || '');
        await refresh();
      } else {
        alert(e.response?.data?.message || "That didn't go through — please try again, or just reply to our email and we'll take care of it.");
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleRequestChanges = async () => {
    if (isPreview) { setChangesOpen(false); alert("Preview only — this is exactly what your client sees. Approve / Request changes work on the real link, not in preview."); return; }
    setActionBusy(true);
    try {
      await axios.post(`${config.backendUrl}/api/public/projects/${projectId}/feedback?token=${encodeURIComponent(token)}`,
        { message: changesText, name: name.trim(), email: email.trim() });
      setChangesOpen(false);
      setChangesText('');
      await refresh();
    } catch (e) {
      if (e.response?.status === 409) {
        setChangesOpen(false);
        setLockedNote(e.response.data?.message || '');
        await refresh();
      } else {
        alert(e.response?.data?.message || "We couldn't send your notes just now — please try again, or reply to our email and we'll pick it up there.");
      }
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
        // unitPrice arrives resolved from the server — the public payload
        // carries no cost/markup fields to derive from (by design: those
        // are internal margin data).
        const q    = Number(l.qty) || 0;
        const unit = Number(l.unitPrice) || 0;
        const desc = [l.styleCode, l.description, l.color, l.printType && `(${l.printType}${l.printDetails ? ' · ' + l.printDetails : ''})`]
          .filter(Boolean).join(' · ');
        return { qty: l.qty, description: desc, unitPrice: unit, lineTotal: q * unit };
      })
    : items.map(i => ({
        qty: i.qty, description: i.description,
        unitPrice: i.unitPrice,
        lineTotal: (Number(i.qty) || 0) * (Number(i.unitPrice) || 0),
      }));
  const subtotal = itemRows.reduce((s, r) => s + (Number(r.lineTotal) || 0), 0);
  const total = Number(p.totalValue) || subtotal;

  // Full confirmation (matches the downloadable PDF) when one's been built.
  const conf = p.confirmation || {};
  const confItems = Array.isArray(conf.items) ? conf.items : [];
  const hasConf = confItems.length > 0;
  const confTotals = computeConfTotals(conf);
  const mockupByNum = {};
  mockups.forEach(m => { const k = _norm(m.mockupNum); if (k) mockupByNum[k] = { front: m.thumbnail, back: m.back }; });
  // Per-item image: explicit snapshot → legacy single → the referenced mockup's
  // thumbnail (matched by #). Same resolution order the PDF uses, so every
  // colorway shows its own photo.
  const confItemImages = (it) => {
    const snaps = (it.mockupSnapshots || []).map(s => s && s.dataUrl).filter(Boolean);
    if (snaps.length) return snaps;
    if (it.customMockupDataUrl) return [it.customMockupDataUrl];
    const lib = it.mockupNum ? mockupByNum[_norm(it.mockupNum)] : null;
    return lib ? [lib.front, lib.back].filter(Boolean) : [];   // front + back when the mockup has both
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, color: COLORS.text, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <Box sx={{ maxWidth: 820, mx: 'auto', p: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Box sx={{ bgcolor: COLORS.panel, p: { xs: 2.5, md: 4 }, borderRadius: 2, boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          <Stack direction="row" alignItems="center" gap={2} mb={2}>
            {logo && (
              <Box sx={{ width: 56, height: 56, p: 0.5, bgcolor: '#fff', border: `1px solid ${COLORS.border}`,
                borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Box component="img" src={logo} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
                    p.orderDate ? new Date(p.orderDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : null,
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

        {/* Mockups — only when there's no full confirmation; otherwise each
            item below shows its own photo (one per colorway), matching the PDF. */}
        {!hasConf && mockups.length > 0 && (
          <Box sx={{ bgcolor: COLORS.panel, p: { xs: 2.5, md: 4 }, borderRadius: 2, mt: 2, boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
            <Typography sx={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
              Mockups
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {mockups.map((m, i) => (
                <Box key={i} sx={{ aspectRatio: '4/3', bgcolor: '#f4f4f4', borderRadius: 1, overflow: 'hidden' }}>
                  {m.thumbnail && <Box component="img" src={m.thumbnail} alt={m.name} loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Order details — the full confirmation (matches the downloadable PDF)
            when one's been built; otherwise the simpler quote table. */}
        {hasConf ? (
          <Box sx={{ bgcolor: COLORS.panel, p: { xs: 2.5, md: 4 }, borderRadius: 2, mt: 2, boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
            <Typography sx={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
              Order details
            </Typography>
            {confItems.map((it, idx) => {
              const sizes = (it.sizes || []).filter(sz => Number(sz.qty) > 0);
              const itemSubtotal = sizes.reduce((s, sz) => s + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0);
              const imgs = confItemImages(it);
              return (
                <Box key={idx} sx={{ py: 2.5, borderTop: idx ? `1px solid ${COLORS.border}` : 'none' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>{confItemTitle(it, idx)}</Typography>
                  {imgs.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
                      {imgs.map((src, i) => (
                        <Box key={i} component="img" src={src} alt="" loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          sx={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${COLORS.border}`, bgcolor: '#f4f4f4' }} />
                      ))}
                    </Box>
                  )}
                  {sizes.length > 0 && (
                    <Box component="table" sx={{ width: '100%', maxWidth: 400, borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left',  fontSize: 10, textTransform: 'uppercase', color: COLORS.muted, padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Size</th>
                          <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: COLORS.muted, padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Qty</th>
                          <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: COLORS.muted, padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}` }}>Unit price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sizes.map((sz, i) => (
                          <tr key={i}>
                            <td style={{ padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}` }}>{sz.label || '—'}</td>
                            <td style={{ padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>{Number(sz.qty) || 0}</td>
                            <td style={{ padding: '5px 8px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>{sz.unitPrice ? money(sz.unitPrice) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Box>
                  )}
                  <Typography sx={{ textAlign: 'right', fontSize: 13, fontWeight: 700, mt: 1 }}>
                    Item subtotal&nbsp;&nbsp;{money(itemSubtotal)}
                  </Typography>
                </Box>
              );
            })}
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${COLORS.border}` }}>
              <Stack direction="row" justifyContent="flex-end" gap={4} sx={{ fontSize: 13, mb: 0.5 }}>
                <Box sx={{ color: COLORS.muted }}>Subtotal</Box>
                <Box sx={{ minWidth: 96, textAlign: 'right' }}>{money(confTotals.itemsSubtotal)}</Box>
              </Stack>
              {confTotals.lines.map((l, i) => (
                <Stack key={i} direction="row" justifyContent="flex-end" gap={4} sx={{ fontSize: 13, mb: 0.5 }}>
                  <Box sx={{ color: COLORS.muted }}>{l.label}</Box>
                  <Box sx={{ minWidth: 96, textAlign: 'right' }}>{money(l.value)}</Box>
                </Stack>
              ))}
              <Stack direction="row" justifyContent="flex-end" alignItems="baseline" gap={4} sx={{ mt: 1, pt: 1, borderTop: '2px solid #111' }}>
                <Box sx={{ fontWeight: 800, fontSize: 18 }}>Total</Box>
                <Box sx={{ minWidth: 96, textAlign: 'right', fontWeight: 800, fontSize: 18, color: COLORS.brand }}>{money(confTotals.grandTotal)}</Box>
              </Stack>
            </Box>
            {p.confirmationTerms && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${COLORS.border}` }}>
                <Typography sx={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Terms</Typography>
                <Typography sx={{ color: COLORS.muted, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{p.confirmationTerms}</Typography>
              </Box>
            )}
          </Box>
        ) : (
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
        )}

        {/* Action panel — locked once the client has either approved OR
            requested changes, so the link stays consistent on every reload. */}
        <Box sx={{ bgcolor: COLORS.panel, p: { xs: 2.5, md: 3 }, borderRadius: 2, mt: 2, boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          {approvalStatus === 'requested_changes' ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <EditNoteIcon sx={{ color: '#fbbf24', fontSize: 40, mb: 1 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Thanks — we&apos;re on it.</Typography>
              <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.5 }}>
                Your notes are with our team, and we&apos;ll get a fresh proof over to you soon.
              </Typography>
              {(p.approvalBy || p.approvalAt) && (
                <Typography sx={{ color: COLORS.muted, fontSize: 11, mt: 1.5 }}>
                  {p.approvalBy ? `Sent by ${p.approvalBy}` : 'Sent'}{p.approvalAt ? ` · ${new Date(p.approvalAt).toLocaleString()}` : ''}
                </Typography>
              )}
            </Box>
          ) : approvalStatus === 'approved' ? (
            <Box sx={{ py: 1 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <CheckCircleOutlineIcon sx={{ color: COLORS.brandH, fontSize: 36, mb: 0.5 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 18 }}>You&apos;re all set — thank you!</Typography>
                <Typography sx={{ color: COLORS.muted, fontSize: 13, mt: 0.5 }}>
                  {p.approvalBy ? `Approved by ${p.approvalBy}. ` : ''}We&apos;ll move through the steps below and keep this page updated as each one happens.
                </Typography>
              </Box>
              <TrackingTimeline steps={p.tracking?.steps || []} colors={COLORS} />
            </Box>
          ) : (
            <>
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1 }}>Take a look whenever you&apos;re ready</Typography>
              <Typography sx={{ color: COLORS.muted, fontSize: 13, mb: 2 }}>
                If everything looks good, hit approve and we&apos;ll get started. If anything needs a tweak, just send it back — we&apos;re always happy to adjust.
              </Typography>
              {lockedNote && (
                <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: '#fff8e1', border: '1px solid #fde68a' }}>
                  <Typography sx={{ color: '#92400e', fontSize: 13, lineHeight: 1.5 }}>{lockedNote}</Typography>
                </Box>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ mb: 1.5 }}>
                <TextField fullWidth size="small" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name (optional)" />
                <TextField fullWidth size="small" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Your email (optional — so we know who approved)" />
              </Stack>
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
            What would you like changed? Be as specific as you like — colors, sizes, copy, anything at all.
          </Typography>
          <TextField fullWidth size="small" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name (optional)" sx={{ mb: 1.5 }} />
          <TextField fullWidth size="small" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Your email (optional)" sx={{ mb: 1.5 }} />
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
// TrackingTimeline — post-approval client view of where the project is.
// Renders inside a styled card with the JP brand mark at the top so the
// post-approval page doesn't read as empty. Includes a top progress meter
// (X of Y steps complete) and a per-step optional carrier link the admin can
// attach from the Order Tracker (rendered as a "Track shipment →" button).
// ─────────────────────────────────────────────────────────────────────────────
function TrackingTimeline({ steps, colors, logo }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  // Find the index of the last completed step so the connector colors up to it.
  let lastDoneIdx = -1;
  steps.forEach((s, i) => { if (s.completedAt) lastDoneIdx = i; });
  const doneCount = steps.filter(s => s.completedAt).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

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
    <Box sx={{
      mt: 1, p: { xs: 2.5, sm: 3.5 },
      bgcolor: '#fafaf7',
      border: `1px solid ${colors.border}`,
      borderRadius: 2,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle brand stripe at the top so the card has a tiny accent without
          shouting. */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${colors.brand} 0%, ${colors.brandH} 100%)`,
      }} />

      {/* Header: small mark + "Project status" label + progress count */}
      <Stack direction="row" alignItems="center" gap={1.25} mb={1.75}>
        <Box sx={{
          width: 28, height: 28, borderRadius: 1,
          bgcolor: colors.brand, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontWeight: 800, fontSize: 13, letterSpacing: 0.5,
        }}>
          JP
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontSize: 11, color: colors.muted, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 1,
          }}>
            Project status
          </Typography>
          <Typography sx={{ fontSize: 13, color: colors.text, fontWeight: 700, mt: 0.3 }}>
            {doneCount} of {steps.length} steps complete
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: colors.brand, letterSpacing: -0.5 }}>
          {progressPct}%
        </Typography>
      </Stack>

      {/* Slim progress bar — visual reinforcement of the % count. */}
      <Box sx={{
        height: 4, borderRadius: 999, bgcolor: colors.border,
        overflow: 'hidden', mb: 2.5,
      }}>
        <Box sx={{
          width: `${progressPct}%`, height: '100%',
          background: `linear-gradient(90deg, ${colors.brand} 0%, ${colors.brandH} 100%)`,
          transition: 'width 0.5s ease',
        }} />
      </Box>

      {/* Steps */}
      <Box sx={{ position: 'relative', pl: 0.5 }}>
        {steps.map((s, i) => {
          const done = !!s.completedAt;
          const isLast = i === steps.length - 1;
          const connectorActive = i < lastDoneIdx;
          return (
            <Box key={s.id || i} sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative', pb: isLast ? 0 : 2.25 }}>
              {!isLast && (
                <Box sx={{
                  position: 'absolute', left: 11, top: 22, bottom: -2, width: 2,
                  bgcolor: connectorActive ? colors.brandH : colors.border,
                  transition: 'background 0.4s ease',
                }} />
              )}
              <Box sx={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, zIndex: 1,
                bgcolor: done ? colors.brandH : '#fff',
                border: done ? `2px solid ${colors.brandH}` : `2px solid ${colors.border}`,
                color: done ? '#fff' : colors.muted,
                transition: 'all 0.3s ease',
              }}>
                {done
                  ? <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                  : <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} />}
              </Box>
              <Box sx={{ ml: 1.75, flex: 1, pt: 0.15, minWidth: 0 }}>
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
                {/* Optional carrier / tracking link — admin attaches a URL on
                    a step (typically "Blanks shipping" or "On the way to you")
                    and we surface it as a clear, clickable pill here. */}
                {s.link && /^https?:\/\//i.test(s.link) && (
                  <Box
                    component="a" href={s.link} target="_blank" rel="noopener noreferrer"
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      mt: 0.6, px: 1.2, py: 0.35, borderRadius: 999,
                      bgcolor: 'rgba(74,222,128,0.12)',
                      color: colors.brand, textDecoration: 'none',
                      fontSize: 11, fontWeight: 700,
                      border: `1px solid ${colors.brandH}`,
                      transition: 'background 0.15s ease, transform 0.15s ease',
                      '&:hover': {
                        bgcolor: 'rgba(74,222,128,0.22)',
                        transform: 'translateY(-1px)',
                      },
                    }}>
                    Track shipment →
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Tiny footer reassurance — only when there's still work to do */}
      {doneCount < steps.length && (
        <Typography sx={{
          mt: 2.5, pt: 1.5, borderTop: `1px solid ${colors.border}`,
          fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 1.5,
        }}>
          We update this page as each step happens — usually within a day of the milestone.
          {logo ? '' : ' Questions? Reply to the email we sent you.'}
        </Typography>
      )}
    </Box>
  );
}
