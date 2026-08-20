// src/screens/studio/_shared.dialogPaper.test.js
//
// The paper geometry for the two full-bleed builder dialogs (Quote,
// Confirmation), which both used to hardcode the same wrong numbers.
//
// At md the margin is 24px PER SIDE — 48px — but the width was
// `calc(100% - 24px)`. .MuiDialog-container centres its child, so a paper wider
// than its space overflows equally both ways and is clipped by the fixed
// positioned root: 12px cut off the left edge and 12px off the right, on every
// desktop screen. The same three properties also silently defeated fullScreen,
// because MUI injects .MuiDialog-paperFullScreen BEFORE the sx class, so sx wins.
// Run: CI=true npm test

import { builderDialogPaper, scrollbar } from './_shared';

describe('builderDialogPaper', () => {
  test('desktop width subtracts BOTH margins, so nothing is clipped', () => {
    const paper = builderDialogPaper(false);
    // m: 3 = 24px per side. The width must account for 48px, not 24px.
    expect(paper.m).toEqual({ xs: 1, md: 3 });
    expect(paper.width.md).toBe('calc(100% - 48px)');
  });

  test('phone width matches the phone margin too', () => {
    // m.xs = 1 = 8px per side = 16px.
    expect(builderDialogPaper(false).width.xs).toBe('calc(100% - 16px)');
  });

  test('fullScreen really is full screen — no margin, no width inset, no cap', () => {
    const paper = builderDialogPaper(true);
    expect(paper.m).toBe(0);
    expect(paper.width).toBe('100%');
    expect(paper.maxWidth).toBe('100%');
    expect(paper.maxHeight).toBe('100%');
    expect(paper.borderRadius).toBe(0);
  });

  test('fullScreen never carries the boxed-card properties that defeated it', () => {
    const paper = builderDialogPaper(true);
    // The bug was these surviving into the fullScreen case and beating MUI's own rule.
    expect(paper.width).not.toMatch(/calc/);
    expect(paper.maxHeight).not.toBe('94vh');
  });

  test('the windowed case keeps the 94vh cap and rounded corners', () => {
    const paper = builderDialogPaper(false);
    expect(paper.maxHeight).toBe('94vh');
    expect(paper.borderRadius).toBe(3);
  });
});

describe('scrollbar token', () => {
  test('sizes BOTH axes — width alone leaves a horizontal bar invisible', () => {
    const bar = scrollbar['&::-webkit-scrollbar'];
    expect(bar.width).toBe(5);
    expect(bar.height).toBe(5);
  });
});
