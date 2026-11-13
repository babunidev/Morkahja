import { useState, type CSSProperties } from 'react';
import type {
  EncounterRoomSnapshotDto,
  PersistedAvatar,
  RoomStateDto,
  SlotStateDto,
} from '../../../api/http.js';
import AvatarPanel from '../../avatar/AvatarPanel.js';
import type { AvatarDetailsSlotSide } from '../../avatar/AvatarPartyDetailsCard.js';
import { PROTECTED_SURFACE_ATTR } from '../../protectedImage.js';
import { GAME_SCREEN_LAYOUT, partyStripStyle } from '../gameScreenLayout.js';
import { useLayoutMode } from '../../layout/useLayoutMode.js';
import PartyEmptySlot from './PartyEmptySlot.js';
import PartyMemberSlot from './PartyMemberSlot.js';

const PARTY_SLOT_WIDTH = 148;

const partySlotStyle: CSSProperties = {
  flex: '0 0 auto',
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'auto',
  overflow: 'visible',
};

function slotSideForVisualIndex(visualIndex: number): AvatarDetailsSlotSide {
  if (visualIndex === 0) {
    return 'left';
  }
  if (visualIndex === 2) {
    return 'right';
  }
  return 'center';
}

/**
 * Desktop keeps 148 px slots, which may spill past the 390 px design canvas into
 * the letterbox. A phone has no letterbox, so there the three slots share the
 * screen width instead of running off its edge.
 */
function partySlotWidth(mobilePortrait: boolean): number | string {
  return mobilePortrait
    ? `min(${PARTY_SLOT_WIDTH}px, calc((100% - ${2 * GAME_SCREEN_LAYOUT.partySlotGap}px) / 3))`
    : PARTY_SLOT_WIDTH;
}

/**
 * Alone in the encounter, the avatar grows into the party strip's free height
 * (Babuni's direction, 2026-11-13): from just below the solutions to just above
 * the bottom buttons. Sized in the strip's container units, as tall as fits.
 */
const ALONE_TOP_CLEARANCE_PX = 22;
const ALONE_BOTTOM_CLEARANCE_PX = 10;
/** Height of the avatar panel (portrait, frame and essence row) per unit of width. */
const AVATAR_PANEL_HEIGHT_PER_WIDTH = 1.18;
const ALONE_AVATAR_WIDTH = `min(100cqw - ${2 * GAME_SCREEN_LAYOUT.partySlotGap + 2 * 44}px, `
  + `calc((100cqh - ${ALONE_TOP_CLEARANCE_PX + ALONE_BOTTOM_CLEARANCE_PX}px) / ${AVATAR_PANEL_HEIGHT_PER_WIDTH}))`;

function aloneSlotStyle(detailsOpen: boolean, main: boolean): CSSProperties {
  return main
    ? {
      ...partySlotStyle,
      width: ALONE_AVATAR_WIDTH,
      alignSelf: 'flex-end',
      marginBottom: ALONE_BOTTOM_CLEARANCE_PX,
      zIndex: detailsOpen ? 40 : 8,
    }
    : {
      ...partySlotStyle,
      // The empty side slots share what is left.
      flex: '1 1 0',
      minWidth: 0,
      zIndex: 8,
    };
}

function mainAvatarAnchorStyle(alone: boolean): CSSProperties {
  return {
    position: 'relative',
    width: '100%',
    maxWidth: alone ? 'none' : PARTY_SLOT_WIDTH,
    justifySelf: 'center',
    overflow: 'visible',
  };
}

function partySlotVisualStyle(avatarDetailsOpen: boolean, mobilePortrait: boolean): CSSProperties {
  return {
    ...partySlotStyle,
    width: partySlotWidth(mobilePortrait),
    minWidth: 0,
    zIndex: avatarDetailsOpen ? 40 : 8,
  };
}

export function PartyZone({
  avatar,
  hideAvatarPortraitForHandoff = false,
  homeVisible,
  onAvatarDetailsVisibleChange,
  onHome,
  onKickParticipant,
  onSlotStateChange,
  room = null,
  roomState,
  localXpGainAmount = 0,
  partyXpPulseByPlayer = {},
}: {
  avatar: PersistedAvatar;
  hideAvatarPortraitForHandoff?: boolean;
  homeVisible: boolean;
  onAvatarDetailsVisibleChange: (visible: boolean) => void;
  onHome: () => void;
  onKickParticipant?: (targetPlayerId: string) => void;
  onSlotStateChange?: (slotIndex: number, slotState: SlotStateDto) => void;
  room?: EncounterRoomSnapshotDto | null;
  roomState?: RoomStateDto;
  localXpGainAmount?: number;
  partyXpPulseByPlayer?: Record<string, number>;
}) {
  const mobilePortrait = useLayoutMode().mode === 'mobile-portrait';
  const [openSlotMenu, setOpenSlotMenu] = useState<number | null>(null);
  const [openDetailsSlots, setOpenDetailsSlots] = useState<Record<number, boolean>>({});
  const localPlayerId = room?.participants.find((participant) => participant.isLocal)?.playerId;
  const canManageSlots = Boolean(
    room
    && onSlotStateChange
    && localPlayerId
    && room.leaderPlayerId === localPlayerId,
  );
  const visualSlotToLogical: [number, number, number] = [1, 0, 2];
  const alone = Boolean(room)
    && room!.participants.length === 1
    && Boolean(room!.participants[0]?.isLocal);
  const slotStyle = (detailsOpen: boolean, isLocal: boolean): CSSProperties => (
    alone ? aloneSlotStyle(detailsOpen, isLocal) : partySlotVisualStyle(detailsOpen, mobilePortrait)
  );

  function setSlotDetailsOpen(visualIndex: number, open: boolean): void {
    // Keep the same object when nothing changes: a new object re-renders
    // PartyZone, which hands the slots new callbacks, which report again; that
    // loop ("Maximum update depth exceeded") eventually crashed the browser tab.
    setOpenDetailsSlots((current) => (
      Boolean(current[visualIndex]) === open
        ? current
        : { ...current, [visualIndex]: open }
    ));
  }

  return (
    <div
      aria-label="Party avatars"
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      style={{ ...partyStripStyle(), ...(alone ? { containerType: 'size' } : {}) }}
    >
      {[0, 1, 2].map((visualIndex) => {
        const slotIndex = visualSlotToLogical[visualIndex];
        const participant = room?.participants.find((entry) => entry.slotIndex === slotIndex);
        const slotSide = slotSideForVisualIndex(visualIndex);
        const detailsOpen = Boolean(openDetailsSlots[visualIndex]);

        if (participant?.isLocal) {
          return (
            <div
              aria-label={`Your party slot ${slotIndex + 1}`}
              key={`slot-${visualIndex}-${slotIndex}`}
              {...{ [PROTECTED_SURFACE_ATTR]: '' }}
              style={slotStyle(detailsOpen, true)}
            >
              <div style={mainAvatarAnchorStyle(alone)}>
                <AvatarPanel
                  avatar={avatar}
                  encounterKey={room?.activeEncounter?.snapshotId}
                  hidePortraitForHandoff={hideAvatarPortraitForHandoff}
                  homeVisible={homeVisible}
                  onDetailsVisibleChange={(visible) => {
                    setSlotDetailsOpen(visualIndex, visible);
                    onAvatarDetailsVisibleChange(visible);
                  }}
                  onHome={onHome}
                  roomParticipant={participant}
                  roomState={roomState}
                  slotSide={slotSide}
                  systemEventActorPlayerId={room?.systemEvent?.actorPlayerId}
                  xpGainAmount={localXpGainAmount}
                />
              </div>
            </div>
          );
        }

        if (participant) {
          return (
            <div
              key={`slot-${visualIndex}-${slotIndex}`}
              {...{ [PROTECTED_SURFACE_ATTR]: '' }}
              style={partySlotVisualStyle(detailsOpen, mobilePortrait)}
            >
              <PartyMemberSlot
                canKick={canManageSlots}
                onDetailsVisibleChange={(visible) => {
                  setSlotDetailsOpen(visualIndex, visible);
                }}
                onKick={onKickParticipant}
                participant={participant}
                roomState={roomState}
                slotSide={slotSide}
                systemEventActorPlayerId={room?.systemEvent?.actorPlayerId}
                xpPulseToken={partyXpPulseByPlayer[participant.playerId]}
              />
            </div>
          );
        }

        return (
          <div
            key={`slot-${visualIndex}-${slotIndex}`}
            {...{ [PROTECTED_SURFACE_ATTR]: '' }}
            style={slotStyle(false, false)}
          >
            <PartyEmptySlot
              animationDelayMs={slotIndex * 420}
              canManage={canManageSlots}
              menuOpen={openSlotMenu === slotIndex}
              onMenuOpenChange={(open) => {
                setOpenSlotMenu(open ? slotIndex : null);
              }}
              onSlotStateChange={onSlotStateChange}
              slotIndex={slotIndex}
              slotState={room?.slotStates[slotIndex] ?? 'open'}
            />
          </div>
        );
      })}
    </div>
  );
}

export default PartyZone;
