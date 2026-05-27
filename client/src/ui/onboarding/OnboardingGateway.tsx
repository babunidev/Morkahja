import { useState, type CSSProperties } from 'react';
import { bootstrapSession, type ClientSession } from '../../api/http.js';
import { seedDefaultAudioVolumesIfUnset } from '../audioVolume.js';
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
import TermsOfServiceOverlay from './TermsOfServiceOverlay.js';

const BACKGROUND = '/UI/01_2_Agreement/menuBGplayerCreation.webp';
const FALLBACK_BACKGROUND = '/UI/01_1_SignIn/menuBG.webp';
const AGREE_BUTTON = '/UI/01_2_Agreement/NEWAgreeButt.png';

type Mode = 'gateway' | 'new' | 'restore';

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

const buttonStyle: CSSProperties = {
  minHeight: 44,
  border: '1px solid rgba(255, 204, 102, 0.7)',
  borderRadius: 10,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
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
};

const centeredFieldStyle: CSSProperties = {
  ...fieldStyle,
  width: 'min(100%, 340px)',
  textAlign: 'center',
};

const keyNoticeStyle: CSSProperties = {
  ...warningStyle,
  maxWidth: 360,
  lineHeight: 1.32,
  textAlign: 'center',
};

const keyFileNameStyle: CSSProperties = {
  display: 'block',
  marginTop: 4,
  color: '#ffcc66',
  fontWeight: 700,
};

const newJourneyButtonStyle: CSSProperties = {
  ...buttonStyle,
  width: 'min(100%, 340px)',
};

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const trimmedPlayerName = playerName.trim();
  const recoveryFileName = recoveryKeyFilename(trimmedPlayerName);
  const canCreate = trimmedPlayerName.length > 0 && policyAccepted && termsAccepted && keyAcknowledged && !busy;

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
      setMessage(`Losing ${recoveryKeyFilename(session.playerName)} means permanent loss of access.`);
      onSessionReady(session);
    } catch (error) {
      console.error('New journey bootstrap failed', error);
      setMessage('Could not create journey. Check the backend connection.');
    } finally {
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
      onSessionReady(session);
    } catch (error) {
      console.error('Restore journey failed', error);
      setMessage('Could not restore journey from this key.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main aria-label="Morkahja Onboarding" style={screenStyle}>
      <section style={panelStyle}>
        <div style={titleGroupStyle}>
          <h1 style={titleStyle}>Morkahja</h1>
          <p style={welcomeStyle}>Welcome, Adventurer!</p>
        </div>
        {mode === 'gateway' ? (
          <>
            <button onClick={() => setMode('new')} style={buttonStyle} type="button">Start New Journey</button>
            <button onClick={() => setMode('restore')} style={buttonStyle} type="button">Restore Existing Journey</button>
          </>
        ) : null}
        {mode === 'new' ? (
          <div style={newJourneyFormStyle}>
            <input
              aria-label="Player Name"
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Player Name"
              style={centeredFieldStyle}
              value={playerName}
            />
            <label style={checkboxLabelStyle}>
              <input checked={policyAccepted} onChange={(event) => setPolicyAccepted(event.target.checked)} type="checkbox" />
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
              <input checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} type="checkbox" />
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
            <label style={checkboxLabelStyle}>
              <input checked={keyAcknowledged} onChange={(event) => setKeyAcknowledged(event.target.checked)} type="checkbox" />
              I understand that my Morkahja recovery key is required to restore access.
            </label>
            <p style={keyNoticeStyle}>
              Creating your journey will automatically download your recovery file.
              <span style={keyFileNameStyle}>{recoveryFileName}</span>
              Keep it somewhere safe.
              Losing this file means permanent loss of access.
            </p>
            <button
              disabled={!canCreate}
              onClick={() => void startNewJourney()}
              style={{
                ...newJourneyButtonStyle,
                minHeight: 56,
                opacity: canCreate ? 1 : 0.45,
                backgroundImage: `url(${AGREE_BUTTON})`,
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
              }}
              type="button"
            >
              Create Journey
            </button>
            <button disabled={busy} onClick={() => setMode('gateway')} style={newJourneyButtonStyle} type="button">Back</button>
          </div>
        ) : null}
        {mode === 'restore' ? (
          <>
            <input
              accept=".key,application/json"
              disabled={busy}
              onChange={(event) => void restoreJourney(event.target.files?.[0] ?? null)}
              style={fieldStyle}
              type="file"
            />
            <button disabled={busy} onClick={() => setMode('gateway')} style={buttonStyle} type="button">Back</button>
          </>
        ) : null}
        {message ? <p style={warningStyle}>{message}</p> : null}
      </section>
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
