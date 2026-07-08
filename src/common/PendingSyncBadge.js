// src/common/PendingSyncBadge.js
//
// A small fixed floating chip that appears ONLY when field writes are waiting
// to sync (you tapped something in a dead zone). It reassures you the capture
// is safe, shows how many are queued, and lets you force a sync attempt. It
// hides itself the moment the queue drains. Rendered once, globally, in the
// Studio shell — position:fixed, so where it sits in the tree doesn't matter.

import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import { subscribe, pendingCount } from './offlineQueue';
import { flushNow } from './offlineSync';

export default function PendingSyncBadge() {
  const [count, setCount] = React.useState(pendingCount());
  const [syncing, setSyncing] = React.useState(false);
  const [online, setOnline] = React.useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  React.useEffect(() => subscribe(setCount), []);

  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (count <= 0) return null;

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try { await flushNow(); } finally { setSyncing(false); }
  };

  const amber = '#fbbf24';
  return (
    <Box
      onClick={handleSync}
      role="button"
      title={online ? 'Tap to sync now' : "You're offline — these will sync automatically when signal returns"}
      sx={{
        position: 'fixed', zIndex: 3000, bottom: { xs: 76, md: 20 }, right: 16,
        display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', userSelect: 'none',
        px: 1.5, py: 1, borderRadius: 999,
        bgcolor: 'rgba(20,24,22,0.96)', border: `1px solid ${amber}`,
        boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
      }}
    >
      {syncing
        ? <CircularProgress size={15} sx={{ color: amber }} />
        : <CloudOffOutlinedIcon sx={{ color: amber, fontSize: 17 }} />}
      <Typography sx={{ color: amber, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
        {count} to sync
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {syncing ? 'syncing…' : online ? 'tap to sync' : 'offline · auto'}
      </Typography>
    </Box>
  );
}
