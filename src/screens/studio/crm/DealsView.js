// src/screens/studio/crm/DealsView.js
// The DEALS board — the sales pipeline the owner asked for: deal cards, one per
// opportunity, grouped by stage (Qualifying → Quote sent → Won, with Lost tucked
// into a closed lane). Drag a card between columns to move it; dropping into Won
// wins it (its first win makes the business a Client), dropping into Lost closes
// it. Clicking a card that's linked to an order deep-links to the Order Tracker.
//
// Modeled on PipelineView's native-HTML5 drag contract (no drag library). Unlike
// the order-centric Pipeline board (server-computed groups), the deal board groups
// the loaded deals[] client-side — the set is small and already in memory.
//
// The header carries the reversible "Set up deals from my orders" panel: preview
// (dry-run) → run → undo. It only ever CREATES deal cards from existing orders,
// never touches the orders themselves, and every run is undoable — so the owner
// can try it risk-free.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, InputAdornment, CircularProgress, Button, Collapse, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { D, mono, dropInput, dropPrimaryBtn } from '../_shared';
import {
  EmptyState, fmtMoney0, dealStageMeta, dealTitle, isOpenDeal, isWonDeal,
  DEAL_BOARD_ACTIVE, DEAL_BOARD_CLOSED, DEAL_STAGES,
} from './_crm';

// ── Reversible "set up deals from my orders" panel ────────────────────────────
// A guided, safe flow: idle → preview (dry-run, writes nothing) → run → undo.
function MigratePanel({ status, onPreview, onRun, onUndo }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(null);   // dry-run result
  const [result, setResult] = React.useState(null);     // run result { created, batchId }
  const [err, setErr] = React.useState('');

  // The most recent migration batch (from /migrate/status) — offers an undo even
  // across reloads, so a run is never a one-way door.
  const batches = (status && status.batches) || [];
  const lastBatch = batches.length ? batches[batches.length - 1] : null;
  const migratedCount = (status && status.migratedDeals) || 0;

  const doPreview = async () => {
    setBusy(true); setErr(''); setResult(null);
    try { setPreview(await onPreview()); }
    catch (e) { setErr('Could not build a preview just now.'); }
    finally { setBusy(false); }
  };
  const doRun = async () => {
    setBusy(true); setErr('');
    try {
      const r = await onRun();
      setResult(r); setPreview(null);
    } catch (e) { setErr('The setup did not run. Nothing was changed.'); }
    finally { setBusy(false); }
  };
  const doUndo = async (batchId) => {
    setBusy(true); setErr('');
    try {
      await onUndo(batchId);
      setResult(null); setPreview(null);
    } catch (e) { setErr('Undo did not complete.'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, overflow: 'hidden' }}>
      <Button
        onClick={() => setOpen((v) => !v)} fullWidth
        sx={{ justifyContent: 'flex-start', textTransform: 'none', color: D.text, px: 2, py: 1.25,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
      >
        <AutoFixHighOutlinedIcon sx={{ fontSize: 18, color: D.green, mr: 1 }} />
        <Stack alignItems="flex-start" sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: D.text }}>Set up deals from my orders</Typography>
          <Typography sx={{ color: D.faint, fontSize: 11.5, fontWeight: 600 }}>
            {migratedCount > 0
              ? `${migratedCount} deal${migratedCount === 1 ? '' : 's'} seeded from orders · fully reversible`
              : 'Seed a deal card from every existing order — preview first, undo anytime'}
          </Typography>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        {open ? <ExpandMoreIcon sx={{ color: D.faint }} /> : <ChevronRightIcon sx={{ color: D.faint }} />}
      </Button>

      <Collapse in={open}>
        <Divider sx={{ borderColor: D.line }} />
        <Box sx={{ p: 2 }}>
          <Typography sx={{ color: D.muted, fontSize: 12.5, lineHeight: 1.6, mb: 1.5 }}>
            This creates one deal card for each of your existing orders (and a “won” card for
            any client without orders), so your pipeline reflects real history. It <b>only adds
            deal cards</b> — it never changes your orders or companies — and every run can be undone.
          </Typography>

          {err && (
            <Typography sx={{ color: '#f87171', fontSize: 12.5, fontWeight: 700, mb: 1.5 }}>{err}</Typography>
          )}

          {/* Preview result */}
          {preview && (
            <Box sx={{ bgcolor: D.inset, border: `1px solid ${D.line}`, borderRadius: 2, p: 1.5, mb: 1.5 }}>
              <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13 }}>
                Preview — would create {preview.wouldCreate} deal{preview.wouldCreate === 1 ? '' : 's'}
              </Typography>
              {preview.wouldCreate === 0 ? (
                <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.5 }}>
                  You’re already up to date — every order already has a deal.
                </Typography>
              ) : (
                <>
                  {(preview.sample || []).length > 0 && (
                    <Stack spacing={0.4} sx={{ mt: 1 }}>
                      {preview.sample.map((s, i) => (
                        <Stack key={i} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Typography sx={{ color: D.muted, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.companyName || '—'} · {s.title}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                            <Typography sx={{ ...mono, color: dealStageMeta(s.stage).color, fontSize: 11, fontWeight: 800 }}>
                              {dealStageMeta(s.stage).label}
                            </Typography>
                            {s.value > 0 && <Typography sx={{ ...mono, color: D.faint, fontSize: 11 }}>{fmtMoney0(s.value)}</Typography>}
                          </Stack>
                        </Stack>
                      ))}
                      {preview.wouldCreate > (preview.sample || []).length && (
                        <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.25 }}>
                          …and {preview.wouldCreate - preview.sample.length} more
                        </Typography>
                      )}
                    </Stack>
                  )}
                </>
              )}
            </Box>
          )}

          {/* Run result */}
          {result && (
            <Box sx={{ bgcolor: 'rgba(74,222,128,0.06)', border: `1px solid ${D.lineHi}`, borderRadius: 2, p: 1.5, mb: 1.5 }}>
              <Typography sx={{ color: D.green, fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: 17 }} />
                Created {result.created} deal{result.created === 1 ? '' : 's'} from your orders
              </Typography>
              {result.batchId && (
                <Button
                  onClick={() => doUndo(result.batchId)} disabled={busy} size="small"
                  startIcon={<UndoRoundedIcon sx={{ fontSize: 15 }} />}
                  sx={{ mt: 1, textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: D.muted,
                    border: `1px solid ${D.line}`, borderRadius: 999, px: 1.5,
                    '&:hover': { color: D.text, borderColor: D.lineHi } }}
                >
                  Undo this setup
                </Button>
              )}
            </Box>
          )}

          {/* Controls */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {!result && (
              <Button
                onClick={doPreview} disabled={busy} variant="outlined"
                sx={{ textTransform: 'none', fontWeight: 700, color: D.text, borderColor: D.line, borderRadius: 999,
                  '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(255,255,255,0.03)' } }}
              >
                {busy ? 'Working…' : 'Preview'}
              </Button>
            )}
            {preview && preview.wouldCreate > 0 && (
              <Button onClick={doRun} disabled={busy} variant="contained" sx={dropPrimaryBtn}>
                Create {preview.wouldCreate} deal{preview.wouldCreate === 1 ? '' : 's'}
              </Button>
            )}
            {/* Persistent undo for a prior run (survives reload) */}
            {!result && lastBatch && (
              <Button
                onClick={() => doUndo(lastBatch.batchId)} disabled={busy} size="small"
                startIcon={<UndoRoundedIcon sx={{ fontSize: 15 }} />}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: D.faint,
                  '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.06)' } }}
              >
                Undo last setup ({lastBatch.count})
              </Button>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

// ── Board card ────────────────────────────────────────────────────────────────
function DealCard({ deal, onOpen, onDragStart, onDragEnd, dragging, locked }) {
  const m = dealStageMeta(deal.stage);
  const won = isWonDeal(deal);
  const linked = !!(deal.orderNumber || deal.projectNumber);
  return (
    <Box
      draggable={!locked}
      onDragStart={(e) => onDragStart(e, deal)}
      onDragEnd={onDragEnd}
      onClick={(e) => { e.stopPropagation(); onOpen(deal); }}
      title={`${deal.companyName || 'Deal'} · ${dealTitle(deal)} — drag to change stage${linked ? ' · click to open the order' : ''}`}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: locked ? 'wait' : 'grab',
        bgcolor: D.panel, border: `1px solid ${won ? 'rgba(74,222,128,0.4)' : D.line}`, borderRadius: 2, p: 1.25,
        opacity: dragging ? 0.35 : (locked ? 0.6 : 1),
        transition: 'opacity 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
        '&:hover': { borderColor: D.lineHi, transform: 'translateY(-1px)', boxShadow: `0 6px 16px -6px ${m.color}66` },
        '&:active': { cursor: locked ? 'wait' : 'grabbing' },
        '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: m.color, opacity: won ? 1 : 0.8 },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ pl: 0.5 }}>
        <Stack spacing={0.4} sx={{ minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {deal.companyName || 'Unknown company'}
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 11.5, lineHeight: 1.35,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dealTitle(deal)}
          </Typography>
          {linked && (
            <Box component="span" sx={{ ...mono, alignSelf: 'flex-start', fontSize: 10, fontWeight: 800,
              color: D.muted, bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${D.line}`,
              borderRadius: 0.75, px: 0.6, py: 0.05, lineHeight: 1.4 }}>
              #{deal.projectNumber || deal.orderNumber}
            </Box>
          )}
        </Stack>
        {deal.value > 0 && (
          <Typography sx={{ ...mono, color: won ? D.green : D.text, fontWeight: 800, fontSize: 12.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {fmtMoney0(deal.value)}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

// ── Board column ──────────────────────────────────────────────────────────────
// A short, purpose-y line for an empty lane so a quiet column reads as "nothing
// here yet," not "broken." Keyed by deal stage; unknown stages fall back.
const STAGE_EMPTY_HINT = {
  details_needed: 'New jobs land here — chase product + design details',
  quoting: 'Details in hand — mockups & quote in progress',
  quote_sent: 'Quotes waiting on a yes',
  won: 'Won deals collect here (auto, on delivery)',
  lost: 'Closed-lost deals',
};

function DealColumn({ stage, deals, isOver, onOpen, onDragStart, onDragEnd, onDrop, onDragOverCol, onDragLeaveCol, draggingKey, lockedKeys }) {
  const m = dealStageMeta(stage);
  const won = stage === 'won';
  const totalValue = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); onDragOverCol(stage); }}
      onDragLeave={() => onDragLeaveCol(stage)}
      onDrop={(e) => { e.preventDefault(); onDrop(stage); }}
      sx={{
        width: { xs: 250, md: 272 }, flexShrink: 0, display: 'flex', flexDirection: 'column',
        bgcolor: isOver ? 'rgba(74,222,128,0.06)' : D.inset,
        border: `1px solid ${isOver ? D.green : D.line}`, borderRadius: 2.5,
        outline: isOver ? `1px solid ${D.green}` : 'none', outlineOffset: -2,
        transition: 'background 0.12s ease, border-color 0.12s ease', maxHeight: '100%',
      }}
    >
      <Box sx={{ p: 1.25, borderBottom: `1px solid ${D.line}`, borderTop: `2px solid ${m.color}`,
        borderTopLeftRadius: 10, borderTopRightRadius: 10, ...(won ? { boxShadow: `inset 0 1px 0 ${m.color}55` } : {}) }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.2, borderRadius: 1,
              bgcolor: m.bg, border: `1px solid ${m.color}55` }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color }} />
              <Typography sx={{ color: m.color, fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>{m.label}</Typography>
            </Box>
            <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5, fontWeight: 700 }}>{deals.length}</Typography>
          </Stack>
          {totalValue > 0 && (
            <Typography sx={{ ...mono, color: won ? D.green : D.muted, fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
              {fmtMoney0(totalValue)}
            </Typography>
          )}
        </Stack>
      </Box>
      <Box sx={{ p: 1, flexGrow: 1, minHeight: 80, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1,
        '&::-webkit-scrollbar': { width: 5 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3 } }}>
        {deals.length === 0 ? (
          <Box sx={{ flexGrow: 1, m: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 90, borderRadius: 2, textAlign: 'center', px: 1,
            border: `1px dashed ${isOver ? D.green : 'rgba(255,255,255,0.09)'}`,
            bgcolor: isOver ? 'rgba(74,222,128,0.05)' : 'transparent', transition: 'all .12s ease' }}>
            <Typography sx={{ color: isOver ? D.green : D.faint, fontSize: 11.5, fontWeight: 700, opacity: isOver ? 1 : 0.7 }}>
              {isOver ? 'Drop here' : (STAGE_EMPTY_HINT[stage] || 'No deals here yet')}
            </Typography>
          </Box>
        ) : deals.map((d) => (
          <DealCard
            key={d._id}
            deal={d}
            onOpen={onOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={draggingKey === d._id}
            locked={lockedKeys ? lockedKeys.has(d._id) : false}
          />
        ))}
      </Box>
    </Box>
  );
}

function Metric({ label, value, tone }) {
  return (
    <Box>
      <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ ...mono, color: tone || D.text, fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
    </Box>
  );
}

export default function DealsView({
  deals, loading, onOpenDeal, onMoveDealStage, onNewDeal,
  migrateStatus, onPreviewMigrate, onRunMigrate, onUndoMigrate,
}) {
  const [query, setQuery] = React.useState('');
  const all = React.useMemo(() => (Array.isArray(deals) ? deals.filter((d) => d && !d.archived) : []), [deals]);

  // Client-side search over company + title + deal number.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((d) =>
      `${d.companyName || ''} ${dealTitle(d)} ${d.dealNumber || ''}`.toLowerCase().includes(q));
  }, [all, query]);

  const byStage = React.useMemo(() => {
    const map = {};
    DEAL_STAGES.forEach((s) => { map[s] = []; });
    filtered.forEach((d) => { (map[d.stage] || (map[d.stage] = [])).push(d); });
    // Value-desc within each column (biggest opportunities on top).
    Object.values(map).forEach((arr) => arr.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)));
    return map;
  }, [filtered]);

  const openValue = all.filter(isOpenDeal).reduce((s, d) => s + (Number(d.value) || 0), 0);
  const wonValue = all.filter(isWonDeal).reduce((s, d) => s + (Number(d.value) || 0), 0);
  const openCount = all.filter(isOpenDeal).length;

  // Once the "set up deals from my orders" migration has run, hide its big panel
  // (the owner doesn't need "Set up" / "Undo this setup" cluttering the board every
  // day). A small "Deal setup" toggle in the summary band brings it back on demand
  // — so re-run + undo stay reachable, just out of the way.
  const migrationRan = (migrateStatus?.migratedDeals || 0) > 0;

  // ── Drag state (mirrors PipelineView) ───────────────────────────────────────
  const [dragState, setDragState] = React.useState({ activeKey: null, overCol: null });
  const draggedRef = React.useRef(null);
  const [lockedKeys, setLockedKeys] = React.useState(() => new Set());
  const prevLoadingRef = React.useRef(loading);
  React.useEffect(() => {
    if (prevLoadingRef.current && !loading) setLockedKeys(new Set());
    prevLoadingRef.current = loading;
  }, [loading]);

  const handleDragStart = (e, deal) => {
    if (lockedKeys.has(deal._id)) { e.preventDefault(); return; }
    draggedRef.current = deal;
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', deal._id); } catch (_) { /* ref is source of truth */ }
    setDragState({ activeKey: deal._id, overCol: null });
  };
  const handleDragEnd = () => { draggedRef.current = null; setDragState({ activeKey: null, overCol: null }); };
  const handleDragOverCol = (col) => setDragState((s) => (s.overCol === col ? s : { ...s, overCol: col }));
  const handleDragLeaveCol = (col) => setDragState((s) => (s.overCol === col ? { ...s, overCol: null } : s));
  const handleDrop = (col) => {
    const deal = draggedRef.current;
    draggedRef.current = null;
    setDragState({ activeKey: null, overCol: null });
    if (!deal || !col || deal.stage === col) return;
    if (lockedKeys.has(deal._id)) return;
    setLockedKeys((prev) => { const n = new Set(prev); n.add(deal._id); return n; });
    onMoveDealStage(deal, col);
  };

  const renderColumn = (stage) => (
    <DealColumn
      key={stage}
      stage={stage}
      deals={byStage[stage] || []}
      isOver={dragState.overCol === stage}
      onOpen={onOpenDeal}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
      onDragOverCol={handleDragOverCol}
      onDragLeaveCol={handleDragLeaveCol}
      draggingKey={dragState.activeKey}
      lockedKeys={lockedKeys}
    />
  );

  const closedCount = DEAL_BOARD_CLOSED.reduce((n, s) => n + (byStage[s] || []).length, 0);
  const [showClosed, setShowClosed] = React.useState(false);

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      {/* Reversible seed-from-orders panel — a ONE-TIME tool. Shown only until it
          has seeded deals, then it fully retires itself (no lingering setup/undo
          clutter on a board the owner uses every day). */}
      {!migrationRan && (
        <MigratePanel
          status={migrateStatus}
          onPreview={onPreviewMigrate}
          onRun={onRunMigrate}
          onUndo={onUndoMigrate}
        />
      )}

      {/* Summary band */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 2, sm: 4 },
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 } }}>
        <Metric label="Open deals" value={String(openCount)} tone={D.text} />
        <Box sx={{ width: 1, alignSelf: 'stretch', bgcolor: D.line, display: { xs: 'none', sm: 'block' } }} />
        <Metric label="Open value" value={fmtMoney0(openValue)} tone={D.text} />
        <Box sx={{ width: 1, alignSelf: 'stretch', bgcolor: D.line, display: { xs: 'none', sm: 'block' } }} />
        <Metric label="Won value" value={fmtMoney0(wonValue)} tone={D.green} />
        <Box sx={{ flexGrow: 1 }} />
        {loading && <CircularProgress size={18} sx={{ color: D.green }} />}
        <Button
          onClick={onNewDeal} variant="contained" startIcon={<AddIcon />}
          sx={{ ...dropPrimaryBtn, ml: { xs: 0, sm: 1 } }}
        >
          New deal
        </Button>
      </Box>

      {/* Search */}
      <TextField
        value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search deals — company, title, number…" size="small" sx={{ ...dropInput, maxWidth: 360 }}
        InputProps={{ startAdornment: (
          <InputAdornment position="start"><SearchIcon sx={{ color: D.faint, fontSize: 20 }} /></InputAdornment>
        ) }}
      />

      {/* Board */}
      {loading && all.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: D.green }} /></Box>
      ) : all.length === 0 ? (
        <EmptyState
          icon={<HandshakeOutlinedIcon />}
          title="No deals yet"
          hint="Create your first deal, or use “Set up deals from my orders” above to seed cards from your existing orders."
        />
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, alignItems: 'stretch', minHeight: 340,
            '&::-webkit-scrollbar': { height: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 4 } }}>
            {DEAL_BOARD_ACTIVE.map(renderColumn)}
          </Box>

          {/* Lost lane — collapsed by default */}
          <Box>
            <Button
              onClick={() => setShowClosed((v) => !v)}
              startIcon={showClosed ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              sx={{ textTransform: 'none', color: D.muted, fontWeight: 700, fontSize: 12.5, px: 1,
                '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.03)' } }}
            >
              Lost
              <Box component="span" sx={{ ...mono, ml: 0.75, color: D.faint, fontWeight: 700 }}>({closedCount})</Box>
            </Button>
            <Collapse in={showClosed}>
              <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, mt: 0.5, alignItems: 'stretch', minHeight: 160,
                '&::-webkit-scrollbar': { height: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 4 } }}>
                {DEAL_BOARD_CLOSED.map(renderColumn)}
              </Box>
            </Collapse>
          </Box>
        </>
      )}

      <Typography sx={{ color: D.faint, fontSize: 11.5, textAlign: 'center' }}>
        Drag a card to move it · drop into <b>Won</b> to win it (first win makes them a client) · <b>Lost</b> to close it
      </Typography>
    </Stack>
  );
}
