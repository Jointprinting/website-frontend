import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme';
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
const Studio        = lazy(() => import('./screens/Studio'));
const Catalogs      = lazy(() => import('./screens/Catalogs'));
const ApprovalView  = lazy(() => import('./screens/ApprovalView'));

// Routes that should be presented bare — no public coupon banner, no public
// footer. Studio is admin-only (its own dark UI, internal navigation), so the
// marketing site chrome doesn't belong on it. Approval view is a clean
// client-facing surface, also bare.
const STUDIO_ROUTES = ['/studio', '/admin', '/approve'];

// Per-route titles + meta descriptions. Every page used to share the single
// static title from index.html, which hurts SEO and makes tabs/history
// indistinguishable.
const ROUTE_META = {
  '/':          { title: 'Joint Printing | Custom Merch & Screen Printing',  desc: 'Custom screen printing, embroidery, and branded merch — designed, produced, and delivered by Joint Printing.' },
  '/about':     { title: 'About | Joint Printing',                            desc: 'Who we are and how Joint Printing makes custom merch easy.' },
  '/contact':   { title: 'Contact | Joint Printing',                          desc: 'Get a quote or ask a question — we respond fast.' },
  '/product':   { title: 'Product | Joint Printing',                          desc: 'Product details, colors, and sizing.' },
  '/products':  { title: 'Products | Joint Printing',                         desc: 'Browse blank styles for your next custom merch run.' },
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
      || (pathname.startsWith('/approve') ? { title: 'Order Approval | Joint Printing' } : null);
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

  return (
    <>
      {!isStudio && <AnnouncementBar />}
      {!isStudio && <Navbar />}
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
            single route whose internal navigation shouldn't remount. */}
        <div key={isStudio ? 'studio' : pathname} className={isStudio ? undefined : 'route-fade'}>
        <Routes>
          <Route exact path="/" element={<Home />} />
          <Route exact path="/about" element={<About />} />
          <Route exact path="/contact" element={<Contact />} />
          <Route exact path="/product" element={<Product />} />
          <Route exact path="/products" element={<Products />} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
      </Suspense>
      {!isStudio && <Footer />}
    </>
  );
}

function App() {
  return (
    <div className="App" style={{ overflowX: 'hidden' }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppShell />
      </ThemeProvider>
    </div>
  );
}

export default App;
