import type { CSSProperties } from 'react';

const FRAME_MASK = '/UI/09_GAME/im_spacer_line.webp';

/** On top within the header row (row z-index 50 in GameEnvironment). */
export const ENCOUNTER_HEADER_SEAM_Z_INDEX = 40;

/** Anchored to the header bottom edge, then shifted down to overlap the encounter seam. */
const seamStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 0,
  width: '108%',
  height: 10,
  objectFit: 'cover',
  transform: 'translate(-50%, 7px)',
  zIndex: ENCOUNTER_HEADER_SEAM_Z_INDEX,
  pointerEvents: 'none',
};

export function EncounterHeaderSeam() {
  return (
    <img
      alt=""
      aria-hidden="true"
      draggable={false}
      src={FRAME_MASK}
      style={seamStyle}
    />
  );
}

export default EncounterHeaderSeam;
