import { Router } from 'express';
import { getRecentActivityController } from '../controllers/activityController.js';

export const activityRoutes = Router();

activityRoutes.get('/recent', getRecentActivityController);
