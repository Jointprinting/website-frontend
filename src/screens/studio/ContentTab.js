// src/screens/studio/ContentTab.js
// Content — the owner's social planner/tracker (backend: controllers/
// socialPosts.js at /api/social). Built to make a weekly posting habit feel
// like a game he's winning, not a chore:
//
//   PACE BOARD   — this week's posted count vs the weekly goal per platform
//                  (rings), a consecutive-weeks streak flame, and a "week
//                  crushed" moment when every goal is hit. Goals are owner-
//                  tunable (site-setting `socialPace`; starts 1 + 1).
//   IDEA VAULT   — a quick-capture bar that saves on ⏎. Ideas NEVER delete:
//                  archive is the only remove, and the Archive shelf shows
//                  everything ever captured (house rule, like the rest of
//                  the Studio).
//   PIPELINE     — idea → drafted → scheduled → posted, one tap per hop; a
//                  full editor dialog for the body/caption, notes, tags,
//                  schedule date, post URL, and an IG reference image
//                  (downscaled client-side, same idiom as the quoter).
//   TRACKER      — on posted cards: paste views/likes/comments/shares in
//                  seconds; snapshots append (never overwrite) so the views
//                  sparkline shows the growth curve. postUrl links out.
//                  Built for manual paste today; the Meta API pull appends
//                  through the same endpoint.
//
// Week/streak math lives in _content.js (unit-tested).

import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, Button, TextField, MenuItem, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  CircularProgress,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RemoveIcon from '@mui/icons-material/Remove';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import config from '../../config.json';
import {
  D, accentBar, eyebrow, mono, dropInput, dropPrimaryBtn, dropGhostBtn,
  fmtRelative, useMobileFullScreen, scrollbar, ARCHIVE_TTL_DAYS, purgeDaysLeft,
} from './_shared';
import { confirmDialog } from './_dialog';
import JpLoader from '../../common/JpLoader';
import {
  PLATFORMS, POST_STATUSES, weekStart, weekLabel,
  postedCountsForWeek, weekMet, streakWeeks,
  rollupPostedStats, followerDelta, bestPostingDay, topTagByViews,
} from './_content';

const API = `${config.backendUrl}/api/social/posts`;
const PACE_API = `${config.backendUrl}/api/site-settings/socialPace`;
const ACCOUNT_API = `${config.backendUrl}/api/social/account`;

const statusMeta = (key) => POST_STATUSES.find((s) => s.key === key) || POST_STATUSES[0];
const platMeta   = (key) => PLATFORMS.find((p) => p.key === key) || null;

const inkInput = {
  ...dropInput,
  '& .MuiInputBase-input': { color: D.text, fontSize: 13, py: 0.9 },
};

// ── Small pieces ─────────────────────────────────────────────────────────────

// Platform badge: Instagram wears a warm gradient "IG"; an unassigned idea a
// quiet dash (legacy LinkedIn posts fall back to the dash too).
function PlatformBadge({ platform, size = 26 }) {
  const pm = platMeta(platform);
  const base = {
    width: size, height: size, borderRadius: size / 3.2, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.42, fontWeight: 900, letterSpacing: 0.2, ...mono,
  };
  if (!pm) {
    return <Box sx={{ ...base, color: D.faint, border: `1px dashed ${D.line}` }}>?</Box>;
  }
  if (pm.key === 'instagram') {
    return (
      <Box title="Instagram" sx={{ ...base, color: '#fff',
        background: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)' }}>
        {pm.short}
      </Box>
    );
  }
  return <Box title={pm.label} sx={{ ...base, color: '#fff', bgcolor: pm.color }}>{pm.short}</Box>;
}

// One platform's weekly pace ring: posted / goal, with a tiny goal stepper.
function PaceRing({ platform, count, goal, onGoal }) {
  const pm = platMeta(platform);
  const R = 26, C = 2 * Math.PI * R;
  const frac = goal > 0 ? Math.min(1, count / goal) : 0;
  const done = goal > 0 && count >= goal;
  return (
    <Stack direction="row" alignItems="center" gap={1.25}>
      <Box sx={{ position: 'relative', width: 64, height: 64 }}>
        <Box component="svg" viewBox="0 0 64 64" sx={{ width: 64, height: 64, transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r={R} fill="none" stroke={D.line} strokeWidth="5" />
          <circle cx="32" cy="32" r={R} fill="none"
            stroke={done ? D.green : (pm ? pm.color : D.muted)} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            style={{ transition: 'stroke-dashoffset 500ms ease, stroke 300ms ease' }} />
        </Box>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PlatformBadge platform={platform} size={24} />
        </Box>
      </Box>
      <Box>
        <Typography sx={{ color: done ? D.green : D.text, fontSize: 16, fontWeight: 800, ...mono, lineHeight: 1.1 }}>
          {count}<Box component="span" sx={{ color: D.faint, fontSize: 12 }}>/{goal}</Box>
          {done && <Box component="span" sx={{ ml: 0.5 }}>✓</Box>}
        </Typography>
        <Stack direction="row" alignItems="center" gap={0.25} sx={{ mt: 0.2 }}>
          <Typography sx={{ color: D.faint, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {goal === 0 ? 'paused' : 'per week'}
          </Typography>
          <IconButton size="small" onClick={() => onGoal(Math.max(0, goal - 1))} title="Lower the weekly goal"
            sx={{ color: D.faint, p: 0.1, '&:hover': { color: D.text } }}>
            <RemoveIcon sx={{ fontSize: 12 }} />
          </IconButton>
          <IconButton size="small" onClick={() => onGoal(Math.min(7, goal + 1))} title="Raise the weekly goal"
            sx={{ color: D.faint, p: 0.1, '&:hover': { color: D.green } }}>
            <AddIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Stack>
      </Box>
    </Stack>
  );
}

// The views growth curve across stat snapshots — a quiet inline SVG.
function Sparkline({ stats }) {
  const pts = (stats || []).slice(-12).map((s) => Number(s.views) || 0);
  if (pts.length < 2) return null;
  const W = 120, H = 26, max = Math.max(...pts, 1);
  const step = W / (pts.length - 1);
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(H - 2 - (v / max) * (H - 4)).toFixed(1)}`).join(' ');
  return (
    <Box component="svg" viewBox={`0 0 ${W} ${H}`} sx={{ width: W, height: H, flexShrink: 0 }}
      title="Views across your check-ins">
      <path d={path} fill="none" stroke={D.green} strokeWidth="1.6" strokeLinecap="round" />
    </Box>
  );
}

// The 10-second engagement logger on a posted card. Prefills the LAST
// snapshot so updating is "bump two numbers, save" — each save appends a new
// point to the curve.
function StatLogger({ post, onLog, busy }) {
  const last = (post.stats || [])[post.stats.length - 1] || {};
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({});
  const fields = [
    ['views', '👁', 'views'], ['likes', '❤️', 'likes'],
    ['comments', '💬', 'comments'], ['shares', '↗', 'shares'],
  ];
  const openIt = () => { setV({ views: last.views || '', likes: last.likes || '', comments: last.comments || '', shares: last.shares || '' }); setOpen(true); };
  const prev = (post.stats || [])[post.stats.length - 2] || null;
  const viewsDelta = prev ? (Number(last.views) || 0) - (Number(prev.views) || 0) : 0;
  if (!open) {
    return (
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        {(post.stats || []).length > 0 && (
          <Typography sx={{ color: D.muted, fontSize: 12, ...mono }}>
            👁 {last.views || 0} · ❤️ {last.likes || 0} · 💬 {last.comments || 0} · ↗ {last.shares || 0}
            {Number(last.views) > 0 && (
              <Box component="span" sx={{ color: D.green, fontWeight: 800, ml: 0.75 }}
                title="Engagement — likes + comments per view">
                {(((Number(last.likes) || 0) + (Number(last.comments) || 0)) / Number(last.views) * 100).toFixed(1)}% eng
              </Box>
            )}
            {viewsDelta !== 0 && (
              <Box component="span" title="Views gained since the previous check"
                sx={{ color: viewsDelta > 0 ? D.green : '#f87171', fontWeight: 800, ml: 0.75 }}>
                {viewsDelta > 0 ? `▲${viewsDelta}` : `▼${Math.abs(viewsDelta)}`}
              </Box>
            )}
          </Typography>
        )}
        <Sparkline stats={post.stats} />
        <Button size="small" onClick={openIt}
          sx={{ color: D.green, textTransform: 'none', fontWeight: 700, fontSize: 11, px: 1,
            borderRadius: 999, '&:hover': { bgcolor: 'rgba(74,222,128,0.10)' } }}>
          {(post.stats || []).length ? 'Update numbers' : 'Log numbers'}
        </Button>
        {(post.stats || []).length > 0 && (
          <Typography sx={{ color: D.faint, fontSize: 10.5 }}>
            checked {fmtRelative(last.at)}
          </Typography>
        )}
      </Stack>
    );
  }
  return (
    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
      {fields.map(([key, icon, ph]) => (
        <TextField key={key} size="small" type="number" value={v[key]} placeholder={ph}
          onChange={(e) => setV((p) => ({ ...p, [key]: e.target.value }))}
          InputProps={{ startAdornment: <Typography sx={{ fontSize: 12, mr: 0.4 }}>{icon}</Typography> }}
          sx={{ ...inkInput, width: 96,
            '& .MuiInputBase-input': { color: D.text, fontSize: 12.5, py: 0.6, ...mono } }} />
      ))}
      <Button size="small" disabled={busy} onClick={async () => { await onLog(v); setOpen(false); }}
        sx={{ ...dropPrimaryBtn, py: 0.4, px: 1.5, fontSize: 11.5 }}>
        Save
      </Button>
      <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
        <CloseIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Stack>
  );
}

// ── Insights strip — the account's results at a glance ───────────────────────
// Everything here is computed from data already loaded (posted cards' stat
// series + the account's daily follower history) — no extra fetches. Renders
// nothing until there's at least one posted card with numbers.
function InsightsStrip({ posts, account, onOpenPost }) {
  const roll = rollupPostedStats(posts);
  if (!roll.count) return null;
  const d30 = account ? followerDelta(account.followerHistory, 30) : 0;
  const day = bestPostingDay(posts);
  const tag = topTagByViews(posts);
  const bestLast = roll.best && roll.best.stats ? roll.best.stats[roll.best.stats.length - 1] : null;
  const Tile = ({ label, value, tone }) => (
    <Box sx={{ textAlign: 'center', minWidth: 84 }}>
      <Typography sx={{ color: tone || D.text, fontSize: 19, fontWeight: 900, ...mono, lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ color: D.faint, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mt: 0.2 }}>{label}</Typography>
    </Box>
  );
  return (
    <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 3, bgcolor: D.panel, p: { xs: 1.5, md: 2 }, mb: 2 }}>
      <Typography sx={{ ...eyebrow, display: 'block', mb: 1 }}>Your results</Typography>
      <Stack direction="row" gap={{ xs: 2, md: 3.5 }} flexWrap="wrap" alignItems="center">
        <Tile label="Posts tracked" value={roll.count} />
        <Tile label="Total views" value={roll.views.toLocaleString()} tone={D.green} />
        <Tile label="Total likes" value={roll.likes.toLocaleString()} />
        <Tile label="Avg engagement" value={`${roll.avgEng}%`} tone={D.green} />
        {account && <Tile label="Followers 30d" value={d30 > 0 ? `+${d30}` : String(d30)} tone={d30 >= 0 ? D.green : '#f87171'} />}
        {roll.best && bestLast && (
          <Box onClick={() => onOpenPost(roll.best)} title="Open your best post"
            sx={{ cursor: 'pointer', minWidth: 0, maxWidth: 260, '&:hover': { opacity: 0.85 } }}>
            <Typography noWrap sx={{ color: D.text, fontSize: 12.5, fontWeight: 800 }}>
              🏆 {roll.best.title || (roll.best.body || '').slice(0, 40) || 'Best post'}
            </Typography>
            <Typography sx={{ color: D.muted, fontSize: 10.5, ...mono }}>
              {(Number(bestLast.views) || 0).toLocaleString()} views · your best
            </Typography>
          </Box>
        )}
      </Stack>
      {(day || tag) && (
        <Typography sx={{ color: D.muted, fontSize: 11.5, mt: 1.25, lineHeight: 1.5 }}>
          {day && <>📅 Your <b style={{ color: D.text }}>{day.day}</b> posts engage best ({day.eng}% avg).</>}
          {day && tag && ' '}
          {tag && <>🏷 <b style={{ color: D.text }}>#{tag.tag}</b> is your top tag — {tag.avgViews.toLocaleString()} avg views.</>}
        </Typography>
      )}
    </Box>
  );
}

// Downscale an IG reference image the same way the quoter shrinks design
// renders — the planner needs a thumbnail, never a full-res original.
function readRefImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 700;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

// One post card: identity row, body preview, then the contextual next step —
// the card always tells you the ONE thing to do next.
function PostCard({ post, busy, onEdit, onPatch, onArchive, onLogStats, onTag }) {
  const sm = statusMeta(post.status);
  const next =
    post.status === 'idea'      ? { label: 'Write the draft', go: () => onEdit(post, 'drafted') } :
    post.status === 'drafted'   ? { label: 'Schedule it',     go: () => onEdit(post, 'scheduled') } :
    post.status === 'scheduled' ? { label: 'Mark posted 🚀',  go: () => onPatch(post, { status: 'posted' }) } :
    null;
  return (
    <Box sx={{ border: `1px solid ${D.line}`, borderLeft: `3px solid ${sm.color}`,
      borderRadius: 3, bgcolor: D.panel, p: 1.75, display: 'flex', flexDirection: 'column', gap: 1,
      opacity: post.archived ? 0.65 : 1,
      transition: 'background-color 0.18s ease, box-shadow 0.2s ease',
      '&:hover': { bgcolor: D.panelHi, boxShadow: '0 10px 28px rgba(0,0,0,0.3)' } }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <PlatformBadge platform={post.platform} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 13.5, lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.title || (post.body || '').slice(0, 60) || 'Untitled idea'}
          </Typography>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 0.2 }}>
            <Typography sx={{ color: sm.color, fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {sm.emoji} {sm.key}
            </Typography>
            {post.status === 'scheduled' && post.scheduledFor && (
              <Typography sx={{ color: D.muted, fontSize: 10.5, ...mono }}>
                → {new Date(post.scheduledFor).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Typography>
            )}
            {post.status === 'posted' && post.postedAt && (
              <Typography sx={{ color: D.muted, fontSize: 10.5, ...mono }}>
                live {fmtRelative(post.postedAt)}
              </Typography>
            )}
            {(post.tags || []).slice(0, 3).map((t) => (
              <Typography key={t} onClick={onTag ? (e) => { e.stopPropagation(); onTag(t); } : undefined}
                title={onTag ? `Filter by #${t}` : undefined}
                sx={{ color: D.faint, fontSize: 10.5, cursor: onTag ? 'pointer' : 'default',
                  '&:hover': onTag ? { color: D.green } : {} }}>#{t}</Typography>
            ))}
          </Stack>
        </Box>
        <IconButton size="small" onClick={() => onEdit(post)} title="Open the editor"
          sx={{ color: D.muted, '&:hover': { color: D.green } }}>
          <EditOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" onClick={() => onArchive(post)}
          title={post.archived ? 'Restore to the pipeline' : `Archive (auto-deletes after ${ARCHIVE_TTL_DAYS} days)`}
          sx={{ color: D.muted, '&:hover': { color: post.archived ? D.green : '#f87171' } }}>
          {post.archived ? <UnarchiveOutlinedIcon sx={{ fontSize: 16 }} /> : <ArchiveOutlinedIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Stack>
      {post.archived && (() => {
        const left = purgeDaysLeft(post.archivedAt, post.updatedAt);
        return (
          <Typography sx={{ color: '#f87171', fontSize: 10.5, fontWeight: 700 }}>
            auto-deletes in {left} day{left === 1 ? '' : 's'} — restore to keep it
          </Typography>
        );
      })()}

      {(post.body || post.refImage) && (
        <Stack direction="row" gap={1.25} alignItems="flex-start">
          {post.refImage && (
            <Box component="img" src={post.refImage} alt=""
              sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${D.line}`, flexShrink: 0 }} />
          )}
          {post.body && (
            <Typography sx={{ color: D.muted, fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {post.body}
            </Typography>
          )}
        </Stack>
      )}

      {post.status === 'posted' && !post.archived && (
        <Box sx={{ borderTop: `1px solid ${D.line}`, pt: 1 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <StatLogger post={post} busy={busy} onLog={(v) => onLogStats(post, v)} />
            <Box sx={{ flex: 1 }} />
            {post.postUrl ? (
              <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                onClick={() => window.open(post.postUrl, '_blank', 'noopener,noreferrer')}
                sx={{ color: D.muted, textTransform: 'none', fontSize: 11, fontWeight: 700,
                  '&:hover': { color: D.green } }}>
                Open post
              </Button>
            ) : (
              <Button size="small" onClick={() => onEdit(post)}
                sx={{ color: D.faint, textTransform: 'none', fontSize: 11, '&:hover': { color: D.green } }}>
                + paste post link
              </Button>
            )}
          </Stack>
        </Box>
      )}

      {next && !post.archived && (
        <Button onClick={next.go} disabled={busy}
          sx={{ alignSelf: 'flex-start', color: D.green, textTransform: 'none', fontWeight: 800,
            fontSize: 12, borderRadius: 999, px: 1.5, py: 0.3, border: `1px solid rgba(74,222,128,0.35)`,
            '&:hover': { bgcolor: 'rgba(74,222,128,0.10)', borderColor: D.green } }}>
          {next.label} →
        </Button>
      )}
    </Box>
  );
}

// The connected-Instagram card: live followers (with 30-day delta off the
// sync's daily history), media count, last-sync state, Sync now — or, before
// connecting, the pitch + token dialog trigger.
function AccountCard({ account, onConnect, onSync, onDisconnect, syncBusy }) {
  if (!account) {
    return (
      <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 3, bgcolor: D.panel, p: 2, mb: 2,
        display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <PlatformBadge platform="instagram" size={34} />
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 13.5 }}>
            Connect Instagram — live numbers, zero pasting
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 11.5, lineHeight: 1.5 }}>
            Followers on this board, views/likes/comments auto-filled on every posted card,
            and your recent posts imported. Needs an IG Business/Creator account + a Meta token.
          </Typography>
        </Box>
        <Button onClick={onConnect} sx={{ ...dropPrimaryBtn, py: 0.6, px: 2, fontSize: 12 }}>
          Connect Instagram
        </Button>
      </Box>
    );
  }
  const hist = account.followerHistory || [];
  const monthAgo = Date.now() - 30 * 86400000;
  const base = hist.find((h) => new Date(h.at).getTime() >= monthAgo) || hist[0];
  const delta = base ? (account.followers - base.followers) : 0;
  const expSoon = account.tokenExpiresAt && (new Date(account.tokenExpiresAt) - Date.now()) < 10 * 86400000;
  return (
    <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 3, bgcolor: D.panel, p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        {account.profilePicUrl
          ? <Box component="img" src={account.profilePicUrl} alt=""
              sx={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${platMeta('instagram').color}` }} />
          : <PlatformBadge platform="instagram" size={36} />}
        <Box sx={{ minWidth: 130 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14 }}>@{account.username || 'instagram'}</Typography>
          <Typography sx={{ color: D.faint, fontSize: 10.5 }}>
            {account.lastSyncAt ? `synced ${fmtRelative(account.lastSyncAt)}` : 'not synced yet'}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center', px: 1 }}>
          <Typography sx={{ color: D.text, fontSize: 22, fontWeight: 900, ...mono, lineHeight: 1.1 }}>
            {Number(account.followers || 0).toLocaleString('en-US')}
          </Typography>
          <Typography sx={{ color: D.faint, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            followers
            {delta !== 0 && (
              <Box component="span" sx={{ ml: 0.5, color: delta > 0 ? D.green : '#f87171', ...mono }}>
                {delta > 0 ? '+' : ''}{delta}/30d
              </Box>
            )}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center', px: 1 }}>
          <Typography sx={{ color: D.text, fontSize: 22, fontWeight: 900, ...mono, lineHeight: 1.1 }}>
            {Number(account.mediaCount || 0).toLocaleString('en-US')}
          </Typography>
          <Typography sx={{ color: D.faint, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            posts
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" gap={0.75} alignItems="center">
          <Button onClick={onSync} disabled={syncBusy}
            sx={{ ...dropGhostBtn, py: 0.5, px: 1.5, fontSize: 11.5 }}>
            {syncBusy ? <CircularProgress size={14} sx={{ color: D.green }} /> : 'Sync now'}
          </Button>
          <Button onClick={onDisconnect}
            sx={{ color: D.faint, textTransform: 'none', fontSize: 10.5, minWidth: 0,
              '&:hover': { color: '#f87171' } }}>
            disconnect
          </Button>
        </Stack>
      </Stack>
      {(account.lastSyncError || expSoon) && (
        <Typography sx={{ color: '#f87171', fontSize: 11, mt: 1 }}>
          {account.lastSyncError
            ? `Last sync failed: ${account.lastSyncError}`
            : `Token expires ${fmtRelative(account.tokenExpiresAt)} — reconnect with a fresh one soon.`}
        </Typography>
      )}
    </Box>
  );
}

// ── The tab ──────────────────────────────────────────────────────────────────

export default function ContentTab({ token, onBack }) {
  const fullScreen = useMobileFullScreen();
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [posts, setPosts] = React.useState(null);          // null = loading
  const [pace, setPace] = React.useState({ instagram: 1 });
  const [account, setAccount] = React.useState(null);      // connected IG (or null)
  const [connOpen, setConnOpen] = React.useState(false);
  const [conn, setConn] = React.useState({ accessToken: '', igUserId: '' });
  const [connBusy, setConnBusy] = React.useState(false);
  const [connErr, setConnErr] = React.useState('');
  const [syncBusy, setSyncBusy] = React.useState(false);
  const [filter, setFilter] = React.useState('active');    // active | idea | drafted | scheduled | posted | archived
  const [tagFilter, setTagFilter] = React.useState('');     // '' = all tags; stacks on top of the status filter
  const [quick, setQuick] = React.useState('');
  const [quickPlat, setQuickPlat] = React.useState('');
  const [editing, setEditing] = React.useState(null);      // working copy in the dialog
  const [busy, setBusy] = React.useState(false);
  const [snack, setSnack] = React.useState(null);
  const fileRef = React.useRef(null);

  const toast = (msg, sev = 'success') => setSnack({ msg, sev });

  const load = React.useCallback(async () => {
    try {
      const [{ data }, paceRes, acctRes] = await Promise.all([
        axios.get(`${API}?archived=1`, authHdr),
        axios.get(PACE_API, authHdr).catch(() => null),
        axios.get(ACCOUNT_API, authHdr).catch(() => null),
      ]);
      setPosts(data.posts || []);
      if (paceRes && paceRes.data && paceRes.data.value) setPace(paceRes.data.value);
      if (acctRes && acctRes.data) setAccount(acctRes.data.account || null);
    } catch (e) {
      setPosts([]);
      toast(e.response?.data?.message || 'Could not load posts', 'error');
    }
  }, [authHdr]);
  React.useEffect(() => { load(); }, [load]);

  const savePace = async (next) => {
    setPace(next);   // optimistic — a goal tweak should feel instant
    try { await axios.put(PACE_API, { value: next }, authHdr); }
    catch (e) { toast('Could not save the pace goal', 'error'); }
  };

  const upsertLocal = (post) =>
    setPosts((prev) => {
      const list = prev || [];
      const i = list.findIndex((p) => p._id === post._id);
      return i >= 0 ? list.map((p, j) => (j === i ? post : p)) : [post, ...list];
    });

  const createQuick = async () => {
    const title = quick.trim();
    if (!title) return;
    setBusy(true);
    try {
      const { data } = await axios.post(API, { title, platform: quickPlat }, authHdr);
      upsertLocal(data.post);
      setQuick('');
      toast('Idea saved ✌️');
    } catch (e) {
      toast(e.response?.data?.message || 'Could not save the idea', 'error');
    } finally { setBusy(false); }
  };

  const patchPost = async (post, fields) => {
    setBusy(true);
    try {
      const { data } = await axios.patch(`${API}/${post._id}`, fields, authHdr);
      upsertLocal(data.post);
      if (fields.status === 'posted') {
        const counts = postedCountsForWeek([...(posts || []).filter(p => p._id !== post._id), data.post], weekStart());
        toast(weekMet(counts, pace) ? 'Posted — week crushed! 🎉🔥' : 'Posted! 🚀');
      }
      return data.post;
    } catch (e) {
      toast(e.response?.data?.message || 'Could not save', 'error');
      return null;
    } finally { setBusy(false); }
  };

  const logStats = async (post, v) => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/${post._id}/stats`, v, authHdr);
      upsertLocal(data.post);
      toast('Numbers logged 📈');
    } catch (e) {
      toast(e.response?.data?.message || 'Could not log stats', 'error');
    } finally { setBusy(false); }
  };

  const connectIg = async () => {
    setConnBusy(true); setConnErr('');
    try {
      const { data } = await axios.post(ACCOUNT_API, conn, authHdr);
      setAccount(data.account || null);
      setConnOpen(false);
      setConn({ accessToken: '', igUserId: '' });
      toast(`Connected @${data.account?.username || 'instagram'} — first sync is running, numbers land in a minute 📡`);
      setTimeout(load, 20000);   // the background first sync imports posted cards; refresh once it's had a moment
    } catch (e) {
      setConnErr(e.response?.data?.message || 'Could not connect — check the token.');
    } finally { setConnBusy(false); }
  };
  const syncIg = async () => {
    setSyncBusy(true);
    try {
      const { data } = await axios.post(`${ACCOUNT_API}/sync`, {}, authHdr);
      if (data.account) setAccount(data.account);
      if (data.error) toast(`Sync failed: ${data.error}`, 'error');
      else { toast(`Synced — ${data.updated || 0} updated, ${data.imported || 0} imported 📡`); load(); }
    } catch (e) {
      toast(e.response?.data?.message || 'Sync failed', 'error');
    } finally { setSyncBusy(false); }
  };
  const disconnectIg = async () => {
    if (!(await confirmDialog({ title: 'Disconnect Instagram?', message: 'Posts and their stats stay — only the live sync stops.', confirmLabel: 'Disconnect', danger: true }))) return;
    try { await axios.delete(ACCOUNT_API, authHdr); setAccount(null); toast('Disconnected'); }
    catch (e) { toast('Could not disconnect', 'error'); }
  };

  // Editor open: `bumpTo` pre-advances the status ("Write the draft" lands in
  // the editor already as a draft; "Schedule it" opens with the date focused).
  const openEditor = (post, bumpTo) => {
    setEditing({
      ...post,
      status: bumpTo || post.status,
      tags: (post.tags || []).join(', '),
      scheduledFor: post.scheduledFor ? String(post.scheduledFor).slice(0, 10) : '',
    });
  };
  const saveEditor = async () => {
    const e = editing;
    const fields = {
      platform: e.platform, status: e.status,
      title: e.title || '', body: e.body || '', notes: e.notes || '',
      tags: String(e.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      refImage: e.refImage || '',
      postUrl: e.postUrl || '',
      scheduledFor: e.scheduledFor ? new Date(`${e.scheduledFor}T12:00:00`) : null,
    };
    const saved = await patchPost({ _id: e._id }, fields);
    if (saved) setEditing(null);
  };

  // ── Derived: pace, streak, filters ──────────────────────────────────────────
  const ws = weekStart();
  const counts = postedCountsForWeek(posts || [], ws);
  const crushed = weekMet(counts, pace);
  const streak = streakWeeks(posts || [], pace);
  const scheduledThisWeek = (posts || []).filter((p) => !p.archived && p.status === 'scheduled' && p.scheduledFor
    && new Date(p.scheduledFor) >= ws && new Date(p.scheduledFor) < new Date(ws.getTime() + 7 * 86400000));

  const active = (posts || []).filter((p) => !p.archived);
  const countFor = (key) =>
    key === 'active' ? active.length :
    key === 'archived' ? (posts || []).filter((p) => p.archived).length :
    active.filter((p) => p.status === key).length;
  // Tag lens on top of the status filter — organize the library by campaign/
  // theme (#420, #hoodies, …). Chips derive from whatever tags exist.
  const allTags = [...new Set((posts || []).flatMap((p) => (p && p.tags) || []))].sort();
  const tagCount = (t) => active.filter((p) => (p.tags || []).includes(t)).length;
  const shown = (posts || []).filter((p) =>
    (filter === 'active' ? !p.archived :
      filter === 'archived' ? p.archived :
        (!p.archived && p.status === filter))
    && (!tagFilter || ((p.tags || []).includes(tagFilter))));
  // Pipeline order inside "everything": working items first, posted last.
  const ORDER = { idea: 0, drafted: 1, scheduled: 2, posted: 3 };
  const sorted = [...shown].sort((a, b) =>
    (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)
    || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  const FILTERS = [
    { key: 'active', label: 'Pipeline' },
    ...POST_STATUSES.map((s) => ({ key: s.key, label: `${s.emoji} ${s.label}` })),
    { key: 'archived', label: '🗄 Archive' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: D.bg, color: D.text, p: { xs: 1.5, md: 3 }, ...scrollbar }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={onBack} sx={{ color: D.muted, '&:hover': { color: D.text } }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <Box sx={accentBar} />
        <CampaignOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 16, letterSpacing: 0.2, lineHeight: 1.2 }}>
            Content
          </Typography>
          <Typography sx={{ color: D.muted, fontSize: 11.5 }}>
            Instagram — plan it, post it, watch the numbers
          </Typography>
        </Box>
      </Stack>

      {posts === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><JpLoader size={64} /></Box>
      ) : (
        <>
          {/* ── Pace board ─────────────────────────────────────────────── */}
          <Box sx={{ border: `1px solid ${crushed ? 'rgba(74,222,128,0.45)' : D.line}`, borderRadius: 3,
            bgcolor: D.panel, p: { xs: 1.75, md: 2.25 }, mb: 2,
            ...(crushed ? { boxShadow: `0 0 24px rgba(74,222,128,0.12)` } : {}) }}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
              <Typography sx={{ ...eyebrow, color: D.green }}>{weekLabel(ws)}</Typography>
              {streak > 0 && (
                <Chip size="small" label={`🔥 ${streak}-week streak`}
                  sx={{ bgcolor: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontWeight: 800, fontSize: 11 }} />
              )}
              {crushed && (
                <Chip size="small" label="Week crushed 🎉"
                  sx={{ bgcolor: 'rgba(74,222,128,0.14)', color: D.green, fontWeight: 800, fontSize: 11 }} />
              )}
              <Box sx={{ flex: 1 }} />
              {scheduledThisWeek.length > 0 && (
                <Typography sx={{ color: D.muted, fontSize: 11.5 }}>
                  {scheduledThisWeek.length} scheduled this week
                </Typography>
              )}
            </Stack>
            <Stack direction="row" gap={{ xs: 3, md: 6 }} flexWrap="wrap">
              {PLATFORMS.map((pl) => (
                <PaceRing key={pl.key} platform={pl.key}
                  count={counts[pl.key] || 0} goal={Number(pace[pl.key]) || 0}
                  onGoal={(g) => savePace({ ...pace, [pl.key]: g })} />
              ))}
            </Stack>
          </Box>

          {/* ── Connected account — live IG numbers ─────────────────────── */}
          <AccountCard account={account} syncBusy={syncBusy}
            onConnect={() => { setConnErr(''); setConnOpen(true); }}
            onSync={syncIg} onDisconnect={disconnectIg} />

          {/* ── Results at a glance + strategy hints (auto-hides until there
                 are posted cards with numbers) ─────────────────────────────── */}
          <InsightsStrip posts={posts} account={account} onOpenPost={openEditor} />

          {/* ── Quick capture ──────────────────────────────────────────── */}
          <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 3, bgcolor: D.inset,
            p: 1.5, mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
              <TextField size="small" fullWidth value={quick}
                placeholder={`Drop an idea… (⏎ saves it — nothing deletes unless YOU archive it, then ${ARCHIVE_TTL_DAYS} days later)`}
                onChange={(e) => setQuick(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createQuick(); }}
                sx={inkInput} />
              <Stack direction="row" gap={0.5} alignItems="center" flexShrink={0}>
                {['', ...PLATFORMS.map((p) => p.key)].map((k) => (
                  <Box key={k || 'any'} onClick={() => setQuickPlat(k)}
                    sx={{ cursor: 'pointer', borderRadius: 999, px: 1, py: 0.35, fontSize: 11, fontWeight: 700,
                      color: quickPlat === k ? D.ink : D.muted,
                      bgcolor: quickPlat === k ? D.green : 'transparent',
                      border: `1px solid ${quickPlat === k ? D.green : D.line}`,
                      transition: 'all 0.15s ease' }}>
                    {k === '' ? 'later' : platMeta(k).short}
                  </Box>
                ))}
                <Button onClick={createQuick} disabled={busy || !quick.trim()} startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                  sx={{ ...dropPrimaryBtn, py: 0.55, px: 1.75, fontSize: 12 }}>
                  Save idea
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* ── Filters ────────────────────────────────────────────────── */}
          <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: allTags.length ? 0.75 : 1.5 }}>
            {FILTERS.map((f) => (
              <Box key={f.key} onClick={() => setFilter(f.key)}
                sx={{ cursor: 'pointer', borderRadius: 999, px: 1.5, py: 0.5, fontSize: 12, fontWeight: 700,
                  color: filter === f.key ? D.ink : D.muted,
                  bgcolor: filter === f.key ? D.green : D.panel,
                  border: `1px solid ${filter === f.key ? D.green : D.line}`,
                  transition: 'all 0.15s ease',
                  '&:hover': filter === f.key ? {} : { color: D.text, borderColor: D.lineHi } }}>
                {f.label}
                <Box component="span" sx={{ ml: 0.6, ...mono, fontSize: 10.5, opacity: 0.75 }}>{countFor(f.key)}</Box>
              </Box>
            ))}
          </Stack>
          {allTags.length > 0 && (
            <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ mb: 1.5 }}>
              {allTags.map((t) => (
                <Box key={t} onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                  sx={{ cursor: 'pointer', borderRadius: 999, px: 1.1, py: 0.3, fontSize: 11, fontWeight: 700,
                    color: tagFilter === t ? D.ink : D.faint,
                    bgcolor: tagFilter === t ? '#fbbf24' : 'transparent',
                    border: `1px solid ${tagFilter === t ? '#fbbf24' : D.line}`,
                    transition: 'all 0.15s ease',
                    '&:hover': tagFilter === t ? {} : { color: D.text, borderColor: D.lineHi } }}>
                  #{t}
                  <Box component="span" sx={{ ml: 0.5, ...mono, fontSize: 10, opacity: 0.75 }}>{tagCount(t)}</Box>
                </Box>
              ))}
              {tagFilter && (
                <Box onClick={() => setTagFilter('')}
                  sx={{ cursor: 'pointer', borderRadius: 999, px: 1.1, py: 0.3, fontSize: 11, fontWeight: 700,
                    color: D.muted, border: `1px dashed ${D.line}`, '&:hover': { color: D.text } }}>
                  clear ✕
                </Box>
              )}
            </Stack>
          )}

          {/* ── Cards ──────────────────────────────────────────────────── */}
          {sorted.length === 0 ? (
            <Box sx={{ border: `1px dashed ${D.line}`, borderRadius: 3, py: 7, textAlign: 'center',
              color: D.muted, bgcolor: D.inset }}>
              <Typography sx={{ fontSize: 20, mb: 0.5 }}>💡</Typography>
              <Typography sx={{ fontSize: 13 }}>
                {filter === 'archived' ? 'Nothing archived — the vault is all live.' : 'Nothing here yet — drop an idea above.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              {sorted.map((p) => (
                <PostCard key={p._id} post={p} busy={busy}
                  onEdit={openEditor}
                  onPatch={patchPost}
                  onArchive={(post) => patchPost(post, { archived: !post.archived })}
                  onLogStats={logStats}
                  onTag={(t) => setTagFilter(t)} />
              ))}
            </Box>
          )}
        </>
      )}

      {/* ── Connect-Instagram dialog ─────────────────────────────────────── */}
      <Dialog open={connOpen} onClose={() => !connBusy && setConnOpen(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: D.bg, color: D.text, border: `1px solid ${D.line}`, borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlatformBadge platform="instagram" size={26} />
          <Typography sx={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Connect Instagram</Typography>
          <IconButton size="small" onClick={() => setConnOpen(false)} sx={{ color: D.muted }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ color: D.muted, fontSize: 12, lineHeight: 1.6 }}>
            Paste a Meta <b>access token</b> for the Facebook account that owns your IG
            Business/Creator profile. Getting one takes ~5 minutes the first time —
            the step-by-step is in the session brief (developers.facebook.com →
            Graph API Explorer). The IG user id is auto-discovered; only paste it if
            the auto-detect complains.
          </Typography>
          <TextField size="small" fullWidth multiline minRows={2} label="Access token"
            value={conn.accessToken}
            onChange={(e) => setConn((v) => ({ ...v, accessToken: e.target.value }))}
            sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />
          <TextField size="small" fullWidth label="IG user id (optional — auto-detected)"
            value={conn.igUserId}
            onChange={(e) => setConn((v) => ({ ...v, igUserId: e.target.value }))}
            sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />
          {connErr && <Typography sx={{ color: '#f87171', fontSize: 12, fontWeight: 700 }}>{connErr}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConnOpen(false)} disabled={connBusy} sx={{ ...dropGhostBtn }}>Cancel</Button>
          <Button onClick={connectIg} disabled={connBusy || !conn.accessToken.trim()} sx={{ ...dropPrimaryBtn }}>
            {connBusy ? <CircularProgress size={16} sx={{ color: D.ink }} /> : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Editor dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm" fullScreen={fullScreen}
        PaperProps={{ sx: { bgcolor: D.bg, color: D.text, border: `1px solid ${D.line}`,
          borderRadius: fullScreen ? 0 : 3 } }}>
        {editing && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
              <PlatformBadge platform={editing.platform} />
              <Typography sx={{ fontWeight: 800, fontSize: 15, flex: 1 }}>
                {editing.title || 'Edit post'}
              </Typography>
              <IconButton size="small" onClick={() => setEditing(null)} sx={{ color: D.muted }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important', ...scrollbar }}>
              <Stack direction="row" gap={1}>
                <TextField select size="small" label="Platform" value={editing.platform || ''}
                  onChange={(e) => setEditing((p) => ({ ...p, platform: e.target.value }))}
                  sx={{ ...inkInput, width: 150 }} InputLabelProps={{ sx: { color: D.muted } }}>
                  <MenuItem value="">Decide later</MenuItem>
                  {PLATFORMS.map((pl) => <MenuItem key={pl.key} value={pl.key}>{pl.label}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Status" value={editing.status}
                  onChange={(e) => setEditing((p) => ({ ...p, status: e.target.value }))}
                  sx={{ ...inkInput, width: 150 }} InputLabelProps={{ sx: { color: D.muted } }}>
                  {POST_STATUSES.map((s) => <MenuItem key={s.key} value={s.key}>{s.emoji} {s.label}</MenuItem>)}
                </TextField>
                {editing.status === 'scheduled' && (
                  <TextField size="small" type="date" label="Post on" value={editing.scheduledFor || ''}
                    onChange={(e) => setEditing((p) => ({ ...p, scheduledFor: e.target.value }))}
                    InputLabelProps={{ shrink: true, sx: { color: D.muted } }} sx={inkInput} />
                )}
              </Stack>
              <TextField size="small" label="Title (your handle for it)" value={editing.title || ''}
                onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))}
                sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />
              <Box>
                <TextField size="small" fullWidth multiline minRows={5} maxRows={14}
                  label={editing.platform === 'instagram' ? 'Caption' : 'Post text'}
                  value={editing.body || ''}
                  onChange={(e) => setEditing((p) => ({ ...p, body: e.target.value }))}
                  sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />
                <Typography sx={{ color: D.faint, fontSize: 10.5, mt: 0.4, textAlign: 'right', ...mono }}>
                  {(editing.body || '').length}
                  {editing.platform === 'instagram' ? ' / 2,200 (IG caption cap)' : ' chars'}
                </Typography>
              </Box>
              <TextField size="small" multiline minRows={2} label="Notes (hooks, visual direction, CTA…)"
                value={editing.notes || ''}
                onChange={(e) => setEditing((p) => ({ ...p, notes: e.target.value }))}
                sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />
              <Stack direction="row" gap={1}>
                <TextField size="small" fullWidth label="Tags (comma-separated)" value={editing.tags}
                  onChange={(e) => setEditing((p) => ({ ...p, tags: e.target.value }))}
                  sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />
                <TextField size="small" fullWidth label="Post URL (once live)" value={editing.postUrl || ''}
                  placeholder="https://…"
                  onChange={(e) => setEditing((p) => ({ ...p, postUrl: e.target.value }))}
                  sx={inkInput} InputLabelProps={{ sx: { color: D.muted } }} />
              </Stack>
              {/* Numbers for THIS post — the "open a post, see how it did" ask.
                  Read-only; the synced/logged series drives it. */}
              {editing._id && editing.status === 'posted' && (editing.stats || []).length > 0 && (() => {
                const s = editing.stats;
                const lastS = s[s.length - 1];
                const firstS = s[0];
                const grow = (k) => (Number(lastS[k]) || 0) - (Number(firstS[k]) || 0);
                return (
                  <Box sx={{ border: `1px solid ${D.line}`, borderRadius: 2.5, bgcolor: D.inset, p: 1.5 }}>
                    <Typography sx={{ ...eyebrow, display: 'block', mb: 0.75 }}>How this post is doing</Typography>
                    <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
                      <Typography sx={{ color: D.text, fontSize: 13, ...mono }}>
                        👁 {(Number(lastS.views) || 0).toLocaleString()} · ❤️ {(Number(lastS.likes) || 0).toLocaleString()} · 💬 {Number(lastS.comments) || 0} · ↗ {Number(lastS.shares) || 0}
                        {Number(lastS.views) > 0 && (
                          <Box component="span" sx={{ color: D.green, fontWeight: 800, ml: 0.75 }}>
                            {(((Number(lastS.likes) || 0) + (Number(lastS.comments) || 0)) / Number(lastS.views) * 100).toFixed(1)}% eng
                          </Box>
                        )}
                      </Typography>
                      <Sparkline stats={s} />
                    </Stack>
                    {s.length > 1 && (
                      <Typography sx={{ color: D.muted, fontSize: 11, mt: 0.5 }}>
                        since first check: +{grow('views').toLocaleString()} views · +{grow('likes')} likes · +{grow('comments')} comments
                        · {s.length} check-in{s.length === 1 ? '' : 's'} · last {fmtRelative(lastS.at)}
                      </Typography>
                    )}
                  </Box>
                );
              })()}
              {/* IG visual reference — a downscaled thumbnail, never a full-res file. */}
              <Stack direction="row" gap={1} alignItems="center">
                <input ref={fileRef} type="file" accept="image/*" hidden
                  onChange={async (e) => {
                    const f = e.target.files && e.target.files[0];
                    e.target.value = '';
                    if (!f) return;
                    try { const img = await readRefImage(f); setEditing((p) => ({ ...p, refImage: img })); }
                    catch (err) { toast(err.message, 'error'); }
                  }} />
                {editing.refImage ? (
                  <>
                    <Box component="img" src={editing.refImage} alt=""
                      onClick={() => fileRef.current?.click()}
                      sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 2, cursor: 'pointer',
                        border: `1px solid ${D.lineHi}` }} />
                    <Button size="small" onClick={() => setEditing((p) => ({ ...p, refImage: '' }))}
                      sx={{ color: D.muted, textTransform: 'none', fontSize: 11, '&:hover': { color: '#f87171' } }}>
                      Remove image
                    </Button>
                  </>
                ) : (
                  <Button size="small" startIcon={<ImageOutlinedIcon sx={{ fontSize: 15 }} />}
                    onClick={() => fileRef.current?.click()}
                    sx={{ ...dropGhostBtn, fontSize: 11.5, py: 0.5 }}>
                    Add a visual reference
                  </Button>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setEditing(null)} sx={{ ...dropGhostBtn }}>Cancel</Button>
              <Button onClick={saveEditor} disabled={busy} sx={{ ...dropPrimaryBtn }}>
                {busy ? <CircularProgress size={16} sx={{ color: D.ink }} /> : 'Save'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3200} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.sev} variant="filled" onClose={() => setSnack(null)}>{snack.msg}</Alert> : null}
      </Snackbar>
    </Box>
  );
}
