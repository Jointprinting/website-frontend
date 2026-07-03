// src/screens/studio/outreach/AnalyticsView.js
// Outreach analytics — the numbers behind the machine, overall and per state.
// Four blocks: the overall funnel (enrolled → sent → opened → replied), an
// 8-week trend, a per-state funnel table, and the free-finder coverage per
// state. Charts are lightweight inline SVG on the Studio dark palette — subdued
// grid, semantic colors (distinct from the green accent), tabular figures.

import * as React from 'react';
import { Box, Stack, Typography, CircularProgress } from '@mui/material';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import { D, mono } from '../_shared';
import { EmptyState, Eyebrow } from '../crm/_crm';

// Semantic series colors — deliberately NOT the brand green-only, so the funnel
// stages read apart. Reply = green (the win); open = amber; sent = blue.
const C = { sent: '#60a5fa', opened: '#fbbf24', replied: '#4ade80', unsub: '#f87171', grid: 'rgba(255,255,255,0.08)' };

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

// ── Sending funnel — KPI tiles up front, nested funnel as support ─────────────
// The old version was four bars scaled to "enrolled"; with nothing sent it read
// as one full bar + three empty stubs (useless). This leads with the two numbers
// that actually matter for cold email — OPEN RATE and REPLY RATE — as stat tiles,
// then draws the nested funnel only once there's something to funnel.
function KpiTile({ label, value, sub, tone }) {
  return (
    <Box sx={{ flex: '1 1 120px', minWidth: 110, px: 1.5, py: 1.25, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
      <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ ...mono, color: tone || D.text, fontSize: 24, fontWeight: 800, lineHeight: 1.1, mt: 0.3 }}>{value}</Typography>
      {sub && <Typography sx={{ ...mono, color: D.faint, fontSize: 11, fontWeight: 700, mt: 0.2 }}>{sub}</Typography>}
    </Box>
  );
}

function Funnel({ overall }) {
  const { enrolled = 0, sent = 0, opened = 0, replied = 0, unsubscribed = 0 } = overall;
  const openRate = pct(opened, sent);
  const replyRate = pct(replied, sent);
  // Nested funnel scaled to sent (the real conversion): Sent 100% ⊇ Opened ⊇ Replied.
  const stages = [
    { label: 'Sent', value: sent, color: C.sent, of: 100 },
    { label: 'Opened', value: opened, color: C.opened, of: pct(opened, sent) },
    { label: 'Replied', value: replied, color: C.replied, of: pct(replied, sent) },
  ];
  return (
    <Stack spacing={1.75}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <KpiTile label="Enrolled" value={enrolled.toLocaleString()} tone={D.text} sub={`${sent} sent`} />
        <KpiTile label="Open rate" value={sent ? `${openRate}%` : '—'} tone={C.opened} sub={`${opened.toLocaleString()} opened`} />
        <KpiTile label="Reply rate" value={sent ? `${replyRate}%` : '—'} tone={C.replied} sub={`${replied.toLocaleString()} replied`} />
        <KpiTile label="Unsub" value={unsubscribed.toLocaleString()} tone={unsubscribed > 0 ? C.unsub : D.muted} sub={sent ? `${pct(unsubscribed, sent)}% of sent` : ''} />
      </Box>
      {sent > 0 ? (
        <Stack spacing={0.75}>
          {stages.map((r) => (
            <Box key={r.label}>
              <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.35 }}>
                <Typography sx={{ color: D.text, fontSize: 12, fontWeight: 700 }}>{r.label}</Typography>
                <Typography sx={{ ...mono, color: D.faint, fontSize: 11.5 }}>
                  <Box component="span" sx={{ color: r.color, fontWeight: 800 }}>{r.value.toLocaleString()}</Box>
                  {r.label !== 'Sent' ? `  ·  ${r.of}% of sent` : ''}
                </Typography>
              </Stack>
              <Box sx={{ height: 9, borderRadius: 999, bgcolor: D.inset, overflow: 'hidden' }}>
                <Box sx={{ width: `${Math.max(r.value > 0 ? 3 : 0, r.of)}%`, height: '100%', bgcolor: r.color,
                  borderRadius: 999, transition: 'width 0.5s ease' }} />
              </Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <Box sx={{ py: 1.5, px: 1.5, borderRadius: 2, bgcolor: D.inset, border: `1px dashed ${D.line}` }}>
          <Typography sx={{ color: D.muted, fontSize: 12.5, fontWeight: 600 }}>
            Nothing sent yet — your open and reply rates land here the moment the engine sends.
            {enrolled > 0 ? ' Check the campaign card above if it says a reason (e.g. leads missing email).' : ''}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

// ── 8-week trend — a small multi-series line chart ───────────────────────────
function TrendChart({ trend }) {
  const W = 640, H = 150, padL = 8, padR = 8, padT = 10, padB = 22;
  const n = trend.length;
  const maxVal = Math.max(1, ...trend.flatMap((w) => [w.sent, w.opened, w.replied]));
  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1);
  const y = (v) => padT + (1 - v / maxVal) * (H - padT - padB);
  const line = (key) => trend.map((w, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(w[key]).toFixed(1)}`).join(' ');
  const series = [
    { key: 'sent', color: C.sent }, { key: 'opened', color: C.opened }, { key: 'replied', color: C.replied },
  ];
  const anyData = trend.some((w) => w.sent || w.opened || w.replied);
  const wkLabel = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        {series.map((s) => (
          <Stack key={s.key} direction="row" spacing={0.6} alignItems="center">
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: s.color }} />
            <Typography sx={{ color: D.muted, fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize' }}>{s.key}</Typography>
          </Stack>
        ))}
      </Stack>
      {!anyData ? (
        <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: D.faint, fontSize: 12.5 }}>No sends yet — the trend fills in once the engine runs.</Typography>
        </Box>
      ) : (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Weekly outreach trend">
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)}
                stroke={C.grid} strokeWidth="1" />
            ))}
            {series.map((s) => (
              <path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" opacity={s.key === 'sent' ? 0.9 : 1} />
            ))}
            {series.map((s) => {
              const i = n - 1;
              return <circle key={s.key} cx={x(i)} cy={y(trend[i][s.key])} r="3" fill={s.color} />;
            })}
            {trend.map((w, i) => (
              (i % 2 === 0 || i === n - 1) && (
                <text key={i} x={x(i)} y={H - 6} fill={D.faint} fontSize="9" textAnchor="middle" fontFamily="monospace">
                  {wkLabel(w.weekStart)}
                </text>
              )
            ))}
          </svg>
        </Box>
      )}
    </Box>
  );
}

// ── Per-state funnel table with inline reply-rate bars ────────────────────────
function StateTable({ perState }) {
  if (!perState.length) {
    return <Typography sx={{ color: D.faint, fontSize: 12.5 }}>No enrolled leads yet — enroll some and per-state numbers land here.</Typography>;
  }
  const maxLeads = Math.max(1, ...perState.map((s) => s.leads));
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 460 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.4fr', gap: 1, px: 1, pb: 0.75 }}>
          {['State', 'Leads', 'Sent', 'Replied', 'Reply rate'].map((h, i) => (
            <Typography key={h} sx={{ ...mono, color: D.faint, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
              textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</Typography>
          ))}
        </Box>
        <Stack spacing={0.5}>
          {perState.map((s) => {
            const rr = pct(s.replied, s.sent);
            return (
              <Box key={s.state} sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.4fr', gap: 1,
                alignItems: 'center', px: 1, py: 0.75, borderRadius: 1.5, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box sx={{ width: 24, height: 18, borderRadius: 0.75, bgcolor: 'rgba(74,222,128,0.1)',
                    border: `1px solid ${D.line}`, display: 'grid', placeItems: 'center' }}>
                    <Typography sx={{ ...mono, fontSize: 9.5, fontWeight: 800, color: s.state === 'Unknown' ? D.faint : D.green }}>
                      {s.state === 'Unknown' ? '—' : s.state}
                    </Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, height: 5, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <Box sx={{ width: `${(s.leads / maxLeads) * 100}%`, height: '100%', bgcolor: C.sent, borderRadius: 999 }} />
                  </Box>
                </Stack>
                <Typography sx={{ ...mono, fontSize: 12.5, color: D.text, textAlign: 'right', fontWeight: 700 }}>{s.leads}</Typography>
                <Typography sx={{ ...mono, fontSize: 12.5, color: D.muted, textAlign: 'right' }}>{s.sent}</Typography>
                <Typography sx={{ ...mono, fontSize: 12.5, color: C.replied, textAlign: 'right', fontWeight: 700 }}>{s.replied}</Typography>
                <Typography sx={{ ...mono, fontSize: 12.5, color: rr > 0 ? C.replied : D.faint, textAlign: 'right', fontWeight: 700 }}>{rr}%</Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}

// ── Finder coverage per state ────────────────────────────────────────────────
function Coverage({ coverage, regionLabels }) {
  if (!coverage.length) {
    return <Typography sx={{ color: D.faint, fontSize: 12.5 }}>No sweeps yet — run the finder and coverage lands here.</Typography>;
  }
  const rows = [...coverage].sort((a, b) => b.created - a.created);
  return (
    <Stack spacing={0.5}>
      {rows.map((r) => (
        <Box key={r.region} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 1,
          alignItems: 'center', px: 1.25, py: 0.9, borderRadius: 1.5, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
          <Typography sx={{ color: D.text, fontSize: 12.5, fontWeight: 700 }}>{regionLabels[r.region] || r.region.toUpperCase()}</Typography>
          <Stat n={r.found} label="found" />
          <Stat n={r.verified || r.withEmail} label="emailable" tone={D.green} />
          <Stat n={r.created} label="imported" tone={C.sent} />
        </Box>
      ))}
    </Stack>
  );
}
function Stat({ n, label, tone = D.muted }) {
  return (
    <Box sx={{ textAlign: 'right' }}>
      <Typography component="span" sx={{ ...mono, fontSize: 13, fontWeight: 800, color: tone }}>{Number(n || 0).toLocaleString()}</Typography>
      <Typography component="span" sx={{ color: D.faint, fontSize: 10.5, ml: 0.5 }}>{label}</Typography>
    </Box>
  );
}

function Card({ title, children }) {
  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2.25 }}>
      <Eyebrow sx={{ mb: 1.5 }}>{title}</Eyebrow>
      {children}
    </Box>
  );
}

const REGION_LABELS = {
  nj: 'New Jersey', ny: 'New York', pa: 'Pennsylvania', ct: 'Connecticut', de: 'Delaware',
  md: 'Maryland', ma: 'Massachusetts', ri: 'Rhode Island', vt: 'Vermont', me: 'Maine',
  va: 'Virginia', oh: 'Ohio', mi: 'Michigan', il: 'Illinois', mn: 'Minnesota', mo: 'Missouri',
  az: 'Arizona', co: 'Colorado', nm: 'New Mexico', nv: 'Nevada', ca: 'California', or: 'Oregon',
  wa: 'Washington', mt: 'Montana', ak: 'Alaska',
};

export default function AnalyticsView({ analytics, loading }) {
  if (loading && !analytics) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }
  if (!analytics) return null;

  const { overall, perState = [], trend = [], coverage = [] } = analytics;
  const nothing = overall.enrolled === 0 && coverage.length === 0;
  if (nothing) {
    return (
      <EmptyState
        icon={<QueryStatsOutlinedIcon />}
        title="Nothing to chart yet"
        hint="Find some leads and enroll them in a campaign — sends, opens, replies, and per-state numbers show up here."
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Card title="Sending performance — open &amp; reply rates">
        <Funnel overall={overall} />
      </Card>
      <Card title="Last 8 weeks — sends, opens, replies">
        <TrendChart trend={trend} />
      </Card>
      <Card title="By state — where your replies come from">
        <StateTable perState={perState} />
      </Card>
      <Card title="Lead-finder coverage — free dispensary discovery">
        <Coverage coverage={coverage} regionLabels={REGION_LABELS} />
      </Card>
    </Stack>
  );
}
