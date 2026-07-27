// src/webworks/templates/custom/ToddReuben.js
// CUSTOM BUILD — Todd Reuben Sculptor (Woodstock, Vermont).
//
// Not one of the five on-the-fly templates: this is a hand-built site for one
// client, registered in the registry's CUSTOM_SITES so it renders through the
// exact same machinery (Studio editor preview, /webworks/p/:slug preview link,
// ClientSite on his own domain once he pays).
//
// WHO IT IS FOR — every layout call traces back to his intake answers:
//   • Stainless steel sculpture. Commissions + finished pieces for sale.
//     No two alike — the artwork is the site, so the work grid is the spine
//     and everything else is quiet around it.
//   • "Professional and high end" — gallery-wall neutrals, Marcellus display
//     serif, wide letterspacing, a lot of air. Reads like a catalogue, not a
//     services page.
//   • He is 100% phone. Doesn't text, doesn't use tech. So the phone number is
//     the loudest element on the page (nav, hero, and a dark closing band that
//     is basically one big call button), and the CALL_NOTE below tells visitors
//     not to text him.
//   • Ships worldwide from Vermont — serviceArea/address ride together as one
//     "made here, shipped anywhere" line rather than a service-area pitch.
//
// PHOTOS are crafted-by-default (same choice as Trades: DEFAULT_PHOTOS are
// empty strings, so the fail-safe stack paints a crafted polished-steel scene
// instead of stock photography). Deliberate — stock photos of somebody else's
// sculpture would misrepresent his portfolio. His real photos drop into
// data.photos.{hero,gallery} from the Studio with no deploy, and the work grid
// takes any number of them.
//
// It renders the SAME `data` contract as every template, so Nate edits it in
// the Studio Websites tab like any other site.

import * as React from 'react';
import {
  useGoogleFonts, resolvePalette, initialsOf, telHref, txt, rows,
  mergePhotos, Ph, PH_CSS,
} from '../_kit';
import { TODD_REUBEN_PALETTES } from '../_meta';

// Crafted-only defaults — no stock art on an artist's portfolio. See header.
const DEFAULT_PHOTOS = { hero: '', gallery: ['', '', ''] };

// Todd-specific standing fact from his intake ("prefers calls, doesn't receive
// texts"). Hard-coded because the shared `data` contract has no field for it —
// if he ever starts texting, this line is the one place to change.
//
// FIRST PERSON, deliberately: this is his own site, so it speaks AS him. A
// third-person "Todd prefers…" reads like an agency wrote the page about him.
const CALL_NOTE = 'Please call — I don’t receive text messages.';

// Crafted no-photo scene: brushed-steel field, a specular sweep, and one
// polished abstract form on a plinth. This is what paints while a photo loads,
// if a photo fails, and on every empty slot before his photos arrive.
function SteelFx({ c, form }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.dark} />
          <stop offset=".52" stopColor={c.accent} stopOpacity=".55" />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
        <linearGradient id={`sw-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".46" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".54" stopColor="#fff" stopOpacity=".05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <pattern id={`br-${uid}`} width="3" height="500" patternUnits="userSpaceOnUse">
          <rect width="1" height="500" fill="#fff" opacity=".05" />
        </pattern>
      </defs>

      <rect width="400" height="500" fill={`url(#sg-${uid})`} />
      <rect width="400" height="500" fill={`url(#br-${uid})`} />
      <rect width="400" height="500" fill={`url(#sw-${uid})`} />

      {/* the piece — polished stroke, catching light on one edge */}
      <g transform="translate(200 250)" fill="none" stroke={c.darkInk}
        strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".82">
        {form === 'ribbon' && (<>
          <path d="M-52 116C-52 40 52 40 52 -36C52 -96 -18 -108 -40 -64" />
          <path d="M-16 116C-16 56 68 44 68 -18" opacity=".45" />
        </>)}
        {form === 'arc' && (<>
          <path d="M-70 116C-70 -4 70 -4 70 116" />
          <path d="M-34 116C-34 44 34 44 34 116" opacity=".45" />
        </>)}
        {form === 'monolith' && (<>
          <path d="M-30 116L-14 -104L26 -78L40 116z" />
          <path d="M-14 -104L40 116" opacity=".4" />
        </>)}
        {form === 'orbit' && (<>
          <circle cx="0" cy="-16" r="62" />
          <ellipse cx="0" cy="-16" rx="62" ry="24" opacity=".45" />
          <path d="M0 46v70" />
        </>)}
      </g>

      {/* plinth */}
      <g opacity=".5">
        <path d="M118 366h164l16 34H102z" fill={c.dark} />
        <path d="M102 400h296" stroke={c.darkInk} strokeWidth="1.5" opacity=".35" />
      </g>
    </svg>
  );
}

const FORMS = ['ribbon', 'arc', 'monolith', 'orbit'];

const css = (c, hero) => `
.jpwtr{--max:1120px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;background:${c.bg};color:${c.ink};line-height:1.7;font-weight:400;overflow-x:clip;min-height:100%;}
.jpwtr *,.jpwtr *::before,.jpwtr *::after{box-sizing:border-box;margin:0;padding:0;}
.jpwtr a{text-decoration:none;}
.jpwtr-wrap{max-width:var(--max);margin:0 auto;padding:0 clamp(18px,5vw,40px);}
/* display serif never breaks mid-word — break-word only splits a word wider
   than the whole line, which the clamps below never allow for real content */
.jpwtr-serif{font-family:'Marcellus',Georgia,serif;font-weight:400;line-height:1.16;overflow-wrap:break-word;}
.jpwtr-cap{font-size:11px;font-weight:500;letter-spacing:.34em;text-transform:uppercase;color:${c.sub};}

/* Nav — thin, quiet, phone always visible */
.jpwtr-nav{position:sticky;top:0;z-index:50;background:color-mix(in srgb,${c.bg} 88%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid ${c.line};}
.jpwtr-nav-in{display:flex;align-items:center;gap:18px;min-height:66px;}
.jpwtr-mark{width:34px;height:34px;flex:0 0 auto;border:1px solid ${c.ink};color:${c.ink};display:flex;align-items:center;justify-content:center;font-family:'Marcellus',Georgia,serif;font-size:13px;letter-spacing:.06em;}
.jpwtr-brand{font-family:'Marcellus',Georgia,serif;font-size:clamp(15px,2.2vw,18px);letter-spacing:.14em;text-transform:uppercase;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.jpwtr-links{display:flex;gap:26px;margin-left:auto;}
.jpwtr-links a{font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:${c.sub};transition:color .15s;}
.jpwtr-links a:hover{color:${c.ink};}
.jpwtr-navcall{flex:0 0 auto;font-size:13px;font-weight:500;letter-spacing:.08em;color:${c.ink};border-bottom:1px solid ${c.accent};padding-bottom:3px;transition:color .15s,border-color .15s;white-space:nowrap;}
.jpwtr-navcall:hover{color:${c.accent};}
.jpwtr-nav .jpwtr-navcall{margin-left:auto;}
.jpwtr-nav .jpwtr-links + .jpwtr-navcall{margin-left:0;}
@media(max-width:860px){.jpwtr-links{display:none;}}
/* On a phone the number outranks the wordmark — drop the monogram and tighten
   the brand so "TODD REUBEN SCULPTOR" sits whole beside it instead of eliding. */
@media(max-width:560px){.jpwtr-mark{display:none;}.jpwtr-nav-in{gap:12px;}
  .jpwtr-brand{font-size:12.5px;letter-spacing:.06em;}.jpwtr-navcall{font-size:12.5px;}}

/* Hero — dark gallery band. With a photo, a deep wash keeps the type readable
   over it. With NO photo (how it ships, before his are in) the crafted steel
   gradient has to carry the whole band alone, so it gets a stronger mix and a
   raking highlight instead of the flat wash. */
.jpwtr-hero{position:relative;background-color:${c.dark};color:${c.darkInk};overflow:hidden;
  background-image:${hero
    /* Wash is heaviest where the type sits and thins out to the right, so his
       photo actually reads instead of being flattened to near-black. */
    ? `linear-gradient(103deg,${c.dark}f2 0%,${c.dark}d6 46%,${c.dark}80 100%),url('${hero}'),`
    : `radial-gradient(120% 96% at 76% 16%,color-mix(in srgb,${c.accent} 46%,transparent),transparent 60%),
       linear-gradient(103deg,${c.dark}f0 0%,${c.dark}c4 52%,${c.dark}82 100%),`}
    linear-gradient(140deg,${c.dark},color-mix(in srgb,${c.accent} 40%,${c.dark}) 58%,${c.dark});
  background-size:cover;background-position:center;}
.jpwtr-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:color-mix(in srgb,${c.accent} 55%,transparent);}
/* The band is full-bleed; only the TEXT column is narrow — and the headline
   alone carries the measure, so the eyebrow and buttons never wrap with it. */
.jpwtr-hero-in{position:relative;z-index:1;padding:clamp(72px,13vw,148px) 0 clamp(60px,10vw,120px);max-width:min(100%,780px);}
.jpwtr-hero .jpwtr-cap{color:${c.darkSub};white-space:nowrap;}
.jpwtr-hero h1{font-size:clamp(38px,7.4vw,78px);color:${c.darkInk};margin-top:20px;max-width:13ch;}
.jpwtr-hero .jpwtr-tag{margin-top:22px;max-width:44ch;font-size:clamp(15.5px,2vw,18.5px);color:${c.darkSub};font-weight:300;overflow-wrap:anywhere;}
.jpwtr-hero-ctas{display:flex;flex-wrap:wrap;gap:14px;margin-top:38px;}
.jpwtr-btn{display:inline-block;white-space:nowrap;text-align:center;font-size:12px;letter-spacing:.2em;text-transform:uppercase;padding:15px 34px;border:1px solid ${c.darkInk};color:${c.darkInk};transition:background .18s,color .18s,border-color .18s;}
/* Once they stack, two buttons of different label lengths read as ragged —
   match their widths so the pair looks placed rather than left over. */
@media(max-width:480px){.jpwtr-hero-ctas{flex-direction:column;align-items:stretch;}}
.jpwtr-btn:hover{background:${c.darkInk};color:${c.dark};}
.jpwtr-btn-solid{background:${c.accent};border-color:${c.accent};color:${c.accentInk};}
.jpwtr-btn-solid:hover{background:${c.darkInk};border-color:${c.darkInk};color:${c.dark};}
/* the shipping/origin line, hung off the bottom of the hero band */
/* padding-top/bottom only — the shorthand would reset the horizontal padding
   .jpwtr-wrap puts on this same element and shove the strip to the edge */
.jpwtr-origin{position:relative;z-index:1;border-top:1px solid color-mix(in srgb,${c.darkInk} 16%,transparent);
  padding-top:18px;padding-bottom:22px;display:flex;flex-wrap:wrap;gap:8px 28px;}
.jpwtr-origin span{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:${c.darkSub};overflow-wrap:anywhere;}

/* Section scaffolding */
.jpwtr-sec{padding:clamp(58px,9vw,112px) 0;}
.jpwtr-sec-head{max-width:62ch;margin-bottom:clamp(28px,5vw,52px);}
.jpwtr-sec-head h2{font-size:clamp(28px,4.6vw,48px);margin-top:14px;}
.jpwtr-sec-head p{margin-top:16px;font-size:clamp(15px,1.9vw,17px);color:${c.sub};font-weight:300;overflow-wrap:anywhere;}

/* Work — the spine. Editorial grid that takes ANY number of photos: a
   full-width piece opens each run, the rest pair up.
   The period is FIVE (one wide + four halves), not four: four leaves three
   halves between wide tiles, an odd number, so one is always stranded alone
   in a half-width slot with dead space beside it. And whatever the total, a
   trailing half that would sit alone is promoted to full width — that's the
   :last-child pair below, which covers every count (2 and 4 within each run).
   Photo counts are the client's to decide, so no count may look broken. */
.jpwtr-gal{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:clamp(12px,2.4vw,26px);}
.jpwtr-gal .jpw-ph{grid-column:span 3;aspect-ratio:4/5;transition:transform .25s;}
.jpwtr-gal .jpw-ph:nth-child(5n+1),
.jpwtr-gal .jpw-ph:last-child:nth-child(5n+2),
.jpwtr-gal .jpw-ph:last-child:nth-child(5n+4){grid-column:span 6;aspect-ratio:16/10;}
.jpwtr-gal .jpw-ph:hover{transform:translateY(-4px);}
@media(max-width:700px){.jpwtr-gal .jpw-ph,
  .jpwtr-gal .jpw-ph:nth-child(5n+1),
  .jpwtr-gal .jpw-ph:last-child:nth-child(5n+2),
  .jpwtr-gal .jpw-ph:last-child:nth-child(5n+4){grid-column:span 6;aspect-ratio:4/5;}}

/* Commissions + available work — a numbered catalogue ledger, not tiles */
.jpwtr-cat{border-top:1px solid ${c.ink};}
.jpwtr-crow{display:grid;grid-template-columns:auto minmax(0,4fr) minmax(0,6fr) minmax(0,2fr);gap:8px 26px;align-items:baseline;padding:26px 4px;border-bottom:1px solid ${c.line};transition:background .18s;}
.jpwtr-crow:hover{background:${c.surface};}
.jpwtr-crow .no{font-size:11px;letter-spacing:.18em;color:${c.accent};font-variant-numeric:tabular-nums;padding-top:6px;}
.jpwtr-crow h3{font-family:'Marcellus',Georgia,serif;font-weight:400;font-size:clamp(20px,2.6vw,26px);line-height:1.24;overflow-wrap:anywhere;}
.jpwtr-crow .d{font-size:15.5px;color:${c.sub};font-weight:300;overflow-wrap:anywhere;}
.jpwtr-crow .p{text-align:right;font-size:13.5px;letter-spacing:.08em;white-space:nowrap;}
@media(max-width:760px){.jpwtr-crow{grid-template-columns:auto minmax(0,1fr);}
  .jpwtr-crow .d,.jpwtr-crow .p{grid-column:2 / -1;text-align:left;}}

/* About — bio block, hairline rule, portrait-free by design */
.jpwtr-about{background:${c.soft};}
.jpwtr-about .in{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:clamp(24px,5vw,64px);align-items:start;}
.jpwtr-about h2{font-size:clamp(26px,4vw,42px);margin-top:14px;}
.jpwtr-about p{font-size:clamp(15.5px,2vw,17.5px);color:color-mix(in srgb,${c.ink} 82%,${c.sub});font-weight:300;white-space:pre-line;overflow-wrap:anywhere;}
@media(max-width:760px){.jpwtr-about .in{grid-template-columns:1fr;}}

/* Words from collectors */
.jpwtr-q{max-width:660px;}
.jpwtr-q p{font-family:'Marcellus',Georgia,serif;font-size:clamp(20px,3vw,28px);line-height:1.44;overflow-wrap:anywhere;}
.jpwtr-q .who{margin-top:18px;display:flex;align-items:center;gap:12px;}
.jpwtr-q .dot{width:30px;height:30px;border-radius:50%;background:${c.accent};color:${c.accentInk};display:flex;align-items:center;justify-content:center;font-size:11px;flex:0 0 auto;}
.jpwtr-q cite{font-style:normal;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;color:${c.sub};}
.jpwtr-q + .jpwtr-q{margin-top:clamp(34px,6vw,54px);}

/* Hours — only if he ever adds any (e.g. "By appointment") */
.jpwtr-hours{max-width:460px;}
.jpwtr-hrow{display:flex;justify-content:space-between;gap:18px;padding:13px 2px;border-bottom:1px solid ${c.line};}
.jpwtr-hrow:last-child{border-bottom:none;}
.jpwtr-hrow b{font-weight:500;font-size:12px;letter-spacing:.18em;text-transform:uppercase;}
.jpwtr-hrow span{color:${c.sub};font-size:14.5px;text-align:right;overflow-wrap:anywhere;}

/* Contact — the point of the whole page. Dark band, phone at display size. */
.jpwtr-contact{background:${c.dark};color:${c.darkInk};}
.jpwtr-contact .jpwtr-cap{color:${c.darkSub};}
.jpwtr-contact h2{font-size:clamp(28px,4.6vw,46px);color:${c.darkInk};margin-top:14px;}
.jpwtr-phone{display:inline-block;margin-top:30px;font-family:'Marcellus',Georgia,serif;font-size:clamp(32px,6.4vw,62px);letter-spacing:.02em;color:${c.darkInk};border-bottom:1px solid color-mix(in srgb,${c.accent} 70%,transparent);padding-bottom:8px;transition:color .18s,border-color .18s;}
.jpwtr-phone:hover{color:${c.accent};border-color:${c.accent};}
.jpwtr-note{margin-top:18px;font-size:14px;color:${c.darkSub};font-weight:300;max-width:40ch;overflow-wrap:anywhere;}
.jpwtr-clines{margin-top:30px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;}
.jpwtr-clines a{font-size:14px;letter-spacing:.08em;color:${c.darkSub};border-bottom:1px solid transparent;padding-bottom:2px;transition:color .15s,border-color .15s;overflow-wrap:anywhere;}
.jpwtr-clines a:hover{color:${c.darkInk};border-color:${c.darkInk};}
.jpwtr-clines span{font-size:14px;color:${c.darkSub};font-weight:300;overflow-wrap:anywhere;}

.jpwtr-foot{padding:24px 16px;text-align:center;font-size:11.5px;letter-spacing:.14em;color:${c.sub};}
`;

export default function ToddReubenSite({ data }) {
  const d = data || {};
  useGoogleFonts('family=Marcellus&family=Inter:wght@300;400;500;600');
  const pal = resolvePalette(TODD_REUBEN_PALETTES, d.paletteId);
  const photos = React.useMemo(() => mergePhotos(d.photos, DEFAULT_PHOTOS), [d.photos]);
  const style = React.useMemo(
    () => css(pal.c, photos.hero) + PH_CSS('.jpwtr', `linear-gradient(150deg,${pal.c.dark},color-mix(in srgb,${pal.c.accent} 30%,${pal.c.dark}))`),
    [pal, photos.hero]
  );

  const name = txt(d.businessName) || 'Your Business';
  const phone = txt(d.phone);
  const email = txt(d.email);
  const address = txt(d.address);
  const area = txt(d.serviceArea);
  const about = txt(d.about);
  const tagline = txt(d.tagline);
  const established = txt(d.established);
  const license = txt(d.license);
  const pieces = rows(d.services, 'name');
  const hours = rows(d.hours, 'days', 'hours');
  const quotes = rows(d.testimonials, 'quote');

  const headline = txt(d.heroHeadline) || tagline || name;
  const ctaLabel = txt(d.ctaLabel) || 'Call the studio';
  const ctaHref = phone ? telHref(phone) : (email ? `mailto:${email}` : null);
  const hasContact = !!(phone || email || address);
  const year = new Date().getFullYear();

  // Hero eyebrow and the origin strip draw from the same small pool of facts —
  // pick each one once so "Woodstock, Vermont" can't print twice in a row.
  const eyebrow = address || area || (established ? `Since ${established}` : 'Sculpture');
  const originBits = [address, area, established && `Since ${established}`]
    .filter(Boolean).filter((t) => t !== eyebrow);

  const navLinks = [
    photos.gallery.length && ['#work', 'Work'],
    pieces.length && ['#commissions', 'Commissions'],
    about && ['#about', 'About'],
    hasContact && ['#contact', 'Contact'],
  ].filter(Boolean);

  return (
    <div className="jpwtr">
      <style>{style}</style>

      <nav className="jpwtr-nav">
        <div className="jpwtr-wrap jpwtr-nav-in">
          <span className="jpwtr-mark" aria-hidden="true">{initialsOf(name)}</span>
          <div className="jpwtr-brand">{name}</div>
          {navLinks.length > 0 && (
            <div className="jpwtr-links">
              {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            </div>
          )}
          {phone && <a className="jpwtr-navcall" href={telHref(phone)}>{phone}</a>}
        </div>
      </nav>

      <header className="jpwtr-hero">
        <div className="jpwtr-wrap">
          <div className="jpwtr-hero-in">
            <span className="jpwtr-cap">{eyebrow}</span>
            <h1 className="jpwtr-serif">{headline}</h1>
            {tagline && tagline !== headline && <p className="jpwtr-tag">{tagline}</p>}
            {ctaHref && (
              <div className="jpwtr-hero-ctas">
                <a className="jpwtr-btn jpwtr-btn-solid" href={ctaHref}>{ctaLabel}</a>
                {photos.gallery.length > 0 && <a className="jpwtr-btn" href="#work">See the work</a>}
              </div>
            )}
          </div>
        </div>
        {originBits.length > 0 && (
          <div className="jpwtr-wrap jpwtr-origin">
            {originBits.map((b) => <span key={b}>{b}</span>)}
          </div>
        )}
      </header>

      {photos.gallery.length > 0 && (
        <section className="jpwtr-sec" id="work">
          <div className="jpwtr-wrap">
            <div className="jpwtr-sec-head">
              <span className="jpwtr-cap">No two alike</span>
              <h2 className="jpwtr-serif">Selected work</h2>
            </div>
            <div className="jpwtr-gal">
              {photos.gallery.map((src, i) => (
                <Ph key={i} src={src} alt={`${name} — sculpture`}
                  fx={<SteelFx c={pal.c} form={FORMS[i % FORMS.length]} />} />
              ))}
            </div>
          </div>
        </section>
      )}

      {pieces.length > 0 && (
        <section className="jpwtr-sec" id="commissions">
          <div className="jpwtr-wrap">
            <div className="jpwtr-sec-head">
              <span className="jpwtr-cap">Commissions &amp; available work</span>
              <h2 className="jpwtr-serif">How to own a piece</h2>
            </div>
            <div className="jpwtr-cat">
              {pieces.map((p, i) => (
                <div className="jpwtr-crow" key={i}>
                  <span className="no">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{txt(p.name)}</h3>
                  <span className="d">{txt(p.desc)}</span>
                  <span className="p">{txt(p.price)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {about && (
        <section className="jpwtr-sec jpwtr-about" id="about">
          <div className="jpwtr-wrap in">
            {/* Just "About" — the site speaks AS him, so "About <his name>"
                would read as though someone else wrote the page about him. */}
            <div>
              <span className="jpwtr-cap">The artist</span>
              <h2 className="jpwtr-serif">About</h2>
            </div>
            <p>{about}</p>
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="jpwtr-sec">
          <div className="jpwtr-wrap">
            <div className="jpwtr-sec-head">
              <span className="jpwtr-cap">In their words</span>
            </div>
            {quotes.map((q, i) => (
              <blockquote className="jpwtr-q" key={i}>
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
        <section className="jpwtr-sec" id="hours">
          <div className="jpwtr-wrap">
            <div className="jpwtr-sec-head">
              <span className="jpwtr-cap">Studio</span>
              <h2 className="jpwtr-serif">Hours</h2>
            </div>
            <div className="jpwtr-hours">
              {hours.map((h, i) => (
                <div className="jpwtr-hrow" key={i}>
                  <b>{txt(h.days) || '—'}</b><span>{txt(h.hours) || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {hasContact && (
        <section className="jpwtr-sec jpwtr-contact" id="contact">
          <div className="jpwtr-wrap">
            <span className="jpwtr-cap">Enquiries</span>
            <h2 className="jpwtr-serif">Commission a piece</h2>
            {phone && (
              <>
                <a className="jpwtr-phone jpwtr-serif" href={telHref(phone)}>{phone}</a>
                <p className="jpwtr-note">{CALL_NOTE}</p>
              </>
            )}
            {(email || address || area) && (
              <div className="jpwtr-clines">
                {email && <a href={`mailto:${email}`}>{email}</a>}
                {address && <span>{address}</span>}
                {area && <span>{area}</span>}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="jpwtr-foot">
        © {year} {name}{license ? ` · ${license}` : ''}
      </footer>
    </div>
  );
}
