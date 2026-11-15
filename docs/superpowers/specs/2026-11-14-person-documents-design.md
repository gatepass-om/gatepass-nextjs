# Person documents: one model for identity, medical and competency evidence

Date: 2026-11-14
Status: design, awaiting approval

## Problem

The same fact about a person is stored in up to three places that nothing keeps in
sync, and the gate and clearance checks read whichever one is most convenient.

**Identity.** The Civil ID number and its expiry live on `WorkerProfile`
(`IdentityNumber`, `IdentityExpiresAtUtc`). A `PersonIdentityDocument` row holds a
second copy of the number, issuer, issue date, expiry and a `VerificationStatus`
string. The scan of the card is a third record, a `WorkerDocument` with
`DocumentType = IdDocument`, which has no expiry of its own. The UI admits the split:
the Civil ID panel on the person page says "Set its expiry date in the personnel
details above."

**Competency.** A `UserCertificate` row carries issue and expiry dates. Its evidence
is a separate `WorkerDocument` joined only by a nullable `CertificateTypeId` string.
`edit-user-form.tsx` keeps a client-side `Set` of certificate type ids that have
evidence in order to render the state. `WorkerCompetency` points at evidence through
`EvidenceWorkerDocumentId`, a loose string with no foreign key.

**Medical.** `MedicalFitness` is one value of the `WorkerDocumentType` enum and
nothing more. There is no expiry, no fitness outcome, no restrictions, and no way to
tell a pre-employment exam from an annual or a site-specific one. No clearance or gate
check reads it. Medical scans are stored and served exactly like any other document,
so any role that can open the documents panel can open a person's medical report.

**Enforcement is weaker than it looks.** `WorkerClearanceService` requires only that
*some* verified `IdDocument` exists; it never looks at an expiry date. Certificate
evidence is checked for existence, not validity. So a worker whose Civil ID expired
last year still passes clearance.

**Review has no queue.** A reviewer must open each person's page to find documents
waiting on them.

## Goals

1. One record per credential, holding the fact, its dates, its evidence files and its
   review state. No fact stored twice.
2. Validity is derived from dates at read time, never stored as a status that a
   background job must flip.
3. Medical outcome and restrictions are first-class and gate access. The clinical
   report is not held at all unless a client requires it, and where it is held it is
   restricted to a narrow set of roles with every access logged.
4. Required-document rules live in one place and cover site, job position, project and
   work type, replacing `SiteCertificateRequirement` and
   `JobPositionCredentialRequirement`.
5. One documents view per person, one review inbox across people, phone capture for
   both.
6. Clearance and gate decisions read this model and enforce expiry.
7. The authenticity work (OCR, issuer QR, duplicate detection) plugs in later without
   a model change.
8. A credential belongs to the person, not to the tenant that collected it, so a
   worker moving between contractors does not re-upload and re-prove everything.
9. Every document type carries a retention period, and expired-plus-elapsed documents
   are disposed of rather than kept forever.
10. An authorised person can grant a time-boxed, logged exception to a blocking
    requirement, because sites need that at 6am and will otherwise work around the
    system.

## Non-goals

- Automated authenticity checking. The model records verification checks and file
  hashes so that work can land later; no OCR or QR verification ships in this spec.
- A user-defined custom-field builder per document type. Fields are fixed per
  category.
- File versioning inside a credential. A renewal is a new credential record; the old
  one stays as history.
- Changing how worker card photos are captured. `Photo` keeps its current flow and is
  simply one document type among the rest.

## Model

The new entities replace `WorkerDocument`, `PersonIdentityDocument`,
`UserCertificate`, `CertificateType`, `SiteCertificateRequirement` and
`JobPositionCredentialRequirement`. `CertificateType` is absorbed by the catalog: each
of its rows becomes a `Competency` `DocumentType` carrying the same id, so existing
references survive the migration unchanged.

### `DocumentType` (catalog, tenant-scoped data)

What a document *is*. Seeded, then editable by an operator admin.

| Field | Notes |
| --- | --- |
| `Code`, `Name`, `NameAr` | `Code` is stable and used by seeds and integrations |
| `Category` | `Identity`, `Medical`, `Competency`, `Other` |
| `Sensitivity` | `Normal` or `Health`. `Health` turns on the medical access rules below |
| `Expires` | whether an expiry date is required |
| `DefaultValidityDays` | nullable; pre-fills expiry from the issue date |
| `RequiresNumber`, `RequiresIssuer`, `RequiresIssueDate` | which identity fields the form demands |
| `RequiresBothSides` | front and back capture, as for a Civil ID card |
| `UniqueNumberScope` | `None` or `Tenant`; `Tenant` rejects the same number on two people |
| `EvidenceRequirement` | `None`, `Optional`, `Required`. `Health` types default to `None`: the outcome is recorded, the report is not stored |
| `RetentionDays` | nullable; how long a superseded or expired document is kept before disposal |
| `VerificationIsPortable` | whether one tenant's verification satisfies another's requirement. True for identity types, false for medical and competency |
| `IsActive`, `SortOrder` | |

Seeded types: Civil ID, Passport, Residence card, Labour card; Pre-employment
medical fitness, Periodic medical fitness, Site-specific medical fitness,
Vaccination record, Drug and alcohol test; one `Competency` type per existing
`CertificateType` row; Worker card photo, Insurance, Other.

`SkillDefinition` and `WorkerCompetency` stay as they are. A competency's evidence
becomes a `PersonDocument` reference instead of a loose id.

### `DocumentRequirement` (rule)

Who needs what. One row per rule, replacing the two existing requirement tables.

| Field | Notes |
| --- | --- |
| `DocumentTypeId` | |
| `ScopeKind` | `Tenant`, `Site`, `Project`, `JobPosition`, `UserRole`, `WorkType` |
| `ScopeId` | the tenant id when `ScopeKind` is `Tenant`, the site, project or job position id, or the role or work-type code. Never null: a rule that bound every tenant at once would let one client's policy block another's workers |
| `Enforcement` | `Blocking` or `Warning` |
| `MinimumValidityDays` | carried over from `JobPositionCredentialRequirement` |
| `AppliesFromUtc` | lets a new rule take effect on a date rather than instantly |

A person's requirement set is the union of every rule whose scope matches them: their
tenant, their job position, their role, and the sites and projects they are being
assessed against. The gate evaluates against the site being entered; clearance
evaluates against the tenant, role and job position only.

### `PersonDocument` (the credential)

| Field | Notes |
| --- | --- |
| `UserId`, `DocumentTypeId` | **no `TenantId`**: the credential belongs to the person. See *Scoping* below |
| `VerifiedForTenantId` | the tenant whose reviewer verified it; null while unreviewed |
| `AttestedByUserId`, `AttestedAtUtc` | who declared the document genuine on submission |
| `Number`, `NumberHash`, `IssuingCountry`, `IssuingAuthority` | `NumberHash` enforces `UniqueNumberScope` and later duplicate detection |
| `IssueDate`, `ExpiryDate` | `DateOnly` |
| `ReviewStatus` | `Draft`, `Submitted`, `Verified`, `Rejected` — **no `Expired`** |
| `ReviewedByUserId`, `ReviewedAtUtc`, `ReviewNote` | |
| `MedicalOutcome` | nullable: `Fit`, `FitWithRestrictions`, `Unfit`. Only for `Medical` |
| `MedicalRestrictionsJson` | nullable list of restriction codes |
| `ExaminerName`, `ExaminingFacility` | nullable, `Medical` only |
| `SupersededByDocumentId` | set when a renewal is verified |
| `ExpiryAlertRaisedAtUtc` | idempotent marker for the expiry sweep, as today |
| `SubmittedByUserId`, `SubmittedAtUtc`, `RegistrationChannel` | |

Restriction codes are a fixed seeded list: `NoWorkAtHeight`, `NoConfinedSpace`,
`NoDriving`, `NoNightShift`, `NoHeavyLifting`, `NoRespiratorUse`, `NoHotWork`,
`OfficeDutiesOnly`.

### Scoping: the credential belongs to the person

A Civil ID is a fact about a person, not about a contractor. If the credential were
tenant-scoped, a worker moving from one contractor to another would re-upload every
document and be re-reviewed from scratch, and the same person would exist twice with
two expiry dates. Every established platform in this space solved that with a
person-owned profile assessed against each client's own requirements.

So `PersonDocument` has no `TenantId`. What *is* tenant-scoped:

- **Verification.** `VerifiedForTenantId` records who accepted it. A second tenant sees
  the document and its dates but its own requirement is satisfied only by its own
  verification, unless `DocumentType.VerificationIsPortable` is set, which the seeded
  identity types use because a Civil ID either is or is not genuine.
- **Requirements**, which are already scoped by their `ScopeKind`.
- **Visibility.** A tenant's staff see a person's documents only while that person is
  attached to them, through their contractor, project or site. Leaving a contractor
  ends the visibility; it does not delete the credential.

This costs one nullable column and one access rule now. Retrofitting it would mean
migrating the same data a second time.

### `DocumentRequirementException`

A time-boxed, logged waiver of a blocking requirement.

| Field | Notes |
| --- | --- |
| `UserId`, `DocumentTypeId`, `TenantId` | |
| `ScopeKind`, `ScopeId` | may waive for one site only |
| `Reason` | required, free text |
| `ValidFromUtc`, `ValidToUtc` | `ValidToUtc` is mandatory and capped at 30 days |
| `GrantedByUserId`, `GrantedAtUtc`, `RevokedByUserId`, `RevokedAtUtc` | |

Only an admin, operator admin or manager may grant one. Requirement evaluation returns
`Waived` rather than silently passing, so the gate screen, the clearance note and the
review inbox all show that entry rests on a waiver and when it lapses. Granting and
revoking raise audit events.

### `PersonDocumentFile`

| Field | Notes |
| --- | --- |
| `PersonDocumentId` | cascade delete |
| `Side` | `Front`, `Back`, `Page` |
| `FileName`, `ContentType`, `SizeBytes`, `StorageKey` | as `WorkerDocument` today |
| `Sha256` | for duplicate detection later |
| `UploadedByUserId`, `UploadedAtUtc` | |

### `DocumentVerificationCheck`

Append-only, one row per check performed on a credential.

| Field | Notes |
| --- | --- |
| `PersonDocumentId` | |
| `Method` | `HumanReview`, `NumberFormat`, `DuplicateNumber`, `DuplicateFileHash`, `Ocr`, `IssuerQr`, `ImageForensics` |
| `Result` | `Pass`, `Fail`, `Inconclusive` |
| `Detail`, `PerformedByUserId`, `PerformedAtUtc` | `PerformedByUserId` null for automated checks |

### `DocumentFileAccessLog`

One row per file open or download: `PersonDocumentFileId`, `UserId`, `AtUtc`,
`Purpose`. Written for every file; queried mainly for `Health` documents.

### Derived validity

A single pure function, used by every caller and unit-tested on its own:

```
Validity(document, now, minimumValidityDays):
  Draft or Submitted           -> Pending
  Rejected                     -> Rejected
  Verified, no expiry required -> Valid
  Verified, ExpiryDate < now   -> Expired
  Verified, within minimum days -> ExpiringSoon
  otherwise                    -> Valid
```

A requirement is satisfied when its person has a document of that type which is
`Verified` — by this tenant, or by any tenant when `VerificationIsPortable` — whose
validity is `Valid` or `ExpiringSoon`, and, for `Medical` types, whose
`MedicalOutcome` is not `Unfit`.

**An unfit finding dominates.** Where a person holds several documents of one type,
the best one normally decides the outcome — but a verified, still-current medical
document whose outcome is `Unfit` overrides every other document of that type, and
the requirement reads `Barred`. Unfitness is a fact about the person, not about a
piece of paper, and a worker re-examined and found unfit will routinely still hold
last year's certificate, in date. Without this rule that stale certificate would
carry them through the gate.

An unfit finding dominates across tenants too, whatever `VerificationIsPortable`
says. Declining another tenant's verification declines their *compliance claim*,
their assertion that the worker meets a requirement. An unfit finding is not a
compliance claim; it is a safety fact about the person. A worker who later
genuinely recovers is cleared by supersession, not by the finding lapsing: when the
newer certificate is verified it supersedes the unfit one, and superseded documents
are not considered at all. Failing that, an unrevoked
`DocumentRequirementException` covering now makes it `Waived`, which satisfies the
requirement while reporting itself as a waiver everywhere it is shown.

Status is never stored, so a late background job can delay an *alert* but can never
cause a wrong allow or deny.

## Medical data: outcome, not report

Occupational health practice, and data protection law in most jurisdictions, says the
employer receives a *fitness certificate* — fit, fit with restrictions or unfit, with
the restrictions, the expiry, the examiner and a certificate number — while the
clinical findings stay with the examining provider. Oman's PDPL treats health data as
a special category, as does GDPR Article 9.

So `Health` document types ship with `EvidenceRequirement = None`. The reviewer enters
the outcome, the restrictions and the dates from the certificate in front of them, and
no file is stored. An operator admin may raise a given type to `Optional` where a
client insists on holding the certificate, and the access rules below then apply to
it. A type with `Sensitivity = Health` can never be set to `Required`.

This is the cheapest liability reduction available here: data not held cannot leak.

## Retention and disposal

Keeping documents forever breaches the storage-limitation principle of both PDPL and
GDPR, and the rest of the system already has a disposal seam in
`StorageDeletionProcessor`.

Each `DocumentType` carries `RetentionDays`. A nightly job finds documents that are
superseded, or expired, by more than their retention period, deletes their files
through the existing storage deletion queue, and clears the document's identifying
fields — number, issuer, examiner — while keeping the row, its type, its dates and its
review outcome so that compliance history survives. Audit events and the access log
are kept under their own retention and are not touched by this job.

Seeded defaults: identity 365 days after expiry, competency 1,095 days (a certificate
lapse may need proving years later), medical 1,095 days for the outcome record,
photos 90 days after supersession. These are a starting point for the client to set,
not a legal determination; the figures sit in seed data so they can be changed without
a release.

## Access control

Two levels per document, checked in the service, not the UI.

**Metadata** — type, dates, status, and for medical the outcome and restriction codes.
Visible to anyone who may already view the person: the person themselves, their
contractor admin and supervisor, operator staff, managers, admins, and the gate
screen for the site being entered. Because the credential is person-owned, a tenant's
staff see it only while the person is attached to that tenant.

**Files** — the scans. Visible to the person themselves, admins, operator admins, and
a new `MedicalReviewer` permission for `Health` types. A contractor admin can open
the files of their own workers' `Normal` documents, because they are the ones
uploading them, but never the files of a `Health` document. Every file open writes a
`DocumentFileAccessLog` row.

So a gate guard sees "Medical fitness: valid to 12 Mar 2027, no work at height" and
cannot open the medical report. This is the one part of the design that is painful to
retrofit, which is why it ships in phase 1 rather than later.

## Integration

**Clearance.** `WorkerClearanceService.EnsureEvidenceIsVerifiedAsync` is rewritten to
evaluate the person's `Blocking` requirements through the validity function. Its error
message lists each unsatisfied requirement and why: missing, awaiting review,
rejected, or expired on a date. A `Warning` requirement records a clearance note and
does not block.

**Gate scan.** `ScanService.Certifications` is rewritten to build its credential rows
from `PersonDocument` plus `DocumentRequirement` for the site. Medical restrictions
appear as a distinct block on the scan result, so a guard sees "No work at height"
next to the allow decision. The DTO keeps its current shape where it can, so the
mobile app and scanner UI need no change in phase 1.

**Work passes and SIMOPS.** A work pass whose work type carries a restricted activity
is refused when the worker's medical outcome is `Unfit`, or when a matching
restriction code is present. This lands in phase 3 with its own mapping table from
work type to restriction code.

**Expiry alerts.** `OperationalJobProcessor.Credentials` sweeps `PersonDocument`
instead of `UserCertificate`, `WorkerProfile.IdentityExpiresAtUtc` and
`WorkerCompetency`, using each requirement's `MinimumValidityDays` as the lead time
and `ExpiryAlertRaisedAtUtc` as the idempotency marker, as it does today.

## API

New, under `/api`:

- `GET /document-types`, `POST`/`PUT`/`DELETE` for operator admins
- `GET /document-requirements?scopeKind=&scopeId=`, `POST`, `DELETE`
- `GET /people/{userId}/documents` — requirement-joined: one entry per required type
  plus any extra documents held, each with its validity. This is what the Documents
  tab renders, so the client does no joining.
- `POST /people/{userId}/documents` — create a credential with its fields
- `POST /people/{userId}/documents/{id}/files` — multipart, `side` form field
- `GET /documents/{id}/files/{fileId}` — inline preview or download; enforces the file
  level and writes the access log
- `POST /documents/{id}/review` — `Verified` or `Rejected` with a note; a `Verified`
  renewal sets `SupersededByDocumentId` on the record it replaces
- `DELETE /documents/{id}`, `DELETE /documents/{id}/files/{fileId}`
- `GET /document-reviews?status=&contractorId=&typeId=&page=` — the review inbox
- `GET /documents/{id}/checks` — verification history
- `POST /people/{userId}/document-exceptions` — grant a waiver with a reason and an
  end date; `DELETE /document-exceptions/{id}` revokes it
- `GET /document-exceptions?active=true` — what is currently running on a waiver

The existing `workers/{id}/documents`, `documents/{id}/download`,
`documents/{id}/review` and `documents/{id}` endpoints stay, reimplemented over the
new model, until the web and mobile clients are migrated. They are removed in phase 4.

## UI

**Person documents tab** (`src/components/documents/`) replaces the three
`WorkerDocuments` panels on the person page and the certificate evidence block inside
`edit-user-form.tsx`. Sections for Identity, Medical, Competency and Other. Each row
is a requirement with a state chip — Missing, Pending review, Rejected, Expired,
Expires in N days, Valid — and one action, "Add" or "Renew". Non-required documents
the person holds are listed under their category. Medical rows show the outcome and
restriction chips; the file thumbnail is hidden for anyone without file access, with a
line explaining why rather than an empty box.

**Add or renew dialog.** One dialog driven by the type's catalog flags: number,
issuer, issue date, expiry (pre-filled from `DefaultValidityDays`), medical outcome
and restrictions for `Medical`, then capture. Capture offers camera or file, asks for
front and back when `RequiresBothSides`, and shows each captured side as a thumbnail
before saving. It is the same component in the registration wizard, the person page
and the contractor view.

**Review inbox** (`/document-reviews`). A queue across all people, filterable by
type, contractor and status, with the file viewer beside the entered fields so a
reviewer can compare them. Verify and Reject with a note, and keyboard shortcuts to
move through the queue. Verification checks appear as a list on each item, which is
where automated signals will surface later.

**Phone.** Both the tab and the dialog are built phone-first, since contractors and
workers will mostly photograph documents. The expiry reminder notification deep-links
into the renew dialog for that type.

## Migration

Production is live at app.gatepass.om with a seeded Nama tenant, and the Flutter app
reads the current endpoints, so the old and new models have to coexist for a release.

Each phase gets its own implementation plan; this spec covers the shape of all five so
the phase 1 model does not have to change later.

**Phase 1 — model and enforcement.** Add the five tables. Seed the catalog, including
one `Competency` type per existing `CertificateType`. Backfill in one migration:

- each `WorkerProfile.IdentityNumber` and `IdentityExpiresAtUtc` becomes a Civil ID
  `PersonDocument`, merged with its `PersonIdentityDocument` row where one exists and
  with its `IdDocument` `WorkerDocument` as the front file;
- each `UserCertificate` becomes a `Competency` `PersonDocument` of the
  `DocumentType` that carries its `CertificateTypeId`, with the matching
  `WorkerDocument` (type `Certificate`, same `CertificateTypeId`) as its file;
- every other `WorkerDocument` becomes a `PersonDocument` of the mapped type with one
  file, review status carried over;
- `SiteCertificateRequirement` and `JobPositionCredentialRequirement` become
  `DocumentRequirement` rows, `Blocking`, keeping `MinimumValidityDays`;
- `WorkerCompetency.EvidenceWorkerDocumentId` is repointed;
- existing `MedicalFitness` documents keep their files, since an outcome cannot be
  invented for them. Their type is seeded as `Optional` rather than `None`, and a
  report lists them so the client can decide whether to re-record the outcomes and
  dispose of the scans. New medical records follow the outcome-only default.

Verification is backfilled as `VerifiedForTenantId` = the tenant the person belonged
to at migration time, so nothing becomes unverified. No `TenantId` is written on the
document itself.

Storage keys are reused, so no bytes move. The old tables are left in place and
readable. Clearance, gate scan and the expiry sweep switch to the new model in this
phase, and `MedicalFitness` becomes enforceable. Old endpoints are reimplemented over
the new tables, so the mobile app keeps working unchanged.

A verification script compares counts and spot-checks per person before and after, and
is run against a copy of the production database first. The migration is reversible in
the sense that the old tables still hold the original rows.

**Phase 2 — UI.** The documents tab, the add/renew dialog and the review inbox. Old
panels and the certificate evidence block in `edit-user-form.tsx` are removed. New
endpoints only.

**Phase 3 — medical gating.** Work-type to restriction mapping, work pass and site
refusal on `Unfit` and on matching restrictions, medical access logging surfaced in an
audit view.

**Phase 4 — cleanup.** Mobile app moved to the new endpoints, old endpoints removed,
`WorkerDocument`, `PersonIdentityDocument`, `UserCertificate`,
`SiteCertificateRequirement`, `JobPositionCredentialRequirement` and the
`WorkerProfile` identity columns dropped, along with `CertificateType` once nothing
references it. `WorkerDocumentType` and `WorkerDocumentReviewStatus` enums deleted.

**Phase 5 — authenticity.** Separate spec. The model is ready for it: checks are
recorded against the credential, file hashes exist for duplicate detection, and the
review inbox has a place to show signals.

## Testing

- Unit: the validity function across every status, expiry and minimum-validity
  combination, including the day boundaries and a null expiry on a type that does not
  expire.
- Unit: requirement resolution for a person matching several scopes at once, including
  `AppliesFromUtc` not yet reached.
- Unit: the access rules, one case per role per sensitivity, asserting that a
  contractor admin and a gate user cannot read a `Health` file and that the attempt is
  logged.
- Unit: portability — a second tenant's requirement satisfied by another tenant's
  verification for an identity type and not for a competency type.
- Unit: waivers — expired, revoked, wrong scope and valid, asserting `Waived` is
  reported rather than `Valid`, and that the 30-day cap is enforced.
- Unit: the retention job selects only superseded or long-expired documents, clears
  identifying fields, keeps the outcome, and leaves current documents untouched.
- Unit: clearance refusal messages for missing, pending, rejected and expired.
- Integration: upload, review, renew and supersede over the API; the old endpoints
  returning the same shape as before the migration.
- Migration: a fixture database with the awkward cases — identity data in all three
  places, a certificate with no evidence, a document with a type the catalog does not
  map — asserting counts and per-person equivalence.
- Frontend: the documents tab states, the dialog's conditional fields per catalog
  flag, and the file area hidden for a restricted viewer.
