# Morkahja devlog

Brief chronological overview of the web app from first commit to present. Newest work is at the bottom.

---

## Development overview

### 2026-05-16 — Game data layout

1. Add **LudusOccursus** / **LudusSolutio** structure for encounters and solutions.
2. Rename datafiles; remove superseded JSON (`LudusOccursus`, `LudusSolutio`, `MorkahjaRules`).

### 2026-05-17 — Repo bootstrap

3. **Initial commit** — encounter images and core game data assets land in the repo.
4. Sync with remote; delete obsolete top-level `Game/` directory.
5. Fix **TypeScript module resolution** for the client/server/shared workspace.

### 2026-05-18 — v0.1 playable (`3f71171`)

6. First **playable checkpoint**: Vite + React client, Express API, shared contracts.
7. Sign-in / session flow, dashboard shell, avatar selection, encounter loop.
8. Static game data (encounters, solutions, portraits, frames), PostgreSQL document store.
9. UI asset tree (backgrounds, buttons, encounter art, welcome flow).

### 2026-05-19 — Audio (`e8edbed`)

10. **v0.12 music engine** — playlist wiring and playback controls for dashboard and in-game ambience.

### 2026-05-20 — Rewards and Scribes (`03b715b`, `f0ca176`)

11. Fix **duplicate solution IDs** (10065–10068) so warrior reward pool entries are unique.
12. **Level-up encounters** — outcome-based race/role abilities without hardship penalties; `rewardIds` precomputed for result preview.
13. **Game event pipeline** — persisted events in PostgreSQL, bus + renderer foundation.
14. **SCRIBES** activity feed overlay on the dashboard; unread-style world log.
15. **Atranor death** survival rules; music volume in settings; related gameplay UI fixes.

### 2026-05-21 — Content and dashboard shell

16. Fix high-impact **solution name/description typos**; sync client `solutiondata.json` mirrors (`3b9ab56`, `f0e6030`).
17. Remove obsolete game ambient tracks; reclassify solution **10185** as PurgeSkill (`32d22af`, `f0b141d`).
18. **Expand music playlists** for dashboard and in-game (`eaa2aa1`).
19. Dashboard **overlays** — Scribes unread indicator, achievements entry point, ambient wiring (`6e4dc8e`).
20. Remove legacy avatar portrait assets; **inventory bootstrap** on new avatars (`d284bbe`).

### 2026-05-21 — Encounter UX (`85eeb3a`, `686c16c`)

21. **Result screen** — reward icons fly to footer targets on Continue; losses fly from portrait into outcome slots; dice art beside outcome text.
22. **Reveal pacing** — slower encounter crossfade (720ms); solution/dice fade-in (1100ms); spacer bar stays visible.
23. All **four solution slots** shown (missing items dimmed + tooltip).
24. Healing Elixir image renamed to match potion icon (`43c08a6`).
25. Smoother **continue transition**; fix reward icon flicker when result layer hides (`686c16c`).
26. **Lore gem** click fix (`inert` hidden result layer); scrollable Scribes feed.

### 2026-05-21 — Adventurer achievements (`9ea2110`)

27. First real **achievement chain** (Adventurer → Trailblazer): event-driven progress on `encounter_resolved` / `encounter_failed`, ranks every **42** encounters (max rank 4), `player_achievements` table.
28. **`achievement_unlocked`** events → Scribes (“became a Wayfarer”, etc.).
29. **Daily reward** — **21** encounters per **UTC day**; gem payout scales with rank (1–5); `daily_reward_claimed` events; deduped claims.
30. **`AchievementPanel` / overlay** — rank overlays, progress bar, `N/N encounters` daily line, footer gem count.
31. **Nav attention UX** — closed menu dots at **13:00** (Scribes) and **17:00** (Achievements); open menu wiggle + **independent glow rhythms**; `achievementsAttentionState` in localStorage.
32. **`gems_received`** recorded inside `addPlayerYellowRedGems` so Scribes always sees gem grants.
33. `npm run test:achievements` for rank/daily-reward math.

### 2026-05-22 — Server death, avatar flow, Alpha Player (`904bfed`…`953e348`)

34. **Shared dice** — `interpretRoll` / `isRollFavorable` in `@morkahja/shared`; server re-exports; client imports via `@shared` Vite alias; `npm run test:dice` parity test.
35. **Server-authoritative Atranor death** — removed client `isFatalAtranorRoll` shortcut; all Misery/Hardship on encounter **1** go through `POST /encounter/continue`; `avatarDied` / `deathTriggered` on response; max **3** avatars per player (`AvatarLimitReachedError`).
36. **Avatar death UX** — `AvatarDeathOverlay`; dead IDs in `localStorage`; `purgeDeadAvatarsOnServer` returns `{ purgedIds, failedIds }`; Home awaits purge + refetch before recreate preset; Play gated on `prepareAvatarSelection()` (loading + inline spinner).
37. **Dashboard** — `AboutUsOverlay`; `avatarSelectionPrepare.ts` helpers; enlarged achievement rank overlays past icon frame.
38. **Alpha Player** achievement — progress on `level_up` + `avatar_died`; global **100** Legendborn (rank 4) cap; `globallyLocked` + chain title in UI; daily reward threshold raised to **42** encounters; removed unused root `achievements.json`.
39. **Encounter art** — refreshed `death_atranor`, Tempest fight, and Verdani heal `.webp` assets.
40. **Solution affordance** — dimmer disabled slots; rattle animation when dice/solutions unlock; slightly wider hub footer buttons.

---

## Session notes (detail)

### Atranor = system death encounter (id 1)

**Atranor** (`mEncounterID` **1** / `DEATH_ENCOUNTER_ID`) is queued when essence runs out on a normal encounter; random pool still starts at **20001**. Only Atranor **Misery/Hardship** sets `avatarDied` (death overlay). `deathTriggered` means “Atranor is next,” not dead yet. Client shows overlay from `avatarDied` on `/encounter/continue` only.

Since `7023633`, `2eebf99`, `a58ac44`.

- **Server** — `encounterGenerator` sets `deathTriggered` when essence depletion queues Atranor; `avatarDied` when the death encounter roll fails; comments in `encounterGenerator.ts` and shared contracts.
- **Client** — `GameEnvironment` no longer calls `deleteAvatar` on local roll interpretation; `deathPending` blocks continues while overlay is open.
- **Purge** — `refreshAvatarSelectionAfterHome` / death Home handoff only clear `excludedAvatarIds` for successfully deleted avatars; partial failure keeps IDs and shows “Could not remove fallen avatar; try Home again.”
- **Prepare** — `loadAvatarSelection` during loading bootstrap; Play toggles slots only when `avatarSelectionPrepared`; fallback `ensureAvatarSelectionPrepared()` with button spinner (not top-right wheel).

### Alpha Player limited achievement (`15c95c5`)

Since `9ea2110`.

- **Progress** — `alphaPlayerAchievement.ts`; engine listens for `level_up` and `avatar_died`; ranks at **20 / 40 / 80 / 160** activity.
- **Global cap** — `alphaPlayerGlobalLock.ts` + Postgres readiness on boot; rank 4 (Legendborn) limited to **100** players worldwide; others stall at rank 3 with `globallyLocked` in API/UI.
- **UI** — `AchievementPanel` shows chain title at rank 0, sealed copy when locked; attention state unchanged pattern.
- **Daily reward** — `DAILY_REWARD_ENCOUNTERS_REQUIRED` **42** (was 21); Adventurer rank bands unchanged at 42 encounters per rank.
- **Tests** — `alphaPlayerAchievement.test.ts` included in `npm run test:achievements`.

### Avatar selection, death overlay, About Us (`0ea459e`, `a58ac44`)

- **`avatarSelectionPrepare.ts`** — `prepareAvatarSelection`, `purgeDeadAvatarsOnServer`, dead-ID localStorage key.
- **`AvatarDeathOverlay`** — async `onHandoffStart` (purge + preload) before dashboard recreate flow.
- **`AboutUsOverlay`** — dashboard nav “About Us” credits panel.

### Encounter images and solution UX (`e6d4dd0`, `953e348`)

- **Images** — higher-resolution encounter art for Atranor death, Corrupted Tempest (seductress + wildheart), exhausted Verdani heal.
- **SolutionBlock** — `morkahja-solution-enable-rattle` when slots become interactive; unavailable opacity **0.37**.

### Adventurer achievements and nav dots (`9ea2110`)

Since `686c16c`.

- **Engine** — `achievementEngine` + `registerAchievementHandlers` on `gameEventBus`; no direct encounter-table scans.
- **API** — `GET /player/achievements`, `POST /player/daily-reward/claim`; shared DTOs; client `fetchAchievements` / `claimDailyReward`.
- **UI** — Overlay loads player gems before achievements so a 404 does not show zero gems; radial dot positioning uses spoke + 70% radius scale; separate CSS glow animations (~2.15s vs ~3.45s).

### Encounter results and reveal pacing (`85eeb3a`, `686c16c`)

Since `d284bbe`.

- **Flights** — `rewardFlyAnimation.ts`; `data-morkahja-footer-target` / `data-morkahja-avatar-portrait`.
- **Continue** — full bounce even for no-reward outcomes; fade-out without re-showing reward nodes (`inert`).
- **Assets** — refreshed encounter `.webp` set; `tool_heal_linen_bandage` rename.
