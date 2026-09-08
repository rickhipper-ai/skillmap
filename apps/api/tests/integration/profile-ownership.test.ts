import { describe, expect, it } from 'vitest';

import { ProfileInputSchema } from '../../src/modules/identity/schemas.js';
import { Value } from '@sinclair/typebox/value';
import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
} from '../support/identity.js';

describe('professional profile input', () => {
  it('rejects unknown server-owned role and user fields', () => {
    const valid = {
      displayName: 'Ana Ficticia',
      experienceLevel: 'beginner',
      interestCategoryIds: [],
      interestSkillIds: [],
    };

    expect(Value.Check(ProfileInputSchema, valid)).toBe(true);
    expect(Value.Check(ProfileInputSchema, { ...valid, roles: ['content_admin'] })).toBe(false);
    expect(Value.Check(ProfileInputSchema, { ...valid, userId: crypto.randomUUID() })).toBe(false);
  });

  it('rejects duplicate interests and bounded-field violations', () => {
    const id = crypto.randomUUID();

    expect(
      Value.Check(ProfileInputSchema, {
        displayName: '',
        interestCategoryIds: [id, id],
      }),
    ).toBe(false);
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')(
  'profile ownership with PostgreSQL',
  () => {
    it('updates only the session owner and rejects server-owned or inactive references', async () => {
      await withPostgres(async ({ admin, database }) => {
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email);
        const proof = await csrf(app);
        try {
          const activeRole = crypto.randomUUID();
          const inactiveRole = crypto.randomUUID();
          const category = crypto.randomUUID();
          const skill = crypto.randomUUID();
          await admin.query(
            "INSERT INTO professional_roles (id, slug, name, active) VALUES ($1, 'engenharia-software', 'Engenharia de software', true), ($2, 'funcao-inativa', 'Funcao inativa', false)",
            [activeRole, inactiveRole],
          );
          await admin.query(
            "INSERT INTO skill_categories (id, slug) VALUES ($1, 'fundamentos-ficticios')",
            [category],
          );
          await admin.query("INSERT INTO skills (id, slug) VALUES ($1, 'typescript-ficticio')", [
            skill,
          ]);
          const ownerCookie = await registerVerifyAndLogin(
            app,
            email,
            proof,
            'perfil.a@example.test',
          );
          const otherCookie = await registerVerifyAndLogin(
            app,
            email,
            proof,
            'perfil.b@example.test',
          );

          const updated = await mutate(
            app,
            proof,
            {
              method: 'PATCH',
              url: '/v1/users/me',
              headers: { 'content-type': 'application/merge-patch+json' },
              payload: {
                displayName: 'Pessoa Ficticia A',
                currentRoleId: activeRole,
                desiredRoleId: activeRole,
                experienceLevel: 'intermediate',
                interestCategoryIds: [category],
                interestSkillIds: [skill],
              },
            },
            ownerCookie,
          );
          expect(updated.statusCode).toBe(200);
          expect(updated.json()).toMatchObject({ profile: { displayName: 'Pessoa Ficticia A' } });

          const otherProfile = await app.inject({
            method: 'GET',
            url: '/v1/users/me',
            headers: { cookie: otherCookie },
          });
          expect(otherProfile.json()).toMatchObject({
            profile: {
              displayName: 'perfil.b',
              experienceLevel: 'beginner',
              interestCategoryIds: [],
              interestSkillIds: [],
            },
          });

          const massAssignment = await mutate(
            app,
            proof,
            {
              method: 'PATCH',
              url: '/v1/users/me',
              headers: { 'content-type': 'application/merge-patch+json' },
              payload: { roles: ['content_admin'], userId: crypto.randomUUID() },
            },
            ownerCookie,
          );
          expect(massAssignment.statusCode).toBe(422);

          const inactiveReference = await mutate(
            app,
            proof,
            {
              method: 'PATCH',
              url: '/v1/users/me',
              headers: { 'content-type': 'application/merge-patch+json' },
              payload: { currentRoleId: inactiveRole },
            },
            ownerCookie,
          );
          expect(inactiveReference.statusCode).toBe(422);
        } finally {
          await app.close();
        }
      });
    }, 120_000);
  },
);
