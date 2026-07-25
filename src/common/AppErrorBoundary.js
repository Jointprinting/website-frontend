// src/common/AppErrorBoundary.js
//
// One render error anywhere used to blank the whole site. Only the mockup lab
// had a boundary (LabErrorBoundary, added after a real crash) — every one of the
// other 24 routes was unprotected, including the two that carry money:
// /approve/:projectId and /lookbook/:id. A client hitting a render error there
// saw a white page with no explanation and no way forward, and the owner would
// only find out if they happened to say so.
//
// Two audiences, so two fallbacks:
//
//   • A CLIENT should never see a stack trace. They get a plain apology, the
//     owner's real contact details, and a reload — their job is to reach a
//     human, not to debug. The link they were sent still works after a reload
//     in the common case (a transient data shape, a failed image decode).
//   • The OWNER gets the actual error message, because a report he can paste is
//     a diagnosis and "it broke" is not. Same reasoning as LabErrorBoundary.
//
// Which one shows is decided by the PATH, not by guessing: the client-facing
// routes are enumerated below.

import React from 'react';

// Routes a client can be sent a link to. Everything else is the owner's.
const CLIENT_PATHS = [/^\/approve\//, /^\/lookbook\//, /^\/portal\//, /^\/preorder\//];

const isClientPath = (pathname) => CLIENT_PATHS.some((re) => re.test(String(pathname || '')));

const OWNER_EMAIL = 'nate@jointprinting.com';
const OWNER_PHONE = '(856) 899-7642';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    // The component stack is what turns a report into a fix.
    console.error('[app] render crash:', err, info && info.componentStack);
  }

  // A route change should clear the error — otherwise the fallback is sticky and
  // navigating away looks broken too.
  componentDidUpdate(prev) {
    if (this.state.err && prev.pathname !== this.props.pathname) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ err: null });
    }
  }

  render() {
    const { err } = this.state;
    if (!err) return this.props.children;

    const client = isClientPath(this.props.pathname);
    const reload = () => window.location.reload();

    const wrap = {
      minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.25rem', boxSizing: 'border-box',
    };
    const card = {
      maxWidth: 520, width: '100%', textAlign: 'left',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    };
    const btn = {
      display: 'inline-block', marginTop: '1.25rem', padding: '0.65rem 1.25rem',
      borderRadius: 999, border: 'none', cursor: 'pointer',
      background: '#4ade80', color: '#08130c', fontWeight: 800, fontSize: '0.95rem',
    };

    if (client) {
      return (
        <div style={wrap}>
          <div style={card}>
            <h1 style={{ fontSize: '1.35rem', margin: '0 0 0.6rem' }}>This page didn&apos;t load properly</h1>
            <p style={{ margin: '0 0 0.75rem', lineHeight: 1.6 }}>
              Sorry — something went wrong on our end, not yours. Your link is still
              good, so a reload will usually sort it.
            </p>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              If it keeps happening, reach Nate directly at{' '}
              <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a> or {OWNER_PHONE} — he&apos;ll
              send your designs across another way.
            </p>
            <button type="button" onClick={reload} style={btn}>Reload the page</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...wrap, minHeight: '100vh', background: '#0c1410', color: '#e6eae1' }}>
        <div style={card}>
          <h1 style={{ fontSize: '1.2rem', margin: '0 0 0.6rem' }}>This screen hit an error</h1>
          <p style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: '#f87171', fontSize: '0.85rem', wordBreak: 'break-word',
            margin: '0 0 1rem',
          }}>
            {String((err && err.message) || err)}
          </p>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#8d9488', fontSize: '0.9rem' }}>
            Nothing was saved or lost by this — it&apos;s a display error. Reload to carry
            on, and send that red line across so the exact crash can be fixed.
          </p>
          <button type="button" onClick={reload} style={btn}>Reload</button>
        </div>
      </div>
    );
  }
}
