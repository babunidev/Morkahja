import { useEffect, useState, type CSSProperties } from 'react';
import { GAME_FOOTER_BUTTONS } from '../gameUiAssets.js';
import { DEFAULT_BUTTON_SOUND, LORE_SOUND, playSfx } from '../../sfx.js';
import { useNavButtonPress } from '../../transitions/navButtonPress.js';
import { PROTECTED_SURFACE_ATTR, protectedImageProps } from '../../protectedImage.js';
import { actionMenuRowStyle, GAME_SCREEN_LAYOUT } from '../gameScreenLayout.js';

const FOOTER_BUTTONS = GAME_FOOTER_BUTTONS;
const FOOTER_READY_RATTLE_MS = 560;
const FOOTER_READY_RATTLE_STAGGER_MS = 90;

const footerButtonStyle: CSSProperties = {
  flex: `0 1 ${GAME_SCREEN_LAYOUT.actionMenuButtonMaxWidthPx}px`,
  minWidth: 0,
  width: '100%',
  maxWidth: GAME_SCREEN_LAYOUT.actionMenuButtonMaxWidthPx,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const footerButtonImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45))',
};

export function ActionMenuZone({
  helpCalled = false,
  onCallForHelp,
  onInventoryToggle,
  onLoreToggle,
  onSkillbookToggle,
  readyRattleToken = 0,
}: {
  /** Call for help is spent for this encounter; the button stays visible but dimmed. */
  helpCalled?: boolean;
  onCallForHelp?: () => void;
  onInventoryToggle: () => void;
  onLoreToggle: () => void;
  onSkillbookToggle: () => void;
  readyRattleToken?: number;
}) {
  const [footerRattling, setFooterRattling] = useState(false);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  useEffect(() => {
    if (!readyRattleToken) {
      return undefined;
    }

    setFooterRattling(true);
    const clearTimer = window.setTimeout(() => {
      setFooterRattling(false);
    }, FOOTER_READY_RATTLE_MS + FOOTER_READY_RATTLE_STAGGER_MS * (FOOTER_BUTTONS.length - 1) + 60);

    return () => {
      window.clearTimeout(clearTimer);
    };
  }, [readyRattleToken]);

  return (
    <div {...{ [PROTECTED_SURFACE_ATTR]: '' }} aria-label="Footer actions" style={actionMenuRowStyle()}>
      {FOOTER_BUTTONS.map((button, index) => {
        const isHelp = button.alt === 'Get help';
        const helpSpent = isHelp && helpCalled;
        return (
        <button
          aria-label={isHelp ? 'Call for help' : button.alt}
          disabled={helpSpent}
          className="morkahja-footer-button"
          data-morkahja-footer-target={button.target}
          key={button.alt}
          onClick={() => {
            if (isHelp) {
              if (helpCalled) {
                return;
              }
              playSfx(DEFAULT_BUTTON_SOUND);
              onCallForHelp?.();
              return;
            }
            if (button.alt === 'Lore') {
              playSfx(LORE_SOUND);
              onLoreToggle();
              return;
            }

            playSfx(DEFAULT_BUTTON_SOUND);
            if (button.alt === 'Skillbook') {
              onSkillbookToggle();
            }
            if (button.alt === 'Inventory') {
              onInventoryToggle();
            }
          }}
          onPointerDown={() => {
            pulse(button.alt);
          }}
          style={{
            ...footerButtonStyle,
            opacity: helpSpent ? 0.42 : 1,
            cursor: helpSpent ? 'default' : 'pointer',
          }}
          type="button"
        >
          <span className="morkahja-footer-button-visual">
            <img
              alt=""
              aria-hidden="true"
              {...protectedImageProps}
              src={button.src}
              style={{
                ...footerButtonImageStyle,
                transformOrigin: '50% 50%',
                animation: isPressed(button.alt)
                  ? pressAnimation(true)
                  : footerRattling
                    ? `morkahja-footer-ready-rattle ${FOOTER_READY_RATTLE_MS}ms ease-in-out ${index * FOOTER_READY_RATTLE_STAGGER_MS}ms`
                    : undefined,
              }}
            />
          </span>
        </button>
        );
      })}
    </div>
  );
}

export default ActionMenuZone;
