import { HttpProblem } from '../../plugins/problem-details.js';
import type { AuditService } from '../audit/service.js';
import { ProfileRepository, type ProfessionalProfile } from './repository.js';

export type ProfilePatch = Partial<ProfessionalProfile>;

export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly audit: AuditService,
  ) {}

  get(userId: string) {
    return this.repository.get(userId);
  }

  async update(userId: string, patch: ProfilePatch): Promise<ProfessionalProfile> {
    const current = await this.repository.get(userId);
    if (!current && (!patch.displayName || !patch.experienceLevel)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation failed',
        code: 'PROFILE_REQUIRED_FIELDS_MISSING',
      });
    }
    const profile: ProfessionalProfile = {
      displayName: patch.displayName ?? current?.displayName ?? '',
      currentRoleId:
        patch.currentRoleId === undefined ? (current?.currentRoleId ?? null) : patch.currentRoleId,
      desiredRoleId:
        patch.desiredRoleId === undefined ? (current?.desiredRoleId ?? null) : patch.desiredRoleId,
      experienceLevel: patch.experienceLevel ?? current?.experienceLevel ?? 'beginner',
      interestCategoryIds: patch.interestCategoryIds ?? current?.interestCategoryIds ?? [],
      interestSkillIds: patch.interestSkillIds ?? current?.interestSkillIds ?? [],
    };
    const roleIds = [
      ...new Set(
        [profile.currentRoleId, profile.desiredRoleId].filter(
          (value): value is string => value !== null,
        ),
      ),
    ];
    if (
      await this.hasUnknownReferences(
        roleIds,
        profile.interestCategoryIds,
        profile.interestSkillIds,
      )
    ) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation failed',
        code: 'PROFILE_REFERENCE_INVALID',
      });
    }
    await this.repository.save(userId, profile);
    await this.audit.record({
      eventType: 'profile_updated',
      actorId: userId,
      subjectId: userId,
      outcome: 'success',
    });
    return profile;
  }

  private async hasUnknownReferences(roles: string[], categories: string[], skills: string[]) {
    const [roleCount, categoryCount, skillCount] = await Promise.all([
      this.repository.countActiveRoles(roles),
      this.repository.countCategories(categories),
      this.repository.countSkills(skills),
    ]);
    return (
      roleCount !== roles.length ||
      categoryCount !== categories.length ||
      skillCount !== skills.length
    );
  }
}
