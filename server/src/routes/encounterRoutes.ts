import { Router } from 'express';

import {
  clearEncounterController,
  continueEncounterController,
  createEncounterController,
  getActiveEncounterController,
} from '../controllers/encounterController.js';

export const encounterRoutes = Router();

encounterRoutes.get('/active', getActiveEncounterController);
encounterRoutes.post('/create', createEncounterController);
encounterRoutes.post('/continue', continueEncounterController);
encounterRoutes.post('/clear', clearEncounterController);
