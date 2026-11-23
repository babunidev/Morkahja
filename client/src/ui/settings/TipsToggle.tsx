import type { CSSProperties } from 'react';

import PanelButton from '../common/PanelButton.js';
import { simpleFrameStyle } from '../common/simpleFrame.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import { setTipsEnabled, useTipsEnabled } from '../tips.js';

/**
 * Tips and tutorial (Babuni, 2026-11-23): a check mark that turns every "?"
 * help in the game on or off, and later the tutorial's tips.
 */

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
};

const boxStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  width: 30,
  height: 30,
  ...simpleFrameStyle({ background: 'rgba(51, 0, 0, 0.82)', opacity: 0.94, scale: 0.6 }),
  color: '#ffcc66',
  fontSize: '1.15rem',
  fontWeight: 700,
  lineHeight: 1,
};

export default function TipsToggle() {
  const enabled = useTipsEnabled();
  return (
    <div style={rowStyle}>
      <span id="tips-toggle-label">Tips and tutorial</span>
      <PanelButton
        aria-checked={enabled}
        aria-labelledby="tips-toggle-label"
        onClick={() => {
          playSfx(DEFAULT_BUTTON_SOUND);
          setTipsEnabled(!enabled);
        }}
        pressKey="settings-tips"
        role="checkbox"
        visualStyle={boxStyle}
      >
        <span aria-hidden="true">{enabled ? '✓' : ''}</span>
      </PanelButton>
    </div>
  );
}
