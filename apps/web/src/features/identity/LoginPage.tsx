import { useState, type FormEvent } from 'react';
import type { CurrentUser } from '@skill-maps/api-contract';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { currentUserQueryKey, identityRequest } from './api';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus('loading');
    try {
      const user = await identityRequest<CurrentUser>('/v1/sessions', {
        body: { email: data.get('email'), password: data.get('password') },
      });
      if (!user) throw new Error('Session response is empty');
      queryClient.setQueryData(currentUserQueryKey, user);
      const requestedPath = searchParams.get('returnTo');
      const returnTo =
        requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
          ? requestedPath
          : '/painel';
      await navigate(returnTo, { replace: true });
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="flow-page">
      <p className="eyebrow">Conta confirmada</p>
      <h1 tabIndex={-1}>Entrar</h1>
      <form aria-label="Entrar" onSubmit={submit}>
        <label htmlFor="login-email">E-mail</label>
        <input id="login-email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="login-password">Senha</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={12}
        />
        <button type="submit" disabled={status === 'loading'}>
          Entrar
        </button>
      </form>
      {status === 'error' ? (
        <p role="alert">E-mail ou senha invalidos, ou conta ainda nao confirmada.</p>
      ) : null}
      {typeof location.state === 'object' &&
      location.state !== null &&
      'message' in location.state ? (
        <p role="status">{String(location.state.message)}</p>
      ) : null}
      <p>
        Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
      </p>
      <p>
        <Link to="/recuperar-acesso">Esqueci minha senha</Link>
      </p>
    </section>
  );
}
