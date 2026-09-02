import { expect, test } from '@playwright/test';

test('keyboard-only activation, profile, recovery, and deletion journey', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/security/csrf-token')) {
      await route.fulfill({
        json: { token: 'csrf-token-ficticio-com-mais-de-trinta-e-dois-caracteres' },
      });
      return;
    }
    if (path.endsWith('/registrations')) {
      await route.fulfill({ status: 201, json: { status: 'pending_verification' } });
      return;
    }
    if (path.endsWith('/sessions')) {
      await route.fulfill({
        status: 201,
        json: {
          id: '00000000-0000-4000-8000-000000000001',
          status: 'active',
          roles: ['user'],
          profile: null,
        },
      });
      return;
    }
    if (path.endsWith('/users/me') && route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        json: {
          id: '00000000-0000-4000-8000-000000000001',
          status: 'active',
          roles: ['user'],
          profile: {
            displayName: 'Pessoa Ficticia',
            currentRoleId: null,
            desiredRoleId: null,
            experienceLevel: 'beginner',
            interestCategoryIds: [],
            interestSkillIds: [],
          },
        },
      });
      return;
    }
    if (path.endsWith('/users/me') && route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 202,
        json: {
          requestId: '00000000-0000-4000-8000-000000000099',
          status: 'requested',
          requestedAt: '2026-09-01T12:00:00.000Z',
          deadlineAt: '2026-10-01T12:00:00.000Z',
        },
      });
      return;
    }
    await route.fulfill({ status: path.endsWith('/password-reset-requests') ? 202 : 204 });
  });

  await page.goto('/cadastro');
  await page.getByLabel('E-mail').pressSequentially('jornada.ficticia@example.test');
  await page.getByLabel('Senha').pressSequentially('Senha-ficticia-123!');
  await page.getByLabel(/aceito os termos/i).press('Space');
  await page.getByRole('button', { name: 'Criar conta' }).press('Enter');
  await expect(page.getByRole('status')).toContainText(/confirme/i);

  await page.goto('/verificar-email?token=token-ficticio-com-mais-de-trinta-e-dois-caracteres');
  await page.getByRole('button', { name: 'Confirmar e-mail' }).press('Enter');
  await page.goto('/entrar');
  await page.getByLabel('E-mail').pressSequentially('jornada.ficticia@example.test');
  await page.getByLabel('Senha').pressSequentially('Senha-ficticia-123!');
  await page.getByRole('button', { name: 'Entrar' }).press('Enter');

  await page.goto('/perfil');
  await page.getByLabel('Nome de exibicao').pressSequentially('Pessoa Ficticia');
  await page.getByLabel('Nivel de experiencia').press('ArrowDown');
  await expect(page.getByLabel('Nome de exibicao')).toHaveValue('Pessoa Ficticia');
  await expect(page.getByLabel('Nivel de experiencia')).toHaveValue('beginner');
  const profileResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/users/me') && response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Salvar perfil' }).press('Enter');
  expect((await profileResponse).status()).toBe(200);
  await expect(page.getByRole('status')).toContainText(/salvo/i);

  await page.goto('/recuperar-acesso');
  await page.getByLabel('E-mail').pressSequentially('jornada.ficticia@example.test');
  await page.getByRole('button', { name: 'Enviar instrucoes' }).press('Enter');
  await expect(page.getByRole('status')).toContainText(/se existir/i);

  await page.goto('/perfil');
  await page.getByLabel('Confirme sua senha').pressSequentially('Senha-ficticia-123!');
  await page.getByRole('button', { name: 'Excluir minha conta' }).press('Enter');
  await expect(page.getByRole('status')).toContainText(/exclusao/i);
});
