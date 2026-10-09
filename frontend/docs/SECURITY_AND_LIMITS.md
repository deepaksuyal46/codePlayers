# Security and scope

See AUTH_AND_ROLES.md for role, session and OTP enforcement. Secrets belong only in server environment variables; the ZIP contains no real keys or default passwords. Client-supplied roles cannot create admins. The role CLI requires trusted database access.

Payments, delivery and notification outbox remain simulated. OTP SMS is the only implemented external message delivery and requires 2Factor.in configuration. No password reset, email verification, phone-change recovery, stock administration, refunds, fulfillment integrations, or security audit is included. Synthetic catalogue ratings are not genuine reviews. Product SEO remains global demo metadata/noindex.

Rate limits reduce abuse but are not a complete public-site anti-fraud defense. Configure infrastructure request/spend limits before broad public use. Avoid logging outbound provider URLs because the documented provider endpoint contains a key and OTP in its path. Registration checks reveal duplicate identifiers for usability. Admin product edits are last-write-wins; this edition has no admin audit-log UI.

The local database integration suite must run on a dedicated test deployment. It explicitly replaces both MONGODB_URI's database and MONGODB_DB_NAME with a unique test database, and drops only that matching test database afterward.
