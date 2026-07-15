// src/screens/studio/_dialog.js
//
// The Studio's themed replacement for the browser's confirm / alert / prompt — so
// the app never throws native chrome popups (owner's "no weird chrome popups"
// rule). A tiny PROMISE-BASED imperative API backed by one mounted
// <StudioDialogHost/>:
//
//   if (await confirmDialog('Delete this order?')) { … }
//   await alertDialog('Saved ✓');
//   const name = await promptDialog({ message: 'Rename to', defaultValue: cur });
//
// If the host isn't mounted (e.g. a public page), it falls back to the native
// dialog so a call site is always safe to migrate.

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, Box, Stack, Typography, Button, TextField } from '@mui/material';
import { B } from './_shared';

let _handler = null;   // registered by the mounted host

const _norm = (opts) => (typeof opts === 'string' ? { message: opts } : (opts || {}));

// Resolves true/false. opts: string | { title?, message, confirmLabel?, cancelLabel?, danger? }
export function confirmDialog(opts) {
  const o = { kind: 'confirm', ..._norm(opts) };
  if (_handler) return _handler(o);
  return Promise.resolve(window.confirm(o.message || 'Are you sure?'));
}
// Resolves true. opts: string | { title?, message, confirmLabel? }
export function alertDialog(opts) {
  const o = { kind: 'alert', ..._norm(opts) };
  if (_handler) return _handler(o);
  window.alert(o.message || ''); return Promise.resolve(true);
}
// Resolves the typed string, or null if cancelled. opts adds { defaultValue?, placeholder? }
export function promptDialog(opts) {
  const o = { kind: 'prompt', ..._norm(opts) };
  if (_handler) return _handler(o);
  return Promise.resolve(window.prompt(o.message || '', o.defaultValue || ''));
}

// Mount ONCE near the Studio root. Renders the active dialog and registers the
// handler the API calls resolve through.
export function StudioDialogHost() {
  const [state, setState] = useState(null);   // { o, resolve }
  const [val, setVal] = useState('');

  const handle = useCallback((o) => new Promise((resolve) => {
    setVal(o.defaultValue || '');
    setState({ o, resolve });
  }), []);

  useEffect(() => {
    _handler = handle;
    return () => { if (_handler === handle) _handler = null; };
  }, [handle]);

  if (!state) return null;
  const { o, resolve } = state;
  const close = (result) => { setState(null); resolve(result); };
  const isPrompt = o.kind === 'prompt';
  const isAlert = o.kind === 'alert';
  const accent = o.danger ? '#f87171' : B.green;
  const cancelResult = isPrompt ? null : false;

  return (
    <Dialog open onClose={() => close(cancelResult)}
      PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, maxWidth: 420, width: '100%', m: 2 } }}>
      <Box sx={{ p: 2.5 }}>
        {o.title && <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 15, mb: 0.75 }}>{o.title}</Typography>}
        {o.message && (
          <Typography sx={{ color: o.title ? B.muted : B.white, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{o.message}</Typography>
        )}
        {isPrompt && (
          <TextField autoFocus fullWidth size="small" value={val} placeholder={o.placeholder || ''}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') close(val); }}
            sx={{ mt: 1.5, '& .MuiInputBase-root': { color: B.white, bgcolor: B.bg }, '& fieldset': { borderColor: `${B.border} !important` } }} />
        )}
        <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 2 }}>
          {!isAlert && (
            <Button onClick={() => close(cancelResult)}
              sx={{ color: B.muted, textTransform: 'none', fontSize: 13, fontWeight: 700, '&:hover': { color: B.white } }}>
              {o.cancelLabel || 'Cancel'}
            </Button>
          )}
          <Button onClick={() => close(isPrompt ? val : true)} disableElevation variant="contained" autoFocus={!isPrompt}
            sx={{ bgcolor: accent, color: '#06140c', textTransform: 'none', fontSize: 13, fontWeight: 800, px: 2,
              '&:hover': { bgcolor: accent, filter: 'brightness(1.08)' } }}>
            {o.confirmLabel || (isAlert ? 'OK' : isPrompt ? 'Save' : 'Confirm')}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
