import { Type } from '@sinclair/typebox';

import { ProblemSchema, ValidationProblemSchema } from '../catalog/schemas.js';

const Uuid = Type.String({ format: 'uuid' });
const NullableText = Type.Union([Type.String({ maxLength: 180 }), Type.Null()]);
const NullableDate = Type.Union([Type.String({ format: 'date' }), Type.Null()]);

export const CertificationRecordInputSchema = Type.Object(
  {
    certificationId: Uuid,
    obtainedOn: Type.String({ format: 'date' }),
    externalIdentifier: Type.Optional(NullableText),
    expiresOn: Type.Optional(NullableDate),
  },
  { additionalProperties: false },
);

export const CertificationRecordSchema = Type.Intersect([
  CertificationRecordInputSchema,
  Type.Object({
    id: Uuid,
    verificationStatus: Type.Literal('self_declared'),
    createdAt: Type.String({ format: 'date-time' }),
  }),
]);

export const AchievementAwardSchema = Type.Object({
  achievementId: Uuid,
  title: Type.String(),
  description: Type.Optional(Type.String()),
  awardedAt: Type.String({ format: 'date-time' }),
});

export const CredentialWriteHeadersSchema = Type.Object(
  {
    'idempotency-key': Uuid,
    'x-csrf-token': Type.String({ minLength: 32 }),
  },
  { additionalProperties: true },
);

export { ProblemSchema, ValidationProblemSchema };
