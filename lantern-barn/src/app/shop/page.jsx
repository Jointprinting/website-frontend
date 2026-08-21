import { getProducts } from "@/lib/content";
import ProductCard from "@/components/ProductCard";

export const metadata = {
  title: "Shop",
  description:
    "Mugs, candles, coffee, and locally made knickknacks from Lantern Barn in Bridgewater, Vermont. Order online or pick up at the barn.",
};

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <>
      <section className="bg-sand/60">
        <div className="container-x py-16">
          <p className="eyebrow mb-3">The shop</p>
          <h1 className="text-4xl sm:text-5xl">Knickknacks & good things</h1>
          <p className="mt-4 max-w-prose text-lg text-ink/75">
            A little shelf of barn goods and local makers. Order online for
            pickup or shipping — or just say hi when you're in.
          </p>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p._id || p.slug} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
