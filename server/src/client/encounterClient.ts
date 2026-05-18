import {
  toEncounterViewModel,
} from '../domain/encounter/EncounterViewModel.js';
import type {
  EncounterViewModel,
  EncounterViewModelResult,
  SlotViewModel,
} from '../domain/encounter/EncounterViewModel.js';
import {
  snapshotToEncounterData,
} from '../types/encounter.js';
import type { EncounterSnapshot } from '../types/encounter.js';

export type EncounterAction = 'A' | 'B' | 'C' | 'D' | 'dice';

export type {
  EncounterViewModel,
  SlotViewModel,
};

export type EncounterClientFlowState =
  | 'idle'
  | 'loading'
  | 'active'
  | 'resolving'
  | 'result';

export interface EncounterClientConfig {
  baseUrl?: string;
  playerId: string;
  avatarId: string;
  fetchImpl?: typeof fetch;
}

export interface EncounterResolveResult {
  success: boolean;
  slotResults: Record<'A' | 'B' | 'C' | 'D', boolean>;
  rewards: number[];
  message: string;
  failurePenalty: number;
  usedInventorySolutions: number[];
  snapshot: EncounterSnapshot;
}

export interface EncounterClientState {
  flow: EncounterClientFlowState;
  activeEncounter: EncounterSnapshot | null;
  lastResult: EncounterResolveResult | null;
  error: string | null;
}

type StateListener = (state: EncounterClientState) => void;

class EncounterApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return baseUrl ? baseUrl.replace(/\/$/, '') : '';
}

export function normalizeEncounterSnapshot(
  snapshot: EncounterSnapshot,
  result?: EncounterViewModelResult,
): EncounterViewModel {
  return toEncounterViewModel(
    snapshot,
    snapshotToEncounterData(snapshot),
    result,
  );
}

function flowForSnapshot(
  snapshot: EncounterSnapshot | null,
): EncounterClientFlowState {
  if (!snapshot) {
    return 'idle';
  }
  if (snapshot.state === 'active') {
    return 'active';
  }
  if (snapshot.state === 'resolving') {
    return 'loading';
  }
  if (snapshot.state === 'resolved') {
    return 'result';
  }
  return 'loading';
}

export class EncounterClient {
  private readonly baseUrl: string;
  private readonly playerId: string;
  private readonly avatarId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly listeners = new Set<StateListener>();
  private state: EncounterClientState = {
    flow: 'idle',
    activeEncounter: null,
    lastResult: null,
    error: null,
  };

  constructor(config: EncounterClientConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.playerId = config.playerId;
    this.avatarId = config.avatarId;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  getState(): EncounterClientState {
    return { ...this.state };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  async initialize(): Promise<EncounterSnapshot | null> {
    return this.getActiveEncounter();
  }

  async createEncounter(): Promise<EncounterSnapshot> {
    this.setState({ flow: 'loading', error: null, lastResult: null });
    try {
      const snapshot = await this.request<EncounterSnapshot>(
        '/encounter/create',
        {
          method: 'POST',
          body: this.identityBody(),
        },
      );
      this.setState({
        flow: flowForSnapshot(snapshot),
        activeEncounter: snapshot,
        lastResult: null,
      });
      return snapshot;
    } catch (error) {
      this.setError(error);
      throw error;
    }
  }

  async getActiveEncounter(): Promise<EncounterSnapshot | null> {
    this.setState({ flow: 'loading', error: null });
    try {
      const snapshot = await this.request<EncounterSnapshot | null>(
        `/encounter/active?${this.identityQuery()}`,
        { method: 'GET', allowNotFound: true },
      );
      this.setState({
        flow: flowForSnapshot(snapshot),
        activeEncounter: snapshot,
      });
      return snapshot;
    } catch (error) {
      this.setError(error);
      throw error;
    }
  }

  async resolveEncounter(
    action: EncounterAction,
  ): Promise<EncounterResolveResult> {
    this.setState({ flow: 'resolving', error: null });
    try {
      const result = await this.request<EncounterResolveResult>(
        '/encounter/resolve',
        {
          method: 'POST',
          body: {
            ...this.identityBody(),
            action,
          },
        },
      );
      this.setState({
        flow: 'result',
        activeEncounter: result.snapshot,
        lastResult: result,
      });
      return result;
    } catch (error) {
      this.setError(error);
      throw error;
    }
  }

  toViewModel(snapshot = this.state.activeEncounter): EncounterViewModel | null {
    return snapshot
      ? normalizeEncounterSnapshot(snapshot, this.state.lastResult ?? undefined)
      : null;
  }

  resetLocalState(): void {
    this.setState({
      flow: 'idle',
      activeEncounter: null,
      lastResult: null,
      error: null,
    });
  }

  private identityBody(): { playerId: string; avatarId: string } {
    return {
      playerId: this.playerId,
      avatarId: this.avatarId,
    };
  }

  private identityQuery(): string {
    return new URLSearchParams(this.identityBody()).toString();
  }

  private async request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
      allowNotFound?: boolean;
    },
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method,
      headers: options.body
        ? { 'Content-Type': 'application/json' }
        : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 404 && options.allowNotFound) {
      return null as T;
    }

    if (!response.ok) {
      throw new EncounterApiError(
        await readErrorMessage(response),
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  private setState(next: Partial<EncounterClientState>): void {
    this.state = {
      ...this.state,
      ...next,
    };
    this.emit();
  }

  private setError(error: unknown): void {
    this.setState({
      flow: 'idle',
      error: error instanceof Error ? error.message : 'Encounter request failed',
    });
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    return typeof data.error === 'string'
      ? data.error
      : `Encounter API request failed (${response.status})`;
  } catch {
    return `Encounter API request failed (${response.status})`;
  }
}

export function createEncounterClient(
  config: EncounterClientConfig,
): EncounterClient {
  return new EncounterClient(config);
}
