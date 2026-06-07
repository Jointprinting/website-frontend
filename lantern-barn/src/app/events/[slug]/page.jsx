import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { getEvent, getEvents } from "@/lib/content";
import { urlForImage } from "@/sanity/client";
import { formatEventDate, formatEventTime } from "@/lib/format";

export async function generateMetadata({ params }) {
  const event = await getEvent(params.slug);
  if (!event) return { title: "Event not found" };
  return { title: event.title, description: event.summary };
}

export default async function EventPage({ params }) {
  const event = await getEvent(params.slug);
  if (!event) notFound();

  const src = urlForImage(event.image, { width: 1600 });

  return (
    <article className="container-x max-w-4xl py-12 sm:py-16">
      <Link href="/events" className="text-sm font-semibold text-clay hover:text-pine">
        ← All events
      </Link>

      {event.recurring && <p className="eyebrow mt-6">{event.recurring}</p>}
      <h1 className="mt-2 text-4xl sm:text-5xl">{event.title}</h1>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-ink/75">
        <p className="font-semibold text-pine">{formatEventDate(event.startsAt)}</p>
        <p>{formatEventTime(event.startsAt, event.endsAt)}</p>
        {event.location && <p>· {event.location}</p>}
      </div>

      {src && (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl2 bg-sand">
          <Image
            src={src}
            alt={event.image?.alt || event.title}
            fill
            sizes="(max-width: 1024px) 100vw, 900px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="prose-barn mt-8 max-w-prose">
        {event.summary && <p className="text-lg text-ink/80">{event.summary}</p>}
        {Array.isArray(event.body) && <PortableText value={event.body} />}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        {event.rsvpUrl ? (
          <a href={event.rsvpUrl} target="_blank" rel="noreferrer" className="btn-accent">
            RSVP / Tickets
          </a>
        ) : (
          <Link href="/contact?topic=Event" className="btn-accent">
            Ask about this event
          </Link>
        )}
        <Link href="/visit" className="btn-outline">
          How to get here
        </Link>
      </div>
    </article>
  );
}
