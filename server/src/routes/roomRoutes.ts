import { Router } from 'express';
import {
  createRoomController,
  getActiveRoomController,
  joinFriendRoomController,
  joinRoomController,
  leaveAllRoomsController,
  leaveRoomController,
  listPendingHelpController,
  processRoomAwayController,
  requestHelpController,
  respondHelpController,
  setSlotStateController,
  submitRoomChoiceController,
  submitRoomContinueController,
  submitRoomFocusController,
  submitRoomSelectionController,
  activateRoomLoreGemController,
  kickRoomParticipantController,
} from '../controllers/roomController.js';

export const roomRoutes = Router();

roomRoutes.get('/active', getActiveRoomController);
roomRoutes.post('/create', createRoomController);
roomRoutes.post('/join', joinRoomController);
roomRoutes.post('/join/friend', joinFriendRoomController);
roomRoutes.post('/leave', leaveRoomController);
roomRoutes.post('/leave/all', leaveAllRoomsController);
roomRoutes.post('/away', processRoomAwayController);
roomRoutes.post('/kick', kickRoomParticipantController);
roomRoutes.post('/slot', setSlotStateController);
roomRoutes.post('/choice', submitRoomChoiceController);
roomRoutes.post('/selection', submitRoomSelectionController);
roomRoutes.post('/focus', submitRoomFocusController);
roomRoutes.post('/continue', submitRoomContinueController);
roomRoutes.post('/lore-gem/activate', activateRoomLoreGemController);
roomRoutes.post('/help/request', requestHelpController);
roomRoutes.post('/help/respond', respondHelpController);
roomRoutes.get('/help/pending', listPendingHelpController);

export default roomRoutes;
