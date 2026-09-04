import { describe, expect, it } from 'vitest';

import {
  evaluateAchievement,
  parseAchievementCriterion,
} from '../../src/modules/achievements/evaluator.js';

describe('bounded achievement evaluator', () => {
  it('accepts only bounded declarative progress and certification criteria', () => {
    expect(parseAchievementCriterion({ type: 'completed_steps', minimum: 3 })).toEqual({
      type: 'completed_steps',
      minimum: 3,
    });
    expect(parseAchievementCriterion({ type: 'certification_records', minimum: 1 })).toEqual({
      type: 'certification_records',
      minimum: 1,
    });
    expect(() => parseAchievementCriterion({ type: 'script', expression: 'return true' })).toThrow(
      'INVALID_ACHIEVEMENT_CRITERION',
    );
    expect(() => parseAchievementCriterion({ type: 'completed_steps', minimum: 0 })).toThrow(
      'INVALID_ACHIEVEMENT_CRITERION',
    );
    expect(() =>
      parseAchievementCriterion({ type: 'completed_steps', minimum: 1, extra: true }),
    ).toThrow('INVALID_ACHIEVEMENT_CRITERION');
  });

  it('generates bounded evidence from the qualifying domain event', () => {
    expect(
      evaluateAchievement(
        { type: 'completed_steps', minimum: 2 },
        { completedSteps: 2, certificationRecords: 0 },
        { type: 'progress_event', eventId: 42 },
      ),
    ).toEqual({
      criterionType: 'completed_steps',
      requiredCount: 2,
      actualCount: 2,
      trigger: { type: 'progress_event', eventId: 42 },
    });
    expect(
      evaluateAchievement(
        { type: 'certification_records', minimum: 2 },
        { completedSteps: 4, certificationRecords: 1 },
        { type: 'certification_record', recordId: '70000000-0000-4000-8000-000000000001' },
      ),
    ).toBeNull();
  });
});
