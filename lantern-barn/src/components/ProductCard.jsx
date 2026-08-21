import Image from "next/image";
import Link from "next/link";
import { urlForImage } from "@/sanity/client";
import { formatPrice } from "@/lib/format";

export default function ProductCard({ product }) {
  const src = urlForImage(product.image, { width: 800 });
  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl2 bg-white shadow-soft transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="relative aspect-square overflow-hidden bg-sand">
        {src && (
          <Image
            src={src}
            alt={product.image?.alt || product.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {product.soldOut && (
          <div className="absolute left-3 top-3 rounded-full bg-ink/85 px-3 py-1 text-xs font-semibold text-cream">
            Sold out
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg">{product.title}</h3>
        {product.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-ink/60">{product.summary}</p>
        )}
        <p className="mt-3 font-display text-lg font-semibold text-pine">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
