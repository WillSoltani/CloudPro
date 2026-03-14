# ChapterFlow Split and Domain Setup

This guide covers the manual steps required to keep the existing portfolio product on `soltani.org` while launching ChapterFlow as a separate app experience on the new `siliconx.ca` domain family.

## Final target

### Product 1: Personal site and conversion app
- Primary domain: `soltani.org`
- Local development: `http://localhost:3000`
- Keeps:
  - the personal site
  - the conversion app
  - the existing portfolio identity

### Product 2: ChapterFlow
- Product home: `siliconx.ca` or a separate ChapterFlow landing layer if you add one later
- App host: `chapterflow.siliconx.ca`
- Auth host: `auth.siliconx.ca`
- Local development: `http://localhost:3001`

## 1. DNS records

Create or confirm these DNS records in Route 53:

- `chapterflow.siliconx.ca`
- `auth.siliconx.ca`

If you want a root ChapterFlow marketing site later, also plan for:

- `siliconx.ca`

The current code assumes:
- `chapterflow.siliconx.ca` serves the ChapterFlow app surface
- `auth.siliconx.ca` serves the auth surface

## 2. TLS certificates

Provision certificates for:

- `chapterflow.siliconx.ca`
- `auth.siliconx.ca`

Attach them to the hosting layer that serves the Next.js app.

## 3. Runtime environment variables

Set these for the deployed ChapterFlow aware runtime:

```text
NEXT_PUBLIC_CHAPTERFLOW_APP_URL=https://chapterflow.siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL=https://auth.siliconx.ca
CHAPTERFLOW_APP_BASE_URL=https://chapterflow.siliconx.ca
CHAPTERFLOW_AUTH_BASE_URL=https://auth.siliconx.ca
AUTH_COOKIE_DOMAIN=.siliconx.ca
CHAPTERFLOW_COOKIE_DOMAIN=.siliconx.ca
```

Keep the portfolio runtime values for the old product:

```text
APP_BASE_URL=https://soltani.org
NEXT_PUBLIC_SITE_URL=https://soltani.org
```

Do not point `APP_BASE_URL` at ChapterFlow if `soltani.org` remains the portfolio product.

## 4. Cognito configuration

The current implementation supports host aware auth routing. To make it work in production:

### Hosted UI domain
Configure Cognito Hosted UI to use:

- `auth.siliconx.ca`

Set:

```text
COGNITO_DOMAIN=https://auth.siliconx.ca
COGNITO_CUSTOM_DOMAIN=https://auth.siliconx.ca
```

### Callback URLs
Add:

- `https://auth.siliconx.ca/auth/callback`
- `http://localhost:3001/auth/callback`
- `http://localhost:3000/auth/callback` if you still want local auth testing for the old site

### Sign out URLs
Add:

- `https://auth.siliconx.ca/`
- `http://localhost:3001/`
- `http://localhost:3000/` if needed for old site local auth testing

### Runtime auth env
Set:

```text
COGNITO_REDIRECT_URI=https://auth.siliconx.ca/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://auth.siliconx.ca/
```

For local ChapterFlow development, override to:

```text
COGNITO_REDIRECT_URI=http://localhost:3001/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=http://localhost:3001/
```

## 5. Shared cookie domain

ChapterFlow auth is now designed for:

- login on `auth.siliconx.ca`
- session visibility on `chapterflow.siliconx.ca`

Set:

```text
AUTH_COOKIE_DOMAIN=.siliconx.ca
```

Without that, login will succeed on the auth host but the ChapterFlow app host will not receive the session cookie.

## 6. Old site behavior

The portfolio app should remain on `soltani.org`.

Expected behavior after deployment:

- `soltani.org` keeps the existing portfolio UI
- the conversion app stays on `soltani.org`
- `/chapterflow` on the old site points users to the new ChapterFlow app
- `/book/*` on the old site redirects to `chapterflow.siliconx.ca`

## 7. Local development

### Old site

Run:

```bash
npm run dev
```

Expected local URL:

- `http://localhost:3000`

### ChapterFlow

Run:

```bash
npm run dev:chapterflow
```

Expected local URL:

- `http://localhost:3001`

The `dev:chapterflow` script already overrides:

- app base URL
- ChapterFlow public URLs
- auth return URLs

so the product can be tested as a separate local app surface.

## 8. Stripe checks for ChapterFlow

Because ChapterFlow billing returns are now product specific, confirm:

```text
CHAPTERFLOW_APP_BASE_URL=https://chapterflow.siliconx.ca
NEXT_PUBLIC_CHAPTERFLOW_APP_URL=https://chapterflow.siliconx.ca
BOOK_STRIPE_SECRET_KEY=...
BOOK_STRIPE_PRICE_ID=...
BOOK_STRIPE_WEBHOOK_SECRET=...
```

Verify:

- checkout success returns to ChapterFlow
- checkout cancel returns to ChapterFlow
- billing portal returns to ChapterFlow settings
- webhook updates still reach the shared backend

## 9. Post deployment verification

### Portfolio product
- `https://soltani.org/` loads the personal site
- conversion flows still work
- `/dashboard` and `/app` still behave as expected

### ChapterFlow
- `https://chapterflow.siliconx.ca/` shows the ChapterFlow surface
- `https://chapterflow.siliconx.ca/book` opens the app flow
- `/book/*` on the old host redirects to ChapterFlow
- `/app` and `/dashboard` do not act like primary surfaces on the ChapterFlow host

### Auth
- `https://auth.siliconx.ca/` shows the auth surface
- `https://auth.siliconx.ca/auth/login` enters Cognito
- callback returns users to the correct host
- logout clears the right cookies and returns cleanly

## 10. Release order

1. Configure DNS
2. Attach certificates
3. Update Cognito domain and callback settings
4. Set ChapterFlow runtime env values
5. Deploy the app
6. Verify ChapterFlow auth cookies work across subdomains
7. Verify the old site still behaves like its own product
8. Verify billing and webhook behavior
