// src/screens/studio/_roadTripSleep.js
//
// DOM-element builders for sleep pins on the Mapbox map. Mirrors the
// existing custom-marker pattern in RoadTripTab so the rendering stays
// consistent (CSS-styled HTML markers, not native Mapbox circles).
//
// A "sleep pin" is the night's bed — a campground (primary) or a Park &
// Ride (backup). They render as a moon/tent/parking glyph with role-tinted
// ring. The active sleep for the day has a filled center; the inactive one
// is hollow.
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

  const wrap = document.createElement('div');
  wrap.className = `jp-sleep-wrap jp-sleep-${role}${active ? ' active' : ''}`;
  wrap.style.cssText = 'cursor: pointer; pointer-events: auto;';

  const inner = document.createElement('div');
  inner.style.cssText = `
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    border: 2px solid ${color};
    background: ${fill === 'transparent' ? 'rgba(5,8,10,0.9)' : fill};
    box-shadow: 0 0 ${active ? 14 : 6}px ${color}66, 0 0 1px rgba(0,0,0,0.8);
    font-size: 15px;
    transition: transform 0.18s ease;
    transform-origin: center center;
  `;
  inner.textContent = icon;
  wrap.appendChild(inner);

  wrap.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.18)'; });
  wrap.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)'; });

  return wrap;
}

// Tight base style for every button in the popup so Mapbox / browser
// defaults can't bleed through (which was rendering buttons white).
function popupBtnBase() {
  return `
    -webkit-appearance: none !important;
    appearance: none !important;
    font-family: ${MONO} !important;
    font-size: 10px !important;
    font-weight: 800 !important;
    letter-spacing: 1px !important;
    padding: 6px 10px !important;
    border-radius: 3px !important;
    cursor: pointer !important;
    line-height: 1.2 !important;
    outline: none !important;
    text-transform: none !important;
    box-sizing: border-box !important;
    margin: 0 !important;
  `;
}

/**
 * Popup DOM for a sleep pin. Buttons: MAKE ACTIVE / SWAP TO BACKUP /
 * REPLACE / CLEAR.
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

  // Build header section
  const header = document.createElement('div');
  header.innerHTML = `
    <div style="font-size:11px; letter-spacing:1px; color:${roleColor}; margin-bottom:4px;">
      ${lead.sleepRole === 'primary' ? '⛺ PRIMARY SLEEP' : '🅿 BACKUP SLEEP'}
      ${lead.isActiveSleep ? ' · ACTIVE' : ''}
    </div>
    <div style="font-size:13px; font-weight:700; margin-bottom:6px; line-height:1.3; color:${TERM.text};">${escapeHtml(lead.name)}</div>
    <div style="font-size:10px; color:${TERM.muted}; margin-bottom:4px;">${kindLabel}</div>
    <div style="font-size:10px; color:${TERM.muted}; margin-bottom:10px;">${escapeHtml(lead.address || '')}</div>
  `;
  el.appendChild(header);

  // Build button row programmatically so each button gets explicit styling
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap;';

  const mkBtn = (label, action, fillColor, textColor, borderColor, alwaysShow = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.action = action;
    b.style.cssText = popupBtnBase()
      + `background: ${fillColor} !important;`
      + `color: ${textColor} !important;`
      + `border: 1px solid ${borderColor} !important;`;
    row.appendChild(b);
    return b;
  };

  if (!lead.isActiveSleep) {
    mkBtn('MAKE ACTIVE', 'activate', roleColor, TERM.greenDk, roleColor);
  } else if (hasBackup) {
    mkBtn('⇄ SWAP', 'activate', 'transparent', TERM.amber, TERM.amber);
  }
  mkBtn('REPLACE', 'replace', 'transparent', TERM.text, TERM.border);
  mkBtn('CLEAR',   'clear',   'transparent', TERM.red, 'rgba(248,113,113,0.4)');

  el.appendChild(row);

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
