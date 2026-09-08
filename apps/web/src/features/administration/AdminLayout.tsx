import { Link, Outlet } from 'react-router-dom';

import { useAuthenticatedUser } from '../identity/AuthenticatedLayout';

export function AdminLayout() {
  const currentUser = useAuthenticatedUser();

  if (!currentUser.roles.includes('content_admin')) {
    return (
      <section className="flow-page">
        <p className="eyebrow">Acesso restrito</p>
        <h1 tabIndex={-1}>Administracao indisponivel</h1>
        <p role="alert">Voce precisa de permissao de administracao de conteudo.</p>
        <Link to="/">Voltar ao inicio</Link>
      </section>
    );
  }

  return (
    <div className="admin-shell">
      <aside>
        <p className="admin-mark">Area de conteudo</p>
        <nav aria-label="Administracao do catalogo">
          <a href="#categorias">Categorias</a>
          <a href="#habilidades">Habilidades</a>
          <a href="#trilhas">Trilhas</a>
          <a href="#certificacoes">Certificacoes</a>
          <a href="#conquistas">Conquistas</a>
        </nav>
      </aside>
      <Outlet />
    </div>
  );
}
