import { useEffect, useState, type CSSProperties } from 'react';
import { APP_VERSION } from '../../appVersion.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';

const OVERLAY_FADE_MS = 300;

interface PatchNoteGroup {
  title: string;
  notes: string[];
}

interface PatchRelease {
  id: string;
  version: string;
  period: string;
  /** Flat bullets when there are no topic groups. */
  notes?: string[];
  /** Topic groups for larger releases. */
  groups?: PatchNoteGroup[];
}

/** Newest release first; oldest last. */
const PATCH_RELEASES: PatchRelease[] = [
  {
    id: 'beta-2-2-jun-9',
    version: '0.9.10-beta.2.2',
    period: '9 Jun 2026',
    notes: [
      'Room-only play — entering the game always goes through a party room; no separate solo encounter path.',
      'Leave = Continue — leaving after a choice commits your inventory, XP, and events; disconnecting no longer dodges bad outcomes.',
      'Party rejoin — same encounter restores your result summary; if the party advanced while you were away, you join fresh on the current encounter.',
      'Death & Continue — Misery/Hardship death waits for Continue before the death overlay; fixes broken Continue and “No active room” toasts.',
      'Solo checkpoints — leaving a solo room parks progress after commit; Play restores where you left off.',
      'Sacrifice & Hall of Fame — failed avatars can sacrifice for gems or enter the Hall of Fame; deceased avatars use finalize-death instead of delete.',
      'Party roll badges — choice badges show the revealed d20 roll on portrait icons.',
    ],
  },
  {
    id: 'beta-2-1-jun-6-7',
    version: '0.9.0-beta.2.1',
    period: '6–7 Jun 2026',
    notes: [
      'Solution charges — using a solution now costs charges based on encounter difficulty; tooltips show when your inventory is short.',
      'Witness events — allies see the actor’s real roll and rewards on level-up and Atranor; outcomes wait for Continue.',
      'Fate label — the middle roll tier displays as Fate (same mechanics as before).',
      'Party choice badges — dice, solution, or focus icons on portraits when a player is ready (with hover details).',
      'Level-up fixes — no double level-ups; inventory stays correct when a party moves into a level-up encounter.',
      'Smoother party transitions — normal encounters and system events share the same fade flow.',
      'Level-up sound plays once when a party level-up event appears.',
      'Encounter tooltips on side party slots render above center portraits and the reward block.',
    ],
  },
  {
    id: 'beta-2-late-may-jun',
    version: '0.9.0-beta.2',
    period: 'late May – 2 Jun 2026',
    groups: [
      {
        title: 'Multiplayer',
        notes: [
          'Encounter rooms for up to 3 players — shared encounters, choices, and Continue.',
          'Call for help — invite friends or other online players into your room.',
          'Witness events — level-ups and Atranor visible to everyone in the room, not only the roller.',
          'Party slots show who’s ready; improved join toasts and “waiting for party” flow.',
          'Lore gems can be earned for the whole party in a room.',
          'Soul Link — permanently link your account to one Adventurer; Spiritguide achievement chain.',
        ],
      },
      {
        title: 'Shop & support',
        notes: [
          'Dice skins — unlock account-wide styles for your dice.',
          'Expansions shop UI refreshed.',
          'Stripe checkout for expansions and dice skins (optional; gems gameplay unchanged).',
          'PayPal donation link still in About Us.',
        ],
      },
      {
        title: 'UI & gameplay',
        notes: [
          'Clearer result screen and reward fly animations.',
          'Tooltips improved on touch; inventory and skillbook less likely to block taps.',
          'Larger encounter titles; updated dice art.',
          'Tooltips hide when the result layer is showing.',
          'Privacy and Terms on signup.',
        ],
      },
      {
        title: 'Progression & social',
        notes: [
          'Daily rewards consider progress across achievement chains.',
          'Scribes toasts for achievements; better lines for room joins and help.',
          'Firestarter progress shows in Scribes.',
        ],
      },
      {
        title: 'Content',
        notes: [
          'Many new encounters and art (forests, meadows, mountains, Everwinter, Verdani, Liani, Ashen Revenant, and more).',
        ],
      },
      {
        title: 'Removed',
        notes: [
          'Seal of Norghor subscription removed from beta. Expansions unlock with gems as before.',
        ],
      },
      {
        title: 'Fixes',
        notes: [
          'Solo rooms no longer spam odd toasts.',
          'Party Continue and ally choices sync more reliably.',
          'Various room join, help, and server stability fixes.',
        ],
      },
    ],
  },
  {
    id: 'beta-1',
    version: '0.9.0-beta.1',
    period: '26 May 2026',
    notes: [
      'Public beta — first tagged beta release on https://arcanitebrothers.com.',
      'Encounter rooms foundation — up to 3 players, server-backed party state, call for help.',
    ],
  },
];

const FOOTER_NOTE =
  'You’re playing the public beta. More updates soon — thank you for testing Morkahja.';

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 8,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.72)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  width: 'min(92vw, 420px)',
  maxHeight: 'min(86vh, 640px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: 12,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  ...protectedOverlayTextStyle,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleGroupStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.45rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.62)',
  fontSize: '0.82rem',
  letterSpacing: '0.04em',
};

const bodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  padding: '4px 2px 2px',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  ...protectedOverlayTextStyle,
};

const releaseListStyle: CSSProperties = {
  display: 'grid',
  gap: 20,
};

const releaseBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  paddingBottom: 16,
  borderBottom: '1px solid rgba(255, 204, 102, 0.22)',
};

const releaseHeadingStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.08rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.05em',
};

const groupListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
};

const groupStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
};

const groupTitleStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 204, 102, 0.88)',
  fontSize: '0.92rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
};

const noteListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.1rem',
  display: 'grid',
  gap: 6,
};

const noteItemStyle: CSSProperties = {
  color: 'rgba(247, 239, 224, 0.86)',
  fontSize: '0.9rem',
  lineHeight: 1.5,
};

const footerNoteStyle: CSSProperties = {
  margin: 0,
  paddingTop: 10,
  borderTop: '1px solid rgba(255, 204, 102, 0.28)',
  color: 'rgba(247, 239, 224, 0.78)',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  textAlign: 'center',
};

function renderNoteList(notes: string[], keyPrefix: string) {
  return (
    <ul style={noteListStyle}>
      {notes.map((note, index) => (
        <li key={`${keyPrefix}-${index}`} style={noteItemStyle}>
          {note}
        </li>
      ))}
    </ul>
  );
}

export function PatchNotesOverlay({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Patch notes"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="patch-notes-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <div style={titleGroupStyle}>
            <h2 id="patch-notes-overlay-title" style={titleStyle}>
              PATCH NOTES — {APP_VERSION}
            </h2>
            <p style={subtitleStyle}>Newest first</p>
          </div>
          <ClosePanelButton onClose={onClose} pressKey="patch-notes-close" />
        </header>
        <div data-patch-notes-scroll="" style={bodyStyle}>
          <style>
            {'[data-patch-notes-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          <div style={releaseListStyle}>
            {PATCH_RELEASES.map((release, releaseIndex) => (
              <article
                key={release.id}
                style={{
                  ...releaseBlockStyle,
                  ...(releaseIndex === PATCH_RELEASES.length - 1
                    ? { borderBottom: 'none', paddingBottom: 0 }
                    : {}),
                }}
              >
                <h3 style={releaseHeadingStyle}>
                  {release.version} · {release.period}
                </h3>
                {release.notes ? renderNoteList(release.notes, release.id) : null}
                {release.groups ? (
                  <div style={groupListStyle}>
                    {release.groups.map((group) => (
                      <section key={`${release.id}-${group.title}`} style={groupStyle}>
                        <h4 style={groupTitleStyle}>{group.title}</h4>
                        {renderNoteList(group.notes, `${release.id}-${group.title}`)}
                      </section>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
        <footer>
          <p style={footerNoteStyle}>{FOOTER_NOTE}</p>
        </footer>
      </section>
    </div>
  );
}

export default PatchNotesOverlay;
