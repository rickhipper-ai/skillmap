import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const trailId = '40000000-0000-4000-8000-000000000001';

const routes = [
  ['home', '/', 'Seu proximo passo, com contexto'],
  ['catalog', '/catalogo', 'Catalogo'],
  ['registration', '/cadastro', 'Criar conta'],
  ['login', '/entrar', 'Entrar'],
  ['profile', '/perfil', 'Perfil profissional'],
  ['dashboard', '/painel', 'Seu painel'],
  ['credentials', '/credenciais', 'Certificacoes e conquistas'],
  ['progress', `/progresso/trilhas/${trailId}`, 'Progresso em Trilha de teste'],
  ['administration', '/administracao', 'Administracao do catalogo'],
] as const;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path.endsWith('/security/csrf-token')) {
      return route.fulfill({
        json: { token: 'fictitious-csrf-token-at-least-thirty-two-characters' },
      });
    }
    if (path.endsWith('/categories') || path.endsWith('/certification-records')) {
      return route.fulfill({ json: [] });
    }
    if (path.endsWith('/achievements')) return route.fulfill({ json: [] });
    if (path.endsWith('/dashboard')) {
      return route.fulfill({
        json: {
          activeTrails: [],
          certificationRecords: [],
          achievements: [],
          recommendations: [],
        },
      });
    }
    if (path.endsWith(`/me/trails/${trailId}`)) {
      return route.fulfill({
        status: 200,
        json: {
          trailId,
          currentRevisionId: '41000000-0000-4000-8000-000000000001',
          status: 'in_progress',
          percentage: 0,
          streamVersion: 0,
          reviewRequired: false,
          catalogChanged: false,
          steps: [],
          history: [],
        },
      });
    }
    if (path.endsWith(`/trails/${trailId}`)) {
      return route.fulfill({
        json: {
          id: trailId,
          type: 'trail',
          slug: 'trilha-de-teste',
          title: 'Trilha de teste',
          summary: 'Trilha ficticia para validacao de release.',
          category: null,
          revisionId: '41000000-0000-4000-8000-000000000001',
          steps: [],
          relatedCertifications: [],
        },
      });
    }
    if (path.endsWith('/users/me')) {
      return route.fulfill({
        json: {
          id: '10000000-0000-4000-8000-000000000001',
          status: 'active',
          roles: ['content_admin'],
          profile: null,
        },
      });
    }
    if (path.includes('/admin/')) return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
});

test('critical routes reflow and have no automated WCAG A/AA violations', async ({ page }) => {
  for (const [name, path, heading] of routes) {
    await test.step(name, async () => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        )
        .toBe(true);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
