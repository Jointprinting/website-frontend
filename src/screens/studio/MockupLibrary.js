// src/screens/studio/MockupLibrary.js
//
// The React home of the Mockup Studio — the "memory" view, and the first piece
// of moving the studio out of the standalone /jpstudio app into the verifiable
// React ecosystem. It lists every saved mockup from /api/studio/library/mockups,
// searchable and grouped by client, and — the part the standalone app never had —
// DEEP-LINKS each mockup to its CRM client card and its order/project, so a
// mockup is no longer a dead-end. The actual mockup *maker* (the canvas editor)
// still opens in the standalone studio via "Open editor" for now; it moves into
// React next.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, CircularProgress, TextField, InputAdornment,
  Button, Tooltip,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import axios from 'axios';
import config from '../../config.json';
import { D, mono, scrollbar } from './_shared';

const base = `${config.backendUrl}/api/studio`;
// MUST match the company-key convention used everywhere else (lowercased alphanumerics).
const deriveCompanyKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const onlyDigits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
const norm = (s) => String(s || '').toLowerCase();

// A clickable chip linking a mockup onward into the ecosystem (CRM card / order).
function LinkChip({ icon, label, onClick, color }) {
  if (!label) return null;
  return (
    <Box
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4, maxWidth: '100%',
        px: 0.75, py: '2px', borderRadius: 1, cursor: 'pointer',
        bgcolor: D.inset, border: `1px solid ${D.line}`, color: color || D.muted,
        fontSize: 11, fontWeight: 700, minWidth: 0,
        '&:hover': { borderColor: color || D.lineHi, color: color || D.text, bgcolor: 'rgba(255,255,255,0.04)' },
      }}
    >
      {icon}
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Box>
    </Box>
  );
}

function MockupCard({ it, onClient, onOrder, onOpenEditor }) {
  const num = it.pageState?.mockupNum || '';
  const project = onlyDigits(it.pageState?.projectNumber);
  const client = (it.client || '').trim();
  return (
    <Box sx={{
      border: `1px solid ${D.line}`, borderRadius: 2.5, overflow: 'hidden', bgcolor: D.panel,
      display: 'flex', flexDirection: 'column',
      transition: 'border-color 0.15s ease, transform 0.15s ease',
      '&:hover': { borderColor: D.lineHi, transform: 'translateY(-2px)' },
    }}>
      {/* Thumbnail */}
      <Box
        onClick={onOpenEditor}
        title="Open in the editor"
        sx={{
          position: 'relative', aspectRatio: '1 / 1', bgcolor: D.inset, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        {it.thumbnail ? (
          <Box component="img" src={it.thumbnail} alt={it.name || 'mockup'} loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 1 }} />
        ) : (
          <ImageOutlinedIcon sx={{ fontSize: 34, color: D.faint }} />
        )}
        {num && (
          <Box sx={{ position: 'absolute', top: 8, left: 8, px: 0.75, py: '2px', borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.55)', color: D.green, ...mono, fontSize: 11, fontWeight: 800 }}>
            #{num}
          </Box>
        )}
      </Box>
      {/* Meta */}
      <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75, flexGrow: 1 }}>
        <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700, lineHeight: 1.25,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {it.name || 'Untitled mockup'}
        </Typography>
        <Stack direction="row" gap={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 'auto' }}>
          <LinkChip icon={<StorefrontOutlinedIcon sx={{ fontSize: 13 }} />} label={client}
            color={D.green} onClick={() => onClient(client)} />
          <LinkChip icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 13 }} />} label={project ? `#${project}` : ''}
            onClick={() => onOrder(project)} />
        </Stack>
      </Box>
    </Box>
  );
}

export default function MockupLibrary({ token, onBack, onNavigate }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [grouped, setGrouped] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await axios.get(`${base}/library/mockups?summary=1`, authHdr);
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch (e) { setErr(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  }, [authHdr]);
  useEffect(() => { load(); }, [load]);

  const openEditor = () => window.open(`/jpstudio/?t=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');

  const filtered = useMemo(() => {
    const term = norm(q).trim();
    if (!term) return items;
    return items.filter((it) =>
      norm(it.name).includes(term) || norm(it.client).includes(term)
      || norm(it.pageState?.mockupNum).includes(term));
  }, [items, q]);

  const groups = useMemo(() => {
    if (!grouped) return [['', filtered]];
    const m = new Map();
    filtered.forEach((it) => {
      const c = (it.client || '').trim() || '—';
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(it);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, grouped]);

  const goClient = (client) => {
    const ck = deriveCompanyKey(client);
    if (ck && onNavigate) onNavigate({ view: 'crm', companyKey: ck });
  };
  const goOrder = (project) => {
    const n = onlyDigits(project);
    if (n && onNavigate) onNavigate({ view: 'clients', projectNumber: n });
  };

  const gridSx = {
    display: 'grid', gap: 1.5,
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 1.5, md: 0 }, py: 1 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={onBack} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18, flex: 1 }}>
          Mockups <Box component="span" sx={{ color: D.faint, fontWeight: 600, fontSize: 14, ml: 0.5 }}>{items.length}</Box>
        </Typography>
        <Button onClick={openEditor} startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
          sx={{ bgcolor: D.green, color: D.ink, textTransform: 'none', fontWeight: 800, borderRadius: 999, px: 2,
            '&:hover': { bgcolor: '#5cec8e' } }}>
          Open editor
        </Button>
      </Stack>

      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <TextField
          value={q} onChange={(e) => setQ(e.target.value)} size="small" fullWidth
          placeholder="Search by mockup #, name, or client…"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: D.faint }} /></InputAdornment> }}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: D.inset, color: D.text, fontSize: 13,
            '& fieldset': { borderColor: D.line }, '&:hover fieldset': { borderColor: D.lineHi } } }}
        />
        <Tooltip title={grouped ? 'Grouped by client' : 'Flat grid'}>
          <IconButton onClick={() => setGrouped((g) => !g)} size="small"
            sx={{ color: grouped ? D.green : D.muted, border: `1px solid ${D.line}`, borderRadius: 2,
              '&:hover': { color: D.text, borderColor: D.lineHi } }}>
            {grouped ? <ViewAgendaOutlinedIcon sx={{ fontSize: 18 }} /> : <GridViewOutlinedIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Stack>

      {err && <Typography sx={{ color: '#fbbf24', fontSize: 12.5, mb: 1.5 }}>{err}</Typography>}

      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress sx={{ color: D.green }} /></Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <ImageOutlinedIcon sx={{ fontSize: 36, color: D.faint, mb: 1 }} />
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16 }}>
            {items.length === 0 ? 'No mockups yet' : 'No matches'}
          </Typography>
          <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 0.5 }}>
            {items.length === 0 ? 'Build one in the editor and it shows up here.' : 'Try a different search.'}
          </Typography>
        </Box>
      ) : grouped ? (
        <Stack gap={3} sx={{ ...scrollbar }}>
          {groups.map(([client, list]) => (
            <Box key={client || '—'}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
                <Typography
                  onClick={() => client && client !== '—' && goClient(client)}
                  sx={{ color: D.text, fontWeight: 800, fontSize: 13.5,
                    cursor: client && client !== '—' ? 'pointer' : 'default',
                    '&:hover': client && client !== '—' ? { color: D.green } : {} }}>
                  {client || '—'}
                </Typography>
                <Typography sx={{ ...mono, color: D.faint, fontSize: 11 }}>{list.length}</Typography>
              </Stack>
              <Box sx={gridSx}>
                {list.map((it) => (
                  <MockupCard key={it._id || it.remoteId} it={it} onClient={goClient} onOrder={goOrder} onOpenEditor={openEditor} />
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <Box sx={gridSx}>
          {filtered.map((it) => (
            <MockupCard key={it._id || it.remoteId} it={it} onClient={goClient} onOrder={goOrder} onOpenEditor={openEditor} />
          ))}
        </Box>
      )}
    </Box>
  );
}
