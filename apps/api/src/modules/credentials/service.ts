import { HttpProblem } from '../../plugins/problem-details.js';
import {
  CertificationRepository,
  type CertificationRecord,
  type CertificationRecordInput,
  type CredentialDatabase,
} from './repository.js';

export type CertificationRecordedSubscriber = (
  event: { userId: string; recordId: string },
  executor?: CredentialDatabase,
) => Promise<void>;

export class CertificationService {
  constructor(
    private readonly repository: CertificationRepository,
    private readonly subscriber?: CertificationRecordedSubscriber,
  ) {}

  async create(
    userId: string,
    commandId: string,
    input: CertificationRecordInput,
  ): Promise<CertificationRecord> {
    if (input.expiresOn && input.expiresOn <= input.obtainedOn) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation failed',
        code: 'EXPIRY_MUST_FOLLOW_ACQUISITION',
        extensions: {
          errors: [
            {
              path: '/expiresOn',
              code: 'expires_after_obtained',
              message: 'A validade deve ser posterior a data de obtencao.',
            },
          ],
        },
      });
    }
    const normalized = {
      ...input,
      externalIdentifier: input.externalIdentifier?.trim() || null,
      expiresOn: input.expiresOn ?? null,
    };
    return this.repository.transaction(async (repository) => {
      await repository.lockCommand(commandId);
      const prior = await repository.findCommand(commandId);
      if (prior) {
        if (prior.userId !== userId || !sameInput(prior.input, normalized)) {
          throw new HttpProblem({
            status: 409,
            title: 'Conflict',
            code: 'IDEMPOTENCY_KEY_REUSED',
          });
        }
        return prior.record;
      }

      const revisionId = await repository.getPublishedRevision(input.certificationId);
      if (!revisionId) {
        throw new HttpProblem({
          status: 404,
          title: 'Not Found',
          code: 'PUBLISHED_CERTIFICATION_NOT_FOUND',
        });
      }
      const inserted = await repository.insert({ ...normalized, userId, revisionId });
      const record = inserted ?? (await repository.findDuplicate(userId, normalized));
      if (!record) throw new Error('CERTIFICATION_DUPLICATE_LOOKUP_FAILED');
      await repository.mapCommand(commandId, userId, normalized, record.id);
      if (inserted) await this.subscriber?.({ userId, recordId: record.id }, repository.executor);
      return record;
    });
  }

  list(userId: string): Promise<CertificationRecord[]> {
    return this.repository.list(userId);
  }

  listCertificationRecords(userId: string): Promise<CertificationRecord[]> {
    return this.list(userId);
  }
}

function sameInput(left: CertificationRecordInput, right: CertificationRecordInput): boolean {
  return (
    left.certificationId === right.certificationId &&
    left.obtainedOn === right.obtainedOn &&
    (left.externalIdentifier ?? null) === (right.externalIdentifier ?? null) &&
    (left.expiresOn ?? null) === (right.expiresOn ?? null)
  );
}
