import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';

import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

function renderRoute(initialEntry = '/') {
  const router = createAppRouter({ initialEntries: [initialEntry] });
  return render(<App router={router} />);
}

describe('application shell', () => {
  it('provides semantic navigation, main content, and one page heading', async () => {
    renderRoute();

    const navigation = screen.getByRole('navigation', { name: 'Principal' });
    expect(navigation).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Certificações' })).toHaveAttribute(
      'href',
      '/credenciais',
    );
    expect(screen.queryByRole('link', { name: 'Administracao' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders an actionable route error without exposing internals', async () => {
    renderRoute('/nao-existe');

    expect(
      await screen.findByRole('heading', { name: 'Pagina nao encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao inicio' })).toHaveAttribute('href', '/');
  });

  it('moves focus to the main heading after navigation', async () => {
    const user = userEvent.setup();
    renderRoute();

    await user.click(screen.getByRole('link', { name: 'Catalogo' }));

    expect(await screen.findByRole('heading', { name: 'Catalogo' })).toHaveFocus();
  });

  it('has no automated axe violations in the shell', async () => {
    const { container } = renderRoute();

    expect((await axe(container)).violations).toEqual([]);
  });
});
