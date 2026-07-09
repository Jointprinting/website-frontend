// src/screens/studio/crm/CompaniesView.js
// The full company list (/api/crm) — now one cohesive, SEGMENTED surface instead
// of a flat, choppy list. A single instant toggle splits the whole book into:
//   • Clients      — real customers (placed an order; the Phase-1 isCustomer)
//   • Active leads — warm / in-pipeline
//   • Everyone else— cold / dormant / parked
// Default is Clients (the people who pay). Switching is client-side and instant —
// the parent fetches the whole non-archived book once (search scopes it server-
// side); the segment + tag just narrow what's shown, so there's no page-to-page
// jank. Search-first; one click on a row → the full company thread.
//
// The old "filter by area" and "filter by temperature" controls are gone on
// purpose (the stages/segments already do that job) — fewer knobs, less noise.
//
// A dashboard-funnel drill-down can hand in a `stageFilter`: while set, the list
// narrows (client-side) to that stage across ALL segments and shows a dismissible
// "Stage: … ✕" chip; clearing it (or picking a segment) restores normal browsing.
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
import AddBusinessOutlinedIcon from '@mui/icons-material/AddBusinessOutlined';
import { D, mono, dropInput, fmtRelative } from '../_shared';
import {
  StageChip, EmptyState, TagChips, STAGE_META, stageMeta, followUpStatus,
  primaryPhone, isWonStage, CRM_SEGMENTS, SEGMENT_META, segmentOf,
} from './_crm';

// A tiny lead-quality badge (A–D) — how actionable this lead is for cold email +
// road visits (scored server-side in services/leadScore.js). Hover shows why.
// Shown on leads/prospects, not existing customers (their lead stage is behind them).
const GRADE_TONE = { A: D.green, B: D.amber, C: D.muted, D: '#f87171' };
function LeadGradeChip({ grade, reasons }) {
  if (!grade) return null;
  const tone = GRADE_TONE[grade] || D.faint;
  const title = reasons && reasons.length
    ? `Lead quality ${grade} — ${reasons.join(', ')}`
    : `Lead quality ${grade}`;
  return (
    <Box
      component="span" title={title}
      sx={{ ...mono, fontSize: 11, fontWeight: 800, color: tone, border: `1px solid ${tone}66`,
        borderRadius: 1, px: 0.6, lineHeight: 1.6, letterSpacing: 0.3, flexShrink: 0 }}
    >
      {grade}
    </Box>
  );
}

function CompanyRow({ c, onOpen, onUnarchive, bindCompany }) {
  const name = c.companyName || c.clientName || c.companyKey;
  const phone = primaryPhone(c);
  const fu = followUpStatus(c.nextFollowUp);
  const contactCount = (c.contacts || []).length;
  const customer = c.isCustomer || isWonStage(c.stage);

  return (
    <Box
      onClick={() => onOpen(c.companyKey)}
      {...(bindCompany ? bindCompany(c) : {})}
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
        },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.3 }}>
            {customer && <StarRateRoundedIcon sx={{ fontSize: 16, color: stageMeta('customer').color }} />}
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5, minWidth: 0 }}>{name}</Typography>
            <StageChip stage={c.stage} dot />
            {!customer && <LeadGradeChip grade={c.leadGrade} reasons={c.leadReasons} />}
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[
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

// The segment toggle — three pill tabs with live counts. Clients first (the
// people who pay). Instant: it only flips a client-side filter, no refetch.
function SegmentTabs({ segment, onSegmentChange, counts }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', useFlexGap: true }}>
      {CRM_SEGMENTS.map((id) => {
        const active = segment === id;
        const m = SEGMENT_META[id];
        return (
          <Box
            key={id}
            onClick={() => onSegmentChange(id)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onSegmentChange(id); }}
            sx={{
              cursor: 'pointer', userSelect: 'none', borderRadius: 999,
              px: 1.6, py: 0.7, display: 'flex', alignItems: 'center', gap: 0.75,
              border: `1px solid ${active ? D.green : D.line}`,
              bgcolor: active ? 'rgba(74,222,128,0.12)' : 'transparent',
              transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
              '&:hover': { borderColor: active ? D.green : D.lineHi,
                bgcolor: active ? 'rgba(74,222,128,0.16)' : 'rgba(255,255,255,0.03)' },
            }}
          >
            <Typography sx={{ color: active ? D.green : D.text, fontWeight: 800, fontSize: 13 }}>
              {m.label}
            </Typography>
            <Box component="span" sx={{ ...mono, fontSize: 11.5, fontWeight: 800,
              color: active ? D.green : D.faint }}>
              {counts[id] ?? 0}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export default function CompaniesView({
  clients, loading, query, onQueryChange,
  tag, onTagChange, tagOptions, onOpen, archived = false, onUnarchive, bindCompany,
  segment = 'clients', onSegmentChange, onAddCompany,
  stageFilter = null, onClearStageFilter,
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

  // Live segment counts across the loaded (non-archived) book, so the three
  // pill tabs always show how the whole set splits — independent of which
  // segment is active. Tag/search already scoped the fetched set server-side.
  const counts = React.useMemo(() => {
    const acc = { clients: 0, leads: 0, everyone: 0 };
    if (archived) return acc;
    (clients || []).forEach((c) => { acc[segmentOf(c)] += 1; });
    return acc;
  }, [clients, archived]);

  // The shown list = the active segment's slice of the loaded set — unless a
  // dashboard-funnel drill-down (stageFilter) is active: stages cut ACROSS the
  // three segments, so it narrows the whole book to that stage instead. Unknown
  // stages bucket as 'lead', mirroring the dashboard's funnel math. Picking a
  // segment manually clears the drill-down (the parent owns that), so normal
  // segment browsing keeps working exactly as today.
  const segmented = React.useMemo(() => {
    if (archived) return archivedFiltered;
    if (stageFilter) return (clients || []).filter((c) => (STAGE_META[c.stage] ? c.stage : 'lead') === stageFilter);
    return (clients || []).filter((c) => segmentOf(c) === segment);
  }, [archived, archivedFiltered, clients, segment, stageFilter]);

  const list = segmented;

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

  const m = SEGMENT_META[segment] || SEGMENT_META.clients;
  const anyFilter = query || tag !== 'all' || !!stageFilter;
  const stageM = stageFilter ? stageMeta(stageFilter) : null;

  return (
    <Stack spacing={2}>
      {/* Search + add + tag */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
        <TextField
          value={query} onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search companies, people, tags…" size="small" fullWidth sx={dropInput}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SearchIcon sx={{ color: D.faint, fontSize: 20 }} /></InputAdornment>
          ) }}
        />
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
        {onAddCompany && (
          <Button
            onClick={onAddCompany}
            startIcon={<AddBusinessOutlinedIcon sx={{ fontSize: 18 }} />}
            sx={{ textTransform: 'none', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap',
              color: D.ink, bgcolor: D.green, borderRadius: 999, px: 2,
              boxShadow: `0 6px 18px ${D.glow}`,
              '&:hover': { bgcolor: '#5cec8e', boxShadow: `0 10px 26px ${D.glow}` } }}
          >
            Add company
          </Button>
        )}
      </Stack>

      {/* Funnel drill-down chip — set by tapping a dashboard funnel row. While
          active the list shows that stage across ALL segments; ✕ (or picking a
          segment) returns to normal browsing. */}
      {stageFilter && (
        <Box>
          <Chip
            label={`Stage: ${stageM.label}`}
            size="small"
            onDelete={onClearStageFilter}
            sx={{
              bgcolor: stageM.bg, color: stageM.color, fontWeight: 800, fontSize: 11.5,
              height: 24, border: `1px solid ${stageM.color}55`, letterSpacing: 0.2,
              '& .MuiChip-deleteIcon': { color: `${stageM.color}b3`, '&:hover': { color: stageM.color } },
            }}
          />
        </Box>
      )}

      {/* Segment toggle — Clients / Active leads / Everyone else (instant) */}
      {onSegmentChange && (
        <SegmentTabs segment={segment} onSegmentChange={onSegmentChange} counts={counts} />
      )}

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography sx={{ color: D.faint, fontSize: 12, fontWeight: 700, ...mono, flexShrink: 0 }}>
            {loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'company' : 'companies'}`}
          </Typography>
        </Stack>
        <Typography sx={{ color: D.faint, fontSize: 11.5, display: { xs: 'none', sm: 'block' } }}>
          {stageFilter ? `Every ${stageM.label.toLowerCase()}-stage company, all segments` : m.hint}
        </Typography>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: D.green }} />
        </Box>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<PeopleAltOutlinedIcon />}
          title={anyFilter ? 'No matches' : `No ${m.label.toLowerCase()} yet`}
          hint={anyFilter ? 'No matches — try clearing the search or tag.' : undefined}
        />
      ) : (
        <Stack spacing={1}>
          {list.map((c) => <CompanyRow key={c.companyKey} c={c} onOpen={onOpen} bindCompany={bindCompany} />)}
        </Stack>
      )}
    </Stack>
  );
}
