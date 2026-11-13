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

const subHeadingStyle: CSSProperties = {
  margin: '14px 0 8px',
  color: 'rgba(255, 204, 102, 0.92)',
  fontSize: '0.96rem',
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

const linkStyle: CSSProperties = {
  color: '#ffcc66',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};

function PolicySection({
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

function PolicyList({ items }: { items: string[] }) {
  return (
    <ul style={listStyle}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PolicyParagraph({ children }: { children: ReactNode }) {
  return <p style={paragraphStyle}>{children}</p>;
}

export function PrivacyPolicyOverlay({
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
      aria-label="Privacy Policy"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="privacy-policy-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={framedStyle(panelStyle)}
      >
        <LineFrame background={panelStyle.background} />
        <header style={headerStyle}>
          <h2 id="privacy-policy-title" style={titleStyle}>
            Morkahja Privacy Policy
          </h2>
          <ClosePanelButton onClose={onClose} pressKey="privacy-policy-close" />
        </header>
        <div data-privacy-policy-scroll="" style={scrollBodyStyle}>
          <p style={effectiveDateStyle}>
            <strong>Effective Date:</strong> November 13, 2026
          </p>
          <p style={introStyle}>
            Morkahja is made and run by Alexander Ludwig aka Babuni, Sweden, who is responsible for
            your data (the data controller). This policy explains what information the game
            processes, why, and what rights you have.
          </p>
          <p style={introStyle}>
            Morkahja keeps as little as possible: no email registration, no advertising, no
            analytics or tracking, and no third-party social logins. The game loads nothing from
            other websites.
          </p>

          <PolicySection heading="1. Information We Process">
            <h4 style={subHeadingStyle}>Account and Identity</h4>
            <PolicyParagraph>
              Starting a journey creates a cryptographic key on your device. Your key stays with
              you; the server only keeps what it needs to recognise you:
            </PolicyParagraph>
            <PolicyList
              items={[
                'Player name (names do not have to be unique)',
                'Public part of your identity key',
                'Device identifiers derived from device keys',
                'Session tokens and authentication data',
                'When the account was created and last active',
              ]}
            />
            <h4 style={subHeadingStyle}>Gameplay</h4>
            <PolicyList
              items={[
                'Avatars and their progression',
                'Inventory and skills',
                'Achievements and unlocked content',
                'Encounter progress and active encounters',
                'Party and room participation',
                'Friend links',
                'Daily rewards and gems',
                'Activity feed entries ("Scribes")',
                'Wall of Fame records',
              ]}
            />
            <PolicyParagraph>
              This is stored on the server so your progress follows you across sessions and
              devices.
            </PolicyParagraph>
            <h4 style={subHeadingStyle}>Purchases</h4>
            <PolicyParagraph>
              When you buy an expansion or dice skin, the server records your account, the item,
              the amount, the currency, the time and Stripe&apos;s payment reference. Card and
              billing details are entered on Stripe&apos;s checkout page and never reach the
              Morkahja server.
            </PolicyParagraph>
            <h4 style={subHeadingStyle}>Technical and Security</h4>
            <PolicyList
              items={[
                'Session heartbeat and device activity timestamps',
                'Web server access logs, which include IP addresses',
                'Error and diagnostic logs',
              ]}
            />
            <PolicyParagraph>
              IP addresses are also used briefly, in memory only, to limit repeated sign-in
              attempts.
            </PolicyParagraph>
            <h4 style={subHeadingStyle}>Browser Storage</h4>
            <PolicyParagraph>
              Morkahja uses your browser&apos;s local storage for your identity and device keys,
              your session, your settings and what you have already read. This stays on your
              device until you or your browser remove it.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="2. How Information Is Used">
            <PolicyList
              items={[
                'Sign you in securely and keep your account',
                'Save and synchronise your progress',
                'Run parties, rooms, friends and other shared play',
                'Show player profiles, Scribes and the Wall of Fame',
                'Process purchases and unlock what you bought',
                'Keep the game secure, prevent abuse and fix technical problems',
              ]}
            />
            <PolicyParagraph>
              Personal data is never sold, and there is no advertising or behavioural tracking.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="3. What Other Players Can See">
            <PolicyList
              items={[
                'Your player name, avatar names and appearance, levels and titles',
                'Whether you are online, and what you choose in a shared encounter',
                'Your Scribes entries and Wall of Fame records',
              ]}
            />
            <PolicyParagraph>
              Adding a friend is one-sided: anyone who knows your player name can add you. Friends
              can see whether you are online, your avatars, levels and achievements, and can join
              you. There is no chat or messaging, so no one can write to you through the game.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="4. Legal Basis">
            <h4 style={subHeadingStyle}>Contract</h4>
            <PolicyParagraph>
              Running the game you chose to play: signing in, saving progress, shared play, social
              features and purchases.
            </PolicyParagraph>
            <h4 style={subHeadingStyle}>Legitimate Interests</h4>
            <PolicyParagraph>
              Keeping the service secure, preventing abuse and unauthorised access, and finding and
              fixing errors.
            </PolicyParagraph>
            <h4 style={subHeadingStyle}>Legal Obligation</h4>
            <PolicyParagraph>Keeping purchase records as bookkeeping law requires.</PolicyParagraph>
          </PolicySection>

          <PolicySection heading="5. Service Providers">
            <PolicyList
              items={[
                'Hetzner Online GmbH (Germany) hosts the game server in the European Union (Finland).',
                'Stripe processes payments. It receives what you enter on its checkout page together with the item and a reference to your account.',
                'PayPal receives optional donations. A donation takes you to PayPal’s own site.',
              ]}
            />
            <PolicyParagraph>
              Stripe and PayPal handle payment data under their own privacy policies:{' '}
              <a href="https://stripe.com/privacy" rel="noreferrer" style={linkStyle} target="_blank">
                Stripe
              </a>
              ,{' '}
              <a href="https://www.paypal.com/privacy" rel="noreferrer" style={linkStyle} target="_blank">
                PayPal
              </a>
              . No advertising, analytics or social login services are used.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="6. How Long Data Is Kept">
            <PolicyList
              items={[
                'Account and gameplay data: as long as your account exists. Inactive accounts are not deleted automatically. You can delete avatars in the game and ask for your whole account to be deleted.',
                'Purchase records: as long as bookkeeping law requires (seven years in Sweden).',
                'Web server access logs with IP addresses: deleted after 14 days.',
                'Error and diagnostic logs: as long as they are needed to find and fix problems.',
              ]}
            />
          </PolicySection>

          <PolicySection heading="7. Your Rights">
            <PolicyParagraph>Under the GDPR you can ask to:</PolicyParagraph>
            <PolicyList
              items={[
                'See the data stored about you and get a copy of it',
                'Correct data that is wrong',
                'Delete your data',
                'Restrict or object to some processing',
              ]}
            />
            <PolicyParagraph>
              Write to the contact below and include your player name. Never send your key: I will
              never ask for it.
            </PolicyParagraph>
            <PolicyParagraph>
              You can also complain to the Swedish data protection authority,{' '}
              <a href="https://www.imy.se" rel="noreferrer" style={linkStyle} target="_blank">
                Integritetsskyddsmyndigheten (IMY)
              </a>
              , or to the authority in the country where you live.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="8. Children">
            <PolicyParagraph>
              Morkahja is meant for players aged 18 and over. Children may play only together with
              a parent or guardian, who is responsible for their play. If you believe a child is
              playing without one, write to the contact below and the account will be deleted.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="9. Security">
            <PolicyList
              items={[
                'HTTPS encryption',
                'Cryptographic sign-in without passwords',
                'Session checks',
                'Restricted server access',
              ]}
            />
            <PolicyParagraph>
              No system is perfectly secure. Keep your key safe: anyone who has it can play as you.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="10. Where Data Is Processed">
            <PolicyParagraph>
              The game server is in the European Union. Stripe and PayPal may also process payment
              data outside the EU, including in the United States, using safeguards recognised by
              EU law such as the EU–US Data Privacy Framework and standard contractual clauses.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="11. Contact">
            <PolicyParagraph>
              Alexander Ludwig aka Babuni
              <br />
              Sweden
            </PolicyParagraph>
            <PolicyParagraph>
              Email:{' '}
              <a href="mailto:support@babuni.dev" style={linkStyle}>
                support@babuni.dev
              </a>
            </PolicyParagraph>
          </PolicySection>

          <section style={{ ...sectionStyle, borderWidth: 0, borderImageSource: 'none', paddingBottom: 0, marginBottom: 0 }}>
            <h3 style={sectionHeadingStyle}>12. Changes to This Policy</h3>
            <PolicyParagraph>
              This policy may be updated as the game, its infrastructure or the law change; the
              date at the top shows the latest version.
            </PolicyParagraph>
          </section>
        </div>
      </section>
    </div>
  );
}

export default PrivacyPolicyOverlay;
