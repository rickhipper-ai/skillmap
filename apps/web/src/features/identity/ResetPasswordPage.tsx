import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { identityRequest } from './api';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [kind, setKind] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      if (token) {
        await identityRequest('/v1/password-resets', {
          body: { token, newPassword: data.get('newPassword') },
        });
        setMessage('Senha alterada. Todas as sessoes anteriores foram encerradas.');
      } else {
        await identityRequest('/v1/password-reset-requests', {
          body: { email: data.get('email') },
        });
        setMessage('Se existir uma conta ativa, as instrucoes serao enviadas.');
      }
      setKind('success');
    } catch {
      setKind('error');
      setMessage('Nao foi possivel concluir. Verifique os dados e tente novamente.');
    }
  }

  return (
    <section className="flow-page">
      <p className="eyebrow">Acesso seguro</p>
      <h1 tabIndex={-1}>Recuperar acesso</h1>
      <form aria-label="Recuperar acesso" onSubmit={submit}>
        {token ? (
          <>
            <label htmlFor="reset-password">Nova senha</label>
            <input
              id="reset-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <button type="submit">Redefinir senha</button>
          </>
        ) : (
          <>
            <label htmlFor="reset-email">E-mail</label>
            <input id="reset-email" name="email" type="email" autoComplete="email" required />
            <button type="submit">Enviar instrucoes</button>
          </>
        )}
      </form>
      {message ? <p role={kind === 'error' ? 'alert' : 'status'}>{message}</p> : null}
    </section>
  );
}
