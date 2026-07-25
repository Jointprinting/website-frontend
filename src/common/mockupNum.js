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

// A design name with the internal variation marker removed.
//
// "Add a variation" names the clone "<design> · v2" so two variations of one
// design don't share a display name in the owner's library. That marker is
// bookkeeping — the mockup NUMBER already tells a client which design they're
// looking at, and ECOSYSTEM.md says the number and the project number are the
// only identifiers they should ever see.
//
// It leaked because the lab seeds the editable TITLE from the library item's
// name, so "· v11" became the mockup's actual title and printed as the headline
// on the client's PDF. Stripped at that seed, and again at every client-facing
// render so existing saved titles are cleaned up too.
export function clientDesignName(name) {
  return String(name == null ? '' : name).replace(/\s*·\s*v\d+\s*$/i, '').trim();
}
