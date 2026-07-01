---
name: how-we-work
description: Nate's standing workflow for the Joint Printing ecosystem (website-frontend + website-backend). Invoke to (re)assert how to work on any task here — brainstorm the approach first, build the smartest ecosystem-native way by reusing existing handlers/deep-links across CRM/Orders/Vendors/Finances/Studio and wiring frontend+backend together, then ship it live (non-draft PR → squash-merge → deploy) before summarizing. Use at the start of a task, or any time the working style needs a reset. Mirrors CLAUDE.md, which already applies these to every request.
---

# How we work (Nate's workflow)

Apply this to the current task. These are the same rules as the repo's `CLAUDE.md`
(which applies to *every* request); invoke this skill to re-assert them explicitly.

## 1. Brainstorm first
Non-trivial request → don't jump to code. Restate the real goal, propose the smartest
approach, surface any fork worth Nate's input, get a quick 👍, then build. Trivial/obvious
changes: just do them and mention it.

## 2. Smartest, ecosystem-native method
The site is one interconnected system (frontend ⇄ backend; CRM ⇄ Orders ⇄ Vendors ⇄
Finances ⇄ Mockup Studio, linked by `companyKey` / `orderNumber` / `projectNumber` and
`onNavigate` deep links).
- **Reuse** existing handlers, helpers, and tokens (`src/screens/studio/_shared.js`,
  `src/screens/studio/crm/_crm.js`) — a new action reuses the same path the buttons/rows
  already use, never a parallel one.
- **Wire the ecosystem**: link/sync new work with the tools it relates to, and ship the
  backend counterpart in `website-backend` when there is one.
- Pick the intelligent method over the quick hack; match surrounding patterns and altitude.

## 3. Ship it live, then brief — no drafts
Implement → verify (`npm run build`, `npm test`) → **non-draft** PR → squash-merge to
`main` once green → confirm the Vercel deploy is live → *then* give the overview. Fix red
CI / conflicts and proceed; only hold if it's genuinely risky/ambiguous or Nate said wait.
Changes spanning both repos ship together.
