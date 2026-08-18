# Unified Activity Accreditation Dossier — Design Specification

**Date:** 2026-08-18  
**Status:** Approved implementation baseline
**Applies to:** Full Supabase-backed platform and the synthetic Cloudflare Pages demonstration

## 1. Purpose

Create one governed activity dossier that allows authorized users to locate an activity and review every document needed for committee or audit readiness from one screen. The implementation must close the current gap in which activities, committee minutes, impact reports, the official application, and uploaded evidence are spread across separate routes.

The feature must not imply that an internal committee grants SCFHS accreditation. The committee decision remains an internal readiness decision; SCFHS approval and accredited hours remain externally issued outcomes recorded by the platform.

## 2. Governing sources and non-negotiable constraints

1. `SCHS Form (1) 2(2).docx` is the visual and content source of truth for the activity application.
2. The official application remains six US Letter pages (8.5 × 11 inches), with the same page order, labels, tables, colors, controls, and layout as the uploaded source. It is not rebranded or redesigned.
3. `CPD Basic Capsules 102 مصادر تعليمية 2(2).pdf` is guidance for validation and reviewer prompts only. Its text is not copied into the application and it does not supply missing user data.
4. Missing values remain blank. Synthetic values are permitted only in the public demonstration and must be visibly labelled as demonstration data.
5. The final impact report remains exactly two A4 pages. Committee minutes and the annual report use stable A4 print layouts without clipped, overlapping, or off-page content.
6. The annual committee report belongs to the selected year and committee, not to an individual activity. The activity dashboard links to the annual report for the selected year without duplicating it inside every activity dossier.

## 3. Chosen approach

Use a **unified dossier read model** rather than a table of links or a generic file repository.

- The full platform composes the dossier from Supabase activity, department, assignment, evidence, committee, impact, external-tracking, and audit records.
- The Cloudflare demonstration uses synthetic fixtures conforming to the same versioned dossier contract.
- A shared schema and contract tests prevent the two surfaces from silently diverging in fields, document categories, statuses, or role behavior.
- Existing domain records remain authoritative; the dossier does not create duplicate copies of reports or evidence.

## 4. Users and access boundaries

### 4.1 Organization System Administrator

- Can list and open all activities within the active organization.
- Can filter, search, create, assign, and administer activity records and attachments where existing permissions allow.
- Cannot issue the committee chair's scientific decision or finalize committee minutes on the chair's behalf.

### 4.2 Committee Secretary

- Can list and open all activities within the active organization.
- Can review completeness, prepare committee work, draft minutes, and manage permitted evidence records.
- Cannot issue the chair's final decision or finalize minutes.

### 4.3 Committee Chair

- Can list and open all activities within the active organization.
- Can review the complete dossier, issue the final committee decision, and finalize minutes under existing governance rules.
- Cannot administer users, role assignments, or system configuration.

### 4.4 Activity Officer

- Can list and open only activities actively assigned to the current membership in the active organization.
- Can see one assigned activity or multiple assigned activities.
- Can read and download the finalized committee decision/report and committee minutes for an assigned activity.
- Can view and download the official uploaded application.
- Can upload additional attachments and replace a mutable attachment before lock, with version, uploader, timestamp, checksum, and audit event retained.
- Can enter L1–L4 impact-analysis data, link evidence, save a draft, and generate the impact report for an assigned activity.
- Cannot issue the committee decision, finalize committee minutes, or perform another role's final approval.
- After a governed document is finalized, can only use the existing correction-request workflow; direct overwrite is prohibited.

### 4.5 Other roles

This feature does not broaden other roles. Existing report, evidence, audit, management, and committee-member permissions remain unchanged. Direct URL access is denied when the active role lacks the required permission.

## 5. Activity dashboard

The dashboard is available to Organization System Administrator, Committee Secretary, and Committee Chair for all organization activities, and to Activity Officer for assigned activities only.

### 5.1 Filters and search

- Reporting year filter.
- Department filter sourced from the organization's department records.
- Program-name search matching Arabic title, English title, and activity code.
- Filters combine using AND semantics and preserve the active organization boundary.
- Empty results display a clear message rather than synthetic or cross-tenant records.

### 5.2 Activity rows

Each row displays:

- Activity code.
- Arabic title and available English title.
- Department.
- Reporting year and planned date.
- Existing internal lifecycle state.
- Evidence completion count and missing-item count derived from authoritative records.
- Last governed update time.
- Action to open the unified dossier.

The selected year also exposes a separate link to that year's annual committee report.

## 6. Unified activity dossier

The dossier provides the following sections for one activity:

1. **Overview:** activity identity, department, reporting year, type, dates, assigned officer, lifecycle state, internal committee decision, and recorded external SCFHS outcome.
2. **Official application:** filled official application preview, download, provenance, version, and print action.
3. **Committee record:** final decision/report, minutes, version, status, sign-off metadata, preview, and download.
4. **Impact:** L1–L4 inputs, linked evidence, HTVI outputs already defined by the platform, report status, preview, generation, and download.
5. **Attachments:** all additional files for the activity with category, filename, version, size, checksum, uploader, uploaded time, verification state, lock state, preview/download actions, and permitted upload/replace actions.
6. **Readiness:** required-document checklist, evidence completion, unresolved gaps, and a derived readiness state.
7. **Audit timeline:** relevant immutable events for uploads, replacements, committee actions, report generation/finalization, downloads where governed, and correction requests.

No section creates a second authoritative copy of an existing record.

## 7. Readiness rules

Readiness is calculated from records; users do not manually type a readiness percentage.

- A required item is complete only when its current governed version exists and meets its recorded verification requirement.
- A missing, rejected, superseded-without-replacement, or unresolved required item remains incomplete.
- The screen distinguishes file completeness from governance state. For example, having every file does not mean the committee has approved the activity.
- Internal committee approval is labelled as readiness for SCFHS submission, not SCFHS accreditation.
- External SCFHS approval and hours appear only when an external outcome and its evidence have been recorded.
- Final impact completion is a post-activity state and is not incorrectly required for pre-submission committee readiness.

## 8. Official application output

The original six-page form is kept as an immutable template base. Filled values are mapped to defined coordinates/fields without changing the base artwork or structure.

- The full platform generates the filled official PDF from stored activity data and the active approved template/mapping version.
- The demonstration presents a pre-generated synthetic filled example produced from the same mapping contract.
- Long values are constrained to their original fields. The system reports overflow as a validation failure instead of shrinking, clipping, or moving unrelated content without approval.
- The generated output records template version, mapping version, source activity revision, checksum, generated time, and generating user.

## 9. Reports

### 9.1 Final impact report

- Activity-specific.
- Generated from governed impact records and linked evidence.
- Exactly two A4 pages.
- Activity Officer may draft and generate; existing finalization authority remains unchanged.

### 9.2 Committee minutes and decision/report

- Activity-specific and accessible from the dossier.
- Secretary drafts; Chair finalizes and issues the final decision under existing permissions.
- A finalized version is immutable except through the correction workflow.

### 9.3 Annual committee report

- Year/committee-specific, not activity-specific.
- Linked from the dashboard using the selected reporting year.
- Retains its own committee approval and administrative acknowledgement workflow.

## 10. Data and interface contract

A versioned dossier contract defines:

- Activity identity and department.
- Assignment scope.
- Lifecycle and external states.
- Document categories and versions.
- Committee decision and minutes references.
- Impact/report references.
- Readiness counts and gaps.
- Audit metadata.

The contract contains identifiers and metadata, not binary file contents. Signed or authorized storage URLs are resolved only after server-side permission checks. Supabase RLS remains the final tenant and assignment boundary; UI filtering is not treated as a security control.

## 11. Error and empty-state behavior

- Unauthorized activity or document access returns the governed access-denied result without revealing record existence or metadata.
- Missing optional documents show an explicit empty state.
- Missing required documents appear as readiness gaps.
- Failed uploads do not replace the last valid version.
- Unsupported type, excessive size, checksum failure, or storage failure returns a specific error and creates no false completion state.
- Report-generation or form-overflow failures preserve the prior valid output and provide a corrective message.
- Download links are short-lived or server-authorized and are never exposed across organizations.

## 12. Demonstration and full-platform parity

### Cloudflare Pages demonstration

- Uses browser-local synthetic data only.
- Clearly labels the environment as demonstration data.
- Implements the same dashboard fields, filters, role-visible actions, dossier sections, report previews, and print contracts.
- Does not claim persistence, real authentication, or real SCFHS submission.

### Full platform

- Uses authenticated Supabase records, Storage authorization, RLS, immutable versions, and audit commands.
- Does not use demonstration fixtures.

Contract and browser tests compare both surfaces against the same required field and role matrix.

## 13. Acceptance tests

### 13.1 Role and tenant tests

- The three all-activity roles can list every activity in their active organization and no other organization.
- Activity Officer with one assignment sees one activity.
- Activity Officer with multiple assignments sees all and only those activities.
- Activity Officer direct navigation to an unassigned activity or its document is denied.
- Secretary cannot issue the Chair decision or finalize minutes.
- Chair cannot administer organization users or assignments.
- System Administrator cannot finalize the Chair's scientific decision or minutes.

### 13.2 Dashboard tests

- Year, department, and Arabic/English name search work independently and together.
- Search by activity code works.
- Annual-report link follows the selected year.
- Empty results, missing department, and multiple same-name activities remain unambiguous.

### 13.3 Dossier and document tests

- Each dossier displays only documents belonging to the selected activity.
- Official form, minutes/decision, impact report, and additional attachments can be previewed/downloaded when authorized.
- Upload creates a new version and audit event; failed upload preserves the previous version.
- Finalized documents reject direct replacement and permit only the correction workflow.
- Readiness counts match authoritative evidence records and never treat post-activity impact as a pre-submission requirement.

### 13.4 Print tests

- Official application is six US Letter pages and visually matches the approved source template.
- Field overflow is detected before final generation.
- Final impact report is exactly two A4 pages.
- Minutes and annual report have deterministic A4 output with no clipping, overlap, blank spill page, or missing content.
- Arabic, English, mixed-direction text, and mobile preview do not alter print pagination.

### 13.5 Quality gates

- Unit and contract tests.
- Supabase SQL/RLS tests.
- Playwright journeys for the four relevant roles.
- Static demonstration browser tests.
- Typecheck, production build, full CI, and CodeQL/security checks.
- Post-deployment verification of the public Cloudflare URL using synthetic data only.

## 14. Out of scope

- Granting SCFHS accreditation inside the platform.
- Changing the visual design or wording of the uploaded official application.
- Copying CPD guidance text into the application.
- Inventing missing activity, committee, impact, or evidence values.
- Giving Activity Officer access to unassigned activities.
- Duplicating the annual committee report under each activity.
- Broad role changes unrelated to this dossier.
