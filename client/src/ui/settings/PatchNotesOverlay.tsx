import { useEffect, useState, type CSSProperties } from 'react';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';

const OVERLAY_FADE_MS = 300;

const PATCH_VERSION = '0.9.0-beta.1';
const PATCH_PERIOD = 'Late May – early June';

interface PatchSection {
  id: string;
  title: string;
  notes: string[];
}

const SECTIONS: PatchSection[] = [
  {
    id: 'multiplayer',
    title: 'Multiplayer',
    notes: [
      'Encounter rooms for up to 3 players — shared encounters, choices, and Continue.',
      'Call for help — invite friends or other online players into your room.',
      'Witness events — level-ups and Atranor visible to everyone in the room, not only the roller.',
      'Party slots show who’s ready; improved join toasts and “waiting for party” flow.',
      'Lore gems can be earned for the whole party in a room.',
    ],
  },
  {
    id: 'shop-support',
    title: 'Shop & support',
    notes: [
      'Dice skins — unlock account-wide styles for your dice.',
      'Expansions shop UI refreshed.',
      'Stripe checkout for expansions and dice skins (optional; gems gameplay unchanged).',
      'PayPal donation link still in About Us.',
    ],
  },
  {
    id: 'ui-gameplay',
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
    id: 'progression-social',
    title: 'Progression & social',
    notes: [
      'Daily rewards consider progress across achievement chains.',
      'Scribes toasts for achievements; better lines for room joins and help.',
      'Firestarter progress shows in Scribes.',
    ],
  },
  {
    id: 'content',
    title: 'Content',
    notes: [
      'Many new encounters and art (forests, meadows, mountains, Everwinter, Verdani, Liani, Ashen Revenant, and more).',
    ],
  },
  {
    id: 'removed',
    title: 'Removed',
    notes: [
      'Seal of Norghor subscription removed from beta. Expansions unlock with gems as before.',
    ],
  },
  {
    id: 'fixes',
    title: 'Fixes',
    notes: [
      'Solo rooms no longer spam odd toasts.',
      'Party Continue and ally choices sync more reliably.',
      'Various room join, help, and server stability fixes.',
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

const sectionListStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.05rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.05em',
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
              PATCH NOTES — {PATCH_VERSION}
            </h2>
            <p style={subtitleStyle}>{PATCH_PERIOD}</p>
          </div>
          <ClosePanelButton onClose={onClose} pressKey="patch-notes-close" />
        </header>
        <div data-patch-notes-scroll="" style={bodyStyle}>
          <style>
            {'[data-patch-notes-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          <div style={sectionListStyle}>
            {SECTIONS.map((section) => (
              <section key={section.id} style={sectionStyle}>
                <h3 style={sectionTitleStyle}>{section.title}</h3>
                <ul style={noteListStyle}>
                  {section.notes.map((note) => (
                    <li key={note.slice(0, 32)} style={noteItemStyle}>
                      {note}
                    </li>
                  ))}
                </ul>
              </section>
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
