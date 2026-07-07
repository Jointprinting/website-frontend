// src/webworks/templates/Retail.js
// JPW template: RETAIL — boutiques, gift shops, record stores.
// Design voice: playful, chunky, sticker-sheet energy. Archivo 900 headlines,
// two loud duotone colors, hard offset shadows, a scrolling tagline marquee,
// tilted quote cards — and PHOTOS treated like stickers: duotone-tinted,
// ink-framed, hard-shadowed, slightly rotated. Photos are fail-safe: curated
// shop defaults ship with the template (owner URLs override via data.photos)
// over crafted sticker-sheet underlayers, so nothing ever looks broken.

import * as React from 'react';
import {
  useGoogleFonts, resolvePalette, telHref, txt, rows,
  mergePhotos, Ph, PH_CSS,
} from './_kit';
import { RETAIL_PALETTES } from './_meta';

// Curated defaults — well-known Unsplash shop photography. Owner-supplied
// data.photos.{hero,gallery} replace these slot-for-slot.
const DEFAULT_PHOTOS = {
  hero: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
  gallery: [
    'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80',
  ],
};

// Crafted no-photo tile: sticker-sheet energy — tint field, checker corners,
// one loud glyph. Loud on purpose; it should feel merchandised, not "missing".
function RetailFx({ c, glyph }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="300" fill={c.tint} />
      <g fill={c.pop} opacity=".9">
        <rect x="0" y="0" width="18" height="18" /><rect x="36" y="0" width="18" height="18" />
        <rect x="18" y="18" width="18" height="18" /><rect x="54" y="18" width="18" height="18" />
        <rect x="346" y="264" width="18" height="18" /><rect x="382" y="264" width="18" height="18" />
        <rect x="364" y="282" width="18" height="18" /><rect x="328" y="282" width="18" height="18" />
      </g>
      <rect x="12" y="12" width="376" height="276" fill="none" stroke={c.ink}
        strokeWidth="2" strokeDasharray="8 7" opacity=".5" rx="10" />
      {glyph === 'star' && (
        <g transform="translate(200 150) scale(4.4)">
          <path transform="translate(-12 -12)" fill={c.accent} stroke={c.ink} strokeWidth=".9"
            d="M12 2.7l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9L12 2.7z" />
        </g>
      )}
      {glyph === 'smile' && (
        <g transform="translate(200 150)">
          <circle r="52" fill={c.pop} stroke={c.ink} strokeWidth="4" />
          <circle cx="-18" cy="-12" r="6" fill={c.ink} /><circle cx="18" cy="-12" r="6" fill={c.ink} />
          <path d="M-24 12c8 14 40 14 48 0" fill="none" stroke={c.ink} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {glyph === 'tag' && (
        <g transform="translate(200 150) rotate(-14)">
          <path d="M-58 -34h74l42 34-42 34h-74a10 10 0 0 1 -10 -10v-48a10 10 0 0 1 10 -10z"
            fill={c.accent} stroke={c.ink} strokeWidth="4" strokeLinejoin="round" />
          <circle cx="34" cy="0" r="7" fill={c.tint} stroke={c.ink} strokeWidth="3" />
          <circle cx="-38" cy="-12" r="9" fill="none" stroke={c.accentInk} strokeWidth="4" />
          <circle cx="-10" cy="14" r="9" fill="none" stroke={c.accentInk} strokeWidth="4" />
          <path d="M-8 -18L-40 20" stroke={c.accentInk} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

const css = (c) => `
.jpwr{--max:1080px;font-family:'Space Grotesk','Helvetica Neue',Arial,sans-serif;background:${c.bg};color:${c.ink};line-height:1.6;overflow-x:clip;min-height:100%;}
.jpwr *,.jpwr *::before,.jpwr *::after{box-sizing:border-box;margin:0;padding:0;}
.jpwr a{text-decoration:none;}
.jpwr-wrap{max-width:var(--max);margin:0 auto;padding:0 clamp(16px,4vw,32px);}
.jpwr-black{font-family:'Archivo',sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;line-height:1.04;overflow-wrap:anywhere;}

/* Nav — thick ink rule, sticker call chip */
.jpwr-nav{position:sticky;top:0;z-index:50;background:${c.bg};border-bottom:3px solid ${c.ink};}
.jpwr-nav-in{display:flex;align-items:center;gap:16px;min-height:64px;}
.jpwr-brand{font-family:'Archivo',sans-serif;font-weight:900;text-transform:uppercase;font-size:clamp(15px,2.6vw,20px);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.jpwr-brand mark{background:linear-gradient(transparent 55%,${c.pop} 55%);color:inherit;padding:0 2px;}
.jpwr-links{display:flex;gap:20px;margin-left:auto;}
.jpwr-links a{font-size:13.5px;font-weight:700;transition:color .15s;}
.jpwr-links a:hover{color:${c.accent};}
.jpwr-chip{flex:0 0 auto;background:${c.accent};color:${c.accentInk};font-weight:700;font-size:13.5px;padding:9px 16px;border:2px solid ${c.ink};border-radius:999px;box-shadow:3px 3px 0 ${c.ink};transition:transform .12s,box-shadow .12s;white-space:nowrap;}
.jpwr-chip:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 ${c.ink};}
.jpwr-nav .jpwr-chip{margin-left:auto;}
.jpwr-nav .jpwr-links + .jpwr-chip{margin-left:0;}
@media(max-width:760px){.jpwr-links{display:none;}}

/* Hero — chunk type beside a duotone sticker-framed photo */
.jpwr-hero{padding:clamp(52px,9vw,110px) 0 clamp(40px,7vw,80px);position:relative;}
.jpwr-hero-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(28px,5vw,64px);align-items:center;}
@media(max-width:800px){.jpwr-hero-grid{grid-template-columns:1fr;}}
.jpwr-hero-ph{position:relative;justify-self:center;width:min(400px,100%);transform:rotate(2deg);}
@media(max-width:800px){.jpwr-hero-ph{width:min(320px,86%);}}
.jpwr-hero-ph .jpw-ph{aspect-ratio:4/5;box-shadow:8px 8px 0 ${c.ink};}
.jpwr-hero-tag{position:absolute;top:-14px;right:-10px;z-index:2;background:${c.pop};color:${c.popInk};
  border:2px solid ${c.ink};border-radius:999px;font-weight:700;font-size:13px;letter-spacing:.05em;
  text-transform:uppercase;padding:7px 15px;transform:rotate(6deg);box-shadow:3px 3px 0 ${c.ink};white-space:nowrap;}

/* duotone treatment — grayscale under an accent color-blend, sticker frame */
.jpwr .jpw-ph{border:2px solid ${c.ink};border-radius:14px;}
.jpwr .jpw-ph>img{filter:grayscale(1) contrast(1.06);}
.jpwr .jpw-ph:not(.jpw-ph-noimg)::after{content:'';position:absolute;inset:0;z-index:1;
  background:${c.accent};mix-blend-mode:color;opacity:.9;pointer-events:none;}

/* the shelf — tilted duotone tiles under the marquee */
.jpwr-shelf{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(16px,3vw,26px);}
@media(max-width:760px){.jpwr-shelf{grid-template-columns:1fr;max-width:380px;margin:0 auto;}}
.jpwr-shelf .jpw-ph{aspect-ratio:4/3;box-shadow:5px 5px 0 ${c.ink};transition:transform .14s,box-shadow .14s;}
.jpwr-shelf .jpw-ph:nth-child(odd){transform:rotate(-1.4deg);}
.jpwr-shelf .jpw-ph:nth-child(even){transform:rotate(1.4deg);}
.jpwr-shelf .jpw-ph:hover{transform:rotate(0) translate(-2px,-2px);box-shadow:8px 8px 0 ${c.ink};}
.jpwr-badge{display:inline-block;background:${c.pop};color:${c.popInk};border:2px solid ${c.ink};border-radius:999px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;padding:7px 16px;transform:rotate(-2deg);box-shadow:3px 3px 0 ${c.ink};margin-bottom:22px;}
.jpwr-hero h1{font-size:clamp(38px,8vw,84px);max-width:14ch;}
.jpwr-hero h1 .hl{color:${c.accent};-webkit-text-stroke:0;}
.jpwr-hero .tag{margin-top:18px;font-size:clamp(16px,2.2vw,19px);color:${c.sub};max-width:50ch;overflow-wrap:anywhere;}
.jpwr-ctas{display:flex;flex-wrap:wrap;gap:14px;margin-top:30px;}
.jpwr-btn{display:inline-block;font-weight:700;font-size:15px;padding:13px 26px;border:2px solid ${c.ink};border-radius:12px;box-shadow:4px 4px 0 ${c.ink};transition:transform .12s,box-shadow .12s;background:${c.accent};color:${c.accentInk};}
.jpwr-btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 ${c.ink};}
.jpwr-btn-alt{background:${c.surface};color:${c.ink};}

/* Marquee — repeating tagline strip */
.jpwr-mq{background:${c.ink};color:${c.bg};border-top:3px solid ${c.ink};border-bottom:3px solid ${c.ink};overflow:hidden;white-space:nowrap;padding:10px 0;}
.jpwr-mq-track{display:inline-block;animation:jpwr-scroll 22s linear infinite;}
.jpwr-mq span{font-family:'Archivo',sans-serif;font-weight:900;text-transform:uppercase;font-size:15px;letter-spacing:.08em;padding:0 18px;}
.jpwr-mq .star{color:${c.pop};}
@keyframes jpwr-scroll{from{transform:translateX(0);}to{transform:translateX(-50%);}}
@media(prefers-reduced-motion:reduce){.jpwr-mq-track{animation:none;}}

/* Sections */
.jpwr-sec{padding:clamp(52px,8vw,92px) 0;}
.jpwr-sec-head{margin-bottom:clamp(26px,4vw,42px);display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
.jpwr-sec-head h2{font-size:clamp(28px,4.8vw,44px);}
.jpwr-sec-head .doodle{flex:0 0 auto;color:${c.accent};}

/* Tiles — bordered, hard-shadowed */
.jpwr-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr));gap:20px;}
.jpwr-tile{border:2px solid ${c.ink};border-radius:14px;padding:24px 20px;box-shadow:5px 5px 0 ${c.ink};transition:transform .14s,box-shadow .14s;min-width:0;background:${c.surface};}
.jpwr-tile:hover{transform:translate(-3px,-3px);box-shadow:8px 8px 0 ${c.ink};}
.jpwr-tile:nth-child(3n+2){background:${c.tint};}
.jpwr-tile:nth-child(3n){background:${c.soft};}
.jpwr-tile h3{font-family:'Archivo',sans-serif;font-weight:900;text-transform:uppercase;font-size:17.5px;line-height:1.15;overflow-wrap:anywhere;}
.jpwr-tile p{margin-top:8px;font-size:14.5px;color:${c.sub};overflow-wrap:anywhere;}
.jpwr-tile .pp{display:inline-block;margin-top:14px;background:${c.pop};color:${c.popInk};border:2px solid ${c.ink};border-radius:999px;font-weight:700;font-size:13px;padding:3px 12px;}

/* About — duotone split */
.jpwr-about{background:${c.tint};border-top:3px solid ${c.ink};border-bottom:3px solid ${c.ink};}
.jpwr-about-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(24px,4vw,56px);align-items:center;}
.jpwr-about-grid h2{font-size:clamp(28px,4.8vw,46px);}
.jpwr-about-grid .sq{width:56px;height:10px;background:${c.accent};border:2px solid ${c.ink};margin-top:16px;}
.jpwr-about-grid p{font-size:clamp(15.5px,2vw,17px);white-space:pre-line;overflow-wrap:anywhere;}
@media(max-width:720px){.jpwr-about-grid{grid-template-columns:1fr;}}

/* Quotes — tilted sticker cards */
.jpwr-q-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(270px,100%),1fr));gap:22px;}
.jpwr-q{border:2px solid ${c.ink};border-radius:14px;background:${c.surface};padding:22px 20px;box-shadow:4px 4px 0 ${c.ink};transform:rotate(-.8deg);min-width:0;}
.jpwr-q:nth-child(even){transform:rotate(.8deg);background:${c.soft};}
.jpwr-q p{font-size:15.5px;font-weight:500;overflow-wrap:anywhere;}
.jpwr-q cite{display:inline-block;margin-top:12px;font-style:normal;font-weight:700;font-size:13px;background:${c.pop};color:${c.popInk};border:2px solid ${c.ink};border-radius:999px;padding:2px 12px;}

/* Hours — bold ledger */
.jpwr-hours{max-width:560px;border:2px solid ${c.ink};border-radius:14px;overflow:hidden;box-shadow:5px 5px 0 ${c.ink};background:${c.surface};}
.jpwr-hrow{display:flex;justify-content:space-between;gap:16px;padding:13px 18px;border-bottom:2px solid ${c.ink};font-size:15px;}
.jpwr-hrow:last-child{border-bottom:none;}
.jpwr-hrow:nth-child(even){background:${c.soft};}
.jpwr-hrow b{font-family:'Archivo',sans-serif;font-weight:900;text-transform:uppercase;font-size:13.5px;letter-spacing:.04em;padding-top:2px;}
.jpwr-hrow span{text-align:right;overflow-wrap:anywhere;}
.jpwr-area-note{margin-top:18px;font-size:14px;color:${c.sub};overflow-wrap:anywhere;}

/* Footer — ink block */
.jpwr-foot{background:${c.ink};color:${c.darkInk};padding:clamp(48px,8vw,88px) 0 26px;}
.jpwr-foot h2{font-size:clamp(30px,5.6vw,54px);color:${c.darkInk};}
.jpwr-foot h2 .hl{color:${c.pop};}
.jpwr-foot .lines{margin-top:26px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;}
.jpwr-foot .lines a{font-weight:700;font-size:clamp(16px,2.4vw,20px);color:${c.darkInk};border-bottom:3px solid ${c.accent};padding-bottom:2px;transition:color .15s,border-color .15s;overflow-wrap:anywhere;}
.jpwr-foot .lines a:hover{color:${c.pop};border-color:${c.pop};}
.jpwr-foot .addr{margin-top:14px;font-size:14.5px;color:${c.darkSub};overflow-wrap:anywhere;}
.jpwr-foot .fine{margin-top:34px;padding-top:16px;border-top:1px solid rgba(255,255,255,.18);font-size:13px;color:${c.darkSub};display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between;}
`;

// Highlight the last word of the headline in the accent color.
function Chunk({ text }) {
  const words = text.split(' ');
  if (words.length < 2) return <span className="hl">{text}</span>;
  const last = words.pop();
  return (<>{words.join(' ')} <span className="hl">{last}</span></>);
}

export default function RetailTemplate({ data }) {
  const d = data || {};
  useGoogleFonts('family=Archivo:wght@600;700;900&family=Space+Grotesk:wght@400;500;700');
  const pal = resolvePalette(RETAIL_PALETTES, d.paletteId);
  const photos = React.useMemo(() => mergePhotos(d.photos, DEFAULT_PHOTOS), [d.photos]);
  const style = React.useMemo(
    () => css(pal.c) + PH_CSS('.jpwr', `linear-gradient(140deg,${pal.c.tint},${pal.c.soft})`),
    [pal]
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
  const ctaLabel = txt(d.ctaLabel) || 'Come say hi';
  const ctaHref = phone ? telHref(phone) : (email ? `mailto:${email}` : null);
  const marqueeText = txt(d.tagline) || name;
  const hasContact = !!(phone || email || address);
  const year = new Date().getFullYear();

  const navLinks = [
    services.length && ['#goods', 'The goods'],
    about && ['#story', 'Story'],
    hours.length && ['#hours', 'Hours'],
  ].filter(Boolean);

  // Marquee: the strip repeats "<tagline> ★" enough times to always overflow,
  // then the track scrolls -50% on a loop (the content is doubled, so the wrap
  // is seamless). Static (no animation) under prefers-reduced-motion.
  const mqCells = Array.from({ length: 6 });

  return (
    <div className="jpwr">
      <style>{style}</style>

      <nav className="jpwr-nav">
        <div className="jpwr-wrap jpwr-nav-in">
          <div className="jpwr-brand"><mark>{name}</mark></div>
          {navLinks.length > 0 && (
            <div className="jpwr-links">
              {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            </div>
          )}
          {phone && <a className="jpwr-chip" href={telHref(phone)}>Call us</a>}
        </div>
      </nav>

      <header className="jpwr-hero">
        <div className="jpwr-wrap jpwr-hero-grid">
          <div>
            <span className="jpwr-badge">
              {established ? `Est. ${established}` : (area || 'Hello!')}
            </span>
            <h1 className="jpwr-black"><Chunk text={headline} /></h1>
            {txt(d.tagline) && txt(d.tagline) !== headline && (
              <p className="tag">{txt(d.tagline)}</p>
            )}
            {(ctaHref || services.length > 0) && (
              <div className="jpwr-ctas">
                {ctaHref && <a className="jpwr-btn" href={ctaHref}>{ctaLabel}</a>}
                {services.length > 0 && <a className="jpwr-btn jpwr-btn-alt" href="#goods">Browse the goods</a>}
              </div>
            )}
          </div>
          <div className="jpwr-hero-ph">
            <span className="jpwr-hero-tag" aria-hidden="true">local + loved</span>
            <Ph src={photos.hero} alt={name} fx={<RetailFx c={pal.c} glyph="star" />} />
          </div>
        </div>
      </header>

      <div className="jpwr-mq" aria-hidden="true">
        <div className="jpwr-mq-track">
          {mqCells.map((_, i) => (
            <React.Fragment key={i}>
              <span>{marqueeText}</span><span className="star">★</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {photos.gallery.length > 0 && (
        <section className="jpwr-sec" aria-label="Photos" style={{ paddingBottom: 0 }}>
          <div className="jpwr-wrap">
            <div className="jpwr-sec-head">
              <h2 className="jpwr-black">The vibe</h2>
              <svg className="doodle" width="46" height="18" viewBox="0 0 46 18" fill="none" aria-hidden="true">
                <path d="M2 12 Q 8 2 14 10 T 26 10 T 38 10 T 44 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="jpwr-shelf">
              {photos.gallery.map((src, i) => (
                <Ph key={i} src={src} alt={`Inside ${name}`}
                  fx={<RetailFx c={pal.c} glyph={['smile', 'tag', 'star'][i % 3]} />} />
              ))}
            </div>
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section className="jpwr-sec" id="goods">
          <div className="jpwr-wrap">
            <div className="jpwr-sec-head">
              <h2 className="jpwr-black">The goods</h2>
              <svg className="doodle" width="46" height="18" viewBox="0 0 46 18" fill="none" aria-hidden="true">
                <path d="M2 12 Q 8 2 14 10 T 26 10 T 38 10 T 44 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="jpwr-tiles">
              {services.map((s, i) => (
                <div className="jpwr-tile" key={i}>
                  <h3>{txt(s.name)}</h3>
                  {txt(s.desc) && <p>{txt(s.desc)}</p>}
                  {txt(s.price) && <span className="pp">{txt(s.price)}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {about && (
        <section className="jpwr-sec jpwr-about" id="story">
          <div className="jpwr-wrap jpwr-about-grid">
            <div>
              <h2 className="jpwr-black">Our story</h2>
              <div className="sq" aria-hidden="true" />
            </div>
            <p>{about}</p>
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="jpwr-sec">
          <div className="jpwr-wrap">
            <div className="jpwr-sec-head">
              <h2 className="jpwr-black">People love it here</h2>
            </div>
            <div className="jpwr-q-grid">
              {quotes.map((q, i) => (
                <blockquote className="jpwr-q" key={i}>
                  <p>“{txt(q.quote)}”</p>
                  {txt(q.name) && <cite>{txt(q.name)}</cite>}
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {hours.length > 0 && (
        <section className="jpwr-sec" id="hours" style={{ paddingTop: quotes.length ? 0 : undefined }}>
          <div className="jpwr-wrap">
            <div className="jpwr-sec-head">
              <h2 className="jpwr-black">When we&rsquo;re open</h2>
            </div>
            <div className="jpwr-hours">
              {hours.map((h, i) => (
                <div className="jpwr-hrow" key={i}>
                  <b>{txt(h.days) || '—'}</b><span>{txt(h.hours) || '—'}</span>
                </div>
              ))}
            </div>
            {area && <p className="jpwr-area-note">Find us around {area}.</p>}
          </div>
        </section>
      )}

      <footer className="jpwr-foot" id="contact">
        <div className="jpwr-wrap">
          <h2 className="jpwr-black"><Chunk text={hasContact ? 'Come say hi' : name} /></h2>
          {hasContact && (
            <div className="lines">
              {phone && <a href={telHref(phone)}>{phone}</a>}
              {email && <a href={`mailto:${email}`}>{email}</a>}
            </div>
          )}
          {address && <p className="addr">{address}</p>}
          <div className="fine">
            <span>© {year} {name}</span>
            {established && <span>Est. {established}</span>}
          </div>
        </div>
      </footer>
    </div>
  );
}
