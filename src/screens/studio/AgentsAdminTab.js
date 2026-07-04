// src/screens/studio/AgentsAdminTab.js
//
// OWNER-only "Team" surface — onboard and manage sales agents. The owner:
//   • creates an agent (username + password; the password is shown ONCE so it can
//     be handed off),
//   • sets each agent's monthly sales goal,
//   • sees how they're doing this month (sales vs goal, on-pace read, leads,
//     open orders) and how often they sign in,
//   • activates / deactivates an account, or resets its password.
//
// Everything here talks to /api/admin/agents, which sits behind requireOwner on
// the server — an agent's token gets a 403, so this tab is unreachable for them.
// The agent's own dashboard (P4) reads the SAME computeAgentStats rollup, so the
// owner and the agent always see identical numbers.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, Chip, IconButton,
  Alert, Tooltip, InputAdornment, Switch, Divider,
} from '@mui/material';
import ArrowBackIcon         from '@mui/icons-material/ArrowBack';
import PersonAddAlt1Icon     from '@mui/icons-material/PersonAddAlt1';
import ContentCopyIcon       from '@mui/icons-material/ContentCopy';
import AutorenewIcon         from '@mui/icons-material/Autorenew';
import VisibilityIcon        from '@mui/icons-material/Visibility';
import VisibilityOffIcon     from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import KeyOutlinedIcon       from '@mui/icons-material/KeyOutlined';
import {
  D, mono, eyebrow, money0, fmtRelative, dropInput, dropPrimaryBtn, dropGhostBtn, scrollbar,
} from './_shared';
import { useContextMenu } from './ContextMenu';
import { buildFallbackMenu } from './contextMenuActions';
import config from '../../config.json';
import JpLoader from '../../common/JpLoader';

const base = `${config.backendUrl}/api/admin`;

// A readable random password — no ambiguous 0/O/1/l/I, mixed case + digits +
// one symbol, ~11 chars. The owner hands this to the agent; they can change it
// later isn't a thing yet, so make it easy to read aloud / type once.
function genPassword() {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digit = '23456789';
  const pool = upper + lower + digit;
  let out = '';
  for (let i = 0; i < 10; i++) out += pool[Math.floor(Math.random() * pool.length)];
  // Guarantee at least one of each class + a symbol so it always clears the
  // server's 8-char minimum with variety.
  out += upper[Math.floor(Math.random() * upper.length)];
  out += digit[Math.floor(Math.random() * digit.length)];
  out += '!@#$%&*'[Math.floor(Math.random() * 7)];
  return out;
}

// Turn a stats rollup into a short, honest pace read + a tone the card colours by.
function paceRead(stats) {
  if (!stats || !stats.goal) return { label: 'No goal set', tone: 'muted' };
  const { progress = 0, onPace, monthFrac = 0 } = stats;
  if (progress >= 1) return { label: 'Goal hit', tone: 'good' };
  if (onPace) return { label: progress > monthFrac + 0.05 ? 'Ahead of pace' : 'On pace', tone: 'good' };
  return { label: 'Behind pace', tone: 'warn' };
}
const TONE = {
  good:  { fg: D.green, bg: 'rgba(74,222,128,0.12)', bar: D.green },
  warn:  { fg: D.amber, bg: 'rgba(251,191,36,0.12)', bar: D.amber },
  muted: { fg: D.faint, bg: 'rgba(255,255,255,0.05)', bar: 'rgba(255,255,255,0.25)' },
};

// A small copy-to-clipboard button used wherever a credential is shown.
function CopyBtn({ text, title = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }
    catch (_) { /* clipboard blocked — the value is on screen to copy by hand */ }
  };
  return (
    <Tooltip title={done ? 'Copied' : title}>
      <IconButton size="small" onClick={copy} sx={{ color: done ? D.green : D.muted }}>
        {done ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
}

// The credential hand-off card the owner reads once — after creating an agent or
// resetting a password. The plaintext password never comes back from the server,
// so this is the ONE place it's visible; the owner copies it and gives it over.
function Handoff({ username, password, onClose }) {
  return (
    <Box sx={{
      bgcolor: 'rgba(74,222,128,0.06)', border: `1px solid ${D.lineHi}`, borderRadius: 2,
      p: 2, mb: 2,
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{ ...eyebrow }}>Give these to the agent</Typography>
        <Button size="small" onClick={onClose} sx={{ ...dropGhostBtn, py: 0.2, px: 1.2, fontSize: 11 }}>Done</Button>
      </Stack>
      <Typography sx={{ color: D.muted, fontSize: 12, mb: 1.2 }}>
        The password is shown here <b>once</b> — it isn’t stored in a readable form. Copy it now.
      </Typography>
      <Stack spacing={1}>
        {[['Username', username], ['Password', password]].map(([label, val]) => (
          <Stack key={label} direction="row" alignItems="center" spacing={1}
            sx={{ bgcolor: D.inset, border: `1px solid ${D.line}`, borderRadius: 1.5, px: 1.5, py: 1 }}>
            <Typography sx={{ color: D.faint, fontSize: 11, width: 74, flexShrink: 0 }}>{label}</Typography>
            <Typography sx={{ ...mono, color: D.text, fontSize: 14, flex: 1, wordBreak: 'break-all' }}>{val}</Typography>
            <CopyBtn text={val} title={`Copy ${label.toLowerCase()}`} />
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

// Thin labelled progress bar (sales toward goal).
function GoalBar({ progress, tone }) {
  const pct = Math.max(0, Math.min(1, progress || 0));
  return (
    <Box sx={{ position: 'relative', height: 7, borderRadius: 999, bgcolor: D.inset, overflow: 'hidden' }}>
      <Box sx={{
        position: 'absolute', inset: 0, width: `${pct * 100}%`,
        bgcolor: TONE[tone].bar, borderRadius: 999,
        transition: 'width 0.4s ease',
      }} />
    </Box>
  );
}

function StatCell({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ ...mono, color: D.text, fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ color: D.faint, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6, mt: 0.3 }}>{label}</Typography>
    </Box>
  );
}

function AgentCard({ agent, onPatch, onReset }) {
  const s = agent.stats || {};
  const pace = paceRead(s);
  const tone = TONE[pace.tone];
  const [editGoal, setEditGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(agent.monthlyGoal || ''));
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(null); // { password } after a reset

  const saveGoal = async () => {
    setBusy(true);
    await onPatch(agent.id, { monthlyGoal: Number(goalDraft) || 0 });
    setBusy(false); setEditGoal(false);
  };
  const toggleActive = async () => {
    setBusy(true);
    await onPatch(agent.id, { active: !agent.active });
    setBusy(false);
  };
  const resetPw = async () => {
    if (!window.confirm(`Reset ${agent.displayName || agent.username}'s password? Their current one stops working immediately.`)) return;
    setBusy(true);
    const pw = genPassword();
    const ok = await onReset(agent.id, pw);
    setBusy(false);
    if (ok) setReveal({ password: pw });
  };

  return (
    <Box sx={{
      bgcolor: D.panel, border: `1px solid ${agent.active ? D.line : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 2.5, p: { xs: 1.75, md: 2.25 }, opacity: agent.active ? 1 : 0.72,
    }}>
      {/* Identity + active toggle */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16 }}>
              {agent.displayName || agent.username}
            </Typography>
            <Typography sx={{ ...mono, color: D.faint, fontSize: 12 }}>@{agent.username}</Typography>
            <Chip
              size="small" label={pace.label}
              sx={{ height: 20, fontSize: 10.5, fontWeight: 800, color: tone.fg, bgcolor: tone.bg, border: `1px solid ${tone.fg}33` }}
            />
          </Stack>
          <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 0.4 }}>
            {agent.loginCount ? `Signed in ${agent.loginCount}×` : 'Hasn’t signed in yet'}
            {agent.lastLoginAt ? ` · last ${fmtRelative(agent.lastLoginAt)}` : ''}
          </Typography>
        </Box>
        <Stack alignItems="flex-end" spacing={0.2} sx={{ flexShrink: 0 }}>
          <Switch checked={!!agent.active} onChange={toggleActive} disabled={busy} size="small"
            sx={{ '& .Mui-checked': { color: D.green }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${D.green} !important` } }} />
          <Typography sx={{ color: agent.active ? D.green : D.faint, fontSize: 10, fontWeight: 700 }}>
            {agent.active ? 'Active' : 'Paused'}
          </Typography>
        </Stack>
      </Stack>

      {/* This-month goal progress */}
      <Box sx={{ mt: 1.75 }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.6 }}>
          <Typography sx={{ color: D.muted, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            This month
          </Typography>
          {editGoal ? (
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <TextField
                value={goalDraft} onChange={(e) => setGoalDraft(e.target.value.replace(/[^0-9]/g, ''))}
                size="small" placeholder="0" autoFocus
                InputProps={{ startAdornment: <InputAdornment position="start" sx={{ color: D.faint }}>$</InputAdornment> }}
                sx={{ ...dropInput, width: 130, '& .MuiInputBase-input': { py: 0.5, color: D.text } }}
              />
              <Button size="small" onClick={saveGoal} disabled={busy} sx={{ ...dropPrimaryBtn, py: 0.3, px: 1.5, fontSize: 12 }}>Save</Button>
            </Stack>
          ) : (
            <Stack direction="row" alignItems="baseline" spacing={1}>
              <Typography sx={{ ...mono, color: D.text, fontSize: 14, fontWeight: 700 }}>
                {money0(s.salesThisMonth)}
                <Box component="span" sx={{ color: D.faint, fontWeight: 500 }}> / {s.goal ? money0(s.goal) : '—'}</Box>
              </Typography>
              <Button size="small" onClick={() => { setGoalDraft(String(agent.monthlyGoal || '')); setEditGoal(true); }}
                sx={{ color: D.green, textTransform: 'none', fontSize: 11.5, fontWeight: 700, minWidth: 'auto', p: 0.3 }}>
                {s.goal ? 'Edit goal' : 'Set goal'}
              </Button>
            </Stack>
          )}
        </Stack>
        <GoalBar progress={s.progress} tone={pace.tone} />
        {s.goal > 0 && (
          <Typography sx={{ color: D.faint, fontSize: 10.5, mt: 0.5 }}>
            {Math.round((s.progress || 0) * 100)}% of goal · {Math.round((s.monthFrac || 0) * 100)}% of the month gone
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 1.5, borderColor: D.line }} />

      {/* Rollup + actions */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap spacing={1.5}>
        <Stack direction="row" spacing={3}>
          <StatCell label="Sales this mo." value={s.ordersThisMonth || 0} />
          <StatCell label="Open orders" value={s.openOrders || 0} />
          <StatCell label="Leads" value={s.leads || 0} />
        </Stack>
        <Button size="small" startIcon={<KeyOutlinedIcon sx={{ fontSize: 15 }} />} onClick={resetPw} disabled={busy}
          sx={{ ...dropGhostBtn, py: 0.4, px: 1.4, fontSize: 12 }}>
          Reset password
        </Button>
      </Stack>

      {reveal && (
        <Box sx={{ mt: 1.5 }}>
          <Handoff username={agent.username} password={reveal.password} onClose={() => setReveal(null)} />
        </Box>
      )}
    </Box>
  );
}

export default function AgentsAdminTab({ token, onBack }) {
  const authHdr = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create-agent form
  const [form, setForm] = useState({ displayName: '', username: '', password: '', monthlyGoal: '' });
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [handoff, setHandoff] = useState(null); // { username, password } shown once

  const { registerFallback } = useContextMenu();
  useEffect(() => registerFallback(() => buildFallbackMenu({ onBackToHub: onBack })), [registerFallback, onBack]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${base}/agents`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { let m = `HTTP ${res.status}`; try { const j = await res.json(); if (j.message) m = j.message; } catch (_) {} throw new Error(m); }
      const data = await res.json();
      setAgents(Array.isArray(data.agents) ? data.agents : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const patchAgent = useCallback(async (id, body) => {
    try {
      const res = await fetch(`${base}/agents/${id}`, { method: 'PATCH', headers: authHdr.headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      setAgents((list) => list.map((a) => (a.id === id ? data.agent : a)));
      return true;
    } catch (e) { setError(e.message); return false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetPassword = useCallback(async (id, password) => {
    try {
      const res = await fetch(`${base}/agents/${id}/password`, { method: 'POST', headers: authHdr.headers, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      return true;
    } catch (e) { setError(e.message); return false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const create = async () => {
    setCreateErr('');
    const username = form.username.trim().toLowerCase();
    if (!username) return setCreateErr('Pick a username.');
    const password = form.password || genPassword();
    setCreating(true);
    try {
      const res = await fetch(`${base}/agents`, {
        method: 'POST', headers: authHdr.headers,
        body: JSON.stringify({ ...form, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      setAgents((list) => [data.agent, ...list]);
      setHandoff({ username, password });
      setForm({ displayName: '', username: '', password: '', monthlyGoal: '' });
      setShowPw(false);
    } catch (e) { setCreateErr(e.message); }
    finally { setCreating(false); }
  };

  const activeCount = agents.filter((a) => a.active).length;

  return (
    <Box data-ctx-chrome sx={{ minHeight: '100vh', bgcolor: D.bg, color: D.text, p: { xs: 2, md: 4 },
      backgroundImage: 'radial-gradient(120% 55% at 50% -10%, rgba(74,222,128,0.05), rgba(11,20,16,0) 60%)' }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" gap={1.25} mb={0.5}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}
            sx={{ color: D.muted, textTransform: 'none', '&:hover': { color: D.text } }}>Back</Button>
        </Stack>
        <Stack direction="row" alignItems="flex-end" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
          <Box>
            <Typography sx={{ ...eyebrow }}>Team</Typography>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: { xs: 22, md: 26 }, lineHeight: 1.1 }}>
              Sales agents
            </Typography>
          </Box>
          {agents.length > 0 && (
            <Typography sx={{ ...mono, color: D.muted, fontSize: 12.5 }}>
              {activeCount} active · {agents.length} total
            </Typography>
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {/* Add agent */}
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: { xs: 1.75, md: 2.25 }, mb: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <PersonAddAlt1Icon sx={{ color: D.green, fontSize: 18 }} />
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15 }}>Add an agent</Typography>
          </Stack>

          {handoff
            ? <Handoff username={handoff.username} password={handoff.password} onClose={() => setHandoff(null)} />
            : null}

          <Stack spacing={1.25}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField
                label="Display name (optional)" value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                size="small" fullWidth sx={dropInput} placeholder="Mike Rivera"
              />
              <TextField
                label="Username" value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                size="small" fullWidth sx={dropInput} placeholder="mike"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField
                label="Password" value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                size="small" fullWidth sx={dropInput}
                type={showPw ? 'text' : 'password'}
                placeholder="auto-generates if blank"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Generate a strong password">
                        <IconButton size="small" onClick={() => { setForm((f) => ({ ...f, password: genPassword() })); setShowPw(true); }} sx={{ color: D.muted }}>
                          <AutorenewIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={() => setShowPw((v) => !v)} sx={{ color: D.muted }}>
                        {showPw ? <VisibilityOffIcon sx={{ fontSize: 17 }} /> : <VisibilityIcon sx={{ fontSize: 17 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Monthly goal" value={form.monthlyGoal}
                onChange={(e) => setForm((f) => ({ ...f, monthlyGoal: e.target.value.replace(/[^0-9]/g, '') }))}
                size="small" fullWidth sx={dropInput} placeholder="5000"
                InputProps={{ startAdornment: <InputAdornment position="start" sx={{ color: D.faint }}>$</InputAdornment> }}
              />
            </Stack>
            {createErr && <Typography sx={{ color: '#f87171', fontSize: 12.5 }}>{createErr}</Typography>}
            <Box>
              <Button onClick={create} disabled={creating} sx={{ ...dropPrimaryBtn, px: 2.5 }}>
                {creating ? 'Creating…' : 'Create agent'}
              </Button>
              <Typography component="span" sx={{ color: D.faint, fontSize: 11.5, ml: 1.5 }}>
                Leave the password blank and we’ll generate a strong one.
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Roster */}
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><JpLoader size={52} label="Loading team…" /></Box>
        ) : agents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, color: D.faint }}>
            <Typography sx={{ fontSize: 14 }}>No agents yet.</Typography>
            <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>
              Add your first sales agent above — they’ll get their own login with just their Orders and CRM, scoped to their leads.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5} sx={{ ...scrollbar }}>
            {agents.map((a) => (
              <AgentCard key={a.id} agent={a} onPatch={patchAgent} onReset={resetPassword} />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
