# Morkahja — Phase 6 frontend dynamic content

**Status:** Implemented in isolated draft PR #14, stacked on unmerged PRs #10–13. No production deployment, content migration or approved live publishing. Verification and remaining blockers are reported in PR #14.

## Shared content authority

The React client now loads the complete five-dataset JSON bundle and managed artwork URL mapping from GET /game-data/content through a single external store in client/src/content/clientContent.ts. Consumers subscribe via useSyncExternalStore; there is no independent per-screen JSON fetch or separately updated category state. All five categories and the managed asset map are accepted together only after schema, key/ID, indexed-array, image-name and exact revision-URL checks. A malformed response cannot replace valid content.

Each refresh sends If-None-Match when a published revision is active. 304 reuses the same snapshot. Multiple simultaneous refresh calls share a network request. A valid 200 installs a whole new revision. Failure retains the last known complete revision, publishes an error state, and does not merge partial data.

**Legacy compatibility:** The only build-time JSON imports remaining are in the shared store, where they are used exclusively when the backend explicitly returns 503 CONTENT_NOT_CONFIGURED. Other failures, an unavailable configured publication, unsupported endpoints or corrupt content do not silently revert to Git. The legacy bundle is not an alternative authority when a valid published revision has already been selected.

## Consumers migrated

- App: initial loading waits for both the existing data-status check and a full content snapshot. Dashboard and game entry refresh the content, then revalidate periodically while active.
- GameEnvironment: encounter metadata and prepared-follow-up artwork resolve from the content snapshot, with a revision check when the encounter changes.
- ExpansionsOverlay: current expansion records and encounter previews use the same published data, with refresh on open and a warning when the last-good revision is retained after an error.
- ResultBlock, SolutionBlock, SolutionGridOverlay, partyParticipantChoiceBadge, AvatarSolutionInflow: inventory/solution grids, reward and loss images, tooltip metadata, action icons, party choice badges and transition flights read the shared solution table.
- AvatarCreation: portrait/frame records and image URLs read the current published arrays; the overlay revalidates on open and clamps stale selections.
- AvatarPortraitStack and avatar preloader: portraits and frames use the shared artwork resolver throughout the UI.
- SolutionStarfield and encounterInventoryPreview: decorative solution stars and the shared inventory/solution-charge calculator read the same live solution table. Development mock-avatar presets read the current portrait/frame arrays instead of independent JSON imports.

## Revision-aware media and fallback

contentImageUrl(kind, logicalName) uses the managed revision URL from the same content response and applies VITE_API_BASE_URL when configured. Managed URL paths are validated against the exact selected revision. Unknown or unsafe names do not yield a URL. Original, known legacy asset identifiers still use their bundled static locations, including established placeholder art. Bundled decorative UI assets are intentionally unchanged.

Replacing managed artwork with an unchanged logical name produces a new immutable revision URL; historical URLs continue to resolve to their original image bytes at the backend. The browser switches only when the complete content revision is accepted.

## Loading, error and release boundaries

Startup uses the existing loading state machine and fails rather than promoting a partial published response. Once loaded, a failed refresh keeps last-good content and exposes an error state; ExpansionsOverlay and AvatarCreation show a nonfatal warning. A valid 304 causes no replacement or flicker.

Focused tests: npm run test:client-content. CI separately runs npm run build --prefix client before the existing root typecheck, so old server type errors cannot hide a frontend build failure. Test results must be read from GitHub Actions.

**Remaining:** Active solo encounters and multiplayer room snapshots are not pinned to a backend content revision; live publication is still disabled until pinning and gameplay compatibility are verified. Legacy artwork import/parity, physical browser tests, production proxy/backups, local Babuni Admin client integration and full release checks remain separate tasks. No code was merged into main or enabled on production.

**Implementation attribution:** The human creative supplied the desired content-management behavior and integration constraints; the code, tests and technical documentation in this review branch were implemented with AI assistance.
