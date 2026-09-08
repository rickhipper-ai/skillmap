import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

function renderRoute(path: string) {
  return render(<App router={createAppRouter({ initialEntries: [path] })} />);
}

const currentUser = {
  id: '00000000-0000-4000-8000-000000000001',
  status: 'active',
  roles: ['user'],
  profile: {
    displayName: 'Pessoa Persistida',
    currentRoleId: null,
    desiredRoleId: null,
    experienceLevel: 'intermediate',
    interestCategoryIds: [],
    interestSkillIds: [],
  },
};

function problem(status: number, code: string) {
  return Response.json(
    { type: 'about:blank', title: 'Request failed', status, code, requestId: 'request-test' },
    { status },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('identity and profile pages', () => {
  it.each([
    ['/cadastro', 'Criar conta'],
    ['/entrar', 'Entrar'],
    ['/verificar-email', 'Confirmar e-mail'],
    ['/recuperar-acesso', 'Recuperar acesso'],
  ])('renders %s as a labelled and axe-clean form', async (path, heading) => {
    const { container } = renderRoute(path);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getAllByRole('form').length).toBeGreaterThan(0);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('requires explicit terms acceptance and announces registration state', async () => {
    const user = userEvent.setup();
    renderRoute('/cadastro');

    await user.type(screen.getByLabelText('Nome'), 'Ana Ficticia');
    await user.type(screen.getByLabelText('E-mail'), 'ana.ficticia@example.test');
    await user.type(screen.getByLabelText('Senha'), 'Senha-ficticia-123!');
    await user.type(screen.getByLabelText('Confirmar senha'), 'Senha-ficticia-123!');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/termos/i);
  });

  it('registers a valid demo account and explains automatic e-mail verification', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/security/csrf-token')) {
        return Response.json({ token: 'x'.repeat(32) });
      }
      expect(JSON.parse(String(init?.body))).toEqual({
        name: 'Ana Ficticia',
        email: 'ana.ficticia@example.test',
        password: 'Senha-ficticia-123!',
        acceptTerms: true,
      });
      return Response.json({ status: 'active', emailVerification: 'automatic' }, { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderRoute('/cadastro');

    await user.type(screen.getByLabelText('Nome'), 'Ana Ficticia');
    await user.type(screen.getByLabelText('E-mail'), 'ana.ficticia@example.test');
    await user.type(screen.getByLabelText('Senha'), 'Senha-ficticia-123!');
    await user.type(screen.getByLabelText('Confirmar senha'), 'Senha-ficticia-123!');
    await user.click(screen.getByLabelText(/aceito os termos/i));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/confirmado automaticamente/i);
    expect(
      screen
        .getAllByRole('link', { name: 'Entrar' })
        .some((link) => link.getAttribute('href') === '/entrar'),
    ).toBe(true);
  });

  it('shows friendly duplicate e-mail and invalid password messages', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ token: 'x'.repeat(32) }))
        .mockResolvedValueOnce(problem(409, 'EMAIL_ALREADY_REGISTERED')),
    );
    renderRoute('/cadastro');

    await user.type(screen.getByLabelText('Nome'), 'Ana Ficticia');
    await user.type(screen.getByLabelText('E-mail'), 'duplicado@example.test');
    await user.type(screen.getByLabelText('Senha'), 'Senha-ficticia-123!');
    await user.type(screen.getByLabelText('Confirmar senha'), 'Senha-ficticia-123!');
    await user.click(screen.getByLabelText(/aceito os termos/i));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/ja esta cadastrado/i);

    await user.clear(screen.getByLabelText('Senha'));
    await user.clear(screen.getByLabelText('Confirmar senha'));
    await user.type(screen.getByLabelText('Senha'), 'curta');
    await user.type(screen.getByLabelText('Confirmar senha'), 'curta');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/entre 12 e 128/i);
  });

  it('logs in, restores an authenticated session, redirects to the panel, and logs out', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/security/csrf-token')) return Response.json({ token: 'x'.repeat(32) });
        if (url.endsWith('/sessions') && init?.method === 'POST') {
          return Response.json(currentUser, { status: 201 });
        }
        if (url.includes('/me/dashboard')) {
          return Response.json({
            activeTrails: [],
            certificationRecords: [],
            achievements: [],
            recommendations: [],
          });
        }
        if (url.endsWith('/sessions/current') && init?.method === 'DELETE') {
          return new Response(null, { status: 204 });
        }
        return Response.json(currentUser);
      }),
    );
    renderRoute('/entrar');

    expect(screen.getByText(/Ainda não tem conta/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('E-mail'), 'ana.ficticia@example.test');
    await user.type(screen.getByLabelText('Senha'), 'Senha-ficticia-123!');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Seu painel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/sessao encerrada/i);
  });

  it('shows invalid login and redirects anonymous protected access to login', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ token: 'x'.repeat(32) }))
        .mockResolvedValueOnce(problem(401, 'INVALID_CREDENTIALS')),
    );
    const first = renderRoute('/entrar');
    await user.type(screen.getByLabelText('E-mail'), 'ana.ficticia@example.test');
    await user.type(screen.getByLabelText('Senha'), 'Senha-incorreta-123!');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalidos/i);
    first.unmount();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(401, 'AUTHENTICATION_REQUIRED')));
    renderRoute('/painel');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('makes destructive account deletion explicit and password-confirmed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(currentUser)));
    renderRoute('/perfil');

    expect(await screen.findByRole('button', { name: 'Excluir minha conta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirme sua senha')).toBeInTheDocument();
  });

  it('loads the persisted profile for review and editing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(currentUser)));

    renderRoute('/perfil');

    expect(await screen.findByDisplayValue('Pessoa Persistida')).toBeInTheDocument();
    expect(screen.getByLabelText('Nivel de experiencia')).toHaveValue('intermediate');
  });
});
