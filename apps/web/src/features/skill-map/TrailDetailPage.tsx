import { Link, useLoaderData } from 'react-router-dom';

import { useTrail } from '../catalog/api';
import { SkillMap } from './SkillMap';

export function TrailDetailPage() {
  const { id } = useLoaderData() as { id: string };
  const trail = useTrail(id);
  if (trail.isPending) return <p role="status">Carregando trilha...</p>;
  if (trail.isError) return <p role="alert">Nao foi possivel carregar a trilha.</p>;
  return (
    <section className="detail-page wide-detail">
      <p className="eyebrow">Trilha ordenada</p>
      <h1 tabIndex={-1}>{trail.data.title}</h1>
      {trail.data.category && <p className="category-label">{trail.data.category.name}</p>}
      <p className="detail-summary">{trail.data.summary}</p>
      <p>
        <Link className="primary-link" to={`/progresso/trilhas/${trail.data.id}`}>
          Iniciar ou acompanhar progresso
        </Link>
      </p>
      <h2>Etapas da trilha</h2>
      <SkillMap steps={trail.data.steps} />
      <h2>Certificacoes relacionadas</h2>
      {trail.data.relatedCertifications.length ? (
        <ul>
          {trail.data.relatedCertifications.map((item) => (
            <li key={item.id}>
              <Link to={`/certificacoes/${item.id}`}>{item.title}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhuma certificacao publicada.</p>
      )}
    </section>
  );
}
