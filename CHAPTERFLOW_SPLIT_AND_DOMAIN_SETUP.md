# ChapterFlow Split and Domain Setup

This guide covers the deployment shape where the same repository is deployed to two separate App Runner services with two separate Cognito setups:

- `soltani.org` keeps the existing portfolio and conversion product
- `soltani.org/book` also continues to host the reading product
- `siliconx.ca` becomes the dedicated ChapterFlow product home
- `chapterflow.siliconx.ca` hosts the dedicated ChapterFlow app
- `auth.siliconx.ca` hosts the ChapterFlow auth shell

The code now supports this through an env driven deployment mode.

## Final target

### Deployment 1: Portfolio plus embedded book app
- Primary domain: `soltani.org`
- Local development: `http://localhost:3000`
- App Runner service: portfolio service
- Cognito: portfolio Cognito setup
- Deployment mode: `embedded`

Behavior:
- `/` stays the portfolio home
- `/app` and `/dashboard` stay the portfolio workspace
- `/book` remains available on the same host
- auth stays local to the same deployment

### Deployment 2: Standalone ChapterFlow
- Product home: `siliconx.ca`
- App host: `chapterflow.siliconx.ca`
- Auth shell: `auth.siliconx.ca`
- Cognito Hosted UI domain: use a separate Cognito domain such as `login.siliconx.ca`
- Local development: `http://localhost:3001`
- App Runner service: ChapterFlow service
- Cognito: ChapterFlow Cognito setup
- Deployment mode: `standalone`

Behavior:
- `siliconx.ca` serves the ChapterFlow front page
- `chapterflow.siliconx.ca` serves the app
- `auth.siliconx.ca` serves the auth shell
- login returns users into `chapterflow.siliconx.ca/book`
- `https://siliconx.ca/auth/callback` is also supported if you want the Cognito callback on the product home host

## 1. Environment variables by deployment

### Portfolio deployment on `soltani.org`

Use:

```text
CHAPTERFLOW_DEPLOYMENT_MODE=embedded
APP_BASE_URL=https://soltani.org
NEXT_PUBLIC_SITE_URL=https://soltani.org
```

Do not set the SiliconX ChapterFlow host vars on this deployment unless you intentionally want the old site to point users out to the standalone product.

Set your portfolio Cognito values:

```text
COGNITO_DOMAIN=https://your-portfolio-cognito-domain
COGNITO_CUSTOM_DOMAIN=https://your-portfolio-cognito-domain
COGNITO_CLIENT_ID=your_portfolio_client_id
COGNITO_REDIRECT_URI=https://soltani.org/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://soltani.org/
```

Cookie domain:
- leave `AUTH_COOKIE_DOMAIN` unset unless you explicitly need it

### ChapterFlow deployment on SiliconX

Use:

```text
CHAPTERFLOW_DEPLOYMENT_MODE=standalone
APP_BASE_URL=https://soltani.org
NEXT_PUBLIC_SITE_URL=https://soltani.org

NEXT_PUBLIC_CHAPTERFLOW_SITE_URL=https://siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_APP_URL=https://chapterflow.siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL=https://auth.siliconx.ca
CHAPTERFLOW_SITE_BASE_URL=https://siliconx.ca
CHAPTERFLOW_APP_BASE_URL=https://chapterflow.siliconx.ca
CHAPTERFLOW_AUTH_BASE_URL=https://auth.siliconx.ca
AUTH_COOKIE_DOMAIN=.siliconx.ca
CHAPTERFLOW_COOKIE_DOMAIN=.siliconx.ca
```

Set the ChapterFlow Cognito values:

```text
COGNITO_DOMAIN=https://login.siliconx.ca
COGNITO_CUSTOM_DOMAIN=https://login.siliconx.ca
COGNITO_CLIENT_ID=your_chapterflow_client_id
COGNITO_REDIRECT_URI=https://siliconx.ca/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://siliconx.ca/
```

If you prefer to terminate callback and logout on the dedicated auth shell instead, these also work:

```text
COGNITO_REDIRECT_URI=https://auth.siliconx.ca/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://auth.siliconx.ca/
```

## 2. DNS records

### Portfolio side
- keep the existing `soltani.org` records

### ChapterFlow side
Create or confirm:

- `siliconx.ca`
- `chapterflow.siliconx.ca`
- `auth.siliconx.ca`
- `login.siliconx.ca` if you use a Cognito custom domain

Recommended targets:
- `siliconx.ca` → ChapterFlow App Runner service
- `chapterflow.siliconx.ca` → ChapterFlow App Runner service
- `auth.siliconx.ca` → ChapterFlow App Runner service
- `login.siliconx.ca` → Cognito custom domain target

## 3. App Runner layout

### Service 1: portfolio service
- serves `soltani.org`
- runs with `CHAPTERFLOW_DEPLOYMENT_MODE=embedded`
- uses the portfolio Cognito config

### Service 2: ChapterFlow service
- serves `siliconx.ca`
- serves `chapterflow.siliconx.ca`
- serves `auth.siliconx.ca`
- runs with `CHAPTERFLOW_DEPLOYMENT_MODE=standalone`
- uses the ChapterFlow Cognito config

## 4. Cognito layout

Use two separate Cognito setups if you want fully separate auth systems.

### Portfolio Cognito
- callback URL: `https://soltani.org/auth/callback`
- logout URL: `https://soltani.org/`

### ChapterFlow Cognito
- hosted UI domain: `login.siliconx.ca`
- recommended callback URL: `https://siliconx.ca/auth/callback`
- recommended logout URL: `https://siliconx.ca/`
- optional callback URL: `https://auth.siliconx.ca/auth/callback`
- optional logout URL: `https://auth.siliconx.ca/`

Do not use `auth.siliconx.ca` as the Cognito Hosted UI domain in this setup because the app itself serves that host.

## 5. Local development

### Old site

Run:

```bash
npm run dev
```

Open:
- `http://localhost:3000`

This uses the default `embedded` behavior.

### Standalone ChapterFlow

Run:

```bash
npm run dev:chapterflow
```

Open:
- `http://localhost:3001`

This script already sets:
- `CHAPTERFLOW_DEPLOYMENT_MODE=standalone`
- ChapterFlow URLs for local
- a separate Next build directory so it can run alongside the main dev server

## 6. Expected behavior after deployment

### On `soltani.org`
- portfolio home remains unchanged
- conversion app remains unchanged
- `/book` works locally on that host again
- auth for the embedded book experience uses the portfolio deployment config

### On SiliconX
- `https://siliconx.ca/` shows the ChapterFlow front page
- `https://chapterflow.siliconx.ca/book` opens the app
- `https://auth.siliconx.ca/` shows the auth shell
- sign in returns users into the app host

## 7. Verification checklist

### Portfolio deployment
- `https://soltani.org/` loads
- `https://soltani.org/app` loads
- `https://soltani.org/book` loads
- login and logout work with the portfolio Cognito config

### ChapterFlow deployment
- `https://siliconx.ca/` loads
- `https://siliconx.ca/auth/callback` is configured in Cognito if you want the apex product host to receive the callback
- `https://chapterflow.siliconx.ca/book` loads
- `https://auth.siliconx.ca/` loads
- login and logout work with the ChapterFlow Cognito config

### Shared backend behavior
- book progress persists
- settings persist
- badges and notes still work
- billing still returns to the ChapterFlow app host
