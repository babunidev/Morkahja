/** Format an amount of EUR cents as a display string, e.g. 399 -> "€3.99". */
export function formatEurCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}
