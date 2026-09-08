import { expect, test } from '@playwright/test';

test('cadastro demo, login, painel, catalogo e logout', async ({ page }) => {
  const currentUser = {
    id: '00000000-0000-4000-8000-000000000001',
    status: 'active',
    roles: ['user'],
    profile: {
      displayName: 'Pessoa Demonstracao',
      currentRoleId: null,
      desiredRoleId: null,
      experienceLevel: 'beginner',
      interestCategoryIds: [],
      interestSkillIds: [],
    },
  };

  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/security/csrf-token')) {
      await route.fulfill({
        json: { token: 'csrf-token-ficticio-com-mais-de-trinta-e-dois-caracteres' },
      });
      return;
    }
    if (path.endsWith('/registrations')) {
      await route.fulfill({
        status: 201,
        json: { status: 'active', emailVerification: 'automatic' },
      });
      return;
    }
    if (path.endsWith('/sessions') || path.endsWith('/users/me')) {
      await route.fulfill({ status: 201, json: currentUser });
      return;
    }
    if (path.endsWith('/sessions/current')) {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith('/me/dashboard')) {
      await route.fulfill({
        json: {
          activeTrails: [],
          certificationRecords: [],
          achievements: [],
          recommendations: [],
        },
      });
      return;
    }
    if (path.endsWith('/categories')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (path.includes('/catalog')) {
      await route.fulfill({
        json: {
          items: [
            {
              id: '40000000-0000-4000-8000-000000000001',
              type: 'trail',
              slug: 'fundamentos-dados',
              title: 'Fundamentos de dados',
              summary: 'Uma jornada de cinco etapas.',
              category: null,
            },
          ],
          nextCursor: null,
        },
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Criar conta' }).first().click();
  await page.getByLabel('Nome').fill('Pessoa Demonstracao');
  await page.getByLabel('E-mail').fill('demonstracao@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('Senha-ficticia-123!');
  await page.getByLabel('Confirmar senha').fill('Senha-ficticia-123!');
  await page.getByLabel(/aceito os termos/i).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('status')).toContainText(/confirmado automaticamente/i);

  await page.getByRole('link', { name: 'Entrar' }).last().click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.getByLabel('E-mail').fill('demonstracao@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('Senha-ficticia-123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole('heading', { name: 'Seu painel' })).toBeVisible();

  await page.getByRole('link', { name: 'Catalogo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Catalogo', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Fundamentos de dados', exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Painel' }).click();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('status')).toContainText(/sessao encerrada/i);
});
