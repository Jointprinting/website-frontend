// SYNC GUARD: mirrors website-backend/utils/__tests__/colorSplit.test.js case for
// case. The client quotes the live price from these rules and the server
// re-derives it on submit — a divergence quotes a number we don't honour.
import { splitTotal, orderedQty, tierLineFor, minRunFor, validateSplit, runKey, runLines } from './colorSplit';

const RUN = [
  { group: 'Tees', lid: 'a', styleCode: 'G500', description: 'Heavy Tee', printDetails: 'black ink', qty: 50, unitPrice: 12 },
  { group: 'Tees', lid: 'b', styleCode: 'G500', description: 'Heavy Tee', printDetails: 'black ink', qty: 150, unitPrice: 9 },
  { group: 'Tees', lid: 'c', styleCode: 'G500', description: 'Heavy Tee', printDetails: 'black ink', qty: 300, unitPrice: 8 },
];
const OFFERED = [
  { name: 'Maroon', code: 'MAR', hex: '#7b1f2b' },
  { name: 'White', code: 'WHT', hex: '#ffffff' },
  { name: 'Sand', code: 'SND', hex: '#d8cbb4' },
];

it("the owner's example: 75 maroon + 75 white on one ink buys the 150 tier", () => {
  const r = validateSplit(OFFERED, [{ name: 'Maroon', qty: 75 }, { name: 'White', qty: 75 }], RUN);
  expect(r.ok).toBe(true);
  expect(r.total).toBe(150);
  expect(tierLineFor(RUN, r.total).unitPrice).toBe(9);
});

it('three colours at 150 each is 450 units — the case chips could never express', () => {
  const r = validateSplit(OFFERED, [{ name: 'Maroon', qty: 150 }, { name: 'White', qty: 150 }, { name: 'Sand', qty: 150 }], RUN);
  expect(r.total).toBe(450);
  expect(tierLineFor(RUN, 450).qty).toBe(300);
});

it('a total between breaks pays the lower break', () => {
  expect(tierLineFor(RUN, 175).qty).toBe(150);
  expect(tierLineFor(RUN, 299).qty).toBe(150);
  expect(tierLineFor(RUN, 300).qty).toBe(300);
});

it('below the smallest run there is no tier — say the minimum', () => {
  expect(tierLineFor(RUN, 20)).toBeNull();
  expect(minRunFor(RUN)).toBe(50);
  const r = validateSplit(OFFERED, [{ name: 'Maroon', qty: 20 }], RUN);
  expect(r.ok).toBe(false);
  expect(r.message).toMatch(/runs from 50 pieces/);
  expect(r.message).toMatch(/Add 30 more/);
});

it('ordered quantity is the split total, so 450 off the 300 tier bills 450', () => {
  expect(orderedQty({ qty: 300, colorSplit: [{ name: 'Maroon', qty: 150 }, { name: 'White', qty: 300 }] })).toBe(450);
  expect(orderedQty({ qty: 150 })).toBe(150);
  expect(orderedQty({ qty: 150, colorSplit: [] })).toBe(150);
  expect(orderedQty(null)).toBe(0);
});

it('a colour nobody offered is refused', () => {
  const r = validateSplit(OFFERED, [{ name: 'Kiwi', qty: 100 }], RUN);
  expect(r.ok).toBe(false);
  expect(r.message).toMatch(/don't have "Kiwi"/);
});

it('names snap to the owner spelling, codes work as the id, swatch comes from the offer', () => {
  const r = validateSplit(OFFERED, [{ name: '  maROON ', qty: 60 }, { code: 'wht', qty: 90 }], RUN);
  expect(r.ok).toBe(true);
  expect(r.split.map((c) => c.name)).toEqual(['Maroon', 'White']);
  expect(r.split[0].hex).toBe('#7b1f2b');
});

it('zero-quantity colours drop out', () => {
  const r = validateSplit(OFFERED, [{ name: 'Maroon', qty: 150 }, { name: 'Sand', qty: 0 }], RUN);
  expect(r.total).toBe(150);
  expect(r.split.map((c) => c.name)).toEqual(['Maroon']);
});

it('one colour listed twice is refused rather than silently summed', () => {
  expect(validateSplit(OFFERED, [{ name: 'Maroon', qty: 75 }, { name: 'maroon', qty: 75 }], RUN).message).toMatch(/listed twice/);
});

it('an empty or all-zero allocation asks for quantities', () => {
  expect(validateSplit(OFFERED, [], RUN).message).toMatch(/how many of each/);
  expect(validateSplit(OFFERED, [{ name: 'Maroon', qty: 0 }], RUN).message).toMatch(/how many of each/);
});

it('different ink is a different run — never a shared tier table', () => {
  const whiteInk = { group: 'Tees', styleCode: 'G500', description: 'Heavy Tee', printDetails: 'white ink', qty: 50 };
  expect(runKey(RUN[0])).not.toBe(runKey(whiteInk));
  expect(runLines([...RUN, whiteInk], RUN[0])).toHaveLength(3);
  expect(runLines([...RUN, whiteInk], whiteInk)).toHaveLength(1);
});

it('a run in another group never merges', () => {
  expect(runLines([...RUN, { ...RUN[0], group: 'Second design' }], RUN[0])).toHaveLength(3);
});

it('junk is safe', () => {
  expect(splitTotal(null)).toBe(0);
  expect(splitTotal([{ qty: 'x' }, { qty: -5 }])).toBe(0);
  expect(tierLineFor([], 100)).toBeNull();
  expect(minRunFor(null)).toBe(0);
  expect(validateSplit(null, null, null).ok).toBe(false);
});
