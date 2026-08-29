# Core Daily Loop UI Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the four screens people touch every day (Worker onboarding/compliance, Access Requests, Projects, Dashboard) by consolidating fragmented dialogs into single views, removing a duplicated approval decision surface, fixing a real copy bug the duplication caused, deleting confirmed-dead code, and capping dashboard density — without changing any backend/API contract and without removing the direct/ad-hoc Access Request creation path (verified still relied on by the live Nama Water tenant).

**Architecture:** Pure frontend restructuring on the existing Next.js/Tailwind/shadcn stack. No new libraries, no new routes, no backend changes. Each phase is independently committable and shippable; phases run back-to-back in one continuous build per explicit instruction (all deferred defects are flagged as separate follow-ups, not fixed here).

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui, react-hook-form + zod, `apiRequest` REST client in `src/lib/api.ts`.

## Global Constraints

- Branch: `feature/ui-core-loop-redesign`, based on `feature/decision-rule-engine` (NOT `main` — `main` is a stale pre-REST-migration snapshot; do not rebase onto it).
- Baseline: `npm run typecheck` must return **0 errors** at the start and end of every task. Any new error is a regression to fix before moving on.
- `npm run lint` is not usable as a baseline check on this repo (pre-existing `NODE_ENV=production` / dev-tunnel guard conflict in `next.config.ts`, unrelated to this work) — do not gate on it.
- No unit-test runner exists in this repo. Verification per task = typecheck + `npm run build` (for tasks large enough to warrant it) + manual browser verification of the specific flow touched, using the dev server.
- Preserve all current permission/gating behavior exactly, except where a task explicitly documents a copy-only fix (see Task 2.1) or a structural relocation that keeps the identical gate expression (see Task 1.4/2.2).
- Do not fix, in this plan: the Worker self-service document-upload gap (`canManage={user.role !== 'Worker'}` on `/profile`), or delete the four empty dead-stub route directories (`card-verification/`, `consultant/`, `scan/`, `card-production/`). These are flagged as separate follow-up tasks at the end of this plan.
- Do not remove the direct/ad-hoc Access Request creation path (`SupervisorRequestForm`). Verified against live production data that most of the one live tenant's access requests were created this way, not via Projects/WorkPass.
- Commit after each task with a descriptive message. Do not amend previous commits.
- Never `git add -A` or `git add .` — always stage the exact files a step names. The working tree carries untracked build/tool caches (`.gitignore` was patched in Task 1 to cover the ones found so far, but don't assume that list is exhaustive); run `git status --short` before committing and confirm nothing unexpected is staged.

---

# Phase 1 — Worker onboarding & compliance

Context already verified on this branch:
- Worker **creation** is already simple (`InlineUserRow`, an inline table row on `/users` — not a dialog) and bulk CSV import is already a secondary "Import roster" button, separate from the primary create path. Neither needs to change.
- The actual fragmentation is on the **view/manage** side: a worker's documents, job-position compliance, and physical card status are split across two separate dialogs opened from row actions in `users-table.tsx`, while `/users/[id]` (the one page that should own this) currently shows only the identity edit form.
- `new-user-form.tsx` (`NewUserForm`) is confirmed dead code — zero references anywhere outside its own declaration (superseded by `InlineUserRow`).
- There is no "auto-generate digital badge" work to do: `/profile` already auto-generates a live, auto-refreshing QR credential via `fetchQrCredential`, entirely independent of the physical `WorkerCard` mechanism. Only the physical CR80 card stays a manual action (real hardware/photo-cropping decisions), which is correct as-is.

## Task 1: Delete dead code — `new-user-form.tsx`

**Files:**
- Delete: `src/components/users/new-user-form.tsx`

- [ ] **Step 1: Confirm zero external references**

```bash
grep -rn "NewUserForm\b" src/ --include='*.tsx' --include='*.ts'
```
Expected: only `src/components/users/new-user-form.tsx:49:export function NewUserForm({` — no other file.

- [ ] **Step 2: Delete the file**

```bash
rm src/components/users/new-user-form.tsx
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors (deleting a file with no importers cannot introduce a type error).

- [ ] **Step 4: Commit**

```bash
git add src/components/users/new-user-form.tsx
git commit -m "Remove dead NewUserForm component

Superseded by InlineUserRow; zero references outside its own file."
```
(Note: actual execution found untracked build-tool caches — `.next-build-test/`, `.next-release-check/`, `.playwright-cli/`, `graphify-out/` — sitting in the working tree with no `.gitignore` coverage. A literal `git add -A` here swept ~150MB of them into the commit; caught and fixed by resetting, adding `.gitignore` entries for those four directories, and recommitting with only the intended file. Every remaining commit step in this plan stages explicit paths, never `-A`, to prevent a repeat.)

---

## Task 2: Add shared permission helpers to `user-actions.ts`

These port the two closures currently defined locally inside `users-table.tsx` (`canReviewCompliance`, `canManageWorkerCard`) into the shared module, so both `/users/[id]/page.tsx` and `users-table.tsx` can use the identical logic without duplicating it.

**Files:**
- Modify: `src/components/users/user-actions.ts`

**Interfaces:**
- Produces: `canReviewWorkerCompliance(viewerRole: UserRole, subjectRole: UserRole): boolean`, `canManageWorkerCard(viewerRole: UserRole, subjectStatus?: UserStatus): boolean`

- [ ] **Step 1: Add the two functions**

Current full file:
```ts
import type { UserRole } from '@/lib/types';

export const PERSONNEL_PAGE_ROLES: UserRole[] = [
  'Admin',
  'Operator Admin',
  'Contractor Admin',
  'Manager',
  'Supervisor',
];

export function canEditUserRecord(canMutateUsers: boolean, _role: UserRole) {
  return canMutateUsers;
}

export function canLoadPersonnelData(role: UserRole) {
  return PERSONNEL_PAGE_ROLES.includes(role);
}

export function shouldLoadPersonnelSites(role: UserRole) {
  return role !== 'Contractor Admin';
}

export function canIssuePersonnelCard(role: UserRole) {
  return ['Admin', 'Operator Admin', 'Contractor Admin'].includes(role);
}

export function canImpersonateUser(
  currentUserRole: UserRole,
  currentUserId: string,
  targetUserId: string,
) {
  return ['Admin', 'Operator Admin', 'Contractor Admin'].includes(currentUserRole)
    && currentUserId !== targetUserId;
}

export function shouldShowWorkerDocuments(role: UserRole) {
  return role === 'Worker';
}
```

Change the import line and append two functions at the end:
```ts
import type { UserRole, UserStatus } from '@/lib/types';
```
Append:
```ts

export function canReviewWorkerCompliance(viewerRole: UserRole, subjectRole: UserRole) {
  return subjectRole === 'Worker' && ['Admin', 'Operator Admin', 'Manager'].includes(viewerRole);
}

export function canManageWorkerCard(viewerRole: UserRole, subjectStatus?: UserStatus) {
  return subjectStatus === 'Active' && canIssuePersonnelCard(viewerRole);
}
```
Note `canManageWorkerCard` reuses `canIssuePersonnelCard` for the role check (same role list `['Admin', 'Operator Admin', 'Contractor Admin']`) instead of repeating the array literal — this is a real simplification `users-table.tsx`'s original local closure didn't have (it inlined the same three-role check separately from `canIssuePersonnelCard`, which already existed in this same file).

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/users/user-actions.ts
git commit -m "Add shared canReviewWorkerCompliance/canManageWorkerCard helpers

Ports the two permission checks currently duplicated as local closures
inside users-table.tsx, so /users/[id] can use identical logic."
```

---

## Task 3: Stop `EditUserForm` from rendering worker documents internally

The page (`/users/[id]/page.tsx`) will own this section going forward (Task 4), so it must not also be nested inside the identity-edit form — `EditUserForm` only renders for `canEdit` viewers today, which is narrower than who should see the compliance section (see Task 4).

**Files:**
- Modify: `src/components/users/edit-user-form.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `EditUserForm` no longer renders `WorkerDocuments`/`WorkerTimeline`; its public props are unchanged.

- [ ] **Step 1: Remove the internal document-rendering block**

Find and remove this exact block (confirmed present via direct source inspection):
```tsx
{shouldShowWorkerDocuments(user.role) && (
  <>
    <WorkerDocuments workerId={user.id} certificateTypes={certificateTypes} canManage />
    <WorkerTimeline workerId={user.id} />
  </>
)}
```

- [ ] **Step 2: Remove now-unused imports**

Remove `WorkerDocuments`, `WorkerTimeline`, and `shouldShowWorkerDocuments` from the import lines:
```ts
import { WorkerDocuments } from "@/components/workers/worker-documents";
import { WorkerTimeline } from "@/components/workers/worker-timeline";
import { shouldShowWorkerDocuments } from "./user-actions";
```
Before removing, grep the rest of the file to confirm none of the three names are used anywhere else in `edit-user-form.tsx` (the file also has its own separate `certificateTypes` state and a *different* certificate field-array editor used by the form itself — that stays; only the `WorkerDocuments`/`WorkerTimeline` render and the `shouldShowWorkerDocuments` gate are removed):
```bash
grep -n "WorkerDocuments\|WorkerTimeline\|shouldShowWorkerDocuments" src/components/users/edit-user-form.tsx
```
Expected after the edit: no matches.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/users/edit-user-form.tsx
git commit -m "Stop EditUserForm from nesting worker documents/timeline

Ownership moves to /users/[id]/page.tsx (next commit), which needs to
show this section to more viewers than EditUserForm currently renders for."
```

---

## Task 4: Consolidate worker compliance/documents/card into `/users/[id]/page.tsx`

This is the core of Phase 1: one worker, one place. The page currently renders only a header card + `EditUserForm`. It gains a compliance section (position compliance panel, documents, timeline) visible to anyone who could previously see it via either the old "Review compliance" dialog (view-only) or via `EditUserForm`'s internal render (edit access), plus a card-status section for whoever could previously reach the "Issue QR card" dialog.

**Files:**
- Modify: `src/app/(app)/users/[id]/page.tsx`

**Interfaces:**
- Consumes: `canReviewWorkerCompliance`, `canManageWorkerCard` (Task 2), `shouldShowWorkerDocuments` (existing), `listCertificateTypesRequest` (existing, from `@/lib/api`), `WorkerPositionCompliancePanel`, `WorkerDocuments`, `WorkerTimeline`, `WorkerCards` (existing components, previously reachable only via dialogs)
- Produces: nothing new consumed elsewhere — this is a leaf page.

- [ ] **Step 1: Add imports**

Current imports:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Building2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { EditUserForm } from '@/components/users/edit-user-form';
import { canEditUserRecord, PERSONNEL_PAGE_ROLES, shouldLoadPersonnelSites } from '@/components/users/user-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useToast } from '@/hooks/use-toast';
import {
  listContractorsRequest,
  listJobPositionsRequest,
  listOperatorsRequest,
  listSitesRequest,
  listUsersRequest,
  updateUserRequest,
  type UpdateUserInput,
} from '@/lib/api';
import type { Contractor, JobPosition, Operator, Site, User } from '@/lib/types';
import { resolveUserCompanyName } from '@/components/users/user-company';
import { useSession } from '@/providers/session-provider';
```

Change to:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Building2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { EditUserForm } from '@/components/users/edit-user-form';
import {
  canEditUserRecord,
  canManageWorkerCard,
  canReviewWorkerCompliance,
  PERSONNEL_PAGE_ROLES,
  shouldLoadPersonnelSites,
  shouldShowWorkerDocuments,
} from '@/components/users/user-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useToast } from '@/hooks/use-toast';
import {
  listCertificateTypesRequest,
  listContractorsRequest,
  listJobPositionsRequest,
  listOperatorsRequest,
  listSitesRequest,
  listUsersRequest,
  updateUserRequest,
  type UpdateUserInput,
} from '@/lib/api';
import type { CertificateType, Contractor, JobPosition, Operator, Site, User } from '@/lib/types';
import { resolveUserCompanyName } from '@/components/users/user-company';
import { useSession } from '@/providers/session-provider';
import { WorkerCards } from '@/components/workers/worker-cards';
import { WorkerDocuments } from '@/components/workers/worker-documents';
import { WorkerPositionCompliancePanel } from '@/components/compliance/worker-position-compliance';
import { WorkerTimeline } from '@/components/workers/worker-timeline';
```

- [ ] **Step 2: Add `certificateTypes` state and fetch**

Add alongside the existing state declarations:
```tsx
const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
```

Add a new effect (mirrors the existing pattern in `/profile/page.tsx`), placed after the existing `loadProfile` effect:
```tsx
useEffect(() => {
  if (!token) return;
  void listCertificateTypesRequest(token)
    .then((types) => setCertificateTypes(types as CertificateType[]))
    .catch(() => setCertificateTypes([]));
}, [token]);
```

- [ ] **Step 3: Compute visibility flags**

After the existing line:
```tsx
const canEdit = canEditUserRecord(['Admin', 'Operator Admin', 'Contractor Admin'].includes(currentUser.role), user.role);
```
Add:
```tsx
const showCompliance = shouldShowWorkerDocuments(user.role)
  && (canEdit || canReviewWorkerCompliance(currentUser.role, user.role));
const showCard = canManageWorkerCard(currentUser.role, user.status);
```

- [ ] **Step 4: Render the new sections**

The current return statement ends with:
```tsx
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          {/* ...identity card, unchanged... */}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{canEdit ? 'Edit personnel data' : 'Personnel data'}</CardTitle>
            <CardDescription>{canEdit ? 'Changes are saved directly to this personnel profile.' : 'You have read-only access to this profile.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <EditUserForm
                user={user}
                currentUser={currentUser}
                onUpdateUser={handleUpdateUser}
                sites={sites}
                contractors={contractors}
                operators={operators}
                jobPositions={jobPositions}
                isLoading={loading}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Profile changes require personnel administration access.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

Change the closing to add the compliance and card sections after the grid, before the closing `</div>`:
```tsx
      </div>

      {showCompliance && (
        <div className="space-y-6">
          <WorkerPositionCompliancePanel workerId={user.id} />
          <WorkerDocuments workerId={user.id} certificateTypes={certificateTypes} canManage={canEdit} />
          <WorkerTimeline workerId={user.id} />
        </div>
      )}

      {showCard && <WorkerCards workerId={user.id} />}
    </div>
  );
}
```

Behavior parity check: this reproduces exactly what the two removed dialogs showed —
- The old "Review compliance" dialog (`canManage={false}`) is now the `!canEdit` branch of `showCompliance` (since `canManage={canEdit}` evaluates to `false` there too).
- The old edit-form-nested render (`canManage` always `true`) is now the `canEdit` branch (`canManage={canEdit}` evaluates to `true` there).
- The old "Issue QR card" dialog's gate (`canManageWorkerCard(currentUser.role) && user.status === 'Active'`) is now `showCard`.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 6: Manual browser verification**

Start the dev server and check, for a Worker-role personnel record:
1. As an Admin/Operator Admin/Manager viewing a Worker's `/users/[id]`: compliance panel, documents (with upload), and timeline appear; card section appears if the worker is Active.
2. As a Contractor Admin viewing their own Worker's profile: same, `canManage` should be `true` (editable).
3. As a role that can review but not edit (e.g. a Manager without edit rights per `canEditUserRecord`... note: currently `canEditUserRecord` only depends on `canMutateUsers`, computed by the parent `/users/page.tsx` as `['Admin','Operator Admin','Contractor Admin'].includes(role)` — a Manager is NOT in that list, so a Manager will hit the `!canEdit` branch): confirm the "Personnel data" card shows the read-only message, while the compliance/documents section below still appears in view-only mode (`canManage={false}`, no upload button, no delete button — matching the old dialog).
4. Confirm no regressions to the identity edit form itself.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/users/[id]/page.tsx"
git commit -m "Consolidate worker compliance, documents, and card status into one profile page

Replaces the two separate 'Review compliance' and 'Issue QR card' dialogs
that lived as row actions in users-table.tsx — everything about one worker
now lives in one place."
```

---

## Task 5: Remove the now-redundant dialogs from `users-table.tsx`, and fix the page-title mismatch on `/users`

**Files:**
- Modify: `src/components/users/users-table.tsx`
- Modify: `src/app/(app)/users/page.tsx` (one-line heading fix, bundled here rather than as its own task — trivial and touches the same Phase 1 area)

- [ ] **Step 1: Remove state**

Remove:
```tsx
const [complianceUser, setComplianceUser] = useState<User | null>(null);
const [cardUser, setCardUser] = useState<User | null>(null);
```

- [ ] **Step 2: Remove the two local permission closures**

Remove (now superseded by the shared helpers used on `/users/[id]`, no longer needed here since the row no longer opens dialogs gated by them):
```tsx
const canReviewCompliance = (user: User) => {
  return user.role === 'Worker'
    && ['Admin', 'Operator Admin', 'Manager'].includes(currentUser.role);
};

const canManageWorkerCard = (user: User) => {
  return user.status === 'Active' && canIssuePersonnelCard(currentUser.role);
};
```

- [ ] **Step 3: Remove the two DropdownMenuItems**

Remove:
```tsx
{canManageWorkerCard(user) && (
  <DropdownMenuItem onSelect={() => setCardUser(user)}>
    <CreditCard className="mr-2 h-4 w-4" /> Issue QR card
  </DropdownMenuItem>
)}
{!canEditUser(user) && canReviewCompliance(user) && (
  <DropdownMenuItem onSelect={() => setComplianceUser(user)}>
    <ShieldCheck className="mr-2 h-4 w-4" /> Review compliance
  </DropdownMenuItem>
)}
```

- [ ] **Step 4: Remove the two Dialog blocks**

Remove, at the end of the component:
```tsx
<Dialog open={complianceUser !== null} onOpenChange={(open) => !open && setComplianceUser(null)}>
  <DialogContent className="max-w-full sm:max-w-3xl w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Worker Compliance Review</DialogTitle>
      <DialogDescription>
        Review credentials and evidence for {complianceUser?.name} without editing their profile.
      </DialogDescription>
    </DialogHeader>
    {complianceUser && (
      <div className="space-y-4">
        <WorkerPositionCompliancePanel workerId={complianceUser.id} />
        <WorkerDocuments workerId={complianceUser.id} canManage={false} />
        <WorkerTimeline workerId={complianceUser.id} />
      </div>
    )}
  </DialogContent>
</Dialog>
<Dialog open={cardUser !== null} onOpenChange={(open) => !open && setCardUser(null)}>
  <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Issue QR card</DialogTitle>
      <DialogDescription>
        Select a verified photo and manage the card for {cardUser?.name}.
      </DialogDescription>
    </DialogHeader>
    {cardUser ? <WorkerCards workerId={cardUser.id} /> : null}
  </DialogContent>
</Dialog>
```
Leave the surrounding `<>...</>` fragment and the main `<Card>` table structure intact — only these two `<Dialog>` blocks are removed.

- [ ] **Step 5: Remove now-unused imports**

From the top of the file, remove `WorkerDocuments`, `WorkerTimeline`, `WorkerCards`, `WorkerPositionCompliancePanel` imports:
```tsx
import { WorkerDocuments } from "@/components/workers/worker-documents";
import { WorkerTimeline } from "@/components/workers/worker-timeline";
import { WorkerCards } from "@/components/workers/worker-cards";
import { WorkerPositionCompliancePanel } from '@/components/compliance/worker-position-compliance';
```
And remove `ShieldCheck` and `CreditCard` from the lucide-react icon import line (both become unused — `ShieldCheck` was only used by the removed "Review compliance" item, `CreditCard` only by "Issue QR card"; confirm via grep before removing each):
```bash
grep -n "ShieldCheck\|CreditCard" src/components/users/users-table.tsx
```
Expected after the edit: no matches for either.

Keep `canIssuePersonnelCard` imported only if still used elsewhere in the file — check:
```bash
grep -n "canIssuePersonnelCard" src/components/users/users-table.tsx
```
If the only remaining reference was inside the now-deleted local `canManageWorkerCard` closure, remove `canIssuePersonnelCard` from the import line too:
```tsx
import { canEditUserRecord, canImpersonateUser, canIssuePersonnelCard } from "./user-actions";
```
becomes:
```tsx
import { canEditUserRecord, canImpersonateUser } from "./user-actions";
```

- [ ] **Step 6: Fix the page-title mismatch on `/users`**

The sidebar nav label is "Personnel" (`src/components/layout/sidebar-navigation.ts`), but the page's own heading says "Personnel Management" — confirmed via direct read of `src/app/(app)/users/page.tsx`. Change:
```tsx
<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Personnel Management</h1>
<p className="text-sm text-muted-foreground sm:text-base">
  Manage personnel from operators, contractors, and visitors.
</p>
```
to:
```tsx
<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Personnel</h1>
<p className="text-sm text-muted-foreground sm:text-base">
  Manage personnel from operators, contractors, and visitors.
</p>
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 8: Manual browser verification**

On `/users`, confirm the row dropdown menu no longer shows "Review compliance" or "Issue QR card" — only Edit (where applicable), Impersonate (where applicable), Delete (where applicable). Confirm clicking a row (or "Edit") still navigates to `/users/[id]` and that the consolidated page (Task 4) shows everything the removed dialogs used to. Confirm the page heading now reads "Personnel", matching the sidebar.

- [ ] **Step 9: Commit**

```bash
git add src/components/users/users-table.tsx "src/app/(app)/users/page.tsx"
git commit -m "Remove Review-compliance/Issue-QR-card dialogs; fix Personnel page title

The two dialogs are now covered by the consolidated /users/[id] page
(previous commit). Also fixes the page heading ('Personnel Management')
to match the sidebar nav label ('Personnel')."
```

---

# Phase 2 — Access Requests + Projects

Context verified on this branch:
- **Two genuinely separate worker-access creation paths exist**, not just duplicate views: `SupervisorRequestForm` (direct, on Access Requests page, calls `createAccessRequest` immediately) and `WorkerAccessDialog` (inline in `projects/[id]/page.tsx`, creates a `WorkPass` which generates an `AccessRequest` later after approval). Both stay — the direct path is verified still relied on in production.
- **A real copy bug**: `project-work-pass-queue.tsx`'s `STATUS_PRESENTATION.PendingSecondApproval.label` says "Pending operator approval" and its button says "Operator approve", but `getWorkPassActions` proves the actual gate is `project.supervisorUserId === actor.id` — a **supervisor** decision. `projects/[id]/page.tsx`'s own `workPassLabel()` already has this correct ("Pending supervisor approval" / "Final approval"). This is fixed as part of relocating the queue (Task 6), since it's a one-line copy fix inside code already being moved, not a new investigation.
- The Access Requests page's "work-passes" tab duplicates presentation logic that already exists correctly on the Project detail page — the shared decision logic (`getWorkPassActions`/`getWorkPassQueueItems` in `project-command-center.ts`) is NOT duplicated, only the two renderers and their two independent copies of status labels/colors are.
- The Access Requests page has two routes to the same approve/deny decision: row-level quick icon buttons (bypass the detail sheet) and the detail sheet's own footer buttons (which today close the sheet and pop a *second*, separate `ApprovalDialog` modal). Both end up at the same underlying decision; this plan merges them into one.
- The project-creation wizard's "participants" step (consultant company + at least one reviewer + at least one contractor) is validated as **required** today (`validateProjectStep`) — deferring it to "after creation" is a bigger behavioral/validation change than warranted. The safe cut is removing the wizard's step-by-step *pagination*, not any required field.
- `new-request-form.tsx` (`NewRequestForm`) is confirmed dead code — zero references outside its own file, implements an entirely different, unwired data shape than the live `AccessRequest` model.

## Task 6: Fix the mislabeled work-pass status/action and relocate the queue from Access Requests to Projects

**Files:**
- Modify: `src/components/access-requests/project-work-pass-queue.tsx` (label fix; stays in this path since the component itself is reused, just called from a different page)
- Modify: `src/app/(app)/projects/page.tsx` (gains the queue)
- Modify: `src/app/(app)/access-requests/page.tsx` (loses the queue, tab, and related state/handlers)

**Interfaces:**
- Consumes: `ProjectWorkPassQueue`, `type ProjectWorkPassRecord` (from `@/components/access-requests/project-work-pass-queue`, unchanged export shape), `getWorkPassQueueItems`, `type WorkPassAction` (from `@/components/projects/project-command-center`, unchanged), `apiRequest` (existing)
- Produces: `projects/page.tsx` gains local state `projectWorkPasses: ProjectWorkPassRecord[]`, `busyWorkPassId: string | null`, `rejectWorkPass: ProjectWorkPassRecord | null`, `workPassRejectReason: string`, and handlers `handleWorkPassAction`, `handleConfirmWorkPassReject` — same signatures as they had in `access-requests/page.tsx`.

- [ ] **Step 1: Fix the mislabeled status and button in `project-work-pass-queue.tsx`**

Change:
```ts
PendingSecondApproval: { label: 'Pending operator approval', className: 'bg-violet-100 text-violet-800' },
```
to:
```ts
PendingSecondApproval: { label: 'Pending supervisor approval', className: 'bg-violet-100 text-violet-800' },
```

Change:
```tsx
{actions.includes('second-approve') ? <Button size="sm" disabled={isBusy} onClick={() => onAction(workPass, 'second-approve')}><ShieldCheck className="mr-1.5 h-4 w-4" /> Operator approve</Button> : null}
```
to:
```tsx
{actions.includes('second-approve') ? <Button size="sm" disabled={isBusy} onClick={() => onAction(workPass, 'second-approve')}><ShieldCheck className="mr-1.5 h-4 w-4" /> Final approval</Button> : null}
```
(matches `projects/[id]/page.tsx`'s existing, correct copy exactly.)

- [ ] **Step 2: Typecheck and commit the label fix separately**

```bash
npm run typecheck
git add src/components/access-requests/project-work-pass-queue.tsx
git commit -m "Fix mislabeled work-pass status: supervisor decision was shown as 'operator approval'

getWorkPassActions gates the second-approve action on
project.supervisorUserId === actor.id — a supervisor decision, matching
the already-correct copy in projects/[id]/page.tsx's workPassLabel()."
```

- [ ] **Step 3: Add work-pass state and gate to `projects/page.tsx`**

Current top of `ProjectsPage`:
```tsx
export default function ProjectsPage() {
  const { token, user } = useSession();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [operators, setOperators] = useState<NamedOption[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sites, setSites] = useState<Array<NamedOption & { operatorId?: string; location?: string }>>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [projectRoles, setProjectRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const canConfigureProjects = Boolean(user && (
    ['Admin', 'Operator Admin', 'Manager'].includes(user.role)
    || (user.role === 'Supervisor' && user.operatorId)
  ));
```

Add, after `canConfigureProjects`:
```tsx
  // Same gate access-requests/page.tsx used for canViewProjectWorkPasses — everyone
  // except Worker can have a pending decision (e.g. a Contractor Admin/Supervisor
  // acting as a project's consultant reviewer, who is NOT covered by canConfigureProjects).
  const canViewWorkPassQueue = Boolean(user && user.role !== 'Worker');
  const [projectWorkPasses, setProjectWorkPasses] = useState<ProjectWorkPassRecord[]>([]);
  const [busyWorkPassId, setBusyWorkPassId] = useState<string | null>(null);
  const [rejectWorkPass, setRejectWorkPass] = useState<ProjectWorkPassRecord | null>(null);
  const [workPassRejectReason, setWorkPassRejectReason] = useState('');
```

Add imports at the top:
```tsx
import {
  ProjectWorkPassQueue,
  type ProjectWorkPassRecord,
} from '@/components/access-requests/project-work-pass-queue';
import { getWorkPassQueueItems, type WorkPassAction } from '@/components/projects/project-command-center';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
```

- [ ] **Step 4: Fetch work passes in `loadWorkspace`**

Current:
```tsx
  const loadWorkspace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [projectData, operatorData, contractorData, userData, siteData, roleData] = await Promise.all([
        apiRequest<ProjectRecord[]>('/projects', { token }),
        canConfigureProjects ? listOperatorsRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listContractorsRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listUsersRequest(token, { pageSize: 250 }) : Promise.resolve([]),
        canConfigureProjects ? listSitesRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listProjectRolesRequest(token) : Promise.resolve([]),
      ]);
      setProjects(projectData);
      setOperators(operatorData as NamedOption[]);
      setContractors(contractorData as Contractor[]);
      setUsers(userData as UserOption[]);
      setSites(siteData);
      setProjectRoles(roleData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the project workspace.');
    } finally {
      setLoading(false);
    }
  }, [canConfigureProjects, token]);
```

Change to:
```tsx
  const loadWorkspace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [projectData, operatorData, contractorData, userData, siteData, roleData, workPassData] = await Promise.all([
        apiRequest<ProjectRecord[]>('/projects', { token }),
        canConfigureProjects ? listOperatorsRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listContractorsRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listUsersRequest(token, { pageSize: 250 }) : Promise.resolve([]),
        canConfigureProjects ? listSitesRequest(token) : Promise.resolve([]),
        canConfigureProjects ? listProjectRolesRequest(token) : Promise.resolve([]),
        canViewWorkPassQueue ? apiRequest<ProjectWorkPassRecord[]>('/work-passes', { token }) : Promise.resolve([]),
      ]);
      setProjects(projectData);
      setOperators(operatorData as NamedOption[]);
      setContractors(contractorData as Contractor[]);
      setUsers(userData as UserOption[]);
      setSites(siteData);
      setProjectRoles(roleData);
      setProjectWorkPasses(workPassData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the project workspace.');
    } finally {
      setLoading(false);
    }
  }, [canConfigureProjects, canViewWorkPassQueue, token]);
```

- [ ] **Step 5: Add the work-pass action handlers**

Add, near `handleSaved`:
```tsx
  async function handleWorkPassAction(
    workPass: ProjectWorkPassRecord,
    action: Exclude<WorkPassAction, 'reject'>,
  ) {
    if (!token) return;
    setBusyWorkPassId(workPass.id);
    try {
      const result = await apiRequest<ProjectWorkPassRecord | { workPass: ProjectWorkPassRecord; warnings: string[] }>(
        `/work-passes/${workPass.id}/${action}`,
        { method: 'POST', token },
      );
      const warnings = 'warnings' in result ? result.warnings : [];
      void warnings; // surfaced via reload; no separate toast plumbing needed here
      await loadWorkspace();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The work pass could not be updated.');
    } finally {
      setBusyWorkPassId(null);
    }
  }

  async function handleConfirmWorkPassReject() {
    if (!token || !rejectWorkPass || !workPassRejectReason.trim()) return;
    setBusyWorkPassId(rejectWorkPass.id);
    try {
      await apiRequest(`/work-passes/${rejectWorkPass.id}/reject`, {
        method: 'POST',
        token,
        body: { reason: workPassRejectReason.trim() },
      });
      setRejectWorkPass(null);
      setWorkPassRejectReason('');
      await loadWorkspace();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The work pass could not be rejected.');
    } finally {
      setBusyWorkPassId(null);
    }
  }
```
Note: `access-requests/page.tsx`'s original `handleWorkPassAction` used `toast()` for success messages; `projects/page.tsx` uses inline `error`/`notice`-style banners instead of toasts (matching this page's existing pattern — see `error` state usage elsewhere in this file). Success is implicitly visible via the queue updating after `loadWorkspace()`; this is a deliberate, minor adaptation to the destination page's existing convention, not a dropped feature.

- [ ] **Step 6: Render the queue and the reject dialog**

Add, in the JSX, directly after the `<header>` block and before the portfolio-summary `<section>`:
```tsx
      {canViewWorkPassQueue && projectWorkPasses.length > 0 ? (
        <ProjectWorkPassQueue
          workPasses={projectWorkPasses}
          projects={projects}
          actor={{ id: user?.id, role: user?.role }}
          isLoading={loading}
          busyWorkPassId={busyWorkPassId}
          onAction={(workPass, action) => void handleWorkPassAction(workPass, action)}
          onReject={(workPass) => { setRejectWorkPass(workPass); setWorkPassRejectReason(''); }}
        />
      ) : null}
```

Add the reject dialog before the final closing `</div>` of the component (alongside the existing `<ProjectWizardDialog>`):
```tsx
      <Dialog open={Boolean(rejectWorkPass)} onOpenChange={(open) => { if (!open) { setRejectWorkPass(null); setWorkPassRejectReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject project work pass</DialogTitle>
            <DialogDescription>
              Record what the contractor must correct. The reason remains on the work-pass audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="work-pass-reject-reason">Reason</Label>
            <Textarea
              id="work-pass-reject-reason"
              value={workPassRejectReason}
              onChange={(event) => setWorkPassRejectReason(event.target.value)}
              placeholder="e.g. Worker credentials are incomplete."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectWorkPass(null); setWorkPassRejectReason(''); }} disabled={Boolean(busyWorkPassId)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmWorkPassReject()} disabled={!workPassRejectReason.trim() || Boolean(busyWorkPassId)}>
              {busyWorkPassId ? 'Rejecting…' : 'Reject work pass'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 7: Remove the queue, tab, and related code from `access-requests/page.tsx`**

Remove from state:
```tsx
const [projects, setProjects] = useState<ProjectRecord[]>([]);
const [projectWorkPasses, setProjectWorkPasses] = useState<ProjectWorkPassRecord[]>([]);
```
and:
```tsx
const [busyWorkPassId, setBusyWorkPassId] = useState<string | null>(null);
const [rejectWorkPass, setRejectWorkPass] = useState<ProjectWorkPassRecord | null>(null);
const [workPassRejectReason, setWorkPassRejectReason] = useState('');
```

Remove:
```tsx
const canViewProjectWorkPasses = !isWorker;
```
and its usage in `fetchRequests`'s `Promise.all` (the two `canViewProjectWorkPasses ? apiRequest(...) : Promise.resolve([])` entries for `/projects` and `/work-passes`, and the corresponding `setProjects`/`setProjectWorkPasses` calls).

Remove:
```tsx
const workPassQueueItems = useMemo(() => getWorkPassQueueItems(
  projectWorkPasses,
  projects,
  { id: currentUser?.id, role: currentUser?.role },
), [projectWorkPasses, projects, currentUser?.id, currentUser?.role]);
```

Simplify `defaultTab`:
```tsx
const defaultTab = useMemo(() => {
  if (workPassQueueItems.some((item) => item.actions.length > 0)) return "work-passes";
  if (isManager) return "approve";
  return "my-requests-log";
}, [isManager, workPassQueueItems]);
```
becomes:
```tsx
const defaultTab = isManager ? "approve" : "my-requests-log";
```
(no longer needs `useMemo` — it's a pure derivation from two already-known values now, not from fetched data.)

Remove `handleWorkPassAction` and `handleConfirmWorkPassReject` in full.

In `getVisibleTabs()`, remove:
```tsx
if (canViewProjectWorkPasses) {
  tabs.push({ value: "work-passes", label: "Project Work Passes" });
}
```

Remove the entire work-passes `<TabsContent>` block:
```tsx
{canViewProjectWorkPasses && (
  <TabsContent value="work-passes">
    <ProjectWorkPassQueue
      workPasses={projectWorkPasses}
      projects={projects}
      actor={{ id: currentUser.id, role: currentUser.role }}
      isLoading={loading}
      busyWorkPassId={busyWorkPassId}
      onAction={(workPass, action) => void handleWorkPassAction(workPass, action)}
      onReject={(workPass) => {
        setRejectWorkPass(workPass);
        setWorkPassRejectReason('');
      }}
    />
  </TabsContent>
)}
```

Remove the reject-work-pass `<Dialog>` block at the end of the component (the one titled "Reject project work pass" — it now lives on `projects/page.tsx` instead).

Remove now-unused imports:
```tsx
import {
  ProjectWorkPassQueue,
  type ProjectWorkPassRecord,
} from "@/components/access-requests/project-work-pass-queue";
import type { ProjectRecord } from "@/components/projects/project-wizard-dialog";
import { getWorkPassQueueItems, type WorkPassAction } from "@/components/projects/project-command-center";
```
Confirm via grep that none of `ProjectWorkPassQueue`, `ProjectWorkPassRecord`, `ProjectRecord`, `getWorkPassQueueItems`, `WorkPassAction` remain referenced elsewhere in the file before removing each:
```bash
grep -n "ProjectWorkPassQueue\|ProjectWorkPassRecord\|ProjectRecord\|getWorkPassQueueItems\|WorkPassAction" "src/app/(app)/access-requests/page.tsx"
```
Expected after the edit: no matches.

- [ ] **Step 8: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 9: Manual browser verification**

1. On `/projects`, as a role with pending work-pass decisions (a project's assigned consultant reviewer, and separately the project's supervisor at the `PendingSecondApproval` stage): confirm the queue section appears above the portfolio summary, with the corrected "Pending supervisor approval" / "Final approval" copy, and that Submit/Approve/Final-approval/Reject actions work and refresh the list.
2. On `/access-requests`, confirm the "Project Work Passes" tab is gone and the remaining tabs still work (see Task 8 for the tab relabel/reduction — at this point in the sequence there may still be up to 2 tabs with old labels; that's expected, Task 8 handles labels).
3. Confirm a project with zero work passes shows no queue section on `/projects` (not an empty-state queue — the whole section is conditionally omitted per Step 6's `projectWorkPasses.length > 0` check).

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/projects/page.tsx" "src/app/(app)/access-requests/page.tsx"
git commit -m "Move the work-pass approval queue from Access Requests to Projects

Approving a work pass is a project-lifecycle action; it doesn't belong on
a page about ad-hoc access requests. The Access Requests page no longer
fetches or renders projects/work-passes at all."
```

---

## Task 7: Merge the approval date-picker and deny-reason dialog into the request details sheet

Collapses the two-path decision surface (row quick-icons → separate `ApprovalDialog`/deny `Dialog`, vs. row click → sheet → same separate dialogs) into one: click a request, one sheet, decide right there.

**Files:**
- Create: `src/components/access-requests/approval-fields.tsx` (extracted form body from `approval-dialog.tsx`)
- Delete: `src/components/access-requests/approval-dialog.tsx`
- Modify: `src/components/access-requests/request-details-dialog.tsx`
- Modify: `src/components/access-requests/requests-table.tsx`
- Modify: `src/app/(app)/access-requests/page.tsx`

**Interfaces:**
- Produces: `ApprovalFields({ onSubmit: (validFrom: Date, expiresAt: Date | 'Permanent') => void; onCancel: () => void })` — a standalone form component, no `<Dialog>` wrapper.
- `RequestDetailsDialog` new props: `onConfirmApprove?: (requestId: string, validFrom: Date, expiresAt: Date | 'Permanent') => void`, `onConfirmDeny?: (requestId: string, reason: string) => void` (replace `onApprove`/`onDeny`).
- `RequestsTable` and `access-requests/page.tsx` propagate the same renamed props through.

- [ ] **Step 1: Create `approval-fields.tsx`**

```tsx
'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { CalendarIcon, Check, InfinityIcon } from 'lucide-react';
import { format, addDays } from 'date-fns';

const formSchema = z.object({
  validFrom: z.date({ required_error: "A start date is required." }),
  expiryType: z.enum(['date', 'permanent']),
  expiresAt: z.date().optional(),
}).refine(data => {
  if (data.expiryType === 'date' && !data.expiresAt) return false;
  return true;
}, {
  message: "Expiry date is required.",
  path: ['expiresAt'],
}).refine(data => {
  if (data.expiryType === 'date' && data.expiresAt) {
    return data.expiresAt > data.validFrom;
  }
  return true;
}, {
  message: "Expiry date must be after the start date.",
  path: ['expiresAt'],
});

export function ApprovalFields({ onSubmit, onCancel }: {
  onSubmit: (validFrom: Date, expiresAt: Date | 'Permanent') => void;
  onCancel: () => void;
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      validFrom: new Date(),
      expiryType: 'date',
      expiresAt: addDays(new Date(), 30),
    },
  });

  const expiryType = form.watch('expiryType');

  function handleSubmit(values: z.infer<typeof formSchema>) {
    const expiresAt = values.expiryType === 'permanent' ? 'Permanent' : values.expiresAt!;
    onSubmit(values.validFrom, expiresAt);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
        <FormField
          control={form.control}
          name="validFrom"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Access start date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="expiryType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Access expiry</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl><RadioGroupItem value="date" /></FormControl>
                    <FormLabel className="font-normal">Set expiry date</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl><RadioGroupItem value="permanent" /></FormControl>
                    <FormLabel className="font-normal flex items-center gap-2">Permanent access <InfinityIcon className="h-4 w-4" /></FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {expiryType === 'date' && (
          <FormField
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Access expiry date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Pick an expiry date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit"><Check className="mr-2 h-4 w-4" /> Confirm approval</Button>
        </div>
      </form>
    </Form>
  );
}
```

- [ ] **Step 2: Delete `approval-dialog.tsx`**

```bash
rm src/components/access-requests/approval-dialog.tsx
```

- [ ] **Step 3: Modify `request-details-dialog.tsx`**

Add imports:
```tsx
import { useState } from "react";
```
(already imported for `isDeleting` — add `ApprovalFields` alongside it:)
```tsx
import { ApprovalFields } from './approval-fields';
```

Change the props interface:
```tsx
interface RequestDetailsDialogProps {
  request: AccessRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (request: AccessRequest) => void | Promise<void>;
  onApprove?: (request: AccessRequest) => void;
  onDeny?: (requestId: string) => void;
}
```
becomes:
```tsx
interface RequestDetailsDialogProps {
  request: AccessRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (request: AccessRequest) => void | Promise<void>;
  onConfirmApprove?: (requestId: string, validFrom: Date, expiresAt: Date | 'Permanent') => void;
  onConfirmDeny?: (requestId: string, reason: string) => void;
}
```

Change the function signature and add decision-mode state:
```tsx
export function RequestDetailsDialog({ request, open, onOpenChange, onDelete, onApprove, onDeny }: RequestDetailsDialogProps) {
  const workersInRequest = request.workers;
  const [isDeleting, setIsDeleting] = useState(false);
```
becomes:
```tsx
export function RequestDetailsDialog({ request, open, onOpenChange, onDelete, onConfirmApprove, onConfirmDeny }: RequestDetailsDialogProps) {
  const workersInRequest = request.workers;
  const [isDeleting, setIsDeleting] = useState(false);
  const [decisionMode, setDecisionMode] = useState<'none' | 'approve' | 'deny'>('none');
  const [denyReason, setDenyReason] = useState('');
```

Reset decision mode whenever a different request is shown or the sheet closes — add near the top of the component body:
```tsx
  useEffect(() => {
    if (!open) { setDecisionMode('none'); setDenyReason(''); }
  }, [open]);
```
(add `useEffect` to the React import at the top of the file: `import { useEffect, useState } from "react";`)

Add the inline decision sections. Immediately after the "Personnel Readiness" section's closing `</div>` and before the outer body `</div>` (i.e., right before `        </div>\n        <SheetFooter`), insert:
```tsx
            {decisionMode === 'approve' && onConfirmApprove ? (
              <ApprovalFields
                onCancel={() => setDecisionMode('none')}
                onSubmit={(validFrom, expiresAt) => {
                  onConfirmApprove(request.id, validFrom, expiresAt);
                  setDecisionMode('none');
                }}
              />
            ) : null}
            {decisionMode === 'deny' && onConfirmDeny ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <Label htmlFor="inline-deny-reason">Reason for denial</Label>
                <Textarea
                  id="inline-deny-reason"
                  value={denyReason}
                  onChange={(event) => setDenyReason(event.target.value)}
                  placeholder="e.g. Missing valid HSE induction certificate."
                  rows={4}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => { setDecisionMode('none'); setDenyReason(''); }}>Cancel</Button>
                  <Button
                    variant="destructive"
                    disabled={!denyReason.trim()}
                    onClick={() => {
                      onConfirmDeny(request.id, denyReason.trim());
                      setDecisionMode('none');
                      setDenyReason('');
                    }}
                  >
                    Deny request
                  </Button>
                </div>
              </div>
            ) : null}
```

Replace the footer's approve/deny buttons:
```tsx
        <SheetFooter className="gap-2 sm:gap-0">
          {hasPendingDecision && onDeny && (
            <Button
              variant="outline"
              onClick={() => {
                onDeny(request.id);
                onOpenChange(false);
              }}
            >
              <ShieldX className="mr-2 h-4 w-4" />
              Deny
            </Button>
          )}
          {hasPendingDecision && onApprove && (
            <Button
              onClick={() => {
                onApprove(request);
                onOpenChange(false);
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Approve
            </Button>
          )}
```
becomes:
```tsx
        <SheetFooter className="gap-2 sm:gap-0">
          {hasPendingDecision && decisionMode === 'none' && onConfirmDeny && (
            <Button variant="outline" onClick={() => setDecisionMode('deny')}>
              <ShieldX className="mr-2 h-4 w-4" />
              Deny
            </Button>
          )}
          {hasPendingDecision && decisionMode === 'none' && onConfirmApprove && (
            <Button onClick={() => setDecisionMode('approve')}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Approve
            </Button>
          )}
```
The remaining footer buttons (`onDelete`'s `AlertDialog`, and the `Close` button) are unchanged in content but should only render when `decisionMode === 'none'` (so the footer doesn't clutter the inline form with unrelated actions while it's open):
```tsx
          {onDelete && decisionMode === 'none' && (
            <AlertDialog>
              {/* ...unchanged... */}
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
```
becomes (add the same guard to the delete block; leave Close always visible so the sheet can always be dismissed):
```tsx
          {onDelete && decisionMode === 'none' && (
            <AlertDialog>
              {/* ...unchanged... */}
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
```
(Only the `onDelete` block's guard changes — add `&& decisionMode === 'none'`; `Close` stays unconditional.)

- [ ] **Step 4: Modify `requests-table.tsx`**

Remove the row-level quick Approve/Deny icon buttons (the decision surface now lives only in the sheet). Change:
```tsx
{showActionColumn && (
    <TableCell className="text-right">
        <div className="flex gap-2 justify-end">
            {showActions && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove?.(request);
                  }}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeny?.(request.id);
                  }}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </>
            )}
            {onDelete && (
              /* ...AlertDialog, unchanged... */
            )}
        </div>
    </TableCell>
)}
```
to:
```tsx
{onDelete && (
    <TableCell className="text-right">
        <div className="flex gap-2 justify-end">
            {/* ...AlertDialog, unchanged... */}
        </div>
    </TableCell>
)}
```
Note the column now only renders when `onDelete` is present (drop the `showActionColumn`/`colSpan` distinction tied to `showActions`, since `showActions` no longer controls a row-level control — it still controls whether the sheet gets approve/deny wired, via the props passed to `RequestDetailsDialog` below). Update:
```tsx
const showActionColumn = showActions || Boolean(onDelete);
const colSpan = showActionColumn ? 7 : 6;
```
to:
```tsx
const showActionColumn = Boolean(onDelete);
const colSpan = showActionColumn ? 7 : 6;
```
And remove the now-unused `Check`/`X` icon imports if nothing else in the file uses them:
```bash
grep -n "\bCheck\b\|\bX\b" src/components/access-requests/requests-table.tsx
```
Remove `Check` and `X` from the lucide-react import line if no other match remains.

Change the props interface and pass-through to `RequestDetailsDialog`:
```tsx
interface RequestsTableProps {
  requests: AccessRequest[];
  title: string;
  description: string;
  showActions?: boolean;
  onApprove?: (request: AccessRequest) => void;
  onDeny?: (requestId: string) => void;
  onDelete?: (request: AccessRequest) => void | Promise<void>;
  isLoading?: boolean;
}
```
becomes:
```tsx
interface RequestsTableProps {
  requests: AccessRequest[];
  title: string;
  description: string;
  showActions?: boolean;
  onConfirmApprove?: (requestId: string, validFrom: Date, expiresAt: Date | 'Permanent') => void;
  onConfirmDeny?: (requestId: string, reason: string) => void;
  onDelete?: (request: AccessRequest) => void | Promise<void>;
  isLoading?: boolean;
}
```
and the function signature/destructure updates to match, and:
```tsx
{selectedRequest && (
  <RequestDetailsDialog
    request={selectedRequest}
    open={!!selectedRequest}
    onOpenChange={(open) => {
      if (!open) {
        setSelectedRequest(null);
      }
    }}
    onDelete={onDelete}
    onApprove={showActions ? onApprove : undefined}
    onDeny={showActions ? onDeny : undefined}
  />
)}
```
becomes:
```tsx
{selectedRequest && (
  <RequestDetailsDialog
    request={selectedRequest}
    open={!!selectedRequest}
    onOpenChange={(open) => {
      if (!open) {
        setSelectedRequest(null);
      }
    }}
    onDelete={onDelete}
    onConfirmApprove={showActions ? onConfirmApprove : undefined}
    onConfirmDeny={showActions ? onConfirmDeny : undefined}
  />
)}
```

- [ ] **Step 5: Modify `access-requests/page.tsx`**

Remove state:
```tsx
const [approvalRequest, setApprovalRequest] = useState<AccessRequest | null>(null);
const [denyRequest, setDenyRequest] = useState<AccessRequest | null>(null);
const [denyReason, setDenyReason] = useState('');
const [denyBusy, setDenyBusy] = useState(false);
```

Remove `handleOpenApprovalDialog`, `handleOpenDenyDialog`, `handleConfirmDeny` in their current forms and replace with two direct-action handlers that no longer manage separate dialog-open state (the sheet in `RequestsTable`/`RequestDetailsDialog` now owns its own open/decision state):

Remove:
```tsx
const handleOpenApprovalDialog = (request: AccessRequest) => {
  setApprovalRequest(request);
};

const handleOpenDenyDialog = (requestId: string) => {
  const request = pendingRequests.find((r) => r.id === requestId)
    ?? myRequests.find((r) => r.id === requestId)
    ?? null;
  setDenyReason('');
  setDenyRequest(request);
};

const handleConfirmDeny = async () => {
  if (!token || !denyRequest) return;
  if (!denyReason.trim()) {
    toast({ variant: 'destructive', title: 'Reason required', description: 'Enter a reason for denying this request.' });
    return;
  }

  setDenyBusy(true);
  try {
    await updateAccessRequest(token, denyRequest.id, { status: 'Denied', decisionReason: denyReason.trim() });
    toast({ title: 'Request Denied', description: 'The request has been denied with a recorded reason.' });
    setDenyRequest(null);
    setDenyReason('');
    void fetchRequests();
  } catch (error) {
    console.error('Error denying request:', error);
    toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not deny the request.' });
  } finally {
    setDenyBusy(false);
  }
};
```

Add in their place:
```tsx
const handleConfirmDeny = async (requestId: string, reason: string) => {
  if (!token) return;
  try {
    await updateAccessRequest(token, requestId, { status: 'Denied', decisionReason: reason });
    toast({ title: 'Request Denied', description: 'The request has been denied with a recorded reason.' });
    void fetchRequests();
  } catch (error) {
    console.error('Error denying request:', error);
    toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not deny the request.' });
  }
};
```

Change `handleConfirmApproval` — it no longer needs to close a separate dialog:
```tsx
const handleConfirmApproval = async (requestId: string, validFrom: Date, expiresAt: Date | 'Permanent') => {
  if (!token) {
    toast({ variant: "destructive", title: "Session expired", description: "Please log in again to continue." });
    return;
  }

  try {
    await updateAccessRequest(token, requestId, buildAccessApprovalUpdate(validFrom, expiresAt));
    toast({ title: 'Request Approved', description: 'The access request has been approved.' });
    void fetchRequests();
  } catch (error) {
    console.error('Error approving request:', error);
    toast({ variant: 'destructive', title: 'Approval Failed', description: 'Could not approve the request.' });
  } finally {
    setApprovalRequest(null);
  }
};
```
becomes:
```tsx
const handleConfirmApproval = async (requestId: string, validFrom: Date, expiresAt: Date | 'Permanent') => {
  if (!token) {
    toast({ variant: "destructive", title: "Session expired", description: "Please log in again to continue." });
    return;
  }

  try {
    await updateAccessRequest(token, requestId, buildAccessApprovalUpdate(validFrom, expiresAt));
    toast({ title: 'Request Approved', description: 'The access request has been approved.' });
    void fetchRequests();
  } catch (error) {
    console.error('Error approving request:', error);
    toast({ variant: 'destructive', title: 'Approval Failed', description: 'Could not approve the request.' });
  }
};
```

Remove the standalone `<ApprovalDialog>` and deny `<Dialog>` JSX blocks entirely:
```tsx
{approvalRequest && (
  <ApprovalDialog
    request={approvalRequest}
    onOpenChange={() => setApprovalRequest(null)}
    onConfirm={handleConfirmApproval}
  />
)}

<Dialog open={!!denyRequest} onOpenChange={(open) => { if (!open) { setDenyRequest(null); setDenyReason(''); } }}>
  {/* ...entire deny dialog... */}
</Dialog>
```

Update the two `<RequestsTable>` usages to pass the renamed props:
```tsx
<RequestsTable
  title="Requests Log"
  description="A log of all access requests relevant to you."
  requests={myRequests}
  isLoading={loading}
  onDelete={canDelete ? handleDeleteRequest : undefined}
/>
```
stays the same shape (no approve/deny props here — matches current behavior where this tab never showed row actions).
```tsx
<RequestsTable
  title="Pending Approval"
  description="These requests are waiting for your approval."
  requests={pendingRequests}
  showActions={true}
  onApprove={handleOpenApprovalDialog}
  onDeny={handleOpenDenyDialog}
  onDelete={canDelete ? handleDeleteRequest : undefined}
  isLoading={loading}
/>
```
becomes:
```tsx
<RequestsTable
  title="Pending Approval"
  description="These requests are waiting for your approval."
  requests={pendingRequests}
  showActions={true}
  onConfirmApprove={handleConfirmApproval}
  onConfirmDeny={handleConfirmDeny}
  onDelete={canDelete ? handleDeleteRequest : undefined}
  isLoading={loading}
/>
```

Remove the now-unused `ApprovalDialog` import:
```tsx
import { ApprovalDialog } from "@/components/access-requests/approval-dialog";
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 7: Manual browser verification**

1. On the "Pending Approval" tab, click a request row: sheet opens with full details. Click "Approve": the approval form (start date, expiry radio, expiry date) appears inline in the sheet, not a new popup. Submit it: request approves, sheet closes, list refreshes.
2. Same flow for "Deny": inline reason textarea appears, Deny disabled until text entered, submitting denies and closes the sheet.
3. Confirm the row itself no longer has separate quick-approve/quick-deny icons — only Delete (where applicable) remains as a row-level icon.
4. Confirm "Cancel" inside either inline form returns to the normal detail view (not closing the whole sheet).
5. Confirm the "Requests Log" tab (no `showActions`) still opens the sheet in pure view mode with no Approve/Deny buttons in the footer.

- [ ] **Step 8: Commit**

```bash
git add src/components/access-requests/approval-fields.tsx \
        src/components/access-requests/request-details-dialog.tsx \
        src/components/access-requests/requests-table.tsx \
        "src/app/(app)/access-requests/page.tsx"
git rm src/components/access-requests/approval-dialog.tsx
git commit -m "Merge approve/deny into the request details sheet — one decision surface

Removes the row-level quick-approve/deny icons and the separate
ApprovalDialog/deny-reason popups. Approving or denying now happens
inline inside the same sheet used to view a request's details, matching
the reference journey's 'one sheet per decision' pattern."
```

---

## Task 8: Reduce Access Requests to two tabs with plain-language labels

**Files:**
- Modify: `src/app/(app)/access-requests/page.tsx`

- [ ] **Step 1: Update tab labels**

Change:
```tsx
const getVisibleTabs = () => {
  const tabs = [];

  if (isSupervisor || isWorker || isManager) {
    tabs.push({ value: "my-requests-log", label: "Requests Log" });
  }

  if (isManager) {
    tabs.push({ value: "approve", label: "Approve Requests" });
  }
  return tabs;
};
```
to:
```tsx
const getVisibleTabs = () => {
  const tabs = [];

  if (isManager) {
    tabs.push({ value: "approve", label: "To review" });
  }

  if (isSupervisor || isWorker || isManager) {
    tabs.push({ value: "my-requests-log", label: "All requests" });
  }
  return tabs;
};
```
("To review" is listed first when present, matching that it's the default tab for managers — see `defaultTab` from Task 6.)

- [ ] **Step 2: Update the RequestsTable title/description copy to match**

Change:
```tsx
<RequestsTable
  title="Requests Log"
  description="A log of all access requests relevant to you."
  requests={myRequests}
  isLoading={loading}
  onDelete={canDelete ? handleDeleteRequest : undefined}
/>
```
to:
```tsx
<RequestsTable
  title="All requests"
  description="Every access request in your scope, regardless of status."
  requests={myRequests}
  isLoading={loading}
  onDelete={canDelete ? handleDeleteRequest : undefined}
/>
```
Change:
```tsx
<RequestsTable
  title="Pending Approval"
  description="These requests are waiting for your approval."
  ...
```
to:
```tsx
<RequestsTable
  title="To review"
  description="These requests are waiting for your decision."
  ...
```

- [ ] **Step 3: Update the page header copy for consistency**

Change:
```tsx
<h1 className="text-2xl font-semibold tracking-tight">Access Request Workflow</h1>
<p className="text-sm text-muted-foreground">Create, review, approve, and track governed access windows.</p>
```
to:
```tsx
<h1 className="text-2xl font-semibold tracking-tight">Access Requests</h1>
<p className="text-sm text-muted-foreground">Review, approve, and track site access.</p>
```
(matches the sidebar nav label "Access Requests" exactly, per the nav/page-title consistency principle.)

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Manual browser verification**

Confirm the page title now reads "Access Requests" (matching the sidebar), and — for a Manager role — the tabs read "To review" then "All requests", with "To review" selected by default when there are pending items.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/access-requests/page.tsx"
git commit -m "Reduce Access Requests to two tabs with plain-language labels

Down from three tabs (the third, Project Work Passes, moved to /projects
in a previous commit). Page title now matches the sidebar nav label."
```

---

## Task 9: Collapse the project-creation wizard into one scrollable form

Removes step-by-step pagination (Continue/Back, a left-hand step rail, a separate Review screen) while preserving every field and validation rule exactly — the wizard's "participants" step is validated as required by the backend today, so this task does not remove or defer any field, only the forced single-step-at-a-time navigation.

**Files:**
- Modify: `src/components/projects/project-wizard-dialog.tsx`

- [ ] **Step 1: Remove step-navigation state and the `steps` array**

Remove:
```tsx
const [stepIndex, setStepIndex] = useState(0);
```
(keep `draft`, `errors`, `saving`, `saveError`, `memberRoleIds` — unchanged)

Remove the `steps` array declaration:
```tsx
const steps: Array<{
  id: ProjectWizardStep;
  label: string;
  hint: string;
  icon: typeof FileText;
}> = [
  { id: 'details', label: 'Project details', hint: 'Identity, ownership and dates', icon: FileText },
  { id: 'sites', label: 'Sites & scope', hint: 'Where this project operates', icon: MapPinned },
  { id: 'participants', label: 'Participants', hint: 'Contractors and project team', icon: Users },
  { id: 'review', label: 'Review', hint: 'Confirm before saving', icon: Check },
];
```

Remove:
```tsx
const currentStep = steps[stepIndex];
```

Remove `continueToNextStep`:
```tsx
function continueToNextStep() {
  const validationErrors = validateProjectStep(currentStep.id, draft, {
    requireOperator: currentUserRole !== 'Supervisor',
  });
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }
  setStepIndex((current) => Math.min(current + 1, steps.length - 1));
}
```

Remove the `setStepIndex(0)` line inside the `useEffect` that resets the draft on open (keep the rest of that effect unchanged):
```tsx
useEffect(() => {
  if (!open) return;
  const nextDraft = initialDraft(project);
  nextDraft.operatorId = resolveProjectOperatorId(
    currentUserOperatorId,
    nextDraft.operatorId,
  );
  setDraft(nextDraft);
  setStepIndex(0);
  setErrors({});
  setSaveError('');
  setMemberRoleIds(Object.fromEntries((project?.members ?? []).map((member) => [member.userId, member.projectRoleId ?? ''])));
}, [currentUserOperatorId, open, project]);
```
becomes:
```tsx
useEffect(() => {
  if (!open) return;
  const nextDraft = initialDraft(project);
  nextDraft.operatorId = resolveProjectOperatorId(
    currentUserOperatorId,
    nextDraft.operatorId,
  );
  setDraft(nextDraft);
  setErrors({});
  setSaveError('');
  setMemberRoleIds(Object.fromEntries((project?.members ?? []).map((member) => [member.userId, member.projectRoleId ?? ''])));
}, [currentUserOperatorId, open, project]);
```

- [ ] **Step 2: Validate all sections at once in `saveProject`**

Change the start of `saveProject`:
```tsx
async function saveProject() {
  setSaving(true);
  setSaveError('');
  try {
```
to:
```tsx
async function saveProject() {
  const allErrors = {
    ...validateProjectStep('details', draft, { requireOperator: currentUserRole !== 'Supervisor' }),
    ...validateProjectStep('sites', draft),
    ...validateProjectStep('participants', draft),
  };
  if (Object.keys(allErrors).length > 0) {
    setErrors(allErrors);
    return;
  }
  setSaving(true);
  setSaveError('');
  try {
```
(the rest of `saveProject`'s body — the create/update API calls, member diffing — is unchanged.)

- [ ] **Step 3: Replace the stepped layout with one scrollable form**

Replace the entire content region — from the `<div className="grid min-h-0 flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">` wrapper (including the `<nav>` step rail) through the four `currentStep.id === '...'` conditional blocks — with a single always-rendered stack. Specifically, change:
```tsx
        <div className="grid min-h-0 flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Project setup progress" className="border-b bg-slate-50 p-4 md:border-b-0 md:border-r">
            {/* ...step rail buttons... */}
          </nav>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            {currentStep.id === 'details' ? (
              <div className="space-y-5">
                {/* ...details fields, unchanged content... */}
              </div>
            ) : null}

            {currentStep.id === 'sites' ? (
              <div className="space-y-6">
                {/* ...sites SelectionGroup, unchanged content... */}
              </div>
            ) : null}

            {currentStep.id === 'participants' ? (
              <div className="space-y-6">
                {/* ...participants fields, unchanged content... */}
              </div>
            ) : null}

            {currentStep.id === 'review' ? (
              <div className="space-y-5">
                {/* ...review summary — DELETE this entire block, see below... */}
              </div>
            ) : null}
          </div>
        </div>
```
to:
```tsx
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-8">
          <div className="space-y-5">
            {/* ...details fields, unchanged content (was inside currentStep.id === 'details')... */}
          </div>

          <div className="space-y-6">
            {/* ...sites SelectionGroup, unchanged content (was inside currentStep.id === 'sites')... */}
          </div>

          <div className="space-y-6">
            {/* ...participants fields, unchanged content (was inside currentStep.id === 'participants')... */}
          </div>

          {saveError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p> : null}
        </div>
```
The `saveError` paragraph moves out of the deleted "review" block to the end of this single scrollable area (it's a submission-time error, not tied to any one section).

The **review step's summary content is deleted entirely** — its information (operator, consultant, reviewers, period, contractors, sites, team, status) duplicated what's already visible in the sections above it; with everything on one scrollable form there is nothing left to "review" that isn't already on screen.

- [ ] **Step 4: Simplify the footer**

Change:
```tsx
        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <div className="flex gap-2">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" onClick={() => setStepIndex((current) => current - 1)} disabled={saving}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              ) : null}
              {stepIndex < steps.length - 1 ? (
                <Button type="button" onClick={continueToNextStep}>
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={() => void saveProject()} disabled={saving}>
                  {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
```
to:
```tsx
        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={() => void saveProject()} disabled={saving}>
              {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
            </Button>
          </div>
        </DialogFooter>
```

- [ ] **Step 5: Clean up now-unused imports and types**

Remove `ChevronLeft`, `ChevronRight`, `MapPinned`, `Users` from the lucide-react import if they become unused (check each — `Check` stays, used in the `SelectionGroup` checkbox rendering and the footer icon was removed but `Check` may still be used elsewhere in the file):
```bash
grep -n "ChevronLeft\|ChevronRight\|MapPinned\|\bUsers\b\|\bFileText\b" src/components/projects/project-wizard-dialog.tsx
```
Remove any of `ChevronLeft`, `ChevronRight`, `MapPinned`, `Users`, `FileText` from the import line that show zero remaining matches (they were only used by the deleted `steps` array's `icon` fields and the deleted Back/Continue buttons).

`ProjectWizardStep` type import from `./project-workflow` — check if still used:
```bash
grep -n "ProjectWizardStep" src/components/projects/project-wizard-dialog.tsx
```
It's still used as the type parameter to `validateProjectStep('details', ...)` etc. only implicitly (the string literals `'details'`/`'sites'`/`'participants'` are inferred against `ProjectWizardStep` by `validateProjectStep`'s signature) — the explicit type import itself may now be unused if it was only referenced via `steps: Array<{ id: ProjectWizardStep; ... }>`. Remove the `ProjectWizardStep` named import from `./project-workflow` if grep shows no remaining explicit reference; the string-literal arguments to `validateProjectStep` still typecheck correctly without it since the function signature already constrains them.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 7: Manual browser verification**

1. Open "New project" from `/projects`: confirm all three sections (details, sites, participants) are visible on one scrollable form, no step rail, no Continue/Back.
2. Try to save with missing required fields (e.g. no site selected): confirm the relevant inline error appears next to that field (not just a generic top-level error) and the form does not submit.
3. Fill in all required fields and save: confirm project creation succeeds and behaves identically to before (same API calls, same member-diffing logic).
4. Open "Edit" on an existing project: confirm the same single-form layout, pre-populated correctly, saves changes.

- [ ] **Step 8: Commit**

```bash
git add src/components/projects/project-wizard-dialog.tsx
git commit -m "Collapse the 4-step project wizard into one scrollable form

Removes step-by-step pagination and the separate Review screen. Every
required field and validation rule is unchanged — this is pure UX
flattening, not a scope cut (the participants step's consultant/contractor
requirements are validated server-side and stay required)."
```

---

## Task 10: Delete dead code — `new-request-form.tsx`

**Files:**
- Delete: `src/components/access-requests/new-request-form.tsx`

- [ ] **Step 1: Confirm zero external references**

```bash
grep -rn "new-request-form|NewRequestForm" src/
```
Expected: only matches inside the file's own declaration.

- [ ] **Step 2: Delete the file**

```bash
rm src/components/access-requests/new-request-form.tsx
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/access-requests/new-request-form.tsx
git commit -m "Remove dead NewRequestForm component

Zero references anywhere; an earlier, unwired iteration of what
SupervisorRequestForm now does for real, with a different, incompatible
data shape."
```

---

# Phase 3 — Dashboard

Context already verified on this branch:
- 4 dashboard component files exist and are confirmed dead (zero imports anywhere): plus 6 more from the originally-audited set were confirmed dead too — **all 10** originally flagged files are confirmed dead code on this branch via direct grep, none are false positives.
- The `DashboardSummary` wire type (`src/lib/api.ts`) carries many fields (`contractorScorecards`, `projectScorecards`, `competencies`, `cards`, `adoption`, `registrationFunnel`, `dataQuality`, `attendance`, `capacity`, `bottlenecks`, `peakOccupancy`, `turnaround`, `operators`, `contractors`, `nationalities`) that fed exactly these dead components and are read nowhere in the four live dashboard files. This plan does **not** touch the wire type itself (shared contract, out of scope) — only deletes the dead component files that would have consumed those fields.
- `panelKeys`/`metricKeys` visibility is entirely server-driven (backend decides per role/profile) — there is no client-side role-conditional to refactor. The safe, mechanical cut is capping how many of the backend-authorized keys the frontend will ever render at once, not inventing new role logic client-side.
- Correction to the original design spec: "curate tiles/panels" only needed to mean the **metric tiles** (up to 14 possible `metricKeys`, genuinely unbounded density — Task 12). The five richer visual **panels** (`scope-overview`, `decision-health`, `site-pulse`, `workforce-readiness`, `credential-watch`, gated in `dashboard-visuals.tsx`) are already naturally bounded to at most 2 rows of at most 2-3 items each by their own layout logic (`showPrimaryChart || showDecisionHealth` as one row, `showRiskPanels` as a second) — there is no further row/count reduction to make there without dropping a whole panel's worth of real information (e.g. removing "Credential watch" entirely), which is a scope cut, not a density cut. Left unchanged; no task added for panels.
- Correction to the original design spec: the dashboard's custom date-range option is already one of four well-scoped presets (24h/7d/30d/custom), not a separate cluttering control — it is left as-is. Cutting it would remove real capability (e.g. an audit needing a specific range) for no clutter reduction, since it's already gated behind selecting "Custom range" from the same dropdown as the other presets.

## Task 11: Delete the ten confirmed-dead dashboard widget files

**Files:**
- Delete: `src/components/dashboard/management-scorecards.tsx`
- Delete: `src/components/dashboard/registration-funnel-panel.tsx`
- Delete: `src/components/dashboard/shift-rosters-panel.tsx`
- Delete: `src/components/dashboard/report-schedules-panel.tsx`
- Delete: `src/components/dashboard/trends-capacity-panel.tsx`
- Delete: `src/components/dashboard/data-quality-panel.tsx`
- Delete: `src/components/dashboard/inclusive-adoption-panel.tsx`
- Delete: `src/components/dashboard/on-site-by-company-chart.tsx`
- Delete: `src/components/dashboard/on-site-by-nationality-chart.tsx`
- Delete: `src/components/dashboard/site-occupancy-list.tsx`

- [ ] **Step 1: Re-verify zero references immediately before deleting (defensive — confirm nothing changed since research)**

```bash
for f in management-scorecards registration-funnel-panel shift-rosters-panel report-schedules-panel trends-capacity-panel data-quality-panel inclusive-adoption-panel on-site-by-company-chart on-site-by-nationality-chart site-occupancy-list; do
  echo "=== $f ==="
  grep -rn "$f" src/ --include='*.ts' --include='*.tsx' | grep -v "components/dashboard/$f\.tsx"
done
```
Expected: no output under any `===` header (confirms each file truly has zero external references before deletion).

- [ ] **Step 2: Delete all ten files**

```bash
rm src/components/dashboard/management-scorecards.tsx \
   src/components/dashboard/registration-funnel-panel.tsx \
   src/components/dashboard/shift-rosters-panel.tsx \
   src/components/dashboard/report-schedules-panel.tsx \
   src/components/dashboard/trends-capacity-panel.tsx \
   src/components/dashboard/data-quality-panel.tsx \
   src/components/dashboard/inclusive-adoption-panel.tsx \
   src/components/dashboard/on-site-by-company-chart.tsx \
   src/components/dashboard/on-site-by-nationality-chart.tsx \
   src/components/dashboard/site-occupancy-list.tsx
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Build**

```bash
npm run build
```
Expected: build succeeds (confirms nothing was dynamically importing these by a computed path Step 1's static grep couldn't catch).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/management-scorecards.tsx \
        src/components/dashboard/registration-funnel-panel.tsx \
        src/components/dashboard/shift-rosters-panel.tsx \
        src/components/dashboard/report-schedules-panel.tsx \
        src/components/dashboard/trends-capacity-panel.tsx \
        src/components/dashboard/data-quality-panel.tsx \
        src/components/dashboard/inclusive-adoption-panel.tsx \
        src/components/dashboard/on-site-by-company-chart.tsx \
        src/components/dashboard/on-site-by-nationality-chart.tsx \
        src/components/dashboard/site-occupancy-list.tsx
git commit -m "Delete ten dead dashboard widget components

Zero external references confirmed via grep immediately before deletion.
These fed DashboardSummary fields (contractorScorecards, adoption,
registrationFunnel, dataQuality, attendance, capacity, bottlenecks, etc.)
that no live dashboard code reads — an earlier, richer dashboard
iteration that was never wired up or fully removed."
```

---

## Task 12: Cap dashboard metric tiles to a priority-ordered maximum of five

**Files:**
- Modify: `src/components/dashboard/dashboard-layout.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `getDashboardMetricCards` unchanged signature (`(summary: DashboardMetricSummary) => DashboardMetricCard[]`), now bounded to at most 5 results regardless of how many keys `summary.audience.metricKeys` contains.

- [ ] **Step 1: Add a priority order and cap the output**

Current:
```ts
export function getDashboardMetricCards(summary: DashboardMetricSummary): DashboardMetricCard[] {
  return (summary.audience.metricKeys ?? []).flatMap((key) => {
    const buildMetric = metricRegistry[key];
    return buildMetric ? [buildMetric(summary)] : [];
  });
}
```

Change to:
```ts
// Bounds how many tiles ever render at once, regardless of how many keys the
// backend authorizes for a given role/profile — the reference shape this
// redesign follows uses ~4-5 tiles, not up to all 14 possible metricRegistry keys.
const METRIC_PRIORITY: string[] = [
  'people-on-site',
  'pending-decisions',
  'assigned-decisions',
  'workforce-readiness',
  'credential-risk',
];
const MAX_METRIC_TILES = 5;

export function getDashboardMetricCards(summary: DashboardMetricSummary): DashboardMetricCard[] {
  const requestedKeys = summary.audience.metricKeys ?? [];
  const prioritized = METRIC_PRIORITY.filter((key) => requestedKeys.includes(key));
  const remaining = requestedKeys.filter((key) => !METRIC_PRIORITY.includes(key));
  const cappedKeys = [...prioritized, ...remaining].slice(0, MAX_METRIC_TILES);
  return cappedKeys.flatMap((key) => {
    const buildMetric = metricRegistry[key];
    return buildMetric ? [buildMetric(summary)] : [];
  });
}
```
This never shows a key the backend didn't already authorize for this viewer (still filters against `requestedKeys`) — it only bounds the maximum count and prioritizes the five most actionable keys when more than five are authorized.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Manual browser verification**

As a role/scope combination known to authorize many metric keys (e.g. an Admin viewing "All operators"/"All sites"), confirm the dashboard's metric-tile row shows at most 5 tiles, with `people-on-site`, `pending-decisions`, `assigned-decisions`, `workforce-readiness`, `credential-risk` appearing first when they're among the authorized keys. As a narrower role (e.g. Security), confirm tiles still render correctly when fewer than 5 keys are authorized (no crash, no empty gaps — `getDashboardMetricGridClass` already handles 1-5 counts).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/dashboard-layout.ts
git commit -m "Cap dashboard metric tiles to a priority-ordered maximum of five

The tile grid could grow to any of 14 backend-authorized keys at once.
Still fully backend-gated (never shows an unauthorized key) — just bounds
the maximum density to match a glanceable daily-view shape."
```

---

# Deferred — separate follow-up tasks (explicitly not part of this plan)

File these as independent tasks once this plan ships. Do not fold them into any task above.

1. **Worker self-service document upload gap.** `/profile` passes `canManage={user.role !== 'Worker'}` to `WorkerDocuments`, meaning a Worker viewing their own profile cannot upload their own documents — there is currently no self-service upload path for Workers anywhere in the app. This is a product/security decision (should Workers self-upload unverified evidence?), not a layout fix.
2. **Dead stub routes.** `src/app/(app)/card-verification/`, `src/app/(app)/consultant/`, `src/app/(app)/scan/`, `src/app/(app)/card-production/` are empty directories with no `page.tsx` — unreachable, but worth deleting along with any dangling nav/test references (a pre-existing unit test, `sidebar-navigation-requirements.test.ts`, already documents `/scan`'s removal — verify it still passes after any cleanup).
3. **Re-verify no duplicate approval paths remain.** Task 6/7 consolidated the two known duplications (work-pass queue location, approve/deny decision surface). After this plan ships, do a fresh grep for any other place `ApprovalDialog`-style patterns might have been copy-pasted elsewhere in the app, and file anything found.
