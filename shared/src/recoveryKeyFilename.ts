export function recoveryKeyFilename(playerName: string): string {
  const sanitized = playerName
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64);

  const username = sanitized.length > 0 ? sanitized : 'Adventurer';
  return `Morkahja_${username}.key`;
}
