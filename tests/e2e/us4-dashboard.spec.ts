import { expect, test } from '@playwright/test';

const ids = {
  activeTrail: '40000000-0000-4000-8000-000000000001',
  activeRevision: '41000000-0000-4000-8000-000000000001',
  nextStep: '42000000-0000-4000-8000-000000000002',
} as const;

test('active-trail dashboard presents exactly one eligible next step', async ({ page }) => {
  await mockDashboard(page, activeDashboard());
  await page.goto('/painel');

  await expect(page.getByRole('heading', { name: 'Seu painel' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Engenharia de dados' })).toBeVisible();
  await expect(page.getByText('50% concluido')).toBeVisible();
  await expect(page.getByText('Construir um pipeline')).toBeVisible();
  await page.getByText('Por que esta recomendacao?').click();
  await expect(page.getByText(/requisitos estao concluidos/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /continuar etapa/i })).toHaveAttribute(
    'href',
    `/progresso/trilhas/${ids.activeTrail}`,
  );
  await expect(page.locator('[data-recommendation]')).toHaveCount(1);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('profile-based dashboard orders one primary trail and two alternatives', async ({ page }) => {
  const events: unknown[] = [];
  await page.exposeFunction('captureDashboardReady', (detail: unknown) => events.push(detail));
  await page.addInitScript(() => {
    window.addEventListener('skillmaps:dashboard-view-ready', (event) => {
      void (
        window as Window & { captureDashboardReady(detail: unknown): Promise<void> }
      ).captureDashboardReady((event as CustomEvent).detail);
    });
  });
  await mockDashboard(page, profileDashboard());
  await page.goto('/painel');

  await expect(page.getByText('Recomendacao principal')).toBeVisible();
  await expect(page.getByText('Alternativa 1')).toBeVisible();
  await expect(page.getByText('Alternativa 2')).toBeVisible();
  await expect(page.locator('[data-recommendation]')).toHaveCount(3);
  await expect(page.getByText(/funcao desejada/i).first()).toBeVisible();
  await expect.poll(() => events.length).toBe(1);
  expect(events[0]).toMatchObject({ activeTrailCount: 0, recommendationCount: 3 });
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

async function mockDashboard(page: import('@playwright/test').Page, body: unknown) {
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: { id: 'e2e-user', status: 'active', roles: ['user'], profile: null },
    }),
  );
  await page.route('**/api/v1/me/dashboard', (route) => route.fulfill({ json: body }));
}

function activeDashboard() {
  return {
    activeTrails: [
      {
        trailId: ids.activeTrail,
        title: 'Engenharia de dados',
        currentRevisionId: ids.activeRevision,
        percentage: 50,
        streamVersion: 3,
        lastActivityAt: '2026-09-03T10:00:00.000Z',
        catalogChanged: false,
      },
    ],
    certificationRecords: [],
    achievements: [],
    recommendations: [recommendation(1, ids.activeTrail, 'Construir um pipeline', 'trail_step')],
  };
}

function profileDashboard() {
  return {
    activeTrails: [],
    certificationRecords: [],
    achievements: [],
    recommendations: [
      recommendation(1, '40000000-0000-4000-8000-000000000001', 'Engenharia de dados'),
      recommendation(2, '40000000-0000-4000-8000-000000000002', 'Pipelines de dados'),
      recommendation(3, '40000000-0000-4000-8000-000000000003', 'Qualidade de dados'),
    ],
  };
}

function recommendation(
  rank: number,
  trailId: string,
  title: string,
  targetType: 'trail' | 'trail_step' = 'trail',
) {
  return {
    id: `50000000-0000-4000-8000-00000000000${rank}`,
    rank,
    targetType,
    trailId,
    stepId: targetType === 'trail_step' ? ids.nextStep : null,
    title,
    reasonCode: targetType === 'trail_step' ? 'next_eligible_step' : 'desired_role',
    evidence:
      targetType === 'trail_step'
        ? { position: 2, completedPrerequisiteStepIds: [], progressStreamVersion: 3 }
        : {
            desiredRoleId: '10000000-0000-4000-8000-000000000001',
            matchedInterestSkillIds: [],
            score: 100,
          },
    explanation:
      targetType === 'trail_step'
        ? 'Esta e a proxima etapa elegivel; seus requisitos estao concluidos.'
        : 'Esta trilha esta relacionada a sua funcao desejada.',
    inputVersions: {
      ruleSetVersion: 1,
      profileVersion: 1,
      progressStreamVersion: targetType === 'trail_step' ? 3 : 0,
      catalogRevisionId: ids.activeRevision,
    },
  };
}
