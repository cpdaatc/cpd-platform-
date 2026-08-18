# Cloudflare + Supabase zero-cost demo deployment plan

**Goal:** Keep the investor-facing experience synthetic and clearly labelled while preparing the full governed Next.js application for a zero-cost Cloudflare/Supabase deployment.

**Architecture:** Publish `demo/` as a static Cloudflare Pages site. Deploy the server-rendered Next.js application with Cloudflare Workers through OpenNext, because Pages static export cannot run its server actions. Connect only the full application to a Supabase Free project; never put a service-role key in Pages, the browser, or source control.

**Stack:** Cloudflare Pages, Cloudflare Workers Free, OpenNext, Next.js, Supabase Free, GitHub.

---

### Task 1: Lock the deployment contract with a dependency-free test

**Files:**
- Create: `scripts/cloudflare-deployment-config.node-test.mjs`

1. Assert that Pages deploys only `demo/`, the Worker points at `.open-next/worker.js`, Node compatibility is enabled, and public configuration contains no server secret.
2. Run the test and confirm it fails because the deployment files do not exist yet.

### Task 2: Add the minimal Cloudflare deployment configuration

**Files:**
- Create: `wrangler.jsonc`
- Create: `open-next.config.ts`
- Create: `cloudflare/pages.json`
- Modify: `package.json`
- Modify: `.gitignore`

1. Add the OpenNext Worker entry point and static assets binding without paid Images, R2, KV, or Durable Objects.
2. Add explicit Pages metadata that limits the investor surface to `demo/`.
3. Add preview, upload, deploy, type-generation, and contract-test scripts.
4. Re-run the deployment contract test until green.

### Task 3: Document the safe zero-cost operating model

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Create: `docs/deployment/cloudflare-supabase-free.md`

1. Document Pages as synthetic investor-only and Workers as the authenticated app runtime.
2. Document Supabase URL/anon key as browser-safe configuration and the server secret as an encrypted Worker secret only.
3. Record free-tier cost controls and a pre-launch checklist.

### Task 4: Install, build, and verify locally

**Files:**
- Modify: `package-lock.json`

1. Install OpenNext `1.20.2` and the current compatible Wrangler release.
2. Run the dependency-free deployment contract test, unit tests, typecheck, lint, Next build, and OpenNext build.
3. Inspect the final diff for leaked credentials and unrelated changes.

### Task 5: Provision and publish when account authorization is available

1. Create or select a Supabase Free project, apply the existing migrations, and seed synthetic demo accounts only.
2. Create the Cloudflare Pages project for `demo/` and the Worker for the full app.
3. Configure public Supabase values and encrypted server secrets in Cloudflare, then set Supabase auth redirect URLs.
4. Verify both live URLs before changing any existing public GitHub Pages setup.
