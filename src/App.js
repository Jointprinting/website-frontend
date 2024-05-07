import React from 'react';
import {Routes, Route} from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme';
import Navbar from './common/Navbar';
import Home from './screens/Home';
import About from './screens/About';
import Contact from './screens/Contact';
import Product from './screens/Product';
import Products from './screens/Products';
import Footer from './common/Footer';
import FAQ from './screens/FAQ';
import Customize from './screens/Customize';

function App() {

  //const theme = useMemo(() => createTheme(theme()), []);

  return (
    <div className="App">
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Navbar />
        <Routes>
          <Route exact path="/" element={<Home />} />
          <Route exact path="/about" element={<About />} />
          <Route exact path="/contact" element={<Contact />} />
          <Route exact path="/product" element={<Product />} />
          <Route exact path="/products" element={<Products />} />
          <Route exact path="/faq" element={<FAQ />} />
          <Route exact path="/customize" element={<Customize />} />
        </Routes>
        <Footer/>
      </ThemeProvider>
    </div>
  );
}

export default App;
//export default withAITracking(reactPlugin, App);