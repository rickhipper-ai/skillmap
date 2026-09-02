import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { identityRequest } from './api';

export function RegisterPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('acceptTerms') !== 'on') {
      setStatus('error');
      setMessage('Aceite os termos para criar sua conta.');
      return;
    }
    setStatus('loading');
    setMessage('Criando conta...');
    try {
      await identityRequest('/v1/registrations', {
        body: {
          email: data.get('email'),
          password: data.get('password'),
          acceptTerms: true,
        },
      });
      setStatus('success');
      setMessage('Conta criada. Confirme seu e-mail antes de entrar.');
    } catch {
      setStatus('error');
      setMessage('Nao foi possivel criar a conta. Revise os campos e tente novamente.');
    }
  }

  return (
    <section className="flow-page">
      <p className="eyebrow">Comece seu mapa</p>
      <h1 tabIndex={-1}>Criar conta</h1>
      <p>A conta permanece sem acesso ate a confirmacao do e-mail.</p>
      <form aria-label="Criar conta" onSubmit={submit} noValidate>
        <label htmlFor="register-email">E-mail</label>
        <input id="register-email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="register-password">Senha</label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
        <label className="check-field">
          <input name="acceptTerms" type="checkbox" />
          Aceito os termos aplicaveis
        </label>
        <button type="submit" disabled={status === 'loading'}>
          Criar conta
        </button>
      </form>
      {message ? <p role={status === 'error' ? 'alert' : 'status'}>{message}</p> : null}
      <p>
        Ja possui conta? <Link to="/entrar">Entrar</Link>
      </p>
    </section>
  );
}
