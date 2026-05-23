import { Router } from 'express';

import {
  claimLoreGemController,
  clearEncounterController,
  continueEncounterController,
  createEncounterController,
  getActiveEncounterController,
  offerLoreGemController,
} from '../controllers/encounterController.js';

export const encounterRoutes = Router();

encounterRoutes.get('/active', getActiveEncounterController);
encounterRoutes.post('/create', createEncounterController);
encounterRoutes.post('/continue', continueEncounterController);
encounterRoutes.post('/clear', clearEncounterController);
encounterRoutes.post('/lore-gem/offer', offerLoreGemController);
encounterRoutes.post('/lore-gem/claim', claimLoreGemController);
