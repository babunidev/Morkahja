import type { CSSProperties } from 'react';
import type { SolutionGridEntry } from './SolutionGridOverlay.js';

const tooltipPanelStyle: CSSProperties = {
  width: '100%',
  maxHeight: 'min(32vh, 200px)',
  overflow: 'auto',
  padding: '6px 10px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(12, 9, 8, 0.96)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.68rem, 2.8vw, 0.82rem)',
  lineHeight: 1.3,
  textAlign: 'center',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  boxSizing: 'border-box',
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
      <p style={tooltipTitleStyle}>{item.name}</p>
      <p style={tooltipTextStyle}>{item.text}</p>
      <p style={tooltipMetaStyle}>Charges: {item.uses}</p>
      <p style={tooltipMetaStyle}>Type: {item.typeLabel}</p>
    </div>
  );
}

export default SolutionGridTooltipPanel;
