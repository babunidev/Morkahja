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
import { partyStripStyle } from '../gameScreenLayout.js';
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

function mainAvatarAnchorStyle(): CSSProperties {
  return {
    position: 'relative',
    width: '100%',
    maxWidth: PARTY_SLOT_WIDTH,
    justifySelf: 'center',
    overflow: 'visible',
  };
}

function partySlotVisualStyle(avatarDetailsOpen: boolean): CSSProperties {
  return {
    ...partySlotStyle,
    width: PARTY_SLOT_WIDTH,
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

  function setSlotDetailsOpen(visualIndex: number, open: boolean): void {
    setOpenDetailsSlots((current) => ({
      ...current,
      [visualIndex]: open,
    }));
  }

  return (
    <div aria-label="Party avatars" {...{ [PROTECTED_SURFACE_ATTR]: '' }} style={partyStripStyle()}>
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
              style={partySlotVisualStyle(detailsOpen)}
            >
              <div style={mainAvatarAnchorStyle()}>
                <AvatarPanel
                  avatar={avatar}
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
              style={partySlotVisualStyle(detailsOpen)}
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
            style={partySlotVisualStyle(false)}
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
