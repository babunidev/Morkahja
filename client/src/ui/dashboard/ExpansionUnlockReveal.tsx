import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { acknowledgeExpansionReveal, fetchExpansionReveals } from '../../api/http.js';
import { gameExpansions } from '../../data/gameContent.js';
import { AcceptButton } from '../common/WordButton.js';
import { LineFrame, framedStyle } from '../common/LineFrame.js';
import { simpleFrameClipPath, simpleFrameStyle, simpleFrameVariant } from '../common/simpleFrame.js';
import {
  protectedImageProps,
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import {
  buildEncountersByExpansion,
  expansionAsset,
  pickRandomEncounterPreviews,
  type EncounterPreviewEntry,
  type ExpansionRecord,
} from './ExpansionsOverlay.js';
import { EXPANSION_REVEAL_CHECK_EVENT } from './expansionRevealEvents.js';

/**
 * The expansion unlock card (Babuni, 2026-11-26, D-068). When an expansion is
 * unlocked on its own (gems, a purchase, Homecoming, the Soul Link welcome
 * gift), its card appears in the dashboard: a red LOCKED band across the
 * middle fades out, a green UNLOCKED band pops in and fades, then the text and
 * three encounter previews can be read, and Proceed closes it.
 */

const REVEAL_POLL_MS = 15_000;
const PREVIEW_COUNT = 3;

type Phase = 'locked' | 'unlocking' | 'unlocked' | 'reading';

/** When each phase begins, in ms after the card is shown. */
const PHASE_AT: Record<Exclude<Phase, 'locked'>, number> = {
  unlocking: 1000,
  unlocked: 1500,
  reading: 2700,
};

const RED = 'rgb(214, 58, 48)';
const GREEN = 'rgb(120, 220, 140)';

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 30,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.8)',
  transition: 'opacity 300ms ease',
};

const panelStyle: CSSProperties = {
  width: 'min(100%, 456px)',
  maxHeight: 'min(90vh, 720px)',
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  gap: 14,
  padding: '18px 16px 16px',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.95)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  overflow: 'hidden',
  ...protectedOverlayTextStyle,
  boxSizing: 'border-box',
};

const bodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  display: 'grid',
  gap: 12,
  alignContent: 'start',
  scrollbarWidth: 'none',
};

const cardStyle: CSSProperties = {
  ...simpleFrameStyle({ background: 'rgba(8, 5, 4, 0.55)', color: RED, opacity: 0.6 }),
  position: 'relative',
  padding: 4,
  overflow: 'hidden',
  transition: 'box-shadow 600ms ease',
};

const cardUnlockedStyle: CSSProperties = {
  ...simpleFrameVariant({ background: 'rgba(8, 5, 4, 0.55)', color: GREEN, opacity: 0.6 }),
  boxShadow: 'inset 0 0 0 1px rgba(140, 230, 160, 0.18)',
};

const bannerStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  clipPath: simpleFrameClipPath(1, 6),
  transition: 'filter 700ms ease',
};

const bandStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  display: 'grid',
  placeItems: 'center',
  padding: '10px 0',
  background: 'rgba(8, 4, 2, 0.78)',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(1.4rem, 6vw, 1.9rem)',
  letterSpacing: '0.24em',
  pointerEvents: 'none',
  transition: 'opacity 450ms ease, transform 380ms cubic-bezier(0.2, 1.4, 0.4, 1)',
};

const textBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: '12px 12px 10px',
  transition: 'opacity 600ms ease',
};

const nameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.25rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
};

const statusStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(140, 230, 160, 0.92)',
  fontSize: '0.8rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const summaryStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.94)',
  fontSize: '0.92rem',
  lineHeight: 1.45,
};

const textStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.88rem',
  lineHeight: 1.55,
};

const previewListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 8,
};

const previewRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
};

const previewImageStyle: CSSProperties = {
  display: 'block',
  width: 72,
  height: 48,
  objectFit: 'cover',
  clipPath: simpleFrameClipPath(0.8, 5),
};

const previewTitleStyle: CSSProperties = {
  margin: 0,
  color: '#f7efe0',
  fontSize: '0.9rem',
};

const footerStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  transition: 'opacity 400ms ease',
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function findExpansion(expansionId: number): ExpansionRecord | null {
  const records = gameExpansions() as Record<string, ExpansionRecord>;
  return Object.values(records).find((entry) => entry.mExtensioID === expansionId) ?? null;
}

function Band({ word, color, visible, popped }: {
  word: string;
  color: string;
  visible: boolean;
  popped: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...bandStyle,
        color,
        borderTop: `2px solid ${color}`,
        borderBottom: `2px solid ${color}`,
        opacity: visible ? 1 : 0,
        transform: `translateY(-50%) scale(${popped ? 1 : 1.18})`,
      }}
    >
      {word}
    </div>
  );
}

export function ExpansionUnlockCard({ expansion, onProceed }: {
  expansion: ExpansionRecord;
  onProceed: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'reading' : 'locked'));
  const [shown, setShown] = useState(false);
  const previews = useMemo<EncounterPreviewEntry[]>(() => {
    const pool = buildEncountersByExpansion().get(expansion.mExtensioID) ?? [];
    return pickRandomEncounterPreviews(pool, PREVIEW_COUNT);
  }, [expansion.mExtensioID]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    if (prefersReducedMotion()) {
      return () => window.cancelAnimationFrame(frame);
    }
    const timers = (Object.entries(PHASE_AT) as Array<[Phase, number]>).map(([next, at]) =>
      window.setTimeout(() => setPhase(next), at));
    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const reading = phase === 'reading';
  const opened = phase === 'unlocked' || reading;

  return (
    <div
      aria-label={`${expansion.mExtensioName} unlocked`}
      aria-modal="true"
      role="dialog"
      {...protectedOverlaySurfaceProps}
      style={{ ...backdropStyle, opacity: shown ? 1 : 0 }}
    >
      <section {...protectedOverlaySurfaceProps} style={framedStyle(panelStyle)}>
        <LineFrame background={panelStyle.background} />
        <div style={bodyStyle}>
          <article style={{ ...cardStyle, ...(opened ? cardUnlockedStyle : null) }}>
            <div style={{ position: 'relative' }}>
              <img
                alt=""
                aria-hidden="true"
                {...protectedImageProps}
                src={expansionAsset(expansion.mExtensioHeaderImage)}
                style={{ ...bannerStyle, filter: opened ? 'none' : 'grayscale(0.7) brightness(0.6)' }}
              />
              <Band word="LOCKED" color={RED} visible={phase === 'locked'} popped />
              <Band word="UNLOCKED" color={GREEN} visible={phase === 'unlocked'} popped={opened} />
            </div>
            <div style={{ ...textBlockStyle, opacity: reading ? 1 : 0.12 }}>
              <h2 style={nameStyle}>{expansion.mExtensioName}</h2>
              <p style={statusStyle}>Unlocked</p>
              <p style={summaryStyle}>{expansion.mExtensioSummaryText}</p>
              {previews.length > 0 ? (
                <ul aria-label="Encounter preview" style={previewListStyle}>
                  {previews.map((encounter) => (
                    <li key={encounter.encounterId} style={previewRowStyle}>
                      <img
                        alt=""
                        aria-hidden="true"
                        {...protectedImageProps}
                        src={encounter.imageSrc}
                        style={previewImageStyle}
                      />
                      <p style={previewTitleStyle}>{encounter.title}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p style={textStyle}>{expansion.mExtensioText}</p>
            </div>
          </article>
        </div>
        <div style={{ ...footerStyle, opacity: reading ? 1 : 0, pointerEvents: reading ? 'auto' : 'none' }}>
          <AcceptButton
            disabled={!reading}
            onClick={onProceed}
            pressKey={`expansion-reveal-proceed-${expansion.mExtensioID}`}
            word="Proceed"
          />
        </div>
      </section>
    </div>
  );
}

/**
 * Shows due unlock cards one after another while the dashboard is open, so
 * an unlock earned during play waits until the encounter is over.
 */
export function ExpansionRevealHost({ active }: { active: boolean }) {
  const [queue, setQueue] = useState<number[]>([]);
  const acknowledgingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetchExpansionReveals();
      // An id the client does not know (a newer catalog) is cleared without a card.
      for (const unknownId of response.expansionIds.filter((id) => !findExpansion(id))) {
        void acknowledgeExpansionReveal(unknownId).catch(() => undefined);
      }
      if (!acknowledgingRef.current) {
        setQueue(response.expansionIds.filter((id) => findExpansion(id) !== null));
      }
    } catch {
      // Tried again on the next check.
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), REVEAL_POLL_MS);
    const onCheck = (): void => void refresh();
    window.addEventListener(EXPANSION_REVEAL_CHECK_EVENT, onCheck);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener(EXPANSION_REVEAL_CHECK_EVENT, onCheck);
    };
  }, [active, refresh]);

  const currentId = queue[0];
  const expansion = currentId !== undefined ? findExpansion(currentId) : null;

  const acknowledge = useCallback(async (expansionId: number) => {
    acknowledgingRef.current = true;
    setQueue((current) => current.filter((entry) => entry !== expansionId));
    try {
      await acknowledgeExpansionReveal(expansionId);
    } catch (error) {
      console.error('Could not mark the expansion unlock as seen', error);
    } finally {
      acknowledgingRef.current = false;
    }
  }, []);

  if (!active || !expansion) {
    return null;
  }

  return (
    <ExpansionUnlockCard
      expansion={expansion}
      key={expansion.mExtensioID}
      onProceed={() => void acknowledge(expansion.mExtensioID)}
    />
  );
}

export default ExpansionRevealHost;
