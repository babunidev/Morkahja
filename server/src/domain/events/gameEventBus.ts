import type { GameEvent } from './GameEvent.js';

export type GameEventListener = (event: GameEvent) => void;

class GameEventBus {
  private readonly listeners = new Set<GameEventListener>();

  emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: GameEventListener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: GameEventListener): void {
    this.listeners.delete(listener);
  }
}

export const gameEventBus = new GameEventBus();
