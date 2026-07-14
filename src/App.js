import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import axios from 'axios';
import theme from './theme';
import config from './config.json';
import { isAppHost } from './webworks/hostGate';
import AnnouncementBar from './common/AnnouncementBar';
import Navbar from './common/Navbar';
import Footer from './common/Footer';
import JpLoader from './common/JpLoader';

// Tiny / always-rendered screens stay in the main bundle so the public
// home/about/contact pages load instantly. Anything heavy or admin-only is
// code-split via React.lazy — Studio alone is ~half the bundle, and a
// public visitor never needs it. Cut the initial gzipped bundle from 810KB
// to ~187KB. The Suspense fallback uses our branded loader.
import Home from './screens/Home';
import About from './screens/About';
import Contact from './screens/Contact';
import FAQ from './screens/FAQ';
import Terms from './screens/Terms';
import Privacy from './screens/Privacy';

const Product       = lazy(() => import('./screens/Product'));
const Products      = lazy(() => import('./screens/Products'));
const Dispensaries  = lazy(() => import('./screens/Dispensaries'));
const Studio        = lazy(() => import('./screens/Studio'));
const Catalogs      = lazy(() => import('./screens/Catalogs'));
const ApprovalView  = lazy(() => import('./screens/ApprovalView'));
// Public lookbook gallery (/lookbook/:id?token=…) — the client-facing view of
// a Studio-built lookbook. Bare chrome, same pattern as the approval view.
const LookbookView  = lazy(() => import('./screens/LookbookView'));
// JP Webworks client-site preview (/webworks/p/:slug) — a full-page render of
// a client's site, sent to prospects before they pay. Bare chrome (see
// isClientSite below). The static /webworks marketing + demo pages live in
// public/ and never reach the router; only /p/* falls through to the SPA.
const WebworksPreview = lazy(() => import('./screens/WebworksPreview'));
// A LIVE client site on its own CONNECTED domain (see HostGate below).
const ClientSite = lazy(() => import('./screens/ClientSite'));
// Client portal (/portal/:token) — one magic link per company: every order's
// status + timeline + links to the live approval pages. Bare chrome, same
// pattern as the approval view.
const PortalView = lazy(() => import('./screens/PortalView'));
// JP ATOM (/atom + /atom/demo) — the studio productized, its own violet brand.
// Bare chrome: it pitches OTHER merch shops, so Joint Printing's marketing
// nav/footer would muddle whose product it is (same reasoning as Webworks).
const AtomLanding = lazy(() => import('./screens/AtomLanding'));
const AtomDemo = lazy(() => import('./screens/AtomDemo'));

// Routes that should be presented bare — no public coupon banner, no public
// footer. Studio is admin-only (its own dark UI, internal navigation), so the
// marketing site chrome doesn't belong on it. Approval, lookbook, and portal
// views are clean client-facing surfaces, also bare.
const STUDIO_ROUTES = ['/studio', '/admin', '/approve', '/lookbook', '/portal', '/atom'];

// Per-route titles + meta descriptions. Every page used to share the single
// static title from index.html, which hurts SEO and makes tabs/history
// indistinguishable.
const ROUTE_META = {
  '/':          { title: 'Joint Printing | Custom Merch & Screen Printing',  desc: 'Custom screen printing, embroidery, and branded merch — designed, produced, and delivered by Joint Printing.' },
  '/about':     { title: 'About | Joint Printing',                            desc: 'Who we are and how Joint Printing makes custom merch easy.' },
  '/contact':   { title: 'Contact | Joint Printing',                          desc: 'Get a quote or ask a question — we respond fast.' },
  '/product':   { title: 'Product | Joint Printing',                          desc: 'Product details, colors, and sizing.' },
  '/products':  { title: 'Products | Joint Printing',                         desc: 'Browse blank styles for your next custom merch run.' },
  '/dispensaries': { title: 'Dispensary Merch & Apparel | Joint Printing',    desc: 'Custom apparel, staff uniforms, and branded promo for dispensaries — designed, printed, and delivered by Joint Printing.' },
  '/faq':       { title: 'FAQ | Joint Printing',                              desc: 'Answers about pricing, turnaround, artwork, and shipping.' },
  '/catalogs':  { title: 'Catalogs | Joint Printing',                         desc: 'Download our latest product catalogs.' },
  '/terms':     { title: 'Terms of Service | Joint Printing',                 desc: 'Joint Printing terms of service.' },
  '/privacy':   { title: 'Privacy Policy | Joint Printing',                   desc: 'Joint Printing privacy policy.' },
  '/studio':    { title: 'Studio | Joint Printing' },
  '/admin':     { title: 'Studio | Joint Printing' },
};

function useRouteMeta(pathname) {
  React.useEffect(() => {
    const meta = ROUTE_META[pathname]
      || (pathname.startsWith('/approve') ? { title: 'Order Approval | Joint Printing' } : null)
      || (pathname.startsWith('/portal') ? { title: 'Your Orders | Joint Printing' } : null)
      // JP Atom retitles itself on mount (its own brand, not Joint Printing) —
      // this is just the pre-fetch placeholder.
      || (pathname.startsWith('/atom') ? { title: 'JP Atom' } : null)
      // Lookbooks retitle themselves to the lookbook's title once it loads
      // (LookbookView) — this is just the pre-fetch placeholder.
      || (pathname.startsWith('/lookbook') ? { title: 'Lookbook | Joint Printing' } : null)
      // Client-site previews retitle themselves to the business name once the
      // site loads (WebworksPreview) — this is just the pre-fetch placeholder.
      || (pathname.startsWith('/webworks/p/') ? { title: 'Site preview' } : null);
    document.title = (meta && meta.title) || 'Joint Printing | Custom Merch & Screen Printing';
    const tag = document.querySelector('meta[name="description"]');
    if (tag && meta && meta.desc) tag.setAttribute('content', meta.desc);
  }, [pathname]);
}

function NotFound() {
  return (
    <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 42, margin: 0 }}>404</h1>
      <p style={{ fontSize: 16, color: '#555' }}>
        That page doesn't exist. <a href="/" style={{ color: '#1a3d2b' }}>Back to the homepage</a>
      </p>
    </div>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  useRouteMeta(pathname);
  const isStudio = STUDIO_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  // JP Webworks client-site previews render the CLIENT's site full-page — no
  // Joint Printing banner/nav/footer, and no route-fade (the preview manages
  // its own loading state).
  const isClientSite = pathname.startsWith('/webworks/p/');
  const bare = isStudio || isClientSite;

  return (
    <>
      {!bare && <AnnouncementBar />}
      {!bare && <Navbar />}
      <Suspense
        fallback={
          <div style={{
            minHeight: isStudio ? '100vh' : '60vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isStudio ? '#0c1410' : 'transparent',
          }}>
            <JpLoader size={72} tone={isStudio ? 'dark' : 'light'} />
          </div>
        }
      >
        {/* Keyed on pathname so every navigation replays the soft fade-up
            (see .route-fade in index.css). Skipped inside Studio — it's a
            single route whose internal navigation shouldn't remount — and on
            client-site previews, which own their whole viewport. */}
        <div key={isStudio ? 'studio' : pathname} className={bare ? undefined : 'route-fade'}>
        <Routes>
          <Route exact path="/" element={<Home />} />
          <Route exact path="/about" element={<About />} />
          <Route exact path="/contact" element={<Contact />} />
          <Route exact path="/product" element={<Product />} />
          <Route exact path="/products" element={<Products />} />
          <Route exact path="/dispensaries" element={<Dispensaries />} />
          <Route exact path="/faq" element={<FAQ />} />
          {/* Legacy mockup-request page — folded into the contact form. */}
          <Route path="/customize" element={<Navigate to="/contact" replace />} />
          {/* Studio is the password-protected admin. /admin kept as an alias. */}
          <Route exact path="/studio" element={<Studio />} />
          <Route exact path="/admin" element={<Studio />} />
          <Route exact path="/catalogs" element={<Catalogs />} />
          <Route exact path="/terms" element={<Terms />} />
          <Route exact path="/privacy" element={<Privacy />} />
          <Route exact path="/approve/:projectId" element={<ApprovalView />} />
          {/* Client portal — one magic link per company; token-gated by the backend. */}
          <Route exact path="/portal/:token" element={<PortalView />} />
          {/* JP Atom — the studio as a product: landing + guided live demo. */}
          <Route exact path="/atom" element={<AtomLanding />} />
          <Route exact path="/atom/demo" element={<AtomDemo />} />
          {/* Public lookbook gallery — token-gated by the backend (404/410). */}
          <Route exact path="/lookbook/:id" element={<LookbookView />} />
          {/* JP Webworks client-site preview — public, no auth; the backend
              404s drafts so only published previews/live sites render. */}
          <Route exact path="/webworks/p/:slug" element={<WebworksPreview />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
      </Suspense>
      {!bare && <Footer />}
    </>
  );
}

// ── Connected-domain gate ─────────────────────────────────────────────────────
// A paid JP Webworks client's domain points at THIS Vercel project, so their
// requests run this same bundle. Before showing any Joint Printing chrome,
// classify the hostname: our own hosts render the normal app; anything else is
// looked up against the live client sites (public by-domain endpoint) and, when
// it matches, renders the CLIENT's site full-page instead. Unknown hosts fall
// through to the normal app so an unrecognized alias of the main site never
// bricks. The check runs once per page load (hostname can't change without one).
function HostGate({ children }) {
  const [state, setState] = React.useState(() => (isAppHost(window.location.hostname) ? 'app' : 'checking'));
  const [site, setSite] = React.useState(null);
  React.useEffect(() => {
    if (state !== 'checking') return undefined;
    let alive = true;
    axios.get(`${config.backendUrl}/api/jpw/sites/public/domain/${encodeURIComponent(window.location.hostname)}`, { timeout: 15000 })
      .then((res) => {
        if (!alive) return;
        const s = res.data?.site;
        if (s) { setSite(s); setState('client'); } else setState('app');
      })
      .catch(() => { if (alive) setState('app'); });
    return () => { alive = false; };
  }, [state]);
  if (state === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f6' }}>
        <JpLoader size={64} tone="light" />
      </div>
    );
  }
  if (state === 'client' && site) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f6f7f6' }} />}>
        <ClientSite site={site} />
      </Suspense>
    );
  }
  return children;
}

function App() {
  return (
    <div className="App" style={{ overflowX: 'hidden' }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <HostGate>
          <AppShell />
        </HostGate>
      </ThemeProvider>
    </div>
  );
}

export default App;
