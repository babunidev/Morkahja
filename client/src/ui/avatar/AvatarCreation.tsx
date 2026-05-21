import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import framesData from '../../data/game/frames.json';
import portraitsData from '../../data/game/portraits.json';
import type { PersistedAvatar } from '../../api/http.js';
import { fadeStyle } from '../transitions/fade.js';

const AVATAR_ASSET_ROOT = '/UI/02_AvatarCreation/Avatare';
const FRAME_ASSET_ROOT = '/UI/02_AvatarCreation/Frames';
const UI_ROOT = '/UI/02_AvatarCreation';
const MENU_BACKGROUND = '/UI/01_1_SignIn/menuBG.webp';
const TOOLTIP_HOLD_MS = 420;

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
  Grimnir: 'Grimnir are stoneborn dwellers of deep mountains, wielding earth and metal magic. They forge vast underground cities, living in clan unity guided by elders, celebrating life through craft, feast, and resilience.',
  Verdani: 'Verdani (Bloomkin): Playful nature-bound beings with horned forms, master water magic, healing, and animal kinship. They live in harmony-driven societies guided by elders, rituals, music, and flowing seasonal balance.',
  Aevis: 'Aevis are ethereal Windweavers, beings of living magic who dwell in skyborn cities. Graceful and intelligent, they shape air and essence into art, architecture, and arcane mastery while guarding magical balance.',
  Rokur: 'Rokur - Embersworn. Towering beings infused with sacred fire, the Rokur thrive within the harsh northern mountains through mastery over heat and flame. They value honor, strength, kinship, and the simple life of their ancient warrior traditions.',
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
  padding: 'min(4vw, 36px)',
  boxSizing: 'border-box',
  background: 'rgba(0, 0, 0, 0.38)',
};

const menuStyle: CSSProperties = {
  width: 'min(92vw, 620px)',
  maxHeight: '92vh',
  overflow: 'auto',
  display: 'grid',
  justifyItems: 'center',
  gap: 14,
  padding: 'clamp(18px, 4vw, 34px) 0',
  boxSizing: 'border-box',
  backgroundImage: `url(${MENU_BACKGROUND})`,
  backgroundSize: '100% 100%',
  backgroundRepeat: 'no-repeat',
  filter: 'drop-shadow(0 18px 34px rgba(0, 0, 0, 0.65))',
};

const previewStyle: CSSProperties = {
  width: 'min(48vw, 230px)',
  aspectRatio: '1 / 1.18',
  display: 'grid',
  placeItems: 'center',
};

const previewButtonStyle: CSSProperties = {
  ...previewStyle,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const previewImageStyle: CSSProperties = {
  gridArea: '1 / 1',
  width: '88%',
  height: '88%',
  objectFit: 'contain',
};

const previewFrameStyle: CSSProperties = {
  gridArea: '1 / 1',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

const rowStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  flexWrap: 'wrap',
};

const avatarConfirmRowStyle: CSSProperties = {
  ...rowStyle,
  alignItems: 'center',
  gap: 'clamp(10px, 3vw, 22px)',
};

const avatarCenterStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 6,
};

const buttonImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
};

const arrowButtonStyle: CSSProperties = {
  width: 58,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const optionButtonStyle: CSSProperties = {
  width: 'clamp(72px, 18vw, 118px)',
  padding: 0,
  border: 0,
  borderRadius: 10,
  background: 'transparent',
  cursor: 'pointer',
};

const selectedOptionStyle: CSSProperties = {
  filter: 'drop-shadow(0 0 10px rgba(255, 204, 102, 0.82))',
  outline: '2px solid #ffcc66',
};

const labelStyle: CSSProperties = {
  minWidth: 'clamp(78px, 18vw, 118px)',
  color: '#330000',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(22px, 5vw, 36px)',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textAlign: 'center',
  WebkitTextStroke: '1px #ffcc66',
  paintOrder: 'stroke fill',
  textShadow: [
    '-1px -1px 0 #ffcc66',
    '1px -1px 0 #ffcc66',
    '-1px 1px 0 #ffcc66',
    '1px 1px 0 #ffcc66',
    '0 0 6px rgba(255, 204, 102, 0.25)',
  ].join(', '),
};

const spacerStyle: CSSProperties = {
  width: '100%',
  height: 10,
  objectFit: 'cover',
};

const yesButtonStyle: CSSProperties = {
  width: 'clamp(76px, 18vw, 132px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const confirmSideButtonStyle: CSSProperties = {
  width: 'clamp(70px, 16vw, 112px)',
  padding: 0,
  border: 0,
  borderRadius: 10,
  background: 'transparent',
  cursor: 'pointer',
};

const genderButtonStyle: CSSProperties = {
  width: 'clamp(62px, 14vw, 92px)',
  padding: 0,
  border: 0,
  borderRadius: 10,
  background: 'transparent',
  cursor: 'pointer',
};

const nameInputStyle: CSSProperties = {
  width: 'clamp(140px, 34vw, 240px)',
  padding: '8px 12px',
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

const tooltipStyle: CSSProperties = {
  width: 'min(88%, 560px)',
  margin: '-4px 0 0',
  padding: '8px 12px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(31, 12, 6, 0.86)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(12px, 2.2vw, 15px)',
  lineHeight: 1.32,
  textAlign: 'center',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
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
  const [raceTooltip, setRaceTooltip] = useState('');
  const [roleTooltip, setRoleTooltip] = useState('');
  const tooltipTimerRef = useRef<number | null>(null);
  const tooltipWasShownRef = useRef(false);
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

  function clearTooltipTimer(): void {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  }

  function startTooltipHold(kind: 'race' | 'role', description: string): void {
    clearTooltipTimer();
    tooltipWasShownRef.current = false;
    tooltipTimerRef.current = window.setTimeout(() => {
      tooltipWasShownRef.current = true;
      if (kind === 'race') {
        setRaceTooltip(description);
        setRoleTooltip('');
      } else {
        setRoleTooltip(description);
        setRaceTooltip('');
      }
    }, TOOLTIP_HOLD_MS);
  }

  function endTooltipHold(): void {
    clearTooltipTimer();
    setRaceTooltip('');
    setRoleTooltip('');
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
    <div
      aria-label="Create Avatar"
      role="dialog"
      style={{
        ...overlayStyle,
        ...fadeStyle(visible),
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <section
        style={menuStyle}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <div aria-label="Choose race" style={rowStyle}>
          {RACES.map((raceOption) => (
            <button
              aria-label={`Choose ${raceOption}`}
              key={raceOption}
              onClick={() => {
                chooseRandomPortrait(raceOption, role, gender);
              }}
              onPointerCancel={endTooltipHold}
              onPointerDown={() => {
                startTooltipHold('race', RACE_DESCRIPTIONS[raceOption]);
              }}
              onPointerLeave={endTooltipHold}
              onPointerUp={endTooltipHold}
              style={{
                ...optionButtonStyle,
                ...(race === raceOption ? selectedOptionStyle : {}),
              }}
              type="button"
            >
              <img alt="" aria-hidden="true" draggable={false} src={raceAsset(raceOption)} style={buttonImageStyle} />
            </button>
          ))}
        </div>
        {raceTooltip ? <p role="tooltip" style={tooltipStyle}>{raceTooltip}</p> : null}

        <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_spacer_line.webp`} style={spacerStyle} />

        <div aria-label="Choose role" style={rowStyle}>
          {ROLES.map((roleOption) => (
            <button
              aria-label={`Choose ${roleOption}`}
              key={roleOption}
              onClick={() => {
                chooseRandomPortrait(race, roleOption, gender);
              }}
              onPointerCancel={endTooltipHold}
              onPointerDown={() => {
                startTooltipHold('role', ROLE_DESCRIPTIONS[roleOption]);
              }}
              onPointerLeave={endTooltipHold}
              onPointerUp={endTooltipHold}
              style={{
                ...optionButtonStyle,
                ...(role === roleOption ? selectedOptionStyle : {}),
              }}
              type="button"
            >
              <img alt="" aria-hidden="true" draggable={false} src={roleAsset(roleOption)} style={buttonImageStyle} />
            </button>
          ))}
        </div>
        {roleTooltip ? <p role="tooltip" style={tooltipStyle}>{roleTooltip}</p> : null}

        <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_spacer_line.webp`} style={spacerStyle} />

        <div style={rowStyle}>
          <button
            aria-label="Previous frame"
            onClick={() => {
              setFrameIndex((current) => wrapIndex(current - 1, frames.length));
            }}
            style={arrowButtonStyle}
            type="button"
          >
            <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_button_arrowb_left.webp`} style={buttonImageStyle} />
          </button>
          <span style={labelStyle}>Frame</span>
          <button
            aria-label="Next frame"
            onClick={() => {
              setFrameIndex((current) => wrapIndex(current + 1, frames.length));
            }}
            style={arrowButtonStyle}
            type="button"
          >
            <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_button_arrowb_right.webp`} style={buttonImageStyle} />
          </button>
          {GENDERS.map((genderOption) => (
            <button
              aria-label={`Choose ${genderOption}`}
              key={genderOption}
              onClick={() => {
                chooseRandomPortrait(race, role, genderOption);
              }}
              style={{
                ...genderButtonStyle,
                ...(gender === genderOption ? selectedOptionStyle : {}),
              }}
              type="button"
            >
              <img alt="" aria-hidden="true" draggable={false} src={genderAsset(genderOption)} style={buttonImageStyle} />
            </button>
          ))}
        </div>

        <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_spacer_line.webp`} style={spacerStyle} />

        <div style={avatarConfirmRowStyle}>
          <button aria-label="Cancel avatar creation" onClick={onCancel} style={confirmSideButtonStyle} type="button">
            <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_button_delete.webp`} style={buttonImageStyle} />
          </button>
          <div style={avatarCenterStyle}>
            <button aria-label="Randomize portrait" onClick={chooseRandomDifferentPortrait} style={previewButtonStyle} type="button">
              <img alt="" aria-hidden="true" draggable={false} src={`${AVATAR_ASSET_ROOT}/avatar_${portrait.avatarID}.webp`} style={previewImageStyle} />
              <img alt="" aria-hidden="true" draggable={false} src={`${FRAME_ASSET_ROOT}/frame_${frame.frameID}.webp`} style={previewFrameStyle} />
            </button>
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
          <button aria-label="Create avatar" onClick={confirmAvatar} style={yesButtonStyle} type="button">
            <img alt="" aria-hidden="true" draggable={false} src={`${UI_ROOT}/im_button_yes.webp`} style={buttonImageStyle} />
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default AvatarCreation;
