# Deploy the BM Stock web demo to Render

This deploys `apps/bm-stock-frontend` as a public, backend-free portfolio demo.
A visitor lands on a populated dashboard with sample products, sales, stock
movements, staff, reports and notifications. No credentials are needed.

## 1. Deploy with the Blueprint (recommended)

1. Sign in to [Render](https://dashboard.render.com) and choose **New →
   Blueprint**.
2. Connect `https://github.com/mekdelawitworku6-lgtm/bm-stock-demo.git`.
3. Render detects `render.yaml` at the repository root. Review the single
   `bm-stock-demo` web service and click **Apply**.
4. Render builds with `npm ci && npm run build` from
   `apps/bm-stock-frontend`, then starts it with `npm start`.
5. Open the generated `https://bm-stock-demo.onrender.com` URL. Add a custom
   domain under **Settings → Custom Domains** if you want a nicer portfolio
   link.

`render.yaml` sets `NEXT_PUBLIC_DEMO_MODE=true`, so the app uses the sample data
automatically. Every push to `main` redeploys the service.

### Manual setup instead

If you don't want to use a Blueprint, create a **Web Service** with:

| Setting | Value |
| --- | --- |
| Repository | `https://github.com/mekdelawitworku6-lgtm/bm-stock-demo.git` |
| Runtime | `Node` |
| Root Directory | `apps/bm-stock-frontend` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Plan | `Free` (or higher if you want no cold starts) |
| Environment | `NEXT_PUBLIC_DEMO_MODE=true` |

Render sets `PORT`; `next start` reads it automatically.

The free plan sleeps after inactivity, so the first request after a pause may
take a few seconds. Upgrade the plan if you want the demo always warm.

## 2. What the demo mode does

- Seeds a local `Demo Admin` (super admin, Enterprise plan) session, so the
  root route goes straight to `/dashboard`.
- Answers every API call from `src/lib/demoData.ts` instead of calling a
  backend. Products, sales, transfers, staff, commissions, bank accounts and
  reports are realistic sample records.
- Create/edit actions update an in-memory dataset for the current browser tab.
  Reloading resets to the original sample dataset — nothing is stored on a
  server and no real customer data is used.
- Shows a **DEMO** badge in the sidebar so viewers know the data is sample.

## 3. Run it locally

```powershell
cd apps\bm-stock-frontend
npm ci
npm run dev
# open http://localhost:3002
```

Local `npm run dev` uses the live API path by default. To preview demo mode
locally:

```powershell
$env:NEXT_PUBLIC_DEMO_MODE='true'
npm run dev
```

To test the production demo build locally:

```powershell
npm run build
npm start
# .env.production enables demo mode; default port is 3000 (or $PORT)
```

## 4. Switch back to a live backend

1. In Render Service → Environment, set `NEXT_PUBLIC_DEMO_MODE=false`.
2. Set `BACKEND_URL` to a publicly reachable API, for example
   `https://bmstock.possibletechplc.com`. The app rewrites `/api/v1/*` to that
   host via `next.config.ts`.
3. Redeploy.

Keep `NEXT_PUBLIC_DEMO_MODE=true` if you only ever want the public portfolio
demo.

## 5. Before making the repo public

- Never commit `android/key.properties` or `android/app/upload-keystore.jks`.
- `apps/bm-stock-flutter-app/android/RELEASE_SIGNING.md` and
  `upload_certificate.pem` are currently untracked; the certificate is public
  but the signing doc is not needed for the web demo. Leave both out of the
  public commit if you don't want release details in the repo.
- `DEMO.md` contains only project information and screenshots and is safe to
  keep.

The frontend is pinned to a patched Next.js release (`16.4.6`) and uses the
maintained SheetJS build from the official CDN. `npm audit` reports zero
vulnerabilities at the time of writing. Keep dependencies updated for any
public deployment.
