// The shade lane is a money edge: dark adds a white underbase (an extra colour
// AND an extra screen per location), so a wrong guess here misprices a job.
import { garmentShade, shadeChangeFor } from './garmentShade';

describe('garmentShade', () => {
  it('reads the everyday garment colours', () => {
    expect(garmentShade('Black')).toBe('dark');
    expect(garmentShade('White')).toBe('light');
    expect(garmentShade('Navy')).toBe('dark');
    expect(garmentShade('Natural')).toBe('light');
  });
  it('ignores case and padding', () => {
    expect(garmentShade('  BLACK ')).toBe('dark');
    expect(garmentShade('white')).toBe('light');
  });
  it('handles S&S-style compound names', () => {
    expect(garmentShade('Sport Grey')).toBe('light');
    expect(garmentShade('Dark Heather')).toBe('dark');
    expect(garmentShade('Heather Navy')).toBe('dark');
  });
  it('resolves a name containing BOTH families on the more specific word', () => {
    // "light blue" contains "blue" (dark) but is a light garment.
    expect(garmentShade('Light Blue')).toBe('light');
    expect(garmentShade('Blue')).toBe('dark');
  });
  it('returns null for anything it does not actually know', () => {
    // The caller then KEEPS the shade it had — a guess would silently reprice.
    expect(garmentShade('Chartreuse')).toBeNull();
    expect(garmentShade('')).toBeNull();
    expect(garmentShade(null)).toBeNull();
    expect(garmentShade(undefined)).toBeNull();
  });
});

describe('shadeChangeFor', () => {
  it('reports the new lane only when it genuinely differs', () => {
    expect(shadeChangeFor('Black', 'light')).toBe('dark');
    expect(shadeChangeFor('White', 'dark')).toBe('light');
    expect(shadeChangeFor('Black', 'dark')).toBeNull();
  });
  it('leaves an unknown colour alone', () => {
    expect(shadeChangeFor('Chartreuse', 'light')).toBeNull();
  });
  it('never overrides a deliberately picked white-ink-only DTG lane', () => {
    expect(shadeChangeFor('Black', 'whiteInkOnly')).toBeNull();
    expect(shadeChangeFor('White', 'whiteInkOnly')).toBeNull();
  });
});
