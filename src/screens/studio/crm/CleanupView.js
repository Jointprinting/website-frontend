// src/screens/studio/crm/CleanupView.js
// The one-click cleanup surface the owner was promised. Two sections:
//   1) Duplicates — groups of likely-duplicate companies (fuzzy name match). For
//      each group, pick a survivor and Merge; the backend folds contacts/log/
//      deal value/notes/tags into the survivor, re-points the merged company's
//      orders, and soft-deletes (archives) the merged record. Nothing is lost.
//   2) Dead / no-follow-up — a filtered list of leads that are closed or have no
//      next step (and no orders), with a one-tap bulk Archive. Soft-delete only.
//
// All data + transport lives in the parent (CrmTab); this view is presentational
// and calls onMerge / onArchive / onRefresh.

import * as React from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Radio, Chip, Divider,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { D, mono, dropPrimaryBtn, dropGhostBtn } from '../_shared';
import { StageChip, EmptyState, Eyebrow, followUpStatus } from './_crm';

// One member row inside a duplicate group, with a survivor radio.
function MemberRow({ m, selected, onSelect }) {
  return (
    <Box
      onClick={onSelect}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, cursor: 'pointer',
        bgcolor: selected ? 'rgba(74,222,128,0.07)' : 'transparent',
        border: `1px solid ${selected ? D.lineHi : 'transparent'}`,
        '&:hover': { bgcolor: selected ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.03)' },
      }}
    >
      <Radio checked={selected} size="small" sx={{ color: D.faint, p: 0.5, '&.Mui-checked': { color: D.green } }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13.5 }}>{m.name}</Typography>
          <StageChip stage={m.stage} />
          {m.hasOrders && (
            <Chip label="has orders" size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(45,212,191,0.12)', color: '#5eead4' }} />
          )}
        </Stack>
        <Typography sx={{ color: D.faint, fontSize: 11.5, ...mono, mt: 0.2 }}>
          {[
            m.companyKey,
            m.contacts ? `${m.contacts} contact${m.contacts === 1 ? '' : 's'}` : null,
            m.logEntries ? `${m.logEntries} log` : null,
            m.dealValue ? `$${Math.round(m.dealValue).toLocaleString('en-US')}` : null,
          ].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      {selected && <Typography sx={{ color: D.green, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5 }}>SURVIVOR</Typography>}
    </Box>
  );
}

function DuplicateGroup({ group, onMerge }) {
  const [survivor, setSurvivor] = React.useState(group.suggestedSurvivor);
  const [busy, setBusy] = React.useState(false);
  const others = group.members.filter((m) => m.companyKey !== survivor);

  const doMerge = async () => {
    setBusy(true);
    try {
      // Fold every other member into the chosen survivor (one call per pair).
      for (const m of others) {
        // eslint-disable-next-line no-await-in-loop
        await onMerge(survivor, m.companyKey);
      }
    } finally { setBusy(false); }
  };

  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 1.75 }}>
      <Stack spacing={0.5}>
        {group.members.map((m) => (
          <MemberRow key={m.companyKey} m={m} selected={m.companyKey === survivor} onSelect={() => setSurvivor(m.companyKey)} />
        ))}
      </Stack>
      <Divider sx={{ borderColor: D.line, my: 1.25 }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
          Merges {others.length} other {others.length === 1 ? 'record' : 'records'} in. Orders &amp; history are preserved.
        </Typography>
        <Button onClick={doMerge} disabled={busy || others.length === 0} size="small" sx={{ ...dropPrimaryBtn, py: 0.5 }} startIcon={!busy ? <MergeTypeOutlinedIcon /> : null}>
          {busy ? <CircularProgress size={16} sx={{ color: D.ink }} /> : 'Merge'}
        </Button>
      </Stack>
    </Box>
  );
}

// A dead/no-follow-up candidate row with a select checkbox (via Radio-as-toggle).
function DeadRow({ c, checked, onToggle }) {
  const fu = followUpStatus(c.nextFollowUp);
  return (
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, cursor: 'pointer',
        bgcolor: checked ? 'rgba(248,113,113,0.06)' : D.panel,
        border: `1px solid ${checked ? 'rgba(248,113,113,0.4)' : D.line}`,
        '&:hover': { borderColor: checked ? 'rgba(248,113,113,0.4)' : D.lineHi },
      }}
    >
      <Radio checked={checked} size="small" sx={{ color: D.faint, p: 0.5, '&.Mui-checked': { color: '#f87171' } }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13.5 }}>{c.companyName || c.clientName || c.companyKey}</Typography>
          <StageChip stage={c.stage} />
        </Stack>
        <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.2 }}>
          {c.nextFollowUp ? fu.label : 'No follow-up scheduled'}{(c.address || c.area) ? ` · ${c.address || c.area}` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

export default function CleanupView({
  duplicates, duplicatesLoading, deadCandidates, deadLoading,
  onMerge, onArchive, onRefresh,
}) {
  const [tab, setTab] = React.useState('duplicates');
  const [selected, setSelected] = React.useState(() => new Set());
  const [busy, setBusy] = React.useState(false);

  // Reset selection whenever the candidate set changes (after an archive/refresh).
  React.useEffect(() => { setSelected(new Set()); }, [deadCandidates]);

  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allKeys = (deadCandidates || []).map((c) => c.companyKey);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allKeys));

  const archiveSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try { await onArchive([...selected]); } finally { setBusy(false); }
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <CleaningServicesOutlinedIcon sx={{ color: D.green, fontSize: 22 }} />
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18 }}>Clean up</Typography>
        </Stack>
        <Typography sx={{ color: D.muted, fontSize: 13.5, mt: 0.5, lineHeight: 1.55 }}>
          Fix the mess without hand-deleting. Merge duplicate companies (orders &amp; history are kept) and archive dead leads. Everything here is a soft-archive — nothing is permanently deleted, and archived records can be restored.
        </Typography>
      </Box>

      <ToggleButtonGroup
        value={tab} exclusive size="small"
        onChange={(_, v) => v && setTab(v)}
        sx={{
          '& .MuiToggleButton-root': {
            textTransform: 'none', fontWeight: 700, fontSize: 13, color: D.muted, border: `1px solid ${D.line}`,
            px: 2, '&.Mui-selected': { color: D.ink, bgcolor: D.green, '&:hover': { bgcolor: '#5cec8e' } },
          },
        }}
      >
        <ToggleButton value="duplicates">
          <MergeTypeOutlinedIcon sx={{ fontSize: 17, mr: 0.75 }} />
          Duplicates{(duplicates || []).length ? ` (${duplicates.length})` : ''}
        </ToggleButton>
        <ToggleButton value="dead">
          <Inventory2OutlinedIcon sx={{ fontSize: 17, mr: 0.75 }} />
          Dead / no follow-up{(deadCandidates || []).length ? ` (${deadCandidates.length})` : ''}
        </ToggleButton>
      </ToggleButtonGroup>

      {/* ── Duplicates ── */}
      {tab === 'duplicates' && (
        duplicatesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: D.green }} /></Box>
        ) : (duplicates || []).length === 0 ? (
          <EmptyState icon={<TaskAltOutlinedIcon />} title="No duplicates found" hint="Every company looks distinct. Re-run a check after your next import." />
        ) : (
          <Stack spacing={1.5}>
            {duplicates.map((g) => (
              <DuplicateGroup key={g.matchKey} group={g} onMerge={async (s, m) => { await onMerge(s, m); }} />
            ))}
          </Stack>
        )
      )}

      {/* ── Dead / no follow-up ── */}
      {tab === 'dead' && (
        deadLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: D.green }} /></Box>
        ) : (deadCandidates || []).length === 0 ? (
          <EmptyState icon={<TaskAltOutlinedIcon />} title="Nothing to archive" hint="No dead or no-follow-up leads (without orders or activity) right now." />
        ) : (
          <Stack spacing={1.25}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Button onClick={toggleAll} size="small" sx={{ ...dropGhostBtn, py: 0.4 }}>
                {allSelected ? 'Clear all' : 'Select all'}
              </Button>
              <Eyebrow>{selected.size} selected · {deadCandidates.length} candidates</Eyebrow>
            </Stack>
            <Stack spacing={1}>
              {deadCandidates.map((c) => (
                <DeadRow key={c.companyKey} c={c} checked={selected.has(c.companyKey)} onToggle={() => toggle(c.companyKey)} />
              ))}
            </Stack>
            <Button
              onClick={archiveSelected} disabled={busy || selected.size === 0}
              sx={{ ...dropPrimaryBtn, alignSelf: 'flex-start', bgcolor: '#f87171', color: '#1a0a0a', '&:hover': { bgcolor: '#fb8c8c' } }}
              startIcon={!busy ? <Inventory2OutlinedIcon /> : null}
            >
              {busy ? <CircularProgress size={18} sx={{ color: '#1a0a0a' }} /> : `Archive ${selected.size || ''} selected`}
            </Button>
          </Stack>
        )
      )}
    </Stack>
  );
}
