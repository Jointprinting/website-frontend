import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import ScrollToTop from './ScrollToTop';
import { ContextMenuProvider } from './screens/studio/ContextMenu';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <ScrollToTop />
    {/* Custom right-click menu system. Inert until a surface registers actions
        (or a tool registers a fallback), so the public site keeps the native
        browser menu untouched; only the Studio opts in. */}
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>
  </BrowserRouter>
);