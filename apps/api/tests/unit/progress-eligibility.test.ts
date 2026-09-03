import { describe, expect, it } from 'vitest';

import {
  calculateRequiredPercentage,
  evaluateStepTransition,
  getStepEligibility,
  type ProgressStep,
  type StepState,
} from '../../src/modules/progress/domain.js';

const steps: ProgressStep[] = [
  { stepId: 'step-1', required: true, prerequisiteStepIds: [] },
  { stepId: 'step-2', required: true, prerequisiteStepIds: ['step-1'] },
  { stepId: 'step-3', required: false, prerequisiteStepIds: ['step-2'] },
];

describe('progress eligibility and percentage', () => {
  it('identifies every pending prerequisite and unlocks a step only when they are completed', () => {
    expect(getStepEligibility('step-2', steps, new Map())).toEqual({
      eligible: false,
      pendingPrerequisiteStepIds: ['step-1'],
    });

    const states = new Map<string, StepState>([['step-1', 'completed']]);
    expect(getStepEligibility('step-2', steps, states)).toEqual({
      eligible: true,
      pendingPrerequisiteStepIds: [],
    });
  });

  it('calculates progress from required published steps only', () => {
    const states = new Map<string, StepState>([
      ['step-1', 'completed'],
      ['step-2', 'in_progress'],
      ['step-3', 'completed'],
    ]);

    expect(calculateRequiredPercentage(steps, states)).toBe(50);
    expect(calculateRequiredPercentage([], states)).toBe(0);
  });

  it('blocks only completion when prerequisites remain pending', () => {
    const blocked = getStepEligibility('step-2', steps, new Map());

    expect(evaluateStepTransition('not_started', 'in_progress', blocked)).toEqual({
      accepted: true,
      state: 'in_progress',
      pendingPrerequisiteStepIds: [],
    });
    expect(evaluateStepTransition('in_progress', 'completed', blocked)).toEqual({
      accepted: false,
      state: 'in_progress',
      pendingPrerequisiteStepIds: ['step-1'],
    });
  });
});
