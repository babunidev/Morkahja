import { Router } from 'express';
import {
  createRoomController,
  getActiveRoomController,
  joinFriendRoomController,
  joinRoomController,
  leaveRoomController,
  listPendingHelpController,
  requestHelpController,
  respondHelpController,
  setSlotStateController,
  submitRoomChoiceController,
  submitRoomContinueController,
  submitRoomFocusController,
} from '../controllers/roomController.js';

export const roomRoutes = Router();

roomRoutes.get('/active', getActiveRoomController);
roomRoutes.post('/create', createRoomController);
roomRoutes.post('/join', joinRoomController);
roomRoutes.post('/join/friend', joinFriendRoomController);
roomRoutes.post('/leave', leaveRoomController);
roomRoutes.post('/slot', setSlotStateController);
roomRoutes.post('/choice', submitRoomChoiceController);
roomRoutes.post('/focus', submitRoomFocusController);
roomRoutes.post('/continue', submitRoomContinueController);
roomRoutes.post('/help/request', requestHelpController);
roomRoutes.post('/help/respond', respondHelpController);
roomRoutes.get('/help/pending', listPendingHelpController);

export default roomRoutes;
