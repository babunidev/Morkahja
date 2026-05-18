import { Router } from 'express';

import {
  continueEncounterController,
  getActiveEncounterController,
} from '../controllers/encounterController.js';

export const encounterRoutes = Router();

encounterRoutes.get('/active', getActiveEncounterController);
encounterRoutes.post('/continue', continueEncounterController);
