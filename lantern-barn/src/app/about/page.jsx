import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/lib/content";
import { urlForImage } from "@/sanity/client";

export const metadata = {
  title: "About",
  description:
    "The story of Lantern Barn — a restored barn turned community gathering place on the Ottauquechee River in Bridgewater, Vermont.",
};

export default async function AboutPage() {
  const s = await getSettings();
  const gallery = s.gallery || [];

  return (
    <>
      <section className="container-x py-16">
        <div className="mx-auto max-w-prose text-center">
          <p className="eyebrow mb-3">Our story</p>
          <h1 className="text-4xl sm:text-5xl">A barn with the lights on</h1>
        </div>
        <div className="prose-barn mx-auto mt-8 max-w-prose text-lg">
          <p>
            Lantern Barn started with a simple idea: that a small town deserves a
            warm place to land. An old barn on the Ottauquechee, a good cup of
            coffee, and a door that's always open.
          </p>
          <p>
            We restored the post-and-beam by hand, built a deck out over the
            water, and filled the shelves with goods from makers up and down the
            valley. Now it's a place to read, to work, to catch live music, to
            play a long game of cards while the river goes by.
          </p>
          <p>
            However you use it, you're welcome here. Pull up a chair and stay a
            while.
          </p>
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="container-x pb-16">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {gallery.map((g, i) => {
              const src = urlForImage(g, { width: 900 });
              return (
                <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl2 bg-sand">
                  {src && (
                    <Image
                      src={src}
                      alt={g.alt || "Lantern Barn"}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-pine">
        <div className="container-x flex flex-col items-center gap-5 py-16 text-center">
          <h2 className="text-3xl text-cream sm:text-4xl">Come be part of it</h2>
          <p className="max-w-md text-cream/75">
            The barn is what the community makes it. We'd love to see you down here.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/visit" className="btn-accent">Visit the barn</Link>
            <Link href="/events" className="btn-outline border-cream/40 text-cream hover:bg-cream hover:text-pine">
              See events
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
