import { describe, expect, it } from 'vitest';

import {
  evaluateRecommendations,
  type RecommendationInput,
} from '../../src/modules/recommendations/engine.js';

const ids = {
  role: '10000000-0000-4000-8000-000000000001',
  category: '20000000-0000-4000-8000-000000000001',
  skill: '30000000-0000-4000-8000-000000000001',
  lowerTrail: '40000000-0000-4000-8000-000000000001',
  higherTrail: '40000000-0000-4000-8000-000000000002',
  thirdTrail: '40000000-0000-4000-8000-000000000003',
  fourthTrail: '40000000-0000-4000-8000-000000000004',
  revision: '41000000-0000-4000-8000-000000000001',
  step: '42000000-0000-4000-8000-000000000001',
  prerequisite: '42000000-0000-4000-8000-000000000002',
  ruleSet: '50000000-0000-4000-8000-000000000001',
} as const;

const base: RecommendationInput = {
  ruleSet: {
    id: ids.ruleSet,
    version: 1,
    rules: { desiredRoleWeight: 100, interestCategoryWeight: 20, interestSkillWeight: 5 },
  },
  profile: {
    desiredRoleId: ids.role,
    interestCategoryIds: [ids.category],
    interestSkillIds: [ids.skill],
  },
  activeTrails: [],
  publishedTrails: [],
};

function trail(trailId: string, matches = true) {
  return {
    trailId,
    title: `Trilha ${trailId.at(-1)}`,
    revisionId: ids.revision,
    categoryId: matches ? ids.category : null,
    targetRoleIds: matches ? [ids.role] : [],
    skillIds: matches ? [ids.skill] : [],
  };
}

describe('deterministic recommendation engine', () => {
  it('scores role and interests, uses UUID ties, limits the result, and records evidence', () => {
    const input: RecommendationInput = {
      ...base,
      publishedTrails: [
        trail(ids.fourthTrail),
        trail(ids.higherTrail),
        trail(ids.thirdTrail),
        trail(ids.lowerTrail),
      ],
    };

    const first = evaluateRecommendations(input);
    const repeated = evaluateRecommendations({
      ...input,
      publishedTrails: [...input.publishedTrails],
    });

    expect(first).toEqual(repeated);
    expect(first).toHaveLength(3);
    expect(first.map(({ trailId }) => trailId)).toEqual([
      ids.lowerTrail,
      ids.higherTrail,
      ids.thirdTrail,
    ]);
    expect(first[0]).toMatchObject({
      rank: 1,
      targetType: 'trail',
      reasonCode: 'desired_role',
      evidence: {
        desiredRoleId: ids.role,
        matchedInterestCategoryId: ids.category,
        matchedInterestSkillIds: [ids.skill],
        score: 125,
      },
    });
    expect(first[0]?.explanation).toMatch(/funcao desejada/i);
  });

  it('returns exactly one next eligible step for active progress with requirement evidence', () => {
    const recommendations = evaluateRecommendations({
      ...base,
      publishedTrails: [trail(ids.higherTrail)],
      activeTrails: [
        {
          trailId: ids.lowerTrail,
          title: 'Trilha ativa',
          revisionId: ids.revision,
          lastActivityAt: '2026-09-03T10:00:00.000Z',
          streamVersion: 7,
          steps: [
            {
              stepId: ids.step,
              title: 'Aplicar fundamentos',
              position: 2,
              state: 'not_started',
              eligible: true,
              prerequisiteStepIds: [ids.prerequisite],
            },
          ],
        },
      ],
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      rank: 1,
      targetType: 'trail_step',
      trailId: ids.lowerTrail,
      stepId: ids.step,
      reasonCode: 'next_eligible_step',
      evidence: {
        position: 2,
        completedPrerequisiteStepIds: [ids.prerequisite],
        progressStreamVersion: 7,
      },
    });
    expect(recommendations[0]?.explanation).toMatch(/requisitos.*concluidos/i);
  });

  it('does not recommend unrelated trails or fabricate profile evidence', () => {
    expect(
      evaluateRecommendations({
        ...base,
        profile: null,
        publishedTrails: [trail(ids.lowerTrail, false)],
      }),
    ).toEqual([]);
  });
});
