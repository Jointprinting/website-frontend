// src/screens/studio/_shared.js
// Constants, theme tokens, and small utilities shared across the Order Tracker
// surfaces (ClientHubTab, DashboardView, future Projects/People views).

export const B = {
  bg:      '#0c1410',
  panel:   '#162420',
  panelHi: '#1c2e28',
  border:  '#1a3d2b',
  green:   '#4ade80',
  greenDk: '#1a3d2b',
  white:   '#ffffff',
  muted:   'rgba(255,255,255,0.55)',
  faint:   'rgba(255,255,255,0.06)',
};

export const HEADER_H = 56;

export const STATUS_META = {
  quoted:        { label: 'Quoted',        color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  approved:      { label: 'Approved',      color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  placed:        { label: 'Placed',        color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  in_production: { label: 'In Production', color: '#f97316', bg: 'rgba(249,115,22,0.14)' },
  shipped:       { label: 'Shipped',       color: '#2dd4bf', bg: 'rgba(45,212,191,0.14)' },
  delivered:     { label: 'Delivered',     color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  cancelled:     { label: 'Cancelled',     color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
};
export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, ...m }));

export const DATE_LABEL = {
  quoted:        'Quoted',
  approved:      'Approved',
  placed:        'Placed',
  in_production: 'Started',
  shipped:       'Shipped',
  delivered:     'Delivered',
  cancelled:     'Date',
};

export const darkInput = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.04)', color: B.white,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: B.green },
    '&.Mui-focused fieldset': { borderColor: B.green },
  },
  '& .MuiInputLabel-root': { color: B.muted },
  '& .MuiInputLabel-root.Mui-focused': { color: B.green },
  '& .MuiInputBase-input': { color: B.white },
  '& .MuiSelect-icon': { color: B.muted },
  input: { color: B.white },
};

export const scrollbar = {
  '&::-webkit-scrollbar': { width: 5, bgcolor: 'transparent' },
  '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.10)', borderRadius: 3 },
};

export const fmt = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Confirmation-derived money ────────────────────────────────────────────────
// The confirmation page (the APPROVED doc) is the source of truth for an order's
// revenue + COGS — the quoter is just pre-approval options. Revenue = item size
// rows (qty × unitPrice) plus custom add-on lines (flat or %). COGS = each item's
// total qty × its internal unitCost (carried over from the quote, never shown to
// the client). Mirrors the backend _confirmationTotals — keep the two in sync.
export const hasConfirmation = (conf) =>
  !!(conf && Array.isArray(conf.items) && conf.items.length > 0);

export function confRevenue(conf) {
  if (!conf || !Array.isArray(conf.items)) return 0;
  let rev = conf.items.reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0), 0);
  (conf.customLines || []).forEach((l) => {
    rev += l.isPercent ? rev * (Number(l.amount) || 0) / 100 : (Number(l.amount) || 0);
  });
  return rev;
}

export function confCogs(conf) {
  if (!conf || !Array.isArray(conf.items)) return 0;
  return conf.items.reduce((s, it) => {
    const qty = (it.sizes || []).reduce((q, sz) => q + (Number(sz.qty) || 0), 0);
    return s + qty * (Number(it.unitCost) || 0);
  }, 0);
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export function fmtRelative(d) {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function emptyOrder(companyName = '', clientName = '') {
  return {
    orderNumber: '', clientName, companyName,
    status: 'placed', totalValue: '', cogs: '',
    printerName: '', notes: '', mockupNumbers: [],
    items: [], orderDate: '', shipDate: '', deliveredDate: '',
  };
}
