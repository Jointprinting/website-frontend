// src/webworks/templates/Wellness.js
// JPW template: WELLNESS — salons, spas, massage, yoga studios.
// Design voice: airy and elegant. High whitespace, light Cormorant Garamond
// serif over letterspaced Jost captions, hairline rules instead of cards, and
// photography cropped into soft ARCHES — one grand arch under the hero (the
// template's signature), smaller arch tiles in the gallery. Services render
// as ruled ledger rows, not tiles. Photos are fail-safe: curated defaults
// ship with the template (owner URLs override via data.photos) over crafted
// ring-and-leaf underlayers in the palette.

import * as React from 'react';
import {
  useGoogleFonts, resolvePalette, initialsOf, telHref, txt, rows,
  mergePhotos, Ph, PH_CSS,
} from './_kit';
import { WELLNESS_PALETTES } from './_meta';

// Curated defaults — well-known Unsplash spa/studio photography. Owner-
// supplied data.photos.{hero,gallery} replace these slot-for-slot.
const DEFAULT_PHOTOS = {
  hero: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=80',
  gallery: [
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=900&q=80',
  ],
};

// Crafted no-photo tile: soft accent glow, concentric rings, a botanical glyph.
function WellnessFx({ c, glyph }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`wfx-${uid}`} cx="50%" cy="34%" r="75%">
          <stop offset="0" stopColor={c.accent} stopOpacity=".42" />
          <stop offset=".6" stopColor={c.accent} stopOpacity=".14" />
          <stop offset="1" stopColor={c.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill={c.soft} />
      <rect width="400" height="500" fill={`url(#wfx-${uid})`} />
      <g fill="none" stroke={c.accent} opacity=".4" strokeWidth="1">
        <circle cx="200" cy="230" r="80" /><circle cx="200" cy="230" r="124" />
        <circle cx="200" cy="230" r="168" />
      </g>
      <g transform="translate(200 230)" fill="none" stroke={c.dark}
        strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".62">
        {glyph === 'leaf' && (<>
          <path d="M0 -44C26 -18 26 16 0 44C-26 16 -26 -18 0 -44z" />
          <path d="M0 -30v62" opacity=".7" />
        </>)}
        {glyph === 'stones' && (<>
          <ellipse cx="0" cy="30" rx="40" ry="14" />
          <ellipse cx="0" cy="2" rx="30" ry="12" />
          <ellipse cx="0" cy="-22" rx="20" ry="10" />
        </>)}
        {glyph === 'sun' && (<>
          <circle cx="0" cy="0" r="22" />
          <path d="M0 -40v-8M0 40v8M-40 0h-8M40 0h8M-30 -30l-5 -5M30 30l5 5M30 -30l5 -5M-30 30l-5 5" opacity=".8" />
        </>)}
      </g>
    </svg>
  );
}

const css = (c) => `
.jpww{--max:980px;font-family:'Jost','Helvetica Neue',Arial,sans-serif;background:${c.bg};color:${c.ink};line-height:1.7;font-weight:400;overflow-x:clip;min-height:100%;}
.jpww *,.jpww *::before,.jpww *::after{box-sizing:border-box;margin:0;padding:0;}
.jpww a{text-decoration:none;}
.jpww-wrap{max-width:var(--max);margin:0 auto;padding:0 clamp(18px,5vw,36px);}
/* display serif never breaks mid-word — break-word only splits a word wider
   than the whole line, which the clamps below never allow for real content */
.jpww-serif{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;line-height:1.18;overflow-wrap:break-word;}
.jpww-cap{font-size:11.5px;font-weight:500;letter-spacing:.32em;text-transform:uppercase;color:${c.sub};}

/* Nav — quiet, blurred, underline call link */
.jpww-nav{position:sticky;top:0;z-index:50;background:color-mix(in srgb,${c.bg} 86%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid ${c.line};}
.jpww-nav-in{display:flex;align-items:center;gap:18px;min-height:60px;}
.jpww-brand{font-size:13px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.jpww-links{display:flex;gap:24px;margin-left:auto;}
.jpww-links a{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${c.sub};transition:color .15s;}
.jpww-links a:hover{color:${c.ink};}
.jpww-callink{flex:0 0 auto;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:${c.ink};border-bottom:1px solid ${c.accent};padding-bottom:2px;transition:color .15s,border-color .15s;white-space:nowrap;}
.jpww-callink:hover{color:${c.accent};}
.jpww-nav .jpww-callink{margin-left:auto;}
.jpww-nav .jpww-links + .jpww-callink{margin-left:0;}
@media(max-width:720px){.jpww-links{display:none;}}

/* Hero — vast whitespace, floating circle, then the signature ARCH photo */
.jpww-hero{position:relative;text-align:center;padding:clamp(76px,13vw,150px) 0 0;}
.jpww-orb{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);width:min(520px,86vw);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 38% 32%,color-mix(in srgb,${c.accent} 22%,transparent),color-mix(in srgb,${c.accent} 8%,transparent) 62%,transparent 74%);pointer-events:none;}
.jpww-hero-in{position:relative;z-index:1;}
.jpww-arch-row{position:relative;z-index:1;display:flex;justify-content:center;align-items:flex-end;gap:clamp(18px,4vw,44px);
  margin-top:clamp(44px,7vw,72px);padding-bottom:clamp(56px,9vw,104px);}
.jpww-arch{width:min(460px,80vw);aspect-ratio:4/5;border-radius:999px 999px 14px 14px;
  box-shadow:0 40px 70px -42px color-mix(in srgb,${c.dark} 65%,transparent);}
.jpww-arch-side{flex:0 0 auto;width:1px;height:120px;background:${c.line};align-self:center;}
@media(max-width:700px){.jpww-arch-side{display:none;}}
.jpww-arch-cap{position:absolute;left:50%;transform:translateX(-50%);bottom:clamp(18px,3.4vw,40px);
  font-size:11.5px;font-weight:500;letter-spacing:.32em;text-transform:uppercase;color:${c.sub};white-space:nowrap;}
.jpww-hero h1{font-size:clamp(38px,7.2vw,74px);font-weight:500;max-width:18ch;margin:22px auto 0;}
.jpww-hero .jpww-tag{margin:20px auto 0;max-width:46ch;font-size:clamp(15px,1.9vw,17.5px);color:${c.sub};font-weight:300;overflow-wrap:anywhere;}
.jpww-hero-ctas{display:flex;justify-content:center;flex-wrap:wrap;gap:14px;margin-top:38px;}
.jpww-btn{display:inline-block;background:${c.bg};border:1px solid ${c.ink};color:${c.ink};font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;padding:14px 34px;border-radius:999px;transition:background .18s,color .18s,border-color .18s;}
.jpww-btn:hover{background:${c.ink};color:${c.bg};}
.jpww-btn-solid{background:${c.accent};border-color:${c.accent};color:${c.accentInk};}
.jpww-btn-solid:hover{background:${c.dark};border-color:${c.dark};color:${c.darkInk};}

/* Section scaffolding */
.jpww-sec{padding:clamp(56px,9vw,110px) 0;}
.jpww-sec-head{text-align:center;margin-bottom:clamp(30px,5vw,52px);}
.jpww-sec-head h2{font-size:clamp(28px,4.6vw,46px);margin-top:14px;}

/* Offerings — ruled ledger rows */
.jpww-offer{border-top:1px solid ${c.line};}
.jpww-orow{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr) minmax(0,2fr);gap:10px 26px;align-items:baseline;padding:22px 4px;border-bottom:1px solid ${c.line};transition:background .18s;}
.jpww-orow:hover{background:${c.surface};}
.jpww-orow .n{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:clamp(19px,2.4vw,23px);overflow-wrap:anywhere;}
.jpww-orow .d{font-size:15.5px;color:color-mix(in srgb,${c.ink} 76%,${c.sub});font-weight:400;overflow-wrap:anywhere;}
.jpww-orow .p{text-align:right;font-size:14px;font-weight:500;letter-spacing:.1em;color:${c.ink};white-space:nowrap;}
@media(max-width:640px){.jpww-orow{grid-template-columns:minmax(0,1fr) auto;}.jpww-orow .d{grid-column:1 / -1;}}

/* Philosophy — split with vertical hairline */
.jpww-philo{display:grid;grid-template-columns:minmax(0,4fr) 1px minmax(0,7fr);gap:clamp(24px,4vw,48px);align-items:start;}
.jpww-philo .vline{background:${c.line};align-self:stretch;}
.jpww-philo h2{font-size:clamp(26px,4vw,40px);margin-top:12px;}
.jpww-philo p{font-size:clamp(15px,1.9vw,17px);color:${c.sub};font-weight:300;white-space:pre-line;overflow-wrap:anywhere;}
@media(max-width:720px){.jpww-philo{grid-template-columns:1fr;}.jpww-philo .vline{display:none;}}

/* Gallery — small arch tiles, middle one dropped */
.jpww-gal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,3vw,28px);max-width:820px;margin:0 auto;}
@media(max-width:640px){.jpww-gal{grid-template-columns:1fr;max-width:340px;}}
.jpww-gal .jpw-ph{aspect-ratio:3/4;border-radius:999px 999px 10px 10px;
  box-shadow:0 26px 48px -34px color-mix(in srgb,${c.dark} 60%,transparent);transition:transform .2s;}
.jpww-gal .jpw-ph:hover{transform:translateY(-4px);}
@media(min-width:641px){.jpww-gal .jpw-ph:nth-child(2){transform:translateY(26px);}
  .jpww-gal .jpw-ph:nth-child(2):hover{transform:translateY(22px);}}

/* Testimonials — soft band, large serif quotes */
.jpww-quotes{background:${c.soft};}
.jpww-q{max-width:620px;margin:0 auto;text-align:center;}
.jpww-q p{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(20px,3vw,27px);font-weight:500;font-style:italic;line-height:1.45;overflow-wrap:anywhere;}
.jpww-q .who{margin-top:18px;display:flex;align-items:center;justify-content:center;gap:10px;}
.jpww-q .dot{width:30px;height:30px;border-radius:50%;background:${c.accent};color:${c.accentInk};display:flex;align-items:center;justify-content:center;font-size:11px;letter-spacing:.05em;flex:0 0 auto;}
.jpww-q cite{font-style:normal;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:${c.sub};}
.jpww-q + .jpww-q{margin-top:clamp(36px,6vw,56px);}

/* Hours — minimal centered ledger */
.jpww-hours{max-width:440px;margin:0 auto;}
.jpww-hrow{display:flex;justify-content:space-between;gap:18px;padding:12px 2px;border-bottom:1px solid ${c.line};}
.jpww-hrow:last-child{border-bottom:none;}
.jpww-hrow b{font-weight:500;font-size:13px;letter-spacing:.18em;text-transform:uppercase;}
.jpww-hrow span{color:${c.sub};font-size:14.5px;text-align:right;overflow-wrap:anywhere;}
.jpww-area-note{margin-top:26px;text-align:center;font-size:14px;color:${c.sub};font-weight:300;overflow-wrap:anywhere;}

/* Visit / footer */
.jpww-visit{background:${c.dark};color:${c.darkInk};text-align:center;}
.jpww-visit .jpww-cap{color:${c.darkSub};}
.jpww-visit h2{font-size:clamp(28px,4.6vw,46px);color:${c.darkInk};margin-top:14px;}
.jpww-visit .lines{margin-top:26px;display:flex;flex-direction:column;gap:10px;align-items:center;}
.jpww-visit .lines a{font-size:14px;letter-spacing:.12em;color:${c.darkSub};border-bottom:1px solid transparent;padding-bottom:2px;transition:color .15s,border-color .15s;overflow-wrap:anywhere;}
.jpww-visit .lines a:hover{color:${c.darkInk};border-color:${c.darkInk};}
.jpww-visit .lines span{font-size:14px;color:${c.darkSub};font-weight:300;overflow-wrap:anywhere;}
.jpww-visit .jpww-btn-solid{margin-top:30px;}
.jpww-foot{text-align:center;padding:22px 16px;font-size:12px;letter-spacing:.14em;color:${c.sub};}
`;

export default function WellnessTemplate({ data }) {
  const d = data || {};
  useGoogleFonts('family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500;600');
  const pal = resolvePalette(WELLNESS_PALETTES, d.paletteId);
  const photos = React.useMemo(() => mergePhotos(d.photos, DEFAULT_PHOTOS), [d.photos]);
  const style = React.useMemo(
    () => css(pal.c) + PH_CSS('.jpww', `linear-gradient(165deg,${pal.c.soft},${pal.c.accent}55)`),
    [pal]
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
  const ctaLabel = txt(d.ctaLabel) || 'Book a visit';
  const ctaHref = phone ? telHref(phone) : (email ? `mailto:${email}` : null);
  const hasVisit = !!(phone || email || address);
  const year = new Date().getFullYear();
  // The hero eyebrow and the caption under the arch each pick from the same
  // facts — never the same one twice, so "Since 2019" can't render two times.
  const eyebrow = area || (established ? `Since ${established}` : 'Welcome');
  const archCap = [area, established && `Since ${established}`, name]
    .filter(Boolean).find((t) => t !== eyebrow) || '';

  const navLinks = [
    services.length && ['#offerings', 'Offerings'],
    about && ['#philosophy', 'About'],
    hours.length && ['#hours', 'Hours'],
    hasVisit && ['#visit', 'Visit'],
  ].filter(Boolean);

  return (
    <div className="jpww">
      <style>{style}</style>

      <nav className="jpww-nav">
        <div className="jpww-wrap jpww-nav-in">
          <div className="jpww-brand">{name}</div>
          {navLinks.length > 0 && (
            <div className="jpww-links">
              {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            </div>
          )}
          {phone && <a className="jpww-callink" href={telHref(phone)}>{phone}</a>}
        </div>
      </nav>

      <header className="jpww-hero">
        <div className="jpww-orb" aria-hidden="true" />
        <div className="jpww-wrap jpww-hero-in">
          <span className="jpww-cap">{eyebrow}</span>
          <h1 className="jpww-serif">{headline}</h1>
          {txt(d.tagline) && txt(d.tagline) !== headline && (
            <p className="jpww-tag">{txt(d.tagline)}</p>
          )}
          {ctaHref && (
            <div className="jpww-hero-ctas">
              <a className="jpww-btn jpww-btn-solid" href={ctaHref}>{ctaLabel}</a>
              {services.length > 0 && <a className="jpww-btn" href="#offerings">Offerings</a>}
            </div>
          )}
        </div>
        {/* the signature arch — one grand, soft-cropped photo */}
        <div className="jpww-arch-row">
          <span className="jpww-arch-side" aria-hidden="true" />
          <Ph className="jpww-arch" src={photos.hero} alt={name}
            fx={<WellnessFx c={pal.c} glyph="leaf" />} />
          <span className="jpww-arch-side" aria-hidden="true" />
        </div>
        {archCap && <span className="jpww-arch-cap">{archCap}</span>}
      </header>

      {services.length > 0 && (
        <section className="jpww-sec" id="offerings" style={{ paddingTop: 0 }}>
          <div className="jpww-wrap">
            <div className="jpww-sec-head">
              <span className="jpww-cap">For you</span>
              <h2 className="jpww-serif">Offerings</h2>
            </div>
            <div className="jpww-offer">
              {services.map((s, i) => (
                <div className="jpww-orow" key={i}>
                  <span className="n">{txt(s.name)}</span>
                  <span className="d">{txt(s.desc)}</span>
                  <span className="p">{txt(s.price)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {about && (
        <section className="jpww-sec" id="philosophy" style={{ background: pal.c.surface }}>
          <div className="jpww-wrap jpww-philo">
            <div>
              <span className="jpww-cap">Our philosophy</span>
              <h2 className="jpww-serif">About {name}</h2>
            </div>
            <div className="vline" aria-hidden="true" />
            <p>{about}</p>
          </div>
        </section>
      )}

      {photos.gallery.length > 0 && (
        <section className="jpww-sec" aria-label="Photos">
          <div className="jpww-wrap">
            <div className="jpww-sec-head">
              <span className="jpww-cap">Moments</span>
            </div>
            <div className="jpww-gal">
              {photos.gallery.map((src, i) => (
                <Ph key={i} src={src} alt={`${name} — the space`}
                  fx={<WellnessFx c={pal.c} glyph={['sun', 'leaf', 'stones'][i % 3]} />} />
              ))}
            </div>
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="jpww-sec jpww-quotes">
          <div className="jpww-wrap">
            <div className="jpww-sec-head">
              <span className="jpww-cap">Kind words</span>
            </div>
            {quotes.map((q, i) => (
              <blockquote className="jpww-q" key={i}>
                <p>“{txt(q.quote)}”</p>
                <div className="who">
                  {txt(q.name) && <span className="dot" aria-hidden="true">{initialsOf(q.name)}</span>}
                  {txt(q.name) && <cite>{txt(q.name)}</cite>}
                </div>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {hours.length > 0 && (
        <section className="jpww-sec" id="hours">
          <div className="jpww-wrap">
            <div className="jpww-sec-head">
              <span className="jpww-cap">When to find us</span>
              <h2 className="jpww-serif">Hours</h2>
            </div>
            <div className="jpww-hours">
              {hours.map((h, i) => (
                <div className="jpww-hrow" key={i}>
                  <b>{txt(h.days) || '—'}</b><span>{txt(h.hours) || '—'}</span>
                </div>
              ))}
            </div>
            {area && <p className="jpww-area-note">Serving {area}</p>}
          </div>
        </section>
      )}

      {hasVisit && (
        <section className="jpww-sec jpww-visit" id="visit">
          <div className="jpww-wrap">
            <span className="jpww-cap">Visit</span>
            <h2 className="jpww-serif">We&rsquo;d love to see you</h2>
            <div className="lines">
              {phone && <a href={telHref(phone)}>{phone}</a>}
              {email && <a href={`mailto:${email}`}>{email}</a>}
              {address && <span>{address}</span>}
            </div>
            {ctaHref && <a className="jpww-btn jpww-btn-solid" href={ctaHref} style={{ display: 'inline-block' }}>{ctaLabel}</a>}
          </div>
        </section>
      )}

      <footer className="jpww-foot">
        © {year} {name}{license ? ` · ${license}` : ''}
      </footer>
    </div>
  );
}
