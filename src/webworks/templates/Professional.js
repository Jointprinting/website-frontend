// src/webworks/templates/Professional.js
// JPW template: PROFESSIONAL — law, accounting, insurance, consulting.
// Design voice: composed and credible. Baskerville serif headings on a strict
// ruled grid, a navy/slate/burgundy authority color, an "At a glance" facts
// panel floating on a MUTED photo header band (heavy paper wash + fine rules
// over the photo — presence without noise), numbered practice areas, and a
// restrained photo strip. Photos are fail-safe: curated office/desk defaults
// ship with the template (owner URLs override via data.photos) over crafted
// pinstripe underlayers.

import * as React from 'react';
import {
  useGoogleFonts, resolvePalette, initialsOf, telHref, txt, rows,
  mergePhotos, Ph, PH_CSS,
} from './_kit';
import { PROFESSIONAL_PALETTES } from './_meta';

// Curated defaults — well-known Unsplash office/practice photography. Owner-
// supplied data.photos.{hero,gallery} replace these slot-for-slot.
const DEFAULT_PHOTOS = {
  hero: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=80',
  gallery: [
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80',
  ],
};

// Crafted no-photo tile: paper field, fine pinstripes, a ruled emblem.
function ProfessionalFx({ c, glyph }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={`pfx-${uid}`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 14L14 0" stroke={c.dark} strokeWidth=".8" opacity=".1" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill={c.soft} />
      <rect width="400" height="300" fill={`url(#pfx-${uid})`} />
      <rect x="14" y="14" width="372" height="272" fill="none" stroke={c.dark} strokeWidth="1" opacity=".35" />
      <rect x="20" y="20" width="360" height="260" fill="none" stroke={c.dark} strokeWidth=".6" opacity=".25" />
      <path d="M120 150h56M224 150h56" stroke={c.accent} strokeWidth="1.5" opacity=".8" />
      <g transform="translate(200 150)" fill="none" stroke={c.dark}
        strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity=".6">
        {glyph === 'column' && (<>
          <path d="M-18 -26h36M-18 26h36M-22 32h44" />
          <path d="M-12 -26v52M0 -26v52M12 -26v52" />
          <path d="M-20 -32h40l-20 -8z" />
        </>)}
        {glyph === 'pen' && (<>
          <path d="M-24 24L14 -14l10 10L-14 34l-14 4z" />
          <path d="M14 -14l6 -6c3 -3 8 -3 10 0c3 2 3 7 0 10l-6 6" />
        </>)}
        {glyph === 'scale' && (<>
          <path d="M0 -30v56M-16 30h32" />
          <path d="M-26 -18h52" />
          <path d="M-26 -18l-10 22a12 8 0 0 0 20 0zM26 -18l-10 22a12 8 0 0 0 20 0z" />
        </>)}
      </g>
    </svg>
  );
}

const css = (c, hero) => `
.jpwp{--max:1100px;font-family:'Libre Franklin','Helvetica Neue',Arial,sans-serif;background:${c.bg};color:${c.ink};line-height:1.65;overflow-x:clip;min-height:100%;}
.jpwp *,.jpwp *::before,.jpwp *::after{box-sizing:border-box;margin:0;padding:0;}
.jpwp a{text-decoration:none;}
.jpwp-wrap{max-width:var(--max);margin:0 auto;padding:0 clamp(16px,4vw,32px);}
/* display serif never breaks mid-word — break-word only splits a word wider
   than the whole line, which real headlines never are at these clamps */
.jpwp-serif{font-family:'Libre Baskerville',Georgia,serif;font-weight:700;line-height:1.2;overflow-wrap:break-word;}
.jpwp-sc{font-size:11.5px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${c.sub};}

/* Nav — white, monogram, consult button */
.jpwp-topline{height:4px;background:${c.dark};}
.jpwp-nav{position:sticky;top:0;z-index:50;background:${c.bg};border-bottom:1px solid ${c.line};}
.jpwp-nav-in{display:flex;align-items:center;gap:14px;min-height:66px;}
.jpwp-mono{width:40px;height:40px;flex:0 0 auto;background:${c.dark};color:${c.darkInk};display:flex;align-items:center;justify-content:center;font-family:'Libre Baskerville',Georgia,serif;font-size:15px;}
.jpwp-brand{font-family:'Libre Baskerville',Georgia,serif;font-weight:700;font-size:clamp(15px,2.3vw,18px);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.jpwp-links{display:flex;gap:22px;margin-left:auto;}
.jpwp-links a{font-size:13px;font-weight:500;color:${c.sub};transition:color .15s;}
.jpwp-links a:hover{color:${c.ink};}
.jpwp-phone{font-size:13.5px;font-weight:600;color:${c.ink};white-space:nowrap;transition:color .15s;}
.jpwp-phone:hover{color:${c.accent};}
.jpwp-consult{flex:0 0 auto;background:${c.dark};color:${c.darkInk};font-weight:600;font-size:13.5px;padding:11px 20px;transition:background .15s,transform .15s;white-space:nowrap;}
.jpwp-consult:hover{transform:translateY(-1px);background:color-mix(in srgb,${c.dark} 86%,${c.accent});}
.jpwp-nav .jpwp-phone{margin-left:auto;}
.jpwp-nav .jpwp-links + .jpwp-phone{margin-left:0;}
@media(max-width:860px){.jpwp-links{display:none;}}
@media(max-width:560px){.jpwp-phone{display:none;}.jpwp-consult{margin-left:auto;}}

/* Hero — split: statement / at-a-glance panel, floating on a MUTED photo
   header band: heavy paper wash + fine ruled overlay over the photo, so the
   photo is presence, not noise. The wash alone still reads composed. */
.jpwp-hero{padding:clamp(30px,4.5vw,52px) 0 clamp(52px,8vw,100px);border-bottom:1px solid ${c.line};position:relative;
  background-color:${c.soft};
  background-image:
    repeating-linear-gradient(0deg,transparent 0 52px,${c.line}66 52px 53px),
    linear-gradient(97deg,${c.bg}fc 0%,${c.bg}f5 44%,${c.bg}b3 100%),
    url('${hero}'),
    linear-gradient(120deg,${c.soft},${c.bg} 70%);
  background-size:auto,cover,cover,cover;background-position:center;}
.jpwp-hero-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(28px,5vw,64px);align-items:start;}
.jpwp-eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:18px;}
.jpwp-eyebrow::before{content:'';width:34px;height:2px;background:${c.accent};}
.jpwp-hero h1{font-size:clamp(30px,5.2vw,52px);}
.jpwp-hero .tag{margin-top:18px;font-size:clamp(15.5px,2vw,18px);color:${c.sub};max-width:54ch;overflow-wrap:anywhere;}
.jpwp-ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px;}
.jpwp-btn-line{display:inline-block;border:1.5px solid ${c.dark};color:${c.dark};font-weight:600;font-size:13.5px;padding:12px 22px;transition:background .15s,color .15s;}
.jpwp-btn-line:hover{background:${c.dark};color:${c.darkInk};}
.jpwp-glance{border:1px solid ${c.line};border-top:5px solid ${c.accent};background:${c.surface};padding:26px 24px;box-shadow:0 18px 40px -30px rgba(20,30,45,.35);}
.jpwp-glance h3{font-family:'Libre Baskerville',Georgia,serif;font-size:16px;margin-bottom:6px;}
.jpwp-grow{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid ${c.line};font-size:14px;}
.jpwp-grow:last-child{border-bottom:none;}
.jpwp-grow b{color:${c.sub};font-weight:600;flex:0 0 auto;font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding-top:2px;}
.jpwp-grow span{text-align:right;min-width:0;overflow-wrap:anywhere;}
@media(max-width:800px){.jpwp-hero-grid{grid-template-columns:1fr;}}

/* Sections */
.jpwp-sec{padding:clamp(50px,8vw,92px) 0;}
.jpwp-sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:18px;border-bottom:2px solid ${c.dark};padding-bottom:14px;margin-bottom:clamp(26px,4vw,40px);flex-wrap:wrap;}
.jpwp-sec-head h2{font-size:clamp(24px,3.8vw,36px);}

/* Practice areas — ruled 2-col */
.jpwp-areas{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:0 clamp(28px,5vw,64px);}
.jpwp-area{padding:22px 0;border-bottom:1px solid ${c.line};display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 18px;align-items:baseline;min-width:0;}
.jpwp-area .no{font-size:12px;letter-spacing:.14em;color:${c.accent};font-weight:700;}
.jpwp-area h3{font-family:'Libre Baskerville',Georgia,serif;font-size:18.5px;overflow-wrap:anywhere;}
.jpwp-area .pr{font-size:13px;font-weight:600;color:${c.sub};white-space:nowrap;}
.jpwp-area p{grid-column:2 / -1;font-size:14.5px;color:${c.sub};overflow-wrap:anywhere;}

/* About — 5/7 with vertical rule */
.jpwp-about{background:${c.soft};}
.jpwp-about-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(26px,4vw,56px);}
.jpwp-about-grid h2{font-size:clamp(24px,3.8vw,36px);margin-top:12px;}
.jpwp-about-grid .txt{border-left:2px solid ${c.accent};padding-left:clamp(18px,3vw,32px);font-size:clamp(15px,1.9vw,16.5px);color:${c.sub};white-space:pre-line;overflow-wrap:anywhere;}
@media(max-width:720px){.jpwp-about-grid{grid-template-columns:1fr;}.jpwp-about-grid .txt{border-left:none;padding-left:0;border-top:2px solid ${c.accent};padding-top:18px;}}

/* Photo strip — restrained, ruled captions */
.jpwp-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:18px;}
.jpwp-strip .jpw-ph{aspect-ratio:4/3;border:1px solid ${c.line};border-top:4px solid ${c.accent};}
.jpwp-strip .jpw-ph>img{filter:saturate(.72) contrast(.98);}

/* Testimonials — bordered columns */
.jpwp-q-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:18px;}
.jpwp-q{border:1px solid ${c.line};border-left:4px solid ${c.accent};padding:24px 22px;background:${c.surface};min-width:0;}
.jpwp-q p{font-family:'Libre Baskerville',Georgia,serif;font-style:italic;font-size:15.5px;line-height:1.6;overflow-wrap:anywhere;}
.jpwp-q cite{display:block;margin-top:14px;font-style:normal;font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${c.sub};}

/* Hours + contact */
.jpwp-hc{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,4vw,48px);align-items:start;}
.jpwp-hours{border:1px solid ${c.line};}
.jpwp-hrow{display:flex;justify-content:space-between;gap:16px;padding:13px 18px;border-bottom:1px solid ${c.line};font-size:14.5px;}
.jpwp-hrow:last-child{border-bottom:none;}
.jpwp-hrow:nth-child(even){background:${c.soft};}
.jpwp-hrow b{font-weight:600;}
.jpwp-hrow span{color:${c.sub};text-align:right;overflow-wrap:anywhere;}
.jpwp-contact{background:${c.dark};color:${c.darkInk};padding:28px 26px;}
.jpwp-contact h3{font-family:'Libre Baskerville',Georgia,serif;font-size:20px;margin-bottom:6px;}
.jpwp-contact .sub{font-size:14px;color:${c.darkSub};margin-bottom:18px;overflow-wrap:anywhere;}
.jpwp-cline{display:block;padding:11px 0;border-top:1px solid rgba(255,255,255,.14);font-size:15px;color:${c.darkInk};transition:color .15s;overflow-wrap:anywhere;}
a.jpwp-cline:hover{color:${c.accent};}
.jpwp-cline b{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${c.darkSub};font-weight:600;margin-bottom:2px;}
@media(max-width:760px){.jpwp-hc{grid-template-columns:1fr;}}

/* Footer */
.jpwp-foot{background:${c.dark};color:${c.darkSub};margin-top:clamp(30px,5vw,60px);}
.jpwp-foot-in{padding:34px 0 26px;display:flex;flex-wrap:wrap;gap:14px 30px;align-items:center;justify-content:space-between;}
.jpwp-foot .fname{font-family:'Libre Baskerville',Georgia,serif;color:${c.darkInk};font-size:17px;overflow-wrap:anywhere;}
.jpwp-foot .fine{font-size:12.5px;}
`;

export default function ProfessionalTemplate({ data }) {
  const d = data || {};
  useGoogleFonts('family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Libre+Franklin:wght@400;500;600;700');
  const pal = resolvePalette(PROFESSIONAL_PALETTES, d.paletteId);
  const photos = React.useMemo(() => mergePhotos(d.photos, DEFAULT_PHOTOS), [d.photos]);
  const style = React.useMemo(
    () => css(pal.c, photos.hero) + PH_CSS('.jpwp', `linear-gradient(135deg,${pal.c.soft},${pal.c.bg})`),
    [pal, photos.hero]
  );

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
  const ctaLabel = txt(d.ctaLabel) || 'Request a consultation';
  const ctaHref = email ? `mailto:${email}` : (phone ? telHref(phone) : null);
  const glanceRows = [
    established && ['Established', established],
    license && ['Credentials', license],
    area && ['Serving', area],
    hours[0] && (txt(hours[0].days) || txt(hours[0].hours)) &&
      ['Hours', [txt(hours[0].days), txt(hours[0].hours)].filter(Boolean).join(' · ')],
  ].filter(Boolean);
  const hasContact = !!(phone || email || address);
  const year = new Date().getFullYear();

  const navLinks = [
    services.length && ['#practice', 'Services'],
    about && ['#firm', 'About'],
    hasContact && ['#contact', 'Contact'],
  ].filter(Boolean);

  return (
    <div className="jpwp">
      <style>{style}</style>
      <div className="jpwp-topline" aria-hidden="true" />

      <nav className="jpwp-nav">
        <div className="jpwp-wrap jpwp-nav-in">
          <div className="jpwp-mono" aria-hidden="true">{initialsOf(name)}</div>
          <div className="jpwp-brand">{name}</div>
          {navLinks.length > 0 && (
            <div className="jpwp-links">
              {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            </div>
          )}
          {phone && <a className="jpwp-phone" href={telHref(phone)}>{phone}</a>}
          {ctaHref && <a className="jpwp-consult" href={ctaHref}>{ctaLabel}</a>}
        </div>
      </nav>

      <header className="jpwp-hero">
        <div className="jpwp-wrap jpwp-hero-grid">
          <div>
            <div className="jpwp-eyebrow"><span className="jpwp-sc">{area ? `Serving ${area}` : name}</span></div>
            <h1 className="jpwp-serif">{headline}</h1>
            {txt(d.tagline) && txt(d.tagline) !== headline && (
              <p className="tag">{txt(d.tagline)}</p>
            )}
            <div className="jpwp-ctas">
              {ctaHref && <a className="jpwp-consult" href={ctaHref}>{ctaLabel}</a>}
              {phone && email && <a className="jpwp-btn-line" href={telHref(phone)}>Call {phone}</a>}
            </div>
          </div>
          {glanceRows.length > 0 && (
            <aside className="jpwp-glance">
              <h3>At a glance</h3>
              {glanceRows.map(([k, v]) => (
                <div className="jpwp-grow" key={k}><b>{k}</b><span>{v}</span></div>
              ))}
            </aside>
          )}
        </div>
      </header>

      {services.length > 0 && (
        <section className="jpwp-sec" id="practice" style={{ paddingTop: 0 }}>
          <div className="jpwp-wrap">
            <div className="jpwp-sec-head">
              <h2 className="jpwp-serif">What we handle</h2>
              <span className="jpwp-sc">{String(services.length).padStart(2, '0')} services</span>
            </div>
            <div className="jpwp-areas">
              {services.map((s, i) => (
                <div className="jpwp-area" key={i}>
                  <span className="no">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{txt(s.name)}</h3>
                  <span className="pr">{txt(s.price)}</span>
                  {txt(s.desc) && <p>{txt(s.desc)}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {about && (
        <section className="jpwp-sec jpwp-about" id="firm">
          <div className="jpwp-wrap jpwp-about-grid">
            <div>
              <span className="jpwp-sc">About the practice</span>
              <h2 className="jpwp-serif">{name}</h2>
            </div>
            <p className="txt">{about}</p>
          </div>
        </section>
      )}

      {photos.gallery.length > 0 && (
        <section className="jpwp-sec" aria-label="Photos">
          <div className="jpwp-wrap">
            <div className="jpwp-sec-head">
              <h2 className="jpwp-serif">The practice</h2>
              <span className="jpwp-sc">In brief</span>
            </div>
            <div className="jpwp-strip">
              {photos.gallery.map((src, i) => (
                <Ph key={i} src={src} alt={`${name} — the practice`}
                  fx={<ProfessionalFx c={pal.c} glyph={['column', 'pen', 'scale'][i % 3]} />} />
              ))}
            </div>
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="jpwp-sec" style={{ paddingTop: photos.gallery.length ? 0 : undefined }}>
          <div className="jpwp-wrap">
            <div className="jpwp-sec-head">
              <h2 className="jpwp-serif">Client words</h2>
            </div>
            <div className="jpwp-q-grid">
              {quotes.map((q, i) => (
                <blockquote className="jpwp-q" key={i}>
                  <p>“{txt(q.quote)}”</p>
                  {txt(q.name) && <cite>{txt(q.name)}</cite>}
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {(hours.length > 0 || hasContact) && (
        <section className="jpwp-sec" id="contact" style={{ paddingTop: quotes.length ? 0 : undefined }}>
          <div className="jpwp-wrap jpwp-hc">
            {hours.length > 0 && (
              <div>
                <div className="jpwp-sec-head"><h2 className="jpwp-serif">Office hours</h2></div>
                <div className="jpwp-hours">
                  {hours.map((h, i) => (
                    <div className="jpwp-hrow" key={i}>
                      <b>{txt(h.days) || '—'}</b><span>{txt(h.hours) || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasContact && (
              <div style={hours.length ? { paddingTop: 58 } : undefined}>
                <div className="jpwp-contact">
                  <h3>Speak with us</h3>
                  <p className="sub">{area ? `Serving ${area}.` : 'We respond within one business day.'}</p>
                  {phone && <a className="jpwp-cline" href={telHref(phone)}><b>Phone</b>{phone}</a>}
                  {email && <a className="jpwp-cline" href={`mailto:${email}`}><b>Email</b>{email}</a>}
                  {address && <span className="jpwp-cline"><b>Office</b>{address}</span>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="jpwp-foot">
        <div className="jpwp-wrap jpwp-foot-in">
          <span className="fname">{name}</span>
          <span className="fine">
            © {year} {name}{license ? ` · ${license}` : ''}{established ? ` · Est. ${established}` : ''}
          </span>
        </div>
      </footer>
    </div>
  );
}
