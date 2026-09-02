import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

function renderRoute(path: string) {
  return render(<App router={createAppRouter({ initialEntries: [path] })} />);
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
    ['/perfil', 'Perfil profissional'],
  ])('renders %s as a labelled and axe-clean form', async (path, heading) => {
    const { container } = renderRoute(path);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getAllByRole('form').length).toBeGreaterThan(0);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('requires explicit terms acceptance and announces registration state', async () => {
    const user = userEvent.setup();
    renderRoute('/cadastro');

    await user.type(screen.getByLabelText('E-mail'), 'ana.ficticia@example.test');
    await user.type(screen.getByLabelText('Senha'), 'Senha-ficticia-123!');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/termos/i);
  });

  it('makes destructive account deletion explicit and password-confirmed', async () => {
    renderRoute('/perfil');

    expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirme sua senha')).toBeInTheDocument();
  });

  it('loads the persisted profile for review and editing', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ token: 'csrf-token-ficticio-com-mais-de-trinta-e-dois-caracteres' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
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
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
    );

    renderRoute('/perfil');

    expect(await screen.findByDisplayValue('Pessoa Persistida')).toBeInTheDocument();
    expect(screen.getByLabelText('Nivel de experiencia')).toHaveValue('intermediate');
  });
});
