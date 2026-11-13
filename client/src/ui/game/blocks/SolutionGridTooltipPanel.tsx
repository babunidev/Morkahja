import type { CSSProperties } from 'react';
import { GameTooltipFrame, gameTooltipFrameStyle } from '../GameTooltip.js';
import type { SolutionGridEntry } from './SolutionGridOverlay.js';

const tooltipPanelStyle: CSSProperties = {
  ...gameTooltipFrameStyle,
  position: 'relative',
  width: '100%',
  overflow: 'visible',
};

const tooltipTitleStyle: CSSProperties = {
  margin: '0 0 4px',
  color: '#ffcc66',
  fontSize: 'clamp(0.78rem, 3vw, 0.92rem)',
  fontWeight: 700,
  lineHeight: 1.15,
  textAlign: 'center',
};

const tooltipTextStyle: CSSProperties = {
  margin: '0 0 6px',
  color: '#f7efe0',
  whiteSpace: 'pre-wrap',
  textAlign: 'center',
};

const tooltipMetaStyle: CSSProperties = {
  margin: '3px 0 0',
  color: '#ffcc66',
  textAlign: 'center',
};

export function SolutionGridTooltipPanel({ item }: { item: SolutionGridEntry }) {
  return (
    <div role="tooltip" style={tooltipPanelStyle}>
      <GameTooltipFrame />
      <p style={tooltipTitleStyle}>{item.name}</p>
      <p style={tooltipTextStyle}>{item.text}</p>
      <p style={tooltipMetaStyle}>Charges: {item.uses}</p>
      <p style={tooltipMetaStyle}>Type: {item.typeLabel}</p>
    </div>
  );
}

export default SolutionGridTooltipPanel;
