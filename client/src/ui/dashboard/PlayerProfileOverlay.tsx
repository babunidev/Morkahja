import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  DiceId,
  PlayerProfileAvatarDto,
  PlayerProfileResponse,
  UnlockedTitleOptionDto,
  WallOfFameEntryDto,
} from '@shared/contracts';
import { DICE_CATALOG } from '@shared/diceCatalog.js';
import { fetchPlayerProfile, selectDice, setAvatarDisplayTitle } from '../../api/http.js';
import { protectedImageProps } from '../protectedImage.js';
import { formatAvatarDisplayName } from '../avatar/avatarDisplayName.js';
import AvatarPortraitStack from '../avatar/AvatarPortraitStack.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const OVERLAY_FADE_MS = 300;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 6,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.72)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  width: 'min(92vw, 420px)',
  maxHeight: 'min(86vh, 620px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 12,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  overflow: 'hidden',
  ...protectedOverlayTextStyle,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleGroupStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: '0.45rem 0.65rem',
  minWidth: 0,
  flex: '1 1 auto',
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.45rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
};

const bodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  display: 'grid',
  gap: 16,
  alignContent: 'start',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const headerPlayerNameStyle: CSSProperties = {
  margin: 0,
  color: '#f7efe0',
  fontSize: '1.05rem',
  fontWeight: 400,
  fontFamily: 'Georgia, serif',
  letterSpacing: '0.02em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 'min(48vw, 200px)',
};

const playerMetaStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.9rem',
};

const sectionTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: '#ffcc66',
  fontSize: '0.92rem',
  fontWeight: 400,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const currentSlotsStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const slotCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '104px minmax(0, 1fr) auto',
  gap: 14,
  alignItems: 'center',
  padding: '12px 14px',
  border: '1px solid rgba(255, 204, 102, 0.28)',
  borderRadius: 10,
  background: 'rgba(8, 5, 4, 0.55)',
};

const emptySlotStyle: CSSProperties = {
  ...slotCardStyle,
  borderStyle: 'dashed',
  borderColor: 'rgba(255, 204, 102, 0.18)',
};

const slotPortraitStyle: CSSProperties = {
  width: 104,
  height: 124,
  flexShrink: 0,
};

const slotDetailsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 6,
  minWidth: 0,
};

const slotNameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.05rem',
  fontFamily: 'Breathe Fire, Georgia, serif',
  lineHeight: 1.2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const slotRaceRoleStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.78)',
  fontSize: '0.84rem',
  lineHeight: 1.35,
  letterSpacing: '0.04em',
};

const slotLevelStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.9rem',
  lineHeight: 1.35,
};

const titleSelectWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  justifyItems: 'end',
  alignSelf: 'stretch',
  justifyContent: 'center',
};

const titleSelectLabelStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 204, 102, 0.72)',
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const titleSelectStyle: CSSProperties = {
  width: '100%',
  minWidth: 108,
  maxWidth: 120,
  minHeight: 38,
  padding: '6px 8px',
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.82rem',
  cursor: 'pointer',
};

const emptySlotPortraitStyle: CSSProperties = {
  ...slotPortraitStyle,
  borderRadius: 8,
  border: '1px dashed rgba(255, 204, 102, 0.16)',
  background: 'rgba(8, 5, 4, 0.35)',
};

const emptySlotLabelStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.45)',
  fontSize: '0.9rem',
};

const diceGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
};

const diceButtonBaseStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  justifyItems: 'center',
  padding: 8,
  borderRadius: 10,
  border: '1px solid rgba(255, 204, 102, 0.28)',
  background: 'rgba(8, 5, 4, 0.55)',
  cursor: 'pointer',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
};

const diceButtonSelectedStyle: CSSProperties = {
  borderColor: 'rgba(255, 204, 102, 0.88)',
  boxShadow: '0 0 12px rgba(255, 204, 102, 0.35)',
};

const dicePreviewStyle: CSSProperties = {
  width: 56,
  height: 56,
  objectFit: 'contain',
};

const diceLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.72rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'rgba(247, 239, 224, 0.82)',
};

const fameListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const fameCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  padding: '10px 12px',
  border: '1px solid rgba(180, 90, 70, 0.38)',
  borderRadius: 10,
  background: 'rgba(24, 8, 6, 0.62)',
};

const famePortraitStyle: CSSProperties = {
  width: 56,
  height: 64,
};

const fameNameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '0.98rem',
  fontFamily: 'Breathe Fire, Georgia, serif',
};

const fameMetaStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.84rem',
  lineHeight: 1.4,
};

const messageStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.78)',
  fontSize: '0.9rem',
};

const errorMessageStyle: CSSProperties = {
  ...messageStyle,
  color: '#ffb4a8',
};

function formatJoinedAt(joinedAt: number): string {
  if (!Number.isFinite(joinedAt) || joinedAt <= 0) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(joinedAt));
}

function CurrentAvatarSlot({
  avatar,
  titleSavePending,
  unlockedTitles,
  onTitleChange,
}: {
  avatar: PlayerProfileAvatarDto;
  titleSavePending: boolean;
  unlockedTitles: UnlockedTitleOptionDto[];
  onTitleChange: (avatarId: string, displayTitle: string | null) => void;
}) {
  const selectedTitle = avatar.displayTitle ?? '';
  const hasCurrentTitle = selectedTitle.length > 0;
  const currentTitleListed = !hasCurrentTitle
    || unlockedTitles.some((option) => option.title === selectedTitle);

  return (
    <article style={slotCardStyle}>
      <div style={slotPortraitStyle}>
        <AvatarPortraitStack frame={avatar.frame} portrait={avatar.portrait} />
      </div>
      <div style={slotDetailsStyle}>
        <p style={slotNameStyle}>{formatAvatarDisplayName(avatar)}</p>
        <p style={slotRaceRoleStyle}>
          {avatar.race} {avatar.role}
        </p>
        <p style={slotLevelStyle}>Level {avatar.level}</p>
      </div>
      <label style={titleSelectWrapStyle}>
        <span style={titleSelectLabelStyle}>Title</span>
        <select
          aria-label={`Select title for ${avatar.name}`}
          disabled={titleSavePending}
          onChange={(event) => {
            const nextTitle = event.target.value;
            onTitleChange(avatar.id, nextTitle.length > 0 ? nextTitle : null);
          }}
          style={titleSelectStyle}
          value={currentTitleListed ? selectedTitle : ''}
        >
          <option value="">No title</option>
          {!currentTitleListed && hasCurrentTitle ? (
            <option value={selectedTitle}>{selectedTitle}</option>
          ) : null}
          {unlockedTitles.map((option) => (
            <option
              key={`${option.achievementId}-${option.rank}`}
              value={option.title}
            >
              {option.title}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function EmptyAvatarSlot() {
  return (
    <article style={emptySlotStyle}>
      <div aria-hidden="true" style={emptySlotPortraitStyle} />
      <div style={slotDetailsStyle}>
        <p style={emptySlotLabelStyle}>Empty slot</p>
      </div>
    </article>
  );
}

function WallOfFameCard({ entry }: { entry: WallOfFameEntryDto }) {
  return (
    <article style={fameCardStyle}>
      <div style={famePortraitStyle}>
        <AvatarPortraitStack frame={entry.frame} portrait={entry.portrait} />
      </div>
      <div>
        <p style={fameNameStyle}>{entry.name}</p>
        <p style={fameMetaStyle}>
          Level {entry.level} · {entry.encountersPlayed} encounters
        </p>
      </div>
    </article>
  );
}

export function PlayerProfileOverlay({
  fallbackPlayerName,
  onAvatarsChanged,
  onClose,
  open,
}: {
  fallbackPlayerName: string;
  onAvatarsChanged?: () => void;
  onClose: () => void;
  open: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [profile, setProfile] = useState<PlayerProfileResponse | null>(null);
  const [loadPending, setLoadPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [titleSaveError, setTitleSaveError] = useState<string | null>(null);
  const [titleSavePendingId, setTitleSavePendingId] = useState<string | null>(null);
  const [diceSavePending, setDiceSavePending] = useState(false);
  const [diceSaveError, setDiceSaveError] = useState<string | null>(null);

  const refreshProfile = useCallback(async (): Promise<void> => {
    setLoadPending(true);

    try {
      const response = await fetchPlayerProfile();
      setProfile(response);
      setLoadError(null);
    } catch (error) {
      setProfile(null);
      setLoadError(error instanceof Error ? error.message : 'Could not load profile');
    } finally {
      setLoadPending(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setProfile(null);
      setLoadError(null);
      setTitleSaveError(null);
      setTitleSavePendingId(null);
      setDiceSavePending(false);
      setDiceSaveError(null);
      setLoadPending(false);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void refreshProfile();
  }, [open, refreshProfile]);

  const currentSlots = useMemo(
    () => Array.from({ length: 3 }, (_, index) => profile?.avatars[index] ?? null),
    [profile?.avatars],
  );

  const unlockedTitles = profile?.unlockedTitles ?? [];
  const unlockedDiceIds = profile?.unlockedDiceIds ?? [];
  const selectedDiceId = profile?.selectedDiceId ?? 'a';
  const unlockedDiceCatalog = DICE_CATALOG.filter((entry) => (
    unlockedDiceIds.includes(entry.id)
  ));

  async function handleDiceSelect(diceId: DiceId): Promise<void> {
    if (diceSavePending || diceId === selectedDiceId) {
      return;
    }

    setDiceSavePending(true);
    setDiceSaveError(null);
    playSfx(DEFAULT_BUTTON_SOUND);

    try {
      const result = await selectDice(diceId);

      setProfile((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          selectedDiceId: result.selectedDiceId,
          unlockedDiceIds: result.unlockedDiceIds,
        };
      });
    } catch (error) {
      setDiceSaveError(
        error instanceof Error ? error.message : 'Could not update selected die',
      );
    } finally {
      setDiceSavePending(false);
    }
  }

  async function handleTitleChange(
    avatarId: string,
    displayTitle: string | null,
  ): Promise<void> {
    setTitleSavePendingId(avatarId);
    setTitleSaveError(null);
    playSfx(DEFAULT_BUTTON_SOUND);

    try {
      const result = await setAvatarDisplayTitle(avatarId, displayTitle);

      setProfile((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          avatars: current.avatars.map((avatar) => (
            avatar.id === avatarId
              ? {
                  ...avatar,
                  displayTitle: result.avatar.displayTitle ?? null,
                }
              : avatar
          )),
        };
      });
      onAvatarsChanged?.();
    } catch (error) {
      setTitleSaveError(
        error instanceof Error ? error.message : 'Could not update avatar title',
      );
    } finally {
      setTitleSavePendingId(null);
    }
  }

  if (!open) {
    return null;
  }

  const displayName = profile?.playerName?.trim() || fallbackPlayerName.trim() || 'Adventurer';

  return (
    <div
      aria-label="Player profile"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="player-profile-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <div style={titleGroupStyle}>
            <h2 id="player-profile-overlay-title" style={titleStyle}>
              PROFILE
            </h2>
            <p aria-label={`Player name: ${displayName}`} style={headerPlayerNameStyle}>
              {displayName}
            </p>
          </div>
          <ClosePanelButton onClose={onClose} pressKey="profile-close" />
        </header>
        <div data-player-profile-scroll="" style={bodyStyle}>
          <style>
            {'[data-player-profile-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          <p style={playerMetaStyle}>
            Joined {profile ? formatJoinedAt(profile.joinedAt) : '…'}
          </p>
          {loadError ? <p style={errorMessageStyle}>{loadError}</p> : null}
          {titleSaveError ? <p style={errorMessageStyle}>{titleSaveError}</p> : null}
          {diceSaveError ? <p style={errorMessageStyle}>{diceSaveError}</p> : null}
          {loadPending && !profile ? (
            <p style={messageStyle}>Loading profile…</p>
          ) : (
            <>
              <div>
                <h3 style={sectionTitleStyle}>Current avatars</h3>
                <div style={currentSlotsStyle}>
                  {currentSlots.map((avatar, index) => (
                    avatar ? (
                      <CurrentAvatarSlot
                        avatar={avatar}
                        key={avatar.id}
                        onTitleChange={(avatarId, displayTitle) => {
                          void handleTitleChange(avatarId, displayTitle);
                        }}
                        titleSavePending={titleSavePendingId === avatar.id}
                        unlockedTitles={unlockedTitles}
                      />
                    ) : (
                      <EmptyAvatarSlot key={`empty-slot-${index}`} />
                    )
                  ))}
                </div>
              </div>
              <div>
                <h3 style={sectionTitleStyle}>Dice</h3>
                {unlockedDiceCatalog.length === 0 ? (
                  <p style={messageStyle}>No dice unlocked yet.</p>
                ) : (
                  <div style={diceGridStyle}>
                    {unlockedDiceCatalog.map((entry) => {
                      const selected = entry.id === selectedDiceId;

                      return (
                        <button
                          aria-label={`Use ${entry.label}`}
                          aria-pressed={selected}
                          disabled={diceSavePending}
                          key={entry.id}
                          onClick={() => {
                            void handleDiceSelect(entry.id);
                          }}
                          style={{
                            ...diceButtonBaseStyle,
                            ...(selected ? diceButtonSelectedStyle : {}),
                            opacity: diceSavePending && !selected ? 0.7 : 1,
                          }}
                          type="button"
                        >
                          <img
                            alt=""
                            aria-hidden="true"
                            {...protectedImageProps}
                            src={entry.assetPath}
                            style={dicePreviewStyle}
                          />
                          <span style={diceLabelStyle}>{entry.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <h3 style={sectionTitleStyle}>Wall of fame</h3>
                {(profile?.wallOfFame ?? []).length === 0 ? (
                  <p style={messageStyle}>No fallen avatars yet.</p>
                ) : (
                  <div style={fameListStyle}>
                    {(profile?.wallOfFame ?? []).map((entry) => (
                      <WallOfFameCard entry={entry} key={`${entry.id}-${entry.diedAt}`} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default PlayerProfileOverlay;
