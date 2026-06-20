import { getSettings } from "@/lib/content";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "Contact",
  description:
    "Get in touch with Lantern Barn — questions, event inquiries, private hire, and orders. Bridgewater, Vermont.",
};

const allowed = ["General", "Event", "Order", "Private hire", "Press"];

export default async function ContactPage({ searchParams }) {
  const s = await getSettings();
  const topic = allowed.includes(searchParams?.topic) ? searchParams.topic : "General";

  return (
    <section className="container-x py-16">
      <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="eyebrow mb-3">Say hello</p>
          <h1 className="text-4xl sm:text-5xl">Get in touch</h1>
          <p className="mt-4 max-w-prose text-lg text-ink/75">
            Questions, event ideas, want to sell your goods at the barn, or
            thinking about a private gathering? We'd love to hear from you.
          </p>

          <div className="mt-8 space-y-2 text-ink/80">
            {s.email && (
              <p>
                <span className="font-semibold text-pine">Email:</span>{" "}
                <a className="text-clay underline" href={`mailto:${s.email}`}>{s.email}</a>
              </p>
            )}
            {s.phone && (
              <p>
                <span className="font-semibold text-pine">Phone:</span>{" "}
                <a className="text-clay underline" href={`tel:${s.phone}`}>{s.phone}</a>
              </p>
            )}
            {s.address && (
              <p><span className="font-semibold text-pine">Visit:</span> {s.address}</p>
            )}
          </div>

          <div className="mt-6 flex gap-4 text-sm">
            {s.instagram && (
              <a className="text-clay underline" href={s.instagram} target="_blank" rel="noreferrer">Instagram</a>
            )}
            {s.facebook && (
              <a className="text-clay underline" href={s.facebook} target="_blank" rel="noreferrer">Facebook</a>
            )}
          </div>
        </div>

        <ContactForm defaultTopic={topic} />
      </div>
    </section>
  );
}
