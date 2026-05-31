import { getCatalogEntry } from '../domain/commerce/catalog.js';
import { getClientReturnUrl, getPriceId } from '../config/stripeConfig.js';
import { getStripeClient } from './stripeClient.js';

export class UnknownSkuError extends Error {
  constructor(sku: string) {
    super(`Unknown SKU: ${sku}`);
    this.name = 'UnknownSkuError';
  }
}

export class PriceUnavailableError extends Error {
  constructor(sku: string) {
    super(`No Stripe price configured for SKU: ${sku}`);
    this.name = 'PriceUnavailableError';
  }
}

/**
 * Create a Stripe-hosted Checkout Session for a one-time purchase. The player
 * id and SKU are stored in metadata so the webhook can grant the unlock after
 * payment. Payment methods are dynamic (configured from the Dashboard), so we
 * never pass payment_method_types.
 */
export async function createCheckoutSession(
  playerId: string,
  sku: string,
): Promise<{ url: string }> {
  const entry = getCatalogEntry(sku);
  if (!entry) {
    throw new UnknownSkuError(sku);
  }

  const priceId = getPriceId(entry.priceKey);
  if (!priceId) {
    throw new PriceUnavailableError(sku);
  }

  const stripe = getStripeClient();
  const returnUrl = getClientReturnUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: playerId,
    metadata: { playerId, sku },
    success_url: `${returnUrl}/?purchase=success&sku=${encodeURIComponent(sku)}`,
    cancel_url: `${returnUrl}/?purchase=cancel`,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a Checkout URL');
  }

  return { url: session.url };
}
