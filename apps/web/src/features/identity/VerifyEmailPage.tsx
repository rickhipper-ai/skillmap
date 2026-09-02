import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { identityRequest } from './api';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = String(new FormData(event.currentTarget).get('token') ?? '');
    setStatus('loading');
    try {
      await identityRequest('/v1/email-verifications', { body: { token } });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="flow-page">
      <p className="eyebrow">Ativacao</p>
      <h1 tabIndex={-1}>Confirmar e-mail</h1>
      <form aria-label="Confirmar e-mail" onSubmit={submit}>
        <label htmlFor="verification-token">Token de confirmacao</label>
        <input
          id="verification-token"
          name="token"
          defaultValue={params.get('token') ?? ''}
          minLength={32}
          required
        />
        <button type="submit" disabled={status === 'loading'}>
          Confirmar e-mail
        </button>
      </form>
      {status === 'success' ? (
        <p role="status">
          E-mail confirmado. Agora voce pode <Link to="/entrar">entrar</Link>.
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert">O link expirou ou ja foi utilizado. Solicite outro link.</p>
      ) : null}
    </section>
  );
}
