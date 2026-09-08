import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

const certificationId = '50000000-0000-4000-8000-000000000001';
const record = {
  id: '60000000-0000-4000-8000-000000000001',
  certificationId,
  obtainedOn: '2026-01-10',
  externalIdentifier: 'CERT-001',
  expiresOn: '2027-01-10',
  verificationStatus: 'self_declared',
  createdAt: '2026-01-10T12:00:00.000Z',
};
const award = {
  achievementId: '70000000-0000-4000-8000-000000000001',
  title: 'Primeira certificacao',
  description: 'Registrou sua primeira certificacao.',
  awardedAt: '2026-01-10T12:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('credentials experience', () => {
  it('renders an accessible acquisition form, immutable history labels, and achievement cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/achievements')) return Response.json([award]);
        return Response.json([record]);
      }),
    );
    const { container } = render(
      <App router={createAppRouter({ initialEntries: ['/credenciais'] })} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/verificando sua sessao/i);
    expect(
      await screen.findByRole('heading', { name: 'Certificacoes e conquistas' }),
    ).toBeVisible();
    expect(await screen.findByLabelText('Certificacao do catalogo')).toBeRequired();
    expect(screen.getByLabelText('Data de obtencao')).toBeRequired();
    expect(screen.getByText('Autodeclarada')).toBeVisible();
    expect(screen.getAllByText(/nao representa verificacao pelo emissor/i)).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Primeira certificacao' })).toBeVisible();
    expect(screen.getByText(/concedida em 10 de janeiro de 2026/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Registrar renovacao' })).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('submits with CSRF/idempotency and keeps acquisitions when adding a renewal', async () => {
    const user = userEvent.setup();
    let records = [record];
    vi.stubGlobal('crypto', { randomUUID: () => '60000000-0000-4000-8000-000000000099' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/security/csrf-token')) return Response.json({ token: 'x'.repeat(32) });
        if (url.includes('/achievements')) return Response.json([]);
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as typeof record;
          const renewal = {
            ...record,
            ...body,
            id: '60000000-0000-4000-8000-000000000002',
            createdAt: '2027-01-11T12:00:00.000Z',
          };
          records = [renewal, ...records];
          return Response.json(renewal, { status: 201 });
        }
        return Response.json(records);
      }),
    );
    render(<App router={createAppRouter({ initialEntries: ['/credenciais'] })} />);
    await screen.findByText('CERT-001');

    await user.click(screen.getByRole('button', { name: 'Registrar renovacao' }));
    expect(screen.getByLabelText('Certificacao do catalogo')).toHaveValue(certificationId);
    await user.clear(screen.getByLabelText('Data de obtencao'));
    await user.type(screen.getByLabelText('Data de obtencao'), '2027-01-11');
    await user.clear(screen.getByLabelText('Valida ate (opcional)'));
    await user.type(screen.getByLabelText('Valida ate (opcional)'), '2028-01-11');
    await user.click(screen.getByRole('button', { name: 'Salvar renovacao' }));

    await waitFor(() => expect(screen.getAllByText('Autodeclarada')).toHaveLength(2));
    expect(screen.getByRole('status')).toHaveTextContent(/renovacao registrada/i);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/certification-records'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
          'X-CSRF-Token': 'x'.repeat(32),
        }),
      }),
    );
  });

  it('provides actionable empty, field validation, and retryable error states', async () => {
    const user = userEvent.setup();
    let offline = true;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('/users/me')) {
        return Response.json({ id: 'user-id', status: 'active', roles: ['user'], profile: null });
      }
      if (offline) throw new Error('offline');
      return Response.json([]);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App router={createAppRouter({ initialEntries: ['/credenciais'] })} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/nao foi possivel carregar/i);
    offline = false;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText(/nenhuma certificacao registrada/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Explorar certificacoes' })).toHaveAttribute(
      'href',
      '/catalogo?type=certification',
    );
    expect(screen.getByText(/nenhuma conquista recebida/i)).toBeVisible();

    await user.type(screen.getByLabelText('Certificacao do catalogo'), certificationId);
    await user.type(screen.getByLabelText('Data de obtencao'), '2026-01-10');
    await user.type(screen.getByLabelText('Valida ate (opcional)'), '2026-01-10');
    await user.click(screen.getByRole('button', { name: 'Salvar aquisicao' }));
    expect(screen.getByText(/validade deve ser posterior/i)).toBeVisible();
  });
});
