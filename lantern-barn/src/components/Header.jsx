"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const links = [
  { href: "/events", label: "Events" },
  { href: "/shop", label: "Shop" },
  { href: "/visit", label: "Visit" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header({ settings }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const name = settings?.name || "Lantern Barn";

  return (
    <header className="sticky top-0 z-50 border-b border-pine/10 bg-cream/90 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-pine"
          onClick={() => setOpen(false)}
        >
          <Logo className="h-7 w-7 text-lantern" />
          <span className="font-display text-xl font-semibold tracking-tight">
            {name}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors hover:text-clay ${
                  active ? "text-clay" : "text-ink/70"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link href="/visit" className="btn-accent">
            Visit the Barn
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-pine md:hidden"
        >
          <span className="sr-only">Menu</span>
          <div className="space-y-1.5">
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-pine/10 bg-cream md:hidden">
          <div className="container-x flex flex-col py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-pine/5 py-3 text-base font-medium text-ink/80"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/visit"
              onClick={() => setOpen(false)}
              className="btn-accent mt-4"
            >
              Visit the Barn
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
