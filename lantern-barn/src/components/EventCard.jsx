import Image from "next/image";
import Link from "next/link";
import { urlForImage } from "@/sanity/client";
import { formatShortDate, formatEventTime } from "@/lib/format";

export default function EventCard({ event }) {
  const src = urlForImage(event.image, { width: 800 });
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl2 bg-white shadow-soft transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        {src && (
          <Image
            src={src}
            alt={event.image?.alt || event.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute left-3 top-3 rounded-full bg-cream/95 px-3 py-1 text-xs font-semibold text-pine shadow">
          {formatShortDate(event.startsAt)}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        {event.recurring && (
          <p className="eyebrow mb-1">{event.recurring}</p>
        )}
        <h3 className="text-xl">{event.title}</h3>
        <p className="mt-1 text-sm text-ink/60">
          {formatEventTime(event.startsAt, event.endsAt)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {event.summary && (
          <p className="mt-3 line-clamp-2 text-sm text-ink/70">{event.summary}</p>
        )}
        <span className="mt-4 text-sm font-semibold text-clay group-hover:text-pine">
          Details →
        </span>
      </div>
    </Link>
  );
}
