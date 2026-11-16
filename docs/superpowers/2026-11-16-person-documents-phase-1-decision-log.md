# SDD ledger — plan: /Users/tamerabbasher/Documents/Projects/gatepass/gatepass-nextjs/docs/superpowers/plans/2026-11-15-person-documents-phase-1.md

Spec: /Users/tamerabbasher/Documents/Projects/gatepass/gatepass-nextjs/docs/superpowers/specs/2026-11-14-person-documents-design.md (read, reachable)
Repo: /Users/tamerabbasher/Documents/Projects/gatepass/gatepass/backend-dotnet
Branch: feat/person-documents-phase-1 (from main @ df4a3c1)

## Setup rulings

Ruling: feature branch in the existing checkout instead of a git worktree — only
1.6 GB free in the APFS container, and a second build tree plus its own obj/bin
risks the disk-full that already broke a deploy earlier in this session. Cost if
wrong: this checkout is not isolated, so a concurrent session editing the backend
would collide; nothing else is working in it.

Ruling: cleared 637 MB of bin/obj before starting to buy build headroom. Cost if
wrong: first build is a full rebuild, about a minute.

## Pre-flight scan

### Pairs sharing a file or an interface

| Tasks | Produces → consumes | Finding |
| --- | --- | --- |
| 1 → 2,3,4,5,7,9 | enums → every later signature | clean |
| 2 → 6,7,8,9,12,13 | entities, DbSets → all data access | see F1, F3 |
| 3 → 4,6,10 | `DocumentValidity.Evaluate` | clean, signature identical at both ends |
| 4 → 6 | candidate records → EF projection | clean; `Category` and `VerificationIsPortable` reachable via the `DocumentType` join |
| 4 → 10 | `RequirementOutcome.State` → clearance message | **F2**: Unfit medical collapses into `Rejected`, so Task 10 cannot say "barred by a medical outcome" as its own step requires |
| 5 → 12 | `DocumentCatalogSeed.BuildDefaults` → migration seed | **F3**: no task creates a `DocumentType` per existing `CertificateType`, which Task 12's competency backfill needs |
| 6 → 8 | `CanViewFiles` placeholder → real rules | clean, Task 8 names the line it replaces |
| 6 → 10,11 | `GetComplianceAsync` → clearance, gate, API | clean |
| 7 → 11 | `IPersonDocumentService` → controllers | clean |
| 8 → 11 | `IPersonDocumentFileService` → file route | clean |
| 9 → 4 | `DocumentRequirementException` → `WaiverCandidate` | clean; `IsRevoked` derives from `RevokedAtUtc` |
| 9 → 11 | waiver service → spec's exception routes | clean |
| 12 → 2 | migration tables → EF configuration | clean, Task 12 is explicitly last so the model has stopped moving |
| 13 → 2 | `RetentionDays`, `SupersededByDocumentId` | clean; clearing `NumberHash` to null is compatible with the filtered unique index |
| 10 → mobile/web | `ScanCredentialDto` plus a new `Restrictions` collection | clean, additive only |

### Self-consistency, per task

| Task | Tests specified vs code specified | Files created vs later touched | Finding |
| --- | --- | --- | --- |
| 1 | no tests, enums only | — | clean |
| 2 | 2 tests, both assert real behaviour | entities + context | clean |
| 3 | theory of 3 + 8 facts = the 11 the step claims | one file | clean |
| 4 | 14 facts = 14 claimed | two files | clean |
| 5 | 5 facts; 13 codes listed = 13 claimed | one file | clean |
| 6 | 4 facts | DTOs reused by 7,8,9 | clean |
| 7 | 14 facts = 14 claimed | service | clean |
| 8 | 7 + 2 = 9 claimed | rules + service, modifies 6 | clean |
| 9 | 7 facts = 7 claimed | service, modifies 6's DTO file | clean |
| 10 | 8 facts across 3 existing test classes | modifies 3 services | clean |
| 11 | 6 facts | 2 controllers + 1 modified | clean |
| 12 | 11 facts | migration + backfill | see F3 |
| 13 | 8 facts = 8 claimed | processor | clean |

No task mandates anything the review rubric treats as a defect: no test asserts
nothing, and no logic block is duplicated verbatim across tasks.

### Findings and rulings

**F1 — spec says `UniqueNumberScope` (`None`/`Tenant`); the plan uses a
`RequiresUniqueNumber` bool.** Tenant-scoped uniqueness is unimplementable as
written, because the spec also makes `PersonDocument` person-owned with no
`TenantId` to scope against. Ruling: keep the bool, enforced as a unique
`(DocumentTypeId, NumberHash)` index — global per type. This is also the truer
rule, since a Civil ID number is globally unique, not unique per tenant. Cost if
wrong: a client wanting the same number reused across tenants would need the
index relaxed, a one-line migration.

**F2 — an `Unfit` medical outcome is indistinguishable from a rejected
document.** Task 4 maps it to `DocumentValidityState.Rejected`, but Task 10's own
step requires the clearance message to name a medical bar separately. Ruling: add
`DocumentValidityState.Barred = 8`, used only for a verified, current medical
document whose outcome is `Unfit`. Amending Task 1 and Task 4 now. Cost if wrong:
none identified; it removes an ambiguity rather than adding one.

**F3 — nothing creates a `Competency` `DocumentType` per existing
`CertificateType`.** The spec says each `CertificateType` row "becomes a
`Competency` `DocumentType` carrying the same id, so existing references survive";
the plan's Task 5 seeds only the 13 fixed types and Task 12 assumes the competency
types exist. Ruling: Task 12's backfill creates one `DocumentType` per
`CertificateType`, reusing `CertificateType.Id` as the `DocumentType.Id`, before
mapping any `UserCertificate`. Amending Task 12 now. Cost if wrong: competency
backfill fails loudly on a missing type, caught by Task 12's own tests.

## Task log

Task 1: dispatched (implementer on haiku — the brief carries the complete enum
text, so this is transcription plus a build). BASE df4a3c1.
Task 1: complete (commits df4a3c1..55bf3ac, review clean). Reviewer verified all
11 enums member by member. Three ⚠️ items resolved by me: build re-run gives
0 errors and the same 20 pre-existing warnings (E2ETests/Infrastructure, none in
Domain), which also disproves any name collision; the multi-line layout
deviation changes no identifier. None was a real gap.

Task 2: dispatched (implementer on sonnet — multi-file, entities plus EF
configuration plus two interface files). BASE 55bf3ac.
Task 2: implementer returned DONE_WITH_CONCERNS at 0ca1fd6 (2/2 new tests, 624
GatePass.Tests and 79 IntegrationTests passing; 12 E2ETests fail for want of
Docker, which is a pre-existing environmental limit on this machine, not a
regression). Two concerns are observations — tenant string fields without a FK
match the existing `PersonIdentityDocument` pattern, and the extra navigations
are for the reviewer to judge, so I passed them on without pre-judging. The
third surfaced a real spec defect:

**F4 — the spec contradicted itself on `DocumentRequirement.ScopeId`.** Its
field table said "null for `Tenant`", while its matching rule said a person's
requirements include "their tenant". With a null `ScopeId` a `Tenant`-scoped
rule binds every tenant at once, so one client's policy would block another
client's workers. Ruling: `ScopeId` holds the tenant id when `ScopeKind` is
`Tenant` and is never null; a person with no `TenantId` matches no
`Tenant`-scoped rule and must not throw. Amended the spec's field table, and
Task 4's text and tests (the old `TenantScopedRequirement_AppliesToEveryone`
became `…AppliesToEveryoneInThatTenant` plus a second test that another
tenant's person is excluded). No change needed in Task 2's entity, since
`ScopeId` is already nullable in the column and the ruling is about what the
evaluator does with it. Cost if wrong: a client genuinely wanting a
cross-tenant rule must add one row per tenant.

Task 2: review returned Needs fixes — 3 Important, 5 Minor. Rulings before the
fix round, two of them against plan-mandated indexes:

Ruling (Important 1, accepted): `DocumentFileAccessLog` loses its FK to
`PersonDocumentFile` and keeps `PersonDocumentFileId` as a plain indexed
string. Cascade was wrong, but Restrict is also wrong: the Task 13 retention job
deletes files, and Restrict would make it throw. The audit trail has to outlive
the thing it describes. `DocumentVerificationCheck` keeps its cascade from
`PersonDocument`, because retention keeps the document row and only a genuine
hard delete removes it. Cost if wrong: an access log can name a file id that no
longer exists, which is the intended behaviour.

Ruling (Important 2, follow-on from F4): `DocumentRequirement.ScopeId` becomes
non-null. The reviewer is right that NULLs are distinct in a unique index, so
the plan's `(DocumentTypeId, ScopeKind, ScopeId)` uniqueness did not bite for
exactly the `Tenant` rows. F4 already made `ScopeId` carry the tenant id; making
the column required is what enforces it.

Ruling (Important 3, accepted, amends a plan-mandated index): keep
`DocumentType.TenantId` nullable for shared catalog rows, and add a second
unique index on `Code` filtered to `TenantId IS NULL`. The plan specified only
`(TenantId, Code)`, which does not reject duplicate global codes. Cost if wrong:
none identified; it only adds a constraint.

Ruling (reviewer's Minor 3, promoted to blocking): drop DB-level uniqueness on
`(DocumentTypeId, NumberHash)` and keep it as a plain index. The reviewer rated
this Minor, but it breaks the spec's central renewal flow: a renewal is a new
record and a renewed Civil ID carries the same number, so the new row would
collide with the one it supersedes — and it collides at insert time, before
review can mark the old one superseded, so no filtered variant saves it.
Uniqueness is a cross-person rule, not a cross-row rule, so it belongs in the
service, where Task 7 already specifies
`Create_RejectsDuplicateNumberOnTypesRequiringUniqueness`. The index stays for
lookup and for the later duplicate-detection work. Cost if wrong: a duplicate
number could be inserted by a code path that bypasses the service; nothing in
the plan writes documents except that service.

Task 2: minor (deferred): the extra navigations on the requirement, exception,
check and access-log entities were not requested; each is wired to a real FK and
harmless, so they stay for the final review to triage.
Task 2: minor (deferred): no FK from the three tenant-bearing string fields to
`Tenant`, consistent with the existing `PersonIdentityDocument` pattern.
Task 2: fix round 1/5 dispatched to the original implementer, all 6 fixes
reported in at 4f11c94 (3/3 covering tests, build clean, full suite deferred to
the next task's run by my instruction). Scoped re-review dispatched over
0ca1fd6..4f11c94.
Task 2: fix round 1/5 (5 addressed, 1 open — Fix 3's filtered unique index was
added to the `Entity<SkillDefinition>` block instead of `Entity<DocumentType>`,
which both left the original gap open and put a new unique constraint on a
legacy table that Task 12 would have baked into a live migration; commits
0ca1fd6..4f11c94).
Task 2: fix round 2/5 dispatched to the same implementer — move the index to the
right entity, restore the `SkillDefinition` block untouched, and add the
duplicate-global-code test whose absence let the misplacement through.
Task 2: fix round 2/5 (2 addressed, 0 open; commits 4f11c94..d892efb). The
re-review approved but flagged that it could only infer the pre-round-1 state of
the `SkillDefinition` block, so I verified it myself: `git diff 0ca1fd6..HEAD` on
GatePassDbContext.cs shows exactly one added line and no removals touching
`skill_definitions`, and that line sits at 349 inside `ToTable("document_types")`.
Task 2: complete (commits 55bf3ac..d892efb, review clean after 2 fix rounds).
Task 2: minor (deferred): the duplicate-global-code test asserts
`DbUpdateException` without checking the index name; the re-review showed the
other unique index cannot fire for null tenants, so the test is sound as written.

Task 3: dispatched (implementer on sonnet — one pure function, but the boundary
cases are the whole point of it). BASE d892efb.
Task 3: implementer returned NEEDS_CONTEXT without committing, having found a
real contradiction between two rules I pinned in the dispatch.

**F5 — my own plan contradicted itself at `minimumValidityDays = 0`.** I pinned
both "a document expiring exactly today is `Valid`" and "`ExpiringSoon` is
`expiry <= today.AddDays(minimumValidityDays)`". With the default minimum of
zero, `today.AddDays(0)` is today, so an expiry of today satisfies the formula
and returns `ExpiringSoon`, failing the other rule. The implementer stopped with
9 of 10 tests passing rather than guess, which is the right call. Ruling: the
`ExpiringSoon` branch applies only when `minimumValidityDays > 0`. The parameter
is the caller declaring how much remaining life it demands, so a caller passing
zero has no soon-window and a card stays valid through its last day, while a
caller passing 30 correctly sees a card expiring today as `ExpiringSoon`. Both
pinned tests follow from that. Amended the plan's Step 3, and corrected its
expected count from 11 to 10 cases (3 theory rows plus 7 facts) — the
implementer was right that the brief's own list gives 10. Cost if wrong: a
caller wanting warnings with no minimum would need to pass a lead time
explicitly, which the expiry sweep does anyway.
Task 3: ruling applied and committed at 234af93 (DocumentValidityTests 10/10,
GatePass.Tests 636/636, IntegrationTests 79/79, E2ETests at its 12 known Docker
failures). Review dispatched over d892efb..234af93.
Task 3: complete (commits d892efb..234af93, review clean). The reviewer hand-traced
all five returnable states and both boundaries and found no off-by-one. Two ⚠️
items resolved by me: TDD order is evidenced by the implementer's own
NEEDS_CONTEXT report, which showed the compile failure and then 9 of 10 passing
before the ruling; the enum members were verified member by member in Task 1's
review.
Task 3: minor (deferred): no direct test for the other half of the F5 ruling —
expiry today with a positive minimum returning `ExpiringSoon`. The guard was
added for exactly that case, so the final review should add
`Evaluate(Verified, true, Today, Today, 30)` returns `ExpiringSoon`. Flagging it
as the first candidate of the final fix wave.
Task 3: minor (deferred): the status theory covers only `typeExpires = true`;
precedence over a null expiry is correct but unpinned.
Task 3: minor (deferred): a comment sits slightly above the outcome it explains.

Task 4: dispatched (implementer on sonnet — pure logic again, but it composes
Task 3, resolves scopes and ranks documents). BASE 234af93.
Task 4: implementer returned DONE_WITH_CONCERNS at 48a4378 (24 evaluator tests,
more than the brief's 16; GatePass.Tests 660 and IntegrationTests 79 green).
Four judgment calls raised, ruled on before review because the first changes
behaviour:

Ruling (concern 1, change required): a waiver matches a requirement when their
scopes are equal, **or** when the waiver is `Tenant`-scoped with `ScopeId` equal
to the person's `TenantId`. Exact-match-only fails closed, but it fails closed
in a way nobody can see: a manager who waives a document type for a person at
tenant level would find a site-scoped requirement still blocking, with no
feedback anywhere. A tenant-scoped waiver is the natural expression of "excuse
this person this document", so it has to cover the narrower requirements too.
The reverse — a site waiver against a tenant-wide requirement — is deliberately
not honoured in phase 1, because deciding it needs the site context that only
the gate path supplies; phase 3 owns it. Cost if wrong: a site-only waiver is
narrower than a manager might expect, which fails closed and is visible as a
still-blocking requirement.

Ruling (concern 2, accepted, carry forward): `UserRole` scope compares `ScopeId`
to `Role.ToString()`, the enum name. Carried into Task 6's dispatch and Task 5's
seed: role scope ids are stored as names, never integers. This matches the
repo's existing convention of persisting enums as strings.

Ruling (concern 3, accepted with a guard): `WorkType` requirements never apply,
because `PersonScope` carries no work type. That is correct for phase 1 — the
spec puts work-pass medical gating in phase 3 — but a configured `WorkType` rule
silently never applying is a trap. `Applicable` must skip them explicitly, with
a comment naming phase 3 as the owner, and a test must pin the behaviour so it
reads as a decision rather than an oversight.

Ruling (concern 4, accepted, no change): a non-portable document verified by
another tenant reads as `Pending`. That is accurate from this tenant's
viewpoint — it awaits *their* review — and the brief already tests it.
Task 4: all four rulings applied at 8918893 (29/29 evaluator tests, build clean
with the 20 warnings unchanged). Review dispatched over 234af93..8918893 on opus
rather than sonnet — this is the code that decides whether a worker passes a
physical gate, so it is the highest-risk diff in the plan.
Task 4: review returned Approved with no Critical or Important findings, but
three ⚠️ items. Two confirmed as real gaps, so they enter the fix loop:

**F6 — a stale "fit" certificate masks a current "unfit" finding.** The ordering
I pinned ranks `Barred` at 5, so a person holding a verified, current, `Unfit`
medical *and* a second still-valid medical document of the same type reports
`Valid`, satisfied, and passes the gate, with the unfit outcome never surfaced.
This is not hypothetical: a worker re-examined and found unfit routinely still
holds last year's annual certificate, in date. My ordering was wrong, not the
implementation. Ruling: unfitness is a fact about the person, not about a
document, so a verified and current `Unfit` medical document dominates every
other document of that type — `Barred` is decided before ranking, not within it.
Cost if wrong: a worker with a superseded unfit finding is blocked until it is
cleared, which fails closed and is visible as a stated reason.

**F7 — nothing ties a document to the person it belongs to.** I pinned
`DocumentCandidate` without a user id, so `Evaluate` matches on
`DocumentTypeId` alone and a loader bug would hand one person another's
documents and produce a confidently wrong pass. `PersonScope.UserId` was
accepted and never read. Ruling: add `UserId` to `DocumentCandidate` and throw
`ArgumentException` when any candidate's `UserId` differs from the person's. A
throw at a gate denies entry, so this fails closed and loudly rather than
silently passing. Task 6's loader also gets a test for it. Cost if wrong: a
caller mixing people now gets an exception instead of a wrong answer.

⚠️ 3 (the unchanged 20-warning claim) resolved by me: I re-ran the full build at
Task 1 and again here, and it reports 0 errors and the same 20 pre-existing
warnings in Infrastructure and E2ETests.

Ruling on scope of the fix round: Minors 1, 3, 4, 5 and 6 ride along, because
each concerns the ordering or the null-tenant path I am about to change, and the
implementer has that context now. The skill keeps minors out of the loop, so
this is a deliberate deviation recorded here rather than a silent one. Minor 5
is the reason: swapping ranks 0 and 1, or 1 and 3, would leave all 29 tests
green, which is too little cover for gate logic.
Task 4: minor (deferred): no test covers `RequirementScopeKind.Project`, whose
branch mirrors `Site`.
Task 4: minor (deferred): `Rank(Waived)` is a level no input can produce, since
waivers are applied after ranking; keeping it documents the full ordering.
Task 4: fix round 1/5 reported in at 0785b9b (GatePass.Tests 669/669,
IntegrationTests 79/79, build unchanged). The implementer flagged that Fix 1
makes `Rank(Barred)` unreachable and that it therefore changed an existing
ordering assertion — an expired document had been asserted to beat a current
`Barred` one — and renamed that test. That reads as the intended consequence of
the dominance ruling rather than a weakened test, but the scoped re-review is
adjudicating it explicitly rather than taking my word or the implementer's.
Also amended the spec and the plan to state the dominance rule and the owner
guard (gatepass-nextjs commit 25f79bb), so the documents match the code.
Task 4: fix round 1/5 (7 addressed, 1 open — the rewritten ordering test no
longer pins `Expired > Rejected` though its name claims it, so swapping ranks 4
and 6 would leave every test green; commits 8918893..0785b9b). The re-review
confirmed the dominance short-circuit runs before ranking, cannot fire for a
non-medical, unverified or expired document, and still reaches the waiver step,
and that the owner guard runs before any document is consulted.

**F8 — an unfit finding from another tenant is currently masked.** The
re-review's Minor: `Barred` is computed *after* the cross-tenant portability
downgrade, so a current `Unfit` medical verified by another tenant on a
non-portable type reads `Pending`, and a `Valid` document of the same type then
wins. Since my own seed makes every medical type non-portable, that is the
common case, not an edge one. Ruling: `Barred` is computed from the raw
`Verified` status, before the portability downgrade. Declining another tenant's
verification means declining their *compliance claim*; an unfit finding is not a
compliance claim, it is a safety signal about the person, and the same reasoning
that produced F6 applies across tenants. Cost if wrong: a worker is barred on
another tenant's finding until it is superseded or waived — it fails closed and
states its reason.

Ruling (how recovery still works, carried to Task 6): F6 and F8 would otherwise
trap a worker who was found unfit and later genuinely recovered, since the old
unfit document stays current until it expires. The resolution is supersession,
which Task 7 already sets on verify: **Task 6's loader must exclude documents
whose `SupersededByDocumentId` is set from the candidate list.** When the newer
"fit" certificate is verified, the unfit one stops being a candidate and the
worker clears. Carrying this into Task 6's dispatch with a test; without it,
dominance becomes a permanent block, so it is load-bearing rather than tidy.
Task 4: minor (deferred): with two current unfit documents of one type, the
reported `DocumentId` depends on enumeration order; the state is identical, so
only which id is cited varies.
Task 4: minor (deferred): `state is Valid or ExpiringSoon` relies on pattern
precedence that reads correctly but is easy to misread.
Task 4: fix round 2/5 reported in at 2362817 (35/35 evaluator tests with the
output tail quoted this time, build unchanged). Scoped re-review dispatched over
0785b9b..2362817. Spec and plan amended for F8 and the supersession dependency
(gatepass-nextjs commit a68cfd4).
Task 4: fix round 2/5 (2 addressed, 0 open; commits 0785b9b..2362817). The
re-reviewer confirmed the raw-status `Barred` check sits ahead of an unchanged
downgrade, keeps all four conditions, and leaves same-tenant behaviour
identical, and that the new cross-tenant test fails under the old code. It had
to assume the `Doc` fixture's defaults, which sit outside the diff, so I checked
them myself: `Doc` defaults to `Verified` with expiry `Today + 200`, and
`expired` is `Doc("e", expiry: Today - 1)`. Both assumptions hold, so the
discriminating test is genuine.
Task 4: complete (commits 234af93..2362817, review clean after 2 fix rounds, 35
evaluator tests).
Task 4: minor (deferred): the raw-status `Barred` check calls
`DocumentValidity.Evaluate` and the method calls it again at the end; a comment
or local helper would make the deliberate double call obvious.

Task 5: dispatched (implementer on haiku — the brief carries all 13 codes and
every flag value, so this is transcription plus five assertions). BASE 2362817.
Task 5: implementer returned DONE_WITH_CONCERNS at b3dbb54 (9 tests where the
brief asked for 5; full suite GatePass.Tests 680 and IntegrationTests 79 green).
Two of its four concerns I resolved myself before review:
- The warning baseline was unmeasured because its build was incremental. I
  deleted the Infrastructure and Tests obj directories to force a recompile and
  rebuilt: 20 warnings, 0 errors, unchanged.
- It asked for native review of its Arabic names. I read them: البطاقة المدنية,
  جواز السفر, بطاقة الإقامة, بطاقة العمل, اللياقة الطبية الدورية, سجل التطعيمات,
  فحص المخدرات والكحول and the rest are correct and idiomatic Omani usage. No
  change needed, and the client does not need to be asked.
The other two — self-chosen values for `Category`, names and the `Requires*`
flags, and a 365-day retention for `WORK_PERMIT`, `INSURANCE` and `OTHER` that
the spec never states — went to the reviewer to judge on the code's merits
rather than being pre-judged by me.
Task 5: complete (commits 2362817..b3dbb54, review clean — Approved with no
Critical or Important findings). The reviewer confirmed all 13 types field by
field, including that `EvidenceRequirement = None` is *derived* from
`Sensitivity = Health` rather than repeated per row, so the spec's central
privacy rule holds by construction. Both ⚠️ items resolved by me: `EntityBase`
generates `Guid.NewGuid().ToString("N")` per instance, so `BuildDefaults` yields
distinct ids; and I rebuilt the solution myself at 20 warnings, 0 errors.
Task 5: minor (deferred): `IdentityRetentionDays` (365) is reused for
`WORK_PERMIT`, `INSURANCE` and `OTHER`, so a change to identity policy would
silently move three unrelated types. Wants its own `DefaultRetentionDays`
constant with a comment that the spec is silent. Best candidate of this task's
minors for the final fix wave.
Task 5: minor (deferred): `EvidenceRequirement.Required` is derived for every
non-Health type including `OTHER`, where `Optional` is arguable.
Task 5: minor (deferred): the test's expected code list restates the production
list, and nothing asserts `IsActive` or distinct `SortOrder` values.
Task 5: minor (deferred): a 17-element tuple in the repeatability test's
projection is brittle; `BeEquivalentTo` with exclusions would be sturdier.
Task 5: minor (deferred): the 17-parameter `Type` helper is at the edge of
readable.
Task 5: note for the client, not a defect: `DRUG_ALCOHOL` is seeded as
non-expiring, so its retention clock runs from supersession rather than an
expiry date, and `CIVIL_ID` requires neither issuer nor issue date. Both are
defensible and neither contradicts the spec, but they are catalog choices the
client may want to set differently.

Task 6: dispatched (implementer on sonnet — first service touching EF, and it
carries the load-bearing supersession exclusion). BASE b3dbb54.
Task 6: implementer returned DONE_WITH_CONCERNS at 046a110 (9 service tests;
full suite GatePass.Tests 689 and IntegrationTests 79 green, build unchanged).
Six concerns, ruled on before review:

Ruling (concern 2, change required): populate `PersonScope.ProjectIds` from
`ProjectMembers` (`UserId` → `ProjectId`), which is one `AsNoTracking` query — I
checked, the DbSet and both columns already exist. Leaving it empty would make
`Project`-scoped requirements silently never match, which is exactly the trap I
ruled against for `WorkType` in Task 4; the difference is that project
membership is readily available whereas a work type is not, so there is no
reason to defer this one. Cost if wrong: membership via an active work pass
rather than `ProjectMembers` is not counted, which fails closed.

Ruling (concern 6, change required): add a test for a `JobPosition`-scoped
requirement resolved through `WorkerEmployment`. That path has no cover at all,
and it is the scope most likely to carry real client rules.

Ruling (concern 1, accepted): `NotFoundException` does not exist in this repo —
my constraint named a type that was never there. `KeyNotFoundException`, as
`WorkerDocumentService` already uses, is correct.

Ruling (concern 3, accepted, no change): `PersonDocumentDto` exposing `Number`
is right. Only `NumberHash` was to be withheld. A certificate number is
metadata, and the spec makes metadata visible to anyone who may view the person;
it is the clinical *file* that is restricted, and `Health` types do not store
one at all.

Ruling (concern 4, accepted, no change): `ListAsync` including superseded
documents while `GetComplianceAsync` excludes them is the correct distinction.
The spec keeps a superseded record as history, so the documents tab should show
it; only the compliance decision must ignore it.

Ruling (concern 5, accepted for phase 1): waivers are filtered to the person's
own tenant. Strictly a waiver should be scoped to the tenant whose requirements
are being evaluated, but the evaluator's tenant-blanket path already keys off
`person.TenantId`, so this is at least self-consistent. Cross-tenant waiver
semantics join the site-versus-tenant waiver asymmetry as phase 3 work.
Task 6: both changes made at bf3ad88 (11/11 service tests). Review returned
Approved with no Critical findings; it verified the supersession asymmetry, that
`NumberHash` leaves in no projection, that every claimed scope is populated from
the specified source, that all reads are `AsNoTracking` projections with a fixed
query count, and that the service re-decides nothing the evaluator decides. It
also judged the unrequested ended-employment assertion coherent and worth
keeping.

**F9 — a finished project's requirements never stop applying.** The reviewer's ⚠️:
`ProjectMember` has no end date and the loader checked neither the project's
`Status` nor its validity window, so a requirement attached to a project that
ended two years ago would block the worker forever, in a place nobody would
think to look. Ruling: count a membership only when its `Project` is `Active` and
`now` is inside `ValidFromUtc`..`ValidToUtc` — both fields exist, I checked.
Cost if wrong: a requirement from a paused project stops applying, which fails
open for that one scope; the tenant, site, role and job-position scopes are
unaffected.

Task 6: fix round 1/5 dispatched — the project-lifecycle filter plus the two
Important coverage gaps (that `ListAsync`'s deliberate superseded-inclusion has
no test, so flipping it would keep every test green; and that the waiver path,
whose selection this service alone decides, is wholly untested).
Task 6: I ran the full suite independently at bf3ad88 rather than taking the
second commit's claim on trust: GatePass.Tests 691/691, IntegrationTests 79/79,
E2ETests 12/12 failing for want of Docker. The 691 is the implementer's 689 plus
the two tests that round added, so the numbers reconcile.
Task 6: minor (deferred): documents are queried twice on the gate path, the
second time loading files, notes and the type join the gate does not need.
Task 6: minor (deferred): all active requirements are loaded across tenants and
filtered in the evaluator; cheap now, worth pre-filtering as the table grows.
Task 6: minor (deferred): the presentation dedup re-states "satisfied" as
`Valid or ExpiringSoon or Waived`, a second copy that would silently go stale if
the evaluator gained a state. The clean fix is a `Satisfied` flag on
`RequirementOutcome`, which touches Task 4, so it belongs to the final wave.
Task 6: minor (deferred): two employments sharing a `ValidFromUtc` yield an
arbitrary job position; wants a `ThenBy`.
Task 6: minor (deferred): `CanViewFiles` has no test for a `Health` document.
Task 6: minor (deferred): the employment query drops rows with a null
`JobPositionId` before choosing the current row, so a newer current employment
without a position falls back to an older one that has one.
Task 6: fix round 1/5 (2 addressed, 1 partial — the project filter and the
superseded asymmetry test are verified, but two of the four new waiver tests
pass whether or not the service filters anything, so they pin the evaluator
rather than this service; commits bf3ad88..ea4d5ed, 16 service tests).
Task 6: fix round 2/5 dispatched — rewrite the other-tenant and revoked waiver
tests to use a waiver the evaluator would accept if it reached it, so the
service's own filter is the only thing that can change the outcome. Told the
implementer to say so rather than contrive a test if the evaluator's duplicate
`!IsRevoked` check makes a service-only assertion impossible: defence in two
layers is not a defect, and I would rather record that than keep a test that
misleads about what it covers.
Task 6: fix round 2/5 (1 addressed, 0 open; commits ea4d5ed..743c124). The
implementer proved the other-tenant test by mutation — removed the service's
`w.TenantId == user.TenantId` clause, saw exactly that test fail 1-of-16, then
restored the service — and the re-reviewer confirmed by reasoning that the
committed test does depend on that clause, and that the diff touches only the
test file so no mutation was left behind. For the revoked case it reported
honestly that a service-only assertion is impossible, since the service also
passes `IsRevoked` and the evaluator rejects it independently; the test is now
documented as a two-layer end-to-end check, which is the outcome I invited.
Task 6: complete (commits b3dbb54..743c124, review clean after 2 fix rounds, 16
service tests).

Task 7: dispatched (implementer on sonnet — the write service: create, attach,
submit, review, supersede, with 14 specified tests). BASE 743c124.
Task 7: implementer returned DONE_WITH_CONCERNS at c5a29f1 (14/14 new tests;
full suite GatePass.Tests 710 and IntegrationTests 79 green, build unchanged).
It also ran mutation checks unprompted on the two load-bearing behaviours:
removing the supersession assignment fails the supersede test, and flipping the
cross-person duplicate check fails the duplicate-number test. Both restored.

Correction to my own dispatch: I told it the baseline was 707 unit tests. It was
696 — 691 at Task 6's bf3ad88 plus the five Task 6 added afterwards. 696 + 14 =
710, so the numbers reconcile and nothing is missing. My figure was wrong, not
its count.

Noted, not fixed: it wrote the implementation before the RED run, then moved the
file aside to produce the compile failure, and said so in its report. That is a
TDD violation and I would rather it had not, but the two behaviours that matter
were each proved by mutation, which is the evidence TDD exists to produce. Not
worth redoing; recorded because the honesty is what makes it assessable.

Ruling (accepted, no change): a person may manage their own documents without a
scope check. Self-service registration requires it, and the spec already makes
the person themselves a reader of their own record. Reviewing stays separately
gated to Admin, OperatorAdmin and Manager.

Ruling (change required): audit entries used `AuditEntityType.WorkerProfile`
because no `PersonDocument` value existed. Add `PersonDocument = 47` — the enum
is a flat additive list and this costs nothing. Mislabelling these entries would
corrupt the audit trail for exactly the records the medical access rules exist to
protect, which is the one place a vague label is least acceptable.

Ruling (change required): `RegistrationChannel` was left at "SelfService" for
every creator. Set it from who is acting — "SelfService" when the creator is the
person, "Assisted" otherwise — since the field exists precisely to distinguish
them, and a contractor admin uploading on a worker's behalf is the common case.

Ruling (change required, raised by me): rejected documents can be edited and
resubmitted, which is right — a rejection must not dead-end — but resubmission
must clear the previous decision's `ReviewStatus`, `ReviewedByUserId`,
`ReviewedAtUtc` and `ReviewNote`. Carrying a stale rejection note on a
resubmitted document would show a reviewer someone else's verdict on evidence
they have not seen.
Task 7: all three changes made at 220667c, this round genuinely test-first (RED
was `Failed: 2, Passed: 14`), 16/16 service tests. I ran the full suite
independently at 220667c: GatePass.Tests 712/712, IntegrationTests 79/79,
E2ETests 12/12 failing for want of Docker. Review dispatched over
743c124..220667c on opus — this is the write path for health data and it owns
supersession, and the first round's disclosed TDD violation means the tests
themselves need harder scrutiny.
Task 7: minor (deferred): the new `AuditEntityType.PersonDocument` value has no
dedicated test and is covered by the build alone.
Task 7: review returned Approved with no Critical findings. It confirmed by
reading that the clinical-file refusal precedes any storage call on the only
attachment path, that supersession is correctly scoped by four clauses and
actually persists (the query is tracked), that uniqueness runs cross-person
only, and that authorization precedes every state change on all six methods. It
also verified both mutation claims by reasoning. Three Important findings, all
test coverage of load-bearing paths, which matters more than usual because the
first round's tests were written against finished code.

**F10 — the privacy defence is keyed on the wrong field.** The reviewer's ⚠️:
`AttachFileAsync` refuses on `EvidenceRequirement == None`, not on
`Sensitivity == Health`. The seed couples them, but `DocumentType` is
config-as-data and Task 11 adds operator-admin create/update endpoints for it,
so an admin could save a `Health` type with `Required` and make the clinical
file storable. Ruling: the spec already says a `Health` type can never be set to
`Required` — enforce that invariant in Task 11's catalog write path, with a
test, and carry it in that dispatch. `Health` + `Optional` stays legitimate,
since the spec allows a client to insist on holding the certificate. Also
tightening Task 7's guard to deny-by-default now. Cost if wrong: an operator
cannot configure a mandatory-evidence health type, which is the outcome the spec
wants anyway.

⚠️ resolved by me: nothing mirrors `AuditEntityType`'s numbering — no numeric
cast in the backend, no client-side copy — and the column is stored as a string,
so `PersonDocument = 47` is safe. The 20-warning baseline I had already
re-measured myself.

Ruling (accepted, recorded): supersession is review-order, not date-order, so
verifying a back-dated document supersedes a newer verified one. Stronger than
the brief's wording and correct for the recovery case the mechanism exists for;
worth knowing when the review inbox is built in phase 2.

Task 7: fix round 1/5 dispatched — the three Important coverage gaps, plus four
cheap correctness items: the audit `EntityId` now carries the document rather
than the person, a deny-by-default evidence guard, length validation so
over-long input returns a bad request instead of a provider error, and a stale
doc comment on `DocumentType` that still claims a unique index enforces
uniqueness.
Task 7: fix round 1/5 (7 addressed, 0 open; commits 220667c..5577ea5, 19 service
tests). The implementer ran six mutation checks and the re-reviewer verified all
six hold by reasoning from the committed tests, with the caveat that three rest
on bare `ThrowAsync<BadRequestException>` assertions, so another
`BadRequestException` path on the same input could mask them.
Task 7: complete (commits 743c124..5577ea5, review clean after 1 fix round).
Task 7: minor (deferred): the implementer called three changes untestable; the
re-reviewer showed they are merely untested — the `IssuingCountry` guard needs
one more case, the audit `EntityId` needs a ten-line capturing `IAuditLogWriter`
fake, and the fail-closed guard can be reached by persisting an out-of-range
enum value. Worth the final wave, since the audit one pins where health-data
access is recorded.
Task 7: minor (deferred): several tests assert only an exception type where
their siblings pin a message substring, which is what weakens three of those
mutation checks.
Task 7: minor (deferred): the review-note guard measures the trimmed value; if
the stored note is not also trimmed, exactly 1000 characters plus trailing
whitespace could still exceed the column.
Task 7: minor (deferred): hex case differs between `NumberHash` (upper) and file
`Sha256` (lower) in one class; the upload buffers into an unbounded
`MemoryStream`; the `Service` test helper hard-codes `UserRole.Admin`; the
privacy test does not assert the file store stayed empty.

Task 8: dispatched (implementer on sonnet, review to go to opus — this is the
gate on clinical files, and it carries the plan's own Review Focus item that an
unlogged refusal loses the audit trail the medical rules exist for). BASE
5577ea5.
Task 8: implementer returned DONE_WITH_CONCERNS at 1c9627b with 24 new tests,
genuinely RED-first this round (the RED was a compile failure on the missing
service). Full suite GatePass.Tests 739 and IntegrationTests 79 green. Its build
showed 1 warning because it was incremental, so I rebuilt: 20 warnings, 0
errors, unchanged.

**F11 — role alone is not authority to open a clinical file.** The implementer's
own first concern: `OpenAsync` applied the role rules with no scope check, so an
`OperatorAdmin` belonging to one tenant could open the clinical files of a person
belonging to another. This is reachable precisely because `PersonDocument`
deliberately has no `TenantId` — the credential follows the person — and the spec
compensates by saying a tenant's staff see a person's documents only while that
person is attached to them. Ruling: add `IAccessScopeResolver.EnsureUserInScopeAsync`
on the document's owner, as the read path already does so the two cannot
disagree, keeping the role rules as an additional gate. The scope refusal must be
logged and distinguishable in `Purpose` from a role refusal — an out-of-scope
attempt on a clinical file is exactly what someone would go looking for
afterwards. Cost if wrong: an admin whose scope is narrower than expected is
refused a file, which fails closed and is logged.

Ruling (accepted, no action): no controller endpoint belongs in this task, since
Task 11 owns the HTTP surface; and the denial row would be lost if a caller
rolled back its own transaction, which no caller does today.
Task 8: scope gate added at 2c218a7, 26 tests across the two files. `Purpose`
now prefixes `Granted`, `Denied-Role` and `Denied-Scope`, so a role refusal and
an out-of-scope refusal are distinguishable in the log. Mutation check: removing
the `Normal` clause from the ContractorAdmin/Supervisor branch failed four
tests, including `ContractorAdmin_CannotViewHealthFiles`, then was reverted. I
ran the full suite independently at 2c218a7: GatePass.Tests 741/741,
IntegrationTests 79/79, E2ETests 12/12 failing for want of Docker; and rebuilt
at 20 warnings, 0 errors. Review dispatched over 5577ea5..2c218a7 on opus, asked
to derive the role-by-sensitivity matrix from the code and compare it row by row
rather than trusting the tests.
Task 8: complete (commits 5577ea5..2c218a7, review clean — Approved, no Critical
or Important findings). The reviewer derived the matrix from the code and
confirmed all 14 rows against the pinned list including the unknown-role and
unauthenticated defaults, that both gates sit on the only path to the bytes
(it grepped for a second reader and found none), that both placeholders now call
the one shared function so the DTO flag and the enforcement cannot drift, and
that the log row persists before each throw with role and scope denials
distinguishable. It verified the mutation claim as exactly four failures.

Ruling (reviewer's interpretation item 9, accepted): a `Security` or `Inspector`
user can open their own `Health` file, because the owner clause precedes the
role switch. That is correct — a gate guard is also a person with their own
medical certificate, and the spec's owner clause is unconditional. The behaviour
is unpinned either way, so the final wave should add the owner case to
`Gate_CannotViewAnyFiles`.

Task 8: minor (deferred): the log write calls `SaveChangesAsync` on the shared
scoped context, so it flushes any other pending changes and would be lost inside
a caller's rolled-back transaction. Latent — nothing calls `OpenAsync` until
Task 11 — but the right fix is an independent sink.
Task 8: minor (deferred): an unknown `fileId` throws before any logging, so
id-probing leaves no trail, and Forbidden-versus-NotFound is an existence oracle.
Task 8: minor (deferred): an anonymous attempt records an empty actor rather
than a sentinel; `AtUtc` is read inline and untested; the Worker × Health
non-owner cell and the second `Denied-Role` row's purpose are unasserted; and a
static mutable field plus a dead parameter in the test helper.

Task 9: dispatched (implementer on sonnet — the waiver service, small and
well-specified). BASE 2c218a7.
Task 9: implementer returned DONE_WITH_CONCERNS at 757190c, genuinely test-first
(RED was CS0246 on the missing service), 9 tests where the brief asked for 7,
full suite GatePass.Tests 750 and IntegrationTests 79 green. Mutation checks:
widening the 30-day cap fails the cap test, and adding `ContractorAdmin` to the
role gate fails the refusal test. I confirmed the warning baseline myself with a
forced recompile: 20 warnings, 0 errors.

**F12 — a cross-tenant waiver is a silent no-op.** The implementer's own
concern: the read path only surfaces a waiver to the tenant that granted it, so
when the granter's tenant differs from the person's, a manager can grant a
waiver, see it saved, and have it do nothing — the worker still blocked, with no
indication why. Ruling: refuse that grant with a `BadRequestException` naming
the mismatch. The stored `TenantId` stays the granter's, since a waiver is one
tenant excusing its own requirement; this only stops one being written that can
never apply. Left the null-tenant cases to the implementer with instructions to
pick whichever fails closed and justify it. Cost if wrong: a legitimate
cross-tenant waiver becomes impossible, which is the status quo in effect
anyway, only now visible.

Ruling (accepted, no action): `ListActiveAsync` role-gated to the same three
roles — unasked for and right, since a list of who is running on a waiver is as
sensitive as the power to grant one. And the in-memory validity window, which
matches the read path's SQLite workaround; noting that this one spans a tenant's
rows rather than one person's, so it is the first of these to watch as the table
grows.
Task 9: cross-tenant refusal added at c769400, 12 tests, both null cases
fail closed (person with no tenant → `BadRequestException`; granter with no
tenant → `ForbiddenException`, now pinned).

**Task 9 review: Needs fixes. No Critical. Two Important findings, both still
OPEN — this is where work stopped.** Every stated safety limit was verified to
hold: the role gate, the mandatory reason, the 30-day cap (direction correct,
past dates caught, exactly-30 allowed), the granter-sourced `TenantId`, the
non-deleting tenant-filtered revoke, and both audit events using the exception
id as `EntityId`. Both mutation claims verified. Rulings for whoever resumes:

**OPEN 1 — non-Tenant scope ids are unvalidated, which is the same
save-then-do-nothing defect F12 closed for tenants.** Verbatim: "`scopeKind` is
never checked with `Enum.IsDefined`, so `(RequirementScopeKind)99` saves.
`WorkType` is excluded from the evaluator, so a `WorkType` waiver can never
apply in phase 1. `Site`, `Project` and `JobPosition` ids are accepted whether
or not they exist or belong to the tenant. `UserRole` takes free text, yet the
evaluator compares it against `role.ToString()`. Such a waiver saves
successfully, is audited and listed, and the worker stays blocked with no
explanation." Ruling: fix it. Reject undefined kinds and `WorkType` outright,
validate `UserRole` against the enum names, and check that a `Site`, `Project`
or `JobPosition` id exists within the granting tenant. The whole point of a
waiver is that someone can see why a worker is passing; one that silently does
nothing is worse than a refusal.

**OPEN 2 — the audit write happens after `SaveChanges`, so a grant can
half-apply.** Verbatim: "If `WriteAsync` throws, the waiver is live and
unaudited while the caller sees a failure and may retry, creating a duplicate.
`auditLogWriter` is also optional. A DI misregistration would silently drop the
audit trail, and this task exists to make waivers attributable." Ruling: fix it.
Write the audit inside the same unit of work, and make `IAuditLogWriter`
non-optional in this service's constructor. Check whether
`WorkerClearanceService` has the same shape; if it does, note it for the final
review rather than widening this task.

Task 9: minor (deferred): the cross-tenant message reveals that a person exists
in another tenant, where a missing id says "not found" — an existence oracle;
the scope-id comparison is ordinal where the evaluator's may be
case-insensitive (fails safe); nothing prevents duplicate overlapping waivers or
a user waiving their own requirement; the tests share one tracked `DbContext`
so stored state is pinned only indirectly; and several cases assert neither a
message nor a row count.

Task 9: fix round 1/5 reported in at 916e968, RED-first with 7 failing, 19/19
tests. Scope validation rejects undefined kinds and `WorkType`, requires an
exact `UserRole` enum name, and checks `Site`, `Project` and `JobPosition` ids
exist *within the granting tenant* (all three carry a `TenantId`). Audit is now
staged into the same unit of work with `IAuditLogWriter` required, proved by two
tests that make the writer throw and assert no row survives a grant and that a
revoke stays live. Scoped re-review dispatched over c769400..916e968.
Task 9: carried to the final review: `WorkerClearanceService` has the same
post-save audit shape with an optional writer. The implementer correctly left it
alone rather than widening this task.

## OWNER DECISION, 2026-11-15: production data may be reset

The owner confirmed the production data is still insignificant and may be
reset. This removes the largest remaining risk in the plan, and Task 12 was
re-scoped accordingly (gatepass-nextjs commit c317b6c):

- **Dropped:** the whole person-data backfill — identity merge across the three
  stores, `UserCertificate` conversion, `WorkerDocument` conversion, competency
  repointing, the medical-files report, the unmapped report, idempotency over
  person data, and the rehearsal against a copy of the production database.
  That was the riskiest work in the plan and it now buys nothing.
- **Kept, because dropping it would fail open:** configuration conversion.
  `SiteCertificateRequirement` and `JobPositionCredentialRequirement` are the
  only record of what a site or job demands, and Task 10 rewires the gate and
  clearance onto `DocumentRequirement`. Convert nothing and every certificate
  requirement silently becomes "nothing required" — a fail-open on the exact
  path this phase exists to tighten. So: one `Competency` `DocumentType` per
  `CertificateType` keeping its id, and one `DocumentRequirement` per row of the
  two requirement tables.
- **Added:** the seeder must produce the catalog and the requirement rows
  directly, so a reset production and a fresh developer database both come up
  requiring the right things rather than depending on legacy configuration
  having been converted.
- **Deploy consequence the plan cannot do:** the Nama demo tenant (28 users
  across every role) was seeded through the API, so after the reset it has to be
  re-created the same way.

Task 9: fix round 1/5 (2 addressed, 0 open; commits c769400..916e968, 19 tests).
The re-reviewer confirmed every scope kind has both a refusal and a passing
test, that `Site`, `Project` and `JobPosition` each carry a `TenantId` so all
three really are tenant-checked rather than existence-checked, and that the
atomicity tests read through `AsNoTracking` so they pin the ordering rather than
mere exception propagation.
Task 9: complete (commits 2c218a7..916e968, review clean after 1 fix round).
Task 9: minor (deferred, checked): a `Site`, `Project` or `JobPosition` with a
null `TenantId` is now refused for every tenant. I checked the seeders — every
seeded site carries a tenant (`GatePassSeeder.cs:158`, the Nama demo and pilot
seeds all set one) — so this is theoretical rather than live, and it fails
closed. No test covers it.

**F13 — the old clearance's hard-coded identity rule would vanish.**
`WorkerClearanceService` required a verified identity document for every worker
in code, regardless of configuration. Task 10 replaces that with whatever
`DocumentRequirement` rows say, so without a seeded rule clearance would
silently stop requiring identity at all — a fail-open on the very path this
phase tightens. Ruling: Task 12 seeds a `Tenant`-scoped `Blocking` `CIVIL_ID`
requirement per tenant, in both the conversion and the fresh-database path, with
a test naming it as the replacement for the hard-coded rule (plan commit
9d651ed). Task 10's own tests seed their requirement rows directly, since Task
12 has not run yet.

Task 10: dispatched (implementer on sonnet, review to go to opus — it modifies
three existing production services with their own passing tests, and it is the
task that actually closes the expiry hole). BASE 916e968.
Task 10: implementer returned DONE_WITH_CONCERNS at 0c1f8c7 with 8 concerns, 770
unit and 79 integration tests, and a mutation check confirming that letting
expired documents pass is caught. It changed existing tests only by moving their
seeding to the new model and updating messages, listing each — none deleted or
weakened.

**MACHINE PROBLEM, not a code problem.** Free disk fell to about 150 MB during
that task. The implementer ran the final suite with
`Storage__MinimumFreeBytes=1000` because the normal 1 GB upload reserve fails
four upload tests on a full disk, so its green result is not under default
config. It also cleared NuGet caches and truncated a 194 MB `api.log`. I then
deleted 346 MB of bin/obj, stopped the stale local dev API (PID 48409, running
3 days, writing that log) and cleared the SQLite WAL, which only brought free
space to 652 MB — because the real consumer is elsewhere:
`~/Library/Containers/com.docker.docker/Data/vms` is **40 GB**, plus 9.2 GB in
`~/Library/Caches` and 6.7 GB in CoreSimulator. Docker is also the thing that
has been hung since the earlier deploy. I did not touch it: it holds another
project's containers and that is the owner's call.

Resolved: I re-ran the full suite myself under **default** configuration, with
no storage override — GatePass.Tests 770/770, IntegrationTests 79/79, and the
same 12 E2ETests failures, every one of them a Postgres/Docker test by name
(`…OnPostgres`, SmartAccess, Surveillance, SiteOperatingMode, Mobile,
E2EBaselineBootstrap). So the override was a transient workaround for the moment
disk hit 150 MB, not a masked failure. Free space also recovered to 1.5 GB once
the stale process exited and APFS reclaimed, so the four upload tests pass
normally again.

**F14 — the gate decision, access-request screening and permit-to-work still
read the legacy certificate tables, and will break.** Task 10's brief covered
`ScanService.Certifications` (the display rows), not `ScanService.cs:110`, which
computes `missingCertificates` from `site.CertificateRequirements` against
`user.Certificates` and at line 306 turns a non-empty list into a
`GateDecisionReason.MissingCertificates` **denial**. `AccessRequestService.cs:275`
and `PermitToWorkService.cs:269` do the same. These do not merely stay
unimproved: the write path now records competency evidence as a
`PersonDocument`, so `UserCertificate` stops gaining rows, and a worker
registered after this phase has an empty `user.Certificates` — every site
requirement reads as missing and the gate **denies them entry**. Fails closed,
but closed for everyone new. Ruling: this is a gap in my plan, not in the
implementation. Added Task 13a (plan commit df7c087) to rewire all three onto
`GetComplianceAsync`, keeping `GateDecisionReason.MissingCertificates` as the
reason code so client contracts are untouched. Note the gate already enforced
certificate *expiry* (`ExpiresAtUtc >= now` at ScanService.cs:110) — it was
clearance that did not, so the headline defect this phase fixes is unchanged.

Task 10: review returned Needs fixes — no Critical, six Important. It verified
the implementer's central claim test by test: **no existing assertion was
deleted or loosened**, the diff removes zero `[Fact]` lines, and one helper was
actually strengthened. It also reconciled the test-count puzzle — the diff adds
exactly 10 facts and removes none, so my quoted baseline of 762 was wrong, not
the implementer's 770. The expiry mutation is caught by three full-string
assertions, and the sweep's idempotency genuinely holds through an atomic claim
UPDATE inside one transaction (the query-level filter turns out to be
load-bearing for batch starvation instead, which the implementer had right).

Fix round 1/5 dispatched with all six, two of them sharing one change:

**F15 — the compliance read inherited the caller's visibility, in two harmful
ways.** Clearance passed a null site, which resolves to the *reviewer's* visible
sites: "an Admin who can see every site is blocked by a Site-scoped Blocking
requirement at a site the worker will never enter, while a Manager scoped to one
site clears the same worker with the same documents." Non-determinism in a
safety decision is worse than being consistently wrong. And the gate swallowed
the `ForbiddenException` into `([], [])`, so an unreadable compliance state read
as a compliant one — including blanking `Restrictions`, meaning a worker whose
medical says "no work at height" showed a guard a clean screen. It also
regressed a case that worked: an Inspector verifying a contractor worker at
another operator's site. Ruling: add an explicit scope mode to the read —
`CurrentUserVisibility` (default, unchanged), `PersonOnly` (clearance: tenant,
role, job position, projects; no sites at all) and `SiteGate` (the gate: site
scope enforced, person scope not, because at a gate authority comes from the
site being scanned). Plus an additive `ComplianceVisible` flag so empty can
never pass for compliant, and the scan tests must build their compliance read
from the same actor as the service — the harness injected a global admin into
all 13 scan constructions, which is why no test could see any of this.

**F16 — clearance now fails open where code used to fail closed.** With no
`Blocking` requirement configured, a worker holding nothing clears. The seeded
rule covers seeded tenants only; a later tenant, a deleted row, or a
`DocumentType` flipped to `IsActive = false` each silently removes the identity
gate. Ruling: refuse clearance outright when the compliance view has no
`Blocking` requirement at all — a tenant with nothing configured is a
misconfiguration, not a tenant where everyone is compliant.

Also in the round: the gate screen silently stopped returning `WorkRestriction`
(which the web client renders), `IssuedAtUtc` (impossible — `RequirementStatusDto`
has no `IssueDate`) and every held-but-not-required credential; the scan
re-derived applicability from an unfiltered `DocumentRequirements` read, letting
another tenant's role rule mark this tenant's scan row as required; and the
sweep's shortlist lost its SQL `Take`, materialising the whole horizon
tenant-wide. Three minors ride along: the `_ => "missing"` default arm that would
describe any future state to a refused worker as "missing", an unused parameter,
and two test names that no longer match their assertions.

Task 10: minor (deferred): two near-duplicate label switches; the waiver lapse
date fetched by a second query when it could ride on the DTO; restrictions
harvested only from valid requirements, so a `FitWithRestrictions` document with
an empty list surfaces nothing; the sweep's `MinimumValidityDays` read ignores
scope, so its lead-time test would pass with any scope; no test pins the sweep's
new `Verified` filter, which silently changed behaviour (the old sweep alerted on
unverified certificates too); `WorkerProfile.IdentityExpiryAlertRaisedAtUtc` is
now written by nothing; the web client shows `Expiring soon` and `Waived` as red
failure badges and counts `Waived` as awaiting verification; and the old
`"Not yet valid"` status (a future issue date) has no successor.
Task 10: fix round 1/5 — all six Important findings and three minors fixed at
3a0b4c3 (778 unit, 79 integration, 20 warnings, default config, no storage
override). Mutation check: switching clearance back to `CurrentUserVisibility`
fails the new reviewer-determinism test.

**F17 — two authorisation gates disagreeing.** Round 1 gave `SiteGate` an
`EnsureSiteInScopeAsync` check, but `ScanService` already decides who may scan
where and deliberately exempts Admin, Manager, Supervisor and Inspector from
site visibility. So the scan authorised the operation and then could not read
the data it had just authorised: the Inspector-at-another-operator's-site case
went from silently empty to honestly "unreadable", which is better but still
broken. Ruling: `SiteGate` enforces neither person nor site scope — it trusts
the caller, because the caller is the gate and has applied its own policy, and
its only job is deciding which requirements apply (the person's own scopes plus
the one named site). Documented on the enum member so nobody tightens it back.
`PersonOnly` keeps its person-scope check, since clearance is not a gate and has
no site to derive authority from. Cost if wrong: the read trusts its caller, so
a future caller that forgets to authorise would get data it should not — hence
the comment on the member.

Task 10: fix round 2 at 760c457. `SiteGate` now enforces neither check and the
reasoning is on the enum member; the out-of-scope Inspector scan returns the
worker's documents and the "No work at height" restriction again. The
implementer also **deleted** the `ComplianceVisible` flag it had added in round
1, on the grounds that no scan path can refuse the read any more, so a flag that
can never be false would mislead — which is what I asked it to do if that turned
out to be the case, rather than keep a test that cannot fail. The re-review is
checking that claim specifically, since if any path can still refuse, removing
the flag re-opens the finding.
Task 10: I ran the full suite independently at 760c457 under default
configuration: GatePass.Tests 778/778, IntegrationTests 79/79, the same 12
Docker E2E failures. Free disk holding at 1.5 GB.
Task 10: fix rounds 1-2 (9 addressed, 0 open; commits 0c1f8c7..760c457). The
re-reviewer verified every finding at named lines, confirmed the
`ComplianceVisible` deletion was sound by checking that no `SiteGate` path can
throw `ForbiddenException` at all, confirmed the Inspector test genuinely
exercises the previously-regressed path (the inspector's assigned site is the
*other* site, so round 1's check would have thrown), and confirmed the
determinism mutation is caught non-accidentally. No existing test was weakened
across either round and no deferred item was touched.
Task 10: complete (commits 916e968..760c457, review clean after 2 fix rounds).

**Operational precondition, from the re-review's first minor — this one is
load-bearing and the owner should know.** Findings 1 and 4 together mean
clearance refuses outright when a worker has no `Blocking` requirement that
matches their *own* scopes. Two ways to hit that: a tenant whose only Blocking
requirements are `Site`-scoped (since `PersonOnly` drops site scope), and a
worker whose `TenantId` is null (which matches no `Tenant`-scoped rule, and
existing seed data does allow such users). Both fail closed, which is the right
direction, but it makes Task 12's seeded `Tenant`-scoped `CIVIL_ID` requirement
a hard prerequisite rather than a convenience, and it means users must carry a
tenant. Flagging it rather than softening the gate.

Task 10: minor (deferred): `SiteGate` is an authorisation-bypass primitive on a
public Application interface, bound to the gate only by its comment —
accidental positional use is impossible and there are two callers, so this is a
future-maintenance risk; a non-required document's medical restriction text
reaches the gate screen without a `DocumentSensitivity` check (files are still
gated), which is defensible for standing conditions but should be a conscious
decision; `"Not required"` rows sort into the problems-first half of the guard's
list; the `CurrentUserVisibility` doc comment claims an API caller that does not
exist yet; and a second held document of a *required* type is still invisible.
Task 10: carried to the final review: `ScanService.Certifications.cs` keeps a
now-unused `using Microsoft.EntityFrameworkCore;`, and the warning count moved
19 → 20 between rounds, which may be that same dereference reappearing. Diff the
two warning lists before merge.

Task 13a: dispatched (implementer on sonnet — the three legacy compliance
consumers; the gate's allow/deny, access-request screening and permit-to-work).
BASE 760c457.
Task 13a: implementer returned NEEDS_CONTEXT without changing anything, and was
right: **my brief named the wrong file.** The real gate is
`GatePass.Infrastructure/Services/Gate/Rules/CertificatesRule.cs`, behind the
`UnifiedScanDecision` feature flag, which I confirmed is `defaultEnabled: true`
at `ScanService.cs:275`. So `ScanService.cs:110` is only the fallback branch, and
`PermitToWorkService` merely reads what the rule puts on the context. Patching
the files I named would have left the live gate untouched while looking fixed.

**F18 — a second silent fail-open, which I found while checking.**
`Gate/Rules/IdentityDocumentRule.cs` decides on
`context.User.WorkerProfile?.IdentityExpiresAtUtc`, and its `AppliesTo` returns
false when that column is null. Nothing writes that column any more, so for
every worker registered after this phase the rule does not apply at all and
**identity expiry stops being checked at the gate** — worse than the certificate
one, since identity is the single document the old clearance insisted on. Added
to Task 13a: rewire it from the compliance view's `Identity` requirements, with
a test that an expired Civil ID document denies entry.

**F19 — rewiring the gate naively would have loosened it.** The legacy rule
counts a certificate expiring inside `MinimumValidityDays` as *missing* and
denies; the new model computes that same case as `ExpiringSoon`, which the
evaluator counts as *satisfied*. A certificate expiring in three days against a
thirty-day minimum is denied today and would have been allowed after the change.
Ruling: for the gate's decision, satisfied is `Valid` or `Waived` only, so
`ExpiringSoon` denies. The evaluator's own `IsSatisfied` and everything clearance
uses stay as they are — the asymmetry is deliberate, because clearance is an
onboarding assessment where a document expiring next week should not block a
worker, while the gate is an entry decision that must honour required remaining
validity. To be commented at the definition, since it will read as an
inconsistency otherwise.

Ruling (tenant grace days preserved): `CertificateExpiryGraceDays` shifts the
legacy comparison. `RequirementStatusDto` carries `ExpiryDate`, so the rule
re-admits a requirement that is `Expired` but whose expiry is on or after
`now - graceDays`, reproducing the shift without the read knowing about it. Grace
0 reduces to today's behaviour.

Ruling (third override preserved): `HasActiveCertificateOverrideAsync` — an
approved request with `IsCertificateOverrideApplied` satisfying the rule despite
missing certificates — is a separate mechanism from our waivers that operators
rely on, and must survive unchanged with a test.

Ruling (double read): put the compliance view on `AccessDecisionContext`, as
`MissingCertificates` already is, so the credential view reuses it — but only if
the rule ordering allows; otherwise accept two reads on the gate path and record
it rather than contorting the ordering.

Ruling (access-request screening): use `SiteGate` with the request's own site. An
access request is for a specific site and screening against that site's
requirements catches problems before the worker travels. The implementer must
report whether the resulting `ApprovalIssue` is advisory or blocking; if
blocking, that is a deliberate tightening over the legacy job-position-only
check and must be stated.

Ruling (legacy fallback branch): reuse the compliance-derived list at
`ScanService.cs:110` if it is a one-line change; otherwise leave it and record
that the fallback now evaluates against tables that no longer gain rows, so the
feature flag must not be switched off after this phase without rewiring it.

Task 13a: implemented at 2057b22 — 795 unit (baseline 778), 79 integration, 20
warnings, the regression test red before the change and red again under a
mutation. Six concerns raised; two sent back, four settled:

Ruling (concern 1, no change — and it corrects the implementer's worry): with no
requirements configured the gate admits everyone, but I checked the legacy rule
and `FindMissingCertificates` with no job-position requirements also returns an
empty set and satisfies. So this is existing behaviour, not something this task
introduced; what changed is only *where* the configuration lives. Explicitly do
**not** add a fail-closed guard at the gate: unlike clearance, a gate that
refuses everyone when misconfigured shuts a site down, and that cure is worse
than the disease. **This makes Task 12's configuration conversion a hard
precondition for any deploy, not a convenience.**

Fix sent (concern 2): at the gate only an *expired* identity document denies, so
a missing, pending or rejected Civil ID would pass. The old rule checked only
expiry because the expiry column was all it had; we now have the full state and
should not reproduce that limitation. Asked the implementer to state whether
`CertificatesRule` builds its missing list from every `Blocking` requirement
regardless of category — if it does, the concern is moot and wants a test naming
the denying rule; if it filters by category, a missing identity falls through
both rules.

Fix sent (concern 3): the displayed missing list uses grace 0 while the decision
uses the tenant's grace, so a guard can see "missing: Civil ID" on a screen that
says "allowed". A decision and its explanation disagreeing is worse than both
being strict or both lenient.

Ruling (concern 4, accepted and recorded): approval screening now blocks on every
requirement at the request's site rather than job-position ones only — the
deliberate tightening I asked for, reported as such.
Ruling (concern 6, noted): three test groups were written alongside the change
rather than red-first; not worth redoing since the one test that matters was
red-first and mutation-checked.
Task 13a: for the reviewer's attention: one engine test's assertion was reversed
because a site-scoped requirement now blocks at that site. To be confirmed as a
legitimate consequence rather than a test bent to fit.

**F20 — confirmed fail-open: a missing Civil ID admitted the worker.** The
implementer answered my category question and the answer was the bad one:
`CertificatesRule` excluded the `Identity` category and `IdentityDocumentRule`
denied only `Expired`, so a worker whose Blocking Civil ID requirement was
missing, awaiting review or rejected **fell through both gate rules and was
admitted**. Fixed at 3679272: `IdentityDocumentRule` now denies any Blocking
identity requirement that is not `Valid` or `Waived` — expired keeps the
`IdentityDocumentExpired` reason, the other states reuse `MissingCertificates`
so no client contract changes — with tests for missing, `Submitted` and
`Rejected` that failed before the change. Also fixed: the displayed missing list
now applies the decision's grace, so the screen and the verdict cannot disagree.
Task 13a: I ran the full suite independently at 3679272 under default
configuration: GatePass.Tests 804/804, IntegrationTests 79/79, the same 12
Docker E2E failures.
Task 13a: open and recorded — access-request screening still excludes the
identity category, matching the old job-position-only check. A request can
therefore be approved for a worker with no Civil ID, and the gate denies them at
entry instead of the screen catching it earlier. Accepted for phase 1: it fails
closed at the gate and clearance also blocks it, so the cost is a wasted trip
rather than an unsafe entry.

**F21 (CRITICAL, and my error) — I told the implementer a premise that was
false.** My F18 ruling said "nothing writes `WorkerProfile.IdentityExpiresAtUtc`
any more." I inferred that from Task 10 making the *alert marker* column dead and
did not check the column itself. The review found four live writers —
`WorkerService.cs:122` and `:219`, `UserService.cs:244`,
`Users/UserService.Mutations.cs:83`, `ContractorUserApplicationService.cs:332` —
while only `PersonDocumentService` ever creates a `PersonDocument`. So the worker
form and the contractor-application flow set the identity expiry *without*
creating an identity document, and after rewiring, the default gate path stopped
enforcing it: **a worker with an expired Civil ID is admitted, for the entire
pre-phase population.** Two facts in the diff corroborate it — the flag-off
branch kept the column check, and `WorkPassService.cs:638,692` still blocks on
the same column, so it was enforced everywhere except the path that admits
people. Ruling: restore the column check OR'd with the document check until the
column is backfilled and removed, with a test seeding only the legacy column on
the flag-on path. The re-based seeds write no legacy rows at all, so nothing
currently exercises the existing production population — that gap is what let my
wrong premise through.

Also sent: parenthesise and split the gate predicate (one unparenthesised
expression now decides physical admission and mixes three callers' concerns
behind six parameters); carry the effective grace out on
`AccessComplianceResult` and make the tenant-config dependency required, since
two independent reads of one key to keep two surfaces agreeing is the wrong seam
and absent config would silently re-create the "allowed screen, missing row"
problem; `TryGetValue` in the screening list mapping; dedupe compliance reads by
`(siteId, userId)`; apply the tenant grace to screening too; tests for the three
untested gate states (`Barred`, identity `ExpiringSoon`, identity `Waived`); the
reciprocal comment at clearance's `IsSatisfied`; and return the legacy compliance
on the flag-off success path so it stops reading twice.

Ruling (accepted, recorded): the identity-expiry test moving from minute to day
precision does conceal a real loosening — an ID expiring earlier today is now
admitted — but that follows from `ExpiryDate` being a `DateOnly` and from the
early decision that a card is good through its last day. Not changed.
Ruling (accepted): the RED log for the no-legacy-rows test could not be
reproduced from the committed tree and probably came from an intermediate seed.
Not worth re-establishing; the mutation check on that test holds and is the
evidence that counts.
Task 13a: deferred to a follow-up: approval screening issues one compliance read
per (site, worker), so a 25-request page costs a few hundred queries. The proper
fix is a bulk compliance read; dedupe only for now.
Task 13a: fix round 1 at dbb02f7 — all nine addressed. The legacy identity
column is enforced again alongside the document check, with flag-on tests that
seed only the column and a mutation check (disabling the column clause fails the
expired test). The gate predicate is now single-clause named predicates with
explicit parentheses and a gate overload carrying no approval parameters. The
engine reads the tenant grace once and carries it on its result, so
`CertificatesRule` no longer reads config at all and the scan uses the decision's
value. I ran the full suite independently at dbb02f7: GatePass.Tests 813/813,
IntegrationTests 79/79, the same 12 Docker E2E failures. Scoped re-review
dispatched over 3679272..dbb02f7, asked to rebuild the state table and name
anything that moved.
Task 13a: minor (deferred, self-declared): the `TryGetValue` fallback has no test
because no read can miss, and this round's tests were written alongside the
fixes rather than red-first, with only the Critical mutation-checked.
Task 13a: fix round 1 (9 addressed, 0 open; commits 3679272..dbb02f7). The
re-reviewer verified the Critical's mutation from the committed test, confirmed
the legacy column is genuinely `Include`d rather than an EF fixup artifact,
proved the predicate split outcome-neutral by tracing `Expired`-with-grace and
`ExpiringSoon` through both forms, found no remaining decision/display grace
divergence on any path, and confirmed exactly two table cells moved, both
deny-direction.

**F22 — my Critical fix created a standing wrong-deny.** Because the legacy
column is OR'd with the document check, a worker who renews their Civil ID as a
`PersonDocument` while the column keeps the old date is denied
`IdentityDocumentExpired` indefinitely, and nothing ever clears the column —
`PersonDocumentService` writes no such field. Ruling, two parts:
(1) the gate consults the column only when there is **no** verified
`Identity`-category document, so newer evidence wins while Critical 1's
no-document case stays denied; and (2) verifying an `Identity` document writes
its expiry onto `WorkerProfile`, because the gate is not the column's only
reader — `WorkPassService.cs:638,692` still blocks work-pass issuance on it and
the flag-off scan branch still reads it, so part (1) alone would just move the
wrong-deny somewhere I was not looking. Cost if wrong: the column keeps being
written during the transition, which is what it already means; it is removed
with the rest of the legacy columns in a later phase.

Task 13a: the implementer hit the account's 5-hour rate limit mid-round and
terminated, having written all six files but reached no build, test or commit. I
verified its uncommitted work rather than discard it: build clean, and the full
suite under default configuration gives GatePass.Tests 819/819 (813 plus its 6
new tests), IntegrationTests 79/79, the same 12 Docker E2E failures. I read the
decision logic myself and traced the four cases F22 required — valid document
with a stale expired column allows (the fix), expired document denies, no
document with an expired column denies `IdentityDocumentExpired` (Critical 1's
case intact), no document with a null or future column raises no objection — and
confirmed `PersonDocumentService` now writes the profile column on verifying an
identity document, with tests in both `PersonDocumentServiceTests` and
`WorkPassServiceTests`. Committed as 34aa265 on its behalf.
Task 13a: **round 2 has had no independent review** — the rate limit stopped the
re-review before it could be dispatched. Verified by me and by the suite, but
not by a fresh reviewer. The final whole-branch review must cover
dbb02f7..34aa265 specifically, since it is the only change on this branch that
no reviewer has seen.

## Review of 34aa265 — the commit I verified myself. TWO CRITICALS. Process note.

I hand-traced this commit's four cases and believed they held; an independent
reviewer found two wrong-allows I missed. Worth recording as a lesson: my trace
checked the cases the spec listed and not the *shape of the predicate*, and both
defects live in shapes the spec did not enumerate. A green suite is consistent
with both, because no test exercises either shape.

**F23 (CRITICAL) — the suppression predicate is wider than the deny
predicates.** `HasVerifiedIdentityDocument` has two clauses. Clause 1 reads the
derived requirement `State`, which is sound. Clause 2 reads the **raw**
`ReviewStatus == Verified` on `OtherDocuments` — the documents no requirement
names — with no expiry test and no portability test, while both deny predicates
read only `Requirements`. So a worker with an expired legacy column *and* a
verified Civil ID that expired last year, where no requirement names Civil ID,
is **admitted** on two independent pieces of expired identity evidence; before
34aa265 the column denied them. The same clause lets a document verified by
another tenant under a non-portable type switch off this tenant's veto, because
the state machine's downgrade applies to requirements and not to the raw column.
Ruling: narrow clause 2 to a document currently in force for this tenant, **and**
add a matching deny for a held verified-but-expired identity document, so expired
identity evidence denies whether or not a requirement names it.

**F24 (CRITICAL) — a `Warning`-enforced identity requirement suppresses the
column while nothing denies.** Clause 1 applies `IsIdentity(r)` with no
enforcement filter, but both deny predicates filter `Enforcement == Blocking`.
So for a Warning-scoped Civil ID requirement: expired document → column ignored
→ no deny → **admitted**, again with expired evidence on both readings. Ruling:
drop `Expired` from clause 1 entirely and let the Blocking deny own it — cleaner
than adding an enforcement filter, and it leaves a Warning expired requirement
falling back to the column, which fails closed.

**F25 (Important) — the column write can replace a good value with a worse
one.** The write is unconditional on whichever document is being reviewed, and
the supersede loop only covers the *same* `DocumentTypeId`, so Identity types are
independent: verifying a passport expiring in 2027, or back-filling an old
already-expired identity scan, overwrites a Civil ID's 2031 date. Since
`WorkPassService.cs:638,692` and the flag-off `ScanService.cs:308` read the
column alone, that recreates the wrong-deny F22 existed to remove, in the two
places F22's gate fix does not reach. The code comment claims "newest verified"
behaviour the code does not have. Ruling: write only when the new value is later
than the stored one, and treat null deliberately rather than as an overwrite.

Ruling (reviewer's Minor 3, accepted as a fix): a `Waived` identity requirement
does not suppress the column, so a waiver plus an expired column still denies.
Pre-existing rather than a regression, but a waiver is an explicit authorised
override and should suppress it. Add `Waived` to clause 1.

**⚠️ carried to Task 12 — nothing backfills existing stale columns.** For every
worker whose identity document was verified before 34aa265, work-pass issuance
and the flag-off scan branch still read the old lapsed date, so the wrong-deny
persists off-gate until each document is re-verified. Ruling: Task 12's
conversion also refreshes `WorkerProfile.IdentityExpiresAtUtc` from the newest
verified identity document where one exists. Cheap, and it matters for developer
databases even though production is being reset.

Also sent: strengthen the work-pass assertion, which currently passes if
`ApproveAsync` throws for any other reason or if the refusal is reworded; pin the
`Identity`-category guard, which a test would currently leave green if deleted;
and assert `IsCompliant` as well as the reason on the expired-document gate test.

Task 13a: fix round for F23-F25 dispatched to the original implementer, scoped to
`Gate/`, `PersonDocumentService.cs` and `GatePass.Tests/` only, since another
agent had been editing API controllers on the same branch.
Task 13a: all six addressed at 153f501 — 835 unit (baseline 825), 92
integration, three mutation checks each caught by a test, and the agent kept to
its allowed file set. Clause 2 now requires a held identity document to be
verified, unexpired and portability-clean before it suppresses the column; a
held verified-expired identity document denies on its own; `Expired` no longer
suppresses while `Valid`, `ExpiringSoon` and `Waived` do; and the column write
only ever moves forward. Scoped re-review dispatched over 34aa265..153f501 on
opus, asked this time to enumerate suppression-versus-deny *shapes*
systematically rather than check the listed cases — because that is precisely
how the last two Criticals escaped both the implementer and me.

**Re-review of 153f501: Critical 2, both Importants and both Minors properly
addressed with mutation-killing tests — and TWO MORE CRITICALS, same failure
mode.** Asking for a systematic shape enumeration instead of a case list is what
found them: the reviewer tabulated 23 shapes by review status, expiry,
enforcement, portability and required-versus-held, and three of them admit a
worker holding only expired or untrustworthy identity evidence.

**F29 (CRITICAL) — "in force" can be satisfied by something not currently
valid.** `InForceForTenant` accepts `ExpiryDate is null` as in force without
consulting the type's `Expires` flag, while `DocumentValidity.Evaluate` calls
that same document `Pending` ("verified scan with no expiry captured yet: not
trustworthy, never Valid"). So a verified no-expiry scan on an expiring type
suppresses both the legacy-column deny and the held-expired deny; combined with a
held expired Civil ID the worker is admitted with nothing actually in force.
This is exactly the sanity check I asked the reviewer to make, and it failed.
Ruling: carry `Expires` in the type lookup `IdentityDocumentRule` already makes
and require a non-null expiry for an expiring type.

**F30 (CRITICAL) — the new deny is scoped to a collection that excludes the case
it needs.** I required "a held, verified, expired identity document denies
whether or not a requirement names it", but the implementation reads only
`OtherDocuments`, which `PersonDocumentQueryService` builds as *documents no
requirement names*. The other expired deny filters `Enforcement == Blocking`. So
a `Warning`-named expired identity document is invisible to both denies, and with
a clean column nothing denies at all. Ruling: the predicate must be "any held
verified expired identity document" over requirements ∪ `OtherDocuments`, not
`OtherDocuments` alone. My wording caused this — I said "whether or not a
requirement names it" and the implementer reasonably read it as "the ones no
requirement names".

**F31 (Important) — a regression in the forward-only write.** `(null, null) =>
false` short-circuits the whole adopt block, so verifying a non-expiring identity
document for a worker whose column is null no longer writes `IdentityNumber`,
which it previously did whenever non-blank. That is the common non-expiring
national-ID case, and the number is read by work-pass issuance and traceability.
Ruling: separate the number write from the date write.

Also open: the two halves of the same concept disagree on tenant and portability
(the deny ignores both while the suppressor honours them — fail-closed, but
undocumented); the portability query has no explicit tenant handling; and "today"
is UTC while the column is compared as an instant, so the two can disagree by a
day near midnight in a non-UTC tenant.

Task 11: F26 and F28 landed at 434e6d7 — 838 unit, 93 integration, and 19
warnings, *below* the 20 baseline, which the reviewer is asked to explain rather
than welcome. Legacy uploads now leave a Draft with the file attached, the five
completeness checks moved to `SubmitAsync`, and the three `Create_Requires…`
tests were renamed and re-pointed rather than deleted. Mutation check: disabling
all five completeness checks failed 5 tests. Two self-declared calls for the
reviewer to judge: a legacy `review` of a Draft submits it first (otherwise a
legacy-uploaded document could never be reviewed), and `Photo` uploads still
submit at upload so operator photos stay verified as before. Full review
dispatched over 34aa265..434e6d7, scoped to exclude the identity work that sits
in the middle commit.

**Task 11 review: Needs fixes — no Critical, three Important.** The two things I
pointed it at both held: all five completeness checks landed in `SubmitAsync`
with a test each (two of them gaining their first test ever), and **no existing
assertion anywhere was weakened** — it checked both edited API test files line by
line and found setup-only changes with every assertion intact. It also cleared
the bypass I feared in the implementer's auto-submit-inside-review: that path
calls the real `SubmitAsync`, so every check runs, and it is *stricter* than a
plain review because it adds scope resolution on top of the role gate.

F32 (Important) — `uploadedByUserId` on the legacy response maps from
`SubmittedByUserId`, which `CreateAsync` never sets, so after F26 made legacy
uploads leave a Draft the field comes back null, and after a legacy review
auto-submits it holds the *reviewer's* id. A client contract break that the shape
test could not catch, because it asserts property names and not values. Ruling:
map it from the document's earliest `PersonDocumentFile.UploadedByUserId` — the
file row already records exactly who uploaded it, so no service change is needed
— and assert the value.
F33 (Important) — the implementer's `Photo` carve-out from F26 (photos still
submit at upload) matches the old behaviour for operator staff but makes a
*contractor*-uploaded photo undeletable, breaking re-taking a bad photo on the
common Flutter path. Ruling: submit a photo only when the acting user can also
verify it; otherwise leave a Draft like every other legacy upload.
Ruling (F34, the two absent spec routes): correctly out of phase 1, but it needed
saying rather than deferring in silence. `GET /document-reviews` ships with the
inbox UI in phase 2 and `GET /documents/{id}/checks` has nothing behind it until
the authenticity work in phase 5. Amended the spec's API list to carry those
phases (commit c9a9066) so phase 1 no longer reads as owing them.
Also sent: catalog writes record no audit entry, which matters because the
catalog is where the `Health`-plus-`Required` privacy decision is made; and the
`Certificate` branch resolves a type with no tenant predicate while the code
branch beside it scopes to the person's tenant.
Task 11: all six fixes landed at be257ca — 95 integration (from 93), 19
warnings. Its 846 unit figure includes the identity agent's *uncommitted*
`GatePass.Tests` edits, so my own verification waits until that agent commits.
Two things it reported on itself: the `Photo` fix needed a role list in the shim
mirroring the service's review gate, which could drift (it argues a mismatch can
only leave a photo submitted-but-unverified, never wrongly verified — the
re-reviewer is tracing both directions); and its own new audit test caught a bug
in its own change, where a new requirement carried an untracked `DocumentType`
so the audit save tried to re-insert it and returned 500. A test catching the
author's own mistake is the outcome the audit minor was worth having for. Scoped
re-review dispatched over 434e6d7..be257ca.
Task 11: fix round approved (6 addressed, 0 open; commits 434e6d7..be257ca). The
re-reviewer traced the role-list drift in both directions and confirmed the
implementer's claim: a drifted list can leave a photo unverified but never
wrongly verified, because only `ReviewAsync` can reach `Verified` and that is the
service's own check. It also confirmed the untracked-type fix is a genuine
ordering fix rather than a workaround, and that no pre-existing test was weakened.
Task 11: complete (commits 34aa265..be257ca for its own files, review clean after
2 fix rounds).
Task 11: minor (deferred): catalog writes commit the row and then the audit entry
in a *second* save, so they are not atomic — a failure between them leaves a
saved row with no audit entry. Task 9 already solved this by staging the row and
letting the audit's own save commit both, so the pattern exists; worth the final
wave, and it matters because the catalog is where the privacy posture is set.
Task 11: minor (deferred): nothing pins the shim's photo role list against the
service's review gate, and the operator-verified-at-upload path is not exercised
in that diff; the earliest-file mapping resolves ties by arbitrary row order and
takes `fileName` from a possibly different file than `uploadedByUserId` on a
multi-file document (cosmetic for legacy, which carry one); and the file query
does not filter by file state, which would matter if removed files are ever kept
as soft-deleted rows.
Task 11: minor (deferred): an orphan-draft window if a `Photo` submit fails
(unreachable with the seeded type, but it depends on catalog data an operator can
now edit); a `400` for `active=false`; unused `documentId` and `userId` route
segments; and `CertificateTypeId` returning a document-type id until Task 12
makes those ids equal.

Fix round 4 of 5 dispatched to a **fresh implementer on opus** with the brief,
the report path and the framing that three prior rounds each left a hole in an
un-enumerated shape of this one predicate. It is told the invariant explicitly —
the suppressor's accepted set must be a subset of what the denies cover — and
required to prove it with a shape table across review status, expiry, the type's
`Expires` flag, enforcement, portability, tenant and required-versus-held,
rather than by example.

**Round 4 result at 680494c — the structural fix.** The fresh opus implementer
replaced the ad-hoc predicates with one classifier, `IdentityStateOf`, that
reproduces `DocumentRequirementEvaluator.StateOf` and gives a **total
partition**: `Valid`/`ExpiringSoon`/`Waived` suppress, `Expired` denies,
`Pending`/`Rejected`/`Missing` do neither. Both Criticals mutation-checked and
killed by named tests, with a 20-row shape table in the report. This is the cure
rather than another patch: three prior rounds each fixed a case and left the
suppressor wider than the denies, and a single classifier makes that class of
defect unrepresentable. 846 unit, 95 integration, 20 warnings.

Ruling (its concern 3, keep the alignment): it aligned the expired-deny with the
classifier instead of documenting the asymmetry, which means a foreign
non-portable expired identity document with a clean column now admits, matching
what the requirement path calls that row. Keep it. Consistency between suppressor
and denies is the invariant that failed three times, and making one deny stricter
than the classifier would rebuild exactly the asymmetry that caused F23 and F30.
The admit only occurs with no requirement configured, which is the standing,
deliberate fail-open at the gate.

**F35 (round 5, the cap) — `IdentityNumber` became last-writer-wins.**
Separating the number from the date was right, but the number now has no
ordering, so verifying an old passport scan overwrites a current Civil ID
number — and that number is read by work-pass issuance and traceability. Ruling:
write the number when the stored one is blank, or when this same document is the
one whose expiry now sits in the column. That ties the number to whichever
document is authoritative while still filling a blank from a non-expiring
identity type whose date never moves.

Task 13a: recorded as a follow-up, found by the implementer: `ScanService.cs:316`
still uses the Blocking-only identity predicate on the flag-off branch, so the
`UnifiedScanDecision` flag must not be switched off until it is rewired.

Task 12: dispatched (implementer on sonnet — the migration, the configuration
conversion, the seeded `CIVIL_ID` rule and the fresh-database path), running
concurrently with the identity round 5 on a disjoint file set. It was originally
held until Task 11's agent committed — it has
`PersonDocumentService.cs` and `GatePass.Tests/` at the moment, and F31 plus the
new tests need both. Per the fix-loop guidance, round 4 escalates to a fresh
implementer on a more capable model: three sonnet rounds have each left a
wrong-allow in an un-enumerated shape of this one predicate, which is the signal
that the implementer cannot see its own problem rather than that it is careless.

Ruling (a design question the implementer raised, accepted): the held-expired
deny applies only when no *other* identity evidence is in force. Without that
exception an old expired passport would permanently deny a worker whose current
Civil ID is valid, and people do keep lapsed passports. The reviewer is asked to
confirm "in force" cannot itself be satisfied by something not currently valid,
which would reopen F23.

## Task 11 — committed at 128b641, with real breakage to resolve

825 unit and 92 integration passing (from 819 and 79), 20 warnings. It added the
new controllers, a `DocumentCatalogService` (none existed) carrying the
Health-plus-`Required` refusal on create and update, and a
`POST documents/{id}/submit` route the spec omitted but review requires.

**F26 — the legacy shims do not actually keep the Flutter app working, which was
their whole purpose.** The implementer reported: legacy `IdDocument` uploads now
return 400 because `CIVIL_ID` requires a number, an expiry and both sides;
`Certificate` uploads 400 until Task 12 creates the competency types; and legacy
delete 400s because uploads are submitted immediately. The spec's intent is that
the old endpoints keep working *until the clients are migrated*, so a shim that
rejects what the old client sends has failed. Ruling: the legacy upload path must
create a **Draft** document and attach the file without submitting it — no
required-field validation at upload, the document completed later by whoever
reviews it. That also restores legacy delete, since a Draft can be deleted.
`MedicalFitness` uploads still refuse, which is correct and unavoidable: the
employer records the fitness outcome and the clinical report stays with the
provider. To be sent as a Task 11 fix round once the F23-F25 round lands.

**F27 — four more services still read `WorkerDocuments`.** `WorkerCardService`
(the photo for personnel-card issuance), `DashboardService`,
`WorkerTimelineService` and `WorkPassService`. None is a wrong-allow at a gate,
but card issuance failing for every new worker is as visible as the gate break
was. Added as Task 13b (plan commit a1ae35a).

Task 11: for the reviewer's attention — it edited two things outside its brief
and both need scrutiny: `UserService`, so adding a certificate accepts
person-document evidence; and two API test files
(`WorkerComplianceApiTests`, `PersonnelWorkflowApiTests`) "to match the new
behaviour", which must be checked for weakening rather than updating.
Task 11: accepted — `GET document-reviews` and `GET documents/{id}/checks` are
not built, since the review inbox is phase 2 and no service backs them;
`DELETE documents/{id}` and `POST documents/{id}/review` collide with the legacy
routes and return the legacy shape.

Task 11: the implementer returned NEEDS_CONTEXT on the F26 leniency fix and was
right. `CreateAsync` validates the type's required fields *before* saving, so a
Draft holding only a file is unreachable through the service surface, and it
correctly refused to write the row through `dbContext` because that would copy
the service's authorisation into an adapter.

**F28 — completeness was being validated at the wrong moment.** Ruling, and it
is a design correction rather than a workaround: a `Draft` is by definition
incomplete and submission is when it must be complete, so the line is
- `CreateAsync` keeps **validity of what was given**: length limits, cross-person
  number uniqueness, unknown restriction codes, medical fields on a non-medical
  type, the expiry prefill, and all authorisation and scope checks;
- `SubmitAsync` takes **presence of what the type requires**: number, expiry,
  issuer, issue date, medical outcome, and the existing file and both-sides
  checks.
The three existing `Create_Requires…` tests must move and be renamed rather than
deleted — each pins a real rule and several reviewers here have specifically
checked that no assertion vanished. Also asked for a test that a Draft missing a
required field cannot be submitted but can once supplied, and a mutation check
on the moved rule, since a completeness check crossing a boundary is exactly
where one gets silently dropped. `PersonDocumentService.cs` released to the
Task 11 agent now that the 13a round has committed.

Task 13a: round 5 landed at 36add1f — the number is written only when the date
write fired from that same document, or when the stored number is blank, with
both clauses mutation-checked against named tests. Across rounds 5 and 6 **no
existing test's assertions changed at all**; the forward-only theory is back to
its 434e6d7 expectations and only its comment moved. Unit tests 861 passed.
Task 13a: COMPLETE after 5 fix rounds (commits dbb02f7..36add1f). This predicate
took five rounds and two reviewers; the thing that finally worked was requiring a
total-partition classifier plus a shape table, not another list of cases.

**⚠️ THE INTEGRATION SUITE IS CURRENTLY UNMEASURABLE — read this before trusting
any number.** The identity implementer reported, and demonstrated, that
`GatePass.IntegrationTests` is failing in large and varying numbers (14, then 27,
then 55 of 95, across Auth/DemoSeed/CompanyDetail/ReportExport) while Task 12's
migration and seed work lands live — it saw the build go 0 errors → 1 error → 0
errors between its own calls, and a migration file renamed underneath it. It then
proved its own change is not the cause: with its two files stashed and nothing
else touched, integration failed **55**, worse than with its change applied. So
the failures belong to Task 12's in-progress work, not to the identity fix.
**Whoever resumes must re-run the full suite once Task 12 commits, and must not
treat the last green integration figure (95) as current.**

Task 13a: note for the backfill work: the number's ordering is a proxy via the
date, so a non-expiring national ID that clears an already-lapsed date counts as
adopting and takes the number. Intended and pinned, but worth stating where the
conversion refreshes that column.

## STATE AT STOP (third pause: account usage limit)

Branch `feat/person-documents-phase-1`, local only, nothing pushed, nothing
deployed. HEAD 36add1f plus whatever Task 12's agent commits after this note —
**it was still running when I stopped and will have continued.**

Complete and reviewed clean: Tasks 1-11, 13a.
In flight: Task 12 (migration, configuration conversion, seeded `CIVIL_ID` rule,
fresh-database path). Its brief is at task-12-brief.md and its report will be at
task-12-report.md. It has NOT been reviewed. Check `git log` for its commit.
Not started: Task 13 (retention disposal job — brief ready at task-13-brief.md),
Task 13b (the four remaining `WorkerDocuments` readers, including the photo that
personnel-card issuance needs — brief ready at task-13b-brief.md), and the final
whole-branch review.

Resume by: re-running the full suite to establish a true baseline now that the
concurrent edits have settled; reviewing Task 12's commit; then Tasks 13 and 13b;
then the final whole-branch review, which must also cover the deferred-minor
list above and diff the build-warning lists against 34aa265 (the count has
drifted 20 → 19 → 20 and no one has pinned why).

## STATE AT STOP (second pause: account 5-hour rate limit, resets 22:20 Asia/Muscat)

Branch `feat/person-documents-phase-1`, local only, nothing pushed, nothing
deployed. HEAD 34aa265. Suite: 819 unit, 79 integration green; 12 E2E failures
pre-existing (Docker). Build 0 errors, 20 warnings (unchanged baseline).

Complete and reviewed clean: Tasks 1-10 and 13a (13a's final round verified by
me but not independently reviewed — see above).
Not started: Task 11 (API endpoints plus legacy shims), Task 12 (migration and
configuration conversion — **a hard precondition for any deploy**, because
without it no `DocumentRequirement` rows exist and the gate requires nothing),
Task 13 (retention disposal job), and the final whole-branch review.
Briefs already generated: task-10, task-13a. Tasks 11-13 need theirs generating.

Task 10: unresolved, carried to the final review: build warnings fell 20 → 19
and the reviewer could not pin why from the diff. It accounted for every piece
of deleted production code as intentionally superseded, and its best candidate
is a deleted nullable dereference in a test. Worth diffing the two warning
lists directly before merge.

## STATE AT STOP (usage limit reached mid-plan — superseded, work resumed)

Done and reviewed clean: Tasks 1-8 (commits df4a3c1..2c218a7 on
`feat/person-documents-phase-1`, local only, nothing pushed).
Task 9: implemented at c769400 with two OPEN Important findings above. Resume by
dispatching a fix round to a fresh implementer with this ledger's two rulings,
then a scoped re-review over c769400..HEAD.
Not started: Task 10 (rewire clearance, gate scan and expiry sweep — brief
already generated at task-10-brief.md), Task 11 (API plus legacy shims),
Task 12 (migration and backfill), Task 13 (retention job), and the final
whole-branch review.
Last independent full-suite run, at 2c218a7: GatePass.Tests 741/741,
IntegrationTests 79/79, E2ETests 12/12 failing for want of Docker
(pre-existing). Build 20 warnings, 0 errors. Also confirmed independently at c769400:
GatePass.Tests 753/753, IntegrationTests 79/79, same 12 E2E Docker failures.
Nothing is deployed; production still runs the pre-existing release, and the
earlier deploy remains blocked on Docker Desktop.

## RESUMED after the usage pause. Disk, Task 12, and a third gap.

Disk: free space had fallen to 250-490 MB again, which is why Task 12 could only
get integration green with `Storage__MinimumFreeBytes=0` — local storage demands a
1 GiB reserve, so 15 upload tests failed under default config. Not a code defect.
I cleared bin/obj, the stale api.log and the NuGet temp cache: now **3.5 GB free**,
and re-running the full suite under default configuration to establish the true
baseline the previous note said was unmeasurable.

Task 12: committed at 2953b69 with 15 new conversion tests and 861 unit passing.
Full review dispatched over 36add1f..2953b69 on opus. The diff is ~394 KB, mostly
regenerated model snapshot, so the reviewer is told to spend its attention on the
conversion logic, the seeding paths and the table definitions.

Ruling (its deviation, accepted pending the review's path check): the conversion is
not called inside the migration's `Up`, because a migration has no DbContext.
Instead the seeder runs the idempotent conversion straight after `MigrateAsync`, on
the production migration job and on every seed. That is the conventional pattern and
I accept it — but the review is specifically asked to enumerate **every path that
migrates** and confirm each also converts, because a path that migrates without
converting is precisely the fail-open this task exists to prevent.

Ruling (its addition, accepted and important): the first-admin bootstrap and tenant
creation now seed the catalog and the `CIVIL_ID` rule in the same transaction. Its
reasoning is right and I had missed it — a reset production creates its first tenant
*after* the migration job runs, so without this the very scenario the owner
authorised (reset and reseed) would come up requiring nothing.

**F36 — the legacy configuration writers still bypass the new tables.** Task 12
converts the certificate configuration that *exists*, but `SiteService` and
`CertificateService.Create` still write only the legacy tables. So from the moment
this ships, an operator who adds a certificate requirement to a site sees it saved
and it has no effect on the gate or on clearance, both of which now read
`DocumentRequirement`. Silent divergence between what an operator sees and what the
system enforces is worse than either rule alone. Added as Task 13c (plan commit
1b1fee2): mirror the writes through `DocumentConfigurationConversion`'s own mapping
so the two paths cannot disagree, keeping the legacy write since other code still
reads it.

**Baseline re-established, and the "unmeasurable" note is resolved.** With 3.5 GB
free I ran the full suite under default configuration, no storage override:
GatePass.Tests **861/861**, IntegrationTests **95/95**, E2ETests the same 12
pre-existing Docker failures. So Task 12's 15 integration failures were purely the
1 GiB free-space reserve, exactly as both implementers suspected, and there is no
integration regression anywhere on this branch. Earlier numbers in this ledger that
were taken during concurrent edits should be ignored in favour of this one.

Task 13 (retention) and Task 13b (the four legacy `WorkerDocuments` readers)
dispatched together on disjoint file sets — 13 owns `BackgroundJobs/`, 13b owns
`WorkerCardService`/`DashboardService`/`WorkerTimelineService`/`WorkPassService`.
Each is told the other's territory, to prefer not touching
`InfrastructureModuleRegistration.cs`, and to re-run before reporting a failure in
a file it does not own. Both carry the verified 861/95 baseline.

**Task 12 review: Needs fixes — one Critical, three Important.** The conversion
itself came out strong: expressed once with no duplicate to drift, idempotent
*structurally* via natural-key sets rather than a "have I run" flag,
non-destructive, and all seven `CreateTable` definitions match the entity
configurations exactly including the filtered global index. The reviewer singled
out the `UniqueCode` helper for actually reasoning about that filtered index, and
the orphan handling for reporting dangling ids rather than joining them away. The
deviation on calling the conversion from the seeder was judged sound.

**F37 (CRITICAL) — a deployment entry point migrates and never converts.**
`--seed-nama-pilot-only` (`NamaPilotSeedOnlyMode.cs:13` →
`GatePassSeeder.NamaPilot.cs:100`) calls `PrepareSchemaAsync` at `:130`, so on
Postgres it migrates and creates the seven tables, and inside its transaction it
creates the tenant, sites, certificate types and job positions — but never calls
`EnsureDocumentConfigurationAsync`. The database it produces has zero
`DocumentType` and zero `DocumentRequirement` rows: the gate requires nothing and
the tenant has no `CIVIL_ID` rule, which is both Critical cases at once. It is the
exact migrate-without-converting fail-open this task exists to prevent, and it sits
on the **pilot client's own import path**; it self-heals only on the next
`--migrate-only`, so if the pilot import runs after the migration job the window is
until the next deploy. Ruling: one line after the commit at `:175`, a test driving
the real entry point rather than the helper, and an audit of every other `--seed-*`
one-shot mode with the findings named in the report — the reviewer enumerated what
it could see, but one missed mode is the whole defect again.

**F38 (Important) — the resurrection guard is the wrong granularity for the one row
that must always exist.** The identity rule is added only when the tenant's
`CIVIL_ID` *type* was created in the same run, so any state where the type exists
without the rule is permanent and the system silently requires no identity. The
admin-deletion trade is right for converted site and job rules — an operator who
deletes one meant it — but wrong here, because clearance refuses everyone when a
worker has no blocking requirement, so a missing `CIVIL_ID` rule does not relax the
system, it breaks it. Ruling: ensure the rule on every run, keyed on the rule's own
absence rather than on type novelty; it becomes effectively non-deletable, and the
asymmetry with the other rules must be commented so it reads as deliberate.

**F39 (Important) — the identity refresh is outside the conversion's transaction**,
so a failure between the two saves leaves configuration written and identity dates
stale. Harmless on a reset database, but the method exists precisely for the
pre-reset worker. One transaction, or independently re-runnable.

Also sent: `AdminBootstrapService.cs:73-75` throws when `document_types` is absent
— the legacy local-SQLite case the seeder itself warns about and skips — so a
developer with such a database can no longer bootstrap an admin at all; the identity
rule's shape is built in two places and could drift; and a doc comment says "latest
expiry" where the brief said "newest document" (the implementation takes the latest
expiry, which the reviewer judged defensible).

**F36 widened by this review, plan commit 6900886.** The legacy-writer divergence
runs in *both* directions, and the second is worse: `SiteService.cs:213-214`,
`JobPositionService.cs:81-85` and `CertificateService.cs:112` can leave live
`DocumentRequirement` rows enforcing requirements an operator has **deleted and can
no longer see**, which no later conversion repairs because the conversion only ever
adds. Task 13c must mirror removals as well as creations.

Task 12: F37-F39 and the three minors landed at 7c5f8ac. It audited every caller of
`PrepareSchemaAsync` (the only thing that migrates) and confirmed the pilot mode was
the sole miss, with no other `--seed-*` modes; RED with the fix removed was
"Sequence contains no elements" on the missing `CIVIL_ID` type. The identity rule is
now restored whenever absent and commented as deliberately non-deletable, with tests
both ways — a deleted identity rule returns, a deleted site or job rule stays
deleted — and its shape comes from a single `BuildIdentityRequirement`. One
`SaveChanges` for configuration and the identity refresh.

**Concurrency is now costing more than it saves, and the numbers in Task 12's report
should not be trusted.** Three agents building at once drove free disk from 3.3 GB
down to about 600-800 MB, so 3 integration upload tests failed on the 1 GiB
free-space reserve again, and 12 unit tests failed in `WorkerCard`, `Dashboard` and
`WorkPass` — all files Task 13b is actively editing and Task 12 never touched. None
of that is evidence about Task 12. Verification waits until both remaining agents
commit; I will then clear bin/obj (several hundred MB, mine to delete and
regenerating on the next build) and run the suite once, cleanly.

Noted and correct: Task 13b is writing its own migration,
`20261116090000_DropWorkerCardPhotoForeignKey.cs`. `WorkerCard.PhotoDocument` had a
real FK to the legacy `WorkerDocument` table, so pointing a card's photo at a
`PersonDocument` genuinely requires a model change — which is why Task 12 saw
foreign edits in `GatePassDbContext.cs` and the snapshot. That is its work, not a
collision, and it is handling it the right way.

Disk note for the owner: `~/Library/Containers/com.docker.docker/Data/vms` is 40 GB
and `~/Library/Caches/com.openai.codex` is 5.3 GB. I have not touched either —
Docker holds another project's containers and both are the owner's to decide on.

## HARD STOP: the machine's disk is full. Verification is impossible, not merely slow.

Container free space is ~238 MB. I deleted all 348 MB of the solution's bin/obj and
free space moved only 211 -> 227 MB, so a rebuild alone now needs more than exists.
Checked and ruled out: there are **no** Time Machine local snapshots holding the
freed blocks (`tmutil listlocalsnapshots /` is empty); the one APFS snapshot is the
sealed OS-update snapshot, which is not reclaimable. So this is not a reclaim lag —
the container is genuinely full, and the space belongs to the owner's data:
Docker's VM at 40 GB, the Codex cache at 5.3 GB, Chrome's at 1.6 GB. I have not
touched any of them and will not without being asked; I deleted only build output
I had generated myself, having said beforehand that I would.

**Consequence for the record: every test number produced by the last three tasks is
unverified by me.** Task 13 could not run integration at all, Task 13b got 81 of 96
with 15 storage failures at 977 MB free, and Task 12's run was polluted by two
concurrent agents. The last trustworthy figure on this branch is **861 unit and 95
integration under default configuration at 2953b69**, which I ran myself. Treat
anything after that as unmeasured until the suite is re-run on a machine with room.

## Task 13 (retention) — committed 113337b, reviewed by nobody

It landed 10 tests (8 briefed plus 2) and reports 879 unit passing. Rulings on its
own concerns, recorded now because I cannot dispatch a reviewer that would hit the
same wall:

**F40 (must fix) — disposal leaves the identity number behind.** Retention clears
`Number`, `NumberHash`, `IssuingAuthority`, `ExaminerName` and `ExaminingFacility`
on the document, but not the legacy `WorkerProfile.IdentityNumber` mirror that an
earlier task made the write path populate. So after disposal the person's identity
number survives on the profile, which defeats the storage-limitation purpose the job
exists for — the one requirement here that is a legal obligation rather than a
preference. Fix: when disposing a person's last identity document, clear the mirror
columns too.

Ruling (accepted, fail-safe): superseded age is measured from the successor's
`ReviewedAtUtc` because there is no "superseded at" column, so a successor with a
null `ReviewedAtUtc` means the predecessor is never disposed. That errs toward
keeping data, which is the right direction for a destructive job, and a dedicated
column is a later refinement.
Ruling (accepted): a separate `DocumentRetentionBackgroundService` rather than
folding into `RunOnceAsync`, whose 17-tuple result is pattern-matched elsewhere.
Ruling (accepted): expired-past-retention `Draft` and `Rejected` documents are
disposed of too — retention is about age, not outcome.
For its reviewer: it reports that removing the superseded guard kills no test, and
argues that is an equivalent mutant because the successor subquery cannot match a
null id. That reasoning needs checking rather than taking on trust.

## Task 13b — committed 00076ea, reviewed by nobody

**F41 — the dashboard no longer shows legacy uploads awaiting review.** It counts
only `Submitted` documents, but an earlier fix made every legacy upload leave a
`Draft`, which is exactly what the old Flutter client produces. So the documents most
likely to need review are invisible in the queue. Fix: count Drafts that carry a file
as awaiting review.

**F42 — a workflow capability was dropped and the owner must decide.**
`WorkPassService` no longer marks certificate evidence `Verified` on consultant
approval, because doing so would bypass the document review gate and a consultant is
not an authorised reviewer. My ruling is to keep it read-only: the single review gate
is deliberate and tested, and this fails closed. But it means consultant approval
alone no longer clears a worker's documents, which is a real change to how the pilot
works. Flagged to the owner; not for an implementer to decide.

Accepted: the hand-written `20261116090000_DropWorkerCardPhotoForeignKey` migration,
because `worker_cards.PhotoDocumentId` had a real FK to `worker_documents` and a
`PersonDocument` photo could never have been saved otherwise; the scaffolded
alternative was ~900 lines of unrelated drift. Its snapshot edit still needs a
reviewer's eye.
Accepted: the timeline keeps superseded documents, as history should.
Accepted: none of the four services needed a scope mode, since none goes through the
compliance read.

## WHERE THIS STANDS

All implementation is committed: Tasks 1-13, 13a, 13b. HEAD 113337b.
Not done: Task 13c (legacy configuration writers — can leave the gate enforcing
requirements an operator has deleted and can no longer see), reviews of Tasks 13 and
13b, fixes F40 and F41, the owner's decision on F42, and the final whole-branch
review. Briefs exist for everything; the plan and this ledger carry every ruling.
Nothing is pushed. Nothing is deployed. The migration has never run against Postgres.

## VERIFIED BASELINE AT HEAD 113337b — all green, and it clears the record

With 1.5 GB free I ran the full suite myself under default configuration, no
storage override: **GatePass.Tests 879/879, IntegrationTests 96/96**, E2ETests the
same 12 pre-existing Docker failures. Free space ended at 2.3 GB.

So every alarming figure from the last three tasks was a disk artifact, not a
regression: Task 12's 12 unit failures were files Task 13b was mid-edit on, Task
13b's 15 integration failures and Task 13's "disk is full" were the 1 GiB storage
reserve, and none of them reflected the committed code. The earlier note that
everything after 2953b69 was unmeasured is now superseded: **113337b is verified
green.**

Docker: the owner approved clearing "repo build outputs and docker clutter". I took
the build output and Docker's 62 MB of logs. I did **not** touch
`Data/vms` (40 GB) and explained why: the engine is not running — still the hung
state from the first deploy attempt — so `docker system prune` cannot execute at
all, and that 40 GB is one VM disk image holding every image, container and volume
including the other project's, so deleting it is all-or-nothing rather than
clutter. Reclaiming it needs Docker started, or its own Purge data.

## Task 13 review: no Critical. Four Important, two of which I ruled differently.

Confirmed sound: nothing live or in-retention is disposable, the cleared field list
is exact with outcome and dates surviving, files go only to the deletion queue,
disposal is one atomic `SaveChanges` so there is no half-disposed state either way,
and it is idempotent without a schema change. The reviewer also established
structurally what the implementer could not: removing `PersonDocumentFile` rows
cannot cascade into `DocumentFileAccessLog`, because that column carries no FK by
design — so ruling 3 holds by construction rather than by care.

**The implementer's "inconclusive" mutation check was vindicated.** Dropping the
superseded guard genuinely is an equivalent mutant: in both branches a null
`SupersededByDocumentId` matches no row, so the later filter removes it anyway. Its
reasoning was right and the superseded path *is* pinned on the SQLite branch.

Sent for fixing: the superseded branch is unbounded in SQL, fetching a type's whole
supersession history every pass where the expired branch already pushes `Take` down
(ruling 6); the null-`ReviewedAtUtc` fail-safe — the single guard between
"superseded yesterday" and "disposed today" — has no test; **F40**, the
`WorkerProfile.IdentityNumber` mirror surviving disposal, which defeats the one
requirement here that is a legal obligation; and no audit event is written on
disposal, which makes a PDPL disposal awkward to evidence. Plus two minors: a
weaker absence assertion on the superseded-inside-retention case, and
`StorageDeletionProcessor.IsStillReferencedAsync` being blind to
`PersonDocumentFiles`, the table this job now feeds it from.

Ruling (against the review, non-expiring types): `WORKER_PHOTO` and `DRUG_ALCOHOL`
are seeded `expires: false` and so are only disposable by supersession. The
reviewer called that a storage-limitation gap; I disagree. The spec's own wording
is "photos 90 days **after supersession**", and a non-expiring document that has
never been superseded *is* the current record, which ruling 5 protects. If a client
wants age-based disposal of drug tests, the honest change is to give that catalog
type an expiry, not to teach a destructive job to dispose of current records.

**MUST VERIFY BEFORE DEPLOY — recorded, not fixable here.** Every retention test
routes through the SQLite date-comparison branch, so the production path
(`DocumentRetentionProcessor.cs:109-114`, a `DateTimeOffset` correlated `Any`) has
**never executed**. That expression class is exactly what fails to translate at
runtime. Its failure mode is an exception, so it fails safe by disposing nothing,
but it must be exercised against Postgres before this job is trusted — and the same
caveat applies to the Task 12 migration, which has also never run against Postgres.

## Task 13b review: no Critical. The schema change held up; two consequences did not.

Verified in detail and worth recording as settled: the scope audit is correct in all
four services — none lost a filter it previously applied, so there is **no privacy
regression** — and the hand-written FK-drop migration genuinely agrees with the
snapshot and the `DbContext`, including the non-obvious part, that the implementer
re-declared the index EF had been inferring from the dropped FK. It drops the FK
under exactly the name the original migration created, sits at the head of history,
and its `Down` restores the same `SetNull` behaviour. Leaving the column un-FK'd
rather than repointing it was judged **right**, because repointing to
`person_documents` would fail on any existing row — nothing backfilled document
rows, only configuration.

**F43 (Important) — my own ruling on F42 left the work-pass gate accepting
never-reviewed evidence.** Making `WorkPassService` read-only was right, but its
evidence check only tests existence and "not all rejected", and a legacy upload
lands as `Draft`. So a `Draft` nobody has ever reviewed now clears a worker, and no
actor is ever asked to review it. Sent for fixing: require `Submitted` or
`Verified`. This is the cost of my ruling, not of the implementation.

**F41 is worse than I framed it — it is a closed loop, not under-reporting.** The
reviewer's correction: the dashboard counts only `Submitted`, a legacy upload lands
as `Draft`, and a `Draft` only becomes `Submitted` when a reviewer calls review. So
the document is invisible in the queue, no reviewer opens it, and it never becomes
`Submitted` — those uploads are **unreachable**, not merely uncounted. Widening the
count is not sufficient; the fix must break the loop and the queue must be able to
act on a listed `Draft`.

Deferred to the final wave, deliberately: the reviewer's best structural point is
that the "current, non-superseded" predicate is hand-rolled in **eight** places, and
an `IQueryable<PersonDocument>.Current()` extension would make ruling 5 enforceable
by construction rather than by review. I agree — this subsystem has been bitten
repeatedly by exactly that duplication — but five of the eight sites sit in files
other agents are editing, so it goes in the final wave across all eight at once.

Recorded, affects developer databases only: existing `worker_cards.PhotoDocumentId`
values point at legacy document ids nothing resolves any more. Predates this change,
and the dropped FK was only its last structural trace; production is being reset.

## Task 13c committed at baf7a2f — all implementation is now on the branch.

896 unit tests (879 baseline plus 17), two mutation checks, and 9 red-first tests
that it says reddened for behavioural reasons rather than on foreign-key errors —
a claim the review is checking, since a test that reddens on a constraint proves
nothing.

**It found three writers my brief's list missed**, which is the most useful thing
it did: `JobPositionService.CreateAsync`, `SiteService.DeleteAsync` (whose mirrored
rows would otherwise have been orphaned) and `CertificateService.UpdateAsync`
(where a rename would drift the `DocumentType` name). All three are now mirrored.
The review is asked to establish whether the set is now *complete*, because one
missed writer is the whole defect again.

Its delete decision, which I endorse: a certificate type with held
`PersonDocument`s or a requirement exception is **refused** with a clear message
and nothing changes; otherwise its `DocumentType` and the requirements on it are
removed, scoped to certificate-typed `Site` and `JobPosition` requirements only, so
the non-deletable `CIVIL_ID` rule and an administrator's own non-certificate rules
are out of reach. Refusing an operator's delete is the right trade against
orphaning a person's held evidence.

Three fix rounds are in flight at once (Task 13 retention, Task 13b readers) plus
this review. Disk is back down to 1.3 GB, so integration upload tests may fail on
the 1 GiB reserve in any run that overlaps another build; those are environmental
and the verified figure remains 879 unit / 96 integration at 113337b.

Task 13 fix round landed at 3060f91: superseded sweep bounded in SQL on the
production path (SQLite cannot translate any `DateTimeOffset` comparison — it tried
`.UtcDateTime` too — so the test-only path pages 200 at a time); the
null-`ReviewedAtUtc` fail-safe pinned; a disposal audit row per document in the same
save with no number in the metadata; and F40 closed — `IdentityNumber` cleared only
when it equals the disposed number *and* no other identity document still holds one,
while `IdentityExpiresAtUtc` is deliberately kept because it is a date the gate
reads. Full suite green at 899 unit / 96 integration. Re-review dispatched.

Task 13b fix round landed at 8646eb5, also 899/96 green: work-pass evidence must now
be `Submitted`, `Verified` or `Rejected`, so a Draft-only certificate is blocked
with "has not been submitted for review"; and the dashboard queue counts a current
document that is `Submitted` **or** a `Draft` carrying a file, while a file-less
Draft and a superseded document are not counted. It argues the loop is broken
because the only review route goes through the legacy facade, which submits a Draft
first. The re-review is asked to verify that by tracing every caller of
`ReviewAsync` — if anything reaches it directly, a listed Draft is still
unreviewable and the loop survives — and to judge whether accepting `Rejected` as
"present" re-opens the hole, since I asked only for `Submitted` or `Verified`.

Three gaps it disclosed, for the final review: an incomplete Draft is listed but
refused on review with a message naming what is missing (acceptable — visible and
actionable); the queue link `/users?documentStatus=Pending` has no server-side
filter it could find; and **`UserService` still reads `WorkerDocuments`**, which
predates this task but is one more unmirrored legacy reader to settle.

Task 13: COMPLETE (commits 113337b..3060f91, re-review approved all six). The
re-reviewer traced the paging and confirmed both paths select the same first N ids
by Id and both fail safe on a null or missing successor; confirmed the identity
guard cannot clear a number belonging to a different document and errs toward
keeping; confirmed the audit metadata carries no number, issuer, examiner or file
name; and confirmed disposal, its audit row, the file-row removal, the queue entries
and the profile clear all commit in one save, so a disposal without a record is not
possible. It also noted the one pre-existing test it edited was changed out of
necessity (disposal now adds an audit row) and not weakened.
Task 13: minor (deferred): the `Category == Identity` guard on the mirror clear is
untested — removing it would fail nothing; a same-pass mismatch can leave a stale
mirror when two identity documents are disposed in one run (safe direction); and the
atomicity argument assumes `PersonDocument` carries a concurrency token, which the
existing catch implies but nothing verifies.

Task 13b: COMPLETE (commits 00076ea..8646eb5, re-review approved). It grepped every
non-test caller of `ReviewAsync` and confirmed only two exist, both in the legacy
facade, both of which submit a Draft first — and that no controller exposes a direct
review route — so the closed loop really is broken for any Draft complete enough to
submit. It also judged the implementer's `!= Draft` choice correct rather than a
hole: counting `Rejected` as *present* is what lets the existing "all rejected"
branch fire with its more accurate message, and a Rejected-only worker is still
blocked.

**For the final fix wave — a residual the re-review rated Minor and I want closed.**
An *incomplete* file-bearing Draft is now counted in the queue but can be neither
verified nor rejected, because the reject path also submits first and submission
enforces completeness. The reviewer is told what is missing and can only delete it.
Logically a reviewer should be able to reject an incomplete document — "you did not
give me the number" is precisely a rejection — so reject should not require
submission. Without that, the queue accumulates items nobody can clear, which is a
slower version of the loop we just broke.
Task 13b: minor (deferred): `/users?documentStatus=Pending` still has no
server-side filter, so the count is right but the link does not take a reviewer to
the documents (pre-existing, a navigation gap rather than a loop).

## RESUMED after the second usage pause. Disk freed by the owner to 7.9 GB.

The 13c fix agent was killed by the rate limit partway through, leaving an
uncommitted tree that mixed its Fix 1 (enforcement) with another agent's further
rewiring of the work-pass compliance path onto the document model — the hazard of
running writers concurrently, showing up exactly as predicted. Rather than discard
it, I verified it: build clean (1 warning), full suite **909 unit / 97 integration
green** with the usual 12 Docker E2E failures. Committed as `dcf9535` with an
honest message naming both strands.

Resumed the 13c agent from that clean base for what remains: mirroring the seeder
additions (its "the conversion follows" justification was contradicted by the
conversion's own skip rule, and relaxing that skip would resurrect rules an admin
deliberately deleted, so the seeders must mirror explicitly), the
`RequiredByJobPositions` in-use check that currently surfaces as a 500 rather than
a refusal, and the mirror's `AsNoTracking`/SQL-side filtering.

**Task 13c review verdict, recorded:** no Critical. The writer set is genuinely
complete for every operator-editable path in both directions — and the reviewer
confirmed `IJobPositionService` exposes no delete at all, so nothing is missing
there. All eight call sites stage without saving, so every mirror shares the legacy
`SaveChanges`. The mapping is a genuine *move*, not a copy. The delete decision
(refuse when evidence is held, rather than cascade) was confirmed right, and the
scoping proven twice over unable to reach the `CIVIL_ID` rule or an administrator's
non-certificate rules. It also checked all nine red-first claims and confirmed none
reddens on a constraint — which mattered, because this SQLite provider does enforce
foreign keys.

## The build-warning drift is settled, and the extra warning is ours.

It has read 20 -> 19 -> 20 -> 21 across this branch and nobody pinned it. On a
genuinely clean rebuild (all bin/obj removed) the authoritative summary is **21
Warning(s), 0 Errors**, made up of 20 pre-existing nullable warnings in
Infrastructure and E2ETests plus **one new one introduced by this branch**:

`EF1002` at `GatePass.Tests/DocumentConfigurationConversionTests.cs:190` —
"`ExecuteSqlRawAsync` inserts interpolated strings directly into the SQL, without
any protection against SQL injection."

That is Task 12's orphan-manufacturing test, which turns foreign keys off with raw
SQL. It is test-only and not a production injection path, but it is a new warning
this branch added and the warning exists to catch exactly that pattern, so it goes
in the final fix wave: use a non-interpolated string or `ExecuteSqlAsync`. The
earlier readings of 19 and 20 were incremental builds that did not recompile every
project, which is why nobody could reconcile them.

Task 13c: fixes landed at 02173b6 — the Nama and ComplianceDemo seeders now mirror
the job-position requirements they add, add-only so it cannot resurrect an
administrator's deletion and with the conversion's skip untouched; deleting a
certificate a job position requires is now refused with a message rather than
throwing a `DbUpdateException`; and the mirror's projections use `AsNoTracking`
with the certificate-id filter pushed into SQL. 912 unit and 97 integration green.

Two things the implementer disclosed honestly, both now with the re-reviewer: its
second seeder test "failed before the change only because nothing had been mirrored
yet. It is a guard rather than proof" — so it may give false assurance; and it did
not check whether either seeder can add a **site** requirement on a re-run, which
would leave the same gap open for sites that it just closed for job positions.
That is the central check of the re-review.

## FINAL WHOLE-BRANCH REVIEW — 3 Critical, 8 Important, full triage of the 38 minors.
Verdict: "Mergeable with the Critical/Important fixes." Reviewed in six passes over
44 commits, from the working tree rather than the 1.17 MB diff.

**C1 — the branch's signature defect reappeared where no task review could see it.**
`PersonDocumentQueryService.cs:126-132` collapses several requirements for one
document type into one row by asking "is this satisfied *for clearance*", so
`Valid` and `ExpiringSoon` tie and `.First()` is decided by **EF row order**. The
gate's satisfied set deliberately excludes `ExpiringSoon` (F19) to preserve the
legacy deny — after the dedup it can never see it. So a worker whose certificate
sits inside a job position's 30-day minimum validity can be reported `Valid` and
**admitted at the gate**, nondeterministically. It is reachable with the *seeded
demo configuration*: `GatePassSeeder.cs:349` seeds site requirements for H2S and
HSE Induction while `ComplianceDemo.cs:98` requires the same two at 30 days on
those workers' job positions. No test covers a type required under two scopes.
The satisfied set turned out to be written **five times**.

**C2 — the deploy would be dead on arrival.** The branch turns on a Blocking
`CIVIL_ID` requirement for every tenant, seeded `RequiresBothSides: true`, so
submission demands a Front *and* a Back file — but the legacy upload endpoint has
no `side` parameter and the shim attaches `Page`, and the legacy verify path
submits first. So a legacy-uploaded Civil ID can never be submitted or verified,
the only capable client is a controller no shipped UI calls, and production is
being reset with no backfill: **every worker reads `Missing` and is refused.**
Ruling: seed `RequiresBothSides: false` (the front carries the identifying
content) *and* have the shim attach `Front` for a single-file upload.

**C3 — F4's hazard by another door.** A `UserRole` requirement is tenant-blind:
`DocumentRequirement` has no tenant of its own, `ScopeBelongsToTenantAsync`
accepts any role name, and `Matches` compares only `role.ToString()`. One tenant's
operator admin can create a Blocking rule that applies to **every `Worker` in
every tenant**, who can never satisfy it. Ruling: carry the type's `TenantId` into
the candidate, require null-or-equal for `UserRole`, pre-filter in SQL, and refuse
`WorkType` requirement creation in phase 1 as the waiver service already does.

Eight Importants accepted: the issue date is now checked nowhere (a future-issued
document reads `Valid`); `Health` metadata beyond the spec's level —
`ExaminerName`, `ExaminingFacility`, `Number`, free-text `ReviewNote` — reaches
viewers explicitly denied the file; a tenant-less reviewer's verification is
portable to every tenant; the current employment can be skipped; `SiteGate` has
spread to four non-gate callers and wants renaming to state its contract;
`Expires` can be cleared on an identity type nobody can deactivate; an unknown
`fileId` throws before logging, leaving id-probing untracked on the one surface
the access log exists for.

Ruling against the review on its Important 10: it offered "seed a tenant-scoped
medical requirement" *or* make it an explicit deploy step. **Do not seed it** —
a Blocking medical requirement on a reset database strands the workforce exactly
as C2 does. Take the documented-deploy-step option plus a test.

The review also confirmed, by its own tracing rather than our claims: every
migrating path converts; no fourth tenant-creating path; the seeders cannot
re-add an unmirrored **site** requirement (the first-seed branch runs before the
conversion, when the types are new); the identity suppressor/deny partition has no
shape that suppresses with no deny behind it; there is exactly one path to file
bytes and it logs refusals before throwing; retention cannot half-dispose and the
access log survives its files. The "current, non-superseded" predicate is
hand-rolled in **nine** places and all nine currently agree.

Single fix wave dispatched (one agent, complete list, as the process requires):
the three Criticals, all eight Importants, the reviewer's nine fix-before-merge
minors, and the `Current()` extension across all nine sites as a no-behaviour-change
commit. One scoped re-review follows; there is no second wave.

## FIX-WAVE RE-REVIEW: Mergeable with residuals. All 20 findings addressed.

All 3 Criticals, all 8 Importants and all 9 fix-before-merge minors verified in the
committed code with file:line evidence and a test each. The re-reviewer
independently re-traced the wrong-admit and confirmed the gate now **denies
deterministically**: ordering is `Enforcement` → `Rank` descending → `ScopeKind` →
`DocumentId`, and where all four still tie the two outcomes are identical in every
field the DTO carries, so row order can no longer decide anything observable. It
traced a legacy `IdDocument` upload end to end on the real seeded catalog to a
`Valid` reading, so the deploy is no longer dead on arrival. The nine-site
`Current()` refactor is behaviour-preserving at every site — it compared each
replaced predicate and confirmed the retention sweep's inverse is untouched, which
is what its "never dispose of a current record" rule rests on. No pre-existing test
was weakened or deleted: five vanished declarations are all renames with bodies
kept or strengthened, and the one inverted assertion was the defect.

It endorsed all three of the fix wave's deliberate omissions, and I accept each:
keeping `GateDocumentVerdict.SuppressesColumn` independent (delegating would let any
future addition to clearance's satisfied set silently widen the suppressor with no
deny behind it — the F23/F29/F30 class, and the "written five times" reduction was
achieved anyway); narrowing the SQL tenant pre-filter to `UserRole` only (filtering
the tenant-owned scopes would stop a site's own requirements applying to a worker
from another tenant — a loosening); and the catalog's optional audit writer, since
DI always resolves the real one and atomicity is achieved regardless.

### The four residuals, parked with rulings — there is no second fix wave

Ruling: **park, but fix before merge** — `PersonDocumentFileService.cs:1078-1082`
writes a caller-supplied `fileId` into `DocumentFileAccessLog.PersonDocumentFileId`
before any check can run (necessarily, since the file is unknown), and that column
has no `HasMaxLength`, so on Postgres any authenticated caller can write one
unbounded-text row per request. The reviewer checked the FK question specifically —
there is none, by design, so a 404 cannot become a 500 — leaving only the length
unpinned. A `HasMaxLength(64)` or a truncate in `LogAsync` closes it. Cost if wrong:
a cheap storage-growth vector on an audit table, no effect on any access decision.

Ruling: **park, accepted** — picking the worst outcome tightens waiver semantics:
where a type is required under two scopes and only one scope's waiver matches, the
unwaived row now wins and denies, where the old tie-break admitted. That is the
right direction and consistent with "keep the stricter requirement", but it is a
behaviour change beyond the stated ask with no test naming it. Cost if wrong: a
worker with a partially-scoped waiver is refused rather than admitted — fails
closed, and visible as a stated reason.

Ruling: **park, accepted as a known trade** — `OrderBy(Enforcement)` before `Rank`
means a `Warning` rule's worse state is not displayed when a `Blocking` rule on the
same type is satisfied. That ordering is *required* for gate correctness, since a
Blocking row must never hide behind a Warning row; the only loss is an advisory
warning on a screen.

Ruling: **park, accepted** — the widened restriction harvest now shows a guard the
restriction codes of a *rejected* certificate. The minor asked for every verdict and
the fail-safe direction is to show a restriction rather than hide it; the reviewer
would have scoped it to exclude `Rejected` and calls it a judgement, not a defect.

### Ledger preserved
This workspace is gitignored, so the record — 43 numbered findings and 88 rulings —
is copied into the repo at `docs/superpowers/` in gatepass-nextjs alongside the spec
and plan, so it survives the workspace being deleted.
