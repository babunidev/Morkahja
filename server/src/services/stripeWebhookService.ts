import type Stripe from 'stripe';
import { getStripeWebhookSecret } from '../config/stripeConfig.js';
import { getCatalogEntry } from '../domain/commerce/catalog.js';
import { claimStripeEvent, recordPurchase } from '../db/commerceStore.js';
import { getStripeClient } from './stripeClient.js';

export class WebhookNotConfiguredError extends Error {
  constructor() {
    super('Stripe webhook secret is not configured (missing STRIPE_WEBHOOK_SECRET)');
    this.name = 'WebhookNotConfiguredError';
  }
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/**
 * Verify the Stripe signature, then handle the event. Currently only
 * `checkout.session.completed` grants unlocks. Grants are idempotent and the
 * event id is claimed atomically, so duplicate deliveries are safe.
 */
export async function handleStripeWebhook(
  rawBody: Buffer | string,
  signature: string | undefined,
): Promise<{ received: true }> {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    throw new WebhookNotConfiguredError();
  }

  if (!signature) {
    throw new WebhookSignatureError('Missing stripe-signature header');
  }

  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    throw new WebhookSignatureError(
      error instanceof Error ? error.message : 'Invalid webhook signature',
    );
  }

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event);
  }

  return { received: true };
}

async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Only fulfill once payment has actually succeeded.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return;
  }

  const playerId = session.metadata?.playerId ?? session.client_reference_id ?? null;
  const sku = session.metadata?.sku ?? null;

  if (!playerId || !sku) {
    console.error('Stripe checkout.session.completed missing playerId/sku metadata', {
      eventId: event.id,
      sessionId: session.id,
    });
    return;
  }

  const entry = getCatalogEntry(sku);
  if (!entry) {
    console.error('Stripe checkout.session.completed for unknown SKU', {
      eventId: event.id,
      sku,
    });
    return;
  }

  // Claim the event id first; if already claimed, this delivery is a duplicate.
  const isFirstDelivery = await claimStripeEvent(event.id);
  if (!isFirstDelivery) {
    return;
  }

  await entry.grant(playerId);
  await recordPurchase({
    id: session.id,
    eventId: event.id,
    playerId,
    sku,
    amountTotal: typeof session.amount_total === 'number' ? session.amount_total : null,
    currency: session.currency ?? null,
  });
}
