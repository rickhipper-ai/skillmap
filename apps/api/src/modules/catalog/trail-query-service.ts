import type { CatalogRepository } from './repository.js';
import { mapDetailRow } from './repository.js';
import type { SkillDetail, TrailDetail } from './types.js';

export class TrailQueryService {
  constructor(private readonly repository: CatalogRepository) {}

  async getSkill(skillId: string): Promise<SkillDetail | null> {
    const skill = await this.repository.getSkill(skillId);
    if (!skill || skill.type !== 'skill') return null;
    const [relatedTrails, relatedCertifications] = await Promise.all([
      this.repository.listTrailsForSkill(skillId),
      this.repository.listCertificationsForSkill(skillId),
    ]);
    return { ...skill, type: 'skill', relatedTrails, relatedCertifications };
  }

  async getTrail(trailId: string): Promise<TrailDetail | null> {
    const row = await this.repository.getTrail(trailId);
    if (!row) return null;
    const [stepRows, relatedCertifications] = await Promise.all([
      this.repository.listTrailSteps(row.revision_id),
      this.repository.listCertificationsForTrail(trailId),
    ]);
    const steps = await Promise.all(
      stepRows.map(async (step) => {
        const [skills, prerequisiteStepIds] = await Promise.all([
          this.repository.listSkillsForTrailStep(row.revision_id, step.id),
          this.repository.listPrerequisites(row.revision_id, step.id),
        ]);
        return { ...step, skills, prerequisiteStepIds };
      }),
    );
    return {
      ...mapDetailRow(row),
      type: 'trail',
      revisionId: row.revision_id,
      steps,
      relatedCertifications,
    };
  }
}
