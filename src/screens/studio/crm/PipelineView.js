// src/screens/studio/crm/PipelineView.js
// The sales pipeline as an ORDER-CENTRIC Kanban board (/api/crm/pipeline). It's
// "one client → many orders": the lead/contacted columns hold pre-quote COMPANY
// cards (a prospect not yet quoting); quoting → … → delivered hold ORDER cards —
// one card per job. So a company with three live orders shows three cards across
// the fulfillment columns, and a brand-new lead shows one lead card. Drag a card
// to another column to advance it:
//   • a LEAD card → another lead column, or into Quoting (which mints/opens its
//     project via the parent's handoff and deep-links to the order page);
//   • an ORDER card → another fulfillment column, persisting Order.status.
// Native HTML5 drag (the SAME approach CalendarView uses to reschedule) — no drag
// library. Lost / Dormant / Cancelled live in a collapsible "Closed / parked"
// lane below. The header shows total open pipeline $ and the weighted forecast $
// straight from /pipeline. Dropping a (lead) card into Lost is intercepted by the
// parent to ask for a reason first.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, MenuItem, InputAdornment, CircularProgress, Button, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import SortOutlinedIcon from '@mui/icons-material/SortOutlined';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { D, mono, dropInput } from '../_shared';
import {
  EmptyState, followUpStatus, fmtMoney0,
  BOARD_COLUMNS, BOARD_CLOSED_COLUMNS, boardColumnMeta, BOARD_PROBABILITY,
  isWonColumn, tempMeta, ORDER_BOARD_COLUMNS, LEAD_BOARD_COLUMNS,
} from './_crm';

// Within-column sort options.
const SORTS = [
  { value: 'value', label: 'Deal value (high→low)' },
  { value: 'followup', label: 'Follow-up (soonest)' },
  { value: 'name', label: 'Name (A→Z)' },
];

// A YYYY-MM-DD key sorts lexically the same as chronologically; null/empty sink
// to the bottom for "soonest first".
const fuSortKey = (c) => (c.nextFollowUp ? new Date(c.nextFollowUp).getTime() : Number.POSITIVE_INFINITY);

function sortCards(cards, sort) {
  const arr = [...(cards || [])];
  if (sort === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (sort === 'followup') arr.sort((a, b) => fuSortKey(a) - fuSortKey(b));
  else arr.sort((a, b) => (Number(b.dealValue) || 0) - (Number(a.dealValue) || 0)); // value (default)
  return arr;
}

// A column-local board chip (label + color from the board-column meta). Replaces
// the stage-keyed StageChip so order columns (Quoting/Approval/…) get a chip too.
function ColumnChip({ col }) {
  const m = boardColumnMeta(col);
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.2, borderRadius: 1,
      bgcolor: m.bg, border: `1px solid ${m.color}55`,
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color }} />
      <Typography sx={{ color: m.color, fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>{m.label}</Typography>
    </Box>
  );
}

// The ONE temperature signal a card shows: the hottest known temp tag (hot >
// warm > cold > the rest), or null. Engagement-level / order-ref noise never
// reaches here (those are filtered as hidden tags), so a card's heat dot is a
// real hot/warm/cold read, not import clutter. Order cards carry no tags today,
// so this is naturally a no-op for them.
const TEMP_RANK = { hot: 3, warm: 2, 'room-temp': 1, 'room temp': 1, cold: 1 };
function cardHeat(tags) {
  let best = null;
  let bestRank = 0;
  for (const t of (tags || [])) {
    const r = TEMP_RANK[String(t).toLowerCase().trim()] || 0;
    if (r > bestRank) { best = tempMeta(t); bestRank = r; }
  }
  return best;
}

// A draggable card — deliberately SPARSE (owner: "declutter it"). It shows only
// what scans a pipeline at a glance:
//   • company name
//   • a project-number chip (#138) on ORDER cards, so a company's many jobs read apart
//   • deal value
//   • a subtle temperature dot (hot/warm/cold) when known (lead cards)
//   • a single follow-up / overdue indicator (lead cards' next-step signal)
// `card.stage` is the BOARD COLUMN id (lead/contacted/quoting/…); `card.cardKind`
// is 'lead' or 'order'. Mirrors CalendarView's EventChip drag contract:
// onDragStart/onDragEnd bubble to the board, which owns the in-flight ref.
function PipelineCard({ card, onOpen, onDragStart, onDragEnd, dragging, locked, bindCompany }) {
  const col = card.stage;
  const m = boardColumnMeta(col);
  const isOrder = card.cardKind === 'order';
  const fu = followUpStatus(card.nextFollowUp);
  const won = isWonColumn(col);
  const heat = isOrder ? null : cardHeat(card.tags);
  // The accent rail reads the card's heat when known, else its column; a won
  // (delivered) card always glows green.
  const railColor = won ? boardColumnMeta('delivered').color : (heat ? heat.color : m.color);
  return (
    <Box
      draggable={!locked}
      onDragStart={(e) => onDragStart(e, card)}
      onDragEnd={onDragEnd}
      onClick={(e) => { e.stopPropagation(); onOpen(card); }}
      {...(bindCompany ? bindCompany(card) : {})}
      title={`${card.name}${isOrder && card.projectNumber ? ` · #${card.projectNumber}` : ''}${card.address || card.area ? ` · ${card.address || card.area}` : ''}${heat ? ` · ${heat.label}` : ''} — drag to ${isOrder ? 'change status' : 'change stage'}`}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: locked ? 'wait' : 'grab',
        bgcolor: D.panel, border: `1px solid ${won ? 'rgba(74,222,128,0.4)' : D.line}`, borderRadius: 2, p: 1.25,
        opacity: dragging ? 0.35 : (locked ? 0.6 : 1),
        transition: 'opacity 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
        '&:hover': { borderColor: D.lineHi, transform: 'translateY(-1px)', boxShadow: `0 6px 16px -6px ${railColor}66` },
        '&:active': { cursor: locked ? 'wait' : 'grabbing' },
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: railColor, opacity: won ? 1 : 0.8,
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ pl: 0.5 }}>
        <Stack direction="row" alignItems="flex-start" spacing={0.75} sx={{ minWidth: 0 }}>
          {/* Subtle temperature dot — hot/warm/cold at a glance (lead cards only). */}
          {heat && (
            <Box title={heat.label} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: heat.dot,
              mt: '4px', flexShrink: 0 }} />
          )}
          <Stack spacing={0.4} sx={{ minWidth: 0 }}>
            <Typography sx={{
              color: D.text, fontWeight: 800, fontSize: 13, lineHeight: 1.3, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {card.name}
            </Typography>
            {/* Project-number chip — the per-order identity, so a company's many
                jobs are visually distinct. Mono, small, low-key. */}
            {isOrder && card.projectNumber && (
              <Box component="span" sx={{ ...mono, alignSelf: 'flex-start', fontSize: 10, fontWeight: 800,
                color: D.muted, bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${D.line}`,
                borderRadius: 0.75, px: 0.6, py: 0.05, lineHeight: 1.4 }}>
                #{card.projectNumber}
              </Box>
            )}
          </Stack>
        </Stack>
        {card.dealValue > 0 && (
          <Typography sx={{ ...mono, color: D.green, fontWeight: 800, fontSize: 12.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {fmtMoney0(card.dealValue)}
          </Typography>
        )}
      </Stack>

      {/* Next-step / overdue indicator — the one status line (lead cards). */}
      {card.nextFollowUp && (
        <Stack direction="row" alignItems="center" sx={{ mt: 0.85, pl: 0.5 }}>
          <Chip
            icon={<EventOutlinedIcon sx={{ fontSize: 12 }} />}
            label={fu.label} size="small"
            sx={{ bgcolor: 'transparent', color: fu.tone, fontWeight: 700, fontSize: 10, ...mono,
              border: `1px solid ${fu.overdue ? 'rgba(248,113,113,0.4)' : D.line}`, height: 18,
              '& .MuiChip-label': { px: 0.6 }, '& .MuiChip-icon': { color: fu.tone, ml: 0.5, mr: -0.25 } }}
          />
        </Stack>
      )}
    </Box>
  );
}

// A single board column: header (column chip + count + total $) and a droppable,
// scrollable card list. Highlights when a card is dragged over it AND the drop is
// valid for the card being dragged (so an illegal target reads as "not here").
function BoardColumn({ group, isOver, canDrop, onOpen, onDragStart, onDragEnd, onDrop, onDragOverCol, onDragLeaveCol, draggingKey, lockedKeys, bindCompany }) {
  const col = group.stage;
  const m = boardColumnMeta(col);
  const won = isWonColumn(col);
  const cards = group.clients || [];
  // Only paint the "drop here" affordance when the hovered card may actually land.
  const active = isOver && canDrop;
  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); onDragOverCol(col); }}
      onDragLeave={() => onDragLeaveCol(col)}
      onDrop={(e) => { e.preventDefault(); onDrop(col); }}
      sx={{
        width: { xs: 248, md: 264 }, flexShrink: 0, display: 'flex', flexDirection: 'column',
        bgcolor: active ? 'rgba(74,222,128,0.06)' : D.inset,
        border: `1px solid ${active ? D.green : D.line}`, borderRadius: 2.5,
        outline: active ? `1px solid ${D.green}` : 'none', outlineOffset: -2,
        transition: 'background 0.12s ease, border-color 0.12s ease',
        maxHeight: '100%',
      }}
    >
      {/* Column header */}
      <Box sx={{ p: 1.25, borderBottom: `1px solid ${D.line}`,
        borderTop: `2px solid ${m.color}`, borderTopLeftRadius: 10, borderTopRightRadius: 10,
        ...(won ? { boxShadow: `inset 0 1px 0 ${m.color}55` } : {}) }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <ColumnChip col={col} glow={won} />
            <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5, fontWeight: 700 }}>{group.count}</Typography>
          </Stack>
          {group.totalValue > 0 && (
            <Typography sx={{ ...mono, color: won ? boardColumnMeta('delivered').color : D.muted, fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
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
            <Typography sx={{ color: D.faint, fontSize: 11.5, opacity: active ? 1 : 0.6 }}>
              {active ? 'Drop here' : 'Empty'}
            </Typography>
          </Box>
        ) : cards.map((card) => (
          <PipelineCard
            key={card.cardKey}
            card={card}
            onOpen={onOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={draggingKey === card.cardKey}
            locked={lockedKeys ? lockedKeys.has(card.cardKey) : false}
            bindCompany={bindCompany}
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

// Which board columns is THIS card allowed to drop into? Drives both the valid-
// drop affordance and the drop guard. Lead cards: lead columns + Quoting (the
// mint-order handoff). Order cards: the fulfillment columns + Cancelled.
function allowedColumnsFor(card) {
  if (!card) return [];
  return card.cardKind === 'order' ? ORDER_BOARD_COLUMNS : LEAD_BOARD_COLUMNS;
}

export default function PipelineView({
  groups, summary, probability, columns, loading,
  query, onQueryChange, tag, onTagChange, tagOptions,
  onOpen, onMoveStage, bindCompany,
}) {
  // Within-board control (client-side; the loaded set already has the fields):
  // within-column sort. Tag + search are wired through the parent so the fetch
  // can scope server-side.
  const [sort, setSort] = React.useState('value');

  // Apply the within-column sort to each group, then recompute its count +
  // totalValue so the column header reflects what's actually shown. Keyed by the
  // board column id (group.stage holds the column id).
  const shapedByCol = React.useMemo(() => {
    const map = {};
    (groups || []).forEach((g) => {
      const sorted = sortCards(g.clients || [], sort);
      map[g.stage] = {
        ...g,
        clients: sorted,
        count: sorted.length,
        totalValue: sorted.reduce((s, c) => s + (Number(c.dealValue) || 0), 0),
      };
    });
    return map;
  }, [groups, sort]);

  // Seed a group for any column missing from the payload so columns always show.
  const groupFor = React.useCallback(
    (col) => shapedByCol[col] || { stage: col, count: 0, totalValue: 0, clients: [] },
    [shapedByCol],
  );

  const probMap = probability || BOARD_PROBABILITY;

  // The board's ordered column list comes from the server when present (so a
  // backend column change flows through without a client edit), else the local
  // BOARD_COLUMNS / BOARD_CLOSED_COLUMNS fallback.
  const activeCols = (columns && Array.isArray(columns.active) && columns.active.length)
    ? columns.active : BOARD_COLUMNS;
  const closedCols = (columns && Array.isArray(columns.closed) && columns.closed.length)
    ? columns.closed : BOARD_CLOSED_COLUMNS;

  // Secondary lane (lost/dormant/cancelled) collapsed by default — opened on demand.
  const [showClosed, setShowClosed] = React.useState(false);
  const closedCount = closedCols.reduce((n, col) => n + (groupFor(col).count || 0), 0);

  // ── Drag state (same contract as CalendarView) ──────────────────────────────
  const [dragState, setDragState] = React.useState({ activeKey: null, overCol: null });
  const draggedRef = React.useRef(null);
  // Cards whose move is in flight — locked (un-draggable, dimmed) until the
  // server-backed refetch settles. Keyed by cardKey (a company can contribute many
  // cards, so companyKey would over-lock siblings). Clear on the LOADING edge
  // (refetch finished), NOT on every `groups` change — the optimistic move itself
  // replaces `groups` synchronously, so keying the clear on `groups` would release
  // the lock before the PATCH resolves and defeat it.
  const [lockedKeys, setLockedKeys] = React.useState(() => new Set());
  const prevLoadingRef = React.useRef(loading);
  React.useEffect(() => {
    if (prevLoadingRef.current && !loading) setLockedKeys(new Set());
    prevLoadingRef.current = loading;
  }, [loading]);

  // The card currently being dragged (for the valid-drop affordance on columns).
  const [draggingCard, setDraggingCard] = React.useState(null);
  const allowedCols = React.useMemo(() => new Set(allowedColumnsFor(draggingCard)), [draggingCard]);

  const handleDragStart = (e, card) => {
    if (lockedKeys.has(card.cardKey)) { e.preventDefault(); return; }
    draggedRef.current = card;
    setDraggingCard(card);
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.cardKey); // Firefox needs payload to drag
    } catch (_) { /* ref is the source of truth */ }
    setDragState({ activeKey: card.cardKey, overCol: null });
  };
  const handleDragEnd = () => {
    draggedRef.current = null; setDraggingCard(null);
    setDragState({ activeKey: null, overCol: null });
  };
  const handleDragOverCol = (col) => setDragState((s) => (s.overCol === col ? s : { ...s, overCol: col }));
  const handleDragLeaveCol = (col) => setDragState((s) => (s.overCol === col ? { ...s, overCol: null } : s));

  const handleDrop = (col) => {
    const card = draggedRef.current;
    draggedRef.current = null; setDraggingCard(null);
    setDragState({ activeKey: null, overCol: null });
    if (!card || !col) return;
    if (card.stage === col) return;                 // dropped on its own column — no-op
    if (lockedKeys.has(card.cardKey)) return;       // already moving
    // Enforce valid drops: an illegal target (order → lead column, lead →
    // mid-fulfillment, etc.) is a clean no-op so nothing half-moves.
    if (!allowedColumnsFor(card).includes(col)) return;
    setLockedKeys((prev) => { const n = new Set(prev); n.add(card.cardKey); return n; });
    onMoveStage(card, col);                          // pass the WHOLE card (kind + projectNumber + _id)
  };

  const renderColumn = (col) => (
    <BoardColumn
      key={col}
      group={groupFor(col)}
      isOver={dragState.overCol === col}
      canDrop={!draggingCard || allowedCols.has(col)}
      onOpen={onOpen}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
      onDragOverCol={handleDragOverCol}
      onDragLeaveCol={handleDragLeaveCol}
      draggingKey={dragState.activeKey}
      lockedKeys={lockedKeys}
      bindCompany={bindCompany}
    />
  );

  const totalCards = activeCols.reduce((n, col) => n + (groupFor(col).count || 0), 0) + closedCount;

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
        {summary?.coldPool > 0 && (
          <>
            <Box sx={{ width: 1, alignSelf: 'stretch', bgcolor: D.line, display: { xs: 'none', sm: 'block' } }} />
            <Box title="Cold-outreach prospects the lead engine is finding + emailing on autopilot. They stay OFF the board until a real reply flips them warm — the pipeline filling behind the scenes, not work waiting on you.">
              <Metric label="🤖 Engine pool" value={`${(summary.coldPool || 0).toLocaleString()} cold`} tone={D.faint} />
            </Box>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {loading && <CircularProgress size={18} sx={{ color: D.green }} />}
      </Box>

      {/* Filters — search + tag (server-side) · sort (within the loaded board).
          Kept lean on purpose: the columns already segment the board. */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap">
        <TextField
          value={query} onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search people & companies…" size="small" sx={{ ...dropInput, flex: '1 1 220px', minWidth: 200 }}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SearchIcon sx={{ color: D.faint, fontSize: 20 }} /></InputAdornment>
          ) }}
        />
        <TextField
          select value={tag} onChange={(e) => onTagChange(e.target.value)}
          size="small" sx={{ ...dropInput, minWidth: { sm: 150 } }} label="Tag"
          disabled={(tagOptions || []).length === 0}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><LocalOfferOutlinedIcon sx={{ color: D.faint, fontSize: 17 }} /></InputAdornment>
          ) }}
        >
          <MenuItem value="all">All tags</MenuItem>
          {(tagOptions || []).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField
          select value={sort} onChange={(e) => setSort(e.target.value)}
          size="small" sx={{ ...dropInput, minWidth: { sm: 150 } }} label="Sort"
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SortOutlinedIcon sx={{ color: D.faint, fontSize: 17 }} /></InputAdornment>
          ) }}
        >
          {SORTS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
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
            : 'Add a lead, or start quoting a company, to see cards here.'}
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
            {activeCols.map(renderColumn)}
          </Box>

          {/* Secondary lane — lost / dormant / cancelled, collapsed by default */}
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
                {closedCols.map(renderColumn)}
              </Box>
            )}
          </Box>
        </>
      )}

      <Typography sx={{ color: D.faint, fontSize: 11.5, textAlign: 'center' }}>
        {`Forecast (lead ${Math.round((probMap.lead ?? 0.1) * 100)}% → shipped ${Math.round((probMap.shipped ?? 0.95) * 100)}%)`}
      </Typography>
    </Stack>
  );
}
