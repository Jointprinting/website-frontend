// src/common/mockupNum.js
//
// Display a mockup number with exactly one leading '#'.
//
// The stored value already carries its own hash — the server's formatMockupNum
// returns '#000150A' — so every `#{mockupNum}` in JSX rendered '##000150A'. It
// was in eight places, three of them client-facing (the approval page and both
// lookbook gallery views), which is the one identifier ECOSYSTEM.md says a client
// should ever see.
//
// Lives in common/ rather than screens/studio/ because the public approval and
// lookbook screens need it too, and the marketing site and the Studio are kept
// separate. Pure and dependency-free.

// '#000150A' → '#000150A' · '000150A' → '#000150A' · '' → ''
export function displayMockupNum(num) {
  const s = String(num == null ? '' : num).trim();
  if (!s) return '';
  return `#${s.replace(/^#+/, '')}`;
}

// The bare number, no hash — for filenames and anywhere the '#' is supplied by
// surrounding text. '#000150A' → '000150A'.
export function bareMockupNum(num) {
  return String(num == null ? '' : num).trim().replace(/^#+/, '');
}
