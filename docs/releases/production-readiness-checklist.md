# Production Readiness Release Checklist

Release candidate: `production-readiness`

## Automated gates

- [ ] Production dependency audit has no High/Critical finding.
- [ ] Unit tests pass.
- [ ] TypeScript passes.
- [ ] ESLint passes.
- [ ] Security release boundary check passes.
- [ ] Production build passes.
- [ ] Public login/mobile/keyboard Playwright smoke passes.
- [ ] Complete local Supabase starts from repository configuration and applies all migrations.
- [ ] Authenticated Role Context browser UAT passes.
- [ ] Activity create/assign browser UAT passes.
- [ ] Final Impact Report PDF is exactly two A4 pages.
- [ ] All SQL acceptance suites Phase 1–10 pass from a clean database.
- [ ] CodeQL JavaScript/TypeScript security-extended analysis completes without unresolved release-blocking finding.

## Security invariants

- [ ] Every public tenant table containing `organization_id` has RLS enabled.
- [ ] `activity.final_decision` is Committee Chair only.
- [ ] Methodology and external-AI privacy approval remain Management Approver controls.
- [ ] Audit mutation guard + chain verifier are installed.
- [ ] No broad authenticated Storage object SELECT/INSERT policy remains for `cpd-documents`.
- [ ] Sensitive document bytes use server-only Storage access after application authorization.
- [ ] Service-role key is never public-prefixed or referenced by a client component.
- [ ] External AI cannot be enabled without privacy approval.

## Operational readiness

- [x] Minimal non-sensitive `/api/health` contract implemented.
- [x] Backup/restore runbook documented.
- [x] Deployment runbook documented.
- [x] Incident/rollback guide documented.
- [x] Environment/secret matrix documented.
- [ ] Backup/restore drill completed against the approved staging/production target.
- [ ] Monitoring/error platform selected and configured in the deployment environment.
- [ ] Alert ownership/escalation confirmed for the real deployment.

## Environment / organizational gates — intentionally not fabricated by source code

- [ ] Production Supabase project selected.
- [ ] Production Supabase/data processing region approved.
- [ ] Production hosting target and region approved.
- [ ] Production domain configured.
- [ ] Production secrets stored in the approved hosting secret store.
- [ ] Backup retention / RPO / RTO approved.
- [ ] Independent penetration test completed before real institutional data.
- [ ] PDPL/privacy/legal review completed for the actual deployment/data flows.
- [ ] External AI provider/region approved if external AI is to be enabled; otherwise it remains disabled.
- [ ] Organization-approved official templates/source files/branding loaded and visually QA'd.
- [ ] Manual institutional pilot UAT signed off.

## Release decision

`main` may receive this branch only after every automated gate is green and no unresolved Critical/High code/security blocker remains. Environment/organizational gates may remain unchecked at merge, but they block declaration of **Production Live** and block use of real institutional data.
