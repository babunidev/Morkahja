# Morkahja devlog

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
