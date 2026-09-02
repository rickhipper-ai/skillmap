import { Type } from '@sinclair/typebox';

const Uuid = Type.String({ format: 'uuid' });
const Email = Type.String({ format: 'email', maxLength: 320 });
const Password = Type.String({ minLength: 12, maxLength: 128 });

export const CsrfHeadersSchema = Type.Object({
  'x-csrf-token': Type.String({ minLength: 32 }),
});

export const RegistrationSchema = Type.Object(
  { email: Email, password: Password, acceptTerms: Type.Literal(true) },
  { additionalProperties: false },
);
export const EmailRequestSchema = Type.Object({ email: Email }, { additionalProperties: false });
export const TokenSchema = Type.Object(
  { token: Type.String({ minLength: 32, maxLength: 512 }) },
  { additionalProperties: false },
);
export const SessionSchema = Type.Object(
  { email: Email, password: Password },
  { additionalProperties: false },
);
export const PasswordResetSchema = Type.Object(
  { token: Type.String({ minLength: 32, maxLength: 512 }), newPassword: Password },
  { additionalProperties: false },
);
export const DeleteAccountSchema = Type.Object(
  { password: Type.String({ minLength: 1, maxLength: 128 }) },
  { additionalProperties: false },
);
export const ProfileInputSchema = Type.Object(
  {
    displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    currentRoleId: Type.Optional(Type.Union([Uuid, Type.Null()])),
    desiredRoleId: Type.Optional(Type.Union([Uuid, Type.Null()])),
    experienceLevel: Type.Optional(
      Type.Union([
        Type.Literal('beginner'),
        Type.Literal('intermediate'),
        Type.Literal('advanced'),
      ]),
    ),
    interestCategoryIds: Type.Optional(Type.Array(Uuid, { maxItems: 20, uniqueItems: true })),
    interestSkillIds: Type.Optional(Type.Array(Uuid, { maxItems: 50, uniqueItems: true })),
  },
  { additionalProperties: false },
);

export const PendingRegistrationSchema = Type.Object({
  status: Type.Literal('pending_verification'),
});
export const ProfileResponseSchema = Type.Object({
  displayName: Type.String(),
  currentRoleId: Type.Union([Uuid, Type.Null()]),
  desiredRoleId: Type.Union([Uuid, Type.Null()]),
  experienceLevel: Type.Union([
    Type.Literal('beginner'),
    Type.Literal('intermediate'),
    Type.Literal('advanced'),
  ]),
  interestCategoryIds: Type.Array(Uuid),
  interestSkillIds: Type.Array(Uuid),
});
export const CurrentUserSchema = Type.Object({
  id: Uuid,
  status: Type.Literal('active'),
  roles: Type.Array(Type.Union([Type.Literal('user'), Type.Literal('content_admin')])),
  profile: Type.Union([ProfileResponseSchema, Type.Null()]),
});
export const DeletionReceiptSchema = Type.Object({
  requestId: Uuid,
  status: Type.Literal('requested'),
  requestedAt: Type.String({ format: 'date-time' }),
  deadlineAt: Type.String({ format: 'date-time' }),
});
