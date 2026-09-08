import { expect, test } from '@playwright/test';

const ids = {
  trail: '40000000-0000-4000-8000-000000000001',
  revision: '41000000-0000-4000-8000-000000000001',
  nextRevision: '41000000-0000-4000-8000-000000000002',
  first: '42000000-0000-4000-8000-000000000001',
  second: '42000000-0000-4000-8000-000000000002',
};

test('user starts, advances, corrects, and sees current-publication progress', async ({ page }) => {
  let started = false;
  let streamVersion = 0;
  let catalogChanged = false;
  const states: Record<string, string> = {
    [ids.first]: 'not_started',
    [ids.second]: 'not_started',
  };
  const history: Array<Record<string, unknown>> = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/users/me'))
      return route.fulfill({
        json: { id: 'e2e-user', status: 'active', roles: ['user'], profile: null },
      });
    if (path.endsWith('/security/csrf-token'))
      return route.fulfill({ json: { token: 'x'.repeat(32) } });
    if (path.endsWith(`/trails/${ids.trail}`) && !path.includes('/me/'))
      return route.fulfill({ json: trailDetail() });
    if (path.endsWith(`/me/trails/${ids.trail}`) && request.method() === 'GET') {
      if (!started)
        return route.fulfill({
          status: 404,
          json: {
            title: 'Not Found',
            status: 404,
            code: 'TRAIL_PROGRESS_NOT_FOUND',
            requestId: 'e2e',
          },
        });
      catalogChanged = history.length >= 3;
      return route.fulfill({ json: currentProgress() });
    }
    if (path.endsWith(`/me/trails/${ids.trail}`) && request.method() === 'PUT') {
      expect(request.headers()['idempotency-key']).toBeTruthy();
      started = true;
      return route.fulfill({ json: currentProgress() });
    }
    if (path.endsWith('/events')) {
      expect(request.headers()['x-csrf-token']).toBe('x'.repeat(32));
      expect(request.headers()['idempotency-key']).toBeTruthy();
      const body = request.postDataJSON() as { state: string; supersedesEventId?: number };
      const stepId = path.includes(ids.first) ? ids.first : ids.second;
      streamVersion += 1;
      states[stepId] = body.state;
      history.push({
        eventId: streamVersion,
        stepId,
        state: body.state,
        occurredAt: new Date(2026, 0, 1, streamVersion).toISOString(),
        source: 'user',
        supersedesEventId: body.supersedesEventId,
        observedRevisionId: ids.revision,
      });
      return route.fulfill({
        status: 201,
        json: {
          eventId: streamVersion,
          streamVersion,
          state: body.state,
          reviewRequired: false,
          trailProgress: currentProgress(),
        },
      });
    }
    return route.fallback();
  });

  function currentProgress() {
    return {
      trailId: ids.trail,
      currentRevisionId: catalogChanged ? ids.nextRevision : ids.revision,
      status: 'in_progress',
      percentage: states[ids.first] === 'completed' ? 50 : 0,
      streamVersion,
      catalogChanged,
      reviewRequired: false,
      steps: [
        {
          stepId: ids.first,
          state: states[ids.first],
          eligible: true,
          pendingPrerequisiteStepIds: [],
        },
        {
          stepId: ids.second,
          state: states[ids.second],
          eligible: states[ids.first] === 'completed',
          pendingPrerequisiteStepIds: states[ids.first] === 'completed' ? [] : [ids.first],
        },
      ],
      history,
    };
  }

  await page.goto(`/trilhas/${ids.trail}`);
  await page.getByRole('link', { name: /iniciar ou acompanhar progresso/i }).click();
  await expect(
    page.getByRole('heading', { name: /progresso em Trilha progressiva/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar trilha' }).click();
  await page.getByRole('button', { name: 'Concluir Fundamentos' }).click();
  await expect(page.getByText('50% concluido')).toBeVisible();
  await page.getByRole('button', { name: 'Corrigir Fundamentos' }).click();
  await page.getByLabel('Evento a corrigir').selectOption('1');
  await page.getByLabel('Estado correto').selectOption('in_progress');
  await page.getByRole('button', { name: 'Registrar correcao' }).click();
  await page.getByRole('button', { name: 'Concluir Fundamentos' }).click();
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('catalogo foi atualizado');
  await expect(page.getByRole('list', { name: 'Historico cronologico' })).toContainText(
    'corrige o evento #1',
  );
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

function trailDetail() {
  return {
    id: ids.trail,
    type: 'trail',
    slug: 'trilha-progressiva',
    title: 'Trilha progressiva',
    summary: 'Aprenda em ordem',
    revisionId: ids.revision,
    category: null,
    relatedCertifications: [],
    steps: [
      {
        id: ids.first,
        position: 1,
        title: 'Fundamentos',
        required: true,
        skills: [],
        prerequisiteStepIds: [],
      },
      {
        id: ids.second,
        position: 2,
        title: 'Pratica',
        required: true,
        skills: [],
        prerequisiteStepIds: [ids.first],
      },
    ],
  };
}
