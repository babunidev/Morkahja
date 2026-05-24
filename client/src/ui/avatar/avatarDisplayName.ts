export function readAvatarDisplayTitle(
  avatar: { displayTitle?: string | null; profile?: { displayTitle?: unknown } },
): string | null {
  if (typeof avatar.displayTitle === 'string') {
    const trimmed = avatar.displayTitle.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const profileTitle = avatar.profile?.displayTitle;
  if (typeof profileTitle === 'string') {
    const trimmed = profileTitle.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

export function normalizePersistedAvatar<T extends {
  displayTitle?: string | null;
  profile?: { displayTitle?: unknown };
}>(avatar: T): T {
  return {
    ...avatar,
    displayTitle: readAvatarDisplayTitle(avatar),
  };
}

export function formatAvatarDisplayName(avatar: {
  name: string;
  displayTitle?: string | null;
  profile?: { displayTitle?: unknown };
}): string {
  const baseName = avatar.name.trim() || 'Adventurer';
  const title = readAvatarDisplayTitle(avatar) ?? '';

  if (title.length === 0) {
    return baseName;
  }

  return `${title} ${baseName}`;
}
