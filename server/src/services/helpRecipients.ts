import { HELP_RECIPIENT_LIMIT } from '../domain/rooms/roomConstants.js';

function shuffleIds(ids: readonly string[], random: () => number): string[] {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex] ?? current;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

/**
 * Up to {@link HELP_RECIPIENT_LIMIT} recipients. Friends fill the places first.
 * Anyone still free is chosen at random for the places friends did not take.
 */
export function chooseHelpRecipientIds(
  friendIds: readonly string[],
  strangerIds: readonly string[],
  random: () => number = Math.random,
  limit: number = HELP_RECIPIENT_LIMIT,
): { friendIds: string[]; strangerIds: string[] } {
  const friends = shuffleIds(friendIds, random).slice(0, Math.max(0, limit));
  const strangers = shuffleIds(strangerIds, random).slice(0, Math.max(0, limit - friends.length));
  return { friendIds: friends, strangerIds: strangers };
}
