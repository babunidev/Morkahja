const DEV_CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

function parseOriginList(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Allowed browser origins for CORS.
 *
 * Set `CLIENT_ORIGINS` to a comma-separated list of production URLs, e.g.:
 *   CLIENT_ORIGINS=https://play.morkahja.com,https://www.morkahja.com
 *
 * In non-production, local Vite dev origins are always included.
 */
export function loadAllowedClientOrigins(): Set<string> {
  const origins = new Set(parseOriginList(process.env.CLIENT_ORIGINS));

  if (process.env.NODE_ENV !== 'production') {
    for (const origin of DEV_CLIENT_ORIGINS) {
      origins.add(origin);
    }
  }

  return origins;
}
