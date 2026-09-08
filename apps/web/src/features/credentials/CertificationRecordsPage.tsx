import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AchievementsList } from './AchievementsList';
import { CertificationRecordForm } from './CertificationRecordForm';
import { useAchievements, useCertificationRecords } from './api';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function CertificationRecordsPage() {
  const records = useCertificationRecords();
  const achievements = useAchievements();
  const [searchParams] = useSearchParams();
  const [renewalCertificationId, setRenewalCertificationId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  if (records.isPending || achievements.isPending) {
    return (
      <section className="credentials-page">
        <p className="eyebrow">Evidencias profissionais</p>
        <h1 tabIndex={-1}>Certificacoes e conquistas</h1>
        <p role="status">Carregando certificações...</p>
      </section>
    );
  }

  if (records.isError || achievements.isError) {
    return (
      <section className="credentials-page">
        <p className="eyebrow">Evidencias profissionais</p>
        <h1 tabIndex={-1}>Certificacoes e conquistas</h1>
        <p role="alert">Nao foi possivel carregar suas certificações e conquistas.</p>
        <button
          type="button"
          onClick={() => void Promise.all([records.refetch(), achievements.refetch()])}
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section className="credentials-page wide-detail">
      <header className="credentials-intro">
        <div>
          <p className="eyebrow">Evidencias profissionais</p>
          <h1 tabIndex={-1}>Certificacoes e conquistas</h1>
        </div>
        <p>Registre cada obtencao ou renovacao sem apagar seu historico profissional.</p>
      </header>

      {notice && <p role="status">{notice}</p>}
      <div className="credentials-layout">
        <CertificationRecordForm
          initialCertificationId={searchParams.get('certificationId') ?? ''}
          renewalCertificationId={renewalCertificationId}
          onSaved={(mode) => {
            setNotice(`${mode === 'renovacao' ? 'Renovacao' : 'Aquisicao'} registrada.`);
            setRenewalCertificationId(null);
          }}
        />

        <section aria-labelledby="certification-history-heading">
          <p className="section-number">01</p>
          <h2 id="certification-history-heading">Historico imutavel</h2>
          {records.data.length === 0 ? (
            <div className="credential-empty">
              <h3>Nenhuma certificacao registrada</h3>
              <p>Explore o catalogo e registre uma certificacao que voce ja obteve.</p>
              <Link to="/catalogo?type=certification">Explorar certificacoes</Link>
            </div>
          ) : (
            <ol className="certification-history" aria-label="Historico de certificacoes">
              {records.data.map((record) => (
                <li key={record.id} id={`certification-record-${record.id}`}>
                  <p className="self-declared-label">Autodeclarada</p>
                  <h3>Certificacao {record.certificationId}</h3>
                  <p>
                    Obtida em {dateFormatter.format(new Date(`${record.obtainedOn}T00:00:00Z`))}
                  </p>
                  {record.externalIdentifier && <p>{record.externalIdentifier}</p>}
                  {record.expiresOn && (
                    <p>
                      Valida ate {dateFormatter.format(new Date(`${record.expiresOn}T00:00:00Z`))}
                    </p>
                  )}
                  <p className="self-declared-note">
                    Informacao autodeclarada; nao representa verificacao pelo emissor.
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setRenewalCertificationId(record.certificationId);
                      setNotice('');
                      const form = document.querySelector<HTMLFormElement>('.credential-form');
                      form?.scrollIntoView?.();
                    }}
                  >
                    Registrar renovacao
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="credentials-achievements" aria-labelledby="achievements-heading">
        <p className="section-number">02</p>
        <h2 id="achievements-heading">Conquistas</h2>
        <AchievementsList awards={achievements.data} />
      </section>
    </section>
  );
}
