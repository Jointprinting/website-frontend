// src/screens/studio/agent/AgentHome.js
//
// The SALES-AGENT home — the entire Studio surface an agent sees. No hub, no
// owner tools: just their goal dashboard and two tabs, My Leads and My Orders,
// scoped by the server to their own book (/api/agent/*). The owner sets the
// monthly goal (Admin tab); the agent watches encouraging / discouraging pace
// stats against it here. Built on the shared drop palette + CRM vocab so it reads
// as part of the same Studio family.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, Chip, IconButton, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tabs, Tab, Divider,
} from '@mui/material';
import PhoneInTalkIcon    from '@mui/icons-material/PhoneInTalk';
import SmsOutlinedIcon    from '@mui/icons-material/SmsOutlined';
import AddIcon            from '@mui/icons-material/Add';
import CloseIcon          from '@mui/icons-material/Close';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import {
  D, mono, eyebrow, money0, fmtDate, fmtRelative, ymd,
  dropInput, dropPrimaryBtn, dropGhostBtn, scrollbar, STATUS_META,
} from '../_shared';
import { STAGE_META, CRM_STAGES, telHref, smsHref } from '../crm/_crm';
import config from '../../../config.json';
import JpLoader from '../../../common/JpLoader';

const base = `${config.backendUrl}/api/agent`;

// Statuses an agent may set on a sale — MIRRORS controllers/agentPortal.js
// AGENT_ORDER_STATUSES. Labels/colours come from the shared STATUS_META.
const ORDER_STATUSES = ['quoted', 'approved', 'placed', 'in_production', 'shipped', 'delivered', 'cancelled'];

// Days remaining in the goal month ('YYYY-MM'), from today. 0 outside that month.
function daysLeftIn(goalMonth) {
  const [y, m] = String(goalMonth || '').split('-').map(Number);
  if (!y || !m) return 0;
  const now = new Date();
  if (now.getUTCFullYear() !== y || now.getUTCMonth() + 1 !== m) return 0;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.max(0, daysInMonth - now.getUTCDate());
}

// The heart of the dashboard: turn goal + this-month sales into an honest,
// motivating read. Encouraging when ahead/on-pace, a nudge (never a scolding)
// when behind. The owner asked specifically for this framing.
function paceMessage(stats, goal, goalMonth) {
  if (!goal) {
    return { tone: 'muted', emoji: '🎯', headline: 'No goal set yet',
      sub: 'Ask Nate to set your monthly target — then you can track your pace here.' };
  }
  const sales = Math.round(stats.salesThisMonth || 0);
  const progress = stats.progress || 0;
  const monthFrac = Math.min(1, Math.max(0, stats.monthFrac || 0));
  const expected = goal * monthFrac;
  const daysLeft = daysLeftIn(goalMonth);
  if (progress >= 1) {
    return { tone: 'good', emoji: '🎉', headline: 'Goal smashed!',
      sub: `You hit ${money0(goal)} this month. Everything from here is bonus — keep the momentum going.` };
  }
  if (sales >= expected * 1.1) {
    return { tone: 'good', emoji: '🔥', headline: 'Ahead of pace',
      sub: `You're ${money0(sales - expected)} ahead of where you need to be. ${money0(goal - sales)} to go — keep pushing.` };
  }
  if (sales >= expected * 0.9) {
    return { tone: 'good', emoji: '✅', headline: 'Right on pace',
      sub: `Stay consistent — ${money0(goal - sales)} left to hit your goal${daysLeft ? `, ${daysLeft} days to do it` : ''}.` };
  }
  return { tone: 'warn', emoji: '💪', headline: 'Behind pace',
    sub: `${money0(expected - sales)} behind pace${daysLeft ? ` with ${daysLeft} days left` : ''}. A couple of closes gets you right back on track.` };
}

const TONE = {
  good:  { fg: D.green, bar: D.green, glow: 'rgba(74,222,128,0.12)' },
  warn:  { fg: D.amber, bar: D.amber, glow: 'rgba(251,191,36,0.12)' },
  muted: { fg: D.faint, bar: 'rgba(255,255,255,0.25)', glow: 'rgba(255,255,255,0.04)' },
};

// ── Goal dashboard hero ──────────────────────────────────────────────────────
function GoalHero({ me }) {
  const stats = me.stats || {};
  const goal = me.goal || 0;
  const sales = Math.round(stats.salesThisMonth || 0);
  const pace = paceMessage(stats, goal, me.goalMonth);
  const tone = TONE[pace.tone];
  const pct = Math.max(0, Math.min(1, stats.progress || 0));

  return (
    <Box sx={{
      bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 3,
      p: { xs: 2, md: 3 }, position: 'relative', overflow: 'hidden',
      backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${tone.glow}, rgba(0,0,0,0) 60%)`,
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap spacing={1}>
        <Typography sx={{ ...eyebrow }}>This month</Typography>
        <Typography sx={{ ...mono, color: D.faint, fontSize: 12 }}>{me.goalMonth}</Typography>
      </Stack>

      <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ ...mono, color: D.text, fontSize: { xs: 32, md: 40 }, fontWeight: 800, lineHeight: 1 }}>
          {money0(sales)}
        </Typography>
        <Typography sx={{ ...mono, color: D.faint, fontSize: 18, fontWeight: 600 }}>
          {goal ? `/ ${money0(goal)} goal` : 'in sales'}
        </Typography>
      </Stack>

      {/* Progress bar */}
      {goal > 0 && (
        <Box sx={{ mt: 1.75 }}>
          <Box sx={{ position: 'relative', height: 10, borderRadius: 999, bgcolor: D.inset, overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', inset: 0, width: `${pct * 100}%`, bgcolor: tone.bar, borderRadius: 999, transition: 'width 0.5s ease' }} />
            {/* pace marker: where you SHOULD be right now */}
            {stats.monthFrac != null && (
              <Box sx={{ position: 'absolute', top: -2, bottom: -2, left: `${Math.min(100, (stats.monthFrac || 0) * 100)}%`,
                width: 2, bgcolor: 'rgba(255,255,255,0.5)' }} />
            )}
          </Box>
          <Typography sx={{ color: D.faint, fontSize: 10.5, mt: 0.5 }}>
            {Math.round(pct * 100)}% of goal · the line marks today’s pace ({Math.round((stats.monthFrac || 0) * 100)}% of the month)
          </Typography>
        </Box>
      )}

      {/* Encouraging / discouraging read */}
      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mt: 2 }}>
        <Typography sx={{ fontSize: 22, lineHeight: 1.2 }}>{pace.emoji}</Typography>
        <Box>
          <Typography sx={{ color: tone.fg, fontWeight: 800, fontSize: 15 }}>{pace.headline}</Typography>
          <Typography sx={{ color: D.muted, fontSize: 13, mt: 0.2 }}>{pace.sub}</Typography>
        </Box>
      </Stack>

      {/* Quick counts */}
      <Stack direction="row" spacing={3} sx={{ mt: 2.25, pt: 1.75, borderTop: `1px solid ${D.line}` }}>
        {[
          ['Sales this mo.', stats.ordersThisMonth || 0],
          ['Open orders', stats.openOrders || 0],
          ['Leads', stats.leads || 0],
        ].map(([label, val]) => (
          <Box key={label}>
            <Typography sx={{ ...mono, color: D.text, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{val}</Typography>
            <Typography sx={{ color: D.faint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, mt: 0.4 }}>{label}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

// ── Lead row + editor ────────────────────────────────────────────────────────
function stageChip(stage) {
  const m = STAGE_META[stage] || STAGE_META.lead;
  return <Chip size="small" label={m.label} sx={{ height: 20, fontSize: 10.5, fontWeight: 800, color: m.color, bgcolor: m.bg }} />;
}

function LeadRow({ lead, onOpen }) {
  const phone = lead.phone || (lead.contacts || []).find((c) => c && c.phone)?.phone || '';
  const overdue = lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date();
  return (
    <Box onClick={() => onOpen(lead)} sx={{
      bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2, p: 1.5, cursor: 'pointer',
      transition: 'border-color 0.15s ease, background-color 0.15s ease',
      '&:hover': { borderColor: 'rgba(255,255,255,0.25)', bgcolor: D.panelHi },
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lead.companyName || lead.clientName || 'Untitled'}
            </Typography>
            {stageChip(lead.stage)}
          </Stack>
          <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.3 }}>
            {lead.dealValue ? `${money0(lead.dealValue)} · ` : ''}
            {lead.nextFollowUp
              ? <Box component="span" sx={{ color: overdue ? D.amber : D.faint }}>Follow up {fmtDate(lead.nextFollowUp)}</Box>
              : (lead.lastContact ? `Last touch ${fmtRelative(lead.lastContact)}` : 'No touches yet')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {phone && (
            <>
              <IconButton size="small" component="a" href={telHref(phone)} sx={{ color: D.green }}><PhoneInTalkIcon sx={{ fontSize: 17 }} /></IconButton>
              <IconButton size="small" component="a" href={smsHref(phone)} sx={{ color: D.muted }}><SmsOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
            </>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

function LeadDialog({ lead, onClose, onSave, onLog }) {
  const [draft, setDraft] = useState(() => ({
    stage: lead.stage, dealValue: String(lead.dealValue || ''), phone: lead.phone || '',
    email: lead.email || '', notes: lead.notes || '',
    nextFollowUp: lead.nextFollowUp ? ymd(lead.nextFollowUp) : '',
  }));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const phone = draft.phone || (lead.contacts || []).find((c) => c && c.phone)?.phone || '';

  const save = async () => {
    setBusy(true);
    await onSave(lead.companyKey, {
      stage: draft.stage,
      dealValue: Number(draft.dealValue) || 0,
      phone: draft.phone, email: draft.email, notes: draft.notes,
      nextFollowUp: draft.nextFollowUp || null,
    });
    setBusy(false); onClose();
  };
  const logTouch = async (kind) => {
    setBusy(true);
    await onLog(lead.companyKey, { kind, text: note.trim() });
    setNote(''); setBusy(false);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: D.bg, border: `1px solid ${D.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ color: D.text, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{lead.companyName || lead.clientName}</span>
        <IconButton onClick={onClose} sx={{ color: D.muted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ ...scrollbar }}>
        {phone && (
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button component="a" href={telHref(phone)} startIcon={<PhoneInTalkIcon />} sx={{ ...dropPrimaryBtn, flex: 1 }}>Call</Button>
            <Button component="a" href={smsHref(phone)} startIcon={<SmsOutlinedIcon />} sx={{ ...dropGhostBtn, flex: 1 }}>Text</Button>
          </Stack>
        )}
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Stage" value={draft.stage} onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value }))}
              size="small" fullWidth sx={dropInput}>
              {CRM_STAGES.map((s) => <MenuItem key={s} value={s}>{(STAGE_META[s] || {}).label || s}</MenuItem>)}
            </TextField>
            <TextField label="Deal value" value={draft.dealValue}
              onChange={(e) => setDraft((d) => ({ ...d, dealValue: e.target.value.replace(/[^0-9]/g, '') }))}
              size="small" fullWidth sx={dropInput} InputProps={{ startAdornment: <span style={{ color: D.faint, marginRight: 4 }}>$</span> }} />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField label="Phone" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} size="small" fullWidth sx={dropInput} />
            <TextField label="Next follow-up" type="date" value={draft.nextFollowUp}
              onChange={(e) => setDraft((d) => ({ ...d, nextFollowUp: e.target.value }))}
              size="small" fullWidth sx={dropInput} InputLabelProps={{ shrink: true }} />
          </Stack>
          <TextField label="Email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} size="small" fullWidth sx={dropInput} />
          <TextField label="Notes" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} size="small" fullWidth multiline minRows={2} sx={dropInput} />

          <Divider sx={{ borderColor: D.line, my: 0.5 }} />

          {/* Log a touch */}
          <Typography sx={{ ...eyebrow }}>Log a touch</Typography>
          <TextField placeholder="What happened? (optional)" value={note} onChange={(e) => setNote(e.target.value)} size="small" fullWidth sx={dropInput} />
          <Stack direction="row" spacing={1}>
            {['call', 'text', 'note'].map((k) => (
              <Button key={k} onClick={() => logTouch(k)} disabled={busy} sx={{ ...dropGhostBtn, flex: 1, textTransform: 'capitalize' }}>{k}</Button>
            ))}
          </Stack>

          {/* Recent history */}
          {(lead.log || []).length > 0 && (
            <Box sx={{ maxHeight: 160, overflowY: 'auto', ...scrollbar, mt: 0.5 }}>
              {[...lead.log].reverse().slice(0, 12).map((e, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ py: 0.5, borderBottom: `1px solid ${D.line}` }}>
                  <Typography sx={{ color: D.faint, fontSize: 10.5, width: 78, flexShrink: 0, ...mono }}>{fmtRelative(e.at)}</Typography>
                  <Typography sx={{ color: D.muted, fontSize: 12 }}>
                    {e.kind ? <Box component="span" sx={{ color: D.green, textTransform: 'capitalize' }}>{e.kind} </Box> : ''}{e.text}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ ...dropGhostBtn }}>Close</Button>
        <Button onClick={save} disabled={busy} sx={{ ...dropPrimaryBtn }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Order row + editor ───────────────────────────────────────────────────────
function orderStatusChip(status) {
  const m = STATUS_META[status] || STATUS_META.quoted;
  return <Chip size="small" label={m.label} sx={{ height: 20, fontSize: 10.5, fontWeight: 800, color: m.color, bgcolor: m.bg }} />;
}

function OrderRow({ order, onOpen }) {
  return (
    <Box onClick={() => onOpen(order)} sx={{
      bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2, p: 1.5, cursor: 'pointer',
      transition: 'border-color 0.15s ease, background-color 0.15s ease',
      '&:hover': { borderColor: 'rgba(255,255,255,0.25)', bgcolor: D.panelHi },
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {order.companyName || order.clientName || 'Untitled'}
            </Typography>
            {orderStatusChip(order.status)}
          </Stack>
          <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.3, ...mono }}>
            {order.projectNumber ? `#${order.projectNumber} · ` : ''}{order.orderDate ? fmtDate(order.orderDate) : '—'}
          </Typography>
        </Box>
        <Typography sx={{ ...mono, color: D.green, fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{money0(order.totalValue)}</Typography>
      </Stack>
    </Box>
  );
}

function OrderDialog({ order, onClose, onSave }) {
  const isNew = !order.id;
  const [draft, setDraft] = useState(() => ({
    companyName: order.companyName || '', clientName: order.clientName || '',
    status: order.status || 'quoted', totalValue: String(order.totalValue || ''),
    orderDate: order.orderDate ? ymd(order.orderDate) : ymd(new Date()), notes: order.notes || '',
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (isNew && !draft.companyName.trim() && !draft.clientName.trim()) { setErr('Add a company or client name.'); return; }
    setBusy(true); setErr('');
    const ok = await onSave(order.id, {
      companyName: draft.companyName, clientName: draft.clientName, status: draft.status,
      totalValue: Number(draft.totalValue) || 0, orderDate: draft.orderDate || null, notes: draft.notes,
    });
    setBusy(false);
    if (ok) onClose(); else setErr('Could not save — try again.');
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: D.bg, border: `1px solid ${D.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ color: D.text, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{isNew ? 'Log a sale' : (order.companyName || order.clientName)}</span>
        <IconButton onClick={onClose} sx={{ color: D.muted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ ...scrollbar }}>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <Stack direction="row" spacing={1.5}>
            <TextField label="Company" value={draft.companyName} onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))} size="small" fullWidth sx={dropInput} />
            <TextField label="Contact" value={draft.clientName} onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))} size="small" fullWidth sx={dropInput} />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Status" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} size="small" fullWidth sx={dropInput}>
              {ORDER_STATUSES.map((s) => <MenuItem key={s} value={s}>{(STATUS_META[s] || {}).label || s}</MenuItem>)}
            </TextField>
            <TextField label="Value" value={draft.totalValue}
              onChange={(e) => setDraft((d) => ({ ...d, totalValue: e.target.value.replace(/[^0-9.]/g, '') }))}
              size="small" fullWidth sx={dropInput} InputProps={{ startAdornment: <span style={{ color: D.faint, marginRight: 4 }}>$</span> }} />
          </Stack>
          <TextField label="Sale date" type="date" value={draft.orderDate} onChange={(e) => setDraft((d) => ({ ...d, orderDate: e.target.value }))}
            size="small" fullWidth sx={dropInput} InputLabelProps={{ shrink: true }} />
          <TextField label="Notes" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} size="small" fullWidth multiline minRows={2} sx={dropInput} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ ...dropGhostBtn }}>Cancel</Button>
        <Button onClick={save} disabled={busy} sx={{ ...dropPrimaryBtn }}>{isNew ? 'Log sale' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function AddLeadDialog({ onClose, onSave }) {
  const [d, setD] = useState({ companyName: '', clientName: '', phone: '', email: '', stage: 'lead', dealValue: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!d.companyName.trim() && !d.clientName.trim()) { setErr('Add a company or contact name.'); return; }
    setBusy(true); setErr('');
    const ok = await onSave({ ...d, dealValue: Number(d.dealValue) || 0 });
    setBusy(false);
    if (ok) onClose(); else setErr('Could not add — that company may already exist.');
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: D.bg, border: `1px solid ${D.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ color: D.text, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>New lead</span>
        <IconButton onClick={onClose} sx={{ color: D.muted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <Stack direction="row" spacing={1.5}>
            <TextField label="Company" value={d.companyName} onChange={(e) => setD((s) => ({ ...s, companyName: e.target.value }))} size="small" fullWidth sx={dropInput} autoFocus />
            <TextField label="Contact" value={d.clientName} onChange={(e) => setD((s) => ({ ...s, clientName: e.target.value }))} size="small" fullWidth sx={dropInput} />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField label="Phone" value={d.phone} onChange={(e) => setD((s) => ({ ...s, phone: e.target.value }))} size="small" fullWidth sx={dropInput} />
            <TextField label="Email" value={d.email} onChange={(e) => setD((s) => ({ ...s, email: e.target.value }))} size="small" fullWidth sx={dropInput} />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Stage" value={d.stage} onChange={(e) => setD((s) => ({ ...s, stage: e.target.value }))} size="small" fullWidth sx={dropInput}>
              {CRM_STAGES.map((s) => <MenuItem key={s} value={s}>{(STAGE_META[s] || {}).label || s}</MenuItem>)}
            </TextField>
            <TextField label="Deal value" value={d.dealValue} onChange={(e) => setD((s) => ({ ...s, dealValue: e.target.value.replace(/[^0-9]/g, '') }))}
              size="small" fullWidth sx={dropInput} InputProps={{ startAdornment: <span style={{ color: D.faint, marginRight: 4 }}>$</span> }} />
          </Stack>
          <TextField label="Notes" value={d.notes} onChange={(e) => setD((s) => ({ ...s, notes: e.target.value }))} size="small" fullWidth multiline minRows={2} sx={dropInput} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ ...dropGhostBtn }}>Cancel</Button>
        <Button onClick={save} disabled={busy} sx={{ ...dropPrimaryBtn }}>Add lead</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── The agent home ───────────────────────────────────────────────────────────
export default function AgentHome({ token, onLogout }) {
  const authHdr = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openLead, setOpenLead] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);
  const [addLead, setAddLead] = useState(false);
  const [addOrder, setAddOrder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [meR, leadsR, ordersR] = await Promise.all([
        fetch(`${base}/me`, { headers: authHdr }),
        fetch(`${base}/leads`, { headers: authHdr }),
        fetch(`${base}/orders`, { headers: authHdr }),
      ]);
      if (!meR.ok) throw new Error(`HTTP ${meR.status}`);
      setMe(await meR.json());
      setLeads(leadsR.ok ? (await leadsR.json()).leads || [] : []);
      setOrders(ordersR.ok ? (await ordersR.json()).orders || [] : []);
    } catch (e) { setError('Could not load your dashboard. Pull to refresh or try again.'); }
    finally { setLoading(false); }
  }, [authHdr]);

  useEffect(() => { load(); }, [load]);

  // Refresh /me (stats) after any write so the goal dashboard stays live.
  const refreshMe = useCallback(async () => {
    try { const r = await fetch(`${base}/me`, { headers: authHdr }); if (r.ok) setMe(await r.json()); } catch (_) {}
  }, [authHdr]);

  const saveLead = useCallback(async (companyKey, body) => {
    try {
      const r = await fetch(`${base}/leads/${encodeURIComponent(companyKey)}`, { method: 'PATCH', headers: authHdr, body: JSON.stringify(body) });
      if (!r.ok) return false;
      const { lead } = await r.json();
      setLeads((list) => list.map((l) => (l.companyKey === companyKey ? lead : l)));
      setOpenLead((cur) => (cur && cur.companyKey === companyKey ? lead : cur));
      return true;
    } catch (_) { return false; }
  }, [authHdr]);

  const logLead = useCallback(async (companyKey, entry) => {
    const r = await saveLead(companyKey, { logEntry: entry });
    return r;
  }, [saveLead]);

  const createLead = useCallback(async (body) => {
    try {
      const r = await fetch(`${base}/leads`, { method: 'POST', headers: authHdr, body: JSON.stringify(body) });
      if (!r.ok) return false;
      const { lead } = await r.json();
      setLeads((list) => [lead, ...list.filter((l) => l.companyKey !== lead.companyKey)]);
      refreshMe();
      return true;
    } catch (_) { return false; }
  }, [authHdr, refreshMe]);

  const saveOrder = useCallback(async (id, body) => {
    try {
      const isNew = !id;
      const r = await fetch(`${base}/orders${isNew ? '' : '/' + id}`, { method: isNew ? 'POST' : 'PUT', headers: authHdr, body: JSON.stringify(body) });
      if (!r.ok) return false;
      const { order } = await r.json();
      setOrders((list) => isNew ? [order, ...list] : list.map((o) => (o.id === id ? order : o)));
      refreshMe();
      return true;
    } catch (_) { return false; }
  }, [authHdr, refreshMe]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <JpLoader size={60} label="Loading your dashboard…" />
      </Box>
    );
  }

  const first = (me?.displayName || me?.username || '').split(' ')[0];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg, color: D.text,
      backgroundImage: 'radial-gradient(120% 45% at 50% -10%, rgba(74,222,128,0.05), rgba(11,20,16,0) 55%)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: D.greenDk, color: D.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <EmojiEventsOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ ...mono, color: D.text, fontWeight: 800, fontSize: 15, letterSpacing: 0.5, lineHeight: 1 }}>
                JP <Box component="span" sx={{ color: D.green }}>SALES</Box>
              </Typography>
              {first && <Typography sx={{ color: D.faint, fontSize: 11, mt: 0.2 }}>Hi, {first}</Typography>}
            </Box>
          </Stack>
          <Button onClick={onLogout} size="small" sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12, color: D.muted, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.04)' } }}>
            Sign out
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {me && <GoalHero me={me} />}

        {/* Tabs */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 3, mb: 1.5 }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)}
            sx={{ minHeight: 0, '& .MuiTab-root': { minHeight: 0, textTransform: 'none', fontWeight: 700, color: D.muted, fontSize: 14 },
              '& .Mui-selected': { color: `${D.green} !important` }, '& .MuiTabs-indicator': { bgcolor: D.green } }}>
            <Tab label={`My Leads${leads.length ? ` (${leads.length})` : ''}`} />
            <Tab label={`My Orders${orders.length ? ` (${orders.length})` : ''}`} />
          </Tabs>
          <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => (tab === 0 ? setAddLead(true) : setAddOrder(true))}
            sx={{ ...dropPrimaryBtn, py: 0.4, px: 1.5, fontSize: 12.5 }}>
            {tab === 0 ? 'Add lead' : 'Log sale'}
          </Button>
        </Stack>

        {/* Lists */}
        {tab === 0 ? (
          leads.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: D.faint }}>
              <Typography sx={{ fontSize: 14 }}>No leads yet.</Typography>
              <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>Tap “Add lead” to start building your book.</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>{leads.map((l) => <LeadRow key={l.companyKey} lead={l} onOpen={setOpenLead} />)}</Stack>
          )
        ) : (
          orders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: D.faint }}>
              <Typography sx={{ fontSize: 14 }}>No sales logged yet.</Typography>
              <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>When you close a deal, tap “Log sale” to record it toward your goal.</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>{orders.map((o) => <OrderRow key={o.id} order={o} onOpen={setOpenOrder} />)}</Stack>
          )
        )}
      </Box>

      {openLead && <LeadDialog lead={openLead} onClose={() => setOpenLead(null)} onSave={saveLead} onLog={logLead} />}
      {openOrder && <OrderDialog order={openOrder} onClose={() => setOpenOrder(null)} onSave={saveOrder} />}
      {addLead && <AddLeadDialog onClose={() => setAddLead(false)} onSave={createLead} />}
      {addOrder && <OrderDialog order={{}} onClose={() => setAddOrder(false)} onSave={saveOrder} />}
    </Box>
  );
}
