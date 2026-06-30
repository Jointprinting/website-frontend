// src/screens/studio/ContextMenu.js
// A premium, accessible right-click context-menu system for the Studio.
//
// The owner wanted "a right click on all pages (instead of the chrome UI right
// click) that has actually useful options associated with whatever I'm
// right-clicking on, like a genius system." This is the primitive that delivers
// it: a provider + hook so any element can register a list of context-aware
// actions, rendered as a dark, on-brand menu (the `D` palette) at the cursor.
//
// Design rules that keep it from being a nuisance:
//   • The native browser menu is PRESERVED on plain text, inputs, textareas,
//     links and [contenteditable] — so copy / paste / spellcheck / inspect all
//     still work. We only take over the menu on elements that explicitly
//     registered actions (or, optionally, the empty app chrome via a fallback).
//   • Closes on outside-click / Escape / scroll / resize / blur.
//   • Stays on-screen: flips and clamps near the viewport edges.
//   • Keyboard navigable (↑/↓/Home/End to move, →/Enter to open a submenu or
//     run, ←/Esc to close), with proper ARIA menu roles.
//   • Supports separators, icons, danger items, disabled items, and submenus.
//
// Usage:
//   <ContextMenuProvider>…app…</ContextMenuProvider>   // mount once, high up
//   const ctx = useContextMenu();
//   <div {...ctx.bind(() => buildItems(record))}>…</div>
//
// `bind(getItems[, opts])` returns the props an actionable element needs. The
// item list is built lazily AT RIGHT-CLICK TIME (getItems is called on open),
// so handlers always close over fresh data — no stale closures from a list that
// was memoised when the row first mounted.

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Box } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { D, mono } from './_shared';

// ── Native-menu preservation ──────────────────────────────────────────────────
// Right-clicks that land on real text the owner might want to copy, an editable
// field, or a link must keep the browser's own menu. We walk up from the event
// target to the element that registered actions; if we cross one of these
// "leave it native" nodes first, we bail and let Chrome handle it.
const NATIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'A', 'IMG', 'AUDIO', 'VIDEO']);

function isNativeTarget(el) {
  let n = el;
  while (n && n !== document.body && n.nodeType === 1) {
    const tag = n.tagName;
    if (NATIVE_TAGS.has(tag)) return true;
    if (n.isContentEditable) return true;
    // An explicit opt-out hook for any subtree that wants the native menu.
    if (n.dataset && n.dataset.nativeMenu === 'true') return true;
    n = n.parentElement;
  }
  return false;
}

// True when the user currently has a non-collapsed text selection — right-
// clicking a selection should offer the native "Copy" rather than our menu.
function hasTextSelection() {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  return !!(sel && sel.rangeCount > 0 && !sel.isCollapsed && String(sel).trim().length > 0);
}

// Heuristic: is this element a "leaf" of real, copyable text (a heading, label,
// count, paragraph, cell) with no element children? Such a target should keep
// the native menu even inside opted-in chrome, so the owner can copy/inspect it.
// Containers (which have element children, e.g. the empty grid wrapper) are NOT
// leaves, so a right-click on the blank space between cards still gets our menu.
function isTextLeaf(el) {
  if (!el || el.nodeType !== 1) return false;
  const hasElementChild = el.children && el.children.length > 0;
  const text = (el.textContent || '').trim();
  return !hasElementChild && text.length > 0;
}

// ── Context ───────────────────────────────────────────────────────────────────
const Ctx = React.createContext(null);

export function useContextMenu() {
  const ctx = React.useContext(Ctx);
  // A no-op fallback so a component that uses the hook outside the provider
  // (e.g. an isolated unit test) doesn't crash — it just won't show a menu.
  if (!ctx) {
    return {
      open: () => {},
      close: () => {},
      bind: () => ({}),
      registerFallback: () => () => {},
    };
  }
  return ctx;
}

const MENU_W_EST = 248;          // estimate before measure, for first-paint clamp
const ITEM_H_EST = 34;

export function ContextMenuProvider({ children }) {
  // menu = { x, y, items } | null.  A non-null menu is open at (x, y).
  const [menu, setMenu] = React.useState(null);
  // Fallback item-builders registered by surfaces for empty-chrome right-clicks.
  // The LAST registered, still-mounted one wins (the active tool).
  const fallbacksRef = React.useRef([]);

  const close = React.useCallback(() => setMenu(null), []);

  const open = React.useCallback((x, y, items) => {
    const clean = sanitizeItems(items);
    if (!clean.length) return;
    setMenu({ x, y, items: clean });
  }, []);

  // bind(getItems, opts) → props for an actionable element. `getItems` is
  // evaluated on open. Returning a falsy / empty list lets the event fall
  // through (native menu, or a parent's handler / the fallback).
  const bind = React.useCallback((getItems, opts = {}) => ({
    onContextMenu: (e) => {
      // Respect editable targets / links / live text selections.
      if (isNativeTarget(e.target) || hasTextSelection()) return;
      const items = sanitizeItems(typeof getItems === 'function' ? getItems(e) : getItems);
      if (!items.length) return;            // nothing useful → let it bubble
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, items });
      if (opts.onOpen) opts.onOpen(e);
    },
  }), []);

  // registerFallback(getItems) → unregister fn. The active Studio tool calls
  // this so right-clicking its empty chrome still offers global niceties.
  const registerFallback = React.useCallback((getItems) => {
    const entry = { getItems };
    fallbacksRef.current.push(entry);
    return () => {
      fallbacksRef.current = fallbacksRef.current.filter((x) => x !== entry);
    };
  }, []);

  // Document-level fallback: a right-click on EMPTY app chrome that wasn't
  // claimed by any bound element. To honour "preserve the native menu on plain
  // text" we DON'T fire on arbitrary chrome — only inside a region a tool has
  // explicitly opted in via `data-ctx-chrome` (its empty background canvas).
  // That way a right-click on a heading / label / body paragraph the owner might
  // want to copy keeps the browser's own menu, while a right-click on the blank
  // space around the cards still offers the global niceties.
  React.useEffect(() => {
    const onDocContext = (e) => {
      if (e.defaultPrevented) return;       // a bound element already handled it
      // Never re-trigger over our own open menu surface.
      if (e.target.closest && e.target.closest('[data-ctxmenu-surface]')) return;
      if (isNativeTarget(e.target) || hasTextSelection()) return;
      // Keep the native menu on a real text leaf (heading/label/count) even when
      // it lives inside opted-in chrome, so copy/inspect still work there.
      if (isTextLeaf(e.target)) return;
      // Require an opted-in empty-chrome ancestor — keeps the rest of the page
      // (and the whole public site) on the native menu.
      if (!(e.target.closest && e.target.closest('[data-ctx-chrome]'))) return;
      const builder = fallbacksRef.current[fallbacksRef.current.length - 1];
      if (!builder) return;
      const items = sanitizeItems(builder.getItems(e));
      if (!items.length) return;
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, items });
    };
    document.addEventListener('contextmenu', onDocContext);
    return () => document.removeEventListener('contextmenu', onDocContext);
  }, []);

  const value = React.useMemo(() => ({ open, close, bind, registerFallback }), [open, close, bind, registerFallback]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {menu && (
        <ContextMenuSurface x={menu.x} y={menu.y} items={menu.items} onClose={close} />
      )}
    </Ctx.Provider>
  );
}

// Drop empty/invalid entries and collapse leading/trailing/double separators so
// a conditionally-built list never renders a stray divider.
function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  const flat = items.filter(Boolean);
  const out = [];
  for (const it of flat) {
    if (it.divider || it.type === 'divider') {
      if (out.length === 0) continue;                 // no leading divider
      if (out[out.length - 1].divider) continue;      // no double divider
      out.push({ divider: true });
    } else {
      out.push(it);
    }
  }
  while (out.length && out[out.length - 1].divider) out.pop(); // no trailing
  return out;
}

// ── The rendered menu (portal) ────────────────────────────────────────────────
// One instance per open menu. Submenus recurse through <MenuList/>.
function ContextMenuSurface({ x, y, items, onClose }) {
  // Remember what was focused BEFORE the menu rendered (captured during the first
  // render, before MenuList grabs focus) so a keyboard user is handed back to it
  // when the menu closes, instead of being dumped on <body>. An action that opens
  // a dialog still wins focus — it runs on the next tick, after this restore.
  const [prevFocused] = React.useState(
    () => (typeof document !== 'undefined' ? document.activeElement : null),
  );
  React.useEffect(() => () => {
    try { if (prevFocused && prevFocused.focus) prevFocused.focus({ preventScroll: true }); } catch (_) { /* detached node — ignore */ }
  }, [prevFocused]);

  // Close on the "world moving": outside pointer-down, Escape, scroll, resize,
  // window blur. Pointerdown (not click) so it closes the instant you press
  // elsewhere, matching a native menu.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onScroll = () => onClose();
    const onResize = () => onClose();
    const onBlur = () => onClose();
    // Capture phase for keydown so Escape closes us before a dialog handles it.
    window.addEventListener('keydown', onKey, true);
    // Scroll anywhere (capture catches inner scrollers) dismisses the menu.
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onBlur);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <Box
      data-ctxmenu-surface=""
      // Full-screen catcher: a right-click or left-click on the backdrop closes
      // the menu. The data-ctxmenu-surface marker makes the document fallback
      // skip this layer (so a backdrop right-click just closes, never re-opens).
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000,
        // Transparent backdrop — we don't dim; this is a context menu, not a modal.
      }}
    >
      <MenuList x={x} y={y} items={items} onClose={onClose} isRoot />
    </Box>,
    document.body,
  );
}

// A single menu panel positioned at (x, y), edge-flipped and clamped. Handles
// its own keyboard focus ring and spawns child <MenuList/>s for submenus.
function MenuList({ x, y, items, onClose, onExit, autoFocus, isRoot, parentRect }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ left: x, top: y, ready: false });
  const [active, setActive] = React.useState(-1);     // keyboard-highlighted index
  const [openSub, setOpenSub] = React.useState(-1);   // index with an open submenu
  // True when the open submenu was entered via the KEYBOARD (→/Enter), so it
  // should pull focus. A hover-opened submenu stays open but leaves focus on this
  // panel, so the mouse and keyboard never fight over the focus ring.
  const [subFocused, setSubFocused] = React.useState(false);
  const itemRefs = React.useRef([]);

  // Indices that are actually focusable (skip dividers & disabled).
  const navigable = React.useMemo(
    () => items.map((it, i) => (!it.divider && !it.disabled ? i : -1)).filter((i) => i >= 0),
    [items],
  );

  // Measure then place: flip horizontally/vertically if we'd overflow, and clamp
  // into the viewport with an 8px margin. For submenus, prefer the right of the
  // parent row, flipping to the left when there's no room.
  React.useLayoutEffect(() => {
    const el = ref.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el ? el.offsetWidth : MENU_W_EST;
    const h = el ? el.offsetHeight : items.length * ITEM_H_EST;
    const margin = 8;

    let left = x;
    let top = y;

    if (parentRect) {
      // Submenu: open to the right of the parent panel; flip left if cramped.
      left = parentRect.right - 2;
      if (left + w > vw - margin) left = parentRect.left - w + 2;
      top = parentRect.top;
    } else {
      // Root: open at the cursor, flip to the left / up if it would overflow.
      if (left + w > vw - margin) left = x - w;
      if (top + h > vh - margin) top = y - h;
    }
    left = Math.max(margin, Math.min(left, vw - w - margin));
    top = Math.max(margin, Math.min(top, vh - h - margin));
    setPos({ left, top, ready: true });
  }, [x, y, items.length, parentRect]);

  // Focus the panel when it's the root menu OR a keyboard-opened submenu, so
  // keyboard nav works immediately and flows into submenus.
  React.useEffect(() => {
    if (ref.current && (isRoot || autoFocus)) ref.current.focus({ preventScroll: true });
  }, [isRoot, autoFocus]);

  // When a submenu is entered by keyboard, highlight its first item right away.
  React.useEffect(() => {
    if (autoFocus && active < 0 && navigable.length) setActive(navigable[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  // Open the submenu at row `i`. `viaKeyboard` pulls focus into it (and highlights
  // its first item); a hover-open leaves focus on this panel.
  const openSubmenu = (i, viaKeyboard) => {
    setOpenSub(i);
    setSubFocused(!!viaKeyboard);
  };

  const move = (dir) => {
    if (!navigable.length) return;
    const curPos = navigable.indexOf(active);
    let next;
    if (dir === 'first') next = 0;
    else if (dir === 'last') next = navigable.length - 1;
    else if (curPos < 0) next = dir > 0 ? 0 : navigable.length - 1;
    else next = (curPos + dir + navigable.length) % navigable.length;
    // Arrowing the list collapses any hover/keyboard-opened submenu.
    setOpenSub(-1); setSubFocused(false);
    setActive(navigable[next]);
  };

  const run = (it) => {
    if (!it || it.disabled || it.divider) return;
    if (it.items && it.items.length) {
      // Toggle the submenu (mouse path — focus stays on this panel).
      const i = items.indexOf(it);
      if (openSub === i) { setOpenSub(-1); setSubFocused(false); }
      else openSubmenu(i, false);
      return;
    }
    // Close first so a handler that navigates / opens a dialog isn't fighting
    // the menu's own listeners, then fire on the next tick.
    onClose();
    if (typeof it.onClick === 'function') {
      setTimeout(() => { try { it.onClick(); } catch (_) { /* swallow — never crash the app on a menu action */ } }, 0);
    }
  };

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': e.preventDefault(); move('first'); break;
      case 'End': e.preventDefault(); move('last'); break;
      case 'Tab': {
        // Trap focus in the menu — Tab / Shift+Tab cycle the items like arrows.
        e.preventDefault(); move(e.shiftKey ? -1 : 1); break;
      }
      case 'ArrowRight': {
        const it = items[active];
        if (it && it.items && it.items.length) { e.preventDefault(); openSubmenu(active, true); }
        break;
      }
      case 'ArrowLeft': {
        // Collapse just this submenu and hand focus back to the parent row — NOT
        // close the whole menu (that's Escape's job, handled at the surface).
        if (!isRoot) { e.preventDefault(); if (onExit) onExit(); }
        break;
      }
      case 'Enter':
      case ' ': {
        const it = items[active];
        if (it) {
          e.preventDefault();
          if (it.items && it.items.length) openSubmenu(active, true);
          else run(it);
        }
        break;
      }
      default: break;
    }
  };

  // Measure the row that owns the open submenu AFTER this panel has been placed
  // (pos.ready), so the child panel anchors off the row's final on-screen box.
  const [subParentRect, setSubParentRect] = React.useState(null);
  React.useLayoutEffect(() => {
    if (openSub < 0) { setSubParentRect(null); return; }
    const node = itemRefs.current[openSub];
    setSubParentRect(node ? node.getBoundingClientRect() : null);
  }, [openSub, pos.left, pos.top, pos.ready]);

  const panel = (
    <Box
      ref={ref}
      role="menu"
      tabIndex={-1}
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      sx={{
        position: 'fixed',
        zIndex: 2001,            // above the 2000 click-catcher (matters once portaled)
        left: pos.left, top: pos.top,
        minWidth: 224, maxWidth: 320,
        py: 0.75,
        bgcolor: D.panel,
        color: D.text,
        border: `1px solid ${D.line}`,
        borderRadius: 2,
        boxShadow: '0 16px 40px -8px rgba(0,0,0,0.6), 0 4px 12px -4px rgba(0,0,0,0.5)',
        backgroundImage: 'none',
        outline: 'none',
        // Snappy entrance, consistent with the _shared transitions: a quick
        // fade + slight lift/scale from the corner. Suppressed until measured so
        // it never flashes at the wrong spot.
        opacity: pos.ready ? 1 : 0,
        transform: pos.ready ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.98)',
        transformOrigin: 'top left',
        transition: 'opacity 0.12s ease, transform 0.12s ease',
        // Respect reduced-motion: appear in place with no lift / scale / fade.
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
        // A faint top accent hairline echoes the brand glow on the builders.
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 10, right: 10, height: 2,
          background: `linear-gradient(90deg, transparent, ${D.green}, transparent)`,
          opacity: 0.5, borderRadius: 2,
        },
      }}
    >
      {items.map((it, i) => {
        if (it.divider) {
          return <Box key={`d${i}`} role="separator" sx={{ height: '1px', bgcolor: D.line, my: 0.5, mx: 1 }} />;
        }
        if (it.header) {
          return (
            <Box key={`h${i}`} sx={{ px: 1.5, pt: 0.75, pb: 0.4, ...mono, fontSize: 10, fontWeight: 800,
              letterSpacing: 1, textTransform: 'uppercase', color: D.faint, userSelect: 'none' }}>
              {it.header}
            </Box>
          );
        }
        const hasSub = !!(it.items && it.items.length);
        const isActive = i === active;
        const danger = !!it.danger;
        const disabled = !!it.disabled;
        const Icon = it.icon;
        return (
          <Box
            key={it.key || it.label || i}
            ref={(n) => { itemRefs.current[i] = n; }}
            role="menuitem"
            aria-haspopup={hasSub ? 'menu' : undefined}
            aria-expanded={hasSub ? openSub === i : undefined}
            aria-disabled={disabled || undefined}
            tabIndex={-1}
            onMouseEnter={() => {
              if (disabled) return;
              setActive(i);
              // Hovering a submenu row opens it (focus stays here); hovering a leaf
              // closes any open one.
              if (hasSub) openSubmenu(i, false);
              else { setOpenSub(-1); setSubFocused(false); }
            }}
            onClick={(e) => { e.stopPropagation(); run(it); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25,
              mx: 0.6, px: 1, py: 0.7, borderRadius: 1.25,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.4 : 1,
              color: danger ? '#f87171' : D.text,
              bgcolor: isActive && !disabled
                ? (danger ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.1)')
                : 'transparent',
              transition: 'background-color 0.1s ease, color 0.1s ease',
              userSelect: 'none',
            }}
          >
            {Icon ? (
              <Box sx={{ display: 'flex', flexShrink: 0, color: danger ? '#f87171' : (isActive ? D.green : D.muted),
                '& svg': { fontSize: 18 } }}>
                <Icon fontSize="inherit" />
              </Box>
            ) : (
              <Box sx={{ width: 18, flexShrink: 0 }} />
            )}
            <Box sx={{ flexGrow: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.label}
            </Box>
            {it.hint && (
              <Box sx={{ ...mono, fontSize: 11, color: D.faint, flexShrink: 0, ml: 0.5 }}>{it.hint}</Box>
            )}
            {hasSub && <ChevronRightIcon sx={{ fontSize: 16, color: D.faint, flexShrink: 0, ml: -0.5 }} />}
          </Box>
        );
      })}

      {/* Submenu panel */}
      {openSub >= 0 && subParentRect && items[openSub] && items[openSub].items && (
        <MenuList
          x={subParentRect.right}
          y={subParentRect.top}
          items={sanitizeItems(items[openSub].items)}
          onClose={onClose}
          onExit={() => {
            // Collapse this submenu and return focus to its parent row.
            const parentIdx = openSub;
            setOpenSub(-1); setSubFocused(false); setActive(parentIdx);
            if (ref.current) ref.current.focus({ preventScroll: true });
          }}
          autoFocus={subFocused}
          parentRect={subParentRect}
        />
      )}
    </Box>
  );

  // A submenu must escape the transformed parent panel: a CSS transform turns the
  // panel into the containing block for position:fixed children, so the submenu's
  // viewport coordinates would otherwise be measured from the panel, not the screen
  // (confirmed: a fixed child under transform:scale(1) resolves against the panel).
  // Portaling each submenu to <body> keeps its fixed left/top true to the viewport;
  // the root panel already lives in the (untransformed) click-catcher, so it stays.
  return isRoot ? panel : ReactDOM.createPortal(panel, document.body);
}

// ── Shared clipboard helper ───────────────────────────────────────────────────
// Mirrors the silent-fallback pattern already used in OrderTracker's share
// dialog: copy if we can, never throw if the clipboard is blocked.
export async function copyToClipboard(text) {
  const s = String(text == null ? '' : text);
  if (!s) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(s);
      return true;
    }
  } catch (_) { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (_) {
    return false;
  }
}

const ContextMenuExports = { ContextMenuProvider, useContextMenu, copyToClipboard };
export default ContextMenuExports;
