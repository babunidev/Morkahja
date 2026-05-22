import type { GameEvent } from './GameEvent.js';

export type GameEventListener = (event: GameEvent) => void | Promise<void>;

class GameEventBus {
  private readonly listeners = new Set<GameEventListener>();

  async emit(event: GameEvent): Promise<void> {
    await Promise.all(
      [...this.listeners].map(async (listener) => {
        await listener(event);
      }),
    );
  }

  subscribe(listener: GameEventListener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: GameEventListener): void {
    this.listeners.delete(listener);
  }
}

export const gameEventBus = new GameEventBus();
