// src/screens/Demos.js  
// Drop this file into website-frontend/src/screens/
// Shows both demos with proper links

import React from 'react';

const demos = [
  {
    name: 'Northpine Home Services',
    desc: 'Electrical, plumbing & HVAC — Vermont',
    href: '/demos/northpine/',
    color: '#174233',
    tag: 'Home Services',
  },
  {
    name: 'Clearwater Lawn & Landscape',
    desc: 'Mowing, cleanup & snow removal — South Jersey',
    href: '/demos/clearwater/',
    color: '#1b3a5c',
    tag: 'Lawn & Landscape',
  },
];

export default function Demos() {
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '48px 20px' }}>
      <p style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '3px', color: '#4ade80',
        textTransform: 'uppercase', marginBottom: '16px' }}>Live demo sites</p>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: '900',
        letterSpacing: '-.03em', margin: '0 0 12px', lineHeight: 1.08 }}>
        Real examples. Pick one to explore.
      </h1>
      <p style={{ fontSize: '16px', color: '#555', marginBottom: '36px', maxWidth: '480px', lineHeight: 1.7 }}>
        Each demo is a full 5-page site built for a local service business.
        Your site would look like this — with your name, logo, and photos.
      </p>
      <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {demos.map(d => (
          <a key={d.href} href={d.href}
            style={{ display: 'block', border: `2px solid ${d.color}`, borderRadius: '14px',
              padding: '24px', textDecoration: 'none', color: 'inherit',
              transition: 'transform .15s, box-shadow .15s',
              boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.06)'; }}
          >
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: '800',
              letterSpacing: '1px', textTransform: 'uppercase', padding: '4px 10px',
              background: `${d.color}18`, color: d.color, borderRadius: '4px', marginBottom: '12px' }}>
              {d.tag}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: d.color, marginBottom: '6px' }}>
              {d.name}
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>{d.desc}</div>
            <div style={{ fontWeight: '700', color: d.color, fontSize: '14px' }}>View demo →</div>
          </a>
        ))}
      </div>
      <p style={{ marginTop: '32px', fontSize: '13px', color: '#888', textAlign: 'center' }}>
        Want to discuss pricing? &nbsp;
        <a href="https://calendly.com/nate-jointprinting/30min"
          style={{ color: '#16a34a', fontWeight: '700' }}>Book a free call →</a>
      </p>
    </div>
  );
}
