import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

const category = {
  id: '20000000-0000-4000-8000-000000000001',
  slug: 'dados',
  name: 'Dados',
  description: 'Trabalho com dados',
};
const skill = {
  id: '30000000-0000-4000-8000-000000000001',
  type: 'skill',
  slug: 'sql',
  title: 'SQL',
  summary: 'Consultas SQL canonicas',
  category,
};
const trail = {
  id: '40000000-0000-4000-8000-000000000001',
  type: 'trail',
  slug: 'dados-essenciais',
  title: 'Dados essenciais',
  summary: 'Fundamentos para trabalhar com dados',
  category,
};
const certification = {
  id: '50000000-0000-4000-8000-000000000001',
  type: 'certification',
  slug: 'fundamentos-dados',
  title: 'Fundamentos de dados',
  summary: 'Certificacao introdutoria',
  category: null,
};

function mockCatalogApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input : input.url,
        'http://localhost',
      );
      if (url.pathname.endsWith('/categories')) return Response.json([category]);
      if (url.pathname.endsWith(`/skills/${skill.id}`)) {
        return Response.json({
          ...skill,
          relatedTrails: [trail],
          relatedCertifications: [certification],
        });
      }
      if (url.pathname.endsWith(`/trails/${trail.id}`)) {
        return Response.json({
          ...trail,
          revisionId: '41000000-0000-4000-8000-000000000001',
          steps: [
            {
              id: '42000000-0000-4000-8000-000000000001',
              position: 1,
              title: 'Fundamentos',
              description: 'Comece aqui',
              required: true,
              skills: [],
              prerequisiteStepIds: [],
            },
            {
              id: '42000000-0000-4000-8000-000000000002',
              position: 2,
              title: 'Consultas',
              description: 'Pratique',
              required: true,
              skills: [skill],
              prerequisiteStepIds: ['42000000-0000-4000-8000-000000000001'],
            },
          ],
          relatedCertifications: [certification],
        });
      }
      if (url.pathname.endsWith(`/certifications/${certification.id}`)) {
        return Response.json({
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
              targetId: skill.id,
              required: true,
            },
          ],
        });
      }
      return Response.json({ items: [skill, trail, certification], nextCursor: 'pagina-2' });
    }),
  );
}

function renderRoute(path: string) {
  return render(<App router={createAppRouter({ initialEntries: [path] })} />);
}

afterEach(() => vi.unstubAllGlobals());

describe('public catalog and semantic skill map', () => {
  it('supports search, type/category filters, pagination, and clearing filters', async () => {
    mockCatalogApi();
    const user = userEvent.setup();
    renderRoute('/catalogo');

    expect(await screen.findByRole('link', { name: /SQL/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar no catalogo'), 'sql');
    await user.selectOptions(screen.getByLabelText('Tipo de item'), 'skill');
    await user.selectOptions(screen.getByLabelText('Categoria'), category.id);
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('type=skill'),
        expect.anything(),
      ),
    );
    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByLabelText('Buscar no catalogo')).toHaveValue('');
  });

  it('renders an actionable empty state and an actionable error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json([]))
        .mockResolvedValueOnce(Response.json({ items: [], nextCursor: null })),
    );
    const { unmount } = renderRoute('/catalogo');
    expect(await screen.findByText('Nenhum item encontrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
    unmount();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderRoute('/catalogo');
    expect(await screen.findByRole('alert')).toHaveTextContent(/nao foi possivel carregar/i);
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it.each([
    [`/habilidades/${skill.id}`, 'SQL'],
    [`/trilhas/${trail.id}`, 'Dados essenciais'],
    [`/certificacoes/${certification.id}`, 'Fundamentos de dados'],
  ])('renders axe-clean public detail route %s', async (path, heading) => {
    mockCatalogApi();
    const { container } = renderRoute(path);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('keeps the ordered visual map and keyboard-readable text map equivalent', async () => {
    mockCatalogApi();
    const user = userEvent.setup();
    renderRoute(`/trilhas/${trail.id}`);

    expect(await screen.findByRole('list', { name: 'Mapa visual da trilha' })).toBeInTheDocument();
    const textMap = screen.getByRole('table', { name: 'Mapa textual da trilha' });
    expect(textMap).toHaveTextContent('1');
    expect(textMap).toHaveTextContent('Fundamentos');
    expect(textMap).toHaveTextContent('2');
    expect(textMap).toHaveTextContent('Consultas');
    await user.tab();
    expect(document.activeElement).not.toBe(document.body);
  });
});
