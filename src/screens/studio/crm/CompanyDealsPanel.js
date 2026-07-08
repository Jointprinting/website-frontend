// src/screens/studio/crm/CompanyDealsPanel.js
// The DEALS section on a company profile — the owner's mental model made literal:
// "deal cards attached to one main business profile." A business has many deals,
// each its own card with its own lifecycle. Winning a deal (its first) is what
// makes the business a CLIENT — the Win button is the star action here.
//
// Presentational: the parent (CrmTab, via CompanyDetail) owns all transport and
// passes the deals[] + the action callbacks. Reuses the Studio drop-canvas tokens
// and the same deep-link path the order rows use (onOpenDeal → Order Tracker).

import * as React from 'react';
import { Box, Stack, Typography, Button, IconButton, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import { D, mono } from '../_shared';
import { Eyebrow, dealStageMeta, dealTitle, fmtMoney0, isOpenDeal } from './_crm';

// Small colored stage pill for a deal.
function DealStagePill({ stage }) {
  const m = dealStageMeta(stage);
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.2, borderRadius: 1,
      bgcolor: m.bg, border: `1px solid ${m.color}55`, flexShrink: 0 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color }} />
      <Typography sx={{ color: m.color, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>{m.label}</Typography>
    </Box>
  );
}

function DealCard({ deal, onWin, onLose, onReopen, onOpen, onEdit, onRemove }) {
  const [menuEl, setMenuEl] = React.useState(null);
  const m = dealStageMeta(deal.stage);
  const open = isOpenDeal(deal);
  const won = deal.stage === 'won';
  const lost = deal.stage === 'lost';
  const linked = !!(deal.orderNumber || deal.projectNumber);
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      bgcolor: D.inset, border: `1px solid ${won ? 'rgba(74,222,128,0.4)' : D.line}`, borderRadius: 2, p: 1.25,
      '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: m.color, opacity: won ? 1 : 0.8 },
    }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ pl: 0.5 }}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, flexWrap: 'wrap' }}>
            <DealStagePill stage={deal.stage} />
            {deal.dealNumber && (
              <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5, fontWeight: 700 }}>{deal.dealNumber}</Typography>
            )}
          </Stack>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13.5, lineHeight: 1.3, opacity: lost ? 0.7 : 1 }}>
            {dealTitle(deal)}
          </Typography>
          {linked && onOpen && (
            <Button
              onClick={() => onOpen(deal)} size="small"
              startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
              sx={{ alignSelf: 'flex-start', textTransform: 'none', color: D.faint, fontWeight: 700, fontSize: 11,
                px: 0.5, py: 0, minWidth: 0, '&:hover': { color: D.green, bgcolor: 'transparent' } }}
            >
              Order #{deal.projectNumber || deal.orderNumber}
            </Button>
          )}
        </Stack>
        <Stack alignItems="flex-end" spacing={0.25} sx={{ flexShrink: 0 }}>
          {deal.value > 0 && (
            <Typography sx={{ ...mono, color: won ? D.green : D.text, fontWeight: 800, fontSize: 13 }}>
              {fmtMoney0(deal.value)}
            </Typography>
          )}
          <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)}
            sx={{ color: D.faint, p: 0.25, '&:hover': { color: D.text } }}>
            <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      </Stack>

      {/* Actions — Win is the headline for an open deal (its first win → client). */}
      <Stack direction="row" spacing={0.75} sx={{ mt: 1, pl: 0.5 }}>
        {open && (
          <>
            <Button
              onClick={() => onWin(deal)} size="small" variant="contained"
              startIcon={<EmojiEventsOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, borderRadius: 999, px: 1.5, py: 0.3,
                bgcolor: D.green, color: D.ink, boxShadow: 'none', '&:hover': { bgcolor: '#5cec8e' } }}
            >
              Win
            </Button>
            <Button
              onClick={() => onLose(deal)} size="small"
              startIcon={<CloseRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 999, px: 1.25, py: 0.3,
                color: D.muted, border: `1px solid ${D.line}`, '&:hover': { color: '#f87171', borderColor: 'rgba(248,113,113,0.5)', bgcolor: 'rgba(248,113,113,0.06)' } }}
            >
              Lost
            </Button>
          </>
        )}
        {won && (
          <Typography sx={{ color: D.green, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <EmojiEventsOutlinedIcon sx={{ fontSize: 15 }} /> Won{deal.wonAt ? '' : ''}
          </Typography>
        )}
        {(won || lost) && (
          <Button
            onClick={() => onReopen(deal)} size="small"
            startIcon={<ReplayRoundedIcon sx={{ fontSize: 14 }} />}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 999, px: 1.25, py: 0.3,
              color: D.faint, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.04)' } }}
          >
            Reopen
          </Button>
        )}
      </Stack>

      <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}
        PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`, backgroundImage: 'none' } }}>
        <MenuItem onClick={() => { setMenuEl(null); onEdit(deal); }} sx={{ fontSize: 13 }}>Edit deal…</MenuItem>
        <MenuItem onClick={() => { setMenuEl(null); onRemove(deal); }} sx={{ fontSize: 13, color: '#f87171' }}>Remove deal</MenuItem>
      </Menu>
    </Box>
  );
}

export default function CompanyDealsPanel({
  deals, hasOrders, onNew, onWin, onLose, onReopen, onOpen, onEdit, onRemove,
}) {
  const list = Array.isArray(deals) ? deals.filter((d) => d && !d.archived) : [];
  // Open deals first (the live work), then won, then lost; newest within each.
  const rank = (d) => (isOpenDeal(d) ? 0 : d.stage === 'won' ? 1 : 2);
  const sorted = [...list].sort((a, b) => rank(a) - rank(b));

  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: sorted.length ? 1.5 : 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Eyebrow>Deals</Eyebrow>
          {sorted.length > 0 && (
            <Typography sx={{ ...mono, color: D.faint, fontSize: 11, fontWeight: 700 }}>{sorted.length}</Typography>
          )}
        </Stack>
        <Button
          onClick={onNew} size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: D.green, borderRadius: 999, px: 1.25,
            border: `1px solid ${D.line}`, '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.06)' } }}
        >
          New deal
        </Button>
      </Stack>

      {sorted.length === 0 ? (
        <Box sx={{ py: 2, textAlign: 'center' }}>
          <HandshakeOutlinedIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.18)', mb: 0.5 }} />
          <Typography sx={{ color: D.muted, fontSize: 13, fontWeight: 700 }}>No deals yet</Typography>
          <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.25 }}>
            {hasOrders
              ? 'Start one here — or run “Set up deals from my orders” on the Deals board to seed cards from this company’s orders.'
              : 'Start a deal to track this opportunity through the pipeline.'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {sorted.map((d) => (
            <DealCard
              key={d._id || d.dealNumber}
              deal={d}
              onWin={onWin} onLose={onLose} onReopen={onReopen}
              onOpen={onOpen} onEdit={onEdit} onRemove={onRemove}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
