import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ApiProblem } from '../../services/api-client';
import { identityRequest } from './api';

interface RegistrationResult {
  status: 'pending_verification' | 'active';
  emailVerification: 'required' | 'automatic';
}

export function RegisterPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [verification, setVerification] = useState<'required' | 'automatic'>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const passwordConfirmation = String(data.get('passwordConfirmation') ?? '');
    if (!name) {
      setStatus('error');
      setMessage('Informe seu nome para criar a conta.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus('error');
      setMessage('Informe um e-mail valido.');
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setStatus('error');
      setMessage('A senha deve ter entre 12 e 128 caracteres.');
      return;
    }
    if (password !== passwordConfirmation) {
      setStatus('error');
      setMessage('A confirmacao da senha nao corresponde.');
      return;
    }
    if (data.get('acceptTerms') !== 'on') {
      setStatus('error');
      setMessage('Aceite os termos para criar sua conta.');
      return;
    }
    setStatus('loading');
    setVerification(undefined);
    setMessage('Criando conta...');
    try {
      const result = await identityRequest<RegistrationResult>('/v1/registrations', {
        body: {
          name,
          email,
          password,
          acceptTerms: true,
        },
      });
      if (!result) throw new Error('Registration response is empty');
      setStatus('success');
      setVerification(result.emailVerification);
      setMessage(
        result.emailVerification === 'automatic'
          ? 'Conta criada e e-mail confirmado automaticamente para esta demonstracao. Voce ja pode entrar.'
          : 'Conta criada. Enviamos um link de confirmacao para seu e-mail antes do primeiro acesso.',
      );
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof ApiProblem && error.problem.code === 'EMAIL_ALREADY_REGISTERED'
          ? 'Este e-mail ja esta cadastrado. Entre com sua conta ou recupere o acesso.'
          : 'Nao foi possivel criar a conta. Revise os campos e tente novamente.',
      );
    }
  }

  return (
    <section className="flow-page">
      <p className="eyebrow">Comece seu mapa</p>
      <h1 tabIndex={-1}>Criar conta</h1>
      <p>
        Crie seu acesso. Em ambientes sem confirmacao automatica, enviaremos um link por e-mail.
      </p>
      <form aria-label="Criar conta" onSubmit={submit} noValidate>
        <label htmlFor="register-name">Nome</label>
        <input id="register-name" name="name" autoComplete="name" maxLength={120} required />
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
        <p id="password-policy">Use entre 12 e 128 caracteres.</p>
        <label htmlFor="register-password-confirmation">Confirmar senha</label>
        <input
          id="register-password-confirmation"
          name="passwordConfirmation"
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
      {status === 'success' && verification === 'required' ? (
        <p>
          Ja recebeu o link? <Link to="/verificar-email">Confirmar e-mail</Link>
        </p>
      ) : null}
      <p>
        Ja possui conta? <Link to="/entrar">Entrar</Link>
      </p>
    </section>
  );
}
