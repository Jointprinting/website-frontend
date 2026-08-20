// SYNC GUARD: mirrors website-backend/utils/__tests__/colorSplit.test.js case for
// case. The client quotes the live price from these rules and the server
// re-derives it on submit — a divergence quotes a number we don't honour.
import { splitTotal, orderedQty, tierLineFor, minRunFor, validateSplit, validateQty, runKey, runLines, splitGroupByRun } from './colorSplit';

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

// ── A FREE QUANTITY on a run that is not sold by colour ──────────────────────
//
// The owner's first complaint about the quoter, verbatim: "when I show tiers 50
// 100 150 and they only need 75 units (at 50 unit cost) they can't select that
// ... I don't want them to have to ask me to make the change, it adds friction."
//
// The engine that solves it already existed and was already proven by the colour
// split — it was simply unreachable unless the line carried a live S&S colour
// lookup. These pin the colour-less path.
describe('validateQty — a typed quantity on a tiered run', () => {
  const TIERS = [{ qty: 50, unitPrice: 12 }, { qty: 100, unitPrice: 10 }, { qty: 150, unitPrice: 9 }];

  test('75 on a 50/100/150 quote is a valid order', () => {
    expect(validateQty(75, TIERS)).toEqual({ ok: true, qty: 75, message: '' });
  });

  test('and it bills at the 50-piece price — the largest break at or below it', () => {
    expect(tierLineFor(TIERS, 75).qty).toBe(50);
    expect(tierLineFor(TIERS, 75).unitPrice).toBe(12);
  });

  test('landing exactly on a break takes that break, not the one under it', () => {
    expect(tierLineFor(TIERS, 100).qty).toBe(100);
  });

  test('above the largest break it stays on the largest — no ceiling', () => {
    // Quoting past the top break is the owner's problem to price, not the
    // client's to be blocked on.
    expect(validateQty(500, TIERS).ok).toBe(true);
    expect(tierLineFor(TIERS, 500).qty).toBe(150);
  });

  test('below the MOQ it says how many more, never a bare rejection', () => {
    const r = validateQty(20, TIERS);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('50 pieces');
    expect(r.message).toContain('30 more');
  });

  test('junk and fractions are refused in the client\'s own language', () => {
    expect(validateQty('', TIERS).ok).toBe(false);
    expect(validateQty(0, TIERS).ok).toBe(false);
    expect(validateQty(-5, TIERS).ok).toBe(false);
    expect(validateQty('abc', TIERS).ok).toBe(false);
    expect(validateQty(75.5, TIERS).message).toContain('whole number');
  });
});

describe('orderedQty with a typed quantity', () => {
  test('bills what they ordered, not the tier the line priced at', () => {
    // This is the whole point: the line sits on the 50 break, the client bought
    // 75, and the money math has to say 75.
    expect(orderedQty({ qty: 50, pickedQty: 75 })).toBe(75);
  });

  test('a line with no typed quantity is unchanged', () => {
    expect(orderedQty({ qty: 50 })).toBe(50);
    expect(orderedQty({ qty: 50, pickedQty: 0 })).toBe(50);
  });

  test('a colour split still wins — the two are never both set', () => {
    expect(orderedQty({ qty: 50, pickedQty: 75, colorSplit: [{ name: 'Black', qty: 200 }] })).toBe(200);
  });
});

// ── A group holding BOTH a colour run and ordinary options ───────────────────
//
// The approval page used to render the colour run and stop, so every option in
// that group WITHOUT colours was invisible to the client: the owner pitched two
// options and the client saw one. The server would have accepted a pick for the
// hidden option all along — it simply never appeared on the page to be picked.
describe('splitGroupByRun', () => {
  const COLOUR_TIERS = [
    { idx: 0, group: 'Hats', styleCode: 'C112', description: 'Trucker', printDetails: '1c front', qty: 50,  unitPrice: 14,
      colorOptions: [{ name: 'Black' }, { name: 'Charcoal' }] },
    { idx: 1, group: 'Hats', styleCode: 'C112', description: 'Trucker', printDetails: '1c front', qty: 150, unitPrice: 11,
      colorOptions: [{ name: 'Black' }, { name: 'Charcoal' }] },
  ];
  const PLAIN = [
    { idx: 2, group: 'Hats', styleCode: '', description: 'Embroidered beanie', printDetails: 'embroidery', qty: 50, unitPrice: 18 },
    { idx: 3, group: 'Hats', styleCode: '', description: 'Embroidered beanie', printDetails: 'embroidery', qty: 100, unitPrice: 15 },
  ];

  test('the colour run takes its own tiers and leaves the rest of the group alone', () => {
    const { run, rest } = splitGroupByRun([...COLOUR_TIERS, ...PLAIN]);
    expect(run.tiers.map(t => t.idx)).toEqual([0, 1]);
    expect(rest.map(l => l.idx)).toEqual([2, 3]);
  });

  test('the beanie is not swallowed by the trucker run — different runKey', () => {
    // This is the regression: `rest` empty here meant the client never saw the
    // beanie at all.
    const { rest } = splitGroupByRun([...COLOUR_TIERS, ...PLAIN]);
    expect(rest.length).toBeGreaterThan(0);
  });

  test('a group with no colours anywhere is entirely "rest" — unchanged behaviour', () => {
    const { run, rest } = splitGroupByRun(PLAIN);
    expect(run).toBeNull();
    expect(rest).toEqual(PLAIN);
  });

  test('a pure colour group leaves nothing behind, so no "or" divider appears', () => {
    const { run, rest } = splitGroupByRun(COLOUR_TIERS);
    expect(run.tiers.map(t => t.idx)).toEqual([0, 1]);
    expect(rest).toEqual([]);
  });

  test('tiers come back smallest first, whatever order they were built in', () => {
    const { run } = splitGroupByRun([COLOUR_TIERS[1], COLOUR_TIERS[0]]);
    expect(run.tiers.map(t => t.qty)).toEqual([50, 150]);
  });

  test('a second colour run in the same group stays visible as "rest"', () => {
    // Two different inks can never combine, so the second one is a separate
    // choice — and must not vanish just because the first one claimed the slot.
    const otherInk = { idx: 4, group: 'Hats', styleCode: 'C112', description: 'Trucker',
      printDetails: 'white ink', qty: 50, unitPrice: 15, colorOptions: [{ name: 'Black' }] };
    const { run, rest } = splitGroupByRun([...COLOUR_TIERS, otherInk]);
    expect(run.tiers.map(t => t.idx)).toEqual([0, 1]);
    expect(rest.map(l => l.idx)).toEqual([4]);
  });

  test('junk is safe', () => {
    expect(splitGroupByRun(null)).toEqual({ run: null, rest: [] });
    expect(splitGroupByRun([null, undefined])).toEqual({ run: null, rest: [] });
  });
});
