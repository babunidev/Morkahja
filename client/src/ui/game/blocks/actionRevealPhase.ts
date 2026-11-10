export type ActionRevealPhase = 'select' | 'commit';

/**
 * Whether an onActionReveal call commits the choice.
 *
 * The server withholds encounter rolls until a choice is committed, so the
 * client cannot wait for a known roll before committing (that stalled every
 * turn after choosing a solution). An explicit `commit` phase always commits;
 * calls without a phase keep the older "roll is known" behaviour.
 */
export function isCommitMoment(phase: ActionRevealPhase | undefined, roll: number | null): boolean {
  return phase === 'commit' || (phase === undefined && roll !== null);
}
