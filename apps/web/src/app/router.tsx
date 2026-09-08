import { useEffect } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  Link,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { LoginPage } from '../features/identity/LoginPage';
import { RegisterPage } from '../features/identity/RegisterPage';
import { ResetPasswordPage } from '../features/identity/ResetPasswordPage';
import { VerifyEmailPage } from '../features/identity/VerifyEmailPage';
import { AuthenticatedLayout } from '../features/identity/AuthenticatedLayout';
import { ProfilePage } from '../features/profile/ProfilePage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { CertificationDetailPage } from '../features/catalog/CertificationDetailPage';
import { catalogRouteLoader, detailRouteLoader } from '../features/catalog/routes';
import { SkillDetailPage } from '../features/skill-map/SkillDetailPage';
import { TrailDetailPage } from '../features/skill-map/TrailDetailPage';
import { TrailProgressPage } from '../features/progress/TrailProgressPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { CertificationRecordsPage } from '../features/credentials/CertificationRecordsPage';
import { AdminLayout } from '../features/administration/AdminLayout';
import { AdminCatalogPage } from '../features/administration/AdminCatalogPage';

interface RouterOptions {
  initialEntries?: string[];
}

function RouteEffects() {
  const location = useLocation();

  useEffect(() => {
    const heading = document.querySelector('main h1');
    if (heading instanceof HTMLElement) heading.focus();
    document.title = `${heading?.textContent ?? 'SKILL MAPS'} | SKILL MAPS`;
  }, [location.key]);

  return null;
}

function AppShell() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Ir para o conteudo
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="SKILL MAPS - Inicio">
          SKILL MAPS
        </Link>
        <nav aria-label="Principal">
          <Link to="/">Inicio</Link>
          <Link to="/catalogo">Catalogo</Link>
          <Link to="/painel">Painel</Link>
          <Link to="/credenciais">Certificações</Link>
          <Link to="/cadastro">Criar conta</Link>
          <Link to="/entrar">Entrar</Link>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <RouteEffects />
        <Outlet />
      </main>
    </>
  );
}

function HomePage() {
  return (
    <section>
      <p className="eyebrow">Desenvolvimento profissional</p>
      <h1 tabIndex={-1}>Seu proximo passo, com contexto</h1>
      <p>Explore habilidades e trilhas de aprendizagem em um mapa claro e auditavel.</p>
      <div className="home-actions">
        <Link to="/cadastro">Criar conta</Link>
        <Link to="/catalogo">Explorar catalogo</Link>
      </div>
    </section>
  );
}

function RouteErrorPage() {
  return (
    <section>
      <p className="eyebrow">Erro de navegacao</p>
      <h1 tabIndex={-1}>Pagina nao encontrada</h1>
      <p>O endereco informado nao corresponde a uma pagina disponivel.</p>
      <Link to="/">Voltar ao inicio</Link>
    </section>
  );
}

const routes = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'catalogo', loader: catalogRouteLoader, element: <CatalogPage /> },
      { path: 'habilidades/:skillId', loader: detailRouteLoader, element: <SkillDetailPage /> },
      { path: 'trilhas/:trailId', loader: detailRouteLoader, element: <TrailDetailPage /> },
      {
        path: 'certificacoes/:certificationId',
        loader: detailRouteLoader,
        element: <CertificationDetailPage />,
      },
      { path: 'cadastro', element: <RegisterPage /> },
      { path: 'entrar', element: <LoginPage /> },
      { path: 'verificar-email', element: <VerifyEmailPage /> },
      { path: 'recuperar-acesso', element: <ResetPasswordPage /> },
      {
        element: <AuthenticatedLayout />,
        children: [
          { path: 'perfil', element: <ProfilePage /> },
          { path: 'painel', element: <DashboardPage /> },
          { path: 'credenciais', element: <CertificationRecordsPage /> },
          { path: 'progresso/trilhas/:trailId', element: <TrailProgressPage /> },
          {
            path: 'administracao',
            element: <AdminLayout />,
            children: [{ index: true, element: <AdminCatalogPage /> }],
          },
        ],
      },
      { path: '*', element: <RouteErrorPage /> },
    ],
  },
];

export function createAppRouter(options: RouterOptions = {}) {
  return options.initialEntries
    ? createMemoryRouter(routes, { initialEntries: options.initialEntries })
    : createBrowserRouter(routes);
}

export type AppRouter = ReturnType<typeof createAppRouter>;
