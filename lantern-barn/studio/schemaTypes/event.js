import { defineType, defineField } from "sanity";

export default defineType({
  name: "event",
  title: "Event",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug (web address)",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "startsAt", title: "Starts", type: "datetime", validation: (r) => r.required() }),
    defineField({ name: "endsAt", title: "Ends", type: "datetime" }),
    defineField({ name: "location", title: "Where (e.g. The Barn, River Deck)", type: "string" }),
    defineField({ name: "recurring", title: "Recurring label (e.g. Every Sunday)", type: "string" }),
    defineField({ name: "summary", title: "Short summary", type: "text", rows: 2 }),
    defineField({ name: "body", title: "Full details", type: "array", of: [{ type: "block" }] }),
    defineField({
      name: "image",
      title: "Photo",
      type: "image",
      options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Alt text", type: "string" })],
    }),
    defineField({ name: "rsvpUrl", title: "RSVP / ticket link (optional)", type: "url" }),
  ],
  orderings: [
    { title: "Date (soonest)", name: "dateAsc", by: [{ field: "startsAt", direction: "asc" }] },
  ],
  preview: { select: { title: "title", subtitle: "startsAt", media: "image" } },
});
