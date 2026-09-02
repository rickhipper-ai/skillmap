import { expect, test } from '@playwright/test';

const ids = {
  category: '20000000-0000-4000-8000-000000000001',
  skill: '30000000-0000-4000-8000-000000000001',
  trail: '40000000-0000-4000-8000-000000000001',
  certification: '50000000-0000-4000-8000-000000000001',
};

test('visitor searches and inspects the equivalent catalog map', async ({ page }) => {
  const category = { id: ids.category, slug: 'dados', name: 'Dados', description: 'Dados' };
  const skill = {
    id: ids.skill,
    type: 'skill',
    slug: 'sql',
    title: 'SQL',
    summary: 'Consultas SQL',
    category,
  };
  const trail = {
    id: ids.trail,
    type: 'trail',
    slug: 'dados-essenciais',
    title: 'Dados essenciais',
    summary: 'Fundamentos',
    category,
  };
  const certification = {
    id: ids.certification,
    type: 'certification',
    slug: 'fundamentos-dados',
    title: 'Fundamentos de dados',
    summary: 'Certificacao introdutoria',
    category: null,
  };

  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/categories')) return route.fulfill({ json: [category] });
    if (path.endsWith(`/skills/${ids.skill}`))
      return route.fulfill({
        json: { ...skill, relatedTrails: [trail], relatedCertifications: [certification] },
      });
    if (path.endsWith(`/trails/${ids.trail}`))
      return route.fulfill({
        json: {
          ...trail,
          revisionId: '41000000-0000-4000-8000-000000000001',
          steps: [
            {
              id: '42000000-0000-4000-8000-000000000001',
              position: 1,
              title: 'Fundamentos',
              required: true,
              skills: [],
              prerequisiteStepIds: [],
            },
            {
              id: '42000000-0000-4000-8000-000000000002',
              position: 2,
              title: 'Consultas',
              required: true,
              skills: [skill],
              prerequisiteStepIds: ['42000000-0000-4000-8000-000000000001'],
            },
          ],
          relatedCertifications: [certification],
        },
      });
    if (path.endsWith(`/certifications/${ids.certification}`))
      return route.fulfill({
        json: {
          ...certification,
          revisionId: '51000000-0000-4000-8000-000000000001',
          issuer: 'Instituto Ficticio de Tecnologia',
          skills: [skill],
          trails: [trail],
          requirements: [
            {
              id: '52000000-0000-4000-8000-000000000001',
              title: 'Conhecer SQL',
              type: 'skill',
              targetId: ids.skill,
              required: true,
            },
          ],
        },
      });
    return route.fulfill({ json: { items: [skill, trail, certification], nextCursor: null } });
  });

  await page.goto('/catalogo');
  await page.getByLabel('Buscar no catalogo').fill('sql');
  await page.getByLabel('Tipo de item').selectOption('skill');
  await page.getByLabel('Categoria').selectOption(ids.category);
  await page.getByRole('link', { name: /SQL/ }).press('Enter');
  await expect(page.getByRole('heading', { name: 'SQL' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Relacionamentos da habilidade' })).toContainText(
    'Dados essenciais',
  );

  await page.goto(`/trilhas/${ids.trail}`);
  await expect(page.getByRole('list', { name: 'Mapa visual da trilha' })).toContainText(
    'Consultas',
  );
  await expect(page.getByRole('table', { name: 'Mapa textual da trilha' })).toContainText(
    'Consultas',
  );

  await page.goto(`/certificacoes/${ids.certification}`);
  await expect(page.getByText('Instituto Ficticio de Tecnologia')).toBeVisible();
  await expect(page.getByText('Conhecer SQL')).toBeVisible();
});
