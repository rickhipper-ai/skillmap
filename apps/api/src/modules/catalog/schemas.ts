import { Type } from '@sinclair/typebox';

const Uuid = Type.String({ format: 'uuid' });
const CatalogType = Type.Union([
  Type.Literal('skill'),
  Type.Literal('trail'),
  Type.Literal('certification'),
]);

export const CategorySchema = Type.Object({
  id: Uuid,
  slug: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
});

export const CatalogItemSchema = Type.Object({
  id: Uuid,
  type: CatalogType,
  slug: Type.String(),
  title: Type.String(),
  summary: Type.String(),
  category: Type.Optional(Type.Union([CategorySchema, Type.Null()])),
});

export const CatalogPageSchema = Type.Object({
  items: Type.Array(CatalogItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export const SkillDetailSchema = Type.Intersect([
  CatalogItemSchema,
  Type.Object({
    relatedTrails: Type.Array(CatalogItemSchema),
    relatedCertifications: Type.Array(CatalogItemSchema),
  }),
]);

export const TrailStepSchema = Type.Object({
  id: Uuid,
  position: Type.Integer({ minimum: 1 }),
  title: Type.String(),
  description: Type.Optional(Type.String()),
  required: Type.Boolean(),
  skills: Type.Array(CatalogItemSchema),
  prerequisiteStepIds: Type.Array(Uuid, { uniqueItems: true }),
});

export const TrailDetailSchema = Type.Intersect([
  CatalogItemSchema,
  Type.Object({
    revisionId: Uuid,
    steps: Type.Array(TrailStepSchema),
    relatedCertifications: Type.Array(CatalogItemSchema),
  }),
]);

export const CertificationDetailSchema = Type.Intersect([
  CatalogItemSchema,
  Type.Object({
    revisionId: Uuid,
    issuer: Type.String(),
    skills: Type.Array(CatalogItemSchema),
    trails: Type.Array(CatalogItemSchema),
    requirements: Type.Array(
      Type.Object({
        id: Uuid,
        title: Type.String(),
        type: Type.Union([Type.Literal('skill'), Type.Literal('trail')]),
        targetId: Type.Optional(Uuid),
        required: Type.Boolean(),
      }),
    ),
  }),
]);

export const CatalogSearchQuerySchema = Type.Object(
  {
    q: Type.Optional(Type.String({ maxLength: 120 })),
    type: Type.Optional(CatalogType),
    categoryId: Type.Optional(Uuid),
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 1024 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  },
  { additionalProperties: false },
);

export const SkillIdParamsSchema = Type.Object({ skillId: Uuid });
export const TrailIdParamsSchema = Type.Object({ trailId: Uuid });
export const CertificationIdParamsSchema = Type.Object({ certificationId: Uuid });

export const ProblemSchema = Type.Object({
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer({ minimum: 400, maximum: 599 }),
  detail: Type.Optional(Type.String()),
  instance: Type.Optional(Type.String()),
  code: Type.String({ pattern: '^[A-Z0-9_]+$' }),
  requestId: Type.String(),
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
