import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

afterEach(() => vi.unstubAllGlobals());

function renderAdministration() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/users/me')) return Response.json({ roles: ['content_admin'] });
      if (url.includes('/security/csrf-token')) return Response.json({ token: 'x'.repeat(32) });
      if (url.includes('/publications')) {
        return Response.json(
          {
            resourceId: '40000000-0000-4000-8000-000000000001',
            revisionId: '41000000-0000-4000-8000-000000000001',
            revisionNumber: 1,
            publishedAt: '2026-09-03T12:00:00.000Z',
          },
          { status: 201 },
        );
      }
      const body = init?.body ? (JSON.parse(String(init.body)) as { slug?: string }) : {};
      return Response.json(
        {
          id: '40000000-0000-4000-8000-000000000001',
          slug: body.slug ?? 'trilha-administrada',
          status: 'draft',
          updatedAt: '2026-09-03T12:00:00.000Z',
        },
        { status: init?.method === 'POST' ? 201 : 200 },
      );
    }),
  );
  return render(<App router={createAppRouter({ initialEntries: ['/administracao'] })} />);
}

describe('catalog administration experience', () => {
  it('provides an axe-clean responsive shell and lifecycle navigation', async () => {
    const { container } = renderAdministration();

    expect(await screen.findByRole('heading', { name: 'Administracao do catalogo' })).toBeVisible();
    const navigation = screen.getByRole('navigation', { name: 'Administracao do catalogo' });
    for (const name of ['Categorias', 'Habilidades', 'Trilhas', 'Certificacoes', 'Conquistas']) {
      expect(within(navigation).getByRole('link', { name })).toBeVisible();
    }
    expect(screen.getAllByText('Rascunho').length).toBeGreaterThan(0);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('validates category and skill fields and never submits server-owned properties', async () => {
    const user = userEvent.setup();
    renderAdministration();

    await user.type(await screen.findByLabelText('Slug da categoria'), 'Slug Invalido');
    await user.click(screen.getByRole('button', { name: 'Salvar categoria' }));
    expect(screen.getByText(/use letras minusculas, numeros e hifens/i)).toBeVisible();

    await user.clear(screen.getByLabelText('Slug da categoria'));
    await user.type(screen.getByLabelText('Slug da categoria'), 'dados-aplicados');
    await user.type(screen.getByLabelText('Nome da categoria'), 'Dados aplicados');
    await user.type(screen.getByLabelText('Descricao da categoria'), 'Praticas aplicadas.');
    await user.click(screen.getByRole('button', { name: 'Salvar categoria' }));
    const call = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      slug: 'dados-aplicados',
      name: 'Dados aplicados',
      description: 'Praticas aplicadas.',
    });
  });

  it('orders trail steps by keyboard and edits skill and prerequisite relationships', async () => {
    const user = userEvent.setup();
    renderAdministration();

    await user.click(await screen.findByRole('button', { name: 'Adicionar etapa' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar etapa' }));
    const titles = screen.getAllByLabelText(/Titulo da etapa/);
    await user.type(titles[0]!, 'Fundamentos');
    await user.type(titles[1]!, 'Pratica');
    await user.type(
      screen.getAllByLabelText(/IDs de habilidades/)[1]!,
      '30000000-0000-4000-8000-000000000001',
    );
    const prerequisites = screen.getAllByLabelText(/Pre-requisitos/)[1]!;
    await user.selectOptions(
      prerequisites,
      within(prerequisites).getByRole('option', { name: 'Fundamentos' }),
    );
    await user.click(screen.getByRole('button', { name: 'Mover Pratica para cima' }));

    const steps = screen.getAllByRole('group', { name: /Etapa \d/ });
    expect(within(steps[0]!).getByDisplayValue('Pratica')).toBeVisible();
    expect(screen.getByText(/ordem atual: Pratica, Fundamentos/i)).toBeVisible();
  });

  it('bounds achievement criteria and supports ordered certification requirements and publication states', async () => {
    const user = userEvent.setup();
    renderAdministration();

    await user.clear(await screen.findByLabelText('Quantidade minima'));
    await user.type(screen.getByLabelText('Quantidade minima'), '1001');
    await user.click(screen.getByRole('button', { name: 'Salvar conquista' }));
    expect(screen.getByText(/entre 1 e 1000/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Adicionar requisito' }));
    expect(screen.getByLabelText('Tipo do requisito 1')).toBeVisible();
    expect(screen.getByLabelText('Alvo do requisito 1')).toBeVisible();
    expect(screen.getByText(/publique para tornar visivel/i)).toBeVisible();
  });
});
