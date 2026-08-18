// src/screens/studio/mockup/AddColourDialog.js
//
// "SAME DESIGN, ANOTHER GARMENT COLOUR."
//
// Pick colours off the style's live S&S range; each one becomes its own mockup —
// same artwork, same placement, the new garment — lettered under this project
// (#000150A → #000150B, C…) so grouping and versioning keep working.
//
// The work happens HERE rather than on the server because re-flattening needs a
// canvas: the art and the garment are separate layers in the saved file
// (mockupModel.emptySide), and a colour variation is "point the blank at the new
// photo, keep the logo and its position, re-flatten" — see recolor.js, which owns
// those rules and the placement re-anchor that stops the print drifting when the
// two garment photos aren't the same shape.
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Dialog, DialogContent, Stack, Typography } from '@mui/material';
import axios from 'axios';
import config from '../../../config.json';
import { D, mono, deriveCompanyKey } from '../_shared';
import { canRecolor, whyNotRecolor, recolorPages, colorwayName } from './recolor';
import { mockupFromLibraryItem, mockupToLibraryItem, pageToState } from './mockupModel';

const base = `${config.backendUrl}/api`;

export default function AddColourDialog({ open, source, project, authHdr, onClose, onDone, onToast }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [colors, setColors] = useState(null);
  const [style, setStyle] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [progress, setProgress] = useState('');

  const search = useCallback(async (code) => {
    const q = String(code || '').trim();
    if (!q) { setMsg('Enter a style code first.'); return; }
    setBusy(true); setMsg('Loading colours from S&S…'); setColors(null);
    try {
      const { data } = await axios.get(`${base}/products/ss/finder`, { ...authHdr, params: { style: q } });
      if (data && data.error) { setColors([]); setMsg(`✗ ${data.error}`); return; }
      if (data && data.multipleMatches) {
        setColors([]);
        setMsg(`"${q}" matches ${(data.matches || []).length} styles — use the exact style number.`);
        return;
      }
      const list = (data && data.colors) || (data && data.match ? [data.match] : []);
      setColors(list);
      setMsg(list.length ? `${(data && data.name) || q} · ${list.length} colours` : 'No colours for that style.');
    } catch (e) {
      setColors([]); setMsg(`✗ ${e.response?.data?.error || e.message}`);
    } finally { setBusy(false); }
  }, [authHdr]);

  // On open: seed the style from whatever the source mockup was built from — its
  // stored colourway, else the subtitle the S&S picker wrote ("Gildan 5000,
  // Black") — and search it straight away, so the common case is one click.
  useEffect(() => {
    if (!open) return;
    setSel(new Set()); setProgress('');
    const ps = (source && source.item && source.item.pageState) || {};
    const guess = (source && source.item && source.item.colorway && source.item.colorway.style)
      || String(ps.subtitle || '').split(',')[0].trim();
    setStyle(guess);
    if (guess) search(guess);
    else { setColors([]); setMsg('Type the S&S style code this mockup uses, then search.'); }
  }, [open, source, search]);

  // Out of stock can't be made into a proof we'd then show a client. Unknown
  // stock stays available — an unreadable S&S feed is not evidence of absence.
  const sellable = (c) => !(c.stock && c.stock.known && c.stock.ok === false);
  const toggle = (c) => {
    if (!sellable(c)) return;
    setSel(prev => { const n = new Set(prev); if (n.has(c.color)) n.delete(c.color); else n.add(c.color); return n; });
  };

  const make = async () => {
    const picks = (colors || []).filter(c => sel.has(c.color) && sellable(c));
    if (!picks.length || !project?._id) return;
    setBusy(true);
    let made = 0;
    const added = [];
    try {
      const model = mockupFromLibraryItem(source.item);
      if (!(model.pages || []).some(canRecolor)) {
        onToast?.(whyNotRecolor((model.pages || [])[0]), 'error');
        return;
      }
      // Loaded lazily: both pull in canvas work that the dialog itself doesn't
      // need until the owner actually commits.
      const { loadImg, flattenHeadless } = await import('./flattenSide');
      const prevColor = (source.item.colorway && source.item.colorway.name) || '';

      for (let i = 0; i < picks.length; i++) {
        const c = picks[i];
        setProgress(`${i + 1} of ${picks.length} — ${c.color}…`);
        const pages = await recolorPages(model.pages, { front: c.front, back: c.back },
          { loadImg, flatten: flattenHeadless });

        // The number is reserved SERVER-side, atomically — the same path the lab
        // and the promo upload use, so concurrent saves can't collide on a letter.
        const asg = await axios.post(`${base}/orders/${project._id}/mockups/assign`, {}, authHdr);
        const num = (asg.data && asg.data.mockupNum) || '';
        const name = colorwayName(source.item.name, c.color, prevColor);

        const stamped = pages.map(pg => ({
          ...pg,
          _extra: {
            ...(pg._extra || {}),
            mockupNum: num,
            pdfName: num ? `${String(num).replace(/^#/, '')}.pdf` : '',
            subtitle: [style, c.color].filter(Boolean).join(', '),
            projectNumber: project.projectNumber || '',
            projectId: project._id,
          },
        }));
        const body = mockupToLibraryItem({
          id: null, remoteId: `studio-${num.replace(/[^\w]/g, '')}-${i}`, mockupNum: num,
          name, client: source.item.client || project.companyName || '',
          projectNumber: project.projectNumber || '', pages: stamped,
        }, (model.pages || []).map((pg, j) => pageToState(pg, null)));
        body.companyKey = source.item.companyKey || deriveCompanyKey(project.companyName || '');
        body.savedAt = Date.now();
        // Structured colour, so every surface downstream can group and label by
        // it instead of parsing a display name.
        body.colorway = { name: c.color || '', code: c.colorCode || '', hex: c.swatch1 || '', style };
        await axios.post(`${base}/studio/library/mockups`, body, authHdr);
        added.push(num);
        made++;
      }
      onToast?.(`${made} colour${made === 1 ? '' : 's'} added · ${added.join(', ')}`, 'success');
      onDone?.(added);
      onClose();
    } catch (e) {
      onToast?.(made
        ? `Made ${made} of ${picks.length} before an error: ${e.response?.data?.message || e.message}`
        : (e.response?.data?.message || e.message || 'Could not add colours.'), 'error');
      if (made) onDone?.(added);
    } finally { setBusy(false); setProgress(''); }
  };

  return (
    <Dialog open={!!open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
      <DialogContent sx={{ p: 2.5 }}>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15 }}>
          Same design, another colour
        </Typography>
        <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.3, mb: 1.5, lineHeight: 1.5 }}>
          Each colour becomes its own mockup — same artwork, same placement, the new garment —
          lettered under this project. Out-of-stock colours can’t be picked.
        </Typography>

        <Stack direction="row" gap={1} sx={{ mb: 1.5 }}>
          <Box component="input" value={style} placeholder="S&S style code (e.g. 5000)"
            onChange={(e) => setStyle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(style); }}
            sx={{ flex: 1, bgcolor: D.inset, border: `1px solid ${D.line}`, borderRadius: 2, px: 1.2, py: 0.8,
              color: D.text, fontSize: 13, outline: 'none', '&:focus': { borderColor: D.green } }} />
          <Button onClick={() => search(style)} disabled={busy}
            sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 12.5 }}>Search</Button>
        </Stack>

        {msg && <Typography sx={{ color: D.faint, fontSize: 11.5, mb: 1 }}>{msg}</Typography>}
        {busy && !progress && <CircularProgress size={18} sx={{ color: D.green, mb: 1 }} />}
        {progress && <Typography sx={{ color: D.green, fontSize: 12, fontWeight: 700, mb: 1, ...mono }}>{progress}</Typography>}

        {colors && colors.length > 0 && (
          <Box sx={{ display: 'grid', gap: 0.75, maxHeight: 360, overflowY: 'auto', pr: 0.5,
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {colors.map((c) => {
              const on = sel.has(c.color);
              const ok = sellable(c);
              const st = c.stock || {};
              const note = !st.known ? 'stock unknown'
                : st.ok === false ? 'out of stock'
                : `${st.total} on hand`;
              return (
                <Box key={c.color} onClick={() => toggle(c)}
                  title={ok ? c.color : `${c.color} — nothing on hand across the size run`}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.7, borderRadius: 2,
                    cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.4,
                    border: `1.5px solid ${on ? D.green : D.line}`,
                    bgcolor: on ? 'rgba(74,222,128,0.08)' : D.inset }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    bgcolor: c.swatch1 || 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    backgroundImage: c.front ? `url(${c.front})` : 'none',
                    backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: D.text, fontSize: 11.5, fontWeight: 700, lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.color}</Typography>
                    <Typography sx={{ color: st.ok === false ? '#f87171' : D.faint, fontSize: 9.5, ...mono }}>{note}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button onClick={onClose} disabled={busy} sx={{ color: D.muted, textTransform: 'none', fontSize: 12.5 }}>Cancel</Button>
          <Button onClick={make} disabled={busy || !sel.size}
            sx={{ color: D.green, textTransform: 'none', fontWeight: 800, fontSize: 12.5,
              border: `1px solid ${sel.size ? D.green : D.line}`, borderRadius: 999, px: 2,
              '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
            {sel.size ? `Make ${sel.size} colour${sel.size === 1 ? '' : 's'}` : 'Pick colours'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
