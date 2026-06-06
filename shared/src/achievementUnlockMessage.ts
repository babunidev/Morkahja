export function normalizeAchievementRankTitle(rankTitle: string | undefined): string {
  const normalized = rankTitle?.trim();
  return normalized && normalized.length > 0 ? normalized : 'New Rank';
}

export function formatAchievementUnlockMessage(
  rankTitle: string | undefined,
  audience: 'self' | 'public',
  playerName?: string,
): string {
  const title = normalizeAchievementRankTitle(rankTitle);
  const quotedTitle = `"${title}"`;

  if (audience === 'self') {
    return `You unlocked the ${quotedTitle} achievement. Congrats!`;
  }

  const name = playerName?.trim() || 'Player';
  return `${name} unlocked the ${quotedTitle} achievement.`;
}
