import { describe, expect, it } from 'vitest';

import { readEnvironment, readMigrationDatabaseUrl } from '../../src/config/environment.js';

const baseEnvironment = {
  NODE_ENV: 'development',
  WEB_ORIGIN: 'https://app.skill-maps.test',
  DATABASE_URL: 'postgresql://runtime.example.test/skill_maps?sslmode=require',
  AUTH_SECRET: 'fictitious_test_auth_secret_at_least_32_chars',
};

describe('API environment', () => {
  it('starts the runtime with DATABASE_URL and no migration credential', () => {
    const environment = readEnvironment(baseEnvironment);

    expect(environment.databaseUrl).toContain('runtime.example.test');
    expect(environment.migrationDatabaseUrl).toBeUndefined();
    expect(environment.databaseRuntimeRole).toBeUndefined();
    expect(environment.demoAutoVerifyEmail).toBe(false);
    expect(environment.port).toBe(3000);
  });

  it('accepts demo auto-verification outside production and rejects it in production', () => {
    expect(
      readEnvironment({ ...baseEnvironment, DEMO_AUTO_VERIFY_EMAIL: 'true' }).demoAutoVerifyEmail,
    ).toBe(true);
    expect(() =>
      readEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'production',
        DEMO_AUTO_VERIFY_EMAIL: 'true',
      }),
    ).toThrow(/DEMO_AUTO_VERIFY_EMAIL/);
  });

  it('requires the privileged URL only for migration commands', () => {
    expect(
      readMigrationDatabaseUrl({
        MIGRATION_DATABASE_URL: 'postgresql://migration.example.test/skill_maps?sslmode=require',
      }),
    ).toContain('migration.example.test');
    expect(() => readMigrationDatabaseUrl({})).toThrow(/MIGRATION_DATABASE_URL/);
  });
});
