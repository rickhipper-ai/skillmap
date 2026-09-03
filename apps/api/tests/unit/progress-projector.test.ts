import { describe, expect, it } from 'vitest';

import {
  projectProgressEvents,
  type ProjectableProgressEvent,
} from '../../src/modules/progress/projector.js';

const events: ProjectableProgressEvent[] = [
  {
    eventId: 11,
    stepId: 'step-1',
    state: 'completed',
    streamVersion: 2,
    baseStreamVersion: 1,
    supersedesEventId: null,
  },
  {
    eventId: 10,
    stepId: 'step-1',
    state: 'in_progress',
    streamVersion: 1,
    baseStreamVersion: 0,
    supersedesEventId: null,
  },
  {
    eventId: 12,
    stepId: 'step-1',
    state: 'not_started',
    streamVersion: 3,
    baseStreamVersion: 2,
    supersedesEventId: 11,
  },
];

describe('progress event projector', () => {
  it('replays stream order deterministically regardless of input order', () => {
    const projection = projectProgressEvents([events[2]!, events[0]!, events[1]!]);

    expect(projection.streamVersion).toBe(3);
    expect(projection.stepStates.get('step-1')).toEqual({
      state: 'not_started',
      latestEventId: 12,
    });
  });

  it('applies a correction as a compensating event and retains the superseded event', () => {
    const projection = projectProgressEvents(events);

    expect(projection.history.map((event) => event.eventId)).toEqual([10, 11, 12]);
    expect(projection.history.find((event) => event.eventId === 11)?.state).toBe('completed');
    expect(projection.history.at(-1)).toMatchObject({ supersedesEventId: 11 });
    expect(projection.reviewRequired).toBe(false);
  });

  it('flags a distinct command based on a stale stream version without dropping it', () => {
    const stale = {
      ...events[2]!,
      eventId: 13,
      streamVersion: 4,
      baseStreamVersion: 1,
      supersedesEventId: null,
    };
    const projection = projectProgressEvents([...events, stale]);

    expect(projection.history).toHaveLength(4);
    expect(projection.streamVersion).toBe(4);
    expect(projection.reviewRequired).toBe(true);
  });
});
