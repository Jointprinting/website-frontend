// src/screens/studio/QuickbooksCard.js
//
// The QuickBooks Online connection card (Finances). One-click OAuth: "Connect"
// opens Intuit's consent window; when it closes we reload status. Mirrors the
// Google Drive connect UX but with NO browser chrome popups — status shows
// inline, and disconnect uses a two-step inline confirm.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Stack, Typography, Button, Chip, CircularProgress } from '@mui/material';
import axios from 'axios';
import config from '../../config.json';
import { B } from './_shared';

const base = `${config.backendUrl}/api`;

export default function QuickbooksCard({ token }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmDisc, setConfirmDisc] = useState(false);

  const load = useCallback(async () => {
    try { setSt((await axios.get(`${base}/quickbooks/status`, authHdr)).data); }
    catch (e) { setSt({ error: e.response?.data?.message || e.message }); }
  }, [authHdr]);
  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await axios.get(`${base}/quickbooks/connect`, authHdr);
      const w = window.open(r.data.url, 'qbo-connect', 'width=560,height=720');
      // Reload status once the consent window closes; stop watching after 3 min.
      const iv = setInterval(() => { if (!w || w.closed) { clearInterval(iv); load(); setBusy(false); } }, 800);
      setTimeout(() => { clearInterval(iv); setBusy(false); }, 180000);
    } catch (e) { setMsg(e.response?.data?.message || 'Could not start the QuickBooks connect.'); setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setMsg('');
    try { await axios.post(`${base}/quickbooks/disconnect`, {}, authHdr); setConfirmDisc(false); await load(); }
    catch (e) { setMsg(e.response?.data?.message || 'Could not disconnect.'); }
    finally { setBusy(false); }
  };

  const card = { border: `1px solid ${B.border}`, borderRadius: 2, p: 2, bgcolor: B.panel };
  if (!st) return <Box sx={card}><CircularProgress size={18} sx={{ color: B.green }} /></Box>;

  return (
    <Box sx={card}>
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 14, flex: 1, minWidth: 130 }}>
          QuickBooks {st.environment === 'sandbox' && <Box component="span" sx={{ color: '#fbbf24', fontSize: 11 }}>· sandbox</Box>}
        </Typography>
        {st.connected
          ? <Chip size="small" label={`Connected${st.companyName ? ' · ' + st.companyName : ''}`} sx={{ bgcolor: B.greenDk, color: B.green, fontWeight: 700 }} />
          : <Chip size="small" label={st.configured ? 'Not connected' : 'Not configured'} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: B.muted }} />}
      </Stack>

      {st.error ? (
        <Typography sx={{ color: '#f87171', fontSize: 12, mt: 1 }}>{st.error}</Typography>
      ) : !st.configured ? (
        <Typography sx={{ color: B.muted, fontSize: 12, mt: 1 }}>
          Set <b>QBO_CLIENT_ID</b> and <b>QBO_CLIENT_SECRET</b> on the backend (Render), then reload.
        </Typography>
      ) : !st.connected ? (
        <>
          <Typography sx={{ color: B.muted, fontSize: 12, mt: 1, mb: 1.25, lineHeight: 1.6 }}>
            Connect once — an Intuit window opens, pick your company, allow access. Then invoices, payments, and the pay-at-close preorder links flow through QuickBooks.
          </Typography>
          <Button onClick={connect} disabled={busy}
            sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 800, fontSize: 12.5, textTransform: 'none', px: 2, '&:hover': { bgcolor: '#3bd070' } }}>
            {busy ? 'Opening…' : 'Connect QuickBooks'}
          </Button>
        </>
      ) : (
        <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1.25 }} flexWrap="wrap">
          <Typography sx={{ color: B.muted, fontSize: 11.5 }}>
            Linked{st.connectedAt ? ` ${new Date(st.connectedAt).toLocaleDateString()}` : ''}
            {st.refreshTokenExpiresAt ? ` · reauth by ${new Date(st.refreshTokenExpiresAt).toLocaleDateString()}` : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {confirmDisc ? (
            <>
              <Button onClick={disconnect} disabled={busy} size="small" sx={{ color: '#f87171', fontSize: 11, textTransform: 'none', minWidth: 0 }}>Confirm disconnect</Button>
              <Button onClick={() => setConfirmDisc(false)} size="small" sx={{ color: B.muted, fontSize: 11, textTransform: 'none', minWidth: 0 }}>Cancel</Button>
            </>
          ) : (
            <Button onClick={() => setConfirmDisc(true)} size="small" sx={{ color: B.muted, fontSize: 11, textTransform: 'none', minWidth: 0 }}>Disconnect</Button>
          )}
        </Stack>
      )}

      {st.connected && st.lastError && (
        <Typography sx={{ color: '#f87171', fontSize: 11, mt: 1 }}>Last error: {st.lastError}</Typography>
      )}
      {msg && <Typography sx={{ color: '#fbbf24', fontSize: 11.5, mt: 1 }}>{msg}</Typography>}
    </Box>
  );
}
