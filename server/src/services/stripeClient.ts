import Stripe from 'stripe';
import { getStripeSecretKey } from '../config/stripeConfig.js';

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured (missing STRIPE_SECRET_KEY)');
    this.name = 'StripeNotConfiguredError';
  }
}

let client: Stripe | null = null;

/**
 * Lazily build a single Stripe client. The API version is intentionally left
 * unset so the SDK uses its pinned default; payment methods are configured
 * dynamically from the Stripe Dashboard.
 */
export function getStripeClient(): Stripe {
  if (client) {
    return client;
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new StripeNotConfiguredError();
  }

  client = new Stripe(secretKey, {
    appInfo: { name: 'Morkahja', version: '0.9.0-beta.2' },
  });

  return client;
}
