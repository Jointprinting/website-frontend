// src/screens/studio/crm/CrmDialogs.js
// The two small write-modals shared across the CRM: "Log a touch" and
// "Reschedule". Both are presentational — the parent owns the PATCH and passes
// an async onSubmit; the dialog just collects input and shows a busy state.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { D, dropInput, dropPrimaryBtn, dropGhostBtn } from '../_shared';
import { LOG_KINDS, kindMeta, dateInputValue } from './_crm';

const dialogPaper = {
  sx: {
    bgcolor: D.panel, color: D.text, borderRadius: 3,
    border: `1px solid ${D.line}`, backgroundImage: 'none',
  },
};

// ── Log a touch ───────────────────────────────────────────────────────────────
// Note + kind + an optional next follow-up date. Submits
// { logText, kind, nextFollowUp } — exactly the PATCH "log a touch" intent.
export function LogTouchDialog({ open, onClose, onSubmit, companyName, defaultKind = 'call' }) {
  const [text, setText] = React.useState('');
  const [kind, setKind] = React.useState(defaultKind);
  const [next, setNext] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Reset to a clean slate every time it opens.
  React.useEffect(() => {
    if (open) { setText(''); setKind(defaultKind); setNext(''); setBusy(false); }
  }, [open, defaultKind]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ logText: text.trim(), kind, nextFollowUp: next || null });
      onClose();
    } catch (_) {
      // Parent surfaces the error; just drop the busy state so they can retry.
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={dialogPaper}>
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>
        Log a touch
        {companyName && (
          <Typography sx={{ color: D.muted, fontSize: 12.5, fontWeight: 600, mt: 0.25 }}>{companyName}</Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <ToggleButtonGroup
            value={kind} exclusive size="small"
            onChange={(_, v) => v && setKind(v)}
            sx={{
              flexWrap: 'wrap', gap: 0.75,
              '& .MuiToggleButton-root': {
                border: `1px solid ${D.line}`, borderRadius: '999px !important',
                color: D.muted, textTransform: 'none', fontWeight: 700, fontSize: 12.5,
                px: 1.5, py: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'rgba(74,222,128,0.14)', color: D.green, borderColor: D.green,
                  '&:hover': { bgcolor: 'rgba(74,222,128,0.2)' },
                },
              },
            }}
          >
            {LOG_KINDS.map((k) => {
              const { label, Icon } = kindMeta(k);
              return (
                <ToggleButton key={k} value={k}>
                  <Icon sx={{ fontSize: 15, mr: 0.5 }} /> {label}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>

          <TextField
            label="What happened?" value={text} onChange={(e) => setText(e.target.value)}
            autoFocus fullWidth multiline minRows={3} sx={dropInput}
            placeholder="Talked to the owner — wants samples of the 8oz hoodie before they commit."
          />

          <TextField
            label="Next follow-up (optional)" type="date" value={next}
            onChange={(e) => setNext(e.target.value)} fullWidth sx={dropInput}
            InputLabelProps={{ shrink: true }}
            helperText="Leave blank to keep the current date."
            FormHelperTextProps={{ sx: { color: D.faint, mx: 0 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={dropGhostBtn}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !text.trim()} sx={dropPrimaryBtn}>
          {busy ? <CircularProgress size={18} sx={{ color: D.ink }} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Reschedule ────────────────────────────────────────────────────────────────
// Just moves nextFollowUp. Includes quick presets for the common "+N days" jumps
// a road salesman actually uses, plus a date picker. Submits { nextFollowUp }.
const PRESETS = [
  { label: 'Tomorrow', days: 1 },
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 },
  { label: '+1 month', days: 30 },
];

function plusDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return dateInputValue(d);
}

export function RescheduleDialog({ open, onClose, onSubmit, companyName, current }) {
  const [date, setDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) { setDate(dateInputValue(current)); setBusy(false); }
  }, [open, current]);

  const submit = async (override) => {
    const value = override !== undefined ? override : date;
    setBusy(true);
    try {
      await onSubmit({ nextFollowUp: value || null });
      onClose();
    } catch (_) {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={dialogPaper}>
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>
        Reschedule follow-up
        {companyName && (
          <Typography sx={{ color: D.muted, fontSize: 12.5, fontWeight: 600, mt: 0.25 }}>{companyName}</Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box>
            <Typography sx={{ color: D.faint, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, mb: 1, textTransform: 'uppercase' }}>
              Quick jump
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
              {PRESETS.map((p) => (
                <Button
                  key={p.label} size="small" disabled={busy}
                  onClick={() => { const v = plusDays(p.days); setDate(v); submit(v); }}
                  sx={{ ...dropGhostBtn, px: 1.5, py: 0.4, fontSize: 12.5 }}
                >
                  {p.label}
                </Button>
              ))}
            </Stack>
          </Box>
          <TextField
            label="Pick a date" type="date" value={date}
            onChange={(e) => setDate(e.target.value)} fullWidth sx={dropInput}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={dropGhostBtn}>Cancel</Button>
        <Button onClick={() => submit()} disabled={busy} sx={dropPrimaryBtn}>
          {busy ? <CircularProgress size={18} sx={{ color: D.ink }} /> : 'Set date'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
