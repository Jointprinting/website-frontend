// src/screens/studio/_content.js
//
// Pure vocabulary + week/pace math for the Content planner (ContentTab).
// Kept out of the component so the streak/pace logic is unit-testable —
// mirrors the backend vocab in models/SocialPost.js.

export const PLATFORMS = [
  { key: 'linkedin',  label: 'LinkedIn',  short: 'in', color: '#0A66C2' },
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
  const counts = { linkedin: 0, instagram: 0 };
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
