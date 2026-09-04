import { expect, test } from '@playwright/test';

test('five-step authoring, publication, deactivation, and normal-user denial', async ({ page }) => {
  test.setTimeout(60_000);
  const trailId = '40000000-0000-4000-8000-000000000099';
  let status = 'draft';
  let denied = false;
  await page.route('**/api/v1/security/csrf-token', (route) =>
    route.fulfill({ json: { token: 'x'.repeat(32) } }),
  );
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({ json: { roles: ['content_admin'] } }),
  );
  await page.route('**/api/v1/admin/**', async (route, request) => {
    expect(request.headers()['x-csrf-token']).toBe('x'.repeat(32));
    if (denied) {
      return route.fulfill({
        status: 403,
        contentType: 'application/problem+json',
        json: {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'CONTENT_ADMIN_REQUIRED',
          requestId: 'us6-e2e',
        },
      });
    }
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/publications')) {
      status = 'published';
      return route.fulfill({
        status: 201,
        json: {
          resourceId: trailId,
          revisionId: '41000000-0000-4000-8000-000000000099',
          revisionNumber: 1,
          publishedAt: '2026-09-03T12:00:00.000Z',
        },
      });
    }
    if (path.endsWith('/status')) {
      status = (request.postDataJSON() as { status: string }).status;
      return route.fulfill({
        json: { id: trailId, slug: 'dados-avancados', status, updatedAt: new Date().toISOString() },
      });
    }
    const body = (request.postDataJSON() ?? {}) as { slug?: string; steps?: unknown[] };
    if (body.steps) expect(body.steps).toHaveLength(5);
    return route.fulfill({
      status: request.method() === 'POST' ? 201 : 200,
      json: {
        id: path.endsWith('/trails') ? trailId : crypto.randomUUID(),
        slug: body.slug ?? 'recurso-administrado',
        status,
        updatedAt: new Date().toISOString(),
      },
    });
  });

  await page.goto('/administracao');
  await page.getByLabel('Slug da categoria').fill('dados-avancados');
  await page.getByLabel('Nome da categoria').fill('Dados avancados');
  await page.getByLabel('Descricao da categoria').fill('Praticas avancadas de dados.');
  await page.getByRole('button', { name: 'Salvar categoria' }).click();

  await page.getByLabel('Slug da habilidade').fill('sql-avancado');
  await page.getByLabel('Categoria da habilidade').fill('20000000-0000-4000-8000-000000000001');
  await page.getByLabel('Nome da habilidade').fill('SQL avancado');
  await page.getByLabel('Descricao da habilidade').fill('Consultas e modelagem avancadas.');
  await page.getByRole('button', { name: 'Salvar habilidade' }).click();

  await page.getByLabel('Slug da trilha').fill('dados-avancados');
  await page.getByLabel('Categoria da trilha').fill('20000000-0000-4000-8000-000000000001');
  await page.getByLabel('Titulo da trilha').fill('Dados avancados');
  await page.getByLabel('Descricao da trilha').fill('Uma jornada completa em cinco etapas.');
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole('button', { name: 'Adicionar etapa' }).click();
    await page.getByLabel(`Titulo da etapa ${index + 1}`).fill(`Etapa ${index + 1}`);
    await page
      .getByLabel(`IDs de habilidades da etapa ${index + 1}`)
      .fill('30000000-0000-4000-8000-000000000001');
  }
  await page.getByLabel('Pre-requisitos da etapa 2').selectOption({ label: 'Etapa 1' });
  await page.getByRole('button', { name: 'Salvar trilha' }).click();
  await page.getByRole('button', { name: 'Publicar trilha', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Publicada');

  await page.getByRole('button', { name: 'Desativar trilha' }).click();
  await expect(page.getByRole('status')).toContainText('Inativa');

  denied = true;
  await page.getByRole('button', { name: 'Salvar categoria' }).click();
  await expect(page.getByRole('alert')).toContainText('permissao');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
