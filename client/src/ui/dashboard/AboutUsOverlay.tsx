import { useEffect, useState, type CSSProperties } from 'react';
import { revealMenuWhenReady } from '../transitions/menuReadiness.js';
import DonationOverlay from './DonationOverlay.js';
import { ClosePanelButton, overlayCloseButtonVisualStyle } from '../common/ClosePanelButton.js';
import { PanelButton } from '../common/PanelButton.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import { LineFrame, framedStyle } from '../common/LineFrame.js';
import { frameDividerStyle, simpleFrameStyle } from '../common/simpleFrame.js';

const OVERLAY_FADE_MS = 300;

interface CreditEntry {
  id: string;
  name: string;
  roles: string;
  paragraphs: string[];
  externalLink?: {
    label: string;
    url: string;
  };
}

const NIKITA_INSTAGRAM_URL = 'https://www.instagram.com/nikitamalkomusic/';
const BABUNI_WEBSITE_URL = 'https://www.babuni.dev/';
const BABUNI_CONTACT_EMAIL = 'babuni@babuni.dev';

const CREDITS: CreditEntry[] = [
  {
    id: 'babuni-dev',
    name: 'Alexander Ludwig aka Babuni',
    roles: 'Author · Game Design · Visual Design · Worldbuilding · Software Development',
    externalLink: {
      label: 'Website',
      url: BABUNI_WEBSITE_URL,
    },
    paragraphs: [
      'This project is created out of a deep love for worldbuilding, game design, and creative expression. It is a way of bringing ideas to life and shaping imagined worlds into something playable and real. Every part of the process — from visuals to systems to narrative to implementation — is driven by a clear personal vision and a strong desire to explore and realize those ideas fully.',
      'The game is made first and foremost for myself, guided by a defined creative direction, with the hope that others can find joy in it as well. Nothing means more than knowing that players enjoy it, even if only a fraction as much as the enjoyment that goes into creating it.',
      'Deep gratitude to everyone who has supported the project — those who gave feedback, tested, played, and continue to engage with it. That support shapes the work in ways that cannot be measured, and it is sincerely appreciated.',
      'Tools used: Midjourney (image generation), Photoshop (curation and refinement), Cursor and Claude (programming assistance), ChatGPT (storytelling and worldbuilding)',
    ],
  },
  {
    id: 'nikita-malko',
    name: 'Nikita Malko',
    roles: 'Video Game Composer · Music & Sound Design',
    externalLink: {
      label: 'Instagram',
      url: NIKITA_INSTAGRAM_URL,
    },
    paragraphs: [
      'Every world carries a hidden pulse, and music is what lets it breathe. It is what turns landscapes into memory, silence into emotion, and moments into something that stays with the player long after they\'ve stopped playing.',
      'Working with Nikita Malko has been a deeply inspiring part of this project. His approach to composition — treating music as an emotional architecture of a game world — aligns naturally with the vision behind Morkahja. Every track feels like it belongs, not added on top, but grown from within the world itself.',
      'From subtle atmospheric textures to strong thematic identities, his work shapes presence, mood, and meaning without ever forcing attention. It supports the experience in a way that feels both careful and alive.',
      'There is a sincere hope to continue working together in the future, especially as the project grows and begins to support further expansion of its music systems. The intention is to evolve the audio layer of the game into something even more dynamic and expressive, and his contribution forms a strong foundation for that direction.',
    ],
  },
  {
    id: 'keeping-morkahja-alive',
    name: 'Keeping Morkahja Alive',
    roles: 'How the game is made and maintained',
    paragraphs: [
      'Morkahja is made by one person. Everything behind it, from the server that keeps the world running to the tools for art, writing and code, is paid out of my own pocket, and gladly so: building this world is what I love to do.',
      'So far the game does not earn money. That is fine. Even without any income, I would happily keep paying for it and keep working on Morkahja at a calmer pace. What support changes is time: every bit of it means more hours I can put into new encounters, new adventurers and a richer world.',
      'That is why every donation is very welcome, and every purchase inside the game is even more welcome. Purchases show that Morkahja can stand on its own, and one day that might help me find someone willing to invest in its future.',
      `Every little bit helps, and every big bit helps a lot. If you are curious about the details, or want to say hello, write to me at ${BABUNI_CONTACT_EMAIL}. Thank you for playing, and for being part of this world.`,
    ],
    externalLink: {
      label: 'Contact',
      url: `mailto:${BABUNI_CONTACT_EMAIL}`,
    },
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
  // Padding included, so the panel fits inside a phone screen.
  width: 'min(100%, 456px)',
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
  boxSizing: 'border-box',
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
  ...frameDividerStyle({ side: 'top', bleed: 9 }),
};

const creditCardStyle: CSSProperties = {
  ...simpleFrameStyle({ background: 'rgba(8, 5, 4, 0.55)', opacity: 0.5 }),
  overflow: 'hidden',
};

const creditHeaderButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
};

const creditHeaderVisualStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 6,
  padding: '14px 14px 12px',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  textAlign: 'center',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const nameStyle: CSSProperties = {
  margin: 0,
  width: '100%',
  color: '#ffcc66',
  fontSize: '1.2rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
  textAlign: 'center',
};

const roleLineStyle: CSSProperties = {
  margin: 0,
  width: '100%',
  color: 'rgba(247, 239, 224, 0.94)',
  fontSize: '0.95rem',
  lineHeight: 1.45,
  textAlign: 'center',
};

const expandHintStyle: CSSProperties = {
  margin: 0,
  width: '100%',
  color: 'rgba(255, 204, 102, 0.72)',
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  textAlign: 'center',
};

const creditBodyStyle: CSSProperties = {
  padding: '0 14px 14px',
  width: '100%',
  boxSizing: 'border-box',
};

/** Full card width up to 40ch, centered — avoids flex shrink-to-content misalignment. */
const creditBodyColumnStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  width: 'min(100%, 40ch)',
  maxWidth: '40ch',
  marginInline: 'auto',
  textAlign: 'center',
};

const bodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.88rem',
  lineHeight: 1.55,
  textAlign: 'center',
};

const creditLinkFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 4,
};

function openExternalLink(url: string): void {
  // A mail link hands over to the mail app; a new tab would stay empty.
  if (url.startsWith('mailto:')) {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

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
      <PanelButton
        aria-controls={bodyId}
        aria-expanded={expanded}
        id={headerId}
        onClick={() => {
          playSfx(DEFAULT_BUTTON_SOUND);
          onToggle();
        }}
        pressKey={`about-credit-${credit.id}`}
        style={creditHeaderButtonStyle}
        visualStyle={creditHeaderVisualStyle}
      >
        <h3 style={nameStyle}>{credit.name}</h3>
        <p style={roleLineStyle}>{credit.roles}</p>
        <p style={expandHintStyle}>{expanded ? 'Show less' : 'Read more'}</p>
      </PanelButton>
      {expanded ? (
        <div
          aria-labelledby={headerId}
          id={bodyId}
          style={creditBodyStyle}
        >
          <div style={creditBodyColumnStyle}>
            {credit.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} style={bodyTextStyle}>
                {paragraph}
              </p>
            ))}
            {credit.externalLink ? (
              <div style={creditLinkFooterStyle}>
                <PanelButton
                  onClick={() => {
                    playSfx(DEFAULT_BUTTON_SOUND);
                    openExternalLink(credit.externalLink!.url);
                  }}
                  pressKey={`about-link-${credit.id}`}
                  visualStyle={overlayCloseButtonVisualStyle}
                >
                  {credit.externalLink.label}
                </PanelButton>
              </div>
            ) : null}
          </div>
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

    // Shown once the pictures inside are loaded; the opening button pulses meanwhile.
    const cancelReveal = revealMenuWhenReady(
      null,
      () => document.querySelector('[data-morkahja-menu="about"]'),
      () => {
        setVisible(true);
      },
    );

    return () => {
      cancelReveal();
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
      data-morkahja-menu="about"
      aria-label="About us"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <section
        aria-labelledby="about-us-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={framedStyle(panelStyle)}
      >
        <LineFrame background={panelStyle.background} />
        <header style={headerStyle}>
          <h2 id="about-us-overlay-title" style={titleStyle}>ABOUT US</h2>
          <ClosePanelButton onClose={onClose} pressKey="about-close" />
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
          <PanelButton
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              setDonationOpen(true);
            }}
            pressKey="about-donation"
            visualStyle={overlayCloseButtonVisualStyle}
          >
            Donation
          </PanelButton>
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
