import { useState, type CSSProperties } from 'react';

import type { PersistedAvatar } from '../../api/http.js';
import {
  SKILL_INVENTORY_TYPE,
  SPECIALIZATIONS,
  findSpecialization,
  specializationSkillPhrase,
  specializationChangeCost,
} from '@shared/specialization.js';
import { gameSolutions } from '../../data/gameContent.js';
import { simpleFrameStyle } from '../common/simpleFrame.js';
import { TooltipDivider, gameTooltipFrameStyle } from '../game/GameTooltip.js';
import GemCost from '../common/GemCost.js';
import { AcceptButton, BackButton } from '../common/WordButton.js';
import PanelButton from '../common/PanelButton.js';
import DecorativeEdgeFrame from '../game/blocks/DecorativeEdgeFrame.js';
import { PANEL_SIDE_PADDING, panelEdgeDividerBleed } from '../game/blocks/decorativeFrameShared.js';
import { GAME_PANEL_BACKGROUND } from '../game/blocks/gamePanelBackground.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

/** The avatar edit's no and yes buttons, for the same question (Babuni, 2026-11-24). */

/**
 * Choosing a specialization (D-056, Babuni, 2026-11-23): the selected one's
 * description on top, a line, then the fifteen as a roster of three in a row. Red goes back to the overview,
 * green confirms. The first choice is free, every change costs 1 gem. Only in
 * the main menu.
 */

/** No text is smaller than the item and skill tooltips' (Babuni, 2026-11-23). */
const TOOLTIP_TEXT_SIZE = gameTooltipFrameStyle.fontSize;

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
  fontSize: TOOLTIP_TEXT_SIZE,
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
  fontSize: 'clamp(0.78rem, 3.2vw, 0.9rem)',
  fontWeight: 700,
};

const noteStyle: CSSProperties = {
  margin: 0,
  fontSize: TOOLTIP_TEXT_SIZE,
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



const costStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  margin: 0,
  color: '#ffcc66',
  fontSize: 'clamp(0.85rem, 3.4vw, 1rem)',
  textAlign: 'center',
};

const errorStyle: CSSProperties = {
  ...costStyle,
  color: '#ff9a7a',
  fontSize: TOOLTIP_TEXT_SIZE,
};

/** "Do you want to spend … ?" over the picker, as in the avatar edit (Babuni, 2026-11-24). */
const confirmShadeStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(8, 4, 2, 0.72)',
};

const confirmBoxStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 14,
  width: 'min(86%, 340px)',
  padding: '22px 18px 16px',
  ...simpleFrameStyle({ background: 'rgba(34, 6, 3, 0.97)', opacity: 0.94 }),
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.95rem, 3.6vw, 1.1rem)',
  textAlign: 'center',
};

const confirmButtonsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
            <p style={effectStyle}>+1 to every roll with {specializationSkillPhrase(selected.name)}</p>
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
                <PanelButton
                  aria-pressed={entry.solutionType === selected.solutionType}
                  onClick={() => {
                    playSfx(DEFAULT_BUTTON_SOUND);
                    setSelectedType(entry.solutionType);
                  }}
                  pressKey={`specialization-${entry.solutionType}`}
                  style={{ display: 'block', width: '100%' }}
                  visualStyle={optionStyle(entry.solutionType === selected.solutionType)}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {entry.name}
                    {entry.solutionType === current?.solutionType ? <span style={currentMarkStyle}>current</span> : null}
                  </span>
                </PanelButton>
              </li>
            ))}
          </ul>
        </div>
        <div style={footerStyle}>
          <BackButton disabled={pending} onClick={onBack} pressKey="specialization-back" />
          <div>
            {error ? <p role="alert" style={errorStyle}>{error}</p> : null}
            <p style={costStyle}>{unchanged ? 'Your current specialization' : <GemCost cost={cost} />}</p>
          </div>
          <AcceptButton
            ariaLabel={unchanged ? 'Keep this specialization' : `Choose ${selected.name}`}
            disabled={pending}
            onClick={() => {
              if (unchanged) {
                onBack();
                return;
              }
              // A change that costs gems asks first; the free first choice does not.
              if (cost > 0) {
                setConfirmOpen(true);
                return;
              }
              onConfirm(selected.solutionType);
            }}
            pressKey="specialization-confirm"
          />
        </div>
        {confirmOpen ? (
          <div role="presentation" style={confirmShadeStyle}>
            <div aria-label="Spend gems" role="alertdialog" style={confirmBoxStyle}>
              <span>Do you want to spend <GemCost cost={cost} withLabel={false} /> to become {selected.name}?</span>
              <div style={confirmButtonsStyle}>
                <BackButton ariaLabel="No, keep the gems" disabled={pending} onClick={() => setConfirmOpen(false)} pressKey="specialization-no" />
                <AcceptButton
                  ariaLabel="Yes, spend the gems"
                  disabled={pending}
                  onClick={() => {
                    setConfirmOpen(false);
                    onConfirm(selected.solutionType);
                  }}
                  pressKey="specialization-yes"
                />
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
