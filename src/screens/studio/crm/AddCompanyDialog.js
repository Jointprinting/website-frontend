// src/screens/studio/crm/AddCompanyDialog.js
// The CRM's "Add company" entry point — the one place the owner deliberately
// creates a new company card by hand (everything else flows in from imports /
// placed orders). Dedup-on-entry lives here: as the name is typed we surface the
// existing companies it might already be ("Did you mean …?"), so an accidental
// duplicate card is never made. It SUGGESTS only — the owner can ignore every
// candidate and still save a brand-new, distinct company.
//
// Create path reuses the existing PATCH /:companyKey upsert (get-or-create by
// companyKey) — no new backend write. The companyKey is derived from the name
// with the SAME normalization the server + Orders use, so the new card lines up
// with any future orders by key.

import * as React from 'react';
import {
  Stack, Typography, TextField, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, MenuItem, InputAdornment,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import { D, dropInput, dropPrimaryBtn, dropGhostBtn, useMobileFullScreen } from '../_shared';
import { CRM_STAGES, stageMeta } from './_crm';
import useCompanyMatch from './useCompanyMatch';
import CompanyMatchHint from './CompanyMatchHint';

const dialogPaper = {
  sx: {
    bgcolor: D.panel, color: D.text, borderRadius: 3,
    border: `1px solid ${D.line}`, backgroundImage: 'none',
  },
};

// IDENTITY key — byte-for-byte the server's deriveCompanyKey (models/Order.js):
// lowercase, strip everything non-alphanumeric. Empty until there's a real name.
const deriveCompanyKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// onCreate(companyKey, patch) → Promise: the parent PATCH-upserts and refreshes.
// onOpenExisting(companyKey): jump to an existing record (the dedup reuse path).
export default function AddCompanyDialog({ open, token, onClose, onCreate, onOpenExisting }) {
  const fullScreen = useMobileFullScreen();
  const [name, setName] = React.useState('');
  const [contactName, setContactName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [stage, setStage] = React.useState('lead');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) { setName(''); setContactName(''); setPhone(''); setStage('lead'); setBusy(false); }
  }, [open]);

  // Live dedup-on-entry suggestions, only while the dialog is open.
  const { candidates, loading } = useCompanyMatch(name, { token, enabled: open });

  const companyKey = deriveCompanyKey(name);
  const canSave = !!companyKey && !busy;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const patch = { companyName: name.trim(), stage };
      const contact = { name: contactName.trim(), phone: phone.trim(), role: '', email: '' };
      if (contact.name || contact.phone) patch.contacts = [contact];
      await onCreate(companyKey, patch);
      onClose();
    } catch (_) {
      setBusy(false); // parent surfaced the error; let them retry
    }
  };

  // Picking a suggestion = reuse that existing card instead of creating one.
  const pickExisting = (key) => { onClose(); onOpenExisting(key); };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}
      PaperProps={fullScreen ? { sx: { ...dialogPaper.sx, borderRadius: 0 } } : dialogPaper}>
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <BusinessOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
          <span>Add a company</span>
        </Stack>
        <Typography sx={{ color: D.muted, fontSize: 12.5, fontWeight: 600, mt: 0.5 }}>
          We’ll check it isn’t already in your CRM before adding.
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Company name" value={name} onChange={(e) => setName(e.target.value)}
            autoFocus fullWidth sx={dropInput}
            placeholder="e.g. Bleu Leaf Dispensary"
            InputProps={{ endAdornment: loading ? (
              <InputAdornment position="end"><CircularProgress size={15} sx={{ color: D.faint }} /></InputAdornment>
            ) : undefined }}
          />

          {/* Dedup-on-entry: existing companies this name might already be. */}
          <CompanyMatchHint candidates={candidates} onPick={pickExisting} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Contact name (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)}
              fullWidth sx={dropInput} placeholder="Who you deal with"
            />
            <TextField
              label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)}
              fullWidth sx={dropInput} placeholder="(201) 555-1212"
            />
          </Stack>

          <TextField
            select label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}
            sx={{ ...dropInput, maxWidth: { sm: 220 } }}
          >
            {CRM_STAGES.map((s) => (
              <MenuItem key={s} value={s}>{stageMeta(s).label}</MenuItem>
            ))}
          </TextField>

          {!companyKey && name.trim() && (
            <Typography sx={{ color: D.amber, fontSize: 12 }}>
              That name has no letters or numbers — add a real company name to continue.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={dropGhostBtn}>Cancel</Button>
        <Button onClick={submit} disabled={!canSave} sx={dropPrimaryBtn}>
          {busy ? <CircularProgress size={18} sx={{ color: D.ink }} /> : 'Add company'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
