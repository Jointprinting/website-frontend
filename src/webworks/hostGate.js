// src/webworks/hostGate.js
//
// Hostname classification for JP Webworks CONNECTED client domains. When a
// client pays and their domain is added to this Vercel project, requests for
// that domain hit this same React bundle — without a gate they'd render the
// Joint Printing marketing site on the client's URL. App.js asks isAppHost():
// our own hosts get the normal app; anything else is treated as a candidate
// client domain and looked up via /api/jpw/sites/public/domain/:host (unknown
// hosts fall through to the normal app, so an unrecognized alias never bricks).
// PURE + unit-tested.

export function isAppHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/:\d+$/, '');
  if (!h) return true; // no hostname (tests, file://) → behave as the app
  if (h === 'jointprinting.com' || h === 'www.jointprinting.com') return true;
  if (h === 'localhost' || h === '127.0.0.1') return true;
  if (h.endsWith('.vercel.app')) return true; // preview + production deploys
  return false;
}

export default isAppHost;
