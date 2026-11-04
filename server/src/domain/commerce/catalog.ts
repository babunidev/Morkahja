import { DICE_IDS, type DiceId } from '@shared/diceCatalog.js';
import { grantPlayerExpansion } from '../../services/playerService.js';
import { grantPlayerDice } from '../../services/diceService.js';
import type { PriceKey } from '../../config/stripeConfig.js';
import type { DocumentTransaction } from '../../db/postgresDocumentStore.js';

/**
 * Commerce catalog: maps each purchasable SKU to the Stripe price it sells at
 * and the server-side grant it performs on a completed payment. Grants never
 * touch gems and are individually idempotent, so applying a bundle twice (or
 * an item already owned) is harmless.
 */
export interface CommerceCatalogEntry {
  sku: string;
  priceKey: PriceKey;
  label: string;
  grant: (playerId: string, transaction?: DocumentTransaction) => Promise<void>;
}

const PAID_DICE_IDS: DiceId[] = DICE_IDS.filter((id) => id !== 'a');

const ACTIVE_EXPANSION_IDS = [1001, 1003, 1004] as const;

async function grantExpansions(playerId: string, ids: readonly number[], transaction?: DocumentTransaction): Promise<void> {
  for (const id of ids) {
    await grantPlayerExpansion(playerId, id, transaction);
  }
}

async function grantDice(playerId: string, ids: readonly DiceId[], transaction?: DocumentTransaction): Promise<void> {
  for (const id of ids) {
    await grantPlayerDice(playerId, id, transaction);
  }
}

const ENTRIES: CommerceCatalogEntry[] = [
  // Expansions (single)
  {
    sku: 'expansion_1001',
    priceKey: 'expansion_1001',
    label: 'The Cursed Forest of Keldor',
    grant: (playerId, transaction) => grantExpansions(playerId, [1001], transaction),
  },
  {
    sku: 'expansion_1002',
    priceKey: 'expansion_1002',
    label: 'Urcogor Ravage',
    grant: (playerId, transaction) => grantExpansions(playerId, [1002], transaction),
  },
  {
    sku: 'expansion_1003',
    priceKey: 'expansion_1003',
    label: 'Everwinter Valley',
    grant: (playerId, transaction) => grantExpansions(playerId, [1003], transaction),
  },
  {
    sku: 'expansion_1004',
    priceKey: 'expansion_1004',
    label: 'Aetherion',
    grant: (playerId, transaction) => grantExpansions(playerId, [1004], transaction),
  },
  // Dice skins (single) — all share one price; the SKU decides which is granted.
  ...PAID_DICE_IDS.map((diceId): CommerceCatalogEntry => ({
    sku: `dice_${diceId}`,
    priceKey: 'dice_single',
    label: `Dice skin ${diceId.toUpperCase()}`,
    grant: (playerId, transaction) => grantDice(playerId, [diceId], transaction),
  })),
  // Bundles
  {
    sku: 'bundle_expansions_all',
    priceKey: 'bundle_expansions_all',
    label: 'All Expansions Bundle',
    grant: (playerId, transaction) => grantExpansions(playerId, ACTIVE_EXPANSION_IDS, transaction),
  },
  {
    sku: 'bundle_dice_all',
    priceKey: 'bundle_dice_all',
    label: 'All Dice Skins Bundle',
    grant: (playerId, transaction) => grantDice(playerId, PAID_DICE_IDS, transaction),
  },
  {
    sku: 'bundle_complete',
    priceKey: 'bundle_complete',
    label: 'Complete Collection Bundle',
    grant: async (playerId, transaction) => {
      await grantExpansions(playerId, ACTIVE_EXPANSION_IDS, transaction);
      await grantDice(playerId, PAID_DICE_IDS, transaction);
    },
  },
];

const CATALOG_BY_SKU = new Map<string, CommerceCatalogEntry>(
  ENTRIES.map((entry) => [entry.sku, entry]),
);

export function getCatalogEntry(sku: string): CommerceCatalogEntry | undefined {
  return CATALOG_BY_SKU.get(sku);
}

export function isKnownSku(sku: string): boolean {
  return CATALOG_BY_SKU.has(sku);
}
