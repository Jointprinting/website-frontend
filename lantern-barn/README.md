# Lantern Barn

A multi-page community website for **Lantern Barn** — a coffee + community space on the
Ottauquechee River in Bridgewater, Vermont. Built to grow a community (and revenue): events,
a shop with online ordering, newsletter capture, and a location people can find and trust.

**Stack:** Next.js 14 (App Router) · Tailwind CSS · Sanity (CMS) · Square (store) · deployed on Vercel.

The site runs fully with built-in **sample content** out of the box — no accounts required to
develop or preview. As you connect Sanity / Square / email, the real data takes over automatically.

---

## Pages

| Route | What it's for |
|---|---|
| `/` | Home — hero, welcome, upcoming events, visit info, featured shop, gallery, newsletter |
| `/events` + `/events/[slug]` | Events calendar + individual event pages (RSVP/inquiry) |
| `/shop` + `/shop/[slug]` | Shop grid + product pages with Square checkout |
| `/visit` | Address, hours, map, parking, what to expect (location credibility) |
| `/about` | The barn's story + photo gallery |
| `/contact` | Inquiry form (general, events, orders, private hire) |
| `/api/contact`, `/api/subscribe` | Form + newsletter handlers |

---

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional — site works without it
npm run dev                  # http://localhost:3000
```

`npm run build` makes the production build.

---

## Project structure

```
src/
  app/            # pages (App Router) + API routes + sitemap/robots
  components/     # Header, Footer, cards, forms, newsletter
  lib/            # content.js (Sanity-or-sample), sample.js, format.js
  sanity/         # CMS client + GROQ queries
studio/           # Sanity Studio schema (for the owner's editing dashboard)
```

`src/lib/content.js` is the key file: every page asks it for content, and it returns
**real Sanity data when configured** and **sample data otherwise**.

---

# 🚀 Launch checklist (exact steps)

Do these roughly in order. A–C get the site live on your domain. D–F turn on the CMS, store, and email.

## A. Put the code in its own GitHub repo

This folder currently lives inside a delivery branch. Move it into a clean repo:

1. On GitHub, create a new **private** repo named `lantern-barn` (no README/gitignore — keep it empty).
2. On your machine:
   ```bash
   # copy just this folder out to its own directory
   cp -r lantern-barn ~/lantern-barn && cd ~/lantern-barn
   rm -rf node_modules .next
   git init && git add . && git commit -m "Initial commit: Lantern Barn site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/lantern-barn.git
   git push -u origin main
   ```

## B. Deploy to Vercel

1. Go to **vercel.com → Add New → Project**, and import the `lantern-barn` repo.
2. Framework preset auto-detects **Next.js**. Leave build settings default. Click **Deploy**.
3. You'll get a live URL like `lantern-barn.vercel.app`. Every `git push` now auto-deploys.

## C. Domain via Cloudflare + point DNS at Vercel

1. **Buy the domain:** Cloudflare dashboard → **Domain Registration → Register** → search
   `lanternbarn.com` (or `lanternbarnvt.com`). Cloudflare sells at cost with free WHOIS privacy.
2. In **Vercel → your project → Settings → Domains**, add `lanternbarn.com` and `www.lanternbarn.com`.
   Vercel shows you the DNS records it wants.
3. In **Cloudflare → your domain → DNS → Records**, add what Vercel asked for:
   - `A` record `@` → `76.76.21.21` *(Vercel shows the current value — use theirs)*
   - `CNAME` record `www` → `cname.vercel-dns.com`
   - Set both to **DNS only** (grey cloud, not orange) so Vercel manages SSL. This avoids
     double-proxy/SSL loops.
4. Back in Vercel, the domain flips to **Valid** within a few minutes and HTTPS is automatic.

## D. Connect the CMS (Sanity) — so the owner can edit

The `studio/` folder holds the content schema. Spin up a Studio and point the site at it:

1. Create the Sanity project + Studio:
   ```bash
   npm create sanity@latest -- --template clean --create-project "Lantern Barn" --dataset production
   ```
   Choose JavaScript. This makes a `studio` app and prints your **Project ID**.
2. Copy this repo's schema into that Studio: replace its `schemaTypes/` with the files in
   **`studio/schemaTypes/`** here (see `studio/README.md`), then `npm run dev` in the Studio to
   confirm you see **Site Settings, Event, Shop item**.
3. Deploy the Studio so the owner gets a hosted editor:
   ```bash
   cd studio && npx sanity deploy   # pick e.g. lanternbarn → https://lanternbarn.sanity.studio
   ```
4. Tell the website about the project. In **Vercel → Settings → Environment Variables** add:
   - `NEXT_PUBLIC_SANITY_PROJECT_ID` = *(your project id)*
   - `NEXT_PUBLIC_SANITY_DATASET` = `production`
   Redeploy. The site now reads live content; the sample data steps aside automatically.
5. **Invite the owner:** Sanity → Project → **Members → Invite** (free Editor seat). She edits at
   the `…sanity.studio` link — no code, no GitHub. Changes appear on the site within ~60 seconds.

## E. Store / online orders (Square — syncs to QuickBooks)

Square gives a free online store + an in-person card reader for the coffee bar, with one shared
inventory, and it **syncs sales into QuickBooks Online** so you still receive/track money there.

1. Create a **Square** account → set up **Square Online** (free plan) and add your items there.
2. In QuickBooks Online: **Apps → search "Square" → Connect** (Square's official sync app) so
   orders and payouts flow into your books automatically.
3. For each item, copy its **Square item/checkout link** and paste it into that product's
   **"Square checkout link"** field in Sanity. The product page's **Buy now** button uses it.
   *(In-barn sales just ring up on the Square reader — no website step needed.)*
4. *(Optional, later)* For a fully on-site cart we can add Square's Checkout API using
   `SQUARE_ACCESS_TOKEN` / `SQUARE_LOCATION_ID` (already stubbed in `.env.example`). The link
   approach above needs zero code and is the fastest way to start taking orders.

> Why not QuickBooks as the store? QuickBooks is accounting software (its commerce product was
> discontinued). Square is the storefront/POS; QuickBooks stays your books. Best of both.

## F. Contact form email + newsletter

- **Contact form:** sign up at **resend.com** (free), verify your domain, and set
  `RESEND_API_KEY` + `CONTACT_TO_EMAIL` in Vercel. Inquiries then email straight to you.
  Until then, submissions are logged and the form still "succeeds" for testing.
- **Newsletter:** `/api/subscribe` currently logs signups. Connect Mailchimp/Buttondown/ConvertKit
  (or Resend Audiences) by dropping their API call into `src/app/api/subscribe/route.js`.

---

## Environment variables

See `.env.example`. None are required to run; each unlocks a feature:

| Variable | Unlocks |
|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` / `_DATASET` | Live CMS content (owner editing) |
| `SQUARE_ACCESS_TOKEN` / `SQUARE_LOCATION_ID` / `SQUARE_ENVIRONMENT` | On-site Square checkout (optional) |
| `RESEND_API_KEY` / `CONTACT_TO_EMAIL` | Emailing contact-form submissions |

---

## Design notes

Custom (not a template): warm cream paper, deep barn-pine green, Ottauquechee slate-blue, and a
lantern-amber accent for calls to action. Display type is **Fraunces**, body is **Inter**.
Tweak the palette in `tailwind.config.js`. Replace the placeholder mark in
`src/components/Logo.jsx` when the new logo is ready.
