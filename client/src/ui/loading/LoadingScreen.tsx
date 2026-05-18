import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  fadeStyle,
  waitForFade,
} from '../transitions/fade.js';
import {
  getLoadingStateView,
  runLoadingBootstrap,
  type LoadingBootstrapContext,
  type LoadingBootstrapHooks,
  type LoadingRoute,
  type LoadingStateView,
} from './loadingStateMachine.js';

const LOGO_ASSET_PATH = '/UI/01_WelcomeScreen/LogoWinter2.svg';
const LOADING_WHEEL_ASSET_PATH = '/UI/01_WelcomeScreen/LoadingWheel.webp';

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

const logoStyle: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  zIndex: 2,
  width: 'min(77.5vw, 525px)',
  maxHeight: '22.5vh',
  transform: 'translate(-50%, -50%)',
  objectFit: 'contain',
  pointerEvents: 'none',
};

const wheelContainerStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'max(32px, calc(env(safe-area-inset-bottom) + 28px))',
  zIndex: 3,
  display: 'grid',
  justifyItems: 'center',
  gap: 12,
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

function wheelStyle(view: LoadingStateView): CSSProperties {
  const isLoading = view.wheelDurationSeconds !== null;

  return {
    width: 'clamp(72px, 16vw, 132px)',
    height: 'clamp(72px, 16vw, 132px)',
    objectFit: 'contain',
    animationName: isLoading ? 'morkahja-loading-wheel-spin' : 'none',
    animationDuration: isLoading ? `${view.wheelDurationSeconds}s` : undefined,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    filter: 'drop-shadow(0 0 14px rgba(244, 232, 190, 0.42))',
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
  const [wheelAssetAvailable, setWheelAssetAvailable] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  }, [hooks, minDurationMs, onError, onReady]);

  return (
    <main
      aria-busy={view.state !== 'READY'}
      aria-label="Loading Morkahja"
      data-loading-state={view.state}
      style={foregroundStyle}
    >
      <style>
        {`
          @keyframes morkahja-loading-wheel-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <img alt="Morkahja" draggable={false} src={LOGO_ASSET_PATH} style={logoStyle} />

      <section aria-live="polite" style={wheelContainerStyle}>
        {wheelAssetAvailable ? (
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={() => {
              setWheelAssetAvailable(false);
            }}
            src={LOADING_WHEEL_ASSET_PATH}
            style={wheelStyle(view)}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              ...wheelStyle(view),
              border: '3px solid rgba(245, 241, 232, 0.2)',
              borderTopColor: 'rgba(245, 241, 232, 0.92)',
              borderRadius: '50%',
            }}
          />
        )}
        {showStatusText ? (
          <p style={statusTextStyle}>
            {errorMessage ? 'Connection unavailable' : view.label}
          </p>
        ) : null}
        {errorMessage ? (
          <p
            style={{
              ...statusTextStyle,
              maxWidth: 'min(78vw, 520px)',
              fontSize: 'clamp(0.72rem, 1.7vw, 0.9rem)',
              letterSpacing: '0.04em',
              opacity: 0.76,
              textTransform: 'none',
            }}
          >
            {errorMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default LoadingScreen;
