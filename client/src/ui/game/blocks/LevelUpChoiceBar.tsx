import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { displayRollAsD20 } from '@shared/diceInterpreter.js';
import { gameSolutions } from '../../../data/gameContent.js';
import { assetUrl } from '../../../assetUrl.js';
import { isApiErrorCode } from '../../../api/httpErrorMessage.js';
import { protectedImageProps, preventImageContextMenu, PROTECTED_SURFACE_ATTR } from '../../protectedImage.js';
import { DEFAULT_BUTTON_SOUND, DICE_SOUND, playSfx } from '../../sfx.js';
import {
  ENCOUNTER_ACTIONS_FADE_DURATION_MS,
  ENCOUNTER_ACTIONS_REVEAL_DELAY_MS,
} from '../../transitions/fade.js';
import { TooltipDivider, useGameTooltip, type GameTooltipContent } from '../GameTooltip.js';
import { LEVEL_UP_ENCOUNTER_ID, rewardQuantityForVisibleEntry } from '../visibleEncounterRewards.js';
import { BOTTOM_EDGE_ANCHOR_STYLE } from './decorativeFrameShared.js';

/**
 * Level-up choice (D-049, Babuni 2026-11-18): the three rewards wait in the
 * solution bar instead of the die. The one the player picks moves to the
 * middle and bounces while it rolls, shows the roll, and then stays as the
 * first reward while the rolled ones grow out of the encounter around it.
 */

const SLOT_SIZE_PX = 64;
const CHOICE_COLUMNS = [2, 3, 4] as const;
/** The pick bounces at least this long, even if the roll is back sooner. */
const MIN_ROLL_BOUNCE_MS = 1200;
/** How long the roll shows on the pick before the result takes over. */
const ROLL_SHOW_MS = 1300;
const MOVE_TO_MIDDLE_MS = 380;

interface SolutionRecord {
  mSolutionID: number;
  mSolutionIconName: string;
  mSolutionName: string;
  mSolutionText?: string;
  mSolutionUses?: number;
}

const SOLUTION_IMAGE_ROOT = assetUrl('/game/solutionimages');

const barStyle: CSSProperties = {
  ...BOTTOM_EDGE_ANCHOR_STYLE,
  width: '96%',
  minHeight: SLOT_SIZE_PX,
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  columnGap: 6,
  alignItems: 'center',
  justifyItems: 'center',
  zIndex: 31,
  overflow: 'visible',
};

const titleStyle: CSSProperties = {
  gridColumn: '1 / -1',
  gridRow: '1',
  justifySelf: 'center',
  transform: 'translateY(-62px)',
  color: '#ffcc66',
  fontFamily: "'Breathe Fire', Georgia, serif",
  fontSize: 20,
  letterSpacing: '0.04em',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.85)',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
};

const buttonStyle: CSSProperties = {
  gridRow: '1',
  display: 'block',
  width: SLOT_SIZE_PX,
  height: SLOT_SIZE_PX,
  padding: 0,
  border: 0,
  background: 'transparent',
  position: 'relative',
};

const imageStyle: CSSProperties = {
  display: 'block',
  width: SLOT_SIZE_PX,
  height: SLOT_SIZE_PX,
  borderRadius: '50%',
  objectFit: 'cover',
  boxShadow: '0 0 14px rgba(255, 204, 102, 0.38), 0 6px 12px rgba(0, 0, 0, 0.46)',
};

const rollStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  fontSize: 30,
  lineHeight: 1,
  background: 'radial-gradient(circle, rgba(12, 8, 6, 0.6) 0%, rgba(12, 8, 6, 0) 72%)',
  borderRadius: '50%',
  pointerEvents: 'none',
  animation: 'morkahja-level-up-roll-pop 320ms ease-out both',
};

const tooltipTitleStyle: CSSProperties = { margin: 0, color: '#ffcc66', fontWeight: 700 };
const tooltipMetaStyle: CSSProperties = { margin: 0, color: '#ffcc66' };
const tooltipTextStyle: CSSProperties = { margin: 0, color: '#f7efe0' };

type Phase = 'choose' | 'rolling' | 'showing' | 'done';

export function LevelUpChoiceBar({
  choiceIds,
  encounterKey,
  avatarLevel,
  hidden = false,
  roll,
  onChoose,
  onRollShown,
}: {
  choiceIds: number[];
  /** The level-up encounter: a new one starts the bar over. */
  encounterKey: string;
  avatarLevel: number;
  /** Lore, Inventory, Skillbook or the map is open. */
  hidden?: boolean;
  /** The server's roll once the pick is in. */
  roll?: number;
  onChoose: (rewardId: number) => Promise<void>;
  /** The roll has been shown on the pick: the result may take over. */
  onRollShown: () => void;
}) {
  const tips = useGameTooltip();
  const [revealed, setRevealed] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [shift, setShift] = useState(0);
  const rollingSinceRef = useRef(0);
  const barRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const onRollShownRef = useRef(onRollShown);
  onRollShownRef.current = onRollShown;

  const solutions = gameSolutions() as Record<string, SolutionRecord>;
  const choices = choiceIds.flatMap((id) => {
    const solution = solutions[String(id)];
    return solution ? [solution] : [];
  });

  // Fade in like the solutions; usable once the encounter accepts actions.
  useEffect(() => {
    setRevealed(false);
    setInteractive(false);
    setChosen(null);
    setPhase('choose');
    setShift(0);
    const reveal = window.setTimeout(() => setRevealed(true), ENCOUNTER_ACTIONS_REVEAL_DELAY_MS);
    const ready = window.setTimeout(
      () => setInteractive(true),
      ENCOUNTER_ACTIONS_REVEAL_DELAY_MS + ENCOUNTER_ACTIONS_FADE_DURATION_MS,
    );
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(ready);
    };
  }, [encounterKey]);

  // The pick slides to the middle place, where the first reward will sit.
  useLayoutEffect(() => {
    if (chosen === null) {
      return;
    }
    const bar = barRef.current;
    const button = buttonRefs.current.get(chosen);
    if (!bar || !button) {
      return;
    }
    const barRect = bar.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    // The stage may be scaled: convert screen pixels back to layout pixels.
    const scale = button.offsetWidth > 0 ? buttonRect.width / button.offsetWidth : 1;
    const middle = barRect.left + barRect.width / 2;
    setShift((middle - (buttonRect.left + buttonRect.width / 2)) / scale);
  }, [chosen]);

  // Once the roll is back and the pick has bounced a while: show the roll, then hand over.
  useEffect(() => {
    if (phase !== 'rolling' || roll === undefined) {
      return undefined;
    }
    const wait = Math.max(0, rollingSinceRef.current + MIN_ROLL_BOUNCE_MS - Date.now());
    const show = window.setTimeout(() => setPhase('showing'), wait);
    return () => window.clearTimeout(show);
  }, [phase, roll]);

  useEffect(() => {
    if (phase !== 'showing') {
      return undefined;
    }
    const done = window.setTimeout(() => {
      setPhase('done');
      onRollShownRef.current();
    }, ROLL_SHOW_MS);
    return () => window.clearTimeout(done);
  }, [phase]);

  async function choose(rewardId: number): Promise<void> {
    if (tips.consumeLongPressActivation() || !interactive || chosen !== null) {
      return;
    }
    tips.hide();
    playSfx(DEFAULT_BUTTON_SOUND);
    setChosen(rewardId);
    setPhase('rolling');
    rollingSinceRef.current = Date.now();
    playSfx(DICE_SOUND, { overlap: true });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await onChoose(rewardId);
        return;
      } catch (error) {
        // The encounter may not accept actions for a moment longer.
        if (!isApiErrorCode(error, 'ACTION_NOT_READY')) {
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      }
    }
    setChosen(null);
    setPhase('choose');
    setShift(0);
  }

  function tooltipFor(solution: SolutionRecord): GameTooltipContent {
    const quantity = rewardQuantityForVisibleEntry({
      encounterId: LEVEL_UP_ENCOUNTER_ID,
      avatarLevel,
      outcome: null,
      solutionUses: solution.mSolutionUses ?? 1,
    });
    const text = solution.mSolutionText?.trim();
    return {
      key: `level-up-choice-${solution.mSolutionID}`,
      shellStyle: { width: 200, maxWidth: 200 },
      body: (
        <>
          <p style={tooltipTitleStyle}>{solution.mSolutionName}</p>
          <TooltipDivider />
          <p style={tooltipMetaStyle}>+{quantity}</p>
          {text ? <p style={tooltipTextStyle}>{text}</p> : null}
        </>
      ),
    };
  }

  const shown = revealed && !hidden && phase !== 'done';

  return (
    <div
      ref={barRef}
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      style={{
        ...barStyle,
        opacity: shown ? 1 : 0,
        transition: `opacity ${revealed && phase === 'choose' && !hidden ? ENCOUNTER_ACTIONS_FADE_DURATION_MS : 320}ms ease`,
        pointerEvents: shown && phase === 'choose' ? 'auto' : 'none',
      }}
    >
      <style>
        {`@keyframes morkahja-level-up-roll-bounce {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-16px) rotate(-6deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(-10px) rotate(6deg); }
}
@keyframes morkahja-level-up-roll-pop {
  0% { opacity: 0; transform: scale(1.5); }
  100% { opacity: 1; transform: scale(1); }
}`}
      </style>
      <div
        aria-live="polite"
        style={{
          ...titleStyle,
          opacity: phase === 'choose' ? 1 : 0,
          transition: 'opacity 320ms ease',
        }}
      >
        Choose your reward
      </div>
      {choices.map((solution, index) => {
        const id = solution.mSolutionID;
        const isChosen = chosen === id;
        const fadingOut = chosen !== null && !isChosen;
        return (
          <button
            aria-label={`Choose ${solution.mSolutionName}`}
            className="morkahja-footer-button"
            data-level-up-choice={id}
            disabled={!interactive || chosen !== null}
            key={id}
            ref={(element) => {
              if (element) {
                buttonRefs.current.set(id, element);
              } else {
                buttonRefs.current.delete(id);
              }
            }}
            {...tips.bindTooltip(() => (chosen === null ? tooltipFor(solution) : null))}
            onClick={() => {
              void choose(id);
            }}
            onContextMenu={preventImageContextMenu}
            style={{
              ...buttonStyle,
              gridColumn: String(CHOICE_COLUMNS[index] ?? index + 2),
              opacity: fadingOut ? 0 : 1,
              transform: isChosen ? `translateX(${shift}px)` : 'translateX(0)',
              transition: `opacity 320ms ease, transform ${MOVE_TO_MIDDLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              cursor: interactive && chosen === null ? undefined : 'default',
              zIndex: isChosen ? 2 : 1,
            }}
            type="button"
          >
            <span
              className="morkahja-footer-button-visual"
              style={{
                display: 'block',
                ...(isChosen && phase === 'rolling'
                  ? { animation: 'morkahja-level-up-roll-bounce 460ms ease-in-out infinite' }
                  : {}),
              }}
            >
              <img alt="" aria-hidden="true" {...protectedImageProps} src={`${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp`} style={imageStyle} />
              {isChosen && (phase === 'showing' || phase === 'done') && roll !== undefined ? (
                <span aria-hidden="true" className="morkahja-result-outcome" style={rollStyle}>
                  {displayRollAsD20(roll)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
      {tips.layer}
    </div>
  );
}

export default LevelUpChoiceBar;
