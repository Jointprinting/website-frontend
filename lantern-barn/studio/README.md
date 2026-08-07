# Sanity Studio schema for Lantern Barn

These are the content types the website expects. They map 1:1 to the GROQ queries in
`src/sanity/queries.js`.

## How to use

1. Create a Studio (from the project root, see main README step D):
   ```bash
   npm create sanity@latest -- --template clean --create-project "Lantern Barn" --dataset production
   ```
2. In the generated Studio, copy the files from this folder's `schemaTypes/` over the Studio's
   own `schemaTypes/`.
3. Make sure the Studio's `sanity.config.js` registers them:
   ```js
   import { schemaTypes } from "./schemaTypes";
   // ...
   schema: { types: schemaTypes },
   ```
4. `npm run dev` to edit locally, then `npx sanity deploy` to give the owner a hosted editor.

## Content types

- **Site Settings** — name, tagline, hero, address, hours, socials, photo gallery. Create **one**
  of these (it's a singleton; the site reads the first one).
- **Event** — title, date/time, location, summary, details, photo, optional RSVP link.
- **Shop item** — name, price, photos, description, featured/sold-out flags, Square checkout link.

> Tip: to lock Site Settings to a single document, use Sanity's structure builder (a "singleton").
> Not required — the site just reads the first `siteSettings` document.
