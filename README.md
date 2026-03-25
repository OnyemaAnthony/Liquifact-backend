# LiquiFact Backend

API gateway and server for LiquiFact — the global invoice liquidity network on Stellar.
This repo provides the Express-based REST API for invoice uploads, escrow state, and (future) Stellar/Horizon integration.

Part of the LiquiFact stack: **frontend (Next.js)** | **backend (this repo)** | **contracts (Soroban)**.

---

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 9+

---

## Setup

```bash
# 1. Clone the repo
git clone <this-repo-url>
cd liquifact-backend

# 2. Install dependencies
npm ci

# 3. Configure environment
cp .env.example .env
# Edit .env for CORS, body-size limits, Stellar/Horizon, or DB settings
```

---

## Development

| Command | Description |
|---|---|
| `npm run dev` | Start API with watch mode |
| `npm run start` | Start API (production-style) |
| `npm run lint` | Run ESLint on `src/` |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage report |

Default port: **3001**. After starting:

- Health: `http://localhost:3001/health`
- API info: `http://localhost:3001/api`
- Invoices: `http://localhost:3001/api/invoices`
  - `GET  /api/invoices` — List active invoices
  - `GET  /api/invoices?includeDeleted=true` — List all invoices
  - `POST /api/invoices` — Create invoice *(512 KB body limit)*
  - `DELETE /api/invoices/:id` — Soft delete invoice
  - `PATCH  /api/invoices/:id/restore` — Restore deleted invoice

---

## Request Body Size Limits

> **Security guardrail** — all incoming request bodies are capped at configurable byte limits.
> Oversized payloads are rejected immediately with a structured `413 Payload Too Large` response,
> before any business logic runs.

### How it works

The middleware lives in `src/middleware/bodySizeLimits.js` and is composed of three layers:

1. **`jsonBodyLimit(limit?)`** — Wraps `express.json()` with a byte cap. Also guards against
   forged `Content-Length` headers.
2. **`urlencodedBodyLimit(limit?)`** — Same protection for URL-encoded form bodies.
3. **`invoiceBodyLimit(limit?)`** — Stricter variant used on sensitive endpoints
   (`POST /api/invoices`, escrow writes). Defaults to 512 KB.
4. **`payloadTooLargeHandler`** — Error-handling middleware that catches body-parser's
   `entity.too.large` error and converts it into a clean JSON 413 response.

### 413 Response Shape

```json
{
  "error": "Payload Too Large",
  "message": "Request body exceeds the maximum allowed size of 512kb.",
  "limit": "512kb",
  "path": "/api/invoices"
}
```

### Default Limits

| Limit | Default | Env Variable |
|---|---|---|
| Global JSON bodies | `100kb` | `BODY_LIMIT_JSON` |
| URL-encoded bodies | `50kb` | `BODY_LIMIT_URLENCODED` |
| Raw / binary bodies | `1mb` | `BODY_LIMIT_RAW` |
| Invoice upload endpoints | `512kb` | `BODY_LIMIT_INVOICE` |

All limits are configurable via environment variables (see `.env.example`).

### Overriding limits (`.env`)

```dotenv
BODY_LIMIT_JSON=200kb
BODY_LIMIT_INVOICE=256kb
```

### Security assumptions validated

| Assumption | How it is enforced |
|---|---|
| Forged `Content-Length` headers | Secondary guard middleware checks the header value against `parseSize(limit)` before body parsing can complete. |
| Primitive JSON root values (`"string"`, `42`) | `express.json` runs in `strict: true` mode — only objects and arrays are accepted. |
| Misconfigured limit strings | `parseSize()` throws `TypeError` / `RangeError` at startup, preventing silent misconfigurations. |
| Unbounded retries on upstream calls | Separate `src/utils/retry.js` hard-caps retries at 10 and delay at 60 s. |

---

## Code Quality & Testing

### ESLint

We enforce strict linting rules using `eslint:recommended`.
All code must include JSDoc comments for maintainability.

```bash
npm run lint       # check
npm run lint:fix   # auto-fix
```

### Testing

We use **Vitest** and **Supertest** for testing.

```bash
npm test                # run all tests
npm run test:coverage   # run with coverage report
```

Coverage target: **≥ 95% lines and statements**.

Test suite covers:

- `parseSize()` — 11 happy-path cases, 6 TypeError cases, 3 RangeError cases
- `DEFAULT_LIMITS` — all four keys are parseable and non-zero
- `jsonBodyLimit()` — pass/fail/413-shape/malformed/strict-mode/Content-Length guard
- `urlencodedBodyLimit()` — pass/fail/413-shape/Content-Length guard
- `invoiceBodyLimit()` — default limit, custom limit, response shape
- `payloadTooLargeHandler()` — converts `entity.too.large`, passes through other errors
- **Full app integration** — health, api-info, GET/POST invoices, oversized 413 end-to-end

---

## Authentication

Protected endpoints (invoice mutations, escrow operations) require a JWT in the `Authorization` header:

```
Authorization: Bearer <jwt_token_here>
```

The middleware validates the token against `JWT_SECRET` (defaults to `test-secret` locally).
Unauthenticated requests are rejected with `401 Unauthorized`.

---

## Rate Limiting

| Scope | Limit |
|---|---|
| Global (per IP / User ID) | 100 requests / 15 minutes |
| Sensitive operations (invoice upload, escrow writes) | 10 requests / hour per IP |

Clients exceeding limits receive `429 Too Many Requests`.
Check the standard `RateLimit-*` headers for quota and reset time.

---

## Configuration

### CORS Allowlist

```dotenv
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

- Requests **without** an `Origin` header are allowed (curl, Postman, etc.).
- Requests from **allowed** origins receive normal CORS headers.
- Requests from **disallowed** origins are rejected with `403 Forbidden`.
- Origin matching is **exact only** — no wildcards or regex.

**Development default:** If `NODE_ENV=development` and `CORS_ALLOWED_ORIGINS` is unset,
common local origins are allowed automatically.

**Production default:** If `CORS_ALLOWED_ORIGINS` is unset outside development,
all browser origins are denied.

---

## Project Structure

```
liquifact-backend/
├── src/
│   ├── config/
│   │   └── cors.js                    # CORS allowlist parsing and policy
│   ├── middleware/
│   │   └── bodySizeLimits.js          # ← NEW: request body size guardrails
│   ├── services/
│   │   └── soroban.js                 # Contract interaction wrappers
│   ├── utils/
│   │   └── retry.js                   # Exponential backoff utility
│   ├── __tests__/
│   │   └── bodySizeLimits.test.js     # ← NEW: comprehensive test suite
│   ├── app.js                         # Express app, middleware, routes
│   └── index.js                       # Runtime bootstrap
├── .env.example                       # Env template (includes size-limit vars)
├── eslint.config.js
├── vitest.config.js
└── package.json
```

---

## Resiliency & Retries

`src/utils/retry.js` provides exponential backoff for Soroban contract calls:

- **Automatic retries** for HTTP 429, 502, 503, 504, and network timeouts.
- **Jitter** (±20%) prevents thundering-herd problems.
- **Hard caps:** `maxRetries ≤ 10`, `maxDelay ≤ 60 000 ms`, `baseDelay ≤ 10 000 ms`.

---

## CI/CD

GitHub Actions runs on every push and pull request to `main`:

1. **Lint** — `npm run lint`
2. **Tests** — `npm test`
3. **Coverage gate** — fails if coverage drops below 95%
4. **Build check** — `node --check src/index.js`

Ensure your branch passes all checks before opening a PR.

---

## Contributing

```bash
# 1. Fork and clone
git clone <your-fork-url>
cd liquifact-backend

# 2. Create a feature branch
git checkout -b feature/your-feature   # or fix/your-fix

# 3. Install and configure
npm ci
cp .env.example .env

# 4. Make changes, keeping style consistent
npm run lint:fix
npm test

# 5. Commit with a clear message
git commit -m "feat: add X"   # or "fix: Y"

# 6. Push and open a Pull Request to main
git push origin feature/your-feature
```

We welcome docs improvements, bug fixes, and new API endpoints aligned with the LiquiFact product.

---

## License

MIT (see root LiquiFact project for full license).