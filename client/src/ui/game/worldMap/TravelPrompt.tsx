import type { CSSProperties } from 'react';

import { assetUrl } from '../../../assetUrl.js';
import GemCost from '../../common/GemCost.js';
import { simpleFrameStyle } from '../../common/simpleFrame.js';
import { useNavButtonPress } from '../../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../../sfx.js';
import type { TravelTarget } from './worldMapData.js';

/**
 * The question after a tap on the map (D-056, Babuni, 2026-11-23): travel
 * there for gems, or, for a region not unlocked yet, take a look at its
 * expansion. Red says no, green says yes.
 */

const UI_ROOT = assetUrl('/UI/02_AvatarCreation');

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

const buttonStyle: CSSProperties = {
  width: 'clamp(50px, 12vw, 64px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const imageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5))',
};

export default function TravelPrompt({ target, locked, cost, pending, error, onNo, onYes }: {
  target: TravelTarget;
  locked: boolean;
  cost: number;
  pending: boolean;
  error: string | null;
  onNo: () => void;
  onYes: () => void;
}) {
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
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
      <div aria-label={locked ? `${target.name} is not unlocked` : `Travel to ${target.name}`} role="alertdialog" style={boxStyle}>
        {locked ? (
          <>
            <p style={lineStyle}>You have not unlocked</p>
            <p style={nameStyle}>{target.name}</p>
            <p style={lineStyle}>yet. Would you like to take a look?</p>
          </>
        ) : (
          <>
            <p style={lineStyle}>Travel to</p>
            <p style={nameStyle}>{target.name}?</p>
            <p style={lineStyle}><span>It costs</span><span><GemCost cost={cost} withLabel={false} />.</span><span>Are you sure?</span></p>
          </>
        )}
        {error ? <p role="alert" style={errorStyle}>{error}</p> : null}
        <div style={buttonsStyle}>
          <button
            aria-label="No"
            className="morkahja-panel-button"
            disabled={pending}
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onNo();
            }}
            onPointerDown={() => pulse('travel-no')}
            style={buttonStyle}
            type="button"
          >
            <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_button_delete.webp`} style={{ ...imageStyle, animation: pressAnimation(isPressed('travel-no')) }} />
          </button>
          <button
            aria-label={locked ? 'Yes, show the expansion' : 'Yes, travel'}
            className="morkahja-panel-button"
            disabled={pending}
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onYes();
            }}
            onPointerDown={() => pulse('travel-yes')}
            style={{ ...buttonStyle, opacity: pending ? 0.6 : 1 }}
            type="button"
          >
            <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_button_yes.webp`} style={{ ...imageStyle, animation: pressAnimation(isPressed('travel-yes')) }} />
          </button>
        </div>
      </div>
    </div>
  );
}
