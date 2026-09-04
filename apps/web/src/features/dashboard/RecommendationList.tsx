import type { Recommendation } from '@skill-maps/api-contract';
import { Link } from 'react-router-dom';

interface RecommendationListProps {
  recommendations: Recommendation[];
}

const reasonLabels: Record<Recommendation['reasonCode'], string> = {
  next_eligible_step: 'Proxima etapa elegivel',
  desired_role: 'Compativel com sua funcao desejada',
  interest_match: 'Compativel com seus interesses',
};

export function RecommendationList({ recommendations }: RecommendationListProps) {
  if (recommendations.length === 0) {
    return (
      <div className="dashboard-empty" role="status">
        <h2>Vamos encontrar seu proximo passo</h2>
        <p>
          Complete seu perfil ou explore o catalogo para que uma recomendacao relevante fique
          disponivel.
        </p>
        <div className="dashboard-actions">
          <Link className="primary-link" to="/perfil">
            Completar perfil
          </Link>
          <Link to="/catalogo">Explorar catalogo</Link>
        </div>
      </div>
    );
  }

  return (
    <ol className="recommendation-list" aria-label="Recomendacoes ordenadas">
      {recommendations.map((recommendation, index) => (
        <li
          data-recommendation
          data-reason-code={recommendation.reasonCode}
          className={index === 0 ? 'recommendation-primary' : ''}
          key={recommendation.id}
        >
          <p className="recommendation-rank">
            {index === 0 ? 'Recomendacao principal' : `Alternativa ${index}`}
          </p>
          <h3>{recommendation.title}</h3>
          <p className="reason-label">{reasonLabels[recommendation.reasonCode]}</p>
          <details>
            <summary>Por que esta recomendacao?</summary>
            <p>{recommendation.explanation}</p>
            <Evidence recommendation={recommendation} />
          </details>
          <Link
            className={index === 0 ? 'primary-link' : undefined}
            to={
              recommendation.targetType === 'trail_step'
                ? `/progresso/trilhas/${recommendation.trailId}`
                : `/trilhas/${recommendation.trailId}`
            }
          >
            {recommendation.targetType === 'trail_step' ? 'Continuar etapa' : 'Ver trilha'}
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Evidence({ recommendation }: { recommendation: Recommendation }) {
  const evidence = recommendation.evidence;
  if ('position' in evidence) {
    return (
      <dl className="recommendation-evidence">
        <div>
          <dt>Posicao na trilha</dt>
          <dd>{evidence.position}</dd>
        </div>
        <div>
          <dt>Requisitos concluidos</dt>
          <dd>{evidence.completedPrerequisiteStepIds.length}</dd>
        </div>
        <div>
          <dt>Versao do progresso</dt>
          <dd>{evidence.progressStreamVersion}</dd>
        </div>
      </dl>
    );
  }
  return (
    <dl className="recommendation-evidence">
      <div>
        <dt>Funcao desejada</dt>
        <dd>{evidence.desiredRoleId ? 'Correspondente' : 'Nao utilizada'}</dd>
      </div>
      <div>
        <dt>Interesses correspondentes</dt>
        <dd>
          {evidence.matchedInterestSkillIds.length + (evidence.matchedInterestCategoryId ? 1 : 0)}
        </dd>
      </div>
      <div>
        <dt>Pontuacao da regra</dt>
        <dd>{evidence.score}</dd>
      </div>
    </dl>
  );
}
