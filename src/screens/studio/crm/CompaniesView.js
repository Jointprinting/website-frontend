// src/screens/studio/crm/CompaniesView.js
// The full company list (/api/crm) with a search box (q) and stage / tag filters
// driven by the parent (debounced fetch in one place). Address has replaced the
// old "Area" as the location line; the legacy area is still read as a fallback so
// existing data shows, but it's no longer a primary, filterable field.
//
// Doubles as the Archived recover surface: pass `archived` + an `onUnarchive`
// handler and the view switches to a self-contained, client-side-filtered list of
// archived records, each with a one-tap Restore.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, MenuItem, InputAdornment, CircularProgress, Chip, Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import RestoreFromTrashOutlinedIcon from '@mui/icons-material/RestoreFromTrashOutlined';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import { D, mono, dropInput, fmtRelative } from '../_shared';
import {
  StageChip, EmptyState, TagChips, CRM_STAGES, stageMeta, interestLabel, followUpStatus,
  primaryPhone, isWonStage,
} from './_crm';

function CompanyRow({ c, onOpen, onUnarchive }) {
  const name = c.companyName || c.clientName || c.companyKey;
  const phone = primaryPhone(c);
  const fu = followUpStatus(c.nextFollowUp);
  const contactCount = (c.contacts || []).length;
  const customer = c.isCustomer || isWonStage(c.stage);

  return (
    <Box
      onClick={() => onOpen(c.companyKey)}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(c.companyKey); }}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: { xs: 1.5, sm: 1.75 },
        transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.18s ease',
        '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi, transform: 'translateY(-1px)' },
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: stageMeta(c.stage).color, opacity: customer ? 1 : 0.7,
          boxShadow: customer ? `0 0 10px -1px ${stageMeta(c.stage).color}` : 'none',
        },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.3 }}>
            {customer && <StarRateRoundedIcon sx={{ fontSize: 16, color: stageMeta('customer').color }} />}
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5, minWidth: 0 }}>{name}</Typography>
            <StageChip stage={c.stage} glow />
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[
              interestLabel(c.interestType) !== '—' ? interestLabel(c.interestType) : null,
              c.address || c.area,
              contactCount > 0 ? `${contactCount} contact${contactCount === 1 ? '' : 's'}` : null,
              c.lastContact ? `last ${fmtRelative(c.lastContact)}` : null,
            ].filter(Boolean).join(' · ') || 'No details yet'}
          </Typography>
          <TagChips tags={c.tags} size="tiny" max={5} sx={{ mt: 0.5 }} />
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0} onClick={(e) => onUnarchive && e.stopPropagation()}>
          {onUnarchive ? (
            <Button
              onClick={() => onUnarchive(c.companyKey)} size="small"
              startIcon={<RestoreFromTrashOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: 'none', color: D.green, fontWeight: 700, fontSize: 12,
                border: `1px solid ${D.line}`, borderRadius: 999, px: 1.25,
                '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.06)' } }}
            >
              Restore
            </Button>
          ) : (
            <>
              {c.nextFollowUp && (
                <Chip
                  label={fu.label} size="small"
                  sx={{ bgcolor: 'transparent', color: fu.tone, fontWeight: 700, fontSize: 11, ...mono,
                    border: `1px solid ${D.line}`, height: 22, display: { xs: 'none', sm: 'flex' } }}
                />
              )}
              {phone && <PhoneInTalkIcon sx={{ fontSize: 15, color: D.faint, display: { xs: 'none', sm: 'block' } }} />}
              <ChevronRightIcon sx={{ color: D.faint, fontSize: 20 }} />
            </>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export default function CompaniesView({
  clients, loading, query, onQueryChange, stage, onStageChange,
  tag, onTagChange, tagOptions, onOpen, archived = false, onUnarchive,
}) {
  // Archived mode runs its own client-side search (the archived set is fetched
  // separately and isn't wired to the live ?q= companies fetch).
  const [localQuery, setLocalQuery] = React.useState('');

  const archivedFiltered = React.useMemo(() => {
    if (!archived) return clients || [];
    const t = localQuery.trim().toLowerCase();
    if (!t) return clients || [];
    return (clients || []).filter((c) => {
      const hay = [
        c.companyName, c.clientName, c.companyKey, c.email, c.phone, c.address, c.area,
        ...(c.tags || []), ...((c.contacts || []).flatMap((x) => [x && x.name, x && x.email, x && x.phone])),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(t);
    });
  }, [archived, clients, localQuery]);

  const list = archived ? archivedFiltered : (clients || []);

  // ── Archived recover surface ────────────────────────────────────────────────
  if (archived) {
    return (
      <Stack spacing={2}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Inventory2OutlinedIcon sx={{ color: D.green, fontSize: 22 }} />
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18 }}>Archived</Typography>
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 13.5, mt: 0.5, lineHeight: 1.55 }}>
            Soft-archived companies — nothing was deleted. Restore any record to drop
            it straight back into your working lists.
          </Typography>
        </Box>

        <TextField
          value={localQuery} onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search archived…" size="small" fullWidth sx={dropInput}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SearchIcon sx={{ color: D.faint, fontSize: 20 }} /></InputAdornment>
          ) }}
        />

        <Typography sx={{ color: D.faint, fontSize: 12, fontWeight: 700, ...mono }}>
          {loading ? 'Loading…' : `${list.length} archived ${list.length === 1 ? 'record' : 'records'}`}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: D.green }} />
          </Box>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Inventory2OutlinedIcon />}
            title={localQuery ? 'No matches' : 'Nothing archived'}
            hint={localQuery ? 'Try a different search.' : 'Archived companies show up here, ready to restore.'}
          />
        ) : (
          <Stack spacing={1}>
            {list.map((c) => <CompanyRow key={c.companyKey} c={c} onOpen={onOpen} onUnarchive={onUnarchive} />)}
          </Stack>
        )}
      </Stack>
    );
  }

  const anyFilter = query || stage !== 'all' || tag !== 'all';

  return (
    <Stack spacing={2}>
      {/* Controls */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
        <TextField
          value={query} onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search companies, people, tags…" size="small" fullWidth sx={dropInput}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SearchIcon sx={{ color: D.faint, fontSize: 20 }} /></InputAdornment>
          ) }}
        />
        <TextField
          select value={stage} onChange={(e) => onStageChange(e.target.value)}
          size="small" sx={{ ...dropInput, minWidth: { sm: 150 } }} label="Stage"
        >
          <MenuItem value="all">All stages</MenuItem>
          {CRM_STAGES.map((s) => <MenuItem key={s} value={s}>{stageMeta(s).label}</MenuItem>)}
        </TextField>
        <TextField
          select value={tag} onChange={(e) => onTagChange(e.target.value)}
          size="small" sx={{ ...dropInput, minWidth: { sm: 150 } }} label="Tag"
          disabled={(tagOptions || []).length === 0}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><LocalOfferOutlinedIcon sx={{ color: D.faint, fontSize: 16 }} /></InputAdornment>
          ) }}
        >
          <MenuItem value="all">All tags</MenuItem>
          {(tagOptions || []).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ color: D.faint, fontSize: 12, fontWeight: 700, ...mono }}>
          {loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'company' : 'companies'}`}
        </Typography>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: D.green }} />
        </Box>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<PeopleAltOutlinedIcon />}
          title={anyFilter ? 'No matches' : 'No companies yet'}
          hint={anyFilter
            ? 'Try clearing a filter or the search.'
            : 'Import your field tracker to load your leads.'}
        />
      ) : (
        <Stack spacing={1}>
          {list.map((c) => <CompanyRow key={c.companyKey} c={c} onOpen={onOpen} />)}
        </Stack>
      )}
    </Stack>
  );
}
