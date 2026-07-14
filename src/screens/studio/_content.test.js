// Pace/streak math for the Content planner — the fun parts must be honest.
// Instagram-only (owner decision); legacy platforms simply don't count.
import {
  weekStart, postedCountsForWeek, weekMet, streakWeeks,
  rollupPostedStats, followerDelta, bestPostingDay, topTagByViews,
} from './_content';

const posted = (platform, iso) => ({ platform, status: 'posted', postedAt: iso, archived: false });

// A posted card with a stat series (last snapshot is what rollups read).
const statPost = (over = {}) => ({
  platform: 'instagram', status: 'posted', archived: false, postedAt: '2026-07-01T12:00:00Z',
  stats: [{ at: '2026-07-02', views: 100, likes: 10, comments: 2, shares: 0 }],
  tags: [],
  ...over,
});

describe('rollupPostedStats', () => {
  it('sums latest snapshots and finds the best post', () => {
    const a = statPost({ title: 'small' });
    const b = statPost({ title: 'big', stats: [{ at: '2026-07-02', views: 900, likes: 90, comments: 9 }] });
    const roll = rollupPostedStats([a, b, { status: 'idea' }, statPost({ archived: true })]);
    expect(roll.count).toBe(2);
    expect(roll.views).toBe(1000);
    expect(roll.likes).toBe(100);
    expect(roll.best.title).toBe('big');
    expect(roll.avgEng).toBeCloseTo(11.5, 1);   // (12% + 11%) / 2
  });
  it('empty in, zeros out', () => {
    expect(rollupPostedStats([]).count).toBe(0);
    expect(rollupPostedStats(null).count).toBe(0);
  });
});

describe('followerDelta', () => {
  const now = new Date('2026-07-14T00:00:00Z');
  it('diffs latest against the last point at/before the cutoff', () => {
    const hist = [
      { at: '2026-06-01', followers: 100 },
      { at: '2026-06-13', followers: 120 },
      { at: '2026-07-13', followers: 180 },
    ];
    expect(followerDelta(hist, 30, now)).toBe(60);   // vs Jun 13 (≤ Jun 14 cutoff)
  });
  it('falls back to the earliest point for short histories', () => {
    expect(followerDelta([{ at: '2026-07-10', followers: 100 }, { at: '2026-07-13', followers: 130 }], 30, now)).toBe(30);
  });
  it('zero when empty or single-point', () => {
    expect(followerDelta([], 30, now)).toBe(0);
    expect(followerDelta([{ at: '2026-07-13', followers: 50 }], 30, now)).toBe(0);
  });
});

describe('bestPostingDay', () => {
  it('null until there is enough signal', () => {
    expect(bestPostingDay([statPost(), statPost()])).toBeNull();
  });
  it('picks the weekday with the best avg engagement', () => {
    // Wednesdays engage 20%, Fridays 5% — five posts total, two distinct days.
    const wed = (n) => statPost({ postedAt: '2026-07-01T12:00:00Z', stats: [{ at: 'x', views: 100, likes: 20 * n ? 20 : 20, comments: 0 }] });
    const fri = () => statPost({ postedAt: '2026-07-03T12:00:00Z', stats: [{ at: 'x', views: 100, likes: 5, comments: 0 }] });
    const out = bestPostingDay([wed(1), wed(1), wed(1), fri(), fri()]);
    expect(out.day).toBe('Wednesday');
    expect(out.eng).toBeCloseTo(20, 0);
  });
});

describe('topTagByViews', () => {
  it('null until ≥2 tags each cover ≥2 posts', () => {
    expect(topTagByViews([statPost({ tags: ['drop'] })])).toBeNull();
  });
  it('ranks tags by average views', () => {
    const mk = (tag, views) => statPost({ tags: [tag], stats: [{ at: 'x', views, likes: 0, comments: 0 }] });
    const out = topTagByViews([mk('drop', 500), mk('drop', 700), mk('meme', 100), mk('meme', 120)]);
    expect(out.tag).toBe('drop');
    expect(out.avgViews).toBe(600);
  });
});

describe('weekStart', () => {
  it('lands on Monday 00:00 local', () => {
    const ws = weekStart(new Date('2026-07-09T15:30:00'));   // a Thursday
    expect(ws.getDay()).toBe(1);
    expect(ws.getHours()).toBe(0);
    expect(ws.getDate()).toBe(6);                            // Mon Jul 6, 2026
  });
  it('a Monday is its own week start', () => {
    const ws = weekStart(new Date('2026-07-06T00:00:00'));
    expect(ws.getDate()).toBe(6);
  });
});

describe('postedCountsForWeek', () => {
  const ws = weekStart(new Date('2026-07-09T12:00:00'));
  it('counts only live IG posts inside the week', () => {
    const posts = [
      posted('instagram', '2026-07-08T10:00:00'),
      posted('instagram', '2026-06-30T10:00:00'),                    // last week
      { ...posted('instagram', '2026-07-07T10:00:00'), status: 'drafted' },  // pulled back — no longer live
      { ...posted('instagram', '2026-07-07T10:00:00'), archived: true },     // archived
      posted('linkedin', '2026-07-07T10:00:00'),                     // legacy platform — not counted
    ];
    expect(postedCountsForWeek(posts, ws)).toEqual({ instagram: 1 });
  });
});

describe('weekMet', () => {
  it('requires the IG goal to be hit', () => {
    expect(weekMet({ instagram: 0 }, { instagram: 1 })).toBe(false);
    expect(weekMet({ instagram: 1 }, { instagram: 1 })).toBe(true);
    expect(weekMet({ instagram: 3 }, { instagram: 2 })).toBe(true);
  });
  it('a zero pace can never be met (no fake infinite streaks)', () => {
    expect(weekMet({ instagram: 5 }, { instagram: 0 })).toBe(false);
  });
  it('a stale linkedin goal in a stored pace is ignored', () => {
    expect(weekMet({ instagram: 1 }, { instagram: 1, linkedin: 3 })).toBe(true);
  });
});

describe('streakWeeks', () => {
  const now = new Date('2026-07-09T12:00:00');               // Thu of week Jul 6
  const pace = { instagram: 1 };
  it('an unfinished current week does not break a run built through last week', () => {
    const posts = [posted('instagram', '2026-06-30T10:00:00'), posted('instagram', '2026-06-23T10:00:00')];
    expect(streakWeeks(posts, pace, now)).toBe(2);
  });
  it('the current week joins the streak as soon as it is met', () => {
    const posts = [posted('instagram', '2026-07-07T10:00:00'), posted('instagram', '2026-06-30T10:00:00')];
    expect(streakWeeks(posts, pace, now)).toBe(2);
  });
  it('a gap resets the streak', () => {
    const posts = [posted('instagram', '2026-07-07T10:00:00'), posted('instagram', '2026-06-16T10:00:00')];
    expect(streakWeeks(posts, pace, now)).toBe(1);
  });
  it('no posts, no streak', () => {
    expect(streakWeeks([], pace, now)).toBe(0);
  });
});
