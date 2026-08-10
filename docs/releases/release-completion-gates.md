# Release Completion Gates

Status vocabulary:

- `PASS`: verified by source or automated evidence on the current release SHA.
- `FAIL`: verified defect; release must not proceed.
- `EXTERNAL_BLOCKED`: cannot be truthfully completed from source control or CI alone.

| Gate | Status | Evidence / condition |
|---|---|---|
| Unit / type / lint / production build | PENDING | CI on final immutable SHA |
| Dependency high-severity audit | PENDING | `npm audit --omit=dev --audit-level=high` |
| SQL migrations from clean database | PENDING | CI |
| SQL acceptance suites | PENDING | CI |
| Auth + role-context + tenant UAT | PENDING | Complete local Supabase + Playwright |
| Full governed business journey | PENDING | Playwright journey |
| Impact report exact two-page PDF | PENDING | Chromium + pdfjs |
| Committee minutes / annual print QA | PENDING | Chromium PDF tests |
| Storage direct-access boundary | PENDING | Migration + release checker + SQL negative tests |
| Service-role browser exposure | PENDING | Static release checker + browser/build regression |
| External AI disabled by default | PENDING | Migration + release checker |
| CodeQL | PENDING | GitHub CodeQL on final SHA |
| Independent penetration test | EXTERNAL_BLOCKED | Independent assessor required before real-data production use |
| Repository visibility = Private | EXTERNAL_BLOCKED | Current GitHub repository is public; administrative repository-setting change required |
| Production Supabase project + region | EXTERNAL_BLOCKED | Production project/processing-region decision required |
| Production hosting + domain | EXTERNAL_BLOCKED | Hosting account/domain configuration required; no paid service activated automatically |
| Production secret-store configuration | EXTERNAL_BLOCKED | Requires production hosting/Supabase credentials outside source control |
| Production DB + Storage restore drill | EXTERNAL_BLOCKED | Must be executed against the actual production project; local synthetic drill can be PASS separately |
| PDPL/privacy approval for external AI/cross-border processing | EXTERNAL_BLOCKED | Organizational/legal approval required; External AI remains OFF |
| Institutional human UAT/sign-off | EXTERNAL_BLOCKED | Pilot users/owners must sign off before real-data go-live |

## Release classification

`PILOT_CODE_READY` may be issued only after every source-code/CI gate above is `PASS` and there are no unresolved Critical/High source-code findings.

`PRODUCTION_LIVE` must never be issued from repository evidence alone. It requires the external gates above to be completed on the real deployed environment.
