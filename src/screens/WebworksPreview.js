// src/screens/WebworksPreview.js
// Public JP Webworks site preview — /webworks/p/:slug
//
// This is the link Nate sends a prospect: "here's your site, live, before you
// pay a dollar." It fetches the site by slug from the PUBLIC endpoint (no
// auth; the backend 404s drafts) and renders the matching template full-page.
// No Joint Printing chrome — App.js drops the navbar/footer for this route so
// the client sees only THEIR site.
//
// Search engines are kept out twice over: vercel.json already stamps
// X-Robots-Tag noindex on /webworks/*, and we inject a robots meta here for
// belt-and-suspenders (no react-helmet in this app, so a document side-effect).

import * as React from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../config.json';
import { getTemplate } from '../webworks/templates';
import JpLoader from '../common/JpLoader';

// Full-viewport centered shell for the loading / not-found states. Neutral
// light canvas — we don't know the site's palette yet.
function CenterShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#f6f7f6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      {children}
    </div>
  );
}

// Friendly branded dead-end: the slug is wrong, the site was unpublished
// (back to draft), or it was deleted. Says so without leaking why.
function NotAvailable() {
  return (
    <CenterShell>
      <div style={{ maxWidth: 420 }}>
        <div style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontWeight: 800, fontSize: 14, letterSpacing: 2,
          color: '#1a3d2b', marginBottom: 18,
        }}>
          JP <span style={{ color: '#17b878' }}>WEBWORKS</span>
        </div>
        <h1 style={{ fontSize: 26, margin: '0 0 10px', color: '#16241d' }}>
          This preview isn&rsquo;t available
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#5b6a61', margin: 0 }}>
          The site you&rsquo;re looking for may have moved or been taken down.
          If someone sent you this link, ask them for a fresh one.
        </p>
        <a href="/webworks" style={{
          display: 'inline-block', marginTop: 22, padding: '10px 22px',
          borderRadius: 999, background: '#17b878', color: '#062015',
          fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          What is JP Webworks?
        </a>
      </div>
    </CenterShell>
  );
}

export default function WebworksPreview() {
  const { slug } = useParams();
  const [site, setSite] = React.useState(null);
  const [state, setState] = React.useState('loading'); // 'loading' | 'ready' | 'missing'

  // Keep robots out of client previews (meta layer; the Vercel header is the
  // primary gate). Removed on unmount so SPA-navigating back to the marketing
  // site doesn't leave a stray noindex behind.
  React.useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { try { document.head.removeChild(meta); } catch (_) {} };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setState('loading');
    setSite(null);
    axios.get(`${config.backendUrl}/api/jpw/sites/public/${encodeURIComponent(slug || '')}`, { timeout: 15000 })
      .then((res) => {
        if (cancelled) return;
        const s = res.data?.site;
        if (s && getTemplate(s.templateId)) {
          setSite(s);
          setState('ready');
        } else {
          setState('missing');
        }
      })
      .catch(() => { if (!cancelled) setState('missing'); }); // 404 (draft/deleted) and network errors read the same to a visitor
    return () => { cancelled = true; };
  }, [slug]);

  // The tab should read as the CLIENT's site, not Joint Printing.
  React.useEffect(() => {
    if (state === 'ready' && site) {
      document.title = site.data?.businessName || site.name || 'Site preview';
    }
  }, [state, site]);

  if (state === 'loading') {
    return (
      <CenterShell>
        <JpLoader size={64} tone="light" label="Loading…" />
      </CenterShell>
    );
  }
  if (state === 'missing') return <NotAvailable />;

  const tpl = getTemplate(site.templateId);
  const Component = tpl.Component;
  return (
    <React.Suspense fallback={<CenterShell><JpLoader size={64} tone="light" /></CenterShell>}>
      <Component data={site.data || {}} />
    </React.Suspense>
  );
}
