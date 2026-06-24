// src/screens/studio/crm/CalendarView.js
// A month grid of follow-ups (/api/crm/calendar) that works like a real planner.
// Notion-style drag-and-drop: grab a company chip and drop it on any day to move
// its nextFollowUp there → PATCH { nextFollowUp }. Native HTML5 drag (no library).
//
// CROSS-MONTH rescheduling (the owner's ask — "can't drag to a different month"):
//   1) While dragging, HOVERING the prev/next month arrows (now enlarged into
//      drop-rails) auto-navigates after a short dwell, so you can scroll to any
//      month mid-drag and drop on the target day — the chip stays armed across
//      the month change (the drag ref survives re-render).
//   2) A per-chip "reschedule" button + right-click both open a date picker
//      dialog (onPickReschedule) — a fallback that ALWAYS reaches any date, no
//      dragging required.
// Today is highlighted in the owner's local (ET) day; chips are stage-colored.
//
// Fetch window: we always pull the FULL visible grid (the Sunday before the 1st
// through the Saturday after the last day), so chips on the leading/trailing
// "spill" days from adjacent months render and accept drops too.

import * as React from 'react';
import { Box, Stack, Typography, IconButton, CircularProgress, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { D, mono } from '../_shared';
import { stageMeta, dayKey, todayLocalKey, isWonStage } from './_crm';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Build the 6×7 grid of Date objects covering `month` of `year`, padded to whole
// weeks (Sun→Sat). Built in UTC so each cell's dayKey (UTC) lines up exactly
// with the stored whole-day follow-up dates, for viewers in ANY timezone — see
// the date-helper note in _crm.js. Cells are read with getUTCDay/getUTCDate.
function buildGrid(year, month) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=Sun
  const startMs = Date.UTC(year, month, 1 - firstDow);
  const cells = [];
  // 6 weeks always — keeps the grid height stable month to month.
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(startMs + i * 86400000));
  }
  return cells;
}

// A draggable company chip living in a day cell.
function EventChip({ ev, onOpen, onDragStart, onDragEnd, onPickReschedule, dragging, bindCompany }) {
  const m = stageMeta(ev.stage);
  const won = isWonStage(ev.stage);
  const [hover, setHover] = React.useState(false);
  // The custom right-click menu (Call / Log / Reschedule / Set stage / …) when a
  // binder is provided; otherwise fall back to the legacy reschedule-on-right-
  // click so the chip is never without its quick reschedule.
  const ctxProps = bindCompany
    ? bindCompany(ev)
    : { onContextMenu: (e) => { if (onPickReschedule) { e.preventDefault(); e.stopPropagation(); onPickReschedule(ev); } } };
  return (
    <Box
      draggable
      onDragStart={(e) => onDragStart(e, ev)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={(e) => { e.stopPropagation(); onOpen(ev.companyKey); }}
      {...ctxProps}
      title={`${ev.name}${ev.area ? ` · ${ev.area}` : ''} — drag to a day, or use ⟳ to reschedule to any date`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 0.75, py: '3px', mb: 0.5, borderRadius: 1.25, cursor: 'grab',
        bgcolor: m.bg, border: `1px solid ${m.color}${won ? '88' : '55'}`,
        opacity: dragging ? 0.35 : 1,
        boxShadow: won ? `0 0 8px -3px ${m.color}` : 'none',
        transition: 'opacity 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease',
        '&:hover': { transform: 'translateY(-1px)', boxShadow: `0 4px 12px -4px ${m.color}66` },
        '&:active': { cursor: 'grabbing' },
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
      <Typography sx={{
        color: D.text, fontSize: 11.5, fontWeight: 700, minWidth: 0, flexGrow: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {ev.name}
      </Typography>
      {onPickReschedule && (
        <Tooltip title="Reschedule to any date">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onPickReschedule(ev); }}
            sx={{ p: 0.1, ml: -0.25, color: D.faint, opacity: { xs: 1, sm: hover ? 1 : 0 },
              transition: 'opacity 0.12s ease, color 0.12s ease',
              '&:hover': { color: D.green } }}
          >
            <EventRepeatOutlinedIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

function DayCell({ date, inMonth, isToday, events, onOpen, dragState, onDragStart, onDragEnd, onDrop, onDragOverCell, onDragLeaveCell, onPickReschedule, bindCompany }) {
  const key = dayKey(date);
  const isDropTarget = dragState.overKey === key && dragState.activeKey;

  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); onDragOverCell(key); }}
      onDragLeave={() => onDragLeaveCell(key)}
      onDrop={(e) => { e.preventDefault(); onDrop(key); }}
      sx={{
        minHeight: { xs: 76, sm: 104 }, p: 0.75,
        borderRight: `1px solid ${D.line}`, borderBottom: `1px solid ${D.line}`,
        bgcolor: isDropTarget ? 'rgba(74,222,128,0.1)' : (inMonth ? 'transparent' : 'rgba(0,0,0,0.18)'),
        outline: isDropTarget ? `2px solid ${D.green}` : 'none', outlineOffset: -2,
        transition: 'background 0.12s ease',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Box sx={{
          ...mono, fontSize: 11.5, fontWeight: isToday ? 800 : 600,
          width: 20, height: 20, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isToday ? D.ink : (inMonth ? D.muted : 'rgba(255,255,255,0.25)'),
          bgcolor: isToday ? D.green : 'transparent',
        }}>
          {date.getUTCDate()}
        </Box>
        {events.length > 0 && (
          <Typography sx={{ ...mono, fontSize: 10, color: D.faint, fontWeight: 700, pr: 0.25 }}>
            {events.length}
          </Typography>
        )}
      </Stack>
      <Box sx={{
        flexGrow: 1, minWidth: 0, overflowY: 'auto',
        '&::-webkit-scrollbar': { width: 0 },
      }}>
        {events.map((ev) => (
          <EventChip
            key={ev.companyKey}
            ev={ev}
            onOpen={onOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onPickReschedule={onPickReschedule}
            dragging={dragState.activeKey === ev.companyKey}
            bindCompany={bindCompany}
          />
        ))}
      </Box>
    </Box>
  );
}

// A month-nav arrow that doubles, mid-drag, as a "carry the card to the prev/next
// month" rail (see railDragOver). Top-level (not nested in CalendarView) so it
// keeps a stable component identity across the frequent drag-state re-renders —
// otherwise its IconButton subtree would remount mid-drag.
function NavRail({ delta, title, dragging, onClick, onDragOver, onDragLeave, children }) {
  return (
    <Tooltip title={dragging ? `Hold here to move to the ${delta < 0 ? 'previous' : 'next'} month` : title}>
      <IconButton
        onClick={onClick} size="small"
        onDragOver={onDragOver} onDragLeave={onDragLeave}
        sx={{
          color: D.muted, border: `1px solid ${dragging ? D.lineHi : D.line}`,
          bgcolor: dragging ? 'rgba(74,222,128,0.06)' : 'transparent',
          transition: 'border-color 0.12s ease, background 0.12s ease',
          '&:hover': { color: D.green, borderColor: D.lineHi },
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

export default function CalendarView({ events, loading, cursor, onCursorChange, onOpen, onReschedule, onPickReschedule, bindCompany }) {
  // cursor = { year, month } of the displayed month (owned by parent so the
  // fetch + view stay in sync).
  const { year, month } = cursor;
  const cells = React.useMemo(() => buildGrid(year, month), [year, month]);
  // "Today" cell uses the viewer's LOCAL calendar day (Eastern for the owner), so
  // the highlight lands on the owner's today — not UTC's, which is a day ahead in
  // the evening. (Cells/events are still keyed in UTC: their UTC day equals the
  // intended calendar day for the UTC-midnight values they bucket.)
  const todayKey = todayLocalKey();

  // Bucket events by local day key for O(1) cell lookups.
  const byDay = React.useMemo(() => {
    const map = {};
    (events || []).forEach((ev) => {
      const k = dayKey(ev.nextFollowUp);
      if (!k) return;
      (map[k] = map[k] || []).push(ev);
    });
    return map;
  }, [events]);

  // Drag state: which company is in flight (activeKey) + the cell we're over.
  const [dragState, setDragState] = React.useState({ activeKey: null, overKey: null });
  const draggedRef = React.useRef(null);
  // Dwell timer for auto-navigating months while hovering a nav rail mid-drag.
  const dwellRef = React.useRef(null);

  const clearDwell = () => { if (dwellRef.current) { clearTimeout(dwellRef.current); dwellRef.current = null; } };
  // Never leak the dwell timer if the view unmounts mid-drag.
  React.useEffect(() => () => { if (dwellRef.current) clearTimeout(dwellRef.current); }, []);

  const handleDragStart = (e, ev) => {
    draggedRef.current = ev;
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ev.companyKey); // required for Firefox to drag
    } catch (_) { /* some browsers restrict dataTransfer; ref is the source of truth */ }
    setDragState({ activeKey: ev.companyKey, overKey: null });
  };
  const handleDragEnd = () => { clearDwell(); draggedRef.current = null; setDragState({ activeKey: null, overKey: null }); };
  const handleDragOverCell = (key) => { clearDwell(); setDragState((s) => (s.overKey === key ? s : { ...s, overKey: key })); };
  const handleDragLeaveCell = (key) => setDragState((s) => (s.overKey === key ? { ...s, overKey: null } : s));

  const handleDrop = (key) => {
    clearDwell();
    const ev = draggedRef.current;
    draggedRef.current = null;
    setDragState({ activeKey: null, overKey: null });
    if (!ev || !key) return;
    if (dayKey(ev.nextFollowUp) === key) return; // dropped on its own day — no-op
    onReschedule(ev.companyKey, key, ev);
  };

  const go = React.useCallback((delta) => {
    const d = new Date(year, month + delta, 1);
    onCursorChange({ year: d.getFullYear(), month: d.getMonth() });
  }, [year, month, onCursorChange]);
  const goToday = () => { const n = new Date(); onCursorChange({ year: n.getFullYear(), month: n.getMonth() }); };

  const dragging = !!dragState.activeKey;
  // Hover-dwell handlers for the nav rails — start a 450ms timer that flips the
  // month while a chip is in flight, so the owner can carry a card across months.
  const railDragOver = (delta) => (e) => {
    if (!dragging) return;
    e.preventDefault();
    if (!dwellRef.current) {
      dwellRef.current = setTimeout(() => { dwellRef.current = null; go(delta); }, 450);
    }
  };

  return (
    <Stack spacing={2}>
      {/* Month nav */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <NavRail delta={-1} title="Previous month" dragging={dragging}
          onClick={() => go(-1)} onDragOver={railDragOver(-1)} onDragLeave={clearDwell}>
          <ChevronLeftIcon />
        </NavRail>
        <NavRail delta={1} title="Next month" dragging={dragging}
          onClick={() => go(1)} onDragOver={railDragOver(1)} onDragLeave={clearDwell}>
          <ChevronRightIcon />
        </NavRail>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18, ml: 0.5, minWidth: 0 }}>
          {MONTHS[month]} <Box component="span" sx={{ color: D.muted, fontWeight: 600 }}>{year}</Box>
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {loading && <CircularProgress size={18} sx={{ color: D.green }} />}
        <Tooltip title="Jump to current month">
          <IconButton onClick={goToday} size="small"
            sx={{ color: D.muted, '&:hover': { color: D.green } }}>
            <CalendarTodayIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Grid */}
      <Box sx={{
        border: `1px solid ${D.line}`, borderRadius: 2.5, overflow: 'hidden', bgcolor: D.inset,
      }}>
        {/* Weekday header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {WEEKDAYS.map((w) => (
            <Box key={w} sx={{
              py: 0.75, textAlign: 'center', borderRight: `1px solid ${D.line}`,
              borderBottom: `1px solid ${D.line}`, bgcolor: D.panel,
            }}>
              <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{w}</Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{w[0]}</Box>
              </Typography>
            </Box>
          ))}
        </Box>
        {/* Day cells */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((date) => {
            const k = dayKey(date);
            return (
              <DayCell
                key={k}
                date={date}
                inMonth={date.getUTCMonth() === month}
                isToday={k === todayKey}
                events={byDay[k] || []}
                onOpen={onOpen}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                onDragOverCell={handleDragOverCell}
                onDragLeaveCell={handleDragLeaveCell}
                onPickReschedule={onPickReschedule}
                bindCompany={bindCompany}
              />
            );
          })}
        </Box>
      </Box>

      {/* Legend / hint */}
      <Stack direction="row" alignItems="center" justifyContent="center" flexWrap="wrap" useFlexGap spacing={1.5}>
        <Typography sx={{ color: D.faint, fontSize: 11.5, textAlign: 'center' }}>
          Drag a chip to a day to reschedule · hover ‹ › while dragging to cross months · ⟳ (or right-click) for any date.
        </Typography>
      </Stack>
    </Stack>
  );
}
