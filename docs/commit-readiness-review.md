# Commit and merge readiness review

Reviewed on November 9, 2026. Branch: `add-home-invasion-datapoints` at
`c277c33ae5744b012aed22f5b3e092cfacbaffe2`, including its uncommitted implementation
files. Main was fetched and reviewed at
`f53f50863770e9ff1a8142f7e9bf46741b568cd8`.

## Assessment

The reviewed implementation passes its backend regressions, map library tests,
and production build after the fixes below. It is suitable for a scoped feature
commit, but the branch is **not ready for an unattended merge to main**. There
are three merge conflicts, existing project type errors, and existing dependency
security advisories. A passing build is not evidence that these remaining issues
are resolved or that every existing feature has been exercised.

No commits, merges, pushes, deployments, credential changes, dependency upgrades,
or database changes were made to the user's branch during this review.

## Fixes made in this review

- Superfund, energy, sewage, and fracking/industrial markers now allow map clicks
  through while placing pins. Marker instances are recreated when interaction
  mode changes because Leaflet's `interactive` option is set at construction.
  Marker keyboard interaction and open detail popups also respect pin mode.
- Coincident Superfund sites and energy plants stay grouped at detailed zoom.
  Their popups provide a selector so every record remains accessible, rather
  than stacking markers with only the top record selectable.
- Energy and Superfund popup padding accounts for the sidebar.
- FracFocus numeric strings containing commas retain valid water-volume and
  depth formatting instead of displaying `NaN`.
- The TRI text adapter rejects missing required CSV columns, matching the
  streaming adapter. Incomplete source schemas cannot masquerade as zero releases.
- FBI residential counts reject null, blank, boolean, array, negative, and
  fractional values. A true reported zero remains valid. Missing data cannot
  silently turn into zero through JavaScript number coercion.
- Regression assertions cover these parsing and coincident-coordinate cases.

## Guidelines and integration boundaries checked

The repository README is the available repository guidance; no applicable
`AGENTS.md` was found. The additions use the existing category routers and
API-key middleware. They preserve existing route names, response contracts,
port selection, startup behavior, and credentials. No dependency manifests or
lockfiles were changed by this implementation/review.

The source adapters keep keys on the backend, use fixed upstream hosts, validate
identifiers and selections, bound pagination/concurrency, and cache successful
snapshots. Error responses do not expose upstream credentials. React renders
source names/details as text; marker HTML contains fixed colors and numerical
counts. A targeted scan found no new embedded secrets; the credential-shaped
value in `.env.example` is an existing placeholder. Actual `.env` files are not
part of the proposed changes. This is a focused review, not a comprehensive
security audit.

The requested representations remain intact: automatic nationwide fracking and
industrial marker inventories, shared count-based grouping and styling, and
county shading for drinking water matching the overdose layer. Missing or
suppressed observations remain distinct from reported zero. Source links,
coverage limitations, reporting periods, reset handling, and saved-profile
options are retained. No state selector or state-dependent loading was added.

## Verification

| Check | Feature branch | Resolved integration copy |
| --- | --- | --- |
| Backend tests (`npm test`) | 37 passed | 37 passed |
| Map library tests | 11 passed | 11 passed |
| Production build (`npm run build`) | Passed | Passed |
| Full TypeScript check (`npm run check`) | 14 existing errors | Same 14 existing errors |
| Whitespace check (`git diff --check`) | Passed | Original merge conflicts require resolution |

The integration copy used main's exact frontend lockfile with a clean
`npm ci --ignore-scripts`, including main's new clustering dependency. It is
separate from the user's checkout, and contains both developers' additions.

Browser interaction checks used synthetic fixtures in that temporary copy:
pin clicks passed through energy, Superfund, sewage, and fracking markers;
coincident energy and Superfund records could both be selected; no browser
console errors were recorded. These fixture checks exercise actual components,
but are not a fresh nationwide upstream-data or production deployment test.
Industrial markers share the fracking component. Previous nationwide live-data
checks are documented separately in the individual layer documentation.

## Main integration still required

Main is 37 commits ahead of the common ancestor; this branch has two unique
commits before the uncommitted work. A merge rehearsal found conflicts in:

1. `backend/routes/environment.js`: preserve both sets of imports and route
   registrations, including main's disaster/noise endpoints. Retain one final
   default export after all routes.
2. `frontend/client/src/components/ui/LeafletMap.tsx`: preserve this branch's
   home-invasion/environment/overdose imports and main's ALPR import, alongside
   both sets of map layers and props.
3. `frontend/client/src/pages/sections/NavigationMenuSection.tsx`: preserve both
   sets of Environment options and main's Transportation section. Main replaced
   the Environment renderer with `renderLayerList`; attach the energy technology
   checkboxes to that renderer. A textual conflict resolution alone otherwise
   silently loses those filters.

These conflicts were resolved and tested only in the temporary integration copy.
Reference copies of the three resolved files are at
`/tmp/openmap-resolved-integration/`; they correspond only to the exact revisions
above. Do not replace whole files on a newer main without reviewing newer work.
The working branch has not been synchronized with main.

## Existing blockers outside the feature change

The full TypeScript check reports errors in `ContactUsform.tsx`,
`PrivacySection.tsx`, `TermsofUse.tsx`, `UserAccount.tsx`, and legacy
`server/vite.ts`. Those files are unchanged between this branch and the reviewed
main. Errors include missing reCAPTCHA declarations, untyped props/callbacks,
and the Vite `allowedHosts` type. The build currently does not enforce this check.

`npm audit --omit=dev` reported:

| Package tree | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend | 1 | 16 | 3 | 0 | 20 |
| Frontend | 2 | 18 | 5 | 2 | 27 |

These advisories belong to the existing dependency trees; this work changes
neither manifest nor lockfile. Critical reports include `proxy-addr` and frontend
`jspdf`. Some suggested remediations require major upgrades; `xlsx` has no
npm-provided fix. Counts include transitive dependencies and legacy server
packages, so they do not imply every advisory is exploitable in the deployed
browser. They do prevent a blanket security sign-off. Remediate with a separate
dependency review and regression checks; do not apply forced major upgrades as
part of a routine feature commit.

## Commit scope

Include the implementation source files, `backend/data/fracking-states.json`,
backend/frontend regression tests, layer documentation, and `.env.example`
documentation. The new files are currently untracked and must be included with
their imports when committing; committing tracked modifications alone will break
the build. Exclude the unrelated `output/campus/` Word document and image, local
environment files, dependencies, build output, and temporary review fixtures.

Before merging: resolve against current main, retain both implementations and
energy filters, rerun these checks in the actual integrated branch, and address
the existing type/security findings or explicitly track their disposition.
External API availability and untested production flows remain practical limits;
this review cannot guarantee zero future regressions.
