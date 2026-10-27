# Morkahja — architecture snapshot

**Author:** Babuni.dev

- `client/`: React/Vite browser interface including dashboard, world, encounter and account screens.
- `server/`: Express/TypeScript services for sessions, encounters, progression, social data and other game operations.
- `shared/`: shared TypeScript contracts.
- `package.json`: workspace commands for typechecking, encounter/lifecycle tests and release checks.
- `DEVLOG.md`: evolving development notes and commit references.

Static inspection only; no server tests, browser tests or production configuration checks executed here.

## Architectural development evidenced by the original journal

The journal identifies three coordinated pieces by the **May 18, 2026 playable checkpoint**: React/Vite browser client, Express API services, and shared client/server TypeScript contracts. It describes PostgreSQL-backed persistent game documents and later server-authoritative enforcement of encounter outcomes and avatar death (May 22). A shared dice interpretation layer was added to reduce client/server disagreements.

The current root package declares **`0.9.0-beta.2.2`** with npm workspaces `client`, `server` and `shared`. Named verification entrypoints are `verify:static-data`, `test:encounter`, `test:lifecycle`, `typecheck` and `release:check`; their presence establishes a test path, **not a passing test result**. The server package additionally exposes specific tests for sessions, rooms, achievements, dice, commerce and inventory.

In the historical May 23 entries, the project gained PM2/nginx deployment configuration, a same-origin API default and documented HTTPS requirements for Web Crypto-based onboarding. The journal notes a Hetzner public alpha. That historic deployment evidence does **not** verify current availability, credentials, backup policy or security. The pre-invite review itself records additional safeguards as needed before wider launch.

**Boundary:** This is a static examination of repository metadata and historical journal, not a penetration test, live-environment audit, database migration or deployment verification.
