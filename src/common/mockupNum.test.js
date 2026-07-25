// The stored mockup number already carries its own '#', so every `#{mockupNum}`
// in JSX rendered '##000150A'. It was in eight places — including the approval
// page and both lookbook gallery views, i.e. the one identifier a client is ever
// supposed to see.

import { displayMockupNum, bareMockupNum, clientDesignName } from './mockupNum';

describe('displayMockupNum', () => {
  it('leaves an already-hashed number with exactly one hash', () => {
    expect(displayMockupNum('#000150A')).toBe('#000150A');
  });

  it('adds the hash when the value lacks one', () => {
    expect(displayMockupNum('000150A')).toBe('#000150A');
  });

  it('collapses a double hash — the actual bug', () => {
    expect(displayMockupNum('##000153B')).toBe('#000153B');
  });

  it('handles edit versions and multi-letter colourways', () => {
    expect(displayMockupNum('#000150A2')).toBe('#000150A2');
    expect(displayMockupNum('#000150AA')).toBe('#000150AA');
  });

  it('trims stray whitespace', () => {
    expect(displayMockupNum('  #000150A  ')).toBe('#000150A');
  });

  it('returns empty for empty input rather than a bare "#"', () => {
    // A lone '#' next to a design name reads as a bug to the client.
    expect(displayMockupNum('')).toBe('');
    expect(displayMockupNum(null)).toBe('');
    expect(displayMockupNum(undefined)).toBe('');
    expect(displayMockupNum('   ')).toBe('');
  });

  it('passes an external promo name through with a hash, not mangled', () => {
    expect(displayMockupNum('Plastic Grinder')).toBe('#Plastic Grinder');
  });

  it('is idempotent', () => {
    const once = displayMockupNum('000150A');
    expect(displayMockupNum(once)).toBe(once);
  });
});

describe('bareMockupNum', () => {
  it('strips the hash for filenames', () => {
    expect(bareMockupNum('#000150A')).toBe('000150A');
    expect(bareMockupNum('##000150A')).toBe('000150A');
    expect(bareMockupNum('000150A')).toBe('000150A');
  });

  it('is empty-safe', () => {
    expect(bareMockupNum('')).toBe('');
    expect(bareMockupNum(null)).toBe('');
  });

  it('round-trips with displayMockupNum', () => {
    expect(displayMockupNum(bareMockupNum('#000150A2'))).toBe('#000150A2');
  });
});

describe('clientDesignName', () => {
  it('strips the internal variation marker', () => {
    expect(clientDesignName('Happy Leaf Hoodie · v2')).toBe('Happy Leaf Hoodie');
    expect(clientDesignName('Happy Leaf Hoodie · v11')).toBe('Happy Leaf Hoodie');
  });

  it('leaves an ordinary design name alone', () => {
    expect(clientDesignName('Happy Leaf Hoodie')).toBe('Happy Leaf Hoodie');
  });

  it('only strips a TRAILING marker, never mid-name', () => {
    // A real design could legitimately be called this.
    expect(clientDesignName('v2 Collection Tee')).toBe('v2 Collection Tee');
    expect(clientDesignName('Tee · v2 Collection')).toBe('Tee · v2 Collection');
  });

  it('does not eat a version that is part of the design', () => {
    expect(clientDesignName('Series 5')).toBe('Series 5');
    expect(clientDesignName('Hoodie V')).toBe('Hoodie V');
  });

  it('tolerates spacing variants and trailing whitespace', () => {
    expect(clientDesignName('Hoodie ·v3')).toBe('Hoodie');
    expect(clientDesignName('Hoodie · v3   ')).toBe('Hoodie');
  });

  it('is empty-safe', () => {
    expect(clientDesignName('')).toBe('');
    expect(clientDesignName(null)).toBe('');
    expect(clientDesignName(undefined)).toBe('');
  });

  it('is idempotent', () => {
    const once = clientDesignName('Hoodie · v4');
    expect(clientDesignName(once)).toBe(once);
  });
});
