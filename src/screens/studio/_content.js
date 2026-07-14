// src/screens/studio/_content.js
//
// Pure vocabulary + week/pace math for the Content planner (ContentTab).
// Kept out of the component so the streak/pace logic is unit-testable —
// mirrors the backend vocab in models/SocialPost.js.

// Instagram-only by owner decision — LinkedIn was dropped (never used, and a
// pace goal demanding LinkedIn made "week crushed" unreachable). Legacy
// linkedin posts still load; they just aren't a planning target anymore.
export const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', short: 'IG', color: '#d6338f' },
];

// Mirrors backend POST_STATUSES (models/SocialPost.js) + display styling.
export const POST_STATUSES = [
  { key: 'idea',      label: 'Ideas',     emoji: '💡', color: '#a78bfa' },
  { key: 'drafted',   label: 'Drafts',    emoji: '✍️', color: '#60a5fa' },
  { key: 'scheduled', label: 'Scheduled', emoji: '📅', color: '#fbbf24' },
  { key: 'posted',    label: 'Posted',    emoji: '🚀', color: '#4ade80' },
];

const DAY = 24 * 60 * 60 * 1000;

// Monday 00:00 LOCAL time of the week containing `d` — the pace week. Local
// on purpose: "did I post this week" is a question about the owner's week,
// not UTC's.
export function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;           // Mon=0 … Sun=6
  return new Date(x.getTime() - dow * DAY);
}

export function weekLabel(ws) {
  return `Week of ${new Date(ws).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// How many posts went LIVE per platform inside the week starting at `ws`.
// Counts by postedAt (status must be posted — a re-drafted post keeps its
// old stamp but stops counting).
export function postedCountsForWeek(posts, ws) {
  const from = new Date(ws).getTime();
  const to = from + 7 * DAY;
  const counts = { instagram: 0 };
  (posts || []).forEach((p) => {
    if (!p || p.archived || p.status !== 'posted' || !p.postedAt) return;
    const t = new Date(p.postedAt).getTime();
    if (t >= from && t < to && counts[p.platform] !== undefined) counts[p.platform] += 1;
  });
  return counts;
}

// A week is "met" when every platform with a goal > 0 hit its number. A pace
// of all zeros is paused — never "met", so it can't fake an infinite streak.
export function weekMet(counts, pace) {
  const goals = PLATFORMS.map((pl) => Number((pace || {})[pl.key]) || 0);
  if (!goals.some((g) => g > 0)) return false;
  return PLATFORMS.every((pl, i) => goals[i] === 0 || (counts[pl.key] || 0) >= goals[i]);
}

// ── Posted-stats rollups (the tab's insights strip) ──────────────────────────
// All PURE over the already-loaded posts — every posted card carries its
// append-only stats series, so no rollup endpoint is needed.

const lastSnap = (p) => (p && Array.isArray(p.stats) && p.stats.length ? p.stats[p.stats.length - 1] : null);

// Live posted cards that have at least one logged/synced snapshot.
export function postedWithStats(posts) {
  return (posts || []).filter((p) => p && !p.archived && p.status === 'posted' && lastSnap(p));
}

// Totals + averages across posted cards' LATEST snapshots, plus the best post
// by views. Engagement = (likes + comments) / views.
export function rollupPostedStats(posts) {
  const rows = postedWithStats(posts);
  const sum = { views: 0, likes: 0, comments: 0 };
  let best = null;
  const engs = [];
  for (const p of rows) {
    const s = lastSnap(p);
    sum.views += Number(s.views) || 0;
    sum.likes += Number(s.likes) || 0;
    sum.comments += Number(s.comments) || 0;
    if (Number(s.views) > 0) engs.push(((Number(s.likes) || 0) + (Number(s.comments) || 0)) / Number(s.views));
    if (!best || (Number(s.views) || 0) > (Number((lastSnap(best) || {}).views) || 0)) best = p;
  }
  const avgEng = engs.length ? (engs.reduce((a, b) => a + b, 0) / engs.length) * 100 : 0;
  return { count: rows.length, ...sum, avgEng: Math.round(avgEng * 10) / 10, best };
}

// Follower change over the trailing N days from the account's daily history.
export function followerDelta(history, days, now = new Date()) {
  const rows = Array.isArray(history) ? history : [];
  if (rows.length < 2) return 0;
  const cutoff = now.getTime() - days * DAY;
  const pastRows = rows.filter((h) => new Date(h.at).getTime() <= cutoff);
  const past = pastRows.length ? pastRows[pastRows.length - 1] : rows[0];
  const latest = rows[rows.length - 1];
  return (Number(latest.followers) || 0) - (Number(past.followers) || 0);
}

// Which weekday performs best — avg engagement of posts that went live that
// day. null until ≥minPosts posted-with-stats posts across ≥2 distinct days
// (a hint from 3 posts is noise, not insight).
export function bestPostingDay(posts, minPosts = 5) {
  const rows = postedWithStats(posts).filter((p) => p.postedAt);
  if (rows.length < minPosts) return null;
  const byDay = new Map();
  for (const p of rows) {
    const s = lastSnap(p);
    const v = Number(s.views) || 0;
    if (!v) continue;
    const eng = ((Number(s.likes) || 0) + (Number(s.comments) || 0)) / v;
    const day = new Date(p.postedAt).toLocaleDateString('en-US', { weekday: 'long' });
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(eng);
  }
  if (byDay.size < 2) return null;
  let bestDay = null; let bestEng = -1;
  for (const [day, list] of byDay) {
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    if (avg > bestEng) { bestEng = avg; bestDay = day; }
  }
  return bestDay ? { day: bestDay, eng: Math.round(bestEng * 1000) / 10 } : null;
}

// The tag whose posts average the most views — turns tags into a strategy
// signal. null until ≥2 tags each cover ≥2 posted-with-stats posts.
export function topTagByViews(posts) {
  const rows = postedWithStats(posts);
  const byTag = new Map();
  for (const p of rows) {
    const s = lastSnap(p);
    for (const t of p.tags || []) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(Number(s.views) || 0);
    }
  }
  const qual = [...byTag.entries()].filter(([, v]) => v.length >= 2);
  if (qual.length < 2) return null;
  let best = null;
  for (const [tag, list] of qual) {
    const avgViews = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
    if (!best || avgViews > best.avgViews) best = { tag, avgViews };
  }
  return best;
}

// Consecutive met weeks ending "now": the current week counts as soon as it's
// met; an unfinished current week doesn't break a run built through last week.
// Bounded walk (10 years) so a weird pace object can never loop forever.
export function streakWeeks(posts, pace, now = new Date()) {
  let ws = weekStart(now);
  let streak = 0;
  if (weekMet(postedCountsForWeek(posts, ws), pace)) streak += 1;
  for (let i = 0; i < 520; i++) {
    ws = new Date(ws.getTime() - 7 * DAY);
    if (!weekMet(postedCountsForWeek(posts, ws), pace)) break;
    streak += 1;
  }
  return streak;
}
