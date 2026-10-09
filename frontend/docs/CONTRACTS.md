# Updated authentication

Authentication and admin routes in this release are defined in AUTH_AND_ROLES.md, which supersedes earlier immediate-registration behavior below. New accounts require phone OTP before a session. Existing commerce contracts remain unchanged.

# Implemented contracts — v1

This is the contract for this delivered source. The earlier nine-phase document is a design reference, not a claim that every planned phase/API is implemented.

## HTTP

All APIs return `{data, requestId}` on success or `{error:{code,message},requestId}` on error. IDs are strings and timestamps ISO UTC. All API responses are `Cache-Control: no-store`. Mutations require an Origin header equal to APP_ORIGIN (or the actual request origin when unset). In a browser it is sent automatically. Postman/curl tests must supply it. Cookie auth is an opaque random token; only its SHA-256 hash is stored in MongoDB. Lifetime seven days; expiry is checked in queries, not solely TTL deletion.

Routes:
- GET /api/health
- POST /api/auth/register {name,email,password}
- POST /api/auth/login {email,password}
- GET /api/auth/me
- POST /api/auth/logout {}
- GET /api/categories
- GET /api/products?q=&category=&maxPrice=50000&sort=featured&page=1&limit=12
- GET /api/products/[id]
- GET /api/cart
- PUT /api/cart/items/[sku] {quantity,expectedVersion}
- DELETE /api/cart/items/[sku] {expectedVersion}
- POST /api/checkout/quote {address}
- POST /api/checkout {cartVersion,quoteHash,address}, with Idempotency-Key
- GET /api/checkout/[id]
- POST /api/checkout/[id]/cancel {}
- POST /api/checkout/[id]/payment {outcome:"success"|"decline"}
- GET /api/orders (latest 50)
- GET /api/orders/[id]

Product search uses MongoDB's text index (token matching; no typo tolerance, substring or fuzzy guarantees). Sort: featured, price_asc, price_desc, name. maxPrice is integer paise. Page max 1000; limit max 24. This small demo uses bounded offset pagination, not the originally proposed cursor contract. Read the TypeScript DTOs in src/lib/types.ts before adding callers.

## Schema

Each product has one unique SKU and slug, title/category/description, one price in paise, normal/lite image URLs, color, active flag and demo flag. No variants or manufactured review scores. Orders embed immutable line/address snapshots. The user/email mapping, session, cart, attempt, reservation, payment and order references are enforced in services; MongoDB has no SQL foreign keys.

Inventory: available, reserved, sold. Reserve moves available→reserved; confirm moves reserved→sold; release moves reserved→available. Seed initializes inventory only if missing. No shipping decrement or returns/restocking is implemented.

Checkout: RESERVED→CONFIRMED, EXPIRED, CANCELLED or FAILED. Reservation: HELD→COMMITTED, EXPIRED or RELEASED. Mutation guards, counters and corresponding records share a transaction. MongoDB transaction operations execute sequentially with the same session. Independent requests compete normally. Retryable driver transaction callbacks have no external side effects.

Checkout key uniqueness scope: (userId,key), with a request hash. Same key/different payload is rejected. Cart version is increased on reservation to guard concurrent cart mutation. Cart is cleared on success only if it still matches the version reserved; newer edits are preserved for review.

Expiry: server time +180 seconds; no grace window. Finalization has an unexpired HELD guard. A worker scans every two seconds, bounded to 50 holds/cycle. A slow/offline worker may retain stock longer, but an expired hold cannot be paid successfully. No TTL index deletes active reservation documents.

Demo payment is atomic within MongoDB; it is not an external payment transaction and has no unknown-provider states. External payment reliability remains future work.

Outbox: order transaction writes a stable event; leased worker consumes at least once; a unique eventId makes the local notification sink idempotent. This is a database demo sink, not email/SMS delivery.

## Offline

IndexedDB per user ID: cart snapshot, base version, pending flag. Absolute quantities are synchronized sequentially. Lost responses are reconciled by comparing desired contents. If server version differs, user explicitly chooses server or device contents. Failed API validation restores prior online state; interrupted network keeps pending local intent. One tab processes its mutations serially. Concurrent offline edits across multiple tabs on the same device are not locked and can overwrite each other's local desired snapshot; use one active offline tab.

The static service-worker fallback contains no account HTML. It reads this device's last account-scoped cart locally. Logout clears that account's saved cart and local identity hint. Address/payment/order data and tokens are not stored in IndexedDB or public cache. No offline reservation or payment.
