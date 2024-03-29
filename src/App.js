import React, { useEffect, useState, useMemo } from 'react';
import {Routes, Route} from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
//import { createTheme } from '@mui/material/styles';
import theme from './theme';
import Navbar from './common/Navbar';
import Home from './screens/Home';
//import SignIn from './screens/SignIn';
//import SignUp from './screens/SignUp';
import Footer from './common/Footer';

function App() {

  //const theme = useMemo(() => createTheme(theme()), []);

  return (
    <div className="App">
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Navbar />
        <Routes>
          <Route exact path="/" element={<Home />} />
        </Routes>
        <Footer/>
      </ThemeProvider>
    </div>
  );
}

export default App;
//export default withAITracking(reactPlugin, App);