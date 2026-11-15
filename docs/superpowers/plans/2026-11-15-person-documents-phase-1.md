# Person Documents Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three places identity, medical and competency facts are stored with one person-owned `PersonDocument` credential, and make clearance and the gate enforce expiry.

**Architecture:** Five new tables plus two pure evaluation functions. `DocumentType` is a tenant-scoped catalog; `DocumentRequirement` says who needs what; `PersonDocument` holds the credential and belongs to the person, not the tenant. Validity is computed at read time by `DocumentValidity.Evaluate`, and requirement satisfaction by `DocumentRequirementEvaluator`, so no status is ever stored. Phase 1 adds the model, backfills from the old tables, switches clearance, the gate scan and the expiry sweep onto it, and reimplements the existing endpoints over the new model so the Flutter app keeps working. No new UI.

**Tech Stack:** .NET 8, EF Core 8 (SQLite for dev and tests, Postgres in production), xunit + FluentAssertions, hand-written migrations.

**Spec:** `docs/superpowers/specs/2026-11-14-person-documents-design.md`

## Global Constraints

- Backend repo root: `/Users/tamerabbasher/Documents/Projects/gatepass/gatepass/backend-dotnet`. Every path below is relative to it.
- Entities are `sealed`, live in `GatePass.Domain/Entities/`, derive from `AuditableEntity` (which supplies `Id`, `CreatedAtUtc`, `UpdatedAtUtc`), and expose settable properties. Enums live in `GatePass.Domain/Enums/`, one file per enum, values numbered explicitly starting at 1.
- Every new `DbSet` is declared on both `GatePass.Application/Abstractions/Data/IApplicationDbContext.cs` and `GatePass.Infrastructure/Persistence/GatePassDbContext.cs` (`=> Set<T>()`), and configured in `GatePassDbContext.OnModelCreating` in the existing style: snake_case `ToTable`, enums `.HasConversion<string>().HasMaxLength(64)`, explicit `HasMaxLength` on every string, explicit `OnDelete`.
- Services are `sealed` with primary-constructor injection, in `GatePass.Infrastructure/Services/`, registered in `GatePass.Infrastructure/Modules/InfrastructureModuleRegistration.cs` with `services.AddScoped<IFoo, Foo>()`. Their interfaces live in `GatePass.Application/Abstractions/<Area>/`, DTOs in `GatePass.Application/DTOs/<Area>/`.
- Throw `BadRequestException`, `NotFoundException` and `ForbiddenException` from `GatePass.Application.Common`. Never return error strings.
- Tests are in `GatePass.Tests/`, one `public sealed class <Subject>Tests`, xunit `[Fact]`, FluentAssertions, `await using var db = TestDbFactory.CreateContext();`. `TestDbFactory` calls `EnsureCreated()`, so tests see the model without a migration. Fakes come from `GatePass.Tests/Support/TestDoubles.cs` (`FakeFileStorage`, and `Fake(UserRole, userId:, contractorId:)` for `ICurrentUserService`).
- Migrations are hand-written in `GatePass.Infrastructure/Persistence/Migrations/` with `[DbContext(typeof(GatePassDbContext))]` and `[Migration("<timestamp>_<Name>")]`, columns typed `type: "text"` for strings so one migration serves SQLite and Postgres, and `GatePassDbContextModelSnapshot.cs` updated to match.
- Build with `dotnet build GatePass.sln`, test with `dotnet test GatePass.sln`. Both must be clean before any commit.
- Restriction codes, verbatim and exhaustive: `NoWorkAtHeight`, `NoConfinedSpace`, `NoDriving`, `NoNightShift`, `NoHeavyLifting`, `NoRespiratorUse`, `NoHotWork`, `OfficeDutiesOnly`.
- A waiver's `ValidToUtc` is mandatory and at most 30 days after `ValidFromUtc`.
- Seeded `RetentionDays`: identity 365, competency 1095, medical 1095, photo 90.

## Review Focus

Each line below has its test added to the task that owns the code.

1. A document with `ReviewStatus = Verified` and a null `ExpiryDate` on a type where `Expires` is true — a reviewer can verify before the expiry is filled in; this must read as `Pending`, not `Valid`, or an expired card passes the gate. **Task 3.**
2. Two documents of the same type for one person, one expired and one current — satisfaction must consider the best one, not the newest or the first found. **Task 4.**
3. `MinimumValidityDays` larger than the document's whole remaining life, so `ExpiringSoon` and `Valid` overlap at the boundary; the gate must not report a valid card as missing. **Task 3.**
4. A person whose contractor has no tenant, which existing seed data allows, evaluated against a `Tenant`-scoped requirement — must not throw. **Task 4.**
5. A `Health` document whose file a contractor admin requests — must be refused *and* logged, since an unlogged refusal loses the audit trail the medical rules exist for. **Task 8.**

---

### Task 1: Enums

**Files:**
- Create: `GatePass.Domain/Enums/DocumentCategory.cs`, `DocumentSensitivity.cs`, `EvidenceRequirement.cs`, `DocumentReviewStatus.cs`, `DocumentValidityState.cs`, `MedicalFitnessOutcome.cs`, `RequirementScopeKind.cs`, `RequirementEnforcement.cs`, `DocumentVerificationMethod.cs`, `DocumentVerificationResult.cs`, `DocumentFileSide.cs`

**Interfaces:**
- Consumes: nothing.
- Produces: the enums every later task names.

- [ ] **Step 1: Write the enums**

One file each, matching the spec's value lists exactly:

```csharp
public enum DocumentCategory { Identity = 1, Medical = 2, Competency = 3, Other = 4 }
public enum DocumentSensitivity { Normal = 1, Health = 2 }
public enum EvidenceRequirement { None = 1, Optional = 2, Required = 3 }
public enum DocumentReviewStatus { Draft = 1, Submitted = 2, Verified = 3, Rejected = 4 }
public enum DocumentValidityState { Pending = 1, Valid = 2, ExpiringSoon = 3, Expired = 4, Rejected = 5, Missing = 6, Waived = 7, Barred = 8 }
public enum MedicalFitnessOutcome { Fit = 1, FitWithRestrictions = 2, Unfit = 3 }
public enum RequirementScopeKind { Tenant = 1, Site = 2, Project = 3, JobPosition = 4, UserRole = 5, WorkType = 6 }
public enum RequirementEnforcement { Blocking = 1, Warning = 2 }
public enum DocumentVerificationMethod { HumanReview = 1, NumberFormat = 2, DuplicateNumber = 3, DuplicateFileHash = 4, Ocr = 5, IssuerQr = 6, ImageForensics = 7 }
public enum DocumentVerificationResult { Pass = 1, Fail = 2, Inconclusive = 3 }
public enum DocumentFileSide { Front = 1, Back = 2, Page = 3 }
```

- [ ] **Step 2: Build**

Run: `dotnet build GatePass.sln`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add GatePass.Domain/Enums
git commit -m "feat: add person document enums"
```

---

### Task 2: Entities, DbSets and EF configuration

**Files:**
- Create: `GatePass.Domain/Entities/DocumentType.cs`, `DocumentRequirement.cs`, `PersonDocument.cs`, `PersonDocumentFile.cs`, `DocumentVerificationCheck.cs`, `DocumentFileAccessLog.cs`, `DocumentRequirementException.cs`
- Modify: `GatePass.Application/Abstractions/Data/IApplicationDbContext.cs`, `GatePass.Infrastructure/Persistence/GatePassDbContext.cs`
- Test: `GatePass.Tests/PersonDocumentModelTests.cs`

**Interfaces:**
- Consumes: Task 1's enums.
- Produces: `dbContext.DocumentTypes`, `.DocumentRequirements`, `.PersonDocuments`, `.PersonDocumentFiles`, `.DocumentVerificationChecks`, `.DocumentFileAccessLogs`, `.DocumentRequirementExceptions`. Property names are exactly the spec's field names.

- [ ] **Step 1: Write the failing test**

```csharp
[Fact]
public async Task PersonDocument_RoundTripsWithFilesAndType()
{
    await using var db = TestDbFactory.CreateContext();
    // seed a tenant, a user, a DocumentType { Code = "CIVIL_ID", Category = Identity, Expires = true }
    // add a PersonDocument with Number, ExpiryDate and one PersonDocumentFile
    // reload with Include(x => x.Files).Include(x => x.DocumentType)
    reloaded.Files.Should().ContainSingle();
    reloaded.DocumentType.Code.Should().Be("CIVIL_ID");
    reloaded.ReviewStatus.Should().Be(DocumentReviewStatus.Draft);
}

[Fact]
public async Task PersonDocument_HasNoTenantColumn()
{
    typeof(PersonDocument).GetProperty("TenantId").Should().BeNull(
        "a credential belongs to the person; only its verification is tenant-scoped");
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test GatePass.sln --filter PersonDocumentModelTests`
Expected: compile failure, the types do not exist.

- [ ] **Step 3: Write the entities**

Every field in the spec's four tables plus `DocumentRequirementException`, with these exact decisions:
- `DocumentType`: `TenantId` nullable string; `Code`, `Name`, `NameAr`; `Category`, `Sensitivity`, `EvidenceRequirement` enums; `Expires`, `RequiresNumber`, `RequiresIssuer`, `RequiresIssueDate`, `RequiresBothSides`, `VerificationIsPortable`, `IsActive` bools; `DefaultValidityDays`, `RetentionDays`, `SortOrder` nullable ints (`SortOrder` non-null, default 0); `UniqueNumberScope` enum-as-string `None`/`Tenant` — model it as a `bool RequiresUniqueNumber` instead, since there are only two cases and the spec's second case is tenant-wide.
- `PersonDocument`: no `TenantId`. `IssueDate`/`ExpiryDate` are `DateOnly?`. `MedicalRestrictionsJson` is a non-null string defaulting to `"[]"`, matching `WorkerProfile.SecondaryLanguagesJson`. Navigations: `User`, `DocumentType`, `ICollection<PersonDocumentFile> Files`.
- `PersonDocumentFile`: `Sha256` non-null, 64 chars.
- `DocumentRequirementException`: `TenantId` non-null here, because a waiver is granted by one tenant.

- [ ] **Step 4: Declare and configure the DbSets**

Add the seven `DbSet` properties to both the interface and the context, and one `modelBuilder.Entity<T>` block each in `OnModelCreating`, next to the existing `WorkerDocument` block. Tables: `document_types`, `document_requirements`, `person_documents`, `person_document_files`, `document_verification_checks`, `document_file_access_logs`, `document_requirement_exceptions`. Indexes:
- `document_types`: unique `(TenantId, Code)`
- `document_requirements`: `(ScopeKind, ScopeId)`, and unique `(DocumentTypeId, ScopeKind, ScopeId)`
- `person_documents`: `(UserId, DocumentTypeId)`, `(ReviewStatus)`, `(ExpiryDate)`, and unique `(DocumentTypeId, NumberHash)` filtered to non-null `NumberHash`
- `person_document_files`: `(PersonDocumentId)`, `(Sha256)`
- `document_file_access_logs`: `(PersonDocumentFileId, AtUtc)`
- `document_requirement_exceptions`: `(UserId, DocumentTypeId, ValidToUtc)`

`PersonDocument.User` cascades; `DocumentType` restricts; `Files` cascade from `PersonDocument`.

- [ ] **Step 5: Run to verify it passes**

Run: `dotnet test GatePass.sln --filter PersonDocumentModelTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add GatePass.Domain/Entities GatePass.Application/Abstractions/Data GatePass.Infrastructure/Persistence/GatePassDbContext.cs GatePass.Tests/PersonDocumentModelTests.cs
git commit -m "feat: add person document entities and EF configuration"
```

---

### Task 3: `DocumentValidity.Evaluate`

The one function every caller shares. Pure, no EF, no clock injection beyond a `now` parameter.

**Files:**
- Create: `GatePass.Application/Documents/DocumentValidity.cs`
- Test: `GatePass.Tests/DocumentValidityTests.cs`

**Interfaces:**
- Produces:

```csharp
public static class DocumentValidity
{
    public static DocumentValidityState Evaluate(
        DocumentReviewStatus reviewStatus,
        bool typeExpires,
        DateOnly? expiryDate,
        DateOnly today,
        int minimumValidityDays = 0);
}
```

- [ ] **Step 1: Write the failing tests**

```csharp
[Theory]
[InlineData(DocumentReviewStatus.Draft, DocumentValidityState.Pending)]
[InlineData(DocumentReviewStatus.Submitted, DocumentValidityState.Pending)]
[InlineData(DocumentReviewStatus.Rejected, DocumentValidityState.Rejected)]
public void NonVerifiedStatusesMapDirectly(DocumentReviewStatus status, DocumentValidityState expected)

[Fact] public void VerifiedOnNonExpiringType_IsValid()
[Fact] public void VerifiedExpiringType_WithNullExpiry_IsPending()      // Review Focus 1
[Fact] public void ExpiryYesterday_IsExpired()
[Fact] public void ExpiryToday_IsValid()                                 // the boundary: a card is good on its last day
[Fact] public void ExpiryInsideMinimumValidityWindow_IsExpiringSoon()
[Fact] public void MinimumValidityLongerThanRemainingLife_IsExpiringSoon_NotExpired()  // Review Focus 3
[Fact] public void ExpiryExactlyAtMinimumValidityBoundary_IsExpiringSoon()
```

Use `new DateOnly(2026, 11, 15)` as `today` throughout so the assertions read plainly.

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter DocumentValidityTests`
Expected: compile failure, `DocumentValidity` does not exist.

- [ ] **Step 3: Implement `Evaluate`**

Order the branches as the spec lists them. `Expired` wins over `ExpiringSoon`. `ExpiringSoon` applies only when `minimumValidityDays > 0`, and is then `expiryDate <= today.AddDays(minimumValidityDays)` once not expired. The `minimumValidityDays > 0` guard is what keeps a document expiring exactly today `Valid` under the default minimum of zero: a caller asking for no remaining validity has no soon-window, so a card stays valid through its last day.

- [ ] **Step 4: Run to verify they pass**

Run: `dotnet test GatePass.sln --filter DocumentValidityTests`
Expected: PASS, 10 cases (3 theory rows plus 7 facts).

- [ ] **Step 5: Commit**

```bash
git add GatePass.Application/Documents GatePass.Tests/DocumentValidityTests.cs
git commit -m "feat: add derived document validity evaluation"
```

---

### Task 4: `DocumentRequirementEvaluator`

Resolves which requirements apply to a person and whether each is satisfied. Takes already-loaded data so it stays pure and testable; Task 6 does the loading.

**Files:**
- Create: `GatePass.Application/Documents/DocumentRequirementEvaluator.cs`, `GatePass.Application/Documents/DocumentRequirementModels.cs`
- Test: `GatePass.Tests/DocumentRequirementEvaluatorTests.cs`

**Interfaces:**
- Consumes: Task 3's `DocumentValidity`, Task 1's enums.
- Produces:

```csharp
public sealed record PersonScope(
    string UserId, string? TenantId, UserRole? Role, string? JobPositionId,
    IReadOnlyCollection<string> SiteIds, IReadOnlyCollection<string> ProjectIds);

public sealed record RequirementCandidate(
    string DocumentTypeId, RequirementScopeKind ScopeKind, string? ScopeId,
    RequirementEnforcement Enforcement, int MinimumValidityDays, DateTimeOffset? AppliesFromUtc);

public sealed record DocumentCandidate(
    string DocumentId, string DocumentTypeId, DocumentReviewStatus ReviewStatus,
    bool TypeExpires, DateOnly? ExpiryDate, MedicalFitnessOutcome? MedicalOutcome,
    string? VerifiedForTenantId, bool VerificationIsPortable, DocumentCategory Category);

public sealed record WaiverCandidate(
    string DocumentTypeId, RequirementScopeKind ScopeKind, string? ScopeId,
    DateTimeOffset ValidFromUtc, DateTimeOffset ValidToUtc, bool IsRevoked);

public sealed record RequirementOutcome(
    string DocumentTypeId, RequirementEnforcement Enforcement,
    DocumentValidityState State, string? DocumentId, bool IsWaived);

public static class DocumentRequirementEvaluator
{
    public static IReadOnlyList<RequirementCandidate> Applicable(
        PersonScope person, IReadOnlyCollection<RequirementCandidate> all, DateTimeOffset now);

    public static IReadOnlyList<RequirementOutcome> Evaluate(
        PersonScope person,
        IReadOnlyCollection<RequirementCandidate> requirements,
        IReadOnlyCollection<DocumentCandidate> documents,
        IReadOnlyCollection<WaiverCandidate> waivers,
        DateTimeOffset now);
}
```

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public void TenantScopedRequirement_AppliesToEveryoneInThatTenant()
[Fact] public void TenantScopedRequirement_DoesNotApplyToAnotherTenantsPerson()
[Fact] public void SiteRequirement_AppliesOnlyWhenPersonHasThatSite()
[Fact] public void JobPositionRequirement_AppliesOnlyToThatPosition()
[Fact] public void RequirementNotYetInForce_IsExcluded()                     // AppliesFromUtc in the future
[Fact] public void PersonWithNullTenant_EvaluatesWithoutThrowing()           // Review Focus 4
[Fact] public void NoDocument_IsMissing()
[Fact] public void BestOfSeveralDocumentsWins_ExpiredAndCurrent_IsValid()    // Review Focus 2
[Fact] public void UnfitMedical_IsBarred_NotRejected_EvenWhenVerifiedAndCurrent()
[Fact] public void OtherTenantsVerification_SatisfiesPortableIdentityType()
[Fact] public void OtherTenantsVerification_DoesNotSatisfyNonPortableType()
[Fact] public void ActiveWaiver_ReportsWaived_NotValid()
[Fact] public void ExpiredWaiver_LeavesStateUnchanged()
[Fact] public void RevokedWaiver_LeavesStateUnchanged()
[Fact] public void WaiverForAnotherSite_DoesNotApply()
```

"Best" ordering, asserted by `BestOfSeveralDocumentsWins`: `Valid` > `ExpiringSoon` > `Waived` > `Pending` > `Expired` > `Barred` > `Rejected` > `Missing`.

Ranking is not the whole rule. A verified, still-current medical document whose outcome is `Unfit` decides its type's outcome *before* ranking: the requirement is `Barred` and reports that document's id, whatever else the person holds. Otherwise a worker found unfit last week would be carried through the gate by a certificate issued last year that has not yet expired. `[Fact] public void UnfitMedical_DominatesAnotherValidDocumentOfTheSameType()`.

Every `DocumentCandidate` carries the `UserId` it belongs to, and `Evaluate` throws `ArgumentException` naming the document when one does not match the person — at a gate a throw denies entry, so a loader that mixed two people fails closed and loudly instead of passing someone on another's papers. `[Fact] public void DocumentForAnotherPerson_Throws()`.

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter DocumentRequirementEvaluatorTests`
Expected: compile failure.

- [ ] **Step 3: Implement both methods**

`Applicable` filters by scope match and `AppliesFromUtc <= now`. A `Tenant`-scoped rule matches when its `ScopeId` equals the person's `TenantId`; a person with a null `TenantId` matches no `Tenant`-scoped rule and must not throw. `Evaluate` walks the applicable requirements, picks each type's best document by the ordering above, maps a verified and current medical document whose outcome is `Unfit` to `DocumentValidityState.Barred` so the caller can say the outcome bars the work rather than that the document was rejected, then applies an active matching waiver to any unsatisfied outcome, setting `State = Waived` and `IsWaived = true`. `Barred` sits between `Expired` and `Rejected` in the best-document ordering.

- [ ] **Step 4: Run to verify they pass**

Run: `dotnet test GatePass.sln --filter DocumentRequirementEvaluatorTests`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Application/Documents GatePass.Tests/DocumentRequirementEvaluatorTests.cs
git commit -m "feat: add document requirement evaluation"
```

---

### Task 5: Catalog seed

**Files:**
- Create: `GatePass.Infrastructure/Persistence/Seed/DocumentCatalogSeed.cs`
- Test: `GatePass.Tests/DocumentCatalogSeedTests.cs`

**Interfaces:**
- Produces: `DocumentCatalogSeed.BuildDefaults(string? tenantId)` returning `IReadOnlyList<DocumentType>`, and `DocumentCatalogSeed.MedicalRestrictionCodes` as `IReadOnlyList<string>`.

- [ ] **Step 1: Write the failing test**

```csharp
[Fact] public void Defaults_CoverEverySeededTypeInTheSpec()          // 13 types, asserted by Code
[Fact] public void HealthTypes_DefaultToEvidenceNone()
[Fact] public void IdentityTypes_ArePortable_AndCompetencyTypesAreNot()
[Fact] public void RetentionDays_MatchTheSpec()                      // 365 / 1095 / 1095 / 90
[Fact] public void RestrictionCodes_AreTheEightInTheSpec()
```

Codes: `CIVIL_ID`, `PASSPORT`, `RESIDENCE_CARD`, `LABOUR_CARD`, `MED_PRE_EMPLOYMENT`, `MED_PERIODIC`, `MED_SITE_SPECIFIC`, `VACCINATION`, `DRUG_ALCOHOL`, `WORKER_PHOTO`, `INSURANCE`, `WORK_PERMIT`, `OTHER`.

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test GatePass.sln --filter DocumentCatalogSeedTests`
Expected: compile failure.

- [ ] **Step 3: Implement the seed**

`CIVIL_ID` and `RESIDENCE_CARD` set `RequiresBothSides` and `RequiresUniqueNumber`. `WORKER_PHOTO` does not expire. Everything in `Medical` gets `Sensitivity = Health`, `EvidenceRequirement = None`, `VerificationIsPortable = false`.

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test GatePass.sln --filter DocumentCatalogSeedTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Infrastructure/Persistence/Seed/DocumentCatalogSeed.cs GatePass.Tests/DocumentCatalogSeedTests.cs
git commit -m "feat: seed the document type catalog"
```

---

### Task 6: `PersonDocumentQueryService`

Loads what the evaluator needs and returns a per-person compliance view. This is the single read path that clearance, the gate and the API all use.

**Files:**
- Create: `GatePass.Application/Abstractions/Documents/IPersonDocumentQueryService.cs`, `GatePass.Application/DTOs/Documents/PersonDocumentDtos.cs`, `GatePass.Infrastructure/Services/PersonDocumentQueryService.cs`
- Modify: `GatePass.Infrastructure/Modules/InfrastructureModuleRegistration.cs`
- Test: `GatePass.Tests/PersonDocumentQueryServiceTests.cs`

**Interfaces:**
- Consumes: Tasks 2, 3, 4.
- Produces:

```csharp
public interface IPersonDocumentQueryService
{
    Task<PersonComplianceDto> GetComplianceAsync(
        string userId, string? againstSiteId = null, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PersonDocumentDto>> ListAsync(
        string userId, CancellationToken cancellationToken = default);
}
```

`PersonComplianceDto` carries `UserId`, `IReadOnlyList<RequirementStatusDto> Requirements` and `IReadOnlyList<PersonDocumentDto> OtherDocuments`. `RequirementStatusDto` carries `DocumentTypeId`, `DocumentTypeName`, `Category`, `Enforcement`, `State` (the enum name as a string), `DocumentId`, `ExpiryDate`, `IsWaived`, `MedicalOutcome` and `Restrictions`. `PersonDocumentDto` mirrors `PersonDocument` minus `NumberHash`, plus `Files` as `PersonDocumentFileDto` (`Id`, `Side`, `FileName`, `ContentType`, `SizeBytes`) and `CanViewFiles`.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public async Task Compliance_ListsMissingRequirementsForAPersonWithNoDocuments()
[Fact] public async Task Compliance_AgainstSite_IncludesThatSitesRequirementsOnly()
[Fact] public async Task Compliance_SeparatesHeldNonRequiredDocumentsIntoOtherDocuments()
[Fact] public async Task List_OmitsNumberHash_AndIncludesFiles()
```

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter PersonDocumentQueryServiceTests`
Expected: compile failure.

- [ ] **Step 3: Implement the service**

**Exclude superseded documents from the candidate list** — any `PersonDocument` whose `SupersededByDocumentId` is set. This is load-bearing, not tidiness: a verified, current medical document whose outcome is `Unfit` dominates its type, so without this exclusion a worker found unfit and later genuinely recovered stays barred until the old finding expires. Verifying the newer certificate supersedes the old one, and that is what clears them. `[Fact] public async Task Compliance_IgnoresSupersededDocuments()`, and one asserting a superseded unfit medical no longer bars.

Also set role scope ids from the role *name*, never the numeric enum value, since the evaluator compares against `Role.ToString()`.

Build `PersonScope` from the user, their `WorkerEmployment` job position and, when `againstSiteId` is given, that one site; otherwise every site visible through `IAccessScopeResolver`. Project the three candidate record types straight out of EF with `AsNoTracking`, call the evaluator, and map. `CanViewFiles` comes from Task 8's rules — until then set it from `Sensitivity != Health`, and Task 8 replaces that line.

- [ ] **Step 4: Register and run**

Run: `dotnet test GatePass.sln --filter PersonDocumentQueryServiceTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Application/Abstractions/Documents GatePass.Application/DTOs/Documents GatePass.Infrastructure/Services/PersonDocumentQueryService.cs GatePass.Infrastructure/Modules/InfrastructureModuleRegistration.cs GatePass.Tests/PersonDocumentQueryServiceTests.cs
git commit -m "feat: add person document compliance query service"
```

---

### Task 7: `PersonDocumentService` — create, attach files, review, supersede

**Files:**
- Create: `GatePass.Application/Abstractions/Documents/IPersonDocumentService.cs`, `GatePass.Infrastructure/Services/PersonDocumentService.cs`
- Modify: `GatePass.Infrastructure/Modules/InfrastructureModuleRegistration.cs`
- Test: `GatePass.Tests/PersonDocumentServiceTests.cs`

**Interfaces:**
- Produces:

```csharp
public sealed record CreatePersonDocumentRequest(
    string DocumentTypeId, string? Number, string? IssuingCountry, string? IssuingAuthority,
    DateOnly? IssueDate, DateOnly? ExpiryDate, MedicalFitnessOutcome? MedicalOutcome,
    IReadOnlyCollection<string>? MedicalRestrictions, string? ExaminerName,
    string? ExaminingFacility, bool Attest);

public interface IPersonDocumentService
{
    Task<PersonDocumentDto> CreateAsync(string userId, CreatePersonDocumentRequest request, CancellationToken ct = default);
    Task<PersonDocumentDto> AttachFileAsync(string documentId, DocumentFileSide side, string fileName, string contentType, Stream content, CancellationToken ct = default);
    Task<PersonDocumentDto> SubmitAsync(string documentId, CancellationToken ct = default);
    Task<PersonDocumentDto> ReviewAsync(string documentId, DocumentReviewStatus decision, string? note, CancellationToken ct = default);
    Task DeleteAsync(string documentId, CancellationToken ct = default);
    Task DeleteFileAsync(string fileId, CancellationToken ct = default);
}
```

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public async Task Create_RequiresNumber_WhenTypeRequiresIt()
[Fact] public async Task Create_RequiresExpiry_WhenTypeExpires()
[Fact] public async Task Create_PrefillsExpiryFromDefaultValidityDays_WhenIssueDateGivenAndExpiryOmitted()
[Fact] public async Task Create_RejectsDuplicateNumberOnTypesRequiringUniqueness()
[Fact] public async Task Create_RequiresMedicalOutcome_ForHealthTypes()
[Fact] public async Task Create_RejectsUnknownRestrictionCode()
[Fact] public async Task Create_RecordsAttestation_WhenAttestIsTrue()
[Fact] public async Task AttachFile_RefusedOnHealthTypeWithEvidenceNone()
[Fact] public async Task AttachFile_StoresSha256()
[Fact] public async Task Review_Verify_SetsVerifiedForTenant_AndWritesAHumanReviewCheck()
[Fact] public async Task Review_Verify_SupersedesThePreviousVerifiedDocumentOfTheSameType()
[Fact] public async Task Review_Reject_RequiresANote()
[Fact] public async Task Review_RefusedForContractorAdmin()
[Fact] public async Task Submit_RefusedWhenTypeRequiresEvidenceAndNoFileAttached()
```

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter PersonDocumentServiceTests`
Expected: compile failure.

- [ ] **Step 3: Implement the service**

Mirror `WorkerDocumentService`'s shape: `ICurrentUserService`, `IAccessScopeResolver`, `IFileStorage`, optional `IAuditLogWriter` and `IRegistrationProgressRecorder`. Reuse its file name and content type limits (512 and 255) and its `EnsureCanManage` / `EnsureWorkerInScopeAsync` pattern. `NumberHash` is SHA-256 of the trimmed uppercased number. Reviewing is limited to `Admin`, `OperatorAdmin` and `Manager`, as `WorkerClearanceService.EnsureCanReview` already does. Verifying writes a `DocumentVerificationCheck` with `Method = HumanReview`, sets `VerifiedForTenantId` from the reviewer's tenant, and sets `SupersededByDocumentId` on the previous verified document of that type for that person. Record `RegistrationStage.EvidenceStarted` on the first file, matching the existing behaviour tested in `WorkerDocumentServiceTests`.

- [ ] **Step 4: Register and run**

Run: `dotnet test GatePass.sln --filter PersonDocumentServiceTests`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Application/Abstractions/Documents/IPersonDocumentService.cs GatePass.Infrastructure/Services/PersonDocumentService.cs GatePass.Infrastructure/Modules GatePass.Tests/PersonDocumentServiceTests.cs
git commit -m "feat: add person document service"
```

---

### Task 8: File access rules and the access log

**Files:**
- Create: `GatePass.Application/Documents/DocumentFileAccessRules.cs`, `GatePass.Infrastructure/Services/PersonDocumentFileService.cs`, `GatePass.Application/Abstractions/Documents/IPersonDocumentFileService.cs`
- Modify: `GatePass.Infrastructure/Services/PersonDocumentQueryService.cs` (the `CanViewFiles` line from Task 6)
- Test: `GatePass.Tests/DocumentFileAccessRulesTests.cs`, `GatePass.Tests/PersonDocumentFileServiceTests.cs`

**Interfaces:**
- Produces:

```csharp
public static class DocumentFileAccessRules
{
    public static bool CanViewFiles(
        CurrentUser currentUser, DocumentSensitivity sensitivity,
        string documentOwnerUserId, bool ownerIsInCurrentUsersContractor);
}

public interface IPersonDocumentFileService
{
    Task<PersonDocumentFileDownload> OpenAsync(string fileId, string? purpose, CancellationToken ct = default);
}
```

`PersonDocumentFileDownload` is `(Stream Content, string FileName, string ContentType)`, matching `WorkerDocumentDownload`.

- [ ] **Step 1: Write the failing tests**

```csharp
// DocumentFileAccessRulesTests — one case per role per sensitivity
[Fact] public void Owner_CanViewTheirOwnFiles_Health()
[Fact] public void Admin_AndOperatorAdmin_CanViewHealthFiles()
[Fact] public void Manager_CannotViewHealthFiles()
[Fact] public void ContractorAdmin_CanViewOwnWorkersNormalFiles()
[Fact] public void ContractorAdmin_CannotViewHealthFiles()
[Fact] public void ContractorAdmin_CannotViewAnotherContractorsFiles()
[Fact] public void Gate_CannotViewAnyFiles()

// PersonDocumentFileServiceTests
[Fact] public async Task Open_WritesAnAccessLogRow()
[Fact] public async Task Open_RefusedForContractorAdminOnHealthFile_AndStillLogsTheAttempt()  // Review Focus 5
```

The refusal test asserts both the `ForbiddenException` and that a `DocumentFileAccessLogs` row exists with `Purpose` recording the denial.

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter "DocumentFileAccessRulesTests|PersonDocumentFileServiceTests"`
Expected: compile failure.

- [ ] **Step 3: Implement the rules and the file service**

`OpenAsync` loads the file with its document and type, resolves whether the owner sits in the current user's contractor, writes the access log row **before** throwing or returning, then enforces. Replace Task 6's placeholder `CanViewFiles` line with a call to the rules.

- [ ] **Step 4: Run to verify they pass**

Run: `dotnet test GatePass.sln --filter "DocumentFileAccessRulesTests|PersonDocumentFileServiceTests"`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Application/Documents/DocumentFileAccessRules.cs GatePass.Application/Abstractions/Documents/IPersonDocumentFileService.cs GatePass.Infrastructure/Services/PersonDocumentFileService.cs GatePass.Infrastructure/Services/PersonDocumentQueryService.cs GatePass.Infrastructure/Modules GatePass.Tests/DocumentFileAccessRulesTests.cs GatePass.Tests/PersonDocumentFileServiceTests.cs
git commit -m "feat: enforce and log document file access"
```

---

### Task 9: Waivers

**Files:**
- Create: `GatePass.Application/Abstractions/Documents/IDocumentExceptionService.cs`, `GatePass.Infrastructure/Services/DocumentExceptionService.cs`
- Modify: `GatePass.Application/DTOs/Documents/PersonDocumentDtos.cs` (add `DocumentExceptionDto`)
- Test: `GatePass.Tests/DocumentExceptionServiceTests.cs`

**Interfaces:**
- Produces:

```csharp
public sealed record DocumentExceptionDto(
    string Id, string UserId, string DocumentTypeId, string DocumentTypeName,
    string ScopeKind, string? ScopeId, string Reason,
    DateTimeOffset ValidFromUtc, DateTimeOffset ValidToUtc,
    string? GrantedByUserId, DateTimeOffset GrantedAtUtc, bool IsRevoked);

public interface IDocumentExceptionService
{
    Task<DocumentExceptionDto> GrantAsync(
        string userId, string documentTypeId, RequirementScopeKind scopeKind, string? scopeId,
        string reason, DateTimeOffset validToUtc, CancellationToken ct = default);
    Task RevokeAsync(string exceptionId, CancellationToken ct = default);
    Task<IReadOnlyList<DocumentExceptionDto>> ListActiveAsync(CancellationToken ct = default);
}
```

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public async Task Grant_RequiresAReason()
[Fact] public async Task Grant_RejectsAWindowLongerThanThirtyDays()
[Fact] public async Task Grant_RejectsAnEndDateInThePast()
[Fact] public async Task Grant_RefusedForContractorAdmin()
[Fact] public async Task Grant_WritesAnAuditEvent()
[Fact] public async Task Revoke_SetsRevokedByAndAt_AndWritesAnAuditEvent()
[Fact] public async Task ListActive_ExcludesExpiredAndRevoked()
```

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter DocumentExceptionServiceTests`
Expected: compile failure.

- [ ] **Step 3: Implement the service**

Granting is limited to `Admin`, `OperatorAdmin` and `Manager`. `ValidFromUtc` is now. Audit events go through `IAuditLogWriter` in the style `WorkerClearanceService` already uses.

- [ ] **Step 4: Run to verify they pass**

Run: `dotnet test GatePass.sln --filter DocumentExceptionServiceTests`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Application/Abstractions/Documents/IDocumentExceptionService.cs GatePass.Infrastructure/Services/DocumentExceptionService.cs GatePass.Infrastructure/Modules GatePass.Tests/DocumentExceptionServiceTests.cs
git commit -m "feat: add time-boxed document requirement waivers"
```

---

### Task 10: Rewire clearance, the gate scan and the expiry sweep

The point of phase 1: enforcement moves onto the new model and starts honouring expiry.

**Files:**
- Modify: `GatePass.Infrastructure/Services/WorkerClearanceService.cs` (`EnsureEvidenceIsVerifiedAsync`, lines ~152-193), `GatePass.Infrastructure/Services/ScanService.Certifications.cs`, `GatePass.Infrastructure/BackgroundJobs/OperationalJobProcessor.Credentials.cs`
- Test: `GatePass.Tests/WorkerClearanceServiceTests.cs`, `GatePass.Tests/ScanServiceTests.cs`, `GatePass.Tests/OperationalJobProcessorTests.cs` (extend the existing classes)

**Interfaces:**
- Consumes: `IPersonDocumentQueryService.GetComplianceAsync`.

- [ ] **Step 1: Write the failing tests**

```csharp
// WorkerClearanceServiceTests
[Fact] public async Task Clearance_RefusedWhenARequiredIdentityDocumentHasExpired()   // the hole phase 1 closes
[Fact] public async Task Clearance_RefusalMessage_NamesEachUnsatisfiedRequirementAndWhy()
[Fact] public async Task Clearance_AllowedOnAWaiver_AndRecordsItInTheClearanceNote()
[Fact] public async Task Clearance_WarningRequirement_DoesNotBlock()

// ScanServiceTests
[Fact] public async Task Scan_ReportsExpiredRequiredDocumentAsExpired_NotVerified()
[Fact] public async Task Scan_SurfacesMedicalRestrictionsSeparatelyFromCredentials()

// OperationalJobProcessorTests
[Fact] public async Task ExpirySweep_RaisesOneAlertPerExpiringPersonDocument()
[Fact] public async Task ExpirySweep_IsIdempotent_UsingExpiryAlertRaisedAtUtc()
```

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter "WorkerClearanceServiceTests|ScanServiceTests|OperationalJobProcessorTests"`
Expected: the new tests fail; the existing ones in those classes still pass.

- [ ] **Step 3: Rewrite the three call sites**

`EnsureEvidenceIsVerifiedAsync` calls `GetComplianceAsync` and throws `BadRequestException` listing each `Blocking` requirement whose state is not satisfied, with the reason per state: missing, awaiting review, rejected, expired on a date, or barred by a medical outcome. A satisfied-by-waiver requirement appends a line to `ClearanceNote` instead of blocking. `ScanService.Certifications` builds its `ScanCredentialDto` rows from the compliance view, keeping the DTO shape unchanged, and adds a `Restrictions` collection to the scan result. The sweep queries `PersonDocuments` by `ExpiryDate` and `ExpiryAlertRaisedAtUtc` in place of its three current queries.

- [ ] **Step 4: Run the whole suite**

Run: `dotnet test GatePass.sln`
Expected: PASS. Existing tests that asserted the old clearance messages will need their expected strings updated; update them, do not weaken the assertions.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Infrastructure/Services/WorkerClearanceService.cs GatePass.Infrastructure/Services/ScanService.Certifications.cs GatePass.Infrastructure/BackgroundJobs/OperationalJobProcessor.Credentials.cs GatePass.Tests
git commit -m "feat: enforce document expiry in clearance, gate scan and expiry alerts"
```

---

### Task 11: API endpoints and legacy shims

**Files:**
- Create: `GatePass.Api/Controllers/PersonDocumentsController.cs`, `GatePass.Api/Controllers/DocumentCatalogController.cs`
- Modify: `GatePass.Api/Controllers/WorkerDocumentsController.cs`
- Test: `GatePass.IntegrationTests/PersonDocumentsApiTests.cs`, `GatePass.IntegrationTests/WorkerDocumentsLegacyApiTests.cs`

**Interfaces:**
- Consumes: Tasks 6-9.

- [ ] **Step 1: Write the failing tests**

```csharp
// PersonDocumentsApiTests
[Fact] public async Task GetCompliance_ReturnsRequirementsWithStates()
[Fact] public async Task CreateThenAttachThenReview_RoundTrips()
[Fact] public async Task GetFile_IsForbiddenForAContractorAdminOnAHealthDocument()

// WorkerDocumentsLegacyApiTests — the Flutter app must not break
[Fact] public async Task LegacyList_ReturnsTheSameShapeAsBeforeTheMigration()
[Fact] public async Task LegacyUpload_CreatesAPersonDocument()
[Fact] public async Task LegacyReview_VerifiesThroughTheNewService()
```

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter "PersonDocumentsApiTests|WorkerDocumentsLegacyApiTests"`
Expected: FAIL.

- [ ] **Step 3: Add the controllers and reimplement the legacy one**

Routes exactly as the spec's API section lists them. `WorkerDocumentsController` keeps its four routes and its response shape, delegating to `IPersonDocumentService` and mapping `WorkerDocumentType` to a catalog `Code` (`IdDocument`→`CIVIL_ID`, `Certificate`→the competency type carrying the given `certificateTypeId`, `MedicalFitness`→`MED_PERIODIC`, `Photo`→`WORKER_PHOTO`, `TrainingRecord`/`CompetencyEvidence`/`Other`→`OTHER`).

- [ ] **Step 4: Run to verify they pass**

Run: `dotnet test GatePass.sln --filter "PersonDocumentsApiTests|WorkerDocumentsLegacyApiTests"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Api/Controllers GatePass.IntegrationTests
git commit -m "feat: add person document endpoints and keep the legacy shape working"
```

---

### Task 12: Migration and configuration conversion

Last, so the model has stopped moving.

**The owner has authorised resetting the production database — the data there is still insignificant — so there is no person-data backfill.** No identity merge, no `UserCertificate` conversion, no `WorkerDocument` conversion, no medical-files report, no rehearsal against a production copy. That was the riskiest work in the plan and it now buys nothing.

What must still be converted is **configuration**, because it is what makes the system require anything at all. `SiteCertificateRequirement` and `JobPositionCredentialRequirement` are the only record of which certificates a site or a job demands, and Task 10 rewires the gate and clearance to read `DocumentRequirement` instead. Convert nothing and those requirements silently become "nothing is required" — a fail-open on the exact path this phase exists to tighten. Configuration conversion is also cheap and safe: a handful of rows, no files, no person data.

**Files:**
- Create: `GatePass.Infrastructure/Persistence/Migrations/20261115120000_AddPersonDocuments.cs`, `GatePass.Infrastructure/Persistence/Migrations/DocumentConfigurationConversion.cs`
- Modify: `GatePass.Infrastructure/Persistence/Migrations/GatePassDbContextModelSnapshot.cs`, and the seeder so a freshly created database produces the new catalog and requirements directly
- Test: `GatePass.Tests/DocumentConfigurationConversionTests.cs`

**Interfaces:**
- Produces: `DocumentConfigurationConversion.RunAsync(GatePassDbContext db, CancellationToken ct)` returning `ConversionReport(int DocumentTypes, int Requirements, IReadOnlyList<string> Skipped)`.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public async Task Conversion_CreatesOneCompetencyDocumentTypePerCertificateType_ReusingItsId()
[Fact] public async Task Conversion_CarriesTheCertificateTypeName()
[Fact] public async Task Conversion_TurnsSiteRequirementsIntoBlockingDocumentRequirements()
[Fact] public async Task Conversion_TurnsJobPositionRequirementsIntoRequirements_KeepingMinimumValidityDays()
[Fact] public async Task Conversion_WritesTheTenantIdIntoScopeId_ForTenantScopedRules()
[Fact] public async Task Conversion_SeedsTheCatalogForEveryExistingTenant()
[Fact] public async Task Conversion_IsIdempotent_RunningTwiceChangesNothing()
[Fact] public async Task Conversion_LeavesTheLegacyTablesIntact()
[Fact] public async Task Conversion_ReportsWhatItSkipped_InsteadOfDroppingItSilently()
```

Idempotency still matters — the migration may be re-run against a database that already has the tables — but it is now idempotency over a dozen configuration rows rather than over every person's documents.

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter DocumentConfigurationConversionTests`
Expected: compile failure.

- [ ] **Step 3: Write the conversion**

Plain EF, in this order. First, one `Competency` `DocumentType` per existing `CertificateType`, reusing `CertificateType.Id` as the new `DocumentType.Id` so existing references survive, with `Expires = true`, `VerificationIsPortable = false`, `RetentionDays = 1095` and `Name` copied across. Then one `DocumentRequirement` per `SiteCertificateRequirement` (`ScopeKind.Site`, `ScopeId` the site id, `Blocking`) and per `JobPositionCredentialRequirement` (`ScopeKind.JobPosition`, keeping `MinimumValidityDays`). Skip, and report, any row whose certificate type is missing. Nothing is deleted and the legacy tables stay readable.

No person documents are created. A reset database starts with no one holding anything, which is the correct state: every worker reads as `Missing` until their documents are uploaded and reviewed, and that is the behaviour this phase is for.

- [ ] **Step 4: Write the migration**

`CreateTable` for the seven tables matching the Task 2 configuration, then seed the catalog for every existing tenant through `DocumentCatalogSeed`, then `DocumentConfigurationConversion`. `Down` drops the seven tables only, so the legacy tables and their data are untouched either way.

- [ ] **Step 5: Make a fresh database correct too**

Update the seeder so a database created from scratch — a developer's local one, or production after a reset — produces the document catalog and the `DocumentRequirement` rows directly, rather than depending on the conversion having run over legacy configuration. Without this, a reset production comes up requiring nothing.

Verify by creating an empty database and running the API against it: the catalog is present, and a seeded site's requirements appear as `DocumentRequirement` rows.

- [ ] **Step 6: Run the whole suite**

Run: `dotnet test GatePass.sln`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add GatePass.Infrastructure/Persistence/Migrations GatePass.Tests/DocumentConfigurationConversionTests.cs
git commit -m "feat: add person document tables and convert certificate configuration"
```

---

### Task 13: Retention disposal job

**Files:**
- Create: `GatePass.Infrastructure/BackgroundJobs/DocumentRetentionProcessor.cs`
- Modify: `GatePass.Infrastructure/BackgroundJobs/OperationalJobsOptions.cs`, `GatePass.Infrastructure/Modules/InfrastructureModuleRegistration.cs`
- Test: `GatePass.Tests/DocumentRetentionProcessorTests.cs`

**Interfaces:**
- Produces: `DocumentRetentionProcessor.RunAsync(CancellationToken ct)` returning `int` disposed.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public async Task Disposes_ASupersededDocumentPastItsRetention()
[Fact] public async Task Disposes_AnExpiredDocumentPastItsRetention()
[Fact] public async Task Leaves_ACurrentDocumentAlone()
[Fact] public async Task Leaves_AnExpiredDocumentInsideItsRetention()
[Fact] public async Task Clears_NumberIssuerAndExaminer_ButKeepsDatesAndOutcome()
[Fact] public async Task QueuesFileDeletionThroughTheExistingStorageQueue()
[Fact] public async Task DoesNotTouchAccessLogsOrAuditEvents()
[Fact] public async Task SkipsTypesWithNoRetentionDays()
```

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test GatePass.sln --filter DocumentRetentionProcessorTests`
Expected: compile failure.

- [ ] **Step 3: Implement the processor**

Follow `StorageDeletionProcessor`'s shape and hand files to the existing deletion queue rather than deleting them inline. Clear `Number`, `NumberHash`, `IssuingAuthority`, `ExaminerName` and `ExaminingFacility`; keep the type, the dates, the review outcome and the medical outcome.

- [ ] **Step 4: Run to verify they pass**

Run: `dotnet test GatePass.sln --filter DocumentRetentionProcessorTests`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add GatePass.Infrastructure/BackgroundJobs GatePass.Infrastructure/Modules GatePass.Tests/DocumentRetentionProcessorTests.cs
git commit -m "feat: dispose of documents past their retention period"
```

---

## Done when

`dotnet build GatePass.sln` and `dotnet test GatePass.sln` are clean, an empty database comes up with the catalog and its site requirements seeded, and a worker whose Civil ID expired yesterday is refused clearance — which is the defect phase 1 exists to fix.

Because production is being reset rather than migrated, the deploy has one extra step the plan cannot do for you: reseed the demo tenant afterwards. The Nama demo data (28 users across every role) was seeded through the API, so it has to be re-created the same way once the new schema is live.

Phase 2 (the documents tab, the add/renew dialog and the review inbox) gets its own plan.
