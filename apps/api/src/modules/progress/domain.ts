export type StepState = 'not_started' | 'in_progress' | 'completed';

export interface ProgressStep {
  stepId: string;
  required: boolean;
  prerequisiteStepIds: readonly string[];
}

export interface StepEligibility {
  eligible: boolean;
  pendingPrerequisiteStepIds: string[];
}

export interface StepTransition {
  accepted: boolean;
  state: StepState;
  pendingPrerequisiteStepIds: string[];
}

export function getStepEligibility(
  stepId: string,
  steps: readonly ProgressStep[],
  states: ReadonlyMap<string, StepState>,
): StepEligibility {
  const step = steps.find((candidate) => candidate.stepId === stepId);
  if (!step) return { eligible: false, pendingPrerequisiteStepIds: [] };
  const pendingPrerequisiteStepIds = step.prerequisiteStepIds.filter(
    (prerequisiteId) => states.get(prerequisiteId) !== 'completed',
  );
  return { eligible: pendingPrerequisiteStepIds.length === 0, pendingPrerequisiteStepIds };
}

export function calculateRequiredPercentage(
  steps: readonly ProgressStep[],
  states: ReadonlyMap<string, StepState>,
): number {
  const requiredSteps = steps.filter((step) => step.required);
  if (requiredSteps.length === 0) return 0;
  const completed = requiredSteps.filter((step) => states.get(step.stepId) === 'completed').length;
  return Math.round((completed / requiredSteps.length) * 100);
}

export function evaluateStepTransition(
  currentState: StepState,
  requestedState: StepState,
  eligibility: StepEligibility,
): StepTransition {
  if (requestedState === 'completed' && !eligibility.eligible) {
    return {
      accepted: false,
      state: currentState,
      pendingPrerequisiteStepIds: eligibility.pendingPrerequisiteStepIds,
    };
  }
  return { accepted: true, state: requestedState, pendingPrerequisiteStepIds: [] };
}

export function trailStatus(
  steps: readonly ProgressStep[],
  states: ReadonlyMap<string, StepState>,
): 'in_progress' | 'completed' {
  const required = steps.filter((step) => step.required);
  return required.length > 0 && required.every((step) => states.get(step.stepId) === 'completed')
    ? 'completed'
    : 'in_progress';
}
