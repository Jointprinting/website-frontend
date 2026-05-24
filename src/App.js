import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme';
import AnnouncementBar from './common/AnnouncementBar';
import Navbar from './common/Navbar';
import Home from './screens/Home';
import About from './screens/About';
import Contact from './screens/Contact';
import Product from './screens/Product';
import Products from './screens/Products';
import Footer from './common/Footer';
import FAQ from './screens/FAQ';
import Terms from './screens/Terms';
import Privacy from './screens/Privacy';
import Customize from './screens/Customize';
import Studio from './screens/Studio';
import Catalogs from './screens/Catalogs';
import Demos from './screens/demos';
import ApprovalView from './screens/ApprovalView';

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
