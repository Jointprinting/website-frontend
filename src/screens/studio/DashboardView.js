// src/screens/studio/DashboardView.js
// Single-roundtrip dashboard home for the Order Tracker.
// Section order: Action Queue → KPIs → Recent Activity → Top Clients.
import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, Paper, CircularProgress, Button, Chip, Divider,
} from '@mui/material';
import RefreshIcon            from '@mui/icons-material/Refresh';
import OpenInNewIcon          from '@mui/icons-material/OpenInNew';
import MarkEmailUnreadIcon    from '@mui/icons-material/MarkEmailUnread';
import HourglassEmptyIcon     from '@mui/icons-material/HourglassEmpty';
import ImageNotSupportedIcon  from '@mui/icons-material/ImageNotSupported';
import LocalShippingIcon      from '@mui/icons-material/LocalShipping';
import WarningAmberIcon       from '@mui/icons-material/WarningAmber';
import config from '../../config.json';
import { B, scrollbar, fmt, fmtRelative, STATUS_META } from './_shared';

const URGENT = '#ef4444';
const WARN   = '#fbbf24';
const INFO   = '#60a5fa';

// ─── KPI tile ────────────────────────────────────────────────────────────────
function KpiTile({ label, value, hint }) {
  return (
    <Paper elevation={0} sx={{
      bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2,
      px: 2, py: 1.5, minWidth: 160, flex: 1,
    }}>
      <Typography sx={{ fontSize: 11, color: B.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: B.white, mt: 0.5, lineHeight: 1.1 }}>
        {value}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: 11, color: B.muted, mt: 0.5 }}>{hint}</Typography>
      )}
    </Paper>
  );
}

// ─── Action queue group ──────────────────────────────────────────────────────
function ActionGroup({ icon, color, title, items, empty, renderItem }) {
  if (!items || items.length === 0) {
    return (
      <Paper elevation={0} sx={{
        bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: 2,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ color: B.white, fontWeight: 600 }}>{title}</Typography>
          <Chip size="small" label="0"
            sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.06)', color: B.muted, fontWeight: 600 }} />
        </Stack>
        <Typography sx={{ color: B.muted, fontSize: 13 }}>{empty}</Typography>
      </Paper>
    );
  }
  return (
    <Paper elevation={0} sx={{
      bgcolor: B.panel, border: `1px solid ${color}33`, borderRadius: 2, overflow: 'hidden',
    }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{
        px: 2, py: 1.25, borderBottom: `1px solid ${B.border}`, bgcolor: `${color}0a`,
      }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Typography sx={{ color: B.white, fontWeight: 600 }}>{title}</Typography>
        <Chip size="small" label={items.length}
          sx={{ ml: 'auto', bgcolor: `${color}22`, color, fontWeight: 700 }} />
      </Stack>
      <Stack divider={<Divider sx={{ borderColor: B.border }} />}>
        {items.map((it, i) => (
          <Box key={it._id || i} sx={{ px: 2, py: 1.25 }}>
            {renderItem(it)}
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

function Row({ left, right }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{left}</Box>
      <Box sx={{ color: B.muted, fontSize: 12, whiteSpace: 'nowrap' }}>{right}</Box>
    </Stack>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function DashboardView({ token, onOpenClient }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const base = `${config.backendUrl}/api`;

  const [data, setData]       = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshedAt, setRefreshedAt] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${base}/orders/dashboard`, authHdr);
      setData(r.data);
      setRefreshedAt(new Date());
    } catch (_) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authHdr, base]);

  React.useEffect(() => { load(); }, [load]);

  const openOrderClient = React.useCallback((order) => {
    if (!onOpenClient) return;
    const name = order.companyName || order.clientName || '';
    if (name) onOpenClient(name);
  }, [onOpenClient]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <CircularProgress size={32} sx={{ color: B.green }} />
      </Box>
    );
  }
  if (!data) {
    return (
      <Box sx={{ p: 4, color: B.muted }}>
        <Typography>Could not load dashboard. </Typography>
        <Button onClick={load} sx={{ mt: 1, color: B.green }}>Retry</Button>
      </Box>
    );
  }

  const aq = data.actionQueue || {};
  const k  = data.kpis        || {};

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 3, ...scrollbar }}>
      {/* Header */}
      <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ color: B.white, fontWeight: 700, letterSpacing: 0.3 }}>
          DASHBOARD
        </Typography>
        <Typography sx={{ color: B.muted, fontSize: 13 }}>
          {refreshedAt ? `Updated ${fmtRelative(refreshedAt)}` : ''}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small" startIcon={<RefreshIcon />} onClick={load}
          sx={{ color: B.muted, '&:hover': { color: B.green, bgcolor: 'transparent' } }}
        >
          Refresh
        </Button>
      </Stack>

      {/* Action queue */}
      <Typography sx={{ color: B.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, mb: 1.5 }}>
        NEEDS ATTENTION
      </Typography>
      <Box sx={{
        display: 'grid', gap: 2, mb: 4,
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
      }}>
        <ActionGroup
          icon={<MarkEmailUnreadIcon fontSize="small" />} color={INFO}
          title={`New inquiries${aq.newInquiriesTotal > aq.newInquiries?.length ? ` (showing ${aq.newInquiries?.length} of ${aq.newInquiriesTotal})` : ''}`}
          items={aq.newInquiries || []}
          empty="No new inquiries."
          renderItem={(it) => (
            <Row
              left={
                <Stack>
                  <Typography sx={{ color: B.white, fontSize: 14 }}>
                    {it.name || '—'}{it.companyName ? ` · ${it.companyName}` : ''}
                  </Typography>
                  <Typography sx={{ color: B.muted, fontSize: 12 }}>{it.email}</Typography>
                </Stack>
              }
              right={fmtRelative(it.createdAt)}
            />
          )}
        />
        <ActionGroup
          icon={<HourglassEmptyIcon fontSize="small" />} color={WARN}
          title="Stale quotes (>7 days, no mockup)"
          items={aq.staleQuotes || []}
          empty="No stale quotes."
          renderItem={(it) => (
            <Row
              left={
                <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                  <Typography
                    onClick={() => openOrderClient(it)}
                    sx={{ color: B.white, fontSize: 14, cursor: 'pointer', '&:hover': { color: B.green } }}
                  >
                    {it.companyName || it.clientName || '—'}
                  </Typography>
                  <OpenInNewIcon sx={{ fontSize: 13, color: B.muted, cursor: 'pointer' }} onClick={() => openOrderClient(it)} />
                </Stack>
              }
              right={<>{fmt(it.totalValue)} · {fmtRelative(it.createdAt)}</>}
            />
          )}
        />
        <ActionGroup
          icon={<ImageNotSupportedIcon fontSize="small" />} color={URGENT}
          title="Missing mockups on placed orders"
          items={aq.missingMockups || []}
          empty="Every placed order has mockups linked."
          renderItem={(it) => (
            <Row
              left={
                <Typography
                  onClick={() => openOrderClient(it)}
                  sx={{ color: B.white, fontSize: 14, cursor: 'pointer', '&:hover': { color: B.green } }}
                >
                  #{it.orderNumber || '—'} · {it.companyName || it.clientName}
                </Typography>
              }
              right={STATUS_META[it.status]?.label || it.status}
            />
          )}
        />
        <ActionGroup
          icon={<LocalShippingIcon fontSize="small" />} color={URGENT}
          title="Shipped > 5d ago, not marked delivered"
          items={aq.overdueShipped || []}
          empty="No overdue deliveries."
          renderItem={(it) => (
            <Row
              left={
                <Typography
                  onClick={() => openOrderClient(it)}
                  sx={{ color: B.white, fontSize: 14, cursor: 'pointer', '&:hover': { color: B.green } }}
                >
                  #{it.orderNumber || '—'} · {it.companyName || it.clientName}
                </Typography>
              }
              right={`shipped ${fmtRelative(it.shipDate)}`}
            />
          )}
        />
        <ActionGroup
          icon={<WarningAmberIcon fontSize="small" />} color={WARN}
          title="At-risk projects (in production > 14d)"
          items={aq.atRiskProjects || []}
          empty="Nothing stuck in production."
          renderItem={(it) => (
            <Row
              left={
                <Typography
                  onClick={() => openOrderClient(it)}
                  sx={{ color: B.white, fontSize: 14, cursor: 'pointer', '&:hover': { color: B.green } }}
                >
                  #{it.orderNumber || '—'} · {it.companyName || it.clientName}
                </Typography>
              }
              right={`updated ${fmtRelative(it.updatedAt)}`}
            />
          )}
        />
      </Box>

      {/* KPIs */}
      <Typography sx={{ color: B.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, mb: 1.5 }}>
        KPIS
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 4, flexWrap: 'wrap' }}>
        <KpiTile label="Revenue (delivered, all time)" value={fmt(k.revenueAllTime)} />
        <KpiTile label="Revenue this year"             value={fmt(k.revenueThisYear)} />
        <KpiTile label="Revenue this month"            value={fmt(k.revenueThisMonth)} />
        <KpiTile label="Open orders"                   value={k.openOrders} hint="approved · placed · in production · shipped" />
        <KpiTile label="Open quotes"                   value={k.openQuotes} />
        <KpiTile label="Active leads"                  value={k.activeLeads} hint="companies with quotes only" />
      </Stack>

      {/* Two-column lower section */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {/* Recent activity */}
        <Box>
          <Typography sx={{ color: B.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, mb: 1.5 }}>
            RECENT ACTIVITY
          </Typography>
          <Paper elevation={0} sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2 }}>
            <Stack divider={<Divider sx={{ borderColor: B.border }} />}>
              {(data.recentActivity || []).map((a) => {
                const meta = STATUS_META[a.status] || {};
                return (
                  <Box key={a._id} sx={{ px: 2, py: 1.25 }}>
                    <Row
                      left={
                        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                          <Chip size="small" label={meta.label || a.status}
                            sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600, height: 20 }} />
                          <Typography
                            onClick={() => openOrderClient(a)}
                            sx={{ color: B.white, fontSize: 14, cursor: 'pointer', '&:hover': { color: B.green } }}
                          >
                            {a.orderNumber ? `#${a.orderNumber} · ` : ''}{a.companyName || a.clientName}
                          </Typography>
                        </Stack>
                      }
                      right={fmtRelative(a.updatedAt)}
                    />
                  </Box>
                );
              })}
              {(data.recentActivity || []).length === 0 && (
                <Box sx={{ px: 2, py: 2, color: B.muted, fontSize: 13 }}>Nothing yet.</Box>
              )}
            </Stack>
          </Paper>
        </Box>

        {/* Top clients */}
        <Box>
          <Typography sx={{ color: B.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, mb: 1.5 }}>
            TOP CLIENTS (by delivered revenue)
          </Typography>
          <Paper elevation={0} sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2 }}>
            <Stack divider={<Divider sx={{ borderColor: B.border }} />}>
              {(data.topClients || []).map((c, i) => (
                <Box key={c._id || i} sx={{ px: 2, py: 1.25 }}>
                  <Row
                    left={
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Typography sx={{ color: B.muted, fontSize: 13, width: 18 }}>{i + 1}</Typography>
                        <Typography
                          onClick={() => openOrderClient(c)}
                          sx={{ color: B.white, fontSize: 14, cursor: 'pointer', '&:hover': { color: B.green } }}
                        >
                          {c.companyName || c.clientName || '—'}
                        </Typography>
                      </Stack>
                    }
                    right={<>{fmt(c.totalRevenue)} · {c.orderCount} orders</>}
                  />
                </Box>
              ))}
              {(data.topClients || []).length === 0 && (
                <Box sx={{ px: 2, py: 2, color: B.muted, fontSize: 13 }}>No delivered orders yet.</Box>
              )}
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
