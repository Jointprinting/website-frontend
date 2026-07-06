// src/webworks/templates/Trades.js
// JPW template: TRADES — plumbers, HVAC, electricians, landscapers.
// Design voice: bold industrial. Deep slate canvas up top, hazard-stripe
// accents, condensed uppercase Oswald headings, big numbered service cards.
// Built photo-free on purpose: color blocks, stripes, and an initials plate
// do the visual lifting so a brand-new client site looks finished on day one.
//
// Receives the site's `data` bag (see JpwSitesTab seed) and renders ONLY the
// sections that have content — no empty shells, ever.

import * as React from 'react';
import { useGoogleFonts, resolvePalette, initialsOf, telHref, txt, rows } from './_kit';
import { TRADES_PALETTES } from './_meta';

const css = (c) => `
.jpwt{--max:1120px;font-family:'Barlow','Helvetica Neue',Arial,sans-serif;background:${c.bg};color:${c.ink};line-height:1.6;overflow-x:clip;min-height:100%;}
.jpwt *,.jpwt *::before,.jpwt *::after{box-sizing:border-box;margin:0;padding:0;}
.jpwt img,.jpwt svg{max-width:100%;display:block;}
.jpwt a{text-decoration:none;}
.jpwt-wrap{max-width:var(--max);margin:0 auto;padding:0 clamp(16px,4vw,32px);}
.jpwt-h{font-family:'Oswald','Arial Narrow',sans-serif;text-transform:uppercase;letter-spacing:.03em;font-weight:600;line-height:1.12;overflow-wrap:anywhere;}

/* Nav — dark sticky bar, initials plate, phone CTA */
.jpwt-nav{position:sticky;top:0;z-index:50;background:${c.dark};color:${c.darkInk};border-bottom:3px solid ${c.accent};}
.jpwt-nav-in{display:flex;align-items:center;gap:14px;min-height:64px;}
.jpwt-mark{width:38px;height:38px;flex:0 0 auto;background:${c.accent};color:${c.accentInk};display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-weight:700;font-size:16px;letter-spacing:.04em;border-radius:4px;}
.jpwt-brand{font-family:'Oswald',sans-serif;font-weight:600;font-size:clamp(15px,2.4vw,19px);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.jpwt-links{display:flex;gap:22px;margin-left:auto;margin-right:8px;}
.jpwt-links a{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${c.darkSub};transition:color .15s;}
.jpwt-links a:hover{color:${c.accent};}
.jpwt-call{margin-left:auto;flex:0 0 auto;background:${c.accent};color:${c.accentInk};font-family:'Oswald',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:14px;padding:10px 18px;border-radius:4px;transition:transform .15s,filter .15s;white-space:nowrap;}
.jpwt-call:hover{transform:translateY(-1px);filter:brightness(1.08);}
.jpwt-links + .jpwt-call{margin-left:0;}
@media(max-width:820px){.jpwt-links{display:none;}.jpwt-call{margin-left:auto;}}
@media(max-width:480px){.jpwt-call .jpwt-call-num{display:none;}}

/* Hero — slate block, stripe edge */
.jpwt-hero{background:${c.dark};color:${c.darkInk};position:relative;}
.jpwt-hero-in{padding:clamp(56px,9vw,110px) 0 clamp(48px,8vw,96px);position:relative;z-index:1;max-width:760px;}
.jpwt-eyebrow{display:inline-flex;align-items:center;gap:10px;color:${c.accent};font-weight:700;font-size:13px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:18px;}
.jpwt-eyebrow::before{content:'';width:26px;height:3px;background:${c.accent};}
.jpwt-hero h1{font-size:clamp(34px,6.4vw,62px);color:${c.darkInk};}
.jpwt-tagline{margin-top:16px;font-size:clamp(16px,2.2vw,19px);color:${c.darkSub};max-width:56ch;overflow-wrap:anywhere;}
.jpwt-ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px;}
.jpwt-btn{display:inline-block;font-family:'Oswald',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.06em;font-size:15px;padding:14px 26px;border-radius:4px;transition:transform .15s,filter .15s,background .15s,color .15s;}
.jpwt-btn-solid{background:${c.accent};color:${c.accentInk};}
.jpwt-btn-solid:hover{transform:translateY(-2px);filter:brightness(1.08);}
.jpwt-btn-ghost{border:2px solid ${c.darkSub};color:${c.darkInk};}
.jpwt-btn-ghost:hover{border-color:${c.accent};color:${c.accent};}
.jpwt-stripe{height:12px;background:repeating-linear-gradient(-45deg,${c.accent} 0 14px,transparent 14px 28px);opacity:.9;}
.jpwt-hero-ghost{position:absolute;right:-8px;bottom:-14px;font-family:'Oswald',sans-serif;font-weight:700;font-size:clamp(90px,17vw,210px);line-height:1;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.07);user-select:none;pointer-events:none;text-transform:uppercase;white-space:nowrap;}

/* Cred bar — est / license / service area */
.jpwt-cred{background:${c.surface};border-bottom:1px solid ${c.line};}
.jpwt-cred-in{display:flex;flex-wrap:wrap;}
.jpwt-cred-item{flex:1 1 220px;min-width:0;padding:18px 20px;border-left:1px solid ${c.line};display:flex;flex-direction:column;gap:2px;}
.jpwt-cred-item:first-child{border-left:none;padding-left:0;}
.jpwt-cred-k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${c.sub};}
.jpwt-cred-v{font-family:'Oswald',sans-serif;font-size:17px;font-weight:600;letter-spacing:.02em;overflow-wrap:anywhere;}
@media(max-width:640px){.jpwt-cred-item{flex:1 1 100%;border-left:none;padding-left:0;border-top:1px solid ${c.line};}.jpwt-cred-item:first-child{border-top:none;}}

/* Section scaffolding */
.jpwt-sec{padding:clamp(52px,8vw,92px) 0;}
.jpwt-sec-head{margin-bottom:clamp(28px,4vw,44px);}
.jpwt-kicker{color:${c.accent};font-weight:700;font-size:13px;letter-spacing:.18em;text-transform:uppercase;display:inline-flex;align-items:center;gap:10px;}
.jpwt-kicker::before{content:'';width:26px;height:3px;background:${c.accent};}
.jpwt-sec-head h2{font-size:clamp(26px,4.4vw,40px);margin-top:10px;}

/* Services — numbered cards */
.jpwt-svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:18px;}
.jpwt-svc{background:${c.surface};border:1px solid ${c.line};border-left:4px solid ${c.accent};padding:24px 22px 22px;position:relative;overflow:hidden;transition:transform .18s,box-shadow .18s;min-width:0;}
.jpwt-svc:hover{transform:translateY(-3px);box-shadow:0 14px 30px -18px rgba(10,16,22,.35);}
.jpwt-svc-num{position:absolute;top:6px;right:10px;font-family:'Oswald',sans-serif;font-weight:700;font-size:44px;color:${c.soft};line-height:1;user-select:none;}
.jpwt-svc h3{font-family:'Oswald',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.03em;font-size:18px;position:relative;overflow-wrap:anywhere;padding-right:44px;}
.jpwt-svc p{margin-top:8px;font-size:14.5px;color:${c.sub};overflow-wrap:anywhere;}
.jpwt-price{display:inline-block;margin-top:14px;font-family:'Oswald',sans-serif;font-weight:600;font-size:14px;letter-spacing:.04em;background:${c.soft};padding:4px 10px;border-radius:3px;}

/* About — text + fact plate */
.jpwt-about{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(28px,5vw,56px);align-items:start;}
.jpwt-about-txt p{font-size:clamp(15.5px,1.9vw,17px);color:${c.sub};white-space:pre-line;overflow-wrap:anywhere;}
.jpwt-plate{background:${c.dark};color:${c.darkInk};padding:28px 26px;border-top:6px solid ${c.accent};}
.jpwt-plate .jpwt-mark{width:52px;height:52px;font-size:22px;margin-bottom:18px;}
.jpwt-fact{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px dashed rgba(255,255,255,.16);font-size:14px;}
.jpwt-fact:last-child{border-bottom:none;}
.jpwt-fact b{color:${c.darkSub};font-weight:600;flex:0 0 auto;}
.jpwt-fact span{text-align:right;overflow-wrap:anywhere;min-width:0;}
@media(max-width:760px){.jpwt-about{grid-template-columns:1fr;}}

/* Testimonials — dark band */
.jpwt-quotes{background:${c.dark};color:${c.darkInk};}
.jpwt-quotes .jpwt-sec-head h2{color:${c.darkInk};}
.jpwt-q-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:18px;}
.jpwt-q{border:1px solid rgba(255,255,255,.14);padding:24px 22px;position:relative;min-width:0;}
.jpwt-q::before{content:'“';font-family:'Oswald',sans-serif;color:${c.accent};font-size:46px;line-height:1;display:block;margin-bottom:8px;}
.jpwt-q p{font-size:15.5px;color:${c.darkSub};overflow-wrap:anywhere;}
.jpwt-q cite{display:block;margin-top:14px;font-style:normal;font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:${c.accent};}

/* Hours + area */
.jpwt-hours{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(28px,5vw,56px);align-items:start;}
.jpwt-hrow{display:flex;justify-content:space-between;gap:16px;padding:12px 2px;border-bottom:1px dashed ${c.line};font-size:15px;}
.jpwt-hrow b{font-weight:600;}
.jpwt-hrow span{color:${c.sub};text-align:right;overflow-wrap:anywhere;}
.jpwt-area{background:${c.surface};border:1px solid ${c.line};padding:24px 22px;}
.jpwt-area h3{font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:17px;margin-bottom:8px;}
.jpwt-area p{font-size:14.5px;color:${c.sub};overflow-wrap:anywhere;}
.jpwt-area p + h3{margin-top:20px;}
@media(max-width:760px){.jpwt-hours{grid-template-columns:1fr;}}

/* Contact / footer */
.jpwt-cta-band{background:${c.dark};color:${c.darkInk};text-align:center;}
.jpwt-cta-band h2{font-size:clamp(28px,5vw,46px);color:${c.darkInk};}
.jpwt-cta-band .jpwt-sub{color:${c.darkSub};margin-top:10px;font-size:16px;overflow-wrap:anywhere;}
.jpwt-cta-band .jpwt-ctas{justify-content:center;}
.jpwt-contact-lines{margin-top:26px;display:flex;flex-direction:column;gap:6px;align-items:center;}
.jpwt-contact-lines a{color:${c.darkSub};font-size:15px;transition:color .15s;overflow-wrap:anywhere;}
.jpwt-contact-lines a:hover{color:${c.accent};}
.jpwt-foot{background:${c.dark};color:${c.darkSub};border-top:1px solid rgba(255,255,255,.1);}
.jpwt-foot-in{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;padding:20px 0;font-size:13px;}
`;

export default function TradesTemplate({ data }) {
  const d = data || {};
  useGoogleFonts('family=Oswald:wght@500;600;700&family=Barlow:wght@400;500;600;700');
  const pal = resolvePalette(TRADES_PALETTES, d.paletteId);
  const style = React.useMemo(() => css(pal.c), [pal]);

  const name = txt(d.businessName) || 'Your Business';
  const phone = txt(d.phone);
  const email = txt(d.email);
  const address = txt(d.address);
  const area = txt(d.serviceArea);
  const about = txt(d.about);
  const established = txt(d.established);
  const license = txt(d.license);
  const services = rows(d.services, 'name');
  const hours = rows(d.hours, 'days', 'hours');
  const quotes = rows(d.testimonials, 'quote');

  const headline = txt(d.heroHeadline) || txt(d.tagline) || name;
  const ctaLabel = txt(d.ctaLabel) || (phone ? 'Call now' : 'Get in touch');
  const ctaHref = phone ? telHref(phone) : (email ? `mailto:${email}` : null);
  const hasCred = !!(established || license || area);
  const hasContact = !!(phone || email || address || area);
  const year = new Date().getFullYear();

  // Anchor nav only lists sections that actually render.
  const navLinks = [
    services.length && ['#services', 'Services'],
    about && ['#about', 'About'],
    hours.length && ['#hours', 'Hours'],
    hasContact && ['#contact', 'Contact'],
  ].filter(Boolean);

  return (
    <div className="jpwt">
      <style>{style}</style>

      <nav className="jpwt-nav">
        <div className="jpwt-wrap jpwt-nav-in">
          <div className="jpwt-mark" aria-hidden="true">{initialsOf(name)}</div>
          <div className="jpwt-brand">{name}</div>
          {navLinks.length > 0 && (
            <div className="jpwt-links">
              {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            </div>
          )}
          {phone && (
            <a className="jpwt-call" href={telHref(phone)}>
              Call <span className="jpwt-call-num">{phone}</span>
            </a>
          )}
        </div>
      </nav>

      <header className="jpwt-hero">
        <div className="jpwt-wrap" style={{ position: 'relative' }}>
          <div className="jpwt-hero-in">
            {area && <span className="jpwt-eyebrow">Serving {area}</span>}
            <h1 className="jpwt-h">{headline}</h1>
            {txt(d.tagline) && txt(d.tagline) !== headline && (
              <p className="jpwt-tagline">{txt(d.tagline)}</p>
            )}
            {ctaHref && (
              <div className="jpwt-ctas">
                <a className="jpwt-btn jpwt-btn-solid" href={ctaHref}>{ctaLabel}</a>
                {phone && email && (
                  <a className="jpwt-btn jpwt-btn-ghost" href={`mailto:${email}`}>Request a quote</a>
                )}
              </div>
            )}
          </div>
          <div className="jpwt-hero-ghost" aria-hidden="true">{initialsOf(name)}</div>
        </div>
        <div className="jpwt-stripe" aria-hidden="true" />
      </header>

      {hasCred && (
        <div className="jpwt-cred">
          <div className="jpwt-wrap jpwt-cred-in">
            {established && (
              <div className="jpwt-cred-item"><span className="jpwt-cred-k">In business since</span><span className="jpwt-cred-v">{established}</span></div>
            )}
            {license && (
              <div className="jpwt-cred-item"><span className="jpwt-cred-k">Licensed &amp; insured</span><span className="jpwt-cred-v">{license}</span></div>
            )}
            {area && (
              <div className="jpwt-cred-item"><span className="jpwt-cred-k">Service area</span><span className="jpwt-cred-v">{area}</span></div>
            )}
          </div>
        </div>
      )}

      {services.length > 0 && (
        <section className="jpwt-sec" id="services">
          <div className="jpwt-wrap">
            <div className="jpwt-sec-head">
              <span className="jpwt-kicker">What we do</span>
              <h2 className="jpwt-h">Services</h2>
            </div>
            <div className="jpwt-svc-grid">
              {services.map((s, i) => (
                <div className="jpwt-svc" key={i}>
                  <span className="jpwt-svc-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{txt(s.name)}</h3>
                  {txt(s.desc) && <p>{txt(s.desc)}</p>}
                  {txt(s.price) && <span className="jpwt-price">{txt(s.price)}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {about && (
        <section className="jpwt-sec" id="about" style={{ background: pal.c.soft }}>
          <div className="jpwt-wrap jpwt-about">
            <div className="jpwt-about-txt">
              <div className="jpwt-sec-head">
                <span className="jpwt-kicker">Who we are</span>
                <h2 className="jpwt-h">About {name}</h2>
              </div>
              <p>{about}</p>
            </div>
            <aside className="jpwt-plate">
              <div className="jpwt-mark" aria-hidden="true">{initialsOf(name)}</div>
              {established && <div className="jpwt-fact"><b>Since</b><span>{established}</span></div>}
              {license && <div className="jpwt-fact"><b>License</b><span>{license}</span></div>}
              {area && <div className="jpwt-fact"><b>Serving</b><span>{area}</span></div>}
              {phone && <div className="jpwt-fact"><b>Phone</b><span>{phone}</span></div>}
            </aside>
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="jpwt-sec jpwt-quotes">
          <div className="jpwt-wrap">
            <div className="jpwt-sec-head">
              <span className="jpwt-kicker">Word around town</span>
              <h2 className="jpwt-h">What customers say</h2>
            </div>
            <div className="jpwt-q-grid">
              {quotes.map((q, i) => (
                <blockquote className="jpwt-q" key={i}>
                  <p>{txt(q.quote)}</p>
                  {txt(q.name) && <cite>— {txt(q.name)}</cite>}
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {(hours.length > 0 || area || address) && (
        <section className="jpwt-sec" id="hours">
          <div className="jpwt-wrap jpwt-hours">
            {hours.length > 0 && (
              <div>
                <div className="jpwt-sec-head">
                  <span className="jpwt-kicker">When we work</span>
                  <h2 className="jpwt-h">Hours</h2>
                </div>
                {hours.map((h, i) => (
                  <div className="jpwt-hrow" key={i}>
                    <b>{txt(h.days) || '—'}</b><span>{txt(h.hours) || '—'}</span>
                  </div>
                ))}
              </div>
            )}
            {(area || address) && (
              <div className="jpwt-area">
                {area && (<><h3>Service area</h3><p>{area}</p></>)}
                {address && (<><h3>Find us</h3><p>{address}</p></>)}
              </div>
            )}
          </div>
        </section>
      )}

      {hasContact && (
        <section className="jpwt-sec jpwt-cta-band" id="contact">
          <div className="jpwt-wrap">
            <h2 className="jpwt-h">Ready when you are</h2>
            {(txt(d.tagline) || area) && (
              <p className="jpwt-sub">{txt(d.tagline) || `Proudly serving ${area}.`}</p>
            )}
            {ctaHref && (
              <div className="jpwt-ctas">
                <a className="jpwt-btn jpwt-btn-solid" href={ctaHref}>{ctaLabel}</a>
              </div>
            )}
            <div className="jpwt-contact-lines">
              {phone && <a href={telHref(phone)}>{phone}</a>}
              {email && <a href={`mailto:${email}`}>{email}</a>}
              {address && <span style={{ fontSize: 14, color: pal.c.darkSub }}>{address}</span>}
            </div>
          </div>
        </section>
      )}

      <footer className="jpwt-foot">
        <div className="jpwt-wrap jpwt-foot-in">
          <span>© {year} {name}</span>
          {license && <span>License {license}</span>}
        </div>
      </footer>
    </div>
  );
}
