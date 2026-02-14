# Environment Variables and Secret Handling

## Critical rule
Do not store real secrets in `wrangler.toml` or source files. Put secrets in Cloudflare Worker secrets and local `.dev.vars`.

## Required runtime variables

### Core
- `APP_NAME`: Display name for API responses.
- `REGION`: Region label shown in health/dashboard responses.
- `PROVIDER_MODE`: `mock` or `live`.
- `WARNING_CARD_RENDER_MODE`: `svg` (default) or `png`.
- `ADMIN_EMAILS`: Comma-separated admin allowlist (case-insensitive), for example `admin1@example.com,admin2@example.com`.

### Auth
- `GOOGLE_CLIENT_ID`: OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: OAuth client secret. Treat as secret.
- `GOOGLE_REDIRECT_URI`: OAuth callback URL.
- `JWT_SECRET`: Session signing key. Treat as secret.

### AI
- `OPENROUTER_API_KEY`: Secret API key for OpenRouter.
  - Used by `/api/ai/chat` and `/api/report/generate-ai`.
  - If missing, `/api/ai/chat` returns `503` and report generation falls back to template mode.

### Browser Rendering
- `BROWSER_RENDERING_ACCOUNT_ID`: Cloudflare account ID used to build Browser Rendering API base URL.
  - Needed together with `CF_BROWSER_RENDERING_TOKEN`.
  - Used by report PDF export and warning-card PNG rendering.
- `CF_BROWSER_RENDERING_TOKEN`: Secret token for Browser Rendering API.

## Local development
1. Copy `wrangler.toml.example` to your local `wrangler.toml` (this file is git-ignored).
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Fill real values in `.dev.vars` and replace `TODO_*` values in local `wrangler.toml`.
4. Run `npm run dev`.

## Production secret provisioning (Cloudflare)
Run these commands before deploy:

```bash
wrangler secret put JWT_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put OPENROUTER_API_KEY
wrangler secret put CF_BROWSER_RENDERING_TOKEN
wrangler secret put GOPLUS_APP_KEY
wrangler secret put GOPLUS_APP_SECRET
```

## Secret rotation checklist
1. Generate new credentials/keys at providers.
2. Update Worker secrets with `wrangler secret put ...`.
3. Invalidate/revoke old credentials at provider side.
4. Deploy immediately after secret update.
5. Verify `/api/health`, login, `/api/ai/chat`, and `/api/report/export-pdf`.

