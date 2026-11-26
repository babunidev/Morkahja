import { useEffect, useRef, useState } from 'react';
import { createSoulLink } from '../../api/http.js';
import GameMessageToast from '../game/GameMessageToast.js';

/** Query parameter carried by the Soul Link QR code: `?soul=<inviter player id>`. */
export const SOUL_LINK_INVITE_PARAM = 'soul';
const PENDING_INVITE_STORAGE = 'morkahja.pendingSoulLinkInvite';

/** The link a Soul Link QR code opens: the game, with the inviter's player id. */
export function soulLinkInviteUrl(playerId: string): string {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set(SOUL_LINK_INVITE_PARAM, playerId);
  return url.toString();
}

function readPendingInvite(): string | null {
  try {
    return window.localStorage.getItem(PENDING_INVITE_STORAGE);
  } catch {
    return null;
  }
}

function clearPendingInvite(): void {
  try {
    window.localStorage.removeItem(PENDING_INVITE_STORAGE);
  } catch {
    // Nothing stored.
  }
}

/**
 * Runs once when the game opens: remembers the inviter from `?soul=` until the
 * player has logged in (a new player first creates their account), and removes
 * the parameter from the address bar.
 */
function captureSoulLinkInvite(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const inviter = params.get(SOUL_LINK_INVITE_PARAM)?.trim();
  if (!inviter) {
    return;
  }
  try {
    window.localStorage.setItem(PENDING_INVITE_STORAGE, inviter);
  } catch {
    // Without storage the invite still works in this tab via the state below.
  }
  capturedInThisTab = inviter;
  params.delete(SOUL_LINK_INVITE_PARAM);
  const query = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
  );
}

let capturedInThisTab: string | null = null;
captureSoulLinkInvite();

/** The inviter of a Soul Link link this browser opened, until it is applied (D-068). */
export function pendingSoulLinkInviter(): string | null {
  return readPendingInvite() ?? capturedInThisTab;
}

/**
 * Applies a pending QR invite as soon as a logged-in player reaches the main
 * menu or the game: links their soul to the inviter and makes them friends both
 * ways. A player who already chose a soul link keeps it; the invite is dropped.
 */
export function SoulLinkInviteJoin({ playerId, ready }: { playerId: string; ready: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!ready || !playerId || attemptedRef.current) {
      return;
    }
    const inviter = readPendingInvite() ?? capturedInThisTab;
    if (!inviter) {
      return;
    }
    attemptedRef.current = true;
    capturedInThisTab = null;
    if (inviter === playerId) {
      clearPendingInvite();
      return;
    }

    void createSoulLink(inviter, { invite: true })
      .then((result) => {
        clearPendingInvite();
        setMessage(`Your soul is linked to ${result.soulLink.targetName}. You are friends now. On the first day you both play 42 encounters, Aetherion opens for you.`);
      })
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : '';
        // Already linked, unknown inviter or self: the invite cannot apply, drop it.
        if (/SOUL_LINK_ALREADY_SET|PLAYER_NOT_FOUND|CANNOT_SOUL_LINK_SELF/.test(text)) {
          clearPendingInvite();
          return;
        }
        // Network trouble: keep it for the next start.
        attemptedRef.current = false;
        console.error('Soul link invite failed', error);
      });
  }, [playerId, ready]);

  if (!message) {
    return null;
  }

  return (
    <GameMessageToast
      label="Soul Link"
      message={message}
      onDismiss={() => {
        setMessage(null);
      }}
    />
  );
}

export default SoulLinkInviteJoin;
