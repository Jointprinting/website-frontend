// src/screens/studio/_roadTripSleep.js
//
// DOM-element builders for sleep pins on the Mapbox map. Mirrors the
// existing custom-marker pattern in RoadTripTab so the rendering stays
// consistent (CSS-styled HTML markers, not native Mapbox circles).
//
// A "sleep pin" is the night's bed — a campground (primary) or a Park &
// Ride (backup). They render as a moon glyph with role-tinted ring. The
// active sleep for the day has a filled center; the inactive one is hollow.

import { TERM, MONO } from './_roadTripStyle';

const SLEEP_KIND_ICON = {
  campground:    '⛺',
  park_and_ride: '🅿',
  hotel:         '🏨',
  friend:        '🏠',
  other:         '🌙',
  '':            '🌙',
};

/**
 * Build a DOM element for a sleep pin. Caller is responsible for handing it
 * to `new mapboxgl.Marker(el).setLngLat(...).addTo(map)`.
 *
 * @param {object} opts
 * @param {'primary'|'backup'} opts.role
 * @param {string} opts.sleepKind
 * @param {boolean} opts.active   — is this the day's currently-active sleep?
 */
export function buildSleepMarkerEl({ role, sleepKind, active }) {
  const color = role === 'primary' ? TERM.green : TERM.amber;
  const fill  = active ? color : 'transparent';
  const icon  = SLEEP_KIND_ICON[sleepKind] || '🌙';

  const wrap = document.createElement('div');
  wrap.className = `jp-sleep-marker jp-sleep-${role}${active ? ' active' : ''}`;
  wrap.style.cssText = `
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    border: 2px solid ${color};
    background: ${fill === 'transparent' ? 'rgba(5,8,10,0.85)' : fill};
    box-shadow: 0 0 ${active ? 12 : 6}px ${color}66;
    font-size: 14px;
    cursor: pointer;
    transition: transform 0.18s ease;
  `;
  wrap.textContent = icon;

  wrap.addEventListener('mouseenter', () => { wrap.style.transform = 'scale(1.15)'; });
  wrap.addEventListener('mouseleave', () => { wrap.style.transform = 'scale(1)'; });

  return wrap;
}

/**
 * Popup HTML for a sleep pin. Renders the name, kind, role, active status
 * and three action buttons (make active / replace / open editor).
 *
 * Returns: { el, on(name, handler) }
 *   el     — the popup root element to feed into popup.setDOMContent(el)
 *   on(name, handler) — wires a click handler to a button by data-action
 */
export function buildSleepPopup({ lead, onMakeActive, onReplace, onEdit }) {
  const el = document.createElement('div');
  el.style.cssText = `
    font-family: ${MONO}; color: ${TERM.text};
    background: ${TERM.panel}; padding: 12px; min-width: 220px;
    border: 1px solid ${TERM.border};
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
    <div style="font-size:13px; font-weight:700; margin-bottom:6px;">${escapeHtml(lead.name)}</div>
    <div style="font-size:10px; color:${TERM.muted}; margin-bottom:4px;">${kindLabel}</div>
    <div style="font-size:10px; color:${TERM.muted}; margin-bottom:10px;">${escapeHtml(lead.address || '')}</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      ${lead.isActiveSleep ? '' : `
        <button data-action="activate" style="
          font-family:${MONO}; font-size:9px; letter-spacing:1px;
          padding:5px 8px; cursor:pointer; border-radius:2px;
          background:${roleColor}; color:${TERM.greenDk}; border:1px solid ${roleColor};
          font-weight:700;">MAKE ACTIVE</button>`}
      <button data-action="replace" style="
        font-family:${MONO}; font-size:9px; letter-spacing:1px;
        padding:5px 8px; cursor:pointer; border-radius:2px;
        background:transparent; color:${TERM.text}; border:1px solid ${TERM.border};">REPLACE</button>
      <button data-action="edit" style="
        font-family:${MONO}; font-size:9px; letter-spacing:1px;
        padding:5px 8px; cursor:pointer; border-radius:2px;
        background:transparent; color:${TERM.muted}; border:1px solid ${TERM.borderDim};">EDIT</button>
    </div>
  `;

  const handlers = { activate: onMakeActive, replace: onReplace, edit: onEdit };
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
