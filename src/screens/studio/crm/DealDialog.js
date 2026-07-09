// src/screens/studio/crm/DealDialog.js
// Create or edit a DEAL. Used two ways:
//   • from a company profile — the business is fixed (companyKey passed in), so the
//     dialog just asks for the title / value / stage.
//   • from the Deals board — no business yet, so it offers an autocomplete over the
//     loaded companies to attach the deal to one (reuses the same clients[] the CRM
//     already has in memory — no extra fetch).
// Submit hands a clean body back to the parent's createDeal / updateDeal, which own
// all transport. Mirrors the Studio drop-canvas styling (D palette, dropInput).

import * as React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Autocomplete, InputAdornment, Stack, Typography, Box,
} from '@mui/material';
import { D, mono, dropInput, dropPrimaryBtn } from '../_shared';
import { DEAL_STAGES, dealStageMeta } from './_crm';

const paperSx = {
  bgcolor: D.panel, color: D.text, backgroundImage: 'none',
  border: `1px solid ${D.line}`, borderRadius: 3,
};

export default function DealDialog({
  open, onClose, onSubmit,
  company,            // { companyKey, companyName } — fixed business (profile). Optional.
  companies,          // [{ companyKey, companyName, clientName }] — picker source (board). Optional.
  initial,            // an existing deal to edit. Optional.
}) {
  const editing = !!(initial && initial._id);
  const [title, setTitle] = React.useState('');
  const [value, setValue] = React.useState('');
  const [stage, setStage] = React.useState('qualifying');
  const [picked, setPicked] = React.useState(null); // { companyKey, label }
  const [saving, setSaving] = React.useState(false);

  // (Re)seed the form each time the dialog opens or its subject changes.
  React.useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || '');
    setValue(initial?.value != null && initial?.value !== 0 ? String(initial.value) : '');
    setStage(initial?.stage || 'qualifying');
    setPicked(null);
    setSaving(false);
  }, [open, initial]);

  // The company options for the board picker (deduped by companyKey).
  const options = React.useMemo(() => {
    const seen = new Set();
    return (companies || [])
      .map((c) => ({ companyKey: c.companyKey, label: c.companyName || c.clientName || c.companyKey }))
      .filter((o) => o.companyKey && !seen.has(o.companyKey) && seen.add(o.companyKey))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [companies]);

  // Resolve the target business: the fixed one (profile), the edited deal's, or
  // the picked one (board).
  const fixedKey = company?.companyKey || initial?.companyKey || '';
  const fixedName = company?.companyName || initial?.companyName || '';
  const needsPicker = !fixedKey;
  const companyKey = fixedKey || picked?.companyKey || '';
  const companyName = fixedName || picked?.label || '';

  const canSave = !!companyKey && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        companyKey,
        companyName,
        title: title.trim(),
        value: Math.max(0, Number(value) || 0),
        stage,
      });
      onClose();
    } catch (_) {
      setSaving(false); // keep the dialog open so the owner can retry
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ sx: paperSx }}>
      <DialogTitle sx={{ ...mono, fontWeight: 800, fontSize: 16, color: D.text, pb: 0.5 }}>
        {editing ? 'Edit deal' : 'New deal'}
        {(fixedName) && (
          <Typography sx={{ color: D.faint, fontSize: 12.5, fontWeight: 600, mt: 0.25 }}>
            {fixedName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <Stack spacing={1.75} sx={{ mt: 0.5 }}>
          {needsPicker && (
            <Autocomplete
              options={options}
              value={picked}
              onChange={(_e, v) => setPicked(v)}
              getOptionLabel={(o) => o?.label || ''}
              isOptionEqualToValue={(a, b) => a.companyKey === b.companyKey}
              renderInput={(params) => (
                <TextField {...params} label="Business" size="small" sx={dropInput}
                  placeholder="Attach to a company…" />
              )}
              ListboxProps={{ sx: { bgcolor: D.panel, color: D.text } }}
              componentsProps={{ paper: { sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`, backgroundImage: 'none' } } }}
            />
          )}
          <TextField
            label="What's the deal?" size="small" sx={dropInput}
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Spring hoodies, reorder, banners…" autoFocus={!needsPicker}
            helperText="Just a nickname for you — editing it never changes the linked order."
            FormHelperTextProps={{ sx: { color: D.faint, fontSize: 11, ml: 0.5 } }}
          />
          {/* Reassure: the deal's linked order is a SEPARATE, stable link — this
              dialog can't touch it, so renaming the deal can't break anything. */}
          {(initial?.projectNumber || initial?.orderNumber) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.85, borderRadius: 2,
              border: `1px solid ${D.line}`, bgcolor: 'rgba(74,222,128,0.06)' }}>
              <Box component="span" sx={{ fontSize: 13 }}>🔗</Box>
              <Typography sx={{ color: D.muted, fontSize: 12, fontWeight: 600 }}>
                Linked to Order #{initial.projectNumber || initial.orderNumber} — stays connected, nothing to change here.
              </Typography>
            </Box>
          )}
          <TextField
            label="Estimated value" size="small" sx={dropInput}
            value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))}
            inputProps={{ inputMode: 'decimal' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Box component="span" sx={{ color: D.faint }}>$</Box></InputAdornment> }}
          />
          <TextField
            select label="Stage" size="small" sx={dropInput}
            value={stage} onChange={(e) => setStage(e.target.value)}
          >
            {DEAL_STAGES.map((s) => {
              const m = dealStageMeta(s);
              return (
                <MenuItem key={s} value={s}>
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color }} />
                    {m.label}
                  </Box>
                </MenuItem>
              );
            })}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onClose} disabled={saving}
          sx={{ color: D.muted, textTransform: 'none', fontWeight: 700 }}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSave} variant="contained" sx={dropPrimaryBtn}>
          {editing ? 'Save' : 'Create deal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
