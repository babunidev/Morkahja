/**
 * Express `trust proxy` setting.
 *
 * In production Nginx forwards `/Morkahja/api/*` to Express on 127.0.0.1, so
 * without this setting every player appears as the proxy's address and the
 * per-IP auth/heartbeat rate limit becomes one shared bucket for all players.
 *
 * Default `loopback`: honour `X-Forwarded-For` only when the direct peer is
 * 127.0.0.1/::1 (a same-host proxy). A client connecting directly from
 * elsewhere cannot spoof its address this way.
 *
 * Override with `TRUST_PROXY` (comma-separated addresses, subnets, or the
 * Express names `loopback`, `linklocal`, `uniquelocal`) when the proxy runs on
 * another host, or `TRUST_PROXY=false` to disable.
 */
export function resolveTrustProxySetting(value: string | undefined): string | false {
  const trimmed = value?.trim();

  if (!trimmed) {
    return 'loopback';
  }

  if (trimmed.toLowerCase() === 'false') {
    return false;
  }

  return trimmed;
}
