# Morkahja devlog

Brief chronological overview of the web app from first commit to present. Newest work is at the bottom.

| | |
|---|---|
| **Started** | 2026-05-16 22:21 (+0200) |
| **Last updated** | 2026-06-01 (+0200) |
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
108. **Seal of Norghor** — gem subscription (**67** yellow red gems / **28** days); Settings + API (`32bf3e7`); **removed** from beta (`d26f799`).
109. **`PanelButton` / `ClosePanelButton`** — shared overlay press/hover (nav-style pulse + gold glow); adopted on Settings, About Us, Donation, achievements, friends, expansions, Scribes, and solution grid overlays.
110. **Settings refresh** — scrollable panel (header / body / footer); bottom gradient **scroll hint** when content overflows; **Recovery key** download row; player name beside SETTINGS title; About Us remains in footer.
111. **`GET /player`** — included `sealOfNorghor` status DTO (`32bf3e7`; field removed `d26f799`).

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

### 2026-05-26 (+0200) — Public beta tag and encounter rooms (`48f4f0a`, admin batch)

120. **Version** — workspaces tagged **0.9.0-beta.1** (`package.json`); `appVersion.ts` exposes version to client (`48f4f0a`).
121. **Encounter rooms** — server-backed **avatar-scoped** rooms (up to **3** players); `/room/*` API (create, join, leave, choice, focus, continue, call-for-help); `roomService` + Postgres persistence; `EncounterRoomSnapshotDto` on select/create encounter.
122. **Room states** — `active_encounter` (shared encounter play) and `system_event` (level-up / Atranor **witness** flow for non-actors); party slots UI (`PartyMemberSlot`, `PartyEmptySlot`, `PlayerHub`); `GameEnvironment` syncs room snapshot on continue.
123. **Help** — call-for-help invites friends or random online players; pending help list; join-via-invite; inactivity and invite TTL constants in `roomConstants.ts`.
124. **Tests** — `roomService.test.ts` for room lifecycle and coordination rules.
125. **Admin content** — mountain/travel/Verdani/Liani line encounters and art (Cliffs of Sarga through Raided Verdani Village, Bronze Vault, Aradia's Perch, etc.).

### 2026-05-27 (+0200) — Asset cleanup, Seal removed, UI polish (`133f405`, `d26f799`, admin)

126. **Asset hygiene** (`133f405`) — remove legacy PNG encounter art, archived avatar-creation trees, duplicate portraits, unused Scribes/Help assets; drop large `.wav` music (keep `.mp3`); `posterRaceSkills2.webp` replaces multi‑MB PNG; delete obsolete `strings.xml`.
127. **Seal of Norghor removed** (`d26f799`) — subscription API, `SealOfNorghorSection`, `mergeUnlockedExpansionsWithSeal`, and related player DTO fields removed (feature retired from beta).
128. **Anchored tooltips** (`d26f799`) — `anchoredTooltip.ts`; inventory and skillbook tooltips anchor to the hovered cell, clamp inside the overlay, and sit above the game header (`z-index` **26**); grid buttons use `morkahja-grid-item-button` with direct mouse enter/leave so hover works under the dimmer; inventory panel renders last when multiple grids are open.
129. **Result / rewards** (`d26f799`) — `ResultBlock` and `rewardFlyAnimation` rework; death overlay and game toasts refined; **Firestarter** achievement progress/events in Scribes (`firestarterAchievement`, `firestarterProgress`).
130. **Admin content** — Crumblegheist Berserk, Tempestwailer Stormcaller, Ashen Revenant Witch/Seer encounters + art.
131. **Signup legal** (`f08b632`) — `PrivacyPolicyOverlay` and `TermsOfServiceOverlay` (May 2026 copy); **New journey** opens scrollable in-app modals from Privacy Policy / Terms of Service links instead of external URLs (`OnboardingGateway`).
132. **Production build** (`6ea41d5`) — `SolutionGridOverlay` strict TS: capture `anchorX` before the layout `measureAndPlace` callback; `handleItemClick` typed as `GridTooltipTriggerEvent` (fixes `tsc -b` on deploy).

### 2026-05-27 22:36–23:23 (+0200) — Party help, continue sync, party UI (`c46b30d`…`250a272`)

133. **Call for help** (`c46b30d`) — Scribes feed shows `help_requested` with **Join**; friends list **Join** when a friend has a joinable solo room or pending invite; `POST /room/join/friend`; online-friend toasts in `App.tsx`; activity query includes friends’ events; `broadcastCallForHelp` invites eligible online friends with live sessions.
134. **API startup** (`31ab13a`) — remove duplicate `fromPlayer` in `requestHelp` (`roomService.ts`) so `tsc`/PM2 boot succeeds (loading screen no longer hangs on `/health`).
135. **Multiplayer continue (v1)** (`295ec88`) — `roomContinue.ts` mirrors server continue targets; defer reward fly-out until party is ready; leaf-float Continue while waiting; `ResultBlock.playDismissAnimations()` on unanimous advance; poll no longer frozen for whole continue animation; local avatar renders in real `slotIndex`; focus overlays use game button icons; `roomDtoMapper` never drops participants (placeholder portrait/frame).
136. **Multiplayer continue (v2)** (`250a272`) — party session = 2+ engaged players (not “2+ already resolved”); defer dismiss whenever results are visible in a party; early Continue queues until `waiting_continue` then auto-`submitRoomContinue`; block duplicate `submitRoomChoice` when already `ready`/`resolved`; solo auto-advance only when actually alone; ally **solution/dice icon** on portrait (`selectedAction` on `RoomParticipantDto`); avatar DTO fallback uses `m_portrait_*` / `m_frame_*` asset keys.
137. **VPS ops** — nginx API `location` regex must include **`room`** (and other mounted prefixes) or `POST /room/continue` returns **405** HTML and Continue appears to loop; after API fixes, `curl -X POST https://…/room/continue` should return **401** JSON when unauthenticated.
138. **Room-authoritative continue & lore gems** — prepare/commit encounter outcomes on room tick; `ready_to_continue` / `advancing`; per-player `loreGemCollected` and grant on commit; pauseable lore-only reveal timer (`durationMs`, 14–28s); collect UX (hover, wiggle/+1, outcome-row icon); poll-safe timer key so countdown is not reset every 2.5s.
139. **Party continue polish** (`2052168`) — dismiss reward flights before continue ack; forest-green Continue glow when all party members ready; room poll slowed to **3s**; expansion cards use `PanelButton` unlock rows instead of separate unlock `.webp` assets.
140. **Account-wide dice skins** (`9bec698`) — six cosmetic dice in `UI/09_GAME/DIE/`; `@shared/diceCatalog` names (Frostchalk, Urbronze, Ashmaw, Grimroot, Wellwater, Cloudbone); `unlockedDiceIds` + `selectedDiceId` on player doc; `POST /player/dice/unlock|select`; **Dice** shop from Expansions footer; profile picker between avatars and wall of fame; `GameEnvironment` loads selected skin for solution/result dice art; `RoomFullOverlay` + `roomSession` helpers when a room is full.
141. **Expansion preview** (`9bec698`) — **Preview** on expanded expansion cards shows three random encounters (image + title) from `encountersdata.json` for that expansion id.
142. **Expansion art paths** (`4635309`) — header `.webp` files renamed to `expansion_keldor`, `expansion_everwinter`, `expansion_urcogor`, `expansion_aetherion` under `UI/03_DASHBOARD/expansions/`; `expansiondata.json` (client + server + public mirror) points at the new basenames so deploys/CDNs pick up fresh URLs.
143. **Stripe checkout** (`2026-05-31`) — EUR **Unlock** on expansions and dice; `POST /player/checkout/session`; signed `POST /stripe/webhook`; idempotent grants via `grantPlayerExpansion` / `grantPlayerDice`; gem costs rounded in data; `PurchaseReturnToast` for `?purchase=success|cancel`; ToS sections 4/5/16 updated; `npm run test:commerce`.
144. **Dice equip reliability** (`2026-05-31`) — `setPlayerSelectedDice` inside `withDocumentTransaction` + `FOR UPDATE`; shop auto-calls `selectDice` after gem unlock; `client/public/game/expansiondata.json` synced to `expansion_*` paths and `mExtensioPriceEurCents`.

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
- **nginx** — `location ~ ^/(health|game-data|session|player|avatar|avatars|encounter|activity|room)` → `proxy_pass http://127.0.0.1:3000` (must include **`room`** for multiplayer continue/help); `try_files` → `index.html` for SPA.
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

### Seal of Norghor subscription (`32bf3e7`; removed `d26f799`) · 2026-05-24 23:18 (+0200)

- **Was** — **67** gems / **28** days; `GET/POST /player/seal-of-norghor`; Settings section; temporary merge of all active expansions while active.
- **Removed** (`d26f799`) — subscription retired from public beta; API, domain module, and UI deleted; expansions unlock via gem spend only.

### Encounter rooms (`48f4f0a`) · 2026-05-26 23:58 (+0200)

- **Scope** — up to **3** participants per room (`MAX_PARTICIPANTS`); rooms keyed by leader avatar; solo play uses the same room model with one filled slot.
- **API** (`/room`) — `GET /active`, `POST /create`, `/join`, `/leave`, `/slot`, `/choice`, `/focus`, `/continue`, `/help/request`, `/help/respond`, `GET /help/pending`.
- **States** — `active_encounter` for normal coordinated play; `waiting_continue` until all press continue; `system_event` when level-up or Atranor runs for witnesses (local actor vs witness UI).
- **Persistence** — `roomPersistence.ts` + Postgres; `roomDtoMapper.ts` builds `EncounterRoomSnapshotDto` for client.
- **Client** — `GameEnvironment` drives room sync; `PartyMemberSlot` / `PartyEmptySlot`; help invitations; `GameMessageToast` for room/help messaging; witness path for system events without blocking actors.
- **Events** — `roomGameEvents.ts` hooks room outcomes into the game event bus / Scribes where applicable.
- **Tests** — `roomService.test.ts`.

### Asset cleanup (`133f405`) · 2026-05-27 18:36 (+0200)

- **Removed** — hundreds of legacy PNG/WebP duplicates under avatar creation archives, old encounter PNGs, unused UI mockups, `.wav` music masters, `client/public/UI/StringsTexts/strings.xml`.
- **Kept** — production `.webp` encounter art, compressed `posterRaceSkills2.webp`, `.mp3` music tracks.

### Seal removal and tooltip/result polish (`d26f799`) · 2026-05-27 21:04 (+0200)

- **Seal** — delete `sealOfNorghorService`, controller routes, Settings section, shared DTOs; strip `sealOfNorghor` from `GET /player`.
- **Tooltips** — `anchoredTooltip.ts` shared helper; `SolutionGridOverlay` anchors to grid cells, clamps in-bounds, `OVERLAY_Z_INDEX` **26**, `morkahja-grid-item-button` + mouse handlers; inventory overlay ordered after skillbook in `EncounterImageBlock`.
- **UX** — `ResultBlock` / `rewardFlyAnimation` improvements; `AvatarDeathOverlay` refactor; Firestarter Scribes lines and tests.

### Signup privacy and terms (`f08b632`) · 2026-05-27 21:39 (+0200)

- **Overlays** — `PrivacyPolicyOverlay` (effective May 27, 2026) and `TermsOfServiceOverlay` (sections 1–18) as full-screen scrollable modals.
- **Onboarding** — checkbox links on **New journey** toggle local state; removed `PRIVACY_POLICY_URL` / `TERMS_OF_SERVICE_URL` external hrefs.

### SolutionGridOverlay build (`6ea41d5`) · 2026-05-27 21:44 (+0200)

- **TypeScript** — `anchorX` read once when the tooltip layout effect runs (nested `measureAndPlace` no longer closes over nullable `tooltip`); `handleItemClick` accepts `GridTooltipTriggerEvent` so `tsc -b` passes on the VPS.

### Call for help and friend join (`c46b30d`) · 2026-05-27 22:36 (+0200)

- **Scribes** — `help_requested` events in feed with `joinAction` (`ActivityFeedOverlay`); `gameEventPersistence` + `scribesFeedFilter` include friends and targeted help rows; `renderEventMessage` copy for help calls.
- **Friends** — `FriendSummaryDto.joinableRoom`; `describeJoinableRoomForFriend` / `joinFriendRoom` in `roomService.ts`; **Join** on `FriendsOverlay` when friend is in a solo room or caller has a pending invite.
- **Client** — `App.tsx` polls friends and shows toasts for online allies who can join; `joinFriendEncounter` wires Scribes and friends UI to `POST /room/join/friend`.
- **Server** — `recordHelpRequestedEvent` per invite; `broadcastCallForHelp` only invites online friends not already in another room.

### Server startup fix (`31ab13a`) · 2026-05-27 22:42 (+0200)

- **Bug** — duplicate `const fromPlayer` in `requestHelp` prevented the API from compiling/starting; welcome loading waited forever on `/health`.
- **Fix** — remove the duplicate declaration in `roomService.ts`.

### Multiplayer continue UX (`295ec88`) · 2026-05-27 23:03 (+0200)

- **`roomContinue.ts`** — `continueTargets`, `allContinuePressed`, `localContinuePressed`, `multiplayerContinueWaiting` aligned with `roomService.continueTargetsForRoom`.
- **`ResultBlock`** — `deferRewardDismiss` skips fly-out on first Continue in a party; `morkahja-continue-waiting-party` leaf-float CSS; `playDismissAnimations()` exposed via ref for synchronized dismiss.
- **`GameEnvironment`** — `continueSubmitInFlightRef` narrows poll blocking; dismiss before snapshot when poll sees `waiting_continue` → `active_encounter`; `PlayerHub` places `AvatarPanel` in the local player’s `slotIndex` column.
- **`PartyMemberSlot`** — continue glow when `continuePressed` during `waiting_continue`; focus icons from `/UI/09_GAME/im_button_*.webp` via `gameUiAssets.ts`.
- **`roomDtoMapper`** — participant DTOs always emitted; placeholder avatar when `toPersistedAvatarDto` fails.

### Party continue wait and ally choices (`250a272`) · 2026-05-27 23:23 (+0200)

- **Party detection** — `isPartySession` = 2+ engaged participants; `shouldDeferRewardDismiss` whenever results are visible in a party (including after local choice while allies are still picking).
- **Continue flow** — early Continue sets `pendingPartyContinue` and floats the button until room reaches `waiting_continue`, then auto-submits continue; no second `submitRoomChoice` when local state is already `ready`/`resolved`; solo auto-advance uses `!isPartySession` only.
- **Ally UI** — `selectedAction` on `RoomParticipantDto`; solution or dice icon centered on `PartyMemberSlot` as soon as choice is `ready`/`resolved`; portrait fallback keys `m_portrait_rokur_warrior` / `m_frame_01` match production asset naming.

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

### Room-authoritative continue & lore gems · 2026-05-28 (+0200)

- **Prepare vs commit** — `prepareParticipantOutcome` dry-runs rewards; `commitPreparedOutcome` persists on heartbeat `tickRoom` after all continue targets ack.
- **Room lifecycle** — `ready_to_continue`, `advancing`, `preparedResult` on participants; `GET /room/active` polls call `tickRoom` (party advance is poll-driven; solo still ticks on continue).
- **Lore gems (server)** — `loreGemOffer` rolled at encounter start (`durationMs`, 14–28s); `POST /room/lore-gem/activate` sets `loreGemCollected` on the participant; yellow/red gems grant in `grantRoomLoreGemsOnCommit` **before** advance (only players who clicked); Scribes `gems_received` with `source: 'lore_gem'`.
- **Lore gems (client)** — pauseable timer counts down only while lore is open (close = pause, reopen = resume); stable `loreGemOfferResetKey` so room polls do not restart the countdown; collect animation and **+1** run before the activate API returns (poll no longer unmounts the gem mid-animation); hover wiggle on the lore gem; no timer dot on the footer Lore button.
- **Results UX** — pending lore gem icon beside outcome text (Misery / Prosperity / …) with fade-in, **+1** pop, and fly-to-avatar on Continue (not in the top reward row).
- **Client continue** — removed `pendingPartyContinue`; inventory merge only after commit; continue glow (`gathering` / `awaiting_local`) from `continueReadiness` DTO.
- **Disengaged** — travelers stay in the room through advance without rewards.
- **Tests** — `roomService.test.ts` extended for prepare/commit, lore grant timing, and continue readiness.

### Account-wide dice skins · 2026-05-30 (+0200) (`9bec698`)

- **Catalog** — `@shared/diceCatalog.ts`: ids `a`–`f`, display names, `DICE_UNLOCK_GEM_COST` **100**, asset paths under `/UI/09_GAME/DIE/im_button_dice_{id}.webp`; default **Frostchalk** (`a`) always unlocked.
- **Server** — `unlockedDiceIds` + `selectedDiceId` on `PlayerDocument`; `diceService` (`unlockPlayerDice`, `setPlayerSelectedDice`, `readPlayerDiceState`); `POST /player/dice/unlock` spends gems; `POST /player/dice/select` sets active skin; `GET /player` and `GET /player/profile` expose dice state.
- **Client** — `DiceShopOverlay` from **Dice** on `ExpansionsOverlay` footer; `PlayerProfileOverlay` grid of unlocked dice; `fetchPlayer` on game entry applies `selectedDiceId` to `SolutionBlock` / `ResultBlock` dice art.
- **Room UX** — `RoomFullOverlay` when join/create hits capacity; `leaveJoinedPartyRoomIfNeeded` / `ensureSoloLeaderRoom` in `roomSession.ts`.
- **Expansions** — **Preview** button samples three encounters per expansion (image + title); refreshed header `.webp` art (later renamed — see expansion art paths).

### Expansion art paths for deploy · 2026-05-31 (+0200) (`4635309`)

- **Problem** — replacing `im_header_expansion_*.webp` in place did not always refresh on CDN/browser cache; old unlock/collection `.webp` assets were removed when unlock UI moved to `PanelButton`.
- **Fix** — stable filenames: `expansion_keldor.webp`, `expansion_everwinter.webp`, `expansion_urcogor.webp`, `expansion_aetherion.webp` in `client/public/UI/03_DASHBOARD/expansions/`; all `mExtensio*Image` / `mExtensioUnlockButton` fields in `expansiondata.json` (client `src/data`, `public/game` mirror, `server/game`) use the same basename (no `im_header_` prefix).

### Party continue wait UX · 2026-05-28 (+0200) (`2052168`)

- **`roomContinue.ts`** — `continueWaitingAfterPress`, forest-green party Continue glow when everyone is ready.
- **`ResultBlock` / `GameEnvironment`** — run dismiss animations before continue submit; defer blocking poll during dismiss; **3s** room poll interval.
- **`ExpansionsOverlay`** — unlock rows use shared `PanelButton` styling; removed per-expansion unlock `.webp` buttons.

### Stripe direct-unlock checkout · 2026-05-31 (+0200)

- **Pricing** — gem prices lightly rounded in `expansiondata.json` (Keldor **75**, Everwinter **50**, Urcogor **60**, Aetherion **25**). EUR list prices on data: Aetherion **199¢**, Everwinter/Urcogor **299¢**, Keldor **399¢**, dice skin **149¢** (`mExtensioPriceEurCents` / `DICE_UNLOCK_EUR_CENTS`); Stripe catalog bundles **€7.99** (all expansions) / **€4.99** (all dice) / **€11.99** (complete). Real-money buys grant unlocks without spending gems.
- **Model** — Stripe-hosted Checkout Sessions (one-time, dynamic payment methods). Webhook grants are idempotent; gem unlock path unchanged.
- **Server** — `POST /player/checkout/session` (authed) with `metadata {playerId, sku}`; `POST /stripe/webhook` (raw body, before `express.json`) on `checkout.session.completed`; `processed_stripe_events` + `purchases` tables; `domain/commerce/catalog.ts` SKUs (`expansion_*`, `dice_*`, bundles); `grantPlayerExpansion` / `grantPlayerDice` (no gem debit).
- **Client** — **Unlock €…** on `ExpansionsOverlay` / `DiceShopOverlay` (`formatEurCents`); redirect to Checkout; `PurchaseReturnToast` on `?purchase=success|cancel` in `App.tsx`.
- **Stripe config** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLIENT_URL`; default live EUR price ids in `config/stripeConfig.ts` (override with `STRIPE_PRICE_*` for test mode). Nginx must proxy `/stripe/webhook` and `/player/checkout/session`. Optional `server/scripts/create-stripe-test-catalog.mjs` for test-mode catalog setup.
- **ToS** — `TermsOfServiceOverlay` sections 4/5/16: optional paid expansions + cosmetic dice; no purchasable currency; no consumable microtransactions.
- **Tests** — `npm run test:commerce`. Webhook E2E: Stripe CLI `stripe listen --forward-to localhost:3000/stripe/webhook`.

### Dice equip reliability · 2026-05-31 (+0200)

- **Bug** — `setPlayerSelectedDice` used non-transactional read/merge `setPlayer`, which could race with a just-finished gem unlock and return **500** / `DICE_NOT_UNLOCKED` when equipping immediately after purchase.
- **Fix** — `setPlayerSelectedDice` runs inside `withDocumentTransaction` with `FOR UPDATE` (same pattern as unlock); `PlayerNotFoundError` mapped to **404** in `diceController`. After a gem unlock in `DiceShopOverlay`, client calls `selectDice` so the new skin is equipped without a separate profile step.
- **Ops note** — Vite `ECONNRESET` then `ECONNREFUSED` on `/room/*` means the Node API on port **3000** stopped (crash or manual stop), not a dice-specific proxy bug — restart `npm run dev` in `server/` and retry.

### Stripe go-live (`arcanitebrothers.com`) · 2026-05-31 (+0200)

- **Live mode verified** — all 8 live EUR prices exist and are `active` in the Stripe account (`Babunigaming`), ids match the defaults in `config/stripeConfig.ts`. First live checkout + webhook grant confirmed working end-to-end.
- **Prod env** — `STRIPE_SECRET_KEY=sk_live_…`, `STRIPE_WEBHOOK_SECRET=whsec_…` (from the Dashboard **Event destination** → `https://arcanitebrothers.com/stripe/webhook`, event `checkout.session.completed`), `CLIENT_URL=https://arcanitebrothers.com` in the repo-root `.env` on the VPS. Live `whsec_` ≠ the local `stripe listen` `whsec_`. No `STRIPE_PRICE_*` needed in prod (live ids are committed defaults).
- **nginx** — `/player/checkout/session` is already covered by the existing `player` prefix in the API `location` regex; only **`stripe`** had to be added so `/stripe/webhook` proxies to Node. nginx forwards the raw body unmodified by default, which the signature-verified `express.raw` handler needs.
- **⚠️ PM2 `.env` reload gotcha** — `pm2 restart morkahja-api --update-env` (by process **name**) does **not** re-run `ecosystem.config.cjs`, so newly added `.env` keys are **not** picked up (symptoms: `CORS allowed origins: (none — set CLIENT_ORIGINS)` at boot, and checkout returns **503 `PURCHASES_UNAVAILABLE`** because `STRIPE_SECRET_KEY` is missing from `process.env`). After editing `.env`, restart **from the config file**: `pm2 restart ecosystem.config.cjs --update-env` (or `pm2 delete morkahja-api && pm2 start ecosystem.config.cjs --update-env`). Verify with `pm2 logs … | grep CORS` (should list real origins) and `pm2 env 0 | grep -i stripe`.
- **Local dev webhook** — only needs the Stripe CLI (`stripe listen --forward-to localhost:3000/stripe/webhook`); `whsec_` goes in `Key.js`. Watch the leading `whsec_` survives the paste (a dropped `w` → silent signature-verify failure → unlock never granted). Stripe CLI is **not** installed on the VPS; production webhooks hit the public URL directly.

### Room multiplayer flow · 2026-06-01 (+0200) (`6b603cc`)

- **Single Continue** — one physical Continue per outcome: `submitRoomChoice` chains into `submitRoomContinue` when the room is already `waiting_continue`; poll auto-acks `localNeedsContinueAck` when a party member finished early and the room later catches up. Reward fly-out still runs only on snapshot advance via `roomAdvanceOrchestrator` (dismiss animations are not skipped).
- **Party choice visibility** — `POST /room/selection` records dice/solution intent as soon as you use an action (`choiceState: ready`, `selectedSolutionId` / `selectedAction` on the participant). Allies see the icon on your portrait before Continue; status **Chose** until commit. Continue still runs `submitChoice` (prepare + `waiting_continue`).
- **Advance orchestration** — `encounterSnapshotAdvanced` + `runEncounterAdvanceTransition`: poll and continue both dismiss rewards, then apply the new encounter snapshot; `holdResultRollReset` on `EncounterImageBlock` during dismiss.
- **Death** — on fatal outcome the avatar stays in the room until `AvatarDeathOverlay` shows **Same Soul / New Avatar** (`onOptionsVisible` → `completeDeathRoomLeave`); server marks `disengaged` at commit instead of immediate `leaveRoom`.
- **Kick** — leader kick sets `lastPartyEjection` on presence; `GET /room/active` returns one-shot `partyEjection`; client routes to dashboard with toast (“party leader removed you…”).
- **Encounter pool** — room encounters use **only the leader’s** `mergedExpansions` (join no longer unions the whole party; leader promotion recomputes the pool).
- **Party UI** — `PartyMemberSlot` detail overlay (name, status, kick); larger centered focus icons; encounter header seam layering fix.
- **Dice shop** — short descriptions per skin; **50 gems** unlock label aligned with catalog copy.
- **Tests** — `roomService.test.ts` extended (solo `waiting_continue`, leader expansion pool, continue/advance paths).
