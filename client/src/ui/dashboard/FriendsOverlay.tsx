import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type {
  AchievementProgressDto,
  FriendAvatarDto,
  FriendSummaryDto,
} from '@shared/contracts';
import { addFriend, fetchFriendAchievements, fetchFriends } from '../../api/http.js';
import AvatarPortraitStack from '../avatar/AvatarPortraitStack.js';
import {
  protectedImageProps,
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import AchievementPanel from './AchievementPanel.js';
import SoulLinkOverlay from './SoulLinkOverlay.js';

const FRIENDS_UI_ROOT = '/UI/07_FriendsMenu';
const ADD_FRIEND_BUTTON = `${FRIENDS_UI_ROOT}/im_button_add_friend.webp`;
const ONLINE_ICON = `${FRIENDS_UI_ROOT}/im_button_friend_online.webp`;
const OFFLINE_ICON = `${FRIENDS_UI_ROOT}/im_button_friend_offline.webp`;
const FRIENDS_POLL_MS = 15_000;
const OVERLAY_FADE_MS = 300;

function isSelfFriendQuery(
  query: string,
  playerId: string,
  playerName: string,
): boolean {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized === playerId.toLowerCase()
    || normalized === playerName.trim().toLowerCase()
  );
}

function addFriendErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Could not add friend';

  if (message.includes('PLAYER_NOT_FOUND')) {
    return 'No player found with that name.';
  }

  if (message.includes('CANNOT_ADD_SELF')) {
    return 'You cannot add yourself.';
  }

  if (message.includes('FRIEND_ALREADY_ADDED')) {
    return 'That player is already on your friend list.';
  }

  return message;
}

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
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: 12,
};

const soulLinkHeaderButtonStyle: CSSProperties = {
  justifySelf: 'center',
  minHeight: 34,
  padding: '6px 16px',
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: '0.98rem',
  letterSpacing: '0.05em',
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
  gap: 12,
  alignContent: 'start',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const backButtonStyle: CSSProperties = {
  minWidth: 64,
  minHeight: 34,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
};

const addRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'center',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 38,
  padding: '8px 12px',
  border: '1px solid rgba(255, 204, 102, 0.45)',
  borderRadius: 9,
  background: 'rgba(8, 5, 4, 0.72)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};

const addButtonStyle: CSSProperties = {
  width: 52,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const addButtonDisabledStyle: CSSProperties = {
  ...addButtonStyle,
  opacity: 0.45,
  cursor: 'default',
};

const addButtonImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.88rem',
  lineHeight: 1.45,
  textAlign: 'center',
  color: 'rgba(247, 239, 224, 0.88)',
};

const errorMessageStyle: CSSProperties = {
  ...messageStyle,
  color: '#ffb0a8',
};

const listStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const friendRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '64px minmax(0, 1fr) auto 28px',
  gap: 12,
  alignItems: 'center',
  width: '100%',
  padding: '10px 12px',
  border: '1px solid rgba(255, 204, 102, 0.32)',
  borderRadius: 10,
  background: 'rgba(8, 5, 4, 0.55)',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
};

const joinFriendButtonStyle: CSSProperties = {
  minWidth: 58,
  padding: '5px 10px',
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 8,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontSize: '0.78rem',
  letterSpacing: '0.04em',
};

const portraitWrapStyle: CSSProperties = {
  width: 64,
  height: 74,
};

const friendNameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.05rem',
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
};

const friendMetaStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'rgba(247, 239, 224, 0.78)',
  fontSize: '0.82rem',
};

const statusIconStyle: CSSProperties = {
  width: 24,
  height: 24,
  objectFit: 'contain',
};

const detailHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  padding: '4px 2px 8px',
  borderBottom: '1px solid rgba(255, 204, 102, 0.28)',
};

const detailPortraitStyle: CSSProperties = {
  width: 72,
  height: 82,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 204, 102, 0.82)',
  fontSize: '0.82rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const avatarGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const avatarCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  padding: '10px 12px',
  border: '1px solid rgba(255, 204, 102, 0.28)',
  borderRadius: 10,
  background: 'rgba(8, 5, 4, 0.55)',
};

const avatarCardLastPlayedStyle: CSSProperties = {
  ...avatarCardStyle,
  borderColor: 'rgba(140, 230, 160, 0.45)',
  boxShadow: 'inset 0 0 0 1px rgba(140, 230, 160, 0.18)',
};

const avatarCardPortraitStyle: CSSProperties = {
  width: 56,
  height: 64,
};

const avatarCardNameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '0.98rem',
  fontFamily: 'Breathe Fire, Georgia, serif',
};

const avatarCardMetaStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.84rem',
  lineHeight: 1.4,
};

const avatarCardTagStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'rgba(140, 230, 160, 0.9)',
  fontSize: '0.74rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

function FriendAvatarCard({ avatar }: { avatar: FriendAvatarDto }) {
  return (
    <article style={avatar.lastPlayed ? avatarCardLastPlayedStyle : avatarCardStyle}>
      <div style={avatarCardPortraitStyle}>
        <AvatarPortraitStack frame={avatar.frame} portrait={avatar.portrait} />
      </div>
      <div>
        <p style={avatarCardNameStyle}>{avatar.name}</p>
        <p style={avatarCardMetaStyle}>
          Level {avatar.level} · {avatar.race} {avatar.role}
        </p>
        {avatar.lastPlayed ? <p style={avatarCardTagStyle}>Last played</p> : null}
      </div>
    </article>
  );
}

function FriendRow({
  friend,
  joinPending,
  onJoin,
  onSelect,
}: {
  friend: FriendSummaryDto;
  joinPending: boolean;
  onJoin?: () => void;
  onSelect: () => void;
}) {
  const showJoin = Boolean(friend.joinableRoom && onJoin);

  return (
    <div style={friendRowStyle}>
      <button
        onClick={() => {
          playSfx(DEFAULT_BUTTON_SOUND);
          onSelect();
        }}
        style={{
          display: 'contents',
          padding: 0,
          border: 0,
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
        type="button"
      >
        <div style={portraitWrapStyle}>
          <AvatarPortraitStack frame={friend.frame} portrait={friend.portrait} />
        </div>
        <div>
          <p style={friendNameStyle}>{friend.playerName}</p>
          <p style={friendMetaStyle}>
            {friend.online ? 'Online' : 'Offline'}
            {friend.joinableRoom
              ? ` · ${friend.joinableRoom.encounterTitle}`
              : friend.avatarName
                ? ` · Last played: ${friend.avatarName}`
                : ''}
          </p>
        </div>
      </button>
      {showJoin ? (
        <button
          aria-label={`Join ${friend.playerName}`}
          disabled={joinPending}
          onClick={(event) => {
            event.stopPropagation();
            playSfx(DEFAULT_BUTTON_SOUND);
            onJoin?.();
          }}
          style={{
            ...joinFriendButtonStyle,
            opacity: joinPending ? 0.6 : 1,
            cursor: joinPending ? 'default' : 'pointer',
          }}
          type="button"
        >
          {joinPending ? '…' : 'Join'}
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <img
        alt=""
        aria-hidden="true"
        {...protectedImageProps}
        src={friend.online ? ONLINE_ICON : OFFLINE_ICON}
        style={statusIconStyle}
      />
    </div>
  );
}

export function FriendsOverlay({
  onClose,
  onJoinFriend,
  open,
  playerId,
  playerName,
}: {
  onClose: () => void;
  onJoinFriend?: (friend: FriendSummaryDto) => void | Promise<void>;
  open: boolean;
  playerId: string;
  playerName: string;
}) {
  const [visible, setVisible] = useState(false);
  const [friends, setFriends] = useState<FriendSummaryDto[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendSummaryDto | null>(null);
  const [friendAchievements, setFriendAchievements] = useState<AchievementProgressDto[]>([]);
  const [friendAvatars, setFriendAvatars] = useState<FriendAvatarDto[]>([]);
  const [addQuery, setAddQuery] = useState('');
  const [addPending, setAddPending] = useState(false);
  const [loadPending, setLoadPending] = useState(false);
  const [achievementsPending, setAchievementsPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [joiningFriendId, setJoiningFriendId] = useState<string | null>(null);
  const [soulLinkOpen, setSoulLinkOpen] = useState(false);
  const friendDetailRequestRef = useRef(0);

  const refreshFriends = useCallback(async (): Promise<void> => {
    setLoadPending(true);

    try {
      const response = await fetchFriends();
      setFriends(response.friends);
      setLoadError(null);
      setSelectedFriend((current) => {
        if (!current) {
          return current;
        }

        return response.friends.find((friend) => friend.playerId === current.playerId) ?? current;
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load friends');
    } finally {
      setLoadPending(false);
    }
  }, []);

  const loadFriendAchievements = useCallback(async (friend: FriendSummaryDto): Promise<void> => {
    const requestId = ++friendDetailRequestRef.current;
    setAchievementsPending(true);
    setLoadError(null);
    setFriendAchievements([]);
    setFriendAvatars([]);

    try {
      const response = await fetchFriendAchievements(friend.playerId);

      if (friendDetailRequestRef.current !== requestId) {
        return;
      }

      setSelectedFriend({
        ...friend,
        playerName: response.playerName ?? friend.playerName,
        online: Boolean(response.online),
        portrait: response.portrait ?? friend.portrait,
        frame: response.frame ?? friend.frame,
        avatarName: response.avatarName ?? friend.avatarName,
      });
      setFriendAchievements(response.achievements);
      setFriendAvatars(response.avatars);
    } catch (error) {
      if (friendDetailRequestRef.current !== requestId) {
        return;
      }

      setLoadError(error instanceof Error ? error.message : 'Could not load achievements');
      setFriendAchievements([]);
      setFriendAvatars([]);
    } finally {
      if (friendDetailRequestRef.current === requestId) {
        setAchievementsPending(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      friendDetailRequestRef.current += 1;
      setSelectedFriend(null);
      setFriendAchievements([]);
      setFriendAvatars([]);
      setAchievementsPending(false);
      setAddQuery('');
      setStatusMessage(null);
      setLoadError(null);
      setSoulLinkOpen(false);
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

    void refreshFriends();

    const pollTimer = window.setInterval(() => {
      void refreshFriends();
    }, FRIENDS_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [open, refreshFriends]);

  async function handleAddFriend(): Promise<void> {
    const query = addQuery.trim();

    if (!query || addPending) {
      return;
    }

    if (isSelfFriendQuery(query, playerId, playerName)) {
      setStatusMessage('You cannot add yourself.');
      return;
    }

    setAddPending(true);
    setStatusMessage(null);
    playSfx(DEFAULT_BUTTON_SOUND);

    try {
      const result = await addFriend(query);
      setFriends((current) => {
        const withoutDuplicate = current.filter(
          (friend) => friend.playerId !== result.friend.playerId,
        );

        return [result.friend, ...withoutDuplicate].sort((left, right) => {
          if (left.online !== right.online) {
            return left.online ? -1 : 1;
          }

          return left.playerName.localeCompare(right.playerName, undefined, { sensitivity: 'base' });
        });
      });
      setAddQuery('');
      setStatusMessage(`${result.friend.playerName} added to your friend list.`);
    } catch (error) {
      setStatusMessage(addFriendErrorMessage(error));
    } finally {
      setAddPending(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <>
    <div
      aria-label="Friends"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="friends-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          {selectedFriend ? (
            <button
              onClick={() => {
                playSfx(DEFAULT_BUTTON_SOUND);
                friendDetailRequestRef.current += 1;
                setSelectedFriend(null);
                setFriendAchievements([]);
                setFriendAvatars([]);
                setAchievementsPending(false);
                setLoadError(null);
              }}
              style={backButtonStyle}
              type="button"
            >
              Back
            </button>
          ) : (
            <h2 id="friends-overlay-title" style={titleStyle}>
              FRIENDS
            </h2>
          )}
          {selectedFriend ? (
            <span aria-hidden="true" />
          ) : (
            <button
              onClick={() => {
                playSfx(DEFAULT_BUTTON_SOUND);
                setSoulLinkOpen(true);
              }}
              style={soulLinkHeaderButtonStyle}
              type="button"
            >
              Soul Link
            </button>
          )}
          <ClosePanelButton onClose={onClose} pressKey="friends-close" />
        </header>
        <div data-friends-scroll="" style={bodyStyle}>
          <style>
            {'[data-friends-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          {selectedFriend ? (
            <>
              <div style={detailHeaderStyle}>
                <div style={detailPortraitStyle}>
                  <AvatarPortraitStack
                    frame={selectedFriend.frame}
                    portrait={selectedFriend.portrait}
                  />
                </div>
                <div>
                  <p style={friendNameStyle}>{selectedFriend.playerName}</p>
                  <p style={friendMetaStyle}>
                    {selectedFriend.online ? 'Online' : 'Offline'}
                    {selectedFriend.avatarName ? ` · Last played: ${selectedFriend.avatarName}` : ''}
                  </p>
                </div>
              </div>
              {loadError ? <p style={errorMessageStyle}>{loadError}</p> : null}
              {achievementsPending ? (
                <p style={messageStyle}>Loading friend profile…</p>
              ) : (
                <>
                  <h3 style={sectionTitleStyle}>Avatars</h3>
                  {(friendAvatars ?? []).length === 0 ? (
                    <p style={messageStyle}>No avatars yet.</p>
                  ) : (
                    <div style={avatarGridStyle}>
                      {(friendAvatars ?? []).map((avatar) => (
                        <FriendAvatarCard avatar={avatar} key={avatar.id || avatar.name} />
                      ))}
                    </div>
                  )}
                  <h3 style={sectionTitleStyle}>Achievements</h3>
                  <AchievementPanel
                    achievements={friendAchievements}
                    claimPending={false}
                    dailyReward={null}
                    onClaimDailyReward={() => {}}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <div style={addRowStyle}>
                <input
                  aria-label="Friend player name"
                  disabled={addPending}
                  onChange={(event) => {
                    setAddQuery(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleAddFriend();
                    }
                  }}
                  placeholder="Player name"
                  style={inputStyle}
                  value={addQuery}
                />
                <button
                  aria-label="Add friend"
                  disabled={
                    addPending
                    || !addQuery.trim()
                    || isSelfFriendQuery(addQuery, playerId, playerName)
                  }
                  onClick={() => {
                    void handleAddFriend();
                  }}
                  style={
                    addPending
                    || !addQuery.trim()
                    || isSelfFriendQuery(addQuery, playerId, playerName)
                      ? addButtonDisabledStyle
                      : addButtonStyle
                  }
                  type="button"
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    {...protectedImageProps}
                    src={ADD_FRIEND_BUTTON}
                    style={addButtonImageStyle}
                  />
                </button>
              </div>
              {isSelfFriendQuery(addQuery, playerId, playerName) ? (
                <p style={errorMessageStyle}>You cannot add yourself.</p>
              ) : null}
              {statusMessage ? (
                <p
                  style={
                    statusMessage.includes('added')
                      ? messageStyle
                      : errorMessageStyle
                  }
                >
                  {statusMessage}
                </p>
              ) : null}
              {loadError ? <p style={errorMessageStyle}>{loadError}</p> : null}
              {loadPending && friends.length === 0 ? (
                <p style={messageStyle}>Loading friends…</p>
              ) : null}
              {!loadPending && friends.length === 0 ? (
                <p style={messageStyle}>No friends yet. Add someone by player name.</p>
              ) : null}
              <div style={listStyle}>
                {friends.map((friend) => (
                  <FriendRow
                    friend={friend}
                    joinPending={joiningFriendId === friend.playerId}
                    key={friend.playerId}
                    onJoin={friend.joinableRoom && onJoinFriend
                      ? () => {
                          setJoiningFriendId(friend.playerId);
                          void Promise.resolve(onJoinFriend(friend))
                            .finally(() => {
                              setJoiningFriendId(null);
                            });
                        }
                      : undefined}
                    onSelect={() => {
                      setSelectedFriend(friend);
                      setAchievementsPending(true);
                      setFriendAchievements([]);
                      setFriendAvatars([]);
                      setLoadError(null);
                      void loadFriendAchievements(friend);
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
    <SoulLinkOverlay
      onClose={() => {
        setSoulLinkOpen(false);
      }}
      onLinked={() => {
        void refreshFriends();
      }}
      open={soulLinkOpen}
      playerId={playerId}
      playerName={playerName}
    />
    </>
  );
}

export default FriendsOverlay;
