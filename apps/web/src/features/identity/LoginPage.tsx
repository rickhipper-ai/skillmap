import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { identityRequest } from './api';

export function LoginPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus('loading');
    try {
      await identityRequest('/v1/sessions', {
        body: { email: data.get('email'), password: data.get('password') },
      });
      await navigate('/perfil');
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
      <Link to="/recuperar-acesso">Esqueci minha senha</Link>
    </section>
  );
}
