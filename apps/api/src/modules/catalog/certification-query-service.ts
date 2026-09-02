import type { CatalogRepository } from './repository.js';
import { mapDetailRow } from './repository.js';
import type { CertificationDetail } from './types.js';

export class CertificationQueryService {
  constructor(private readonly repository: CatalogRepository) {}

  async get(certificationId: string): Promise<CertificationDetail | null> {
    const row = await this.repository.getCertification(certificationId);
    if (!row) return null;
    const [skills, trails, requirements] = await Promise.all([
      this.repository.listSkillsForCertification(row.revision_id),
      this.repository.listTrailsForCertification(row.revision_id),
      this.repository.listCertificationRequirements(row.revision_id),
    ]);
    return {
      ...mapDetailRow(row),
      type: 'certification',
      revisionId: row.revision_id,
      issuer: row.issuer,
      skills,
      trails,
      requirements,
    };
  }
}
