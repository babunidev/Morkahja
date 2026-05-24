import { useNavButtonPress } from '../transitions/navButtonPress.js';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export function PanelButton({
  children,
  disabled = false,
  onClick,
  onPointerDown,
  pressKey,
  visualStyle,
  ...buttonProps
}: {
  children: ReactNode;
  pressKey: string;
  visualStyle?: CSSProperties;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  return (
    <button
      className="morkahja-panel-button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={(event) => {
        if (!disabled) {
          pulse(pressKey);
        }

        onPointerDown?.(event);
      }}
      type="button"
      {...buttonProps}
    >
      <span
        className="morkahja-panel-button-visual"
        style={{
          ...visualStyle,
          animation: pressAnimation(isPressed(pressKey)),
        }}
      >
        {children}
      </span>
    </button>
  );
}

export default PanelButton;
