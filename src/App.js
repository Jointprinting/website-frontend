import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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
import Customize from './screens/Customize';

const Product       = lazy(() => import('./screens/Product'));
const Products      = lazy(() => import('./screens/Products'));
const Studio        = lazy(() => import('./screens/Studio'));
const Catalogs      = lazy(() => import('./screens/Catalogs'));
const Demos         = lazy(() => import('./screens/demos'));
const ApprovalView  = lazy(() => import('./screens/ApprovalView'));

// Routes that should be presented bare — no public coupon banner, no public
// footer. Studio is admin-only (its own dark UI, internal navigation), so the
// marketing site chrome doesn't belong on it. Approval view is a clean
// client-facing surface, also bare.
const STUDIO_ROUTES = ['/studio', '/admin', '/approve'];

function AppShell() {
  const { pathname } = useLocation();
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
        <Routes>
          <Route exact path="/" element={<Home />} />
          <Route exact path="/about" element={<About />} />
          <Route exact path="/contact" element={<Contact />} />
          <Route exact path="/product" element={<Product />} />
          <Route exact path="/products" element={<Products />} />
          <Route exact path="/faq" element={<FAQ />} />
          <Route exact path="/customize" element={<Customize />} />
          {/* Studio is the password-protected admin. /admin kept as an alias. */}
          <Route exact path="/studio" element={<Studio />} />
          <Route exact path="/admin" element={<Studio />} />
          <Route exact path="/catalogs" element={<Catalogs />} />
          <Route exact path="/demos" element={<Demos />} />
          <Route exact path="/terms" element={<Terms />} />
          <Route exact path="/privacy" element={<Privacy />} />
          <Route exact path="/approve/:projectId" element={<ApprovalView />} />
        </Routes>
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
