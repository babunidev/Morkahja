import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import framesData from '../../data/game/frames.json';
import portraitsData from '../../data/game/portraits.json';
import type { PersistedAvatar } from '../../api/http.js';
import { FADE_DURATION_MS, fadeStyle } from '../transitions/fade.js';
import {
  useTooltipRevealBinding,
  type TooltipRevealCallbacks,
  type TooltipRevealHandlerProps,
} from '../hooks/useTooltipReveal.js';
import {
  anchoredTooltipCoords,
  clampAnchoredTooltipPlacement,
  tooltipTransform,
  type AnchoredTooltipCoords,
} from '../hooks/anchoredTooltip.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const AVATAR_ASSET_ROOT = '/UI/02_AvatarCreation/Avatare';
const FRAME_ASSET_ROOT = '/UI/02_AvatarCreation/Frames';
const UI_ROOT = '/UI/02_AvatarCreation';
const RACES = ['Grimnir', 'Verdani', 'Aevis', 'Rokur'] as const;
const ROLES = ['Mage', 'Rogue', 'Warrior'] as const;
const GENDERS = ['Male', 'Female'] as const;
const RACE_BY_ID: Record<number, AvatarRace> = {
  1: 'Grimnir',
  2: 'Verdani',
  3: 'Aevis',
  4: 'Rokur',
};
const ROLE_BY_ID: Record<number, AvatarRole> = {
  1: 'Mage',
  2: 'Rogue',
  3: 'Warrior',
};
const GENDER_BY_ID: Record<number, AvatarGender> = {
  1: 'Male',
  2: 'Female',
};

type AvatarRace = (typeof RACES)[number];
type AvatarRole = (typeof ROLES)[number];
type AvatarGender = (typeof GENDERS)[number];

const RACE_DESCRIPTIONS: Record<AvatarRace, string> = {
  Grimnir: 'The Grimnir are earthborn stone-forgers of immense craft and resilience. With bodies of mineral and metal, they shape vast Skylands into drifting cities of carved rock, crystalline frameworks, and living architecture. Masters of creation and communal artistry, they build, travel, and thrive among the open skies of Morkahja.',
  Verdani: 'The Verdani are water-born Bloomkin of graceful form and fluid spirit. Shaped from living water into elegant, horned humanoids, they move with flowing poise and shifting beauty. Masters of hydromancy, healing, and song, they cultivate oasis-gardens across Evergrove, shaping desert life into balanced, shimmering sanctuaries of harmony and renewal.',
  Aevis: 'The Aevis are wind-born scholars of exquisite refinement, their forms light and ever-shifting like breath given shape. They dwell in vast subterranean cities where air is carefully guided through crystal channels and stone spires. Masters of magic, architecture, and thought, they live with disciplined grace beneath the world’s surface.',
  Rokur: 'The Rokur, known as the Embersworn, are fire-born elemental beings manifested in towering humanoid form. With bodies of living flame shaped by will and discipline, they dwell in mountain citadels and hearth-lit halls. Masters of endurance and unity, they forge, endure, and thrive through communal strength and ritual firecraft rites.',
};

const ROLE_DESCRIPTIONS: Record<AvatarRole, string> = {
  Mage: 'Mages shape raw magic into powerful spells, favoring arcane control, knowledge, and carefully timed force.',
  Rogue: 'Rogues survive through speed, cunning, precision, and hidden paths, turning danger with agility and opportunistic strikes.',
  Warrior: 'Warriors meet danger head-on with discipline, armor, and weapon mastery, protecting allies through strength and endurance.',
};

interface PortraitRecord {
  avatarGems: number;
  avatarGenderID: number;
  avatarID: number;
  avatarName: string;
  avatarRace: number;
  avatarRole: number;
  avatarType: number;
}

interface FrameRecord {
  frameGem: number;
  frameID: number;
  frameRace: number;
  frameRole: number;
  frameType: number;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 24,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  boxSizing: 'border-box',
  background: 'rgba(8, 4, 2, 0.72)',
  transition: `opacity ${FADE_DURATION_MS}ms ease`,
};

const panelStyle: CSSProperties = {
  width: 'min(92vw, 520px)',
  maxHeight: 'min(92vh, 760px)',
  minHeight: 'min(86vh, 640px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 20,
  padding: '22px 18px 20px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.45rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
};

const acceptButtonStyle: CSSProperties = {
  width: 'clamp(52px, 11vw, 76px)',
};

const panelBodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  display: 'grid',
  gap: 22,
  justifyItems: 'center',
  padding: '14px 10px 12px',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const previewStyle: CSSProperties = {
  width: 'min(54vw, 268px)',
  aspectRatio: '1 / 1.18',
};

const previewVisualStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  aspectRatio: '1 / 1.18',
};

const previewImageStyle: CSSProperties = {
  gridArea: '1 / 1',
  width: '92%',
  height: '92%',
  objectFit: 'contain',
};

const previewFrameStyle: CSSProperties = {
  gridArea: '1 / 1',
  width: '105%',
  height: '105%',
  objectFit: 'contain',
};

const rowStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  flexWrap: 'wrap',
  padding: '6px 8px',
  boxSizing: 'border-box',
};

const raceRowStyle: CSSProperties = {
  ...rowStyle,
  flexWrap: 'nowrap',
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  minWidth: 'clamp(78px, 18vw, 118px)',
  margin: 0,
  color: '#ffcc66',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: '1.15rem',
  fontWeight: 400,
  letterSpacing: '0.04em',
  textAlign: 'center',
};

const frameLabelStyle: CSSProperties = {
  ...sectionLabelStyle,
  minWidth: 0,
};

const frameControlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};

const avatarWorkbenchStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gridTemplateRows: 'auto auto',
  alignItems: 'center',
  justifyItems: 'center',
  columnGap: 'clamp(10px, 2.5vw, 18px)',
  rowGap: 18,
  width: '100%',
  marginTop: -4,
  padding: '4px 8px 0',
  boxSizing: 'border-box',
};

const frameColumnStyle: CSSProperties = {
  gridColumn: 1,
  gridRow: 1,
  alignSelf: 'center',
  justifySelf: 'start',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};

const avatarCenterColumnStyle: CSSProperties = {
  gridColumn: 2,
  gridRow: '1 / 3',
  alignSelf: 'start',
  display: 'grid',
  justifyItems: 'center',
  gap: 16,
  width: '100%',
  paddingTop: 4,
};

const genderColumnStyle: CSSProperties = {
  gridColumn: 3,
  gridRow: 1,
  alignSelf: 'start',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 5,
  paddingTop: 14,
};

const buttonImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
};

const arrowButtonStyle: CSSProperties = {
  width: 48,
};

const optionButtonStyle: CSSProperties = {
  width: 'clamp(72px, 18vw, 118px)',
  borderRadius: 10,
};

const raceOptionButtonStyle: CSSProperties = {
  width: 'clamp(56px, 14vw, 92px)',
  borderRadius: 10,
  flex: '0 1 auto',
};

const confirmSideButtonStyle: CSSProperties = {
  width: 'clamp(56px, 13vw, 88px)',
  borderRadius: 10,
};

const genderButtonStyle: CSSProperties = {
  width: 'clamp(48px, 11vw, 72px)',
  borderRadius: 10,
};

const workbenchActionButtonStyle: CSSProperties = {
  alignSelf: 'end',
  marginTop: 10,
};

const footerImageButtonShellStyle: CSSProperties = {
  padding: 0,
  border: 0,
  background: 'transparent',
};

const nameInputStyle: CSSProperties = {
  width: 'min(100%, clamp(140px, 34vw, 230px))',
  marginTop: 4,
  padding: '6px 10px',
  border: '1px solid #ffcc66',
  borderRadius: 8,
  boxSizing: 'border-box',
  background: 'rgba(31, 12, 6, 0.78)',
  color: '#ffcc66',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(18px, 4vw, 28px)',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textAlign: 'center',
  outline: 'none',
};

const OPTION_TOOLTIP_WIDTH_PX = 320;
const OPTION_TOOLTIP_Z_INDEX = 26;

interface OptionTooltipState {
  anchor: AnchoredTooltipCoords;
  text: string;
}

type OptionTooltipTriggerEvent = Parameters<TooltipRevealCallbacks['onShow']>[0];

const optionTooltipShellStyle: CSSProperties = {
  position: 'absolute',
  zIndex: OPTION_TOOLTIP_Z_INDEX,
  width: OPTION_TOOLTIP_WIDTH_PX,
  maxWidth: `min(${OPTION_TOOLTIP_WIDTH_PX}px, calc(100% - 16px))`,
  pointerEvents: 'none',
  boxSizing: 'border-box',
};

const optionTooltipPanelStyle: CSSProperties = {
  margin: 0,
  padding: '10px 12px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(12, 9, 8, 0.96)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.9rem',
  lineHeight: 1.4,
  textAlign: 'center',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  boxSizing: 'border-box',
};

function wrapIndex(index: number, length: number): number {
  return (index + length) % length;
}

function raceAsset(race: AvatarRace): string {
  return `${UI_ROOT}/im_button_race_${race.toLowerCase()}.webp`;
}

function roleAsset(role: AvatarRole): string {
  return `${UI_ROOT}/im_button_role_${role.toLowerCase()}.webp`;
}

function genderAsset(gender: AvatarGender): string {
  return `${UI_ROOT}/im_button_${gender.toLowerCase()}.webp`;
}

function randomEntry<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

function raceFromPortrait(portrait: PortraitRecord): AvatarRace {
  return RACE_BY_ID[portrait.avatarRace] ?? 'Grimnir';
}

function roleFromPortrait(portrait: PortraitRecord): AvatarRole {
  return ROLE_BY_ID[portrait.avatarRole] ?? 'Mage';
}

function genderFromPortrait(portrait: PortraitRecord): AvatarGender {
  return GENDER_BY_ID[portrait.avatarGenderID] ?? 'Male';
}

function raceId(race: AvatarRace): number {
  const entry = Object.entries(RACE_BY_ID).find(([, value]) => value === race);
  return entry ? Number(entry[0]) : 4;
}

function roleId(role: AvatarRole): number {
  const entry = Object.entries(ROLE_BY_ID).find(([, value]) => value === role);
  return entry ? Number(entry[0]) : 1;
}

function genderId(gender: AvatarGender): number {
  const entry = Object.entries(GENDER_BY_ID).find(([, value]) => value === gender);
  return entry ? Number(entry[0]) : 2;
}

function currentTimestamp(): number {
  return Date.now();
}

type CreationTooltipHandlers = Partial<TooltipRevealHandlerProps>;

function CreationImageButton({
  ariaLabel,
  children,
  imageSrc,
  imageStyle = buttonImageStyle,
  isPressed,
  onClick,
  pressAnimation,
  pressKey,
  pulse,
  selected = false,
  style,
  tooltipHandlers,
  visualStyle,
}: {
  ariaLabel: string;
  children?: ReactNode;
  imageSrc?: string;
  imageStyle?: CSSProperties;
  isPressed: (key: string) => boolean;
  onClick: () => void;
  pressAnimation: (pressed: boolean) => string | undefined;
  pressKey: string;
  pulse: (key: string) => void;
  selected?: boolean;
  style?: CSSProperties;
  tooltipHandlers?: CreationTooltipHandlers;
  visualStyle?: CSSProperties;
}) {
  const pointerHandlers = tooltipHandlers
    ? {
        ...tooltipHandlers,
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
          pulse(pressKey);
          tooltipHandlers.onPointerDown?.(event);
        },
      }
    : {
        onPointerDown: () => {
          pulse(pressKey);
        },
      };

  return (
    <button
      aria-label={ariaLabel}
      className={`morkahja-footer-button${selected ? ' morkahja-footer-button--selected' : ''}`}
      onClick={() => {
        playSfx(DEFAULT_BUTTON_SOUND);
        onClick();
      }}
      style={{ ...footerImageButtonShellStyle, ...style }}
      type="button"
      {...pointerHandlers}
    >
      <span
        className="morkahja-footer-button-visual"
        style={{
          ...visualStyle,
          animation: pressAnimation(isPressed(pressKey)),
        }}
      >
        {children ?? (
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={imageSrc}
            style={imageStyle}
          />
        )}
      </span>
    </button>
  );
}

export function AvatarCreation({
  onCancel,
  onConfirm,
  presetAvatar,
  slotIndex,
  visible,
}: {
  onCancel: () => void;
  onConfirm: (avatar: PersistedAvatar) => void;
  presetAvatar?: PersistedAvatar | null;
  slotIndex: number;
  visible: boolean;
}) {
  const portraits = useMemo(
    () => portraitsData.Avatar.filter(
      (portrait): portrait is PortraitRecord => portrait !== null,
    ),
    [],
  );
  const frames = useMemo(
    () => framesData.Frames.filter(
      (frame): frame is FrameRecord => frame !== null,
    ),
    [],
  );
  const initialPortraitIndex = useMemo(
    () => {
      const presetPortraitId = Number(presetAvatar?.portrait.match(/avatar_(\d+)\.webp$/)?.[1]);
      const presetIndex = portraits.findIndex((candidate) => candidate.avatarID === presetPortraitId);

      return presetIndex >= 0 ? presetIndex : randomIndex(portraits.length);
    },
    [portraits, presetAvatar],
  );
  const initialFrameIndex = useMemo(
    () => {
      const presetFrameId = Number(presetAvatar?.frame.match(/frame_(\d+)\.webp$/)?.[1]);
      const presetIndex = frames.findIndex((candidate) => candidate.frameID === presetFrameId);

      return presetIndex >= 0 ? presetIndex : randomIndex(frames.length);
    },
    [frames, presetAvatar],
  );
  const [portraitIndex, setPortraitIndex] = useState(initialPortraitIndex);
  const [frameIndex, setFrameIndex] = useState(initialFrameIndex);
  const [avatarName, setAvatarName] = useState(() => presetAvatar?.name ?? portraits[initialPortraitIndex]?.avatarName ?? 'Avatar');
  const [optionTooltip, setOptionTooltip] = useState<OptionTooltipState | null>(null);
  const [tooltipPlacement, setTooltipPlacement] = useState<{ left: number; top: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const activeTriggerRef = useRef<HTMLElement | null>(null);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  const { bind: bindTooltipReveal } = useTooltipRevealBinding(visible);

  useEffect(() => {
    if (!visible) {
      setOptionTooltip(null);
      setTooltipPlacement(null);
      activeTriggerRef.current = null;
    }
  }, [visible]);

  useLayoutEffect(() => {
    if (!optionTooltip || !overlayRef.current || !tooltipRef.current || !activeTriggerRef.current) {
      return undefined;
    }

    const container = overlayRef.current;
    const trigger = activeTriggerRef.current;
    const tooltipElement = tooltipRef.current;
    const tooltipAnchorX = optionTooltip.anchor.anchorX;

    function measureAndPlace(): void {
      if (!overlayRef.current || !tooltipRef.current || !activeTriggerRef.current) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltipElement.getBoundingClientRect();

      if (tooltipRect.width <= 0 || tooltipRect.height <= 0) {
        return;
      }

      setTooltipPlacement(
        clampAnchoredTooltipPlacement(
          containerRect,
          triggerRect,
          tooltipRect,
          tooltipAnchorX,
        ),
      );
    }

    measureAndPlace();
    const remeasureFrame = window.requestAnimationFrame(measureAndPlace);

    return () => {
      window.cancelAnimationFrame(remeasureFrame);
    };
  }, [optionTooltip]);
  const portrait = portraits[portraitIndex];
  const frame = frames[frameIndex];
  const race = raceFromPortrait(portrait);
  const role = roleFromPortrait(portrait);
  const gender = genderFromPortrait(portrait);

  function selectPortraitIndex(nextIndex: number): void {
    setPortraitIndex(nextIndex);
    setAvatarName(portraits[nextIndex].avatarName);
  }

  function matchingPortraits(nextRace: AvatarRace, nextRole: AvatarRole, nextGender: AvatarGender): PortraitRecord[] {
    const exactMatches = portraits.filter(
      (candidate) => (
        candidate.avatarRace === raceId(nextRace)
        && candidate.avatarRole === roleId(nextRole)
        && candidate.avatarGenderID === genderId(nextGender)
      ),
    );

    if (exactMatches.length > 0) {
      return exactMatches;
    }

    return portraits.filter((candidate) => candidate.avatarRace === raceId(nextRace));
  }

  function chooseRandomPortrait(nextRace = race, nextRole = role, nextGender = gender): void {
    const candidates = matchingPortraits(nextRace, nextRole, nextGender);
    const selectedPortrait = randomEntry(candidates.length > 0 ? candidates : portraits);
    const nextIndex = portraits.findIndex((candidate) => candidate.avatarID === selectedPortrait.avatarID);

    selectPortraitIndex(nextIndex >= 0 ? nextIndex : 0);
  }

  function chooseRandomDifferentPortrait(): void {
    const candidates = portraits.filter((candidate) => candidate.avatarID !== portrait.avatarID);
    const selectedPortrait = randomEntry(candidates.length > 0 ? candidates : portraits);
    const nextIndex = portraits.findIndex((candidate) => candidate.avatarID === selectedPortrait.avatarID);

    selectPortraitIndex(nextIndex >= 0 ? nextIndex : 0);
    setFrameIndex(randomIndex(frames.length));
  }

  function showOptionTooltip(
    text: string,
    event: OptionTooltipTriggerEvent,
  ): void {
    const trigger = event.currentTarget;

    if (!(trigger instanceof HTMLElement) || !overlayRef.current) {
      return;
    }

    activeTriggerRef.current = trigger;
    setTooltipPlacement(null);
    setOptionTooltip({
      text,
      anchor: anchoredTooltipCoords(overlayRef.current, trigger, 'center'),
    });
  }

  function hideOptionTooltips(): void {
    setOptionTooltip(null);
    setTooltipPlacement(null);
    activeTriggerRef.current = null;
  }

  function bindOptionTooltip(description: string) {
    return bindTooltipReveal({
      onShow: (event) => {
        showOptionTooltip(description, event);
      },
      onHide: hideOptionTooltips,
    });
  }

  function confirmAvatar(): void {
    const now = currentTimestamp();
    const confirmedName = avatarName.trim() || portrait.avatarName;

    onConfirm({
      id: `avatar-slot-${slotIndex + 1}-${now}`,
      name: confirmedName,
      race,
      role,
      level: 1,
      experience: 0,
      portrait: `avatar_${portrait.avatarID}.webp`,
      frame: `frame_${frame.frameID}.webp`,
      createdAt: now,
      lastPlayedAt: now,
    });
  }

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
    <div
      ref={overlayRef}
      aria-label="Create Avatar"
      role="presentation"
      style={{
        ...overlayStyle,
        ...fadeStyle(visible),
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <section
        aria-labelledby="avatar-creation-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        role="dialog"
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="avatar-creation-title" style={titleStyle}>CREATE AVATAR</h2>
        </header>
        <div data-avatar-creation-scroll="" style={panelBodyStyle}>
          <style>
            {`[data-avatar-creation-scroll]::-webkit-scrollbar { display: none; }
[data-avatar-creation-scroll] .morkahja-footer-button--selected:not(:hover):not(:focus-visible) .morkahja-footer-button-visual {
  filter: drop-shadow(0 0 10px rgba(255, 204, 102, 0.82));
}
.morkahja-avatar-randomize-preview {
  position: relative;
  display: inline-grid;
  justify-items: center;
}
.morkahja-avatar-randomize-hint {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  opacity: 0;
  color: rgba(255, 204, 102, 0.88);
  font-family: Georgia, serif;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.92);
  transition: opacity 180ms ease;
  pointer-events: none;
  user-select: none;
}
.morkahja-avatar-randomize-preview:hover .morkahja-avatar-randomize-hint,
.morkahja-avatar-randomize-preview:focus-within .morkahja-avatar-randomize-hint {
  opacity: 1;
}`}
          </style>
        <div aria-label="Choose race" style={raceRowStyle}>
          {RACES.map((raceOption) => (
            <CreationImageButton
              ariaLabel={`Choose ${raceOption}`}
              imageSrc={raceAsset(raceOption)}
              isPressed={isPressed}
              key={raceOption}
              onClick={() => {
                chooseRandomPortrait(raceOption, role, gender);
              }}
              pressAnimation={pressAnimation}
              pressKey={`avatar-race-${raceOption}`}
              pulse={pulse}
              selected={race === raceOption}
              style={raceOptionButtonStyle}
              tooltipHandlers={bindOptionTooltip(RACE_DESCRIPTIONS[raceOption])}
            />
          ))}
        </div>

        <div aria-label="Choose role" style={rowStyle}>
          {ROLES.map((roleOption) => (
            <CreationImageButton
              ariaLabel={`Choose ${roleOption}`}
              imageSrc={roleAsset(roleOption)}
              isPressed={isPressed}
              key={roleOption}
              onClick={() => {
                chooseRandomPortrait(race, roleOption, gender);
              }}
              pressAnimation={pressAnimation}
              pressKey={`avatar-role-${roleOption}`}
              pulse={pulse}
              selected={role === roleOption}
              style={optionButtonStyle}
              tooltipHandlers={bindOptionTooltip(ROLE_DESCRIPTIONS[roleOption])}
            />
          ))}
        </div>

        <div style={avatarWorkbenchStyle}>
          <div aria-label="Choose frame" style={frameColumnStyle}>
            <span style={frameLabelStyle}>Frame</span>
            <div style={frameControlsStyle}>
              <CreationImageButton
                ariaLabel="Previous frame"
                imageSrc={`${UI_ROOT}/im_button_arrowb_left.webp`}
                isPressed={isPressed}
                onClick={() => {
                  setFrameIndex((current) => wrapIndex(current - 1, frames.length));
                }}
                pressAnimation={pressAnimation}
                pressKey="avatar-frame-prev"
                pulse={pulse}
                style={arrowButtonStyle}
              />
              <CreationImageButton
                ariaLabel="Next frame"
                imageSrc={`${UI_ROOT}/im_button_arrowb_right.webp`}
                isPressed={isPressed}
                onClick={() => {
                  setFrameIndex((current) => wrapIndex(current + 1, frames.length));
                }}
                pressAnimation={pressAnimation}
                pressKey="avatar-frame-next"
                pulse={pulse}
                style={arrowButtonStyle}
              />
            </div>
          </div>
          <div style={avatarCenterColumnStyle}>
            <div className="morkahja-avatar-randomize-preview">
              <CreationImageButton
                ariaLabel="Randomize portrait"
                isPressed={isPressed}
                onClick={chooseRandomDifferentPortrait}
                pressAnimation={pressAnimation}
                pressKey="avatar-randomize"
                pulse={pulse}
                style={previewStyle}
                visualStyle={previewVisualStyle}
              >
                <img alt="" aria-hidden="true" draggable={false} src={`${AVATAR_ASSET_ROOT}/avatar_${portrait.avatarID}.webp`} style={previewImageStyle} />
                <img alt="" aria-hidden="true" draggable={false} src={`${FRAME_ASSET_ROOT}/frame_${frame.frameID}.webp`} style={previewFrameStyle} />
              </CreationImageButton>
              <span aria-hidden="true" className="morkahja-avatar-randomize-hint">
                Randomize
              </span>
            </div>
            <input
              aria-label="Avatar name"
              onChange={(event) => {
                setAvatarName(event.target.value);
              }}
              style={nameInputStyle}
              type="text"
              value={avatarName}
            />
          </div>
          <div aria-label="Choose gender" style={genderColumnStyle}>
            <CreationImageButton
              ariaLabel="Choose Male"
              imageSrc={genderAsset('Male')}
              isPressed={isPressed}
              onClick={() => {
                chooseRandomPortrait(race, role, 'Male');
              }}
              pressAnimation={pressAnimation}
              pressKey="avatar-gender-male"
              pulse={pulse}
              selected={gender === 'Male'}
              style={genderButtonStyle}
            />
            <CreationImageButton
              ariaLabel="Choose Female"
              imageSrc={genderAsset('Female')}
              isPressed={isPressed}
              onClick={() => {
                chooseRandomPortrait(race, role, 'Female');
              }}
              pressAnimation={pressAnimation}
              pressKey="avatar-gender-female"
              pulse={pulse}
              selected={gender === 'Female'}
              style={genderButtonStyle}
            />
          </div>
          <CreationImageButton
            ariaLabel="Cancel avatar creation"
            imageSrc={`${UI_ROOT}/im_button_delete.webp`}
            isPressed={isPressed}
            onClick={onCancel}
            pressAnimation={pressAnimation}
            pressKey="avatar-cancel"
            pulse={pulse}
            style={{ ...confirmSideButtonStyle, ...workbenchActionButtonStyle, gridColumn: 1, gridRow: 2, justifySelf: 'start' }}
          />
          <CreationImageButton
            ariaLabel="Accept avatar creation"
            imageSrc={`${UI_ROOT}/im_button_yes.webp`}
            isPressed={isPressed}
            onClick={confirmAvatar}
            pressAnimation={pressAnimation}
            pressKey="avatar-ok"
            pulse={pulse}
            style={{ ...acceptButtonStyle, ...workbenchActionButtonStyle, gridColumn: 3, gridRow: 2 }}
          />
        </div>
        </div>
      </section>
      {optionTooltip ? (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            ...optionTooltipShellStyle,
            left: tooltipPlacement?.left ?? optionTooltip.anchor.x,
            top: tooltipPlacement?.top ?? optionTooltip.anchor.y,
            transform: tooltipPlacement
              ? 'none'
              : tooltipTransform(optionTooltip.anchor.anchorX),
          }}
        >
          <p style={optionTooltipPanelStyle}>{optionTooltip.text}</p>
        </div>
      ) : null}
    </div>
    </>,
    document.body,
  );
}

export default AvatarCreation;
