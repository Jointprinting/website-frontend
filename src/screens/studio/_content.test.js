// Pace/streak math for the Content planner — the fun parts must be honest.
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
  it('counts only live posts inside the week, per platform', () => {
    const posts = [
      posted('linkedin', '2026-07-07T10:00:00'),
      posted('instagram', '2026-07-08T10:00:00'),
      posted('linkedin', '2026-06-30T10:00:00'),                    // last week
      { ...posted('linkedin', '2026-07-07T10:00:00'), status: 'drafted' },  // pulled back — no longer live
      { ...posted('instagram', '2026-07-07T10:00:00'), archived: true },    // archived
    ];
    expect(postedCountsForWeek(posts, ws)).toEqual({ linkedin: 1, instagram: 1 });
  });
});

describe('weekMet', () => {
  it('requires every platform with a goal to hit it', () => {
    expect(weekMet({ linkedin: 1, instagram: 0 }, { linkedin: 1, instagram: 1 })).toBe(false);
    expect(weekMet({ linkedin: 1, instagram: 1 }, { linkedin: 1, instagram: 1 })).toBe(true);
    // a 0 goal is paused, not failing
    expect(weekMet({ linkedin: 2, instagram: 0 }, { linkedin: 1, instagram: 0 })).toBe(true);
  });
  it('an all-zero pace can never be met (no fake infinite streaks)', () => {
    expect(weekMet({ linkedin: 5, instagram: 5 }, { linkedin: 0, instagram: 0 })).toBe(false);
  });
});

describe('streakWeeks', () => {
  const now = new Date('2026-07-09T12:00:00');               // Thu of week Jul 6
  const pace = { linkedin: 1, instagram: 0 };
  it('an unfinished current week does not break a run built through last week', () => {
    const posts = [posted('linkedin', '2026-06-30T10:00:00'), posted('linkedin', '2026-06-23T10:00:00')];
    expect(streakWeeks(posts, pace, now)).toBe(2);
  });
  it('the current week joins the streak as soon as it is met', () => {
    const posts = [posted('linkedin', '2026-07-07T10:00:00'), posted('linkedin', '2026-06-30T10:00:00')];
    expect(streakWeeks(posts, pace, now)).toBe(2);
  });
  it('a gap resets the streak', () => {
    const posts = [posted('linkedin', '2026-07-07T10:00:00'), posted('linkedin', '2026-06-16T10:00:00')];
    expect(streakWeeks(posts, pace, now)).toBe(1);
  });
  it('no posts, no streak', () => {
    expect(streakWeeks([], pace, now)).toBe(0);
  });
});
