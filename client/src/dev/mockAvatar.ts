import framesData from '../data/game/frames.json';
import portraitsData from '../data/game/portraits.json';

const RACES = ['Rokur', 'Verdani', 'Aevis', 'Grimnir'] as const;
const ROLES = ['Mage', 'Warrior', 'Rogue'] as const;

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

export interface MockAvatar {
  id: string;
  name: string;
  race: (typeof RACES)[number];
  role: (typeof ROLES)[number];
  portrait: string;
  frame: string;
  level: number;
  experience: number;
  createdAt?: number;
  lastPlayedAt?: number;
}

function randomEntry<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function portraitPool(): PortraitRecord[] {
  return portraitsData.Avatar.filter(
    (portrait): portrait is PortraitRecord => portrait !== null,
  );
}

function framePool(): FrameRecord[] {
  return framesData.Frames.filter(
    (frame): frame is FrameRecord => frame !== null,
  );
}

export function generateMockAvatars(): MockAvatar[] {
  const count = 1 + Math.floor(Math.random() * 3);
  const portraits = portraitPool();
  const frames = framePool();

  return Array.from({ length: count }, (_, index) => {
    const portrait = randomEntry(portraits);
    const frame = randomEntry(frames);

    return {
      id: `mock-avatar-${index + 1}`,
      name: portrait.avatarName,
      race: RACES[(portrait.avatarRace - 1 + RACES.length) % RACES.length],
      role: ROLES[(portrait.avatarRole - 1 + ROLES.length) % ROLES.length],
      portrait: `avatar_${portrait.avatarID}.webp`,
      frame: `frame_${frame.frameID}.webp`,
      level: 1,
      experience: 0,
    };
  });
}
