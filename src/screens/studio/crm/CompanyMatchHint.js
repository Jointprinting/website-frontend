// src/screens/studio/crm/CompanyMatchHint.js
// The "Did you mean …?" surface for dedup-on-entry. Renders the existing
// companies the backend thinks a typed name might already be, each tappable to
// OPEN that record instead of creating a new card. Purely a suggestion: it sits
// quietly beneath the name field and is fully ignorable — if none of these is
// the company, the owner just keeps typing and saves a brand-new, distinct one.
//
// Stays silent (renders nothing) when there are no candidates, so it never adds
// noise to the form.

import * as React from 'react';
import { Box, Stack, Typography, Chip } from '@mui/material';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { D, mono } from '../_shared';
import { stageMeta, isWonStage } from './_crm';

function MatchRow({ c, onPick }) {
  const customer = c.isCustomer || isWonStage(c.stage);
  return (
    <Box
      onClick={() => onPick(c.companyKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onPick(c.companyKey); }}
      sx={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
        px: 1.25, py: 0.85, borderRadius: 1.5,
        border: `1px solid ${D.line}`, bgcolor: D.inset,
        transition: 'border-color 0.15s ease, background 0.15s ease',
        '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi },
      }}
    >
      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: stageMeta(c.stage).color, flexShrink: 0 }} />
      {customer && <StarRateRoundedIcon sx={{ fontSize: 14, color: stageMeta('customer').color, flexShrink: 0 }} />}
      <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.name}
      </Typography>
      {c.address ? (
        <Typography sx={{ color: D.faint, fontSize: 11.5, minWidth: 0, flexShrink: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>
          {c.address}
        </Typography>
      ) : null}
      <Box sx={{ flexGrow: 1 }} />
      <Chip
        label={customer ? 'Customer' : stageMeta(c.stage).label}
        size="small"
        sx={{ ...mono, height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'transparent',
          color: customer ? stageMeta('customer').color : D.muted,
          border: `1px solid ${D.line}`, flexShrink: 0, display: { xs: 'none', sm: 'flex' } }}
      />
      <ChevronRightIcon sx={{ color: D.faint, fontSize: 17, flexShrink: 0 }} />
    </Box>
  );
}

// candidates: the ranked match rows from /api/crm/match.
// onPick(companyKey): open the existing record (the dedup "reuse" action).
export default function CompanyMatchHint({ candidates, onPick, sx = {} }) {
  if (!candidates || candidates.length === 0) return null;
  return (
    <Box sx={{
      borderRadius: 2, p: 1.25, border: `1px solid ${D.lineHi}`,
      bgcolor: 'rgba(74,222,128,0.05)', ...sx,
    }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.85 }}>
        <LightbulbOutlinedIcon sx={{ fontSize: 16, color: D.green }} />
        <Typography sx={{ color: D.green, fontWeight: 800, fontSize: 12, letterSpacing: 0.3 }}>
          Did you mean an existing company?
        </Typography>
      </Stack>
      <Stack spacing={0.6}>
        {candidates.map((c) => <MatchRow key={c.companyKey} c={c} onPick={onPick} />)}
      </Stack>
      <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.85, lineHeight: 1.4 }}>
        Tap one to open it — or keep going to add a new, separate company.
      </Typography>
    </Box>
  );
}
