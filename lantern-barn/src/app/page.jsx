import Image from "next/image";
import Link from "next/link";
import { getSettings, getUpcomingEvents, getFeaturedProducts } from "@/lib/content";
import { urlForImage } from "@/sanity/client";
import SectionHeading from "@/components/SectionHeading";
import EventCard from "@/components/EventCard";
import ProductCard from "@/components/ProductCard";
import HoursCard from "@/components/HoursCard";
import NewsletterSignup from "@/components/NewsletterSignup";

export default async function HomePage() {
  const [settings, events, products] = await Promise.all([
    getSettings(),
    getUpcomingEvents(3),
    getFeaturedProducts(3),
  ]);

  const heroSrc = urlForImage(settings.heroImage, { width: 2000 });

  return (
    <>
      {/* ── Hero ──────────────────────────────────── */}
      <section className="relative isolate flex min-h-[78vh] items-end overflow-hidden">
        {heroSrc && (
          <Image
            src={heroSrc}
            alt={settings.heroImage?.alt || "Lantern Barn on the river"}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />
        <div className="container-x relative z-10 pb-16 pt-32 text-cream">
          <p className="eyebrow text-lantern">Bridgewater, Vermont · on the Ottauquechee</p>
          <h1 className="mt-3 max-w-3xl text-4xl text-cream sm:text-6xl">
            {settings.heroHeadline || "A gathering place on the river."}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-cream/85">
            {settings.heroSubhead || settings.tagline}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/visit" className="btn-accent">Visit the Barn</Link>
            <Link href="/events" className="btn-outline border-cream/40 text-cream hover:bg-cream hover:text-pine">
              See what's on
            </Link>
          </div>
        </div>
      </section>

      {/* ── Welcome ──────────────────────────────── */}
      <section className="container-x py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-3">Welcome to the barn</p>
            <h2 className="text-3xl sm:text-4xl">{settings.tagline}</h2>
            <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink/75">
              {settings.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/about" className="btn-primary">Our story</Link>
              <Link href="/shop" className="btn-outline">Shop local goods</Link>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-4">
            {[
              { t: "Pour-over coffee", d: "Roasted with care, poured slow." },
              { t: "Riverside seating", d: "A porch right over the water." },
              { t: "Events & games", d: "Music, makers, and game nights." },
              { t: "Local makers", d: "Knickknacks from the valley." },
            ].map((f) => (
              <li key={f.t} className="rounded-xl2 bg-white p-5 shadow-soft">
                <h3 className="text-lg">{f.t}</h3>
                <p className="mt-1 text-sm text-ink/65">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Upcoming events ─────────────────────── */}
      <section className="bg-sand/60 py-20">
        <div className="container-x">
          <SectionHeading
            eyebrow="This season at the barn"
            title="Upcoming events"
            action="Full calendar"
            href="/events"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e._id || e.slug} event={e} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Visit / location credibility ───────────── */}
      <section className="container-x py-20">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="eyebrow mb-3">Find your way here</p>
            <h2 className="text-3xl sm:text-4xl">Come hang out on the river</h2>
            <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink/75">
              We're an easy stop right off Route 4 in Bridgewater. Grab a coffee,
              find a seat on the deck, and stay a while — the river does the rest.
            </p>
            <address className="mt-6 not-italic text-ink/80">
              {settings.address}
            </address>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/visit" className="btn-primary">Plan your visit</Link>
              {settings.mapUrl && (
                <a href={settings.mapUrl} target="_blank" rel="noreferrer" className="btn-outline">
                  Get directions
                </a>
              )}
            </div>
          </div>
          <HoursCard hours={settings.hours} />
        </div>
      </section>

      {/* ── Featured shop ──────────────────────── */}
      <section className="bg-sand/60 py-20">
        <div className="container-x">
          <SectionHeading
            eyebrow="From the shop"
            title="Take a little barn home"
            action="Visit the shop"
            href="/shop"
          />
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p._id || p.slug} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Gallery ─────────────────────────── */}
      {settings.gallery?.length > 0 && (
        <section className="container-x py-20">
          <SectionHeading eyebrow="Around the barn" title="A few moments" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {settings.gallery.slice(0, 6).map((g, i) => {
              const src = urlForImage(g, { width: 800 });
              return (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl2 bg-sand">
                  {src && (
                    <Image
                      src={src}
                      alt={g.alt || "Lantern Barn"}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Community CTA band ──────────────────── */}
      <section className="bg-pine">
        <div className="container-x grid items-center gap-8 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-3xl text-cream sm:text-4xl">Stay in the loop</h2>
            <p className="mt-3 max-w-md text-cream/75">
              Get the heads-up on open mics, market days, new roasts, and
              everything happening down at the barn.
            </p>
          </div>
          <div className="rounded-xl2 bg-cream p-6 shadow-soft">
            <NewsletterSignup variant="section" />
          </div>
        </div>
      </section>
    </>
  );
}
