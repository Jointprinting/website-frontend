// src/screens/studio/_studioUrl.js
//
// The Studio's address bar.
//
// The whole Studio navigated on `React.useState('hub')` — no URL ever changed.
// Consequences the owner actually felt: a project opened in a full-screen drawer
// on a phone could not be closed with the back button (back left the Studio
// entirely), nothing could be linked to or bookmarked, a refresh dropped you at
// the hub, and the open tab reset on every open.
//
// This is deliberately NOT a react-router rewrite. `/studio` is one route in
// App.js and the shell is ~3,000 lines of entry/nonce deep-linking that works;
// re-plumbing it would be a large, risky change for the same outcome. Query
// params ride on the existing route, so routing is untouched:
//
//     /studio?v=clients&p=150&t=designs
//              │         │      └─ panel within the project
//              │         └─ open project number
//              └─ which tool
//
// Two owners, no fighting: the shell owns `v`, the Order Tracker owns `p`/`t`.
// Both go through patchStudioUrl, which merges rather than replaces, so neither
// can clobber the other's key.

const KEYS = { view: 'v', projectNumber: 'p', tab: 't', companyKey: 'c' };

const canUseDom = () => typeof window !== 'undefined' && !!window.history;

// Current studio state as encoded in the address bar.
export function readStudioUrl() {
  if (!canUseDom()) return { view: '', projectNumber: '', tab: '', companyKey: '' };
  const q = new URLSearchParams(window.location.search);
  return {
    view: q.get(KEYS.view) || '',
    projectNumber: q.get(KEYS.projectNumber) || '',
    tab: q.get(KEYS.tab) || '',
    companyKey: q.get(KEYS.companyKey) || '',
  };
}

// Merge a partial state into the URL. `null` or '' deletes a key. `push` adds a
// history entry (so the back button steps back through it); the default replaces,
// which is right for state the user didn't navigate to.
//
// `overlay: true` marks the pushed entry as one that OPENED something on top of a
// tool (a project). closeStudioOverlay reads that marker to decide whether going
// back is the right way to close — see the note there.
export function patchStudioUrl(patch, { push = false, overlay = false } = {}) {
  if (!canUseDom()) return;
  const q = new URLSearchParams(window.location.search);
  for (const [field, key] of Object.entries(KEYS)) {
    if (!(field in patch)) continue;
    const v = patch[field];
    if (v == null || v === '') q.delete(key);
    else q.set(key, String(v));
  }
  const qs = q.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  // Never stack an identical entry — an effect that re-runs shouldn't make the
  // back button need two presses to do one thing.
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (push) {
    window.history.pushState({ studio: true, overlay: !!overlay }, '', url);
  } else {
    // A replace must PRESERVE the overlay marker: switching panels inside an open
    // project replaces the URL, and dropping the flag there would make the X stop
    // closing the project properly.
    const prev = (window.history.state && typeof window.history.state === 'object') ? window.history.state : {};
    window.history.replaceState({ ...prev, studio: true, overlay: overlay || !!prev.overlay }, '', url);
  }
}

// Subscribe to back/forward. Returns an unsubscribe. The callback receives the
// state the URL now describes.
export function onStudioNavigate(fn) {
  if (!canUseDom()) return () => {};
  const handler = () => fn(readStudioUrl());
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}

// Close something that was opened ON TOP of a tool (a project drawer).
//
// Going back is only correct when WE pushed the entry that opened it — then back
// lands on the tool underneath. If the thing was opened straight from the URL (a
// shared link, or a refresh with ?p= already present) there is no such entry, and
// stepping back leaves the tool entirely: from a project you'd land on the hub
// rather than the orders board. So the marker has to be explicit; testing for
// "is a studio entry" was too loose, because every studio URL write sets that.
export function closeStudioOverlay(patch) {
  if (!canUseDom()) return;
  if (window.history.state && window.history.state.overlay) {
    window.history.back();
    return;
  }
  patchStudioUrl(patch);
}

// Entering a tool from the hub clears record-level deep links. Without this the
// tool's own params survive the trip — tap Orders, and a project number left in
// the URL from an earlier visit silently re-opens that project every single time.
// (handlePick already clears the in-memory entry targets for exactly this reason;
// the URL has to follow the same rule or it just re-supplies them.)
export function clearStudioRecord() {
  patchStudioUrl({ projectNumber: '', tab: '' });
}
