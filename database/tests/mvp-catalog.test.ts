import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { seedMvpCatalog } from '../seeds/mvp-catalog.js';

vi.mock('argon2', () => ({ hash: vi.fn().mockResolvedValue('test-password-hash') }));

describe('MVP catalog seed', () => {
  it('sends one PostgreSQL command per pg query', async () => {
    const query = vi.fn(async (...[text]: [string, unknown[]?]) => ({
      rowCount: text.includes('SELECT 1 FROM learning_trails') ? 0 : null,
      rows: [],
    }));
    const release = vi.fn();
    const pool = {
      connect: vi.fn().mockResolvedValue({ query, release }),
    } as unknown as Pool;

    await seedMvpCatalog(pool, {
      email: 'demo.seed@example.test',
      password: 'Senha-demo-ficticia-123!',
    });

    expect(query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(release).toHaveBeenCalledOnce();

    for (const [text, values] of query.mock.calls) {
      expect(text.trim().replace(/;$/, ''), text).not.toContain(';');

      if (values !== undefined) {
        const placeholders = [...text.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
        expect(values, text).toHaveLength(Math.max(0, ...placeholders));
      }
    }
  });
});
