# Core Daily Loop UI Simplification — Design

Date: 2026-08-29
Branch: `feature/ui-core-loop-redesign` (off `origin/main`)

## Context

The current web app (17 nav items / ~22 routes) has accumulated clutter and
fragmented flows in the four screens people touch every day: Dashboard,
Access Requests, Projects, and Worker/Personnel management. A reference demo
(`gatepassUI.zip`, not part of this repo) demonstrates a much simpler journey
for the same underlying domain — role-scoped navigation, single-sheet-per-task
flows, plain-language statuses — and is used here as a UX/journey reference,
**not** a visual/layout reference. This app keeps its existing stack (Next.js,
Tailwind, shadcn/ui) and existing API layer; only flows, IA within the four
in-scope areas, and copy change.

## Goals

- Cut the number of screens/dialogs required to complete each core task.
- Resolve the conceptual overlap between Access Requests and Projects so
  users can tell, at a glance, which mechanism they're looking at.
- Consolidate worker onboarding + compliance + card status into one place.
- Cut Dashboard down to a small, fixed, role-scoped set of glanceable panels.
- Make on-page titles match their sidebar nav labels, in the four areas touched.

## Non-goals

- Redesigning the other 13 nav items (surveillance, geofencing, smart-access,
  permits, decision-rules, compliance-setup, certificates taxonomy,
  companies, reports, alerts, muster, inspections, sites). Untouched.
- Visual reskinning to resemble the reference demo's Apple-style CSS.
- Fixing behavioral defects unrelated to the redesign target shape (see
  "Deferred — separate follow-ups" below). Structural consolidation that
  necessarily touches the same files is fine; behavior changes to those bugs
  are not part of this build.
- Removing the direct/ad-hoc Access Request creation path. Verified against
  live production data (Nama Water tenant: 6 access requests, only 1
  project/work-pass) that this path is actively relied on — removing it is a
  live-access-breaking risk this project will not take.

## Reference journey principles adopted

1. Role-scoped nav visibility (already partly present; extend the same
   discipline to the four redesigned screens' internal tabs/sections).
2. One entity, one place — a worker's identity, documents, certs, and card
   status all live in a single view, not scattered across dialogs.
3. Plain-language status labels everywhere ("To approve" not "Pending",
   "Returned" not "Rejected").
4. One decision surface — approve/deny lives in exactly one place per item,
   not two competing dialogs.
5. Minimal-fields-first creation — capture the least needed to create a
   draft, add complexity (crew, documents) afterward inside the created
   entity, rather than a single giant upfront wizard.
6. Helpful empty states, not blank tables.

## Scope

In scope: `src/app/(app)/dashboard`, `src/app/(app)/access-requests`,
`src/app/(app)/projects` (+ `[id]`), `src/app/(app)/users` (+ `[id]`),
`src/app/(app)/profile` (shares the worker view), plus the components each
of these pages owns.

Out of scope: every other route, the sidebar's group structure, the backend
API contracts (no breaking changes — this is a frontend-only reshaping of how
existing endpoints are called and displayed).

---

## Phase 1 — Worker onboarding & compliance

**Problem:** identity (`new-user-form.tsx`), documents (`worker-documents.tsx`),
and card issuance (`worker-cards.tsx`) are three separate dialogs reached via
inconsistent paths (`users-table.tsx` row actions vs. `/profile`). The
`/users/[id]` detail page currently only renders the edit-profile form — it
ignores documents/certs/card entirely.

**Target:** `/users/[id]` becomes the single worker view: identity (editable),
job role (drives required docs), a documents checklist (status pill +
upload per required doc, matching current `worker-documents.tsx` behavior),
certificates (with expiry), and card/badge status with a single issue/reissue
action. The exact same component renders at `/profile` for self-service,
replacing the current divergent profile implementation, so there is one
implementation instead of two.

**Preserved as-is:** current `canManage` / upload-permission gating logic,
including the existing behavior where a Worker viewing their own profile
cannot upload their own documents. This is a known gap (see Deferred below)
but changing who can act on which document is a permissions decision, not a
layout decision, and is out of scope here.

**Changed, lower-risk:**
- Bulk/CSV registration (`bulk-registration.tsx`) moves from a co-equal
  option to a secondary "Import" action, off the main single-worker path.
- Card issuance stops being a fully separate dialog flow; it becomes a
  section within the worker view. The **digital** badge/QR auto-generates
  once a worker is compliant and has approved access (no manual click) —
  this mirrors what `/profile`'s badge/QR + `ScanService.ResolveStatusByTokenAsync`
  already support. Physical card printing (if hardware-backed for a given
  site) stays a single explicit action, since it has real-world logistics
  a UI can't automate away.
- `new-user-form.tsx` trimmed to fields the backend actually requires
  (verify each field against `CreateUserRequestDto` before cutting).

**Components touched:** `src/app/(app)/users/[id]/page.tsx`,
`src/app/(app)/profile/page.tsx`, `src/components/workers/worker-documents.tsx`,
`src/components/workers/worker-cards.tsx`, `src/components/users/new-user-form.tsx`,
`src/components/users/users-table.tsx`, `src/components/users/bulk-registration.tsx`.

---

## Phase 2 — Access Requests + Projects

**Problem:** `Project → WorkPass` approval auto-generates one AccessRequest
per contractor group on approval, but Access Requests also has its own
direct-creation form, and a third tab in the Access Requests page approves
WorkPass items — a Projects-lifecycle action living on the wrong page. Two
separate dialogs can also both open the same approve/deny decision
(row-button vs. open-sheet-then-button).

**Target:**
1. Move WorkPass approval out of the Access Requests page's "work-passes"
   tab and into the Project detail view (`projects/[id]`) — approving a crew
   becomes a project action, inline with the existing Draft → Submitted →
   [PendingSecondApproval] → Approved steps already rendered there.
2. Access Requests page becomes a 2-tab structure max: **To review**
   (everything pending a decision by the current user, merged regardless of
   source) and **All** (full ledger, filtered by status chips: To approve /
   Approved / Denied / Expired / All — matching the reference's chip
   pattern). "My requests" becomes a filter within **All**, not its own tab.
   Each row is tagged by origin ("Direct request" vs. "via Project: <name>").
3. Collapse `request-details-dialog.tsx` (Sheet) and `approval-dialog.tsx`
   (Dialog) into one: clicking a row opens one sheet with the decision
   controls in its footer. No dialog-opened-from-a-dialog stacking.
4. Project creation (`project-wizard-dialog.tsx`, currently 617 lines)
   trimmed to: name, client, site(s), dates. Reviewing consultant assignment
   and contract reference move to the created project's detail view, set
   before submitting for review — not required upfront.
5. `new-request-form.tsx` (unused duplicate, not imported anywhere) is
   deleted as part of consolidating request-creation onto one component —
   this is dead-code removal intrinsic to the consolidation, not a separate
   defect fix.
6. Direct/ad-hoc request creation stays functionally available (see
   Non-goals) but is visually secondary to "Start a Project" so the two
   paths read as deliberate, not redundant.

**Components touched:** `src/app/(app)/access-requests/page.tsx`,
`src/components/access-requests/requests-table.tsx`,
`src/components/access-requests/request-details-dialog.tsx`,
`src/components/access-requests/approval-dialog.tsx`,
`src/components/access-requests/project-work-pass-queue.tsx`,
`src/components/access-requests/supervisor-request-form.tsx`,
`src/components/access-requests/new-request-form.tsx` (deleted),
`src/app/(app)/projects/page.tsx`, `src/app/(app)/projects/[id]/page.tsx`,
`src/components/projects/project-wizard-dialog.tsx`.

---

## Phase 3 — Dashboard

**Problem:** 717-line page rendering up to 14 backend-driven `panelKeys`,
plus ~1,070 lines of fully-built but never-imported widget components
(`management-scorecards.tsx`, `registration-funnel-panel.tsx`,
`shift-rosters-panel.tsx`, `report-schedules-panel.tsx`,
`trends-capacity-panel.tsx`, `data-quality-panel.tsx`,
`inclusive-adoption-panel.tsx`, `on-site-by-company-chart.tsx`,
`on-site-by-nationality-chart.tsx`, `site-occupancy-list.tsx`) sitting dead
in the folder.

**Target:**
- Delete the ten orphaned widget files outright — zero behavior change,
  confirmed unreferenced anywhere in the app.
- Replace the `panelKeys`-driven matrix with one fixed, curated set of
  tiles/panels per broad role group (Approver/Manager, Contractor/Supervisor,
  Security/Gate), sized like the reference's 4-tile + 2-panel shape rather
  than a configurable console. The frontend simply renders fewer of the
  fields the backend dashboard-summary endpoint already returns — no
  backend contract change required.
- Replace the custom date-range panel with simple presets (Today / This
  week / This month).
- Page heading changed to exactly "Dashboard" (already matches nav label;
  verify after panel trimming doesn't reintroduce a mismatch).

**Components touched:** `src/app/(app)/dashboard/page.tsx`,
`src/components/dashboard/dashboard-visuals.tsx`,
`src/components/dashboard/dashboard-layout.ts`,
`src/components/dashboard/dashboard-tools.tsx`, plus deletion of the ten
orphaned files listed above.

---

## Cross-cutting: nav label / page title consistency

Sidebar labels (`sidebar-navigation.ts`) are already consistent; the
mismatch is between sidebar label and each page's own on-page `<h1>`/heading,
written independently. Within the four in-scope pages only:

- `/users` heading → "Personnel" (was "Personnel Management")
- `/access-requests` heading → "Access Requests" (verify current text)
- `/projects` heading → "Projects" (verify current text)
- `/dashboard` heading → "Dashboard" (verify after panel trim)

Not applied elsewhere (Companies, Geofencing, etc. — out of scope).

## Testing strategy

This repo has no unit-test runner (`package.json` has `lint`/`typecheck`/
`build` only) and a separate Playwright e2e suite (`e2e/`, `playwright.config.ts`).

**Branch correction note:** this plan's isolated branch was initially built off
`origin/main` by mistake. `main` is a stale, abandoned snapshot from
2025-12-29 that predates the Firebase→REST migration entirely — it has none
of Projects/WorkPass, worker-documents, `/users/[id]`, or the dashboard panel
system this spec describes, and showed 72 typecheck errors that were an
artifact of that stale branch, not real. The branch was rebuilt on
`feature/decision-rule-engine` (tip as of 2026-08-28, the actual current
development lineage, containing `rest-migration` as an ancestor with zero
divergence) — **the correct baseline on that branch is 0 typecheck errors.**
`npm run lint` is not usable as a baseline check on this repo in its current
state: `next lint` runs with an implicit `NODE_ENV=production`, which trips
`next.config.ts`'s own guard rejecting the dev-tunnel `NEXT_PUBLIC_BACKEND_URL`
in `.env.local` — a pre-existing tooling gap, not something introduced by
this work. Lint is dropped from verification; typecheck + build + manual/e2e
verification carry that weight instead.

Verification per phase:
1. `npm run typecheck` must stay at 0 errors throughout — any new error is a
   regression to fix before moving to the next task.
2. `npm run build` succeeds.
3. Manual browser verification of each redesigned flow (dev server), using
   the Browser preview tool: worker onboarding end-to-end, access-request
   create + approve + deny, project create + submit + approve, dashboard
   render per role.
4. Existing Playwright specs under `e2e/` that touch these four areas run
   and stay green; specs made obsolete by structural changes (e.g. asserting
   on the old 3-tab Access Requests page) get updated, not deleted silently.

## Deferred — separate follow-up tasks (not part of this build)

- Worker self-service document upload is gated off for the Worker role
  (`canManage={user.role !== 'Worker'}` on `/profile`), meaning workers have
  no path to upload their own documents today. Product/security decision
  needed on whether to allow it, not a layout fix.
- Two now-structurally-adjacent-but-still-separate approval code paths
  existed before this project; verify none remain post-Phase-2 and file
  anything that does.
- Dead stub routes with zero files: `card-verification/`, `consultant/`,
  `scan/`, `card-production/`. Harmless (unreachable) but worth deleting the
  empty directories and any dangling nav/test references to them.

## Risks & rollback

All work happens on `feature/ui-core-loop-redesign`, isolated from `main` and
from the unrelated in-flight `feature/decision-rule-engine` branch. Each
phase lands as its own set of commits so a problem in Phase 3 doesn't require
unwinding Phase 1/2. No backend/API contract changes, so rollback is a pure
frontend revert with no data-migration concerns.
