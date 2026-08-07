import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { getProduct } from "@/lib/content";
import { urlForImage } from "@/sanity/client";
import { formatPrice } from "@/lib/format";

export async function generateMetadata({ params }) {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Item not found" };
  return { title: product.title, description: product.summary };
}

export default async function ProductPage({ params }) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const src = urlForImage(product.image, { width: 1200 });

  return (
    <article className="container-x py-12 sm:py-16">
      <Link href="/shop" className="text-sm font-semibold text-clay hover:text-pine">
        ← Back to shop
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl2 bg-sand">
          {src && (
            <Image
              src={src}
              alt={product.image?.alt || product.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="text-4xl">{product.title}</h1>
          <p className="mt-3 font-display text-2xl font-semibold text-pine">
            {formatPrice(product.price)}
          </p>
          {product.summary && (
            <p className="mt-4 text-lg text-ink/80">{product.summary}</p>
          )}
          {Array.isArray(product.body) && (
            <div className="prose-barn mt-4">
              <PortableText value={product.body} />
            </div>
          )}

          <div className="mt-8">
            {product.soldOut ? (
              <span className="btn-outline pointer-events-none opacity-60">Sold out</span>
            ) : product.squareUrl ? (
              <a href={product.squareUrl} target="_blank" rel="noreferrer" className="btn-accent">
                Buy now
              </a>
            ) : (
              <Link href="/contact?topic=Order" className="btn-accent">
                Ask to order
              </Link>
            )}
            <p className="mt-3 text-sm text-ink/55">
              Checkout is powered by Square. Local pickup at the barn is always free.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
