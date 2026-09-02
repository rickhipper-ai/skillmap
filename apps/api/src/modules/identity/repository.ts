import { sql, type Kysely } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';

export interface LiveSession {
  sessionId: string;
  token: string;
  userId: string;
  status: 'active';
  roles: ('user' | 'content_admin')[];
  authenticatedAt: Date;
}

export class IdentityRepository {
  constructor(readonly db: Kysely<FoundationDatabase>) {}

  async emailExists(email: string): Promise<boolean> {
    const result = await sql<{ exists: boolean }>`
      SELECT EXISTS (SELECT 1 FROM users WHERE email_normalized = ${email}) AS exists
    `.execute(this.db);
    return result.rows[0]?.exists ?? false;
  }

  async findRoles(userId: string): Promise<('user' | 'content_admin')[]> {
    const result = await sql<{ role: 'user' | 'content_admin' }>`
      SELECT role FROM user_roles WHERE user_id = ${userId} ORDER BY role
    `.execute(this.db);
    return result.rows.map((row) => row.role);
  }
}
