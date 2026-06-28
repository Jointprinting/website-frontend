// src/screens/studio/SSBlankPicker.js
//
// S&S Activewear blank search for the mockup maker. Search the synced product
// catalog (/api/products), open a style, pick a COLOR — and the maker drops that
// color's front AND back garment images straight onto the front/back sides in one
// go. The images come back as GridFS data-URLs (same-origin), so the editor's
// canvas stays untainted when it flattens. The "color variants + back side"
// parity pieces, wired through the catalog the rest of the app already syncs.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, TextField, InputAdornment, CircularProgress, Dialog, DialogContent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import axios from 'axios';
import config from '../../config.json';
import { D, mono, scrollbar, useMobileFullScreen } from './_shared';

const pbase = `${config.backendUrl}/api/products`;

export default function SSBlankPicker({ open, token, onPick, onClose }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const fullScreen = useMobileFullScreen();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState(null);          // selected product, full color arrays
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Reset to the search view whenever the dialog reopens.
  useEffect(() => { if (open) { setDetail(null); setErr(''); } }, [open]);

  // Debounced search over the synced catalog.
  useEffect(() => {
    if (!open || detail) return;
    const term = q.trim();
    if (!term) { setResults([]); return; }
    let cancelled = false;
    setLoading(true); setErr('');
    const t = setTimeout(() => {
      axios.get(`${pbase}`, { ...authHdr, params: { search: term, limit: 24 } })
        .then((r) => { if (!cancelled) setResults(Array.isArray(r.data && r.data.products) ? r.data.products : []); })
        .catch((e) => { if (!cancelled) setErr(e.response?.data?.message || e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open, detail, authHdr]);

  const openProduct = async (p) => {
    setLoadingDetail(true); setErr('');
    try {
      const r = await axios.get(`${pbase}/${p._id}`, authHdr);
      setDetail(r.data || null);
    } catch (e) { setErr(e.response?.data?.message || e.message); }
    finally { setLoadingDetail(false); }
  };

  // Pair each color with its front/back image. Only colors that actually have a
  // front image are offered (you can't drop a blank you don't have a picture of).
  const colorRows = useMemo(() => {
    if (!detail) return [];
    const colors = detail.colors || [];
    const fronts = detail.productFrontImages || [];
    const backs = detail.productBackImages || [];
    const n = Math.max(colors.length, fronts.length);
    const rows = [];
    for (let i = 0; i < n; i += 1) {
      const front = fronts[i];
      if (!front) continue;
      rows.push({ color: colors[i] || `Color ${i + 1}`, front, back: backs[i] || null });
    }
    return rows;
  }, [detail]);

  const choose = (row) => {
    const label = [detail.name || detail.style, row.color].filter(Boolean).join(' — ');
    onPick({ front: row.front, back: row.back, name: label, style: detail.style || '', color: row.color });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: fullScreen ? 0 : 3, backgroundImage: 'none' } }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${D.line}` }}>
        {detail && (
          <IconButton size="small" onClick={() => setDetail(null)} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
            <ArrowBackIosNewIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15, flex: 1 }}>
          {detail ? (detail.name || detail.style || 'Pick a color') : 'Search S&S blanks'}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: D.muted, '&:hover': { color: D.text } }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </Stack>

      {!detail && (
        <Box sx={{ px: 2, pt: 1.5 }}>
          <TextField value={q} onChange={(e) => setQ(e.target.value)} size="small" fullWidth autoFocus
            placeholder="Search a style, brand, or product — e.g. Bella 3001, Gildan hoodie…"
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: D.faint }} /></InputAdornment> }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: D.inset, color: D.text, fontSize: 13,
              '& fieldset': { borderColor: D.line }, '&:hover fieldset': { borderColor: D.lineHi }, '&.Mui-focused fieldset': { borderColor: D.green } } }} />
        </Box>
      )}

      <DialogContent sx={{ p: 2, minHeight: 280, ...scrollbar }}>
        {err && <Typography sx={{ color: D.amber, fontSize: 12.5, mb: 1 }}>{err}</Typography>}

        {/* ── Color view ── */}
        {detail ? (
          loadingDetail ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: D.green }} /></Box>
          ) : colorRows.length === 0 ? (
            <Typography sx={{ color: D.faint, fontSize: 13, textAlign: 'center', py: 6 }}>No color images synced for this style yet.</Typography>
          ) : (
            <>
              <Typography sx={{ color: D.faint, fontSize: 11.5, mb: 1.25 }}>
                Pick a color — its front {colorRows.some((r) => r.back) ? '+ back ' : ''}drops onto the mockup.
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                {colorRows.map((row, i) => (
                  <Box key={`${row.color}-${i}`} onClick={() => choose(row)} title={row.color}
                    sx={{ borderRadius: 2, overflow: 'hidden', cursor: 'pointer', bgcolor: D.inset, border: `1px solid ${D.line}`,
                      transition: 'border-color 0.12s ease, transform 0.12s ease',
                      '&:hover': { borderColor: D.green, transform: 'translateY(-2px)' } }}>
                    <Box sx={{ aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f6f4' }}>
                      <Box component="img" src={row.front} alt={row.color} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.75 }} />
                    </Box>
                    <Stack direction="row" alignItems="center" gap={0.5} sx={{ px: 0.75, py: 0.6 }}>
                      <Typography sx={{ color: D.text, fontSize: 11.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{row.color}</Typography>
                      {row.back && <Box sx={{ ...mono, color: D.faint, fontSize: 9.5, flexShrink: 0 }}>F+B</Box>}
                    </Stack>
                  </Box>
                ))}
              </Box>
            </>
          )
        ) : (
          /* ── Search/results view ── */
          loading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: D.green }} /></Box>
          ) : !q.trim() ? (
            <Stack alignItems="center" gap={1} sx={{ py: 6, color: D.faint }}>
              <SearchIcon sx={{ fontSize: 34 }} />
              <Typography sx={{ fontSize: 13 }}>Search the catalog to drop in a real garment blank.</Typography>
            </Stack>
          ) : results.length === 0 ? (
            <Typography sx={{ color: D.faint, fontSize: 13, textAlign: 'center', py: 6 }}>No products match “{q.trim()}”.</Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {results.map((p) => {
                const img = (p.productFrontImages && p.productFrontImages[0]) || null;
                return (
                  <Box key={p._id} onClick={() => openProduct(p)} title={p.name || p.style}
                    sx={{ borderRadius: 2, overflow: 'hidden', cursor: 'pointer', bgcolor: D.inset, border: `1px solid ${D.line}`,
                      transition: 'border-color 0.12s ease, transform 0.12s ease',
                      '&:hover': { borderColor: D.green, transform: 'translateY(-2px)' } }}>
                    <Box sx={{ aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f6f4' }}>
                      {img
                        ? <Box component="img" src={img} alt={p.name || p.style} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 1 }} />
                        : <ImageOutlinedIcon sx={{ fontSize: 26, color: '#9aa39c' }} />}
                    </Box>
                    <Box sx={{ px: 1, py: 0.75 }}>
                      <Typography sx={{ color: D.text, fontSize: 12, fontWeight: 700, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || p.style}</Typography>
                      <Stack direction="row" gap={0.5} alignItems="center">
                        {p.brandName && <Typography sx={{ color: D.faint, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brandName}</Typography>}
                        {p.style && <Typography sx={{ ...mono, color: D.green, fontSize: 10 }}>{p.style}</Typography>}
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
