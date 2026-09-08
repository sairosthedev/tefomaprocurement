# Environments

The system runs in three environments. They are separate deployments with
separate databases; nothing is shared between them.

| | Development | Staging | Production |
|---|---|---|---|
| **Purpose** | Your machine, while building | Shared testing before release | The live system Tefoma uses |
| **Front-end** | `http://localhost:5173` | `tefomaprocurement-staging.vercel.app` | `tefomaprocurement.vercel.app` |
| **API** | `http://localhost:3001` | `tefomaprocurement-api-staging.vercel.app` | `tefomaprocurement-api.vercel.app` |
| **Database** | `fossil-procure-dev` | `fossil-procure-staging` | `fossil-procure` |
| **Data** | Yours, disposable | Test data, wiped freely | Real. Never test here. |
| **OTP in server log** | Yes | No | No |
| **OTP in API response** | Optional | Blocked at startup | Blocked at startup |
| **Stack traces to caller** | Yes | No | No |
| **UI badge** | Grey `DEV` | Amber `STAGING` | None |

Staging is deliberately **not** a relaxed environment. It is reachable by other
people, so it behaves like production for anything that could leak a credential
or an internal detail. The only differences are which database it uses, which
URLs it lives at, and that its data is disposable.

## How the environment is chosen

`APP_ENV` is the single source of truth on the API, and `VITE_APP_ENV` on the
client. Both accept exactly `development`, `staging` or `production`; anything
else is a startup error rather than a silent fallback.

The API falls back to `NODE_ENV` if `APP_ENV` is unset, and then to
`development`. The client falls back to Vite's own dev/prod split, where a
production build is treated as production — the safe direction, since it hides
debugging affordances rather than exposing them.

Code should ask `isDeployed()` rather than `isProduction()` when gating anything
that could leak information. `isDeployed()` covers staging and production
together, so a new environment never gets development behaviour by omission.

- API: `api/src/config/env.ts`
- Client: `client/src/lib/env.ts`

## Running locally

```bash
cp api/.env.development.example api/.env.development
cp client/.env.development.example client/.env.development
# fill in JWT_SECRET (openssl rand -base64 48) and MONGODB_URI in the API file
npm run dev
```

To point your local machine at the staging API and database — useful for
reproducing something a tester reported:

```bash
cp api/.env.staging.example api/.env.staging      # fill in staging credentials
cp client/.env.staging.example client/.env.staging
npm run dev:staging
```

### Env file loading order

The API loads these in order, and **the first file to define a key wins**:

1. `.env.<APP_ENV>.local` — your personal overrides, never committed
2. `.env.<APP_ENV>` — this environment's settings
3. `.env` — defaults shared by every environment

Real environment variables set by the platform or your shell are already in
`process.env` and therefore always take precedence over every file.

On Vercel there are no `.env` files at all — the variables come from the
project's settings. The `.env.<env>.example` files are the checklist of what
each Vercel project needs.

The client is different: Vite loads `.env.<mode>` itself, selected by the
`--mode` flag in the npm script. Vite inlines the values at build time, so a
staging build and a production build are genuinely different artifacts.

## Startup validation

The API validates its configuration before it accepts any traffic, and reports
every problem at once rather than one per restart:

```
Invalid configuration for APP_ENV=staging:
  - JWT_SECRET must be at least 32 characters (got 5). Generate one with `openssl rand -base64 48`.
  - MONGODB_URI is not set.
  - CLIENT_URL is "http://localhost:5173", which is a local address and cannot be reached from a deployment.

See api/.env.staging.example for the expected variables.
```

What it refuses to start on:

- `APP_ENV` that is not one of the three known environments
- Missing, placeholder, or too-short `JWT_SECRET`
- Missing or malformed `MONGODB_URI`
- **Production pointed at a database whose name contains `dev`, `staging`, `test`
  or `local`**, or at `localhost`
- A deployed environment with no `CLIENT_URL`, or a `CLIENT_URL` on localhost
- A deployed environment with no `RESEND_API_KEY` (no email means no OTP, which
  means nobody can log in)
- `OTP_EXPOSE_IN_RESPONSE=true` anywhere but development

Staging additionally warns — but still starts — if its database name does not
look like a staging database, since the expensive mistake is staging writing to
production.

Confirm which deployment answered a request with `GET /health`:

```json
{ "status": "ok", "environment": "staging", "uptime": 12.4 }
```

## Secrets

Every environment gets its **own** `JWT_SECRET`. A leaked staging key must not
mint tokens that production will accept. Rotating the production secret signs
every user out, which is the correct response to a suspected leak.

`.env` files are git-ignored. Only the `.env*.example` templates are committed,
and they contain no real values. Never copy `.env.production.example` to a real
`.env.production` on a laptop — that puts live database and email credentials on
a developer machine.

## Deploying

Each environment is its own pair of Vercel projects, so a deploy cannot
accidentally cross environments.

```bash
npm run deploy:staging      # API then client, to the staging projects
npm run deploy:production   # API then client, to the live projects
```

The API is deployed before the client in both, so the front-end is never newer
than the API it calls.

### First-time Vercel setup for staging

Create two projects, `tefomaprocurement-api-staging` and
`tefomaprocurement-staging`, then set their environment variables from the
corresponding `.env.staging.example`. The API project needs `APP_ENV=staging`
set explicitly — without it, Vercel sets `NODE_ENV=production` and the
deployment would identify itself as production.

Set the variables for Vercel's **Production** scope within those staging
projects. That is what `vercel --prod` targets, and it gives staging a stable
URL rather than one that changes on every deploy.

## Adding a new environment variable

1. Add it to `api/.env.example` and to each `.env.<env>.example` that needs it.
2. If a deployment cannot function without it, add a check to
   `api/src/config/validate.ts` so a missing value fails at startup instead of
   at the first request.
3. Set it in both Vercel projects for every environment that needs it.
