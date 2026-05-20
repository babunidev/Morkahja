import { useRef, type CSSProperties } from 'react';
import { useMusic } from '../music/MusicEngine.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const MUSIC_CONTROL_ASSET = '/UI/06_SettingsMenu/im_music.webp';
const KNOB_BASE_WIDTH_PX = 54;
const KNOB_MIN_SCALE = 0.34;
const KNOB_MAX_SCALE = 1;

const rowStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const labelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
};

const trackStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: 52,
  touchAction: 'none',
  cursor: 'pointer',
  userSelect: 'none',
};

const barStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  height: 8,
  transform: 'translateY(-50%)',
  border: '1px solid rgba(255, 204, 102, 0.68)',
  borderRadius: 999,
  background: 'rgba(17, 7, 4, 0.75)',
  overflow: 'hidden',
  pointerEvents: 'none',
};

const fillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, #330000 0%, #ffcc66 100%)',
};

function knobScaleForVolume(volume: number): number {
  return KNOB_MIN_SCALE + volume * (KNOB_MAX_SCALE - KNOB_MIN_SCALE);
}

function volumeFromClientX(clientX: number, track: HTMLElement): number {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }

  return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
}

export function MusicVolumeSlider({ disabled = false }: { disabled?: boolean }) {
  const music = useMusic();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const volume = music.volume;
  const knobScale = knobScaleForVolume(volume);

  function updateFromPointer(clientX: number): void {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    music.setVolume(volumeFromClientX(clientX, track));
  }

  return (
    <div style={rowStyle}>
      <div style={labelRowStyle}>
        <span>Music</span>
        <span>{Math.round(volume * 100)}%</span>
      </div>
      <div
        aria-disabled={disabled}
        aria-label="Music volume"
        aria-valuemax={100}
        aria-valuenow={Math.round(volume * 100)}
        aria-valuemin={0}
        onPointerDown={(event) => {
          if (disabled) {
            return;
          }

          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (disabled || event.buttons !== 1) {
            return;
          }

          updateFromPointer(event.clientX);
        }}
        onPointerUp={() => {
          if (disabled) {
            return;
          }

          playSfx(DEFAULT_BUTTON_SOUND);
        }}
        ref={trackRef}
        role="slider"
        style={{
          ...trackStyle,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <div style={barStyle}>
          <div style={{ ...fillStyle, width: `${Math.round(volume * 100)}%` }} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: `${volume * 100}%`,
            top: '50%',
            width: KNOB_BASE_WIDTH_PX,
            transform: `translate(-50%, -50%) scale(${knobScale})`,
            transformOrigin: 'center center',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5))',
          }}
        >
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={MUSIC_CONTROL_ASSET}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MusicVolumeSlider;
