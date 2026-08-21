import { getEvents, getProducts } from "@/lib/content";

export default async function sitemap() {
  const base = "https://lanternbarn.com";
  const [events, products] = await Promise.all([getEvents(), getProducts()]);

  const staticRoutes = ["", "/events", "/shop", "/visit", "/about", "/contact"].map(
    (path) => ({ url: `${base}${path}`, changeFrequency: "weekly", priority: path === "" ? 1 : 0.7 })
  );

  const eventRoutes = events
    .filter((e) => e.slug)
    .map((e) => ({ url: `${base}/events/${e.slug}`, changeFrequency: "weekly", priority: 0.6 }));

  const productRoutes = products
    .filter((p) => p.slug)
    .map((p) => ({ url: `${base}/shop/${p.slug}`, changeFrequency: "weekly", priority: 0.6 }));

  return [...staticRoutes, ...eventRoutes, ...productRoutes];
}
