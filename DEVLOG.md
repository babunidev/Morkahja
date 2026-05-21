# Morkahja devlog

## 2026-05-21 — Adventurer achievements, daily reward, and dashboard attention dots

Since `686c16c` (result continue transition + reward fly flicker fix).

### First achievement chain: Adventurer

- **Event-driven progression** — `achievementEngine` listens on `gameEventBus` for `encounter_resolved` and `encounter_failed` (each counts as one encounter played). No direct encounter-table scans.
- **Adventurer ranks** — Rank 1–4 at 42 / 84 / 126 / 168 encounters (Adventurer → Explorer → Wayfarer → Trailblazer); rank 4 uses the gold overlay. Progress stops after rank 4.
- **Persistence** — `player_achievements` table via `achievementPersistence`; progress model in `achievementProgress.ts`.
- **World events** — Rank upgrades emit `achievement_unlocked`; Scribes renders lines like “Babuni became a Wayfarer.” (`renderEventMessage`, feed filter/presentation).
- **API** — `GET /player/achievements`, `POST /player/daily-reward/claim`; shared DTOs in `contracts.ts`; client `fetchAchievements` / `claimDailyReward`.

### Daily reward (UTC day)

- **Threshold** — 21 encounters per UTC calendar day to unlock claim (not rolling 24h).
- **Gems** — Yellow/red gem currency via `addPlayerYellowRedGems`; one claim per day (`daily-reward-{utcDay}` dedupe). Gem count = Adventurer rank + 1 (1–5 gems).
- **Player state** — `dailyReward` on player document (`utcDay`, `encountersPlayed`, `claimedAt`).
- **Events** — `daily_reward_claimed` recorded for Scribes; encounter play increments daily counter in the achievement handler path.

### Achievement UI

- **`AchievementPanel`** — Icon + rank overlay stack, rank title/text, progress bar within current 42-encounter band, daily reward card showing `encountersPlayed/21 encounters` only (no long description).
- **`AchievementsOverlay`** — Loads gems and achievements separately so a missing achievements route does not zero the footer gem count; claim updates currencies in-panel.

### Dashboard nav indicators

- **Closed nav** — Scribes dot at **13:00** (News spoke), achievements dot at **17:00** (Achievements spoke), positioned past button anchors then scaled **70%** toward hub for final spacing.
- **Open nav** — Dots center on News / Achievements buttons; icons **wiggle** like Scribes when there is unseen progress (`achievementsAttentionState` in `localStorage`, polled with activity feed).
- **Independent glow** — `morkahja-nav-attention-glow-scribes` (~2.15s) and `morkahja-nav-attention-glow-achievements` (~3.45s + delay) so dots do not pulse in sync; radial closed-nav dots use `left`/`top` calc to avoid transform clashes with the hub.

### Scribes and gems

- **`gems_received` events** — Recording moved into `addPlayerYellowRedGems` so lore gem grants and daily reward claims appear in Scribes reliably.
- **Feed overlay** — Scrollable list with hidden scrollbar (matches achievements panel pattern).

### Encounter / game UI fixes

- **Lore gem** — Hidden result layer no longer blocks the lore gem (`inert` when result hidden; Lore z-index when open).
- **Result block** — `inert` when hidden to avoid stray `cursor: help` hit targets over Lore.

### Tests and tooling

- `npm run test:achievements` — Unit tests for Adventurer rank thresholds, progress bands, and daily gem scaling.

### Assets

- Updated `help_bread_verdani_child.webp` encounter image.

---

## 2026-05-21 — Encounter results, reward flights, and reveal pacing

Since `d284bbe` (avatar asset cleanup + inventory bootstrap).

### Result screen and continue flow

- **Reward fly-out on Continue** — Gained rewards animate from the result row to the footer skillbook or inventory button (by solution type), with a short footer wiggle on arrival. Shared flight helper in `rewardFlyAnimation.ts`; footer targets wired via `data-morkahja-footer-target` on `PlayerHub`.
- **Loss fly-in on reveal** — When an encounter costs inventory or essence, loss icons fly from the avatar portrait (`data-morkahja-avatar-portrait`) into the slots under the outcome, then settle with a red glow. Essence losses use a slightly larger icon than item losses.
- **Dice resolution cue** — Rolling the dice shows the dice button art beside the outcome text (alongside the used-solution icon when applicable).
- **Continue pacing** — Disengage and other no-reward outcomes still play the full Continue button bounce (~1s) before resolving, so the beat matches rewarded continues.

### Encounter and solution reveals

- **Slower encounter image fade** — Crossfade between encounters and initial reveal use **720ms** (was 420ms), separate from general UI fades.
- **Slower solution/dice fade** — Actions fade in over **1100ms** after a short delay; dice and solution buttons stay disabled until the fade finishes so nothing is clickable mid-animation.
- **Spacer bar** — The bottom `im_spacer_line` mask stays fully visible; only the solution row and dice fade, not the bar.

### Solutions UI

- **All four slots visible** — Required solutions you do not own still appear at reduced opacity with a “not in your inventory” tooltip; owned solutions behave as before.

### Assets

- Refreshed several encounter `.webp` images and added a few new ones; renamed `tool_heal_linen_bandage1.webp` → `tool_heal_linen_bandage.webp`.
