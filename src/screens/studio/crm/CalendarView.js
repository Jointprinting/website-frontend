// src/screens/studio/crm/CalendarView.js
// A real SaaS planner for follow-ups (/api/crm/calendar) — Notion/Linear-grade,
// on the Studio dark tokens. The owner's asks, all addressed here:
//
//   • CLEAN SINGLE-MONTH GRID. We render only the weeks that actually contain a
//     day of THIS month. Leading cells before the 1st and trailing cells after
//     the last day are blank, non-interactive padding — NOT adjacent-month days.
//     So there's no "1 week of next month" bleeding into the bottom row.
//
//   • MULTI-SELECT DRAG (Notion-style). Click a chip to select it; ⌘/Ctrl- or
//     Shift-click adds more. Dragging ANY selected chip carries the WHOLE
//     selection to the dropped day in one move. Dragging an UNselected chip moves
//     just that one (and selects it). A header bar shows the selection + a Clear.
//
//   • MOVE ACROSS MONTHS. Two ways, both reaching any date:
//       1) Navigate the month WITHOUT leaving the calendar — prev/next arrows, a
//          "Today" jump, and a month+year picker. The grid stays in view; you
//          never scroll the page to navigate (the old dumb part).
//       2) Mid-drag, hovering the prev/next arrows auto-advances the month after a
//          short dwell, so you can carry the selection to a month away and drop —
//          the drag stays armed across the month change (refs survive re-render).
//     A per-chip ⟳ (and right-click) still opens a date picker to ANY date as a
//     no-drag fallback.
//
// Today is highlighted in the owner's LOCAL (ET) day; chips are stage-colored.
// Reschedules persist the dropped day's UTC value (the UTC-noon convention — see
// the date-helper note in _crm.js), so there's no off-by-one for the US owner.

import * as React from 'react';
import {
  Box, Stack, Typography, IconButton, CircularProgress, Tooltip, Button,
  Menu, MenuItem,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CloseIcon from '@mui/icons-material/Close';
import { D, mono } from '../_shared';
import { stageMeta, dayKey, todayLocalKey, isWonStage } from './_crm';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Build the SINGLE-month grid for `month` of `year`: an array of week rows, each a
// 7-slot array. A slot is either a UTC Date for an in-month day, or null for the
// leading/trailing padding before the 1st / after the last day. We deliberately do
// NOT fill padding with adjacent-month days — that's the "spill" the owner wanted
// gone. Built in UTC so each cell's dayKey lines up with the stored whole-day
// follow-up dates (see the date-helper note in _crm.js).
function buildMonthWeeks(year, month) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = [];
  let week = new Array(7).fill(null);
  // Lead-in blanks for the first week.
  for (let i = 0; i < firstDow; i++) week[i] = null;
  let dow = firstDow;
  for (let day = 1; day <= daysInMonth; day++) {
    week[dow] = new Date(Date.UTC(year, month, day));
    dow += 1;
    if (dow === 7) { weeks.push(week); week = new Array(7).fill(null); dow = 0; }
  }
  // Flush a partial trailing week (trailing slots stay null — no next-month spill).
  if (dow !== 0) weeks.push(week);
  return weeks;
}

// A draggable company chip living in a day cell.
function EventChip({ ev, onOpen, onDragStart, onDragEnd, onPickReschedule, dragging, selected, onToggleSelect, bindCompany }) {
  const m = stageMeta(ev.stage);
  // A real customer (order on file) earns the same celebratory chip treatment as
  // a won/customer stage — `ev.isCustomer` is the order-reality flag the server
  // sends (matches TodayView / CompaniesView), so an order-bearing record that's
  // still stored as 'lead' reads as a customer here too, not a plain lead.
  const won = isWonStage(ev.stage) || ev.isCustomer;
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
      data-ck={ev.companyKey}
      onDragStart={(e) => onDragStart(e, ev)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      // A plain click TOGGLES selection (Notion-style multi-select — click several
      // chips to build a set, then drag any one to move them all). Double-click
      // opens the company, so single-click can own selection without stealing
      // "open" (opening is also on the ⟳ button + the right-click menu).
      onClick={(e) => { e.stopPropagation(); onToggleSelect(ev); }}
      onDoubleClick={(e) => { e.stopPropagation(); onOpen(ev.companyKey); }}
      {...ctxProps}
      title={`${ev.name}${ev.area ? ` · ${ev.area}` : ''}`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 0.75, py: '3px', mb: 0.5, borderRadius: 1.25, cursor: 'grab',
        bgcolor: m.bg,
        border: `1px solid ${selected ? D.green : `${m.color}${won ? '88' : '55'}`}`,
        outline: selected ? `1px solid ${D.green}` : 'none', outlineOffset: -2,
        opacity: dragging ? 0.35 : 1,
        boxShadow: selected ? `0 0 0 1px ${D.green}55` : 'none',
        transition: 'opacity 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
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

// One grid cell. `date` is null for padding slots (rendered blank + non-droppable).
function DayCell({ date, isToday, events, selectedKeys, onOpen, dragState, onDragStart, onDragEnd, onDrop, onDragOverCell, onDragLeaveCell, onPickReschedule, onToggleSelect, bindCompany, placing, onPlaceDay }) {
  // Padding slot — empty, inert, just keeps the grid rectangular.
  if (!date) {
    return <Box sx={{ minHeight: { xs: 76, sm: 104 }, borderRight: `1px solid ${D.line}`, borderBottom: `1px solid ${D.line}`, bgcolor: 'rgba(0,0,0,0.22)' }} />;
  }
  const key = dayKey(date);
  const isDropTarget = dragState.overKey === key && dragState.active;

  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); onDragOverCell(key); }}
      onDragLeave={() => onDragLeaveCell(key)}
      onDrop={(e) => { e.preventDefault(); onDrop(key); }}
      onClick={placing ? (e) => { e.stopPropagation(); onPlaceDay(key); } : undefined}
      title={placing ? 'Move the selected here' : undefined}
      sx={{
        minHeight: { xs: 76, sm: 104 }, p: 0.75,
        borderRight: `1px solid ${D.line}`, borderBottom: `1px solid ${D.line}`,
        bgcolor: isDropTarget ? 'rgba(74,222,128,0.1)' : 'transparent',
        outline: isDropTarget ? `2px solid ${D.green}` : 'none', outlineOffset: -2,
        cursor: placing ? 'pointer' : 'default',
        transition: 'background 0.12s ease',
        display: 'flex', flexDirection: 'column', minWidth: 0,
        ...(placing ? { '&:hover': { bgcolor: 'rgba(74,222,128,0.16)', outline: `2px solid ${D.green}`, outlineOffset: -2 } } : null),
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Box sx={{
          ...mono, fontSize: 11.5, fontWeight: isToday ? 800 : 600,
          width: 20, height: 20, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isToday ? D.ink : D.muted,
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
            onToggleSelect={onToggleSelect}
            dragging={dragState.activeKeys.has(ev.companyKey)}
            selected={selectedKeys.has(ev.companyKey)}
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

// The month + year jump picker — navigate to ANY month without leaving the
// calendar (no page scrolling). A compact two-pane popover: years on the left,
// months on the right.
function MonthJump({ year, month, onPick }) {
  const [anchor, setAnchor] = React.useState(null);
  const open = Boolean(anchor);
  const thisYear = new Date().getFullYear();
  // A generous, stable window around now so any realistic follow-up is reachable.
  const years = [];
  for (let y = thisYear - 3; y <= thisYear + 3; y++) years.push(y);
  const [viewYear, setViewYear] = React.useState(year);
  React.useEffect(() => { if (open) setViewYear(year); }, [open, year]);

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ArrowDropDownIcon />}
        sx={{ textTransform: 'none', color: D.text, fontWeight: 800, fontSize: 18, ml: 0.25, minWidth: 0,
          px: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
      >
        {MONTHS[month]} <Box component="span" sx={{ color: D.muted, fontWeight: 600, ml: 0.75 }}>{year}</Box>
      </Button>
      <Menu
        anchorEl={anchor} open={open} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { bgcolor: D.panel, color: D.text, border: `1px solid ${D.line}`,
          backgroundImage: 'none', borderRadius: 2, mt: 0.5, p: 1 } }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Year rail */}
          <Stack sx={{ pr: 1, borderRight: `1px solid ${D.line}` }}>
            {years.map((y) => (
              <MenuItem
                key={y} selected={y === viewYear} onClick={() => setViewYear(y)}
                sx={{ ...mono, fontSize: 13, fontWeight: 700, borderRadius: 1, minHeight: 32,
                  color: y === viewYear ? D.green : D.muted, justifyContent: 'center',
                  '&:hover': { bgcolor: 'rgba(74,222,128,0.06)' }, '&.Mui-selected': { bgcolor: 'rgba(74,222,128,0.1)' } }}
              >
                {y}
              </MenuItem>
            ))}
          </Stack>
          {/* Month grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, alignContent: 'start' }}>
            {MONTHS_SHORT.map((mname, mi) => {
              const isCurrent = mi === month && viewYear === year;
              return (
                <Box
                  key={mname}
                  onClick={() => { onPick(viewYear, mi); setAnchor(null); }}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(viewYear, mi); setAnchor(null); } }}
                  sx={{ px: 1.25, py: 0.85, borderRadius: 1.25, textAlign: 'center', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 700,
                    color: isCurrent ? D.ink : D.text, bgcolor: isCurrent ? D.green : 'transparent',
                    border: `1px solid ${isCurrent ? D.green : 'transparent'}`,
                    '&:hover': { bgcolor: isCurrent ? D.green : 'rgba(255,255,255,0.05)', borderColor: D.lineHi } }}
                >
                  {mname}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Menu>
    </>
  );
}

export default function CalendarView({ events, loading, cursor, onCursorChange, onOpen, onReschedule, onRescheduleMany, onPickReschedule, bindCompany }) {
  // cursor = { year, month } of the displayed month (owned by parent so the
  // fetch + view stay in sync).
  const { year, month } = cursor;
  const weeks = React.useMemo(() => buildMonthWeeks(year, month), [year, month]);
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

  // The set of companyKeys currently in the visible window.
  const visibleKeys = React.useMemo(() => new Set((events || []).map((e) => e.companyKey)), [events]);

  // ── Selection (Notion-style multi-select) ───────────────────────────────────
  // selectedKeys: companyKeys the owner has clicked. A drag of any selected chip
  // moves the whole set; a drag of an unselected chip moves just it. The selection
  // is scoped to the VISIBLE month: navigating away (or a refetch) prunes any chip
  // that's no longer on screen, so the owner can never silently bulk-move records
  // they can't see. Cross-MONTH moves are done by carrying the selection in an
  // active drag and dwelling on ‹ › to change month — that path holds the events in
  // a ref, independent of this state.
  const [selected, setSelected] = React.useState(() => new Map()); // companyKey -> ev
  const selectedKeys = React.useMemo(() => new Set(selected.keys()), [selected]);

  const toggleSelect = (ev) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(ev.companyKey)) next.delete(ev.companyKey);
      else next.set(ev.companyKey, ev);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Map());

  // ── Drag state ───────────────────────────────────────────────────────────────
  // activeKeys: every companyKey moving in this drag (the selection if the dragged
  // chip is selected, else just the dragged one). overKey: the cell under cursor.
  const [dragState, setDragState] = React.useState({ active: false, activeKeys: new Set(), overKey: null });
  // The events being dragged, captured at drag start so a cross-month drop still
  // has each one's identity even though its origin cell isn't rendered anymore.
  const draggedRef = React.useRef([]);
  // Whether THIS drag moved the multi-selection (so we only clear selection when we
  // actually consumed it — a lone unselected-chip drag leaves the selection alone).
  const draggedSelectionRef = React.useRef(false);
  // Dwell timer for auto-navigating months while hovering a nav rail mid-drag.
  const dwellRef = React.useRef(null);

  const clearDwell = () => { if (dwellRef.current) { clearTimeout(dwellRef.current); dwellRef.current = null; } };
  // Never leak the dwell timer if the view unmounts mid-drag.
  React.useEffect(() => () => { if (dwellRef.current) clearTimeout(dwellRef.current); }, []);

  // ── Click-to-place (the dependable cross-month move) ─────────────────────────
  // HTML5 drag across months (dwelling on the ‹ › arrows) is fiddly and easy to
  // miss. The reliable path: select chip(s) → "Move to a day" → navigate to ANY
  // month freely → click the target day. Works on trackpad/touch and reaches any
  // future date. placingRef mirrors the state so the selection-prune effect can
  // keep the carried set alive while you navigate months mid-placement.
  const [placing, setPlacing] = React.useState(false);
  const placingRef = React.useRef(false);
  React.useEffect(() => { placingRef.current = placing; }, [placing]);
  React.useEffect(() => {
    if (!placing) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPlacing(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing]);

  // Prune the selection to what's actually on screen when the visible set changes
  // (month nav or refetch), so the owner can never silently bulk-move chips they
  // can't see. Skipped while a drag is in flight (draggedRef non-empty) so a mid-
  // drag dwell-navigation keeps its carried set. No-op when nothing falls out.
  React.useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      if ((draggedRef.current || []).length > 0) return prev; // don't disturb an in-flight drag
      if (placingRef.current) return prev;                    // keep the carried set while placing across months
      let changed = false;
      const next = new Map();
      for (const [k, v] of prev) { if (visibleKeys.has(k)) next.set(k, v); else changed = true; }
      return changed ? next : prev;
    });
  }, [visibleKeys]);

  const handleDragStart = (e, ev) => {
    // If the grabbed chip is part of the current selection, the drag carries the
    // WHOLE selection; otherwise it's a lone single-chip move that leaves any
    // existing selection untouched (so the ref — not selection state — is the
    // source of truth, and we don't re-render mid-dragstart).
    const isSelected = selected.has(ev.companyKey);
    const movingEvents = isSelected ? [...selected.values()] : [ev];
    draggedRef.current = movingEvents;
    draggedSelectionRef.current = isSelected;
    const keys = new Set(movingEvents.map((m) => m.companyKey));
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ev.companyKey); // required for Firefox to drag
    } catch (_) { /* some browsers restrict dataTransfer; ref is the source of truth */ }
    setDragState({ active: true, activeKeys: keys, overKey: null });
  };
  const handleDragEnd = () => { clearDwell(); draggedRef.current = []; draggedSelectionRef.current = false; setDragState({ active: false, activeKeys: new Set(), overKey: null }); };
  const handleDragOverCell = (key) => { clearDwell(); setDragState((s) => (s.overKey === key ? s : { ...s, overKey: key })); };
  const handleDragLeaveCell = (key) => setDragState((s) => (s.overKey === key ? { ...s, overKey: null } : s));

  const handleDrop = (key) => {
    clearDwell();
    const moving = draggedRef.current || [];
    const wasSelection = draggedSelectionRef.current;
    draggedRef.current = [];
    draggedSelectionRef.current = false;
    setDragState({ active: false, activeKeys: new Set(), overKey: null });
    if (!key || moving.length === 0) return;
    // Only move the chips that aren't already on the target day (a no-op otherwise).
    const toMove = moving.filter((ev) => dayKey(ev.nextFollowUp) !== key);
    if (toMove.length === 0) return;
    if (toMove.length === 1) {
      onReschedule(toMove[0].companyKey, key, toMove[0]);
    } else if (onRescheduleMany) {
      onRescheduleMany(toMove.map((ev) => ev.companyKey), key, toMove);
    } else {
      // Defensive fallback if the parent didn't wire the bulk handler.
      toMove.forEach((ev) => onReschedule(ev.companyKey, key, ev));
    }
    // Clear the selection only when this drag consumed it (a multi-move). A lone
    // unselected-chip move doesn't disturb whatever the owner had selected.
    if (wasSelection) clearSelection();
  };

  // Drop the selected chips onto a clicked day (click-to-place). Mirrors the drop
  // logic but driven by a click after free month navigation — so any future date
  // is reachable without a drag.
  const placeOnDay = (key) => {
    if (!key) return;
    const moving = [...selected.values()];
    setPlacing(false);
    const toMove = moving.filter((ev) => dayKey(ev.nextFollowUp) !== key);
    if (toMove.length === 0) { clearSelection(); return; }
    if (toMove.length === 1) {
      onReschedule(toMove[0].companyKey, key, toMove[0]);
    } else if (onRescheduleMany) {
      onRescheduleMany(toMove.map((ev) => ev.companyKey), key, toMove);
    } else {
      toMove.forEach((ev) => onReschedule(ev.companyKey, key, ev));
    }
    clearSelection();
  };

  const go = React.useCallback((delta) => {
    const d = new Date(year, month + delta, 1);
    onCursorChange({ year: d.getFullYear(), month: d.getMonth() });
  }, [year, month, onCursorChange]);
  const goToday = () => { const n = new Date(); onCursorChange({ year: n.getFullYear(), month: n.getMonth() }); };
  const jumpTo = React.useCallback((y, m) => onCursorChange({ year: y, month: m }), [onCursorChange]);

  const dragging = dragState.active;
  // Hover-dwell handlers for the nav rails — start a 450ms timer that flips the
  // month while a chip is in flight, so the owner can carry the selection across
  // months and drop on a far date.
  const railDragOver = (delta) => (e) => {
    if (!dragging) return;
    e.preventDefault();
    if (!dwellRef.current) {
      dwellRef.current = setTimeout(() => { dwellRef.current = null; go(delta); }, 450);
    }
  };

  const selectedCount = selectedKeys.size;

  // ── Marquee (rubber-band) select ─────────────────────────────────────────────
  // Drag a box over the grid (starting on EMPTY space, not a chip) to select every
  // follow-up the box touches — the Notion-grade "grab a bunch at once" the owner
  // asked for instead of clicking each chip. Selection updates live as the box grows;
  // a click on empty space (no real drag) clears the selection. Chip click/drag is
  // untouched (we bail when the mousedown lands on a chip or a control).
  //
  // SCROLL-SAFE: the box is anchored in GRID-CONTENT space (the cursor's offset
  // within the grid, which scrolls together with its chips), not in fixed viewport
  // coords. We recompute on every scroll and auto-scroll near the viewport edges, so
  // scrolling EXTENDS the selection past the fold instead of sliding the box off the
  // content and dropping everything already grabbed.
  const evByKey = React.useMemo(() => {
    const m = new Map();
    (events || []).forEach((e) => m.set(e.companyKey, e));
    return m;
  }, [events]);
  const gridRef = React.useRef(null);
  const marqueeRef = React.useRef(null);                 // { ax, ay, cx, cy, moved } while boxing
  const marqueeCleanupRef = React.useRef(null);          // tear-down for an in-flight box
  const [marquee, setMarquee] = React.useState(null);    // GRID-SPACE rect (or null)

  // Hit-test chips against `rect`, both expressed in GRID-CONTENT space (chip
  // viewport rects are converted with the live grid rect), so any scroll that moved
  // the chips since mousedown is already accounted for.
  const selectWithinRect = React.useCallback((rect, gridRect) => {
    const root = gridRef.current;
    if (!root) return;
    const g = gridRect || root.getBoundingClientRect();
    const next = new Map();
    root.querySelectorAll('[data-ck]').forEach((el) => {
      const c = el.getBoundingClientRect();
      const left = c.left - g.left, top = c.top - g.top;
      const right = c.right - g.left, bottom = c.bottom - g.top;
      const hit = !(right < rect.left || left > rect.right || bottom < rect.top || top > rect.bottom);
      if (!hit) return;
      const ev = evByKey.get(el.getAttribute('data-ck'));
      if (ev) next.set(ev.companyKey, ev);
    });
    setSelected(next);
  }, [evByKey]);

  // Never leak the window listeners / RAF if the view unmounts mid-box.
  React.useEffect(() => () => { if (marqueeCleanupRef.current) marqueeCleanupRef.current(); }, []);

  const onGridMouseDown = (e) => {
    if (placing) return;                                  // click-to-place owns clicks while placing
    if (e.button !== 0) return;                           // left button only
    if (e.target.closest('[data-ck]')) return;            // a chip — let it click/drag
    if (e.target.closest('button, a, [role="button"], input')) return;
    const root = gridRef.current;
    if (!root) return;
    const gr0 = root.getBoundingClientRect();
    // Anchor = the cursor's offset INSIDE the grid. Because the grid and its chips
    // scroll together, this point stays glued to the content beneath it.
    const s = { ax: e.clientX - gr0.left, ay: e.clientY - gr0.top, cx: e.clientX, cy: e.clientY, moved: false };
    marqueeRef.current = s;
    setMarquee({ left: s.ax, top: s.ay, right: s.ax, bottom: s.ay });
    e.preventDefault();                                   // no text selection while boxing

    // Rebuild the box (and selection) from the last cursor position + the LIVE grid
    // rect — called on mousemove AND on scroll, so the box keeps tracking the cursor
    // as the page moves under it.
    const recompute = () => {
      const st = marqueeRef.current;
      const rootEl = gridRef.current;
      if (!st || !rootEl) return;
      const gr = rootEl.getBoundingClientRect();
      const mx = st.cx - gr.left;
      const my = st.cy - gr.top;
      const rect = {
        left: Math.min(st.ax, mx), top: Math.min(st.ay, my),
        right: Math.max(st.ax, mx), bottom: Math.max(st.ay, my),
      };
      if (rect.right - rect.left > 3 || rect.bottom - rect.top > 3) st.moved = true;
      setMarquee(rect);
      if (st.moved) selectWithinRect(rect, gr);
    };

    // Edge auto-scroll: hold the cursor near the top/bottom of the viewport to
    // rubber-band past the fold. Each scroll fires `recompute` (via the scroll
    // listener), so the box + selection grow into the newly revealed rows.
    let rafId = null;
    const tick = () => {
      const st = marqueeRef.current;
      if (!st) { rafId = null; return; }
      const margin = 64, maxSpeed = 20;
      const vh = window.innerHeight;
      let dy = 0;
      if (st.cy < margin) dy = -Math.ceil(((margin - st.cy) / margin) * maxSpeed);
      else if (st.cy > vh - margin) dy = Math.ceil(((st.cy - (vh - margin)) / margin) * maxSpeed);
      if (dy !== 0) { window.scrollBy(0, dy); recompute(); }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    const onMove = (me) => {
      const st = marqueeRef.current;
      if (!st) return;
      st.cx = me.clientX; st.cy = me.clientY;
      recompute();
    };
    const onScroll = () => recompute();
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('scroll', onScroll, true);
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
      marqueeCleanupRef.current = null;
    };
    function onUp() {
      const st = marqueeRef.current;
      if (st && !st.moved) clearSelection();              // a click on empty space clears
      marqueeRef.current = null;
      setMarquee(null);
      cleanup();
    }
    marqueeCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('scroll', onScroll, true);    // capture: catches any scroller
  };

  // `marquee` is already in grid space, so the absolutely-positioned box maps 1:1.
  const marqueeBox = (marquee && marqueeRef.current?.moved)
    ? { left: marquee.left, top: marquee.top, width: marquee.right - marquee.left, height: marquee.bottom - marquee.top }
    : null;

  return (
    <Stack spacing={2}>
      {/* Month nav — prev/next + a month·year jump, all WITHOUT scrolling the page */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <NavRail delta={-1} title="Previous month" dragging={dragging}
          onClick={() => go(-1)} onDragOver={railDragOver(-1)} onDragLeave={clearDwell}>
          <ChevronLeftIcon />
        </NavRail>
        <NavRail delta={1} title="Next month" dragging={dragging}
          onClick={() => go(1)} onDragOver={railDragOver(1)} onDragLeave={clearDwell}>
          <ChevronRightIcon />
        </NavRail>
        <MonthJump year={year} month={month} onPick={jumpTo} />
        <Box sx={{ flexGrow: 1 }} />
        {loading && <CircularProgress size={18} sx={{ color: D.green }} />}
        <Tooltip title="Jump to current month">
          <IconButton onClick={goToday} size="small"
            sx={{ color: D.muted, '&:hover': { color: D.green } }}>
            <CalendarTodayIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Selection bar — appears only when chips are selected. Shows the count and
          a Clear; the hint tells the owner to drag any selected chip to move them
          all (across months via the arrows). */}
      {/* Placing mode — pick a day for the selected across ANY month. The reliable
          cross-month move: navigate freely, then click a day. */}
      {placing && (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{
          bgcolor: 'rgba(74,222,128,0.12)', border: `1px solid ${D.green}`, borderRadius: 2,
          px: 1.5, py: 0.85,
        }}>
          <Box sx={{ ...mono, fontSize: 12.5, fontWeight: 800, color: D.green, whiteSpace: 'nowrap' }}>
            Pick a day
          </Box>
          <Typography sx={{ color: D.text, fontSize: 12, minWidth: 0, flexGrow: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Click a day to move {selectedCount} there — change months freely first (‹ › or the month menu), then click. Esc to cancel.
          </Typography>
          <Button
            onClick={() => setPlacing(false)} size="small" startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
            sx={{ textTransform: 'none', color: D.faint, fontWeight: 700, fontSize: 12, minWidth: 0,
              '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            Cancel
          </Button>
        </Stack>
      )}

      {/* Selection bar — when chips are selected and not yet placing. */}
      {selectedCount > 0 && !placing && (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{
          bgcolor: 'rgba(74,222,128,0.08)', border: `1px solid ${D.lineHi}`, borderRadius: 2,
          px: 1.5, py: 0.85,
        }}>
          <Box sx={{ ...mono, fontSize: 12.5, fontWeight: 800, color: D.green, whiteSpace: 'nowrap' }}>
            {selectedCount} selected
          </Box>
          <Typography sx={{ color: D.muted, fontSize: 12, minWidth: 0, flexGrow: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>
            Move to any date — hit “Move to a day”, switch months, click a day. (Or drag a chip for a same-month nudge.)
          </Typography>
          <Button
            onClick={() => setPlacing(true)} size="small" variant="outlined"
            startIcon={<EventRepeatOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', color: D.green, borderColor: D.lineHi, fontWeight: 800, fontSize: 12, minWidth: 0,
              '&:hover': { borderColor: D.green, bgcolor: 'rgba(74,222,128,0.08)' } }}
          >
            Move to a day
          </Button>
          <Button
            onClick={clearSelection} size="small" startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
            sx={{ textTransform: 'none', color: D.faint, fontWeight: 700, fontSize: 12, minWidth: 0,
              '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            Clear
          </Button>
        </Stack>
      )}

      {/* Grid */}
      <Box
        ref={gridRef}
        onMouseDown={onGridMouseDown}
        sx={{
          position: 'relative', userSelect: 'none',
          border: `1px solid ${D.line}`, borderRadius: 2.5, overflow: 'hidden', bgcolor: D.inset,
        }}
      >
        {/* Rubber-band selection box */}
        {marqueeBox && (
          <Box sx={{
            position: 'absolute', zIndex: 6, pointerEvents: 'none',
            left: marqueeBox.left, top: marqueeBox.top, width: marqueeBox.width, height: marqueeBox.height,
            bgcolor: 'rgba(74,222,128,0.12)', border: `1px solid ${D.green}`, borderRadius: 0.5,
          }} />
        )}
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
        {/* Day cells — only the weeks of THIS month (no next-month spill row) */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weeks.map((week, wi) => week.map((date, di) => {
            const k = date ? dayKey(date) : `pad-${wi}-${di}`;
            return (
              <DayCell
                key={k}
                date={date}
                isToday={!!date && k === todayKey}
                events={date ? (byDay[k] || []) : []}
                selectedKeys={selectedKeys}
                onOpen={onOpen}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                onDragOverCell={handleDragOverCell}
                onDragLeaveCell={handleDragLeaveCell}
                onPickReschedule={onPickReschedule}
                onToggleSelect={toggleSelect}
                bindCompany={bindCompany}
                placing={placing}
                onPlaceDay={placeOnDay}
              />
            );
          }))}
        </Box>
      </Box>

      {/* Legend / hint */}
      <Stack direction="row" alignItems="center" justifyContent="center" flexWrap="wrap" useFlexGap spacing={1.5}>
        <Typography sx={{ color: D.faint, fontSize: 11.5, textAlign: 'center' }}>
          Select chips (click, or drag a box) → <Box component="span" sx={{ color: D.muted, fontWeight: 700 }}>Move to a day</Box> → switch to any month → click the day. Drag a chip for a quick same-month nudge · ⟳ or right-click for any date.
        </Typography>
      </Stack>
    </Stack>
  );
}
