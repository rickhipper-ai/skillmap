import { expect, test } from '@playwright/test';

const certificationId = '50000000-0000-4000-8000-000000000001';

test('acquisition, duplicate, renewal, and one-time achievement journey', async ({ page }) => {
  let sequence = 0;
  let records: Array<Record<string, unknown>> = [];
  const awards = [
    {
      achievementId: '70000000-0000-4000-8000-000000000001',
      title: 'Primeira certificacao',
      description: 'Registrou sua primeira certificacao.',
      awardedAt: '2026-09-03T10:00:00.000Z',
    },
  ];
  await page.route('**/api/v1/security/csrf-token', (route) =>
    route.fulfill({ json: { token: 'x'.repeat(32) } }),
  );
  await page.route('**/api/v1/me/achievements', (route) => route.fulfill({ json: awards }));
  await page.route('**/api/v1/me/certification-records', async (route, request) => {
    if (request.method() === 'GET') return route.fulfill({ json: records });
    const input = request.postDataJSON() as {
      certificationId: string;
      obtainedOn: string;
      externalIdentifier?: string | null;
      expiresOn?: string | null;
    };
    const duplicate = records.find(
      (record) =>
        record.certificationId === input.certificationId &&
        record.obtainedOn === input.obtainedOn &&
        (record.externalIdentifier ?? null) === (input.externalIdentifier ?? null),
    );
    if (duplicate) return route.fulfill({ status: 201, json: duplicate });
    sequence += 1;
    const created = {
      id: `60000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
      ...input,
      verificationStatus: 'self_declared',
      createdAt: `${input.obtainedOn}T12:00:00.000Z`,
    };
    records = [created, ...records];
    return route.fulfill({ status: 201, json: created });
  });

  await page.goto('/credenciais');
  await page.getByLabel('Certificacao do catalogo').fill(certificationId);
  await page.getByLabel('Data de obtencao').fill('2026-01-10');
  await page.getByRole('button', { name: 'Salvar aquisicao' }).click();
  await expect(page.getByText(/aquisicao registrada/i)).toBeVisible();
  await expect(page.locator('.self-declared-label')).toHaveCount(1);

  await page.getByRole('button', { name: 'Salvar aquisicao' }).click();
  await expect(page.locator('.self-declared-label')).toHaveCount(1);

  await page.getByRole('button', { name: 'Registrar renovacao' }).click();
  await page.getByLabel('Data de obtencao').fill('2027-01-10');
  await page.getByRole('button', { name: 'Salvar renovacao' }).click();
  await expect(page.locator('.self-declared-label')).toHaveCount(2);
  await expect(page.getByText(/10 de janeiro de 2026/i)).toBeVisible();
  await expect(page.getByText(/10 de janeiro de 2027/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Primeira certificacao' })).toHaveCount(1);
  await expect(page.getByText(/nao representa verificacao pelo emissor/i).first()).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
