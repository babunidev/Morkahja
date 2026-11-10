/**
 * Base-aware URLs for files in `client/public` (UI art, game art, audio, fonts).
 *
 * Game code and server payloads describe public assets with root-relative
 * paths such as `/UI/09_GAME/im_gems.webp`. When the client is built for a
 * subpath (production: `/Morkahja/`), those strings must be prefixed with
 * Vite's configured base, because Vite does not rewrite strings assembled at
 * runtime. In local development the base is `/`, so paths are unchanged.
 */

const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

function normalizeBase(base: string | undefined): string {
  const trimmed = base?.trim() || '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/**
 * Prefix a root-relative public asset path with `base`.
 *
 * - Absolute URLs (`https:`, `data:`, `blob:`, protocol-relative) are returned unchanged.
 * - Paths that already start with `base` are returned unchanged, so the helper is idempotent.
 * - Relative paths (`UI/x.webp`) are treated as relative to `base`.
 */
export function withBasePath(base: string | undefined, path: string): string {
  if (!path || ABSOLUTE_URL.test(path)) {
    return path;
  }

  const normalizedBase = normalizeBase(base);

  if (normalizedBase !== '/' && (path === normalizedBase.slice(0, -1) || path.startsWith(normalizedBase))) {
    return path;
  }

  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

/** Vite's configured base (`/` in development, `/Morkahja/` in production builds). */
export const PUBLIC_BASE_PATH = normalizeBase(import.meta.env?.BASE_URL);

/** Resolve a root-relative public asset path against the deployed base path. */
export function assetUrl(path: string): string {
  return withBasePath(PUBLIC_BASE_PATH, path);
}
