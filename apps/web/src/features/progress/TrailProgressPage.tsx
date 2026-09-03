import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useTrail } from '../catalog/api';
import { ApiProblem } from '../../services/api-client';
import { CatalogChangeNotice } from './CatalogChangeNotice';
import { ProgressControls } from './ProgressControls';
import { ProgressHistory } from './ProgressHistory';
import { useAppendProgress, useStartTrail } from './api';
import { useTrailProgress } from './api';

export function TrailProgressPage() {
  const { trailId = '' } = useParams();
  const trail = useTrail(trailId);
  const progress = useTrailProgress(trailId);
  const start = useStartTrail(trailId);
  const append = useAppendProgress(trailId);
  const [announcement, setAnnouncement] = useState('');
  const title = trail.data?.title ?? 'trilha';
  const stepTitles = new Map(trail.data?.steps.map((step) => [step.id, step.title]) ?? []);

  if (trail.isPending || progress.isPending) {
    return <p role="status">Carregando progresso...</p>;
  }
  if (trail.isError) {
    return <RetryableError retry={() => void trail.refetch()} />;
  }
  if (progress.isError) {
    if (progress.error instanceof ApiProblem && progress.error.problem.status === 404) {
      return (
        <section className="progress-page">
          <p className="eyebrow">Progresso pessoal</p>
          <h1 tabIndex={-1}>Progresso em {title}</h1>
          <p>Esta trilha ainda nao foi iniciada.</p>
          {start.isError && <p role="alert">Nao foi possivel iniciar a trilha. Tente novamente.</p>}
          <button type="button" disabled={start.isPending} onClick={() => start.mutate(undefined)}>
            {start.isPending ? 'Iniciando...' : 'Iniciar trilha'}
          </button>
          <p>
            <Link to={`/trilhas/${trailId}`}>Voltar aos detalhes da trilha</Link>
          </p>
        </section>
      );
    }
    return <RetryableError retry={() => void progress.refetch()} />;
  }

  const current = progress.data;
  return (
    <section className="progress-page wide-detail">
      <p className="eyebrow">Progresso pessoal</p>
      <h1 tabIndex={-1}>Progresso em {title}</h1>
      <div className="progress-summary" aria-label={`Progresso: ${current.percentage}%`}>
        <p>
          <strong>{current.percentage}% concluido</strong>
        </p>
        <progress max="100" value={current.percentage}>
          {current.percentage}%
        </progress>
      </div>
      {current.catalogChanged && <CatalogChangeNotice />}
      {current.reviewRequired && (
        <div className="review-notice" role="status">
          Revisar alteracoes conflitantes: comandos concorrentes foram preservados no historico.
        </div>
      )}
      {append.isError && (
        <p role="alert">
          Nao foi possivel registrar a alteracao. Confira os requisitos e tente novamente.
        </p>
      )}
      <p role="status" aria-live="polite" className={announcement ? '' : 'visually-hidden'}>
        {announcement || 'Progresso carregado'}
      </p>
      <ProgressControls
        progress={current}
        stepTitles={stepTitles}
        busy={append.isPending}
        onCommand={async (command) => {
          setAnnouncement('');
          await append.mutateAsync(command);
          setAnnouncement(
            command.supersedesEventId
              ? 'Correcao registrada com sucesso.'
              : 'Progresso atualizado.',
          );
        }}
      />
      <ProgressHistory events={current.history} stepTitles={stepTitles} />
    </section>
  );
}

function RetryableError({ retry }: { retry(): void }) {
  return (
    <section className="progress-page">
      <p role="alert">Nao foi possivel carregar o progresso.</p>
      <button type="button" onClick={retry}>
        Tentar novamente
      </button>
    </section>
  );
}
