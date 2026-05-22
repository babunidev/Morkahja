import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { AchievementProgressDto, FriendSummaryDto } from '@shared/contracts';
import { addFriend, fetchFriendAchievements, fetchFriends } from '../../api/http.js';
import AvatarPortraitStack from '../avatar/AvatarPortraitStack.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import AchievementPanel from './AchievementPanel.js';

const FRIENDS_UI_ROOT = '/UI/07_FriendsMenu';
const ADD_FRIEND_BUTTON = `${FRIENDS_UI_ROOT}/im_button_add_friend.webp`;
const ONLINE_ICON = `${FRIENDS_UI_ROOT}/im_button_friend_online.webp`;
const OFFLINE_ICON = `${FRIENDS_UI_ROOT}/im_button_friend_offline.webp`;
const FRIENDS_POLL_MS = 15_000;
const OVERLAY_FADE_MS = 300;

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
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.45rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
};

const closeButtonStyle: CSSProperties = {
  minWidth: 72,
  minHeight: 34,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
};

const backButtonStyle: CSSProperties = {
  ...closeButtonStyle,
  minWidth: 64,
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
  gridTemplateColumns: '64px minmax(0, 1fr) 28px',
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

function FriendRow({
  friend,
  onSelect,
}: {
  friend: FriendSummaryDto;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={() => {
        playSfx(DEFAULT_BUTTON_SOUND);
        onSelect();
      }}
      style={friendRowStyle}
      type="button"
    >
      <div style={portraitWrapStyle}>
        <AvatarPortraitStack frame={friend.frame} portrait={friend.portrait} />
      </div>
      <div>
        <p style={friendNameStyle}>{friend.playerName}</p>
        <p style={friendMetaStyle}>
          {friend.online ? 'Online' : 'Offline'}
          {friend.avatarName ? ` · Last played: ${friend.avatarName}` : ''}
        </p>
      </div>
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={friend.online ? ONLINE_ICON : OFFLINE_ICON}
        style={statusIconStyle}
      />
    </button>
  );
}

export function FriendsOverlay({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [friends, setFriends] = useState<FriendSummaryDto[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendSummaryDto | null>(null);
  const [friendAchievements, setFriendAchievements] = useState<AchievementProgressDto[]>([]);
  const [addQuery, setAddQuery] = useState('');
  const [addPending, setAddPending] = useState(false);
  const [loadPending, setLoadPending] = useState(false);
  const [achievementsPending, setAchievementsPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
    setAchievementsPending(true);
    setLoadError(null);

    try {
      const response = await fetchFriendAchievements(friend.playerId);
      setFriendAchievements(response.achievements);
      setSelectedFriend({
        ...friend,
        playerName: response.playerName,
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load achievements');
      setFriendAchievements([]);
    } finally {
      setAchievementsPending(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setSelectedFriend(null);
      setFriendAchievements([]);
      setAddQuery('');
      setStatusMessage(null);
      setLoadError(null);
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
    <div
      aria-label="Friends"
      onClick={onClose}
      role="presentation"
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
        style={panelStyle}
      >
        <header style={headerStyle}>
          {selectedFriend ? (
            <button
              onClick={() => {
                playSfx(DEFAULT_BUTTON_SOUND);
                setSelectedFriend(null);
                setFriendAchievements([]);
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
          <button
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onClose();
            }}
            style={closeButtonStyle}
            type="button"
          >
            Close
          </button>
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
                <p style={messageStyle}>Loading achievements…</p>
              ) : (
                <AchievementPanel
                  achievements={friendAchievements}
                  claimPending={false}
                  dailyReward={null}
                  onClaimDailyReward={() => {}}
                />
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
                  disabled={addPending || !addQuery.trim()}
                  onClick={() => {
                    void handleAddFriend();
                  }}
                  style={
                    addPending || !addQuery.trim()
                      ? addButtonDisabledStyle
                      : addButtonStyle
                  }
                  type="button"
                >
                  <img
                    alt=""
                    draggable={false}
                    src={ADD_FRIEND_BUTTON}
                    style={addButtonImageStyle}
                  />
                </button>
              </div>
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
                    key={friend.playerId}
                    onSelect={() => {
                      setSelectedFriend(friend);
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
  );
}

export default FriendsOverlay;
