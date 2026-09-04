import { Type } from '@sinclair/typebox';

import { ProblemSchema } from '../catalog/schemas.js';

const Uuid = Type.String({ format: 'uuid' });

const DashboardTrailSchema = Type.Object(
  {
    trailId: Uuid,
    title: Type.String({ minLength: 1, maxLength: 180 }),
    currentRevisionId: Uuid,
    percentage: Type.Number({ minimum: 0, maximum: 100 }),
    streamVersion: Type.Integer({ minimum: 0 }),
    lastActivityAt: Type.String({ format: 'date-time' }),
    catalogChanged: Type.Boolean(),
  },
  { additionalProperties: false },
);

const CertificationRecordSchema = Type.Object(
  {
    id: Uuid,
    certificationId: Uuid,
    obtainedOn: Type.String({ format: 'date' }),
    externalIdentifier: Type.Optional(Type.Union([Type.String({ maxLength: 180 }), Type.Null()])),
    expiresOn: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
    verificationStatus: Type.Literal('self_declared'),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);

const AchievementAwardSchema = Type.Object(
  {
    achievementId: Uuid,
    title: Type.String(),
    description: Type.Optional(Type.String()),
    awardedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);

const NextStepEvidenceSchema = Type.Object(
  {
    position: Type.Integer({ minimum: 1 }),
    completedPrerequisiteStepIds: Type.Array(Uuid),
    progressStreamVersion: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const ProfileEvidenceSchema = Type.Object(
  {
    desiredRoleId: Type.Optional(Uuid),
    matchedInterestCategoryId: Type.Optional(Uuid),
    matchedInterestSkillIds: Type.Array(Uuid),
    score: Type.Number({ minimum: 1 }),
  },
  { additionalProperties: false },
);

const RecommendationSchema = Type.Object(
  {
    id: Uuid,
    rank: Type.Integer({ minimum: 1, maximum: 3 }),
    targetType: Type.Union([Type.Literal('trail_step'), Type.Literal('trail')]),
    trailId: Uuid,
    stepId: Type.Optional(Type.Union([Uuid, Type.Null()])),
    title: Type.String({ minLength: 1, maxLength: 180 }),
    reasonCode: Type.Union([
      Type.Literal('next_eligible_step'),
      Type.Literal('desired_role'),
      Type.Literal('interest_match'),
    ]),
    evidence: Type.Union([NextStepEvidenceSchema, ProfileEvidenceSchema]),
    explanation: Type.String({ minLength: 1 }),
    inputVersions: Type.Object(
      {
        ruleSetVersion: Type.Integer({ minimum: 1 }),
        profileVersion: Type.Integer({ minimum: 0 }),
        progressStreamVersion: Type.Integer({ minimum: 0 }),
        catalogRevisionId: Uuid,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const DashboardSchema = Type.Object(
  {
    activeTrails: Type.Array(DashboardTrailSchema),
    certificationRecords: Type.Array(CertificationRecordSchema),
    achievements: Type.Array(AchievementAwardSchema),
    recommendations: Type.Array(RecommendationSchema, { maxItems: 3 }),
  },
  { additionalProperties: false },
);

export { ProblemSchema };
