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

// ── "Drop" tokens ─────────────────────────────────────────────────────────────
// The refined dark palette the client approval page (ApprovalView) is built on.
// Richer, deeper, more tactile than the base `B` set above — use these to bring
// the owner-side builders up to the same premium feel. Additive on purpose: `B`
// stays as-is so existing surfaces (OrderTracker, tabs) are untouched.
export const D = {
  bg:      '#0b1410',                 // dark canvas — lifted off pure black so panels read
  panel:   '#19241f',                 // elevated panel — a clear step above the canvas
  panelHi: '#22302a',                 // hover / selected panel
  inset:   '#141e19',                 // recessed (tables, totals, inputs) — still clearly visible
  line:    'rgba(255,255,255,0.15)',  // hairline — visible, defines every field & card edge
  lineHi:  'rgba(74,222,128,0.55)',   // active green border
  green:   '#4ade80',                 // lime accent
  greenDk: '#0e3b22',                 // deep green
  glow:    'rgba(74,222,128,0.22)',
  text:    '#f4f8f5',
  muted:   'rgba(255,255,255,0.72)',  // secondary text — readable, not a whisper
  faint:   'rgba(255,255,255,0.50)',  // tertiary / placeholders — still legible
  amber:   '#fbbf24',
  ink:     '#06140c',                 // dark text that rides on a green fill
};

// Accent gradient bar painted across the top of a header — the brand "glow".
export const accentBar = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 3,
  background: `linear-gradient(90deg, ${D.greenDk}, ${D.green}, ${D.greenDk})`,
};

// Section eyebrow: tiny uppercase green label that opens a block.
export const eyebrow = {
  fontSize: 11, fontWeight: 800, letterSpacing: 2,
  textTransform: 'uppercase', color: D.green,
};

// Tabular monospace for money / counts so figures line up column-to-column.
export const mono = {
  fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
};

// Inputs on the drop canvas: recessed fill, hairline border that warms on hover
// and turns green on focus. Spread over a TextField/Select `sx`.
export const dropInput = {
  '& .MuiOutlinedInput-root': {
    bgcolor: D.inset, color: D.text, borderRadius: 2,
    transition: 'border-color 0.18s ease, background-color 0.18s ease',
    '& fieldset': { borderColor: D.line, transition: 'border-color 0.18s ease' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
    '&.Mui-focused fieldset': { borderColor: D.green },
  },
  '& .MuiInputLabel-root': { color: D.muted },
  '& .MuiInputLabel-root.Mui-focused': { color: D.green },
  '& .MuiInputBase-input': { color: D.text },
  '& .MuiInputBase-input::placeholder': { color: D.faint, opacity: 1 },
  '& .MuiSelect-icon': { color: D.muted },
  input: { color: D.text },
};

// Primary action — green pill with a soft glow that lifts on hover.
export const dropPrimaryBtn = {
  bgcolor: D.green, color: D.ink, fontWeight: 800, textTransform: 'none',
  borderRadius: 999, boxShadow: `0 6px 18px ${D.glow}`,
  transition: 'transform 0.15s ease, box-shadow 0.2s ease, background-color 0.15s ease',
  '&:hover': { bgcolor: '#5cec8e', transform: 'translateY(-1px)', boxShadow: `0 10px 26px ${D.glow}` },
  '&.Mui-disabled': { bgcolor: 'rgba(74,222,128,0.25)', color: 'rgba(6,20,12,0.5)', boxShadow: 'none' },
};

// Quiet ghost action — hairline outline that warms on hover.
export const dropGhostBtn = {
  color: D.text, border: `1px solid ${D.line}`, fontWeight: 700, textTransform: 'none',
  borderRadius: 999, transition: 'border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease',
  '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' },
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

// Default sales-tax rates (percent) for the owner's territory. Choosing a state
// on a confirmation shipTo PRE-FILLS that location's taxRate; the owner can
// override per location. Keyed by USPS code. MUST match the backend
// models/Order.js STATE_TAX_RATES.
export const STATE_TAX_RATES = { NJ: 6.625, NY: 8, CT: 6.35, MA: 6.25, VT: 6, PA: 6 };

// Per-location sales tax for a multi-ship-to confirmation. ACTIVE only when at
// least one shipTo carries a taxRate > 0 — otherwise a no-op, so totals stay
// byte-identical to a single-location order. Each item's merchandise revenue
// (Σ qty×unitPrice) is allocated to a location PROPORTIONALLY by its share of
// the item's units (locationItemRevenue = itemRevenue × allocQty / itemTotalQty),
// summed into the location's taxable subtotal, then × taxRate%. Tax is on
// MERCHANDISE only (not the add-on customLines), the correct sales-tax base.
// MUST mirror the backend models/Order.js computeLocationTax exactly.
export function confLocationTax(conf) {
  const n = (v) => Number(v) || 0;
  const shipTos = (conf && Array.isArray(conf.shipTos)) ? conf.shipTos : [];
  const taxed = shipTos.filter((st) => st && n(st.taxRate) > 0);
  if (taxed.length === 0) return { active: false, total: 0, lines: [] };
  const items = (conf && Array.isArray(conf.items)) ? conf.items : [];
  const lines = taxed.map((st) => {
    const subtotal = items.reduce((sum, it) => {
      const itemRevenue = ((it && it.sizes) || []).reduce((ss, sz) => ss + n(sz.qty) * n(sz.unitPrice), 0);
      const itemQty = ((it && it.sizes) || []).reduce((q, sz) => q + n(sz.qty), 0);
      if (itemQty <= 0) return sum;
      const allocQty = ((it && it.allocations) || []).reduce((q, a) => q + (a && a.key === st.key ? n(a.qty) : 0), 0);
      return sum + itemRevenue * (allocQty / itemQty);
    }, 0);
    const rate = n(st.taxRate);
    return { label: `${st.label || st.name || 'Location'} tax - ${rate}%`, subtotal, rate, value: subtotal * rate / 100 };
  });
  return { active: true, total: lines.reduce((s, l) => s + l.value, 0), lines };
}

export function confRevenue(conf) {
  if (!conf || !Array.isArray(conf.items)) return 0;
  let rev = conf.items.reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0), 0);
  (conf.customLines || []).forEach((l) => {
    rev += l.isPercent ? rev * (Number(l.amount) || 0) / 100 : (Number(l.amount) || 0);
  });
  // Per-location sales tax (added last, like the grand total in the backend).
  // No-op unless a shipTo carries taxRate > 0, so single-location is unchanged.
  rev += confLocationTax(conf).total;
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
