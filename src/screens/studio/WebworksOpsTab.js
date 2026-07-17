// src/screens/studio/WebworksOpsTab.js
//
// JP Webworks — Client Manager. The ops cockpit for the sites the brand actually
// runs: every client site with its lifecycle (draft → preview → live), a live-site
// up/down health probe, and the EDITS QUEUE — the client change requests ("move the
// hours up", "swap the hero photo") that the ongoing-care subscription pays for.
// This is the surface that finally joins a built site to the rest of the ecosystem:
// each site can carry a companyKey, so one tap opens its CRM company card.
//
// Reads /api/jpw/sites (admin). Reuses the premium `D` palette so it reads as part
// of the same Studio family as the CRM + Vendors cards. The Websites *builder* stays
// its own tool (JpwSitesTab); this is the run-it-day-to-day view.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, TextField, IconButton, Button, CircularProgress, Chip, Collapse,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import axios from 'axios';
import config from '../../config.json';
import { D, mono, eyebrow, scrollbar, dropInput } from './_shared';

const base = `${config.backendUrl}/api`;

const STATUS_META = {
  draft:   { label: 'Draft',   color: D.faint,  bg: 'rgba(255,255,255,0.05)' },
  preview: { label: 'Preview', color: D.amber || '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  live:    { label: 'Live',    color: D.green,  bg: 'rgba(74,222,128,0.12)' },
};
const HEALTH_COLOR = { ok: D.green, down: '#f87171', unknown: D.faint };
const EDIT_META = {
  open:        { label: 'Open',        color: D.amber || '#fbbf24' },
  in_progress: { label: 'In progress', color: '#54a6ff' },
  done:        { label: 'Done',        color: D.green },
};
// The next status when the owner advances an edit (open → in_progress → done → open).
const NEXT_STATUS = { open: 'in_progress', in_progress: 'done', done: 'open' };
const NEXT_LABEL = { open: 'Start', in_progress: 'Mark done', done: 'Reopen' };

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export default function WebworksOpsTab({ token, onBack, onNavigate }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [sites, setSites] = useState(null);
  const [expanded, setExpanded] = useState(null);   // site _id
  const [busy, setBusy] = useState('');
  const [draftEdit, setDraftEdit] = useState({});    // siteId -> new edit text
  const [draftKey, setDraftKey] = useState({});       // siteId -> companyKey being typed

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${base}/jpw/sites`, authHdr);
      setSites(Array.isArray(r.data && r.data.sites) ? r.data.sites : []);
    } catch (e) { setBusy(e.response?.data?.message || e.message); setSites([]); }
  }, [authHdr]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!busy || String(busy).endsWith('…')) return undefined;
    const t = setTimeout(() => setBusy(''), 5000);
    return () => clearTimeout(t);
  }, [busy]);

  // Patch a single site in place from an API response, so the expanded card
  // updates without a full reload flicker.
  const replaceSite = (site) => {
    if (!site) return;
    const openEdits = (site.edits || []).filter((e) => e.status !== 'done').length;
    setSites((prev) => (prev || []).map((s) => (s._id === site._id ? { ...site, openEdits } : s)));
  };

  const addEdit = async (id) => {
    const body = (draftEdit[id] || '').trim();
    if (!body) return;
    setBusy('Adding…');
    try {
      const r = await axios.post(`${base}/jpw/sites/${id}/edits`, { body, source: 'owner' }, authHdr);
      replaceSite(r.data && r.data.site);
      setDraftEdit((p) => ({ ...p, [id]: '' }));
      setBusy('Edit added ✓');
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };

  const advanceEdit = async (id, edit) => {
    setBusy('Updating…');
    try {
      const r = await axios.put(`${base}/jpw/sites/${id}/edits/${edit._id}`, { status: NEXT_STATUS[edit.status] }, authHdr);
      replaceSite(r.data && r.data.site);
      setBusy('');
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };

  const runHealth = async (id) => {
    setBusy('Checking…');
    try {
      const r = await axios.post(`${base}/jpw/sites/${id}/health-check`, {}, authHdr);
      replaceSite(r.data && r.data.site);
      setBusy('Health checked ✓');
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };

  const linkCompany = async (id) => {
    const companyKey = (draftKey[id] || '').trim();
    setBusy('Linking…');
    try {
      const r = await axios.put(`${base}/jpw/sites/${id}`, { companyKey }, authHdr);
      replaceSite(r.data && r.data.site);
      setBusy('Company linked ✓');
    } catch (e) { setBusy(e.response?.data?.message || e.message); }
  };

  const list = sites || [];
  const totals = {
    live: list.filter((s) => s.status === 'live').length,
    preview: list.filter((s) => s.status === 'preview').length,
    openEdits: list.reduce((n, s) => n + (s.openEdits || 0), 0),
  };

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 1.5, md: 2 }, py: 2, ...scrollbar }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        {onBack && (
          <IconButton onClick={onBack} size="small" sx={{ color: D.muted, '&:hover': { color: D.text } }}>
            <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <LanguageOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18, flex: 1 }}>
          Client Manager <Box component="span" sx={{ color: D.faint, fontWeight: 600, fontSize: 13 }}>· JP Webworks</Box>
        </Typography>
        <Typography sx={{ color: D.faint, fontSize: 12 }}>
          {totals.live} live · {totals.preview} preview{totals.openEdits ? ` · ${totals.openEdits} open edit${totals.openEdits === 1 ? '' : 's'}` : ''}
        </Typography>
      </Stack>

      {busy && <Typography sx={{ color: busy.includes('✓') ? D.green : D.amber || '#fbbf24', fontSize: 12, mb: 1 }}>{busy}</Typography>}

      {sites === null ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress size={28} sx={{ color: D.green }} /></Box>
      ) : list.length === 0 ? (
        <Typography sx={{ color: D.faint, fontSize: 13, py: 4, textAlign: 'center' }}>
          No client sites yet — build one in the Websites tool and it shows up here to manage.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {list.map((s) => {
            const sm = STATUS_META[s.status] || STATUS_META.draft;
            const isOpen = expanded === s._id;
            const edits = (s.edits || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const previewHref = `/webworks/p/${s.slug}`;
            const liveHref = s.domain ? `https://${s.domain}` : null;
            return (
              <Box key={s._id} sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2 }}>
                {/* Row */}
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ p: 1.5, cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : s._id)}>
                  <Box sx={{ px: 1, py: 0.3, borderRadius: 1, bgcolor: sm.bg, flexShrink: 0 }}>
                    <Typography sx={{ color: sm.color, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{sm.label}</Typography>
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: D.text, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                      <Box component="span" sx={{ ...mono, color: D.faint, fontSize: 11, fontWeight: 600, ml: 0.75 }}>/{s.slug}</Box>
                    </Typography>
                    {s.domain && <Typography sx={{ color: D.faint, fontSize: 10.5 }}>{s.domain}</Typography>}
                  </Box>
                  {s.status === 'live' && (
                    <Box title={`Health: ${s.health?.status || 'unknown'}`} sx={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, bgcolor: HEALTH_COLOR[s.health?.status] || D.faint }} />
                  )}
                  {s.openEdits > 0 && (
                    <Chip size="small" label={`${s.openEdits} edit${s.openEdits === 1 ? '' : 's'}`}
                      sx={{ height: 20, bgcolor: 'rgba(251,191,36,0.12)', color: D.amber || '#fbbf24', fontWeight: 700, fontSize: 10.5 }} />
                  )}
                  <ChevronRightIcon sx={{ color: D.faint, fontSize: 18, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
                </Stack>

                <Collapse in={isOpen} unmountOnExit>
                  <Box sx={{ px: 1.5, pb: 1.75, pt: 0.5, borderTop: `1px solid ${D.line}` }}>
                    {/* Links + company + health actions */}
                    <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ mb: 1.5, mt: 1 }}>
                      <Button component="a" href={previewHref} target="_blank" rel="noreferrer" size="small"
                        endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                        sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 11.5, '&:hover': { color: D.green } }}>Preview</Button>
                      {liveHref && (
                        <Button component="a" href={liveHref} target="_blank" rel="noreferrer" size="small"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                          sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 11.5, '&:hover': { color: D.green } }}>Visit live</Button>
                      )}
                      {s.companyKey && onNavigate && (
                        <Button onClick={() => onNavigate({ view: 'crm', companyKey: s.companyKey })} size="small"
                          sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11.5 }}>Open company →</Button>
                      )}
                      {s.status === 'live' && (
                        <Button onClick={() => runHealth(s._id)} size="small" startIcon={<FavoriteBorderOutlinedIcon sx={{ fontSize: 14 }} />}
                          sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 11.5, '&:hover': { color: D.green } }}>
                          Health check
                        </Button>
                      )}
                    </Stack>
                    {s.status === 'live' && s.health?.lastCheckedAt && (
                      <Typography sx={{ color: HEALTH_COLOR[s.health.status] || D.faint, fontSize: 11, mb: 1.5 }}>
                        {s.health.status === 'ok' ? 'Up' : s.health.status === 'down' ? 'Down' : 'Unknown'}
                        {s.health.httpStatus ? ` (HTTP ${s.health.httpStatus})` : ''} · checked {fmtDate(s.health.lastCheckedAt)}
                        {s.health.note ? ` · ${s.health.note}` : ''}
                      </Typography>
                    )}

                    {/* Link to a CRM company (the spine) */}
                    {!s.companyKey && (
                      <Stack direction="row" gap={1} sx={{ mb: 1.5 }} alignItems="center">
                        <TextField size="small" placeholder="Link to CRM company key…" value={draftKey[s._id] || ''}
                          onChange={(e) => setDraftKey((p) => ({ ...p, [s._id]: e.target.value }))}
                          sx={{ ...dropInput, flex: 1 }} InputLabelProps={{ sx: { color: D.muted } }} />
                        <Button onClick={() => linkCompany(s._id)} disabled={!(draftKey[s._id] || '').trim()} size="small"
                          sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11.5 }}>Link</Button>
                      </Stack>
                    )}

                    {/* Edits queue */}
                    <Typography sx={{ ...eyebrow, color: D.faint, fontSize: 10, letterSpacing: 1, mb: 0.75 }}>
                      Edits queue
                    </Typography>
                    <Stack spacing={0.5} sx={{ mb: 1 }}>
                      {edits.length === 0 && <Typography sx={{ color: D.faint, fontSize: 12 }}>No change requests logged.</Typography>}
                      {edits.map((e) => {
                        const em = EDIT_META[e.status] || EDIT_META.open;
                        return (
                          <Stack key={e._id} direction="row" alignItems="flex-start" spacing={1}
                            sx={{ py: 0.6, borderTop: `1px solid ${D.line}`, '&:first-of-type': { borderTop: 'none' } }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ color: e.status === 'done' ? D.faint : D.text, fontSize: 12.5, textDecoration: e.status === 'done' ? 'line-through' : 'none', lineHeight: 1.4 }}>
                                {e.body}
                              </Typography>
                              <Typography sx={{ color: D.faint, fontSize: 10 }}>
                                <Box component="span" sx={{ color: em.color, fontWeight: 700 }}>{em.label}</Box>
                                {' · '}{e.source}{' · '}{fmtDate(e.createdAt)}
                              </Typography>
                            </Box>
                            <Button onClick={() => advanceEdit(s._id, e)} size="small"
                              sx={{ color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 10.5, minWidth: 0, px: 0.75, flexShrink: 0, '&:hover': { color: D.green } }}>
                              {NEXT_LABEL[e.status]}
                            </Button>
                          </Stack>
                        );
                      })}
                    </Stack>
                    <Stack direction="row" gap={1} alignItems="center">
                      <TextField size="small" placeholder="Log a change request…" value={draftEdit[s._id] || ''}
                        onChange={(e) => setDraftEdit((p) => ({ ...p, [s._id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') addEdit(s._id); }}
                        sx={{ ...dropInput, flex: 1 }} InputLabelProps={{ sx: { color: D.muted } }} />
                      <Button onClick={() => addEdit(s._id)} disabled={!(draftEdit[s._id] || '').trim()} size="small"
                        startIcon={<AddCircleOutlineIcon sx={{ fontSize: 15 }} />}
                        sx={{ color: D.green, textTransform: 'none', fontWeight: 800, fontSize: 11.5 }}>Add</Button>
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
