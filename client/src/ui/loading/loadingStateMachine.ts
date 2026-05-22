export const LOADING_STATES = [
  'INIT',
  'LOAD_SESSION',
  'LOAD_PLAYER',
  'LOAD_AVATAR',
  'LOAD_ENCOUNTER',
  'SYNC_STATE',
  'READY',
] as const;

export type LoadingState = (typeof LOADING_STATES)[number];
export type LoadingRoute = 'dashboard' | 'encounter' | 'transition';

export interface LoadingStateView {
  state: LoadingState;
  label: string;
  wheelDurationSeconds: number | null;
}

export interface LoadingBootstrapHooks<TSession = unknown, TPlayer = unknown, TAvatar = unknown, TEncounter = unknown, TAvatarSelection = unknown> {
  loadSession?: () => Promise<TSession>;
  loadPlayer?: (session: TSession | null) => Promise<TPlayer>;
  loadAvatar?: (player: TPlayer | null) => Promise<TAvatar>;
  loadEncounter?: (avatar: TAvatar | null) => Promise<TEncounter | null>;
  /** Runs in parallel with player/avatar/encounter loads after session is ready. */
  loadAvatarSelection?: () => Promise<TAvatarSelection>;
  syncState?: (context: LoadingBootstrapContext<TSession, TPlayer, TAvatar, TEncounter, TAvatarSelection>) => Promise<void>;
  resolveRoute?: (context: LoadingBootstrapContext<TSession, TPlayer, TAvatar, TEncounter, TAvatarSelection>) => LoadingRoute;
}

export interface LoadingBootstrapOptions {
  minDurationMs?: number;
}

export interface LoadingBootstrapContext<TSession = unknown, TPlayer = unknown, TAvatar = unknown, TEncounter = unknown, TAvatarSelection = unknown> {
  session: TSession | null;
  player: TPlayer | null;
  avatar: TAvatar | null;
  encounter: TEncounter | null;
  avatarSelection: TAvatarSelection | null;
  route: LoadingRoute;
}

export const LOADING_STATE_VIEWS: Record<LoadingState, LoadingStateView> = {
  INIT: { state: 'INIT', label: 'Waking the world...', wheelDurationSeconds: 2.4 },
  LOAD_SESSION: { state: 'LOAD_SESSION', label: 'Restoring session...', wheelDurationSeconds: 2 },
  LOAD_PLAYER: { state: 'LOAD_PLAYER', label: 'Loading player...', wheelDurationSeconds: 1.8 },
  LOAD_AVATAR: { state: 'LOAD_AVATAR', label: 'Preparing avatar...', wheelDurationSeconds: 1.5 },
  LOAD_ENCOUNTER: { state: 'LOAD_ENCOUNTER', label: 'Checking encounter state...', wheelDurationSeconds: 1.3 },
  SYNC_STATE: { state: 'SYNC_STATE', label: 'Synchronizing fate...', wheelDurationSeconds: 1.1 },
  READY: { state: 'READY', label: 'Ready', wheelDurationSeconds: null },
};

export function getLoadingStateView(state: LoadingState): LoadingStateView {
  return LOADING_STATE_VIEWS[state];
}

function defaultRoute(context: LoadingBootstrapContext): LoadingRoute {
  return context.encounter ? 'encounter' : 'dashboard';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runLoadingBootstrap<TSession = unknown, TPlayer = unknown, TAvatar = unknown, TEncounter = unknown, TAvatarSelection = unknown>(
  hooks: LoadingBootstrapHooks<TSession, TPlayer, TAvatar, TEncounter, TAvatarSelection>,
  onTransition: (view: LoadingStateView) => void,
  options: LoadingBootstrapOptions = {},
): Promise<LoadingBootstrapContext<TSession, TPlayer, TAvatar, TEncounter, TAvatarSelection>> {
  const startedAt = Date.now();
  const minDurationMs = options.minDurationMs ?? 3000;

  const avatarSelectionTask = hooks.loadAvatarSelection?.() ?? null;
  let avatarSelectionReady = !avatarSelectionTask;

  if (avatarSelectionTask) {
    void avatarSelectionTask.finally(() => {
      avatarSelectionReady = true;
    });
  }

  function emitTransition(state: LoadingState): void {
    const view = getLoadingStateView(state);
    const label = !avatarSelectionReady && state !== 'INIT' && state !== 'READY'
      ? 'Preparing avatars...'
      : view.label;
    onTransition({ ...view, label });
  }

  emitTransition('INIT');
  emitTransition('LOAD_SESSION');
  const session = hooks.loadSession ? await hooks.loadSession() : null;

  emitTransition('LOAD_PLAYER');
  const player = hooks.loadPlayer ? await hooks.loadPlayer(session) : null;

  emitTransition('LOAD_AVATAR');
  const avatar = hooks.loadAvatar ? await hooks.loadAvatar(player) : null;

  emitTransition('LOAD_ENCOUNTER');
  const encounter = hooks.loadEncounter ? await hooks.loadEncounter(avatar) : null;

  let avatarSelection: TAvatarSelection | null = null;

  if (avatarSelectionTask) {
    avatarSelection = await avatarSelectionTask;
  }

  const context: LoadingBootstrapContext<TSession, TPlayer, TAvatar, TEncounter, TAvatarSelection> = {
    session,
    player,
    avatar,
    encounter,
    avatarSelection,
    route: 'dashboard',
  };

  emitTransition('SYNC_STATE');
  await hooks.syncState?.(context);
  context.route = hooks.resolveRoute?.(context) ?? defaultRoute(context);

  const remainingMs = minDurationMs - (Date.now() - startedAt);
  if (remainingMs > 0) {
    await delay(remainingMs);
  }

  emitTransition('READY');
  return context;
}
