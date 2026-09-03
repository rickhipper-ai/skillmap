import type { StepState } from './domain.js';

export interface ProjectableProgressEvent {
  eventId: number;
  stepId: string;
  state: StepState;
  streamVersion: number;
  baseStreamVersion: number;
  supersedesEventId: number | null;
}

export interface ProjectedStepState {
  state: StepState;
  latestEventId: number;
}

export function projectProgressEvents(events: readonly ProjectableProgressEvent[]) {
  const history = [...events].sort(
    (left, right) => left.streamVersion - right.streamVersion || left.eventId - right.eventId,
  );
  const stepStates = new Map<string, ProjectedStepState>();
  let expectedBaseVersion = 0;
  let reviewRequired = false;

  for (const event of history) {
    if (event.baseStreamVersion !== expectedBaseVersion) reviewRequired = true;
    stepStates.set(event.stepId, { state: event.state, latestEventId: event.eventId });
    expectedBaseVersion = event.streamVersion;
  }

  return {
    history,
    stepStates,
    streamVersion: history.at(-1)?.streamVersion ?? 0,
    reviewRequired,
  };
}
