// src/screens/studio/crm/CompanyDetail.js
// One company, end to end. Loads /api/crm/:companyKey → { client, orders }.
//   • Editable header: company name + an inline grid of stage / area / interest /
//     deal value / next follow-up. Each field commits its own PATCH on change
//     (selects immediately, text on blur), so editing is a single tap, no "save".
//   • Contacts list (tap-to-call / mail each).
//   • Log timeline — newest first, kind icon per entry. "Log a touch" appends.
//   • Linked Orders pulled from the same endpoint.
// The parent owns the PATCH transport (patchCompany) so optimistic refreshes and
// list invalidation stay in one place; this view calls it and re-pulls itself.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, MenuItem, IconButton, Button, Divider,
  CircularProgress, InputAdornment, Link as MuiLink,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AddIcon from '@mui/icons-material/Add';
import {
  D, mono, dropInput, dropPrimaryBtn, fmt, fmtDate, fmtRelative, STATUS_META,
} from '../_shared';
import {
  StageChip, Eyebrow, TagChips, CRM_STAGES, stageMeta, INTEREST_TYPES, interestLabel,
  kindMeta, dateInputValue, followUpStatus, telHref,
} from './_crm';

// Labeled inline field — a compact dropInput with an eyebrow caption above it.
function Field({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Eyebrow sx={{ mb: 0.6, display: 'block' }}>{label}</Eyebrow>
      {children}
    </Box>
  );
}

const fieldSx = { ...dropInput, '& .MuiInputBase-input': { ...dropInput['& .MuiInputBase-input'], fontSize: 13.5, py: 1 } };

function ContactCard({ c }) {
  return (
    <Box sx={{
      bgcolor: D.inset, border: `1px solid ${D.line}`, borderRadius: 2, p: 1.5,
      display: 'flex', alignItems: 'center', gap: 1.25,
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        bgcolor: 'rgba(74,222,128,0.1)', color: D.green,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PersonOutlineIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.name || 'Unnamed contact'}{c.role ? <Box component="span" sx={{ color: D.faint, fontWeight: 600 }}> · {c.role}</Box> : null}
        </Typography>
        <Typography sx={{ color: D.muted, fontSize: 12, ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.5} flexShrink={0}>
        {c.phone && (
          <IconButton component="a" href={telHref(c.phone)} size="small"
            sx={{ color: D.green, '&:hover': { bgcolor: 'rgba(74,222,128,0.12)' } }}>
            <PhoneInTalkIcon sx={{ fontSize: 17 }} />
          </IconButton>
        )}
        {c.email && (
          <IconButton component="a" href={`mailto:${c.email}`} size="small"
            sx={{ color: D.muted, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.05)' } }}>
            <MailOutlineIcon sx={{ fontSize: 17 }} />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}

// Tags editor — removable chips + an inline "add" input. Each change rewrites
// the whole tags[] and PATCHes via the parent (onChange). De-dupes
// case-insensitively to match the server's normalization, so the UI and stored
// value never disagree.
function TagEditor({ tags, onChange, saving }) {
  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
  const [draft, setDraft] = React.useState('');

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (list.some((x) => x.toLowerCase() === t.toLowerCase())) { setDraft(''); return; }
    setDraft('');
    onChange([...list, t]);
  };
  const remove = (t) => onChange(list.filter((x) => x !== t));

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Eyebrow>Tags{saving ? ' · saving…' : ''}</Eyebrow>
      </Stack>
      {list.length > 0 ? (
        <TagChips tags={list} onDelete={remove} sx={{ mb: 1.25 }} />
      ) : (
        <Typography sx={{ color: D.faint, fontSize: 12.5, mb: 1.25 }}>No tags yet.</Typography>
      )}
      <Stack direction="row" spacing={1}>
        <TextField
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          size="small" fullWidth placeholder="Add a tag" sx={fieldSx}
        />
        <Button
          onClick={add} disabled={!draft.trim()} startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          sx={{ color: D.green, border: `1px solid ${D.line}`, fontWeight: 700, textTransform: 'none',
            borderRadius: 2, px: 1.5, whiteSpace: 'nowrap', flexShrink: 0,
            '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.06)' },
            '&.Mui-disabled': { color: D.faint, borderColor: D.line } }}
        >
          Add
        </Button>
      </Stack>
    </Box>
  );
}

function LogEntry({ entry, last }) {
  const { Icon, color, label } = kindMeta(entry.kind);
  return (
    <Box sx={{ display: 'flex', gap: 1.25, position: 'relative', pb: last ? 0 : 2 }}>
      {/* timeline rail */}
      {!last && <Box sx={{ position: 'absolute', left: 13, top: 28, bottom: -4, width: 2, bgcolor: D.line }} />}
      <Box sx={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, zIndex: 1,
        bgcolor: D.inset, border: `1px solid ${color}66`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon sx={{ fontSize: 15 }} />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0, pt: 0.2 }}>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.2 }}>
          <Typography sx={{ color, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</Typography>
          <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>
            {fmtDate(entry.at)} · {fmtRelative(entry.at)}
          </Typography>
        </Stack>
        <Typography sx={{ color: D.text, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{entry.text}</Typography>
      </Box>
    </Box>
  );
}

function OrderRow({ o }) {
  const meta = STATUS_META[o.status] || { label: o.status || '—', color: D.muted, bg: 'rgba(255,255,255,0.06)' };
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25, py: 1.1, px: 1.25,
      borderBottom: `1px solid ${D.line}`,
    }}>
      <ReceiptLongOutlinedIcon sx={{ fontSize: 18, color: D.faint, flexShrink: 0 }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13, ...mono }}>
          {o.projectNumber ? `#${o.projectNumber}` : (o.orderNumber ? `#${o.orderNumber}` : 'Order')}
        </Typography>
        <Typography sx={{ color: D.faint, fontSize: 11.5 }}>{o.orderDate ? fmtDate(o.orderDate) : '—'}</Typography>
      </Box>
      <Box
        sx={{ px: 1, py: 0.3, borderRadius: 999, bgcolor: meta.bg, color: meta.color,
          fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, flexShrink: 0,
          border: `1px solid ${meta.color}33` }}
      >
        {meta.label}
      </Box>
      <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13, ...mono, minWidth: 72, textAlign: 'right', flexShrink: 0 }}>
        {fmt(o.totalValue)}
      </Typography>
    </Box>
  );
}

export default function CompanyDetail({ data, loading, onBack, onPatch, onLog }) {
  // data = { client, orders }
  const client = data?.client || null;
  const orders = data?.orders || [];

  // Local editable copies for text fields so typing doesn't fight the round-trip.
  const [name, setName] = React.useState('');
  const [dealValue, setDealValue] = React.useState('');
  const [areaText, setAreaText] = React.useState('');
  const [savingField, setSavingField] = React.useState('');

  React.useEffect(() => {
    if (!client) return;
    setName(client.companyName || client.clientName || '');
    setDealValue(client.dealValue != null && client.dealValue !== 0 ? String(client.dealValue) : '');
    setAreaText(client.area || '');
  }, [client]);

  if (loading || !client) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }

  // Commit a single field via the parent's PATCH. Marks the field "saving" so we
  // can show a tiny spinner, and swallows errors after surfacing (parent alerts).
  const commit = async (field, value) => {
    setSavingField(field);
    try { await onPatch({ [field]: value }); }
    finally { setSavingField(''); }
  };

  const log = Array.isArray(client.log) ? [...client.log].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)) : [];
  const contacts = client.contacts || [];
  const fu = followUpStatus(client.nextFollowUp);
  const phone = client.phone || (contacts.find((c) => c.phone)?.phone) || '';

  return (
    <Stack spacing={2.5}>
      {/* Back + headline */}
      <Box>
        <Button
          onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
          sx={{ textTransform: 'none', color: D.muted, fontWeight: 600, px: 0.5, mb: 1,
            '&:hover': { color: D.green, bgcolor: 'transparent' } }}
        >
          All companies
        </Button>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <TextField
              value={name} onChange={(e) => setName(e.target.value)}
              onBlur={() => { if ((client.companyName || '') !== name) commit('companyName', name); }}
              variant="standard" placeholder="Company name"
              sx={{
                '& .MuiInputBase-input': { color: D.text, fontWeight: 800, fontSize: 22, p: 0 },
                '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
                '& .MuiInput-underline:hover:before': { borderBottomColor: `${D.line} !important` },
                '& .MuiInput-underline:after': { borderBottomColor: D.green },
              }}
              fullWidth
            />
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 0.5 }}>
              <StageChip stage={client.stage} />
              <Typography sx={{ color: D.faint, fontSize: 12, ...mono }}>{client.companyKey}</Typography>
            </Stack>
            {client.stage === 'lost' && client.lostReason && (
              <Typography sx={{ color: '#fca5a5', fontSize: 12, mt: 0.75 }}>
                Lost: {client.lostReason}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexShrink={0}>
            {phone && (
              <Button component="a" href={telHref(phone)} startIcon={<PhoneInTalkIcon />}
                sx={{ ...dropPrimaryBtn, px: 2 }}>
                Call
              </Button>
            )}
            <Button onClick={onLog} startIcon={<EditNoteOutlinedIcon />}
              sx={{ color: D.text, border: `1px solid ${D.line}`, fontWeight: 700, textTransform: 'none',
                borderRadius: 999, px: 2, '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.06)' } }}>
              Log a touch
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Editable header grid */}
      <Box sx={{
        display: 'grid', gap: 1.5,
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2,
      }}>
        <Field label={savingField === 'stage' ? 'Stage · saving…' : 'Stage'}>
          <TextField select value={client.stage || 'lead'} onChange={(e) => commit('stage', e.target.value)}
            size="small" fullWidth sx={fieldSx}>
            {CRM_STAGES.map((s) => <MenuItem key={s} value={s}>{stageMeta(s).label}</MenuItem>)}
          </TextField>
        </Field>
        <Field label={savingField === 'interestType' ? 'Interest · saving…' : 'Interest'}>
          <TextField select value={client.interestType || ''} onChange={(e) => commit('interestType', e.target.value)}
            size="small" fullWidth sx={fieldSx}>
            {INTEREST_TYPES.map((i) => <MenuItem key={i || 'none'} value={i}>{interestLabel(i)}</MenuItem>)}
          </TextField>
        </Field>
        <Field label={savingField === 'area' ? 'Area · saving…' : 'Area'}>
          <TextField value={areaText} onChange={(e) => setAreaText(e.target.value)}
            onBlur={() => { if ((client.area || '') !== areaText) commit('area', areaText); }}
            size="small" fullWidth sx={fieldSx} placeholder="e.g. South Jersey" />
        </Field>
        <Field label={savingField === 'dealValue' ? 'Deal value · saving…' : 'Deal value'}>
          <TextField value={dealValue} onChange={(e) => setDealValue(e.target.value.replace(/[^\d.]/g, ''))}
            onBlur={() => {
              const n = Number(dealValue) || 0;
              if ((client.dealValue || 0) !== n) commit('dealValue', n);
            }}
            size="small" fullWidth sx={fieldSx} placeholder="0"
            InputProps={{ startAdornment: <InputAdornment position="start"><Box sx={{ color: D.faint }}>$</Box></InputAdornment> }} />
        </Field>
        <Field label={savingField === 'nextFollowUp' ? 'Next follow-up · saving…' : 'Next follow-up'}>
          <TextField type="date" value={dateInputValue(client.nextFollowUp)}
            onChange={(e) => commit('nextFollowUp', e.target.value || null)}
            size="small" fullWidth sx={fieldSx} InputLabelProps={{ shrink: true }} />
          {client.nextFollowUp && (
            <Typography sx={{ color: fu.tone, fontSize: 11, fontWeight: 700, mt: 0.5, ...mono }}>{fu.label}</Typography>
          )}
        </Field>
      </Box>

      {/* Two-column body: contacts + orders on the side, log timeline as the spine */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' } }}>
        {/* Log timeline */}
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75 }}>
            <Eyebrow>Activity</Eyebrow>
            <Button onClick={onLog} size="small" startIcon={<EditNoteOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: 'none', color: D.green, fontSize: 12, fontWeight: 700,
                '&:hover': { bgcolor: 'rgba(74,222,128,0.08)' } }}>
              Add
            </Button>
          </Stack>
          {log.length === 0 ? (
            <Typography sx={{ color: D.faint, fontSize: 13, py: 2, textAlign: 'center' }}>
              No activity yet. Log your first touch.
            </Typography>
          ) : (
            <Box>{log.map((e, i) => <LogEntry key={i} entry={e} last={i === log.length - 1} />)}</Box>
          )}
        </Box>

        {/* Side column */}
        <Stack spacing={2}>
          <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
            <Eyebrow sx={{ mb: 1.5, display: 'block' }}>Contacts</Eyebrow>
            {contacts.length === 0 ? (
              <Typography sx={{ color: D.faint, fontSize: 12.5, py: 1 }}>No contacts on file.</Typography>
            ) : (
              <Stack spacing={1}>{contacts.map((c, i) => <ContactCard key={i} c={c} />)}</Stack>
            )}
            {(client.email || client.phone) && (
              <>
                <Divider sx={{ borderColor: D.line, my: 1.5 }} />
                <Stack spacing={0.75}>
                  {client.phone && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PhoneInTalkIcon sx={{ fontSize: 15, color: D.faint }} />
                      <MuiLink href={telHref(client.phone)} sx={{ color: D.green, fontSize: 13, ...mono, textDecoration: 'none' }}>
                        {client.phone}
                      </MuiLink>
                    </Stack>
                  )}
                  {client.email && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MailOutlineIcon sx={{ fontSize: 15, color: D.faint }} />
                      <MuiLink href={`mailto:${client.email}`} sx={{ color: D.muted, fontSize: 13, ...mono, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.email}
                      </MuiLink>
                    </Stack>
                  )}
                </Stack>
              </>
            )}
          </Box>

          {/* Tags — add / remove, each change PATCHes the whole tags[] */}
          <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
            <TagEditor
              tags={client.tags}
              saving={savingField === 'tags'}
              onChange={(next) => commit('tags', next)}
            />
          </Box>

          <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Eyebrow>Orders</Eyebrow>
              {orders.length > 0 && (
                <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>{orders.length}</Typography>
              )}
            </Stack>
            {orders.length === 0 ? (
              <Typography sx={{ color: D.faint, fontSize: 12.5, py: 1 }}>No linked orders yet.</Typography>
            ) : (
              <Box sx={{ mx: -1.25, '& > div:last-of-type': { borderBottom: 'none' } }}>
                {orders.map((o) => <OrderRow key={o._id || o.projectNumber || o.orderNumber} o={o} />)}
              </Box>
            )}
          </Box>

          {client.notes && (
            <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
              <Eyebrow sx={{ mb: 1, display: 'block' }}>Notes</Eyebrow>
              <Typography sx={{ color: D.muted, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{client.notes}</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Box sx={{ height: 8 }} />
    </Stack>
  );
}
