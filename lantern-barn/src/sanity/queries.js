// Plain GROQ template strings (no extra tag dependency needed).

export const siteSettingsQuery = `*[_type == "siteSettings"][0]{
  name, tagline, description,
  address, hours, phone, email,
  instagram, facebook, mapUrl,
  heroImage, heroHeadline, heroSubhead
}`;

export const eventsQuery = `*[_type == "event"] | order(startsAt asc){
  _id, title, "slug": slug.current, startsAt, endsAt,
  location, summary, image, recurring, rsvpUrl
}`;

export const upcomingEventsQuery = `*[_type == "event" && startsAt >= now()] | order(startsAt asc)[0...$limit]{
  _id, title, "slug": slug.current, startsAt, endsAt,
  location, summary, image, recurring, rsvpUrl
}`;

export const eventBySlugQuery = `*[_type == "event" && slug.current == $slug][0]{
  _id, title, "slug": slug.current, startsAt, endsAt,
  location, summary, body, image, recurring, rsvpUrl
}`;

export const productsQuery = `*[_type == "product"] | order(featured desc, title asc){
  _id, title, "slug": slug.current, price, image, summary,
  soldOut, featured, squareUrl
}`;

export const productBySlugQuery = `*[_type == "product" && slug.current == $slug][0]{
  _id, title, "slug": slug.current, price, image, summary, body,
  soldOut, featured, squareUrl, gallery
}`;

export const galleryQuery = `*[_type == "siteSettings"][0].gallery`;
