import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { LineFrame, framedStyle } from '../common/LineFrame.js';
import { frameDividerStyle } from '../common/simpleFrame.js';

const OVERLAY_FADE_MS = 300;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 12,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.72)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  // Padding included, so the panel fits inside a phone screen.
  width: 'min(100%, 516px)',
  maxHeight: 'min(88vh, 680px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 12,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.94)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  overflow: 'hidden',
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
  fontSize: '1.35rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
  lineHeight: 1.2,
};

const scrollBodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: 4,
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(255, 204, 102, 0.45) transparent',
};

const effectiveDateStyle: CSSProperties = {
  margin: '0 0 16px',
  color: 'rgba(247, 239, 224, 0.78)',
  fontSize: '0.9rem',
  lineHeight: 1.4,
};

const introStyle: CSSProperties = {
  margin: '0 0 14px',
  color: 'rgba(247, 239, 224, 0.9)',
  fontSize: '0.92rem',
  lineHeight: 1.55,
};

const linkStyle: CSSProperties = {
  color: '#ffcc66',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};

const SUPPORT_EMAIL = 'support@babuni.dev';
/** The Morkahja project on babuni.dev: documentation and development journal. */
const PROJECT_PAGE_URL = 'https://www.babuni.dev/#project=morkahja-rpg&bloom=big';

const sectionStyle: CSSProperties = {
  margin: '0 0 20px',
  paddingBottom: 18,
  ...frameDividerStyle({ side: 'bottom' }),
};

const sectionHeadingStyle: CSSProperties = {
  margin: '0 0 10px',
  color: '#ffcc66',
  fontSize: '1.05rem',
  fontWeight: 700,
  lineHeight: 1.3,
};

const paragraphStyle: CSSProperties = {
  margin: '0 0 10px',
  color: 'rgba(247, 239, 224, 0.88)',
  fontSize: '0.9rem',
  lineHeight: 1.55,
};

const listStyle: CSSProperties = {
  margin: '0 0 10px',
  paddingLeft: 22,
  color: 'rgba(247, 239, 224, 0.88)',
  fontSize: '0.9rem',
  lineHeight: 1.5,
};

function TermsSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={sectionHeadingStyle}>{heading}</h3>
      {children}
    </section>
  );
}

function TermsList({ items }: { items: string[] }) {
  return (
    <ul style={listStyle}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function TermsParagraph({ children }: { children: ReactNode }) {
  return <p style={paragraphStyle}>{children}</p>;
}

export function TermsOfServiceOverlay({
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
      aria-label="Terms of Service"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="terms-of-service-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={framedStyle(panelStyle)}
      >
        <LineFrame background={panelStyle.background} />
        <header style={headerStyle}>
          <h2 id="terms-of-service-title" style={titleStyle}>
            Morkahja Terms of Service
          </h2>
          <ClosePanelButton onClose={onClose} pressKey="terms-of-service-close" />
        </header>
        <div data-terms-of-service-scroll="" style={scrollBodyStyle}>
          <p style={effectiveDateStyle}>
            <strong>Effective Date:</strong> November 13, 2026
          </p>
          <p style={introStyle}>
            Welcome to Morkahja. These terms are the rules for playing the game, written to be
            read rather than skipped. When they say &ldquo;I&rdquo; or &ldquo;me&rdquo;, that is
            Babuni, the person who makes Morkahja.
          </p>

          <TermsSection heading="1. Who Makes Morkahja">
            <TermsParagraph>
              Morkahja is made and run by one person: Alexander Ludwig aka Babuni, in Sweden.
            </TermsParagraph>
            <TermsParagraph>
              Contact:{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={linkStyle}>
                {SUPPORT_EMAIL}
              </a>
            </TermsParagraph>
            <TermsParagraph>
              How the game is made is public: its documentation and development journal are on{' '}
              <a href={PROJECT_PAGE_URL} rel="noreferrer" style={linkStyle} target="_blank">
                my website
              </a>
              .
            </TermsParagraph>
          </TermsSection>

          <TermsSection heading="2. A World That Keeps Growing">
            <TermsParagraph>
              Morkahja is a living game. Encounters, systems and stories change as it grows,
              sometimes without notice. You take part in that world; you do not own a part of it.
            </TermsParagraph>
            <TermsParagraph>
              By starting a journey or using your key, you agree to these terms. If you do not
              agree, please do not play.
            </TermsParagraph>
          </TermsSection>

          <TermsSection heading="3. Your Key Is Your Key">
            <TermsList
              items={[
                'When you start a journey, you receive a key. That key is your journey: using it on any device brings your progress back.',
                'Keep it safe and private. Anyone who has your key can play as you.',
                'There is no email, password reset or identity check. If your key is lost, I cannot restore the journey, and access cannot be reassigned to anyone else.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="4. Free to Play, With Optional Purchases">
            <TermsList
              items={[
                'Morkahja is free to play. Gems are earned in the game and cannot be bought.',
                'Expansions unlock new content; dice skins are purely cosmetic. Both can be unlocked with gems or bought with real money. Payments are handled by Stripe.',
                'Payment never buys an advantage over other players. There are no loot boxes and nothing random for money.',
                'Unlocks belong to your key and cannot be transferred. An expansion’s content may be reworked or merged over time; your access is kept wherever technically possible.',
                'Purchases unlock digital content right away and are normally final. If something went wrong with a purchase, write to me and we will find a fair solution. This does not limit any rights you have under consumer law.',
                'Donations are voluntary gifts and do not unlock anything.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="5. Playing With Others">
            <TermsList
              items={[
                'There is no chat or messaging in Morkahja. You play together in parties and can call others for help.',
                'Friends are a link for playing together, nothing more. Adding a friend is one-sided: anyone who knows your player name can add you, and you can add anyone. Friends can see whether you are online, your avatars, levels and achievements, and can join you.',
                'Your player name is the one thing others see first, so choose one that does not reveal more about you than you want.',
                'Be kind. Harassment, hate, impersonation and disrupting other players’ games are not allowed.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="6. Fair Play">
            <TermsList
              items={[
                'Please do not cheat, exploit bugs, attack the service or interfere with other players’ sessions. Found a bug? Telling me is very welcome.',
                'If someone abuses the game, I may restrict or remove the account, items or progress, without prior notice. I try to be fair, and these decisions are mine to make.',
                'These rules are about the live game; they do not restrict what the open licenses below allow you to do with the published code and content.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="7. Open, With a Few Things Reserved">
            <TermsList
              items={[
                'The original game software is licensed under MIT, and original creative content is shared under CC BY 4.0 where I hold the rights. See LICENSE and CONTENT_LICENSE.md in the repository.',
                'Commissioned music and externally sourced sounds, fonts and other third-party assets keep their own terms.',
                'The Morkahja name, identity and branding remain reserved.',
                'Streaming, recording, fan art, mods and other community creations are welcome, and your fan works are yours. Please do not present them as official, and do not spread harmful modifications.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="8. Age">
            <TermsList
              items={[
                'Morkahja is meant for players aged 18 and over. Children may play only together with a parent or guardian, who is responsible for their play.',
                'The game contains no explicit content. If mature content is ever added, it will come with a setting to turn it on or off.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="9. Your Data">
            <TermsParagraph>
              Morkahja keeps only what the game needs: no email, no ads, no tracking, and no data
              is sold. The Privacy Policy explains the details.
            </TermsParagraph>
          </TermsSection>

          <TermsSection heading="10. Availability and Changes">
            <TermsList
              items={[
                'Morkahja is a one-person project. Servers may be changed, paused or shut down, and features may change or be removed.',
                'In rare cases progress may be reset; I will do what I can to preserve it.',
                'The game is provided as it is. Bugs, interruptions and data loss can happen.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="11. Liability">
            <TermsParagraph>
              As far as Swedish law allows, I am not liable for losses caused by interruptions,
              bugs, exploits or data loss. This does not limit any liability that the law does not
              allow to be excluded.
            </TermsParagraph>
          </TermsSection>

          <TermsSection heading="12. Governing Law">
            <TermsParagraph>
              These terms are governed by Swedish law. If you live elsewhere in the EU, the
              mandatory consumer protections of your country still apply.
            </TermsParagraph>
          </TermsSection>

          <TermsSection heading="13. Changes to These Terms">
            <TermsParagraph>
              These terms may be updated as the game changes; the date at the top shows the latest
              version. Playing after a change means you accept the updated terms.
            </TermsParagraph>
          </TermsSection>

          <section style={{ ...sectionStyle, borderWidth: 0, borderImageSource: 'none', paddingBottom: 0, marginBottom: 0 }}>
            <h3 style={sectionHeadingStyle}>A Final Word</h3>
            <TermsParagraph>
              Morkahja is not a finished product but a world in the making. Thank you for being
              part of it.
            </TermsParagraph>
          </section>
        </div>
      </section>
    </div>
  );
}

export default TermsOfServiceOverlay;
