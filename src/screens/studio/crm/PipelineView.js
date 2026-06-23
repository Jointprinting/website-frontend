// src/screens/studio/crm/PipelineView.js
// The sales pipeline as a Kanban board (/api/crm/pipeline). Columns are the
// stages; each card is a company. Drag a card from one column to another to
// advance/regress its stage → the parent PATCHes { stage } (optimistic, then a
// /pipeline refetch reconciles) — the SAME native-HTML5-drag approach the
// CalendarView uses to reschedule, so there's no drag library to carry.
//
// Layout: the active lane (lead → … → won/customer) is the primary board; lost
// & dormant live in a collapsible "Closed / parked" lane below so they don't
// crowd the working columns. The board header shows total open pipeline $ and
// the weighted forecast $ straight from /pipeline. Dropping a card into Lost is
// intercepted by the parent to ask for a reason first.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, MenuItem, InputAdornment, CircularProgress, Button, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { D, mono, dropInput } from '../_shared';
import {
  StageChip, EmptyState, TagChips, stageMeta, followUpStatus, fmtMoney0,
  PIPELINE_STAGES, SECONDARY_STAGES, STAGE_PROBABILITY,
} from './_crm';

// A draggable company card. Mirrors CalendarView's EventChip drag contract:
// onDragStart/onDragEnd bubble to the board, which owns the in-flight ref.
function PipelineCard({ card, onOpen, onDragStart, onDragEnd, dragging }) {
  const m = stageMeta(card.stage);
  const fu = followUpStatus(card.nextFollowUp);
  return (
    <Box
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onDragEnd={onDragEnd}
      onClick={(e) => { e.stopPropagation(); onOpen(card.companyKey); }}
      title={`${card.name}${card.area ? ` · ${card.area}` : ''} — drag to change stage`}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: 'grab',
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2, p: 1.25,
        opacity: dragging ? 0.35 : 1,
        transition: 'opacity 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
        '&:hover': { borderColor: D.lineHi, transform: 'translateY(-1px)', boxShadow: `0 6px 16px -6px ${m.color}66` },
        '&:active': { cursor: 'grabbing' },
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: m.color, opacity: 0.8,
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ pl: 0.5 }}>
        <Typography sx={{
          color: D.text, fontWeight: 800, fontSize: 13, lineHeight: 1.3, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {card.name}
        </Typography>
        {card.dealValue > 0 && (
          <Typography sx={{ ...mono, color: D.green, fontWeight: 800, fontSize: 12.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {fmtMoney0(card.dealValue)}
          </Typography>
        )}
      </Stack>

      {(card.nextFollowUp || (card.tags && card.tags.length > 0)) && (
        <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={0.5} sx={{ mt: 0.85, pl: 0.5 }}>
          {card.nextFollowUp && (
            <Chip
              label={fu.label} size="small"
              sx={{ bgcolor: 'transparent', color: fu.tone, fontWeight: 700, fontSize: 10, ...mono,
                border: `1px solid ${D.line}`, height: 18, '& .MuiChip-label': { px: 0.75 } }}
            />
          )}
          <TagChips tags={card.tags} size="tiny" max={3} />
        </Stack>
      )}
    </Box>
  );
}

// A single stage column: header (stage chip + count + total $) and a droppable,
// scrollable card list. Highlights when a card is dragged over it.
function StageColumn({ group, isOver, onOpen, onDragStart, onDragEnd, onDrop, onDragOverCol, onDragLeaveCol, draggingKey }) {
  const m = stageMeta(group.stage);
  const cards = group.clients || [];
  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); onDragOverCol(group.stage); }}
      onDragLeave={() => onDragLeaveCol(group.stage)}
      onDrop={(e) => { e.preventDefault(); onDrop(group.stage); }}
      sx={{
        width: { xs: 248, md: 264 }, flexShrink: 0, display: 'flex', flexDirection: 'column',
        bgcolor: isOver ? 'rgba(74,222,128,0.06)' : D.inset,
        border: `1px solid ${isOver ? D.green : D.line}`, borderRadius: 2.5,
        outline: isOver ? `1px solid ${D.green}` : 'none', outlineOffset: -2,
        transition: 'background 0.12s ease, border-color 0.12s ease',
        maxHeight: '100%',
      }}
    >
      {/* Column header */}
      <Box sx={{ p: 1.25, borderBottom: `1px solid ${D.line}`,
        borderTop: `2px solid ${m.color}`, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <StageChip stage={group.stage} />
            <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5, fontWeight: 700 }}>{group.count}</Typography>
          </Stack>
          {group.totalValue > 0 && (
            <Typography sx={{ ...mono, color: D.muted, fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
              {fmtMoney0(group.totalValue)}
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Cards */}
      <Box sx={{
        p: 1, flexGrow: 1, minHeight: 80, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 1,
        '&::-webkit-scrollbar': { width: 5 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3 },
      }}>
        {cards.length === 0 ? (
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 60 }}>
            <Typography sx={{ color: D.faint, fontSize: 11.5, opacity: isOver ? 1 : 0.6 }}>
              {isOver ? 'Drop here' : 'Empty'}
            </Typography>
          </Box>
        ) : cards.map((card) => (
          <PipelineCard
            key={card.companyKey}
            card={card}
            onOpen={onOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={draggingKey === card.companyKey}
          />
        ))}
      </Box>
    </Box>
  );
}

// One headline metric in the board summary band.
function Metric({ label, value, tone }) {
  return (
    <Box>
      <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ ...mono, color: tone || D.text, fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function PipelineView({
  groups, summary, probability, loading,
  query, onQueryChange, tag, onTagChange, tagOptions,
  onOpen, onMoveStage,
}) {
  const byStage = React.useMemo(() => {
    const map = {};
    (groups || []).forEach((g) => { map[g.stage] = g; });
    return map;
  }, [groups]);

  // Seed a group for any stage missing from the payload so columns always show.
  const groupFor = React.useCallback(
    (s) => byStage[s] || { stage: s, count: 0, totalValue: 0, clients: [] },
    [byStage],
  );

  const probMap = probability || STAGE_PROBABILITY;

  // Secondary lane (lost/dormant) collapsed by default — opened on demand.
  const [showClosed, setShowClosed] = React.useState(false);
  const closedCount = SECONDARY_STAGES.reduce((n, s) => n + (groupFor(s).count || 0), 0);

  // ── Drag state (same contract as CalendarView) ──────────────────────────────
  const [dragState, setDragState] = React.useState({ activeKey: null, overStage: null });
  const draggedRef = React.useRef(null);

  const handleDragStart = (e, card) => {
    draggedRef.current = card;
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.companyKey); // Firefox needs payload to drag
    } catch (_) { /* ref is the source of truth */ }
    setDragState({ activeKey: card.companyKey, overStage: null });
  };
  const handleDragEnd = () => { draggedRef.current = null; setDragState({ activeKey: null, overStage: null }); };
  const handleDragOverCol = (stage) => setDragState((s) => (s.overStage === stage ? s : { ...s, overStage: stage }));
  const handleDragLeaveCol = (stage) => setDragState((s) => (s.overStage === stage ? { ...s, overStage: null } : s));

  const handleDrop = (stage) => {
    const card = draggedRef.current;
    draggedRef.current = null;
    setDragState({ activeKey: null, overStage: null });
    if (!card || !stage) return;
    if (card.stage === stage) return; // dropped on its own column — no-op
    onMoveStage(card.companyKey, stage, card);
  };

  const renderColumn = (s) => (
    <StageColumn
      key={s}
      group={groupFor(s)}
      isOver={dragState.overStage === s}
      onOpen={onOpen}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
      onDragOverCol={handleDragOverCol}
      onDragLeaveCol={handleDragLeaveCol}
      draggingKey={dragState.activeKey}
    />
  );

  const totalCards = PIPELINE_STAGES.reduce((n, s) => n + (groupFor(s).count || 0), 0) + closedCount;

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      {/* Summary band */}
      <Box sx={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 2, sm: 4 },
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 },
      }}>
        <Metric label="Open pipeline" value={fmtMoney0(summary?.totalOpenValue || 0)} tone={D.text} />
        <Box sx={{ width: 1, alignSelf: 'stretch', bgcolor: D.line, display: { xs: 'none', sm: 'block' } }} />
        <Metric label="Weighted forecast" value={fmtMoney0(summary?.weightedValue || 0)} tone={D.green} />
        <Box sx={{ flexGrow: 1 }} />
        {loading && <CircularProgress size={18} sx={{ color: D.green }} />}
      </Box>

      {/* Filters — same pattern as CompaniesView (search + tag select) */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
        <TextField
          value={query} onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search the board…" size="small" fullWidth sx={dropInput}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SearchIcon sx={{ color: D.faint, fontSize: 20 }} /></InputAdornment>
          ) }}
        />
        <TextField
          select value={tag} onChange={(e) => onTagChange(e.target.value)}
          size="small" sx={{ ...dropInput, minWidth: { sm: 170 } }} label="Tag"
          disabled={(tagOptions || []).length === 0}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><LocalOfferOutlinedIcon sx={{ color: D.faint, fontSize: 17 }} /></InputAdornment>
          ) }}
        >
          <MenuItem value="all">All tags</MenuItem>
          {(tagOptions || []).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      </Stack>

      {/* Board */}
      {loading && totalCards === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: D.green }} />
        </Box>
      ) : totalCards === 0 ? (
        <EmptyState
          icon={<ViewKanbanOutlinedIcon />}
          title={query || tag !== 'all' ? 'No matches' : 'Your pipeline is empty'}
          hint={query || tag !== 'all'
            ? 'Try clearing the search or tag filter.'
            : 'Add a deal value + stage on a company to see it here.'}
        />
      ) : (
        <>
          {/* Active lane — horizontally scrollable row of columns */}
          <Box sx={{
            display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1,
            alignItems: 'stretch', minHeight: 320,
            '&::-webkit-scrollbar': { height: 8 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 4 },
          }}>
            {PIPELINE_STAGES.map(renderColumn)}
          </Box>

          {/* Secondary lane — lost / dormant, collapsed by default */}
          <Box>
            <Button
              onClick={() => setShowClosed((v) => !v)}
              startIcon={showClosed ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              sx={{ textTransform: 'none', color: D.muted, fontWeight: 700, fontSize: 12.5, px: 1,
                '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.03)' } }}
            >
              Closed / parked
              <Box component="span" sx={{ ...mono, ml: 0.75, color: D.faint, fontWeight: 700 }}>({closedCount})</Box>
            </Button>
            {showClosed && (
              <Box sx={{
                display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, mt: 0.5,
                alignItems: 'stretch', minHeight: 200,
                '&::-webkit-scrollbar': { height: 8 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 4 },
              }}>
                {SECONDARY_STAGES.map(renderColumn)}
              </Box>
            )}
          </Box>
        </>
      )}

      <Typography sx={{ color: D.faint, fontSize: 11.5, textAlign: 'center' }}>
        Drag a card to another column to change its stage · tap a card to open it · forecast weights each stage by close-rate
        {` (lead ${Math.round((probMap.lead ?? 0.1) * 100)}% → sampling ${Math.round((probMap.sampling ?? 0.7) * 100)}%)`}.
      </Typography>
    </Stack>
  );
}
