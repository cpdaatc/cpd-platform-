# Security Policy

## Supported security posture

This repository contains the CPD Governance, Accreditation Readiness & Impact Intelligence Platform source code. The application is designed for tenant isolation, least privilege, private document storage, append-only audit, and explicit role-context separation.

## Non-negotiable boundaries

- Never commit production secrets, credentials, private keys, real participant data, CVs, disclosures, signatures, IDs, or institutional evidence.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `NEXT_PUBLIC_` prefix or be referenced by a Client Component.
- Direct authenticated access to sensitive Storage objects is disabled; sensitive bytes flow through authorized server-only helpers.
- External AI processing remains disabled by default until the organization has approved privacy/data-transfer requirements.
- Internal scientific-committee approval means readiness for external submission only. It is not SCFHS accreditation.
- Audit history is append-only; corrections use governed versioning rather than mutation of finalized records.

## Reporting a vulnerability

Do not disclose security vulnerabilities or sensitive reproduction data in a public GitHub issue. Use the repository owner’s private security-reporting channel or another explicitly approved private channel.

## Release requirement

A release cannot be classified as production-ready for real institutional data while this source repository is publicly visible. Repository visibility is an administrative GitHub setting and must be changed to Private before production secrets or real institutional data are introduced.

Automated security gates and CodeQL reduce risk but do not replace an independent penetration test before production use with real institutional data.
