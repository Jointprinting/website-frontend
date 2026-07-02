# Working agreement — website-frontend

How to work with Nate on the Joint Printing codebase. **These rules apply to every
request** — follow them by default, not only when asked.

The site is one interconnected ecosystem — `website-frontend` (this repo) +
`website-backend` — so most work spans tools and often both repos. Build accordingly.

## 1. Brainstorm before you build
On anything non-trivial, don't jump straight to code — think it through *with me* first:
- Restate what I'm actually after (the goal behind the ask, not just the literal words).
- Propose the smartest way in, and surface any fork worth my input.
- Get a quick 👍, then build.

Trivial / obvious changes (typos, one-liners, mechanical edits) — just do them and
mention it. When unsure, float the approach first; it's cheap.

## 2. Build the smartest, ecosystem-native way
This is an interconnected system, not a pile of pages. New work should *reflect* that:

- **Reuse, don't reinvent.** Prefer existing handlers, helpers, patterns, and tokens
  over new ones. Shared vocab lives in `src/screens/studio/_shared.js` (palette `D`,
  `STATUS_OPTIONS`, money/format helpers) and `src/screens/studio/crm/_crm.js`
  (`CRM_STAGES`, `telHref` / `smsHref`, date helpers, chips). A new action should reuse
  the exact path the buttons/rows already use — e.g. a right-click "Open order" reuses
  `goOrder`, not a fresh fetch.
- **Wire the ecosystem.** The Studio tools — CRM ⇄ Order Tracker ⇄ Vendors ⇄ Finances ⇄
  Mockup Studio — are connected by shared IDs (`companyKey`, `orderNumber`,
  `projectNumber`) and cross-tool deep links (`onNavigate({ view, companyKey /
  orderNumber / projectNumber })`). A feature on one surface usually should link to and
  stay in sync with the others.
- **Frontend ⇄ backend.** A UI feature usually has an API counterpart in
  `website-backend` (controllers / models / routes). Change both together; keep client
  mirrors of server constants in sync (they're commented as such).
- **Pick the intelligent method, not the quick hack.** Think about the whole system:
  what else touches this data, what must stay consistent, what I'll want next.
- Match the surrounding code's patterns, naming, and altitude. The public marketing
  site and the private Studio (`/studio`) are distinct — keep their behavior separate.

## 3. Ship it live, then brief me — no drafts
I don't want to babysit draft PRs. For each change:
1. Implement, then **verify**: `npm run build` (must compile clean) and `npm test` for
   any touched logic.
2. Open a **normal, non-draft PR** with a clear title + body.
3. Once the build / CI is green, **squash-merge to `main`** and confirm the Vercel
   production deploy goes live.
4. **Then** give me the overview — what shipped, where, and anything to eyeball.

Only hold instead of shipping if the change is genuinely risky / ambiguous or I told you
to wait. If CI is red or a merge conflicts, fix it and proceed — don't hand me a
half-done PR. If a change spans both repos, ship them together.

## House facts
- **Repos:** `Jointprinting/website-frontend` (React 18 + MUI 5, deployed on Vercel —
  **merge to `main` = production deploy**); `Jointprinting/website-backend` (Express +
  MongoDB API).
- **The Studio** (`/studio`) is the private admin: CRM, Order Tracker, Vendors,
  Finances, Mockup Studio, Backup. Everything else is the public marketing site.
- Studio dark theme + shared UI primitives come from `_shared.js` / `_crm.js` — use them.
- **Know the business before advising on it:** `website-backend/docs/BUSINESS-MODEL.md`
  (who pays, how money is made, funnel, integrations, open questions) and
  `website-backend/docs/ECOSYSTEM.md` (canonical order flow + owner decisions). Read them
  at the start of any non-trivial task.
