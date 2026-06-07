import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01";

// True once the owner has connected their Sanity project (env vars set).
export const sanityEnabled = Boolean(projectId);

export const client = sanityEnabled
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
    })
  : null;

const builder = sanityEnabled ? imageUrlBuilder(client) : null;

/**
 * Returns an image URL for either a Sanity image object or a plain
 * { url } object used by the built-in sample content.
 */
export function urlForImage(source, { width, height } = {}) {
  if (!source) return null;
  if (typeof source === "string") return source;
  if (source.url) return source.url; // sample content
  if (builder && source.asset) {
    let img = builder.image(source).auto("format").fit("max");
    if (width) img = img.width(width);
    if (height) img = img.height(height);
    return img.url();
  }
  return null;
}
