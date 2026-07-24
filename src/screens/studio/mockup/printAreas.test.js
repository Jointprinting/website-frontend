// Stage geometry — the one definition the interactive canvas, the headless
// flatten, the editor preview and the print-area guide all share.
//
// The bug these pin: MockupCanvas used fabric's canvas.centerObject(), whose
// getCenter() reads the PHYSICAL canvas size. We shrink that canvas to fit a
// phone (setDimensions + setZoom) while object coordinates stay in un-zoomed
// logical space — so the blank landed at 310×scale instead of 310, i.e. left of
// centre on every phone, and out of register with the print-area guide.

import { blankBox, centerInStage, printAreaRect, STAGE_W, STAGE_H, BLANK_FIT } from './printAreas';

describe('blankBox', () => {
  it('centres the blank in the logical stage', () => {
    const box = blankBox(1000, 1000);
    expect(box.originX).toBeCloseTo((STAGE_W - box.dispW) / 2, 6);
    expect(box.originY).toBeCloseTo((STAGE_H - box.dispH) / 2, 6);
    // Left and right gutters are equal — the thing that visibly broke.
    expect(box.originX).toBeCloseTo(STAGE_W - box.dispW - box.originX, 6);
  });

  it('fits to the tighter axis at the legacy 0.93 factor', () => {
    const wide = blankBox(2000, 500);          // width-bound
    expect(wide.scale).toBeCloseTo((STAGE_W / 2000) * BLANK_FIT, 6);
    const tall = blankBox(500, 2000);          // height-bound
    expect(tall.scale).toBeCloseTo((STAGE_H / 2000) * BLANK_FIT, 6);
    // Never overflows the stage.
    for (const b of [wide, tall]) {
      expect(b.dispW).toBeLessThanOrEqual(STAGE_W);
      expect(b.dispH).toBeLessThanOrEqual(STAGE_H);
      expect(b.originX).toBeGreaterThanOrEqual(0);
      expect(b.originY).toBeGreaterThanOrEqual(0);
    }
  });

  it('is independent of the on-screen canvas scale', () => {
    // The canvas is shrunk on mobile, but the logical box must not move — this
    // is precisely what canvas.centerObject() got wrong.
    const desktop = blankBox(1200, 1600, STAGE_W, STAGE_H);
    const phone = blankBox(1200, 1600, STAGE_W, STAGE_H);
    expect(phone).toEqual(desktop);
    // And a real shrunk canvas (0.55×) must NOT be passed as the stage: if it
    // were, the origin would collapse toward the left. Guard the distinction.
    const wrong = blankBox(1200, 1600, STAGE_W * 0.55, STAGE_H * 0.55);
    expect(wrong.originX).toBeLessThan(desktop.originX);
  });

  it('survives a missing or zero-size image without NaN', () => {
    const box = blankBox(0, 0);
    expect(Number.isFinite(box.originX)).toBe(true);
    expect(Number.isFinite(box.originY)).toBe(true);
    expect(Number.isFinite(box.scale)).toBe(true);
  });
});

describe('centerInStage', () => {
  it('centres an already-scaled box', () => {
    expect(centerInStage(100, 50)).toEqual({
      left: (STAGE_W - 100) / 2,
      top: (STAGE_H - 50) / 2,
    });
  });

  it('agrees with blankBox for the same box', () => {
    const box = blankBox(900, 1200);
    const c = centerInStage(box.dispW, box.dispH);
    expect(c.left).toBeCloseTo(box.originX, 6);
    expect(c.top).toBeCloseTo(box.originY, 6);
  });
});

describe('print-area guide registration', () => {
  it('sits inside the blank, not the raw stage', () => {
    // The guide is derived from the same box the blank is drawn at, so the two
    // stay in register at any canvas size.
    const box = blankBox(1200, 1600);
    const rect = printAreaRect('tshirt', 'front', box);
    expect(rect.left).toBeGreaterThanOrEqual(box.originX);
    expect(rect.top).toBeGreaterThanOrEqual(box.originY);
    expect(rect.left + rect.width).toBeLessThanOrEqual(box.originX + box.dispW + 0.001);
    expect(rect.top + rect.height).toBeLessThanOrEqual(box.originY + box.dispH + 0.001);
  });
});
