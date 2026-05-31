/**
 * Create the Morkahja commerce catalog (products + EUR prices) in Stripe and
 * print a ready-to-paste `prices` block for Key.js.
 *
 * Usage (from the server folder):
 *   npm run stripe:test-catalog
 *
 * The secret key is read from STRIPE_SECRET_KEY, or from the `stripe.secretKey`
 * export in the repo-root Key.js. Use a TEST key (sk_test_... / rk_test_...) to
 * create test-mode prices.
 */
import Stripe from 'stripe';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.resolve(here, '../../Key.js');

async function resolveSecretKey() {
  if (process.env.STRIPE_SECRET_KEY?.trim()) {
    return process.env.STRIPE_SECRET_KEY.trim();
  }

  if (existsSync(keyPath)) {
    const keyModule = await import(pathToFileURL(keyPath).href);
    const fromKey = keyModule.stripe?.secretKey;
    if (typeof fromKey === 'string' && fromKey.trim()) {
      return fromKey.trim();
    }
  }

  return null;
}

// priceKey -> { name, description, amount (EUR cents) }
const CATALOG = [
  ['expansion_1004', 'Morkahja \u2014 Aetherion Expansion', 'Unlock Aetherion: access to the City and its encounters.', 199],
  ['expansion_1003', 'Morkahja \u2014 Everwinter Valley Expansion', 'Unlock Everwinter Valley: 20+ unique encounters, items and skills.', 299],
  ['expansion_1001', 'Morkahja \u2014 The Cursed Forest of Keldor Expansion', 'Unlock The Cursed Forest of Keldor: 40+ unique encounters, items and skills.', 399],
  ['expansion_1002', 'Morkahja \u2014 Urcogor Ravage Expansion', 'Unlock Urcogor Ravage: 30+ unique encounters, items and skills.', 299],
  ['dice_single', 'Morkahja \u2014 Dice Skin', 'Unlock a cosmetic dice skin of your choice.', 149],
  ['bundle_expansions_all', 'Morkahja \u2014 All Expansions Bundle', 'Unlock all active expansions.', 799],
  ['bundle_dice_all', 'Morkahja \u2014 All Dice Skins Bundle', 'Unlock all five cosmetic dice skins.', 499],
  ['bundle_complete', 'Morkahja \u2014 Complete Collection Bundle', 'Unlock all active expansions and all five dice skins.', 1199],
];

async function main() {
  const secretKey = await resolveSecretKey();
  if (!secretKey) {
    console.error('No Stripe secret key found. Set STRIPE_SECRET_KEY or stripe.secretKey in Key.js.');
    process.exitCode = 1;
    return;
  }

  const isTest = secretKey.includes('_test_');
  const stripe = new Stripe(secretKey);
  console.log(`Creating catalog in ${isTest ? 'TEST' : 'LIVE'} mode...`);

  const results = {};
  for (const [priceKey, name, description, amount] of CATALOG) {
    const product = await stripe.products.create({ name, description });
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'eur',
      unit_amount: amount,
    });
    results[priceKey] = price.id;
    console.log(`  ${priceKey.padEnd(22)} ${price.id}  (EUR ${(amount / 100).toFixed(2)})`);
  }

  console.log('\nPaste this into the `prices` block of Key.js:\n');
  console.log('  prices: {');
  for (const [priceKey, priceId] of Object.entries(results)) {
    console.log(`    ${priceKey}: '${priceId}',`);
  }
  console.log('  },');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
