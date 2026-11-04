import type Stripe from 'stripe';
import { getStripeWebhookSecret } from '../config/stripeConfig.js';
import { getCatalogEntry } from '../domain/commerce/catalog.js';
import { fulfillStripePurchase } from '../db/commerceStore.js';
import { recordSupportPurchaseEvent } from './gameEventService.js';
import { recordAccountKeySecurityReminder } from './privateScribeService.js';
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
 * paid checkout events grant entitlements atomically with purchase/event claims,
 * deduplicated by checkout session rather than event id alone.
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

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
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

  if (session.mode !== 'payment') {
    return;
  }

  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : null;
  const currency = session.currency ?? null;
  const newlyFulfilled = await fulfillStripePurchase({
    id: session.id,
    eventId: event.id,
    playerId,
    sku,
    amountTotal,
    currency,
  }, (transaction) => entry.grant(playerId, transaction));
  if (!newlyFulfilled) {
    return;
  }

  // Optional Scribes run after the entitlement transaction commits.
  // They must not trigger a second payment fulfillment when they fail.
  try {
    await recordSupportPurchaseEvent(playerId, {
      sku,
      itemLabel: entry.label,
      amountTotal,
      currency,
    });
    await recordAccountKeySecurityReminder(playerId, { itemLabel: entry.label });
  } catch (error) {
    console.error('Failed to record support_purchase scribe', {
      eventId: event.id,
      sku,
      error,
    });
  }
}
