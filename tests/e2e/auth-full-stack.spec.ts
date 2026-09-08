import { expect, test } from '@playwright/test';

test.skip(
  process.env.SKILL_MAPS_FULL_STACK_E2E !== '1',
  'Requires the configured API and PostgreSQL environment.',
);

test('cadastro, login, sessao, catalogo e logout com API real', async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `playwright.${unique}@example.test`;
  const password = 'Senha-playwright-123!';

  await page.goto('/');
  await page.getByRole('link', { name: 'Criar conta' }).first().click();
  await page.getByLabel('Nome').fill('Pessoa Playwright');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirmar senha').fill(password);
  await page.getByLabel(/aceito os termos/i).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('status')).toContainText(/confirmado automaticamente/i);

  await page.getByRole('link', { name: 'Entrar' }).last().click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Senha-incorreta-123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText(/invalidos/i);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole('heading', { name: 'Seu painel' })).toBeVisible();
  await expect(page.getByLabel('Sessao autenticada')).toContainText('Pessoa Playwright');

  await page.getByRole('link', { name: 'Catalogo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Catalogo', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Fundamentos de dados', exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Painel' }).click();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('status')).toContainText(/sessao encerrada/i);

  await page.getByRole('link', { name: 'Criar conta' }).last().click();
  await page.getByLabel('Nome').fill('Pessoa Playwright');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirmar senha').fill(password);
  await page.getByLabel(/aceito os termos/i).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('alert')).toContainText(/ja esta cadastrado/i);
});
