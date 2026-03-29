# LiquiFact Backend

API gateway and server for LiquiFact — the global invoice liquidity network on Stellar.  
This repo provides the Express-based REST API for invoice uploads, escrow state, and (future) Stellar/Horizon integration.

Part of the LiquiFact stack: **frontend (Next.js)** | **backend (this repo)** | **contracts (Soroban)**.

---

## Error Handling (RFC 7807)

This API uses RFC 7807 Problem Details format for error responses.

Example:
{
  "type": "https://example.com/errors/bad-request",
  "title": "Bad Request",
  "status": 400,
  "detail": "Invalid input",
  "instance": "/api/resource"
}

Content-Type: application/problem+json

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