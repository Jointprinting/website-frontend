// Single source of truth for page content. Each function reads from Sanity when
// it's configured, and otherwise returns the built-in sample content so the
// site is always fully rendered (great for local dev and first deploy).

import { client, sanityEnabled } from "@/sanity/client";
import {
  siteSettingsQuery,
  eventsQuery,
  upcomingEventsQuery,
  eventBySlugQuery,
  productsQuery,
  productBySlugQuery,
} from "@/sanity/queries";
import {
  sampleSettings,
  sampleEvents,
  sampleProducts,
} from "@/lib/sample";

// Revalidate cached CMS data every 60s in production.
const fetchOpts = { next: { revalidate: 60 } };

async function fromSanity(query, params = {}) {
  if (!sanityEnabled || !client) return null;
  try {
    return await client.fetch(query, params, fetchOpts);
  } catch (err) {
    console.error("Sanity fetch failed, using sample content:", err.message);
    return null;
  }
}

export async function getSettings() {
  return (await fromSanity(siteSettingsQuery)) || sampleSettings;
}

export async function getEvents() {
  const data = await fromSanity(eventsQuery);
  return data?.length ? data : sampleEvents;
}

export async function getUpcomingEvents(limit = 3) {
  const data = await fromSanity(upcomingEventsQuery, { limit });
  if (data?.length) return data;
  return [...sampleEvents]
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, limit);
}

export async function getEvent(slug) {
  const data = await fromSanity(eventBySlugQuery, { slug });
  return data || sampleEvents.find((e) => e.slug === slug) || null;
}

export async function getProducts() {
  const data = await fromSanity(productsQuery);
  return data?.length ? data : sampleProducts;
}

export async function getFeaturedProducts(limit = 3) {
  const all = await getProducts();
  const featured = all.filter((p) => p.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export async function getProduct(slug) {
  const data = await fromSanity(productBySlugQuery, { slug });
  return data || sampleProducts.find((p) => p.slug === slug) || null;
}
