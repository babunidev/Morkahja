import assert from 'node:assert/strict';
import { ADVENTURER_ACHIEVEMENT_ID } from './adventurerAchievement.js';
import { ALPHA_PLAYER_ACHIEVEMENT_ID } from './alphaPlayerAchievement.js';
import { CONTRIBUTOR_ACHIEVEMENT_ID } from './contributorAchievement.js';
import { BLESSED_ACHIEVEMENT_ID } from './blessedAchievement.js';
import { COMBATANT_ACHIEVEMENT_ID } from './encounterSolveAchievements.js';
import { renderEventMessage } from '../news/renderEventMessage.js';
import { levelUpScribeVisibility } from '../news/levelUpScribeVisibility.js';
import { isVisibleInScribesFeed } from '../news/scribesFeedFilter.js';
import { resolveScribesIconUrl } from '../news/scribesFeedPresentation.js';
import type { GameEvent } from '../events/GameEvent.js';

function achievementUnlockedEvent(
  playerId: string,
  achievementId: string,
  rankTitle: string,
): GameEvent {
  return {
    eventId: 'test-event',
    timestamp: Date.now(),
    playerId,
    type: 'achievement_unlocked',
    visibility: 'global',
    importance: 'high',
    payload: {
      playerName: 'Babuni',
      achievementId,
      rank: 2,
      rankTitle,
    },
  };
}

const adventurerRankUp = achievementUnlockedEvent(
  'player-a',
  ADVENTURER_ACHIEVEMENT_ID,
  'Explorer',
);
const alphaRankUp = achievementUnlockedEvent(
  'player-a',
  ALPHA_PLAYER_ACHIEVEMENT_ID,
  'Worldwalker',
);

assert.equal(isVisibleInScribesFeed(adventurerRankUp, 'player-a'), true);
assert.equal(isVisibleInScribesFeed(adventurerRankUp, 'player-b'), true);
assert.equal(
  renderEventMessage(adventurerRankUp),
  'Babuni unlocked the "Explorer" achievement.',
);
assert.equal(
  renderEventMessage(alphaRankUp),
  'Babuni unlocked the "Worldwalker" achievement.',
);
assert.equal(
  resolveScribesIconUrl(adventurerRankUp),
  '/UI/04_ACHIEVEMENTS/im_glyph_daily_reward.webp',
);
assert.equal(
  resolveScribesIconUrl(alphaRankUp),
  '/UI/04_ACHIEVEMENTS/im_glyph_alphaplayer.webp',
);

const contributorRankUp = achievementUnlockedEvent(
  'player-a',
  CONTRIBUTOR_ACHIEVEMENT_ID,
  'Benefactor',
);
assert.equal(
  resolveScribesIconUrl(contributorRankUp),
  '/UI/04_ACHIEVEMENTS/im_glyph_donator.webp',
);

const blessedRankUp = achievementUnlockedEvent(
  'player-a',
  BLESSED_ACHIEVEMENT_ID,
  'Favored',
);
assert.equal(
  resolveScribesIconUrl(blessedRankUp),
  '/UI/04_ACHIEVEMENTS/im_glyph_lucker.webp',
);

const combatantRankUp = achievementUnlockedEvent(
  'player-a',
  COMBATANT_ACHIEVEMENT_ID,
  'Warbound',
);
assert.equal(
  resolveScribesIconUrl(combatantRankUp),
  '/UI/04_ACHIEVEMENTS/im_glyph_combatant.webp',
);

const gemsDonated = {
  eventId: 'donate-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  type: 'gems_donated',
  visibility: 'global' as const,
  importance: 'high' as const,
  payload: {
    playerName: 'Babuni',
    amount: 50,
    currencyType: 'yellow_red_gem',
    source: 'credits_donate',
  },
};

assert.equal(isVisibleInScribesFeed(gemsDonated, 'player-a'), true);
assert.equal(
  renderEventMessage(gemsDonated),
  'Babuni donated 50 yellow red gems to the team.',
);

const prosperityTriumph = {
  eventId: 'triumph-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  type: 'encounter_resolved',
  visibility: 'global' as const,
  importance: 'medium' as const,
  payload: {
    avatarName: 'Babuni',
    encounterTitle: 'Frozen Pass',
    outcome: 'Prosperity',
    success: true,
    rewardNames: ['Iron Blade', 'Soul Essence'],
    rewardIconName: 'im_solution_iron_blade',
  },
};

assert.equal(
  renderEventMessage(prosperityTriumph),
  'Babuni triumphed over Frozen Pass. Rewards: Iron Blade, Soul Essence.',
);
assert.equal(
  resolveScribesIconUrl(prosperityTriumph),
  '/game/solutionimages/im_solution_iron_blade.webp',
);

const atranorPendingDeath = {
  eventId: 'death-pending-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  avatarId: 'avatar-a',
  type: 'avatar_died',
  visibility: 'global' as const,
  importance: 'legendary' as const,
  payload: {
    avatarName: 'Lyra',
    encounterId: 42,
    encounterTitle: 'Frozen Pass',
    pendingDeathEncounter: true,
    symbolIconName: 'tool_epic_atranor_potion',
  },
};

assert.equal(
  renderEventMessage(atranorPendingDeath),
  'Lyra entered Atranor. The gods decide their fate',
);
assert.equal(
  resolveScribesIconUrl(atranorPendingDeath),
  '/game/solutionimages/tool_epic_atranor_potion.webp',
);

const actualAvatarDeath = {
  eventId: 'death-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  avatarId: 'avatar-a',
  type: 'avatar_died',
  visibility: 'global' as const,
  importance: 'legendary' as const,
  payload: {
    avatarName: 'Lyra',
    encounterId: 1,
    encounterTitle: 'Atranor',
    symbolIconName: 'tool_epic_atranor_potion',
    actualDeath: true,
  },
};

assert.equal(
  renderEventMessage(actualAvatarDeath),
  "Lyra didn't receive the blessing of the gods.",
);
assert.equal(
  resolveScribesIconUrl(actualAvatarDeath),
  '/UI/09_GAME/im_overlay_death.webp',
);

const hearthBlessingReady = {
  eventId: 'hearth-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  type: 'hearth_blessing_ready',
  visibility: 'global' as const,
  importance: 'high' as const,
  payload: {
    playerName: 'Babuni',
    utcDay: '2026-05-24',
    encountersRequired: 42,
  },
};

assert.equal(isVisibleInScribesFeed(hearthBlessingReady, 'player-a'), true);
assert.equal(isVisibleInScribesFeed(hearthBlessingReady, 'player-b'), false);
assert.equal(
  renderEventMessage(hearthBlessingReady),
  'Babuni filled the Hearth Blessing (42 encounters). It is ready to claim.',
);
assert.equal(
  resolveScribesIconUrl(hearthBlessingReady),
  '/UI/03_DASHBOARD/im_gems.webp',
);

const accountKeyReminder = {
  eventId: 'key-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  type: 'account_key_security_reminder',
  visibility: 'private' as const,
  importance: 'high' as const,
  payload: {
    playerName: 'Babuni',
    recoveryKeyFilename: 'Morkahja_Babuni.key',
    itemLabel: 'Keldor',
  },
};

assert.equal(isVisibleInScribesFeed(accountKeyReminder, 'player-a'), true);
assert.equal(isVisibleInScribesFeed(accountKeyReminder, 'player-b'), false);
assert.equal(
  renderEventMessage(accountKeyReminder),
  'Keep your account key safe. You just unlocked Keldor. Back up Morkahja_Babuni.key somewhere secure — losing it means permanent loss of access.',
);
assert.equal(
  resolveScribesIconUrl(accountKeyReminder),
  '/UI/03_DASHBOARD/im_button_setting_b.webp',
);

const supportNudge = {
  eventId: 'support-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  type: 'support_appreciation_nudge',
  visibility: 'private' as const,
  importance: 'medium' as const,
  payload: {
    playerName: 'Babuni',
    utcDay: '2026-05-24',
  },
};

assert.equal(isVisibleInScribesFeed(supportNudge, 'player-a'), true);
assert.equal(
  renderEventMessage(supportNudge),
  'If you\'re enjoying Morkahja, consider supporting us — donate gems, unlock an expansion, or pick up a dice skin. We\'d be super happy!',
);

const encounterFailed = {
  eventId: 'fail-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  avatarId: 'avatar-a',
  type: 'encounter_failed',
  visibility: 'global' as const,
  importance: 'medium' as const,
  payload: {
    avatarName: 'Lyra',
    encounterTitle: 'Frozen Pass',
    outcome: 'Misery',
    success: false,
  },
};

assert.equal(
  renderEventMessage(encounterFailed),
  'Lyra failed against Frozen Pass.',
);
assert.equal(
  resolveScribesIconUrl(encounterFailed),
  '/UI/06_SettingsMenu/No.webp',
);

const roomCreated = {
  eventId: 'room-created-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  avatarId: 'avatar-a',
  type: 'room_created',
  visibility: 'friends' as const,
  importance: 'low' as const,
  payload: {
    avatarName: 'Lyra',
    encounterTitle: 'Frozen Pass',
    encounterId: 12,
    roomId: 'room-1',
  },
};

assert.equal(
  renderEventMessage(roomCreated),
  'Lyra encounters Frozen Pass.',
);

const roomEncounterStarted = {
  ...roomCreated,
  eventId: 'room-started-1',
  type: 'room_encounter_started',
  visibility: 'global' as const,
};

assert.equal(
  renderEventMessage(roomEncounterStarted),
  'Lyra encounters Frozen Pass.',
);

const helpRequested = {
  eventId: 'help-1',
  timestamp: Date.now(),
  playerId: 'player-a',
  type: 'help_requested',
  visibility: 'friends' as const,
  importance: 'high' as const,
  payload: {
    avatarName: 'Lyra',
    playerName: 'AccountName',
    toPlayerId: 'player-b',
    roomId: 'room-1',
    inviteId: 'invite-1',
  },
};

assert.equal(
  renderEventMessage(helpRequested),
  'Lyra calls out for help.',
);
assert.equal(isVisibleInScribesFeed(helpRequested, 'player-b'), true);
assert.equal(isVisibleInScribesFeed(helpRequested, 'player-a'), false);
assert.equal(isVisibleInScribesFeed(roomEncounterStarted, 'player-b'), true);

const levelUpFriends = {
  eventId: 'level-up-2',
  timestamp: Date.now(),
  playerId: 'player-a',
  avatarId: 'avatar-a',
  type: 'level_up',
  visibility: 'friends' as const,
  importance: 'high' as const,
  payload: {
    avatarName: 'Lyra',
    level: 2,
  },
};

assert.equal(
  renderEventMessage(levelUpFriends),
  'Lyra reached level 2.',
);
assert.equal(levelUpScribeVisibility(2), 'friends');
assert.equal(levelUpScribeVisibility(5), 'global');
assert.equal(isVisibleInScribesFeed(levelUpFriends, 'player-a'), true);

const levelUpMilestone = {
  ...levelUpFriends,
  eventId: 'level-up-5',
  visibility: 'global' as const,
  payload: {
    avatarName: 'Lyra',
    level: 5,
  },
};

assert.equal(
  renderEventMessage(levelUpMilestone),
  'Lyra reached level 5.',
);
assert.equal(isVisibleInScribesFeed(levelUpMilestone, 'player-b'), true);

console.log('achievementScribes.test.ts passed');
