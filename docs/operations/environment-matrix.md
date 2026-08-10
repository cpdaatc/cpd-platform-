# Environment Matrix

## Rule

No production secret is committed to the repository. Public browser variables are explicitly separated from server-only credentials.

| Variable / decision | Local E2E | Staging | Production | Exposure |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local CLI API URL | staging project URL | production project URL | browser-safe configuration |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local ephemeral anon key | staging public client key | production public client key | browser-safe configuration |
| `SUPABASE_SECRET_KEY` (preferred) or `SUPABASE_SERVICE_ROLE_KEY` | local ephemeral service-role key | secret store only | secret store only | **server-only** |
| `PRODUCTION_BASE_URL` | local URL when testing scripts | approved staging HTTPS origin | approved production HTTPS origin | public deployment configuration |
| Application domain | `127.0.0.1:3000` | approved staging domain | approved production domain | public |
| Supabase region | local Docker | recorded staging region | **organization-approved production region required** | deployment decision |
| External AI provider | disabled unless test stub | disabled by default | disabled until privacy approval | governed configuration |
| External AI processing region | not required while disabled | documented if enabled | **documented + approved if enabled** | privacy decision |
| Error monitoring DSN/token | optional local | secret store | secret store | server/client split by provider |

## Production Preconditions

Before real institutional data is introduced, record:

- hosting provider and region;
- Supabase project and region;
- production domain;
- backup retention and restore ownership;
- data residency/cross-border decision;
- external AI privacy approval status;
- independent penetration-test status;
- approved document/template/branding versions.

## CI / Local Test Credentials

Local Supabase E2E credentials are created by the Supabase CLI and exported only inside the CI job. They are disposable development credentials and must never be re-used for staging or production.

After the target GitHub Environment is configured, run **Production Environment Validation** from `main`. It fails closed on placeholder/non-HTTPS URLs, missing server credentials, demo mode, a production build failure, or an unhealthy deployed login/health surface. It does not apply database migrations and therefore does not replace the controlled migration and restore-drill procedures.
