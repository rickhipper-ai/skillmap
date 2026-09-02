const fixedNow = new Date('2026-01-15T12:00:00.000Z');
let sequence = 1;

function nextUuid() {
  const suffix = String(sequence++).padStart(12, '0');
  return `00000000-0000-4000-8000-${suffix}`;
}

export function resetFixtureSequence() {
  sequence = 1;
}

export function createUserFixture(overrides: Record<string, unknown> = {}) {
  const id = nextUuid();
  return {
    id,
    email: `user-${id.slice(-4)}@example.test`,
    status: 'active' as const,
    emailVerifiedAt: fixedNow,
    createdAt: fixedNow,
    ...overrides,
  };
}

export function createCatalogFixture(overrides: Record<string, unknown> = {}) {
  const id = nextUuid();
  return {
    id,
    slug: `fixture-${id.slice(-4)}`,
    status: 'published' as const,
    createdAt: fixedNow,
    ...overrides,
  };
}
