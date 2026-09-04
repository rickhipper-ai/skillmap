import { Type, type Static, type TSchema } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

const Uuid = Type.String({ format: 'uuid' });
const Slug = Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 100 });
const ResourceType = Type.Union([
  Type.Literal('category'),
  Type.Literal('skill'),
  Type.Literal('trail'),
  Type.Literal('certification'),
  Type.Literal('achievement'),
]);

export const CategoryInputSchema = Type.Object(
  {
    slug: Slug,
    name: Type.String({ minLength: 1, maxLength: 160 }),
    description: Type.String({ minLength: 1, maxLength: 2000 }),
  },
  { $id: 'CategoryInput', additionalProperties: false },
);

export const SkillInputSchema = Type.Object(
  {
    slug: Slug,
    categoryId: Uuid,
    name: Type.String({ minLength: 1, maxLength: 160 }),
    description: Type.String({ minLength: 1, maxLength: 4000 }),
  },
  { $id: 'SkillInput', additionalProperties: false },
);

export const TrailStepInputSchema = Type.Object(
  {
    stepId: Uuid,
    position: Type.Integer({ minimum: 1, maximum: 200 }),
    title: Type.String({ minLength: 1, maxLength: 180 }),
    description: Type.Optional(Type.String({ maxLength: 4000 })),
    required: Type.Boolean(),
    skillIds: Type.Array(Uuid, { uniqueItems: true, maxItems: 100 }),
    prerequisiteStepIds: Type.Array(Uuid, { uniqueItems: true, maxItems: 199 }),
  },
  { additionalProperties: false },
);

export const TrailDraftInputSchema = Type.Object(
  {
    slug: Type.Optional(Slug),
    categoryId: Type.Optional(Uuid),
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 180 })),
    description: Type.Optional(Type.String({ minLength: 1, maxLength: 8000 })),
    targetRoleIds: Type.Optional(Type.Array(Uuid, { uniqueItems: true, maxItems: 100 })),
    steps: Type.Optional(Type.Array(TrailStepInputSchema, { maxItems: 200 })),
  },
  { $id: 'TrailDraftInput', additionalProperties: false, minProperties: 1 },
);

export const CertificationRequirementInputSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 180 }),
    type: Type.Union([Type.Literal('skill'), Type.Literal('trail')]),
    targetId: Uuid,
    required: Type.Boolean(),
    position: Type.Integer({ minimum: 1, maximum: 200 }),
  },
  { $id: 'CertificationRequirementInput', additionalProperties: false },
);

export const CertificationInputSchema = Type.Object(
  {
    slug: Slug,
    name: Type.String({ minLength: 1, maxLength: 180 }),
    issuer: Type.String({ minLength: 1, maxLength: 180 }),
    description: Type.String({ minLength: 1, maxLength: 8000 }),
    defaultValidityMonths: Type.Optional(Type.Integer({ minimum: 1, maximum: 1200 })),
    skillIds: Type.Optional(Type.Array(Uuid, { uniqueItems: true, maxItems: 100 })),
    trailIds: Type.Optional(Type.Array(Uuid, { uniqueItems: true, maxItems: 100 })),
    requirements: Type.Optional(
      Type.Array(Type.Ref(CertificationRequirementInputSchema), { maxItems: 200 }),
    ),
  },
  { $id: 'CertificationInput', additionalProperties: false },
);

export const AchievementCriterionParametersSchema = Type.Object(
  { minimum: Type.Integer({ minimum: 1, maximum: 1000 }) },
  { $id: 'AchievementCriterionParameters', additionalProperties: false },
);

export const AchievementInputSchema = Type.Object(
  {
    slug: Slug,
    title: Type.String({ minLength: 1, maxLength: 180 }),
    description: Type.String({ minLength: 1, maxLength: 2000 }),
    iconLabel: Type.String({ minLength: 1, maxLength: 120 }),
    criterionType: Type.Union([
      Type.Literal('completed_steps'),
      Type.Literal('certification_records'),
    ]),
    criterionParameters: Type.Ref(AchievementCriterionParametersSchema),
  },
  { $id: 'AchievementInput', additionalProperties: false },
);

export const CategoryPatchSchema = Type.Partial(CategoryInputSchema, {
  $id: 'CategoryPatch',
  additionalProperties: false,
  minProperties: 1,
});
export const SkillPatchSchema = Type.Partial(SkillInputSchema, {
  $id: 'SkillPatch',
  additionalProperties: false,
  minProperties: 1,
});
export const CertificationPatchSchema = Type.Partial(CertificationInputSchema, {
  $id: 'CertificationPatch',
  additionalProperties: false,
  minProperties: 1,
});
export const AchievementPatchSchema = Type.Partial(AchievementInputSchema, {
  $id: 'AchievementPatch',
  additionalProperties: false,
  minProperties: 1,
});

export const CatalogDraftInputSchema = Type.Object(
  {
    slug: Type.Optional(Slug),
    categoryId: Type.Optional(Uuid),
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 180 })),
    issuer: Type.Optional(Type.String({ minLength: 1, maxLength: 180 })),
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 180 })),
    description: Type.Optional(Type.String({ minLength: 1, maxLength: 8000 })),
    iconLabel: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    criterionType: Type.Optional(
      Type.Union([Type.Literal('completed_steps'), Type.Literal('certification_records')]),
    ),
    criterionParameters: Type.Optional(Type.Ref(AchievementCriterionParametersSchema)),
    defaultValidityMonths: Type.Optional(Type.Integer({ minimum: 1, maximum: 1200 })),
    skillIds: Type.Optional(Type.Array(Uuid, { uniqueItems: true, maxItems: 100 })),
    trailIds: Type.Optional(Type.Array(Uuid, { uniqueItems: true, maxItems: 100 })),
    requirements: Type.Optional(
      Type.Array(Type.Ref(CertificationRequirementInputSchema), { maxItems: 200 }),
    ),
  },
  { $id: 'CatalogDraftInput', additionalProperties: false, minProperties: 1 },
);

export const AdminCatalogResourceSchema = Type.Object(
  {
    id: Uuid,
    slug: Type.String(),
    status: Type.Union([
      Type.Literal('draft'),
      Type.Literal('published'),
      Type.Literal('unpublished'),
      Type.Literal('inactive'),
    ]),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'AdminCatalogResource' },
);

export const PublicationSchema = Type.Object(
  {
    resourceId: Uuid,
    revisionId: Uuid,
    revisionNumber: Type.Integer({ minimum: 1 }),
    publishedAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'Publication' },
);

export const ResourceParamsSchema = Type.Object({ resourceType: ResourceType, resourceId: Uuid });
export const TrailParamsSchema = Type.Object({ trailId: Uuid });
export const StatusInputSchema = Type.Object(
  { status: Type.Union([Type.Literal('unpublished'), Type.Literal('inactive')]) },
  { additionalProperties: false },
);
export const CsrfHeadersSchema = Type.Object({
  'x-csrf-token': Type.String({ minLength: 32 }),
});
export const PublicationHeadersSchema = Type.Object({
  'x-csrf-token': Type.String({ minLength: 32 }),
  'idempotency-key': Uuid,
});

export const ProblemSchema = Type.Object({
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer({ minimum: 400, maximum: 599 }),
  detail: Type.Optional(Type.String()),
  instance: Type.Optional(Type.String()),
  code: Type.String(),
  requestId: Type.String(),
  allowedStatus: Type.Optional(Type.Literal('inactive')),
});
export const ValidationProblemSchema = Type.Intersect([
  ProblemSchema,
  Type.Object({
    errors: Type.Array(
      Type.Object({
        path: Type.String(),
        code: Type.String(),
        message: Type.Optional(Type.String()),
      }),
      { maxItems: 50 },
    ),
  }),
]);

const namedSchemas: TSchema[] = [
  CategoryInputSchema,
  SkillInputSchema,
  TrailDraftInputSchema,
  CertificationRequirementInputSchema,
  CertificationInputSchema,
  AchievementCriterionParametersSchema,
  AchievementInputSchema,
  CategoryPatchSchema,
  SkillPatchSchema,
  CertificationPatchSchema,
  AchievementPatchSchema,
  CatalogDraftInputSchema,
  AdminCatalogResourceSchema,
  PublicationSchema,
];

export function registerAdministrationSchemas(app: FastifyInstance): void {
  for (const schema of namedSchemas) app.addSchema(schema);
}

export type CategoryInput = Static<typeof CategoryInputSchema>;
export type SkillInput = Static<typeof SkillInputSchema>;
export type TrailDraftInput = Static<typeof TrailDraftInputSchema>;
export type TrailStepInput = Static<typeof TrailStepInputSchema>;
export type CertificationInput = Static<typeof CertificationInputSchema>;
export type AchievementInput = Static<typeof AchievementInputSchema>;
export type CatalogDraftInput = Static<typeof CatalogDraftInputSchema>;
export type ResourceType = Static<typeof ResourceType>;
export type StatusInput = Static<typeof StatusInputSchema>;
