import { useEffect, useState, type CSSProperties } from 'react';
import { menuPreparingClass, useMenuPreparingCheck } from '../../transitions/menuReadiness.js';
import { GAME_FOOTER_BUTTONS } from '../gameUiAssets.js';
import { BACKPACK_SOUND, CALL_FOR_HELP_SOUND, FOOTER_BUTTON_PLAYBACK_SCALE, LORE_SOUND, SKILLBOOK_SOUND, playSfx } from '../../sfx.js';
import { useNavButtonPress } from '../../transitions/navButtonPress.js';
import { PROTECTED_SURFACE_ATTR, protectedImageProps } from '../../protectedImage.js';
import { actionMenuRowStyle, GAME_SCREEN_LAYOUT } from '../gameScreenLayout.js';
import { GAME_SCREEN_SELECTOR, GameTooltipCard, useGameTooltip, type GameTooltipContent } from '../GameTooltip.js';

/** What each menu button does, shown after a short hover (or a long press). */
function helpTooltipLine(helpCalled: boolean, partyFull: boolean): [string, string] {
  if (partyFull) {
    return ['Call for help', 'The group is full.'];
  }
  if (helpCalled) {
    return ['Call for help', 'Help has already been called for this encounter'];
  }
  return ['Call for help', 'Call nearby adventurers to help!'];
}

function menuTooltip(alt: string, helpCalled: boolean, partyFull: boolean): GameTooltipContent {
  const text: Record<string, [string, string]> = {
    'Get help': helpTooltipLine(helpCalled, partyFull),
    Inventory: ['Inventory', 'The items you carry'],
    Skillbook: ['Skillbook', 'Your skills and spells'],
    Lore: ['Lore', 'Read the story of this encounter'],
  };
  const [title, line] = text[alt] ?? [alt, ''];
  return {
    key: `menu-${alt}`,
    shellStyle: { width: 190, maxWidth: 190 },
    body: <GameTooltipCard title={title} lines={line ? [line] : []} />,
  };
}

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
  partyFull = false,
  onCallForHelp,
  onInventoryToggle,
  onLoreToggle,
  onSkillbookToggle,
  readyRattleToken = 0,
}: {
  /** Call for help is spent for this encounter; the button stays visible but dimmed. */
  helpCalled?: boolean;
  /** Three adventurers are already in the group. */
  partyFull?: boolean;
  onCallForHelp?: () => void;
  onInventoryToggle: () => void;
  onLoreToggle: () => void;
  onSkillbookToggle: () => void;
  readyRattleToken?: number;
}) {
  const [footerRattling, setFooterRattling] = useState(false);
  const menuTips = useGameTooltip({ boundsSelector: GAME_SCREEN_SELECTOR });
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  const isMenuPreparing = useMenuPreparingCheck();

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
    <div {...{ [PROTECTED_SURFACE_ATTR]: '' }} aria-label="Footer actions" style={{ ...actionMenuRowStyle(), position: 'relative' }}>
      {FOOTER_BUTTONS.map((button, index) => {
        const isHelp = button.alt === 'Get help';
        const helpBlocked = isHelp && (helpCalled || partyFull);
        const tip = menuTips.bindTooltip(() => menuTooltip(button.alt, helpCalled, partyFull));
        return (
        <button
          aria-disabled={helpBlocked || undefined}
          aria-label={isHelp ? 'Call for help' : button.alt}
          className={`morkahja-footer-button${menuPreparingClass(isMenuPreparing(`game:${button.alt.toLowerCase()}`))}`}
          data-morkahja-footer-target={button.target}
          key={button.alt}
          {...tip}
          onClick={() => {
            menuTips.hide();
            if (menuTips.consumeLongPressActivation()) {
              return;
            }
            if (isHelp) {
              if (helpCalled || partyFull) {
                return;
              }
              playSfx(CALL_FOR_HELP_SOUND, { scale: FOOTER_BUTTON_PLAYBACK_SCALE });
              onCallForHelp?.();
              return;
            }
            if (button.alt === 'Lore') {
              playSfx(LORE_SOUND, { scale: FOOTER_BUTTON_PLAYBACK_SCALE });
              onLoreToggle();
              return;
            }
            if (button.alt === 'Skillbook') {
              playSfx(SKILLBOOK_SOUND, { scale: FOOTER_BUTTON_PLAYBACK_SCALE });
              onSkillbookToggle();
              return;
            }
            if (button.alt === 'Inventory') {
              playSfx(BACKPACK_SOUND, { scale: FOOTER_BUTTON_PLAYBACK_SCALE });
              onInventoryToggle();
            }
          }}
          onPointerDown={(event) => {
            pulse(button.alt);
            tip.onPointerDown?.(event);
          }}
          style={{
            ...footerButtonStyle,
            opacity: helpBlocked ? 0.42 : 1,
            cursor: helpBlocked ? 'default' : 'pointer',
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
      {menuTips.layer}
    </div>
  );
}

export default ActionMenuZone;
