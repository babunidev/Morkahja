import { pool } from './postgresDocumentStore.js';

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

/**
 * Atomically claim a Stripe event id. Returns true if this is the first time
 * we have seen it (caller should process), false if already processed.
 */
export async function claimStripeEvent(eventId: string): Promise<boolean> {
  await ensureCommerceSchema();
  const result = await pool.query(
    `INSERT INTO processed_stripe_events (id, created_at)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [eventId, Date.now()],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function recordPurchase(input: {
  id: string;
  eventId: string;
  playerId: string;
  sku: string;
  amountTotal: number | null;
  currency: string | null;
}): Promise<void> {
  await ensureCommerceSchema();
  await pool.query(
    `INSERT INTO purchases (id, event_id, player_id, sku, amount_total, currency, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      input.id,
      input.eventId,
      input.playerId,
      input.sku,
      input.amountTotal,
      input.currency,
      Date.now(),
    ],
  );
}
