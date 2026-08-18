# Cloudflare + Supabase Free deployment

This runbook keeps the current investor demonstration at **$0/month within provider free-tier limits** and prevents synthetic presentation data from being mistaken for production data.

## Deployment map

| Surface | Host | Data | Purpose |
|---|---|---|---|
| Investor demo | Cloudflare Pages | Synthetic, browser-local only | Guided product presentation without accounts or real records |
| Authenticated platform | Cloudflare Workers via OpenNext | Supabase Free with RLS | Development, controlled testing, and later production hardening |

The Next.js application uses server actions and server-side authentication. It therefore runs on Workers; only the static `demo/` directory belongs on Pages.

## 1. Supabase Free project

1. Create one project on the **Free** plan and select the nearest practical region.
2. Apply the migrations in `supabase/migrations/` in numeric order.
3. Seed synthetic users and organizations only. Do not upload learner, attendee, patient, or accreditation records.
4. Copy the Project URL and publishable/anon key. These are used by the authenticated app.
5. Keep the secret key or legacy service-role key server-only. Add it later as an encrypted Cloudflare Worker secret, never as a `NEXT_PUBLIC_` value.
6. After the Worker URL exists, add its login callback/origin to Supabase Auth URL configuration.

## 2. Cloudflare Pages investor demo

Create a Pages project from the GitHub repository with:

| Setting | Value |
|---|---|
| Production branch | `main` after the deployment branch is merged |
| Framework preset | None |
| Build command | Leave empty |
| Build output directory | `demo` |
| Environment variables | None |

The matching machine-readable record is `cloudflare/pages.json`. The Pages surface must not receive Supabase credentials because its fake role selector and local records are deliberately presentation-only.

## 3. Cloudflare Worker application

The repository contains `wrangler.jsonc` and `open-next.config.ts`. OpenNext produces `.open-next/worker.js`; Cloudflare runs it with `nodejs_compat`.

Configure these build variables for both the Next.js build and Worker runtime:

| Variable | Classification |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public configuration |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public configuration |
| `PRODUCTION_BASE_URL` | Public application URL |
| `NEXT_PUBLIC_DEMO_MODE=false` | Public configuration |
| `SUPABASE_SECRET_KEY` | Encrypted server secret only |

Use `SUPABASE_SERVICE_ROLE_KEY` only for a legacy Supabase project that does not provide the current secret key. Never configure both in Pages or expose either in client code.

Build commands:

```sh
npm run test:deployment
npm run preview:cloudflare
npm run deploy:cloudflare
```

`next/image` optimization is disabled in this deployment so Cloudflare Images is not required. R2, KV, Durable Objects, D1, Queues, and paid CPU limits are intentionally absent.

## 4. Pre-launch checks

- The Pages banner states that all data is synthetic and browser-local.
- No `.env`, `.dev.vars`, Supabase secret, or service-role token is committed.
- Supabase RLS migrations are applied before any authenticated account is invited.
- Only synthetic demo identities exist during investor review.
- The Pages URL and Worker URL are tested independently.
- Usage dashboards remain on the Free plans; no paid add-on is enabled.
- The existing GitHub Pages demo is retained until both Cloudflare URLs pass verification.

## Cost boundary

The intended monthly platform cost is zero while traffic, database, storage, bandwidth, and Worker execution remain inside the current free allowances. A custom domain is optional and is the only planned external cost; it is not required for the investor demo.
