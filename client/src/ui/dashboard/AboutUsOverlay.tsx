import { useEffect, useState, type CSSProperties } from 'react';
import DonationOverlay from './DonationOverlay.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const OVERLAY_FADE_MS = 300;

interface CreditEntry {
  id: string;
  name: string;
  roles: string;
  paragraphs: string[];
}

const CREDITS: CreditEntry[] = [
  {
    id: 'alexander-ludwig',
    name: 'Alexander Ludwig',
    roles: 'Game Design · Visual Design · Worldbuilding · Software Development',
    paragraphs: [
      'This project is created out of a deep love for worldbuilding, game design, and creative expression. It is a way of bringing ideas to life and shaping imagined worlds into something playable and real. Every part of the process — from visuals to systems to narrative to implementation — is driven by a clear personal vision and a strong desire to explore and realize those ideas fully.',
      'The game is made first and foremost for myself, guided by a defined creative direction, with the hope that others can find joy in it as well. Nothing means more than knowing that players enjoy it, even if only a fraction as much as the enjoyment that goes into creating it.',
      'Deep gratitude to everyone who has supported the project — those who gave feedback, tested, played, and continue to engage with it. That support shapes the work in ways that cannot be measured, and it is sincerely appreciated.',
      'Tools used: Midjourney (image generation), Photoshop (curation and refinement), Cursor (programming assistance), ChatGPT (storytelling and worldbuilding)',
    ],
  },
  {
    id: 'nikita-malko',
    name: 'Nikita Malko',
    roles: 'Video Game Composer · Music & Sound Design',
    paragraphs: [
      'Every world carries a hidden pulse, and music is what lets it breathe. It is what turns landscapes into memory, silence into emotion, and moments into something that stays with the player long after they\'ve stopped playing.',
      'Working with Nikita Malko has been a deeply inspiring part of this project. His approach to composition — treating music as an emotional architecture of a game world — aligns naturally with the vision behind Morkahja. Every track feels like it belongs, not added on top, but grown from within the world itself.',
      'From subtle atmospheric textures to strong thematic identities, his work shapes presence, mood, and meaning without ever forcing attention. It supports the experience in a way that feels both careful and alive.',
      'There is a sincere hope to continue working together in the future, especially as the project grows and begins to support further expansion of its music systems. The intention is to evolve the audio layer of the game into something even more dynamic and expressive, and his contribution forms a strong foundation for that direction.',
    ],
  },
];

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 7,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.72)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  width: 'min(92vw, 420px)',
  maxHeight: 'min(86vh, 620px)',
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

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.45rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
};

const closeButtonStyle: CSSProperties = {
  minWidth: 72,
  minHeight: 34,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
};

const bodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  padding: '4px 2px 2px',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  ...protectedOverlayTextStyle,
};

const creditListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
};

const donateFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 8,
  borderTop: '1px solid rgba(255, 204, 102, 0.32)',
};

const creditCardStyle: CSSProperties = {
  border: '1px solid rgba(255, 204, 102, 0.38)',
  borderRadius: 10,
  background: 'rgba(8, 5, 4, 0.55)',
  overflow: 'hidden',
};

const creditHeaderButtonStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gap: 6,
  padding: '14px 14px 12px',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'center',
  fontFamily: 'inherit',
};

const nameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.2rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
};

const roleLineStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.94)',
  fontSize: '0.95rem',
  lineHeight: 1.45,
};

const expandHintStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 204, 102, 0.72)',
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const creditBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '0 14px 14px',
  textAlign: 'center',
};

const bodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.88rem',
  lineHeight: 1.55,
  maxWidth: '40ch',
  justifySelf: 'center',
};

function CreditCard({
  credit,
  expanded,
  onToggle,
}: {
  credit: CreditEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const headerId = `${credit.id}-header`;
  const bodyId = `${credit.id}-body`;

  return (
    <article style={creditCardStyle}>
      <button
        aria-controls={bodyId}
        aria-expanded={expanded}
        id={headerId}
        onClick={() => {
          playSfx(DEFAULT_BUTTON_SOUND);
          onToggle();
        }}
        style={creditHeaderButtonStyle}
        type="button"
      >
        <h3 style={nameStyle}>{credit.name}</h3>
        <p style={roleLineStyle}>{credit.roles}</p>
        <p style={expandHintStyle}>{expanded ? 'Show less' : 'Read more'}</p>
      </button>
      {expanded ? (
        <div
          aria-labelledby={headerId}
          id={bodyId}
          style={creditBodyStyle}
        >
          {credit.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} style={bodyTextStyle}>
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function AboutUsOverlay({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setDonationOpen(false);
      setExpandedIds(new Set());
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [open]);

  function toggleCredit(id: string): void {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="About us"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="about-us-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="about-us-overlay-title" style={titleStyle}>ABOUT US</h2>
          <button
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onClose();
            }}
            style={closeButtonStyle}
            type="button"
          >
            Close
          </button>
        </header>
        <div data-about-us-scroll="" style={bodyStyle}>
          <style>
            {'[data-about-us-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          <div style={creditListStyle}>
            {CREDITS.map((credit) => (
              <CreditCard
                key={credit.id}
                credit={credit}
                expanded={expandedIds.has(credit.id)}
                onToggle={() => {
                  toggleCredit(credit.id);
                }}
              />
            ))}
          </div>
        </div>
        <footer style={donateFooterStyle}>
          <button
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              setDonationOpen(true);
            }}
            style={closeButtonStyle}
            type="button"
          >
            Donation
          </button>
        </footer>
      </section>
      <DonationOverlay
        onClose={() => {
          setDonationOpen(false);
        }}
        open={donationOpen}
      />
    </div>
  );
}

export default AboutUsOverlay;
