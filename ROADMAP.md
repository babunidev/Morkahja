# Morkahja — evidence-based roadmap

**Author:** Babuni.dev

## Existing source

Node workspaces include client, server and shared; scripts include encounter tests, lifecycle tests, a release check and typechecking. The current root package declares a 0.9.0 beta version.

## Unverified

This documentation audit did not launch the web client or server, perform database migrations, run the stated tests or inspect private production services. No feature is promoted to working solely because a component exists.

## Proposed validation

Run documented static and lifecycle checks in an appropriate development environment; independently verify account/session security and game-data version consistency.

## Post-audit work, not yet verified (2026-10-27)

- [x] Preserve the detailed original root `DEVLOG.md` as historical source.
- [x] Add separate visual-design and content-provenance reference documents.
- [x] Establish evidence-backed milestones from the May–June 2026 original journal.
- [ ] Execute `npm run release:check`, `npm run test:encounter` and `npm run test:lifecycle` on a suitable clean checkout; archive exact outputs.
- [ ] Independently test current browser interface, avatar death/recreation, encounter/dice outcomes, achievements, expansions and friends.
- [ ] Verify production architecture, backups, session/authentication safeguards, rate limits and privacy before treating historical alpha/deployment notes as present security certification.
- [ ] Curate an approved lore, content and image-credit inventory for the portfolio without publishing private player information.
- [ ] Cross-reference material design decisions in dated source/commits; do not infer author acceptance of every implementation detail.

**Audit boundaries:** Documentation-only source review. No builds, tests, live server calls or production data access.


## Proposed deployment — game under babuni.dev (2026-11-09)

**Target selected by Babuni:** `https://babuni.dev/Morkahja/`, with the main website remaining at `https://babuni.dev/`.

**Status:** Planned, not implemented. The current DNS destination and live hosting topology remain unknown and must be inspected before choosing the Nginx/reverse-proxy arrangement.

- [ ] Confirm DNS, website host, game VPS, active Nginx virtual host, HTTPS and current production services.
- [ ] Take and independently verify a restorable PostgreSQL backup; preserve all player and published content.
- [ ] Configure Vite's base path as `/Morkahja/` and use the existing API base setting with `VITE_API_BASE_URL=/Morkahja/api`.
- [ ] Audit root-relative asset URLs and make client/server asset paths work beneath the subpath without colliding with the main website.
- [ ] Update PWA start URL, scope and icon path; set the production social-preview URL.
- [ ] Route `/Morkahja/api/` through Nginx to the existing Express root routes; configure `CLIENT_ORIGINS` as the domain origin and `CLIENT_URL` as the game URL.
- [ ] Deploy the frontend to an isolated document root. Do not allow build synchronization or `rsync --delete` to touch the website root or persistent content.
- [ ] Test recovery-key restoration against the existing database; communicate that browser storage and sessions do not transfer across origins.
- [ ] Verify website isolation, game routes, assets, API, gameplay, PWA and Stripe (if enabled); record exact test evidence.
- [ ] Cut over with a retained frontend/configuration rollback path and no database reset.

See [the deployment plan](docs/DEPLOYMENT.md) for the source-backed implementation sequence, routing design, recovery constraints, verification checklist and unresolved infrastructure questions.
