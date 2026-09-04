import { useEffect, useState, type FormEvent } from 'react';

import { useCreateCertificationRecord } from './api';

interface CertificationRecordFormProps {
  initialCertificationId?: string;
  renewalCertificationId: string | null;
  onSaved(mode: 'aquisicao' | 'renovacao'): void;
}

export function CertificationRecordForm({
  initialCertificationId = '',
  renewalCertificationId,
  onSaved,
}: CertificationRecordFormProps) {
  const createRecord = useCreateCertificationRecord();
  const [certificationId, setCertificationId] = useState(initialCertificationId);
  const [obtainedOn, setObtainedOn] = useState('');
  const [externalIdentifier, setExternalIdentifier] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [expiryError, setExpiryError] = useState('');
  const mode = renewalCertificationId ? 'renovacao' : 'aquisicao';

  useEffect(() => {
    if (!renewalCertificationId) return;
    setCertificationId(renewalCertificationId);
    setObtainedOn('');
    setExternalIdentifier('');
    setExpiresOn('');
    setExpiryError('');
  }, [renewalCertificationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (expiresOn && expiresOn <= obtainedOn) {
      setExpiryError('A validade deve ser posterior a data de obtencao.');
      return;
    }
    setExpiryError('');
    await createRecord.mutateAsync({
      certificationId,
      obtainedOn,
      externalIdentifier: externalIdentifier || null,
      expiresOn: expiresOn || null,
    });
    onSaved(mode);
  }

  return (
    <form className="credential-form" onSubmit={(event) => void submit(event)}>
      <fieldset>
        <legend>{mode === 'renovacao' ? 'Registrar renovacao' : 'Registrar aquisicao'}</legend>
        <p>
          Este registro e autodeclarado e nao representa verificacao pelo emissor da certificacao.
        </p>
        <label htmlFor="certification-id">Certificacao do catalogo</label>
        <input
          id="certification-id"
          type="text"
          required
          pattern="[0-9a-fA-F-]{36}"
          value={certificationId}
          onChange={(event) => setCertificationId(event.target.value)}
          aria-describedby="certification-id-help"
        />
        <small id="certification-id-help">Use o identificador exibido no catalogo.</small>

        <label htmlFor="obtained-on">Data de obtencao</label>
        <input
          id="obtained-on"
          type="date"
          required
          value={obtainedOn}
          onChange={(event) => setObtainedOn(event.target.value)}
        />

        <label htmlFor="external-identifier">Identificador externo (opcional)</label>
        <input
          id="external-identifier"
          type="text"
          maxLength={180}
          value={externalIdentifier}
          onChange={(event) => setExternalIdentifier(event.target.value)}
        />

        <label htmlFor="expires-on">Valida ate (opcional)</label>
        <input
          id="expires-on"
          type="date"
          value={expiresOn}
          aria-invalid={expiryError ? true : undefined}
          aria-describedby={expiryError ? 'expires-on-error' : undefined}
          onChange={(event) => setExpiresOn(event.target.value)}
        />
        {expiryError && (
          <span id="expires-on-error" className="field-error">
            {expiryError}
          </span>
        )}
      </fieldset>
      {createRecord.isError && (
        <p role="alert">
          Nao foi possivel salvar. Revise os dados e confirme se esta aquisicao ja consta no
          historico.
        </p>
      )}
      <button type="submit" disabled={createRecord.isPending}>
        {createRecord.isPending
          ? 'Salvando...'
          : mode === 'renovacao'
            ? 'Salvar renovacao'
            : 'Salvar aquisicao'}
      </button>
    </form>
  );
}
