import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  fadeStyle,
  waitForFade,
} from '../transitions/fade.js';
import { resolveLoadingLogoPath } from './backgroundResolver.js';
import {
  getLoadingStateView,
  runLoadingBootstrap,
  type LoadingBootstrapContext,
  type LoadingBootstrapHooks,
  type LoadingRoute,
  type LoadingStateView,
} from './loadingStateMachine.js';

const LOGO_ENTER_MS = 1100;
const LOGO_SWAY_MS = 5600;
/** Start sway before enter finishes so the motion blends together. */
const LOGO_SWAY_DELAY_MS = 720;

export interface LoadingScreenProps<TSession = unknown, TPlayer = unknown, TAvatar = unknown, TEncounter = unknown> {
  hooks?: LoadingBootstrapHooks<TSession, TPlayer, TAvatar, TEncounter>;
  minDurationMs?: number;
  showStatusText?: boolean;
  onReady?: (
    route: LoadingRoute,
    context: LoadingBootstrapContext<TSession, TPlayer, TAvatar, TEncounter>,
  ) => void;
  onError?: (error: unknown) => void;
}

const screenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  color: '#f5f1e8',
  pointerEvents: 'none',
};

const statusContainerStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'max(32px, calc(env(safe-area-inset-bottom) + 28px))',
  zIndex: 3,
  display: 'grid',
  justifyItems: 'center',
  gap: 8,
  width: 'min(92vw, 520px)',
  transform: 'translateX(-50%)',
  pointerEvents: 'none',
};

const statusTextStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'serif',
  fontSize: 'clamp(0.85rem, 2vw, 1rem)',
  letterSpacing: '0.08em',
  textAlign: 'center',
  textShadow: '0 2px 12px rgba(0, 0, 0, 0.85)',
  textTransform: 'uppercase',
};

const retryButtonStyle: CSSProperties = {
  pointerEvents: 'auto',
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid rgba(255, 204, 102, 0.85)',
  background: 'rgba(12, 9, 8, 0.8)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  cursor: 'pointer',
};

const logoStageStyle: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  zIndex: 2,
  width: 'min(155vw, 1050px)',
  maxHeight: '45vh',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

const logoImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  maxHeight: '45vh',
  objectFit: 'contain',
  opacity: 0,
  willChange: 'transform, opacity',
};

function logoStageAnimationStyle(swaying: boolean): CSSProperties {
  if (!swaying) {
    return {};
  }

  return {
    animation: `morkahja-loading-logo-sway ${LOGO_SWAY_MS}ms cubic-bezier(0.45, 0.05, 0.55, 0.95) ${LOGO_SWAY_DELAY_MS}ms infinite`,
    willChange: 'transform',
  };
}

function logoEnterAnimationStyle(): CSSProperties {
  return {
    animation: `morkahja-loading-logo-enter ${LOGO_ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
  };
}

export function LoadingScreen<TSession = unknown, TPlayer = unknown, TAvatar = unknown, TEncounter = unknown>({
  hooks = {},
  minDurationMs = 3000,
  showStatusText = true,
  onReady,
  onError,
}: LoadingScreenProps<TSession, TPlayer, TAvatar, TEncounter>) {
  const [view, setView] = useState<LoadingStateView>(getLoadingStateView('INIT'));
  const [foregroundVisible, setForegroundVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const logoPath = useMemo(() => resolveLoadingLogoPath(), []);
  const logoSwaying = !errorMessage && view.state !== 'READY';

  const foregroundStyle = useMemo<CSSProperties>(
    () => ({
      ...screenStyle,
      ...fadeStyle(foregroundVisible),
    }),
    [foregroundVisible],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setForegroundVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    void runLoadingBootstrap(
      hooks,
      (nextView) => {
        if (mounted) {
          setView(nextView);
        }
      },
      { minDurationMs },
    )
      .then(async (context) => {
        if (!mounted) {
          return;
        }

        setErrorMessage(null);
        setForegroundVisible(false);
        await waitForFade();

        if (mounted) {
          onReady?.(context.route, context);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to connect to backend services.',
          );
          onError?.(error);
        }
      });

    return () => {
      mounted = false;
    };
  }, [hooks, minDurationMs, onError, onReady, retryNonce]);

  return (
    <main
      aria-busy={view.state !== 'READY'}
      aria-label="Loading Morkahja"
      data-loading-state={view.state}
      style={foregroundStyle}
    >
      <style>
        {`
          @keyframes morkahja-loading-logo-enter {
            from {
              opacity: 0;
              transform: translateY(-18vh);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes morkahja-loading-logo-sway {
            0%,
            100% {
              transform: translate(-50%, -50%) rotate(0deg);
            }
            12% {
              transform: translate(-50%, calc(-50% - 2px)) rotate(-0.3deg);
            }
            32% {
              transform: translate(-50%, calc(-50% - 4px)) rotate(-0.55deg);
            }
            50% {
              transform: translate(-50%, calc(-50% + 4px)) rotate(0.55deg);
            }
            68% {
              transform: translate(-50%, calc(-50% - 4px)) rotate(-0.55deg);
            }
            88% {
              transform: translate(-50%, calc(-50% - 2px)) rotate(-0.3deg);
            }
          }
        `}
      </style>

      <div
        style={{
          ...logoStageStyle,
          ...logoStageAnimationStyle(logoSwaying),
        }}
      >
        <img
          alt="Morkahja"
          draggable={false}
          src={logoPath}
          style={{
            ...logoImageStyle,
            ...logoEnterAnimationStyle(),
          }}
        />
      </div>

      {showStatusText || errorMessage ? (
        <section aria-live="polite" style={statusContainerStyle}>
          {showStatusText ? (
            <p style={statusTextStyle}>
              {errorMessage ? 'Connection unavailable' : view.label}
            </p>
          ) : null}
          {errorMessage ? (
            <p
              style={{
                ...statusTextStyle,
                fontSize: 'clamp(0.72rem, 1.7vw, 0.9rem)',
                letterSpacing: '0.04em',
                opacity: 0.76,
                textTransform: 'none',
              }}
            >
              {errorMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <button
              onClick={() => {
                setErrorMessage(null);
                setView(getLoadingStateView('INIT'));
                setRetryNonce((current) => current + 1);
              }}
              style={retryButtonStyle}
              type="button"
            >
              Retry
            </button>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default LoadingScreen;
