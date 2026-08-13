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
//     once his photos exist. Until then the spine is his ABOUT block: the
//     lineage and the process are the only things that do the photographs'
//     job, which is why the process paragraph runs near-whole and second.
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
// PHOTOS: no stock photography, and — unlike every other look — no crafted
// gallery placeholders either. See DEFAULT_PHOTOS below; the short version is
// that on a sculptor's page a drawn form in a "Selected work" grid is an
// invented artwork, not a texture. His real photos drop into
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

// NO default gallery — an empty work grid is correct until his photos arrive.
//
// The other looks ship three empty slots so the crafted tile paints a decorative
// scene. That reasoning does NOT transfer here: on a plumber's page a crafted
// tile is a texture, but on a sculptor's page anything in a grid headed
// "Selected work" reads as one of his sculptures. Painting invented forms there
// fabricates the very thing the site exists to sell — the same objection that
// rules out stock photography, one step worse, because at least a stock photo is
// somebody's real work. So the grid, its nav link and the hero's "See the work"
// button all stay hidden until data.photos.gallery has real entries.
//
// The hero band still uses a crafted backdrop: it is an abstract ground behind
// the type, not a depiction of a piece.
const DEFAULT_PHOTOS = { hero: '', gallery: [] };

// Todd-specific standing fact from his intake ("prefers calls, doesn't receive
// texts"). Hard-coded because the shared `data` contract has no field for it —
// if he ever starts texting, this line is the one place to change.
//
// FIRST PERSON, deliberately: this is his own site, so it speaks AS him. A
// third-person "Todd prefers…" reads like an agency wrote the page about him.
const CALL_NOTE = 'Please call — I don’t receive text messages.';

// The nav mark: up to THREE initials, so "Todd Reuben Sculptor" reads TRS.
// Derived rather than hard-coded, so renaming the site in the Studio moves the
// mark with it instead of leaving a stale monogram in the corner.
const markOf = (name) => String(name || '')
  .trim().split(/\s+/).filter(Boolean).slice(0, 3)
  .map((w) => w[0].toUpperCase()).join('') || '—';

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

/* Work — the spine.
   His photographs are studio shots: one piece alone on a white plinth against
   white seamless, and they arrive in BOTH orientations — tall thin forms whose
   tip nearly touches the top of the frame, and low wide ones. So nothing here
   crops. An editorial grid of fixed-ratio cover tiles decapitated the tall
   pieces and cut the plinths off the wide ones; on a sculptor's page the
   silhouette IS the work, and a cropped sculpture is a misrepresented one.
   Every photo is CONTAINED, whole, inside a square tile.
   The tile is a shade darker than his backdrops on purpose: his six whites
   differ slightly shot to shot, and against a mat each photo reads as a light
   panel placed on it rather than six near-matches failing to line up.
   Flex, not grid, so any number of pieces centres its last row instead of
   leaving a hole — he may send a seventh or sell one at any time. */
.jpwtr-gal{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(16px,2.6vw,32px);}
.jpwtr-work{flex:0 1 clamp(220px,30%,340px);min-width:0;margin:0;display:flex;flex-direction:column;}
/* No drawn border: the mat is a step DARKER than the tile's surroundings, so a
   c.line rule (lighter than the mat) would ring every piece in an inner glow.
   The mat/page step is the edge. Hover still needs an affordance. */
.jpwtr-gal .jpw-ph{aspect-ratio:1/1;border:1px solid transparent;
  transition:border-color .25s,transform .25s;}
.jpwtr-work:hover .jpw-ph{transform:translateY(-3px);border-color:${c.accent};}
/* Three across, then two, then one. Without the middle stage three-up held all
   the way down to ~775px, where each sculpture is a 220px thumbnail, and then
   dropped straight to one — the two-up stage is where a phone-sized tablet
   actually lives. */
@media(max-width:1000px){.jpwtr-work{flex:0 1 clamp(240px,46%,360px);}}
/* The tile is a button: a sculpture is worth looking at closely, so the whole
   plate is the target. Reset the UA button chrome, keep a visible focus ring. */
.jpwtr-open{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in;font:inherit;color:inherit;}
.jpwtr-open:focus-visible{outline:2px solid ${c.accent};outline-offset:3px;}

/* Closer look — dark room, the piece lit in the middle of it, and the number
   to call right underneath so nobody has to scroll back to find it. */
.jpwtr-viewer{position:fixed;inset:0;z-index:200;background:color-mix(in srgb,${c.dark} 94%,#000);
  display:flex;align-items:center;justify-content:center;padding:clamp(16px,4vw,56px);
  animation:jpwtr-fade .18s ease-out;}
@keyframes jpwtr-fade{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.jpwtr-viewer{animation:none;}}
.jpwtr-vinner{display:flex;flex-direction:column;align-items:center;gap:clamp(14px,2.4vw,26px);
  max-width:min(1100px,100%);max-height:100%;}
.jpwtr-vimg{max-width:100%;max-height:min(68vh,760px);object-fit:contain;display:block;}
.jpwtr-vmeta{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;max-width:56ch;}
.jpwtr-vmeta b{font-weight:400;font-size:clamp(19px,2.6vw,26px);color:${c.darkInk};}
.jpwtr-vmeta span{font-size:14.5px;color:${c.darkSub};font-weight:300;overflow-wrap:anywhere;}
.jpwtr-vmeta em{font-style:normal;font-size:13.5px;letter-spacing:.1em;color:${c.darkInk};}
.jpwtr-vcall{margin-top:8px;display:inline-block;background:${c.accent};color:${c.accentInk};
  font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;padding:14px 30px;
  transition:background .18s,color .18s;overflow-wrap:anywhere;}
.jpwtr-vcall:hover{background:${c.darkInk};color:${c.dark};}
.jpwtr-vnote{font-size:12.5px;color:${c.darkSub};}
.jpwtr-vclose,.jpwtr-vnav{position:absolute;background:none;border:0;color:${c.darkSub};cursor:pointer;
  font-family:'Marcellus',Georgia,serif;line-height:1;padding:10px 16px;transition:color .15s;}
.jpwtr-vclose:hover,.jpwtr-vnav:hover{color:${c.darkInk};}
.jpwtr-vclose:focus-visible,.jpwtr-vnav:focus-visible{outline:2px solid ${c.accent};outline-offset:2px;}
.jpwtr-vclose{top:clamp(6px,1.6vw,18px);right:clamp(6px,1.6vw,18px);font-size:34px;}
.jpwtr-vnav{top:50%;transform:translateY(-50%);font-size:44px;}
.jpwtr-vnav.prev{left:clamp(0px,1vw,14px);}
.jpwtr-vnav.next{right:clamp(0px,1vw,14px);}
/* On a phone the photo fills the width, so side arrows get squeezed into the
   gutter and end up half off-screen. Drop them to the bottom, clear of the
   plate, with a real tap target. */
@media(max-width:640px){.jpwtr-vimg{max-height:50vh;}
  .jpwtr-vnav{top:auto;bottom:10px;transform:none;font-size:30px;padding:8px 22px;
    background:color-mix(in srgb,${c.darkInk} 10%,transparent);border-radius:999px;}
  .jpwtr-vnav.prev{left:18px;}.jpwtr-vnav.next{right:18px;}
  .jpwtr-vinner{padding-bottom:46px;}}

/* Caption: appears only when he has told us what a piece is called. */
.jpwtr-cap-work{display:flex;flex-direction:column;gap:4px;padding:14px 2px 0;}
.jpwtr-cap-work b{font-family:'Marcellus',Georgia,serif;font-weight:400;font-size:16.5px;overflow-wrap:anywhere;}
.jpwtr-cap-work span{font-size:14px;color:${c.sub};font-weight:300;overflow-wrap:anywhere;}
.jpwtr-cap-work em{font-style:normal;font-size:13px;letter-spacing:.08em;color:${c.ink};}
@media(max-width:640px){.jpwtr-work{flex:0 1 min(100%,420px);}}

/* Commissions + available work — the two things he actually sells, side by
   side and equally weighted, because those two ARE the offer.
   Deliberately not the numbered ledger this used to be: 01/02/03 line-items
   read as a trades price list beside artwork, and his sculptures are titled
   BY NUMBER, so the only numerals on the page must not label services. */
.jpwtr-offers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
  gap:clamp(20px,3.6vw,48px);border-top:1px solid ${c.ink};padding-top:clamp(26px,4vw,48px);}
.jpwtr-offer + .jpwtr-offer{border-left:1px solid ${c.line};padding-left:clamp(20px,3.6vw,48px);}
.jpwtr-offer h3{font-family:'Marcellus',Georgia,serif;font-weight:400;font-size:clamp(21px,2.9vw,30px);line-height:1.2;overflow-wrap:anywhere;}
.jpwtr-offer p{margin-top:14px;font-size:15.5px;color:${c.sub};font-weight:300;overflow-wrap:anywhere;}
.jpwtr-offer .price{margin-top:14px;display:inline-block;font-size:13px;letter-spacing:.1em;}
/* An odd last panel would sit alone in half the row — let it take the width. */
.jpwtr-offers .jpwtr-offer:last-child:nth-child(odd){grid-column:1 / -1;border-left:none;padding-left:0;}
@media(max-width:720px){.jpwtr-offers{grid-template-columns:1fr;gap:30px;}
  .jpwtr-offer + .jpwtr-offer{border-left:none;padding-left:0;border-top:1px solid ${c.line};padding-top:30px;}}

/* About — bio block, hairline rule, portrait-free by design */
.jpwtr-about{background:${c.soft};}
.jpwtr-about .in{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:clamp(24px,5vw,64px);align-items:start;}
/* The heading column is short and the bio is long, so it would otherwise sit
   above a tall void. Sticking it alongside the prose reads as placed. */
@media(min-width:761px){.jpwtr-about .in>div:first-child{position:sticky;top:96px;}}
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
    () => css(pal.c, photos.hero)
      // A light MAT, not the dark crafted tile the other looks use: these tiles
      // hold contained photographs on a pale page, so a dark ground would read as
      // a hole punched in it. One clear step darker than his backdrops, though —
      // his six whites vary shot to shot, and against too close a tone that
      // variance reads as six near-matches failing to line up rather than six lit
      // panels on a board.
      + PH_CSS('.jpwtr', `color-mix(in srgb,${pal.c.ink} 8%,${pal.c.soft})`)
      // Must come AFTER PH_CSS, which sets object-fit:cover — see the grid
      // comment above for why nothing in this gallery may be cropped. The
      // padding keeps a piece off the tile edge; box-sizing is border-box, so
      // `contain` fits inside the padded box.
      + `.jpwtr .jpwtr-gal .jpw-ph>img{object-fit:contain;padding:clamp(10px,4%,30px);}`,
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

  // One row per sculpture: its photo, and its details WHEN THEY EXIST. Photo
  // and caption live in the same row on purpose — a parallel captions array
  // would drift the moment a piece is reordered or sold, and a caption under
  // the wrong sculpture is worse than no caption at all.
  //
  // Falls back to the plain photo list, so a site built before `works` existed
  // (and the shared contract suite) renders exactly as it did.
  const works = React.useMemo(() => {
    // A row earns a place on the page by having a PHOTO, not a title. The rows
    // are seeded with his piece names ahead of the pictures, so keying off the
    // title would put six empty mats on the public site while the photographs
    // are still being uploaded.
    const listed = rows(d.works, 'photo');
    if (listed.length) {
      return listed.map((w) => ({
        photo: txt(w.photo), title: txt(w.title), note: txt(w.note), price: txt(w.price),
      }));
    }
    return photos.gallery.map((photo) => ({ photo, title: '', note: '', price: '' }));
  }, [d.works, photos]);
  const hours = rows(d.hours, 'days', 'hours');
  const quotes = rows(d.testimonials, 'quote');

  // Which piece is open in the closer look. -1 is closed.
  const [viewing, setViewing] = React.useState(-1);
  const openPiece = viewing >= 0 && viewing < works.length ? works[viewing] : null;
  const closeViewer = React.useCallback(() => setViewing(-1), []);
  const stepViewer = React.useCallback(
    (delta) => setViewing((n) => (n < 0 ? n : (n + delta + works.length) % works.length)),
    [works.length]
  );

  // Escape closes, arrows move along the row — a visitor looking at sculptures
  // should be able to go through them without returning to the grid each time.
  // The scroll lock stops the page drifting behind the overlay on a phone.
  React.useEffect(() => {
    if (!openPiece) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeViewer();
      else if (e.key === 'ArrowRight') stepViewer(1);
      else if (e.key === 'ArrowLeft') stepViewer(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [openPiece, closeViewer, stepViewer]);

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
    works.length && ['#work', 'Work'],
    pieces.length && ['#commissions', 'Commissions'],
    about && ['#about', 'About'],
    hasContact && ['#contact', 'Contact'],
  ].filter(Boolean);

  return (
    <div className="jpwtr">
      <style>{style}</style>

      <nav className="jpwtr-nav">
        <div className="jpwtr-wrap jpwtr-nav-in">
          {/* Three letters, not the shared two: his mark is TRS. initialsOf()
              gives "TR" from the first two words, which drops the S and reads
              like somebody's initials rather than a studio mark. */}
          <span className="jpwtr-mark" aria-hidden="true">{markOf(name)}</span>
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
                {works.length > 0 && <a className="jpwtr-btn" href="#work">See the work</a>}
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

      {works.length > 0 && (
        <section className="jpwtr-sec" id="work">
          <div className="jpwtr-wrap">
            <div className="jpwtr-sec-head">
              <span className="jpwtr-cap">No two alike</span>
              <h2 className="jpwtr-serif">Selected work</h2>
            </div>
            <div className="jpwtr-gal">
              {works.map((w, i) => (
                <figure className="jpwtr-work" key={i}>
                  {/* No crafted underlayer here, for two reasons that point the
                      same way. Visually, a contained photo leaves the tile
                      showing around it, so an fx becomes a frame rather than a
                      backdrop — a metallic one framed every piece in fake metal.
                      And a crafted scene in this grid draws a SCULPTURE: if a
                      photo failed to load, a drawn one would stand in for his
                      real work. An empty mat is the honest failure. */}
                  <button type="button" className="jpwtr-open" onClick={() => setViewing(i)}
                    aria-label={w.title ? `Look closer at ${w.title}` : `Look closer at sculpture ${i + 1}`}>
                    <Ph src={w.photo}
                      alt={w.title ? `${w.title} — ${name}` : `${name} — sculpture ${i + 1} of ${works.length}`} />
                  </button>
                  {/* The caption only exists once he has told us what a piece is
                      called. Until then the photograph stands on its own rather
                      than under a blank line — and no piece is ever labelled
                      with anything he did not say. */}
                  {(w.title || w.note || w.price) && (
                    <figcaption className="jpwtr-cap-work">
                      {w.title && <b>{w.title}</b>}
                      {w.note && <span>{w.note}</span>}
                      {w.price && <em>{w.price}</em>}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {pieces.length > 0 && (
        <section className="jpwtr-sec" id="commissions">
          <div className="jpwtr-wrap">
            <div className="jpwtr-sec-head">
              <span className="jpwtr-cap">Enquiries welcome</span>
              <h2 className="jpwtr-serif">Commissions &amp; available work</h2>
            </div>
            <div className="jpwtr-offers">
              {pieces.map((p, i) => (
                <div className="jpwtr-offer" key={i}>
                  <h3>{txt(p.name)}</h3>
                  {txt(p.desc) && <p>{txt(p.desc)}</p>}
                  {txt(p.price) && <span className="price">{txt(p.price)}</span>}
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
            {/* Covers both halves of what he sells — "Commission a piece"
                ignored the finished work, now that the offers section names
                them side by side. And it says the actual next step. */}
            <span className="jpwtr-cap">Enquiries</span>
            <h2 className="jpwtr-serif">Start with a phone call</h2>
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

      {/* The closer look. A visitor who taps a sculpture wants two things: to
          see it properly, and to know how to get one — so the phone number is
          in here rather than making them scroll back to find it. The photo is
          contained, never cropped, for the same reason the grid contains it. */}
      {openPiece && (
        <div className="jpwtr-viewer" role="dialog" aria-modal="true"
          aria-label={openPiece.title ? `${openPiece.title}, closer look` : 'Sculpture, closer look'}
          onClick={closeViewer}>
          <button type="button" className="jpwtr-vclose" onClick={closeViewer} aria-label="Close">×</button>
          {works.length > 1 && (
            <>
              <button type="button" className="jpwtr-vnav prev"
                onClick={(e) => { e.stopPropagation(); stepViewer(-1); }} aria-label="Previous sculpture">‹</button>
              <button type="button" className="jpwtr-vnav next"
                onClick={(e) => { e.stopPropagation(); stepViewer(1); }} aria-label="Next sculpture">›</button>
            </>
          )}
          {/* Clicks inside the plate must not close it — only the backdrop does. */}
          <div className="jpwtr-vinner" onClick={(e) => e.stopPropagation()}>
            <img className="jpwtr-vimg" src={openPiece.photo}
              alt={openPiece.title ? `${openPiece.title} — ${name}` : `${name} — sculpture`} />
            <div className="jpwtr-vmeta">
              {openPiece.title && <b className="jpwtr-serif">{openPiece.title}</b>}
              {openPiece.note && <span>{openPiece.note}</span>}
              {openPiece.price && <em>{openPiece.price}</em>}
              {phone && (
                <a className="jpwtr-vcall" href={telHref(phone)}>
                  {openPiece.title ? `Call about ${openPiece.title} — ${phone}` : `Call about this piece — ${phone}`}
                </a>
              )}
              {phone && <span className="jpwtr-vnote">{CALL_NOTE}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
