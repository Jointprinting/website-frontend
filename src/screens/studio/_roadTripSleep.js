// src/screens/studio/_roadTripSleep.js
//
// DOM-element builders for sleep pins on the Mapbox map. Mirrors the
// existing custom-marker pattern in RoadTripTab so the rendering stays
// consistent (CSS-styled HTML markers, not native Mapbox circles).
//
// A "sleep pin" is the night's bed — a campground (primary) or a Park &
// Ride (backup). They render as a moon glyph with role-tinted ring. The
// active sleep for the day has a filled center; the inactive one is hollow.
//
// IMPORTANT: Mapbox writes `transform: translate(...)` to the marker root
// element to position it. If we put our own `transform` on the same node
// (e.g. scale on hover), we clobber Mapbox's positioning and the pin
// "jumps" to the top-left of the map. So we use the standard wrap+inner
// pattern: outer = positioning (Mapbox owns), inner = visual + animation.

import { TERM, MONO } from './_roadTripStyle';

const SLEEP_KIND_ICON = {
  campground:    '⛺',
  park_and_ride: '🅿',
  hotel:         '🏨',
  friend:        '🏠',
  other:         '🌙',
  '':            '🌙',
};

export function buildSleepMarkerEl({ role, sleepKind, active }) {
  const color = role === 'primary' ? TERM.green : TERM.amber;
  const fill  = active ? color : 'transparent';
  const icon  = SLEEP_KIND_ICON[sleepKind] || '🌙';

  // OUTER: Mapbox writes `transform: translate(...)` here. We must NOT
  // overwrite it. Keep this element layout-only.
  const wrap = document.createElement('div');
  wrap.className = `jp-sleep-wrap jp-sleep-${role}${active ? ' active' : ''}`;
  wrap.style.cssText = 'cursor: pointer; pointer-events: auto;';

  // INNER: visual styling + hover scaling lives here so it doesn't fight
  // Mapbox's positioning transform on the outer element.
  const inner = document.createElement('div');
  inner.style.cssText = `
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    border: 2px solid ${color};
    background: ${fill === 'transparent' ? 'rgba(5,8,10,0.85)' : fill};
    box-shadow: 0 0 ${active ? 12 : 6}px ${color}66;
    font-size: 14px;
    transition: transform 0.18s ease;
    transform-origin: center center;
  `;
  inner.textContent = icon;
  wrap.appendChild(inner);

  wrap.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.18)'; });
  wrap.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)'; });

  return wrap;
}

/**
 * Popup DOM for a sleep pin. Buttons: MAKE ACTIVE / SWAP TO BACKUP /
 * REPLACE / CLEAR. Caller wires onMakeActive / onReplace / onClear /
 * onEdit handlers.
 */
export function buildSleepPopup({ lead, hasBackup, onMakeActive, onReplace, onClear, onEdit }) {
  const el = document.createElement('div');
  el.style.cssText = `
    font-family: ${MONO}; color: ${TERM.text};
    background: ${TERM.panel}; padding: 12px; min-width: 240px;
    border: 1px solid ${TERM.border}; border-radius: 4px;
  `;

  const roleColor = lead.sleepRole === 'primary' ? TERM.green : TERM.amber;
  const kindLabel = {
    campground: 'CAMPGROUND', park_and_ride: 'PARK & RIDE',
    hotel: 'HOTEL', friend: 'FRIEND', other: 'OTHER',
  }[lead.sleepKind] || 'SLEEP';

  el.innerHTML = `
    <div style="font-size:11px; letter-spacing:1px; color:${roleColor}; margin-bottom:4px;">
      ${lead.sleepRole === 'primary' ? '⛺ PRIMARY SLEEP' : '🅿 BACKUP SLEEP'}
      ${lead.isActiveSleep ? ' · ACTIVE' : ''}
    </div>
    <div style="font-size:13px; font-weight:700; margin-bottom:6px; line-height:1.3;">${escapeHtml(lead.name)}</div>
    <div style="font-size:10px; color:${TERM.muted}; margin-bottom:4px;">${kindLabel}</div>
    <div style="font-size:10px; color:${TERM.muted}; margin-bottom:10px;">${escapeHtml(lead.address || '')}</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      ${lead.isActiveSleep ? '' : `
        <button data-action="activate" style="
          font-family:${MONO}; font-size:9px; letter-spacing:1px;
          padding:5px 8px; cursor:pointer; border-radius:2px;
          background:${roleColor}; color:${TERM.greenDk}; border:1px solid ${roleColor};
          font-weight:700;">MAKE ACTIVE</button>`}
      ${hasBackup && lead.isActiveSleep ? `
        <button data-action="activate" style="
          font-family:${MONO}; font-size:9px; letter-spacing:1px;
          padding:5px 8px; cursor:pointer; border-radius:2px;
          background:transparent; color:${TERM.amber}; border:1px solid ${TERM.amber};">⇄ SWAP</button>` : ''}
      <button data-action="replace" style="
        font-family:${MONO}; font-size:9px; letter-spacing:1px;
        padding:5px 8px; cursor:pointer; border-radius:2px;
        background:transparent; color:${TERM.text}; border:1px solid ${TERM.border};">REPLACE</button>
      <button data-action="clear" style="
        font-family:${MONO}; font-size:9px; letter-spacing:1px;
        padding:5px 8px; cursor:pointer; border-radius:2px;
        background:transparent; color:${TERM.red}; border:1px solid ${TERM.red}66;">CLEAR</button>
    </div>
  `;

  const handlers = { activate: onMakeActive, replace: onReplace, clear: onClear, edit: onEdit };
  el.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fn = handlers[btn.dataset.action];
      if (typeof fn === 'function') fn(lead);
    });
  });

  return el;
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
