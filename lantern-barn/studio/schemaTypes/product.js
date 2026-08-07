import { defineType, defineField, defineArrayMember } from "sanity";

export default defineType({
  name: "product",
  title: "Shop item",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug (web address)",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "price", title: "Price (USD)", type: "number", validation: (r) => r.min(0) }),
    defineField({ name: "summary", title: "Short description", type: "text", rows: 2 }),
    defineField({ name: "body", title: "Full description", type: "array", of: [{ type: "block" }] }),
    defineField({
      name: "image",
      title: "Main photo",
      type: "image",
      options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Alt text", type: "string" })],
    }),
    defineField({
      name: "gallery",
      title: "More photos",
      type: "array",
      of: [defineArrayMember({ type: "image", options: { hotspot: true } })],
    }),
    defineField({ name: "featured", title: "Feature on homepage?", type: "boolean", initialValue: false }),
    defineField({ name: "soldOut", title: "Sold out?", type: "boolean", initialValue: false }),
    defineField({
      name: "squareUrl",
      title: "Square checkout / item link",
      type: "url",
      description: "Paste the Square Online item or checkout link so people can buy it.",
    }),
  ],
  preview: { select: { title: "title", subtitle: "price", media: "image" } },
});
