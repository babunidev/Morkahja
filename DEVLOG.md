# Morkahja devlog

Brief chronological overview of the web app from first commit to present. Newest work is at the bottom.

| | |
|---|---|
| **Started** | 2026-05-16 22:21 (+0200) |
| **Last updated** | 2026-05-26 (+0200) |
| **Release** | **0.9.0-beta.1** (public beta, pre-1.0) |

Section headings use **date** and **time** from git (`+0200`, Europe/Berlin). Ranges cover the commits grouped in that block.

---

## Development overview

### 2026-05-16 22:21–22:27 (+0200) — Game data layout

1. Add **LudusOccursus** / **LudusSolutio** structure for encounters and solutions.
2. Rename datafiles; remove superseded JSON (`LudusOccursus`, `LudusSolutio`, `MorkahjaRules`).

### 2026-05-17 12:26–13:37 (+0200) — Repo bootstrap

3. **Initial commit** — encounter images and core game data assets land in the repo.
4. Sync with remote; delete obsolete top-level `Game/` directory.
5. Fix **TypeScript module resolution** for the client/server/shared workspace.

### 2026-05-18 15:14 (+0200) — v0.1 playable (`3f71171`)

6. First **playable checkpoint**: Vite + React client, Express API, shared contracts.
7. Sign-in / session flow, dashboard shell, avatar selection, encounter loop.
8. Static game data (encounters, solutions, portraits, frames), PostgreSQL document store.
9. UI asset tree (backgrounds, buttons, encounter art, welcome flow).

### 2026-05-19 04:37 (+0200) — Audio (`e8edbed`)

10. **v0.12 music engine** — playlist wiring and playback controls for dashboard and in-game ambience.

### 2026-05-20 04:54–05:30 (+0200) — Rewards and Scribes (`03b715b`, `f0ca176`)

11. Fix **duplicate solution IDs** (10065–10068) so warrior reward pool entries are unique.
12. **Level-up encounters** — outcome-based race/role abilities without hardship penalties; `rewardIds` precomputed for result preview.
13. **Game event pipeline** — persisted events in PostgreSQL, bus + renderer foundation.
14. **SCRIBES** activity feed overlay on the dashboard; unread-style world log.
15. **Atranor death** survival rules; music volume in settings; related gameplay UI fixes.

### 2026-05-21 02:01–04:10 (+0200) — Content and dashboard shell

16. Fix high-impact **solution name/description typos**; sync client `solutiondata.json` mirrors (`3b9ab56`, `f0e6030`).
17. Remove obsolete game ambient tracks; reclassify solution **10185** as PurgeSkill (`32d22af`, `f0b141d`).
18. **Expand music playlists** for dashboard and in-game (`eaa2aa1`).
19. Dashboard **overlays** — Scribes unread indicator, achievements entry point, ambient wiring (`6e4dc8e`).
20. Remove legacy avatar portrait assets; **inventory bootstrap** on new avatars (`d284bbe`).

### 2026-05-21 05:44–14:18 (+0200) — Encounter UX (`85eeb3a`, `686c16c`)

21. **Result screen** — reward icons fly to footer targets on Continue; losses fly from portrait into outcome slots; dice art beside outcome text.
22. **Reveal pacing** — slower encounter crossfade (720ms); solution/dice fade-in (1100ms); spacer bar stays visible.
23. All **four solution slots** shown (missing items dimmed + tooltip).
24. Healing Elixir image renamed to match potion icon (`43c08a6`).
25. Smoother **continue transition**; fix reward icon flicker when result layer hides (`686c16c`).
26. **Lore gem** click fix (`inert` hidden result layer); scrollable Scribes feed.

### 2026-05-21 15:33 (+0200) — Adventurer achievements (`9ea2110`)

27. First real **achievement chain** (Adventurer → Trailblazer): event-driven progress on `encounter_resolved` / `encounter_failed`, rank thresholds **100 / 200 / 400 / 800** encounters (max rank 4), `player_achievements` table.
28. **`achievement_unlocked`** events → Scribes (“became a Wayfarer”, etc.).
29. **Daily reward** — **21** encounters per **UTC day**; gem payout scales with rank (1–5); `daily_reward_claimed` events; deduped claims.
30. **`AchievementPanel` / overlay** — rank overlays, progress bar, `N/N encounters` daily line, footer gem count.
31. **Nav attention UX** — closed menu dots at **13:00** (Scribes) and **17:00** (Achievements); open menu wiggle + **independent glow rhythms**; `achievementsAttentionState` in localStorage.
32. **`gems_received`** recorded inside `addPlayerYellowRedGems` so Scribes always sees gem grants.
33. `npm run test:achievements` for rank/daily-reward math.

### 2026-05-22 02:37–04:26 (+0200) — Server death, avatar flow, Alpha Player (`904bfed`…`953e348`)

34. **Shared dice** — `interpretRoll` / `isRollFavorable` in `@morkahja/shared`; server re-exports; client imports via `@shared` Vite alias; `npm run test:dice` parity test.
35. **Server-authoritative Atranor death** — removed client `isFatalAtranorRoll` shortcut; all Misery/Hardship on encounter **1** go through `POST /encounter/continue`; `avatarDied` / `deathTriggered` on response; max **3** avatars per player (`AvatarLimitReachedError`).
36. **Avatar death UX** — `AvatarDeathOverlay`; dead IDs in `localStorage`; `purgeDeadAvatarsOnServer` returns `{ purgedIds, failedIds }`; Home awaits purge + refetch before recreate preset; Play gated on `prepareAvatarSelection()` (loading + inline spinner).
37. **Dashboard** — `AboutUsOverlay`; `avatarSelectionPrepare.ts` helpers; enlarged achievement rank overlays past icon frame.
38. **Alpha Player** achievement — progress on `level_up` + `avatar_died`; global **100** Legendborn (rank 4) cap; `globallyLocked` + chain title in UI; daily reward threshold raised to **42** encounters; removed unused root `achievements.json`.
39. **Encounter art** — refreshed `death_atranor`, Tempest fight, and Verdani heal `.webp` assets.
40. **Solution affordance** — dimmer disabled slots; rattle animation when dice/solutions unlock; slightly wider hub footer buttons.

### 2026-05-22 04:42–08:12 (+0200) — Achievement chains, donations, expansions, friends (`3d01551`…`135779f`)

41. **Achievement chains** — Firestarter, Contributor (gems donated), Blessed (Fortune/Prosperity), Combatant / Trickster / Helper (encounter-type solves); hide chains with zero progress unless rank > 0.
42. **Daily reward** — base **1** gem plus sum of achievement ranks across all chains (`dailyRewardService`).
43. **Scribes polish** — Prosperity lines show reward names/icons; activity feed window **1 hour** (was 15 min).
44. **Donations** — gem donate flow from About Us; contributor achievement progress on `gems_donated`.
45. **Settings** — player name beside SETTINGS title.
46. **Expansion catalog** — `expansiondata.json` on client and server; `GET /player` exposes `unlockedExpansions`; encounters gate on expansion id (`includes`, not cumulative level).
47. **Expansions overlay** — dashboard nav at **19:00** (`im_button_expansions`); expandable cards (header art from `UI/03_DASHBOARD/expansions/`); **`POST /player/expansions/unlock`** spends gems and appends expansion id to the player profile.
48. **Nav UX** — radial menu tooltips (e.g. News → “Scribes”) and subtle hover scale/glow on open-menu buttons.
49. **Layout tweak** — solution block lowered **3px** (`translateY`) for seam alignment (`dc18f7b`).
50. **Asset hygiene** — prune duplicate `10_Shop` portrait tree and archived UI; move settings `PORTRAITS.webp`; add dashboard expansion header/unlock `.webp` set.
51. **Friends list** — Social nav opens overlay; add by player name; shows last-played avatar, online status, and read-only achievements on tap.
52. **Friends polish** (`135779f`) — friend detail lists all avatars (last-played highlighted); read-only achievement snapshot; strip self from stored `friendIds`; defensive API parsing.
53. **About Us** — credits accordion; **Donation** opens gem donate overlay via Close-style text button (replaces donate image asset).
54. **Scribes** — `avatar_created` entries show portrait + frame in the feed (`avatarPortrait` / `avatarFrame` on event payload).
55. **Encounter art** — refreshed `combat_nagar_berserk.webp`.

### 2026-05-23 12:50–18:56 (+0200) — Content, loading, friends, deploy (`b6a7500`, `b74c43e`, `ef92dd4`)

56. **The Guardian** encounter lore updated to describe a wolf (`b6a7500`).
57. **Seal of Norghor** — dashboard subscription UI assets (`b74c43e`).
58. **Welcome loading** — seasonal logos (`logo_winter.webp` spring/winter, `logo_summer.webp` summer/autumn); larger logo; fade/slide enter; gentle sway while loading (spinner removed); `resolveLoadingLogoPath()` in `backgroundResolver.ts`.
59. **Encounter persistence** refactor (`encounterPersistence.ts`, state machine/controller wiring); refreshed encounter art (Grimnir heal, Lianiguard, razorback, hidden market).
60. **Friends hardening** — `findPlayerByNameOrId` prefers `playerName` over legacy stub ids; `resolveCanonicalFriendId` rewrites stored friend ids; client null-safe friend profile (`avatars` / `achievements`); result-screen reward tooltips with `mSolutionText`.
61. **Deploy** — `ecosystem.config.cjs` (PM2); configurable `PORT` and `corsOrigins`; welcome/error/no-connection WebP assets.

### 2026-05-23 20:23 (+0200) — Scribes authors, audio defaults, UI polish (`595100b`)

62. **Scribes** — `authorName` on activity feed entries (`gameEventService`, shared `ActivityFeedEntryDto`); overlay meta row (author left, time ago + “New” right).
63. **Audio** — default **30%** music/SFX for new accounts; `readStoredVolume` treats null/empty `localStorage` as default (not 0%); `seedDefaultAudioVolumesIfUnset()` on app mount and onboarding.
64. **Dashboard/game UI** — nav-style hover on Play and avatar slots (`useTooltipReveal`); solution-slot reward tooltips; `useMobileFullscreen` + viewport helpers in `index.html`.

### 2026-05-23 20:32–20:53 (+0200) — Tab branding, link previews, image protection (`dd17e2f`, `5b2d423`)

65. **Browser tab** — title **Morkahja**; favicon and `apple-touch-icon` use `iconforplaystoreFG.png` (removed default Vite `favicon.svg`).
66. **Link previews** — Open Graph and Twitter Card meta tags injected at production build (`socialPreview.ts`, Vite `transformIndexHtml` plugin); `og:image` points at the app icon on the public origin; default site URL `https://arcanitebrothers.com`, override with `VITE_SITE_URL` at build time (Telegram and other sharers read static HTML only).
67. **Image protection** — `protectedImage.ts` + `useProtectedImages()`; block drag and casual selection on backgrounds, encounter art, and hub/footer surfaces; form fields stay selectable.

### 2026-05-23 21:50–22:15 (+0200) — Production go-live and overlay protection (`bb226dd`, `18d0d1b`)

68. **First public alpha host** — Hetzner VPS; game served at **https://arcanitebrothers.com** (and `www`); DNS A record → server IP.
69. **Stack on server** — Ubuntu; **nginx** serves `client/dist` from `/var/www/morkahja` (rsync after each `npm run build`); API paths proxied to **PM2** → Node on `127.0.0.1:3000`; **PostgreSQL** on localhost (`morkahjadbadmin` + `morkahja` DB).
70. **HTTPS** — Let’s Encrypt via `certbot --nginx`; required for Web Crypto (`crypto.subtle`) so **Create journey** / recovery keys work in the browser (plain `http://` on a public IP is not a secure context).
71. **Deploy wiring** (since `ef92dd4`) — `ecosystem.config.cjs` (PM2 from repo root, `cwd: server`, `tsx` on `src/server.ts`); `PORT` + `CLIENT_ORIGINS` via `server/src/config/corsOrigins.ts`; client `API_BASE_URL` defaults to **same-origin** (`VITE_API_BASE_URL` optional) so production does not call `localhost:3000`.
72. **Ops lessons** — `.env` only on server (never git): one `KEY=value` per line; URL-encode `+` / `*` in `DATABASE_URL`; **`Key.js` is dev-only** (never on VPS); without `DATABASE_URL` the server falls back to `localhost:4242` in `postgresDocumentStore.ts`; Postgres 15+ needs `GRANT` on `public` for app user; nginx `root` line must be exactly `root /var/www/morkahja;`.
73. **Workflow** — develop on PC → `git push origin main` → on VPS `git pull origin main`, `npm install --include=dev`, `npm run build --prefix client`, `sudo rsync -a --delete client/dist/ /var/www/morkahja/`, `pm2 restart morkahja-api --update-env` (see **Production deploy** session note).
74. **Image protection (extended)** (`bb226dd`) — `protectedOverlaySurfaceProps`, `protectedOverlayTextStyle`, `preventImageContextMenu`; Lore / Result / PlayerHub / SolutionBlock / dashboard overlays / Settings marked; document-level `selectstart` guard (inputs still selectable); blocks “Open image in new tab” on CSS backgrounds via computed `background-image` check.
75. **Pre-invite security review** — OK for small trusted alpha on HTTPS; before wide launch: rate-limit `/session/bootstrap`, cap JSON body size, Postgres backups, firewall (only 22/80/443).
76. **Lore gem exploit fix** (`18d0d1b`) — Removed `POST /player/currency/yellow_red_gem`. Lore gems are server-authoritative: `POST /encounter/lore-gem/offer` rolls eligibility + delay on the active encounter snapshot; `POST /encounter/lore-gem/claim` requires matching `encounterKey`, active encounter, offer timing, and one claim per snapshot via `loreGemClaims`. `addPlayerYellowRedGems` now requires a claim key when granting.
77. **Production error responses** (`72beac6`) — `server/src/http/errorResponse.ts`: in `NODE_ENV=production`, 5xx and unexpected 4xx return generic messages; intentional API errors (`SessionError`, `LoreGemError`, encounter conflicts, etc.) still expose safe messages; full details logged server-side.

### 2026-05-24 00:34–01:11 (+0200) — Admin API, PWA shell, live presence (`72beac6`, `aa778fa`)

78. **Admin moderation API** — `ADMIN_API_KEY` Bearer auth on `/admin/*`; player list with status (online / offline / timed_out / banned), dashboard summary, recent activity feed, online-only list; `POST /admin/players/timeout`, `/ban`, `/unban` with session disconnect.
79. **Admin content API** — read/write hooks for encounters, solutions, expansions, portraits, and frames (`adminController`, `gameData` helpers); intended for ops tooling, not exposed to game clients.
80. **PWA install shell** — `manifest.webmanifest` (`display: standalone`, portrait, app icon); linked from `index.html`; `useMobileFullscreen` respects installed standalone / fullscreen display modes.
81. **Encounter art** — refreshed dice button (`im_button_dice_a.webp`), downed Aevis heal, Frostwind junk trade encounter; added `posterRaceSkills2.png` promo asset.
82. **Live online presence** (`aa778fa`) — `listPlayerIdsWithLiveSessions()` queries non-expired session rows; friends list and admin player status use live sessions (not stale `activeSessionExpiresAt` on the player doc); banned/timed-out players never show online.
83. **Session revocation on moderation** — `deleteAllSessionsForPlayer` clears all session rows; ban/timeout and blocked bootstrap/auth paths wipe sessions and null `activeSessionId` on the player profile.

### 2026-05-24 01:50–04:22 (+0200) — PM2 fixes, dice reveal UX, Scribes Atranor feed (`942be4b`…`11f84af`)

84. **API startup fix** (`942be4b`) — `adminController` import paths corrected (`gameData` / `adminPlayerService` live under `services/`); friend summary after add passes live session ids.
85. **PM2 production wiring** (`70a7d70`, `7905205`, `2fcfd6c`, `3f1aaa4`) — `ecosystem.config.cjs` loads repo-root `.env` into PM2 `env`; absolute `tsx` path; `tsx` as server production dependency; PM2 runs `tsx src/server.ts` with `interpreter: 'none'`.
86. **Dice and solution reveal** (`e5b5e86`, `8d032dd`) — directional fade-in for solution slots (A/B from sides, C/D from bottom); dice scale-in + 720° bounce roll on tap; dice tooltip; `morkahja-dice-roll` keyframes.
87. **Avatar creation tooltips** (`22fe987`, `11f84af`) — race/role option tooltips follow cursor on desktop; skipped on mobile portrait (`useLayoutMode`).
88. **Encounter image keys** (`11f84af`) — `mEncounterImageName` aligned with new `.webp` assets (rare treasure chest, Liani shadowwolf, ferocious silvermane, disheartened rokur).
89. **Scribes Atranor death feed** (`11f84af`, `52c792d`) — death copy “entered Atranor. The gods decide their fate”; icon from solution **10015**; `encounter_failed` uses fail icon (`No.webp`).

### 2026-05-24 05:45–05:58 (+0200) — Encounter art batch and DB config (`8e3e093`, `e5079c3`)

90. **Encounter assets** — Grimnir heal, blightwraith huntress/occultist, crumblegheist barbarian, nagar humpback; refreshed dice button WebPs (`im_button_dice_a` / `_b`); `encountersdata.json` image keys synced.
91. **Database** — `loadDatabaseConfig.ts` for clearer Postgres URL/env handling; small `postgresDocumentStore` tweak.
92. Restore missing **crumblegheist_barbarian** portrait asset (`e5079c3`).

### 2026-05-24 05:49–05:54 (+0200) — Loading errors and social preview (`44498fb`, `c63d8f7`)

93. **Welcome / loading** — bootstrap and health failures show short API messages instead of raw nginx HTML bodies on the loading screen.
94. **Link previews** — Open Graph / Twitter `og:image` uses `posterRaceSkills2.png` (race-skills promo) instead of the square app icon.

### 2026-05-24 19:06–21:06 (+0200) — Tooltips, profile, donations, encounter pool (`3501dde`…`c81db96`)

95. **Game tooltips** — touch tap-to-toggle; solution descriptions restored on hover/tap (`3501dde`).
96. **Inventory and skillbook** — item tooltips on hover and click; grid overlay hit targets fixed (`37ca8de`).
97. **In-game hover** — nav-style press pulse and hover glow on avatar slots, solution actions, and related game chrome; inventory overlay `pointer-events` so tooltips receive clicks (`b55e261`).
98. **Player profile** — `GET /player/profile`; **Profile** on dashboard radial (credits button, “Profile” tooltip) opens `PlayerProfileOverlay` (join date, up to three avatars, scrollable **wall of fame**); **About Us** moved to Settings footer (`417e49e`).
99. **Wall of fame** — on `avatar_died`, `recordWallOfFameEntry` stores portrait, frame, level, encounters played, and `diedAt` (max **48** entries, newest first) on the player doc.
100. **Solution tooltips** — anchored beside slot edges (A left, B right, C/D above); refreshed flytrap grotto, thunderfly, thunderhoof encounter art (`ef63f2a`).
101. **Donations** — **Donate directly to Babunigaming** opens PayPal (`paypal.me/babunigaming`) with maintenance/dev tooltip; gem copy uses “treasury” (`53b274b`).
102. **Encounter pool** — random selection uses `mEncounterID >= 20001` so **Lovely Meadows** (**20001**) can appear; bulk encounter image key renames and replacement `.webp` set (`1bf097a`).
103. **Production build** — `SolutionGridOverlay` tooltip handler props typed for strict TS (`c81db96`).

### 2026-05-24 21:48 (+0200) — Scribes Atranor copy refresh (`52c792d`)

104. **Scribes** — Atranor death line now reads “entered Atranor. The gods decide their fate” (supersedes earlier “Atranor item as symbol” wording).

### 2026-05-24 22:45 (+0200) — Inventory persistence fix (`c958fe2`)

105. **`avatarPresentation.ts`** — `toPersistedAvatarDto` carries `displayTitle` and `inventory` when present; list/create/select avatar endpoints return normalized DTOs.
106. **API / client** — `GET /avatar` falls back to `loadInventory` when the avatar doc lacks inventory; `GameEnvironment` keeps inventory across encounter continues so skillbook/inventory overlays stay populated.

### 2026-05-24 23:18 (+0200) — Profile titles, Seal of Norghor, overlay buttons, settings UX (`32bf3e7`)

107. **Achievement titles** — unlocked rank titles from achievement chains exposed on profile; per-avatar `displayTitle` stored on avatar profile; `PATCH /avatar/:avatarId/display-title`; title `<select>` on each live avatar in **Player profile**; UI shows “Title Name” via `formatAvatarDisplayName`.
108. **Seal of Norghor** — gem subscription (**67** yellow red gems / **28** days); `GET /player/seal-of-norghor`, `POST /player/seal-of-norghor/activate`; while active, `mergeUnlockedExpansionsWithSeal` merges all active expansion ids into effective unlocks; `SealOfNorghorSection` in Settings with lore art and activate CTA.
109. **`PanelButton` / `ClosePanelButton`** — shared overlay press/hover (nav-style pulse + gold glow); adopted on Settings, About Us, Donation, achievements, friends, expansions, Scribes, and solution grid overlays.
110. **Settings refresh** — scrollable panel (header / body / footer); bottom gradient **scroll hint** when content overflows; **Recovery key** download row; player name beside SETTINGS title; About Us remains in footer.
111. **`GET /player`** — includes `sealOfNorghor` status DTO (active, expiry, cost, `canActivate`) alongside gems and expansions.

### 2026-05-24 23:25 (+0200) — Encounter art keys (`c2e1533`)

112. Rename/sync encounter images: `drained_aevis`, `common_chest`, `embersnout`, `young_redeye`, `veilwalker`; Embersnout lore trim; common chest reward amount **2** (was **1**); DEVLOG through profile/seal/tooltip work.

### 2026-05-24 23:30 (+0200) — PM2 loads `.env` on deploy (`3f1aaa4`)

113. **`ecosystem.config.cjs`** — parses repo-root `.env` into PM2 `env` (replaces non-functional `env_file`); `DATABASE_URL` and `CLIENT_ORIGINS` reach the API without `set -a; source .env` on restart.
114. **Repo `main`** — GitHub `main` restored to app-at-root layout (solo dev); VPS deploy is `git pull origin main` on `~/arcanitebrothers`, not submodule SHAs or extra branches.

### 2026-05-25 00:18–19:14 (+0200) — Daily rewards, UI fixes, admin encounters (`244a33e`…`bbd6623`)

115. **Inventory UI** — essence slot label renamed from prior wording to **Essence** (`244a33e`).
116. **Solution tooltips (touch)** — tap-to-use no longer blocked by tooltip handlers (`df6bfbc`).
117. **Scribes achievement toast** — animated achievement notices in game and on dashboard (`5f354b7`).
118. **Daily reward** — payouts extended across **all** achievement chains; `dailyRewardService` + tests; `AchievementPanel` shows chain-aware daily copy (`0410092`).
119. **Admin content** — batch encounter data + `.webp` art via admin API (Lovely Meadows, Liani line, Gobbl, treasure, Ashen Revenant, Echowraith, Auraglow Mireling, Tempest Fury, etc.).

---

## Session notes (detail)

### Atranor = system death encounter (id 1) · 2026-05-22 04:17 (+0200)

**Atranor** (`mEncounterID` **1** / `DEATH_ENCOUNTER_ID`) is queued when essence runs out on a normal encounter; random pool still starts at **20001**. Only Atranor **Misery/Hardship** sets `avatarDied` (death overlay). `deathTriggered` means “Atranor is next,” not dead yet. Client shows overlay from `avatarDied` on `/encounter/continue` only.

Since `7023633`, `2eebf99`, `a58ac44`.

- **Server** — `encounterGenerator` sets `deathTriggered` when essence depletion queues Atranor; `avatarDied` when the death encounter roll fails; comments in `encounterGenerator.ts` and shared contracts.
- **Client** — `GameEnvironment` no longer calls `deleteAvatar` on local roll interpretation; `deathPending` blocks continues while overlay is open.
- **Purge** — `refreshAvatarSelectionAfterHome` / death Home handoff only clear `excludedAvatarIds` for successfully deleted avatars; partial failure keeps IDs and shows “Could not remove fallen avatar; try Home again.”
- **Prepare** — `loadAvatarSelection` during loading bootstrap; Play toggles slots only when `avatarSelectionPrepared`; fallback `ensureAvatarSelectionPrepared()` with button spinner (not top-right wheel).

### Alpha Player limited achievement (`15c95c5`) · 2026-05-22 04:25 (+0200)

Since `9ea2110`.

- **Progress** — `alphaPlayerAchievement.ts`; engine listens for `level_up` and `avatar_died`; ranks at **20 / 40 / 80 / 160** activity.
- **Global cap** — `alphaPlayerGlobalLock.ts` + Postgres readiness on boot; rank 4 (Legendborn) limited to **100** players worldwide; others stall at rank 3 with `globallyLocked` in API/UI.
- **UI** — `AchievementPanel` shows chain title at rank 0, sealed copy when locked; attention state unchanged pattern.
- **Daily reward** — `DAILY_REWARD_ENCOUNTERS_REQUIRED` **42** (was 21); Adventurer rank thresholds **100 / 200 / 400 / 800** (`22fa897`).
- **Tests** — `alphaPlayerAchievement.test.ts` included in `npm run test:achievements`.

### Avatar selection, death overlay, About Us (`0ea459e`, `a58ac44`, `135779f`) · 2026-05-22 03:37–08:12 (+0200)

- **`avatarSelectionPrepare.ts`** — `prepareAvatarSelection`, `purgeDeadAvatarsOnServer`, dead-ID localStorage key.
- **`AvatarDeathOverlay`** — async `onHandoffStart` (purge + preload) before dashboard recreate flow.
- **`AboutUsOverlay`** — dashboard nav “About Us” credits panel; expandable credit cards; footer **Donation** button (same style as Close) opens `DonationOverlay`.

### Encounter images and solution UX (`e6d4dd0`, `953e348`) · 2026-05-22 04:26 (+0200)

- **Images** — higher-resolution encounter art for Atranor death, Corrupted Tempest (seductress + wildheart), exhausted Verdani heal.
- **SolutionBlock** — `morkahja-solution-enable-rattle` when slots become interactive; unavailable opacity **0.37**.

### Adventurer achievements and nav dots (`9ea2110`) · 2026-05-21 15:33 (+0200)

Since `686c16c`.

- **Engine** — `achievementEngine` + `registerAchievementHandlers` on `gameEventBus`; no direct encounter-table scans.
- **API** — `GET /player/achievements`, `POST /player/daily-reward/claim`; shared DTOs; client `fetchAchievements` / `claimDailyReward`.
- **UI** — Overlay loads player gems before achievements so a 404 does not show zero gems; radial dot positioning uses spoke + 70% radius scale; separate CSS glow animations (~2.15s vs ~3.45s).

### Encounter results and reveal pacing (`85eeb3a`, `686c16c`) · 2026-05-21 05:44–14:18 (+0200)

Since `d284bbe`.

- **Flights** — `rewardFlyAnimation.ts`; `data-morkahja-footer-target` / `data-morkahja-avatar-portrait`.
- **Continue** — full bounce even for no-reward outcomes; fade-out without re-showing reward nodes (`inert`).
- **Assets** — refreshed encounter `.webp` set; `tool_heal_linen_bandage` rename.

### Expansions overlay and gem unlock (`216fdcb`) · 2026-05-22 05:50–07:46 (+0200)

Since `3d01551`.

- **Data** — `game/expansiondata.json` (LudusExtensio catalog); `mExtensioID` matches `mEncounterExpansion` on gated encounters.
- **Server** — `getExpansionById` in `gameData.ts`; `unlockPlayerExpansion` in `playerService.ts` (active flag, duplicate check, gem debit, `unlockedExpansions` merge); `expansionController.ts` → `POST /player/expansions/unlock`; errors `INSUFFICIENT_GEMS`, `EXPANSION_ALREADY_UNLOCKED`, `EXPANSION_INACTIVE`, `EXPANSION_NOT_FOUND`.
- **Client** — `ExpansionsOverlay.tsx` loads player gems + unlock list; expandable summary/lore per card; unlock button uses dashboard expansion `.webp` assets; footer gem count; `unlockExpansion()` in `http.ts`.
- **Nav** — `RADIAL_BUTTONS` entry at clock **19:00**; CSS `.morkahja-nav-tooltip` + hover on `.morkahja-nav-radial-button-visual` / center hub.
- **Tests** — `expansionUnlock.test.ts` smoke for catalog ids and active flags.

### Friends overlay (`6d21670`, `135779f`, `ef92dd4`) · 2026-05-22 08:00–08:12 (+0200); hardened 2026-05-23 18:56

- **Server** — `friendIds` on player; `GET/POST /player/friends`, `GET /player/friends/:friendId/achievements`; lookup by name or id; online via live session rows (`listPlayerIdsWithLiveSessions`, since `aa778fa`); `CannotAddSelfError` on add.
- **Sanitize** — `sanitizeStoredFriendIds` removes the viewer’s own id from `friendIds` on load (case-insensitive) and persists the cleaned list; list API also filters self by id/name match.
- **Canonical ids** (since `ef92dd4`) — `findPlayerByNameOrId` orders `playerName` match before raw id so legacy stub rows (e.g. id `Babuni` with zero avatars) lose to the real account; `resolveCanonicalFriendId` rewrites stored `friendIds` on list/add/detail.
- **Avatar** — friend row uses the avatar with the latest `lastPlayedAt`; detail response includes all friend avatars with `lastPlayed` flag.
- **Achievements** — `getAchievementsSnapshotReadOnly` for friend profile (no Firestarter side effects); shared `FriendAvatarDto` on achievements response.
- **Client** — `FriendsOverlay.tsx` from Social nav; add-friend field; list polls every 15s; detail view shows avatar grid + `AchievementPanel` (no daily claim); normalizes missing `avatars` / `achievements` arrays; request-id guard avoids stale detail after rapid friend switches.

### Scribes avatar on create (`3d01551`) · 2026-05-22 05:50 (+0200)

- **Payload** — `basePayload` stores `avatarPortrait` and `avatarFrame` on avatar-bearing events.
- **Feed** — `resolveScribesAvatarVisual` for `avatar_created`; `ActivityFeedOverlay` renders `AvatarPortraitStack` when both fields are present.

### Welcome loading UX (`ef92dd4`) · 2026-05-23 18:56 (+0200)

- **Logo** — `resolveLoadingLogoPath()` picks winter or summer WebP by season; inner `<img>` handles enter animation, wrapper handles sway so transforms do not fight.
- **Motion** — logo scales up (~2×), fades/slides from top; gentle idle sway after enter; loading spinner removed.
- **Assets** — `logo_winter.webp`, `logo_summer.webp`, refreshed welcome/error/no-connection backgrounds.

### Scribes author and audio defaults (`595100b`) · 2026-05-23 20:23 (+0200)

- **Author** — `queryActivityFeed` resolves `authorName` from event player id + name map; `ActivityFeedOverlay` shows author on the left of the meta row (larger type), relative time and “New” on the right.
- **Audio** — `DEFAULT_MUSIC_VOLUME` / `DEFAULT_SFX_VOLUME` **0.3**; `seedDefaultAudioVolumesIfUnset()` in `App.tsx` and `OnboardingGateway.tsx`; missing keys no longer parse as `Number(null) === 0`.
- **Tooltips** — `useTooltipReveal` / `useTooltipRevealGroup` for Play, nav, avatar slots, and solution grid; `SolutionBlock` / `SolutionGridOverlay` show item title, quantity, and description on hover.

### Link previews (Open Graph) (`5b2d423`) · 2026-05-23 20:53 (+0200)

Since `dd17e2f`.

- **Problem** — sharing the game URL in Telegram showed no preview; crawlers do not run the React bundle.
- **Build** — `<!-- social-preview -->` placeholder in `client/index.html`; `morkahja-social-preview` Vite plugin writes `og:title`, `og:description`, `og:url`, `og:image`, and Twitter Card tags into `dist/index.html`.
- **Config** — `SOCIAL_SITE_URL_FALLBACK` in `client/socialPreview.ts`; set `VITE_SITE_URL` when the public origin differs. Rebuild and redeploy client static files after changing; Telegram may cache — refresh via [@WebpageBot](https://t.me/WebpageBot) or a cache-busting query param.

### Image drag and selection (`5b2d423`) · 2026-05-23 20:53 (+0200)

- **Hook** — `useProtectedImages()` in `App.tsx` listens for `dragstart` / `contextmenu` on `[data-morkahja-protected-background]` and `[data-morkahja-protected-surface]`.
- **CSS** — global `user-select: none` and `-webkit-user-drag: none` on `img`; exceptions for `input`, `textarea`, `select`, and `[contenteditable]`.
- **Surfaces** — `PersistentBackground`, `EncounterFooter`, `PlayerHub` party/footer layers, and encounter image block marked with data attributes; background/footer layers use `pointer-events: auto` so the guard can intercept events.

### Production deploy on Hetzner (`ef92dd4` + ops) · 2026-05-23 21:50 (+0200); simplified 2026-05-24

- **Domain** — `arcanitebrothers.com` / `www` → VPS; certbot installs TLS into nginx `sites-enabled/morkahja`.
- **Layout** — single clone at `~/arcanitebrothers`; `main` = app at repo root (`client/`, `server/`, `shared/`). No submodule checkout on deploy.
- **PM2** — `ecosystem.config.cjs` from repo root (since `3f1aaa4` loads `.env` into `env`); `cwd: server`, `tsx src/server.ts`. First boot: `pm2 start ecosystem.config.cjs --update-env`; later: `pm2 restart morkahja-api --update-env`.
- **nginx** — `location ~ ^/(health|game-data|session|player|avatar|avatars|encounter|activity)` → `proxy_pass http://127.0.0.1:3000`; `try_files` → `index.html` for SPA.
- **Static** — `npm run build --prefix client` → `sudo rsync -a --delete client/dist/ /var/www/morkahja/`.
- **VPS build** — `NODE_ENV=production` skips devDependencies unless `npm install --include=dev` (needed for `tsc` / Vite). Do **not** commit `Key.js` on the server.
- **Smoke** — `curl http://127.0.0.1:3000/health` then `curl https://arcanitebrothers.com/health`; browser hard refresh.

**Standard deploy commands:**

```bash
cd ~/arcanitebrothers
git pull origin main
npm install --include=dev
npm run build --prefix client
sudo rsync -a --delete client/dist/ /var/www/morkahja/
pm2 restart morkahja-api --update-env
```

### Extended image protection (`bb226dd`) · 2026-05-23 21:51 (+0200)

Since `5b2d423`.

- **Helpers** — `protectedImageProps`, `protectedOverlaySurfaceProps`, `protectedOverlayTextStyle`, `preventImageContextMenu`; `findProtectedMediaTarget` treats elements with CSS `background-image: url(...)` like images for context-menu blocking.
- **Game** — `LoreBlock` (background + scroll area + gem), `ResultBlock`, `PlayerHub`, `SolutionBlock` use attrs + `userSelect: 'none'` on lore text.
- **Dashboard** — `AboutUsOverlay`, `AchievementsOverlay`, `AchievementPanel`, `ActivityFeedOverlay`, `DonationOverlay`, `ExpansionsOverlay`, `FriendsOverlay` apply overlay surface + protected `<img>`.
- **Settings** — `SettingsScreen` panel surface protected; `morkahjaText.css` reinforces non-selectable overlay copy where needed.
- **Global** — `selectstart` prevented except on text inputs (friend name field, etc.).

### Lore gem server authority (`18d0d1b`) · 2026-05-23 22:02 (+0200)

- **Removed** — client-callable `POST /player/currency/yellow_red_gem`.
- **Offer** — `loreGemService.offerLoreGem` rolls on the active encounter snapshot; stores eligibility + reveal delay server-side.
- **Claim** — `POST /encounter/lore-gem/claim` validates `encounterKey`, timing window, and one claim per snapshot (`loreGemClaims` on player).
- **Client** — `LoreBlock` polls offer state; gem click disabled until server says eligible; no local mint path.

### Admin moderation and content API (`72beac6`) · 2026-05-24 00:34 (+0200)

- **Auth** — `requireAdminAuth` reads `Authorization: Bearer <ADMIN_API_KEY>`; returns `503 ADMIN_NOT_CONFIGURED` when env key is missing.
- **Players** — `GET /admin/players`, `/players/online`, `/dashboard`, `/activity`; moderation posts clear sessions before persisting ban/timeout flags on `player.moderation`.
- **Content** — list + upsert endpoints for encounters, solutions, expansions, portraits, frames (backed by Postgres document store + `gameData` loaders).
- **Errors** — centralized `sendErrorResponse` / `errorResponse.test.ts`; production hides stack traces and unexpected 4xx/5xx bodies.

### PWA install shell (`72beac6`) · 2026-05-24 00:34 (+0200)

- **Manifest** — `client/public/manifest.webmanifest` with standalone display, portrait lock, theme/background `#090b12`, 512×512 icon.
- **HTML** — `<link rel="manifest">` in `client/index.html`.
- **Fullscreen** — `useMobileFullscreen` treats `display-mode: standalone` / `fullscreen` and iOS `navigator.standalone` as already installed (skips redundant viewport hacks).

### Live session presence (`aa778fa`) · 2026-05-24 01:11 (+0200)

- **Store** — `deleteAllSessionsForPlayer`, `listPlayerIdsWithLiveSessions` in `postgresDocumentStore.ts`.
- **Friends** — `isPlayerOnline` checks session set + not banned/timed out.
- **Admin** — player DTO `status: online` only when a live session exists and moderation allows play.
- **Auth** — bootstrap and access-token refresh revoke all sessions when `assertPlayerCanPlay` fails (ban/timeout mid-session).

### PM2 production fixes (`942be4b`, `70a7d70`, `7905205`, `2fcfd6c`, `3f1aaa4`) · 2026-05-24 01:50–23:30 (+0200)

- **Problem** — after admin API landed, wrong import paths crashed the API on boot; PM2 could not find `tsx` or `.env` when `cwd` was `server/`.
- **Imports** — `adminController.ts` pulls `gameData` and `adminPlayerService` from `services/`; `friendService` passes live session ids when building a friend row after add.
- **ecosystem.config.cjs** — `script` → absolute `node_modules/.bin/tsx`; `args` → `src/server.ts`; `interpreter: 'none'`; **`loadEnvFile()`** parses repo-root `.env` into `env` (since `3f1aaa4`; PM2 ignores `env_file`).
- **Dependencies** — `tsx` moved to production dependency in `server/package.json` so `npm install --omit=dev` on the VPS still starts the API.
- **Deploy** — `pm2 start ecosystem.config.cjs --update-env` or `pm2 restart morkahja-api --update-env`; smoke `curl http://127.0.0.1:3000/health` (logs should show Postgres `port=5432`, not `4242`).

### Dice and solution reveal UX (`e5b5e86`, `8d032dd`) · 2026-05-24 02:13–03:51 (+0200)

- **SolutionBlock** — solution slots A/B reveal from left/right with slight rotation; C/D from bottom; shared cubic-bezier fade (`ENCOUNTER_ACTIONS_FADE_DURATION_MS` from `fade.ts`).
- **Dice** — center slot scales in; tap triggers `morkahja-dice-roll` (720° rotation + vertical bounce over **1350ms**); `sfx_dice_press` on roll; roll value revealed after animation via `onActionReveal`.
- **Tooltips** — dice button gets hover tooltip like solution slots; rattle animation still fires when actions become interactive.
- **Timing** — solution roll reveal delay **1800ms**; existing enable-rattle window unchanged.

### Avatar creation cursor tooltips (`22fe987`, `11f84af`) · 2026-05-24 03:02–04:22 (+0200)

- **Desktop** — race/role picker tooltips follow pointer via `onPointerMove` on option buttons.
- **Mobile portrait** — `useLayoutMode()` skips cursor tracking; tooltips use tap-to-show only (no follow-the-finger jitter).

### Encounter images and Scribes Atranor copy (`11f84af`) · 2026-05-24 04:22 (+0200)

- **encountersdata.json** — image keys renamed to match shipped art: `rare_treasurechest`, `liani_shadowwolf`, `ferocious_silvermane`, `disheartened_rokur`; Atranor / level-up entries kept at ids **1** / **2**.
- **Assets** — added matching `.webp` files under `client/public/game/encounterimages/`.
- **Scribes copy** — `avatar_died` message for Atranor reads “entered Atranor. The gods decide their fate” (since `52c792d`; was “entered Atranor with an Atranor item as symbol” in `11f84af`).
- **Scribes icons** — `gameEventService.withAtranorDeathSymbol` attaches `symbolIconName` from solution **10015**; `resolveScribesIconUrl` prefers payload icon, falls back to Atranor encounter id/title, else death overlay; `encounter_failed` uses `/UI/06_SettingsMenu/No.webp`.
- **Tests** — `achievementScribes.test.ts` covers Atranor death and encounter-failed presentation.

### Player profile and wall of fame (`417e49e`, `32bf3e7`) · 2026-05-24 20:18–23:18 (+0200)

- **API** — `GET /player/profile` → `PlayerProfileResponse` (shared contracts); `playerProfileController` + `playerProfileService.ts`.
- **Wall of fame** — `player.wallOfFame[]` on player document; `recordWallOfFameEntry` called from `gameEventService` on `avatar_died` with progression snapshot (encounters completed, level, portrait, frame).
- **UI** — `PlayerProfileOverlay` on dashboard **Profile** nav (`im_button_credits_b`); shows join date, current avatar slots (max 3), fallen-avatar cards with died date and encounter count.
- **Titles** (since `32bf3e7`) — `unlockedTitles` from achievement ranks; per-avatar title select; `PATCH /avatar/:avatarId/display-title`; formatted names across avatar UI.
- **About Us** — removed from dashboard radial; **Settings** footer button opens `AboutUsOverlay` (credits + Donation entry unchanged).

### Game and inventory tooltips (`3501dde`, `37ca8de`, `b55e261`, `ef63f2a`, `c81db96`) · 2026-05-24 19:06–21:06 (+0200)

- **`useTooltipReveal`** — touch devices use tap to show/hide; desktop keeps hover + optional cursor follow; descriptions restored for solution items.
- **`SolutionGridOverlay`** — inventory/skillbook grids use separate tooltip anchors; overlay layers fixed so clicks reach grid cells under the dimmer.
- **`SolutionBlock`** — edge-anchored tooltips per slot letter; shares fade timing with encounter actions.
- **In-game chrome** — `.morkahja-game-interactive-button` press/hover parity with dashboard nav buttons on avatar slots and solution/dice controls.

### Donations PayPal link (`53b274b`) · 2026-05-24 20:51 (+0200)

- **`DonationOverlay`** — `DirectDeveloperDonateSection` below gem presets; external PayPal link with tooltip explaining server/dev use.
- **In-game gems** — `POST` donate presets (10 / 50 / 100 / all) unchanged; contributor achievement still driven by `gems_donated` events.

### Encounter pool and art rename (`1bf097a`, `8e3e093`) · 2026-05-24 05:45–21:01 (+0200)

- **Pool** — `buildRandomPool` / `selectRandomPreparedEncounter` include id **20001** (Lovely Meadows); system ids **1** / **2** / death encounter still excluded via `isSystemEncounterId`.
- **Keys** — legacy `combat_*` / `fight_*` filenames replaced with shorter keys (`nagar_boar`, `blackwood_guardian`, `wild_bloodfang`, etc.) across client + server `encountersdata.json`.

### Loading screen API errors (`44498fb`) · 2026-05-24 05:32 (+0200)

- **Problem** — API down or nginx 502 returned HTML; loading UI showed unreadable markup.
- **Fix** — client parses JSON error bodies when `Content-Type` allows; falls back to status text for display on welcome/loading paths.

### Social preview image (`c63d8f7`) · 2026-05-24 05:35 (+0200)

- **`socialPreview.ts`** — `SOCIAL_IMAGE_PATH` → `/posterRaceSkills2.png` with native dimensions **2133×2846** for richer Telegram/link cards.

### Overlay panel buttons (`32bf3e7`) · 2026-05-24 23:18 (+0200)

- **`PanelButton.tsx`** — reusable overlay `<button>` with per-control `pressKey` and `visualStyle` on an inner span (same pattern as nav radial buttons).
- **`ClosePanelButton.tsx`** — shared Close control with SFX + default visual style.
- **CSS** — `.morkahja-panel-button` / `-visual` hover scale + gold glow in `index.css`.
- **Adoption** — Settings, About Us, Donation, achievements, friends, expansions, Scribes, solution grid overlays.

### Inventory API persistence (`c958fe2`) · 2026-05-24 22:45 (+0200)

- **Problem** — inventory/skillbook grids opened empty after encounter continues because avatar responses omitted `inventory`.
- **Server** — `toPersistedAvatarDto` in `avatarPresentation.ts`; `/avatars` maps through DTO; `/avatar` loads from inventories table when doc field is missing; create/select return DTO shape.
- **Client** — `GameEnvironment` merges `result.avatar.inventory ?? avatar.inventory` on continue so local state does not reset.

### Scribes Atranor copy refresh (`52c792d`) · 2026-05-24 21:48 (+0200)

- **`renderEventMessage.ts`** — `avatar_died` for Atranor: “entered Atranor. The gods decide their fate”.
- **Tests** — `achievementScribes.test.ts` expectation updated to match.

### Profile titles (`32bf3e7`) · 2026-05-24 23:18 (+0200)

- **Domain** — `achievementTitles.ts`: `collectUnlockedTitlesFromAchievements`, `formatAvatarDisplayName`, validation in `setAvatarDisplayTitle`.
- **API** — profile response adds `unlockedTitles[]`; avatars include `displayTitle`; `PATCH /avatar/:avatarId/display-title` with `INVALID_DISPLAY_TITLE` when title not unlocked.
- **UI** — `PlayerProfileOverlay` title dropdown per current avatar; `avatarDisplayName.ts` on dashboard avatar cards and selection panel.

### Seal of Norghor subscription (`32bf3e7`) · 2026-05-24 23:18 (+0200)

- **Cost / duration** — **67** yellow red gems for **28** days (`sealOfNorghor.ts` constants).
- **Storage** — `player.sealOfNorghor.expiresAt` on player document.
- **API** — `GET /player/seal-of-norghor`; `POST /player/seal-of-norghor/activate` debits gems and sets expiry; errors `SEAL_ALREADY_ACTIVE`, `INSUFFICIENT_GEMS`.
- **Expansions** — `mergeUnlockedExpansionsWithSeal` appends all active expansion ids while seal is valid (effective unlocks on `GET /player` without overwriting purchased list).
- **UI** — `SealOfNorghorSection.tsx` in Settings: seal art, lore intro, status line, gem balance, activate button.

### Settings panel UX (`32bf3e7`) · 2026-05-24 23:18 (+0200)

- **Layout** — three-row panel (header / scroll body / footer); player name inline with SETTINGS title.
- **Scroll hint** — `ResizeObserver` + gradient overlay with bouncing chevron when body has hidden content.
- **Recovery key** — download row using `sessionKeys.downloadRecoveryKey`; inline messages when key missing on device.
- **About Us** — footer `PanelButton` opens existing credits overlay.

### Encounter art keys (`c2e1533`) · 2026-05-24 23:25 (+0200)

- **Renames** — `help_heal_drained_aevis` → `drained_aevis`; `chest_common` → `common_chest`; `combat_animal_ember` → `embersnout`; `20111_redeye` → `young_redeye`; `20190_eye` → `veilwalker`.
- **Content** — Embersnout encounter text shortened; encounter **20098** reward amount **2**.

### PM2 `.env` loading (`3f1aaa4`) · 2026-05-24 23:30 (+0200)

- **`loadEnvFile`** — reads `DATABASE_URL`, `CLIENT_ORIGINS`, `PORT`, `ADMIN_API_KEY`, etc. from repo-root `.env` at PM2 start.
- **VPS** — no `Key.js`; if `.env` is missing, warn at PM2 boot and API may fall back to dev default port **4242**.

### Daily reward all chains (`0410092`) · 2026-05-25 19:03 (+0200)

- **`dailyRewardService`** — daily gem payout sums eligible ranks across achievement chains (not Adventurer-only); persistence + tests updated.
- **UI** — `AchievementPanel` reflects expanded daily reward rules.

### Scribes achievement toast (`5f354b7`) · 2026-05-25 18:16 (+0200)

- **Toast** — achievement unlock notifications with animation in game environment and dashboard shell.

### Solution tooltips on touch (`df6bfbc`) · 2026-05-25 17:46 (+0200)

- **Fix** — tooltips on touch no longer swallow taps needed to use solutions.

### Public beta version **0.9.0-beta.1** · 2026-05-26 (+0200)

- **Versioning** — project tagged as **beta** before stable **1.0.0**; `package.json` workspaces set to `0.9.0-beta.1` (replaces placeholder `0.0.0`).
- **Prior tags** — `v0.1` (playable), `v0.12` (music engine); live production on **https://arcanitebrothers.com** is ahead of those tags.
- **Git tag** (when ready): `git tag -a v0.9.0-beta.1 -m "Public beta"`.
- **Next** — `0.9.0-beta.2` for beta deploys with notable fixes; **1.0.0** when leaving beta.
