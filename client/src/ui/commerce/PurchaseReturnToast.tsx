import { useEffect, useState } from 'react';
import { fetchPlayer } from '../../api/http.js';
import GameMessageToast from '../game/GameMessageToast.js';

const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1_200;

/**
 * Handles the redirect back from Stripe Checkout. On `?purchase=success` it
 * warms the player record (the unlock is granted asynchronously by the
 * webhook) and shows a confirmation toast. On `?purchase=cancel` it silently
 * clears the URL. Rendered once at the app root, independent of screen.
 */
export function PurchaseReturnToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');

    if (!purchase) {
      return;
    }

    params.delete('purchase');
    params.delete('sku');
    const query = params.toString();
    const cleanedUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanedUrl);

    if (purchase !== 'success') {
      return;
    }

    let cancelled = false;
    setMessage('Purchase complete! Your unlock will appear shortly.');

    void (async () => {
      for (let attempt = 0; attempt < POLL_ATTEMPTS && !cancelled; attempt += 1) {
        try {
          await fetchPlayer(null);
        } catch {
          // Ignore transient errors; the unlock still applies server-side.
        }

        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!message) {
    return null;
  }

  return (
    <GameMessageToast
      label="Purchase"
      message={message}
      onDismiss={() => {
        setMessage(null);
      }}
    />
  );
}

export default PurchaseReturnToast;
