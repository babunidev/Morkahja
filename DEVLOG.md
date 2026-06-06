# Morkahja devlog

Brief chronological overview of the web app from first commit to present. Newest work is at the bottom.

| | |
|---|---|
| **Started** | 2026-05-16 22:21 (+0200) |
| **Last updated** | 2026-06-07 (+0200) |
| **Release** | **0.9.0-beta.2.1** (public beta, pre-1.0) |

Each entry is numbered chronologically. Dates and times are from git (`+0200`, Europe/Berlin) or the commit referenced in the entry.

---

## Development log

1. **2026-05-16 22:21 (+0200)** — Add **LudusOccursus** / **LudusSolutio** structure for encounters and solutions.
2. **2026-05-16 22:26 (+0200)** — Rename datafiles; remove superseded JSON (`LudusOccursus`, `LudusSolutio`, `MorkahjaRules`).
3. **2026-05-17 12:26 (+0200)** — **Initial commit** — encounter images and core game data assets land in the repo.
4. **2026-05-17 12:33 (+0200)** — Sync with remote; delete obsolete top-level `Game/` directory.
5. **2026-05-17 13:37 (+0200)** — Fix **TypeScript module resolution** for the client/server/shared workspace.
6. **2026-05-18 15:14 (+0200)** — First **playable checkpoint**: Vite + React client, Express API, shared contracts.
7. **2026-05-18 15:14 (+0200)** — Sign-in / session flow, dashboard shell, avatar selection, encounter loop.
8. **2026-05-18 15:14 (+0200)** — Static game data (encounters, solutions, portraits, frames), PostgreSQL document store.
9. **2026-05-18 15:14 (+0200)** — UI asset tree (backgrounds, buttons, encounter art, welcome flow).
10. **2026-05-19 04:37 (+0200)** — **v0.12 music engine** — playlist wiring and playback controls for dashboard and in-game ambience.
11. **2026-05-20 04:54 (+0200)** — **Atranor death** survival rules; music volume in settings; related gameplay UI fixes.
12. **2026-05-20 04:54 (+0200)** — **Game event pipeline** — persisted events in PostgreSQL, bus + renderer foundation.
13. **2026-05-20 04:54 (+0200)** — **Level-up encounters** — outcome-based race/role abilities without hardship penalties; `rewardIds` precomputed for result preview.
14. **2026-05-20 04:54 (+0200)** — **SCRIBES** activity feed overlay on the dashboard; unread-style world log.
15. **2026-05-20 04:54 (+0200)** — Fix **duplicate solution IDs** (10065–10068) so warrior reward pool entries are unique.
16. **2026-05-21 02:01 (+0200)** — Fix high-impact **solution name/description typos**; sync client `solutiondata.json` mirrors (`3b9ab56`, `f0e6030`).
17. **2026-05-21 02:40 (+0200)** — Remove obsolete game ambient tracks; reclassify solution **10185** as PurgeSkill (`32d22af`, `f0b141d`).
18. **2026-05-21 03:19 (+0200)** — **Expand music playlists** for dashboard and in-game (`eaa2aa1`).
19. **2026-05-21 03:51 (+0200)** — Dashboard **overlays** — Scribes unread indicator, achievements entry point, ambient wiring (`6e4dc8e`).
20. **2026-05-21 04:10 (+0200)** — Remove legacy avatar portrait assets; **inventory bootstrap** on new avatars (`d284bbe`).
21. **2026-05-21 05:44 (+0200)** — **Lore gem** click fix (`inert` hidden result layer); scrollable Scribes feed.
22. **2026-05-21 05:44 (+0200)** — **Result screen** — reward icons fly to footer targets on Continue; losses fly from portrait into outcome slots; dice art beside outcome text.
23. **2026-05-21 05:44 (+0200)** — **Reveal pacing** — slower encounter crossfade (720ms); solution/dice fade-in (1100ms); spacer bar stays visible.
24. **2026-05-21 05:44 (+0200)** — All **four solution slots** shown (missing items dimmed + tooltip).
25. **2026-05-21 14:15 (+0200)** — Healing Elixir image renamed to match potion icon (`43c08a6`).
26. **2026-05-21 14:18 (+0200)** — Smoother **continue transition**; fix reward icon flicker when result layer hides (`686c16c`).
27. **2026-05-21 15:33 (+0200)** — **Daily reward** — **21** encounters per **UTC day**; gem payout scales with rank (1–5); `daily_reward_claimed` events; deduped claims.
28. **2026-05-21 15:33 (+0200)** — **Nav attention UX** — closed menu dots at **13:00** (Scribes) and **17:00** (Achievements); open menu wiggle + **independent glow rhythms**; `achievementsAttentionState` in localStorage.
29. **2026-05-21 15:33 (+0200)** — **`AchievementPanel` / overlay** — rank overlays, progress bar, `N/N encounters` daily line, footer gem count.
30. **2026-05-21 15:33 (+0200)** — **`achievement_unlocked`** events → Scribes (“became a Wayfarer”, etc.).
31. **2026-05-21 15:33 (+0200)** — **`gems_received`** recorded inside `addPlayerYellowRedGems` so Scribes always sees gem grants.
32. **2026-05-21 15:33 (+0200)** — First real **achievement chain** (Adventurer → Trailblazer): event-driven progress on `encounter_resolved` / `encounter_failed`, rank thresholds **100 / 200 / 400 / 800** encounters (max rank 4), `player_achievements` table.
33. **2026-05-21 15:33 (+0200)** — `npm run test:achievements` for rank/daily-reward math.
34. **2026-05-22 02:37 (+0200)** — **Alpha Player** achievement — progress on `level_up` + `avatar_died`; global **100** Legendborn (rank 4) cap; `globallyLocked` + chain title in UI; daily reward threshold raised to **42** encounters; removed unused root `achievements.json`.
35. **2026-05-22 02:37 (+0200)** — **Avatar death UX** — `AvatarDeathOverlay`; dead IDs in `localStorage`; `purgeDeadAvatarsOnServer` returns `{ purgedIds, failedIds }`; Home awaits purge + refetch before recreate preset; Play gated on `prepareAvatarSelection()` (loading + inline spinner).
36. **2026-05-22 02:37 (+0200)** — **Dashboard** — `AboutUsOverlay`; `avatarSelectionPrepare.ts` helpers; enlarged achievement rank overlays past icon frame.
37. **2026-05-22 02:37 (+0200)** — **Encounter art** — refreshed `death_atranor`, Tempest fight, and Verdani heal `.webp` assets.
38. **2026-05-22 02:37 (+0200)** — **Server-authoritative Atranor death** — removed client `isFatalAtranorRoll` shortcut; all Misery/Hardship on encounter **1** go through `POST /encounter/continue`; `avatarDied` / `deathTriggered` on response; max **3** avatars per player (`AvatarLimitReachedError`).
39. **2026-05-22 02:37 (+0200)** — **Shared dice** — `interpretRoll` / `isRollFavorable` in `@morkahja/shared`; server re-exports; client imports via `@shared` Vite alias; `npm run test:dice` parity test.
40. **2026-05-22 02:37 (+0200)** — **Solution affordance** — dimmer disabled slots; rattle animation when dice/solutions unlock; slightly wider hub footer buttons.
41. **2026-05-22 04:42 (+0200)** — **About Us** — credits accordion; **Donation** opens gem donate overlay via Close-style text button (replaces donate image asset).
42. **2026-05-22 04:42 (+0200)** — **Achievement chains** — Firestarter, Contributor (gems donated), Blessed (Fortune/Prosperity), Combatant / Trickster / Helper (encounter-type solves); hide chains with zero progress unless rank > 0.
43. **2026-05-22 04:42 (+0200)** — **Asset hygiene** — prune duplicate `10_Shop` portrait tree and archived UI; move settings `PORTRAITS.webp`; add dashboard expansion header/unlock `.webp` set.
44. **2026-05-22 04:42 (+0200)** — **Daily reward** — base **1** gem plus sum of achievement ranks across all chains (`dailyRewardService`).
45. **2026-05-22 04:42 (+0200)** — **Donations** — gem donate flow from About Us; contributor achievement progress on `gems_donated`.
46. **2026-05-22 04:42 (+0200)** — **Encounter art** — refreshed `combat_nagar_berserk.webp`.
47. **2026-05-22 04:42 (+0200)** — **Expansion catalog** — `expansiondata.json` on client and server; `GET /player` exposes `unlockedExpansions`; encounters gate on expansion id (`includes`, not cumulative level).
48. **2026-05-22 04:42 (+0200)** — **Expansions overlay** — dashboard nav at **19:00** (`im_button_expansions`); expandable cards (header art from `UI/03_DASHBOARD/expansions/`); **`POST /player/expansions/unlock`** spends gems and appends expansion id to the player profile.
49. **2026-05-22 04:42 (+0200)** — **Friends list** — Social nav opens overlay; add by player name; shows last-played avatar, online status, and read-only achievements on tap.
50. **2026-05-22 04:42 (+0200)** — **Nav UX** — radial menu tooltips (e.g. News → “Scribes”) and subtle hover scale/glow on open-menu buttons.
51. **2026-05-22 04:42 (+0200)** — **Scribes polish** — Prosperity lines show reward names/icons; activity feed window **1 hour** (was 15 min).
52. **2026-05-22 04:42 (+0200)** — **Scribes** — `avatar_created` entries show portrait + frame in the feed (`avatarPortrait` / `avatarFrame` on event payload).
53. **2026-05-22 04:42 (+0200)** — **Settings** — player name beside SETTINGS title.
54. **2026-05-22 07:06 (+0200)** — **Layout tweak** — solution block lowered **3px** (`translateY`) for seam alignment (`dc18f7b`).
55. **2026-05-22 08:12 (+0200)** — **Friends polish** (`135779f`) — friend detail lists all avatars (last-played highlighted); read-only achievement snapshot; strip self from stored `friendIds`; defensive API parsing.
56. **2026-05-23 12:50 (+0200)** — **Deploy** — `ecosystem.config.cjs` (PM2); configurable `PORT` and `corsOrigins`; welcome/error/no-connection WebP assets.
57. **2026-05-23 12:50 (+0200)** — **Encounter persistence** refactor (`encounterPersistence.ts`, state machine/controller wiring); refreshed encounter art (Grimnir heal, Lianiguard, razorback, hidden market).
58. **2026-05-23 12:50 (+0200)** — **Friends hardening** — `findPlayerByNameOrId` prefers `playerName` over legacy stub ids; `resolveCanonicalFriendId` rewrites stored friend ids; client null-safe friend profile (`avatars` / `achievements`); result-screen reward tooltips with `mSolutionText`.
59. **2026-05-23 12:50 (+0200)** — **The Guardian** encounter lore updated to describe a wolf (`b6a7500`).
60. **2026-05-23 12:50 (+0200)** — **Welcome loading** — seasonal logos (`logo_winter.webp` spring/winter, `logo_summer.webp` summer/autumn); larger logo; fade/slide enter; gentle sway while loading (spinner removed); `resolveLoadingLogoPath()` in `backgroundResolver.ts`.
61. **2026-05-23 17:29 (+0200)** — **Seal of Norghor** — dashboard subscription UI assets (`b74c43e`).
62. **2026-05-23 18:56 (+0200)** — **Deploy wiring** (since `ef92dd4`) — `ecosystem.config.cjs` (PM2 from repo root, `cwd: server`, `tsx` on `src/server.ts`); `PORT` + `CLIENT_ORIGINS` via `server/src/config/corsOrigins.ts`; client `API_BASE_URL` defaults to **same-origin** (`VITE_API_BASE_URL` optional) so production does not call `localhost:3000`.
63. **2026-05-23 20:23 (+0200)** — **Audio** — default **30%** music/SFX for new accounts; `readStoredVolume` treats null/empty `localStorage` as default (not 0%); `seedDefaultAudioVolumesIfUnset()` on app mount and onboarding.
64. **2026-05-23 20:23 (+0200)** — **Dashboard/game UI** — nav-style hover on Play and avatar slots (`useTooltipReveal`); solution-slot reward tooltips; `useMobileFullscreen` + viewport helpers in `index.html`.
65. **2026-05-23 20:23 (+0200)** — **Scribes** — `authorName` on activity feed entries (`gameEventService`, shared `ActivityFeedEntryDto`); overlay meta row (author left, time ago + “New” right).
66. **2026-05-23 20:32 (+0200)** — **Browser tab** — title **Morkahja**; favicon and `apple-touch-icon` use `iconforplaystoreFG.png` (removed default Vite `favicon.svg`).
67. **2026-05-23 20:32 (+0200)** — **Image protection** — `protectedImage.ts` + `useProtectedImages()`; block drag and casual selection on backgrounds, encounter art, and hub/footer surfaces; form fields stay selectable.
68. **2026-05-23 20:32 (+0200)** — **Link previews** — Open Graph and Twitter Card meta tags injected at production build (`socialPreview.ts`, Vite `transformIndexHtml` plugin); `og:image` points at the app icon on the public origin; default site URL `https://arcanitebrothers.com`, override with `VITE_SITE_URL` at build time (Telegram and other sharers read static HTML only).
69. **2026-05-23 21:50 (+0200)** — **First public alpha host** — Hetzner VPS; game served at **https://arcanitebrothers.com** (and `www`); DNS A record → server IP.
70. **2026-05-23 21:50 (+0200)** — **HTTPS** — Let’s Encrypt via `certbot --nginx`; required for Web Crypto (`crypto.subtle`) so **Create journey** / recovery keys work in the browser (plain `http://` on a public IP is not a secure context).
71. **2026-05-23 21:50 (+0200)** — **Ops lessons** — `.env` only on server (never git): one `KEY=value` per line; URL-encode `+` / `*` in `DATABASE_URL`; **`Key.js` is dev-only** (never on VPS); without `DATABASE_URL` the server falls back to `localhost:4242` in `postgresDocumentStore.ts`; Postgres 15+ needs `GRANT` on `public` for app user; nginx `root` line must be exactly `root /var/www/morkahja;`.
72. **2026-05-23 21:50 (+0200)** — **Pre-invite security review** — OK for small trusted alpha on HTTPS; before wide launch: rate-limit `/session/bootstrap`, cap JSON body size, Postgres backups, firewall (only 22/80/443).
73. **2026-05-23 21:50 (+0200)** — **Production deploy** — Hetzner VPS at ~/arcanitebrothers; nginx serves /var/www/morkahja; API proxied to PM2 on port 3000; standard deploy: git pull, npm install --include=dev, npm run build --prefix client, rsync dist, pm2 restart ecosystem.config.cjs --update-env.
74. **2026-05-23 21:50 (+0200)** — **Stack on server** — Ubuntu; **nginx** serves `client/dist` from `/var/www/morkahja` (rsync after each `npm run build`); API paths proxied to **PM2** → Node on `127.0.0.1:3000`; **PostgreSQL** on localhost (`morkahjadbadmin` + `morkahja` DB).
75. **2026-05-23 21:50 (+0200)** — **Workflow** — develop on PC → `git push origin main` → on VPS `git pull origin main`, `npm install --include=dev`, `npm run build --prefix client`, `sudo rsync -a --delete client/dist/ /var/www/morkahja/`, `pm2 restart morkahja-api --update-env` (see **Production deploy** session note).
76. **2026-05-23 21:51 (+0200)** — **Image protection (extended)** (`bb226dd`) — `protectedOverlaySurfaceProps`, `protectedOverlayTextStyle`, `preventImageContextMenu`; Lore / Result / PlayerHub / SolutionBlock / dashboard overlays / Settings marked; document-level `selectstart` guard (inputs still selectable); blocks “Open image in new tab” on CSS backgrounds via computed `background-image` check.
77. **2026-05-23 22:02 (+0200)** — **Lore gem exploit fix** (`18d0d1b`) — Removed `POST /player/currency/yellow_red_gem`. Lore gems are server-authoritative: `POST /encounter/lore-gem/offer` rolls eligibility + delay on the active encounter snapshot; `POST /encounter/lore-gem/claim` requires matching `encounterKey`, active encounter, offer timing, and one claim per snapshot via `loreGemClaims`. `addPlayerYellowRedGems` now requires a claim key when granting.
78. **2026-05-23 23:50 (+0200)** — **API startup fix** (`942be4b`) — `adminController` import paths corrected (`gameData` / `adminPlayerService` live under `services/`); friend summary after add passes live session ids.
79. **2026-05-23 23:55 (+0200)** — **PM2 production wiring** (`70a7d70`, `7905205`, `2fcfd6c`, `3f1aaa4`) — `ecosystem.config.cjs` loads repo-root `.env` into PM2 `env`; absolute `tsx` path; `tsx` as server production dependency; PM2 runs `tsx src/server.ts` with `interpreter: 'none'`.
80. **2026-05-24 00:13 (+0200)** — **Dice and solution reveal** (`e5b5e86`, `8d032dd`) — directional fade-in for solution slots (A/B from sides, C/D from bottom); dice scale-in + 720° bounce roll on tap; dice tooltip; `morkahja-dice-roll` keyframes.
81. **2026-05-24 00:34 (+0200)** — **Admin content API** — read/write hooks for encounters, solutions, expansions, portraits, and frames (`adminController`, `gameData` helpers); intended for ops tooling, not exposed to game clients.
82. **2026-05-24 00:34 (+0200)** — **Admin moderation API** — `ADMIN_API_KEY` Bearer auth on `/admin/*`; player list with status (online / offline / timed_out / banned), dashboard summary, recent activity feed, online-only list; `POST /admin/players/timeout`, `/ban`, `/unban` with session disconnect.
83. **2026-05-24 00:34 (+0200)** — **Encounter art** — refreshed dice button (`im_button_dice_a.webp`), downed Aevis heal, Frostwind junk trade encounter; added `posterRaceSkills2.png` promo asset.
84. **2026-05-24 00:34 (+0200)** — **PWA install shell** — `manifest.webmanifest` (`display: standalone`, portrait, app icon); linked from `index.html`; `useMobileFullscreen` respects installed standalone / fullscreen display modes.
85. **2026-05-24 00:34 (+0200)** — **Production error responses** (`72beac6`) — `server/src/http/errorResponse.ts`: in `NODE_ENV=production`, 5xx and unexpected 4xx return generic messages; intentional API errors (`SessionError`, `LoreGemError`, encounter conflicts, etc.) still expose safe messages; full details logged server-side.
86. **2026-05-24 00:34 (+0200)** — **Session revocation on moderation** — `deleteAllSessionsForPlayer` clears all session rows; ban/timeout and blocked bootstrap/auth paths wipe sessions and null `activeSessionId` on the player profile.
87. **2026-05-24 01:02 (+0200)** — **Avatar creation tooltips** (`22fe987`, `11f84af`) — race/role option tooltips follow cursor on desktop; skipped on mobile portrait (`useLayoutMode`).
88. **2026-05-24 01:11 (+0200)** — **Live online presence** (`aa778fa`) — `listPlayerIdsWithLiveSessions()` queries non-expired session rows; friends list and admin player status use live sessions (not stale `activeSessionExpiresAt` on the player doc); banned/timed-out players never show online.
89. **2026-05-24 04:22 (+0200)** — **Encounter image keys** (`11f84af`) — `mEncounterImageName` aligned with new `.webp` assets (rare treasure chest, Liani shadowwolf, ferocious silvermane, disheartened rokur).
90. **2026-05-24 04:22 (+0200)** — **Scribes Atranor death feed** (`11f84af`, `52c792d`) — death copy “entered Atranor. The gods decide their fate”; icon from solution **10015**; `encounter_failed` uses fail icon (`No.webp`).
91. **2026-05-24 05:45 (+0200)** — **Database** — `loadDatabaseConfig.ts` for clearer Postgres URL/env handling; small `postgresDocumentStore` tweak.
92. **2026-05-24 05:45 (+0200)** — **Encounter assets** — Grimnir heal, blightwraith huntress/occultist, crumblegheist barbarian, nagar humpback; refreshed dice button WebPs (`im_button_dice_a` / `_b`); `encountersdata.json` image keys synced.
93. **2026-05-24 05:49 (+0200)** — **Link previews** — Open Graph / Twitter `og:image` uses `posterRaceSkills2.png` (race-skills promo) instead of the square app icon.
94. **2026-05-24 05:49 (+0200)** — **Welcome / loading** — bootstrap and health failures show short API messages instead of raw nginx HTML bodies on the loading screen.
95. **2026-05-24 05:58 (+0200)** — Restore missing **crumblegheist_barbarian** portrait asset (`e5079c3`).
96. **2026-05-24 19:06 (+0200)** — **Game tooltips** — touch tap-to-toggle; solution descriptions restored on hover/tap (`3501dde`).
97. **2026-05-24 19:06 (+0200)** — **Wall of fame** — on `avatar_died`, `recordWallOfFameEntry` stores portrait, frame, level, encounters played, and `diedAt` (max **48** entries, newest first) on the player doc.
98. **2026-05-24 19:15 (+0200)** — **Inventory and skillbook** — item tooltips on hover and click; grid overlay hit targets fixed (`37ca8de`).
99. **2026-05-24 20:03 (+0200)** — **In-game hover** — nav-style press pulse and hover glow on avatar slots, solution actions, and related game chrome; inventory overlay `pointer-events` so tooltips receive clicks (`b55e261`).
100. **2026-05-24 20:18 (+0200)** — **Player profile** — `GET /player/profile`; **Profile** on dashboard radial (credits button, “Profile” tooltip) opens `PlayerProfileOverlay` (join date, up to three avatars, scrollable **wall of fame**); **About Us** moved to Settings footer (`417e49e`).
101. **2026-05-24 20:24 (+0200)** — **Solution tooltips** — anchored beside slot edges (A left, B right, C/D above); refreshed flytrap grotto, thunderfly, thunderhoof encounter art (`ef63f2a`).
102. **2026-05-24 20:51 (+0200)** — **Donations** — **Donate directly to Babunigaming** opens PayPal (`paypal.me/babunigaming`) with maintenance/dev tooltip; gem copy uses “treasury” (`53b274b`).
103. **2026-05-24 21:01 (+0200)** — **Encounter pool** — random selection uses `mEncounterID >= 20001` so **Lovely Meadows** (**20001**) can appear; bulk encounter image key renames and replacement `.webp` set (`1bf097a`).
104. **2026-05-24 21:06 (+0200)** — **Production build** — `SolutionGridOverlay` tooltip handler props typed for strict TS (`c81db96`).
105. **2026-05-24 21:48 (+0200)** — **Scribes** — Atranor death line now reads “entered Atranor. The gods decide their fate” (supersedes earlier “Atranor item as symbol” wording).
106. **2026-05-24 22:45 (+0200)** — **API / client** — `GET /avatar` falls back to `loadInventory` when the avatar doc lacks inventory; `GameEnvironment` keeps inventory across encounter continues so skillbook/inventory overlays stay populated.
107. **2026-05-24 22:45 (+0200)** — **`avatarPresentation.ts`** — `toPersistedAvatarDto` carries `displayTitle` and `inventory` when present; list/create/select avatar endpoints return normalized DTOs.
108. **2026-05-24 23:18 (+0200)** — **Achievement titles** — unlocked rank titles from achievement chains exposed on profile; per-avatar `displayTitle` stored on avatar profile; `PATCH /avatar/:avatarId/display-title`; title `<select>` on each live avatar in **Player profile**; UI shows “Title Name” via `formatAvatarDisplayName`.
109. **2026-05-24 23:18 (+0200)** — **Seal of Norghor** — gem subscription (**67** yellow red gems / **28** days); Settings + API (`32bf3e7`); **removed** from beta (`d26f799`).
110. **2026-05-24 23:18 (+0200)** — **Settings refresh** — scrollable panel (header / body / footer); bottom gradient **scroll hint** when content overflows; **Recovery key** download row; player name beside SETTINGS title; About Us remains in footer.
111. **2026-05-24 23:18 (+0200)** — **`GET /player`** — included `sealOfNorghor` status DTO (`32bf3e7`; field removed `d26f799`).
112. **2026-05-24 23:18 (+0200)** — **`PanelButton` / `ClosePanelButton`** — shared overlay press/hover (nav-style pulse + gold glow); adopted on Settings, About Us, Donation, achievements, friends, expansions, Scribes, and solution grid overlays.
113. **2026-05-24 23:25 (+0200)** — Rename/sync encounter images: `drained_aevis`, `common_chest`, `embersnout`, `young_redeye`, `veilwalker`; Embersnout lore trim; common chest reward amount **2** (was **1**); DEVLOG through profile/seal/tooltip work.
114. **2026-05-24 23:30 (+0200)** — **Repo `main`** — GitHub `main` restored to app-at-root layout (solo dev); VPS deploy is `git pull origin main` on `~/arcanitebrothers`, not submodule SHAs or extra branches.
115. **2026-05-24 23:30 (+0200)** — **`ecosystem.config.cjs`** — parses repo-root `.env` into PM2 `env` (replaces non-functional `env_file`); `DATABASE_URL` and `CLIENT_ORIGINS` reach the API without `set -a; source .env` on restart.
116. **2026-05-25 00:18 (+0200)** — **Admin content** — batch encounter data + `.webp` art via admin API (Lovely Meadows, Liani line, Gobbl, treasure, Ashen Revenant, Echowraith, Auraglow Mireling, Tempest Fury, etc.).
117. **2026-05-25 00:18 (+0200)** — **Inventory UI** — essence slot label renamed from prior wording to **Essence** (`244a33e`).
118. **2026-05-25 17:46 (+0200)** — **Solution tooltips (touch)** — tap-to-use no longer blocked by tooltip handlers (`df6bfbc`).
119. **2026-05-25 18:16 (+0200)** — **Scribes achievement toast** — animated achievement notices in game and on dashboard (`5f354b7`).
120. **2026-05-25 19:03 (+0200)** — **Daily reward** — payouts extended across **all** achievement chains; `dailyRewardService` + tests; `AchievementPanel` shows chain-aware daily copy (`0410092`).
121. **2026-05-26 16:25 (+0200)** — **Result tooltips** — hide solution tooltips while the result layer covers the solution block (`c21ee58`).
122. **2026-05-26 17:31 (+0200)** — **Inventory grid** — tooltips float at top of overlay; header seam stacking fix (`2bd55e9`).
123. **2026-05-26 17:45 (+0200)** — **Dice art** — multi-face dice assets; larger encounter header titles (`25eace1`).
124. **2026-05-26 18:37 (+0200)** — **Publish hardening** — secure auth bootstrap and production safeguards (`d9490b2`).
125. **2026-05-26 23:58 (+0200)** — **Admin content** — mountain/travel/Verdani/Liani line encounters and art (Cliffs of Sarga through Raided Verdani Village, Bronze Vault, Aradia's Perch, etc.).
126. **2026-05-26 23:58 (+0200)** — **Encounter rooms** — server-backed **avatar-scoped** rooms (up to **3** players); `/room/*` API (create, join, leave, choice, focus, continue, call-for-help); `roomService` + Postgres persistence; `EncounterRoomSnapshotDto` on select/create encounter.
127. **2026-05-26 23:58 (+0200)** — **Help** — call-for-help invites friends or random online players; pending help list; join-via-invite; inactivity and invite TTL constants in `roomConstants.ts`.
128. **2026-05-26 23:58 (+0200)** — **Room states** — `active_encounter` (shared encounter play) and `system_event` (level-up / Atranor **witness** flow for non-actors); party slots UI (`PartyMemberSlot`, `PartyEmptySlot`, `PlayerHub`); `GameEnvironment` syncs room snapshot on continue.
129. **2026-05-26 23:58 (+0200)** — **Tests** — `roomService.test.ts` for room lifecycle and coordination rules.
130. **2026-05-26 23:58 (+0200)** — **Version** — workspaces tagged **0.9.0-beta.1** (`package.json`); `appVersion.ts` exposes version to client (`48f4f0a`).
131. **2026-05-27 (+0200)** — **Admin content** — Crumblegheist Berserk, Tempestwailer Stormcaller, Ashen Revenant Witch/Seer encounters + art.
132. **2026-05-27 18:36 (+0200)** — **Asset hygiene** (`133f405`) — remove legacy PNG encounter art, archived avatar-creation trees, duplicate portraits, unused Scribes/Help assets; drop large `.wav` music (keep `.mp3`); `posterRaceSkills2.webp` replaces multi‑MB PNG; delete obsolete `strings.xml`.
133. **2026-05-27 21:04 (+0200)** — **Anchored tooltips** (`d26f799`) — `anchoredTooltip.ts`; inventory and skillbook tooltips anchor to the hovered cell, clamp inside the overlay, and sit above the game header (`z-index` **26**); grid buttons use `morkahja-grid-item-button` with direct mouse enter/leave so hover works under the dimmer; inventory panel renders last when multiple grids are open.
134. **2026-05-27 21:04 (+0200)** — **Result / rewards** (`d26f799`) — `ResultBlock` and `rewardFlyAnimation` rework; death overlay and game toasts refined; **Firestarter** achievement progress/events in Scribes (`firestarterAchievement`, `firestarterProgress`).
135. **2026-05-27 21:04 (+0200)** — **Seal of Norghor removed** (`d26f799`) — subscription API, `SealOfNorghorSection`, `mergeUnlockedExpansionsWithSeal`, and related player DTO fields removed (feature retired from beta).
136. **2026-05-27 21:39 (+0200)** — **Signup legal** (`f08b632`) — `PrivacyPolicyOverlay` and `TermsOfServiceOverlay` (May 2026 copy); **New journey** opens scrollable in-app modals from Privacy Policy / Terms of Service links instead of external URLs (`OnboardingGateway`).
137. **2026-05-27 21:44 (+0200)** — **Production build** (`6ea41d5`) — `SolutionGridOverlay` strict TS: capture `anchorX` before the layout `measureAndPlace` callback; `handleItemClick` typed as `GridTooltipTriggerEvent` (fixes `tsc -b` on deploy).
138. **2026-05-27 22:36 (+0200)** — **Call for help** (`c46b30d`) — Scribes feed shows `help_requested` with **Join**; friends list **Join** when a friend has a joinable solo room or pending invite; `POST /room/join/friend`; online-friend toasts in `App.tsx`; activity query includes friends’ events; `broadcastCallForHelp` invites eligible online friends with live sessions.
139. **2026-05-27 22:36 (+0200)** — **Room-authoritative continue & lore gems** — prepare/commit encounter outcomes on room tick; `ready_to_continue` / `advancing`; per-player `loreGemCollected` and grant on commit; pauseable lore-only reveal timer (`durationMs`, 14–28s); collect UX (hover, wiggle/+1, outcome-row icon); poll-safe timer key so countdown is not reset every 2.5s.
140. **2026-05-27 22:36 (+0200)** — **VPS ops** — nginx API `location` regex must include **`room`** (and other mounted prefixes) or `POST /room/continue` returns **405** HTML and Continue appears to loop; after API fixes, `curl -X POST https://…/room/continue` should return **401** JSON when unauthenticated.
141. **2026-05-27 22:42 (+0200)** — **API startup** (`31ab13a`) — remove duplicate `fromPlayer` in `requestHelp` (`roomService.ts`) so `tsc`/PM2 boot succeeds (loading screen no longer hangs on `/health`).
142. **2026-05-27 23:03 (+0200)** — **Multiplayer continue (v1)** (`295ec88`) — `roomContinue.ts` mirrors server continue targets; defer reward fly-out until party is ready; leaf-float Continue while waiting; `ResultBlock.playDismissAnimations()` on unanimous advance; poll no longer frozen for whole continue animation; local avatar renders in real `slotIndex`; focus overlays use game button icons; `roomDtoMapper` never drops participants (placeholder portrait/frame).
143. **2026-05-27 23:23 (+0200)** — **Multiplayer continue (v2)** (`250a272`) — party session = 2+ engaged players (not “2+ already resolved”); defer dismiss whenever results are visible in a party; early Continue queues until `waiting_continue` then auto-`submitRoomContinue`; block duplicate `submitRoomChoice` when already `ready`/`resolved`; solo auto-advance only when actually alone; ally **solution/dice icon** on portrait (`selectedAction` on `RoomParticipantDto`); avatar DTO fallback uses `m_portrait_*` / `m_frame_*` asset keys.
144. **2026-05-31 (+0200)** — **Dice equip reliability** (`2026-05-31`) — `setPlayerSelectedDice` in `withDocumentTransaction`; shop auto-equips after gem unlock; public `expansiondata.json` synced.
145. **2026-05-31 (+0200)** — **Stripe checkout** (`2026-05-31`) — EUR **Unlock** on expansions and dice; `POST /player/checkout/session`; signed `POST /stripe/webhook`; idempotent grants via `grantPlayerExpansion` / `grantPlayerDice`; gem costs rounded in data; `PurchaseReturnToast` for `?purchase=success|cancel`; ToS sections 4/5/16 updated; `npm run test:commerce`.
146. **2026-05-31 (+0200)** — **Stripe go-live** — live checkout + webhook on https://arcanitebrothers.com; nginx must proxy /stripe/webhook; PM2 restart from ecosystem.config.cjs (not process name) after .env changes so STRIPE_SECRET_KEY loads.
147. **2026-05-31 17:19 (+0200)** — **Party continue polish** (`2052168`) — dismiss reward flights before continue ack; forest-green Continue glow when all party members ready; room poll slowed to **3s**; expansion cards use `PanelButton` unlock rows instead of separate unlock `.webp` assets.
148. **2026-05-31 18:17 (+0200)** — **Account-wide dice skins** (`9bec698`) — six cosmetic dice in `UI/09_GAME/DIE/`; `@shared/diceCatalog` names (Frostchalk, Urbronze, Ashmaw, Grimroot, Wellwater, Cloudbone); `unlockedDiceIds` + `selectedDiceId` on player doc; `POST /player/dice/unlock|select`; **Dice** shop from Expansions footer; profile picker between avatars and wall of fame; `GameEnvironment` loads selected skin for solution/result dice art; `RoomFullOverlay` + `roomSession` helpers when a room is full.
149. **2026-05-31 18:17 (+0200)** — **Expansion preview** (`9bec698`) — **Preview** on expanded expansion cards shows three random encounters (image + title) from `encountersdata.json` for that expansion id.
150. **2026-05-31 18:27 (+0200)** — **Expansion art paths** (`4635309`) — header `.webp` files renamed to `expansion_keldor`, `expansion_everwinter`, `expansion_urcogor`, `expansion_aetherion` under `UI/03_DASHBOARD/expansions/`; `expansiondata.json` (client + server + public mirror) points at the new basenames so deploys/CDNs pick up fresh URLs.
151. **2026-06-01 16:42 (+0200)** — **Backgrounds** — refreshed in-game / dashboard background assets (`63262bf`).
152. **2026-06-01 18:48 (+0200)** — **Room multiplayer flow** — single Continue (choice chains into continue); `POST /room/selection` shows ally picks early; advance orchestrator; death stays in room until overlay; leader kick + ejection toast; encounter pool uses **leader expansions only**; party slot detail overlay + header seam fix (`6b603cc`).
153. **2026-06-01 21:23 (+0200)** — **Slot encounters** — pre-rolled snapshot per party slot; mid-join binds to slot fate; one Scribes line per room open; help invites friends with targeted feed rows; **shared lore gems** for all active players on collect (`9b9ffc0`).
154. **2026-06-01 21:44 (+0200)** — **Inactivity** — auto-disengage disabled until re-enabled (`3678b8f`).
155. **2026-06-02 21:35 (+0200)** — **Soul Link** — permanent account link to one Adventurer (auto-friend); **Gift of the Gods** grants Spiritguide progress when linker claims daily reward; **Spiritguide** achievement chain (ranks **3 / 9 / 21 / 54**); Alpha Player daily gem bonus per rank lowered to **20** (`2da3148`).
156. **2026-06-02 21:40 (+0200)** — **Witness system events** — allies read actor roll/rewards from `preparedResult`; witness-safe DTOs; **PatchNotesOverlay** in Settings; new encounter art (Forgotten Procession, Silent Throne, Hollow Choir, Weeping Mire, Verdani's Vigil) (`7aac31c`).
157. **2026-06-06 21:41 (+0200)** — **Charge gating** — solution use requires `scaledUses(1, encounterDifficulty)` total charges across inventory stacks; tooltips show requirement on blocked slots.
158. **2026-06-06 21:41 (+0200)** — **Witness outcomes** — system-event witnesses see actor roll and reward row; actor resolution deferred until Continue; achievement unlock copy in `@shared/achievementUnlockMessage.ts`.
159. **2026-06-07 00:12 (+0200)** — **Encounter tooltips** — shared frame styling; portal to `document.body` so side slots render above center portraits.
160. **2026-06-07 00:12 (+0200)** — **Labels & audio** — middle fate tier displays **Fate** (not Disengage); shared `deathEncounter.ts`; level-up sound cue when system-event snapshot appears; party-aware level-up Scribes visibility.
161. **2026-06-07 00:12 (+0200)** — **Level-up fix** — no double level-up XP; system-event inventory merge across room states; unified fades for normal ↔ system-event transitions.
162. **2026-06-07 00:12 (+0200)** — **Party badges** — **62px** dice/solution/focus icons on portraits when choice is ready; per-player dice skin on badge; pulsing animation + hover tooltips.
163. **2026-06-07 00:12 (+0200)** — **Tests** — solution consumption, system events, room orchestrator, inventory across continue paths.
164. **2026-06-07 (+0200)** — **Version** — tagged **0.9.0-beta.2.1** for the 6–7 Jun multiplayer/charges patch; **0.9.0-beta.2** remains the late May – 2 Jun release in patch notes history.
