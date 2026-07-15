import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import ScrollToTop from './ScrollToTop';
import { ContextMenuProvider } from './screens/studio/ContextMenu';

// Global: a focused <input type="number"> must NEVER have its value changed by the
// mouse wheel (the browser's default footgun — scroll over a focused number field
// and it silently ticks the value up/down). On any wheel while a number input is
// focused, blur it so the wheel scrolls the PAGE, not the number. App-wide, one
// place — covers every number field in the Studio (quoter costs, quantities, etc.).
document.addEventListener('wheel', () => {
  const el = document.activeElement;
  if (el && el.tagName === 'INPUT' && el.type === 'number') el.blur();
}, { passive: true });

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