# Authentication and role contract

POST /api/auth/register: {name,email,password,phone}. Returns {status:"otp_required",challengeId,expiresAt,resendAfter,maskedPhone}. Always creates a customer after verification; supplied role fields cannot elevate privileges.
POST /api/auth/verify-register: {challengeId,otp}. Creates user+cart and consumes the challenge transactionally, then creates a seven-day HttpOnly session.
POST /api/auth/login: {email,password,portal:"user"|"admin",phone?}. Verified customers normally receive {status:"authenticated",user}; admins receive an OTP challenge. An old account lacking phone verification supplies phone, proves its password, then verifies its phone with OTP.
POST /api/auth/verify-login: {challengeId,otp}. Accepts login/enrollment challenges only; role changes since challenge creation are rejected.
POST /api/auth/resend-otp: {challengeId}. Requires an active challenge, remaining attempts and 60-second cooldown. Returns challenge metadata. Resets code only; does not reset expiry or guesses.
GET /api/auth/me: {user|null}. Roles are read from MongoDB, never trusted from localStorage.
POST /api/auth/logout: invalidates the current session.

Admin routes require role=admin, phoneVerified=true, and a session with authLevel=two_factor:
- GET /api/admin/stats
- GET /api/admin/products?q=&page=1 (12 records/page)
- PATCH /api/admin/products/:id {pricePaise,active}; no stock-counter changes
- GET /api/admin/orders (latest 50 summaries, excludes address/contact details)
- /admin/dashboard redirects unauthorized visitors to /login; the APIs reject them server-side.

Trusted CLI: npm run role:set -- email@example.com admin|user. Role changes invalidate that user's sessions and login/enrollment challenges. Register and phone-verify before promotion.

OTP uses six random digits, an HMAC-SHA256 digest bound to an unpredictable challenge ID, five-minute expiration and at most five guesses. MongoDB status transitions serialize verification/resend; unique email and partial unique phone indexes prevent duplicate accounts. The server checks expiration explicitly; TTL indexes only clean up expired data. Inactive/unverified accounts cannot use protected commerce APIs through old sessions. A phone is not an email verification: emailVerified remains false on SMS registration.

Session tokens are random opaque cookies with their hashes stored in MongoDB. Cookies use HttpOnly and SameSite=Lax; Secure is enabled in production. Mutations check exact APP_ORIGIN. Browser-stored user hints only support offline UI and confer no server permissions.
