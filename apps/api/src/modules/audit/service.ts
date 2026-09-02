import { createHash } from 'node:crypto';

import { sql, type Kysely } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';

const forbiddenMetadataKey = /email|password|secret|token|cookie|authorization|body|ip/i;

function redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !forbiddenMetadataKey.test(key))
      .slice(0, 20)
      .map(([key, value]) => [
        key,
        typeof value === 'string'
          ? value.slice(0, 160)
          : typeof value === 'number' || typeof value === 'boolean' || value === null
            ? value
            : '[REDACTED]',
      ]),
  );
}

export class AuditService {
  constructor(private readonly db: Kysely<FoundationDatabase>) {}

  async record(input: {
    eventType: string;
    actorId?: string;
    subjectId?: string;
    outcome: 'success' | 'denied' | 'failure';
    requestId?: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const tombstone = input.actorId
      ? createHash('sha256').update(input.actorId).digest('hex')
      : undefined;
    await sql`
      INSERT INTO audit_events (
        event_type, actor_id, subject_id, actor_tombstone, outcome, request_id,
        resource_type, resource_id, metadata
      ) VALUES (
        ${input.eventType}, ${input.actorId ?? null}, ${input.subjectId ?? null}, ${tombstone ?? null},
        ${input.outcome}, ${input.requestId ?? null}, ${input.resourceType ?? null},
        ${input.resourceId ?? null}, ${JSON.stringify(redactMetadata(input.metadata ?? {}))}::jsonb
      )
    `.execute(this.db);
  }
}
