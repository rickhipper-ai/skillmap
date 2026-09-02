import { useState, type FormEvent } from 'react';

import { identityRequest } from '../identity/api';

export function DeleteAccountDialog() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [receipt, setReceipt] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    setStatus('loading');
    try {
      const result = await identityRequest<{ requestId: string; deadlineAt: string }>(
        '/v1/users/me',
        {
          method: 'DELETE',
          body: { password },
        },
      );
      setReceipt(result?.requestId ?? 'indisponivel');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return (
    <aside className="danger-zone" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading">Excluir conta</h2>
      <p>
        A conta fica inacessivel imediatamente. Os dados identificaveis serao apagados em ate 30
        dias.
      </p>
      <form aria-label="Excluir conta" onSubmit={submit}>
        <label htmlFor="delete-password">Confirme sua senha</label>
        <input
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <button className="danger-button" type="submit" disabled={status === 'loading'}>
          Excluir minha conta
        </button>
      </form>
      {status === 'success' ? (
        <p role="status">Exclusao solicitada. Sessao encerrada. Protocolo: {receipt}.</p>
      ) : null}
      {status === 'error' ? (
        <p role="alert">Confirme a senha em uma sessao recente e tente novamente.</p>
      ) : null}
    </aside>
  );
}
