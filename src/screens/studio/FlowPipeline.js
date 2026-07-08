// src/screens/studio/FlowPipeline.js
//
// The order's journey at a glance, across the top of the project drawer:
//   Quote → Picked → Confirmation → Approved → PO → Production → Delivered
// Each stage lights up as the project reaches it; the current stage pulses.
// Stages that map to a tool (quote builder, confirmation, POs) are clickable
// shortcuts into that tool.

import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Tooltip } from '@mui/material';
import axios from 'axios';
import config from '../../config.json';
import { B, hasConfirmation, clientApproved } from './_shared';

const STATUS_RANK = { quoted: 0, approved: 1, placed: 2, in_production: 3, shipped: 4, delivered: 5, cancelled: -1 };

export default function FlowPipeline({ project, authHdr, onOpenQuote, onOpenConfirmation, onOpenPos }) {
  const [poCount, setPoCount] = useState(null);

  useEffect(() => {
    if (!project || !project._id) return;
    let cancelled = false;
    setPoCount(null);   // don't show the previous project's PO state while loading
    axios.get(`${config.backendUrl}/api/orders/${project._id}/pos`, authHdr)
      .then(r => { if (!cancelled) setPoCount((r.data.pos || []).length); })
      .catch(() => { if (!cancelled) setPoCount(null); });
    return () => { cancelled = true; };
  }, [project?._id]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null;
  const rank = STATUS_RANK[project.status] ?? 0;
  const cancelled = project.status === 'cancelled';

  const approvedByClient = clientApproved(project);

  const steps = [
    {
      key: 'quote', label: 'Quote',
      done: (project.quoteLines || []).length > 0,
      onClick: onOpenQuote,
      hint: 'Open the quote builder',
    },
    {
      key: 'picked', label: 'Picked',
      done: !!project.optionsPickedAt || (project.quoteLines || []).some(l => l.accepted),
      hint: 'Client chose their options on the approval link',
    },
    {
      key: 'confirmation', label: 'Confirmation',
      done: hasConfirmation(project.confirmation),
      onClick: onOpenConfirmation,
      hint: 'Open the confirmation builder',
    },
    {
      // Foolproof against link resets: light green ONLY on a current-cycle
      // client approval (superseded-aware), or if the order has genuinely
      // advanced PAST approved into production+ (rank >= 2 = placed/…). We do
      // NOT accept a bare status === 'approved' (rank 1): that stored scalar is
      // set once and never reverts, so resetting/reopening the client link
      // would otherwise leave this falsely green while the client sees a fresh
      // ask. rank >= 2 only happens after a real approval + payment, so
      // legacy/manually-advanced orders still show the step done.
      key: 'approved', label: 'Approved',
      done: approvedByClient || rank >= 2,
      hint: 'Client signed off the confirmation page',
    },
    {
      key: 'po', label: 'PO',
      done: (poCount || 0) > 0,
      onClick: onOpenPos,
      hint: poCount === null ? 'Purchase orders' : `${poCount} purchase order${poCount === 1 ? '' : 's'}`,
    },
    {
      key: 'production', label: 'Production',
      done: rank >= 2,
      hint: 'Placed with the printer / in production',
    },
    {
      key: 'delivered', label: 'Delivered',
      done: rank >= 5,
      hint: 'Arrived at the client',
    },
  ];

  // Current = first not-done step (everything before it is the past).
  const currentIdx = steps.findIndex(s => !s.done);

  return (
    <Box sx={{ px: 2.5, pt: 2, pb: 1, opacity: cancelled ? 0.45 : 1 }}>
      <Stack direction="row" alignItems="flex-start" sx={{ overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { height: 4 } }}>
        {steps.map((s, i) => {
          const isCurrent = i === currentIdx && !cancelled;
          const done = s.done;
          const color = done ? B.green : isCurrent ? '#fbbf24' : B.muted;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <Box sx={{ flex: 1, minWidth: 14, height: 2, mt: '9px', borderRadius: 1,
                  bgcolor: done ? `${B.green}66` : `${B.border}` }} />
              )}
              <Tooltip title={s.hint || ''} arrow>
                <Stack alignItems="center" gap={0.4} onClick={s.onClick}
                  sx={{ cursor: s.onClick ? 'pointer' : 'default', px: 0.3,
                    '&:hover .fp-label': s.onClick ? { color: B.white } : {} }}>
                  <Box sx={{
                    width: 20, height: 20, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${color}`,
                    bgcolor: done ? `${B.green}22` : 'transparent',
                    ...(isCurrent && {
                      animation: 'fpPulse 2s ease-in-out infinite',
                      '@keyframes fpPulse': {
                        '0%, 100%': { boxShadow: `0 0 0 0 ${color}44` },
                        '50%':      { boxShadow: `0 0 0 5px ${color}11` },
                      },
                    }),
                  }}>
                    {done && (
                      <Box component="span" sx={{ color: B.green, fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</Box>
                    )}
                    {isCurrent && !done && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
                    )}
                  </Box>
                  <Typography className="fp-label" sx={{
                    color: done ? B.green : isCurrent ? '#fbbf24' : B.muted,
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                    whiteSpace: 'nowrap', transition: 'color 150ms ease',
                  }}>
                    {s.label}
                  </Typography>
                </Stack>
              </Tooltip>
            </React.Fragment>
          );
        })}
      </Stack>
      {cancelled && (
        <Typography sx={{ color: '#f87171', fontSize: 10, fontWeight: 700, textAlign: 'center', mt: 0.5 }}>
          CANCELLED
        </Typography>
      )}
    </Box>
  );
}
