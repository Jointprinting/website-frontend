import { getEvents } from "@/lib/content";
import EventCard from "@/components/EventCard";

export const metadata = {
  title: "Events",
  description:
    "Live music, open mics, market days, yoga on the river deck, game nights and more at Lantern Barn in Bridgewater, Vermont.",
};

export default async function EventsPage() {
  const events = await getEvents();
  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.endsAt || e.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  return (
    <>
      <section className="bg-sand/60">
        <div className="container-x py-16">
          <p className="eyebrow mb-3">What's on</p>
          <h1 className="text-4xl sm:text-5xl">Events at the barn</h1>
          <p className="mt-4 max-w-prose text-lg text-ink/75">
            There's almost always a reason to come down. Music, makers, mornings
            on the river — here's what's coming up.
          </p>
        </div>
      </section>

      <section className="container-x py-16">
        {upcoming.length === 0 ? (
          <p className="text-lg text-ink/70">
            No events on the calendar right now — check back soon, or{" "}
            <a className="text-clay underline" href="/contact">
              sign up for the newsletter
            </a>{" "}
            to hear first.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard key={e._id || e.slug} event={e} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
