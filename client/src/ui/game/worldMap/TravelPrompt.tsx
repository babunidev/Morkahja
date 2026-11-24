import type { CSSProperties } from 'react';

import GemCost from '../../common/GemCost.js';
import HelpTip from '../../common/HelpTip.js';
import { simpleFrameStyle } from '../../common/simpleFrame.js';
import { AcceptButton, BackButton } from '../../common/WordButton.js';
import type { TravelTarget } from './worldMapData.js';

/**
 * The question after a tap on the map (D-056, Babuni, 2026-11-23): travel
 * there for gems, or, for a region not unlocked yet, take a look at its
 * expansion. Back and Accept answer it. Within three encounters of the last
 * trip it says only that travel is not possible right now; the "?"
 * tip explains why.
 */

const shadeStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 3,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: 'rgba(8, 4, 2, 0.45)',
};

const boxStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 10,
  width: 'min(100%, 340px)',
  padding: '20px 18px 14px',
  ...simpleFrameStyle({ background: 'rgba(34, 6, 3, 0.97)', opacity: 0.94 }),
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.92rem, 3.6vw, 1.05rem)',
  lineHeight: 1.4,
  textAlign: 'center',
};

const nameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(1.05rem, 4vw, 1.25rem)',
  letterSpacing: '0.04em',
};

const lineStyle: CSSProperties = {
  margin: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: '#ff9a7a',
  fontSize: 'clamp(0.78rem, 3vw, 0.9rem)',
};

const buttonsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
  marginTop: 4,
};



export default function TravelPrompt({ target, locked, cost, waitEncounters = 0, pending, error, onNo, onYes }: {
  target: TravelTarget;
  locked: boolean;
  cost: number;
  /** Encounters still to play after the last trip; above 0 the trip is not offered (Babuni, 2026-11-24). */
  waitEncounters?: number;
  pending: boolean;
  error: string | null;
  onNo: () => void;
  onYes: () => void;
}) {
  const waiting = waitEncounters > 0 && !locked;
  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onNo();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="presentation"
      style={shadeStyle}
    >
      <div
        aria-label={locked ? `${target.name} is not unlocked` : waiting ? 'You cannot travel right now' : `Travel to ${target.name}`}
        role="alertdialog"
        style={boxStyle}
      >
        {locked ? (
          <>
            <p style={lineStyle}>You have not unlocked</p>
            <p style={nameStyle}>{target.name}</p>
            <p style={lineStyle}>yet. Would you like to take a look?</p>
          </>
        ) : waiting ? (
          <>
            {/* Only the sentence; the why is in the "?" when tips are on (Babuni, 2026-11-24). */}
            <p style={lineStyle}>
              <span>You cannot travel right now.</span>
              <HelpTip
                label="Why can I not travel?"
                text={`After a journey you play three encounters before the next one. Play ${waitEncounters} more ${waitEncounters === 1 ? 'encounter' : 'encounters'} first.`}
              />
            </p>
          </>
        ) : (
          <>
            <p style={lineStyle}>Travel to</p>
            <p style={nameStyle}>{target.name}?</p>
            <p style={lineStyle}><span>It costs</span><span><GemCost cost={cost} withLabel={false} />.</span><span>Are you sure?</span></p>
          </>
        )}
        {error ? <p role="alert" style={errorStyle}>{error}</p> : null}
        <div style={{ ...buttonsStyle, justifyContent: waiting ? 'center' : 'space-between' }}>
          <BackButton ariaLabel={waiting ? 'Back' : 'No'} disabled={pending} onClick={onNo} pressKey="travel-no" />
          {waiting ? null : (
            <AcceptButton
              ariaLabel={locked ? 'Yes, show the expansion' : 'Yes, travel'}
              disabled={pending}
              onClick={onYes}
              pressKey="travel-yes"
            />
          )}
        </div>
      </div>
    </div>
  );
}
