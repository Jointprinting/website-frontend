// src/screens/demos.js
// Routed at /demos in App.js
// Shows both demo sites with JP Webworks branding

import React from 'react';

const DEMOS = [
  {
    name: 'Northpine Home Services',
    desc: 'Electrical, plumbing & HVAC for Vermont homeowners. Full 5-page site with services, gallery, reviews, and contact form.',
    href: '/demos/northpine/',
    tag: 'Home Services',
    color: '#174233',
    accent: '#2a6a52',
    img: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=70',
  },
  {
    name: 'Clearwater Lawn & Landscape',
    desc: 'Mowing, mulch, cleanup & snow removal for South Jersey homeowners. 5-page site with real photos and a quote form.',
    href: '/demos/clearwater/',
    tag: 'Lawn & Landscape',
    color: '#1b3a5c',
    accent: '#ea6c2e',
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=70',
  },
];

const TIERS = [
  { name: 'Starter', price: '$99', desc: 'Set it and forget it', features: ['1–3 page site', 'Hosting + SSL', 'Contact form', 'Basic SEO', 'No edits included'] },
  { name: 'Standard', price: '$149', desc: 'Best value for most', features: ['1–5 pages', 'Everything in Starter', 'Local SEO + schema', 'Google Search Console', '1 edit/month'], recommended: true },
  { name: 'Growth', price: '$249', desc: 'Steady improvements', features: ['Everything in Standard', 'Google Business refresh', '1 content update/mo', 'Monthly lead summary', '2 edits/month'] },
  { name: 'Partner', price: '$499', desc: 'Full help + priority', features: ['Up to 10 pages', 'Everything in Growth', 'Priority edits (1–2 days)', 'Monthly tune-ups', 'Up to 6 edits/month'] },
];

export default function Demos() {
  return (
    <div style={{ background: '#0e1511', minHeight: '100vh', color: '#fff', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>

      {/* HERO */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px 48px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: '#4ade80', textTransform: 'uppercase', marginBottom: 16 }}>
          JP Webworks — Live Demo Sites
        </div>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 54px)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.08 }}>
          Your business needs a site<br />
          <span style={{ color: '#4ade80' }}>that gets your phone ringing.</span>
        </h1>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,.62)', lineHeight: 1.7, maxWidth: 520, margin: '0 0 32px' }}>
          Mobile-friendly, fast, and built for local service businesses. See two real examples — then pick a plan.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="#demos" style={{ background: 'linear-gradient(135deg,#4ade80,#16a34a)', color: '#0e1511', fontWeight: 800, fontSize: 15, padding: '13px 26px', borderRadius: 12, textDecoration: 'none' }}>
            See the demos
          </a>
          <a href="#pricing" style={{ border: '1px solid rgba(255,255,255,.25)', color: 'rgba(255,255,255,.8)', fontWeight: 700, fontSize: 15, padding: '13px 26px', borderRadius: 12, textDecoration: 'none' }}>
            View pricing
          </a>
        </div>
      </div>

      {/* DEMO CARDS */}
      <div id="demos" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', marginBottom: 24 }}>
          Live demo sites — click to explore
        </div>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {DEMOS.map(d => (
            <a key={d.href} href={d.href}
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)', borderRadius: 20, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block', transition: 'transform .18s, border-color .18s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.24)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,.10)'; }}
            >
              <img src={d.img} alt={d.name} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: 22 }}>
                <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', padding: '5px 10px', background: `${d.color}30`, color: d.accent || '#4ade80', borderRadius: 6, marginBottom: 12 }}>
                  {d.tag}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 8 }}>{d.name}</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.58)', lineHeight: 1.65, margin: '0 0 18px' }}>{d.desc}</p>
                <div style={{ fontWeight: 700, fontSize: 14, color: d.accent || '#4ade80' }}>View demo →</div>
              </div>
            </a>
          ))}
        </div>
        <div style={{ background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.18)', borderRadius: 12, padding: '16px 20px', fontSize: 14, color: 'rgba(255,255,255,.65)', textAlign: 'center', marginTop: 20 }}>
          Your site looks like these — built with <strong style={{ color: 'rgba(255,255,255,.88)' }}>your business name, logo, colors, and photos.</strong> Draft ready in <strong style={{ color: 'rgba(255,255,255,.88)' }}>~3 business days.</strong>
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', marginBottom: 24 }}>
          Plans &amp; pricing
        </div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {TIERS.map(t => (
            <div key={t.name} style={{ background: t.recommended ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.04)', border: t.recommended ? '1px solid #4ade80' : '1px solid rgba(255,255,255,.10)', borderRadius: 18, padding: 22, position: 'relative' }}>
              {t.recommended && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#4ade80', color: '#0e1511', fontSize: 11, fontWeight: 900, letterSpacing: 1, padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  RECOMMENDED
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>{t.name}</div>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.03em', marginBottom: 4 }}>
                {t.price}<span style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,.45)' }}>/mo</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginBottom: 16 }}>{t.desc}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {t.features.map(f => (
                  <li key={f} style={{ fontSize: 13, color: 'rgba(255,255,255,.68)', display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.45 }}>
                    <span style={{ color: '#4ade80', fontWeight: 900, flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.35)' }}>
          All plans include setup, hosting, SSL, and a mobile-friendly build. Month-to-month, no contracts.
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', marginBottom: 24 }}>
          How it works
        </div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {[
            { n: '01', title: 'Pick a plan', body: 'Choose your tier. Sign the one-page agreement and pay the first month. Takes 5 minutes.' },
            { n: '02', title: 'Send your info', body: 'Business name, phone, services, hours, and any photos you have. We handle the rest.' },
            { n: '03', title: 'Live in ~3 days', body: 'Draft in 3 business days. We connect your domain, turn on SSL, and you\'re live within a week.' },
          ].map(s => (
            <div key={s.n} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#4ade80', letterSpacing: 2, marginBottom: 10 }}>{s.n}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.52)', lineHeight: 1.65, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FINAL CTA */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', textAlign: 'center', padding: '64px 24px 72px' }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-.03em' }}>
          Ready to get your site up?
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,.55)', maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.7 }}>
          Book a free 30-minute call. Pick a plan, share your info, and we'll have your draft ready in days.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://calendly.com/nate-jointprinting/30min" target="_blank" rel="noopener noreferrer"
            style={{ background: 'linear-gradient(135deg,#4ade80,#16a34a)', color: '#0e1511', fontWeight: 800, fontSize: 15, padding: '13px 26px', borderRadius: 12, textDecoration: 'none' }}>
            Book a free call
          </a>
          <a href="mailto:nate@jointprinting.com"
            style={{ border: '1px solid rgba(255,255,255,.22)', color: 'rgba(255,255,255,.8)', fontWeight: 700, fontSize: 15, padding: '13px 26px', borderRadius: 12, textDecoration: 'none' }}>
            Email instead
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 13, color: 'rgba(255,255,255,.3)', maxWidth: 1100, margin: '0 auto' }}>
        <div>JP Webworks · by <a href="https://jointprinting.com" style={{ color: 'rgba(255,255,255,.3)' }}>Joint Printing LLC</a></div>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="/demos/northpine/" style={{ color: 'rgba(255,255,255,.3)' }}>Northpine demo</a>
          <a href="/demos/clearwater/" style={{ color: 'rgba(255,255,255,.3)' }}>Clearwater demo</a>
          <a href="https://calendly.com/nate-jointprinting/30min" style={{ color: 'rgba(255,255,255,.3)' }}>Book a call</a>
        </div>
      </div>

    </div>
  );
}
