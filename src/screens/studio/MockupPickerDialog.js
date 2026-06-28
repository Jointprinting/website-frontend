// src/screens/studio/MockupPickerDialog.js
// Reusable mockup multi-select dialog. Filters by company/client name match;
// "Show all" toggle reveals unfiltered library when nothing matches.
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Typography, Button, CircularProgress,
} from '@mui/material';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import { B, useMobileFullScreen } from './_shared';

export default function MockupPickerDialog({
  open, onClose, onConfirm, mockups,
  companyName = '', clientName = '',
  initialSelected = [],
  title = 'Pick Mockups',
  confirmLabel = 'Save',
  busy = false,
}) {
  const fullScreen = useMobileFullScreen();
  const [selected, setSelected] = React.useState(initialSelected);
  const [showAll, setShowAll]   = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSelected(initialSelected || []);
      setShowAll(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const keyFor = (m) => m.pageState?.mockupNum || m.name || m._id;

  // Match on a slug (lowercase alnum-only) so "Bleu Leaf Dispensary" still
  // matches a library item named "BleuLeafDispensary_Merch" — raw substring
  // matching broke on spaces / punctuation and made the picker look empty.
  const matched = React.useMemo(() => {
    const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const cn = slug(companyName);
    const pn = slug(clientName);
    if (!cn && !pn) return mockups;
    return mockups.filter(m => {
      const hay = slug(`${m.client || ''} ${m.name || ''}`);
      return (cn && cn.length >= 3 && hay.includes(cn)) ||
             (pn && pn.length >= 3 && hay.includes(pn));
    });
  }, [mockups, companyName, clientName]);

  const shown = showAll || matched.length === 0 ? mockups : matched;
  const filteringPossible = matched.length > 0 && matched.length < mockups.length;

  const toggle = (m) => {
    const k = keyFor(m);
    setSelected(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: fullScreen ? 0 : 2 } }}>
      <DialogTitle sx={{ color: B.white, fontWeight: 700, fontSize: 15, pb: 1 }}>
        {title}
        {(companyName || clientName) && (
          <Typography component="span" sx={{ color: B.muted, fontSize: 12, fontWeight: 500, ml: 1 }}>
            — {companyName || clientName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography sx={{ color: B.muted, fontSize: 11, fontFamily: 'monospace' }}>
            {selected.length} selected · {shown.length} shown
          </Typography>
          {filteringPossible && (
            <Button size="small" onClick={() => setShowAll(s => !s)}
              sx={{ color: B.green, fontSize: 11, textTransform: 'none', py: 0.3 }}>
              {showAll ? `Filter to ${companyName || clientName}` : 'Show all mockups'}
            </Button>
          )}
        </Stack>
        {shown.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: B.muted }}>
            <DesignServicesIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
            <Typography sx={{ fontSize: 13 }}>No mockups saved yet.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1 }}>
            {shown.map(m => {
              const k = keyFor(m);
              const sel = selected.includes(k);
              const num = m.pageState?.mockupNum;
              return (
                <Box key={m._id} onClick={() => toggle(m)} sx={{
                  cursor: 'pointer', borderRadius: 1.5, overflow: 'hidden',
                  border: `2px solid ${sel ? B.green : B.border}`,
                  opacity: sel ? 1 : 0.78, transition: 'all 0.12s',
                  '&:hover': { opacity: 1, borderColor: B.green },
                }}>
                  {m.thumbnail ? (
                    <Box component="img" src={m.thumbnail} alt={m.name}
                      sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <Box sx={{ aspectRatio: '1', bgcolor: B.panelHi,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DesignServicesIcon sx={{ color: B.muted, fontSize: 28, opacity: 0.4 }} />
                    </Box>
                  )}
                  <Box sx={{ px: 0.8, py: 0.6, bgcolor: sel ? 'rgba(74,222,128,0.12)' : 'transparent' }}>
                    {num && (
                      <Typography sx={{ color: sel ? B.green : B.muted, fontSize: 9, fontWeight: 700,
                        fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {num}
                      </Typography>
                    )}
                    <Typography sx={{ color: sel ? B.green : B.white, fontSize: 10, fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name || 'Untitled'}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: B.muted }} disabled={busy}>Cancel</Button>
        <Button onClick={() => onConfirm(selected)} variant="contained" disabled={busy}
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700 }}>
          {busy ? <CircularProgress size={16} sx={{ color: B.greenDk }} /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
