import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

const dashboard = {
  activeTrails: [
    {
      trailId: '40000000-0000-4000-8000-000000000001',
      title: 'Engenharia de dados',
      currentRevisionId: '41000000-0000-4000-8000-000000000001',
      percentage: 50,
      streamVersion: 7,
      lastActivityAt: '2026-09-03T10:00:00.000Z',
      catalogChanged: false,
    },
  ],
  certificationRecords: [],
  achievements: [],
  recommendations: [
    {
      id: '50000000-0000-4000-8000-000000000001',
      rank: 1,
      targetType: 'trail_step',
      trailId: '40000000-0000-4000-8000-000000000001',
      stepId: '42000000-0000-4000-8000-000000000002',
      title: 'Construir um pipeline',
      reasonCode: 'next_eligible_step',
      evidence: {
        position: 2,
        completedPrerequisiteStepIds: ['42000000-0000-4000-8000-000000000001'],
        progressStreamVersion: 7,
      },
      explanation: 'Esta e a proxima etapa elegivel; seus requisitos estao concluidos.',
      inputVersions: {
        ruleSetVersion: 1,
        profileVersion: 2,
        progressStreamVersion: 7,
        catalogRevisionId: '41000000-0000-4000-8000-000000000001',
      },
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('dashboard experience', () => {
  it('renders progress, primary recommendation evidence, and an accessible action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(dashboard)),
    );
    const ready = vi.fn();
    window.addEventListener('skillmaps:dashboard-view-ready', ready, { once: true });
    const { container } = render(<App router={createAppRouter({ initialEntries: ['/painel'] })} />);

    expect(screen.getByRole('status')).toHaveTextContent(/verificando sua sessao/i);
    expect(await screen.findByRole('heading', { name: 'Seu painel' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Engenharia de dados' })).toBeInTheDocument();
    expect(screen.getByText('50% concluido')).toBeInTheDocument();
    expect(screen.getByText(/ultima atividade.*3 de setembro de 2026/i)).toBeInTheDocument();
    expect(screen.getByText('Construir um pipeline')).toBeInTheDocument();
    expect(screen.getByText(/requisitos estao concluidos/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continuar etapa/i })).toHaveAttribute(
      'href',
      '/progresso/trilhas/40000000-0000-4000-8000-000000000001',
    );
    await waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect((ready.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
      activeTrailCount: 1,
      recommendationCount: 1,
    });
    expect((await axe(container)).violations).toEqual([]);
  });

  it('labels one primary trail and no more than two ordered alternatives', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...dashboard,
          activeTrails: [],
          recommendations: [1, 2, 3].map((rank) => ({
            ...dashboard.recommendations[0],
            id: `50000000-0000-4000-8000-00000000000${rank}`,
            rank,
            targetType: 'trail',
            trailId: `40000000-0000-4000-8000-00000000000${rank}`,
            stepId: null,
            title: `Trilha recomendada ${rank}`,
            reasonCode: rank === 1 ? 'desired_role' : 'interest_match',
            explanation:
              rank === 1
                ? 'Relacionada a sua funcao desejada.'
                : 'Relacionada aos seus interesses profissionais.',
          })),
        }),
      ),
    );
    render(<App router={createAppRouter({ initialEntries: ['/painel'] })} />);

    expect(await screen.findByText('Recomendacao principal')).toBeInTheDocument();
    expect(screen.getAllByText(/Alternativa [12]/)).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /ver trilha/i })).toHaveLength(3);
  });

  it('provides actionable empty, retryable error, and loading states', async () => {
    const user = userEvent.setup();
    let offline = true;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('/users/me')) {
        return Response.json({ id: 'user-id', status: 'active', roles: ['user'], profile: null });
      }
      if (offline) {
        offline = false;
        throw new Error('offline');
      }
      return Response.json({ ...dashboard, activeTrails: [], recommendations: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App router={createAppRouter({ initialEntries: ['/painel'] })} />);

    expect(screen.getByRole('status')).toHaveTextContent(/verificando sua sessao/i);
    expect(await screen.findByRole('alert')).toHaveTextContent(/nao foi possivel carregar/i);
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByText(/complete seu perfil ou explore o catalogo/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Completar perfil' })).toHaveAttribute(
      'href',
      '/perfil',
    );
    expect(screen.getByRole('link', { name: 'Explorar catalogo' })).toHaveAttribute(
      'href',
      '/catalogo',
    );
  });
});
