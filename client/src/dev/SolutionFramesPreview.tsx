/* eslint-disable react-refresh/only-export-components -- a dev page entry, never hot-reloaded as a module */
import { StrictMode, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { assetUrl } from '../assetUrl.js';
import { FramedSolutionPicture, SolutionImage } from '../ui/common/SolutionFrame.js';
import type { SolutionFrameLook } from '../ui/common/solutionFrameLook.js';
import { seedFromText } from '../ui/game/blocks/encounterFrameGeometry.js';
import { setGameContent } from '../data/gameContent.js';
import type { GameContentDto } from '@shared/contracts';

document.body.style.background = '#120a06';

/**
 * Local-only preview of the round solution frames (dev server:
 * /dev/solution-frames.html). Shows every frame with the remade pictures at
 * the sizes the game uses, next to an old picture with its painted frame.
 */

const ROOT = assetUrl('/game/solutionimages');
const REMADE = ['skill_learn', 'skill_buy'];
const SIZES = [56, 72, 104, 180];
/** Made-up charge counts for the preview. */
const SAMPLE_CHARGES = [1, 3, 12, 2, 1, 5, 0, 1, 2, 7];
/** As the game shows them: every solution picture framed, older ones zoomed past their painted rim. */
const IN_GAME = [
  'skill_warmth',
  'tool_light_torch',
  'weapon_grimnir_runeblade',
  'tool_key_mystic',
  'skill_learn',
  'skill_buy',
  'skill_lockpick',
  'skill_search',
  'tool_heal_simple_potion',
  '10040_fyraan',
  '10122_nereval',
  '10011_aetheria',
  '10036_umbrael',
  'tool_epic_atranor_potion',
  '10153_everglaive',
  'weapon_legendary_titanpike',
];

const LOOKS: Array<{ label: string; look: SolutionFrameLook }> = [
  { label: 'Standard — skills and simple items', look: { tier: 'standard', element: null, frameless: true } },
  { label: 'Essence — fire (Ignis Council)', look: { tier: 'essence', element: 'fire', frameless: true } },
  { label: 'Essence — water (Abyssal Conclave)', look: { tier: 'essence', element: 'water', frameless: true } },
  { label: 'Essence — air (Celestial Convocation)', look: { tier: 'essence', element: 'air', frameless: true } },
  { label: 'Essence — earth (Terran Assembly)', look: { tier: 'essence', element: 'earth', frameless: true } },
  { label: 'Rare — valuable items', look: { tier: 'rare', element: null, frameless: true } },
];

const pageStyle: CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '24px 16px 48px',
  color: '#f3dfb5',
  fontFamily: 'Georgia, serif',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 28,
  padding: '18px 8px 26px',
  borderBottom: '1px solid rgba(216, 176, 106, 0.18)',
};

function Preview() {
  return (
    <main style={{ ...pageStyle, minHeight: '100vh' }}>
      <h1 style={{ fontFamily: "'Breathe Fire', Georgia, serif", color: '#ffcc66', fontWeight: 400 }}>Solution frames</h1>
      <p style={{ opacity: 0.8 }}>
        Remade pictures with the frame the game draws. In the game the frame follows the solution data; here every
        frame is shown with both remade pictures. Last in each row: the old picture with its painted frame, for size.
      </p>
      <h2 style={{ fontSize: 17, fontWeight: 400, margin: '22px 0 0', color: '#d8b06a' }}>
        In the game — every picture, frame chosen from the solution data
      </h2>
      {[72, 120].map((size) => (
        <div key={size} style={rowStyle}>
          {IN_GAME.map((icon, index) => (
            <SolutionImage
              charges={SAMPLE_CHARGES[index % SAMPLE_CHARGES.length]}
              key={icon}
              src={`${ROOT}/${icon}.webp`}
              style={{ width: size }}
            />
          ))}
        </div>
      ))}
      {LOOKS.map(({ label, look }) => (
        <section key={label}>
          <h2 style={{ fontSize: 17, fontWeight: 400, margin: '22px 0 0', color: '#d8b06a' }}>{label}</h2>
          <div style={rowStyle}>
            {REMADE.flatMap((icon) => SIZES.map((size) => (
              <FramedSolutionPicture
                key={`${icon}-${size}`}
                look={look}
                seed={seedFromText(icon)}
                src={`${ROOT}/${icon}.webp`}
                style={{ width: size }}
              />
            )))}
            <img alt="Old picture with painted frame" src={`${ROOT}/skill_warmth.webp`} style={{ width: 104 }} />
          </div>
        </section>
      ))}
    </main>
  );
}

// The frames follow the solution data, which the game loads from the server.
setGameContent((await (await fetch('/game-data/content')).json()) as GameContentDto);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
