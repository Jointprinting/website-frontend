// src/screens/studio/crm/CompaniesView.js
// The full company list (/api/crm) with a search box (q) and stage / area
// filters. Debounced search + stage filter are lifted to the parent so the
// fetch lives in one place; area filtering is done client-side off the loaded
// set (the API supports ?area= but a client-side select over the distinct areas
// already present is friendlier — no empty-result surprises). Rows open the
// company detail.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, MenuItem, InputAdornment, CircularProgress, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { D, mono, dropInput, fmtRelative } from '../_shared';
import {
  StageChip, EmptyState, TagChips, CRM_STAGES, stageMeta, interestLabel, followUpStatus,
  primaryPhone,
} from './_crm';

function CompanyRow({ c, onOpen }) {
  const name = c.companyName || c.clientName || c.companyKey;
  const phone = primaryPhone(c);
  const fu = followUpStatus(c.nextFollowUp);
  const contactCount = (c.contacts || []).length;

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
          bgcolor: stageMeta(c.stage).color, opacity: 0.7,
        },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.3 }}>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5, minWidth: 0 }}>{name}</Typography>
            <StageChip stage={c.stage} />
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[
              interestLabel(c.interestType) !== '—' ? interestLabel(c.interestType) : null,
              c.area,
              contactCount > 0 ? `${contactCount} contact${contactCount === 1 ? '' : 's'}` : null,
              c.lastContact ? `last ${fmtRelative(c.lastContact)}` : null,
            ].filter(Boolean).join(' · ') || 'No details yet'}
          </Typography>
          <TagChips tags={c.tags} size="tiny" max={5} sx={{ mt: 0.5 }} />
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
          {c.nextFollowUp && (
            <Chip
              label={fu.label} size="small"
              sx={{ bgcolor: 'transparent', color: fu.tone, fontWeight: 700, fontSize: 11, ...mono,
                border: `1px solid ${D.line}`, height: 22, display: { xs: 'none', sm: 'flex' } }}
            />
          )}
          {phone && <PhoneInTalkIcon sx={{ fontSize: 15, color: D.faint, display: { xs: 'none', sm: 'block' } }} />}
          <ChevronRightIcon sx={{ color: D.faint, fontSize: 20 }} />
        </Stack>
      </Stack>
    </Box>
  );
}

export default function CompaniesView({
  clients, loading, query, onQueryChange, stage, onStageChange,
  tag, onTagChange, tagOptions, onOpen,
}) {
  const [area, setArea] = React.useState('all');

  // Distinct, non-empty areas from the loaded set, for the area filter.
  const areas = React.useMemo(() => {
    const set = new Set();
    (clients || []).forEach((c) => { if (c.area) set.add(c.area); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients]);

  const filtered = React.useMemo(
    () => (area === 'all' ? clients : (clients || []).filter((c) => c.area === area)),
    [clients, area],
  );

  return (
    <Stack spacing={2}>
      {/* Controls */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
        <TextField
          value={query} onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search companies, contacts…" size="small" fullWidth sx={dropInput}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SearchIcon sx={{ color: D.faint, fontSize: 20 }} /></InputAdornment>
          ) }}
        />
        <TextField
          select value={stage} onChange={(e) => onStageChange(e.target.value)}
          size="small" sx={{ ...dropInput, minWidth: { sm: 140 } }} label="Stage"
        >
          <MenuItem value="all">All stages</MenuItem>
          {CRM_STAGES.map((s) => <MenuItem key={s} value={s}>{stageMeta(s).label}</MenuItem>)}
        </TextField>
        <TextField
          select value={area} onChange={(e) => setArea(e.target.value)}
          size="small" sx={{ ...dropInput, minWidth: { sm: 140 } }} label="Area"
          disabled={areas.length === 0}
        >
          <MenuItem value="all">All areas</MenuItem>
          {areas.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField
          select value={tag} onChange={(e) => onTagChange(e.target.value)}
          size="small" sx={{ ...dropInput, minWidth: { sm: 140 } }} label="Tag"
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
          {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'company' : 'companies'}`}
        </Typography>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: D.green }} />
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PeopleAltOutlinedIcon />}
          title={query || stage !== 'all' || area !== 'all' || tag !== 'all' ? 'No matches' : 'No companies yet'}
          hint={query || stage !== 'all' || area !== 'all' || tag !== 'all'
            ? 'Try clearing a filter or the search.'
            : 'Import your field tracker to load your leads.'}
        />
      ) : (
        <Stack spacing={1}>
          {filtered.map((c) => <CompanyRow key={c.companyKey} c={c} onOpen={onOpen} />)}
        </Stack>
      )}
    </Stack>
  );
}
