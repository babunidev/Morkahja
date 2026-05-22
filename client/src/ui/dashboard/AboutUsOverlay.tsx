import { useEffect, useState, type CSSProperties } from 'react';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const OVERLAY_FADE_MS = 300;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 6,
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
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 12,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
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
  textAlign: 'center',
  padding: '4px 6px 2px',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const creditBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  justifyItems: 'center',
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

const bodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.88rem',
  lineHeight: 1.55,
  maxWidth: '40ch',
};

const dividerStyle: CSSProperties = {
  width: 'min(72%, 220px)',
  height: 1,
  margin: '18px auto',
  border: 'none',
  background: 'rgba(255, 204, 102, 0.32)',
};

export function AboutUsOverlay({
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
      aria-label="About us"
      onClick={onClose}
      role="presentation"
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
          <article style={creditBlockStyle}>
            <h3 style={nameStyle}>Alexander Ludwig</h3>
            <p style={roleLineStyle}>
              Game Design · Visual Design · Worldbuilding · Software Development
            </p>
            <p style={bodyTextStyle}>
              This project is created out of a deep love for worldbuilding, game design,
              and creative expression. It is a way of bringing ideas to life and shaping
              imagined worlds into something playable and real. Every part of the
              process — from visuals to systems to narrative to implementation — is
              driven by a clear personal vision and a strong desire to explore and
              realize those ideas fully.
            </p>
            <p style={bodyTextStyle}>
              The game is made first and foremost for myself, guided by a defined
              creative direction, with the hope that others can find joy in it as well.
              Nothing means more than knowing that players enjoy it, even if only a
              fraction as much as the enjoyment that goes into creating it.
            </p>
            <p style={bodyTextStyle}>
              Deep gratitude to everyone who has supported the project — those who gave
              feedback, tested, played, and continue to engage with it. That support
              shapes the work in ways that cannot be measured, and it is sincerely
              appreciated.
            </p>
            <p style={bodyTextStyle}>
              Tools used: Midjourney (image generation), Photoshop (curation and
              refinement), Cursor (programming assistance), ChatGPT (storytelling and
              worldbuilding)
            </p>
          </article>
          <hr aria-hidden="true" style={dividerStyle} />
          <article style={creditBlockStyle}>
            <h3 style={nameStyle}>Nikita Malko</h3>
            <p style={roleLineStyle}>
              Video Game Composer · Music &amp; Sound Design
            </p>
            <p style={bodyTextStyle}>
              Every world carries a hidden pulse, and music is what lets it breathe. It
              is what turns landscapes into memory, silence into emotion, and moments into
              something that stays with the player long after they&apos;ve stopped playing.
            </p>
            <p style={bodyTextStyle}>
              Working with Nikita Malko has been a deeply inspiring part of this project.
              His approach to composition — treating music as an emotional architecture
              of a game world — aligns naturally with the vision behind Morkahja. Every
              track feels like it belongs, not added on top, but grown from within the
              world itself.
            </p>
            <p style={bodyTextStyle}>
              From subtle atmospheric textures to strong thematic identities, his work
              shapes presence, mood, and meaning without ever forcing attention. It
              supports the experience in a way that feels both careful and alive.
            </p>
            <p style={bodyTextStyle}>
              There is a sincere hope to continue working together in the future,
              especially as the project grows and begins to support further expansion of
              its music systems. The intention is to evolve the audio layer of the game
              into something even more dynamic and expressive, and his contribution forms
              a strong foundation for that direction.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default AboutUsOverlay;
