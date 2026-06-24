// src/screens/ConfirmationDocument.js
//
// THE shared confirmation document — the single source of truth for how a built
// confirmation renders to the client. Used in TWO places, byte-identically:
//   (a) the public client approval page (ApprovalView, the "Your order" stage)
//   (b) the owner's confirmation builder live-preview pane (ConfirmationBuilder)
// so the builder preview IS what the client sees — Nate's WYSIWYG ask. There is
// no longer a separate "Preview" path to drift out of sync.
//
// Hard rules:
//   • Client-safe ONLY. This component never references item.unitCost,
//     item.printerName, margin, or any internal money. The public API already
//     strips unitCost/printerName server-side (_safeConfirmation); this keeps
//     the render honest even if a future payload slips one through.
//   • Money math is the ONE canonical confirmation math (computeConfTotals /
//     confLocationTax below), mirroring backend models/Order.js
//     computeConfirmationTotals + computeLocationTax — same double-tax guard,
//     same roundCents, same per-location allocation clamp. Do not fork it.
//   • Image resolution is injected by the caller (`resolveItemImages`) so the
//     client page and the builder resolve the EXACT same source for an item —
//     fixing the old "name-referenced mockups break only on the client page"
//     bug (H1). Both callers must return the same array for the same item.

import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';

// ── Brand tokens (dark) — kept in lockstep with ApprovalView's T set. ─────────
export const DOC = {
  bg:       '#070b09',
  panel:    '#0e1613',
  panelHi:  '#13201a',
  inset:    '#0a110d',
  line:     'rgba(255,255,255,0.08)',
  lineHi:   'rgba(74,222,128,0.45)',
  green:    '#4ade80',
  greenDk:  '#0e3b22',
  glow:     'rgba(74,222,128,0.22)',
  text:     '#f3f7f4',
  muted:    'rgba(255,255,255,0.56)',
  faint:    'rgba(255,255,255,0.34)',
  amber:    '#fbbf24',
};

const card = { bgcolor: DOC.panel, border: `1px solid ${DOC.line}`, borderRadius: 3 };
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: DOC.green };
const mono = { fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };

export function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Round-half-up to cents — mirrors backend models/Order.js roundCents.
export const roundCents = (v) => Math.round(((Number(v) || 0) + Number.EPSILON) * 100) / 100;

// Is this add-on customLine a sales-tax line? Mirrors backend isTaxCustomLine.
export const isTaxCustomLine = (line) =>
  !!line && (line.isTax === true || /tax/i.test(String(line.label || '')));

// Per-location sales tax for a multi-ship-to confirmation. Mirrors backend
// models/Order.js computeLocationTax and studio/_shared.js confLocationTax:
// active only when a shipTo carries taxRate > 0; each item's merchandise revenue
// is allocated proportionally by its unit share (clamped to [0,1] of the item),
// summed, then × taxRate%, rounded to cents. Tax is on merchandise only.
export function confLocationTax(conf) {
  const n = (v) => Number(v) || 0;
  const shipTos = Array.isArray(conf?.shipTos) ? conf.shipTos : [];
  const taxed = shipTos.filter((st) => st && n(st.taxRate) > 0);
  if (taxed.length === 0) return { active: false, total: 0, lines: [] };
  const items = Array.isArray(conf?.items) ? conf.items : [];
  const lines = taxed.map((st) => {
    const subtotal = items.reduce((sum, it) => {
      const itemRevenue = (it.sizes || []).reduce((ss, sz) => ss + n(sz.qty) * n(sz.unitPrice), 0);
      const itemQty = (it.sizes || []).reduce((q, sz) => q + n(sz.qty), 0);
      if (itemQty <= 0) return sum;
      const allocQty = ((it && it.allocations) || []).reduce((q, a) => q + (a && a.key === st.key ? n(a.qty) : 0), 0);
      const share = allocQty <= 0 ? 0 : (allocQty >= itemQty ? 1 : allocQty / itemQty);
      return sum + itemRevenue * share;
    }, 0);
    const rate = n(st.taxRate);
    return { label: `${st.label || st.name || 'Location'} tax - ${rate}%`, key: st.key, value: roundCents(subtotal * rate / 100) };
  });
  return { active: true, total: roundCents(lines.reduce((s, l) => s + l.value, 0)), lines };
}

// Confirmation totals: percent custom-lines apply to the running subtotal, in
// order; then per-location sales tax is added last. With no taxed shipTos this
// is byte-identical to a plain order. A legacy tax customLine is dropped when
// per-location tax is active (double-tax guard); grand total snaps to cents.
// Mirrors models/Order.js computeConfirmationTotals exactly.
export function computeConfTotals(conf) {
  const items = Array.isArray(conf?.items) ? conf.items : [];
  const itemsSubtotal = items.reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0), 0);
  const locationTax = confLocationTax(conf);
  let running = itemsSubtotal;
  const lines = [];
  (conf?.customLines || []).forEach(l => {
    if (locationTax.active && isTaxCustomLine(l)) return;   // double-tax guard
    const isPct = !!l.isPercent;
    const amt = Number(l.amount) || 0;
    const value = isPct ? running * amt / 100 : amt;
    running += value;
    const base = l.label || (isPct ? 'Adjustment' : 'Add-on');
    lines.push({ label: isPct ? `${base} - ${amt}%` : base, value });
  });
  locationTax.lines.forEach(t => {
    running += t.value;
    lines.push({ label: t.label, value: t.value });
  });
  return { itemsSubtotal, lines, grandTotal: roundCents(running), locationTax };
}

function confItemTitle(it, idx) {
  const productLabel = it.productName || it.brandName || '';
  const head = productLabel && it.styleCode ? `${productLabel} (${it.styleCode})` : (productLabel || it.styleCode);
  return [head, it.color, it.printType].filter(Boolean).join(' · ') || `Item ${idx + 1}`;
}

function confItemShortName(it, idx) {
  return it.productName || it.brandName || it.styleCode || `Item ${idx + 1}`;
}

function allocQtyFor(it, key) {
  const a = (it.allocations || []).find(x => x && x.key === key);
  return a ? (Number(a.qty) || 0) : 0;
}

function itemTotalQty(it) {
  return (it.sizes || []).reduce((q, sz) => q + (Number(sz.qty) || 0), 0);
}

// A graceful image tile. If `src` is falsy OR the image fails to load, we show a
// neutral placeholder — never a broken-image icon (H1 / MED: lightbox never
// opens a broken image because onZoom is only wired when there's a live src).
function DocImg({ src, alt = '', onZoom, sx = {}, badge = true }) {
  const [broken, setBroken] = React.useState(false);
  const live = !!src && !broken;
  return (
    <Box
      sx={{
        position: 'relative', flexShrink: 0, cursor: live && onZoom ? 'zoom-in' : 'default',
        borderRadius: 'inherit', overflow: 'hidden', bgcolor: DOC.inset,
        display: 'flex', alignItems: 'center', justifyContent: 'center', ...sx,
        '&:hover .zoom-badge': { opacity: live ? 1 : 0 },
        '&:hover img.zimg': { transform: live ? 'scale(1.05)' : 'none' },
        '& img.zimg': { transition: 'transform 260ms ease' },
      }}
      onClick={(e) => { if (!live || !onZoom) return; e.stopPropagation(); onZoom(src); }}
      role={live && onZoom ? 'button' : undefined}
      tabIndex={live && onZoom ? 0 : undefined}
      aria-label={live && onZoom ? 'Enlarge image' : undefined}
      onKeyDown={(e) => { if (live && onZoom && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onZoom(src); } }}
    >
      {live ? (
        <Box component="img" className="zimg" src={src} alt={alt} loading="lazy"
          onError={() => setBroken(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'inherit', display: 'block' }} />
      ) : (
        <ImageNotSupportedOutlinedIcon sx={{ color: DOC.faint, fontSize: 30 }} />
      )}
      {badge && live && onZoom && (
        <Box className="zoom-badge" sx={{
          position: 'absolute', bottom: 6, right: 6, width: 24, height: 24, borderRadius: '50%',
          bgcolor: 'rgba(0,0,0,0.66)', color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', opacity: 0, transition: 'opacity 180ms ease', pointerEvents: 'none',
        }}>
          <ZoomInIcon sx={{ fontSize: 15 }} />
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmationDocument — the client-facing confirmation, rendered identically in
// the approval page and the builder preview.
//
// Props:
//   conf               the confirmation object (items, sizes, customLines, shipTos, allocations)
//   project            { companyName, clientName, orderNumber, orderDate, confirmationMessage, confirmationTerms }
//   logo               client logo data URL (optional)
//   resolveItemImages  (item) => string[]  — caller-supplied image resolver (MUST
//                      match between the two callers). Falsy entries degrade to a
//                      placeholder tile; the array may be empty.
//   onZoom             (src) => void  — opens the lightbox (optional; preview pane
//                      passes a no-op or omits it).
// ─────────────────────────────────────────────────────────────────────────────
export default function ConfirmationDocument({ conf, project = {}, logo, resolveItemImages, onZoom }) {
  const confItems = Array.isArray(conf?.items) ? conf.items : [];
  const totals = computeConfTotals(conf);
  const shipTos = Array.isArray(conf?.shipTos) ? conf.shipTos : [];
  const resolveImgs = typeof resolveItemImages === 'function' ? resolveItemImages : () => [];
  // Per-location tax keyed by shipTo so each location card can show its own line
  // (MED: the per-location tax is computed but was never shown on the card).
  const taxByKey = {};
  (totals.locationTax.lines || []).forEach(l => { if (l.key) taxByKey[l.key] = l; });

  return (
    <Box sx={{
      color: DOC.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header — branded lockup + client / invoice / date */}
      <Box sx={{ ...card, p: { xs: 2.5, md: 3.5 }, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${DOC.greenDk}, ${DOC.green}, ${DOC.greenDk})` }} />
        <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
          <Box component="img" src={`${process.env.PUBLIC_URL}/logo512.png`} alt="Joint Printing"
            sx={{ width: 46, height: 46, flexShrink: 0, objectFit: 'contain',
              filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.45))' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 17, letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1 }}>
              Joint Printing
            </Typography>
          </Box>
          {logo && (
            <Box sx={{ width: 48, height: 48, p: 0.5, bgcolor: '#fff', borderRadius: 1.5, display: 'flex',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              <Box component="img" src={logo} alt="" loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </Box>
          )}
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={1.5}
          sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${DOC.line}` }}>
          <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
            <Typography sx={{ ...eyebrow, color: DOC.faint, mb: 0.5 }}>Prepared for</Typography>
            {/* Long company / contact names wrap instead of overflowing (MED). */}
            <Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
              {project.companyName || project.clientName || conf?.orderTitle || 'Untitled'}
            </Typography>
            {project.clientName && project.companyName && project.clientName !== project.companyName && (
              <Typography sx={{ color: DOC.muted, fontSize: 13, mt: 0.2, overflowWrap: 'anywhere' }}>{project.clientName}</Typography>
            )}
          </Box>
          {(project.orderNumber || project.orderDate) && (
            <Stack direction="row" gap={3} sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>
              {project.orderNumber && (
                <Box>
                  <Typography sx={{ ...eyebrow, color: DOC.faint, mb: 0.5 }}>Invoice</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, ...mono }}>#{project.orderNumber}</Typography>
                </Box>
              )}
              {project.orderDate && (
                <Box>
                  <Typography sx={{ ...eyebrow, color: DOC.faint, mb: 0.5 }}>Date</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                    {new Date(project.orderDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </Box>

      {project.confirmationMessage && (
        <Box sx={{ ...card, mt: 2, p: 2, borderLeft: `3px solid ${DOC.green}` }}>
          <Typography sx={{ color: DOC.text, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {project.confirmationMessage}
          </Typography>
        </Box>
      )}

      {/* ── Your order ──────────────────────────────────────────────────────── */}
      <Box sx={{ ...card, p: { xs: 2.5, md: 3.5 }, mt: 2.5 }}>
        <Typography sx={{ ...eyebrow, mb: 2 }}>Your order</Typography>
        {confItems.length === 0 ? (
          <Typography sx={{ color: DOC.faint, fontSize: 13, fontStyle: 'italic' }}>No items yet.</Typography>
        ) : (
          <Stack gap={2}>
            {confItems.map((it, idx) => {
              const sizes = (it.sizes || []).filter(sz => Number(sz.qty) > 0);
              const itemSubtotal = sizes.reduce((s, sz) => s + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0);
              const imgs = resolveImgs(it) || [];
              return (
                <Box key={idx} sx={{ border: `1px solid ${DOC.line}`, borderRadius: 2.5, p: { xs: 2, md: 2.5 }, bgcolor: DOC.inset }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 2, sm: 2.5 }} alignItems="flex-start">
                    {imgs.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
                        {imgs.map((src, i) => (
                          <DocImg key={i} src={src} onZoom={onZoom}
                            sx={{ width: { xs: 120, sm: 140 }, height: { xs: 120, sm: 140 }, objectFit: 'cover', borderRadius: 2,
                              border: `1px solid ${DOC.line}`, bgcolor: DOC.panel,
                              transition: 'box-shadow 200ms ease, border-color 200ms ease',
                              '&:hover': { boxShadow: '0 8px 22px rgba(0,0,0,0.45)', borderColor: DOC.lineHi } }} />
                        ))}
                      </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 15.5, mb: 1.25, overflowWrap: 'anywhere' }}>{confItemTitle(it, idx)}</Typography>
                      {sizes.length > 0 && (
                        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                          <thead>
                            <tr>
                              {['Size', 'Qty', 'Unit price'].map((h, hi) => (
                                <th key={h} style={{ textAlign: hi === 0 ? 'left' : 'right', fontSize: 10, textTransform: 'uppercase',
                                  letterSpacing: '0.5px', color: 'rgba(255,255,255,0.5)', padding: '5px 8px', borderBottom: `1px solid ${DOC.line}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sizes.map((sz, i) => (
                              <tr key={i}>
                                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${DOC.line}`, color: DOC.text }}>{sz.label || '—'}</td>
                                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${DOC.line}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: DOC.text }}>{Number(sz.qty) || 0}</td>
                                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${DOC.line}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: DOC.text }}>{sz.unitPrice ? money(sz.unitPrice) : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Box>
                      )}
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2} sx={{ mt: 1.25 }}>
                        <Typography sx={{ ...eyebrow, color: DOC.faint }}>Item subtotal</Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, ...mono }}>{money(itemSubtotal)}</Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}

        {/* Shipping to multiple locations — only when the order is split */}
        {shipTos.length > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <Typography sx={{ ...eyebrow, mb: 1.5 }}>
              Shipping to {shipTos.length} locations
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              {shipTos.map((st, si) => {
                const rows = confItems
                  .map((it, ii) => ({ name: confItemShortName(it, ii), qty: allocQtyFor(it, st.key) }))
                  .filter(r => r.qty > 0);
                const tax = taxByKey[st.key];
                return (
                  <Box key={st.key || si} sx={{ border: `1px solid ${DOC.line}`, borderRadius: 2.5, p: { xs: 2, md: 2.25 }, bgcolor: DOC.inset }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 14, overflowWrap: 'anywhere' }}>
                      {st.label || st.name || `Location ${si + 1}`}
                    </Typography>
                    {(st.name && st.label) && (
                      <Typography sx={{ color: DOC.muted, fontSize: 12, mt: 0.2, overflowWrap: 'anywhere' }}>{st.name}</Typography>
                    )}
                    {(st.street || st.cityStateZip) && (
                      <Typography sx={{ color: DOC.muted, fontSize: 12, mt: 0.2, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                        {[st.street, st.cityStateZip].filter(Boolean).join(', ')}
                      </Typography>
                    )}
                    {rows.length > 0 && (
                      <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${DOC.line}` }}>
                        {rows.map((r, ri) => (
                          <Stack key={ri} direction="row" justifyContent="space-between" gap={2} sx={{ py: 0.4 }}>
                            <Typography sx={{ fontSize: 12.5, color: DOC.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 700, flexShrink: 0, ...mono }}>{r.qty}</Typography>
                          </Stack>
                        ))}
                      </Box>
                    )}
                    {tax && tax.value > 0 && (
                      <Stack direction="row" justifyContent="space-between" gap={2} sx={{ mt: 1, pt: 1, borderTop: `1px dashed ${DOC.line}` }}>
                        <Typography sx={{ fontSize: 11.5, color: DOC.muted }}>{tax.label}</Typography>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, flexShrink: 0, ...mono }}>{money(tax.value)}</Typography>
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </Box>
            {/* Unassigned units — never silently drop/dup a split (C2). For each
                item, units not assigned to any location surface here explicitly. */}
            <UnassignedUnits confItems={confItems} shipTos={shipTos} />
          </Box>
        )}

        {/* Totals — recessed panel, big green grand total. Subtotal row present
            so the client page, builder preview, and PDF all agree. */}
        <Box sx={{ mt: 2.5, p: { xs: 2, md: 2.5 }, borderRadius: 2.5, bgcolor: DOC.inset, border: `1px solid ${DOC.line}` }}>
          <Stack direction="row" justifyContent="space-between" gap={4} sx={{ fontSize: 13, mb: 0.85 }}>
            <Box sx={{ color: DOC.muted }}>Subtotal</Box>
            <Box sx={{ minWidth: 96, textAlign: 'right', ...mono }}>{money(totals.itemsSubtotal)}</Box>
          </Stack>
          {totals.lines.map((l, i) => (
            <Stack key={i} direction="row" justifyContent="space-between" gap={4} sx={{ fontSize: 13, mb: 0.85 }}>
              <Box sx={{ color: DOC.muted, overflowWrap: 'anywhere' }}>{l.label}</Box>
              <Box sx={{ minWidth: 96, textAlign: 'right', ...mono }}>{money(l.value)}</Box>
            </Stack>
          ))}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={4} sx={{ mt: 1.25, pt: 1.5, borderTop: `2px solid ${DOC.green}` }}>
            <Box sx={{ fontWeight: 800, fontSize: 17 }}>Total</Box>
            <Box sx={{ minWidth: 96, textAlign: 'right', fontWeight: 900, fontSize: 24, color: DOC.green, letterSpacing: -0.5, ...mono }}>{money(totals.grandTotal)}</Box>
          </Stack>
        </Box>

        {project.confirmationTerms && (
          <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${DOC.line}` }}>
            <Typography sx={{ ...eyebrow, color: DOC.faint, mb: 0.75 }}>Terms</Typography>
            <Typography sx={{ color: DOC.muted, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{project.confirmationTerms}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Explicit "Unassigned" rows for any item whose per-location allocations don't
// cover its full quantity — so units are never silently dropped or double-shown
// on the client page (C2). Over-allocation (allocations exceed qty) is flagged
// in amber rather than producing a negative count; the owner-side share guard
// blocks an over-allocated split from ever reaching the client, so this is the
// defensive display for already-saved data.
function UnassignedUnits({ confItems, shipTos }) {
  const keys = new Set((shipTos || []).map(s => s.key));
  const rows = confItems.map((it, idx) => {
    const total = itemTotalQty(it);
    const assigned = (it.allocations || [])
      .filter(a => a && keys.has(a.key))
      .reduce((s, a) => s + (Number(a.qty) || 0), 0);
    return { name: confItemShortName(it, idx), unassigned: total - assigned, over: assigned > total };
  }).filter(r => r.unassigned > 0 || r.over);
  if (rows.length === 0) return null;
  const anyOver = rows.some(r => r.over);
  return (
    <Box sx={{ mt: 1.5, border: `1px solid ${anyOver ? 'rgba(251,191,36,0.4)' : DOC.line}`, borderRadius: 2.5,
      p: { xs: 1.75, md: 2 }, bgcolor: anyOver ? 'rgba(251,191,36,0.06)' : DOC.inset }}>
      <Typography sx={{ ...eyebrow, color: anyOver ? DOC.amber : DOC.faint, mb: 0.75 }}>
        {anyOver ? 'Allocation needs attention' : 'Not yet assigned to a location'}
      </Typography>
      {rows.map((r, ri) => (
        <Stack key={ri} direction="row" justifyContent="space-between" gap={2} sx={{ py: 0.4 }}>
          <Typography sx={{ fontSize: 12.5, color: DOC.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
          {r.over ? (
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: DOC.amber, flexShrink: 0, ...mono }}>over-assigned</Typography>
          ) : (
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, flexShrink: 0, ...mono }}>{r.unassigned}</Typography>
          )}
        </Stack>
      ))}
    </Box>
  );
}
