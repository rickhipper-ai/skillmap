import type { CurrentUser } from '@skill-maps/api-contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useState } from 'react';

import { ApiProblem } from '../../services/api-client';
import { currentUserQueryKey, getCurrentUser, identityRequest } from './api';

export function useAuthenticatedUser(): CurrentUser {
  return useOutletContext<CurrentUser>();
}

export function AuthenticatedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoutFailed, setLogoutFailed] = useState(false);
  const currentUser = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false,
  });

  if (currentUser.isPending) return <p role="status">Verificando sua sessao...</p>;
  if (currentUser.isError) {
    if (currentUser.error instanceof ApiProblem && currentUser.error.problem.status === 401) {
      const returnTo = `${location.pathname}${location.search}`;
      return <Navigate replace to={`/entrar?returnTo=${encodeURIComponent(returnTo)}`} />;
    }
    return (
      <section className="flow-page">
        <p className="eyebrow">Sessao indisponivel</p>
        <h1 tabIndex={-1}>Nao foi possivel verificar sua sessao</h1>
        <button type="button" onClick={() => void currentUser.refetch()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  async function logout() {
    setLogoutFailed(false);
    try {
      await identityRequest('/v1/sessions/current', { method: 'DELETE' });
      queryClient.removeQueries({ queryKey: currentUserQueryKey });
      await navigate('/entrar', { replace: true, state: { message: 'Sessao encerrada.' } });
    } catch {
      setLogoutFailed(true);
    }
  }

  return (
    <>
      <div className="session-toolbar" aria-label="Sessao autenticada">
        <span>{currentUser.data.profile?.displayName ?? 'Conta autenticada'}</span>
        <button type="button" className="secondary-button" onClick={() => void logout()}>
          Sair
        </button>
        {logoutFailed ? <span role="alert">Nao foi possivel encerrar a sessao.</span> : null}
      </div>
      <Outlet context={currentUser.data} />
    </>
  );
}
