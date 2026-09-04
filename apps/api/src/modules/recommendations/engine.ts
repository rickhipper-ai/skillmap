export interface RecommendationRules {
  desiredRoleWeight: number;
  interestCategoryWeight: number;
  interestSkillWeight: number;
}

export interface RecommendationRuleSet {
  id: string;
  version: number;
  rules: RecommendationRules;
}

interface RecommendationProfile {
  desiredRoleId: string | null;
  interestCategoryIds: string[];
  interestSkillIds: string[];
}

export interface ActiveTrailInput {
  trailId: string;
  title: string;
  revisionId: string;
  lastActivityAt: string;
  streamVersion: number;
  steps: Array<{
    stepId: string;
    title: string;
    position: number;
    state: 'not_started' | 'in_progress' | 'completed';
    eligible: boolean;
    prerequisiteStepIds: string[];
  }>;
}

export interface PublishedTrailInput {
  trailId: string;
  title: string;
  revisionId: string;
  categoryId: string | null;
  targetRoleIds: string[];
  skillIds: string[];
}

export interface RecommendationInput {
  ruleSet: RecommendationRuleSet;
  profile: RecommendationProfile | null;
  activeTrails: ActiveTrailInput[];
  publishedTrails: PublishedTrailInput[];
}

export type RecommendationEvidence =
  | {
      position: number;
      completedPrerequisiteStepIds: string[];
      progressStreamVersion: number;
    }
  | {
      desiredRoleId?: string;
      matchedInterestCategoryId?: string;
      matchedInterestSkillIds: string[];
      score: number;
    };

export interface EvaluatedRecommendation {
  rank: number;
  targetType: 'trail_step' | 'trail';
  trailId: string;
  stepId: string | null;
  title: string;
  catalogRevisionId: string;
  reasonCode: 'next_eligible_step' | 'desired_role' | 'interest_match';
  evidence: RecommendationEvidence;
  explanation: string;
}

export function evaluateRecommendations(input: RecommendationInput): EvaluatedRecommendation[] {
  const eligibleSteps = input.activeTrails.flatMap((trail) =>
    trail.steps
      .filter((step) => step.state !== 'completed' && step.eligible)
      .map((step) => ({ trail, step })),
  );
  eligibleSteps.sort(
    (left, right) =>
      right.trail.lastActivityAt.localeCompare(left.trail.lastActivityAt) ||
      left.trail.trailId.localeCompare(right.trail.trailId) ||
      left.step.position - right.step.position ||
      left.step.stepId.localeCompare(right.step.stepId),
  );
  const next = eligibleSteps[0];
  if (next) {
    return [
      {
        rank: 1,
        targetType: 'trail_step',
        trailId: next.trail.trailId,
        stepId: next.step.stepId,
        title: next.step.title,
        catalogRevisionId: next.trail.revisionId,
        reasonCode: 'next_eligible_step',
        evidence: {
          position: next.step.position,
          completedPrerequisiteStepIds: [...next.step.prerequisiteStepIds].sort(),
          progressStreamVersion: next.trail.streamVersion,
        },
        explanation: 'Esta e a proxima etapa elegivel; seus requisitos estao concluidos.',
      },
    ];
  }

  if (!input.profile || input.activeTrails.length > 0) return [];
  const categoryInterests = new Set(input.profile.interestCategoryIds);
  const skillInterests = new Set(input.profile.interestSkillIds);
  const candidates = input.publishedTrails.flatMap((trail) => {
    const desiredRoleMatch =
      input.profile?.desiredRoleId !== null &&
      input.profile?.desiredRoleId !== undefined &&
      trail.targetRoleIds.includes(input.profile.desiredRoleId);
    const categoryMatch = trail.categoryId !== null && categoryInterests.has(trail.categoryId);
    const matchedSkills = trail.skillIds.filter((skillId) => skillInterests.has(skillId)).sort();
    const score =
      (desiredRoleMatch ? input.ruleSet.rules.desiredRoleWeight : 0) +
      (categoryMatch ? input.ruleSet.rules.interestCategoryWeight : 0) +
      matchedSkills.length * input.ruleSet.rules.interestSkillWeight;
    if (score === 0) return [];
    const evidence = {
      ...(desiredRoleMatch && input.profile?.desiredRoleId
        ? { desiredRoleId: input.profile.desiredRoleId }
        : {}),
      ...(categoryMatch && trail.categoryId ? { matchedInterestCategoryId: trail.categoryId } : {}),
      matchedInterestSkillIds: matchedSkills,
      score,
    };
    return [{ trail, desiredRoleMatch, score, evidence }];
  });

  candidates.sort(
    (left, right) =>
      right.score - left.score || left.trail.trailId.localeCompare(right.trail.trailId),
  );
  return candidates.slice(0, 3).map((candidate, index) => ({
    rank: index + 1,
    targetType: 'trail',
    trailId: candidate.trail.trailId,
    stepId: null,
    title: candidate.trail.title,
    catalogRevisionId: candidate.trail.revisionId,
    reasonCode: candidate.desiredRoleMatch ? 'desired_role' : 'interest_match',
    evidence: candidate.evidence,
    explanation: candidate.desiredRoleMatch
      ? 'Esta trilha esta relacionada a sua funcao desejada e aos interesses correspondentes.'
      : 'Esta trilha esta relacionada aos seus interesses profissionais.',
  }));
}
