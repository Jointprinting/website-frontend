// src/screens/studio/crm/CompanyDetail.js
// One company, end to end. Loads /api/crm/:companyKey → { client, orders }.
//   • Editable header: company name + an inline grid of stage / area / interest /
//     deal value / next follow-up. Each field commits its own PATCH on change
//     (selects immediately, text on blur), so editing is a single tap, no "save".
//   • Contacts — inline-editable rows (add / edit / delete / ★ main); every
//     change PATCHes the whole contacts array. Tap-to-call / mail stay.
//   • Log timeline — newest first, kind icon per entry. "Log a touch" appends;
//     entries edit inline (click the text) and delete on hover.
//   • Linked Orders pulled from the same endpoint.
// The parent owns the PATCH transport (patchCompany) so optimistic refreshes and
// list invalidation stay in one place; this view calls it and re-pulls itself.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, MenuItem, IconButton, Button, Divider,
  CircularProgress, InputAdornment, Link as MuiLink, Tooltip,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import {
  D, mono, dropInput, fmt, fmtDate, fmtRelative, STATUS_META,
} from '../_shared';
import {
  StageChip, StageProgress, Eyebrow, TagChips, CRM_STAGES, PRE_CUSTOMER_STAGES, stageMeta,
  kindMeta, dateInputValue, followUpStatus, telHref, fmtMoney0, isWonStage, isClientFromDeals,
} from './_crm';
import { StatusChip, enrollmentStatusMeta } from '../outreach/_outreach';
import CompanyDealsPanel from './CompanyDealsPanel';

// The COGS sub-hint under the Profit metric. The headline cost is the ACTUAL one
// from the receipts linked to this company's orders (finance.cogs — what the
// receipts say it really cost). When the confirmation/quote ESTIMATE
// (finance.estimatedCogs) differs by more than a cent, we show it alongside so the
// variance is visible; when there are no receipts behind the cost yet, we say so
// rather than implying the receipts confirm a $0 / estimate-only number.
function financeCogsHint(finance) {
  if (!finance) return null;
  const actual = Number(finance.cogs) || 0;
  const est = Number(finance.estimatedCogs) || 0;
  const hasReceipts = (Number(finance.receiptCount) || 0) > 0;
  if (!hasReceipts) {
    // Profit itself now falls back to the estimate server-side
    // (profitIsEstimate) — the hint says which cost the number stands on.
    return est > 0 ? `− ${fmtMoney0(est)} est. cost · no receipts yet` : `${fmtMoney0(actual)} COGS`;
  }
  const base = `${fmtMoney0(actual)} COGS · receipts`;
  return Math.abs(actual - est) >= 1 ? `${base} · ${fmtMoney0(est)} est` : base;
}

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

// Compact inline-edit inputs for a contact row — the detail card's field styling
// at a slightly denser size so name/role/phone/email fit a side-column card.
const contactFieldSx = {
  ...dropInput,
  '& .MuiInputBase-input': { ...dropInput['& .MuiInputBase-input'], fontSize: 12.5, py: 0.7, px: 1 },
};

// One EDITABLE contact — name / role / phone / email, each committing on blur
// (same tap-to-edit rhythm as the header fields). The ★ toggle marks the MAIN
// contact: the backend mirrors their phone/email to the record's top level, which
// is what every list row / Call / Text action reads. Tap-to-call / mail stay as
// quick actions when the values exist.
function ContactRow({ c, onField, onCommit, onStar, onDelete }) {
  const starred = !!c.isPrimary;
  const blank = !(c.name || c.role || c.phone || c.email);
  return (
    <Box sx={{
      bgcolor: D.inset, border: `1px solid ${starred ? 'rgba(251,191,36,0.45)' : D.line}`,
      borderRadius: 2, p: 1.25,
    }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <Tooltip title={blank ? 'Add their details first' : (starred ? 'Main contact — tap to unstar' : 'Make main contact')}>
          <IconButton
            onClick={blank ? undefined : onStar} size="small" disabled={blank}
            aria-label={starred ? 'Unstar main contact' : 'Make main contact'}
            sx={{ p: 0.4, flexShrink: 0, color: starred ? D.amber : D.faint,
              '&:hover': { color: D.amber, bgcolor: 'rgba(251,191,36,0.1)' } }}
          >
            {starred ? <StarRoundedIcon sx={{ fontSize: 19 }} /> : <StarBorderRoundedIcon sx={{ fontSize: 19 }} />}
          </IconButton>
        </Tooltip>
        <TextField
          value={c.name} onChange={(e) => onField('name', e.target.value)} onBlur={() => onCommit('name')}
          size="small" fullWidth placeholder="Name" sx={contactFieldSx}
        />
        <TextField
          value={c.role} onChange={(e) => onField('role', e.target.value)} onBlur={() => onCommit('role')}
          size="small" placeholder="Role" sx={{ ...contactFieldSx, width: 104, flexShrink: 0 }}
        />
        <IconButton
          onClick={onDelete} size="small" aria-label="Delete contact"
          sx={{ p: 0.4, flexShrink: 0, color: D.faint,
            '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.1)' } }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <TextField
          value={c.phone} onChange={(e) => onField('phone', e.target.value)} onBlur={() => onCommit('phone')}
          size="small" fullWidth placeholder="Phone" sx={contactFieldSx}
        />
        <TextField
          value={c.email} onChange={(e) => onField('email', e.target.value)} onBlur={() => onCommit('email')}
          size="small" fullWidth placeholder="Email" sx={contactFieldSx}
        />
        {c.phone && (
          <IconButton component="a" href={telHref(c.phone)} size="small"
            sx={{ flexShrink: 0, color: D.green, '&:hover': { bgcolor: 'rgba(74,222,128,0.12)' } }}>
            <PhoneInTalkIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        {c.email && (
          <IconButton component="a" href={`mailto:${c.email}`} size="small"
            sx={{ flexShrink: 0, color: D.muted, '&:hover': { color: D.text, bgcolor: 'rgba(255,255,255,0.05)' } }}>
            <MailOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Stack>
      {starred && (
        <Typography sx={{ ...mono, color: D.amber, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', mt: 0.6 }}>
          ★ Main — their phone &amp; email front this company
        </Typography>
      )}
    </Box>
  );
}

// Contacts editor — inline-editable rows + add/delete + the ★ main toggle. Every
// commit path PATCHes the WHOLE contacts array through the parent's field-patch
// (the server trims, drops all-blank rows, and keeps at most one isPrimary).
// Same optimistic convention as TagEditor below: the local copy is authoritative
// during edits (re-synced only when the open company changes), so a fast second
// edit isn't clobbered by the first PATCH's refetch.
function ContactsEditor({ contacts, companyKey, onSave }) {
  const incoming = React.useMemo(
    () => (Array.isArray(contacts) ? contacts : []).map((c) => ({
      name: (c && c.name) || '', role: (c && c.role) || '',
      phone: (c && c.phone) || '', email: (c && c.email) || '',
      isPrimary: !!(c && c.isPrimary),
    })),
    [contacts],
  );
  const [list, setList] = React.useState(incoming);
  // What we last sent/loaded — blur only PATCHes when a field actually changed,
  // so tabbing through rows doesn't spray no-op writes.
  const committedRef = React.useRef(incoming);
  React.useEffect(() => { setList(incoming); committedRef.current = incoming; }, [companyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (i, field, value) => setList((l) => l.map((c, j) => (j === i ? { ...c, [field]: value } : c)));

  // A just-added row the owner hasn't typed into yet. It lives ONLY locally:
  // every PATCH sends persistable(list) so the server (which drops blanks)
  // never sees it — otherwise starring it, or any other field's blur, would
  // silently vanish the row (and could burn the one ★ on a row about to drop).
  const isBlank = (c) => !(c && (c.name || c.role || c.phone || c.email));
  const persistable = (l) => l.filter((c) => !isBlank(c));

  const commitField = (i, field) => {
    const cur = (list[i] && list[i][field]) || '';
    const was = (committedRef.current[i] && committedRef.current[i][field]) || '';
    if (cur === was) return;
    committedRef.current = list;
    onSave(persistable(list));
  };

  // ★ toggle — one tap. Starring makes this row the ONLY primary; tapping the
  // filled star un-stars everyone. Commits immediately (like the selects).
  // Blank rows can't take the star (nothing to point the ecosystem at yet).
  const toggleStar = (i) => {
    if (isBlank(list[i])) return;
    const on = !(list[i] && list[i].isPrimary);
    const next = list.map((c, j) => ({ ...c, isPrimary: on && j === i }));
    setList(next);
    committedRef.current = next;
    onSave(persistable(next));
  };

  const removeAt = (i) => {
    const next = list.filter((_, j) => j !== i);
    setList(next);
    committedRef.current = next;
    onSave(persistable(next));
  };

  // Append a blank editable row. No PATCH yet — the server drops all-blank rows,
  // so the row only persists once the owner types something and blurs.
  const add = () => setList((l) => [...l, { name: '', role: '', phone: '', email: '', isPrimary: false }]);

  return (
    <Box>
      {list.length === 0 ? (
        <Typography sx={{ color: D.faint, fontSize: 12.5, py: 1 }}>No contacts on file.</Typography>
      ) : (
        <Stack spacing={1}>
          {list.map((c, i) => (
            <ContactRow
              key={i}
              c={c}
              onField={(f, v) => setField(i, f, v)}
              onCommit={(f) => commitField(i, f)}
              onStar={() => toggleStar(i)}
              onDelete={() => removeAt(i)}
            />
          ))}
        </Stack>
      )}
      <Button
        onClick={add} size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
        sx={{ mt: 1, textTransform: 'none', color: D.green, fontSize: 12, fontWeight: 700,
          '&:hover': { bgcolor: 'rgba(74,222,128,0.08)' } }}
      >
        Add contact
      </Button>
    </Box>
  );
}

// Tags editor — removable chips + an inline "add" input. The input is ALWAYS
// live (the owner reported it greyed-out/unusable): we keep an OPTIMISTIC local
// copy so chips update the instant you add/remove, never waiting on the PATCH
// round-trip (which would otherwise blank the field while the parent refetches).
// De-dupes case-insensitively to match the server's normalization. The incoming
// `tags` prop reconciles the local copy once the save lands.
function TagEditor({ tags, companyKey, onChange, saving }) {
  const incoming = React.useMemo(
    () => (Array.isArray(tags) ? tags.filter(Boolean) : []),
    [tags],
  );
  const [list, setList] = React.useState(incoming);
  const [draft, setDraft] = React.useState('');

  // Re-sync from the server ONLY when the company changes (open a different card)
  // — NOT on every tags change. Resetting on each tags prop would clobber a fast
  // second add while the first PATCH's refetch is still in flight (the optimistic
  // copy is authoritative during edits; both PATCHes still land server-side).
  React.useEffect(() => { setList(incoming); }, [companyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    if (list.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    const next = [...list, t];
    setList(next);          // optimistic — chip appears immediately
    onChange(next);
  };
  const remove = (t) => {
    const next = list.filter((x) => x !== t);
    setList(next);          // optimistic
    onChange(next);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Eyebrow>Tags{saving ? ' · saving…' : ''}</Eyebrow>
      </Stack>
      {list.length > 0 ? (
        <TagChips tags={list} onDelete={remove} sx={{ mb: 1.25 }} />
      ) : (
        <Typography sx={{ color: D.faint, fontSize: 12.5, mb: 1.25 }}>
          No tags yet.
        </Typography>
      )}
      <Stack direction="row" spacing={1}>
        <TextField
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          size="small" fullWidth placeholder="Add a tag — press Enter" sx={fieldSx}
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

function LogEntry({ entry, last, onDelete, onEdit }) {
  const { Icon, color, label } = kindMeta(entry.kind);
  const [hover, setHover] = React.useState(false);
  // Inline edit — click the text (or the hover pencil) to reword a logged touch.
  // Enter / blur saves through the log PATCH; Escape cancels; an emptied draft is
  // treated as a cancel (delete is the removal path, matching the server's 400).
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const startEdit = () => { setDraft(entry.text || ''); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => {
    const t = draft.trim();
    setEditing(false);
    if (!t || t === (entry.text || '')) return;
    Promise.resolve(onEdit(t)).catch(() => {}); // parent already toasts failures
  };
  return (
    <Box
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      sx={{ display: 'flex', gap: 1.25, position: 'relative', pb: last ? 0 : 2 }}
    >
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
        {editing ? (
          <TextField
            value={draft} onChange={(e) => setDraft(e.target.value)}
            autoFocus multiline fullWidth size="small" sx={fieldSx}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            onBlur={saveEdit}
          />
        ) : (
          <Typography
            onClick={onEdit ? startEdit : undefined}
            title={onEdit ? 'Click to edit' : undefined}
            sx={{ color: D.text, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              ...(onEdit ? { cursor: 'text', borderRadius: 1, mx: -0.5, px: 0.5,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } } : {}) }}
          >
            {entry.text}
          </Typography>
        )}
      </Box>
      {/* Edit / delete this single entry. Visible on hover (always visible on
          touch via the tap target). Owner asked to fix typos + remove notes. */}
      {onEdit && !editing && (
        <IconButton
          onClick={startEdit} size="small" aria-label="Edit note"
          sx={{
            flexShrink: 0, color: D.faint, opacity: { xs: 1, sm: hover ? 1 : 0 },
            transition: 'opacity 0.15s ease, color 0.15s ease',
            '&:hover': { color: D.green, bgcolor: 'rgba(74,222,128,0.1)' },
          }}
        >
          <EditOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
      {onDelete && (
        <IconButton
          onClick={onDelete} size="small" aria-label="Delete note"
          sx={{
            flexShrink: 0, color: D.faint, opacity: { xs: 1, sm: hover ? 1 : 0 },
            transition: 'opacity 0.15s ease, color 0.15s ease',
            '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.1)' },
          }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
}

function OrderRow({ o, onOpen }) {
  const meta = STATUS_META[o.status] || { label: o.status || '—', color: D.muted, bg: 'rgba(255,255,255,0.06)' };
  // Clickable only when we can resolve the target order (a project/order number).
  // No identifier → render as a plain row (no dead-end, no misleading affordance).
  const canOpen = !!onOpen && !!(o.projectNumber || o.orderNumber);
  return (
    <Box
      onClick={canOpen ? () => onOpen(o) : undefined}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(o); } } : undefined}
      title={canOpen ? 'Open this order' : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, py: 1.1, px: 1.25,
        borderBottom: `1px solid ${D.line}`,
        cursor: canOpen ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
        '&:hover': canOpen ? { bgcolor: 'rgba(74,222,128,0.06)' } : undefined,
        '&:focus-visible': canOpen ? { outline: `2px solid ${D.green}`, outlineOffset: -2, bgcolor: 'rgba(74,222,128,0.06)' } : undefined,
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

// One mockup tile in the Design Library — front thumbnail, number caption, and a
// deep-link to the order it lives on (reuses onOpenOrder, the same path the Orders
// rows use). Unlinked art (saved in the Studio, not yet on an order) still shows;
// it just isn't clickable.
function MockupTile({ m, onOpenOrder }) {
  const canOpen = !!onOpenOrder && !!(m.projectNumber || m.orderNumber);
  const open = canOpen ? () => onOpenOrder({ projectNumber: m.projectNumber, orderNumber: m.orderNumber }) : undefined;
  return (
    <Box
      onClick={open}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : undefined}
      title={canOpen ? `Open order for ${m.mockupNum || 'this mockup'}` : (m.mockupNum || m.name || 'Mockup')}
      sx={{
        position: 'relative', borderRadius: 1.5, overflow: 'hidden',
        border: `1px solid ${D.line}`, bgcolor: D.inset, aspectRatio: '1 / 1',
        cursor: canOpen ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease, transform 0.15s ease',
        '&:hover': canOpen ? { borderColor: D.green, transform: 'translateY(-1px)' } : undefined,
        '&:focus-visible': canOpen ? { outline: `2px solid ${D.green}`, outlineOffset: 1 } : undefined,
      }}>
      {m.thumbnail ? (
        <Box component="img" src={m.thumbnail} alt={m.mockupNum || m.name || 'Mockup'} loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PaletteOutlinedIcon sx={{ color: D.faint, fontSize: 22 }} />
        </Box>
      )}
      {(m.mockupNum || !canOpen) && (
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, px: 0.75, py: 0.4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5,
          bgcolor: 'rgba(0,0,0,0.62)' }}>
          <Typography sx={{ ...mono, color: '#fff', fontSize: 10.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.mockupNum || m.name || '—'}
          </Typography>
          {!canOpen && (
            <Typography sx={{ color: D.faint, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', flexShrink: 0 }}>
              unlinked
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

// The company's whole visual footprint in one panel: its logo(s) + every mockup
// made for it, each deep-linked to its order. Hidden entirely when there's nothing
// yet (no empty box).
function DesignLibraryPanel({ designLibrary, onOpenOrder }) {
  const logos   = (designLibrary && designLibrary.logos)   || [];
  const mockups = (designLibrary && designLibrary.mockups) || [];
  if (!logos.length && !mockups.length) return null;
  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <PaletteOutlinedIcon sx={{ color: D.green, fontSize: 16 }} />
          <Eyebrow>Design library</Eyebrow>
        </Stack>
        <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>
          {mockups.length ? `${mockups.length} mockup${mockups.length === 1 ? '' : 's'}` : ''}
        </Typography>
      </Stack>

      {logos.length > 0 && (
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: mockups.length ? 1.5 : 0 }}>
          {logos.map((lg) => (
            <Box key={lg._id} sx={{ width: 52, height: 52, borderRadius: 1.5, border: `1px solid ${D.line}`,
              bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {lg.imageDataUrl
                ? <Box component="img" src={lg.imageDataUrl} alt="Logo" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <PaletteOutlinedIcon sx={{ color: D.faint, fontSize: 18 }} />}
            </Box>
          ))}
          <Typography sx={{ color: D.faint, fontSize: 11.5 }}>Brand logo on file</Typography>
        </Stack>
      )}

      {mockups.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 1 }}>
          {mockups.map((m) => <MockupTile key={m._id} m={m} onOpenOrder={onOpenOrder} />)}
        </Box>
      )}
    </Box>
  );
}

// Mirror of backend utils/brands.js SUBSCRIPTION_BRAND_KEYS + accents (keep in
// sync). The two recurring brands; Joint Printing bills per order, not on a plan.
const SUB_BRANDS = {
  webworks: { label: 'JP Webworks', accent: '#54a6ff' },
  atom:     { label: 'JP Atom',     accent: '#9e82ff' },
};
const SUB_STATUS_META = {
  active:   { label: 'Active',   color: D.green },
  paused:   { label: 'Paused',   color: D.amber },
  canceled: { label: 'Canceled', color: D.faint },
};
// A plan's monthly-equivalent revenue (annual ÷ 12), for the card's "/mo" readout.
const subMonthly = (s) => {
  const amt = Number(s.amount) || 0;
  return s.cadence === 'annual' ? amt / 12 : amt;
};

// One recurring plan row + its pause/resume/cancel actions.
function SubscriptionRow({ s, onSetStatus }) {
  const brand = SUB_BRANDS[s.brand] || { label: s.brand, accent: D.muted };
  const st = SUB_STATUS_META[s.status] || { label: s.status, color: D.muted };
  const live = s.status === 'active';
  return (
    <Box sx={{ py: 1, borderBottom: `1px solid ${D.line}`, '&:last-of-type': { borderBottom: 'none' } }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: brand.accent, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.plan || brand.label}
          </Typography>
          <Typography sx={{ color: D.faint, fontSize: 11 }}>
            {brand.label}{s.nextBillDate && live ? ` · next ${fmtDate(s.nextBillDate)}` : ''}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ ...mono, color: D.text, fontWeight: 800, fontSize: 13 }}>
            {fmtMoney0(subMonthly(s))}<Typography component="span" sx={{ color: D.faint, fontSize: 10, fontWeight: 600 }}>/mo</Typography>
          </Typography>
          <Typography sx={{ color: st.color, fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase' }}>{st.label}</Typography>
        </Box>
        {s.status !== 'canceled' && (
          <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
            <Tooltip title={live ? 'Pause' : 'Resume'}>
              <IconButton size="small" onClick={() => onSetStatus(s._id, live ? 'paused' : 'active')}
                sx={{ color: D.faint, '&:hover': { color: D.green } }}>
                {live ? <PauseCircleOutlineIcon sx={{ fontSize: 17 }} /> : <PlayCircleOutlineIcon sx={{ fontSize: 17 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Cancel plan">
              <IconButton size="small" onClick={() => onSetStatus(s._id, 'canceled')}
                sx={{ color: D.faint, '&:hover': { color: '#f87171' } }}>
                <CancelOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

// Recurring plans on the company card — the per-client slice of the money layer.
// Lists the company's Webworks/Atom subscriptions, sums active MRR, and lets the
// owner add a plan or pause/resume/cancel one. Always shown (adding the first plan
// is how a print client becomes a subscription client).
function SubscriptionsPanel({ subscriptions, onAdd, onSetStatus }) {
  const subs = subscriptions || [];
  const [adding, setAdding] = React.useState(false);
  const [brand, setBrand] = React.useState('webworks');
  const [plan, setPlan] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [cadence, setCadence] = React.useState('monthly');
  const [busy, setBusy] = React.useState(false);

  const mrr = subs.filter((s) => s.status === 'active').reduce((sum, s) => sum + subMonthly(s), 0);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onAdd({ brand, plan: plan.trim(), amount: Number(amount) || 0, cadence });
      setAdding(false); setPlan(''); setAmount(''); setBrand('webworks'); setCadence('monthly');
    } catch { /* parent flashed */ }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: subs.length || adding ? 1.25 : 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <AutorenewIcon sx={{ color: D.green, fontSize: 16 }} />
          <Eyebrow>Recurring plans</Eyebrow>
        </Stack>
        {mrr > 0
          ? <Typography sx={{ ...mono, color: D.green, fontSize: 12, fontWeight: 800 }}>{fmtMoney0(mrr)}/mo</Typography>
          : <Typography sx={{ color: D.faint, fontSize: 11 }}>none yet</Typography>}
      </Stack>

      {subs.length > 0 && (
        <Box sx={{ mx: -0.5 }}>
          {subs.map((s) => <SubscriptionRow key={s._id} s={s} onSetStatus={onSetStatus} />)}
        </Box>
      )}

      {adding ? (
        <Box sx={{ mt: 1.25, p: 1.25, bgcolor: D.inset, border: `1px solid ${D.line}`, borderRadius: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField select size="small" label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} sx={{ ...dropInput, flex: 1 }}>
              {Object.entries(SUB_BRANDS).map(([k, b]) => <MenuItem key={k} value={k}>{b.label}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Cadence" value={cadence} onChange={(e) => setCadence(e.target.value)} sx={{ ...dropInput, width: 120 }}>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="annual">Annual</MenuItem>
            </TextField>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField size="small" label="Plan" placeholder="Care Plan" value={plan} onChange={(e) => setPlan(e.target.value)} sx={{ ...dropInput, flex: 1 }} />
            <TextField size="small" label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ color: D.faint, fontSize: 13 }}>$</Typography></InputAdornment> }}
              sx={{ ...dropInput, width: 110 }} />
            <Button onClick={submit} disabled={busy} variant="contained"
              sx={{ bgcolor: D.green, color: D.ink, fontWeight: 800, textTransform: 'none', minWidth: 0, px: 1.75,
                '&:hover': { bgcolor: '#5cec8e' }, '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.3)', color: D.ink } }}>Add</Button>
            <Button onClick={() => setAdding(false)} sx={{ color: D.faint, textTransform: 'none', fontSize: 12, minWidth: 0 }}>Cancel</Button>
          </Stack>
        </Box>
      ) : (
        <Button onClick={() => setAdding(true)} startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          sx={{ mt: subs.length ? 1 : 0, textTransform: 'none', color: D.green, fontWeight: 700, fontSize: 12.5, px: 0.5,
            '&:hover': { bgcolor: 'transparent', color: '#5cec8e' } }}>
          Add a plan
        </Button>
      )}
    </Box>
  );
}

// One figure in the finance metric row — tiny uppercase label over a big
// monospace number, optional sub-hint. Mirrors DashboardView's MetricCard so the
// company page reads the same as the dashboard.
function Metric({ label, value, accent, hint }) {
  return (
    <Box sx={{
      flex: '1 1 120px', minWidth: 108, px: { xs: 1.25, sm: 1.5 }, py: 1.25,
      borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}`,
    }}>
      <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ ...mono, color: accent || D.text, fontSize: { xs: 18, sm: 20 }, fontWeight: 800, lineHeight: 1.15, mt: 0.35 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5, fontWeight: 700, mt: 0.2 }}>{hint}</Typography>
      ) : null}
    </Box>
  );
}

// One linked PO — number · vendor on the left, grand total (monospace) on the
// right. Same row rhythm as OrderRow. The row opens the PO on its order; the
// vendor name (when present) is its own link to that vendor's card.
function PoRow({ p, onOpen, onOpenVendor }) {
  // Open-PO needs the sibling order (resolved by the parent from orderId) — gate
  // on that so a PO whose order can't be resolved stays a plain, safe row.
  const canOpen = !!onOpen && !!(p.orderId || p.projectNumber || p.orderNumber);
  const canOpenVendor = !!onOpenVendor && !!p.vendorName;
  return (
    <Box
      onClick={canOpen ? () => onOpen(p) : undefined}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(p); } } : undefined}
      title={canOpen ? 'Open this PO' : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, py: 1.1, px: 1.25,
        borderBottom: `1px solid ${D.line}`,
        cursor: canOpen ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
        '&:hover': canOpen ? { bgcolor: 'rgba(74,222,128,0.06)' } : undefined,
        '&:focus-visible': canOpen ? { outline: `2px solid ${D.green}`, outlineOffset: -2, bgcolor: 'rgba(74,222,128,0.06)' } : undefined,
      }}>
      <DescriptionOutlinedIcon sx={{ fontSize: 18, color: D.faint, flexShrink: 0 }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13, ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.poNumber ? (String(p.poNumber).startsWith('#') ? p.poNumber : `#${p.poNumber}`) : 'PO'}
          {p.vendorName ? (
            <Box component="span" sx={{ color: D.faint, fontWeight: 600, ...mono }}> · {
              canOpenVendor ? (
                <Box
                  component="span"
                  onClick={(e) => { e.stopPropagation(); onOpenVendor(p.vendorName); }}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpenVendor(p.vendorName); } }}
                  title={`Open ${p.vendorName}`}
                  sx={{ color: D.green, cursor: 'pointer', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  {p.vendorName}
                </Box>
              ) : p.vendorName
            }</Box>
          ) : null}
        </Typography>
        <Typography sx={{ color: D.faint, fontSize: 11.5 }}>{p.date ? fmtDate(p.date) : '—'}</Typography>
      </Box>
      <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13, ...mono, minWidth: 72, textAlign: 'right', flexShrink: 0 }}>
        {fmt(p.grandTotal)}
      </Typography>
    </Box>
  );
}

// ── Progress / level card ─────────────────────────────────────────────────────
// A segmented funnel rail with a short factual headline + the stage chip. Flat —
// no celebration banner / glow; the bar + chip say where the deal stands.
function ProgressCard({ stage, isCustomer }) {
  const won = isWonStage(stage) || isCustomer;
  const headline = won ? (isCustomer ? 'Client' : 'Won') : stageMeta(stage).label;

  return (
    <Box sx={{
      bgcolor: D.panel,
      border: `1px solid ${D.line}`, borderRadius: 2.5,
      p: { xs: 1.75, sm: 2 },
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {headline}
        </Typography>
        <StageChip stage={stage} />
      </Stack>
      <StageProgress stage={stage} height={7} showLabel />
    </Box>
  );
}

export default function CompanyDetail({ data, loading, onBack, onPatch, onLog, onDeleteLog, onEditLog, onArchive, onOpenOrder, onOpenPo, onOpenVendor, onOpenLookbooks, onAddSubscription, onSetSubStatus, onNewDeal, onEditDeal, onWinDeal, onLoseDeal, onReopenDeal, onRemoveDeal, onOpenDeal, onStartJob, onSetDealStage, onOpenPortal, onRevokePortal }) {
  // data = { client, orders, pos, finance, isCustomer, deals }
  const client = data?.client || null;
  const orders = data?.orders || [];
  const pos = data?.pos || [];
  // Finance summary computed server-side by reusing the /api/finances math.
  const finance = data?.finance || null;
  // Cold-email sequences this company is (or was) enrolled in (server-joined).
  const outreach = data?.outreach || [];
  // This business's deals (loaded alongside the record). The deal model is now the
  // client-making authority: ≥1 won deal ⇒ a client, even before an order lands.
  const deals = data?.deals || [];
  // Every visual asset tied to this company — logo(s) + mockups — server-gathered
  // and deep-linked to the order each mockup lives on. { logos, mockups }.
  const designLibrary = data?.designLibrary || null;
  // Recurring plans (Webworks/Atom) this company is on — the per-client money layer.
  const subscriptions = data?.subscriptions || [];
  // Authoritative "is a client": order reality (≥1 linked order) OR a won deal.
  const isCustomer = (data?.isCustomer ?? client?.isCustomer ?? (orders.length > 0)) || isClientFromDeals(deals);

  // Local editable copies for text fields so typing doesn't fight the round-trip.
  const [name, setName] = React.useState('');
  const [dealValue, setDealValue] = React.useState('');
  const [addressText, setAddressText] = React.useState('');
  const [notesText, setNotesText] = React.useState('');
  const [savingField, setSavingField] = React.useState('');

  // Which inline field has focus right now — a refetch that lands mid-typing
  // must not reset THAT field's draft (the others re-sync as usual). Set/cleared
  // by each field's onFocus/onBlur below.
  const editingFieldRef = React.useRef(null);

  React.useEffect(() => {
    if (!client) return;
    const ef = editingFieldRef.current;
    if (ef !== 'name') setName(client.companyName || client.clientName || '');
    if (ef !== 'dealValue') setDealValue(client.dealValue != null && client.dealValue !== 0 ? String(client.dealValue) : '');
    // Prefer the exact address; fall back to the legacy area so an existing
    // region still shows (the owner can overwrite it with a real address).
    if (ef !== 'address') setAddressText(client.address || client.area || '');
    if (ef !== 'notes') setNotesText(client.notes || '');
  }, [client]);

  // Spinner only while there is nothing to show (first open / company switch).
  // A same-company refresh keeps the card mounted so blur-commit editors never
  // lose in-progress typing to the refetch.
  if (!client) {
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
  const fu = followUpStatus(client.nextFollowUp);

  // Delete/edit target one log entry by stable _id when present; legacy entries
  // (no id) address their position in the ORIGINAL (unsorted) log array.
  const logEntryId = (e) => (e._id != null ? e._id : (client.log || []).indexOf(e));

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
              onFocus={() => { editingFieldRef.current = 'name'; }}
              onBlur={() => { editingFieldRef.current = null; if ((client.companyName || '') !== name) commit('companyName', name); }}
              variant="standard" placeholder="Company name"
              sx={{
                '& .MuiInputBase-input': { color: D.text, fontWeight: 800, fontSize: 22, p: 0 },
                '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
                '& .MuiInput-underline:hover:before': { borderBottomColor: `${D.line} !important` },
                '& .MuiInput-underline:after': { borderBottomColor: D.green },
              }}
              fullWidth
            />
            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              <StageChip stage={client.stage} glow />
              {/* Client reality: a business with ≥1 order OR a won deal is a
                  CLIENT, shown even if the stored stage hasn't caught up. Never
                  call an order-having / deal-winning company a Lead. */}
              {isCustomer && !isWonStage(client.stage) && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4,
                  px: 1, py: 0.3, borderRadius: 999, bgcolor: 'rgba(45,212,191,0.14)',
                  color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.4)',
                  fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>
                  <StarRateRoundedIcon sx={{ fontSize: 13 }} /> CLIENT
                </Box>
              )}
              <Typography sx={{ color: D.faint, fontSize: 12, ...mono }}>{client.companyKey}</Typography>
            </Stack>
            {client.stage === 'lost' && client.lostReason && (
              <Typography sx={{ color: '#fca5a5', fontSize: 12, mt: 0.75 }}>
                Lost: {client.lostReason}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexShrink={0}>
            {onOpenPortal && (
              <Button onClick={onOpenPortal}
                title={client.portalToken
                  ? 'Copy this company’s portal link (magic link — all their orders, no login)'
                  : 'Create + copy this company’s portal link (magic link — all their orders, no login)'}
                sx={{ color: D.green, border: `1px solid ${D.line}`, fontWeight: 700, textTransform: 'none',
                  borderRadius: 999, px: 2, '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.06)' } }}>
                Client portal
              </Button>
            )}
            {onRevokePortal && client.portalToken && (
              <Button onClick={onRevokePortal} title="Revoke the portal link — the URL stops working immediately"
                sx={{ minWidth: 0, px: 1.25, color: D.faint, border: `1px solid ${D.line}`, fontWeight: 700,
                  textTransform: 'none', borderRadius: 999, '&:hover': { color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' } }}>
                ✕
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
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2,
      }}>
        <Field label={savingField === 'stage' ? 'Stage · saving…' : 'Stage'}>
          <TextField select value={client.stage || 'lead'} onChange={(e) => commit('stage', e.target.value)}
            size="small" fullWidth sx={fieldSx}>
            {CRM_STAGES.map((s) => (
              <MenuItem key={s} value={s}
                disabled={isCustomer && client.stage !== s && PRE_CUSTOMER_STAGES.includes(s)}>
                {stageMeta(s).label}
              </MenuItem>
            ))}
          </TextField>
        </Field>
        <Field label={savingField === 'dealValue' ? 'Deal value · saving…' : 'Deal value'}>
          <TextField value={dealValue} onChange={(e) => setDealValue(e.target.value.replace(/[^\d.]/g, ''))}
            onFocus={() => { editingFieldRef.current = 'dealValue'; }}
            onBlur={() => {
              editingFieldRef.current = null;
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

      {/* Progress / level — the dopamine spine. Lights up as the deal climbs the
          funnel; a Customer/Won earns the full green bar + a celebratory banner. */}
      <ProgressCard stage={client.stage} isCustomer={isCustomer} />

      {/* Deals — this business's opportunities, each its own card. Winning a deal
          (its first) is what makes them a Client. Only rendered when the parent
          wires the deal actions (keeps the panel self-contained + testable). */}
      {onWinDeal && (
        <CompanyDealsPanel
          deals={deals}
          hasOrders={orders.length > 0}
          onNew={onNewDeal}
          onWin={onWinDeal}
          onLose={onLoseDeal}
          onReopen={onReopenDeal}
          onOpen={onOpenDeal}
          onEdit={onEditDeal}
          onRemove={onRemoveDeal}
          onStartJob={onStartJob}
          onSetStage={onSetDealStage}
        />
      )}

      {/* Outreach — cold-email sequences this company is (or was) in. Read-only
          here (the actions live in the Outreach tab); the per-send touches are
          already in the timeline below as 'email' entries. */}
      {(outreach.length > 0 || client.doNotEmail) && (
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: D.faint, mb: 1 }}>
            Outreach
          </Typography>
          {client.doNotEmail && (
            <Typography sx={{ color: '#f87171', fontSize: 12, fontWeight: 700, mb: outreach.length ? 1 : 0 }}>
              Do not email — they opted out; the engine will never email this company.
            </Typography>
          )}
          <Stack spacing={0.75}>
            {outreach.map((o) => {
              const m = enrollmentStatusMeta(o.status);
              return (
                <Stack key={String(o.enrollmentId)} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700 }}>{o.campaignName || 'Campaign'}</Typography>
                  <StatusChip meta={m} />
                  <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5 }}>
                    {o.sent}/{o.stepCount} sent{o.openCount ? ` · opened ×${o.openCount}` : ''}
                    {o.repliedAt ? ` · replied ${fmtRelative(o.repliedAt)}` : ''}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Business with this company — the money story: lifetime finance (reusing
          the same revenue/COGS/margin math as /api/finances) + linked POs. ONLY
          for a real customer (≥1 order) — a pure lead shouldn't show $0.00
          everywhere; we surface stage/follow-up/contacts/notes for them instead. */}
      {isCustomer && (finance || pos.length > 0) && (
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Eyebrow>Business with this company</Eyebrow>
            {finance && finance.orderCount > 0 && (
              <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>
                {finance.orderCount} order{finance.orderCount === 1 ? '' : 's'}
                {finance.paidCount ? ` · ${finance.paidCount} paid` : ''}
              </Typography>
            )}
          </Stack>

          {finance ? (
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: pos.length > 0 ? 2 : 0 }}>
              <Metric
                label="Revenue"
                value={fmt(finance.revenue)}
                accent={D.text}
                // The "open est." is the pipeline deal estimate (client.dealValue).
                // Once a company is fully collected — it has realized orders and
                // nothing outstanding — a lingering estimate is just stale noise
                // (the owner asked "where does the 5k open est come from?"), so hide
                // it. It still shows for genuine open pipeline (unpaid/early work).
                hint={
                  // When more than one collected order backs this number, say
                  // so — a company that "won one job" showing 2 collected
                  // orders is how a duplicate doc doubles revenue silently
                  // (run Duplicate cleanup / archive the twin if it's one job).
                  finance.paidCount > 1
                    ? `across ${finance.paidCount} collected orders`
                    : client.dealValue && !(finance.paidCount > 0 && finance.outstanding === 0)
                      ? `${fmtMoney0(client.dealValue)} open est.`
                      : null
                }
              />
              <Metric
                label="Profit"
                value={fmt(finance.profit)}
                accent={finance.profit < 0 ? '#f87171' : D.green}
                hint={financeCogsHint(finance)}
              />
              <Metric
                label="Margin"
                value={`${finance.margin}%`}
                accent={finance.margin < 0 ? '#f87171' : D.text}
              />
              <Metric
                label="Outstanding"
                value={fmt(finance.outstanding)}
                accent={finance.outstanding > 0 ? D.amber : D.faint}
                hint="invoiced · unpaid"
              />
            </Stack>
          ) : null}

          {pos.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography sx={{ color: D.faint, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Purchase orders
                </Typography>
                <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>{pos.length}</Typography>
              </Stack>
              <Box sx={{ mx: -1.25, '& > div:last-of-type': { borderBottom: 'none' } }}>
                {pos.map((p) => <PoRow key={p._id} p={p} onOpen={onOpenPo} onOpenVendor={onOpenVendor} />)}
              </Box>
            </Box>
          )}
        </Box>
      )}

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
            <Box>{log.map((e, i) => (
              <LogEntry
                key={e._id || i}
                entry={e}
                last={i === log.length - 1}
                onDelete={onDeleteLog ? () => onDeleteLog(logEntryId(e)) : undefined}
                onEdit={onEditLog ? (text) => onEditLog(logEntryId(e), text) : undefined}
              />
            ))}</Box>
          )}
        </Box>

        {/* Side column */}
        <Stack spacing={2}>
          <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
            <Eyebrow sx={{ mb: 1.5, display: 'block' }}>
              {savingField === 'contacts' ? 'Contacts · saving…' : 'Contacts'}
            </Eyebrow>
            <ContactsEditor
              contacts={client.contacts}
              companyKey={client.companyKey}
              onSave={(next) => commit('contacts', next)}
            />
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
            <Divider sx={{ borderColor: D.line, my: 1.5 }} />
            <Field label={savingField === 'address' ? 'Address · saving…' : 'Address'}>
              <TextField value={addressText} onChange={(e) => setAddressText(e.target.value)}
                onFocus={() => { editingFieldRef.current = 'address'; }}
                onBlur={() => { editingFieldRef.current = null; if ((client.address || '') !== addressText) commit('address', addressText); }}
                size="small" fullWidth sx={fieldSx} placeholder="e.g. 123 Main St, Newark NJ" />
            </Field>
          </Box>

          {/* Tags — add / remove, each change PATCHes the whole tags[] */}
          <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
            <TagEditor
              tags={client.tags}
              companyKey={client.companyKey}
              saving={savingField === 'tags'}
              onChange={(next) => commit('tags', next)}
            />
          </Box>

          {/* Orders — only for a real customer. A pure lead has no orders by
              definition; showing an empty "Orders" panel just adds $0 noise. */}
          {isCustomer && (
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
                  {orders.map((o) => <OrderRow key={o._id || o.projectNumber || o.orderNumber} o={o} onOpen={onOpenOrder} />)}
                </Box>
              )}
            </Box>
          )}

          {/* Design library — the company's whole visual footprint: its logo(s)
              and every mockup made for it, each deep-linked to the order it lives
              on. Shown for leads too (art often precedes the first order). Renders
              nothing until there's an asset. */}
          <DesignLibraryPanel designLibrary={designLibrary} onOpenOrder={onOpenOrder} />

          {/* Recurring plans — the per-client slice of the Webworks/Atom money
              layer. Add a plan / pause / resume / cancel; active MRR sums in the
              header. Shown for everyone (the first plan turns a print client into a
              subscription client). Only wired when the parent passes the handlers. */}
          {onAddSubscription && onSetSubStatus && (
            <SubscriptionsPanel
              subscriptions={subscriptions}
              onAdd={onAddSubscription}
              onSetStatus={onSetSubStatus}
            />
          )}

          {/* Lookbooks — this company's curated, shareable mockup galleries
              (the Lookbooks tab, prefiltered to this companyKey). Deliberately
              shown for LEADS too: sending a lookbook is a pitch move, not a
              customer-only feature. */}
          {onOpenLookbooks && (
            <Box onClick={onOpenLookbooks} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenLookbooks(); } }}
              sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2,
                display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer',
                transition: 'border-color 0.18s ease, background-color 0.18s ease',
                '&:hover': { borderColor: D.green, bgcolor: D.panelHi },
                '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: 2 } }}>
              <AutoStoriesOutlinedIcon sx={{ color: D.green, fontSize: 18 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Eyebrow>Lookbooks</Eyebrow>
                <Typography sx={{ color: D.muted, fontSize: 12, mt: 0.25 }}>
                  Curated mockup galleries for this client — open theirs or build one
                </Typography>
              </Box>
              <ChevronRightIcon sx={{ color: D.faint, fontSize: 18 }} />
            </Box>
          )}

          {/* Sticky internal notes — ALWAYS present + editable (not just when
              text already exists). Commits { notes } on blur, same PATCH path as
              every other field. */}
          <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
            <Eyebrow sx={{ mb: 1, display: 'block' }}>
              {savingField === 'notes' ? 'Notes · saving…' : 'Notes'}
            </Eyebrow>
            <TextField
              value={notesText} onChange={(e) => setNotesText(e.target.value)}
              onFocus={() => { editingFieldRef.current = 'notes'; }}
              onBlur={() => { editingFieldRef.current = null; if ((client.notes || '') !== notesText) commit('notes', notesText); }}
              multiline minRows={3} fullWidth size="small" sx={fieldSx}
              placeholder="Internal notes that follow this client…"
            />
          </Box>
        </Stack>
      </Box>

      {/* Archive this card — soft / reversible (recover from Companies → Archived).
          Archives IMMEDIATELY (no ugly browser confirm — owner's ask): the parent
          returns to the list and shows a few-second "Undo" toast that restores it.
          The record + its order links + history are all preserved; it just drops
          out of the working surfaces. */}
      {onArchive && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
          <Button
            onClick={onArchive}
            startIcon={<ArchiveOutlinedIcon sx={{ fontSize: 17 }} />}
            sx={{ textTransform: 'none', color: D.faint, fontWeight: 700, fontSize: 12.5,
              border: `1px solid ${D.line}`, borderRadius: 999, px: 2,
              '&:hover': { color: '#f87171', borderColor: 'rgba(248,113,113,0.4)', bgcolor: 'rgba(248,113,113,0.06)' } }}
          >
            Archive card
          </Button>
        </Box>
      )}

      <Box sx={{ height: 8 }} />
    </Stack>
  );
}
