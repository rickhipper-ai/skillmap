import { Type } from '@sinclair/typebox';

import { ProblemSchema, ValidationProblemSchema } from '../catalog/schemas.js';

const Uuid = Type.String({ format: 'uuid' });
const StepStateSchema = Type.Union([
  Type.Literal('not_started'),
  Type.Literal('in_progress'),
  Type.Literal('completed'),
]);

export const ProgressTrailParamsSchema = Type.Object(
  { trailId: Uuid },
  { additionalProperties: false },
);
export const ProgressStepParamsSchema = Type.Object(
  { trailId: Uuid, stepId: Uuid },
  { additionalProperties: false },
);
export const ProgressWriteHeadersSchema = Type.Object(
  {
    'idempotency-key': Uuid,
    'x-csrf-token': Type.String({ minLength: 32 }),
  },
  { additionalProperties: true },
);
export const ProgressCommandSchema = Type.Object(
  {
    state: StepStateSchema,
    baseStreamVersion: Type.Integer({ minimum: 0 }),
    supersedesEventId: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
  },
  { additionalProperties: false },
);

const ProgressHistorySchema = Type.Object({
  eventId: Type.Integer({ minimum: 1 }),
  stepId: Uuid,
  state: StepStateSchema,
  occurredAt: Type.String({ format: 'date-time' }),
  source: Type.Union([
    Type.Literal('user'),
    Type.Literal('admin_correction'),
    Type.Literal('system'),
  ]),
  supersedesEventId: Type.Optional(Type.Integer({ minimum: 1 })),
  observedRevisionId: Uuid,
});

export const TrailProgressSchema = Type.Object({
  trailId: Uuid,
  currentRevisionId: Uuid,
  status: Type.Union([Type.Literal('in_progress'), Type.Literal('completed')]),
  percentage: Type.Number({ minimum: 0, maximum: 100 }),
  streamVersion: Type.Integer({ minimum: 0 }),
  catalogChanged: Type.Optional(Type.Boolean()),
  reviewRequired: Type.Optional(Type.Boolean()),
  steps: Type.Array(
    Type.Object({
      stepId: Uuid,
      state: StepStateSchema,
      eligible: Type.Boolean(),
      pendingPrerequisiteStepIds: Type.Optional(Type.Array(Uuid)),
    }),
  ),
  history: Type.Array(ProgressHistorySchema),
});

export const ProgressCommandResultSchema = Type.Object({
  eventId: Type.Integer({ minimum: 1 }),
  streamVersion: Type.Integer({ minimum: 1 }),
  state: StepStateSchema,
  reviewRequired: Type.Boolean(),
  trailProgress: TrailProgressSchema,
});

export const ProgressValidationProblemSchema = Type.Intersect([
  ValidationProblemSchema,
  Type.Object({
    pendingPrerequisiteStepIds: Type.Optional(Type.Array(Uuid)),
  }),
]);

export { ProblemSchema, ValidationProblemSchema };
