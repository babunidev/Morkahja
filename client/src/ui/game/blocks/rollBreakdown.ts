import {
  DICE_ROLL_BONUS,
  PRIMARY_SOLUTION_ROLL_BONUS,
  SECONDARY_SOLUTION_ROLL_BONUS,
  formatRollBreakdown,
} from '@shared/diceInterpreter.js';
import { solutionSetSize } from '@shared/solutionSet.js';
import type { EncounterAction, EncounterSnapshot, RoomParticipantDto } from '../../../api/http.js';

function primaryIdForSlot(
  encounter: EncounterSnapshot,
  slot: EncounterAction | undefined,
): number {
  if (slot === 'A') return encounter.primarySolutionA ?? 0;
  if (slot === 'B') return encounter.primarySolutionB ?? 0;
  if (slot === 'C') return encounter.primarySolutionC ?? 0;
  if (slot === 'D') return encounter.primarySolutionD ?? 0;
  return 0;
}

function bonusForSolution(
  encounter: EncounterSnapshot,
  slot: EncounterAction | undefined,
  solutionId: number,
): number {
  const primaryId = primaryIdForSlot(encounter, slot);
  if (primaryId > 0 && solutionId === primaryId) {
    return PRIMARY_SOLUTION_ROLL_BONUS;
  }
  return SECONDARY_SOLUTION_ROLL_BONUS;
}

/**
 * Lines for the portrait result tooltip: the d20 face, then each modifier.
 * A set shows one line per solution, and the die once for each gap it filled.
 */
export function choiceRollBreakdown(
  participant: RoomParticipantDto,
  encounter: EncounterSnapshot | undefined,
  total: number | undefined,
): string[] {
  if (!encounter || total === undefined || !Number.isFinite(total)) {
    return [];
  }

  const difficulty = encounter.encounterDifficulty ?? 1;
  const result = participant.preparedResult ?? participant.resolutionSummary;
  const pickRolls = result?.pickRolls;
  const diceFillRoll = result?.diceFillRoll;
  const isSet = (pickRolls !== undefined && pickRolls.length > 1) || diceFillRoll !== undefined;
  if (!isSet) {
    const bonus = participant.selectedAction === 'dice' || participant.selectedSolutionId === undefined
      ? DICE_ROLL_BONUS
      : bonusForSolution(encounter, participant.selectedAction, participant.selectedSolutionId);
    const line = formatRollBreakdown(total, bonus, difficulty);
    return line ? [line] : [];
  }

  const lines: string[] = [];
  const picks = participant.setPicks ?? [];
  if (picks.length > 0) {
    for (const pick of picks) {
      const line = formatRollBreakdown(pick.roll, bonusForSolution(encounter, pick.slot, pick.solutionId), difficulty);
      if (line) {
        lines.push(line);
      }
    }
  }

  if (diceFillRoll !== undefined) {
    const dieLine = formatRollBreakdown(diceFillRoll, DICE_ROLL_BONUS, difficulty);
    const filled = Math.max(1, solutionSetSize(difficulty) - picks.length);
    if (dieLine) {
      for (let copy = 0; copy < filled; copy += 1) {
        lines.push(dieLine);
      }
    }
  }

  return lines;
}
