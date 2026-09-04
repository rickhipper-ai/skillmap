import { sql, type Kysely, type Transaction } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';

export type CredentialDatabase = Kysely<FoundationDatabase> | Transaction<FoundationDatabase>;

export interface CertificationRecordInput {
  certificationId: string;
  obtainedOn: string;
  externalIdentifier?: string | null | undefined;
  expiresOn?: string | null | undefined;
}

export interface CertificationRecord {
  id: string;
  certificationId: string;
  obtainedOn: string;
  externalIdentifier: string | null;
  expiresOn: string | null;
  verificationStatus: 'self_declared';
  createdAt: string;
}

interface CertificationRecordRow {
  id: string;
  certification_id: string;
  obtained_on: string | Date;
  external_identifier: string | null;
  expires_on: string | Date | null;
  verification_status: 'self_declared';
  created_at: Date;
}

interface CommandRow extends CertificationRecordRow {
  user_id: string;
  command_certification_id: string;
  command_obtained_on: string | Date;
  command_external_identifier: string | null;
  command_expires_on: string | Date | null;
}

export class CertificationRepository {
  constructor(
    readonly executor: CredentialDatabase,
    private readonly transactional = false,
  ) {}

  transaction<T>(run: (repository: CertificationRepository) => Promise<T>): Promise<T> {
    if (this.transactional) return run(this);
    return this.executor
      .transaction()
      .execute((transaction) => run(new CertificationRepository(transaction, true)));
  }

  async lockCommand(commandId: string): Promise<void> {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${commandId}, 0))`.execute(
      this.executor,
    );
  }

  async findCommand(commandId: string): Promise<{
    userId: string;
    input: Required<Omit<CertificationRecordInput, 'externalIdentifier' | 'expiresOn'>> & {
      externalIdentifier: string | null;
      expiresOn: string | null;
    };
    record: CertificationRecord;
  } | null> {
    const result = await sql<CommandRow>`
      SELECT command.user_id, command.certification_id AS command_certification_id,
        command.obtained_on AS command_obtained_on,
        command.external_identifier AS command_external_identifier,
        command.expires_on AS command_expires_on,
        record.id, record.certification_id, record.obtained_on, record.external_identifier,
        record.expires_on, record.verification_status, record.created_at
      FROM certification_record_commands command
      JOIN user_certification_records record ON record.id = command.record_id
      WHERE command.command_id = ${commandId}::uuid
    `.execute(this.executor);
    const row = result.rows[0];
    return row
      ? {
          userId: row.user_id,
          input: {
            certificationId: row.command_certification_id,
            obtainedOn: mapDate(row.command_obtained_on)!,
            externalIdentifier: row.command_external_identifier,
            expiresOn: mapDate(row.command_expires_on),
          },
          record: mapRecord(row),
        }
      : null;
  }

  async getPublishedRevision(certificationId: string): Promise<string | null> {
    const result = await sql<{ published_revision_id: string }>`
      SELECT published_revision_id FROM certifications
      WHERE id = ${certificationId}::uuid
        AND status = 'published' AND published_revision_id IS NOT NULL
    `.execute(this.executor);
    return result.rows[0]?.published_revision_id ?? null;
  }

  async insert(input: CertificationRecordInput & { userId: string; revisionId: string }) {
    const result = await sql<CertificationRecordRow>`
      INSERT INTO user_certification_records
        (user_id, certification_id, observed_revision_id, obtained_on,
         external_identifier, expires_on, verification_status)
      VALUES (${input.userId}::uuid, ${input.certificationId}::uuid, ${input.revisionId}::uuid,
        ${input.obtainedOn}::date, ${input.externalIdentifier ?? null},
        ${input.expiresOn ?? null}::date, 'self_declared')
      ON CONFLICT ON CONSTRAINT user_certification_records_occurrence_key DO NOTHING
      RETURNING id, certification_id, obtained_on, external_identifier, expires_on,
        verification_status, created_at
    `.execute(this.executor);
    return result.rows[0] ? mapRecord(result.rows[0]) : null;
  }

  async findDuplicate(userId: string, input: CertificationRecordInput) {
    const result = await sql<CertificationRecordRow>`
      SELECT id, certification_id, obtained_on, external_identifier, expires_on,
        verification_status, created_at
      FROM user_certification_records
      WHERE user_id = ${userId}::uuid
        AND certification_id = ${input.certificationId}::uuid
        AND obtained_on = ${input.obtainedOn}::date
        AND external_identifier IS NOT DISTINCT FROM ${input.externalIdentifier ?? null}
    `.execute(this.executor);
    return result.rows[0] ? mapRecord(result.rows[0]) : null;
  }

  async mapCommand(
    commandId: string,
    userId: string,
    input: CertificationRecordInput,
    recordId: string,
  ): Promise<void> {
    await sql`
      INSERT INTO certification_record_commands
        (command_id, user_id, certification_id, obtained_on, external_identifier, expires_on, record_id)
      VALUES (${commandId}::uuid, ${userId}::uuid, ${input.certificationId}::uuid,
        ${input.obtainedOn}::date, ${input.externalIdentifier ?? null},
        ${input.expiresOn ?? null}::date, ${recordId}::uuid)
    `.execute(this.executor);
  }

  async list(userId: string): Promise<CertificationRecord[]> {
    const result = await sql<CertificationRecordRow>`
      SELECT id, certification_id, obtained_on, external_identifier, expires_on,
        verification_status, created_at
      FROM user_certification_records
      WHERE user_id = ${userId}::uuid
      ORDER BY obtained_on DESC, created_at DESC, id DESC
    `.execute(this.executor);
    return result.rows.map(mapRecord);
  }
}

function mapRecord(row: CertificationRecordRow): CertificationRecord {
  return {
    id: row.id,
    certificationId: row.certification_id,
    obtainedOn: mapDate(row.obtained_on)!,
    externalIdentifier: row.external_identifier,
    expiresOn: mapDate(row.expires_on),
    verificationStatus: row.verification_status,
    createdAt: row.created_at.toISOString(),
  };
}

function mapDate(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
