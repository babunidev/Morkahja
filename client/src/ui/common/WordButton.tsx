import type { CSSProperties } from 'react';

import PanelButton from './PanelButton.js';
import { simpleFrameStyle } from './simpleFrame.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

/**
 * Accept and Back (Babuni, 2026-11-24): normal red-and-gold buttons with the
 * word on them, everywhere in the game, instead of the green check and the
 * red round picture. They press and glow like every other panel button.
 */

const visualStyle: CSSProperties = {
  minWidth: 'clamp(84px, 22vw, 112px)',
  minHeight: 38,
  padding: '6px 18px',
  ...simpleFrameStyle({ background: 'rgba(51, 0, 0, 0.88)', opacity: 0.94 }),
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.9rem, 3.4vw, 1.02rem)',
  letterSpacing: '0.02em',
};

export function WordButton({
  word,
  ariaLabel,
  onClick,
  disabled = false,
  pressKey,
  style,
}: {
  word: string;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  pressKey: string;
  /** Placement only, for example a grid column. */
  style?: CSSProperties;
}) {
  return (
    <PanelButton
      aria-label={ariaLabel ?? word}
      disabled={disabled}
      onClick={() => {
        playSfx(DEFAULT_BUTTON_SOUND);
        onClick();
      }}
      pressKey={pressKey}
      style={{ ...style, opacity: disabled ? 0.6 : style?.opacity }}
      visualStyle={visualStyle}
    >
      {word}
    </PanelButton>
  );
}

export function AcceptButton(props: Omit<Parameters<typeof WordButton>[0], 'word'> & { word?: string }) {
  return <WordButton {...props} word={props.word ?? 'Accept'} />;
}

export function BackButton(props: Omit<Parameters<typeof WordButton>[0], 'word'> & { word?: string }) {
  return <WordButton {...props} word={props.word ?? 'Back'} />;
}
