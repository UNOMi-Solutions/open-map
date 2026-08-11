# Code review — `EJ-POSTMERGE`

**Date:** 2026-08-11
**Scope:** `origin/main...EJ-POSTMERGE` — 44 commits, 105 files
**Result:** 15 findings, all fixed in this branch.

> **Note on this document.** This is a summary. Reproduction details for the
> authentication findings are deliberately omitted from the public repository and were
> circulated privately to the team instead. If you need them, ask Henry.

**Verification**
- `npx vite build` — passes
- `npm run check` (`tsc`) — all errors introduced by this branch cleared
- `node --check` on every modified backend file — passes

---

## Authentication (`backend/auth.js`, `backend/models/User.js`)

Three related problems in the account-recovery flow, all now fixed:

1. **Missing input validation on the token parameter.** `POST /api/v1/auth/reset` and
   `GET /api/v1/auth/verify` passed the caller-supplied token into a Mongoose query without
   checking that it was present and well-formed. Because Mongoose omits `undefined` values
   from query filters, an absent token did not fail closed. Both handlers now reject
   non-string or empty tokens with a `400` before any database access, and `/reset`
   additionally requires a non-empty password.

2. **Used tokens were blanked, not unset.** The reset handler cleared the consumed token by
   assigning `''`, which remained a matchable value. It now unsets the field.

3. **Reset links never expired.** `sendPasswordResetEmail` states the link expires in 15
   minutes, but no expiry was stored or enforced. Added `passwordResetExpires: Date` to the
   `User` schema; `/reset_request` sets it to 15 minutes out and `/reset` filters on it.

**Deployment note — please read.** These endpoints are unauthenticated (the auth router is
mounted without the `x-api-key` middleware), so the fix matters in production, not just in
review. Trimming this document is not itself a mitigation: the fix commit is public and the
problem is inferable from the diff. **The mitigation is deploying promptly.**

**Migration note.** The expiry check fails closed. Anyone who requested a password reset
before this deploys has a token but no `passwordResetExpires`, so their outstanding link
stops working and they must request a new one. This is intended.

---

## Backend

| File | Problem | Fix |
| --- | --- | --- |
| `routes/politics.js:237` | `GOVERNOR_FALLBACK_BY_STATE` was referenced but never defined — ported from `frontend/scripts/fetch-governors.mjs` without the constant. Any state lacking a parseable governor YAML threw a `ReferenceError`, and the `catch` turned the whole `/governors` response into a 500. West Virginia triggers this today. | Copied the constant in, with a comment noting it is kept in sync with the frontend script. |
| `routes/census.js:97` | `fetchAllStatesSequentially` called `fetchFbiUrl`, which does not exist here — copy-pasted from `crime.js`, where the local helper is `fetchCensusUrl`. Latent, but the first census endpoint wired to it would throw. | Renamed to `fetchCensusUrl`. |
| `index.js:121` | `signUserToken` throws when `JWT_SECRET` is unset, surfacing as an opaque `500` on every login. `.env.example` also labelled the variable "Optional", which is no longer true. | Added a startup check that logs loudly at boot; corrected `.env.example` to mark it required. |
| `routes/crime.js:295` | Debug `console.log(arrestsJSON)` after `res.json(...)` dumped the full 50-state FBI payload to stdout on every `/arrestsByState` request. | Removed. |

---

## Frontend — blocking loading overlay

`LoadingBar` renders `fixed inset-0 bg-black/70` with no close affordance, so any code path
that raises it without lowering it locks the entire app until a page reload. Five such paths
existed:

| File | Problem |
| --- | --- |
| `HouseMarkers.tsx:176` | `setLoading(false)` only in `.then`, behind a `!cancelled` guard; the `.catch` never cleared it. |
| `LeafletMap.tsx:805` (health choropleth) | Cleared only on success; the `!res.ok` early return and the `catch` both left it up. A 404 on `/data/health/<id>.json` bricked the UI. |
| `LeafletMap.tsx:840` (SPLC layer) | Same structure as above. |
| `SenatorMarkers.tsx:154` | Had a `.finally`, but written `if (!cancelled) setLoading(false)` — unmounting mid-fetch skipped the reset. |
| `GhgEmissionsMarkers.tsx:86` | Same guarded-`finally` bug, and it fired on every state re-click, not just unmount. |

**Fix:** every one of these now clears the overlay in an *unconditional* `finally`. The
`cancelled` guard is deliberately omitted here — the overlay is app-wide state, so it must
clear even when the component's own result is discarded.

---

## Frontend — other

| File | Problem | Fix |
| --- | --- | --- |
| `NewsLetterPopup.tsx:9` | Signup had regressed to `console.log('Newsletter email submitted:', email)`. The working implementation — real `POST`, loading/success/error states, `NewsletterPopupProps`, `type="button"` — was overwritten by commit `8dd8d21` ("port front-end map features from openmap"). The endpoint is live: `frontend/server/routes/newsletter.js`, mounted at `frontend/server/routes.ts:20`, backed by Mailchimp. | Restored from `006b25e`; the diff against it contained nothing but the regression. |
| `GhgEmissionsMarkers.tsx:62` | `if (setLoading == null) return;` — loading-state plumbing gated the *data fetch*, so a render without the optional prop silently showed no facilities and no error. | Made `setLoading` required; removed the early return. |
| `LeafletMap.tsx:387` | `setLoading` was optional on `LeafletMap` but children called it unconditionally. Any second mount without the prop would throw `setLoading is not a function` and unmount the map. | Made the prop required (`MainPage.tsx:655` is the only call site and already passes it). |
| `MainPage.tsx:597` | `` bg-[${showLanding ? "#ffffff" : "#0c1022"}] `` — Tailwind scans source *text*, so neither class was ever generated and the hamburger bars were invisible on the landing page. | Replaced with a `barClass` const holding two complete literal class strings. Verified against built CSS: `bg-\[\#ffffff\]` is now emitted, where before it was absent. |
| `SenatorMarkers.tsx:148` | `setSiteData(data.senators)` had lost its `?? []` fallback; a response missing the key would make `siteData.map` throw during render. | Restored `data.senators ?? []`. |
| 5 components | Untyped destructured props violated `"strict": true`, so the bare-`tsc` `check` script failed. `vite build` does not typecheck, so this shipped with the gate red. | Added explicit props types to `HouseMarkers`, `SenatorMarkers`, `OilSpillMarkers`, `LoadingBar`, `NewsLetterPopup`. |

---

## Known-remaining: `npm run check` is still red

Every remaining `tsc` error is **pre-existing on `main`** — none of these files appear in
`git diff origin/main...EJ-POSTMERGE`, so they were left alone rather than widening this
branch's diff:

| File | Errors |
| --- | --- |
| `client/src/pages/sections/ContactUsform.tsx` | 5, incl. missing `@types/react-google-recaptcha` |
| `client/src/pages/sections/UserAccount.tsx` | 4 implicit-any props |
| `client/src/pages/sections/PrivacySection.tsx` | 2 implicit-any props |
| `client/src/pages/sections/TermsofUse.tsx` | 2 implicit-any props |
| `server/vite.ts` | 1 — `allowedHosts: boolean` not assignable to `ServerOptions` |

All are the same small shape as the props typing above and would take minutes to clear.

---

## Recommended follow-ups

1. **Deploy the auth fix promptly** — see the deployment note above.
2. **Rotate outstanding password-reset tokens** and check logs for `POST /api/v1/auth/reset`
   requests missing a token parameter.
3. **Add regression tests** for `/auth/reset` and `/auth/verify` with missing and empty
   tokens. This class of bug is easy to reintroduce.
4. **Wire `npm run check` into CI.** `vite build` does not typecheck, so type regressions
   currently ship silently.
5. **Consider a lint rule** against template interpolation inside `className`, to catch the
   Tailwind problem above.
