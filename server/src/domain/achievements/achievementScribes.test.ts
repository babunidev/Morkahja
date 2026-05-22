import assert from 'node:assert/strict';
import { ADVENTURER_ACHIEVEMENT_ID } from './adventurerAchievement.js';
import { ALPHA_PLAYER_ACHIEVEMENT_ID } from './alphaPlayerAchievement.js';
import { CONTRIBUTOR_ACHIEVEMENT_ID } from './contributorAchievement.js';
import { BLESSED_ACHIEVEMENT_ID } from './blessedAchievement.js';
import { COMBATANT_ACHIEVEMENT_ID } from './encounterSolveAchievements.js';
import { renderEventMessage } from '../news/renderEventMessage.js';
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
assert.equal(isVisibleInScribesFeed(adventurerRankUp, 'player-b'), false);
assert.equal(
  renderEventMessage(adventurerRankUp),
  'Babuni became an Explorer.',
);
assert.equal(
  renderEventMessage(alphaRankUp),
  'Babuni became a Worldwalker.',
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

console.log('achievementScribes.test.ts passed');
