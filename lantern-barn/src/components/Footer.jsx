import Link from "next/link";
import Logo from "@/components/Logo";
import NewsletterSignup from "@/components/NewsletterSignup";

export default function Footer({ settings }) {
  const s = settings || {};
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 bg-pine text-cream/90">
      <div className="container-x grid gap-12 py-16 md:grid-cols-3">
        {/* Brand + community signup */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <Logo className="h-7 w-7 text-lantern" />
            <span className="font-display text-xl font-semibold text-cream">
              {s.name || "Lantern Barn"}
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/70">
            {s.tagline ||
              "Coffee, community & good company on the river in Bridgewater, Vermont."}
          </p>
          <div className="mt-6">
            <NewsletterSignup variant="footer" />
          </div>
        </div>

        {/* Explore */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-lantern">
            Explore
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-cream/80">
            <li><Link className="hover:text-lantern" href="/events">Events</Link></li>
            <li><Link className="hover:text-lantern" href="/shop">Shop</Link></li>
            <li><Link className="hover:text-lantern" href="/visit">Visit</Link></li>
            <li><Link className="hover:text-lantern" href="/about">About</Link></li>
            <li><Link className="hover:text-lantern" href="/contact">Contact</Link></li>
          </ul>
        </div>

        {/* Find us */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-lantern">
            Find Us
          </h3>
          <address className="mt-4 space-y-2 text-sm not-italic text-cream/80">
            {s.address && <p>{s.address}</p>}
            {s.phone && (
              <p><a className="hover:text-lantern" href={`tel:${s.phone}`}>{s.phone}</a></p>
            )}
            {s.email && (
              <p><a className="hover:text-lantern" href={`mailto:${s.email}`}>{s.email}</a></p>
            )}
          </address>
          <div className="mt-4 flex gap-4 text-sm">
            {s.instagram && (
              <a className="hover:text-lantern" href={s.instagram} target="_blank" rel="noreferrer">Instagram</a>
            )}
            {s.facebook && (
              <a className="hover:text-lantern" href={s.facebook} target="_blank" rel="noreferrer">Facebook</a>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-cream/15">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-6 text-xs text-cream/60 sm:flex-row">
          <p>© {year} {s.name || "Lantern Barn"}. Bridgewater, Vermont.</p>
          <p>Made with care on the Ottauquechee.</p>
        </div>
      </div>
    </footer>
  );
}
