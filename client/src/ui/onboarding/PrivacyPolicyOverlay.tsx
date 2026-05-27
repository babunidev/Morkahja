import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';

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
  width: 'min(92vw, 480px)',
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
  borderBottom: '1px solid rgba(255, 204, 102, 0.22)',
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
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="privacy-policy-title" style={titleStyle}>
            Morkahja Privacy Policy
          </h2>
          <ClosePanelButton onClose={onClose} pressKey="privacy-policy-close" />
        </header>
        <div data-privacy-policy-scroll="" style={scrollBodyStyle}>
          <p style={effectiveDateStyle}>
            <strong>Effective Date:</strong> May 27, 2026
          </p>
          <p style={introStyle}>
            Morkahja is operated by Babunigaming, Sweden. This Privacy Policy explains what
            information is processed when you use Morkahja, how that information is used, and
            what rights you have regarding your data.
          </p>
          <p style={introStyle}>
            Morkahja is designed with minimal data collection in mind. The game does not require
            email registration, advertisements, or third-party social logins.
          </p>

          <PolicySection heading="1. Information We Process">
            <h4 style={subHeadingStyle}>Account and Identity Data</h4>
            <PolicyParagraph>
              When creating a new journey in Morkahja, the game generates a cryptographic identity
              linked to your account.
            </PolicyParagraph>
            <PolicyParagraph>We may process:</PolicyParagraph>
            <PolicyList
              items={[
                'Player name',
                'Public cryptographic identity keys',
                'Device identifiers derived from cryptographic device keys',
                'Session tokens and authentication data',
                'Account creation and activity timestamps',
              ]}
            />
            <PolicyParagraph>Player names are not required to be unique.</PolicyParagraph>

            <h4 style={subHeadingStyle}>Gameplay Data</h4>
            <PolicyParagraph>
              To provide game functionality and progression, we process gameplay-related information
              including:
            </PolicyParagraph>
            <PolicyList
              items={[
                'Avatars and avatar progression',
                'Inventory and equipment',
                'Achievements and unlocked content',
                'Encounter progress and active encounters',
                'Multiplayer room participation',
                'Friend relationships',
                'Daily rewards and currencies',
                'Activity feed events ("Scribes")',
                'Wall of Fame records',
              ]}
            />
            <PolicyParagraph>
              This information is stored on the server to allow persistent progression across
              sessions and devices.
            </PolicyParagraph>

            <h4 style={subHeadingStyle}>Technical and Security Data</h4>
            <PolicyParagraph>
              We may process limited technical information necessary to operate and secure the game,
              including:
            </PolicyParagraph>
            <PolicyList
              items={[
                'Session heartbeat timestamps',
                'Device activity timestamps',
                'Server request logs',
                'Error and diagnostic logs',
                'IP addresses processed through server infrastructure and security systems',
                'Browser storage identifiers',
              ]}
            />
            <PolicyParagraph>
              This information is used only for security, stability, abuse prevention, and service
              operation.
            </PolicyParagraph>

            <h4 style={subHeadingStyle}>Browser Storage</h4>
            <PolicyParagraph>
              Morkahja uses browser storage technologies such as localStorage to store:
            </PolicyParagraph>
            <PolicyList
              items={[
                'Session information',
                'Cryptographic identity keys',
                'Device keys',
                'User preferences',
                'Read states and interface settings',
              ]}
            />
            <PolicyParagraph>
              This data remains on your device unless removed by you or cleared by the browser.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="2. How Information Is Used">
            <PolicyParagraph>Your information is processed to:</PolicyParagraph>
            <PolicyList
              items={[
                'Create and maintain player accounts',
                'Authenticate users securely',
                'Save and synchronize progression',
                'Enable multiplayer gameplay',
                'Display player profiles and game activity',
                'Operate social systems such as friends and encounter rooms',
                'Maintain game security and prevent abuse',
                'Diagnose technical issues and improve stability',
                'Restore accounts using cryptographic recovery methods',
              ]}
            />
            <PolicyParagraph>Morkahja does not sell personal data.</PolicyParagraph>
            <PolicyParagraph>
              Morkahja does not use advertising networks or third-party behavioral tracking systems.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="3. Multiplayer and Visible Information">
            <PolicyParagraph>
              Certain information is visible to other players during gameplay and social
              interactions, including:
            </PolicyParagraph>
            <PolicyList
              items={[
                'Player names',
                'Avatar names and appearance',
                'Levels and titles',
                'Online presence in multiplayer rooms',
                'Public activity feed entries ("Scribes")',
                'Wall of Fame records',
              ]}
            />
            <PolicyParagraph>Morkahja does not provide open text chat between players.</PolicyParagraph>
          </PolicySection>

          <PolicySection heading="4. Legal Basis for Processing">
            <PolicyParagraph>
              Under the General Data Protection Regulation (GDPR), data is processed under the
              following legal bases:
            </PolicyParagraph>
            <h4 style={subHeadingStyle}>Contractual Necessity</h4>
            <PolicyParagraph>
              Processing required to operate the game and provide gameplay features, including:
            </PolicyParagraph>
            <PolicyList
              items={[
                'Authentication',
                'Progress saving',
                'Multiplayer synchronization',
                'Social and account systems',
              ]}
            />
            <h4 style={subHeadingStyle}>Legitimate Interests</h4>
            <PolicyParagraph>Processing necessary to:</PolicyParagraph>
            <PolicyList
              items={[
                'Secure the service',
                'Prevent abuse and unauthorized access',
                'Maintain server functionality',
                'Diagnose errors and technical issues',
              ]}
            />
          </PolicySection>

          <PolicySection heading="5. Third Parties and Hosting">
            <PolicyParagraph>Morkahja is hosted on infrastructure provided by:</PolicyParagraph>
            <ul style={listStyle}>
              <li>
                <a href="https://www.hetzner.com" rel="noreferrer" style={linkStyle} target="_blank">
                  Hetzner
                </a>
              </li>
            </ul>
            <PolicyParagraph>
              Additional infrastructure services may include HTTPS certificate providers and server
              management tools necessary for secure operation.
            </PolicyParagraph>
            <PolicyParagraph>
              Morkahja does not integrate third-party advertising SDKs, analytics SDKs, or social
              login systems.
            </PolicyParagraph>
            <PolicyParagraph>
              Optional donations may redirect users to external services such as PayPal (
              <a href="https://www.paypal.com" rel="noreferrer" style={linkStyle} target="_blank">
                https://www.paypal.com
              </a>
              ). External services operate under their own privacy policies.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="6. Data Retention">
            <PolicyParagraph>
              Gameplay and account data are retained while the account remains active or reasonably
              necessary to operate the service.
            </PolicyParagraph>
            <PolicyParagraph>
              Technical logs and security-related information may be retained temporarily for
              maintenance, security, and abuse prevention purposes.
            </PolicyParagraph>
            <PolicyParagraph>Users may request deletion of their account data.</PolicyParagraph>
          </PolicySection>

          <PolicySection heading="7. Your Rights">
            <PolicyParagraph>
              Under applicable data protection laws, including GDPR, you may have the right to:
            </PolicyParagraph>
            <PolicyList
              items={[
                'Request access to your stored data',
                'Request correction of inaccurate data',
                'Request deletion of your data',
                'Restrict or object to certain processing',
                'Request a copy of your stored data',
              ]}
            />
            <PolicyParagraph>
              Requests may be submitted using the contact information below.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="8. Children">
            <PolicyParagraph>
              Morkahja is not directed toward children under the age of 13.
            </PolicyParagraph>
            <PolicyParagraph>
              If you believe a child has provided personal information in violation of applicable
              law, please contact the developer.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="9. Security">
            <PolicyParagraph>
              Morkahja uses reasonable technical and organizational measures to protect stored
              information, including:
            </PolicyParagraph>
            <PolicyList
              items={[
                'HTTPS encryption',
                'Cryptographic authentication systems',
                'Session validation',
                'Server access controls',
              ]}
            />
            <PolicyParagraph>No system can guarantee absolute security.</PolicyParagraph>
            <PolicyParagraph>
              Users are responsible for securely storing their recovery keys and account
              credentials.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="10. International Data Processing">
            <PolicyParagraph>
              Data may be processed on servers located within the European Union.
            </PolicyParagraph>
            <PolicyParagraph>
              If infrastructure providers process data outside your jurisdiction, appropriate
              safeguards are used where required by applicable law.
            </PolicyParagraph>
          </PolicySection>

          <PolicySection heading="11. Contact">
            <PolicyParagraph>
              Babunigaming
              <br />
              Sweden
            </PolicyParagraph>
            <PolicyParagraph>
              Email:{' '}
              <a href="mailto:arcanitebrothers@gmail.com" style={linkStyle}>
                arcanitebrothers@gmail.com
              </a>
            </PolicyParagraph>
          </PolicySection>

          <section style={{ ...sectionStyle, borderBottom: 0, paddingBottom: 0, marginBottom: 0 }}>
            <h3 style={sectionHeadingStyle}>12. Changes to This Policy</h3>
            <PolicyParagraph>
              This Privacy Policy may be updated over time to reflect changes to the game,
              infrastructure, or legal obligations.
            </PolicyParagraph>
            <PolicyParagraph>
              Continued use of Morkahja after changes become effective constitutes acceptance of the
              updated policy.
            </PolicyParagraph>
          </section>
        </div>
      </section>
    </div>
  );
}

export default PrivacyPolicyOverlay;
