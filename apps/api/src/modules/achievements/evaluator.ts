export type AchievementCriterion =
  { type: 'completed_steps'; minimum: number } | { type: 'certification_records'; minimum: number };

export interface AchievementFacts {
  completedSteps: number;
  certificationRecords: number;
}

export type AchievementTrigger =
  { type: 'progress_event'; eventId: number } | { type: 'certification_record'; recordId: string };

export interface AchievementEvidence {
  criterionType: AchievementCriterion['type'];
  requiredCount: number;
  actualCount: number;
  trigger: AchievementTrigger;
}

export function parseAchievementCriterion(value: unknown): AchievementCriterion {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid();
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 2 ||
    !['completed_steps', 'certification_records'].includes(String(input.type)) ||
    !Number.isInteger(input.minimum) ||
    Number(input.minimum) < 1 ||
    Number(input.minimum) > 1000
  ) {
    return invalid();
  }
  return { type: input.type as AchievementCriterion['type'], minimum: Number(input.minimum) };
}

export function evaluateAchievement(
  criterion: AchievementCriterion,
  facts: AchievementFacts,
  trigger: AchievementTrigger,
): AchievementEvidence | null {
  const actualCount =
    criterion.type === 'completed_steps' ? facts.completedSteps : facts.certificationRecords;
  if (actualCount < criterion.minimum) return null;
  return {
    criterionType: criterion.type,
    requiredCount: criterion.minimum,
    actualCount,
    trigger,
  };
}

function invalid(): never {
  throw new Error('INVALID_ACHIEVEMENT_CRITERION');
}
