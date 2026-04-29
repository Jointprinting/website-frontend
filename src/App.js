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
import Customize from './screens/Customize';
import Studio from './screens/Studio';
import Catalogs from './screens/Catalogs';
import Demos from './screens/demos';

// Routes that shouldn't show the customer-facing announcement bar.
// Studio is admin-only — coupon banner doesn't belong there.
const HIDE_BANNER_ON = ['/studio', '/admin'];

function AppShell() {
  const { pathname } = useLocation();
  const hideBanner = HIDE_BANNER_ON.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  return (
    <>
      {!hideBanner && <AnnouncementBar />}
      <Navbar />
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
      </Routes>
      <Footer />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppShell />
      </ThemeProvider>
    </div>
  );
}

export default App;
