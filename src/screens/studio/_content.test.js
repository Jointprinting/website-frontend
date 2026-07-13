// Pace/streak math for the Content planner — the fun parts must be honest.
// Instagram-only (owner decision); legacy platforms simply don't count.
import { weekStart, postedCountsForWeek, weekMet, streakWeeks } from './_content';

const posted = (platform, iso) => ({ platform, status: 'posted', postedAt: iso, archived: false });

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
