# fossilProcure

MERN-stack monorepo for the fossilProcure procurement system.

- **api/** — Express 4 + Mongoose, layered architecture (routes → controllers → services → models)
- **client/** — React 18 + Vite + Tailwind, services-based data layer
- **packages/shared/** — cross-runtime constants and domain enums consumed by both the API and the client

## Repository layout

```
fossilProcure/
├── api/                        # Express API
│   └── src/
│       ├── app.js              # Pure factory that builds the Express app
│       ├── server.js           # Bootstrap: env, DB, listen, graceful shutdown
│       ├── config/             # External integrations (db, etc.)
│       ├── lib/                # ApiError, asyncHandler, logger, sendResponse
│       ├── middleware/         # auth, audit, errorHandler, notFound
│       ├── routes/             # One file per domain, mounted in routes/index.js
│       ├── controllers/        # One folder per domain, one file per use case
│       ├── services/           # Domain services (email, notifications, ...)
│       ├── models/             # Mongoose models
│       ├── templates/          # Email/HTML templates
│       └── scripts/            # Operational scripts (seed, migrations)
│
├── client/                     # React + Vite SPA
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── layouts/            # Shell layouts (e.g. appLayout)
│       ├── pages/              # Route-level pages (one per feature)
│       ├── components/         # Reusable presentational components
│       ├── context/            # React contexts (auth, ...)
│       ├── services/           # Axios http client + per-domain API services
│       └── lib/                # Front-end utilities + constants re-exports
│
├── packages/
│   └── shared/                 # @fossil/shared — cross-package constants
│       └── src/constants/      # roles, currencies, statuses, regions, catalog
│
├── scripts/                    # Root-level ops scripts (ngrok, etc.)
└── package.json                # npm workspaces, root scripts
```

## Architecture highlights

### Backend (api/)

- **`app.js` vs `server.js`** — `app.js` is a pure factory that returns a wired Express app (zero side effects, easy to test or mount in a serverless handler). `server.js` is the runtime entry: loads `.env`, connects MongoDB, listens on a port, handles `SIGTERM`/`SIGINT`/`unhandledRejection`.
- **Layered request flow** — `route → middleware (auth, validation) → controller → service → model`. Controllers stay thin; cross-cutting logic lives in services.
- **One file per use case** — `controllers/<domain>/<verb><Entity>.controller.js` (e.g. `createRFQ`, `approveSupplier`). Easy to find, easy to diff.
- **Operational errors** — throw `new ApiError(404, 'RFQ not found')` (see [api/src/lib/ApiError.js](api/src/lib/ApiError.js)) and let the centralized `errorHandler` translate it into a clean JSON envelope. Mongoose validation, cast, duplicate-key and JWT errors are normalized too.
- **`asyncHandler(fn)`** — wraps async controllers so rejected promises hit the error pipeline without `try/catch` boilerplate.
- **Consistent response envelope** — `{ success: true, data, meta? }` or `{ success: false, message, code?, details? }`. Helpers in [api/src/lib/sendResponse.js](api/src/lib/sendResponse.js).

### Frontend (client/)

- **Services layer** — `client/src/services/` contains the axios instance (`http.js`) plus one file per domain (`auth.service.js`, `procurement.service.js`, ...). Pages import from `@/services` rather than touching axios directly.
- **`client/src/lib/api.js`** is now a thin re-export shim kept for backward compatibility with existing pages.
- **Env-driven API URL** — `import.meta.env.VITE_API_URL` (see [client/.env.example](client/.env.example)). Falls back to the deployed URL only when unset.

### Shared package

- **`@fossil/shared`** (in `packages/shared/`) exports domain enums and constants (roles, statuses, currencies, Zimbabwe provinces/banks, units, supplier categories) as **plain CommonJS** so both Node (api) and Vite (client) can consume the exact same source of truth.

```js
// api
const { USER_ROLES, RFQ_STATUS } = require('@fossil/shared');

// client
import { USER_ROLES, RFQ_STATUS, formatCurrency } from '@fossil/shared';
```

## Quick start

### Prerequisites
- Node.js ≥ 20 (see [.nvmrc](.nvmrc))
- MongoDB (local or Atlas)

### Install
```bash
npm install
```
npm workspaces installs `api`, `client`, and `packages/shared` and links the shared package automatically.

### Configure environment
```bash
cp api/.env.example api/.env
cp client/.env.example client/.env
```
Fill in real values in `api/.env` (Mongo URI, JWT secret, Resend key, etc.).

### Run both servers
```bash
npm run dev
```
- API:    http://localhost:3001
- Client: http://localhost:5173

### Seed the database
```bash
npm run seed
```

## Available scripts (root)

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Run API and client in parallel via `concurrently`         |
| `npm run dev:api`      | Run only the API (`nodemon`)                              |
| `npm run dev:client`   | Run only the client (`vite`)                              |
| `npm run build`        | Build the client for production                           |
| `npm start`            | Start the API in production mode                          |
| `npm run seed`         | Seed the database (via `api/src/scripts/seed.js`)         |
| `npm run format`       | Format the whole repo with Prettier                       |
| `npm run format:check` | Check formatting without writing                          |
| `npm run ngrok`        | Expose the API via the bundled PowerShell ngrok helper    |

## Tech stack

- **Frontend** — React 18, Vite 5, React Router v7, Tailwind CSS, axios, lucide-react
- **Backend** — Express 4, Mongoose 8, JSON Web Tokens, bcryptjs, Resend, multer, pdfkit, validator
- **Tooling** — npm workspaces, concurrently, nodemon, Prettier, EditorConfig
