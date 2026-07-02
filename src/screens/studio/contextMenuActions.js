// src/screens/studio/contextMenuActions.js
// The "genius" part of the right-click system: builders that turn a record + the
// surface's OWN handlers into a context-aware menu item list. Each surface calls
// the matching builder inside `ctx.bind(() => buildX(record, handlers))`, so the
// menu reuses the exact handlers that the buttons/rows already use (open dialog,
// navigate, PATCH, copy, tel:) — no business logic is duplicated here.
//
// Item shape (consumed by ContextMenu.js):
//   { label, icon?, onClick?, hint?, danger?, disabled?, items?[submenu], key? }
//   { divider: true }   |   { header: 'TEXT' }
//
// Conventions:
//   • Builders defensively read fields (a row may lack a phone/email/etc); an
//     action that can't apply is dropped or disabled, never a no-op crash.
//   • Reversible destructive items (archive) fire immediately and rely on an
//     "Undo" toast; only HARD-delete items keep a confirm() guard.
//   • Copy actions use copyToClipboard and flash a toast when a flasher is given.

import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import MoveUpOutlinedIcon from '@mui/icons-material/MoveUpOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import SearchIcon from '@mui/icons-material/Search';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

import { copyToClipboard } from './ContextMenu';
import { CRM_STAGES, PRE_CUSTOMER_STAGES, isClient, stageMeta, telHref, smsHref, primaryPhone } from './crm/_crm';
import { STATUS_OPTIONS, hasConfirmation } from './_shared';

// First usable email for a CRM record: its own, else the first contact with one.
function primaryEmail(rec) {
  if (rec && rec.email) return rec.email;
  const c = ((rec && rec.contacts) || []).find((x) => x && x.email);
  return c ? c.email : '';
}

// A copy action that flashes a confirmation toast (when `flash` is provided).
function copyItem({ label, value, flash, toastLabel, icon = ContentCopyOutlinedIcon, key }) {
  if (!value) return null;
  return {
    key: key || label,
    label,
    icon,
    onClick: async () => {
      const ok = await copyToClipboard(value);
      if (flash) flash(ok ? `${toastLabel || 'Copied'} copied` : 'Copy blocked by the browser', ok ? 'success' : 'error');
    },
  };
}

// ── CRM company ───────────────────────────────────────────────────────────────
// `c` is a company/client record (companyKey + name + stage + phone/email/tags +
// nextFollowUp + contacts). Handlers come straight from CrmTab.
//
// handlers = {
//   onOpen(companyKey),            // openCompany
//   onLog({companyKey,name,nextFollowUp}),       // openLog
//   onReschedule({companyKey,name,nextFollowUp}),// openResched
//   onSetStage(companyKey, stage, card),         // pipelineMoveStage (handles Lost prompt)
//   onAddTag(companyKey, currentTags),           // optional: prompt + patch tags
//   onArchive(companyKey),        // archiveOne
//   flash(msg, sev),              // toast
// }
export function buildCompanyMenu(c, handlers = {}) {
  if (!c) return [];
  const key = c.companyKey;
  if (!key) return [];
  // `name` covers list rows (companyName/clientName) and pipeline/calendar cards
  // (which carry a flattened `name`).
  const name = c.companyName || c.clientName || c.name || key;
  const phone = primaryPhone(c);
  const email = primaryEmail(c);
  // Only offer "Add tag" when the record actually carries its tags array. The
  // calendar payload omits tags (it's undefined there), and appending onto an
  // assumed-empty list would CLOBBER the record's real server-side tags — so we
  // hide the action on surfaces that don't carry the full tag set.
  const hasTags = Array.isArray(c.tags);
  const tags = hasTags ? c.tags : [];
  const target = { companyKey: key, name, nextFollowUp: c.nextFollowUp };

  const items = [
    { header: name },
    handlers.onOpen && { key: 'open', label: 'Open company', icon: OpenInNewOutlinedIcon, onClick: () => handlers.onOpen(key) },
    phone && {
      key: 'call', label: `Call ${phone}`, icon: PhoneInTalkIcon, hint: 'tel',
      onClick: () => { const href = telHref(phone); if (href) window.location.href = href; },
    },
    phone && {
      key: 'text', label: 'Text', icon: SmsOutlinedIcon, hint: 'sms',
      onClick: () => { const href = smsHref(phone); if (href) window.location.href = href; },
    },
    email && {
      key: 'email', label: 'Email', icon: MailOutlineIcon, hint: 'mail',
      onClick: () => { window.location.href = `mailto:${email}`; },
    },
    handlers.onLog && { key: 'log', label: 'Log a touch', icon: EditNoteOutlinedIcon, onClick: () => handlers.onLog(target) },
    handlers.onReschedule && { key: 'resched', label: 'Reschedule follow-up', icon: EventRepeatOutlinedIcon, onClick: () => handlers.onReschedule(target) },
    handlers.onSetStage && {
      key: 'stage', label: 'Set stage', icon: MoveUpOutlinedIcon,
      items: CRM_STAGES.map((s) => ({
        key: `stage-${s}`,
        label: stageMeta(s).label,
        icon: StageDot(stageMeta(s).color),
        // A real customer can't be demoted to a pre-customer funnel stage.
        disabled: c.stage === s || (isClient(c) && PRE_CUSTOMER_STAGES.includes(s)),
        onClick: () => handlers.onSetStage(key, s, { name }),
      })),
    },
    (handlers.onAddTag && hasTags) && { key: 'tag', label: 'Add tag…', icon: LocalOfferOutlinedIcon, onClick: () => handlers.onAddTag(key, tags) },
    { divider: true },
    copyItem({ key: 'copy-phone', label: 'Copy phone', value: phone, flash: handlers.flash, toastLabel: 'Phone', icon: ContentCopyOutlinedIcon }),
    copyItem({ key: 'copy-email', label: 'Copy email', value: email, flash: handlers.flash, toastLabel: 'Email', icon: MailOutlineIcon }),
    copyItem({ key: 'copy-name', label: 'Copy name', value: name, flash: handlers.flash, toastLabel: 'Name', icon: ContentCopyOutlinedIcon }),
    handlers.onArchive && { divider: true },
    handlers.onArchive && {
      // Archives immediately — no native confirm. The handler shows a few-second
      // "Undo" toast that restores the card, so there's nothing to confirm.
      key: 'archive', label: 'Archive', icon: ArchiveOutlinedIcon, danger: true,
      onClick: () => handlers.onArchive(key),
    },
  ];
  return items;
}

// A tiny colored dot used as a stage submenu "icon" — returns an icon-shaped
// component so it slots into the menu's icon column.
function StageDot(color) {
  const Dot = () => (
    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: color }} />
  );
  return Dot;
}

// ── Order / project ───────────────────────────────────────────────────────────
// `p` is a project/order. handlers from OrderTracker's drawer wiring.
//
// handlers = {
//   onOpen(project),            // setActiveProject
//   onOpenQuote(project),       // setQuote
//   onOpenConfirmation(project),// setConfirmation
//   onOpenPos(project),         // open PO list (drawer sets poOpen) — optional
//   onSetStatus(project, status), // saveField('status', …) equivalent — optional
//   flash,
// }
export function buildOrderMenu(p, handlers = {}) {
  if (!p) return [];
  const num = p.orderNumber || (p.projectNumber != null ? `#${p.projectNumber}` : '');
  const title = p.companyName || p.clientName || (num ? `Order ${num}` : 'Order');
  const hasQuote = (p.quoteLines || []).length > 0 || !!p.quote;
  const confirmed = hasConfirmation(p.confirmation);

  const items = [
    { header: title },
    handlers.onOpen && { key: 'open', label: 'Open order', icon: OpenInNewOutlinedIcon, onClick: () => handlers.onOpen(p) },
    handlers.onOpenQuote && {
      key: 'quote', label: hasQuote ? 'Open quote' : 'Start quote', icon: RequestQuoteOutlinedIcon,
      onClick: () => handlers.onOpenQuote(p),
    },
    handlers.onOpenConfirmation && {
      key: 'conf', label: confirmed ? 'Open confirmation' : 'Build confirmation', icon: FactCheckOutlinedIcon,
      onClick: () => handlers.onOpenConfirmation(p),
    },
    handlers.onOpenPos && { key: 'pos', label: 'Open POs', icon: DescriptionOutlinedIcon, onClick: () => handlers.onOpenPos(p) },
    handlers.onSetStatus && {
      key: 'status', label: 'Set status', icon: MoveUpOutlinedIcon,
      items: STATUS_OPTIONS.map((s) => ({
        key: `status-${s.value}`,
        label: s.label,
        icon: StageDot(s.color),
        disabled: p.status === s.value,
        onClick: () => handlers.onSetStatus(p, s.value),
      })),
    },
    { divider: true },
    copyItem({ key: 'copy-order', label: 'Copy order #', value: num, flash: handlers.flash, toastLabel: 'Order #', icon: ContentCopyOutlinedIcon }),
    copyItem({ key: 'copy-client', label: 'Copy client name', value: (p.companyName || p.clientName || ''), flash: handlers.flash, toastLabel: 'Client', icon: ContentCopyOutlinedIcon }),
  ];
  return items;
}

// ── Purchase order ────────────────────────────────────────────────────────────
// handlers = { onOpen(po), onDownload(po), flash }
export function buildPoMenu(po, handlers = {}) {
  if (!po) return [];
  const num = po.poNumber || 'PO';
  const items = [
    { header: `${num}${po.vendorName ? ` · ${po.vendorName}` : ''}` },
    handlers.onOpen && { key: 'open', label: 'Open PO', icon: OpenInNewOutlinedIcon, onClick: () => handlers.onOpen(po) },
    handlers.onDownload && { key: 'pdf', label: 'Download PDF', icon: LaunchOutlinedIcon, onClick: () => handlers.onDownload(po) },
    (po.poNumber) && { divider: true },
    copyItem({ key: 'copy-po', label: 'Copy PO #', value: po.poNumber, flash: handlers.flash, toastLabel: 'PO #', icon: ContentCopyOutlinedIcon }),
  ];
  return items;
}

// ── Vendor / printer ──────────────────────────────────────────────────────────
// `v` is a vendor record. handlers from VendorsTab.
//
// handlers = {
//   onOpen(vendorId),     // setOpenId
//   onCall(vendor), onEmail(vendor),   // optional (tel:/mailto: are built here)
//   onSetNextPo(vendor),  // open the vendor card focused on Next-PO# — optional
//   flash,
// }
export function buildVendorMenu(v, handlers = {}) {
  if (!v) return [];
  const id = v._id;
  const name = v.name || 'Vendor';
  const phone = v.phone;
  const email = v.email;
  const contactBlock = [v.name, v.contactName, v.phone, v.email, v.address]
    .filter(Boolean).join('\n');

  const items = [
    { header: name },
    (handlers.onOpen && id) && { key: 'open', label: 'Open vendor card', icon: StorefrontOutlinedIcon, onClick: () => handlers.onOpen(id) },
    phone && {
      key: 'call', label: `Call ${phone}`, icon: PhoneInTalkIcon, hint: 'tel',
      onClick: () => { const href = telHref(phone); if (href) window.location.href = href; },
    },
    phone && {
      key: 'text', label: 'Text', icon: SmsOutlinedIcon, hint: 'sms',
      onClick: () => { const href = smsHref(phone); if (href) window.location.href = href; },
    },
    email && {
      key: 'email', label: 'Email vendor', icon: MailOutlineIcon,
      onClick: () => { window.location.href = `mailto:${email}`; },
    },
    (handlers.onSetNextPo && id) && { key: 'nextpo', label: 'Set next PO #', icon: TagOutlinedIcon, onClick: () => handlers.onSetNextPo(v) },
    (phone || email || contactBlock) && { divider: true },
    copyItem({ key: 'copy-contact', label: 'Copy contact', value: contactBlock, flash: handlers.flash, toastLabel: 'Contact', icon: ContentCopyOutlinedIcon }),
    copyItem({ key: 'copy-phone', label: 'Copy phone', value: phone, flash: handlers.flash, toastLabel: 'Phone', icon: ContentCopyOutlinedIcon }),
    copyItem({ key: 'copy-email', label: 'Copy email', value: email, flash: handlers.flash, toastLabel: 'Email', icon: MailOutlineIcon }),
  ];
  return items;
}

// ── Finance transaction ───────────────────────────────────────────────────────
// `t` is a transaction. handlers from FinancesTab.
//
// handlers = {
//   onEdit(txn),     // setEditTxn
//   onDelete(txn),   // delete (confirm handled here so we don't depend on dialog)
//   flash,
// }
export function buildTransactionMenu(t, handlers = {}) {
  if (!t) return [];
  const amount = t.amount != null ? String(t.amount) : '';
  const label = t.party || t.description || t.category || 'Transaction';
  const items = [
    { header: label },
    handlers.onEdit && { key: 'edit', label: 'Edit transaction', icon: EditOutlinedIcon, onClick: () => handlers.onEdit(t) },
    // Deep links — only wired by the surface when the order # / client actually
    // resolve to a navigable target (so we never offer a dead jump).
    handlers.onOpenOrder && { key: 'open-order', label: `Open order #${t.orderNumber}`, icon: OpenInNewOutlinedIcon, onClick: () => handlers.onOpenOrder(t) },
    handlers.onOpenClient && { key: 'open-client', label: 'Open client card', icon: PersonOutlineIcon, onClick: () => handlers.onOpenClient(t) },
    handlers.onOpenVendor && { key: 'open-vendor', label: 'Open vendor card', icon: StorefrontOutlinedIcon, onClick: () => handlers.onOpenVendor(t) },
    t.receiptUrl && {
      key: 'receipt', label: 'View receipt', icon: ReceiptLongOutlinedIcon,
      onClick: () => { window.open(t.receiptUrl, '_blank', 'noopener,noreferrer'); },
    },
    amount && { divider: true },
    copyItem({ key: 'copy-amount', label: 'Copy amount', value: amount, flash: handlers.flash, toastLabel: 'Amount', icon: ContentCopyOutlinedIcon }),
    t.orderNumber && copyItem({ key: 'copy-order', label: 'Copy order #', value: t.orderNumber, flash: handlers.flash, toastLabel: 'Order #', icon: ContentCopyOutlinedIcon }),
    handlers.onDelete && { divider: true },
    handlers.onDelete && {
      key: 'delete', label: 'Delete transaction', icon: DeleteOutlineIcon, danger: true,
      onClick: () => { if (window.confirm('Delete this transaction? This cannot be undone.')) handlers.onDelete(t); },
    },
  ];
  return items;
}

// ── Global fallback (empty app chrome) ────────────────────────────────────────
// A couple of always-useful niceties so a right-click on empty Studio chrome
// does something instead of nothing. Never registered over text/inputs.
//
// handlers = { onSearch(), onNew(), newLabel?, onBackToHub(), searchLabel?, searchHint? }
export function buildFallbackMenu(handlers = {}) {
  const items = [
    { header: 'Studio' },
    handlers.onSearch && { key: 'search', label: handlers.searchLabel || 'Global search', icon: SearchIcon, hint: handlers.searchHint || '⌘K', onClick: () => handlers.onSearch() },
    // The surface's primary create action (e.g. "Add company" / "Add transaction"),
    // so a right-click on empty chrome can start new work, not just navigate.
    handlers.onNew && { key: 'new', label: handlers.newLabel || 'Add new', icon: AddCircleOutlineIcon, onClick: () => handlers.onNew() },
    (handlers.onSearch || handlers.onNew) && handlers.onBackToHub && { divider: true },
    handlers.onBackToHub && { key: 'hub', label: 'Back to hub', icon: HomeOutlinedIcon, onClick: () => handlers.onBackToHub() },
  ];
  return items;
}

const builders = {
  buildCompanyMenu, buildOrderMenu, buildPoMenu, buildVendorMenu, buildTransactionMenu, buildFallbackMenu,
};
export default builders;
