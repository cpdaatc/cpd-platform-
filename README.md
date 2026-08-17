# CPD Governance, Accreditation Readiness & Impact Intelligence Platform

Independent, Arabic-first CPD governance SaaS MVP.

## Operational demo

[Open the interactive GitHub Pages platform](https://cpdaatc.github.io/cpd-platform-/)

The published demo uses synthetic browser-local data and includes governed role workspaces, editable forms, PDF evidence upload, readiness checks, committee and external-decision registers, HTVI calculation, and A4 report output.

## Zero-cost deployment

The deployment is intentionally split into two free surfaces:

- **Cloudflare Pages:** publishes only `demo/` for investor demonstrations. Its records are synthetic and remain in the visitor's browser.
- **Cloudflare Workers:** runs the authenticated Next.js application through OpenNext and connects to a Supabase Free project.

No service-role or secret key is allowed in Pages, browser code, or source control. See [the Cloudflare + Supabase Free runbook](docs/deployment/cloudflare-supabase-free.md) for setup and cost controls.

## Governance principle

The platform does **not** grant SCFHS accreditation. Internal committee approval means readiness for submission only; external accreditation status is recorded separately when an actual SCFHS decision exists.

## Delivery model

Development is phase-gated:

1. Phase 0 — Freeze pack
2. Phase 1 — Foundation
3. Phase 2 — Intake
4. Phase 3 — AI
5. Phase 4 — Institutional Committee
6. Phase 5 — External tracking
7. Phase 6 — Impact
8. Phase 7 — Annual reporting
9. Phase 8 — Evidence readiness & investor demo

`main` contains approved/stable work. Each implementation phase is developed on its own branch and merged only after verification.
