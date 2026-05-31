import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Stripe configuration loader.
 *
 * Secrets and price IDs are read from environment variables. For local
 * development they may also be provided by the gitignored `Key.js` at the
 * repo root (same mechanism the database config uses), via an optional
 * `stripe` export:
 *
 *   export const stripe = {
 *     secretKey: 'rk_test_...',        // restricted key recommended
 *     webhookSecret: 'whsec_...',
 *     clientUrl: 'http://localhost:5173',
 *     prices: { expansion_1001: 'price_...', dice_single: 'price_...' },
 *   };
 *
 * In production, set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / CLIENT_URL
 * (and optionally per-SKU STRIPE_PRICE_* overrides) as real environment
 * variables. Never commit secret keys.
 */

export const PRICE_KEYS = [
  'expansion_1001',
  'expansion_1002',
  'expansion_1003',
  'expansion_1004',
  'dice_single',
  'bundle_expansions_all',
  'bundle_dice_all',
  'bundle_complete',
] as const;

export type PriceKey = (typeof PRICE_KEYS)[number];

/**
 * Live-mode Stripe Price IDs created for this account (EUR). These are not
 * secret. They are used as defaults so production works out of the box; any
 * entry can be overridden with STRIPE_PRICE_<KEY> (e.g. to point at test-mode
 * price IDs when running with test keys).
 */
const DEFAULT_LIVE_PRICE_IDS: Record<PriceKey, string> = {
  expansion_1004: 'price_1TdCoWDCrMHQh4eQmucAku7C', // Aetherion — EUR 1.99
  expansion_1003: 'price_1TdCoXDCrMHQh4eQHMIejNvI', // Everwinter — EUR 2.99
  expansion_1001: 'price_1TdCoYDCrMHQh4eQt5eccifv', // Keldor — EUR 3.99
  expansion_1002: 'price_1TdCoZDCrMHQh4eQVwBZlGtI', // Urcogor — EUR 2.99
  dice_single: 'price_1TdCoaDCrMHQh4eQxGqX89Sa', // Any dice skin — EUR 1.49
  bundle_expansions_all: 'price_1TdCobDCrMHQh4eQMJfsDVFe', // All expansions — EUR 7.99
  bundle_dice_all: 'price_1TdCocDCrMHQh4eQQa0INhVU', // All dice skins — EUR 4.99
  bundle_complete: 'price_1TdCodDCrMHQh4eQtzaWVJGg', // Complete collection — EUR 11.99
};

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const keyPath = path.join(repoRoot, 'Key.js');
const isProduction = process.env.NODE_ENV === 'production';

function setEnvIfUnset(name: string, value: unknown): void {
  if (typeof value === 'string' && value.trim() && !process.env[name]?.trim()) {
    process.env[name] = value;
  }
}

// Local-dev convenience: hydrate Stripe env from Key.js when present.
if (!isProduction && existsSync(keyPath)) {
  const keyModule = await import(pathToFileURL(keyPath).href);
  const stripeConfig = keyModule.stripe as
    | {
        secretKey?: string;
        webhookSecret?: string;
        clientUrl?: string;
        prices?: Partial<Record<PriceKey, string>>;
      }
    | undefined;

  if (stripeConfig) {
    setEnvIfUnset('STRIPE_SECRET_KEY', stripeConfig.secretKey);
    setEnvIfUnset('STRIPE_WEBHOOK_SECRET', stripeConfig.webhookSecret);
    setEnvIfUnset('CLIENT_URL', stripeConfig.clientUrl);

    for (const [priceKey, priceId] of Object.entries(stripeConfig.prices ?? {})) {
      setEnvIfUnset(`STRIPE_PRICE_${priceKey.toUpperCase()}`, priceId);
    }
  }
}

export function getStripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/** Origin the player returns to after Checkout (success/cancel redirects). */
export function getClientReturnUrl(): string {
  const explicit = process.env.CLIENT_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const firstOrigin = process.env.CLIENT_ORIGINS?.split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);

  return (firstOrigin ?? 'http://localhost:5173').replace(/\/+$/, '');
}

export function getPriceId(priceKey: PriceKey): string | null {
  const override = process.env[`STRIPE_PRICE_${priceKey.toUpperCase()}`]?.trim();
  return override || DEFAULT_LIVE_PRICE_IDS[priceKey] || null;
}

export function isStripeConfigured(): boolean {
  return getStripeSecretKey() !== null;
}
