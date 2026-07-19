// src/screens/studio/VendorsTab.js
//
// The Vendors (printers / suppliers) surface — the supplier side of the connected
// database, analogous to the CRM company card but for the people Joint Printing
// BUYS from. A searchable list of vendors → a detail card per vendor that ties
// together everything about that printer:
//   • their profile (contact / address / ship method / account # / blanks-provided
//     default) AND the editable per-vendor NEXT PO # (the owner-set start that
//     stops the app's auto-counter from colliding with his real Google-Docs run);
//   • every PO issued to them (with order link + grand total);
//   • every order/project they printed;
//   • every receipt/expense actually paid to them (the real money), with totals.
// All of it is internal cost data, so the whole surface lives behind the admin
// token (the backend routes are requireAdmin). Reuses the premium `D` palette so
// it reads as part of the same Studio family as the CRM cards.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, TextField, IconButton, Button, CircularProgress,
  InputAdornment, Switch, FormControlLabel, Tooltip, Radio, Chip, Divider, Collapse,
  Select, MenuItem, FormControl,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import axios from 'axios';
import config from '../../config.json';
import {
  D, mono, accentBar, scrollbar, dropInput, dropPrimaryBtn, fmt, fmtDate, fmtRelative, money0,
} from './_shared';
import { alertDialog, confirmDialog } from './_dialog';
import PriceBookEditor from './PriceBookEditor';
import { useContextMenu } from './ContextMenu';
import { buildVendorMenu, buildFallbackMenu } from './contextMenuActions';
import RebuildPrintersView from './RebuildPrintersView';

const base = `${config.backendUrl}/api`;
const fieldSx = { ...dropInput, '& .MuiInputBase-input': { color: D.text, fontSize: 13.5, py: 1 } };

// ── Vendor row in the list ────────────────────────────────────────────────────
// Carries the relationship numbers (real spend / POs / orders from the usage
// rollup the API attaches), so the list reads as a supplier ledger — who you
// actually pay and how much — not a bare contact rolodex.
function VendorRow({ v, onOpen, bindVendor }) {
  const details = [
    v.contactName,
    v.address,
    v.shipMethod,
  ].filter(Boolean).join(' · ');
  const st = v.stats || {};
  const hasActivity = (st.spend || 0) > 0 || (st.poCount || 0) > 0 || (st.orderCount || 0) > 0;
  return (
    <Box
      onClick={() => onOpen(v._id)}
      {...(bindVendor ? bindVendor(v) : {})}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(v._id); }}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: { xs: 1.5, sm: 1.75 },
        transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.18s ease',
        '&:hover': { borderColor: D.lineHi, bgcolor: D.panelHi, transform: 'translateY(-1px)' },
        '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: D.green, opacity: 0.7 },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          bgcolor: 'rgba(74,222,128,0.1)', color: D.green,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <StorefrontOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.name || 'Unnamed vendor'}
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {details || 'No details yet'}
          </Typography>
        </Box>
        {v.blanksProvided === false && (
          <Box sx={{ px: 1, py: 0.3, borderRadius: 999, bgcolor: 'rgba(251,191,36,0.14)', color: D.amber,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.3, border: '1px solid rgba(251,191,36,0.4)',
            display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}>
            BLANKS BY PRINTER
          </Box>
        )}
        {/* Relationship-at-a-glance: paid / POs / orders. Dimmed rolodex-only rows. */}
        {hasActivity ? (
          <Box sx={{ textAlign: 'right', flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ ...mono, color: D.green, fontSize: 13.5, fontWeight: 800, lineHeight: 1.2 }}>
              {money0(st.spend || 0)}
            </Typography>
            <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5, fontWeight: 700 }}>
              {[
                st.poCount ? `${st.poCount} PO${st.poCount === 1 ? '' : 's'}` : null,
                st.orderCount ? `${st.orderCount} order${st.orderCount === 1 ? '' : 's'}` : null,
              ].filter(Boolean).join(' · ') || 'paid'}
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5, fontWeight: 700, flexShrink: 0,
            display: { xs: 'none', sm: 'block' } }}>
            no activity yet
          </Typography>
        )}
        <ChevronRightIcon sx={{ color: D.faint, fontSize: 20, flexShrink: 0 }} />
      </Stack>
    </Box>
  );
}

// ── Duplicate-detection / merge (mirrors CRM CleanupView) ──────────────────────
// One member row inside a duplicate group, with a survivor radio.
function DupMemberRow({ m, selected, onSelect }) {
  return (
    <Box onClick={onSelect}
      sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, cursor: 'pointer',
        bgcolor: selected ? 'rgba(74,222,128,0.07)' : 'transparent',
        border: `1px solid ${selected ? D.lineHi : 'transparent'}`,
        '&:hover': { bgcolor: selected ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.03)' } }}>
      <Radio checked={selected} size="small" sx={{ color: D.faint, p: 0.5, '&.Mui-checked': { color: D.green } }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13.5 }}>{m.name}</Typography>
          {m.hasDetails && (
            <Chip label="has details" size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(45,212,191,0.12)', color: '#5eead4' }} />
          )}
        </Stack>
        <Typography sx={{ color: D.faint, fontSize: 11.5, ...mono, mt: 0.2 }}>
          {[
            m.poCount ? `${m.poCount} PO${m.poCount === 1 ? '' : 's'}` : null,
            m.spend ? money0(m.spend) : null,
            m.orderCount ? `${m.orderCount} order${m.orderCount === 1 ? '' : 's'}` : null,
            m.contactName || m.address || null,
          ].filter(Boolean).join(' · ') || 'no details yet'}
        </Typography>
      </Box>
      {selected && <Typography sx={{ color: D.green, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5 }}>SURVIVOR</Typography>}
    </Box>
  );
}

// One duplicate group: pick a survivor, Merge folds the others in (re-points POs +
// receipts + learning to the survivor on the backend), nothing lost.
function DupGroup({ group, onMerge }) {
  const [survivor, setSurvivor] = useState(group.suggestedSurvivor);
  const [busy, setBusy] = useState(false);
  const others = group.members.filter((m) => m._id !== survivor);

  const doMerge = async () => {
    setBusy(true);
    try {
      for (const m of others) {
        // eslint-disable-next-line no-await-in-loop
        await onMerge(survivor, m._id);
      }
    } catch (_) {
      // onMerge already surfaced the failure (the tab's alert pattern); stopping
      // here leaves the remaining records unmerged rather than ploughing on.
    } finally { setBusy(false); }
  };

  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 1.75 }}>
      <Stack spacing={0.5}>
        {group.members.map((m) => (
          <DupMemberRow key={m._id} m={m} selected={m._id === survivor} onSelect={() => setSurvivor(m._id)} />
        ))}
      </Stack>
      <Divider sx={{ borderColor: D.line, my: 1.25 }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
          Merges {others.length} other {others.length === 1 ? 'record' : 'records'} in. POs, receipts &amp; history are kept.
        </Typography>
        <Button onClick={doMerge} disabled={busy || others.length === 0} size="small"
          sx={{ ...dropPrimaryBtn, py: 0.5 }} startIcon={!busy ? <MergeTypeOutlinedIcon /> : null}>
          {busy ? <CircularProgress size={14} sx={{ color: D.ink }} /> : 'Merge'}
        </Button>
      </Stack>
    </Box>
  );
}

// Collapsible "duplicates found" banner above the vendor list. Hidden entirely
// when there are no duplicate groups, so a clean book shows nothing.
function DuplicatesPanel({ groups, onMerge }) {
  const [open, setOpen] = useState(false);
  if (!groups || groups.length === 0) return null;
  return (
    <Box sx={{ border: `1px solid rgba(74,222,128,0.4)`, borderRadius: 2.5, bgcolor: 'rgba(74,222,128,0.05)', overflow: 'hidden' }}>
      <Box onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setOpen((o) => !o); }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1.25, cursor: 'pointer' }}>
        <MergeTypeOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13.5 }}>
            {groups.length} possible duplicate {groups.length === 1 ? 'printer' : 'printers'}
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 11.5 }}>
            Same printer under two names (e.g. “Heritage” and “Heritage Screen Printing”). Merge to combine — nothing is lost.
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: D.faint, fontSize: 20, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s ease' }} />
      </Box>
      <Collapse in={open}>
        <Stack spacing={1.25} sx={{ px: 1.25, pb: 1.5, pt: 0.25 }}>
          {groups.map((g) => <DupGroup key={g.matchKey} group={g} onMerge={onMerge} />)}
        </Stack>
      </Collapse>
    </Box>
  );
}

// ── One-time "Rebuild printers from Drive" call-to-action ─────────────────────
// A prominent banner above the vendor list that opens the preview→confirm rebuild.
// Auto-hidden once the rebuild has been applied (status.applied) — like the other
// one-time tools — so it doesn't nag after the printers are loaded.
function RebuildBanner({ onOpen }) {
  return (
    <Box sx={{ border: `1px solid ${D.lineHi}`, borderRadius: 2.5, bgcolor: 'rgba(74,222,128,0.06)', p: 1.75 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <CloudSyncOutlinedIcon sx={{ color: D.green, fontSize: 26, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14 }}>Rebuild printers from your Drive</Typography>
          <Typography sx={{ color: D.muted, fontSize: 12.5, lineHeight: 1.5 }}>
            Load your real printers and their purchase orders from your Google&nbsp;Drive PO history, with the spend from
            your books. Preview first — nothing changes until you confirm, and it’s fully reversible.
          </Typography>
        </Box>
        <Button onClick={onOpen} sx={{ ...dropPrimaryBtn, px: 2.5, flexShrink: 0 }} startIcon={<CloudSyncOutlinedIcon />}>
          Preview rebuild
        </Button>
      </Stack>
    </Box>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────
function VendorsList({ vendors, loading, query, onQuery, onOpen, bindVendor, duplicates, onMerge, showRebuild, onRebuild }) {
  const list = useMemo(() => {
    // The TAB ranks by real money (spend, then PO volume, then name) — "who do
    // I actually pay" first. The server keeps its alphabetical order because the
    // same endpoint feeds the PO builder / finance vendor pickers.
    const ranked = [...vendors].sort((a, b) =>
      ((b.stats?.spend || 0) - (a.stats?.spend || 0))
      || ((b.stats?.poCount || 0) - (a.stats?.poCount || 0))
      || String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()));
    const t = query.trim().toLowerCase();
    if (!t) return ranked;
    return ranked.filter((v) => [v.name, v.contactName, v.email, v.address, v.shipMethod]
      .filter(Boolean).join(' ').toLowerCase().includes(t));
  }, [vendors, query]);

  return (
    <Stack spacing={2}>
      <TextField
        value={query} onChange={(e) => onQuery(e.target.value)}
        placeholder="Search printers / suppliers…" size="small" fullWidth sx={dropInput}
        InputProps={{ startAdornment: (
          <InputAdornment position="start"><SearchIcon sx={{ color: D.faint, fontSize: 20 }} /></InputAdornment>
        ) }}
      />
      {/* One-time "Rebuild printers from Drive" CTA — auto-hidden once applied. */}
      {!query && showRebuild && <RebuildBanner onOpen={onRebuild} />}
      {/* Duplicate-printer detection + one-tap merge (mirrors CRM cleanup). Only
          shows when the backend proposes groups; hidden on a clean book. */}
      {!query && <DuplicatesPanel groups={duplicates} onMerge={onMerge} />}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ color: D.faint, fontSize: 12, fontWeight: 700, ...mono }}>
          {loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'vendor' : 'vendors'} · by spend`}
        </Typography>
        {/* The one-time Drive rebuild's quiet re-entry button is gone by owner
            request — the importer already ran; the pre-apply banner above still
            covers a fresh database. */}
      </Stack>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: D.green }} /></Box>
      ) : list.length === 0 ? (
        <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 2.5, py: 6, textAlign: 'center', color: D.muted, bgcolor: D.inset }}>
          <StorefrontOutlinedIcon sx={{ fontSize: 30, color: D.faint, mb: 1 }} />
          <Typography sx={{ fontSize: 13 }}>
            {query ? 'No vendors match.' : 'No vendors yet — they’re remembered automatically the first time you build a PO or book a receipt to one.'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>{list.map((v) => <VendorRow key={v._id} v={v} onOpen={onOpen} bindVendor={bindVendor} />)}</Stack>
      )}
    </Stack>
  );
}

// A figure tile in the totals row — mirrors CompanyDetail's Metric.
function Metric({ label, value, accent, hint }) {
  return (
    <Box sx={{ flex: '1 1 120px', minWidth: 108, px: { xs: 1.25, sm: 1.5 }, py: 1.25, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
      <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ ...mono, color: accent || D.text, fontSize: { xs: 18, sm: 20 }, fontWeight: 800, lineHeight: 1.15, mt: 0.35 }}>{value}</Typography>
      {hint ? <Typography sx={{ ...mono, color: D.faint, fontSize: 10.5, fontWeight: 700, mt: 0.2 }}>{hint}</Typography> : null}
    </Box>
  );
}

const Eyebrow = ({ children, sx }) => (
  <Typography sx={{ color: D.green, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', ...sx }}>{children}</Typography>
);

// A clickable row that jumps to the linked order's project page. Used by both the
// PO and order lists on the vendor card. Clickable only when an order/project
// number is present (the PO/order row always carries one here) AND a navigator
// is wired; otherwise a plain row — no dead-end.
function rowOpenProps(target, onOpen) {
  const canOpen = !!onOpen && !!(target.projectNumber || target.orderNumber);
  if (!canOpen) return { boxSx: {}, handlers: {} };
  const go = () => onOpen({ orderNumber: target.orderNumber, projectNumber: target.projectNumber });
  return {
    boxSx: {
      cursor: 'pointer', transition: 'background-color 0.15s ease',
      '&:hover': { bgcolor: 'rgba(74,222,128,0.06)' },
      '&:focus-visible': { outline: `2px solid ${D.green}`, outlineOffset: -2 },
    },
    handlers: {
      onClick: go,
      role: 'button', tabIndex: 0,
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } },
      title: 'Open this order',
    },
  };
}

function PoRow({ p, onOpenOrder }) {
  const { boxSx, handlers } = rowOpenProps(p, onOpenOrder);
  return (
    <Box {...handlers} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1.1, px: 1.25, borderBottom: `1px solid ${D.line}`, ...boxSx }}>
      <DescriptionOutlinedIcon sx={{ fontSize: 18, color: D.faint, flexShrink: 0 }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13, ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.poNumber || 'PO'}
          {p.orderNumber ? <Box component="span" sx={{ color: D.faint, fontWeight: 600 }}> · order #{p.orderNumber}</Box> : null}
        </Typography>
        <Typography sx={{ color: D.faint, fontSize: 11.5 }}>{p.date ? fmtDate(p.date) : '—'}</Typography>
      </Box>
      <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13, ...mono, minWidth: 72, textAlign: 'right', flexShrink: 0 }}>{fmt(p.grandTotal)}</Typography>
    </Box>
  );
}

function OrderRow({ o, onOpenOrder }) {
  const { boxSx, handlers } = rowOpenProps(o, onOpenOrder);
  return (
    <Box {...handlers} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1.1, px: 1.25, borderBottom: `1px solid ${D.line}`, ...boxSx }}>
      <ReceiptLongOutlinedIcon sx={{ fontSize: 18, color: D.faint, flexShrink: 0 }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13, ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {o.projectNumber ? `#${o.projectNumber}` : `order #${o.orderNumber}`}
          {o.company ? <Box component="span" sx={{ color: D.faint, fontWeight: 600 }}> · {o.company}</Box> : null}
        </Typography>
        <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
          {[o.pos.map((p) => p.poNumber).filter(Boolean).join(', '), o.paid ? 'paid' : null].filter(Boolean).join(' · ') || '—'}
        </Typography>
      </Box>
      {/* What we actually PAID this printer for this order (from the receipts). */}
      <Typography sx={{ color: o.spend < 0 ? D.amber : D.text, fontWeight: 800, fontSize: 13, ...mono, minWidth: 72, textAlign: 'right', flexShrink: 0 }}>
        {fmt(o.spend)}
      </Typography>
    </Box>
  );
}

function TxnRow({ t, onOpenOrder }) {
  // A receipt/expense tagged to an order links to that order (link #6). Only when
  // it carries an order # AND a navigator — an untagged expense is a plain row.
  const canOpen = !!onOpenOrder && !!t.orderNumber;
  const go = canOpen ? () => onOpenOrder({ orderNumber: t.orderNumber }) : undefined;
  return (
    <Box
      onClick={go}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } : undefined}
      title={canOpen ? `Open order #${t.orderNumber}` : undefined}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 1.25, borderBottom: `1px solid ${D.line}`,
        cursor: canOpen ? 'pointer' : 'default', transition: 'background-color 0.15s ease',
        '&:hover': canOpen ? { bgcolor: 'rgba(74,222,128,0.06)' } : undefined }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ color: D.text, fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.description || t.category || 'Expense'}
        </Typography>
        <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>
          {[t.date ? fmtDate(t.date) : null, t.category, t.orderNumber ? `order #${t.orderNumber}` : null, t.hasReceipt ? 'receipt' : null].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <Typography sx={{ color: t.isCredit ? D.green : D.text, fontWeight: 800, fontSize: 12.5, ...mono, minWidth: 72, textAlign: 'right', flexShrink: 0 }}>
        {t.isCredit ? '+' : ''}{fmt(t.amount)}
      </Typography>
    </Box>
  );
}

// One editable inline profile field — text commits on blur, switch immediately.
function ProfileField({ label, value, onCommit, placeholder, saving }) {
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Eyebrow sx={{ mb: 0.6, display: 'block' }}>{label}{saving ? ' · saving…' : ''}</Eyebrow>
      <TextField value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((value || '') !== v) onCommit(v); }}
        size="small" fullWidth sx={fieldSx} placeholder={placeholder} />
    </Box>
  );
}

// The linked printer's PRICE BOOK, shown inside the vendor card. Linked → the
// editor (the same one that used to be the standalone "Printer Catalog" tab);
// unlinked → a one-tap picker that ties this supplier to its catalog printer by
// `printerKey` (best name match sorted first). One printer = one card.
function VendorPriceBook({ vendor, authHdr, onPatch }) {
  const linked = vendor.printerKey || '';
  const [printers, setPrinters] = useState(null);
  useEffect(() => {
    if (linked) return undefined;                 // only need the list to pick when unlinked
    let gone = false;
    axios.get(`${base}/printers`, authHdr)
      .then((r) => { if (!gone) setPrinters(r.data.printers || []); })
      .catch(() => { if (!gone) setPrinters([]); });
    return () => { gone = true; };
  }, [linked, authHdr]);

  const unlink = async () => {
    if (await confirmDialog({ title: 'Unlink the price book?', message: 'The price book itself is kept — this only detaches it from this supplier card.', confirmLabel: 'Unlink' })) {
      onPatch({ printerKey: '' });
    }
  };

  // Create a fresh catalog printer named after this supplier and link it — the
  // path for a newly-scanned price sheet (replaces the old tab's "Add printer").
  const createAndLink = async () => {
    try {
      const r = await axios.post(`${base}/printers`, { name: vendor.name }, authHdr);
      onPatch({ printerKey: r.data.printer.key });
    } catch (e) {
      alertDialog({ title: 'Couldn’t create the price book', message: e.response?.data?.message || e.message, danger: true });
    }
  };

  // Best name match to this vendor sorts first, so the right price book is one tap.
  const ranked = useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const v = norm(vendor.name);
    const match = (n) => (v && n && (n.includes(v) || v.includes(n)) ? 0 : 1);
    return [...(printers || [])].sort((a, b) =>
      match(norm(a.name)) - match(norm(b.name)) || String(a.name || '').localeCompare(String(b.name || '')));
  }, [printers, vendor.name]);

  if (linked) {
    return <PriceBookEditor pkey={linked} authHdr={authHdr} vendorState={vendor.state} onUnlink={unlink} />;
  }
  return (
    <Stack spacing={1}>
      <Typography sx={{ color: D.faint, fontSize: 12.5 }}>
        Link this supplier to its price book — then edit prices here and the Quoter routes to it.
      </Typography>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <FormControl size="small" sx={{ ...dropInput, minWidth: 240, maxWidth: 380 }}>
          <Select value="" displayEmpty onChange={(e) => e.target.value && onPatch({ printerKey: e.target.value })}
            sx={{ color: D.text, fontSize: 13 }}>
            <MenuItem value="" disabled>
              {printers === null ? 'Loading price books…' : ranked.length ? 'Link an existing price book…' : 'No price books yet'}
            </MenuItem>
            {ranked.map((pr) => (
              <MenuItem key={pr.key} value={pr.key}>{pr.name}{pr.state ? ` · ${pr.state}` : ''}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button size="small" onClick={createAndLink} startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', fontSize: 12, color: D.green, border: `1px solid ${D.line}`, borderRadius: 999, px: 1.5,
            '&:hover': { borderColor: D.green } }}>
          New price book
        </Button>
      </Stack>
    </Stack>
  );
}

// ── Detail card ───────────────────────────────────────────────────────────────
function VendorDetail({ data, loading, onBack, onPatch, savingField, authHdr, onOpenOrder }) {
  const vendor = data?.vendor || null;
  const pos = data?.pos || [];
  const orders = data?.orders || [];
  const transactions = data?.transactions || [];
  const totals = data?.totals || {};
  const nextPo = data?.nextPo || {};

  // Local copy for the next-PO-start input so typing doesn't fight the round-trip.
  const [startDraft, setStartDraft] = useState('');
  useEffect(() => { setStartDraft(nextPo.nextPoStart ? String(nextPo.nextPoStart) : ''); }, [vendor?._id, nextPo.nextPoStart]);

  if (loading || !vendor) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress sx={{ color: D.green }} /></Box>;
  }

  const commitStart = () => {
    const n = Math.max(0, parseInt(startDraft, 10) || 0);
    if (n !== (nextPo.nextPoStart || 0)) onPatch({ nextPoStart: n });
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Button onClick={onBack} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
          sx={{ textTransform: 'none', color: D.muted, fontWeight: 600, px: 0.5, mb: 1, '&:hover': { color: D.green, bgcolor: 'transparent' } }}>
          All vendors
        </Button>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, bgcolor: 'rgba(74,222,128,0.1)', color: D.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StorefrontOutlinedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 22, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {vendor.name || 'Unnamed vendor'}
              </Typography>
              <Typography sx={{ color: D.faint, fontSize: 12, ...mono, mt: 0.3 }}>
                {[totals.poCount ? `${totals.poCount} PO${totals.poCount === 1 ? '' : 's'}` : null,
                  totals.lastUsed ? `last used ${fmtRelative(totals.lastUsed)}` : null].filter(Boolean).join(' · ') || 'No POs yet'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexShrink={0}>
            {vendor.phone && (
              <Button component="a" href={`tel:${String(vendor.phone).replace(/[^\d+]/g, '')}`} startIcon={<PhoneInTalkIcon />} sx={{ ...dropPrimaryBtn, px: 2 }}>Call</Button>
            )}
            {vendor.email && (
              <Button component="a" href={`mailto:${vendor.email}`} startIcon={<MailOutlineIcon />}
                sx={{ color: D.text, border: `1px solid ${D.line}`, fontWeight: 700, textTransform: 'none', borderRadius: 999, px: 2,
                  '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.06)' } }}>Email</Button>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Lifetime totals — the printer's money story, all from real records. */}
      <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
        <Eyebrow sx={{ mb: 1.5, display: 'block' }}>Business with this printer</Eyebrow>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Metric label="Lifetime spend" value={fmt(totals.lifetimeSpend)} accent={D.green} hint="actual · from receipts" />
          <Metric label="PO total" value={money0(totals.poTotal)} hint={`${totals.poCount || 0} PO${totals.poCount === 1 ? '' : 's'}`} />
          <Metric label="Orders" value={String(totals.orderCount || 0)} hint="they printed" />
          <Metric label="Next PO #" value={nextPo.next || '—'} accent={D.text} hint={nextPo.nextPoStart ? `start set to ${nextPo.nextPoStart}` : 'auto'} />
        </Stack>
      </Box>

      {/* Editable profile + the per-vendor next-PO control (#1). */}
      <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
        <Eyebrow sx={{ mb: 1.5, display: 'block' }}>Printer details</Eyebrow>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <ProfileField label="Name" value={vendor.name} placeholder="Heritage Screen Printing" saving={savingField === 'name'} onCommit={(x) => onPatch({ name: x })} />
          <ProfileField label="Contact" value={vendor.contactName} placeholder="Jaide Thomas" saving={savingField === 'contactName'} onCommit={(x) => onPatch({ contactName: x })} />
          <ProfileField label="Email" value={vendor.email} placeholder="orders@heritage.com" saving={savingField === 'email'} onCommit={(x) => onPatch({ email: x })} />
          <ProfileField label="Phone" value={vendor.phone} placeholder="(215) 555-0123" saving={savingField === 'phone'} onCommit={(x) => onPatch({ phone: x })} />
          <ProfileField label="Address" value={vendor.address} placeholder="331 York Rd, Warminster, PA 18974" saving={savingField === 'address'} onCommit={(x) => onPatch({ address: x })} />
          <ProfileField label="Ship method" value={vendor.shipMethod} placeholder="UPS Acct # JR2257" saving={savingField === 'shipMethod'} onCommit={(x) => onPatch({ shipMethod: x })} />
          <ProfileField label="Account #" value={vendor.accountNumber} placeholder="Our account # with them" saving={savingField === 'accountNumber'} onCommit={(x) => onPatch({ accountNumber: x })} />
          <Box sx={{ minWidth: 0 }}>
            <Eyebrow sx={{ mb: 0.6, display: 'block' }}>Next PO # — start{savingField === 'nextPoStart' ? ' · saving…' : ''}</Eyebrow>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField value={startDraft} onChange={(e) => setStartDraft(e.target.value.replace(/[^\d]/g, ''))}
                onBlur={commitStart}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                size="small" fullWidth sx={fieldSx} placeholder="e.g. 9"
                InputProps={{ startAdornment: <InputAdornment position="start"><TagOutlinedIcon sx={{ fontSize: 15, color: D.faint }} /></InputAdornment> }} />
              <Tooltip title="The next auto-assigned PO will use this number (or higher if you’ve already passed it). Set it to continue your existing run.">
                <Box sx={{ ...mono, color: D.green, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>→ {nextPo.next || '—'}</Box>
              </Tooltip>
            </Stack>
          </Box>
        </Box>
        <FormControlLabel sx={{ mt: 1.5, ml: 0.5 }}
          control={<Switch size="small" checked={vendor.blanksProvided !== false}
            onChange={(e) => onPatch({ blanksProvided: e.target.checked })} />}
          label={<Typography sx={{ color: D.muted, fontSize: 12.5 }}>Blanks provided by Joint Printing (default for this printer’s POs)</Typography>} />
        <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 1, lineHeight: 1.5 }}>
          The app numbers each printer’s POs on its own sequence. If you already have POs for this printer elsewhere
          (e.g. a Google Doc up to #8), set the start to the next number (9) so the app continues your real run instead of colliding.
        </Typography>
      </Box>

      {/* Printer-network / geo-routing foundation — owner-filled. Nothing routes
          off these yet; this is the data the future "best printer nearest the
          client" engine will use (location, what they make, speed, quality). */}
      <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
        <Eyebrow sx={{ mb: 1.5, display: 'block' }}>Network &amp; routing</Eyebrow>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
          <ProfileField label="City" value={vendor.city} placeholder="Warminster" saving={savingField === 'city'} onCommit={(x) => onPatch({ city: x })} />
          <ProfileField label="State" value={vendor.state} placeholder="PA" saving={savingField === 'state'} onCommit={(x) => onPatch({ state: x.toUpperCase().slice(0, 2) })} />
          <ProfileField label="ZIP" value={vendor.zip} placeholder="18974" saving={savingField === 'zip'} onCommit={(x) => onPatch({ zip: x })} />
          <ProfileField label="Lead time (days)" value={vendor.leadTimeDays ? String(vendor.leadTimeDays) : ''} placeholder="e.g. 7" saving={savingField === 'leadTimeDays'} onCommit={(x) => onPatch({ leadTimeDays: parseInt(x, 10) || 0 })} />
          <ProfileField label="Quality (1–5)" value={vendor.qualityRating ? String(vendor.qualityRating) : ''} placeholder="e.g. 4" saving={savingField === 'qualityRating'} onCommit={(x) => onPatch({ qualityRating: Math.max(0, Math.min(5, parseInt(x, 10) || 0)) })} />
        </Box>
        <Box sx={{ mt: 1.5 }}>
          <ProfileField label="Capabilities (comma-separated)" value={(vendor.capabilities || []).join(', ')} placeholder="screen print, embroidery, DTG, promo, signage" saving={savingField === 'capabilities'} onCommit={(x) => onPatch({ capabilities: x.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </Box>
      </Box>

      {/* Price book — the printer's catalog the Quoter prices off, edited right
          here. Same printer, one card: identity + money above, prices below. */}
      <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
        <Eyebrow sx={{ mb: 1.5, display: 'block' }}>Price book — what the Quoter prices off</Eyebrow>
        <VendorPriceBook vendor={vendor} authHdr={authHdr} onPatch={onPatch} />
      </Box>

      {/* Connected records: orders → POs → receipts. The "full database" view. */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Eyebrow>Orders they printed</Eyebrow>
            <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>{orders.length}</Typography>
          </Stack>
          {orders.length === 0 ? (
            <Typography sx={{ color: D.faint, fontSize: 12.5, py: 1 }}>No connected orders yet.</Typography>
          ) : (
            <Box sx={{ mx: -1.25, '& > div:last-of-type': { borderBottom: 'none' } }}>{orders.map((o) => <OrderRow key={o.orderNumber} o={o} onOpenOrder={onOpenOrder} />)}</Box>
          )}
        </Box>
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Eyebrow>Purchase orders</Eyebrow>
            <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>{pos.length}</Typography>
          </Stack>
          {pos.length === 0 ? (
            <Typography sx={{ color: D.faint, fontSize: 12.5, py: 1 }}>No POs issued yet.</Typography>
          ) : (
            <Box sx={{ mx: -1.25, '& > div:last-of-type': { borderBottom: 'none' } }}>{pos.map((p) => <PoRow key={p._id} p={p} onOpenOrder={onOpenOrder} />)}</Box>
          )}
        </Box>
      </Box>

      {/* Money actually paid to this printer (the receipts/expense ledger). */}
      <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Eyebrow>Payments to this printer</Eyebrow>
          <Typography sx={{ color: D.faint, fontSize: 11, ...mono }}>{transactions.length}</Typography>
        </Stack>
        {transactions.length === 0 ? (
          <Typography sx={{ color: D.faint, fontSize: 12.5, py: 1 }}>
            No expenses booked to this printer yet. Booking a receipt with this vendor + an order # connects it here automatically.
          </Typography>
        ) : (
          <Box sx={{ mx: -1.25, '& > div:last-of-type': { borderBottom: 'none' } }}>{transactions.map((t) => <TxnRow key={t._id} t={t} onOpenOrder={onOpenOrder} />)}</Box>
        )}
      </Box>

      {vendor.notes && (
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
          <Eyebrow sx={{ mb: 1, display: 'block' }}>Notes</Eyebrow>
          <Typography sx={{ color: D.muted, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{vendor.notes}</Typography>
        </Box>
      )}
      <Box sx={{ height: 8 }} />
    </Stack>
  );
}

// ── Tab shell ─────────────────────────────────────────────────────────────────
export default function VendorsTab({ token, onBack, onNavigate, initialVendor }) {
  const authHdr = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [vendors, setVendors] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingField, setSavingField] = useState('');
  // "Rebuild printers from Drive" one-time tool. `rebuilding` opens the surface;
  // `rebuildStatus` tracks whether it has ever been applied, so the CTA banner
  // auto-hides afterward (like the CRM reconcile / finance restart tools).
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildStatus, setRebuildStatus] = useState(null); // { applied, lastBatchId }

  const loadRebuildStatus = useCallback(() => {
    axios.get(`${base}/orders/vendors/rebuild/status`, authHdr)
      .then((r) => setRebuildStatus(r.data || { applied: false }))
      .catch(() => setRebuildStatus({ applied: false }));
  }, [authHdr]);

  const loadDuplicates = useCallback(() => {
    axios.get(`${base}/orders/vendors/duplicates`, authHdr)
      .then((r) => setDuplicates(r.data.groups || []))
      .catch(() => setDuplicates([]));
  }, [authHdr]);

  const loadVendors = useCallback(() => {
    setLoading(true);
    axios.get(`${base}/orders/vendors`, authHdr)
      .then((r) => setVendors(r.data.vendors || []))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, [authHdr]);

  useEffect(() => { loadVendors(); loadDuplicates(); loadRebuildStatus(); }, [loadVendors, loadDuplicates, loadRebuildStatus]);

  // Merge one vendor into another (survivor, merged are ids). The backend folds
  // profile blanks + learned links and re-points POs/receipts to the survivor,
  // then soft-deletes the merged record. Refresh the list + duplicate groups after.
  const merge = useCallback(async (survivor, mergedId) => {
    try {
      await axios.post(`${base}/orders/vendors/merge`, { survivor, merged: mergedId }, authHdr);
      loadVendors();
      loadDuplicates();
    } catch (e) {
      // Surface the failure (the tab's existing alert pattern) and rethrow so a
      // multi-record merge STOPS at the failed record instead of ploughing on —
      // the group's Merge button re-enables and can be retried.
      alertDialog({ title: 'Merge failed', message: e.response?.data?.message || e.message, danger: true });
      throw e;
    }
  }, [authHdr, loadVendors, loadDuplicates]);

  const loadDetail = useCallback((id) => {
    setDetailLoading(true);
    axios.get(`${base}/orders/vendors/${id}`, authHdr)
      .then((r) => setDetail(r.data))
      .catch((e) => { alertDialog({ title: 'Couldn’t load vendor', message: e.response?.data?.message || e.message, danger: true }); setOpenId(null); })
      .finally(() => setDetailLoading(false));
  }, [authHdr]);

  useEffect(() => { if (openId) loadDetail(openId); else setDetail(null); }, [openId, loadDetail]);

  // ── Cross-tab deep link IN: open one vendor card ─────────────────────────────
  // A jump from a PO / order / supplier chip hands initialVendor { vendorId,
  // vendorName }. Prefer the id; otherwise resolve the name to a vendor by EXACT
  // case-insensitive name (the same match the PO builder uses) once the list is
  // loaded — only when it's unambiguous. If it can't be resolved (unknown/blank,
  // or two share the name), we don't guess: seed the search box so the owner
  // lands on the filtered directory (no crash, no dead-end). Re-keyed by nonce in
  // Studio so a fresh jump re-runs this.
  const vendorLinkDone = useRef(false);
  useEffect(() => {
    if (vendorLinkDone.current) return;
    const want = initialVendor || {};
    const id = want.vendorId ? String(want.vendorId) : '';
    const nm = want.vendorName ? String(want.vendorName).trim() : '';
    if (!id && !nm) { vendorLinkDone.current = true; return; }
    if (id) { vendorLinkDone.current = true; setOpenId(id); return; }
    // Name path: wait for the vendor list before resolving (the list is needed to
    // match a name → card). While it's still loading / not yet arrived we hold off
    // WITHOUT marking done, so the resolve runs once the vendors land. A genuinely
    // empty vendor DB has nothing to open anyway, so holding is harmless there.
    if (loading || vendors.length === 0) return;
    vendorLinkDone.current = true;
    const lower = nm.toLowerCase();
    const matches = vendors.filter((v) => (v.name || '').trim().toLowerCase() === lower);
    if (matches.length === 1) setOpenId(matches[0]._id);
    else setQuery(nm);   // unknown or ambiguous → filtered directory, owner picks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVendor, loading, vendors]);

  // PATCH a vendor field → refresh the card + keep the list name in sync.
  const patch = useCallback(async (body) => {
    if (!openId) return;
    const field = Object.keys(body)[0];
    setSavingField(field);
    try {
      const r = await axios.patch(`${base}/orders/vendors/${openId}`, body, authHdr);
      // Merge the patched vendor + new next-PO peek back into the detail payload.
      setDetail((prev) => prev ? { ...prev, vendor: r.data.vendor, nextPo: r.data.nextPo || prev.nextPo } : prev);
      setVendors((prev) => prev.map((v) => v._id === openId ? { ...v, ...r.data.vendor } : v));
    } catch (e) {
      alertDialog({ title: 'Save failed', message: e.response?.data?.message || e.message, danger: true });
    } finally {
      setSavingField('');
    }
  }, [openId, authHdr]);

  // ── Right-click menu wiring ───────────────────────────────────────────────
  const { bind: bindMenu, registerFallback } = useContextMenu();

  // bindVendor(vendor) → props a vendor row spreads onto its container. "Set next
  // PO #" opens the vendor card, where that editable field lives.
  const bindVendor = useCallback((v) => bindMenu(() => buildVendorMenu(v, {
    onOpen: (id) => setOpenId(id),
    onSetNextPo: (vend) => setOpenId(vend._id),
  })), [bindMenu]);

  // Right-click on empty Vendors chrome → back to the hub. (No global search on
  // this surface, so we offer the always-useful "Back to hub".)
  useEffect(() => registerFallback(() => buildFallbackMenu({
    onBackToHub: onBack,
  })), [registerFallback, onBack]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg, color: D.text }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 5, bgcolor: D.panel, borderBottom: `1px solid ${D.line}`,
        px: { xs: 1.5, md: 3 }, py: 1.35, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={accentBar} />
        <IconButton size="small" onClick={onBack} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <StorefrontOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15, flex: 1, letterSpacing: 0.2 }}>
          Vendors
          <Typography component="span" sx={{ color: D.muted, fontSize: 11.5, fontWeight: 500, ml: 1 }}>
            Printers &amp; suppliers
          </Typography>
        </Typography>
      </Box>

      <Box data-ctx-chrome sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 3 }, ...scrollbar }}>
        {rebuilding ? (
          <Stack spacing={2}>
            <Button onClick={() => setRebuilding(false)} startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 11 }} />} size="small"
              sx={{ textTransform: 'none', color: D.muted, fontWeight: 600, px: 0.5, alignSelf: 'flex-start', '&:hover': { color: D.green, bgcolor: 'transparent' } }}>
              All vendors
            </Button>
            <RebuildPrintersView
              token={token}
              onClose={() => setRebuilding(false)}
              // After a successful rebuild: refresh the list + duplicate groups + the
              // status (so the CTA banner auto-hides on return).
              onApplied={() => { loadVendors(); loadDuplicates(); loadRebuildStatus(); }}
            />
          </Stack>
        ) : openId ? (
          <VendorDetail data={detail} loading={detailLoading} savingField={savingField} authHdr={authHdr}
            onBack={() => setOpenId(null)} onPatch={patch}
            // A connected order/PO/receipt row jumps to that order's project page.
            onOpenOrder={onNavigate ? (t) => onNavigate({ view: 'clients', orderNumber: t.orderNumber, projectNumber: t.projectNumber }) : undefined} />
        ) : (
          <VendorsList vendors={vendors} loading={loading} query={query} onQuery={setQuery} onOpen={setOpenId} bindVendor={bindVendor}
            duplicates={duplicates} onMerge={merge}
            // Show the one-time rebuild CTA until it's been applied (auto-hide after).
            showRebuild={!(rebuildStatus && rebuildStatus.applied)} onRebuild={() => setRebuilding(true)} />
        )}
      </Box>
    </Box>
  );
}
