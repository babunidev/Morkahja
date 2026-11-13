import type { CSSProperties, ReactNode } from 'react';
import { PanelButton } from './PanelButton.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import { simpleFrameStyle } from './simpleFrame.js';

export const overlayCloseButtonVisualStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 72,
  minHeight: 34,
  // Longer labels (Privacy Policy, Terms of Service) keep clear of the frame.
  padding: '0 10px',
  boxSizing: 'border-box',
  ...simpleFrameStyle({ background: 'rgba(51, 0, 0, 0.82)', opacity: 0.94 }),
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  textAlign: 'center',
};

export function ClosePanelButton({
  children = 'Close',
  disabled = false,
  onClose,
  pressKey,
  visualStyle,
}: {
  children?: ReactNode;
  disabled?: boolean;
  onClose: () => void;
  pressKey: string;
  visualStyle?: CSSProperties;
}) {
  return (
    <PanelButton
      disabled={disabled}
      onClick={() => {
        playSfx(DEFAULT_BUTTON_SOUND);
        onClose();
      }}
      pressKey={pressKey}
      visualStyle={visualStyle ?? overlayCloseButtonVisualStyle}
    >
      {children}
    </PanelButton>
  );
}

export default ClosePanelButton;
