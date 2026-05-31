import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  PriceUnavailableError,
  UnknownSkuError,
  createCheckoutSession,
} from '../services/checkoutService.js';
import { StripeNotConfiguredError } from '../services/stripeClient.js';
import {
  WebhookNotConfiguredError,
  WebhookSignatureError,
  handleStripeWebhook,
} from '../services/stripeWebhookService.js';

export async function createCheckoutSessionController(
  req: Request,
  res: Response,
): Promise<void> {
  const { playerId } = requireAuth(req);
  const body = req.body as Record<string, unknown>;
  const sku = body.sku;

  if (typeof sku !== 'string' || sku.trim().length === 0) {
    res.status(400).json({ error: 'INVALID_SKU' });
    return;
  }

  try {
    const result = await createCheckoutSession(playerId, sku.trim());
    res.json({ url: result.url });
  } catch (error) {
    if (error instanceof UnknownSkuError) {
      res.status(404).json({ error: 'UNKNOWN_SKU' });
      return;
    }

    if (error instanceof StripeNotConfiguredError || error instanceof PriceUnavailableError) {
      res.status(503).json({ error: 'PURCHASES_UNAVAILABLE' });
      return;
    }

    throw error;
  }
}

export async function stripeWebhookController(
  req: Request,
  res: Response,
): Promise<void> {
  const signature = req.headers['stripe-signature'];
  const signatureValue = Array.isArray(signature) ? signature[0] : signature;

  try {
    const result = await handleStripeWebhook(req.body as Buffer, signatureValue);
    res.json(result);
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      res.status(400).json({ error: 'INVALID_SIGNATURE' });
      return;
    }

    if (error instanceof WebhookNotConfiguredError) {
      res.status(503).json({ error: 'WEBHOOK_NOT_CONFIGURED' });
      return;
    }

    // Returning 500 lets Stripe retry delivery.
    console.error('Stripe webhook handling failed', error);
    res.status(500).json({ error: 'WEBHOOK_ERROR' });
  }
}
