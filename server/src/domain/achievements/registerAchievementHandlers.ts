import type { GameEvent } from '../events/GameEvent.js';
import { gameEventBus } from '../events/gameEventBus.js';
import { handleGameEvent } from './achievementEngine.js';

let registered = false;

export function registerAchievementHandlers(): void {
  if (registered) {
    return;
  }

  registered = true;
  gameEventBus.subscribe((event: GameEvent) => {
    void handleGameEvent(event).catch((error) => {
      console.error('Achievement event handler failed', error);
    });
  });
}
