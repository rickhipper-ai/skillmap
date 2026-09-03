import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

const ids = {
  trail: '40000000-0000-4000-8000-000000000001',
  revision: '41000000-0000-4000-8000-000000000002',
  first: '42000000-0000-4000-8000-000000000001',
  second: '42000000-0000-4000-8000-000000000002',
};

const progress = {
  trailId: ids.trail,
  currentRevisionId: ids.revision,
  status: 'in_progress',
  percentage: 50,
  streamVersion: 3,
  catalogChanged: true,
  reviewRequired: true,
  steps: [
    { stepId: ids.first, state: 'completed', eligible: true, pendingPrerequisiteStepIds: [] },
    {
      stepId: ids.second,
      state: 'not_started',
      eligible: false,
      pendingPrerequisiteStepIds: [ids.first],
    },
  ],
  history: [
    {
      eventId: 7,
      stepId: ids.first,
      state: 'completed',
      occurredAt: '2026-01-01T10:00:00.000Z',
      source: 'user',
      observedRevisionId: 'old-revision',
    },
    {
      eventId: 8,
      stepId: ids.first,
      state: 'in_progress',
      occurredAt: '2026-01-01T11:00:00.000Z',
      source: 'user',
      supersedesEventId: 7,
      observedRevisionId: 'old-revision',
    },
  ],
};

function mockProgressApi() {
  vi.stubGlobal('crypto', { randomUUID: () => '60000000-0000-4000-8000-000000000001' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input : input.url,
        'http://localhost',
      );
      if (url.pathname.endsWith('/security/csrf-token'))
        return Response.json({ token: 'x'.repeat(32) });
      if (url.pathname.endsWith(`/trails/${ids.trail}`) && !url.pathname.includes('/me/')) {
        return Response.json({
          id: ids.trail,
          title: 'Trilha progressiva',
          summary: 'Aprenda em ordem',
          steps: [
            {
              id: ids.first,
              position: 1,
              title: 'Fundamentos',
              required: true,
              prerequisiteStepIds: [],
              skills: [],
            },
            {
              id: ids.second,
              position: 2,
              title: 'Pratica',
              required: true,
              prerequisiteStepIds: [ids.first],
              skills: [],
            },
          ],
          relatedCertifications: [],
        });
      }
      if (init?.method === 'POST')
        return Response.json(
          {
            eventId: 9,
            streamVersion: 4,
            state: 'completed',
            reviewRequired: false,
            trailProgress: { ...progress, reviewRequired: false },
          },
          { status: 201 },
        );
      return Response.json(progress);
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('trail progress experience', () => {
  it('shows percentage, pending prerequisites, chronological correction history, and notices', async () => {
    mockProgressApi();
    const { container } = render(
      <App router={createAppRouter({ initialEntries: [`/progresso/trilhas/${ids.trail}`] })} />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Progresso em Trilha progressiva' }),
    ).toBeInTheDocument();
    expect(screen.getByText('50% concluido')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/catalogo foi atualizado/i);
    expect(screen.getByText(/revisar alteracoes conflitantes/i)).toBeInTheDocument();
    expect(screen.getByText(/Pendente: Fundamentos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /concluir Pratica/i })).toBeDisabled();
    expect(screen.getByRole('list', { name: 'Historico cronologico' })).toHaveTextContent(
      'corrige o evento #7',
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it('sends a correction with CSRF and idempotency headers and announces success', async () => {
    mockProgressApi();
    const user = userEvent.setup();
    render(
      <App router={createAppRouter({ initialEntries: [`/progresso/trilhas/${ids.trail}`] })} />,
    );
    await screen.findByText('50% concluido');

    await user.click(screen.getByRole('button', { name: 'Corrigir Fundamentos' }));
    await user.selectOptions(screen.getByLabelText('Evento a corrigir'), '7');
    await user.selectOptions(screen.getByLabelText('Estado correto'), 'not_started');
    await user.click(screen.getByRole('button', { name: 'Registrar correcao' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/correcao registrada/i),
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/events'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
          'X-CSRF-Token': 'x'.repeat(32),
        }),
      }),
    );
  });

  it('renders loading and retryable error states', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(
      <App router={createAppRouter({ initialEntries: [`/progresso/trilhas/${ids.trail}`] })} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/carregando progresso/i);
    expect(await screen.findByRole('alert')).toHaveTextContent(/nao foi possivel carregar/i);
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
