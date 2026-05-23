import { Router } from 'express';

import {
  getAdminActivityHandler,
  getAdminDashboardHandler,
  getAdminEncountersHandler,
  getAdminExpansionByIdHandler,
  getAdminExpansionsHandler,
  getAdminFramesHandler,
  getAdminOnlinePlayersHandler,
  getAdminPlayersHandler,
  getAdminPortraitsHandler,
  getAdminServerStatus,
  getAdminSolutionsHandler,
  postAdminBanHandler,
  postAdminEncounterHandler,
  postAdminExpansionHandler,
  postAdminFrameHandler,
  postAdminPortraitHandler,
  postAdminSolutionHandler,
  postAdminTimeoutHandler,
  postAdminUnbanHandler,
} from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware.js';

export const adminRoutes = Router();

adminRoutes.use(requireAdminAuth);

adminRoutes.get('/server', getAdminServerStatus);
adminRoutes.get('/dashboard', getAdminDashboardHandler);
adminRoutes.get('/players', getAdminPlayersHandler);
adminRoutes.get('/players/online', getAdminOnlinePlayersHandler);
adminRoutes.get('/activity', getAdminActivityHandler);
adminRoutes.post('/players/timeout', postAdminTimeoutHandler);
adminRoutes.post('/players/ban', postAdminBanHandler);
adminRoutes.post('/players/unban', postAdminUnbanHandler);

adminRoutes.get('/content/encounters', getAdminEncountersHandler);
adminRoutes.post('/content/encounters', postAdminEncounterHandler);
adminRoutes.get('/content/solutions', getAdminSolutionsHandler);
adminRoutes.post('/content/solutions', postAdminSolutionHandler);
adminRoutes.get('/content/expansions', getAdminExpansionsHandler);
adminRoutes.post('/content/expansions', postAdminExpansionHandler);
adminRoutes.get('/content/expansions/:id', getAdminExpansionByIdHandler);
adminRoutes.get('/content/frames', getAdminFramesHandler);
adminRoutes.post('/content/frames', postAdminFrameHandler);
adminRoutes.get('/content/portraits', getAdminPortraitsHandler);
adminRoutes.post('/content/portraits', postAdminPortraitHandler);
