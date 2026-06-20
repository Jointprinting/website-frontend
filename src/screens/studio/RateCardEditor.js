// src/screens/studio/RateCardEditor.js
//
// Admin editor for printer pricing matrices. Pick a printer, edit the numbers
// that changed — grid cells, screen/setup fees, minimums — and save. The
// deterministic quoter reads these rate cards, so THIS is how a price update
// happens, with no code and no re-transcription. Structure changes (adding a
// whole new quantity break or color tier) are rarer and still done in the seed;
// this covers the everyday "the printer raised their prices" case.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, FormControl, Select, MenuItem, CircularProgress,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import axios from 'axios';
import config from '../../config.json';
import { B, darkInput, scrollbar } from './_shared';

const base = `${config.backendUrl}/api`;
const METHOD_LABEL = { screen_print: 'Screen print', embroidery: 'Embroidery', dtg: 'DTG', dtf: 'DTF', media: 'Media', personalization: 'Personalization' };
const clone = (o) => JSON.parse(JSON.stringify(o));

export default function RateCardEditor({ token, onBack }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [list, setList]         = useState([]);
  const [selected, setSelected] = useState('');
  const [card, setCard]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    axios.get(`${base}/rate-cards`, authHdr).then((r) => {
      const l = r.data.rateCards || [];
      setList(l);
      if (l[0] && !selected) setSelected(l[0].printerName);
    }).catch((e) => setMsg(e.response?.data?.message || e.message));
  }, [authHdr]); // eslint-disable-line

  useEffect(() => {
    if (!selected) { setCard(null); return; }
    setLoading(true); setMsg(''); setDirty(false);
    axios.get(`${base}/rate-cards/by-name/${encodeURIComponent(selected)}`, authHdr)
      .then((r) => setCard(r.data.rateCard))
      .catch((e) => setMsg(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [selected, authHdr]);

  const editCell = (gi, ri, ci, val) => {
    setCard((prev) => {
      const n = clone(prev);
      if (val === '' || val == null) { n.groups[gi].grid[ri][ci] = null; return n; }
      const num = Number(val);
      if (Number.isFinite(num)) n.groups[gi].grid[ri][ci] = num;
      return n;
    });
    setDirty(true);
  };
  const editFee = (gi, fi, val) => {
    setCard((prev) => { const n = clone(prev); n.groups[gi].fees[fi].amount = Number(val) || 0; return n; });
    setDirty(true);
  };
  const editMin = (gi, val) => {
    setCard((prev) => { const n = clone(prev); n.groups[gi].minOrder = Number(val) || 0; return n; });
    setDirty(true);
  };

  const save = async () => {
    if (!card) return;
    setSaving(true); setMsg('');
    try {
      const r = await axios.put(`${base}/rate-cards/${card._id}`, card, authHdr);
      setCard(r.data.rateCard); setDirty(false); setMsg('Saved ✓');
    } catch (e) { setMsg(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const numInput = {
    width: 62, background: 'rgba(0,0,0,0.25)', color: B.white, textAlign: 'right',
    border: '1px solid rgba(255,255,255,0.10)', borderRadius: 4, padding: '4px 5px',
    fontSize: 12, fontFamily: 'monospace', outline: 'none',
  };
  const th = { color: B.muted, fontSize: 10, fontWeight: 700, padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap' };
  const thRow = { ...th, textAlign: 'left', color: 'rgba(255,255,255,0.55)' };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: B.bg, color: B.white }}>
      {/* Sticky header with back + save */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: B.panel, borderBottom: `1px solid ${B.border}`,
        px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
          sx={{ textTransform: 'none', color: B.muted, fontWeight: 600, minWidth: 'auto', px: 1, fontSize: 12,
            '&:hover': { color: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>Studio</Button>
        <Typography sx={{ color: B.green, fontWeight: 800, fontSize: 14, flex: 1 }}>Printer pricing</Typography>
        {msg && <Typography sx={{ fontSize: 11, color: msg.includes('✓') ? B.green : '#fbbf24' }}>{msg}</Typography>}
        <Button onClick={save} disabled={!dirty || saving} variant="contained"
          startIcon={saving ? <CircularProgress size={13} sx={{ color: B.greenDk }} /> : <SaveOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ bgcolor: B.green, color: B.greenDk, textTransform: 'none', fontWeight: 800, fontSize: 12,
            '&:hover': { bgcolor: B.green }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: B.muted } }}>
          {dirty ? 'Save changes' : 'Saved'}
        </Button>
      </Box>

      <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" gap={1.5} mb={2} flexWrap="wrap">
          <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Printer</Typography>
          <FormControl size="small" sx={{ ...darkInput, minWidth: 240 }}>
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}
              sx={{ color: B.white, fontSize: 13, borderRadius: 1.5, '& .MuiSvgIcon-root': { color: B.muted } }}>
              {list.map((p) => (
                <MenuItem key={p._id} value={p.printerName}>
                  {p.printerName}{p.state ? ` · ${p.state}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {card && <Typography sx={{ color: B.muted, fontSize: 11 }}>{card.sourceFile}</Typography>}
        </Stack>

        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: B.green }} /></Box>
        ) : !card ? (
          <Typography sx={{ color: B.muted, fontSize: 13 }}>{msg || 'Select a printer.'}</Typography>
        ) : (
          <Stack gap={2.5}>
            {card.notes && (
              <Typography sx={{ color: B.muted, fontSize: 11.5, fontStyle: 'italic' }}>{card.notes}</Typography>
            )}
            {(card.groups || []).map((g, gi) => (
              <Box key={g.id || gi} sx={{ border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${B.faint || 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 13 }}>{g.label || g.id}</Typography>
                  <Typography sx={{ color: B.muted, fontSize: 10.5 }}>
                    {METHOD_LABEL[g.method] || g.method} · qty in {g.quantityUnit}
                    {g.perLocation ? ' · per location' : ''}{g.areaPriced ? ' · × area' : ''}
                  </Typography>
                </Box>

                <Box sx={{ p: 1.25, overflowX: 'auto', ...scrollbar }}>
                  <Box component="table" sx={{ borderCollapse: 'collapse' }}>
                    <Box component="thead">
                      <Box component="tr">
                        <Box component="th" sx={th}>{g.quantityUnit === 'dozens' ? 'doz' : 'qty'}</Box>
                        {(g.columns || []).map((c, ci) => (
                          <Box component="th" key={ci} sx={th}>{c.label || c.key}</Box>
                        ))}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {(g.qtyBreaks || []).map((qb, ri) => (
                        <Box component="tr" key={ri}>
                          <Box component="td" sx={thRow}>{qb}{ri === g.qtyBreaks.length - 1 ? '+' : ''}</Box>
                          {(g.columns || []).map((c, ci) => (
                            <Box component="td" key={ci} sx={{ p: '2px 3px' }}>
                              <input type="number" step="0.01" style={numInput}
                                value={g.grid?.[ri]?.[ci] ?? ''}
                                onChange={(e) => editCell(gi, ri, ci, e.target.value)} />
                            </Box>
                          ))}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>

                {/* Fees + minimum */}
                <Box sx={{ px: 1.5, py: 1.25, borderTop: `1px solid rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  {(g.fees || []).map((f, fi) => (
                    <Stack key={fi} direction="row" alignItems="center" gap={0.75}>
                      <Typography sx={{ color: B.muted, fontSize: 11 }}>{f.label || f.kind}{f.estimate ? ' (est.)' : ''}</Typography>
                      <input type="number" step="0.01" style={{ ...numInput, width: 70 }}
                        value={f.amount ?? ''} onChange={(e) => editFee(gi, fi, e.target.value)} />
                    </Stack>
                  ))}
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Typography sx={{ color: B.muted, fontSize: 11 }}>Min $</Typography>
                    <input type="number" step="0.01" style={{ ...numInput, width: 64 }}
                      value={g.minOrder ?? 0} onChange={(e) => editMin(gi, e.target.value)} />
                  </Stack>
                </Box>
                {g.notes && (
                  <Typography sx={{ px: 1.5, pb: 1, color: 'rgba(255,255,255,0.4)', fontSize: 10.5 }}>{g.notes}</Typography>
                )}
              </Box>
            ))}
            <Typography sx={{ color: B.muted, fontSize: 11 }}>
              Blank a cell to mark it "call for quote". Adding whole new quantity breaks or color tiers
              is a structure change — ask in chat and it'll be added to the source.
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
