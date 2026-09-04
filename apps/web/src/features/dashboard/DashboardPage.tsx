import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { useDashboard } from './api';
import { reportDashboardViewReady } from './dashboard-observability';
import { RecommendationList } from './RecommendationList';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function DashboardPage() {
  const dashboard = useDashboard();
  const reported = useRef(false);

  useEffect(() => {
    if (!dashboard.data || reported.current) return;
    reported.current = true;
    reportDashboardViewReady({
      activeTrailCount: dashboard.data.activeTrails.length,
      recommendationCount: dashboard.data.recommendations.length,
    });
  }, [dashboard.data]);

  if (dashboard.isPending) {
    return (
      <section className="dashboard-page">
        <p className="eyebrow">Visao consolidada</p>
        <h1 tabIndex={-1}>Seu painel</h1>
        <p role="status">Carregando painel...</p>
      </section>
    );
  }

  if (dashboard.isError) {
    return (
      <section className="dashboard-page">
        <p className="eyebrow">Visao consolidada</p>
        <h1 tabIndex={-1}>Seu painel</h1>
        <p role="alert">
          Nao foi possivel carregar seu painel. Seus dados confirmados continuam salvos.
        </p>
        <button type="button" onClick={() => void dashboard.refetch()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  const data = dashboard.data;
  return (
    <section className="dashboard-page wide-detail">
      <header className="dashboard-intro">
        <div>
          <p className="eyebrow">Visao consolidada</p>
          <h1 tabIndex={-1}>Seu painel</h1>
        </div>
        <p>Progresso atual, evidencias e uma direcao clara para continuar aprendendo.</p>
      </header>

      <section className="dashboard-section" aria-labelledby="active-trails-heading">
        <div className="section-heading">
          <div>
            <p className="section-number">01</p>
            <h2 id="active-trails-heading">Trilhas em andamento</h2>
          </div>
          <span>{data.activeTrails.length}</span>
        </div>
        {data.activeTrails.length === 0 ? (
          <p>Nenhuma trilha em andamento.</p>
        ) : (
          <ul className="dashboard-progress-grid">
            {data.activeTrails.map((trail) => (
              <li key={trail.trailId}>
                <h3>{trail.title}</h3>
                <p className="progress-value">{trail.percentage}% concluido</p>
                <progress
                  max="100"
                  value={trail.percentage}
                  aria-label={`${trail.title}: ${trail.percentage}%`}
                />
                <p>Ultima atividade: {dateFormatter.format(new Date(trail.lastActivityAt))}</p>
                {trail.catalogChanged && (
                  <p className="catalog-version-note">Calculado com a publicacao mais recente.</p>
                )}
                <Link to={`/progresso/trilhas/${trail.trailId}`}>Ver progresso</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="recommendations-heading">
        <div className="section-heading">
          <div>
            <p className="section-number">02</p>
            <h2 id="recommendations-heading">Proximo passo recomendado</h2>
          </div>
        </div>
        <RecommendationList recommendations={data.recommendations} />
      </section>

      <section className="dashboard-section dashboard-records" aria-labelledby="records-heading">
        <div className="section-heading">
          <div>
            <p className="section-number">03</p>
            <h2 id="records-heading">Evidencias profissionais</h2>
          </div>
        </div>
        <div>
          <h3>Certificacoes registradas</h3>
          <p>{data.certificationRecords.length || 'Nenhuma certificacao registrada.'}</p>
          <Link to="/credenciais">Ver historico de certificacoes</Link>
        </div>
        <div>
          <h3>Conquistas</h3>
          <p>{data.achievements.length || 'Nenhuma conquista recebida.'}</p>
          <Link to="/credenciais#achievements-heading">Ver conquistas</Link>
        </div>
      </section>
    </section>
  );
}
