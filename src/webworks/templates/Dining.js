// src/webworks/templates/Dining.js
// JPW template: DINING — restaurants, cafés, bakeries, bars.
// Design voice: warm and menu-forward. Centered editorial composition over a
// candle-lit photo hero, serif display type (Fraunces) with italic accents,
// ornament dividers, a dish-photo band behind the menu intro (the menu card
// itself floats up over it, like a table card), and the services list
// rendered as an actual MENU with dotted leaders and prices.
// Photos are fail-safe: curated defaults ship with the template (owner URLs
// override via data.photos) over crafted candle-glow underlayers.

import * as React from 'react';
import {
  useGoogleFonts, resolvePalette, telHref, txt, rows,
  mergePhotos, Ph, PH_CSS,
} from './_kit';
import { DINING_PALETTES } from './_meta';

// Curated defaults — well-known Unsplash dining photography. Owner-supplied
// data.photos.{hero,gallery} replace these slot-for-slot.
const DEFAULT_PHOTOS = {
  hero: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=80',
  gallery: [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
  ],
};

// Crafted no-photo tile: candle-glow gradient, bokeh, and a table glyph.
function DiningFx({ c, glyph }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`dfx-${uid}`} cx="50%" cy="18%" r="85%">
          <stop offset="0" stopColor={c.accent} stopOpacity=".5" />
          <stop offset=".55" stopColor={c.accent} stopOpacity=".12" />
          <stop offset="1" stopColor={c.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={c.dark} />
      <rect width="400" height="300" fill={`url(#dfx-${uid})`} />
      <g fill={c.accent} opacity=".3">
        <circle cx="70" cy="64" r="7" /><circle cx="330" cy="52" r="5" />
        <circle cx="300" cy="120" r="4" /><circle cx="96" cy="150" r="4" />
      </g>
      <g transform="translate(200 160)" fill="none" stroke={c.darkInk}
        strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".8">
        {glyph === 'plate' && (<>
          <circle cx="0" cy="0" r="42" /><circle cx="0" cy="0" r="26" opacity=".6" />
          <path d="M-72 -34v50M-80 -34v16M-64 -34v16M-72 -18c-6 0-8 4-8 8" opacity=".9" />
          <path d="M72 -34c8 10 8 26 0 34v22" opacity=".9" />
        </>)}
        {glyph === 'glass' && (<>
          <path d="M-20 -52h40c0 26 -9 40 -20 40s-20 -14 -20 -40z" />
          <path d="M0 -12v42M-14 32h28" />
        </>)}
        {glyph === 'cup' && (<>
          <path d="M-26 -18h52v22a12 12 0 0 1 -12 12h-28a12 12 0 0 1 -12 -12z" />
          <path d="M26 -12h8a9 9 0 0 1 0 18h-8" />
          <path d="M-12 -30c0 -5 4 -5 4 -10M8 -30c0 -5 4 -5 4 -10" opacity=".7" />
        </>)}
      </g>
    </svg>
  );
}

const css = (c, p) => `
.jpwd{--max:1040px;font-family:'Karla','Helvetica Neue',Arial,sans-serif;background:${c.bg};color:${c.ink};line-height:1.65;overflow-x:clip;min-height:100%;}
.jpwd *,.jpwd *::before,.jpwd *::after{box-sizing:border-box;margin:0;padding:0;}
.jpwd a{text-decoration:none;}
.jpwd-wrap{max-width:var(--max);margin:0 auto;padding:0 clamp(16px,4vw,32px);}
/* display serif never breaks mid-word — break-word only splits a word wider
   than the whole line, which real headlines never are at these clamps */
.jpwd-serif{font-family:'Fraunces',Georgia,serif;font-weight:500;line-height:1.15;overflow-wrap:break-word;}

/* Nav — warm, hairline, round call pill */
.jpwd-nav{position:sticky;top:0;z-index:50;background:${c.bg};border-bottom:1px solid ${c.line};}
.jpwd-nav-in{display:flex;align-items:center;gap:16px;min-height:62px;}
.jpwd-brand{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(17px,2.6vw,21px);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.jpwd-links{display:flex;gap:20px;margin-left:auto;}
.jpwd-links a{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${c.sub};transition:color .15s;}
.jpwd-links a:hover{color:${c.accent};}
.jpwd-pill{flex:0 0 auto;background:${c.accent};color:${c.accentInk};font-weight:700;font-size:13.5px;letter-spacing:.04em;padding:10px 20px;border-radius:999px;transition:transform .15s,filter .15s;white-space:nowrap;}
.jpwd-pill:hover{transform:translateY(-1px);filter:brightness(1.06);}
.jpwd-links + .jpwd-pill{margin-left:0;}
.jpwd-nav .jpwd-pill{margin-left:auto;}
.jpwd-nav .jpwd-links + .jpwd-pill{margin-left:0;}
@media(max-width:760px){.jpwd-links{display:none;}}

/* Hero — centered editorial over a candle-lit photo; a crafted warm-glow
   scene sits under the photo so the no-photo state still reads "evening". */
.jpwd-hero{text-align:center;padding:clamp(76px,12vw,148px) 0 clamp(64px,9vw,104px);position:relative;color:${c.darkInk};
  background-color:${c.dark};
  background-image:
    linear-gradient(178deg,${c.dark}c9 0%,${c.dark}d9 55%,${c.dark}f2 100%),
    url('${p.hero}'),
    radial-gradient(90% 70% at 50% 10%,${c.accent}45 0%,transparent 60%),
    radial-gradient(40% 30% at 18% 80%,${c.accent}26 0%,transparent 70%),
    linear-gradient(180deg,${c.dark},#120c07);
  background-size:cover;background-position:center;}
.jpwd-eyebrow{font-size:12.5px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:${c.accent};color:color-mix(in srgb,${c.accent} 55%,#fff);}
.jpwd-hero h1{font-size:clamp(36px,7vw,72px);margin:18px auto 0;max-width:16ch;font-weight:500;color:${c.darkInk};text-shadow:0 2px 26px rgba(0,0,0,.45);}
.jpwd-hero h1 em{font-style:italic;color:color-mix(in srgb,${c.accent} 60%,#fff);}
.jpwd-hero .jpwd-tag{margin:18px auto 0;max-width:52ch;font-size:clamp(15.5px,2vw,18px);color:${c.darkSub};overflow-wrap:anywhere;}
.jpwd-hero-ctas{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:30px;}
.jpwd-btn2{display:inline-block;border:1.5px solid ${c.darkSub};color:${c.darkInk};font-weight:700;font-size:13.5px;letter-spacing:.04em;padding:11px 22px;border-radius:999px;transition:background .15s,color .15s,border-color .15s;}
.jpwd-btn2:hover{background:${c.darkInk};border-color:${c.darkInk};color:${c.dark};}
.jpwd-hero-meta{margin-top:34px;font-size:13.5px;color:${c.darkSub};display:flex;justify-content:center;flex-wrap:wrap;gap:6px 18px;}
.jpwd-hero-meta span{overflow-wrap:anywhere;}

/* Ornament divider */
.jpwd-orn{display:flex;align-items:center;justify-content:center;gap:14px;color:${c.accent};padding:0 0 clamp(36px,5vw,56px);}
.jpwd-orn::before,.jpwd-orn::after{content:'';height:1px;width:min(120px,26vw);background:${c.line};}

/* Section scaffolding — centered headers */
.jpwd-sec{padding:clamp(48px,7vw,88px) 0;}
.jpwd-sec-head{text-align:center;margin-bottom:clamp(26px,4vw,42px);}
.jpwd-sec-head .k{font-size:12px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:${c.accent};}
.jpwd-sec-head h2{font-size:clamp(28px,4.6vw,44px);margin-top:10px;font-weight:500;}

/* Menu intro band — full-bleed dish photo behind the section header; the
   menu itself rides up over it on a paper card, like a table card. */
.jpwd-menuband{position:relative;text-align:center;color:${c.darkInk};
  padding:clamp(44px,6vw,72px) 0 clamp(96px,12vw,136px);
  background-color:${c.dark};
  background-image:
    linear-gradient(180deg,${c.dark}cc 0%,${c.dark}d9 100%),
    url('${p.band}'),
    radial-gradient(80% 90% at 78% 18%,${c.accent}3d 0%,transparent 60%),
    linear-gradient(160deg,${c.dark},#140d08);
  background-size:cover;background-position:center;}
.jpwd-menuband .k{font-size:12px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:color-mix(in srgb,${c.accent} 55%,#fff);}
.jpwd-menuband h2{font-size:clamp(28px,4.6vw,44px);margin-top:10px;font-weight:500;color:${c.darkInk};}
.jpwd-menucard{position:relative;z-index:2;background:${c.surface};border:1px solid ${c.line};
  border-radius:8px;max-width:760px;margin:-72px auto 0;
  padding:clamp(24px,4.5vw,44px) clamp(20px,4.5vw,48px);
  box-shadow:0 34px 60px -34px rgba(20,10,4,.5);}
.jpwd-menucard::before{content:'';position:absolute;inset:9px;border:1px solid ${c.line};border-radius:5px;pointer-events:none;}

/* Menu — dotted leaders */
.jpwd-menu{max-width:680px;margin:0 auto;position:relative;}
.jpwd-mi{padding:16px 0;border-bottom:1px solid ${c.line};}
.jpwd-mi:last-child{border-bottom:none;}
.jpwd-mi-top{display:flex;align-items:baseline;gap:10px;}
.jpwd-mi-top .n{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:19px;min-width:0;overflow-wrap:anywhere;}
.jpwd-leader{flex:1 1 24px;border-bottom:2px dotted ${c.line};transform:translateY(-4px);min-width:24px;}
.jpwd-mi-top .p{font-weight:700;font-size:15.5px;color:${c.accent};flex:0 0 auto;white-space:nowrap;}
.jpwd-mi .d{margin-top:5px;font-size:14.5px;color:${c.sub};font-style:italic;max-width:56ch;overflow-wrap:anywhere;}

/* About — tinted band, big italic serif */
.jpwd-about{background:${c.soft};}
.jpwd-about-inner{max-width:760px;margin:0 auto;text-align:center;}
.jpwd-about-inner .mark{font-family:'Fraunces',Georgia,serif;font-size:54px;line-height:1;color:${c.accent};}
.jpwd-about-inner p{font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:clamp(18px,2.8vw,24px);line-height:1.5;white-space:pre-line;overflow-wrap:anywhere;}
.jpwd-about-inner .sig{margin-top:22px;font-size:12.5px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:${c.sub};font-family:'Karla',sans-serif;font-style:normal;}

/* Testimonials — stacked, ornament-separated */
.jpwd-quotes{max-width:640px;margin:0 auto;text-align:center;}
.jpwd-q{padding:8px 0;}
.jpwd-q p{font-size:clamp(15.5px,2vw,17.5px);color:${c.ink};overflow-wrap:anywhere;}
.jpwd-q cite{display:block;margin-top:10px;font-style:normal;font-size:12.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${c.sub};}
.jpwd-q + .jpwd-q{margin-top:28px;position:relative;padding-top:34px;}
.jpwd-q + .jpwd-q::before{content:'✦';position:absolute;top:0;left:50%;transform:translateX(-50%);color:${c.accent};font-size:13px;}

/* Gallery — fail-safe photo tiles, gently framed, top-aligned */
.jpwd-gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr));gap:16px;max-width:960px;margin:0 auto;align-items:start;}
.jpwd-gal .jpw-ph{aspect-ratio:4/3;border-radius:6px;border:1px solid ${c.line};
  box-shadow:0 18px 36px -26px rgba(30,16,8,.55);transition:transform .18s;}
.jpwd-gal .jpw-ph:hover{transform:translateY(-3px);}

/* Hours + visit — twin cards */
.jpwd-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:18px;max-width:860px;margin:0 auto;}
.jpwd-card{background:${c.surface};border:1px solid ${c.line};border-radius:6px;padding:28px 26px;min-width:0;}
.jpwd-card h3{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:21px;margin-bottom:14px;text-align:center;}
.jpwd-hrow{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px dotted ${c.line};font-size:14.5px;}
.jpwd-hrow:last-child{border-bottom:none;}
.jpwd-hrow b{font-weight:700;}
.jpwd-hrow span{color:${c.sub};text-align:right;overflow-wrap:anywhere;}
.jpwd-vline{padding:8px 0;font-size:14.5px;color:${c.sub};text-align:center;overflow-wrap:anywhere;}
.jpwd-vline a{color:${c.accent};font-weight:700;transition:opacity .15s;}
.jpwd-vline a:hover{opacity:.75;}

/* Footer — deep band */
.jpwd-foot{background:${c.dark};color:${c.darkInk};text-align:center;padding:clamp(44px,7vw,72px) 0 28px;}
.jpwd-foot .name{font-family:'Fraunces',Georgia,serif;font-size:clamp(24px,4vw,34px);font-weight:500;overflow-wrap:anywhere;}
.jpwd-foot .links{margin-top:18px;display:flex;justify-content:center;flex-wrap:wrap;gap:8px 24px;font-size:15px;}
.jpwd-foot .links a{color:${c.darkSub};transition:color .15s;overflow-wrap:anywhere;}
.jpwd-foot .links a:hover{color:${c.darkInk};}
.jpwd-foot .addr{margin-top:10px;font-size:13.5px;color:${c.darkSub};overflow-wrap:anywhere;}
.jpwd-foot .fine{margin-top:30px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);font-size:12.5px;color:${c.darkSub};}
`;

// Italicize the last word of the headline — the little editorial flourish that
// makes the serif display read designed rather than typed.
function Headline({ text }) {
  const words = text.split(' ');
  if (words.length < 2) return <>{text}</>;
  const last = words.pop();
  return (<>{words.join(' ')} <em>{last}</em></>);
}

export default function DiningTemplate({ data }) {
  const d = data || {};
  useGoogleFonts('family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Karla:wght@400;500;600;700');
  const pal = resolvePalette(DINING_PALETTES, d.paletteId);
  const photos = React.useMemo(() => mergePhotos(d.photos, DEFAULT_PHOTOS), [d.photos]);
  const style = React.useMemo(
    () => css(pal.c, { hero: photos.hero, band: photos.gallery[0] || photos.hero })
      + PH_CSS('.jpwd', `linear-gradient(165deg,${pal.c.dark},#140d08)`),
    [pal, photos]
  );

  const name = txt(d.businessName) || 'Your Business';
  const phone = txt(d.phone);
  const email = txt(d.email);
  const address = txt(d.address);
  const area = txt(d.serviceArea);
  const about = txt(d.about);
  const established = txt(d.established);
  const services = rows(d.services, 'name');
  const hours = rows(d.hours, 'days', 'hours');
  const quotes = rows(d.testimonials, 'quote');

  const headline = txt(d.heroHeadline) || txt(d.tagline) || name;
  const ctaLabel = txt(d.ctaLabel) || (phone ? `Call ${phone}` : 'Get in touch');
  const ctaHref = phone ? telHref(phone) : (email ? `mailto:${email}` : null);
  const hasVisit = !!(address || area || phone || email);
  const year = new Date().getFullYear();

  const navLinks = [
    services.length && ['#menu', 'Menu'],
    about && ['#about', 'About'],
    (hours.length || hasVisit) && ['#visit', 'Visit'],
  ].filter(Boolean);

  return (
    <div className="jpwd">
      <style>{style}</style>

      <nav className="jpwd-nav">
        <div className="jpwd-wrap jpwd-nav-in">
          <div className="jpwd-brand">{name}</div>
          {navLinks.length > 0 && (
            <div className="jpwd-links">
              {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            </div>
          )}
          {phone && <a className="jpwd-pill" href={telHref(phone)}>Call us</a>}
        </div>
      </nav>

      <header className="jpwd-hero">
        <div className="jpwd-wrap">
          <div className="jpwd-eyebrow">
            {established ? `Est. ${established}` : (area ? area : '· · ·')}
          </div>
          <h1 className="jpwd-serif"><Headline text={headline} /></h1>
          {txt(d.tagline) && txt(d.tagline) !== headline && (
            <p className="jpwd-tag">{txt(d.tagline)}</p>
          )}
          {ctaHref && (
            <div className="jpwd-hero-ctas">
              <a className="jpwd-pill" href={ctaHref}>{ctaLabel}</a>
              {services.length > 0 && <a className="jpwd-btn2" href="#menu">See the menu</a>}
            </div>
          )}
          {(address || hours.length > 0) && (
            <div className="jpwd-hero-meta">
              {address && <span>{address}</span>}
              {hours[0] && (txt(hours[0].days) || txt(hours[0].hours)) && (
                <span>{[txt(hours[0].days), txt(hours[0].hours)].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          )}
        </div>
      </header>
      <div className="jpwd-orn" aria-hidden="true">✦</div>

      {services.length > 0 && (
        <section id="menu" style={{ paddingTop: 0, paddingBottom: 'clamp(48px,7vw,88px)' }}>
          {/* the signature band: a full-bleed dish photo behind the menu intro */}
          <div className="jpwd-menuband">
            <div className="jpwd-wrap">
              <span className="k">From the kitchen</span>
              <h2 className="jpwd-serif">The menu</h2>
            </div>
          </div>
          <div className="jpwd-wrap">
            <div className="jpwd-menucard">
              <div className="jpwd-menu">
                {services.map((s, i) => (
                  <div className="jpwd-mi" key={i}>
                    <div className="jpwd-mi-top">
                      <span className="n">{txt(s.name)}</span>
                      {txt(s.price) && <span className="jpwd-leader" aria-hidden="true" />}
                      {txt(s.price) && <span className="p">{txt(s.price)}</span>}
                    </div>
                    {txt(s.desc) && <p className="d">{txt(s.desc)}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {about && (
        <section className="jpwd-sec jpwd-about" id="about">
          <div className="jpwd-wrap jpwd-about-inner">
            <div className="mark" aria-hidden="true">“</div>
            <p>{about}</p>
            <div className="sig">— {name}</div>
          </div>
        </section>
      )}

      {photos.gallery.length > 0 && (
        <section className="jpwd-sec" aria-label="Photos">
          <div className="jpwd-wrap">
            <div className="jpwd-sec-head">
              <span className="k">A look inside</span>
              <h2 className="jpwd-serif">From our tables</h2>
            </div>
            <div className="jpwd-gal">
              {photos.gallery.map((src, i) => (
                <Ph key={i} src={src} alt={`${name} — from the kitchen`}
                  fx={<DiningFx c={pal.c} glyph={['plate', 'glass', 'cup'][i % 3]} />} />
              ))}
            </div>
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="jpwd-sec" style={{ paddingTop: photos.gallery.length ? 0 : undefined }}>
          <div className="jpwd-wrap">
            <div className="jpwd-sec-head">
              <span className="k">Kind words</span>
              <h2 className="jpwd-serif">Guests say</h2>
            </div>
            <div className="jpwd-quotes">
              {quotes.map((q, i) => (
                <blockquote className="jpwd-q" key={i}>
                  <p>“{txt(q.quote)}”</p>
                  {txt(q.name) && <cite>{txt(q.name)}</cite>}
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {(hours.length > 0 || hasVisit) && (
        <section className="jpwd-sec" id="visit" style={{ background: pal.c.soft }}>
          <div className="jpwd-wrap">
            <div className="jpwd-sec-head">
              <span className="k">Come by</span>
              <h2 className="jpwd-serif">Hours &amp; visit</h2>
            </div>
            <div className="jpwd-cards">
              {hours.length > 0 && (
                <div className="jpwd-card">
                  <h3>Hours</h3>
                  {hours.map((h, i) => (
                    <div className="jpwd-hrow" key={i}>
                      <b>{txt(h.days) || '—'}</b><span>{txt(h.hours) || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              {hasVisit && (
                <div className="jpwd-card">
                  <h3>Find us</h3>
                  {address && <p className="jpwd-vline">{address}</p>}
                  {area && !address && <p className="jpwd-vline">{area}</p>}
                  {phone && <p className="jpwd-vline"><a href={telHref(phone)}>{phone}</a></p>}
                  {email && <p className="jpwd-vline"><a href={`mailto:${email}`}>{email}</a></p>}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="jpwd-foot">
        <div className="jpwd-wrap">
          <div className="name">{name}</div>
          {(phone || email) && (
            <div className="links">
              {phone && <a href={telHref(phone)}>{phone}</a>}
              {email && <a href={`mailto:${email}`}>{email}</a>}
            </div>
          )}
          {address && <div className="addr">{address}</div>}
          <div className="fine">© {year} {name}{established ? ` · Est. ${established}` : ''}</div>
        </div>
      </footer>
    </div>
  );
}
