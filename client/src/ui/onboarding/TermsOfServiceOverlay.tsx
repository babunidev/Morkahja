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
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="terms-of-service-title" style={titleStyle}>
            Morkahja Terms of Service
          </h2>
          <ClosePanelButton onClose={onClose} pressKey="terms-of-service-close" />
        </header>
        <div data-terms-of-service-scroll="" style={scrollBodyStyle}>
          <TermsSection heading="1. The World and the Service">
            <TermsParagraph>
              Morkahja is an evolving digital world composed of client software, servers, supporting
              infrastructure, updates, and experimental systems. It is continuously developed and may
              change over time without prior notice. Access is granted as participation in a living
              system, not as ownership of any part of it.
            </TermsParagraph>
          </TermsSection>

          <TermsSection heading="2. Acceptance of Terms">
            <TermsParagraph>
              By creating a player identity, generating a key, or entering the world of Morkahja in any
              form, you agree to these Terms of Service. If you do not agree, you must not access or use
              the service.
            </TermsParagraph>
          </TermsSection>

          <TermsSection heading="3. Player Identity and Account Keys">
            <TermsParagraph>
              Player identity is defined through a cryptographic key or equivalent session-based
              identifier.
            </TermsParagraph>
            <TermsList
              items={[
                'The player is solely responsible for safeguarding their key.',
                'Lost, deleted, or inaccessible keys cannot be recovered.',
                'There is no identity verification system, recovery system, or account restoration process.',
                'Access is defined entirely by possession of the key; ownership cannot be disputed or reassigned.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="4. Free-to-Play Structure">
            <TermsParagraph>Morkahja is free to play.</TermsParagraph>
            <TermsList
              items={[
                'Optional one-time purchases are available for expansions and cosmetic dice skins.',
                'In-game currency (gems) is not purchasable and can only be earned through gameplay.',
                'No paid advantages, loot boxes, or randomized monetization systems are included.',
                'Progression is earned entirely through gameplay, except where expansions grant access to additional content.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="5. Expansions and Paid Access">
            <TermsParagraph>Certain optional expansions and cosmetic dice skins may be available for purchase, either with earned in-game gems or with real money.</TermsParagraph>
            <TermsList
              items={[
                'Expansions unlock access to additional content, regions, or systems.',
                'Dice skins are purely cosmetic and do not affect gameplay or odds.',
                'Purchases do not grant competitive advantage or gameplay power over other players.',
                'There are no loot boxes, gambling mechanics, or randomized paid rewards.',
                'Unlocks are permanently tied to the player’s account key.',
                'Purchases are final and non-refundable.',
                'Expansions may be updated, reworked, merged, or restructured over time, while access rights are preserved where technically feasible.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="6. Player Interaction and Communication">
            <TermsParagraph>
              Morkahja does not provide chat, messaging, or direct communication systems.
            </TermsParagraph>
            <TermsList
              items={[
                'Players may experience shared gameplay sessions but must communicate externally through means not provided by the game.',
                'All forms of harassment, hate speech, impersonation, or disruptive behavior are strictly prohibited.',
                'Any behavior that undermines the integrity or safety of the experience is not permitted.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="7. Fair Play and Enforcement">
            <TermsParagraph>Fair play is a core requirement of participation.</TermsParagraph>
            <TermsList
              items={[
                'Cheating, exploitation of bugs, automation, scripting, reverse engineering, or unauthorized modification is strictly prohibited.',
                'Accounts may be suspended, restricted, or permanently banned at any time.',
                'Items, progress, or access may be removed in cases of abuse or violation.',
                'Enforcement decisions are final and may be applied without prior notice.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="8. Data, Privacy, and Minimal Collection">
            <TermsParagraph>Morkahja is designed with a minimal data philosophy.</TermsParagraph>
            <TermsList
              items={[
                'No advertising or behavioral tracking is used.',
                'No user profiling is performed.',
                'No data is sold or shared with third parties.',
                'Only essential data required for gameplay functionality is stored.',
                'Lost data or lost keys cannot be recovered.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="9. Ownership and Licensing">
            <TermsParagraph>Morkahja operates under a hybrid openness model.</TermsParagraph>
            <TermsList
              items={[
                'Game code, assets, and systems are released under the MIT License where applicable.',
                'Players and developers may reuse MIT-licensed components in accordance with that license.',
                'The Morkahja name, identity, and branding remain reserved unless explicitly stated otherwise.',
                'Fan content, streaming, modding, and community creations are permitted and encouraged.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="10. Technical Integrity">
            <TermsParagraph>The integrity of the system must not be compromised.</TermsParagraph>
            <TermsList
              items={[
                'Reverse engineering, automation tools, bots, packet manipulation, or unauthorized clients are strictly forbidden.',
                'Exploiting unintended behavior or bugs for advantage is prohibited.',
                'Attempts to bypass system rules or mechanics may result in enforcement action.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="11. Service Availability and Changes">
            <TermsParagraph>
              Morkahja is an evolving system without fixed guarantees of continuity.
            </TermsParagraph>
            <TermsList
              items={[
                'Servers may be modified, paused, or shut down at any time.',
                'Features, systems, and content may change, evolve, or be removed.',
                'Temporary or permanent resets may occur in rare cases, with efforts made to preserve progress where possible.',
                'No guarantee of uninterrupted availability is provided.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="12. No Warranty">
            <TermsParagraph>
              The service is provided “as is” and “as available”.
            </TermsParagraph>
            <TermsList
              items={[
                'No guarantees are made regarding stability, correctness, or uninterrupted operation.',
                'Bugs, errors, or data loss may occur.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="13. Limitation of Liability">
            <TermsParagraph>To the fullest extent permitted under Swedish law:</TermsParagraph>
            <TermsList
              items={[
                'The developer is not liable for losses arising from service interruptions, bugs, exploits, or data loss.',
                'Use of the service is at the player’s own risk.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="14. Community and Fan Content">
            <TermsParagraph>
              Players are free to engage with Morkahja creatively outside the game.
            </TermsParagraph>
            <TermsList
              items={[
                'Streaming, recording, modding, and fan creations are permitted.',
                'Fan works remain the property of their creators.',
                'Misrepresentation of official status is prohibited.',
                'Malicious redistribution or harmful modification is not allowed.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="15. Age and Responsibility">
            <TermsParagraph>Morkahja contains no explicit content.</TermsParagraph>
            <TermsList
              items={[
                'There is no enforced age restriction.',
                'Use of the service by minors is subject to parental or guardian responsibility where applicable.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="16. Paid Expansions and Cosmetics">
            <TermsParagraph>Morkahja includes optional paid expansions and cosmetic dice skins.</TermsParagraph>
            <TermsList
              items={[
                'Expansions unlock additional content and access rights; dice skins are cosmetic only.',
                'No gameplay advantages are granted through payment.',
                'Purchasable in-game currency and consumable microtransactions do not exist; gems are earned through play.',
                'Purchases are final and non-refundable.',
                'Unlocks remain tied to the player’s account key and cannot be transferred.',
                'Content may evolve over time while access rights are preserved where possible.',
              ]}
            />
          </TermsSection>

          <TermsSection heading="17. Governing Law">
            <TermsParagraph>These Terms are governed by the laws of Sweden.</TermsParagraph>
          </TermsSection>

          <section style={{ ...sectionStyle, borderBottom: 0, paddingBottom: 0, marginBottom: 0 }}>
            <h3 style={sectionHeadingStyle}>18. Final Principle</h3>
            <TermsParagraph>
              Morkahja is not a fixed product but a continuing world. Participation implies acceptance
              that systems, stories, and structures may change as part of its ongoing evolution.
            </TermsParagraph>
          </section>
        </div>
      </section>
    </div>
  );
}

export default TermsOfServiceOverlay;
