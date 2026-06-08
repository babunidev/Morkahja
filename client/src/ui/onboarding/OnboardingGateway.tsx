import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { bootstrapSession, type ClientSession } from '../../api/http.js';
import { seedDefaultAudioVolumesIfUnset } from '../audioVolume.js';
import { PanelButton } from '../common/PanelButton.js';
import { protectedImageProps } from '../protectedImage.js';
import {
  deviceKeypair,
  downloadRecoveryKey,
  generateKeypair,
  publicKeyString,
  readRecoveryKey,
  recoveryKeyFilename,
  saveIdentityKeypair,
  RESTORE_CHALLENGE_PREFIX,
  signChallenge,
} from '../../sessionKeys.js';
import PrivacyPolicyOverlay from './PrivacyPolicyOverlay.js';
import RecoveryKeyInfoOverlay from './RecoveryKeyInfoOverlay.js';
import TermsOfServiceOverlay from './TermsOfServiceOverlay.js';

const ONBOARDING_FADE_MS = 730;

const BACKGROUND = '/UI/01_2_Agreement/menuBGplayerCreation.webp';
const FALLBACK_BACKGROUND = '/UI/01_1_SignIn/menuBG.webp';
const JOURNEY_EMBLEM = '/UI/01_2_Agreement/NEWAgreeButt.png';

type Mode = 'gateway' | 'new';

const hiddenFileInputStyle: CSSProperties = {
  display: 'none',
};

const screenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  boxSizing: 'border-box',
  backgroundColor: '#160905',
  backgroundImage: `url(${BACKGROUND}), url(${FALLBACK_BACKGROUND})`,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  color: '#ffcc66',
};

const panelStyle: CSSProperties = {
  width: 'min(86vw, 520px)',
  display: 'grid',
  gap: 14,
  padding: '24px 22px',
  border: '1px solid rgba(255, 204, 102, 0.55)',
  borderRadius: 16,
  background: 'rgba(17, 7, 4, 0.78)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.46)',
  textAlign: 'center',
};

const titleGroupStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  justifyItems: 'center',
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#330000',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(1.8rem, 8vw, 3rem)',
  lineHeight: 1.1,
  WebkitTextStroke: '1px #ffcc66',
  paintOrder: 'stroke fill',
};

const welcomeStyle: CSSProperties = {
  margin: 0,
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(1rem, 3.6vw, 1.2rem)',
  letterSpacing: '0.04em',
  lineHeight: 1.3,
};

const journeyEmblemStyle: CSSProperties = {
  display: 'block',
  width: 'min(100%, 340px)',
  height: 'auto',
  maxHeight: 120,
  margin: '0 auto',
  objectFit: 'contain',
  filter: 'drop-shadow(0 8px 18px rgba(0, 0, 0, 0.45))',
};

const stepContentStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 14,
  width: '100%',
};

const panelButtonVisualStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 16px',
  border: '1px solid rgba(255, 204, 102, 0.7)',
  borderRadius: 10,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
  letterSpacing: '0.03em',
  boxSizing: 'border-box',
};

const primaryPanelButtonVisualStyle: CSSProperties = {
  ...panelButtonVisualStyle,
  minHeight: 48,
  fontSize: '1.02rem',
};

const infoPanelButtonVisualStyle: CSSProperties = {
  ...panelButtonVisualStyle,
  minHeight: 40,
  width: 'auto',
  minWidth: 120,
  padding: '8px 18px',
  fontSize: '0.92rem',
};

const fullWidthPanelButtonStyle: CSSProperties = {
  display: 'block',
  width: 'min(100%, 340px)',
  margin: '0 auto',
};

const fieldStyle: CSSProperties = {
  minHeight: 40,
  padding: '0 12px',
  border: '1px solid rgba(255, 204, 102, 0.65)',
  borderRadius: 8,
  background: 'rgba(255, 240, 200, 0.92)',
  color: '#330000',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
};

const checkboxLabelStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'center',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.9rem',
  textAlign: 'center',
  maxWidth: 360,
};

const policyLinkButtonStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: '#ffcc66',
  font: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
  cursor: 'pointer',
};

const warningStyle: CSSProperties = {
  margin: 0,
  color: '#ffdf91',
  fontFamily: 'Georgia, serif',
  fontSize: '0.88rem',
};

const newJourneyFormStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 14,
  width: '100%',
};

const centeredFieldStyle: CSSProperties = {
  ...fieldStyle,
  width: 'min(100%, 340px)',
  textAlign: 'center',
};

const agreementBlockStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 10,
  width: '100%',
};

function scheduleOnboardingFadeIn(onVisible: () => void): () => void {
  let raf2 = 0;
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(onVisible);
  });

  return () => {
    cancelAnimationFrame(raf1);
    if (raf2) {
      cancelAnimationFrame(raf2);
    }
  };
}

function waitForOnboardingFade(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ONBOARDING_FADE_MS);
  });
}

function onboardingFadeStyle(visible: boolean): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transition: `opacity ${ONBOARDING_FADE_MS}ms ease`,
    willChange: 'opacity',
  };
}

export function OnboardingGateway({
  onSessionReady,
}: {
  onSessionReady: (session: ClientSession) => void;
}) {
  const [mode, setMode] = useState<Mode>('gateway');
  const [playerName, setPlayerName] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [keyAcknowledged, setKeyAcknowledged] = useState(false);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [termsOfServiceOpen, setTermsOfServiceOpen] = useState(false);
  const [recoveryInfoOpen, setRecoveryInfoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [screenVisible, setScreenVisible] = useState(false);
  const [screenExiting, setScreenExiting] = useState(false);
  const [stepVisible, setStepVisible] = useState(true);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const stepFadeInCleanupRef = useRef<(() => void) | null>(null);
  const trimmedPlayerName = playerName.trim();
  const recoveryFileName = recoveryKeyFilename(trimmedPlayerName);
  const canCreate = trimmedPlayerName.length > 0 && policyAccepted && termsAccepted && keyAcknowledged && !busy;

  useEffect(() => {
    setScreenVisible(false);
    return scheduleOnboardingFadeIn(() => {
      setScreenVisible(true);
    });
  }, []);

  useEffect(() => {
    return () => {
      stepFadeInCleanupRef.current?.();
    };
  }, []);

  async function transitionToMode(next: Mode): Promise<void> {
    if (busy || next === mode) {
      return;
    }

    stepFadeInCleanupRef.current?.();
    stepFadeInCleanupRef.current = null;
    setStepVisible(false);
    await waitForOnboardingFade();
    setMode(next);
    stepFadeInCleanupRef.current = scheduleOnboardingFadeIn(() => {
      setStepVisible(true);
      stepFadeInCleanupRef.current = null;
    });
  }

  function openRestoreFilePicker(): void {
    if (busy) {
      return;
    }

    restoreInputRef.current?.click();
  }

  async function finishOnboarding(session: ClientSession): Promise<void> {
    setScreenExiting(true);
    await waitForOnboardingFade();
    onSessionReady(session);
  }

  async function startNewJourney(): Promise<void> {
    if (!canCreate) {
      return;
    }

    setBusy(true);
    setMessage('Creating your recovery key...');

    try {
      const [device, identity] = await Promise.all([deviceKeypair(), generateKeypair()]);
      const session = await bootstrapSession({
        devicePublicKey: publicKeyString(device.publicKey),
        identityPublicKey: publicKeyString(identity.publicKey),
        playerName: trimmedPlayerName,
      });

      saveIdentityKeypair(session.playerId, identity);
      downloadRecoveryKey(identity, session.playerName);
      seedDefaultAudioVolumesIfUnset();
      await finishOnboarding(session);
    } catch (error) {
      console.error('New journey bootstrap failed', error);
      setMessage('Could not create journey. Check the backend connection.');
      setBusy(false);
    }
  }

  async function restoreJourney(file: File | null): Promise<void> {
    if (!file || busy) {
      return;
    }

    setBusy(true);
    setMessage('Restoring your journey...');

    try {
      const [device, recoveryKey] = await Promise.all([deviceKeypair(), readRecoveryKey(file)]);
      const identityPublicKey = publicKeyString(recoveryKey.publicKey);
      const challenge = `${RESTORE_CHALLENGE_PREFIX}${identityPublicKey}`;
      const signature = await signChallenge(recoveryKey.privateKey, challenge);
      const session = await bootstrapSession({
        devicePublicKey: publicKeyString(device.publicKey),
        identityPublicKey,
        signedIdentityChallenge: { challenge, signature },
      });

      saveIdentityKeypair(session.playerId, {
        privateKey: recoveryKey.privateKey,
        publicKey: recoveryKey.publicKey,
      });
      seedDefaultAudioVolumesIfUnset();
      await finishOnboarding(session);
    } catch (error) {
      console.error('Restore journey failed', error);
      setMessage('Could not restore journey from this key.');
      setBusy(false);
    }
  }

  const screenOpacity = screenVisible && !screenExiting;

  return (
    <main
      aria-label="Morkahja Onboarding"
      style={{
        ...screenStyle,
        ...onboardingFadeStyle(screenOpacity),
        pointerEvents: screenOpacity ? 'auto' : 'none',
      }}
    >
      <input
        ref={restoreInputRef}
        accept=".key,application/json"
        aria-hidden="true"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = '';
          void restoreJourney(file);
        }}
        style={hiddenFileInputStyle}
        tabIndex={-1}
        type="file"
      />
      <section style={panelStyle}>
        <div style={titleGroupStyle}>
          <h1 style={titleStyle}>Morkahja</h1>
          <p style={welcomeStyle}>Welcome, Adventurer!</p>
        </div>
        <div
          style={{
            ...stepContentStyle,
            ...onboardingFadeStyle(stepVisible),
            pointerEvents: stepVisible ? 'auto' : 'none',
          }}
        >
        {mode === 'gateway' ? (
          <>
            <PanelButton
              disabled={busy}
              onClick={() => void transitionToMode('new')}
              pressKey="onboarding-start-new"
              style={fullWidthPanelButtonStyle}
              visualStyle={panelButtonVisualStyle}
            >
              Start New Journey
            </PanelButton>
            <PanelButton
              disabled={busy}
              onClick={openRestoreFilePicker}
              pressKey="onboarding-restore"
              style={fullWidthPanelButtonStyle}
              visualStyle={panelButtonVisualStyle}
            >
              Restore Existing Journey
            </PanelButton>
          </>
        ) : null}
        {mode === 'new' ? (
          <div style={newJourneyFormStyle}>
            <img
              alt=""
              aria-hidden="true"
              {...protectedImageProps}
              src={JOURNEY_EMBLEM}
              style={journeyEmblemStyle}
            />
            <input
              aria-label="Player Name"
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Player Name"
              style={centeredFieldStyle}
              value={playerName}
            />
            <div style={agreementBlockStyle}>
              <label style={checkboxLabelStyle}>
                <input
                  checked={keyAcknowledged}
                  onChange={(event) => setKeyAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                I understand that my Morkahja recovery key is required to restore access.
              </label>
              <PanelButton
                onClick={() => setRecoveryInfoOpen(true)}
                pressKey="onboarding-recovery-info"
                visualStyle={infoPanelButtonVisualStyle}
              >
                Info
              </PanelButton>
              <label style={checkboxLabelStyle}>
                <input
                  checked={policyAccepted}
                  onChange={(event) => setPolicyAccepted(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I accept the{' '}
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPrivacyPolicyOpen(true);
                    }}
                    style={policyLinkButtonStyle}
                    type="button"
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </label>
              <label style={checkboxLabelStyle}>
                <input
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I accept the{' '}
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setTermsOfServiceOpen(true);
                    }}
                    style={policyLinkButtonStyle}
                    type="button"
                  >
                    Terms of Service
                  </button>
                  .
                </span>
              </label>
            </div>
            <PanelButton
              disabled={!canCreate}
              onClick={() => void startNewJourney()}
              pressKey="onboarding-create-journey"
              style={{
                ...fullWidthPanelButtonStyle,
                opacity: canCreate ? 1 : 0.45,
              }}
              visualStyle={primaryPanelButtonVisualStyle}
            >
              Create Journey
            </PanelButton>
            <PanelButton
              disabled={busy}
              onClick={() => void transitionToMode('gateway')}
              pressKey="onboarding-back-new"
              style={fullWidthPanelButtonStyle}
              visualStyle={panelButtonVisualStyle}
            >
              Back
            </PanelButton>
          </div>
        ) : null}
        {message ? <p style={warningStyle}>{message}</p> : null}
        </div>
      </section>
      <RecoveryKeyInfoOverlay
        onClose={() => {
          setRecoveryInfoOpen(false);
        }}
        open={recoveryInfoOpen}
        recoveryFileName={recoveryFileName}
      />
      <PrivacyPolicyOverlay
        onClose={() => {
          setPrivacyPolicyOpen(false);
        }}
        open={privacyPolicyOpen}
      />
      <TermsOfServiceOverlay
        onClose={() => {
          setTermsOfServiceOpen(false);
        }}
        open={termsOfServiceOpen}
      />
    </main>
  );
}

export default OnboardingGateway;
