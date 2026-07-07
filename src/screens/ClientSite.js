// src/screens/ClientSite.js
// A LIVE JP Webworks client site, served on the client's own connected domain.
//
// App.js's host gate resolves the request hostname through the public
// by-domain endpoint and hands the site here — this component just renders the
// template full-page and titles the tab as the client's business. Unlike the
// /webworks/p/:slug PREVIEW, a connected domain is the client's real website:
// no noindex, no Joint Printing chrome, nothing but their site.

import * as React from 'react';
import { getTemplate } from '../webworks/templates';
import JpLoader from '../common/JpLoader';

export default function ClientSite({ site }) {
  React.useEffect(() => {
    document.title = site?.data?.businessName || site?.name || document.title;
  }, [site]);

  const tpl = getTemplate(site?.templateId);
  if (!tpl) return null; // unknown template id → nothing to render (gate falls back)
  const Component = tpl.Component;
  return (
    <React.Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f6' }}>
          <JpLoader size={64} tone="light" />
        </div>
      }
    >
      <Component data={site?.data || {}} />
    </React.Suspense>
  );
}
