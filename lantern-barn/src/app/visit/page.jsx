import { getSettings } from "@/lib/content";
import HoursCard from "@/components/HoursCard";

export const metadata = {
  title: "Visit",
  description:
    "Find Lantern Barn in Bridgewater, Vermont — hours, directions, parking, and what to expect when you visit the river.",
};

export default async function VisitPage() {
  const s = await getSettings();
  const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(
    s.address || "Bridgewater, VT"
  )}&output=embed`;

  return (
    <>
      <section className="bg-sand/60">
        <div className="container-x py-16">
          <p className="eyebrow mb-3">Plan your visit</p>
          <h1 className="text-4xl sm:text-5xl">Come down to the barn</h1>
          <p className="mt-4 max-w-prose text-lg text-ink/75">
            Right off Route 4 in Bridgewater, on the banks of the Ottauquechee.
            Pull in, grab a coffee, and find a seat by the water.
          </p>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_1.3fr]">
          <div className="space-y-6">
            <div className="rounded-xl2 bg-white p-6 shadow-soft">
              <p className="eyebrow mb-2">Address</p>
              <address className="not-italic text-lg text-ink/85">{s.address}</address>
              <div className="mt-4 flex flex-wrap gap-3">
                {s.mapUrl && (
                  <a href={s.mapUrl} target="_blank" rel="noreferrer" className="btn-primary">
                    Get directions
                  </a>
                )}
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="btn-outline">Call {s.phone}</a>
                )}
              </div>
            </div>

            <HoursCard hours={s.hours} />

            <div className="rounded-xl2 bg-white p-6 shadow-soft">
              <p className="eyebrow mb-3">Good to know</p>
              <ul className="space-y-2 text-sm text-ink/75">
                <li>• Free parking on site, right by the door.</li>
                <li>• Dog-friendly on the river deck.</li>
                <li>• Outdoor seating over the water (weather permitting).</li>
                <li>• Wi-Fi and plenty of outlets if you're settling in.</li>
                <li>• Wheelchair-accessible entrance and seating.</li>
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl2 bg-sand shadow-soft">
            <iframe
              title="Map to Lantern Barn"
              src={mapEmbed}
              className="h-full min-h-[420px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    </>
  );
}
