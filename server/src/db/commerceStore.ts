import { pool, withDocumentTransaction, type DocumentTransaction } from './postgresDocumentStore.js';

let schemaReady: Promise<void> | null = null;

async function ensureCommerceSchema(): Promise<void> {
  schemaReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS processed_stripe_events (
      id text PRIMARY KEY,
      created_at bigint NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id text PRIMARY KEY,
      event_id text NOT NULL,
      player_id text NOT NULL,
      sku text NOT NULL,
      amount_total bigint,
      currency text,
      created_at bigint NOT NULL
    );
  `).then(() => undefined);

  await schemaReady;
}

export interface StripePurchase {
  id: string; // Stripe Checkout Session ID, unique per purchase.
  eventId: string;
  playerId: string;
  sku: string;
  amountTotal: number | null;
  currency: string | null;
}

/**
 * A paid checkout is granted exactly once, including bundles. Payment records,
 * event claims and player unlocks share a transaction; a failed grant rolls
 * everything back, allowing another signed Stripe delivery to retry.
 */
export async function fulfillStripePurchase(
  purchase: StripePurchase,
  grant: (transaction: DocumentTransaction) => Promise<void>,
): Promise<boolean> {
  await ensureCommerceSchema();

  return withDocumentTransaction(async (transaction) => {
    const now = Date.now();
    const purchased = await transaction.query<{ id: string }>(
      `INSERT INTO purchases (id, event_id, player_id, sku, amount_total, currency, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [purchase.id, purchase.eventId, purchase.playerId, purchase.sku,
        purchase.amountTotal, purchase.currency, now],
    );
    if (purchased.rowCount === 0) {
      return false;
    }

    const event = await transaction.query<{ id: string }>(
      `INSERT INTO processed_stripe_events (id, created_at)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [purchase.eventId, now],
    );
    if (event.rowCount === 0) {
      throw new Error('Stripe event already processed for another checkout session');
    }

    await grant(transaction);
    return true;
  });
}
