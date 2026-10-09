# Troubleshooting

## Health returns 503

Check .env.local inside web next to package.json; key is MONGODB_URI. Restart Next.js after changing it. Check Atlas username/password, URL-encoding, IP allowlist, database name and read/write permissions. Run npm run db:check in web. Never paste your complete URI into a public issue.

## Transactions fail

Use a replica set/sharded deployment supporting transactions. Standalone local mongod is insufficient. db:check verifies real rollback. Do not replace transactional writes with separate updates to suppress an error.

## Origin not allowed (403)

APP_ORIGIN must match the exact browser origin: for example http://localhost:3000. If Next.js picked port 3001 because 3000 was occupied, stop the old process or update APP_ORIGIN and restart. localhost and 127.0.0.1 are different origins. Do not disable the check as a fix.

## Products missing

Run npm run db:check and npm run seed, then reload. This app uses CP-prefixed model collection names and will not automatically read unrelated existing collections. The bundled dataset is already mapped; see docs/DATA_IMPORT.md for details. Search is token-based; use 'tote', 'kurta', 'mug' rather than assuming fuzzy matching.

## Stock not returning

Keep npm run worker running in a second terminal. Expiry is at 180 seconds on the server; release is normally processed in the next worker cycle, not guaranteed to the exact millisecond. The demo payment endpoint and checkout status reject expired holds even when worker cleanup is delayed.

## Offline page does not appear

Visit online first and allow service worker registration to complete. Reload once online. Use localhost or HTTPS. A first-ever offline visit has nothing cached. For DevTools testing disable network, not the service worker. Offline browsing is limited to the saved cart shell and cached illustrations, not a full searchable catalogue.

## Old starter page or old /api/health remains

Use the backup installer. Plain copying can leave old exact routes which shadow this catch-all API. Stop Next.js, ensure only the delivered src/app remains, and remove the generated .next cache before restarting. Do not delete .env.local or your Git repository.

## Test server blocked

npm run test:local downloads/runs a local MongoDB binary. A restrictive host may block it. Use an explicit TEST_MONGODB_URI for a separate test deployment and npm run test:integration. The suite creates/drops only a random cp_test_ database, but needs test-user permissions for that. Do not give it production credentials.

## Dependency warning

Run npm audit and inspect the detailed chain. Do not run npm audit fix --force blindly. Use the bundled lockfile with npm ci. This bundle's lint command is a TypeScript compatibility alias; ESLint is not installed.

## Reset or restore

The seed preserves stock counters on rerun. To make a completely fresh demo, point MONGODB_URI at a new demo database name and run db:check and seed. Do not delete a shared database casually. Prior source files are in the installer-printed backup directory; restore them separately from database records.
