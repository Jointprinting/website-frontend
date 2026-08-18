// SYNC GUARD: mirrors website-backend/utils/__tests__/printLocations.test.js.
import { realLocations, methodsOf, summarizeType, summarizeDetails, flatFieldsFor, nextPlacement } from './_printLocations';

const MIXED = [
  { location: 'Front', method: 'Screen Print', details: '3 color' },
  { location: 'Back', method: 'DTG', details: '12x16' },
];

it('a screen front and a DTG back describe themselves in one line', () => {
  expect(flatFieldsFor(MIXED)).toEqual({
    printType: 'Screen Print + DTG',
    printDetails: 'Front: Screen Print 3 color · Back: DTG 12x16',
  });
});

it('one method reads exactly as the single field always did', () => {
  expect(summarizeType([{ location: 'Front', method: 'Screen Print', details: '3 color' }])).toBe('Screen Print');
});

it('a method used twice is named once', () => {
  expect(methodsOf([
    { location: 'Front', method: 'Screen Print' },
    { location: 'Back', method: 'screen print' },
    { location: 'Sleeve', method: 'Embroidery' },
  ])).toEqual(['Screen Print', 'Embroidery']);
});

it('three placements all survive into the detail', () => {
  expect(summarizeDetails([
    { location: 'Front', method: 'Screen Print', details: '3 color' },
    { location: 'Back', method: 'Screen Print', details: '1 color' },
    { location: 'Left sleeve', method: 'Embroidery', details: '8,000 stitches' },
  ])).toBe('Front: Screen Print 3 color · Back: Screen Print 1 color · Left sleeve: Embroidery 8,000 stitches');
});

it('an empty row changes nothing, and no locations leaves hand-typed fields alone', () => {
  expect(flatFieldsFor([{ location: '', method: '', details: '' }])).toEqual({});
  expect(flatFieldsFor([])).toEqual({});
  expect(flatFieldsFor(null)).toEqual({});
  expect(realLocations([{ location: '  ', method: '' }])).toEqual([]);
});

it('partial rows still say what they can', () => {
  expect(summarizeDetails([{ location: 'Front' }])).toBe('Front');
  expect(summarizeDetails([{ method: 'DTG', details: '12x16' }])).toBe('DTG 12x16');
  expect(summarizeType([{ location: 'Front' }])).toBe('');
});

it('the next placement skips what is already used', () => {
  expect(nextPlacement([])).toBe('Front');
  expect(nextPlacement([{ location: 'Front', method: 'Screen Print' }])).toBe('Back');
  expect(nextPlacement(MIXED)).toBe('Left sleeve');
});

it('junk never throws', () => {
  expect(methodsOf(null)).toEqual([]);
  expect(summarizeType(null)).toBe('');
  expect(realLocations([null, undefined])).toEqual([]);
});
