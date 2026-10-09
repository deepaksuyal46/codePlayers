# CodePlayers — Admin roles and phone OTP

A complete Next.js + MongoDB hackathon application with a 1,000-product sample catalogue, customer accounts, admin dashboard, 2Factor.in SMS registration verification, carts, reserved checkout, simulated payments, and a durable expiry worker.

This package updates the latest supplied CodePlayers_RBAC_OTP code, replacing its unconfigured email-OTP adapter with 2Factor.in SMS delivery. SMS verifies a phone number, NOT the email address. There are no default admin credentials and no public admin registration.

## 1. Run locally

Extract the ZIP into a new folder. Open PowerShell in that folder:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
notepad .env.local
```

If .env.local already exists, keep it; do not overwrite your working credentials. Set:

```dotenv
MONGODB_URI=YOUR_WORKING_ATLAS_URI
MONGODB_DB_NAME=meesho
APP_ORIGIN=http://localhost:3000
PAYMENT_MODE=demo
TWOFACTOR_API_KEY=YOUR_2FACTOR_IN_API_KEY
OTP_SECRET=YOUR_RANDOM_SECRET
```

Keep the same MONGODB_DB_NAME as your existing working project to retain accounts, products, carts and orders. Percent-encode reserved password characters in the URI, including $ as %24. Generate a strong OTP_SECRET locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy that generated value into OTP_SECRET. Do not prefix either secret with NEXT_PUBLIC_. Never send secrets in chat or commit them.

Then run each command separately, stopping on errors:

```powershell
npm run db:check
npm run data:check
npm test
npm run seed
npm run dev
```

Seed is needed for a new database. It preserves existing inventory, but refreshes catalogue fields, including prices and visibility: do not rerun after admin edits unless you intend to restore dataset catalogue values.

In a second terminal inside frontend:

```powershell
npm run worker
```

Open http://localhost:3000/login, choose Create an account, enter name/email/password/Indian mobile number, and verify the six-digit phone code. Passwords are 10–64 characters, at most 72 UTF-8 bytes.

## 2. Create the first administrator

First register normally and verify your phone. In a terminal with access to the SAME database:

```powershell
npm run role:set -- your-email@example.com admin
```

This trusted command promotes that account and revokes its old sessions/challenges. Log in using the Admin Login tab and verify the SMS OTP. Open /admin/dashboard. The command will not promote an unverified phone. To revoke admin access:

```powershell
npm run role:set -- your-email@example.com user
```

Do not expose these commands through a public API. Restrict database/deployment-console access to your team administrators.

## 3. Existing accounts and existing web folder

Existing accounts keep their passwords, carts, and orders. Old sessions require signing in again. On the first sign-in after this update, provide a mobile number in the login form and verify it; future customer logins only require email/password. A verified admin always needs a phone OTP at login. Email verification flags are not forged by phone verification.

To update the original Windows web folder instead of running the extracted frontend, stop its app/worker, then run from this extracted root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-IntoWeb.ps1 -TargetWeb "C:\Users\Lalit Suyal\OneDrive\Desktop\codePlayers\web"
```

The installer backs up old source/config, preserves .env.local and Git, and copies frontend contents directly into web. Add the new TWOFACTOR_API_KEY and OTP_SECRET to the preserved file. Run npm ci and the checks from web afterwards. It does not commit, push, deploy, or change the nested organizer repository. Use this clean extracted root for the bundled render.yaml deployment instructions.

## 4. Deploy

See DEPLOYMENT.md. The ZIP includes Dockerfile, compose.yaml and render.yaml for the web app plus expiry worker. You must supply Atlas access, the OTP key, a random secret and your actual HTTPS site origin. This is not a static-export application.

## What is implemented

- Customer-only public registration, activated only after phone OTP.
- Email/password customer login; phone enrollment for old accounts.
- Admin login with password + OTP and server-side role checks on pages/APIs.
- Admin product/account/order counts, searchable paginated products, price and visibility edits, latest 50 order summaries.
- Six-digit cryptographically generated OTP, five-minute lifetime, five guesses, 60-second resend cooldown, per-phone/email/global limits, keyed OTP hashes, single-use transactional account creation.
- No API key or readable password/OTP in browser responses or database records.
- Existing dataset, cart synchronization, Lite Mode and simulated checkout preserved.

## Scope and verification

Payments remain simulated. No password reset, email verification, phone-change recovery, admin stock adjustment, refund or shipping management is included. Source photo URLs may fail; image placeholders remain. Admin price changes apply to new quotes; already reserved checkouts use their reserved price snapshot.

See frontend/docs/VERIFICATION.md for exactly what was executed. A successful build is not a live SMS or deployment test. Complete a real registration, admin login, unauthorized-access check and shopping journey on your deployment before sharing it with judges.
