import { useState, type CSSProperties } from 'react';

import type { PersistedAvatar } from '../../api/http.js';
import {
  SKILL_INVENTORY_TYPE,
  SPECIALIZATIONS,
  findSpecialization,
  specializationChangeCost,
} from '@shared/specialization.js';
import { gameSolutions } from '../../data/gameContent.js';
import { simpleFrameStyle } from '../common/simpleFrame.js';
import { TooltipDivider } from '../game/GameTooltip.js';
import DecorativeEdgeFrame from '../game/blocks/DecorativeEdgeFrame.js';
import { PANEL_SIDE_PADDING, panelEdgeDividerBleed } from '../game/blocks/decorativeFrameShared.js';
import { GAME_PANEL_BACKGROUND } from '../game/blocks/gamePanelBackground.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import { OVERVIEW_BACK_ASSET, OVERVIEW_ENTER_ASSET } from './AvatarOverview.js';

/**
 * Choosing a specialization (D-056, Babuni, 2026-11-23): the selected one's
 * description on top, a line, then the fifteen as a roster of three in a row. Red goes back to the overview,
 * green confirms. The first choice is free, every change costs 1 gem. Only in
 * the main menu.
 */

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 30,
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr)',
  gridTemplateColumns: 'minmax(0, 1fr)',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  boxSizing: 'border-box',
  background: 'rgba(8, 4, 2, 0.72)',
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  position: 'relative',
  width: 'min(100%, 520px)',
  height: 'min(100%, 640px)',
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  padding: 'clamp(26px, 6vw, 34px) 0 clamp(18px, 4vw, 26px)',
  background: GAME_PANEL_BACKGROUND,
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
};

const bodyStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: `0 ${PANEL_SIDE_PADDING}`,
  overflowY: 'auto',
  scrollbarWidth: 'none',
};

/** The line between the description and the roster reaches the frame. */
const DIVIDER_BLEED = panelEdgeDividerBleed(0);

/** The roster: three in a row, five rows. */
const listStyle: CSSProperties = {
  margin: 0,
  padding: '2px 0',
  listStyle: 'none',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 'clamp(6px, 1.6vw, 10px)',
};

function optionStyle(selected: boolean): CSSProperties {
  return {
    width: '100%',
    minHeight: 'clamp(38px, 9vw, 46px)',
    padding: '6px 8px',
    ...simpleFrameStyle({
      background: selected ? 'rgba(126, 29, 18, 0.92)' : 'rgba(51, 0, 0, 0.82)',
      opacity: selected ? 1 : 0.7,
    }),
    border: 0,
    color: selected ? '#ffe2a3' : '#ffcc66',
    fontFamily: 'Georgia, serif',
    fontSize: 'clamp(0.82rem, 3.4vw, 0.98rem)',
    lineHeight: 1.15,
    textAlign: 'center',
    cursor: 'pointer',
  };
}

const currentMarkStyle: CSSProperties = {
  display: 'block',
  marginTop: 1,
  fontSize: '0.56rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.75,
};

const detailStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  // Room for the longest description, so the roster does not jump.
  minHeight: 'clamp(150px, 34vw, 170px)',
  textAlign: 'center',
};

const nameStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(1rem, 4vw, 1.25rem)',
  letterSpacing: '0.05em',
  color: '#ffcc66',
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  maxWidth: 420,
  fontSize: 'clamp(0.82rem, 3.4vw, 0.95rem)',
  lineHeight: 1.45,
};

const effectStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: 'clamp(0.72rem, 2.9vw, 0.82rem)',
  fontWeight: 700,
};

const noteStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.7rem',
  opacity: 0.75,
};

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: `6px calc(${PANEL_SIDE_PADDING} + 14px) 0`,
};

const footerButtonStyle: CSSProperties = {
  width: 'clamp(52px, 11vw, 72px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const footerImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5))',
};

const costStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: 'clamp(0.78rem, 3vw, 0.9rem)',
  textAlign: 'center',
};

const errorStyle: CSSProperties = {
  ...costStyle,
  color: '#ff9a7a',
  fontSize: '0.72rem',
};

/** How many of the avatar's skills, with charges, are of this type. */
function skillsOfType(avatar: PersistedAvatar, solutionType: number): number {
  const solutions = gameSolutions() as Record<string, { mSolutionInventoryType: number; mSolutionType: number } | undefined>;
  return (avatar.inventory?.spellbook ?? []).filter((entry) => {
    const solution = solutions[String(entry.solutionId)];
    return solution?.mSolutionInventoryType === SKILL_INVENTORY_TYPE
      && solution.mSolutionType === solutionType
      && entry.uses > 0;
  }).length;
}

export function costLabel(cost: number): string {
  return cost === 0 ? 'Free' : `${cost} gem${cost === 1 ? '' : 's'}`;
}

export default function SpecializationPicker({
  avatar,
  pending,
  error,
  onBack,
  onConfirm,
}: {
  avatar: PersistedAvatar;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: (solutionType: number) => void;
}) {
  const current = findSpecialization(avatar.specialization);
  const [selectedType, setSelectedType] = useState<number>(current?.solutionType ?? SPECIALIZATIONS[0]!.solutionType);
  const selected = findSpecialization(selectedType) ?? SPECIALIZATIONS[0]!;
  const unchanged = current?.solutionType === selected.solutionType;
  const cost = unchanged ? 0 : specializationChangeCost(current?.solutionType);
  const owned = skillsOfType(avatar, selected.solutionType);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onBack();
        }
      }}
      style={overlayStyle}
    >
      <section aria-label="Choose a specialization" role="dialog" style={panelStyle}>
        <DecorativeEdgeFrame regionLabel="Specialization" zIndex={2} />
        <div style={bodyStyle}>
          <div aria-live="polite" style={detailStyle}>
            <p style={nameStyle}>{selected.name}</p>
            <TooltipDivider />
            <p style={descriptionStyle}>{selected.description}</p>
            <TooltipDivider />
            <p style={effectStyle}>+1 to every roll with a {selected.name} skill</p>
            <p style={noteStyle}>
              {owned === 0
                ? `${avatar.name.trim() || 'This avatar'} has no ${selected.name} skill yet.`
                : `${avatar.name.trim() || 'This avatar'} has ${owned} ${selected.name} skill${owned === 1 ? '' : 's'}.`}
            </p>
          </div>
          <TooltipDivider bleed={DIVIDER_BLEED} />
          <ul aria-label="Specializations" style={listStyle}>
            {SPECIALIZATIONS.map((entry) => (
              <li key={entry.solutionType}>
                <button
                  aria-pressed={entry.solutionType === selected.solutionType}
                  onClick={() => {
                    playSfx(DEFAULT_BUTTON_SOUND);
                    setSelectedType(entry.solutionType);
                  }}
                  style={optionStyle(entry.solutionType === selected.solutionType)}
                  type="button"
                >
                  {entry.name}
                  {entry.solutionType === current?.solutionType ? <span style={currentMarkStyle}>current</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div style={footerStyle}>
          <button
            aria-label="Back"
            disabled={pending}
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onBack();
            }}
            onPointerDown={() => pulse('specialization-back')}
            style={footerButtonStyle}
            type="button"
          >
            <img alt="" aria-hidden="true" draggable={false} src={OVERVIEW_BACK_ASSET} style={{ ...footerImageStyle, animation: pressAnimation(isPressed('specialization-back')) }} />
          </button>
          <div>
            {error ? <p role="alert" style={errorStyle}>{error}</p> : null}
            <p style={costStyle}>{unchanged ? 'Your current specialization' : costLabel(cost)}</p>
          </div>
          <button
            aria-label={unchanged ? 'Keep this specialization' : `Choose ${selected.name}`}
            disabled={pending}
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              if (unchanged) {
                onBack();
                return;
              }
              onConfirm(selected.solutionType);
            }}
            onPointerDown={() => pulse('specialization-confirm')}
            style={{ ...footerButtonStyle, opacity: pending ? 0.6 : 1 }}
            type="button"
          >
            <img alt="" aria-hidden="true" draggable={false} src={OVERVIEW_ENTER_ASSET} style={{ ...footerImageStyle, animation: pressAnimation(isPressed('specialization-confirm')) }} />
          </button>
        </div>
      </section>
    </div>
  );
}
